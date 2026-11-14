// Applies pending migrations from /drizzle. Runs before `next build` on Vercel (each preview gets its own
// Neon branch from the integration; production uses `main`). Skips quietly when no database is configured,
// so `npm run build` still works on a machine without one.
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { migrate } from 'drizzle-orm/neon-http/migrator';

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) {
  console.log('[migrate] no DATABASE_URL: skipped');
  process.exit(0);
}
const host = new URL(url).hostname;
await migrate(drizzle(neon(url)), { migrationsFolder: './drizzle' });
console.log(`[migrate] up to date on ${host}`);
