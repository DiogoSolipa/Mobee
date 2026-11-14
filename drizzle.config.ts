import { defineConfig } from 'drizzle-kit';

// Migrations use the direct (unpooled) connection. Locally that is the Neon branch `dev` (.env.local).
export default defineConfig({
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? '' },
});
