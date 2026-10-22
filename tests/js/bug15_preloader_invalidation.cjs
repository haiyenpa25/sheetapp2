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

let fetchedUrls = [];
let appliedPreloaded = false;

const w = {
  __APP_BASE__: '/sheetapp2',
  KeyService: { describe: () => '' },
  addEventListener() {},
  ChordCanvasXML: {
    cloneAndInjectChords: xml => xml
  },
  ChordCanvas: {
    loadSong: async () => {},
    applyPreloaded: () => { appliedPreloaded = true; },
    onOSMDRendered() {}
  },
  OSMDRenderer: new Proxy({}, { get: () => async () => {} }),
  AppUI: new Proxy({}, { get: () => () => {} })
};

const fetchMock = async url => {
  fetchedUrls.push(String(url));
  if (String(url).includes('route=chord_sets&action=load')) {
    return {
      ok: true,
      json: async () => ({
        success: true,
        chords: [{ measureIdx: 0, noteIdx: 0, chord: 'C' }],
        checksum: 'chk-1'
      })
    };
  }
  if (String(url).includes('api/')) {
    return {
      ok: true,
      json: async () => ({ success: true, xml: '<score-partwise version="version-99"/>' }),
      text: async () => '<score-partwise version="version-99"/>'
    };
  }
  return {
    ok: true,
    text: async () => '<score-partwise version="master"/>'
  };
};

const ctx = vm.createContext({
  window: w,
  fetch: fetchMock,
  AbortController,
  Store: { set() {}, get: () => null },
  AppUI: w.AppUI,
  ChordCanvas: w.ChordCanvas,
  OSMDRenderer: w.OSMDRenderer,
  EventBus: { emit() {}, on() {} },
  performance: { now: () => 100 },
  document: {
    cookie: '',
    getElementById: () => null,
    querySelectorAll: () => [],
    querySelector: () => null,
    addEventListener() {},
    body: { classList: { contains: () => false } }
  },
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  setTimeout() {},
  clearTimeout() {},
  requestAnimationFrame: fn => fn(),
  console
});

vm.runInContext(fs.readFileSync(path.join(root, 'assets/js/core/ApiService.js'), 'utf8'), ctx);
ctx.ApiService = w.ApiService;
vm.runInContext(fs.readFileSync(path.join(root, 'assets/js/song-preloader.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'assets/js/song-loader.js'), 'utf8'), ctx);

(async () => {
  const songA = { id: 'song-a', title: 'Song A', xmlPath: 'storage/Thanh ca/001.xml' };

  // 1. Preload song A -> cache hit
  await w.SongPreloader.preload(songA, 'HD');
  check(w.SongPreloader.has('song-a', 'HD') === true, 'Preload caches song-a for HD profile');

  // 2. Save chords on song A -> must invalidate preloaded cache for song-a
  await w.ApiService.chordSets.save('song-a', 'HD', [{ measureIdx: 0, noteIdx: 0, chord: 'G' }], 'chk-1');
  check(w.SongPreloader.has('song-a', 'HD') === false, 'Saving chord set invalidates SongPreloader cache for that song');

  // 3. Preload song A again, then logout -> must clear preloaded cache
  await w.SongPreloader.preload(songA, 'HD');
  await w.ApiService.auth.logout();
  check(w.SongPreloader.has('song-a', 'HD') === false, 'Auth logout clears SongPreloader cache');

  // 4. Preload song A, then load song A with versionId -> must NOT use preloaded master XML/chords
  await w.SongPreloader.preload(songA, 'HD');
  fetchedUrls = [];
  appliedPreloaded = false;
  await w.SongLoader.load({ ...songA, versionId: 99 }, 'HD', 0, {});
  check(
    appliedPreloaded === false && fetchedUrls.some(u => u.includes('version_xml') && u.includes('version_id=99')),
    'SongLoader.load with song.versionId bypasses SongPreloader master cache and fetches version_xml'
  );

  console.log(`SUITE_COMPLETE total=${total} passed=${total - failed} failed=${failed}`);
  process.exitCode = failed ? 1 : 0;
})().catch(e => {
  console.error(e);
  process.exitCode = 1;
});
