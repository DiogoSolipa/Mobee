import type { ISODate, Leg, Minutes, Stop } from '../domain/types';
import type { LegContext, TripPlanner } from './travel';

export interface TimelineEntry {
  stop: Stop;
  /** Leg arriving at this stop from the previous one (none for the first stop). */
  leg?: Leg;
  /** Expected arrival given the leg (FR-07). */
  arrival: Minutes;
  status: 'on-time' | 'moved' | 'at-risk';
  lateBy: number;
}

export function stopsOn(stops: Stop[], date: ISODate): Stop[] {
  return stops.filter((s) => s.date === date).sort((a, b) => a.start - b.start || a.title.localeCompare(b.title));
}

export function endOf(s: Stop): Minutes {
  return s.start + s.duration;
}

/** Build the journey timeline for one day: legs between consecutive stops and each stop's status. */
export function buildTimeline(dayStops: Stop[], planner: TripPlanner, ctx: LegContext, now?: Minutes): TimelineEntry[] {
  const out: TimelineEntry[] = [];
  dayStops.forEach((stop, i) => {
    const prev = dayStops[i - 1];
    const leg = prev ? planner.leg(prev, stop, ctx) : undefined;
    // Only routed legs can make a stop late: a pending/unavailable route never invents a delay.
    const arrival = prev && leg && leg.status === 'routed' ? endOf(prev) + leg.minutes : stop.start;
    const lateBy = Math.max(0, arrival - stop.start);
    const happened = now !== undefined && endOf(stop) <= now;
    const moved = !!stop.previous && (stop.previous.start !== stop.start || stop.previous.date !== stop.date);
    const status: TimelineEntry['status'] = !happened && lateBy > 0 ? 'at-risk' : moved && !happened ? 'moved' : 'on-time';
    out.push({ stop, leg, arrival, status, lateBy });
  });
  return out;
}
