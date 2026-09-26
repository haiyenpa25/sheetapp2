// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * E2E-01: main-page.spec.js
 * 
 * Nghiệm thu Ticket T04:
 * Mở trang chủ (/), chọn 1 bài hát, chờ SVG xuất hiện, console không có lỗi.
 */

test.describe('E2E-01: Kiểm tra trang chính và hiển thị bản nhạc OSMD', () => {
  test('Mở trang chủ, chọn bài hát, render SVG thành công và console sạch', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];

    // Khởi tạo trạng thái phiên khách để không bị popup che khuất thao tác
    await page.addInitScript(() => {
      sessionStorage.setItem('sheetapp_guest_chosen', '1');
    });

    // Lắng nghe và bắt mọi lỗi console và runtime error
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!text.includes('favicon.ico')) {
          consoleErrors.push(text);
          console.error(`[Browser console.error] ${text}`);
        }
      }
    });

    page.on('pageerror', err => {
      const msg = err.message || String(err);
      pageErrors.push(msg);
      console.error(`[Browser pageerror] ${msg}`);
    });

    // 1. Mở trang chủ SheetApp2
    await page.goto('./', { waitUntil: 'domcontentloaded' });

    // Đóng auth-modal nếu có hiển thị
    const closeAuthBtn = page.locator('#btn-close-auth');
    if (await closeAuthBtn.isVisible()) {
      await closeAuthBtn.click();
    }

    // 2. Chờ danh sách bài hát trong sidebar xuất hiện
    const firstSongItem = page.locator('#song-list .song-item').first();
    await expect(firstSongItem).toBeVisible({ timeout: 15000 });

    const songTitle = await firstSongItem.textContent();
    console.log(`Đang chọn bài hát: ${songTitle?.trim()}`);

    // 3. Click chọn bài hát
    await firstSongItem.click();

    // 4. Chờ bản nhạc SVG xuất hiện trong vùng hiển thị OSMD
    const svgLocator = page.locator('#osmd-container svg').first();
    await expect(svgLocator).toBeVisible({ timeout: 25000 });

    // 5. Kiểm tra kích thước SVG render hợp lệ
    const svgsReport = await page.evaluate(() => {
      const svgs = Array.from(document.querySelectorAll('#osmd-container svg'));
      return svgs.map((s, idx) => {
        const r = s.getBoundingClientRect();
        return {
          idx,
          tag: s.tagName,
          widthAttr: s.getAttribute('width'),
          heightAttr: s.getAttribute('height'),
          styleWidth: s.style.width,
          rectW: r.width,
          rectH: r.height,
          childCount: s.children.length
        };
      });
    });
    console.log(`[SVGs in #osmd-container]`, JSON.stringify(svgsReport));

    // Tìm SVG trang nhạc thực tế (có children và thuộc tính kích thước)
    const validSvg = svgsReport.find(s => (s.rectW > 50 && s.rectH > 50) || (parseFloat(s.widthAttr || '0') > 50));
    expect(validSvg, 'Cần có ít nhất 1 thẻ SVG bản nhạc có kích thước > 50px').toBeDefined();

    // Chờ ổn định để xác nhận không có background unhandled errors
    await page.waitForTimeout(500);

    // 6. Nghiệm thu: Console và runtime hoàn toàn sạch lỗi
    expect(pageErrors, `Phát hiện lỗi runtime: ${pageErrors.join(' | ')}`).toEqual([]);
    expect(consoleErrors, `Phát hiện lỗi console.error: ${consoleErrors.join(' | ')}`).toEqual([]);
  });
});
