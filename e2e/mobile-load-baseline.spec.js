// @ts-check
const { test, expect, devices } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const assertIsolatedRoot = require('./assert-isolated-root');

const ROOT = path.resolve(__dirname, '..');
const MARKER = assertIsolatedRoot(ROOT);
const SOURCE_ROOT = MARKER.sourceRoot;
const BASE_URL = MARKER.baseURL.replace(/\/$/, '') + '/';
const EVIDENCE_DIR = path.join(SOURCE_ROOT, 'docs', 'mobile-evidence');
const RAW_JSON_PATH = path.join(ROOT, 'test-results', 'm0-baseline-raw.json');
const REPORT_MD_PATH = path.join(EVIDENCE_DIR, 'M0-baseline.md');

const DEVICE_PROFILES = [
  { key: 'pixel7', label: 'Pixel 7 (412×915)', project: 'chromium', descriptor: devices['Pixel 7'] },
  { key: 'iphone13', label: 'iPhone 13 (390×844)', project: 'webkit', descriptor: devices['iPhone 13'] },
  { key: 'ipadmini', label: 'iPad Mini (768×1024)', project: 'webkit', descriptor: devices['iPad Mini'] },
];

const UIS = [
  { key: 'modern', label: 'Modern (/)', path: '?song=thanh-ca-001&v=sheet' },
  { key: 'classic', label: 'Classic (/old/)', path: 'old/?song=thanh-ca-001&v=sheet' },
];

const CONDITIONS = [
  { key: 'normal', label: 'Bình thường' },
  { key: 'slow4g', label: '4G chậm (150ms, 1.6Mbps/750kbps, CPU 4×)' },
  { key: 'drop10pct', label: 'Chặn ngẫu nhiên 10% JS/CSS/API (seed cố định)' },
];

function createSeededRng(seedStr) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let a = h >>> 0;
  return function nextRandom() {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function readRawStore() {
  if (!fs.existsSync(RAW_JSON_PATH)) return { m0_1: {}, m0_2: {} };
  try {
    return JSON.parse(fs.readFileSync(RAW_JSON_PATH, 'utf8'));
  } catch (_) {
    return { m0_1: {}, m0_2: {} };
  }
}

function writeRawStore(store) {
  fs.mkdirSync(path.dirname(RAW_JSON_PATH), { recursive: true });
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  const jsonText = JSON.stringify(store, null, 2).replace(/\r?\n/g, '\r\n');
  fs.writeFileSync(RAW_JSON_PATH, jsonText, 'utf8');
  renderMarkdownReport(store);
}

function renderMarkdownReport(store) {
  const lines = [];
  lines.push('# M0 Baseline — Đo mốc tải và màn đọc trên điện thoại, tablet');
  lines.push('');
  lines.push('> Số liệu đo trực tiếp bằng `e2e/mobile-load-baseline.spec.js` trên bản sao cách ly (`e2e/assert-isolated-root.js`). Không làm tròn, không ước lượng.');
  lines.push('');
  lines.push('## 1. M0-1 — Ma trận 2 giao diện × 3 thiết bị × 3 điều kiện (5 lần/tổ hợp, cache lạnh)');
  lines.push('');
  lines.push('| Giao diện | Thiết bị | Điều kiện | Số lần hỏng / 5 | Hiện danh sách (đạt/5) | Tên bài đúng (đạt/5) | Có SVG (đạt/5) | Thời gian tới SVG từng lần (ms) | Số request từng lần | Số byte truyền từng lần | Lỗi console từng lần | Request lỗi từng lần |');
  lines.push('|---|---|---|---:|---:|---:|---:|---|---|---|---|---|');

  for (const ui of UIS) {
    for (const dev of DEVICE_PROFILES) {
      for (const cond of CONDITIONS) {
        const comboKey = `${ui.key}__${dev.key}__${cond.key}`;
        const entry = store.m0_1[comboKey];
        if (!entry || !Array.isArray(entry.runs)) continue;
        const runs = entry.runs;
        const brokenCount = runs.filter(r => r.broken).length;
        const listPass = runs.filter(r => r.listOk).length;
        const titlePass = runs.filter(r => r.titleOk).length;
        const svgPass = runs.filter(r => r.svgOk).length;
        const svgTimes = runs.map(r => (r.svgMs === null ? 'FAIL' : String(r.svgMs))).join(', ');
        const reqCounts = runs.map(r => String(r.requests)).join(', ');
        const byteCounts = runs.map(r => String(r.bytes)).join(', ');
        const consoleErrs = runs.map(r => String(r.consoleErrors)).join(', ');
        const failedReqs = runs.map(r => String(r.failedRequests)).join(', ');
        const condNote = entry.throttleMode ? `${cond.label} [${entry.throttleMode}]` : cond.label;
        lines.push(`| ${ui.label} | ${dev.label} | ${condNote} | ${brokenCount}/5 | ${listPass}/5 | ${titlePass}/5 | ${svgPass}/5 | [${svgTimes}] | [${reqCounts}] | [${byteCounts}] | [${consoleErrs}] | [${failedReqs}] |`);
      }
    }
  }

  lines.push('');
  lines.push('### Chi tiết từng lần chạy M0-1 (dữ liệu thô)');
  lines.push('');
  lines.push('```json');
  lines.push(JSON.stringify(store.m0_1, null, 2));
  lines.push('```');
  lines.push('');

  const content = lines.join('\r\n') + '\r\n';
  fs.writeFileSync(REPORT_MD_PATH, content, 'utf8');
}

async function runSingleColdLoad(browser, browserName, dev, ui, cond, runIdx) {
  const context = await browser.newContext({
    ...dev.descriptor,
    baseURL: BASE_URL,
    serviceWorkers: 'block',
  });
  const page = await context.newPage();

  await page.addInitScript(() => {
    try {
      sessionStorage.setItem('sheetapp_guest_chosen', '1');
      localStorage.setItem('sheetapp_guest_toast_shown', '1');
    } catch (_) {}
  });

  let throttleMode = '';
  let abortedByRoute = 0;

  if (cond.key === 'slow4g') {
    if (browserName === 'chromium') {
      throttleMode = 'CDP 4G + CPU 4x';
      const cdp = await context.newCDPSession(page);
      await cdp.send('Network.enable');
      await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
      await cdp.send('Network.emulateNetworkConditions', {
        offline: false,
        latency: 150,
        downloadThroughput: 1600000 / 8,
        uploadThroughput: 750000 / 8,
        connectionType: 'cellular4g',
      });
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    } else {
      throttleMode = 'WebKit route latency 150ms (không có CDP)';
      await page.route('**/*', async route => {
        await new Promise(r => setTimeout(r, 150));
        await route.continue();
      });
    }
  } else if (cond.key === 'drop10pct') {
    const seed = `${ui.key}:${dev.key}:run${runIdx}:seed20261027`;
    const rng = createSeededRng(seed);
    throttleMode = `seed=${seed}`;
    await page.route('**/*', async route => {
      const req = route.request();
      const rt = req.resourceType();
      const url = req.url();
      const isTarget = rt === 'script' || rt === 'stylesheet' || url.includes('/api/index.php') || url.endsWith('.js') || url.endsWith('.css');
      if (isTarget && rng() < 0.10) {
        abortedByRoute++;
        await route.abort('failed');
        return;
      }
      await route.continue();
    });
  }

  const requests = [];
  const sizePromises = [];
  const consoleErrorMessages = [];
  const failedRequestUrls = [];

  page.on('request', req => requests.push(req));
  page.on('requestfinished', req => {
    sizePromises.push(
      req.sizes().then(s => (s ? s.responseHeadersSize + s.responseBodySize : 0)).catch(() => 0)
    );
  });
  page.on('requestfailed', req => {
    failedRequestUrls.push(`${req.url()} (${req.failure()?.errorText || 'failed'})`);
  });
  page.on('response', res => {
    if (res.status() >= 400) {
      failedRequestUrls.push(`${res.url()} (HTTP ${res.status()})`);
    }
  });
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrorMessages.push(msg.text());
  });
  page.on('pageerror', err => {
    consoleErrorMessages.push(`pageerror: ${err.message}`);
  });

  const svgWaitTimeout = cond.key === 'slow4g' ? 45000 : 7000;
  const startedAt = Date.now();
  let svgOk = false;
  let svgMs = null;

  try {
    await page.goto(BASE_URL + ui.path, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.locator('#osmd-container svg').first().waitFor({ state: 'visible', timeout: svgWaitTimeout });
    svgMs = Date.now() - startedAt;
    svgOk = true;
  } catch (_) {
    svgOk = false;
    svgMs = null;
  }

  await page.waitForTimeout(300);

  const state = await page.evaluate(() => {
    const items = document.querySelectorAll('#song-list .song-item').length;
    const titleEl = document.getElementById('song-title');
    const titleText = titleEl ? (titleEl.textContent || '').trim() : '';
    return { items, titleText };
  }).catch(() => ({ items: 0, titleText: '' }));

  const sizes = await Promise.all(sizePromises);
  const totalBytes = sizes.reduce((acc, n) => acc + n, 0);

  const listOk = state.items > 0;
  const titleOk = state.titleText.includes('HỠI THÁNH VƯƠNG');
  const broken = !listOk || !titleOk || !svgOk;

  await context.close();

  return {
    run: runIdx,
    listItems: state.items,
    listOk,
    titleText: state.titleText,
    titleOk,
    svgOk,
    svgMs,
    requests: requests.length,
    bytes: totalBytes,
    consoleErrors: consoleErrorMessages.length,
    failedRequests: failedRequestUrls.length,
    abortedByRoute,
    broken,
    throttleMode,
  };
}

test.describe('M0-1 · Đo mốc tải trang trên điện thoại và tablet', () => {
  for (const dev of DEVICE_PROFILES) {
    for (const ui of UIS) {
      test(`M0-1 baseline: ${dev.key} - ${ui.key}`, async ({ browser, browserName }, testInfo) => {
        test.skip(testInfo.project.name !== dev.project, `Chạy ${dev.key} trên project ${dev.project}`);
        test.setTimeout(360000);

        for (const cond of CONDITIONS) {
          const runs = [];
          let throttleMode = '';
          for (let i = 1; i <= 5; i++) {
            const res = await runSingleColdLoad(browser, browserName, dev, ui, cond, i);
            throttleMode = res.throttleMode;
            runs.push(res);
          }
          const store = readRawStore();
          const comboKey = `${ui.key}__${dev.key}__${cond.key}`;
          store.m0_1[comboKey] = {
            ui: ui.key,
            device: dev.key,
            condition: cond.key,
            throttleMode,
            runs,
          };
          writeRawStore(store);
          expect(runs.length).toBe(5);
        }
      });
    }
  }
});
