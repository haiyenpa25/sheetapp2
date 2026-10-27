/**
 * song-loader.js — Song Loading & XML Management
 * Tách từ app.js: chịu trách nhiệm load/reload/save bài hát.
 * Phụ thuộc: Store, EventBus, ApiService, OSMDRenderer, AppUI, ChordCanvas, SongLoaderCore
 */
const SongLoader = (() => {
  'use strict';

  let _isFirstLoad = true;
  let _autoFitRetryCount = 0; // Module-scoped, không dùng window.*

  /* ── Load bài hát hoàn chỉnh ── */
  async function load(song, transposeOverride = null, profileOverride = 'HD', options = {}) {
    if (!song?.xmlPath) { AppUI.showToast('Bài hát chưa có file sheet nhạc', 'error'); return; }
    const session = window.SongLoaderCore.beginLoad();
    const token = session.token;
    const abortSignal = session.signal || undefined;

    Store.set('currentSong', song);
    Store.set('currentTranspose', transposeOverride ?? 0);
    AppUI.updateSongInfo(song, transposeOverride ?? 0); AppUI.updateTransposeDisplay(transposeOverride ?? 0);
    Store.set('capoLevel', 0);
    _autoFitRetryCount = 0; // BUG-12 fix: reset retry budget cho mỗi bài mới

    // Reset nhanh các state cũ
    _resetCapoUI();
    SheetAudioPlayer.stop();
    if (window.AutoScroller) AutoScroller.stop();
    if (window.ChordCanvas?.resetSet) ChordCanvas.resetSet();
    if (window.InstrumentMixer?.clearState) InstrumentMixer.clearState();

    // AnnotationCanvas không ảnh hưởng đến render — fire-and-forget
    AnnotationCanvas.loadSong(song.id);
    PageNav.reset();

    AppUI.showLoading(`Đang tải "${song.title}"...`);
    AppUI.enableControls(false);
    _autoCloseSidebar();

    try {
      // ── Fetch XML + session + chord data SONG SONG (tiết kiệm round-trip, tránh race condition) ──
      // FIX BUG-2: ChordCanvas.loadSong() phải hoàn thành TRƯỚC _injectChords() bên dưới.
      // Đặt cùng Promise.all → 3 request song song, _customChords sẵn sàng khi cần.
      AppUI.setLoadingText('Đang tải dữ liệu...');
      const fetchXmlText = async () => {
        const cr = await window.SongLoaderCore.loadXml(song, { token, signal: abortSignal, xml: options?.xml });
        return cr.xml;
      };
      const [xmlSettled, sessionsSettled] = await Promise.allSettled([
        fetchXmlText(),
        ApiService.sessions.load(song.id),
        ChordCanvas.loadSong(song.id, profileOverride)  // đảm bảo chords ready trước render
      ]);
      if (xmlSettled.status === 'rejected') throw xmlSettled.reason;
      const xml = xmlSettled.value;
      const settings = sessionsSettled.status === 'fulfilled' ? (sessionsSettled.value || {}) : {};
      if (!window.SongLoaderCore.isCurrentToken(token)) return;
      Store.set('originalXml', xml);

      const transpose = transposeOverride ?? 0;
      // M3-2: Bắt buộc hiển thị container trước khi render để tính đúng clientWidth và fit zoom trước lần vẽ đầu
      document.getElementById('sheet-area')?.classList.remove('hidden');
      const zoom = settings?.userSettings?.zoomLevel || _computePreloadFitZoom();
      Store.set('currentTranspose', transpose);
      Store.set('currentZoom', zoom);
      if (window.URLState && _isFirstLoad) { _isFirstLoad = false; await _restoreFromURL(); }

      // ── Render OSMD ──
      AppUI.setLoadingText('Đang vẽ bản nhạc...');
      const processedXml = _injectChords(xml);
      OSMDRenderer.setZoomSilent(zoom);

      if (!window.SongLoaderCore.isCurrentToken(token)) return;
      await OSMDRenderer.load(processedXml, transpose);
      if (!window.SongLoaderCore.isCurrentToken(token)) return;

      // ── Post-render tasks ──
      _syncZoomUI(zoom);

      SheetAudioPlayer.setup(OSMDRenderer.getInstance());
      AppUI.updateTransposeDisplay(transpose);
      AppUI.updateSongInfo(song, transpose);
      _updateCapoBadge(xml);

      // Các task phụ — không cần await
      if (window.SongInfoBar) SongInfoBar.loadSong(xml, song);
      if (window.PerformanceNotes) PerformanceNotes.loadSong(song.id); // bỏ await

      _enableAudioControls();
      AppUI.showOSMD();

      // INTENTIONAL: Không gọi thủ công onOSMDRendered nữa vì OSMDRenderer.load đã tự kích hoạt thông qua onReady callback.
      if (window.ChordCanvas?.refreshSetDropdown) {
        setTimeout(() => {
          ChordCanvas.refreshSetDropdown();
          setTimeout(() => window.SongInfoBar?.refreshChordChip?.(), 100);
        }, 150);
      }

      AppUI.updateSessionPanel(transpose, []);
      _showLoadToast(song, transpose);
      const lyricContainer = document.getElementById('lyric-view-container');
      if (lyricContainer && !lyricContainer.classList.contains('hidden')) {
        window.DisplaySettings?.renderLyricViewIfActive?.();
      }
      if (window.HistoryManager) HistoryManager.trackView(song);

      document.getElementById('btn-print')?.removeAttribute('disabled');
      EventBus.emit('song:loaded', { song, xml });

    } catch (err) {
      if (err?.name === 'AbortError' || !window.SongLoaderCore.isCurrentToken(token)) return;
      console.error('[SongLoader]', err);
      AppUI.showToast(`Lỗi: ${err.message}`, 'error');
      if (AppUI.showLoadError) AppUI.showLoadError(song, err.message, () => load(song, transposeOverride, profileOverride, options), () => document.getElementById('btn-lyric-view')?.click());
    }
  }

  /* ── Commit transpose (reload OSMD với XML mới) ── */
  async function commitTranspose(scrollSnapshot = null) {
    const xml = Store.get('originalXml');
    if (!xml) return;
    const transpose = Store.get('currentTranspose');
    const disp = document.getElementById('transpose-display');
    if (disp) disp.style.opacity = '0.5';

    const isLyricActive = !document.getElementById('lyric-view-container')?.classList.contains('hidden');
    const processedXml  = _injectChords(xml);

    if (isLyricActive) {
      SessionTracker.setTranspose(transpose);
      if (window.DisplaySettings?.renderLyricViewIfActive) DisplaySettings.renderLyricViewIfActive();
      _updateCapoBadge(processedXml);
      if (disp) disp.style.opacity = '';
      return;
    }

    const container   = document.querySelector('.sheet-viewer-wrapper');
    const wrapH = scrollSnapshot?.preScrollH ?? (container?.scrollHeight || 0);
    const wrapT = scrollSnapshot?.preScrollT ?? (container?.scrollTop || 0);
    if (container && !scrollSnapshot) container.style.minHeight = wrapH + 'px';

    try {
      if (window.InstrumentMixer?.preserveState) InstrumentMixer.preserveState();
      await OSMDRenderer.reload(processedXml, transpose);
      SessionTracker.setTranspose(transpose);
      _updateCapoBadge(processedXml);
      // INTENTIONAL: Không gọi thủ công onOSMDRendered nữa vì OSMDRenderer.reload đã tự kích hoạt thông qua onReady callback.
    } catch (err) {
      console.warn('[SongLoader] reload lỗi:', err.message);
    } finally {
      if (disp) disp.style.opacity = '';
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (container) {
          container.style.minHeight = '';
          // Cứ set đúng absolute top vì chiều cao không đổi khi thêm/sửa hợp âm!
          container.scrollTo({ left:0, top: wrapT, behavior:'instant' });
        }
      }));
    }
  }

  /* ── Lưu XML đã chỉnh sửa ── */
  async function saveModifiedXML(newXml) {
    const song = Store.get('currentSong');
    if (!song?.xmlPath) return false;

    const container = document.querySelector('.sheet-viewer-wrapper');
    const preScrollH = container?.scrollHeight || 0;
    const preScrollT = container?.scrollTop   || 0;
    if (container && preScrollH > 0) container.style.minHeight = preScrollH + 'px';

    try {
      const result = await ApiService.saveXml(song.xmlPath, newXml);
      if (!result.success) throw new Error(result.message || 'Lỗi không xác định');
      Store.set('originalXml', newXml);
      AppUI.showToast('Đã lưu hợp âm vào file gốc!', 'success');
      await commitTranspose({ preScrollH, preScrollT });
      return true;
    } catch (err) {
      if (container) container.style.minHeight = '';
      AppUI.showToast('Lỗi lưu file: ' + err.message, 'error');
      return false;
    }
  }

  /* ── Private helpers ── */
  function _injectChords(xml) {
    const currentSet = window.ChordCanvas?.getCurrentSet?.() || 'default';
    const chords     = window.ChordCanvas?.getCustomChords?.() ?? {};
    if (currentSet !== 'default' && Object.keys(chords).length > 0) {
      return window.ChordCanvasXML?.cloneAndInjectChords?.(xml, chords) || xml;
    }
    return xml;
  }

  function _updateCapoBadge(xml) {
    if (!window.TransposeEngine) return;
    const set    = window.ChordCanvas?.getCurrentSet?.() || 'default';
    const chords = window.ChordCanvas?.getCustomChords?.();
    let list = (set !== 'default' && chords) ? Object.values(chords) : TransposeEngine.extractChordsFromXML(xml);
    const transpose = Store.get('currentTranspose');
    AppUI.updateCapoBadge(TransposeEngine.suggestBestCapo(list.map(c => TransposeEngine.transposeChord(c, transpose))));
  }

  function _syncZoomUI(zoom) {
    const pct    = Math.round(zoom * 100);
    const slider = document.getElementById('zoom-slider');
    if (slider) {
      if (slider.tagName?.toLowerCase?.() === 'select') {
        const best = Array.from(slider.options).reduce((a,b) =>
          Math.abs(parseInt(b.value)-pct) < Math.abs(parseInt(a.value)-pct) ? b : a);
        slider.value = best.value;
      } else { slider.value = pct; }
    }
    const lbl = document.getElementById('zoom-value-label');
    if (lbl) lbl.textContent = pct + '%';
  }

  function _computePreloadFitZoom() {
    const wrapper = document.querySelector('.sheet-viewer-wrapper');
    const wrapW = wrapper?.clientWidth || (typeof window !== 'undefined' ? window.innerWidth : 1000);
    if (!wrapW || wrapW <= 0) return 1.0;
    const avail = wrapW - 20;
    const container = typeof document !== 'undefined' ? document.getElementById('osmd-container') : null;
    let padX = 56;
    if (container && typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
      const style = window.getComputedStyle(container);
      padX = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
    }
    const contentW = Math.max(100, wrapW - padX);
    const ratio = avail / contentW;
    let pct = Math.round(Math.max(0.5, Math.min(2.0, ratio)) * 20) * 5;
    if (typeof window !== 'undefined' && window.innerWidth <= 680 && pct > 75) pct = 75;
    return pct / 100;
  }

  function _autoFitZoom() {
    const svg = document.getElementById('osmd-container')?.querySelector('svg');
    const wrapper = document.querySelector('.sheet-viewer-wrapper');
    if (!svg || !wrapper) return;
    const avail = wrapper.clientWidth - 20; // 20px = padding
    if (avail <= 0) return;

    let svgW = svg.clientWidth || svg.getBoundingClientRect().width;
    if (!svgW) {
      const viewBox = svg.getAttribute('viewBox');
      if (viewBox) {
        const parts = viewBox.split(' ');
        if (parts.length >= 3) svgW = parseFloat(parts[2]);
      }
    }

    if (!svgW) {
      if (_autoFitRetryCount < 5) {
        _autoFitRetryCount++;
        setTimeout(_autoFitZoom, 50);
      }
      return;
    }
    _autoFitRetryCount = 0; // reset

    const ratio = avail / svgW;
    // Snap sang bước zoom gần nhất (10%, 15%, ..., 200%)
    let pct = Math.round(Math.max(0.1, Math.min(2.0, ratio)) * 20) * 5; // bước 5%
    // OSMD luôn vẽ đầy khung nên ratio ≈ 1; trên điện thoại cần co như bản mới (R4-3), nếu không lời ca dính nhau
    if (window.innerWidth <= 680 && pct > 75) pct = 75;
    // Chỉ apply autofit nếu user chưa chỉnh zoom trong session
    // (container đã được unhide trước render nên OSMD render đúng rồi)
    if (Store.get('currentZoom') === 1.0) window.App?.setZoom?.(pct);
  }

  function _resetCapoUI() {
    const capoSel  = document.getElementById('capo-select');
    const capoHint = document.getElementById('capo-hint');
    if (capoSel)  capoSel.value = '0';
    if (capoHint) capoHint.textContent = '';
  }

  function _autoCloseSidebar() {
    if (window.innerWidth <= 900) {
      // Dùng helper từ toolbar-controller nếu có (đồng bộ overlay)
      if (typeof window._closeSidebar === 'function') {
        window._closeSidebar();
      } else {
        document.getElementById('sidebar')?.classList.add('mobile-hidden');
        document.getElementById('sidebar-overlay')?.classList.add('hidden');
      }
    }
  }

  function _enableAudioControls() {
    const perfBtn = document.getElementById('btn-perf-notes');
    if (perfBtn) perfBtn.disabled = false;
    const vol = document.getElementById('audio-volume');
    if (vol) { vol.disabled = false; }
    SheetAudioPlayer.enableBtn(true);
  }

  function _showLoadToast(song, transpose) {
    const key   = window.SongInfoBar?.getSongKey?.() || '';
    const setLbl = window.ChordSetNames.describe();
    if (window.innerWidth > 680) AppUI.showToast(`🎵 ${song.title}${key ? ' · '+key : ''} · ${setLbl}`, 'info');
  }

  async function _restoreFromURL() {
    if (!window.URLState) return;
    const state = URLState.get();
    if (state.compact && !OSMDRenderer.getCompactMode()) {
      OSMDRenderer.setCompactMode(true);
      const btn = document.getElementById('btn-compact-mode');
      if (btn) { btn.classList.add('active'); btn.style.color = 'var(--accent)'; }
    }
    const urlSet = state.set || '';
    if (urlSet === 'default' && window.ChordCanvas?.switchSet) await ChordCanvas.switchSet('default');
    else if (urlSet && urlSet !== 'default' && urlSet !== 'HD' && ChordCanvas?.getCurrentSet?.() !== urlSet) {
      await ChordCanvas.switchSet(urlSet);
    }
    const hasExplicitViewParam = new URLSearchParams(location.search).has('v');
    const isMobile = window.innerWidth <= 680;
    const savedMode = localStorage.getItem('sheetapp_view_mode');
    const role = (localStorage.getItem('sheetapp_instrument_role') || '').toLowerCase();
    const authRole = (window.Auth?.getUser?.()?.role || '').toLowerCase();
    const isBanHat = role === 'vocals' || role === 'banhat' || authRole === 'banhat';
    const defaultMode = (isMobile && isBanHat) ? 'band' : 'sheet';
    const effectiveMode = savedMode || defaultMode;
    const shouldOpenBand = state.v === 'lyric' || (!hasExplicitViewParam && effectiveMode === 'band');
    const lyric = document.getElementById('lyric-view-container'), osmdEl = document.getElementById('osmd-container');
    const btnLyric = document.getElementById('btn-lyric-view'), btnText = btnLyric?.querySelector('.btn-text');
    if (shouldOpenBand) {
      if (state.lv === 'inline') localStorage.setItem('sheetapp_lyric_mode', 'inline');
      lyric?.classList.remove('hidden');
      if (osmdEl) { osmdEl.classList.add('hidden'); osmdEl.style.display = 'none'; }
      btnLyric?.classList.add('active');
      if (btnText) btnText.textContent = 'Bản Nhạc';
    } else if (lyric && !lyric.classList.contains('hidden')) {
      lyric.classList.add('hidden');
      if (osmdEl) { osmdEl.classList.remove('hidden'); osmdEl.style.display = 'block'; }
      btnLyric?.classList.remove('active');
      if (btnText) btnText.textContent = 'Lời Nhạc';
    }
  }

  return { load, commitTranspose, saveModifiedXML };
})();

window.SongLoader = SongLoader;
