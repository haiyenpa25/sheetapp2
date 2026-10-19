const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
for (const classic of [false, true]) {
  test(`${classic ? 'Classic' : 'Modern'} prev/next follows the displayed order and gives playing setlists priority`, async ({ page }) => {
    await page.setContent('<button id="btn-prev-song">Trước</button><button id="btn-next-song">Sau</button><div id="song-list"></div>');
    await page.evaluate(() => {
      Object.defineProperty(document, 'readyState', { configurable: true, value: 'loading' });
      window.fixtureSongs = [
        { id: 'tc-1', title: 'TC 1', httlvnId: 1, category_id: 1 },
        { id: 'tc-2', title: 'TC 2', httlvnId: 2, category_id: 1 },
        { id: 'tc-903', title: 'TC 903', httlvnId: 903, category_id: 1 },
        { id: 'tv-1', title: 'TV 1', httlvnId: 1, category_id: 2 },
        { id: 'tv-2', title: 'TV 2', httlvnId: 2, category_id: 2 },
      ];
      window.ApiService = { songs: { list: async () => window.fixtureSongs.map(song => ({ ...song })) } };
      window.URLState = { resetForNewSong() {}, update() {} };
      window.AppUI = { showToast() {} };
      window.selected = []; window.profileLoads = []; window.tempos = [];
      window.SongLoader = { load: async (song, transpose, profile) => { window.profileLoads.push({ id: song.id, transpose, profile }); } };
      window.Metronome = { setBpmAndBeats: (bpm, beats) => window.tempos.push({ bpm, beats }) };
    });
    const ui = classic ? 'old/assets/js/' : 'assets/js/';
    for (const file of ['assets/js/core/EventBus.js', 'assets/js/core/Store.js', 'assets/js/song-navigation.js', 'assets/js/library-gestures.js', ui + 'library-ui.js', ui + 'app.js', 'assets/js/setlist-player.js']) {
      if (fs.existsSync(path.join(root, file))) await page.addScriptTag({ path: path.join(root, file) });
    }
    await page.evaluate(() => {
      window.SongNavigation?.init();
      LibraryUI.onSelect(song => { window.selected.push(song.id); Store.set('currentSong', song); });
      LibraryUI.init();
    });
    await expect.poll(() => page.evaluate(() => LibraryUI.getSongs().length)).toBe(5);
    await page.evaluate(() => { LibraryUI.render([window.fixtureSongs[0], window.fixtureSongs[2]]); LibraryUI.selectSong('tc-1'); });
    await page.locator('#btn-next-song').click();
    expect(await page.evaluate(() => window.selected)).toEqual(['tc-1', 'tc-903']);
    await page.evaluate(() => App.navigateNext());
    expect(await page.evaluate(() => window.selected)).toEqual(['tc-1', 'tc-903']);
    await page.evaluate(() => App.navigatePrev());
    expect(await page.evaluate(() => window.selected.at(-1))).toBe('tc-1');
    await page.evaluate(() => { LibraryUI.render([window.fixtureSongs[4], window.fixtureSongs[1]]); LibraryUI.selectSong('tv-2'); App.navigateNext(); });
    expect(await page.evaluate(() => window.selected.at(-1))).toBe('tc-2');
    await page.evaluate(() => {
      window.program = { items: [{ song_id: 'tc-903', chord_profile: 'HD', transpose_key: 0 }, { song_id: 'tv-1', chord_profile: 'BH', transpose_key: 2, bpm: 88, beats_per_measure: 3 }] };
      window.programIndex = 0;
      const context = { getCurrentSetlist: () => window.program, getCurrentIndex: () => window.programIndex,
        setCurrentIndex: value => { window.programIndex = value; }, setCurrentSetlist: value => { window.program = value; },
        getAllSongsCache: () => window.fixtureSongs };
      window.SetlistUI = context;
      SetlistPlayer.setContext(context);
      SetlistPlayer.bindPlayerEvents();
    });
    await page.locator('#btn-next-song').click();
    await expect.poll(() => page.evaluate(() => window.profileLoads)).toEqual([{ id: 'tv-1', transpose: 2, profile: 'BH' }]);
    expect(await page.evaluate(() => window.tempos)).toEqual([{ bpm: 88, beats: 3 }]);
    await page.evaluate(() => LibraryUI.selectSong('tc-1'));
    expect(await page.evaluate(() => window.programIndex)).toBe(-1);
    await page.evaluate(() => { LibraryUI.render([]); App.navigateNext(); App.navigatePrev(); });
    expect(await page.evaluate(() => window.selected.at(-1))).toBe('tc-1');
  });
}
