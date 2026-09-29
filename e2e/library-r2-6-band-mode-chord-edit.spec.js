// @ts-check
const { test, expect } = require('@playwright/test');
const { execSync } = require('child_process');

test.use({ serviceWorkers: 'block' });

function loginAsHoaiDinh() {
  return execSync('C:\\xampp\\php\\php.exe tools/create_test_session.php hoaidinh').toString().trim();
}

test.describe('R2-6 · Soạn hợp âm trên chế độ Lời & Hợp âm', () => {

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('sheetapp_guest_chosen', '1');
      localStorage.setItem('sheetapp_guest_toast_shown', '1');
    });
  });

  test('1. Nghiệm thu R2-6: Chạm âm tiết "Vua", chọn "F" thì chế độ Bản nhạc cũng hiện F ở đúng nốt', async ({ page }) => {
    const sid = loginAsHoaiDinh();
    await page.context().addCookies([{ name: 'PHPSESSID', value: sid, domain: 'localhost', path: '/' }]);

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
        return route.fulfill({ json: { success: true, message: 'Đã lưu', checksum: 'chk-r26-123' } });
      }
      return route.continue();
    });

    // Mở bài 001 ở chế độ Band (Lời & Hợp âm)
    await page.goto('./?song=thanh-ca-001&v=lyric', { waitUntil: 'domcontentloaded' });
    const lyricContainer = page.locator('#lyric-view-container');
    await expect(lyricContainer).toBeVisible({ timeout: 25000 });

    // Tìm âm tiết "Vua" (ô nhịp 0 nốt 2)
    const vuaPair = page.locator('#lyric-view-container .lv-pair:has-text("Vua")').first();
    await expect(vuaPair).toBeVisible({ timeout: 10000 });
    expect(await vuaPair.getAttribute('data-measure-idx')).toBe('0');
    expect(await vuaPair.getAttribute('data-note-idx')).toBe('2');

    // Chạm vào âm tiết "Vua"
    await vuaPair.click();

    // Bảng hợp âm mở ra
    const popup = page.locator('.cc-popup');
    await expect(popup).toBeVisible({ timeout: 5000 });

    // Chọn hợp âm "F" từ bảng hợp âm (hoặc gõ F vào input)
    const chipF = page.locator('.cc-popup .cc-chip:text-is("F"), .cc-popup [data-chord="F"]').first();
    if (await chipF.isVisible()) {
      await chipF.click();
    } else {
      const inp = page.locator('#cc-pop-inp');
      await inp.fill('F');
      await page.keyboard.press('Enter');
    }

    // Kiểm tra trong chế độ Lời & Hợp âm: chữ "F" hiển thị trên âm tiết "Vua"
    await expect(page.locator('#lyric-view-container .lv-pair:has-text("Vua") .lv-chord')).toHaveText('F', { timeout: 5000 });

    // Chuyển sang chế độ Bản nhạc qua nút toolbar #btn-view-sheet hoặc #btn-band-toggle
    const btnViewSheet = page.locator('#btn-view-sheet');
    if (await btnViewSheet.isVisible()) {
      await btnViewSheet.click();
    } else {
      await page.locator('#btn-band-toggle').click();
    }

    // Chế độ bản nhạc hiển thị
    const osmdContainer = page.locator('#osmd-container');
    await expect(osmdContainer).toBeVisible({ timeout: 10000 });

    // Tiêu chí nghiệm thu cốt lõi: Chế độ Bản nhạc cũng hiện F ở đúng nốt (0_2)
    const customF = page.locator('#osmd-container .cc-custom-chord-text:has-text("F"), #osmd-container [data-chord="F"]').first();
    await expect(customF).toBeVisible({ timeout: 5000 });

    const chordsInApp = await page.evaluate(() => window.ChordCanvas?.getCustomChords?.() || {});
    expect(chordsInApp['0_2']).toBe('F');
  });

  test('2. Soạn hợp âm bằng hộp thoại ChordPro trên chế độ Lời & Hợp âm', async ({ page }) => {
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
        return route.fulfill({ json: { success: true, message: 'Đã lưu', checksum: 'chk-cp-123' } });
      }
      return route.continue();
    });

    await page.goto('./?song=thanh-ca-001&v=lyric', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#lyric-view-container')).toBeVisible({ timeout: 25000 });

    // Bấm nút "✎ Gõ ChordPro" trên phân đoạn Lời 1
    const cpBtn = page.locator('.lv-edit-chordpro-btn').first();
    await expect(cpBtn).toBeVisible({ timeout: 10000 });
    await cpBtn.click();

    // Hộp thoại modal ChordPro xuất hiện
    const modal = page.locator('#lv-chordpro-modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    const textarea = page.locator('#lv-cp-textarea');
    await expect(textarea).toBeVisible();

    // Điền văn bản ChordPro có [F] trước Vua
    await textarea.fill('[G]Cúi xin [F]Vua vinh hiển');
    await page.locator('#lv-cp-apply').click();

    // Modal đóng
    await expect(modal).toBeHidden({ timeout: 3000 });

    // Kiểm tra hợp âm 'F' đã được gán vào nốt '0_2' ("Vua")
    const chordsInApp = await page.evaluate(() => window.ChordCanvas?.getCustomChords?.() || {});
    expect(chordsInApp['0_2']).toBe('F');
    expect(chordsInApp['0_0']).toBe('G');

    // Hiển thị ngay trên Lời & Hợp âm
    await expect(page.locator('#lyric-view-container .lv-pair:has-text("Vua") .lv-chord')).toHaveText('F');
  });

});
