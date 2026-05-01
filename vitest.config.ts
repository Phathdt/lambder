import { defineConfig } from 'vitest/config';

// Unit-only config (excludes *.integration.spec.ts).
export default defineConfig({
  test: {
    include: [
      'packages/**/test/**/*.test.ts',
      'packages/**/test/**/*.spec.ts',
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/*.integration.spec.ts',
    ],
    pool: 'threads',
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['packages/*/src/**/*.ts'],
      exclude: ['**/index.ts', '**/*.d.ts', '**/migrations/**', '**/*.module.ts'],
      thresholds: { lines: 80, functions: 80, branches: 75 },
    },
  },
});
