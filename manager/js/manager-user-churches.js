/**
 * manager/js/manager-user-churches.js — hộp "Hội Thánh của <tài khoản>" ở tab Thành viên (cờ MULTI_CHURCH).
 * Admin hệ thống thêm / đổi vai trò / gỡ một tài khoản khỏi các Hội Thánh (một người có thể thuộc nhiều HT).
 * Phụ thuộc: ApiService, SafeHtml, ManagerUsers.loadUsers. Public API: { init, open }
 */
(() => {
  'use strict';

  const ROLE_LABELS = { church_admin: 'Quản trị HT', leader: 'Ca trưởng', member: 'Thành viên', viewer: 'Chỉ xem' };

  let _ctx = null;
  let _user = null;
  let _churches = [];

  const _byId = (id) => document.getElementById(id);
  const _esc = (s) => (window.SafeHtml ? window.SafeHtml.escape(s) : String(s ?? ''));
  const _toast = (msg, type) => _ctx?.showToast?.(msg, type);

  function init(ctx) {
    _ctx = ctx;
    _byId('btn-uc-add')?.addEventListener('click', _add);
    _byId('uc-list')?.addEventListener('click', _onListClick);
  }

  async function open(userId) {
    _user = (_ctx?.state?.users || []).find((u) => Number(u.id) === Number(userId));
    if (!_user) return;
    try {
      const res = await window.ApiService.churches.mine();
      _churches = res.all_churches || res.churches || [];
    } catch (e) {
      _toast('Không tải được danh sách Hội Thánh: ' + e.message, 'error');
      return;
    }
    _render();
    _ctx.openModal('modal-user-churches');
  }

  function _render() {
    _byId('uc-username').textContent = '@' + _user.username;
    const mine = _user.churches || [];
    _byId('uc-list').innerHTML = mine.length
      ? mine.map((c) => `<li data-church="${Number(c.church_id)}"><span>${_esc(c.name)} · ${_esc(ROLE_LABELS[c.role] || c.role)}${c.status !== 'active' ? ' (chờ duyệt)' : ''}</span><button type="button" class="mgr-btn mgr-btn-sm mgr-btn-ghost" data-act="remove">Gỡ</button></li>`).join('')
      : '<li class="text-muted">Chưa thuộc Hội Thánh nào — tài khoản này chưa thấy chương trình nào.</li>';
    _byId('uc-church-select').innerHTML = _churches.map((c) => `<option value="${Number(c.id)}">${_esc(c.name)}</option>`).join('');
  }

  async function _refresh() {
    await window.ManagerUsers?.loadUsers?.();
    _user = (_ctx.state.users || []).find((u) => Number(u.id) === Number(_user.id)) || _user;
    _render();
  }

  async function _add() {
    try {
      await window.ApiService.churches.addMember(Number(_byId('uc-church-select').value), Number(_user.id), _byId('uc-role-select').value);
      _toast('Đã cập nhật Hội Thánh', 'success');
      await _refresh();
    } catch (e) {
      _toast(e.message, 'error');
    }
  }

  async function _onListClick(e) {
    const btn = e.target.closest('button[data-act="remove"]');
    if (!btn) return;
    try {
      await window.ApiService.churches.removeMember(Number(btn.closest('li').dataset.church), Number(_user.id));
      _toast('Đã gỡ khỏi Hội Thánh', 'success');
      await _refresh();
    } catch (err) {
      _toast(err.message, 'error');
    }
  }

  window.ManagerUserChurches = { init, open };
})();
