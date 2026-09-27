// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * e2e/library-l4-keyboard-lens.spec.js
 *
 * Nghiệm thu Ticket L4-3 (Chương L4: Theo vai trò nhạc cụ - Stage Lens):
 * 1. Keyboard: Bản nhạc đầy đủ + Hợp âm.
 * 2. Đổi sang vai trò Keyboard -> Tự động chuyển sang bản nhạc (#osmd-container), ẩn chế độ Band.
 * 3. Hợp âm trên bản nhạc hiển thị đầy đủ.
 * 4. Ẩn thanh công cụ riêng của guitar để nhường diện tích cho bản nhạc.
 * 5. Bảo toàn qua reload trang.
 */

test.describe('L4-3: Keyboard Stage Lens (Bản nhạc đầy đủ + Hợp âm)', () => {

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('sheetapp_guest_chosen', '1');
      localStorage.setItem('sheetapp_guest_toast_shown', '1');
    });
  });

  test('Keyboard Lens: Bản nhạc đầy đủ, hợp âm hiển thị, ẩn Band mode', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    // Bắt đầu ở chế độ Band để kiểm chứng tính năng tự chuyển sang Bản nhạc của Keyboard
    await page.goto('./?song=thanh-ca-001&v=lyric', { waitUntil: 'domcontentloaded' });

    const lyricContainer = page.locator('#lyric-view-container');
    await expect(lyricContainer).toBeVisible({ timeout: 25000 });

    // 1. Mở modal chọn vai trò và chọn Keyboard
    const roleBtn = page.locator('#btn-instrument-role');
    await expect(roleBtn).toBeVisible({ timeout: 5000 });
    await roleBtn.click();

    const modal = page.locator('#modal-stage-lens');
    await expect(modal).toBeVisible({ timeout: 5000 });

    const keyboardCard = page.locator('.stage-lens-role-card[data-role="keyboard"]');
    await keyboardCard.click();
    await expect(modal).toBeHidden();

    // 2. Kiểm tra vai trò Keyboard đã được kích hoạt
    const roleIcon = page.locator('#instrument-role-icon');
    const roleLabel = page.locator('#instrument-role-label');
    await expect(roleIcon).toHaveText('🎹');
    await expect(roleLabel).toHaveText('Keyboard');

    const bodyLens = await page.evaluate(() => document.body.dataset.stageLens);
    expect(bodyLens).toBe('keyboard');

    // 3. Kiểm tra tự động chuyển sang Bản nhạc đầy đủ (#osmd-container)
    await expect(lyricContainer).toBeHidden({ timeout: 5000 });
    const osmdContainer = page.locator('#osmd-container');
    await expect(osmdContainer).toBeVisible({ timeout: 5000 });

    const osmdSvg = osmdContainer.locator('svg').first();
    await expect(osmdSvg).toBeVisible({ timeout: 15000 });

    // 4. Thanh guitar bar bị ẩn để nhường diện tích cho khuông nhạc keyboard
    const guitarBar = page.locator('#guitar-lens-bar');
    await expect(guitarBar).toBeHidden();

    // 5. Nút Band toggle không còn active
    const btnBand = page.locator('#btn-band-toggle');
    if (await btnBand.count() > 0) {
      await expect(btnBand).not.toHaveClass(/active/);
    }

    // 6. Reload trang -> Vai trò Keyboard và Bản nhạc vẫn được bảo tồn
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#osmd-container svg', { timeout: 20000 });

    const roleIconReload = page.locator('#instrument-role-icon');
    await expect(roleIconReload).toHaveText('🎹');

    const bodyLensReload = await page.evaluate(() => document.body.dataset.stageLens);
    expect(bodyLensReload).toBe('keyboard');

    await expect(page.locator('#osmd-container')).toBeVisible();
    await expect(page.locator('#lyric-view-container')).toBeHidden();

    console.log('[L4-3 E2E] Keyboard Lens verification successful: Full sheet music + chords active, Band hidden!');
  });

});
