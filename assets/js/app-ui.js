/**
 * app-ui.js — Các hàm hỗ trợ UI chung
 * Tách biệt DOM manipulation khỏi logic chính của App
 */
const AppUI = (() => {
  'use strict';

  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${icons[type] || ''}</span><span>${window.SafeHtml.escape(message)}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(20px)';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  function showWelcome() {
    document.getElementById('welcome-screen')?.classList.remove('hidden');
    document.getElementById('loading-screen')?.classList.add('hidden');
    document.getElementById('sheet-area')?.classList.add('hidden');
    document.getElementById('page-bar')?.classList.add('hidden');
    enableControls(false);
    const titleEl = document.getElementById('song-title');
    if (titleEl) {
      titleEl.textContent = 'Chọn bài hát để bắt đầu';
      titleEl.style.color = '';
    }
    const keyEl = document.getElementById('song-key');
    if (keyEl) {
      keyEl.textContent = '';
      keyEl.style.display = 'none';
    }
  }

  function showLoading(text) {
    document.getElementById('welcome-screen')?.classList.add('hidden');
    document.getElementById('sheet-area')?.classList.add('hidden');
    document.getElementById('page-bar')?.classList.add('hidden');
    const ls = document.getElementById('loading-screen');
    ls?.classList.remove('hidden');
    if (text) {
      const lt = document.getElementById('loading-text');
      if (lt) lt.textContent = text;
    }
  }

  function hideLoading() {
    document.getElementById('loading-screen')?.classList.add('hidden');
  }

  function setLoadingText(text) {
    const el = document.getElementById('loading-text');
    if (el) el.textContent = text;
  }

  function showOSMD() {
    document.getElementById('loading-screen')?.classList.add('hidden');
    document.getElementById('welcome-screen')?.classList.add('hidden');
    document.getElementById('sheet-area')?.classList.remove('hidden');
    document.getElementById('page-bar')?.classList.remove('hidden');
    // Luôn hiện capo-wrap khi có bài đang mở
    document.getElementById('capo-wrap')?.classList.remove('hidden');
    const wrapper = document.querySelector('.sheet-viewer-wrapper');
    if (wrapper) wrapper.scrollTop = 0;
  }

  function enableControls(enabled) {
    ['btn-transpose-up','btn-transpose-down','btn-transpose-reset',
     'btn-zoom-in', 'btn-zoom-out',
     'zoom-slider', 'btn-session-panel','btn-print',
     'btn-prev-song','btn-next-song', 'btn-mixer',
     'btn-add-annotate-mode','btn-add-chord-mode','btn-add-chord-mode-bar',
     'btn-chord-highlight',
     'chord-set-selector', 'btn-play-audio',
     'btn-auto-scroll','scroll-speed','btn-dark-mode',
     'btn-perf-notes', 'btn-toolbar-metronome'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.disabled = !enabled;
    });

    // Voice buttons S/A/T/B/♪ — enable/disable cùng lúc với các control khác
    document.querySelectorAll('.voice-btn').forEach(b => { b.disabled = !enabled; });

    // Sync trạng thái active của nút highlight khi enable lại
    if (enabled && window.ChordCanvas?.isHighlightMode) {
      const hlBtn = document.getElementById('btn-chord-highlight');
      if (hlBtn) hlBtn.classList.toggle('active', ChordCanvas.isHighlightMode());
    }

    if (!enabled) {
      if (window.SheetAudioPlayer) window.SheetAudioPlayer.stop();
      if (window.AutoScroller) window.AutoScroller.stop();
    }
  }

  function updateTransposeDisplay(currentTranspose) {
    const disp = document.getElementById('transpose-display');
    if (disp) {
      disp.textContent = currentTranspose === 0 ? '0'
                       : currentTranspose > 0   ? `+${currentTranspose}`
                       : `${currentTranspose}`;
      disp.style.color = currentTranspose === 0 ? 'var(--text-muted)'
                       : currentTranspose > 0 ? 'var(--success)'
                       : 'var(--danger)';
    }

    const gigTrans = document.getElementById('gig-hud-trans');
    if (gigTrans) {
      gigTrans.textContent = currentTranspose === 0 ? '0'
                           : currentTranspose > 0   ? `+${currentTranspose}`
                           : `${currentTranspose}`;
      gigTrans.style.color = currentTranspose === 0 ? 'rgba(255,255,255,0.7)'
                           : currentTranspose > 0 ? '#4ade80'
                           : '#f87171';
    }

    // Cập nhật lại Capo Badge theo tông mới (F6/F12: bảo toàn dải 0-7)
    if (currentTranspose >= 0 && currentTranspose <= 7) {
      updateCapoBadge(window.Store?.get?.('capoLevel') || 0);
    } else {
      updateCapoBadge(window.Store?.get?.('capoLevel') || 0);
    }

    const btnUp   = document.getElementById('btn-transpose-up');
    const btnDown = document.getElementById('btn-transpose-down');
    if (btnUp)   btnUp.style.opacity   = currentTranspose >=  8 ? '.35' : '';
    if (btnDown) btnDown.style.opacity = currentTranspose <= -8 ? '.35' : '';
  }

  /**
   * updateCapoBadge — Hiển thị Capo badge đúng nghĩa (Ticket L0-12)
   * - Capo N thì hiển thị badge: "Capo N · nghe ra [Key]"
   * - Gợi ý capo tốt nhất (bestCapo) phải hiển thị (không bị ẩn)
   */
  function updateCapoBadge(capoValue, bestCapo = null) {
    const badge = document.getElementById('capo-badge');
    const capoSel = document.getElementById('capo-select');
    const capoHint = document.getElementById('capo-hint');
    if (!badge) return;

    const curSong = window.Store?.get?.('currentSong');
    const baseKey = curSong?.defaultKey || window.SongInfoBar?.getSongKey?.() || '';
    const curTranspose = window.Store?.get?.('currentTranspose') || 0;
    const soundingKey = (window.KeyService && baseKey)
      ? window.KeyService.displayKey(baseKey, curTranspose)
      : (baseKey || '');

    const currentCapo = (typeof capoValue === 'number') ? capoValue : (window.Store?.get?.('capoLevel') || 0);

    if (currentCapo > 0) {
      // Đang kẹp capo: tính thế bấm
      const fingeredKey = (window.KeyService && soundingKey)
        ? window.KeyService.displayKey(soundingKey, -currentCapo)
        : '';

      badge.textContent = soundingKey ? `Capo ${currentCapo} · nghe ra ${soundingKey}` : `Capo ${currentCapo}`;
      badge.title = fingeredKey ? `Thế bấm: ${fingeredKey} (Kẹp ngăn ${currentCapo} nghe ra ${soundingKey})` : `Capo ${currentCapo}`;
      badge.classList.remove('hidden');
      badge.style.display = 'inline-flex';

      if (capoHint) {
        capoHint.textContent = fingeredKey ? `→ thế ${fingeredKey}` : `→ ngăn ${currentCapo}`;
      }
      if (capoSel && capoSel.value !== String(currentCapo)) {
        capoSel.value = String(currentCapo);
      }
    } else {
      // Capo = 0: nếu có gợi ý capo tốt nhất (bestCapo)
      const suggested = (typeof bestCapo === 'number' && bestCapo > 0)
        ? bestCapo
        : (typeof capoValue === 'number' && capoValue > 0 ? capoValue : null);

      if (suggested && suggested > 0) {
        const suggestedFingered = (window.KeyService && soundingKey)
          ? window.KeyService.displayKey(soundingKey, -suggested)
          : '';
        badge.textContent = `💡 Gợi ý: Capo ${suggested}${suggestedFingered ? ` (thế ${suggestedFingered})` : ''}`;
        badge.title = `Bấm để kẹp nhanh Capo ngăn ${suggested}`;
        badge.classList.remove('hidden');
        badge.style.display = 'inline-flex';
        badge.onclick = () => {
          if (capoSel) {
            capoSel.value = String(suggested);
            capoSel.dispatchEvent(new Event('change'));
          }
        };
      } else {
        badge.classList.add('hidden');
        badge.style.display = 'none';
      }
      if (capoHint) capoHint.textContent = '';
      if (capoSel && capoSel.value !== '0') capoSel.value = '0';
    }
  }

  function updateSongInfo(song, transpose) {
    if (!song) return;
    const titleEl = document.getElementById('song-title');
    const keyEl   = document.getElementById('song-key');
    const gigTitleEl = document.getElementById('gig-hud-title');
    const gigKeyEl   = document.getElementById('gig-hud-key');

    let prefix = '';
    if (document.querySelector('.toolbar-left')?.classList.contains('in-setlist')) {
        const setlist = window.SetlistUI?.getCurrentSetlist?.();
        const idx = window.SetlistUI?.getCurrentIndex?.();
        if (setlist && setlist.items && idx !== undefined && idx >= 0) {
            prefix = `[Bài ${idx + 1}/${setlist.items.length}] `;
            if (titleEl) titleEl.style.color = 'var(--accent)';
        }
    } else {
        if (titleEl) titleEl.style.color = '';
    }

    const fullTitle = prefix + (song.title || '');
    if (titleEl) titleEl.textContent = fullTitle;
    if (gigTitleEl) gigTitleEl.textContent = fullTitle;

    // Calculate effective key
    let displayKey = '';
    const baseKey = song.defaultKey || window.SongInfoBar?.getSongKey?.() || '';
    const tVal = (typeof transpose === 'number') ? transpose : (window.Store?.get?.('currentTranspose') || 0);

    if (baseKey) {
      if (window.KeyService?.displayKey) {
        displayKey = window.KeyService.displayKey(baseKey, tVal) || baseKey;
      } else if (tVal !== 0 && window.TransposeEngine?.transposeChord) {
        displayKey = TransposeEngine.transposeChord(baseKey, tVal) || baseKey;
      } else {
        displayKey = baseKey;
      }
    }

    if (keyEl) {
      keyEl.textContent = displayKey || '--';
      keyEl.style.display = displayKey ? 'inline-block' : 'none';
      if (tVal !== 0 && baseKey) {
        keyEl.title = `Tông gốc: ${baseKey} (đang dịch ${tVal > 0 ? '+' : ''}${tVal})`;
      } else if (baseKey) {
        keyEl.title = `Tông gốc: ${baseKey}`;
      }
    }

    if (gigKeyEl) {
      gigKeyEl.textContent = displayKey || '--';
    }
  }

  /* ── WAKE LOCK & FULLSCREEN API (Fix F11) ── */
  let _wakeLock = null;

  async function _requestWakeLock() {
    if ('wakeLock' in navigator) {
      try {
        _wakeLock = await navigator.wakeLock.request('screen');
        _wakeLock.addEventListener('release', () => {
          _wakeLock = null;
        });
      } catch (err) {
        // Ignored if background tab or low battery
      }
    }
  }

  function _releaseWakeLock() {
    if (_wakeLock) {
      _wakeLock.release().catch(() => {});
      _wakeLock = null;
    }
  }

  async function _requestFullscreen() {
    try {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch (e) {}
  }

  async function _exitFullscreen() {
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen();
      }
    } catch (e) {}
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && document.body.classList.contains('sheet-only-mode')) {
      _requestWakeLock();
    }
  });

  function toggleFullscreen() {
    const body  = document.body;
    const isOn  = body.classList.toggle('sheet-only-mode');
    const btnFS = document.getElementById('btn-fullscreen');

    if (isOn) {
      const curSong = window.Store?.get?.('currentSong');
      const curTrans = window.Store?.get?.('currentTranspose') || 0;
      if (curSong) updateSongInfo(curSong, curTrans);
      updateTransposeDisplay(curTrans);
      _requestFullscreen();
      _requestWakeLock();
      showToast('Chế độ Biểu Diễn — Màn hình luôn sáng, chạm 2 mép để lật trang, nhấn Thoát hoặc Esc', 'info');
    } else {
      _exitFullscreen();
      _releaseWakeLock();
    }

    if (btnFS) {
      const icon = btnFS.querySelector('.gig-icon');
      const text = btnFS.querySelector('.gig-text');
      if (text) text.textContent = isOn ? 'Thu Nhỏ' : 'Biểu Diễn';
      if (icon) icon.textContent = isOn ? '✕' : '⚡';
    }
  }

  // Wire exit button & gig controls (Esc xử lý tập trung trong _bindKeyboard của app.js)
  (function _initSheetOnly() {
    const exitGig = () => {
      if (document.body.classList.contains('sheet-only-mode')) toggleFullscreen();
    };

    document.getElementById('btn-exit-sheet-only')?.addEventListener('click', exitGig);
    document.getElementById('btn-gig-exit')?.addEventListener('click', exitGig);

    // Gig HUD Transpose buttons
    document.getElementById('btn-gig-trans-down')?.addEventListener('click', (e) => {
      e.stopPropagation();
      window.App?.transposeBy?.(-1);
    });
    document.getElementById('btn-gig-trans-up')?.addEventListener('click', (e) => {
      e.stopPropagation();
      window.App?.transposeBy?.(+1);
    });

    // Gig HUD Auto-Scroll button
    document.getElementById('btn-gig-scroll-toggle')?.addEventListener('click', (e) => {
      e.stopPropagation();
      document.getElementById('btn-auto-scroll')?.click();
    });

    // Hands-free Edge-Tap page navigation
    document.getElementById('edge-tap-prev')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (window.PageNav?.goToPrev) {
        window.PageNav.goToPrev();
      } else {
        const wrap = document.getElementById('sheet-viewer-wrapper');
        wrap?.scrollBy({ top: -Math.round(window.innerHeight * 0.75), behavior: 'smooth' });
      }
    });

    document.getElementById('edge-tap-next')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (window.PageNav?.goToNext) {
        window.PageNav.goToNext();
      } else {
        const wrap = document.getElementById('sheet-viewer-wrapper');
        wrap?.scrollBy({ top: Math.round(window.innerHeight * 0.75), behavior: 'smooth' });
      }
    });
  })();



  function escapeHtml(str) {
    if (window.SafeHtml && typeof window.SafeHtml.escape === 'function') {
      return window.SafeHtml.escape(str);
    }
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function updateSessionPanel(currentTranspose, historyData) {
    const today   = new Date().toLocaleDateString('vi-VN');
    const toneStr = currentTranspose === 0 ? 'Tông gốc'
                  : currentTranspose > 0  ? `+${currentTranspose} nửa cung`
                  : `${currentTranspose} nửa cung`;

    const dateEl = document.getElementById('session-date');
    const toneEl = document.getElementById('session-tone');
    if (dateEl) dateEl.textContent = today;
    if (toneEl) toneEl.textContent = toneStr;

    _renderSessionHistory(historyData);
  }

  function _renderSessionHistory(history) {
    const listEl  = document.getElementById('session-history-list');
    if (!listEl) return;
    if (!history || !history.length) {
      listEl.innerHTML = '<p class="text-muted text-sm">Chưa có lịch sử</p>';
      return;
    }

    listEl.innerHTML = [...history].reverse().slice(0, 20).map(h => {
      const toneLabel = !h.tone ? 'Tông gốc'
                      : h.tone > 0 ? `+${h.tone} nửa cung`
                      : `${h.tone} nửa cung`;
      return `
        <div class="history-item">
          <div class="history-item-date">${escapeHtml(h.date)}</div>
          <span class="history-item-tone">${escapeHtml(toneLabel)}</span>
          ${h.note ? `<div class="history-item-note">${escapeHtml(h.note)}</div>` : ''}
        </div>`;
    }).join('');
  }

  return { showToast, showWelcome, showLoading, hideLoading, setLoadingText, showOSMD, enableControls, updateTransposeDisplay, updateCapoBadge, updateSongInfo, toggleFullscreen, updateSessionPanel };
})();

window.AppUI = AppUI;

