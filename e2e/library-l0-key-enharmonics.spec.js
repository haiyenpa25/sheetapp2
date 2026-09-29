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

    // Ticket R1-3 (ROADMAP5): #si-tone-chip sống trong #song-info-strip đã bị ẩn hẳn --
    // thông tin tông đang tập giờ nằm trong popover ⓘ (#si-pop-practice-key).
    const songKeyBadge = page.locator('#song-key');
    const popoverBtn = page.locator('#btn-song-info-popover');
    const practiceKeyEl = page.locator('#si-pop-practice-key');
    const gigHudKey = page.locator('#gig-hud-key');

    // Tông gốc bài 001 là G
    await expect(songKeyBadge).toHaveText('G');
    await popoverBtn.click();
    await expect(practiceKeyEl).toContainText('G');
    await page.locator('#btn-close-song-info-popover').click();

    // Dịch tăng 1 bán cung: G + 1 -> Ab
    const btnTransUp = page.locator('#btn-transpose-up');
    await expect(btnTransUp).toBeEnabled({ timeout: 5000 });
    await btnTransUp.click();

    // 1) Kiểm tra Toolbar Badge
    await expect(songKeyBadge).toHaveText('Ab');

    // 2) Kiểm tra Thanh thông tin (popover ⓘ)
    await popoverBtn.click();
    await expect(practiceKeyEl).toContainText('Ab');
    await page.locator('#btn-close-song-info-popover').click();

    // 3) Kiểm tra Floating HUD trong chế độ Biểu Diễn
    await expect(gigHudKey).toHaveText('Ab');

    // 4) Kiểm tra Chế độ Band / Xem chữ (R1-2: công tắc #btn-view-lyrics)
    await page.locator('#btn-view-lyrics').click();

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
    const popoverBtn = page.locator('#btn-song-info-popover');
    const practiceKeyEl = page.locator('#si-pop-practice-key');
    const gigHudKey = page.locator('#gig-hud-key');

    // Tông gốc bài 004 là Eb
    await expect(songKeyBadge).toHaveText('Eb');

    // Dịch giảm 1 bán cung: Eb - 1 -> D
    const btnTransDown = page.locator('#btn-transpose-down');
    await expect(btnTransDown).toBeEnabled({ timeout: 5000 });
    await btnTransDown.click();

    // 1) Toolbar Badge
    await expect(songKeyBadge).toHaveText('D');

    // 2) Thanh thông tin (popover ⓘ -- xem ghi chú Ticket R1-3 ở test 1)
    await popoverBtn.click();
    await expect(practiceKeyEl).toContainText('D');
    await page.locator('#btn-close-song-info-popover').click();

    // 3) HUD Biểu Diễn
    await expect(gigHudKey).toHaveText('D');

    // 4) Chế độ Band (R1-2: công tắc #btn-view-lyrics)
    await page.locator('#btn-view-lyrics').click();

    const lyricContainer = page.locator('#lyric-view-container');
    await expect(lyricContainer).toBeVisible({ timeout: 10000 });

    const lvKey = page.locator('.lv-key');
    await expect(lvKey).toBeVisible();
    await expect(lvKey).toContainText('D');
  });

});
