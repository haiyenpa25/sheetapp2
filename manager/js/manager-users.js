/**
 * manager/js/manager-users.js — User Management, RBAC & Profile Controller
 * Part of SheetApp Manager Portal
 */
(() => {
  'use strict';

  let _ctx = null;

  function init(ctx) {
    _ctx = ctx;
  }

  function _getApp() {
    return _ctx || window.ManagerApp;
  }

  function _escape(str) {
    return window.SafeHtml ? window.SafeHtml.escape(str) : (str ?? '');
  }

  function _escapeInlineJs(str) {
    return window.SafeHtml ? window.SafeHtml.inlineJsString(str) : String(str ?? '').replace(/'/g, "\\'");
  }

  /* ================= USERS MANAGEMENT (TAB 5) ================= */
  async function loadUsers() {
    const app = _getApp();
    const role = app.state?.currentUser?.role;
    if (role !== 'admin' && role !== 'banhat') return;

    const tbody = document.getElementById('mgr-users-tbody');
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="8" class="mgr-table-loading"><div class="mgr-spinner"></div><p>Đang nạp danh sách thành viên...</p></td></tr>`;
    }

    try {
      const res = await window.ApiService.manager.users();
      if (res.success && res.users) {
        if (app.state) app.state.users = res.users;
        renderUsersTable(res.users);
      }
    } catch (e) {}
  }

  function renderUsersTable(users) {
    const app = _getApp();
    const tbody = document.getElementById('mgr-users-tbody');
    if (!tbody) return;

    const isAdmin = app.state?.currentUser?.role === 'admin';
    const addBtn = document.getElementById('btn-add-user-modal');
    if (addBtn) addBtn.style.display = isAdmin ? '' : 'none';

    let html = '';
    users.forEach(u => {
      const isSelf = u.id === app.state?.currentUser?.user_id;
      const safeUsername = _escape(u.username);
      const safeDisplayName = _escape(u.display_name || u.username);
      const safeInstrument = _escape(u.instrument || '—');
      const safeChordCode = u.chord_code ? _escape(u.chord_code) : '';
      const safeJsUser = JSON.stringify(u).replace(/"/g, '&quot;');
      const voiceMap = { S: 'Soprano', A: 'Alto', T: 'Tenor', B: 'Bass', INSTR: 'Nhạc công' };
      const voiceBadge = u.voice_part && voiceMap[u.voice_part]
        ? `<div style="margin-top:2px;"><span class="mgr-badge" style="background:rgba(147,51,234,0.12); color:#9333ea; font-size:0.68rem; padding:1px 5px; border-radius:4px;" title="Bè ca đoàn: ${voiceMap[u.voice_part]}">🎵 Bè ${u.voice_part}</span></div>`
        : '';

      html += `
        <tr>
          <td>
            <div style="display:flex; align-items:center; gap:0.6rem;">
              <div class="mgr-avatar" style="width:28px; height:28px; font-size:0.75rem;">${_escape(u.username.substring(0, 1).toUpperCase())}</div>
              <div>
                <strong>${safeDisplayName}</strong>
                <div class="text-xs text-muted">@${safeUsername}</div>
                ${voiceBadge}
              </div>
            </div>
          </td>
          <td>
            <span class="mgr-user-role role-${u.role}">
              ${u.role === 'admin' ? '🛡️ Quản Trị' : (u.role === 'leader' ? '👑 Ca Trưởng' : (u.role === 'banhat' ? '🎸 Ban Hát' : '👁️ Viewer'))}
            </span>
            ${u.status === 'locked' ? '<span class="key-badge" style="margin-left:4px; font-size:0.68rem; background:rgba(239,68,68,0.15); color:#ef4444;">🔒 Khóa</span>' : ''}
          </td>
          <td>${safeInstrument}</td>
          <td>
            ${safeChordCode ? `<span class="mgr-chord-badge" title="Mã hợp âm cá nhân">${safeChordCode}</span>` : '<span class="text-muted text-xs">—</span>'}
          </td>
          <td><strong>${u.chord_sets_count || 0}</strong> bộ hợp âm</td>
          <td><strong>${u.versions_count || 0}</strong> bản XML</td>
          <td class="text-muted text-xs">${u.created_at ? _escape(u.created_at.substring(0, 10)) : '—'}</td>
          <td style="text-align:right;">
            <div class="table-actions">
              ${isAdmin ? `
                <button class="mgr-btn mgr-btn-ghost mgr-btn-xs" title="Chỉnh sửa thông tin" onclick="ManagerApp.openEditUserModal(${safeJsUser})">✏️ Sửa</button>
                ${!isSelf ? `
                  <select class="mgr-input mgr-btn-xs" style="width:auto;" onchange="ManagerApp.updateUserRole(${u.id}, this.value)">
                    <option value="banhat" ${u.role === 'banhat' ? 'selected' : ''}>🎸 Ban Hát</option>
                    <option value="leader" ${u.role === 'leader' ? 'selected' : ''}>👑 Ca Trưởng</option>
                    <option value="viewer" ${u.role === 'viewer' ? 'selected' : ''}>👁️ Viewer</option>
                    <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>🛡️ Admin</option>
                  </select>
                  <button class="mgr-btn mgr-btn-ghost mgr-btn-xs" onclick="ManagerApp.resetUserPass(${u.id}, '${_escapeInlineJs(u.username)}')">🔑 Pass</button>
                  <button class="mgr-btn mgr-btn-ghost mgr-btn-xs ${u.status === 'locked' ? 'text-success' : 'text-danger'}" 
                          title="${u.status === 'locked' ? 'Mở khóa tài khoản' : 'Khóa tài khoản'}"
                          onclick="ManagerApp.toggleUserStatus(${u.id}, '${_escapeInlineJs(u.username)}')">
                    ${u.status === 'locked' ? '🔓 Mở' : '🔒 Khóa'}
                  </button>
                  <button class="mgr-btn mgr-btn-ghost mgr-btn-xs text-danger" onclick="ManagerApp.deleteUser(${u.id}, '${_escapeInlineJs(u.username)}')">✕</button>
                ` : '<span class="text-muted text-xs">(Bạn)</span>'}
              ` : '<span class="text-muted text-xs">—</span>'}
            </div>
          </td>
        </tr>
      `;
    });
    tbody.innerHTML = html;
  }

  /* ================= ADMIN USER ACTIONS ================= */
  async function handleCreateUserSubmit(e) {
    e.preventDefault();
    const app = _getApp();
    const username    = document.getElementById('new-user-username')?.value?.trim();
    const displayName = document.getElementById('new-user-display-name')?.value?.trim();
    const password    = document.getElementById('new-user-password')?.value;
    const instrument  = document.getElementById('new-user-instrument')?.value?.trim();
    const role        = document.getElementById('new-user-role')?.value;
    const voicePart   = document.getElementById('new-user-voice-part')?.value || null;
    const chordCode   = (document.getElementById('new-user-chord-code')?.value || '').trim().toUpperCase();

    try {
      const res = await window.ApiService.manager.manageUser({
        sub_action: 'create',
        username,
        password,
        display_name: displayName,
        instrument,
        role,
        voice_part: voicePart,
        chord_code: chordCode
      });
      if (res.success) {
        app.showToast(res.message || 'Đã tạo tài khoản!', 'success');
        app.closeModal?.('modal-user');
        app.loadStats?.();
        loadUsers();
      } else {
        app.showToast(res.message || 'Lỗi', 'error');
      }
    } catch (e) {
      app.showToast('Lỗi mạng', 'error');
    }
  }

  function openEditUserModal(u) {
    if (!u) return;
    const app = _getApp();
    document.getElementById('edit-user-id').value = u.id;
    document.getElementById('edit-user-username').value = u.username;
    document.getElementById('edit-user-display-name').value = u.display_name || u.username;
    document.getElementById('edit-user-instrument').value = u.instrument || 'Guitar';
    document.getElementById('edit-user-chord-code').value = u.chord_code || '';
    document.getElementById('edit-user-role').value = u.role || 'banhat';
    const editVoiceEl = document.getElementById('edit-user-voice-part');
    if (editVoiceEl) editVoiceEl.value = u.voice_part || '';
    document.getElementById('edit-user-password').value = '';
    app.openModal?.('modal-edit-user');
  }

  async function handleEditUserSubmit(e) {
    e.preventDefault();
    const app = _getApp();
    const userId      = parseInt(document.getElementById('edit-user-id')?.value);
    const displayName = document.getElementById('edit-user-display-name')?.value?.trim();
    const instrument  = document.getElementById('edit-user-instrument')?.value?.trim();
    const chordCode   = document.getElementById('edit-user-chord-code')?.value?.trim().toUpperCase();
    const role        = document.getElementById('edit-user-role')?.value;
    const voicePart   = document.getElementById('edit-user-voice-part')?.value || null;
    const password    = document.getElementById('edit-user-password')?.value;

    if (!userId || !displayName) {
      app.showToast('Vui lòng điền tên hiển thị', 'error');
      return;
    }

    try {
      const payload = {
        sub_action: 'update_profile',
        user_id: userId,
        display_name: displayName,
        instrument,
        chord_code: chordCode,
        role,
        voice_part: voicePart
      };
      if (password) payload.password = password;

      const res = await window.ApiService.manager.manageUser(payload);
      if (res.success) {
        app.showToast(res.message || 'Đã cập nhật thông tin thành công!', 'success');
        app.closeModal?.('modal-edit-user');
        loadUsers();
      } else {
        app.showToast(res.message || 'Lỗi', 'error');
      }
    } catch (e) {
      app.showToast('Lỗi mạng', 'error');
    }
  }

  async function updateUserRole(userId, role) {
    const app = _getApp();
    try {
      const res = await window.ApiService.manager.manageUser({ sub_action: 'update_role', user_id: userId, role });
      if (res.success) app.showToast('Đã cập nhật vai trò', 'success');
      else app.showToast(res.message || 'Lỗi', 'error');
    } catch (e) {
      app.showToast('Lỗi mạng', 'error');
    }
  }

  function resetUserPass(userId, username) {
    const app = _getApp();
    const idInput = document.getElementById('reset-pass-user-id');
    const nameLabel = document.getElementById('reset-pass-target-username');
    const passInput = document.getElementById('reset-pass-new-password');
    if (idInput) idInput.value = userId;
    if (nameLabel) nameLabel.textContent = '@' + username;
    if (passInput) passInput.value = '';
    app.openModal?.('modal-reset-pass');
  }

  async function handleResetPassSubmit(e) {
    e.preventDefault();
    const app = _getApp();
    const userId = document.getElementById('reset-pass-user-id')?.value;
    const newPass = document.getElementById('reset-pass-new-password')?.value;
    if (!userId || !newPass) return;

    try {
      const res = await window.ApiService.manager.manageUser({ sub_action: 'reset_password', user_id: userId, new_password: newPass });
      if (res.success) {
        app.showToast(res.message || 'Đã đổi mật khẩu thành công!', 'success');
        app.closeModal?.('modal-reset-pass');
      } else {
        app.showToast(res.message || 'Lỗi đổi mật khẩu', 'error');
      }
    } catch (e) {
      app.showToast('Lỗi mạng', 'error');
    }
  }

  async function toggleUserStatus(userId, username) {
    const app = _getApp();
    try {
      const res = await window.ApiService.manager.manageUser({ sub_action: 'toggle_status', user_id: userId });
      if (res.success) {
        app.showToast(res.message, 'success');
        loadUsers();
      } else {
        app.showToast(res.message || 'Lỗi cập nhật trạng thái', 'error');
      }
    } catch (e) {
      app.showToast('Lỗi mạng', 'error');
    }
  }

  async function deleteUser(userId, username) {
    const app = _getApp();
    if (!confirm(`Bạn có chắc muốn xóa tài khoản @${username}? Mọi bài phối của người này vẫn sẽ được giữ lại.`)) return;

    try {
      const res = await window.ApiService.manager.manageUser({ sub_action: 'delete', user_id: userId });
      if (res.success) {
        app.showToast('Đã xóa tài khoản', 'success');
        app.loadStats?.();
        loadUsers();
      } else {
        app.showToast(res.message || 'Lỗi', 'error');
      }
    } catch (e) {
      app.showToast('Lỗi mạng', 'error');
    }
  }

  /* ================= USER AUTH & PROFILE ================= */
  async function checkCurrentUser() {
    const app = _getApp();
    try {
      const res = await window.ApiService.auth.me();
      if (res && res.success && res.loggedIn && app.state) {
        app.state.currentUser = {
          logged_in: true,
          user_id: res.user_id,
          username: res.username,
          role: res.role,
          display_name: res.display_name,
          instrument: res.instrument || 'Guitar'
        };
        _updateAuthUI();
      } else if (app.state) {
        app.state.currentUser = { logged_in: false, user_id: null, username: '', role: 'viewer', display_name: '', instrument: 'Guitar' };
        _updateAuthUI();
      }
    } catch (e) {}
  }

  function _updateAuthUI() {
    const app = _getApp();
    const u = app.state?.currentUser;
    if (!u) return;

    const authGuestBox = document.getElementById('mgr-auth-guest');
    const authUserBox  = document.getElementById('mgr-auth-user');
    const tabUsers     = document.getElementById('tab-btn-users');
    const roleBadge    = document.getElementById('mgr-user-role-badge');
    const nameEl       = document.getElementById('mgr-display-name');
    const unameEl      = document.getElementById('mgr-username-display');
    const avatarEl     = document.getElementById('mgr-user-avatar');

    if (u.logged_in) {
      authGuestBox?.classList.add('hidden');
      authUserBox?.classList.remove('hidden');

      if (nameEl) nameEl.textContent = u.display_name || u.username;
      if (unameEl) unameEl.textContent = `@${u.username}`;
      if (avatarEl) avatarEl.textContent = (u.username || 'U').substring(0, 1).toUpperCase();

      if (roleBadge) {
        roleBadge.className = `mgr-user-role role-${u.role}`;
        roleBadge.textContent = u.role === 'admin' ? 'Quản Trị' : (u.role === 'banhat' ? 'Ban Hát' : 'Viewer');
      }

      if (tabUsers) {
        tabUsers.style.display = (u.role === 'admin' || u.role === 'banhat') ? '' : 'none';
      }
    } else {
      authGuestBox?.classList.remove('hidden');
      authUserBox?.classList.add('hidden');
      if (tabUsers) tabUsers.style.display = 'none';
    }
  }

  async function handleRegisterSubmit(e) {
    e.preventDefault();
    const app = _getApp();
    const username    = document.getElementById('reg-username')?.value?.trim();
    const displayName = document.getElementById('reg-display-name')?.value?.trim();
    const password    = document.getElementById('reg-password')?.value;
    const instrument  = document.getElementById('reg-instrument')?.value;

    const btn = document.getElementById('btn-submit-register');
    if (btn) { btn.disabled = true; btn.textContent = 'Đang tạo tài khoản...'; }

    try {
      const res = await window.ApiService.auth.register({ username, password, display_name: displayName, instrument });

      if (res.success) {
        app.showToast(res.message || 'Đăng ký thành công!', 'success');
        app.closeModal?.('modal-register');
        setTimeout(() => window.location.reload(), 600);
      } else {
        app.showToast(res.message || 'Lỗi đăng ký tài khoản', 'error');
      }
    } catch (e) {
      app.showToast('Lỗi mạng: ' + e.message, 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '🚀 Đăng Ký Tài Khoản'; }
    }
  }

  async function handleLoginSubmit(e) {
    e.preventDefault();
    const app = _getApp();
    const username = document.getElementById('login-username')?.value?.trim();
    const password = document.getElementById('login-password')?.value;

    try {
      const res = await window.ApiService.auth.login({ username, password });
      if (res.success) {
        app.showToast(`Xin chào @${username}!`, 'success');
        app.closeModal?.('modal-login');
        setTimeout(() => window.location.reload(), 500);
      } else {
        app.showToast(res.message || 'Sai tài khoản hoặc mật khẩu', 'error');
      }
    } catch (e) {
      app.showToast('Lỗi mạng', 'error');
    }
  }

  async function handleLogout() {
    const app = _getApp();
    try {
      await window.ApiService.auth.logout();
      app.showToast('Đã đăng xuất', 'info');
      setTimeout(() => window.location.reload(), 400);
    } catch (e) {
      window.location.reload();
    }
  }

  async function openProfileModal() {
    const app = _getApp();
    if (!app.state?.currentUser?.logged_in) return;

    document.getElementById('profile-username').value     = app.state.currentUser.username;
    document.getElementById('profile-display-name').value = app.state.currentUser.display_name;
    document.getElementById('profile-instrument').value   = app.state.currentUser.instrument;
    document.getElementById('profile-current-pass').value = '';
    document.getElementById('profile-new-pass').value     = '';

    app.openModal?.('modal-profile');
    document.querySelectorAll('.profile-tab-btn').forEach((b, i) => b.classList.toggle('active', i === 0));
    document.querySelectorAll('.profile-tab-content').forEach((c, i) => c.classList.toggle('active', i === 0));
    await loadMyContributions();
  }

  async function loadMyContributions() {
    const app = _getApp();
    const listEl = document.getElementById('my-contributions-list');
    if (listEl) listEl.innerHTML = '<div class="mgr-spinner"></div>';

    try {
      const res = await window.ApiService.manager.myContributions();

      if (res.success) {
        if (app.state) app.state.myContributions = res;
        const totalCount = (res.chord_sets?.length || 0) + (res.versions?.length || 0);
        const countEl = document.getElementById('my-chords-count');
        if (countEl) countEl.textContent = totalCount;

        if (!res.chord_sets || res.chord_sets.length === 0) {
          listEl.innerHTML = '<p class="text-muted text-sm">Bạn chưa tạo bản phối nào. Hãy bấm "✨ Tạo Bản Phối Mới" để bắt đầu!</p>';
          return;
        }

        let html = '';
        res.chord_sets.forEach(cs => {
          const safeDiskName = cs.username + '__' + cs.set_name.replace(/[^a-zA-Z0-9_\-]/g, '_');
          html += `
            <div class="my-item-row">
              <div>
                <strong>${_escape(cs.set_name)}</strong>
                <div class="text-xs text-muted">#${cs.httlvnId || ''} ${_escape(cs.song_title)} • ${cs.instrument_type} • Capo ${cs.capo_fret}</div>
              </div>
              <div style="display:flex; gap:0.5rem; align-items:center;">
                <a href="../index.php?song=${encodeURIComponent(cs.song_id)}&set=${encodeURIComponent(safeDiskName)}" class="mgr-btn mgr-btn-primary mgr-btn-xs" target="_blank">
                  👁️ Xem
                </a>
                <button class="mgr-btn mgr-btn-ghost mgr-btn-xs text-danger" onclick="ManagerApp.deleteUserChordSet(${cs.id}, '${_escapeInlineJs(cs.set_name)}')">
                  🗑️
                </button>
              </div>
            </div>
          `;
        });
        listEl.innerHTML = html;
      }
    } catch (e) {}
  }

  async function handleUpdateProfileSubmit(e) {
    e.preventDefault();
    const app = _getApp();
    const displayName = document.getElementById('profile-display-name')?.value?.trim();
    const instrument  = document.getElementById('profile-instrument')?.value?.trim();
    const currentPass = document.getElementById('profile-current-pass')?.value;
    const newPass     = document.getElementById('profile-new-pass')?.value;

    try {
      const res = await window.ApiService.auth.updateProfile({
        display_name: displayName,
        instrument,
        current_password: currentPass,
        new_password: newPass
      });
      if (res.success) {
        app.showToast('Đã cập nhật hồ sơ cá nhân!', 'success');
        if (app.state?.currentUser) {
          app.state.currentUser.display_name = displayName;
          app.state.currentUser.instrument = instrument;
        }
        app.closeModal?.('modal-profile');
        _updateAuthUI();
      } else {
        app.showToast(res.message || 'Lỗi cập nhật hồ sơ', 'error');
      }
    } catch (e) {
      app.showToast('Lỗi mạng', 'error');
    }
  }

  window.ManagerUsers = {
    init,
    loadUsers,
    renderUsersTable,
    handleCreateUserSubmit,
    openEditUserModal,
    handleEditUserSubmit,
    updateUserRole,
    resetUserPass,
    handleResetPassSubmit,
    toggleUserStatus,
    deleteUser,
    checkCurrentUser,
    handleRegisterSubmit,
    handleLoginSubmit,
    handleLogout,
    openProfileModal,
    loadMyContributions,
    handleUpdateProfileSubmit
  };
})();
