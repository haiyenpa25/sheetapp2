// @ts-check
const { test, expect } = require('@playwright/test');
const { execSync } = require('child_process');

test.use({ serviceWorkers: 'block' });

function loginAsBanHat() {
  return execSync('C:\\xampp\\php\\php.exe tools/create_test_session.php banhat', {
    env: { ...process.env, SHEETAPP_E2E: '1' }
  }).toString().trim();
}

function runPhp(code) {
  return execSync('C:\\xampp\\php\\php.exe', {
    input: `<?php require 'api/core/DB.php'; ${code}`,
    env: { ...process.env, SHEETAPP_E2E: '1' }
  }).toString().trim();
}

function queryDb(sql) {
  const output = runPhp(`echo json_encode(DB::get()->query(${JSON.stringify(sql)})->fetchAll(PDO::FETCH_ASSOC));`);
  return JSON.parse(output);
}

function executeDb(sql) {
  runPhp(`DB::get()->exec(${JSON.stringify(sql)});`);
}

test.describe('R2-9 · Đề xuất lên HD từ trình soạn (Review)', () => {

  test.beforeEach(async ({ page }) => {
    // Dọn dẹp các review_request cũ của bài test trước khi chạy
    executeDb("DELETE FROM review_requests WHERE song_id = 'thanh-ca-001' AND review_type = 'update_hd'");

    await page.addInitScript(() => {
      sessionStorage.setItem('sheetapp_guest_chosen', '1');
      localStorage.setItem('sheetapp_guest_toast_shown', '1');
    });
  });

  test.afterEach(async () => {
    // Dọn dẹp sau khi chạy
    executeDb("DELETE FROM review_requests WHERE song_id = 'thanh-ca-001' AND review_type = 'update_hd'");
  });

  test('Gửi đề xuất từ trình soạn tạo đúng 1 review_request mang đúng song_id', async ({ page }) => {
    const sid = loginAsBanHat();
    await page.context().addCookies([{ name: 'PHPSESSID', value: sid, domain: 'localhost', path: '/' }]);

    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });

    // 1. Chuyển sang bộ cá nhân BH và lưu ít nhất 1 hợp âm test
    await page.evaluate(async () => {
      await window.ChordCanvas?.switchSet?.('BH');
      // Đặt hợp âm test
      const chords = window.ChordCanvas?.getCustomChords?.() || {};
      chords['0_0'] = 'C';
      chords['1_0'] = 'F';
      window.ChordCanvas?.setCustomChords?.(chords);
      await window.ChordCanvasEdit?.executeSave?.();
      window.ChordCanvas?.updateSetUI?.();
    });

    // 2. Nút đề xuất #btn-propose-hd phải hiển thị (không bị ẩn bởi class hidden)
    const btnPropose = page.locator('#btn-propose-hd');
    await expect(btnPropose).toBeVisible({ timeout: 5000 });

    // 3. Click nút đề xuất để mở modal
    await btnPropose.click();

    const modal = page.locator('#cc-propose-hd-modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // 4. Điền ghi chú đề xuất
    const noteInput = page.locator('#cc-propose-note');
    await noteInput.fill('Đề xuất hòa âm điệp khúc bài 001 - E2E test R2-9');

    // 5. Bấm nút gửi đề xuất
    const submitBtn = page.locator('#cc-propose-submit');
    await submitBtn.click();

    // 6. Modal biến mất sau khi gửi thành công
    await expect(modal).not.toBeVisible({ timeout: 10000 });

    // 7. Kiểm tra cơ sở dữ liệu: Phải có đúng 1 review_request mang song_id = 'thanh-ca-001'
    const rows = queryDb("SELECT * FROM review_requests WHERE song_id = 'thanh-ca-001' AND review_type = 'update_hd' AND status = 'pending'");
    expect(rows.length).toBe(1);

    const req = rows[0];
    expect(req.song_id).toBe('thanh-ca-001');
    expect(req.target_type).toBe('chord_set');
    expect(req.review_type).toBe('update_hd');
    expect(req.status).toBe('pending');
    expect(Number(req.submitted_by)).toBe(1);
    expect(req.submit_note).toContain('E2E test R2-9');
  });

});
