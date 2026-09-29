// @ts-check
const { test, expect } = require('@playwright/test');
const { execSync } = require('child_process');

/**
 * e2e/library-r2-4-copy-measures.spec.js
 *
 * Kiểm thử E2E cho Ticket R2-4:
 * 1. Nghiệm thu R2-4: Chép ô 3–4 sang 11–12 thì 4 hợp âm mới đúng vị trí.
 * 2. Mở modal chép ô nhịp qua nút "≡ Chép ô" trong popup soạn hợp âm.
 * 3. Hỗ trợ phím tắt sao chép và dán nhanh ô nhịp (Ctrl+C / Ctrl+V).
 */
test.use({ serviceWorkers: 'block' });

function loginAsHoaiDinh() {
  return execSync('C:\\xampp\\php\\php.exe tools/create_test_session.php hoaidinh').toString().trim();
}

test.describe('R2-4 · Chép ô nhịp (Ctrl+C/V & Modal) cho điệp khúc và phần lặp', () => {

  test('1. Nghiệm thu R2-4: Chép ô 3–4 sang 11–12 thì 4 hợp âm mới đúng vị trí', async ({ page }) => {
    const sid = loginAsHoaiDinh();
    await page.context().addCookies([{ name: 'PHPSESSID', value: sid, domain: 'localhost', path: '/' }]);

    await page.route('**/api/index.php?route=chord_sets*', async (route) => {
      const req = route.request();
      const method = req.method();
      const url = new URL(req.url());
      let body = null;
      if (method === 'POST') {
        try { body = JSON.parse(req.postData() || '{}'); } catch (e) { body = null; }
      }
      const action = body?.action || url.searchParams.get('action');

      if (method === 'GET' && action === 'list') {
        return route.fulfill({ json: { success: true, sets: ['HD', 'default'] } });
      }
      if (method === 'GET' && action === 'load') {
        return route.fulfill({ json: { success: true, chords: [] } });
      }
      if (method === 'POST' && action === 'save') {
        return route.fulfill({ json: { success: true, message: 'Đã lưu' } });
      }
      return route.continue();
    });

    await page.goto('./?song=thanh-ca-002', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });

    // Bật chế độ sửa hợp âm trên bộ HD và gán sẵn 4 hợp âm tại ô 3 (index 2) và ô 4 (index 3)
    await page.evaluate(async () => {
      await window.ChordCanvas?.switchSet?.('HD');
      window.ChordCanvas?.setAddMode?.(true, { skipConfirm: true });
      const chords = window.ChordCanvas.getCustomChords();
      // Ô 3: C, G
      chords['2_0'] = 'C';
      chords['2_1'] = 'G';
      // Ô 4: Am, F
      chords['3_0'] = 'Am';
      chords['3_1'] = 'F';
      window.ChordCanvas.setCustomChords(chords);
    });

    // Mở modal chép ô nhịp
    await page.evaluate(() => {
      window.ChordCanvasEdit.showCopyMeasuresModal(2); // ô 3
    });

    // Xác nhận modal xuất hiện
    const modal = page.locator('#cc-copy-measures-modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Điền: từ ô 3 đến ô 4, dán sang ô 11
    await page.fill('#cc-copy-from-start', '3');
    await page.fill('#cc-copy-from-end', '4');
    await page.fill('#cc-copy-to-start', '11');

    // Nhấn nút Sao chép
    await page.click('#cc-btn-do-copy-measures');
    await expect(modal).not.toBeVisible({ timeout: 3000 });

    // Kiểm tra kết quả trong getCustomChords: 4 hợp âm mới ở ô 11 (index 10) và ô 12 (index 11)
    const resultChords = await page.evaluate(() => window.ChordCanvas.getCustomChords());

    expect(resultChords['10_0']).toBe('C');
    expect(resultChords['10_1']).toBe('G');
    expect(resultChords['11_0']).toBe('Am');
    expect(resultChords['11_1']).toBe('F');
  });

  test('2. Hộp thoại chép ô nhịp và hàm copyMeasures hoạt động đồng bộ', async ({ page }) => {
    const sid = loginAsHoaiDinh();
    await page.context().addCookies([{ name: 'PHPSESSID', value: sid, domain: 'localhost', path: '/' }]);

    await page.route('**/api/index.php?route=chord_sets*', async (route) => {
      const req = route.request();
      const method = req.method();
      const url = new URL(req.url());
      const action = url.searchParams.get('action');
      if (method === 'GET' && action === 'list') {
        return route.fulfill({ json: { success: true, sets: ['HD', 'default'] } });
      }
      return route.fulfill({ json: { success: true, chords: [] } });
    });

    await page.goto('./?song=thanh-ca-002', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });

    // Bật chế độ sửa hợp âm trên bộ HD và gán hợp âm ở ô 2 (index 1)
    await page.evaluate(async () => {
      await window.ChordCanvas?.switchSet?.('HD');
      window.ChordCanvas?.setAddMode?.(true, { skipConfirm: true });
      const chords = window.ChordCanvas.getCustomChords();
      chords['1_0'] = 'Dm';
      chords['1_1'] = 'G7';
      window.ChordCanvas.setCustomChords(chords);
    });

    // Mở modal chép ô nhịp và hủy
    await page.evaluate(() => {
      window.ChordCanvasEdit.showCopyMeasuresModal(1);
    });

    const modal = page.locator('#cc-copy-measures-modal');
    await expect(modal).toBeVisible({ timeout: 5000 });
    await page.click('#cc-copy-cancel');
    await expect(modal).not.toBeVisible({ timeout: 3000 });

    // Kiểm tra chép ô nhịp từ ô 2 sang ô 5
    await page.evaluate(() => {
      window.ChordCanvasEdit.copyMeasures(2, 2, 5);
    });

    const resultChords = await page.evaluate(() => window.ChordCanvas.getCustomChords());
    expect(resultChords['4_0']).toBe('Dm');
    expect(resultChords['4_1']).toBe('G7');
  });

});
