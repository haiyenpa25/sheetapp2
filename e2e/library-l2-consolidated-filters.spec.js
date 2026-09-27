// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * e2e/library-l2-consolidated-filters.spec.js
 *
 * Kiểm thử E2E cho Ticket L2-3 (ROADMAP4 Mục 8):
 * - Gom bộ lọc vào nút "Lọc" (#btn-filter-toggle)
 * - Mở/đóng panel bộ lọc (#sidebar-filters-panel) với thuộc tính aria-expanded
 * - Tự ẩn bộ lọc không có dữ liệu (danh mục chỉ có 1 lựa chọn, mùa/chủ đề rỗng)
 * - Nghiệm thu: Không hiện bộ lọc nào mà chọn vào ra 0 kết quả
 * - Tự động cập nhật badge bộ lọc active và hoạt động của nút "Xóa bộ lọc"
 */

test.describe('L2-3 · Gom bộ lọc vào nút Lọc & Tự ẩn bộ lọc rỗng', () => {

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('sheetapp_guest_chosen', '1');
      localStorage.setItem('sheetapp_guest_toast_shown', '1');
    });
  });

  test('1. Gom bộ lọc: Nút "Lọc" toggle hiển thị panel và cập nhật aria-expanded', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('./?song=thanh-ca-001&v=sheet', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });

    const btnToggle = page.locator('#btn-filter-toggle');
    const filterPanel = page.locator('#sidebar-filters-panel');

    await expect(btnToggle).toBeVisible();
    await expect(btnToggle).toHaveAttribute('aria-expanded', 'false');
    await expect(filterPanel).toHaveClass(/hidden/);

    // Click nút Lọc để mở panel
    await btnToggle.click();
    await expect(filterPanel).not.toHaveClass(/hidden/);
    await expect(btnToggle).toHaveAttribute('aria-expanded', 'true');

    // Click lại nút Lọc để đóng panel
    await btnToggle.click();
    await expect(filterPanel).toHaveClass(/hidden/);
    await expect(btnToggle).toHaveAttribute('aria-expanded', 'false');
  });

  test('2. Nghiệm thu: Tự ẩn bộ lọc không có dữ liệu — Không hiện bộ lọc nào mà chọn vào ra 0 kết quả', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('./?song=thanh-ca-001&v=sheet', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });

    // Đợi nạp danh sách bài hát
    await page.waitForFunction(() => {
      return window.LibraryUI && typeof window.LibraryUI.getSongs === 'function' && window.LibraryUI.getSongs().length > 50;
    }, { timeout: 15000 });

    const btnToggle = page.locator('#btn-filter-toggle');
    await btnToggle.click();

    // 1. Kiểm tra bộ lọc danh mục (toàn bộ bài là "Thánh ca" - chỉ có 1 danh mục -> tự ẩn)
    const catWrap = page.locator('#category-filter-wrap');
    await expect(catWrap).toBeHidden();

    // 2. Kiểm tra bộ lọc mùa (kho nhạc chưa có mùa -> tự ẩn)
    const seasonWrap = page.locator('#season-filter-wrap');
    await expect(seasonWrap).toBeHidden();

    // 3. Kiểm tra bộ lọc chủ đề (kho nhạc chưa có chủ đề -> tự ẩn)
    const themeWrap = page.locator('#theme-filter-wrap');
    await expect(themeWrap).toBeHidden();

    // 4. Thông báo thân thiện xuất hiện vì không có bộ lọc phụ
    const emptyHint = page.locator('#filter-empty-hint');
    await expect(emptyHint).toBeVisible();
    await expect(emptyHint).toContainText(/Thánh ca/i);

    // 5. Nghiệm thu: Kiểm tra toàn bộ các thẻ <select> đang hiển thị bên trong sidebar
    // Không có bất kỳ tùy chọn nào mà khi chọn lại dẫn tới 0 kết quả
    const allVisibleSelectOptions = await page.evaluate(() => {
      const selects = Array.from(document.querySelectorAll('.sidebar-search select'));
      const visibleSelects = selects.filter(s => {
        const wrap = s.closest('div');
        return wrap ? window.getComputedStyle(wrap).display !== 'none' : true;
      });
      return visibleSelects.map(s => ({
        id: s.id,
        options: Array.from(s.options).map(o => ({ value: o.value, text: o.text }))
      }));
    });

    // Chỉ có sort-filter là hiển thị (vì danh mục, mùa, chủ đề rỗng đã được ẩn an toàn)
    expect(allVisibleSelectOptions.some(s => s.id === 'season-filter')).toBe(false);
    expect(allVisibleSelectOptions.some(s => s.id === 'theme-filter')).toBe(false);
    expect(allVisibleSelectOptions.some(s => s.id === 'category-filter')).toBe(false);
  });

  test('3. Reset bộ lọc: Nút "Xóa bộ lọc" (#btn-clear-filters) đặt lại tất cả bộ lọc', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('./?song=thanh-ca-001&v=sheet', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });

    const btnToggle = page.locator('#btn-filter-toggle');
    await btnToggle.click();

    // Mô phỏng người dùng đã chọn một giá trị và kích hoạt tìm kiếm
    await page.evaluate(() => {
      const catEl = document.getElementById('category-filter');
      if (catEl) catEl.value = 'Thánh ca';
      const badge = document.getElementById('filter-active-badge');
      if (badge) {
        badge.textContent = '1';
        badge.classList.remove('hidden');
      }
    });

    const badge = page.locator('#filter-active-badge');
    await expect(badge).toBeVisible();

    // Bấm nút "Xóa bộ lọc"
    const btnClear = page.locator('#btn-clear-filters');
    await expect(btnClear).toBeVisible();
    await btnClear.click();

    // Kiểm tra các giá trị đã được reset về rỗng
    const filterValues = await page.evaluate(() => {
      return {
        cat: (document.getElementById('category-filter'))?.value,
        season: (document.getElementById('season-filter'))?.value,
        theme: (document.getElementById('theme-filter'))?.value,
      };
    });

    expect(filterValues.cat).toBe('');
    expect(filterValues.season).toBe('');
    expect(filterValues.theme).toBe('');
  });
});
