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
  let _counts = null;

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
    _byId('btn-church-delete')?.addEventListener('click', _delete);
    _byId('btn-church-copy-accounts')?.addEventListener('click', _copyAccounts);
    _byId('btn-church-cat-create')?.addEventListener('click', _createCategory);
    _byId('church-cat-list')?.addEventListener('click', _onCategoryClick);
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
      _byId('btn-church-delete').hidden = !isSystemAdmin;
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
    if (!_activeId) { box.hidden = true; _byId('church-category-box').hidden = true; return; }
    try {
      const res = await window.ApiService.churches.members(_activeId);
      box.hidden = false;
      _byId('church-name').value = res.church?.name || '';
      _byId('church-invite-code').textContent = res.invite_code || '';
      _counts = res.counts || null;
      _renderMembers(res.members || []);
      _byId('church-category-box').hidden = false;
      await _loadCategories();
    } catch (e) {
      box.hidden = true;
      _byId('church-category-box').hidden = true;
    }
  }

  /** Danh mục riêng của HT đang chọn (API trả mọi danh mục người dùng được thấy, lọc theo church_id). */
  async function _loadCategories() {
    const list = _byId('church-cat-list');
    if (!list) return;
    const all = await window.ApiService.categories.list();
    const mine = (Array.isArray(all) ? all : []).filter((c) => Number(c.church_id) === _activeId);
    list.innerHTML = mine.length
      ? mine.map((c) => `<li data-id="${Number(c.id)}"><span>${_esc(c.name)} · ${Number(c.song_count) || 0} bài</span><span><button type="button" class="mgr-btn mgr-btn-sm mgr-btn-primary" data-act="add-song">➕ Thêm bài (XML)</button> <button type="button" class="mgr-btn mgr-btn-sm mgr-btn-ghost" data-act="del-cat">Xóa</button></span></li>`).join('')
      : '<li class="text-muted">Chưa có danh mục riêng</li>';
  }

  async function _createCategory() {
    const input = _byId('church-cat-name');
    try {
      await window.ApiService.categories.create({ name: input.value, church_id: _activeId });
      input.value = '';
      _toast('Đã thêm danh mục riêng', 'success');
      await _loadCategories();
    } catch (e) {
      _toast(e.message, 'error');
    }
  }

  async function _onCategoryClick(e) {
    const addSong = e.target.closest('button[data-act="add-song"]');
    if (addSong) { window.ManagerUpload?.open?.(Number(addSong.closest('li').dataset.id)); return; }
    const btn = e.target.closest('button[data-act="del-cat"]');
    if (!btn) return;
    if (!window.confirm('Xóa danh mục này? Bài trong đó chuyển về danh mục mặc định.')) return;
    try {
      await window.ApiService.categories.delete(Number(btn.closest('li').dataset.id));
      await _loadCategories();
    } catch (err) {
      _toast(err.message, 'error');
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
    const abbr = _byId('church-new-abbr');
    try {
      const res = await window.ApiService.churches.create(input.value, abbr.value);
      input.value = '';
      abbr.value = '';
      _showAccounts(res.accounts || []);
      _toast('Đã tạo Hội Thánh', 'success');
      await load();
    } catch (e) {
      _toast(e.message, 'error');
    }
  }

  /** Mật khẩu sinh ngẫu nhiên chỉ có trong phản hồi này — hiện ra để người tạo lưu lại. */
  function _showAccounts(accounts) {
    const box = _byId('church-new-accounts');
    if (!box) return;
    box.hidden = accounts.length === 0;
    _byId('church-new-accounts-text').textContent = accounts.map((a) => `${a.username}   ${a.password}   (${a.label})`).join('\n');
  }

  async function _copyAccounts() {
    try {
      await navigator.clipboard.writeText(_byId('church-new-accounts-text').textContent);
      _toast('Đã sao chép', 'success');
    } catch (e) {
      _toast('Không sao chép được, hãy bôi đen và copy', 'error');
    }
  }

  /** Xóa HT: chương trình + quan hệ thành viên mất; tài khoản, bài hát, XML giữ nguyên. Hỏi xác nhận kèm số liệu. */
  async function _delete() {
    const name = _byId('church-name').value;
    const c = _counts || {};
    const msg = `Xóa Hội Thánh "${name}"?\n\nSẽ XÓA ${c.setlists || 0} chương trình và gỡ ${c.members || 0} thành viên.\nTài khoản, bài hát và file nhạc XML được giữ nguyên.\nKhông hoàn tác được.`;
    if (!window.confirm(msg)) return;
    try {
      await window.ApiService.churches.remove(_activeId);
      _toast('Đã xóa Hội Thánh', 'success');
      _activeId = 0;
      await load();
    } catch (e) {
      _toast(e.message, 'error');
    }
  }

  window.ManagerChurches = { init, load };
})();
