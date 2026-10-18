const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');

for (const classic of [false, true]) {
  test(`${classic ? 'Classic' : 'Modern'}: 1731 rows keep exact scroll geometry and selected row after rotation`, async ({ page }) => {
    await page.setViewportSize({ width: 820, height: 1180 });
    await page.setContent('<div class="song-list-container"><div style="height:100px">Gần đây</div><div id="song-list" class="song-list"></div></div>');
    const cssRoot = classic ? 'old/assets/css' : 'assets/css';
    for (const name of classic ? ['base.css', 'layout.css'] : ['base.css', 'layout.css', 'library-polish.css']) {
      const file = path.join(root, cssRoot, name);
      if (fs.existsSync(file)) await page.addStyleTag({ path: file });
    }
    await page.addStyleTag({ content: '.song-list-container { position:fixed; top:20px; left:10px; width:300px; height:600px; padding:0; overflow:auto; }' });
    await page.evaluate(() => {
      const songs = Array.from({ length: 1731 }, (_, i) => ({
        id: `song-${i + 1}`, httlvnId: i + 1, title: i % 3 ? `Bài ${i + 1}` : `Bài ${i + 1} có tiêu đề dài cần giữ đầy đủ trong thuộc tính title`,
        defaultKey: 'G', theme: 'Đời tín đồ',
      }));
      window.ApiService = { songs: { list: async () => songs } };
      window.URLState = { resetForNewSong() {} };
    });
    await page.addScriptTag({ path: path.join(root, 'assets/js/library-gestures.js') });
    await page.addScriptTag({ path: path.join(root, classic ? 'old/assets/js/library-ui.js' : 'assets/js/library-ui.js') });
    await page.evaluate(() => LibraryUI.init());
    await expect(page.locator('.song-item').first()).toBeVisible();
    const geometry = () => page.evaluate(() => {
      const list = document.getElementById('song-list');
      const rows = [...list.querySelectorAll('.song-item')];
      const heights = rows.map(row => row.getBoundingClientRect().height);
      const gap = parseFloat(getComputedStyle(list).rowGap) || 0;
      return { height: list.getBoundingClientRect().height, expected: 1731 * (heights[0] + gap) - gap,
        distinctHeights: new Set(heights).size };
    });
    let sizes = await geometry();
    if (classic) expect(await page.locator('.song-item').first().evaluate(row => row.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
    expect(sizes.distinctHeights).toBe(1);
    expect(Math.abs(sizes.height - sizes.expected)).toBeLessThan(2);
    await page.evaluate(() => LibraryUI.selectSong('song-800'));
    const selectedInView = () => page.evaluate(() => {
      const active = document.querySelector('.song-item.active');
      const wrap = document.querySelector('.song-list-container').getBoundingClientRect();
      const row = active?.getBoundingClientRect();
      return !!row && active.dataset.id === 'song-800' && row.top >= wrap.top && row.bottom <= wrap.bottom;
    });
    await expect.poll(selectedInView).toBe(true);
    await page.setViewportSize({ width: 1180, height: 820 });
    await expect.poll(async () => { const current = await geometry(); return Math.abs(current.height - current.expected); }).toBeLessThan(2);
    await expect.poll(selectedInView).toBe(true);
    sizes = await geometry();
    expect(Math.abs(sizes.height - sizes.expected)).toBeLessThan(2);
    await page.screenshot({ path: path.join(root, `test-results/roadmap6-evidence/TV0-2-${classic ? 'classic' : 'modern'}.png`) });
  });
}
