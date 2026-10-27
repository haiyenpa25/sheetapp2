// @ts-check
// e2e/ux0-16-watchdog-4g.spec.js — UX0-16 No false #boot-watchdog-banner when song catalog takes 1.5s on 4G
const { test, expect } = require('@playwright/test');
const path = require('path');
const assertIsolatedRoot = require('./assert-isolated-root');

const ROOT = path.resolve(__dirname, '..');
const MARKER = assertIsolatedRoot(ROOT);
const BASE_URL = MARKER.baseURL.replace(/\/$/, '') + '/';

test.use({ serviceWorkers: 'block' });

test.describe('UX0-16 · Watchdog does not show false error banner when song catalog takes 1.5s to load', () => {
  for (const ui of [
    { name: 'Modern', url: `${BASE_URL}` },
    { name: 'Classic', url: `${BASE_URL}old/` },
  ]) {
    test(`${ui.name}: 1.5s catalog delay renders song list with zero #boot-watchdog-banner`, async ({ page }) => {
      await page.addInitScript(() => {
        try {
          sessionStorage.setItem('sheetapp_guest_chosen', '1');
          localStorage.setItem('sheetapp_guest_toast_shown', '1');
          localStorage.removeItem('sheetapp_songs_cache_v2');
        } catch (_) {}
      });

      await page.route('**/api/index.php?route=songs*', async (route) => {
        await new Promise((r) => setTimeout(r, 1500));
        await route.continue();
      });

      await page.goto(ui.url, { waitUntil: 'load' });
      await page.locator('#song-list .song-item').first().waitFor({ state: 'visible', timeout: 15000 });
      await page.waitForTimeout(300);

      await expect(page.locator('#boot-watchdog-banner')).toHaveCount(0);
    });
  }
});
