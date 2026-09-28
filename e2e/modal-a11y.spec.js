// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * E2E Test: modal-a11y.spec.js
 *
 * Nghiệm thu Ticket T16 (GIAO_VIEC_G3.9.md):
 * 1. Các modal mở và đóng qua ModalManager.
 * 2. Thuộc tính WAI-ARIA: role="dialog", aria-modal="true", aria-labelledby.
 * 3. Focus Trap: Bấm Tab 20 lần, focus luôn nằm bên trong modal.
 * 4. Focus Restore: Bấm Escape, modal đóng và focus quay về phần tử kích hoạt.
 * 5. Nghiệm thu 3 modal: help, transpose-pick, auth.
 */

test.describe('E2E A11y & Focus Management: Modals', () => {
  test.beforeEach(async ({ page }) => {
    // Tránh popup khách làm phiền test
    await page.addInitScript(() => {
      sessionStorage.setItem('sheetapp_guest_chosen', '1');
    });
  });

  test('1. Help Modal: Đảm bảo WAI-ARIA, Focus Trap 20 Tab, và Escape Focus Restore', async ({ page }) => {
    await page.goto('./', { waitUntil: 'domcontentloaded' });

    // Đóng auth-modal nếu có hiển thị ban đầu
    const authClose = page.locator('#btn-close-auth');
    if (await authClose.isVisible()) {
      await authClose.click();
      await page.waitForTimeout(100);
    }

    // Mở dropdown More Options để hiển thị nút #btn-help
    const btnMore = page.locator('#btn-more-options');
    await expect(btnMore).toBeVisible();
    await btnMore.click();

    const btnHelp = page.locator('#btn-help');
    await expect(btnHelp).toBeVisible();

    // Focus vào nút mở Help
    await btnHelp.focus();
    await expect(btnHelp).toBeFocused();

    // Mở Help Modal
    await btnHelp.click();

    const helpModal = page.locator('#help-modal');
    await expect(helpModal).toBeVisible();
    await expect(helpModal).not.toHaveClass(/hidden/);

    // Kiểm tra các thuộc tính WAI-ARIA
    await expect(helpModal).toHaveAttribute('role', 'dialog');
    await expect(helpModal).toHaveAttribute('aria-modal', 'true');
    await expect(helpModal).toHaveAttribute('aria-labelledby', 'help-modal-title');

    // Chờ focus đã được đặt vào phần tử bên trong modal
    await page.waitForTimeout(100);

    // Bấm phím Tab 20 lần liên tục và kiểm tra focus luôn ở bên trong modal
    for (let i = 1; i <= 20; i++) {
      await page.keyboard.press('Tab');
      const isInside = await page.evaluate(() => {
        const modal = document.getElementById('help-modal');
        return modal ? modal.contains(document.activeElement) : false;
      });
      expect(isInside).toBe(true);
    }

    // Nhấn phím Escape để đóng modal
    await page.keyboard.press('Escape');

    // Modal phải đóng lại (có class hidden)
    await expect(helpModal).toHaveClass(/hidden/);

    // Focus Restore: menu ⋮ tự đóng khi chọn mục (L0-6) nên #btn-help đã bị ẩn;
    // focus phải quay về nút mở menu #btn-more-options, không rơi về <body>.
    const helpVisible = await btnHelp.isVisible();
    if (helpVisible) {
      await expect(btnHelp).toBeFocused();
    } else {
      await expect(btnMore).toBeFocused();
    }
    const activeIsBody = await page.evaluate(() => document.activeElement === document.body);
    expect(activeIsBody).toBe(false);
  });

  test('2. Auth Modal: Đảm bảo WAI-ARIA, Focus Trap 20 Tab, và Escape Focus Restore', async ({ page }) => {
    await page.goto('./', { waitUntil: 'domcontentloaded' });

    // Đóng auth-modal nếu có hiển thị ban đầu
    const authModal = page.locator('#auth-modal');
    const authClose = page.locator('#btn-close-auth');
    if (await authClose.isVisible()) {
      await authClose.click();
      await page.waitForTimeout(100);
    }
    await expect(authModal).toHaveClass(/hidden/);

    // Nút mở auth trong sidebar: #btn-auth
    const btnAuth = page.locator('#btn-auth');
    await expect(btnAuth).toBeVisible();

    await btnAuth.focus();
    await expect(btnAuth).toBeFocused();

    // Click mở Auth Modal
    await btnAuth.click();

    await expect(authModal).toBeVisible();
    await expect(authModal).not.toHaveClass(/hidden/);

    // Kiểm tra WAI-ARIA
    await expect(authModal).toHaveAttribute('role', 'dialog');
    await expect(authModal).toHaveAttribute('aria-modal', 'true');
    await expect(authModal).toHaveAttribute('aria-labelledby', 'auth-modal-title');

    await page.waitForTimeout(100);

    // Bấm phím Tab 20 lần liên tục
    for (let i = 1; i <= 20; i++) {
      await page.keyboard.press('Tab');
      const isInside = await page.evaluate(() => {
        const modal = document.getElementById('auth-modal');
        return modal ? modal.contains(document.activeElement) : false;
      });
      expect(isInside).toBe(true);
    }

    // Nhấn phím Escape để đóng modal
    await page.keyboard.press('Escape');

    // Modal phải ẩn
    await expect(authModal).toHaveClass(/hidden/);

    // Focus được khôi phục về nút #btn-auth
    await expect(btnAuth).toBeFocused();
  });

  test('3. Transpose Picker Modal: Đảm bảo WAI-ARIA, Focus Trap 20 Tab, và Escape Focus Restore', async ({ page, browserName }) => {
    await page.goto('./', { waitUntil: 'domcontentloaded' });

    // Đóng auth-modal nếu có hiển thị ban đầu
    const authClose = page.locator('#btn-close-auth');
    if (await authClose.isVisible()) {
      await authClose.click();
      await page.waitForTimeout(100);
    }

    // Chọn bài hát đầu tiên để song info bar hiển thị đầy đủ
    const firstSongItem = page.locator('#song-list .song-item').first();
    await expect(firstSongItem).toBeVisible({ timeout: 15000 });
    await firstSongItem.click();

    // Chờ bản nhạc xuất hiện
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 20000 });

    const toneChip = page.locator('#si-tone-chip');
    await expect(toneChip).toBeVisible();
    await page.waitForTimeout(300);

    await toneChip.focus();
    if (browserName !== 'webkit') {
      await expect(toneChip).toBeFocused();
    }

    // Click chip tông để mở Transpose Picker Modal
    await toneChip.click();

    const transposeModal = page.locator('#transpose-pick-modal');
    await expect(transposeModal).toBeVisible();
    await expect(transposeModal).not.toHaveClass(/hidden/);

    // Kiểm tra WAI-ARIA
    await expect(transposeModal).toHaveAttribute('role', 'dialog');
    await expect(transposeModal).toHaveAttribute('aria-modal', 'true');
    await expect(transposeModal).toHaveAttribute('aria-labelledby', 'transpose-pick-modal-title');

    await page.waitForTimeout(100);

    // Bấm phím Tab 20 lần liên tục
    for (let i = 1; i <= 20; i++) {
      await page.keyboard.press('Tab');
      const isInside = await page.evaluate(() => {
        const modal = document.getElementById('transpose-pick-modal');
        return modal ? modal.contains(document.activeElement) : false;
      });
      expect(isInside).toBe(true);
    }

    // Nhấn phím Escape để đóng modal
    await page.keyboard.press('Escape');

    // Modal phải ẩn
    await expect(transposeModal).toHaveClass(/hidden/);

    // Focus được khôi phục về #si-tone-chip
    if (browserName !== 'webkit') {
      await expect(toneChip).toBeFocused();
    }
  });
});
