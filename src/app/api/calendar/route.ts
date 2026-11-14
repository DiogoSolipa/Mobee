import { NextResponse } from 'next/server';
import { dbConfigured } from '@/lib/db';
import { CalendarNotConnected, calendarStops } from '@/lib/server/calendar';
import { getCaller } from '@/lib/server/identity';

/** Today's and tomorrow's Google Calendar events as fixed stops (V2-22). GET → { connected, from, to, stops }. */
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!dbConfigured) return NextResponse.json({ error: 'database not configured' }, { status: 503 });
  const caller = await getCaller(req.headers);
  if (!caller) return NextResponse.json({ error: 'sign in first' }, { status: 401 });
  try {
    return NextResponse.json({ connected: true, ...(await calendarStops(caller.userId)) }, { headers: { 'cache-control': 'no-store' } });
  } catch (e) {
    if (e instanceof CalendarNotConnected) return NextResponse.json({ connected: false, reason: e.message });
    console.error('[calendar]', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'calendar unavailable' }, { status: 502 });
  }
}
