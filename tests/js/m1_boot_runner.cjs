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

function createDomStub() {
  const listeners = {};
  return {
    readyState: 'complete',
    getElementById: () => null,
    querySelectorAll: () => [],
    querySelector: () => null,
    addEventListener(type, fn) {
      listeners[type] = listeners[type] || [];
      listeners[type].push(fn);
    },
    _trigger(type) {
      (listeners[type] || []).forEach(fn => fn());
    },
  };
}

function runInVm(file, win, doc) {
  const ctx = vm.createContext({
    window: win,
    document: doc,
    console: { log() {}, warn() {}, error() {} },
    setTimeout() { return 1; },
    clearTimeout() {},
    requestAnimationFrame() {},
    navigator: {},
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  });
  win.document = doc;
  win.window = win;
  const fullPath = path.join(root, file);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Missing file: ${file}`);
  }
  vm.runInContext(fs.readFileSync(fullPath, 'utf8'), ctx, { filename: file });
  return ctx;
}

(async () => {
  const bootRunnerFile = 'assets/js/core/BootRunner.js';
  const bootRunnerExists = fs.existsSync(path.join(root, bootRunnerFile));
  check(bootRunnerExists, 'BootRunner.js exists in assets/js/core/BootRunner.js');

  for (const prefix of ['assets/js/', 'old/assets/js/']) {
    const doc = createDomStub();
    const reportedErrors = [];
    const initOrder = [];
    const loadedSongs = [];
    let selectHandler = null;
    let onSelectBoundBeforeLibraryInit = false;

    const win = {
      ErrorReporter: {
        report(err) {
          reportedErrors.push(err);
        },
      },
      OSMDRenderer: {
        init() { initOrder.push('OSMDRenderer.init'); },
        onReady() {},
      },
      ChordCanvas: {
        init() {
          initOrder.push('ChordCanvas.init');
          throw new Error('Simulated ChordCanvas init crash');
        },
      },
      // Intentionally omit AnnotationCanvas / SheetAudioPlayer / AutoScroller on window
      // to verify app.js accesses modules safely via window.X without ReferenceError
      PageNav: {
        init() { initOrder.push('PageNav.init'); },
      },
      LibraryUI: {
        onSelect(fn) {
          selectHandler = fn;
          initOrder.push('LibraryUI.onSelect');
        },
        onDelete() {},
        init() {
          onSelectBoundBeforeLibraryInit = typeof selectHandler === 'function';
          initOrder.push('LibraryUI.init');
        },
      },
      ToolbarController: {
        init() { initOrder.push('ToolbarController.init'); },
      },
      KeyboardHandler: {
        init() { initOrder.push('KeyboardHandler.init'); },
      },
      SongLoader: {
        load(song) {
          loadedSongs.push(song);
          return Promise.resolve();
        },
      },
      Store: {
        get: () => null,
        set() {},
        reset() {},
      },
      AppUI: {
        showWelcome() {},
        showToast() {},
        enableControls() {},
      },
      EventBus: {
        emit() {},
      },
    };

    try {
      if (bootRunnerExists) {
        runInVm(bootRunnerFile, win, doc);
      }
      runInVm(prefix + 'app.js', win, doc);
      doc._trigger('DOMContentLoaded');
    } catch (err) {
      check(false, `${prefix}app.js threw uncaught error during boot: ${err.message}`);
    }

    check(onSelectBoundBeforeLibraryInit, `${prefix}app.js binds LibraryUI.onSelect BEFORE LibraryUI.init`);
    check(initOrder.includes('LibraryUI.init'), `${prefix}app.js continues to LibraryUI.init after ChordCanvas.init throws`);
    check(initOrder.includes('ToolbarController.init') && initOrder.includes('KeyboardHandler.init'), `${prefix}app.js initializes ToolbarController and KeyboardHandler after earlier failure`);
    check(reportedErrors.length >= 1, `${prefix}app.js reports module init failure to ErrorReporter`);

    if (typeof selectHandler === 'function') {
      selectHandler({ id: 'thanh-ca-001', title: 'Test Song' });
    }
    check(loadedSongs.length === 1 && loadedSongs[0].id === 'thanh-ca-001', `${prefix}app.js tapping a song still invokes SongLoader.load`);
  }

  console.log(`SUITE_COMPLETE total=${total}`);
  process.exitCode = failed ? 1 : 0;
})().catch(e => {
  console.error(e);
  process.exitCode = 1;
});
