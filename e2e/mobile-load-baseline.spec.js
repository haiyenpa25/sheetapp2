// @ts-check
const { test, expect, devices } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const assertIsolatedRoot = require('./assert-isolated-root');

const ROOT = path.resolve(__dirname, '..');
const MARKER = assertIsolatedRoot(ROOT);
// UX0-18: All evidence paths stay strictly inside ROOT (isolated workspace)
const BASE_URL = MARKER.baseURL.replace(/\/$/, '') + '/';
const EVIDENCE_DIR = path.join(ROOT, 'docs', 'mobile-evidence');
const RAW_JSON_PATH = path.join(EVIDENCE_DIR, 'm0-baseline-raw.json');
const REPORT_MD_PATH = path.join(EVIDENCE_DIR, 'M0-baseline.md');

const LARGEST_SONG = {
  id: 'thanh-ca-903',
  title: 'THÀNH THÁNH',
  xmlPath: 'storage/Thanh ca/903 THÀNH THÁNH.xml',
  xmlSizeBytes: 564674,
};

const DEVICE_PROFILES = [
  { key: 'pixel7', label: 'Pixel 7 (412×915)', project: 'chromium', descriptor: devices['Pixel 7'] },
  { key: 'iphone13', label: 'iPhone 13 (390×844)', project: 'webkit', descriptor: devices['iPhone 13'] },
  { key: 'ipadmini', label: 'iPad Mini (768×1024)', project: 'webkit', descriptor: devices['iPad Mini'] },
];

const UIS = [
  { key: 'modern', label: 'Modern (/)', path: '?song=thanh-ca-001&v=sheet', basePrefix: '' },
  { key: 'classic', label: 'Classic (/old/)', path: 'old/?song=thanh-ca-001&v=sheet', basePrefix: 'old/' },
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
  const result = { m0_1: {}, m0_2: {} };
  if (fs.existsSync(REPORT_MD_PATH)) {
    try {
      const md = fs.readFileSync(REPORT_MD_PATH, 'utf8');
      const m = md.match(/```json\r?\n([\s\S]*?)\r?\n```/);
      if (m) {
        const parsedMd = JSON.parse(m[1]);
        Object.assign(result.m0_1, parsedMd.m0_1 || {});
        Object.assign(result.m0_2, parsedMd.m0_2 || {});
      }
    } catch (_) {}
  }
  if (fs.existsSync(RAW_JSON_PATH)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(RAW_JSON_PATH, 'utf8'));
      Object.assign(result.m0_1, parsed.m0_1 || {});
      Object.assign(result.m0_2, parsed.m0_2 || {});
    } catch (_) {}
  }
  return result;
}

function writeRawStore(store) {
  fs.mkdirSync(path.dirname(RAW_JSON_PATH), { recursive: true });
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  const jsonText = JSON.stringify(store, null, 2).replace(/\r?\n/g, '\r\n');
  fs.writeFileSync(RAW_JSON_PATH, jsonText, 'utf8');
  renderMarkdownReport(store);
}

function renderMarkdownReport(store) {
  const lines = [
    '# M0 Baseline — Đo mốc tải và màn đọc trên điện thoại, tablet',
    '',
    '> Số liệu đo trực tiếp bằng `e2e/mobile-load-baseline.spec.js` trên bản sao cách ly (`e2e/assert-isolated-root.js`). Không làm tròn, không ước lượng.',
    '',
    '## 1. M0-1 — Ma trận 2 giao diện × 3 thiết bị × 3 điều kiện (5 lần/tổ hợp, cache lạnh)',
    '',
    '| Giao diện | Thiết bị | Điều kiện | Số lần hỏng / 5 | Hiện danh sách (đạt/5) | Tên bài đúng (đạt/5) | Có SVG (đạt/5) | Thời gian tới SVG từng lần (ms) | Số request từng lần | Số byte truyền từng lần | Lỗi console từng lần | Request lỗi từng lần |',
    '|---|---|---|---:|---:|---:|---:|---|---|---|---|---|',
  ];

  for (const ui of UIS) {
    for (const dev of DEVICE_PROFILES) {
      for (const cond of CONDITIONS) {
        const entry = store.m0_1[`${ui.key}__${dev.key}__${cond.key}`];
        if (!entry || !Array.isArray(entry.runs)) continue;
        const r = entry.runs;
        const brokenCount = r.filter(x => x.broken).length;
        const listPass = r.filter(x => x.listOk).length;
        const titlePass = r.filter(x => x.titleOk).length;
        const svgPass = r.filter(x => x.svgOk).length;
        const svgTimes = r.map(x => (x.svgMs === null ? 'FAIL' : String(x.svgMs))).join(', ');
        const reqCounts = r.map(x => String(x.requests)).join(', ');
        const byteCounts = r.map(x => String(x.bytes)).join(', ');
        const consoleErrs = r.map(x => String(x.consoleErrors)).join(', ');
        const failedReqs = r.map(x => String(x.failedRequests)).join(', ');
        const condNote = entry.throttleMode ? `${cond.label} [${entry.throttleMode}]` : cond.label;
        lines.push(`| ${ui.label} | ${dev.label} | ${condNote} | ${brokenCount}/5 | ${listPass}/5 | ${titlePass}/5 | ${svgPass}/5 | [${svgTimes}] | [${reqCounts}] | [${byteCounts}] | [${consoleErrs}] | [${failedReqs}] |`);
      }
    }
  }

  lines.push(
    '',
    '## 2. M0-2 — Đổi nhanh 5 bài liên tiếp bằng chạm, xoay máy 3 lần với bài lớn nhất (`thanh-ca-903`, 564674 byte), tải lần hai qua SW',
    '',
    '### 2.1 Đổi nhanh 5 bài liên tiếp bằng chạm',
    '',
    '| Giao diện | Thiết bị | Bài đích cuối | Bài thực tế cuối | Khớp bài cuối | Có SVG | Thời gian ổn định sau chạm thứ 5 (ms) | Số lần gọi `osmd.render()` trong 5 lần chạm | Lỗi console | Request lỗi |',
    '|---|---|---|---|---|---|---:|---:|---:|---:|'
  );

  for (const ui of UIS) {
    for (const dev of DEVICE_PROFILES) {
      const e = store.m0_2[`${ui.key}__${dev.key}`]?.rapidSwitch5;
      if (!e) continue;
      lines.push(`| ${ui.label} | ${dev.label} | ${e.targetSongId} (${e.targetTitle}) | ${e.actualSongId} (${e.actualTitle}) | ${e.matchedTarget ? 'Có' : 'KHÔNG'} | ${e.svgVisible ? 'Có' : 'KHÔNG'} | ${e.settleMs} | ${e.osmdRenderCalls} | ${e.consoleErrors} | ${e.failedRequests} |`);
    }
  }

  lines.push(
    '',
    '### 2.2 Xoay máy 3 lần với bài có file XML lớn nhất (`thanh-ca-903` — `564674` byte)',
    '',
    '| Giao diện | Thiết bị | Thời gian tới SVG ban đầu (ms) | Số lần `osmd.render()` khi mở bài | Số lần `osmd.render()` qua 3 lần xoay | Thời gian 3 lần xoay (ms) | Còn SVG sau xoay | Tên bài đúng sau xoay | Lỗi console |',
    '|---|---|---:|---:|---:|---:|---|---|---:|'
  );

  for (const ui of UIS) {
    for (const dev of DEVICE_PROFILES) {
      const e = store.m0_2[`${ui.key}__${dev.key}`]?.rotateLargestXml3;
      if (!e) continue;
      lines.push(`| ${ui.label} | ${dev.label} | ${e.initialSvgMs} | ${e.initialRenderCount} | ${e.rotationRenderCount} | ${e.rotationTotalMs} | ${e.svgOkAfterRotations ? 'Có' : 'KHÔNG'} | ${e.titleOkAfterRotations ? 'Có' : 'KHÔNG'} | ${e.consoleErrors} |`);
    }
  }

  lines.push(
    '',
    '### 2.3 Lần tải thứ hai qua Service Worker',
    '',
    '| Giao diện | Thiết bị | SW controller hoạt động | Lần 1 SVG (ms) | Lần 1 request | Lần 1 byte | Lần 2 SVG (ms) | Lần 2 request | Lần 2 byte | Danh sách / Tên / SVG lần 2 | Lỗi console lần 2 |',
    '|---|---|---|---:|---:|---:|---:|---:|---:|---|---:|'
  );

  for (const ui of UIS) {
    for (const dev of DEVICE_PROFILES) {
      const e = store.m0_2[`${ui.key}__${dev.key}`]?.secondLoadSw;
      if (!e) continue;
      const st2 = `${e.secondLoadListOk ? 'Đạt' : 'Hỏng'} / ${e.secondLoadTitleOk ? 'Đạt' : 'Hỏng'} / ${e.secondLoadSvgOk ? 'Đạt' : 'Hỏng'}`;
      lines.push(`| ${ui.label} | ${dev.label} | ${e.swControllerActive ? 'Có' : 'Không'} | ${e.firstLoadSvgMs} | ${e.firstLoadRequests} | ${e.firstLoadBytes} | ${e.secondLoadSvgMs} | ${e.secondLoadRequests} | ${e.secondLoadBytes} | ${st2} | ${e.consoleErrors} |`);
    }
  }

  lines.push('', '## 3. Dữ liệu thô đầy đủ (JSON)', '', '```json', JSON.stringify(store, null, 2), '```', '');
  fs.writeFileSync(REPORT_MD_PATH, lines.join('\r\n') + '\r\n', 'utf8');
}

async function runSingleColdLoad(browser, browserName, dev, ui, cond, runIdx) {
  const context = await browser.newContext({ ...dev.descriptor, baseURL: BASE_URL, serviceWorkers: 'block' });
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
    sizePromises.push(req.sizes().then(s => (s ? s.responseHeadersSize + s.responseBodySize : 0)).catch(() => 0));
  });
  page.on('requestfailed', req => failedRequestUrls.push(`${req.url()} (${req.failure()?.errorText || 'failed'})`));
  page.on('response', res => { if (res.status() >= 400) failedRequestUrls.push(`${req.url()} (HTTP ${res.status()})`); });
  page.on('console', msg => { if (msg.type() === 'error') consoleErrorMessages.push(msg.text()); });
  page.on('pageerror', err => consoleErrorMessages.push(`pageerror: ${err.message}`));

  const svgWaitTimeout = cond.key === 'slow4g' ? 45000 : 7000;
  const startedAt = Date.now();
  let svgOk = false;
  let svgMs = null;

  try {
    await page.goto(BASE_URL + ui.path, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.locator('#osmd-container svg').first().waitFor({ state: 'visible', timeout: svgWaitTimeout });
    svgMs = Date.now() - startedAt;
    svgOk = true;
  } catch (_) {}

  await page.waitForTimeout(300);
  const state = await page.evaluate(() => ({
    items: document.querySelectorAll('#song-list .song-item').length,
    titleText: (document.getElementById('song-title')?.textContent || '').trim(),
  })).catch(() => ({ items: 0, titleText: '' }));

  const sizes = await Promise.all(sizePromises);
  const totalBytes = sizes.reduce((acc, n) => acc + n, 0);
  const listOk = state.items > 0;
  const titleOk = state.titleText.includes('HỠI THÁNH VƯƠNG');
  const broken = !listOk || !titleOk || !svgOk;

  await context.close();
  return {
    run: runIdx, listItems: state.items, listOk, titleText: state.titleText, titleOk, svgOk, svgMs,
    requests: requests.length, bytes: totalBytes, consoleErrors: consoleErrorMessages.length,
    failedRequests: failedRequestUrls.length, abortedByRoute, broken, throttleMode,
  };
}

async function measureRapidSwitch5(browser, dev, ui) {
  const context = await browser.newContext({ ...dev.descriptor, baseURL: BASE_URL, serviceWorkers: 'block' });
  const page = await context.newPage();
  const consoleErrors = [];
  const failedReqs = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', err => consoleErrors.push(err.message));
  page.on('requestfailed', req => {
    const errText = req.failure()?.errorText || '';
    if (!/ERR_ABORTED|cancelled|aborted/i.test(errText)) failedReqs.push(req.url());
  });

  await page.goto(BASE_URL + ui.path, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.locator('#osmd-container svg').first().waitFor({ state: 'visible', timeout: 20000 });
  await page.waitForTimeout(200);

  const targets = await page.evaluate(() => {
    window.__m0RenderCalls = 0;
    const inst = window.OSMDRenderer?.getInstance?.();
    if (inst && typeof inst.render === 'function' && !inst.__m0Wrapped) {
      const orig = inst.render.bind(inst);
      inst.render = function (...args) {
        window.__m0RenderCalls++;
        return orig(...args);
      };
      inst.__m0Wrapped = true;
    }
    return Array.from(document.querySelectorAll('#song-list .song-item')).slice(1, 6).map(el => ({
      id: el.getAttribute('data-id') || '',
      title: (el.querySelector('.song-item-title, .song-title-text')?.textContent || el.textContent || '').trim(),
    }));
  });

  const lastTarget = targets[targets.length - 1] || { id: '', title: '' };
  const switchStart = Date.now();

  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    await page.evaluate(() => {
      const sb = document.getElementById('sidebar');
      if (sb) {
        sb.classList.remove('mobile-hidden', 'collapsed', 'closed', 'hidden');
        sb.classList.add('open');
        document.body.classList.add('library-sidebar-open');
        sb.style.transition = 'none';
        sb.style.setProperty('display', 'flex', 'important');
        sb.style.setProperty('left', '0px', 'important');
        sb.style.setProperty('transform', 'none', 'important');
        sb.style.setProperty('visibility', 'visible', 'important');
        sb.style.setProperty('opacity', '1', 'important');
      }
      const ov = document.getElementById('sidebar-overlay');
      if (ov) ov.classList.add('hidden');
    });
    const pt = await page.evaluate(id => {
      const el = document.querySelector(`#song-list .song-item[data-id="${id}"]`);
      el?.scrollIntoView({ block: 'nearest' });
      const r = el?.getBoundingClientRect();
      return r ? { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) } : { x: 100, y: 300 };
    }, t.id);
    await page.touchscreen.tap(pt.x, pt.y);
    if (i < targets.length - 1) await page.waitForTimeout(60);
  }

  let svgVisible = false;
  let settleMs = null;
  try {
    await expect.poll(async () => {
      return await page.evaluate(expectedId => {
        const curId = window.App?.getCurrentSongId?.() || '';
        const hasSvg = Boolean(document.querySelector('#osmd-container svg'));
        const loadingHidden = document.getElementById('loading-screen')?.classList.contains('hidden') !== false;
        return curId === expectedId && hasSvg && loadingHidden;
      }, lastTarget.id);
    }, { timeout: 15000 }).toBe(true);
    settleMs = Date.now() - switchStart;
    svgVisible = true;
  } catch (_) {
    settleMs = Date.now() - switchStart;
    svgVisible = await page.locator('#osmd-container svg').first().isVisible().catch(() => false);
  }

  const finalState = await page.evaluate(() => ({
    actualSongId: window.App?.getCurrentSongId?.() || '',
    actualTitle: (document.getElementById('song-title')?.textContent || '').trim(),
    osmdRenderCalls: window.__m0RenderCalls || 0,
  }));

  await context.close();
  const matchedTarget = finalState.actualSongId === lastTarget.id && finalState.actualTitle.length > 0 && finalState.actualTitle !== 'Chọn bài hát để bắt đầu';
  return {
    tappedSongs: targets.map(t => t.id), targetSongId: lastTarget.id, targetTitle: lastTarget.title,
    actualSongId: finalState.actualSongId, actualTitle: finalState.actualTitle,
    matchedTarget, svgVisible, settleMs, osmdRenderCalls: finalState.osmdRenderCalls,
    consoleErrors: consoleErrors.length, failedRequests: failedReqs.length,
  };
}

async function measureRotateLargestXml3(browser, dev, ui) {
  const context = await browser.newContext({ ...dev.descriptor, baseURL: BASE_URL, serviceWorkers: 'block' });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', err => consoleErrors.push(err.message));

  await page.addInitScript(() => {
    window.__m0TotalOsmdRenders = 0;
    const hookProto = () => {
      const OSMD = window.opensheetmusicdisplay?.OpenSheetMusicDisplay;
      if (OSMD && OSMD.prototype && !OSMD.prototype.__m0Hooked) {
        const origRender = OSMD.prototype.render;
        OSMD.prototype.render = function (...args) {
          window.__m0TotalOsmdRenders = (window.__m0TotalOsmdRenders || 0) + 1;
          return origRender.apply(this, args);
        };
        OSMD.prototype.__m0Hooked = true;
      }
    };
    document.addEventListener('DOMContentLoaded', hookProto, { capture: true });
    window.addEventListener('load', hookProto, { capture: true });
  });

  const startLoad = Date.now();
  await page.goto(`${BASE_URL}${ui.basePrefix}?song=${LARGEST_SONG.id}&v=sheet`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.locator('#osmd-container svg').first().waitFor({ state: 'visible', timeout: 25000 });
  const initialSvgMs = Date.now() - startLoad;
  await page.waitForTimeout(300);
  const initialRenderCount = await page.evaluate(() => window.__m0TotalOsmdRenders || 0);

  const vp = dev.descriptor.viewport || { width: 390, height: 844 };
  const orientations = [
    { width: vp.height, height: vp.width },
    { width: vp.width, height: vp.height },
    { width: vp.height, height: vp.width },
  ];

  const rotStart = Date.now();
  for (const nextVp of orientations) {
    await page.setViewportSize(nextVp);
    await page.evaluate(() => {
      window.dispatchEvent(new Event('orientationchange'));
      window.dispatchEvent(new Event('resize'));
    });
    await page.waitForTimeout(650);
  }
  await page.waitForTimeout(300);
  const rotationTotalMs = Date.now() - rotStart;

  const afterState = await page.evaluate(() => ({
    totalRenders: window.__m0TotalOsmdRenders || 0,
    hasSvg: Boolean(document.querySelector('#osmd-container svg')),
    titleText: (document.getElementById('song-title')?.textContent || '').trim(),
  }));

  await context.close();
  return {
    songId: LARGEST_SONG.id, xmlSizeBytes: LARGEST_SONG.xmlSizeBytes, initialSvgMs, initialRenderCount,
    rotationRenderCount: Math.max(0, afterState.totalRenders - initialRenderCount),
    rotationTotalMs, svgOkAfterRotations: afterState.hasSvg,
    titleOkAfterRotations: afterState.titleText.includes('THÀNH THÁNH'),
    consoleErrors: consoleErrors.length,
  };
}

async function measureSecondLoadSw(browser, dev, ui) {
  const context = await browser.newContext({ ...dev.descriptor, baseURL: BASE_URL, serviceWorkers: 'allow' });
  const page = await context.newPage();
  let reqCount = 0;
  let sizePromises = [];
  const consoleErrors = [];
  const failedReqs = [];

  page.on('request', () => { reqCount++; });
  page.on('requestfinished', req => {
    sizePromises.push(req.sizes().then(s => (s ? s.responseHeadersSize + s.responseBodySize : 0)).catch(() => 0));
  });
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', err => consoleErrors.push(err.message));
  page.on('requestfailed', req => failedReqs.push(req.url()));

  const t1 = Date.now();
  await page.goto(BASE_URL + ui.path, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.locator('#osmd-container svg').first().waitFor({ state: 'visible', timeout: 20000 });
  const firstLoadSvgMs = Date.now() - t1;
  await page.waitForTimeout(1500);

  const firstLoadRequests = reqCount;
  const firstSizes = await Promise.all(sizePromises);
  const firstLoadBytes = firstSizes.reduce((a, b) => a + b, 0);

  reqCount = 0;
  sizePromises = [];
  consoleErrors.length = 0;
  failedReqs.length = 0;

  const t2 = Date.now();
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
  let secondLoadSvgOk = false;
  let secondLoadSvgMs = null;
  try {
    await page.locator('#osmd-container svg').first().waitFor({ state: 'visible', timeout: 20000 });
    secondLoadSvgMs = Date.now() - t2;
    secondLoadSvgOk = true;
  } catch (_) {}
  await page.waitForTimeout(400);

  const secondSizes = await Promise.all(sizePromises);
  const secondLoadBytes = secondSizes.reduce((a, b) => a + b, 0);
  const secondLoadRequests = reqCount;

  const secondState = await page.evaluate(() => ({
    swControllerActive: Boolean(navigator.serviceWorker && navigator.serviceWorker.controller),
    items: document.querySelectorAll('#song-list .song-item').length,
    titleText: (document.getElementById('song-title')?.textContent || '').trim(),
  })).catch(() => ({ swControllerActive: false, items: 0, titleText: '' }));

  await context.close();
  return {
    swControllerActive: secondState.swControllerActive, firstLoadSvgMs, firstLoadRequests, firstLoadBytes,
    secondLoadSvgMs, secondLoadRequests, secondLoadBytes,
    secondLoadListOk: secondState.items > 0, secondLoadTitleOk: secondState.titleText.includes('HỠI THÁNH VƯƠNG'),
    secondLoadSvgOk, consoleErrors: consoleErrors.length, failedRequests: failedReqs.length,
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
          store.m0_1[`${ui.key}__${dev.key}__${cond.key}`] = { ui: ui.key, device: dev.key, condition: cond.key, throttleMode, runs };
          writeRawStore(store);
          expect(runs.length).toBe(5);
        }
      });
    }
  }
});

test.describe('M0-2 · Đổi nhanh 5 bài, xoay máy 3 lần với bài lớn nhất, tải lần hai qua SW', () => {
  for (const dev of DEVICE_PROFILES) {
    for (const ui of UIS) {
      test(`M0-2 stress & sw: ${dev.key} - ${ui.key}`, async ({ browser }, testInfo) => {
        test.skip(testInfo.project.name !== dev.project, `Chạy ${dev.key} trên project ${dev.project}`);
        test.setTimeout(240000);
        const rapidSwitch5 = await measureRapidSwitch5(browser, dev, ui);
        const rotateLargestXml3 = await measureRotateLargestXml3(browser, dev, ui);
        const secondLoadSw = await measureSecondLoadSw(browser, dev, ui);

        const store = readRawStore();
        store.m0_2[`${ui.key}__${dev.key}`] = { ui: ui.key, device: dev.key, rapidSwitch5, rotateLargestXml3, secondLoadSw };
        writeRawStore(store);

        expect(rapidSwitch5.tappedSongs.length).toBe(5);
        expect(rotateLargestXml3.xmlSizeBytes).toBe(564674);
        expect(secondLoadSw.firstLoadRequests).toBeGreaterThan(0);
      });
    }
  }
});
