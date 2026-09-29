// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * e2e/library-l0-accented-sidebar.spec.js
 *
 * Kiểm thử E2E cho Ticket L0-13 (ROADMAP 4):
 * Tiếng Việt có dấu ở toàn bộ sidebar & đổi "Tone:" -> "Tông:".
 */

test.describe('Ticket L0-13: Tiếng Việt có dấu toàn bộ sidebar & Tông:', () => {

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('sheetapp_guest_chosen', '1');
    });
  });

  test('Kiểm tra văn bản tiếng Việt có dấu chuẩn trên sidebar và thanh thông tin', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 820 });
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });

    const osmdSvg = page.locator('#osmd-container svg').first();
    await expect(osmdSvg).toBeVisible({ timeout: 25000 });

    // 1) Tab "Kho Nhạc"
    const tabLib = page.locator('#sidebar-tab-lib');
    await expect(tabLib).toHaveText('Kho Nhạc');

    // 2) Tab Yêu thích có title "Bài hát yêu thích"
    const tabFavs = page.locator('#sidebar-tab-favs');
    await expect(tabFavs).toHaveAttribute('title', 'Bài hát yêu thích');

    // 3) Placeholder "Tìm bài hát..."
    const searchInput = page.locator('#search-input');
    await expect(searchInput).toHaveAttribute('placeholder', 'Tìm bài hát...');

    // 4) Nút tìm theo lời
    const btnLyrics = page.locator('#btn-search-lyrics');
    await expect(btnLyrics).toHaveAttribute('title', 'Tìm theo lời bài hát');

    // 5) Quick jump label "Nhảy nhanh:"
    const quickJumpLabel = page.locator('.quick-jump-label');
    await expect(quickJumpLabel).toHaveText('Nhảy nhanh:');

    // 6) Tông gốc hiển thị "Tông" (không phải "Tone") -- kể từ Ticket R1-3 (ROADMAP5),
    // #song-info-strip (chứa #si-tone-chip cũ) bị ẩn hẳn (display:none), thông tin
    // tông chuyển vào popover ⓘ (#song-info-popover, xem #si-pop-key).
    await page.locator('#btn-song-info-popover').click();
    const popover = page.locator('#song-info-popover');
    await expect(popover).toBeVisible();
    await expect(popover).toContainText('Tông');
    await expect(popover).not.toContainText('Tone:');
  });

});
