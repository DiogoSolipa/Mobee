import { NextResponse } from 'next/server';
import type { Disruption, ISODate, Minutes, Settings, Stop, Trigger } from '@/lib/domain/types';
import { replan } from '@/lib/engine/replan';
import { EstimatePlanner } from '@/lib/engine/travel';

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
  const proposal = replan({
    stops: body.stops,
    date: body.date,
    now: body.now,
    triggers: body.triggers ?? [],
    disruptions: body.disruptions ?? [],
    raining: !!body.raining,
    settings: body.settings,
    planner: new EstimatePlanner(),
  });
  return NextResponse.json({ proposal });
}
