/**
 * assets/js/core/ModeManager.js
 * Quản lý tập trung 3 chế độ vận hành của SheetApp:
 * 1. 'view'         — Xem / Đọc sheet (mặc định)
 * 2. 'edit_chords'  — Sửa / Điền hợp âm trực tiếp
 * 3. 'performance'  — Biểu diễn sân khấu (Gig Mode / Toàn màn hình)
 */

const ModeManager = (() => {
  'use strict';

  const MODES = {
    VIEW: 'view',
    EDIT_CHORDS: 'edit_chords',
    PERFORMANCE: 'performance'
  };

  let _currentMode = MODES.VIEW;
  let _wasDarkModeBeforeGig = false;
  let _hudFadeTimeout = null;
  const HUD_FADE_DELAY = 3000; // L1-5: HUD tự mờ sau 3 giây

  function init() {
    _currentMode = MODES.VIEW;
    document.body.dataset.appMode = MODES.VIEW;
    _bindEvents();
  }

  function _bindEvents() {
    // Nút Biểu Diễn trên Toolbar
    document.getElementById('btn-fullscreen')?.addEventListener('click', (e) => {
      e.currentTarget?.blur();
      togglePerformance();
    });

    // Nút Điền Hợp Âm trên Toolbar
    document.getElementById('btn-add-chord-mode-bar')?.addEventListener('click', (e) => {
      e.currentTarget?.blur();
      toggleEditChords();
    });

    // Nút Thoát Chế Độ Biểu Diễn (Góc trên phải khi toàn màn hình)
    document.getElementById('btn-exit-sheet-only')?.addEventListener('click', () => {
      resetToView();
    });

    // Tương tác với HUD nổi: di chuột hoặc chạm vào sẽ reset timer 3s (Ticket L1-5)
    const gigHud = document.getElementById('gig-floating-hud');
    if (gigHud) {
      ['mousemove', 'touchstart', 'pointerdown', 'click'].forEach((evt) => {
        gigHud.addEventListener(evt, () => {
          _resetHudTimer();
        }, { passive: true });
      });
    }

    // Tự động khôi phục Wake Lock khi tab hiển thị lại trong chế độ Biểu Diễn
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && _currentMode === MODES.PERFORMANCE) {
        _requestWakeLock();
      }
    });

    // Thoát tập trung qua ModeManager khi nhấn phím Escape (Ticket L0-16)
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        handleEscape(e);
      }
    });
  }

  function handleEscape(e) {
    // 1. Popup sửa hợp âm
    const chordPopup = document.querySelector('.chord-popup-overlay, #chord-popup-modal, .cc-popup');
    if (chordPopup || window.ChordCanvasEdit?.isPopupOpen?.()) {
      window.ChordCanvasEdit?.closePopup?.();
      chordPopup?.remove?.();
      e?.preventDefault?.();
      return true;
    }

    // 2. Sidebar overlay nếu đang mở trên màn hình <= 1440px (Ticket R1-7)
    const sidebar = document.getElementById('sidebar');
    if (sidebar && !sidebar.classList.contains('mobile-hidden') && window.innerWidth <= 1440) {
      document.getElementById('sidebar-overlay')?.click();
      e?.preventDefault?.();
      return true;
    }

    // 3. Modals / Bottom sheets (đóng lớp trên cùng trước tiên)
    const openSheet = document.querySelector('.bottom-sheet:not(.hidden), .modal-overlay:not(.hidden), [role="dialog"]:not(.hidden)');
    if (window.ModalManager?.hasOpenModals?.() || openSheet) {
      if (window.ModalManager?.hasOpenModals?.()) {
        window.ModalManager.closeTopmost();
      } else if (openSheet) {
        openSheet.classList.add('hidden');
      }
      e?.preventDefault?.();
      return true;
    }

    // 3. Nếu người dùng đang gõ trong input/textarea độc lập ngoài trang (thanh tìm kiếm bài...)
    const activeEl = document.activeElement;
    const tag = activeEl?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea') {
      activeEl.blur();
      e?.preventDefault?.();
      return true;
    }

    // 4. Menu ⋮ Toolbar (nếu đang mở)
    const moreMenu = document.getElementById('toolbar-more-menu');
    if (moreMenu && !moreMenu.classList.contains('hidden')) {
      moreMenu.classList.add('hidden');
      document.getElementById('btn-more-options')?.setAttribute('aria-expanded', 'false');
      e?.preventDefault?.();
      return true;
    }

    // 5. Nếu đang ở chế độ đặc biệt (edit_chords hoặc performance) -> thoát về VIEW
    if (_currentMode !== MODES.VIEW) {
      resetToView();
      e?.preventDefault?.();
      return true;
    }

    return false;
  }

  function getMode() {
    return _currentMode;
  }

  function setMode(mode) {
    if (!Object.values(MODES).includes(mode)) return;
    if (_currentMode === mode) return;

    // Kiểm tra quyền đối với chế độ Sửa Hợp Âm
    if (mode === MODES.EDIT_CHORDS) {
      const canEdit = (window.Auth && typeof window.Auth.isBanhat === 'function')
        ? window.Auth.isBanhat()
        : Boolean(window.Store?.get?.('currentUser')?.role === 'admin' || window.Store?.get?.('currentUser')?.role === 'banhat');
      if (!canEdit) {
        window.AppUI?.showToast?.('Chỉ nhạc công Ban Hát hoặc Quản Trị Viên mới có quyền điền hợp âm', 'warning');
        return;
      }
    }

    const prevMode = _currentMode;
    _currentMode = mode;
    const body = document.body;
    body.dataset.appMode = mode;

    // 1. Điều phối chế độ Biểu Diễn (Performance - Ticket L1-5)
    const isPerformance = (mode === MODES.PERFORMANCE);
    body.classList.toggle('sheet-only-mode', isPerformance);
    if (isPerformance) {
      // Mặc định nền tối khi biểu diễn (L1-5)
      _wasDarkModeBeforeGig = body.classList.contains('dark-mode');
      body.classList.add('dark-mode');
      _startHudTimer();

      _requestFullscreen();
      _requestWakeLock();
      window.KeyboardHandler?.enableMIDI?.();
      window.LiveSync?.ensureLoaded?.();
      const HINT_KEY = 'sheetapp_gig_hint_shown';
      if (!sessionStorage.getItem(HINT_KEY)) {
        sessionStorage.setItem(HINT_KEY, '1');
        window.AppUI?.showToast?.('Chế độ Toàn màn hình — Nhấn F hoặc Esc để thoát', 'info');
      }
    } else if (prevMode === MODES.PERFORMANCE) {
      _clearHudTimer();
      // Khôi phục trạng thái ban đầu của người dùng nếu trước đó không bật dark-mode
      if (!_wasDarkModeBeforeGig) {
        body.classList.remove('dark-mode');
      }
      _exitFullscreen();
      _releaseWakeLock();
    }

    // 2. Điều phối chế độ Sửa Hợp Âm (Edit Chords)
    const isEditChords = (mode === MODES.EDIT_CHORDS);
    body.classList.toggle('chord-edit-mode', isEditChords);
    if (window.ChordCanvas?.setAddMode) {
      window.ChordCanvas.setAddMode(isEditChords);
    }
    if (isEditChords) {
      window.AppUI?.showToast?.('Chế độ Sửa Hợp Âm — Chạm vào nốt nhạc để điền hợp âm (phím C/Esc để thoát)', 'info');
    }

    // 3. Đồng bộ giao diện Nút Toàn Màn Hình
    const btnGig = document.getElementById('btn-fullscreen');
    if (btnGig) {
      const icon = btnGig.querySelector('.gig-icon');
      const text = btnGig.querySelector('.gig-text');
      if (text) text.textContent = isPerformance ? 'Thu Nhỏ' : 'Toàn Màn Hình';
      if (icon) icon.textContent = isPerformance ? '✕' : '⚡';
    }

    // 4. Đồng bộ giao diện Nút Điền Hợp Âm
    const btnChord = document.getElementById('btn-add-chord-mode-bar');
    if (btnChord) {
      btnChord.classList.toggle('active', isEditChords);
    }

    // 5. Ẩn nút trợ năng FAB trong chế độ Biểu Diễn để không che bản nhạc
    const fabWrap = document.getElementById('fab-wrap');
    if (fabWrap) {
      fabWrap.classList.toggle('hidden', isPerformance);
    }

    // 6. Phát sự kiện ra toàn hệ thống
    window.EventBus?.emit?.('app:mode_change', { mode, prevMode });
    if (typeof window !== 'undefined' && window.Store?.set) {
      window.Store.set('mode', mode);
    }
  }

  function togglePerformance() {
    setMode(_currentMode === MODES.PERFORMANCE ? MODES.VIEW : MODES.PERFORMANCE);
  }

  function toggleEditChords() {
    setMode(_currentMode === MODES.EDIT_CHORDS ? MODES.VIEW : MODES.EDIT_CHORDS);
  }

  function resetToView() {
    if (_currentMode !== MODES.VIEW) {
      setMode(MODES.VIEW);
    }
  }

  /* HUD Fade Control Helpers (Ticket L1-5) */
  function _fadeHud() {
    const hud = document.getElementById('gig-floating-hud');
    if (hud && _currentMode === MODES.PERFORMANCE) {
      hud.classList.add('faded');
    }
  }

  function _showHud() {
    const hud = document.getElementById('gig-floating-hud');
    if (hud) {
      hud.classList.remove('faded');
    }
    _resetHudTimer();
  }

  function _resetHudTimer() {
    if (_hudFadeTimeout) {
      clearTimeout(_hudFadeTimeout);
      _hudFadeTimeout = null;
    }
    if (_currentMode === MODES.PERFORMANCE) {
      _hudFadeTimeout = setTimeout(_fadeHud, HUD_FADE_DELAY);
    }
  }

  function _startHudTimer() {
    const hud = document.getElementById('gig-floating-hud');
    if (hud) {
      hud.classList.remove('faded');
    }
    _resetHudTimer();
  }

  function _clearHudTimer() {
    if (_hudFadeTimeout) {
      clearTimeout(_hudFadeTimeout);
      _hudFadeTimeout = null;
    }
    const hud = document.getElementById('gig-floating-hud');
    if (hud) {
      hud.classList.remove('faded');
    }
  }

  /* Fullscreen & WakeLock Helpers */
  let _wakeLock = null;

  async function _requestWakeLock() {
    try {
      if ('wakeLock' in navigator && !_wakeLock) {
        _wakeLock = await navigator.wakeLock.request('screen');
      }
    } catch (e) {}
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

  return {
    MODES,
    init,
    getMode,
    setMode,
    togglePerformance,
    toggleEditChords,
    resetToView,
    handleEscape,
    showHud: _showHud,
    fadeHud: _fadeHud,
    resetHudTimer: _resetHudTimer
  };
})();

// Gắn vào window và tự động khởi tạo khi DOM sẵn sàng
if (typeof window !== 'undefined') {
  window.ModeManager = ModeManager;
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', ModeManager.init);
    } else {
      ModeManager.init();
    }
  }
}
