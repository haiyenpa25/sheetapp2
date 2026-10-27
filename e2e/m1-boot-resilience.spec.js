// @ts-check
const { test, expect, devices } = require('@playwright/test');
const path = require('path');
const assertIsolatedRoot = require('./assert-isolated-root');

const ROOT = path.resolve(__dirname, '..');
const MARKER = assertIsolatedRoot(ROOT);
const BASE_URL = MARKER.baseURL.replace(/\/$/, '') + '/';

const DEVICE_PROFILES = [
  { key: 'pixel7', project: 'chromium', descriptor: devices['Pixel 7'] },
  { key: 'iphone13', project: 'webkit', descriptor: devices['iPhone 13'] },
  { key: 'ipadmini', project: 'webkit', descriptor: devices['iPad Mini'] },
];

const UIS = [
  { key: 'modern', path: '' },
  { key: 'classic', path: 'old/' },
];

test.describe('M1-2 · Watchdog hiển thị banner khi chặn app.js', () => {
  for (const dev of DEVICE_PROFILES) {
    for (const ui of UIS) {
      test(`M1-2 watchdog banner <= 9s: ${dev.key} - ${ui.key}`, async ({ browser }, testInfo) => {
        test.skip(testInfo.project.name !== dev.project, `Chạy ${dev.key} trên ${dev.project}`);
        test.setTimeout(30000);

        const context = await browser.newContext({
          ...dev.descriptor,
          baseURL: BASE_URL,
          serviceWorkers: 'block',
        });
        const page = await context.newPage();

        await page.route('**/app.js*', route => route.abort('failed'));

        const t0 = Date.now();
        await page.goto(BASE_URL + ui.path, { waitUntil: 'domcontentloaded', timeout: 15000 });

        const banner = page.locator('#boot-watchdog-banner');
        await banner.waitFor({ state: 'visible', timeout: 9000 });
        const elapsedMs = Date.now() - t0;

        const text = (await banner.textContent()) || '';
        expect(text).toContain('Ứng dụng chưa tải xong');
        expect(text).toContain('Tải lại');
        expect(elapsedMs).toBeLessThanOrEqual(9000);

        await context.close();
      });
    }
  }
});
