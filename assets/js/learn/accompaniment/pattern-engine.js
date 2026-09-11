/**
 * learn/accompaniment/pattern-engine.js — Stage 5 & Phase 2: Smart Adaptive Accompaniment Engine
 *
 * Điều phối đệm thông minh tự thích ứng chuyên sâu cho Piano / Organ & Acoustic Drums:
 * - 9 phong cách đệm chân thực (Pop/Worship Ballad 4/4, Slow Rock 6/8, Boston/Waltz 3/4,
 *   Thánh Ca 4 Bè, Arpeggio Suối Reo 16th, Joyful March, Liturgical Rumba, Piano Block, Church Organ)
 * - Tách bè 2 tay chuẩn mực: Left Hand (Bass Octave 2) & Right Hand (Voiced Chords & Arpeggio)
 * - Tự thích ứng mượt mà (Smooth Voice Leading / Nearest Inversion) qua VoicingEngine
 * - Micro-roll arpeggiation (10-15ms) tạo độ chân thực của ngón tay đập búa piano mộc
 * - Tích hợp Acoustic Rhythm & Drum Kit (Kick, Soft Snare/Rimshot, Hi-hat, Shaker)
 * - Khắc phục hoàn toàn độ trễ lookAhead của Tone.js bằng getTicksAtTime(time)
 * - Tùy chỉnh mật độ hòa âm (Density: 'soft' | 'medium' | 'rich')
 *
 * Expose: window.PatternEngine
 */
const PatternEngine = (() => {
  'use strict';

  let _activePatternId = 'smart-ballad';
  let _density = 'medium'; // 'soft' | 'medium' | 'rich'
  let _enabled = true;
  let _scheduledEventId = null;
  let _lastScheduledMeasure = -1;

  function init() {
    const savedPattern = window.LearnStore?.get('patternId');
    if (savedPattern) {
      _activePatternId = savedPattern;
    }
    const savedDensity = window.LearnStore?.get('accompanimentDensity');
    if (savedDensity) {
      _density = savedDensity;
    }
  }

  function setPattern(patternId) {
    if (!patternId) return;
    _activePatternId = patternId;
    if (window.LearnStore) {
      LearnStore.set('patternId', patternId);
      LearnStore.savePreferences();
    }
    if (window.EventBus) {
      EventBus.emit(LEARN_EVENTS.PATTERN_CHANGED, { patternId });
    }
  }

  function getActivePattern() {
    return window.PatternLibrary ? PatternLibrary.getById(_activePatternId) : null;
  }

  function setDensity(density) {
    if (['soft', 'medium', 'rich'].includes(density)) {
      _density = density;
      if (window.LearnStore) {
        LearnStore.set('accompanimentDensity', density);
        LearnStore.savePreferences();
      }
    }
  }

  function getDensity() {
    return _density;
  }

  function setEnabled(enabled) {
    _enabled = !!enabled;
    if (!_enabled && window.LearnSoundEngine) {
      LearnSoundEngine.stopAll();
    }
  }

  function isEnabled() {
    return _enabled;
  }

  /* ─── Private Helpers for Musical Playback ─── */

  function _humanizeVel(vel, amount = 0.04) {
    const delta = (Math.random() * 2 - 1) * amount;
    return Math.max(0.15, Math.min(1.0, vel + delta));
  }

  function _playBassNote(chordEvent, time, durationSec, velocity = 0.85, instrument = 'piano', octave = 2) {
    if (!window.LearnSoundEngine || !chordEvent) return;
    const symbol = chordEvent.transposedSymbol || chordEvent.symbol;
    const parsed = VoicingEngine.parseChord(symbol, chordEvent.bass);
    const bassName = parsed.bass || parsed.root || 'C';
    const note = `${bassName}${octave}`;
    const vel = _humanizeVel(velocity * (_density === 'soft' ? 0.85 : (_density === 'rich' ? 1.05 : 1.0)));
    LearnSoundEngine.triggerNote(instrument, note, durationSec, time, vel, 'left');
  }

  function _playAlternatingBass(chordEvent, time, durationSec, velocity = 0.75, instrument = 'piano') {
    if (!window.LearnSoundEngine || !chordEvent) return;
    const symbol = chordEvent.transposedSymbol || chordEvent.symbol;
    const parsed = VoicingEngine.parseChord(symbol, chordEvent.bass);
    // Fifth note or octave of root
    const fifthNote = parsed.notes && parsed.notes.length >= 3 ? parsed.notes[2] : parsed.root;
    const note = `${fifthNote}2`;
    const vel = _humanizeVel(velocity * (_density === 'soft' ? 0.82 : 1.0));
    LearnSoundEngine.triggerNote(instrument, note, durationSec, time, vel, 'left');
  }

  function _playChordVoicing(chordEvent, time, durationSec, velocity = 0.70, instrument = 'piano', targetCenter = 66) {
    if (!window.LearnSoundEngine || !window.VoicingEngine || !chordEvent) return;
    const symbol = chordEvent.transposedSymbol || chordEvent.symbol;
    const parsed = VoicingEngine.parseChord(symbol, chordEvent.bass);
    let midis = VoicingEngine.pickNearestInversion(parsed.notes, 4, targetCenter);

    // Density adjustments
    if (_density === 'soft' && midis.length > 2) {
      // Shell voicing (root + 3rd/7th)
      midis = [midis[0], midis[midis.length - 1]];
    }

    const rollDelay = instrument === 'organ' ? 0 : 0.012; // 12ms micro-roll for piano
    const baseVel = _humanizeVel(velocity * (_density === 'soft' ? 0.82 : (_density === 'rich' ? 1.05 : 1.0)));

    midis.forEach((midi, idx) => {
      const noteName = window.Tonal ? Tonal.Note.fromMidi(midi) : 'C4';
      const rollTime = time + (idx * rollDelay);
      const noteVel  = Math.max(0.18, baseVel * (0.94 + idx * 0.04));
      LearnSoundEngine.triggerNote(instrument, noteName, durationSec, rollTime, noteVel, 'right');
    });
  }

  function _playArpeggioStep(chordEvent, time, stepIdx, durationSec, velocity = 0.65, instrument = 'piano') {
    if (!window.LearnSoundEngine || !window.VoicingEngine || !chordEvent) return;
    const symbol = chordEvent.transposedSymbol || chordEvent.symbol;
    const parsed = VoicingEngine.parseChord(symbol, chordEvent.bass);
    const notes = parsed.notes && parsed.notes.length ? parsed.notes : ['C', 'E', 'G'];
    const noteName = notes[stepIdx % notes.length];
    const octave = 4 + Math.floor(stepIdx / notes.length);
    const fullNote = `${noteName}${Math.min(5, octave)}`;
    const vel = _humanizeVel(velocity * (_density === 'soft' ? 0.8 : 1.0));
    LearnSoundEngine.triggerNote(instrument, fullNote, durationSec, time, vel, 'right');
  }

  function _triggerDrum(type, time, velocity = 0.65) {
    if (!window.LearnSoundEngine) return;
    const mult = _density === 'soft' ? 0.75 : (_density === 'rich' ? 1.15 : 1.0);
    LearnSoundEngine.triggerDrum(type, time, velocity * mult);
  }

  /* ─── Tone.js Exact Measure Resolution at Audio Time ─── */
  function _getMeasureAtTime(audioTime) {
    if (!window.Tone) return 1;
    const T = Tone.getTransport();
    if (typeof T.getTicksAtTime === 'function') {
      const ticks = T.getTicksAtTime(audioTime);
      const timeSig = Array.isArray(T.timeSignature) ? T.timeSignature[0] : (T.timeSignature || 4);
      const ticksPerBar = (T.PPQ || 192) * timeSig;
      // Cộng 10 ticks margin để triệt tiêu sai số floating point (767.9999999994325) của Tone.js clock
      const bar = Math.floor((ticks + 10) / ticksPerBar);
      return Math.max(1, bar + 1);
    }
    return window.MusicTransport ? MusicTransport.getMeasureBeat().measure : 1;
  }

  /* ─── Smart Adaptive Scheduling Routines ─── */

  /**
   * 1. Smart Ballad (4/4 Pop/Worship Ballad mượt mà, chân thực)
   */
  function _scheduleBallad44(timeline, measureNo, audioTime, secPerBeat, beatsPerMeasure, firstChord) {
    for (let b = 1; b <= beatsPerMeasure; b++) {
      const bTime = audioTime + (b - 1) * secPerBeat;
      const c = ChordTimelineNormalizer.getChordAt(timeline, measureNo, b) || firstChord;
      if (!c) continue;

      const prevC = b > 1 ? ChordTimelineNormalizer.getChordAt(timeline, measureNo, b - 1) : null;
      const isChordChange = (b === 1) || (prevC && c.symbol !== prevC.symbol);

      if (isChordChange) {
        _playBassNote(c, bTime, secPerBeat * 1.8, 0.88);
        _playChordVoicing(c, bTime + 0.012, secPerBeat * 0.92, 0.76);
      } else if (b === 3 && beatsPerMeasure === 4) {
        _playAlternatingBass(c, bTime, secPerBeat * 1.6, 0.75);
        _playChordVoicing(c, bTime + 0.01, secPerBeat * 0.85, 0.70);
      } else {
        const compVel = (b === 2) ? 0.54 : 0.50;
        _playChordVoicing(c, bTime, secPerBeat * 0.78, compVel);
      }

      // Rich density: subtle arpeggio fills on offbeats (8th notes)
      if (_density === 'rich' && (b === 2 || b === 4)) {
        _playArpeggioStep(c, bTime + secPerBeat * 0.5, b, secPerBeat * 0.45, 0.52);
      }

      // Drum groove (Ballad style)
      if (b === 1) {
        _triggerDrum('kick', bTime, 0.75);
        _triggerDrum('shaker', bTime, 0.55);
      } else if (b === 2) {
        _triggerDrum('shaker', bTime, 0.55);
        _triggerDrum('snare', bTime, 0.65);
      } else if (b === 3) {
        _triggerDrum('kick', bTime, 0.68);
        _triggerDrum('shaker', bTime, 0.55);
      } else if (b === 4) {
        _triggerDrum('shaker', bTime, 0.55);
        _triggerDrum('snare', bTime, 0.68);
      }
      if (_density === 'rich') {
        _triggerDrum('hihat', bTime + secPerBeat * 0.5, 0.35);
      }
    }
  }

  /**
   * 2. Smart Slow Rock 6/8 (Thánh Ca 6/8 Sóng biển nhấp nhô)
   */
  function _scheduleSlowRock68(timeline, measureNo, audioTime, bpm, firstChord) {
    const stepDur = (60 / bpm) * 0.5; // mỗi móc đơn (8th note)
    const c1 = ChordTimelineNormalizer.getChordAt(timeline, measureNo, 1) || firstChord;
    const c4 = ChordTimelineNormalizer.getChordAt(timeline, measureNo, 4) || c1;

    // Sub-beat 1 (Pulse 1)
    if (c1) {
      _playBassNote(c1, audioTime, stepDur * 2.8, 0.88);
      _playArpeggioStep(c1, audioTime, 0, stepDur * 1.5, 0.72);
      _playArpeggioStep(c1, audioTime + stepDur, 1, stepDur * 1.5, 0.60);
      _playArpeggioStep(c1, audioTime + 2 * stepDur, 2, stepDur * 1.5, 0.65);

      // Drums
      _triggerDrum('kick', audioTime, 0.80);
      _triggerDrum('hihat', audioTime, 0.60);
      _triggerDrum('hihat', audioTime + stepDur, 0.42);
      _triggerDrum('hihat', audioTime + 2 * stepDur, 0.45);
    }

    // Sub-beat 4 (Pulse 4)
    if (c4) {
      const isChange = c4.symbol !== c1?.symbol;
      if (isChange) {
        _playBassNote(c4, audioTime + 3 * stepDur, stepDur * 2.8, 0.85);
      } else {
        _playAlternatingBass(c4, audioTime + 3 * stepDur, stepDur * 2.8, 0.75);
      }
      _playArpeggioStep(c4, audioTime + 3 * stepDur, 3, stepDur * 1.5, 0.70);
      _playArpeggioStep(c4, audioTime + 4 * stepDur, 4, stepDur * 1.5, 0.58);
      _playArpeggioStep(c4, audioTime + 5 * stepDur, 5, stepDur * 1.5, 0.55);

      // Drums
      _triggerDrum('snare', audioTime + 3 * stepDur, 0.75);
      _triggerDrum('hihat', audioTime + 3 * stepDur, 0.55);
      _triggerDrum('hihat', audioTime + 4 * stepDur, 0.42);
      _triggerDrum('hihat', audioTime + 5 * stepDur, 0.48);
    }
  }

  /**
   * 3. Smart Waltz 3/4 (Boston / Slow Waltz trữ tình)
   */
  function _scheduleWaltz34(timeline, measureNo, audioTime, secPerBeat, firstChord) {
    const c1 = ChordTimelineNormalizer.getChordAt(timeline, measureNo, 1) || firstChord;
    if (c1) {
      _playBassNote(c1, audioTime, secPerBeat * 2.5, 0.90);
      _triggerDrum('kick', audioTime, 0.60);
      _triggerDrum('shaker', audioTime, 0.60);
    }

    const c2 = ChordTimelineNormalizer.getChordAt(timeline, measureNo, 2) || c1;
    if (c2) {
      _playChordVoicing(c2, audioTime + secPerBeat, secPerBeat * 0.80, 0.65);
      _triggerDrum('shaker', audioTime + secPerBeat, 0.55);
    }

    const c3 = ChordTimelineNormalizer.getChordAt(timeline, measureNo, 3) || c2;
    if (c3) {
      const isChange = (c3.symbol !== c2?.symbol);
      if (isChange) {
        _playBassNote(c3, audioTime + 2 * secPerBeat, secPerBeat * 0.9, 0.80);
        _playChordVoicing(c3, audioTime + 2 * secPerBeat + 0.01, secPerBeat * 0.78, 0.72);
      } else {
        _playChordVoicing(c3, audioTime + 2 * secPerBeat, secPerBeat * 0.75, 0.56);
      }
      _triggerDrum('shaker', audioTime + 2 * secPerBeat, 0.48);
    }
  }

  /**
   * 4. Smart Hymn / Church Organ (Thánh ca 4 Bè SATB hòa âm trang trọng)
   */
  function _scheduleHymn(timeline, measureNo, audioTime, secPerBeat, beatsPerMeasure, firstChord, isOrgan = false) {
    const instr = isOrgan ? 'organ' : 'piano';
    const measureChords = timeline.filter(c => c.measure === measureNo);
    const changePoints = measureChords.length > 0 ? measureChords : (firstChord ? [firstChord] : []);

    changePoints.forEach(c => {
      const beatOffset = Math.max(0, (c.beat || 1) - 1);
      const bTime = audioTime + beatOffset * secPerBeat;
      const durBeats = c.durationBeats || (beatsPerMeasure - beatOffset);
      const durSec = durBeats * secPerBeat * (isOrgan ? 0.98 : 0.94);

      _playBassNote(c, bTime, durSec, isOrgan ? 0.90 : 0.86, instr);
      _playChordVoicing(c, bTime + 0.012, durSec, isOrgan ? 0.82 : 0.78, instr);
    });
  }

  /**
   * 5. Smart Worship (Arpeggio Suối Reo rải 16th mượt mà)
   */
  function _scheduleWorshipArpeggio(timeline, measureNo, audioTime, secPerBeat, beatsPerMeasure, firstChord) {
    for (let b = 1; b <= beatsPerMeasure; b++) {
      const c = ChordTimelineNormalizer.getChordAt(timeline, measureNo, b) || firstChord;
      if (!c) continue;
      const bTime = audioTime + (b - 1) * secPerBeat;

      if (b === 1 || b === 3) {
        _playBassNote(c, bTime, secPerBeat * 1.8, 0.86);
        _triggerDrum('kick', bTime, 0.65);
      }

      // 4 sixteenth notes per beat
      const sixteenthDur = secPerBeat * 0.25;
      for (let s = 0; s < 4; s++) {
        const stepTime = bTime + s * sixteenthDur;
        const stepIdx = (b - 1) * 4 + s;
        const vel = s === 0 ? 0.68 : (s === 2 ? 0.58 : 0.50);
        _playArpeggioStep(c, stepTime, stepIdx, sixteenthDur * 1.8, vel);
        _triggerDrum('shaker', stepTime, 0.40);
      }
    }
  }

  /**
   * 6. Smart Joyful March (Hành Khúc / Hân Hoan 2/4 - 4/4)
   */
  function _scheduleMarch(timeline, measureNo, audioTime, secPerBeat, beatsPerMeasure, firstChord) {
    for (let b = 1; b <= beatsPerMeasure; b++) {
      const bTime = audioTime + (b - 1) * secPerBeat;
      const c = ChordTimelineNormalizer.getChordAt(timeline, measureNo, b) || firstChord;
      if (!c) continue;

      if (b === 1) {
        _playBassNote(c, bTime, secPerBeat * 0.85, 0.88);
        _triggerDrum('kick', bTime, 0.85);
      } else if (b === 3 && beatsPerMeasure >= 4) {
        _playAlternatingBass(c, bTime, secPerBeat * 0.85, 0.82);
        _triggerDrum('kick', bTime, 0.80);
      } else {
        // Offbeat punchy chord
        _playChordVoicing(c, bTime, secPerBeat * 0.70, 0.74);
        _triggerDrum('snare', bTime, 0.78);
      }
      _triggerDrum('hihat', bTime, 0.50);
    }
  }

  /**
   * 7. Smart Rumba (Rumba Phụng Vụ / Thánh Ca)
   */
  function _scheduleRumba(timeline, measureNo, audioTime, secPerBeat, firstChord) {
    const c1 = ChordTimelineNormalizer.getChordAt(timeline, measureNo, 1) || firstChord;
    const c3 = ChordTimelineNormalizer.getChordAt(timeline, measureNo, 3) || c1;

    // t = 0 (Beat 1): Bùm
    if (c1) {
      _playBassNote(c1, audioTime, secPerBeat * 1.4, 0.88);
      _triggerDrum('kick', audioTime, 0.85);
      _triggerDrum('shaker', audioTime, 0.60);
    }

    // t = 0.75 beat: Chát
    if (c1) {
      _playChordVoicing(c1, audioTime + 0.75 * secPerBeat, secPerBeat * 0.6, 0.72);
      _triggerDrum('snare', audioTime + 0.75 * secPerBeat, 0.70);
    }

    // t = 1.5 beat: Chát
    if (c1) {
      _playChordVoicing(c1, audioTime + 1.5 * secPerBeat, secPerBeat * 0.45, 0.65);
      _triggerDrum('shaker', audioTime + 1.5 * secPerBeat, 0.55);
    }

    // t = 2.0 beat (Beat 3): Bùm
    if (c3) {
      _playAlternatingBass(c3, audioTime + 2 * secPerBeat, secPerBeat * 1.3, 0.80);
      _triggerDrum('kick', audioTime + 2 * secPerBeat, 0.75);
    }

    // t = 2.5 beat: Chát
    if (c3) {
      _playChordVoicing(c3, audioTime + 2.5 * secPerBeat, secPerBeat * 0.45, 0.62);
      _triggerDrum('shaker', audioTime + 2.5 * secPerBeat, 0.55);
    }

    // t = 3.0 beat (Beat 4): Chát
    if (c3) {
      _playChordVoicing(c3, audioTime + 3 * secPerBeat, secPerBeat * 0.6, 0.74);
      _triggerDrum('snare', audioTime + 3 * secPerBeat, 0.75);
    }

    // t = 3.5 beat: Shaker
    _triggerDrum('shaker', audioTime + 3.5 * secPerBeat, 0.48);
  }

  /**
   * 8. Piano Block 4/4 (Dậm đều từng phách cho người mới)
   */
  function _scheduleBlock(timeline, measureNo, audioTime, secPerBeat, beatsPerMeasure, firstChord) {
    for (let b = 1; b <= beatsPerMeasure; b++) {
      const bTime = audioTime + (b - 1) * secPerBeat;
      const c = ChordTimelineNormalizer.getChordAt(timeline, measureNo, b) || firstChord;
      if (!c) continue;

      if (b === 1 || b === 3) {
        _playBassNote(c, bTime, secPerBeat * 1.5, 0.85);
      }
      _playChordVoicing(c, bTime, secPerBeat * 0.85, 0.72);
      _triggerDrum('shaker', bTime, 0.50);
    }
  }

  /**
   * 9. Smart Boston 3/4 (Boston trữ tình sâu lắng)
   */
  function _scheduleBoston(timeline, measureNo, audioTime, secPerBeat, firstChord) {
    const c1 = ChordTimelineNormalizer.getChordAt(timeline, measureNo, 1) || firstChord;
    if (c1) {
      _playBassNote(c1, audioTime, secPerBeat * 2.8, 0.92);
      _playChordVoicing(c1, audioTime + 0.015, secPerBeat * 0.95, 0.68);
      _triggerDrum('kick', audioTime, 0.55);
      _triggerDrum('shaker', audioTime, 0.50);
    }

    const c2 = ChordTimelineNormalizer.getChordAt(timeline, measureNo, 2) || c1;
    if (c2) {
      _playArpeggioStep(c2, audioTime + secPerBeat, 1, secPerBeat * 0.9, 0.62);
      _playChordVoicing(c2, audioTime + secPerBeat + 0.01, secPerBeat * 0.8, 0.58);
      _triggerDrum('shaker', audioTime + secPerBeat, 0.45);
    }

    const c3 = ChordTimelineNormalizer.getChordAt(timeline, measureNo, 3) || c2;
    if (c3) {
      _playArpeggioStep(c3, audioTime + 2 * secPerBeat, 2, secPerBeat * 0.9, 0.65);
      _playChordVoicing(c3, audioTime + 2 * secPerBeat + 0.01, secPerBeat * 0.8, 0.60);
      _triggerDrum('shaker', audioTime + 2 * secPerBeat, 0.48);
    }
  }

  /**
   * 10. Smart Joyful Waltz 3/4 (Valse hân hoan rộn ràng mừng lễ)
   */
  function _scheduleJoyfulWaltz(timeline, measureNo, audioTime, secPerBeat, firstChord) {
    const c1 = ChordTimelineNormalizer.getChordAt(timeline, measureNo, 1) || firstChord;
    if (c1) {
      _playBassNote(c1, audioTime, secPerBeat * 0.9, 0.95);
      _triggerDrum('kick', audioTime, 0.80);
      _triggerDrum('hihat', audioTime, 0.60);
    }

    const c2 = ChordTimelineNormalizer.getChordAt(timeline, measureNo, 2) || c1;
    if (c2) {
      _playChordVoicing(c2, audioTime + secPerBeat, secPerBeat * 0.65, 0.76);
      _triggerDrum('snare', audioTime + secPerBeat, 0.65);
      _triggerDrum('hihat', audioTime + secPerBeat, 0.55);
    }

    const c3 = ChordTimelineNormalizer.getChordAt(timeline, measureNo, 3) || c2;
    if (c3) {
      _playChordVoicing(c3, audioTime + 2 * secPerBeat, secPerBeat * 0.65, 0.72);
      _triggerDrum('hihat', audioTime + 2 * secPerBeat, 0.55);
    }
  }

  /**
   * 11. Smart Disco / Praise 4/4 (Hân hoan & sôi nổi)
   */
  function _scheduleDisco(timeline, measureNo, audioTime, secPerBeat, beatsPerMeasure, firstChord) {
    for (let b = 1; b <= beatsPerMeasure; b++) {
      const bTime = audioTime + (b - 1) * secPerBeat;
      const c = ChordTimelineNormalizer.getChordAt(timeline, measureNo, b) || firstChord;
      if (!c) continue;

      // Four-on-the-floor kick
      _triggerDrum('kick', bTime, 0.85);

      // Bass: Root on beat, Octave on offbeat
      _playBassNote(c, bTime, secPerBeat * 0.45, 0.90);
      _playAlternatingBass(c, bTime + secPerBeat * 0.5, secPerBeat * 0.45, 0.78);

      // Open hi-hat on offbeat
      _triggerDrum('hihat', bTime + secPerBeat * 0.5, 0.70);

      // Snare on 2 and 4
      if (b === 2 || b === 4) {
        _triggerDrum('snare', bTime, 0.80);
        _playChordVoicing(c, bTime, secPerBeat * 0.7, 0.82);
      } else {
        _playChordVoicing(c, bTime, secPerBeat * 0.5, 0.65);
      }
    }
  }

  /**
   * 12. Smart Fox / Polka 2/4 (Tươi vui rộn rã)
   */
  function _scheduleFoxPolka(timeline, measureNo, audioTime, secPerBeat, firstChord) {
    const c1 = ChordTimelineNormalizer.getChordAt(timeline, measureNo, 1) || firstChord;
    const c2 = ChordTimelineNormalizer.getChordAt(timeline, measureNo, 2) || c1;

    // Beat 1: Bass Root + Kick
    if (c1) {
      _playBassNote(c1, audioTime, secPerBeat * 0.45, 0.92);
      _triggerDrum('kick', audioTime, 0.85);

      // Offbeat 1.5: Chord Staccato + Hihat
      _playChordVoicing(c1, audioTime + secPerBeat * 0.5, secPerBeat * 0.4, 0.75);
      _triggerDrum('hihat', audioTime + secPerBeat * 0.5, 0.65);
    }

    // Beat 2: Bass 5th + Snare
    if (c2) {
      _playAlternatingBass(c2, audioTime + secPerBeat, secPerBeat * 0.45, 0.85);
      _triggerDrum('snare', audioTime + secPerBeat, 0.80);

      // Offbeat 2.5: Chord Staccato + Hihat
      _playChordVoicing(c2, audioTime + secPerBeat * 1.5, secPerBeat * 0.4, 0.72);
      _triggerDrum('hihat', audioTime + secPerBeat * 1.5, 0.60);
    }
  }

  /**
   * 13. Smart Ballad 6/8 (Trang nghiêm trầm hùng)
   */
  function _scheduleBallad68(timeline, measureNo, audioTime, bpm, firstChord) {
    const stepDur = (60 / bpm) * 0.5;
    const c1 = ChordTimelineNormalizer.getChordAt(timeline, measureNo, 1) || firstChord;
    const c4 = ChordTimelineNormalizer.getChordAt(timeline, measureNo, 4) || c1;

    if (c1) {
      _playBassNote(c1, audioTime, stepDur * 3.0, 0.90);
      _playChordVoicing(c1, audioTime + 0.015, stepDur * 2.8, 0.75);
      _triggerDrum('kick', audioTime, 0.75);
      _triggerDrum('shaker', audioTime, 0.55);
      _playArpeggioStep(c1, audioTime + 2 * stepDur, 1, stepDur * 0.9, 0.58);
      _triggerDrum('shaker', audioTime + 2 * stepDur, 0.45);
    }

    if (c4) {
      _playAlternatingBass(c4, audioTime + 3 * stepDur, stepDur * 3.0, 0.82);
      _playChordVoicing(c4, audioTime + 3 * stepDur + 0.015, stepDur * 2.8, 0.72);
      _triggerDrum('snare', audioTime + 3 * stepDur, 0.70);
      _triggerDrum('shaker', audioTime + 3 * stepDur, 0.55);
      _playArpeggioStep(c4, audioTime + 5 * stepDur, 2, stepDur * 0.9, 0.55);
      _triggerDrum('shaker', audioTime + 5 * stepDur, 0.45);
    }
  }

  /* ─── Main Scheduling Dispatcher ─── */
  function _scheduleMeasure(measureNo, audioTime, bpm) {
    if (!_enabled || !window.VoicingEngine || !window.LearnSoundEngine) return;

    const timeline = window.LearnStore ? LearnStore.get('timeline') : [];
    if (!timeline || !timeline.length) return;

    const beatsPerMeasure = window.LearnStore?.get('_beats') || 4;
    const beatType = window.LearnStore?.get('_beatType') || 4;
    const secPerBeat = 60 / Math.max(20, bpm);
    const patternId = _activePatternId || 'smart-ballad';
    
    // Tìm hợp âm đầu ô nhịp; nếu ô nhịp chưa có (lấy đà hoặc ngân dài), tự động kế thừa hợp âm liền kề trước đó
    let firstChordInMeasure = ChordTimelineNormalizer.getChordAt(timeline, measureNo, 1);
    if (!firstChordInMeasure) {
      for (let m = measureNo - 1; m >= 1; m--) {
        firstChordInMeasure = ChordTimelineNormalizer.getChordAt(timeline, m, 1);
        if (firstChordInMeasure) break;
      }
    }
    if (!firstChordInMeasure && timeline.length > 0) {
      firstChordInMeasure = timeline[0];
    }

    // 1. Nhóm 6/8
    if (patternId === 'smart-slowrock-6-8' || ((beatsPerMeasure === 6 && beatType === 8) && patternId !== 'smart-ballad-6-8')) {
      _scheduleSlowRock68(timeline, measureNo, audioTime, bpm, firstChordInMeasure);
      return;
    }
    if (patternId === 'smart-ballad-6-8') {
      _scheduleBallad68(timeline, measureNo, audioTime, bpm, firstChordInMeasure);
      return;
    }

    // 2. Nhóm 3/4
    if (patternId === 'smart-boston') {
      _scheduleBoston(timeline, measureNo, audioTime, secPerBeat, firstChordInMeasure);
      return;
    }
    if (patternId === 'smart-joyful-waltz') {
      _scheduleJoyfulWaltz(timeline, measureNo, audioTime, secPerBeat, firstChordInMeasure);
      return;
    }
    if (beatsPerMeasure === 3 || patternId === 'smart-waltz') {
      _scheduleWaltz34(timeline, measureNo, audioTime, secPerBeat, firstChordInMeasure);
      return;
    }

    // 3. Nhóm 2/4
    if (patternId === 'smart-fox') {
      _scheduleFoxPolka(timeline, measureNo, audioTime, secPerBeat, firstChordInMeasure);
      return;
    }
    if (patternId === 'smart-march' || (beatsPerMeasure === 2 && beatType === 4 && patternId !== 'smart-ballad')) {
      _scheduleMarch(timeline, measureNo, audioTime, secPerBeat, beatsPerMeasure, firstChordInMeasure);
      return;
    }

    // 4. Nhóm 4/4 đặc thù
    if (patternId === 'smart-disco') {
      _scheduleDisco(timeline, measureNo, audioTime, secPerBeat, beatsPerMeasure, firstChordInMeasure);
      return;
    }
    if (patternId === 'smart-worship') {
      _scheduleWorshipArpeggio(timeline, measureNo, audioTime, secPerBeat, beatsPerMeasure, firstChordInMeasure);
      return;
    }
    if (patternId === 'smart-rumba') {
      _scheduleRumba(timeline, measureNo, audioTime, secPerBeat, firstChordInMeasure);
      return;
    }
    if (patternId === 'piano-block-4-4-v1') {
      _scheduleBlock(timeline, measureNo, audioTime, secPerBeat, beatsPerMeasure, firstChordInMeasure);
      return;
    }

    // 5. Organ / Hymn
    if (patternId === 'smart-hymn' || patternId === 'organ-church-4-4-v1') {
      _scheduleHymn(timeline, measureNo, audioTime, secPerBeat, beatsPerMeasure, firstChordInMeasure, patternId === 'organ-church-4-4-v1');
      return;
    }

    // 6. Mặc định: Smart Ballad 4/4
    _scheduleBallad44(timeline, measureNo, audioTime, secPerBeat, beatsPerMeasure, firstChordInMeasure);
  }

  /* ─── Transport Control ─── */
  function start() {
    if (!window.Tone) return;
    stop();
    _lastScheduledMeasure = -1;

    const transport = Tone.getTransport();
    _scheduledEventId = transport.scheduleRepeat((time) => {
      const measure = _getMeasureAtTime(time);
      const bpm = MusicTransport ? MusicTransport.getBpm() : transport.bpm.value;

      if (measure !== _lastScheduledMeasure) {
        _lastScheduledMeasure = measure;
        _scheduleMeasure(measure, time, bpm);
      }
    }, '1m');
  }

  function stop() {
    if (_scheduledEventId !== null && window.Tone) {
      Tone.getTransport().clear(_scheduledEventId);
      _scheduledEventId = null;
    }
    _lastScheduledMeasure = -1;

    if (window.VoicingEngine) VoicingEngine.reset();
    if (window.LearnSoundEngine) LearnSoundEngine.stopAll();
  }

  function pause() {
    if (window.LearnSoundEngine) LearnSoundEngine.stopAll();
  }

  return {
    init,
    setPattern,
    getActivePattern,
    setDensity,
    getDensity,
    setEnabled,
    isEnabled,
    start,
    stop,
    pause
  };
})();

if (typeof window !== 'undefined') {
  window.PatternEngine = PatternEngine;
}
