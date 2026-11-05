// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Band nhạc: cuộn theo ô nhịp trên /live-band/ (trước đây MusicalPosition chỉ biết container của app chính nên
 * mọi lệnh cuộn đồng bộ — theo Ca trưởng, vòng lặp A-B, mốc đoạn — im lặng không làm gì).
 */
test('Live Band: MusicalPosition cuộn đúng tới ô nhịp trong stage-viewport', async ({ page }) => {
  // Điện thoại: bản nhạc xuống dòng thành nhiều hệ khuông nên phải cuộn (máy tính để bài ngắn vừa một màn hình).
  await page.setViewportSize({ width: 390, height: 700 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const sessionId = require('./helpers/php-session').run([]).toString().trim();
  await page.context().addCookies([{ name: 'PHPSESSID', value: sessionId, domain: 'localhost', path: '/' }]);

  await page.goto('./live-band/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#nav-room-label', { timeout: 15000 });
  // Danh sách bài của Band nhạc phải nạp được (trước đây luôn rỗng vì đọc sai dạng dữ liệu của songs.list()).
  await expect.poll(() => page.locator('#host-song-dropdown option').count(), { timeout: 20000 }).toBeGreaterThan(10);
  await page.evaluate(() => window.LiveBandApp?.createHostRoom?.('LBS' + Math.floor(1000 + Math.random() * 9000)));
  await expect(page.locator('#nav-room-label')).toContainText('HOST', { timeout: 10000 });

  const songId = await page.evaluate(async () => {
    const res = await window.ApiService.songs.list();
    const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
    return list[0].id;
  });
  await page.evaluate((id) => window.LiveBandApp?.hostSelectSong?.(id), songId);
  await page.waitForSelector('#stage-osmd-container svg', { state: 'attached', timeout: 20000 });
  await page.waitForTimeout(800);

  const result = await page.evaluate(async () => {
    const vp = document.getElementById('stage-viewport');
    vp.style.scrollBehavior = 'auto';
    window.MusicalPosition.computeMeasurePositions();
    window.MusicalPosition.scrollToMeasure(9999, false);
    await new Promise((r) => setTimeout(r, 300));
    const scrolledDown = vp.scrollTop;
    window.MusicalPosition.scrollToMeasure(1, false);
    await new Promise((r) => setTimeout(r, 300));
    return { scrolledDown, scrolledBack: vp.scrollTop, scrollable: vp.scrollHeight > vp.clientHeight + 40 };
  });

  test.skip(!result.scrollable, 'Bài đầu tiên quá ngắn để cuộn trong viewport này');
  expect(result.scrolledDown).toBeGreaterThan(50);
  expect(result.scrolledBack).toBeLessThan(result.scrolledDown);
  expect(errors.filter((e) => !/access control checks|Load failed|ResizeObserver loop/i.test(e))).toEqual([]);
});
