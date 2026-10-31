/**
 * assets/js/osmd-transpose-speller.js
 * Ghi tên nốt/hợp âm sau khi dịch giọng theo TÔNG MỚI.
 * OSMD gốc chọn thăng/giáng chỉ theo dấu của tông và trả "không dấu" cho nốt tự nhiên,
 * nên khi cộng/trừ tông bản nhạc có dấu hoàn (♮), thăng/giáng thừa và hợp âm sai tên.
 *
 * Phụ thuộc: opensheetmusicdisplay (Pitch, AccidentalEnum). Gọi qua OSMDRenderer._applyTranspose.
 * Public API: { install, spell }
 */
const OsmdTransposeSpeller = (() => {
  'use strict';

  const PITCH_CLASSES = 12;
  const FIFTHS_STEP = 7;
  const WINDOW_BELOW_KEY = 4; // cửa sổ 12 vị trí quanh tông: [f-4, f+7]
  const LETTERS_ON_FIFTHS = ['F', 'C', 'G', 'D', 'A', 'E', 'B']; // vị trí -1..5 trên vòng quãng 5
  const LETTER_SEMITONE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

  const _mod = (n, m) => ((n % m) + m) % m;

  /** Vị trí trên vòng quãng 5 (C=0, G=1, F=-1…) của cao độ pc, gần tông có `fifths` nhất. */
  function _fifthsPosition(pc, fifths) {
    const start = fifths - WINDOW_BELOW_KEY;
    const base = _mod(pc * FIFTHS_STEP, PITCH_CLASSES);
    return base + PITCH_CLASSES * Math.ceil((start - base) / PITCH_CLASSES);
  }

  /** Trả { letter, alter } cho cao độ pc trong tông `fifths`. */
  function spell(pc, fifths) {
    const pos = _fifthsPosition(_mod(pc, PITCH_CLASSES), fifths);
    return {
      letter: LETTERS_ON_FIFTHS[_mod(pos + 1, FIFTHS_STEP)],
      alter: Math.floor((pos + 1) / FIFTHS_STEP)
    };
  }

  function _absoluteHalftone(pitch, osmdApi) {
    const accidental = osmdApi.Pitch.HalfTonesFromAccidental(pitch.Accidental);
    return pitch.Octave * PITCH_CLASSES + pitch.FundamentalNote + accidental;
  }

  function _transposePitch(osmdApi, pitch, key, halftones) {
    const fifths = Number.isFinite(key?.Key) ? key.Key : 0;
    const target = _absoluteHalftone(pitch, osmdApi) + halftones;
    const { letter, alter } = spell(target, fifths);
    const letterSemitone = LETTER_SEMITONE[letter];
    // Octave tính ngược để Cb/B# vẫn đúng cao độ tuyệt đối
    const octave = (target - alter - letterSemitone) / PITCH_CLASSES;
    return new osmdApi.Pitch(
      osmdApi.NoteEnum[letter],
      octave,
      osmdApi.Pitch.AccidentalFromHalfTones(alter)
    );
  }

  function install(calculator, osmdApi = window.opensheetmusicdisplay) {
    if (!calculator || !osmdApi?.Pitch || !osmdApi.NoteEnum || calculator._spellerInstalled) return;
    calculator.transposePitch = (pitch, key, halftones) => {
      try {
        return _transposePitch(osmdApi, pitch, key, halftones);
      } catch (err) {
        console.warn('[OsmdTransposeSpeller] dùng cách ghi nốt mặc định của OSMD:', err);
        return Object.getPrototypeOf(calculator).transposePitch.call(calculator, pitch, key, halftones);
      }
    };
    calculator._spellerInstalled = true;
  }

  return { install, spell };
})();

window.OsmdTransposeSpeller = OsmdTransposeSpeller;
