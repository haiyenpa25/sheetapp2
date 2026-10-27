const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '../..');
const libraryDataPath = path.join(root, 'assets/js/core/LibraryData.js');
const modernLibUiCode = fs.readFileSync(path.join(root, 'assets/js/library-ui.js'), 'utf8');
const classicLibUiCode = fs.readFileSync(path.join(root, 'old/assets/js/library-ui.js'), 'utf8');
const indexPhpCode = fs.readFileSync(path.join(root, 'index.php'), 'utf8');
const oldIndexPhpCode = fs.readFileSync(path.join(root, 'old/index.php'), 'utf8');

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
  // 1. Existence & HTML script wiring
  const hasCoreFile = fs.existsSync(libraryDataPath);
  checkStatic(hasCoreFile, 'M5-3: assets/js/core/LibraryData.js exists');

  checkStatic(
    indexPhpCode.includes("jsTag('core/LibraryData.js'") &&
      oldIndexPhpCode.includes("jsTag('core/LibraryData.js'"),
    'M5-3: Both index.php and old/index.php load core/LibraryData.js'
  );

  // 2. Both library-ui.js files delegate list fetch, deep link, and retry/error UI to LibraryData
  checkStatic(
    modernLibUiCode.includes('LibraryData.fetchList') &&
      modernLibUiCode.includes('LibraryData.getDeepLinkSongId') &&
      modernLibUiCode.includes('LibraryData.resolveSong') &&
      modernLibUiCode.includes('LibraryData.renderLoadError'),
    'M5-3: Modern assets/js/library-ui.js delegates fetchList, getDeepLinkSongId, resolveSong, and renderLoadError to LibraryData'
  );

  checkStatic(
    classicLibUiCode.includes('LibraryData.fetchList') &&
      classicLibUiCode.includes('LibraryData.getDeepLinkSongId') &&
      classicLibUiCode.includes('LibraryData.resolveSong') &&
      classicLibUiCode.includes('LibraryData.renderLoadError'),
    'M5-3: Classic old/assets/js/library-ui.js delegates fetchList, getDeepLinkSongId, resolveSong, and renderLoadError to LibraryData'
  );

  if (!hasCoreFile) {
    console.log(`SUITE_COMPLETE total=${total} failed=${failed}`);
    process.exitCode = 1;
    return;
  }

  const libraryDataCode = fs.readFileSync(libraryDataPath, 'utf8');

  // 3. Behavioral VM tests on LibraryData
  {
    let listShouldFail = true;
    let cacheInvalidated = 0;
    let remoteFetchedId = null;

    const win = {
      location: { search: '?song=999' },
      ApiService: {
        songs: {
          list: async () => {
            if (listShouldFail) throw new Error('Network error');
            return [
              { id: '1', httlvnId: 1, title: 'Thánh Ca 1', category: 'Thánh ca', category_id: 1 },
              { id: '2', httlvnId: 2, title: 'Thánh Ca 2', category: 'Thánh ca', category_id: 1 },
            ];
          },
          get: async (id) => {
            remoteFetchedId = String(id);
            return { id: String(id), httlvnId: 999, title: 'Bài Ngoài Danh Sách', category: 'Thánh ca', category_id: 1 };
          },
          invalidateCache: () => {
            cacheInvalidated++;
          },
        },
      },
      OfflineSetlistManager: {
        getAllOfflineSongs: () => [],
        getOfflineSong: () => null,
      },
      URLSearchParams,
    };
    win.window = win;

    const ctx = vm.createContext({
      window: win,
      URLSearchParams,
      console,
    });

    vm.runInContext(libraryDataCode, ctx);
    const LD = win.LibraryData;

    // 3a. Initial failed list fetch -> empty songs + shouldShowErrorState() === true
    const failedList = await LD.fetchList();
    check(
      Array.isArray(failedList) && failedList.length === 0 && LD.shouldShowErrorState() === true,
      'M5-3: LibraryData.fetchList marks error state when ApiService.songs.list fails and offline fallback is empty'
    );

    // 3b. renderLoadError + retry button invalidates cache and reloads list
    let retryHandler = null;
    const fakeContainer = {
      innerHTML: '',
      style: {},
      querySelector: (sel) =>
        sel === '#btn-retry-song-list'
          ? {
              addEventListener: (ev, fn) => {
                if (ev === 'click') retryHandler = fn;
              },
            }
          : null,
    };

    listShouldFail = false;
    let reloadedSongs = [];
    LD.renderLoadError(fakeContainer, async () => {
      reloadedSongs = await LD.fetchList();
    });

    check(
      fakeContainer.innerHTML.includes('Không tải được danh sách · Thử lại') &&
        fakeContainer.innerHTML.includes('btn-retry-song-list') &&
        typeof retryHandler === 'function',
      'M5-3: LibraryData.renderLoadError renders retry UI and binds #btn-retry-song-list'
    );

    if (retryHandler) await retryHandler();
    check(
      cacheInvalidated === 1 && reloadedSongs.length === 2 && LD.shouldShowErrorState() === false,
      'M5-3: Clicking retry invalidates songs cache and reloads song list successfully',
      `cacheInvalidated=${cacheInvalidated}, reloadedSongs=${reloadedSongs.length}`
    );

    // 3c. Deep link parameter extraction + remote resolution for song outside initial list
    const deepId = LD.getDeepLinkSongId();
    let resolvedSong = null;
    await LD.resolveSong(deepId, [], (s) => {
      resolvedSong = s;
    });

    check(
      deepId === '999' &&
        remoteFetchedId === '999' &&
        resolvedSong?.id === '999' &&
        LD.getSongs().some((s) => String(s.id) === '999'),
      'M5-3: LibraryData resolves deep link ?song=999 via ApiService.songs.get and upserts into shared catalog'
    );
  }

  console.log(`SUITE_COMPLETE total=${total} failed=${failed}`);
  process.exitCode = failed > 0 ? 1 : 0;
})();
