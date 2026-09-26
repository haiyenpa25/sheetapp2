/**
 * learn/accompaniment/pattern-generator.js — Smart Adaptive Pattern Note Generator
 * Sinh nốt và đệm theo phong cách âm nhạc tự thích ứng (Voice Leading, Bass, Chords, Arpeggios, Drums).
 * 13 phong cách đệm: Ballad 4/4, Slow Rock 6/8, Boston/Waltz 3/4, Thánh Ca, Arpeggio, March, Rumba, Disco, Polka...
 * Expose: window.PatternGenerator
 */
const PatternGenerator = (() => {
  'use strict';

  /* ─── Private Helpers for Musical Playback ─── */
  function _humanizeVel(vel, amount = 0.04) {
    const delta = (Math.random() * 2 - 1) * amount;
    return Math.max(0.15, Math.min(1.0, vel + delta));
  }

  function _playBassNote(chordEvent, time, durationSec, velocity = 0.85, instrument = 'piano', octave = 2, density = 'medium') {
    if (!window.LearnSoundEngine || !chordEvent) return;
    const symbol = chordEvent.transposedSymbol || chordEvent.symbol;
    const parsed = VoicingEngine.parseChord(symbol, chordEvent.bass);
    const bassName = parsed.bass || parsed.root || 'C';
    const vel = _humanizeVel(velocity * (density === 'soft' ? 0.85 : (density === 'rich' ? 1.05 : 1.0)));
    LearnSoundEngine.triggerNote(instrument, `${bassName}${octave}`, durationSec, time, vel, 'left');
  }

  function _playAlternatingBass(chordEvent, time, durationSec, velocity = 0.75, instrument = 'piano', density = 'medium') {
    if (!window.LearnSoundEngine || !chordEvent) return;
    const symbol = chordEvent.transposedSymbol || chordEvent.symbol;
    const parsed = VoicingEngine.parseChord(symbol, chordEvent.bass);
    const fifthNote = parsed.notes && parsed.notes.length >= 3 ? parsed.notes[2] : parsed.root;
    const vel = _humanizeVel(velocity * (density === 'soft' ? 0.82 : 1.0));
    LearnSoundEngine.triggerNote(instrument, `${fifthNote}2`, durationSec, time, vel, 'left');
  }

  function _playChordVoicing(chordEvent, time, durationSec, velocity = 0.70, instrument = 'piano', targetCenter = 66, density = 'medium') {
    if (!window.LearnSoundEngine || !window.VoicingEngine || !chordEvent) return;
    const symbol = chordEvent.transposedSymbol || chordEvent.symbol;
    const parsed = VoicingEngine.parseChord(symbol, chordEvent.bass);
    let midis = VoicingEngine.pickNearestInversion(parsed.notes, 4, targetCenter);
    if (density === 'soft' && midis.length > 2) midis = [midis[0], midis[midis.length - 1]];

    const rollDelay = instrument === 'organ' ? 0 : 0.012;
    const baseVel = _humanizeVel(velocity * (density === 'soft' ? 0.82 : (density === 'rich' ? 1.05 : 1.0)));
    midis.forEach((midi, idx) => {
      const noteName = window.Tonal ? Tonal.Note.fromMidi(midi) : 'C4';
      LearnSoundEngine.triggerNote(instrument, noteName, durationSec, time + (idx * rollDelay), Math.max(0.18, baseVel * (0.94 + idx * 0.04)), 'right');
    });
  }

  function _playArpeggioStep(chordEvent, time, stepIdx, durationSec, velocity = 0.65, instrument = 'piano', density = 'medium') {
    if (!window.LearnSoundEngine || !window.VoicingEngine || !chordEvent) return;
    const symbol = chordEvent.transposedSymbol || chordEvent.symbol;
    const parsed = VoicingEngine.parseChord(symbol, chordEvent.bass);
    const notes = parsed.notes && parsed.notes.length ? parsed.notes : ['C', 'E', 'G'];
    const noteName = notes[stepIdx % notes.length];
    const octave = 4 + Math.floor(stepIdx / notes.length);
    const vel = _humanizeVel(velocity * (density === 'soft' ? 0.8 : 1.0));
    LearnSoundEngine.triggerNote(instrument, `${noteName}${Math.min(5, octave)}`, durationSec, time, vel, 'right');
  }

  function _triggerDrum(type, time, velocity = 0.65, density = 'medium') {
    if (!window.LearnSoundEngine || !window.LearnSoundEngine.isDrumsEnabled()) return;
    const mult = density === 'soft' ? 0.75 : (density === 'rich' ? 1.15 : 1.0);
    LearnSoundEngine.triggerDrum(type, time, velocity * mult);
  }

  /* ─── 13 Pattern Style Routines ─── */

  // 1. Ballad 4/4
  function _scheduleBallad44(timeline, measureNo, audioTime, secPerBeat, beatsPerMeasure, firstChord, density) {
    for (let b = 1; b <= beatsPerMeasure; b++) {
      const bTime = audioTime + (b - 1) * secPerBeat;
      const c = ChordTimelineNormalizer.getChordAt(timeline, measureNo, b) || firstChord;
      if (!c) continue;
      const prevC = b > 1 ? ChordTimelineNormalizer.getChordAt(timeline, measureNo, b - 1) : null;
      const isChordChange = (b === 1) || (prevC && c.symbol !== prevC.symbol);

      if (isChordChange) {
        _playBassNote(c, bTime, secPerBeat * 1.8, 0.88, 'piano', 2, density);
        _playChordVoicing(c, bTime + 0.012, secPerBeat * 0.92, 0.76, 'piano', 66, density);
      } else if (b === 3 && beatsPerMeasure === 4) {
        _playAlternatingBass(c, bTime, secPerBeat * 1.6, 0.75, 'piano', density);
        _playChordVoicing(c, bTime + 0.01, secPerBeat * 0.85, 0.70, 'piano', 66, density);
      } else {
        _playChordVoicing(c, bTime, secPerBeat * 0.78, b === 2 ? 0.54 : 0.50, 'piano', 66, density);
      }
      if (density === 'rich' && (b === 2 || b === 4)) {
        _playArpeggioStep(c, bTime + secPerBeat * 0.5, b, secPerBeat * 0.45, 0.52, 'piano', density);
      }
      if (b === 1 || b === 3) _triggerDrum('kick', bTime, b === 1 ? 0.75 : 0.68, density);
      if (b === 2 || b === 4) _triggerDrum('snare', bTime, b === 2 ? 0.65 : 0.68, density);
      _triggerDrum('shaker', bTime, 0.55, density);
      if (density === 'rich') _triggerDrum('hihat', bTime + secPerBeat * 0.5, 0.35, density);
    }
  }

  // 2. Slow Rock 6/8
  function _scheduleSlowRock68(timeline, measureNo, audioTime, bpm, firstChord, density) {
    const stepDur = (60 / bpm) * 0.5;
    const c1 = ChordTimelineNormalizer.getChordAt(timeline, measureNo, 1) || firstChord;
    const c4 = ChordTimelineNormalizer.getChordAt(timeline, measureNo, 4) || c1;
    if (c1) {
      _playBassNote(c1, audioTime, stepDur * 2.8, 0.88, 'piano', 2, density);
      for (let i = 0; i < 3; i++) {
        _playArpeggioStep(c1, audioTime + i * stepDur, i, stepDur * 1.5, i === 0 ? 0.72 : (i === 1 ? 0.60 : 0.65), 'piano', density);
        _triggerDrum('hihat', audioTime + i * stepDur, i === 0 ? 0.60 : (i === 1 ? 0.42 : 0.45), density);
      }
      _triggerDrum('kick', audioTime, 0.80, density);
    }
    if (c4) {
      if (c4.symbol !== c1?.symbol) _playBassNote(c4, audioTime + 3 * stepDur, stepDur * 2.8, 0.85, 'piano', 2, density);
      else _playAlternatingBass(c4, audioTime + 3 * stepDur, stepDur * 2.8, 0.75, 'piano', density);
      for (let i = 0; i < 3; i++) {
        _playArpeggioStep(c4, audioTime + (3 + i) * stepDur, 3 + i, stepDur * 1.5, i === 0 ? 0.70 : (i === 1 ? 0.58 : 0.55), 'piano', density);
        _triggerDrum('hihat', audioTime + (3 + i) * stepDur, i === 0 ? 0.55 : (i === 1 ? 0.42 : 0.48), density);
      }
      _triggerDrum('snare', audioTime + 3 * stepDur, 0.75, density);
    }
  }

  // 3. Waltz 3/4
  function _scheduleWaltz34(timeline, measureNo, audioTime, secPerBeat, firstChord, density) {
    const c1 = ChordTimelineNormalizer.getChordAt(timeline, measureNo, 1) || firstChord;
    if (c1) {
      _playBassNote(c1, audioTime, secPerBeat * 2.5, 0.90, 'piano', 2, density);
      _triggerDrum('kick', audioTime, 0.60, density);
      _triggerDrum('shaker', audioTime, 0.60, density);
    }
    const c2 = ChordTimelineNormalizer.getChordAt(timeline, measureNo, 2) || c1;
    if (c2) {
      _playChordVoicing(c2, audioTime + secPerBeat, secPerBeat * 0.80, 0.65, 'piano', 66, density);
      _triggerDrum('shaker', audioTime + secPerBeat, 0.55, density);
    }
    const c3 = ChordTimelineNormalizer.getChordAt(timeline, measureNo, 3) || c2;
    if (c3) {
      if (c3.symbol !== c2?.symbol) {
        _playBassNote(c3, audioTime + 2 * secPerBeat, secPerBeat * 0.9, 0.80, 'piano', 2, density);
        _playChordVoicing(c3, audioTime + 2 * secPerBeat + 0.01, secPerBeat * 0.78, 0.72, 'piano', 66, density);
      } else {
        _playChordVoicing(c3, audioTime + 2 * secPerBeat, secPerBeat * 0.75, 0.56, 'piano', 66, density);
      }
      _triggerDrum('shaker', audioTime + 2 * secPerBeat, 0.48, density);
    }
  }

  // 4. Hymn / Church Organ
  function _scheduleHymn(timeline, measureNo, audioTime, secPerBeat, beatsPerMeasure, firstChord, isOrgan = false, density = 'medium') {
    const instr = isOrgan ? 'organ' : 'piano';
    const measureChords = timeline.filter(c => c.measure === measureNo);
    const changePoints = measureChords.length > 0 ? measureChords : (firstChord ? [firstChord] : []);
    changePoints.forEach(c => {
      const beatOffset = Math.max(0, (c.beat || 1) - 1);
      const bTime = audioTime + beatOffset * secPerBeat;
      const durBeats = c.durationBeats || (beatsPerMeasure - beatOffset);
      const durSec = durBeats * secPerBeat * (isOrgan ? 0.98 : 0.94);
      _playBassNote(c, bTime, durSec, isOrgan ? 0.90 : 0.86, instr, 2, density);
      _playChordVoicing(c, bTime + 0.012, durSec, isOrgan ? 0.82 : 0.78, instr, 66, density);
    });
  }

  // 5. Worship Arpeggio 16th
  function _scheduleWorshipArpeggio(timeline, measureNo, audioTime, secPerBeat, beatsPerMeasure, firstChord, density) {
    const sixteenthDur = secPerBeat * 0.25;
    for (let b = 1; b <= beatsPerMeasure; b++) {
      const c = ChordTimelineNormalizer.getChordAt(timeline, measureNo, b) || firstChord;
      if (!c) continue;
      const bTime = audioTime + (b - 1) * secPerBeat;
      if (b === 1 || b === 3) {
        _playBassNote(c, bTime, secPerBeat * 1.8, 0.86, 'piano', 2, density);
        _triggerDrum('kick', bTime, 0.65, density);
      }
      for (let s = 0; s < 4; s++) {
        const stepTime = bTime + s * sixteenthDur;
        _playArpeggioStep(c, stepTime, (b - 1) * 4 + s, sixteenthDur * 1.8, s === 0 ? 0.68 : (s === 2 ? 0.58 : 0.50), 'piano', density);
        _triggerDrum('shaker', stepTime, 0.40, density);
      }
    }
  }

  // 6. March
  function _scheduleMarch(timeline, measureNo, audioTime, secPerBeat, beatsPerMeasure, firstChord, density) {
    for (let b = 1; b <= beatsPerMeasure; b++) {
      const bTime = audioTime + (b - 1) * secPerBeat;
      const c = ChordTimelineNormalizer.getChordAt(timeline, measureNo, b) || firstChord;
      if (!c) continue;
      if (b === 1) {
        _playBassNote(c, bTime, secPerBeat * 0.85, 0.88, 'piano', 2, density);
        _triggerDrum('kick', bTime, 0.85, density);
      } else if (b === 3 && beatsPerMeasure >= 4) {
        _playAlternatingBass(c, bTime, secPerBeat * 0.85, 0.82, 'piano', density);
        _triggerDrum('kick', bTime, 0.80, density);
      } else {
        _playChordVoicing(c, bTime, secPerBeat * 0.70, 0.74, 'piano', 66, density);
        _triggerDrum('snare', bTime, 0.78, density);
      }
      _triggerDrum('hihat', bTime, 0.50, density);
    }
  }

  // 7. Rumba
  function _scheduleRumba(timeline, measureNo, audioTime, secPerBeat, firstChord, density) {
    const c1 = ChordTimelineNormalizer.getChordAt(timeline, measureNo, 1) || firstChord;
    const c3 = ChordTimelineNormalizer.getChordAt(timeline, measureNo, 3) || c1;
    if (c1) {
      _playBassNote(c1, audioTime, secPerBeat * 1.4, 0.88, 'piano', 2, density);
      _triggerDrum('kick', audioTime, 0.85, density);
      _triggerDrum('shaker', audioTime, 0.60, density);
      _playChordVoicing(c1, audioTime + 0.75 * secPerBeat, secPerBeat * 0.6, 0.72, 'piano', 66, density);
      _triggerDrum('snare', audioTime + 0.75 * secPerBeat, 0.70, density);
      _playChordVoicing(c1, audioTime + 1.5 * secPerBeat, secPerBeat * 0.45, 0.65, 'piano', 66, density);
      _triggerDrum('shaker', audioTime + 1.5 * secPerBeat, 0.55, density);
    }
    if (c3) {
      _playAlternatingBass(c3, audioTime + 2 * secPerBeat, secPerBeat * 1.3, 0.80, 'piano', density);
      _triggerDrum('kick', audioTime + 2 * secPerBeat, 0.75, density);
      _playChordVoicing(c3, audioTime + 2.5 * secPerBeat, secPerBeat * 0.45, 0.62, 'piano', 66, density);
      _triggerDrum('shaker', audioTime + 2.5 * secPerBeat, 0.55, density);
      _playChordVoicing(c3, audioTime + 3 * secPerBeat, secPerBeat * 0.6, 0.74, 'piano', 66, density);
      _triggerDrum('snare', audioTime + 3 * secPerBeat, 0.75, density);
    }
    _triggerDrum('shaker', audioTime + 3.5 * secPerBeat, 0.48, density);
  }

  // 8. Piano Block 4/4
  function _scheduleBlock(timeline, measureNo, audioTime, secPerBeat, beatsPerMeasure, firstChord, density) {
    for (let b = 1; b <= beatsPerMeasure; b++) {
      const bTime = audioTime + (b - 1) * secPerBeat;
      const c = ChordTimelineNormalizer.getChordAt(timeline, measureNo, b) || firstChord;
      if (!c) continue;
      if (b === 1 || b === 3) _playBassNote(c, bTime, secPerBeat * 1.5, 0.85, 'piano', 2, density);
      _playChordVoicing(c, bTime, secPerBeat * 0.85, 0.72, 'piano', 66, density);
      _triggerDrum('shaker', bTime, 0.50, density);
    }
  }

  // 9. Boston 3/4
  function _scheduleBoston(timeline, measureNo, audioTime, secPerBeat, firstChord, density) {
    const c1 = ChordTimelineNormalizer.getChordAt(timeline, measureNo, 1) || firstChord;
    if (c1) {
      _playBassNote(c1, audioTime, secPerBeat * 2.8, 0.92, 'piano', 2, density);
      _playChordVoicing(c1, audioTime + 0.015, secPerBeat * 0.95, 0.68, 'piano', 66, density);
      _triggerDrum('kick', audioTime, 0.55, density);
      _triggerDrum('shaker', audioTime, 0.50, density);
    }
    for (let b = 2; b <= 3; b++) {
      const c = ChordTimelineNormalizer.getChordAt(timeline, measureNo, b) || c1;
      if (c) {
        _playArpeggioStep(c, audioTime + (b - 1) * secPerBeat, b - 1, secPerBeat * 0.9, b === 2 ? 0.62 : 0.65, 'piano', density);
        _playChordVoicing(c, audioTime + (b - 1) * secPerBeat + 0.01, secPerBeat * 0.8, b === 2 ? 0.58 : 0.60, 'piano', 66, density);
        _triggerDrum('shaker', audioTime + (b - 1) * secPerBeat, b === 2 ? 0.45 : 0.48, density);
      }
    }
  }

  // 10. Joyful Waltz 3/4
  function _scheduleJoyfulWaltz(timeline, measureNo, audioTime, secPerBeat, firstChord, density) {
    const c1 = ChordTimelineNormalizer.getChordAt(timeline, measureNo, 1) || firstChord;
    if (c1) {
      _playBassNote(c1, audioTime, secPerBeat * 0.9, 0.95, 'piano', 2, density);
      _triggerDrum('kick', audioTime, 0.80, density);
      _triggerDrum('hihat', audioTime, 0.60, density);
    }
    const c2 = ChordTimelineNormalizer.getChordAt(timeline, measureNo, 2) || c1;
    if (c2) {
      _playChordVoicing(c2, audioTime + secPerBeat, secPerBeat * 0.65, 0.76, 'piano', 66, density);
      _triggerDrum('snare', audioTime + secPerBeat, 0.65, density);
      _triggerDrum('hihat', audioTime + secPerBeat, 0.55, density);
    }
    const c3 = ChordTimelineNormalizer.getChordAt(timeline, measureNo, 3) || c2;
    if (c3) {
      _playChordVoicing(c3, audioTime + 2 * secPerBeat, secPerBeat * 0.65, 0.72, 'piano', 66, density);
      _triggerDrum('hihat', audioTime + 2 * secPerBeat, 0.55, density);
    }
  }

  // 11. Disco 4/4
  function _scheduleDisco(timeline, measureNo, audioTime, secPerBeat, beatsPerMeasure, firstChord, density) {
    for (let b = 1; b <= beatsPerMeasure; b++) {
      const bTime = audioTime + (b - 1) * secPerBeat;
      const c = ChordTimelineNormalizer.getChordAt(timeline, measureNo, b) || firstChord;
      if (!c) continue;
      _triggerDrum('kick', bTime, 0.85, density);
      _playBassNote(c, bTime, secPerBeat * 0.45, 0.90, 'piano', 2, density);
      _playAlternatingBass(c, bTime + secPerBeat * 0.5, secPerBeat * 0.45, 0.78, 'piano', density);
      _triggerDrum('hihat', bTime + secPerBeat * 0.5, 0.70, density);
      if (b === 2 || b === 4) {
        _triggerDrum('snare', bTime, 0.80, density);
        _playChordVoicing(c, bTime, secPerBeat * 0.7, 0.82, 'piano', 66, density);
      } else {
        _playChordVoicing(c, bTime, secPerBeat * 0.5, 0.65, 'piano', 66, density);
      }
    }
  }

  // 12. Fox / Polka 2/4
  function _scheduleFoxPolka(timeline, measureNo, audioTime, secPerBeat, firstChord, density) {
    const c1 = ChordTimelineNormalizer.getChordAt(timeline, measureNo, 1) || firstChord;
    const c2 = ChordTimelineNormalizer.getChordAt(timeline, measureNo, 2) || c1;
    if (c1) {
      _playBassNote(c1, audioTime, secPerBeat * 0.45, 0.92, 'piano', 2, density);
      _triggerDrum('kick', audioTime, 0.85, density);
      _playChordVoicing(c1, audioTime + secPerBeat * 0.5, secPerBeat * 0.4, 0.75, 'piano', 66, density);
      _triggerDrum('hihat', audioTime + secPerBeat * 0.5, 0.65, density);
    }
    if (c2) {
      _playAlternatingBass(c2, audioTime + secPerBeat, secPerBeat * 0.45, 0.85, 'piano', density);
      _triggerDrum('snare', audioTime + secPerBeat, 0.80, density);
      _playChordVoicing(c2, audioTime + secPerBeat * 1.5, secPerBeat * 0.4, 0.72, 'piano', 66, density);
      _triggerDrum('hihat', audioTime + secPerBeat * 1.5, 0.60, density);
    }
  }

  // 13. Ballad 6/8
  function _scheduleBallad68(timeline, measureNo, audioTime, bpm, firstChord, density) {
    const stepDur = (60 / bpm) * 0.5;
    const c1 = ChordTimelineNormalizer.getChordAt(timeline, measureNo, 1) || firstChord;
    const c4 = ChordTimelineNormalizer.getChordAt(timeline, measureNo, 4) || c1;
    if (c1) {
      _playBassNote(c1, audioTime, stepDur * 3.0, 0.90, 'piano', 2, density);
      _playChordVoicing(c1, audioTime + 0.015, stepDur * 2.8, 0.75, 'piano', 66, density);
      _triggerDrum('kick', audioTime, 0.75, density);
      _triggerDrum('shaker', audioTime, 0.55, density);
      _playArpeggioStep(c1, audioTime + 2 * stepDur, 1, stepDur * 0.9, 0.58, 'piano', density);
      _triggerDrum('shaker', audioTime + 2 * stepDur, 0.45, density);
    }
    if (c4) {
      _playAlternatingBass(c4, audioTime + 3 * stepDur, stepDur * 3.0, 0.82, 'piano', density);
      _playChordVoicing(c4, audioTime + 3 * stepDur + 0.015, stepDur * 2.8, 0.72, 'piano', 66, density);
      _triggerDrum('snare', audioTime + 3 * stepDur, 0.70, density);
      _triggerDrum('shaker', audioTime + 3 * stepDur, 0.55, density);
      _playArpeggioStep(c4, audioTime + 5 * stepDur, 2, stepDur * 0.9, 0.55, 'piano', density);
      _triggerDrum('shaker', audioTime + 5 * stepDur, 0.45, density);
    }
  }

  /* ─── Main Generator Entry Point ─── */
  function generateMeasure(measureNo, audioTime, bpm, { patternId = 'smart-ballad', density = 'medium' } = {}) {
    if (!window.VoicingEngine || !window.LearnSoundEngine) return;
    const timeline = window.LearnStore ? LearnStore.get('timeline') : [];
    if (!timeline || !timeline.length) return;

    const beatsPerMeasure = window.LearnStore?.get('_beats') || 4;
    const beatType = window.LearnStore?.get('_beatType') || 4;
    const secPerBeat = 60 / Math.max(20, bpm);

    let firstChord = ChordTimelineNormalizer.getChordAt(timeline, measureNo, 1);
    if (!firstChord) {
      for (let m = measureNo - 1; m >= 1; m--) {
        firstChord = ChordTimelineNormalizer.getChordAt(timeline, m, 1);
        if (firstChord) break;
      }
    }
    if (!firstChord && timeline.length > 0) firstChord = timeline[0];

    // Nhóm 6/8
    if (patternId === 'smart-slowrock-6-8' || ((beatsPerMeasure === 6 && beatType === 8) && patternId !== 'smart-ballad-6-8')) {
      return _scheduleSlowRock68(timeline, measureNo, audioTime, bpm, firstChord, density);
    }
    if (patternId === 'smart-ballad-6-8') {
      return _scheduleBallad68(timeline, measureNo, audioTime, bpm, firstChord, density);
    }

    // Nhóm 3/4
    if (patternId === 'smart-boston') return _scheduleBoston(timeline, measureNo, audioTime, secPerBeat, firstChord, density);
    if (patternId === 'smart-joyful-waltz') return _scheduleJoyfulWaltz(timeline, measureNo, audioTime, secPerBeat, firstChord, density);
    if (beatsPerMeasure === 3 || patternId === 'smart-waltz') return _scheduleWaltz34(timeline, measureNo, audioTime, secPerBeat, firstChord, density);

    // Nhóm 2/4
    if (patternId === 'smart-fox') return _scheduleFoxPolka(timeline, measureNo, audioTime, secPerBeat, firstChord, density);
    if (patternId === 'smart-march' || (beatsPerMeasure === 2 && beatType === 4 && patternId !== 'smart-ballad')) {
      return _scheduleMarch(timeline, measureNo, audioTime, secPerBeat, beatsPerMeasure, firstChord, density);
    }

    // Nhóm 4/4
    if (patternId === 'smart-disco') return _scheduleDisco(timeline, measureNo, audioTime, secPerBeat, beatsPerMeasure, firstChord, density);
    if (patternId === 'smart-worship') return _scheduleWorshipArpeggio(timeline, measureNo, audioTime, secPerBeat, beatsPerMeasure, firstChord, density);
    if (patternId === 'smart-rumba') return _scheduleRumba(timeline, measureNo, audioTime, secPerBeat, firstChord, density);
    if (patternId === 'piano-block-4-4-v1') return _scheduleBlock(timeline, measureNo, audioTime, secPerBeat, beatsPerMeasure, firstChord, density);
    if (patternId === 'smart-hymn' || patternId === 'organ-church-4-4-v1') {
      return _scheduleHymn(timeline, measureNo, audioTime, secPerBeat, beatsPerMeasure, firstChord, patternId === 'organ-church-4-4-v1', density);
    }

    // Mặc định Ballad 4/4
    _scheduleBallad44(timeline, measureNo, audioTime, secPerBeat, beatsPerMeasure, firstChord, density);
  }

  return { generateMeasure };
})();

if (typeof window !== 'undefined') {
  window.PatternGenerator = PatternGenerator;
}
