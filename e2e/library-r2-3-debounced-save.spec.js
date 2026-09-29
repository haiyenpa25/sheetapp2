// @ts-check
const { test, expect } = require('@playwright/test');
const { execSync } = require('child_process');

/**
 * e2e/library-r2-3-debounced-save.spec.js
 *
 * Kiểm thử E2E cho Ticket R2-3:
 * 1. Debounce 1.5s: Nhập nhanh 10 hợp âm gửi ≤ 3 request lên server.
 * 2. Chip trạng thái lưu: Hiển thị "Đang lưu…", "Đã lưu ✓".
 * 3. Xử lý xung đột 409: Khi server trả 409 Conflict, hiển thị modal giải quyết xung đột (#cc-conflict-modal).
 * 4. Tùy chọn giải quyết xung đột: "Nạp lại từ máy chủ" và "Ghi đè bằng bản hiện tại".
 */
test.use({ serviceWorkers: 'block' });

function loginAsHoaiDinh() {
  return execSync('C:\\xampp\\php\\php.exe tools/create_test_session.php hoaidinh').toString().trim();
}

test.describe('R2-3 · Debounced Save (1.5s), baseChecksum, Status Chip & 409 Conflict', () => {

  test('1. Gõ nhanh 10 hợp âm gom lại ≤ 3 POST requests lên server (Debounce 1.5s)', async ({ page }) => {
    const sid = loginAsHoaiDinh();
    await page.context().addCookies([{ name: 'PHPSESSID', value: sid, domain: 'localhost', path: '/' }]);

    const saveRequests = [];
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
        return route.fulfill({ json: { success: true, chords: [], checksum: 'chk-initial-123' } });
      }
      if (method === 'POST' && action === 'save') {
        saveRequests.push({ body, time: Date.now() });
        return route.fulfill({ json: { success: true, message: 'Đã lưu', checksum: 'chk-new-' + saveRequests.length } });
      }
      return route.continue();
    });

    await page.goto('./?song=thanh-ca-002', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });

    // Bật chế độ sửa hợp âm trên bộ HD
    await page.evaluate(async () => {
      await window.ChordCanvas?.switchSet?.('HD');
      window.ChordCanvas?.setAddMode?.(true, { skipConfirm: true });
    });

    // Thực hiện 10 lần saveChord liên tiếp rất nhanh (mỗi lần cách nhau 50ms < 1500ms debounce)
    await page.evaluate(async () => {
      for (let i = 0; i < 10; i++) {
        await window.ChordCanvasEdit.saveChord(0, i, ['C', 'Dm', 'Em', 'F', 'G', 'Am', 'Bdim', 'C7', 'G7', 'Fmaj7'][i], false);
        await new Promise(r => setTimeout(r, 60));
      }
    });

    // Kiểm tra status chip hiển thị "Đang soạn…" hoặc "Đang lưu…"
    const chipText = await page.locator('#cc-status-chip').innerText();
    expect(chipText).toMatch(/(Đang soạn|Đang lưu)/);

    // Chờ 2.2 giây để debounce timer (1.5s) hoàn tất việc gom và gửi save request
    await page.waitForTimeout(2200);

    // Xác nhận số lượng save request thực tế ≤ 3 (nghiệm thu R2-3)
    expect(saveRequests.length).toBeLessThanOrEqual(3);
    expect(saveRequests.length).toBeGreaterThanOrEqual(1);

    // Xác nhận status chip chuyển sang "Đã lưu ✓"
    const finalChipText = await page.locator('#cc-status-chip').innerText();
    expect(finalChipText).toContain('Đã lưu');
  });

  test('2. Server trả mã lỗi 409 Conflict hiển thị hộp thoại chọn giải quyết xung đột', async ({ page }) => {
    const sid = loginAsHoaiDinh();
    await page.context().addCookies([{ name: 'PHPSESSID', value: sid, domain: 'localhost', path: '/' }]);

    let saveAttemptCount = 0;
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
        return route.fulfill({ json: { success: true, chords: [{ measureIdx: 0, noteIdx: 0, chord: 'C' }], checksum: 'chk-server-orig' } });
      }
      if (method === 'POST' && action === 'save') {
        saveAttemptCount++;
        // Lần đầu trả 409 Conflict với dữ liệu server đã thay đổi
        if (saveAttemptCount === 1) {
          return route.fulfill({
            status: 409,
            contentType: 'application/json',
            json: {
              success: false,
              conflict: true,
              error: 'Xung đột dữ liệu',
              currentChecksum: 'chk-server-updated',
              serverChords: [
                { measureIdx: 0, noteIdx: 0, chord: 'G' },
                { measureIdx: 0, noteIdx: 1, chord: 'Am' }
              ]
            }
          });
        }
        // Lần sau (khi người dùng chọn ghi đè) thì thành công
        return route.fulfill({ json: { success: true, message: 'Ghi đè thành công', checksum: 'chk-overwritten' } });
      }
      return route.continue();
    });

    await page.goto('./?song=thanh-ca-002', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });

    // Bật chế độ sửa hợp âm trên bộ HD với baseChecksum ban đầu
    await page.evaluate(async () => {
      await window.ChordCanvas?.switchSet?.('HD');
      window.ChordCanvas?.setAddMode?.(true, { skipConfirm: true });
      window.ChordCanvasEdit.setBaseChecksum('chk-server-orig', { '0_0': 'C' });
    });

    // Thực hiện lưu làm phát sinh 409 Conflict
    await page.evaluate(async () => {
      window.ChordCanvasEdit.saveChord(0, 0, 'F', false);
      // Gọi flushSave để kích hoạt lưu ngay lập tức
      await window.ChordCanvasEdit.flushSave();
    });

    // Xác nhận hộp thoại xung đột xuất hiện trong DOM
    const conflictModal = page.locator('#cc-conflict-modal');
    await expect(conflictModal).toBeVisible({ timeout: 5000 });

    // Xác nhận có 2 nút giải quyết xung đột
    const btnReload = page.locator('#cc-conflict-reload');
    const btnOverwrite = page.locator('#cc-conflict-overwrite');
    await expect(btnReload).toBeVisible();
    await expect(btnOverwrite).toBeVisible();

    // Nhấn nút ghi đè lên máy chủ
    await btnOverwrite.click();

    // Xác nhận modal đã đóng và status chip chuyển sang "Đã lưu ✓"
    await expect(conflictModal).not.toBeVisible({ timeout: 3000 });
    await expect(page.locator('#cc-status-chip')).toHaveText(/Đã lưu/, { timeout: 5000 });
    expect(saveAttemptCount).toBe(2);
  });

});
