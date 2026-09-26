/**
 * live-band/js/stage-audio.js — Live Stage Audio & In-Ear Metronome Engine
 * Quản lý Web Audio Synthesizer: Đếm nhịp Count-In, Click nhịp In-Ear tai nghe, Tách kênh Stereo Split L/R, và Ambient Pad Drone.
 */
(() => {
  'use strict';

  let _audioCtx = null;
  let _metronomeAudioCtx = null;
  let _isMetronomeAudioEnabled = false;
  let _isStereoSplit = false;
  let _isPadActive = false;

  function getAudioContext() {
    if (!_audioCtx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) _audioCtx = new AudioCtx();
    }
    if (_audioCtx && _audioCtx.state === 'suspended') {
      _audioCtx.resume();
    }
    return _audioCtx;
  }

  function playClickSound(freq = 880, duration = 0.04) {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration);
    } catch (e) {}
  }

  function initMetronomeAudioContext() {
    if (!_metronomeAudioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        _metronomeAudioCtx = new AudioContextClass();
      }
    }
    if (_metronomeAudioCtx && _metronomeAudioCtx.state === 'suspended') {
      _metronomeAudioCtx.resume();
    }
  }

  function toggleMetronomeAudio(showCueBannerFn) {
    _isMetronomeAudioEnabled = !_isMetronomeAudioEnabled;
    const btn = document.getElementById('btn-toggle-metronome-audio');
    if (btn) {
      btn.classList.toggle('active', _isMetronomeAudioEnabled);
      btn.textContent = _isMetronomeAudioEnabled ? '🔊 Click: Bật' : '🔇 Click: Tắt';
    }
    if (_isMetronomeAudioEnabled) {
      initMetronomeAudioContext();
      if (typeof showCueBannerFn === 'function') {
        showCueBannerFn('🔊 Đã bật Click nhịp tai nghe', '🎧', 1800);
      }
    } else {
      if (typeof showCueBannerFn === 'function') {
        showCueBannerFn('🔇 Đã tắt Click nhịp tai nghe', 'ℹ️', 1500);
      }
    }
    return _isMetronomeAudioEnabled;
  }

  function playMetronomeClick(isBeatOne) {
    if (!_isMetronomeAudioEnabled || !_metronomeAudioCtx) return;
    try {
      if (_metronomeAudioCtx.state === 'suspended') {
        _metronomeAudioCtx.resume();
      }
      const osc = _metronomeAudioCtx.createOscillator();
      const gain = _metronomeAudioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.value = isBeatOne ? 960 : 540;

      const now = _metronomeAudioCtx.currentTime;
      gain.gain.setValueAtTime(isBeatOne ? 0.4 : 0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + (isBeatOne ? 0.05 : 0.035));

      osc.connect(gain);
      if (_isStereoSplit && typeof _metronomeAudioCtx.createStereoPanner === 'function') {
        const panner = _metronomeAudioCtx.createStereoPanner();
        panner.pan.setValueAtTime(-1.0, now); // Click ra tai Trái (In-Ear)
        gain.connect(panner);
        panner.connect(_metronomeAudioCtx.destination);
      } else {
        gain.connect(_metronomeAudioCtx.destination);
      }

      osc.start(now);
      osc.stop(now + (isBeatOne ? 0.05 : 0.035));
    } catch (e) {}
  }

  function setStereoSplit(enabled) {
    _isStereoSplit = enabled;
  }

  function triggerVisualCountIn({ bpm = 80, beats = 4, onComplete = null }) {
    const overlay = document.getElementById('stage-countin-overlay');
    const numEl = document.getElementById('countin-giant-number');
    const subEl = document.getElementById('countin-subtext');
    if (!overlay || !numEl) return;

    overlay.classList.remove('hidden');
    const beatDurationMs = (60 / bpm) * 1000;
    let currentBeat = beats;

    const tick = () => {
      if (currentBeat > 0) {
        numEl.textContent = currentBeat;
        if (subEl) subEl.textContent = `CHUẨN BỊ VÀO BÀI... (PHÁCH ${beats - currentBeat + 1}/${beats})`;
        playClickSound(currentBeat === beats ? 920 : 540, 0.04);
        currentBeat--;
        setTimeout(tick, beatDurationMs);
      } else {
        numEl.textContent = 'VÀO!';
        numEl.style.color = '#10b981';
        if (subEl) subEl.textContent = 'HÁT / ĐÀN CÙNG NHAU!';
        playClickSound(1080, 0.08);

        setTimeout(() => {
          overlay.classList.add('hidden');
          numEl.style.color = '';
          if (onComplete) onComplete();
        }, beatDurationMs * 0.85);
      }
    };

    tick();
  }

  function toggleAmbientPad(baseKey, transpose, showCueBannerFn) {
    if (!window.AmbientPadEngine) return false;
    let effectiveKey = baseKey;
    if (window.TransposeEngine && transpose !== 0) {
      effectiveKey = window.TransposeEngine.transposeKey(baseKey, transpose) || baseKey;
    }

    const isNowPlaying = window.AmbientPadEngine.toggle(effectiveKey);
    _isPadActive = isNowPlaying;
    updatePadUI(isNowPlaying, effectiveKey);
    if (typeof showCueBannerFn === 'function') {
      showCueBannerFn(isNowPlaying ? `🎹 Bật Ambient Pad: Tông ${effectiveKey}` : '🎹 Đã tắt Ambient Pad', '🎹', 2000);
    }
    return isNowPlaying;
  }

  function updatePadUI(isActive, key) {
    const navPill = document.getElementById('btn-stage-pad');
    const navLabel = document.getElementById('nav-pad-label');
    const hostBtnText = document.getElementById('host-pad-btn-text');

    if (navPill) navPill.classList.toggle('active', isActive);
    if (navLabel) navLabel.textContent = isActive ? `Pad: ${key}` : 'Pad: Tắt';
    if (hostBtnText) hostBtnText.textContent = isActive ? `Tắt Pad (${key})` : 'Bật Pad Drone';
  }

  function showAudioSettingsModal() {
    document.getElementById('modal-stage-audio-settings')?.classList.remove('hidden');
  }

  function hideAudioSettingsModal() {
    document.getElementById('modal-stage-audio-settings')?.classList.add('hidden');
  }

  window.StageAudio = {
    getAudioContext,
    playClickSound,
    toggleMetronomeAudio,
    playMetronomeClick,
    setStereoSplit,
    triggerVisualCountIn,
    toggleAmbientPad,
    updatePadUI,
    showAudioSettingsModal,
    hideAudioSettingsModal
  };
})();
