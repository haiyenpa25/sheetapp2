// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * e2e/library-l2-quick-numpad.spec.js
 *
 * Kiểm thử E2E cho Ticket L2-5 (ROADMAP4 Mục 8):
 * - Bàn phím số nhanh (tuỳ chọn): nút "#" mở bàn phím số lớn, gõ 1-2-3 thì mở bài
 * - Nghiệm thu: E2E trên iPad (820x1180)
 * - Thao tác cảm ứng mượt mà trên màn hình lớn
 * - Hỗ trợ phím 0-9, Xóa C, Lùi ⌫, Mở bài tức thì
 */

test.describe('L2-5 · Bàn phím số nhanh (Quick Numpad)', () => {

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('sheetapp_guest_chosen', '1');
      localStorage.setItem('sheetapp_guest_toast_shown', '1');
    });
  });

  test('1. Nghiệm thu trên iPad: Bấm nút "#" mở bàn phím số lớn, gõ 1-2-3 và mở bài thanh-ca-123', async ({ page }) => {
    // 1. Giả lập iPad dọc (820x1180) theo yêu cầu nghiệm thu
    await page.setViewportSize({ width: 820, height: 1180 });
    await page.goto('./?song=thanh-ca-001&v=sheet', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });

    // 2. Trên iPad, mở sidebar nếu đang ở chế độ overlay đóng
    const sidebar = page.locator('#sidebar');
    const isSidebarClosed = await sidebar.evaluate(el => el.classList.contains('mobile-hidden') || el.getBoundingClientRect().right <= 0);
    if (isSidebarClosed) {
      await page.locator('#btn-open-sidebar').click();
      await expect(sidebar).not.toHaveClass(/mobile-hidden/);
      await page.waitForTimeout(300);
    }

    // 3. Tìm nút "#" trong thanh tìm kiếm sidebar
    const btnNumpad = page.locator('#btn-quick-numpad');
    await expect(btnNumpad).toBeVisible({ timeout: 15000 });
    await expect(btnNumpad).toHaveText('#');

    // 4. Chạm nút "#" để mở Bàn phím số lớn
    await btnNumpad.click();

    const numpadModal = page.locator('#modal-quick-numpad');
    await expect(numpadModal).toBeVisible();
    await expect(page.locator('#quick-numpad-title')).toContainText('Bàn Phím Số Nhanh');
    await page.waitForTimeout(300);

    // Ban đầu màn hình hiển thị rỗng '---'
    const digitsDisplay = page.locator('#numpad-display-digits');
    await expect(digitsDisplay).toHaveText('---');

    // 4. Gõ tuần tự 1 - 2 - 3 trên bàn phím số cảm ứng
    const key1 = numpadModal.locator('.btn-numpad-key[data-digit="1"]');
    const key2 = numpadModal.locator('.btn-numpad-key[data-digit="2"]');
    const key3 = numpadModal.locator('.btn-numpad-key[data-digit="3"]');

    await key1.click();
    await key2.click();
    await key3.click();
    await expect(digitsDisplay).toHaveText('123');

    // 5. Kiểm tra dòng preview hiển thị bài hát khớp
    const matchRow = page.locator('#numpad-song-match');
    await expect(matchRow).toBeVisible();
    await expect(matchRow).toContainText('123');
    await expect(matchRow).toHaveClass(/matched/);

    // 6. Nhấn nút "▶ Mở Bài"
    const btnOpen = page.locator('#btn-numpad-open');
    await expect(btnOpen).toBeEnabled();
    await btnOpen.click();

    // 7. Modal phải tự đóng và bài hát thanh-ca-123 được nạp lên màn hình
    await expect(numpadModal).toBeHidden();

    // Kiểm tra URL và tên bài hát đã đổi sang bài 123
    await page.waitForFunction(() => {
      const url = new URL(window.location.href);
      return url.searchParams.get('song') === 'thanh-ca-123';
    }, { timeout: 15000 });

    // Kiểm tra OSMD container render bài mới
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });
  });

  test('2. Thao tác Lùi ⌫ (backspace) và Xóa C (clear) trên bàn phím số', async ({ page }) => {
    await page.setViewportSize({ width: 820, height: 1180 });
    await page.goto('./?song=thanh-ca-001&v=sheet', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });

    // Mở sidebar trên iPad nếu đang đóng
    const sidebar = page.locator('#sidebar');
    const isSidebarClosed = await sidebar.evaluate(el => el.classList.contains('mobile-hidden') || el.getBoundingClientRect().right <= 0);
    if (isSidebarClosed) {
      await page.locator('#btn-open-sidebar').click();
      await expect(sidebar).not.toHaveClass(/mobile-hidden/);
      await page.waitForTimeout(300);
    }

    // Mở numpad
    await page.locator('#btn-quick-numpad').click();
    const numpadModal = page.locator('#modal-quick-numpad');
    await expect(numpadModal).toBeVisible();
    await page.waitForTimeout(300);

    const digitsDisplay = page.locator('#numpad-display-digits');
    const key4 = numpadModal.locator('.btn-numpad-key[data-digit="4"]');
    const key5 = numpadModal.locator('.btn-numpad-key[data-digit="5"]');
    const key6 = numpadModal.locator('.btn-numpad-key[data-digit="6"]');
    const keyBackspace = numpadModal.locator('.btn-numpad-action[data-action="backspace"]');
    const keyClear = numpadModal.locator('.btn-numpad-action[data-action="clear"]');

    // Gõ 4, 5, 6
    await key4.click();
    await key5.click();
    await key6.click();
    await expect(digitsDisplay).toHaveText('456');

    // Bấm Lùi ⌫ -> còn 45
    await keyBackspace.click();
    await expect(digitsDisplay).toHaveText('45');

    // Bấm Xóa C -> reset về ---
    await keyClear.click();
    await expect(digitsDisplay).toHaveText('---');
    await expect(page.locator('#btn-numpad-open')).toBeDisabled();

    // Đóng bằng nút X
    await page.locator('#btn-close-quick-numpad').click();
    await expect(numpadModal).toBeHidden();
  });

  test('3. Nhập từ bàn phím cứng: phím "#" mở modal, gõ 1-2-3 và bấm Enter mở bài', async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 820 });
    await page.goto('./?song=thanh-ca-001&v=sheet', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });

    // Nhấn phím '#' trên trang chính
    await page.keyboard.press('#');

    const numpadModal = page.locator('#modal-quick-numpad');
    await expect(numpadModal).toBeVisible();

    // Gõ phím số trên bàn phím
    await page.keyboard.press('1');
    await page.keyboard.press('2');
    await page.keyboard.press('3');

    const digitsDisplay = page.locator('#numpad-display-digits');
    await expect(digitsDisplay).toHaveText('123');

    // Nhấn Enter để mở
    await page.keyboard.press('Enter');

    await expect(numpadModal).toBeHidden();
    await page.waitForFunction(() => {
      const url = new URL(window.location.href);
      return url.searchParams.get('song') === 'thanh-ca-123';
    }, { timeout: 15000 });
  });

});
