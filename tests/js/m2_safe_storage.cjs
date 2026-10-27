const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '../..');
let total = 0;

function check(cond, msg) {
  total++;
  if (!cond) {
    console.error('FAIL: ' + msg);
    process.exit(1);
  }
  console.log('PASS: ' + msg);
}

(async () => {
  // 1. SafeStorage.js existence & API contract
  const safeStoragePath = path.join(root, 'assets/js/core/SafeStorage.js');
  check(fs.existsSync(safeStoragePath), 'M2-6: assets/js/core/SafeStorage.js exists');

  // Simulate hostile localStorage that throws SecurityError / QuotaExceededError
  const throwingStorage = {
    getItem() {
      const err = new Error('The operation is insecure.');
      err.name = 'SecurityError';
      throw err;
    },
    setItem() {
      const err = new Error('QuotaExceededError');
      err.name = 'QuotaExceededError';
      throw err;
    },
    removeItem() {
      const err = new Error('SecurityError');
      err.name = 'SecurityError';
      throw err;
    },
  };

  const idbStore = new Map();
  const mockIdbKeyval = {
    async get(k) { return idbStore.get(k); },
    async set(k, v) { idbStore.set(k, v); },
    async del(k) { idbStore.delete(k); },
  };

  const win = {
    idbKeyval: mockIdbKeyval,
    localStorage: throwingStorage,
    caches: {
      async open() {
        return {
          async put() {},
          async match() { return { ok: true }; },
        };
      },
      async match() { return { ok: true }; },
      async delete() { return true; },
    },
    addEventListener() {},
  };

  const ctx = vm.createContext({
    window: win,
    localStorage: throwingStorage,
    caches: win.caches,
    console,
    Date,
    Map,
    Set,
    Promise,
    JSON,
    Object,
    Array,
    String,
    Number,
    Boolean,
    Math,
    Error,
    setTimeout,
    clearTimeout,
    fetch: async () => ({ ok: true, status: 200, clone() { return this; }, async text() { return '<score-partwise/>'; } }),
  });
  win.window = win;

  vm.runInContext(fs.readFileSync(safeStoragePath, 'utf8'), ctx);
  check(
    Boolean(win.SafeStorage) &&
      typeof win.SafeStorage.get === 'function' &&
      typeof win.SafeStorage.set === 'function' &&
      typeof win.SafeStorage.remove === 'function' &&
      typeof win.SafeStorage.getJson === 'function' &&
      typeof win.SafeStorage.setJson === 'function',
    'M2-6: SafeStorage exposes get/set/remove/getJson/setJson',
  );

  // 2. SafeStorage never throws when localStorage throws SecurityError / QuotaExceededError
  let threw = false;
  try {
    win.SafeStorage.set('k1', 'val1');
    check(win.SafeStorage.get('k1') === 'val1', 'M2-6: SafeStorage.get returns in-memory fallback when localStorage throws');
    win.SafeStorage.setJson('k2', { a: 123 });
    const parsed = win.SafeStorage.getJson('k2');
    check(parsed && parsed.a === 123, 'M2-6: SafeStorage.getJson/setJson works when localStorage throws QuotaExceededError');
    win.SafeStorage.remove('k1');
    check(win.SafeStorage.get('k1', 'default') === 'default', 'M2-6: SafeStorage.remove clears fallback value without throwing');
  } catch (e) {
    threw = true;
  }
  check(!threw, 'M2-6: SafeStorage never throws on SecurityError or QuotaExceededError');

  // 3. OfflineVault LRU 10 limit for _memXml
  const vaultPath = path.join(root, 'assets/js/core/OfflineVault.js');
  vm.runInContext(fs.readFileSync(vaultPath, 'utf8'), ctx);
  for (let i = 1; i <= 15; i++) {
    await win.OfflineVault.saveXml(`storage/song-${i}.xml`, `<score-partwise id="${i}"/>`);
  }
  const memXmlSize = win.OfflineVault._memXml ? win.OfflineVault._memXml.size : 999;
  check(memXmlSize <= 10, `M2-6: OfflineVault._memXml is bounded to LRU 10 songs (actual size=${memXmlSize})`);
  check(
    win.OfflineVault._memXml && !win.OfflineVault._memXml.has('sheetapp_xml:storage/song-1.xml') && win.OfflineVault._memXml.has('sheetapp_xml:storage/song-15.xml'),
    'M2-6: OfflineVault._memXml evicts oldest songs and keeps newest 10 songs',
  );

  // 4. OfflineSetlistManager saves package to IndexedDB via OfflineVault when localStorage throws QuotaExceededError
  win.ApiService = {
    resolveUrl: (u) => '/' + String(u).replace(/^\/+/, ''),
    setlists: {
      getOfflinePackage: async (id) => ({
        success: true,
        data: {
          setlist: { id, title: 'Chúa Nhật Offline IDB' },
          total_songs: 1,
          package_version: 'pkg-' + id + '-v1',
          songs: {
            'thanh-ca-001': { id: 'thanh-ca-001', title: 'Thánh Ca 1', xmlPath: 'storage/001.xml' },
          },
          chord_sets: {
            'thanh-ca-001': { HD: [{ measure: 1, beat: 1, chord: 'C' }] },
          },
        },
      }),
    },
  };
  const osmPath = path.join(root, 'assets/js/core/OfflineSetlistManager.js');
  vm.runInContext(fs.readFileSync(osmPath, 'utf8'), ctx);

  const dlRes = await win.OfflineSetlistManager.downloadPackage(77);
  check(dlRes && dlRes.success && dlRes.isReady, 'M2-6: OfflineSetlistManager.downloadPackage succeeds even when localStorage throws QuotaExceededError');
  const savedSetlist = win.OfflineSetlistManager.getOfflineSetlist(77);
  check(savedSetlist && savedSetlist.title === 'Chúa Nhật Offline IDB', 'M2-6: getOfflineSetlist reads package stored via OfflineVault');
  check(idbStore.size > 0, 'M2-6: Offline package is persisted to IndexedDB via OfflineVault');

  console.log('\nSUITE_COMPLETE total=' + total);
})();
