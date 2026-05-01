const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

// Cucumber-js config — runs Gherkin features against Playwright.
// CommonJS so cucumber-js can require() it without ESM hoops.
module.exports = {
  default: {
    requireModule: ['ts-node/register', 'tsconfig-paths/register'],
    require: ['tests/features/**/*.steps.ts', 'tests/support/**/*.ts'],
    paths: ['tests/features/**/*.feature'],
    format: [
      process.env.CI ? 'progress' : 'progress-bar',
      'json:test-results/cucumber-report.json',
      'summary:test-results/summary.txt',
    ],
    publishQuiet: true,
  },
};
