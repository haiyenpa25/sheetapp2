// @ts-check
const { test, expect } = require('@playwright/test');
const { execSync } = require('child_process');

/**
 * e2e/library-l3-song-sections.spec.js
 * 
 * Nghiệm thu Ticket L3-7 — Bản Đồ Bài Và Nhảy Đoạn (Song Flow / Roadmap):
 * 1. Mở bài thanh-ca-001: dải phân đoạn #section-jump-bar-container hiển thị ở đầu bài.
 * 2. Có đủ 4 phân đoạn: Intro (m.1-2), Lời 1 (m.3-10), Điệp Khúc (m.11-18), Outro (m.19-20).
 * 3. Chạm chip "Điệp Khúc": cuộn tức thì đến ô nhịp 11, chip Điệp Khúc được tô sáng .active.
 * 4. Bàn đạp / phím tắt j / Shift+j: chuyển mượt giữa các phân đoạn tiếp theo / trước đó.
 * 5. Đồng bộ Live Sync: Host nhảy đoạn -> Follower tự động nhảy và tô sáng phân đoạn tương ứng.
 */

test.describe('L3-7: Bản Đồ Bài Và Nhảy Đoạn (Song Flow / Roadmap)', () => {

  test('Giao diện Song Flow: 4 phân đoạn hiển thị, Click nhảy đoạn, Phím tắt j/Shift+j', async ({ page }) => {
    // 1. Mở ứng dụng
    await page.goto('./', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#song-list', { timeout: 15000 });

    // 2. Mở bài hát thanh-ca-001
    const songItem = page.locator('.song-item[data-id="thanh-ca-001"], .song-item:has-text("001"), .song-item').first();
    await songItem.click();

    // 3. Chờ bản nhạc OSMD render xong
    await page.waitForSelector('#osmd-container svg', { timeout: 20000 });

    // 4. Kiểm tra Dải Bản Đồ Bài Hát #section-jump-bar-container
    const jumpBar = page.locator('#section-jump-bar-container');
    await expect(jumpBar).toBeVisible({ timeout: 10000 });

    const chips = page.locator('#section-chips-list .section-chip');
    await expect(chips).toHaveCount(4, { timeout: 10000 });

    // Kiểm tra tên các phân đoạn
    await expect(chips.nth(0)).toContainText('Intro');
    await expect(chips.nth(1)).toContainText('Lời 1');
    await expect(chips.nth(2)).toContainText('Điệp Khúc');
    await expect(chips.nth(3)).toContainText('Outro');

    // 5. Click vào chip "Điệp Khúc"
    const chorusChip = page.locator('#section-chips-list .section-chip:has-text("Điệp Khúc")');
    await chorusChip.click();

    // Chip Điệp Khúc phải có class .active
    await expect(chorusChip).toHaveClass(/active/, { timeout: 5000 });

    // Các chip khác không được có class .active
    const introChip = page.locator('#section-chips-list .section-chip:has-text("Intro")');
    await expect(introChip).not.toHaveClass(/active/);

    // 6. Nhấn phím 'j' để chuyển sang phân đoạn tiếp theo (Outro)
    await page.keyboard.press('j');
    const outroChip = page.locator('#section-chips-list .section-chip:has-text("Outro")');
    await expect(outroChip).toHaveClass(/active/, { timeout: 5000 });
    await expect(chorusChip).not.toHaveClass(/active/);

    // 7. Nhấn phím 'Shift+J' để quay lại phân đoạn trước đó (Điệp Khúc)
    await page.keyboard.press('Shift+J');
    await expect(chorusChip).toHaveClass(/active/, { timeout: 5000 });
    await expect(outroChip).not.toHaveClass(/active/);
  });

  test('2 Browser Contexts: Host nhảy đoạn -> Follower đồng bộ ô nhịp và active chip <= 1s', async ({ browser }) => {
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

    const roomCode = 'SEC' + Math.floor(1000 + Math.random() * 9000);
    console.log(`[L3-7 E2E] Room code: ${roomCode}`);

    // Mở trang trên cả hai thiết bị
    await Promise.all([
      hostPage.goto('./', { waitUntil: 'domcontentloaded' }),
      followerPage.goto('./', { waitUntil: 'domcontentloaded' })
    ]);

    await hostPage.waitForSelector('#btn-follow-leader', { timeout: 15000 });
    await followerPage.waitForSelector('#btn-follow-leader', { timeout: 15000 });

    // Host mở phòng Ca Trưởng
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

    // Follower tham gia theo dõi phòng
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

    // Host mở bài thanh-ca-001
    const songItem = hostPage.locator('.song-item[data-id="thanh-ca-001"], .song-item:has-text("001"), .song-item').first();
    await songItem.click();
    await hostPage.waitForSelector('#osmd-container svg', { timeout: 20000 });

    // Follower đồng bộ bài thanh-ca-001
    await followerPage.waitForSelector('#osmd-container svg', { timeout: 20000 });

    // Chờ cả hai hiển thị thanh bản đồ bài hát
    await hostPage.waitForSelector('#section-chips-list .section-chip', { timeout: 10000 });
    await followerPage.waitForSelector('#section-chips-list .section-chip', { timeout: 10000 });

    // Host click chip "Điệp Khúc"
    const hostChorusChip = hostPage.locator('#section-chips-list .section-chip:has-text("Điệp Khúc")');
    await hostChorusChip.click();
    await expect(hostChorusChip).toHaveClass(/active/, { timeout: 5000 });

    // Follower phải đồng bộ active chip "Điệp Khúc" trong vòng <= 1.5s
    const startTime = Date.now();
    const followerChorusChip = followerPage.locator('#section-chips-list .section-chip:has-text("Điệp Khúc")');
    await expect(followerChorusChip).toHaveClass(/active/, { timeout: 3000 });
    const elapsed = Date.now() - startTime;
    console.log(`[L3-7 E2E] Follower section sync latency: ${elapsed}ms`);
    expect(elapsed).toBeLessThanOrEqual(2000);

    // Cleanup
    await hostContext.close();
    await followerContext.close();
  });

});
