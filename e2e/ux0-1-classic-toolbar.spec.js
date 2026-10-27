// @ts-check
// e2e/ux0-1-classic-toolbar.spec.js — UX0-1 Classic SafeStorage & Toolbar/Menu listener verification
const { test, expect } = require('@playwright/test');
const path = require('path');
const assertIsolatedRoot = require('./assert-isolated-root');

const ROOT = path.resolve(__dirname, '..');
const MARKER = assertIsolatedRoot(ROOT);
const BASE_URL = MARKER.baseURL.replace(/\/$/, '') + '/';

const VIEWPORTS = [
  { name: '390x844', width: 390, height: 844 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '1366x768', width: 1366, height: 768 },
];

test.describe('UX0-1 · Classic toolbar & menu ⋮ listeners at 390/768/1366', () => {
  for (const vp of VIEWPORTS) {
    test(`Classic ${vp.name}: 0 pageerror/console error, ⛶ enters gig, D toggles dark-mode, every ⋮ item has listener`, async ({ page }) => {
      const errors = [];
      page.on('pageerror', err => errors.push(`pageerror: ${err.message}`));
      page.on('console', msg => {
        if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
      });

      await page.addInitScript(() => {
        try {
          sessionStorage.setItem('sheetapp_guest_chosen', '1');
          localStorage.setItem('sheetapp_guest_toast_shown', '1');
        } catch (_) {}
        const origAdd = EventTarget.prototype.addEventListener;
        EventTarget.prototype.addEventListener = function (type, listener, options) {
          try {
            if (this && this instanceof Element) {
              if (!this.__ux0Listeners) this.__ux0Listeners = [];
              this.__ux0Listeners.push(type);
            }
          } catch (_) {}
          return origAdd.call(this, type, listener, options);
        };
      });

      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(`${BASE_URL}old/?song=thanh-ca-001&v=sheet`, { waitUntil: 'domcontentloaded' });
      await page.locator('#osmd-container svg').first().waitFor({ state: 'visible', timeout: 20000 });

      // 1. 0 pageerror and 0 console.error, 0 BootRunner failures
      const bootFailures = await page.evaluate(() => window.BootRunner?.getFailures?.() || []);
      expect(errors, `Classic ${vp.name} should have 0 pageerror/console.error`).toEqual([]);
      expect(bootFailures, `Classic ${vp.name} should have 0 BootRunner failures`).toEqual([]);

      // 2. Click ⛶ (#btn-fullscreen) -> enters gig (sheet-only-mode)
      await page.locator('#btn-fullscreen').click();
      const inGig = await page.evaluate(() => document.body.classList.contains('sheet-only-mode'));
      expect(inGig, `Classic ${vp.name} clicking #btn-fullscreen enters sheet-only-mode`).toBe(true);
      await page.keyboard.press('Escape');
      const exitedGig = await page.evaluate(() => !document.body.classList.contains('sheet-only-mode'));
      expect(exitedGig, `Classic ${vp.name} pressing Escape exits sheet-only-mode`).toBe(true);

      // 3. Press D -> toggles dark-mode
      const beforeDark = await page.evaluate(() => document.body.classList.contains('dark-mode'));
      await page.keyboard.press('d');
      const afterDark = await page.evaluate(() => document.body.classList.contains('dark-mode'));
      expect(afterDark, `Classic ${vp.name} pressing D toggles dark-mode`).toBe(!beforeDark);
      await page.keyboard.press('d');

      // 4. Every interactive item inside #main-dropdown-menu (⋮) has a listener
      const missingListeners = await page.evaluate(() => {
        const menu = document.getElementById('main-dropdown-menu');
        if (!menu) return ['missing #main-dropdown-menu'];
        const controls = Array.from(menu.querySelectorAll('button, select, a')).filter(
          el => el.id !== 'btn-dark-toggle' && el.getAttribute('aria-hidden') !== 'true'
        );
        return controls
          .filter(el => {
            const list = el.__ux0Listeners || [];
            return list.length === 0 && typeof el.onclick !== 'function';
          })
          .map(el => el.id || el.textContent?.trim() || el.tagName);
      });
      expect(missingListeners, `Classic ${vp.name} every item in ⋮ must have a listener`).toEqual([]);
    });
  }
});
