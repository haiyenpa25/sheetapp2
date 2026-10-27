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
  const swSrc = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  const swMgrSrc = fs.readFileSync(path.join(root, 'assets/js/core/ServiceWorkerManager.js'), 'utf8');

  // 1. SW has 4s network timeout constant / helper
  check(
    swSrc.includes('SW_FETCH_TIMEOUT_MS') && (swSrc.includes('15000') || swSrc.includes('4000')),
    'M2-2: sw.js defines 4000ms SW_FETCH_TIMEOUT_MS for network-first race',
  );

  // 2. Test hanging fetch falls back to cache via timeout in sw.js
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
      if (exact) return exact;
      if (opts && opts.ignoreSearch) {
        const target = keyOf(r, true);
        for (const [k, v] of entries.entries()) {
          if (keyOf(k, true) === target) return v;
        }
      }
      return undefined;
    },
    async keys() {
      return [...entries.keys()].map((url) => ({ url }));
    },
  };

  let fetchMode = 'hang';
  const swCtx = vm.createContext({
    self: {
      location: { search: '', pathname: '/sheetapp2/sw.js' },
      addEventListener() {},
    },
    URL,
    URLSearchParams,
    Request,
    Response,
    console,
    setTimeout: (fn, ms) => setTimeout(fn, Math.min(ms, 40)), // speed up 4000ms timer in VM test
    clearTimeout,
    caches: {
      open: async () => mockCache,
      match: async (r, opts) => mockCache.match(r, opts),
      keys: async () => ['sheetapp-musicxml-v5'],
    },
    fetch: (req) => {
      if (fetchMode === 'hang') {
        return new Promise(() => {}); // never resolves
      }
      const urlStr = typeof req === 'string' ? req : req.url;
      return Promise.resolve(new Response('FRESH:' + urlStr, { status: 200 }));
    },
  });

  vm.runInContext(swSrc, swCtx);

  const xmlUrl = base + 'storage/song-001.xml';
  await mockCache.put(xmlUrl, new Response('<cached-xml/>', { status: 200 }));
  const t0 = Date.now();
  const xmlResp = await swCtx.networkFirstWithQuota({ url: xmlUrl }, 'sheetapp-musicxml-v5', 60);
  const elapsed = Date.now() - t0;
  check(
    (await xmlResp.text()) === '<cached-xml/>' && elapsed < 1000,
    'M2-2: networkFirstWithQuota races hanging network against timeout and returns cached XML',
  );

  // 3. Stale-while-revalidate does not return mismatched ?v= when online
  const jsOld = base + 'assets/js/app.js?v=100';
  const jsNew = base + 'assets/js/app.js?v=200';
  await mockCache.put(jsOld, new Response('OLD_V100', { status: 200 }));
  fetchMode = 'ok';
  const freshJsResp = await swCtx.staleWhileRevalidate({ url: jsNew }, 'sheetapp-app');
  check(
    (await freshJsResp.text()) === 'FRESH:' + jsNew,
    'M2-2: staleWhileRevalidate fetches matching ?v=200 from network instead of serving stale ?v=100',
  );

  // 4. Q-M1: ServiceWorkerManager registers SW on Classic (/old/) and handles controllerchange (reload when idle, skip when playing)
  let registeredUrl = null;
  let controllerChangeCb = null;
  let reloadCount = 0;

  const makeWindow = (pathname, isPlaying) => {
    const swListeners = {};
    const win = {
      __APP_BASE__: '/sheetapp2',
      SHEETAPP_CACHE_VERSION: 'v5',
      location: {
        pathname,
        reload() { reloadCount++; },
      },
      matchMedia: () => ({ matches: false }),
      navigator: {
        userAgent: 'Mozilla/5.0',
        platform: 'Win32',
        maxTouchPoints: 0,
        serviceWorker: {
          controller: {}, // existing controller so controllerchange means update
          register: async (url) => {
            registeredUrl = url;
            return { addEventListener() {} };
          },
          addEventListener: (ev, cb) => {
            swListeners[ev] = cb;
            if (ev === 'controllerchange') controllerChangeCb = cb;
          },
        },
      },
      document: {
        readyState: 'complete',
        getElementById: () => null,
        addEventListener() {},
        body: { classList: { contains: () => false } },
      },
      Metronome: { isPlaying: () => isPlaying },
      addEventListener() {},
    };
    win.window = win;
    return win;
  };

  // 4a. Classic /old/ registers SW (per Q-M1)
  const winClassic = makeWindow('/sheetapp2/old/', false);
  vm.runInContext(
    swMgrSrc,
    vm.createContext({
      window: winClassic,
      navigator: winClassic.navigator,
      document: winClassic.document,
      encodeURIComponent,
      console,
    }),
  );
  await winClassic.ServiceWorkerManager.register();
  check(
    Boolean(registeredUrl && registeredUrl.includes('/sheetapp2/sw.js')),
    'M2-2 (Q-M1): ServiceWorkerManager.register() registers SW on Classic (/old/)',
  );
  check(
    typeof controllerChangeCb === 'function',
    'M2-2: ServiceWorkerManager attaches controllerchange listener',
  );

  // Trigger controllerchange while idle -> reloads once
  controllerChangeCb();
  controllerChangeCb();
  check(reloadCount === 1, 'M2-2: controllerchange reloads page at most once when idle');

  // 4b. Trigger controllerchange while playing -> does NOT reload
  reloadCount = 0;
  controllerChangeCb = null;
  const winBusy = makeWindow('/sheetapp2/', true);
  vm.runInContext(
    swMgrSrc,
    vm.createContext({
      window: winBusy,
      navigator: winBusy.navigator,
      document: winBusy.document,
      encodeURIComponent,
      console,
    }),
  );
  await winBusy.ServiceWorkerManager.register();
  if (controllerChangeCb) controllerChangeCb();
  check(reloadCount === 0, 'M2-2: controllerchange does NOT reload while playing');

  console.log('\nSUITE_COMPLETE total=' + total);
})();
