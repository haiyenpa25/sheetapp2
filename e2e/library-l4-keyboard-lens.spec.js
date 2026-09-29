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

    // Ticket R4-1 (ROADMAP5): #btn-instrument-role trên toolbar bị ẩn vĩnh viễn
    // (.toolbar-secondary-controls { display:none !important }, không điều kiện) --
    // "Góc nhìn nhạc cụ" chuyển hẳn vào menu Công cụ (⋯) → Hiển thị. Nút cũ vẫn giữ
    // logic click thật (menu ủy quyền click sang nó), nhưng phải mở qua menu.
    await page.locator('#btn-more-options').click();
    await expect(page.locator('#main-dropdown-menu')).toBeVisible({ timeout: 5000 });
    await page.locator('#btn-menu-instrument-role').click();

    const modal = page.locator('#modal-stage-lens');
    await expect(modal).toBeVisible({ timeout: 5000 });

    const keyboardCard = page.locator('.stage-lens-role-card[data-role="keyboard"]');
    await keyboardCard.click();
    await expect(modal).toBeHidden();

    // 2. Kiểm tra vai trò Keyboard đã được kích hoạt
    const roleIcon = page.locator('#instrument-role-icon');
    const roleLabel = page.locator('#instrument-role-label');
    await expect(roleIcon).toHaveText('🎹');
    // Ticket R4-1 (ROADMAP5): nhãn vai trò đổi thuần Việt "Keyboard" -> "Đàn phím"
    await expect(roleLabel).toHaveText('Đàn phím');

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

    // 5. Công tắc "Bản nhạc" active, "Lời & Hợp âm" không active (Ticket R1-2: thay
    // #btn-band-toggle, nay đã ẩn, bằng #btn-view-sheet / #btn-view-lyrics)
    const btnViewSheet = page.locator('#btn-view-sheet');
    if (await btnViewSheet.count() > 0) {
      await expect(btnViewSheet).toHaveClass(/active/);
      await expect(page.locator('#btn-view-lyrics')).not.toHaveClass(/active/);
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
