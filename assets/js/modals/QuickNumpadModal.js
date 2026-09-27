/**
 * assets/js/modals/QuickNumpadModal.js
 * Bàn phím số nhanh trực quan (Quick Numpad Modal - Ticket L2-5).
 * Cho phép ca viên/nhạc công trên sân khấu gõ 1-2-3 để mở bài ngay lập tức.
 *
 * Expose: window.QuickNumpadModal
 */
(function(window) {
  'use strict';

  let _modal = null;
  let _btnToggle = null;
  let _digitsDisplay = null;
  let _matchDisplay = null;
  let _btnOpen = null;
  let _btnClose = null;
  let _currentDigits = '';
  let _matchedSong = null;
  let _autoOpenTimer = null;

  function _findSongByNumber(num) {
    if (!num || isNaN(num)) return null;
    const songs = (window.LibraryUI && typeof window.LibraryUI.getSongs === 'function') 
      ? window.LibraryUI.getSongs() 
      : [];

    return songs.find(s => {
      const sNum = s.httlvnId ? parseInt(s.httlvnId, 10) : parseInt((s.id || '').replace(/^thanh-ca-/, ''), 10);
      if (sNum === num) return true;
      const padded = String(num).padStart(3, '0');
      if (s.id === 'thanh-ca-' + padded || s.id === 'thanh-ca-' + num) return true;
      if (s.title && (s.title.startsWith(num + '.') || s.title.startsWith(num + ' ') || s.title.startsWith(padded + '.') || s.title.startsWith(padded + ' '))) return true;
      return false;
    }) || null;
  }

  function _updateState() {
    clearTimeout(_autoOpenTimer);

    if (!_digitsDisplay || !_matchDisplay || !_btnOpen) return;

    if (!_currentDigits) {
      _digitsDisplay.textContent = '---';
      _matchDisplay.textContent = 'Nhập số bài 1 - 903...';
      _matchDisplay.className = 'numpad-song-match';
      _btnOpen.disabled = true;
      _matchedSong = null;
      return;
    }

    _digitsDisplay.textContent = _currentDigits;
    const num = parseInt(_currentDigits, 10);
    const song = _findSongByNumber(num);

    if (song) {
      _matchedSong = song;
      const keyText = song.key || song.defaultKey || '';
      const keyBadge = keyText ? ` (${keyText})` : '';
      _matchDisplay.textContent = `✓ Bài ${num}: ${song.title}${keyBadge}`;
      _matchDisplay.className = 'numpad-song-match matched';
      _btnOpen.disabled = false;

      // Khi gõ đủ 3 chữ số (độ dài tối đa của Thánh Ca), tự động kích hoạt sau 750ms
      if (_currentDigits.length === 3) {
        _autoOpenTimer = setTimeout(() => {
          if (_matchedSong && _modal && !_modal.classList.contains('hidden')) {
            openCurrentSong();
          }
        }, 750);
      }
    } else {
      _matchedSong = null;
      _matchDisplay.textContent = `✕ Không tìm thấy bài số ${_currentDigits}`;
      _matchDisplay.className = 'numpad-song-match no-match';
      _btnOpen.disabled = true;
    }
  }

  function appendDigit(digit) {
    if (typeof digit !== 'string' && typeof digit !== 'number') return;
    const dStr = String(digit).trim();
    if (!/^[0-9]$/.test(dStr)) return;

    // Giới hạn tối đa 3 chữ số
    if (_currentDigits.length >= 3) return;

    _currentDigits += dStr;
    _updateState();
  }

  function backspace() {
    clearTimeout(_autoOpenTimer);
    if (_currentDigits.length > 0) {
      _currentDigits = _currentDigits.slice(0, -1);
      _updateState();
    }
  }

  function clear() {
    clearTimeout(_autoOpenTimer);
    _currentDigits = '';
    _updateState();
  }

  function openCurrentSong() {
    clearTimeout(_autoOpenTimer);
    if (!_matchedSong) return;

    const targetSong = _matchedSong;
    close();

    if (window.LibraryUI && typeof window.LibraryUI.selectSong === 'function') {
      window.LibraryUI.selectSong(targetSong.id);
    }
  }

  function open() {
    if (!_modal) init();
    if (!_modal) return;

    clear();

    if (window.ModalManager && typeof window.ModalManager.open === 'function') {
      window.ModalManager.open(_modal, _btnToggle);
    } else {
      _modal.classList.remove('hidden');
    }
  }

  function close() {
    clearTimeout(_autoOpenTimer);
    if (!_modal) return;

    if (window.ModalManager && typeof window.ModalManager.close === 'function') {
      window.ModalManager.close(_modal);
    } else {
      _modal.classList.add('hidden');
    }
  }

  function toggle() {
    if (!_modal) init();
    if (!_modal) return;

    if (_modal.classList.contains('hidden')) {
      open();
    } else {
      close();
    }
  }

  function init() {
    _modal = document.getElementById('modal-quick-numpad');
    _btnToggle = document.getElementById('btn-quick-numpad');
    _digitsDisplay = document.getElementById('numpad-display-digits');
    _matchDisplay = document.getElementById('numpad-song-match');
    _btnOpen = document.getElementById('btn-numpad-open');
    _btnClose = document.getElementById('btn-close-quick-numpad');

    // Bind trigger button
    _btnToggle?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggle();
    });

    // Bind close button
    _btnClose?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      close();
    });

    // Bind open button & preview click
    const handleOpen = (e) => {
      e.preventDefault();
      e.stopPropagation();
      openCurrentSong();
    };
    _btnOpen?.addEventListener('click', handleOpen);
    _matchDisplay?.addEventListener('click', handleOpen);

    // Bind grid buttons
    _modal.querySelectorAll('.btn-numpad-key').forEach(btn => {
      btn.addEventListener('click', (e) => {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }

        const digit = btn.dataset.digit;
        const action = btn.dataset.action;
        if (digit !== undefined) {
          appendDigit(digit);
        } else if (action === 'clear') {
          clear();
        } else if (action === 'backspace') {
          backspace();
        }
      });
    });

    // Keyboard events when modal is visible
    window.addEventListener('keydown', (e) => {
      if (!_modal || _modal.classList.contains('hidden')) return;

      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        e.stopPropagation();
        appendDigit(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        e.stopPropagation();
        backspace();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        openCurrentSong();
      } else if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        e.stopPropagation();
        clear();
      }
    }, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.QuickNumpadModal = {
    init,
    open,
    close,
    toggle,
    appendDigit,
    backspace,
    clear,
    openCurrentSong,
    getDigits: () => _currentDigits,
    getMatchedSong: () => _matchedSong
  };

})(typeof window !== 'undefined' ? window : this);
