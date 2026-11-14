import { METRO_LINE_LABEL, PLACE_BY_ID } from '../domain/places';
import type { Disruption, Leg, MetroLine, Place, Priority, Stop, TravelRules } from '../domain/types';

/**
 * Trip planner seam. The MVP ships `EstimatePlanner` (distance-based, no network).
 * Swap in an OpenTripPlanner client (TML unified GTFS + OSM + elevation) behind this interface:
 * the replan engine only ever calls `leg()`.
 */
export interface LegContext {
  rules: TravelRules;
  priority: Priority;
  raining: boolean;
  /** Only disruptions relevant to the time window are passed in. */
  disruptions: Disruption[];
}
export interface TripPlanner {
  leg(from: Stop, to: Stop, ctx: LegContext): Leg;
}

const ROUTE_FACTOR = 1.3; // streets are not straight lines
const WALK_KMH = 4.8;
const METRO_KMH = 27;
const BUS_KMH = 14;

function km(a: Place, b: Place): number {
  const R = 6371, toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat! - a.lat!), dLon = toRad(b.lon! - a.lon!);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat!)) * Math.cos(toRad(b.lat!)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h)) * ROUTE_FACTOR;
}

export function placeOf(s: Stop): Place | undefined {
  return s.placeId ? PLACE_BY_ID[s.placeId] : undefined;
}

type Candidate = Omit<Leg, 'fromStopId' | 'toStopId' | 'estimated'>;

function metroCandidates(a: Place, b: Place, dist: number): Candidate[] {
  const out: Candidate[] = [];
  const A = a.metro ?? [], B = b.metro ?? [];
  if (!A.length || !B.length) return out;
  const ride = Math.max(2, Math.ceil((dist / METRO_KMH) * 60));
  const shared = A.find((l) => B.includes(l));
  if (shared) {
    out.push({
      mode: 'metro', minutes: 4 + 3 + ride + 2, transfers: 0, walkMinutes: 6,
      detail: { en: METRO_LINE_LABEL[shared].en, pt: METRO_LINE_LABEL[shared].pt },
      lines: [{ key: `ml:${shared}`, label: { ...METRO_LINE_LABEL[shared] } }],
    });
  } else {
    const l1 = A[0] as MetroLine, l2 = B[0] as MetroLine;
    out.push({
      mode: 'metro', minutes: 4 + 3 + ride + 5 + 2, transfers: 1, walkMinutes: 7,
      detail: { en: `${METRO_LINE_LABEL[l1].en.replace(' line', '')} → ${METRO_LINE_LABEL[l2].en}`, pt: `${METRO_LINE_LABEL[l1].pt} → ${METRO_LINE_LABEL[l2].pt.replace('Linha ', '')}` },
      lines: [l1, l2].map((l) => ({ key: `ml:${l}`, label: { ...METRO_LINE_LABEL[l] } })),
    });
  }
  return out;
}

function busCandidate(dist: number, note?: { en: string; pt: string }): Candidate {
  return {
    mode: 'bus', minutes: 3 + 5 + Math.max(3, Math.ceil((dist / BUS_KMH) * 60)), transfers: 0, walkMinutes: 4,
    detail: note ?? { en: 'Bus', pt: 'Autocarro' }, lines: [],
  };
}

/** Distance-based estimator: good enough to prove the loop; every leg is flagged `estimated`. */
export class EstimatePlanner implements TripPlanner {
  leg(from: Stop, to: Stop, ctx: LegContext): Leg {
    const base = { fromStopId: from.id, toStopId: to.id, estimated: true };
    const a = placeOf(from), b = placeOf(to);
    if (from.placeId && from.placeId === to.placeId) {
      return { ...base, mode: 'walk', minutes: 0, detail: { en: 'Same place', pt: 'Mesmo local' }, lines: [], transfers: 0, walkMinutes: 0 };
    }
    if (!a?.lat || !b?.lat) {
      return { ...base, mode: 'bus', minutes: 15, detail: { en: 'Estimated', pt: 'Estimativa' }, lines: [], transfers: 0, walkMinutes: 4 };
    }
    const dist = km(a, b);
    const walkMin = Math.max(1, Math.ceil((dist / WALK_KMH) * 60));
    let walkLimit = ctx.rules.walkUnder10 ? 10 : 15;
    if (ctx.rules.avoidHills && (a.hilly || b.hilly)) walkLimit = Math.min(walkLimit, 6);
    if (ctx.raining && ctx.rules.busWhenRain) walkLimit = Math.min(walkLimit, 5);

    const candidates: Candidate[] = [];
    if (walkMin <= walkLimit) {
      candidates.push({ mode: 'walk', minutes: walkMin, detail: { en: 'Walk', pt: 'A pé' }, lines: [], transfers: 0, walkMinutes: walkMin });
    }
    // Disruptions: a suspended line drops its candidate; a delayed one adds its delay.
    for (const c of metroCandidates(a, b, dist)) {
      const hit = ctx.disruptions.find((d) => d.lines.some((k) => c.lines.some((l) => l.key === k)));
      if (!hit) { candidates.push(c); continue; }
      if (hit.effect === 'no-service') continue;
      const delay = hit.delayMin ?? (hit.effect === 'reduced' ? 8 : 10);
      candidates.push({ ...c, minutes: c.minutes + delay, disruption: { id: hit.id, delayMin: delay } });
    }
    const suspended = ctx.disruptions.find((d) => d.effect === 'no-service' && d.lines.some((k) => k.startsWith('ml:') && (a.metro ?? []).concat(b.metro ?? []).some((l) => `ml:${l}` === k)));
    const bus = busCandidate(dist);
    candidates.push(suspended ? { ...bus, disruption: { id: suspended.id, replaced: true } } : bus);
    if (!candidates.some((c) => c.mode === 'walk') && walkMin <= 25 && !(ctx.raining && ctx.rules.busWhenRain)) {
      candidates.push({ mode: 'walk', minutes: walkMin, detail: { en: 'Walk', pt: 'A pé' }, lines: [], transfers: 0, walkMinutes: walkMin });
    }

    const score = (c: Candidate) => {
      let s = c.minutes;
      if (ctx.priority === 'calm') s += c.transfers * 6 + c.walkMinutes * 0.3;
      if (c.mode === 'walk' && c.minutes > walkLimit) s += 30; // over the person's walking limit
      return s;
    };
    const best = candidates.sort((x, y) => score(x) - score(y))[0];
    return { ...base, ...best };
  }
}
