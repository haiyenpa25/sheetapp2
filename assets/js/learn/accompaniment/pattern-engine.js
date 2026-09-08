/**
 * learn/accompaniment/pattern-engine.js — Stage 5 & Phase 2: Smart Adaptive Accompaniment Engine
 *
 * Điều phối đệm thông minh tự thích ứng theo từng ô nhịp:
 * - Dậm bass & hợp âm chính xác tại từng phách đổi hợp âm của bản nhạc
 * - Tách bè 2 tay: Left Hand (Bass) và Right Hand (Voiced Chords)
 * - Tự động tạo thế đảo mượt mà (Smooth Voice Leading) qua VoicingEngine
 * - Micro-roll arpeggiation (12ms) tạo độ chân thực cho ngón tay đàn piano thật
 * - Humanized Velocity: Phách mạnh dậm chắc, phách nhẹ lướt êm
 *
 * Expose: window.PatternEngine
 */
const PatternEngine = (() => {
  'use strict';

  let _activePatternId = 'smart-ballad';
  let _enabled = true;
  let _scheduledEventId = null;
  let _lastScheduledMeasure = -1;

  function init() {
    const savedPattern = window.LearnStore?.get('patternId');
    if (savedPattern) {
      _activePatternId = savedPattern;
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

  function setEnabled(enabled) {
    _enabled = !!enabled;
    if (!_enabled && window.LearnSoundEngine) {
      LearnSoundEngine.stopAll();
    }
  }

  function isEnabled() {
    return _enabled;
  }

  /* ─── Private Helpers for Musical Voicing ─── */
  function _playBassNote(chordEvent, time, durationSec, velocity = 0.85, instrument = 'bass') {
    if (!window.LearnSoundEngine || !chordEvent) return;
    const symbol = chordEvent.transposedSymbol || chordEvent.symbol;
    const parsed = VoicingEngine.parseChord(symbol, chordEvent.bass);
    const bassName = parsed.bass || parsed.root || 'C';
    const targetOctave = 2; // C2 range
    const note = `${bassName}${targetOctave}`;
    LearnSoundEngine.triggerNote(instrument, note, durationSec, time, velocity, 'left');
  }

  function _playAlternatingBass(chordEvent, time, durationSec, velocity = 0.72, instrument = 'bass') {
    if (!window.LearnSoundEngine || !chordEvent) return;
    const symbol = chordEvent.transposedSymbol || chordEvent.symbol;
    const parsed = VoicingEngine.parseChord(symbol, chordEvent.bass);
    const fifthNote = parsed.notes[2] || parsed.root;
    const targetOctave = 2;
    const note = `${fifthNote}${targetOctave}`;
    LearnSoundEngine.triggerNote(instrument, note, durationSec, time, velocity, 'left');
  }

  function _playChordVoicing(chordEvent, time, durationSec, velocity = 0.70, instrument = 'piano') {
    if (!window.LearnSoundEngine || !window.VoicingEngine || !chordEvent) return;
    const symbol = chordEvent.transposedSymbol || chordEvent.symbol;
    const parsed = VoicingEngine.parseChord(symbol, chordEvent.bass);
    const targetCenter = 66; // F#4 center of gravity
    const midis = VoicingEngine.pickNearestInversion(parsed.notes, 4, targetCenter);

    midis.forEach((midi, idx) => {
      const noteName = window.Tonal ? Tonal.Note.fromMidi(midi) : 'C4';
      // Micro-roll spread: 12ms giữa các ngón tay tạo cảm giác đàn mộc
      const rollTime = time + (idx * 0.012);
      const noteVel  = Math.max(0.2, velocity * (0.95 + idx * 0.04));
      LearnSoundEngine.triggerNote(instrument, noteName, durationSec, rollTime, noteVel, 'right');
    });
  }

  function _playArpeggioStep(chordEvent, time, stepIdx, durationSec, velocity = 0.65, instrument = 'piano') {
    if (!window.LearnSoundEngine || !window.VoicingEngine || !chordEvent) return;
    const symbol = chordEvent.transposedSymbol || chordEvent.symbol;
    const parsed = VoicingEngine.parseChord(symbol, chordEvent.bass);
    const notes = parsed.notes || ['C', 'E', 'G'];
    const noteName = notes[stepIdx % notes.length];
    const octave = 4 + Math.floor(stepIdx / notes.length);
    const fullNote = `${noteName}${octave}`;
    LearnSoundEngine.triggerNote(instrument, fullNote, durationSec, time, velocity, 'right');
  }

  /* ─── Smart Adaptive Scheduling ─── */
  function _scheduleMeasure(measureNo, audioTime, bpm) {
    if (!_enabled || !window.VoicingEngine || !window.LearnSoundEngine) return;

    const timeline = window.LearnStore ? LearnStore.get('timeline') : [];
    if (!timeline || !timeline.length) return;

    const beatsPerMeasure = window.LearnStore?.get('_beats') || 4;
    const secPerBeat = 60 / Math.max(20, bpm);
    const patternId = _activePatternId || 'smart-ballad';

    const measureChords = timeline.filter(c => c.measure === measureNo);
    const firstChordInMeasure = ChordTimelineNormalizer.getChordAt(timeline, measureNo, 1);

    // 1. Nhịp 3/4 hoặc Style Smart Waltz
    if (beatsPerMeasure === 3 || patternId === 'smart-waltz') {
      const c1 = ChordTimelineNormalizer.getChordAt(timeline, measureNo, 1) || firstChordInMeasure;
      if (c1) {
        _playBassNote(c1, audioTime, secPerBeat * 2.2, 0.88);
        _playChordVoicing(c1, audioTime + 0.015, secPerBeat * 0.85, 0.72);
      }
      const c2 = ChordTimelineNormalizer.getChordAt(timeline, measureNo, 2) || c1;
      if (c2) {
        _playChordVoicing(c2, audioTime + secPerBeat, secPerBeat * 0.75, 0.58);
      }
      const c3 = ChordTimelineNormalizer.getChordAt(timeline, measureNo, 3) || c2;
      if (c3) {
        const isChordChange = (c3.symbol !== c2?.symbol);
        if (isChordChange) {
          _playBassNote(c3, audioTime + 2 * secPerBeat, secPerBeat * 0.9, 0.80);
          _playChordVoicing(c3, audioTime + 2 * secPerBeat + 0.01, secPerBeat * 0.75, 0.75);
        } else {
          _playChordVoicing(c3, audioTime + 2 * secPerBeat, secPerBeat * 0.75, 0.55);
        }
      }
      return;
    }

    // 2. Style Smart Worship Arpeggio
    if (patternId === 'smart-worship') {
      for (let b = 1; b <= beatsPerMeasure; b++) {
        const c = ChordTimelineNormalizer.getChordAt(timeline, measureNo, b) || firstChordInMeasure;
        if (!c) continue;
        const bTime = audioTime + (b - 1) * secPerBeat;
        if (b === 1 || b === 3) {
          _playBassNote(c, bTime, secPerBeat * 1.8, 0.82);
        }
        _playArpeggioStep(c, bTime, (b - 1) * 2, secPerBeat * 0.9, 0.68);
        _playArpeggioStep(c, bTime + secPerBeat * 0.5, (b - 1) * 2 + 1, secPerBeat * 0.9, 0.60);
      }
      return;
    }

    // 3. Style Smart Hymn / Church Organ Block
    if (patternId === 'smart-hymn' || patternId === 'organ-church-4-4-v1') {
      const isOrgan = patternId === 'organ-church-4-4-v1';
      const instr = isOrgan ? 'organ' : 'piano';
      const changePoints = measureChords.length > 0 ? measureChords : (firstChordInMeasure ? [firstChordInMeasure] : []);
      changePoints.forEach(c => {
        const beatOffset = Math.max(0, (c.beat || 1) - 1);
        const bTime = audioTime + beatOffset * secPerBeat;
        const durBeats = c.durationBeats || (beatsPerMeasure - beatOffset);
        const durSec = durBeats * secPerBeat * (isOrgan ? 0.98 : 0.92);

        _playBassNote(c, bTime, durSec, isOrgan ? 0.88 : 0.84, instr);
        _playChordVoicing(c, bTime + 0.015, durSec, isOrgan ? 0.80 : 0.75, instr);
      });
      return;
    }

    // 4. Style Smart Ballad Comping (Pop/Ballad tự thích ứng — Default)
    for (let b = 1; b <= beatsPerMeasure; b++) {
      const bTime = audioTime + (b - 1) * secPerBeat;
      const c = ChordTimelineNormalizer.getChordAt(timeline, measureNo, b) || firstChordInMeasure;
      if (!c) continue;

      const prevC = b > 1 ? ChordTimelineNormalizer.getChordAt(timeline, measureNo, b - 1) : null;
      const isChordChange = b === 1 || (prevC && c.symbol !== prevC.symbol);

      if (isChordChange) {
        const bassVel = b === 1 ? 0.86 : 0.78;
        _playBassNote(c, bTime, secPerBeat * 1.8, bassVel);
        _playChordVoicing(c, bTime + 0.012, secPerBeat * 0.88, 0.76);
      } else if (b === 3 && beatsPerMeasure === 4) {
        _playAlternatingBass(c, bTime, secPerBeat * 1.5, 0.72);
        _playChordVoicing(c, bTime + 0.01, secPerBeat * 0.85, 0.70);
      } else {
        const compVel = b === 2 ? 0.56 : 0.52;
        _playChordVoicing(c, bTime, secPerBeat * 0.78, compVel);
      }
    }
  }

  function start() {
    if (!window.Tone) return;
    stop();
    _lastScheduledMeasure = -1;

    const transport = Tone.getTransport();
    _scheduledEventId = transport.scheduleRepeat((time) => {
      const { measure } = MusicTransport.getMeasureBeat();
      const bpm = MusicTransport.getBpm();

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
