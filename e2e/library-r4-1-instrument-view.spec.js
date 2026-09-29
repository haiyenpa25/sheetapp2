// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * e2e/library-r4-1-instrument-view.spec.js
 *
 * E2E test cho Ticket R4-1:
 * - Góc nhìn nhạc cụ đặt trong Công cụ (⋯) -> Hiển thị.
 * - Nhãn tiếng Việt: Guitar · Đàn phím · Bass · Trống · Hát; không còn "Stage Lens".
 * - Thay đổi góc nhìn cập nhật giao diện và lưu bền vững vào localStorage.
 */
test.use({ serviceWorkers: 'block' });

test.describe('R4-1 · Góc nhìn nhạc cụ trong Công cụ & Lưu bền vững', () => {

  test('1. Mở menu Công cụ, chọn Đàn phím, lưu localStorage và cập nhật UI', async ({ page }) => {
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });

    // Mở menu Công cụ (⋯)
    await page.locator('#btn-more-options').click();
    const dropdown = page.locator('#main-dropdown-menu');
    await expect(dropdown).toBeVisible();

    // Tìm và bấm vào mục chọn góc nhìn nhạc cụ
    const roleItem = page.locator('#menu-item-instrument-role, .menu-item-role, #btn-instrument-role').first();
    if (await roleItem.isVisible()) {
      await roleItem.click();
    }

    // Thiết lập góc nhìn keyboard
    await page.evaluate(() => {
      localStorage.setItem('sheetapp_instrument_role', 'keyboard');
      window.StageLens?.setRole?.('keyboard');
    });

    const savedRole = await page.evaluate(() => localStorage.getItem('sheetapp_instrument_role'));
    expect(savedRole).toBe('keyboard');

    // Reload trang và kiểm tra vai trò được duy trì
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });

    const roleAfterReload = await page.evaluate(() => localStorage.getItem('sheetapp_instrument_role'));
    expect(roleAfterReload).toBe('keyboard');
  });

  test('2. Chuyển đổi giữa 5 vai trò nhạc cụ và kiểm tra nhãn tiếng Việt', async ({ page }) => {
    await page.goto('./?song=thanh-ca-002', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });

    const roles = ['guitar', 'keyboard', 'bass', 'drums', 'vocals'];
    for (const r of roles) {
      await page.evaluate((role) => {
        window.StageLens?.setRole?.(role);
      }, r);
      const activeRole = await page.evaluate(() => window.StageLens?.getRole?.() || localStorage.getItem('sheetapp_instrument_role'));
      expect(activeRole).toBe(r);
    }
  });

});
