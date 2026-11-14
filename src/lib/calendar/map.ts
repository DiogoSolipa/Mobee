import { lisbonNow } from '../domain/time';
import type { Stop } from '../domain/types';

/** Pure mapping from Google Calendar events to Mobee stops (V2-23). Geocoding is injected so this is testable. */

export interface GCal { id: string; selected?: boolean; hidden?: boolean; accessRole?: string; primary?: boolean }
export interface GEvent {
  id: string;
  status?: string;
  summary?: string;
  location?: string;
  transparency?: 'opaque' | 'transparent';
  eventType?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  hangoutLink?: string;
  conferenceData?: unknown;
  attendees?: { self?: boolean; responseStatus?: string }[];
}

const LINK = /^(https?:\/\/|www\.)|zoom\.us|teams\.microsoft|meet\.google/i;

export type Geocoder = (text: string) => Promise<{ lat: number; lon: number; name: string } | null>;

/** Maps one Google event to a stop, or null when it should not appear (all-day, declined, cancelled, free time). */
export async function eventToStop(e: GEvent, geocode: Geocoder): Promise<Stop | null> {
  if (e.status === 'cancelled' || !e.start?.dateTime || !e.end?.dateTime) return null; // all-day events are context only (V2-23)
  if (e.transparency === 'transparent' || e.eventType === 'workingLocation' || e.eventType === 'outOfOffice' || e.eventType === 'focusTime') return null;
  if (e.attendees?.some((a) => a.self && a.responseStatus === 'declined')) return null;
  const start = lisbonNow(Date.parse(e.start.dateTime));
  const end = Date.parse(e.end.dateTime);
  const duration = Math.max(5, Math.round((end - Date.parse(e.start.dateTime)) / 60_000));
  const loc = e.location?.trim();
  const physical = loc && !LINK.test(loc) ? loc : undefined;
  const geo = physical ? await geocode(physical) : null;
  return {
    id: `cal_${e.id}`,
    title: e.summary?.trim() || '(sem título)',
    placeName: physical ? geo?.name ?? physical : e.hangoutLink || e.conferenceData ? 'Online' : '',
    lat: geo?.lat,
    lon: geo?.lon,
    date: start.date,
    start: start.minutes,
    duration: Math.min(duration, 24 * 60 - start.minutes),
    context: 'work',
    fixed: true,
    source: 'calendar',
    kind: 'commitment',
    calendarEventId: e.id,
    // No address (or a video link): blocks time, no trip (V2-23). An address we couldn't find still needs a trip.
    noTravel: physical ? undefined : true,
  };
}

