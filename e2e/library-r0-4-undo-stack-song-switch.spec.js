// @ts-check
const { test, expect } = require('@playwright/test');
const { execSync } = require('child_process');

/**
 * e2e/library-r0-4-undo-stack-song-switch.spec.js
 *
 * E2E cho Ticket R0-4 (ROADMAP5, lỗi B6): stack undo/redo của hợp âm sống sót
 * qua lần chuyển bài. Trước đây: sửa bài A, chuyển sang bài B, bấm Ctrl+Z sẽ
 * pop lại state của bài A rồi gọi saveCustomSet() — nhưng saveCustomSet() lấy
 * songId từ App.getCurrentSongId() (lúc này đã là bài B) — ghi NHẦM dữ liệu
 * hợp âm của bài A đè lên bài B. Giờ loadSong()/switchSet() phải xoá sạch cả 2
 * stack, nên Ctrl+Z sau khi chuyển bài không còn gì để hoàn tác -> 0 request ghi.
 *
 * Đăng nhập là hoaidinh (chủ sở hữu HD) để vào thẳng chế độ sửa, không qua
 * hộp thoại xác nhận R0-2. Toàn bộ request route=chord_sets bị chặn (page.route)
 * -- không chạm DB thật. serviceWorkers: 'block' vì Playwright WebKit không
 * route-intercept được request đi qua Service Worker (xem R0-2/R0-3 spec).
 */
test.use({ serviceWorkers: 'block' });

function loginAsHoaiDinh() {
  return execSync('C:\\xampp\\php\\php.exe tools/create_test_session.php hoaidinh').toString().trim();
}

async function mockChordSets(page) {
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
    calls.push({ method, action, songId: body?.songId || url.searchParams.get('songId'), body });

    if (method === 'GET' && action === 'list') {
      return route.fulfill({ json: { success: true, sets: ['HD', 'default'] } });
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

test.describe('R0-4 · Undo/redo không sống sót qua lần chuyển bài', () => {

  test('Sửa bài 001, chuyển sang 002, Ctrl+Z: không có request ghi nào cho 002', async ({ page }) => {
    const sid = loginAsHoaiDinh();
    await page.context().addCookies([{ name: 'PHPSESSID', value: sid, domain: 'localhost', path: '/' }]);
    const calls = await mockChordSets(page);

    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });
    await expect(page.locator('#chord-set-selector')).toHaveValue('HD');

    // hoaidinh là chủ sở hữu HD -> bấm C vào thẳng chế độ sửa
    await page.keyboard.press('c');
    await expect(page.locator('.cc-dot-btn').first()).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(200);

    // Sửa 1 hợp âm ở bài 001 -> đẩy 1 mục vào undo stack
    await page.locator('.cc-dot-btn').first().click();
    await expect(page.locator('.cc-popup, .cc-popup-mobile')).toBeVisible({ timeout: 5000 });
    await page.locator('#cc-pop-inp').fill('G');
    await page.locator('#cc-pop-save').click();

    await expect.poll(
      () => calls.filter(c => c.method === 'POST' && c.action === 'save' && c.songId === 'thanh-ca-001').length,
      { timeout: 5000 }
    ).toBeGreaterThan(0);

    // Chuyển sang bài 002 (Shift+ArrowDown, giống pattern ở library-l1-default-chordset-hd.spec.js)
    await page.keyboard.press('Shift+ArrowDown');
    await page.waitForTimeout(1000);
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });
    await expect(page.locator('#chord-set-selector')).toHaveValue('HD');

    // Chỉ quan sát các request PHÁT SINH SAU KHI đã chuyển bài xong
    calls.length = 0;

    await page.keyboard.press('Control+z');
    await page.waitForTimeout(800);

    // Không có bất kỳ request ghi (save/clone/delete) nào cho bài 002 -- vì
    // undo stack đã bị xoá sạch khi chuyển bài, không còn gì để hoàn tác.
    const writeCalls = calls.filter(c => c.method === 'POST');
    expect(writeCalls).toEqual([]);
  });

});
