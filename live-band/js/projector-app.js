/**
 * live-band/js/projector-app.js — Projector Runtime & Remote Synchronization Controller
 * 
 * Part of Ticket T12 (Epic 3.4).
 * Responsibilities:
 * 1. SSE LiveSync connection & auto-reconnect fallback.
 * 2. Song lookup via ApiService.songs with true xmlPath resolution (no hardcoded filenames).
 * 3. Synchronization of Liturgical items & lyrics slide progression.
 * 4. Keyboard shortcuts & fullscreen/blank/font-size controls.
 * 5. Clean DOM lifecycle and zero console noise.
 */
(function(root) {
  'use strict';

  function initProjectorApp() {
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = window.__PROJECTOR_ROOM__ || '';
    const roomCode = (urlParams.get('room') || roomParam).toUpperCase();

    let _currentSongId = '';
    let _currentServicePlanIndex = -1;
    let _slides = [];
    let _activeSlideIdx = 0;
    let _activeLineIdx = 0;
    let _isBlank = false;
    let _currentFontSize = 3.2; // rem
    let _cueTimer = null;
    let _songsCache = null;

    // Font size persistence
    const savedFontSize = localStorage.getItem('sheetapp_projector_fs');
    if (savedFontSize) {
      _currentFontSize = parseFloat(savedFontSize) || 3.2;
      document.documentElement.style.setProperty('--projector-font-size', _currentFontSize + 'rem');
    }

    // Transport setup (SSE with Polling fallback)
    const transport = (typeof window.SSETransport !== 'undefined')
      ? new window.SSETransport(350)
      : new window.PollingTransport(350);

    // DOM Elements
    const contentEl      = document.getElementById('projector-content');
    const headerTitleEl  = document.getElementById('projector-header-title');
    const planBadgeEl    = document.getElementById('projector-plan-badge');
    const slideCounterEl = document.getElementById('projector-slide-counter');
    const connDotEl      = document.getElementById('conn-dot');
    const connTextEl     = document.getElementById('conn-text');
    const cueBannerEl    = document.getElementById('projector-cue-banner');
    const btnBlank       = document.getElementById('btn-blank');

    // Auto Dimming Header on idle
    let idleTimer = null;
    function handleMouseMove() {
      document.body.classList.remove('mouse-idle');
      const header = document.getElementById('projector-header');
      if (header) header.classList.remove('dimmed');
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        document.body.classList.add('mouse-idle');
        if (header) header.classList.add('dimmed');
      }, 4000);
    }
    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    // Fullscreen Toggle
    function toggleFullscreen() {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    }
    document.body.addEventListener('dblclick', toggleFullscreen);

    // Blank Screen Toggle
    function toggleBlank() {
      _isBlank = !_isBlank;
      document.body.classList.toggle('is-blank', _isBlank);
      if (btnBlank) btnBlank.classList.toggle('active', _isBlank);
    }

    // Font Size Controls
    function changeFontSize(delta) {
      _currentFontSize = Math.max(2.0, Math.min(5.2, _currentFontSize + delta));
      document.documentElement.style.setProperty('--projector-font-size', _currentFontSize + 'rem');
      localStorage.setItem('sheetapp_projector_fs', _currentFontSize.toFixed(2));
    }

    // Step Slide Navigation
    function stepSlide(delta) {
      if (!_slides || _slides.length === 0) return;
      const nextIdx = Math.max(0, Math.min(_slides.length - 1, _activeSlideIdx + delta));
      if (nextIdx !== _activeSlideIdx) {
        _activeSlideIdx = nextIdx;
        _activeLineIdx = 0;
        if (window.ProjectorSlides) {
          window.ProjectorSlides.renderCurrentSlide(contentEl, slideCounterEl, _slides, _activeSlideIdx, _activeLineIdx, headerTitleEl?.textContent || '');
        }
      }
    }

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      if (e.key === 'b' || e.key === 'B') {
        toggleBlank();
      } else if (e.key === '+' || e.key === '=') {
        changeFontSize(0.2);
      } else if (e.key === '-' || e.key === '_') {
        changeFontSize(-0.2);
      } else if (e.key === '0') {
        _currentFontSize = 3.2;
        changeFontSize(0);
      } else if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        stepSlide(1);
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        stepSlide(-1);
      }
    });

    // Toolbar Buttons
    btnBlank?.addEventListener('click', toggleBlank);
    document.getElementById('btn-fullscreen')?.addEventListener('click', toggleFullscreen);
    document.getElementById('btn-font-inc')?.addEventListener('click', () => changeFontSize(0.2));
    document.getElementById('btn-font-dec')?.addEventListener('click', () => changeFontSize(-0.2));
    document.getElementById('btn-next-slide')?.addEventListener('click', () => stepSlide(1));
    document.getElementById('btn-prev-slide')?.addEventListener('click', () => stepSlide(-1));

    if (!roomCode) {
      if (contentEl) {
        contentEl.innerHTML = `
          <div class="projector-empty">
            <div>⚠️ Chưa có mã phòng Live Band!</div>
            <div class="projector-empty-hint">Vui lòng thêm ?room=MÃ_PHÒNG vào URL</div>
          </div>
        `;
      }
      return;
    }

    function updateConnectionStatus(status) {
      if (connDotEl) {
        connDotEl.className = 'conn-dot ' + (status || '');
      }
      if (connTextEl) {
        if (status === 'connected') {
          connTextEl.textContent = `PHÒNG: ${roomCode}`;
        } else if (status === 'reconnecting') {
          connTextEl.textContent = 'ĐANG KẾT NỐI LẠI...';
        } else {
          connTextEl.textContent = 'MẤT KẾT NỐI';
        }
      }
    }

    function showCueBanner(text, type, durationMs) {
      if (!cueBannerEl) return;
      cueBannerEl.textContent = text;
      cueBannerEl.style.display = 'block';
      clearTimeout(_cueTimer);
      _cueTimer = setTimeout(() => {
        cueBannerEl.style.display = 'none';
      }, durationMs);
    }

    // Lấy xmlPath và thông tin bài hát thông qua ApiService.songs theo songId chuẩn
    async function resolveSongData(songId) {
      if (!songId) return null;

      if (window.ApiService && window.ApiService.songs) {
        if (typeof window.ApiService.songs.get === 'function') {
          try {
            const song = await window.ApiService.songs.get(songId);
            if (song && song.xmlPath) {
              return { xmlPath: song.xmlPath, title: song.title || '' };
            }
          } catch (e) {}
        }

        if (!_songsCache) {
          try {
            const list = await window.ApiService.songs.list();
            _songsCache = Array.isArray(list) ? list : (list?.data || []);
          } catch (e) {
            _songsCache = [];
          }
        }

        const found = _songsCache.find(s => s.id === songId);
        if (found && found.xmlPath) {
          return { xmlPath: found.xmlPath, title: found.title || '' };
        }
      }
      return null;
    }

    // Tải MusicXML và sinh slides qua ProjectorSlides engine
    async function loadAndRenderSongSlides(songId, songTitle) {
      try {
        const songData = await resolveSongData(songId);
        if (!songData || !songData.xmlPath) {
          throw new Error('Song XML path not found in catalog');
        }

        const effectiveTitle = (songTitle && songTitle.toLowerCase() !== songId.toLowerCase())
          ? songTitle
          : (songData.title || songTitle || songId);

        if (headerTitleEl && effectiveTitle) {
          const itemNum = (_currentServicePlanIndex >= 0) ? `[MỤC ${_currentServicePlanIndex + 1}] • ` : '';
          headerTitleEl.textContent = `${itemNum}${effectiveTitle.toUpperCase()}`;
        }

        const finalUrl = (window.ApiService && typeof window.ApiService.resolveUrl === 'function')
          ? window.ApiService.resolveUrl(songData.xmlPath)
          : songData.xmlPath;

        // INTENTIONAL EXCEPTION: Static MusicXML asset fetch
        const res = await fetch(finalUrl);
        if (!res.ok) throw new Error(`Cannot load XML from ${finalUrl}`);
        const xmlText = await res.text();

        if (!window.ProjectorSlides) {
          throw new Error('ProjectorSlides engine is not loaded');
        }

        const parsed = window.ProjectorSlides.parseMusicXmlLyrics(xmlText, 3);
        _slides = parsed.slides;

        if (_slides.length === 0) {
          if (contentEl) {
            const safeTitle = window.SafeHtml ? window.SafeHtml.escape(effectiveTitle) : effectiveTitle;
            contentEl.innerHTML = `
              <div class="projector-song-heading">${safeTitle}</div>
              <div class="projector-empty-hint">(Bản nhạc không chứa lời text)</div>
            `;
          }
          if (slideCounterEl) slideCounterEl.textContent = '';
          return;
        }

        _activeSlideIdx = 0;
        _activeLineIdx = 0;
        window.ProjectorSlides.renderCurrentSlide(contentEl, slideCounterEl, _slides, _activeSlideIdx, _activeLineIdx, effectiveTitle);
      } catch (err) {
        if (contentEl) {
          const safeTitle = window.SafeHtml ? window.SafeHtml.escape(songTitle) : songTitle;
          contentEl.innerHTML = `
            <div class="projector-song-heading">${safeTitle}</div>
            <div class="projector-empty-hint">Đang đồng bộ trực tuyến cùng Ca Trưởng...</div>
          `;
        }
        if (slideCounterEl) slideCounterEl.textContent = '';
      }
    }

    // Xử lý vị trí ô nhịp (Measure Progression)
    function highlightByMeasure(measure) {
      if (!_slides || _slides.length === 0 || !window.ProjectorSlides) return;

      const { targetSlideIdx, bestLineIdx } = window.ProjectorSlides.calculateMeasureHighlight(_slides, measure);

      if (targetSlideIdx !== -1 && targetSlideIdx !== _activeSlideIdx) {
        _activeSlideIdx = targetSlideIdx;
        _activeLineIdx = bestLineIdx;
        window.ProjectorSlides.renderCurrentSlide(contentEl, slideCounterEl, _slides, _activeSlideIdx, _activeLineIdx, headerTitleEl?.textContent || '');
        return;
      }

      _activeLineIdx = bestLineIdx;
      if (contentEl) {
        const lineEls = contentEl.querySelectorAll('.projector-line');
        lineEls.forEach((el, idx) => {
          el.classList.toggle('active', idx === _activeLineIdx);
        });
      }
    }

    // Xử lý trạng thái nhận từ Host
    async function handleRemoteState(state) {
      if (!state) return;

      // 1. Cue Message
      if (state.cue && state.cue.text) {
        showCueBanner(state.cue.text, state.cue.type || 'warning', state.cue.durationMs || 3500);
      }

      // 2. Service Plan Item Navigation
      const planItem = state.servicePlanItem;
      const songId   = state.song?.songId || state.songId || '';
      const songTitle= state.song?.songTitle || songId || '';
      const planIdx  = planItem?.itemIndex ?? (state.song?.setlistIndex ?? -1);

      if (planItem && planItem.itemType && planItem.itemType !== 'song') {
        // Mục phụng vụ không phải bài hát (Prayer, Scripture, Liturgy)
        if (_currentServicePlanIndex !== planIdx || _currentSongId !== '') {
          _currentServicePlanIndex = planIdx;
          _currentSongId = '';
          _slides = [];
          if (window.ProjectorSlides) {
            window.ProjectorSlides.renderLiturgicalSlide(contentEl, slideCounterEl, headerTitleEl, planBadgeEl, planItem);
          }
        }
        return;
      }

      // 3. Bài hát Phụng vụ
      if (songId && (songId !== _currentSongId || _currentServicePlanIndex !== planIdx)) {
        _currentSongId = songId;
        _currentServicePlanIndex = planIdx;

        // Cập nhật tiêu đề bài hát trên header
        const itemNum = (planIdx >= 0 && planItem?.totalItems) ? `[MỤC ${planIdx + 1}/${planItem.totalItems}] • ` : '';
        if (planBadgeEl) {
          planBadgeEl.textContent = (planItem && planItem.itemType === 'song') ? 'BÀI HÁT' : 'PHỤNG VỤ';
        }
        if (headerTitleEl) {
          headerTitleEl.textContent = `${itemNum}${songTitle.toUpperCase()}`;
        }

        await loadAndRenderSongSlides(songId, songTitle);
      }

      // 4. Highlight slide & line theo ô nhịp
      const measure = state.position?.measure || 1;
      highlightByMeasure(measure);
    }

    // Kết nối vào LiveSync Transport
    transport.subscribe((msg) => {
      if (!msg) return;

      if (msg.type === 'connection') {
        updateConnectionStatus(msg.status);
      } else if (msg.type === 'closed') {
        updateConnectionStatus('offline');
        if (contentEl) {
          contentEl.innerHTML = `
            <div class="projector-empty">
              <div>📡 Buổi lễ đã kết thúc</div>
              <div class="projector-empty-hint">Ca Trưởng đã đóng phòng trực tuyến</div>
            </div>
          `;
        }
      } else if (msg.type === 'state' && msg.state) {
        updateConnectionStatus('connected');
        handleRemoteState(msg.state);
      }
    });

    transport.connect(roomCode, {
      clientId: 'projector-' + Math.random().toString(36).substring(2, 8),
      role: 'viewer'
    });
  }

  // Khởi động khi DOM sẵn sàng
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initProjectorApp);
  } else {
    initProjectorApp();
  }

  root.ProjectorApp = { init: initProjectorApp };
})(typeof window !== 'undefined' ? window : this);
