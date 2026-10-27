// @ts-check
const { test, expect, devices } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const assertIsolatedRoot = require('./assert-isolated-root');

const ROOT = path.resolve(__dirname, '..');
const MARKER = assertIsolatedRoot(ROOT);
const BASE_URL = MARKER.baseURL.replace(/\/$/, '') + '/';
const OSMD_LOCAL_FILE = path.join(ROOT, 'assets', 'js', 'vendor', 'opensheetmusicdisplay.min.js');

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

test.describe('M1-4 · Chặn OSMD local → danh sách vẫn hiện, mở bài nạp CDN qua loadWithFallback và vẽ được', () => {
  for (const dev of DEVICE_PROFILES) {
    for (const ui of UIS) {
      test(`M1-4 lazy OSMD + CDN fallback: ${dev.key} - ${ui.key}`, async ({ browser }, testInfo) => {
        test.skip(testInfo.project.name !== dev.project, `Chạy ${dev.key} trên ${dev.project}`);
        test.setTimeout(40000);

        const context = await browser.newContext({
          ...dev.descriptor,
          baseURL: BASE_URL,
          serviceWorkers: 'block',
        });
        const page = await context.newPage();

        await page.addInitScript(() => {
          try {
            sessionStorage.setItem('sheetapp_guest_chosen', '1');
            localStorage.setItem('sheetapp_guest_toast_shown', '1');
          } catch (_) {}
        });

        let localAborted = 0;
        let cdnFulfilled = 0;

        await page.route('**/assets/js/vendor/opensheetmusicdisplay.min.js*', async route => {
          localAborted++;
          await route.abort('failed');
        });

        await page.route('https://cdn.jsdelivr.net/npm/opensheetmusicdisplay@1.8.6/build/opensheetmusicdisplay.min.js*', async route => {
          cdnFulfilled++;
          await route.fulfill({
            status: 200,
            contentType: 'application/javascript',
            body: fs.readFileSync(OSMD_LOCAL_FILE),
          });
        });

        await page.goto(BASE_URL + ui.path, { waitUntil: 'domcontentloaded', timeout: 20000 });

        // 1. Danh sách bài vẫn hiện dù OSMD local bị chặn
        await page.locator('#song-list .song-item').first().waitFor({ state: 'attached', timeout: 10000 });
        const bootChecks = await page.evaluate(() => {
          const hasLoadWithFallback = typeof window.ScriptLoader?.loadWithFallback === 'function';
          const vendorScripts = Array.from(document.querySelectorAll('script[src*="vendor/"]')).map(s => s.getAttribute('src') || '');
          const allVendorsVersioned = vendorScripts.length > 0 && vendorScripts.every(src => src.includes('?v='));
          const songCount = document.querySelectorAll('#song-list .song-item').length;
          return { hasLoadWithFallback, allVendorsVersioned, songCount };
        });

        expect(bootChecks.hasLoadWithFallback).toBe(true);
        expect(bootChecks.allVendorsVersioned).toBe(true);
        expect(bootChecks.songCount).toBeGreaterThan(0);
        expect(localAborted).toBeGreaterThan(0);
        // Trước khi mở bài đầu tiên, CDN chưa được gọi (khởi tạo OSMD lười)
        expect(cdnFulfilled).toBe(0);

        // 2. Mở bài đầu tiên -> dùng CDN qua loadWithFallback và vẽ được SVG
        await page.evaluate(() => {
          const first = document.querySelector('#song-list .song-item');
          const id = first?.getAttribute('data-id') || 'thanh-ca-001';
          window.LibraryUI?.selectSong?.(id);
        });

        await page.locator('#osmd-container svg').first().waitFor({ state: 'attached', timeout: 15000 });
        const svgDrawn = await page.evaluate(() => {
          const svg = document.querySelector('#osmd-container svg');
          return Boolean(svg && Number(svg.getAttribute('width')) > 0 && svg.children.length > 0);
        });
        expect(svgDrawn).toBe(true);
        expect(cdnFulfilled).toBeGreaterThan(0);

        await context.close();
      });
    }
  }
});
