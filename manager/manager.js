/**
 * sheet.hyb.io.vn/manager/manager.js — v2.1.0
 * Comprehensive Workstation for Song Search, Selection, Custom Chords, and Account Management
 */
'use strict';

const ManagerApp = (() => {
  // Application State
  const state = {
    activeTab: 'tab-repertoire',
    currentUser: { logged_in: false, user_id: null, username: '', role: 'viewer', display_name: '', instrument: 'Guitar' },
    selectedSong: null,
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
    myContributions: {
      chord_sets: [],
      versions: [],
      profile: {}
    },
    searchDebounceTimer: null,
    pickerDebounceTimer: null,
    forkDebounceTimer: null
  };

  /* ================= INITIALIZATION & BINDING ================= */
  async function init() {
    _bindEvents();
    await _checkCurrentUser();
    await _loadInitialData();

    // Check URL parameters for direct song selection (e.g. ?select=thanh-ca-001)
    const urlParams = new URLSearchParams(window.location.search);
    const selectId = urlParams.get('select') || urlParams.get('song');
    if (selectId) {
      selectSong(selectId);
    }
  }

  function _bindEvents() {
    // 1. Tab Switching
    document.querySelectorAll('.mgr-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        switchTab(btn.dataset.tab);
      });
    });

    // KPI Card Click jumps to tab
    document.querySelectorAll('.mgr-kpi-card').forEach(card => {
      card.addEventListener('click', () => {
        const target = card.dataset.tabTarget;
        if (target) switchTab(target);
      });
    });

    // 2. Global Search with Autocomplete Dropdown
    const globalSearchInput = document.getElementById('mgr-global-search');
    const globalDropdown    = document.getElementById('mgr-search-dropdown');
    const clearBtn          = document.getElementById('mgr-search-clear');

    if (globalSearchInput) {
      globalSearchInput.addEventListener('input', (e) => {
        const q = e.target.value.trim();
        clearBtn?.classList.toggle('hidden', q === '');

        clearTimeout(state.searchDebounceTimer);
        if (q.length >= 1) {
          state.searchDebounceTimer = setTimeout(() => {
            _searchFast(q, globalDropdown);
          }, 200);
        } else {
          globalDropdown?.classList.add('hidden');
        }

        // Also debounce table filter if search query changes
        clearTimeout(state.repertoire.debounceTimer);
        state.repertoire.debounceTimer = setTimeout(() => {
          state.repertoire.keyword = q;
          state.community.keyword = q;
          state.repertoire.offset = 0;
          if (state.activeTab === 'tab-community') {
            loadCommunityChords();
          } else {
            loadRepertoire();
          }
        }, 350);
      });

      clearBtn?.addEventListener('click', () => {
        globalSearchInput.value = '';
        clearBtn.classList.add('hidden');
        globalDropdown?.classList.add('hidden');
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
          globalSearchInput.focus();
          globalSearchInput.select();
        }
      });
    }

    // 3. Dedicated Song Picker Autocomplete Input
    const pickerInput   = document.getElementById('mgr-picker-input');
    const pickerResults = document.getElementById('mgr-picker-results');
    if (pickerInput) {
      pickerInput.addEventListener('input', (e) => {
        const q = e.target.value.trim();
        clearTimeout(state.pickerDebounceTimer);
        if (q.length >= 1) {
          state.pickerDebounceTimer = setTimeout(() => {
            _searchFast(q, pickerResults);
          }, 180);
        } else {
          pickerResults?.classList.add('hidden');
        }
      });

      pickerInput.addEventListener('focus', () => {
        const q = pickerInput.value.trim();
        if (q.length >= 1) {
          _searchFast(q, pickerResults);
        }
      });
    }

    // Close search dropdowns when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.mgr-search-box')) {
        globalDropdown?.classList.add('hidden');
      }
      if (!e.target.closest('.mgr-picker-search-wrap')) {
        pickerResults?.classList.add('hidden');
      }
      if (!e.target.closest('.searchable-song-input-wrap')) {
        document.getElementById('fork-song-results')?.classList.add('hidden');
      }
    });

    // 4. Selected Song Inspector Actions
    document.getElementById('btn-close-song-panel')?.addEventListener('click', () => {
      document.getElementById('mgr-selected-song-panel')?.classList.add('hidden');
      state.selectedSong = null;
    });

    document.getElementById('btn-save-song-cat')?.addEventListener('click', _handleSaveSongCategory);

    document.getElementById('btn-sel-song-fork')?.addEventListener('click', () => {
      if (state.selectedSong) {
        openForkModal(state.selectedSong.id, state.selectedSong.title);
      }
    });

    // 5. Category Filter Pills
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

    // 6. Community Filters
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

    // 7. Pagination
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

    // 8. Modals Close Handlers
    document.querySelectorAll('.mgr-modal-close, [data-close]').forEach(btn => {
      btn.addEventListener('click', () => {
        const modalId = btn.dataset.close || btn.closest('.mgr-modal-overlay')?.id;
        if (modalId) closeModal(modalId);
      });
    });

    document.querySelectorAll('.mgr-modal-overlay').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal(modal.id);
      });
    });

    // 9. Quick Actions & Auth Modals
    document.getElementById('btn-quick-fork')?.addEventListener('click', () => openForkModal());
    document.getElementById('form-fork-song')?.addEventListener('submit', _handleForkSubmit);

    // Searchable song input inside Fork modal
    const forkSongSearch = document.getElementById('fork-song-search');
    const forkSongResults = document.getElementById('fork-song-results');
    if (forkSongSearch) {
      forkSongSearch.addEventListener('input', (e) => {
        const q = e.target.value.trim();
        clearTimeout(state.forkDebounceTimer);
        if (q.length >= 1) {
          state.forkDebounceTimer = setTimeout(() => {
            _searchFast(q, forkSongResults, (selected) => {
              _setForkSelectedSong(selected.id, selected.title, selected.httlvnId);
            });
          }, 180);
        } else {
          forkSongResults?.classList.add('hidden');
        }
      });
    }

    document.getElementById('btn-clear-fork-song')?.addEventListener('click', () => {
      document.getElementById('fork-song-id').value = '';
      document.getElementById('fork-song-search').value = '';
      document.getElementById('fork-selected-song-badge').classList.add('hidden');
      document.getElementById('fork-song-search').classList.remove('hidden');
      document.getElementById('fork-song-search').focus();
    });

    // Auth Trigger
    document.getElementById('mgr-btn-login-modal')?.addEventListener('click', () => openModal('modal-login'));
    document.getElementById('mgr-btn-register-modal')?.addEventListener('click', () => openModal('modal-register'));
    document.getElementById('link-switch-to-register')?.addEventListener('click', () => {
      closeModal('modal-login');
      openModal('modal-register');
    });

    document.getElementById('form-mgr-login')?.addEventListener('submit', _handleLoginSubmit);
    document.getElementById('form-register-user')?.addEventListener('submit', _handleRegisterSubmit);
    document.getElementById('mgr-btn-logout')?.addEventListener('click', _handleLogout);

    // Profile Modal
    document.getElementById('btn-open-profile')?.addEventListener('click', openProfileModal);
    document.getElementById('form-update-profile')?.addEventListener('submit', _handleUpdateProfileSubmit);

    document.querySelectorAll('.profile-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const ptab = btn.dataset.ptab;
        document.querySelectorAll('.profile-tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.profile-tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(ptab)?.classList.add('active');
      });
    });

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

  /* ================= FAST SEARCH & AUTOCOMPLETE ENGINE ================= */
  async function _searchFast(keyword, containerEl, onSelectCallback = null) {
    if (!containerEl) return;

    try {
      const r = await fetch('../api/index.php?route=manager&action=search_songs&q=' + encodeURIComponent(keyword));
      const res = await r.json();

      if (res.success && res.songs && res.songs.length > 0) {
        let html = '';
        res.songs.forEach(song => {
          html += `
            <div class="search-result-item" data-id="${song.id}">
              <div class="res-item-left">
                <span class="res-item-num">#${song.httlvnId || '—'}</span>
                <span class="res-item-title">${_escape(song.title)}</span>
              </div>
              <div class="res-item-right">
                <span class="key-badge" style="font-size:0.75rem;">${song.defaultKey || 'G'}</span>
                ${song.chord_sets_count > 0 ? `<span class="res-item-chords-badge">🎸 ${song.chord_sets_count} bản</span>` : ''}
              </div>
            </div>
          `;
        });
        containerEl.innerHTML = html;
        containerEl.classList.remove('hidden');

        // Bind clicks
        containerEl.querySelectorAll('.search-result-item').forEach(item => {
          item.addEventListener('click', () => {
            const sid = item.dataset.id;
            const songObj = res.songs.find(s => s.id === sid);
            containerEl.classList.add('hidden');

            if (onSelectCallback) {
              onSelectCallback(songObj);
            } else {
              selectSong(sid);
            }
          });
        });

      } else {
        containerEl.innerHTML = `<div style="padding:0.85rem; text-align:center; color:var(--text-muted); font-size:0.85rem;">Không tìm thấy bài hát nào khớp với "${_escape(keyword)}"</div>`;
        containerEl.classList.remove('hidden');
      }
    } catch (e) {
      console.error('Fast search error:', e);
    }
  }

  /* ================= SONG SELECTION & INSPECTOR ================= */
  async function selectSong(songId) {
    if (!songId) return;

    const panel = document.getElementById('mgr-selected-song-panel');
    if (panel) {
      panel.classList.remove('hidden');
      panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // Set loading indicator
    document.getElementById('sel-song-title').textContent = 'Đang nạp chi tiết bài hát...';
    document.getElementById('sel-song-chords-grid').innerHTML = '<div class="mgr-table-loading" style="grid-column:1/-1;"><div class="mgr-spinner"></div><p>Đang tải hợp âm của bài...</p></div>';

    try {
      const r = await fetch('../api/index.php?route=manager&action=song_details&song_id=' + encodeURIComponent(songId));
      const song = await r.json();

      if (song.success && song.id) {
        state.selectedSong = song;
        _renderSelectedSongPanel(song);
      } else {
        showToast('Không tìm thấy thông tin bài hát', 'error');
      }
    } catch (e) {
      showToast('Lỗi khi nạp chi tiết bài hát', 'error');
    }
  }

  function _renderSelectedSongPanel(song) {
    document.getElementById('sel-song-num').textContent = `#${song.httlvnId || '—'}`;
    document.getElementById('sel-song-key').textContent = song.defaultKey || 'G';
    document.getElementById('sel-song-title').textContent = song.title;
    document.getElementById('sel-song-id').textContent = song.id;
    document.getElementById('sel-song-xml').textContent = song.xmlPath || '';
    document.getElementById('sel-song-cat-badge').textContent = `${song.category_icon || '🎵'} ${song.category_name || 'Thánh Ca'}`;

    // Links
    document.getElementById('btn-sel-song-sheet').href = `../index.php?song=${encodeURIComponent(song.id)}`;
    document.getElementById('btn-sel-song-live').href  = `../live-band/?song=${encodeURIComponent(song.id)}`;

    // Populate Category Selector
    const catSelect = document.getElementById('sel-song-cat-select');
    if (catSelect && state.categories) {
      catSelect.innerHTML = state.categories.map(c =>
        `<option value="${c.id}" ${c.id == song.category_id ? 'selected' : ''}>${c.icon || '🎵'} ${c.name}</option>`
      ).join('');
    }

    // Render All Chords of this Song
    const chordsGrid = document.getElementById('sel-song-chords-grid');
    if (!chordsGrid) return;

    let html = '';

    // 1. Master HD Preset
    html += `
      <div class="song-chord-card master-card">
        <div class="song-chord-card-title">
          <span>⭐ Bản Chuẩn Ban Hát (HD)</span>
          <span class="card-badge" style="background:#fef3c7; color:#b45309;">Hội Thánh</span>
        </div>
        <div class="song-chord-card-meta">
          Bộ hợp âm mẫu mực được biên tập chuẩn cho hội thánh và ban hát.
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:auto; padding-top:0.5rem;">
          <span class="card-badge badge-chord-count">● ${song.master_hd_chord_count || 12} hợp âm</span>
          <a href="../index.php?song=${encodeURIComponent(song.id)}&set=HD" class="mgr-btn mgr-btn-primary mgr-btn-xs">
            👁️ Mở Sheet HD
          </a>
        </div>
      </div>
    `;

    // 2. User Created Chord Sets
    const userChords = song.user_chord_sets || [];
    const currentUserId = state.currentUser.user_id;
    const isAdmin = state.currentUser.role === 'admin';
    const isBanhat = state.currentUser.role === 'banhat' || isAdmin;

    userChords.forEach(c => {
      const isOwner = currentUserId && (c.user_id == currentUserId);
      const canManage = isOwner || isAdmin;
      const isRec = c.is_recommended == 1;
      const instIcon = c.instrument_type === 'piano' ? '🎹 Piano' : (c.instrument_type === 'bass' ? '🎻 Bass' : '🎸 Guitar');
      const safeDiskName = c.username + '__' + c.set_name.replace(/[^a-zA-Z0-9_\-]/g, '_');

      html += `
        <div class="song-chord-card ${isRec ? 'card-recommended' : ''}">
          <div class="song-chord-card-title">
            <span>${isRec ? '⭐ ' : ''}${_escape(c.set_name)}</span>
            <span class="card-badge">${instIcon}</span>
          </div>
          <div class="song-chord-card-meta">
            👤 Soạn bởi: <strong>@${_escape(c.username)}</strong> (${_escape(c.display_name || c.username)})<br>
            ${c.capo_fret > 0 ? `<span class="badge-capo">Capo ${c.capo_fret}</span> • ` : ''}
            <span>${c.chord_count || 0} hợp âm</span>
          </div>
          ${c.notes_guide ? `<div class="card-notes-guide" style="font-size:0.75rem; padding:0.35rem 0.5rem;">"${_escape(c.notes_guide)}"</div>` : ''}

          <div style="display:flex; gap:0.4rem; align-items:center; margin-top:auto; padding-top:0.5rem; border-top:1px solid var(--border);">
            <a href="../index.php?song=${encodeURIComponent(song.id)}&set=${encodeURIComponent(safeDiskName)}" class="mgr-btn mgr-btn-primary mgr-btn-xs" style="flex:1;">
              👁️ Mở Sheet
            </a>
            ${isBanhat ? `
              <button class="mgr-btn mgr-btn-ghost mgr-btn-xs ${isRec ? 'text-accent' : ''}" 
                      title="${isRec ? 'Bỏ ghim' : 'Ghim khuyên dùng'}"
                      onclick="ManagerApp.toggleRecommend(${c.id})">
                ${isRec ? '⭐' : '☆'}
              </button>
            ` : ''}
            ${canManage ? `
              <button class="mgr-btn mgr-btn-ghost mgr-btn-xs text-danger" 
                      title="Xóa bộ này"
                      onclick="ManagerApp.deleteUserChordSet(${c.id}, '${_escape(c.set_name)}')">
                ✕
              </button>
            ` : ''}
          </div>
        </div>
      `;
    });

    // 3. New Chord Set Action Card
    html += `
      <div class="song-chord-card" style="border: 1px dashed var(--accent); background: rgba(139, 92, 246, 0.04); align-items: center; justify-content: center; text-align: center; cursor: pointer;"
           onclick="ManagerApp.openForkModal('${song.id}', '${_escape(song.title)}')">
        <span style="font-size: 1.75rem;">➕</span>
        <strong style="color: var(--accent); font-size: 0.9rem;">Tạo Bản Phối Hợp Âm Mới</strong>
        <span class="text-xs text-muted">Nhân bản an toàn từ bản gốc để tùy biến theo phong cách của bạn</span>
      </div>
    `;

    chordsGrid.innerHTML = html;
  }

  async function _handleSaveSongCategory() {
    if (!state.selectedSong) return;

    const catSelect = document.getElementById('sel-song-cat-select');
    const newCatId  = parseInt(catSelect.value);

    try {
      const r = await fetch('../api/index.php?route=manager&action=update_song_category', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ song_id: state.selectedSong.id, category_id: newCatId })
      });
      const res = await r.json();

      if (res.success) {
        showToast('Đã cập nhật thể loại cho bài hát!', 'success');
        const catObj = state.categories.find(c => c.id == newCatId);
        if (catObj) {
          document.getElementById('sel-song-cat-badge').textContent = `${catObj.icon || '🎵'} ${catObj.name}`;
        }
        loadRepertoire();
        loadStats();
      } else {
        showToast(res.message || 'Lỗi cập nhật thể loại', 'error');
      }
    } catch (e) {
      showToast('Lỗi mạng', 'error');
    }
  }

  /* ================= DATA LOADING ================= */
  async function _checkCurrentUser() {
    try {
      const r = await fetch('../api/index.php?route=auth&action=me');
      const res = await r.json();
      if (res.success && res.loggedIn) {
        state.currentUser = {
          logged_in: true,
          user_id: res.user_id,
          username: res.username,
          role: res.role,
          display_name: res.display_name || res.username,
          instrument: res.instrument || 'Guitar'
        };
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
    } catch (e) {}
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
    } catch (e) {}
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
      tbody.innerHTML = `<tr><td colspan="6" class="mgr-table-loading"><div class="mgr-spinner"></div><p>Đang tải danh sách bài hát...</p></td></tr>`;
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
      if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="mgr-table-loading text-danger">Lỗi nạp kho bài hát.</td></tr>`;
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
      tbody.innerHTML = `<tr><td colspan="6" class="mgr-table-loading"><p>Không tìm thấy bài hát nào phù hợp với bộ lọc.</p></td></tr>`;
      return;
    }

    let html = '';
    songs.forEach(song => {
      const userChords = song.user_chord_sets || [];

      let chordChipsHtml = '';
      if (userChords.length > 0) {
        chordChipsHtml = userChords.map(c => {
          const isRec = c.is_recommended == 1;
          const instIcon = c.instrument_type === 'piano' ? '🎹' : (c.instrument_type === 'bass' ? '🎻' : '🎸');
          const safeDiskName = c.username + '__' + c.set_name.replace(/[^a-zA-Z0-9_\-]/g, '_');
          return `
            <a href="../index.php?song=${encodeURIComponent(song.id)}&set=${encodeURIComponent(safeDiskName)}" 
               class="user-chord-chip ${isRec ? 'chip-recommended' : ''}" 
               title="${isRec ? '⭐ Khuyên Dùng: ' : ''}${_escape(c.set_name)} (Capo ${c.capo_fret || 0}) — @${_escape(c.username)}">
              <span>${isRec ? '⭐' : instIcon}</span>
              <span>${_escape(c.set_name)}</span>
              <span class="chip-author">@${_escape(c.username)}</span>
            </a>
          `;
        }).join('');
      } else {
        chordChipsHtml = '<span class="text-muted text-xs">Chưa có bản phối</span>';
      }

      html += `
        <tr style="cursor:pointer;" onclick="ManagerApp.selectSong('${song.id}')">
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
          <td style="text-align:right;" onclick="event.stopPropagation()">
            <div class="table-actions">
              <button class="mgr-btn mgr-btn-primary mgr-btn-xs" onclick="ManagerApp.openForkModal('${song.id}', '${_escape(song.title)}')">
                ✨ Clone & Phối
              </button>
              <button class="mgr-btn mgr-btn-ghost mgr-btn-xs" onclick="ManagerApp.selectSong('${song.id}')">
                🎯 Chọn Bài
              </button>
              <a href="../index.php?song=${encodeURIComponent(song.id)}" class="mgr-btn mgr-btn-ghost mgr-btn-xs" title="Xem Sheet">
                👁️
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
      grid.innerHTML = `<div class="mgr-table-loading" style="grid-column: 1/-1;"><div class="mgr-spinner"></div><p>Đang nạp các bộ hợp âm đóng góp...</p></div>`;
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
      if (grid) grid.innerHTML = `<div class="mgr-table-loading text-danger" style="grid-column:1/-1;">Lỗi nạp bộ hợp âm.</div>`;
    }
  }

  function renderCommunityGrid(sets) {
    const grid = document.getElementById('mgr-community-grid');
    if (!grid) return;

    if (sets.length === 0) {
      grid.innerHTML = `
        <div class="mgr-table-loading" style="grid-column: 1/-1;">
          <p>Chưa có bộ hợp âm cộng đồng nào phù hợp.</p>
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

          <div class="card-author-box">
            <div class="card-author-avatar">${(set.username || 'U').substring(0, 1).toUpperCase()}</div>
            <div class="card-author-meta">
              <span class="card-author-name">${_escape(set.display_name || set.username)}</span>
              <span class="card-author-desc">@${_escape(set.username)} • ${set.user_role === 'admin' ? '🛡️ Ban Trưởng' : '🎸 Nhạc Công'}</span>
            </div>
          </div>

          <div class="card-badges-row">
            <span class="card-badge">${instIcon}</span>
            <span class="card-badge badge-chord-count">● ${set.chord_count || 0} hợp âm</span>
            ${set.capo_fret > 0 ? `<span class="card-badge badge-capo">Capo ${set.capo_fret}</span>` : ''}
            <span class="card-badge">📅 ${dateFormatted}</span>
          </div>

          ${set.notes_guide ? `<div class="card-notes-guide">"${_escape(set.notes_guide)}"</div>` : ''}

          <div class="card-actions-row">
            <a href="../index.php?song=${encodeURIComponent(set.song_id)}&set=${encodeURIComponent(safeDiskName)}" class="mgr-btn mgr-btn-primary mgr-btn-xs" style="flex:1;">
              👁️ Mở Sheet
            </a>
            <button class="mgr-btn mgr-btn-ghost mgr-btn-xs" onclick="ManagerApp.selectSong('${set.song_id}')" title="Chọn bài hát này">
              🎯 Chi Tiết
            </button>
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
    } catch (e) {}
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

  /* ================= FORK MODAL & SUBMIT ================= */
  function openForkModal(songId = '', songTitle = '') {
    if (!state.currentUser.logged_in) {
      showToast('Vui lòng đăng nhập hoặc đăng ký để tạo bản phối!', 'info');
      openModal('modal-login');
      return;
    }

    if (songId) {
      _setForkSelectedSong(songId, songTitle);
    } else if (state.selectedSong) {
      _setForkSelectedSong(state.selectedSong.id, state.selectedSong.title, state.selectedSong.httlvnId);
    } else {
      document.getElementById('fork-song-id').value = '';
      document.getElementById('fork-song-search').value = '';
      document.getElementById('fork-selected-song-badge').classList.add('hidden');
      document.getElementById('fork-song-search').classList.remove('hidden');
    }

    // Default set name
    const setNameInput = document.getElementById('fork-set-name');
    if (setNameInput && !setNameInput.value) {
      const inst = document.getElementById('fork-instrument-select')?.value || 'Guitar';
      setNameInput.value = `Bản ${inst} của @${state.currentUser.username}`;
    }

    openModal('modal-fork');
  }

  function _setForkSelectedSong(songId, title, httlvnId = '') {
    document.getElementById('fork-song-id').value = songId;
    document.getElementById('fork-selected-song-name').textContent = `#${httlvnId || ''} ${title}`;
    document.getElementById('fork-selected-song-badge').classList.remove('hidden');
    document.getElementById('fork-song-search').classList.add('hidden');
    document.getElementById('fork-song-results')?.classList.add('hidden');
  }

  async function _handleForkSubmit(e) {
    e.preventDefault();

    const songId = document.getElementById('fork-song-id').value;
    if (!songId) {
      showToast('Vui lòng tìm và chọn bài hát cần tạo bản phối', 'error');
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

        loadStats();
        loadRepertoire();
        loadCommunityChords();

        // Refresh song details if currently selected
        if (state.selectedSong && state.selectedSong.id === songId) {
          selectSong(songId);
        }

        if (res.data?.redirect_url) {
          setTimeout(() => {
            window.location.href = '../' + res.data.redirect_url;
          }, 1000);
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

  /* ================= USER AUTH & PROFILE HANDLERS ================= */
  async function _handleRegisterSubmit(e) {
    e.preventDefault();
    const username    = document.getElementById('reg-username').value.trim();
    const displayName = document.getElementById('reg-display-name').value.trim();
    const password    = document.getElementById('reg-password').value;
    const instrument  = document.getElementById('reg-instrument').value;

    const btn = document.getElementById('btn-submit-register');
    if (btn) { btn.disabled = true; btn.textContent = 'Đang tạo tài khoản...'; }

    try {
      const r = await fetch('../api/index.php?route=auth&action=register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, display_name: displayName, instrument })
      });
      const res = await r.json();

      if (res.success) {
        showToast(res.message || 'Đăng ký thành công!', 'success');
        closeModal('modal-register');
        setTimeout(() => window.location.reload(), 600);
      } else {
        showToast(res.message || 'Lỗi đăng ký tài khoản', 'error');
      }
    } catch (e) {
      showToast('Lỗi mạng: ' + e.message, 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '🚀 Đăng Ký Tài Khoản'; }
    }
  }

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
        showToast(`Xin chào @${username}!`, 'success');
        closeModal('modal-login');
        setTimeout(() => window.location.reload(), 500);
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

  async function openProfileModal() {
    if (!state.currentUser.logged_in) return;

    document.getElementById('profile-username').value     = state.currentUser.username;
    document.getElementById('profile-display-name').value = state.currentUser.display_name;
    document.getElementById('profile-instrument').value   = state.currentUser.instrument;
    document.getElementById('profile-current-pass').value = '';
    document.getElementById('profile-new-pass').value     = '';

    openModal('modal-profile');
    // Reset to first tab
    document.querySelectorAll('.profile-tab-btn').forEach((b, i) => b.classList.toggle('active', i === 0));
    document.querySelectorAll('.profile-tab-content').forEach((c, i) => c.classList.toggle('active', i === 0));
    await _loadMyContributions();
  }

  async function _loadMyContributions() {
    const listEl = document.getElementById('my-contributions-list');
    if (listEl) listEl.innerHTML = '<div class="mgr-spinner"></div>';

    try {
      const r = await fetch('../api/index.php?route=manager&action=my_contributions');
      const res = await r.json();

      if (res.success) {
        state.myContributions = res;
        document.getElementById('my-chords-count').textContent = (res.chord_sets?.length || 0) + (res.versions?.length || 0);

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
                <button class="mgr-btn mgr-btn-ghost mgr-btn-xs text-danger" onclick="ManagerApp.deleteUserChordSet(${cs.id}, '${_escape(cs.set_name)}')">
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

  async function _handleUpdateProfileSubmit(e) {
    e.preventDefault();
    const displayName = document.getElementById('profile-display-name').value.trim();
    const instrument  = document.getElementById('profile-instrument').value.trim();
    const currentPass = document.getElementById('profile-current-pass').value;
    const newPass     = document.getElementById('profile-new-pass').value;

    try {
      const r = await fetch('../api/index.php?route=auth&action=update_profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: displayName,
          instrument,
          current_password: currentPass,
          new_password: newPass
        })
      });
      const res = await r.json();
      if (res.success) {
        showToast('Đã cập nhật hồ sơ cá nhân!', 'success');
        state.currentUser.display_name = displayName;
        state.currentUser.instrument = instrument;
        closeModal('modal-profile');
      } else {
        showToast(res.message || 'Lỗi cập nhật hồ sơ', 'error');
      }
    } catch (e) { showToast('Lỗi mạng', 'error'); }
  }

  /* ================= COMMON UTILITIES & MODAL CONTROLS ================= */
  function switchTab(tabId) {
    state.activeTab = tabId;

    document.querySelectorAll('.mgr-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });

    document.querySelectorAll('.mgr-tab-pane').forEach(pane => {
      pane.classList.toggle('active', pane.id === tabId);
    });

    if (tabId === 'tab-community') {
      loadCommunityChords();
    } else if (tabId === 'tab-users') {
      loadUsers();
    } else if (tabId === 'tab-repertoire' && state.repertoire.songs.length === 0) {
      loadRepertoire();
    }
  }

  function openModal(modalId) {
    const m = document.getElementById(modalId);
    if (m) m.classList.remove('hidden');
  }

  function closeModal(modalId) {
    const m = document.getElementById(modalId);
    if (m) m.classList.add('hidden');
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
        if (state.selectedSong) selectSong(state.selectedSong.id);
      } else {
        showToast(res.message || 'Lỗi', 'error');
      }
    } catch (e) { showToast('Lỗi mạng', 'error'); }
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
        if (state.selectedSong) selectSong(state.selectedSong.id);
        _loadMyContributions();
      } else {
        showToast(res.message || 'Lỗi khi xóa', 'error');
      }
    } catch (e) { showToast('Lỗi mạng', 'error'); }
  }

  /* ================= ADMIN MANAGEMENT ================= */
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
        body: JSON.stringify({ sub_action: 'create', username, password, display_name: displayName, instrument, role })
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
    } catch (e) { showToast('Lỗi mạng', 'error'); }
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

  /* ================= TOAST NOTIFICATION & ESCAPE ================= */
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
    selectSong,
    openModal,
    closeModal,
    openForkModal,
    openProfileModal,
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
