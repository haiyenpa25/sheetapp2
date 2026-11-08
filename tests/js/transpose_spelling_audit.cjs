'use strict';
/**
 * Quét toàn bộ tổ hợp dịch giọng, in mỗi kiểm tra một dòng "OK <mô tả>" hoặc "FAIL <mô tả>".
 *  1. transposeChord: đúng cao độ gốc, giữ nguyên hậu tố, đúng bass (có và không có Tonal.js)
 *  2. Nhãn giọng KeyService.displayKey cùng họ thăng/giáng với hợp âm khung vẽ (ChordCanvasTranspose: fifths < 0 → giáng)
 */
const vm = require('vm');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..', '..');

function load(withTonal) {
  const sb = { console };
  sb.window = sb; sb.global = sb; vm.createContext(sb);
  if (withTonal) vm.runInContext(fs.readFileSync(path.join(root, 'assets/js/vendor/tonal.min.js'), 'utf8'), sb);
  vm.runInContext(fs.readFileSync(path.join(root, 'assets/js/transpose-engine.js'), 'utf8'), sb);
  vm.runInContext(fs.readFileSync(path.join(root, 'assets/js/core/KeyService.js'), 'utf8'), sb);
  return sb;
}

const SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const chroma = (n) => { const i = SHARP.indexOf(n); return i >= 0 ? i : FLAT.indexOf(n); };
const ROOTS = ['C', 'C#', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const SUFFIXES = ['', 'm', '7', 'm7', 'maj7', 'sus4', 'sus2', 'dim', 'aug', '6', 'add9', '9', 'm9', 'dim7', 'm7b5'];
const KEYS = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'Db', 'Ab', 'Eb', 'Bb', 'F', 'Am', 'Em', 'Bm', 'F#m', 'C#m', 'G#m', 'D#m', 'Dm', 'Gm', 'Cm', 'Fm', 'Bbm'];
// Giống ChordCanvasTranspose._SEMITONE_FIFTHS_OFFSET
const FIFTHS_OFFSET = [0, -5, 2, -3, 4, -1, 6, 1, -4, 3, -2, 5];

function report(ok, label, detail) {
  console.log((ok ? 'OK ' : 'FAIL ') + label + (ok ? '' : ' :: ' + detail));
}

for (const withTonal of [false, true]) {
  const sb = load(withTonal);
  const TE = sb.TransposeEngine;
  const bad = [];
  let total = 0;
  for (const r of ROOTS) for (const s of SUFFIXES) for (const slash of [null, 'E', 'Bb', 'F#']) {
    const name = r + s + (slash ? '/' + slash : '');
    for (let st = -11; st <= 11; st++) {
      if (st === 0) continue;
      for (const uf of [null, true, false]) {
        total++;
        const out = String(TE.transposeChord(name, st, uf));
        const m = out.match(/^([A-G][#b]?)([^/]*)(?:\/([A-G][#b]?))?$/);
        if (!m) { bad.push(`${name} ${st} ${uf}: ${out}`); continue; }
        if (chroma(m[1]) !== (((chroma(r) + st) % 12) + 12) % 12) bad.push(`gốc ${name} ${st} ${uf}: ${out}`);
        else if (m[2] !== s) bad.push(`hậu tố ${name} ${st} ${uf}: ${out}`);
        else if (slash && (!m[3] || chroma(m[3]) !== (((chroma(slash) + st) % 12) + 12) % 12)) bad.push(`bass ${name} ${st} ${uf}: ${out}`);
      }
    }
  }
  report(bad.length === 0, `transposeChord ${withTonal ? 'có Tonal' : 'dự phòng'}: ${total} phép dịch đúng cao độ, hậu tố, bass`, bad.slice(0, 3).join(' | '));
}

const sb = load(false);
const KS = sb.KeyService;
const mismatch = [];
let count = 0;
for (const k of KEYS) for (let st = -11; st <= 11; st++) {
  if (!st) continue;
  count++;
  let f = KS.getFifths(k) + FIFTHS_OFFSET[((st % 12) + 12) % 12];
  while (f > 6) f -= 12;
  while (f < -6) f += 12;
  const label = KS.displayKey(k, st);
  if ((/^[A-G]b/.test(label) && f >= 0) || (/^[A-G]#/.test(label) && f < 0)) mismatch.push(`${k} ${st}: ${label} (f=${f})`);
}
report(mismatch.length === 0, `Nhãn giọng KeyService cùng họ thăng/giáng với hợp âm vẽ (${count} ca)`, mismatch.slice(0, 4).join(' | '));
report(KS.displayKey('D', -1) === 'Db' && KS.displayKey('Cm', 8) === 'G#m', 'D −1 = Db và Cm +8 = G#m (ít dấu hoá nhất)', `${KS.displayKey('D', -1)} / ${KS.displayKey('Cm', 8)}`);
