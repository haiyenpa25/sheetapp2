// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * e2e/library-l0-zoom-menu-usage.spec.js
 *
 * Kiểm thử E2E cho Ticket L0-6 (ROADMAP 4):
 *  1. Nút zoom −/+ trên thanh công cụ không còn bị disabled sau khi bài đã nạp.
 *  2. Chip "Dùng N lần" không bị nhân đôi (duplicate) khi render nhiều lần.
 *  3. Menu ⋮ đóng sau khi chọn mục, khi chạm ra ngoài hoặc khi bấm Esc.
 */

test.describe('Ticket L0-6: Zoom buttons, Song Usage Chip, Menu ⋮ Auto-close', () => {

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('sheetapp_guest_chosen', '1');
    });
  });

  test('1. Nút zoom −/+ không bị disabled khi nạp bài xong và điều chỉnh được zoom', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });

    const osmdSvg = page.locator('#osmd-container svg').first();
    await expect(osmdSvg).toBeVisible({ timeout: 25000 });

    const btnZoomIn = page.locator('#btn-zoom-in');
    const btnZoomOut = page.locator('#btn-zoom-out');
    const zoomSelect = page.locator('#zoom-slider');

    // Nút zoom −/+ phải được enable
    await expect(btnZoomIn).toBeEnabled({ timeout: 10000 });
    await expect(btnZoomOut).toBeEnabled({ timeout: 10000 });

    // Kiểm tra thao tác bấm zoom-in
    const initialVal = await zoomSelect.inputValue();
    await btnZoomIn.click();
    await page.waitForTimeout(300);

    const valAfterIn = await zoomSelect.inputValue();
    expect(parseInt(valAfterIn, 10)).toBeGreaterThan(parseInt(initialVal, 10));

    // Kiểm tra thao tác bấm zoom-out
    await btnZoomOut.click();
    await page.waitForTimeout(300);

    const valAfterOut = await zoomSelect.inputValue();
    expect(parseInt(valAfterOut, 10)).toBeLessThan(parseInt(valAfterIn, 10));
  });

  test('2. Chip "Dùng N lần" không bị nhân đôi khi thanh thông tin render nhiều lần', async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 820 });
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });

    const osmdSvg = page.locator('#osmd-container svg').first();
    await expect(osmdSvg).toBeVisible({ timeout: 25000 });

    // Giả lập hoặc đợi nạp dữ liệu usage
    await page.waitForTimeout(1000);

    // Kích hoạt re-render thanh thông tin bằng cách chuyển đổi chord set hoặc gọi refresh
    await page.evaluate(() => {
      if (window.SongInfoBar?.refreshChordChip) {
        window.SongInfoBar.refreshChordChip();
        window.SongInfoBar.refreshChordChip();
      }
    });
    await page.waitForTimeout(600);

    // Đếm số lượng chip usage trong DOM
    const usageChipCount = await page.locator('.si-usage, #si-usage-chip').count();
    // Số chip usage không được vượt quá 1
    expect(usageChipCount).toBeLessThanOrEqual(1);
  });

  test('3. Menu ⋮ tự đóng sau khi bấm Esc, chạm/click ra ngoài, hoặc chọn một mục menu', async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 820 });
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });

    const osmdSvg = page.locator('#osmd-container svg').first();
    await expect(osmdSvg).toBeVisible({ timeout: 25000 });

    const btnMore = page.locator('#btn-more-options');
    const menu = page.locator('#main-dropdown-menu');

    // 3.1 Mở menu và đóng bằng phím Escape
    await btnMore.click();
    await expect(menu).not.toHaveClass(/hidden/);

    await page.keyboard.press('Escape');
    await expect(menu).toHaveClass(/hidden/);

    // 3.2 Mở menu và đóng bằng chạm/click ra ngoài
    await btnMore.click();
    await expect(menu).not.toHaveClass(/hidden/);

    // Click vào vùng trống bên ngoài menu (ví dụ vùng osmd-container)
    await page.locator('#osmd-container').click({ position: { x: 50, y: 50 } });
    await expect(menu).toHaveClass(/hidden/);

    // 3.3 Mở menu và đóng khi chọn một mục menu (ví dụ Chế độ Sáng / Tối)
    await btnMore.click();
    await expect(menu).not.toHaveClass(/hidden/);

    const darkToggle = page.locator('#btn-dark-toggle');
    await darkToggle.click();
    // Menu phải tự động đóng
    await expect(menu).toHaveClass(/hidden/);
  });

});
