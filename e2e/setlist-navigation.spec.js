// @ts-check
const { test, expect } = require('@playwright/test');
const { execSync } = require('child_process');

/**
 * E2E-07: setlist-navigation.spec.js
 *
 * Nghiệm thu Ticket T17 (GIAO_VIEC_G3.9.md):
 * - Tạo setlist có 5 bài hát khác nhau.
 * - Phát bài 1, sau đó chuyển nhanh liên tiếp 4 lần sang bài 2, 3, 4, 5.
 * - Đảm bảo không bị race condition, không nuốt bài.
 * - Tiêu đề và hợp âm hiển thị chính xác khớp với bài cuối cùng (bài thứ 5).
 * - Test này phải PASS trước và sau khi tách setlist-ui.js.
 */

const fs = require('fs');
const phpBin = process.env.PHP_BIN || (fs.existsSync('C:\\xampp\\php\\php.exe') ? 'C:\\xampp\\php\\php.exe' : 'php');

test.describe('E2E-07: Setlist Fast Navigation (5 bài liên tiếp)', () => {
  let setlistId = null;
  let lastSongExpected = null;

  test.beforeEach(async ({ page }) => {
    // 1. Tạo Setlist fixture có 5 bài hát
    const out = execSync(`"${phpBin}" tools/create_test_setlist.php nav`, { encoding: 'utf-8' });
    const res = JSON.parse(out);
    expect(res.success).toBe(true);
    setlistId = res.setlist_id;
    lastSongExpected = res.last_song;

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

  test('Chuyển nhanh 5 bài trong Setlist: hiển thị đúng tiêu đề và dữ liệu bài thứ 5', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error' && !msg.text().includes('favicon.ico')) {
        consoleErrors.push(msg.text());
      }
    });

    // 1. Mở trang chủ
    await page.goto('./', { waitUntil: 'domcontentloaded' });

    // Đóng auth-modal nếu có
    const closeAuthBtn = page.locator('#btn-close-auth');
    if (await closeAuthBtn.isVisible()) {
      await closeAuthBtn.click();
      await page.waitForTimeout(100);
    }

    // 2. Chuyển sang Tab Setlist và mở Setlist 5 bài vừa tạo
    await page.evaluate(async (id) => {
      if (window.SetlistUI?.switchToSetlistTab) {
        await window.SetlistUI.switchToSetlistTab(id);
      }
    }, setlistId);

    // Chờ chi tiết setlist hiển thị
    const setlistDetail = page.locator('#setlist-detail');
    await expect(setlistDetail).toBeVisible({ timeout: 10000 });

    // Chờ ít nhất 5 bài hát trong setlist hiển thị
    const songItems = page.locator('#setlist-items .song-item');
    await expect(songItems).toHaveCount(5, { timeout: 10000 });

    // 3. Bắt đầu phát bài đầu tiên (Index 0)
    await songItems.first().click();

    // Chờ bản nhạc bài đầu tiên xuất hiện
    const svgEl = page.locator('#osmd-container svg').first();
    await expect(svgEl).toBeVisible({ timeout: 25000 });

    const initialIdx = await page.evaluate(() => window.SetlistUI?.getCurrentIndex?.());
    expect(initialIdx).toBe(0);

    // 4. Chuyển nhanh 4 lần liên tiếp (từ bài 0 -> 1 -> 2 -> 3 -> 4)
    const btnNext = page.locator('#btn-next-song');
    await expect(btnNext).toBeVisible();

    for (let i = 0; i < 4; i++) {
      await btnNext.click();
      // Nhấn chuyển nhanh với khoảng nghỉ ngắn
      await page.waitForTimeout(200);
    }

    // 5. Đợi bản nhạc bài thứ 5 nạp hoàn tất
    await page.waitForFunction(() => {
      const idx = window.SetlistUI?.getCurrentIndex?.();
      return idx === 4;
    }, { timeout: 20000 });

    // Chờ SVG của bài thứ 5 ổn định
    await expect(svgEl).toBeVisible({ timeout: 20000 });

    // 6. Kiểm tra currentIndex chính xác là 4 (bài thứ 5)
    const finalIdx = await page.evaluate(() => window.SetlistUI?.getCurrentIndex?.());
    expect(finalIdx).toBe(4);

    // 7. Kiểm tra tiêu đề bài hát trên Song Title hoặc Toolbar hiển thị đúng tên bài 5
    const songTitleEl = page.locator('#song-title');
    await expect(songTitleEl).toContainText(lastSongExpected.title);

    // 8. Kiểm tra item thứ 5 trong danh sách Setlist có class active
    const activeItem = page.locator('#setlist-items .song-item.active').first();
    await expect(activeItem).toBeVisible();
    await expect(activeItem).toContainText(lastSongExpected.title);

    // 9. Console không có lỗi nghiêm trọng
    expect(consoleErrors).toEqual([]);
  });
});
