// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * e2e/library-l1-verse-selection.spec.js
 *
 * Kiểm thử E2E cho Ticket L1-6 ⭐: Chọn khổ (Điểm khác biệt số 1 của SheetApp):
 * - Lọc <lyric number> trong MusicXML trước khi đưa vào OSMD render
 * - 3 chế độ:
 *   1. 'all'    — Tất cả khổ (như sách in gốc, hiển thị toàn bộ 5 dòng lời)
 *   2. 'single' — Một khổ (chỉ giữ lời của khổ được chọn, 1 dòng lời dưới mỗi hàng nhạc, to rõ)
 *   3. 'unroll' — Trải khổ (bài lặp lại lần lượt Khổ 1 → 2 → 3... để cuộn một chiều từ trên xuống dưới)
 * - Điều khiển: Nút trên toolbar (#verse-pill), nút trong Gig HUD (#btn-gig-verse), phím tắt V / Shift+V
 * - Tiêu chuẩn: Bài 002 (5 khổ) hoạt động mượt mà, chuyển khổ tức thì.
 */

test.describe('L1-6 · Chọn khổ (Verse Selection & Unrolling)', () => {

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('sheetapp_guest_chosen', '1');
      localStorage.setItem('sheetapp_guest_toast_shown', '1');
      // Đặt chế độ mặc định ban đầu là 'all' để đảm bảo tính độc lập
      localStorage.setItem('sheetapp_verse_mode', 'all');
    });
  });

  test('1. Mặc định (Tất cả khổ): Hiển thị cụm #verse-pill trên toolbar và đầy đủ các khổ', async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 820 });
    await page.goto('./?song=thanh-ca-002', { waitUntil: 'domcontentloaded' });

    const osmdSvg = page.locator('#osmd-container svg').first();
    await expect(osmdSvg).toBeVisible({ timeout: 25000 });

    // Cụm chọn khổ #verse-pill hiển thị trên toolbar
    const versePill = page.locator('#verse-pill');
    await expect(versePill).toBeVisible();

    const modeLabel = page.locator('#verse-mode-label');
    await expect(modeLabel).toHaveText('Tất cả khổ');

    // Chế độ 'all' không hiện nút điều hướng ◀ 1/5 ▶
    const navControls = page.locator('#verse-nav-controls');
    await expect(navControls).toBeHidden();

    // Trong SVG OSMD hiển thị nhiều thẻ text tương ứng với các khổ
    await expect.poll(async () => {
      const texts = await page.locator('#osmd-container svg text').allTextContents();
      return texts.join(' ');
    }, { timeout: 10000 }).toContain('1.Thờ');

    const joinedText = (await page.locator('#osmd-container svg text').allTextContents()).join(' ');
    expect(joinedText).toContain('2.Thờ');
  });

  test('2. Chế độ Một khổ (Single): Chỉ hiển thị 1 dòng lời của khổ đã chọn', async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 820 });
    await page.goto('./?song=thanh-ca-002', { waitUntil: 'domcontentloaded' });

    const osmdSvg = page.locator('#osmd-container svg').first();
    await expect(osmdSvg).toBeVisible({ timeout: 25000 });

    // Bấm nút chuyển sang chế độ 'single'
    const btnMode = page.locator('#btn-verse-mode');
    await btnMode.click();

    // Mode label cập nhật và bộ điều hướng hiện ra
    const modeLabel = page.locator('#verse-mode-label');
    await expect(modeLabel).toHaveText('Một khổ');

    const navControls = page.locator('#verse-nav-controls');
    await expect(navControls).toBeVisible();

    const indicator = page.locator('#verse-indicator');
    await expect(indicator).toHaveText('1/5');

    // Chờ bản nhạc re-render và kiểm tra trong SVG: có lời khổ 1 nhưng KHÔNG CÒN lời khổ 2, 3
    await expect.poll(async () => {
      const texts = await page.locator('#osmd-container svg text').allTextContents();
      return texts.join(' ');
    }, { timeout: 10000 }).toContain('1.Thờ');

    const joinedText = (await page.locator('#osmd-container svg text').allTextContents()).join(' ');
    expect(joinedText).not.toContain('2.Thờ');
    expect(joinedText).not.toContain('3.Thờ');
  });

  test('3. Chuyển khổ bằng nút ◀ ▶ và phím V / Shift+V', async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 820 });
    await page.goto('./?song=thanh-ca-002', { waitUntil: 'domcontentloaded' });

    const osmdSvg = page.locator('#osmd-container svg').first();
    await expect(osmdSvg).toBeVisible({ timeout: 25000 });

    // Chuyển sang chế độ Một khổ
    await page.locator('#btn-verse-mode').click();
    const indicator = page.locator('#verse-indicator');
    await expect(indicator).toHaveText('1/5');

    // Bấm nút ▶ để sang khổ 2
    const btnNext = page.locator('#btn-verse-next');
    await btnNext.click();
    await expect(indicator).toHaveText('2/5');

    // Nhấn phím 'v' để sang khổ 3
    await page.keyboard.press('v');
    await expect(indicator).toHaveText('3/5');

    // Kiểm tra SVG hiển thị lời khổ 3 ("3.Thờ"), không có khổ 1, 2
    await expect.poll(async () => {
      const texts = await page.locator('#osmd-container svg text').allTextContents();
      return texts.join(' ');
    }, { timeout: 10000 }).toContain('3.Thờ');

    const joinedText3 = (await page.locator('#osmd-container svg text').allTextContents()).join(' ');
    expect(joinedText3).not.toContain('1.Thờ');
    expect(joinedText3).not.toContain('2.Thờ');

    // Nhấn phím Shift+V để lùi về khổ 2
    await page.keyboard.press('Shift+V');
    await expect(indicator).toHaveText('2/5');

    // Bấm nút ◀ để lùi về khổ 1
    const btnPrev = page.locator('#btn-verse-prev');
    await btnPrev.click();
    await expect(indicator).toHaveText('1/5');
  });

  test('4. Chế độ Trải khổ (Unroll): Nhân bản số ô nhịp để cuộn một chiều', async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 820 });
    await page.goto('./?song=thanh-ca-002', { waitUntil: 'domcontentloaded' });

    const osmdSvg = page.locator('#osmd-container svg').first();
    await expect(osmdSvg).toBeVisible({ timeout: 25000 });

    const initialHeight = await osmdSvg.evaluate(el => el.getBoundingClientRect().height);

    // Bấm chuyển từ 'all' -> 'single'
    await page.locator('#btn-verse-mode').click();
    await expect(page.locator('#verse-mode-label')).toHaveText('Một khổ');

    // Bấm chuyển từ 'single' -> 'unroll'
    await page.locator('#btn-verse-mode').click();
    await expect(page.locator('#verse-mode-label')).toHaveText('Trải khổ');

    // Chờ render bản unroll: chiều cao tăng vượt trội
    await expect.poll(async () => {
      return await page.locator('#osmd-container svg').first().evaluate(el => el.getBoundingClientRect().height);
    }, { timeout: 15000 }).toBeGreaterThan(initialHeight * 1.5);

    // Xác nhận cả 5 khổ đều xuất hiện
    const unrolledTexts = await page.locator('#osmd-container svg text').allTextContents();
    const unrolledJoined = unrolledTexts.join(' ');
    expect(unrolledJoined).toContain('1.Thờ');
    expect(unrolledJoined).toContain('2.Thờ');
    expect(unrolledJoined).toContain('3.Thờ');
  });

  test('5. Tích hợp trong Sân khấu thật (Gig Mode): Nút #btn-gig-verse chuyển khổ nhanh', async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 820 });
    await page.goto('./?song=thanh-ca-002', { waitUntil: 'domcontentloaded' });

    const osmdSvg = page.locator('#osmd-container svg').first();
    await expect(osmdSvg).toBeVisible({ timeout: 25000 });

    // Vào chế độ Một khổ
    await page.locator('#btn-verse-mode').click();
    await expect(page.locator('#verse-indicator')).toHaveText('1/5');

    // Vào Sân khấu (Gig Mode)
    await page.locator('#btn-fullscreen').click();
    await expect(page.locator('body')).toHaveClass(/sheet-only-mode/);

    // Nút chuyển khổ trong Gig HUD hiển thị
    const gigVerseBtn = page.locator('#btn-gig-verse');
    await expect(gigVerseBtn).toBeVisible();
    await expect(gigVerseBtn).toHaveText('Khổ 1/5');

    // Bấm nút chuyển khổ trên HUD
    await gigVerseBtn.click();
    await expect(gigVerseBtn).toHaveText('Khổ 2/5');

    // Nhấn phím 'v' trong Gig Mode
    await page.keyboard.press('v');
    await expect(gigVerseBtn).toHaveText('Khổ 3/5');
  });

});
