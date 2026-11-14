import { NextResponse } from 'next/server';
import { probe } from '@/lib/feeds';

export const dynamic = 'force-dynamic';

/** Development aid: raw status and a sample of each open feed endpoint. No keys are involved or shown. */
export async function GET() {
  return NextResponse.json(await probe(), { headers: { 'cache-control': 'no-store' } });
}
