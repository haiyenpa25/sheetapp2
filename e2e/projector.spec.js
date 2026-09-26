// @ts-check
const { test, expect } = require('@playwright/test');
const { execSync } = require('child_process');

/**
 * E2E-04: projector.spec.js
 * 
 * Nghiệm thu Ticket T12:
 * 1. Host tạo phòng Live Band trong hostContext.
 * 2. Projector kết nối vào phòng trong projectorContext.
 * 3. Host phát bài hát (thanh-ca-001).
 * 4. Projector hiển thị đúng dòng lời đầu tiên của bài hát.
 * 5. Console projector sạch sẽ (0 lỗi).
 */

test.describe('E2E-04: Projector Máy Chiếu Đồng Bộ Ban Nhạc', () => {
  test('Host phát bài hát và Projector cùng phòng hiện đúng dòng lời đầu tiên', async ({ browser }) => {
    // 1. Khởi tạo 2 Browser Context độc lập
    const hostContext = await browser.newContext();
    const projectorContext = await browser.newContext();

    // Khởi tạo phiên đăng nhập Ca Trưởng cho Host Context
    const hostSessionId = execSync('C:\\xampp\\php\\php.exe tools/create_test_session.php').toString().trim();
    await hostContext.addCookies([{
      name: 'PHPSESSID',
      value: hostSessionId,
      domain: 'localhost',
      path: '/'
    }]);

    const hostPage = await hostContext.newPage();
    const projectorPage = await projectorContext.newPage();

    const roomCode = 'PRJ' + Math.floor(1000 + Math.random() * 9000);
    console.log(`Mã phòng kiểm thử Projector: ${roomCode}`);

    // Bắt lỗi console phía Projector
    const projectorErrors = [];
    projectorPage.on('pageerror', err => projectorErrors.push(`[Projector Error] ${err.message}`));
    projectorPage.on('console', msg => {
      if (msg.type() === 'error') {
        projectorErrors.push(`[Projector Console Error] ${msg.text()}`);
      }
    });

    // 2. Host mở trang /live-band/ và tạo phòng
    await hostPage.goto('./live-band/', { waitUntil: 'domcontentloaded' });
    await hostPage.waitForSelector('#nav-room-label', { timeout: 15000 });

    await hostPage.evaluate((code) => {
      // @ts-ignore
      return window.LiveBandApp?.createHostRoom?.(code);
    }, roomCode);

    await expect(hostPage.locator('#nav-room-label')).toContainText(`HOST: ${roomCode}`, { timeout: 10000 });

    // 3. Projector mở trang /live-band/projector.php?room=...
    await projectorPage.goto(`./live-band/projector.php?room=${roomCode}`, { waitUntil: 'domcontentloaded' });

    // Chờ Projector kết nối phòng thành công
    await expect(projectorPage.locator('#conn-text')).toContainText(`PHÒNG: ${roomCode}`, { timeout: 10000 });

    // 4. Host phát bài hát 'thanh-ca-001'
    console.log('Host phát bài thanh-ca-001...');
    await hostPage.evaluate((songId) => {
      // @ts-ignore
      return window.LiveBandApp?.hostSelectSong?.(songId);
    }, 'thanh-ca-001');

    // 5. Kiểm tra Projector hiển thị tiêu đề và đúng dòng lời đầu tiên
    const firstLineLocator = projectorPage.locator('.projector-line').first();
    await expect(firstLineLocator).toBeVisible({ timeout: 10000 });

    const firstLineText = await firstLineLocator.textContent();
    console.log('Projector hiển thị dòng lời đầu tiên:', firstLineText);
    expect(firstLineText?.toLowerCase()).toContain('cúi xin');

    // Kiểm tra tiêu đề bài hát trên projector
    const headingLocator = projectorPage.locator('#projector-header-title');
    await expect(headingLocator).toContainText('HỠI THÁNH VƯƠNG, KÍP NGỰ LAI');

    // 6. Kiểm tra console projector sạch sẽ (0 lỗi)
    console.log('Projector console errors count:', projectorErrors.length);
    expect(projectorErrors.length).toBe(0);

    // Dọn dẹp
    await hostPage.evaluate(() => {
      // @ts-ignore
      window.LiveBandApp?.leaveRoom?.();
    });

    await hostContext.close();
    await projectorContext.close();
  });
});
