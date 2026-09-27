/**
 * assets/js/core/ModalManager.js
 *
 * Quản trị hộp thoại Modal & Accessibility (A11y) tập trung cho SheetApp2:
 * 1. Focus Management: Ghi nhớ phần tử đang focus và khôi phục (Focus Restore) khi đóng modal.
 * 2. Focus Trap: Giữ phím Tab luôn luân chuyển bên trong modal khi đang mở, không lọt ra ngoài.
 * 3. Central Escape Handler: Một bộ xử lý phím Escape duy nhất, đóng modal trên cùng ngăn tranh chấp.
 * 4. A11y Attributes: Tự động gán role="dialog", aria-modal="true", aria-labelledby.
 * 5. Z-Index Management: Đảm bảo modal luôn hiển thị đúng thứ tự thang z-index chuẩn.
 *
 * Expose: window.ModalManager
 */
(function(window) {
  'use strict';

  const _modalStack = [];
  const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

  /**
   * Lấy modal element từ ID hoặc Element
   */
  function _resolveModal(modalIdOrEl) {
    if (!modalIdOrEl) return null;
    if (typeof modalIdOrEl === 'string') {
      const cleanId = modalIdOrEl.replace(/^#/, '');
      return document.getElementById(cleanId);
    }
    return modalIdOrEl instanceof HTMLElement ? modalIdOrEl : null;
  }

  /**
   * Thiết lập Focus Trap cho modal
   */
  function _trapFocus(modal, e) {
    if (e.key !== 'Tab') return;

    const focusables = Array.from(modal.querySelectorAll(FOCUSABLE_SELECTOR))
      .filter(el => el.offsetParent !== null && !el.hasAttribute('disabled') && !el.closest('.hidden'));

    if (focusables.length === 0) {
      e.preventDefault();
      e.stopPropagation();
      if (!modal.hasAttribute('tabindex')) modal.setAttribute('tabindex', '-1');
      modal.focus();
      return;
    }

    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    e.preventDefault();
    e.stopPropagation();

    const curIdx = focusables.indexOf(document.activeElement);

    if (e.shiftKey) {
      // Shift + Tab: lùi lại
      if (curIdx <= 0) {
        last.focus();
      } else {
        focusables[curIdx - 1].focus();
      }
    } else {
      // Tab: tiến tới
      if (curIdx === -1 || curIdx >= focusables.length - 1) {
        first.focus();
      } else {
        focusables[curIdx + 1].focus();
      }
    }
  }

  /**
   * Mở modal
   */
  function open(modalIdOrEl, triggerEl) {
    const modal = _resolveModal(modalIdOrEl);
    if (!modal) return false;

    // Ghi nhớ phần tử đang focus trước khi mở
    let prevFocus = triggerEl || document.activeElement;
    if ((!prevFocus || prevFocus === document.body) && typeof window !== 'undefined' && window.event) {
      try {
        const evTarget = window.event.target || window.event.srcElement;
        if (evTarget && typeof evTarget.closest === 'function') {
          const candidate = evTarget.closest('button, a, [tabindex], input, select, .btn, .icon-btn');
          if (candidate) prevFocus = candidate;
        }
      } catch (e) {}
    }

    if (prevFocus && prevFocus instanceof HTMLElement && !prevFocus.hasAttribute('tabindex')) {
      prevFocus.setAttribute('tabindex', '0');
    }

    // Chuẩn hóa A11y Attributes
    if (!modal.hasAttribute('role')) modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');

    // Tìm tiêu đề để gắn aria-labelledby nếu chưa có
    if (!modal.hasAttribute('aria-labelledby')) {
      const titleEl = modal.querySelector('h2, h3, .modal-title, .mgr-modal-title');
      if (titleEl) {
        if (!titleEl.id) {
          titleEl.id = 'modal-title-' + Math.random().toString(36).substring(2, 7);
        }
        modal.setAttribute('aria-labelledby', titleEl.id);
      }
    }

    // Hiển thị modal
    modal.classList.remove('hidden');

    // Lưu vào stack
    const entry = {
      modal,
      prevFocus
    };
    _modalStack.push(entry);

    // Focus ngay lập tức và dự phòng sau render
    const focusFirst = () => {
      const focusables = Array.from(modal.querySelectorAll(FOCUSABLE_SELECTOR))
        .filter(el => el.offsetParent !== null && !el.hasAttribute('disabled') && !el.closest('.hidden'));
      if (focusables.length > 0) {
        focusables[0].focus();
      } else {
        if (!modal.hasAttribute('tabindex')) modal.setAttribute('tabindex', '-1');
        modal.focus();
      }
    };
    focusFirst();
    setTimeout(focusFirst, 30);

    // Bắn sự kiện modal mở
    if (window.EventBus) {
      window.EventBus.emit('modal:opened', { modalId: modal.id });
    }

    return true;
  }

  /**
   * Đóng modal
   */
  function close(modalIdOrEl) {
    let entry = null;

    if (!modalIdOrEl) {
      // Đóng modal trên cùng của stack
      entry = _modalStack.pop();
    } else {
      const target = _resolveModal(modalIdOrEl);
      const idx = _modalStack.findIndex(item => item.modal === target);
      if (idx !== -1) {
        entry = _modalStack.splice(idx, 1)[0];
      } else if (target) {
        // Fallback đóng trực tiếp nếu không nằm trong stack
        target.classList.add('hidden');
        return true;
      }
    }

    if (!entry) return false;

    const { modal, prevFocus } = entry;

    // Ẩn modal
    modal.classList.add('hidden');

    // Khôi phục focus cho phần tử trước đó (Focus Restore)
    if (prevFocus && typeof prevFocus.focus === 'function') {
      try {
        if (prevFocus instanceof HTMLElement && !prevFocus.hasAttribute('tabindex')) {
          prevFocus.setAttribute('tabindex', '0');
        }
        prevFocus.focus();
      } catch (e) {}
    }

    // Bắn sự kiện modal đóng
    if (window.EventBus) {
      window.EventBus.emit('modal:closed', { modalId: modal.id });
    }

    return true;
  }

  /**
   * Đóng toàn bộ modal đang mở
   */
  function closeAll() {
    while (_modalStack.length > 0) {
      close();
    }
  }

  /**
   * Lấy modal đang active trên cùng
   */
  function getActiveModal() {
    return _modalStack.length > 0 ? _modalStack[_modalStack.length - 1].modal : null;
  }

  /**
   * Global Central Keyboard Handler (Tab Trap & Escape Stack điều phối tập trung)
   */
  window.addEventListener('keydown', (e) => {
    if (_modalStack.length === 0) return;

    const currentEntry = _modalStack[_modalStack.length - 1];
    const currentModal = currentEntry.modal;

    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close(currentModal);
      return;
    }

    if (e.key === 'Tab') {
      _trapFocus(currentModal, e);
    }
  }, true); // Use capture phase để bắt trước các component con và ngăn focus lọt ra ngoài

  /**
   * Tự động quét và bind các nút đóng modal sẵn có trên trang
   */
  function autoBindModals() {
    // 1. Bind các nút đóng modal
    document.querySelectorAll('.modal-close, [data-close], [data-close-modal], .mgr-modal-close, .stage-modal-close, [id^="btn-close-"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const modal = btn.closest('.modal-overlay, .mgr-modal-overlay, .stage-modal-overlay, .bottom-sheet, .session-panel, [role="dialog"]');
        if (modal) {
          e.preventDefault();
          close(modal);
        }
      });
    });

    // 2. Click ngoài backdrop để đóng modal
    document.querySelectorAll('.modal-overlay, .mgr-modal-overlay, .stage-modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          close(overlay);
        }
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoBindModals);
  } else {
    autoBindModals();
  }

  window.ModalManager = {
    open,
    close,
    closeAll,
    closeTopmost: () => close(),
    hasOpenModals: () => _modalStack.length > 0,
    getActiveModal,
    getStackDepth: () => _modalStack.length,
    autoBindModals
  };

})(typeof window !== 'undefined' ? window : this);
