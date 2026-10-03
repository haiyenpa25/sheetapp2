// @ts-check
const { test, expect } = require('@playwright/test');
const { execSync } = require('child_process');

/**
 * e2e/library-r0-7-toolbar-controls-reachable.spec.js
 *
 * E2E cho Ticket R0-7 (ROADMAP5): Ở laptop 1366-1650px với sidebar mở, .main-content
 * (vùng đo bởi @container mainarea) hẹp hơn 1350px dù viewport rộng hơn ngưỡng
 * @media(max-width:1300px) -- nên Zoom, Tự cuộn, Metronome, Capo, "Gốc", Soạn hợp âm bị
 * ẩn khỏi toolbar mà KHÔNG có đường bấm dự phòng nào hoạt động, vì 2 lỗi:
 *  1. #main-dropdown-menu bị chuyển ra document.body khi mở (position:fixed) -- nằm
 *     ngoài phạm vi @container mainarea, nên .menu-section-compact-only bên trong
 *     không bao giờ hiện được (đã sửa bằng class body.toolbar-controls-compact do
 *     ResizeObserver bật/tắt, không phụ thuộc vị trí DOM).
 *  2. "Điền hợp âm" và "Gốc" (tông) không có mục dự phòng nào trong menu ⋮ cả (đã
 *     thêm #btn-menu-add-chord-mode và #btn-menu-transpose-reset).
 *
 * Nghiệm thu: mỗi mục Zoom, Tự cuộn, Metronome, Capo, Soạn hợp âm bấm được trong tối đa
 * 2 thao tác, ở cả 1366, 1440, 1920 (sidebar mở) và điện thoại 390.
 */

function loginAsBanhat() {
  return execSync('C:\\xampp\\php\\php.exe tools/create_test_session.php banhat').toString().trim();
}

async function ensureSidebarOpen(page) {
  const sidebar = page.locator('#sidebar');
  const isClosed = await sidebar.evaluate(el =>
    el.classList.contains('mobile-hidden') || el.classList.contains('hidden') || el.getBoundingClientRect().right <= 0
  );
  if (isClosed) {
    await page.locator('#btn-open-sidebar').click();
    await page.waitForTimeout(300);
  }
}

/** Với mỗi control, kiểm tra bấm được trong TỐI ĐA 2 thao tác: bấm trực tiếp trên
 *  toolbar (1 thao tác) hoặc bấm ⋮ rồi bấm mục tương ứng trong menu (2 thao tác). */
async function assertReachableWithin2Actions(page, { toolbarSelector, menuSelector }) {
  const direct = page.locator(toolbarSelector);
  if (await direct.isVisible().catch(() => false)) {
    return; // 1 thao tác -- đạt
  }
  const moreBtn = page.locator('#btn-more-options');
  await expect(moreBtn).toBeVisible({ timeout: 5000 });
  await moreBtn.click();
  const menu = page.locator('#main-dropdown-menu');
  await expect(menu).toBeVisible({ timeout: 5000 });
  const viaMenu = page.locator(menuSelector);
  await expect(viaMenu).toBeVisible({ timeout: 5000 }); // 2 thao tác -- đạt
  // đóng menu lại để không ảnh hưởng control tiếp theo
  await page.keyboard.press('Escape').catch(() => {});
  await page.locator('body').click({ position: { x: 5, y: 5 } }).catch(() => {});
}

const DESKTOP_WIDTHS = [1366, 1440, 1920];

test.describe('R0-7 · Toolbar controls luôn bấm được trong tối đa 2 thao tác', () => {

  for (const w of DESKTOP_WIDTHS) {
    test(`Laptop ${w}px (sidebar mở): Zoom, Tự cuộn, Metronome, Capo, Soạn hợp âm đều bấm được`, async ({ page }) => {
      const sid = loginAsBanhat();
      await page.context().addCookies([{ name: 'PHPSESSID', value: sid, url: new URL('/', test.info().project.use.baseURL).href }]);

      await page.setViewportSize({ width: w, height: 800 });
      await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });
      await ensureSidebarOpen(page);

      await assertReachableWithin2Actions(page, { toolbarSelector: '.zoom-pill', menuSelector: '#btn-menu-zoom-in' });
      await assertReachableWithin2Actions(page, { toolbarSelector: '.scroll-pill', menuSelector: '#btn-menu-auto-scroll' });
      await assertReachableWithin2Actions(page, { toolbarSelector: '#btn-toolbar-metronome', menuSelector: '#btn-menu-metronome' });
      await assertReachableWithin2Actions(page, { toolbarSelector: '#capo-wrap', menuSelector: '#menu-capo-select' });
      await assertReachableWithin2Actions(page, { toolbarSelector: '#btn-add-chord-mode-bar', menuSelector: '#btn-menu-add-chord-mode' });
    });
  }

  test('Điện thoại 390px: Soạn hợp âm bấm được (qua menu ⋮), thật sự vào chế độ sửa', async ({ page }) => {
    const sid = loginAsBanhat();
    await page.context().addCookies([{ name: 'PHPSESSID', value: sid, url: new URL('/', test.info().project.use.baseURL).href }]);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('./?song=thanh-ca-001&v=sheet', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });

    await assertReachableWithin2Actions(page, { toolbarSelector: '#btn-add-chord-mode-bar', menuSelector: '#btn-menu-add-chord-mode' });

    // Bấm thật sự vào mục "Điền hợp âm" trong menu ⋮ và xác nhận vào đúng chế độ sửa
    // (ủy quyền qua ModeManager -- không phải chỉ hiện, còn phải HOẠT ĐỘNG đúng)
    await page.locator('#btn-more-options').click();
    await expect(page.locator('#main-dropdown-menu')).toBeVisible({ timeout: 5000 });
    await page.locator('#btn-menu-add-chord-mode').click();

    await expect(page.getByRole('dialog', { name: 'Bắt đầu sửa hợp âm' })).toBeVisible();
    await page.locator('#cc-clone-edit-mine').click();
    await expect.poll(() => page.evaluate(() => window.ChordCanvas?.isAddMode?.())).toBe(true);

    const mode = await page.evaluate(() => window.ModeManager?.getMode?.());
    expect(mode).toBe('edit_chords');
  });

  test('Laptop 1366px (sidebar mở): bấm "Gốc" trong menu thật sự đưa tông về 0', async ({ page }) => {
    const sid = loginAsBanhat();
    await page.context().addCookies([{ name: 'PHPSESSID', value: sid, url: new URL('/', test.info().project.use.baseURL).href }]);

    await page.setViewportSize({ width: 1366, height: 800 });
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });
    await ensureSidebarOpen(page);

    // Dịch giọng lên +2 trước bằng phím tắt (luôn có mặt, không phụ thuộc toolbar)
    await page.keyboard.press(']');
    await page.keyboard.press(']');
    await page.waitForTimeout(300);
    await expect.poll(() => page.evaluate(() => window.App?.getCurrentTranspose?.())).toBe(2);

    await page.locator('#btn-more-options').click();
    await expect(page.locator('#main-dropdown-menu')).toBeVisible({ timeout: 5000 });
    await page.locator('#btn-menu-transpose-reset').click();

    await expect.poll(() => page.evaluate(() => window.App?.getCurrentTranspose?.())).toBe(0);
  });

});
