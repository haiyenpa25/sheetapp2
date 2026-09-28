// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * e2e/library-l4-vocals-lens.spec.js
 *
 * Nghiệm thu Ticket L4-6 (Chương L4: Theo vai trò nhạc cụ - Stage Lens):
 * 1. Hát: chế độ Một khổ, chỉ giai điệu (ẩn khoá Fa, bè), không hợp âm.
 * 2. Đổi sang vai trò Hát (icon 🎤) -> Hiển thị thanh #vocals-lens-bar.
 * 3. Tự động kích hoạt chế độ Một khổ (Single Verse Mode).
 * 4. Tự động kích hoạt Chỉ giai điệu (ẩn khoá Fa & bè phụ qua Compact Mode).
 * 5. Tự động ẩn hoàn toàn hợp âm (#chord-canvas).
 * 6. Kiểm tra các nút toggle tuỳ chọn và chuyển khổ trên thanh Vocals Bar.
 * 7. Bảo toàn trạng thái qua reload trang.
 */

test.describe('L4-6: Vocals Stage Lens (Chế độ Một khổ, chỉ giai điệu, không hợp âm)', () => {

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('sheetapp_guest_chosen', '1');
      localStorage.setItem('sheetapp_guest_toast_shown', '1');
    });
  });

  test('Vocals Lens: Một khổ, chỉ giai điệu (ẩn khoá Fa), không hợp âm & thanh Vocals Bar', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });

    // Đợi nạp bản nhạc OSMD ban đầu
    const osmdContainer = page.locator('#osmd-container');
    await expect(osmdContainer).toBeVisible({ timeout: 25000 });
    await expect(osmdContainer.locator('svg').first()).toBeVisible({ timeout: 15000 });

    // 1. Mở modal chọn vai trò và chọn Hát (Vocals)
    const roleBtn = page.locator('#btn-instrument-role');
    await expect(roleBtn).toBeVisible({ timeout: 5000 });
    await roleBtn.click();

    const modal = page.locator('#modal-stage-lens');
    await expect(modal).toBeVisible({ timeout: 5000 });

    const vocalsCard = page.locator('.stage-lens-role-card[data-role="vocals"]');
    await vocalsCard.click();
    await expect(modal).toBeHidden();

    // 2. Kiểm tra vai trò Hát đã kích hoạt trên Toolbar
    const roleIcon = page.locator('#instrument-role-icon');
    const roleLabel = page.locator('#instrument-role-label');
    await expect(roleIcon).toHaveText('🎤');
    await expect(roleLabel).toHaveText('Hát');

    const bodyLens = await page.evaluate(() => document.body.dataset.stageLens);
    expect(bodyLens).toBe('vocals');

    const bodyClass = await page.evaluate(() => document.body.classList.contains('vocals-lens-active'));
    expect(bodyClass).toBe(true);

    // 3. Kiểm tra hiển thị thanh Vocals Bar (#vocals-lens-bar)
    const vocalsBar = page.locator('#vocals-lens-bar');
    await expect(vocalsBar).toBeVisible({ timeout: 5000 });
    await expect(vocalsBar).not.toHaveClass(/hidden/);

    // 4. Kiểm tra chế độ Một khổ (Single Verse Mode)
    const verseMode = await page.evaluate(() => window.VerseManager?.getMode?.());
    expect(verseMode).toBe('single');

    // 5. Kiểm tra chỉ giai điệu (Compact Mode ẩn khoá Fa)
    const compactMode = await page.evaluate(() => window.OSMDRenderer?.getCompactMode?.());
    expect(compactMode).toBe(true);

    // 6. Kiểm tra ẩn hợp âm (#chord-canvas ẩn)
    const chordCanvas = page.locator('#chord-canvas');
    if (await chordCanvas.count() > 0) {
      await expect(chordCanvas).toBeHidden();
    }

    // 7. Kiểm tra nút chuyển khổ trên Vocals Bar
    const btnNextVerse = page.locator('#btn-vocals-next-verse');
    await expect(btnNextVerse).toBeVisible();
    await btnNextVerse.click();

    const curVerseAfter = await page.evaluate(() => window.VerseManager?.getCurrentVerse?.());
    expect(curVerseAfter).toBeGreaterThanOrEqual(1);

    // 8. Kiểm tra nút toggle ẩn khoá Fa
    const btnToggleFa = page.locator('#btn-vocals-toggle-fa');
    await expect(btnToggleFa).toBeVisible();
    await expect(btnToggleFa).toHaveClass(/active/);

    await btnToggleFa.click();
    await expect(btnToggleFa).not.toHaveClass(/active/);
    const faOff = await page.evaluate(() => window.VocalsLens?.isHideFaStaff?.());
    expect(faOff).toBe(false);

    await btnToggleFa.click();
    await expect(btnToggleFa).toHaveClass(/active/);
    const faOn = await page.evaluate(() => window.VocalsLens?.isHideFaStaff?.());
    expect(faOn).toBe(true);

    // 9. Kiểm tra nút toggle ẩn hợp âm
    const btnToggleChords = page.locator('#btn-vocals-toggle-chords');
    await expect(btnToggleChords).toBeVisible();
    await expect(btnToggleChords).toHaveClass(/active/);

    await btnToggleChords.click();
    await expect(btnToggleChords).not.toHaveClass(/active/);
    const chordsOff = await page.evaluate(() => window.VocalsLens?.isHideChords?.());
    expect(chordsOff).toBe(false);

    await btnToggleChords.click();
    await expect(btnToggleChords).toHaveClass(/active/);
    const chordsOn = await page.evaluate(() => window.VocalsLens?.isHideChords?.());
    expect(chordsOn).toBe(true);

    // 10. Reload trang -> Vai trò Hát và thanh Vocals Bar được bảo tồn
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#osmd-container svg', { timeout: 20000 });

    const roleIconReload = page.locator('#instrument-role-icon');
    await expect(roleIconReload).toHaveText('🎤');

    const bodyLensReload = await page.evaluate(() => document.body.dataset.stageLens);
    expect(bodyLensReload).toBe('vocals');

    await expect(page.locator('#vocals-lens-bar')).toBeVisible();

    console.log('[L4-6 E2E] Vocals Lens verification successful: Single verse, melody only (hide Fa/voices), no chords & persistence verified!');
  });

});
