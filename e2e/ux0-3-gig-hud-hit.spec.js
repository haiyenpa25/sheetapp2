// @ts-check
// e2e/ux0-3-gig-hud-hit.spec.js — UX0-3 Gig HUD non-overlapping rows & elementFromPoint hit test at 768 and 1180
const { test, expect } = require('@playwright/test');
const path = require('path');
const assertIsolatedRoot = require('./assert-isolated-root');

const ROOT = path.resolve(__dirname, '..');
const MARKER = assertIsolatedRoot(ROOT);
const BASE_URL = MARKER.baseURL.replace(/\/$/, '') + '/';

const VIEWPORTS = [
  { name: '768x1024', width: 768, height: 1024 },
  { name: '1180x820', width: 1180, height: 820 },
];

const HUD_BUTTON_IDS = [
  'btn-gig-trans-down',
  'btn-gig-trans-up',
  'btn-gig-view-toggle',
  'btn-gig-chordset',
  'btn-gig-prev-song',
  'btn-gig-next-song',
  'btn-gig-tools',
  'btn-gig-scroll-toggle',
  'btn-gig-zoom-out',
  'btn-gig-zoom-in',
  'btn-gig-exit',
];

test.describe('UX0-3 · Gig HUD hit-test & non-overlapping rows at 768 and 1180', () => {
  for (const vp of VIEWPORTS) {
    test(`Modern ${vp.name}: every visible HUD button receives elementFromPoint at its center and section strip does not overlap HUD`, async ({ page }) => {
      await page.addInitScript(() => {
        try {
          sessionStorage.setItem('sheetapp_guest_chosen', '1');
          localStorage.setItem('sheetapp_guest_toast_shown', '1');
        } catch (_) {}
      });

      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(`${BASE_URL}?song=thanh-ca-001&v=sheet`, { waitUntil: 'domcontentloaded' });
      await page.locator('#osmd-container svg').first().waitFor({ state: 'visible', timeout: 20000 });

      // Enter gig mode
      await page.locator('#btn-fullscreen').click();
      await expect(page.locator('body')).toHaveClass(/sheet-only-mode/);

      // Ensure HUD and section jump bar (if present) are visible and not faded
      await page.evaluate(() => {
        const hud = document.getElementById('gig-floating-hud');
        hud?.classList.remove('faded');
        const secBar = document.getElementById('section-jump-bar-container');
        if (secBar) {
          secBar.classList.remove('hidden', 'hud-faded');
          if (!secBar.querySelector('.section-chip')) {
            const list = secBar.querySelector('#section-jump-bar') || secBar;
            list.innerHTML = '<button class="section-chip" type="button">Câu 1</button><button class="section-chip" type="button">Điệp khúc</button>';
          }
        }
      });

      const report = await page.evaluate((btnIds) => {
        const occluded = [];
        for (const id of btnIds) {
          const el = document.getElementById(id);
          if (!el) {
            occluded.push({ id, reason: 'missing' });
            continue;
          }
          const cs = window.getComputedStyle(el);
          const r = el.getBoundingClientRect();
          if (cs.display === 'none' || cs.visibility === 'hidden' || r.width === 0 || r.height === 0) {
            occluded.push({ id, reason: 'hidden' });
            continue;
          }
          const cx = Math.round(r.left + r.width / 2);
          const cy = Math.round(r.top + r.height / 2);
          const hit = document.elementFromPoint(cx, cy);
          const hitOk = Boolean(hit && (hit === el || el.contains(hit) || hit.closest(`#${id}`) === el));
          if (!hitOk) {
            occluded.push({
              id,
              cx,
              cy,
              rect: { left: Math.round(r.left), top: Math.round(r.top), right: Math.round(r.right), bottom: Math.round(r.bottom) },
              hitId: hit?.id || '',
              hitClass: hit?.className || '',
              hitTag: hit?.tagName || '',
            });
          }
        }

        const infoEl = document.querySelector('#gig-floating-hud .gig-hud-info');
        const actionsEl = document.querySelector('#gig-floating-hud .gig-hud-actions');
        const secEl = document.getElementById('section-jump-bar-container');
        const rInfo = infoEl?.getBoundingClientRect();
        const rAct = actionsEl?.getBoundingClientRect();
        const rSec = secEl?.getBoundingClientRect();

        function rectsOverlap(a, b) {
          if (!a || !b || a.width === 0 || a.height === 0 || b.width === 0 || b.height === 0) return false;
          return a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1;
        }

        return {
          occluded,
          infoOverlapsActions: rectsOverlap(rInfo, rAct),
          secOverlapsActions: rectsOverlap(rSec, rAct),
          secOverlapsInfo: rectsOverlap(rSec, rInfo),
          secBelowActions: rSec && rAct ? rSec.top >= rAct.bottom - 2 : false,
          rects: {
            info: rInfo ? { left: Math.round(rInfo.left), top: Math.round(rInfo.top), right: Math.round(rInfo.right), bottom: Math.round(rInfo.bottom) } : null,
            actions: rAct ? { left: Math.round(rAct.left), top: Math.round(rAct.top), right: Math.round(rAct.right), bottom: Math.round(rAct.bottom) } : null,
            sec: rSec ? { left: Math.round(rSec.left), top: Math.round(rSec.top), right: Math.round(rSec.right), bottom: Math.round(rSec.bottom) } : null,
          },
        };
      }, HUD_BUTTON_IDS);

      expect(report.occluded, `${vp.name} occluded HUD buttons: ${JSON.stringify(report)}`).toEqual([]);
      expect(report.infoOverlapsActions, `${vp.name} gig-hud-info must not overlap gig-hud-actions`).toBe(false);
      expect(report.secOverlapsActions, `${vp.name} section-jump-bar must not overlap gig-hud-actions`).toBe(false);
      expect(report.secOverlapsInfo, `${vp.name} section-jump-bar must not overlap gig-hud-info`).toBe(false);
      expect(report.secBelowActions, `${vp.name} section-jump-bar must lie below HUD controls row`).toBe(true);
    });
  }
});
