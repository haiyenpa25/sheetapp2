/**
 * sheet.hyb.io.vn/manager/manager.js
 * Client Controller cho Trung Tâm Quản Lý Kho Nhạc & Cộng Tác Hợp Âm
 */
'use strict';

const ManagerApp = (() => {
  // State
  const state = {
    activeTab: 'tab-repertoire',
    currentUser: { logged_in: false, user_id: null, username: '', role: 'viewer' },
    stats: {},
    categories: [],
    repertoire: {
      songs: [],
      total: 0,
      limit: 50,
      offset: 0,
      categoryId: '',
      onlyHasChords: false,
      keyword: ''
    },
    community: {
      sets: [],
      instrument: '',
      author: '',
      recommendedOnly: false,
      keyword: ''
    },
    users: [],
    searchDebounceTimer: null
  };

  /* ================= INIT & EVENT LISTENERS ================= */
  async function init() {
    _bindEvents();
    await _checkCurrentUser();
    await _loadInitialData();
  }

  function _bindEvents() {
    // 1. Tab Switching
    document.querySelectorAll('.mgr-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.dataset.tab;
        switchTab(targetTab);
      });
    });

    // KPI Card Click jumps to tab
    document.querySelectorAll('.mgr-kpi-card').forEach(card => {
      card.addEventListener('click', () => {
        const target = card.dataset.tabTarget;
        if (target) switchTab(target);
      });
    });

    // 2. Global Search Input
    const searchInput = document.getElementById('mgr-global-search');
    const clearBtn    = document.getElementById('mgr-search-clear');

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const q = e.target.value.trim();
        clearBtn?.classList.toggle('hidden', q === '');
        clearTimeout(state.searchDebounceTimer);
        state.searchDebounceTimer = setTimeout(() => {
          state.repertoire.keyword = q;
          state.community.keyword = q;
          state.repertoire.offset = 0;
          if (state.activeTab === 'tab-community') {
            loadCommunityChords();
          } else {
            loadRepertoire();
          }
        }, 250);
      });

      // Clear search
      clearBtn?.addEventListener('click', () => {
        searchInput.value = '';
        clearBtn.classList.add('hidden');
        state.repertoire.keyword = '';
        state.community.keyword = '';
        state.repertoire.offset = 0;
        loadRepertoire();
        loadCommunityChords();
      });

      // Shortcut Ctrl+K
      window.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
          e.preventDefault();
          searchInput.focus();
          searchInput.select();
        }
      });
    }

    // 3. Category Filter Pills
    document.getElementById('mgr-cat-pills')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.mgr-pill');
      if (!btn) return;
      document.querySelectorAll('#mgr-cat-pills .mgr-pill').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      state.repertoire.categoryId = btn.dataset.catId || '';
      state.repertoire.offset = 0;
      loadRepertoire();
    });

    // Only has chords checkbox
    document.getElementById('chk-only-has-chords')?.addEventListener('change', (e) => {
      state.repertoire.onlyHasChords = e.target.checked;
      renderRepertoire();
    });

    // 4. Community Filters
    document.getElementById('mgr-instrument-pills')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.mgr-pill');
      if (!btn) return;
      document.querySelectorAll('#mgr-instrument-pills .mgr-pill').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      state.community.instrument = btn.dataset.inst || '';
      loadCommunityChords();
    });

    document.getElementById('mgr-author-chips')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.mgr-pill');
      if (!btn) return;
      document.querySelectorAll('#mgr-author-chips .mgr-pill').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      state.community.author = btn.dataset.author || '';
      loadCommunityChords();
    });

    document.getElementById('chk-recommended-only')?.addEventListener('change', (e) => {
      state.community.recommendedOnly = e.target.checked;
      loadCommunityChords();
    });

    // 5. Pagination
    document.getElementById('btn-prev-page')?.addEventListener('click', () => {
      if (state.repertoire.offset >= state.repertoire.limit) {
        state.repertoire.offset -= state.repertoire.limit;
        loadRepertoire();
      }
    });

    document.getElementById('btn-next-page')?.addEventListener('click', () => {
      if (state.repertoire.offset + state.repertoire.limit < state.repertoire.total) {
        state.repertoire.offset += state.repertoire.limit;
        loadRepertoire();
      }
    });

    // 6. Modals Close
    document.querySelectorAll('.mgr-modal-close, [data-close]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const modalId = btn.dataset.close || btn.closest('.mgr-modal-overlay')?.id;
        if (modalId) closeModal(modalId);
      });
    });

    // Close on overlay click
    document.querySelectorAll('.mgr-modal-overlay').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal(modal.id);
      });
    });

    // Quick Fork Button
    document.getElementById('btn-quick-fork')?.addEventListener('click', () => {
      openForkModal();
    });

    // Fork Form Submit
    document.getElementById('form-fork-song')?.addEventListener('submit', _handleForkSubmit);

    // Login Form Submit & Trigger
    document.getElementById('mgr-btn-login-modal')?.addEventListener('click', () => {
      openModal('modal-login');
    });
    document.getElementById('form-mgr-login')?.addEventListener('submit', _handleLoginSubmit);

    // Logout
    document.getElementById('mgr-btn-logout')?.addEventListener('click', _handleLogout);

    // Admin Modals
    document.getElementById('btn-add-user-modal')?.addEventListener('click', () => openModal('modal-user'));
    document.getElementById('form-create-user')?.addEventListener('submit', _handleCreateUserSubmit);

    document.getElementById('btn-add-category-modal')?.addEventListener('click', () => {
      document.getElementById('cat-modal-title').textContent = '📂 Thêm Thể Loại Mới';
      document.getElementById('cat-edit-id').value = '';
      document.getElementById('cat-edit-name').value = '';
      document.getElementById('cat-edit-desc').value = '';
      document.getElementById('cat-edit-icon').value = '🎵';
      openModal('modal-category');
    });
    document.getElementById('form-manage-category')?.addEventListener('submit', _handleCategorySubmit);
  }

  /* ================= DATA LOADING ================= */
  async function _checkCurrentUser() {
    try {
      const r = await fetch('../api/index.php?route=manager&action=current_user');
      const res = await r.json();
      if (res.success) {
        state.currentUser = res;
      }
    } catch (e) {}

    // Hide users tab if not admin
    const usersNav = document.getElementById('mgr-nav-tab-users');
    if (usersNav && state.currentUser.role !== 'admin') {
      usersNav.style.display = 'none';
    }
  }

  async function _loadInitialData() {
    await Promise.all([
      loadStats(),
      loadCategories(),
      loadRepertoire(),
      loadCommunityChords()
    ]);
  }

  async function loadStats() {
    try {
      const r = await fetch('../api/index.php?route=manager&action=stats');
      const res = await r.json();
      if (res.success) {
        state.stats = res;
        _renderStats(res);
      }
    } catch (e) {
      console.error('Error loading stats:', e);
    }
  }

  function _renderStats(data) {
    document.getElementById('kpi-total-songs').textContent = (data.total_songs || 0).toLocaleString();
    document.getElementById('kpi-total-cats').textContent  = data.total_categories || 0;
    document.getElementById('kpi-total-chords').textContent= data.total_chord_sets || 0;
    document.getElementById('kpi-total-vers').textContent  = data.total_versions || 0;
    document.getElementById('kpi-total-users').textContent = data.total_users || 0;

    document.getElementById('tab-repertoire-count').textContent = data.total_songs || 0;
    document.getElementById('tab-community-count').textContent  = data.total_chord_sets || 0;

    // Render Author Chips for Community Tab
    const authorChips = document.getElementById('mgr-author-chips');
    if (authorChips && data.top_contributors) {
      let html = '<button class="mgr-pill active" data-author="">Tất Cả Tác Giả</button>';
      data.top_contributors.forEach(u => {
        const name = u.display_name || u.username;
        html += `<button class="mgr-pill" data-author="${u.username}">👤 @${u.username} (${u.chord_sets_count})</button>`;
      });
      authorChips.innerHTML = html;
    }
  }

  async function loadCategories() {
    try {
      const r = await fetch('../api/index.php?route=manager&action=categories');
      const res = await r.json();
      if (res.success && res.categories) {
        state.categories = res.categories;
        _renderCategoryPills(res.categories);
        _renderCategoriesTab(res.categories);
      }
    } catch (e) {
      console.error('Error loading categories:', e);
    }
  }

  function _renderCategoryPills(categories) {
    const container = document.getElementById('mgr-cat-pills');
    if (!container) return;

    let html = '<button class="mgr-pill active" data-cat-id="">Tất Cả Thể Loại</button>';
    categories.forEach(c => {
      html += `<button class="mgr-pill" data-cat-id="${c.id}">${c.icon || '🎵'} ${c.name} (${c.song_count || 0})</button>`;
    });
    container.innerHTML = html;
  }

  function _renderCategoriesTab(categories) {
    const grid = document.getElementById('mgr-categories-grid');
    if (!grid) return;

    const isAdmin = state.currentUser.role === 'admin';
    let html = '';
    categories.forEach(c => {
      html += `
        <div class="cat-card">
          <div class="cat-card-header">
            <span class="cat-card-icon">${c.icon || '🎵'}</span>
            <div>
              <div class="cat-card-title">${_escape(c.name)}</div>
              <div class="cat-card-count">${c.song_count || 0} bài hát</div>
            </div>
          </div>
          <div class="cat-card-desc">${_escape(c.description || 'Chưa có mô tả')}</div>
          ${isAdmin ? `
            <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:auto; padding-top:0.5rem; border-top:1px solid var(--border);">
              <button class="mgr-btn mgr-btn-ghost mgr-btn-xs" onclick="ManagerApp.editCategory(${c.id}, '${_escape(c.name)}', '${_escape(c.icon)}', '${_escape(c.description || '')}')">✏️ Sửa</button>
              ${c.id !== 1 ? `<button class="mgr-btn mgr-btn-ghost mgr-btn-xs text-danger" onclick="ManagerApp.deleteCategory(${c.id})">🗑️ Xóa</button>` : ''}
            </div>
          ` : ''}
        </div>
      `;
    });
    grid.innerHTML = html;
  }

  /* ================= REPERTOIRE (TAB 1) ================= */
  async function loadRepertoire() {
    const tbody = document.getElementById('mgr-songs-tbody');
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="mgr-table-loading">
            <div class="mgr-spinner"></div>
            <p>Đang tải danh sách bài hát...</p>
          </td>
        </tr>
      `;
    }

    try {
      const params = new URLSearchParams({
        route: 'manager',
        action: 'repertoire',
        limit: state.repertoire.limit,
        offset: state.repertoire.offset,
        category_id: state.repertoire.categoryId || '',
        q: state.repertoire.keyword || ''
      });

      const r = await fetch('../api/index.php?' + params.toString());
      const res = await r.json();
      if (res.success) {
        state.repertoire.songs = res.songs || [];
        state.repertoire.total = res.total || 0;
        renderRepertoire();
        _updatePagination();
      }
    } catch (e) {
      console.error('Error loading repertoire:', e);
      if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="mgr-table-loading text-danger">Lỗi kết nối máy chủ khi nạp bài hát.</td></tr>`;
    }
  }

  function renderRepertoire() {
    const tbody = document.getElementById('mgr-songs-tbody');
    if (!tbody) return;

    let songs = state.repertoire.songs;

    if (state.repertoire.onlyHasChords) {
      songs = songs.filter(s => (s.user_chord_sets && s.user_chord_sets.length > 0) || (s.song_versions && s.song_versions.length > 0));
    }

    if (songs.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="mgr-table-loading">
            <p>Không tìm thấy bài hát nào phù hợp với bộ lọc hiện tại.</p>
          </td>
        </tr>
      `;
      return;
    }

    let html = '';
    songs.forEach(song => {
      const userChords = song.user_chord_sets || [];
      const versions   = song.song_versions || [];

      // Render Chord Sets Chips
      let chordChipsHtml = '';
      if (userChords.length > 0) {
        chordChipsHtml = userChords.map(c => {
          const isRec = c.is_recommended == 1;
          const instIcon = c.instrument_type === 'piano' ? '🎹' : (c.instrument_type === 'bass' ? '🎻' : '🎸');
          const safeDiskName = c.username + '__' + c.set_name.replace(/[^a-zA-Z0-9_\-]/g, '_');
          return `
            <a href="../index.php?song=${encodeURIComponent(song.id)}&set=${encodeURIComponent(safeDiskName)}" 
               class="user-chord-chip ${isRec ? 'chip-recommended' : ''}" 
               title="${isRec ? '⭐ Ca Trưởng Khuyên Dùng: ' : ''}${_escape(c.set_name)} (Capo ${c.capo_fret || 0}) — Soạn bởi @${_escape(c.username)}">
              <span>${isRec ? '⭐' : instIcon}</span>
              <span>${_escape(c.set_name)}</span>
              <span class="chip-author">@${_escape(c.username)}</span>
            </a>
          `;
        }).join('');
      } else {
        chordChipsHtml = '<span class="text-muted text-xs">Chưa có bản phối nào</span>';
      }

      html += `
        <tr>
          <td><strong style="color:var(--text-muted); font-size:0.85rem;">#${song.httlvnId || '—'}</strong></td>
          <td>
            <div class="song-title-cell">
              <span class="song-main-title">${_escape(song.title)}</span>
              <span class="song-sub-info">Mã: <code>${_escape(song.id)}</code></span>
            </div>
          </td>
          <td style="text-align:center;">
            <span class="key-badge">${_escape(song.defaultKey || '—')}</span>
          </td>
          <td>
            <span class="cat-badge">
              <span>${song.category_icon || '🎵'}</span>
              <span>${_escape(song.category_name || 'Thánh Ca')}</span>
            </span>
          </td>
          <td>
            <div class="user-chords-list">
              ${chordChipsHtml}
            </div>
          </td>
          <td style="text-align:right;">
            <div class="table-actions">
              <button class="mgr-btn mgr-btn-primary mgr-btn-xs" onclick="ManagerApp.openForkModal('${song.id}', '${_escape(song.title)}')">
                ✨ Clone & Phối
              </button>
              <a href="../index.php?song=${encodeURIComponent(song.id)}" class="mgr-btn mgr-btn-ghost mgr-btn-xs" title="Xem bản nhạc chuẩn">
                👁️ Xem Sheet
              </a>
            </div>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  }

  function _updatePagination() {
    const info = document.getElementById('mgr-page-info');
    const prev = document.getElementById('btn-prev-page');
    const next = document.getElementById('btn-next-page');

    const total = state.repertoire.total;
    const start = total === 0 ? 0 : state.repertoire.offset + 1;
    const end   = Math.min(state.repertoire.offset + state.repertoire.limit, total);

    if (info) info.textContent = `Hiển thị ${start} - ${end} trên tổng số ${total} bài`;
    if (prev) prev.disabled = state.repertoire.offset === 0;
    if (next) next.disabled = end >= total;
  }

  /* ================= COMMUNITY CHORD SETS (TAB 2) ================= */
  async function loadCommunityChords() {
    const grid = document.getElementById('mgr-community-grid');
    if (grid) {
      grid.innerHTML = `
        <div class="mgr-table-loading" style="grid-column: 1/-1;">
          <div class="mgr-spinner"></div>
          <p>Đang nạp các bộ hợp âm cộng đồng...</p>
        </div>
      `;
    }

    try {
      const params = new URLSearchParams({
        route: 'manager',
        action: 'community_chords',
        instrument: state.community.instrument || '',
        username: state.community.author || '',
        recommended: state.community.recommendedOnly ? '1' : '0',
        q: state.community.keyword || ''
      });

      const r = await fetch('../api/index.php?' + params.toString());
      const res = await r.json();
      if (res.success && res.sets) {
        state.community.sets = res.sets;
        renderCommunityGrid(res.sets);
      }
    } catch (e) {
      console.error('Error loading community chords:', e);
      if (grid) grid.innerHTML = `<div class="mgr-table-loading text-danger" style="grid-column:1/-1;">Lỗi nạp bộ hợp âm.</div>`;
    }
  }

  function renderCommunityGrid(sets) {
    const grid = document.getElementById('mgr-community-grid');
    if (!grid) return;

    if (sets.length === 0) {
      grid.innerHTML = `
        <div class="mgr-table-loading" style="grid-column: 1/-1;">
          <p>Chưa có bộ hợp âm cộng đồng nào phù hợp với bộ lọc hiện tại.</p>
          <button class="mgr-btn mgr-btn-primary mgr-btn-sm" style="margin-top:0.75rem;" onclick="ManagerApp.openForkModal()">
            ✨ Tạo Bộ Hợp Âm Đầu Tiên
          </button>
        </div>
      `;
      return;
    }

    const currentUserId = state.currentUser.user_id;
    const isAdmin = state.currentUser.role === 'admin';
    const isBanhat = state.currentUser.role === 'banhat' || isAdmin;

    let html = '';
    sets.forEach(set => {
      const isOwner = currentUserId && (set.user_id == currentUserId);
      const canManage = isOwner || isAdmin;
      const isRec = set.is_recommended == 1;

      const instIcon = set.instrument_type === 'piano' ? '🎹 Piano' : (set.instrument_type === 'bass' ? '🎻 Bass' : '🎸 Guitar');
      const safeDiskName = set.username + '__' + set.set_name.replace(/[^a-zA-Z0-9_\-]/g, '_');
      const dateFormatted = set.created_at ? set.created_at.substring(0, 10) : '';

      html += `
        <div class="community-card ${isRec ? 'card-recommended' : ''}">
          <div class="card-header-row">
            <div>
              <div class="card-song-title">#${set.httlvnId || ''} ${_escape(set.song_title)}</div>
              <div class="card-set-name">${isRec ? '⭐ ' : ''}${_escape(set.set_name)}</div>
            </div>
            <span class="key-badge">${_escape(set.defaultKey || 'G')}</span>
          </div>

          <!-- Author Attribution Box -->
          <div class="card-author-box">
            <div class="card-author-avatar">${(set.username || 'U').substring(0, 1).toUpperCase()}</div>
            <div class="card-author-meta">
              <span class="card-author-name">${_escape(set.display_name || set.username)}</span>
              <span class="card-author-desc">@${_escape(set.username)} • ${set.user_role === 'admin' ? '🛡️ Ban Trưởng' : '🎸 Nhạc Công'}</span>
            </div>
          </div>

          <!-- Badges -->
          <div class="card-badges-row">
            <span class="card-badge">${instIcon}</span>
            <span class="card-badge badge-chord-count">● ${set.chord_count || 0} hợp âm</span>
            ${set.capo_fret > 0 ? `<span class="card-badge badge-capo">Capo ${set.capo_fret}</span>` : ''}
            <span class="card-badge">📅 ${dateFormatted}</span>
          </div>

          ${set.notes_guide ? `<div class="card-notes-guide">"${_escape(set.notes_guide)}"</div>` : ''}

          <!-- Actions -->
          <div class="card-actions-row">
            <a href="../index.php?song=${encodeURIComponent(set.song_id)}&set=${encodeURIComponent(safeDiskName)}" class="mgr-btn mgr-btn-primary mgr-btn-xs" style="flex:1;">
              👁️ Mở Sheet
            </a>

            ${isBanhat ? `
              <button class="mgr-btn mgr-btn-ghost mgr-btn-xs ${isRec ? 'text-accent' : ''}" 
                      title="${isRec ? 'Bỏ ghim khuyên dùng' : 'Ghim cho ban nhạc'}"
                      onclick="ManagerApp.toggleRecommend(${set.id})">
                ${isRec ? '⭐ Đã Ghim' : '☆ Ghim'}
              </button>
            ` : ''}

            ${canManage ? `
              <button class="mgr-btn mgr-btn-ghost mgr-btn-xs text-danger" 
                      title="Xóa bộ này"
                      onclick="ManagerApp.deleteUserChordSet(${set.id}, '${_escape(set.set_name)}')">
                ✕
              </button>
            ` : ''}
          </div>
        </div>
      `;
    });

    grid.innerHTML = html;
  }

  /* ================= USERS MANAGEMENT (TAB 5) ================= */
  async function loadUsers() {
    if (state.currentUser.role !== 'admin') return;

    const tbody = document.getElementById('mgr-users-tbody');
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="7" class="mgr-table-loading"><div class="mgr-spinner"></div><p>Đang nạp danh sách thành viên...</p></td></tr>`;
    }

    try {
      const r = await fetch('../api/index.php?route=manager&action=users');
      const res = await r.json();
      if (res.success && res.users) {
        state.users = res.users;
        renderUsersTable(res.users);
      }
    } catch (e) {
      console.error('Error loading users:', e);
    }
  }

  function renderUsersTable(users) {
    const tbody = document.getElementById('mgr-users-tbody');
    if (!tbody) return;

    let html = '';
    users.forEach(u => {
      const isSelf = u.id === state.currentUser.user_id;
      html += `
        <tr>
          <td>
            <div style="display:flex; align-items:center; gap:0.6rem;">
              <div class="mgr-avatar" style="width:28px; height:28px; font-size:0.75rem;">${u.username.substring(0, 1).toUpperCase()}</div>
              <div>
                <strong>${_escape(u.display_name || u.username)}</strong>
                <div class="text-xs text-muted">@${_escape(u.username)}</div>
              </div>
            </div>
          </td>
          <td>
            <span class="mgr-user-role role-${u.role}">
              ${u.role === 'admin' ? '🛡️ Quản Trị' : (u.role === 'banhat' ? '🎸 Ban Hát' : '👁️ Viewer')}
            </span>
          </td>
          <td>${_escape(u.instrument || '—')}</td>
          <td><strong>${u.chord_sets_count || 0}</strong> bộ hợp âm</td>
          <td><strong>${u.versions_count || 0}</strong> bản XML</td>
          <td class="text-muted text-xs">${u.created_at ? u.created_at.substring(0, 10) : '—'}</td>
          <td style="text-align:right;">
            <div class="table-actions">
              ${!isSelf ? `
                <select class="mgr-input mgr-btn-xs" style="width:auto;" onchange="ManagerApp.updateUserRole(${u.id}, this.value)">
                  <option value="banhat" ${u.role === 'banhat' ? 'selected' : ''}>Ban Hát</option>
                  <option value="viewer" ${u.role === 'viewer' ? 'selected' : ''}>Viewer</option>
                  <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
                </select>
                <button class="mgr-btn mgr-btn-ghost mgr-btn-xs" onclick="ManagerApp.resetUserPass(${u.id}, '${u.username}')">🔑 Pass</button>
                <button class="mgr-btn mgr-btn-ghost mgr-btn-xs text-danger" onclick="ManagerApp.deleteUser(${u.id}, '${u.username}')">✕</button>
              ` : '<span class="text-muted text-xs">(Bạn)</span>'}
            </div>
          </td>
        </tr>
      `;
    });
    tbody.innerHTML = html;
  }

  /* ================= TAB NAVIGATION ================= */
  function switchTab(tabId) {
    state.activeTab = tabId;

    // Update buttons
    document.querySelectorAll('.mgr-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });

    // Update panes
    document.querySelectorAll('.mgr-tab-pane').forEach(pane => {
      pane.classList.toggle('active', pane.id === tabId);
    });

    // Load tab-specific data if needed
    if (tabId === 'tab-community') {
      loadCommunityChords();
    } else if (tabId === 'tab-users') {
      loadUsers();
    } else if (tabId === 'tab-repertoire' && state.repertoire.songs.length === 0) {
      loadRepertoire();
    }
  }

  /* ================= MODALS & ACTIONS ================= */
  function openModal(modalId) {
    const m = document.getElementById(modalId);
    if (m) m.classList.remove('hidden');
  }

  function closeModal(modalId) {
    const m = document.getElementById(modalId);
    if (m) m.classList.add('hidden');
  }

  function openForkModal(songId = '', songTitle = '') {
    if (!state.currentUser.logged_in) {
      showToast('Vui lòng đăng nhập để tạo bản phối cá nhân!', 'info');
      openModal('modal-login');
      return;
    }

    const select = document.getElementById('fork-song-select');
    if (select) {
      // Populate select options from loaded repertoire songs
      let html = '<option value="">-- Chọn bài hát từ kho --</option>';
      state.repertoire.songs.forEach(s => {
        html += `<option value="${s.id}" ${s.id === songId ? 'selected' : ''}>#${s.httlvnId || ''} ${_escape(s.title)} (${s.defaultKey || ''})</option>`;
      });
      select.innerHTML = html;
      if (songId) select.value = songId;
    }

    // Default set name
    const setNameInput = document.getElementById('fork-set-name');
    if (setNameInput && !setNameInput.value) {
      const inst = document.getElementById('fork-instrument-select')?.value || 'Guitar';
      setNameInput.value = `Bản ${inst} của @${state.currentUser.username}`;
    }

    openModal('modal-fork');
  }

  async function _handleForkSubmit(e) {
    e.preventDefault();

    const songId = document.getElementById('fork-song-select').value;
    if (!songId) {
      showToast('Vui lòng chọn bài hát cần tạo bản phối', 'error');
      return;
    }

    const forkType   = document.getElementById('fork-type-select').value;
    const instrument = document.getElementById('fork-instrument-select').value;
    const setName    = document.getElementById('fork-set-name').value.trim();
    const capo       = parseInt(document.getElementById('fork-capo-select').value) || 0;
    const notes      = document.getElementById('fork-notes-guide').value.trim();
    const isPublic   = document.getElementById('fork-is-public').checked ? 1 : 0;

    const submitBtn  = document.getElementById('btn-submit-fork');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Đang nhân bản an toàn...'; }

    try {
      const r = await fetch('../api/index.php?route=manager&action=fork_song', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          song_id: songId,
          fork_type: forkType,
          instrument_type: instrument,
          set_name: setName,
          capo_fret: capo,
          notes_guide: notes,
          is_public: isPublic
        })
      });

      const res = await r.json();
      if (res.success) {
        showToast(res.message || 'Tạo bản phối thành công!', 'success');
        closeModal('modal-fork');

        // Reload data
        loadStats();
        loadRepertoire();
        loadCommunityChords();

        // Redirect to editor or sheet reader after 1 second
        if (res.data?.redirect_url) {
          setTimeout(() => {
            window.location.href = '../' + res.data.redirect_url;
          }, 1200);
        }
      } else {
        showToast(res.message || 'Lỗi khi tạo bản phối', 'error');
      }
    } catch (err) {
      showToast('Lỗi mạng: ' + err.message, 'error');
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = '🚀 Tạo Ngay & Vào Chỉnh Sửa'; }
    }
  }

  async function toggleRecommend(setId) {
    try {
      const r = await fetch('../api/index.php?route=manager&action=toggle_recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ set_id: setId })
      });
      const res = await r.json();
      if (res.success) {
        showToast(res.message, 'success');
        loadCommunityChords();
        loadRepertoire();
      } else {
        showToast(res.message || 'Lỗi', 'error');
      }
    } catch (e) {
      showToast('Lỗi mạng', 'error');
    }
  }

  async function deleteUserChordSet(setId, setName) {
    if (!confirm(`Bạn có chắc muốn xóa bộ hợp âm "${setName}" không?`)) return;

    try {
      const r = await fetch('../api/index.php?route=manager&action=delete_chord_set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ set_id: setId })
      });
      const res = await r.json();
      if (res.success) {
        showToast('Đã xóa bộ hợp âm thành công', 'success');
        loadStats();
        loadCommunityChords();
        loadRepertoire();
      } else {
        showToast(res.message || 'Lỗi khi xóa', 'error');
      }
    } catch (e) {
      showToast('Lỗi mạng', 'error');
    }
  }

  /* ================= ADMIN USER ACTIONS ================= */
  async function _handleCreateUserSubmit(e) {
    e.preventDefault();
    const username = document.getElementById('new-user-username').value.trim();
    const displayName = document.getElementById('new-user-display-name').value.trim();
    const password = document.getElementById('new-user-password').value;
    const instrument = document.getElementById('new-user-instrument').value.trim();
    const role = document.getElementById('new-user-role').value;

    try {
      const r = await fetch('../api/index.php?route=manager&action=manage_user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sub_action: 'create',
          username, password, display_name: displayName, instrument, role
        })
      });
      const res = await r.json();
      if (res.success) {
        showToast(res.message || 'Đã tạo tài khoản!', 'success');
        closeModal('modal-user');
        loadStats();
        loadUsers();
      } else {
        showToast(res.message || 'Lỗi', 'error');
      }
    } catch (e) {
      showToast('Lỗi mạng', 'error');
    }
  }

  async function updateUserRole(userId, role) {
    try {
      const r = await fetch('../api/index.php?route=manager&action=manage_user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sub_action: 'update_role', user_id: userId, role })
      });
      const res = await r.json();
      if (res.success) showToast('Đã cập nhật vai trò', 'success');
      else showToast(res.message || 'Lỗi', 'error');
    } catch (e) { showToast('Lỗi mạng', 'error'); }
  }

  async function resetUserPass(userId, username) {
    const newPass = prompt(`Nhập mật khẩu mới cho @${username}:`);
    if (!newPass) return;

    try {
      const r = await fetch('../api/index.php?route=manager&action=manage_user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sub_action: 'reset_password', user_id: userId, new_password: newPass })
      });
      const res = await r.json();
      if (res.success) showToast(`Đã đổi mật khẩu cho @${username}`, 'success');
      else showToast(res.message || 'Lỗi', 'error');
    } catch (e) { showToast('Lỗi mạng', 'error'); }
  }

  async function deleteUser(userId, username) {
    if (!confirm(`Bạn có chắc muốn xóa tài khoản @${username}? Mọi bài phối của người này vẫn sẽ được giữ lại.`)) return;

    try {
      const r = await fetch('../api/index.php?route=manager&action=manage_user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sub_action: 'delete', user_id: userId })
      });
      const res = await r.json();
      if (res.success) {
        showToast('Đã xóa tài khoản', 'success');
        loadStats();
        loadUsers();
      } else {
        showToast(res.message || 'Lỗi', 'error');
      }
    } catch (e) { showToast('Lỗi mạng', 'error'); }
  }

  /* ================= CATEGORY ACTIONS ================= */
  function editCategory(id, name, icon, desc) {
    document.getElementById('cat-modal-title').textContent = '✏️ Chỉnh Sửa Danh Mục';
    document.getElementById('cat-edit-id').value = id;
    document.getElementById('cat-edit-name').value = name;
    document.getElementById('cat-edit-icon').value = icon;
    document.getElementById('cat-edit-desc').value = desc;
    openModal('modal-category');
  }

  async function _handleCategorySubmit(e) {
    e.preventDefault();
    const id   = document.getElementById('cat-edit-id').value;
    const name = document.getElementById('cat-edit-name').value.trim();
    const icon = document.getElementById('cat-edit-icon').value.trim();
    const desc = document.getElementById('cat-edit-desc').value.trim();

    const subAction = id ? 'update' : 'create';

    try {
      const r = await fetch('../api/index.php?route=manager&action=manage_category', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sub_action: subAction, id, name, icon, description: desc })
      });
      const res = await r.json();
      if (res.success) {
        showToast(res.message || 'Thành công!', 'success');
        closeModal('modal-category');
        loadCategories();
        loadStats();
      } else {
        showToast(res.message || 'Lỗi', 'error');
      }
    } catch (e) { showToast('Lỗi mạng', 'error'); }
  }

  async function deleteCategory(id) {
    if (!confirm('Bạn có chắc muốn xóa thể loại này? Các bài hát sẽ được chuyển về thể loại Thánh Ca mặc định.')) return;

    try {
      const r = await fetch('../api/index.php?route=manager&action=manage_category', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sub_action: 'delete', id })
      });
      const res = await r.json();
      if (res.success) {
        showToast('Đã xóa thể loại', 'success');
        loadCategories();
        loadStats();
      } else {
        showToast(res.message || 'Lỗi', 'error');
      }
    } catch (e) { showToast('Lỗi mạng', 'error'); }
  }

  /* ================= AUTH HELPERS ================= */
  async function _handleLoginSubmit(e) {
    e.preventDefault();
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;

    try {
      const r = await fetch('../api/index.php?route=auth&action=login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const res = await r.json();
      if (res.success) {
        showToast(`Xin chào @${username}! Đăng nhập thành công.`, 'success');
        closeModal('modal-login');
        setTimeout(() => window.location.reload(), 600);
      } else {
        showToast(res.message || 'Sai tài khoản hoặc mật khẩu', 'error');
      }
    } catch (e) { showToast('Lỗi mạng', 'error'); }
  }

  async function _handleLogout() {
    try {
      await fetch('../api/index.php?route=auth&action=logout');
      showToast('Đã đăng xuất', 'info');
      setTimeout(() => window.location.reload(), 400);
    } catch (e) { window.location.reload(); }
  }

  /* ================= UTILITIES ================= */
  function showToast(message, type = 'info') {
    const container = document.getElementById('mgr-toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `mgr-toast mgr-toast-${type}`;
    const icon = type === 'success' ? '✅' : (type === 'error' ? '❌' : 'ℹ️');
    toast.innerHTML = `<span>${icon}</span><span>${_escape(message)}</span>`;

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  function _escape(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Public API
  return {
    init,
    switchTab,
    openModal,
    closeModal,
    openForkModal,
    toggleRecommend,
    deleteUserChordSet,
    editCategory,
    deleteCategory,
    updateUserRole,
    resetUserPass,
    deleteUser,
    showToast
  };
})();

// Bootstrap on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  ManagerApp.init();
});
