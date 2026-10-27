/**
 * app.js — Main Application Controller (Orchestration Only)
 * v3: Tách state → Store, loading → SongLoader, keyboard → KeyboardHandler,
 *     toolbar → ToolbarController, API → ApiService.
 * File này chỉ còn: init, navigation, transpose, zoom.
 */
const App = (() => {
  'use strict';

  function _safeInit(name, fn) {
    if (window.BootRunner && typeof window.BootRunner.safeInit === 'function') {
      return window.BootRunner.safeInit(name, fn);
    }
    try {
      fn();
      return true;
    } catch (err) {
      window.ErrorReporter?.report?.({
        type: 'boot_error',
        module: name,
        message: err?.message || String(err),
        stack: err?.stack || '',
      });
      return false;
    }
  }

  /* ── INIT ── */
  function init() {
    // M1-1: Gắn onSelect đầu tiên để chạm bài luôn mở bài kể cả khi module sau lỗi
    _safeInit('LibraryUI.onSelect', () => {
      window.LibraryUI?.onSelect?.(song => window.SongLoader?.load?.(song));
    });
    _safeInit('LibraryUI.onDelete', () => {
      window.LibraryUI?.onDelete?.(songId => {
        if (window.Store?.get?.('currentSong')?.id === songId) {
          window.AppUI?.showWelcome?.();
          window.Store?.reset?.();
          window.ChordCanvas?.clearSong?.();
          window.AnnotationCanvas?.clearSong?.();
          window.SheetAudioPlayer?.stop?.();
          window.Metronome?.stop?.();
          window.PageNav?.reset?.();
          window.EventBus?.emit?.('song:cleared');
        }
      });
    });
    _safeInit('Importer.onSuccess', () => {
      window.Importer?.onSuccess?.(song => {
        window.LibraryUI?.addSong?.(song);
        window.AppUI?.showToast?.(`🎵 "${song.title}" đã thêm vào thư viện!`, 'success');
      });
    });

    _safeInit('SongNavigation', () => window.SongNavigation?.init?.());
    _safeInit('OSMDRenderer', () => {
      window.OSMDRenderer?.init?.('osmd-container');
      window.OSMDRenderer?.onReady?.(() => {
        window.ChordCanvas?.onOSMDRendered?.();
        window.AnnotationCanvas?.onOSMDRendered?.();
        window.AppUI?.enableControls?.(true);
        window.PageNav?.computePages?.();
      });
    });

    // Init tất cả modules qua window.X
    _safeInit('ChordCanvas', () => window.ChordCanvas?.init?.());
    _safeInit('InstrumentMixer', () => window.InstrumentMixer?.init?.());
    _safeInit('AnnotationCanvas', () => window.AnnotationCanvas?.init?.());
    _safeInit('SheetAudioPlayer', () => window.SheetAudioPlayer?.init?.());
    _safeInit('AutoScroller', () => window.AutoScroller?.init?.());
    _safeInit('PageNav', () => window.PageNav?.init?.());
    _safeInit('Auth', () => window.Auth?.init?.());
    _safeInit('LibraryUI', () => window.LibraryUI?.init?.());
    _safeInit('SetlistUI', () => window.SetlistUI?.init?.());
    _safeInit('Importer', () => window.Importer?.init?.());
    _safeInit('DisplaySettings', () => window.DisplaySettings?.init?.());
    _safeInit('PerformanceNotes', () => window.PerformanceNotes?.init?.());
    _safeInit('SongInfoBar', () => window.SongInfoBar?.init?.());
    _safeInit('Metronome', () => window.Metronome?.init?.());
    _safeInit('HarmonicNumeral', () => window.HarmonicNumeral?.init?.());

    _safeInit('ToolbarController', () => window.ToolbarController?.init?.());
    _safeInit('KeyboardHandler', () => window.KeyboardHandler?.init?.());
    _safeInit('ServiceWorkerManager', () => window.ServiceWorkerManager?.register?.());
    window.BootRunner?.markReady?.();
  }

  /* ── NAVIGATION ── */
  function navigateNext() {
    window.SongNavigation?.request(1);
  }

  function navigatePrev() {
    window.SongNavigation?.request(-1);
  }

  /* ── TRANSPOSE ── */
  let _transposeTimer = null;

  function transposeBy(delta) {
    const xml = window.Store?.get?.('originalXml');
    if (!xml) return;
    const newVal = (window.Store?.get?.('currentTranspose') || 0) + delta;
    if (Math.abs(newVal) > 8) { window.AppUI?.showToast?.('Giới hạn ±8 tông', 'warning'); return; }
    window.Store?.set?.('currentTranspose', newVal);
    window.AppUI?.updateTransposeDisplay?.(newVal);
    window.AppUI?.updateSongInfo?.(window.Store?.get?.('currentSong'), newVal);
    window.URLState?.update?.({ t: newVal });
    clearTimeout(_transposeTimer);
    _transposeTimer = setTimeout(() => window.SongLoader?.commitTranspose?.(), 400);
  }

  async function resetTranspose() {
    if (window.Store?.get?.('currentTranspose') === 0) return;
    clearTimeout(_transposeTimer);
    window.Store?.set?.('currentTranspose', 0);
    window.AppUI?.updateTransposeDisplay?.(0);
    window.AppUI?.updateSongInfo?.(window.Store?.get?.('currentSong'), 0);
    window.URLState?.update?.({ t: 0 });
    await window.SongLoader?.commitTranspose?.();
    window.SessionTracker?.setTranspose?.(0);
  }

  /* ── ZOOM ── */
  async function setZoom(percent) {
    const zoom = percent / 100;
    window.Store?.set?.('currentZoom', zoom);
    const slider = document.getElementById('zoom-slider');
    if (slider) {
      if (slider.tagName.toLowerCase() === 'select') {
        const best = Array.from(slider.options).reduce((a, b) =>
          Math.abs(parseInt(b.value) - percent) < Math.abs(parseInt(a.value) - percent) ? b : a);
        slider.value = best.value;
      } else { slider.value = percent; }
    }
    const lbl = document.getElementById('zoom-value-label');
    if (lbl) lbl.textContent = percent + '%';
    await window.OSMDRenderer?.setZoom?.(zoom);
    window.SessionTracker?.setZoom?.(zoom);
    const lvc = document.getElementById('lyric-view-container');
    if (lvc) lvc.style.fontSize = `${percent}%`;
  }

  /* ── Measure Progress (Sprint E1) ── */
  function updateMeasureProgress(current, total) {
    if (!total) return;
    const fill = document.getElementById('measure-progress-fill');
    if (fill) fill.style.width = Math.round((current / total) * 100) + '%';
  }

  // Boot
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return {
    // Public API (backward compat)
    loadSong: (song, t) => window.SongLoader?.load?.(song, t),
    loadSongWithProfile: (song, profile, t) => {
      return window.SongLoader?.load?.(song, t, profile);
    },
    transposeBy, resetTranspose, setZoom, navigateNext, navigatePrev,
    saveModifiedXML:     (xml) => window.SongLoader?.saveModifiedXML?.(xml),
    reloadCurrentXML:    ()    => window.SongLoader?.commitTranspose?.(),
    getCurrentTranspose: ()    => window.Store?.get?.('currentTranspose'),
    getCurrentSongId:    ()    => window.Store?.get?.('currentSong')?.id ?? null,
    getCurrentZoom:      ()    => window.Store?.get?.('currentZoom'),
    getOriginalXml:      ()    => window.Store?.get?.('originalXml'),
    showToast:           (m, t) => window.AppUI?.showToast?.(m, t),
    showLoading:         (t)   => window.AppUI?.showLoading?.(t),
    hideLoading:         ()    => window.AppUI?.hideLoading?.(),
    updateMeasureProgress,
  };
})();

window.App = App;
