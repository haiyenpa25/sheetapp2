// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * e2e/library-l6-lyrics-extraction-and-chorus.spec.js
 *
 * Kiểm thử E2E cho Ticket L6-1 (ROADMAP4 Mục 8 - Nhóm L6):
 * - Trích lời theo khổ đúng chuẩn: ghép âm tiết syllabic, tách khổ theo số
 * - Tách Điệp khúc [ĐK] thành khối độc lập
 * - Tìm kiếm lời theo câu trong Điệp khúc hiển thị đúng bài và đoạn trích [ĐK] có <mark>
 * - Tìm kiếm lời theo câu trong Khổ thơ hiển thị đoạn trích câu liền mạch có <mark>
 */

test.describe('L6-1 · Trích lời theo khổ & Tách Điệp khúc đúng chuẩn', () => {

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('sheetapp_guest_chosen', '1');
      localStorage.setItem('sheetapp_guest_toast_shown', '1');
    });
  });

  test('1. Nghiệm thu Điệp khúc: Tìm "chúng tôi tôn thờ đây" -> Bài 004 hiển thị, đoạn trích có tiền tố [ĐK] và <mark>', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('./?song=thanh-ca-001&v=sheet', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });

    const searchInput = page.locator('#search-input');
    await expect(searchInput).toBeVisible();

    // Gõ tìm kiếm cụm từ trong Điệp khúc bài 004 (không trùng với tiêu đề)
    await searchInput.fill('chúng tôi tôn thờ đây');

    // Chờ xuất hiện kết quả bài 004
    const song004Item = page.locator('#song-list .song-item').filter({ hasText: '004' }).first();
    await expect(song004Item).toBeVisible({ timeout: 15000 });

    // Kiểm tra snippet chứa [ĐK] và <mark>
    const snippetEl = song004Item.locator('.song-item-snippet');
    await expect(snippetEl).toBeVisible();
    const snippetHtml = await snippetEl.innerHTML();

    expect(snippetHtml).toContain('<mark>');
    expect(snippetHtml).toContain('[ĐK]');
  });

  test('2. Nghiệm thu Điệp khúc: Tìm "hong huyet luu ra" -> Bài 011 hiển thị và snippet chứa [ĐK]', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('./?song=thanh-ca-001&v=sheet', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });

    const searchInput = page.locator('#search-input');
    await expect(searchInput).toBeVisible();

    await searchInput.fill('hong huyet luu ra');

    const song011Item = page.locator('#song-list .song-item').filter({ hasText: '011' }).first();
    await expect(song011Item).toBeVisible({ timeout: 15000 });

    const snippetEl = song011Item.locator('.song-item-snippet');
    await expect(snippetEl).toBeVisible();
    const snippetHtml = await snippetEl.innerHTML();

    expect(snippetHtml).toContain('<mark>');
    expect(snippetHtml).toContain('[ĐK]');
  });

  test('3. Nghiệm thu Khổ thơ: Tìm "cúi xin vua thánh" -> Bài 001 hiển thị và snippet câu liền mạch', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('./?song=thanh-ca-004&v=sheet', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });

    const searchInput = page.locator('#search-input');
    await expect(searchInput).toBeVisible();

    await searchInput.fill('cúi xin vua thánh');

    const song001Item = page.locator('#song-list .song-item').filter({ hasText: '001' }).first();
    await expect(song001Item).toBeVisible({ timeout: 15000 });

    const snippetEl = song001Item.locator('.song-item-snippet');
    await expect(snippetEl).toBeVisible();
    const snippetHtml = await snippetEl.innerHTML();

    expect(snippetHtml).toContain('<mark>');
    expect(snippetHtml).toContain('Cúi xin Vua Thánh');
    // Bài 001 không có điệp khúc nên không có [ĐK]
    expect(snippetHtml).not.toContain('[ĐK]');
  });

});
