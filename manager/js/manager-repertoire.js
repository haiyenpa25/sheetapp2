/**
 * manager/js/manager-repertoire.js — Repertoire, Catalog Search & Category Controller
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

  /* ================= FAST SEARCH & AUTOCOMPLETE ENGINE ================= */
  async function searchFast(keyword, containerEl, onSelectCallback = null) {
    if (!containerEl) return;

    try {
      const res = await window.ApiService.manager.searchSongs(keyword);

      if (res.success && res.songs && res.songs.length > 0) {
        let html = '';
        res.songs.forEach(song => {
          html += `
            <div class="search-result-item" data-id="${_escape(song.id)}">
              <div class="res-item-left"><span class="res-item-num">#${_escape(song.httlvnId || '—')}</span><span class="res-item-title">${_escape(song.title)}</span></div>
              <div class="res-item-right"><span class="key-badge" style="font-size:0.75rem;">${_escape(song.defaultKey || 'G')}</span>${song.chord_sets_count > 0 ? `<span class="res-item-chords-badge">🎸 ${Number.parseInt(song.chord_sets_count, 10) || 0} bản</span>` : ''}</div>
            </div>`;
        });
        containerEl.innerHTML = html;
        containerEl.classList.remove('hidden');

        // Bind clicks
        containerEl.querySelectorAll('.search-result-item').forEach(item => {
          item.addEventListener('click', () => {
            const sid = item.dataset.id;
            const songObj = res.songs.find(s => s.id === sid);
            containerEl.classList.add('hidden');
            if (onSelectCallback) onSelectCallback(songObj);
            else selectSong(sid);
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
    const app = _getApp();

    const panel = document.getElementById('mgr-selected-song-panel');
    if (panel) {
      panel.classList.remove('hidden');
      panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // Set loading indicator
    document.getElementById('sel-song-title').textContent = 'Đang nạp chi tiết bài hát...';
    document.getElementById('sel-song-chords-grid').innerHTML = '<div class="mgr-table-loading" style="grid-column:1/-1;"><div class="mgr-spinner"></div><p>Đang tải hợp âm của bài...</p></div>';

    try {
      const song = await window.ApiService.manager.songDetails(songId);

      if (song.success && song.id) {
        if (app.state) app.state.selectedSong = song;
        _renderSelectedSongPanel(song);
      } else {
        app.showToast('Không tìm thấy thông tin bài hát', 'error');
      }
    } catch (e) {
      app.showToast('Lỗi khi nạp chi tiết bài hát', 'error');
    }
  }

  function _renderSelectedSongPanel(song) {
    const app = _getApp();
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
    if (catSelect && app.state?.categories) {
      catSelect.innerHTML = app.state.categories.map(c =>
        `<option value="${Number.parseInt(c.id, 10) || 0}" ${c.id == song.category_id ? 'selected' : ''}>${_escape(c.icon || '🎵')} ${_escape(c.name)}</option>`
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
        <div class="song-chord-card-meta">Bộ hợp âm mẫu mực được biên tập chuẩn cho hội thánh và ban hát.</div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:auto; padding-top:0.5rem;">
          <span class="card-badge badge-chord-count">● ${song.master_hd_chord_count || 12} hợp âm</span>
          <a href="../index.php?song=${encodeURIComponent(song.id)}&set=HD" class="mgr-btn mgr-btn-primary mgr-btn-xs">👁️ Mở Sheet HD</a>
        </div>
      </div>
    `;

    // 2. User Created Chord Sets
    const userChords = song.user_chord_sets || [];
    const currentUserId = app.state?.currentUser?.user_id;
    const isAdmin = app.state?.currentUser?.role === 'admin';
    const isBanhat = app.state?.currentUser?.role === 'banhat' || isAdmin;

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
            ${c.review_status === 'pending' ? ' • <span style="color:#3b82f6;font-weight:600;">⏳ Chờ duyệt</span>' : ''}
          </div>
          ${c.notes_guide ? `<div class="card-notes-guide" style="font-size:0.75rem; padding:0.35rem 0.5rem;">"${_escape(c.notes_guide)}"</div>` : ''}

          <div style="display:flex; gap:0.4rem; align-items:center; margin-top:auto; padding-top:0.5rem; border-top:1px solid var(--border);">
            <a href="../index.php?song=${encodeURIComponent(song.id)}&set=${encodeURIComponent(safeDiskName)}" class="mgr-btn mgr-btn-primary mgr-btn-xs" style="flex:1;">👁️ Mở Sheet</a>
            ${isOwner && c.review_status !== 'pending' ? `
              <button class="mgr-btn mgr-btn-ghost mgr-btn-xs" title="Gửi đề xuất phê duyệt cho Ca Trưởng" onclick="window.ManagerReviews?.promptSubmitReview('chord_set', ${c.id}, '${_escapeInlineJs(c.set_name)}')">
                🚀 Duyệt
              </button>` : ''}
            ${isBanhat ? `
              <button class="mgr-btn mgr-btn-ghost mgr-btn-xs ${isRec ? 'text-accent' : ''}" title="${isRec ? 'Bỏ ghim' : 'Ghim khuyên dùng'}" onclick="ManagerApp.toggleRecommend(${c.id})">
                ${isRec ? '⭐' : '☆'}
              </button>` : ''}
            ${canManage ? `
              <button class="mgr-btn mgr-btn-ghost mgr-btn-xs text-danger" title="Xóa bộ này" onclick="ManagerApp.deleteUserChordSet(${c.id}, '${_escapeInlineJs(c.set_name)}')">
                ✕
              </button>` : ''}
          </div>
        </div>
      `;
    });

    // 3. New Chord Set Action Card
    html += `
      <div class="song-chord-card" style="border: 1px dashed var(--accent); background: rgba(139, 92, 246, 0.04); align-items: center; justify-content: center; text-align: center; cursor: pointer;"
           onclick="ManagerApp.openForkModal('${_escapeInlineJs(song.id)}', '${_escapeInlineJs(song.title)}')">
        <span style="font-size: 1.75rem;">➕</span>
        <strong style="color: var(--accent); font-size: 0.9rem;">Tạo Bản Phối Hợp Âm Mới</strong>
        <span class="text-xs text-muted">Nhân bản an toàn từ bản gốc để tùy biến theo phong cách của bạn</span>
      </div>
    `;

    chordsGrid.innerHTML = html;

    // 4. Render MusicXML Fork Versions for Selected Song
    const versGrid = document.getElementById('sel-song-versions-grid');
    if (versGrid) {
      const versions = song.song_versions || [];
      let vHtml = '';
      if (versions.length > 0) {
        versions.forEach(v => {
          const isOwner = currentUserId && (v.user_id == currentUserId);
          const canManage = isOwner || isAdmin;
          const isRec = v.is_recommended == 1;
          vHtml += `
            <div class="song-chord-card ${isRec ? 'card-recommended' : ''}" style="border-left: 3px solid var(--cyan);">
              <div class="song-chord-card-title">
                <span>${isRec ? '⭐ ' : ''}${_escape(v.version_name)}</span>
                <span class="song-version-badge">📑 MusicXML</span>
              </div>
              <div class="song-chord-card-meta">
                👤 Soạn bởi: <strong>@${_escape(v.username)}</strong> (${_escape(v.display_name || v.username)})<br>
                <span>Cập nhật: ${(v.updated_at || v.created_at || '').substring(0, 10)}</span>
              </div>
              ${v.description ? `<div class="card-notes-guide" style="font-size:0.75rem; padding:0.35rem 0.5rem;">"${_escape(v.description)}"</div>` : ''}

              <div style="display:flex; gap:0.4rem; align-items:center; margin-top:auto; padding-top:0.5rem; border-top:1px solid var(--border);">
                <a href="../editor/?song=${encodeURIComponent(song.id)}&version=${v.id}" target="_blank" class="mgr-btn mgr-btn-primary mgr-btn-xs" style="flex:1;" title="Mở Visual Editor để chỉnh nốt SATB">
                  ✏️ Sửa Nốt (SATB)
                </a>
                <a href="../index.php?song=${encodeURIComponent(song.id)}&version=${v.id}" target="_blank" class="mgr-btn mgr-btn-ghost mgr-btn-xs" title="Xem trên Sheet Reader">
                  👁️ Xem Sheet
                </a>
                ${isBanhat ? `
                  <button class="mgr-btn mgr-btn-ghost mgr-btn-xs ${isRec ? 'text-accent' : ''}" 
                          title="${isRec ? 'Bỏ ghim' : 'Ghim khuyên dùng'}"
                          onclick="ManagerApp.toggleVersionRecommend(${v.id})">
                    ${isRec ? '⭐' : '☆'}
                  </button>
                ` : ''}
                ${canManage ? `
                  <button class="mgr-btn mgr-btn-ghost mgr-btn-xs text-danger" 
                          title="Xóa bản fork này"
                          onclick="ManagerApp.deleteVersion(${v.id}, '${_escapeInlineJs(v.version_name)}')">
                    ✕
                  </button>
                ` : ''}
              </div>
            </div>
          `;
        });
      } else {
        vHtml += `
          <div style="grid-column: 1 / -1; padding: 0.75rem; background: var(--bg-surface-elevated); border: 1px dashed var(--border); border-radius: var(--radius-md); font-size: 0.85rem; color: var(--text-muted); display: flex; align-items: center; justify-content: space-between;">
            <span>Bài hát này chưa có bản fork MusicXML nào. Bấm nút bên cạnh để nhân bản phân bè SATB độc lập.</span>
            <button class="mgr-btn mgr-btn-ghost mgr-btn-xs" onclick="ManagerApp.openForkModal('${_escapeInlineJs(song.id)}', '${_escapeInlineJs(song.title)}', 'score_version')">
              + Tạo Bản Fork SATB
            </button>
          </div>
        `;
      }
      versGrid.innerHTML = vHtml;
    }
  }

  async function handleSaveSongCategory() {
    const app = _getApp();
    if (!app.state?.selectedSong) return;

    const catSelect = document.getElementById('sel-song-cat-select');
    const newCatId  = parseInt(catSelect.value);

    try {
      const res = await window.ApiService.manager.updateSongCategory({
        song_id: app.state.selectedSong.id,
        category_id: newCatId
      });

      if (res.success) {
        app.showToast('Đã cập nhật thể loại cho bài hát!', 'success');
        const catObj = app.state.categories?.find(c => c.id == newCatId);
        if (catObj) {
          document.getElementById('sel-song-cat-badge').textContent = `${catObj.icon || '🎵'} ${catObj.name}`;
        }
        loadRepertoire();
        app.loadStats?.();
      } else {
        app.showToast(res.message || 'Lỗi cập nhật thể loại', 'error');
      }
    } catch (e) {
      app.showToast('Lỗi mạng', 'error');
    }
  }

  /* ================= REPERTOIRE (TAB 1) ================= */
  async function loadRepertoire() {
    const app = _getApp();
    const repState = app.state?.repertoire;
    const tbody = document.getElementById('mgr-songs-tbody');
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="6" class="mgr-table-loading"><div class="mgr-spinner"></div><p>Đang tải danh sách bài hát...</p></td></tr>`;
    }

    try {
      const params = {
        limit: repState ? repState.limit : 50,
        offset: repState ? repState.offset : 0,
        category_id: repState?.categoryId || '',
        q: repState?.keyword || ''
      };

      const res = await window.ApiService.manager.repertoire(params);
      if (res.success && repState) {
        repState.songs = res.songs || [];
        repState.total = res.total || 0;
        renderRepertoire();
        updatePagination();
      }
    } catch (e) {
      if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="mgr-table-loading text-danger">Lỗi nạp kho bài hát.</td></tr>`;
    }
  }

  function renderRepertoire() {
    const app = _getApp();
    const repState = app.state?.repertoire;
    const tbody = document.getElementById('mgr-songs-tbody');
    if (!tbody || !repState) return;

    let songs = repState.songs;

    if (repState.onlyHasChords) {
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
              <button class="mgr-btn mgr-btn-primary mgr-btn-xs" onclick="ManagerApp.openForkModal('${_escapeInlineJs(song.id)}', '${_escapeInlineJs(song.title)}')">
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

  function updatePagination() {
    const app = _getApp();
    const repState = app.state?.repertoire;
    if (!repState) return;

    const info = document.getElementById('mgr-page-info');
    const prev = document.getElementById('btn-prev-page');
    const next = document.getElementById('btn-next-page');

    const total = repState.total;
    const start = total === 0 ? 0 : repState.offset + 1;
    const end   = Math.min(repState.offset + repState.limit, total);

    if (info) info.textContent = `Hiển thị ${start} - ${end} trên tổng số ${total} bài`;
    if (prev) prev.disabled = repState.offset === 0;
    if (next) next.disabled = end >= total;
  }

  /* ================= CATEGORIES ================= */
  async function loadCategories() {
    const app = _getApp();
    try {
      const res = await window.ApiService.manager.categories();
      if (res.success && res.categories) {
        if (app.state) app.state.categories = res.categories;
        _renderCategoryPills(res.categories);
        _renderCategoriesTab(res.categories);
      }
    } catch (e) {}
  }

  function _renderCategoryPills(categories) {
    const container = document.getElementById('mgr-cat-pills');
    if (!container) return;

    let html = `<button class="mgr-pill active" data-cat-id="">Tất Cả</button>`;
    categories.forEach(c => {
      html += `
        <button class="mgr-pill" data-cat-id="${c.id}">
          <span>${_escape(c.icon || '🎵')}</span>
          <span>${_escape(c.name)}</span>
          <span style="font-size:0.75rem; opacity:0.7;">(${Number.parseInt(c.song_count, 10) || 0})</span>
        </button>
      `;
    });
    container.innerHTML = html;
  }

  function _renderCategoriesTab(categories) {
    const app = _getApp();
    const grid = document.getElementById('mgr-categories-grid');
    if (!grid) return;

    const isAdmin = app.state?.currentUser?.role === 'admin';
    let html = '';
    categories.forEach(c => {
      html += `
        <div class="cat-card" style="cursor:pointer;" onclick="ManagerApp.filterByCategory(${c.id})">
          <div class="cat-card-header">
            <span class="cat-card-icon">${_escape(c.icon || '🎵')}</span>
            <div>
              <div class="cat-card-title">${_escape(c.name)}</div>
              <div class="cat-card-count">${Number.parseInt(c.song_count, 10) || 0} bài hát</div>
            </div>
          </div>
          <div class="cat-card-desc">${_escape(c.description || 'Chưa có mô tả')}</div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:auto; padding-top:0.5rem; border-top:1px solid var(--border);" onclick="event.stopPropagation()">
            <button class="mgr-btn mgr-btn-primary mgr-btn-xs" onclick="ManagerApp.filterByCategory(${c.id})">
              🎼 Xem Danh Sách (${Number.parseInt(c.song_count, 10) || 0})
            </button>
            ${isAdmin ? `
              <div style="display:flex; gap:0.4rem;">
                <button class="mgr-btn mgr-btn-ghost mgr-btn-xs" onclick="ManagerApp.editCategory(${c.id}, '${_escapeInlineJs(c.name)}', '${_escapeInlineJs(c.icon)}', '${_escapeInlineJs(c.description || '')}')">✏️ Sửa</button>
                ${c.id !== 1 ? `<button class="mgr-btn mgr-btn-ghost mgr-btn-xs text-danger" onclick="ManagerApp.deleteCategory(${c.id})">🗑️ Xóa</button>` : ''}
              </div>
            ` : ''}
          </div>
        </div>
      `;
    });
    grid.innerHTML = html;
  }

  function filterByCategory(categoryId) {
    const app = _getApp();
    app.switchTab?.('tab-repertoire');
    if (app.state?.repertoire) {
      app.state.repertoire.categoryId = categoryId;
      app.state.repertoire.offset = 0;
    }
    document.querySelectorAll('#mgr-cat-pills .mgr-pill').forEach(pill => {
      pill.classList.toggle('active', pill.dataset.catId == categoryId);
    });
    loadRepertoire();
  }

  function editCategory(id, name, icon, desc) {
    const app = _getApp();
    document.getElementById('cat-modal-title').textContent = '✏️ Chỉnh Sửa Danh Mục';
    document.getElementById('cat-edit-id').value = id;
    document.getElementById('cat-edit-name').value = name;
    document.getElementById('cat-edit-icon').value = icon;
    document.getElementById('cat-edit-desc').value = desc;
    app.openModal?.('modal-category');
  }

  async function handleCategorySubmit(e) {
    e.preventDefault();
    const app = _getApp();
    const id   = document.getElementById('cat-edit-id').value;
    const name = document.getElementById('cat-edit-name').value.trim();
    const icon = document.getElementById('cat-edit-icon').value.trim();
    const desc = document.getElementById('cat-edit-desc').value.trim();

    const subAction = id ? 'update' : 'create';

    try {
      const res = await window.ApiService.manager.manageCategory({
        sub_action: subAction,
        id,
        name,
        icon,
        description: desc
      });
      if (res.success) {
        app.showToast(res.message || 'Thành công!', 'success');
        app.closeModal?.('modal-category');
        loadCategories();
        app.loadStats?.();
      } else {
        app.showToast(res.message || 'Lỗi', 'error');
      }
    } catch (e) {
      app.showToast('Lỗi mạng', 'error');
    }
  }

  async function deleteCategory(id) {
    const app = _getApp();
    if (!confirm('Bạn có chắc muốn xóa thể loại này? Các bài hát sẽ được chuyển về thể loại Thánh Ca mặc định.')) return;

    try {
      const res = await window.ApiService.manager.manageCategory({
        sub_action: 'delete',
        id
      });
      if (res.success) {
        app.showToast('Đã xóa thể loại', 'success');
        loadCategories();
        app.loadStats?.();
      } else {
        app.showToast(res.message || 'Lỗi', 'error');
      }
    } catch (e) {
      app.showToast('Lỗi mạng', 'error');
    }
  }

  window.ManagerRepertoire = {
    init,
    searchFast,
    selectSong,
    handleSaveSongCategory,
    loadRepertoire,
    renderRepertoire,
    updatePagination,
    loadCategories,
    filterByCategory,
    editCategory,
    handleCategorySubmit,
    deleteCategory
  };
})();
