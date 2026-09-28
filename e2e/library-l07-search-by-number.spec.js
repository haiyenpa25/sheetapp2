// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * e2e/library-l07-search-by-number.spec.js
 *
 * Kiểm thử E2E cho Ticket L0-7 (ROADMAP 4):
 *  1. Gõ "123" + Enter -> mở bài thanh-ca-123 (XA XA TRÊN NGỌN NÚI).
 *  2. Gõ "#002" + Enter -> mở bài thanh-ca-002 (NGUYỀN TỤNG MỸ CHÚA LINH NĂNG).
 *  3. Tìm theo số bài lọc bài khớp chính xác lên vị trí đầu tiên (index 0).
 */

test.describe('Ticket L0-7: Search by Song Number and Enter to Open', () => {

  test.beforeEach(async ({ page }) => {
    test.setTimeout(60000);
    await page.addInitScript(() => {
      sessionStorage.setItem('sheetapp_guest_chosen', '1');
    });
  });

  test('1. Gõ "123" + Enter mở bài thanh-ca-123 và hiển thị nốt nhạc', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });

    // Đợi bài 001 sẵn sàng
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });
    await expect(page.locator('#song-title')).toContainText('HỠI THÁNH VƯƠNG, KÍP NGỰ LAI');

    const searchInput = page.locator('#search-input');
    await expect(searchInput).toBeVisible();

    // Điền "123" và nhấn Enter
    await searchInput.fill('123');
    await searchInput.press('Enter');

    // Kiểm tra URL đổi thành song=thanh-ca-123
    await expect(page).toHaveURL(/song=thanh-ca-123/, { timeout: 15000 });

    // Kiểm tra #song-title cập nhật thành bài 123
    const titleEl = page.locator('#song-title');
    await expect(titleEl).toContainText('XA XA TRÊN NGỌN NÚI', { timeout: 15000 });

    // Kiểm tra bản nhạc OSMD đã được render cho bài 123
    const osmdSvg = page.locator('#osmd-container svg').first();
    await expect(osmdSvg).toBeVisible({ timeout: 15000 });
  });

  test('2. Gõ "#002" + Enter mở bài thanh-ca-002', async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 820 });
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });

    const searchInput = page.locator('#search-input');
    await expect(searchInput).toBeVisible();

    // Gõ "#002" và nhấn Enter
    await searchInput.fill('#002');
    await searchInput.press('Enter');

    // Kiểm tra URL đổi sang thanh-ca-002
    await expect(page).toHaveURL(/song=thanh-ca-002/, { timeout: 15000 });
    await expect(page.locator('#song-title')).toContainText(/NGUY[ỆỀ]N TỤNG MỸ CHÚA LINH NĂNG/, { timeout: 15000 });

    // OSMD hiển thị
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 15000 });
  });

  test('3. Số bài khớp chính xác được xếp lên vị trí đầu tiên trong danh sách', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });

    const searchInput = page.locator('#search-input');
    await searchInput.fill('123');
    await searchInput.dispatchEvent('input');

    // Đợi item thanh-ca-123 xuất hiện trong danh sách
    const targetItem = page.locator('#song-list .song-item[data-id="thanh-ca-123"]');
    await expect(targetItem).toBeVisible({ timeout: 10000 });

    // Mục đầu tiên trong kết quả phải chính là thanh-ca-123
    const firstItem = page.locator('#song-list .song-item').first();
    await expect(firstItem).toHaveAttribute('data-id', 'thanh-ca-123');
  });

});
