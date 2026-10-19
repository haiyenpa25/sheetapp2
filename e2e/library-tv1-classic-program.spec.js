const { test, expect } = require('@playwright/test');
const path = require('path');
const root = path.resolve(__dirname, '..');
async function setup(page) {
  await page.setContent('<button id="btn-next-song">Sau</button><button id="btn-prev-song">Trước</button><button id="btn-play-setlist">Phát</button><div id="song-list"></div><div id="setlist-list"></div><div id="setlist-detail"><div id="setlist-items"></div></div>');
  await page.evaluate(() => {
    window.loads = []; window.tempos = []; window.selected = [];
    const songs = [{ id: 'one', title: 'Một', httlvnId: 1 }, { id: 'two', title: 'Hai', httlvnId: 2 }];
    const program = { id: 7, title: 'Chương trình', items: [{ song_id: 'one', chord_profile: 'HD', transpose_key: 0 }, { song_id: 'two', chord_profile: 'BH', transpose_key: 2, bpm: 88, beats_per_measure: 3 }] };
    window.ApiService = { songs: { list: async () => songs }, setlists: { list: async () => ({ success: true, data: [program] }), get: async () => ({ success: true, data: program }) } };
    window.URLState = { resetForNewSong() {}, update() {} };
    window.Metronome = { setBpmAndBeats: (bpm, beats) => window.tempos.push({ bpm, beats }) };
    window.App = { showToast() {}, showLoading() {}, hideLoading() {}, loadSongWithProfile: async (song, profile, transpose) => {
      await new Promise(resolve => setTimeout(resolve, 30));
      window.loads.push({ id: song.id, profile, transpose });
      Metronome.setBpmAndBeats(100, 4); // Song loading restores the original tempo first.
    } };
  });
  for (const file of ['assets/js/core/EventBus.js', 'assets/js/song-navigation.js', 'assets/js/library-gestures.js', 'old/assets/js/library-ui.js', 'old/assets/js/setlist-ui.js']) await page.addScriptTag({ path: path.join(root, file) });
  await page.evaluate(() => { SongNavigation.init(); LibraryUI.onSelect(song => window.selected.push(song.id)); LibraryUI.init(); });
  await expect.poll(() => page.evaluate(() => LibraryUI.getSongs().length)).toBe(2);
  await page.evaluate(async () => { LibraryUI.selectSong('one'); SetlistUI.init(); await SetlistUI.fetchSetlists(); });
  await page.locator('#setlist-list .song-item').click();
  await expect(page.locator('#setlist-items .song-item')).toHaveCount(2);
}
test('Classic browsing a program does not capture library navigation', async ({ page }) => {
  await setup(page);
  await page.locator('#btn-next-song').click();
  expect(await page.evaluate(() => window.selected)).toEqual(['one', 'two']);
  expect(await page.evaluate(() => window.loads)).toEqual([]);
});
test('Classic playing program loads exactly once and applies stored tempo after loading', async ({ page }) => {
  await setup(page);
  await page.locator('#btn-play-setlist').click();
  await expect.poll(() => page.evaluate(() => window.loads.length)).toBe(1);
  await page.locator('#btn-next-song').click();
  await expect.poll(() => page.evaluate(() => window.loads.length)).toBe(2);
  expect(await page.evaluate(() => window.loads[1])).toEqual({ id: 'two', profile: 'BH', transpose: 2 });
  expect(await page.evaluate(() => window.tempos.at(-1))).toEqual({ bpm: 88, beats: 3 });
  await page.evaluate(() => LibraryUI.selectSong('one'));
  expect(await page.evaluate(() => SetlistUI.getCurrentIndex())).toBe(-1);
});
test('Classic leaving a program during load does not restore its tempo or playing state', async ({ page }) => {
  await setup(page);
  await page.locator('#btn-play-setlist').click();
  await expect.poll(() => page.evaluate(() => window.loads.length)).toBe(1);
  await page.evaluate(() => {
    App.loadSongWithProfile = () => new Promise(resolve => { window.finishProgramLoad = resolve; });
    SetlistUI.next();
  });
  await expect.poll(() => page.evaluate(() => typeof window.finishProgramLoad)).toBe('function');
  await page.evaluate(async () => { LibraryUI.selectSong('one'); window.finishProgramLoad(); await Promise.resolve(); });
  expect(await page.evaluate(() => window.tempos.some(item => item.bpm === 88))).toBe(false);
  expect(await page.evaluate(() => SetlistUI.getCurrentIndex())).toBe(-1);
});
