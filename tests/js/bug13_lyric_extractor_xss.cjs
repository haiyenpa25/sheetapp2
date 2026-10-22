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

const xssTitle = 'Bài <img src=x onerror=alert(1)>';
const xssKey = 'G<script>alert(2)</script>';

const container = {
  innerHTML: '',
  style: { setProperty() {} },
  querySelectorAll: () => [],
  querySelector: () => null
};

const fakeNote = {
  tagName: 'note',
  querySelector: sel => sel === 'lyric' ? {
    getAttribute: () => '1',
    querySelector: s => s === 'text' ? { textContent: 'Ha-lê-lu-gia' } : null
  } : null,
  querySelectorAll: () => [{
    getAttribute: () => '1',
    querySelector: s => s === 'text' ? { textContent: 'Ha-lê-lu-gia' } : null
  }]
};

const fakeDoc = {
  querySelector: sel => {
    if (sel === 'part') {
      return {
        querySelectorAll: s => s === 'measure' ? [{ children: [fakeNote] }] : []
      };
    }
    return null;
  }
};

const w = {
  XmlDocCache: { getDoc: () => fakeDoc }
};

const ctx = vm.createContext({
  window: w,
  document: {
    getElementById: id => {
      if (id === 'lyric-view-container') return container;
      if (id === 'song-title') return { textContent: xssTitle };
      if (id === 'song-key') return { textContent: xssKey };
      return null;
    },
    querySelectorAll: () => [],
    querySelector: () => null,
    createElement: () => ({ style: {}, setAttribute() {}, remove() {} }),
    head: { appendChild() {} },
    body: { dataset: {} }
  },
  localStorage: { getItem: () => 'stacked', setItem() {} },
  console
});

vm.runInContext(fs.readFileSync(path.join(root, 'assets/js/core/SafeHtml.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'assets/js/lyric-extractor.js'), 'utf8'), ctx);

w.LyricExtractor.render('lyric-view-container', '<score-partwise/>', 0);

check(
  !container.innerHTML.includes('<img src=x') && container.innerHTML.includes('&lt;img src=x onerror=alert(1)&gt;'),
  'LyricExtractor escapes song title before interpolating into .lv-title HTML'
);
check(
  !container.innerHTML.includes('<script>alert(2)</script>') && container.innerHTML.includes('&lt;script&gt;alert(2)&lt;/script&gt;'),
  'LyricExtractor escapes song key before interpolating into .lv-key HTML'
);

console.log(`SUITE_COMPLETE total=${total} passed=${total - failed} failed=${failed}`);
process.exitCode = failed ? 1 : 0;
