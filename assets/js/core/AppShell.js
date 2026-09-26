/**
 * assets/js/core/AppShell.js
 *
 * Điều phối hành vi thanh điều hướng App Shell dùng chung cho 4 Trụ Cột:
 * 1. 📚 Thư Viện (/)
 * 2. 🎤 Biểu Diễn (/live-band/)
 * 3. 🎹 Tập Luyện (/learn/)
 * 4. 🛠️ Quản Lý (/manager/)
 *
 * Nhiệm vụ chính:
 * - Tự động nhận diện Trụ Cột đang kích hoạt (Active Pillar).
 * - Bảo toàn ngữ cảnh bài hát (?song=) khi chuyển đổi qua lại giữa các trụ cột.
 * - Điều hướng trợ giúp theo ngữ cảnh (Context Help) vào đúng chương trong /huong-dan/.
 * - Quản lý đồng bộ sự kiện đăng nhập / đăng xuất trên toàn bộ 4 trụ cột.
 * - Tự động ẩn thanh điều hướng khi vào chế độ toàn màn hình sân khấu.
 */
(function(window) {
  'use strict';

  let _currentSongId = '';

  const HELP_MAPPING = {
    library: '#mod-2',  // Đọc sheet & hợp âm
    live:    '#mod-6',  // Sân khấu & ban nhạc
    learn:   '#mod-7',  // Phòng tập thông minh & SATB
    manager: '#mod-4',  // Quản lý kho nhạc & phân quyền
    editor:  '#mod-8'   // Sửa Sheet MusicXML
  };

  /**
   * Nhận diện Trụ Cột hiện tại dựa trên đường dẫn URL
   */
  function getActivePillar() {
    const path = window.location.pathname.toLowerCase();
    if (path.includes('/live-band')) return 'live';
    if (path.includes('/learn')) return 'learn';
    if (path.includes('/manager')) return 'manager';
    if (path.includes('/editor')) return 'editor';
    if (path.includes('/huong-dan')) return 'guide';
    return 'library';
  }

  /**
   * Cập nhật bài hát hiện tại vào tất cả liên kết của App Shell
   */
  function _getBase() {
    if (typeof window !== 'undefined' && typeof window.__APP_BASE__ === 'string') {
      return window.__APP_BASE__.replace(/\/+$/, '');
    }
    return '';
  }

  function syncSongParam(songId) {
    if (!songId) return;
    _currentSongId = String(songId).trim();
    const base = _getBase();
    const query = '?song=' + encodeURIComponent(_currentSongId);

    // Cập nhật tab Thư Viện
    const libTab = document.getElementById('pillar-library');
    if (libTab) libTab.href = (base ? base : '') + '/' + query;

    // Cập nhật tab Biểu Diễn
    const liveTab = document.getElementById('pillar-live');
    if (liveTab) liveTab.href = (base ? base : '') + '/live-band/' + query;

    // Cập nhật tab Tập Luyện
    const learnTab = document.getElementById('pillar-learn');
    if (learnTab) learnTab.href = (base ? base : '') + '/learn/' + query;

    // Cập nhật tab Quản Lý
    const mgrTab = document.getElementById('pillar-manager');
    if (mgrTab) mgrTab.href = (base ? base : '') + '/manager/' + query;

    // Cập nhật Logo
    const brand = document.querySelector('.shell-brand');
    if (brand) brand.href = (base ? base : '') + '/' + query;
  }

  /**
   * Cập nhật liên kết trợ giúp theo ngữ cảnh
   */
  function _updateContextHelp(pillar) {
    const helpBtn = document.getElementById('shell-context-help-btn');
    if (helpBtn) {
      const base = _getBase();
      const anchor = HELP_MAPPING[pillar] || '#mod-2';
      helpBtn.href = (base ? base : '') + '/huong-dan/' + anchor;
    }
  }

  /**
   * Khởi tạo các sự kiện của App Shell
   */
  function init() {
    const pillar = getActivePillar();
    const nav = document.getElementById('app-shell-navbar');
    if (nav) {
      nav.setAttribute('data-active-pillar', pillar);
    }

    _updateContextHelp(pillar);

    // Đọc mã bài hát từ URL query nếu có sẵn
    const urlParams = new URLSearchParams(window.location.search);
    const initialSong = urlParams.get('song');
    if (initialSong) {
      syncSongParam(initialSong);
    }

    // Lắng nghe sự kiện chuyển bài từ EventBus (nếu có)
    if (window.EventBus) {
      window.EventBus.on('song:loaded', (data) => {
        const id = data?.id || data?.songId || data?.song?.id;
        if (id) syncSongParam(id);
      });
      window.EventBus.on('song:selected', (data) => {
        const id = data?.id || data?.songId;
        if (id) syncSongParam(id);
      });
    }

    // Bắt sự kiện Đăng xuất
    document.getElementById('shell-btn-logout')?.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!confirm('Bạn có chắc chắn muốn đăng xuất khỏi hệ thống?')) return;

      try {
        if (window.ApiService && window.ApiService.auth && window.ApiService.auth.logout) {
          await window.ApiService.auth.logout();
        } else {
          const base = _getBase();
          const logoutUrl = (window.ApiService && typeof window.ApiService.resolveUrl === 'function')
            ? window.ApiService.resolveUrl('api/index.php?route=auth&action=logout')
            : (base ? `${base}/api/?route=auth&action=logout` : '/api/?route=auth&action=logout');
          // INTENTIONAL EXCEPTION: Standalone AppShell fallback logout
          await fetch(logoutUrl, { method: 'POST' });
        }
      } catch (err) {}
      window.location.reload();
    });

    // Bắt sự kiện Đăng nhập
    document.getElementById('shell-btn-login')?.addEventListener('click', (e) => {
      e.preventDefault();
      // Nếu có modal đăng nhập (app chính)
      const authModal = document.getElementById('auth-modal');
      if (authModal) {
        if (window.ModalManager) {
          window.ModalManager.open(authModal);
        } else {
          authModal.classList.remove('hidden');
        }
        return;
      }
      // Nếu ở sub-app, chuyển hướng về trang đăng nhập của Manager
      const base = _getBase();
      window.location.href = (base ? base : '') + '/manager/#login';
    });

    // Lắng nghe Fullscreen để ẩn App Shell trên sân khấu
    document.addEventListener('fullscreenchange', () => {
      if (document.fullscreenElement) {
        document.body.classList.add('is-fullscreen');
      } else {
        document.body.classList.remove('is-fullscreen');
      }
    });

    _initNotifications();

    console.log('[AppShell] Initialized. Active Pillar:', pillar);
  }

  let _notifications = [];
  let _unreadCount = 0;
  let _pollTimer = null;

  function _escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function _formatTime(isoString) {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffSec = Math.floor((now - date) / 1000);
      if (diffSec < 60) return 'Vừa xong';
      if (diffSec < 3600) return Math.floor(diffSec / 60) + ' phút trước';
      if (diffSec < 86400) return Math.floor(diffSec / 3600) + ' giờ trước';
      return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
    } catch (e) {
      return isoString;
    }
  }

  function _updateBadge(count) {
    const notifBadge = document.getElementById('shell-notif-badge');
    _unreadCount = Math.max(0, parseInt(count, 10) || 0);
    if (notifBadge) {
      if (_unreadCount > 0) {
        notifBadge.textContent = _unreadCount > 99 ? '99+' : String(_unreadCount);
        notifBadge.classList.remove('hidden');
      } else {
        notifBadge.textContent = '0';
        notifBadge.classList.add('hidden');
      }
    }
  }

  function _renderNotifications() {
    const notifList = document.getElementById('shell-notif-list');
    if (!notifList) return;
    if (!_notifications || _notifications.length === 0) {
      notifList.innerHTML = '<div class="shell-notif-empty">Không có thông báo mới</div>';
      return;
    }
    notifList.innerHTML = _notifications.map(item => {
      const isUnread = !item.read_at;
      return `
        <div class="shell-notif-item ${isUnread ? 'unread' : ''}" data-id="${item.id}" data-link="${_escapeHtml(item.link || '')}" role="menuitem" tabindex="0">
          <div class="shell-notif-item-title">${_escapeHtml(item.title)}</div>
          ${item.body ? `<div class="shell-notif-item-body">${_escapeHtml(item.body)}</div>` : ''}
          <div class="shell-notif-item-meta">
            <span class="shell-notif-time">${_formatTime(item.created_at)}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  let _fetchRetries = 0;
  async function _fetchNotifications() {
    if (!window.ApiService || !window.ApiService.notifications) {
      if (_fetchRetries < 20) {
        _fetchRetries++;
        setTimeout(_fetchNotifications, 100);
      }
      return;
    }
    _fetchRetries = 0;
    try {
      const res = await window.ApiService.notifications.list(10, 0);
      if (res && (res.success || Array.isArray(res.items) || Array.isArray(res.notifications) || res.unread_count !== undefined)) {
        const notifs = res.items || res.notifications || res.data?.items || res.data?.notifications || [];
        const unread = res.unread_count ?? res.data?.unread_count ?? 0;
        _notifications = notifs;
        _updateBadge(unread);
        _renderNotifications();
      }
    } catch (err) {
      console.warn('[AppShell] Failed to fetch notifications:', err);
    }
  }

  function _initNotifications() {
    const notifWidget = document.getElementById('shell-notif-widget');
    if (!notifWidget) return;

    const notifBtn = document.getElementById('shell-notif-btn');
    const notifDropdown = document.getElementById('shell-notif-dropdown');
    const notifList = document.getElementById('shell-notif-list');
    const markAllBtn = document.getElementById('shell-notif-mark-all');

    if (notifBtn && notifDropdown) {
      notifBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const isHidden = notifDropdown.classList.contains('hidden');
        if (isHidden) {
          notifDropdown.classList.remove('hidden');
          notifBtn.setAttribute('aria-expanded', 'true');
          _fetchNotifications();
        } else {
          notifDropdown.classList.add('hidden');
          notifBtn.setAttribute('aria-expanded', 'false');
        }
      });

      document.addEventListener('click', (e) => {
        if (!notifWidget.contains(e.target)) {
          notifDropdown.classList.add('hidden');
          notifBtn.setAttribute('aria-expanded', 'false');
        }
      });
    }

    if (notifList) {
      notifList.addEventListener('click', async (e) => {
        const itemEl = e.target.closest('.shell-notif-item');
        if (!itemEl) return;
        const id = parseInt(itemEl.getAttribute('data-id'), 10);
        const link = itemEl.getAttribute('data-link');
        const isUnread = itemEl.classList.contains('unread');

        if (isUnread && id && window.ApiService?.notifications?.markRead) {
          try {
            await window.ApiService.notifications.markRead(id);
            itemEl.classList.remove('unread');
            _updateBadge(_unreadCount - 1);
            const itemObj = _notifications.find(n => n.id === id);
            if (itemObj) itemObj.read_at = new Date().toISOString();
          } catch (err) {
            console.error('[AppShell] Mark read error:', err);
          }
        }

        if (link) {
          const base = _getBase();
          let targetUrl = link;
          if (link.startsWith('/') && base && !link.startsWith(base)) {
            targetUrl = base + link;
          }
          window.location.href = targetUrl;
        }
      });
    }

    if (markAllBtn) {
      markAllBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!window.ApiService?.notifications?.markAllRead) return;
        try {
          await window.ApiService.notifications.markAllRead();
          _updateBadge(0);
          _notifications.forEach(n => { n.read_at = new Date().toISOString(); });
          _renderNotifications();
        } catch (err) {
          console.error('[AppShell] Mark all read error:', err);
        }
      });
    }

    // Polling 60 giây một lần
    _fetchNotifications();
    if (_pollTimer) clearInterval(_pollTimer);
    _pollTimer = setInterval(_fetchNotifications, 60000);
  }

  // Tự động khởi chạy khi DOM sẵn sàng
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.AppShell = {
    init,
    getActivePillar,
    syncSongParam,
    updateSongContext: syncSongParam,
    getCurrentSongId: () => _currentSongId,
    refreshNotifications: _fetchNotifications
  };

})(typeof window !== 'undefined' ? window : this);
