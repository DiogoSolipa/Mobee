'use client';
import { createAuthClient } from 'better-auth/react';

/** Browser side of Better Auth. Same origin, so no baseURL needed. */
export const authClient = createAuthClient();

export function signInWithGoogle(callbackURL = '/app') {
  return authClient.signIn.social({ provider: 'google', callbackURL });
}
