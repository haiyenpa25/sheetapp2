// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * e2e/library-l2-search-ranking.spec.js
 *
 * Kiểm thử E2E cho Ticket L2-1 (ROADMAP4 Mục 8):
 * - Xếp hạng tìm kiếm: số bài khớp chính xác > tên khớp đầu chuỗi > tên chứa từ > lời
 * - Phân nhóm kết quả: "Kết quả theo tên" và "Kết quả theo lời" thành 2 nhóm rõ ràng
 * - Nghiệm thu: Gõ "thanh tam" -> bài "THÀNH TÂM TÔN VUA THÁNH" (#6) đứng đầu
 */

test.describe('L2-1 · Xếp hạng tìm kiếm & Phân nhóm Kết quả theo Tên và Lời', () => {

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('sheetapp_guest_chosen', '1');
      localStorage.setItem('sheetapp_guest_toast_shown', '1');
    });
  });

  test('1. Nghiệm thu: Tìm "thanh tam" -> bài "THÀNH TÂM TÔN VUA THÁNH" (#6) đứng đầu & có 2 nhóm', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('./?song=thanh-ca-001&v=sheet', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });

    const searchInput = page.locator('#search-input');
    await expect(searchInput).toBeVisible();

    // Nhập từ khóa tìm kiếm "thanh tam"
    await searchInput.fill('thanh tam');

    // 1. Chờ xuất hiện 2 nhóm tiêu đề rõ ràng
    const titleHeader = page.locator('.search-group-header.search-group-title');
    await expect(titleHeader).toBeVisible({ timeout: 15000 });
    await expect(titleHeader).toContainText('Kết quả theo tên');

    const lyricHeader = page.locator('.search-group-header.search-group-lyric');
    await expect(lyricHeader).toBeVisible({ timeout: 15000 });
    await expect(lyricHeader).toContainText('Kết quả theo lời');

    // 2. Kiểm tra bài hát đầu tiên trong danh sách phải là #6 "THÀNH TÂM TÔN VUA THÁNH"
    const firstSongItem = page.locator('#song-list .song-item').first();
    await expect(firstSongItem).toBeVisible();
    await expect(firstSongItem.locator('.song-item-title')).toContainText(/THÀNH TÂM TÔN VUA THÁNH/i);
    await expect(firstSongItem.locator('.song-item-num')).toHaveText('006');

    // 3. Nhóm theo tên đứng trước nhóm theo lời trong danh sách
    const headerOrder = await page.evaluate(() => {
      const hTitle = document.querySelector('.search-group-header.search-group-title');
      const hLyric = document.querySelector('.search-group-header.search-group-lyric');
      if (!hTitle || !hLyric) return false;
      return (hTitle.compareDocumentPosition(hLyric) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
    });
    expect(headerOrder).toBe(true);

    // 4. Các bài trong nhóm theo lời có lyric snippet chứa highlight <mark>
    const firstLyricItem = page.locator('.search-group-lyric + .song-item').first();
    await expect(firstLyricItem).toBeVisible();
    const snippetEl = firstLyricItem.locator('.song-item-snippet');
    await expect(snippetEl).toBeVisible();
    const snippetHtml = await snippetEl.innerHTML();
    expect(snippetHtml).toContain('<mark>');
  });

  test('2. Tìm theo số bài: Gõ "123" -> Bài #123 đứng đầu tiên', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('./?song=thanh-ca-001&v=sheet', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });

    const searchInput = page.locator('#search-input');
    await searchInput.fill('123');

    const firstSongItem = page.locator('#song-list .song-item').first();
    await expect(firstSongItem.locator('.song-item-num')).toHaveText('123', { timeout: 15000 });

    // Thử tìm theo định dạng "#001"
    await searchInput.fill('#001');
    await expect(firstSongItem.locator('.song-item-num')).toHaveText('001', { timeout: 15000 });
  });

  test('3. Xóa ô tìm kiếm: Danh sách trở lại bình thường và không còn group headers', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('./?song=thanh-ca-001&v=sheet', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });

    const searchInput = page.locator('#search-input');
    await searchInput.fill('thanh tam');
    await page.waitForTimeout(400);
    await expect(page.locator('.search-group-header').first()).toBeVisible();

    // Xóa từ khóa
    await searchInput.fill('');
    await page.waitForTimeout(300);

    // Không còn tiêu đề nhóm tìm kiếm
    const groupHeadersCount = await page.locator('.search-group-header').count();
    expect(groupHeadersCount).toBe(0);
  });

});
