// @ts-check
// e2e/ux0-6-menu-mobile.spec.js — UX0-6 Mobile menu ⋯ layout (Modern & Classic at 390x844)
const { test, expect } = require('@playwright/test');
const path = require('path');
const assertIsolatedRoot = require('./assert-isolated-root');

const ROOT = path.resolve(__dirname, '..');
const MARKER = assertIsolatedRoot(ROOT);
const BASE_URL = MARKER.baseURL.replace(/\/$/, '') + '/';

test.describe('UX0-6 · Mobile menu ⋯ layout at 390x844 (Modern & Classic)', () => {
  test('Modern 390x844: zoom buttons >= 36px without text wrap, audio buttons spaced, #btn-menu-transpose-reset not covered by sticky footer', async ({ page }) => {
    await page.addInitScript(() => {
      try {
        sessionStorage.setItem('sheetapp_guest_chosen', '1');
        localStorage.setItem('sheetapp_guest_toast_shown', '1');
      } catch (_) {}
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE_URL}?song=thanh-ca-001&v=sheet`, { waitUntil: 'domcontentloaded' });
    await page.locator('#osmd-container svg').first().waitFor({ state: 'visible', timeout: 20000 });

    await page.locator('#btn-more-options').click();
    await expect(page.locator('#main-dropdown-menu')).toBeVisible();

    const metrics = await page.evaluate(() => {
      const rect = (id) => {
        const el = document.getElementById(id);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height, top: r.top, bottom: r.bottom, left: r.left, right: r.right };
      };
      const lockBtn = document.getElementById('btn-menu-lock-zoom');
      const lockStyle = lockBtn ? window.getComputedStyle(lockBtn) : null;

      const resetBtn = document.getElementById('btn-menu-transpose-reset');
      const resetRect = rect('btn-menu-transpose-reset');
      const footerEl = document.querySelector('#main-dropdown-menu .menu-sticky-footer');
      const footerRect = footerEl ? footerEl.getBoundingClientRect() : null;
      let resetHitOk = false;
      if (resetBtn && resetRect) {
        const cx = resetRect.left + resetRect.width / 2;
        const cy = resetRect.top + resetRect.height / 2;
        const topEl = document.elementFromPoint(cx, cy);
        resetHitOk = !!(topEl && (topEl === resetBtn || resetBtn.contains(topEl)));
      }

      return {
        zoomOut: rect('btn-menu-zoom-out'),
        zoomIn: rect('btn-menu-zoom-in'),
        lockZoom: rect('btn-menu-lock-zoom'),
        lockWhiteSpace: lockStyle ? lockStyle.whiteSpace : '',
        audioSettings: rect('btn-audio-settings'),
        satbBar: rect('btn-menu-satb-bar'),
        resetRect,
        footerRect: footerRect ? { top: footerRect.top, bottom: footerRect.bottom } : null,
        resetHitOk,
      };
    });

    expect(metrics.zoomOut?.height, 'Zoom - button height >= 36px').toBeGreaterThanOrEqual(36);
    expect(metrics.zoomIn?.height, 'Zoom + button height >= 36px').toBeGreaterThanOrEqual(36);
    expect(metrics.lockZoom?.height, 'Lock zoom button height >= 36px').toBeGreaterThanOrEqual(36);
    expect(metrics.lockZoom?.height, 'Lock zoom button does not wrap onto multiple tall lines').toBeLessThanOrEqual(48);
    expect(metrics.audioSettings?.height, 'Audio settings button height >= 36px').toBeGreaterThanOrEqual(36);
    expect(metrics.satbBar?.height, 'SATB bar button height >= 36px').toBeGreaterThanOrEqual(36);
    expect(
      (metrics.satbBar?.left ?? 0) - (metrics.audioSettings?.right ?? 0),
      'Gap between #btn-audio-settings and #btn-menu-satb-bar >= 4px'
    ).toBeGreaterThanOrEqual(4);
    expect(metrics.resetRect?.bottom, '#btn-menu-transpose-reset bottom is above sticky footer top').toBeLessThanOrEqual(metrics.footerRect?.top ?? 0);
    expect(metrics.resetHitOk, '#btn-menu-transpose-reset is clickable and not covered by sticky footer').toBe(true);
  });

  test('Classic 390x844: #main-dropdown-menu scrolls so #btn-switch-new-ui is fully within viewport and clickable even with all member items shown', async ({ page }) => {
    await page.addInitScript(() => {
      try {
        sessionStorage.setItem('sheetapp_guest_chosen', '1');
        localStorage.setItem('sheetapp_guest_toast_shown', '1');
      } catch (_) {}
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE_URL}old/?song=thanh-ca-001&v=sheet`, { waitUntil: 'domcontentloaded' });
    await page.locator('#osmd-container svg').first().waitFor({ state: 'visible', timeout: 20000 });

    // Enable member items so the menu has its full item count
    await page.evaluate(() => {
      document.body.classList.add('has-member-access');
      document.querySelectorAll('#main-dropdown-menu .btn-menu-item.hidden').forEach((el) => {
        if (el.id !== 'btn-stop-audio') el.classList.remove('hidden');
      });
    });

    await page.locator('#btn-more-options').click();
    await expect(page.locator('#main-dropdown-menu')).toBeVisible();

    const classicMenu = await page.evaluate(() => {
      const menu = document.getElementById('main-dropdown-menu');
      const btn = document.getElementById('btn-switch-new-ui');
      if (!menu || !btn) return null;
      menu.scrollTop = menu.scrollHeight;
      const r = btn.getBoundingClientRect();
      const mr = menu.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const topEl = document.elementFromPoint(cx, cy);
      return {
        btnTop: r.top,
        btnBottom: r.bottom,
        btnLeft: r.left,
        btnRight: r.right,
        btnHeight: r.height,
        menuBottom: mr.bottom,
        viewportHeight: window.innerHeight,
        viewportWidth: window.innerWidth,
        hitOk: !!(topEl && (topEl === btn || btn.contains(topEl))),
      };
    });

    expect(classicMenu).not.toBeNull();
    expect(classicMenu.menuBottom, 'Classic #main-dropdown-menu bottom fits within viewport').toBeLessThanOrEqual(classicMenu.viewportHeight);
    expect(classicMenu.btnHeight).toBeGreaterThanOrEqual(32);
    expect(classicMenu.btnBottom, '#btn-switch-new-ui bottom is inside viewport').toBeLessThanOrEqual(classicMenu.viewportHeight);
    expect(classicMenu.btnRight, '#btn-switch-new-ui right is inside viewport').toBeLessThanOrEqual(classicMenu.viewportWidth);
    expect(classicMenu.hitOk, '#btn-switch-new-ui is clickable via elementFromPoint').toBe(true);
  });
});
