// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * e2e/library-l1-toolbar-and-ipad-area.spec.js
 *
 * Kiểm thử E2E cho Ticket L1-3 (ROADMAP 4):
 * 1. Thanh công cụ 48px.
 * 2. Popover "ⓘ" thông tin bài hát (tông, BPM, nhịp).
 * 3. Trên iPad ngang (1180x820):
 *    - Sidebar đóng mặc định dạng overlay drawer khi xem bài.
 *    - Vùng nhạc chiếm >= 85% diện tích màn hình.
 */

test.describe('L1-3 · Thanh công cụ 48px & iPad Overlay (Chromium + WebKit)', () => {

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('sheetapp_guest_chosen', '1');
    });
  });

  test('1. Thanh công cụ 48px và popover thông tin ⓘ', async ({ page }) => {
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });
    const osmdSvg = page.locator('#osmd-container svg').first();
    await expect(osmdSvg).toBeVisible({ timeout: 25000 });

    const toolbar = page.locator('#toolbar');
    const toolbarBox = await toolbar.boundingBox();
    expect(toolbarBox).not.toBeNull();
    if (toolbarBox) {
      // Toolbar height chuẩn 48px (cho phép dung sai 4px do border)
      expect(toolbarBox.height).toBeLessThanOrEqual(52);
    }

    // Nút popover ⓘ
    const btnInfo = page.locator('#btn-song-info-popover');
    await expect(btnInfo).toBeVisible();

    const popover = page.locator('#song-info-popover');
    await expect(popover).toHaveClass(/hidden/);

    // Mở popover
    await btnInfo.click();
    await expect(popover).not.toHaveClass(/hidden/);

    // Kiểm tra nội dung popover có tông gốc
    const keyVal = page.locator('#si-pop-key');
    await expect(keyVal).not.toHaveText('--');

    // Đóng popover bằng nút đóng
    const btnClose = page.locator('#btn-close-song-info-popover');
    await btnClose.click();
    await expect(popover).toHaveClass(/hidden/);
  });

  test('2. Trên iPad ngang (1180x820): Sidebar đóng overlay, diện tích nhạc >= 85%', async ({ page }) => {
    // Thiết lập kích thước viewport iPad Pro / Air 11" ngang
    await page.setViewportSize({ width: 1180, height: 820 });

    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });
    const osmdSvg = page.locator('#osmd-container svg').first();
    await expect(osmdSvg).toBeVisible({ timeout: 25000 });

    // Kiểm tra sidebar đóng mặc định dạng overlay
    const sidebar = page.locator('#sidebar');
    const isSidebarHidden = await page.evaluate(() => {
      const sb = document.getElementById('sidebar');
      if (!sb) return true;
      const rect = sb.getBoundingClientRect();
      return sb.classList.contains('mobile-hidden') || rect.right <= 0;
    });
    expect(isSidebarHidden).toBe(true);

    // Đo diện tích vùng hiển thị bản nhạc so với toàn màn hình
    const areaMetrics = await page.evaluate(() => {
      const sheetArea = document.getElementById('sheet-area') || document.querySelector('.sheet-viewer-wrapper');
      if (!sheetArea) return null;

      const rect = sheetArea.getBoundingClientRect();
      const screenArea = window.innerWidth * window.innerHeight;
      const sheetVisibleArea = Math.min(rect.width, window.innerWidth) * Math.min(rect.height, window.innerHeight);
      const ratio = sheetVisibleArea / screenArea;

      return {
        screenWidth: window.innerWidth,
        screenHeight: window.innerHeight,
        sheetWidth: rect.width,
        sheetHeight: rect.height,
        ratio
      };
    });

    expect(areaMetrics).not.toBeNull();
    if (areaMetrics) {
      // Vùng nhạc phải chiếm >= 85% diện tích màn hình
      expect(areaMetrics.ratio).toBeGreaterThanOrEqual(0.85);
    }
  });

  test('3. Bấm mở sidebar trên iPad ngang mở dạng overlay và đóng khi chạm overlay', async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 820 });
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });
    const osmdSvg = page.locator('#osmd-container svg').first();
    await expect(osmdSvg).toBeVisible({ timeout: 25000 });

    const btnOpenSidebar = page.locator('#btn-open-sidebar');
    await btnOpenSidebar.click();
    await page.waitForTimeout(400);

    const sidebar = page.locator('#sidebar');
    await expect(sidebar).not.toHaveClass(/mobile-hidden/);

    // Chạm vào overlay để đóng lại
    const overlay = page.locator('#sidebar-overlay');
    await overlay.click({ force: true });
    await page.waitForTimeout(400);

    await expect(sidebar).toHaveClass(/mobile-hidden/);
  });

});
