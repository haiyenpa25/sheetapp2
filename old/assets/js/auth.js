/**
 * auth.js
 * Quản lý xác thực (Authentication), Login/Logout và Phân Quyền (Roles)
 */
const Auth = (() => {
  'use strict';

  let _currentUser = null;
  let _role = 'viewer'; // viewer | banhat | admin

  async function checkSession() {
    try {
      const data = await window.ApiService.auth.me();
      if (data.loggedIn) {
        _currentUser = data.username;
        _role = data.role;
      } else {
        _currentUser = null;
        _role = 'viewer';
      }
      _updateUI();
      return _role;
    } catch (err) {
      console.error("Auth:", err);
      _role = 'viewer';
      return _role;
    }
  }

  async function doLogin(username, password) {
    try {
      const data = await window.ApiService.auth.login({ username, password });
      if (data.success) {
        _currentUser = data.username;
        _role = data.role;
        _updateUI();
        closeModal();
        window.App?.showToast?.('Đăng nhập thành công', 'success');
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
    _updateUI();
    closeModal();
    window.App?.showToast?.('Đã đăng xuất', 'info');
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

    // ── Modal auth panel ──
    const formPanel    = document.getElementById('auth-login-form');
    const loggedInPanel = document.getElementById('auth-logged-in');

    if (_currentUser) {
      formPanel?.classList.add('hidden');
      loggedInPanel?.classList.remove('hidden');
      const roleDisplay = document.getElementById('auth-role-display');
      if (roleDisplay) {
        const roleLabel = { admin: 'Quản Trị', banhat: 'Ban Hát', viewer: 'Xem' };
        roleDisplay.textContent = roleLabel[_role] || 'Xem';
      }
      // Cập nhật tóm tắt quyền trong modal
      const permSummary = document.getElementById('auth-perm-summary');
      if (permSummary) {
        const perms = {
          admin:  '✅ Xem • ✅ Thêm/sửa hợp âm • ✅ Ghi chú • ✅ Quản lý hệ thống',
          banhat: '✅ Xem • ✅ Thêm/sửa hợp âm • ❌ Ghi chú • ❌ Quản lý',
          viewer: '✅ Xem • ❌ Thêm hợp âm • ❌ Ghi chú • ❌ Quản lý'
        };
        permSummary.textContent = perms[_role] ?? perms.viewer;
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

    // Thêm hợp âm — cần quyền Ban Hát trở lên
    document.getElementById('btn-add-chord-mode')?.classList.toggle('hidden', !canEditChords);
    document.getElementById('btn-add-chord-mode-bar')?.classList.toggle('hidden', !canEditChords);
    // Nổi bật hợp âm — TấT CẢ người dùng đều được dùng (chỉ xem, không sửa)
    document.getElementById('btn-chord-highlight')?.classList.remove('hidden');
    // Tạo bộ hợp âm mới — cần quyền Ban Hát trở lên
    document.getElementById('btn-new-chord-set')?.classList.toggle('hidden', !canEditChords);
    // Ghi chú — Admin only
    document.getElementById('btn-add-annotate-mode')?.classList.toggle('hidden', !canEdit);

    // FAB items
    document.getElementById('fab-chord')?.classList.toggle('hidden', !canEditChords);
    document.getElementById('fab-annotate')?.classList.toggle('hidden', !canEdit);
    // FAB highlight — tất cẢ đều thấy
    document.getElementById('fab-highlight')?.classList.remove('hidden');

    // Nút thùng rác chord set — admin only
    const delBtn = document.getElementById('btn-delete-chord-set');
    if (delBtn && !canEdit) delBtn.style.display = 'none';

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

  function init() {
    document.getElementById('btn-auth')?.addEventListener('click', openModal);
    document.getElementById('btn-close-auth')?.addEventListener('click', closeModal);
    
    document.getElementById('btn-do-login')?.addEventListener('click', () => {
      const u = document.getElementById('auth-username-input').value;
      const p = document.getElementById('auth-password-input').value;
      doLogin(u, p);
    });

    // Enter key
    document.getElementById('auth-password-input')?.addEventListener('keyup', e => {
      if (e.key === 'Enter') document.getElementById('btn-do-login').click();
    });

    document.getElementById('btn-do-logout')?.addEventListener('click', doLogout);
    
    checkSession();
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
    init, checkSession, isAdmin, isLoggedIn,
    isBanhat: () => _canEditChords(),
    getUser: () => _currentUser,
    getRole: () => _role
  };
})();

window.Auth = Auth;
