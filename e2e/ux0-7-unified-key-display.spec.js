// @ts-check
// e2e/ux0-7-unified-key-display.spec.js — UX0-7 Unified key + transpose display across Modern 390 and 768
const { test, expect } = require('@playwright/test');
const path = require('path');
const assertIsolatedRoot = require('./assert-isolated-root');

const ROOT = path.resolve(__dirname, '..');
const MARKER = assertIsolatedRoot(ROOT);
const BASE_URL = MARKER.baseURL.replace(/\/$/, '') + '/';

test.describe('UX0-7 · Unified key display across Phone (390) and Tablet (768)', () => {
  test('Modern 390 and 768 show the exact same key string at transpose 0 ("G") and transpose +2 ("A (+2)")', async ({ page }) => {
    await page.addInitScript(() => {
      try {
        sessionStorage.setItem('sheetapp_guest_chosen', '1');
        localStorage.setItem('sheetapp_guest_toast_shown', '1');
      } catch (_) {}
    });

    // 1. Phone 390x844
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE_URL}?song=thanh-ca-001&v=sheet`, { waitUntil: 'domcontentloaded' });
    await page.locator('#osmd-container svg').first().waitFor({ state: 'visible', timeout: 20000 });

    const phoneInitial = ((await page.locator('#mobile-transpose-display').textContent()) || '').trim();
    expect(phoneInitial).toBe('G');

    await page.evaluate(() => window.Store?.set?.('transpose', 2));
    const phonePlus2 = ((await page.locator('#mobile-transpose-display').textContent()) || '').trim();
    expect(phonePlus2).toBe('A (+2)');

    // 2. Tablet 768x1024
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.evaluate(() => window.Store?.set?.('transpose', 0));
    const tabletInitial = ((await page.locator('#transpose-display').textContent()) || '').trim();
    expect(tabletInitial, 'Tablet at transpose 0 matches Phone at transpose 0').toBe(phoneInitial);

    await page.evaluate(() => window.Store?.set?.('transpose', 2));
    const tabletPlus2 = ((await page.locator('#transpose-display').textContent()) || '').trim();
    expect(tabletPlus2, 'Tablet at transpose +2 matches Phone at transpose +2').toBe(phonePlus2);
  });
});
