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

test.describe('M4-2a · Modern Lớp 1 điện thoại: thanh dưới đủ 6 ô ≥ 44×44 + sheet chọn bộ hợp âm', () => {
  test('M4-2a 390 bottom bar 6 controls >=44x44 and chordset sheet selects non-HD/TLH set', async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== 'webkit', 'M4-2a nghiệm thu trên 390 (iPhone 13 WebKit)');
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

    // Giả lập API danh sách bộ hợp âm có thêm bộ NAM ngoài HD và default
    await page.route('**/*route=chord_sets*action=list*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, sets: ['HD', 'default', 'NAM'] }),
      });
    });
    await page.route('**/*route=chord_sets*action=load*set=NAM*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, chords: { '0_0': 'C', '1_0': 'G7' } }),
      });
    });

    await page.goto(BASE_URL + '?song=thanh-ca-001', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.locator('#osmd-container svg').first().waitFor({ state: 'attached', timeout: 15000 });

    const barCheck = await page.evaluate(() => {
      const ids = [
        'btn-mobile-transpose-down',
        'mobile-transpose-display',
        'btn-mobile-transpose-up',
        'btn-mobile-chordset',
        'btn-mobile-view-toggle',
        'btn-mobile-prev-song',
        'btn-mobile-next-song',
        'btn-mobile-gig',
      ];
      const rects = ids.map(id => {
        const el = document.getElementById(id);
        if (!el) return { id, missing: true, w: 0, h: 0, left: -1, right: 9999 };
        const r = el.getBoundingClientRect();
        return { id, missing: false, w: Math.round(r.width), h: Math.round(r.height), left: Math.round(r.left), right: Math.round(r.right) };
      });
      return {
        allExist: rects.every(r => !r.missing),
        allAtLeast44: rects.every(r => r.w >= 44 && r.h >= 44),
        outside: rects.filter(r => r.left < 0 || r.right > window.innerWidth + 1),
        rects,
      };
    });

    expect(barCheck.allExist).toBe(true);
    expect(barCheck.allAtLeast44).toBe(true);
    expect(barCheck.outside).toEqual([]);

    // Chạm nút Bộ hợp âm -> mở sheet chọn bộ hợp âm
    await page.locator('#btn-mobile-chordset').click();
    await page.locator('#mobile-chordset-sheet .mobile-chordset-option[data-set-value="NAM"]').waitFor({ state: 'visible', timeout: 5000 });

    const optRect = await page.locator('#mobile-chordset-sheet .mobile-chordset-option[data-set-value="NAM"]').boundingBox();
    expect(optRect && optRect.height >= 44).toBe(true);

    await page.locator('#mobile-chordset-sheet .mobile-chordset-option[data-set-value="NAM"]').click();
    await page.waitForTimeout(250);

    const activeSet = await page.evaluate(() => window.ChordCanvas?.getCurrentSet?.());
    expect(activeSet).toBe('NAM');

    await context.close();
  });
});

