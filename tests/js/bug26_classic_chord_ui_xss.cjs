const fs = require('fs');
const vm = require('vm');
const path = require('path');

const root = path.resolve(__dirname, '../..');
let total = 0;
let failed = 0;

function check(ok, msg) {
  total++;
  if (!ok) failed++;
  console.log(`${ok ? '[PASS:B]' : '[FAIL:B]'} ${msg}`);
}

const createdEls = [];
function makeEl() {
  const el = {
    innerHTML: '',
    textContent: '',
    value: '',
    style: {},
    classList: { add() {}, remove() {}, contains: () => false },
    setAttribute() {},
    appendChild() {},
    remove() {},
    focus() {},
    select() {},
    addEventListener() {},
    getBoundingClientRect: () => ({ left: 100, top: 100, right: 150, bottom: 120, width: 50, height: 20 }),
    querySelectorAll: () => [],
    querySelector: () => makeEl()
  };
  createdEls.push(el);
  return el;
}

const w = {
  innerWidth: 1024,
  innerHeight: 768
};

const ctx = vm.createContext({
  window: w,
  document: {
    createElement: () => makeEl(),
    getElementById: () => null,
    querySelectorAll: () => [],
    querySelector: () => null,
    addEventListener() {},
    body: { appendChild() {} }
  },
  localStorage: { getItem: () => null, setItem() {} },
  setTimeout() {},
  clearTimeout() {},
  requestAnimationFrame() {},
  console
});

vm.runInContext(fs.readFileSync(path.join(root, 'assets/js/core/SafeHtml.js'), 'utf8'), ctx);
ctx.SafeHtml = w.SafeHtml;
vm.runInContext(fs.readFileSync(path.join(root, 'old/assets/js/chord-canvas-ui.js'), 'utf8'), ctx);

const anchor = makeEl();
const xssExisting = '"><img src=x onerror=alert(1)>';
const xssSet = '<script>alert(2)</script>';
const pop = w.ChordCanvasUI.createPopup(anchor, 0, 0, xssExisting, xssSet, null, {
  onSave() {},
  onDelete() {},
  onCancel() {}
});

check(
  !pop.innerHTML.includes('<script>alert(2)</script>') && pop.innerHTML.includes('&lt;script&gt;alert(2)&lt;/script&gt;'),
  'Classic ChordCanvasUI.createPopup escapes currentSet in popup header HTML'
);
check(
  !pop.innerHTML.includes('"><img src=x') && pop.innerHTML.includes('&quot;&gt;&lt;img src=x onerror=alert(1)&gt;'),
  'Classic ChordCanvasUI.createPopup escapes existing chord attribute in input value'
);

createdEls.length = 0;
const xssName = '<img src=x onerror=alert(3)>';
w.ChordCanvasUI.showDeleteConfirmModal(xssName, { onConfirm() {} });
const modalOverlay = createdEls[0];
check(
  !modalOverlay.innerHTML.includes('<img src=x') && modalOverlay.innerHTML.includes('&lt;img src=x onerror=alert(3)&gt;'),
  'Classic ChordCanvasUI.showDeleteConfirmModal escapes set name in confirmation HTML'
);

console.log(`SUITE_COMPLETE total=${total} passed=${total - failed} failed=${failed}`);
process.exitCode = failed ? 1 : 0;
