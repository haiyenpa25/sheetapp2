const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '../..');
const apiServiceCode = fs.readFileSync(path.join(root, 'assets/js/core/ApiService.js'), 'utf8');
const songLoaderCoreCode = fs.readFileSync(path.join(root, 'assets/js/core/SongLoaderCore.js'), 'utf8');

let total = 0;
let failed = 0;

function check(condition, message, details = '') {
  total++;
  if (condition) {
    console.log(`[PASS:B] ${message}`);
  } else {
    failed++;
    console.log(`[FAIL:B] ${message}${details ? ' -> ' + details : ''}`);
  }
}

function createEnv(customFetch, online = true, timeoutMs = 40) {
  const win = {
    __APP_BASE__: '',
    __API_TIMEOUT_MS__: timeoutMs,
    location: { pathname: '/index.php' },
    navigator: { onLine: online },
    AbortController,
    setTimeout,
    clearTimeout,
  };
  const ctx = vm.createContext({
    window: win,
    document: { cookie: 'XSRF-TOKEN=test-csrf' },
    navigator: win.navigator,
    URLSearchParams,
    AbortController,
    setTimeout,
    clearTimeout,
    fetch: customFetch,
    console,
  });
  win.window = win;
  vm.runInContext(apiServiceCode, ctx);
  vm.runInContext(songLoaderCoreCode, ctx);
  return { win, ctx };
}

(async () => {
  // 1. Constant DEFAULT_TIMEOUT_MS = 12000
  {
    const { win } = createEnv(async () => ({ ok: true, json: async () => ({}) }));
    check(
      win.ApiService.DEFAULT_TIMEOUT_MS === 12000,
      'M2-1: ApiService exposes DEFAULT_TIMEOUT_MS = 12000',
      `got ${win.ApiService.DEFAULT_TIMEOUT_MS}`
    );
  }

  // 2. Hanging request -> aborts via AbortController and rejects after timeout with {offline, timeout, status}
  {
    let signalAborted = false;
    let attempts = 0;
    const { win } = createEnv((url, opts = {}) => {
      attempts++;
      return new Promise((resolve, reject) => {
        if (opts.signal) {
          opts.signal.addEventListener('abort', () => {
            signalAborted = true;
            const err = new Error('The operation was aborted');
            err.name = 'AbortError';
            reject(err);
          });
        }
      });
    }, true, 35);

    let caught = null;
    try {
      await win.ApiService._request('api/index.php?route=songs', { retry: false, timeoutMs: 35 });
    } catch (err) {
      caught = err;
    }

    check(
      caught !== null && signalAborted === true,
      'M2-1: Hanging request aborts via AbortController and rejects after timeout',
      `caught=${Boolean(caught)}, signalAborted=${signalAborted}`
    );
    check(
      caught !== null && caught.timeout === true && caught.offline === false && caught.status === 0,
      'M2-1: Timeout error has unified shape {offline: false, timeout: true, status: 0}',
      `got ${JSON.stringify({ offline: caught?.offline, timeout: caught?.timeout, status: caught?.status })}`
    );
  }

  // 3. GET fails on attempt 1 (network error), succeeds on attempt 2 -> resolves
  {
    let calls = 0;
    const { win } = createEnv(async () => {
      calls++;
      if (calls === 1) {
        throw new TypeError('Failed to fetch');
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true, items: ['song-1'] }),
      };
    }, true, 100);

    let res = null;
    let errCaught = null;
    try {
      res = await win.ApiService._request('api/index.php?route=songs&action=taxonomy');
    } catch (e) {
      errCaught = e;
    }

    check(
      errCaught === null && calls === 2 && res?.success === true,
      'M2-1: GET request failing on attempt 1 retries once and succeeds on attempt 2',
      `calls=${calls}, err=${errCaught?.message}`
    );
  }

  // 4. GET fails on attempt 1 (HTTP 502), succeeds on attempt 2 -> resolves
  {
    let calls = 0;
    const { win } = createEnv(async () => {
      calls++;
      if (calls === 1) {
        return {
          ok: false,
          status: 502,
          json: async () => ({ error: 'Bad Gateway' }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
      };
    }, true, 100);

    let res = null;
    try {
      res = await win.ApiService._request('api/index.php?route=categories');
    } catch (_) {}

    check(
      calls === 2 && res?.ok === true,
      'M2-1: GET request returning HTTP 502 on attempt 1 retries once and succeeds on attempt 2',
      `calls=${calls}, res=${JSON.stringify(res)}`
    );
  }

  // 5. Non-GET (POST) does NOT retry on failure and returns unified shape {offline, timeout, status}
  {
    let calls = 0;
    const { win } = createEnv(async () => {
      calls++;
      return {
        ok: false,
        status: 500,
        json: async () => ({ error: 'Server error' }),
      };
    }, true, 100);

    let caught = null;
    try {
      await win.ApiService._request('api/index.php?route=setlists', { method: 'POST', body: '{}' });
    } catch (e) {
      caught = e;
    }

    check(
      calls === 1 && caught !== null && caught.status === 500 && caught.timeout === false && caught.offline === false,
      'M2-1: POST request does not retry and rejects with {offline: false, timeout: false, status: 500}',
      `calls=${calls}, err=${JSON.stringify({ offline: caught?.offline, timeout: caught?.timeout, status: caught?.status })}`
    );
  }

  // 6. Offline network failure returns {offline: true, timeout: false, status: 0}
  {
    const { win } = createEnv(async () => {
      throw new TypeError('Failed to fetch');
    }, false, 100);

    let caught = null;
    try {
      await win.ApiService._request('api/index.php?route=categories');
    } catch (e) {
      caught = e;
    }

    check(
      caught !== null && caught.offline === true && caught.timeout === false && caught.status === 0,
      'M2-1: Offline network failure rejects with {offline: true, timeout: false, status: 0}',
      `got ${JSON.stringify({ offline: caught?.offline, timeout: caught?.timeout, status: caught?.status })}`
    );
  }

  // 7. XML loading has timeout via AbortController and retries 1 time on GET
  {
    let xmlCalls = 0;
    const { win } = createEnv(async (url, opts = {}) => {
      xmlCalls++;
      if (xmlCalls === 1) {
        throw new TypeError('Transient network error');
      }
      return {
        ok: true,
        status: 200,
        text: async () => '<score-partwise><work><work-title>OK</work-title></work></score-partwise>',
        json: async () => ({ success: true, chords: [] }),
      };
    }, true, 50);

    let result = null;
    try {
      result = await win.SongLoaderCore.fetchXmlWithChords(
        { id: 'thanh-ca-001', xmlPath: 'storage/Thanh ca/001.xml' },
        'default'
      );
    } catch (_) {}

    check(
      xmlCalls === 2 && Boolean(result?.rawXml?.includes('<score-partwise>')),
      'M2-1: XML fetch retries once on transient error and resolves XML',
      `xmlCalls=${xmlCalls}, hasXml=${Boolean(result?.rawXml)}`
    );
  }

  console.log(`SUITE_COMPLETE total=${total}`);
  process.exitCode = failed === 0 ? 0 : 1;
})();
