// @ts-check
// e2e/ux0-5-zoom-sync.spec.js — UX0-5 Single zoom source of truth (Store) across Gig HUD and Menu
const { test, expect } = require('@playwright/test');
const path = require('path');
const assertIsolatedRoot = require('./assert-isolated-root');

const ROOT = path.resolve(__dirname, '..');
const MARKER = assertIsolatedRoot(ROOT);
const BASE_URL = MARKER.baseURL.replace(/\/$/, '') + '/';

test.describe('UX0-5 · Zoom labels read from Store and stay in sync between HUD and Menu', () => {
  test('Phone 390x844: initial zoom and changing zoom in Gig HUD or Menu ⋯ updates both labels to the exact same value', async ({ page }) => {
    await page.addInitScript(() => {
      try {
        sessionStorage.setItem('sheetapp_guest_chosen', '1');
        localStorage.setItem('sheetapp_guest_toast_shown', '1');
      } catch (_) {}
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE_URL}?song=thanh-ca-001&v=sheet`, { waitUntil: 'domcontentloaded' });
    await page.locator('#osmd-container svg').first().waitFor({ state: 'visible', timeout: 20000 });

    const initialLabels = await page.evaluate(() => {
      const storePct = `${Math.round((window.Store?.get?.('currentZoom') || 1) * 100)}%`;
      return {
        storePct,
        hudZoom: (document.getElementById('gig-hud-zoom')?.textContent || '').trim(),
        menuZoom: (document.getElementById('menu-zoom-val')?.textContent || '').trim(),
      };
    });

    expect(initialLabels.hudZoom, 'Initial HUD zoom matches Store').toBe(initialLabels.storePct);
    expect(initialLabels.menuZoom, 'Initial menu zoom matches HUD zoom and Store').toBe(initialLabels.hudZoom);

    // 1. Enter Gig mode and change zoom via HUD button (#btn-gig-zoom-in)
    await page.locator('#btn-mobile-gig').click();
    await expect(page.locator('body')).toHaveClass(/sheet-only-mode/);
    await page.locator('#btn-gig-zoom-in').click();

    const afterHudZoomIn = await page.evaluate(() => {
      const storePct = `${Math.round((window.Store?.get?.('currentZoom') || 1) * 100)}%`;
      return {
        storePct,
        hudZoom: (document.getElementById('gig-hud-zoom')?.textContent || '').trim(),
        menuZoom: (document.getElementById('menu-zoom-val')?.textContent || '').trim(),
      };
    });

    expect(afterHudZoomIn.hudZoom).toBe(afterHudZoomIn.storePct);
    expect(afterHudZoomIn.menuZoom, 'After HUD zoom-in, menu zoom matches HUD zoom').toBe(afterHudZoomIn.hudZoom);

    // 2. Exit Gig mode, open Menu ⋯ and change zoom via #btn-menu-zoom-in
    await page.locator('#btn-gig-exit').click();
    await page.locator('#btn-more-options').click();
    await page.locator('#btn-menu-zoom-in').click();

    const afterMenuZoomIn = await page.evaluate(() => {
      const storePct = `${Math.round((window.Store?.get?.('currentZoom') || 1) * 100)}%`;
      return {
        storePct,
        hudZoom: (document.getElementById('gig-hud-zoom')?.textContent || '').trim(),
        menuZoom: (document.getElementById('menu-zoom-val')?.textContent || '').trim(),
      };
    });

    expect(afterMenuZoomIn.menuZoom).toBe(afterMenuZoomIn.storePct);
    expect(afterMenuZoomIn.hudZoom, 'After Menu zoom-in, HUD zoom matches Menu zoom').toBe(afterMenuZoomIn.menuZoom);
  });
});
