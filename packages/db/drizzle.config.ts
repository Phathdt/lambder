import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

// drizzle-kit reads schemas directly from feature packages — keeps @lambder/db
// free of cross-feature deps at runtime.
export default defineConfig({
  schema: [
    '../auth/src/infrastructure/db/auth.schema.ts',
    '../products/src/infrastructure/db/products.schema.ts',
  ],
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://lambder:lambder@localhost:5433/lambder',
  },
  strict: true,
  verbose: true,
});
