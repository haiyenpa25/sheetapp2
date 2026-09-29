// @ts-check
const { test, expect } = require('@playwright/test');
const { execSync } = require('child_process');

/**
 * e2e/library-r0-2-chord-clone-confirm.spec.js
 *
 * E2E cho Ticket R0-2 (ROADMAP5): Trước đây bấm "C" khi đang xem bộ HD (dùng
 * chung cho cả ban nhạc) hoặc TLH (Bản Gốc, bất biến) sẽ ÂM THẦM sao chép và
 * GHI ĐÈ bộ hợp âm cá nhân của người dùng — không hỏi gì cả (lỗi B2/B3). Giờ
 * đây phải hiện hộp thoại xác nhận rõ ràng, và Hủy phải không gửi bất kỳ
 * request ghi (save/clone/delete) nào.
 *
 * Toàn bộ request route=chord_sets bị chặn (page.route) và trả dữ liệu giả
 * lập trong bộ nhớ — không bao giờ chạm vào DB/storage thật.
 *
 * serviceWorkers: 'block' — SheetApp đăng ký Service Worker (ServiceWorkerManager).
 * Trên WebKit, request đi qua Service Worker không được page.route() chặn được
 * (giới hạn đã biết của driver WebKit trong Playwright) nên nếu không chặn hẳn
 * Service Worker, request ghi thật có thể lọt ra ngoài mock và chạm vào backend/DB
 * thật — phải tắt hẳn để đảm bảo test không bao giờ chạm dữ liệu thật.
 */
test.use({ serviceWorkers: 'block' });

function loginAs(username) {
  return execSync(`C:\\xampp\\php\\php.exe tools/create_test_session.php ${username}`).toString().trim();
}

/** Chặn toàn bộ request route=chord_sets, ghi log lại, trả dữ liệu giả lập. */
async function mockChordSets(page, { hdChords = [], bhChords = [], listSets = ['HD', 'default'] } = {}) {
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
    calls.push({ method, action, name: body?.name || url.searchParams.get('name'), body });

    if (method === 'GET' && action === 'list') {
      return route.fulfill({ json: { success: true, sets: listSets } });
    }
    if (method === 'GET' && action === 'load') {
      const name = url.searchParams.get('name');
      if (name === 'HD') return route.fulfill({ json: { success: true, chords: hdChords } });
      if (name === 'BH') return route.fulfill({ json: { success: true, chords: bhChords } });
      return route.fulfill({ json: { success: true, chords: [] } });
    }
    if (method === 'POST') {
      return route.fulfill({ json: { success: true } });
    }
    return route.continue();
  });
  return calls;
}

test.describe('R0-2 · Hộp thoại xác nhận trước khi sửa hợp âm không phải của mình', () => {

  test('1. Banhat (BH) bấm C trên HD rồi Hủy: 0 request ghi, không vào chế độ sửa', async ({ page }) => {
    const sid = loginAs('banhat');
    await page.context().addCookies([{ name: 'PHPSESSID', value: sid, domain: 'localhost', path: '/' }]);

    const calls = await mockChordSets(page, { hdChords: [] });

    await page.goto('./?song=thanh-ca-002', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });
    await expect(page.locator('#chord-set-selector')).toHaveValue('HD');

    await page.keyboard.press('c');

    const editMineBtn = page.locator('#cc-clone-edit-mine');
    await expect(editMineBtn).toBeVisible({ timeout: 5000 });

    await page.locator('#cc-clone-cancel').click();
    await expect(editMineBtn).toBeHidden();

    const writeCalls = calls.filter(c => c.method === 'POST');
    expect(writeCalls).toEqual([]);

    // Vẫn ở chế độ chỉ xem — không có dot sửa nào xuất hiện
    await expect(page.locator('.cc-dot-btn')).toHaveCount(0);
  });

  test('2. Banhat (BH) chọn "Sửa trên bản của tôi": BH giữ nguyên dữ liệu cũ, không clone/save', async ({ page }) => {
    const sid = loginAs('banhat');
    await page.context().addCookies([{ name: 'PHPSESSID', value: sid, domain: 'localhost', path: '/' }]);

    // Giả lập BH đã có sẵn 1 hợp âm riêng từ trước ở ô 2_1 = 'D7'
    const calls = await mockChordSets(page, {
      hdChords: [],
      bhChords: [{ measureIdx: 2, noteIdx: 1, chord: 'D7' }],
      listSets: ['HD', 'default', 'BH']
    });

    await page.goto('./?song=thanh-ca-002', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });
    await expect(page.locator('#chord-set-selector')).toHaveValue('HD');

    await page.keyboard.press('c');
    await expect(page.locator('#cc-clone-edit-mine')).toBeVisible({ timeout: 5000 });
    await page.locator('#cc-clone-edit-mine').click();

    // Chuyển sang bộ cá nhân BH — dùng ChordCanvas.getCurrentSet() làm nguồn sự thật
    // (không dùng giá trị DOM #chord-set-selector: dropdown chỉ nạp danh sách "sets" thật
    // từ server khi người dùng mở nó lên ít nhất 1 lần — hành vi cache riêng, không thuộc
    // phạm vi R0-2 — nên "BH" tạm thời không có mặt trong <option> dù _currentSet đã đúng).
    await expect.poll(() => page.evaluate(() => window.ChordCanvas?.getCurrentSet?.()), { timeout: 5000 }).toBe('BH');

    // Vào thẳng chế độ sửa — dot xuất hiện
    await expect(page.locator('.cc-dot-btn').first()).toBeVisible({ timeout: 5000 });

    // Dữ liệu D7 tải lại đúng như cũ — không bị ghi đè/xóa. Poll thay vì đọc 1 lần:
    // switchSet() gán _currentSet đồng bộ nhưng load() chords là bất đồng bộ (fetch mock),
    // nên phải chờ nó ổn định thay vì đọc ngay sau khi _currentSet vừa đổi.
    await expect.poll(
      () => page.evaluate(() => window.ChordCanvas?.getCustomChords?.()),
      { timeout: 5000 }
    ).toEqual({ '2_1': 'D7' });

    // "Sửa trên bản của tôi" chỉ ĐIỀU HƯỚNG, không sao chép -> 0 request ghi
    const writeCalls = calls.filter(c => c.method === 'POST');
    expect(writeCalls).toEqual([]);
  });

  test('3. Admin ở TLH (Bản Gốc) bấm C rồi Hủy: HD không đổi, không có request ghi', async ({ page }) => {
    const sid = loginAs('admin');
    await page.context().addCookies([{ name: 'PHPSESSID', value: sid, domain: 'localhost', path: '/' }]);

    const calls = await mockChordSets(page, { hdChords: [] });

    await page.goto('./?song=thanh-ca-002&set=default', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });
    await expect(page.locator('#chord-set-selector')).toHaveValue('default');

    await page.keyboard.press('c');
    const copyBtn = page.locator('#cc-clone-copy');
    await expect(copyBtn).toBeVisible({ timeout: 5000 });

    await page.locator('#cc-clone-cancel').click();
    await expect(copyBtn).toBeHidden();

    // Không có request ghi nào (nhất là không có gì ghi vào bộ HD dùng chung)
    const writeCalls = calls.filter(c => c.method === 'POST');
    expect(writeCalls).toEqual([]);
  });

});
