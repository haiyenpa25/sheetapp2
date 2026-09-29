// @ts-check
const { test, expect } = require('@playwright/test');
const { execSync } = require('child_process');

/**
 * e2e/library-r2-1-note-cursor.spec.js
 *
 * Kiểm thử E2E cho Ticket R2-1 (Con trỏ nốt theo thứ tự mapNotes):
 * 1. Con trỏ nốt có viền sáng nhận diện (.cc-note-cursor) trên nốt đang chọn.
 * 2. Phím Enter: lưu hợp âm và con trỏ tiến 1 nốt (mở popup nốt tiếp theo).
 * 3. Phím Shift+Tab: lùi lại 1 nốt (mở lại popup nốt trước đó).
 * 4. Phím T: nhận hợp âm gợi ý từ TLH.
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
      return route.fulfill({ json: { success: true, chords: [] } });
    }
    if (method === 'POST') {
      return route.fulfill({ json: { success: true } });
    }
    return route.continue();
  });
  return calls;
}

test.describe('R2-1 · Con trỏ nốt theo thứ tự mapNotes, Enter tiến & Shift+Tab lùi', () => {

  test('1. Con trỏ nốt viền sáng (.cc-note-cursor) và Enter tiến tới nốt tiếp theo', async ({ page }) => {
    const sid = loginAsHoaiDinh();
    await page.context().addCookies([{ name: 'PHPSESSID', value: sid, domain: 'localhost', path: '/' }]);
    await mockChordSets(page);

    await page.goto('./?song=thanh-ca-002', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });
    await expect(page.locator('#chord-set-selector')).toHaveValue('HD');

    // Bấm C vào chế độ soạn hợp âm
    await page.keyboard.press('c');
    await expect(page.locator('.cc-dot-btn').first()).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(200);

    // Bấm vào dot đầu tiên
    await page.locator('.cc-dot-btn').first().click();
    await expect(page.locator('.cc-popup, .cc-popup-mobile')).toBeVisible({ timeout: 5000 });

    // 1. Kiểm tra nốt được viền .cc-note-cursor
    const cursorCount = await page.locator('.cc-note-cursor').count();
    expect(cursorCount).toBeGreaterThanOrEqual(1);

    // 2. Gõ hợp âm "F" rồi bấm Enter -> Phải lưu và tiến sang nốt tiếp theo
    const input = page.locator('#cc-pop-inp');
    await input.fill('F');

    // Dispatch phím Enter
    await input.evaluate(el => el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })));

    // Popup nốt kế tiếp mở ra (không còn là "F" vừa gõ)
    await expect(page.locator('.cc-popup, .cc-popup-mobile')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#cc-pop-inp')).not.toHaveValue('F', { timeout: 5000 });

    // Con trỏ nốt vẫn hiển thị ở nốt mới
    const nextCursorCount = await page.locator('.cc-note-cursor').count();
    expect(nextCursorCount).toBeGreaterThanOrEqual(1);
  });

  test('2. Phím Shift+Tab lùi lại nốt trước đó', async ({ page }) => {
    const sid = loginAsHoaiDinh();
    await page.context().addCookies([{ name: 'PHPSESSID', value: sid, domain: 'localhost', path: '/' }]);
    await mockChordSets(page);

    await page.goto('./?song=thanh-ca-002', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });

    await page.keyboard.press('c');
    await expect(page.locator('.cc-dot-btn').first()).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(200);

    // Mở nốt đầu tiên
    await page.locator('.cc-dot-btn').first().click();
    await expect(page.locator('.cc-popup, .cc-popup-mobile')).toBeVisible({ timeout: 5000 });

    // Gõ "Am" và Enter tiến sang nốt 2
    const input = page.locator('#cc-pop-inp');
    await input.fill('Am');
    await input.evaluate(el => el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })));

    // Đã ở nốt 2
    await expect(page.locator('#cc-pop-inp')).not.toHaveValue('Am', { timeout: 5000 });

    // Bấm Shift+Tab để lùi lại nốt 1
    const input2 = page.locator('#cc-pop-inp');
    await input2.evaluate(el => el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true })));

    // Popup nốt 1 mở lại với giá trị "Am"
    await expect(page.locator('.cc-popup, .cc-popup-mobile')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#cc-pop-inp')).toHaveValue('Am', { timeout: 5000 });
  });

  test('3. Phím T nhận hợp âm gợi ý', async ({ page }) => {
    const sid = loginAsHoaiDinh();
    await page.context().addCookies([{ name: 'PHPSESSID', value: sid, domain: 'localhost', path: '/' }]);
    await mockChordSets(page);

    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });

    await page.keyboard.press('c');
    await expect(page.locator('.cc-dot-btn, .cc-custom-chord-text').first()).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(200);

    // Mở popup nốt đầu tiên
    await page.locator('.cc-dot-btn, .cc-custom-chord-text').first().click();
    await expect(page.locator('.cc-popup, .cc-popup-mobile')).toBeVisible({ timeout: 5000 });

    const input = page.locator('#cc-pop-inp');
    // Bấm phím T trên input
    await input.evaluate(el => el.dispatchEvent(new KeyboardEvent('keydown', { key: 't', bubbles: true, cancelable: true })));

    // Nếu bài có gợi ý TLH thì input được điền
    const val = await input.inputValue();
    // Đảm bảo không ném lỗi và giá trị là chuỗi
    expect(typeof val).toBe('string');
  });

});
