// @ts-check
const { test, expect } = require('@playwright/test');
const { execSync } = require('child_process');

/**
 * e2e/library-r0-6-selector-dedup-and-escape.spec.js
 *
 * E2E cho Ticket R0-6 (ROADMAP5):
 *  - B11: #chord-set-selector có CẢ onchange inline LẪN addEventListener('change', ...)
 *    -> đổi bộ hợp âm gửi 2 request load thay vì 1. Đã bỏ onchange inline.
 *  - B12: chọn "Tạo Bộ Hợp Âm Mới" trong dropdown gọi thẳng ChordCanvas.setAddMode(true),
 *    không qua ModeManager -> ModeManager._currentMode vẫn là 'view' dù đang sửa hợp âm
 *    thật, nên Esc (do ModeManager làm chủ) không thoát được. Đã chuyển sang gọi
 *    ModeManager.setMode(EDIT_CHORDS).
 *  - B17: keyboard-handler.js gọi lại ModeManager.handleEscape(e) dù ModeManager đã tự
 *    đăng ký listener Escape riêng -> 1 lần bấm Esc bị xử lý 2 lần. Đã bỏ lời gọi trùng.
 *
 * serviceWorkers: 'block' (xem R0-2/R0-3 spec) -- tránh request thật lọt qua Service
 * Worker trên WebKit. Toàn bộ request route=chord_sets bị mock, không chạm DB thật.
 */
test.use({ serviceWorkers: 'block' });

function loginAs(username) {
  return execSync(`C:\\xampp\\php\\php.exe tools/create_test_session.php ${username}`).toString().trim();
}

async function mockChordSets(page, { listSets = ['HD', 'default'] } = {}) {
  const calls = [];
  await page.route('**/api/index.php?route=chord_sets*', async (route) => {
    const req = route.request();
    const method = req.method();
    const url = new URL(req.url());
    let body = null;
    if (method === 'POST') {
      try { body = JSON.parse(req.postData() || '{}'); } catch (e) { body = null; }
    }
    const action = body?.action || url.searchParams.get('action');
    const name = body?.name || url.searchParams.get('name');
    calls.push({ method, action, name });

    if (method === 'GET' && action === 'list') {
      return route.fulfill({ json: { success: true, sets: listSets } });
    }
    if (method === 'GET' && action === 'load') {
      return route.fulfill({ json: { success: true, chords: [] } });
    }
    if (method === 'POST') {
      return route.fulfill({ json: { success: true } });
    }
    return route.continue();
  });
  return calls;
}

test.describe('R0-6 · Dropdown hợp âm không gửi trùng request, Esc thoát được khi vào từ menu', () => {

  test('1. Đổi bộ hợp âm qua dropdown chỉ gửi đúng 1 request load (không phải 2)', async ({ page }) => {
    const sid = loginAs('hoaidinh'); // chủ sở hữu HD -> chỉ đơn thuần XEM bộ khác, không cần xác nhận R0-2
    await page.context().addCookies([{ name: 'PHPSESSID', value: sid, domain: 'localhost', path: '/' }]);
    const calls = await mockChordSets(page, { listSets: ['HD', 'default', 'BH'] });

    await page.goto('./?song=thanh-ca-002', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });
    await expect(page.locator('#chord-set-selector')).toHaveValue('HD');

    calls.length = 0; // chỉ quan sát request phát sinh từ đây

    // _refreshSetDropdown() chỉ nạp danh sách "sets" thật từ server (bao gồm 'BH') khi
    // forceRefresh=true, kích hoạt qua sự kiện focus/mousedown thật của người dùng khi mở
    // dropdown (xem selector._hasLazyListener trong chord-canvas.js) -- click trước để có
    // option 'BH' tồn tại thật trong DOM, rồi mới chọn nó.
    const selector = page.locator('#chord-set-selector');
    await selector.click();
    await expect(selector.locator('option[value="BH"]')).toHaveCount(1, { timeout: 5000 });

    await selector.selectOption('BH');
    await page.waitForTimeout(500);

    const loadCallsForBH = calls.filter(c => c.method === 'GET' && c.action === 'load' && c.name === 'BH');
    expect(loadCallsForBH.length).toBe(1);
  });

  test('2. Vào chế độ sửa hợp âm từ menu "Tạo Bộ Hợp Âm Mới": Esc phải thoát được', async ({ page }) => {
    const sid = loginAs('banhat'); // chord_code = 'BH' -> chọn "Tạo Bộ Hợp Âm Mới" tạo thẳng bộ 'BH', không qua modal
    await page.context().addCookies([{ name: 'PHPSESSID', value: sid, domain: 'localhost', path: '/' }]);
    await mockChordSets(page, { listSets: ['HD', 'default', 'BH'] });

    await page.goto('./?song=thanh-ca-002', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });
    await expect(page.locator('#chord-set-selector')).toHaveValue('HD');

    await page.locator('#chord-set-selector').selectOption('__create_new_set__');

    // Vào thẳng chế độ sửa -- dot xuất hiện
    await expect(page.locator('.cc-dot-btn').first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator('body')).toHaveClass(/chord-edit-mode/);
    const modeAfterEnter = await page.evaluate(() => window.ModeManager?.getMode?.());
    expect(modeAfterEnter).toBe('edit_chords');

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    await expect(page.locator('body')).not.toHaveClass(/chord-edit-mode/);
    await expect(page.locator('.cc-dot-btn')).toHaveCount(0);
    const modeAfterEscape = await page.evaluate(() => window.ModeManager?.getMode?.());
    expect(modeAfterEscape).toBe('view');
  });

});
