import { NextResponse } from 'next/server';
import type { Disruption, ISODate, Minutes, Settings, Stop, Trigger } from '@/lib/domain/types';
import { replan } from '@/lib/engine/replan';
import { MatrixPlanner, mergeRoutes, type RouteEntry } from '@/lib/engine/travel';
import { planLegs } from '@/lib/planner/motis';

/**
 * The replan engine as an API (get plan → propose → accept/undo happen on the client today).
 * Same pure function the app runs locally. An MCP server can wrap this later: `propose_replan(reason)`
 * returns a proposal and never applies it (principle 1).
 */
interface Body {
  stops: Stop[];
  date: ISODate;
  now: Minutes;
  triggers: Trigger[];
  disruptions?: Disruption[];
  raining?: boolean;
  settings: Pick<Settings, 'priority' | 'rules'>;
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (!Array.isArray(body.stops) || typeof body.date !== 'string' || typeof body.now !== 'number' || !body.settings) {
    return NextResponse.json({ error: 'Expected { stops, date, now, triggers, settings }' }, { status: 400 });
  }
  // Run, fetch the routes the engine asked for, run again (at most 3 rounds).
  let routes = new Map<string, RouteEntry>();
  let proposal = null;
  for (let round = 0; round < 3; round++) {
    const planner = new MatrixPlanner(routes);
    proposal = replan({
      stops: body.stops,
      date: body.date,
      now: body.now,
      triggers: body.triggers ?? [],
      disruptions: body.disruptions ?? [],
      raining: !!body.raining,
      settings: body.settings,
      planner,
    });
    if (!planner.misses.size) break;
    const misses = [...planner.misses.values()].slice(0, 40);
    const results = await planLegs(misses.map((m) => ({ ...m, key: `${m.key}@${m.departAt}` })));
    for (const m of misses) {
      const r = results[`${m.key}@${m.departAt}`];
      routes = mergeRoutes(routes, m.key, m.departAt, r?.options ?? [], r?.error);
    }
  }
  return NextResponse.json({ proposal });
}
