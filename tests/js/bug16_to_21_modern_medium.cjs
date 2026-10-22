/**
 * tests/js/bug16_to_21_modern_medium.cjs
 * Behavioral VM tests for Modern Frontend Medium bugs (BUG-16..BUG-21).
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '../..');
let passed = 0;
let failed = 0;

function check(cond, label) {
  if (cond) {
    console.log(`[PASS:B] ${label}`);
    passed++;
  } else {
    console.log(`[FAIL:B] ${label}`);
    failed++;
  }
}

(async () => {
  // ── 1. BUG-16: SetlistDetail "Lưu Tập" only for currently open song ──
  {
    const elements = new Map();
    const makeEl = (tag = 'div') => {
      const listeners = {};
      const children = [];
      let _html = '';
      const el = {
        tagName: tag.toUpperCase(),
        className: '',
        style: {},
        disabled: false,
        textContent: '',
        children,
        get innerHTML() { return _html; },
        set innerHTML(v) {
          _html = String(v || '');
          children.length = 0;
        },
        appendChild(c) { children.push(c); return c; },
        addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
        querySelector(sel) {
          if (sel === '.btn-save-bpm') {
            if (!_html.includes('btn-save-bpm')) return null;
            if (!el._saveBtn) {
              el._saveBtn = makeEl('button');
            }
            return el._saveBtn;
          }
          return makeEl('button');
        },
        _trigger(type, ev = {}) {
          (listeners[type] || []).forEach(fn => fn(ev));
        }
      };
      return el;
    };
    const itemsEl = makeEl('div');
    elements.set('setlist-items', itemsEl);

    const updateCalls = [];
    const sandbox = {
      console,
      setTimeout,
      clearTimeout,
      document: {
        getElementById: (id) => elements.get(id) || null,
        createElement: (tag) => makeEl(tag)
      },
      window: null
    };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(path.join(root, 'assets/js/core/SafeHtml.js'), 'utf8'), sandbox);

    sandbox.App = {
      getCurrentSongId: () => 'song-a',
      showToast: () => {}
    };
    sandbox.Store = {
      get: (k) => (k === 'currentTranspose' ? 2 : (k === 'currentSong' ? { id: 'song-a' } : null))
    };
    sandbox.Metronome = { getBpm: () => 96, getBeatsPerMeasure: () => 4 };
    sandbox.ChordCanvas = { getCurrentSet: () => 'HD' };
    sandbox.ApiService = {
      setlists: {
        updateItem: async (itemId, payload) => {
          updateCalls.push({ itemId, payload });
          return { success: true };
        }
      }
    };

    vm.runInContext(fs.readFileSync(path.join(root, 'assets/js/setlist-detail.js'), 'utf8'), sandbox);
    sandbox.SetlistDetail.setContext({
      getCurrentSetlist: () => ({
        id: 1,
        title: 'Lễ Chúa Nhật',
        items: [
          { id: 101, item_type: 'song', song_id: 'song-a', bpm: 80, transpose_key: 0, chord_profile: 'HD' },
          { id: 102, item_type: 'song', song_id: 'song-b', bpm: 72, transpose_key: 0, chord_profile: 'HD' }
        ]
      }),
      getCurrentIndex: () => 0,
      getAllSongsCache: () => [
        { id: 'song-a', title: 'Bài A', defaultKey: 'C' },
        { id: 'song-b', title: 'Bài B', defaultKey: 'G' }
      ]
    });

    await sandbox.SetlistDetail.renderSetlistItems();
    // Row 0 is summaryEl, Row 1 is song-a, Row 2 is song-b
    const rowA = itemsEl.children[1];
    const rowB = itemsEl.children[2];
    const hasBtnOnRowB = rowB && rowB.innerHTML.includes('btn-save-bpm');
    if (rowB && rowB._saveBtn) {
      rowB._saveBtn._trigger('click', { stopPropagation() {} });
    }
    await new Promise(r => setTimeout(r, 10));
    check(!hasBtnOnRowB && updateCalls.length === 0, 'BUG-16: Dòng bài hát không phải bài đang mở không hiển thị/cho bấm nút Lưu Tập');
  }

  // ── 2. BUG-17: SongInfoBar escapes <beats> and <beat-type> ──
  {
    const innerEl = { innerHTML: '', classList: { toggle: () => false } };
    const sandbox = {
      console,
      DOMParser: class {
        parseFromString() {
          return {
            querySelector(sel) {
              if (sel === 'time') {
                return {
                  querySelector(sub) {
                    if (sub === 'beats') return { textContent: '4"><img src=x onerror=alert(1)>' };
                    if (sub === 'beat-type') return { textContent: '4<script>alert(2)</script>' };
                    return null;
                  }
                };
              }
              return null;
            },
            querySelectorAll() { return []; }
          };
        }
      },
      document: {
        getElementById: (id) => (id === 'si-inner' ? innerEl : null),
        querySelector: () => null,
        addEventListener: () => {}
      },
      window: null
    };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(path.join(root, 'assets/js/core/SafeHtml.js'), 'utf8'), sandbox);
    vm.runInContext(fs.readFileSync(path.join(root, 'assets/js/song-info-bar.js'), 'utf8'), sandbox);

    sandbox.SongInfoBar.loadSong('<score-partwise/>', { id: '001', title: 'Test' });
    check(
      !innerEl.innerHTML.includes('<img') && !innerEl.innerHTML.includes('<script>') && innerEl.innerHTML.includes('&lt;img'),
      'BUG-17: SongInfoBar escape an toàn timeBeats và timeBeatType từ MusicXML'
    );
  }

  // ── 3. BUG-18: GuitarLens escapes displayName & title attribute ──
  {
    const paletteEl = { innerHTML: '' };
    const sandbox = {
      console,
      document: {
        getElementById: (id) => (id === 'guitar-chord-palette' ? paletteEl : null),
        querySelectorAll: () => []
      },
      window: null
    };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(path.join(root, 'assets/js/core/SafeHtml.js'), 'utf8'), sandbox);
    sandbox.ChordCanvas = {
      getCustomChords: () => ({ '0_0': 'C"><img src=x onerror=1>' })
    };
    vm.runInContext(fs.readFileSync(path.join(root, 'assets/js/guitar-lens.js'), 'utf8'), sandbox);

    const svgOut = sandbox.GuitarLens.renderChordSvg('C"><img src=x onerror=1>');
    sandbox.GuitarLens.refreshPalette();
    check(
      !svgOut.includes('<img') && !paletteEl.innerHTML.includes('<img') && svgOut.includes('&lt;img'),
      'BUG-18: GuitarLens escape an toàn tên hợp âm trong SVG và thuộc tính title của palette'
    );
  }

  // ── 4. BUG-19: SongLoader preserves transpose changed during in-flight load ──
  {
    let resolveXml;
    const osmdLoads = [];
    const osmdReloads = [];
    const storeState = new Map([['currentTranspose', 0], ['currentZoom', 1]]);

    const sandbox = {
      console,
      setTimeout,
      clearTimeout,
      requestAnimationFrame: (fn) => fn(),
      AbortController: class { constructor() { this.signal = {}; } abort() {} },
      Response: class { constructor(body) { this._body = body; this.ok = true; } async text() { return this._body; } },
      fetch: () => new Promise(res => { resolveXml = res; }),
      localStorage: { getItem: () => null, setItem: () => {} },
      getComputedStyle: () => ({ paddingLeft: '0', paddingRight: '0' }),
      innerWidth: 1280,
      document: {
        getElementById: () => ({ tagName: 'INPUT', classList: { remove() {}, add() {}, contains: () => true }, style: {}, removeAttribute() {}, addEventListener() {} }),
        querySelector: () => ({ clientWidth: 900, scrollHeight: 500, scrollTop: 0, style: {}, scrollTo() {} }),
        querySelectorAll: () => [],
        addEventListener: () => {}
      },
      Store: {
        get: (k) => storeState.get(k),
        set: (k, v) => storeState.set(k, v)
      },
      EventBus: { emit: () => {} },
      AppUI: {
        showToast: () => {},
        showLoading: () => {},
        hideLoading: () => {},
        setLoadingText: () => {},
        enableControls: () => {},
        updateCapoBadge: () => {},
        updateTransposeDisplay: () => {},
        updateSongInfo: () => {},
        updateSessionPanel: () => {},
        showOSMD: () => {},
        showWelcome: () => {}
      },
      SongInfoBar: { loadSong: () => {}, getSongKey: () => 'C' },
      ChordSetNames: { describe: () => 'HD' },
      Auth: { describe: () => null },
      SessionTracker: { describe: () => null, load: () => {} },
      OSMDRenderer: {
        setZoomSilent: () => {},
        load: async (xml, t) => { osmdLoads.push(t); },
        reload: async (xml, t) => { osmdReloads.push(t); },
        transpose: async (t) => { osmdReloads.push(t); },
        getInstance: () => ({}),
        getIsLoaded: () => true,
        getCurrentXml: () => '<xml/>'
      },
      ChordCanvas: {
        loadSong: async () => {},
        getCurrentSet: () => 'HD',
        getCustomChords: () => ({}),
        build: () => {}
      },
      ApiService: {
        resolveUrl: (u) => u,
        sessions: { load: async () => ({}) }
      },
      window: null
    };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(path.join(root, 'assets/js/song-loader.js'), 'utf8'), sandbox);

    const loadPromise = sandbox.SongLoader.load({ id: 'song-b', title: 'Bài B', xmlPath: 'storage/Thanh ca/b.xml' }, 2);
    await new Promise(r => setTimeout(r, 10));
    // User changes transpose to +3 while load is still waiting on fetch
    storeState.set('currentTranspose', 3);
    await sandbox.SongLoader.commitTranspose();

    resolveXml({ ok: true, text: async () => '<score-partwise/>' });
    await loadPromise;

    check(
      storeState.get('currentTranspose') === 3 && osmdLoads[0] === 3 && osmdReloads.length === 0,
      'BUG-19: Đổi dịch giọng khi đang tải bài không bị ghi đè về giá trị cũ và commitTranspose thoát khi đang tải'
    );
  }

  // ── 5. BUG-20: ChordCanvasUI popup listener disposed on _destroyPopup ──
  {
    const docListeners = [];
    const makeNode = () => ({
      style: {},
      classList: { add() {}, remove() {}, contains: () => false },
      setAttribute() {},
      getAttribute: () => null,
      addEventListener() {},
      removeEventListener() {},
      contains: () => false,
      closest: () => null,
      getBoundingClientRect: () => ({ top: 200, bottom: 240, left: 100, right: 140, width: 40, height: 40 }),
      querySelector: () => ({ value: 'Am', style: {}, focus() {}, select() {}, blur() {}, addEventListener() {}, appendChild() {}, querySelectorAll: () => [] }),
      querySelectorAll: () => [],
      remove() { this.isConnected = false; },
      isConnected: true
    });

    const sandbox = {
      console,
      setTimeout,
      clearTimeout,
      innerWidth: 1280,
      innerHeight: 800,
      localStorage: { getItem: () => '[]', setItem: () => {} },
      requestAnimationFrame: (fn) => fn(),
      addEventListener: () => {},
      document: {
        activeElement: null,
        documentElement: { clientHeight: 800 },
        body: { classList: { add() {}, remove() {} }, appendChild(n) { n.isConnected = true; return n; } },
        createElement: () => makeNode(),
        getElementById: () => null,
        querySelector: () => null,
        querySelectorAll: () => [],
        addEventListener(type, fn, cap) {
          docListeners.push({ type, fn, cap });
        },
        removeEventListener(type, fn) {
          const i = docListeners.findIndex(x => x.type === type && x.fn === fn);
          if (i >= 0) docListeners.splice(i, 1);
        }
      },
      window: null
    };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(path.join(root, 'assets/js/core/SafeHtml.js'), 'utf8'), sandbox);
    vm.runInContext(fs.readFileSync(path.join(root, 'assets/js/chord-canvas-ui.js'), 'utf8'), sandbox);
    vm.runInContext(fs.readFileSync(path.join(root, 'assets/js/chord-canvas-edit.js'), 'utf8'), sandbox);

    let saveCalled = 0;
    sandbox.Auth = { isBanhat: () => true };
    sandbox.ChordCanvas = {
      getCurrentSet: () => 'HD',
      getCustomChords: () => ({}),
      getNoteEls: () => [],
      build: () => {}
    };
    sandbox.ChordCanvasEdit.init(sandbox.ChordCanvas);

    // Also test ChordCanvasUI.createPopup directly + ChordCanvasEdit.closePopup
    const anchor = makeNode();
    const pop = sandbox.ChordCanvasUI.createPopup(anchor, 0, 0, 'C', 'HD', {
      onSave: () => { saveCalled++; },
      onDelete: () => {},
      onClose: () => {}
    });
    // Wait 320ms for setTimeout to attach listener, then dispose/close popup
    await new Promise(r => setTimeout(r, 330));
    if (typeof pop.dispose === 'function') pop.dispose();
    pop.remove();

    // Simulate outside pointerdown on document
    docListeners.slice().forEach(l => {
      if (l.type === 'pointerdown') l.fn({ target: makeNode() });
    });

    check(saveCalled === 0 && docListeners.filter(l => l.type === 'pointerdown').length === 0, 'BUG-20: Đóng popup bằng code gỡ sạch listener pointerdown ở document và không gọi doSave');
  }

  // ── 6. BUG-21: URLState popstate & PerformanceEngine follower updates URL ──
  {
    const winListeners = {};
    const pushCalls = [];
    const replaceCalls = [];
    let currentSongId = 'song-b';
    const loadedViaBack = [];

    const sandbox = {
      console,
      URL,
      URLSearchParams,
      location: {
        origin: 'http://localhost',
        pathname: '/sheetapp2/',
        search: '?song=song-b',
        href: 'http://localhost/sheetapp2/?song=song-b'
      },
      history: {
        pushState(state, _, url) { pushCalls.push(String(url)); },
        replaceState(state, _, url) { replaceCalls.push(String(url)); }
      },
      addEventListener(type, fn) { (winListeners[type] = winListeners[type] || []).push(fn); },
      App: {
        getCurrentSongId: () => currentSongId,
        loadSong: (song, t) => { currentSongId = song.id; loadedViaBack.push(song.id); }
      },
      LibraryUI: {
        getSongObj: (id) => ({ id, title: id, xmlPath: `storage/Thanh ca/${id}.xml` })
      },
      window: null
    };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(path.join(root, 'assets/js/url-state.js'), 'utf8'), sandbox);

    // Simulate browser Back to song-a
    sandbox.location.search = '?song=song-a';
    sandbox.location.href = 'http://localhost/sheetapp2/?song=song-a';
    const pushCountBeforeBack = pushCalls.length;
    (winListeners['popstate'] || []).forEach(fn => fn({ state: { song: 'song-a' } }));

    check(
      loadedViaBack.includes('song-a') && pushCalls.length === pushCountBeforeBack,
      'BUG-21: Sự kiện popstate (nút Back) mở đúng bài theo URL mà không pushState lặp lại'
    );

    // Now test follower in PerformanceEngine updating URLState when song changes
    const urlResets = [];
    sandbox.URLState = {
      resetForNewSong: (id) => urlResets.push(id),
      update: () => {}
    };
    sandbox.Store = { get: (k) => (k === 'currentSong' ? { id: 'song-a' } : 0) };
    sandbox.SongLoader = { load: async (song) => { currentSongId = song.id; } };
    sandbox.MusicalPosition = { init: () => {}, computeMeasurePositions: () => {}, scrollToMeasure: () => {} };
    sandbox.EventBus = { on: () => {}, emit: () => {} };
    sandbox.OSMDRenderer = { onReady: () => {} };
    sandbox.ArrangementEngine = { init: () => {}, highlightSection: () => {} };
    sandbox.CueEngine = { init: () => {}, handleStateCue: () => {} };
    sandbox.LiveTransport = { init: () => {}, applyTransportState: () => {} };
    sandbox.LiveSession = {
      init: () => {},
      onStateUpdate: (cb) => { sandbox._onFollowerState = cb; },
      isHost: () => false,
      isFollowing: () => true
    };
    sandbox.document = { getElementById: () => null, querySelector: () => null, addEventListener: () => {} };

    vm.runInContext(fs.readFileSync(path.join(root, 'assets/js/performance/performance-engine.js'), 'utf8'), sandbox);
    sandbox.PerformanceEngine.init();
    await sandbox.PerformanceEngine.applyRemoteState({
      songId: 'song-c',
      song: { id: 'song-c', title: 'Bài C', xmlPath: 'storage/Thanh ca/c.xml' },
      music: { transpose: 0 }
    });

    check(
      urlResets.includes('song-c'),
      'BUG-21: Follower trong PerformanceEngine gọi URLState.resetForNewSong khi đổi bài theo Ca Trưởng'
    );
  }

  console.log(`SUITE_COMPLETE total=${passed + failed} passed=${passed} failed=${failed}`);
  process.exit(failed > 0 ? 1 : 0);
})();
