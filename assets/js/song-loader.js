/**
 * song-loader.js — Song Loading & XML Management
 * Tách từ app.js: chịu trách nhiệm load/reload/save bài hát.
 * Phụ thuộc: Store, EventBus, ApiService, OSMDRenderer, AppUI, ChordCanvas
 */
const SongLoader = (() => {
  'use strict';

  let _isFirstLoad = true;
  let _autoFitRetryCount = 0; // Module-scoped, không dùng window.*
  let _currentLoadToken = 0; // Token phiên tải: ngăn race condition khi đổi bài nhanh
  let _currentAbortController = null; // AbortController: hủy ngay lập tức request fetch XML của bài cũ

  /* ── Load bài hát hoàn chỉnh ── */
  async function load(song, transposeOverride = null, profileOverride = 'HD', options = {}) {
    if (!song?.xmlPath) { AppUI.showToast('Bài hát chưa có file sheet nhạc', 'error'); return; }

    const loadToken = ++_currentLoadToken;
    if (_currentAbortController) {
      try { _currentAbortController.abort(); } catch (e) {}
    }
    _currentAbortController = new AbortController();
    const abortSignal = _currentAbortController.signal;

    Store.set('currentSong', song);
    Store.set('currentTranspose', transposeOverride ?? 0);
    Store.set('capoLevel', 0);
    _autoFitRetryCount = 0; // BUG-12 fix: reset retry budget cho mỗi bài mới

    // Reset nhanh các state cũ
    _resetCapoUI();
    window.XmlDocCache?.clear?.();
    window.ChordCanvasDots?.clearGeomCache?.();
    window.SheetAudioPlayer?.stop?.();
    if (window.AutoScroller) AutoScroller.stop();
    if (window.InstrumentMixer?.clearState) InstrumentMixer.clearState();

    window.PageNav?.reset?.();

    // Ticket L3-2: Chuyển bài tức thì không trắng màn hình nếu đã có trong Preloader
    const hasPreloaded = window.SongPreloader?.has?.(song.id, profileOverride);
    const isInstant = options?.instant === true || (hasPreloaded && options?.instant !== false);

    if (!isInstant) {
      window.AnnotationCanvas?.loadSong?.(song.id);
      AppUI.showLoading(`Đang tải "${song.title}"...`);
      AppUI.enableControls(false);
      _autoCloseSidebar();
    }

    try {
      let xml = '';
      let processedXml = '';
      let settings = null;
      const preloaded = isInstant ? window.SongPreloader?.get?.(song.id, profileOverride) : null;

      if (preloaded && preloaded.xml) {
        xml = preloaded.xml;
        window.ChordCanvas?.applyPreloaded?.(profileOverride, preloaded.chordsMap);
        // processedXml của preloader được tính theo trạng thái khổ của bài TRƯỚC;
        // phải cập nhật VerseManager theo bài mới rồi xử lý lại (áp selected_verses của setlist).
        processedXml = _injectChords(xml);
        if (window.VerseManager?.onSongLoaded) window.VerseManager.onSongLoaded(processedXml);
        if (window.VerseManager?.processXml) processedXml = window.VerseManager.processXml(processedXml);
      } else {
        AppUI.setLoadingText('Đang tải dữ liệu...');
        const xmlUrl = (window.ApiService && typeof window.ApiService.resolveUrl === 'function')
          ? window.ApiService.resolveUrl(song.xmlPath)
          : (song.xmlPath || '');
        const fetchXml = async () => {
          try {
            // INTENTIONAL EXCEPTION: Static MusicXML asset fetch
            const r = await fetch(xmlUrl, { signal: abortSignal });
            if (r.ok) return r;
          } catch (e) {}
          if (typeof caches !== 'undefined') {
            const cached = await caches.match(xmlUrl);
            if (cached) return cached;
          }
          throw new Error('Không thể nạp file XML (Mất mạng và chưa lưu ngoại tuyến)');
        };

        const [res, loadedSettings] = await Promise.all([
          fetchXml(),
          ApiService.sessions.load(song.id).catch(() => ({})),
          ChordCanvas.loadSong(song.id, profileOverride)  // đảm bảo chords ready trước render
        ]);
        settings = loadedSettings;
        if (loadToken !== _currentLoadToken) return;

        xml = await res.text();
        if (loadToken !== _currentLoadToken) return;

        processedXml = _injectChords(xml);
        if (window.VerseManager?.onSongLoaded) {
          window.VerseManager.onSongLoaded(processedXml);
        }
        if (window.VerseManager?.processXml) {
          processedXml = window.VerseManager.processXml(processedXml);
        }
      }

      Store.set('originalXml', xml);

      const transpose = transposeOverride ?? 0;
      // L5-1: Bắt buộc hiển thị container trước khi render để tính đúng clientWidth và fit zoom
      document.getElementById('sheet-area')?.classList.remove('hidden');
      const zoom = _computePreloadFitZoom();

      Store.set('currentTranspose', transpose);
      Store.set('currentZoom', zoom);

      // ── Render OSMD ──
      if (!isInstant) {
        AppUI.setLoadingText('Đang vẽ bản nhạc...');
      }
      OSMDRenderer.setZoomSilent(zoom);

      if (isInstant) {
        window.SongPreloader?.startTransitionTimer?.();
      }

      if (loadToken !== _currentLoadToken) return;
      await OSMDRenderer.load(processedXml, transpose);
      if (loadToken !== _currentLoadToken) return;

      if (isInstant) {
        window.SongPreloader?.endTransitionTimer?.();
        window.AnnotationCanvas?.loadSong?.(song.id);
      }

      // ── Post-render tasks ──
      _syncZoomUI(zoom);

      window.SheetAudioPlayer?.setup?.(OSMDRenderer.getInstance());
      AppUI.updateTransposeDisplay(transpose);
      AppUI.updateSongInfo(song, transpose);
      _updateCapoBadge(xml);

      // Các task phụ — không cần await
      if (window.SongInfoBar) SongInfoBar.loadSong(xml, song);
      if (window.PerformanceNotes) PerformanceNotes.loadSong(song.id, settings); // Ticket L5-4: dùng chung sessions
      if (window.LiveSync?.ensureLoaded) {
        window.LiveSync.ensureLoaded();
      } else if (window.ScriptLoader?.loadLiveSync) {
        window.ScriptLoader.loadLiveSync().then(() => window.LiveSync?.ensureLoaded?.());
      }

      _enableAudioControls();
      AppUI.showOSMD();
      AppUI.enableControls(true);
      _updateVersionsUI(song);

      // Task 2.8 (F13 fix): Không gọi lại refreshSetDropdown() ở đây vì ChordCanvas.loadSong() đã tự nạp.
      // Chỉ đồng bộ lại chord chip trên thanh thông tin bài hát.
      setTimeout(() => SongInfoBar?.refreshChordChip?.(), 200);

      AppUI.updateSessionPanel(transpose, []);
      _showLoadToast(song, transpose);
      if (window.URLState && _isFirstLoad) {
        _isFirstLoad = false;
        _restoreFromURL(); // bỏ await
      }
      if (window.HistoryManager) HistoryManager.trackView(song);

      document.getElementById('btn-print')?.removeAttribute('disabled');
      _syncSidebarNavLinks(song.id, profileOverride || window.ChordCanvas?.getCurrentSet?.() || 'HD');

      // Nếu Band View đang hoạt động khi đổi bài -> cập nhật ngay lời bài mới
      const lyricContainer = document.getElementById('lyric-view-container');
      if (lyricContainer && !lyricContainer.classList.contains('hidden')) {
        if (window.DisplaySettings?.renderLyricViewIfActive) {
          window.DisplaySettings.renderLyricViewIfActive();
        }
      }

      window.PageNav?.computePages?.();
      setTimeout(() => window.PageNav?.computePages?.(), 150);
      EventBus.emit('song:loaded', { song, xml, settings });

    } catch (err) {
      if (err.name === 'AbortError' || loadToken !== _currentLoadToken) {
        // Request cũ đã bị hủy hoặc đè bởi bài mới hơn — bỏ qua âm thầm
        return;
      }
      console.error('[SongLoader]', err);
      AppUI.showToast(`Lỗi: ${err.message}`, 'error');
      AppUI.showWelcome();
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
    let processedXml  = _injectChords(xml);
    if (window.VerseManager?.processXml) {
      processedXml = window.VerseManager.processXml(processedXml);
    }

    if (isLyricActive) {
      window.SessionTracker?.setTranspose?.(transpose);
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
      // Dịch nhanh in-memory chỉ khi XML không đổi. Nếu khổ/capo/bộ hợp âm đã đổi
      // thì processedXml khác bản đang render → phải reload, nếu không thay đổi bị bỏ qua.
      const sameXml = OSMDRenderer.getCurrentXml?.() === processedXml;
      if (sameXml && OSMDRenderer.getIsLoaded() && typeof OSMDRenderer.transpose === 'function') {
        await OSMDRenderer.transpose(transpose);
      } else {
        await OSMDRenderer.reload(processedXml, transpose);
      }
      window.SessionTracker?.setTranspose?.(transpose);
      _updateCapoBadge(processedXml);
    } catch (err) {
      console.warn('[SongLoader] transpose/reload lỗi:', err.message);
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
      if ('caches' in window) {
        const xmlCacheName = (typeof window !== 'undefined' && window.__SW_CACHE__) || 'sheetapp-musicxml-v5';
        caches.open(xmlCacheName).then(c => c.delete(song.xmlPath)).catch(() => {});
      }
      if (window.ServiceWorkerManager?.clearXmlCache) {
        window.ServiceWorkerManager.clearXmlCache(song.xmlPath);
      }
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
    const currentSet = window.ChordCanvas?.getCurrentSet?.() || 'HD';
    const chords     = window.ChordCanvas?.getCustomChords?.() ?? {};
    if (currentSet !== 'default' && Object.keys(chords).length > 0) {
      return window.ChordCanvasXML?.cloneAndInjectChords?.(xml, chords) || xml;
    }
    return xml;
  }

  function _updateCapoBadge(xml) {
    if (!window.TransposeEngine) return;
    const set    = window.ChordCanvas?.getCurrentSet?.() || 'HD';
    const chords = window.ChordCanvas?.getCustomChords?.();
    let list = (set !== 'default' && chords && Object.keys(chords).length > 0) ? Object.values(chords) : TransposeEngine.extractChordsFromXML(xml);
    const transpose = Store.get('currentTranspose');
    const best = TransposeEngine.suggestBestCapo(list.map(c => TransposeEngine.transposeChord(c, transpose)));
    AppUI.updateCapoBadge(Store.get('capoLevel') || 0, best);
  }

  function _syncZoomUI(zoom) {
    const pct    = Math.round(zoom * 100);
    const slider = document.getElementById('zoom-slider');
    if (slider) {
      if (slider.tagName.toLowerCase() === 'select') {
        const best = Array.from(slider.options).reduce((a,b) =>
          Math.abs(parseInt(b.value)-pct) < Math.abs(parseInt(a.value)-pct) ? b : a);
        slider.value = best.value;
      } else { slider.value = pct; }
    }
    const lbl = document.getElementById('zoom-value-label');
    if (lbl) lbl.textContent = pct + '%';
    const gigZoom = document.getElementById('gig-hud-zoom');
    if (gigZoom) gigZoom.textContent = pct + '%';
  }

  /** L5-1: Tính fit zoom ngay trước render đầu tiên */
  function _computePreloadFitZoom() {
    if (localStorage.getItem('sheetapp_zoom_locked') === 'true') {
      const lockedPct = parseInt(localStorage.getItem('sheetapp_locked_zoom_val') || '100', 10);
      return (lockedPct || 100) / 100;
    }
    const wrapper = document.querySelector('.sheet-viewer-wrapper');
    const wrapW = wrapper?.clientWidth || window.innerWidth;
    if (!wrapW || wrapW <= 0) return 1.0;

    const avail = wrapW - 20;
    const container = document.getElementById('osmd-container');
    let padX = 56;
    if (container) {
      const style = window.getComputedStyle(container);
      padX = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
    }
    const contentW = Math.max(100, wrapW - padX);
    const ratio = avail / contentW;
    let pct = Math.round(Math.max(0.5, Math.min(2.0, ratio)) * 20) * 5;
    if (window.innerWidth <= 680 && pct > 75) pct = 75; // R4-3: Preload zoom <= 75% on mobile
    return pct / 100;
  }

  function _autoFitZoom() {
    if (localStorage.getItem('sheetapp_zoom_locked') === 'true') return;
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
    _autoFitRetryCount = 0;

    const ratio = avail / svgW;
    let pct = Math.round(Math.max(0.1, Math.min(2.0, ratio)) * 20) * 5;
    const isMobile = window.innerWidth <= 680;
    if (isMobile && pct > 75) pct = 75; // R4-3: Mobile autofit max 75%
    const curZoom = Store.get('currentZoom') || 1.0;
    if (isMobile) {
      if (Math.abs((pct / 100) - curZoom) > 0.03) {
        window.App?.setZoom?.(pct);
        setTimeout(() => _ensureMinMeasuresPerSystem(pct), 120);
      } else {
        setTimeout(() => _ensureMinMeasuresPerSystem(Math.round(curZoom * 100)), 120);
      }
    } else if (curZoom === 1.0 && Math.abs((pct / 100) - curZoom) > 0.03) {
      window.App?.setZoom?.(pct);
    }
  }

  function _ensureMinMeasuresPerSystem(targetPct, attempt = 0) {
    if (window.innerWidth > 680) return;
    const osmd = window.OSMDRenderer?.getInstance?.();
    if (!osmd?.graphic?.measureList) return;
    const systems = osmd.graphic.measureList;
    if (systems.length <= 1) return;

    let hasSingleMeasure = false;
    for (let i = 0; i < systems.length - 1; i++) {
      if (systems[i] && systems[i].length < 2) {
        hasSingleMeasure = true;
        break;
      }
    }
    if (hasSingleMeasure && targetPct > 25) {
      const adjustedPct = Math.max(25, targetPct - 5);
      window.App?.setZoom?.(adjustedPct);
      if (attempt < 5 && adjustedPct > 25) {
        setTimeout(() => _ensureMinMeasuresPerSystem(adjustedPct, attempt + 1), 120);
      }
    }
  }

  function _resetCapoUI() {
    const capoSel = document.getElementById('capo-select'), capoHint = document.getElementById('capo-hint');
    if (capoSel) capoSel.value = '0';
    if (capoHint) capoHint.textContent = '';
    AppUI.updateCapoBadge(0);
  }

  function _autoCloseSidebar() {
    if (window.innerWidth <= 900) {
      if (typeof window._closeSidebar === 'function') window._closeSidebar();
      else {
        document.getElementById('sidebar')?.classList.add('mobile-hidden');
        document.getElementById('sidebar-overlay')?.classList.add('hidden');
      }
    }
  }

  function _enableAudioControls() {
    const perfBtn = document.getElementById('btn-perf-notes'), vol = document.getElementById('audio-volume');
    if (perfBtn) perfBtn.disabled = false;
    if (vol) vol.disabled = false;
    window.SheetAudioPlayer?.enableBtn?.(true);
  }

  function _showLoadToast(song, transpose) {
    const key   = window.SongInfoBar?.getSongKey?.() || '';
    const set   = window.ChordCanvas?.getCurrentSet?.() || 'HD';
    const cnt   = Object.keys(window.ChordCanvas?.getCustomChords?.() ?? {}).length;
    const setLbl = set === 'default' ? 'TLH (gốc)' : (set === 'HD' ? '⭐ HD' : set);
    const cntLbl = set !== 'default' ? (cnt > 0 ? ` (${cnt} hợp âm)` : ' (chưa có · đang hiện TLH)') : '';
    // Điện thoại đã hiện bài/tông/bộ hợp âm ở toolbar sát ngón cái; toast này che khuông nhạc.
    if (window.innerWidth > 680) {
      AppUI.showToast(`🎵 ${song.title}${key ? ' · '+key : ''} · ${setLbl}${cntLbl}`, 'info');
    }
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
    // Q2: Nếu người dùng đã chọn trước đó, luôn giữ lựa chọn đó. Nếu chưa chọn: mobile guitar/vocals/khách mở Lời, đàn phím mở Nhạc.
    const defaultMode = isMobile ? (role === 'keyboard' ? 'sheet' : 'band') : 'sheet';
    const effectiveMode = savedMode || defaultMode;
    const shouldOpenBand = state.v === 'lyric' || (!hasExplicitViewParam && effectiveMode === 'band');

    if (shouldOpenBand) {
      if (state.lv === 'inline') localStorage.setItem('sheetapp_lyric_mode', 'inline');
      const lyric = document.getElementById('lyric-view-container');
      if (lyric?.classList.contains('hidden')) {
        const toggleBtn = document.getElementById('btn-band-toggle') || document.getElementById('btn-toggle-view');
        toggleBtn?.click();
      }
    } else {
      const lyric = document.getElementById('lyric-view-container');
      if (lyric && !lyric.classList.contains('hidden')) {
        const toggleBtn = document.getElementById('btn-band-toggle') || document.getElementById('btn-toggle-view');
        toggleBtn?.click();
      }
    }
  }

  /* ── Quản lý và nạp danh sách phiên bản của bài hát (Nạp lười khi mở dropdown) ── */
  function _updateVersionsUI(song) {
    const btn = document.getElementById('btn-song-versions');
    const label = document.getElementById('btn-version-label');
    const dropdown = document.getElementById('dropdown-song-versions');
    const listContainer = document.getElementById('version-list-items');
    if (!btn || !dropdown || !listContainer) return;

    btn.removeAttribute('disabled');

    // Cập nhật nhãn phiên bản hiện tại
    const currentVerName = song.versionName || 'Bản Gốc';
    if (label) label.textContent = currentVerName;

    // Lắng nghe mở / đóng dropdown menu và nạp lười khi mở
    if (!btn._hasVersionListener) {
      btn._hasVersionListener = true;
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const willOpen = dropdown.classList.contains('hidden');
        dropdown.classList.toggle('hidden');
        if (willOpen) {
          const curSong = Store.get('currentSong') || song;
          await _loadAndRenderVersions(curSong, dropdown, listContainer);
        }
      });
      document.addEventListener('click', (e) => {
        if (!btn.contains(e.target) && !dropdown.contains(e.target)) {
          dropdown.classList.add('hidden');
        }
      });
    }
  }

  async function _loadAndRenderVersions(song, dropdown, listContainer) {
    try {
      const data = await (window.ApiService?.songs?.getVersions
        ? window.ApiService.songs.getVersions(song.id)
        : { data: [] });
      const versions = data.data || (Array.isArray(data) ? data : []);

      listContainer.innerHTML = '';

      // 1. Mục Bản Gốc (Master Root)
      const origBtn = document.createElement('button');
      origBtn.className = 'btn btn-ghost btn-xs btn-menu-item' + (!song.versionId ? ' active-ver' : '');
      origBtn.style.cssText = 'width:100%; justify-content:space-between; text-align:left; padding:7px 12px; border-radius:4px;';
      origBtn.innerHTML = `
        <span style="display:flex; align-items:center; gap:6px;">
          <span>⭐️</span>
          <strong>Bản Gốc (Master)</strong>
        </span>
        ${!song.versionId ? '<span style="color:var(--accent); font-size:0.75rem; font-weight:700;">● Đang chọn</span>' : ''}
      `;
      origBtn.onclick = () => {
        dropdown.classList.add('hidden');
        if (song.versionId) {
          const baseSong = { ...song };
          delete baseSong.versionId;
          delete baseSong.versionName;
          baseSong.xmlPath = song.masterXmlPath || song.xmlPath;
          load(baseSong);
        }
      };
      listContainer.appendChild(origBtn);

      // 2. Danh sách phiên bản do người dùng chỉnh sửa
      if (versions.length > 0) {
        const header = document.createElement('div');
        header.style.cssText = 'padding: 6px 12px 2px 12px; font-size: 0.7rem; color: var(--text-muted); font-weight:700; text-transform:uppercase;';
        header.textContent = `Bản chỉnh sửa (${versions.length})`;
        listContainer.appendChild(header);

        versions.forEach(v => {
          const vBtn = document.createElement('button');
          const isCurrent = String(song.versionId) === String(v.id);
          vBtn.className = 'btn btn-ghost btn-xs btn-menu-item' + (isCurrent ? ' active-ver' : '');
          vBtn.style.cssText = 'width:100%; justify-content:space-between; text-align:left; padding:6px 12px; border-radius:4px; margin-top:2px;';
          vBtn.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:1px; overflow:hidden;">
              <span style="font-weight:600; font-size:0.83rem; white-space:nowrap; text-overflow:ellipsis; overflow:hidden;">👤 ${window.SafeHtml.escape(v.version_name)}</span>
              <span style="font-size:0.7rem; color:var(--text-muted);">${window.SafeHtml.escape(v.username)} · ${v.created_at ? window.SafeHtml.escape(v.created_at.slice(0, 10)) : ''}</span>
            </div>
            ${isCurrent ? '<span style="color:var(--accent); font-size:0.75rem; font-weight:700; margin-left:6px;">● Đang chọn</span>' : ''}
          `;
          vBtn.onclick = () => {
            dropdown.classList.add('hidden');
            const verSong = {
              ...song,
              masterXmlPath: song.masterXmlPath || song.xmlPath,
              xmlPath: v.xml_path,
              versionId: v.id,
              versionName: `${v.username}: ${v.version_name}`
            };
            load(verSong);
          };
          listContainer.appendChild(vBtn);
        });
      }
    } catch (e) {
      console.warn('[SongLoader] Tải phiên bản thất bại:', e);
    }
  }

  function _syncSidebarNavLinks(songId, chordSet) {
    if (!songId) return;
    const set = chordSet || window.ChordCanvas?.getCurrentSet?.() || 'HD';
    const base = window.__APP_BASE__ || '';
    document.querySelectorAll('.sidebar-mini-link').forEach(link => {
      const href = link.getAttribute('href');
      if (href && (href.startsWith('/learn') || href.includes('/learn/'))) {
        link.href = `${base}/learn/?song=${encodeURIComponent(songId)}&set=${encodeURIComponent(set)}`;
      } else if (href && (href.startsWith('/live-band') || href.includes('/live-band/'))) {
        link.href = `${base}/live-band/?song=${encodeURIComponent(songId)}&set=${encodeURIComponent(set)}`;
      }
    });
  }

  return { load, commitTranspose, saveModifiedXML, syncSidebarNavLinks: _syncSidebarNavLinks, getCurrentLoadToken: () => _currentLoadToken };
})();

window.SongLoader = SongLoader;
