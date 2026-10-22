const fs = require('fs');
const vm = require('vm');
const path = require('path');

const root = path.resolve(__dirname, '../..');
let total = 0;
let failed = 0;

function check(ok, msg) {
  total++;
  if (!ok) failed++;
  console.log(`${ok ? '[PASS:B]' : '[FAIL:B]'} ${msg}`);
}

let currentSong = 'song-a';
const savedCalls = [];

const w = {
  App: {
    getCurrentSongId: () => currentSong,
    getCurrentTranspose: () => 0,
    showToast() {}
  },
  ApiService: {
    chordSets: {
      load: async (songId, setName) => {
        if (songId === 'song-a') {
          return { success: true, chords: [{ measureIdx: 0, noteIdx: 0, chord: 'Am' }] };
        }
        if (songId === 'song-b' && setName === 'HD') {
          return { success: true, chords: [{ measureIdx: 0, noteIdx: 0, chord: 'G' }] };
        }
        return { success: true, chords: [{ measureIdx: 0, noteIdx: 0, chord: 'F' }] };
      },
      save: async (songId, setName, chords) => {
        savedCalls.push({ songId, setName, chords });
        return { success: true };
      }
    }
  }
};

const ctx = vm.createContext({
  window: w,
  document: {
    getElementById: () => null,
    querySelectorAll: () => [],
    querySelector: () => null,
    addEventListener() {}
  },
  localStorage: { getItem: () => null, setItem() {} },
  setTimeout() {},
  clearTimeout() {},
  requestAnimationFrame() {},
  console
});

vm.runInContext(fs.readFileSync(path.join(root, 'old/assets/js/chord-canvas.js'), 'utf8'), ctx);

(async () => {
  // 1. Load song-a and edit a chord -> pushes song-a state onto _undoStack
  currentSong = 'song-a';
  await w.ChordCanvas.loadSong('song-a', 'HD');
  await w.ChordCanvas.saveChordWithoutReload(0, 1, 'Dm7');

  // 2. Load song-b -> must reset undo stack so undo() on song-b does not overwrite song-b with song-a chords
  currentSong = 'song-b';
  await w.ChordCanvas.loadSong('song-b', 'HD');
  savedCalls.length = 0;
  await w.ChordCanvas.undo();
  check(
    w.ChordCanvas.getCustomChords()['0_0'] === 'G' && savedCalls.length === 0,
    'Classic ChordCanvas.loadSong resets undo stack so undo() does not leak song-a chords onto song-b'
  );

  // 3. Edit song-b on HD, then switchSet('BH') -> undo() must not revert BH back to HD
  await w.ChordCanvas.saveChordWithoutReload(0, 1, 'D7');
  await w.ChordCanvas.switchSet('BH');
  savedCalls.length = 0;
  await w.ChordCanvas.undo();
  check(
    w.ChordCanvas.getCurrentSet() === 'BH' && w.ChordCanvas.getCustomChords()['0_0'] === 'F' && savedCalls.length === 0,
    'Classic ChordCanvas.switchSet resets undo stack so undo() does not revert set or chords'
  );

  console.log(`SUITE_COMPLETE total=${total} passed=${total - failed} failed=${failed}`);
  process.exitCode = failed ? 1 : 0;
})().catch(e => {
  console.error(e);
  process.exitCode = 1;
});
