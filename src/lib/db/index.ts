import 'server-only';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

/** One HTTP-based client per server instance. DATABASE_URL is the pooled Neon URL (branch `dev` locally, `main` on Vercel). */
const url = process.env.DATABASE_URL;
export const db = drizzle(neon(url ?? 'postgresql://missing:missing@localhost/missing'), { schema });
export const dbConfigured = !!url;
export { schema };
