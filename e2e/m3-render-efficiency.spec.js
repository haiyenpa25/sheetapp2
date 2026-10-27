// @ts-check
const { test, expect, devices } = require('@playwright/test');

const BASE_URL = process.env.SHEETAPP_E2E_BASE_URL || 'http://localhost:8922/sheetapp2/';

const DEVICES = [
  { id: 'pixel7', project: 'chromium', descriptor: devices['Pixel 7'], rotated: { width: 915, height: 412 } },
  { id: 'iphone13', project: 'webkit', descriptor: devices['iPhone 13'], rotated: { width: 844, height: 390 } },
  { id: 'ipadmini', project: 'webkit', descriptor: devices['iPad Mini'], rotated: { width: 1024, height: 768 } },
];

test.describe('M3-2 · Classic mở bài vẽ đúng 1 lần, xoay máy vẽ đúng 1 lần', () => {
  for (const dev of DEVICES) {
    test(`M3-2 classic single render on open and rotate: ${dev.id}`, async ({ browser }, testInfo) => {
      test.skip(testInfo.project.name !== dev.project, `Chỉ chạy ${dev.id} trên ${dev.project}`);
      test.setTimeout(40000);

      const context = await browser.newContext({
        ...dev.descriptor,
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

      await page.goto(BASE_URL + 'old/?song=thanh-ca-001', { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.locator('#osmd-container svg').first().waitFor({ state: 'attached', timeout: 15000 });
      await page.waitForTimeout(450);

      const openRenders = await page.evaluate(() => window.OSMDRenderer?.getRenderCount?.() ?? -1);
      expect(openRenders).toBe(1);

      await page.evaluate(() => window.OSMDRenderer?.resetRenderCount?.());
      await page.setViewportSize(dev.rotated);
      await page.waitForTimeout(650);

      const rotateRenders = await page.evaluate(() => window.OSMDRenderer?.getRenderCount?.() ?? -1);
      expect(rotateRenders).toBe(1);

      await context.close();
    });
  }
});

test.describe('M3-3 · Điện thoại mặc định theo Q-M2; mở Lời = 0 lần vẽ OSMD, chuyển Bản nhạc = 1 lần', () => {
  for (const ui of [{ id: 'modern', path: '' }, { id: 'classic', path: 'old/' }]) {
    test(`M3-3 390 lyric 0 renders then sheet 1 render + Q-M2 defaults: ${ui.id}`, async ({ browser }, testInfo) => {
      test.skip(testInfo.project.name !== 'webkit', 'M3-3 nghiệm thu trên 390 (iPhone 13 WebKit)');
      test.setTimeout(45000);

      // 1. Khách mặc định trên 390 -> mở Bản nhạc (Q-M2)
      const guestCtx = await browser.newContext({
        ...devices['iPhone 13'],
        baseURL: BASE_URL,
        serviceWorkers: 'block',
      });
      const guestPage = await guestCtx.newPage();
      await guestPage.addInitScript(() => {
        try {
          sessionStorage.setItem('sheetapp_guest_chosen', '1');
          localStorage.setItem('sheetapp_guest_toast_shown', '1');
        } catch (_) {}
      });
      await guestPage.goto(BASE_URL + ui.path + '?song=thanh-ca-001', { waitUntil: 'domcontentloaded', timeout: 20000 });
      await guestPage.locator('#osmd-container svg').first().waitFor({ state: 'attached', timeout: 15000 });
      const guestState = await guestPage.evaluate(() => ({
        lyricHidden: document.getElementById('lyric-view-container')?.classList.contains('hidden') ?? true,
        renders: window.OSMDRenderer?.getRenderCount?.() ?? -1,
      }));
      expect(guestState.lyricHidden).toBe(true);
      expect(guestState.renders).toBe(1);
      await guestCtx.close();

      // 2. Ban Hát mặc định trên 390 -> mở Lời với 0 lần vẽ OSMD; chuyển sang Bản nhạc -> đúng 1 lần vẽ OSMD
      const vocalCtx = await browser.newContext({
        ...devices['iPhone 13'],
        baseURL: BASE_URL,
        serviceWorkers: 'block',
      });
      const vocalPage = await vocalCtx.newPage();
      await vocalPage.addInitScript(() => {
        try {
          sessionStorage.setItem('sheetapp_guest_chosen', '1');
          localStorage.setItem('sheetapp_guest_toast_shown', '1');
          localStorage.setItem('sheetapp_instrument_role', 'vocals');
        } catch (_) {}
      });
      await vocalPage.goto(BASE_URL + ui.path + '?song=thanh-ca-001', { waitUntil: 'domcontentloaded', timeout: 20000 });
      await vocalPage.waitForFunction(() => {
        const lyr = document.getElementById('lyric-view-container');
        return lyr && !lyr.classList.contains('hidden') && lyr.textContent.trim().length > 0;
      }, { timeout: 15000 });
      await vocalPage.waitForTimeout(350);

      const lyricRenders = await vocalPage.evaluate(() => window.OSMDRenderer?.getRenderCount?.() ?? -1);
      expect(lyricRenders).toBe(0);

      // Chuyển sang Bản nhạc
      await vocalPage.evaluate(() => {
        const btn = document.getElementById('btn-view-sheet')
          || document.getElementById('btn-band-toggle')
          || document.getElementById('btn-toggle-view')
          || document.getElementById('btn-lyric-view');
        btn?.click();
      });
      await vocalPage.locator('#osmd-container svg').first().waitFor({ state: 'attached', timeout: 15000 });
      await vocalPage.waitForTimeout(450);

      const afterSwitch = await vocalPage.evaluate(() => ({
        renders: window.OSMDRenderer?.getRenderCount?.() ?? -1,
        savedMode: localStorage.getItem('sheetapp_view_mode'),
      }));
      expect(afterSwitch.renders).toBe(1);
      expect(afterSwitch.savedMode).toBe('sheet');

      await vocalCtx.close();
    });
  }
});
