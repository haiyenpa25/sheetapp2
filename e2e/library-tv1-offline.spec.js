const { test, expect } = require('@playwright/test');
const path = require('path');
test('Offline lyric mode searches cached lyrics without title or catalog-number matches', async ({ page }) => {
  await page.setContent('<div></div>');
  await page.addScriptTag({ path: path.resolve(__dirname, '../assets/js/core/OfflineVault.js') });
  const result = await page.evaluate(() => {
    const songs = [{ id: 'title', title: 'Yêu thương thế gian', httlvnId: 259 },
      { id: 'lyric', title: 'Vì Chúa', lyrics_text: 'Chúa yêu thương thế gian' },
      { id: 'snippet', title: 'Ơn Chúa', lyricSnippet: 'Ngài yêu thương thế gian' }];
    return { words: OfflineVault.searchSongs(songs, 'yeu thuong the gian', 'lyric').map(s => s.id),
      number: OfflineVault.searchSongs(songs, '259', 'lyric').map(s => s.id) };
  });
  expect(result.words).toEqual(['lyric', 'snippet']);
  expect(result.number).toEqual([]);
});
