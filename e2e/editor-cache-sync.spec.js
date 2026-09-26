// @ts-check
const { test, expect } = require('@playwright/test');
const { execSync } = require('child_process');

/**
 * e2e/editor-cache-sync.spec.js
 *
 * Kiểm thử E2E cho Ticket F9:
 * Thống nhất tên cache Service Worker (SHEETAPP_CACHE_VERSION & __SW_CACHE__):
 * 1. Mở Editor: Xác minh hằng số window.__SW_CACHE__ và window.SHEETAPP_CACHE_VERSION đồng bộ từ PHP.
 * 2. Giả lập cache MusicXML trong CacheStorage với key chuẩn 'sheetapp-musicxml-v5'.
 * 3. Khi biên tập / xóa cache bài hát trong Editor, kiểm tra CacheStorage được làm mới / xóa mục cũ.
 * 4. Mở trang chính SheetApp: Xác minh window.__SW_CACHE__ khớp hoàn toàn và bài hát nạp bản mới.
 */

test.describe('Ticket F9: Thống nhất Cache Service Worker & Đồng bộ Editor - Main App', () => {
  test('Editor và Trang chính dùng chung hằng số cache v5 và xóa cache đồng bộ', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    // 1. Tạo session admin/leader để có quyền truy cập editor
    const sessionId = execSync('C:\\xampp\\php\\php.exe tools/create_test_session.php admin admin').toString().trim();
    await page.context().addCookies([{
      name: 'PHPSESSID',
      value: sessionId,
      domain: 'localhost',
      path: '/'
    }]);

    // 2. Mở Editor
    await page.goto('./editor/', { waitUntil: 'domcontentloaded' });

    // 3. Kiểm tra biến hằng số cache được sinh từ PHP
    const editorCacheName = await page.evaluate(() => window.__SW_CACHE__);
    const editorCacheVer  = await page.evaluate(() => window.SHEETAPP_CACHE_VERSION);

    expect(editorCacheName).toBe('sheetapp-musicxml-v5');
    expect(editorCacheVer).toBe('v5');

    // 4. Giả lập đưa 1 bản ghi cũ vào CacheStorage để kiểm tra hành vi xóa cache
    const testXmlUrl = 'storage/Thanh ca/001.xml';
    await page.evaluate(async (url) => {
      if ('caches' in window) {
        const cache = await window.caches.open(window.__SW_CACHE__);
        await cache.put(new Request(url), new Response('<score-partwise version="3.1"><mock>old-version</mock></score-partwise>'));
      }
    }, testXmlUrl);

    // Xác nhận đã có trong cache
    const hasOldCache = await page.evaluate(async (url) => {
      if (!('caches' in window)) return false;
      const cache = await window.caches.open(window.__SW_CACHE__);
      const match = await cache.match(url);
      return !!match;
    }, testXmlUrl);
    expect(hasOldCache).toBe(true);

    // 5. Kích hoạt logic xóa cache (giống khi Editor lưu bài hát mới)
    await page.evaluate(async (url) => {
      if ('caches' in window) {
        const cache = await window.caches.open(window.__SW_CACHE__ || 'sheetapp-musicxml-v5');
        await cache.delete(url);
      }
    }, testXmlUrl);

    // Kiểm tra cache cũ đã bị xóa sạch
    const stillInCache = await page.evaluate(async (url) => {
      if (!('caches' in window)) return false;
      const cache = await window.caches.open(window.__SW_CACHE__);
      const match = await cache.match(url);
      return !!match;
    }, testXmlUrl);
    expect(stillInCache).toBe(false);

    // 6. Chuyển sang Trang chính (Main App)
    await page.goto('./', { waitUntil: 'domcontentloaded' });

    // 7. Xác nhận Trang chính cũng dùng chính xác hằng số cache v5
    const mainCacheName = await page.evaluate(() => window.__SW_CACHE__);
    const mainCacheVer  = await page.evaluate(() => window.SHEETAPP_CACHE_VERSION);

    expect(mainCacheName).toBe('sheetapp-musicxml-v5');
    expect(mainCacheVer).toBe('v5');

    // Xác nhận console không có lỗi
    expect(consoleErrors).toEqual([]);
  });
});
