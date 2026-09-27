// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * e2e/library-l2-upcoming-setlist.spec.js
 *
 * Kiểm thử E2E cho Ticket L2-4 (ROADMAP4 Mục 8):
 * - Đầu danh sách: '📅 Chương trình hôm nay / sắp tới' (nếu có), 'Gần đây' (5 bài), 'Yêu thích'
 * - Nghiệm thu: E2E: có setlist ngày gần nhất thì khối này hiện đầu tiên
 * - Thao tác 1 chạm: Mở nhanh chương trình từ khối đầu danh sách
 * - Khối Yêu thích nhanh tự động cập nhật khi đánh dấu bài hát
 */

test.describe('L2-4 · Khối đầu danh sách: Chương trình sắp tới, Gần đây, Yêu thích', () => {

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('sheetapp_guest_chosen', '1');
      localStorage.setItem('sheetapp_guest_toast_shown', '1');
    });
  });

  test('1. Nghiệm thu: Có setlist ngày gần nhất thì khối này hiện ở vị trí ĐẦU TIÊN', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('./?song=thanh-ca-001&v=sheet', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });

    const upcomingSection = page.locator('#upcoming-setlist-section');
    await expect(upcomingSection).toBeVisible({ timeout: 15000 });

    // 1. Kiểm tra vị trí DOM: upcomingSection nằm trước #recently-viewed-section và #song-list
    const isFirstInSection = await page.evaluate(() => {
      const up = document.getElementById('upcoming-setlist-section');
      const recent = document.getElementById('recently-viewed-section');
      const list = document.getElementById('song-list');
      if (!up || !recent || !list) return false;
      const upBeforeRecent = (up.compareDocumentPosition(recent) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
      const upBeforeList = (up.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
      return upBeforeRecent && upBeforeList;
    });

    expect(isFirstInSection).toBe(true);

    // 2. Kiểm tra nội dung hiển thị trong thẻ chương trình sắp tới
    await expect(upcomingSection.locator('.upcoming-setlist-card')).toBeVisible();
    await expect(upcomingSection).toContainText(/Chương trình/i);
    await expect(upcomingSection.locator('.btn-play-upcoming')).toBeVisible();
  });

  test('2. Thao tác 1 chạm: Bấm nút "▶ Mở" trên thẻ chương trình sắp tới chuyển sang Setlist', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('./?song=thanh-ca-001&v=sheet', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });

    const upcomingSection = page.locator('#upcoming-setlist-section');
    await expect(upcomingSection).toBeVisible({ timeout: 15000 });

    const btnPlay = upcomingSection.locator('.btn-play-upcoming');
    await btnPlay.click();

    // Kiểm tra tab Setlist đã được kích hoạt
    const tabSetlist = page.locator('.sidebar-tab[data-tab="setlist"]');
    await expect(tabSetlist).toHaveClass(/active/);
  });

  test('3. Khối Yêu thích nhanh (#quick-favorites-section) tự động hiển thị khi có bài yêu thích', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('./?song=thanh-ca-001&v=sheet', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });

    // Ban đầu chưa có favorite -> quick-favorites-section bị ẩn
    const quickFavs = page.locator('#quick-favorites-section');
    await expect(quickFavs).toBeHidden();

    // Click nút yêu thích trên bài hát đầu tiên
    const firstFavBtn = page.locator('#song-list .song-item .song-fav-btn').first();
    await expect(firstFavBtn).toBeVisible();
    await firstFavBtn.click();

    // Sau khi thêm yêu thích -> quick-favorites-section xuất hiện
    await expect(quickFavs).toBeVisible({ timeout: 10000 });
    await expect(quickFavs).toContainText(/Yêu thích/i);
    const favItem = quickFavs.locator('.fav-item').first();
    await expect(favItem).toBeVisible();
  });
});
