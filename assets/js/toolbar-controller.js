/**
 * toolbar-controller.js — Toolbar Controls Binding
 * Tách từ app.js: bind toolbar buttons (transpose, zoom, sidebar, capo...).
 */
const ToolbarController = (() => {
  'use strict';

  let _toggleSidebarFn = null;

  function toggleSidebar() {
    if (_toggleSidebarFn) {
      _toggleSidebarFn();
    } else {
      const sidebar = document.getElementById('sidebar');
      if (!sidebar) return;
      if (window.innerWidth <= 900) {
        sidebar.classList.toggle('mobile-hidden');
      } else {
        sidebar.classList.toggle('collapsed');
      }
    }
  }

  function init() {
    _bindTranspose();
    _bindZoom();
    _bindSidebar();
    _bindDarkMode();
    _bindMisc();
    _bindMoreOptionsMenu();
    _bindCompactWidthObserver();
    _bindViewSwitch();
    _bindToolbarTempo();
  }

  // R0-7 (ROADMAP5): @container mainarea (định nghĩa trên .main-content) chỉ áp dụng cho
  // hậu duệ DOM THẬT của .main-content. Nhưng #main-dropdown-menu bị chuyển hẳn ra
  // document.body khi mở (để position:fixed định vị đúng, không bị overflow:hidden của
  // ancestor cắt mất) -- một khi đã chuyển ra ngoài, @container không còn áp dụng được cho
  // nó nữa, nên .menu-section-compact-only bên trong không bao giờ hiện được ở dải
  // 1366-1650px (viewport đủ rộng để @media(max-width:1300px) không khớp, nhưng
  // .main-content vẫn hẹp hơn 1350px do sidebar chiếm chỗ). ResizeObserver này bật/tắt
  // class body.toolbar-controls-compact (không phụ thuộc vị trí DOM) làm nguồn thay thế.
  function _bindCompactWidthObserver() {
    const mainContentEl = document.querySelector('.main-content');
    if (!mainContentEl || typeof ResizeObserver === 'undefined') return;
    const COMPACT_THRESHOLD = 1350;
    const ro = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect?.width;
      if (typeof width !== 'number') return;
      document.body.classList.toggle('toolbar-controls-compact', width <= COMPACT_THRESHOLD);
    });
    ro.observe(mainContentEl);
  }

  function _bindTranspose() {
    document.getElementById('btn-transpose-up')?.addEventListener('click', e =>
      { e.currentTarget.blur(); App?.transposeBy?.(+1); });
    document.getElementById('btn-transpose-down')?.addEventListener('click', e =>
      { e.currentTarget.blur(); App?.transposeBy?.(-1); });
    document.getElementById('btn-transpose-reset')?.addEventListener('click', e =>
      { e.currentTarget.blur(); App?.resetTranspose?.(); });
    // Tap vào số hiển thị để reset nhanh về 0
    document.getElementById('transpose-display')?.addEventListener('click', e =>
      { App?.resetTranspose?.(); });

    const _onCapoChanged = (e) => {
      const newCapo = parseInt(e.target.value) || 0;
      Store.set('capoLevel', newCapo);
      AppUI.updateCapoBadge(newCapo);
      const sel1 = document.getElementById('capo-select');
      const sel2 = document.getElementById('menu-capo-select');
      if (sel1 && sel1.value !== String(newCapo)) sel1.value = String(newCapo);
      if (sel2 && sel2.value !== String(newCapo)) sel2.value = String(newCapo);
      window.ChordCanvas?.reposition?.();
      window.DisplaySettings?.renderLyricViewIfActive?.();
    };
    document.getElementById('capo-select')?.addEventListener('change', _onCapoChanged);
    document.getElementById('menu-capo-select')?.addEventListener('change', _onCapoChanged);
  }

  function _bindZoom() {
    const el = document.getElementById('zoom-slider');
    if (el) {
      const evt = el.tagName.toLowerCase() === 'select' ? 'change' : 'input';
      el.addEventListener(evt, e => App?.setZoom?.(parseInt(e.target.value, 10)));
    }

    const stepZoom = (delta) => {
      const curPct = Math.round((Store.get('currentZoom') || 1.0) * 100);
      const steps = [50, 65, 80, 90, 100, 115, 130, 150, 175, 200];
      let target;
      if (delta > 0) {
        target = steps.find(s => s > curPct + 2) || steps[steps.length - 1];
      } else {
        target = [...steps].reverse().find(s => s < curPct - 2) || steps[0];
      }
      App?.setZoom?.(target);
    };

    // Zoom buttons trên Toolbar chính
    document.getElementById('btn-zoom-out')?.addEventListener('click', () => stepZoom(-1));
    document.getElementById('btn-zoom-in')?.addEventListener('click', () => stepZoom(+1));

    // Zoom buttons trên Floating HUD (Biểu Diễn Sân Khấu)
    document.getElementById('btn-gig-zoom-out')?.addEventListener('click', (e) => {
      e.stopPropagation();
      stepZoom(-1);
    });
    document.getElementById('btn-gig-zoom-in')?.addEventListener('click', (e) => {
      e.stopPropagation();
      stepZoom(+1);
    });

    _initLockZoomUI();
    document.getElementById('btn-lock-zoom')?.addEventListener('click', () => _toggleLockZoom());
    document.getElementById('btn-gig-lock-zoom')?.addEventListener('click', (e) => {
      e.stopPropagation();
      _toggleLockZoom();
    });
  }

  function _initLockZoomUI() {
    const isLocked = localStorage.getItem('sheetapp_zoom_locked') === 'true';
    _updateLockButtonsUI(isLocked);
  }

  function _updateLockButtonsUI(isLocked) {
    const btns = [
      document.getElementById('btn-lock-zoom'),
      document.getElementById('btn-gig-lock-zoom')
    ];
    btns.forEach(btn => {
      if (!btn) return;
      if (isLocked) {
        btn.classList.add('locked');
        btn.innerHTML = '<svg class="lucide-icon" width="16" height="16" aria-hidden="true"><use href="assets/icons/lucide.svg#lock"/></svg>';
        btn.title = 'Khóa tỷ lệ View ĐANG BẬT (Bấm để mở khóa)';
      } else {
        btn.classList.remove('locked');
        btn.innerHTML = '<svg class="lucide-icon" width="16" height="16" aria-hidden="true"><use href="assets/icons/lucide.svg#unlock"/></svg>';
        btn.title = 'Khóa tỷ lệ zoom (khi đổi bài khác sẽ giữ nguyên tỷ lệ này)';
      }
    });
  }

  function _toggleLockZoom() {
    const wasLocked = localStorage.getItem('sheetapp_zoom_locked') === 'true';
    const isLocked = !wasLocked;
    localStorage.setItem('sheetapp_zoom_locked', isLocked ? 'true' : 'false');
    _updateLockButtonsUI(isLocked);

    if (isLocked) {
      const currentPct = Math.round((Store.get('currentZoom') || 1.0) * 100);
      localStorage.setItem('sheetapp_locked_zoom_val', String(currentPct));
      App?.showToast?.(`🔒 Đã khóa view ở tỷ lệ ${currentPct}%. Đổi bài sẽ giữ nguyên zoom.`, 'success');
    } else {
      App?.showToast?.('🔓 Đã mở khóa tỷ lệ view.', 'info');
    }
  }


  function _bindSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    function _updateToggleBtn(isOpen) {
      const btn = document.getElementById('btn-open-sidebar');
      if (!btn) return;
      const title = isOpen ? 'Đóng danh sách bài hát [Phím S]' : 'Mở danh sách bài hát (903 bài) [Phím S]';
      const label = isOpen ? 'Đóng danh sách bài hát' : 'Mở danh sách bài hát';
      btn.setAttribute('title', title);
      btn.setAttribute('aria-label', label);
      btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    }

    function _openSidebar() {
      sidebar?.classList.remove('mobile-hidden');
      sidebar?.classList.remove('collapsed');
      overlay?.classList.remove('hidden');
      _updateToggleBtn(true);
      if (overlay) {
        overlay.onclick = _closeSidebar;
      }
    }

    function _closeSidebar() {
      sidebar?.classList.add('mobile-hidden');
      overlay?.classList.add('hidden');
      _updateToggleBtn(false);
    }

    function _toggle() {
      if (!sidebar) return;
      if (window.innerWidth <= 1440) {
        // Mobile / iPad / Laptop (<=1440px): Drawer overlay trượt (Ticket R1-7)
        if (sidebar.classList.contains('mobile-hidden')) {
          _openSidebar();
        } else {
          _closeSidebar();
        }
      } else {
        // Desktop >1440px: collapse narrow
        sidebar.classList.toggle('collapsed');
        _updateToggleBtn(!sidebar.classList.contains('collapsed'));
      }
    }

    _toggleSidebarFn = _toggle;
    document.getElementById('btn-toggle-sidebar')?.addEventListener('click', _toggle);
    document.getElementById('btn-open-sidebar')?.addEventListener('click', _toggle);

    // Init: màn hình <= 1440px khi đang mở bài (?song=) hoặc <= 1200px thì mặc định ẩn sidebar (R1-7)
    const urlParams = new URLSearchParams(window.location.search);
    const hasSongParam = urlParams.has('song') && Boolean(urlParams.get('song'));
    if (window.innerWidth <= 1200 || (window.innerWidth <= 1440 && hasSongParam)) {
      sidebar?.classList.add('mobile-hidden');
      overlay?.classList.add('hidden');
      _updateToggleBtn(false);
    } else {
      const isOpen = !sidebar?.classList.contains('mobile-hidden') && !sidebar?.classList.contains('collapsed');
      _updateToggleBtn(isOpen);
    }

    // Đóng sidebar khi chọn bài trên tablet/laptop (<= 1440px) để nhạc chiếm trọn màn hình
    if (typeof EventBus !== 'undefined') {
      EventBus.on('song:loaded', () => {
        if (window.innerWidth <= 1440) {
          _closeSidebar();
        }
      });
    }

    // Resize handler
    let _lastW = window.innerWidth;
    window.addEventListener('resize', _debounce(() => {
      const w = window.innerWidth;
      if (w <= 1440) {
        if (hasSongParam || w <= 1200) {
          if (!sidebar?.classList.contains('mobile-hidden')) {
            _closeSidebar();
          }
        }
      } else {
        sidebar?.classList.remove('mobile-hidden');
        overlay?.classList.add('hidden');
        _updateToggleBtn(!sidebar?.classList.contains('collapsed'));
      }
      const wDelta = Math.abs(w - _lastW);
      _lastW = w;
      if (wDelta > 100 && OSMDRenderer?.getIsLoaded?.()) {
        setTimeout(() => {
          try {
            // L5-1: Bàn giao toàn bộ việc layout lại và render khi resize cho ResizeObserver duy nhất làm chủ
            if (localStorage.getItem('sheetapp_zoom_locked') === 'true') {
              ChordCanvas?.reposition?.();
              return;
            }
            ChordCanvas?.reposition?.();
          } catch(e) {}
        }, 350);
      }
    }, 250));

    if ('onorientationchange' in window) {
      window.addEventListener('orientationchange', () => {
        // Xử lý xoay màn hình: đóng sidebar
        if (window.innerWidth <= 900) _closeSidebar();
        setTimeout(() => {
          if (!OSMDRenderer?.getIsLoaded?.()) return;
          try {
            // L5-1: ResizeObserver duy nhất làm chủ việc layout lại và render khi xoay thiết bị
            if (localStorage.getItem('sheetapp_zoom_locked') === 'true') {
              ChordCanvas?.reposition?.();
              return;
            }
            ChordCanvas?.reposition?.();
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
    // Ticket L0-16: #btn-fullscreen được ModeManager quản lý tập trung, không bind trùng lặp tại đây
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
    document.getElementById('btn-close-session')?.addEventListener('click', () => {
      const panel = document.getElementById('session-panel');
      if (panel) {
        if (window.ModalManager) {
          window.ModalManager.close(panel);
        } else {
          panel.classList.add('hidden');
        }
      }
    });
    document.getElementById('btn-save-session')?.addEventListener('click', async () => {
      const note = document.getElementById('session-note')?.value.trim() || '';
      await SessionTracker?.saveNow?.(note);
      AppUI?.updateSessionPanel?.(Store.get('currentTranspose'), SessionTracker?.getHistory?.());
      App?.showToast?.('💾 Đã lưu nhật ký', 'success');
    });

    const _handleFollowLeaderClick = async (e) => {
      e?.preventDefault?.();
      if (!window.FollowLeader && window.ScriptLoader?.loadLiveSync) {
        await window.ScriptLoader.loadLiveSync();
      }
      window.FollowLeader?.openModal?.();
    };
    document.getElementById('btn-follow-leader')?.addEventListener('click', _handleFollowLeaderClick);
    document.getElementById('btn-menu-follow-leader')?.addEventListener('click', _handleFollowLeaderClick);
  }

  function _updateTrackFill(slider) {
    const min = parseFloat(slider.min ?? 0), max = parseFloat(slider.max ?? 100), val = parseFloat(slider.value ?? 0);
    const pct = max > min ? Math.round(((val-min)/(max-min))*100) : 0;
    slider.style.background = `linear-gradient(to right, var(--accent,#7c3aed) 0%, var(--accent,#7c3aed) ${pct}%, #d1d5db ${pct}%)`;
  }

  function _bindMoreOptionsMenu() {
    const btnOptions = document.getElementById('btn-more-options');
    const menuOptions = document.getElementById('main-dropdown-menu');
    if (btnOptions && menuOptions) {
      let backdrop = document.getElementById('main-dropdown-backdrop');
      if (!backdrop) {
        backdrop = document.createElement('div');
        backdrop.id = 'main-dropdown-backdrop';
        backdrop.className = 'main-dropdown-backdrop hidden';
        document.body.appendChild(backdrop);
        backdrop.addEventListener('click', () => closeMenu());
      }

      function positionMenu() {
        const isMobile = window.innerWidth <= 680;
        if (isMobile) {
          menuOptions.style.cssText = '';
          menuOptions.classList.add('is-bottom-sheet');
          backdrop.classList.remove('hidden');
          document.body.classList.add('tools-menu-open');
        } else {
          menuOptions.classList.remove('is-bottom-sheet');
          backdrop.classList.add('hidden');
          document.body.classList.remove('tools-menu-open');
          const r = btnOptions.getBoundingClientRect();
          const w = 320;
          let left = r.right - w;
          if (left < 8) left = 8;
          if (left + w > window.innerWidth - 8) left = window.innerWidth - w - 8;
          menuOptions.style.cssText = `position:fixed; top:${r.bottom + 6}px; left:${left}px; width:${w}px; right:auto; z-index:99999;`;
        }
      }

      function closeMenu() {
        menuOptions.classList.add('hidden');
        backdrop?.classList.add('hidden');
        document.body.classList.remove('tools-menu-open');
        btnOptions.setAttribute('aria-expanded', 'false');
      }

      btnOptions.addEventListener('click', (e) => {
        e.stopPropagation();
        const isHidden = menuOptions.classList.contains('hidden');
        if (isHidden) {
          if (menuOptions.parentNode !== document.body) document.body.appendChild(menuOptions);
          menuOptions.classList.remove('hidden');
          btnOptions.setAttribute('aria-expanded', 'true');
          positionMenu();
        } else {
          closeMenu();
        }
      });

      menuOptions.addEventListener('click', (e) => {
        const item = e.target.closest('.btn-menu-item, a');
        if (item && !item.closest('.tools-zoom-row, .tools-scroll-row, .tools-capo-row, .compact-settings-panel, .audio-settings-panel') && item.id !== 'btn-audio-settings' && item.id !== 'btn-song-versions') {
          closeMenu();
        }
      });

      const handleOutside = (e) => {
        if (!btnOptions.contains(e.target) && !menuOptions.contains(e.target)) closeMenu();
      };
      document.addEventListener('click', handleOutside);
      document.addEventListener('pointerdown', handleOutside);
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });
      window.addEventListener('scroll', () => {
        if (window.innerWidth > 680) closeMenu();
      }, { passive: true });
      window.addEventListener('resize', () => {
        if (!menuOptions.classList.contains('hidden')) positionMenu();
      });
    }

    const btnBandToggle = document.getElementById('btn-band-toggle') || document.getElementById('btn-toggle-view');
    const lyricContainer = document.getElementById('lyric-view-container');
    if (btnBandToggle && lyricContainer) {
      btnBandToggle.addEventListener('click', () => {
        const isHidden = lyricContainer.classList.contains('hidden');
        lyricContainer.classList.toggle('hidden', !isHidden);
        document.getElementById('osmd-container')?.classList.toggle('hidden', isHidden);
        try {
          localStorage.setItem('sheetapp_view_mode', isHidden ? 'band' : 'sheet');
          window.URLState?.update?.({ v: isHidden ? 'lyric' : 'sheet' });
        } catch (_) {}
        if (isHidden) window.DisplaySettings?.renderLyricViewIfActive?.();
        else window.ChordCanvas?.build?.();
      });
      new MutationObserver(() => {
        const isLyric = !lyricContainer.classList.contains('hidden');
        btnBandToggle.classList.toggle('active', isLyric);
        const txt = btnBandToggle.querySelector('.view-text') || btnBandToggle.querySelector('.band-toggle-text');
        if (txt) txt.textContent = isLyric ? 'Nhạc' : 'Band';
        btnBandToggle.title = isLyric ? 'Quay lại Bản Nhạc' : 'Chuyển sang chế độ Band (Lời + Hợp âm chữ)';
      }).observe(lyricContainer, { attributes: true, attributeFilter: ['class'] });
    }

    document.getElementById('btn-lyric-view')?.addEventListener('click', () => {
      const songId = window.App?.getCurrentSongId?.() || new URLSearchParams(window.location.search).get('song') || '';
      if (songId) {
        const curSet = window.App?.getCurrentSet?.() || 'HD';
        const curTranspose = window.App?.getCurrentTranspose?.() || 0;
        const base = (typeof window.__APP_BASE__ !== 'undefined' ? window.__APP_BASE__ : '');
        const url = `${base ? base + '/' : ''}print/chord-sheet.php?song=${encodeURIComponent(songId)}&set=${encodeURIComponent(curSet)}&t=${encodeURIComponent(curTranspose)}`;
        window.open(url, '_blank');
      } else {
        window.App?.showToast?.('Vui lòng chọn bài hát để in lời & hợp âm', 'info');
      }
    });

    document.getElementById('btn-menu-zoom-out')?.addEventListener('click', () => {
      document.getElementById('btn-zoom-out')?.click();
      const cur = document.getElementById('zoom-slider')?.value || '100';
      const label = document.getElementById('menu-zoom-val');
      if (label) label.textContent = cur + '%';
    });
    document.getElementById('btn-menu-zoom-in')?.addEventListener('click', () => {
      document.getElementById('btn-zoom-in')?.click();
      const cur = document.getElementById('zoom-slider')?.value || '100';
      const label = document.getElementById('menu-zoom-val');
      if (label) label.textContent = cur + '%';
    });
    document.getElementById('btn-menu-lock-zoom')?.addEventListener('click', () => {
      document.getElementById('btn-lock-zoom')?.click();
      const isLocked = localStorage.getItem('sheetapp_zoom_locked') === 'true';
      const btn = document.getElementById('btn-menu-lock-zoom');
      if (btn) btn.innerHTML = isLocked ? '<svg class="icon icon-xs"><use href="#icon-lock"/></svg>' : '<svg class="icon icon-xs"><use href="#icon-unlock"/></svg>';
    });
    document.getElementById('btn-menu-auto-scroll')?.addEventListener('click', () => {
      document.getElementById('btn-auto-scroll')?.click();
    });
    document.getElementById('menu-scroll-speed')?.addEventListener('change', (e) => {
      const sp = document.getElementById('scroll-speed');
      if (sp) { sp.value = e.target.value; sp.dispatchEvent(new Event('change')); }
    });
    document.getElementById('btn-menu-metronome')?.addEventListener('click', () => {
      document.getElementById('btn-toolbar-metronome')?.click();
    });
    document.getElementById('btn-menu-auth')?.addEventListener('click', () => {
      document.getElementById('btn-toolbar-auth')?.click();
    });
    document.getElementById('btn-menu-chord-preset')?.addEventListener('click', () => {
      document.getElementById('btn-chord-preset')?.click();
      const txt = document.getElementById('chord-preset-label')?.textContent || 'Chuẩn';
      const ml = document.getElementById('menu-chord-preset-label');
      if (ml) ml.textContent = 'Cỡ hợp âm: ' + txt;
    });
    document.getElementById('btn-menu-chord-notation')?.addEventListener('click', () => {
      document.getElementById('btn-chord-notation')?.click();
      const txt = document.getElementById('chord-notation-label')?.textContent || 'C';
      const ml = document.getElementById('menu-chord-notation-label');
      if (ml) ml.textContent = 'Ký hiệu: ' + txt;
    });
    document.getElementById('btn-menu-instrument-role')?.addEventListener('click', () => {
      document.getElementById('btn-instrument-role')?.click();
      const label = document.getElementById('instrument-role-label')?.textContent || 'Guitar';
      const ml = document.getElementById('menu-instrument-role-label');
      if (ml) ml.textContent = 'Góc nhìn: ' + label;
    });
    document.getElementById('btn-menu-verse-mode')?.addEventListener('click', () => {
      document.getElementById('btn-verse-mode')?.click();
      const txt = document.getElementById('verse-mode-label')?.textContent || 'Tất cả khổ';
      const ml = document.getElementById('menu-verse-mode-label');
      if (ml) ml.textContent = 'Khổ hát: ' + txt;
    });
    document.getElementById('btn-menu-add-chord-mode')?.addEventListener('click', () => {
      document.getElementById('btn-add-chord-mode-bar')?.click();
    });
    document.getElementById('btn-menu-transpose-reset')?.addEventListener('click', () => {
      document.getElementById('btn-transpose-reset')?.click();
    });
  }

  function _bindViewSwitch() {
    const btnViewSheet = document.getElementById('btn-view-sheet');
    const btnViewLyrics = document.getElementById('btn-view-lyrics');
    const lyricContainer = document.getElementById('lyric-view-container');
    const btnLyric = document.getElementById('btn-lyric-view');

    if (lyricContainer) {
      const syncViewButtons = () => {
        const isLyric = !lyricContainer.classList.contains('hidden');
        btnViewSheet?.classList.toggle('active', !isLyric);
        btnViewLyrics?.classList.toggle('active', isLyric);
      };
      new MutationObserver(syncViewButtons).observe(lyricContainer, { attributes: true, attributeFilter: ['class'] });
      syncViewButtons();
    }

    btnViewSheet?.addEventListener('click', () => {
      if (lyricContainer && !lyricContainer.classList.contains('hidden')) {
        const toggleBtn = document.getElementById('btn-band-toggle') || document.getElementById('btn-toggle-view');
        if (toggleBtn) toggleBtn.click();
      }
    });

    btnViewLyrics?.addEventListener('click', () => {
      if (lyricContainer && lyricContainer.classList.contains('hidden')) {
        const toggleBtn = document.getElementById('btn-band-toggle') || document.getElementById('btn-toggle-view');
        if (toggleBtn) toggleBtn.click();
      }
    });
  }

  function _bindToolbarTempo() {
    const tempoBtn = document.getElementById('btn-toolbar-tempo');
    if (!tempoBtn) return;
    tempoBtn.addEventListener('click', async () => {
      const valEl = document.getElementById('toolbar-tempo-val');
      const curBpm = parseInt(valEl?.textContent, 10) || 100;
      if (window.TempoPick?.show) {
        const newBpm = await window.TempoPick.show(curBpm);
        if (newBpm && valEl) {
          valEl.textContent = newBpm;
          if (window.Metronome?.setBpm) window.Metronome.setBpm(newBpm);
        }
      } else {
        document.getElementById('btn-toolbar-metronome')?.click();
      }
    });
  }

  function _debounce(fn, ms) { let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); }; }

  return { init, toggleSidebar };
})();

window.ToolbarController = ToolbarController;

