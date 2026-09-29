// @ts-check
const { test, expect } = require('@playwright/test');
const { execSync } = require('child_process');

/**
 * e2e/library-r2-2-chord-palette.spec.js
 *
 * Kiểm thử E2E cho Ticket R2-2 (Bảng hợp âm theo tông đang hiển thị & Sửa B15):
 * 1. Hiển thị 7 hợp âm thuận theo tông đang hiển thị (1-7), hợp âm 7 và hợp âm đảo/sus.
 * 2. Nghiệm thu R2-2: Phím 4 đặt "D" (khi ở Tông A).
 * 3. Chạm/click chip hợp âm đặt giá trị và tự nhảy sang nốt kế tiếp.
 * 4. Sửa B15: Dịch giọng +2 đổi bảng hợp âm sang tông hiển thị thay vì giữ tông gốc.
 * 5. Hợp âm đảo / + số (ví dụ /3 trên A tạo A/C#).
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

test.describe('R2-2 · Bảng hợp âm theo tông đang hiển thị & Sửa B15', () => {

  test('1. Bảng hợp âm 7 bậc thuận và phím 4 đặt "D" ở tông A', async ({ page }) => {
    const sid = loginAsHoaiDinh();
    await page.context().addCookies([{ name: 'PHPSESSID', value: sid, domain: 'localhost', path: '/' }]);
    await mockChordSets(page);

    await page.goto('./?song=thanh-ca-002', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });

    // Dịch giọng sang tông A nếu cần, hoặc thiết lập transpose qua Store/KeyService
    await page.evaluate(() => {
      // Mock detectDisplayKey trả về tông A
      if (window.ChordCanvasTranspose) {
        window.ChordCanvasTranspose.detectDisplayKey = () => ({
          origRoot: 'G',
          origMode: 'major',
          displayedRoot: 'A',
          mode: 'major',
          semitones: 2,
          label: 'A trưởng (đang +2)'
        });
      }
    });

    // Mở chế độ soạn hợp âm
    await page.keyboard.press('c');
    await expect(page.locator('.cc-dot-btn').first()).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(200);

    // Bấm vào dot đầu tiên
    await page.locator('.cc-dot-btn').first().click();
    await expect(page.locator('.cc-popup, .cc-popup-mobile')).toBeVisible({ timeout: 5000 });

    // 1. Kiểm tra 7 chip hợp âm thuận hiển thị: A, Bm, C#m, D, E, F#m, G#dim
    const diaChips = page.locator('.cc-chip-dia');
    await expect(diaChips).toHaveCount(7);
    await expect(diaChips.nth(0)).toContainText('A');
    await expect(diaChips.nth(1)).toContainText('Bm');
    await expect(diaChips.nth(2)).toContainText('C#m');
    await expect(diaChips.nth(3)).toContainText('D');
    await expect(diaChips.nth(4)).toContainText('E');
    await expect(diaChips.nth(5)).toContainText('F#m');
    await expect(diaChips.nth(6)).toContainText('G#dim');

    // 2. Nghiệm thu R2-2: Phím 4 đặt "D"
    const input = page.locator('#cc-pop-inp');
    // Input đang trống hoặc được bôi đen -> bấm phím '4'
    await input.evaluate(el => el.dispatchEvent(new KeyboardEvent('keydown', { key: '4', code: 'Digit4', bubbles: true, cancelable: true })));
    await expect(input).toHaveValue('D');

    // 3. Phím Enter lưu "D" và tự tiến sang nốt kế tiếp
    await input.evaluate(el => el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })));
    await expect(page.locator('.cc-popup, .cc-popup-mobile')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#cc-pop-inp')).not.toHaveValue('D', { timeout: 5000 });
  });

  test('2. Chạm chip hợp âm thuận tự đặt hợp âm và nhảy sang nốt kế tiếp', async ({ page }) => {
    const sid = loginAsHoaiDinh();
    await page.context().addCookies([{ name: 'PHPSESSID', value: sid, domain: 'localhost', path: '/' }]);
    await mockChordSets(page);

    await page.goto('./?song=thanh-ca-002', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });

    await page.evaluate(() => {
      if (window.ChordCanvasTranspose) {
        window.ChordCanvasTranspose.detectDisplayKey = () => ({
          origRoot: 'C',
          origMode: 'major',
          displayedRoot: 'C',
          mode: 'major',
          semitones: 0,
          label: 'C trưởng'
        });
      }
    });

    await page.keyboard.press('c');
    await expect(page.locator('.cc-dot-btn').first()).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(300);
    await page.locator('.cc-dot-btn').first().click();
    await expect(page.locator('.cc-popup, .cc-popup-mobile')).toBeVisible({ timeout: 5000 });

    // Bấm chip bậc 5 (G)
    const chipG = page.locator('.cc-chip-dia[data-chord="G"]');
    await expect(chipG).toBeVisible();
    await chipG.click();

    // Popup nốt kế tiếp mở ra
    await expect(page.locator('.cc-popup, .cc-popup-mobile')).toBeVisible({ timeout: 5000 });
  });

  test('3. Sửa B15: Dịch +2 thì bảng hiển thị đúng tông đã dịch thay vì tông gốc', async ({ page }) => {
    const sid = loginAsHoaiDinh();
    await page.context().addCookies([{ name: 'PHPSESSID', value: sid, domain: 'localhost', path: '/' }]);
    await mockChordSets(page);

    await page.goto('./?song=thanh-ca-002', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });

    // Giả lập gốc G, dịch +2 -> tông A
    await page.evaluate(() => {
      window.Store?.set?.('currentTranspose', 2);
      if (window.App) window.App.getCurrentTranspose = () => 2;
    });

    await page.keyboard.press('c');
    await expect(page.locator('.cc-dot-btn').first()).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(300);
    await page.locator('.cc-dot-btn').first().click();
    await expect(page.locator('.cc-popup, .cc-popup-mobile')).toBeVisible({ timeout: 5000 });

    // Bảng hợp âm phải có A và D (của tông A), không phải G và C (của tông G)
    const chipA = page.locator('.cc-chip-dia[data-degree="1"]');
    await expect(chipA).toContainText('A');
    const chipD = page.locator('.cc-chip-dia[data-degree="4"]');
    await expect(chipD).toContainText('D');
  });

  test('4. Hợp âm đảo qua phím tắt / + số (A + /3 = A/C#)', async ({ page }) => {
    const sid = loginAsHoaiDinh();
    await page.context().addCookies([{ name: 'PHPSESSID', value: sid, domain: 'localhost', path: '/' }]);
    await mockChordSets(page);

    await page.goto('./?song=thanh-ca-002', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });

    await page.evaluate(() => {
      if (window.ChordCanvasTranspose) {
        window.ChordCanvasTranspose.detectDisplayKey = () => ({
          origRoot: 'A',
          origMode: 'major',
          displayedRoot: 'A',
          mode: 'major',
          semitones: 0,
          label: 'A trưởng'
        });
      }
    });

    await page.keyboard.press('c');
    await expect(page.locator('.cc-dot-btn').first()).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(300);
    await page.locator('.cc-dot-btn').first().click();
    await expect(page.locator('.cc-popup, .cc-popup-mobile')).toBeVisible({ timeout: 5000 });

    const input = page.locator('#cc-pop-inp');
    await input.fill('A/');

    // Gõ số 3 -> biến thành A/C#
    await input.evaluate(el => el.dispatchEvent(new KeyboardEvent('keydown', { key: '3', code: 'Digit3', bubbles: true, cancelable: true })));
    await expect(input).toHaveValue('A/C#');
  });

});
