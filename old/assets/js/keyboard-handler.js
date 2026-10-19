/**
 * keyboard-handler.js — Global Keyboard Shortcuts & Quick Number Jump
 * Hỗ trợ:
 *  - Gõ số 0-9 trực tiếp (+ Enter hoặc tự nhảy sau 900ms) để mở nhanh bài theo số
 *  - Phím '/': Focus ngay vào ô tìm kiếm
 *  - Phím 'G': Ghim / Bỏ ghim bài đang mở lên thanh Ghim nhanh
 *  - Phím ↑/↓: Bài trước / tiếp theo; ←/→/0: Dịch giọng
 */
const KeyboardHandler = (() => {
  'use strict';

  let _numBuf   = '';
  let _numTimer = null;

  function init() {
    document.addEventListener('keydown', _onKey);
  }

  function _showNumHud(val) {
    const hud = document.getElementById('quick-num-hud');
    if (!hud) return;
    if (!val) {
      hud.classList.add('hidden');
      hud.textContent = '';
      return;
    }
    hud.textContent = `Nhảy đến bài số: ${val} (Enter)`;
    hud.classList.remove('hidden');
  }

  function _commitNumJump() {
    clearTimeout(_numTimer);
    const val = _numBuf;
    _numBuf = '';
    _showNumHud('');
    if (val) {
      window.LibraryUI?.jumpByNumber?.(parseInt(val, 10));
    }
  }

  function _onKey(e) {
    const active = document.activeElement;
    const tag    = active?.tagName?.toLowerCase();
    if (['input', 'textarea', 'select'].includes(tag)) {
      if (e.key === 'Escape') active.blur();
      return;
    }

    const xml = Store.get('originalXml');

    // 1. Gõ số nhảy bài tức thì (Quick Number Jump)
    if (!e.ctrlKey && !e.metaKey && !e.altKey && /^[0-9]$/.test(e.key)) {
      // Nếu chưa có buffer và bấm '0' khi đang mở bài có transpose != 0 → reset transpose
      if (_numBuf === '' && e.key === '0' && xml && (Store.get('currentTranspose') || 0) !== 0) {
        App?.resetTranspose?.();
        return;
      }
      e.preventDefault();
      _numBuf = (_numBuf + e.key).slice(0, 4);
      _showNumHud(_numBuf);
      clearTimeout(_numTimer);
      _numTimer = setTimeout(_commitNumJump, 900);
      return;
    }

    if (_numBuf && e.key === 'Enter') {
      e.preventDefault();
      _commitNumJump();
      return;
    }

    if (_numBuf && e.key === 'Backspace') {
      e.preventDefault();
      _numBuf = _numBuf.slice(0, -1);
      _showNumHud(_numBuf);
      clearTimeout(_numTimer);
      if (_numBuf) _numTimer = setTimeout(_commitNumJump, 900);
      return;
    }

    switch (e.key) {
      case '/': {
        e.preventDefault();
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
        break;
      }
      case 'ArrowDown':
        e.preventDefault();
        App?.navigateNext?.();
        break;
      case 'ArrowUp':
        e.preventDefault();
        App?.navigatePrev?.();
        break;
      case ' ': {
        e.preventDefault();
        const wrapper = document.querySelector('.sheet-viewer-wrapper') || document.documentElement;
        if (wrapper) {
          const scrollAmount = wrapper.clientHeight * 0.7;
          wrapper.scrollBy({
            top: e.shiftKey ? -scrollAmount : scrollAmount,
            behavior: 'smooth'
          });
        }
        break;
      }
      case 'ArrowRight':
        if (!e.ctrlKey && !e.metaKey && xml) { e.preventDefault(); App?.transposeBy?.(+1); }
        break;
      case 'ArrowLeft':
        if (!e.ctrlKey && !e.metaKey && xml) { e.preventDefault(); App?.transposeBy?.(-1); }
        break;
      case 'PageDown': e.preventDefault(); PageNav?.goToNext?.(); break;
      case 'PageUp':   e.preventDefault(); PageNav?.goToPrev?.(); break;
      case 'c': case 'C': if (xml) ChordCanvas?.toggleAddMode?.(); break;
      case 'h': case 'H': if (xml) ChordCanvas?.toggleHighlight?.(); break;
      case 'g': case 'G': {
        const curSong = Store.get('currentSong');
        if (curSong?.id) window.LibraryUI?.togglePin?.(curSong.id);
        break;
      }
      case 'f': case 'F': AppUI?.toggleFullscreen?.(); break;
      case 'p': case 'P': if (xml) window.print(); break;
      case 'd': case 'D': document.getElementById('btn-dark-toggle')?.click(); break;
      case '+': case '=': if (e.ctrlKey) { e.preventDefault(); _adjustZoom(+10); } break;
      case '-':           if (e.ctrlKey) { e.preventDefault(); _adjustZoom(-10); } break;
      case 'z': case 'Z':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          e.shiftKey ? ChordCanvas?.redo?.() : ChordCanvas?.undo?.();
        }
        break;
      case 'y': case 'Y':
        if (e.ctrlKey || e.metaKey) { e.preventDefault(); ChordCanvas?.redo?.(); }
        break;
      case 'Escape':
        if (_numBuf) {
          clearTimeout(_numTimer);
          _numBuf = '';
          _showNumHud('');
          break;
        }
        document.getElementById('import-modal')?.classList.add('hidden');
        document.getElementById('session-panel')?.classList.add('hidden');
        if (document.body.classList.contains('sheet-only-mode')) AppUI?.toggleFullscreen?.();
        break;
    }
  }

  function _adjustZoom(delta) {
    const slider = document.getElementById('zoom-slider');
    if (!slider || slider.disabled) return;
    const cur = parseInt(slider.value) || 100;
    if (slider.tagName.toLowerCase() === 'select') {
      const opts = Array.from(slider.options).map(o => parseInt(o.value));
      const idx  = Math.max(0, Math.min(opts.length - 1, opts.indexOf(cur) + (delta > 0 ? 1 : -1)));
      App?.setZoom?.(opts[idx]);
    } else {
      App?.setZoom?.(Math.min(200, Math.max(30, cur + delta)));
    }
  }

  return { init };
})();

window.KeyboardHandler = KeyboardHandler;
