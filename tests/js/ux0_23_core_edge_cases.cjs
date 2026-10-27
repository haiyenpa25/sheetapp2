/**
 * tests/js/ux0_23_core_edge_cases.cjs
 * UX0-23: Verify 5 edge-case fixes across core modules:
 * 1. ApiService keeps timeout timer active while awaiting res.text()/res.json() body stream.
 * 2. SafeStorage.set() on QuotaExceededError updates value read by SafeStorage.get() (never returns stale localStorage value).
 * 3. BootRunner.markReady() does not mark ready if critical module (LibraryUI) failed during safeInit.
 * 4. ScriptLoader.loadLiveSync() / ToolbarController lazy-load invokes LiveSync.init() and FollowLeader.init().
 * 5. Classic old/assets/js/osmd-renderer.js reload() sets isLoaded = true.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const root = path.resolve(__dirname, '../..');
let checks = 0;
function pass(msg) {
  checks++;
  console.log(`[PASS:B] ${msg}`);
}

(async () => {
  // 1. ApiService body streaming timeout
  {
    const apiSrc = fs.readFileSync(path.join(root, 'assets/js/core/ApiService.js'), 'utf8');
    let timerClearedBeforeBodyResolved = false;
    let bodyResolved = false;
    let activeTimers = new Set();
    let nextId = 1;

    const sandbox = {
      console,
      Promise,
      URLSearchParams,
      FormData: function FormData() {},
      AbortController,
      setTimeout: (fn, ms) => {
        const id = nextId++;
        activeTimers.add(id);
        return id;
      },
      clearTimeout: (id) => {
        if (!bodyResolved && activeTimers.has(id)) {
          timerClearedBeforeBodyResolved = true;
        }
        activeTimers.delete(id);
      },
      fetch: async () => ({
        ok: true,
        status: 200,
        json: async () => {
          await new Promise((r) => setImmediate(r));
          bodyResolved = true;
          return { ok: true };
        },
        text: async () => {
          await new Promise((r) => setImmediate(r));
          bodyResolved = true;
          return '<xml/>';
        },
      }),
      window: null,
      document: { querySelector: () => null },
    };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(apiSrc, sandbox);

    await sandbox.window.ApiService.fetchXml('storage/test.xml');
    assert.strictEqual(
      timerClearedBeforeBodyResolved,
      false,
      'ApiService must await res.text()/res.json() before finally clears the timeout timer'
    );
    pass('ApiService awaits res.text()/res.json() before clearing timeout timer in finally');
  }

  // 2. SafeStorage QuotaExceededError overwrite does not return stale localStorage value
  {
    const safeStorageSrc = fs.readFileSync(path.join(root, 'assets/js/core/SafeStorage.js'), 'utf8');
    const backing = new Map([['sheetapp_key', 'OLD_VALUE']]);
    let quotaExceeded = true;
    const mockLocalStorage = {
      getItem: (k) => (backing.has(k) ? backing.get(k) : null),
      setItem: (k, v) => {
        if (quotaExceeded) {
          const err = new Error('QuotaExceededError');
          err.name = 'QuotaExceededError';
          throw err;
        }
        backing.set(k, v);
      },
      removeItem: (k) => { backing.delete(k); },
    };
    const sandbox = { window: { localStorage: mockLocalStorage }, localStorage: mockLocalStorage };
    vm.createContext(sandbox);
    vm.runInContext(safeStorageSrc, sandbox);

    sandbox.window.SafeStorage.set('sheetapp_key', 'NEW_VALUE');
    const actual = sandbox.window.SafeStorage.get('sheetapp_key');
    assert.strictEqual(actual, 'NEW_VALUE', `Expected SafeStorage.get to return NEW_VALUE after QuotaExceededError, got ${actual}`);
    pass('SafeStorage.get returns updated _mem value (not stale localStorage value) when setItem throws QuotaExceededError');
  }

  // 3. BootRunner.markReady() does not set ready if critical module LibraryUI failed
  {
    const bootSrc = fs.readFileSync(path.join(root, 'assets/js/core/BootRunner.js'), 'utf8');
    const sandbox = {
      console: { error: () => {}, warn: () => {} },
      setTimeout: () => 1,
      clearTimeout: () => {},
      window: null,
      document: { getElementById: () => null, addEventListener: () => {} },
    };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(bootSrc, sandbox);

    sandbox.window.BootRunner.safeInit('LibraryUI', () => {
      throw new Error('LibraryUI critical failure');
    });
    sandbox.window.BootRunner.markReady();
    assert.strictEqual(
      sandbox.window.BootRunner.isReady(),
      false,
      'BootRunner.isReady() must remain false when critical module LibraryUI failed'
    );
    pass('BootRunner.markReady() keeps isReady() === false when critical module LibraryUI failed');
  }

  // 4. ScriptLoader.loadLiveSync initializes LiveSync and FollowLeader
  {
    const scriptLoaderSrc = fs.readFileSync(path.join(root, 'assets/js/core/ScriptLoader.js'), 'utf8');
    let liveSyncInited = false;
    let followLeaderInited = false;
    const sandbox = {
      console,
      Promise,
      setTimeout,
      document: {
        readyState: 'complete',
        addEventListener: () => {},
        querySelector: () => ({ getAttribute: () => './', dataset: { loaded: 'true' } }),
        createElement: () => ({}),
        head: { appendChild: () => {} },
      },
      window: null,
      LiveSync: { init: () => { liveSyncInited = true; } },
      FollowLeader: { init: () => { followLeaderInited = true; } },
    };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(scriptLoaderSrc, sandbox);

    await sandbox.window.ScriptLoader.loadLiveSync();
    assert.strictEqual(liveSyncInited, true, 'loadLiveSync must call LiveSync.init()');
    assert.strictEqual(followLeaderInited, true, 'loadLiveSync must call FollowLeader.init()');
    pass('ScriptLoader.loadLiveSync() initializes LiveSync.init() and FollowLeader.init()');
  }

  // 5. Classic old/assets/js/osmd-renderer.js reload() sets isLoaded = true
  {
    const classicOsmdSrc = fs.readFileSync(path.join(root, 'old/assets/js/osmd-renderer.js'), 'utf8');
    const renderCoreSrc = fs.readFileSync(path.join(root, 'assets/js/core/OSMDRenderCore.js'), 'utf8');
    const containerEl = {
      id: 'osmd-container',
      clientWidth: 800,
      style: { display: 'block', visibility: 'visible' },
      classList: { contains: () => false },
      closest: () => null,
      querySelectorAll: () => [],
      querySelector: () => null,
      addEventListener: () => {},
    };
    const sandbox = {
      console,
      Promise,
      setTimeout,
      clearTimeout,
      ResizeObserver: function () { return { observe: () => {} }; },
      DOMParser: function () {
        return {
          parseFromString: () => ({
            querySelector: () => null,
            querySelectorAll: () => [],
          }),
        };
      },
      XMLSerializer: function () {
        return { serializeToString: () => '<score-partwise/>' };
      },
      opensheetmusicdisplay: {
        OpenSheetMusicDisplay: function () {
          this.zoom = 1.0;
          this.Sheet = {};
          this.EngravingRules = {};
          this.load = async () => {};
          this.render = async () => {};
          this.setOptions = () => {};
        },
        TransposeCalculator: function () {},
      },
      document: {
        getElementById: (id) => (id === 'osmd-container' ? containerEl : null),
        querySelector: () => null,
        querySelectorAll: () => [],
      },
      window: null,
    };
    sandbox.window = sandbox;
    sandbox.window.innerWidth = 1024;
    sandbox.window.addEventListener = () => {};
    sandbox.window.getComputedStyle = () => ({ display: 'block', visibility: 'visible' });

    vm.createContext(sandbox);
    vm.runInContext(renderCoreSrc, sandbox);
    vm.runInContext(classicOsmdSrc, sandbox);

    sandbox.window.OSMDRenderer.init('osmd-container');
    assert.strictEqual(sandbox.window.OSMDRenderer.getIsLoaded(), false, 'Initially getIsLoaded() is false');
    await sandbox.window.OSMDRenderer.reload('<score-partwise/>', 0);
    assert.strictEqual(sandbox.window.OSMDRenderer.getIsLoaded(), true, 'After reload(), getIsLoaded() must be true');
    pass('Classic OSMDRenderer.reload() sets isLoaded = true after rendering');
  }

  console.log(`SUITE_COMPLETE total=${checks}`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
