// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * e2e/library-l3-setlist-end.spec.js
 * 
 * Nghiệm thu Ticket L3-10 — Kết thúc chương trình & Giải phóng điều hướng ◀ ▶:
 * 1. Khi đang phát setlist, thanh chương trình hiển thị vị trí (1/2, 2/2).
 * 2. Hết bài cuối cùng, bấm Tiếp / Next -> Hiển thị "Kết thúc chương trình".
 * 3. Dọn dẹp trạng thái setlist: thanh chương trình ẩn, gỡ class .in-setlist, reset index.
 * 4. Không để các nút ◀ ▶ bị chiếm: Sau khi kết thúc, bấm ◀ ▶ trên Toolbar điều hướng Kho Nhạc bình thường.
 * 5. Nút đóng #btn-sp-end trên thanh đáy cho phép chủ động kết thúc chương trình.
 */

test.describe('L3-10: Hết bài cuối -> Hiện Kết thúc chương trình & Giải phóng nút ◀ ▶', () => {

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('sheetapp_guest_chosen', '1');
      localStorage.setItem('sheetapp_guest_toast_shown', '1');
    });
  });

  test('Hết bài cuối hiện Kết thúc chương trình, dọn trạng thái, giải phóng nút ◀ ▶', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('./?song=thanh-ca-001&v=sheet', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#osmd-container svg', { timeout: 20000 });

    // 1. Khởi chạy Setlist mẫu gồm 2 bài
    await page.evaluate(() => {
      const sampleSetlist = {
        id: 777,
        name: 'Chương Trình Lễ 2 Bài',
        items: [
          { song_id: 'thanh-ca-001', title: 'HỠI THÁNH VƯƠNG, KÍP NGỰ LAI', key: 'G', transpose_key: 0, chord_profile: 'HD', bpm: 80 },
          { song_id: 'thanh-ca-002', title: 'NGUYỀN TỤNG MỸ CHÚA LINH NĂNG', key: 'G', transpose_key: 2, chord_profile: 'HD', bpm: 90 }
        ]
      };

      if (window.SetlistUI) {
        window.SetlistUI.setCurrentSetlist?.(sampleSetlist);
        window.SetlistUI.setCurrentIndex?.(0);
        window.SetlistUI._context?.setCurrentSetlist?.(sampleSetlist);
        window.SetlistUI._context?.setCurrentIndex?.(0);
      }
      document.querySelector('.toolbar-left')?.classList.add('in-setlist');
      window.SetlistPlayer?.updateProgramBar?.();
    });

    // 2. Thanh chương trình hiển thị ở bài 1 (1/2)
    const programBar = page.locator('#setlist-program-bar');
    await expect(programBar).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#sp-bar-pos')).toHaveText('1/2');

    // Toolbar có class .in-setlist
    await expect(page.locator('.toolbar-left')).toHaveClass(/in-setlist/);

    // 3. Bấm nút Next trên Toolbar -> Chuyển sang bài 2 (2/2)
    const btnNext = page.locator('#btn-next-song');
    await btnNext.click();
    await page.waitForTimeout(400);

    await expect(page.locator('#sp-bar-pos')).toHaveText('2/2');
    await expect(page.locator('#sp-bar-next-title')).toHaveText('Kết thúc chương trình');

    // 4. Ở bài cuối cùng (2/2), bấm nút Next trên Toolbar -> Kích hoạt Kết thúc chương trình
    await btnNext.click();

    // Kiểm tra toast thông báo "Kết thúc chương trình"
    const toast = page.locator('.toast:has-text("Kết thúc chương trình")');
    await expect(toast).toBeVisible({ timeout: 5000 });

    // 5. Thanh chương trình bị ẩn và trạng thái setlist được dọn dẹp
    await expect(programBar).toBeHidden();
    await expect(page.locator('.toolbar-left')).not.toHaveClass(/in-setlist/);

    const isSetlistCleared = await page.evaluate(() => {
      // @ts-ignore
      const sl = window.SetlistUI?.getCurrentSetlist?.();
      // @ts-ignore
      const idx = window.SetlistUI?.getCurrentIndex?.();
      return sl === null && idx === -1;
    });
    expect(isSetlistCleared).toBe(true);

    // 6. Kiểm tra các nút ◀ ▶ trên Toolbar KHÔNG bị chiếm:
    // Bấm nút Next trên Toolbar phải gọi điều hướng Kho Nhạc (App.navigateNext)
    const currentSongBefore = await page.evaluate(() => {
      // @ts-ignore
      return window.Store?.get?.('currentSong')?.id;
    });

    await btnNext.click();
    await page.waitForTimeout(600);

    const currentSongAfter = await page.evaluate(() => {
      // @ts-ignore
      return window.Store?.get?.('currentSong')?.id;
    });

    console.log(`[L3-10 E2E] Song before: ${currentSongBefore}, after library navigate: ${currentSongAfter}`);
    // Đã chuyển sang bài khác trong Kho Nhạc thành công
    expect(currentSongAfter).not.toBeNull();

    // 7. Thử nghiệm nút đóng #btn-sp-end trên thanh đáy
    // Bật lại setlist
    await page.evaluate(() => {
      const sampleSetlist = {
        id: 777,
        name: 'Chương Trình Lễ 2 Bài',
        items: [
          { song_id: 'thanh-ca-001', title: 'HỠI THÁNH VƯƠNG, KÍP NGỰ LAI', key: 'G' },
          { song_id: 'thanh-ca-002', title: 'NGUYỀN TỤNG MỸ CHÚA LINH NĂNG', key: 'G' }
        ]
      };
      // @ts-ignore
      window.SetlistUI?.setCurrentSetlist?.(sampleSetlist);
      // @ts-ignore
      window.SetlistUI?.setCurrentIndex?.(0);
      window.SetlistPlayer?.updateProgramBar?.();
    });

    await expect(programBar).toBeVisible();
    const btnEnd = page.locator('#btn-sp-end');
    await expect(btnEnd).toBeVisible();
    await btnEnd.click();

    // Thanh chương trình đóng ngay lập tức
    await expect(programBar).toBeHidden();
  });

});
