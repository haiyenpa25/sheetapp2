/**
 * assets/js/performance/ambient-pad-engine.js — SheetApp Worship Ambient Pad Synth
 * 
 * Generates continuous, lush, seamless worship ambient pad drone (Root + 5th)
 * using Web Audio API synthesis (zero MP3 download required).
 * 
 * Features:
 * - 4 Harmonic layers: Sub Sine, Warm Filtered Sawtooth, Choral Shimmer Triangle with LFO, Air Texture
 * - Smooth exponential crossfade (3.5s fade-out, 4.0s fade-in) on song or key change
 * - Dual-channel In-Ear support: can pan pad to Right Channel (+1.0) for stereo split
 */
const AmbientPadEngine = (() => {
  'use strict';

  // Base frequencies (Octave 3) for the 12 chromatic pitches
  const KEY_FREQS = {
    'C':  130.81, 'C#': 138.59, 'Db': 138.59,
    'D':  146.83, 'D#': 155.56, 'Eb': 155.56,
    'E':  164.81,
    'F':  174.61, 'F#': 185.00, 'Gb': 185.00,
    'G':  196.00, 'G#': 207.65, 'Ab': 207.65,
    'A':  220.00, 'A#': 233.08, 'Bb': 233.08,
    'B':  246.94
  };

  // Semitone offsets to find Perfect 5th (7 semitones above Root)
  const SEMITONE_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

  let _audioCtx       = null;
  let _masterGain     = null;
  let _pannerNode     = null;
  let _activeKey      = null;
  let _isPlaying      = false;
  let _masterVolume   = 0.65;
  let _stereoSplit    = false; // If true, pan to Right channel (+1.0)
  let _activeNodes    = [];

  function _getAudioContext() {
    if (!_audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        _audioCtx = new AudioContextClass();
      }
    }
    if (_audioCtx && _audioCtx.state === 'suspended') {
      _audioCtx.resume().catch(() => {});
    }
    return _audioCtx;
  }

  function _initMaster() {
    const ctx = _getAudioContext();
    if (!ctx || _masterGain) return;

    _masterGain = ctx.createGain();
    _masterGain.gain.setValueAtTime(_masterVolume, ctx.currentTime);

    // Stereo Panner (or Channel Merger fallback)
    if (ctx.createStereoPanner) {
      _pannerNode = ctx.createStereoPanner();
      _pannerNode.pan.setValueAtTime(_stereoSplit ? 1.0 : 0.0, ctx.currentTime);
      _masterGain.connect(_pannerNode);
      _pannerNode.connect(ctx.destination);
    } else {
      _masterGain.connect(ctx.destination);
    }
  }

  function _getRootAndFifthFreq(key) {
    if (!key) return { root: 130.81, fifth: 196.00 };

    // Normalize key (strip 'm', 'maj', etc. to get root note)
    const match = key.trim().match(/^([A-G][#b]?)/i);
    let note = match ? match[1].toUpperCase() : 'C';
    if (note === 'DB') note = 'Db';
    if (note === 'EB') note = 'Eb';
    if (note === 'GB') note = 'Gb';
    if (note === 'AB') note = 'Ab';
    if (note === 'BB') note = 'Bb';

    const rootFreq = KEY_FREQS[note] || 130.81;

    // Find Perfect 5th (root * 1.498307 approx 1.5)
    const fifthFreq = rootFreq * 1.49830707688;
    return { root: rootFreq, fifth: fifthFreq };
  }

  /**
   * Create a multi-layered drone cluster for a given pitch
   */
  function _createVoiceCluster(ctx, rootFreq, fifthFreq) {
    const clusterGain = ctx.createGain();
    clusterGain.gain.setValueAtTime(0.0001, ctx.currentTime);

    const oscillators = [];

    // Layer 1: Sub Bass (Root / 2) — Deep warm foundation
    const subOsc = ctx.createOscillator();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(rootFreq / 2, ctx.currentTime);
    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(0.35, ctx.currentTime);
    subOsc.connect(subGain);
    subGain.connect(clusterGain);
    oscillators.push(subOsc);

    // Layer 2: Warm Body Sawtooth (Root) filtered
    const sawOsc = ctx.createOscillator();
    sawOsc.type = 'sawtooth';
    sawOsc.frequency.setValueAtTime(rootFreq, ctx.currentTime);
    // Slight detune for analog warmth (+3 cents)
    sawOsc.detune.setValueAtTime(3, ctx.currentTime);

    const sawFilter = ctx.createBiquadFilter();
    sawFilter.type = 'lowpass';
    sawFilter.frequency.setValueAtTime(380, ctx.currentTime); // Cut harsh highs
    sawFilter.Q.setValueAtTime(1.2, ctx.currentTime);

    const sawGain = ctx.createGain();
    sawGain.gain.setValueAtTime(0.22, ctx.currentTime);

    sawOsc.connect(sawFilter);
    sawFilter.connect(sawGain);
    sawGain.connect(clusterGain);
    oscillators.push(sawOsc);

    // Layer 3: Perfect 5th Sawtooth filtered
    const fifthOsc = ctx.createOscillator();
    fifthOsc.type = 'sawtooth';
    fifthOsc.frequency.setValueAtTime(fifthFreq, ctx.currentTime);
    fifthOsc.detune.setValueAtTime(-3, ctx.currentTime); // -3 cents

    const fifthFilter = ctx.createBiquadFilter();
    fifthFilter.type = 'lowpass';
    fifthFilter.frequency.setValueAtTime(420, ctx.currentTime);
    fifthFilter.Q.setValueAtTime(1.0, ctx.currentTime);

    const fifthGain = ctx.createGain();
    fifthGain.gain.setValueAtTime(0.18, ctx.currentTime);

    fifthOsc.connect(fifthFilter);
    fifthFilter.connect(fifthGain);
    fifthGain.connect(clusterGain);
    oscillators.push(fifthOsc);

    // Layer 4: Choral Shimmer (Octave Triangle with LFO)
    const shimmerOsc = ctx.createOscillator();
    shimmerOsc.type = 'triangle';
    shimmerOsc.frequency.setValueAtTime(rootFreq * 2, ctx.currentTime);

    // LFO for slow breath modulation
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(0.18, ctx.currentTime); // 0.18 Hz slow cycle
    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(4.0, ctx.currentTime); // +/- 4 cents detune
    lfo.connect(lfoGain);
    lfoGain.connect(shimmerOsc.detune);

    const shimmerFilter = ctx.createBiquadFilter();
    shimmerFilter.type = 'bandpass';
    shimmerFilter.frequency.setValueAtTime(650, ctx.currentTime);
    shimmerFilter.Q.setValueAtTime(2.0, ctx.currentTime);

    const shimmerGain = ctx.createGain();
    shimmerGain.gain.setValueAtTime(0.12, ctx.currentTime);

    shimmerOsc.connect(shimmerFilter);
    shimmerFilter.connect(shimmerGain);
    shimmerGain.connect(clusterGain);
    oscillators.push(shimmerOsc, lfo);

    // Connect cluster to master
    _initMaster();
    clusterGain.connect(_masterGain);

    const startTime = ctx.currentTime;
    oscillators.forEach(osc => osc.start(startTime));

    return {
      gainNode: clusterGain,
      oscillators,
      stop: (fadeTime = 3.5) => {
        const now = ctx.currentTime;
        try {
          clusterGain.gain.cancelScheduledValues(now);
          clusterGain.gain.setValueAtTime(clusterGain.gain.value, now);
          clusterGain.gain.exponentialRampToValueAtTime(0.00001, now + fadeTime);
          setTimeout(() => {
            oscillators.forEach(osc => {
              try { osc.stop(); osc.disconnect(); } catch (e) {}
            });
            try { clusterGain.disconnect(); } catch (e) {}
          }, (fadeTime + 0.1) * 1000);
        } catch (e) {}
      }
    };
  }

  /**
   * Play or Crossfade to a specific Musical Key (e.g. 'C', 'G', 'D', 'A')
   */
  function playKey(key, crossfade = true) {
    if (!key) return;
    const ctx = _getAudioContext();
    if (!ctx) return;

    _initMaster();

    // If already playing this key, nothing to do
    if (_isPlaying && _activeKey === key) return;

    const { root, fifth } = _getRootAndFifthFreq(key);
    const newCluster = _createVoiceCluster(ctx, root, fifth);

    const now = ctx.currentTime;
    const fadeInDuration = crossfade ? 3.8 : 0.8;
    const fadeOutDuration = crossfade ? 3.2 : 0.6;

    // Fade in new cluster
    newCluster.gainNode.gain.cancelScheduledValues(now);
    newCluster.gainNode.gain.setValueAtTime(0.0001, now);
    newCluster.gainNode.gain.exponentialRampToValueAtTime(1.0, now + fadeInDuration);

    // Fade out previous clusters
    if (_activeNodes.length > 0) {
      _activeNodes.forEach(node => {
        node.stop(fadeOutDuration);
      });
      _activeNodes = [];
    }

    _activeNodes.push(newCluster);
    _activeKey = key;
    _isPlaying = true;

    console.log(`[AmbientPadEngine] Playing key: ${key} (Fade-in: ${fadeInDuration}s)`);
  }

  /**
   * Smoothly stop the ambient pad
   */
  function stop(fadeDuration = 2.5) {
    if (!_isPlaying && _activeNodes.length === 0) return;

    _activeNodes.forEach(node => node.stop(fadeDuration));
    _activeNodes = [];
    _isPlaying = false;
    _activeKey = null;

    console.log(`[AmbientPadEngine] Stopped with ${fadeDuration}s fade-out`);
  }

  function toggle(key) {
    if (_isPlaying) {
      stop(2.0);
      return false;
    } else {
      playKey(key || 'C', false);
      return true;
    }
  }

  function setVolume(vol) {
    _masterVolume = Math.max(0.0, Math.min(1.0, vol));
    if (_masterGain && _audioCtx) {
      _masterGain.gain.setTargetAtTime(_masterVolume, _audioCtx.currentTime, 0.05);
    }
  }

  function setStereoSplit(enabled) {
    _stereoSplit = !!enabled;
    if (_pannerNode && _audioCtx) {
      // If split: pad goes to right (+1.0). If normal: centered (0.0)
      _pannerNode.pan.setTargetAtTime(_stereoSplit ? 1.0 : 0.0, _audioCtx.currentTime, 0.05);
    }
  }

  return {
    playKey,
    stop,
    toggle,
    setVolume,
    setStereoSplit,
    isPlaying: () => _isPlaying,
    getActiveKey: () => _activeKey,
    getVolume: () => _masterVolume,
    isStereoSplit: () => _stereoSplit
  };
})();

window.AmbientPadEngine = AmbientPadEngine;
