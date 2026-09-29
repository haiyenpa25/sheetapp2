// @ts-check
const { test, expect } = require('@playwright/test');
const { execSync } = require('child_process');

/**
 * e2e/library-r0-3-tab-outside-save.spec.js
 *
 * E2E cho Ticket R0-3 (ROADMAP5): Gõ hợp âm trong popup rồi bấm Tab, hoặc gõ
 * xong rồi bấm sang một nốt khác, phải LƯU được hợp âm vừa gõ — trước đây bị
 * mất trắng (lỗi B4: Tab gọi hàm không tồn tại nên không làm gì; lỗi B5:
 * outside-click đánh dấu đã lưu TRƯỚC KHI thực sự lưu nên bị bỏ qua).
 *
 * Đăng nhập là hoaidinh (mã hợp âm cá nhân = 'HD' = chủ sở hữu bộ HD dùng
 * chung) để vào thẳng chế độ sửa mà không cần qua hộp thoại xác nhận R0-2.
 * Toàn bộ request route=chord_sets bị chặn (page.route) — không chạm DB thật.
 *
 * serviceWorkers: 'block' — SheetApp đăng ký Service Worker (ServiceWorkerManager).
 * Trên WebKit, request đi qua Service Worker không được page.route() chặn được
 * (giới hạn đã biết của driver WebKit trong Playwright) nên nếu không chặn hẳn
 * Service Worker, request save() thật sẽ lọt ra ngoài và chạm vào backend/DB
 * thật thay vì bị mock — phải tắt hẳn để đảm bảo test không bao giờ chạm dữ liệu thật.
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
    calls.push({ method, action, body });

    if (method === 'GET' && action === 'list') {
      return route.fulfill({ json: { success: true, sets: ['HD', 'default'] } });
    }
    if (method === 'GET' && action === 'load') {
      return route.fulfill({ json: { success: true, chords: [] } }); // HD trống, giống dữ liệu thật của thanh-ca-002
    }
    if (method === 'POST') {
      return route.fulfill({ json: { success: true } });
    }
    return route.continue();
  });
  return calls;
}

test.describe('R0-3 · Tab và bấm ra nốt khác phải lưu được hợp âm vừa gõ', () => {

  test('1. Gõ "G7" rồi bấm Tab: hợp âm được lưu và popup nốt kế tiếp mở ra', async ({ page }) => {
    const sid = loginAsHoaiDinh();
    await page.context().addCookies([{ name: 'PHPSESSID', value: sid, domain: 'localhost', path: '/' }]);
    const calls = await mockChordSets(page);

    await page.goto('./?song=thanh-ca-002', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });
    await expect(page.locator('#chord-set-selector')).toHaveValue('HD');

    // hoaidinh là chủ sở hữu HD -> bấm C vào thẳng chế độ sửa, không qua hộp thoại R0-2
    await page.keyboard.press('c');
    await expect(page.locator('.cc-dot-btn').first()).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(200); // để _build() và layout ổn định trước khi thao tác

    await page.locator('.cc-dot-btn').first().click();
    await expect(page.locator('.cc-popup, .cc-popup-mobile')).toBeVisible({ timeout: 5000 });

    const input = page.locator('#cc-pop-inp');
    await input.fill('G7');
    // Dispatch synthetic Tab keydown trực tiếp lên input thay vì input.press('Tab'):
    // WebKit (Playwright) không mô phỏng đúng hành vi focus/keydown cho phím Tab theo
    // cùng cách Chromium làm (giới hạn đã biết của driver tự động hoá) — dispatch tay
    // để kiểm thử đúng logic keydown handler của ứng dụng, không phụ thuộc engine.
    await input.evaluate(el => el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })));

    await expect.poll(
      () => calls.filter(c => c.method === 'POST' && c.action === 'save').length,
      { timeout: 5000 }
    ).toBeGreaterThan(0);

    const saveCall = calls.find(c => c.method === 'POST' && c.action === 'save');
    expect(saveCall.body.name).toBe('HD');
    expect(saveCall.body.chords.some(c => c.chord === 'G7')).toBe(true);

    // Popup của nốt kế tiếp phải mở ra (giá trị khác G7 — không phải popup cũ còn sót lại)
    await expect(page.locator('.cc-popup, .cc-popup-mobile')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#cc-pop-inp')).not.toHaveValue('G7', { timeout: 5000 });
  });

  test('2. Gõ "Am" rồi bấm sang nốt khác: hợp âm vừa gõ vẫn được lưu (không bị mất)', async ({ page }) => {
    const sid = loginAsHoaiDinh();
    await page.context().addCookies([{ name: 'PHPSESSID', value: sid, domain: 'localhost', path: '/' }]);
    const calls = await mockChordSets(page);

    await page.goto('./?song=thanh-ca-002', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });
    await expect(page.locator('#chord-set-selector')).toHaveValue('HD');

    await page.keyboard.press('c');
    const dots = page.locator('.cc-dot-btn');
    await expect(dots.first()).toBeVisible({ timeout: 5000 });
    const dotCount = await dots.count();
    test.skip(dotCount < 2, 'Bài hát test không có đủ 2 nốt để kiểm thử bấm ra nốt khác');
    await page.waitForTimeout(200); // để _build() và layout ổn định trước khi thao tác

    await dots.nth(0).click();
    await expect(page.locator('.cc-popup, .cc-popup-mobile')).toBeVisible({ timeout: 5000 });
    await page.locator('#cc-pop-inp').fill('Am');

    // Outside-click listener chỉ gắn sau 300ms kể từ lúc mở popup (tránh đóng ngay trên iPad)
    await page.waitForTimeout(350);
    await dots.nth(1).click();

    await expect.poll(
      () => calls.filter(c => c.method === 'POST' && c.action === 'save').length,
      { timeout: 5000 }
    ).toBeGreaterThan(0);

    const saveCall = calls.find(c => c.method === 'POST' && c.action === 'save');
    expect(saveCall.body.chords.some(c => c.chord === 'Am')).toBe(true);

    // Popup mới cho nốt vừa bấm phải đang mở
    await expect(page.locator('.cc-popup, .cc-popup-mobile')).toBeVisible({ timeout: 5000 });
  });

});
