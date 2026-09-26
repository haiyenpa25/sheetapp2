/**
 * manager/js/manager-notifications.js
 *
 * Quản lý Tùy chọn Thông báo Đa Kênh & Giờ Yên Lặng trong Hồ sơ (Epic 4.4)
 */
(() => {
  'use strict';

  let _ctx = null;
  let _currentPrefs = null;

  function init(ctx) {
    _ctx = ctx;
    _bindEvents();
  }

  function _getApp() {
    return _ctx || window.ManagerApp;
  }

  function _escape(str) {
    return window.SafeHtml ? window.SafeHtml.escape(str) : (str ?? '');
  }

  function _bindEvents() {
    document.getElementById('btn-ptab-notifs')?.addEventListener('click', () => loadPreferences());
    document.getElementById('form-update-notif-prefs')?.addEventListener('submit', handleSavePreferences);
  }

  /**
   * Tải tùy chọn thông báo từ API
   */
  async function loadPreferences() {
    const tbody = document.getElementById('tbody-notif-matrix');
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="4" class="mgr-table-loading"><div class="mgr-spinner"></div>Đang tải cài đặt thông báo...</td></tr>';
    }

    try {
      const res = await window.ApiService.notificationPreferences.get();
      const data = res?.data || res || {};
      _currentPrefs = data;

      // Điền email và quiet hours
      const emailInput = document.getElementById('notif-email');
      const startInput = document.getElementById('notif-quiet-start');
      const endInput   = document.getElementById('notif-quiet-end');

      if (emailInput) emailInput.value = data.email || '';
      if (startInput) startInput.value = data.quiet_hours_start || '';
      if (endInput)   endInput.value   = data.quiet_hours_end || '';

      _renderMatrix(data.matrix || {});
    } catch (e) {
      console.error('[ManagerNotifications] Error loading preferences:', e);
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="4" style="color:var(--danger);text-align:center;padding:1rem;">Lỗi tải cài đặt: ${_escape(e.message)}</td></tr>`;
      }
    }
  }

  /**
   * Render bảng ma trận tùy chọn
   */
  function _renderMatrix(matrix) {
    const tbody = document.getElementById('tbody-notif-matrix');
    if (!tbody) return;

    const rows = Object.entries(matrix).map(([type, item]) => {
      const inappChecked = item.channels?.inapp ? 'checked' : '';
      const emailChecked = item.channels?.email ? 'checked' : '';
      const pushChecked  = item.channels?.push ? 'checked' : '';

      return `
        <tr>
          <td>
            <strong>${_escape(item.label)}</strong>
            <div style="font-size:0.72rem;color:var(--text-muted);">${_escape(type)}</div>
          </td>
          <td style="text-align:center;">
            <input type="checkbox" class="notif-pref-chk" data-event="${_escape(type)}" data-channel="inapp" ${inappChecked}>
          </td>
          <td style="text-align:center;">
            <input type="checkbox" class="notif-pref-chk" data-event="${_escape(type)}" data-channel="email" ${emailChecked}>
          </td>
          <td style="text-align:center;">
            <input type="checkbox" class="notif-pref-chk" data-event="${_escape(type)}" data-channel="push" ${pushChecked}>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = rows.join('') || '<tr><td colspan="4" style="text-align:center;padding:1rem;">Không có sự kiện</td></tr>';
  }

  /**
   * Lưu cài đặt thông báo
   */
  async function handleSavePreferences(e) {
    e.preventDefault();
    const app = _getApp();

    const email = document.getElementById('notif-email')?.value?.trim();
    const quietStart = document.getElementById('notif-quiet-start')?.value?.trim();
    const quietEnd   = document.getElementById('notif-quiet-end')?.value?.trim();

    // Thu thập ma trận preferences
    const preferences = [];
    document.querySelectorAll('.notif-pref-chk').forEach(chk => {
      preferences.push({
        event_type: chk.dataset.event,
        channel:    chk.dataset.channel,
        enabled:    chk.checked ? 1 : 0
      });
    });

    try {
      const res = await window.ApiService.notificationPreferences.save({
        email: email || null,
        quiet_hours_start: quietStart || null,
        quiet_hours_end:   quietEnd || null,
        preferences
      });

      app.showToast('✅ Đã lưu cài đặt thông báo thành công!', 'success');
      loadPreferences();
    } catch (e) {
      console.error('[ManagerNotifications] Save error:', e);
      app.showToast('Lỗi lưu cài đặt: ' + e.message, 'error');
    }
  }

  window.ManagerNotifications = {
    init,
    loadPreferences
  };
})();
