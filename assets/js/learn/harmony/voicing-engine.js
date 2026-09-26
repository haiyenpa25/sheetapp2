/**
 * learn/harmony/voicing-engine.js — Stage 5: Musical Voicing & Harmony Engine
 *
 * Chuyển đổi các sự kiện mẫu đệm (PatternEvent) + Hợp âm cụ thể (ChordTimelineEvent)
 * thành các nốt nhạc vật lý chính xác (PlayableNoteEvent).
 *
 * Tính năng chính:
 * - Phân tích hợp âm qua Tonal.js (root, quality, notes)
 * - Xử lý hợp âm đảo / Slash Chords (vd: D/F#, G/B, C/E)
 * - Tự động dẫn bè mượt mà (Smooth Voice Leading / Nearest Inversion)
 * - Tính toán tần số / MIDI số / độ dài theo BPM
 *
 * Expose: window.VoicingEngine
 */
const VoicingEngine = (() => {
  'use strict';

  let _lastVoicingMidi = []; // Lưu MIDI của chord trước để tính nearest inversion

  /**
   * Lấy danh sách nốt của hợp âm không kèm octave từ Tonal.
   * @param {string} symbol
   * @returns {{ root: string, notes: string[], bass: string }}
   */
  function parseChord(symbol, slashBass = null) {
    if (!symbol || !window.Tonal) {
      return { root: 'C', notes: ['C', 'E', 'G'], bass: slashBass || 'C' };
    }

    try {
      // Tách slash nếu có
      let mainSymbol = symbol;
      let extractedBass = slashBass;
      if (symbol.includes('/')) {
        const parts = symbol.split('/');
        mainSymbol = parts[0].trim();
        if (!extractedBass) extractedBass = parts[1].trim();
      }

      const chord = Tonal.Chord.get(mainSymbol);
      const root = chord.root || 'C';
      let notes = chord.notes && chord.notes.length ? chord.notes : [root];
      const bass = extractedBass || root;

      return { root, notes, bass };
    } catch (e) {
      console.warn('[VoicingEngine] Parse chord error:', symbol, e);
      return { root: 'C', notes: ['C', 'E', 'G'], bass: 'C' };
    }
  }

  /**
   * Tạo các thế đảo (Inversions) của một tập hợp nốt
   */
  function getInversions(notes) {
    if (!notes || notes.length <= 1) return [notes || []];
    const invs = [];
    for (let i = 0; i < notes.length; i++) {
      invs.push([...notes.slice(i), ...notes.slice(0, i)]);
    }
    return invs;
  }

  /**
   * Chuyển danh sách nốt không octave thành MIDI pitches quanh một baseOctave
   */
  function notesToMidi(notes, baseOctave = 4) {
    if (!notes || !notes.length || !window.Tonal) return [];
    const midis = [];
    let currentOctave = baseOctave;
    let prevMidi = -1;

    for (let i = 0; i < notes.length; i++) {
      const noteName = notes[i];
      let midi = Tonal.Note.midi(`${noteName}${currentOctave}`);
      if (midi === null) midi = 60; // Fallback C4

      // Đảm bảo các nốt trong 1 voicing luôn tăng dần về cao độ
      while (prevMidi !== -1 && midi <= prevMidi) {
        currentOctave++;
        midi = Tonal.Note.midi(`${noteName}${currentOctave}`) ?? (prevMidi + 3);
      }

      midis.push(midi);
      prevMidi = midi;
    }
    return midis;
  }

  /**
   * Tính trọng tâm (center of gravity) của một tập nốt MIDI
   */
  function getCenterPitch(midis) {
    if (!midis.length) return 60;
    const sum = midis.reduce((a, b) => a + b, 0);
    return sum / midis.length;
  }

  /**
   * Tìm thế đảo gần nhất với thế bấm trước đó (Voice Leading / Nearest Inversion)
   */
  function pickNearestInversion(notes, baseOctave = 4, targetCenter = 65) {
    const invs = getInversions(notes);
    let bestMidis = [];
    let minDistance = Infinity;

    // Duyệt qua các thế đảo và thử ở baseOctave, baseOctave - 1, baseOctave + 1
    for (const inv of invs) {
      for (const oct of [baseOctave - 1, baseOctave, baseOctave + 1]) {
        const midis = notesToMidi(inv, oct);
        if (!midis.length) continue;
        const center = getCenterPitch(midis);
        // Trọng tâm lý tưởng cho bàn tay phải piano là khoảng F4-C5 (65-72)
        const dist = Math.abs(center - targetCenter);
        if (dist < minDistance) {
          minDistance = dist;
          bestMidis = midis;
        }
      }
    }

    return bestMidis.length ? bestMidis : notesToMidi(notes, baseOctave);
  }

  /**
   * Lấy nốt cụ thể theo bậc hợp âm (degree 1, 3, 5, 7)
   */
  function getNoteByDegree(chordNotes, degree) {
    if (!chordNotes || !chordNotes.length) return 'C';
    switch (degree) {
      case 1:
        return chordNotes[0];
      case 3:
        return chordNotes[1] || chordNotes[0];
      case 5:
        return chordNotes[2] || chordNotes[chordNotes.length - 1];
      case 7:
        return chordNotes[3] || chordNotes[chordNotes.length - 1];
      default:
        // Nếu số bậc lớn hơn số nốt hợp âm, wrap around
        const idx = (degree - 1) % chordNotes.length;
        return chordNotes[idx] || chordNotes[0];
    }
  }

  /**
   * Giải quyết 1 PatternEvent thành danh sách nốt cụ thể
   *
   * @param {Object} patternEvent - Pattern event từ lane
   * @param {Object} chordEvent - Normalized ChordTimelineEvent
   * @param {number} bpm - Nhịp độ hiện tại
   * @returns {Array<{ note: string, midi: number, velocity: number, durationSec: number }>}
   */
  function resolveEvent(patternEvent, chordEvent, bpm = 76) {
    if (!chordEvent || !chordEvent.symbol) return [];

    const symbol = chordEvent.transposedSymbol || chordEvent.symbol;
    const { root, notes, bass } = parseChord(symbol, chordEvent.bass);
    const secPerBeat = 60 / Math.max(20, bpm);
    const durationSec = (patternEvent.duration || 1) * secPerBeat;
    const velocity = (patternEvent.velocity || 70) / 127;

    const results = [];

    // TRƯỜNG HỢP 1: NỐT BASS ĐƠN LẺ
    if (patternEvent.pitch) {
      let pitchName = root;
      if (patternEvent.pitch === 'root') {
        pitchName = bass; // Ưu tiên slash bass
      } else if (patternEvent.pitch === 'fifth') {
        pitchName = getNoteByDegree(notes, 5);
      }

      const targetOctave = 2 + (patternEvent.octave || 0);
      const fullNote = `${pitchName}${targetOctave}`;
      let midi = window.Tonal ? Tonal.Note.midi(fullNote) : 36;
      if (!midi) midi = 36;

      results.push({
        note: fullNote,
        midi: midi,
        velocity: velocity,
        durationSec: durationSec
      });
      return results;
    }

    // TRƯỜNG HỢP 2: BẬC HỢP ÂM (DEGREES)
    if (patternEvent.degrees && patternEvent.degrees.length) {
      const baseOctave = 4 + (patternEvent.octave || 0);

      // Nếu chỉ có 1 nốt (vd: arpeggio từng nốt)
      if (patternEvent.degrees.length === 1) {
        const deg = patternEvent.degrees[0];
        const pitchName = getNoteByDegree(notes, deg);
        const fullNote = `${pitchName}${baseOctave}`;
        let midi = window.Tonal ? Tonal.Note.midi(fullNote) : 60;
        if (!midi) midi = 60;

        results.push({
          note: fullNote,
          midi: midi,
          velocity: velocity,
          durationSec: durationSec
        });
        return results;
      }

      // Nếu là hợp âm nhiều nốt (block chord)
      let midis = [];
      const targetCenter = _lastVoicingMidi.length ? getCenterPitch(_lastVoicingMidi) : 66;

      if (patternEvent.voicing === 'nearest') {
        midis = pickNearestInversion(notes, baseOctave, targetCenter);
        _lastVoicingMidi = midis;
      } else {
        // Root position
        midis = notesToMidi(notes, baseOctave);
        _lastVoicingMidi = midis;
      }

      for (const m of midis) {
        const noteName = window.Tonal ? Tonal.Note.fromMidi(m) : 'C4';
        results.push({
          note: noteName,
          midi: m,
          velocity: velocity,
          durationSec: durationSec
        });
      }
    }

    return results;
  }

  /**
   * Reset trạng thái voice leading khi dừng bài hoặc chuyển bài
   */
  function reset() {
    _lastVoicingMidi = [];
  }

  return {
    parseChord,
    getInversions,
    notesToMidi,
    pickNearestInversion,
    resolveEvent,
    reset
  };
})();

if (typeof window !== 'undefined') {
  window.VoicingEngine = VoicingEngine;
}
