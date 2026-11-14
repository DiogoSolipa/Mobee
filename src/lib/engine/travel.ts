import { PLACE_BY_ID } from '../domain/places';
import { toEpoch } from '../domain/time';
import type { Disruption, Leg, Minutes, Priority, Stop, TravelRules, TripOption } from '../domain/types';

/**
 * Trip planner seam. The replan engine only ever calls `leg()`, synchronously.
 * MatrixPlanner answers from real routes fetched from the trip planner (MOTIS, via /api/legs).
 * When it has no route yet for a pair it says so (status 'pending') and records a miss;
 * the store fetches the misses and runs again. No distances are guessed.
 */
export interface LegContext {
  rules: TravelRules;
  priority: Priority;
  raining: boolean;
  /** Only disruptions relevant to the time window are passed in. */
  disruptions: Disruption[];
}
export interface TripPlanner {
  /** `departAt`: minute of day on `from.date` when the person leaves `from` (defaults to the end of that stop). */
  leg(from: Stop, to: Stop, ctx: LegContext, departAt?: Minutes): Leg;
}

export interface Coord { lat: number; lon: number }
export function coordOf(s: Stop): Coord | undefined {
  if (typeof s.lat === 'number' && typeof s.lon === 'number') return { lat: s.lat, lon: s.lon };
  const p = s.placeId ? PLACE_BY_ID[s.placeId] : undefined;
  return p?.lat !== undefined && p.lon !== undefined ? { lat: p.lat, lon: p.lon } : undefined;
}
const ck = (c: Coord) => `${c.lat.toFixed(5)},${c.lon.toFixed(5)}`;
export function pairKey(a: Coord, b: Coord, wheelchair: boolean): string {
  return `${ck(a)}>${ck(b)}${wheelchair ? '|wc' : ''}`;
}

export interface RouteEntry {
  options: TripOption[];
  /** Departure times (epoch ms) this pair has been planned for. */
  plannedFor: number[];
  error?: string;
  failedAt?: number;
}
export interface LegMiss { key: string; from: Coord; to: Coord; departAt: number; wheelchair: boolean }

const FRESH_MS = 15 * 60_000; // a plan is good for departures within 15 min of when it was asked for

const sameOption = (a: TripOption, b: TripOption) => a.mode === b.mode && a.depart === b.depart && a.minutes === b.minutes && a.detail.en === b.detail.en;

/** Merge newly fetched options into the route matrix (immutably). */
export function mergeRoutes(prev: Map<string, RouteEntry>, key: string, departAt: number, options: TripOption[], error?: string): Map<string, RouteEntry> {
  const next = new Map(prev);
  const old = prev.get(key);
  const merged = [...(old?.options ?? [])];
  for (const o of options) if (!merged.some((m) => sameOption(m, o))) merged.push(o);
  next.set(key, {
    options: merged,
    plannedFor: [...(old?.plannedFor ?? []), departAt],
    error: options.length ? undefined : error,
    failedAt: options.length ? undefined : Date.now(),
  });
  return next;
}

function unrouted(from: Stop, to: Stop, status: 'pending' | 'unavailable', why: { en: string; pt: string }): Leg {
  return { fromStopId: from.id, toStopId: to.id, mode: 'walk', minutes: 0, detail: why, lines: [], transfers: 0, walkMinutes: 0, status };
}

export class MatrixPlanner implements TripPlanner {
  /** Pairs (and departure times) the planner was asked about but has no fresh route for. */
  readonly misses = new Map<string, LegMiss>();
  /** How many legs were answered 'pending' (no route yet). Callers compare before/after to know if a result is incomplete. */
  pendingHits = 0;

  constructor(private readonly routes: Map<string, RouteEntry>, private readonly clock: () => number = Date.now) {}

  leg(from: Stop, to: Stop, ctx: LegContext, departAt?: Minutes): Leg {
    const a = coordOf(from), b = coordOf(to);
    if (!a || !b) return unrouted(from, to, 'unavailable', { en: 'No location for this stop', pt: 'Paragem sem localização' });
    if (ck(a) === ck(b)) {
      return { fromStopId: from.id, toStopId: to.id, mode: 'walk', minutes: 0, detail: { en: 'Same place', pt: 'Mesmo local' }, lines: [], transfers: 0, walkMinutes: 0, status: 'routed' };
    }
    const wheelchair = ctx.rules.stepFree;
    const key = pairKey(a, b, wheelchair);
    const dep = toEpoch(from.date, departAt ?? from.start + from.duration);
    const entry = this.routes.get(key);
    const fresh = entry?.plannedFor.some((t) => Math.abs(t - dep) <= FRESH_MS);
    const recentlyFailed = entry?.failedAt !== undefined && this.clock() - entry.failedAt < 2 * 60_000;
    if (!fresh && !recentlyFailed) this.misses.set(`${key}@${Math.floor(dep / 300_000)}`, { key, from: a, to: b, departAt: dep, wheelchair });
    if (!entry || !entry.options.length) {
      return entry?.error
        ? unrouted(from, to, 'unavailable', { en: 'No route found', pt: 'Sem rota disponível' })
        : (this.pendingHits++, unrouted(from, to, 'pending', { en: 'Finding route…', pt: 'A procurar rota…' }));
    }
    return this.choose(from, to, entry.options, dep, ctx);
  }

  private choose(from: Stop, to: Stop, options: TripOption[], dep: number, ctx: LegContext): Leg {
    let walkLimit = ctx.rules.walkUnder10 ? 10 : 15;
    if (ctx.raining && ctx.rules.busWhenRain) walkLimit = Math.min(walkLimit, 5);

    type Cand = TripOption & { effective: number; penalty: number; disruption?: Leg['disruption'] };
    const cands: Cand[] = [];
    let replacedBy: Disruption | undefined;
    for (const o of options) {
      // Transit: only departures you can still catch; the wait counts. Walking is time-independent.
      let effective = o.minutes;
      if (o.mode !== 'walk' && o.depart !== undefined && o.arrive !== undefined) {
        if (o.depart < dep - 60_000) continue;
        effective = Math.round((o.arrive - dep) / 60_000);
      }
      let penalty = 0;
      let disruption: Leg['disruption'];
      const hit = ctx.disruptions.find((d) => d.lines.some((k) => o.lines.some((l) => l.key === k)));
      if (hit?.effect === 'no-service') { replacedBy = hit; continue; }
      if (hit) {
        const delay = hit.delayMin ?? (hit.effect === 'reduced' ? 8 : 10);
        effective += delay;
        disruption = { id: hit.id, delayMin: delay };
      }
      if (o.mode === 'walk' && o.minutes > walkLimit) penalty += 30 + (o.minutes - walkLimit) * 2;
      if (ctx.rules.avoidHills && o.climbM > 12) penalty += o.climbM; // metres climbed on foot, from OSM elevation
      if (ctx.raining && ctx.rules.busWhenRain) penalty += o.walkMinutes;
      if (ctx.priority === 'calm') penalty += o.transfers * 6 + o.walkMinutes * 0.3;
      cands.push({ ...o, effective, penalty, disruption });
    }
    // Transit plans fetched for an earlier time can be all gone: keep the shortest as a placeholder until the refetch lands.
    if (!cands.some((c) => c.mode !== 'walk')) {
      const later = options.filter((o) => o.mode !== 'walk' && !(replacedBy && o.lines.some((l) => replacedBy!.lines.includes(l.key))));
      const best = later.sort((x, y) => x.minutes - y.minutes)[0];
      if (best) cands.push({ ...best, effective: best.minutes, penalty: 5 + (ctx.priority === 'calm' ? best.transfers * 6 : 0), depart: undefined, arrive: undefined, boardAt: undefined });
    }
    if (!cands.length) return unrouted(from, to, 'unavailable', { en: 'No route found', pt: 'Sem rota disponível' });

    const best = cands.sort((x, y) => x.effective + x.penalty - (y.effective + y.penalty))[0];
    const boardAt = best.boardAt !== undefined ? Math.round((best.boardAt - toEpoch(from.date, 0)) / 60_000) : undefined;
    return {
      fromStopId: from.id,
      toStopId: to.id,
      mode: best.mode,
      minutes: Math.max(0, best.effective),
      detail: best.detail,
      lines: best.lines,
      transfers: best.transfers,
      walkMinutes: best.walkMinutes,
      status: 'routed',
      disruption: best.disruption ?? (replacedBy ? { id: replacedBy.id, replaced: true } : undefined),
      boardAt,
      via: best.via,
      realtime: best.realtime,
      climbM: best.climbM,
    };
  }
}
