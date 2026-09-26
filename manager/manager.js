/**
 * sheet.hyb.io.vn/manager/manager.js — v2.2.0
 * Comprehensive Workstation for Song Search, Selection, Custom Chords, and Account Management
 * Coordinator: Delegates to ManagerRepertoire, ManagerCommunity, ManagerVersions, ManagerUsers.
 */
'use strict';

const ManagerApp = (() => {
  // Application State (Shared across modules)
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
      keyword: '',
      debounceTimer: null
    },
    community: {
      sets: [],
      instrument: '',
      author: '',
      recommendedOnly: false,
      keyword: ''
    },
    versions: {
      items: [],
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
    const ctx = {
      state,
      showToast,
      switchTab,
      openModal,
      closeModal,
      selectSong,
      loadStats,
      loadMyContributions: () => window.ManagerUsers?.loadMyContributions?.()
    };
    window.ManagerRepertoire?.init(ctx);
    window.ManagerCommunity?.init(ctx);
    window.ManagerVersions?.init(ctx);
    window.ManagerUsers?.init(ctx);
    window.ManagerUsage?.init(ctx);
    window.ManagerReviews?.init(ctx);
    window.ManagerNotifications?.init(ctx);

    _bindEvents();

    if (window.FeatureFlags) {
      if (!window.FeatureFlags.get('REVIEW_WORKFLOW')) {
        const revNav = document.getElementById('mgr-nav-tab-reviews');
        if (revNav) revNav.style.display = 'none';
        const revTab = document.getElementById('tab-reviews');
        if (revTab) revTab.style.display = 'none';
      }
      if (!window.FeatureFlags.get('USAGE_REPORT')) {
        const usageNav = document.getElementById('mgr-nav-tab-usage');
        if (usageNav) usageNav.style.display = 'none';
        const usageTab = document.getElementById('tab-usage');
        if (usageTab) usageTab.style.display = 'none';
      }
    }

    await window.ManagerUsers?.checkCurrentUser?.();
    await _loadInitialData();

    // Check URL parameters for direct song selection (e.g. ?select=thanh-ca-001)
    const urlParams = new URLSearchParams(window.location.search);
    const selectId = urlParams.get('select') || urlParams.get('song');
    if (selectId) {
      selectSong(selectId);
    }

    // Check URL parameters or hash for direct tab switching (e.g. #tab-users or ?tab=tab-users)
    const tabTarget = urlParams.get('tab') || window.location.hash.replace('#', '');
    if (tabTarget && document.getElementById(tabTarget)) {
      switchTab(tabTarget);
    }

    window.addEventListener('hashchange', () => {
      const hash = window.location.hash.replace('#', '');
      if (hash && document.getElementById(hash)) {
        switchTab(hash);
      }
    });
  }

  async function _loadInitialData() {
    await Promise.all([
      loadStats(),
      window.ManagerRepertoire?.loadCategories?.(),
      window.ManagerRepertoire?.loadRepertoire?.(),
      window.ManagerCommunity?.loadCommunityChords?.(),
      window.ManagerVersions?.loadVersions?.(),
      window.ManagerUsers?.loadUsers?.(),
      window.ManagerReviews?.loadQueue?.()
    ]);
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
            window.ManagerRepertoire?.searchFast?.(q, globalDropdown);
          }, 200);
        } else {
          globalDropdown?.classList.add('hidden');
        }

        // Also debounce table filter if search query changes
        clearTimeout(state.repertoire.debounceTimer);
        state.repertoire.debounceTimer = setTimeout(() => {
          state.repertoire.keyword = q;
          state.community.keyword = q;
          state.versions.keyword = q;
          state.repertoire.offset = 0;
          if (state.activeTab === 'tab-community') {
            window.ManagerCommunity?.loadCommunityChords?.();
          } else if (state.activeTab === 'tab-versions') {
            window.ManagerVersions?.loadVersions?.();
          } else {
            window.ManagerRepertoire?.loadRepertoire?.();
          }
        }, 350);
      });

      clearBtn?.addEventListener('click', () => {
        globalSearchInput.value = '';
        clearBtn.classList.add('hidden');
        globalDropdown?.classList.add('hidden');
        state.repertoire.keyword = '';
        state.community.keyword = '';
        state.versions.keyword = '';
        state.repertoire.offset = 0;
        window.ManagerRepertoire?.loadRepertoire?.();
        window.ManagerCommunity?.loadCommunityChords?.();
        window.ManagerVersions?.loadVersions?.();
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
            window.ManagerRepertoire?.searchFast?.(q, pickerResults);
          }, 180);
        } else {
          pickerResults?.classList.add('hidden');
        }
      });

      pickerInput.addEventListener('focus', () => {
        const q = pickerInput.value.trim();
        if (q.length >= 1) {
          window.ManagerRepertoire?.searchFast?.(q, pickerResults);
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

    document.getElementById('btn-save-song-cat')?.addEventListener('click', () => window.ManagerRepertoire?.handleSaveSongCategory?.());

    document.getElementById('btn-sel-song-fork')?.addEventListener('click', () => {
      if (state.selectedSong) {
        window.ManagerCommunity?.openForkModal?.(state.selectedSong.id, state.selectedSong.title);
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
      window.ManagerRepertoire?.loadRepertoire?.();
    });

    // Only has chords checkbox
    document.getElementById('chk-only-has-chords')?.addEventListener('change', (e) => {
      state.repertoire.onlyHasChords = e.target.checked;
      window.ManagerRepertoire?.renderRepertoire?.();
    });

    // 6. Community Filters
    document.getElementById('mgr-instrument-pills')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.mgr-pill');
      if (!btn) return;
      document.querySelectorAll('#mgr-instrument-pills .mgr-pill').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      state.community.instrument = btn.dataset.inst || '';
      window.ManagerCommunity?.loadCommunityChords?.();
    });

    document.getElementById('mgr-author-chips')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.mgr-pill');
      if (!btn) return;
      document.querySelectorAll('#mgr-author-chips .mgr-pill').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      state.community.author = btn.dataset.author || '';
      window.ManagerCommunity?.loadCommunityChords?.();
    });

    document.getElementById('chk-recommended-only')?.addEventListener('change', (e) => {
      state.community.recommendedOnly = e.target.checked;
      window.ManagerCommunity?.loadCommunityChords?.();
    });

    // 7. Pagination
    document.getElementById('btn-prev-page')?.addEventListener('click', () => {
      if (state.repertoire.offset >= state.repertoire.limit) {
        state.repertoire.offset -= state.repertoire.limit;
        window.ManagerRepertoire?.loadRepertoire?.();
      }
    });

    document.getElementById('btn-next-page')?.addEventListener('click', () => {
      if (state.repertoire.offset + state.repertoire.limit < state.repertoire.total) {
        state.repertoire.offset += state.repertoire.limit;
        window.ManagerRepertoire?.loadRepertoire?.();
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
    document.getElementById('btn-quick-fork')?.addEventListener('click', () => window.ManagerCommunity?.openForkModal?.());
    document.getElementById('form-fork-song')?.addEventListener('submit', (e) => window.ManagerCommunity?.handleForkSubmit?.(e));

    // Searchable song input inside Fork modal
    const forkSongSearch = document.getElementById('fork-song-search');
    const forkSongResults = document.getElementById('fork-song-results');
    if (forkSongSearch) {
      forkSongSearch.addEventListener('input', (e) => {
        const q = e.target.value.trim();
        clearTimeout(state.forkDebounceTimer);
        if (q.length >= 1) {
          state.forkDebounceTimer = setTimeout(() => {
            window.ManagerRepertoire?.searchFast?.(q, forkSongResults, (selected) => {
              window.ManagerCommunity?.setForkSelectedSong?.(selected.id, selected.title, selected.httlvnId);
            });
          }, 180);
        } else {
          forkSongResults?.classList.add('hidden');
        }
      });
    }

    document.getElementById('btn-clear-fork-song')?.addEventListener('click', () => {
      const fId = document.getElementById('fork-song-id');
      const fSearch = document.getElementById('fork-song-search');
      if (fId) fId.value = '';
      if (fSearch) {
        fSearch.value = '';
        fSearch.classList.remove('hidden');
        fSearch.focus();
      }
      document.getElementById('fork-selected-song-badge')?.classList.add('hidden');
    });

    // Auth Triggers
    document.getElementById('mgr-btn-login-modal')?.addEventListener('click', () => openModal('modal-login'));
    document.getElementById('mgr-btn-register-modal')?.addEventListener('click', () => openModal('modal-register'));
    document.getElementById('link-switch-to-register')?.addEventListener('click', () => {
      closeModal('modal-login');
      openModal('modal-register');
    });

    document.getElementById('form-mgr-login')?.addEventListener('submit', (e) => window.ManagerUsers?.handleLoginSubmit?.(e));
    document.getElementById('form-register-user')?.addEventListener('submit', (e) => window.ManagerUsers?.handleRegisterSubmit?.(e));
    document.getElementById('mgr-btn-logout')?.addEventListener('click', () => window.ManagerUsers?.handleLogout?.());

    // Profile Modal
    document.getElementById('btn-open-profile')?.addEventListener('click', () => window.ManagerUsers?.openProfileModal?.());
    document.getElementById('form-update-profile')?.addEventListener('submit', (e) => window.ManagerUsers?.handleUpdateProfileSubmit?.(e));

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
    document.getElementById('form-create-user')?.addEventListener('submit', (e) => window.ManagerUsers?.handleCreateUserSubmit?.(e));
    document.getElementById('form-edit-user')?.addEventListener('submit', (e) => window.ManagerUsers?.handleEditUserSubmit?.(e));

    document.getElementById('btn-add-category-modal')?.addEventListener('click', () => {
      document.getElementById('cat-modal-title').textContent = '📂 Thêm Thể Loại Mới';
      document.getElementById('cat-edit-id').value = '';
      document.getElementById('cat-edit-name').value = '';
      document.getElementById('cat-edit-desc').value = '';
      document.getElementById('cat-edit-icon').value = '🎵';
      openModal('modal-category');
    });
    document.getElementById('form-manage-category')?.addEventListener('submit', (e) => window.ManagerRepertoire?.handleCategorySubmit?.(e));

    // Tab 3 MusicXML Versions triggers
    document.getElementById('btn-tab-create-version')?.addEventListener('click', () => {
      window.ManagerCommunity?.openForkModal?.('', '', 'score_version');
    });

    document.getElementById('btn-sel-song-xml-fork')?.addEventListener('click', () => {
      if (state.selectedSong) {
        window.ManagerCommunity?.openForkModal?.(state.selectedSong.id, state.selectedSong.title, 'score_version');
      }
    });

    document.getElementById('chk-ver-recommended-only')?.addEventListener('change', (e) => {
      state.versions.recommendedOnly = e.target.checked;
      window.ManagerVersions?.loadVersions?.();
    });

    // Reset password modal form
    document.getElementById('form-reset-pass')?.addEventListener('submit', (e) => window.ManagerUsers?.handleResetPassSubmit?.(e));
  }

  /* ================= COMMON UTILITIES & MODAL CONTROLS ================= */
  function switchTab(tabId) {
    if (!tabId) return;
    state.activeTab = tabId;

    document.querySelectorAll('.mgr-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });

    document.querySelectorAll('.mgr-tab-pane').forEach(pane => {
      pane.classList.toggle('active', pane.id === tabId);
    });

    if (window.location.hash !== '#' + tabId) {
      history.replaceState(null, '', '#' + tabId);
    }

    if (tabId === 'tab-usage') {
      window.ManagerUsage?.loadUsageReport?.();
    } else if (tabId === 'tab-reviews') {
      window.ManagerReviews?.loadQueue?.();
    }
  }

  function openModal(modalId) {
    window.ModalManager ? window.ModalManager.open(modalId) : document.getElementById(modalId)?.classList.remove('hidden');
  }

  function closeModal(modalId) {
    window.ModalManager ? window.ModalManager.close(modalId) : document.getElementById(modalId)?.classList.add('hidden');
  }

  async function loadStats() {
    try {
      const res = await window.ApiService.manager.stats();
      const statsData = res.stats || (res.total_songs !== undefined ? res : null);
      if (res.success && statsData) {
        state.stats = statsData;
        _renderStats(statsData);
      }
    } catch (e) {}
  }

  function _renderStats(data) {
    const kpiSongs  = document.getElementById('kpi-total-songs');
    const kpiChords = document.getElementById('kpi-total-chords');
    const kpiVers   = document.getElementById('kpi-total-vers');
    const kpiUsers  = document.getElementById('kpi-total-users');
    const kpiCats   = document.getElementById('kpi-total-cats');

    if (kpiSongs)  kpiSongs.textContent  = data.total_songs || 0;
    if (kpiChords) kpiChords.textContent = data.total_user_chord_sets ?? data.total_chord_sets ?? 0;
    if (kpiVers)   kpiVers.textContent   = data.total_song_versions ?? data.total_versions ?? 0;
    if (kpiUsers)  kpiUsers.textContent  = data.total_users || 0;
    if (kpiCats)   kpiCats.textContent   = data.total_categories || 0;
  }

  function showToast(message, type = 'info') {
    const container = document.getElementById('mgr-toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `mgr-toast ${type}`;
    const icon = type === 'success' ? '✅' : (type === 'error' ? '❌' : 'ℹ️');
    toast.innerHTML = `<span>${icon}</span><span>${_escape(message)}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'toastOut 0.3s ease forwards';
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  function _escape(str) {
    return window.SafeHtml ? window.SafeHtml.escape(str) : (str ?? '');
  }

  function _escapeInlineJs(str) {
    return window.SafeHtml ? window.SafeHtml.inlineJsString(str) : String(str ?? '').replace(/'/g, "\\'");
  }

  function selectSong(songId) {
    return window.ManagerRepertoire?.selectSong?.(songId);
  }

  // Public API
  return {
    state,
    init,
    switchTab,
    selectSong,
    openModal,
    closeModal,
    openForkModal: (songId, title, type) => window.ManagerCommunity?.openForkModal?.(songId, title, type),
    openProfileModal: () => window.ManagerUsers?.openProfileModal?.(),
    toggleRecommend: (setId) => window.ManagerCommunity?.toggleRecommend?.(setId),
    deleteUserChordSet: (setId, name) => window.ManagerCommunity?.deleteUserChordSet?.(setId, name),
    loadVersions: () => window.ManagerVersions?.loadVersions?.(),
    deleteVersion: (vId, name) => window.ManagerVersions?.deleteVersion?.(vId, name),
    toggleVersionRecommend: (vId) => window.ManagerVersions?.toggleVersionRecommend?.(vId),
    filterByCategory: (catId) => window.ManagerRepertoire?.filterByCategory?.(catId),
    editCategory: (id, name, icon, desc) => window.ManagerRepertoire?.editCategory?.(id, name, icon, desc),
    deleteCategory: (id) => window.ManagerRepertoire?.deleteCategory?.(id),
    updateUserRole: (uId, role) => window.ManagerUsers?.updateUserRole?.(uId, role),
    resetUserPass: (uId, uName) => window.ManagerUsers?.resetUserPass?.(uId, uName),
    toggleUserStatus: (uId, uName) => window.ManagerUsers?.toggleUserStatus?.(uId, uName),
    deleteUser: (uId, uName) => window.ManagerUsers?.deleteUser?.(uId, uName),
    openEditUserModal: (u) => window.ManagerUsers?.openEditUserModal?.(u),
    showToast,
    loadStats
  };
})();

// Bootstrap on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  ManagerApp.init();
});
