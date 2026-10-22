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

const textEl = {
  _html: '',
  _text: '',
  set innerHTML(v) { this._html = String(v); },
  get innerHTML() { return this._html; },
  set textContent(v) {
    this._text = String(v);
    this._html = String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  },
  get textContent() { return this._text; }
};

const iconEl = { textContent: '' };
const bannerEl = {
  className: '',
  classList: { add() {}, remove() {}, contains: () => false },
  setAttribute() {},
  querySelector: () => ({ addEventListener() {} }),
  set innerHTML(_) {}
};

const listeners = {};
const EventBus = {
  on(ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); },
  emit(ev, payload) { (listeners[ev] || []).forEach(fn => fn(payload)); }
};

const w = { EventBus };

const ctx = vm.createContext({
  window: w,
  EventBus,
  document: {
    getElementById: id => {
      if (id === 'cue-banner-overlay') return bannerEl;
      if (id === 'cue-banner-icon') return iconEl;
      if (id === 'cue-banner-text') return textEl;
      return null;
    },
    querySelectorAll: () => [],
    querySelector: () => null,
    createElement: () => bannerEl,
    body: { appendChild() {}, classList: { contains: () => false } }
  },
  setTimeout() {},
  clearTimeout() {},
  console
});

vm.runInContext(fs.readFileSync(path.join(root, 'assets/js/core/SafeHtml.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'assets/js/performance/cue-engine.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'assets/js/performance/arrangement-engine.js'), 'utf8'), ctx);

w.CueEngine.init();
w.ArrangementEngine.init();

// 1. Direct showBanner with XSS payload (e.g. from SSE cue)
const xssCue = '<img src=x onerror=alert(1)>';
w.CueEngine.showBanner(xssCue, 'custom', 3000, '📢');
check(
  !textEl.innerHTML.includes('<img') && textEl.innerHTML.includes('&lt;img src=x onerror=alert(1)&gt;'),
  'CueEngine.showBanner does not inject raw HTML tags into #cue-banner-text'
);

// 2. ArrangementEngine.jumpToSection with section name containing <script>
EventBus.emit('song:loaded', {
  song: { id: 'song-1' },
  settings: {
    sections: [{ id: 10, name: 'Điệp khúc <script>alert(2)</script>', type: 'chorus', start_measure: 4 }]
  }
});
w.ArrangementEngine.jumpToSection(10);
check(
  !textEl.innerHTML.includes('<script>') && textEl.innerHTML.includes('&lt;script&gt;alert(2)&lt;/script&gt;'),
  'ArrangementEngine.jumpToSection escapes section name in CueBanner'
);

// 3. CueEngine.checkMeasure still renders structured pre-cue safely when section name has HTML
w.CueEngine.checkMeasure(2); // 2 bars before measure 4
check(
  !textEl.innerHTML.includes('<script>') && textEl.innerHTML.includes('<b>') && textEl.innerHTML.includes('&lt;script&gt;alert(2)&lt;/script&gt;'),
  'CueEngine.checkMeasure preserves bold wrapper while escaping section name'
);

console.log(`SUITE_COMPLETE total=${total} passed=${total - failed} failed=${failed}`);
process.exitCode = failed ? 1 : 0;
