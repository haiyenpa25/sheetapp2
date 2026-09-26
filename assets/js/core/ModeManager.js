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

    // Thoát chế độ khi nhấn phím Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const tag = document.activeElement?.tagName?.toLowerCase();
        if (tag === 'input' || tag === 'textarea') return;
        if (_currentMode !== MODES.VIEW) {
          resetToView();
        }
      }
    });
  }

  function getMode() {
    return _currentMode;
  }

  function setMode(mode) {
    if (!Object.values(MODES).includes(mode)) return;
    if (_currentMode === mode) return;

    // Kiểm tra quyền đối với chế độ Sửa Hợp Âm
    if (mode === MODES.EDIT_CHORDS) {
      const user = window.Store?.get?.('currentUser') || window.Auth?.getUser?.();
      const canEdit = user && (user.role === 'admin' || user.role === 'banhat');
      if (!canEdit) {
        window.AppUI?.showToast?.('Chỉ nhạc công Ban Hát hoặc Quản Trị Viên mới có quyền điền hợp âm', 'warning');
        return;
      }
    }

    const prevMode = _currentMode;
    _currentMode = mode;
    const body = document.body;
    body.dataset.appMode = mode;

    // 1. Điều phối chế độ Biểu Diễn (Performance)
    const isPerformance = (mode === MODES.PERFORMANCE);
    body.classList.toggle('sheet-only-mode', isPerformance);
    if (isPerformance) {
      _requestFullscreen();
      _requestWakeLock();
      window.KeyboardHandler?.enableMIDI?.();
      window.LiveSync?.ensureLoaded?.();
      window.AppUI?.showToast?.('Chế độ Biểu Diễn — Toàn màn hình, nhấn F hoặc Esc để thoát', 'info');
    } else if (prevMode === MODES.PERFORMANCE) {
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

    // 3. Đồng bộ giao diện Nút Biểu Diễn
    const btnGig = document.getElementById('btn-fullscreen');
    if (btnGig) {
      const icon = btnGig.querySelector('.gig-icon');
      const text = btnGig.querySelector('.gig-text');
      if (text) text.textContent = isPerformance ? 'Thu Nhỏ' : 'Biểu Diễn';
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
    resetToView
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
