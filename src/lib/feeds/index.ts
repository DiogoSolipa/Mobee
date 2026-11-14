import 'server-only';
import { lisbonNow } from '../domain/time';
import type { Disruption, DisruptionSource, FeedHealth, FeedSnapshot } from '../domain/types';
import { parseAlerts } from './gtfsrt';
import { LISBON_FORECAST_ID, parseRainProbability, parseWarnings } from './ipma';
import { parseLineStatus } from './metroLisboa';

/**
 * Server-side feed aggregator (FR-32 – FR-37).
 * Runs in a Vercel function: operators are called from the server, never from the phone,
 * so there are no CORS problems and API keys stay secret.
 * Results are cached in memory for CACHE_MS per warm instance; the client polls /api/feeds.
 */

const CACHE_MS = 30_000;
const TIMEOUT_MS = 8_000;

const env = (k: string, d: string) => (process.env[k] && process.env[k]!.trim()) || d;
export const BASES = {
  tml: () => env('TML_GO_BASE', 'https://go.tmlmobilidade.pt/hub/api/v1'),
  cm: () => env('CARRIS_METROPOLITANA_BASE', 'https://api.carrismetropolitana.pt/v2'),
  ipma: () => env('IPMA_BASE', 'https://api.ipma.pt/open-data'),
};

async function getJson(url: string, init: RequestInit = {}): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal, cache: 'no-store', headers: { accept: 'application/json', 'user-agent': 'Mobee/0.1 (+pilot)', ...(init.headers ?? {}) } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

interface SourceResult { disruptions: Disruption[]; rainProbability?: number }
interface Source { id: DisruptionSource; label: string; run: () => Promise<SourceResult | 'skipped'> }

let metroToken: { value: string; expires: number } | null = null;
async function metroBearer(): Promise<string | null> {
  const key = process.env.METRO_LISBOA_CONSUMER_KEY, secret = process.env.METRO_LISBOA_CONSUMER_SECRET;
  if (!key || !secret) return null;
  if (metroToken && metroToken.expires > Date.now() + 30_000) return metroToken.value;
  const json = (await getJson('https://api.metrolisboa.pt:8243/token', {
    method: 'POST',
    headers: { authorization: `Basic ${Buffer.from(`${key}:${secret}`).toString('base64')}`, 'content-type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  })) as { access_token: string; expires_in: number };
  metroToken = { value: json.access_token, expires: Date.now() + (json.expires_in ?? 300) * 1000 };
  return metroToken.value;
}

export const SOURCES: Source[] = [
  {
    id: 'tml', label: 'TML GO hub · alerts (all Lisbon operators)',
    run: async () => ({ disruptions: parseAlerts(await getJson(`${BASES.tml()}/alerts/gtfs`), 'tml', 'tml') }),
  },
  {
    id: 'carris-metropolitana', label: 'Carris Metropolitana · alerts',
    run: async () => ({ disruptions: parseAlerts(await getJson(`${BASES.cm()}/alerts`), 'carris-metropolitana', 'cm') }),
  },
  {
    id: 'metro-lisboa', label: 'Metro de Lisboa · line status',
    run: async () => {
      const token = await metroBearer();
      if (!token) return 'skipped';
      const json = await getJson('https://api.metrolisboa.pt:8243/estadoServicoML/1.0.1/estadoLinha/todos', { headers: { authorization: `Bearer ${token}` } });
      return { disruptions: parseLineStatus(json, Date.now()) };
    },
  },
  {
    id: 'ipma', label: 'IPMA · warnings and Lisbon forecast',
    run: async () => {
      const [warnings, forecast] = await Promise.all([
        getJson(`${BASES.ipma()}/forecast/warnings/warnings_www.json`),
        getJson(`${BASES.ipma()}/forecast/meteorology/cities/daily/${LISBON_FORECAST_ID}.json`).catch(() => null),
      ]);
      return { disruptions: parseWarnings(warnings), rainProbability: forecast ? parseRainProbability(forecast, lisbonNow().date) : undefined };
    },
  },
];

/** Same alert published by two sources (GO and Carris Metropolitana) → keep one. */
function dedupe(list: Disruption[]): Disruption[] {
  const seen = new Set<string>();
  return list.filter((d) => {
    const k = `${d.effect}|${[...d.lines].sort().join(',')}|${d.header.pt ?? d.header.en ?? ''}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

let cache: { at: number; snap: FeedSnapshot } | null = null;

export async function getSnapshot(force = false): Promise<FeedSnapshot> {
  if (!force && cache && Date.now() - cache.at < CACHE_MS) return cache.snap;
  const settled = await Promise.allSettled(SOURCES.map((s) => s.run()));
  const health: FeedHealth[] = [];
  const disruptions: Disruption[] = [];
  let rainProbability: number | undefined;
  settled.forEach((r, i) => {
    const s = SOURCES[i];
    const base = { source: s.id, label: s.label, fetchedAt: Date.now() };
    if (r.status === 'rejected') {
      const msg = r.reason instanceof Error ? (r.reason.name === 'AbortError' ? 'Timed out' : r.reason.message) : String(r.reason);
      health.push({ ...base, ok: false, count: 0, error: msg });
    } else if (r.value === 'skipped') {
      health.push({ ...base, ok: false, count: 0, skipped: true, error: 'Not configured (API key missing)' });
    } else {
      disruptions.push(...r.value.disruptions);
      if (r.value.rainProbability !== undefined) rainProbability = r.value.rainProbability;
      health.push({ ...base, ok: true, count: r.value.disruptions.length });
    }
  });
  const snap: FeedSnapshot = { disruptions: dedupe(disruptions), health, rainProbability, generatedAt: Date.now() };
  cache = { at: Date.now(), snap };
  return snap;
}

/** Carris Metropolitana arrival estimates for one stop (FR-33). */
export async function getArrivals(stopId: string): Promise<unknown> {
  if (!/^[0-9A-Za-z_-]{1,20}$/.test(stopId)) throw new Error('Invalid stop id');
  return getJson(`${BASES.cm()}/arrivals/by_stop/${encodeURIComponent(stopId)}`);
}
