const { test, expect } = require('@playwright/test');
const path = require('path');
const modulePath = path.resolve(__dirname, '../assets/js/core/LibrarySearch.js');

test('Shared highlighter preserves Vietnamese word boundaries, HTML and aliases', async ({ page }) => {
  await page.addScriptTag({ path: modulePath });
  const result = await page.evaluate(() => [
    LibrarySearch.highlight('THẮNG ÂN ĐIỂN & an', 'an'),
    LibrarySearch.highlight('AN & amp', 'an amp'),
    LibrarySearch.highlight('<img src=x onerror=alert(1)>', 'img'),
    LibrarySearch.highlight('Giê-xu Jêsus Jesus', 'Jesus'),
  ]);
  expect(result).toEqual(['THẮNG <mark>ÂN</mark> ĐIỂN &amp; <mark>an</mark>',
    '<mark>AN</mark> &amp; <mark>amp</mark>', '&lt;<mark>img</mark> src=x onerror=alert(1)&gt;',
    '<mark>Giê-xu</mark> <mark>Jêsus</mark> <mark>Jesus</mark>']);
});

test('Failed next page can retry without losing rows or changing offset', async ({ page }) => {
  await page.setContent('<div id="song-list"></div><span id="count"></span>');
  await page.addScriptTag({ path: modulePath });
  await page.evaluate(async () => {
    window.calls = []; window.failNext = true;
    window.ApiService = { songs: { search: async (_, filters) => {
      window.calls.push(filters.offset);
      if (filters.offset && window.failNext) { window.failNext = false; throw new Error('Offline'); }
      return { success: true, total: 201, data: Array.from({ length: filters.offset ? 1 : 200 }, (_, i) => ({ id: filters.offset + i })) };
    } } };
    await LibrarySearch.run('an', {}, rows => { window.rows = rows; }, value => { document.getElementById('count').textContent = value; });
  });
  await page.locator('#library-load-more').click();
  await expect(page.locator('#library-load-more')).toContainText('Thử lại');
  expect(await page.evaluate(() => window.rows.length)).toBe(200);
  await page.locator('#library-load-more').click();
  await expect(page.locator('#count')).toHaveText('201');
  expect(await page.evaluate(() => window.calls)).toEqual([0, 200, 200]);
});

test('Late search response cannot replace a newer query', async ({ page }) => {
  await page.setContent('<div id="song-list"></div>');
  await page.addScriptTag({ path: modulePath });
  const rows = await page.evaluate(async () => {
    let release;
    window.ApiService = { songs: { search: async q => q === 'old' ? new Promise(resolve => { release = resolve; }) : { success: true, total: 1, data: [{ id: 'new' }] } } };
    let rendered;
    const old = LibrarySearch.run('old', {}, value => { rendered = value; }, () => {});
    await LibrarySearch.run('new', {}, value => { rendered = value; }, () => {});
    release({ success: true, total: 1, data: [{ id: 'old' }] });
    await old;
    return rendered;
  });
  expect(rows).toEqual([{ id: 'new' }]);
});
