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
const SW_MANIFEST_HASH = '526e3bccf9';
const CACHE_VENDOR   = `sheetapp-vendor-${SW_VERSION}`;
const CACHE_APP      = `sheetapp-app-${SW_VERSION}`;
const CACHE_MUSICXML = `sheetapp-musicxml-${SW_VERSION}`;
const MAX_MUSICXML_CACHE_ITEMS = 60; // Giới hạn cache tránh phình dung lượng vô hạn

const SW_BASE = self.location.pathname.replace(/\/sw\.js$/, '');

// ── Tài nguyên pre-cache khi install ──────────────────────────────
const PRECACHE_VENDOR = [
  '/assets/js/vendor/opensheetmusicdisplay.min.js',
  '/assets/js/vendor/tonal.min.js',
  '/assets/js/vendor/Tone.js',
  '/assets/js/vendor/OsmdAudioPlayer.min.js',
].map(p => SW_BASE + p);

const PRECACHE_APP = [
  (SW_BASE ? `${SW_BASE}/` : '/'),
  (SW_BASE ? `${SW_BASE}/index.php` : '/index.php'),
  '/manifest.json',
  '/favicon.svg',
  '/favicon.ico',
  '/assets/img/icon-192.png',
  '/assets/css/base.css',
  '/assets/css/layout.css',
  '/assets/css/sheet.css',
  '/assets/css/components.css',
  '/assets/css/fab.css',
  '/assets/css/app-shell.css',
  '/assets/js/core/ScriptLoader.js',
  '/assets/js/core/FeatureFlags.js',
  '/assets/js/core/SafeHtml.js',
  '/assets/js/core/KeyService.js',
  '/assets/js/core/ApiService.js',
  '/assets/js/core/EventBus.js',
  '/assets/js/core/Store.js',
  '/assets/js/core/XmlDocCache.js',
  '/assets/js/core/ModalManager.js',
  '/assets/js/core/ModeManager.js',
  '/assets/js/core/VerseManager.js',
  '/assets/js/core/SongLoaderCore.js',
  '/assets/js/core/OfflineSetlistManager.js',
  '/assets/js/core/ServiceWorkerManager.js',
  '/assets/js/osmd-svg-text.js',
  '/assets/js/osmd-renderer.js',
  '/assets/js/transpose-engine.js',
  '/assets/js/display-settings.js',
  '/assets/js/chord-canvas-xml.js',
  '/assets/js/chord-canvas-ui.js',
  '/assets/js/chord-canvas-dots.js',
  '/assets/js/chord-canvas.js',
  '/assets/js/song-info-bar.js',
  '/assets/js/song-loader.js',
  '/assets/js/library-ui.js',
  '/assets/js/app-ui.js',
  '/assets/js/toolbar-controller.js',
  '/assets/js/keyboard-handler.js',
  '/assets/js/mobile-controller.js',
  '/assets/js/app.js',
  '/assets/js/auth.js',
  '/api/index.php?route=songs',
].map(p => (SW_BASE && !p.startsWith(SW_BASE)) ? SW_BASE + p : p);

async function safeAddAll(cache, urls) {
  return Promise.all(
    urls.map(url =>
      cache.add(url).catch(err => {
        console.warn('[SW] Failed to cache:', url, err);
      })
    )
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
    if (url.searchParams.get('route') === 'songs' && !url.searchParams.has('action')) {
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
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cache = await caches.open(cacheName);
    let cached = await cache.match(request);
    if (cached) return cached;
    cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    const fallbackPath = SW_BASE ? `${SW_BASE}/api/index.php?route=songs` : '/api/index.php?route=songs';
    cached = await cache.match(fallbackPath);
    if (cached) return cached;
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
  const response = await fetch(request);
  if (response.ok) {
    cache.put(request, response.clone());
  }
  return response;
}

/** Network First có kiểm soát quota cho file MusicXML thường; khi offline fallback tìm cả trong cache gói ngoại tuyến */
async function networkFirstWithQuota(request, cacheName, maxItems = 60) {
  try {
    const response = await fetch(request);
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
  let cached = await cache.match(request);
  if (!cached) {
    cached = await cache.match(request, { ignoreSearch: true });
  }
  const fetchPromise = fetch(request).then(response => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => null);

  return cached ?? (await fetchPromise);
}

/** Network First cho điều hướng: khi offline trả app shell đã cache, bỏ qua query string */
async function networkFirstForNavigation(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());

      const baseAppShell = SW_BASE ? `${SW_BASE}/` : '/';
      const cleanUrl = new URL(request.url);
      if (cleanUrl.pathname === (SW_BASE ? `${SW_BASE}/` : '/') || cleanUrl.pathname.endsWith('/index.php')) {
        const cleanRequest = new Request(baseAppShell, { credentials: 'same-origin' });
        cache.put(cleanRequest, response.clone());
      }
    }
    return response;
  } catch (err) {
    // Khi offline: mọi request điều hướng (mode: 'navigate') trả app shell đã cache, bỏ qua query string (R-10 fix)
    const cache = await caches.open(cacheName);

    // 1. Thử match chính xác request bỏ qua search
    let cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;

    // 2. Thử match root URL app shell
    const baseAppShell = SW_BASE ? `${SW_BASE}/` : '/';
    cached = await cache.match(baseAppShell, { ignoreSearch: true });
    if (cached) return cached;

    cached = await cache.match(baseAppShell);
    if (cached) return cached;

    // 3. Thử match index.php
    const indexPath = SW_BASE ? `${SW_BASE}/index.php` : '/index.php';
    cached = await cache.match(indexPath, { ignoreSearch: true });
    if (cached) return cached;

    cached = await cache.match(indexPath);
    if (cached) return cached;

    // 4. Tìm kiếm match trong tất cả cache
    cached = await caches.match(baseAppShell, { ignoreSearch: true });
    if (cached) return cached;

    cached = await caches.match(indexPath, { ignoreSearch: true });
    if (cached) return cached;

    // 5. Quét tất cả keys trong cache để lấy bất kỳ entry HTML/shell nào
    const keys = await cache.keys();
    for (const k of keys) {
      try {
        const u = new URL(k.url);
        if (u.pathname === (SW_BASE ? `${SW_BASE}/` : '/') || u.pathname.endsWith('/index.php')) {
          const match = await cache.match(k);
          if (match) return match;
        }
      } catch (e) {}
    }

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

