import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    pool: 'threads',
    poolOptions: { threads: { maxThreads: 8, minThreads: 2 } },
    setupFiles: ['./src/__test-utils__/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['node_modules', 'dist', '.turbo', '**/__test-utils__/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html', 'lcov', 'json-summary'],
      reportsDirectory: './coverage',
      include: [
        'src/features/**/*.{ts,tsx}',
        'src/shared/lib/**/*.ts',
        'src/shared/api/**/*.ts',
      ],
      exclude: [
        '**/*.d.ts',
        '**/index.ts',
        '**/*.test.{ts,tsx}',
        '**/__test-utils__/**',
        // shadcn primitives are presentational wrappers
        'src/components/ui/**',
        // pages are exercised by E2E
        '**/pages/**',
      ],
    },
  },
});
