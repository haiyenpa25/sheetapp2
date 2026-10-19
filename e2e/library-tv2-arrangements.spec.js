const { test, expect } = require('@playwright/test');
const path = require('path');
test('arrangement requests coalesce, empty results stay loaded, late responses never replace the current song', async ({ page }) => {
  await page.setContent('<div id="section-jump-bar-container"><div id="section-chips-list"></div></div>');
  await page.evaluate(() => {
    window.EventBus = { emit() {}, on() {} };
    window.requests = [];
    window.ApiService = { arrangements: {
      getSections: song => new Promise(resolve => window.requests.push({ song, resolve })),
      list: async () => ({ data: [] }),
    } };
  });
  await page.addScriptTag({ path: path.resolve(__dirname, '../assets/js/performance/arrangement-engine.js') });
  await page.evaluate(() => {
    window.first = ArrangementEngine.loadForSong('A');
    window.same = ArrangementEngine.loadForSongIfEmpty('A');
  });
  expect(await page.evaluate(() => requests.length)).toBe(1);
  await page.evaluate(async () => {
    requests[0].resolve({ data: [] });
    await Promise.all([first, same]);
    await ArrangementEngine.loadForSongIfEmpty('A');
  });
  expect(await page.evaluate(() => requests.length)).toBe(1);
  await page.evaluate(() => {
    window.b = ArrangementEngine.loadForSong('B');
    window.a = ArrangementEngine.loadForSong('A');
    window.bAgain = ArrangementEngine.loadForSong('B');
  });
  expect(await page.evaluate(() => requests.length)).toBe(4);
  await page.evaluate(async () => {
    requests[3].resolve({ data: [{ id: 'current', start_measure: 1, end_measure: 2 }] });
    await bAgain;
    requests[1].resolve({ data: [{ id: 'old-B' }] });
    requests[2].resolve({ data: [{ id: 'old-A' }] });
    await Promise.all([b, a]);
  });
  expect(await page.evaluate(() => ArrangementEngine.getSections().map(s => s.id))).toEqual(['current']);
  await page.evaluate(async () => {
    window.c = ArrangementEngine.loadForSong('C');
    ArrangementEngine.clear();
    requests[4].resolve({ data: [{ id: 'cleared' }] });
    await c;
  });
  expect(await page.evaluate(() => ArrangementEngine.getSections())).toEqual([]);
});
