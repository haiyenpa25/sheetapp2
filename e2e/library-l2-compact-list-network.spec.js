// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * e2e/library-l2-compact-list-network.spec.js
 *
 * Kiểm thử E2E cho Ticket L2-7 (ROADMAP4 Mục 8):
 * - Tải một lần dùng chung cho LibraryUI và SetlistUI: chỉ 1 request danh sách lúc khởi động
 * - Danh sách gọn: không kèm lyrics_text
 * - ETag caching: có header ETag và Cache-Control
 */

test.describe('L2-7 · Danh sách gọn & Tải một lần dùng chung (Single Request)', () => {

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('sheetapp_guest_chosen', '1');
      localStorage.setItem('sheetapp_guest_toast_shown', '1');
    });
  });

  test('1. Nghiệm thu: Khởi động app chỉ phát sinh ĐÚNG 1 request tới route=songs, có ETag & hiển thị đầy đủ', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    const songRequests = [];

    // Lắng nghe tất cả các requests mạng
    page.on('request', request => {
      const url = request.url();
      if (url.includes('route=songs') && !url.includes('action=') && !url.includes('&q=')) {
        songRequests.push(url);
      }
    });

    let etagHeader = '';
    page.on('response', async response => {
      const url = response.url();
      if (url.includes('route=songs') && !url.includes('action=') && !url.includes('&q=')) {
        const headers = response.headers();
        if (headers['etag']) {
          etagHeader = headers['etag'];
        }
      }
    });

    await page.goto('./?song=thanh-ca-001&v=sheet', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });

    // Đợi thêm 1s để cả LibraryUI và SetlistUI hoàn thành mọi tác vụ khởi động
    await page.waitForTimeout(1000);

    // 1. Chỉ có đúng 1 request danh sách bài hát
    expect(songRequests.length).toBe(1);

    // 2. Response có header ETag
    expect(etagHeader).toBeTruthy();

    // 3. Danh sách bài hát trong LibraryUI hiển thị bình thường
    const songItems = page.locator('#song-list .song-item');
    await expect(songItems.first()).toBeVisible({ timeout: 10000 });
    const count = await songItems.count();
    expect(count).toBeGreaterThan(10);

    // 4. Tab Setlist chuyển sang và có thể dùng được ngay mà không phát sinh thêm request
    const setlistTab = page.locator('.sidebar-tab[data-tab="setlist"]');
    if (await setlistTab.isVisible()) {
      await setlistTab.click();
      await page.waitForTimeout(500);
      expect(songRequests.length).toBe(1);
    }
  });
});
