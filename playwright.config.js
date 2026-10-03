// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/**
 * playwright.config.js
 * Cấu hình Playwright E2E testing cho SheetApp2 (Ticket T04)
 */
module.exports = defineConfig({
  testDir: './e2e',
  globalSetup: require.resolve('./e2e/global-setup.js'),
  globalTeardown: require.resolve('./e2e/global-teardown.js'),
  timeout: 30 * 1000,
  expect: {
    timeout: 10000,
  },
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: process.env.SHEETAPP_E2E_BASE_URL || 'http://localhost/sheetapp2/',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
});
