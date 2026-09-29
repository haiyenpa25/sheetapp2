// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * e2e/library-r4-4-device-default.spec.js
 *
 * E2E test cho Ticket R4-4:
 * - Mặc định theo thiết bị (quyết định Q2):
 *   + Điện thoại: Lời & Hợp âm cho khách và Guitar/Hát; Bản nhạc cho Đàn phím.
 *   + Laptop/Desktop: Bản nhạc mặc định.
 * - Luôn ghi nhớ lựa chọn cá nhân: Đổi sang Nhạc, reload thì vẫn là Nhạc.
 */
test.use({ serviceWorkers: 'block' });

test.describe('R4-4 · Mặc định theo thiết bị & Ghi nhớ lựa chọn cá nhân', () => {

  test('1. Laptop mặc định mở chế độ Bản nhạc', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });

    const lyricView = page.locator('#lyric-view-container');
    await expect(lyricView).toBeHidden();
  });

  test('2. Chuyển sang Lời & Hợp âm, reload thì vẫn là Lời & Hợp âm (không bị reset)', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });

    // Bấm nút Lời & Hợp âm
    await page.locator('#btn-view-lyrics').click();
    await expect(page.locator('#lyric-view-container')).toBeVisible();

    // Reload trang
    await page.reload({ waitUntil: 'domcontentloaded' });

    // Chế độ Lời & Hợp âm vẫn được giữ nguyên
    await expect(page.locator('#lyric-view-container')).toBeVisible({ timeout: 25000 });
  });

  test('3. Đổi lại Bản nhạc, reload thì vẫn là Bản nhạc (không bị ép về Lời & Hợp âm)', async ({ page }) => {
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });

    // Bấm nút Bản nhạc
    await page.locator('#btn-view-sheet').click();
    await expect(page.locator('#lyric-view-container')).toBeHidden();

    // Reload trang
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });
    await expect(page.locator('#lyric-view-container')).toBeHidden();
  });

});
