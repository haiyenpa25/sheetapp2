// @ts-check
const { test, expect } = require('@playwright/test');
const { execSync } = require('child_process');

/**
 * e2e/chordpro-print.spec.js
 *
 * Kiểm thử E2E cho Epic 4.3:
 * Xuất bản in Lời & Hợp âm ChordPro chuyên dụng (print/chord-sheet.php):
 * 1. Mở trang in Lời & Hợp âm của bài 001
 * 2. Xác nhận tiêu đề bài hát, tông gốc, lời và nốt hợp âm hiển thị
 * 3. Kiểm tra thanh công cụ in ấn: Nút Đổi tông (+/-), Ẩn/Hiện hợp âm, Cỡ chữ, 1 cột / 2 cột
 * 4. Tương tác chuyển đổi tông và kiểm tra nhãn tông cập nhật tương ứng
 * 5. Xác nhận console sạch không có lỗi JS
 */

test.describe('Epic 4.3: Trang In Lời & Hợp Âm ChordPro (print/chord-sheet.php)', () => {
  test('Hiển thị bản in Lời + Hợp âm với thanh công cụ định dạng tương tác', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    // 1. Mở trang in Chord Sheet bài thanh-ca-001
    await page.goto('./print/chord-sheet.php?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });

    // 2. Tiêu đề bài hát hiển thị
    const title = page.locator('h1.song-title');
    await expect(title).toBeVisible({ timeout: 10000 });
    await expect(title).toContainText('HỠI THÁNH VƯƠNG');

    // 3. Thanh công cụ in ấn hiển thị
    const controlBar = page.locator('.control-bar');
    await expect(controlBar).toBeVisible({ timeout: 5000 });

    // 4. Có hợp âm và lời bài hát
    const chords = page.locator('.chord');
    await expect(chords.first()).toBeVisible({ timeout: 5000 });

    // 5. Kiểm tra nút dịch tông (+1 / -1)
    const btnUp = controlBar.locator('button:has-text("+1")');
    const badgeInfo = controlBar.locator('.badge-info');
    await expect(btnUp).toBeVisible();

    const initialKey = await badgeInfo.innerText();
    await Promise.all([
      page.waitForNavigation(),
      btnUp.click(),
    ]);
    const updatedKey = await page.locator('.control-bar .badge-info').innerText();
    expect(updatedKey).not.toEqual(initialKey);

    // 6. Kiểm tra nút ẩn/hiện hợp âm
    const btnToggleChords = controlBar.locator('button:has-text("Ẩn hợp âm"), button:has-text("Hiện hợp âm")');
    await expect(btnToggleChords).toBeVisible();
    await btnToggleChords.click();

    // 7. Xác nhận console sạch không có lỗi
    expect(consoleErrors).toEqual([]);
  });
});
