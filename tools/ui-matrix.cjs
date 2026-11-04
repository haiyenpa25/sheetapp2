/**
 * tools/ui-matrix.cjs — Cổng kiểm giao diện tự động (Modern `/` + Classic `/old/`).
 *
 * Với mỗi (giao diện × cỡ màn hình × vai trò × chủ đề) đo:
 *   - 10 điều khiển bắt buộc có THẤY ngay không (RULE.md §5), Soạn chỉ tính khi tài khoản được sửa
 *   - tràn ngang, chữ < 11px, nút/chip nhỏ hơn ngưỡng chạm, lỗi JS
 *   - (tuỳ chọn --axe) vi phạm tương phản/aria mức serious+
 * Ngoài ra đếm `!important` trong CSS web để theo dõi nợ cascade.
 *
 * Dùng:  node tools/ui-matrix.cjs [--tag=ten] [--strict] [--axe] [--dark] [--quick] [--base=URL]
 * Tài khoản có quyền sửa (không ghi vào repo):  SHEETAPP_UI_USER, SHEETAPP_UI_PASS
 * Ảnh + JSON lưu ở thư mục tạm (mặc định %TEMP%/sheetapp-ui/<tag>); đặt SHEETAPP_UI_OUT để đổi.
 * Chạy trên bản sao cô lập (e2e) hoặc local; KHÔNG trỏ vào CSDL thật khi ghi dữ liệu.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { chromium } = require('@playwright/test');

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v === undefined ? true : v];
}));
const BASE = String(args.base || process.env.SHEETAPP_E2E_BASE_URL || 'http://localhost/sheetapp2').replace(/\/$/, '');
const TAG = String(args.tag || 'run');
const OUT = path.join(process.env.SHEETAPP_UI_OUT || path.join(os.tmpdir(), 'sheetapp-ui'), TAG);
const SONG = process.env.SHEETAPP_UI_SONG || 'thanh-ca-001';
const MIN_FONT_PX = 11;
const MIN_TARGET_MOUSE = 32;
const MIN_TARGET_TOUCH = 36;
const TOUCH_MAX_WIDTH = 1100;
const PHONE_MAX_WIDTH = 800;
const AUTH_SETTLE_MS = 8000;

const CONTROLS = {
  tong:      ['#btn-transpose-down', '#btn-transpose-up', '#btn-mobile-transpose-down', '#btn-mobile-transpose-up'],
  goc:       ['#btn-transpose-reset', '#btn-mobile-transpose-reset'],
  hopam:     ['#chord-set-selector', '#btn-mobile-chordset'],
  zoom:      ['#zoom-slider', '#mobile-zoom-select', '#toolbar-zoom-pill'],
  khoaZoom:  ['#btn-lock-zoom', '#btn-mobile-lock-zoom'],
  loiSheet:  ['#btn-view-lyrics', '#btn-lyric-view', '#btn-mobile-view-toggle'],
  bpm:       ['#btn-toolbar-tempo', '#btn-toolbar-metronome', '#btn-mobile-tempo'],
  kyHieu:    ['#btn-chord-notation', '#btn-mobile-notation', '#btn-toolbar-notation'],
  gon:       ['#btn-compact-mode:not(.btn-menu-item)', '#btn-toolbar-compact', '#btn-mobile-compact'],
  cuon:      ['#btn-auto-scroll:not(.btn-menu-item)', '#btn-mobile-scroll', '#btn-toolbar-scroll'],
  soanHopAm: ['#btn-add-chord-mode-bar', '#btn-mobile-edit', '#btn-toolbar-edit'],
};
const ALL_VIEWPORTS = [['desktop', 1366, 768], ['laptop', 1280, 720], ['ipad-ngang', 1024, 768], ['ipad-doc', 768, 1024],
  ['dt-lon', 430, 932], ['dt', 390, 844], ['dt-be', 360, 740], ['dt-ngang', 844, 390]];
const VIEWPORTS = args.quick ? ALL_VIEWPORTS.filter(v => ['desktop', 'ipad-doc', 'dt'].includes(v[0])) : ALL_VIEWPORTS;
const UIS = [['modern', '/'], ['classic', '/old/']];

/** Chạy trong trang: đo điều khiển, tràn ngang, chữ nhỏ, vùng chạm nhỏ. */
function probe({ controls, minFont, minTarget }) {
  const visible = (e) => {
    const r = e.getBoundingClientRect(), s = getComputedStyle(e);
    if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0 || r.width < 8 || r.height < 8) return false;
    if (e.closest('.hidden, [hidden], #main-dropdown-menu, .dropdown-menu, #more-options-group')) return false;
    return r.right > 0 && r.left < innerWidth && r.bottom > 0 && r.top < innerHeight && r.left >= -1 && r.right <= innerWidth + 1;
  };
  const out = { controls: {} };
  for (const [k, sels] of Object.entries(controls)) {
    let state = 'thiếu';
    for (const sel of sels) {
      const els = [...document.querySelectorAll(sel)];
      if (!els.length) continue;
      if (els.some(visible)) { state = 'THẤY'; break; }
      state = els.some(e => getComputedStyle(e).display !== 'none') ? 'ngoài khung' : 'ẩn';
    }
    out.controls[k] = state;
  }
  out.overflowX = document.documentElement.scrollWidth > innerWidth + 1;
  const label = (e) => (e.id ? '#' + e.id : e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/)[0] : ''));
  const smallText = [], smallTargets = [];
  for (const e of document.body.querySelectorAll('*')) {
    if (e.closest('svg, #osmd-container, script, style') || !visible(e)) continue;
    const hasText = [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    if (hasText && parseFloat(getComputedStyle(e).fontSize) < minFont) smallText.push(label(e));
    if (e.matches('button, a[href], select, [role="button"], input:not([type="hidden"])')) {
      const r = e.getBoundingClientRect();
      if (Math.min(r.width, r.height) < minTarget) smallTargets.push(`${label(e)} ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
  }
  out.smallText = [...new Set(smallText)];
  out.smallTargets = [...new Set(smallTargets)];
  return out;
}

function importantDebt() {
  const files = {};
  let total = 0;
  for (const dir of ['assets/css', 'old/assets/css']) {
    const abs = path.join(__dirname, '..', dir);
    if (!fs.existsSync(abs)) continue;
    for (const f of fs.readdirSync(abs).filter(n => n.endsWith('.css'))) {
      const n = (fs.readFileSync(path.join(abs, f), 'utf8').match(/!important/g) || []).length;
      files[`${dir}/${f}`] = n;
      total += n;
    }
  }
  return { total, files };
}

/** Đăng nhập một lần rồi dùng lại phiên (cookie) cho mọi cấu hình, tránh bị giới hạn tốc độ đăng nhập. */
async function loginOnce(browser, user, pass) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(BASE + '/');
  const res = await page.evaluate(([u, p]) => window.ApiService.auth.login({ username: u, password: p }), [user, pass]);
  if (!res || res.success === false) throw new Error('Đăng nhập tài khoản kiểm thất bại: ' + JSON.stringify(res).slice(0, 120));
  const state = await ctx.storageState();
  await ctx.close();
  return state;
}

async function measure(browser, { ui, p, vp, w, h, role, theme }, session, AxeBuilder) {
  const touch = w < TOUCH_MAX_WIDTH;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: w < PHONE_MAX_WIDTH, colorScheme: theme === 'toi' ? 'dark' : 'light', storageState: role === 'sua' ? session : undefined });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e).slice(0, 100)));
  if (theme === 'toi') await page.addInitScript(() => { try { localStorage.setItem('sheetapp_theme', 'dark'); } catch (_) { /* không có storage */ } });
  await page.goto(`${BASE}${p}?song=${SONG}`);
  await page.waitForSelector('#osmd-container svg', { timeout: 40000 }).catch(() => {});
  await page.waitForTimeout(2000);
  if (role === 'sua') {
    // Quyền sửa được áp lên giao diện sau khi /auth?me trả về, nên chờ nút Soạn mở khoá rồi mới đo.
    const soan = CONTROLS.soanHopAm.join(', ');
    await page.waitForFunction((sel) => [...document.querySelectorAll(sel)].some(e => !e.closest('.hidden, [hidden], .deck-hidden') && !e.classList.contains('deck-hidden')), soan, { timeout: AUTH_SETTLE_MS }).catch(() => {});
  }
  const r = await page.evaluate(probe, { controls: CONTROLS, minFont: MIN_FONT_PX, minTarget: touch ? MIN_TARGET_TOUCH : MIN_TARGET_MOUSE });
  const need = Object.keys(CONTROLS).filter(c => c !== 'soanHopAm' || role === 'sua');
  const miss = need.filter(c => r.controls[c] !== 'THẤY');
  const row = { key: `${ui} | ${vp} ${w} | ${role} | ${theme}`, ok: need.length - miss.length, need: need.length, miss,
    overflowX: r.overflowX, smallText: r.smallText, smallTargets: r.smallTargets, errors: errors.length };
  if (AxeBuilder) {
    const res = await new AxeBuilder({ page }).include('#toolbar, #mobile-thumb-bar, #sidebar').analyze().catch(() => null);
    row.axe = (res ? res.violations.filter(v => ['serious', 'critical'].includes(v.impact)) : []).map(v => `${v.id}×${v.nodes.length}`);
  }
  await page.screenshot({ path: path.join(OUT, `${ui}-${vp}-${role}-${theme}.png`) });
  await ctx.close();
  return row;
}

function summarize(row) {
  const issues = [];
  if (row.ok < row.need) issues.push(`thiếu: ${row.miss.join(',')}`);
  if (row.overflowX) issues.push('TRÀN NGANG');
  if (row.errors) issues.push(`${row.errors} lỗi JS`);
  if (row.smallText.length) issues.push(`chữ<${MIN_FONT_PX}px: ${row.smallText.length}`);
  if (row.smallTargets.length) issues.push(`nút nhỏ: ${row.smallTargets.length}`);
  if (row.axe && row.axe.length) issues.push(`axe: ${row.axe.join(',')}`);
  return issues;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const creds = { user: process.env.SHEETAPP_UI_USER, pass: process.env.SHEETAPP_UI_PASS };
  const roles = creds.user && creds.pass ? ['khach', 'sua'] : ['khach'];
  if (roles.length === 1) console.log('(Không có SHEETAPP_UI_USER/PASS: chỉ kiểm vai trò khách, bỏ qua nút Soạn)');
  const themes = args.dark ? ['sang', 'toi'] : ['sang'];
  const AxeBuilder = args.axe ? require('@axe-core/playwright').default : null;
  const browser = await chromium.launch();
  const session = roles.includes('sua') ? await loginOnce(browser, creds.user, creds.pass) : null;
  const rows = [];
  for (const role of roles) for (const theme of themes) for (const [ui, p] of UIS) for (const [vp, w, h] of VIEWPORTS) {
    rows.push(await measure(browser, { ui, p, vp, w, h, role, theme }, session, AxeBuilder));
  }
  await browser.close();

  const debt = importantDebt();
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({ tag: TAG, base: BASE, important: debt, rows }, null, 1));
  let bad = 0;
  for (const row of rows) {
    const issues = summarize(row);
    if (issues.length) bad++;
    console.log(`${row.key.padEnd(40)} ${row.ok}/${row.need}  ${issues.join(' · ') || 'OK'}`);
  }
  console.log(`\n!important trong CSS web: ${debt.total}  (chi tiết trong report.json)`);
  console.log(`Cấu hình có vấn đề: ${bad}/${rows.length}. Báo cáo + ảnh: ${OUT}`);
  if (args.strict && bad) process.exit(1);
})().catch(e => { console.error(e); process.exit(2); });
