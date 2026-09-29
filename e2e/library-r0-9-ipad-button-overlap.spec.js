// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * e2e/library-r0-9-ipad-button-overlap.spec.js
 *
 * E2E cho Ticket R0-9 (ROADMAP5): ở iPad dọc (~820px) và laptop phổ biến (1366px),
 * nhiều nút trên toolbar giao (chồng) lên nhau, và nhãn vai trò nhạc công hiển thị
 * không khớp giữa toolbar và menu ⋮ dự phòng.
 *
 * Nguyên nhân gốc (2 lỗi độc lập):
 *  1. library-polish.css (nạp sau cùng) có luật ".unified-toolbar .song-info-pill
 *     { max-width: 280px }" đặc trưng (0,2,0) cao hơn luật thu gọn responsive
 *     ".song-info-pill { max-width: 110px }" ở breakpoint iPad dọc (0,1,0) -- luôn
 *     thắng bất kể breakpoint, khiến ô tên bài không co lại, đẩy tràn các nút phía sau.
 *  2. Ở dải 1201-1400px, nhãn đầy đủ "🎹 Keyboard" của nút Vai Trò chưa được thu gọn
 *     (chỉ thu ở <=1200px), đè lên nút "Theo ca trưởng" ở đúng 1366px.
 *  3. StageLens._updateToolbarUI() chỉ cập nhật nhãn vai trò trên toolbar, quên đồng
 *     bộ nhãn dự phòng trong menu ⋮ (#menu-instrument-role-label) -- menu hiện vai trò
 *     CŨ cho tới lần bấm qua đúng mục đó trong menu.
 *
 * Nghiệm thu: không có 2 nút nào trên toolbar giao (chồng) hộp giới hạn với nhau;
 * nhãn vai trò ở toolbar và menu ⋮ luôn khớp nhau.
 */

function boxesOverlap(a, b) {
  return !(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y);
}

const TOOLBAR_BUTTON_IDS = [
  'btn-band-toggle', 'btn-instrument-role', 'btn-follow-leader',
  'btn-fullscreen', 'btn-more-options', 'btn-toolbar-auth', 'btn-song-info-popover'
];

async function assertNoButtonOverlap(page) {
  const boxes = [];
  for (const id of TOOLBAR_BUTTON_IDS) {
    const loc = page.locator('#' + id);
    if (await loc.isVisible().catch(() => false)) {
      const box = await loc.boundingBox();
      if (box) boxes.push({ id, box });
    }
  }
  const overlapping = [];
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      if (boxesOverlap(boxes[i].box, boxes[j].box)) {
        overlapping.push(`#${boxes[i].id} <-> #${boxes[j].id}`);
      }
    }
  }
  expect(overlapping, `Các nút giao (chồng) nhau: ${overlapping.join(', ')}`).toEqual([]);
}

test.describe('R0-9 · Toolbar iPad dọc & laptop: không nút nào giao nhau, nhãn vai trò khớp', () => {

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => { sessionStorage.setItem('sheetapp_guest_chosen', '1'); });
  });

  test('iPad dọc 820px: không có 2 nút toolbar nào giao nhau', async ({ page }) => {
    await page.setViewportSize({ width: 820, height: 1180 });
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });
    await page.waitForTimeout(300);

    await assertNoButtonOverlap(page);
  });

  test('Laptop 1366px: không có 2 nút toolbar nào giao nhau', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 800 });
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });
    await page.waitForTimeout(300);

    await assertNoButtonOverlap(page);
  });

  test('Nhãn vai trò khớp nhau giữa toolbar và menu ⋮ ngay sau khi đổi vai trò', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 800 });
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });

    // Đổi vai trò qua modal Stage Lens (không phải qua menu ⋮) -- đây chính là con
    // đường trước đây làm menu ⋮ không được đồng bộ theo (lỗi B trong ROADMAP5).
    await page.evaluate(() => window.StageLens?.setRole?.('bass'));
    await page.waitForTimeout(200);

    const toolbarLabel = await page.locator('#instrument-role-label').textContent();
    expect(toolbarLabel).toBe('Bass');

    await page.locator('#btn-more-options').click();
    await expect(page.locator('#main-dropdown-menu')).toBeVisible({ timeout: 5000 });
    const menuLabel = await page.locator('#menu-instrument-role-label').textContent();
    expect(menuLabel).toContain('Bass');
  });

});
