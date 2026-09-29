// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * e2e/library-r1-7-sidebar-default-closed.spec.js
 *
 * Kiểm thử E2E Ticket R1-7 (ROADMAP 5, Mục 2.2 & 3):
 * - Laptop 1366x768: Sidebar mặc định đóng khi mở bằng ?song=
 * - Nhạc trên laptop 1366 chiếm diện tích >= 70%
 * - Nút ☰ (#btn-open-sidebar) có nhãn đúng hành động: "Mở..." khi đóng, "Đóng..." khi mở
 * - Sidebar mở dạng overlay drawer ở <= 1440px và đóng bằng phím Escape hoặc chạm overlay
 */

test.describe('R1-7 · Sidebar mặc định đóng ở <= 1440px & nhãn nút ☰ chính xác', () => {

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('sheetapp_guest_chosen', '1');
      localStorage.setItem('sheetapp_guest_toast_shown', '1');
    });
  });

  test('1. Laptop (1366x768): Mở bài ?song= thì sidebar mặc định đóng, nhạc >= 70% diện tích', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });

    const osmdSvg = page.locator('#osmd-container svg').first();
    await expect(osmdSvg).toBeVisible({ timeout: 25000 });

    // 1. Sidebar mặc định đóng (mobile-hidden hoặc ngoài khung nhìn)
    const sidebar = page.locator('#sidebar');
    const isSidebarClosed = await page.evaluate(() => {
      const sb = document.getElementById('sidebar');
      if (!sb) return true;
      const rect = sb.getBoundingClientRect();
      return sb.classList.contains('mobile-hidden') || rect.right <= 0;
    });
    expect(isSidebarClosed).toBe(true);

    // 2. Nút ☰ có nhãn hành động "Mở danh sách..."
    const btnOpen = page.locator('#btn-open-sidebar');
    await expect(btnOpen).toBeVisible();
    const titleClosed = await btnOpen.getAttribute('title');
    expect(titleClosed).toContain('Mở danh sách');
    const ariaExpanded = await btnOpen.getAttribute('aria-expanded');
    expect(ariaExpanded).toBe('false');

    // 3. Diện tích hiển thị nhạc trên laptop 1366 >= 70%
    const sheetWrapper = page.locator('.sheet-viewer-wrapper');
    await expect(sheetWrapper).toBeVisible();
    const box = await sheetWrapper.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      const area = box.width * box.height;
      const totalArea = 1366 * 768;
      const ratioPct = (area / totalArea) * 100;
      expect(ratioPct).toBeGreaterThanOrEqual(70);
    }
  });

  test('2. Bấm nút ☰ mở sidebar dạng overlay và nhãn chuyển thành "Đóng danh sách..."', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });

    const osmdSvg = page.locator('#osmd-container svg').first();
    await expect(osmdSvg).toBeVisible({ timeout: 25000 });

    const btnOpen = page.locator('#btn-open-sidebar');
    const sidebar = page.locator('#sidebar');
    const overlay = page.locator('#sidebar-overlay');

    // Mở sidebar
    await btnOpen.click();
    await page.waitForTimeout(300);

    // Sidebar mở dạng drawer overlay
    await expect(sidebar).not.toHaveClass(/mobile-hidden/);
    await expect(overlay).not.toHaveClass(/hidden/);

    // Nhãn nút ☰ đổi thành "Đóng..."
    const titleOpen = await btnOpen.getAttribute('title');
    expect(titleOpen).toContain('Đóng danh sách');
    const ariaExpandedOpen = await btnOpen.getAttribute('aria-expanded');
    expect(ariaExpandedOpen).toBe('true');

    // Chạm vào overlay để đóng lại
    await overlay.click({ force: true });
    await page.waitForTimeout(300);

    await expect(sidebar).toHaveClass(/mobile-hidden/);
    await expect(overlay).toHaveClass(/hidden/);
    const titleClosed = await btnOpen.getAttribute('title');
    expect(titleClosed).toContain('Mở danh sách');
  });

  test('3. Mở sidebar và nhấn phím Escape thì đóng sidebar', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });

    const osmdSvg = page.locator('#osmd-container svg').first();
    await expect(osmdSvg).toBeVisible({ timeout: 25000 });

    const btnOpen = page.locator('#btn-open-sidebar');
    const sidebar = page.locator('#sidebar');

    await btnOpen.click();
    await page.waitForTimeout(300);
    await expect(sidebar).not.toHaveClass(/mobile-hidden/);

    // Nhấn phím Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Sidebar phải đóng lại
    await expect(sidebar).toHaveClass(/mobile-hidden/);
    const titleClosed = await btnOpen.getAttribute('title');
    expect(titleClosed).toContain('Mở danh sách');
  });

});
