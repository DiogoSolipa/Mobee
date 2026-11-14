import { NextResponse } from 'next/server';
import { searchPlaces } from '@/lib/planner/motis';

export const dynamic = 'force-dynamic';

/** Place search around Lisbon (MOTIS geocoder over OpenStreetMap and transit stops). */
export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get('q') ?? '').trim().slice(0, 80);
  if (q.length < 3) return NextResponse.json({ results: [] });
  try {
    return NextResponse.json({ results: await searchPlaces(q) }, { headers: { 'cache-control': 'public, max-age=3600' } });
  } catch (e) {
    return NextResponse.json({ results: [], error: e instanceof Error ? e.message : 'Search failed' }, { status: 502 });
  }
}
