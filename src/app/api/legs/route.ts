import { NextResponse } from 'next/server';
import { PLANNER_BASE, planLegs, type LegRequest } from '@/lib/planner/motis';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const MAX = 40;
const valid = (c: unknown): c is { lat: number; lon: number } =>
  !!c && typeof (c as { lat: unknown }).lat === 'number' && typeof (c as { lon: unknown }).lon === 'number' &&
  Math.abs((c as { lat: number }).lat) <= 90 && Math.abs((c as { lon: number }).lon) <= 180;

/** Trip planner proxy: real options (walk + transit, with live data where the planner has it) for each requested leg. */
export async function POST(req: Request) {
  let body: { requests?: LegRequest[] };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const reqs = (body.requests ?? []).filter((r) => r && typeof r.key === 'string' && valid(r.from) && valid(r.to) && typeof r.departAt === 'number').slice(0, MAX);
  if (!reqs.length) return NextResponse.json({ error: 'Expected { requests: [{ key, from, to, departAt }] }' }, { status: 400 });
  const results = await planLegs(reqs);
  return NextResponse.json({ provider: new URL(PLANNER_BASE()).host, results }, { headers: { 'cache-control': 'no-store' } });
}
