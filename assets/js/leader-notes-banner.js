/**
 * assets/js/leader-notes-banner.js
 *
 * Quản lý Dải Vàng Ghi Chú Ca Trưởng ở đầu bài hát (Ticket L3-3):
 * - Hiển thị ghi chú của ca trưởng (leader_notes) được lưu trong setlist_items.
 * - Giao diện dải màu vàng hổ phách dịu mắt, tương thích hoàn hảo Light Mode & Dark Mode.
 * - Hỗ trợ thu gọn (collapsed) / mở rộng (expanded) mượt mà, lưu tuỳ chọn vào localStorage.
 * - Tự động ẩn khi bài không có ghi chú hoặc khi không phát trong chương trình setlist.
 */

const LeaderNotesBanner = (() => {
  'use strict';

  const STORAGE_KEY = 'sheetapp_leader_notes_collapsed';
  let _currentText = '';
  let _isCollapsed = false;

  function init() {
    _isCollapsed = localStorage.getItem(STORAGE_KEY) === '1';
    _bindEvents();
    _syncUI();
  }

  function _bindEvents() {
    const banner = document.getElementById('leader-notes-banner');
    if (!banner) return;

    // Nút Thu gọn / Mở rộng
    const toggleBtn = document.getElementById('btn-toggle-leader-notes');
    toggleBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      e.currentTarget?.blur();
      toggle();
    });

    // Nút đóng/ẩn tạm thời
    const closeBtn = document.getElementById('btn-close-leader-notes');
    closeBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      e.currentTarget?.blur();
      hide();
    });

    // Bấm vào header dải vàng khi đang thu gọn thì tự động mở rộng
    banner.addEventListener('click', (e) => {
      if (_isCollapsed && !e.target.closest('#btn-close-leader-notes')) {
        toggle();
      }
    });
  }

  function show(text) {
    if (!text || typeof text !== 'string' || text.trim() === '') {
      hide();
      return;
    }

    _currentText = text.trim();
    const banner = document.getElementById('leader-notes-banner');
    const textEl = document.getElementById('leader-notes-text');

    if (textEl) {
      textEl.textContent = _currentText;
    }

    if (banner) {
      banner.classList.remove('hidden');
    }

    _syncUI();
  }

  function hide() {
    _currentText = '';
    const banner = document.getElementById('leader-notes-banner');
    if (banner) {
      banner.classList.add('hidden');
    }
  }

  function toggle() {
    _isCollapsed = !_isCollapsed;
    localStorage.setItem(STORAGE_KEY, _isCollapsed ? '1' : '0');
    _syncUI();
  }

  function isCollapsed() {
    return _isCollapsed;
  }

  function isVisible() {
    const banner = document.getElementById('leader-notes-banner');
    return !!(banner && !banner.classList.contains('hidden'));
  }

  function getText() {
    return _currentText;
  }

  function _syncUI() {
    const banner = document.getElementById('leader-notes-banner');
    const toggleBtn = document.getElementById('btn-toggle-leader-notes');
    const iconEl = document.getElementById('ln-toggle-icon');
    const labelEl = document.getElementById('ln-toggle-label');

    if (!banner) return;

    if (_isCollapsed) {
      banner.classList.add('collapsed');
      if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'false');
      if (iconEl) iconEl.textContent = '▼';
      if (labelEl) labelEl.textContent = 'Mở rộng';
    } else {
      banner.classList.remove('collapsed');
      if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'true');
      if (iconEl) iconEl.textContent = '▲';
      if (labelEl) labelEl.textContent = 'Thu gọn';
    }
  }

  return {
    init,
    show,
    hide,
    toggle,
    isCollapsed,
    isVisible,
    getText
  };
})();

if (typeof window !== 'undefined') {
  window.LeaderNotesBanner = LeaderNotesBanner;
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', LeaderNotesBanner.init);
    } else {
      LeaderNotesBanner.init();
    }
  }
}
