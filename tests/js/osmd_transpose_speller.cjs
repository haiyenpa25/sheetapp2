/**
 * tests/js/osmd_transpose_speller.cjs — Dịch giọng không sinh thăng/giáng/♮ thừa.
 * Chạy NGUYÊN FILE osmd-transpose-speller.js với API Pitch giả (cùng quy ước OSMD: NoteEnum = nửa cung, Octave tuyến tính).
 * Với mọi tông gốc (12 tông trưởng) × mọi mức dịch -12..+12: cao độ tuyệt đối phải đúng, và các nốt thuộc
 * thang âm của tông gốc phải rơi vào thang âm của tông MỚI mà không cần dấu (đúng tên theo tông).
 */
const fs = require('fs'), vm = require('vm'), path = require('path');
let total = 0, failed = 0;
const check = (ok, msg) => { total++; if (!ok) failed++; console.log(`${ok ? '[PASS:B]' : '[FAIL:B]'} ${msg}`); };

const NoteEnum = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const ACC = { '-2': 'DOUBLEFLAT', '-1': 'FLAT', 0: 'NONE', 1: 'SHARP', 2: 'DOUBLESHARP' };
class Pitch {
  constructor(n, o, a) { this.FundamentalNote = n; this.Octave = o; this.Accidental = a; }
  static HalfTonesFromAccidental(a) { return Number(Object.keys(ACC).find(k => ACC[k] === a)); }
  static AccidentalFromHalfTones(h) { return ACC[h]; }
}
const win = { opensheetmusicdisplay: { Pitch, NoteEnum } };
vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../../assets/js/osmd-transpose-speller.js'), 'utf8'),
  Object.assign(win, { window: win, console: { warn() {}, log: console.log } }));
const S = win.OsmdTransposeSpeller;
const calc = { transposePitch() { throw new Error('gốc'); } };
S.install(calc, win.opensheetmusicdisplay);

const KEY_MAPPING = [0, -5, 2, -3, 4, -1, 6, 1, -4, 3, -2, 5]; // y hệt OSMD: tông có tonic cách C k nửa cung
const letterOf = n => Object.keys(NoteEnum).find(k => NoteEnum[k] === n);
const absOf = p => p.Octave * 12 + p.FundamentalNote + Pitch.HalfTonesFromAccidental(p.Accidental);
const scaleLetters = fifths => { // chữ cái + dấu của 7 bậc trong tông `fifths`
  const out = {};
  for (let pos = fifths - 1; pos <= fifths + 5; pos++) out[S.spell(((pos * 7) % 12 + 12) % 12 === 0 ? 0 : (((pos * 7) % 12) + 12) % 12, fifths).letter] = S.spell((((pos * 7) % 12) + 12) % 12, fifths).alter;
  return out;
};

let pitchBad = 0, scaleBad = 0, ranges = 0;
for (let tonic = 0; tonic < 12; tonic++) {
  const srcFifths = KEY_MAPPING[tonic];
  for (let t = -12; t <= 12; t++) {
    const newFifths = KEY_MAPPING[(((tonic + t) % 12) + 12) % 12];
    const major = [0, 2, 4, 5, 7, 9, 11];
    for (const deg of major) {
      const orig = new Pitch(NoteEnum.C, 4, 'NONE'); // dựng cao độ tuyệt đối = tonic + bậc
      const abs = 4 * 12 + tonic + deg;
      const src = S.spell(abs, srcFifths);
      const p = new Pitch(NoteEnum[src.letter], (abs - src.alter - NoteEnum[src.letter]) / 12, ACC[src.alter]);
      const q = calc.transposePitch(p, { Key: newFifths }, t);
      if (absOf(q) !== abs + t) pitchBad++;
      // nốt thang âm gốc sau dịch phải thuộc thang âm tông mới (alter khớp với dấu của tông)
      const keyAlter = scaleLetters(newFifths)[letterOf(q.FundamentalNote)];
      if (Pitch.HalfTonesFromAccidental(q.Accidental) !== keyAlter) scaleBad++;
      ranges++;
    }
  }
}
check(ranges === 12 * 25 * 7, `đã duyệt ${ranges} nốt (12 tông × 25 mức dịch × 7 bậc)`);
check(pitchBad === 0, `cao độ tuyệt đối luôn đúng sau dịch (sai: ${pitchBad})`);
check(scaleBad === 0, `nốt thang âm của tông gốc không cần dấu thừa trong tông mới (sai: ${scaleBad})`);

const g2fs = { Key: 6 }; // G → F# (−1): fa thăng gốc (bậc 7) phải là E#, không phải F♮
const fsharp = calc.transposePitch(new Pitch(NoteEnum.F, 4, 'SHARP'), g2fs, -1);
check(letterOf(fsharp.FundamentalNote) === 'E' && fsharp.Accidental === 'SHARP', 'G→F#: fa# gốc thành mi# (hết dấu ♮ thừa)');
const g2ab = calc.transposePitch(new Pitch(NoteEnum.G, 4, 'NONE'), { Key: -4 }, 1);
check(letterOf(g2ab.FundamentalNote) === 'A' && g2ab.Accidental === 'FLAT', 'G→Ab (+1): sol thành la giáng');
const hc = calc.transposePitch(new Pitch(NoteEnum.B, 4, 'NONE'), { Key: -4 }, 1);
check(letterOf(hc.FundamentalNote) === 'C' && hc.Accidental === 'NONE' && hc.Octave === 5, 'B→C (+1) qua ranh giới quãng tám giữ Octave đúng');
const fallbackCalc = Object.assign(Object.create({ transposePitch: () => 'GOC' }), {});
S.install(fallbackCalc, { Pitch: class { static HalfTonesFromAccidental() { throw new Error('x'); } }, NoteEnum });
check(fallbackCalc.transposePitch({}, {}, 1) === 'GOC', 'lỗi bất ngờ thì rơi về cách ghi mặc định của OSMD, không làm hỏng trang');
console.log(`SUITE_COMPLETE total=${total}`);
process.exit(failed ? 1 : 0);
