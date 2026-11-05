/**
 * live-band/js/stage-score-transpose.js
 * Dịch giọng THẬT cho bản nhạc trên sân khấu (nốt + hợp âm cùng đổi), gồm độ lệch theo nhạc cụ chuyển giọng.
 * Trước đây đổi tông ở Band chỉ đổi nhãn "Tông: …" và HUD, bản nhạc vẫn giữ nguyên.
 *
 * Nhạc cụ chuyển giọng đọc nốt VIẾT cao hơn nốt THỰC: Trumpet/Clarinet Bb +2, Sax Alto Eb +9, Horn F +7 (nửa cung).
 * Độ lệch này chỉ áp dụng trên máy của người đó, không phát lên phòng.
 *
 * Phụ thuộc: opensheetmusicdisplay (TransposeCalculator), OsmdTransposeSpeller (tùy chọn). Public API: { roleOffset, prepare, reapply }
 */
const StageScoreTranspose = (() => {
  'use strict';

  const ROLE_OFFSETS = { trumpet: 2, altosax: 9, horn: 7 };
  const MIN_SEMITONES = -24;
  const MAX_SEMITONES = 24;

  let _applied = 0;

  function roleOffset(role) {
    return ROLE_OFFSETS[role] || 0;
  }

  function _clamp(n) {
    return Math.max(MIN_SEMITONES, Math.min(MAX_SEMITONES, Math.round(n) || 0));
  }

  function _ensureCalculator(osmd) {
    if (osmd.TransposeCalculator) return;
    osmd.TransposeCalculator = new opensheetmusicdisplay.TransposeCalculator();
    window.OsmdTransposeSpeller?.install?.(osmd.TransposeCalculator);
  }

  /** Gán dịch giọng lên Sheet đã load (chưa render). OSMD cần updateGraphic() để nốt và chữ hợp âm cùng đổi. */
  function prepare(osmd, semitones) {
    const n = _clamp(semitones);
    _applied = 0; // load() mới dựng lại Sheet ở nguyên bản
    if (!osmd?.Sheet || !window.opensheetmusicdisplay?.TransposeCalculator || n === 0) return false;
    _ensureCalculator(osmd);
    osmd.Sheet.Transpose = n;
    osmd.updateGraphic?.();
    _applied = n;
    return true;
  }

  /** Đổi dịch giọng khi bài đã hiển thị: gán lại, vẽ lại, rồi gọi onDone (vd. tính lại vị trí ô nhịp). */
  function reapply(osmd, semitones, onDone) {
    const n = _clamp(semitones);
    if (!osmd?.Sheet || n === _applied) return false;
    if (!window.opensheetmusicdisplay?.TransposeCalculator) return false;
    _ensureCalculator(osmd);
    osmd.Sheet.Transpose = n;
    osmd.updateGraphic?.();
    osmd.render();
    _applied = n;
    if (typeof onDone === 'function') onDone();
    return true;
  }

  /** Dịch giọng hiển thị = tông chung của ban nhạc + độ lệch của nhạc cụ. */
  function effective(concertTranspose, role) {
    return concertTranspose + roleOffset(role);
  }

  return { roleOffset, effective, prepare, reapply };
})();

window.StageScoreTranspose = StageScoreTranspose;
