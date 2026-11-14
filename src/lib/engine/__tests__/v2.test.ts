import { describe, expect, it } from 'vitest';
import { HERE_ID, type Stop } from '../../domain/types';
import { DEFAULT_SETTINGS, ritaDay } from '../../seed';
import { active, hereStop, replan } from '../replan';
import { FixturePlanner } from './fixturePlanner';

/** v2 engine behaviour: GPS origin (V2-05), optional items (V2-04), done items (V2-45). */

const DATE = '2026-11-17';
const planner = new FixturePlanner();
const settings = { priority: 'fewest' as const, rules: DEFAULT_SETTINGS.rules };
const late = (minutes: number) => [{ kind: 'late' as const, minutes, at: 0 }];
// Campo de Ourique: far from Rita's Alvalade/Saldanha day.
const FAR = { lat: 38.7185, lon: -9.1665 };

describe('origin = where I am now (V2-05)', () => {
  const stops = ritaDay(DATE).filter((s) => s.id !== 's_meeting');

  it('builds a zero-length virtual stop at the current position', () => {
    const h = hereStop(FAR, DATE, 600);
    expect(h).toMatchObject({ id: HERE_ID, date: DATE, start: 600, duration: 0, lat: FAR.lat, lon: FAR.lon });
  });

  it('leaving from far away pushes the next stop; leaving from nowhere does not', () => {
    const now = 10 * 60 + 25;
    const fromHere = replan({ stops, date: DATE, now, triggers: late(5), disruptions: [], raining: false, settings, planner, here: FAR, clock: () => 1 });
    const fromNowhere = replan({ stops, date: DATE, now, triggers: late(5), disruptions: [], raining: false, settings, planner, clock: () => 1 });
    // From nowhere you "arrive" at 10:30 exactly as planned: nothing to propose.
    expect(fromNowhere).toBeNull();
    // From Campo de Ourique the trip to Av. de Roma takes time: the pharmacy moves later.
    expect(fromHere!.result.find((s) => s.id === 's_pharmacy')!.start).toBeGreaterThan(10 * 60 + 30);
  });

  it('never stores the virtual stop in the result', () => {
    const p = replan({ stops, date: DATE, now: 10 * 60 + 25, triggers: late(5), disruptions: [], raining: false, settings, planner, here: FAR, clock: () => 1 })!;
    expect(p.result.some((s) => s.id === HERE_ID)).toBe(false);
    expect(p.protectedStopIds).not.toContain(HERE_ID);
  });

  it('a stop in progress still wins over GPS (you leave when it ends)', () => {
    const all = ritaDay(DATE);
    const now = 9 * 60 + 50; // during the 09:30–10:10 meeting
    const withHere = replan({ stops: all, date: DATE, now, triggers: late(30), disruptions: [], raining: false, settings, planner, here: FAR, clock: () => 1 });
    const without = replan({ stops: all, date: DATE, now, triggers: late(30), disruptions: [], raining: false, settings, planner, clock: () => 1 });
    expect(withHere?.result).toEqual(without?.result);
  });
});

describe('optional items are dropped first (V2-04)', () => {
  it('defers the optional item instead of a regular one when the day no longer fits', () => {
    const stops: Stop[] = ritaDay(DATE).map((s) => (s.id === 's_pharmacy' ? { ...s, optional: true } : s));
    const p = replan({ stops, date: DATE, now: 10 * 60 + 12, triggers: late(45), disruptions: [], raining: false, settings, planner, clock: () => 1 })!;
    const deferred = p.changes.filter((c) => c.kind === 'day').map((c) => c.stopId);
    expect(deferred).toContain('s_pharmacy');
    expect(p.atRisk).toEqual([]);
  });
});

describe('done items never take part (V2-45)', () => {
  it('filters done items out', () => {
    const stops = ritaDay(DATE).map((s) => (s.id === 's_pharmacy' ? { ...s, done: { at: 1, how: 'arrived' as const } } : s));
    expect(active(stops).some((s) => s.id === 's_pharmacy')).toBe(false);
  });

  it('a done item is never moved by a replan', () => {
    const stops = ritaDay(DATE).map((s) => (s.id === 's_pharmacy' ? { ...s, done: { at: 1, how: 'arrived' as const } } : s));
    const p = replan({ stops, date: DATE, now: 10 * 60 + 12, triggers: late(75), disruptions: [], raining: false, settings, planner, clock: () => 1 })!;
    expect(p.changes.length).toBeGreaterThan(0);
    expect(p.changes.some((c) => 'stopId' in c && c.stopId === 's_pharmacy')).toBe(false);
    expect(p.result.find((s) => s.id === 's_pharmacy')).toEqual(stops.find((s) => s.id === 's_pharmacy'));
  });
});
