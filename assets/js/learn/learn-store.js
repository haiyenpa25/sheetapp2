/**
 * learn/learn-store.js — Stage 0: Learn State Namespace
 * Khởi tạo namespace Store.learn, không thay đổi Store core.
 * Phụ thuộc: core/Store.js, learn-interfaces.js (LEARN_FLAGS)
 */
const LearnStore = (() => {
  'use strict';

  /* ─── Default State ─────────────────────────────────────────── */
  const DEFAULT_STATE = {
    songId:          null,
    songTitle:       '',
    mode:            'piano',      // 'piano'|'organ'|'chord'|'satb'|'melody'
    difficulty:      'basic',
    chordSet:        'HD',
    patternId:       'piano-block-4-4-v1',
    instrumentPreset: 'piano-lite',
    bpm:             76,
    speed:           1.0,
    loop: {
      enabled:      false,
      startMeasure: null,
      endMeasure:   null,
    },
    current: {
      measure:  1,
      beat:     1,
      chord:    null,   // ChordTimelineEvent
      nextChord: null,  // ChordTimelineEvent
    },
    midi: {
      enabled: false,
      inputId: null,
    },
    uiStatus: 'idle', // LearnUIStatus
    timeline:  [],    // ChordTimelineEvent[]
  };

  let _state = JSON.parse(JSON.stringify(DEFAULT_STATE));

  /* ─── Getters ───────────────────────────────────────────────── */
  function get(key) {
    return key ? _state[key] : { ..._state };
  }

  function getCurrent() {
    return { ..._state.current };
  }

  function getLoop() {
    return { ..._state.loop };
  }

  /* ─── Setters ───────────────────────────────────────────────── */
  function set(key, value) {
    if (typeof key === 'object') {
      // Batch update
      Object.assign(_state, key);
    } else {
      _state[key] = value;
    }
  }

  function setCurrentPosition(measure, beat) {
    _state.current.measure = measure;
    _state.current.beat = beat;
  }

  function setCurrentChord(chord, nextChord = null) {
    _state.current.chord = chord;
    _state.current.nextChord = nextChord;
  }

  function setLoop(enabled, startMeasure = null, endMeasure = null) {
    _state.loop = { enabled, startMeasure, endMeasure };
  }

  function setTimeline(events) {
    _state.timeline = Array.isArray(events) ? events : [];
  }

  function setUiStatus(status) {
    _state.uiStatus = status;
  }

  /* ─── Reset ─────────────────────────────────────────────────── */
  function reset() {
    _state = JSON.parse(JSON.stringify(DEFAULT_STATE));
  }

  function resetForSong(songId, songTitle) {
    const preserve = {
      mode:             _state.mode,
      difficulty:       _state.difficulty,
      patternId:        _state.patternId,
      instrumentPreset: _state.instrumentPreset,
      bpm:              _state.bpm,
    };
    _state = JSON.parse(JSON.stringify(DEFAULT_STATE));
    Object.assign(_state, preserve);
    _state.songId    = songId;
    _state.songTitle = songTitle;
    _state.uiStatus  = 'song_selected';
  }

  /* ─── Persistence (localStorage) ───────────────────────────── */
  const STORAGE_KEY = 'sheetapp_learn_prefs';

  function savePreferences() {
    try {
      const prefs = {
        mode:             _state.mode,
        difficulty:       _state.difficulty,
        patternId:        _state.patternId,
        instrumentPreset: _state.instrumentPreset,
        bpm:              _state.bpm,
        chordSet:         _state.chordSet,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch (e) { /* ignore */ }
  }

  function loadPreferences() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const prefs = JSON.parse(raw);
      if (prefs.mode)             _state.mode             = prefs.mode;
      if (prefs.difficulty)       _state.difficulty       = prefs.difficulty;
      if (prefs.patternId)        _state.patternId        = prefs.patternId;
      if (prefs.instrumentPreset) _state.instrumentPreset = prefs.instrumentPreset;
      if (prefs.bpm)              _state.bpm              = prefs.bpm;
      if (prefs.chordSet)         _state.chordSet         = prefs.chordSet;
    } catch (e) { /* ignore */ }
  }

  /* ─── Public API ─────────────────────────────────────────────── */
  return {
    get, set,
    getCurrent, getLoop,
    setCurrentPosition, setCurrentChord, setLoop, setTimeline, setUiStatus,
    reset, resetForSong,
    savePreferences, loadPreferences,
  };
})();

if (typeof window !== 'undefined') {
  window.LearnStore = LearnStore;
}
