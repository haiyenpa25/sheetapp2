// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * e2e/library-r1-4-section-jump-bar.spec.js
 *
 * Kiểm thử E2E Ticket R1-4 (ROADMAP5.md):
 * 1. Mở bài hát bình thường: dải phân đoạn #section-jump-bar-container BỊ ẨN để tối ưu diện tích khuông nhạc.
 * 2. Vào chế độ Biểu Diễn (⚡ #btn-fullscreen): dải phân đoạn tự động HIỂN THỊ với các chip điều hướng.
 * 3. Chuẩn hóa nhãn phân đoạn tiếng Việt: Dạo đầu / Phiên khúc 1 / Điệp khúc / Kết.
 * 4. Không dùng emoji, sử dụng Lucide SVG icons cho các chip.
 * 5. Thoát Biểu Diễn (Escape): dải phân đoạn tự động ẩn trở lại.
 * 6. Đang phát chương trình (setlist / in-setlist): dải phân đoạn HIỂN THỊ.
 */

test.describe('R1-4 · Dải Phân Đoạn Có Điều Kiện & Chuẩn Hóa Nhãn Tiếng Việt', () => {

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('sheetapp_guest_chosen', '1');
      localStorage.setItem('sheetapp_guest_toast_shown', '1');
    });
  });

  test('Mở bài thường -> dải ẩn; Biểu Diễn -> dải hiện + nhãn chuẩn tiếng Việt + icon SVG', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });

    const jumpBar = page.locator('#section-jump-bar-container');

    // 1. Mở bài bình thường: Dải phân đoạn phải BỊ ẨN
    await expect(jumpBar).toBeHidden({ timeout: 5000 });

    // 2. Vào chế độ Biểu Diễn qua nút #btn-fullscreen
    const btnGig = page.locator('#btn-fullscreen');
    await btnGig.click();

    // 3. Dải phân đoạn HIỂN THỊ trong chế độ Biểu Diễn
    await expect(jumpBar).toBeVisible({ timeout: 5000 });

    // 4. Kiểm tra các chips có đủ 4 phân đoạn chuẩn tiếng Việt
    const chips = page.locator('#section-chips-list .section-chip');
    await expect(chips).toHaveCount(4, { timeout: 5000 });

    // Nhãn hiển thị phải là tiếng Việt chuẩn mực Tin Lành
    await expect(chips.nth(0)).toContainText('Dạo đầu');
    await expect(chips.nth(1)).toContainText('Phiên khúc 1');
    await expect(chips.nth(2)).toContainText('Điệp khúc');
    await expect(chips.nth(3)).toContainText('Kết');

    // 5. Kiểm tra icon bên trong chip dùng Lucide SVG (<use href="#icon-...">), 0 emoji trần
    const svgIcons = chips.locator('svg use');
    const svgCount = await svgIcons.count();
    expect(svgCount).toBeGreaterThanOrEqual(4);

    const hasNoEmojis = await chips.evaluateAll(elements => {
      const emojiRegex = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
      return elements.every(el => !emojiRegex.test(el.textContent || ''));
    });
    expect(hasNoEmojis).toBe(true);

    // 6. Chạm vào chip Điệp khúc -> kích hoạt active
    const chorusChip = chips.nth(2);
    await chorusChip.click();
    await expect(chorusChip).toHaveClass(/active/, { timeout: 3000 });

    // 7. Thoát chế độ Biểu Diễn
    await page.evaluate(() => window.ModeManager?.resetToView?.());
    await expect(jumpBar).toBeHidden({ timeout: 5000 });

    // 8. Đang phát chương trình (in-setlist) -> Dải phân đoạn hiển thị
    await page.evaluate(() => {
      document.querySelector('.toolbar-left')?.classList.add('in-setlist');
      window.EventBus?.emit?.('setlist:played');
    });

    await expect(jumpBar).toBeVisible({ timeout: 5000 });

    // Kết thúc chương trình -> Dải phân đoạn ẩn đi
    await page.evaluate(() => {
      document.querySelector('.toolbar-left')?.classList.remove('in-setlist');
      window.EventBus?.emit?.('setlist:ended');
    });

    await expect(jumpBar).toBeHidden({ timeout: 5000 });
  });

});
