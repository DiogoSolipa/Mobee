import { addDays } from '../domain/time';
import type { Change, Disruption, ISODate, Leg, Minutes, Priority, Proposal, Settings, Stop, Trigger } from '../domain/types';
import { endOf, stopsOn } from './schedule';
import type { LegContext, TripPlanner } from './travel';
import { WINDOW_MIN } from './triggers';

/**
 * Replan engine (FR-14 – FR-17).
 * Pure and deterministic: same inputs, same proposal. Runs in the browser and in /api/replan.
 *
 * 1. Work out when the person can leave (a "late" trigger pushes the departure).
 * 2. Re-time every upcoming stop with the current legs (disruptions and rain change legs).
 * 3. If a fixed stop, a time window or opening hours would be broken, try deferring
 *    movable stops to a later day; pick the option the person's priority prefers.
 * 4. Diff against the current plan. No difference and nothing at risk → no proposal.
 */

export const DAY_START: Minutes = 9 * 60 + 30;
const DAY_END: Minutes = 21 * 60;
const CALM_BUFFER = 5;
const MAX_SEARCH = 10; // movable stops considered for deferral (2^10 options)

export interface ReplanInput {
  stops: Stop[];
  date: ISODate;
  now: Minutes;
  triggers: Trigger[];
  /** Disruptions currently active and relevant (already filtered to the next 3 hours). */
  disruptions: Disruption[];
  raining: boolean;
  settings: Pick<Settings, 'priority' | 'rules'>;
  planner: TripPlanner;
  /** Injected for tests; defaults to Date.now(). */
  clock?: () => number;
}

interface Placement {
  stop: Stop;
  start: Minutes;
  leg?: Leg;
  lateBy: number;
}

interface Evaluation {
  placements: Placement[];
  deferred: Stop[];
  fixedLate: { stopId: string; lateBy: number }[];
  violations: number;
  travel: number;
  transfers: number;
  walking: number;
  moved: number;
  cost: number;
}

export function triggerSignature(triggers: Trigger[]): string {
  return triggers
    .map((t) => (t.kind === 'late' ? `late:${t.minutes}` : t.kind === 'rain' ? `rain:${t.disruptionId}` : `d:${t.disruptionId}:${t.delayMin ?? ''}`))
    .sort()
    .join('|');
}

function legCtx(input: ReplanInput, disruptions: Disruption[], raining: boolean): LegContext {
  return { rules: input.settings.rules, priority: input.settings.priority, raining, disruptions };
}

function canDefer(s: Stop, date: ISODate): boolean {
  if (s.fixed) return false;
  if (s.flex?.kind === 'before' && s.flex.deadline) return s.flex.deadline > date;
  return true;
}

function evaluate(
  origin: Stop | undefined,
  depart: Minutes,
  upcoming: Stop[],
  deferSet: Set<string>,
  priority: Priority,
  planner: TripPlanner,
  ctx: LegContext,
): Evaluation {
  const placements: Placement[] = [];
  const deferred: Stop[] = [];
  const fixedLate: Evaluation['fixedLate'] = [];
  let cursor = depart, prev = origin, violations = 0, travel = 0, transfers = 0, walking = 0, moved = 0;
  const buffer = priority === 'calm' ? CALM_BUFFER : 0;

  for (const s of upcoming) {
    if (deferSet.has(s.id)) { deferred.push(s); continue; }
    const leg = prev ? planner.leg(prev, s, ctx) : undefined;
    const arrive = cursor + (leg?.minutes ?? 0) + (leg ? buffer : 0);
    let start: Minutes;
    let lateBy = 0;
    if (s.fixed) {
      start = s.start;
      if (arrive > s.start) { lateBy = arrive - s.start; fixedLate.push({ stopId: s.id, lateBy }); }
    } else {
      start = Math.max(s.start, arrive);
      if (s.openingHours && start < s.openingHours.from) start = s.openingHours.from;
      if (s.openingHours && start + s.duration > s.openingHours.to) violations++;
      if (s.flex?.kind === 'window' && s.flex.to !== undefined && start + s.duration > s.flex.to) violations++;
      if (start + s.duration > 24 * 60) violations++;
    }
    if (leg) { travel += leg.minutes; transfers += leg.transfers; walking += leg.walkMinutes; }
    if (start !== s.start) moved++;
    placements.push({ stop: s, start, leg, lateBy });
    cursor = start + s.duration;
    prev = s;
  }

  const lateTotal = fixedLate.reduce((a, f) => a + f.lateBy, 0);
  const deferTimed = deferred.filter((s) => !s.flex).length;
  const base = lateTotal * 1000 + violations * 500 + deferTimed * 200;
  let cost: number;
  switch (priority) {
    case 'fastest':
      cost = base + travel * 2 + cursor * 0.2 + deferred.length * 30 + moved * 2;
      break;
    case 'calm':
      cost = base + transfers * 15 + walking * 1.5 + deferred.length * 40 + moved * 5 + travel * 0.5;
      break;
    default: // fewest changes
      cost = base + deferred.length * 100 + moved * 10 + travel * 0.2;
  }
  return { placements, deferred, fixedLate, violations, travel, transfers, walking, moved, cost };
}

/** First free slot on `date` at or after `from` that fits `duration` with a 15-min travel gap. */
function firstFreeSlot(existing: Stop[], date: ISODate, from: Minutes, duration: number): Minutes {
  const day = stopsOn(existing, date);
  let t = from;
  for (const s of day) {
    if (t + duration + 15 <= s.start) break;
    t = Math.max(t, endOf(s) + 15);
  }
  return Math.min(t, DAY_END - duration);
}

function legsByTarget(placements: Placement[]): Map<string, Leg | undefined> {
  return new Map(placements.map((p) => [p.stop.id, p.leg]));
}

export function replan(input: ReplanInput): Proposal | null {
  const { stops, date, now, triggers, planner } = input;
  const priority = input.settings.priority;
  if (!triggers.length) return null;
  const day = stopsOn(stops, date);

  // Origin: the stop in progress, else the last stop already finished, else none (leave from "now").
  const inProgress = day.find((s) => s.start <= now && endOf(s) > now);
  const finished = day.filter((s) => endOf(s) <= now);
  const origin = inProgress ?? finished[finished.length - 1];
  const upcoming = day.filter((s) => s !== origin && endOf(s) > now);
  if (!upcoming.length) return null;

  const lateMinutes = triggers.reduce((a, t) => (t.kind === 'late' ? a + t.minutes : a), 0);
  const originEnd = origin ? endOf(origin) : now;
  const depart = Math.max(now, originEnd) + lateMinutes;
  const baseDepart = Math.max(now, originEnd);

  const ctxNow = legCtx(input, input.disruptions, input.raining);
  const ctxBase = legCtx(input, [], false);

  // Baseline: the plan as it stands with yesterday's assumptions, used for leg diffs.
  const baseline = evaluate(origin, baseDepart, upcoming, new Set(), priority, planner, ctxBase);
  const baselineLegs = legsByTarget(baseline.placements);

  // Search deferral sets over movable stops (flexible first).
  const movable = upcoming.filter((s) => canDefer(s, date)).sort((a, b) => Number(!!b.flex) - Number(!!a.flex)).slice(0, MAX_SEARCH);
  let best = evaluate(origin, depart, upcoming, new Set(), priority, planner, ctxNow);
  const needsSearch = best.fixedLate.length > 0 || best.violations > 0;
  if (needsSearch) {
    const n = movable.length;
    for (let mask = 1; mask < 1 << n; mask++) {
      const set = new Set<string>();
      for (let i = 0; i < n; i++) if (mask & (1 << i)) set.add(movable[i].id);
      const e = evaluate(origin, depart, upcoming, set, priority, planner, ctxNow);
      if (e.cost < best.cost) best = e;
    }
  }

  // Build the resulting stops and the diff.
  const changes: Change[] = [];
  const updated = new Map<string, Stop>();
  for (const p of best.placements) {
    if (p.start !== p.stop.start) {
      changes.push({ kind: 'time', stopId: p.stop.id, title: p.stop.title, from: p.stop.start, to: p.start });
      updated.set(p.stop.id, { ...p.stop, start: p.start, previous: { date: p.stop.date, start: p.stop.start } });
    }
  }
  const nextDay = addDays(date, 1);
  let working = stops.filter((s) => !best.deferred.some((d) => d.id === s.id));
  for (const s of best.deferred) {
    const from = s.flex?.kind === 'window' && s.flex.from !== undefined ? Math.max(DAY_START, s.flex.from) : s.flex ? DAY_START : s.start;
    const start = firstFreeSlot(working, nextDay, from, s.duration);
    const moved: Stop = { ...s, date: nextDay, start, previous: { date: s.date, start: s.start }, flex: s.flex?.kind === 'today' ? { kind: 'today' } : s.flex };
    working = [...working, moved];
    updated.set(s.id, moved);
    changes.push({ kind: 'day', stopId: s.id, title: s.title, from: s.start, toDate: nextDay, to: start });
  }
  // Leg changes caused by disruptions or rain (mode swaps), FR-02 "show the difference".
  for (const p of best.placements) {
    const before = baselineLegs.get(p.stop.id);
    // Only a real swap on the same journey (same origin) counts; a new predecessor is already explained by the time changes.
    const departs = p.start - (p.leg?.minutes ?? 0);
    if (departs > now + WINDOW_MIN) continue; // only the next ~3 hours (brief: notifications scope)
    if (p.leg && before && before.fromStopId === p.leg.fromStopId && p.leg.mode !== before.mode) {
      changes.push({ kind: 'leg', toStopId: p.stop.id, title: p.stop.title, from: { mode: before.mode, minutes: before.minutes }, to: { mode: p.leg.mode, minutes: p.leg.minutes } });
    }
  }

  if (!changes.length && !best.fixedLate.length) return null;

  const result = stops.map((s) => updated.get(s.id) ?? s);
  const createdAt = (input.clock ?? Date.now)();
  const signature = triggerSignature(triggers);
  return {
    id: `p_${createdAt.toString(36)}_${signature.length}`,
    date,
    createdAt,
    triggers,
    changes,
    protectedStopIds: upcoming.filter((s) => s.fixed).map((s) => s.id),
    atRisk: best.fixedLate,
    result,
    priority,
    signature,
  };
}

/** Earliest minute (on `date`) at which any changed stop happens: Undo is offered until then (FR-22). */
export function undoDeadline(p: Proposal): Minutes {
  const times = p.changes.flatMap((c) => (c.kind === 'time' ? [Math.min(c.from, c.to)] : c.kind === 'day' ? [c.from] : []));
  return times.length ? Math.min(...times) : 24 * 60;
}
