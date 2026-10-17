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
      AnnotationCanvas?.onOSMDRendered?.();
      AppUI.enableControls(true);
      PageNav.computePages();
    });

    // Init tất cả modules
    ChordCanvas.init();
    if (window.InstrumentMixer) InstrumentMixer.init();
    AnnotationCanvas.init();
    SheetAudioPlayer.init();
    AutoScroller.init();
    PageNav.init();
    if (window.Auth)             Auth.init();
    LibraryUI.init();
    if (window.SetlistUI)        SetlistUI.init();
    if (window.Importer)         Importer.init();
    if (window.DisplaySettings)  DisplaySettings.init();
    if (window.PerformanceNotes) PerformanceNotes.init();
    if (window.SongInfoBar)      SongInfoBar.init();
    if (window.Metronome)        Metronome.init();

    ToolbarController.init();
    KeyboardHandler.init();
    if (window.ServiceWorkerManager) ServiceWorkerManager.register();


    // Library callbacks
    LibraryUI.onSelect(song => SongLoader.load(song));
    LibraryUI.onDelete(songId => {
      if (Store.get('currentSong')?.id === songId) {
        AppUI.showWelcome();
        Store.reset();
        ChordCanvas.clearSong();
        AnnotationCanvas.clearSong();
        SheetAudioPlayer.stop();
        if (window.Metronome) Metronome.stop();
        PageNav.reset();
        EventBus.emit('song:cleared');
      }
    });

    if (window.Importer) {
      Importer.onSuccess(song => {
        LibraryUI.addSong(song);
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
    if (Math.abs(newVal) > 8) { AppUI.showToast('Giới hạn ±8 tông', 'warning'); return; }
    Store.set('currentTranspose', newVal);
    AppUI.updateTransposeDisplay(newVal);
    AppUI.updateSongInfo(Store.get('currentSong'), newVal);
    window.URLState?.update?.({ t: newVal });
    clearTimeout(_transposeTimer);
    _transposeTimer = setTimeout(() => SongLoader.commitTranspose(), 400);
  }

  async function resetTranspose() {
    if (Store.get('currentTranspose') === 0) return;
    clearTimeout(_transposeTimer);
    Store.set('currentTranspose', 0);
    AppUI.updateTransposeDisplay(0);
    AppUI.updateSongInfo(Store.get('currentSong'), 0);
    window.URLState?.update?.({ t: 0 });
    await SongLoader.commitTranspose();
    SessionTracker?.setTranspose?.(0);
  }

  /* ── ZOOM ── */
  async function setZoom(percent) {
    const zoom = percent / 100;
    Store.set('currentZoom', zoom);
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
    await OSMDRenderer.setZoom(zoom);
    SessionTracker?.setZoom?.(zoom);
    // INTENTIONAL: Không gọi thủ công onOSMDRendered nữa vì OSMDRenderer.setZoom đã tự kích hoạt thông qua onReady callback.
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
  document.addEventListener('DOMContentLoaded', init);

  return {
    // Public API (backward compat)
    loadSong: (song, t) => SongLoader.load(song, t),
    loadSongWithProfile: (song, profile, t) => {
      return SongLoader.load(song, t, profile);
    },
    transposeBy, resetTranspose, setZoom, navigateNext, navigatePrev,
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
