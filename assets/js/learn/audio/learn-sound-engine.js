/**
 * learn/audio/learn-sound-engine.js — Stage 5: Polyphonic Audio Sound Engine
 *
 * Chịu trách nhiệm tổng hợp âm thanh đa âm (Polyphonic synthesis) cho /learn studio:
 * - Piano Synth: Âm thanh êm dịu, ấm áp sử dụng triangle/sine waves
 * - Bass Synth: Trầm ấm, rõ ràng cho nốt bass đệm
 * - Organ Synth: Âm vang thánh ca, ngân dài
 * - Mixer: Điều chỉnh âm lượng độc lập cho từng nhạc cụ và master limiter
 *
 * Hoạt động 100% Client-Side trên Tone.js, không phụ thuộc server hay soundfont nặng.
 *
 * Expose: window.LearnSoundEngine
 */
const LearnSoundEngine = (() => {
  'use strict';

  let _initialized = false;

  // Audio nodes
  let _masterLimiter = null;
  let _pianoVolume   = null;
  let _bassVolume    = null;
  let _organVolume   = null;

  // Synths
  let _pianoSynth    = null;
  let _bassSynth     = null;
  let _organSynth    = null;

  /**
   * Khởi tạo các synth và routing chain
   */
  function init() {
    if (_initialized || !window.Tone) return;

    try {
      // 1. Master limiter bảo vệ tai nghe và loa không bị rè/clip
      _masterLimiter = new Tone.Limiter(-1).toDestination();

      // 2. Volume Channels
      _pianoVolume = new Tone.Volume(-2).connect(_masterLimiter);
      _bassVolume  = new Tone.Volume(-1).connect(_masterLimiter);
      _organVolume = new Tone.Volume(-4).connect(_masterLimiter);

      // 3. Piano PolySynth (Mô phỏng Piano điện tử ấm, mộc)
      _pianoSynth = new Tone.PolySynth(Tone.Synth, {
        maxPolyphony: 16,
        oscillator: {
          type: 'triangle'
        },
        envelope: {
          attack: 0.008,
          decay: 0.6,
          sustain: 0.25,
          release: 0.8
        }
      }).connect(_pianoVolume);

      // 4. Bass Synth (Nốt trầm sâu, rõ nét)
      _bassSynth = new Tone.PolySynth(Tone.Synth, {
        maxPolyphony: 4,
        oscillator: {
          type: 'triangle8'
        },
        envelope: {
          attack: 0.015,
          decay: 0.4,
          sustain: 0.35,
          release: 0.6
        }
      }).connect(_bassVolume);

      // 5. Organ PolySynth (Ngân vang, đầy đặn kiểu pipe/church organ)
      _organSynth = new Tone.PolySynth(Tone.Synth, {
        maxPolyphony: 12,
        oscillator: {
          type: 'sine8'
        },
        envelope: {
          attack: 0.06,
          decay: 0.2,
          sustain: 0.8,
          release: 1.2
        }
      }).connect(_organVolume);

      _initialized = true;
      console.log('[LearnSoundEngine] Audio engines initialized successfully');
    } catch (e) {
      console.warn('[LearnSoundEngine] Init failed (waiting for user gesture):', e);
    }
  }

  /**
   * Đảm bảo audio nodes đã sẵn sàng
   */
  function _ensureReady() {
    if (!_initialized) {
      init();
    }
  }

  /**
   * Phát 1 nốt nhạc cụ thể
   * @param {'piano'|'bass'|'organ'} instrument
   * @param {string} note - Vd: "C4", "G#2"
   * @param {number} durationSec - Thời lượng tính bằng giây
   * @param {number} time - Audio time (tương đối hoặc tuyệt đối từ Tone.Transport)
   * @param {number} velocity - 0.0 đến 1.0
   */
  function triggerNote(instrument, note, durationSec, time, velocity = 0.7) {
    _ensureReady();
    if (!note || durationSec <= 0) return;

    try {
      const dur = Math.max(0.05, durationSec);
      const vel = Math.max(0.1, Math.min(1.0, velocity));

      if (instrument === 'bass' && _bassSynth) {
        if (time !== undefined && time !== null) {
          _bassSynth.triggerAttackRelease(note, dur, time, vel);
        } else {
          _bassSynth.triggerAttackRelease(note, dur, undefined, vel);
        }
      } else if (instrument === 'organ' && _organSynth) {
        if (time !== undefined && time !== null) {
          _organSynth.triggerAttackRelease(note, dur, time, vel);
        } else {
          _organSynth.triggerAttackRelease(note, dur, undefined, vel);
        }
      } else if (_pianoSynth) {
        // Default: Piano
        if (time !== undefined && time !== null) {
          _pianoSynth.triggerAttackRelease(note, dur, time, vel);
        } else {
          _pianoSynth.triggerAttackRelease(note, dur, undefined, vel);
        }
      }
    } catch (e) {
      // Bỏ qua ngoại lệ scheduling nếu audio context đang đổi state
    }
  }

  /**
   * Dừng tất cả âm thanh đang ngân
   */
  function stopAll() {
    try {
      if (_pianoSynth) _pianoSynth.releaseAll();
      if (_bassSynth)  _bassSynth.releaseAll();
      if (_organSynth) _organSynth.releaseAll();
    } catch (e) { /* ignore */ }
  }

  /**
   * Cài đặt âm lượng cho từng kênh
   * @param {'master'|'piano'|'bass'|'organ'} channel
   * @param {number} db - Giá trị dB (-60 đến +6)
   */
  function setVolume(channel, db) {
    _ensureReady();
    const clampedDb = Math.max(-60, Math.min(6, db));
    switch (channel) {
      case 'piano':
        if (_pianoVolume) _pianoVolume.volume.value = clampedDb;
        break;
      case 'bass':
        if (_bassVolume) _bassVolume.volume.value = clampedDb;
        break;
      case 'organ':
        if (_organVolume) _organVolume.volume.value = clampedDb;
        break;
      case 'master':
        if (window.Tone) Tone.getDestination().volume.value = clampedDb;
        break;
    }
  }

  /**
   * Dọn dẹp tài nguyên khi unmount
   */
  function dispose() {
    stopAll();
    try {
      if (_pianoSynth) { _pianoSynth.dispose(); _pianoSynth = null; }
      if (_bassSynth)  { _bassSynth.dispose();  _bassSynth = null; }
      if (_organSynth) { _organSynth.dispose(); _organSynth = null; }
      if (_pianoVolume){ _pianoVolume.dispose(); _pianoVolume = null; }
      if (_bassVolume) { _bassVolume.dispose();  _bassVolume = null; }
      if (_organVolume){ _organVolume.dispose(); _organVolume = null; }
      if (_masterLimiter) { _masterLimiter.dispose(); _masterLimiter = null; }
      _initialized = false;
    } catch (e) { /* ignore */ }
  }

  return {
    init,
    triggerNote,
    stopAll,
    setVolume,
    dispose
  };
})();

if (typeof window !== 'undefined') {
  window.LearnSoundEngine = LearnSoundEngine;
}
