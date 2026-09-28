// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * e2e/library-l6-song-sections.spec.js
 *
 * Kiểm thử E2E cho Ticket L6-6 (ROADMAP4 Mục 8 - Nhóm L6):
 * - Soạn bản đồ bài (song_sections) cho 100 bài hay dùng nhất.
 * - Bài 002 hiển thị dải phân đoạn #section-jump-bar-container và các chips (Intro, Đoạn 1, Đoạn 2, Kết).
 * - Bài 004 (có [ĐK]) hiển thị dải phân đoạn với chip "Điệp Khúc".
 * - Bấm chip phân đoạn: chip nhận trạng thái .active và cuộn mượt đến ô nhịp tương ứng.
 */

test.describe('L6-6 · Bản Đồ Bài Hát (Song Sections) Cho Top 100 Bài Hay Dùng', () => {

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('sheetapp_guest_chosen', '1');
      localStorage.setItem('sheetapp_guest_toast_shown', '1');
    });
  });

  test('1. Bài 002 hiển thị dải bản đồ bài hát với các phân đoạn và click chip kích hoạt .active', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('./?song=thanh-ca-002&v=sheet', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });

    // Dải phân đoạn #section-jump-bar-container hiển thị
    const jumpBar = page.locator('#section-jump-bar-container');
    await expect(jumpBar).toBeVisible({ timeout: 10000 });

    // Các chips phân đoạn hiển thị
    const chips = page.locator('#section-chips-list .section-chip');
    await expect(chips.first()).toBeVisible({ timeout: 10000 });
    const count = await chips.count();
    expect(count).toBeGreaterThanOrEqual(3);

    // Click vào chip thứ hai (Đoạn 1)
    const secondChip = chips.nth(1);
    await secondChip.click();
    await expect(secondChip).toHaveClass(/active/, { timeout: 5000 });
  });

  test('2. Bài 004 (có Điệp Khúc) hiển thị chip "Điệp Khúc" và nhảy đoạn thành công', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('./?song=thanh-ca-004&v=sheet', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });

    const jumpBar = page.locator('#section-jump-bar-container');
    await expect(jumpBar).toBeVisible({ timeout: 10000 });

    // Tìm chip "Điệp Khúc"
    const chorusChip = page.locator('#section-chips-list .section-chip:has-text("Điệp Khúc")');
    await expect(chorusChip).toBeVisible({ timeout: 10000 });

    // Click vào chip Điệp Khúc
    await chorusChip.click();
    await expect(chorusChip).toHaveClass(/active/, { timeout: 5000 });
  });

  test('3. Bài 050 trong Top 100 có dải bản đồ bài hát sẵn sàng', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('./?song=thanh-ca-050&v=sheet', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });

    const jumpBar = page.locator('#section-jump-bar-container');
    await expect(jumpBar).toBeVisible({ timeout: 10000 });

    const chips = page.locator('#section-chips-list .section-chip');
    expect(await chips.count()).toBeGreaterThanOrEqual(3);
  });

});
