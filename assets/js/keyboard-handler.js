/**
 * keyboard-handler.js — Global Keyboard Shortcuts
 * Tách từ app.js: toàn bộ keydown logic.
 */
const KeyboardHandler = (() => {
  'use strict';

  let _midiInitialized = false;

  function init() {
    document.addEventListener('keydown', _onKey);
    // Task 2.8: Không auto-request MIDI khi nạp trang chính.
    // Chỉ kích hoạt Web MIDI khi người dùng chuyển sang Performance mode hoặc bật kết nối bàn đạp.
  }

  function enableMIDI() {
    if (_midiInitialized) return Promise.resolve(true);
    _midiInitialized = true;
    return _initWebMIDI();
  }

  function _initWebMIDI() {
    if (typeof navigator === 'undefined' || !navigator.requestMIDIAccess) {
      return Promise.resolve(false);
    }
    return navigator.requestMIDIAccess().then(midi => {
      midi.inputs.forEach(input => {
        input.onmidimessage = _onMIDIMessage;
      });
      midi.onstatechange = (e) => {
        if (e.port.type === 'input' && e.port.state === 'connected') {
          e.port.onmidimessage = _onMIDIMessage;
          window.App?.showToast?.(`🔌 Bàn đạp MIDI đã kết nối: ${e.port.name}`, 'info');
        }
      };
      return true;
    }).catch(() => false);
  }

  function _onMIDIMessage(event) {
    const [status, note, velocity] = event.data || [];
    if (velocity > 0) {
      const wrapper = document.querySelector('.sheet-viewer-wrapper') || document.documentElement;
      const scrollAmount = (wrapper?.clientHeight || 600) * 0.75;

      if (note === 60 || note === 64 || status === 176) {
        if (wrapper) wrapper.scrollBy({ top: scrollAmount, behavior: 'smooth' });
      } else if (note === 62 || note === 67) {
        if (wrapper) wrapper.scrollBy({ top: -scrollAmount, behavior: 'smooth' });
      }
    }
  }


  function _turnPageOrScroll(direction) {
    const wrapper = document.querySelector('.sheet-viewer-wrapper') || document.documentElement;
    if (window.PageNav && PageNav.getTotalPages() > 1) {
      if (direction > 0) PageNav.goToNext();
      else PageNav.goToPrev();
    } else if (wrapper) {
      const scrollAmount = wrapper.clientHeight * 0.75;
      wrapper.scrollBy({ top: direction * scrollAmount, behavior: 'smooth' });
    }
  }

  function _onKey(e) {
    // Bỏ qua khi đang nhập liệu
    const tag = document.activeElement?.tagName?.toLowerCase();
    const isEditable = document.activeElement?.isContentEditable;
    if (['input','textarea','select'].includes(tag) || isEditable) return;

    // Nếu đang focus nút bấm (button), blur để phím tắt hoạt động thông suốt
    if (tag === 'button') {
      document.activeElement.blur();
    }

    const xml = Store.get('originalXml');

    switch (e.key) {
      // Ticket L0-8: Bàn đạp an toàn: ArrowDown/ArrowUp = lật trang / cuộn trang.
      // Đổi bài chỉ bằng nút giao diện hoặc Shift + ArrowDown / ArrowUp.
      case 'ArrowDown':
        e.preventDefault();
        if (e.shiftKey) {
          if (window.SetlistUI?.getCurrentSetlist?.()) { SetlistUI.next(); }
          else { App?.navigateNext?.(); }
        } else {
          _turnPageOrScroll(+1);
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (e.shiftKey) {
          if (window.SetlistUI?.getCurrentSetlist?.()) { SetlistUI.prev(); }
          else { App?.navigatePrev?.(); }
        } else {
          _turnPageOrScroll(-1);
        }
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
      case '[':
        if (!e.ctrlKey && !e.metaKey && xml) { e.preventDefault(); App?.transposeBy?.(-1); }
        break;
      case ']':
        if (!e.ctrlKey && !e.metaKey && xml) { e.preventDefault(); App?.transposeBy?.(+1); }
        break;
      case 's': case 'S':
        if (!e.ctrlKey && !e.metaKey) { e.preventDefault(); App?.toggleSidebar?.(); }
        break;
      case '0': if (xml) App?.resetTranspose?.(); break;
      case 'PageDown':
        e.preventDefault();
        _turnPageOrScroll(+1);
        break;
      case 'PageUp':
        e.preventDefault();
        _turnPageOrScroll(-1);
        break;
      case 'c': case 'C':
        if (xml) {
          window.ModeManager ? window.ModeManager.toggleEditChords() : ChordCanvas?.toggleAddMode?.();
        }
        break;
      case 'h': case 'H': if (xml) ChordCanvas?.toggleHighlight?.(); break; // Highlight mode
      case 'f': case 'F':
        window.ModeManager ? window.ModeManager.togglePerformance() : AppUI?.toggleFullscreen?.();
        break;
      case 'v': case 'V':
        if (!e.ctrlKey && !e.metaKey && !e.altKey && xml) {
          if (window.VerseManager?.hasMultipleVerses?.()) {
            e.preventDefault();
            if (e.shiftKey) {
              window.VerseManager.prevVerse();
            } else {
              window.VerseManager.nextVerse();
            }
          }
        }
        break;
      case 'p': case 'P': if (xml) window.print(); break;
      case 'd': case 'D': document.getElementById('btn-dark-toggle')?.click(); break;
      case '#':
        e.preventDefault();
        window.QuickNumpadModal?.toggle?.();
        break;
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
        // Ticket L0-16: ModeManager làm chủ duy nhất việc điều phối phím Escape
        if (window.ModeManager?.handleEscape) {
          window.ModeManager.handleEscape(e);
        } else if (window.ModeManager?.resetToView) {
          window.ModeManager.resetToView();
        } else if (window.ModalManager?.closeTopmost) {
          window.ModalManager.closeTopmost();
        }
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

  return {
    init,
    enableMIDI,
    initWebMIDI: enableMIDI,
    isMidiEnabled: () => _midiInitialized
  };
})();

window.KeyboardHandler = KeyboardHandler;
