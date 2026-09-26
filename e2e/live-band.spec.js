// @ts-check
const { test, expect } = require('@playwright/test');
const { execSync } = require('child_process');

/**
 * E2E-03: live-band.spec.js
 * 
 * Nghiệm thu Ticket T11:
 * 2 Browser Contexts:
 * 1. Host context: có phiên đăng nhập của Ca Trưởng, tạo phòng Live Band.
 * 2. Follower context: kết nối vào phòng vừa tạo.
 * 3. Host đổi bài 3 lần: follower cập nhật theo đúng bài hát trong thời gian <= 2.0 giây mỗi lần.
 */

test.describe('E2E-03: Live Band Đồng bộ Ban Nhạc Đa Thiết Bị', () => {
  test('Host tạo phòng, Follower tham gia, Host đổi bài 3 lần và Follower đồng bộ trong <= 2s', async ({ browser }) => {
    // 1. Tạo 2 Browser Context độc lập
    const hostContext = await browser.newContext();
    const followerContext = await browser.newContext();

    // Khởi tạo phiên đăng nhập Ca Trưởng cho Host Context
    const hostSessionId = execSync('C:\\xampp\\php\\php.exe tools/create_test_session.php').toString().trim();

    await hostContext.addCookies([{
      name: 'PHPSESSID',
      value: hostSessionId,
      domain: 'localhost',
      path: '/'
    }]);

    const hostPage = await hostContext.newPage();
    const followerPage = await followerContext.newPage();

    const roomCode = 'LB' + Math.floor(1000 + Math.random() * 9000);
    console.log(`Mã phòng kiểm thử Live Band: ${roomCode}`);

    // Bắt lỗi console không mong muốn
    const errors = [];
    followerPage.on('pageerror', err => errors.push(`[Follower Error] ${err.message}`));
    hostPage.on('pageerror', err => errors.push(`[Host Error] ${err.message}`));

    // 2. Host mở trang /live-band/
    await hostPage.goto('./live-band/', { waitUntil: 'domcontentloaded' });
    await hostPage.waitForSelector('#nav-room-label', { timeout: 15000 });

    // Host tạo phòng
    await hostPage.evaluate((code) => {
      // @ts-ignore
      return window.LiveBandApp?.createHostRoom?.(code);
    }, roomCode);

    // Chờ Host kết nối phòng thành công
    await expect(hostPage.locator('#nav-room-label')).toContainText(`HOST: ${roomCode}`, { timeout: 10000 });

    // 3. Follower mở trang /live-band/?room=... để tự động tham gia
    await followerPage.goto(`./live-band/?room=${roomCode}`, { waitUntil: 'domcontentloaded' });
    await followerPage.waitForSelector('#nav-room-label', { timeout: 15000 });

    // Chờ Follower kết nối phòng thành công
    await expect(followerPage.locator('#nav-room-label')).toContainText(`LIVE: ${roomCode}`, { timeout: 10000 });

    // 4. Lấy danh sách 3 bài hát để test đổi bài
    const testSongs = await hostPage.evaluate(async () => {
      // @ts-ignore
      const res = await window.ApiService?.songs?.list?.();
      // @ts-ignore
      const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
      return list.slice(0, 3).map(s => ({ id: s.id, text: s.title || s.id }));
    });

    expect(testSongs.length).toBeGreaterThanOrEqual(3);
    console.log('3 bài hát được chọn để test đổi bài:', testSongs.map(s => s.id));

    // 5. Host đổi bài 3 lần, kiểm tra Follower cập nhật trong <= 2000ms
    let previousTitle = 'Đang chờ Ca Trưởng chọn bài...';

    for (let i = 0; i < testSongs.length; i++) {
      const song = testSongs[i];
      console.log(`[Lần ${i + 1}/3] Host chuyển sang bài: ${song.id} - ${song.text}`);

      const t0 = Date.now();

      // Host chuyển bài
      await hostPage.evaluate((sId) => {
        // @ts-ignore
        return window.LiveBandApp?.hostSelectSong?.(sId);
      }, song.id);

      // Follower phải cập nhật tiêu đề bài hát mới trong <= 2.0s
      const followerTitleLocator = followerPage.locator('#nav-song-title');
      await expect(followerTitleLocator).not.toHaveText(previousTitle, { timeout: 2000 });

      const elapsedMs = Date.now() - t0;
      console.log(`  → Follower nhận và đổi bài thành công trong ${elapsedMs}ms (<= 2000ms)`);
      expect(elapsedMs).toBeLessThanOrEqual(2000);

      // Cập nhật previousTitle cho lần sau
      previousTitle = (await followerTitleLocator.textContent()) || '';
    }

    // 6. Rời phòng và dọn dẹp
    await hostPage.evaluate(() => {
      // @ts-ignore
      window.LiveBandApp?.leaveRoom?.();
    });

    await hostContext.close();
    await followerContext.close();

    expect(errors.length).toBe(0);
  });
});
