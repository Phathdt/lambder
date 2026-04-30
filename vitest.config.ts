import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['packages/*/src/**/*.ts'],
      exclude: ['**/index.ts', '**/*.d.ts', '**/migrations/**'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
      },
    },
    pool: 'threads',
    environment: 'node',
  },
});
