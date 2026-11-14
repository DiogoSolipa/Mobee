import 'server-only';
import type { TripOption } from '../domain/types';
import { optionsFromPlan, type MotisPlan } from './normalise';

/**
 * Server-side MOTIS 2 client (the trip planner).
 * TRIP_PLANNER_URL points at any MOTIS 2 server. Default: Transitous (community instance, open source /
 * non-commercial use, light load only — see README "Trip planner"). For production run your own MOTIS
 * with the Lisbon feeds and set TRIP_PLANNER_URL to it: the code does not change.
 */

export const PLANNER_BASE = () => (process.env.TRIP_PLANNER_URL?.trim() || 'https://api.transitous.org').replace(/\/$/, '');
const UA = process.env.TRIP_PLANNER_USER_AGENT?.trim() || 'Mobee/0.1 (pilot; https://github.com/DiogoSolipa/mobee)';
const TIMEOUT_MS = 10_000;
const CACHE_MS = 10 * 60_000;
const LISBON = { lat: 38.7223, lon: -9.1393 };

export interface Coord { lat: number; lon: number }
export interface LegRequest { key: string; from: Coord; to: Coord; departAt: number; wheelchair?: boolean }
export interface LegResult { options: TripOption[]; error?: string }

const cache = new Map<string, { at: number; value: LegResult }>();
const r5 = (n: number) => n.toFixed(5);
const bucket = (t: number) => Math.floor(t / (5 * 60_000)) * 5 * 60_000; // 5-minute buckets share a cache entry

async function get(url: string): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal, cache: 'no-store', headers: { accept: 'application/json', 'user-agent': UA } });
    if (res.status === 429) throw new Error('Trip planner rate limit reached');
    if (!res.ok) throw new Error(`Trip planner HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') throw new Error('Trip planner timed out');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export async function planLeg(r: LegRequest): Promise<LegResult> {
  const t = bucket(r.departAt);
  const ck = `${r5(r.from.lat)},${r5(r.from.lon)}|${r5(r.to.lat)},${r5(r.to.lon)}|${t}|${r.wheelchair ? 1 : 0}`;
  const hit = cache.get(ck);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  const q = new URLSearchParams({
    fromPlace: `${r.from.lat},${r.from.lon}`,
    toPlace: `${r.to.lat},${r.to.lon}`,
    time: new Date(t).toISOString(),
    numItineraries: '4',
    directModes: 'WALK',
    maxDirectTime: String(45 * 60),
    detailedTransfers: 'false',
  });
  if (r.wheelchair) q.set('pedestrianProfile', 'WHEELCHAIR');
  try {
    const plan = (await get(`${PLANNER_BASE()}/api/v5/plan?${q}`)) as MotisPlan;
    const value: LegResult = { options: optionsFromPlan(plan) };
    if (!value.options.length) value.error = 'No route found';
    cache.set(ck, { at: Date.now(), value });
    return value;
  } catch (e) {
    return { options: [], error: e instanceof Error ? e.message : 'Trip planner error' };
  }
}

/** Plan many legs with limited concurrency (be gentle with the planner). */
export async function planLegs(reqs: LegRequest[], concurrency = 3): Promise<Record<string, LegResult>> {
  const out: Record<string, LegResult> = {};
  let i = 0;
  async function worker() {
    while (i < reqs.length) {
      const r = reqs[i++];
      out[r.key] = await planLeg(r);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, reqs.length) }, worker));
  return out;
}

export interface PlaceHit { id: string; name: string; area?: string; lat: number; lon: number; kind: 'place' | 'stop' | 'address' }

interface GeocodeHit { type?: string; name?: string; id?: string; lat?: number; lon?: number; country?: string; areas?: { name?: string; adminLevel?: number; default?: boolean }[]; street?: string; houseNumber?: string }

/** Place search (MOTIS geocode), biased to and filtered around Lisbon. */
export async function searchPlaces(text: string): Promise<PlaceHit[]> {
  const q = new URLSearchParams({ text, place: `${LISBON.lat},${LISBON.lon}`, placeBias: '5', language: 'pt' });
  const hits = (await get(`${PLANNER_BASE()}/api/v1/geocode?${q}`)) as GeocodeHit[];
  if (!Array.isArray(hits)) return [];
  const near = (h: GeocodeHit) => h.lat !== undefined && h.lon !== undefined && Math.abs(h.lat - LISBON.lat) < 0.6 && Math.abs(h.lon - LISBON.lon) < 0.7;
  return hits
    .filter((h) => h.country === 'PT' && near(h))
    .slice(0, 8)
    .map((h) => {
      const area = h.areas?.find((a) => a.default)?.name ?? h.areas?.find((a) => (a.adminLevel ?? 0) >= 8)?.name;
      const name = h.type === 'ADDRESS' && h.street ? `${h.street}${h.houseNumber ? ` ${h.houseNumber}` : ''}` : h.name ?? '';
      return { id: h.id ?? `${h.lat},${h.lon}`, name, area, lat: h.lat!, lon: h.lon!, kind: h.type === 'STOP' ? 'stop' : h.type === 'ADDRESS' ? 'address' : 'place' };
    });
}
