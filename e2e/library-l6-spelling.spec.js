// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * e2e/library-l6-spelling.spec.js
 *
 * Kiểm thử E2E cho Ticket L6-5 (ROADMAP4 Mục 8 - Nhóm L6):
 * - Rà soát chính tả tên bài (sửa "NGUYỀN" → "NGUYỆN" cho các bài 002, 035, 050, 138, 231, 232, 239).
 * - Sửa thiếu từ bài 234: "TA THEO Ý CHÚA CHƯA?".
 * - Chuẩn hóa khoảng trắng typography trước dấu câu (!, ?, ,, ;).
 * - Tìm kiếm bài hát qua Song Search với tiêu đề đã chuẩn hóa.
 */

test.describe('L6-5 · Chuẩn Hóa Chính Tả Tiêu Đề Bài Hát', () => {

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('sheetapp_guest_chosen', '1');
      localStorage.setItem('sheetapp_guest_toast_shown', '1');
    });
  });

  test('1. Bài 002 hiển thị tiêu đề chuẩn "NGUYỆN TỤNG MỸ CHÚA LINH NĂNG" (không còn NGUYỀN)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('./?song=thanh-ca-002&v=sheet', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });

    // Kiểm tra tiêu đề trên thanh thông tin bài hát
    const titleEl = page.locator('#si-title, .song-title, #song-title');
    await expect(titleEl.first()).toBeVisible({ timeout: 10000 });
    const titleText = await titleEl.first().innerText();

    expect(titleText).toContain('NGUYỆN');
    expect(titleText).not.toContain('NGUYỀN');
  });

  test('2. Tìm kiếm Thư viện theo từ khóa chuẩn "Nguyện tụng mỹ", "Theo ý Chúa", "Thánh linh chiếu ánh"', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('./?song=thanh-ca-001&v=sheet', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });

    // Đợi nạp danh sách bài hát
    await page.waitForFunction(() => {
      return window.LibraryUI && typeof window.LibraryUI.getSongs === 'function' && window.LibraryUI.getSongs().length > 50;
    }, { timeout: 15000 });

    const searchInput = page.locator('#search-input');
    await expect(searchInput).toBeVisible({ timeout: 5000 });

    // 2.1 Tìm kiếm "Nguyện tụng mỹ" -> Bài 002
    await searchInput.fill('Nguyện tụng mỹ');
    await page.waitForTimeout(400);

    const songItems002 = page.locator('.song-item, [data-song-id]');
    await expect(songItems002.first()).toBeVisible({ timeout: 5000 });
    const item002Text = await songItems002.first().innerText();
    expect(item002Text).toContain('NGUYỆN TỤNG MỸ');
    expect(item002Text).not.toContain('NGUYỀN');

    // 2.2 Tìm kiếm "Theo ý Chúa" -> Bài 234
    await searchInput.fill('Theo ý Chúa');
    await page.waitForTimeout(400);

    const songItems234 = page.locator('.song-item, [data-song-id]');
    await expect(songItems234.first()).toBeVisible({ timeout: 5000 });
    const item234Text = await songItems234.first().innerText();
    expect(item234Text).toContain('Ý CHÚA');

    // 2.3 Tìm kiếm "Thánh linh chiếu ánh" -> Bài 138
    await searchInput.fill('Thánh linh chiếu ánh');
    await page.waitForTimeout(400);

    const songItems138 = page.locator('.song-item, [data-song-id]');
    await expect(songItems138.first()).toBeVisible({ timeout: 5000 });
    const item138Text = await songItems138.first().innerText();
    expect(item138Text).toContain('NGUYỆN THÁNH LINH');
  });

  test('3. Bài 004 hiển thị tiêu đề chuẩn không có khoảng trắng thừa trước dấu chấm than', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('./?song=thanh-ca-004&v=sheet', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });

    const titleEl = page.locator('#si-title, .song-title, #song-title');
    await expect(titleEl.first()).toBeVisible({ timeout: 10000 });
    const titleText = await titleEl.first().innerText();

    expect(titleText).not.toContain(' !');
    expect(titleText).toContain('HA-LÊ-LU-GIA!');
  });

});
