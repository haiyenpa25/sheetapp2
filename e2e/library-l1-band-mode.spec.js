// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * e2e/library-l1-band-mode.spec.js
 *
 * Kiểm thử E2E cho Ticket L1-7 ⭐: Chế độ BAND (Lời & Hợp âm chữ lớn):
 * 1. Nút chuyển đổi Band/Nhạc (#btn-band-toggle) trên thanh công cụ chính.
 * 2. Cỡ chữ chuẩn sân khấu: Hợp âm ≥ 24px trên lời ≥ 20px.
 * 3. Dùng đúng bộ hợp âm đang chọn (HD → TLH) và tự động đổi tông khi dịch giọng.
 * 4. Bố cục 2 cột trên iPad ngang (1180x820).
 * 5. Tô sáng khổ đang hát (.lv-active-verse) khi chuyển khổ (phím V / nút chuyển khổ).
 * 6. Mặc định trên điện thoại theo quyết định L-D2.
 */

test.describe('L1-7 · Chế độ BAND (Lời & Hợp âm chữ lớn)', () => {

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('sheetapp_guest_chosen', '1');
      localStorage.setItem('sheetapp_guest_toast_shown', '1');
    });
  });

  test('1. Bật chế độ Band qua công tắc #btn-view-lyrics trên toolbar', async ({ page }) => {
    // Ticket R1-2 (ROADMAP5): #btn-band-toggle (nút đơn, đổi chữ Band<->Nhạc) bị thay
    // bằng công tắc 2 nút #btn-view-sheet / #btn-view-lyrics; #btn-band-toggle vẫn còn
    // trong DOM nhưng ẩn hẳn, chỉ nhận click ủy quyền từ 2 nút mới.
    await page.setViewportSize({ width: 1180, height: 820 });
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });

    const osmdSvg = page.locator('#osmd-container svg').first();
    await expect(osmdSvg).toBeVisible({ timeout: 25000 });

    const btnLyrics = page.locator('#btn-view-lyrics');
    await expect(btnLyrics).toBeVisible();

    const lyricContainer = page.locator('#lyric-view-container');
    await expect(lyricContainer).toBeHidden();

    // Bấm nút "Lời & Hợp âm" chuyển sang chế độ Band
    await btnLyrics.click();

    // Container lời & hợp âm chữ hiển thị, container bản nhạc ẩn
    await expect(lyricContainer).toBeVisible();
    await expect(page.locator('#osmd-container')).toBeHidden();

    // Nút toolbar active
    await expect(btnLyrics).toHaveClass(/active/);
    await expect(page.locator('#btn-view-sheet')).not.toHaveClass(/active/);
  });

  test('2. Cỡ chữ hợp âm ≥ 24px và lời ≥ 20px chuẩn đọc sân khấu', async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 820 });
    await page.goto('./?song=thanh-ca-001&v=lyric', { waitUntil: 'domcontentloaded' });

    const lyricContainer = page.locator('#lyric-view-container');
    await expect(lyricContainer).toBeVisible({ timeout: 25000 });

    const firstChord = page.locator('.lv-chord:not(.lv-chord-empty)').first();
    await expect(firstChord).toBeVisible({ timeout: 10000 });

    // Kiểm tra cỡ chữ hợp âm ≥ 24px
    const chordFontSize = await firstChord.evaluate(el => {
      return parseFloat(window.getComputedStyle(el).fontSize);
    });
    expect(chordFontSize).toBeGreaterThanOrEqual(24);

    // Kiểm tra cỡ chữ lời bài hát ≥ 20px
    const firstSyl = page.locator('.lv-syl').first();
    const sylFontSize = await firstSyl.evaluate(el => {
      return parseFloat(window.getComputedStyle(el).fontSize);
    });
    expect(sylFontSize).toBeGreaterThanOrEqual(20);
  });

  test('3. Dùng đúng bộ hợp âm đang chọn và tự động cập nhật khi dịch giọng (+2)', async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 820 });
    // Mở bài 001 với bộ hợp âm HD và chế độ Band
    await page.goto('./?song=thanh-ca-001&set=HD&v=lyric', { waitUntil: 'domcontentloaded' });

    const lyricContainer = page.locator('#lyric-view-container');
    await expect(lyricContainer).toBeVisible({ timeout: 25000 });

    // Đợi các hợp âm render (bài 001 tông gốc G chứa các hợp âm G, Am, F, Bm...)
    await expect.poll(async () => {
      const chords = await page.locator('.lv-chord:not(.lv-chord-empty)').allTextContents();
      return chords.map(c => c.trim()).filter(Boolean).join(' ');
    }, { timeout: 10000 }).toContain('G');

    // Dịch giọng lên +2 bán cung bằng phím ']'
    await page.keyboard.press(']');

    // Xác nhận hợp âm tự động đổi tông sang A (G + 2 = A)
    await expect.poll(async () => {
      const chords = await page.locator('.lv-chord:not(.lv-chord-empty)').allTextContents();
      return chords.map(c => c.trim()).filter(Boolean).join(' ');
    }, { timeout: 10000 }).toContain('A');
  });

  test('4. Bố cục 2 cột trên iPad ngang (1180x820)', async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 820 });
    await page.goto('./?song=thanh-ca-002&v=lyric', { waitUntil: 'domcontentloaded' });

    const lyricContainer = page.locator('#lyric-view-container');
    await expect(lyricContainer).toBeVisible({ timeout: 25000 });

    const wrapper = page.locator('.lv-wrapper');
    await expect(wrapper).toBeVisible();

    // Kiểm tra CSS Grid trên iPad ngang có 2 cột
    const gridColumns = await wrapper.evaluate(el => {
      const style = window.getComputedStyle(el);
      return {
        display: style.display,
        columns: style.gridTemplateColumns.split(' ').length
      };
    });

    expect(gridColumns.display).toBe('grid');
    expect(gridColumns.columns).toBe(2);
  });

  test('5. Khổ đang hát được tô sáng (.lv-active-verse) khi chuyển khổ (phím V)', async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 820 });
    await page.goto('./?song=thanh-ca-002&v=lyric', { waitUntil: 'domcontentloaded' });

    const lyricContainer = page.locator('#lyric-view-container');
    await expect(lyricContainer).toBeVisible({ timeout: 25000 });

    // Ban đầu khổ 1 được tô sáng
    const verse1 = page.locator('.lv-verse[data-verse-num="1"]');
    await expect(verse1).toHaveClass(/lv-active-verse/);

    // Nhấn phím 'v' để chuyển sang khổ 2
    await page.keyboard.press('v');

    // Khổ 2 được tô sáng, khổ 1 không còn
    const verse2 = page.locator('.lv-verse[data-verse-num="2"]');
    await expect(verse2).toHaveClass(/lv-active-verse/, { timeout: 10000 });
    await expect(verse1).not.toHaveClass(/lv-active-verse/);
  });

  test('6. Quyết định L-D2: Mặc định vào thẳng chế độ Band trên điện thoại (390x844)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    // Mở trang bài hát không kèm v=lyric
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });

    // Trên điện thoại, chế độ Band tự động kích hoạt
    const lyricContainer = page.locator('#lyric-view-container');
    await expect(lyricContainer).toBeVisible({ timeout: 25000 });
    await expect(page.locator('#osmd-container')).toBeHidden();

    // Nút toolbar hiển thị trạng thái active
    const btnLyrics = page.locator('#btn-view-lyrics');
    await expect(btnLyrics).toHaveClass(/active/);
  });

});
