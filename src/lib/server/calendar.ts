import 'server-only';
import { and, eq } from 'drizzle-orm';
import { eventToStop, type GCal, type GEvent } from '../calendar/map';
import { addDays, lisbonNow, toEpoch } from '../domain/time';
import type { ISODate, Stop } from '../domain/types';
import { db, schema } from '../db';
import { searchPlaces } from '../planner/motis';
import { auth } from './auth';

/**
 * Google Calendar → commitments (V2-20 – V2-25). Read-only, today and tomorrow, every calendar the
 * person has selected in Google. Works without a browser session (Better Auth refreshes the token
 * from the stored refresh token), so background jobs can call it too.
 */

const API = 'https://www.googleapis.com/calendar/v3';

export class CalendarNotConnected extends Error {}

async function googleToken(userId: string): Promise<string> {
  const [acc] = await db.select({ id: schema.account.id, scope: schema.account.scope })
    .from(schema.account)
    .where(and(eq(schema.account.userId, userId), eq(schema.account.providerId, 'google')))
    .limit(1);
  if (!acc?.scope?.includes('calendar.readonly')) throw new CalendarNotConnected('calendar not granted');
  const t = await auth.api.getAccessToken({ body: { accountId: acc.id, userId } });
  if (!t?.accessToken) throw new CalendarNotConnected('no access token');
  return t.accessToken;
}

async function gget<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { headers: { authorization: `Bearer ${token}` }, cache: 'no-store' });
  if (res.status === 401 || res.status === 403) throw new CalendarNotConnected(`Google said ${res.status}`);
  if (!res.ok) throw new Error(`Google Calendar HTTP ${res.status}`);
  return (await res.json()) as T;
}

/** In-memory geocode cache per server instance: event locations repeat a lot. */
const geoCache = new Map<string, { lat: number; lon: number; name: string } | null>();
async function geocode(text: string) {
  const key = text.trim().toLowerCase();
  if (geoCache.has(key)) return geoCache.get(key)!;
  let hit: { lat: number; lon: number; name: string } | null = null;
  try {
    // Calendar locations are often "Name, Street 12, 1000-001 Lisboa": the first two parts geocode best.
    const [h] = await searchPlaces(text.split(',').slice(0, 2).join(','));
    if (h) hit = { lat: h.lat, lon: h.lon, name: h.area ? `${h.name} · ${h.area}` : h.name };
  } catch { /* leave unresolved */ }
  geoCache.set(key, hit);
  return hit;
}

/** Today's and tomorrow's timed events from every selected calendar, as fixed stops. */
export async function calendarStops(userId: string, now = Date.now()): Promise<{ from: ISODate; to: ISODate; stops: Stop[] }> {
  const token = await googleToken(userId);
  const today = lisbonNow(now).date;
  const tomorrow = addDays(today, 1);
  const timeMin = new Date(toEpoch(today, 0)).toISOString();
  const timeMax = new Date(toEpoch(addDays(today, 2), 0)).toISOString();

  const list = await gget<{ items?: GCal[] }>(token, '/users/me/calendarList?minAccessRole=reader&maxResults=50');
  const cals = (list.items ?? []).filter((c) => c.selected !== false && !c.hidden).slice(0, 15);
  const q = new URLSearchParams({ timeMin, timeMax, singleEvents: 'true', orderBy: 'startTime', maxResults: '100' });
  const perCal = await Promise.all(
    cals.map((c) => gget<{ items?: GEvent[] }>(token, `/calendars/${encodeURIComponent(c.id)}/events?${q}`).then((r) => r.items ?? []).catch(() => [] as GEvent[])),
  );
  // The same meeting can sit in several calendars: keep one per event id.
  const seen = new Set<string>();
  const events = perCal.flat().filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)));
  const stops = (await Promise.all(events.map((e) => eventToStop(e, geocode)))).filter((s): s is Stop => !!s && (s.date === today || s.date === tomorrow));
  return { from: today, to: tomorrow, stops };
}
