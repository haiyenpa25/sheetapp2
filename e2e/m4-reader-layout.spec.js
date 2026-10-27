// @ts-check
const { test, expect, devices } = require('@playwright/test');
const path = require('path');

const BASE_URL = process.env.SHEETAPP_E2E_BASE_URL || 'http://localhost:8922/sheetapp2/';

test.describe('M4-1 · Viewport viewport-fit=cover & safe-area-inset trên iPhone 13 WebKit', () => {
  test('M4-1 viewport-fit=cover on both UIs and safe-area-inset CSS rules', async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== 'webkit', 'M4-1 nghiệm thu trên iPhone 13 WebKit');
    test.setTimeout(40000);

    const context = await browser.newContext({
      ...devices['iPhone 13'],
      baseURL: BASE_URL,
      serviceWorkers: 'block',
    });
    const page = await context.newPage();
    await page.addInitScript(() => {
      try {
        sessionStorage.setItem('sheetapp_guest_chosen', '1');
        localStorage.setItem('sheetapp_guest_toast_shown', '1');
      } catch (_) {}
    });

    // 1. Modern UI
    await page.goto(BASE_URL + '?song=thanh-ca-001', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.locator('#osmd-container svg').first().waitFor({ state: 'attached', timeout: 15000 });

    const modernCheck = await page.evaluate(() => {
      const vp = document.querySelector('meta[name="viewport"]')?.getAttribute('content') || '';
      const sheets = Array.from(document.styleSheets);
      let hasSafeAreaToolbar = false;
      let hasSafeAreaBottom = false;
      for (const s of sheets) {
        try {
          for (const r of Array.from(s.cssRules || [])) {
            const txt = r.cssText || '';
            if (txt.includes('safe-area-inset') && (txt.includes('unified-toolbar') || txt.includes('.toolbar'))) {
              hasSafeAreaToolbar = true;
            }
            if (txt.includes('safe-area-inset') && (txt.includes('mobile-thumb-bar') || txt.includes('gig-floating-hud'))) {
              hasSafeAreaBottom = true;
            }
          }
        } catch (_) {}
      }
      const bar = document.getElementById('mobile-thumb-bar')?.getBoundingClientRect();
      return {
        vp,
        hasViewportFitCover: vp.includes('viewport-fit=cover'),
        hasSafeAreaToolbar,
        hasSafeAreaBottom,
        barVisible: Boolean(bar && bar.height >= 44 && bar.bottom <= window.innerHeight + 1),
      };
    });

    expect(modernCheck.hasViewportFitCover).toBe(true);
    expect(modernCheck.hasSafeAreaToolbar).toBe(true);
    expect(modernCheck.hasSafeAreaBottom).toBe(true);
    expect(modernCheck.barVisible).toBe(true);

    await page.screenshot({
      path: path.resolve(__dirname, '../docs/mobile-evidence/M4-1-iphone13-safe-area.png'),
      fullPage: false,
    });

    // 2. Classic UI
    await page.goto(BASE_URL + 'old/?song=thanh-ca-001', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.locator('#osmd-container svg').first().waitFor({ state: 'attached', timeout: 15000 });

    const classicCheck = await page.evaluate(() => {
      const vp = document.querySelector('meta[name="viewport"]')?.getAttribute('content') || '';
      const sheets = Array.from(document.styleSheets);
      let hasSafeAreaClassic = false;
      for (const s of sheets) {
        try {
          for (const r of Array.from(s.cssRules || [])) {
            const txt = r.cssText || '';
            if (txt.includes('safe-area-inset') && (txt.includes('.toolbar') || txt.includes('.page-bar'))) {
              hasSafeAreaClassic = true;
            }
          }
        } catch (_) {}
      }
      return {
        vp,
        hasViewportFitCover: vp.includes('viewport-fit=cover'),
        hasSafeAreaClassic,
      };
    });

    expect(classicCheck.hasViewportFitCover).toBe(true);
    expect(classicCheck.hasSafeAreaClassic).toBe(true);

    await context.close();
  });
});
