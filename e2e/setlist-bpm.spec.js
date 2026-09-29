// @ts-check
const { test, expect } = require('@playwright/test');
const { execSync } = require('child_process');

/**
 * E2E-06: setlist-bpm.spec.js
 *
 * Nghiệm thu Ticket T17 (GIAO_VIEC_G3.9.md):
 * - Core Rule 4: Setlist giữ thông số (BPM, Transpose, Chord Profile).
 * - Bài hát trong Setlist có BPM = 90 (trong khi XML tempo khác 90).
 * - Khi phát bài hát trong Setlist, Metronome phải nhận và hiển thị đúng 90 BPM.
 * - Test này phải PASS trước và sau khi tách setlist-ui.js.
 */

const fs = require('fs');
const phpBin = process.env.PHP_BIN || (fs.existsSync('C:\\xampp\\php\\php.exe') ? 'C:\\xampp\\php\\php.exe' : 'php');

test.describe('E2E-06: Setlist BPM Preservation (Core Rule 4)', () => {
  let setlistId = null;

  test.beforeEach(async ({ page }) => {
    // 1. Tạo Setlist fixture có bài hát với BPM = 90
    const out = execSync(`"${phpBin}" tools/create_test_setlist.php bpm`, { encoding: 'utf-8' });
    const res = JSON.parse(out);
    expect(res.success).toBe(true);
    setlistId = res.setlist_id;

    // Thiết lập phiên khách
    await page.addInitScript(() => {
      sessionStorage.setItem('sheetapp_guest_chosen', '1');
    });
  });

  test.afterEach(async () => {
    // Dọn dẹp setlist fixture
    if (setlistId) {
      try {
        execSync(`"${phpBin}" tools/create_test_setlist.php cleanup ${setlistId}`);
      } catch (e) {}
    }
  });

  test('Phát bài hát từ Setlist với BPM 90: Metronome và Chip Tempo hiển thị đúng 90 BPM', async ({ page }) => {
    // 1. Mở trang chủ
    await page.goto('./', { waitUntil: 'domcontentloaded' });

    // Đóng auth-modal nếu có
    const closeAuthBtn = page.locator('#btn-close-auth');
    if (await closeAuthBtn.isVisible()) {
      await closeAuthBtn.click();
      await page.waitForTimeout(100);
    }

    // 2. Chuyển sang Tab Setlist và mở Setlist vừa tạo
    await page.evaluate(async (id) => {
      if (window.SetlistUI?.switchToSetlistTab) {
        await window.SetlistUI.switchToSetlistTab(id);
      }
    }, setlistId);

    // Chờ chi tiết setlist hiển thị
    const setlistDetail = page.locator('#setlist-detail');
    await expect(setlistDetail).toBeVisible({ timeout: 10000 });

    // Chờ danh sách bài hát trong setlist hiển thị
    const firstItem = page.locator('#setlist-items .song-item').first();
    await expect(firstItem).toBeVisible({ timeout: 10000 });

    // 3. Click phát bài hát trong setlist
    await firstItem.click();

    // 4. Chờ bản nhạc SVG xuất hiện
    const svgEl = page.locator('#osmd-container svg').first();
    await expect(svgEl).toBeVisible({ timeout: 25000 });

    // 5. Kiểm tra Metronome BPM trên client
    const metronomeBpm = await page.evaluate(() => {
      return window.Metronome ? window.Metronome.getBpm() : null;
    });
    expect(metronomeBpm).toBe(90);

    // 6. Kiểm tra hiển thị chip tempo trên thanh Song Info Bar
    // Ticket R1-3 (ROADMAP5): #si-tempo-chip sống trong #song-info-strip, nay bị ẩn
    // vĩnh viễn (display:none!important) -- thông tin Tempo chuyển vào popover ⓘ.
    await page.locator('#btn-song-info-popover').click();
    const tempoChip = page.locator('#si-pop-tempo');
    await expect(tempoChip).toBeVisible();
    await expect(tempoChip).toContainText('90');
  });
});
