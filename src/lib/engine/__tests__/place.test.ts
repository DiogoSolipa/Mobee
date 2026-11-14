import { describe, expect, it } from 'vitest';
import type { Stop } from '../../domain/types';
import { DEFAULT_SETTINGS, ritaDay } from '../../seed';
import { draftsToStops, draftToStop, freeSlot, type Draft } from '../place';
import { replan } from '../replan';
import { buildTimeline, stopsOn } from '../schedule';
import { FixturePlanner } from './fixturePlanner';

const DATE = '2026-11-17';
const now = { date: DATE, minutes: 10 * 60 + 12 };
const base: Draft = { kind: 'place_task', title: 'CTT', placeText: 'CTT Saldanha', category: null, date: DATE, time: null, window: null, duration: null, optional: false, lat: 38.7351, lon: -9.1453 };

describe('freeSlot', () => {
  const day = ritaDay(DATE); // 09:30 meeting … 11:15–12:15 groceries, 12:30 pickup, 13:15 lunch, 18:30 gym, 20:15 dinner

  it('rounds up to 5 minutes and starts after now', () => {
    expect(freeSlot([], DATE, 10 * 60 + 12, 20)).toBe(10 * 60 + 15);
  });

  it('skips items in the way and keeps a 15-min gap around them', () => {
    // 10:30 pharmacy (20 min) blocks 10:15–11:05; 11:15 groceries blocks the rest of the morning.
    const t = freeSlot(day, DATE, 10 * 60 + 15, 30);
    expect(t).toBeGreaterThanOrEqual(14 * 60 + 15); // after lunch (13:15–14:00) + 15
  });
});

describe('draftToStop', () => {
  it('a commitment with a time is fixed and keeps its time', () => {
    const s = draftToStop({ ...base, kind: 'commitment', title: 'Dentista', time: 15 * 60 }, [], now, 'x', 'text');
    expect(s).toMatchObject({ fixed: true, start: 15 * 60, duration: 60, kind: 'commitment', source: 'text' });
    expect(s.flex).toBeUndefined();
  });

  it('a task without time is flexible for today and goes to the first free slot', () => {
    const s = draftToStop(base, [], now, 'x', 'voice');
    expect(s).toMatchObject({ fixed: false, flex: { kind: 'today' }, start: 10 * 60 + 30, duration: 20 });
  });

  it('respects a window ("depois das 17h")', () => {
    const s = draftToStop({ ...base, window: { from: 17 * 60, to: null } }, [], now, 'x', 'voice');
    expect(s.start).toBe(17 * 60);
    expect(s.flex).toEqual({ kind: 'window', from: 17 * 60, to: undefined });
  });

  it('tomorrow without time starts from the morning, not from now', () => {
    const s = draftToStop({ ...base, date: '2026-11-18' }, [], now, 'x', 'voice');
    expect(s.start).toBe(9 * 60);
  });

  it('a task with no place takes time but no trip', () => {
    const s = draftToStop({ ...base, title: 'Ligar ao banco', placeText: null, lat: undefined, lon: undefined }, [], now, 'x', 'voice');
    expect(s.noTravel).toBe(true);
  });

  it('keeps "se der" as optional', () => {
    expect(draftToStop({ ...base, optional: true }, [], now, 'x', 'voice').optional).toBe(true);
  });

  it('several drafts never overlap each other', () => {
    const out = draftsToStops([base, { ...base, title: 'B' }, { ...base, title: 'C' }], [], now, ['a', 'b', 'c'], 'voice');
    const day = stopsOn(out, DATE);
    for (let i = 1; i < day.length; i++) expect(day[i].start).toBeGreaterThanOrEqual(day[i - 1].start + day[i - 1].duration + 15);
  });
});

describe('no-travel items (V2-23)', () => {
  const planner = new FixturePlanner();
  const ctx = { rules: DEFAULT_SETTINGS.rules, priority: 'fewest' as const, raining: false, disruptions: [] };
  // Home → online call → Saldanha office: the trip to the office starts from home, not from "the call".
  const stops: Stop[] = [
    { id: 'home', title: 'Home', placeId: 'home-alvalade', placeName: 'Home', date: DATE, start: 9 * 60, duration: 30, context: 'home', fixed: false },
    { id: 'call', title: 'Call', placeName: 'Google Meet', date: DATE, start: 9 * 60 + 30, duration: 30, context: 'work', fixed: true, noTravel: true },
    { id: 'office', title: 'Office', placeId: 'saldanha', placeName: 'Office', date: DATE, start: 11 * 60, duration: 60, context: 'work', fixed: true },
  ];

  it('the timeline draws no leg into an online item, and the next leg leaves from the last real place', () => {
    const tl = buildTimeline(stops, planner, ctx);
    expect(tl[1].leg).toBeUndefined();
    expect(tl[2].leg?.fromStopId).toBe('home');
  });

  it('a replan never routes to or from an online item', () => {
    const asked: string[] = [];
    const spy = { leg: (a: Stop, b: Stop, c: typeof ctx) => { asked.push(`${a.id}>${b.id}`); return planner.leg(a, b, c); } };
    replan({ stops, date: DATE, now: 9 * 60 + 5, triggers: [{ kind: 'late', minutes: 20, at: 0 }], disruptions: [], raining: false, settings: { priority: 'fewest', rules: DEFAULT_SETTINGS.rules }, planner: spy, clock: () => 1 });
    expect(asked.length).toBeGreaterThan(0);
    expect(asked.every((k) => !k.includes('call'))).toBe(true);
    expect(asked).toContain('home>office');
  });
});
