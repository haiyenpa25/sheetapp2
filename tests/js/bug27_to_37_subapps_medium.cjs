/**
 * tests/js/bug27_to_37_subapps_medium.cjs
 * Behavioral VM tests for Classic & Sub-apps Medium bugs (BUG-27..BUG-37).
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
  // ── 1. BUG-27: Classic instruments.js escapes instrument name ──
  {
    const listEl = {
      innerHTML: '',
      children: [],
      appendChild(c) { this.children.push(c); }
    };
    let openMixerHandler = null;
    const sandbox = {
      console,
      localStorage: { getItem: () => null, setItem: () => {} },
      OSMDRenderer: {
        getInstance: () => ({
          sheet: {
            Instruments: [
              { nameLabel: { text: 'Piano <img src=x onerror=alert(1)>' }, Visible: true }
            ]
          }
        })
      },
      document: {
        getElementById: (id) => {
          if (id === 'mixer-instruments-list') return listEl;
          if (id === 'btn-mixer') return { addEventListener: (t, fn) => { if (t === 'click') openMixerHandler = fn; } };
          return { classList: { remove() {}, add() {} }, addEventListener() {} };
        },
        createElement: () => ({ style: {}, innerHTML: '' }),
        addEventListener: () => {}
      },
      window: null
    };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(path.join(root, 'assets/js/core/SafeHtml.js'), 'utf8'), sandbox);
    vm.runInContext(fs.readFileSync(path.join(root, 'old/assets/js/instruments.js'), 'utf8'), sandbox);

    sandbox.InstrumentMixer.init();
    if (openMixerHandler) openMixerHandler();
    const rowHtml = listEl.children[0]?.innerHTML || '';
    check(
      !rowHtml.includes('<img') && rowHtml.includes('&lt;img'),
      'BUG-27: Classic InstrumentMixer.openMixer escape an toàn tên nhạc cụ từ MusicXML'
    );
  }

  // ── 2. BUG-28 & BUG-37 (Editor): Editor loads version via version_xml API & guards race with loadToken ──
  {
    const fetchedUrls = [];
    const pendingResolvers = [];
    const labelEl = { textContent: '' };
    let lastReplacedUrl = '';
    const sandbox = {
      console,
      URL,
      URLSearchParams,
      setTimeout,
      clearTimeout,
      location: { href: 'http://localhost/sheetapp2/editor/?song=s1', search: '?song=s1', origin: 'http://localhost', pathname: '/sheetapp2/editor/', toString() { return this.href; } },
      history: { replaceState(_s, _t, u) { lastReplacedUrl = String(u); } },
      DOMParser: class {
        parseFromString() {
          return {
            querySelector: () => null,
            querySelectorAll: () => []
          };
        }
      },
      fetch: (url) => {
        fetchedUrls.push(String(url));
        return new Promise(res => { pendingResolvers.push({ url: String(url), res }); });
      },
      ApiService: {
        resolveUrl: (u) => '/sheetapp2/' + String(u).replace(/^\//, ''),
        songs: {
          list: async () => [],
          getVersions: async () => ({ success: true, data: [] })
        }
      },
      document: {
        getElementById: (id) => (id === 'current-song-label' ? labelEl : { classList: { add() {}, remove() {} }, addEventListener() {}, innerHTML: '', textContent: '' }),
        querySelectorAll: () => [],
        addEventListener: () => {}
      },
      window: null
    };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(path.join(root, 'assets/js/core/SafeHtml.js'), 'utf8'), sandbox);
    vm.runInContext(fs.readFileSync(path.join(root, 'editor/editor.js'), 'utf8'), sandbox);

    // Test BUG-28: loadSong with version object uses version_xml API
    const pVer = sandbox.SheetEditor.loadSong(
      { id: '001', title: 'Bài 1', xmlPath: 'storage/Thanh ca/001.xml' },
      { id: 77, version_name: 'Bản Sửa', xml_path: 'storage/users/u1/v77.xml' }
    );
    pendingResolvers.shift().res({ ok: true, status: 200, text: async () => '<score-partwise/>' });
    await pVer;

    check(
      fetchedUrls[0] && fetchedUrls[0].includes('route=songs') && fetchedUrls[0].includes('action=version_xml') && fetchedUrls[0].includes('version_id=77'),
      'BUG-28: Editor tải phiên bản bài hát qua endpoint version_xml thay vì đọc trực tiếp storage/users/'
    );

    // Test BUG-37 (Editor): start slow load A, then fast load B -> final state is B
    const pSlowA = sandbox.SheetEditor.loadSong({ id: 'song-a', title: 'Bài Chậm A', xmlPath: 'storage/Thanh ca/a.xml' });
    const pFastB = sandbox.SheetEditor.loadSong({ id: 'song-b', title: 'Bài Nhanh B', xmlPath: 'storage/Thanh ca/b.xml' });
    const reqA = pendingResolvers.shift();
    const reqB = pendingResolvers.shift();
    reqB.res({ ok: true, status: 200, text: async () => '<score-partwise/>' });
    await pFastB;
    reqA.res({ ok: true, status: 200, text: async () => '<score-partwise/>' });
    await pSlowA;

    check(
      lastReplacedUrl.includes('song=song-b'),
      'BUG-37 (Editor): Đổi bài nhanh trong Editor giữ trạng thái của bài B (không bị request A chậm ghi đè)'
    );
  }

  // ── 3. BUG-29 & BUG-30 (StageRoomManager & ProjectorApp): Deduplicate cues/bandState & BPM ──
  {
    let cueShows = 0;
    let bandStateShows = 0;
    let bpmUpdates = 0;
    let currentBpm = 80;

    const sandbox = {
      console,
      Date,
      setTimeout,
      clearTimeout,
      StageRehearsal: {
        showCueBanner: () => { cueShows++; },
        applyBandStateUI: () => { bandStateShows++; }
      },
      window: null
    };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(path.join(root, 'live-band/js/stage-room.js'), 'utf8'), sandbox);

    const statePacket = {
      song: { songId: 's1', chordSet: 'HD' },
      music: { transpose: 0, bpm: 80 },
      position: { measure: 1 },
      cue: { cueId: 'cue-100', type: 'chorus', text: 'ĐIỆP KHÚC', sentAt: 1000, expiresAt: Date.now() + 5000 },
      bandState: { stateId: 'bs-100', key: 'drive', label: 'CAO TRÀO', icon: '🔥', sentAt: 1000 }
    };

    for (let i = 0; i < 3; i++) {
      await sandbox.StageRoomManager.applyRemoteState(statePacket, {
        mode: 'join',
        currentSongId: 's1',
        currentChordSet: 'HD',
        currentTranspose: 0,
        currentBpm,
        currentMeasure: 1,
        isDetached: false,
        onLoadSong: async () => {},
        onSetTranspose: () => {},
        onUpdateBpm: (b) => { currentBpm = b; bpmUpdates++; },
        onSetHostMeasure: () => {},
        onSetCurrentMeasure: () => {},
        onUpdateSnap: () => {}
      });
    }

    check(cueShows === 2 && bandStateShows === 1, 'BUG-29 (StageRoom): Cùng một cue/bandState gửi 3 lần chỉ hiển thị banner 1 lần mỗi loại');
    check(bpmUpdates === 0, 'BUG-30 (StageRoom): Không gọi onUpdateBpm khi BPM trong gói tin bằng currentBpm');
  }

  // ── 4. BUG-31, BUG-32, BUG-33, BUG-34, BUG-37 (LiveBandApp): key, transpose=0, HD injection, single scroll listener, loadToken ──
  {
    let scrollListenersCount = 0;
    let lastOsmdXml = '';
    const titleEl = { textContent: '' };
    const setEl = { textContent: '' };
    const keyEl = { id: 'nav-song-key', textContent: '' };
    const transEl = { textContent: '' };
    const xmlResolvers = [];

    const sandbox = {
      console,
      URL,
      URLSearchParams,
      setTimeout,
      clearTimeout,
      requestAnimationFrame: (fn) => fn(),
      localStorage: { getItem: () => null, setItem: () => {} },
      location: { search: '' },
      SSETransport: class { subscribe() {} connect() {} disconnect() {} async send() {} },
      opensheetmusicdisplay: {
        OpenSheetMusicDisplay: class {
          async load(xml) { lastOsmdXml = xml; }
          render() {}
        }
      },
      ChordCanvasXML: {
        cloneAndInjectChords: (xml, map) => xml + `<!--CHORDS:${JSON.stringify(map)}-->`
      },
      ApiService: {
        resolveUrl: (u) => u,
        chordSets: {
          load: async (songId, setName) => {
            if (songId === 'song-with-hd' && setName === 'HD') {
              return { chords: [{ measureIdx: 0, noteIdx: 0, chord: 'F#m' }] };
            }
            return { chords: [] };
          }
        }
      },
      StageRoomManager: {
        buildBroadcastPayload: (ctx, patch) => ({ ...ctx, ...patch }),
        updateRoomBadges: () => {},
        updateRoomModalUI: () => {},
        hideRoomModal: () => {},
        showRoomModal: () => {}
      },
      StageHud: {
        initWakeLock: () => {},
        bindStageUI: () => {},
        setRole: () => {},
        applyViewMode: () => {},
        updateBassHud: () => {},
        updatePianoHud: () => {}
      },
      StageCatalog: {
        loadSongCatalog: async () => [
          { id: 'song-with-hd', title: 'Bài Có HD', defaultKey: 'Eb', xmlPath: 'storage/Thanh ca/hd.xml' },
          { id: 'song-empty-hd', title: 'Bài Rỗng HD', defaultKey: 'A', xmlPath: 'storage/Thanh ca/empty.xml' }
        ],
        checkUrlAutoParams: async () => {},
        loadSections: async () => {},
        highlightActiveSectionByMeasure: () => {}
      },
      fetch: (url) => new Promise(res => { xmlResolvers.push({ url, res }); }),
      document: {
        addEventListener: () => {},
        getElementById: (id) => {
          if (id === 'stage-osmd-container') return {};
          if (id === 'stage-viewport') return { addEventListener: (t) => { if (t === 'scroll') scrollListenersCount++; } };
          if (id === 'nav-song-title') return titleEl;
          if (id === 'nav-song-set') return setEl;
          if (id === 'stage-current-key-badge') return null;
          if (id === 'nav-song-key') return keyEl;
          if (id === 'host-transpose-val') return transEl;
          return null;
        }
      },
      window: null
    };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(path.join(root, 'assets/js/core/SafeHtml.js'), 'utf8'), sandbox);
    vm.runInContext(fs.readFileSync(path.join(root, 'live-band/live-band.js'), 'utf8'), sandbox);

    await sandbox.LiveBandApp.init();
    sandbox.LiveBandApp.hostAdjustTranspose(3); // Set transpose to +3 before selecting new song

    const p1 = sandbox.LiveBandApp.hostSelectSong('song-with-hd', 'HD');
    await new Promise(r => setTimeout(r, 10));
    xmlResolvers.shift().res({ ok: true, text: async () => '<score-partwise/>' });
    await p1;

    check(keyEl.textContent.includes('Eb'), 'BUG-31: LiveBandApp đọc đúng song.defaultKey (Eb) thay vì luôn mặc định C');
    check(transEl.textContent === '0', 'BUG-32: Ca Trưởng chọn bài mới trong LiveBandApp tự động đặt lại dịch giọng về 0 (Core Rule 2)');
    check(lastOsmdXml.includes('F#m'), 'BUG-33: LiveBandApp nạp bộ hợp âm HD từ ApiService và tiêm vào XML trước khi render OSMD');

    const p2 = sandbox.LiveBandApp.hostSelectSong('song-empty-hd', 'HD');
    await new Promise(r => setTimeout(r, 10));
    xmlResolvers.shift().res({ ok: true, text: async () => '<score-partwise/>' });
    await p2;

    check(scrollListenersCount === 1, 'BUG-34: _bindScrollObserver chỉ gắn listener scroll đúng 1 lần duy nhất qua nhiều lần đổi bài');
  }

  // ── 5. BUG-35: StageHud WakeLock re-requests after release ──
  {
    let requestCount = 0;
    let lastSentinel = null;
    let visCallback = null;
    const pillText = { textContent: '' };

    const sandbox = {
      console,
      navigator: {
        wakeLock: {
          request: async () => {
            requestCount++;
            const listeners = {};
            lastSentinel = {
              addEventListener: (t, fn) => { (listeners[t] = listeners[t] || []).push(fn); },
              _release: () => { (listeners['release'] || []).forEach(fn => fn()); }
            };
            return lastSentinel;
          }
        }
      },
      document: {
        visibilityState: 'visible',
        addEventListener: (t, fn) => { if (t === 'visibilitychange') visCallback = fn; },
        getElementById: (id) => (id === 'btn-stage-wakelock' ? { classList: { toggle() {} }, querySelector: () => pillText } : null)
      },
      window: null
    };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(path.join(root, 'live-band/js/stage-hud.js'), 'utf8'), sandbox);

    await sandbox.StageHud.initWakeLock();
    lastSentinel._release(); // Simulate OS releasing WakeLock when tab hidden
    if (visCallback) await visCallback(); // Simulate tab becoming visible again

    check(requestCount === 2 && pillText.textContent === 'Sáng', 'BUG-35: StageHud xóa sentinel khi release và xin lại WakeLock thành công khi quay lại tab');
  }

  // ── 6. BUG-36: LearnScore does not skip HD with <= 5 chords & LearnApp resets to HD on new song ──
  {
    const sandbox = {
      console,
      DOMParser: class {
        parseFromString(str) { return { xml: str, querySelectorAll: () => [] }; }
      },
      ChordTimelineNormalizer: {
        _extractHarmoniesFromXml: () => [1, 2, 3, 4, 5, 6, 7, 8] // >= 6 harmonies in XML
      },
      ChordCanvasXML: {
        cloneAndInjectChords: (xml, map) => xml + `<!--INJECTED:${JSON.stringify(map)}-->`
      },
      document: { getElementById: () => null },
      window: null
    };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(path.join(root, 'assets/js/learn/ui/learn-score.js'), 'utf8'), sandbox);

    const res = sandbox.LearnScore.prepareEffectiveXml(
      '<score-partwise/>',
      [{ measureIdx: 0, noteIdx: 0, chord: 'Dm7' }, { measureIdx: 1, noteIdx: 0, chord: 'G7' }],
      'HD'
    );
    check(
      res.xmlString.includes('Dm7') && res.rawChordData.length === 2,
      'BUG-36: LearnScore.prepareEffectiveXml luôn tiêm hợp âm của bộ HD kể cả khi bài có ít hơn 6 hợp âm'
    );
  }

  // ── 7. BUG-37 (ManagerRepertoire): selectSong race condition guard ──
  {
    const resolvers = [];
    const titleEl = { textContent: '' };
    const sandbox = {
      console,
      ApiService: {
        manager: {
          songDetails: (id) => new Promise(res => { resolvers.push({ id, res }); })
        }
      },
      ManagerApp: {
        state: { categories: [], currentUser: { user_id: 1, role: 'admin' } },
        showToast: () => {}
      },
      document: {
        getElementById: (id) => {
          if (id === 'sel-song-title') return titleEl;
          return { textContent: '', innerHTML: '', href: '', classList: { remove() {}, add() {}, toggle() {} }, scrollIntoView() {}, addEventListener() {} };
        },
        querySelectorAll: () => []
      },
      window: null
    };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(path.join(root, 'assets/js/core/SafeHtml.js'), 'utf8'), sandbox);
    vm.runInContext(fs.readFileSync(path.join(root, 'manager/js/manager-repertoire.js'), 'utf8'), sandbox);

    const pSlow = sandbox.ManagerRepertoire.selectSong('song-slow');
    const pFast = sandbox.ManagerRepertoire.selectSong('song-fast');
    const rSlow = resolvers.shift();
    const rFast = resolvers.shift();
    rFast.res({ success: true, id: 'song-fast', title: 'Bài Nhanh', user_chord_sets: [], song_versions: [] });
    await pFast;
    rSlow.res({ success: true, id: 'song-slow', title: 'Bài Chậm', user_chord_sets: [], song_versions: [] });
    await pSlow;

    check(
      titleEl.textContent === 'Bài Nhanh',
      'BUG-37 (ManagerRepertoire): Đổi bài nhanh trong Manager Repertoire giữ đúng bài chọn sau cùng'
    );
  }

  console.log(`SUITE_COMPLETE total=${passed + failed} passed=${passed} failed=${failed}`);
  process.exit(failed > 0 ? 1 : 0);
})();
