// @ts-check
// e2e/ux0-17-mobile-program-nav.spec.js — UX0-17 Phone 390px with active program bar has clickable prev/next song buttons not covered by #mobile-thumb-bar
const { test, expect } = require('@playwright/test');
const path = require('path');
const assertIsolatedRoot = require('./assert-isolated-root');

const ROOT = path.resolve(__dirname, '..');
const MARKER = assertIsolatedRoot(ROOT);
const BASE_URL = MARKER.baseURL.replace(/\/$/, '') + '/';

test.use({ serviceWorkers: 'block' });

test.describe('UX0-17 · Phone 390px with active setlist program bar keeps prev/next song buttons clickable', () => {
  test('390x844: #setlist-program-bar prev/next buttons are not covered by #mobile-thumb-bar and pass elementFromPoint', async ({ page }) => {
    await page.addInitScript(() => {
      try {
        sessionStorage.setItem('sheetapp_guest_chosen', '1');
        localStorage.setItem('sheetapp_guest_toast_shown', '1');
      } catch (_) {}
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE_URL}?song=thanh-ca-001&v=sheet`, { waitUntil: 'domcontentloaded' });
    await page.locator('#osmd-container svg').first().waitFor({ state: 'visible', timeout: 20000 });

    await page.evaluate(() => {
      const spBar = document.getElementById('setlist-program-bar');
      if (spBar) spBar.classList.remove('hidden');
      const prevBtn = /** @type {HTMLButtonElement|null} */ (document.getElementById('btn-sp-prev'));
      const nextBtn = /** @type {HTMLButtonElement|null} */ (document.getElementById('btn-sp-next'));
      if (prevBtn) prevBtn.disabled = false;
      if (nextBtn) nextBtn.disabled = false;
    });

    const hitCheck = await page.evaluate(() => {
      const checkBtn = (id) => {
        const btn = document.getElementById(id);
        if (!btn) return { id, exists: false, hit: false, hitId: null };
        const r = btn.getBoundingClientRect();
        const cx = Math.round(r.left + r.width / 2);
        const cy = Math.round(r.top + r.height / 2);
        const topEl = document.elementFromPoint(cx, cy);
        const hit = Boolean(topEl && (topEl === btn || btn.contains(topEl)));
        return {
          id,
          exists: true,
          hit,
          hitId: topEl ? (topEl.id || topEl.className || topEl.tagName) : null,
          rect: { top: Math.round(r.top), bottom: Math.round(r.bottom), width: Math.round(r.width), height: Math.round(r.height) },
        };
      };
      return {
        prev: checkBtn('btn-sp-prev'),
        next: checkBtn('btn-sp-next'),
      };
    });

    expect(hitCheck.prev.hit, `#btn-sp-prev must be clickable at center, got: ${JSON.stringify(hitCheck.prev)}`).toBe(true);
    expect(hitCheck.next.hit, `#btn-sp-next must be clickable at center, got: ${JSON.stringify(hitCheck.next)}`).toBe(true);
  });
});
