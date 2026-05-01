import { defineConfig } from 'vitest/config';

// Go-style colocation: each src file's test sits next to it as `*.test.ts`.
// Integration specs live next to their feature target as `*.integration.spec.ts`
// and are excluded here (loaded by vitest.integration.config.ts instead).
export default defineConfig({
  test: {
    include: ['packages/**/src/**/*.test.ts', 'apps/**/src/**/*.test.ts'],
    // apps/web has its own vitest.config.ts (jsdom + RTL); skip its tests here.
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/*.integration.spec.ts',
      '**/__test-fakes__/**',
      'apps/web/**',
    ],
    pool: 'threads',
    poolOptions: { threads: { maxThreads: 8, minThreads: 2 } },
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
        'packages/email/src/application/**/*.ts',
        'packages/email/src/domain/**/*.ts',
        'packages/email/src/infrastructure/providers/**/*.ts',
        'packages/email/src/infrastructure/enqueuers/**/*.ts',
        'apps/email-worker/src/app.ts',
      ],
      exclude: [
        '**/index.ts',
        '**/*.d.ts',
        '**/*.module.ts',
        '**/*.test.ts',
        '**/migrations/**',
        '**/types.ts',
        '**/__test-fakes__/**',
        '**/__test-helpers__/**',
        '**/interfaces/**',
      ],
      thresholds: { lines: 95, functions: 95, branches: 95 },
    },
  },
});
