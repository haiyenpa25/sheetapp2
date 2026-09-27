// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * e2e/library-l3-setlist-item-customization.spec.js
 *
 * Kiểm thử E2E cho Ticket L3-3 (ROADMAP4 Mục 8):
 * - Mỗi mục trong setlist lưu: tông, BPM, bộ hợp âm, khổ sẽ hát (ví dụ "1, 3, 4"),
 *   ghi chú ca trưởng (leader_notes đã có trong schema).
 * - Hiện ghi chú ở đầu bài dạng dải vàng có thể thu gọn / mở rộng.
 * - Nghiệm thu: E2E mục có khổ "1,3" thì chế độ Một khổ chỉ chạy qua khổ 1 và 3.
 */

test.describe('L3-3 · Khổ sẽ hát & Ghi chú ca trưởng trên dải vàng thu gọn', () => {

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('sheetapp_guest_chosen', '1');
      localStorage.setItem('sheetapp_guest_toast_shown', '1');
    });
  });

  test('1. Nghiệm thu: Dải vàng ghi chú ca trưởng hiển thị, thu gọn/mở rộng; Chế độ Một khổ với "1,3" chỉ chạy qua khổ 1 và 3', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('./?song=thanh-ca-001&v=sheet', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });

    // Khởi tạo setlist mẫu có bài 001 với selected_verses = "1, 3" và leader_notes
    await page.evaluate(async () => {
      const sampleSetlist = {
        id: 888,
        name: 'Chương trình Thờ Phượng L3-3',
        items: [
          {
            id: 101,
            song_id: 'thanh-ca-001',
            title: 'HỠI THÁNH VƯƠNG, KÍP NGỰ LAI',
            key: 'G',
            transpose_key: 0,
            chord_profile: 'HD',
            bpm: 76,
            selected_verses: '1, 3',
            leader_notes: 'Intro Piano 4 ô nhịp, solo guitar dạo giang tấu'
          },
          {
            id: 102,
            song_id: 'thanh-ca-002',
            title: 'NGUYỀN TỤNG MỸ CHÚA LINH NĂNG',
            key: 'G',
            transpose_key: 0,
            chord_profile: 'HD',
            bpm: 90,
            selected_verses: null,
            leader_notes: null
          }
        ]
      };

      if (window.SetlistUI) {
        window.SetlistUI.setCurrentSetlist?.(sampleSetlist);
        window.SetlistUI.setCurrentIndex?.(0);
        window.SetlistUI._context?.setCurrentSetlist?.(sampleSetlist);
        window.SetlistUI._context?.setCurrentIndex?.(0);
      }

      // Phát item 0 của setlist
      if (window.SetlistPlayer?.playCurrentItem) {
        await window.SetlistPlayer.playCurrentItem();
      }
    });

    // ── KIỂM TRA 1: DẢI VÀNG GHI CHÚ CA TRƯỞNG ──
    const banner = page.locator('#leader-notes-banner');
    await expect(banner).toBeVisible({ timeout: 10000 });
    await expect(banner).not.toHaveClass(/hidden/);

    const bannerText = page.locator('#leader-notes-text');
    await expect(bannerText).toContainText('Intro Piano 4 ô nhịp, solo guitar dạo giang tấu');

    // Nút toggle thu gọn
    const toggleBtn = page.locator('#btn-toggle-leader-notes');
    await expect(toggleBtn).toBeVisible();
    await expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#ln-toggle-label')).toHaveText('Thu gọn');

    // Click nút Thu gọn -> dải vàng thu gọn dạng thanh mỏng
    await toggleBtn.click();
    await expect(banner).toHaveClass(/collapsed/);
    await expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('#ln-toggle-label')).toHaveText('Mở rộng');
    await expect(page.locator('#ln-toggle-icon')).toHaveText('▼');

    // Click lại nút Mở rộng -> bung ra đầy đủ
    await toggleBtn.click();
    await expect(banner).not.toHaveClass(/collapsed/);
    await expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#ln-toggle-label')).toHaveText('Thu gọn');
    await expect(page.locator('#ln-toggle-icon')).toHaveText('▲');

    // ── KIỂM TRA 2: CHẾ ĐỘ MỘT KHỔ VỚI MỤC CÓ KHỔ "1, 3" ──
    // Kích hoạt chế độ Một khổ
    await page.evaluate(() => {
      window.VerseManager?.setMode?.('single');
    });

    // Xác nhận đang ở chế độ Một khổ và đang xem Khổ 1
    const currentVerse1 = await page.evaluate(() => window.VerseManager?.getCurrentVerse?.());
    expect(currentVerse1).toBe(1);

    const indicator = page.locator('#verse-indicator');
    await expect(indicator).toHaveText('1/2'); // Có 2 khổ được chọn: 1 và 3

    // Bấm Next Verse (nút ◀ ▶ trên Toolbar)
    const btnNext = page.locator('#btn-verse-next');
    await btnNext.click();

    // Xác nhận nhảy trực tiếp sang Khổ 3 (bỏ qua Khổ 2!)
    const currentVerse2 = await page.evaluate(() => window.VerseManager?.getCurrentVerse?.());
    expect(currentVerse2).toBe(3);
    await expect(indicator).toHaveText('3/2');

    // Bấm Next Verse lần nữa -> quay vòng về Khổ 1 (bỏ qua Khổ 4!)
    await btnNext.click();
    const currentVerse3 = await page.evaluate(() => window.VerseManager?.getCurrentVerse?.());
    expect(currentVerse3).toBe(1);
    await expect(indicator).toHaveText('1/2');

    // Bấm Prev Verse (lùi) -> quay về Khổ 3
    const btnPrev = page.locator('#btn-verse-prev');
    await btnPrev.click();
    const currentVerse4 = await page.evaluate(() => window.VerseManager?.getCurrentVerse?.());
    expect(currentVerse4).toBe(3);
    await expect(indicator).toHaveText('3/2');

    // ── KIỂM TRA 3: CHUYỂN SANG BÀI 2 KHÔNG CÓ GHI CHÚ ──
    // Chuyển sang bài 2 trong setlist (không có leader_notes và selected_verses)
    await page.evaluate(async () => {
      if (window.SetlistUI) {
        window.SetlistUI.setCurrentIndex?.(1);
        window.SetlistUI._context?.setCurrentIndex?.(1);
      }
      if (window.SetlistPlayer?.playCurrentItem) {
        await window.SetlistPlayer.playCurrentItem();
      }
    });

    // Dải vàng tự động ẩn ở bài không có ghi chú
    await expect(banner).toHaveClass(/hidden/);

    // VerseManager tự do duyệt toàn bộ các khổ ở bài 2
    const availableVerses2 = await page.evaluate(() => window.VerseManager?.getAvailableVerses?.() || []);
    expect(availableVerses2.length).toBeGreaterThan(1);
    const selectedVerses2 = await page.evaluate(() => window.VerseManager?.getSelectedVerses?.());
    expect(selectedVerses2).toBeNull();
  });

});
