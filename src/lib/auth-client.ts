'use client';
import { createAuthClient } from 'better-auth/react';

/** Browser side of Better Auth. Same origin, so no baseURL needed. */
export const authClient = createAuthClient();

export const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';

export function signInWithGoogle(callbackURL = '/app') {
  return authClient.signIn.social({ provider: 'google', callbackURL });
}

/** Asks Google again for read-only Calendar access only (when the box was left unticked at sign-in). */
export function connectCalendar(callbackURL = '/settings') {
  return authClient.linkSocial({ provider: 'google', scopes: [CALENDAR_SCOPE], callbackURL });
}
