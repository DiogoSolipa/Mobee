import { NextResponse } from 'next/server';
import { dbConfigured } from '@/lib/db';
import { getCaller, hasAccessToken, issueAccessToken, revokeAccessTokens } from '@/lib/server/identity';

/**
 * Personal access link (V2-66). Only a signed-in browser can see, create or revoke it:
 * an agent holding the link cannot mint new ones.
 */
export const dynamic = 'force-dynamic';

async function sessionUser(req: Request) {
  if (!dbConfigured) return null;
  const c = await getCaller(req.headers);
  return c?.via === 'session' ? c.userId : null;
}
const denied = () => NextResponse.json({ error: 'sign in first' }, { status: 401 });

export async function GET(req: Request) {
  const userId = await sessionUser(req);
  if (!userId) return denied();
  const t = await hasAccessToken(userId);
  return NextResponse.json({ active: !!t, createdAt: t?.createdAt ?? null, lastUsedAt: t?.lastUsedAt ?? null });
}

export async function POST(req: Request) {
  const userId = await sessionUser(req);
  if (!userId) return denied();
  const token = await issueAccessToken(userId);
  const origin = new URL(req.url).origin;
  return NextResponse.json({ url: `${origin}/acesso/${token}`, token });
}

export async function DELETE(req: Request) {
  const userId = await sessionUser(req);
  if (!userId) return denied();
  await revokeAccessTokens(userId);
  return NextResponse.json({ ok: true });
}
