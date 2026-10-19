const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');

for (const classic of [false, true]) {
  test(`${classic ? 'Classic' : 'Modern'} keyboard navigates virtual rows and row actions without opening on arrows`, async ({ page }) => {
    await page.setContent('<main><aside id="sidebar" class="sidebar"><label for="search-input">Tìm bài hát</label><input id="search-input"><div class="song-list-container" style="height:400px;width:360px;overflow:auto"><div id="song-list" class="song-list"></div></div><button id="after-list">Sau danh sách</button></aside></main>');
    const styles = classic ? ['old/assets/css/base.css', 'old/assets/css/layout.css'] : ['assets/css/base.css', 'assets/css/layout.css', 'assets/css/library-polish.css'];
    for (const file of styles) await page.addStyleTag({ path: path.join(root, file) });
    await page.addStyleTag({ content: 'body {display:block;height:auto;overflow:auto} #sidebar {position:relative;height:auto;width:360px} .song-list-container{position:relative;flex:none}' });
    await page.evaluate(() => {
      const songs = Array.from({ length: 343 }, (_, i) => ({ id: `row-${i + 1}`, title: `Bài ${i + 1}`, httlvnId: i + 1 }));
      window.ApiService = { songs: { list: async () => songs } };
      window.Auth = { isAdmin: () => true, isBanhat: () => true };
      window.HistoryManager = { isFavorite: () => false, toggleFavorite: () => { window.favoriteClicks++; return true; } };
      window.App = { showToast() {} };
      window.Store = { get: () => null };
      window.URLState = { resetForNewSong() {} };
      window.selected = []; window.favoriteClicks = 0;
      document.addEventListener('keydown', event => { if (event.key === 'ArrowDown') window.globalArrow = true; });
    });
    for (const file of ['assets/js/library-gestures.js', 'assets/js/library-list.js', classic ? 'old/assets/js/library-ui.js' : 'assets/js/library-ui.js', classic ? 'old/assets/js/keyboard-handler.js' : 'assets/js/keyboard-handler.js']) {
      if (fs.existsSync(path.join(root, file))) await page.addScriptTag({ path: path.join(root, file) });
    }
    await page.evaluate(() => { LibraryUI.onSelect(song => window.selected.push(song.id)); LibraryUI.init(); KeyboardHandler.init(); });
    const grid = page.locator('#song-list');
    await expect(grid).toHaveAttribute('role', 'grid');
    await expect(grid).toHaveAttribute('aria-rowcount', '343');
    await page.focus('#search-input');
    await page.keyboard.press('Tab');
    await expect(grid).toBeFocused();
    for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowDown');
    expect(await page.evaluate(() => window.selected)).toEqual([]);
    expect(await page.evaluate(() => window.globalArrow || false)).toBe(false);
    await page.keyboard.press('Enter');
    expect(await page.evaluate(() => window.selected)).toEqual(['row-3']);
    await page.keyboard.press('End');
    const lastId = await grid.getAttribute('aria-activedescendant');
    await expect(page.locator(`[id="${lastId}"]`)).toHaveAttribute('data-id', 'row-343');
    // A resize must preserve the browsed position instead of jumping to selected row 3.
    await page.evaluate(() => window.dispatchEvent(new Event('resize')));
    await expect(page.locator('[data-id="row-343"]')).toBeInViewport();
    await page.keyboard.press('Home');
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-id="row-1"] .song-item-actions button').first()).toBeFocused();
    if (classic) await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    expect(await page.evaluate(() => window.favoriteClicks)).toBe(1);
    expect(await page.evaluate(() => window.selected)).toEqual(['row-3']);
    await page.locator('[data-id="row-2"] .song-item-title').click();
    await expect(page.locator('[data-id="row-2"]')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('[data-id="row-3"]')).toHaveAttribute('aria-selected', 'false');
    const axe = await new AxeBuilder({ page }).include('#song-list').analyze();
    expect(axe.violations.filter(item => ['serious', 'critical'].includes(item.impact)).map(item => ({ id: item.id, nodes: item.nodes.slice(0, 3).map(node => ({ html: node.html, summary: node.failureSummary })) }))).toEqual([]);
  });
}
