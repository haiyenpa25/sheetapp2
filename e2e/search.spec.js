// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * E2E-05: search.spec.js
 * 
 * Nghiệm thu Ticket T06:
 * Mở trang chủ (/), gõ "chua" ở sidebar và thấy ≥1 kết quả, trong đó có thẻ <mark>.
 * Console sạch không có lỗi runtime.
 */

test.describe('E2E-05: Kiểm tra tìm kiếm FTS5 và thẻ highlight <mark> trên UI', () => {
  test('Gõ "chua" vào ô tìm kiếm sidebar, kết quả hiển thị bài hát và có thẻ <mark>', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];

    // Lắng nghe lỗi console
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!text.includes('favicon.ico')) {
          consoleErrors.push(text);
          console.error(`[Browser console.error] ${text}`);
        }
      }
    });

    page.on('pageerror', err => {
      const msg = err.message || String(err);
      pageErrors.push(msg);
      console.error(`[Browser pageerror] ${msg}`);
    });

    // 1. Mở trang chủ
    await page.goto('./', { waitUntil: 'domcontentloaded' });

    // Đóng auth-modal nếu có
    const closeAuthBtn = page.locator('#btn-close-auth');
    if (await closeAuthBtn.isVisible()) {
      await closeAuthBtn.click();
    }

    // 2. Chờ ô tìm kiếm #search-input sẵn sàng
    const searchInput = page.locator('#search-input');
    await expect(searchInput).toBeVisible({ timeout: 15000 });

    // Chờ danh sách ban đầu tải xong
    await expect(page.locator('#song-list .song-item').first()).toBeVisible({ timeout: 15000 });

    // 3. Gõ "chua" vào ô tìm kiếm
    await searchInput.fill('chua');
    await searchInput.dispatchEvent('input');

    // 4. Chờ debounce 200ms và kết quả tìm kiếm cập nhật
    await page.waitForTimeout(500);

    // 5. Kiểm tra kết quả hiển thị ≥1 bài hát
    const resultItems = page.locator('#song-list .song-item');
    await expect(resultItems.first()).toBeVisible({ timeout: 10000 });
    const count = await resultItems.count();
    expect(count).toBeGreaterThanOrEqual(1);

    // 6. Kiểm tra có ít nhất một thẻ <mark> xuất hiện trong danh sách kết quả
    const markTags = page.locator('#song-list .song-item mark');
    await expect(markTags.first()).toBeVisible({ timeout: 10000 });
    const markCount = await markTags.count();
    expect(markCount).toBeGreaterThanOrEqual(1);

    // 7. Console sạch không có lỗi
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });
});
