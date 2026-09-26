/**
 * live-band/js/stage-timer.js — Stage Timer & Visual Beat Pulser Engine
 * Đồng hồ đếm ngược giờ lễ / biểu diễn, bấm giờ sân khấu, và bộ đập nhịp trực quan (Visual Beat Pulser & Drummer LED).
 */
(() => {
  'use strict';

  let _timerInterval     = null;
  let _timerMode         = 'off'; // 'off' | 'countdown' | 'stopwatch'
  let _timerRemainingSec = 0;
  let _timerStopwatchSec = 0;

  let _beatPulserInterval = null;
  let _currentBeat        = 1;

  function startCountdown(minutes, showCueBannerFn) {
    clearInterval(_timerInterval);
    _timerMode = 'countdown';
    _timerRemainingSec = minutes * 60;
    tickTimer(showCueBannerFn);
    _timerInterval = setInterval(() => tickTimer(showCueBannerFn), 1000);
    if (typeof showCueBannerFn === 'function') {
      showCueBannerFn(`⏱️ Bắt đầu đếm ngược ${minutes} phút`, '⏱️', 2000);
    }
  }

  function startStopwatch(showCueBannerFn) {
    clearInterval(_timerInterval);
    _timerMode = 'stopwatch';
    _timerStopwatchSec = 0;
    tickTimer(showCueBannerFn);
    _timerInterval = setInterval(() => tickTimer(showCueBannerFn), 1000);
    if (typeof showCueBannerFn === 'function') {
      showCueBannerFn('⏱️ Bắt đầu bấm giờ sân khấu', '⏱️', 2000);
    }
  }

  function resetTimer(showCueBannerFn) {
    clearInterval(_timerInterval);
    _timerInterval = null;
    _timerMode = 'off';
    _timerRemainingSec = 0;
    _timerStopwatchSec = 0;
    const label = document.getElementById('nav-timer-label');
    const pill = document.getElementById('btn-stage-timer');
    if (label) label.textContent = '00:00';
    if (pill) pill.classList.remove('urgent');
    if (typeof showCueBannerFn === 'function') {
      showCueBannerFn('⏱️ Đã đặt lại đồng hồ', '⏱️', 1500);
    }
  }

  function tickTimer(showCueBannerFn) {
    const label = document.getElementById('nav-timer-label');
    const pill = document.getElementById('btn-stage-timer');
    if (!label) return;

    if (_timerMode === 'countdown') {
      if (_timerRemainingSec > 0) {
        _timerRemainingSec--;
        const m = Math.floor(_timerRemainingSec / 60);
        const s = _timerRemainingSec % 60;
        label.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        if (pill) pill.classList.toggle('urgent', _timerRemainingSec <= 60);
      } else {
        label.textContent = '00:00';
        if (pill) pill.classList.add('urgent');
        clearInterval(_timerInterval);
        if (typeof showCueBannerFn === 'function') {
          showCueBannerFn('🔔 ĐÃ ĐẾN GIỜ KHAI LỄ / BIỂU DIỄN!', '🔔', 5000);
        }
      }
    } else if (_timerMode === 'stopwatch') {
      _timerStopwatchSec++;
      const m = Math.floor(_timerStopwatchSec / 60);
      const s = _timerStopwatchSec % 60;
      label.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
  }

  function startVisualBeatPulser(bpm, onPlayMetronomeClick) {
    stopVisualBeatPulser();
    const intervalMs = (60 / Math.max(40, bpm || 80)) * 1000;

    _beatPulserInterval = setInterval(() => {
      const isBeatOne = (_currentBeat === 1);

      const pulserDot = document.getElementById('beat-pulser-dot');
      const beatNum = document.getElementById('beat-pulser-number');
      const ledBar = document.getElementById('drummer-flasher-led');

      if (pulserDot) {
        pulserDot.classList.toggle('is-downbeat', isBeatOne);
        pulserDot.classList.add('pulse');
        setTimeout(() => pulserDot.classList.remove('pulse'), 90);
      }
      if (beatNum) {
        beatNum.textContent = _currentBeat;
      }
      if (ledBar) {
        ledBar.classList.toggle('is-downbeat', isBeatOne);
        ledBar.classList.add('flash');
        setTimeout(() => ledBar.classList.remove('flash'), 85);
      }

      if (typeof onPlayMetronomeClick === 'function') {
        onPlayMetronomeClick(isBeatOne);
      }

      _currentBeat = (_currentBeat % 4) + 1;
    }, intervalMs);
  }

  function stopVisualBeatPulser() {
    if (_beatPulserInterval) {
      clearInterval(_beatPulserInterval);
      _beatPulserInterval = null;
    }
  }

  function showTimerModal() {
    document.getElementById('modal-stage-timer-settings')?.classList.remove('hidden');
  }

  function hideTimerModal() {
    document.getElementById('modal-stage-timer-settings')?.classList.add('hidden');
  }

  window.StageTimer = {
    startCountdown,
    startStopwatch,
    resetTimer,
    startVisualBeatPulser,
    stopVisualBeatPulser,
    showTimerModal,
    hideTimerModal
  };
})();
