/**
 * assets/js/modals/TransposePickerModal.js
 * Quản lý Hộp Thoại Chọn Tông Tập & BPM Trực Quan (window.TransposePick).
 */

(function() {
  'use strict';

  function initTransposePicker() {
    var modal     = document.getElementById('transpose-pick-modal') || document.getElementById('modal-transpose-pick');
    var customIn  = document.getElementById('transpose-pick-custom');
    var btnOk     = document.getElementById('btn-transpose-pick-ok');
    var btnCancel = document.getElementById('btn-transpose-pick-cancel');
    var btnClose  = document.getElementById('btn-close-transpose-pick');
    var _cb = null;
    var _origKey = '';
    var _curSemi = 0;

    function _calcTargetKey(orig, semi) {
      if (!orig) return '';
      if (window.TransposeEngine && window.TransposeEngine.calcKey) {
        return window.TransposeEngine.calcKey(orig, semi) || orig;
      }
      if (window.TransposeEngine && window.TransposeEngine.transposeChord) {
        return window.TransposeEngine.transposeChord(orig, semi) || orig;
      }
      return orig;
    }

    function _updatePreview(semi) {
      _curSemi = semi;
      if (customIn) customIn.value = semi;
      document.querySelectorAll('.tp-btn').forEach(function(b) {
        b.classList.toggle('active', parseInt(b.dataset.v, 10) === semi);
      });

      var origEl = document.getElementById('tp-orig-key-display');
      var targetEl = document.getElementById('tp-target-key-display');
      var diffEl = document.getElementById('tp-diff-display');
      
      var cleanOrig = _origKey ? _origKey.trim() : '';
      if (cleanOrig) {
        if (origEl) origEl.textContent = cleanOrig;
        var target = _calcTargetKey(cleanOrig, semi);
        if (targetEl) targetEl.textContent = target;
        if (diffEl) {
          diffEl.textContent = semi === 0 ? 'Gốc (0)' : (semi > 0 ? ('+' + semi + ' nửa cung') : (semi + ' nửa cung'));
        }
      } else {
        if (origEl) origEl.textContent = '—';
        if (targetEl) targetEl.textContent = semi === 0 ? 'Gốc' : (semi > 0 ? ('+' + semi) : String(semi));
        if (diffEl) {
          diffEl.textContent = semi === 0 ? '0' : (semi > 0 ? ('+' + semi) : String(semi));
        }
      }
    }

    function closePick(val) {
      if (modal) {
        if (window.ModalManager) {
          window.ModalManager.close(modal);
        } else {
          modal.classList.add('hidden');
        }
      }
      if (_cb) { _cb(val); _cb = null; }
    }

    if (window.EventBus) {
      window.EventBus.on('modal:closed', function(data) {
        if (data && modal && data.modalId === modal.id && _cb) {
          _cb(null);
          _cb = null;
        }
      });
    }

    document.querySelectorAll('.tp-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var v = parseInt(btn.dataset.v, 10) || 0;
        _updatePreview(v);
      });
    });

    if (customIn) {
      customIn.addEventListener('input', function() {
        var v = parseInt(customIn.value, 10) || 0;
        _updatePreview(v);
      });
      customIn.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') { e.preventDefault(); closePick(_curSemi); }
        if (e.key === 'Escape') { e.preventDefault(); closePick(null); }
      });
    }

    var bpmIn = document.getElementById('transpose-pick-bpm');
    var bpmDecBtn = document.getElementById('tp-bpm-dec');
    var bpmIncBtn = document.getElementById('tp-bpm-inc');

    if (bpmDecBtn && bpmIn) bpmDecBtn.addEventListener('click', function() {
      bpmIn.value = Math.max(30, (parseInt(bpmIn.value, 10) || 100) - 1);
    });
    if (bpmIncBtn && bpmIn) bpmIncBtn.addEventListener('click', function() {
      bpmIn.value = Math.min(250, (parseInt(bpmIn.value, 10) || 100) + 1);
    });
    document.querySelectorAll('.tp-bpm-preset').forEach(function(btn) {
      btn.addEventListener('click', function() {
        if (bpmIn) bpmIn.value = btn.dataset.bpm;
      });
    });

    if (btnOk) btnOk.addEventListener('click', function() {
      var bpmVal = bpmIn ? (parseInt(bpmIn.value, 10) || null) : null;
      closePick({
        transpose: _curSemi,
        transpose_key: _curSemi,
        bpm: bpmVal,
        valueOf: function() { return _curSemi; }
      });
    });
    if (btnCancel) btnCancel.addEventListener('click', function() { closePick(null); });
    if (btnClose)  btnClose.addEventListener('click',  function() { closePick(null); });
    if (modal)     modal.addEventListener('click', function(e) { if (e.target === modal) closePick(null); });

    /* Public API: window.TransposePick.show(songName, defaultVal, origKey, defaultBpm, triggerEl) → Promise<object|null> */
    window.TransposePick = {
      show: function(songName, defaultVal, origKey, defaultBpm, triggerEl) {
        if (!modal) return Promise.resolve({ transpose: 0, transpose_key: 0, bpm: defaultBpm || 100 });
        _origKey = origKey ? String(origKey).trim() : '';
        var defV = defaultVal !== undefined ? (parseInt(defaultVal, 10) || 0) : 0;
        _updatePreview(defV);
        if (bpmIn) {
          bpmIn.value = (defaultBpm && parseInt(defaultBpm, 10)) ? parseInt(defaultBpm, 10) : 100;
        }
        var nameEl = document.getElementById('transpose-pick-song-name');
        if (nameEl) nameEl.textContent = songName ? ('🎵 ' + songName) : 'Bài hát';
        if (window.ModalManager) {
          window.ModalManager.open(modal, triggerEl);
        } else {
          modal.classList.remove('hidden');
        }
        setTimeout(function() { if (customIn) customIn.select(); }, 80);
        return new Promise(function(resolve) { _cb = resolve; });
      }
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTransposePicker);
  } else {
    initTransposePicker();
  }
})();
