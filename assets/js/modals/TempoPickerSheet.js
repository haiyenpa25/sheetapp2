/**
 * assets/js/modals/TempoPickerSheet.js
 * Quản lý Bottom Sheet Chỉnh Tốc Độ BPM & Metronome (window.TempoPick).
 */

(function() {
  'use strict';

  function initTempoPicker() {
    var tModal    = document.getElementById('tempo-pick-modal');
    var tValEl    = document.getElementById('tempo-modal-val');
    var tSlider   = document.getElementById('tempo-modal-slider');
    var tDecBtn   = document.getElementById('tempo-modal-dec');
    var tIncBtn   = document.getElementById('tempo-modal-inc');
    var tTapBtn   = document.getElementById('tempo-modal-tap');
    var tMetroBtn = document.getElementById('tempo-modal-metronome');
    var tOkBtn    = document.getElementById('btn-tempo-pick-ok');
    var tCancelBtn= document.getElementById('btn-tempo-pick-cancel');
    var tCloseBtn = document.getElementById('btn-close-tempo-pick');

    var _tCb = null;
    var _curBpm = 100;
    var _tapTimes = [];

    function _setBpmUI(bpm) {
      bpm = Math.max(30, Math.min(250, parseInt(bpm, 10) || 100));
      _curBpm = bpm;
      if (tValEl) tValEl.textContent = bpm;
      if (tSlider) tSlider.value = bpm;
      document.querySelectorAll('.tempo-preset-btn').forEach(function(b) {
        b.classList.toggle('active', parseInt(b.dataset.bpm, 10) === bpm);
      });
    }

    function _closeTempo(val) {
      var cb = _tCb;
      _tCb = null;
      if (tModal) {
        if (window.ModalManager) {
          window.ModalManager.close(tModal);
        } else {
          tModal.classList.add('hidden');
        }
      }
      if (cb) { cb(val); }
    }

    if (window.EventBus) {
      window.EventBus.on('modal:closed', function(data) {
        if (data && tModal && data.modalId === tModal.id && _tCb) {
          _tCb(null);
          _tCb = null;
        }
      });
    }

    if (tDecBtn) tDecBtn.addEventListener('click', function() { _setBpmUI(_curBpm - 1); });
    if (tIncBtn) tIncBtn.addEventListener('click', function() { _setBpmUI(_curBpm + 1); });
    if (tSlider) tSlider.addEventListener('input', function(e) { _setBpmUI(e.target.value); });

    document.querySelectorAll('.tempo-preset-btn').forEach(function(b) {
      b.addEventListener('click', function() {
        _setBpmUI(parseInt(b.dataset.bpm, 10));
      });
    });

    if (tTapBtn) {
      tTapBtn.addEventListener('click', function() {
        var now = performance.now();
        if (_tapTimes.length > 0 && (now - _tapTimes[_tapTimes.length - 1] > 2000)) {
          _tapTimes = [];
        }
        _tapTimes.push(now);
        if (_tapTimes.length >= 2) {
          var totalDiff = 0;
          for (var i = 1; i < _tapTimes.length; i++) {
            totalDiff += (_tapTimes[i] - _tapTimes[i - 1]);
          }
          var avgInterval = totalDiff / (_tapTimes.length - 1);
          var calcBpm = Math.round(60000 / avgInterval);
          if (calcBpm >= 30 && calcBpm <= 250) {
            _setBpmUI(calcBpm);
          }
        }
      });
    }

    if (tMetroBtn) {
      tMetroBtn.addEventListener('click', function() {
        if (window.Metronome) {
          window.Metronome.setBpm(_curBpm);
          window.Metronome.togglePlay();
          tMetroBtn.textContent = window.Metronome.togglePlay ? '🔊 Bật / Tắt' : '🔊 Bật Nhịp';
        }
      });
    }

    if (tOkBtn) tOkBtn.addEventListener('click', function() { _closeTempo(_curBpm); });
    if (tCancelBtn) tCancelBtn.addEventListener('click', function() { _closeTempo(null); });
    if (tCloseBtn) tCloseBtn.addEventListener('click', function() { _closeTempo(null); });
    if (tModal) tModal.addEventListener('click', function(e) { if (e.target === tModal) _closeTempo(null); });

    /* Public API: window.TempoPick.show(currentBpm) → Promise<number|null> */
    window.TempoPick = {
      show: function(currentBpm) {
        if (!tModal) return Promise.resolve(currentBpm || 100);
        var defBpm = parseInt(currentBpm, 10) || (window.Metronome ? window.Metronome.getBpm() : 100);
        _setBpmUI(defBpm);
        _tapTimes = [];
        if (window.ModalManager) {
          window.ModalManager.open(tModal);
        } else {
          tModal.classList.remove('hidden');
        }
        return new Promise(function(resolve) { _tCb = resolve; });
      }
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTempoPicker);
  } else {
    initTempoPicker();
  }
})();
