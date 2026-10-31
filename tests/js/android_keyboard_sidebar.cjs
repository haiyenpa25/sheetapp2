/**
 * tests/js/android_keyboard_sidebar.cjs — Menu bài hát KHÔNG được biến mất khi bàn phím ảo hiện (máy tính bảng Android).
 *
 * Chạy NGUYÊN FILE thật toolbar-controller.js (Modern + Classic) trong máy ảo Node với cửa sổ/DOM giả, rồi mô phỏng:
 *   1. Chạm ô tìm + bàn phím ảo hiện: bắn 'resize' chỉ đổi CHIỀU CAO  → menu phải còn mở.
 *   2. 'orientationchange' giả (một số máy Android bắn khi bàn phím hiện), bề rộng không đổi → menu phải còn mở.
 *   3. Đang gõ trong ô nhập mà bề rộng đổi nhẹ (< 100px) → menu phải còn mở.
 *   4. Xoay THẬT (bề rộng đổi mạnh)                          → hành vi cũ giữ nguyên (không gãy chức năng).
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const root = path.resolve(__dirname, '../..');
let total = 0, failed = 0;
function check(ok, msg) { total++; if (!ok) failed++; console.log(`${ok ? '[PASS:B]' : '[FAIL:B]'} ${msg}`); }

/** Phần tử giả đủ dùng: classList thật, mọi thuộc tính/hàm lạ trả về giá trị trơ để các binder khác không làm gãy init(). */
function makeEl(id) {
  const classes = new Set();
  const el = {
    id, style: {}, dataset: {}, children: [], textContent: '', value: '', tagName: 'DIV',
    classList: {
      add: (...c) => c.forEach(x => classes.add(x)), remove: (...c) => c.forEach(x => classes.delete(x)),
      contains: c => classes.has(c), toggle: (c, f) => { const on = f === undefined ? !classes.has(c) : !!f; on ? classes.add(c) : classes.delete(c); return on; },
    },
    addEventListener() {}, removeEventListener() {}, setAttribute() {}, getAttribute: () => null, appendChild() {}, remove() {},
    querySelector: () => null, querySelectorAll: () => [], focus() {}, blur() {}, closest: () => null,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0 }),
  };
  return el;
}

function boot(file, { width, height, search = '?song=thanh-ca-003' }) {
  const els = {};
  const getEl = id => (els[id] = els[id] || makeEl(id));
  const listeners = {};
  const timers = [];
  const win = {
    innerWidth: width, innerHeight: height, location: { search, href: 'https://x/' + search },
    addEventListener: (t, fn) => { (listeners[t] = listeners[t] || []).push(fn); },
    removeEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {} }),
    localStorage: { getItem: () => null, setItem() {} }, onorientationchange: null,
  };
  const body = makeEl('body');
  const doc = {
    getElementById: getEl, querySelector: () => null, querySelectorAll: () => [], createElement: () => makeEl('x'),
    addEventListener() {}, removeEventListener() {}, body, documentElement: makeEl('html'), activeElement: body,
  };
  const ctx = vm.createContext({
    window: win, document: doc, console, URLSearchParams, Math, Boolean, Set, Array, Object, String, Number, JSON, Date,
    localStorage: win.localStorage, navigator: { userAgent: 'Android' },
    setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; }, clearTimeout: () => {},
    MutationObserver: class { observe() {} disconnect() {} }, ResizeObserver: class { observe() {} disconnect() {} },
    requestAnimationFrame: fn => fn(), OSMDRenderer: { getIsLoaded: () => false }, ChordCanvas: { reposition() {} },
    App: { showToast() {} }, EventBus: { on() {}, emit() {} }, Store: { get: () => null, set() {} },
  });
  vm.runInContext(fs.readFileSync(path.resolve(root, file), 'utf8') + '\n;this.__TC = ToolbarController;', ctx, { filename: file });
  ctx.__TC.init();
  const sidebar = getEl('sidebar');
  const fire = (type) => (listeners[type] || []).forEach(fn => fn({ type }));
  // chạy mọi timer đã hẹn (debounce 250ms, trễ 350–500ms…), kể cả timer sinh thêm trong lúc chạy
  const flush = () => { for (let i = 0; i < 20 && timers.length; i++) timers.splice(0).forEach(t => t.fn()); };
  return { win, doc, sidebar, getEl, fire, flush, isOpen: () => !sidebar.classList.contains('mobile-hidden'), openMenu: () => { sidebar.classList.remove('mobile-hidden'); getEl('sidebar-overlay').classList.remove('hidden'); } };
}

// TC_MODERN_FILE / TC_CLASSIC_FILE: đường dẫn tuyệt đối tới bản mã khác (dùng để chứng minh test bắt được lỗi trên mã cũ)
for (const [label, file] of [['Modern', process.env.TC_MODERN_FILE || 'assets/js/toolbar-controller.js'], ['Classic', process.env.TC_CLASSIC_FILE || 'old/assets/js/toolbar-controller.js']]) {
  for (const [dev, w, h] of [['tablet dọc 800x1280', 800, 1280], ['điện thoại 412x915', 412, 915]]) {
    const t = boot(file, { width: w, height: h });
    t.openMenu();
    check(t.isOpen(), `${label} ${dev}: mở menu bằng nút → menu mở (điều kiện tiên quyết)`);

    // 1) Chạm ô tìm → bàn phím ảo hiện: chỉ chiều cao đổi
    t.doc.activeElement = Object.assign(t.getEl('search-input'), { tagName: 'INPUT' });
    t.win.innerHeight = Math.round(h * 0.55); t.fire('resize'); t.flush();
    check(t.isOpen(), `${label} ${dev}: bàn phím ảo hiện (resize chỉ đổi chiều cao) → menu VẪN mở`);

    // 2) orientationchange giả, bề rộng không đổi
    t.fire('orientationchange'); t.flush();
    check(t.isOpen(), `${label} ${dev}: orientationchange giả (bề rộng không đổi) → menu VẪN mở`);

    // 3) bàn phím hiện kèm nhiễu bề rộng nhỏ khi đang gõ
    t.win.innerWidth = w - 15; t.fire('resize'); t.flush();
    check(t.isOpen(), `${label} ${dev}: đang gõ + bề rộng đổi nhẹ (15px) → menu VẪN mở`);

  }

  // 4) XOAY THẬT (bề rộng đổi mạnh, không gõ): từ ngang 1280x800 sang dọc 800x1280 → menu đóng như cũ (không gãy chức năng)
  const r = boot(file, { width: 1280, height: 800 });
  r.openMenu(); r.win.innerWidth = 800; r.win.innerHeight = 1280;
  r.fire('orientationchange'); r.fire('resize'); r.flush();
  check(!r.isOpen(), `${label}: xoay thật ngang→dọc (1280→800px, không gõ) → menu đóng như cũ`);
}

// Chốt chặn không được làm hỏng đổi cỡ cửa sổ máy tính (Modern): thu cửa sổ từ 1600px xuống 1000px khi không gõ → đóng
{
  const t = boot('assets/js/toolbar-controller.js', { width: 1600, height: 900, search: '' });
  t.openMenu(); t.win.innerWidth = 1000; t.fire('resize'); t.flush();
  check(!t.isOpen(), 'Modern desktop: thu cửa sổ 1600→1000px (bề rộng đổi thật) → menu đóng như cũ');
}

console.log(`\nSUITE_COMPLETE total=${total} passed=${total - failed} failed=${failed}`);
process.exit(failed ? 1 : 0);
