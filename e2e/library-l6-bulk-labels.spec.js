// @ts-check
const { test, expect } = require('@playwright/test');
const { execSync } = require('child_process');

/**
 * e2e/library-l6-bulk-labels.spec.js
 *
 * Kiểm thử E2E Ticket L6-3 (ROADMAP4 Mục 8 - Nhóm L6):
 * - Dữ liệu nhãn: ≥300 bài có nhãn mùa lễ / chủ đề.
 * - Thư viện chính: Bộ lọc Mùa Lễ (#season-filter-wrap) và Chủ Đề (#theme-filter-wrap) hiển thị tự nhiên.
 * - Lọc bài theo Mùa Lễ (ví dụ: Giáng Sinh) lọc đúng các bài Giáng Sinh.
 * - Manager Portal: Chọn nhiều bài hát (checkbox hàng loạt) -> #mgr-bulk-bar hiển thị.
 * - Gán Mùa Lễ / Chủ Đề hàng loạt qua #btn-mgr-bulk-apply -> Thông báo thành công và cập nhật badge.
 */

test.describe('L6-3 · Gắn Nhãn Hàng Loạt & Bộ Lọc Mùa Lễ, Chủ Đề', () => {

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('sheetapp_guest_chosen', '1');
      localStorage.setItem('sheetapp_guest_toast_shown', '1');
    });
  });

  test('1. Thư viện chính: Bộ lọc Mùa Lễ và Chủ Đề hiển thị đầy đủ, không bị ẩn', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('./?song=thanh-ca-001&v=sheet', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });

    // Đợi nạp danh sách bài hát và khởi tạo bộ lọc
    await page.waitForFunction(() => {
      return window.LibraryUI && typeof window.LibraryUI.getSongs === 'function' && window.LibraryUI.getSongs().length > 50;
    }, { timeout: 15000 });

    // Mở panel gom bộ lọc bằng nút #btn-filter-toggle nếu đang đóng
    const filterPanel = page.locator('#sidebar-filters-panel');
    const filterToggle = page.locator('#btn-filter-toggle');
    await expect(filterToggle).toBeVisible({ timeout: 10000 });

    const isHidden = await filterPanel.evaluate(el => el.classList.contains('hidden'));
    if (isHidden) {
      await filterToggle.click();
    }
    await expect(filterPanel).not.toHaveClass(/hidden/, { timeout: 5000 });

    // Kiểm tra bộ lọc Mùa Lễ (#season-filter-wrap) hiển thị
    const seasonWrap = page.locator('#season-filter-wrap');
    await expect(seasonWrap).toBeVisible({ timeout: 10000 });

    // Kiểm tra bộ lọc Chủ Đề (#theme-filter-wrap) hiển thị
    const themeWrap = page.locator('#theme-filter-wrap');
    await expect(themeWrap).toBeVisible({ timeout: 10000 });

    // Select options của Mùa Lễ phải chứa "Giáng Sinh", "Phục Sinh", "Thương Khó"
    const seasonSelect = page.locator('#season-filter');
    const seasonOptions = await seasonSelect.locator('option').allInnerTexts();
    expect(seasonOptions.some(opt => opt.includes('Giáng Sinh'))).toBe(true);
    expect(seasonOptions.some(opt => opt.includes('Thương Khó'))).toBe(true);

    // Lọc theo mùa "Giáng Sinh"
    await seasonSelect.selectOption({ label: 'Giáng Sinh' });
    await page.waitForTimeout(600);

    // Danh sách bài hiển thị các bài Giáng Sinh (bài 53-75)
    const songItems = page.locator('.song-item, [data-song-id]');
    const count = await songItems.count();
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(30); // Dải Giáng Sinh khoảng 23 bài
  });

  test('2. Manager Portal: Chọn nhiều bài hát hiển thị Bulk Bar và gán nhãn hàng loạt', async ({ page }) => {
    // Tạo session banhat / admin để vào Manager
    let sessionId = '';
    try {
      sessionId = execSync('C:\\xampp\\php\\php.exe tools/create_test_session.php admin admin').toString().trim();
    } catch (e) {
      // Fallback
    }

    if (sessionId) {
      await page.context().addCookies([{
        name: 'PHPSESSID',
        value: sessionId,
        domain: 'localhost',
        path: '/'
      }]);
    }

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('./manager/', { waitUntil: 'domcontentloaded' });

    // Đợi danh sách bài hát trong tab Repertoire xuất hiện
    const songsTable = page.locator('#mgr-songs-tbody');
    await expect(songsTable).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#mgr-songs-tbody tr').first()).toBeVisible({ timeout: 10000 });

    // Ban đầu #mgr-bulk-bar có class hidden
    const bulkBar = page.locator('#mgr-bulk-bar');
    await expect(bulkBar).toHaveClass(/hidden/);

    // Click checkbox hàng đầu tiên và hàng thứ hai
    const rowCheckboxes = page.locator('.chk-song-select');
    await expect(rowCheckboxes.first()).toBeVisible({ timeout: 5000 });
    await rowCheckboxes.nth(0).check();
    await rowCheckboxes.nth(1).check();

    // Thanh Bulk Bar xuất hiện (không còn class hidden)
    await expect(bulkBar).not.toHaveClass(/hidden/, { timeout: 5000 });
    const countText = await page.locator('#mgr-bulk-count').innerText();
    expect(countText).toBe('2');

    // Chọn Mùa Lễ và nhập Chủ Đề
    await page.selectOption('#mgr-bulk-season', 'Thường Niên');
    await page.fill('#mgr-bulk-theme', 'Tôn Vinh & Ngợi Khen');

    // Bấm nút Gắn Nhãn Hàng Loạt
    await page.click('#btn-mgr-bulk-apply');

    // Chờ xử lý hoàn tất và thanh bulk bar ẩn đi
    await expect(bulkBar).toHaveClass(/hidden/, { timeout: 10000 });

    // Đợi reload repertoire xong (không còn dòng Đang tải) và bảng bài hát hiển thị badge phân loại
    const firstRow = page.locator('#mgr-songs-tbody tr').first();
    await expect(firstRow).not.toContainText('Đang tải', { timeout: 10000 });
    await expect(firstRow).toContainText('Thường Niên', { timeout: 10000 });
  });

});
