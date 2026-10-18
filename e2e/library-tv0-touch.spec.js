const { test, expect } = require('@playwright/test');
const path = require('path');

async function openLibrary(page, width, classic = false) {
  await page.setViewportSize({ width, height: 844 });
  await page.setContent(`<div class="song-list-container"><div id="song-list"></div></div>
    <div id="quick-jump-btns"></div><div id="recently-viewed-section"></div>
    <div id="quick-favorites-section"></div><div id="quick-pin-bar"></div>`);
  await page.evaluate(() => {
    const songs = Array.from({ length: 5 }, (_, i) => ({ id: `song-${i}`, title: `Bài ${i}`, httlvnId: i + 1 }));
    window.ApiService = { songs: { list: async () => songs } };
    window.HistoryManager = { init() {}, getRecent: () => songs.slice(0, 2), getFavorites: () => songs.slice(2, 4), isFavorite: () => false };
    window.selections = [];
  });
  await page.addScriptTag({ path: path.resolve(__dirname, '../assets/js/library-gestures.js') });
  await page.addScriptTag({ path: path.resolve(__dirname, classic ? '../old/assets/js/library-ui.js' : '../assets/js/library-ui.js') });
  await page.evaluate(() => { LibraryUI.onSelect(song => window.selections.push(song.id)); LibraryUI.init(); });
  await expect(page.locator('#song-list .song-item')).toHaveCount(5);
}

for (const width of [390, 820]) {
  test(`${width} Classic: swipe, hold, cancel ignored; tap selects once`, async ({ page }) => {
    await openLibrary(page, width, true);
    const item = page.locator('#song-list .song-item').first();
    for (const type of ['swipe', 'hold', 'cancel']) {
      await gesture(item, type);
      expect(await page.evaluate(() => window.selections), type).toEqual([]);
    }
    await item.tap();
    expect(await page.evaluate(() => window.selections)).toHaveLength(1);
  });
}

async function gesture(item, type) {
  await item.dispatchEvent('pointerdown', { pointerId: 1, pointerType: 'touch', clientX: 20, clientY: 20, isPrimary: true });
  if (type === 'swipe') await item.dispatchEvent('pointermove', { pointerId: 1, pointerType: 'touch', clientX: 26, clientY: 29 });
  if (type === 'hold') await new Promise(resolve => setTimeout(resolve, 550));
  await item.dispatchEvent(type === 'cancel' ? 'pointercancel' : 'pointerup', { pointerId: 1, pointerType: 'touch', clientX: 20, clientY: 20 });
  // Include the compatibility click: it must never reactivate a rejected gesture.
  await item.dispatchEvent('click', { detail: 1 });
}

test('tap duration ends at pointerup, independent of compatibility click delay', async ({ page }) => {
  await openLibrary(page, 390);
  const item = page.locator('#song-list .song-item').first();
  await item.dispatchEvent('pointerdown', { pointerId: 1, pointerType: 'touch', clientX: 20, clientY: 20, isPrimary: true });
  await page.waitForTimeout(350);
  await item.dispatchEvent('pointerup', { pointerId: 1, pointerType: 'touch', clientX: 20, clientY: 20 });
  await page.waitForTimeout(300);
  await item.dispatchEvent('click', { detail: 1 });
  expect(await page.evaluate(() => window.selections)).toHaveLength(1);
});

for (const width of [390, 820]) {
  for (const selector of ['#song-list .song-item', '#recently-viewed-section .recent-item', '#quick-favorites-section .recent-item']) {
    test(`${width} ${selector}: swipe, hold, cancel ignored; tap selects once`, async ({ page }) => {
      await openLibrary(page, width);
      const item = page.locator(selector).first();
      for (const type of ['swipe', 'hold', 'cancel']) {
        await gesture(item, type);
        expect(await page.evaluate(() => window.selections), type).toEqual([]);
      }
      await item.tap();
      expect(await page.evaluate(() => window.selections)).toHaveLength(1);
      await item.dispatchEvent('click', { detail: 0 });
      expect(await page.evaluate(() => window.selections)).toHaveLength(2);
    });
  }
  test(`${width} quick jump ignores long presses and scrolling`, async ({ page }) => {
    await openLibrary(page, width);
    await page.evaluate(() => LibraryUI.render(LibraryUI.getSongs().slice(0, 1)));
    const all = page.locator('.quick-jump-all');
    for (const type of ['swipe', 'hold', 'cancel']) {
      await gesture(all, type);
      await expect(page.locator('#song-list .song-item')).toHaveCount(1);
    }
    await all.tap();
    await expect(page.locator('#song-list .song-item')).toHaveCount(5);
  });
}
