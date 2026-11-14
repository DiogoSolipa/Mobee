import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const UA = 'Mobee/0.1 (pilot; https://github.com/DiogoSolipa/mobee)';

/** Development aid: raw MOTIS responses for one Lisbon trip and one place search. */
export async function GET(req: Request) {
  const base = process.env.TRIP_PLANNER_URL?.trim() || 'https://api.transitous.org';
  const v = new URL(req.url).searchParams.get('v') ?? '5';
  const time = new Date(Date.now() + 3600e3).toISOString();
  const urls = [
    `${base}/api/v${v}/plan?fromPlace=38.7351,-9.1453&toPlace=38.7537,-9.1437&time=${encodeURIComponent(time)}&numItineraries=3`,
    `${base}/api/v1/geocode?text=${encodeURIComponent('Mercado de Alvalade')}`,
  ];
  const out = await Promise.all(urls.map(async (url) => {
    try {
      const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/json' }, cache: 'no-store' });
      const text = await res.text();
      return { url, status: res.status, sample: text.slice(0, 6000) };
    } catch (e) {
      return { url, status: e instanceof Error ? e.message : 'error', sample: '' };
    }
  }));
  return NextResponse.json(out);
}
