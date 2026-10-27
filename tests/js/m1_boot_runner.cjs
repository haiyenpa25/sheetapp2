const fs = require('fs');
const vm = require('vm');
const path = require('path');

const root = path.resolve(__dirname, '../..');
let total = 0;
let failed = 0;

function checkStatic(ok, msg) { total++; if (!ok) failed++; console.log(`${ok ? '[PASS:S]' : '[FAIL:S]'} ${msg}`); }
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
      LeaderNotesBanner: { init() { initOrder.push('LeaderNotesBanner.init'); } },
      LiturgyCard: { init() { initOrder.push('LiturgyCard.init'); } },
      LiveSync: { init() { initOrder.push('LiveSync.init'); } },
      FollowLeader: { init() { initOrder.push('FollowLeader.init'); } },
      FAB: { init() { initOrder.push('FAB.init'); } },
      AdminUI: { init() { initOrder.push('AdminUI.init'); } },
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

    if (prefix === 'assets/js/') {
      const m13Modules = ['LeaderNotesBanner.init', 'LiturgyCard.init', 'LiveSync.init', 'FollowLeader.init', 'FAB.init', 'AdminUI.init'];
      const indices = m13Modules.map(m => initOrder.indexOf(m));
      const allCalled = indices.every(idx => idx !== -1);
      const strictlyOrdered = allCalled && indices.every((val, i) => i === 0 || val > indices[i - 1]);
      check(strictlyOrdered, 'M1-3: Modern app.js initializes all 6 consolidated modules via BootRunner in exact preserved order');
    }
  }

  // M1-3 grep check: in assets/js/*.js, only app.js registers DOMContentLoaded
  const jsDir = path.join(root, 'assets/js');
  const dclFiles = fs.readdirSync(jsDir)
    .filter(f => f.endsWith('.js'))
    .filter(f => fs.readFileSync(path.join(jsDir, f), 'utf8').includes('DOMContentLoaded'));
  checkStatic(
    dclFiles.length === 1 && dclFiles[0] === 'app.js',
    `M1-3: app.js is the only top-level assets/js/*.js file with DOMContentLoaded (found: ${dclFiles.join(', ')})`
  );

  console.log(`SUITE_COMPLETE total=${total}`);
  process.exitCode = failed ? 1 : 0;
})().catch(e => {
  console.error(e);
  process.exitCode = 1;
});
