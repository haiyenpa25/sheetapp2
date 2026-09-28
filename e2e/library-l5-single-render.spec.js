// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * e2e/library-l5-single-render.spec.js
 *
 * Nghiệm thu Ticket L5-1 (Chương L5: Hiệu năng & Nền kỹ thuật):
 * 1. Tính zoom vừa khung trước lần render đầu (_computePreloadFitZoom).
 * 2. Bỏ updateGraphic() thừa trước osmd.render().
 * 3. ResizeObserver duy nhất làm chủ việc layout lại khi thay đổi kích thước.
 * 4. Nghiệm thu bộ đếm render:
 *    - Tải bài ban đầu = 1 render.
 *    - Đổi bài = 1 render.
 *    - Resize viewport = 1 render.
 */

test.describe('L5-1: Single Render Per Song (Render 1 lần mỗi bài)', () => {

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('sheetapp_guest_chosen', '1');
      localStorage.setItem('sheetapp_guest_toast_shown', '1');
      localStorage.setItem('sheetapp_instrument_role', 'guitar');
      localStorage.removeItem('sheetapp_zoom_locked');
    });
  });

  test('Bộ đếm render: Tải ban đầu = 1, Đổi bài = 1, Resize = 1', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    // ── 1. TẢI BÀI BAN ĐẦU ──
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'networkidle' });
    const svg = page.locator('#osmd-container svg');
    await expect(svg).toBeVisible({ timeout: 25000 });

    // Chờ 800ms để đảm bảo mọi timer/observer (nếu còn sót) đã kết thúc
    await page.waitForTimeout(800);

    const initialRenderCount = await page.evaluate(() => window.OSMDRenderer.getRenderCount());
    expect(initialRenderCount).toBe(1);

    // ── 2. ĐỔI BÀI HÁT ──
    await page.evaluate(() => window.OSMDRenderer.resetRenderCount());

    await page.evaluate(async () => {
      const song2 = {
        id: 'thanh-ca-002',
        title: 'NGUYỀN TỤNG MỸ CHÚA LINH NĂNG',
        xmlPath: 'storage/Thanh ca/002 NGUYỀN TỤNG MỸ CHÚA LINH NĂNG.xml',
      };
      await window.SongLoader.load(song2);
    });

    await page.waitForTimeout(800);
    const switchRenderCount = await page.evaluate(() => window.OSMDRenderer.getRenderCount());
    expect(switchRenderCount).toBe(1);

    // ── 3. RESIZE VIEWPORT ──
    await page.evaluate(() => window.OSMDRenderer.resetRenderCount());

    // Thay đổi kích thước cửa sổ (1280 -> 950px)
    await page.setViewportSize({ width: 950, height: 800 });

    // Chờ debounce 400ms của ResizeObserver + render hoàn tất
    await page.waitForTimeout(800);

    const resizeRenderCount = await page.evaluate(() => window.OSMDRenderer.getRenderCount());
    expect(resizeRenderCount).toBe(1);

    // Kiểm tra bản nhạc vẫn hiển thị nguyên vẹn sau resize
    await expect(svg).toBeVisible();
    const svgWidth = await page.evaluate(() => {
      const el = document.querySelector('#osmd-container svg');
      return el ? el.getBoundingClientRect().width : 0;
    });
    expect(svgWidth).toBeGreaterThan(300);
  });
});
