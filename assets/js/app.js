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

    _safeInit('LeaderNotesBanner', () => window.LeaderNotesBanner?.init?.());
    _safeInit('LiturgyCard', () => window.LiturgyCard?.init?.());
    _safeInit('SongNavigation', () => window.SongNavigation?.init?.());
    _safeInit('OSMDRenderer', () => {
      window.OSMDRenderer?.init?.('osmd-container');
      window.OSMDRenderer?.onReady?.(() => {
        window.ChordCanvas?.onOSMDRendered?.();
        window.AnnotationCanvas?.onOSMDRendered?.();
        window.AppUI?.enableControls?.(true);
        window.PageNav?.computePages?.();
        window.ScriptLoader?.prefetchIdle?.();
      });
    });

    // Init các modules có mặt qua window.X
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
    _safeInit('StageLens', () => window.StageLens && window.StageLens.init());
    _safeInit('GuitarLens', () => window.GuitarLens && window.GuitarLens.init());
    _safeInit('BassLens', () => window.BassLens?.init?.());
    _safeInit('DrumsLens', () => window.DrumsLens?.init?.());
    _safeInit('VocalsLens', () => window.VocalsLens?.init?.());
    _safeInit('HarmonicNumeral', () => window.HarmonicNumeral?.init?.());
    _safeInit('PerformanceNotes', () => window.PerformanceNotes?.init?.());
    _safeInit('SongInfoBar', () => window.SongInfoBar?.init?.());
    _safeInit('Metronome', () => window.Metronome?.init?.());
    _safeInit('ArrangementEngine', () => window.ArrangementEngine?.init?.());
    _safeInit('CueEngine', () => window.CueEngine?.init?.());
    _safeInit('LiveSession', () => window.LiveSession?.init?.());
    _safeInit('PerformanceEngine', () => window.PerformanceEngine?.init?.());
    _safeInit('LiveSync', () => window.LiveSync?.init?.());
    _safeInit('FollowLeader', () => window.FollowLeader?.init?.());

    _safeInit('ToolbarController', () => window.ToolbarController?.init?.());
    _safeInit('MobileController', () => window.MobileController && window.MobileController.init());
    _safeInit('KeyboardHandler', () => window.KeyboardHandler?.init?.());
    _safeInit('ServiceWorkerManager', () => {
      if (window.ServiceWorkerManager) {
        window.ServiceWorkerManager.register();
      } else if (window.ScriptLoader && typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        const loadSw = () => {
          window.ScriptLoader.load('assets/js/core/ServiceWorkerManager.js').then(() => {
            if (window.ServiceWorkerManager) window.ServiceWorkerManager.register();
          });
        };
        if (document.readyState === 'complete') {
          setTimeout(loadSw, 1200);
        } else {
          window.addEventListener('load', () => setTimeout(loadSw, 1200));
        }
      }
    });
    _safeInit('OfflineSetlistManager', () => window.OfflineSetlistManager?.checkOnStartup?.());
    if (window.FAB) {
      _safeInit('FAB', () => window.FAB?.init?.());
    } else {
      document.addEventListener('DOMContentLoaded', () => _safeInit('FAB', () => window.FAB?.init?.()));
    }
    _safeInit('AdminUI', () => window.AdminUI?.init?.());
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
    const maxT = window.AppRules?.MAX_TRANSPOSE ?? 12; if (Math.abs(newVal) > maxT) { window.AppUI?.showToast?.('Giới hạn ±' + maxT + ' nửa cung', 'warning'); return; }
    window.Store?.set?.('currentTranspose', newVal);
    window.AppUI?.updateTransposeDisplay?.(newVal);
    window.AppUI?.updateSongInfo?.(window.Store?.get?.('currentSong'), newVal);
    window.URLState?.update?.({ t: newVal });
    window.EventBus?.emit?.('transpose:changed', { value: newVal });
    clearTimeout(_transposeTimer);
    const SongLoader = window.SongLoader; _transposeTimer = setTimeout(() => SongLoader.commitTranspose(), window.AppRules?.TRANSPOSE_DEBOUNCE_MS ?? 100);
  }

  async function resetTranspose() {
    if (window.Store?.get?.('currentTranspose') === 0) return;
    clearTimeout(_transposeTimer);
    window.Store?.set?.('currentTranspose', 0);
    window.AppUI?.updateTransposeDisplay?.(0);
    window.AppUI?.updateSongInfo?.(window.Store?.get?.('currentSong'), 0);
    window.URLState?.update?.({ t: 0 });
    window.EventBus?.emit?.('transpose:changed', { value: 0 });
    await window.SongLoader?.commitTranspose?.();
    window.SessionTracker?.setTranspose?.(0);
  }

  /* ── ZOOM ── */
  async function setZoom(percent) {
    const zoom = percent / 100;
    const prevZoom = window.Store?.get?.('currentZoom');
    window.Store?.set?.('currentZoom', zoom);

    if (localStorage.getItem('sheetapp_zoom_locked') === 'true') {
      localStorage.setItem('sheetapp_locked_zoom_val', String(percent));
    }

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
    const gigZoom = document.getElementById('gig-hud-zoom');
    if (gigZoom) gigZoom.textContent = percent + '%';
    const lvc = document.getElementById('lyric-view-container');
    if (lvc) lvc.style.fontSize = `${percent}%`;

    // Task 2.8 (F13 fix): Tránh re-render OSMD nếu zoom không thay đổi đáng kể
    if (typeof prevZoom === 'number' && Math.abs(prevZoom - zoom) < 0.01) {
      return;
    }

    await window.OSMDRenderer?.setZoom?.(zoom);
    window.SessionTracker?.setZoom?.(zoom);
  }

  /* ── Measure Progress (Sprint E1) ── */
  function updateMeasureProgress(current, total) {
    if (!total) return;
    const fill = document.getElementById('measure-progress-fill');
    if (fill) fill.style.width = Math.round((current / total) * 100) + '%';
  }

  function setTransposeDirect(val) {
    const num = parseInt(val, 10) || 0;
    if (Math.abs(num) > (window.AppRules?.MAX_TRANSPOSE ?? 12)) return;
    if (window.Store?.get?.('currentTranspose') === num) return;
    window.Store?.set?.('currentTranspose', num);
    window.AppUI?.updateTransposeDisplay?.(num);
    window.AppUI?.updateSongInfo?.(window.Store?.get?.('currentSong'), num);
    window.URLState?.update?.({ t: num });
    window.EventBus?.emit?.('transpose:changed', { value: num });
    clearTimeout(_transposeTimer);
    _transposeTimer = setTimeout(() => window.SongLoader?.commitTranspose?.(), 250);
  }

  // Boot
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return {
    loadSong: (song, t) => {
      document.querySelector('.toolbar-left')?.classList.remove('in-setlist');
      window.LeaderNotesBanner?.hide?.();
      window.VerseManager?.clearSelectedVerses?.();
      window.LiturgyCard?.hide?.();
      return window.SongLoader?.load?.(song, t);
    },
    loadSongWithProfile: (song, profile, t, options) => {
      return options ? window.SongLoader?.load?.(song, t, profile, options) : window.SongLoader.load(song, t, profile);
    },
    loadSongXmlDirect: async (songId, xml, transpose = 0, profile = 'HD') => {
      let song = window.LibraryUI?.getSongObj?.(songId) || window.LibraryUI?.getSongById?.(songId);
      if (!song?.xmlPath) {
        const result = await window.ApiService.songs.get(songId);
        song = result?.data || result;
      }
      if (!song?.xmlPath) throw new Error('Không tìm thấy bản nhạc của ca trưởng');
      const sl = window.SongLoader || (typeof SongLoader !== 'undefined' ? SongLoader : null); return sl?.load?.(song, transpose, profile, { instant: true, xml });
    },
    transposeBy, resetTranspose, setTransposeDirect, setZoom, navigateNext, navigatePrev,
    toggleSidebar:       ()    => window.ToolbarController?.toggleSidebar?.(),
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
