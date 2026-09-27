// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * e2e/library-l4-stage-lens.spec.js
 * 
 * Nghiệm thu Ticket L4-1 (Chương L4: Theo vai trò nhạc cụ - Stage Lens):
 * 1. Lần đầu mở, chọn vai trò: Guitar · Keyboard · Bass · Trống · Hát.
 * 2. Lưu theo thiết bị (localStorage 'sheetapp_instrument_role').
 * 3. Đổi vai trò chỉ bằng 1 icon trên Toolbar (#btn-instrument-role).
 * 4. Đổi vai trò -> Giao diện đổi (icon, label, body dataset), còn nguyên sau reload trang.
 */

test.describe('L4-1: Theo vai trò nhạc cụ (Stage Lens)', () => {

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('sheetapp_guest_chosen', '1');
      localStorage.setItem('sheetapp_guest_toast_shown', '1');
    });
  });

  test('Chọn vai trò 5 nhạc cụ, Đổi bằng 1 icon, Bảo toàn sau reload', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('./?song=thanh-ca-001&v=sheet', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#osmd-container svg', { timeout: 20000 });

    // Đảm bảo trạng thái ban đầu sạch
    await page.evaluate(() => {
      localStorage.removeItem('sheetapp_instrument_role');
      window.StageLens?.setRole?.('guitar', false, false);
    });

    // 1. Kiểm tra nút 1-icon #btn-instrument-role trên Toolbar
    const roleBtn = page.locator('#btn-instrument-role');
    await expect(roleBtn).toBeVisible({ timeout: 5000 });

    const roleIcon = page.locator('#instrument-role-icon');
    const roleLabel = page.locator('#instrument-role-label');

    // Mặc định ban đầu là Guitar
    await expect(roleIcon).toHaveText('🎸');
    await expect(roleLabel).toHaveText('Guitar');

    // 2. Click nút #btn-instrument-role để mở hộp thoại chọn vai trò
    await roleBtn.click();

    const modal = page.locator('#modal-stage-lens');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Kiểm tra có đủ 5 vai trò nhạc cụ
    const roleCards = page.locator('.stage-lens-role-card');
    await expect(roleCards).toHaveCount(5);

    await expect(page.locator('.stage-lens-role-card[data-role="guitar"]')).toContainText('Guitar');
    await expect(page.locator('.stage-lens-role-card[data-role="keyboard"]')).toContainText('Keyboard');
    await expect(page.locator('.stage-lens-role-card[data-role="bass"]')).toContainText('Bass');
    await expect(page.locator('.stage-lens-role-card[data-role="drums"]')).toContainText('Trống');
    await expect(page.locator('.stage-lens-role-card[data-role="vocals"]')).toContainText('Hát');

    // 3. Chọn vai trò "Trống" (Drums)
    const drumsCard = page.locator('.stage-lens-role-card[data-role="drums"]');
    await drumsCard.click();

    // Modal đóng lại
    await expect(modal).toBeHidden();

    // Icon và nhãn trên Toolbar đổi sang Trống
    await expect(roleIcon).toHaveText('🥁');
    await expect(roleLabel).toHaveText('Trống');

    // Body có dataset stageLens = drums
    const bodyLensDrums = await page.evaluate(() => document.body.dataset.stageLens);
    expect(bodyLensDrums).toBe('drums');

    // localStorage đã lưu drums
    const storedDrums = await page.evaluate(() => localStorage.getItem('sheetapp_instrument_role'));
    expect(storedDrums).toBe('drums');

    // 4. Đổi sang vai trò "Keyboard" chỉ bằng 1 icon
    await roleBtn.click();
    await expect(modal).toBeVisible();

    const keyboardCard = page.locator('.stage-lens-role-card[data-role="keyboard"]');
    await keyboardCard.click();

    await expect(modal).toBeHidden();
    await expect(roleIcon).toHaveText('🎹');
    await expect(roleLabel).toHaveText('Keyboard');

    const storedKeyboard = await page.evaluate(() => localStorage.getItem('sheetapp_instrument_role'));
    expect(storedKeyboard).toBe('keyboard');

    // 5. Reload trang -> Vai trò Keyboard vẫn còn nguyên vẹn từ thiết bị
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#osmd-container svg', { timeout: 20000 });

    const roleIconAfterReload = page.locator('#instrument-role-icon');
    const roleLabelAfterReload = page.locator('#instrument-role-label');
    await expect(roleIconAfterReload).toHaveText('🎹');
    await expect(roleLabelAfterReload).toHaveText('Keyboard');

    const roleInStore = await page.evaluate(() => {
      // @ts-ignore
      return window.Store?.get?.('instrumentRole');
    });
    expect(roleInStore).toBe('keyboard');

    const bodyLensAfterReload = await page.evaluate(() => document.body.dataset.stageLens);
    expect(bodyLensAfterReload).toBe('keyboard');

    console.log('[L4-1 E2E] Stage Lens verification successful! Current role preserved:', roleInStore);
  });

});
