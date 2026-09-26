// @ts-check
const { test, expect } = require('@playwright/test');
const { execSync } = require('child_process');

/**
 * e2e/library-l01-modules.spec.js
 *
 * Kiểm thử E2E cho Ticket L0-1 (ROADMAP 4):
 * 1. Các module cốt lõi ChordCanvas, HistoryManager, PageNav, AdminUI được gắn vào window.
 * 2. Chip hợp âm hiển thị trung thực số hợp âm (thanh-ca-001 bộ HD có 5 hợp âm).
 * 3. Phím C bật chế độ Sửa Hợp Âm khi đăng nhập vai trò banhat.
 * 4. Bấm sao ⭐ lưu bài vào danh sách Yêu Thích và bài hiển thị sau khi reload.
 * 5. Mục "Gần đây" ghi nhận bài hát vừa mở qua HistoryManager.
 */

test.describe('Ticket L0-1: Gắn module cốt lõi vào window và kiểm tra tính năng', () => {
  test('Kiểm tra window exports, chip hợp âm, phím C, Yêu thích và Gần đây', async ({ page }) => {
    // 1. Khởi tạo session đăng nhập banhat qua CLI
    const sessionId = execSync('C:\\xampp\\php\\php.exe tools/create_test_session.php banhat banhat').toString().trim();
    await page.context().addCookies([{
      name: 'PHPSESSID',
      value: sessionId,
      domain: 'localhost',
      path: '/'
    }]);

    await page.addInitScript(() => {
      sessionStorage.setItem('sheetapp_guest_chosen', '1');
    });

    // 2. Mở bài thanh-ca-001
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'domcontentloaded' });

    // Đóng modal auth nếu có
    const closeAuthBtn = page.locator('#btn-close-auth');
    if (await closeAuthBtn.isVisible()) {
      await closeAuthBtn.click();
    }

    // Chờ bản nhạc SVG xuất hiện
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 20000 });

    // 3. Kiểm tra các module tồn tại trên window
    const windowModules = await page.evaluate(() => ({
      hasChordCanvas: typeof window.ChordCanvas !== 'undefined',
      hasHistoryManager: typeof window.HistoryManager !== 'undefined',
      hasPageNav: typeof window.PageNav !== 'undefined',
      hasAdminUI: typeof window.AdminUI !== 'undefined'
    }));

    expect(windowModules.hasChordCanvas, 'window.ChordCanvas phải tồn tại').toBe(true);
    expect(windowModules.hasHistoryManager, 'window.HistoryManager phải tồn tại').toBe(true);
    expect(windowModules.hasPageNav, 'window.PageNav phải tồn tại').toBe(true);
    expect(windowModules.hasAdminUI, 'window.AdminUI phải tồn tại').toBe(true);

    // 4. Kiểm tra chip hợp âm hiển thị trung thực số hợp âm của bộ HD (thanh-ca-001 có 5 hợp âm)
    const chordSetCount = page.locator('#chord-set-count');
    await expect(chordSetCount).toHaveText(/● 5 hợp âm/, { timeout: 10000 });

    // 5. Kiểm tra phím C kích hoạt chế độ Sửa Hợp Âm
    await page.keyboard.press('c');
    await expect(page.locator('body')).toHaveClass(/chord-edit-mode/, { timeout: 5000 });
    // Thoát chế độ sửa bằng Escape
    await page.keyboard.press('Escape');
    await expect(page.locator('body')).not.toHaveClass(/chord-edit-mode/, { timeout: 5000 });

    // 6. Kiểm tra Yêu Thích ⭐: Bấm sao trên bài thanh-ca-001
    const favBtn = page.locator('#song-list .song-item[data-id="thanh-ca-001"] .song-fav-btn').first();
    await expect(favBtn).toBeVisible({ timeout: 10000 });
    await favBtn.click();
    await expect(favBtn).toHaveClass(/fav-active/);

    // Reload lại trang và kiểm tra tab Yêu Thích
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 20000 });

    // Đảm bảo sidebar mở sau khi reload
    await page.evaluate(() => {
      const sb = document.getElementById('sidebar');
      if (sb) {
        sb.classList.remove('collapsed', 'mobile-hidden');
      }
    });

    // Click tab Yêu Thích trong sidebar
    const favTab = page.locator('#sidebar-tab-favs');
    await expect(favTab).toBeVisible({ timeout: 5000 });
    await favTab.click();

    // Bài thanh-ca-001 phải xuất hiện trong danh sách yêu thích
    const favItem = page.locator('#song-list .song-item[data-id="thanh-ca-001"]');
    await expect(favItem).toBeVisible({ timeout: 10000 });

    // 7. Quay lại tab Kho Nhạc và kiểm tra mục "Gần đây"
    const libTab = page.locator('#sidebar-tab-lib');
    await expect(libTab).toBeVisible({ timeout: 5000 });
    await libTab.click();

    const recentSection = page.locator('#recently-viewed-section');
    await expect(recentSection).toBeVisible({ timeout: 5000 });
    const recentItem = recentSection.locator('.recent-item[data-id="thanh-ca-001"]');
    await expect(recentItem).toBeVisible({ timeout: 5000 });
  });
});
