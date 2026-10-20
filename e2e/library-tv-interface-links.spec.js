const { test, expect } = require('@playwright/test');
const path = require('path');

test('switching Classic and Modern preserves song, transpose, view and chord set in subfolders', async ({ page }) => {
  await page.route('https://interfaces.test/**', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html>' }));
  await page.goto('https://interfaces.test/sheetapp2/?song=old-song&t=3&v=lyric&lv=inline&set=Band&compact=1&irrelevant=drop');
  await page.evaluate(() => { window.__APP_BASE__ = '/sheetapp2'; window.App = { getCurrentSongId: () => 'current-song' }; });
  await page.addScriptTag({ path: path.resolve(__dirname, '../assets/js/url-state.js') });
  const result = await page.evaluate(() => [URLState.interfaceUrl(true), URLState.interfaceUrl(false)]);
  expect(result).toEqual([
    'https://interfaces.test/sheetapp2/old/?song=current-song&t=3&v=lyric&lv=inline&set=Band&compact=1',
    'https://interfaces.test/sheetapp2/?song=current-song&t=3&v=lyric&lv=inline&set=Band&compact=1'
  ]);
});

test('interface links explicitly keep sheet view when the default was omitted', async ({ page }) => {
  await page.route('https://interfaces.test/**', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html>' }));
  await page.goto('https://interfaces.test/old/?song=one');
  await page.evaluate(() => { window.__APP_BASE__ = ''; });
  await page.addScriptTag({ path: path.resolve(__dirname, '../assets/js/url-state.js') });
  expect(await page.evaluate(() => URLState.interfaceUrl(false))).toBe('https://interfaces.test/?song=one&v=sheet');
});
