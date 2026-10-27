const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '../..');
let total = 0;

function check(cond, msg) {
  total++;
  if (!cond) {
    console.error('FAIL: ' + msg);
    process.exit(1);
  }
  console.log('PASS: ' + msg);
}

const srcPath = path.join(root, 'assets/js/core/LibrarySearch.js');
const src = fs.readFileSync(srcPath, 'utf8');

// 1. Static check: no lookbehind (?<= or (?<! in LibrarySearch.js
check(!/\(\?<[=!]/.test(src), 'M2-7: LibrarySearch.js does not use regex lookbehind (?<= or (?<!)');

// 2. Simulate iOS < 16.4 RegExp engine that throws SyntaxError on lookbehind
const NativeRegExp = RegExp;
function Ios15RegExp(pattern, flags) {
  const patStr = pattern instanceof NativeRegExp ? pattern.source : String(pattern ?? '');
  if (/\(\?<[=!]/.test(patStr)) {
    throw new SyntaxError('Invalid regular expression: lookbehind is not supported on iOS < 16.4');
  }
  return new NativeRegExp(pattern, flags);
}
Ios15RegExp.prototype = NativeRegExp.prototype;

const win = {
  document: {
    getElementById: () => null,
    querySelectorAll: () => [],
  },
};
const ctx = vm.createContext({
  window: win,
  document: win.document,
  RegExp: Ios15RegExp,
  String,
  Number,
  Boolean,
  Array,
  Object,
  Set,
  Math,
  Error,
  SyntaxError,
});
win.window = win;

vm.runInContext(src, ctx);
const hl = win.LibrarySearch.highlight;

// 3. TV1-3 behavioral highlight checks under iOS < 16.4 RegExp rules
let s = hl('THẮNG ÂN ĐIỂN & an', 'an');
check(s.includes('THẮNG') && !s.includes('THẮ<mark>'), 'M2-7: No highlight inside a Vietnamese word');
check(s.includes('<mark>ÂN</mark>') && s.includes('<mark>an</mark>'), 'M2-7: Accent-insensitive whole word is highlighted');
check(s.includes('&amp;'), 'M2-7: Ampersand remains an intact HTML entity');

s = hl('AN & amp', 'an amp');
check(!s.includes('&<mark>amp</mark>;') && s.includes('<mark>amp</mark>'), 'M2-7: Does not highlight inside escaped entity');

s = hl('<img src=x onerror=alert(1)> yêu thương thế gian', 'yeu thuong');
check(!s.includes('<img') && s.includes('&lt;img') && s.includes('<mark>yêu thương</mark>'), 'M2-7: Escapes HTML and highlights multiword phrase');

s = hl('Giê-xu Jêsus Jesus', 'Jesus');
check((s.match(/<mark>/g) || []).length === 3, 'M2-7: Jesus aliases receive one non-nested mark each');

s = hl('AN an an', 'an an');
check(!s.includes('<mark><mark>') && s.includes('<mark>AN an</mark>') && s.includes('<mark>an</mark>'), 'M2-7: Overlapping phrase and token matches do not nest marks');

console.log('\nSUITE_COMPLETE total=' + total);
