/**
 * app.js — Main Application Controller (Orchestration Only)
 * v3: Tách state → Store, loading → SongLoader, keyboard → KeyboardHandler,
 *     toolbar → ToolbarController, API → ApiService.
 * File này chỉ còn: init, navigation, transpose, zoom.
 */
const App = (() => {
  'use strict';

  /* ── INIT ── */
  function init() {
    OSMDRenderer.init('osmd-container');
    OSMDRenderer.onReady(() => {
      ChordCanvas?.onOSMDRendered?.();
      window.AnnotationCanvas?.onOSMDRendered?.();
      AppUI.enableControls(true);
      window.PageNav?.computePages?.();
      window.ScriptLoader?.prefetchIdle?.();
    });

    // Init các modules có mặt
    ChordCanvas?.init?.();
    if (window.InstrumentMixer) InstrumentMixer.init();
    if (window.AnnotationCanvas) AnnotationCanvas.init();
    if (window.SheetAudioPlayer) SheetAudioPlayer.init();
    if (window.AutoScroller) AutoScroller.init();
    if (window.PageNav) PageNav.init();
    if (window.Auth) window.Auth.init();
    LibraryUI?.init?.();
    if (window.SetlistUI) SetlistUI.init();
    if (window.Importer) Importer.init();
    if (window.DisplaySettings) DisplaySettings.init();
    if (window.StageLens) window.StageLens.init();
    if (window.GuitarLens) window.GuitarLens.init();
    if (window.BassLens) window.BassLens.init();
    if (window.DrumsLens) window.DrumsLens.init();
    if (window.VocalsLens) window.VocalsLens.init();
    if (window.HarmonicNumeral) window.HarmonicNumeral.init();
    if (window.PerformanceNotes) PerformanceNotes.init();
    if (window.SongInfoBar) SongInfoBar.init();
    if (window.Metronome) Metronome.init();
    if (window.ArrangementEngine) window.ArrangementEngine.init();
    if (window.CueEngine) window.CueEngine.init();
    if (window.LiveSession) LiveSession.init();
    if (window.PerformanceEngine) window.PerformanceEngine.init();
    if (window.LiveSync) window.LiveSync.init();

    ToolbarController?.init?.();
    if (window.MobileController) window.MobileController.init();
    KeyboardHandler?.init?.();
    if (window.ServiceWorkerManager) ServiceWorkerManager.register();
    if (window.OfflineSetlistManager?.checkOnStartup) window.OfflineSetlistManager.checkOnStartup();

    // Library callbacks
    LibraryUI?.onSelect?.(song => SongLoader.load(song));
    LibraryUI?.onDelete?.(songId => {
      if (Store.get('currentSong')?.id === songId) {
        AppUI.showWelcome();
        Store.reset();
        ChordCanvas?.clearSong?.();
        window.AnnotationCanvas?.clearSong?.();
        window.SheetAudioPlayer?.stop?.();
        if (window.Metronome) Metronome.stop();
        window.PageNav?.reset?.();
        EventBus.emit('song:cleared');
      }
    });

    if (window.Importer) {
      Importer.onSuccess(song => {
        LibraryUI?.addSong?.(song);
        AppUI.showToast(`🎵 "${song.title}" đã thêm vào thư viện!`, 'success');
      });
    }
  }

  /* ── NAVIGATION ── */
  function navigateNext() {
    const songs = LibraryUI.getSongs();
    const song  = Store.get('currentSong');
    const idx   = song ? songs.findIndex(s => s.id === song.id) : -1;
    const next  = songs[idx + 1];
    if (next) LibraryUI.selectSong(next.id);
  }

  function navigatePrev() {
    const songs = LibraryUI.getSongs();
    const song  = Store.get('currentSong');
    const idx   = song ? songs.findIndex(s => s.id === song.id) : songs.length;
    const prev  = songs[idx - 1];
    if (prev) LibraryUI.selectSong(prev.id);
  }

  /* ── TRANSPOSE ── */
  let _transposeTimer = null;

  function transposeBy(delta) {
    const xml = Store.get('originalXml');
    if (!xml) return;
    const newVal = Store.get('currentTranspose') + delta;
    if (Math.abs(newVal) > 12) { AppUI.showToast('Giới hạn ±12 nửa cung', 'warning'); return; }
    Store.set('currentTranspose', newVal);
    AppUI.updateTransposeDisplay(newVal);
    AppUI.updateSongInfo(Store.get('currentSong'), newVal);
    window.URLState?.update?.({ t: newVal });
    if (typeof EventBus !== 'undefined') {
      EventBus.emit('transpose:changed', { value: newVal });
    }
    clearTimeout(_transposeTimer);
    _transposeTimer = setTimeout(() => SongLoader.commitTranspose(), 100);
  }

  async function resetTranspose() {
    if (Store.get('currentTranspose') === 0) return;
    clearTimeout(_transposeTimer);
    Store.set('currentTranspose', 0);
    AppUI.updateTransposeDisplay(0);
    AppUI.updateSongInfo(Store.get('currentSong'), 0);
    window.URLState?.update?.({ t: 0 });
    if (typeof EventBus !== 'undefined') {
      EventBus.emit('transpose:changed', { value: 0 });
    }
    await SongLoader.commitTranspose();
    SessionTracker?.setTranspose?.(0);
  }

  /* ── ZOOM ── */
  async function setZoom(percent) {
    const zoom = percent / 100;
    const prevZoom = Store.get('currentZoom');
    Store.set('currentZoom', zoom);

    if (localStorage.getItem('sheetapp_zoom_locked') === 'true') {
      localStorage.setItem('sheetapp_locked_zoom_val', String(percent));
    }

    const slider = document.getElementById('zoom-slider');
    if (slider) {
      if (slider.tagName.toLowerCase() === 'select') {
        const best = Array.from(slider.options).reduce((a,b) =>
          Math.abs(parseInt(b.value)-percent) < Math.abs(parseInt(a.value)-percent) ? b : a);
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

    await OSMDRenderer.setZoom(zoom);
    SessionTracker?.setZoom?.(zoom);
    // INTENTIONAL: Không gọi thủ công onOSMDRendered nữa vì OSMDRenderer.setZoom đã tự kích hoạt thông qua onReady callback.
  }


  /* ── Measure Progress (Sprint E1) ── */
  function updateMeasureProgress(current, total) {
    if (!total) return;
    const fill = document.getElementById('measure-progress-fill');
    if (fill) fill.style.width = Math.round((current / total) * 100) + '%';
  }

  function setTransposeDirect(val) {
    const num = parseInt(val, 10) || 0;
    if (Math.abs(num) > 12) return;
    if (Store.get('currentTranspose') === num) return;
    Store.set('currentTranspose', num);
    AppUI.updateTransposeDisplay(num);
    AppUI.updateSongInfo(Store.get('currentSong'), num);
    window.URLState?.update?.({ t: num });
    if (typeof EventBus !== 'undefined') {
      EventBus.emit('transpose:changed', { value: num });
    }
    clearTimeout(_transposeTimer);
    _transposeTimer = setTimeout(() => SongLoader.commitTranspose(), 250);
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
      return SongLoader.load(song, t);
    },
    loadSongWithProfile: (song, profile, t, options) => {
      return options ? SongLoader.load(song, t, profile, options) : SongLoader.load(song, t, profile);
    },
    loadSongXmlDirect: async (songId, xml, transpose = 0, profile = 'HD') => {
      return SongLoader.load({ id: songId, xmlPath: `storage/Thanh ca/${songId}.xml` }, transpose, profile, { instant: true });
    },
    transposeBy, resetTranspose, setTransposeDirect, setZoom, navigateNext, navigatePrev,
    toggleSidebar:       ()    => ToolbarController?.toggleSidebar?.(),
    saveModifiedXML:     (xml) => SongLoader.saveModifiedXML(xml),
    reloadCurrentXML:    ()    => SongLoader.commitTranspose(),
    getCurrentTranspose: ()    => Store.get('currentTranspose'),
    getCurrentSongId:    ()    => Store.get('currentSong')?.id ?? null,
    getCurrentZoom:      ()    => Store.get('currentZoom'),
    getOriginalXml:      ()    => Store.get('originalXml'),
    showToast:           (m,t) => AppUI.showToast(m, t),
    showLoading:         (t)   => AppUI.showLoading(t),
    hideLoading:         ()    => AppUI.hideLoading(),
    updateMeasureProgress,
  };
})();

window.App = App;
