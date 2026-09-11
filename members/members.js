/**
 * members/members.js — Quản lý nhạc công & Gán bộ hợp âm cá nhân
 * SheetApp Platform
 */
(() => {
  'use strict';

  let _members = [];
  let _currentFilter = {
    search: '',
    instrument: '',
    role: ''
  };

  // DOM Elements
  const elGrid          = document.getElementById('musicians-grid');
  const elLoading       = document.getElementById('musicians-loading');
  const elEmpty         = document.getElementById('musicians-empty');
  const elSearch        = document.getElementById('filter-search');
  const elFilterInst    = document.getElementById('filter-instrument');
  const elFilterRole    = document.getElementById('filter-role');
  const elStatTotal     = document.getElementById('stat-total-musicians');
  const elStatCodes     = document.getElementById('stat-total-chord-codes');
  const elThemeToggle   = document.getElementById('btn-theme-toggle');

  // Modal Create
  const elModalCreate   = document.getElementById('modal-create-musician');
  const elBtnOpenCreate = document.getElementById('btn-open-create-modal');
  const elFormCreate    = document.getElementById('form-create-musician');
  const elInputDispName = document.getElementById('create-display-name');
  const elInputUsername = document.getElementById('create-username');
  const elInputChordCode= document.getElementById('create-chord-code');
  const elPreviewTag    = document.getElementById('preview-chord-tag');

  // Modal Edit
  const elModalEdit     = document.getElementById('modal-edit-musician');
  const elFormEdit      = document.getElementById('form-edit-musician');
  const elEditId        = document.getElementById('edit-user-id');
  const elEditUsername  = document.getElementById('edit-username');
  const elEditDispName  = document.getElementById('edit-display-name');
  const elEditInst      = document.getElementById('edit-instrument');
  const elEditChordCode = document.getElementById('edit-chord-code');
  const elEditRole      = document.getElementById('edit-role');
  const elEditPassword  = document.getElementById('edit-password');

  const ICONS = {
    guitar: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 3a2 2 0 0 0-2.83 0L14.5 4.67l4.83 4.83L21 7.83A2 2 0 0 0 21 5l-2-2z"/><line x1="14.5" y1="4.67" x2="11.5" y2="7.67"/><circle cx="8" cy="16" r="5"/><line x1="11.5" y1="12.5" x2="16.5" y2="7.5"/></svg>`,
    piano: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="6" y1="5" x2="6" y2="12"/><line x1="10" y1="5" x2="10" y2="12"/><line x1="14" y1="5" x2="14" y2="12"/><line x1="18" y1="5" x2="18" y2="12"/><line x1="2" y1="12" x2="22" y2="12"/></svg>`,
    vocal: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>`,
    music: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`,
    edit: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
    key: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><path d="M21 2l-2 2m-1.5 1.5L14 9l-1.5-1.5L11 9l-1.5-1.5L8 9a5 5 0 1 0 4.5 4.5L21 5v-3h-3z"/></svg>`,
    trash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
    sun: `<svg class="theme-icon theme-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`,
    moon: `<svg class="theme-icon theme-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`
  };

  /* ─── 1. INIT & THEME ────────────────────────────────────────── */
  function initTheme() {
    const savedTheme = localStorage.getItem('sheetapp_theme');
    if (savedTheme === 'light') {
      document.body.classList.remove('dark-mode');
      document.body.classList.add('light-mode');
      if (elThemeToggle) elThemeToggle.innerHTML = ICONS.sun;
    } else {
      document.body.classList.add('dark-mode');
      document.body.classList.remove('light-mode');
      if (elThemeToggle) elThemeToggle.innerHTML = ICONS.moon;
    }

    elThemeToggle?.addEventListener('click', () => {
      const isLight = document.body.classList.toggle('light-mode');
      document.body.classList.toggle('dark-mode', !isLight);
      localStorage.setItem('sheetapp_theme', isLight ? 'light' : 'dark');
      elThemeToggle.innerHTML = isLight ? ICONS.sun : ICONS.moon;
    });
  }

  /* ─── 2. FETCH & RENDER MEMBERS ─────────────────────────────── */
  async function loadMembers() {
    elLoading?.classList.remove('hidden');
    elGrid?.classList.add('hidden');
    elEmpty?.classList.add('hidden');

    try {
      const res = await fetch('/api/index.php?route=users');
      const data = await res.json();
      const users = data.users || data.data?.users;
      if ((data.success || data.status === 'ok') && users) {
        _members = users;
        updateStats();
        renderGrid();
      } else {
        showToast(data.error || data.message || 'Không thể tải danh sách thành viên', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('Lỗi kết nối API khi tải thành viên', 'error');
    } finally {
      elLoading?.classList.add('hidden');
    }
  }

  function updateStats() {
    if (elStatTotal) elStatTotal.textContent = _members.length;
    if (elStatCodes) {
      const uniqueCodes = new Set(_members.map(m => m.chord_code).filter(Boolean));
      elStatCodes.textContent = uniqueCodes.size;
    }
  }

  function getInstrumentIcon(inst) {
    if (!inst) return ICONS.music;
    const s = inst.toLowerCase();
    if (s.includes('guitar')) return ICONS.guitar;
    if (s.includes('piano') || s.includes('phím')) return ICONS.piano;
    if (s.includes('organ') || s.includes('key')) return ICONS.piano;
    if (s.includes('bass')) return ICONS.guitar;
    if (s.includes('hát') || s.includes('vocal')) return ICONS.vocal;
    return ICONS.music;
  }

  function renderGrid() {
    if (!elGrid) return;
    elGrid.innerHTML = '';

    const query = _currentFilter.search.toLowerCase().trim();
    const instF = _currentFilter.instrument.toLowerCase();
    const roleF = _currentFilter.role;

    const filtered = _members.filter(m => {
      const matchSearch = !query ||
        (m.display_name && m.display_name.toLowerCase().includes(query)) ||
        (m.username && m.username.toLowerCase().includes(query)) ||
        (m.chord_code && m.chord_code.toLowerCase().includes(query)) ||
        (m.instrument && m.instrument.toLowerCase().includes(query));

      const matchInst = !instF || (m.instrument && m.instrument.toLowerCase().includes(instF));
      const matchRole = !roleF || m.role === roleF;

      return matchSearch && matchInst && matchRole;
    });

    if (!filtered.length) {
      elGrid.classList.add('hidden');
      elEmpty?.classList.remove('hidden');
      return;
    }

    elEmpty?.classList.add('hidden');
    elGrid.classList.remove('hidden');

    filtered.forEach(m => {
      const card = document.createElement('div');
      card.className = 'musician-card';
      const icon = getInstrumentIcon(m.instrument);
      const chordCode = m.chord_code ? m.chord_code.toUpperCase() : 'Chưa gán';
      const roleName = m.role === 'admin' ? 'Quản Trị' : (m.role === 'banhat' ? 'Ban Hát' : 'Khách');
      const roleCls  = m.role === 'admin' ? 'role-admin' : (m.role === 'banhat' ? 'role-banhat' : 'role-viewer');

      card.innerHTML = `
        <div>
          <div class="musician-card-header">
            <div class="musician-avatar-wrap">${icon}</div>
            <div class="musician-title-wrap">
              <div class="musician-display-name" title="${m.display_name || m.username}">${m.display_name || m.username}</div>
              <div class="musician-username">@${m.username}</div>
            </div>
            <span class="musician-role-tag ${roleCls}">${roleName}</span>
          </div>

          <div class="musician-details-list">
            <div class="detail-row">
              <span class="detail-label">Nhạc cụ</span>
              <span class="detail-value">${m.instrument || 'Chưa thiết lập'}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Mã Hợp Âm Cá Nhân</span>
              <span class="chord-code-pill" title="Hợp âm cá nhân độc quyền của ${m.display_name || m.username}">${chordCode}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Quyền sửa hợp âm</span>
              <span class="detail-value" style="color:var(--emerald-light); font-size:0.75rem;">
                ${m.role === 'viewer' ? 'Chỉ xem (Không được sửa)' : 'Độc quyền bộ ' + chordCode}
              </span>
            </div>
          </div>
        </div>

        <div class="musician-card-footer">
          <button class="card-btn card-btn-edit" data-edit-id="${m.id}" title="Chỉnh sửa thông tin">
            ${ICONS.edit} <span>Sửa</span>
          </button>
          <button class="card-btn" data-pass-id="${m.id}" title="Đổi mật khẩu nhanh">
            ${ICONS.key} <span>Đổi pass</span>
          </button>
          ${m.username !== 'banhat' && m.username !== 'hoaidinh' ? `
            <button class="card-btn card-btn-delete" data-del-id="${m.id}" title="Xóa nhạc công này">
              ${ICONS.trash}
            </button>
          ` : ''}
        </div>
      `;

      elGrid.appendChild(card);
    });

    // Attach Event Listeners
    elGrid.querySelectorAll('[data-edit-id]').forEach(btn => {
      btn.addEventListener('click', () => openEditModal(btn.dataset.editId));
    });
    elGrid.querySelectorAll('[data-pass-id]').forEach(btn => {
      btn.addEventListener('click', () => openPasswordPrompt(btn.dataset.passId));
    });
    elGrid.querySelectorAll('[data-del-id]').forEach(btn => {
      btn.addEventListener('click', () => confirmDeleteMember(btn.dataset.delId));
    });
  }

  /* ─── 3. AUTO-GENERATE CHORD CODE ────────────────────────────── */
  function suggestChordCode(name, username) {
    if (!name && !username) return '';
    const src = name || username;
    // Bỏ dấu tiếng Việt
    const clean = src.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
    const words = clean.trim().split(/\s+/).filter(Boolean);
    if (words.length >= 2) {
      // Lấy chữ cái đầu của 2 hoặc 3 từ: Hoài Dinh -> HD
      return (words[0][0] + words[words.length - 1][0]).toUpperCase();
    } else if (words.length === 1) {
      return words[0].substring(0, 4).toUpperCase();
    }
    return '';
  }

  elInputDispName?.addEventListener('input', () => {
    if (!elInputChordCode.dataset.userModified) {
      const code = suggestChordCode(elInputDispName.value, elInputUsername.value);
      if (code) {
        elInputChordCode.value = code;
        if (elPreviewTag) elPreviewTag.textContent = code;
      }
    }
  });

  elInputChordCode?.addEventListener('input', () => {
    elInputChordCode.dataset.userModified = 'true';
    if (elPreviewTag) elPreviewTag.textContent = elInputChordCode.value.toUpperCase() || 'MÃ';
  });

  /* ─── 4. CREATE MODAL ────────────────────────────────────────── */
  elBtnOpenCreate?.addEventListener('click', () => {
    elFormCreate.reset();
    delete elInputChordCode.dataset.userModified;
    if (elPreviewTag) elPreviewTag.textContent = 'HD';
    elModalCreate?.classList.remove('hidden');
    elInputUsername?.focus();
  });

  elFormCreate?.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = document.getElementById('btn-submit-create');
    btn.disabled = true;

    const payload = {
      username: elInputUsername.value.trim(),
      password: document.getElementById('create-password').value,
      display_name: elInputDispName.value.trim(),
      instrument: document.getElementById('create-instrument').value.trim() || 'Guitar',
      chord_code: elInputChordCode.value.trim().toUpperCase(),
      role: document.getElementById('create-role').value
    };

    try {
      const res = await fetch('/api/index.php?route=users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success || data.status === 'ok') {
        showToast(`Đã tạo thành công nhạc công @${payload.username} (Mã HÂ: ${payload.chord_code})!`, 'success');
        elModalCreate?.classList.add('hidden');
        await loadMembers();
      } else {
        showToast(data.error || data.message || 'Lỗi tạo nhạc công', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Lỗi gửi dữ liệu lên máy chủ', 'error');
    } finally {
      btn.disabled = false;
    }
  });

  /* ─── 5. EDIT MODAL ──────────────────────────────────────────── */
  function openEditModal(id) {
    const member = _members.find(m => String(m.id) === String(id));
    if (!member) return;

    elEditId.value = member.id;
    elEditUsername.value = member.username;
    elEditDispName.value = member.display_name || member.username;
    elEditInst.value = member.instrument || 'Guitar';
    elEditChordCode.value = member.chord_code || '';
    elEditRole.value = member.role || 'banhat';
    elEditPassword.value = '';

    elModalEdit?.classList.remove('hidden');
    elEditDispName.focus();
  }

  elFormEdit?.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = document.getElementById('btn-submit-edit');
    btn.disabled = true;

    const payload = {
      id: elEditId.value,
      display_name: elEditDispName.value.trim(),
      instrument: elEditInst.value.trim(),
      chord_code: elEditChordCode.value.trim().toUpperCase(),
      role: elEditRole.value
    };
    if (elEditPassword.value) {
      payload.password = elEditPassword.value;
    }

    try {
      const res = await fetch('/api/index.php?route=users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success || data.status === 'ok') {
        showToast('Cập nhật thông tin nhạc công thành công!', 'success');
        elModalEdit?.classList.add('hidden');
        await loadMembers();
      } else {
        showToast(data.error || data.message || 'Lỗi cập nhật', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Lỗi gửi dữ liệu cập nhật', 'error');
    } finally {
      btn.disabled = false;
    }
  });

  /* ─── 6. PASSWORD QUICK RESET ────────────────────────────────── */
  function openPasswordPrompt(id) {
    const member = _members.find(m => String(m.id) === String(id));
    if (!member) return;

    const newPass = prompt(`Nhập mật khẩu mới cho nhạc công @${member.username}:`, '123456');
    if (!newPass) return;

    fetch('/api/index.php?route=users', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: member.id, password: newPass })
    })
    .then(r => r.json())
    .then(data => {
      if (data.success || data.status === 'ok') {
        showToast(`Đã đổi mật khẩu cho @${member.username} thành "${newPass}"`, 'success');
      } else {
        showToast(data.error || data.message || 'Không thể đổi mật khẩu', 'error');
      }
    })
    .catch(() => showToast('Lỗi hệ thống khi đổi mật khẩu', 'error'));
  }

  /* ─── 7. DELETE MEMBER ───────────────────────────────────────── */
  function confirmDeleteMember(id) {
    const member = _members.find(m => String(m.id) === String(id));
    if (!member) return;

    if (confirm(`Bạn có chắc chắn muốn xóa nhạc công @${member.username} (${member.display_name}) khỏi danh sách ban nhạc?`)) {
      fetch(`/api/index.php?route=users&id=${member.id}`, { method: 'DELETE' })
        .then(r => r.json())
        .then(data => {
          if (data.success || data.status === 'ok') {
            showToast(`Đã xóa nhạc công @${member.username}`, 'success');
            loadMembers();
          } else {
            showToast(data.error || data.message || 'Không thể xóa', 'error');
          }
        })
        .catch(() => showToast('Lỗi hệ thống khi xóa', 'error'));
    }
  }

  /* ─── 8. FILTER LISTENERS ────────────────────────────────────── */
  elSearch?.addEventListener('input', e => {
    _currentFilter.search = e.target.value;
    renderGrid();
  });

  elFilterInst?.addEventListener('change', e => {
    _currentFilter.instrument = e.target.value;
    renderGrid();
  });

  elFilterRole?.addEventListener('change', e => {
    _currentFilter.role = e.target.value;
    renderGrid();
  });

  // Modal Close buttons
  document.querySelectorAll('[data-close-modal]').forEach(b => {
    b.addEventListener('click', () => {
      elModalCreate?.classList.add('hidden');
      elModalEdit?.classList.add('hidden');
    });
  });

  /* ─── 9. TOAST NOTIFICATIONS ─────────────────────────────────── */
  function showToast(msg, type = 'info') {
    const el = document.getElementById('mbr-toast');
    if (!el) return;
    el.textContent = msg;
    el.className = `mbr-toast ${type}`;
    el.classList.remove('hidden');
    setTimeout(() => { el.classList.add('hidden'); }, 3500);
  }

  // Auto boot
  initTheme();
  loadMembers();

})();
