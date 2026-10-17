/**
 * toolbar-controller.js — Toolbar Controls Binding
 * Tách từ app.js: bind toolbar buttons (transpose, zoom, sidebar, capo...).
 */
const ToolbarController = (() => {
  'use strict';

  function init() {
    _bindTranspose();
    _bindZoom();
    _bindSidebar();
    _bindDarkMode();
    _bindMisc();
  }

  function _bindTranspose() {
    document.getElementById('btn-transpose-up')?.addEventListener('click', e =>
      { e.currentTarget.blur(); App?.transposeBy?.(+1); });
    document.getElementById('btn-transpose-down')?.addEventListener('click', e =>
      { e.currentTarget.blur(); App?.transposeBy?.(-1); });
    document.getElementById('btn-transpose-reset')?.addEventListener('click', e =>
      { e.currentTarget.blur(); App?.resetTranspose?.(); });

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
      // Click overlay → đóng
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
        // Mobile/iPad: toggle ỳ nghĩa rõ ràng
        if (sidebar.classList.contains('mobile-hidden')) {
          _openSidebar();
        } else {
          _closeSidebar();
        }
      } else {
        // Desktop: collapse narrow
        sidebar.classList.toggle('collapsed');
      }
    }

    document.getElementById('btn-toggle-sidebar')?.addEventListener('click', _toggle);
    document.getElementById('btn-open-sidebar')?.addEventListener('click', _toggle);

    // Init: mobile bắt đầu ẩn sidebar
    if (window.innerWidth <= 900) {
      sidebar?.classList.add('mobile-hidden');
      overlay?.classList.add('hidden');
    }

    // Resize handler
    let _lastW = window.innerWidth;
    window.addEventListener('resize', _debounce(() => {
      const w = window.innerWidth;
      if (w <= 900) {
        // Chuyển sang mobile: ẩn sidebar nếu đang mở
        if (!sidebar?.classList.contains('mobile-hidden')) {
          _closeSidebar();
        }
        sidebar?.classList.remove('collapsed');
      } else {
        // Chuyển sang desktop: hiện sidebar
        sidebar?.classList.remove('mobile-hidden');
        overlay?.classList.add('hidden');
      }
      const wDelta = Math.abs(w - _lastW);
      _lastW = w;
      if (wDelta > 100 && OSMDRenderer?.getIsLoaded?.()) {
        setTimeout(async () => {
          try {
            const osmdInstance = OSMDRenderer.getInstance();
            const svg = document.getElementById('osmd-container')?.querySelector('svg');
            const wrapper = document.querySelector('.sheet-viewer-wrapper');
            if (svg && wrapper && osmdInstance) {
              const avail = wrapper.clientWidth - 24;
              if (avail > 0 && svg.clientWidth > 0) {
                const ratio = avail / svg.clientWidth;
                const currentZoom = Store.get('currentZoom') || 1.0;
                const pct = Math.round(Math.max(0.3, Math.min(2.5, ratio * currentZoom)) * 20) * 5;
                await App.setZoom(pct);
              }
            } else {
              await osmdInstance?.render?.();
              ChordCanvas?.reposition?.();
            }
          } catch(e) {}
        }, 350);
      }
    }, 250));

    if ('onorientationchange' in window) {
      window.addEventListener('orientationchange', () => {
        // Xử lý xoay màn hình: đóng sidebar rồi re-render
        if (window.innerWidth <= 900) _closeSidebar();
        setTimeout(async () => {
          if (!OSMDRenderer?.getIsLoaded?.()) return;
          try {
            const osmdInstance = OSMDRenderer.getInstance();
            const svg = document.getElementById('osmd-container')?.querySelector('svg');
            const wrapper = document.querySelector('.sheet-viewer-wrapper');
            if (svg && wrapper && osmdInstance) {
              const avail = wrapper.clientWidth - 24;
              if (avail > 0 && svg.clientWidth > 0) {
                const ratio = avail / svg.clientWidth;
                const currentZoom = Store.get('currentZoom') || 1.0;
                const pct = Math.round(Math.max(0.3, Math.min(2.5, ratio * currentZoom)) * 20) * 5;
                await App.setZoom(pct);
              }
            } else {
              await osmdInstance?.render?.();
              ChordCanvas?.reposition?.();
            }
          } catch(e) {}
        }, 500);
      });
    }

    // Expose cho các module khác dùng
    window._closeSidebar = _closeSidebar;
  }

  function _bindDarkMode() {
    const btn = document.getElementById('btn-dark-toggle');
    const saved = localStorage.getItem('sheetapp_dark_mode') === '1';
    if (saved) { document.body.classList.add('dark-mode'); btn?.classList.add('dark-active'); }
    btn?.addEventListener('click', () => {
      const on = document.body.classList.toggle('dark-mode');
      btn.classList.toggle('dark-active', on);
      localStorage.setItem('sheetapp_dark_mode', on ? '1' : '0');
      App?.showToast?.(on ? '🌙 Chế độ tối' : '☀️ Chế độ sáng', 'info');
    });
  }

  function _bindMisc() {
    document.getElementById('btn-fullscreen')?.addEventListener('click', AppUI?.toggleFullscreen);
    document.getElementById('btn-print')?.addEventListener('click', () => window.print());
    document.getElementById('btn-session-panel')?.addEventListener('click', () => PerformanceNotes?.toggle?.());

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
