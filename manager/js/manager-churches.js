/**
 * manager/js/manager-churches.js — Tab "Hội Thánh & Thành viên" (cờ MULTI_CHURCH).
 * Chọn HT đang làm việc, vào HT bằng mã mời, quản trị HT: duyệt/đổi vai trò/khóa thành viên, đổi tên, đổi mã mời.
 * Phụ thuộc: ApiService, SafeHtml. Public API: { init, load }
 */
(() => {
  'use strict';

  const ROLE_LABELS = { church_admin: 'Quản trị HT', leader: 'Ca trưởng', member: 'Thành viên', viewer: 'Chỉ xem' };
  const STATUS_LABELS = { active: 'Hoạt động', pending: 'Chờ duyệt', disabled: 'Đã khóa' };

  let _ctx = null;
  let _activeId = 0;

  const _esc = (s) => (window.SafeHtml ? window.SafeHtml.escape(s) : String(s ?? ''));
  const _byId = (id) => document.getElementById(id);
  const _toast = (msg, type) => _ctx?.showToast?.(msg, type);

  function init(ctx) {
    _ctx = ctx;
    _byId('church-select')?.addEventListener('change', (e) => _switch(Number(e.target.value)));
    _byId('btn-church-join')?.addEventListener('click', _join);
    _byId('btn-church-rename')?.addEventListener('click', _rename);
    _byId('btn-church-regen')?.addEventListener('click', _regenerate);
    _byId('btn-church-create')?.addEventListener('click', _create);
    _byId('church-members-tbody')?.addEventListener('change', _onMemberChange);
    _byId('church-members-tbody')?.addEventListener('click', _onMemberClick);
  }

  async function load() {
    if (!window.FeatureFlags?.get?.('MULTI_CHURCH')) return;
    try {
      const res = await window.ApiService.churches.mine();
      const isSystemAdmin = Array.isArray(res.all_churches);
      _activeId = Number(res.active_church_id) || 0;
      _renderSelect(isSystemAdmin ? res.all_churches : (res.churches || []));
      _renderPending(res.pending || []);
      _byId('church-create-box').hidden = !isSystemAdmin;
      await _loadMembers();
    } catch (e) {
      _toast('Không tải được Hội Thánh: ' + e.message, 'error');
    }
  }

  function _renderSelect(list) {
    const sel = _byId('church-select');
    if (!sel) return;
    sel.innerHTML = list.map((c) => `<option value="${Number(c.id)}"${Number(c.id) === _activeId ? ' selected' : ''}>${_esc(c.name)}</option>`).join('');
    sel.disabled = list.length < 2;
  }

  function _renderPending(pending) {
    const el = _byId('church-pending');
    if (!el) return;
    el.hidden = pending.length === 0;
    el.textContent = pending.length ? 'Đang chờ duyệt: ' + pending.map((p) => p.name).join(', ') : '';
  }

  /** Chỉ quản trị HT (hoặc admin hệ thống) xem được; máy chủ trả 403 thì ẩn khối quản trị. */
  async function _loadMembers() {
    const box = _byId('church-admin-box');
    if (!box) return;
    if (!_activeId) { box.hidden = true; return; }
    try {
      const res = await window.ApiService.churches.members(_activeId);
      box.hidden = false;
      _byId('church-name').value = res.church?.name || '';
      _byId('church-invite-code').textContent = res.invite_code || '';
      _renderMembers(res.members || []);
    } catch (e) {
      box.hidden = true;
    }
  }

  function _renderMembers(members) {
    const tbody = _byId('church-members-tbody');
    if (!tbody) return;
    tbody.innerHTML = members.map((m) => {
      const roleOpts = Object.keys(ROLE_LABELS).map((r) => `<option value="${r}"${r === m.role ? ' selected' : ''}>${ROLE_LABELS[r]}</option>`).join('');
      const name = _esc(m.display_name || m.username);
      const act = m.status === 'pending' ? ['approve', 'Duyệt', 'primary'] : (m.status === 'active' ? ['disable', 'Khóa', 'ghost'] : ['enable', 'Mở khóa', 'ghost']);
      return `<tr data-user="${Number(m.user_id)}">
        <td>${name}</td>
        <td><select class="mgr-input" data-act="role" aria-label="Vai trò ${name}">${roleOpts}</select></td>
        <td>${STATUS_LABELS[m.status] || _esc(m.status)}</td>
        <td style="text-align:right;"><button type="button" class="mgr-btn mgr-btn-sm mgr-btn-${act[2]}" data-act="${act[0]}">${act[1]}</button></td></tr>`;
    }).join('');
  }

  async function _switch(churchId) {
    try {
      await window.ApiService.churches.switchTo(churchId);
      _activeId = churchId;
      await _loadMembers();
      _toast('Đã chuyển Hội Thánh', 'success');
      window.EventBus?.emit?.('church:changed', { churchId });
    } catch (e) {
      _toast(e.message, 'error');
    }
  }

  async function _join() {
    const input = _byId('church-join-code');
    try {
      const res = await window.ApiService.churches.join(input.value);
      input.value = '';
      _toast(res.membership?.status === 'active' ? 'Bạn đã thuộc Hội Thánh này' : 'Đã gửi yêu cầu, chờ quản trị Hội Thánh duyệt', 'success');
      await load();
    } catch (e) {
      _toast(e.message, 'error');
    }
  }

  async function _updateMember(userId, patch) {
    try {
      const res = await window.ApiService.churches.updateMember({ church_id: _activeId, user_id: userId, ...patch });
      _renderMembers(res.members || []);
    } catch (e) {
      _toast(e.message, 'error');
      await _loadMembers();
    }
  }

  function _onMemberChange(e) {
    const sel = e.target.closest('select[data-act="role"]');
    if (sel) _updateMember(Number(sel.closest('tr').dataset.user), { role: sel.value });
  }

  function _onMemberClick(e) {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    _updateMember(Number(btn.closest('tr').dataset.user), { status: btn.dataset.act === 'disable' ? 'disabled' : 'active' });
  }

  async function _rename() {
    try {
      await window.ApiService.churches.rename(_activeId, _byId('church-name').value);
      _toast('Đã đổi tên', 'success');
      await load();
    } catch (e) {
      _toast(e.message, 'error');
    }
  }

  async function _regenerate() {
    if (!window.confirm('Đổi mã mới? Mã cũ sẽ không dùng được nữa.')) return;
    try {
      const res = await window.ApiService.churches.regenerateCode(_activeId);
      _byId('church-invite-code').textContent = res.invite_code || '';
    } catch (e) {
      _toast(e.message, 'error');
    }
  }

  async function _create() {
    const input = _byId('church-new-name');
    try {
      await window.ApiService.churches.create(input.value);
      input.value = '';
      _toast('Đã tạo Hội Thánh', 'success');
      await load();
    } catch (e) {
      _toast(e.message, 'error');
    }
  }

  window.ManagerChurches = { init, load };
})();
