// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Band nhạc: Ca trưởng phát lệnh (cue) → nhạc công thấy banner có nút "✓ Đã nhận" → chạm →
 * Ca trưởng thấy "Đã nhận 1/…" ngay trên bảng lệnh.
 */
test('Cue có xác nhận: nhạc công chạm Đã nhận, Ca trưởng đếm được', async ({ browser }) => {
  const hostCtx = await browser.newContext();
  const memberCtx = await browser.newContext();
  const sessionId = require('./helpers/php-session').run([]).toString().trim();
  await hostCtx.addCookies([{ name: 'PHPSESSID', value: sessionId, domain: 'localhost', path: '/' }]);

  const host = await hostCtx.newPage();
  const member = await memberCtx.newPage();
  const errors = [];
  for (const p of [host, member]) p.on('pageerror', (e) => errors.push(e.message));

  const room = 'CK' + Math.floor(1000 + Math.random() * 9000);
  await host.goto('./live-band/', { waitUntil: 'domcontentloaded' });
  await host.waitForSelector('#nav-room-label', { timeout: 15000 });
  await host.evaluate((code) => window.LiveBandApp.createHostRoom(code), room);
  await expect(host.locator('#nav-room-label')).toContainText(`HOST: ${room}`, { timeout: 10000 });

  await member.goto(`./live-band/?room=${room}`, { waitUntil: 'domcontentloaded' });
  await expect(member.locator('#nav-room-label')).toContainText(`LIVE: ${room}`, { timeout: 15000 });

  await host.evaluate(() => window.LiveBandApp.hostSendCue('chorus'));

  const ack = member.locator('#btn-cue-ack');
  await expect(ack).toBeVisible({ timeout: 8000 });
  await ack.click();
  await expect(ack).toHaveText(/Đã báo nhận/, { timeout: 5000 });

  await expect(host.locator('#cue-ack-status')).toContainText(/Đã nhận [1-9]\d*\//, { timeout: 8000 });

  expect(errors.filter((e) => !/access control checks|Load failed|ResizeObserver loop/i.test(e))).toEqual([]);
  await hostCtx.close();
  await memberCtx.close();
});
