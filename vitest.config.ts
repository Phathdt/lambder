import { defineConfig } from 'vitest/config';

// Unit-only config (excludes *.integration.spec.ts).
//
// Coverage scope: only the layers we exercise with unit tests live here.
// Infrastructure (drizzle repos, schemas, db pool, redis client, JWT service)
// is covered by integration tests instead. Contracts are declarative Zod
// schemas — coverage isn't meaningful and they're exercised end-to-end by
// FE/integration tests anyway.
export default defineConfig({
  test: {
    include: [
      'packages/**/test/**/*.test.ts',
      'packages/**/test/**/*.spec.ts',
    ],
    exclude: ['**/node_modules/**', '**/dist/**', '**/*.integration.spec.ts'],
    pool: 'threads',
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html', 'lcov', 'json-summary'],
      reportsDirectory: './coverage/unit',
      include: [
        'packages/auth/src/application/**/*.ts',
        'packages/auth/src/domain/**/*.ts',
        'packages/products/src/application/**/*.ts',
        'packages/products/src/domain/**/*.ts',
        'packages/shared-kernel/src/**/*.ts',
        'packages/auth/src/infrastructure/crypto/argon2.hasher.ts',
      ],
      exclude: [
        '**/index.ts',
        '**/*.d.ts',
        '**/*.module.ts',
        '**/migrations/**',
        '**/types.ts',
        // Pure interface files — no executable code to cover.
        '**/interfaces/**',
      ],
      thresholds: { lines: 80, functions: 80, branches: 75 },
    },
  },
});
