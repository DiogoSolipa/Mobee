import { METRO_LINE_LABEL } from '../domain/places';
import type { LineRef, Mode, TripOption } from '../domain/types';
import { linesFromText } from '../feeds/lines';

/**
 * MOTIS 2 itinerary → Mobee TripOption.
 * Shape confirmed against Transitous (api.transitous.org/api/v5/plan) for Lisbon on 2026-11-14:
 * { direct: Itinerary[], itineraries: Itinerary[] }, Itinerary = { duration (s), startTime, endTime, transfers, legs[] },
 * Leg = { mode, from{name,stopId}, to{name,stopId}, duration, startTime, endTime, realTime, headsign, routeShortName?, displayName?, agencyName?, steps[{elevationUp}] }.
 * Parsing is tolerant: unknown fields are ignored, missing names fall back to the stop names.
 */

export interface MotisPlace { name?: string; stopId?: string; lat?: number; lon?: number }
export interface MotisStep { elevationUp?: number }
export interface MotisLeg {
  mode?: string;
  from?: MotisPlace;
  to?: MotisPlace;
  duration?: number;
  startTime?: string;
  endTime?: string;
  realTime?: boolean;
  headsign?: string;
  routeShortName?: string;
  routeLongName?: string;
  displayName?: string;
  agencyName?: string;
  agencyId?: string;
  routeColor?: string;
  steps?: MotisStep[];
}
export interface MotisItinerary { duration?: number; startTime?: string; endTime?: string; transfers?: number; legs?: MotisLeg[] }
export interface MotisPlan { direct?: MotisItinerary[]; itineraries?: MotisItinerary[] }

const TRANSIT_MODE: Record<string, Mode> = {
  SUBWAY: 'metro', METRO: 'train', SUBURBAN: 'train', RAIL: 'train', REGIONAL_RAIL: 'train', REGIONAL_FAST_RAIL: 'train',
  HIGHSPEED_RAIL: 'train', LONG_DISTANCE: 'train', NIGHT_RAIL: 'train', BUS: 'bus', COACH: 'bus', TRAM: 'tram',
  CABLE_CAR: 'tram', FUNICULAR: 'tram', AERIAL_LIFT: 'tram', AREAL_LIFT: 'tram', FERRY: 'ferry',
};

const LABEL: Record<Mode, { en: string; pt: string }> = {
  walk: { en: 'Walk', pt: 'A pé' }, bus: { en: 'Bus', pt: 'Autocarro' }, tram: { en: 'Tram', pt: 'Elétrico' },
  metro: { en: 'Metro', pt: 'Metro' }, train: { en: 'Train', pt: 'Comboio' }, ferry: { en: 'Ferry', pt: 'Barco' },
  bike: { en: 'Bike', pt: 'Bicicleta' }, car: { en: 'Car', pt: 'Carro' },
};

const ms = (iso?: string) => (iso ? Date.parse(iso) : NaN);
const isWalk = (l: MotisLeg) => !l.mode || l.mode === 'WALK' || l.mode === 'FOOT' || l.mode === 'WHEELCHAIR';

/** Line key and label for one transit leg. Keys match the alert parser ('ml:green', 'cm:1628', 'carris:728', 'cp:sintra'). */
export function lineOf(l: MotisLeg): LineRef {
  const mode = TRANSIT_MODE[l.mode ?? ''] ?? 'bus';
  const name = (l.routeShortName || l.displayName || l.routeLongName || '').trim();
  const agency = `${l.agencyName ?? ''} ${l.agencyId ?? ''} ${l.from?.stopId ?? ''}`;
  if (mode === 'metro' && /metro/i.test(agency)) {
    const key = linesFromText(`${name} ${l.routeLongName ?? ''} ${l.displayName ?? ''}`, true)[0];
    const colour = key?.slice(3) as keyof typeof METRO_LINE_LABEL | undefined;
    if (key && colour && METRO_LINE_LABEL[colour]) return { key, label: { ...METRO_LINE_LABEL[colour] } };
  }
  const cp = linesFromText(`${name} ${l.routeLongName ?? ''} ${l.agencyName ?? ''}`);
  if (mode === 'train' && cp.length) return { key: cp[0], label: { en: `Train ${name}`.trim(), pt: `Comboio ${name}`.trim() } };
  const prefix = /carris[\s_-]*metropolitana/i.test(agency) ? 'cm' : /carris/i.test(agency) ? 'carris' : /cp|comboios/i.test(agency) ? 'cp' : mode;
  return { key: `${prefix}:${name || l.headsign || '?'}`, label: { en: `${LABEL[mode].en} ${name}`.trim(), pt: `${LABEL[mode].pt} ${name}`.trim() } };
}

export function toOption(it: MotisItinerary): TripOption | null {
  const legs = it.legs ?? [];
  if (!legs.length) return null;
  const depart = ms(it.startTime), arrive = ms(it.endTime);
  const minutes = Math.max(1, Math.round((it.duration ?? (arrive - depart) / 1000) / 60));
  const transit = legs.filter((l) => !isWalk(l));
  const walkMinutes = Math.round(legs.filter(isWalk).reduce((a, l) => a + (l.duration ?? 0), 0) / 60);
  const climbM = Math.round(legs.filter(isWalk).flatMap((l) => l.steps ?? []).reduce((a, s) => a + (s.elevationUp ?? 0), 0));
  if (!transit.length) {
    return { mode: 'walk', minutes, walkMinutes: minutes, transfers: 0, climbM, detail: { ...LABEL.walk }, lines: [], realtime: false };
  }
  const lines = transit.map(lineOf);
  const mode = TRANSIT_MODE[transit[0].mode ?? ''] ?? 'bus';
  const first = transit[0], last = transit[transit.length - 1];
  return {
    mode,
    depart: Number.isFinite(depart) ? depart : undefined,
    arrive: Number.isFinite(arrive) ? arrive : undefined,
    minutes,
    walkMinutes,
    transfers: it.transfers ?? Math.max(0, transit.length - 1),
    climbM,
    detail: { en: lines.map((x) => x.label.en).join(' → '), pt: lines.map((x) => x.label.pt).join(' → ') },
    lines,
    boardAt: Number.isFinite(ms(first.startTime)) ? ms(first.startTime) : undefined,
    via: [first.from?.name, last.to?.name].filter(Boolean).join(' → ') || undefined,
    realtime: transit.some((l) => l.realTime),
  };
}

/** All options from a /plan response: the walk-only direct route (if any) plus transit itineraries. */
export function optionsFromPlan(plan: MotisPlan): TripOption[] {
  const out: TripOption[] = [];
  for (const it of [...(plan.direct ?? []), ...(plan.itineraries ?? [])]) {
    const o = toOption(it);
    if (o) out.push(o);
  }
  return out;
}
