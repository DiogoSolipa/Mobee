import { describe, expect, it } from 'vitest';
import type { Stop } from '../../domain/types';
import { eventToStop, type GEvent } from '../map';
import { mergeCalendar, sameCalendar } from '../merge';

const geo = async (t: string) => (t.toLowerCase().includes('saldanha') ? { lat: 38.7351, lon: -9.1453, name: 'Saldanha · Lisboa' } : null);
const ev = (over: Partial<GEvent> = {}): GEvent => ({
  id: 'e1', summary: 'Reunião', start: { dateTime: '2026-11-17T14:00:00Z' }, end: { dateTime: '2026-11-17T15:30:00Z' }, ...over,
});

describe('eventToStop (V2-23)', () => {
  it('timed event with an address → fixed commitment with coordinates, in Lisbon time', async () => {
    const s = (await eventToStop(ev({ location: 'Av. da República, Saldanha' }), geo))!;
    // November: Lisbon = UTC.
    expect(s).toMatchObject({ id: 'cal_e1', date: '2026-11-17', start: 14 * 60, duration: 90, fixed: true, source: 'calendar', kind: 'commitment', calendarEventId: 'e1', lat: 38.7351 });
    expect(s.noTravel).toBeUndefined();
  });

  it('summer time: 09:00Z is 10:00 in Lisbon', async () => {
    const s = (await eventToStop(ev({ start: { dateTime: '2026-07-01T09:00:00Z' }, end: { dateTime: '2026-07-01T10:00:00Z' } }), geo))!;
    expect(s.start).toBe(10 * 60);
  });

  it('video link or no location → blocks time, no trip', async () => {
    expect((await eventToStop(ev({ location: 'https://meet.google.com/abc' }), geo))!.noTravel).toBe(true);
    const online = (await eventToStop(ev({ hangoutLink: 'https://meet.google.com/x' }), geo))!;
    expect(online).toMatchObject({ noTravel: true, placeName: 'Online' });
    expect((await eventToStop(ev(), geo))!.noTravel).toBe(true);
  });

  it('an address we could not geocode still needs a trip (shown, not silently dropped)', async () => {
    const s = (await eventToStop(ev({ location: 'Rua Desconhecida 1' }), geo))!;
    expect(s.noTravel).toBeUndefined();
    expect(s.lat).toBeUndefined();
    expect(s.placeName).toBe('Rua Desconhecida 1');
  });

  it('skips all-day, cancelled, declined and "free" events', async () => {
    expect(await eventToStop(ev({ start: { date: '2026-11-17' }, end: { date: '2026-11-18' } }), geo)).toBeNull();
    expect(await eventToStop(ev({ status: 'cancelled' }), geo)).toBeNull();
    expect(await eventToStop(ev({ attendees: [{ self: true, responseStatus: 'declined' }] }), geo)).toBeNull();
    expect(await eventToStop(ev({ transparency: 'transparent' }), geo)).toBeNull();
    expect(await eventToStop(ev({ eventType: 'workingLocation' }), geo)).toBeNull();
  });
});

describe('mergeCalendar (V2-22)', () => {
  const mine: Stop = { id: 'm1', title: 'Farmácia', placeName: '', date: '2026-11-17', start: 600, duration: 15, context: 'errand', fixed: false, source: 'voice' };
  const cal = (id: string, start: number, extra: Partial<Stop> = {}): Stop => ({ id, title: id, placeName: '', date: '2026-11-17', start, duration: 60, context: 'work', fixed: true, source: 'calendar', ...extra });

  it('replaces calendar stops in range, keeps the person’s own items', () => {
    const out = mergeCalendar([mine, cal('cal_a', 540), cal('cal_b', 700)], '2026-11-17', '2026-11-18', [cal('cal_a', 560)]);
    expect(out.map((s) => s.id).sort()).toEqual(['cal_a', 'm1']);
    expect(out.find((s) => s.id === 'cal_a')!.start).toBe(560);
  });

  it('keeps "done" on an event that is still there', () => {
    const out = mergeCalendar([cal('cal_a', 540, { done: { at: 1, how: 'calendar' } })], '2026-11-17', '2026-11-18', [cal('cal_a', 540)]);
    expect(out[0].done).toEqual({ at: 1, how: 'calendar' });
  });

  it('leaves calendar stops from other days alone', () => {
    const past = cal('cal_old', 540, { date: '2026-11-10' });
    expect(mergeCalendar([past], '2026-11-17', '2026-11-18', []).map((s) => s.id)).toEqual(['cal_old']);
  });

  it('sameCalendar ignores order and non-calendar items', () => {
    expect(sameCalendar([mine, cal('cal_a', 1), cal('cal_b', 2)], [cal('cal_b', 2), cal('cal_a', 1)])).toBe(true);
    expect(sameCalendar([cal('cal_a', 1)], [cal('cal_a', 2)])).toBe(false);
  });
});
