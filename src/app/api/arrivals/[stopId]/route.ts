import { NextResponse } from 'next/server';
import { getArrivals } from '@/lib/feeds';

export const dynamic = 'force-dynamic';

/** Carris Metropolitana arrival estimates for one stop, proxied server-side. */
export async function GET(_req: Request, ctx: { params: Promise<{ stopId: string }> }) {
  const { stopId } = await ctx.params;
  try {
    return NextResponse.json(await getArrivals(stopId));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 502 });
  }
}
