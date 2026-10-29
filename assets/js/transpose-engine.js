/**
 * transpose-engine.js
 * Lõi MusicXML Transposition được tiếp sức bởi Tonal.js
 */
const TransposeEngine = (() => {
  'use strict';

  // Ánh xạ 12 nốt Chromatic (để dự phòng và đồng bộ hoá enharmonic)
  const NOTES_SHARP = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  const NOTES_FLAT  = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];

  // Interval map cho 12 semitones
  const SEMITONE_TO_INTERVAL = {
    0: '1P', 1: '2m', 2: '2M', 3: '3m', 4: '3M', 5: '4P', 6: '4A',
    7: '5P', 8: '6m', 9: '6M', 10: '7m', 11: '7M', 12: '8P'
  };

  function getInterval(semitones) {
      const dir = semitones < 0 ? '-' : '';
      const abs = Math.abs(semitones) % 12;
      return dir + SEMITONE_TO_INTERVAL[abs];
  }

  function _getTonal() {
    return (typeof window !== 'undefined' && window.Tonal) ? window.Tonal : ((typeof global !== 'undefined' && global.Tonal) ? global.Tonal : null);
  }

  function _isMinorOrDimSuffix(suffix) {
      return /^(m(?!aj)|min|dim|ø|°|-)/i.test(suffix || '');
  }

  function _noteChroma(noteName) {
      if (!noteName) return -1;
      const clean = noteName.charAt(0).toUpperCase() + (noteName.charAt(1) || '');
      let idx = NOTES_SHARP.indexOf(clean);
      if (idx !== -1) return idx;
      idx = NOTES_FLAT.indexOf(clean);
      if (idx !== -1) return idx;
      const enh = { 'Cb': 11, 'B#': 0, 'Fb': 4, 'E#': 5 };
      return enh[clean] ?? -1;
  }

  function _resolveRootSpell(chroma, isMinorOrDim, useFlats, origRoot = '') {
      const c = ((chroma % 12) + 12) % 12;
      const origHasFlat = origRoot.includes('b') || origRoot === 'F';
      const origHasSharp = origRoot.includes('#');
      if (!isMinorOrDim) {
          if (c === 3) return 'Eb';
          if (c === 8) return 'Ab';
          if (c === 10) return 'Bb';
          if (c === 1) {
              if (useFlats === true) return 'Db';
              if (useFlats === false) return 'C#';
              return origHasFlat ? 'Db' : (['D', 'B'].includes(origRoot) ? 'C#' : 'Db');
          }
          if (c === 6) {
              if (useFlats === true) return 'Gb';
              if (useFlats === false) return 'F#';
              return origHasFlat ? 'Gb' : 'F#';
          }
          return NOTES_FLAT[c];
      } else {
          if (c === 1) return (useFlats === true && origHasFlat) ? 'Db' : 'C#';
          if (c === 3) return (useFlats === true || (useFlats === null && origHasFlat)) ? 'Eb' : 'D#';
          if (c === 6) return (useFlats === true && origHasFlat) ? 'Gb' : 'F#';
          if (c === 8) return (useFlats === true || (useFlats === null && origHasFlat)) ? 'Ab' : 'G#';
          if (c === 10) return (useFlats === false || (useFlats === null && origHasSharp)) ? 'A#' : 'Bb';
          return NOTES_FLAT[c];
      }
  }

  function _resolveBassSpell(bassChroma, newRoot, isMinorOrDim, useFlats) {
      const c = ((bassChroma % 12) + 12) % 12;
      if (newRoot.includes('b') || newRoot === 'F' || (isMinorOrDim && ['C', 'F', 'G', 'D', 'Bb', 'Eb', 'Ab'].includes(newRoot))) {
          return NOTES_FLAT[c];
      }
      if (newRoot.includes('#') || (!isMinorOrDim && ['G', 'D', 'A', 'E', 'B'].includes(newRoot)) || (isMinorOrDim && ['E', 'B'].includes(newRoot))) {
          return NOTES_SHARP[c];
      }
      if (useFlats === true) return NOTES_FLAT[c];
      if (useFlats === false) return NOTES_SHARP[c];
      return (c === 3 || c === 8 || c === 10) ? NOTES_FLAT[c] : NOTES_SHARP[c];
  }

  // Ép định dạng 1 nốt sang thăng/giáng dựa trên target config
  function forceEnharmonic(noteName, useFlats, isMinorOrDim = false, origRoot = '') {
      const tonal = _getTonal();
      let chroma = -1;
      if (tonal) {
          const tNote = tonal.Note.get(noteName);
          if (!tNote.empty && typeof tNote.chroma === 'number') chroma = tNote.chroma;
      }
      if (chroma === -1) chroma = _noteChroma(noteName);
      if (chroma === -1) return noteName;
      return _resolveRootSpell(chroma, isMinorOrDim, useFlats, origRoot);
  }

  /**
   * Auto-detect xem hợp âm/nốt có dùng b (giáng) không.
   * Quy tắc: nếu root chứa 'b' (Bb, Eb, Ab...) → useFlats = true.
   * Điều này đảm bảo "Bb" không bao giờ bị đổi thành "A#".
   */
  function _hasFlat(chordName) {
      if (!chordName) return false;
      // Match root (1-2 chars): A-G kèm b hoặc #
      const root = chordName.match(/^[A-G]([#b])/)?.[1];
      return root === 'b';
  }

  /**
   * Transpose thủ công (không cần Tonal.js) — dùng bảng chromatic nội bộ.
   * Xử lý: chords đơn (Am, D7), slash chords (C/E), enharmonics (#/b) chuẩn Thánh Ca.
   */
  function _manualTranspose(chordName, semitones, useFlats = null) {
      if (!chordName) return chordName;
      const m = chordName.match(/^([A-G][#b]?)([^\/]*)(\/([A-G][#b]?))?$/);
      if (!m) return chordName;
      const root    = m[1];
      const suffix  = m[2] || '';
      const bass    = m[4] || null;
      const idx     = _noteChroma(root);
      if (idx === -1) return chordName;
      const isMinorOrDim = _isMinorOrDimSuffix(suffix);
      const newChroma = ((idx + semitones) % 12 + 12) % 12;
      const newRoot = _resolveRootSpell(newChroma, isMinorOrDim, useFlats, root);
      let result = newRoot + suffix;
      if (bass) {
          const bi = _noteChroma(bass);
          const newBass = bi !== -1 ? _resolveBassSpell(((bi + semitones) % 12 + 12) % 12, newRoot, isMinorOrDim, useFlats) : bass;
          result += '/' + newBass;
      }
      return result;
  }

  function transposeChord(chordName, semitones, useFlats = null) {
      if (!chordName || semitones === 0) return chordName;

      const origRoot = chordName.match(/^([A-G][#b]?)/)?.[1] || '';
      // Nếu Tonal không load được → dùng fallback nội bộ
      const tonal = _getTonal();
      if (!tonal) {
          return _manualTranspose(chordName, semitones, useFlats);
      }

      try {
          const interv = getInterval(semitones);
          let tr = tonal.Chord.transpose(chordName, interv);

          const parts = tr.split('/');
          let rootNote = parts[0].match(/^[A-G][#b]*/)?.[0];
          if (!rootNote) return _manualTranspose(chordName, semitones, useFlats);
          let suffix = parts[0].substring(rootNote.length);
          const isMinorOrDim = _isMinorOrDimSuffix(suffix);

          let forcedRoot = forceEnharmonic(rootNote, useFlats, isMinorOrDim, origRoot);
          let res = forcedRoot + suffix;
          if (parts.length > 1) {
             const bNote = tonal.Note.get(parts[1]);
             const bChroma = (!bNote.empty && typeof bNote.chroma === 'number') ? bNote.chroma : _noteChroma(parts[1]);
             res += '/' + (bChroma !== -1 ? _resolveBassSpell(bChroma, forcedRoot, isMinorOrDim, useFlats) : forceEnharmonic(parts[1], useFlats, false, origRoot));
          }
          return res;
      } catch (e) {
          console.warn('[TransposeEngine] Tonal lỗi, dùng fallback:', e.message);
          return _manualTranspose(chordName, semitones, useFlats);
      }
  }

  /**
   * Tính toán điệu tính mới (Fifths)
   * (Đã bị vô hiệu hoá - Nhường quyền Transpose trực tiếp cho OSMD Native)
   */
  function transposeXML(xmlString, semitones) {
    // OSMD Native TransposeCalculator sẽ lo liệu tất cả (nốt nhạc + hợp âm)
    return xmlString;
  }

  // ==========================================
  // CAPO AI CALCULATOR
  // ==========================================
  const OPEN_CHORDS = ['C', 'G', 'D', 'A', 'E', 'Am', 'Em', 'Dm'];

  function scoreCapoPos(chordList, capoFret) {
      let score = 0;
      chordList.forEach(c => {
          // Khi kẹp Capo ở ngăn 2 (D -> C) thì hợp âm giảm 2 semitones
          const tr = transposeChord(c, -capoFret, false); 
          const parts = tr.split('/');
          const rootAndQuality = parts[0].replace(/maj|min|dim|aug|sus|add|\d.*/g, '');
          const isStandardOpen = OPEN_CHORDS.includes(rootAndQuality) || OPEN_CHORDS.includes(parts[0]);
          if (isStandardOpen) {
              score += 1.0;
          } else if (parts[0].length <= 2) {
              score += 0.3; // Hợp âm ngắn (không phải hợp âm chặn phức tạp)
          }
      });
      return score;
  }

  function suggestBestCapo(chordList) {
      if (!chordList || chordList.length === 0) return 0;
      let bestCapo = 0;
      let maxScore = -1;
      
      // Khảo sát 12 ngăn capo
      for (let capo = 0; capo < 12; capo++) {
          const s = scoreCapoPos(chordList, capo);
          // Ưu tiên capo ngăn thấp (để đễ đàn) bằng cách trừ nhẹ điểm theo số ngăn
          const weightedScore = s - (capo * 0.05); 
          
          if (weightedScore > maxScore) {
              maxScore = weightedScore;
              bestCapo = capo;
          }
      }
      return bestCapo;
  }

  // Helpers
  function extractChordsFromXML(xmlString) {
      if (!xmlString) return [];
      const doc = window.XmlDocCache?.getDoc(xmlString) || new DOMParser().parseFromString(xmlString, 'text/xml');
      const chords = [];
      doc.querySelectorAll('harmony').forEach(h => {
          const r = h.querySelector('root > root-step');
          if (!r) return;
          let name = r.textContent.trim();
          const a = h.querySelector('root > root-alter');
          const alt = a ? parseFloat(a.textContent) : 0;
          if (alt === 1) name += '#';
          if (alt === -1) name += 'b';
          chords.push(name);
      });
      // Loại bỏ trùng lặp để giảm tính toán
      return [...new Set(chords)];
  }

  function _createEl(doc, tag, text) {
      const el = doc.createElement(tag);
      el.textContent = text;
      return el;
  }
  function _createAndAppend(doc, parent, tagName, text) {
    const el = _createEl(doc, tagName, text);
    parent.appendChild(el);
    return el;
  }

  function _semitoneToFifths(currentFifths, semitones) {
    const keyFifths = [0,  1, 2, 3, 4, 5,  6,-5,-4,-3,-2,-1];
    let curIdx = keyFifths.indexOf(_normF(currentFifths));
    if (curIdx === -1) return currentFifths + Math.round(semitones * 7 / 12);
    const newIdx = ((curIdx + semitones) % 12 + 12) % 12;
    return keyFifths[newIdx];
  }

  function _normF(f) {
    while (f > 6)  f -= 12;
    while (f < -6) f += 12;
    return f;
  }

  function _chromaticToDiatonic(semitones) {
    const steps = [0,1,1,2,2,3,3,4,5,5,6,6,7];
    const abs = Math.abs(semitones) % 12;
    return Math.sign(semitones) * steps[abs];
  }

  function calcKey(origKey, semitones) {
    if (!origKey) return '';
    const trimmed = String(origKey).trim();
    if (!trimmed) return '';
    if (window.KeyService?.displayKey) {
      return window.KeyService.displayKey(trimmed, semitones);
    }
    if (!semitones || semitones === 0) return trimmed;
    try {
      const res = transposeChord(trimmed, semitones);
      if (res) return res;
    } catch (e) {}

    const m = trimmed.match(/^([A-G][#b]?)(.*)$/);
    if (!m) return trimmed;
    const root = m[1];
    const suffix = m[2] || '';
    const useFlats = trimmed.includes('b') || ['F', 'Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm'].includes(trimmed);
    const arr = useFlats ? NOTES_FLAT : NOTES_SHARP;
    let idx = NOTES_SHARP.indexOf(root);
    if (idx === -1) idx = NOTES_FLAT.indexOf(root);
    if (idx === -1) return trimmed;
    const newRoot = arr[((idx + semitones) % 12 + 12) % 12];
    return newRoot + suffix;
  }

  return { transposeChord, calcKey, transposeXML, suggestBestCapo, extractChordsFromXML, NOTES_SHARP, NOTES_FLAT };
})();

if (typeof window !== 'undefined') {
  window.TransposeEngine = TransposeEngine;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TransposeEngine;
}
