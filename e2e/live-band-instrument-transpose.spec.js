// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Band nhạc: bản nhạc trên sân khấu dịch giọng THẬT (nốt + hợp âm) khi Ca trưởng đổi tông,
 * và nhạc cụ chuyển giọng (Trumpet Bb +2) tự thấy nốt viết cao hơn trên máy của mình.
 */
// Bỏ nhãn số ô nhịp: vẽ lại có thể đổi chỗ xuống dòng nên số hiện ra khác, còn chữ lời và hợp âm thì phải đúng.
async function sheetText(page) {
  return page.evaluate(() => [...document.querySelectorAll('#stage-osmd-container svg text')].map((t) => (t.textContent || '').trim()).filter((t) => t && !/^\d+$/.test(t)).join('|'));
}

test('Đổi tông và vai trò nhạc cụ chuyển giọng làm đổi bản nhạc trên sân khấu', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const sessionId = require('./helpers/php-session').run([]).toString().trim();
  await page.context().addCookies([{ name: 'PHPSESSID', value: sessionId, domain: 'localhost', path: '/' }]);

  await page.goto('./live-band/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#nav-room-label', { timeout: 15000 });
  await expect.poll(() => page.locator('#host-song-dropdown option').count(), { timeout: 20000 }).toBeGreaterThan(10);
  await page.evaluate(() => window.LiveBandApp.createHostRoom('IT' + Math.floor(1000 + Math.random() * 9000)));
  await expect(page.locator('#nav-room-label')).toContainText('HOST', { timeout: 10000 });
  await page.evaluate(() => window.LiveBandApp.hostSelectSong('thanh-ca-001'));
  await page.waitForSelector('#stage-osmd-container svg', { state: 'attached', timeout: 20000 });
  await page.waitForTimeout(800);

  const base = await sheetText(page);
  expect(base.length).toBeGreaterThan(20);

  // Ca trưởng tăng 2 nửa cung → bản nhạc đổi thật
  await page.evaluate(() => window.LiveBandApp.hostAdjustTranspose(2));
  await expect.poll(() => sheetText(page), { timeout: 10000 }).not.toBe(base);
  const up2 = await sheetText(page);

  // Về 0 → trở lại nguyên bản
  await page.evaluate(() => window.LiveBandApp.hostAdjustTranspose(-2));
  await expect.poll(() => sheetText(page), { timeout: 10000 }).toBe(base);

  // Trumpet Bb ở tông chung 0: thấy giống hệt khi Ca trưởng +2 (chỉ máy này)
  await page.selectOption('#stage-role-select', 'trumpet');
  await expect.poll(() => sheetText(page), { timeout: 10000 }).toBe(up2);

  // Đổi lại vai trò thường → nguyên bản
  await page.selectOption('#stage-role-select', 'guitar');
  await expect.poll(() => sheetText(page), { timeout: 10000 }).toBe(base);

  expect(errors.filter((e) => !/access control checks|Load failed|ResizeObserver loop/i.test(e))).toEqual([]);
});
