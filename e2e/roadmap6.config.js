// Isolated browser components: no application server, sessions, or real storage.
const { defineConfig, devices } = require('@playwright/test');
module.exports = defineConfig({
  testDir: __dirname,
  testMatch: /library-tv.*\.spec\.js/,
  outputDir: '../test-results/roadmap6',
  workers: 1,
  reporter: 'list',
  use: { serviceWorkers: 'block' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], hasTouch: true } },
    { name: 'webkit', use: { ...devices['Desktop Safari'], hasTouch: true } },
  ],
});
