// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * e2e/library-l4-guitar-lens.spec.js
 *
 * Nghiệm thu Ticket L4-2 (Chương L4: Theo vai trò nhạc cụ - Stage Lens):
 * 1. Guitar: chế độ Band + Capo cá nhân (không đổi tông của cả band) + Hiển thị thế bấm.
 * 2. Tuỳ chọn "Đơn giản hoá hợp âm" (bỏ 7/9/sus: Cmaj7 → C, D7sus4 → D...).
 * 3. Bảng thế bấm Guitar SVG trực quan (#guitar-chord-palette).
 * 4. Bảo toàn trạng thái qua reload trang theo thiết bị.
 */

test.describe('L4-2: Guitar Stage Lens & Đơn giản hoá hợp âm', () => {

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('sheetapp_guest_chosen', '1');
      localStorage.setItem('sheetapp_guest_toast_shown', '1');
    });
  });

  test('Guitar Lens: Chế độ Band, Capo cá nhân, Đơn giản hoá, Bảng thế bấm SVG', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('./?song=thanh-ca-001&v=lyric', { waitUntil: 'domcontentloaded' });

    // 1. Đảm bảo vai trò là Guitar và reset trạng thái guitar ban đầu
    await page.evaluate(() => {
      // @ts-ignore
      window.StageLens?.setRole?.('guitar', true, false);
      // @ts-ignore
      window.GuitarLens?.setPersonalCapo?.(0, false);
      // @ts-ignore
      if (window.GuitarLens?.isSimplifyActive?.()) {
        // @ts-ignore
        window.GuitarLens?.toggleSimplify?.(false);
      }
    });

    // Chờ lyric view hiển thị
    const lyricContainer = page.locator('#lyric-view-container');
    await expect(lyricContainer).toBeVisible({ timeout: 20000 });

    // 2. Kiểm tra thanh Guitar Lens Bar (#guitar-lens-bar)
    const guitarBar = page.locator('#guitar-lens-bar');
    await expect(guitarBar).toBeVisible({ timeout: 5000 });

    // Kiểm tra các nút công cụ của Guitar
    const capoDecBtn = page.locator('#btn-guitar-capo-dec');
    const capoIncBtn = page.locator('#btn-guitar-capo-inc');
    const capoValEl = page.locator('#guitar-capo-val');
    const simplifyBtn = page.locator('#btn-guitar-simplify');
    const paletteEl = page.locator('#guitar-chord-palette');

    await expect(capoDecBtn).toBeVisible();
    await expect(capoIncBtn).toBeVisible();
    await expect(capoValEl).toHaveText('0');
    await expect(simplifyBtn).toBeVisible();
    await expect(paletteEl).toBeVisible();

    // 3. Kiểm tra Bảng thế bấm SVG (#guitar-chord-palette)
    // Phải chứa các thẻ hợp âm có SVG
    const chordCards = paletteEl.locator('.guitar-chord-card');
    await expect(chordCards.first()).toBeVisible({ timeout: 8000 });
    const chordCardCount = await chordCards.count();
    expect(chordCardCount).toBeGreaterThan(0);

    const firstSvg = chordCards.first().locator('svg.guitar-chord-svg');
    await expect(firstSvg).toBeVisible();

    // 4. Kiểm tra thuật toán Đơn giản hoá hợp âm (Cmaj7 → C, D7sus4 → D)
    const simplifyCheck = await page.evaluate(() => {
      // @ts-ignore
      const simplify = window.GuitarLens?.simplifyChord;
      return {
        cmaj7: simplify?.('Cmaj7'),
        d7sus4: simplify?.('D7sus4'),
        am7: simplify?.('Am7'),
        g7: simplify?.('G7'),
        cSlashE: simplify?.('Cmaj7/E')
      };
    });

    expect(simplifyCheck.cmaj7).toBe('C');
    expect(simplifyCheck.d7sus4).toBe('D');
    expect(simplifyCheck.am7).toBe('Am');
    expect(simplifyCheck.g7).toBe('G');
    expect(simplifyCheck.cSlashE).toBe('C/E');

    // Bật tuỳ chọn "Đơn giản hoá hợp âm"
    await simplifyBtn.click();
    await expect(simplifyBtn).toHaveClass(/active/);
    await expect(simplifyBtn).toContainText('Đơn giản hoá: BẬT');

    const isSimpActive = await page.evaluate(() => {
      // @ts-ignore
      return window.GuitarLens?.isSimplifyActive?.();
    });
    expect(isSimpActive).toBe(true);

    // 5. Kiểm tra Capo cá nhân: Đặt Capo = 2 (không đổi tông của ban nhạc)
    const bandTransposeBefore = await page.evaluate(() => {
      // @ts-ignore
      return window.Store?.get?.('currentTranspose') || 0;
    });

    // Bấm tăng Capo 2 lần
    await capoIncBtn.click();
    await capoIncBtn.click();
    await expect(capoValEl).toHaveText('2');

    // Tông bài hát của ban nhạc trong Store vẫn giữ nguyên 100%!
    const bandTransposeAfter = await page.evaluate(() => {
      // @ts-ignore
      return window.Store?.get?.('currentTranspose') || 0;
    });
    expect(bandTransposeAfter).toBe(bandTransposeBefore);

    const personalCapo = await page.evaluate(() => {
      // @ts-ignore
      return window.GuitarLens?.getPersonalCapo?.();
    });
    expect(personalCapo).toBe(2);

    // Header hiển thị huy hiệu Capo 2
    const capoBadge = page.locator('.lv-capo-badge');
    await expect(capoBadge).toBeVisible();
    await expect(capoBadge).toContainText('Capo 2');

    // 6. Reload trang -> Capo cá nhân và trạng thái đơn giản hoá vẫn được bảo tồn
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('#lyric-view-container')).toBeVisible({ timeout: 20000 });

    const capoValAfterReload = page.locator('#guitar-capo-val');
    await expect(capoValAfterReload).toHaveText('2');

    const simplifyBtnAfterReload = page.locator('#btn-guitar-simplify');
    await expect(simplifyBtnAfterReload).toHaveClass(/active/);

    const capoInStore = await page.evaluate(() => {
      // @ts-ignore
      return window.GuitarLens?.getPersonalCapo?.();
    });
    expect(capoInStore).toBe(2);

    console.log('[L4-2 E2E] Guitar Lens verification successful: Personal Capo = 2 preserved, simplifyChords active!');
  });

});
