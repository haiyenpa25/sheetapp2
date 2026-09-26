/**
 * assets/js/learn/practice/chord-judge.js — Stage 9: Intelligent Chord Matcher & Judge
 *
 * Thuật toán phân tích và so khớp hợp âm giữa:
 * - Hợp âm mục tiêu của bài hát (targetChord e.g. "G", "Em7", "C/E")
 * - Danh sách nốt thực tế người học đang nhấn (từ MIDI hoặc Virtual Keyboard)
 *
 * Hỗ trợ:
 * - Mọi thể đảo (Root position, 1st inversion, 2nd inversion, 3rd inversion)
 * - Nhạc lý Pop/Worship: cho phép trùng quãng 8, không bắt buộc thứ tự tay
 * - Nhận diện nốt Bass nếu là hợp âm đảo (Slash chord e.g. D/F#)
 *
 * Expose: window.ChordJudge
 */
const ChordJudge = (() => {
  'use strict';

  const NOTE_TO_PITCH_CLASS = {
    'C': 0, 'B#': 0,
    'C#': 1, 'DB': 1,
    'D': 2,
    'D#': 3, 'EB': 3,
    'E': 4, 'FB': 4,
    'F': 5, 'E#': 5,
    'F#': 6, 'GB': 6,
    'G': 7,
    'G#': 8, 'AB': 8,
    'A': 9,
    'A#': 10, 'BB': 10,
    'B': 11, 'CB': 11
  };

  /**
   * Phân tích ký hiệu hợp âm thành tập hợp các Pitch Classes (0-11)
   * @param {string} chordSymbol
   * @returns {{ pitchClasses: Set<number>, bassPitchClass: number|null, notes: string[] }}
   */
  function parseChord(chordSymbol) {
    if (!chordSymbol) return { pitchClasses: new Set(), bassPitchClass: null, notes: [] };

    // Tận dụng Tonal nếu có
    if (window.Tonal && Tonal.Chord) {
      try {
        const chordInfo = Tonal.Chord.get(chordSymbol);
        if (chordInfo && chordInfo.notes && chordInfo.notes.length > 0) {
          const pcs = new Set();
          chordInfo.notes.forEach(n => {
            const pc = Tonal.Note.chroma(n);
            if (pc !== null && pc !== undefined) pcs.add(pc);
          });

          // Check slash bass
          let bassPc = null;
          if (chordSymbol.includes('/')) {
            const parts = chordSymbol.split('/');
            bassPc = Tonal.Note.chroma(parts[1]);
            if (bassPc !== null && bassPc !== undefined) pcs.add(bassPc);
          }

          return { pitchClasses: pcs, bassPitchClass: bassPc, notes: chordInfo.notes };
        }
      } catch (e) {}
    }

    // Fallback parser độc lập
    let bass = null;
    let base = chordSymbol.trim();
    if (base.includes('/')) {
      const parts = base.split('/');
      base = parts[0];
      bass = parts[1].toUpperCase();
    }

    // Tách Root và Quality
    const match = base.match(/^([A-Ga-g][#b]?)(.*)$/);
    if (!match) return { pitchClasses: new Set(), bassPitchClass: null, notes: [] };

    const rootName = match[1].toUpperCase();
    const quality = match[2].toLowerCase();
    const rootPc = NOTE_TO_PITCH_CLASS[rootName] ?? 0;

    let intervals = [0, 4, 7]; // Major triad default
    if (quality === 'm' || quality === 'min' || quality.startsWith('m-') || quality === 'm7') {
      intervals = [0, 3, 7];
    } else if (quality === 'dim') {
      intervals = [0, 3, 6];
    } else if (quality === 'aug' || quality === '+') {
      intervals = [0, 4, 8];
    } else if (quality === 'sus4') {
      intervals = [0, 5, 7];
    } else if (quality === 'sus2') {
      intervals = [0, 2, 7];
    }

    if (quality.includes('7')) {
      if (quality.includes('maj7') || quality.includes('m7+')) intervals.push(11);
      else if (quality.includes('dim7')) intervals.push(9);
      else intervals.push(10); // Dominant / minor 7th
    }

    const pcs = new Set();
    intervals.forEach(intv => pcs.add((rootPc + intv) % 12));

    let bassPc = null;
    if (bass && NOTE_TO_PITCH_CLASS[bass] !== undefined) {
      bassPc = NOTE_TO_PITCH_CLASS[bass];
      pcs.add(bassPc);
    }

    return { pitchClasses: pcs, bassPitchClass: bassPc, notes: [] };
  }

  /**
   * So sánh nốt người học chơi với hợp âm đích
   * @param {string} targetChord - Ví dụ: "G", "Cadd9", "D/F#"
   * @param {number[]} activeMidiNotes - Mảng các số MIDI người dùng đang bấm e.g. [43, 59, 62, 67]
   * @returns {{ match: 'exact'|'partial'|'none', score: number, matchedCount: number, requiredCount: number }}
   */
  function judge(targetChord, activeMidiNotes) {
    if (!targetChord) return { match: 'none', score: 0, matchedCount: 0, requiredCount: 0 };
    if (!activeMidiNotes || activeMidiNotes.length === 0) {
      return { match: 'none', score: 0, matchedCount: 0, requiredCount: 0 };
    }

    const { pitchClasses: targetPcs, bassPitchClass } = parseChord(targetChord);
    if (targetPcs.size === 0) return { match: 'none', score: 0, matchedCount: 0, requiredCount: 0 };

    // Lấy tập hợp pitch class của các nốt người dùng đang bấm
    const playedPcs = new Set();
    activeMidiNotes.forEach(midi => playedPcs.add(midi % 12));

    // Đếm số nốt trúng
    let matchedCount = 0;
    targetPcs.forEach(pc => {
      if (playedPcs.has(pc)) matchedCount++;
    });

    const requiredCount = targetPcs.size;
    const score = matchedCount / requiredCount;

    // Nếu người dùng bấm đủ tất cả nốt trong hợp âm
    if (matchedCount >= requiredCount) {
      // Nếu có nốt Bass riêng (slash chord)
      if (bassPitchClass !== null) {
        // Tìm nốt thấp nhất trong số activeMidiNotes
        const lowestMidi = Math.min(...activeMidiNotes);
        if (lowestMidi % 12 !== bassPitchClass) {
          // Bấm đúng các nốt nhưng nốt Bass không nằm ở đáy -> partial
          return { match: 'partial', score: 0.85, matchedCount, requiredCount };
        }
      }
      return { match: 'exact', score: 1.0, matchedCount, requiredCount };
    }

    // Nếu bấm được ít nhất 2 nốt hợp âm (ví dụ 2/3 nốt của Triad)
    if (matchedCount >= 2 && matchedCount >= requiredCount - 1) {
      return { match: 'partial', score, matchedCount, requiredCount };
    }

    return { match: 'none', score, matchedCount, requiredCount };
  }

  return {
    parseChord,
    judge
  };
})();

if (typeof window !== 'undefined') {
  window.ChordJudge = ChordJudge;
}
