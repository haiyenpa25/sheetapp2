// Separate strict performance gate; no global setup, fixture users, or DB writes.
const { defineConfig } = require('@playwright/test');
const base = process.env.SHEETAPP_TV_TEST_URL;
if (!base) throw new Error('SHEETAPP_TV_TEST_URL must explicitly identify the isolated Apache copy');
module.exports = defineConfig({
  testDir: __dirname,
  testMatch: 'library-l5-performance-budget.spec.js',
  grep: /cold 4G load/,
  outputDir: '../test-results/roadmap6-performance',
  workers: 1,
  reporter: 'list',
  use: { baseURL: base.replace(/\/$/, '') + '/', serviceWorkers: 'block' },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
