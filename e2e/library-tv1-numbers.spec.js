const { test, expect } = require('@playwright/test');
const path = require('path');
const root = path.resolve(__dirname, '..');
for (const classic of [false, true]) {
  test(`${classic ? 'Classic' : 'Modern'} number lookup stays in its catalog and never guesses unofficial numbers`, async ({ page }) => {
    await page.setContent('<select id="category-filter"></select><button id="btn-quick-numpad">#</button><div id="song-list"></div><div id="modal-quick-numpad" class="hidden"><div class="numpad-screen-label"></div><span id="numpad-display-digits"></span><div id="numpad-song-match"></div><button id="btn-numpad-open"></button></div>');
    await page.evaluate(() => {
      window.fixture = [
        { id: 'tc-1', title: 'TC Một', httlvnId: 1, category: 'Thánh ca', category_id: 1 },
        { id: 'tc-2', title: 'TC Hai', httlvnId: 2, category: 'Thánh ca', category_id: 1 },
        { id: 'tv-1', title: 'TV Một', httlvnId: 1, category: 'Tôn Vinh', category_id: 2 },
        { id: 'artist--001-fake', title: '001 Không có số chính thức', httlvnId: null, category: 'Tác giả', category_id: 6 },
      ];
      window.ApiService = { songs: { list: async () => window.fixture.map(song => ({ ...song })) } };
      window.URLState = { resetForNewSong() {} };
      window.App = { showToast: message => { window.lastMessage = message; } };
      window.selected = [];
    });
    for (const file of ['assets/js/core/EventBus.js', 'assets/js/song-navigation.js', 'assets/js/library-gestures.js', classic ? 'old/assets/js/library-ui.js' : 'assets/js/library-ui.js', 'assets/js/modals/QuickNumpadModal.js']) await page.addScriptTag({ path: path.join(root, file) });
    await page.evaluate(() => { SongNavigation.init(); LibraryUI.onSelect(song => window.selected.push(song.id)); LibraryUI.init(); });
    await expect.poll(() => page.evaluate(() => LibraryUI.getSongs().length)).toBe(4);
    await expect(page.locator('[data-id="tc-1"] .song-item-num')).toHaveText('TC 001');
    await expect(page.locator('[data-id="tv-1"] .song-item-num')).toHaveText('TV 001');
    await page.selectOption('#category-filter', 'Tôn Vinh');
    await page.evaluate(() => { QuickNumpadModal.open(); QuickNumpadModal.appendDigit(1); });
    await expect(page.locator('#numpad-song-match')).toContainText('TV Một');
    await page.evaluate(() => QuickNumpadModal.openCurrentSong());
    expect(await page.evaluate(() => window.selected)).toEqual(['tv-1']);
    await page.evaluate(() => LibraryUI.jumpByNumber(2));
    expect(await page.evaluate(() => window.selected)).toEqual(['tv-1']);
    await page.selectOption('#category-filter', 'Tác giả');
    await expect(page.locator('#btn-quick-numpad')).toBeHidden();
    await page.evaluate(() => { QuickNumpadModal.open(); LibraryUI.jumpByNumber(1); });
    await expect(page.locator('#modal-quick-numpad')).toHaveClass(/hidden/);
    expect(await page.evaluate(() => window.selected)).toEqual(['tv-1']);
    expect(await page.evaluate(() => window.lastMessage)).toContain('chưa có số');
    await page.selectOption('#category-filter', 'Thánh ca');
    await page.evaluate(() => { QuickNumpadModal.open(); QuickNumpadModal.appendDigit(1); });
    await page.selectOption('#category-filter', 'Tôn Vinh');
    await page.evaluate(() => QuickNumpadModal.openCurrentSong());
    expect(await page.evaluate(() => window.selected)).toEqual(['tv-1', 'tv-1']);
  });
}
