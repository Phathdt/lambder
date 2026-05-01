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
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html', 'lcov', 'json-summary'],
      reportsDirectory: './coverage/integration',
      // Integration tests cover the persistence + I/O layer that unit tests
      // can't: Drizzle repos, Redis token store, JWT service, Hono routes.
      include: [
        'packages/auth/src/infrastructure/**/*.ts',
        'packages/products/src/infrastructure/**/*.ts',
        'packages/db/src/**/*.ts',
        'packages/cache/src/**/*.ts',
        'apps/auth-api/src/**/*.ts',
        'apps/products-api/src/**/*.ts',
      ],
      exclude: [
        '**/*.d.ts',
        '**/index.ts',
        '**/migrations/**',
        '**/dev-server.ts',
        '**/main.ts',
      ],
    },
  },
});
