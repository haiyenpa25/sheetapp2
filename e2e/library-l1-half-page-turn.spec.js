// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * e2e/library-l1-half-page-turn.spec.js
 *
 * Kiểm thử E2E cho Ticket L1-9: Lật nửa trang (half-page turn, học từ forScore):
 * 1. Lật theo hàng nhạc: sau khi lật, không hàng nhạc nào bị cắt ở mép trên.
 * 2. Vạch chia nửa trang (#half-page-divider) hiển thị rõ ràng khi lật.
 * 3. Chuỗi lật tiếp theo (sequence) qua các bước nửa trang.
 * 4. Chuyển đổi giữa chế độ lật cả trang (full) và nửa trang (half).
 * 5. Chế độ Band: lật căn theo đỉnh khổ thơ (không cắt đôi khổ).
 */

test.describe('L1-9 · Lật nửa trang phong cách forScore (Half-Page Turn)', () => {

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('sheetapp_guest_chosen', '1');
      localStorage.setItem('sheetapp_guest_toast_shown', '1');
    });
  });

  test('1. Lật nửa trang trên iPad (1180x820): không hàng nhạc nào bị cắt ở mép trên', async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 820 });
    await page.goto('./?song=thanh-ca-001&v=sheet', { waitUntil: 'domcontentloaded' });

    // Đợi OSMD render xong và PageNav tính toán xong các hàng nhạc
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });
    await page.waitForFunction(() => (window.PageNav?.getSystems()?.length || 0) >= 5, { timeout: 10000 });
    await page.waitForTimeout(300);

    // Kiểm tra ban đầu ở trang 1, chế độ half
    const initStatus = await page.evaluate(() => {
      return {
        mode: window.PageNav?.getTurnMode(),
        currentPage: window.PageNav?.getCurrentPage(),
        totalPages: window.PageNav?.getTotalPages(),
        systemsCount: window.PageNav?.getSystems()?.length
      };
    });

    expect(initStatus.mode).toBe('half');
    expect(initStatus.currentPage).toBe(1);
    expect(initStatus.totalPages).toBeGreaterThan(1);
    expect(initStatus.systemsCount).toBeGreaterThan(1);

    // Bấm lật trang sau qua PageNav.goToNext()
    await page.evaluate(() => window.PageNav?.goToNext());
    await page.waitForTimeout(650);

    // Kiểm tra sau khi lật
    const afterTurn = await page.evaluate(() => {
      const wrap = document.querySelector('.sheet-viewer-wrapper');
      const scrollTop = wrap ? wrap.scrollTop : 0;
      const divider = document.getElementById('half-page-divider');
      const isCut = window.PageNav?.isAnySystemCutAtTop();
      const systems = window.PageNav?.getSystems() || [];

      // Kiểm tra thủ công tọa độ từng system
      let manualCut = false;
      for (const s of systems) {
        // Hàng bị cắt nếu mép trên cắt sâu vào thân hàng nhạc (> 40px)
        if (s.top < scrollTop - 12 && s.bottom > scrollTop + 40) {
          manualCut = true;
          break;
        }
      }

      return {
        currentPage: window.PageNav?.getCurrentPage(),
        scrollTop,
        dividerVisible: divider && !divider.classList.contains('hidden'),
        isAnySystemCutAtTop: isCut,
        manualCut
      };
    });

    // Trang tăng lên 2
    expect(afterTurn.currentPage).toBe(2);
    expect(afterTurn.scrollTop).toBeGreaterThan(0);
    // Vạch chia nửa trang xuất hiện
    expect(afterTurn.dividerVisible).toBe(true);
    // Tuyệt đối không hàng nhạc nào bị cắt đôi ở mép trên
    expect(afterTurn.isAnySystemCutAtTop).toBe(false);
    expect(afterTurn.manualCut).toBe(false);
  });

  test('2. Chuỗi lật tiếp theo (sequence) và lật lùi qua các bước', async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 820 });
    await page.goto('./?song=thanh-ca-001&v=sheet', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });
    await page.waitForFunction(() => (window.PageNav?.getSystems()?.length || 0) >= 5, { timeout: 10000 });
    await page.waitForTimeout(300);

    // Lật sang trang 2
    await page.evaluate(() => window.PageNav?.goToNext());
    await page.waitForTimeout(650);
    expect(await page.evaluate(() => window.PageNav?.getCurrentPage())).toBe(2);
    expect(await page.evaluate(() => window.PageNav?.isAnySystemCutAtTop())).toBe(false);

    // Lật sang trang 3 (nếu tổng số trang >= 3)
    const totalPages = await page.evaluate(() => window.PageNav?.getTotalPages());
    if (totalPages >= 3) {
      await page.evaluate(() => window.PageNav?.goToNext());
      await page.waitForTimeout(650);
      expect(await page.evaluate(() => window.PageNav?.getCurrentPage())).toBe(3);
      expect(await page.evaluate(() => window.PageNav?.isAnySystemCutAtTop())).toBe(false);
    }

    // Lật lùi về trang trước qua goToPrev()
    await page.evaluate(() => window.PageNav?.goToPrev());
    await page.waitForTimeout(650);
    const prevPage = await page.evaluate(() => window.PageNav?.getCurrentPage());
    expect(prevPage).toBeLessThan(totalPages);
    expect(await page.evaluate(() => window.PageNav?.isAnySystemCutAtTop())).toBe(false);
  });

  test('3. Chuyển đổi giữa chế độ lật cả trang (full) và lật nửa trang (half)', async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 820 });
    await page.goto('./?song=thanh-ca-001&v=sheet', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });
    await page.waitForFunction(() => (window.PageNav?.getSystems()?.length || 0) >= 5, { timeout: 10000 });
    await page.waitForTimeout(300);

    // Chuyển sang chế độ Full-Page
    await page.evaluate(() => window.PageNav?.setTurnMode('full'));
    const fullMode = await page.evaluate(() => window.PageNav?.getTurnMode());
    expect(fullMode).toBe('full');

    // Lật trang ở chế độ Full-Page
    await page.evaluate(() => window.PageNav?.goToNext());
    await page.waitForTimeout(650);
    expect(await page.evaluate(() => window.PageNav?.getCurrentPage())).toBe(2);
    // Vẫn bảo đảm không cắt đôi hàng nhạc
    expect(await page.evaluate(() => window.PageNav?.isAnySystemCutAtTop())).toBe(false);

    // Chuyển lại về chế độ Half-Page
    await page.evaluate(() => window.PageNav?.setTurnMode('half'));
    expect(await page.evaluate(() => window.PageNav?.getTurnMode())).toBe('half');
  });

  test('4. Chế độ Band (Lyric View): lật căn theo đỉnh khổ thơ không cắt đôi khổ', async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 820 });
    await page.goto('./?song=thanh-ca-001&v=lyric', { waitUntil: 'domcontentloaded' });

    const lyricContainer = page.locator('#lyric-view-container');
    await expect(lyricContainer).toBeVisible({ timeout: 25000 });
    await page.waitForTimeout(500);

    // Lấy thông tin các khổ thơ và lật trang
    const checkVerseAlignment = await page.evaluate(() => {
      window.PageNav?.computePages();
      const pages = window.PageNav?.getTotalPages() || 1;
      if (pages <= 1) return { pages, ok: true };

      window.PageNav?.goToNext();
      const wrap = document.querySelector('.sheet-viewer-wrapper');
      const scrollTop = wrap ? wrap.scrollTop : 0;
      const verses = Array.from(document.querySelectorAll('.lv-verse, .lv-chorus'));

      // Kiểm tra xem có khổ nào bị cắt ở mép trên không
      let cut = false;
      const wrapRect = wrap.getBoundingClientRect();
      for (const v of verses) {
        const r = v.getBoundingClientRect();
        const topPx = (r.top - wrapRect.top) + scrollTop;
        const bottomPx = topPx + r.height;
        if (topPx < scrollTop - 6 && bottomPx > scrollTop + 24) {
          cut = true;
          break;
        }
      }
      return { pages, scrollTop, cut, ok: !cut };
    });

    expect(checkVerseAlignment.ok).toBe(true);
  });

});
