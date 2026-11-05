// @ts-check
// e2e/ux0-13-lock-zoom.spec.js — UX0-13 Lock zoom button visible and clickable at 768 and 1366
const { test, expect } = require('@playwright/test');
const path = require('path');
const assertIsolatedRoot = require('./assert-isolated-root');

const ROOT = path.resolve(__dirname, '..');
const MARKER = assertIsolatedRoot(ROOT);
const BASE_URL = MARKER.baseURL.replace(/\/$/, '') + '/';

test.describe('UX0-13 · Lock zoom is visible and clickable at 768 and 1366', () => {
  for (const vp of [
    { width: 768, height: 1024, label: 'tablet-768' },
    { width: 1366, height: 768, label: 'desktop-1366' },
  ]) {
    test(`Modern ${vp.label}: #btn-lock-zoom is always visible on the toolbar and toggles zoom lock on click`, async ({ page }) => {
      await page.addInitScript(() => {
        try {
          sessionStorage.setItem('sheetapp_guest_chosen', '1');
          localStorage.setItem('sheetapp_guest_toast_shown', '1');
          localStorage.removeItem('sheetapp_zoom_locked');
        } catch (_) {}
      });

      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(`${BASE_URL}?song=thanh-ca-001&v=sheet`, { waitUntil: 'domcontentloaded' });
      await page.locator('#osmd-container svg').first().waitFor({ state: 'visible', timeout: 20000 });

      // RULE §5: Khóa zoom luôn hiện ngay trên thanh điều khiển, không nằm trong menu ⋯
      const lockBtn = page.locator('#btn-lock-zoom');
      await expect(lockBtn).toBeVisible();

      const beforeLock = await page.evaluate(() => localStorage.getItem('sheetapp_zoom_locked'));
      await lockBtn.click();
      const afterLock = await page.evaluate(() => localStorage.getItem('sheetapp_zoom_locked'));
      expect(afterLock).not.toBe(beforeLock);
    });
  }
});
