'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '../..');
let total = 0;
let failed = 0;

function check(ok, msg, isBehavioral = true) {
  total++;
  const tag = isBehavioral ? 'B' : 'S';
  if (!ok) {
    failed++;
    console.log(`[FAIL:${tag}] ${msg}`);
  } else {
    console.log(`[PASS:${tag}] ${msg}`);
  }
}

(async () => {
  const swSrc = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

  const base = 'http://localhost/sheetapp2/';
  const entries = new Map();
  const keyOf = (r, ignoreSearch = false) => {
    const u = new URL(typeof r === 'string' ? r : r.url, base);
    if (ignoreSearch) u.search = '';
    return u.href;
  };
  const mockCache = {
    async put(r, resp) {
      entries.set(keyOf(r, false), resp);
    },
    async match(r, opts = {}) {
      const exact = entries.get(keyOf(r, false));
      if (exact) return exact.clone ? exact.clone() : exact;
      if (opts && opts.ignoreSearch) {
        const target = keyOf(r, true);
        for (const [k, v] of entries.entries()) {
          if (keyOf(k, true) === target) return v.clone ? v.clone() : v;
        }
      }
      return undefined;
    },
    async keys() {
      return [...entries.keys()].map((url) => ({ url }));
    },
  };

  let simulatedNetworkDelayMs = 8000;
  let networkOffline = false;
  let onlineFlag = true;
  let abortedSignals = 0;
  let lastTimeoutMsScheduled = 0;

  class MockAbortController {
    constructor() {
      this.signal = { aborted: false };
    }
    abort() {
      this.signal.aborted = true;
      abortedSignals++;
    }
  }

  const swCtx = vm.createContext({
    self: {
      location: { search: '', pathname: '/sheetapp2/sw.js', origin: 'http://localhost' },
      get navigator() {
        return { onLine: onlineFlag };
      },
      addEventListener() {},
    },
    AbortController: MockAbortController,
    URL,
    URLSearchParams,
    Request,
    Response,
    console,
    // Virtual time scale: 1ms real = 1000ms virtual so 8000ms vs 15000ms races deterministically in <30ms
    setTimeout: (fn, ms) => {
      lastTimeoutMsScheduled = ms;
      return setTimeout(fn, Math.max(1, Math.round(ms / 1000)));
    },
    clearTimeout,
    caches: {
      open: async () => mockCache,
      match: async (r, opts) => mockCache.match(r, opts),
      keys: async () => ['sheetapp-musicxml-v5'],
    },
    fetch: (req, init) => {
      if (networkOffline) {
        return Promise.reject(new Error('Failed to fetch: offline'));
      }
      const urlStr = typeof req === 'string' ? req : req.url;
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          if (init && init.signal && init.signal.aborted) {
            reject(new Error('Aborted'));
            return;
          }
          resolve(new Response('NETWORK:' + urlStr, { status: 200 }));
        }, Math.max(1, Math.round(simulatedNetworkDelayMs / 1000)));
      });
    },
  });

  vm.runInContext(swSrc, swCtx);

  // 1. Slow 8s network still receives network response (does not cut off at 4s)
  const xmlUrl = base + 'storage/song-001.xml';
  await mockCache.put(xmlUrl, new Response('CACHED_XML', { status: 200 }));
  simulatedNetworkDelayMs = 8000;
  networkOffline = false;
  onlineFlag = true;
  const slow8sResp = await swCtx.networkFirstWithQuota({ url: xmlUrl }, 'sheetapp-musicxml-v5', 60);
  const slow8sText = await slow8sResp.text();
  check(
    slow8sText === 'NETWORK:' + xmlUrl && lastTimeoutMsScheduled >= 15000,
    `Slow 8s network still receives network response (timeout=${lastTimeoutMsScheduled}ms, got=${slow8sText})`,
    true,
  );

  // 2. Hanging network (>15s) aborts via AbortController and falls back to cache
  await mockCache.put(xmlUrl, new Response('CACHED_XML', { status: 200 }));
  simulatedNetworkDelayMs = 25000;
  abortedSignals = 0;
  const timeoutResp = await swCtx.networkFirstWithQuota({ url: xmlUrl }, 'sheetapp-musicxml-v5', 60);
  const timeoutText = await timeoutResp.text();
  check(
    timeoutText === 'CACHED_XML' && abortedSignals >= 1,
    `Timed-out fetch aborts via AbortController (aborted=${abortedSignals}) and returns cached XML`,
    true,
  );

  // 3. Navigation to path without shell (/manager/, /learn/, /live-band/) calls fetch(request) directly without timeout race
  simulatedNetworkDelayMs = 2000;
  lastTimeoutMsScheduled = 0;
  const managerResp = await swCtx.networkFirstForNavigation({ url: base + 'manager/', mode: 'navigate' }, 'sheetapp-app');
  const managerText = await managerResp.text();
  check(
    managerText === 'NETWORK:' + base + 'manager/' && lastTimeoutMsScheduled === 0,
    'Navigation to /manager/ (no shell) calls fetch(request) directly without SW timeout race',
    true,
  );

  // 4. Online with failed/timed-out new ?v= asset never falls back to old cached version via ignoreSearch
  const jsOld = base + 'assets/js/app.js?v=100';
  const jsNew = base + 'assets/js/app.js?v=200';
  await mockCache.put(jsOld, new Response('OLD_V100', { status: 200 }));
  await mockCache.put(xmlUrl, new Response('CACHED_XML', { status: 200 }));
  simulatedNetworkDelayMs = 25000;
  onlineFlag = true;
  const onlineVersionedResp = await swCtx.staleWhileRevalidate({ url: jsNew }, 'sheetapp-app');
  const onlineVersionedText = onlineVersionedResp && onlineVersionedResp.ok ? await onlineVersionedResp.text() : 'ERROR_RESPONSE';
  check(
    onlineVersionedText !== 'OLD_V100',
    `When ONLINE, versioned asset ?v=200 never falls back to stale ?v=100 (got=${onlineVersionedText})`,
    true,
  );

  // 5. Offline returns cached asset via ignoreSearch
  networkOffline = true;
  onlineFlag = false;
  const offlineVersionedResp = await swCtx.staleWhileRevalidate({ url: jsNew }, 'sheetapp-app');
  const offlineVersionedText = offlineVersionedResp ? await offlineVersionedResp.text() : '';
  check(
    offlineVersionedText === 'OLD_V100',
    'When OFFLINE, staleWhileRevalidate falls back to cached asset via ignoreSearch',
    true,
  );

  console.log(`SUITE_COMPLETE total=${total}`);
  process.exit(failed > 0 ? 1 : 0);
})();
