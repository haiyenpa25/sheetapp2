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

  const _F2M = {
    '-7':'Cb','-6':'Gb','-5':'Db','-4':'Ab','-3':'Eb','-2':'Bb','-1':'F',
    '0':'C', '1':'G', '2':'D', '3':'A', '4':'E', '5':'B', '6':'F#', '7':'C#'
  };
  const _F2m = {
    '-7':'Abm','-6':'Ebm','-5':'Bbm','-4':'Fm','-3':'Cm','-2':'Gm','-1':'Dm',
    '0':'Am', '1':'Em', '2':'Bm', '3':'F#m', '4':'C#m', '5':'G#m', '6':'D#m', '7':'A#m'
  };

  const DIATONIC_MAJOR = {
    'C':  ['C', 'Dm', 'Em', 'F', 'G', 'Am', 'Bdim'],
    'G':  ['G', 'Am', 'Bm', 'C', 'D', 'Em', 'F#dim'],
    'D':  ['D', 'Em', 'F#m', 'G', 'A', 'Bm', 'C#dim'],
    'A':  ['A', 'Bm', 'C#m', 'D', 'E', 'F#m', 'G#dim'],
    'E':  ['E', 'F#m', 'G#m', 'A', 'B', 'C#m', 'D#dim'],
    'B':  ['B', 'C#m', 'D#m', 'E', 'F#', 'G#m', 'A#dim'],
    'F#': ['F#', 'G#m', 'A#m', 'B', 'C#', 'D#m', 'E#dim'],
    'F':  ['F', 'Gm', 'Am', 'Bb', 'C', 'Dm', 'Edim'],
    'Bb': ['Bb', 'Cm', 'Dm', 'Eb', 'F', 'Gm', 'Adim'],
    'Eb': ['Eb', 'Fm', 'Gm', 'Ab', 'Bb', 'Cm', 'Ddim'],
    'Ab': ['Ab', 'Bbm', 'Cm', 'Db', 'Eb', 'Fm', 'Gdim'],
    'Db': ['Db', 'Ebm', 'Fm', 'Gb', 'Ab', 'Bbm', 'Cdim'],
    'Gb': ['Gb', 'Abm', 'Bbm', 'Cb', 'Db', 'Ebm', 'Fdim']
  };

  const DIATONIC_MINOR = {
    'Am':  ['Am', 'Bdim', 'C', 'Dm', 'Em', 'F', 'G'],
    'Em':  ['Em', 'F#dim', 'G', 'Am', 'Bm', 'C', 'D'],
    'Bm':  ['Bm', 'C#dim', 'D', 'Em', 'F#m', 'G', 'A'],
    'F#m': ['F#m', 'G#dim', 'A', 'Bm', 'C#m', 'D', 'E'],
    'C#m': ['C#m', 'D#dim', 'E', 'F#m', 'G#m', 'A', 'B'],
    'G#m': ['G#m', 'A#dim', 'B', 'C#m', 'D#m', 'E', 'F#'],
    'Dm':  ['Dm', 'Edim', 'F', 'Gm', 'Am', 'Bb', 'C'],
    'Gm':  ['Gm', 'Adim', 'Bb', 'Cm', 'Dm', 'Eb', 'F'],
    'Cm':  ['Cm', 'Ddim', 'Eb', 'Fm', 'Gm', 'Ab', 'Bb'],
    'Fm':  ['Fm', 'Gdim', 'Ab', 'Bbm', 'Cm', 'Db', 'Eb'],
    'Bbm': ['Bbm', 'Cdim', 'Db', 'Ebm', 'Fm', 'Gb', 'Ab'],
    'Ebm': ['Ebm', 'Fdim', 'Gb', 'Abm', 'Bbm', 'Cb', 'Db']
  };

  const SCALE_NOTES_MAJOR = {
    'C':  ['C', 'D', 'E', 'F', 'G', 'A', 'B'],
    'G':  ['G', 'A', 'B', 'C', 'D', 'E', 'F#'],
    'D':  ['D', 'E', 'F#', 'G', 'A', 'B', 'C#'],
    'A':  ['A', 'B', 'C#', 'D', 'E', 'F#', 'G#'],
    'E':  ['E', 'F#', 'G#', 'A', 'B', 'C#', 'D#'],
    'B':  ['B', 'C#', 'D#', 'E', 'F#', 'G#', 'A#'],
    'F#': ['F#', 'G#', 'A#', 'B', 'C#', 'D#', 'E#'],
    'F':  ['F', 'G', 'A', 'Bb', 'C', 'D', 'E'],
    'Bb': ['Bb', 'C', 'D', 'Eb', 'F', 'G', 'A'],
    'Eb': ['Eb', 'F', 'G', 'Ab', 'Bb', 'C', 'D'],
    'Ab': ['Ab', 'Bb', 'C', 'Db', 'Eb', 'F', 'G'],
    'Db': ['Db', 'Eb', 'F', 'Gb', 'Ab', 'Bb', 'C'],
    'Gb': ['Gb', 'Ab', 'Bb', 'Cb', 'Db', 'Eb', 'F']
  };

  /**
   * Đọc <fifths> từ XML — nguồn duy nhất, đáng tin cậy nhất.
   */
  function getKeyFifths() {
    try {
      const xml = window.OSMDRenderer?.getCurrentXml?.() || window.App?.getOriginalXml?.();
      if (!xml) return null;
      const doc = window.XmlDocCache?.getDoc(xml) || new DOMParser().parseFromString(xml, 'text/xml');
      const fifths = parseInt(doc.querySelector('key > fifths')?.textContent ?? 'NaN');

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

  function fifthsToUseFlats(f) { return f < 0; }

  const _SEMITONE_FIFTHS_OFFSET = [0, -5, 2, -3, 4, -1, 6, 1, -4, 3, -2, 5];

  function calcTransposedFifths(origFifths, semitones) {
    const norm = ((semitones % 12) + 12) % 12;
    let newF = origFifths + _SEMITONE_FIFTHS_OFFSET[norm];
    while (newF > 6) newF -= 12;
    while (newF < -6) newF += 12;
    return newF;
  }

  function getKeyUseFlats() {
    if (_songUseFlats !== null) return _songUseFlats;
    const fifths = getKeyFifths();
    if (fifths === null) return false;
    _songUseFlats = fifthsToUseFlats(fifths);
    return _songUseFlats;
  }

  function getTransposedKeyUseFlats(semitones) {
    const orig = getKeyFifths() ?? 0;
    return fifthsToUseFlats(calcTransposedFifths(orig, semitones));
  }

  function applyTranspose(chordMap) {
    const semitones = window.App?.getCurrentTranspose?.() ?? 0;
    const capo = window.Store?.get?.('capoLevel') ?? 0;
    const effectiveShift = semitones - capo;
    if (effectiveShift === 0) return chordMap;
    const useFlats = getTransposedKeyUseFlats(effectiveShift);
    const out = {};
    for (const [k, chord] of Object.entries(chordMap)) {
      out[k] = TransposeEngine.transposeChord(chord, effectiveShift, useFlats);
    }
    return out;
  }

  /**
   * R2-2 / B15: Nhận diện tông hiển thị hiện tại, có tính semitones đang dịch giọng.
   */
  function detectDisplayKey(xml, semitones, fallbackRoot = 'C', fallbackMode = 'major') {
    const s = typeof semitones === 'number' ? semitones : (window.App?.getCurrentTranspose?.() ?? 0);
    let origRoot = fallbackRoot;
    let mode = fallbackMode;

    try {
      const xmlStr = xml || (typeof window !== 'undefined' ? (window.OSMDRenderer?.getCurrentXml?.() || window.App?.getOriginalXml?.()) : null);
      if (xmlStr) {
        const doc = (typeof window !== 'undefined' && window.XmlDocCache)
          ? window.XmlDocCache.getDoc(xmlStr)
          : (typeof DOMParser !== 'undefined' ? new DOMParser().parseFromString(xmlStr, 'text/xml') : null);
        if (doc) {
          const k = doc.querySelector('key');
          if (k) {
            const f = String(parseInt(k.querySelector('fifths')?.textContent ?? '0', 10));
            mode = k.querySelector('mode')?.textContent?.toLowerCase() ?? 'major';
            origRoot = mode === 'minor' ? (_F2m[f] || 'Am') : (_F2M[f] || 'C');
          }
        }
      }
    } catch (e) {
      // fallback to defaults
    }

    // Làm sạch root nếu có 'm' ở mode minor
    let cleanOrig = origRoot.replace(/m$/, '');
    let displayedRoot = cleanOrig;

    if (s !== 0) {
      if (typeof window !== 'undefined' && window.KeyService?.displayKey) {
        displayedRoot = window.KeyService.displayKey(cleanOrig, s, mode === 'minor');
      } else if (globalThis.KeyService?.displayKey) {
        displayedRoot = globalThis.KeyService.displayKey(cleanOrig, s, mode === 'minor');
      } else if (typeof window !== 'undefined' && window.TransposeEngine?.calcKey) {
        displayedRoot = window.TransposeEngine.calcKey(cleanOrig, s);
      } else {
        // Basic chromatic transpose fallback
        const chromatic = ['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B'];
        let idx = chromatic.indexOf(cleanOrig);
        if (idx !== -1) displayedRoot = chromatic[((idx + s) % 12 + 12) % 12];
      }
    }

    displayedRoot = displayedRoot.replace(/m$/, '');
    const label = `${displayedRoot} ${mode === 'minor' ? 'thứ' : 'trưởng'}${s !== 0 ? ` (đang ${s > 0 ? '+' : ''}${s})` : ''}`;

    return {
      origRoot: cleanOrig,
      origMode: mode,
      displayedRoot,
      mode,
      semitones: s,
      label
    };
  }

  /**
   * 7 hợp âm thuận cho tông (Diatonic Chords)
   */
  function getDiatonicChords(root, mode = 'major') {
    const clean = String(root || 'C').replace(/m$/, '');
    if (mode === 'minor') {
      const minKey = clean + 'm';
      if (DIATONIC_MINOR[minKey]) return [...DIATONIC_MINOR[minKey]];
    }
    if (DIATONIC_MAJOR[clean]) return [...DIATONIC_MAJOR[clean]];
    return DIATONIC_MAJOR['C'];
  }

  /**
   * Hợp âm bậc 7 phổ biến (V7, Imaj7, ii7, IVmaj7, vi7)
   */
  function getSeventhChords(root, mode = 'major') {
    const clean = String(root || 'C').replace(/m$/, '');
    const scale = SCALE_NOTES_MAJOR[clean] || SCALE_NOTES_MAJOR['C'];
    const diatonic = getDiatonicChords(clean, mode);
    // V7 là hợp âm 7 quan trọng nhất trong Thánh Ca / ban nhạc
    const v7 = scale[4] + '7';
    const imaj7 = clean + 'maj7';
    const ii7 = scale[1] + 'm7';
    const ivmaj7 = scale[3] + 'maj7';
    const vi7 = scale[5] + 'm7';
    return [v7, imaj7, ii7, ivmaj7, vi7];
  }

  /**
   * Hợp âm phụ phổ biến (V7, I/3, IVsus4, IV/6)
   */
  function getSecondaryChords(root, mode = 'major') {
    const clean = String(root || 'C').replace(/m$/, '');
    const scale = SCALE_NOTES_MAJOR[clean] || SCALE_NOTES_MAJOR['C'];
    const v7 = scale[4] + '7';
    const slashI3 = clean + '/' + scale[2];
    const sus4 = scale[3] + 'sus4';
    const slashIV6 = scale[3] + '/' + scale[5];
    return [v7, slashI3, sus4, slashIV6];
  }

  /**
   * Giải nốt bass cho hợp âm đảo: '/ + số' (1–7)
   */
  function resolveSlashBass(chord, degreeOrNumber, currentKeyRoot = 'C', mode = 'major') {
    if (!chord) return chord;
    const cleanKey = String(currentKeyRoot || 'C').replace(/m$/, '');
    const scale = SCALE_NOTES_MAJOR[cleanKey] || SCALE_NOTES_MAJOR['C'];
    const deg = parseInt(degreeOrNumber, 10);
    if (isNaN(deg) || deg < 1 || deg > 7) return chord;
    const bass = scale[deg - 1];
    const mainChord = chord.split('/')[0];
    return `${mainChord}/${bass}`;
  }

  return {
    resetCache,
    getKeyFifths,
    fifthsToUseFlats,
    calcTransposedFifths,
    getKeyUseFlats,
    getTransposedKeyUseFlats,
    applyTranspose,
    detectDisplayKey,
    getDiatonicChords,
    getSeventhChords,
    getSecondaryChords,
    resolveSlashBass,
    DIATONIC_MAJOR,
    DIATONIC_MINOR,
    SCALE_NOTES_MAJOR
  };
})();

if (typeof window !== 'undefined') {
  window.ChordCanvasTranspose = ChordCanvasTranspose;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ChordCanvasTranspose;
}
