import type { ISODate, Stop } from '../domain/types';

/**
 * Merges a fresh calendar read into the plan (V2-22). Calendar stops in the synced range are replaced
 * by what Google says now (moved, renamed, deleted events follow), but what Mobee learned about them
 * is kept: `done`. Everything the person added in Mobee is untouched.
 */
export function mergeCalendar(stops: Stop[], from: ISODate, to: ISODate, incoming: Stop[]): Stop[] {
  const inRange = (s: Stop) => s.date >= from && s.date <= to;
  const old = new Map(stops.filter((s) => s.source === 'calendar').map((s) => [s.id, s]));
  const kept = stops.filter((s) => s.source !== 'calendar' || !inRange(s));
  const fresh = incoming.map((s) => {
    const before = old.get(s.id);
    return before?.done ? { ...s, done: before.done } : s;
  });
  return [...kept.filter((s) => !fresh.some((f) => f.id === s.id)), ...fresh];
}

/** True when a merge would change nothing (avoids needless saves and re-renders). */
export function sameCalendar(a: Stop[], b: Stop[]): boolean {
  const key = (xs: Stop[]) => JSON.stringify(xs.filter((s) => s.source === 'calendar').map((s) => [s.id, s.date, s.start, s.duration, s.title, s.placeName, s.lat, s.lon, s.noTravel, s.done?.at]).sort());
  return key(a) === key(b);
}
