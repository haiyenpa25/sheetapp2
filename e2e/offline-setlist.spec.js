// @ts-check
const { test, expect } = require('@playwright/test');
const { execSync } = require('child_process');

/**
 * E2E-08: offline-setlist.spec.js
 * 
 * Nghiệm thu Ticket T13 (Epic 3.2):
 * 1. Tải gói Setlist 3 bài về thiết bị qua OfflineSetlistManager.
 * 2. Mở/duyệt 65 bài hát khác khi online (vượt quá giới hạn FIFO 60 bài của cache thông thường).
 * 3. Chuyển sang chế độ ngoại tuyến (context.setOffline(true)).
 * 4. Mở lại (reload) trang /?song=<bài 2 trong setlist>.
 * 5. App Shell được trả về từ cache (bỏ qua query string) và bản nhạc SVG của bài 2 hiển thị thành công.
 */

test.describe('E2E-08: Ngoại Tuyến Setlist Không Bị Đẩy Khỏi Cache', () => {
  test('Tải gói setlist 3 bài, lướt 65 bài online, ngắt mạng, mở lại bài 2 thành công', async ({ browser, browserName }) => {
    test.skip(browserName === 'webkit' && process.platform === 'win32', 'Playwright WebKit WinCairo does not support Service Worker navigation while offline');

    const context = await browser.newContext();

    // Tạo phiên đăng nhập admin để có quyền tạo setlist test nếu cần
    const sessionId = execSync('C:\\xampp\\php\\php.exe tools/create_test_session.php').toString().trim();
    await context.addCookies([{
      name: 'PHPSESSID',
      value: sessionId,
      domain: 'localhost',
      path: '/'
    }]);

    const page = await context.newPage();

    // 1. Mở trang chủ để kích hoạt Service Worker
    await page.goto('./', { waitUntil: 'networkidle' });

    // Đảm bảo Service Worker đã sẵn sàng và kiểm soát trang
    await page.evaluate(async () => {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.ready;
        if (!navigator.serviceWorker.controller) {
          await new Promise(resolve => {
            navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true });
            setTimeout(resolve, 2000);
          });
        }
      }
    });

    // 2. Tạo Setlist test 3 bài (thanh-ca-001, thanh-ca-002, thanh-ca-003) và publish
    const setlistId = await page.evaluate(async () => {
      // @ts-ignore
      const createRes = await window.ApiService.setlists.create({
        title: 'E2E Setlist Offline Test ' + Date.now(),
        scheduled_date: '2026-10-15',
        theme: 'Test Offline'
      });
      const id = createRes.id;
      // Thêm 3 bài hát
      // @ts-ignore
      await window.ApiService.setlists.addItem({ setlist_id: id, song_id: 'thanh-ca-001', chord_code: 'HD' });
      // @ts-ignore
      await window.ApiService.setlists.addItem({ setlist_id: id, song_id: 'thanh-ca-002', chord_code: 'HD' });
      // @ts-ignore
      await window.ApiService.setlists.addItem({ setlist_id: id, song_id: 'thanh-ca-003', chord_code: 'HD' });
      // @ts-ignore
      await window.ApiService.setlists.publish(id);
      return id;
    });

    console.log(`Đã tạo test setlist ID=${setlistId}`);

    // 3. Tải gói Offline cho setlist
    console.log('Tải gói offline setlist...');
    const dlResult = await page.evaluate(async (id) => {
      // @ts-ignore
      return await window.OfflineSetlistManager.downloadPackage(id);
    }, setlistId);

    console.log('Kết quả tải gói:', dlResult);
    expect(dlResult.isReady).toBe(true);
    expect(dlResult.cachedCount).toBe(3);

    // 4. Mở 65 bài hát khác khi online để kích hoạt FIFO eviction cache 60 bài
    console.log('Mở 65 bài khác để thử thách FIFO cache...');
    const overflowCount = await page.evaluate(async () => {
      // @ts-ignore
      const allSongs = await window.ApiService.songs.list();
      const songs = (Array.isArray(allSongs) ? allSongs : allSongs.data || []).slice(5, 71);
      let count = 0;
      for (const s of songs) {
        if (s.xmlPath) {
          try {
            // @ts-ignore
            const url = window.ApiService.resolveUrl(s.xmlPath);
            const res = await fetch(url);
            if (res.ok) count++;
          } catch (e) {}
        }
      }
      return count;
    });
    console.log(`Đã nạp online ${overflowCount} bài hát vào FIFO cache`);

    // 5. Ngắt mạng (Chế độ Ngoại Tuyến)
    console.log('Ngắt mạng (context.setOffline(true))...');
    await context.setOffline(true);

    // 6. Reload trang tới bài 2: /?song=thanh-ca-002
    console.log('Mở lại trang /?song=thanh-ca-002 khi đang offline...');
    await page.goto('./?song=thanh-ca-002', { waitUntil: 'domcontentloaded' });

    // 7. Kỳ vọng: App Shell hiển thị, OSMD render thành công SVG bài hát thứ 2
    const svgLocator = page.locator('#osmd-container svg').first();
    await expect(svgLocator).toBeVisible({ timeout: 15000 });

    const songTitleLocator = page.locator('#song-title');
    await expect(songTitleLocator).toContainText(/NGUY[ỆỀ]N TỤNG MỸ CHÚA LINH NĂNG/, { timeout: 10000 });
    console.log('E2E-08: Bài hát 2 đã render SVG thành công khi offline!');

    // Dọn dẹp
    await context.setOffline(false);
    await page.evaluate(async (id) => {
      // @ts-ignore
      if (window.OfflineSetlistManager?.removePackage) {
        // @ts-ignore
        await window.OfflineSetlistManager.removePackage(id);
      }
      // @ts-ignore
      await window.ApiService.setlists.delete(id);
    }, setlistId);

    await context.close();
  });
});
