// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Band nhạc: lật trang tự động theo nhịp (StageAutoTurn).
 * - Logic: số phách mỗi ô (6/8 → 2), chạy qua từng ô theo thứ tự, vòng lặp A-B quay về đầu đoạn, dừng khi hết bài.
 * - Giao diện: Ca trưởng bấm "Tự lật trang" thì bản nhạc tự cuộn xuống trên màn hình điện thoại, bấm lại thì dừng.
 */
test('StageAutoTurn: đếm ô nhịp, vòng lặp A-B và dừng khi hết bài', async ({ page }) => {
  const sessionId = require('./helpers/php-session').run([]).toString().trim();
  await page.context().addCookies([{ name: 'PHPSESSID', value: sessionId, domain: 'localhost', path: '/' }]);
  await page.goto('./live-band/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.StageAutoTurn);

  const r = await page.evaluate(async () => {
    const A = window.StageAutoTurn;
    const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
    const out = { bpm: [A.beatsPerMeasure(4, 4), A.beatsPerMeasure(3, 4), A.beatsPerMeasure(6, 8), A.beatsPerMeasure(12, 8), A.beatsPerMeasure(2, 4)] };

    // 4 phách/ô, 1200 BPM → 1 ô ≈ 0,2 giây; 5 ô tổng cộng
    const seen = []; let ended = false;
    A.start({ getBpm: () => 1200, getBeatsPerMeasure: () => 4, getTotalMeasures: () => 5, getLoop: () => ({ active: false }),
      startMeasure: 1, onMeasure: (m) => seen.push(m), onEnd: () => { ended = true; } });
    await sleep(1600);
    out.seq = seen; out.ended = ended; out.running = A.isRunning();

    // Vòng lặp ô 2–3: không bao giờ vượt quá ô 3 và không dừng
    const loopSeen = [];
    A.start({ getBpm: () => 1200, getBeatsPerMeasure: () => 4, getTotalMeasures: () => 50, getLoop: () => ({ active: true, start: 2, end: 3 }),
      startMeasure: 2, onMeasure: (m) => loopSeen.push(m) });
    await sleep(1500);
    out.loopSeen = loopSeen; out.loopRunning = A.isRunning();
    A.stop();
    out.stopped = !A.isRunning();
    return out;
  });

  expect(r.bpm).toEqual([4, 3, 2, 4, 2]);
  expect(r.seq).toEqual([2, 3, 4, 5]);
  expect(r.ended).toBe(true);
  expect(r.running).toBe(false);
  expect(Math.max(...r.loopSeen)).toBeLessThanOrEqual(3);
  expect(r.loopSeen.length).toBeGreaterThan(3);
  expect(r.loopRunning).toBe(true);
  expect(r.stopped).toBe(true);
});

test('Ca trưởng bấm Tự lật trang: bản nhạc tự cuộn, bấm lại thì dừng', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 });
  const sessionId = require('./helpers/php-session').run([]).toString().trim();
  await page.context().addCookies([{ name: 'PHPSESSID', value: sessionId, domain: 'localhost', path: '/' }]);
  await page.goto('./live-band/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#nav-room-label', { timeout: 15000 });
  await expect.poll(() => page.locator('#host-song-dropdown option').count(), { timeout: 20000 }).toBeGreaterThan(10);
  await page.evaluate(() => window.LiveBandApp.createHostRoom('AT' + Math.floor(1000 + Math.random() * 9000)));
  await expect(page.locator('#nav-room-label')).toContainText('HOST', { timeout: 10000 });
  await page.evaluate(() => window.LiveBandApp.hostSelectSong('thanh-ca-001'));
  await page.waitForSelector('#stage-osmd-container svg', { state: 'attached', timeout: 20000 });
  await page.waitForTimeout(800);

  // BPM tối đa để ô nhịp trôi nhanh trong bài kiểm
  await page.evaluate(() => { for (let i = 0; i < 40; i++) window.LiveBandApp.hostAdjustBpm(5); });
  await page.evaluate(() => { document.getElementById('stage-viewport').style.scrollBehavior = 'auto'; });

  const btn = page.locator('#btn-host-autoturn');
  await expect(btn).toHaveAttribute('aria-pressed', 'false');
  await page.evaluate(() => window.LiveBandApp.hostToggleAutoTurn());
  await expect(btn).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => page.evaluate(() => document.getElementById('stage-viewport').scrollTop), { timeout: 15000 }).toBeGreaterThan(100);

  await page.evaluate(() => window.LiveBandApp.hostToggleAutoTurn());
  await expect(btn).toHaveAttribute('aria-pressed', 'false');
  const stoppedAt = await page.evaluate(() => document.getElementById('stage-viewport').scrollTop);
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => document.getElementById('stage-viewport').scrollTop)).toBe(stoppedAt);
});
