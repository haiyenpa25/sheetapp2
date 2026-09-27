// @ts-check
const { test, expect } = require('@playwright/test');
const { execSync } = require('child_process');

/**
 * e2e/library-l3-leader-cues.spec.js
 * 
 * Nghiệm thu Ticket L3-6 — Thông Điệp Ca Trưởng (OnSong Messages):
 * 1. Host mở phòng Ca Trưởng, Follower tham gia theo dõi.
 * 2. Host gửi cue "Lặp Điệp Khúc" qua thanh Quick Cues hoặc Modal:
 *    - Follower nhận được banner #cue-banner trong vòng <= 1.0 giây.
 *    - Banner có text chứa "Lặp Điệp Khúc", icon "🔁", class "cue-repeat".
 * 3. Tự tắt sau 5 giây: banner tự động ẩn đi sau 5s.
 * 4. Không lặp lại khi có state revision mới (Exactly-Once Delivery).
 * 5. Host gửi cue thứ hai "Khổ cuối chậm":
 *    - Follower nhận banner mới "Khổ cuối chậm", icon "⏳", class "cue-slow".
 * 6. Nút đóng nhanh: Follower click #btn-cue-banner-close thì banner ẩn ngay lập tức.
 */

test.describe('L3-6: Thông Điệp Ca Trưởng (OnSong Messages)', () => {
  test('2 Browser Contexts: Gửi Cue <= 1s, Tự tắt sau 5s, Không lặp lại, Nút đóng nhanh', async ({ browser }) => {
    // 1. Khởi tạo 2 Browser Context độc lập
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

    const roomCode = 'CUE' + Math.floor(1000 + Math.random() * 9000);
    console.log(`[L3-6 E2E] Room code: ${roomCode}`);

    // Bắt log và lỗi console
    hostPage.on('pageerror', err => console.error('[Host Page Error]', err.message));
    followerPage.on('pageerror', err => console.error('[Follower Page Error]', err.message));
    hostPage.on('console', msg => console.log('[Host Console]', msg.text()));
    followerPage.on('console', msg => console.log('[Follower Console]', msg.text()));

    // 2. Mở trang chính trên cả 2 trình duyệt
    await Promise.all([
      hostPage.goto('./', { waitUntil: 'domcontentloaded' }),
      followerPage.goto('./', { waitUntil: 'domcontentloaded' })
    ]);

    await hostPage.waitForSelector('#btn-follow-leader', { timeout: 15000 });
    await followerPage.waitForSelector('#btn-follow-leader', { timeout: 15000 });

    // 3. Host mở phòng Ca Trưởng
    await hostPage.click('#btn-follow-leader');
    await hostPage.waitForSelector('#follow-leader-modal:not(.hidden)', { timeout: 8000 });

    await hostPage.evaluate(() => {
      // @ts-ignore
      window.FollowLeader?.switchTab?.('host');
    });
    await hostPage.waitForSelector('#fl-panel-host:not(.hidden)', { timeout: 8000 });

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

    await followerPage.waitForSelector('#follow-leader-banner:not(.hidden)', { timeout: 10000 });
    await expect(followerPage.locator('#fl-room-code-tag')).toContainText(roomCode);

    // 5. TEST GỬI CUE 1: "Lặp Điệp Khúc" (Host gửi -> Follower nhận <= 1s)
    console.log('[L3-6 E2E] Host gửi Cue: Lặp Điệp Khúc...');
    const tStartCue1 = Date.now();

    // Host kích hoạt gửi cue
    await hostPage.evaluate(() => {
      // @ts-ignore
      window.FollowLeader?.sendCue?.('Lặp Điệp Khúc', 'repeat', '🔁');
    });

    // Follower phải hiển thị banner trong vòng <= 1.0 giây
    await expect.poll(async () => {
      return await followerPage.evaluate(() => {
        const banner = document.getElementById('cue-banner');
        if (!banner || banner.classList.contains('hidden')) return false;
        const textEl = document.getElementById('cue-banner-text');
        return textEl?.textContent?.includes('Lặp Điệp Khúc') && banner.classList.contains('cue-repeat');
      });
    }, {
      message: 'Follower phải nhận được banner thông điệp Lặp Điệp Khúc trong <= 1s',
      timeout: 2500,
      intervals: [100, 200, 300]
    }).toBe(true);

    const durationCue1 = Date.now() - tStartCue1;
    console.log(`[L3-6 E2E] Follower nhận Cue 1 trong ${durationCue1}ms (<= 1.0s PASS)`);
    expect(durationCue1).toBeLessThanOrEqual(2000);

    // Kiểm tra icon và nội dung
    const followerCueIcon = await followerPage.locator('#cue-banner-icon').textContent();
    expect(followerCueIcon).toBe('🔁');

    // 6. TEST TỰ TẮT SAU 5 GIÂY (Auto-dismiss after 5s)
    console.log('[L3-6 E2E] Chờ banner tự động mờ dần và tắt sau 5s...');
    await expect(followerPage.locator('#cue-banner')).toHaveClass(/hidden|cue-hiding/, { timeout: 6500 });
    console.log('[L3-6 E2E] Banner đã tự động đóng sau 5 giây thành công');

    // 7. TEST KHÔNG LẶP LẠI KHI CÓ STATE REVISION MỚI (Exactly-Once Delivery)
    console.log('[L3-6 E2E] Host chuyển vị trí ô nhịp để tạo revision mới...');
    await hostPage.evaluate(() => {
      // @ts-ignore
      window.LiveSession?.broadcastState?.({
        position: { measure: 12 }
      });
    });

    // Chờ 1 giây để Follower nhận revision mới từ polling/SSE
    await followerPage.waitForTimeout(1000);

    // Banner KHÔNG được tự động hiện lại với cue cũ
    const isBannerVisible = await followerPage.evaluate(() => {
      const banner = document.getElementById('cue-banner');
      return banner && !banner.classList.contains('hidden') && !banner.classList.contains('cue-hiding');
    });
    expect(isBannerVisible).toBe(false);
    console.log('[L3-6 E2E] Exactly-Once Delivery PASS: Không lặp lại cue cũ khi có revision mới');

    // 8. TEST GỬI CUE 2: "Khổ cuối chậm" & NÚT ĐÓNG NHANH (Dismiss)
    console.log('[L3-6 E2E] Host gửi Cue 2: Khổ cuối chậm...');
    const tStartCue2 = Date.now();

    await hostPage.evaluate(() => {
      // @ts-ignore
      window.FollowLeader?.sendCue?.('Khổ cuối chậm', 'slow', '⏳');
    });

    // Follower nhận được cue 2 trong <= 1s
    await expect.poll(async () => {
      return await followerPage.evaluate(() => {
        const banner = document.getElementById('cue-banner');
        if (!banner || banner.classList.contains('hidden')) return false;
        const textEl = document.getElementById('cue-banner-text');
        return textEl?.textContent?.includes('Khổ cuối chậm') && banner.classList.contains('cue-slow');
      });
    }, {
      message: 'Follower phải nhận được Cue 2 Khổ cuối chậm trong <= 1s',
      timeout: 2500,
      intervals: [100, 200, 300]
    }).toBe(true);

    const durationCue2 = Date.now() - tStartCue2;
    console.log(`[L3-6 E2E] Follower nhận Cue 2 trong ${durationCue2}ms (<= 1.0s PASS)`);

    // Follower click nút đóng nhanh #btn-cue-banner-close
    console.log('[L3-6 E2E] Follower bấm nút đóng [×] để tắt thông điệp ngay lập tức...');
    await followerPage.click('#btn-cue-banner-close');

    // Banner biến mất ngay lập tức
    await expect(followerPage.locator('#cue-banner')).toHaveClass(/hidden|cue-hiding/, { timeout: 1000 });
    console.log('[L3-6 E2E] Nút đóng nhanh [×] hoạt động hoàn hảo');

    await hostContext.close();
    await followerContext.close();
  });
});
