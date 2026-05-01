import { defineConfig } from 'vitest/config';

// Integration-only config — testcontainers Postgres + Redis spin up once per
// fork. Single fork keeps startup cost down across files in the same suite.
export default defineConfig({
  test: {
    include: [
      'apps/**/test/**/*.integration.spec.ts',
      'packages/**/test/**/*.integration.spec.ts',
    ],
    exclude: ['**/node_modules/**', '**/dist/**'],
    testTimeout: 120_000,
    hookTimeout: 180_000,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    environment: 'node',
  },
});
