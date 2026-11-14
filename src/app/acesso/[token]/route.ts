import { NextResponse } from 'next/server';
import { ACCESS_COOKIE, userFromToken } from '@/lib/server/identity';

/** Opening the personal access link signs the browser in as that person, without Google (V2-66). */
export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const userId = await userFromToken(token).catch(() => null);
  const to = new URL(userId ? '/app' : '/app?acesso=invalido', req.url);
  const res = NextResponse.redirect(to);
  res.headers.set('referrer-policy', 'no-referrer');
  if (userId) {
    res.cookies.set(ACCESS_COOKIE, token, { httpOnly: true, secure: to.protocol === 'https:', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 365 });
  }
  return res;
}
