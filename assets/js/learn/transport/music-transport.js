/**
 * learn/transport/music-transport.js — Stage 3: Music Transport Layer
 *
 * Wraps Tone.js Transport để cung cấp unified clock cho /learn.
 * Tất cả components (metronome, pattern engine, cursor) đều dùng chung transport này.
 *
 * Audio clock = source of truth. Visual = follow audio clock.
 * KHÔNG dùng setInterval làm timing âm nhạc.
 *
 * Phụ thuộc: Tone.js (window.Tone), LEARN_EVENTS, EventBus
 */
const MusicTransport = (() => {
  'use strict';

  /* ─── State ──────────────────────────────────────────────────── */
  let _state = 'stopped'; // 'stopped' | 'playing' | 'paused'
  let _bpm = 76;
  let _startMeasure = 1;
  let _totalMeasures = 0;
  let _beatsPerMeasure = 4;
  let _beatType = 4;

  // Loop
  let _loopEnabled = false;
  let _loopStart = null; // measure
  let _loopEnd   = null; // measure

  // Scheduled callbacks
  const _beatCallbacks = new Set();
  const _measureCallbacks = new Set();

  // Tone.Part reference
  let _part = null;
  let _countInPart = null;
  let _audioCtx = null;

  /* ─── Audio Context Gate ─────────────────────────────────────── */
  function _ensureAudioContext() {
    if (!window.Tone) {
      console.warn('[MusicTransport] Tone.js chưa load');
      return false;
    }
    // Tone.start() cần được gọi từ user gesture
    return true;
  }

  async function unlock() {
    if (!_ensureAudioContext()) return false;
    try {
      await Tone.start();
      return true;
    } catch (e) {
      console.error('[MusicTransport] Tone.start() failed:', e);
      return false;
    }
  }

  /* ─── Configuration ──────────────────────────────────────────── */
  function configure({ bpm, beatsPerMeasure, beatType, totalMeasures }) {
    _bpm             = bpm             ?? _bpm;
    _beatsPerMeasure = beatsPerMeasure ?? _beatsPerMeasure;
    _beatType        = beatType        ?? _beatType;
    _totalMeasures   = totalMeasures   ?? _totalMeasures;

    if (window.Tone) {
      Tone.getTransport().bpm.value = _bpm;
      Tone.getTransport().timeSignature = _beatsPerMeasure;
    }
  }

  function setBpm(bpm) {
    _bpm = Math.max(20, Math.min(300, bpm));
    if (window.Tone) {
      Tone.getTransport().bpm.value = _bpm;
    }
  }

  function setLoop(enabled, startMeasure = null, endMeasure = null) {
    _loopEnabled = enabled;
    _loopStart   = startMeasure;
    _loopEnd     = endMeasure;

    if (!window.Tone) return;
    const T = Tone.getTransport();

    if (enabled && startMeasure !== null && endMeasure !== null) {
      // Convert measures to Tone time notation "Xm" (measures)
      T.setLoopPoints(`${startMeasure - 1}m`, `${endMeasure}m`);
      T.loop = true;
    } else {
      T.loop = false;
    }

    if (window.EventBus) {
      EventBus.emit(LEARN_EVENTS.LOOP_CHANGED, { enabled, startMeasure, endMeasure });
    }
  }

  /* ─── Playback Control ───────────────────────────────────────── */
  async function play(fromMeasure = null) {
    if (!_ensureAudioContext()) return;
    await unlock();

    if (!window.Tone) return;
    const T = Tone.getTransport();

    if (fromMeasure !== null) {
      // Seek to measure
      const measureTime = `${fromMeasure - 1}m`;
      T.position = measureTime;
    }

    T.start();
    _state = 'playing';

    if (window.EventBus) EventBus.emit(LEARN_EVENTS.PLAY, {});
  }

  function pause() {
    if (!window.Tone) return;
    Tone.getTransport().pause();
    _state = 'paused';
    if (window.EventBus) EventBus.emit(LEARN_EVENTS.PAUSE, {});
  }

  function stop() {
    if (!window.Tone) return;
    const T = Tone.getTransport();
    T.stop();
    T.position = 0;
    _state = 'stopped';
    if (window.EventBus) EventBus.emit(LEARN_EVENTS.STOP, {});
  }

  function togglePlay() {
    if (_state === 'playing') pause();
    else play();
  }

  /* ─── Position Query ─────────────────────────────────────────── */
  function getPositionSeconds() {
    if (!window.Tone) return 0;
    return Tone.getTransport().seconds;
  }

  function getMeasureBeat() {
    if (!window.Tone) return { measure: 1, beat: 1 };
    const pos = Tone.getTransport().position; // format "Bars:Beats:Sixteenth"
    const parts = String(pos).split(':').map(Number);
    const bars  = parts[0] || 0; // 0-indexed bars
    const beats = parts[1] || 0; // 0-indexed beats within bar
    return {
      measure: bars + 1,
      beat:    beats + 1,
    };
  }

  /* ─── Callback Registration ──────────────────────────────────── */

  /**
   * Đăng ký callback gọi mỗi beat.
   * @param {Function} cb - fn({ measure, beat, timeSeconds })
   * @returns {Function} unsubscribe
   */
  function onBeat(cb) {
    _beatCallbacks.add(cb);
    return () => _beatCallbacks.delete(cb);
  }

  /**
   * Đăng ký callback gọi khi đổi measure.
   * @param {Function} cb - fn({ measure, timeSeconds })
   * @returns {Function} unsubscribe
   */
  function onMeasure(cb) {
    _measureCallbacks.add(cb);
    return () => _measureCallbacks.delete(cb);
  }

  /**
   * Setup Tone.js repeat để fire callbacks.
   * Phải gọi sau configure() và trước play().
   */
  function setupTicker() {
    if (!window.Tone) return;
    const T = Tone.getTransport();

    // Remove old ticker
    if (_part) { _part.dispose(); _part = null; }

    // Schedule beat ticker using Tone.Sequence
    let lastMeasure = -1;
    T.scheduleRepeat((time) => {
      const { measure, beat } = getMeasureBeat();
      const timeSeconds = T.seconds;

      // Beat callbacks
      _beatCallbacks.forEach(cb => {
        try { cb({ measure, beat, timeSeconds }); } catch (e) { /* ignore */ }
      });

      // Measure callbacks (fire once per measure change)
      if (measure !== lastMeasure) {
        lastMeasure = measure;
        _measureCallbacks.forEach(cb => {
          try { cb({ measure, timeSeconds }); } catch (e) { /* ignore */ }
        });

        // Emit EventBus
        if (window.EventBus) {
          EventBus.emit(LEARN_EVENTS.POSITION_CHANGED, { measure, beat, timeSeconds });
        }
      }
    }, `${_beatType || 4}n`); // Every beat
  }

  /* ─── Count-in ───────────────────────────────────────────────── */
  async function playWithCountIn(beats = 4) {
    if (!_ensureAudioContext()) return;
    await unlock();
    if (!window.Tone) return;

    // Delegate to CountInEngine nếu có
    if (window.CountInEngine?.playCountIn) {
      await window.CountInEngine.playCountIn({ beats, bpm: _bpm });
    } else {
      // Simple built-in count-in via Tone
      await _simpleCountIn(beats);
    }

    // Start after count-in
    play();
  }

  async function _simpleCountIn(beats) {
    return new Promise(resolve => {
      let count = 0;
      const interval = (60 / _bpm) * 1000; // ms per beat
      const tick = () => {
        count++;
        if (count >= beats) resolve();
        else setTimeout(tick, interval);
      };
      setTimeout(tick, interval);
    });
  }

  /* ─── Cleanup ────────────────────────────────────────────────── */
  function dispose() {
    stop();
    if (_part) { _part.dispose(); _part = null; }
    _beatCallbacks.clear();
    _measureCallbacks.clear();
    if (window.Tone) {
      Tone.getTransport().cancel();
    }
  }

  /* ─── Getters ────────────────────────────────────────────────── */
  function getState() { return _state; }
  function getBpm()   { return _bpm; }
  function isPlaying(){ return _state === 'playing'; }

  /* ─── Public API ─────────────────────────────────────────────── */
  return {
    configure, setBpm, setLoop,
    play, pause, stop, togglePlay, playWithCountIn,
    unlock,
    onBeat, onMeasure, setupTicker,
    getPositionSeconds, getMeasureBeat,
    getState, getBpm, isPlaying,
    dispose,
  };
})();

if (typeof window !== 'undefined') {
  window.MusicTransport = MusicTransport;
}
