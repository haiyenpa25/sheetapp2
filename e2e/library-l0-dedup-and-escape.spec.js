// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * e2e/library-l0-dedup-and-escape.spec.js
 *
 * Kiểm thử E2E cho Ticket L0-16 (ROADMAP 4):
 *  - Bật/tắt ⚡ chỉ ra 1 toast duy nhất (không bị duplicate handlers).
 *  - Phím Escape đóng đúng lớp trên cùng: nếu có modal đang mở, đóng modal trước; bấm tiếp mới thoát mode.
 */

test.describe('Ticket L0-16: Dedup Handlers & Escape Layering', () => {

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('sheetapp_guest_chosen', '1');
      localStorage.setItem('sheetapp_guest_toast_shown', '1');
    });
  });

  test('1. Bật ⚡ chỉ sinh đúng 1 toast thông báo', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 820 });
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });

    const osmdSvg = page.locator('#osmd-container svg').first();
    await expect(osmdSvg).toBeVisible({ timeout: 25000 });

    // Dọn toast ban đầu do load bài hát sinh ra nếu có
    await page.evaluate(() => {
      document.querySelectorAll('#toast-container .toast').forEach(t => t.remove());
    });

    const btnGig = page.locator('#btn-fullscreen');
    await expect(btnGig).toBeVisible();

    // Bấm nút Biểu diễn
    await btnGig.click();

    // Xác nhận body có class sheet-only-mode
    await expect(page.locator('body')).toHaveClass(/sheet-only-mode/);

    // Toast của chế độ Biểu Diễn phải xuất hiện đúng 1 lần duy nhất (không bị duplicate)
    // Ticket R1-5/ModeManager (ROADMAP5): nội dung toast đổi thành "Chế độ Toàn màn
    // hình — Nhấn F hoặc Esc để thoát" (không còn chứa chữ "Biểu Diễn").
    const gigToasts = page.locator('#toast-container .toast', { hasText: 'Chế độ Toàn màn hình' });
    await expect(gigToasts).toHaveCount(1);
  });

  test('2. Phím Escape đóng đúng lớp trên cùng (Modal trước -> Mode sau)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 820 });
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });

    const osmdSvg = page.locator('#osmd-container svg').first();
    await expect(osmdSvg).toBeVisible({ timeout: 25000 });

    // 1. Vào chế độ Biểu Diễn
    const btnGig = page.locator('#btn-fullscreen');
    await btnGig.click();
    await expect(page.locator('body')).toHaveClass(/sheet-only-mode/);

    // 2. Mở một modal (modal tempo chẳng hạn). Ticket L1-8/library-polish.css
    // (ROADMAP5): toàn bộ #toolbar (kể cả popover ⓘ nơi #si-pop-tempo sống) bị ẩn hẳn
    // trong body.sheet-only-mode -- không còn đường click UI nào mở được TempoPick khi
    // đang ở chế độ Biểu Diễn. Mở thẳng bằng API (hành vi tương đương người dùng bấm
    // chip khi nó còn hiện được) để kiểm thử đúng trọng tâm của test này: phân lớp Esc.
    await page.evaluate(async () => {
      if (!window.TempoPick && window.ScriptLoader?.loadModal) {
        await window.ScriptLoader.loadModal('tempo');
      }
      window.TempoPick?.show(100);
    });
    const tempoModal = page.locator('#tempo-pick-modal');
    await expect(tempoModal).toBeVisible();
    await page.waitForTimeout(300);

    // 3. Nhấn phím Escape lần 1: ĐÓNG MODAL, KHÔNG ĐƯỢC THOÁT GIG MODE
    await page.evaluate(() => window.ModeManager.handleEscape());
    await expect(tempoModal).toBeHidden();
    // Vẫn phải ở chế độ Biểu Diễn
    await expect(page.locator('body')).toHaveClass(/sheet-only-mode/);
    await page.waitForTimeout(300);

    // 4. Nhấn phím Escape lần 2: THOÁT GIG MODE VỀ VIEW
    await page.evaluate(() => window.ModeManager.handleEscape());
    await expect(page.locator('body')).not.toHaveClass(/sheet-only-mode/);
  });

});
