// @ts-check
// e2e/ux0-12-chord-load-error.spec.js — UX0-12 Block editing/saving chord set when chord_sets load fails
const { test, expect } = require('@playwright/test');
const path = require('path');
const assertIsolatedRoot = require('./assert-isolated-root');

const ROOT = path.resolve(__dirname, '..');
const MARKER = assertIsolatedRoot(ROOT);
const BASE_URL = MARKER.baseURL.replace(/\/$/, '') + '/';

test.describe('UX0-12 · Chord set load failure shows error toast and locks edit/save', () => {
  test('Blocking chord_sets load shows "Không tải được bộ hợp âm" and disables chord edit/save button', async ({ page }) => {
    await page.addInitScript(() => {
      try {
        sessionStorage.setItem('sheetapp_guest_chosen', '1');
        localStorage.setItem('sheetapp_guest_toast_shown', '1');
      } catch (_) {}
    });

    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto(`${BASE_URL}?song=thanh-ca-001&v=sheet`, { waitUntil: 'domcontentloaded' });
    await page.locator('#osmd-container svg').first().waitFor({ state: 'visible', timeout: 20000 });

    // Abort chord_sets load requests and trigger ChordCanvas.loadSong('thanh-ca-001', 'HD')
    await page.route('**/api/index.php*route=chord_sets*action=load*', (route) => route.abort('failed'));

    const state = await page.evaluate(async () => {
      const toasts = [];
      const origToast = window.App?.showToast;
      if (window.App) {
        window.App.showToast = (msg, type) => {
          toasts.push(String(msg));
          if (origToast) origToast.call(window.App, msg, type);
        };
      }
      await window.ChordCanvas?.loadSong?.('thanh-ca-001', 'HD');
      const editBarBtn = /** @type {HTMLButtonElement|null} */ (document.getElementById('btn-add-chord-mode-bar'));
      const editMenuBtn = /** @type {HTMLButtonElement|null} */ (document.getElementById('btn-menu-add-chord-mode'));
      return {
        toasts,
        hasLoadError: Boolean(window.ChordCanvasCore?.hasLoadError?.('thanh-ca-001', 'HD')),
        editBarDisabled: Boolean(editBarBtn?.disabled),
        editMenuDisabled: Boolean(editMenuBtn?.disabled),
      };
    });

    expect(state.toasts.some((m) => m.includes('Không tải được bộ hợp âm'))).toBe(true);
    expect(state.hasLoadError).toBe(true);
    expect(state.editBarDisabled, '#btn-add-chord-mode-bar is disabled when chord set load fails').toBe(true);
    expect(state.editMenuDisabled, '#btn-menu-add-chord-mode is disabled when chord set load fails').toBe(true);
  });
});
