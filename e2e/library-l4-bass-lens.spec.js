// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * e2e/library-l4-bass-lens.spec.js
 *
 * Nghiệm thu Ticket L4-4 (Chương L4: Theo vai trò nhạc cụ - Stage Lens):
 * 1. Bass: Nốt gốc chữ to, hợp âm đảo lấy nốt bass (C/E → E).
 * 2. Đổi sang vai trò Bass -> Hiển thị thanh #bass-lens-bar.
 * 3. Chế độ Band hiển thị nốt bass to (.lv-bass-root).
 * 4. Nút toggle [x] Nốt Bass Lớn: BẬT hoạt động chính xác.
 * 5. Bảo toàn vai trò Bass và thiết lập qua reload trang.
 */

test.describe('L4-4: Bass Stage Lens (Nốt gốc chữ to & Hợp âm đảo C/E → E)', () => {

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('sheetapp_guest_chosen', '1');
      localStorage.setItem('sheetapp_guest_toast_shown', '1');
    });
  });

  test('Bass Lens: Nốt bass chữ lớn, hợp âm đảo, thanh công cụ Bass Bar', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('./?song=thanh-ca-001&v=lyric', { waitUntil: 'domcontentloaded' });

    const lyricContainer = page.locator('#lyric-view-container');
    await expect(lyricContainer).toBeVisible({ timeout: 25000 });

    // 1. Mở modal chọn vai trò và chọn Bass
    // Ticket R4-1 (ROADMAP5): #btn-instrument-role trên toolbar bị ẩn vĩnh viễn
    // (.toolbar-secondary-controls { display:none !important }, không điều kiện) --
    // "Góc nhìn nhạc cụ" chuyển hẳn vào menu Công cụ (⋯) → Hiển thị.
    await page.locator('#btn-more-options').click();
    await expect(page.locator('#main-dropdown-menu')).toBeVisible({ timeout: 5000 });
    await page.locator('#btn-menu-instrument-role').click();

    const modal = page.locator('#modal-stage-lens');
    await expect(modal).toBeVisible({ timeout: 5000 });

    const bassCard = page.locator('.stage-lens-role-card[data-role="bass"]');
    await bassCard.click();
    await expect(modal).toBeHidden();

    // 2. Kiểm tra vai trò Bass đã kích hoạt
    const roleIcon = page.locator('#instrument-role-icon');
    const roleLabel = page.locator('#instrument-role-label');
    await expect(roleIcon).toHaveText('🎻');
    await expect(roleLabel).toHaveText('Bass');

    const bodyLens = await page.evaluate(() => document.body.dataset.stageLens);
    expect(bodyLens).toBe('bass');

    // 3. Kiểm tra thanh công cụ Bass Bar xuất hiện
    const bassBar = page.locator('#bass-lens-bar');
    await expect(bassBar).toBeVisible({ timeout: 5000 });
    await expect(bassBar).not.toHaveClass(/hidden/);

    // 4. Kiểm tra nốt Bass hiển thị chữ lớn trong Band mode (.lv-bass-root)
    const bassRootEl = lyricContainer.locator('.lv-bass-root').first();
    await expect(bassRootEl).toBeVisible({ timeout: 5000 });
    const rootText = await bassRootEl.textContent();
    expect(rootText).toMatch(/^[A-G][#b]?$/);

    // 5. Kiểm tra hàm trích xuất nốt bass và hợp âm đảo trên trang thực
    const bassExtraction = await page.evaluate(() => {
      return {
        ce: window.BassLens?.extractBassNote?.('C/E'),
        gb: window.BassLens?.extractBassNote?.('G/B'),
        df: window.BassLens?.extractBassNote?.('D/F#'),
        c: window.BassLens?.extractBassNote?.('C'),
        am7: window.BassLens?.extractBassNote?.('Am7'),
        ceInfo: window.BassLens?.parseBassInfo?.('C/E')
      };
    });
    expect(bassExtraction.ce).toBe('E');
    expect(bassExtraction.gb).toBe('B');
    expect(bassExtraction.df).toBe('F#');
    expect(bassExtraction.c).toBe('C');
    expect(bassExtraction.am7).toBe('A');
    expect(bassExtraction.ceInfo.isSlash).toBe(true);
    expect(bassExtraction.ceInfo.bassNote).toBe('E');

    // 6. Kiểm tra nút toggle Nốt Bass Lớn trên thanh công cụ
    const btnToggleBig = page.locator('#btn-bass-toggle-big');
    await expect(btnToggleBig).toBeVisible();
    await expect(btnToggleBig).toHaveClass(/active/);

    // Tắt nốt bass lớn
    await btnToggleBig.click();
    await expect(btnToggleBig).not.toHaveClass(/active/);
    const isBigOff = await page.evaluate(() => window.BassLens?.isBigBassActive?.());
    expect(isBigOff).toBe(false);

    // Bật lại nốt bass lớn
    await btnToggleBig.click();
    await expect(btnToggleBig).toHaveClass(/active/);
    const isBigOn = await page.evaluate(() => window.BassLens?.isBigBassActive?.());
    expect(isBigOn).toBe(true);

    // 7. Reload trang -> Vai trò Bass và thanh công cụ vẫn bảo tồn
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#lyric-view-container', { timeout: 20000 });

    const roleIconReload = page.locator('#instrument-role-icon');
    await expect(roleIconReload).toHaveText('🎻');

    const bodyLensReload = await page.evaluate(() => document.body.dataset.stageLens);
    expect(bodyLensReload).toBe('bass');

    await expect(page.locator('#bass-lens-bar')).toBeVisible();

    console.log('[L4-4 E2E] Bass Lens verification successful: Big root notes, slash chord bass extraction & persistence verified!');
  });

});
