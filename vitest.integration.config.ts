import { defineConfig } from 'vitest/config';

// Integration-only config — each fork spins up its own testcontainer pair so
// suites run in parallel without sharing DB state.
//
// Tunables (env):
//   VITEST_INT_FORKS  upper bound on concurrent forks (default 4)
//
// Each fork runs ~1 PG + 1 Redis container; tune down on memory-tight CI.
const maxForks = Number.parseInt(process.env.VITEST_INT_FORKS ?? '4', 10);

export default defineConfig({
  test: {
    // Go-style colocation: integration specs sit next to their feature target
    // (e.g. apps/auth-api/src/auth-flow.integration.spec.ts).
    include: [
      'apps/**/src/**/*.integration.spec.ts',
      'packages/**/src/**/*.integration.spec.ts',
    ],
    exclude: ['**/node_modules/**', '**/dist/**', '**/__test-helpers__/**'],
    testTimeout: 120_000,
    hookTimeout: 180_000,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: false,
        maxForks,
        minForks: 1,
        isolate: true,
      },
    },
    fileParallelism: true,
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
        '**/*.integration.spec.ts',
        '**/__test-helpers__/**',
        '**/migrations/**',
        '**/dev-server.ts',
        '**/main.ts',
      ],
    },
  },
});
