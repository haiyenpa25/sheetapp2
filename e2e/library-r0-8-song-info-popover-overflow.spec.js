// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * e2e/library-r0-8-song-info-popover-overflow.spec.js
 *
 * E2E cho Ticket R0-8 (ROADMAP5): Popover "Chi tiết bài hát" (nút ⓘ) không hiện ra
 * được (hoặc bị cắt mất) vì #toolbar có overflow-x:auto KHÔNG ĐIỀU KIỆN (layout.css
 * .toolbar). Theo CSS2.1 §11.1.1, overflow-x khác 'visible' buộc overflow-y cũng bị
 * clip theo -- popover position:absolute nằm bên trong #toolbar bị cắt, ở MỌI kích
 * thước màn hình (kể cả điện thoại, cùng nguyên nhân).
 *
 * Nghiệm thu: sau khi mở, document.elementFromPoint() tại điểm giữa popover phải trả
 * về chính popover (hoặc phần tử con của nó) -- tức là popover thực sự nhận được click,
 * không bị phần tử khác che hoặc bị cắt mất khỏi luồng render.
 */

test.describe('R0-8 · Popover "Chi tiết bài hát" (ⓘ) hiện đầy đủ, không bị cắt', () => {

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('sheetapp_guest_chosen', '1');
    });
  });

  test('Laptop 1366px: popover nhận đúng điểm bấm ở giữa, không bị #toolbar cắt mất', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 800 });
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });

    await page.locator('#btn-song-info-popover').click();
    const popover = page.locator('#song-info-popover');
    await expect(popover).toBeVisible({ timeout: 5000 });

    const box = await popover.boundingBox();
    expect(box).not.toBeNull();
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    const hitId = await page.evaluate(({ x, y }) => {
      const el = document.elementFromPoint(x, y);
      return el ? (el.closest('#song-info-popover') ? '#song-info-popover' : el.id || el.tagName) : null;
    }, { x: cx, y: cy });
    expect(hitId).toBe('#song-info-popover');

    // Nội dung thật sự có mặt, không phải khung rỗng
    await expect(page.locator('#si-pop-title')).not.toHaveText('--');
  });

  test('iPad dọc 820px: popover cũng hiện đầy đủ và nhận đúng điểm bấm', async ({ page }) => {
    // Lưu ý: #btn-song-info-popover chủ động bị ẩn dưới 680px (layout.css, Ticket L1-8
    // "Thanh đỉnh đầu 44px duy nhất, sạch sẽ") -- đây là quyết định thiết kế có chủ đích,
    // không liên quan tới lỗi R0-8. Dùng iPad dọc (đúng ma trận màn hình của ROADMAP5)
    // để kiểm thử popover ở nơi nút thực sự tồn tại nhưng vẫn có thể bị #toolbar cắt.
    await page.setViewportSize({ width: 820, height: 1180 });
    await page.goto('./?song=thanh-ca-001&v=sheet', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });

    await page.locator('#btn-song-info-popover').click();
    const popover = page.locator('#song-info-popover');
    await expect(popover).toBeVisible({ timeout: 5000 });

    const box = await popover.boundingBox();
    expect(box).not.toBeNull();
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    const hitId = await page.evaluate(({ x, y }) => {
      const el = document.elementFromPoint(x, y);
      return el ? (el.closest('#song-info-popover') ? '#song-info-popover' : el.id || el.tagName) : null;
    }, { x: cx, y: cy });
    expect(hitId).toBe('#song-info-popover');

    // Popover không được tràn ra ngoài viewport (max-width: calc(100vw - 32px))
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(820);
  });

  test('Bấm ra ngoài đóng popover; bấm nút đóng cũng hoạt động', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 800 });
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });

    const popover = page.locator('#song-info-popover');

    await page.locator('#btn-song-info-popover').click();
    await expect(popover).toBeVisible({ timeout: 5000 });
    await page.locator('#btn-close-song-info-popover').click();
    await expect(popover).toBeHidden({ timeout: 5000 });

    await page.locator('#btn-song-info-popover').click();
    await expect(popover).toBeVisible({ timeout: 5000 });
    await page.locator('#sheet-viewer-wrapper, #osmd-container').first().click({ position: { x: 5, y: 5 } });
    await expect(popover).toBeHidden({ timeout: 5000 });
  });

});
