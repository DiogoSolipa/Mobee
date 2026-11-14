import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db, dbConfigured, schema } from '@/lib/db';
import { getCaller } from '@/lib/server/identity';

/** Who am I? `{ user: null }` when signed out; 503 when the server has no database (local demo mode). */
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!dbConfigured) return NextResponse.json({ error: 'database not configured' }, { status: 503 });
  const caller = await getCaller(req.headers);
  if (!caller) return NextResponse.json({ user: null }, { headers: { 'cache-control': 'no-store' } });
  const [u] = await db.select({ name: schema.user.name, email: schema.user.email, image: schema.user.image }).from(schema.user).where(eq(schema.user.id, caller.userId)).limit(1);
  return NextResponse.json({ user: u ?? null, via: caller.via }, { headers: { 'cache-control': 'no-store' } });
}
