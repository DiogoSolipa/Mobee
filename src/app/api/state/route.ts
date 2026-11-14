import { and, eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db, dbConfigured, schema } from '@/lib/db';
import { getCaller } from '@/lib/server/identity';

/**
 * The person's plan document (Fase 0: `load`/`save` move from localStorage to here).
 * GET → { state, version }. PUT { state, baseVersion } → { version } or 409 { state, version } when
 * someone else (another device, the MCP server, a background job) wrote in between.
 * DELETE erases the account and everything in it ("Apagar tudo"); only from a signed-in browser.
 */
export const dynamic = 'force-dynamic';
const MAX_BYTES = 512 * 1024;

const unauthorized = () => NextResponse.json({ error: 'not signed in' }, { status: 401 });

export async function GET(req: Request) {
  if (!dbConfigured) return NextResponse.json({ error: 'database not configured' }, { status: 503 });
  const caller = await getCaller(req.headers);
  if (!caller) return unauthorized();
  const [row] = await db.select().from(schema.userState).where(eq(schema.userState.userId, caller.userId)).limit(1);
  return NextResponse.json({ state: row?.state ?? null, version: row?.version ?? 0 }, { headers: { 'cache-control': 'no-store' } });
}

export async function PUT(req: Request) {
  if (!dbConfigured) return NextResponse.json({ error: 'database not configured' }, { status: 503 });
  const caller = await getCaller(req.headers);
  if (!caller) return unauthorized();
  const raw = await req.text();
  if (raw.length > MAX_BYTES) return NextResponse.json({ error: 'too large' }, { status: 413 });
  let body: { state?: unknown; baseVersion?: unknown };
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: 'invalid JSON' }, { status: 400 }); }
  const { state, baseVersion } = body;
  if (!state || typeof state !== 'object' || Array.isArray(state) || typeof baseVersion !== 'number') {
    return NextResponse.json({ error: 'expected { state: object, baseVersion: number }' }, { status: 400 });
  }

  const written = baseVersion === 0
    ? await db.insert(schema.userState).values({ userId: caller.userId, state, version: 1 }).onConflictDoNothing().returning({ version: schema.userState.version })
    : await db.update(schema.userState)
      .set({ state, version: sql`${schema.userState.version} + 1`, updatedAt: new Date() })
      .where(and(eq(schema.userState.userId, caller.userId), eq(schema.userState.version, baseVersion)))
      .returning({ version: schema.userState.version });
  if (written[0]) return NextResponse.json({ version: written[0].version });

  const [current] = await db.select().from(schema.userState).where(eq(schema.userState.userId, caller.userId)).limit(1);
  return NextResponse.json({ error: 'conflict', state: current?.state ?? null, version: current?.version ?? 0 }, { status: 409 });
}

export async function DELETE(req: Request) {
  if (!dbConfigured) return NextResponse.json({ error: 'database not configured' }, { status: 503 });
  const caller = await getCaller(req.headers);
  if (!caller) return unauthorized();
  if (caller.via !== 'session') return NextResponse.json({ error: 'only from the app' }, { status: 403 });
  // Cascades to sessions, Google tokens, plan and access links.
  await db.delete(schema.user).where(eq(schema.user.id, caller.userId));
  const res = NextResponse.json({ ok: true });
  res.cookies.delete('mobee_access');
  return res;
}
