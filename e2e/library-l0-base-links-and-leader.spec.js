// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * e2e/library-l0-base-links-and-leader.spec.js
 *
 * Kiểm thử E2E cho Ticket L0-14 (ROADMAP 4):
 *  - Link sang các trang khác dùng __APP_BASE__ (không bị 404 do root path tuyệt đối).
 *  - ChordCanvas.confirmDeleteSet tồn tại và hoạt động.
 *  - Frontend nhận diện role leader (window.Auth.isLeader).
 */

test.describe('Ticket L0-14: Base Links, confirmDeleteSet & Role Leader', () => {

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('sheetapp_guest_chosen', '1');
    });
  });

  test('1. Kiểm tra các liên kết phụ trợ không trỏ tuyệt đối sai đường dẫn gốc', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 820 });
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });

    const osmdSvg = page.locator('#osmd-container svg').first();
    await expect(osmdSvg).toBeVisible({ timeout: 25000 });

    // Lấy __APP_BASE__ từ trang
    const appBase = await page.evaluate(() => window.__APP_BASE__ || '');

    // Kể từ Ticket R4-1/App Shell (ROADMAP5), các liên kết Học Đàn/Live Band/Manager
    // chuyển vào thanh điều hướng 4 trụ cột (includes/app_nav.php) và không còn cố định
    // title tiếng Việt như bản cũ -- kiểm tra theo href (ổn định hơn, không phụ thuộc chữ).

    // Kiểm tra link Học đàn
    const linkLearn = page.locator('a[href*="learn/"]').first();
    const hrefLearn = await linkLearn.getAttribute('href');
    expect(hrefLearn).toContain('learn/');
    if (appBase) {
      expect(hrefLearn).toContain(appBase);
    }

    // Kiểm tra link Live Band
    const linkLive = page.locator('a[href*="live-band/"]').first();
    const hrefLive = await linkLive.getAttribute('href');
    expect(hrefLive).toContain('live-band/');
    if (appBase) {
      expect(hrefLive).toContain(appBase);
    }

    // Kiểm tra link Manager
    const linkManager = page.locator('a[href*="manager/"]').first();
    const hrefManager = await linkManager.getAttribute('href');
    expect(hrefManager).toContain('manager/');
    if (appBase) {
      expect(hrefManager).toContain(appBase);
    }
  });

  test('2. Kiểm tra ChordCanvas.confirmDeleteSet và Auth.isLeader', async ({ page }) => {
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });

    const results = await page.evaluate(() => {
      return {
        hasConfirmDeleteSet: typeof window.ChordCanvas?.confirmDeleteSet === 'function',
        hasIsLeader: typeof window.Auth?.isLeader === 'function',
        isLeaderViewer: window.Auth?.isLeader?.() === false
      };
    });

    expect(results.hasConfirmDeleteSet).toBe(true);
    expect(results.hasIsLeader).toBe(true);
    expect(results.isLeaderViewer).toBe(true);
  });

});
