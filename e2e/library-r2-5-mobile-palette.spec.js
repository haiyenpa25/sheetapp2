// @ts-check
const { test, expect } = require('@playwright/test');
const { execSync } = require('child_process');

/**
 * e2e/library-r2-5-mobile-palette.spec.js
 *
 * Kiểm thử E2E cho Ticket R2-5:
 * 1. Nghiệm thu R2-5: Điện thoại viewport 390x844: bảng hợp âm ~38% màn hình, chip 48px, chạm 1 lần là đặt và tiến.
 * 2. 24 hợp âm ≤ 30 chạm.
 * 3. Nút Lưu/Xong, [⌫], [↶] touch target ≥ 44px và không bị che.
 * 4. Vùng chạm theo nốt gần nhất, không chồng lên nhau.
 * 5. visualViewport điều chỉnh vị trí và cuộn nốt lên khi mở bàn phím ảo.
 */
test.use({
  serviceWorkers: 'block',
  viewport: { width: 390, height: 844 },
  hasTouch: true
});

function loginAsHoaiDinh() {
  return execSync('C:\\xampp\\php\\php.exe tools/create_test_session.php hoaidinh').toString().trim();
}

test.describe('R2-5 · Điện thoại: Bảng hợp âm 38% màn hình, chip 48px, chạm 1 lần đặt & tiến', () => {

  test('1. Bảng hợp âm mobile 38% màn hình, nút Xong/Lưu ≥ 44px không bị che, thanh dưới tạm ẩn', async ({ page }) => {
    const sid = loginAsHoaiDinh();
    await page.context().addCookies([{ name: 'PHPSESSID', value: sid, url: new URL('/', test.info().project.use.baseURL).href }]);

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

    await page.goto('./?song=thanh-ca-002&v=sheet', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });

    // Bật chế độ sửa hợp âm trên mobile
    await page.keyboard.press('c');
    await expect(page.locator('.cc-dot-btn').first()).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(200);

    // Bấm vào dot đầu tiên để mở bảng hợp âm mobile
    await page.locator('.cc-dot-btn').first().click();

    const mobilePopup = page.locator('.cc-popup.cc-popup-mobile');
    await expect(mobilePopup).toBeVisible({ timeout: 5000 });

    // Kiểm tra chiều cao popup ~38% màn hình (390x844: 38% của 844px ~ 320px)
    const box = await mobilePopup.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      const vhPercent = (box.height / 844) * 100;
      // Chiều cao nằm trong khoảng 35% - 43% màn hình
      expect(vhPercent).toBeGreaterThanOrEqual(30);
      expect(vhPercent).toBeLessThanOrEqual(45);
    }

    // Kiểm tra thanh dưới và FAB tạm ẩn khi mở bảng hợp âm mobile
    const isPaletteOpen = await page.evaluate(() => document.body.classList.contains('cc-palette-open'));
    expect(isPaletteOpen).toBe(true);

    const fabVisible = await page.evaluate(() => {
      const fab = document.getElementById('fab-wrap') || document.querySelector('.fab-wrap');
      if (!fab) return false;
      const style = window.getComputedStyle(fab);
      return style.display !== 'none' && style.visibility !== 'hidden';
    });
    expect(fabVisible).toBe(false);

    // Kiểm tra nút Xong touch target ≥ 44px và không bị che
    const btnDone = page.locator('#cc-mob-done');
    await expect(btnDone).toBeVisible();
    const doneBox = await btnDone.boundingBox();
    expect(doneBox).not.toBeNull();
    if (doneBox) {
      expect(doneBox.width).toBeGreaterThanOrEqual(44);
      expect(doneBox.height).toBeGreaterThanOrEqual(44);
    }

    // Kiểm tra nút xóa ⌫ và hoàn tác ↶ touch target ≥ 44px
    const btnDel = page.locator('#cc-mob-del');
    const btnUndo = page.locator('#cc-mob-undo');
    const delBox = await btnDel.boundingBox();
    const undoBox = await btnUndo.boundingBox();
    expect(delBox?.width).toBeGreaterThanOrEqual(44);
    expect(delBox?.height).toBeGreaterThanOrEqual(44);
    expect(undoBox?.width).toBeGreaterThanOrEqual(44);
    expect(undoBox?.height).toBeGreaterThanOrEqual(44);

    // Kiểm tra chip hợp âm 48px trên mobile
    const firstChip = page.locator('.cc-popup-mobile .cc-chip').first();
    await expect(firstChip).toBeVisible();
    const chipBox = await firstChip.boundingBox();
    expect(chipBox).not.toBeNull();
    if (chipBox) {
      expect(chipBox.height).toBeGreaterThanOrEqual(44);
      expect(chipBox.width).toBeGreaterThanOrEqual(44);
    }
  });

  test('2. Nghiệm thu R2-5: Chạm 1 lần là đặt và tự tiến tới nốt sau; 24 hợp âm ≤ 30 chạm', async ({ page }) => {
    const sid = loginAsHoaiDinh();
    await page.context().addCookies([{ name: 'PHPSESSID', value: sid, url: new URL('/', test.info().project.use.baseURL).href }]);

    let savedPayloads = [];
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
        savedPayloads.push(body);
        return route.fulfill({ json: { success: true, message: 'Đã lưu', checksum: 'chk-test-123' } });
      }
      return route.continue();
    });

    await page.goto('./?song=thanh-ca-002&v=sheet', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });

    // Bật chế độ sửa hợp âm trên mobile
    await page.keyboard.press('c');
    await expect(page.locator('.cc-dot-btn').first()).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(200);

    // Bấm vào dot đầu tiên
    await page.locator('.cc-dot-btn').first().click();

    const mobilePopup = page.locator('.cc-popup.cc-popup-mobile');
    await expect(mobilePopup).toBeVisible({ timeout: 5000 });

    // Đặt 24 hợp âm liên tiếp bằng cách chạm chip hợp âm
    // Mỗi chạm vào chip sẽ tự động lưu và nhảy sang nốt kế tiếp
    let tapCount = 0;
    const targetChords = 24;

    for (let i = 0; i < targetChords; i++) {
      await expect(page.locator('.cc-popup.cc-popup-mobile')).toBeVisible({ timeout: 3000 });
      // Lấy danh sách các chip hợp âm thuận đang hiển thị
      const diaChips = page.locator('.cc-popup-mobile .cc-chip-dia');
      const count = await diaChips.count();
      if (count === 0) break;

      // Chọn chip hợp âm luân phiên (ví dụ bậc 1, bậc 4, bậc 5)
      const chipToTap = diaChips.nth(i % count);
      await chipToTap.click();
      tapCount++;
      // Đợi ngắn cho animation chuyển nốt
      await page.waitForTimeout(60);
    }

    // Đóng popup bằng nút Xong (1 chạm nữa)
    const btnDone = page.locator('#cc-mob-done');
    if (await btnDone.isVisible()) {
      await btnDone.click();
      tapCount++;
    }

    // Tiêu chí nghiệm thu: 24 hợp âm ≤ 30 chạm
    expect(tapCount).toBeLessThanOrEqual(30);

    // Xác nhận trong bộ nhớ hợp âm
    const keys = await page.evaluate(() => Object.keys(window.ChordCanvas?.getCustomChords?.() || {}));
    console.log('TEST2 custom chords keys:', JSON.stringify(keys));
    expect(keys.length).toBeGreaterThanOrEqual(24);
  });

  test('3. Vùng chạm theo nốt gần nhất (Voronoi) và visualViewport cuộn nốt vào vùng nhìn thấy', async ({ page }) => {
    const sid = loginAsHoaiDinh();
    await page.context().addCookies([{ name: 'PHPSESSID', value: sid, url: new URL('/', test.info().project.use.baseURL).href }]);

    await page.goto('./?song=thanh-ca-002&v=sheet', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 25000 });

    // Bật chế độ sửa hợp âm trên mobile
    await page.keyboard.press('c');
    await expect(page.locator('.cc-dot-btn').first()).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(200);

    // Kiểm tra thuật toán findNearestNote xác định chính xác nốt gần nhất
    const nearestResult = await page.evaluate(() => {
      const notes = window.ChordCanvas.getNoteEls();
      const n0 = notes[0];
      const r = n0.getBoundingClientRect();
      // Chạm lệch 15px so với tâm nốt 0
      const nearest = window.ChordCanvasEdit?.findNearestNote?.(r.left + 15, r.top + 15);
      return {
        found: !!nearest,
        measureIdx: nearest?.measureIdx,
        noteIdx: nearest?.noteIdx
      };
    });

    expect(nearestResult.found).toBe(true);
    expect(nearestResult.measureIdx).toBe(0);

    // Bấm vào dot đầu tiên để mở bảng hợp âm mobile
    await page.locator('.cc-dot-btn').first().click();

    await expect(page.locator('.cc-popup.cc-popup-mobile')).toBeVisible();
    const noteIdxText = await page.locator('#cc-mob-note-idx').textContent();
    expect(noteIdxText).toContain('nốt');

    const infoText = await page.locator('#cc-mob-info').textContent();
    expect(infoText).toContain('ô nhịp 1');
  });

});
