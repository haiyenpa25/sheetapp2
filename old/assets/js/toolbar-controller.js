/**
 * toolbar-controller.js — Toolbar Controls Binding
 * Tách từ app.js: bind toolbar buttons (transpose, zoom, sidebar, capo...).
 */
const ToolbarController = (() => {
  'use strict';

  function _safeBind(name, fn) {
    if (typeof window !== 'undefined' && window.BootRunner?.safeInit) { window.BootRunner.safeInit(name, fn); return; }
    try { fn(); } catch (err) { console.error('[ToolbarController] ' + name + ' failed:', err); }
  }

  function init() {
    _safeBind('ToolbarController._bindTranspose', _bindTranspose);
    _safeBind('ToolbarController._bindZoom', _bindZoom);
    _safeBind('ToolbarController._bindSidebar', _bindSidebar);
    _safeBind('ToolbarController._bindDarkMode', _bindDarkMode);
    _safeBind('ToolbarController._bindMisc', _bindMisc);
  }

  function _bindTranspose() {
    document.getElementById('btn-transpose-up')?.addEventListener('click', e =>
      { e.currentTarget.blur(); App?.transposeBy?.(+1); });
    document.getElementById('btn-transpose-down')?.addEventListener('click', e =>
      { e.currentTarget.blur(); App?.transposeBy?.(-1); });
    document.getElementById('btn-transpose-reset')?.addEventListener('click', e =>
      { e.currentTarget.blur(); App?.resetTranspose?.(); });
    document.getElementById('transpose-display')?.addEventListener('click', () =>
      App?.resetTranspose?.());

    document.getElementById('capo-select')?.addEventListener('change', e => {
      const newCapo = parseInt(e.target.value) || 0;
      const delta   = newCapo - Store.get('currentTranspose');
      Store.set('capoLevel', newCapo);
      if (delta !== 0) App?.transposeBy?.(delta);
    });
  }

  function _bindZoom() {
    const el = document.getElementById('zoom-slider');
    if (!el) return;
    const evt = el.tagName.toLowerCase() === 'select' ? 'change' : 'input';
    el.addEventListener(evt, e => App?.setZoom?.(parseInt(e.target.value, 10)));
  }

  function _bindSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    function _openSidebar() {
      sidebar?.classList.remove('mobile-hidden');
      overlay?.classList.remove('hidden');
      if (overlay) {
        overlay.onclick = _closeSidebar;
      }
    }

    function _closeSidebar() {
      sidebar?.classList.add('mobile-hidden');
      overlay?.classList.add('hidden');
    }

    function _toggle() {
      if (!sidebar) return;
      if (window.innerWidth <= 900) {
        if (sidebar.classList.contains('mobile-hidden')) {
          _openSidebar();
        } else {
          _closeSidebar();
        }
      } else {
        sidebar.classList.toggle('collapsed');
      }
    }

    document.getElementById('btn-toggle-sidebar')?.addEventListener('click', _toggle);
    document.getElementById('btn-open-sidebar')?.addEventListener('click', _toggle);

    if (window.innerWidth <= 900) {
      sidebar?.classList.add('mobile-hidden');
      overlay?.classList.add('hidden');
    }

    let _lastWasMobile = window.innerWidth <= 900;
    window.addEventListener('resize', () => {
      const isMobileNow = window.innerWidth <= 900;
      if (isMobileNow === _lastWasMobile) return;
      _lastWasMobile = isMobileNow;
      if (isMobileNow) {
        if (!sidebar?.classList.contains('mobile-hidden')) _closeSidebar();
        sidebar?.classList.remove('collapsed');
      } else {
        sidebar?.classList.remove('mobile-hidden');
        overlay?.classList.add('hidden');
      }
    });

    if ('onorientationchange' in window) {
      window.addEventListener('orientationchange', () => {
        if (window.innerWidth <= 900) _closeSidebar();
      });
    }

    window._closeSidebar = _closeSidebar;
  }

  function _bindDarkMode() {
    const btnToggle = document.getElementById('btn-dark-toggle');
    const btnMenu   = document.getElementById('btn-dark-mode');
    const saved = (window.SafeStorage ? window.SafeStorage.get('sheetapp_dark_mode') : localStorage.getItem('sheetapp_dark_mode')) === '1';
    if (saved) {
      document.body.classList.add('dark-mode');
      btnToggle?.classList.add('dark-active');
      btnMenu?.classList.add('active');
    }
    function toggleDark() {
      const on = document.body.classList.toggle('dark-mode');
      btnToggle?.classList.toggle('dark-active', on);
      btnMenu?.classList.toggle('active', on);
      if (window.SafeStorage) window.SafeStorage.set('sheetapp_dark_mode', on ? '1' : '0');
      else { try { localStorage.setItem('sheetapp_dark_mode', on ? '1' : '0'); } catch (_) {} }
      App?.showToast?.(on ? '🌙 Chế độ tối' : '☀️ Chế độ sáng', 'info');
    }
    btnToggle?.addEventListener('click', toggleDark);
    btnMenu?.addEventListener('click', toggleDark);
  }

  function _bindMisc() {
    document.getElementById('btn-fullscreen')?.addEventListener('click', () => AppUI?.toggleFullscreen?.());
    document.getElementById('btn-switch-new-ui')?.addEventListener('click', e => { if (window.URLState?.interfaceUrl) { e.preventDefault(); window.location.href = window.URLState.interfaceUrl(false); } });
    document.getElementById('btn-print')?.addEventListener('click', () => window.print());
    document.getElementById('btn-session-panel')?.addEventListener('click', () => PerformanceNotes?.toggle?.());
    document.getElementById('btn-help')?.addEventListener('click', () => window._helpModalOpen?.('guide'));
    document.getElementById('menu-instrument-annotations')?.addEventListener('click', () => {
      document.getElementById('btn-instrument-annotations')?.click();
    });

    // M4-9b: Menu ⋮ proxy listeners cho các công cụ hợp âm & ghim bài
    document.getElementById('menu-chord-highlight')?.addEventListener('click', () => {
      if (window.ChordCanvas?.toggleHighlight) window.ChordCanvas.toggleHighlight();
      else document.getElementById('btn-chord-highlight')?.click();
    });
    document.getElementById('menu-chord-notation')?.addEventListener('click', () => {
      document.getElementById('btn-chord-notation')?.click();
    });
    document.getElementById('menu-add-chord')?.addEventListener('click', () => {
      if (window.ChordCanvas?.toggleAddMode) window.ChordCanvas.toggleAddMode();
      else document.getElementById('btn-add-chord-mode-bar')?.click();
    });
    document.getElementById('menu-new-chord-set')?.addEventListener('click', () => {
      window.ChordCanvas?.showNewSetModal?.();
    });
    document.getElementById('menu-pin-song')?.addEventListener('click', () => {
      const curSong = window.Store?.get?.('currentSong');
      if (curSong?.id && window.LibraryUI?.togglePin) window.LibraryUI.togglePin(curSong.id);
      else document.getElementById('btn-pin-current-song')?.click();
    });

    document.getElementById('btn-compact-mode')?.addEventListener('click', e => {
      const btn = e.currentTarget;
      const isCompact = OSMDRenderer?.getCompactMode?.();
      OSMDRenderer?.setCompactMode?.(!isCompact);
      btn.classList.toggle('active', !isCompact);
      btn.style.color = !isCompact ? 'var(--accent)' : '';
      window.URLState?.update?.({ compact: !isCompact });
    });

    // Volume slider
    const vol = document.getElementById('audio-volume');
    if (vol) {
      vol.addEventListener('input', () => {
        _updateTrackFill(vol);
        SheetAudioPlayer?.setVolume?.(parseInt(vol.value));
      });
      _updateTrackFill(vol);
    }

    // Session panel buttons
    document.getElementById('btn-close-session')?.addEventListener('click', () =>
      document.getElementById('session-panel')?.classList.add('hidden'));
    document.getElementById('btn-save-session')?.addEventListener('click', async () => {
      const note = document.getElementById('session-note')?.value.trim() || '';
      await SessionTracker?.saveNow?.(note);
      AppUI?.updateSessionPanel?.(Store.get('currentTranspose'), SessionTracker?.getHistory?.());
      App?.showToast?.('💾 Đã lưu nhật ký', 'success');
    });
  }

  function _updateTrackFill(slider) {
    const min = parseFloat(slider.min ?? 0), max = parseFloat(slider.max ?? 100), val = parseFloat(slider.value ?? 0);
    const pct = max > min ? Math.round(((val-min)/(max-min))*100) : 0;
    slider.style.background = `linear-gradient(to right, var(--accent,#7c3aed) 0%, var(--accent,#7c3aed) ${pct}%, #d1d5db ${pct}%)`;
  }

  function _debounce(fn, ms) { let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); }; }

  return { init };
})();

window.ToolbarController = ToolbarController;
