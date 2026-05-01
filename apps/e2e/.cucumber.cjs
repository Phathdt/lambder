const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

// Cucumber-js config — runs Gherkin features against Playwright.
// CommonJS so cucumber-js can require() it without ESM hoops.
// Tunables (env):
//   E2E_PARALLEL  worker count for parallel scenarios (default 4).
//
// Each scenario gets its own browser context + freshly generated user via
// faker, so they don't collide on DB rows. Bump down on slow machines.
const parallel = Number.parseInt(process.env.E2E_PARALLEL ?? '4', 10);

module.exports = {
  default: {
    requireModule: ['ts-node/register', 'tsconfig-paths/register'],
    require: ['tests/features/**/*.steps.ts', 'tests/support/**/*.ts'],
    paths: ['tests/features/**/*.feature'],
    parallel,
    format: [
      process.env.CI ? 'progress' : 'progress-bar',
      'json:test-results/cucumber-report.json',
      'html:test-results/cucumber-report.html',
      'summary:test-results/summary.txt',
    ],
    publishQuiet: true,
  },
};
