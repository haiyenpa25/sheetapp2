// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * e2e/library-l3-non-song-card.spec.js
 *
 * Kiểm thử E2E cho Ticket L3-4 (ROADMAP4 Mục 8):
 * - Mục không phải bài hát (Cầu nguyện, Kinh Thánh, Thông báo) hiện thành thẻ chờ.
 * - Kèm tổng thời lượng dự kiến của toàn bộ chương trình lễ.
 * - Nghiệm thu: E2E chạy trên cả Chromium và WebKit.
 */

test.describe('L3-4 · Thẻ chờ phụng vụ & Tổng thời lượng dự kiến', () => {

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('sheetapp_guest_chosen', '1');
      localStorage.setItem('sheetapp_guest_toast_shown', '1');
    });
  });

  test('1. Nghiệm thu: Mục không phải bài hát hiện thẻ chờ trang trọng, hiển thị đúng icon, badge, ghi chú, tổng thời lượng và chuyển tiếp mượt mà', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('./?song=thanh-ca-001&v=sheet', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });

    // Khởi tạo setlist phối hợp bài hát và tiết mục phụng vụ
    await page.evaluate(async () => {
      const sampleSetlist = {
        id: 777,
        name: 'Chương trình Buổi Nhóm L3-4',
        items: [
          {
            id: 201,
            song_id: 'thanh-ca-001',
            item_type: 'song',
            title: 'HỠI THÁNH VƯƠNG, KÍP NGỰ LAI',
            key: 'G',
            transpose_key: 0,
            chord_profile: 'HD',
            bpm: 80,
            duration_minutes: 5
          },
          {
            id: 202,
            song_id: '',
            item_type: 'prayer',
            custom_title: 'Cầu nguyện khai lễ & chúc phước',
            leader_notes: 'Mục sư chủ tọa cầu nguyện, ban nhạc lót piano êm dịu',
            duration_minutes: 4
          },
          {
            id: 203,
            song_id: '',
            item_type: 'scripture',
            custom_title: 'Đọc Lời Chúa: Thi Thiên 23',
            leader_notes: 'Chấp sự hướng dẫn hội chúng đọc đối đáp',
            duration_minutes: 3
          },
          {
            id: 204,
            song_id: 'thanh-ca-002',
            item_type: 'song',
            title: 'NGUYỀN TỤNG MỸ CHÚA LINH NĂNG',
            key: 'G',
            transpose_key: 0,
            chord_profile: 'HD',
            bpm: 90,
            duration_minutes: 6
          }
        ]
      };

      if (window.SetlistUI) {
        window.SetlistUI.setCurrentSetlist?.(sampleSetlist);
        window.SetlistUI.setCurrentIndex?.(0);
        window.SetlistUI._context?.setCurrentSetlist?.(sampleSetlist);
        window.SetlistUI._context?.setCurrentIndex?.(0);
      }

      if (window.SetlistPlayer?.playCurrentItem) {
        await window.SetlistPlayer.playCurrentItem();
      }
    });

    // ── GIAI ĐOẠN 1: MỤC 1 LÀ BÀI HÁT ──
    const sheetArea = page.locator('#sheet-area');
    const liturgyCard = page.locator('#liturgy-card');

    await expect(sheetArea).toBeVisible();
    await expect(liturgyCard).toHaveClass(/hidden/);

    // Thanh chương trình ở bài 1: hiện bài tiếp theo là Cầu nguyện
    const nextTitleEl = page.locator('#sp-bar-next-title');
    await expect(nextTitleEl).toContainText('Cầu nguyện khai lễ');

    // ── GIAI ĐOẠN 2: CHUYỂN SANG MỤC 2 (CẦU NGUYỆN) ──
    const btnNext = page.locator('#btn-sp-next');
    await btnNext.click();

    // Bản nhạc sheet-area tự động ẩn, Thẻ chờ liturgy-card hiển thị
    await expect(liturgyCard).toBeVisible({ timeout: 10000 });
    await expect(liturgyCard).not.toHaveClass(/hidden/);
    await expect(sheetArea).toHaveClass(/hidden/);

    // Kiểm tra nội dung thẻ chờ
    await expect(page.locator('#lc-icon')).toHaveText('🙏');
    await expect(page.locator('#lc-badge')).toHaveText('CẦU NGUYỆN');
    await expect(page.locator('#lc-title')).toHaveText('Cầu nguyện khai lễ & chúc phước');
    await expect(page.locator('#lc-notes-text')).toContainText('Mục sư chủ tọa cầu nguyện');
    await expect(page.locator('#lc-item-duration')).toContainText('4 phút');
    // Tổng thời lượng: 5 + 4 + 3 + 6 = 18 phút
    await expect(page.locator('#lc-total-duration')).toContainText('18 phút');

    // Nút chuyển tiếp trên Thẻ chờ hiển thị tên mục kế tiếp
    const btnCardNext = page.locator('#btn-lc-next');
    await expect(btnCardNext).toContainText('Đọc Lời Chúa: Thi Thiên 23');

    // ── GIAI ĐOẠN 3: BẤM NÚT TRÊN THẺ CHỜ ĐỂ SANG MỤC 3 (KINH THÁNH) ──
    await btnCardNext.click();

    await expect(liturgyCard).toBeVisible();
    await expect(page.locator('#lc-icon')).toHaveText('📖');
    await expect(page.locator('#lc-badge')).toHaveText('ĐỌC KINH THÁNH');
    await expect(page.locator('#lc-title')).toHaveText('Đọc Lời Chúa: Thi Thiên 23');
    await expect(page.locator('#lc-item-duration')).toContainText('3 phút');

    // ── GIAI ĐOẠN 4: CHUYỂN SANG MỤC 4 (BÀI HÁT) ──
    await btnCardNext.click();

    // Thẻ chờ tự động ẩn, Bản nhạc sheet-area hiển thị lại
    await expect(liturgyCard).toHaveClass(/hidden/);
    await expect(sheetArea).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });

    // Thanh chương trình hiện ở vị trí 4/4
    await expect(page.locator('#sp-bar-pos')).toHaveText('4/4');
  });

});
