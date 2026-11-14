import { NextResponse } from 'next/server';
import { getSnapshot } from '@/lib/feeds';

export const dynamic = 'force-dynamic';

/** Live disruptions from every source, normalised, with per-feed health (FR-33 – FR-35). */
export async function GET(req: Request) {
  const force = new URL(req.url).searchParams.get('force') === '1';
  const snap = await getSnapshot(force);
  return NextResponse.json(snap, { headers: { 'cache-control': 'no-store' } });
}
