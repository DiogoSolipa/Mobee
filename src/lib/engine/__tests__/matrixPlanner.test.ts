import { describe, expect, it } from 'vitest';
import { toEpoch } from '../../domain/time';
import type { Disruption, Stop, TripOption } from '../../domain/types';
import { optionsFromPlan, type MotisPlan } from '../../planner/normalise';
import { DEFAULT_SETTINGS } from '../../seed';
import { MatrixPlanner, mergeRoutes, pairKey, type RouteEntry } from '../travel';

const DATE = '2026-11-17';
const A: Stop = { id: 'a', title: 'Office', placeName: 'Saldanha', lat: 38.7351, lon: -9.1453, date: DATE, start: 10 * 60, duration: 30, context: 'work', fixed: false };
const B: Stop = { id: 'b', title: 'Market', placeName: 'Mercado de Alvalade', lat: 38.7537, lon: -9.1437, date: DATE, start: 11 * 60, duration: 30, context: 'errand', fixed: false };
const KEY = pairKey({ lat: A.lat!, lon: A.lon! }, { lat: B.lat!, lon: B.lon! }, false);
const ctx = (over: Partial<Parameters<MatrixPlanner['leg']>[2]> = {}) => ({ rules: DEFAULT_SETTINGS.rules, priority: 'fewest' as const, raining: false, disruptions: [], ...over });
const at = (hhmm: number) => toEpoch(DATE, hhmm);

const walk: TripOption = { mode: 'walk', minutes: 26, walkMinutes: 26, transfers: 0, climbM: 18, detail: { en: 'Walk', pt: 'A pé' }, lines: [], realtime: false };
const metro = (dep: number, mins: number): TripOption => ({
  mode: 'metro', depart: at(dep), arrive: at(dep + mins), minutes: mins, walkMinutes: 5, transfers: 1, climbM: 0,
  detail: { en: 'Red line → Green line', pt: 'Linha Vermelha → Verde' },
  lines: [{ key: 'ml:red', label: { en: 'Red line', pt: 'Linha Vermelha' } }, { key: 'ml:green', label: { en: 'Green line', pt: 'Linha Verde' } }],
  boardAt: at(dep + 1), via: 'Saldanha → Alvalade', realtime: false,
});
const bus: TripOption = { mode: 'bus', depart: at(10 * 60 + 33), arrive: at(10 * 60 + 52), minutes: 19, walkMinutes: 4, transfers: 0, climbM: 0, detail: { en: 'Bus 735', pt: 'Autocarro 735' }, lines: [{ key: 'carris:735', label: { en: 'Bus 735', pt: 'Autocarro 735' } }], realtime: true };

function plannerWith(options: TripOption[], plannedFor = at(10 * 60 + 30)) {
  return new MatrixPlanner(mergeRoutes(new Map<string, RouteEntry>(), KEY, plannedFor, options));
}

describe('MatrixPlanner: real routes only', () => {
  it('with no route yet, says "pending", invents nothing and records what to fetch', () => {
    const p = new MatrixPlanner(new Map());
    const leg = p.leg(A, B, ctx());
    expect(leg).toMatchObject({ status: 'pending', minutes: 0 });
    expect(p.pendingHits).toBe(1);
    expect([...p.misses.values()][0]).toMatchObject({ key: KEY, departAt: at(10 * 60 + 30) });
  });

  it('counts the wait: leaving 10:30 for a metro at 10:34 that takes 12 min = 16 min', () => {
    const leg = plannerWith([walk, metro(10 * 60 + 34, 12)]).leg(A, B, ctx());
    expect(leg).toMatchObject({ status: 'routed', mode: 'metro', minutes: 16, boardAt: 10 * 60 + 35 });
  });

  it('skips departures you can no longer catch', () => {
    const leg = plannerWith([metro(10 * 60 + 20, 12), metro(10 * 60 + 40, 12)]).leg(A, B, ctx());
    expect(leg.minutes).toBe(22);
  });

  it('a suspended line removes its options and says so on the leg', () => {
    const down: Disruption = { id: 'd1', source: 'demo', lines: ['ml:green'], stops: [], effect: 'no-service', header: {} };
    const leg = plannerWith([metro(10 * 60 + 34, 12), bus]).leg(A, B, ctx({ disruptions: [down] }));
    expect(leg).toMatchObject({ mode: 'bus', disruption: { id: 'd1', replaced: true }, realtime: true });
  });

  it('a delay is added to the leg', () => {
    const late: Disruption = { id: 'd2', source: 'demo', lines: ['ml:red'], stops: [], effect: 'delay', delayMin: 12, header: {} };
    const leg = plannerWith([metro(10 * 60 + 34, 12)]).leg(A, B, ctx({ disruptions: [late] }));
    expect(leg).toMatchObject({ minutes: 28, disruption: { id: 'd2', delayMin: 12 } });
  });

  it('"Avoid hills" uses the climb measured on the walking route', () => {
    const shortWalk = { ...walk, minutes: 12, walkMinutes: 12 };
    expect(plannerWith([shortWalk, bus]).leg(A, B, ctx()).mode).toBe('walk');
    expect(plannerWith([shortWalk, bus]).leg(A, B, ctx({ rules: { ...DEFAULT_SETTINGS.rules, avoidHills: true } })).mode).toBe('bus');
  });

  it('rain with "Bus when it rains" avoids walking', () => {
    const shortWalk = { ...walk, minutes: 9, walkMinutes: 9, climbM: 0 };
    expect(plannerWith([shortWalk, bus]).leg(A, B, ctx({ raining: true })).mode).toBe('bus');
  });

  it('asks again when the plan is for a different time, but answers meanwhile', () => {
    const p = plannerWith([metro(10 * 60 + 34, 12)], at(8 * 60));
    const leg = p.leg(A, B, ctx());
    expect(leg.status).toBe('routed');
    expect(p.misses.size).toBe(1);
  });
});

describe('MOTIS response → options (shape seen live from Transitous, Saldanha → Alvalade)', () => {
  const plan: MotisPlan = {
    direct: [],
    itineraries: [{
      duration: 780, startTime: '2026-11-14T12:37:00Z', endTime: '2026-11-14T12:50:00Z', transfers: 1,
      legs: [
        { mode: 'WALK', duration: 60, from: { name: 'START' }, to: { name: 'Saldanha', stopId: 'pt-Metro-Lisboa_SA3' }, steps: [{ elevationUp: 0 }] },
        { mode: 'SUBWAY', duration: 60, startTime: '2026-11-14T12:38:00Z', endTime: '2026-11-14T12:39:00Z', from: { name: 'Saldanha', stopId: 'pt-Metro-Lisboa_SA3' }, to: { name: 'Alameda', stopId: 'pt-Metro-Lisboa_AM3' }, headsign: 'Aeroporto', routeShortName: 'Vermelha', realTime: false },
        { mode: 'WALK', duration: 120, from: { name: 'Alameda' }, to: { name: 'Alameda' } },
        { mode: 'SUBWAY', duration: 360, startTime: '2026-11-14T12:42:00Z', endTime: '2026-11-14T12:48:00Z', from: { name: 'Alameda', stopId: 'pt-Metro-Lisboa_AL' }, to: { name: 'Alvalade', stopId: 'pt-Metro-Lisboa_AV' }, headsign: 'Telheiras', routeShortName: 'Verde', realTime: true },
        { mode: 'WALK', duration: 120, from: { name: 'Alvalade' }, to: { name: 'END' } },
      ],
    }],
  };
  const [o] = optionsFromPlan(plan);
  it('reads mode, duration, transfers and walking', () => expect(o).toMatchObject({ mode: 'metro', minutes: 13, transfers: 1, walkMinutes: 5, realtime: true }));
  it('maps Metro lines to the same keys as the alerts', () => expect(o.lines.map((l) => l.key)).toEqual(['ml:red', 'ml:green']));
  it('describes the trip', () => expect(o).toMatchObject({ detail: { pt: 'Linha Vermelha → Linha Verde' }, via: 'Saldanha → Alvalade' }));
});
