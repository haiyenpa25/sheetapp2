/**
 * sw.js — SheetApp Service Worker
 * Chiến lược:
 *   - vendor/   → Cache First (immutable, cache mãi)
 *   - assets/   → Stale While Revalidate (dùng cache, update ngầm)
 *   - api/      → Network Only (luôn lấy data mới)
 */
'use strict';

const SW_VERSION   = 'v3';
const CACHE_VENDOR = `sheetapp-vendor-${SW_VERSION}`;
const CACHE_APP    = `sheetapp-app-${SW_VERSION}`;
const CACHE_MUSICXML = `sheetapp-musicxml-${SW_VERSION}`;

// ── Tài nguyên pre-cache khi install ──────────────────────────────
const PRECACHE_VENDOR = [
  '/assets/js/vendor/opensheetmusicdisplay.min.js',
  '/assets/js/vendor/Tone.js',
  '/assets/js/vendor/OsmdAudioPlayer.min.js',
  '/assets/js/vendor/tonal.min.js',
];

const PRECACHE_APP = [
  '/',
  '/assets/css/base.css',
  '/assets/css/layout.css',
  '/assets/css/sheet.css',
  '/assets/css/components.css',
  '/assets/css/fab.css',
];

// ── Install: pre-cache vendor libs ────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_VENDOR).then(c => c.addAll(PRECACHE_VENDOR)),
      caches.open(CACHE_APP).then(c => c.addAll(PRECACHE_APP)),
    ]).then(() => self.skipWaiting())
  );
});

// ── Activate: xóa cache cũ ────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_VENDOR && k !== CACHE_APP && k !== CACHE_MUSICXML)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: routing strategy ───────────────────────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // 1. API: Network Only (không cache)
  if (url.pathname.startsWith('/api/')) {
    return; // browser xử lý bình thường
  }

  // 2. Vendor JS: Cache First (files này không bao giờ thay đổi)
  if (url.pathname.startsWith('/assets/js/vendor/')) {
    event.respondWith(cacheFirst(event.request, CACHE_VENDOR));
    return;
  }

  // 3. MusicXML Files: Stale While Revalidate (đảm bảo offline)
  if (url.pathname.startsWith('/storage/')) {
    event.respondWith(staleWhileRevalidate(event.request, CACHE_MUSICXML));
    return;
  }

  // 4. App JS/CSS: Stale While Revalidate
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(staleWhileRevalidate(event.request, CACHE_APP));
    return;
  }

  // 5. HTML (index.php): Network First với cache fallback
  if (event.request.mode === 'navigate') {
    event.respondWith(networkFirst(event.request, CACHE_APP));
    return;
  }
});


// ── Cache strategies ──────────────────────────────────────────────

/** Cache First: dùng cache nếu có, không thì fetch & cache */
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(cacheName);
    cache.put(request, response.clone());
  }
  return response;
}

/** Stale While Revalidate: trả cache ngay, update ngầm */
async function staleWhileRevalidate(request, cacheName) {
  const cache    = await caches.open(cacheName);
  const cached   = await cache.match(request);
  const fetchPromise = fetch(request).then(response => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => null);

  return cached ?? (await fetchPromise);
}

/** Network First: thử mạng, fallback cache nếu offline */
async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return caches.match(request);
  }
}
