import 'server-only';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { db, schema } from '../db';
import { auth } from './auth';

/**
 * Who is calling? Either a signed-in browser (Better Auth session cookie) or an agent holding the
 * person's access link (V2-66), sent as `Authorization: Bearer <token>` or the `mobee_access` cookie
 * that /acesso/<token> sets.
 */
export const ACCESS_COOKIE = 'mobee_access';

export type Caller = { userId: string; via: 'session' | 'token' };

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export async function userFromToken(token: string): Promise<string | null> {
  if (!token || token.length < 32) return null;
  const [row] = await db
    .select({ id: schema.accessToken.id, userId: schema.accessToken.userId })
    .from(schema.accessToken)
    .where(and(eq(schema.accessToken.tokenHash, hashToken(token)), isNull(schema.accessToken.revokedAt)))
    .limit(1);
  if (!row) return null;
  await db.update(schema.accessToken).set({ lastUsedAt: new Date() }).where(eq(schema.accessToken.id, row.id));
  return row.userId;
}

function readCookie(header: string | null, name: string): string | undefined {
  return header?.split(/;\s*/).find((c) => c.startsWith(`${name}=`))?.slice(name.length + 1);
}

export async function getCaller(headers: Headers): Promise<Caller | null> {
  const session = await auth.api.getSession({ headers }).catch(() => null);
  if (session?.user) return { userId: session.user.id, via: 'session' };
  const bearer = headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  const token = bearer ?? readCookie(headers.get('cookie'), ACCESS_COOKIE);
  const userId = token ? await userFromToken(decodeURIComponent(token)) : null;
  return userId ? { userId, via: 'token' } : null;
}

/** Revokes any previous link and issues a new one. The plain token is returned once and never stored. */
export async function issueAccessToken(userId: string): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  await db.update(schema.accessToken).set({ revokedAt: new Date() }).where(and(eq(schema.accessToken.userId, userId), isNull(schema.accessToken.revokedAt)));
  await db.insert(schema.accessToken).values({ id: randomUUID(), userId, tokenHash: hashToken(token) });
  return token;
}

export async function revokeAccessTokens(userId: string): Promise<void> {
  await db.update(schema.accessToken).set({ revokedAt: new Date() }).where(and(eq(schema.accessToken.userId, userId), isNull(schema.accessToken.revokedAt)));
}

export async function hasAccessToken(userId: string): Promise<{ createdAt: Date; lastUsedAt: Date | null } | null> {
  const [row] = await db
    .select({ createdAt: schema.accessToken.createdAt, lastUsedAt: schema.accessToken.lastUsedAt })
    .from(schema.accessToken)
    .where(and(eq(schema.accessToken.userId, userId), isNull(schema.accessToken.revokedAt)))
    .limit(1);
  return row ?? null;
}
