// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * e2e/library-l2-lyrics-search.spec.js
 *
 * Kiểm thử E2E cho Ticket L2-6 (ROADMAP4 Mục 8):
 * - Tìm theo lời chính xác theo từng khổ (phụ thuộc L6-1)
 * - Đoạn trích là câu liền mạch có <mark>
 * - Nghiệm thu: Test: "cúi xin vua thánh" → bài 001, đoạn trích đúng câu
 * - Tìm kiếm không dấu: "cui xin vua thanh" → bài 001
 * - Tìm theo khổ 2: "đạo thể ngự lai" → bài 001
 */

test.describe('L2-6 · Tìm theo lời chính xác theo từng khổ & Đoạn trích đúng câu', () => {

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('sheetapp_guest_chosen', '1');
      localStorage.setItem('sheetapp_guest_toast_shown', '1');
    });
  });

  test('1. Nghiệm thu: Gõ "cúi xin vua thánh" -> Bài 001 hiển thị, đoạn trích câu liền mạch có <mark>', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('./?song=thanh-ca-001&v=sheet', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });

    const searchInput = page.locator('#search-input');
    await expect(searchInput).toBeVisible();

    // Nhập từ khóa tìm kiếm "cúi xin vua thánh"
    await searchInput.fill('cúi xin vua thánh');

    // Chờ xuất hiện kết quả
    const song001Item = page.locator('#song-list .song-item').filter({ hasText: '001' }).first();
    await expect(song001Item).toBeVisible({ timeout: 15000 });

    // Kiểm tra tên bài 001
    await expect(song001Item.locator('.song-item-title')).toContainText(/HỠI THÁNH VƯƠNG, KÍP NGỰ LAI/i);

    // Kiểm tra đoạn trích câu liền mạch có thẻ <mark>
    const snippetEl = song001Item.locator('.song-item-snippet');
    await expect(snippetEl).toBeVisible();
    const snippetHtml = await snippetEl.innerHTML();
    expect(snippetHtml).toContain('<mark>');
    expect(snippetHtml).toMatch(/<mark>Cúi xin Vua Thánh<\/mark>/i);
    expect(snippetHtml).toContain('ngự lai');
  });

  test('2. Tìm kiếm không dấu: Gõ "cui xin vua thanh" -> Bài 001 hiển thị & highlight đúng', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('./?song=thanh-ca-001&v=sheet', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });

    const searchInput = page.locator('#search-input');
    await searchInput.fill('cui xin vua thanh');

    const song001Item = page.locator('#song-list .song-item').filter({ hasText: '001' }).first();
    await expect(song001Item).toBeVisible({ timeout: 15000 });

    const snippetEl = song001Item.locator('.song-item-snippet');
    await expect(snippetEl).toBeVisible();
    const snippetHtml = await snippetEl.innerHTML();
    expect(snippetHtml).toContain('<mark>');
  });

  test('3. Tìm theo khổ 2: Gõ "đạo thể ngự lai" -> Bài 001 hiển thị & highlight đúng khổ 2', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('./?song=thanh-ca-001&v=sheet', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });

    const searchInput = page.locator('#search-input');
    await searchInput.fill('đạo thể ngự lai');

    const song001Item = page.locator('#song-list .song-item').filter({ hasText: '001' }).first();
    await expect(song001Item).toBeVisible({ timeout: 15000 });

    const snippetEl = song001Item.locator('.song-item-snippet');
    await expect(snippetEl).toBeVisible();
    const snippetHtml = await snippetEl.innerHTML();
    expect(snippetHtml).toContain('<mark>');
    expect(snippetHtml).toMatch(/<mark>Đạo thể ngự lai<\/mark>/i);
  });
});
