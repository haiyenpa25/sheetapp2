const { test, expect } = require('@playwright/test');
const path = require('path');
const root = path.resolve(__dirname, '..');

for (const classic of [false, true]) {
  test(`${classic ? 'Classic' : 'Modern'}: search loads all 343 filtered songs in bounded pages`, async ({ page }) => {
    await page.setContent('<input id="search-input"><select id="category-filter"></select><span id="library-count"></span><span data-library-total>toàn bộ</span><div class="song-list-container" style="height:500px;overflow:auto"><div id="song-list"></div></div>');
    for (const file of classic ? ['old/assets/css/base.css', 'old/assets/css/layout.css'] : ['assets/css/base.css', 'assets/css/layout.css', 'assets/css/library-polish.css']) await page.addStyleTag({ path: path.join(root, file) });
    await page.addStyleTag({ content: 'body { display:block; height:auto; overflow:auto; } .song-list-container { position:relative; flex:none; width:340px; height:500px; overflow:auto; }' });
    await page.evaluate(() => {
      const songs = Array.from({ length: 343 }, (_, i) => ({ id: `page-${i + 1}`, title: `Ân điển ${i + 1}`, category: 'Tôn Vinh', category_id: 2 }));
      window.searchCalls = [];
      window.ApiService = { songs: { list: async () => [...songs, { id: 'other', title: 'Ngoài tập', category: 'Thánh ca', category_id: 1 }], search: async (q, filters) => {
        window.searchCalls.push({ q, ...filters });
        const offset = filters.offset || 0;
        return { success: true, data: songs.slice(offset, offset + filters.limit), total: 343 };
      } } };
    });
    for (const file of ['assets/js/library-gestures.js', 'assets/js/core/LibrarySearch.js', classic ? 'old/assets/js/library-ui.js' : 'assets/js/library-ui.js']) {
      // Missing shared module is intentionally ignored before integration: the assertion reproduces the old 200-row cap.
      if (require('fs').existsSync(path.join(root, file))) await page.addScriptTag({ path: path.join(root, file) });
    }
    await page.evaluate(() => LibraryUI.init());
    await expect(page.locator('#library-count')).toHaveText('344');
    await expect(page.locator('[data-library-total]')).toHaveText('344');
    await page.selectOption('#category-filter', 'Tôn Vinh');
    await page.fill('#search-input', 'an');
    await expect(page.locator('#library-load-more')).toHaveText('Xem thêm (còn 143 bài)');
    await expect(page.locator('#library-count')).toHaveText('200/343');
    await expect(page.locator('.song-item-title mark').first()).toHaveText('Ân');
    await page.locator('#library-load-more').click();
    await expect(page.locator('#library-count')).toHaveText('343');
    await expect(page.locator('[data-library-total]')).toHaveText('344');
    await expect(page.locator('#library-load-more')).toHaveCount(0);
    const calls = await page.evaluate(() => window.searchCalls.filter(call => call.q === 'an'));
    expect(calls.map(call => call.offset)).toEqual([0, 200]);
    expect(calls.every(call => call.limit === 200 && call.category_id === 2)).toBe(true);
    await page.locator('.song-list-container').evaluate(el => { el.scrollTop = el.scrollHeight; });
    await expect(page.locator('[data-id="page-343"]')).toBeVisible();
    await page.fill('#search-input', '');
    await expect(page.locator('#library-count')).toHaveText('343');
    await expect(page.locator('#library-load-more')).toHaveCount(0);
  });
}
