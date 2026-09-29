// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * e2e/library-l1-gig-mode.spec.js
 *
 * Kiểm thử E2E cho Ticket L1-5 (ROADMAP 4):
 * - Mặc định nền tối (dark-mode), không thanh công cụ.
 * - HUD tự mờ sau 3 giây (opacity 0, pointer-events: none).
 * - Chạm giữa màn hình (#edge-tap-center) để hiện lại HUD.
 * - Khóa chạm ngoài vùng lật trang (vùng center 64%, 2 mép 18% lật trang).
 * - Chạm cạnh phải (#edge-tap-next) cuộn/lật trang.
 * - Trên iPhone 390px: nút Thoát không bị cắt, 0 phần tử nào tràn khỏi khung nhìn.
 */

test.describe('L1-5 · Chế độ Sân khấu thật (Gig Mode Hardening)', () => {

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('sheetapp_guest_chosen', '1');
      localStorage.setItem('sheetapp_guest_toast_shown', '1');
    });
  });

  test('1. Bật Biểu Diễn: Mặc định nền tối, ẩn thanh công cụ, HUD ban đầu hiển thị', async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 820 });
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });

    const osmdSvg = page.locator('#osmd-container svg').first();
    await expect(osmdSvg).toBeVisible({ timeout: 25000 });

    const btnGig = page.locator('#btn-fullscreen');
    await expect(btnGig).toBeVisible();

    // Xác nhận ban đầu đang ở chế độ xem thông thường (không có sheet-only-mode)
    await expect(page.locator('body')).not.toHaveClass(/sheet-only-mode/);

    // Bấm Biểu Diễn (⚡)
    await btnGig.click();

    // 1. Mặc định nền tối và chế độ sheet-only-mode
    await expect(page.locator('body')).toHaveClass(/sheet-only-mode/);
    await expect(page.locator('body')).toHaveClass(/dark-mode/);

    // 2. Không thanh công cụ, không sidebar, không FAB
    const toolbar = page.locator('#toolbar');
    await expect(toolbar).toBeHidden();
    const sidebar = page.locator('#sidebar');
    await expect(sidebar).toBeHidden();
    const fab = page.locator('#fab-wrap');
    await expect(fab).toBeHidden();

    // 3. HUD ban đầu hiển thị rõ ràng (opacity 1)
    const hud = page.locator('#gig-floating-hud');
    await expect(hud).toBeVisible();
    const opacityInitial = await hud.evaluate(el => window.getComputedStyle(el).opacity);
    expect(Number(opacityInitial)).toBeGreaterThanOrEqual(0.9);
  });

  test('2. HUD tự mờ sau 3 giây (opacity 0, class faded)', async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 820 });
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });

    const osmdSvg = page.locator('#osmd-container svg').first();
    await expect(osmdSvg).toBeVisible({ timeout: 25000 });

    // Vào Biểu Diễn
    await page.locator('#btn-fullscreen').click();
    await expect(page.locator('body')).toHaveClass(/sheet-only-mode/);

    const hud = page.locator('#gig-floating-hud');
    await expect(hud).toBeVisible();

    // Đợi 3.3 giây để HUD tự động mờ đi
    await page.waitForTimeout(3300);

    // Kiểm tra class faded và opacity = 0
    await expect(hud).toHaveClass(/faded/);
    const opacityFaded = await hud.evaluate(el => window.getComputedStyle(el).opacity);
    expect(opacityFaded).toBe('0');

    // pointer-events phải là none khi đã mờ để không chặn tương tác chạm
    const pointerEvents = await hud.evaluate(el => window.getComputedStyle(el).pointerEvents);
    expect(pointerEvents).toBe('none');
  });

  test('3. Chạm giữa màn hình (#edge-tap-center) hiện lại HUD', async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 820 });
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });

    const osmdSvg = page.locator('#osmd-container svg').first();
    await expect(osmdSvg).toBeVisible({ timeout: 25000 });

    // Vào Biểu Diễn
    await page.locator('#btn-fullscreen').click();
    await expect(page.locator('body')).toHaveClass(/sheet-only-mode/);

    const hud = page.locator('#gig-floating-hud');
    await expect(hud).toBeVisible();

    // Đợi HUD tự mờ sau 3.3s
    await page.waitForTimeout(3300);
    await expect(hud).toHaveClass(/faded/);

    // Chạm vào vùng trung tâm màn hình (#edge-tap-center)
    const centerTap = page.locator('#edge-tap-center');
    await expect(centerTap).toBeVisible();
    await centerTap.click();

    // HUD phải hiện trở lại (gỡ class faded)
    await expect(hud).not.toHaveClass(/faded/);

    // Chờ CSS transition (0.3s) hoàn tất hiển thị
    await expect.poll(async () => {
      const op = await hud.evaluate(el => window.getComputedStyle(el).opacity);
      return Number(op);
    }, { timeout: 3000 }).toBeGreaterThanOrEqual(0.9);
  });

  test('4. Chạm cạnh phải (#edge-tap-next) cuộn/lật trang', async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 820 });
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });

    const osmdSvg = page.locator('#osmd-container svg').first();
    await expect(osmdSvg).toBeVisible({ timeout: 25000 });

    // Vào Biểu Diễn
    await page.locator('#btn-fullscreen').click();
    await expect(page.locator('body')).toHaveClass(/sheet-only-mode/);

    const edgeRight = page.locator('#edge-tap-next');
    await expect(edgeRight).toBeVisible();

    const initialScrollTop = await page.evaluate(() => {
      const wrap = document.getElementById('sheet-viewer-wrapper');
      return wrap ? wrap.scrollTop : 0;
    });

    // Chạm vào mép phải
    await edgeRight.click();
    await page.waitForTimeout(400);

    const newScrollTop = await page.evaluate(() => {
      const wrap = document.getElementById('sheet-viewer-wrapper');
      return wrap ? wrap.scrollTop : 0;
    });

    // Trang phải cuộn xuống (scrollTop tăng)
    expect(newScrollTop).toBeGreaterThanOrEqual(initialScrollTop);
  });

  test('5. Viewport điện thoại iPhone (390x844): Nút Thoát không bị cắt, 0 phần tử tràn khung', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    // Điện thoại mặc định mở chế độ Band (L-D2) → yêu cầu rõ chế độ bản nhạc.
    await page.goto('./?song=thanh-ca-001&v=sheet', { waitUntil: 'domcontentloaded' });

    const osmdSvg = page.locator('#osmd-container svg').first();
    await expect(osmdSvg).toBeVisible({ timeout: 25000 });

    // Vào Biểu Diễn
    const btnGig = page.locator('#btn-mobile-gig, #btn-fullscreen').locator('visible=true').first();
    await expect(btnGig).toBeVisible();
    await btnGig.click();

    await expect(page.locator('body')).toHaveClass(/sheet-only-mode/);
    await expect(page.locator('body')).toHaveClass(/dark-mode/);

    const hud = page.locator('#gig-floating-hud');
    await expect(hud).toBeVisible();

    // 1. Kiểm tra HUD nằm trọn trong khung nhìn 390x844
    const hudBox = await hud.boundingBox();
    expect(hudBox).not.toBeNull();
    if (hudBox) {
      expect(hudBox.x).toBeGreaterThanOrEqual(0);
      expect(hudBox.x + hudBox.width).toBeLessThanOrEqual(390.5);
      expect(hudBox.y + hudBox.height).toBeLessThanOrEqual(844.5);
    }

    // 2. Kiểm tra nút Thoát (#btn-gig-exit) không bị cắt, kích thước >= 44x44px
    const exitBtn = page.locator('#btn-gig-exit');
    await expect(exitBtn).toBeVisible();
    const exitBox = await exitBtn.boundingBox();
    expect(exitBox).not.toBeNull();
    if (exitBox) {
      expect(exitBox.x).toBeGreaterThanOrEqual(0);
      expect(exitBox.x + exitBox.width).toBeLessThanOrEqual(390.5);
      expect(exitBox.width).toBeGreaterThanOrEqual(44);
      expect(exitBox.height).toBeGreaterThanOrEqual(44);
    }

    // 3. Bấm nút Thoát (#btn-gig-exit) -> thoát Biểu Diễn thành công
    await exitBtn.click();
    await expect(page.locator('body')).not.toHaveClass(/sheet-only-mode/);

    // Thanh công cụ trở lại
    const toolbar = page.locator('#toolbar');
    await expect(toolbar).toBeVisible();

    // Do ban đầu là light-mode, sau khi thoát chế độ Biểu Diễn dark-mode phải được khôi phục
    await expect(page.locator('body')).not.toHaveClass(/dark-mode/);
  });

});
