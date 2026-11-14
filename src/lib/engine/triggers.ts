import type { Disruption, ISODate, Minutes, Settings, Stop, Trigger } from '../domain/types';
import { buildTimeline, endOf, stopsOn } from './schedule';
import type { TripPlanner } from './travel';

/** Only changes affecting the next ~3 hours raise a prompt (brief: Notifications). */
export const WINDOW_MIN = 180;
export const MIN_DELAY = 5; // FR-10
export const RAIN_PROBABILITY = 70;

export interface DetectInput {
  stops: Stop[];
  date: ISODate;
  now: Minutes;
  nowEpoch: number;
  disruptions: Disruption[];
  rainProbability?: number;
  settings: Pick<Settings, 'priority' | 'rules'>;
  planner: TripPlanner;
}

export interface Detection {
  triggers: Trigger[];
  /** Disruptions that touch the person's legs: passed on to the replan engine. */
  relevant: Disruption[];
  raining: boolean;
}

function active(d: Disruption, nowEpoch: number): boolean {
  const horizon = nowEpoch + WINDOW_MIN * 60000;
  return (d.start === undefined || d.start <= horizon) && (d.end === undefined || d.end >= nowEpoch);
}

/** Map live disruptions onto the legs of the next 3 hours (FR-10, FR-11). */
export function detectTriggers(input: DetectInput): Detection {
  const { stops, date, now, nowEpoch, settings, planner } = input;
  const day = stopsOn(stops, date);
  const ctx = { rules: settings.rules, priority: settings.priority, raining: false, disruptions: [] };
  const timeline = buildTimeline(day, planner, ctx);
  const legsInWindow = timeline
    .map((e, i) => ({ leg: e.leg, departs: i > 0 ? endOf(day[i - 1]) : e.stop.start }))
    .filter((x) => x.leg && x.departs + (x.leg?.minutes ?? 0) >= now && x.departs <= now + WINDOW_MIN)
    .map((x) => x.leg!);

  const lineKeys = new Set(legsInWindow.flatMap((l) => l.lines.map((r) => r.key)));
  // Lines a leg *could* use are also relevant: a suspended line forces a reroute.
  const triggers: Trigger[] = [];
  const relevant: Disruption[] = [];

  for (const d of input.disruptions) {
    if (d.effect === 'weather' || !active(d, nowEpoch)) continue;
    if (!d.lines.some((k) => lineKeys.has(k))) continue;
    if (d.effect === 'delay' && (d.delayMin ?? 10) < MIN_DELAY) continue;
    relevant.push(d);
    triggers.push({ kind: 'disruption', disruptionId: d.id, delayMin: d.delayMin });
  }

  const walks = legsInWindow.filter((l) => l.mode === 'walk' && l.minutes > 0);
  const rainAlert = input.disruptions.find((d) => d.effect === 'weather' && d.weather?.kind === 'rain' && active(d, nowEpoch));
  const forecastRain = (input.rainProbability ?? 0) >= RAIN_PROBABILITY;
  const raining = !!rainAlert || forecastRain;
  const rainMatters = walks.some((w) => settings.rules.busWhenRain || w.minutes > 10);
  if (raining && rainMatters) {
    const id = rainAlert?.id ?? 'ipma:forecast';
    triggers.push({ kind: 'rain', disruptionId: id });
    if (rainAlert) relevant.push(rainAlert);
  }
  return { triggers, relevant, raining: raining && rainMatters };
}

/** FR-13: after "Keep my plan", the same cause only prompts again if it gets worse. */
export function filterDismissed(triggers: Trigger[], dismissed: Record<string, number>): Trigger[] {
  return triggers.filter((t) => {
    if (t.kind === 'late') return true;
    const key = t.kind === 'rain' ? `rain:${t.disruptionId}` : `d:${t.disruptionId}`;
    if (!(key in dismissed)) return true;
    const was = dismissed[key];
    const now = t.kind === 'disruption' ? t.delayMin ?? 0 : 0;
    return now >= was + MIN_DELAY;
  });
}

export function dismissKeys(triggers: Trigger[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of triggers) {
    if (t.kind === 'rain') out[`rain:${t.disruptionId}`] = 0;
    if (t.kind === 'disruption') out[`d:${t.disruptionId}`] = t.delayMin ?? 0;
  }
  return out;
}
