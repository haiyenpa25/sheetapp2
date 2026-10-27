'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '../..');
const apiServiceCode = fs.readFileSync(path.join(root, 'assets/js/core/ApiService.js'), 'utf8');

let total = 0;
let failed = 0;

function check(ok, msg) {
  total++;
  if (!ok) {
    failed++;
    console.log(`[FAIL:B] ${msg}`);
  } else {
    console.log(`[PASS:B] ${msg}`);
  }
}

(async () => {
  let requestDelayMs = 20000;
  let lastTimeoutMsScheduled = 0;

  class MockFormData {}

  const win = {
    __APP_BASE__: '',
    location: { pathname: '/index.php' },
    navigator: { onLine: true },
    AbortController,
    FormData: MockFormData,
    // Virtual time scale: 1ms real = 1000ms virtual so 20s vs 12s / 120s races deterministically in <30ms
    setTimeout: (fn, ms) => {
      lastTimeoutMsScheduled = ms;
      return setTimeout(fn, Math.max(1, Math.round(ms / 1000)));
    },
    clearTimeout,
  };

  const ctx = vm.createContext({
    window: win,
    document: { cookie: 'XSRF-TOKEN=test-csrf' },
    navigator: win.navigator,
    FormData: MockFormData,
    URLSearchParams,
    AbortController,
    setTimeout: win.setTimeout,
    clearTimeout,
    fetch: (url, opts = {}) => {
      return new Promise((resolve, reject) => {
        const t = setTimeout(() => {
          resolve({
            ok: true,
            status: 200,
            json: async () => ({ success: true, url }),
            text: async () => 'OK',
          });
        }, Math.max(1, Math.round(requestDelayMs / 1000)));
        if (opts.signal) {
          opts.signal.addEventListener('abort', () => {
            clearTimeout(t);
            const err = new Error('The operation was aborted');
            err.name = 'AbortError';
            reject(err);
          });
        }
      });
    },
    console,
  });
  win.window = win;
  vm.runInContext(apiServiceCode, ctx);

  // 1. Slow POST (20s) should succeed without being aborted at 12s
  requestDelayMs = 20000;
  let postRes = null;
  let postErr = null;
  try {
    postRes = await win.ApiService._request('api/index.php?route=importer&action=upload', {
      method: 'POST',
      body: new MockFormData(),
    });
  } catch (err) {
    postErr = err;
  }

  check(
    postErr === null && postRes?.success === true && lastTimeoutMsScheduled >= 120000,
    `Slow 20s POST upload succeeds without 12s timeout abort (scheduledTimeout=${lastTimeoutMsScheduled}ms, err=${postErr ? postErr.message : 'none'})`,
  );

  // 2. Slow GET (20s) still times out at 12s (DEFAULT_TIMEOUT_MS)
  requestDelayMs = 20000;
  let getErr = null;
  try {
    await win.ApiService._request('api/index.php?route=songs', { retry: false });
  } catch (err) {
    getErr = err;
  }

  check(
    getErr !== null && getErr.timeout === true && lastTimeoutMsScheduled === 12000,
    `Slow 20s GET still times out at 12000ms (scheduledTimeout=${lastTimeoutMsScheduled}ms, timeout=${Boolean(getErr?.timeout)})`,
  );

  console.log(`SUITE_COMPLETE total=${total}`);
  process.exit(failed > 0 ? 1 : 0);
})();
