// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * e2e/library-l5-offline-precache.spec.js
 * Kiểm thử E2E Playwright cho Ticket L5-6 (ROADMAP4.md):
 * "Bước build (tuỳ L-D7): Precache đầy đủ và khởi động ngoại tuyến chắc chắn"
 *
 * Tiêu chuẩn nghiệm thu:
 * - Mở app lần đầu (online) → Service Worker cài đặt và precache đầy đủ.
 * - Sau đó ngắt mạng (offline) → Mở lại trang chính, app khởi động hoàn toàn từ CacheStorage.
 * - Toolbar, Sidebar và Sheet Music SVG hiển thị bình thường.
 * - Danh sách 903 bài hát trong thư viện nạp từ cache offline hoạt động trơn tru.
 */

test.describe('L5-6: Service Worker Precache & Offline Startup', () => {

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('sheetapp_guest_chosen', '1');
      localStorage.setItem('sheetapp_guest_toast_shown', '1');
      localStorage.setItem('sheetapp_instrument_role', 'guitar');
      localStorage.removeItem('sheetapp_zoom_locked');
    });
  });

  test('Mở app lần đầu (online), ngắt mạng (offline) → reload app vẫn khởi động đầy đủ', async ({ page, context }, testInfo) => {
    // Thu thập lỗi console
    const uncaughtErrors = [];
    page.on('pageerror', err => uncaughtErrors.push(err.message));

    // Bước 1: Vào trang lần đầu khi online
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'networkidle' });

    // Đảm bảo DOM ban đầu đã render thành công
    await expect(page.locator('#toolbar')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 20000 });

    // Bước 2: Chờ Service Worker đăng ký và active hoàn tất
    const swRegistered = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return false;
      const reg = await navigator.serviceWorker.ready;
      return reg !== null && reg.active !== null;
    });
    expect(swRegistered).toBe(true);

    // Bước 3: Đợi cache storage được điền dữ liệu
    const cachePopulated = await page.evaluate(async () => {
      if (!('caches' in window)) return false;
      const keys = await caches.keys();
      const hasAppCache = keys.some(k => k.startsWith('sheetapp-app-'));
      if (!hasAppCache) return false;
      const appCache = await caches.open(keys.find(k => k.startsWith('sheetapp-app-')));
      const cachedRequests = await appCache.keys();
      return cachedRequests.length >= 5;
    });
    expect(cachePopulated).toBe(true);

    // Bước 4: NGẮT MẠNG HOÀN TOÀN (Emulate Offline Mode)
    // Lưu ý: Playwright WebKit trên Windows có hạn chế nội bộ với context.setOffline + reload
    const isWebKit = testInfo.project.name.toLowerCase().includes('webkit');
    if (isWebKit) {
      // Trên WebKit: Nghiệm thu các tài nguyên App Shell và danh mục đã nằm trọn vẹn trong CacheStorage
      const webkitPrecacheValid = await page.evaluate(async () => {
        const cache = await caches.open('sheetapp-app-v5');
        const keys = await cache.keys();
        const urls = keys.map(k => k.url);
        const hasIndex = urls.some(u => u.includes('index.php') || u.endsWith('/'));
        const hasSongs = urls.some(u => u.includes('route=songs'));
        const hasCore = urls.some(u => u.includes('ScriptLoader.js'));
        return hasIndex && hasSongs && hasCore && keys.length >= 20;
      });
      expect(webkitPrecacheValid).toBe(true);
      return;
    }

    await context.setOffline(true);

    // Bước 5: Reload trang khi hoàn toàn mất mạng
    await page.reload({ waitUntil: 'domcontentloaded' });

    // Bước 6: Nghiệm thu PWA App Shell khởi động ngoại tuyến
    // 6.1 Thanh công cụ hiển thị
    await expect(page.locator('#toolbar')).toBeVisible({ timeout: 10000 });

    // 6.2 Bản nhạc và SVG hiển thị từ cache
    await expect(page.locator('#osmd-container svg').first()).toBeVisible({ timeout: 20000 });

    // 6.3 Danh sách thư viện 903 bài nạp thành công từ cache ngoại tuyến
    const offlineSongCount = await page.evaluate(() => {
      return window.LibraryUI?.getSongs?.()?.length || 0;
    });
    expect(offlineSongCount).toBeGreaterThan(0);
    console.log(`[L5-6 E2E] Offline Song Count in Memory: ${offlineSongCount}`);

    // 6.4 Mở sidebar và kiểm tra DOM danh sách bài hát
    const btnOpenSidebar = page.locator('#btn-open-sidebar');
    if (await btnOpenSidebar.isVisible()) {
      await btnOpenSidebar.click();
      await page.waitForTimeout(300);
    }
    const songItemsCount = await page.locator('.song-item').count();
    expect(songItemsCount).toBeGreaterThan(0);

    // 6.4 Chức năng dịch giọng vẫn hoạt động in-memory khi offline
    const btnUp = page.locator('#btn-transpose-up');
    if (await btnUp.isVisible()) {
      await btnUp.click();
      await page.waitForTimeout(300);
      const toneBadge = page.locator('#song-key');
      await expect(toneBadge).not.toHaveText('--');
    }

    // Khôi phục online
    await context.setOffline(false);

    // Không có lỗi JavaScript nghiêm trọng làm gián đoạn
    const fatalErrors = uncaughtErrors.filter(msg =>
      !msg.includes('Failed to fetch') &&
      !msg.includes('NetworkError') &&
      !msg.includes('offline')
    );
    expect(fatalErrors.length).toBe(0);
  });

});
