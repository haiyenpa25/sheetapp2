/**
 * auth.js
 * Quản lý xác thực (Authentication), Login/Logout và Phân Quyền (Roles)
 */
const Auth = (() => {
  'use strict';

  let _currentUser = null;
  let _role = 'viewer'; // viewer | banhat | admin
  let _chordCode = null;

  async function checkSession() {
    try {
      const data = await window.ApiService.auth.me();
      if (data.loggedIn) {
        _currentUser = data.username;
        _role = data.role;
        _chordCode = data.chord_code || null;
      } else {
        _currentUser = null;
        _role = 'viewer';
        _chordCode = null;
      }
      _updateUI();
      return _role;
    } catch (err) {
      console.error("Auth:", err);
      _role = 'viewer';
      _chordCode = null;
      return _role;
    }
  }

  async function doLogin(username, password) {
    try {
      const data = await window.ApiService.auth.login({ username, password });
      if (data.success) {
        _currentUser = data.username;
        _role = data.role;
        _chordCode = data.chord_code || null;
        sessionStorage.removeItem('sheetapp_guest_chosen');
        _updateUI();
        closeModal();
        const codeText = _chordCode ? `bộ [${_chordCode}]` : 'hợp âm';
        window.App?.showToast?.(`Xin chào @${_currentUser}! Đã kích hoạt quyền sửa ${codeText}`, 'success');
        // Tải lại nhạc nếu cần để bật quyền
        if (window.App && window.App.reloadCurrentXML) window.App.reloadCurrentXML();
        return true;
      } else {
        showError(data.error || 'Đăng nhập thất bại');
        return false;
      }
    } catch (err) {
      showError('Lỗi mạng');
      return false;
    }
  }

  async function doLogout() {
    await window.ApiService.auth.logout();
    _currentUser = null;
    _role = 'viewer';
    _chordCode = null;
    sessionStorage.removeItem('sheetapp_guest_chosen');
    _updateUI();
    closeModal();
    window.App?.showToast?.('Đã đăng xuất. Bạn đang ở quyền Khách (Chỉ xem)', 'info');
    // Tải lại nhạc để tắt quyền
    if (window.App && window.App.reloadCurrentXML) window.App.reloadCurrentXML();
  }

  function _updateUI() {
    // ── Sidebar auth button ──
    const btnText = document.getElementById('auth-username');
    if (btnText) btnText.textContent = _currentUser ?? 'Khách';

    // Role badge (hiện kế tên user)
    const roleBadge = document.getElementById('auth-role-badge');
    if (roleBadge) {
      const badgeInfo = {
        admin:  { text: 'Quản Trị', cls: 'role-badge-admin' },
        banhat: { text: 'Ban Hát',   cls: 'role-badge-banhat' },
        viewer: { text: '',            cls: '' }
      }[_role] ?? { text: '', cls: '' };

      if (_currentUser && badgeInfo.text) {
        roleBadge.textContent = badgeInfo.text;
        roleBadge.className = 'sidebar-role-badge ' + badgeInfo.cls;
      } else {
        roleBadge.className = 'sidebar-role-badge hidden';
      }
    }

    // ── Toolbar auth button & pill ──
    const toolbarAuthBtn = document.getElementById('btn-toolbar-auth');
    const toolbarName    = document.getElementById('toolbar-auth-name');
    const toolbarBadge   = document.getElementById('toolbar-auth-badge');

    if (toolbarAuthBtn) {
      toolbarAuthBtn.classList.toggle('logged-in', !!_currentUser);
      toolbarAuthBtn.title = _currentUser 
        ? `Đang đăng nhập @${_currentUser} (${_role}) • Bấm để quản lý` 
        : 'Đang xem dưới quyền Khách • Bấm để Đăng nhập';
    }
    if (toolbarName) {
      toolbarName.textContent = _currentUser ? `@${_currentUser}` : 'Khách';
    }
    if (toolbarBadge) {
      if (_currentUser) {
        const roleLabel = _role === 'admin' ? 'Admin' : (_role === 'banhat' ? (_chordCode || 'HÂ') : 'Khách');
        toolbarBadge.textContent = roleLabel;
        toolbarBadge.className = 'user-pill-role ' + (_role === 'admin' ? 'role-admin' : 'role-banhat');
        toolbarBadge.classList.remove('hidden');
      } else {
        toolbarBadge.className = 'user-pill-role hidden';
      }
    }

    // ── Modal auth panel ──
    const formPanel     = document.getElementById('auth-login-form');
    const loggedInPanel = document.getElementById('auth-logged-in');

    if (_currentUser) {
      formPanel?.classList.add('hidden');
      loggedInPanel?.classList.remove('hidden');

      const userTitle = document.getElementById('auth-logged-user-title');
      if (userTitle) userTitle.textContent = `@${_currentUser}`;

      const avatarEl = document.getElementById('auth-avatar-letter');
      if (avatarEl) avatarEl.textContent = _currentUser.charAt(0).toUpperCase();

      const chordCodeEl = document.getElementById('auth-chord-code-display');
      if (chordCodeEl) chordCodeEl.textContent = _chordCode ? `[${_chordCode}]` : 'Chưa gán';

      const rolePill = document.getElementById('auth-role-display-pill');
      if (rolePill) {
        if (_role === 'admin') {
          rolePill.textContent = 'Quản Trị Viên';
          rolePill.style.background = 'rgba(239, 68, 68, 0.2)';
          rolePill.style.color = '#fca5a5';
          rolePill.style.border = '1px solid rgba(239, 68, 68, 0.4)';
        } else if (_role === 'banhat') {
          rolePill.textContent = 'Nhạc Công Ban Hát';
          rolePill.style.background = 'rgba(124, 58, 237, 0.2)';
          rolePill.style.color = '#c4b5fd';
          rolePill.style.border = '1px solid rgba(124, 58, 237, 0.4)';
        } else {
          rolePill.textContent = 'Khách Xem';
          rolePill.style.background = 'rgba(100, 116, 139, 0.2)';
          rolePill.style.color = '#cbd5e1';
          rolePill.style.border = '1px solid rgba(100, 116, 139, 0.4)';
        }
      }

      // Cập nhật tóm tắt quyền trong modal
      const permSummary = document.getElementById('auth-perm-summary');
      if (permSummary) {
        if (_role === 'admin') {
          permSummary.innerHTML = '✅ Xem sheet &amp; hợp âm<br>✅ Toàn quyền sửa bộ <strong>ADMIN</strong><br>✅ Ghi chú &amp; Quản trị hệ thống';
        } else if (_role === 'banhat') {
          permSummary.innerHTML = `✅ Xem sheet &amp; hợp âm<br>✅ Độc quyền sửa bộ <strong>${_chordCode || 'Cá nhân'}</strong><br>❌ Không sửa đè bộ người khác`;
        } else {
          permSummary.innerHTML = '✅ Xem 903 sheet nhạc &amp; hợp âm<br>❌ Không có quyền sửa';
        }
      }
    } else {
      formPanel?.classList.remove('hidden');
      loggedInPanel?.classList.add('hidden');
    }

    // Phân quyền:
    //  viewer  — chỉ được xem
    //  banhat  — thêm/sửa hợp âm
    //  admin   — toàn quyền
    const canEdit       = isAdmin();       // admin only
    const canEditChords = _canEditChords(); // banhat + admin
    const loggedIn      = isLoggedIn();

    // Thêm hợp âm — CHỈ hiển thị khi đã đăng nhập có quyền banhat/admin
    document.getElementById('btn-add-chord-mode')?.classList.toggle('hidden', !canEditChords);
    document.getElementById('btn-add-chord-mode-bar')?.classList.toggle('hidden', !canEditChords);
    document.getElementById('btn-menu-chord-edit')?.classList.toggle('hidden', !canEditChords);
    
    // Nổi bật hợp âm — TẤT CẢ người dùng đều được dùng (chỉ xem, không sửa)
    document.getElementById('btn-chord-highlight')?.classList.remove('hidden');
    
    // Tạo bộ hợp âm mới — CHỈ hiển thị khi đã đăng nhập
    document.getElementById('btn-new-chord-set')?.classList.toggle('hidden', !canEditChords);
    
    // Ghi chú — Admin only
    document.getElementById('btn-add-annotate-mode')?.classList.toggle('hidden', !canEdit);

    // FAB items
    document.getElementById('fab-chord')?.classList.toggle('hidden', !canEditChords);
    document.getElementById('fab-annotate')?.classList.toggle('hidden', !canEdit);
    // FAB highlight — tất CẢ đều thấy
    document.getElementById('fab-highlight')?.classList.remove('hidden');

    // Nút thùng rác chord set — chỉ hiện khi có quyền
    const delBtn = document.getElementById('btn-delete-chord-set');
    if (delBtn && !canEditChords) delBtn.style.display = 'none';

    // Cập nhật lại dropdown bản phối để ẩn/hiện tùy chọn tạo mới
    window.ChordCanvas?.refreshSetDropdown?.();

    // Tắt mode khi mất quyền
    if (!canEditChords) {
      window.ChordCanvas?.setAddMode(false);
    }
    if (!canEdit) {
      if (document.getElementById('btn-add-annotate-mode')?.classList.contains('active')) {
          window.AnnotationCanvas?.setAddMode(false);
      }
    }

    // Nút import/admin chỉ admin mới có
    document.getElementById('btn-admin-console')?.classList.toggle('hidden', !canEdit);
    document.getElementById('btn-omr-upload')?.classList.toggle('hidden', !canEdit);

    // Setlist add button — banhat + admin (matches library-ui.js canEdit logic)
    document.querySelectorAll('.song-add-setlist-btn').forEach(btn => {
      btn.classList.toggle('hidden', !canEditChords);
    });
  }

  function showError(msg) {
    const el = document.getElementById('auth-error');
    if (el) {
      el.textContent = msg;
      el.classList.remove('hidden');
    }
  }

  function chooseGuestMode() {
    sessionStorage.setItem('sheetapp_guest_chosen', '1');
    closeModal();
    window.App?.showToast?.('Đang xem dưới quyền Khách (Chỉ xem sheet & hợp âm)', 'info');
  }

  function init() {
    // Mở modal từ sidebar và từ thanh toolbar
    document.getElementById('btn-auth')?.addEventListener('click', openModal);
    document.getElementById('btn-toolbar-auth')?.addEventListener('click', openModal);

    // Nút đóng & nút chọn quyền khách
    document.getElementById('btn-close-auth')?.addEventListener('click', () => {
      if (!_currentUser) sessionStorage.setItem('sheetapp_guest_chosen', '1');
      closeModal();
    });
    document.getElementById('btn-enter-as-guest')?.addEventListener('click', chooseGuestMode);
    document.getElementById('btn-continue-logged-in')?.addEventListener('click', closeModal);

    // Đóng khi click ngoài modal box
    document.getElementById('auth-modal')?.addEventListener('click', (e) => {
      if (e.target.id === 'auth-modal') {
        if (!_currentUser) sessionStorage.setItem('sheetapp_guest_chosen', '1');
        closeModal();
      }
    });

    // Form login
    document.getElementById('btn-do-login')?.addEventListener('click', () => {
      const u = document.getElementById('auth-username-input').value;
      const p = document.getElementById('auth-password-input').value;
      doLogin(u, p);
    });

    // Enter key
    document.getElementById('auth-password-input')?.addEventListener('keyup', e => {
      if (e.key === 'Enter') document.getElementById('btn-do-login').click();
    });
    document.getElementById('auth-username-input')?.addEventListener('keyup', e => {
      if (e.key === 'Enter') document.getElementById('auth-password-input')?.focus();
    });

    // Chip chọn nhanh tài khoản
    document.querySelectorAll('.auth-quick-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const u = chip.getAttribute('data-user');
        const p = chip.getAttribute('data-pass') || '123456';
        const uInput = document.getElementById('auth-username-input');
        const pInput = document.getElementById('auth-password-input');
        if (uInput) uInput.value = u;
        if (pInput) pInput.value = p;
        doLogin(u, p);
      });
    });

    document.getElementById('btn-do-logout')?.addEventListener('click', doLogout);
    
    checkSession().then(() => {
      // Tự động hiện Welcome Modal hỏi đăng nhập / dùng quyền khách trong phiên lần đầu
      setTimeout(() => {
        if (!_currentUser && !sessionStorage.getItem('sheetapp_guest_chosen')) {
          openModal();
        }
      }, 450);
    });
  }

  function openModal() {
    const el = document.getElementById('auth-error');
    if (el) el.classList.add('hidden');
    document.getElementById('auth-modal')?.classList.remove('hidden');
  }

  function closeModal() {
    document.getElementById('auth-modal')?.classList.add('hidden');
  }

  function isAdmin() {
    return _role === 'admin';
  }

  function isLoggedIn() {
    return _currentUser !== null;
  }

  /** Ban Hát hoặc Admin đều có quyền chỉnh sửa hợp âm */
  function _canEditChords() {
    return _role === 'banhat' || _role === 'admin';
  }

  return {
    init, checkSession, login: doLogin, logout: doLogout, isAdmin, isLoggedIn, openModal, closeModal,
    isBanhat: () => _canEditChords(),
    getUser: () => _currentUser,
    getRole: () => _role,
    getChordCode: () => _chordCode,
    getMusicianInfo: () => ({ username: _currentUser, role: _role, chordCode: _chordCode })
  };
})();

window.Auth = Auth;
