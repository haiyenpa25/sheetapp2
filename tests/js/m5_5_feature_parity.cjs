const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '../..');
const modernSheetViewer = fs.readFileSync(path.join(root, 'includes/sheet_viewer.php'), 'utf8');
const classicSheetViewer = fs.readFileSync(path.join(root, 'old/includes/sheet_viewer.php'), 'utf8');
const modernKeyHandler = fs.readFileSync(path.join(root, 'assets/js/keyboard-handler.js'), 'utf8');
const classicKeyHandler = fs.readFileSync(path.join(root, 'old/assets/js/keyboard-handler.js'), 'utf8');
const libraryDataCode = fs.readFileSync(path.join(root, 'assets/js/core/LibraryData.js'), 'utf8');
const modernLibUiCode = fs.readFileSync(path.join(root, 'assets/js/library-ui.js'), 'utf8');
const classicLibUiCode = fs.readFileSync(path.join(root, 'old/assets/js/library-ui.js'), 'utf8');
const chordCoreCode = fs.readFileSync(path.join(root, 'assets/js/core/ChordCanvasCore.js'), 'utf8');
const modernChordEditCode = fs.readFileSync(path.join(root, 'assets/js/chord-canvas-edit.js'), 'utf8');
const modernChordCode = fs.readFileSync(path.join(root, 'assets/js/chord-canvas.js'), 'utf8');
const classicChordCode = fs.readFileSync(path.join(root, 'old/assets/js/chord-canvas.js'), 'utf8');

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
  // 1. Both UIs include #quick-pin-bar in sheet_viewer.php
  checkStatic(
    modernSheetViewer.includes('id="quick-pin-bar"') && classicSheetViewer.includes('id="quick-pin-bar"'),
    'M5-5: Both Modern and Classic sheet_viewer.php include #quick-pin-bar'
  );

  // 2. Both UIs bind keyboard shortcuts G (togglePin) and H (toggleHighlight)
  checkStatic(
    modernKeyHandler.includes('togglePin') &&
      classicKeyHandler.includes('togglePin') &&
      modernKeyHandler.includes('toggleHighlight') &&
      classicKeyHandler.includes('toggleHighlight'),
    'M5-5: Both Modern and Classic keyboard-handler.js support G (togglePin) and H (toggleHighlight)'
  );

  // 3. Behavioral VM parity: Song Pin (togglePin, isPinned, #quick-pin-bar) in both Modern and Classic LibraryUI
  for (const [uiName, libCode] of [['Modern', modernLibUiCode], ['Classic', classicLibUiCode]]) {
    const storage = {};
    const pinBarEl = {
      innerHTML: '', addEventListener() {},
      classList: {
        _set: new Set(['hidden']),
        add(c) { this._set.add(c); },
        remove(c) { this._set.delete(c); },
        toggle(c, f) {
          const on = f === undefined ? !this._set.has(c) : Boolean(f);
          if (on) this._set.add(c); else this._set.delete(c);
        },
        contains(c) { return this._set.has(c); },
      },
      querySelectorAll: () => [],
      querySelector: () => null,
    };
    const pinBtnEl = {
      innerHTML: '', addEventListener() {},
      classList: {
        _set: new Set(),
        toggle(c, f) {
          const on = f === undefined ? !this._set.has(c) : Boolean(f);
          if (on) this._set.add(c); else this._set.delete(c);
        },
        contains(c) { return this._set.has(c); },
      },
    };
    const listEl = {
      innerHTML: '', addEventListener() {},
      style: {},
      classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
      querySelector: () => null,
      querySelectorAll: () => [],
      closest: () => null,
      appendChild() {},
      addEventListener() {},
      getBoundingClientRect: () => ({ top: 0, height: 40 }),
    };

    const win = {
      innerWidth: 1024,
      location: { search: '', href: 'http://localhost/sheetapp2/' },
      history: { pushState() {} },
      getComputedStyle: () => ({ rowGap: '0' }),
      localStorage: {
        getItem: (k) => storage[k] ?? null,
        setItem: (k, v) => { storage[k] = String(v); },
      },
      ApiService: {
        songs: {
          list: async () => [
            { id: '1', httlvnId: 1, title: 'Thánh Ca 1', category: 'Thánh ca', category_id: 1, defaultKey: 'C' },
            { id: '2', httlvnId: 2, title: 'Thánh Ca 2', category: 'Thánh ca', category_id: 1, defaultKey: 'G' },
          ],
        },
      },
      LibraryGestures: { bind() {} },
      LibraryList: { bind() {}, restoreCursor: () => false },
      EventBus: { emit() {} },
      App: { showToast() {} },
      SafeHtml: { escape: (s) => String(s ?? '') },
      CSS: { escape: (s) => String(s) },
      URLSearchParams,
      URL,
      addEventListener() {},
      setTimeout,
      clearTimeout,
      requestAnimationFrame: (fn) => fn(),
    };
    const doc = {
      getElementById: (id) => {
        if (id === 'quick-pin-bar') return pinBarEl;
        if (id === 'btn-pin-current-song') return pinBtnEl;
        if (id === 'song-list') return listEl;
        return null;
      },
      querySelector: () => listEl,
      querySelectorAll: () => [],
      createDocumentFragment: () => ({ appendChild() {} }),
      createElement: () => ({
        style: {},
        dataset: {},
        classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
        appendChild() {},
      addEventListener() {},
        remove() {},
        getBoundingClientRect: () => ({ height: 26 }),
      }),
    };
    win.document = doc;
    win.window = win;

    const ctx = vm.createContext({
      ...win,
      window: win,
      document: doc,
      localStorage: win.localStorage,
      CSS: win.CSS,
      console,
    });

    vm.runInContext(libraryDataCode, ctx);
    ctx.LibraryData = win.LibraryData;
    vm.runInContext(libCode, ctx);

    win.LibraryUI.init();
    await win.LibraryUI.loadSongs();

    const hasPinMethods =
      typeof win.LibraryUI.togglePin === 'function' && typeof win.LibraryUI.isPinned === 'function';
    check(hasPinMethods, `M5-5 (${uiName}): LibraryUI exposes togglePin(songId) and isPinned(songId)`);

    if (hasPinMethods) {
      win.LibraryUI.togglePin('1');
      check(
        win.LibraryUI.isPinned('1') === true &&
          !pinBarEl.classList.contains('hidden') &&
          pinBarEl.innerHTML.includes('Thánh Ca 1'),
        `M5-5 (${uiName}): LibraryUI.togglePin('1') pins song 1 and renders #quick-pin-bar`
      );

      win.LibraryUI.togglePin('1');
      check(
        win.LibraryUI.isPinned('1') === false && pinBarEl.classList.contains('hidden'),
        `M5-5 (${uiName}): LibraryUI.togglePin('1') again unpins song 1 and hides #quick-pin-bar`
      );
    } else {
      check(false, `M5-5 (${uiName}): LibraryUI.togglePin('1') pins song 1 and renders #quick-pin-bar`);
      check(false, `M5-5 (${uiName}): LibraryUI.togglePin('1') again unpins song 1 and hides #quick-pin-bar`);
    }
  }

  // 4. Behavioral VM parity: Chord Highlight (toggleHighlight, setHighlightMode, isHighlightMode) in both Modern and Classic ChordCanvas
  for (const [uiName, chordCode] of [['Modern', modernChordCode], ['Classic', classicChordCode]]) {
    const storage = {};
    const hlBtn = {
      title: '',
      classList: {
        _set: new Set(),
        toggle(c, f) {
          const on = f === undefined ? !this._set.has(c) : Boolean(f);
          if (on) this._set.add(c); else this._set.delete(c);
        },
        contains(c) { return this._set.has(c); },
      },
      addEventListener() {},
    };
    const win = {
      localStorage: {
        getItem: (k) => storage[k] ?? null,
        setItem: (k, v) => { storage[k] = String(v); },
      },
      App: { showToast() {} },
      addEventListener() {},
    };
    const doc = {
      getElementById: (id) =>
        id === 'btn-chord-highlight' || id === 'btn-menu-chord-highlight' ? hlBtn : null,
      querySelectorAll: () => [],
      querySelector: () => null,
      addEventListener() {},
    };
    win.document = doc;
    win.window = win;

    const ctx = vm.createContext({
      window: win,
      document: doc,
      localStorage: win.localStorage,
      setTimeout() {},
      clearTimeout() {},
      requestAnimationFrame() {},
      console,
    });

    vm.runInContext(chordCoreCode, ctx);
    ctx.ChordCanvasCore = win.ChordCanvasCore;
    if (uiName === 'Modern') {
      vm.runInContext(modernChordEditCode, ctx);
    }
    vm.runInContext(chordCode, ctx);

    win.ChordCanvas.init();

    const hasHighlightApi =
      typeof win.ChordCanvas.toggleHighlight === 'function' &&
      typeof win.ChordCanvas.setHighlightMode === 'function' &&
      typeof win.ChordCanvas.isHighlightMode === 'function';
    check(
      hasHighlightApi,
      `M5-5 (${uiName}): ChordCanvas exposes toggleHighlight, setHighlightMode, and isHighlightMode`
    );

    if (hasHighlightApi) {
      win.ChordCanvas.toggleHighlight();
      const onAfterFirstToggle =
        win.ChordCanvas.isHighlightMode() === true &&
        storage['sheetapp_chord_highlight'] === 'true' &&
        hlBtn.classList.contains('active');
      win.ChordCanvas.toggleHighlight();
      const offAfterSecondToggle =
        win.ChordCanvas.isHighlightMode() === false &&
        storage['sheetapp_chord_highlight'] === 'false' &&
        !hlBtn.classList.contains('active');

      check(
        onAfterFirstToggle && offAfterSecondToggle,
        `M5-5 (${uiName}): ChordCanvas.toggleHighlight toggles highlight mode, persists state, and syncs button active class`
      );
    } else {
      check(
        false,
        `M5-5 (${uiName}): ChordCanvas.toggleHighlight toggles highlight mode, persists state, and syncs button active class`
      );
    }
  }

  console.log(`SUITE_COMPLETE total=${total} failed=${failed}`);
  process.exitCode = failed > 0 ? 1 : 0;
})();
