import { describe, expect, it } from 'vitest';
import type { Disruption, Priority, Proposal, Stop } from '../../domain/types';
import { DEFAULT_SETTINGS, ritaDay } from '../../seed';
import { replan, undoDeadline } from '../replan';
import { buildTimeline, stopsOn } from '../schedule';
import { EstimatePlanner } from '../travel';
import { detectTriggers, dismissKeys, filterDismissed } from '../triggers';

const DATE = '2026-11-17'; // a Tuesday
const NOW = 10 * 60 + 12;
const planner = new EstimatePlanner();
const clock = () => 1_000_000;

function run(opts: { stops?: Stop[]; late?: number; priority?: Priority; disruptions?: Disruption[]; raining?: boolean; now?: number; busWhenRain?: boolean } = {}): Proposal | null {
  return replan({
    stops: opts.stops ?? ritaDay(DATE),
    date: DATE,
    now: opts.now ?? NOW,
    triggers: [
      ...(opts.late ? [{ kind: 'late' as const, minutes: opts.late, at: 0 }] : []),
      ...(opts.disruptions ?? []).map((d) => ({ kind: 'disruption' as const, disruptionId: d.id, delayMin: d.delayMin })),
      ...(opts.raining ? [{ kind: 'rain' as const, disruptionId: 'ipma:forecast' }] : []),
    ],
    disruptions: opts.disruptions ?? [],
    raining: !!opts.raining,
    settings: { priority: opts.priority ?? 'fewest', rules: { ...DEFAULT_SETTINGS.rules, busWhenRain: opts.busWhenRain ?? true } },
    planner,
    clock,
  });
}

const byId = (p: Proposal, id: string) => p.result.find((s) => s.id === id)!;

describe('baseline plan', () => {
  it("Rita's day is feasible as planned (no stop at risk)", () => {
    const tl = buildTimeline(stopsOn(ritaDay(DATE), DATE), planner, { rules: DEFAULT_SETTINGS.rules, priority: 'fewest', raining: false, disruptions: [] });
    expect(tl.filter((e) => e.status === 'at-risk')).toEqual([]);
  });

  it('no triggers and nothing changed → no proposal', () => {
    expect(run()).toBeNull();
  });
});

describe('Rita test: the 10:00 meeting runs over by 30 min', () => {
  const p = run({ late: 30 })!;

  it('produces a proposal', () => expect(p).not.toBeNull());

  it('keeps the fixed school pickup at 12:30 and lists it as protected (FR-02)', () => {
    expect(byId(p, 's_pickup').start).toBe(12 * 60 + 30);
    expect(p.protectedStopIds).toContain('s_pickup');
    expect(p.atRisk).toEqual([]);
  });

  it('moves the pharmacy later the same day', () => {
    const ph = byId(p, 's_pharmacy');
    expect(ph.date).toBe(DATE);
    expect(ph.start).toBeGreaterThan(10 * 60 + 30);
    expect(ph.previous).toEqual({ date: DATE, start: 10 * 60 + 30 });
  });

  it('moves the flexible groceries to Wednesday 09:30 (FR-17)', () => {
    const g = byId(p, 's_groceries');
    expect(g.date).toBe('2026-11-18');
    expect(g.start).toBe(9 * 60 + 30);
    expect(p.changes.find((c) => c.kind === 'day')).toMatchObject({ stopId: 's_groceries', toDate: '2026-11-18' });
  });

  it('never overlaps stops on the day', () => {
    const day = stopsOn(p.result, DATE);
    for (let i = 1; i < day.length; i++) expect(day[i].start).toBeGreaterThanOrEqual(day[i - 1].start + day[i - 1].duration);
  });

  it('offers Undo until the first changed stop happens (FR-22)', () => {
    expect(undoDeadline(p)).toBe(10 * 60 + 30);
  });
});

describe('principle 5: fixed stops are sacred', () => {
  for (const priority of ['fastest', 'fewest', 'calm'] as Priority[]) {
    for (const late of [10, 45, 90, 180]) {
      it(`${priority}, ${late} min late: fixed stops never move`, () => {
        const p = run({ late, priority });
        if (!p) return;
        for (const s of ritaDay(DATE).filter((x) => x.fixed)) {
          expect(byId(p, s.id)).toMatchObject({ date: s.date, start: s.start });
        }
      });
    }
  }

  it('says so when a fixed stop cannot be reached (FR-16)', () => {
    const p = run({ late: 150 })!;
    expect(p.atRisk[0]).toMatchObject({ stopId: 's_pickup' });
    expect(p.atRisk[0].lateBy).toBeGreaterThan(0);
    expect(byId(p, 's_pickup').start).toBe(12 * 60 + 30);
  });
});

describe('priorities steer the proposal (FR-15)', () => {
  it('calmest adds a buffer, so stops land later than with fewest changes', () => {
    const fewest = run({ late: 20, priority: 'fewest' })!;
    const calm = run({ late: 20, priority: 'calm' })!;
    expect(byId(calm, 's_pharmacy').start).toBeGreaterThan(byId(fewest, 's_pharmacy').start);
  });
});

describe('live disruptions', () => {
  const greenDown: Disruption = { id: 'ml-green-1', source: 'demo', lines: ['ml:green'], stops: [], effect: 'no-service', header: { en: 'Green line suspended' } };

  it('a suspended line the plan uses becomes a trigger', () => {
    const det = detectTriggers({ stops: ritaDay(DATE), date: DATE, now: NOW, nowEpoch: 0, disruptions: [greenDown], settings: DEFAULT_SETTINGS, planner });
    expect(det.triggers).toEqual([{ kind: 'disruption', disruptionId: 'ml-green-1', delayMin: undefined }]);
  });

  it('a delay under 5 min does not prompt', () => {
    const small: Disruption = { ...greenDown, id: 'x', effect: 'delay', delayMin: 3 };
    const det = detectTriggers({ stops: ritaDay(DATE), date: DATE, now: NOW, nowEpoch: 0, disruptions: [small], settings: DEFAULT_SETTINGS, planner });
    expect(det.triggers).toEqual([]);
  });

  it('a line nobody uses is ignored', () => {
    const blue: Disruption = { ...greenDown, id: 'b', lines: ['ml:blue'] };
    const det = detectTriggers({ stops: ritaDay(DATE), date: DATE, now: NOW, nowEpoch: 0, disruptions: [blue], settings: DEFAULT_SETTINGS, planner });
    expect(det.triggers).toEqual([]);
  });

  it('legs on the suspended line switch to the bus and the diff shows it', () => {
    const p = run({ disruptions: [greenDown] });
    expect(p).not.toBeNull();
    expect(p!.changes.some((c) => c.kind === 'leg' && c.to.mode === 'bus')).toBe(true);
  });

  it('after Keep my plan, the same delay does not prompt again, but a worse one does (FR-13)', () => {
    const t8 = [{ kind: 'disruption' as const, disruptionId: 'd1', delayMin: 8 }];
    const dismissed = dismissKeys(t8);
    expect(filterDismissed(t8, dismissed)).toEqual([]);
    expect(filterDismissed([{ kind: 'disruption', disruptionId: 'd1', delayMin: 15 }], dismissed)).toHaveLength(1);
  });
});

describe('rain (FR-11)', () => {
  const rain: Disruption = { id: 'ipma:LSB:rain', source: 'ipma', lines: [], stops: [], effect: 'weather', weather: { kind: 'rain', level: 'yellow' }, header: { en: 'Rain warning' } };

  it('rain with "Bus when it rains" swaps walks for the bus', () => {
    const stops = ritaDay(DATE);
    const det = detectTriggers({ stops, date: DATE, now: NOW, nowEpoch: 0, disruptions: [rain], settings: DEFAULT_SETTINGS, planner });
    expect(det.triggers.some((t) => t.kind === 'rain')).toBe(true);
    const p = run({ raining: true });
    expect(p!.changes.some((c) => c.kind === 'leg' && c.from.mode === 'walk' && c.to.mode !== 'walk')).toBe(true);
  });
});
