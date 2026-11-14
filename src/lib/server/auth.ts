import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db, schema } from '../db';

/**
 * Accounts (V2-20, V2-21). Sign-in is Google only: one tap gives identity and read-only Calendar access.
 * Tokens are encrypted at rest; `accessType: offline` gets a refresh token so the server can sync the
 * calendar without the person opening the app.
 */
export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: 'pg', schema }),
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      // Better Auth already asks for openid, email and profile.
      scope: ['https://www.googleapis.com/auth/calendar.readonly'],
      accessType: 'offline',
      // `consent` makes Google return a refresh token even on a second sign-in.
      prompt: 'select_account consent',
    },
  },
  account: { encryptOAuthTokens: true },
  session: { expiresIn: 60 * 60 * 24 * 90, updateAge: 60 * 60 * 24 },
});
