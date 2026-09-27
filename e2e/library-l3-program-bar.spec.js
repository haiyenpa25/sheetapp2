// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * e2e/library-l3-program-bar.spec.js
 *
 * Kiểm thử E2E cho Ticket L3-1 (ROADMAP4 Mục 8):
 * - Thanh chương trình (40px, cạnh dưới) khi phát setlist: "2/5 · Tiếp: Ca Cảm Tạ (F→G)" + ◀ ▶ lớn
 * - Ở chế độ Sân khấu thu thành dòng nhỏ trong HUD
 * - Nghiệm thu: E2E với setlist 5 bài
 */

test.describe('L3-1 · Thanh chương trình 40px cạnh dưới & HUD Sân khấu', () => {

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('sheetapp_guest_chosen', '1');
      localStorage.setItem('sheetapp_guest_toast_shown', '1');
    });
  });

  test('1. Nghiệm thu: Phát setlist 5 bài -> Thanh 40px cạnh dưới, điều hướng ◀ ▶, thu vào HUD khi vào Sân khấu', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('./?song=thanh-ca-001&v=sheet', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });

    // Khởi tạo setlist 5 bài mẫu qua JS
    await page.evaluate(() => {
      const sampleSetlist = {
        id: 999,
        name: 'Chương trình Thánh Lễ 5 bài',
        items: [
          { song_id: 'thanh-ca-001', title: 'HỠI THÁNH VƯƠNG, KÍP NGỰ LAI', key: 'G', transpose_key: 0, chord_profile: 'HD', bpm: 80 },
          { song_id: 'thanh-ca-002', title: 'NGUYỀN TỤNG MỸ CHÚA LINH NĂNG', key: 'G', transpose_key: 2, chord_profile: 'HD', bpm: 90 },
          { song_id: 'thanh-ca-003', title: 'NGỢI GIÊ-HÔ-VA THÁNH ĐẾ', key: 'C', transpose_key: 0, chord_profile: 'HD', bpm: 75 },
          { song_id: 'thanh-ca-004', title: 'HA-LÊ-LU-GIA !  VINH DANH NGÀI !', key: 'D', transpose_key: -1, chord_profile: 'HD', bpm: 100 },
          { song_id: 'thanh-ca-005', title: 'MUÔN DÂN TRÊN HOÀN CẦU NÊN CA XƯỚNG', key: 'Bb', transpose_key: 0, chord_profile: 'HD', bpm: 85 }
        ]
      };

      // Đưa setlist vào context của SetlistUI và SetlistPlayer
      if (window.SetlistUI) {
        window.SetlistUI.setCurrentSetlist?.(sampleSetlist);
        window.SetlistUI.setCurrentIndex?.(0);
        window.SetlistUI._context?.setCurrentSetlist?.(sampleSetlist);
        window.SetlistUI._context?.setCurrentIndex?.(0);
      }
      window.SetlistPlayer?.updateProgramBar?.();
    });

    const programBar = page.locator('#setlist-program-bar');
    await expect(programBar).toBeVisible({ timeout: 10000 });

    // 1. Kiểm tra kích thước và vị trí: Thanh cao đúng 40px và nằm ở cạnh dưới màn hình
    const barBox = await programBar.boundingBox();
    expect(barBox).not.toBeNull();
    if (barBox) {
      expect(Math.round(barBox.height)).toBe(40);
      expect(barBox.y + barBox.height).toBeGreaterThanOrEqual(798); // gắn sát đáy 800px
    }

    // 2. Kiểm tra nội dung ở bài 1 (1/5): Bài tiếp theo có dịch tông (G→A)
    const posEl = page.locator('#sp-bar-pos');
    await expect(posEl).toHaveText('1/5');

    const nextTitleEl = page.locator('#sp-bar-next-title');
    await expect(nextTitleEl).toContainText(/NGUYỀN TỤNG MỸ CHÚA/i);

    const nextKeyEl = page.locator('#sp-bar-next-key');
    await expect(nextKeyEl).toHaveText('(G→A)');

    // Nút ◀ bị disabled ở bài đầu tiên
    const prevBtn = page.locator('#btn-sp-prev');
    await expect(prevBtn).toBeDisabled();

    // Nút ▶ enabled
    const nextBtn = page.locator('#btn-sp-next');
    await expect(nextBtn).toBeEnabled();

    // 3. Chuyển sang bài 2 (2/5)
    await page.evaluate(() => {
      window.SetlistUI.setCurrentIndex?.(1);
      window.SetlistUI._context?.setCurrentIndex?.(1);
      window.SetlistPlayer?.updateProgramBar?.();
    });

    await expect(posEl).toHaveText('2/5');
    await expect(nextTitleEl).toContainText(/NGỢI GIÊ-HÔ-VA THÁNH ĐẾ/i);
    await expect(nextKeyEl).toHaveText('(Bb)');
    await expect(prevBtn).toBeEnabled();
    await expect(nextBtn).toBeEnabled();

    // 4. Vào chế độ Sân khấu (Biểu Diễn / Gig Mode): Thanh đáy thu vào HUD
    const btnGig = page.locator('#btn-fullscreen');
    await btnGig.click();
    await page.waitForTimeout(500);

    // Thanh bottom 40px bị ẩn
    await expect(programBar).toBeHidden();

    // Dòng HUD sân khấu hiển thị
    const gigSetlistRow = page.locator('#gig-hud-setlist-row');
    await expect(gigSetlistRow).toBeVisible();
    await expect(page.locator('#gig-sp-pos')).toHaveText('2/5');
    await expect(page.locator('#gig-sp-next')).toContainText(/NGỢI GIÊ-HÔ-VA THÁNH ĐẾ/i);

    // 5. Thoát chế độ Sân khấu
    await page.evaluate(() => {
      if (window.ModeManager?.togglePerformance) {
        window.ModeManager.togglePerformance();
      } else {
        document.getElementById('btn-gig-exit')?.click();
      }
    });
    await page.waitForTimeout(500);

    // Thanh bottom 40px hiển thị lại
    await expect(programBar).toBeVisible();

    // 6. Kiểm tra ở bài cuối cùng (5/5)
    await page.evaluate(() => {
      window.SetlistUI.setCurrentIndex?.(4);
      window.SetlistUI._context?.setCurrentIndex?.(4);
      window.SetlistPlayer?.updateProgramBar?.();
    });

    await expect(posEl).toHaveText('5/5');
    await expect(nextTitleEl).toHaveText('Kết thúc chương trình');
    await expect(nextBtn).toBeDisabled();
    await expect(prevBtn).toBeEnabled();
  });
});
