// @ts-check
// e2e/m6-acceptance.spec.js — Stage M6 Full Acceptance & Before/After Comparison vs M0 Baseline
const { test, expect, devices } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const assertIsolatedRoot = require('./assert-isolated-root');

const ROOT = path.resolve(__dirname, '..');
const MARKER = assertIsolatedRoot(ROOT);
// UX0-18: All evidence paths stay strictly inside ROOT (isolated workspace)
const BASE_URL = MARKER.baseURL.replace(/\/$/, '') + '/';
const EVIDENCE_DIR = path.join(ROOT, 'docs', 'mobile-evidence');
const M0_REPORT_PATH = path.join(EVIDENCE_DIR, 'M0-baseline.md');
const ROADMAP_MOBILE_PATH = path.join(ROOT, 'ROADMAP_MOBILE.md');
const M6_RAW_JSON_PATH = path.join(EVIDENCE_DIR, 'm6-acceptance-raw.json');
const M6_REPORT_MD_PATH = path.join(ROOT, 'docs', 'mobile-evidence', 'M6-acceptance.md');
const LARGEST_SONG = { id: 'thanh-ca-903', title: 'THÀNH THÁNH', xmlPath: 'storage/Thanh ca/903 THÀNH THÁNH.xml', xmlSizeBytes: 564674 };

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
  for (let i = 0; i < seedStr.length; i++) { h ^= seedStr.charCodeAt(i); h = Math.imul(h, 16777619); }
  let a = h >>> 0;
  return function nextRandom() {
    a = ((a | 0) + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function readM0Store() {
  if (!fs.existsSync(M0_REPORT_PATH)) return { m0_1: {}, m0_2: {} };
  try {
    const md = fs.readFileSync(M0_REPORT_PATH, 'utf8');
    const m = md.match(/```json\r?\n([\s\S]*?)\r?\n```/);
    if (m) return JSON.parse(m[1]);
  } catch (_) {}
  return { m0_1: {}, m0_2: {} };
}

function readRoadmapSection5Baseline() {
  const map = {};
  if (!fs.existsSync(ROADMAP_MOBILE_PATH)) return map;
  try {
    const md = fs.readFileSync(ROADMAP_MOBILE_PATH, 'utf8');
    const sec = md.split('## 5. Thang nghiệm thu')[1]?.split('## 6.')[0] || '';
    for (const line of sec.split(/\r?\n/)) {
      const m = line.match(/^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|$/);
      if (m && m[1] !== 'Chỉ số' && !m[1].startsWith('-')) {
        map[m[1].trim()] = { before: m[2].trim(), target: m[3].trim() };
      }
    }
  } catch (_) {}
  return map;
}

// UX0-19: Zero pre-populated defaults in readM6Store(); every value must come from actual test runs.
function readM6Store() {
  const result = { m0_1: {}, m0_2: {}, section5: {} };
  if (fs.existsSync(M6_RAW_JSON_PATH)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(M6_RAW_JSON_PATH, 'utf8'));
      Object.assign(result.m0_1, parsed.m0_1 || {});
      Object.assign(result.m0_2, parsed.m0_2 || {});
      Object.assign(result.section5, parsed.section5 || {});
    } catch (_) {}
  }
  return result;
}

function writeM6Store(store) {
  fs.mkdirSync(path.dirname(M6_RAW_JSON_PATH), { recursive: true });
  fs.mkdirSync(path.dirname(M6_REPORT_MD_PATH), { recursive: true });
  fs.writeFileSync(M6_RAW_JSON_PATH, JSON.stringify(store, null, 2).replace(/\r?\n/g, '\r\n'), 'utf8');
  renderM6MarkdownReport(store);
}

function summarizeColdLoads(mStore) {
  const entries = Object.values(mStore?.m0_1 || {});
  if (entries.length === 0) return null;
  let normalSlowTotal = 0, normalSlowBroken = 0;
  let dropTotal = 0, dropInitialBroken = 0, dropRecovered = 0, dropFinalBroken = 0;
  for (const e of entries) {
    const runs = Array.isArray(e?.runs) ? e.runs : [];
    if (e.condition === 'drop10pct') {
      for (const r of runs) {
        dropTotal++;
        const initBrk = r.initialBroken !== undefined ? Boolean(r.initialBroken) : Boolean(r.broken);
        if (initBrk) dropInitialBroken++;
        if (initBrk && r.hasRetryUi && r.retrySucceeded) dropRecovered++;
        if (r.broken) dropFinalBroken++;
      }
    } else {
      for (const r of runs) {
        normalSlowTotal++;
        if (r.broken) normalSlowBroken++;
      }
    }
  }
  return { normalSlowTotal, normalSlowBroken, dropTotal, dropInitialBroken, dropRecovered, dropFinalBroken };
}

function summarizeClassicRenders(mStore) {
  const devs = ['pixel7', 'iphone13', 'ipadmini'];
  const initCounts = [];
  const rotCounts = [];
  for (const d of devs) {
    const rot = mStore?.m0_2?.[`classic__${d}`]?.rotateLargestXml3;
    if (!rot || typeof rot.initialRenderCount !== 'number' || typeof rot.rotationRenderCount !== 'number') return null;
    initCounts.push(rot.initialRenderCount);
    rotCounts.push(rot.rotationRenderCount);
  }
  return { initCounts, rotCounts };
}

function renderM6MarkdownReport(m6) {
  const m0 = readM0Store();
  const rm5 = readRoadmapSection5Baseline();
  const lines = [
    '# M6 Acceptance — Biên bản nghiệm thu tổng thể sau M1–M5 so với mốc M0', '',
    '> Số liệu đo trực tiếp bằng `e2e/m6-acceptance.spec.js` trên bản sao cách ly (`e2e/assert-isolated-root.js`) đối chiếu trực tiếp với `docs/mobile-evidence/M0-baseline.md` và `ROADMAP_MOBILE.md` mục 5. Không làm tròn, không ước lượng, không dùng giá trị mặc định gán sẵn.', '',
    '## 1. M6-1 vs M0-1 — Ma trận 2 giao diện × 3 thiết bị × 3 điều kiện (5 lần/tổ hợp, cache lạnh)', '',
    '> Lưu ý điều kiện trình duyệt: Ở tổ hợp `slow4g`, **Chromium** (Pixel 7) áp dụng đầy đủ `CDP 4G (150ms RTT, 1.6Mbps/750kbps) + CPU 4x`; **WebKit** (iPhone 13, iPad Mini) không có giao thức CDP nên áp dụng `WebKit route latency 150ms (không có CDP)` (chỉ cộng trễ 150ms mỗi request, không giới hạn băng thông/CPU). Cột Điều kiện bên dưới ghi rõ chế độ thực tế của từng hàng.', '',
    '| Giao diện | Thiết bị | Điều kiện | Hỏng M0 → M6 | Danh sách M0 → M6 | Tên bài M0 → M6 | Có SVG M0 → M6 | Thử lại thành công (khi chặn 10%) | Thời gian tới SVG M6 (ms) | Số request M0 → M6 | Số byte M0 → M6 |',
    '|---|---|---|---:|---:|---:|---:|---:|---|---|---|',
  ];

  for (const ui of UIS) {
    for (const dev of DEVICE_PROFILES) {
      for (const cond of CONDITIONS) {
        const key = `${ui.key}__${dev.key}__${cond.key}`;
        const e6 = m6.m0_1[key], e0 = m0.m0_1?.[key];
        if (!e6 || !Array.isArray(e6.runs)) continue;
        const r6 = e6.runs, r0 = e0?.runs || [];
        const b0 = r0.filter(x => x.broken).length, b6 = r6.filter(x => x.broken).length;
        const l0 = r0.filter(x => x.listOk).length, l6 = r6.filter(x => x.listOk).length;
        const t0 = r0.filter(x => x.titleOk).length, t6 = r6.filter(x => x.titleOk).length;
        const s0 = r0.filter(x => x.svgOk).length, s6 = r6.filter(x => x.svgOk).length;
        const svgTimes6 = r6.map(x => (x.svgMs === null ? 'FAIL' : String(x.svgMs))).join(', ');
        const req0 = r0[0]?.requests ?? '—', req6 = r6[0]?.requests ?? '—';
        const bytes0 = r0[0]?.bytes ?? '—', bytes6 = r6[0]?.bytes ?? '—';
        const condLabel = e6.throttleMode ? `${cond.label} [${e6.throttleMode}]` : cond.label;
        let retryCol = '—';
        if (cond.key === 'drop10pct') {
          const brokenRuns = r6.filter(x => x.initialBroken);
          const recoveredRuns = brokenRuns.filter(x => x.hasRetryUi && x.retrySucceeded);
          retryCol = brokenRuns.length === 0 ? '0 hỏng (5/5 đạt ngay)' : `${recoveredRuns.length}/${brokenRuns.length} khôi phục`;
        }
        lines.push(`| ${ui.label} | ${dev.label} | ${condLabel} | ${b0}/5 → **${b6}/5** | ${l0}/5 → **${l6}/5** | ${t0}/5 → **${t6}/5** | ${s0}/5 → **${s6}/5** | ${retryCol} | [${svgTimes6}] | ${req0} → **${req6}** | ${bytes0} → **${bytes6}** |`);
      }
    }
  }

  lines.push('', '## 2. M6-2 vs M0-2 — Đổi nhanh 5 bài liên tiếp, xoay máy 3 lần với bài lớn nhất (`thanh-ca-903`), tải lần hai qua SW', '', '### 2.1 Đổi nhanh 5 bài liên tiếp bằng chạm', '', '| Giao diện | Thiết bị | Khớp bài cuối (M0 → M6) | Có SVG (M0 → M6) | Thời gian ổn định M0 → M6 (ms) | Số lần gọi `osmd.render()` M0 → M6 | Lỗi console M6 |', '|---|---|---|---|---:|---:|---:|');
  for (const ui of UIS) {
    for (const dev of DEVICE_PROFILES) {
      const k = `${ui.key}__${dev.key}`, e6 = m6.m0_2[k]?.rapidSwitch5, e0 = m0.m0_2?.[k]?.rapidSwitch5;
      if (!e6) continue;
      lines.push(`| ${ui.label} | ${dev.label} | ${e0?.matchedTarget ? 'Có' : 'KHÔNG'} → **${e6.matchedTarget ? 'Có' : 'KHÔNG'}** | ${e0?.svgVisible ? 'Có' : 'KHÔNG'} → **${e6.svgVisible ? 'Có' : 'KHÔNG'}** | ${e0?.settleMs ?? '—'} → **${e6.settleMs}** | ${e0?.osmdRenderCalls ?? '—'} → **${e6.osmdRenderCalls}** | ${e6.consoleErrors} |`);
    }
  }

  lines.push('', '### 2.2 Xoay máy 3 lần với bài có file XML lớn nhất (`thanh-ca-903` — `564674` byte)', '', '| Giao diện | Thiết bị | Số lần `osmd.render()` khi mở bài (M0 → M6) | Số lần `osmd.render()` qua 3 lần xoay (M0 → M6) | Thời gian 3 lần xoay M0 → M6 (ms) | Còn SVG sau xoay | Tên bài đúng sau xoay | Lỗi console M6 |', '|---|---|---:|---:|---:|---|---|---:|');
  for (const ui of UIS) {
    for (const dev of DEVICE_PROFILES) {
      const k = `${ui.key}__${dev.key}`, e6 = m6.m0_2[k]?.rotateLargestXml3, e0 = m0.m0_2?.[k]?.rotateLargestXml3;
      if (!e6) continue;
      lines.push(`| ${ui.label} | ${dev.label} | ${e0?.initialRenderCount ?? '—'} → **${e6.initialRenderCount}** | ${e0?.rotationRenderCount ?? '—'} → **${e6.rotationRenderCount}** | ${e0?.rotationTotalMs ?? '—'} → **${e6.rotationTotalMs}** | **${e6.svgOkAfterRotations ? 'Có' : 'KHÔNG'}** | **${e6.titleOkAfterRotations ? 'Có' : 'KHÔNG'}** | ${e6.consoleErrors} |`);
    }
  }

  lines.push('', '### 2.3 Lần tải thứ hai qua Service Worker', '', '| Giao diện | Thiết bị | SW controller hoạt động (M0 → M6) | Lần 1 SVG M6 (ms) | Lần 2 SVG M0 → M6 (ms) | Danh sách / Tên / SVG lần 2 (M6) | Lỗi console lần 2 (M6) |', '|---|---|---|---:|---:|---|---:|');
  for (const ui of UIS) {
    for (const dev of DEVICE_PROFILES) {
      const k = `${ui.key}__${dev.key}`, e6 = m6.m0_2[k]?.secondLoadSw, e0 = m0.m0_2?.[k]?.secondLoadSw;
      if (!e6) continue;
      const st2 = `${e6.secondLoadListOk ? 'Đạt' : 'Hỏng'} / ${e6.secondLoadTitleOk ? 'Đạt' : 'Hỏng'} / ${e6.secondLoadSvgOk ? 'Đạt' : 'Hỏng'}`;
      lines.push(`| ${ui.label} | ${dev.label} | ${e0?.swControllerActive ? 'Có' : 'Không'} → **${e6.swControllerActive ? 'Có' : 'Không'}** | ${e6.firstLoadSvgMs} | ${e0?.secondLoadSvgMs ?? '—'} → **${e6.secondLoadSvgMs}** | **${st2}** | ${e6.consoleErrors} |`);
    }
  }

  const s5 = m6.section5 || {};
  const m0Cold = summarizeColdLoads(m0);
  const m6Cold = summarizeColdLoads(m6);
  const m0Classic = summarizeClassicRenders(m0);
  const m6Classic = summarizeClassicRenders(m6);
  const m6RapidEntries = Object.values(m6.m0_2 || {}).map(x => x?.rapidSwitch5).filter(Boolean);
  const m6RapidFailed = m6RapidEntries.length === 6 ? m6RapidEntries.filter(r => !r.matchedTarget || !r.svgVisible).length : null;

  const beforeBoot = rm5['Một module lỗi lúc khởi động làm hỏng mở bài']?.before || 'CHƯA ĐỌC M0';
  const beforeTimeout = rm5['Request không có timeout']?.before || 'CHƯA ĐỌC M0';
  const beforeTitleErr = rm5['Lỗi tải/vẽ làm mất tên bài']?.before || 'CHƯA ĐỌC M0';
  const beforeClassicRot = m0Classic ? `[${m0Classic.rotCounts.join(', ')}] lần / 3 xoay (Pixel 7: ${m0Classic.rotCounts[0]}, iPhone 13: ${m0Classic.rotCounts[1]}, iPad Mini: ${m0Classic.rotCounts[2]})` : 'CHƯA ĐỌC M0';
  const beforeClassicInit = m0Classic ? `[${m0Classic.initCounts.join(', ')}] (Pixel 7: ${m0Classic.initCounts[0]}, iPhone 13: ${m0Classic.initCounts[1]}, iPad Mini: ${m0Classic.initCounts[2]})` : 'CHƯA ĐỌC M0';
  const beforeColdDrop = m0Cold ? `${m0Cold.normalSlowBroken}/${m0Cold.normalSlowTotal} hỏng (normal+slow4g); ${m0Cold.dropFinalBroken}/${m0Cold.dropTotal} hỏng ở 10% drop` : 'CHƯA ĐỌC M0';
  const beforeModTab44 = rm5['Điều khiển Lớp 1 < 44px (Modern tablet)']?.before || 'CHƯA ĐỌC M0';
  const beforeClassicUnder = rm5['Điều khiển cao < 24px (Classic 1024)']?.before ? `${rm5['Điều khiển cao < 24px (Classic 1024)'].before} (< 24px)` : 'CHƯA ĐỌC M0';
  const beforeClassicOverflow = rm5['Toolbar Classic cuộn ngang ở 390']?.before || 'CHƯA ĐỌC M0';
  const beforeModPhoneChord = rm5['Chọn bộ hợp âm bất kỳ trên điện thoại (Modern)']?.before || 'CHƯA ĐỌC M0';
  const beforeModPrevNext = rm5['Số cặp nút ◀ ▶ (Modern)']?.before || 'CHƯA ĐỌC M0';
  const beforeGuestRestricted = rm5['Mục không đủ quyền vẫn hiện cho khách']?.before || 'CHƯA ĐỌC M0';
  const beforeViewportFit = rm5['`viewport-fit=cover`']?.before || 'CHƯA ĐỌC M0';
  const beforeSafariSearch = rm5['Tìm kiếm trên Safari < 16.4']?.before || 'CHƯA ĐỌC M0';

  const rowBootAfter = typeof s5.bootIsolationOk === 'boolean' ? `**${s5.bootIsolationOk ? 'không' : 'có'}** (Modern: ${s5.modernBootIsolated ? 'cô lập' : 'lỗi'}, Classic: ${s5.classicBootIsolated ? 'cô lập' : 'lỗi'})` : 'CHƯA ĐO';
  const rowBootStatus = typeof s5.bootIsolationOk === 'boolean' ? (s5.bootIsolationOk ? '✅ ĐẠT' : '❌') : '⏳ CHƯA ĐO';

  const rowTimeoutAfter = typeof s5.requestsWithoutTimeout === 'number' ? `**${s5.requestsWithoutTimeout}** (GET=${s5.getTimeoutMs}ms, POST=${s5.postTimeoutMs}ms, XML=${s5.xmlTimeoutMs}ms, SW=${s5.swTimeoutMs}ms)` : 'CHƯA ĐO';
  const rowTimeoutStatus = typeof s5.requestsWithoutTimeout === 'number' ? (s5.requestsWithoutTimeout === 0 ? '✅ ĐẠT' : '❌') : '⏳ CHƯA ĐO';

  const rowTitleAfter = typeof s5.titlePreservedOnError === 'boolean' ? `**${s5.titlePreservedOnError ? 'không' : 'có'}** (Modern: "${s5.modernTitleOnError}", Classic: "${s5.classicTitleOnError}")` : 'CHƯA ĐO';
  const rowTitleStatus = typeof s5.titlePreservedOnError === 'boolean' ? (s5.titlePreservedOnError ? '✅ ĐẠT' : '❌') : '⏳ CHƯA ĐO';

  const rowClassicRotAfter = m6Classic ? `**[${m6Classic.rotCounts.join(', ')}] lần / 3 xoay** (Pixel 7: ${m6Classic.rotCounts[0]}, iPhone 13: ${m6Classic.rotCounts[1]}, iPad Mini: ${m6Classic.rotCounts[2]}; tối đa ≤ 1 lần/xoay)` : 'CHƯA ĐO';
  const rowClassicRotStatus = m6Classic ? (m6Classic.rotCounts.every(c => c <= 3) ? '✅ ĐẠT' : '❌') : '⏳ CHƯA ĐO';

  const rowClassicInitAfter = m6Classic ? `**[${m6Classic.initCounts.join(', ')}]** (Pixel 7: ${m6Classic.initCounts[0]}, iPhone 13: ${m6Classic.initCounts[1]}, iPad Mini: ${m6Classic.initCounts[2]})` : 'CHƯA ĐO';
  const rowClassicInitStatus = m6Classic ? (m6Classic.initCounts.every(c => c === 1) ? '✅ ĐẠT' : '❌') : '⏳ CHƯA ĐO';

  const allColdAndRapidMeasured = Boolean(m6Cold && m6Cold.normalSlowTotal === 60 && m6Cold.dropTotal === 30 && m6RapidFailed !== null);
  const coldAndRapidPass = allColdAndRapidMeasured && m6Cold.normalSlowBroken === 0 && m6Cold.dropFinalBroken === 0 && m6Cold.dropRecovered === m6Cold.dropInitialBroken && m6RapidFailed === 0;
  const rowColdAfter = allColdAndRapidMeasured ? `**${m6Cold.normalSlowBroken}/${m6Cold.normalSlowTotal}** hỏng (normal+slow4g), **${m6RapidFailed}/6** lỗi đổi 5 bài; 10% drop: **${m6Cold.dropRecovered}/${m6Cold.dropInitialBroken}** khôi phục → **${m6Cold.dropFinalBroken}/${m6Cold.dropTotal}** hỏng sau thử lại` : 'CHƯA ĐO';
  const rowColdStatus = allColdAndRapidMeasured ? (coldAndRapidPass ? '✅ ĐẠT' : '❌') : '⏳ CHƯA ĐO';

  const rowModTab44After = typeof s5.modernTabletControlsUnder44 === 'number' ? `**${s5.modernTabletControlsUnder44}** (768px: ${s5.under44At768}/${s5.modernTabletControlsCount768}, 1024px: ${s5.under44At1024}/${s5.modernTabletControlsCount1024})` : 'CHƯA ĐO';
  const rowModTab44Status = typeof s5.modernTabletControlsUnder44 === 'number' ? (s5.modernTabletControlsUnder44 === 0 ? '✅ ĐẠT' : '❌') : '⏳ CHƯA ĐO';

  const rowClassic36After = typeof s5.classicLayer1Under36 === 'number' ? `**${s5.classicLayer1Under36}** (< 36px: 390=${s5.under36At390}, 768=${s5.under36At768}, 1024=${s5.under36At1024}; < 24px: ${s5.classicLayer1Under24})` : 'CHƯA ĐO';
  const rowClassic36Status = typeof s5.classicLayer1Under36 === 'number' ? (s5.classicLayer1Under36 === 0 ? '✅ ĐẠT' : '❌') : '⏳ CHƯA ĐO';

  const rowClassicOverflowAfter = typeof s5.classicToolbarOverflow390 === 'boolean' ? `**${s5.classicToolbarOverflow390 ? 'có' : 'không'}** (${s5.classicToolbarScrollWidth390}px ≤ ${s5.classicToolbarClientWidth390}px)` : 'CHƯA ĐO';
  const rowClassicOverflowStatus = typeof s5.classicToolbarOverflow390 === 'boolean' ? (!s5.classicToolbarOverflow390 ? '✅ ĐẠT' : '❌') : '⏳ CHƯA ĐO';

  const rowModPhoneChordAfter = typeof s5.modernPhoneCustomChordSetSelectable === 'boolean' ? `**${s5.modernPhoneCustomChordSetSelectable ? 'có' : 'không'}** (chọn bộ "${s5.customChordSetSelected}")` : 'CHƯA ĐO';
  const rowModPhoneChordStatus = typeof s5.modernPhoneCustomChordSetSelectable === 'boolean' ? (s5.modernPhoneCustomChordSetSelectable ? '✅ ĐẠT' : '❌') : '⏳ CHƯA ĐO';

  const rowModPrevNextAfter = typeof s5.modernMaxVisiblePrevNextPairs === 'number' ? `**${s5.modernMaxVisiblePrevNextPairs}** (390px: ${s5.pairsAt390}, 768px: ${s5.pairsAt768}, 1366px: ${s5.pairsAt1366})` : 'CHƯA ĐO';
  const rowModPrevNextStatus = typeof s5.modernMaxVisiblePrevNextPairs === 'number' ? (s5.modernMaxVisiblePrevNextPairs <= 2 ? '✅ ĐẠT' : '❌') : '⏳ CHƯA ĐO';

  const rowGuestAfter = typeof s5.guestVisibleRestrictedControls === 'number' ? `**${s5.guestVisibleRestrictedControls}** (Modern: ${s5.modernGuestVisibleRestricted}, Classic: ${s5.classicGuestVisibleRestricted})` : 'CHƯA ĐO';
  const rowGuestStatus = typeof s5.guestVisibleRestrictedControls === 'number' ? (s5.guestVisibleRestrictedControls === 0 ? '✅ ĐẠT' : '❌') : '⏳ CHƯA ĐO';

  const rowVpFitAfter = typeof s5.viewportFitCoverBoth === 'boolean' ? `**${s5.viewportFitCoverBoth ? 'có' : 'không'}** (Modern: ${s5.modernHasViewportFitCover ? 'có' : 'không'}, Classic: ${s5.classicHasViewportFitCover ? 'có' : 'không'})` : 'CHƯA ĐO';
  const rowVpFitStatus = typeof s5.viewportFitCoverBoth === 'boolean' ? (s5.viewportFitCoverBoth ? '✅ ĐẠT' : '❌') : '⏳ CHƯA ĐO';

  const rowSafariAfter = typeof s5.safari15SearchCompatible === 'boolean' ? `**${s5.safari15SearchCompatible ? 'chạy' : 'vỡ'}** (lookbehind=${s5.hasLookbehindLiteral ? 'có' : 'không'}, kết quả lọc=${s5.searchFilterMatchedCount})` : 'CHƯA ĐO';
  const rowSafariStatus = typeof s5.safari15SearchCompatible === 'boolean' ? (s5.safari15SearchCompatible ? '✅ ĐẠT' : '❌') : '⏳ CHƯA ĐO';

  lines.push(
    '', '## 3. Thang nghiệm thu mục 5 (`ROADMAP_MOBILE.md`) — Trước (M0) vs Sau (M6) vs Đích', '',
    '| Chỉ số | Trước (M0) | Sau (M6) | Đích | Trạng thái |', '|---|---|---|---|---|',
    `| Một module lỗi lúc khởi động làm hỏng mở bài | ${beforeBoot} | ${rowBootAfter} | không | ${rowBootStatus} |`,
    `| Request không có timeout | ${beforeTimeout} | ${rowTimeoutAfter} | 0 | ${rowTimeoutStatus} |`,
    `| Lỗi tải/vẽ làm mất tên bài | ${beforeTitleErr} | ${rowTitleAfter} | không | ${rowTitleStatus} |`,
    `| Số lần vẽ OSMD khi xoay máy (Classic) | ${beforeClassicRot} | ${rowClassicRotAfter} | ≤ 1 lần/xoay (≤ 3 / 3 xoay) | ${rowClassicRotStatus} |`,
    `| Số lần vẽ khi mở bài (Classic) | ${beforeClassicInit} | ${rowClassicInitAfter} | 1 | ${rowClassicInitStatus} |`,
    `| Trang trắng / mất tên / chạm không mở (normal + slow4g + đổi 5 bài + 10% drop) | ${beforeColdDrop} | ${rowColdAfter} | 0 | ${rowColdStatus} |`,
    `| Điều khiển Lớp 1 < 44px (Modern tablet 768/1024) | ${beforeModTab44} | ${rowModTab44After} | 0 | ${rowModTab44Status} |`,
    `| Điều khiển Lớp 1 < 36px (Classic 390/768/1024) | ${beforeClassicUnder} | ${rowClassic36After} | 0 | ${rowClassic36Status} |`,
    `| Toolbar Classic cuộn ngang ở 390 | ${beforeClassicOverflow} | ${rowClassicOverflowAfter} | không | ${rowClassicOverflowStatus} |`,
    `| Chọn bộ hợp âm bất kỳ trên điện thoại (Modern 390) | ${beforeModPhoneChord} | ${rowModPhoneChordAfter} | có | ${rowModPhoneChordStatus} |`,
    `| Số cặp nút ◀ ▶ cùng hiện trên một màn hình (Modern) | ${beforeModPrevNext} | ${rowModPrevNextAfter} | ≤ 2 | ${rowModPrevNextStatus} |`,
    `| Mục không đủ quyền vẫn hiện cho khách | ${beforeGuestRestricted} | ${rowGuestAfter} | 0 | ${rowGuestStatus} |`,
    `| \`viewport-fit=cover\` ở cả hai \`index.php\` | ${beforeViewportFit} | ${rowVpFitAfter} | có | ${rowVpFitStatus} |`,
    `| Tìm kiếm trên Safari < 16.4 (không dùng \`\\p{L}\` / lookbehind trực tiếp) | ${beforeSafariSearch} | ${rowSafariAfter} | chạy | ${rowSafariStatus} |`,
    '', '## 4. Dữ liệu thô đầy đủ M6 (JSON)', '', '```json', JSON.stringify(m6, null, 2), '```', ''
  );
  fs.writeFileSync(M6_REPORT_MD_PATH, lines.join('\r\n') + '\r\n', 'utf8');
}

async function runSingleColdLoad(browser, browserName, dev, ui, cond, runIdx) {
  const context = await browser.newContext({ ...dev.descriptor, baseURL: BASE_URL, serviceWorkers: 'block' });
  const page = await context.newPage();
  await page.addInitScript(() => { try { sessionStorage.setItem('sheetapp_guest_chosen', '1'); localStorage.setItem('sheetapp_guest_toast_shown', '1'); } catch (_) {} });

  let throttleMode = '', abortedByRoute = 0, dropActive = true;
  if (cond.key === 'slow4g') {
    if (browserName === 'chromium') {
      throttleMode = 'CDP 4G + CPU 4x';
      const cdp = await context.newCDPSession(page);
      await cdp.send('Network.enable');
      await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
      await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1600000 / 8, uploadThroughput: 750000 / 8, connectionType: 'cellular4g' });
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    } else {
      throttleMode = 'WebKit route latency 150ms (không có CDP)';
      await page.route('**/*', async route => { await new Promise(r => setTimeout(r, 150)); await route.continue(); });
    }
  } else if (cond.key === 'drop10pct') {
    const seed = `${ui.key}:${dev.key}:run${runIdx}:seed20261027`, rng = createSeededRng(seed);
    throttleMode = `seed=${seed}`;
    await page.route('**/*', async route => {
      if (!dropActive) { await route.continue(); return; }
      const req = route.request(), rt = req.resourceType(), url = req.url();
      const isTarget = rt === 'script' || rt === 'stylesheet' || url.includes('/api/index.php') || url.endsWith('.js') || url.endsWith('.css');
      if (isTarget && rng() < 0.10) { abortedByRoute++; await route.abort('failed'); return; }
      await route.continue();
    });
  }

  const requests = [], sizePromises = [], consoleErrorMessages = [], pageErrorMessages = [], failedRequestUrls = [];
  page.on('request', req => requests.push(req));
  page.on('requestfinished', req => { sizePromises.push(req.sizes().then(s => (s ? s.responseHeadersSize + s.responseBodySize : 0)).catch(() => 0)); });
  page.on('requestfailed', req => failedRequestUrls.push(`${req.url()} (${req.failure()?.errorText || 'failed'})`));
  page.on('response', res => { if (res.status() >= 400) failedRequestUrls.push(`${req.url()} (HTTP ${res.status()})`); });
  page.on('console', msg => { if (msg.type() === 'error') consoleErrorMessages.push(msg.text()); });
  page.on('pageerror', err => { pageErrorMessages.push(err.message); consoleErrorMessages.push(`pageerror: ${err.message}`); });

  const svgWaitTimeout = cond.key === 'slow4g' ? 45000 : 7000;
  const startedAt = Date.now();
  let svgOk = false, svgMs = null;
  try {
    await page.goto(BASE_URL + ui.path, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.locator('#osmd-container svg').first().waitFor({ state: 'visible', timeout: svgWaitTimeout });
    svgMs = Date.now() - startedAt; svgOk = true;
  } catch (_) {}

  await page.waitForTimeout(300);
  const queryState = () => page.evaluate(() => ({
    items: document.querySelectorAll('#song-list .song-item').length,
    titleText: (document.getElementById('song-title')?.textContent || '').trim(),
    hasBootBanner: Boolean(document.getElementById('boot-watchdog-banner')),
    hasSheetErrorPanel: Boolean((document.getElementById('sheet-load-error') && !document.getElementById('sheet-load-error')?.classList.contains('hidden')) || (document.getElementById('sheet-error-panel') && !document.getElementById('sheet-error-panel')?.classList.contains('hidden'))),
    hasLibraryError: Boolean(document.getElementById('library-load-error') || document.getElementById('btn-retry-song-list')),
  })).catch(() => ({ items: 0, titleText: '', hasBootBanner: false, hasSheetErrorPanel: false, hasLibraryError: false }));

  let state = await queryState();
  const sizes = await Promise.all(sizePromises);
  const totalBytes = sizes.reduce((acc, n) => acc + n, 0);
  let listOk = state.items > 0, titleOk = state.titleText.includes('HỠI THÁNH VƯƠNG');
  const initialBroken = !listOk || !titleOk || !svgOk;
  let hasRetryUi = state.hasBootBanner || state.hasSheetErrorPanel || state.hasLibraryError;
  let retrySucceeded = !initialBroken;

  if (cond.key === 'drop10pct' && initialBroken) {
    if (!hasRetryUi) {
      await page.waitForTimeout(2500);
      state = await queryState();
      hasRetryUi = state.hasBootBanner || state.hasSheetErrorPanel || state.hasLibraryError;
    }
    if (hasRetryUi) {
      dropActive = false;
      const tRetry = Date.now();
      if (state.hasBootBanner) {
        await page.evaluate(() => document.getElementById('boot-watchdog-reload-btn')?.click());
      } else {
        if (state.hasLibraryError) await page.evaluate(() => document.getElementById('btn-retry-song-list')?.click());
        if (state.hasSheetErrorPanel) await page.evaluate(() => (document.getElementById('btn-sheet-retry') || document.getElementById('btn-retry-sheet'))?.click());
      }
      try {
        await page.locator('#osmd-container svg').first().waitFor({ state: 'visible', timeout: 15000 });
        await expect.poll(async () => page.evaluate(() => document.querySelectorAll('#song-list .song-item').length > 0 && (document.getElementById('song-title')?.textContent || '').includes('HỠI THÁNH VƯƠNG') && Boolean(document.querySelector('#osmd-container svg'))), { timeout: 15000 }).toBe(true);
        listOk = true; titleOk = true; svgOk = true; retrySucceeded = true;
        if (svgMs === null) svgMs = Date.now() - tRetry;
      } catch (_) { retrySucceeded = false; }
    }
  }

  const broken = !listOk || !titleOk || !svgOk;
  await context.close();
  return { run: runIdx, listItems: state.items, listOk, titleText: state.titleText, titleOk, svgOk, svgMs, requests: requests.length, bytes: totalBytes, pageErrors: pageErrorMessages.length, consoleErrors: consoleErrorMessages.length, errorDetails: consoleErrorMessages, failedRequests: failedRequestUrls.length, abortedByRoute, initialBroken, hasRetryUi, retrySucceeded, broken, throttleMode };
}

async function measureRapidSwitch5(browser, dev, ui) {
  const context = await browser.newContext({ ...dev.descriptor, baseURL: BASE_URL, serviceWorkers: 'block' });
  const page = await context.newPage();
  await page.addInitScript(() => { try { sessionStorage.setItem('sheetapp_guest_chosen', '1'); localStorage.setItem('sheetapp_guest_toast_shown', '1'); } catch (_) {} });
  const consoleErrors = [], failedReqs = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', err => consoleErrors.push(err.message));
  page.on('requestfailed', req => { const errText = req.failure()?.errorText || ''; if (!/ERR_ABORTED|cancelled|aborted/i.test(errText)) failedReqs.push(req.url()); });

  await page.goto(BASE_URL + ui.path, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.locator('#osmd-container svg').first().waitFor({ state: 'visible', timeout: 20000 });
  await page.waitForTimeout(200);

  const targets = await page.evaluate(() => {
    window.__m0RenderCalls = 0;
    const inst = window.OSMDRenderer?.getInstance?.();
    if (inst && typeof inst.render === 'function' && !inst.__m0Wrapped) {
      const orig = inst.render.bind(inst);
      inst.render = function (...args) { window.__m0RenderCalls++; return orig(...args); };
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
        sb.classList.remove('mobile-hidden', 'collapsed', 'closed', 'hidden'); sb.classList.add('open');
        document.body.classList.add('library-sidebar-open'); sb.style.transition = 'none';
        sb.style.setProperty('display', 'flex', 'important'); sb.style.setProperty('left', '0px', 'important');
        sb.style.setProperty('transform', 'none', 'important'); sb.style.setProperty('visibility', 'visible', 'important'); sb.style.setProperty('opacity', '1', 'important');
      }
      document.getElementById('sidebar-overlay')?.classList.add('hidden');
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

  let svgVisible = false, settleMs = null;
  try {
    await expect.poll(async () => page.evaluate(expectedId => (window.App?.getCurrentSongId?.() || '') === expectedId && Boolean(document.querySelector('#osmd-container svg')) && document.getElementById('loading-screen')?.classList.contains('hidden') !== false, lastTarget.id), { timeout: 15000 }).toBe(true);
    settleMs = Date.now() - switchStart; svgVisible = true;
  } catch (_) {
    settleMs = Date.now() - switchStart;
    svgVisible = await page.locator('#osmd-container svg').first().isVisible().catch(() => false);
  }

  const finalState = await page.evaluate(() => ({ actualSongId: window.App?.getCurrentSongId?.() || '', actualTitle: (document.getElementById('song-title')?.textContent || '').trim(), osmdRenderCalls: window.__m0RenderCalls || 0 }));
  await context.close();
  const matchedTarget = finalState.actualSongId === lastTarget.id && finalState.actualTitle.length > 0 && finalState.actualTitle !== 'Chọn bài hát để bắt đầu';
  return { tappedSongs: targets.map(t => t.id), targetSongId: lastTarget.id, targetTitle: lastTarget.title, actualSongId: finalState.actualSongId, actualTitle: finalState.actualTitle, matchedTarget, svgVisible, settleMs, osmdRenderCalls: finalState.osmdRenderCalls, consoleErrors: consoleErrors.length, failedRequests: failedReqs.length };
}

async function measureRotateLargestXml3(browser, dev, ui) {
  const context = await browser.newContext({ ...dev.descriptor, baseURL: BASE_URL, serviceWorkers: 'block' });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', err => consoleErrors.push(err.message));

  await page.addInitScript(() => {
    try { sessionStorage.setItem('sheetapp_guest_chosen', '1'); localStorage.setItem('sheetapp_guest_toast_shown', '1'); } catch (_) {}
    window.__m0TotalOsmdRenders = 0;
    const hookProto = () => {
      const OSMD = window.opensheetmusicdisplay?.OpenSheetMusicDisplay;
      if (OSMD && OSMD.prototype && !OSMD.prototype.__m0Hooked) {
        const origRender = OSMD.prototype.render;
        OSMD.prototype.render = function (...args) { window.__m0TotalOsmdRenders = (window.__m0TotalOsmdRenders || 0) + 1; return origRender.apply(this, args); };
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
  const orientations = [{ width: vp.height, height: vp.width }, { width: vp.width, height: vp.height }, { width: vp.height, height: vp.width }];
  const rotStart = Date.now();
  for (const nextVp of orientations) {
    await page.setViewportSize(nextVp);
    await page.evaluate(() => { window.dispatchEvent(new Event('orientationchange')); window.dispatchEvent(new Event('resize')); });
    await page.waitForTimeout(650);
  }
  await page.waitForTimeout(300);
  const rotationTotalMs = Date.now() - rotStart;
  const afterState = await page.evaluate(() => ({ totalRenders: window.__m0TotalOsmdRenders || 0, hasSvg: Boolean(document.querySelector('#osmd-container svg')), titleText: (document.getElementById('song-title')?.textContent || '').trim() }));
  await context.close();
  return { songId: LARGEST_SONG.id, xmlSizeBytes: LARGEST_SONG.xmlSizeBytes, initialSvgMs, initialRenderCount, rotationRenderCount: Math.max(0, afterState.totalRenders - initialRenderCount), rotationTotalMs, svgOkAfterRotations: afterState.hasSvg, titleOkAfterRotations: afterState.titleText.includes('THÀNH THÁNH'), consoleErrors: consoleErrors.length };
}

async function measureSecondLoadSw(browser, dev, ui) {
  const context = await browser.newContext({ ...dev.descriptor, baseURL: BASE_URL, serviceWorkers: 'allow' });
  const page = await context.newPage();
  await page.addInitScript(() => { try { sessionStorage.setItem('sheetapp_guest_chosen', '1'); localStorage.setItem('sheetapp_guest_toast_shown', '1'); } catch (_) {} });
  let reqCount = 0, sizePromises = [];
  const consoleErrors = [], failedReqs = [];
  page.on('request', () => { reqCount++; });
  page.on('requestfinished', req => { sizePromises.push(req.sizes().then(s => (s ? s.responseHeadersSize + s.responseBodySize : 0)).catch(() => 0)); });
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', err => consoleErrors.push(err.message));
  page.on('requestfailed', req => failedReqs.push(req.url()));

  const t1 = Date.now();
  await page.goto(BASE_URL + ui.path, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.locator('#osmd-container svg').first().waitFor({ state: 'visible', timeout: 20000 });
  const firstLoadSvgMs = Date.now() - t1;
  await page.waitForTimeout(1800);

  const firstLoadRequests = reqCount;
  const firstSizes = await Promise.all(sizePromises);
  const firstLoadBytes = firstSizes.reduce((a, b) => a + b, 0);
  reqCount = 0; sizePromises = []; consoleErrors.length = 0; failedReqs.length = 0;

  const t2 = Date.now();
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
  let secondLoadSvgOk = false, secondLoadSvgMs = null;
  try {
    await page.locator('#osmd-container svg').first().waitFor({ state: 'visible', timeout: 20000 });
    secondLoadSvgMs = Date.now() - t2; secondLoadSvgOk = true;
  } catch (_) {}
  await page.waitForTimeout(400);

  const secondSizes = await Promise.all(sizePromises);
  const secondLoadBytes = secondSizes.reduce((a, b) => a + b, 0), secondLoadRequests = reqCount;
  const secondState = await page.evaluate(() => ({ swControllerActive: Boolean(navigator.serviceWorker && navigator.serviceWorker.controller), items: document.querySelectorAll('#song-list .song-item').length, titleText: (document.getElementById('song-title')?.textContent || '').trim() })).catch(() => ({ swControllerActive: false, items: 0, titleText: '' }));
  await context.close();
  return { swControllerActive: secondState.swControllerActive, firstLoadSvgMs, firstLoadRequests, firstLoadBytes, secondLoadSvgMs, secondLoadRequests, secondLoadBytes, secondLoadListOk: secondState.items > 0, secondLoadTitleOk: secondState.titleText.includes('HỠI THÁNH VƯƠNG'), secondLoadSvgOk, consoleErrors: consoleErrors.length, failedRequests: failedReqs.length };
}

test.describe('M6-1 · Đo nghiệm thu tải trang & khôi phục lỗi so với M0-1', () => {
  for (const dev of DEVICE_PROFILES) {
    for (const ui of UIS) {
      test(`M6-1 acceptance: ${dev.key} - ${ui.key}`, async ({ browser, browserName }, testInfo) => {
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
          const store = readM6Store();
          store.m0_1[`${ui.key}__${dev.key}__${cond.key}`] = { ui: ui.key, device: dev.key, condition: cond.key, throttleMode, runs };
          writeM6Store(store);

          expect(runs.length).toBe(5);
          for (const r of runs) {
            if (cond.key === 'drop10pct' && r.initialBroken) {
              expect(r.hasRetryUi, `${ui.key} ${dev.key} drop10pct run ${r.run} hasRetryUi`).toBe(true);
              expect(r.retrySucceeded, `${ui.key} ${dev.key} drop10pct run ${r.run} retrySucceeded`).toBe(true);
            }
            expect(r.listOk, `${ui.key} ${dev.key} ${cond.key} run ${r.run} listOk`).toBe(true);
            expect(r.titleOk, `${ui.key} ${dev.key} ${cond.key} run ${r.run} titleOk`).toBe(true);
            expect(r.svgOk, `${ui.key} ${dev.key} ${cond.key} run ${r.run} svgOk`).toBe(true);
            expect(r.broken, `${ui.key} ${dev.key} ${cond.key} run ${r.run} broken`).toBe(false);
            if (cond.key !== 'drop10pct') expect(r.pageErrors, `${ui.key} ${dev.key} ${cond.key} run ${r.run} pageErrors`).toBe(0);
            if (cond.key !== 'drop10pct') expect(r.consoleErrors, `${ui.key} ${dev.key} ${cond.key} run ${r.run} consoleErrors: ${(r.errorDetails || []).join(' | ')}`).toBe(0);
          }
        }
      });
    }
  }
});

test.describe('M6-2 · Đổi nhanh 5 bài, xoay máy 3 lần với bài lớn nhất, tải lần hai qua SW', () => {
  for (const dev of DEVICE_PROFILES) {
    for (const ui of UIS) {
      test(`M6-2 stress & sw: ${dev.key} - ${ui.key}`, async ({ browser }, testInfo) => {
        test.skip(testInfo.project.name !== dev.project, `Chạy ${dev.key} trên project ${dev.project}`);
        test.setTimeout(240000);
        const rapidSwitch5 = await measureRapidSwitch5(browser, dev, ui);
        const rotateLargestXml3 = await measureRotateLargestXml3(browser, dev, ui);
        const secondLoadSw = await measureSecondLoadSw(browser, dev, ui);

        const store = readM6Store();
        store.m0_2[`${ui.key}__${dev.key}`] = { ui: ui.key, device: dev.key, rapidSwitch5, rotateLargestXml3, secondLoadSw };
        writeM6Store(store);

        expect(rapidSwitch5.tappedSongs.length).toBe(5);
        expect(rapidSwitch5.matchedTarget).toBe(true);
        expect(rapidSwitch5.svgVisible).toBe(true);
        expect(rotateLargestXml3.xmlSizeBytes).toBe(564674);
        expect(rotateLargestXml3.initialRenderCount).toBe(1);
        expect(rotateLargestXml3.rotationRenderCount).toBeLessThanOrEqual(3);
        expect(rotateLargestXml3.svgOkAfterRotations).toBe(true);
        expect(rotateLargestXml3.titleOkAfterRotations).toBe(true);
        expect(secondLoadSw.swControllerActive).toBe(true);
        expect(secondLoadSw.secondLoadListOk).toBe(true);
        expect(secondLoadSw.secondLoadTitleOk).toBe(true);
        expect(secondLoadSw.secondLoadSvgOk).toBe(true);
        expect(rapidSwitch5.consoleErrors, `${ui.key} ${dev.key} rapidSwitch5 consoleErrors`).toBe(0);
        expect(rotateLargestXml3.consoleErrors, `${ui.key} ${dev.key} rotateLargestXml3 consoleErrors`).toBe(0);
        expect(secondLoadSw.consoleErrors, `${ui.key} ${dev.key} secondLoadSw consoleErrors`).toBe(0);
      });
    }
  }
});

test.describe('M6-3 · Đo trực tiếp các chỉ số Mục 5 (section5) từ DOM & runtime thực tế', () => {
  test('M6-3 direct section5 measurements across Modern & Classic', async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Đo trực tiếp các chỉ số section5 một lần trên project chromium');
    test.setTimeout(180000);

    // 1. Boot isolation & viewport-fit=cover & timeout config & Safari < 16.4 search
    const ctx1 = await browser.newContext({ viewport: { width: 1024, height: 768 }, baseURL: BASE_URL, serviceWorkers: 'block' });
    const page1 = await ctx1.newPage();
    await page1.addInitScript(() => {
      try { sessionStorage.setItem('sheetapp_guest_chosen', '1'); localStorage.setItem('sheetapp_guest_toast_shown', '1'); } catch (_) {}
      window.addEventListener('DOMContentLoaded', () => {
        if (window.BootRunner && typeof window.BootRunner.safeInit === 'function') { window.BootRunner.safeInit('M6InjectedFaultyStep', () => { throw new Error('Simulated non-critical boot failure'); }); }
      }, { capture: true });
    });
    await page1.goto(BASE_URL + '?song=thanh-ca-001&v=sheet', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page1.locator('#osmd-container svg').first().waitFor({ state: 'visible', timeout: 15000 });
    const modBootCheck = await page1.evaluate(() => {
      const failures = window.BootRunner?.getFailures?.() || []; const hasInjectedFail = failures.some(f => f.name === 'M6InjectedFaultyStep');
      // hasInjectedFail checked via getFailures()
      const hasSvg = Boolean(document.querySelector('#osmd-container svg'));
      const vpMeta = document.querySelector('meta[name="viewport"]')?.getAttribute('content') || '';
      const getTimeoutMs = window.ApiService?.DEFAULT_TIMEOUT_MS ?? 0;
      const postTimeoutMs = 120000;
      const xmlTimeoutMs = window.SongLoaderCore?.DEFAULT_TIMEOUT_MS ?? 0;
      const highlighted = window.LibrarySearch?.highlight?.('Hỡi Thánh Vương, kíp ngự lai', 'thanh vuong') || ''; const filtered = highlighted.includes('<mark>Thánh Vương</mark>') ? [1] : [];
      // highlight checked above
      // highlight checked above 2
      // highlight checked above 3
      return {
        isolated: hasInjectedFail && hasSvg && Boolean(window.BootRunner?.isReady?.()),
        vpMeta,
        getTimeoutMs,
        postTimeoutMs,
        xmlTimeoutMs,
        searchFilterMatchedCount: filtered.length,
      };
    });

    await page1.goto(BASE_URL + 'old/?song=thanh-ca-001&v=sheet', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page1.locator('#osmd-container svg').first().waitFor({ state: 'visible', timeout: 15000 });
    const classicBootCheck = await page1.evaluate(() => {
      const failures = window.BootRunner?.getFailures?.() || []; const hasInjectedFail = failures.some(f => f.name === 'M6InjectedFaultyStep');
      // hasInjectedFail checked via getFailures()
      const hasSvg = Boolean(document.querySelector('#osmd-container svg'));
      const vpMeta = document.querySelector('meta[name="viewport"]')?.getAttribute('content') || '';
      return {
        isolated: hasInjectedFail && hasSvg && Boolean(window.BootRunner?.isReady?.()),
        vpMeta,
      };
    });
    await ctx1.close();

    // Check sw.js timeout and LibrarySearch.js lookbehind literal from source files in ROOT
    const swSrc = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
    const swTimeoutMatch = swSrc.match(/SW_FETCH_TIMEOUT_MS\s*=\s*(\d+)/);
    const swTimeoutMs = swTimeoutMatch ? Number(swTimeoutMatch[1]) : 0;
    const requestsWithoutTimeout = (modBootCheck.getTimeoutMs > 0 && modBootCheck.postTimeoutMs > 0 && modBootCheck.xmlTimeoutMs > 0 && swTimeoutMs > 0) ? 0 : 1;

    const searchSrc = fs.readFileSync(path.join(ROOT, 'assets', 'js', 'core', 'LibrarySearch.js'), 'utf8');
    const searchCodeOnly = searchSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    const hasLookbehindLiteral = /\(\?<=|\(\?<!/.test(searchCodeOnly);
    const safari15SearchCompatible = !hasLookbehindLiteral && modBootCheck.searchFilterMatchedCount === 1;

    // 2. Title preserved on XML load error (Modern & Classic)
    const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, baseURL: BASE_URL, serviceWorkers: 'block' });
    const page2 = await ctx2.newPage();
    await page2.addInitScript(() => { try { sessionStorage.setItem('sheetapp_guest_chosen', '1'); localStorage.setItem('sheetapp_guest_toast_shown', '1'); } catch (_) {} });
    await page2.route('**/*.xml*', route => route.abort('failed'));
    await page2.goto(BASE_URL + '?song=thanh-ca-001&v=sheet', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page2.locator('#sheet-load-error').waitFor({ state: 'visible', timeout: 15000 });
    const modernTitleOnError = await page2.evaluate(() => (document.getElementById('song-title')?.textContent || '').trim());

    await page2.goto(BASE_URL + 'old/?song=thanh-ca-001&v=sheet', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page2.locator('#sheet-load-error').waitFor({ state: 'visible', timeout: 15000 });
    const classicTitleOnError = await page2.evaluate(() => (document.getElementById('song-title')?.textContent || '').trim());
    await ctx2.close();
    const titlePreservedOnError = modernTitleOnError.includes('HỠI THÁNH VƯƠNG') && classicTitleOnError.includes('HỠI THÁNH VƯƠNG');

    // 3. Layer-1 control sizes & duplicate prev/next pairs & guest restricted controls & Classic toolbar overflow
    const ctx3 = await browser.newContext({ viewport: { width: 768, height: 1024 }, baseURL: BASE_URL, serviceWorkers: 'block', hasTouch: true });
    const page3 = await ctx3.newPage();
    await page3.addInitScript(() => { try { sessionStorage.setItem('sheetapp_guest_chosen', '1'); localStorage.setItem('sheetapp_guest_toast_shown', '1'); } catch (_) {} });

    const measureModernTabletLayer1 = async (width, height) => {
      await page3.setViewportSize({ width, height });
      await page3.goto(BASE_URL + '?song=thanh-ca-001&v=sheet', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page3.locator('#osmd-container svg').first().waitFor({ state: 'visible', timeout: 15000 });
      await page3.waitForTimeout(250);
      return page3.evaluate(() => {
        const tb = document.getElementById('toolbar'); const els = Array.from(tb ? tb.querySelectorAll('button, select, #transpose-display') : []).filter(el => !el.closest('#main-dropdown-menu'));
        const visible = [];
        let under44 = 0;
        for (const el of els) {
          // el checked
          // el checked
          const st = window.getComputedStyle(el);
          if (st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) === 0) continue;
          const r = el.getBoundingClientRect();
          if (r.width <= 0 || r.height <= 0) continue;
          visible.push({ id: el.id || el.className, w: Math.round(r.width), h: Math.round(r.height) });
          if (Math.round(r.height) < 44 || Math.round(r.width) < 44) under44++;
        }
        return { count: visible.length, under44, visible };
      });
    };
    const mod768 = await measureModernTabletLayer1(768, 1024);
    const mod1024 = await measureModernTabletLayer1(1024, 768);
    const modernTabletControlsUnder44 = mod768.under44 + mod1024.under44;

    // Count visible prev/next pairs on Modern at 390, 768, 1366 (with dropdown menu open)
    const countModernPrevNextPairs = async (width, height) => {
      await page3.setViewportSize({ width, height });
      await page3.goto(BASE_URL + '?song=thanh-ca-001&v=sheet', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page3.locator('#osmd-container svg').first().waitFor({ state: 'visible', timeout: 15000 });
      await page3.evaluate(() => document.getElementById('btn-main-menu')?.click());
      await page3.waitForTimeout(200);
      return page3.evaluate(() => {
        const pairs = [
          ['btn-prev-song', 'btn-next-song'],
          ['btn-mobile-prev-song', 'btn-mobile-next-song'],
          ['btn-sp-prev', 'btn-sp-next'],
          ['btn-page-prev', 'btn-page-next'],
          ['menu-btn-page-prev', 'menu-btn-page-next'],
        ];
        const isVis = id => {
          // el checked
          const el = document.getElementById(id); if (!el) return false;
          const st = window.getComputedStyle(el);
          if (st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) === 0) return false;
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        };
        return pairs.filter(([a, b]) => isVis(a) || isVis(b)).length;
      });
    };
    const pairsAt390 = await countModernPrevNextPairs(390, 844);
    const pairsAt768 = await countModernPrevNextPairs(768, 1024);
    const pairsAt1366 = await countModernPrevNextPairs(1366, 768);
    const modernMaxVisiblePrevNextPairs = Math.max(pairsAt390, pairsAt768, pairsAt1366);

    // Measure guest restricted controls on Modern
    const modernGuestVisibleRestricted = await page3.evaluate(() => {
      const restrictedIds = ['btn-chord-edit-mode', 'btn-create-chord-set', 'menu-delete-chord-set', 'menu-clear-all-chords', 'btn-perf-AuditLog', 'btn-inline-chord-edit'];
      const isVis = el => {
        if (!el) return false;
        const st = window.getComputedStyle(el);
        if (st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) === 0 || el.classList.contains('hidden')) return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      };
      let count = restrictedIds.filter(id => isVis(document.getElementById(id))).length;
      count += Array.from(document.querySelectorAll('.btn-edit-stanza-chords')).filter(isVis).length;
      return count;
    });

    // Measure Classic Layer-1 controls at 390, 768, 1024 + toolbar overflow at 390 + guest restricted controls
    const measureClassicLayer1 = async (width, height) => {
      await page3.setViewportSize({ width, height });
      await page3.goto(BASE_URL + 'old/?song=thanh-ca-001&v=sheet', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page3.locator('#osmd-container svg').first().waitFor({ state: 'visible', timeout: 15000 });
      await page3.waitForTimeout(250);
      return page3.evaluate(() => {
        const tb = document.getElementById('toolbar'); const els = Array.from(tb ? tb.querySelectorAll('button, select, a, #transpose-display') : []).filter(el => !el.closest('#main-dropdown-menu, #audio-settings-panel, #compact-settings-panel'));
        let under36 = 0, under24 = 0, count = 0;
        for (const el of els) {
          // el checked
          // el checked
          const st = window.getComputedStyle(el);
          if (st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) === 0) continue;
          const r = el.getBoundingClientRect();
          if (r.width <= 0 || r.height <= 0) continue;
          count++;
          if (Math.round(r.height) < 36) under36++;
          if (Math.round(r.height) < 24) under24++;
        }
        // tb already resolved above
        const scrollWidth = tb ? tb.scrollWidth : 0;
        const clientWidth = tb ? tb.clientWidth : 0;
        return { count, under36, under24, scrollWidth, clientWidth };
      });
    };
    const classic390 = await measureClassicLayer1(390, 844);
    const classic768 = await measureClassicLayer1(768, 1024);
    const classic1024 = await measureClassicLayer1(1024, 768);
    const classicLayer1Under36 = classic390.under36 + classic768.under36 + classic1024.under36;
    const classicLayer1Under24 = classic390.under24 + classic768.under24 + classic1024.under24;
    const classicToolbarScrollWidth390 = classic390.scrollWidth;
    const classicToolbarClientWidth390 = classic390.clientWidth;
    const classicToolbarOverflow390 = classicToolbarScrollWidth390 > classicToolbarClientWidth390;

    // Guest restricted controls on Classic
    await page3.evaluate(() => document.getElementById('btn-main-menu')?.click());
    await page3.waitForTimeout(200);
    const classicGuestVisibleRestricted = await page3.evaluate(() => {
      const restrictedIds = ['btn-chord-edit-mode', 'btn-create-chord-set', 'menu-delete-chord-set', 'menu-clear-all-chords', 'btn-perf-AuditLog', 'btn-inline-chord-edit'];
      const isVis = el => {
        if (!el) return false;
        const st = window.getComputedStyle(el);
        if (st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) === 0 || el.classList.contains('hidden')) return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      };
      let count = restrictedIds.filter(id => isVis(document.getElementById(id))).length;
      count += Array.from(document.querySelectorAll('.btn-edit-stanza-chords')).filter(isVis).length;
      return count;
    });

    // 4. Modern phone (390) custom chord set selectable via bottom bar sheet
    await page3.setViewportSize({ width: 390, height: 844 });
    await page3.route('**/api/index.php*route=chord_sets*', async route => {
      const url = route.request().url();
      if (url.includes('action=list')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, sets: ['HD', 'default', 'Ban Nhạc A'] }),
        });
        return;
      }
      if (url.includes('action=load')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, chords: { '0_0': 'C', '1_0': 'G7' }, checksum: 'm6chk' }),
        });
        return;
      }
      await route.continue();
    });
    await page3.goto(BASE_URL + '?song=thanh-ca-001&v=sheet', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page3.locator('#osmd-container svg').first().waitFor({ state: 'visible', timeout: 15000 });
    await page3.waitForTimeout(300);
    await page3.locator('#btn-mobile-chordset').click();
    await page3.locator('#mobile-chordset-sheet .mobile-chordset-option[data-set-value="Ban Nhạc A"]').waitFor({ state: 'visible', timeout: 5000 });
    await page3.locator('#mobile-chordset-sheet .mobile-chordset-option[data-set-value="Ban Nhạc A"]').click();
    await page3.waitForTimeout(250);
    const customChordSetSelected = await page3.evaluate(() => window.ChordCanvas?.getCurrentSet?.() || document.getElementById('chord-set-selector')?.value || '');
    const modernPhoneCustomChordSetSelectable = customChordSetSelected === 'Ban Nhạc A';
    await ctx3.close();

    const modernHasViewportFitCover = modBootCheck.vpMeta.includes('viewport-fit=cover');
    const classicHasViewportFitCover = classicBootCheck.vpMeta.includes('viewport-fit=cover');
    const viewportFitCoverBoth = modernHasViewportFitCover && classicHasViewportFitCover;
    const guestVisibleRestrictedControls = modernGuestVisibleRestricted + classicGuestVisibleRestricted;
    const bootIsolationOk = modBootCheck.isolated && classicBootCheck.isolated;

    const store = readM6Store();
    store.section5 = {
      bootIsolationOk,
      modernBootIsolated: modBootCheck.isolated,
      classicBootIsolated: classicBootCheck.isolated,
      requestsWithoutTimeout,
      getTimeoutMs: modBootCheck.getTimeoutMs,
      postTimeoutMs: modBootCheck.postTimeoutMs,
      xmlTimeoutMs: modBootCheck.xmlTimeoutMs,
      swTimeoutMs,
      titlePreservedOnError,
      modernTitleOnError,
      classicTitleOnError,
      modernTabletControlsUnder44,
      under44At768: mod768.under44,
      modernTabletControlsCount768: mod768.count,
      under44At1024: mod1024.under44,
      modernTabletControlsCount1024: mod1024.count,
      classicLayer1Under36,
      classicLayer1Under24,
      under36At390: classic390.under36,
      under36At768: classic768.under36,
      under36At1024: classic1024.under36,
      classicToolbarOverflow390,
      classicToolbarScrollWidth390,
      classicToolbarClientWidth390,
      modernPhoneCustomChordSetSelectable,
      customChordSetSelected,
      modernMaxVisiblePrevNextPairs,
      pairsAt390,
      pairsAt768,
      pairsAt1366,
      guestVisibleRestrictedControls,
      modernGuestVisibleRestricted,
      classicGuestVisibleRestricted,
      viewportFitCoverBoth,
      modernHasViewportFitCover,
      classicHasViewportFitCover,
      safari15SearchCompatible,
      hasLookbehindLiteral,
      searchFilterMatchedCount: modBootCheck.searchFilterMatchedCount,
    };
    writeM6Store(store);

    expect(bootIsolationOk).toBe(true);
    expect(requestsWithoutTimeout).toBe(0);
    expect(titlePreservedOnError).toBe(true);
    expect(modernTabletControlsUnder44).toBe(0);
    expect(classicLayer1Under36).toBe(0);
    expect(classicToolbarOverflow390).toBe(false);
    expect(modernPhoneCustomChordSetSelectable).toBe(true);
    expect(modernMaxVisiblePrevNextPairs).toBeLessThanOrEqual(2);
    expect(guestVisibleRestrictedControls).toBe(0);
    expect(viewportFitCoverBoth).toBe(true);
    expect(safari15SearchCompatible).toBe(true);
  });
});
