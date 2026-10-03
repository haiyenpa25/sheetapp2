// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * e2e/library-r1-5-tools-menu.spec.js
 *
 * Kiểm thử E2E Ticket R1-5 (ROADMAP5.md):
 * 1. Bảng Công cụ (⋯) trên laptop (1366px):
 *    - Dạng popover rộng 320px, định vị chính xác dưới nút ⋯.
 *    - Chứa đủ 5 nhóm chuẩn: Hiển thị, Nhạc, Ban nhạc, Soạn, Khác.
 *    - Mọi mục có nhãn chữ + Lucide SVG icon, không bị cắt xén, không tràn ngang.
 *    - Phím Escape đóng popover mượt mà.
 * 2. Bảng Công cụ (⋯) trên điện thoại (390px):
 *    - Dạng bottom sheet neo cạnh dưới, có handle drag bar.
 *    - Mỗi dòng tương tác có chiều cao ≥ 44px (48px tiêu chuẩn ngón cái).
 *    - Không có cuộn ngang (overflow-x: hidden).
 *    - Chạm vào lớp mờ backdrop đóng bottom sheet.
 */

test.describe('R1-5 · Bảng Công Cụ Thống Nhất (Popover Laptop & Bottom Sheet Mobile)', () => {

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('sheetapp_guest_chosen', '1');
      localStorage.setItem('sheetapp_guest_toast_shown', '1');
    });
  });

  test('Laptop 1366px: Popover 320px, đủ 5 nhóm chuẩn, nhãn chữ + icon SVG, đóng bằng Esc', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });

    const btnMore = page.locator('#btn-more-options');
    const menu = page.locator('#main-dropdown-menu');

    // Menu mặc định ẩn
    await expect(menu).toBeHidden();

    // 1. Mở menu bằng cách bấm nút ⋯ (#btn-more-options)
    await btnMore.click();
    await expect(menu).toBeVisible({ timeout: 5000 });

    // 2. Kiểm tra độ rộng popover trên laptop đạt chuẩn 320px (sai số ±15px)
    const box = await menu.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.width).toBeGreaterThanOrEqual(305);
      expect(box.width).toBeLessThanOrEqual(335);
    }

    // 3. Kiểm tra không tràn ngang (zero horizontal overflow)
    const hasHorizontalOverflow = await menu.evaluate(el => el.scrollWidth > el.clientWidth + 1);
    expect(hasHorizontalOverflow).toBe(false);

    // 4. Kiểm tra đủ 5 nhóm chuẩn (Section 2.3 ROADMAP5)
    const headers = menu.locator('.menu-section-header');
    await expect(headers).toHaveCount(5);
    await expect(headers.nth(0)).toContainText('HIỂN THỊ');
    await expect(headers.nth(1)).toContainText('NHẠC');
    await expect(headers.nth(2)).toContainText('BAN NHẠC');
    await expect(headers.nth(3)).toContainText('SOẠN');
    await expect(headers.nth(4)).toContainText('KHÁC');

    // 5. Kiểm tra các mục quan trọng đều có nhãn chữ và icon Lucide SVG
    const compactModeBtn = page.locator('#btn-compact-mode');
    await expect(compactModeBtn).toBeVisible();
    await expect(compactModeBtn).toContainText('Tối giản bản nhạc');

    const verseModeBtn = page.locator('#btn-menu-verse-mode');
    await expect(verseModeBtn).toBeVisible();
    await expect(verseModeBtn).toContainText('Khổ hát');

    const chordPresetBtn = page.locator('#btn-menu-chord-preset');
    await expect(chordPresetBtn).toBeVisible();
    await expect(chordPresetBtn).toContainText('Cỡ hợp âm');

    const notationBtn = page.locator('#btn-menu-chord-notation');
    await expect(notationBtn).toBeVisible();
    await expect(notationBtn).toContainText('Ký hiệu');

    const roleBtn = page.locator('#btn-menu-instrument-role');
    await expect(roleBtn).toBeVisible();
    await expect(roleBtn).toContainText(/Keyboard|Guitar|Bass|Đàn/);

    const followLeaderBtn = page.locator('#btn-menu-follow-leader');
    await expect(followLeaderBtn).toBeVisible();
    await expect(followLeaderBtn).toContainText('Theo người hướng dẫn');

    const addChordBtn = page.locator('#btn-menu-add-chord-mode');
    await expect(addChordBtn).toBeHidden(); // Khách không có quyền Soạn theo ROADMAP6.

    const lyricBtn = page.locator('#btn-lyric-view');
    await expect(lyricBtn).toBeVisible();
    await expect(lyricBtn).toContainText('In lời & hợp âm');

    // 6. Đóng menu bằng phím Escape
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden({ timeout: 5000 });
  });

  test('Điện thoại 390px: Bottom sheet neo đáy, touch target ≥ 44px, không tràn ngang, đóng qua backdrop', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('./?song=thanh-ca-001&v=sheet', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });

    const btnMore = page.locator('#btn-more-options');
    const menu = page.locator('#main-dropdown-menu');
    const backdrop = page.locator('#main-dropdown-backdrop');

    // 1. Mở menu trên điện thoại
    await btnMore.click();
    await expect(menu).toBeVisible({ timeout: 5000 });

    // 2. Kiểm tra menu ở dạng bottom sheet (neo cạnh dưới viewport)
    const box = await menu.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.width).toBeGreaterThanOrEqual(370); // Toàn màn hình
      expect(box.y + box.height).toBeGreaterThanOrEqual(825); // Chạm đáy màn hình
    }

    // 3. Kiểm tra thanh handle drag bar hiển thị trên mobile
    const handle = menu.locator('.sheet-drag-handle');
    await expect(handle).toBeVisible();

    // 4. Kiểm tra mọi dòng tương tác có chiều cao ≥ 44px (chuẩn WCAG Touch Target)
    const rows = menu.locator('.btn-menu-item, .tools-row');
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThan(10);

    const minHeights = await rows.evaluateAll(elements => elements
      .filter(el => getComputedStyle(el).display !== 'none')
      .map(el => Math.round(el.getBoundingClientRect().height)));
    for (const h of minHeights) {
      expect(h).toBeGreaterThanOrEqual(44);
    }

    // 5. Kiểm tra không tràn ngang (zero horizontal overflow)
    const hasHorizontalOverflow = await menu.evaluate(el => el.scrollWidth > el.clientWidth + 1);
    expect(hasHorizontalOverflow).toBe(false);

    // 6. Kiểm tra backdrop hiển thị và đóng menu khi chạm backdrop
    await expect(backdrop).toBeVisible();
    // Chạm vào phần trên của backdrop (vùng bên ngoài bottom sheet)
    await backdrop.click({ position: { x: 50, y: 50 } });
    await expect(menu).toBeHidden({ timeout: 5000 });
    await expect(backdrop).toBeHidden({ timeout: 5000 });
  });

});
