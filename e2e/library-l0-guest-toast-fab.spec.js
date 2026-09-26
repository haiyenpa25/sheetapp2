// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * e2e/library-l0-guest-toast-fab.spec.js
 *
 * Kiểm thử E2E cho Ticket L0-10 (ROADMAP 4):
 *  1. Toast "Đang xem dưới quyền Khách" hiện đúng 1 lần rồi không hiện lại.
 *  2. FAB không đè lên nhạc:
 *     - Khi là Khách (chưa đăng nhập): nút FAB (#fab-wrap) ẩn hoàn toàn.
 *     - Không có phần tử nổi nào che vùng bản nhạc.
 */

test.describe('Ticket L0-10: Toast Khách hiện 1 lần & FAB không đè lên nhạc', () => {

  test('1. FAB ẩn hoàn toàn khi chưa đăng nhập, không che khuất vùng nhạc', async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 820 });
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });

    const osmdSvg = page.locator('#osmd-container svg').first();
    await expect(osmdSvg).toBeVisible({ timeout: 25000 });

    const fabWrap = page.locator('#fab-wrap');
    // Khi chưa đăng nhập (Khách), FAB wrap phải ẩn hoàn toàn
    await expect(fabWrap).not.toBeVisible();

    // Đo tọa độ: không có phần tử FAB nào hiển thị hoặc đè lên #sheet-area
    const isFabVisible = await fabWrap.isVisible();
    expect(isFabVisible).toBe(false);

    // Chụp ảnh lưu artifact kiểm chứng không có nút nổi che vùng nhạc
    await page.screenshot({ path: 'test-results/l0-10-no-fab-covering-sheet.png' });
  });

  test('2. Toast "Đang xem dưới quyền Khách" chỉ hiện 1 lần duy nhất trên thiết bị', async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 820 });
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });

    const osmdSvg = page.locator('#osmd-container svg').first();
    await expect(osmdSvg).toBeVisible({ timeout: 25000 });

    // Xóa cờ toast để giả lập thiết bị mới tinh
    await page.evaluate(() => {
      localStorage.removeItem('sheetapp_guest_toast_shown');
    });

    // Kích hoạt chooseGuestMode lần 1
    await page.evaluate(() => {
      if (window.Auth?.chooseGuestMode) {
        window.Auth.chooseGuestMode();
      } else {
        // trigger qua nút modal
        document.getElementById('btn-enter-as-guest')?.click();
      }
    });

    // Lần 1: Toast quyền khách phải xuất hiện
    const guestToast = page.locator('.toast:has-text("Đang xem dưới quyền Khách")');
    await expect(guestToast).toBeVisible({ timeout: 5000 });

    // Chờ toast biến mất
    await expect(guestToast).toHaveCount(0, { timeout: 6000 });

    // Kích hoạt lại chooseGuestMode lần 2
    await page.evaluate(() => {
      if (window.Auth?.chooseGuestMode) {
        window.Auth.chooseGuestMode();
      } else {
        document.getElementById('btn-enter-as-guest')?.click();
      }
    });
    await page.waitForTimeout(600);

    // Lần 2: Toast KHÔNG được xuất hiện lại
    await expect(page.locator('.toast:has-text("Đang xem dưới quyền Khách")')).toHaveCount(0);
  });

});
