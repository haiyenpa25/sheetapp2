/**
 * chord-canvas-transpose.js — Accidental & Fifths Transposition Engine for ChordCanvas
 * Part of SheetApp Sheet Reader
 */
const ChordCanvasTranspose = (() => {
  'use strict';

  let _songUseFlats = null;

  function resetCache() {
    _songUseFlats = null;
  }

  /**
   * Đọc <fifths> từ XML — nguồn duy nhất, đáng tin cậy nhất.
   * Fallback: quét harmony chords nếu XML không có key signature.
   */
  function getKeyFifths() {
    try {
      const xml = window.OSMDRenderer?.getCurrentXml?.() || window.App?.getOriginalXml?.();
      if (!xml) return null; // null = XML chưa sẵn, KHÔNG cache
      const doc    = new DOMParser().parseFromString(xml, 'text/xml');
      const fifths = parseInt(doc.querySelector('key > fifths')?.textContent ?? 'NaN');

      // Đếm flat/sharp trong harmony để cross-check
      let flat = 0, sharp = 0;
      doc.querySelectorAll('harmony').forEach(h => {
        const ra = parseFloat(h.querySelector('root > root-alter')?.textContent || '0');
        const ba = parseFloat(h.querySelector('bass > bass-alter')?.textContent || '0');
        if (ra < 0) flat++; else if (ra > 0) sharp++;
        if (ba < 0) flat++; else if (ba > 0) sharp++;
      });

      if (!isNaN(fifths)) {
        if (fifths === 0 && flat > 0 && flat > sharp) return -1;
        return fifths;
      }

      return flat > sharp ? -1 : (sharp > flat ? 1 : 0);
    } catch { return null; }
  }

  /** fifths < 0 → flat, ngược lại → sharp */
  function fifthsToUseFlats(f) { return f < 0; }

  const _SEMITONE_FIFTHS_OFFSET = [0, -5, 2, -3, 4, -1, 6, 1, -4, 3, -2, 5];

  function calcTransposedFifths(origFifths, semitones) {
    const norm = ((semitones % 12) + 12) % 12;
    let newF = origFifths + _SEMITONE_FIFTHS_OFFSET[norm];
    while (newF > 6) newF -= 12;
    while (newF < -6) newF += 12;
    return newF;
  }

  /**
   * Lấy flat/sharp preference của KEY GỐC.
   */
  function getKeyUseFlats() {
    if (_songUseFlats !== null) return _songUseFlats;
    const fifths = getKeyFifths();
    if (fifths === null) return false;
    _songUseFlats = fifthsToUseFlats(fifths);
    return _songUseFlats;
  }

  /**
   * Lấy flat/sharp preference của KEY SAU KHI transpose.
   */
  function getTransposedKeyUseFlats(semitones) {
    const orig = getKeyFifths() ?? 0;
    return fifthsToUseFlats(calcTransposedFifths(orig, semitones));
  }

  function applyTranspose(chordMap) {
    const semitones = window.App?.getCurrentTranspose?.() ?? 0;
    if (semitones === 0) return chordMap;
    const useFlats = getTransposedKeyUseFlats(semitones);
    const out = {};
    for (const [k, chord] of Object.entries(chordMap)) {
      out[k] = TransposeEngine.transposeChord(chord, semitones, useFlats);
    }
    return out;
  }

  return {
    resetCache,
    getKeyFifths,
    fifthsToUseFlats,
    calcTransposedFifths,
    getKeyUseFlats,
    getTransposedKeyUseFlats,
    applyTranspose
  };
})();

if (typeof window !== 'undefined') {
  window.ChordCanvasTranspose = ChordCanvasTranspose;
}
