// @ts-check
// e2e/ux0-14-classic-missing-actions.spec.js — UX0-14 Restore 3 missing Classic actions in menu ⋮ & assert >= 1 visible entry point for core actions
const { test, expect } = require('@playwright/test');
const path = require('path');
const assertIsolatedRoot = require('./assert-isolated-root');

const ROOT = path.resolve(__dirname, '..');
const MARKER = assertIsolatedRoot(ROOT);
const BASE_URL = MARKER.baseURL.replace(/\/$/, '') + '/';

test.use({ serviceWorkers: 'block' });

test.describe('UX0-14 · Classic menu ⋮ includes delete chord set, clear all chords, and page navigation + M4-3 >= 1 check', () => {
  test('Classic UI: menu ⋮ exposes page navigation, and for member with custom set exposes delete set & clear all chords', async ({ page }) => {
    await page.addInitScript(() => {
      try {
        sessionStorage.setItem('sheetapp_guest_chosen', '1'); window.__swReloading = true;
        localStorage.setItem('sheetapp_guest_toast_shown', '1');
      } catch (_) {}
    });

    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto(`${BASE_URL}old/?song=thanh-ca-001&v=sheet`, { waitUntil: 'domcontentloaded' });
    await page.locator('#osmd-container svg').first().waitFor({ state: 'visible', timeout: 20000 });

    // Simulate authenticated member/admin selecting a custom chord set "BANHAT_A"
    await page.evaluate(async () => {
      if (window.Auth) {
        window.Auth.canEditChords = () => true;
        window.Auth.isAdmin = () => true;
        window.Auth.isLoggedIn = () => true;
      }
      document.body.classList.add('has-member-access');
      const sel = /** @type {HTMLSelectElement|null} */ (document.getElementById('chord-set-selector'));
      if (sel) {
        const opt = document.createElement('option');
        opt.value = 'BANHAT_A';
        opt.textContent = 'BANHAT_A';
        sel.appendChild(opt);
        sel.value = 'BANHAT_A';
      }
      await window.ChordCanvas?.switchSet?.('BANHAT_A');
    });

    await page.locator('#btn-more-options').click();
    await expect(page.locator('#main-dropdown-menu')).toBeVisible();

    await expect(page.locator('#menu-page-nav')).toBeVisible();
    await expect(page.locator('#menu-btn-page-prev')).toBeVisible();
    await expect(page.locator('#menu-page-indicator')).toBeVisible();
    await expect(page.locator('#menu-btn-page-next')).toBeVisible();
    await expect(page.locator('#menu-delete-chord-set')).toBeVisible();
    await expect(page.locator('#menu-clear-all-chords')).toBeVisible();

    // Verify clicking #menu-delete-chord-set invokes ChordCanvas.confirmDeleteSet
    const deleteTriggered = await page.evaluate(() => {
      let called = false;
      if (window.ChordCanvas) {
        window.ChordCanvas.confirmDeleteSet = async () => { called = true; };
      }
      document.getElementById('menu-delete-chord-set')?.click();
      return called;
    });
    expect(deleteTriggered, 'Clicking #menu-delete-chord-set invokes ChordCanvas.confirmDeleteSet').toBe(true);
  });

  test('M4-3 (>= 1 and <= 2): Every core reading action has >= 1 visible entry point at 390, 768, 1024, 1366 on both Modern and Classic', async ({ page }) => {
    await page.addInitScript(() => {
      try {
        sessionStorage.setItem('sheetapp_guest_chosen', '1'); window.__swReloading = true;
        localStorage.setItem('sheetapp_guest_toast_shown', '1');
      } catch (_) {}
    });

    for (const ui of [
      { name: 'Modern', url: `${BASE_URL}?song=thanh-ca-001&v=sheet`, isClassic: false },
      { name: 'Classic', url: `${BASE_URL}old/?song=thanh-ca-001&v=sheet`, isClassic: true },
    ]) {
      await page.goto(ui.url, { waitUntil: 'domcontentloaded' });
      await page.locator('#osmd-container svg').first().waitFor({ state: 'visible', timeout: 20000 });

      for (const width of [390, 768, 1024, 1366]) {
        await page.setViewportSize({ width, height: 800 });
        await page.evaluate(() => {
          document.getElementById('main-dropdown-menu')?.classList.remove('hidden');
        });

        const checkRes = await page.evaluate((isClassic) => { const m = document.getElementById('main-dropdown-menu'); if (m) { m.classList.remove('hidden'); m.style.animation = 'none'; m.style.opacity = '1'; }
          const isVis = (el) => {
            if (!el) return false;
            const s = getComputedStyle(el);
            if (s.display === 'none' || s.visibility === 'hidden' || parseFloat(s.opacity) === 0) return false;
            if (el.closest('.hidden') || el.closest('.d-none')) return false;
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.height > 0;
          };
          const groups = isClassic
            ? {
                prev_song: ['#btn-prev-song'],
                next_song: ['#btn-next-song'],
                zoom: ['#zoom-slider'],
                view_toggle: ['#btn-lyric-view'],
                transpose_reset: ['#transpose-display', '#btn-transpose-reset'],
                page_nav: ['#menu-page-nav', '#btn-page-prev'],
              }
            : {
                prev_song: ['#btn-prev-song', '#btn-mobile-prev-song', '#btn-sp-prev', '#btn-gig-sp-prev', '#btn-lc-prev'],
                next_song: ['#btn-next-song', '#btn-mobile-next-song', '#btn-sp-next', '#btn-gig-sp-next', '#btn-lc-next'],
                zoom_out: ['#btn-zoom-out', '#btn-menu-zoom-out', '#btn-gig-zoom-out'],
                zoom_in: ['#btn-zoom-in', '#btn-menu-zoom-in', '#btn-gig-zoom-in'],
                lock_zoom: ['#btn-lock-zoom', '#btn-menu-lock-zoom', '#btn-gig-lock-zoom'],
                view_toggle: ['#view-switch', '#btn-band-toggle', '#btn-mobile-view-toggle', '#btn-gig-view-toggle'],
                transpose_reset: ['#transpose-display', '#mobile-transpose-display', '#btn-transpose-reset', '#btn-menu-transpose-reset', '#btn-gig-trans-reset'],
              };
          const under1 = [];
          const over2 = [];
          for (const [action, selectors] of Object.entries(groups)) {
            const matched = [];
            for (const sel of selectors) {
              for (const el of document.querySelectorAll(sel)) {
                if (isVis(el)) matched.push(el.id || sel);
              }
            }
            if (matched.length < 1) under1.push(action);
            if (matched.length > 2) over2.push({ action, count: matched.length, matched });
          }
          return { under1, over2 };
        }, ui.isClassic);

        expect(checkRes.under1, `${ui.name} @ ${width}px: every core action has >= 1 visible button`).toEqual([]);
        expect(checkRes.over2, `${ui.name} @ ${width}px: no core action has > 2 visible buttons`).toEqual([]);
      }
    }
  });
});
