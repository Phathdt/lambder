import { defineConfig, devices } from '@playwright/test';

const PORT = Number.parseInt(process.env.WEB_PORT ?? '3000', 10);
const BASE_URL = process.env.WEB_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './tests',
  outputDir: './test-results',
  fullyParallel: false, // mutate shared DB state — keep sequential for predictability
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: process.env.E2E_NO_WEB_SERVER
    ? undefined
    : {
        command: 'pnpm --filter web dev',
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
        cwd: '../..',
      },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
