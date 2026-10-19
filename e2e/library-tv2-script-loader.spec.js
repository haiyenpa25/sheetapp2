const { test, expect } = require('@playwright/test');
const path = require('path');
const loader = process.env.SHEETAPP_TV24_LOADER_BASELINE || path.resolve(__dirname, '../assets/js/core/ScriptLoader.js');
test.beforeEach(async ({ page }) => {
  await page.route('http://loader.test/**', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Loader fixture</title>' }));
  await page.goto('http://loader.test/app/old/');
  await page.evaluate(() => { window.__APP_BASE__ = '/app'; });
  await page.addScriptTag({ path: loader });
});
test('Classic subdirectory requests use the application root and coalesce while loading', async ({ page }) => {
  const urls = [];
  await page.route('**/probe.js', async route => {
    urls.push(route.request().url());
    await new Promise(resolve => setTimeout(resolve, 50));
    await route.fulfill({ contentType: 'text/javascript', body: 'window.probeRuns = (window.probeRuns || 0) + 1;' });
  });
  await page.evaluate(() => Promise.all([ScriptLoader.load('assets/js/probe.js'), ScriptLoader.load('assets/js/probe.js')]));
  expect(urls).toEqual(['http://loader.test/app/assets/js/probe.js']);
  expect(await page.evaluate(() => probeRuns)).toBe(1);
});
test('A failed script is removed and the next attempt really fetches and executes it', async ({ page }) => {
  let attempts = 0;
  await page.route('**/retry.js', route => ++attempts === 1
    ? route.abort('failed') : route.fulfill({ contentType: 'text/javascript', body: 'window.retryLoaded = true;' }));
  expect(await page.evaluate(() => ScriptLoader.load('assets/js/retry.js').then(() => false, () => true))).toBe(true);
  await expect(page.locator('script[src*="retry.js"]')).toHaveCount(0);
  await page.evaluate(() => ScriptLoader.load('assets/js/retry.js'));
  expect(attempts).toBe(2);
  expect(await page.evaluate(() => window.retryLoaded)).toBe(true);
});
