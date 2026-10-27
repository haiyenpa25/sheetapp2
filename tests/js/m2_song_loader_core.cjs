const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '../..');
const apiServiceCode = fs.readFileSync(path.join(root, 'assets/js/core/ApiService.js'), 'utf8');
const songLoaderCoreCode = fs.readFileSync(path.join(root, 'assets/js/core/SongLoaderCore.js'), 'utf8');
const modernSongLoaderCode = fs.readFileSync(path.join(root, 'assets/js/song-loader.js'), 'utf8');
const classicSongLoaderCode = fs.readFileSync(path.join(root, 'old/assets/js/song-loader.js'), 'utf8');

let total = 0;
let failed = 0;

function check(condition, message, details = '') {
  total++;
  if (condition) {
    console.log(`[PASS:B] ${message}`);
  } else {
    failed++;
    console.log(`[FAIL:B] ${message}${details ? ' -> ' + details : ''}`);
  }
}

function createLoaderVm(loaderCode, customFetch, vaultXml = {}) {
  const state = {};
  const renderedXmls = [];
  const store = {
    get: (k) => state[k],
    set: (k, v) => { state[k] = v; },
    reset: () => {},
  };
  const win = {
    __APP_BASE__: '',
    innerWidth: 1024,
    getComputedStyle: () => ({ paddingLeft: '0', paddingRight: '0' }),
    Store: store,
    EventBus: { emit: () => {}, on: () => {} },
    OfflineVault: {
      saveXml: async (p, xml) => { vaultXml[p] = xml; },
      getXml: async (p) => vaultXml[p] || null,
    },
    OSMDRenderer: {
      setZoomSilent: () => {},
      load: async (xml, transpose) => {
        renderedXmls.push({ xml, transpose });
      },
      getInstance: () => ({}),
      getCompactMode: () => false,
    },
    AppUI: {
      showLoading: () => {},
      setLoadingText: () => {},
      enableControls: () => {},
      showOSMD: () => {},
      showWelcome: () => {},
      showToast: () => {},
      updateTransposeDisplay: () => {},
      updateSongInfo: () => {},
      updateCapoBadge: () => {},
      updateSessionPanel: () => {},
    },
    ChordCanvas: {
      loadSong: async () => {},
      resetSet: () => {},
      getCurrentSet: () => 'HD',
      getCustomChords: () => ({}),
      refreshSetDropdown: () => {},
    },
    AnnotationCanvas: { loadSong: () => {} },
    SheetAudioPlayer: { stop: () => {}, setup: () => {}, enableBtn: () => {} },
    PageNav: { reset: () => {}, computePages: () => {} },
    ChordSetNames: { describe: () => 'HD' },
    AbortController,
    setTimeout,
    clearTimeout,
  };
  const doc = {
    addEventListener: () => {},
    getElementById: () => ({
      classList: { add: () => {}, remove: () => {}, contains: () => true },
      removeAttribute: () => {},
      addEventListener: () => {},
      querySelector: () => null,
      clientWidth: 800,
      tagName: 'input',
      style: {},
    }),
    querySelector: () => ({
      clientWidth: 800,
      tagName: 'input',
      scrollHeight: 600,
      scrollTop: 0,
      style: {},
      classList: { remove: () => {} },
    }),
  };
  win.document = doc;
  win.window = win;

  const ctx = vm.createContext({
    window: win,
    document: doc,
    navigator: { onLine: true },
    localStorage: { getItem: () => null, setItem: () => {} },
    Store: store,
    EventBus: win.EventBus,
    OSMDRenderer: win.OSMDRenderer,
    AppUI: win.AppUI,
    ChordCanvas: win.ChordCanvas,
    AnnotationCanvas: win.AnnotationCanvas,
    SheetAudioPlayer: win.SheetAudioPlayer,
    PageNav: win.PageNav,
    AbortController,
    Response: typeof Response !== 'undefined' ? Response : class { constructor(b) { this._b = b; this.ok = true; } async text() { return this._b; } },
    URLSearchParams,
    setTimeout,
    clearTimeout,
    requestAnimationFrame: (fn) => fn(),
    fetch: customFetch,
    console,
  });

  vm.runInContext(apiServiceCode, ctx);
  win.ApiService.sessions.load = async () => ({});
  ctx.ApiService = win.ApiService;
  vm.runInContext(songLoaderCoreCode, ctx);
  ctx.SongLoaderCore = win.SongLoaderCore;
  vm.runInContext(loaderCode, ctx);

  return { win, ctx, state, renderedXmls };
}

(async () => {
  // 1. SongLoaderCore.loadXml exists and returns {xml, source: 'network'} and falls back to OfflineVault {xml, source: 'offline'}
  {
    const vault = { 'storage/Thanh ca/offline.xml': '<score-partwise>OFFLINE_XML</score-partwise>' };
    const { win } = createLoaderVm(
      modernSongLoaderCode,
      async (url) => {
        if (url.includes('offline.xml')) throw new Error('Network down');
        return {
          ok: true,
          status: 200,
          text: async () => '<score-partwise>NET_XML</score-partwise>',
          json: async () => ({}),
        };
      },
      vault
    );

    const hasLoadXml = typeof win.SongLoaderCore?.loadXml === 'function';
    check(hasLoadXml, 'M2-3: SongLoaderCore exposes loadXml(song, options) returning {xml, source}');

    if (hasLoadXml) {
      const netRes = await win.SongLoaderCore.loadXml({ id: 's1', xmlPath: 'storage/Thanh ca/online.xml' });
      check(
        netRes?.xml === '<score-partwise>NET_XML</score-partwise>' && netRes?.source === 'network',
        'M2-3: SongLoaderCore.loadXml returns {xml, source: "network"} on network success',
        `got ${JSON.stringify(netRes)}`
      );

      const offRes = await win.SongLoaderCore.loadXml({ id: 's2', xmlPath: 'storage/Thanh ca/offline.xml' });
      check(
        offRes?.xml === '<score-partwise>OFFLINE_XML</score-partwise>' && offRes?.source === 'offline',
        'M2-3: SongLoaderCore.loadXml falls back to OfflineVault and returns {xml, source: "offline"}',
        `got ${JSON.stringify(offRes)}`
      );
    } else {
      check(false, 'M2-3: SongLoaderCore.loadXml returns {xml, source: "network"} on network success');
      check(false, 'M2-3: SongLoaderCore.loadXml falls back to OfflineVault and returns {xml, source: "offline"}');
    }
  }

  // 2. Rapid switch A -> B in Modern UI: A resolves AFTER B -> only B is rendered, A is discarded and aborted
  for (const [uiName, loaderCode] of [['Modern', modernSongLoaderCode], ['Classic', classicSongLoaderCode]]) {
    let resolveA;
    let resolveB;
    let aSignalAborted = false;

    const { win, state, renderedXmls } = createLoaderVm(loaderCode, (url, opts = {}) => {
      if (url.includes('song-a.xml')) {
        if (opts.signal) {
          opts.signal.addEventListener('abort', () => { aSignalAborted = true; });
        }
        return new Promise((resolve) => {
          resolveA = () => resolve({
            ok: true,
            status: 200,
            text: async () => '<score-partwise>XML_A</score-partwise>',
          });
        });
      }
      if (url.includes('song-b.xml')) {
        return new Promise((resolve) => {
          resolveB = () => resolve({
            ok: true,
            status: 200,
            text: async () => '<score-partwise>XML_B</score-partwise>',
          });
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}), text: async () => '' });
    });

    const songA = { id: 'song-a', title: 'Bài A', xmlPath: 'storage/Thanh ca/song-a.xml' };
    const songB = { id: 'song-b', title: 'Bài B', xmlPath: 'storage/Thanh ca/song-b.xml' };

    const pA = win.SongLoader.load(songA);
    await new Promise((r) => setTimeout(r, 10));
    const pB = win.SongLoader.load(songB);
    await new Promise((r) => setTimeout(r, 10));

    // B arrives first!
    if (resolveB) resolveB();
    await pB;

    // A arrives late!
    if (resolveA) resolveA();
    await pA;

    check(
      aSignalAborted === true,
      `M2-3 (${uiName}): Switching A -> B aborts in-flight XML request for A`,
      `aSignalAborted=${aSignalAborted}`
    );
    check(
      renderedXmls.length === 1 && renderedXmls[0].xml === '<score-partwise>XML_B</score-partwise>',
      `M2-3 (${uiName}): Rapid switch A -> B renders ONLY song B; late XML A is ignored`,
      `rendered=${JSON.stringify(renderedXmls)}`
    );
    check(
      state.currentSong?.id === 'song-b' && state.originalXml === '<score-partwise>XML_B</score-partwise>',
      `M2-3 (${uiName}): Store retains song B metadata and XML after late A response`,
      `currentSong=${state.currentSong?.id}, originalXml=${state.originalXml}`
    );
  }

  console.log(`SUITE_COMPLETE total=${total}`);
  process.exitCode = failed === 0 ? 0 : 1;
})();
