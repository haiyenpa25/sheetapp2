// @ts-check
// e2e/ux0-4-classic-permissions.spec.js — UX0-4 Classic hides permission-restricted items for guests/viewers
const { test, expect } = require('@playwright/test');
const path = require('path');
const assertIsolatedRoot = require('./assert-isolated-root');

const ROOT = path.resolve(__dirname, '..');
const MARKER = assertIsolatedRoot(ROOT);
const BASE_URL = MARKER.baseURL.replace(/\/$/, '') + '/';

test.describe('UX0-4 · Classic hides restricted controls for guests/viewers', () => {
  test('Classic guest does not see Nhập/Sửa hợp âm, Tạo bộ hợp âm mới, Nhật ký biểu diễn, or ✎ Gõ ChordPro', async ({ page }) => {
    await page.addInitScript(() => {
      try {
        sessionStorage.setItem('sheetapp_guest_chosen', '1');
        localStorage.setItem('sheetapp_guest_toast_shown', '1');
      } catch (_) {}
    });

    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto(`${BASE_URL}old/?song=thanh-ca-001&v=sheet`, { waitUntil: 'domcontentloaded' });
    await page.locator('#osmd-container svg').first().waitFor({ state: 'visible', timeout: 20000 });

    // Open menu ⋮
    await page.locator('#btn-more-options').click();
    await expect(page.locator('#main-dropdown-menu')).toBeVisible();

    const menuVisibility = await page.evaluate(() => {
      const checkVis = (id) => {
        const el = document.getElementById(id);
        if (!el) return false;
        const cs = window.getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0;
      };
      return {
        canEditChordsFnExists: typeof window.Auth?.canEditChords === 'function',
        canEditChordsVal: Boolean(window.Auth?.canEditChords?.()),
        menuAddChordVisible: checkVis('menu-add-chord'),
        menuNewChordSetVisible: checkVis('menu-new-chord-set'),
        btnSessionPanelVisible: checkVis('btn-session-panel'),
      };
    });

    expect(menuVisibility.canEditChordsFnExists, 'Classic Auth.canEditChords() must exist').toBe(true);
    expect(menuVisibility.canEditChordsVal, 'Guest canEditChords() must be false').toBe(false);
    expect(menuVisibility.menuAddChordVisible, 'Guest must not see #menu-add-chord (Nhập / Sửa hợp âm)').toBe(false);
    expect(menuVisibility.menuNewChordSetVisible, 'Guest must not see #menu-new-chord-set (Tạo bộ hợp âm mới)').toBe(false);
    expect(menuVisibility.btnSessionPanelVisible, 'Guest must not see #btn-session-panel (Nhật ký biểu diễn)').toBe(false);

    // Switch to Lyric View and check .lv-edit-chordpro-btn ("✎ Gõ ChordPro")
    await page.locator('#btn-lyric-view').click();
    await expect(page.locator('#lyric-view-container')).toBeVisible();

    const visibleChordProBtns = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.lv-edit-chordpro-btn')).filter(el => {
        const cs = window.getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0;
      }).length;
    });
    expect(visibleChordProBtns, 'Guest must not see any .lv-edit-chordpro-btn on verses').toBe(0);
  });
});
