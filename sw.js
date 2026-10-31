/**
 * sw.js — SheetApp Service Worker
 * Chiến lược:
 *   - vendor/   → Cache First (immutable, thư viện bên thứ 3)
 *   - storage/  → Network First với Quota & Offline Fallback (tìm kiếm cả trong sheetapp-offline-*)
 *   - assets/   → Stale While Revalidate (dùng cache, update ngầm)
 *   - api/      → Network Only (luôn lấy data mới)
 *   - navigate  → Network First For Navigation: khi offline trả App Shell đã cache, bỏ qua query string
 */
'use strict';

const urlParams      = new URLSearchParams(self.location.search);
const SW_VERSION     = urlParams.get('v') || 'v5';
const SW_MANIFEST_HASH = 'b3096ee485';
const SW_VENDOR_HASH = 'e8b6692a09';
const CACHE_VENDOR   = `sheetapp-vendor-${SW_VENDOR_HASH}`;
const CACHE_APP      = `sheetapp-app-${SW_VERSION}-${SW_MANIFEST_HASH}`;
const CACHE_MUSICXML = `sheetapp-musicxml-${SW_VERSION}`;
const MAX_MUSICXML_CACHE_ITEMS = 60; // Giới hạn cache tránh phình dung lượng vô hạn
const SW_FETCH_TIMEOUT_MS = 15000;

async function fetchWithTimeout(request, timeoutMs = SW_FETCH_TIMEOUT_MS) {
  if (typeof setTimeout !== 'function') return fetch(request);
  const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
  let timer = null;
  try {
    return await Promise.race([
      ctrl ? fetch(request, { signal: ctrl.signal }) : fetch(request),
      new Promise((_, reject) => {
        timer = setTimeout(() => { try { ctrl?.abort(); } catch (_) {} const err = new Error('SW fetch timeout'); err.isTimeout = true; reject(err); }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer && typeof clearTimeout === 'function') clearTimeout(timer);
  }
}

const SW_BASE = self.location.pathname.replace(/\/sw\.js$/, '');

// ── Tài nguyên pre-cache khi install ──────────────────────────────
const PRECACHE_VENDOR = [
  '/assets/js/vendor/opensheetmusicdisplay.min.js',
  '/assets/js/vendor/tonal.min.js',
  '/assets/js/vendor/idb-keyval.min.js',
  '/assets/js/vendor/Tone.js',
  '/assets/js/vendor/OsmdAudioPlayer.min.js',
].map(p => SW_BASE + p);

const PRECACHE_APP = [
  (SW_BASE ? `${SW_BASE}/` : '/'),
  (SW_BASE ? `${SW_BASE}/index.php` : '/index.php'),
  (SW_BASE ? `${SW_BASE}/old/` : '/old/'),
  (SW_BASE ? `${SW_BASE}/old/index.php` : '/old/index.php'),
  '/manifest.json',
  '/favicon.svg',
  '/favicon.ico',
  '/assets/img/icon-192.png',
  '/assets/css/base.css',
  '/assets/css/layout.css',
  '/assets/css/sheet.css',
  '/assets/css/components.css',
  '/assets/css/instrument-annotations.css',
  '/assets/css/fab.css',
  '/assets/css/app-shell.css',
  '/assets/css/library-polish.css',
  '/assets/css/control-deck.css',
  '/assets/js/core/OfflineVault.js',
  '/assets/js/core/ScriptLoader.js',
  '/assets/js/core/FeatureFlags.js',
  '/assets/js/core/SafeHtml.js',
  '/assets/js/core/SafeStorage.js',
  '/assets/js/core/AppRules.js',
  '/assets/js/core/PointerTap.js',
  '/assets/js/core/ControlDeck.js',
  '/assets/js/core/KeyService.js',
  '/assets/js/core/ApiService.js',
  '/assets/js/core/EventBus.js',
  '/assets/js/core/Store.js',
  '/assets/js/core/XmlDocCache.js',
  '/assets/js/core/ModalManager.js',
  '/assets/js/core/ModeManager.js',
  '/assets/js/core/AppShell.js',
  '/assets/js/core/VerseManager.js',
  '/assets/js/core/TapTempo.js',
  '/assets/js/core/AudioUnlocker.js',
  '/assets/js/core/MidiEngine.js',
  '/assets/js/core/SongLoaderCore.js',
  '/assets/js/core/OSMDRenderCore.js',
  '/assets/js/core/ErrorReporter.js',
  '/assets/js/core/BootRunner.js',
  '/assets/js/core/ServiceWorkerManager.js',
  '/assets/js/core/OfflineSetlistManager.js',
  '/assets/js/osmd-svg-text.js',
  '/assets/js/compact-score.js',
  '/assets/js/osmd-transpose-speller.js',
  '/assets/js/osmd-renderer.js',
  '/assets/js/lyric-extractor.js',
  '/assets/js/transpose-engine.js',
  '/assets/js/session-tracker.js',
  '/assets/js/auth.js',
  '/assets/js/history-manager.js',
  '/assets/js/url-state.js',
  '/assets/js/modals/HelpModal.js',
  '/assets/js/modals/TransposePickerModal.js',
  '/assets/js/modals/TempoPickerSheet.js',
  '/assets/js/modals/ServicePlanAssignModal.js',
  '/assets/js/modals/PracticeTeamBoardModal.js',
  '/assets/js/core/ChordSetNames.js',
  '/assets/js/library-gestures.js',
  '/assets/js/library-list.js',
  '/assets/js/song-navigation.js',
  '/assets/js/core/LibrarySearch.js',
  '/assets/js/core/LibraryData.js',
  '/assets/js/library-ui.js',
  '/assets/js/modals/QuickNumpadModal.js',
  '/assets/js/service-plan-ui.js',
  '/assets/js/leader-notes-banner.js',
  '/assets/js/liturgy-card.js',
  '/assets/js/setlist-player.js',
  '/assets/js/setlist-list.js',
  '/assets/js/setlist-detail.js',
  '/assets/js/setlist-ui.js',
  '/assets/js/importer.js',
  '/assets/js/admin-ui.js',
  '/assets/js/display-settings.js',
  '/assets/js/stage-lens.js',
  '/assets/js/guitar-lens.js',
  '/assets/js/bass-lens.js',
  '/assets/js/drums-lens.js',
  '/assets/js/vocals-lens.js',
  '/assets/js/harmonic-numeral.js',
  '/assets/js/core/ChordCanvasCore.js',
  '/assets/js/chord-canvas-xml.js',
  '/assets/js/chord-canvas-ui.js',
  '/assets/js/chord-canvas-transpose.js',
  '/assets/js/chord-canvas-dots.js',
  '/assets/js/chord-canvas-edit.js',
  '/assets/js/chord-canvas.js',
  '/assets/js/annotation-geometry.js',
  '/assets/js/annotation-panel.js',
  '/assets/js/annotation-canvas.js',
  '/assets/js/performance-notes.js',
  '/assets/js/instruments.js',
  '/assets/js/audio-player.js',
  '/assets/js/metronome.js',
  '/assets/js/auto-scroller.js',
  '/assets/js/page-nav.js',
  '/assets/js/app-ui.js',
  '/assets/js/song-info-bar.js',
  '/assets/js/live-sync.js',
  '/assets/js/follow-leader.js',
  '/assets/js/song-preloader.js',
  '/assets/js/song-loader.js',
  '/assets/js/keyboard-handler.js',
  '/assets/js/toolbar-controller.js',
  '/assets/js/mobile-controller.js',
  '/assets/js/app.js',
  '/assets/js/fab.js',
  '/old/assets/css/base.css',
  '/old/assets/css/layout.css',
  '/old/assets/css/sheet.css',
  '/old/assets/css/components.css',
  '/old/assets/css/control-deck.css',
  '/old/assets/css/ui-scale.css',
  '/old/assets/js/osmd-renderer.js',
  '/old/assets/js/auth.js',
  '/old/assets/js/library-ui.js',
  '/old/assets/js/setlist-ui.js',
  '/old/assets/js/importer.js',
  '/old/assets/js/admin-ui.js',
  '/old/assets/js/display-settings.js',
  '/old/assets/js/chord-canvas-xml.js',
  '/old/assets/js/chord-canvas-ui.js',
  '/old/assets/js/chord-canvas-dots.js',
  '/old/assets/js/chord-canvas.js',
  '/old/assets/js/performance-notes.js',
  '/old/assets/js/instruments.js',
  '/old/assets/js/metronome.js',
  '/old/assets/js/auto-scroller.js',
  '/old/assets/js/page-nav.js',
  '/old/assets/js/app-ui.js',
  '/old/assets/js/song-info-bar.js',
  '/old/assets/js/song-loader.js',
  '/old/assets/js/keyboard-handler.js',
  '/old/assets/js/toolbar-controller.js',
  '/old/assets/js/app.js',
  '/assets/js/performance/transport-clock.js',
  '/assets/js/performance/count-in-engine.js',
  '/assets/js/performance/musical-position.js',
  '/assets/js/performance/arrangement-engine.js',
  '/assets/js/performance/cue-engine.js',
  '/assets/js/performance/live-transport.js',
  '/assets/js/performance/qr-helper.js',
  '/assets/js/performance/live-session.js',
  '/assets/js/performance/performance-engine.js',
  '/api/index.php?route=songs',
].map(p => (SW_BASE && !p.startsWith(SW_BASE)) ? SW_BASE + p : p);

// Hash nội dung từng file (sinh bởi tools/generate_sw_manifest.php): khi có bản mới chỉ tải lại file đã đổi.
const PRECACHE_FILE_HASH = {"/assets/js/vendor/opensheetmusicdisplay.min.js":"6789884f","/assets/js/vendor/tonal.min.js":"6532ea09","/assets/js/vendor/idb-keyval.min.js":"03e490ee","/assets/js/vendor/Tone.js":"b1756484","/assets/js/vendor/OsmdAudioPlayer.min.js":"4b3551ce","/manifest.json":"f984a426","/favicon.svg":"a3fd2b22","/favicon.ico":"5b8ca4db","/assets/img/icon-192.png":"2e2dcf42","/assets/css/base.css":"6b34b934","/assets/css/layout.css":"5ecec3bd","/assets/css/sheet.css":"7fa07e2d","/assets/css/components.css":"cd9892db","/assets/css/instrument-annotations.css":"358d04d4","/assets/css/fab.css":"8d3334c3","/assets/css/app-shell.css":"0e78edf9","/assets/css/library-polish.css":"89850ec0","/assets/css/control-deck.css":"753fc40f","/assets/js/core/OfflineVault.js":"29b9b7b7","/assets/js/core/ScriptLoader.js":"aab11397","/assets/js/core/FeatureFlags.js":"7aee1a46","/assets/js/core/SafeHtml.js":"1eb7bae1","/assets/js/core/SafeStorage.js":"c91454a4","/assets/js/core/AppRules.js":"39762768","/assets/js/core/PointerTap.js":"7414377b","/assets/js/core/ControlDeck.js":"c5117927","/assets/js/core/KeyService.js":"ed2c8811","/assets/js/core/ApiService.js":"01512960","/assets/js/core/EventBus.js":"a2b1d6d3","/assets/js/core/Store.js":"5f609d19","/assets/js/core/XmlDocCache.js":"65b6fbda","/assets/js/core/ModalManager.js":"26f9f977","/assets/js/core/ModeManager.js":"a8d907b9","/assets/js/core/AppShell.js":"507b1cbb","/assets/js/core/VerseManager.js":"5f2f901e","/assets/js/core/TapTempo.js":"09cef5ac","/assets/js/core/AudioUnlocker.js":"d9a57ff1","/assets/js/core/MidiEngine.js":"9880f519","/assets/js/core/SongLoaderCore.js":"abcea1a3","/assets/js/core/OSMDRenderCore.js":"2e039603","/assets/js/core/ErrorReporter.js":"7a7bd983","/assets/js/core/BootRunner.js":"fa5d2861","/assets/js/core/ServiceWorkerManager.js":"ac96454f","/assets/js/core/OfflineSetlistManager.js":"05bd4876","/assets/js/osmd-svg-text.js":"b814a9dc","/assets/js/compact-score.js":"50c4e1d5","/assets/js/osmd-transpose-speller.js":"bf3c8555","/assets/js/osmd-renderer.js":"f162de06","/assets/js/lyric-extractor.js":"4ded76f0","/assets/js/transpose-engine.js":"62c3f986","/assets/js/session-tracker.js":"cf8cc862","/assets/js/auth.js":"998ce13e","/assets/js/history-manager.js":"8a77325e","/assets/js/url-state.js":"e93142e1","/assets/js/modals/HelpModal.js":"944fbd1a","/assets/js/modals/TransposePickerModal.js":"ad27248d","/assets/js/modals/TempoPickerSheet.js":"2eea8b4f","/assets/js/modals/ServicePlanAssignModal.js":"dbd34729","/assets/js/modals/PracticeTeamBoardModal.js":"48ffed9c","/assets/js/core/ChordSetNames.js":"6f9019d3","/assets/js/library-gestures.js":"d2e3ba87","/assets/js/library-list.js":"6156b4d4","/assets/js/song-navigation.js":"331b8ce4","/assets/js/core/LibrarySearch.js":"7336aa32","/assets/js/core/LibraryData.js":"1e5efd3f","/assets/js/library-ui.js":"613d2c95","/assets/js/modals/QuickNumpadModal.js":"95ff5a3e","/assets/js/service-plan-ui.js":"89b3b91d","/assets/js/leader-notes-banner.js":"323924f4","/assets/js/liturgy-card.js":"2d2808ba","/assets/js/setlist-player.js":"b4d9d3cb","/assets/js/setlist-list.js":"875920f6","/assets/js/setlist-detail.js":"b1da85b8","/assets/js/setlist-ui.js":"3b7e0f6d","/assets/js/importer.js":"66e3a063","/assets/js/admin-ui.js":"3651a2a5","/assets/js/display-settings.js":"c3e03d49","/assets/js/stage-lens.js":"7b634134","/assets/js/guitar-lens.js":"85b34028","/assets/js/bass-lens.js":"fe9d94ad","/assets/js/drums-lens.js":"9bffe7fc","/assets/js/vocals-lens.js":"14de19d1","/assets/js/harmonic-numeral.js":"3bf99f44","/assets/js/core/ChordCanvasCore.js":"1acd2805","/assets/js/chord-canvas-xml.js":"f612b552","/assets/js/chord-canvas-ui.js":"34fee7f8","/assets/js/chord-canvas-transpose.js":"3a7d5271","/assets/js/chord-canvas-dots.js":"24d53fea","/assets/js/chord-canvas-edit.js":"33abf766","/assets/js/chord-canvas.js":"8b0853ef","/assets/js/annotation-geometry.js":"da79549a","/assets/js/annotation-panel.js":"6100a3b7","/assets/js/annotation-canvas.js":"2f65f5d4","/assets/js/performance-notes.js":"7a2edb11","/assets/js/instruments.js":"acd3542c","/assets/js/audio-player.js":"6ee71c84","/assets/js/metronome.js":"ab72fd38","/assets/js/auto-scroller.js":"cd67f5bf","/assets/js/page-nav.js":"a32fa20f","/assets/js/app-ui.js":"716484ae","/assets/js/song-info-bar.js":"354f3ed6","/assets/js/live-sync.js":"6c4fc882","/assets/js/follow-leader.js":"1af8970c","/assets/js/song-preloader.js":"0a0aa212","/assets/js/song-loader.js":"48f824e7","/assets/js/keyboard-handler.js":"e9128e99","/assets/js/toolbar-controller.js":"ae2cace2","/assets/js/mobile-controller.js":"7f0b6817","/assets/js/app.js":"fc14615c","/assets/js/fab.js":"06f09198","/old/assets/css/base.css":"9d34ee5f","/old/assets/css/layout.css":"f6e54a14","/old/assets/css/sheet.css":"17fb73c6","/old/assets/css/components.css":"2cd0a780","/old/assets/css/control-deck.css":"01b6242c","/old/assets/css/ui-scale.css":"dde9a36e","/old/assets/js/osmd-renderer.js":"3640ac3b","/old/assets/js/auth.js":"5de4a1a3","/old/assets/js/library-ui.js":"dc06f4e6","/old/assets/js/setlist-ui.js":"2795e7b4","/old/assets/js/importer.js":"307108cc","/old/assets/js/admin-ui.js":"6f01131d","/old/assets/js/display-settings.js":"d7374930","/old/assets/js/chord-canvas-xml.js":"8c95adcc","/old/assets/js/chord-canvas-ui.js":"b98143ad","/old/assets/js/chord-canvas-dots.js":"59cd5675","/old/assets/js/chord-canvas.js":"68ed8962","/old/assets/js/performance-notes.js":"7a2edb11","/old/assets/js/instruments.js":"ea1070ef","/old/assets/js/metronome.js":"d492d552","/old/assets/js/auto-scroller.js":"4a88a89a","/old/assets/js/page-nav.js":"a2f06e06","/old/assets/js/app-ui.js":"4c8b82c4","/old/assets/js/song-info-bar.js":"bf1f63b5","/old/assets/js/song-loader.js":"8387eb0d","/old/assets/js/keyboard-handler.js":"cbfb2f04","/old/assets/js/toolbar-controller.js":"c3c80648","/old/assets/js/app.js":"121690e9","/assets/js/performance/transport-clock.js":"b8cc3d65","/assets/js/performance/count-in-engine.js":"780f5727","/assets/js/performance/musical-position.js":"088a198a","/assets/js/performance/arrangement-engine.js":"a55c077e","/assets/js/performance/cue-engine.js":"865098c8","/assets/js/performance/live-transport.js":"38b40b97","/assets/js/performance/qr-helper.js":"135456fa","/assets/js/performance/live-session.js":"edde94be","/assets/js/performance/performance-engine.js":"4426831f"};
const SW_HASH_HEADER = 'X-SheetApp-SW-Hash';

function precacheHash(url) {
  const path = (SW_BASE && url.startsWith(SW_BASE)) ? url.slice(SW_BASE.length) : url;
  return PRECACHE_FILE_HASH[path] || '';
}

/** Gắn hash vào bản lưu cache để lần cập nhật sau nhận ra file không đổi (bỏ mã nén: thân đã giải nén). */
async function withPrecacheHash(response, hash) {
  try {
    const headers = new Headers(response.headers);
    headers.delete('content-encoding'); headers.delete('content-length');
    headers.set(SW_HASH_HEADER, hash);
    return new Response(await response.blob(), { status: response.status, statusText: response.statusText, headers });
  } catch (_) {
    return response;
  }
}

async function safeAddAll(cache, urls) {
  return Promise.all(
    urls.map(async url => {
      try {
        const hash = precacheHash(url);
        // File không đổi từ bản trước: chép từ cache cũ, không tốn mạng (trước đây mỗi lần cập nhật
        // điện thoại tải lại cả ~150 file thẳng từ máy chủ gốc).
        const previous = await caches.match(url);
        if (hash && previous && previous.headers?.get?.(SW_HASH_HEADER) === hash) { await cache.put(url, previous); return; }
        // HTML / danh mục bài: đã được làm mới ở mỗi lần mở trang có mạng (network-first) → dùng lại bản gần nhất
        if (!hash && previous && !url.includes('/assets/')) { await cache.put(url, previous); return; }
        // URL theo hash từng file: CDN (Cloudflare) giữ được bản đúng, file đổi mới có URL mới.
        const busted = url + (url.includes('?') ? '&' : '?') + 'swv=' + (hash || SW_MANIFEST_HASH);
        const response = await fetch(busted, { cache: hash ? 'default' : 'reload' });
        if (!response.ok) throw new Error('HTTP ' + response.status);
        await cache.put(url, hash ? await withPrecacheHash(response, hash) : response);
      } catch (err) {
        console.warn('[SW] Failed to cache:', url, err);
      }
    })
  );
}

// ── Install: pre-cache vendor libs & core assets ──────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_VENDOR).then(c => safeAddAll(c, PRECACHE_VENDOR)),
      caches.open(CACHE_APP).then(c => safeAddAll(c, PRECACHE_APP)),
    ]).then(() => self.skipWaiting())
  );
});

// ── Activate: xóa cache của các version cũ nhưng giữ nguyên cache offline của người dùng ────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_VENDOR && k !== CACHE_APP && k !== CACHE_MUSICXML && !k.startsWith('sheetapp-offline-'))
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Messages: xóa cache XML theo yêu cầu từ Editor / App ─────────
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'CLEAR_XML_CACHE') {
    const targetUrl = event.data.url;
    if (targetUrl) {
      caches.open(CACHE_MUSICXML).then(cache => cache.delete(targetUrl)).catch(() => {});
    } else {
      caches.delete(CACHE_MUSICXML).catch(() => {});
    }
  }
});

// ── Fetch: routing strategy ───────────────────────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // 1. API: Network Only (không cache), NGOẠI TRỪ danh mục bài hát cho offline fallback
  if (url.pathname.includes('/api/')) {
    if (event.request.method === 'GET' && url.searchParams.get('route') === 'songs'
        && Array.from(url.searchParams.keys()).every(key => key === 'route')) {
      event.respondWith(networkFirstForApiSongs(event.request, CACHE_APP));
      return;
    }
    return; // browser xử lý bình thường
  }

  // 2. Vendor JS: Cache First (files này không bao giờ thay đổi)
  if (url.pathname.includes('/assets/js/vendor/')) {
    event.respondWith(cacheFirst(event.request, CACHE_VENDOR));
    return;
  }

  // 3. MusicXML Files: Network First với quota & offline fallback
  if (url.pathname.includes('/storage/')) {
    event.respondWith(networkFirstWithQuota(event.request, CACHE_MUSICXML, MAX_MUSICXML_CACHE_ITEMS));
    return;
  }

  // 4. App JS/CSS: Stale While Revalidate
  if (url.pathname.includes('/assets/')) {
    event.respondWith(staleWhileRevalidate(event.request, CACHE_APP));
    return;
  }

  // 5. HTML (index.php): Network First cho điều hướng, khi offline trả app shell bỏ qua query string
  if (event.request.mode === 'navigate' && (!event.request.method || event.request.method === 'GET')) {
    event.respondWith(networkFirstForNavigation(event.request, CACHE_APP));
    return;
  }
});

// ── Cache strategies ──────────────────────────────────────────────

/** Network First cho API danh sách bài hát: lấy mới khi online, trả cache khi offline */
async function networkFirstForApiSongs(request, cacheName) {
  try {
    const response = await fetchWithTimeout(request, SW_FETCH_TIMEOUT_MS);
    if (response.ok && response.headers.get('X-SheetApp-Catalog-Scope') === 'public') {
      const cache = await caches.open(cacheName);
      await cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch (err) {
    const cache = await caches.open(cacheName);
    let cached = await cache.match(request);
    if (cached?.headers.get('X-SheetApp-Catalog-Scope') === 'public') return cached;
    const fallbackPath = SW_BASE ? `${SW_BASE}/api/index.php?route=songs` : '/api/index.php?route=songs';
    cached = await cache.match(fallbackPath);
    if (cached?.headers.get('X-SheetApp-Catalog-Scope') === 'public') return cached;
    throw err;
  }
}

/** Giới hạn số lượng file trong cache (FIFO/LRU eviction) tránh phình dung lượng */
async function limitCacheSize(cacheName, maxItems = 60) {
  try {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    if (keys.length > maxItems) {
      const toDelete = keys.slice(0, keys.length - maxItems);
      await Promise.all(toDelete.map(k => cache.delete(k)));
    }
  } catch (e) {}
}

/** Cache First: dùng cache nếu có, không thì fetch & cache */
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  let cached = await cache.match(request);
  if (!cached) {
    cached = await cache.match(request, { ignoreSearch: true });
  }
  if (cached) return cached;
  const response = await fetchWithTimeout(request, SW_FETCH_TIMEOUT_MS);
  if (response.ok) {
    cache.put(request, response.clone());
  }
  return response;
}

/** Network First có kiểm soát quota cho file MusicXML thường; khi offline fallback tìm cả trong cache gói ngoại tuyến */
async function networkFirstWithQuota(request, cacheName, maxItems = 60) {
  try {
    const response = await fetchWithTimeout(request, SW_FETCH_TIMEOUT_MS);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      await cache.put(request, response.clone());
      limitCacheSize(cacheName, maxItems);
    }
    return response;
  } catch (err) {
    // 1. Kiểm tra trong cache mặc định (CACHE_MUSICXML)
    const defaultCache = await caches.open(cacheName);
    let cached = await defaultCache.match(request);
    if (cached) return cached;

    // 2. Kiểm tra trong toàn bộ CacheStorage (tìm thấy ngay cả trong sheetapp-offline-<setlistId>)
    cached = await caches.match(request);
    if (cached) return cached;

    cached = await caches.match(request, { ignoreSearch: true });
    if (cached) return cached;

    // 3. Quét trực tiếp các cache gói ngoại tuyến sheetapp-offline-*
    const keys = await caches.keys();
    const offlineCacheKeys = keys.filter(k => k.startsWith('sheetapp-offline-'));
    for (const key of offlineCacheKeys) {
      const offlineCache = await caches.open(key);
      const match = await offlineCache.match(request, { ignoreSearch: true });
      if (match) return match;
    }

    throw err;
  }
}

/** Stale While Revalidate: trả cache ngay, update ngầm */
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  let fetchErr = null;
  const fetchPromise = fetchWithTimeout(request, SW_FETCH_TIMEOUT_MS).then(response => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(err => { fetchErr = err; return null; });

  if (cached) return cached;
  // Trang xin phiên bản mới (?v=...) mà cache chưa có đúng bản đó: ưu tiên mạng để HTML và JS/CSS
  // không lệch phiên bản; chỉ dùng bản cũ bỏ qua query khi mất mạng.
  const fresh = await fetchPromise;
  if (fresh) return fresh;
  const reqUrl = new URL(typeof request === 'string' ? request : request.url, self.location?.origin || 'http://localhost');
  const isOnline = (self.navigator && typeof self.navigator.onLine === 'boolean') ? self.navigator.onLine : (fetchErr ? !!fetchErr.isTimeout : true);
  if (reqUrl.searchParams.has('v') && isOnline) return Response.error();
  return (await cache.match(request, { ignoreSearch: true })) ?? Response.error();
}

/** Network First cho điều hướng: khi offline trả app shell đã cache, bỏ qua query string */
async function networkFirstForNavigation(request, cacheName) {
  const pathname = new URL(request.url).pathname;
  const base = SW_BASE || '';
  const shell = [base + '/', base + '/index.php'].includes(pathname) ? base + '/'
    : [base + '/old/', base + '/old/index.php'].includes(pathname) ? base + '/old/' : null;
  if (!shell) return fetch(request);
  try {
    const response = await fetchWithTimeout(request, SW_FETCH_TIMEOUT_MS);
    if (response.ok && shell) {
      const cache = await caches.open(cacheName);
      await cache.put(request, response.clone()).catch(() => {});
      await cache.put(new URL(shell, request.url).href, response.clone()).catch(() => {});
    }
    return response;
  } catch (err) {
    if (!shell) throw err;
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request, { ignoreSearch: true }) || await cache.match(shell, { ignoreSearch: true });
    if (cached) return cached;
    throw err;
  }
}
// ── Web Push Notifications (Epic 4.4) ─────────────────────────────
self.addEventListener('push', event => {
  let data = { title: 'SheetApp', body: 'Bạn có thông báo mới từ ban hát/chương trình', url: SW_BASE || '/' };
  if (event.data) {
    try {
      data = Object.assign(data, event.data.json());
    } catch (e) {
      data.body = event.data.text() || data.body;
    }
  }

  const options = {
    body: data.body,
    icon: (SW_BASE || '') + '/favicon.svg',
    badge: (SW_BASE || '') + '/favicon.svg',
    data: {
      url: data.url || (SW_BASE || '/')
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || (SW_BASE || '/');

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      for (const client of windowClients) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

