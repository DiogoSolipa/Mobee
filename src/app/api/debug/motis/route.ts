import { NextResponse } from 'next/server';
import { planLeg, searchPlaces } from '@/lib/planner/motis';

export const dynamic = 'force-dynamic';

/** Development aid: normalised trip options for Rita's legs and one place search, straight from the trip planner. */
export async function GET() {
  const dep = Date.now() + 30 * 60_000;
  const pairs = [
    { key: 'saldanha>av-roma', from: { lat: 38.7351, lon: -9.1453 }, to: { lat: 38.7462, lon: -9.1387 } },
    { key: 'av-roma>mercado-alvalade', from: { lat: 38.7462, lon: -9.1387 }, to: { lat: 38.7537, lon: -9.1437 } },
    { key: 'gym>campo-ourique', from: { lat: 38.7585, lon: -9.1555 }, to: { lat: 38.7175, lon: -9.1665 } },
  ];
  const legs = await Promise.all(pairs.map(async (p) => ({ pair: p.key, ...(await planLeg({ ...p, departAt: dep })) })));
  let places: unknown;
  try { places = await searchPlaces('Mercado de Alvalade'); } catch (e) { places = String(e); }
  return NextResponse.json({ departAt: new Date(dep).toISOString(), legs, places });
}
