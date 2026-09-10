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
    toast.innerHTML = `<span>${icons[type] || ''}</span><span>${message}</span>`;
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

    // Sync Capo select: Capo ngăn = số tông tăng
    // Tăng 2 tông → kẹp ngăn 2 để đàn thế bấm gốc
    const capoSel = document.getElementById('capo-select');
    if (capoSel) {
      capoSel.value = String(Math.max(0, Math.min(7, currentTranspose)));
    }
    // Cập nhật capo hint với tên tông gốc
    const capoHint = document.getElementById('capo-hint');
    if (capoHint) {
      if (currentTranspose > 0) {
        const origKey = window.SongInfoBar?.getSongKey?.() || '';
        // VD: "→ ngăn 2, đàn thế G gốc" hoặc "→ kẹp ngăn 2" nếu chưa biết key
        capoHint.textContent = origKey
          ? `→ ngăn ${currentTranspose}, đàn thế ${origKey} gốc`
          : `→ kẹp ngăn ${currentTranspose}`;
      } else {
        capoHint.textContent = '';
      }
    }

    const btnUp   = document.getElementById('btn-transpose-up');
    const btnDown = document.getElementById('btn-transpose-down');
    if (btnUp)   btnUp.style.opacity   = currentTranspose >=  8 ? '.35' : '';
    if (btnDown) btnDown.style.opacity = currentTranspose <= -8 ? '.35' : '';
  }

  /**
   * updateCapoBadge — Hiển thị gợi ý capo TỐI ƯU (riêng biệt với capo select)
   * Chỉ quản lý phần tử #capo-badge, KHÔNG đụng vào #capo-hint (do updateTransposeDisplay quản lý)
   */
  function updateCapoBadge(capoValue) {
    const badge = document.getElementById('capo-badge');
    if (!badge) return;
    badge.style.display = 'none';
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
      if (tVal !== 0 && window.TransposeEngine?.transposeChord) {
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

  function toggleFullscreen() {
    const body  = document.body;
    const isOn  = body.classList.toggle('sheet-only-mode');
    const btnFS = document.getElementById('btn-fullscreen');

    if (isOn) {
      const curSong = window.Store?.get?.('currentSong');
      const curTrans = window.Store?.get?.('currentTranspose') || 0;
      if (curSong) updateSongInfo(curSong, curTrans);
      updateTransposeDisplay(curTrans);
      showToast('Chế độ Biểu Diễn — Chạm 2 mép để lật trang, nhấn Thoát hoặc Esc', 'info');
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
    return String(str||'').replace(/</g,'&lt;').replace(/>/g,'&gt;');
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
          <div class="history-item-date">${h.date}</div>
          <span class="history-item-tone">${toneLabel}</span>
          ${h.note ? `<div class="history-item-note">${escapeHtml(h.note)}</div>` : ''}
        </div>`;
    }).join('');
  }

  return { showToast, showWelcome, showLoading, hideLoading, setLoadingText, showOSMD, enableControls, updateTransposeDisplay, updateCapoBadge, updateSongInfo, toggleFullscreen, updateSessionPanel };
})();
