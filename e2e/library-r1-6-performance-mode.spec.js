// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * e2e/library-r1-6-performance-mode.spec.js
 *
 * Kiểm thử E2E Ticket R1-6 (ROADMAP 5, Mục 2.5 & 3):
 * - Ẩn hết chrome: toolbar, sidebar, navbar, section jump bar, mobile thumb bar, FAB.
 * - Diện tích nhạc bao phủ ≥ 97% màn hình.
 * - Lớp điều khiển mờ duy nhất (#gig-floating-hud) gồm các cụm rõ ràng, không có ô xám trống.
 * - HUD tự mờ sau 3 giây; chạm giữa màn hình (#edge-tap-center) hiện lại.
 * - Thông báo "Nhấn F/Esc để thoát" chỉ hiện 1 lần trong phiên và ở đỉnh màn hình, không đè HUD.
 * - Thoát Biểu Diễn bằng nút Thoát hoặc Esc.
 */

test.describe('R1-6 · Chế độ Biểu Diễn 100% Sạch', () => {

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('sheetapp_guest_chosen', '1');
      localStorage.setItem('sheetapp_guest_toast_shown', '1');
      sessionStorage.removeItem('sheetapp_gig_hint_shown');
    });
  });

  test('1. Laptop (1366x768): Ẩn mọi thanh, pixel nhạc ≥ 97%, HUD kính mờ & không ô xám trống', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });

    const osmdSvg = page.locator('#osmd-container svg').first();
    await expect(osmdSvg).toBeVisible({ timeout: 25000 });

    const btnGig = page.locator('#btn-fullscreen');
    await expect(btnGig).toBeVisible();
    await btnGig.click();

    // 1. Toàn bộ thanh điều hướng, công cụ, dải phân đoạn đều bị ẩn
    await expect(page.locator('body')).toHaveClass(/sheet-only-mode/);
    await expect(page.locator('#toolbar')).toBeHidden();
    await expect(page.locator('#sidebar')).toBeHidden();
    await expect(page.locator('#app-shell-navbar')).toBeHidden();
    await expect(page.locator('#section-jump-bar-container')).toBeHidden();
    await expect(page.locator('#song-info-strip')).toBeHidden();

    // 2. Kiểm tra diện tích hiển thị nhạc ≥ 97%
    const sheetWrapper = page.locator('.sheet-viewer-wrapper');
    await expect(sheetWrapper).toBeVisible();
    const box = await sheetWrapper.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      const area = box.width * box.height;
      const totalArea = 1366 * 768;
      const coveragePct = (area / totalArea) * 100;
      expect(coveragePct).toBeGreaterThanOrEqual(97);
    }

    // 3. HUD ban đầu hiển thị, có hiệu ứng kính mờ (blur)
    const hud = page.locator('#gig-floating-hud');
    await expect(hud).toBeVisible();
    const backdropFilter = await hud.evaluate(el => window.getComputedStyle(el).backdropFilter || window.getComputedStyle(el).webkitBackdropFilter);
    expect(backdropFilter).toContain('blur');

    // 4. Các nút và thành phần trong HUD đều có nội dung/nhãn rõ ràng, không rỗng
    const transVal = page.locator('#gig-hud-trans');
    await expect(transVal).toHaveText('0');
    const zoomVal = page.locator('#gig-hud-zoom');
    await expect(zoomVal).toContainText('%');
    const exitBtn = page.locator('#btn-gig-exit');
    await expect(exitBtn).toBeVisible();
    await expect(exitBtn).toContainText('Thoát');

    // 5. Toast thông báo thoát nằm ở đỉnh màn hình (top), không đè HUD ở đáy
    const toast = page.locator('#toast-container .toast', { hasText: 'Esc để thoát' });
    if (await toast.count() > 0) {
      const toastBox = await toast.first().boundingBox();
      const hudBox = await hud.boundingBox();
      if (toastBox && hudBox) {
        expect(toastBox.y).toBeLessThan(hudBox.y);
        expect(toastBox.y).toBeLessThan(100); // Ở đỉnh màn hình
      }
    }
  });

  test('2. HUD tự mờ sau 3 giây và chạm giữa (#edge-tap-center) hiện lại', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });

    const osmdSvg = page.locator('#osmd-container svg').first();
    await expect(osmdSvg).toBeVisible({ timeout: 25000 });

    await page.locator('#btn-fullscreen').click();
    await expect(page.locator('body')).toHaveClass(/sheet-only-mode/);

    const hud = page.locator('#gig-floating-hud');
    await expect(hud).toBeVisible();

    // Đợi 3.3 giây cho HUD tự mờ
    await page.waitForTimeout(3300);
    await expect(hud).toHaveClass(/faded/);
    await expect.poll(async () => {
      const op = await hud.evaluate(el => window.getComputedStyle(el).opacity);
      return Number(op);
    }, { timeout: 3000 }).toBeLessThanOrEqual(0.05);

    // Chạm giữa màn hình (#edge-tap-center)
    const centerTap = page.locator('#edge-tap-center');
    await expect(centerTap).toBeVisible();
    await centerTap.click();

    // HUD phải hiện lại rõ ràng
    await expect(hud).not.toHaveClass(/faded/);
    await expect.poll(async () => {
      const op = await hud.evaluate(el => window.getComputedStyle(el).opacity);
      return Number(op);
    }, { timeout: 3000 }).toBeGreaterThanOrEqual(0.8);
  });

  test('3. Thông báo thoát chỉ hiện 1 lần duy nhất trong phiên làm việc', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });

    const osmdSvg = page.locator('#osmd-container svg').first();
    await expect(osmdSvg).toBeVisible({ timeout: 25000 });

    // Lần 1: Vào Biểu Diễn
    await page.locator('#btn-fullscreen').click();
    await expect(page.locator('body')).toHaveClass(/sheet-only-mode/);

    // Thoát Biểu Diễn
    await page.locator('#btn-gig-exit').click();
    await expect(page.locator('body')).not.toHaveClass(/sheet-only-mode/);

    // Xóa toàn bộ toast cũ đang có trong DOM
    await page.evaluate(() => {
      document.querySelectorAll('#toast-container .toast').forEach(t => t.remove());
    });

    // Lần 2: Vào Biểu Diễn lần nữa
    await page.locator('#btn-fullscreen').click();
    await expect(page.locator('body')).toHaveClass(/sheet-only-mode/);

    // Thông báo gợi ý thoát không được xuất hiện lần 2
    const secondToast = page.locator('#toast-container .toast', { hasText: 'Esc để thoát' });
    await expect(secondToast).toHaveCount(0);
  });

  test('4. Điện thoại (390x844): Ẩn cả mobile-thumb-bar, HUD vừa vặn, thoát sạch', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('./?song=thanh-ca-001&v=sheet', { waitUntil: 'domcontentloaded' });

    const osmdSvg = page.locator('#osmd-container svg').first();
    await expect(osmdSvg).toBeVisible({ timeout: 25000 });

    // Vào Biểu Diễn bằng nút Biểu Diễn trên thanh ngón cái mobile
    const btnMobileGig = page.locator('#btn-mobile-gig');
    await expect(btnMobileGig).toBeVisible();
    await btnMobileGig.click();

    // 1. Xác nhận body chuyển sang sheet-only-mode
    await expect(page.locator('body')).toHaveClass(/sheet-only-mode/);

    // 2. Thanh ngón cái ở đáy (.mobile-thumb-bar) phải bị ẩn hoàn toàn
    await expect(page.locator('.mobile-thumb-bar')).toBeHidden();
    await expect(page.locator('#toolbar')).toBeHidden();

    // 3. Diện tích nhạc trên điện thoại ≥ 97%
    const wrapper = page.locator('.sheet-viewer-wrapper');
    const box = await wrapper.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      const area = box.width * box.height;
      const totalArea = 390 * 844;
      const pct = (area / totalArea) * 100;
      expect(pct).toBeGreaterThanOrEqual(97);
    }

    // 4. HUD không tràn màn hình 390px
    const hud = page.locator('#gig-floating-hud');
    await expect(hud).toBeVisible();
    const hudBox = await hud.boundingBox();
    expect(hudBox).not.toBeNull();
    if (hudBox) {
      expect(hudBox.x).toBeGreaterThanOrEqual(0);
      expect(hudBox.x + hudBox.width).toBeLessThanOrEqual(390.5);
    }

    // 5. Thoát bằng nút Thoát trên HUD
    const exitBtn = page.locator('#btn-gig-exit');
    await expect(exitBtn).toBeVisible();
    await exitBtn.click();
    await expect(page.locator('body')).not.toHaveClass(/sheet-only-mode/);
    await expect(page.locator('#toolbar')).toBeVisible();
    await expect(page.locator('.mobile-thumb-bar')).toBeVisible();
  });

});
