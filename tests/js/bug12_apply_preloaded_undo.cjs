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

const w = {
  addEventListener() {},
  App: {
    getCurrentSongId: () => 'song-b',
    getCurrentTranspose: () => 0,
    showToast() {}
  },
  ApiService: {
    chordSets: {
      list: async () => ({ sets: ['HD'] }),
      load: async () => ({ success: true, chords: [] }),
      save: async () => ({ success: true }),
      clearCache() {}
    }
  }
};

let popupClosed = false;
const ctx = vm.createContext({
  window: w,
  document: {
    getElementById: () => null,
    querySelectorAll: () => [],
    querySelector: () => null,
    createElement: () => ({ style: {}, classList: { add() {}, remove() {}, contains: () => false }, setAttribute() {}, appendChild() {}, remove() {}, querySelector: () => null }),
    body: { appendChild() {}, contains: () => true },
    addEventListener() {}
  },
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  setTimeout() {},
  clearTimeout() {},
  requestAnimationFrame() {},
  console
});

vm.runInContext(fs.readFileSync(path.join(root, 'assets/js/chord-canvas-edit.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'assets/js/chord-canvas.js'), 'utf8'), ctx);

(async () => {
  w.ChordCanvas.init();
  const origClosePopup = w.ChordCanvasEdit.closePopup;
  w.ChordCanvasEdit.closePopup = function (rebuild) {
    popupClosed = true;
    return origClosePopup.call(this, rebuild);
  };

  // Simulate editing Song A so undo stack has Song A's chords
  w.ChordCanvas.setCustomChords({ '0_0': 'Am7' });
  await w.ChordCanvasEdit.saveChord(0, 1, 'G7', false);

  // Switch to Song B via applyPreloaded
  popupClosed = false;
  w.ChordCanvas.applyPreloaded('HD', { '0_0': 'C' }, 'chk-b');
  check(popupClosed === true, 'applyPreloaded closes any active ChordCanvasEdit popup');

  // Press Undo on Song B: must NOT restore Song A's chords onto Song B
  await w.ChordCanvas.undo();
  check(w.ChordCanvas.getCustomChords()['0_0'] === 'C', 'Undo after applyPreloaded does not leak previous song chords');

  console.log(`SUITE_COMPLETE total=${total} passed=${total - failed} failed=${failed}`);
  process.exitCode = failed ? 1 : 0;
})().catch(e => {
  console.error(e);
  process.exitCode = 1;
});
