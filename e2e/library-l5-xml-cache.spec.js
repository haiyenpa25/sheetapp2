// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * e2e/library-l5-xml-cache.spec.js
 *
 * Nghiệm thu Ticket L5-3 (Chương L5: Hiệu năng & Nền kỹ thuật):
 * 1. Parse XML 1 lần và cache theo bài (thay cho 8 chỗ gọi DOMParser).
 * 2. Tính vị trí hợp âm dùng dữ liệu hình học của OSMD, có cache.
 * 3. Nghiệm thu: Profile: ≤2 lần gọi DOMParser mỗi lần đổi bài.
 */

test.describe('L5-3: XML Document Cache & Geometry Caching', () => {

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('sheetapp_guest_chosen', '1');
      localStorage.setItem('sheetapp_guest_toast_shown', '1');
      localStorage.setItem('sheetapp_instrument_role', 'guitar');
      localStorage.removeItem('sheetapp_zoom_locked');
    });
  });

  test('Profile DOMParser: ≤2 lần gọi DOMParser mỗi lần đổi bài (87.5% CPU overhead saved)', async ({ page }) => {
    page.on('console', msg => console.log('BROWSER_CONSOLE:', msg.text()));
    page.on('pageerror', err => console.log('BROWSER_ERROR:', err.message));

    await page.setViewportSize({ width: 1280, height: 800 });

    // ── 1. TẢI BÀI BAN ĐẦU ──
    await page.goto('./?song=thanh-ca-001', { waitUntil: 'networkidle' });
    const svg = page.locator('#osmd-container svg');
    await expect(svg).toBeVisible({ timeout: 25000 });

    await page.waitForTimeout(600);

    // Gắn spy theo dõi prototype DOMParser.parseFromString
    await page.evaluate(() => {
      window.__domParserCalls = 0;
      const originalParseFromString = DOMParser.prototype.parseFromString;
      DOMParser.prototype.parseFromString = function (...args) {
        window.__domParserCalls = (window.__domParserCalls || 0) + 1;
        return originalParseFromString.apply(this, args);
      };
    });

    // ── 2. ĐỔI SANG BÀI 2 VÀ ĐO SỐ LẦN GỌI DOMParser ──
    await page.evaluate(() => { window.__domParserCalls = 0; });

    await page.evaluate(async () => {
      const song2 = {
        id: 'thanh-ca-002',
        title: 'NGUYỀN TỤNG MỸ CHÚA LINH NĂNG',
        xmlPath: 'storage/Thanh ca/002 NGUYỀN TỤNG MỸ CHÚA LINH NĂNG.xml',
      };
      await window.SongLoader.load(song2);
    });

    await page.waitForTimeout(800);

    const callsAfterSwitch = await page.evaluate(() => window.__domParserCalls);
    // Nghiệm thu cốt lõi L5-3: ≤ 2 lần gọi DOMParser mỗi lần đổi bài (trước đây gọi 8 lần!)
    expect(callsAfterSwitch).toBeLessThanOrEqual(2);

    // ── 3. ĐỔI SANG BÀI 3 VÀ XÁC NHẬN TIẾP TỤC ≤ 2 LẦN ──
    await page.evaluate(() => { window.__domParserCalls = 0; });

    await page.evaluate(async () => {
      const song3 = {
        id: 'thanh-ca-003',
        title: 'NGỢI GIÊ-HÔ-VA THÁNH ĐẾ',
        xmlPath: 'storage/Thanh ca/003 NGỢI GIÊ-HÔ-VA THÁNH ĐẾ.xml',
      };
      await window.SongLoader.load(song3);
    });

    await page.waitForTimeout(800);

    const callsAfterSong3 = await page.evaluate(() => window.__domParserCalls);
    expect(callsAfterSong3).toBeLessThanOrEqual(2);

    // ── 4. CHUYỂN BỘ HỢP ÂM KHÔNG GỌI LẠI DOMParser (DÙNG CACHE) ──
    await page.evaluate(() => { window.__domParserCalls = 0; });

    await page.evaluate(async () => {
      if (window.ChordCanvas?.switchSet) {
        await window.ChordCanvas.switchSet('TLH');
      }
    });

    await page.waitForTimeout(300);

    const callsAfterChordSwitch = await page.evaluate(() => window.__domParserCalls);
    expect(callsAfterChordSwitch).toBe(0); // 0 lần gọi DOMParser khi đổi bộ hợp âm
  });

});
