const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '../..');
const songLoaderCoreCode = fs.readFileSync(path.join(root, 'assets/js/core/SongLoaderCore.js'), 'utf8');
const osmdRenderCoreCode = fs.readFileSync(path.join(root, 'assets/js/core/OSMDRenderCore.js'), 'utf8');
const classicSongLoaderCode = fs.readFileSync(path.join(root, 'old/assets/js/song-loader.js'), 'utf8');
const classicOsmdRendererCode = fs.readFileSync(path.join(root, 'old/assets/js/osmd-renderer.js'), 'utf8');

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
  // 1. Source delegation checks: Classic song-loader delegates to SongLoaderCore without duplicate inline fetch/OfflineVault fallback
  checkStatic(
    !classicSongLoaderCode.includes('window.OfflineVault?.getXml') &&
      !classicSongLoaderCode.includes('await fetch(xmlFetchUrl)') &&
      classicSongLoaderCode.includes('SongLoaderCore.beginLoad') &&
      classicSongLoaderCode.includes('SongLoaderCore.loadXml') &&
      classicSongLoaderCode.includes('SongLoaderCore.isCurrentToken'),
    'M5-2: old/assets/js/song-loader.js delegates token/abort/fetch/offline to SongLoaderCore without duplicate fetch fallback'
  );

  // 2. Source delegation checks: Classic osmd-renderer delegates render queue & resize to OSMDRenderCore
  checkStatic(
    classicOsmdRendererCode.includes('OSMDRenderCore.enqueueRender') &&
      classicOsmdRendererCode.includes('OSMDRenderCore.scheduleResize') &&
      classicOsmdRendererCode.includes('OSMDRenderCore.hasPendingRender') &&
      !classicOsmdRendererCode.includes('function _debounce('),
    'M5-2: old/assets/js/osmd-renderer.js delegates enqueueRender, scheduleResize, and pending state to OSMDRenderCore'
  );

  // 3. Behavioral VM check: Classic SongLoader routes through SongLoaderCore
  {
    const state = {};
    const rendered = [];
    let beginLoadCalls = 0;
    let loadXmlCalls = 0;
    const noop = () => {};

    const win = {
      innerWidth: 1024,
      Store: { set: (k, v) => { state[k] = v; }, get: (k) => state[k] },
      ApiService: {
        resolveUrl: (u) => u,
        fetchXml: async (url) => `<score-partwise>${url}</score-partwise>`,
        sessions: { load: async () => ({}) },
      },
      AppUI: new Proxy({}, { get: () => noop }),
      SheetAudioPlayer: new Proxy({}, { get: () => noop }),
      AnnotationCanvas: { loadSong: noop },
      PageNav: { reset: noop },
      EventBus: { emit: noop },
      OSMDRenderer: {
        load: async (xml, t) => { rendered.push({ xml, t }); },
        setZoomSilent: noop,
        getInstance: () => ({}),
        getCompactMode: () => false,
      },
      ChordCanvas: {
        loadSong: async () => {},
        resetSet: noop,
        getCurrentSet: () => 'HD',
        getCustomChords: () => ({}),
        refreshSetDropdown: noop,
      },
      OfflineVault: { saveXml: noop, getXml: async () => null },
      ChordSetNames: { describe: () => 'HD' },
      AbortController,
      setTimeout,
      clearTimeout,
    };
    const doc = {
      getElementById: () => ({
        classList: { add: noop, remove: noop, contains: () => true },
        removeAttribute: noop,
        style: {},
      }),
      querySelector: () => ({ clientWidth: 800, scrollHeight: 600, scrollTop: 0, style: {} }),
      querySelectorAll: () => [],
      addEventListener: noop,
    };
    win.document = doc;
    win.window = win;

    const ctx = vm.createContext({
      ...win,
      window: win,
      document: doc,
      console,
      requestAnimationFrame: (fn) => fn(),
    });

    vm.runInContext(songLoaderCoreCode, ctx);
    ctx.SongLoaderCore = win.SongLoaderCore;

    const origBeginLoad = win.SongLoaderCore.beginLoad;
    win.SongLoaderCore.beginLoad = function (...args) {
      beginLoadCalls++;
      return origBeginLoad.apply(this, args);
    };
    const origLoadXml = win.SongLoaderCore.loadXml;
    win.SongLoaderCore.loadXml = function (...args) {
      loadXmlCalls++;
      return origLoadXml.apply(this, args);
    };

    vm.runInContext(classicSongLoaderCode, ctx);

    await win.SongLoader.load({ id: '101', title: 'Bài 101', xmlPath: 'storage/101.xml' });

    check(
      beginLoadCalls === 1 && loadXmlCalls === 1 && rendered.length === 1 && rendered[0].xml.includes('storage/101.xml'),
      'M5-2: Classic SongLoader.load invokes SongLoaderCore.beginLoad and SongLoaderCore.loadXml',
      `beginLoadCalls=${beginLoadCalls}, loadXmlCalls=${loadXmlCalls}, rendered=${rendered.length}`
    );
  }

  // 4. Behavioral VM check: Classic OSMDRenderer routes load, reload, setZoom, renderPending, and resize through OSMDRenderCore
  {
    let enqueueCalls = 0;
    let scheduleResizeCalls = 0;
    let osmdRenderCalls = 0;
    let resizeObserverCb = null;

    const containerEl = {
      id: 'osmd-container',
      clientWidth: 800,
      innerHTML: '',
      classList: { contains: () => false },
      closest: () => null,
      style: { display: 'block', visibility: 'visible' },
      querySelector: () => ({
        style: {},
        getAttribute: () => '0 0 800 600',
        querySelectorAll: () => [],
      }),
      addEventListener: () => {},
    };

    class FakeResizeObserver {
      constructor(cb) {
        resizeObserverCb = cb;
      }
      observe() {}
      disconnect() {}
    }

    class FakeOSMD {
      constructor() {
        this.zoom = 1.0;
        this.rules = {};
        this.Sheet = { Transpose: 0, Instruments: [] };
      }
      async load() {}
      async render() {
        osmdRenderCalls++;
      }
      updateGraphic() {}
      setOptions() {}
    }

    const win = {
      innerWidth: 1024,
      getComputedStyle: (el) => el.style || { display: 'block', visibility: 'visible' },
      addEventListener: () => {},
      ResizeObserver: FakeResizeObserver,
      opensheetmusicdisplay: {
        OpenSheetMusicDisplay: FakeOSMD,
        TransposeCalculator: class {},
      },
      setTimeout,
      clearTimeout,
    };
    const doc = {
      getElementById: (id) => (id === 'osmd-container' ? containerEl : null),
    };
    win.document = doc;
    win.window = win;

    const ctx = vm.createContext({
      ...win,
      window: win,
      document: doc,
      ResizeObserver: FakeResizeObserver,
      opensheetmusicdisplay: win.opensheetmusicdisplay,
      console,
      Promise,
      Math,
    });

    vm.runInContext(osmdRenderCoreCode, ctx);
    ctx.OSMDRenderCore = win.OSMDRenderCore;

    const origEnqueue = win.OSMDRenderCore.enqueueRender;
    win.OSMDRenderCore.enqueueRender = function (...args) {
      enqueueCalls++;
      return origEnqueue.apply(this, args);
    };
    const origSchedule = win.OSMDRenderCore.scheduleResize;
    win.OSMDRenderCore.scheduleResize = function (cId, fn) {
      scheduleResizeCalls++;
      return origSchedule.call(this, cId, fn, 20);
    };

    vm.runInContext(classicOsmdRendererCode, ctx);

    win.OSMDRenderer.init('osmd-container');
    await win.OSMDRenderer.load('<score-partwise/>', 2);
    await win.OSMDRenderer.reload('<score-partwise/>', -1);
    await win.OSMDRenderer.setZoom(1.2);

    check(
      enqueueCalls === 3 && osmdRenderCalls === 3 && win.OSMDRenderer.getRenderCount() === 3,
      'M5-2: Classic OSMDRenderer.load, reload, and setZoom all route through OSMDRenderCore.enqueueRender',
      `enqueueCalls=${enqueueCalls}, osmdRenderCalls=${osmdRenderCalls}, renderCount=${win.OSMDRenderer.getRenderCount()}`
    );

    // Hidden container -> pending render via OSMDRenderCore -> renderPending() flushes via OSMDRenderCore
    containerEl.clientWidth = 0;
    await win.OSMDRenderer.load('<score-partwise/>', 0);
    const pendingWhenHidden = win.OSMDRenderer.hasPendingRender() && win.OSMDRenderCore.hasPendingRender();
    containerEl.clientWidth = 800;
    const flushed = await win.OSMDRenderer.renderPending();

    check(
      pendingWhenHidden && flushed === true && !win.OSMDRenderer.hasPendingRender() && enqueueCalls === 5,
      'M5-2: Classic OSMDRenderer shares pending render state with OSMDRenderCore and flushes via renderPending()',
      `pendingWhenHidden=${pendingWhenHidden}, flushed=${flushed}, enqueueCalls=${enqueueCalls}`
    );

    // ResizeObserver delegates to OSMDRenderCore.scheduleResize
    containerEl.clientWidth = 640;
    if (resizeObserverCb) resizeObserverCb();
    await new Promise((r) => setTimeout(r, 50));

    check(
      scheduleResizeCalls === 1 && osmdRenderCalls === 5,
      'M5-2: Classic OSMDRenderer ResizeObserver delegates to OSMDRenderCore.scheduleResize',
      `scheduleResizeCalls=${scheduleResizeCalls}, osmdRenderCalls=${osmdRenderCalls}`
    );
  }

  console.log(`SUITE_COMPLETE total=${total} failed=${failed}`);
  process.exitCode = failed > 0 ? 1 : 0;
})();
