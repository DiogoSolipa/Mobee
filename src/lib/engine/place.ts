import type { ISODate, Minutes, Stop, StopKind, StopSource } from '../domain/types';
import { active } from './replan';
import { endOf, stopsOn } from './schedule';

/**
 * Turning what the person said into stops on the day (V2-31, V2-32).
 * The interpreter only says *what* and *when-ish*; this module decides the minute, deterministically.
 */

/** One interpreted item, after the server resolved its place. Times are minutes since Lisbon midnight. */
export interface Draft {
  kind: StopKind;
  title: string;
  /** Place as said ("CTT do Saldanha"), when there is one. */
  placeText: string | null;
  /** For category tasks: what to look for, e.g. 'pharmacy'. */
  category: string | null;
  date: ISODate;
  /** Exact time, when said ("às 14h"). */
  time: Minutes | null;
  /** A window, when said ("antes das 18h", "de manhã"). */
  window: { from: Minutes | null; to: Minutes | null } | null;
  duration: Minutes | null;
  optional: boolean;
  /** Resolved by the server's geocoder; missing when the place was not found or not given. */
  lat?: number;
  lon?: number;
  placeName?: string;
}

const GAP = 15; // travel gap between consecutive items when we choose the time ourselves
const DEFAULT_DURATION: Record<StopKind, Minutes> = { commitment: 60, place_task: 20, category_task: 15 };
const DAY_START: Minutes = 9 * 60;

const roundUp5 = (m: Minutes) => Math.ceil(m / 5) * 5;

/** First start at or after `from` on `date` that leaves `GAP` minutes around the existing items. */
export function freeSlot(existing: Stop[], date: ISODate, from: Minutes, duration: Minutes): Minutes {
  let t = roundUp5(from);
  for (const s of stopsOn(active(existing), date)) {
    if (endOf(s) + GAP <= t) continue; // already behind us
    if (t + duration + GAP <= s.start) break; // fits before this one
    t = roundUp5(Math.max(t, endOf(s) + GAP));
  }
  return t;
}

/** Where a draft lands: its own time if it has one, otherwise the first free slot that respects its window. */
export function startFor(d: Draft, existing: Stop[], now: { date: ISODate; minutes: Minutes }): Minutes {
  const duration = d.duration ?? DEFAULT_DURATION[d.kind];
  if (d.time !== null) return d.time;
  const earliest = d.date === now.date ? now.minutes + GAP : DAY_START;
  const from = Math.max(earliest, d.window?.from ?? 0);
  return freeSlot(existing, d.date, from, duration);
}

export function draftToStop(d: Draft, existing: Stop[], now: { date: ISODate; minutes: Minutes }, id: string, source: StopSource): Stop {
  const duration = d.duration ?? DEFAULT_DURATION[d.kind];
  const start = startFor(d, existing, now);
  const timed = d.time !== null;
  return {
    id,
    title: d.title,
    placeName: d.placeName ?? d.placeText ?? '',
    lat: d.lat,
    lon: d.lon,
    date: d.date,
    start,
    duration,
    context: d.kind === 'commitment' ? 'work' : 'errand',
    // Only a commitment with an explicit time is sacred; everything else can move (principle 5).
    fixed: d.kind === 'commitment' && timed,
    flex: timed ? undefined : d.window && (d.window.from !== null || d.window.to !== null)
      ? { kind: 'window', from: d.window.from ?? undefined, to: d.window.to ?? undefined }
      : { kind: 'today' },
    source,
    kind: d.kind,
    category: d.category ?? undefined,
    optional: d.optional || undefined,
    // A task with no place to go to (e.g. "ligar ao banco") takes time but no trip.
    noTravel: d.kind !== 'category_task' && !d.placeText ? true : undefined,
  };
}

/** Places several drafts in order, each one seeing the ones placed before it. */
export function draftsToStops(drafts: Draft[], existing: Stop[], now: { date: ISODate; minutes: Minutes }, ids: string[], source: StopSource): Stop[] {
  const placed: Stop[] = [];
  drafts.forEach((d, i) => placed.push(draftToStop(d, [...existing, ...placed], now, ids[i], source)));
  return placed;
}
