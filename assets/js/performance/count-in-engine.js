/**
 * assets/js/performance/count-in-engine.js — Synchronized Lead-in Count-in & Visual Cue Overlay
 * 
 * Features:
 * - 1 or 2 Bars Lead-in countdown ("1, 2, 3, 4" -> "VÀO HÁT!")
 * - High-precision Web Audio lookahead scheduling
 * - Visual full-screen / score floating banner with glowing animations
 * - Synchronized start across Host and Band Followers
 */
const CountInEngine = (() => {
  'use strict';

  let _audioCtx = null;
  let _timerId = null;
  let _activeCountdownTimers = [];
  let _isCountingIn = false;

  function _getAudioContext() {
    if (!_audioCtx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) _audioCtx = new AudioCtx();
    }
    if (_audioCtx && _audioCtx.state === 'suspended') {
      _audioCtx.resume();
    }
    return _audioCtx;
  }

  /**
   * Phát tiếng gõ nhịp count-in
   */
  function _playClick(time, isAccent = false, isEntry = false) {
    const ctx = _getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    if (isEntry) {
      // Tiếng chuông / chime báo hiệu Vào
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880, time);      // Note A5
      osc.frequency.exponentialRampToValueAtTime(1760, time + 0.08);
      gain.gain.setValueAtTime(0.7, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.4);
    } else if (isAccent) {
      // Phách đầu (Beat 1)
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, time);
      gain.gain.setValueAtTime(0.6, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);
    } else {
      // Các phách thường (Beat 2, 3, 4)
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, time);
      gain.gain.setValueAtTime(0.45, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.06);
    }

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(time);
    osc.stop(time + (isEntry ? 0.45 : 0.09));
  }

  /**
   * Bắt đầu đếm nhịp chuẩn bị
   * @param {Object} opts
   * @param {number} opts.bpm - Tốc độ nhịp
   * @param {number} opts.beats - Số phách trong 1 ô nhịp (VD: 4)
   * @param {number} opts.countInBars - Số ô nhịp đếm trước (mặc định 1)
   * @param {number} opts.startAtServer - Thời điểm bắt đầu trên server (Unix timestamp float)
   * @param {Function} opts.onComplete - Callback kích hoạt khi kết thúc count-in (vào bài)
   */
  function startCountIn({ bpm = 80, beats = 4, countInBars = 1, startAtServer = 0, onComplete = null } = {}) {
    cancel();

    _isCountingIn = true;
    const ctx = _getAudioContext();
    const beatDuration = 60.0 / bpm;
    const totalBeats = beats * countInBars;

    // Tính thời gian bắt đầu AudioContext
    let localStartTime = ctx.currentTime + 0.08;
    if (startAtServer > 0 && window.TransportClock) {
      localStartTime = window.TransportClock.toAudioContextTime(startAtServer, ctx);
    }

    // Hiển thị Overlay
    _showOverlay(bpm, beats);

    // Schedule audio clicks
    for (let i = 0; i < totalBeats; i++) {
      const noteTime = localStartTime + (i * beatDuration);
      const isAccent = (i % beats === 0);
      _playClick(noteTime, isAccent, false);

      // Schedule visual update
      const delayMs = Math.max(0, (noteTime - ctx.currentTime) * 1000);
      const countNumber = (i % beats) + 1;

      const timer = setTimeout(() => {
        if (!_isCountingIn) return;
        _updateVisualBeat(countNumber, beats);
      }, delayMs);
      _activeCountdownTimers.push(timer);
    }

    // Schedule Entry "VÀO HÁT!"
    const entryTime = localStartTime + (totalBeats * beatDuration);
    _playClick(entryTime, false, true);

    const entryDelayMs = Math.max(0, (entryTime - ctx.currentTime) * 1000);
    const endTimer = setTimeout(() => {
      if (!_isCountingIn) return;
      _updateVisualBeat('VÀO !', beats, true);

      // Sau 800ms ẩn overlay và kích hoạt onComplete
      setTimeout(() => {
        _hideOverlay();
        _isCountingIn = false;
        if (typeof onComplete === 'function') onComplete();
      }, 700);
    }, entryDelayMs);

    _activeCountdownTimers.push(endTimer);
  }

  function cancel() {
    _isCountingIn = false;
    _activeCountdownTimers.forEach(t => clearTimeout(t));
    _activeCountdownTimers = [];
    _hideOverlay();
  }

  /* ── VISUAL OVERLAY MANAGEMENT ── */
  function _showOverlay(bpm, beats) {
    let overlay = document.getElementById('count-in-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'count-in-overlay';
      overlay.className = 'count-in-overlay';
      overlay.innerHTML = `
        <div class="count-in-box">
          <div class="count-in-header">
            <span class="count-in-pill">⏱️ ĐẾM NHỊP CHUẨN BỊ</span>
            <span class="count-in-meta" id="count-in-meta-bpm">${bpm} BPM • Nhịp ${beats}/4</span>
          </div>
          <div class="count-in-digit-container">
            <div id="count-in-digit" class="count-in-digit">...</div>
          </div>
          <div class="count-in-footer">Chuẩn bị vào bài hát</div>
        </div>
      `;
      document.body.appendChild(overlay);
    } else {
      const meta = document.getElementById('count-in-meta-bpm');
      if (meta) meta.textContent = `${bpm} BPM • Nhịp ${beats}/4`;
      overlay.classList.remove('hidden');
    }
    overlay.style.display = 'flex';
  }

  function _updateVisualBeat(text, beats, isEntry = false) {
    const digit = document.getElementById('count-in-digit');
    if (!digit) return;

    digit.textContent = String(text);
    digit.className = `count-in-digit ${isEntry ? 'is-entry' : 'pulse'}`;

    // Force CSS reflow to re-trigger pulse animation
    void digit.offsetWidth;
  }

  function _hideOverlay() {
    const overlay = document.getElementById('count-in-overlay');
    if (overlay) {
      overlay.style.display = 'none';
      overlay.classList.add('hidden');
    }
  }

  return {
    startCountIn,
    cancel,
    isCountingIn: () => _isCountingIn
  };
})();

window.CountInEngine = CountInEngine;
