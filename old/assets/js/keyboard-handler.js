/**
 * keyboard-handler.js — Global Keyboard Shortcuts
 * Tách từ app.js: toàn bộ keydown logic.
 */
const KeyboardHandler = (() => {
  'use strict';

  function init() {
    document.addEventListener('keydown', _onKey);
  }

  function _onKey(e) {
    // Bỏ qua khi đang nhập liệu
    const tag = document.activeElement?.tagName?.toLowerCase();
    if (['input','textarea','select','button'].includes(tag)) return;

    const xml = Store.get('originalXml');

    switch (e.key) {
      // BUG-8 fix: Nếu đang trong Setlist → dùng Setlist navigation, không nhảy library
      case 'ArrowDown':
        e.preventDefault();
        if (window.SetlistUI?.getCurrentSetlist?.()) { SetlistUI.next(); }
        else { App?.navigateNext?.(); }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (window.SetlistUI?.getCurrentSetlist?.()) { SetlistUI.prev(); }
        else { App?.navigatePrev?.(); }
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
      case '0': if (xml) App?.resetTranspose?.(); break;
      case 'PageDown': e.preventDefault(); PageNav?.goToNext?.(); break;
      case 'PageUp':   e.preventDefault(); PageNav?.goToPrev?.(); break;
      case 'c': case 'C': if (xml) ChordCanvas?.toggleAddMode?.(); break;
      case 'h': case 'H': if (xml) ChordCanvas?.toggleHighlight?.(); break; // Highlight mode
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
      const idx  = Math.max(0, Math.min(opts.length-1, opts.indexOf(cur) + (delta > 0 ? 1 : -1)));
      App?.setZoom?.(opts[idx]);
    } else {
      App?.setZoom?.(Math.min(200, Math.max(30, cur + delta)));
    }
  }

  return { init };
})();

window.KeyboardHandler = KeyboardHandler;
