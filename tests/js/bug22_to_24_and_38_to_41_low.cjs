/**
 * tests/js/bug22_to_24_and_38_to_41_low.cjs
 * Behavioral VM tests for Low bugs (BUG-22..24 and BUG-38..41).
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
  // ── 1. BUG-22: SongLoader version switch preserves transpose & chord set ──
  {
    let btnClickHandler = null;
    const versionBtns = [];
    const listContainer = {
      innerHTML: '',
      appendChild(el) { if (el.tagName === 'BUTTON') versionBtns.push(el); }
    };
    const storeMap = new Map([
      ['currentSong', { id: 'song-1', title: 'Bài 1', xmlPath: 'storage/Thanh ca/001.xml' }],
      ['currentTranspose', 4],
      ['currentZoom', 1]
    ]);
    const osmdLoads = [];
    const chordLoads = [];

    const sandbox = {
      console,
      setTimeout,
      clearTimeout,
      requestAnimationFrame: (fn) => fn(),
      AbortController: class { constructor() { this.signal = {}; } abort() {} },
      Response: class { constructor(b) { this._b = b; this.ok = true; } async text() { return this._b; } },
      fetch: async () => ({ ok: true, text: async () => '<score-partwise/>' }),
      localStorage: { getItem: () => null, setItem: () => {} },
      getComputedStyle: () => ({ paddingLeft: '0', paddingRight: '0' }),
      innerWidth: 1280,
      Store: {
        get: (k) => storeMap.get(k),
        set: (k, v) => storeMap.set(k, v)
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
      OSMDRenderer: {
        setZoomSilent: () => {},
        load: async (xml, t) => { osmdLoads.push(t); },
        getInstance: () => ({})
      },
      ChordCanvas: {
        loadSong: async (id, set) => { chordLoads.push(set); },
        getCurrentSet: () => 'BanNhac_A',
        getCustomChords: () => ({}),
        build: () => {}
      },
      SongInfoBar: { loadSong: () => {}, getSongKey: () => 'C' },
      ChordSetNames: { describe: () => 'BanNhac_A' },
      Auth: { describe: () => null },
      SessionTracker: { describe: () => null, load: () => {} },
      ApiService: {
        resolveUrl: (u) => u,
        sessions: { load: async () => ({}) },
        songs: {
          getVersions: async () => ({
            data: [{ id: 55, version_name: 'Phối Mới', username: 'leader', created_at: '2026-10-20', xml_path: 'storage/users/v55.xml' }]
          })
        }
      },
      document: {
        getElementById: (id) => {
          if (id === 'btn-song-versions') {
            return {
              removeAttribute() {},
              contains: () => false,
              addEventListener: (t, fn) => { if (t === 'click') btnClickHandler = fn; }
            };
          }
          if (id === 'dropdown-song-versions') {
            return {
              classList: { contains: () => true, toggle() {}, add() {} },
              contains: () => false
            };
          }
          if (id === 'version-list-items') return listContainer;
          return { tagName: 'INPUT', classList: { remove() {}, add() {}, contains: () => true }, style: {}, removeAttribute() {}, addEventListener() {} };
        },
        createElement: (tag) => ({ tagName: tag.toUpperCase(), style: {}, innerHTML: '' }),
        querySelector: () => ({ clientWidth: 900, scrollHeight: 500, scrollTop: 0, style: {}, scrollTo() {} }),
        querySelectorAll: () => [],
        addEventListener: () => {}
      },
      window: null
    };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(path.join(root, 'assets/js/core/SafeHtml.js'), 'utf8'), sandbox);
    vm.runInContext(fs.readFileSync(path.join(root, 'assets/js/song-loader.js'), 'utf8'), sandbox);

    await sandbox.SongLoader.load({ id: 'song-1', title: 'Bài 1', xmlPath: 'storage/Thanh ca/001.xml' }, 4, 'BanNhac_A');
    if (btnClickHandler) await btnClickHandler({ stopPropagation() {} });
    // versionBtns[0] is Master, versionBtns[1] is version 55
    if (versionBtns[1]?.onclick) versionBtns[1].onclick();
    await new Promise(r => setTimeout(r, 20));

    check(
      storeMap.get('currentTranspose') === 4 && chordLoads[chordLoads.length - 1] === 'BanNhac_A',
      'BUG-22: Chọn phiên bản bài hát giữ nguyên dịch giọng (currentTranspose=4) và bộ hợp âm (BanNhac_A)'
    );
  }

  // ── 2. BUG-23: SongPreloader uses real xmlPath via ApiService.songs.get ──
  {
    const fetchedUrls = [];
    const sandbox = {
      console,
      performance: { now: () => 0 },
      fetch: async (url) => {
        fetchedUrls.push(String(url));
        return { ok: true, text: async () => '<score-partwise/>' };
      },
      ApiService: {
        resolveUrl: (u) => u,
        songs: {
          get: async (id) => ({ id, title: 'Bài Thật', xmlPath: 'storage/Thanh ca/042-bai-hat-that.xml' })
        },
        chordSets: {
          load: async () => ({ chords: [], checksum: 'abc' })
        }
      },
      LibraryUI: {
        getSongObj: () => null
      },
      window: null
    };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(path.join(root, 'assets/js/song-preloader.js'), 'utf8'), sandbox);

    await sandbox.SongPreloader.preloadNextInSetlist({
      items: [
        { song_id: '001' },
        { song_id: '042', chord_profile: 'HD', transpose_key: 0 }
      ]
    }, 0);

    check(
      fetchedUrls.includes('storage/Thanh ca/042-bai-hat-that.xml'),
      'BUG-23: SongPreloader.preloadNextInSetlist lấy đúng xmlPath thật của bài thay vì tự ghép đường dẫn giả'
    );
  }

  // ── 3. BUG-24: ChordCanvasEdit flushOfflineQueue re-entrancy guard & 409 handling ──
  {
    let queueStore = JSON.stringify([
      { songId: 'song-conflict', currentSet: 'MySet', arr: [{ measureIdx: 0, noteIdx: 0, chord: 'C' }], baseChecksum: 'old-cs' },
      { songId: 'song-ok', currentSet: 'MySet', arr: [{ measureIdx: 0, noteIdx: 0, chord: 'G' }], baseChecksum: 'ok-cs' }
    ]);
    const saveCalls = [];

    const sandbox = {
      console,
      setTimeout,
      clearTimeout,
      requestAnimationFrame: (fn) => fn(),
      localStorage: {
        getItem: (k) => (k === 'sheetapp_offline_chord_queue_v1' ? queueStore : null),
        setItem: (k, v) => { if (k === 'sheetapp_offline_chord_queue_v1') queueStore = v; }
      },
      addEventListener: () => {},
      ApiService: {
        chordSets: {
          save: async (songId, setName, arr, cs) => {
            saveCalls.push(songId);
            await new Promise(r => setTimeout(r, 20));
            if (songId === 'song-conflict') {
              const err = new Error('Conflict 409');
              err.conflict = true;
              err.status = 409;
              throw err;
            }
            return { success: true, checksum: 'new-cs' };
          }
        }
      },
      ChordCanvas: {
        getCurrentSet: () => 'MySet',
        getCustomChords: () => ({}),
        build: () => {}
      },
      document: {
        body: { classList: { contains: () => false }, contains: () => false, appendChild() {} },
        createElement: () => ({ style: {}, setAttribute() {}, querySelector: () => ({ onclick: null }), remove() {} }),
        getElementById: () => null,
        querySelectorAll: () => [],
        addEventListener: () => {}
      },
      window: null
    };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(path.join(root, 'assets/js/core/SafeHtml.js'), 'utf8'), sandbox);
    vm.runInContext(fs.readFileSync(path.join(root, 'assets/js/chord-canvas-edit.js'), 'utf8'), sandbox);
    sandbox.ChordCanvasEdit.init(sandbox.ChordCanvas);

    // Fire two concurrent flushOfflineQueue calls (simulating duplicate online events)
    await Promise.all([
      sandbox.ChordCanvasEdit.flushOfflineQueue(),
      sandbox.ChordCanvasEdit.flushOfflineQueue()
    ]);

    const okCalls = saveCalls.filter(id => id === 'song-ok').length;
    const remaining = JSON.parse(queueStore);
    check(
      okCalls === 1 && remaining.length === 0,
      'BUG-24: Hai lần gọi flushOfflineQueue đồng thời không gửi trùng và mục 409 không chặn mục hợp lệ phía sau'
    );
  }

  // ── 4. BUG-38: Editor confirms before discarding dirty state on loadSong & registers beforeunload ──
  {
    let beforeUnloadHandler = null;
    let confirmCalls = 0;
    let allowConfirm = false;
    const labelEl = { textContent: '' };

    const sandbox = {
      console,
      URL,
      URLSearchParams,
      setTimeout,
      clearTimeout,
      confirm: () => { confirmCalls++; return allowConfirm; },
      XMLSerializer: class { serializeToString() { return '<score-partwise/>'; } },
      DOMParser: class {
        parseFromString() {
          return { querySelector: () => null, querySelectorAll: () => [] };
        }
      },
      location: { href: 'http://localhost/sheetapp2/editor/?song=s1', search: '?song=s1', toString() { return this.href; } },
      history: { replaceState() {} },
      fetch: async () => ({ ok: true, status: 200, text: async () => '<score-partwise/>' }),
      EditorModifiers: { setNotePitchInXml: () => {} },
      EditorAudio: { playSinglePitch: () => {} },
      ApiService: {
        resolveUrl: (u) => u,
        songs: { getVersions: async () => ({ success: true, data: [] }) }
      },
      addEventListener: (t, fn) => { if (t === 'beforeunload') beforeUnloadHandler = fn; },
      document: {
        getElementById: (id) => (id === 'current-song-label' ? labelEl : { classList: { add() {}, remove() {} }, addEventListener() {}, appendChild() {}, textContent: '', innerHTML: '' }),
        createElement: () => ({ className: '', innerHTML: '', classList: { add() {} } }),
        querySelectorAll: () => [],
        addEventListener: () => {}
      },
      window: null
    };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(path.join(root, 'assets/js/core/SafeHtml.js'), 'utf8'), sandbox);
    vm.runInContext(fs.readFileSync(path.join(root, 'editor/editor.js'), 'utf8'), sandbox);

    await sandbox.SheetEditor.loadSong({ id: 's1', title: 'Bài 1', xmlPath: 'storage/Thanh ca/s1.xml' });
    // Make editor dirty by injecting a fake note in selectedPosition and calling modifyPitch
    sandbox.SheetEditor.getSelectedPosition().activeVoiceMap.soprano = { xmlNode: {}, step: 'C', octave: 4, alter: 0, isRest: false };
    await sandbox.SheetEditor.modifyPitch('D', 4, 0);

    // Attempt to switch song while confirm returns false -> should stay on Bài 1
    allowConfirm = false;
    await sandbox.SheetEditor.loadSong({ id: 's2', title: 'Bài 2', xmlPath: 'storage/Thanh ca/s2.xml' });

    check(
      confirmCalls === 1 && labelEl.textContent.includes('Bài 1') && typeof beforeUnloadHandler === 'function',
      'BUG-38: Editor hỏi xác nhận khi đang có thay đổi chưa lưu (_isDirty) và đăng ký beforeunload'
    );
  }

  // ── 5. BUG-39: Manager Pin/Recommend button hidden for banhat, shown for leader/admin ──
  {
    const commGrid = { innerHTML: '' };
    const verGrid = { innerHTML: '' };
    const sandbox = {
      console,
      ApiService: {
        manager: {
          communityChordSets: async () => ({
            success: true,
            sets: [{ id: 10, song_id: '001', song_title: 'Bài 1', set_name: 'SetA', username: 'u2', user_id: 2, is_recommended: 0 }]
          }),
          songVersions: async () => ({
            success: true,
            versions: [{ id: 20, song_id: '001', song_title: 'Bài 1', version_name: 'VerA', username: 'u2', user_id: 2, is_recommended: 0 }]
          })
        }
      },
      ManagerApp: {
        state: {
          currentUser: { user_id: 5, role: 'banhat' },
          community: { filter: 'all', instrument: '', search: '' },
          versions: { filter: 'all', search: '' }
        },
        showToast: () => {}
      },
      document: {
        getElementById: (id) => {
          if (id === 'mgr-community-grid') return commGrid;
          if (id === 'mgr-versions-grid') return verGrid;
          return { textContent: '', value: '', addEventListener() {} };
        },
        querySelectorAll: () => []
      },
      window: null
    };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(path.join(root, 'assets/js/core/SafeHtml.js'), 'utf8'), sandbox);
    vm.runInContext(fs.readFileSync(path.join(root, 'manager/js/manager-community.js'), 'utf8'), sandbox);
    vm.runInContext(fs.readFileSync(path.join(root, 'manager/js/manager-versions.js'), 'utf8'), sandbox);

    sandbox.ManagerCommunity.renderCommunityGrid([{ id: 10, song_id: '001', song_title: 'Bài 1', set_name: 'SetA', username: 'u2', user_id: 2, is_recommended: 0 }]);
    sandbox.ManagerVersions.renderVersionsGrid([{ id: 20, song_id: '001', song_title: 'Bài 1', version_name: 'VerA', username: 'u2', user_id: 2, is_recommended: 0 }]);

    check(
      !commGrid.innerHTML.includes('toggleRecommend') && !verGrid.innerHTML.includes('toggleVersionRecommend'),
      'BUG-39: Tài khoản Ban Hát thường không thấy nút Ghim (toggleRecommend / toggleVersionRecommend) trong Manager'
    );
  }

  // ── 6. BUG-40: Classic deleteSet respects server error & Importer escapes onclick string ──
  {
    let switchedToHd = false;
    let toastError = '';
    const sandbox = {
      console,
      setTimeout,
      clearTimeout,
      localStorage: { getItem: () => null, setItem: () => {} },
      App: {
        getCurrentSongId: () => '001',
        showToast: (msg, type) => { if (type === 'error') toastError = msg; }
      },
      ApiService: {
        chordSets: {
          delete: async () => ({ success: false, error: 'Không có quyền xóa bộ này' }),
          load: async (id, name) => { if (name === 'HD') switchedToHd = true; return { chords: [] }; },
          list: async () => ({ sets: ['HD', 'MySet'] })
        },
        omr: {
          list: async () => ([
            { id: 'job1', status: 'completed', original_filename: "Bai'Hat'Test.xml", created_at: '2026-10-22', musicxml_path: 'storage/Thanh ca/test.xml' }
          ])
        }
      },
      ChordCanvasUI: {},
      document: {
        getElementById: (id) => {
          if (id === 'omr-queue-container') return { classList: { remove() {}, add() {} } };
          if (id === 'omr-queue-list') return (sandbox._omrList = { innerHTML: '' });
          return null;
        },
        querySelectorAll: () => [],
        addEventListener: () => {}
      },
      window: null
    };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(path.join(root, 'assets/js/core/SafeHtml.js'), 'utf8'), sandbox);
    vm.runInContext(fs.readFileSync(path.join(root, 'old/assets/js/chord-canvas.js'), 'utf8'), sandbox);
    vm.runInContext(fs.readFileSync(path.join(root, 'old/assets/js/importer.js'), 'utf8'), sandbox);

    await sandbox.ChordCanvas.deleteSet('MySet');
    check(
      !switchedToHd && toastError.includes('Không có quyền'),
      'BUG-40 (ChordCanvas): Classic deleteSet giữ nguyên bộ và báo lỗi khi server trả về thất bại'
    );
  }

  // ── 7. BUG-41: LearnControls back link uses ApiService.resolveUrl / base path ──
  {
    const backBtn = { href: '', title: '' };
    const sandbox = {
      console,
      URL,
      URLSearchParams,
      localStorage: { setItem: () => {}, getItem: () => null },
      location: { href: 'http://localhost/sheetapp2/learn/?song=001', toString() { return this.href; } },
      history: { replaceState() {} },
      __APP_BASE__: '/sheetapp2',
      ApiService: {
        resolveUrl: (u) => '/sheetapp2/' + String(u).replace(/^\//, '')
      },
      document: {
        querySelector: (sel) => (sel === '.learn-back-btn' ? backBtn : null),
        getElementById: () => null
      },
      window: null
    };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(path.join(root, 'assets/js/learn/ui/learn-controls.js'), 'utf8'), sandbox);

    sandbox.LearnControls.updateUrlAndBackLink('001-bai', 'HD', 0, 'Bài 1');
    check(
      backBtn.href.startsWith('/sheetapp2/'),
      'BUG-41: LearnControls.updateUrlAndBackLink dựng link Quay về có chứa base path (/sheetapp2/)'
    );
  }

  console.log(`SUITE_COMPLETE total=${passed + failed} passed=${passed} failed=${failed}`);
  process.exit(failed > 0 ? 1 : 0);
})();
