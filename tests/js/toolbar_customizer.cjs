'use strict';
/**
 * Chạy ToolbarCustomizer trong vm với DOM giả tối thiểu. In "OK <mô tả>" / "FAIL <mô tả>" mỗi dòng.
 */
const vm = require('vm');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..', '..');

function makeSandbox(stored) {
  const store = new Map(stored === undefined ? [] : [['sheetapp.toolbar.hidden.v1', stored]]);
  const styleEls = {};
  const doc = {
    readyState: 'complete', head: { appendChild(el) { styleEls[el.id] = el; } },
    getElementById(id) { return styleEls[id] || null; },
    createElement() { return { id: '', textContent: '' }; },
    querySelector() { return null; },
    addEventListener() {},
  };
  const sb = { document: doc, console, localStorage: { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, v) } };
  sb.window = sb;
  vm.createContext(sb);
  vm.runInContext(fs.readFileSync(path.join(root, 'assets/js/toolbar-customizer.js'), 'utf8'), sb);
  return { TC: sb.window.ToolbarCustomizer, store, css: () => (styleEls['toolbar-customizer-css'] || {}).textContent || '' };
}
const report = (ok, label, detail) => console.log((ok ? 'OK ' : 'FAIL ') + label + (ok ? '' : ' :: ' + detail));

let t = makeSandbox();
report(t.TC.getHidden().length === 0 && t.css() === '', 'Mặc định: không ẩn nút nào, CSS rỗng', t.css());

t.TC.setHidden('zoom', true);
t.TC.setHidden('fullscreen', true);
report(JSON.stringify(t.TC.getHidden()) === '["zoom","fullscreen"]', 'setHidden ghi nhớ đúng thứ tự', JSON.stringify(t.TC.getHidden()));
report(t.store.get('sheetapp.toolbar.hidden.v1') === '["zoom","fullscreen"]', 'Lưu vào localStorage theo thiết bị', String(t.store.get('sheetapp.toolbar.hidden.v1')));
report(t.css().includes('#btn-zoom-in:not(#tc-x1)') && t.css().includes('display: none !important') && t.css().includes('#btn-fullscreen'), 'CSS ẩn có đủ selector và !important', t.css());
report(!t.css().includes('#btn-transpose-up'), 'Nút không bị ẩn thì không có trong CSS', t.css());

t.TC.setHidden('zoom', false);
report(JSON.stringify(t.TC.getHidden()) === '["fullscreen"]' && !t.css().includes('#btn-zoom-in'), 'Bỏ ẩn → nút hiện lại', t.css());

t.TC.setHidden('khong-ton-tai', true);
report(JSON.stringify(t.TC.getHidden()) === '["fullscreen"]', 'Key lạ bị bỏ qua', JSON.stringify(t.TC.getHidden()));

t.TC.reset();
report(t.TC.getHidden().length === 0 && t.css() === '' && t.store.get('sheetapp.toolbar.hidden.v1') === '[]', 'reset() khôi phục mặc định và xoá lưu trữ', t.css());

const reload = makeSandbox('["tone","rac","scroll"]');
report(JSON.stringify(reload.TC.getHidden()) === '["tone","scroll"]', 'Tải lại: đọc lại trạng thái đã lưu, loại key rác', JSON.stringify(reload.TC.getHidden()));
report(reload.css().includes('#btn-transpose-up') && reload.css().includes('.scroll-pill'), 'Tải lại: CSS ẩn áp ngay khi script chạy', reload.css());

const corrupt = makeSandbox('{không phải json');
report(corrupt.TC.getHidden().length === 0, 'localStorage hỏng → không ném lỗi, dùng mặc định', JSON.stringify(corrupt.TC.getHidden()));
const wrongType = makeSandbox('"zoom"');
report(wrongType.TC.getHidden().length === 0, 'localStorage sai kiểu (chuỗi) → bỏ qua', JSON.stringify(wrongType.TC.getHidden()));
