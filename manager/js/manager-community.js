/**
 * manager/js/manager-community.js — Community Chord Sets & Song Forking Engine
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

  /* ================= COMMUNITY CHORD SETS (TAB 2) ================= */
  async function loadCommunityChords() {
    const app = _getApp();
    const commState = app.state?.community;
    const grid = document.getElementById('mgr-community-grid');
    if (grid) {
      grid.innerHTML = `<div class="mgr-table-loading" style="grid-column: 1/-1;"><div class="mgr-spinner"></div><p>Đang nạp các bộ hợp âm đóng góp...</p></div>`;
    }

    try {
      const params = {
        instrument: commState ? commState.instrument || '' : '',
        username: commState ? commState.author || '' : '',
        recommended: commState?.recommendedOnly ? '1' : '0',
        q: commState ? commState.keyword || '' : ''
      };

      const res = await window.ApiService.manager.communityChords(params);
      if (res.success && res.sets) {
        if (commState) commState.sets = res.sets;
        renderCommunityGrid(res.sets);
      }
    } catch (e) {
      if (grid) grid.innerHTML = `<div class="mgr-table-loading text-danger" style="grid-column:1/-1;">Lỗi nạp bộ hợp âm.</div>`;
    }
  }

  function renderCommunityGrid(sets) {
    const app = _getApp();
    const grid = document.getElementById('mgr-community-grid');
    if (!grid) return;

    if (sets.length === 0) {
      grid.innerHTML = `
        <div class="mgr-table-loading" style="grid-column: 1/-1;">
          <p>Chưa có bộ hợp âm cộng đồng nào phù hợp.</p>
          <button class="mgr-btn mgr-btn-primary mgr-btn-sm" style="margin-top:0.75rem;" onclick="ManagerApp.openForkModal()">
            ✨ Tạo Bộ Hợp Âm Đầu Tiên
          </button>
        </div>`;
      return;
    }

    const currentUserId = app.state?.currentUser?.user_id;
    const isAdmin = app.state?.currentUser?.role === 'admin';
    const isBanhat = app.state?.currentUser?.role === 'banhat' || isAdmin;

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
            <div class="card-author-avatar">${_escape((set.username || 'U').substring(0, 1).toUpperCase())}</div>
            <div class="card-author-meta">
              <span class="card-author-name">${_escape(set.display_name || set.username)}</span>
              <span class="card-author-desc">@${_escape(set.username)} • ${set.user_role === 'admin' ? '🛡️ Ban Trưởng' : '🎸 Nhạc Công'}</span>
            </div>
          </div>

          <div class="card-badges-row">
            <span class="card-badge">${instIcon}</span>
            <span class="card-badge badge-chord-count">● ${set.chord_count || 0} hợp âm</span>
            ${set.capo_fret > 0 ? `<span class="card-badge badge-capo">Capo ${set.capo_fret}</span>` : ''}
            ${set.review_status === 'pending' ? '<span class="card-badge" style="background:rgba(59,130,246,0.15);color:#3b82f6;font-weight:600;">⏳ Chờ duyệt</span>' : ''}
            <span class="card-badge">📅 ${dateFormatted}</span>
          </div>

          ${set.notes_guide ? `<div class="card-notes-guide">"${_escape(set.notes_guide)}"</div>` : ''}

          <div class="card-actions-row">
            <a href="../index.php?song=${encodeURIComponent(set.song_id)}&set=${encodeURIComponent(safeDiskName)}" class="mgr-btn mgr-btn-primary mgr-btn-xs" style="flex:1;">👁️ Mở Sheet</a>
            <button class="mgr-btn mgr-btn-ghost mgr-btn-xs" onclick="ManagerApp.selectSong('${set.song_id}')" title="Chọn bài hát này">🎯 Chi Tiết</button>
            ${isOwner && set.review_status !== 'pending' ? `
              <button class="mgr-btn mgr-btn-ghost mgr-btn-xs" 
                      title="Gửi đề xuất phê duyệt cho Ca Trưởng"
                      onclick="window.ManagerReviews?.promptSubmitReview('chord_set', ${set.id}, '${_escapeInlineJs(set.set_name)}')">
                🚀 Duyệt
              </button>` : ''}
            ${isBanhat ? `
              <button class="mgr-btn mgr-btn-ghost mgr-btn-xs ${isRec ? 'text-accent' : ''}" 
                      title="${isRec ? 'Bỏ ghim khuyên dùng' : 'Ghim cho ban nhạc'}"
                      onclick="ManagerApp.toggleRecommend(${set.id})">
                ${isRec ? '⭐ Đã Ghim' : '☆ Ghim'}
              </button>` : ''}
            ${canManage ? `
              <button class="mgr-btn mgr-btn-ghost mgr-btn-xs text-danger" 
                      title="Xóa bộ này"
                      onclick="ManagerApp.deleteUserChordSet(${set.id}, '${_escapeInlineJs(set.set_name)}')">
                ✕
              </button>` : ''}
          </div>
        </div>
      `;
    });

    grid.innerHTML = html;
  }

  async function toggleRecommend(setId) {
    const app = _getApp();
    try {
      const res = await window.ApiService.manager.toggleRecommend({ chord_set_id: setId });
      if (res.success) {
        app.showToast(res.message, 'success');
        loadCommunityChords();
        if (app.state?.selectedSong) app.selectSong?.(app.state.selectedSong.id);
      } else {
        app.showToast(res.message || 'Lỗi', 'error');
      }
    } catch (e) {
      app.showToast('Lỗi mạng', 'error');
    }
  }

  async function deleteUserChordSet(setId, setName) {
    const app = _getApp();
    if (!confirm(`Bạn có chắc muốn xóa bộ hợp âm "${setName}" không? Thao tác này không thể hoàn tác.`)) return;

    try {
      const res = await window.ApiService.manager.deleteChordSet({ chord_set_id: setId });
      if (res.success) {
        app.showToast('Đã xóa bộ hợp âm', 'success');
        app.loadStats?.();
        loadCommunityChords();
        if (app.state?.selectedSong) app.selectSong?.(app.state.selectedSong.id);
        app.loadMyContributions?.();
      } else {
        app.showToast(res.message || 'Lỗi khi xóa', 'error');
      }
    } catch (e) {
      app.showToast('Lỗi mạng', 'error');
    }
  }

  /* ================= FORK MODAL & SUBMIT ================= */
  function openForkModal(songId = '', songTitle = '', preferredType = 'chord_set') {
    const app = _getApp();
    if (!app.state?.currentUser?.logged_in) {
      app.showToast('Vui lòng đăng nhập hoặc đăng ký để tạo bản phối!', 'info');
      app.openModal?.('modal-login');
      return;
    }

    if (songId) {
      setForkSelectedSong(songId, songTitle);
    } else if (app.state?.selectedSong) {
      setForkSelectedSong(app.state.selectedSong.id, app.state.selectedSong.title, app.state.selectedSong.httlvnId);
    } else {
      const fId = document.getElementById('fork-song-id');
      const fSearch = document.getElementById('fork-song-search');
      if (fId) fId.value = '';
      if (fSearch) { fSearch.value = ''; fSearch.classList.remove('hidden'); }
      document.getElementById('fork-selected-song-badge')?.classList.add('hidden');
    }

    const typeSelect = document.getElementById('fork-type-select');
    if (typeSelect) typeSelect.value = preferredType;

    const setNameInput = document.getElementById('fork-set-name');
    if (setNameInput) {
      const inst = document.getElementById('fork-instrument-select')?.value || 'Guitar';
      const uName = app.state.currentUser.username;
      if (preferredType === 'score_version') {
        setNameInput.value = `Bản phối SATB của @${uName}`;
      } else {
        setNameInput.value = `Bản ${inst} của @${uName}`;
      }
    }

    app.openModal?.('modal-fork');
  }

  function setForkSelectedSong(songId, title, httlvnId = '') {
    const fId = document.getElementById('fork-song-id');
    const fName = document.getElementById('fork-selected-song-name');
    if (fId) fId.value = songId;
    if (fName) fName.textContent = `#${httlvnId || ''} ${title}`;
    document.getElementById('fork-selected-song-badge')?.classList.remove('hidden');
    document.getElementById('fork-song-search')?.classList.add('hidden');
    document.getElementById('fork-song-results')?.classList.add('hidden');
  }

  async function handleForkSubmit(e) {
    e.preventDefault();
    const app = _getApp();

    const songId = document.getElementById('fork-song-id')?.value;
    if (!songId) {
      app.showToast('Vui lòng tìm và chọn bài hát cần tạo bản phối', 'error');
      return;
    }

    const forkType   = document.getElementById('fork-type-select')?.value || 'chord_set';
    const instrument = document.getElementById('fork-instrument-select')?.value || 'Guitar';
    const setName    = document.getElementById('fork-set-name')?.value?.trim() || '';
    const capo       = parseInt(document.getElementById('fork-capo-select')?.value) || 0;
    const notes      = document.getElementById('fork-notes-guide')?.value?.trim() || '';
    const isPublic   = document.getElementById('fork-is-public')?.checked ? 1 : 0;

    const submitBtn  = document.getElementById('btn-submit-fork');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Đang nhân bản an toàn...'; }

    try {
      const res = await window.ApiService.manager.forkSong({
        song_id: songId,
        fork_type: forkType,
        instrument_type: instrument,
        set_name: setName,
        capo_fret: capo,
        notes_guide: notes,
        is_public: isPublic
      });
      if (res.success) {
        app.showToast(res.message || 'Tạo bản phối thành công!', 'success');
        app.closeModal?.('modal-fork');

        app.loadStats?.();
        window.ManagerRepertoire?.loadRepertoire?.();
        loadCommunityChords();

        if (app.state?.selectedSong && app.state.selectedSong.id === songId) {
          app.selectSong?.(songId);
        }

        if (res.data?.redirect_url) {
          setTimeout(() => {
            window.location.href = '../' + res.data.redirect_url;
          }, 1000);
        }
      } else {
        app.showToast(res.message || 'Lỗi khi tạo bản phối', 'error');
      }
    } catch (err) {
      app.showToast('Lỗi mạng: ' + err.message, 'error');
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = '🚀 Tạo Ngay & Vào Chỉnh Sửa'; }
    }
  }

  window.ManagerCommunity = {
    init,
    loadCommunityChords,
    renderCommunityGrid,
    toggleRecommend,
    deleteUserChordSet,
    openForkModal,
    setForkSelectedSong,
    handleForkSubmit
  };
})();
