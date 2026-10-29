// Luật mới (2026-10-29): HD rỗng thì hiện bản nhạc SẠCH, không rơi về TLH. Cờ AppRules.HD_EMPTY_SHOWS_TLH bật lại luật cũ.
const fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.resolve(__dirname, '../..');
let total = 0, failed = 0;
function check(ok, message) { total++; if (!ok) failed++; console.log(`${ok ? '[PASS:B]' : '[FAIL:B]'} ${message}`); }
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

function sandbox({ flag, current = 'HD', custom = {}, xmlCount = 20 }) {
  const sb = { console };
  sb.window = sb;
  sb.document = { getElementById() { return null; }, querySelector() { return null; }, querySelectorAll() { return []; }, addEventListener() {}, createElement() { return { setAttribute() {}, style: {} }; }, head: { appendChild() {} }, body: { classList: { contains() { return false; } } } };
  sb.localStorage = { getItem() { return null; }, setItem() {} };
  sb.setTimeout = (fn) => { fn(); return 1; }; sb.clearTimeout = () => {}; sb.requestAnimationFrame = () => 1;
  vm.createContext(sb);
  vm.runInContext(read('assets/js/core/AppRules.js'), sb);
  if (flag) sb.AppRules = { HD_EMPTY_SHOWS_TLH: true };
  sb.ChordCanvasXML = { readXmlChords: () => Object.fromEntries(Array.from({ length: xmlCount }, (_, i) => [`0_${i}`, 'C'])) };
  sb.ChordCanvasUI = {}; sb.ChordCanvasEdit = { resetUndo() {}, setBaseChecksum() {}, closePopup() {} }; sb.ChordCanvasTranspose = { resetCache() {} };
  sb.Auth = { isAdmin: () => false, isBanhat: () => false, getUser: () => '', getChordCode: () => '' };
  sb.App = { getCurrentSongId: () => 's1', showToast() {} };
  sb.ApiService = { chordSets: { list: async () => ({ sets: ['HD'] }), load: async () => ({ success: true, chords: [] }) } };
  vm.runInContext(read('assets/js/chord-canvas.js'), sb);
  sb.ChordCanvas.applyPreloaded(current, Object.keys(custom).length ? custom : {}, 'x');
  return sb;
}

// 1. Mặc định của AppRules.
const base = sandbox({ flag: false });
check(base.AppRules.HD_EMPTY_SHOWS_TLH === false, 'AppRules.HD_EMPTY_SHOWS_TLH mặc định là false (HD rỗng → bản nhạc sạch)');
check(base.AppRules.DEFAULT_CHORD_SET === 'HD', 'Bộ mặc định vẫn là HD');

// 2. ChordCanvas.getChordStatus: HD rỗng + XML có hợp âm → KHÔNG còn là fallback.
check(base.ChordCanvas.getChordStatus().isFallback === false, 'HD rỗng, XML có hợp âm: getChordStatus().isFallback = false');
const legacy = sandbox({ flag: true });
check(legacy.ChordCanvas.getChordStatus().isFallback === true, 'Bật cờ HD_EMPTY_SHOWS_TLH=true thì quay lại luật cũ (isFallback = true)');
const filled = sandbox({ flag: false, custom: { '0_0': 'Am' } });
check(filled.ChordCanvas.getChordStatus().isFallback === false, 'HD có hợp âm: không phải fallback');

// 3. ChordSetNames: nhãn bộ không còn "đang hiện TLH" / "HD→TLH".
function names(flag) {
  const sb = sandbox({ flag });
  vm.runInContext(read('assets/js/core/ChordSetNames.js'), sb);
  return sb.ChordSetNames;
}
const n0 = names(false), n1 = names(true);
check(n0.describe() === 'HD (chưa có)' && n0.short() === 'HD', 'Nhãn bộ HD rỗng: "HD (chưa có)" / "HD" (không nhắc TLH)');
check(n1.describe().includes('đang hiện TLH') && n1.short() === 'HD→TLH', 'Cờ bật lại: nhãn cũ "đang hiện TLH" / "HD→TLH"');

// 4. Các điểm tiêu thụ đều đi qua cờ (chống thêm fallback ngầm).
for (const rel of ['assets/js/chord-canvas.js', 'old/assets/js/chord-canvas.js', 'assets/js/core/ChordSetNames.js', 'assets/js/song-info-bar.js']) {
  check(read(rel).includes('HD_EMPTY_SHOWS_TLH'), `${rel} áp dụng cờ HD_EMPTY_SHOWS_TLH`);
}

console.log(`SUITE_COMPLETE total=${total}`);
process.exit(failed ? 1 : 0);
