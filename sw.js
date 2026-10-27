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
const SW_MANIFEST_HASH = '940cf0ec84';
const SW_VENDOR_HASH = 'e8b6692a09';
const CACHE_VENDOR   = `sheetapp-vendor-${SW_VENDOR_HASH}`;
const CACHE_APP      = `sheetapp-app-${SW_VERSION}-${SW_MANIFEST_HASH}`;
const CACHE_MUSICXML = `sheetapp-musicxml-${SW_VERSION}`;
const MAX_MUSICXML_CACHE_ITEMS = 60; // Giới hạn cache tránh phình dung lượng vô hạn
const SW_FETCH_TIMEOUT_MS = 4000;

async function fetchWithTimeout(request, timeoutMs = SW_FETCH_TIMEOUT_MS) {
  if (typeof setTimeout !== 'function') return fetch(request);
  let timer = null;
  try {
    return await Promise.race([
      fetch(request),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('SW fetch timeout')), timeoutMs);
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
  '/assets/js/core/OfflineVault.js',
  '/assets/js/core/ScriptLoader.js',
  '/assets/js/core/FeatureFlags.js',
  '/assets/js/core/SafeHtml.js',
  '/assets/js/core/SafeStorage.js',
  '/assets/js/core/PointerTap.js',
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

async function safeAddAll(cache, urls) {
  return Promise.all(
    urls.map(async url => {
      try {
        // URL trơn bị CDN (Cloudflare) giữ tới 7 ngày: thêm hash manifest để luôn lấy bản mới từ origin,
        // nhưng lưu dưới URL gốc để các lượt match ignoreSearch vẫn tìm thấy.
        const busted = url + (url.includes('?') ? '&' : '?') + 'swv=' + SW_MANIFEST_HASH;
        const response = await fetch(busted, { cache: 'reload' });
        if (!response.ok) throw new Error('HTTP ' + response.status);
        await cache.put(url, response);
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
  if (event.request.mode === 'navigate') {
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
  const fetchPromise = fetchWithTimeout(request, SW_FETCH_TIMEOUT_MS).then(response => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => null);

  if (cached) return cached;
  // Trang xin phiên bản mới (?v=...) mà cache chưa có đúng bản đó: ưu tiên mạng để HTML và JS/CSS
  // không lệch phiên bản; chỉ dùng bản cũ bỏ qua query khi mất mạng.
  const fresh = await fetchPromise;
  if (fresh) return fresh;
  return (await cache.match(request, { ignoreSearch: true })) ?? Response.error();
}

/** Network First cho điều hướng: khi offline trả app shell đã cache, bỏ qua query string */
async function networkFirstForNavigation(request, cacheName) {
  const pathname = new URL(request.url).pathname;
  const base = SW_BASE || '';
  const shell = [base + '/', base + '/index.php'].includes(pathname) ? base + '/'
    : [base + '/old/', base + '/old/index.php'].includes(pathname) ? base + '/old/' : null;
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

