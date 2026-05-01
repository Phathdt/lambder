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
    setupFiles: ['./test/setup.ts'],
    include: ['test/**/*.test.{ts,tsx}', 'src/**/*.test.{ts,tsx}'],
    exclude: ['node_modules', 'dist', '.turbo'],
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
        // shadcn primitives are presentational wrappers
        'src/components/ui/**',
        // pages are exercised by E2E
        '**/pages/**',
      ],
    },
  },
});
