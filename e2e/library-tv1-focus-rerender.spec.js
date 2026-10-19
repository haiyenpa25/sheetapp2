const { test, expect } = require('@playwright/test');
const path = require('path');
test('Virtual grid preserves action focus across a row replacement and never steals outside focus', async ({ page }) => {
  await page.setContent('<div class="song-list-container"><div id="song-list"><div class="song-item" data-id="one"><div><button>Favorite</button></div></div></div></div><button id="outside">Outside</button>');
  await page.addScriptTag({ path: path.resolve(__dirname, '../assets/js/library-list.js') });
  await page.evaluate(() => {
    const items = [{ id: 'one' }];
    LibraryList.bind({ element: document.getElementById('song-list'), getItems: () => items, getActive: () => null, select() {}, renderWindow() {} });
  });
  await page.focus('#song-list');
  await page.keyboard.press('Home');
  await page.keyboard.press('Tab');
  await expect(page.locator('.song-item button')).toBeFocused();
  await page.evaluate(() => {
    const row = document.querySelector('.song-item');
    row.replaceWith(row.cloneNode(true));
  });
  await expect(page.locator('.song-item button')).toBeFocused();
  await page.locator('#outside').focus();
  await page.evaluate(() => {
    const row = document.querySelector('.song-item');
    row.replaceWith(row.cloneNode(true));
  });
  await expect(page.locator('#outside')).toBeFocused();
});
