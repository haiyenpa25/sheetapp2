// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * E2E test cho Ticket T15c:
 * Mở Editor, tải danh sách bài hát qua ApiService.songs.list(),
 * mở modal chọn bài hát, lọc bài hát và chuyển bài thành công mà không phát sinh lỗi console.
 */

test.describe('Ticket T15c: Editor MusicXML tích hợp ApiService', () => {
  test('Mở editor, nạp danh sách bài hát qua ApiService và chọn bài', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });

    // 1. Vào trang Editor
    await page.goto('./editor/', { waitUntil: 'domcontentloaded' });

    // 2. Chờ label bài hát hiện tại nạp xong
    const songLabel = page.locator('#current-song-label');
    await expect(songLabel).toBeVisible({ timeout: 15000 });
    await expect(songLabel).not.toHaveText('Đang nạp bài hát...', { timeout: 15000 });
    const initialSongText = await songLabel.textContent();
    console.log(`✅ Editor đã nạp bài hát mặc định: "${initialSongText}"`);

    // 3. Mở modal chọn bài hát
    const btnSelectSong = page.locator('#btn-select-song');
    await btnSelectSong.click();

    // 4. Modal chọn bài hát hiện ra
    const pickerModal = page.locator('#song-picker-modal');
    await expect(pickerModal).toBeVisible({ timeout: 10000 });

    // 5. Kiểm tra danh sách bài hát đã nạp thành công qua ApiService.songs.list()
    const songItems = page.locator('#modal-song-list .song-list-item');
    await expect(songItems.first()).toBeVisible({ timeout: 10000 });
    const count = await songItems.count();
    expect(count).toBeGreaterThan(10);
    console.log(`✅ Modal chọn bài: ${count} bài hát được hiển thị trong danh sách.`);

    // 6. Thử tìm kiếm bài hát theo từ khóa
    const searchInput = page.locator('#song-search-input');
    await searchInput.fill('002');
    await expect(page.locator('#modal-song-list .song-list-item')).toBeVisible();

    // Chọn bài đầu tiên trong kết quả lọc
    const firstFiltered = page.locator('#modal-song-list .song-list-item').first();
    const targetTitle = await firstFiltered.locator('.item-title').textContent();
    await firstFiltered.click();

    // Modal tự đóng sau khi chọn
    await expect(pickerModal).toHaveClass(/hidden/, { timeout: 10000 });

    // Label bài hát cập nhật bài mới
    await expect(songLabel).toContainText(targetTitle.trim(), { timeout: 10000 });
    console.log(`✅ Chuyển bài thành công sang: "${targetTitle.trim()}"`);

    // 7. Xác nhận console sạch không có lỗi
    expect(pageErrors, `Page errors: ${pageErrors.join('; ')}`).toEqual([]);
    expect(consoleErrors, `Console errors: ${consoleErrors.join('; ')}`).toEqual([]);
    console.log('✅ Console sạch hoàn toàn, không có lỗi JS.');
  });
});
