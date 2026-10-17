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

  // Ép định dạng 1 nốt sang thăng/giáng dựa trên target config
  function forceEnharmonic(noteName, useFlats) {
      if (!window.Tonal) return noteName;
      const tNote = window.Tonal.Note.get(noteName);
      if (tNote.empty) return noteName;
      
      const chroma = tNote.chroma;
      return useFlats ? NOTES_FLAT[chroma] : NOTES_SHARP[chroma];
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
   * Dịch giọng một hợp âm hoàn chỉnh (có tính cả bass notes như Cmaj7/G).
   */
  /**
   * Transpose thủ công (không cần Tonal.js) — dùng bảng chromatic nội bộ.
   * Xử lý: chords đơn (Am, D7), slash chords (C/E), enharmonics (#/b).
   */
  function _manualTranspose(chordName, semitones, useFlats = null) {
      if (!chordName) return chordName;
      const m = chordName.match(/^([A-G][#b]?)([^\/]*)(\/([A-G][#b]?))?$/);
      if (!m) return chordName;
      const root    = m[1];
      const suffix  = m[2] || '';
      const bass    = m[4] || null;
      // Auto-detect nếu không truyền — giữ nguyên flat preference của user
      if (useFlats === null) useFlats = _hasFlat(chordName);
      const arr     = useFlats ? NOTES_FLAT : NOTES_SHARP;
      let idx = NOTES_SHARP.indexOf(root);
      if (idx === -1) idx = NOTES_FLAT.indexOf(root);
      if (idx === -1) return chordName;
      const newRoot = arr[((idx + semitones) % 12 + 12) % 12];
      let result = newRoot + suffix;
      if (bass) {
          let bi = NOTES_SHARP.indexOf(bass);
          if (bi === -1) bi = NOTES_FLAT.indexOf(bass);
          const newBass = bi !== -1 ? arr[((bi + semitones) % 12 + 12) % 12] : bass;
          result += '/' + newBass;
      }
      return result;
  }

  function transposeChord(chordName, semitones, useFlats = null) {
      if (!chordName || semitones === 0) return chordName;

      // AUTO-DETECT: nếu không truyền useFlats, tự detect từ input chord
      // "Bb" → useFlats=true → kết quả luôn là flat (Bb, Eb, Ab...)
      // "C#" → useFlats=false → kết quả luôn là sharp (C#, F#, G#...)
      if (useFlats === null) useFlats = _hasFlat(chordName);

      // Nếu Tonal không load được → dùng fallback nội bộ
      if (!window.Tonal) {
          return _manualTranspose(chordName, semitones, useFlats);
      }

      try {
          const interv = getInterval(semitones);
          // Tonal.Chord.transpose sẽ tự động dịch root và bass note!
          let tr = window.Tonal.Chord.transpose(chordName, interv);

          // Phân tách Root và Bass để ép enharmonic
          const parts = tr.split('/');
          let rootNote = parts[0].match(/^[A-G][#b]*/)?.[0];
          if (!rootNote) return _manualTranspose(chordName, semitones, useFlats);
          let suffix = parts[0].substring(rootNote.length);

          let forcedRoot = forceEnharmonic(rootNote, useFlats);
          let res = forcedRoot + suffix;
          if (parts.length > 1) {
             res += '/' + forceEnharmonic(parts[1], useFlats);
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
      if (!window.Tonal) return -1;
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
      if (!chordList || chordList.length === 0 || !window.Tonal) return 0;
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
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlString, 'text/xml');
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

  return { transposeChord, transposeXML, suggestBestCapo, extractChordsFromXML, NOTES_SHARP, NOTES_FLAT };
})();

window.TransposeEngine = TransposeEngine;
