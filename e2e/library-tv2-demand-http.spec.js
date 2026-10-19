const { test, expect } = require('@playwright/test');
const path = require('path');
const base = process.env.SHEETAPP_TV_TEST_URL;
test.skip(!base, 'Requires explicit isolated Apache URL');

test('Modern reading avoids usage and performance API; explicit info and performance still load', async ({ page }) => {
  const calls = [];
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.searchParams.get('route') === 'arrangements' || url.searchParams.get('action') === 'song_usage') calls.push(url);
  });
  await page.goto(`${base}/?song=thanh-ca-001&v=sheet`);
  await expect(page.locator('#osmd-container svg').first()).toBeVisible();
  await page.waitForLoadState('networkidle');
  expect(calls).toHaveLength(0);
  expect(await page.evaluate(() => window.LiveSync.isLoaded())).toBe(false);
  await page.locator('#btn-song-info-popover').click();
  await expect.poll(() => calls.filter(url => url.searchParams.get('action') === 'song_usage').length).toBe(1);
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => window.SongInfoBar.refreshChordChip());
  await page.waitForLoadState('networkidle');
  expect(calls.filter(url => url.searchParams.get('action') === 'song_usage')).toHaveLength(1);
  await page.evaluate(() => window.ModeManager.setMode('performance'));
  await expect.poll(() => calls.filter(url => url.searchParams.get('route') === 'arrangements').length).toBe(2);
  await expect.poll(() => page.evaluate(() => window.LiveSync.isLoaded())).toBe(true);
});

test('Info popover can retry a failed usage request without changing songs', async ({ page }) => {
  await page.setContent('<button id="btn-song-info-popover">Info</button><div id="song-info-popover" class="hidden"><span id="si-pop-usage"></span></div>');
  await page.evaluate(() => {
    window.usageCalls = 0;
    window.ApiService = { setlists: { songUsage: async () => {
      if (++window.usageCalls === 1) throw new Error('Offline once');
      return { success: true, data: { total_used: 2 } };
    } } };
  });
  await page.addScriptTag({ path: path.resolve(__dirname, '../assets/js/song-info-bar.js') });
  await page.evaluate(() => {
    SongInfoBar.init();
    SongInfoBar.loadSong('<score-partwise/>', { id: 'retry', title: 'Retry' });
  });
  await page.locator('#btn-song-info-popover').click();
  await expect.poll(() => page.evaluate(() => usageCalls)).toBe(1);
  await page.locator('#btn-song-info-popover').click();
  await page.locator('#btn-song-info-popover').click();
  await expect(page.locator('#si-pop-usage')).toHaveText('2 lần');
  expect(await page.evaluate(() => usageCalls)).toBe(2);
});
