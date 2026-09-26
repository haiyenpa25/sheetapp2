// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * e2e/library-l0-key-enharmonics.spec.js
 *
 * Kiểm thử E2E cho Ticket L0-11 (ROADMAP 4):
 * Tên tông thống nhất:
 *  - Một hàm duy nhất KeyService.displayKey(fifths, semis) dùng cho cả 4 vị trí:
 *    1) Badge trên toolbar (#song-key)
 *    2) Chip trên thanh thông tin (#si-tone-chip)
 *    3) Chế độ xem chữ / Band view (.lv-key)
 *    4) Floating HUD trong chế độ Biểu Diễn (#gig-hud-key)
 *  - Tuân thủ quy tắc enharmonic thánh ca:
 *    + G + 1 = Ab (không phải G#)
 *    + Eb - 1 = D
 *    + 4 vị trí hiển thị giống nhau 100%
 */

test.describe('Ticket L0-11: Tên tông thống nhất & Enharmonics chuẩn', () => {

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('sheetapp_guest_chosen', '1');
    });
  });

  test('1. Bài gốc G + 1 bán cung: 4 vị trí đều hiển thị đồng nhất Ab', async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 820 });
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });

    const osmdSvg = page.locator('#osmd-container svg').first();
    await expect(osmdSvg).toBeVisible({ timeout: 25000 });

    const songKeyBadge = page.locator('#song-key');
    const toneChip = page.locator('#si-tone-chip');
    const gigHudKey = page.locator('#gig-hud-key');

    // Tông gốc bài 001 là G
    await expect(songKeyBadge).toHaveText('G');
    await expect(toneChip).toContainText('G');

    // Dịch tăng 1 bán cung: G + 1 -> Ab
    const btnTransUp = page.locator('#btn-transpose-up');
    await expect(btnTransUp).toBeEnabled({ timeout: 5000 });
    await btnTransUp.click();

    // 1) Kiểm tra Toolbar Badge
    await expect(songKeyBadge).toHaveText('Ab');

    // 2) Kiểm tra Thanh thông tin (Song Info Bar)
    await expect(toneChip).toContainText('Ab');
    await expect(toneChip).toContainText('(+1)');

    // 3) Kiểm tra Floating HUD trong chế độ Biểu Diễn
    await expect(gigHudKey).toHaveText('Ab');

    // 4) Kiểm tra Chế độ Band / Xem chữ
    const btnBand = page.locator('#btn-band-toggle, .btn-band-toggle').first();
    await btnBand.click();

    const lyricContainer = page.locator('#lyric-view-container');
    await expect(lyricContainer).toBeVisible({ timeout: 10000 });

    const lvKey = page.locator('.lv-key');
    await expect(lvKey).toBeVisible();
    await expect(lvKey).toContainText('Ab');
  });

  test('2. Bài gốc Eb - 1 bán cung: 4 vị trí đều hiển thị đồng nhất D', async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 820 });
    await page.goto('./?song=thanh-ca-004', { waitUntil: 'domcontentloaded' });

    const osmdSvg = page.locator('#osmd-container svg').first();
    await expect(osmdSvg).toBeVisible({ timeout: 25000 });

    const songKeyBadge = page.locator('#song-key');
    const toneChip = page.locator('#si-tone-chip');
    const gigHudKey = page.locator('#gig-hud-key');

    // Tông gốc bài 004 là Eb
    await expect(songKeyBadge).toHaveText('Eb');

    // Dịch giảm 1 bán cung: Eb - 1 -> D
    const btnTransDown = page.locator('#btn-transpose-down');
    await expect(btnTransDown).toBeEnabled({ timeout: 5000 });
    await btnTransDown.click();

    // 1) Toolbar Badge
    await expect(songKeyBadge).toHaveText('D');

    // 2) Thanh thông tin
    await expect(toneChip).toContainText('D');
    await expect(toneChip).toContainText('(-1)');

    // 3) HUD Biểu Diễn
    await expect(gigHudKey).toHaveText('D');

    // 4) Chế độ Band
    const btnBand = page.locator('#btn-band-toggle, .btn-band-toggle').first();
    await btnBand.click();

    const lyricContainer = page.locator('#lyric-view-container');
    await expect(lyricContainer).toBeVisible({ timeout: 10000 });

    const lvKey = page.locator('.lv-key');
    await expect(lvKey).toBeVisible();
    await expect(lvKey).toContainText('D');
  });

});
