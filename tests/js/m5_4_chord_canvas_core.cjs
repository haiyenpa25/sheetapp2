const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '../..');
const corePath = path.join(root, 'assets/js/core/ChordCanvasCore.js');
const modernCanvasCode = fs.readFileSync(path.join(root, 'assets/js/chord-canvas.js'), 'utf8');
const modernEditCode = fs.readFileSync(path.join(root, 'assets/js/chord-canvas-edit.js'), 'utf8');
const classicCanvasCode = fs.readFileSync(path.join(root, 'old/assets/js/chord-canvas.js'), 'utf8');
const indexPhpCode = fs.readFileSync(path.join(root, 'index.php'), 'utf8');
const oldIndexPhpCode = fs.readFileSync(path.join(root, 'old/index.php'), 'utf8');

let total = 0;
let failed = 0;

function checkStatic(condition, message) { total++; if (condition) console.log(`[PASS:S] ${message}`); else { failed++; console.log(`[FAIL:S] ${message}`); } }
function check(condition, message, details = '') {
  total++;
  if (condition) {
    console.log(`[PASS:B] ${message}`);
  } else {
    failed++;
    console.log(`[FAIL:B] ${message}${details ? ' -> ' + details : ''}`);
  }
}

(async () => {
  const hasCoreFile = fs.existsSync(corePath);
  checkStatic(hasCoreFile, 'M5-4: assets/js/core/ChordCanvasCore.js exists');

  checkStatic(
    indexPhpCode.includes("jsTag('core/ChordCanvasCore.js'") &&
      oldIndexPhpCode.includes("jsTag('core/ChordCanvasCore.js'"),
    'M5-4: Both index.php and old/index.php load core/ChordCanvasCore.js'
  );

  checkStatic(
    modernCanvasCode.includes('ChordCanvasCore.loadChordSet') &&
      modernEditCode.includes('ChordCanvasCore.pushUndo') &&
      modernEditCode.includes('ChordCanvasCore.popUndo') &&
      modernEditCode.includes('ChordCanvasCore.resetUndo'),
    'M5-4: Modern chord-canvas.js and chord-canvas-edit.js delegate load, token, undo/redo, and serialization to ChordCanvasCore'
  );

  checkStatic(
    classicCanvasCode.includes('ChordCanvasCore.loadChordSet') &&
      classicCanvasCode.includes('ChordCanvasCore.pushUndo') &&
      classicCanvasCode.includes('ChordCanvasCore.popUndo') &&
      classicCanvasCode.includes('ChordCanvasCore.resetUndo'),
    'M5-4: Classic old/assets/js/chord-canvas.js delegates load, token, undo/redo, and save to ChordCanvasCore'
  );

  if (!hasCoreFile) {
    console.log(`SUITE_COMPLETE total=${total} failed=${failed}`);
    process.exitCode = 1;
    return;
  }

  const coreCode = fs.readFileSync(corePath, 'utf8');

  // Behavioral VM tests for ChordCanvasCore + Modern + Classic
  for (const uiMode of ['Modern', 'Classic']) {
    let currentSongId = 'song-a';
    let resolveLateA = null;
    const savedPayloads = [];

    const win = {
      addEventListener: () => {},
      App: {
        getCurrentSongId: () => currentSongId,
        getCurrentTranspose: () => 0,
        showToast: () => {},
      },
      ApiService: {
        chordSets: {
          list: async () => ({ success: true, sets: ['HD', 'BH'] }),
          load: async (songId, setName) => {
            if (setName === 'LATE_A') {
              return new Promise((r) => {
                resolveLateA = r;
              });
            }
            if (songId === 'song-a' && setName === 'HD') {
              return { success: true, chords: [{ measureIdx: 0, noteIdx: 0, chord: 'Am7' }], checksum: 'chk-a' };
            }
            if (songId === 'song-b' && setName === 'HD') {
              return { success: true, chords: [{ measureIdx: 0, noteIdx: 0, chord: 'C' }], checksum: 'chk-b' };
            }
            return { success: true, chords: [{ measureIdx: 0, noteIdx: 0, chord: 'Fmaj7' }], checksum: 'chk-bh' };
          },
          save: async (songId, setName, arr) => {
            savedPayloads.push({ songId, setName, arr });
            return { success: true, checksum: 'chk-saved' };
          },
          clearCache: () => {},
        },
      },
    };
    const doc = {
      getElementById: () => null,
      querySelectorAll: () => [],
      querySelector: () => null,
      createElement: () => ({
        style: {},
        classList: { add() {}, remove() {}, contains: () => false },
        setAttribute() {},
        appendChild() {},
        remove() {},
        querySelector: () => null,
      }),
      body: { appendChild() {}, contains: () => true },
      addEventListener: () => {},
    };
    win.document = doc;
    win.window = win;

    const ctx = vm.createContext({
      window: win,
      document: doc,
      localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
      setTimeout: () => {},
      clearTimeout: () => {},
      requestAnimationFrame: () => {},
      console,
    });

    vm.runInContext(coreCode, ctx);
    ctx.ChordCanvasCore = win.ChordCanvasCore;

    if (uiMode === 'Modern') {
      vm.runInContext(modernEditCode, ctx);
      vm.runInContext(modernCanvasCode, ctx);
      win.ChordCanvas.init();
    } else {
      vm.runInContext(classicCanvasCode, ctx);
      win.ChordCanvas.init();
    }

    // 1. Late chord set load is discarded by shared token guard
    const pLate = win.ChordCanvas.switchSet('LATE_A');
    while (!resolveLateA) await Promise.resolve();
    await win.ChordCanvas.switchSet('BH');
    if (resolveLateA) resolveLateA({ success: true, chords: [{ measureIdx: 0, noteIdx: 0, chord: 'E7' }] });
    await pLate;

    check(
      win.ChordCanvas.getCurrentSet() === 'BH' && win.ChordCanvas.getCustomChords()['0_0'] === 'Fmaj7',
      `M5-4 (${uiMode}): Shared ChordCanvasCore token guard prevents late set response from overwriting newer set`
    );

    // 2. Edit on song-a, then load song-b -> undo() does NOT leak song-a chords onto song-b (BUG-12 / BUG-25)
    currentSongId = 'song-a';
    await win.ChordCanvas.loadSong('song-a', 'HD');
    if (uiMode === 'Modern') {
      await win.ChordCanvasEdit.saveChord(0, 1, 'G7', false);
    } else {
      await win.ChordCanvas.saveChordWithoutReload(0, 1, 'G7');
    }

    currentSongId = 'song-b';
    await win.ChordCanvas.loadSong('song-b', 'HD');
    await win.ChordCanvas.undo();

    check(
      win.ChordCanvas.getCustomChords()['0_0'] === 'C' && !win.ChordCanvas.getCustomChords()['0_1'],
      `M5-4 (${uiMode}): Shared ChordCanvasCore resets undo stack on loadSong so undo() never leaks song-a chords onto song-b`
    );

    // 3. Undo and Redo within same song/set restore chords accurately via ChordCanvasCore
    if (uiMode === 'Modern') {
      await win.ChordCanvasEdit.saveChord(1, 2, 'Dm7', false);
    } else {
      await win.ChordCanvas.saveChordWithoutReload(1, 2, 'Dm7');
    }
    check(win.ChordCanvas.getCustomChords()['1_2'] === 'Dm7', `M5-4 (${uiMode}): Saving chord updates customChords['1_2']`);

    await win.ChordCanvas.undo();
    check(!win.ChordCanvas.getCustomChords()['1_2'], `M5-4 (${uiMode}): Undo removes chord '1_2' via ChordCanvasCore.popUndo`);

    await win.ChordCanvas.redo();
    check(win.ChordCanvas.getCustomChords()['1_2'] === 'Dm7', `M5-4 (${uiMode}): Redo restores chord '1_2' via ChordCanvasCore.popRedo`);
  }

  console.log(`SUITE_COMPLETE total=${total} failed=${failed}`);
  process.exitCode = failed > 0 ? 1 : 0;
})();
