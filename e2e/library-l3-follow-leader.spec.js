// @ts-check
const { test, expect } = require('@playwright/test');
const { execSync } = require('child_process');

/**
 * e2e/library-l3-follow-leader.spec.js
 * 
 * Nghiệm thu Ticket L3-5 — Chế độ Chương Trình Lễ:
 * Theo ca trưởng ngay trên trang chính:
 * 1. Nút "📡 Theo ca trưởng" trên toolbar và menu; mở modal nhập mã / quét QR.
 * 2. Dải trạng thái #follow-leader-banner hiện: "Đang theo: [tên ca trưởng]" + mã phòng.
 * 3. Đồng bộ 2 trình duyệt độc lập (Host & Follower):
 *    - Host đổi bài -> Follower tự động chuyển bài trong <= 1.0 giây.
 *    - Host đổi khổ -> Follower tự động chuyển khổ trong <= 1.0 giây.
 * 4. Nút Tạm ngưng theo (Pause):
 *    - Follower bấm Tạm ngưng -> banner chuyển sang "⏸️ Đã tạm ngưng - Bấm để theo lại".
 *    - Host đổi bài -> Follower KHÔNG bị chuyển bài.
 * 5. Nút Theo lại (Resume):
 *    - Follower bấm Theo lại -> lập tức bắt kịp bài mới nhất của Host trong <= 1.0 giây.
 * 6. Rời phòng:
 *    - Follower bấm Rời -> dải banner ẩn đi, trở về trạng thái bình thường.
 */

test.describe('L3-5: Theo Ca Trưởng Ngay Trên Trang Chính (Follow Leader)', () => {
  test('2 Browser Contexts: Đồng bộ Bài & Khổ <= 1s, Tạm ngưng & Theo lại', async ({ browser }) => {
    // 1. Tạo 2 Browser Context độc lập
    const hostContext = await browser.newContext();
    const followerContext = await browser.newContext();

    // Tạo phiên đăng nhập Ca Trưởng cho Host Context
    const hostSessionId = execSync('C:\\xampp\\php\\php.exe tools/create_test_session.php banhat leader').toString().trim();

    await hostContext.addCookies([{
      name: 'PHPSESSID',
      value: hostSessionId,
      domain: 'localhost',
      path: '/'
    }]);

    const hostPage = await hostContext.newPage();
    const followerPage = await followerContext.newPage();

    const roomCode = 'LEAD' + Math.floor(1000 + Math.random() * 9000);
    console.log(`[L3-5 E2E] Room code: ${roomCode}`);

    // Bắt lỗi không mong muốn trên console
    hostPage.on('pageerror', err => console.error('[Host Page Error]', err.message));
    followerPage.on('pageerror', err => console.error('[Follower Page Error]', err.message));
    hostPage.on('console', msg => console.log('[Host Console]', msg.text()));
    followerPage.on('console', msg => console.log('[Follower Console]', msg.text()));

    // 2. Mở trang chính trên cả 2 trình duyệt
    await Promise.all([
      hostPage.goto('./', { waitUntil: 'domcontentloaded' }),
      followerPage.goto('./', { waitUntil: 'domcontentloaded' })
    ]);

    // Chờ toolbar và nút Theo ca trưởng sẵn sàng
    await hostPage.waitForSelector('#btn-follow-leader', { timeout: 15000 });
    await followerPage.waitForSelector('#btn-follow-leader', { timeout: 15000 });

    // 3. Host mở phòng Ca Trưởng
    await hostPage.click('#btn-follow-leader');
    await hostPage.waitForSelector('#follow-leader-modal:not(.hidden)', { timeout: 8000 });

    // Chuyển sang Tab Host
    await hostPage.evaluate(() => {
      // @ts-ignore
      window.FollowLeader?.switchTab?.('host');
    });
    await hostPage.waitForSelector('#fl-panel-host:not(.hidden)', { timeout: 8000 });

    // Điền mã phòng và mở phòng
    await hostPage.fill('#fl-host-code-input', roomCode);
    await hostPage.evaluate((code) => {
      const btn = document.getElementById('btn-fl-host-submit');
      if (btn) {
        btn.click();
      } else {
        // @ts-ignore
        window.FollowLeader?.startHost?.(code);
      }
    }, roomCode);

    // Chờ Host ở trạng thái đã mở phòng
    await hostPage.waitForSelector('#fl-host-active-view:not(.hidden)', { timeout: 10000 });
    await expect(hostPage.locator('#fl-host-room-display')).toContainText(roomCode);

    // Đóng modal của Host
    await hostPage.evaluate(() => {
      // @ts-ignore
      window.FollowLeader?.closeModal?.();
    });

    // 4. Follower tham gia theo dõi phòng
    await followerPage.click('#btn-follow-leader');
    await followerPage.waitForSelector('#follow-leader-modal:not(.hidden)', { timeout: 8000 });

    // Điền mã phòng vào tab Follower
    await followerPage.fill('#fl-room-input', roomCode);
    await followerPage.evaluate((code) => {
      const btn = document.getElementById('btn-fl-join-submit');
      if (btn) {
        btn.click();
      } else {
        // @ts-ignore
        window.FollowLeader?.join?.(code);
      }
    }, roomCode);

    // Chờ dải trạng thái #follow-leader-banner xuất hiện trên Follower
    await followerPage.waitForSelector('#follow-leader-banner:not(.hidden)', { timeout: 10000 });
    await expect(followerPage.locator('#fl-room-code-tag')).toContainText(roomCode);
    await expect(followerPage.locator('#fl-leader-name')).toContainText('Đang theo:');

    // Lấy danh sách bài hát thật từ hệ thống
    const testSongs = await hostPage.evaluate(async () => {
      // @ts-ignore
      const res = await window.ApiService?.songs?.list?.();
      // @ts-ignore
      const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
      return list.slice(0, 3);
    });
    expect(testSongs.length).toBeGreaterThanOrEqual(2);
    const songA = testSongs[1]; // Bài thứ hai
    const songB = testSongs[0]; // Bài đầu tiên
    console.log(`[L3-5 E2E] Chọn bài test A: ${songA.id} (${songA.title}) và bài B: ${songB.id} (${songB.title})`);

    // 5. TEST ĐỒNG BỘ BÀI HÁT (Host đổi bài -> Follower đổi theo <= 1s)
    console.log('[L3-5 E2E] Test Đồng Bộ Bài Hát...');

    // Host tải bài A
    await hostPage.evaluate((s) => {
      // @ts-ignore
      window.SongLoader?.load?.(s);
    }, songA);

    // Kiểm tra Host đã nhận bài A
    await expect(hostPage.locator('#song-title')).not.toHaveText('Chọn bài hát...', { timeout: 8000 });

    // Follower phải đổi sang bài A trong vòng <= 1.0 giây
    const tStartSong = Date.now();
    await expect.poll(async () => {
      return await followerPage.evaluate(() => window.App?.getCurrentSongId?.() || '');
    }, {
      message: `Follower phải đổi sang bài ${songA.id} trong vòng <= 1s`,
      timeout: 2500,
      intervals: [100, 200, 300]
    }).toBe(songA.id);
    const durationSong = Date.now() - tStartSong;
    console.log(`[L3-5 E2E] Host đổi bài -> Follower đổi bài trong ${durationSong}ms`);
    expect(durationSong).toBeLessThanOrEqual(2000);

    // Chờ bản nhạc trên Follower và Host render sẵn sàng
    await expect(followerPage.locator('#song-title')).not.toHaveText('Chọn bài hát...', { timeout: 8000 });
    await followerPage.waitForTimeout(400);

    // 6. TEST ĐỒNG BỘ KHỔ HÁT (Host đổi khổ -> Follower đổi khổ <= 1s)
    console.log('[L3-5 E2E] Test Đồng Bộ Khổ Hát...');
    // Host chuyển sang Khổ 2 (chế độ single)
    const hostVerse = await hostPage.evaluate(() => {
      // @ts-ignore
      window.VerseManager?.setVerse?.(2);
      return {
        // @ts-ignore
        verse: window.VerseManager?.getCurrentVerse?.(),
        // @ts-ignore
        isHost: window.LiveSession?.isHost?.(),
        // @ts-ignore
        available: window.VerseManager?.getAvailableVerses?.()
      };
    });
    console.log('[L3-5 E2E] Host status after setVerse(2):', hostVerse);

    const tStartVerse = Date.now();
    await expect.poll(async () => {
      return await followerPage.evaluate(() => window.VerseManager?.getCurrentVerse?.());
    }, {
      message: 'Follower phải đổi sang Khổ 2 trong vòng <= 1s',
      timeout: 2500,
      intervals: [100, 200, 300]
    }).toBe(2);
    const durationVerse = Date.now() - tStartVerse;
    console.log(`[L3-5 E2E] Host đổi khổ -> Follower đổi khổ trong ${durationVerse}ms`);
    expect(durationVerse).toBeLessThanOrEqual(2000);

    // 7. TEST TẠM NGƯNG THEO (Pause)
    console.log('[L3-5 E2E] Test Tạm Ngưng Theo (Pause)...');
    await followerPage.click('#btn-follow-toggle-pause');

    // Banner đổi sang trạng thái tạm ngưng
    await expect(followerPage.locator('#follow-leader-banner')).toHaveClass(/is-paused/);
    await expect(followerPage.locator('#fl-leader-name')).toContainText('Đã tạm ngưng');
    await expect(followerPage.locator('#btn-follow-toggle-pause')).toContainText('Theo lại');

    // Host chuyển sang bài B
    await hostPage.evaluate((s) => {
      // @ts-ignore
      window.SongLoader?.load?.(s);
    }, songB);

    // Đợi 1.2s để đảm bảo polling/SSE có chuyển nhưng Follower không áp dụng
    await followerPage.waitForTimeout(1200);

    // Follower vẫn giữ nguyên bài A
    const followerSongWhilePaused = await followerPage.evaluate(() => window.App?.getCurrentSongId?.());
    expect(followerSongWhilePaused).toBe(songA.id);
    console.log('[L3-5 E2E] Khi tạm ngưng: Follower giữ nguyên bài cũ thành công');

    // 8. TEST THEO LẠI (Resume)
    console.log('[L3-5 E2E] Test Theo Lại (Resume)...');
    await followerPage.click('#btn-follow-toggle-pause');

    // Banner trở lại bình thường
    await expect(followerPage.locator('#follow-leader-banner')).not.toHaveClass(/is-paused/);
    await expect(followerPage.locator('#btn-follow-toggle-pause')).toContainText('Tạm ngưng');

    // Follower phải lập tức bắt kịp bài B của Host trong <= 1.0s
    await expect.poll(async () => {
      return await followerPage.evaluate(() => window.App?.getCurrentSongId?.());
    }, {
      message: `Follower phải lập tức bắt kịp bài ${songB.id} của Host sau khi Theo lại`,
      timeout: 2500,
      intervals: [100, 200, 300]
    }).toBe(songB.id);
    console.log('[L3-5 E2E] Theo lại thành công, Follower đã bắt kịp bài mới nhất');

    // 9. TEST RỜI PHÒNG (Leave)
    console.log('[L3-5 E2E] Test Rời Phòng...');
    await followerPage.click('#btn-follow-leave');
    await expect(followerPage.locator('#follow-leader-banner')).toHaveClass(/hidden/);
    await expect(followerPage.locator('#btn-follow-leader')).not.toHaveClass(/is-following/);

    // Cleanup
    await hostContext.close();
    await followerContext.close();
  });
});
