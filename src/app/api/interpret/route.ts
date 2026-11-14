import { NextResponse } from 'next/server';
import { dbConfigured } from '@/lib/db';
import { lisbonNow } from '@/lib/domain/time';
import type { Draft } from '@/lib/engine/place';
import { getCaller } from '@/lib/server/identity';
import { interpret } from '@/lib/server/interpret';

/**
 * `adicionar(texto)` (V2-64): free text → interpreted items with places resolved. Does not change the
 * plan: the app shows a confirmation card and only "Está bom" adds the items (V2-43).
 * POST { text, previous?: Draft[] } → { drafts, unclear }.
 * Signed-in callers only (it costs money); the clock is the server's Lisbon clock.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(req: Request) {
  if (!dbConfigured) return NextResponse.json({ error: 'database not configured' }, { status: 503 });
  const caller = await getCaller(req.headers);
  if (!caller) return NextResponse.json({ error: 'sign in first' }, { status: 401 });

  let body: { text?: unknown; previous?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid JSON' }, { status: 400 }); }
  const text = typeof body.text === 'string' ? body.text.trim().slice(0, 2000) : '';
  if (!text) return NextResponse.json({ error: 'empty text' }, { status: 400 });
  const previous = Array.isArray(body.previous) ? (body.previous.slice(0, 20) as Draft[]) : undefined;

  const now = lisbonNow();
  try {
    const result = await interpret({ text, today: now.date, nowMin: now.minutes, previous });
    return NextResponse.json(result, { headers: { 'cache-control': 'no-store' } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'interpreter failed';
    console.error('[interpret]', msg);
    const missingKey = /api key|AI_GATEWAY|unauthenticated|OIDC/i.test(msg);
    return NextResponse.json({ error: missingKey ? 'interpreter not configured' : 'interpreter failed' }, { status: missingKey ? 503 : 502 });
  }
}
