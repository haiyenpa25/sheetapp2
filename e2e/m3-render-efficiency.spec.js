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
