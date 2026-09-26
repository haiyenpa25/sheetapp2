// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * e2e/library-l0-search-number.spec.js
 *
 * Kiểm thử E2E cho Ticket L0-7 (ROADMAP 4):
 * Tìm theo số bài hát:
 *  - Chuỗi toàn chữ số (ví dụ: "123") lọc đúng bài 123 lên vị trí đầu tiên.
 *  - Chuỗi có dấu thăng (ví dụ: "#123", "#045") lọc đúng bài lên vị trí đầu tiên.
 *  - Phím Enter mở kết quả đầu tiên (mở bài `thanh-ca-123`).
 *
 * Nghiệm thu:
 *  - E2E: gõ "123" + Enter → mở `thanh-ca-123`.
 *  - E2E: gõ "#045" + Enter → mở `thanh-ca-045`.
 */

test.describe('Ticket L0-7: Tìm theo số bài và Enter mở kết quả đầu tiên', () => {

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('sheetapp_guest_chosen', '1');
    });
  });

  test('1. Gõ "123" + Enter: mở bài thanh-ca-123 ("XA XA TRÊN NGỌN NÚI")', async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 820 });
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });

    // Chờ bài hát ban đầu nạp xong
    const osmdSvg = page.locator('#osmd-container svg').first();
    await expect(osmdSvg).toBeVisible({ timeout: 25000 });

    const searchInput = page.locator('#search-input');
    await expect(searchInput).toBeVisible();

    // Điền "123" vào ô tìm kiếm
    await searchInput.fill('123');

    // Chờ danh sách lọc kết quả và kiểm tra item đầu tiên là bài 123
    const firstSongItem = page.locator('#song-list .song-item').first();
    await expect(firstSongItem).toBeVisible({ timeout: 10000 });
    await expect(firstSongItem).toHaveAttribute('data-id', 'thanh-ca-123');

    // Bấm phím Enter
    await searchInput.press('Enter');

    // Xác nhận URL được cập nhật thành song=thanh-ca-123
    await page.waitForFunction(() => {
      const url = new URL(window.location.href);
      return url.searchParams.get('song') === 'thanh-ca-123';
    }, { timeout: 10000 });

    // Xác nhận bài hát 123 được nạp thành công
    await expect(page.locator('.song-item.active')).toHaveAttribute('data-id', 'thanh-ca-123');
  });

  test('2. Gõ "#045" + Enter: mở bài thanh-ca-045', async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 820 });
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });

    const osmdSvg = page.locator('#osmd-container svg').first();
    await expect(osmdSvg).toBeVisible({ timeout: 25000 });

    const searchInput = page.locator('#search-input');
    await searchInput.fill('#045');

    // Chờ kết quả đầu tiên là bài 045
    const firstSongItem = page.locator('#song-list .song-item').first();
    await expect(firstSongItem).toBeVisible({ timeout: 10000 });
    await expect(firstSongItem).toHaveAttribute('data-id', 'thanh-ca-045');

    // Bấm Enter
    await searchInput.press('Enter');

    // Xác nhận URL cập nhật thành song=thanh-ca-045
    await page.waitForFunction(() => {
      const url = new URL(window.location.href);
      return url.searchParams.get('song') === 'thanh-ca-045';
    }, { timeout: 10000 });

    await expect(page.locator('.song-item.active')).toHaveAttribute('data-id', 'thanh-ca-045');
  });

});
