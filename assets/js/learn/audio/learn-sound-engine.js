/**
 * learn/audio/learn-sound-engine.js — Stage 5 & Phase 2: Professional Audio Sound Engine
 *
 * Chịu trách nhiệm tổng hợp âm thanh chuyên nghiệp cho /learn studio:
 * - Acoustic Grand Piano Multi-Sampler (Salamander Grand Piano samples)
 * - Cathedral Reverb: Không gian âm học thính phòng / thánh đường ngân vang
 * - Polyphonic Synth fallback: Ấm áp, mộc, zero-latency
 * - SATB Choir Synths: 4 bè Soprano, Alto, Tenor, Bass với Solo/Mute
 * - Metronome Audio Click: Tiếng gõ nhịp sắc nét (Ting / Cốc)
 * - Tách bè luyện tập (Hand Separation): Cả hai tay / Chỉ tay trái (Bass) / Chỉ tay phải (Hợp âm)
 *
 * Hoạt động 100% Client-Side trên Web Audio & Tone.js.
 *
 * Expose: window.LearnSoundEngine
 */
const LearnSoundEngine = (() => {
  'use strict';

  let _initialized = false;

  // Master & Effects
  let _masterLimiter = null;
  let _masterReverb  = null;
  let _pianoFilter   = null;

  // Volume Channels
  let _pianoVolume   = null;
  let _bassVolume    = null;
  let _organVolume   = null;
  let _drumVolume    = null;
  let _drumsEnabled  = true;

  // Piano Instruments: Sampler (Real Grand Piano) + PolySynth Fallback
  let _pianoSampler       = null;
  let _pianoSamplerLoaded = false;
  let _pianoSynth         = null;
  let _bassSynth          = null;
  let _organSynth         = null;

  // Metronome Synth
  let _metronomeSynth   = null;
  let _metronomeEnabled = false;

  // Drum & Percussion Synths
  let _kickSynth   = null;
  let _snareSynth  = null;
  let _hihatSynth  = null;
  let _shakerSynth = null;

  // Hand Separation Practice State: 'both' | 'left' | 'right'
  let _handPractice = 'both';

  // SATB Choir Synths & Volumes
  const _satbSynths = {
    soprano: null,
    alto:    null,
    tenor:   null,
    bass:    null
  };
  const _satbVolumes = {
    soprano: null,
    alto:    null,
    tenor:   null,
    bass:    null
  };
  const _satbState = {
    soprano: { muted: false, solo: false, vol: -2 },
    alto:    { muted: false, solo: false, vol: -2 },
    tenor:   { muted: false, solo: false, vol: -2 },
    bass:    { muted: false, solo: false, vol: -1.5 }
  };

  /**
   * Khởi tạo toàn bộ Audio Graph: Reverb, Sampler, Synths & Metronome
   */
  function init() {
    if (_initialized || !window.Tone) return;

    try {
      // 1. Master limiter bảo vệ tai nghe & loa
      _masterLimiter = new Tone.Limiter(-0.5).toDestination();

      // 2. Không gian Reverb Thính Phòng / Thánh Đường (Cathedral Reverb)
      // Tạo độ ngân vang sang trọng, sâu lắng cho piano và organ
      try {
        _masterReverb = new Tone.Reverb({
          decay: 2.2,
          preDelay: 0.02,
          wet: 0.30
        }).connect(_masterLimiter);
      } catch (e) {
        _masterReverb = new Tone.Freeverb({
          roomSize: 0.7,
          dampening: 3000,
          wet: 0.28
        }).connect(_masterLimiter);
      }

      // 3. Volume Channels
      _pianoVolume = new Tone.Volume(-1).connect(_masterReverb);
      _bassVolume  = new Tone.Volume(-1).connect(_masterLimiter); // Bass giữ punchy, trực tiếp
      _organVolume = new Tone.Volume(-3).connect(_masterReverb);

      // 4. Acoustic Grand Piano Multi-Sampler (Salamander Grand Piano samples)
      try {
        _pianoSampler = new Tone.Sampler({
          urls: {
            A1: 'A1.mp3',
            C3: 'C3.mp3',
            C4: 'C4.mp3',
            A4: 'A4.mp3',
            C5: 'C5.mp3',
            C6: 'C6.mp3'
          },
          baseUrl: 'https://tonejs.github.io/audio/salamander/',
          onload: () => {
            _pianoSamplerLoaded = true;
            console.log('[LearnSoundEngine] Acoustic Grand Piano multi-samples loaded successfully');
          },
          onerror: (err) => {
            console.warn('[LearnSoundEngine] Sampler failed, using warm PolySynth fallback', err);
            _pianoSamplerLoaded = false;
          }
        }).connect(_pianoVolume);
      } catch (e) {
        _pianoSamplerLoaded = false;
      }

      // 5. Warm Piano PolySynth (Fallback tức thì + phản hồi siêu nhạy)
      _pianoFilter = new Tone.Filter(4200, 'lowpass').connect(_pianoVolume);
      _pianoSynth = new Tone.PolySynth(Tone.Synth, {
        maxPolyphony: 24,
        oscillator: { type: 'triangle' },
        envelope: {
          attack: 0.005,
          decay: 1.2,
          sustain: 0.18,
          release: 1.2
        }
      }).connect(_pianoFilter);

      // 6. Bass Synth (Nốt trầm ấm, sâu, có lực)
      _bassSynth = new Tone.PolySynth(Tone.Synth, {
        maxPolyphony: 6,
        oscillator: { type: 'triangle8' },
        envelope: {
          attack: 0.012,
          decay: 0.6,
          sustain: 0.35,
          release: 0.8
        }
      }).connect(_bassVolume);

      // 7. Organ PolySynth (Ngân vang trang nghiêm phong cách pipe/church organ)
      _organSynth = new Tone.PolySynth(Tone.Synth, {
        maxPolyphony: 16,
        oscillator: { type: 'sine8' },
        envelope: {
          attack: 0.06,
          decay: 0.3,
          sustain: 0.85,
          release: 1.4
        }
      }).connect(_organVolume);

      // 8. SATB Choir PolySynths
      _satbVolumes.soprano = new Tone.Volume(-2).connect(_masterReverb);
      _satbVolumes.alto    = new Tone.Volume(-2).connect(_masterReverb);
      _satbVolumes.tenor   = new Tone.Volume(-2).connect(_masterReverb);
      _satbVolumes.bass    = new Tone.Volume(-1.5).connect(_masterLimiter);

      _satbSynths.soprano = new Tone.PolySynth(Tone.Synth, {
        maxPolyphony: 8,
        oscillator: { type: 'sine' },
        envelope: { attack: 0.04, decay: 0.35, sustain: 0.7, release: 0.8 }
      }).connect(_satbVolumes.soprano);

      _satbSynths.alto = new Tone.PolySynth(Tone.Synth, {
        maxPolyphony: 8,
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.04, decay: 0.35, sustain: 0.65, release: 0.8 }
      }).connect(_satbVolumes.alto);

      _satbSynths.tenor = new Tone.PolySynth(Tone.Synth, {
        maxPolyphony: 8,
        oscillator: { type: 'triangle8' },
        envelope: { attack: 0.04, decay: 0.35, sustain: 0.7, release: 0.85 }
      }).connect(_satbVolumes.tenor);

      _satbSynths.bass = new Tone.PolySynth(Tone.Synth, {
        maxPolyphony: 8,
        oscillator: { type: 'fatsawtooth', spread: 15, count: 2 },
        envelope: { attack: 0.05, decay: 0.4, sustain: 0.75, release: 0.9 }
      }).connect(_satbVolumes.bass);

      // 9. Metronome Synth: Tiếng gõ gỗ / Click giòn tan
      _metronomeSynth = new Tone.MembraneSynth({
        pitchDecay: 0.005,
        octaves: 2,
        oscillator: { type: 'sine' },
        envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.05 }
      }).connect(_masterLimiter);

      // 10. Acoustic Rhythm & Drum Kit (Mộc mạc, ấm áp cho Ballad & Thánh Ca)
      _drumVolume = new Tone.Volume(-6).connect(_masterLimiter);

      // Acoustic Kick (Trầm ấm, tròn tiếng, không gắt)
      _kickSynth = new Tone.MembraneSynth({
        pitchDecay: 0.04,
        octaves: 3,
        oscillator: { type: 'sine' },
        envelope: { attack: 0.002, decay: 0.28, sustain: 0, release: 0.2 }
      }).connect(_drumVolume);

      // Soft Snare / Brush (Mặt trống chổi mềm mại, trữ tình)
      const snareFilter = new Tone.Filter(2800, 'lowpass').connect(_drumVolume);
      _snareSynth = new Tone.NoiseSynth({
        noise: { type: 'pink' },
        envelope: { attack: 0.005, decay: 0.14, sustain: 0, release: 0.05 }
      }).connect(snareFilter);

      // Acoustic Hi-hat (Gõ nhẹ nhàng giữ phách)
      const hihatFilter = new Tone.Filter(7000, 'highpass').connect(_drumVolume);
      _hihatSynth = new Tone.NoiseSynth({
        noise: { type: 'white' },
        envelope: { attack: 0.001, decay: 0.035, sustain: 0, release: 0.02 }
      }).connect(hihatFilter);

      // Silky Shaker (Bộ gõ lắc cát mềm mại cho Ballad/Slow Rock)
      const shakerFilter = new Tone.Filter(4500, 'bandpass').connect(_drumVolume);
      _shakerSynth = new Tone.NoiseSynth({
        noise: { type: 'white' },
        envelope: { attack: 0.015, decay: 0.06, sustain: 0, release: 0.03 }
      }).connect(shakerFilter);

      _initialized = true;
      console.log('[LearnSoundEngine] Professional Audio Engine + Grand Piano + Reverb + Rhythm Drums ready');
    } catch (e) {
      console.warn('[LearnSoundEngine] Init failed (awaiting user gesture):', e);
    }
  }

  function _ensureReady() {
    if (!_initialized) init();
  }

  /* ─── Hand Practice Separation ───────────────────────────────── */
  function setHandPractice(mode) {
    if (mode === 'both' || mode === 'left' || mode === 'right') {
      _handPractice = mode;
      console.log('[LearnSoundEngine] Hand practice set to:', mode);
    }
  }

  function getHandPractice() {
    return _handPractice;
  }

  function isHandAudible(hand) {
    if (!hand || _handPractice === 'both') return true;
    if (_handPractice === 'left' && hand === 'left') return true;
    if (_handPractice === 'right' && hand === 'right') return true;
    return false;
  }

  /* ─── Metronome Click ────────────────────────────────────────── */
  function setMetronomeEnabled(enabled) {
    _metronomeEnabled = !!enabled;
  }

  function isMetronomeEnabled() {
    return _metronomeEnabled;
  }

  function toggleMetronome() {
    _metronomeEnabled = !_metronomeEnabled;
    return _metronomeEnabled;
  }

  function isSamplerLoaded() {
    return _pianoSamplerLoaded;
  }

  function playMetronomeClick(beatIndex, isDownbeat = false, time = undefined) {
    if (!_metronomeEnabled) return;
    _ensureReady();
    if (!_metronomeSynth) return;

    try {
      const note = isDownbeat ? 'G5' : 'C5';
      const vel  = isDownbeat ? 0.9 : 0.6;
      if (time !== undefined && time !== null) {
        _metronomeSynth.triggerAttackRelease(note, '32n', time, vel);
      } else {
        _metronomeSynth.triggerAttackRelease(note, '32n', undefined, vel);
      }
    } catch (e) {}
  }

  /* ─── Drum & Percussion Triggering ───────────────────────────── */
  function triggerDrum(type, time = undefined, velocity = 0.7) {
    if (!_drumsEnabled) return;
    _ensureReady();

    const vel = Math.max(0.1, Math.min(1.0, velocity));
    try {
      if (type === 'kick' && _kickSynth) {
        _kickSynth.triggerAttackRelease('C1', '8n', time, vel);
      } else if ((type === 'snare' || type === 'rimshot') && _snareSynth) {
        _snareSynth.triggerAttackRelease('16n', time, vel * 0.85);
      } else if (type === 'hihat' && _hihatSynth) {
        _hihatSynth.triggerAttackRelease('32n', time, vel * 0.6);
      } else if (type === 'shaker' && _shakerSynth) {
        _shakerSynth.triggerAttackRelease('16n', time, vel * 0.65);
      }
    } catch (e) {}
  }

  function setDrumsEnabled(enabled) {
    _drumsEnabled = !!enabled;
  }

  function isDrumsEnabled() {
    return _drumsEnabled;
  }

  /* ─── Note Triggering with Humanized Dynamics ────────────────── */
  /**
   * Phát 1 nốt nhạc cụ thể
   * @param {'piano'|'bass'|'organ'} instrument
   * @param {string} note - Vd: "C4", "G#2"
   * @param {number} durationSec - Thời lượng tính bằng giây
   * @param {number} time - Audio time (Web Audio clock)
   * @param {number} velocity - 0.0 đến 1.0
   * @param {'left'|'right'|null} hand - Phân loại tay để tách bè luyện tập
   */
  function triggerNote(instrument, note, durationSec, time, velocity = 0.7, hand = null) {
    _ensureReady();
    if (!note || durationSec <= 0) return;

    // Kiểm tra chế độ luyện tập tách tay
    if (hand && !isHandAudible(hand)) return;

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
      } else {
        // Piano: Ưu tiên Acoustic Grand Piano Sampler, fallback sang PolySynth
        if (_pianoSamplerLoaded && _pianoSampler) {
          if (time !== undefined && time !== null) {
            _pianoSampler.triggerAttackRelease(note, dur, time, vel);
          } else {
            _pianoSampler.triggerAttackRelease(note, dur, undefined, vel);
          }
        } else if (_pianoSynth) {
          if (time !== undefined && time !== null) {
            _pianoSynth.triggerAttackRelease(note, dur, time, vel);
          } else {
            _pianoSynth.triggerAttackRelease(note, dur, undefined, vel);
          }
        }
      }
    } catch (e) {}
  }

  /* ─── SATB Choir Control ─────────────────────────────────────── */
  function isSatbAudible(voice) {
    const v = _satbState[voice];
    if (!v) return false;
    const anySolo = Object.values(_satbState).some(s => s.solo);
    if (anySolo) return v.solo;
    return !v.muted;
  }

  function triggerSatbNote(voice, note, durationSec, time, velocity = 0.7) {
    _ensureReady();
    if (!note || durationSec <= 0) return;
    if (!isSatbAudible(voice)) return;

    const synth = _satbSynths[voice];
    if (!synth) return;

    try {
      const dur = Math.max(0.05, durationSec);
      const vel = Math.max(0.1, Math.min(1.0, velocity));
      if (time !== undefined && time !== null) {
        synth.triggerAttackRelease(note, dur, time, vel);
      } else {
        synth.triggerAttackRelease(note, dur, undefined, vel);
      }
    } catch (e) {}
  }

  function setSatbMute(voice, isMuted) {
    if (_satbState[voice]) {
      _satbState[voice].muted = !!isMuted;
      if (isMuted && _satbSynths[voice]) {
        try { _satbSynths[voice].releaseAll(); } catch (e) {}
      }
    }
  }

  function setSatbSolo(voice, isSolo) {
    if (_satbState[voice]) {
      _satbState[voice].solo = !!isSolo;
      Object.keys(_satbState).forEach(vKey => {
        if (!isSatbAudible(vKey) && _satbSynths[vKey]) {
          try { _satbSynths[vKey].releaseAll(); } catch (e) {}
        }
      });
    }
  }

  function setSatbVolume(voice, db) {
    _ensureReady();
    if (_satbState[voice]) {
      _satbState[voice].vol = db;
      const volNode = _satbVolumes[voice];
      if (volNode) {
        volNode.volume.value = Math.max(-60, Math.min(6, db));
      }
    }
  }

  function getSatbState() {
    return JSON.parse(JSON.stringify(_satbState));
  }

  /* ─── Stop & Master Controls ─────────────────────────────────── */
  function stopAll() {
    try {
      if (_pianoSynth) _pianoSynth.releaseAll();
      if (_bassSynth)  _bassSynth.releaseAll();
      if (_organSynth) _organSynth.releaseAll();
      if (_pianoSampler) _pianoSampler.releaseAll();
      Object.values(_satbSynths).forEach(synth => {
        if (synth) synth.releaseAll();
      });
    } catch (e) {}
  }

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
      case 'drum':
        if (_drumVolume) _drumVolume.volume.value = clampedDb;
        break;
      case 'master':
        if (window.Tone) Tone.getDestination().volume.value = clampedDb;
        break;
    }
  }

  function setReverbWet(wet) {
    _ensureReady();
    if (_masterReverb) {
      _masterReverb.wet.value = Math.max(0, Math.min(1, wet));
    }
  }

  function dispose() {
    stopAll();
    try {
      if (_pianoSynth)   { _pianoSynth.dispose();   _pianoSynth = null; }
      if (_pianoSampler) { _pianoSampler.dispose(); _pianoSampler = null; }
      if (_bassSynth)    { _bassSynth.dispose();    _bassSynth = null; }
      if (_organSynth)   { _organSynth.dispose();   _organSynth = null; }
      if (_metronomeSynth) { _metronomeSynth.dispose(); _metronomeSynth = null; }
      if (_kickSynth)    { _kickSynth.dispose();    _kickSynth = null; }
      if (_snareSynth)   { _snareSynth.dispose();   _snareSynth = null; }
      if (_hihatSynth)   { _hihatSynth.dispose();   _hihatSynth = null; }
      if (_shakerSynth)  { _shakerSynth.dispose();  _shakerSynth = null; }
      if (_pianoVolume)  { _pianoVolume.dispose();  _pianoVolume = null; }
      if (_bassVolume)   { _bassVolume.dispose();   _bassVolume = null; }
      if (_organVolume)  { _organVolume.dispose();  _organVolume = null; }
      if (_drumVolume)   { _drumVolume.dispose();   _drumVolume = null; }
      if (_masterReverb) { _masterReverb.dispose(); _masterReverb = null; }
      if (_masterLimiter){ _masterLimiter.dispose();_masterLimiter = null; }
      Object.keys(_satbSynths).forEach(k => {
        if (_satbSynths[k]) { _satbSynths[k].dispose(); _satbSynths[k] = null; }
      });
      Object.keys(_satbVolumes).forEach(k => {
        if (_satbVolumes[k]) { _satbVolumes[k].dispose(); _satbVolumes[k] = null; }
      });
      _initialized = false;
    } catch (e) {}
  }

  return {
    init,
    triggerNote,
    triggerSatbNote,
    triggerDrum,
    setDrumsEnabled,
    isDrumsEnabled,
    setSatbMute,
    setSatbSolo,
    setSatbVolume,
    getSatbState,
    isSatbAudible,
    setHandPractice,
    getHandPractice,
    isHandAudible,
    setMetronomeEnabled,
    isMetronomeEnabled,
    toggleMetronome,
    isSamplerLoaded,
    playMetronomeClick,
    setReverbWet,
    stopAll,
    setVolume,
    dispose
  };
})();

if (typeof window !== 'undefined') {
  window.LearnSoundEngine = LearnSoundEngine;
}
