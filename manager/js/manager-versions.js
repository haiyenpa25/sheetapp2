/**
 * manager/js/manager-versions.js — MusicXML Score Fork & SATB Version Controller
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

  /* ================= VERSIONS (TAB 3) ================= */
  async function loadVersions() {
    const app = _getApp();
    const verState = app.state?.versions;
    const grid = document.getElementById('mgr-versions-grid');
    if (grid) {
      grid.innerHTML = `<div class="mgr-table-loading" style="grid-column:1/-1;"><div class="mgr-spinner"></div><p>Đang tải danh sách bản phối MusicXML...</p></div>`;
    }

    try {
      const params = {
        username: verState ? verState.author || '' : '',
        recommended: verState?.recommendedOnly ? '1' : '0',
        q: verState ? verState.keyword || '' : ''
      };

      const res = await window.ApiService.manager.versions(params);
      if (res.success && res.versions) {
        if (verState) verState.items = res.versions;
        renderVersionsGrid(res.versions);
        renderVersionAuthorChips(res.versions);
        const kpiVers = document.getElementById('kpi-total-vers');
        if (kpiVers && res.total !== undefined) kpiVers.textContent = res.total;
      } else {
        if (grid) grid.innerHTML = `<div class="mgr-table-loading text-danger" style="grid-column:1/-1;">Lỗi nạp danh sách phiên bản.</div>`;
      }
    } catch (e) {
      if (grid) grid.innerHTML = `<div class="mgr-table-loading text-danger" style="grid-column:1/-1;">Lỗi mạng khi nạp phiên bản.</div>`;
    }
  }

  function renderVersionAuthorChips(versions) {
    const app = _getApp();
    const container = document.getElementById('mgr-version-author-chips');
    if (!container || !app.state?.versions) return;

    const authors = new Set();
    versions.forEach(v => { if (v.username) authors.add(v.username); });

    let html = `<button class="mgr-pill ${!app.state.versions.author ? 'active' : ''}" data-ver-author="">Tất Cả Tác Giả</button>`;
    authors.forEach(auth => {
      const isActive = app.state.versions.author === auth;
      html += `<button class="mgr-pill ${isActive ? 'active' : ''}" data-ver-author="${_escape(auth)}">@${_escape(auth)}</button>`;
    });
    container.innerHTML = html;

    container.querySelectorAll('.mgr-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.mgr-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        app.state.versions.author = btn.dataset.verAuthor || '';
        loadVersions();
      });
    });
  }

  function renderVersionsGrid(versions) {
    const app = _getApp();
    const grid = document.getElementById('mgr-versions-grid');
    if (!grid) return;

    if (versions.length === 0) {
      grid.innerHTML = `
        <div class="mgr-table-loading" style="grid-column: 1/-1;">
          <p>Chưa có bản phối MusicXML nào phù hợp với bộ lọc.</p>
          <button class="mgr-btn mgr-btn-primary mgr-btn-sm" style="margin-top:0.75rem;" onclick="ManagerApp.openForkModal('', '', 'score_version')">
            ✨ Tạo Bản Fork Đầu Tiên
          </button>
        </div>`;
      return;
    }

    const currentUserId = app.state?.currentUser?.user_id;
    const isAdmin = app.state?.currentUser?.role === 'admin';
    const isBanhat = app.state?.currentUser?.role === 'banhat' || isAdmin;

    let html = '';
    versions.forEach(v => {
      const isOwner = currentUserId && (v.user_id == currentUserId);
      const canManage = isOwner || isAdmin;
      const isRec = v.is_recommended == 1;
      const dateFormatted = v.created_at ? v.created_at.substring(0, 10) : '';

      html += `
        <div class="version-card ${isRec ? 'card-recommended' : ''}">
          <div class="card-header-row">
            <div>
              <div class="card-song-title">#${v.httlvnId || ''} ${_escape(v.song_title)}</div>
              <div class="card-set-name" style="color:var(--cyan);">${isRec ? '⭐ ' : ''}${_escape(v.version_name)}</div>
            </div>
            <span class="key-badge">${_escape(v.defaultKey || 'G')}</span>
          </div>

          <div class="card-author-box">
            <div class="card-author-avatar" style="background:linear-gradient(135deg, var(--cyan), var(--blue));">
              ${_escape((v.username || 'U').substring(0, 1).toUpperCase())}
            </div>
            <div class="card-author-meta">
              <span class="card-author-name">${_escape(v.display_name || v.username)}</span>
              <span class="card-author-desc">@${_escape(v.username)} • ${v.user_role === 'admin' ? '🛡️ Quản Trị' : '🎼 Ca Trưởng / Nhạc Trưởng'}</span>
            </div>
          </div>

          <div class="card-badges-row">
            <span class="song-version-badge">📑 MusicXML SATB</span>
            <span class="card-badge">📅 ${dateFormatted}</span>
            <span class="card-badge" style="color:var(--text-muted); font-size:0.72rem;">Mã: ${_escape(v.song_id)}</span>
          </div>

          ${v.description ? `<div class="card-notes-guide">"${_escape(v.description)}"</div>` : ''}

          <div class="card-actions-row">
            <a href="../editor/?song=${encodeURIComponent(v.song_id)}&version=${v.id}" target="_blank" class="mgr-btn mgr-btn-primary mgr-btn-xs" style="flex:1;" title="Mở Visual Editor để chỉnh nốt SATB">
              ✏️ Sửa Editor
            </a>
            <a href="../index.php?song=${encodeURIComponent(v.song_id)}&version=${v.id}" target="_blank" class="mgr-btn mgr-btn-ghost mgr-btn-xs" title="Xem trên Sheet Reader">
              👁️ Sheet
            </a>
            <button class="mgr-btn mgr-btn-ghost mgr-btn-xs" onclick="ManagerApp.selectSong('${v.song_id}')" title="Chọn bài hát gốc">
              🎯 Bài Gốc
            </button>
            ${isBanhat ? `
              <button class="mgr-btn mgr-btn-ghost mgr-btn-xs ${isRec ? 'text-accent' : ''}" 
                      title="${isRec ? 'Bỏ ghim khuyên dùng' : 'Ghim cho ban nhạc'}"
                      onclick="ManagerApp.toggleVersionRecommend(${v.id})">
                ${isRec ? '⭐' : '☆'}
              </button>` : ''}
            ${canManage ? `
              <button class="mgr-btn mgr-btn-ghost mgr-btn-xs text-danger" 
                      title="Xóa bản fork này"
                      onclick="ManagerApp.deleteVersion(${v.id}, '${_escapeInlineJs(v.version_name)}')">
                ✕
              </button>` : ''}
          </div>
        </div>
      `;
    });

    grid.innerHTML = html;
  }

  async function deleteVersion(versionId, versionName) {
    const app = _getApp();
    if (!confirm(`Bạn có chắc muốn xóa bản phối MusicXML "${versionName}" không? Thao tác này không thể hoàn tác.`)) return;

    try {
      const res = await window.ApiService.manager.deleteVersion({ version_id: versionId });
      if (res.success) {
        app.showToast('Đã xóa phiên bản MusicXML', 'success');
        app.loadStats?.();
        loadVersions();
        if (app.state?.selectedSong) app.selectSong?.(app.state.selectedSong.id);
        app.loadMyContributions?.();
      } else {
        app.showToast(res.message || 'Lỗi khi xóa', 'error');
      }
    } catch (e) {
      app.showToast('Lỗi mạng', 'error');
    }
  }

  async function toggleVersionRecommend(versionId) {
    const app = _getApp();
    try {
      const res = await window.ApiService.manager.toggleVersionRecommend({ version_id: versionId });
      if (res.success) {
        app.showToast(res.message, 'success');
        loadVersions();
        if (app.state?.selectedSong) app.selectSong?.(app.state.selectedSong.id);
      } else {
        app.showToast(res.message || 'Lỗi', 'error');
      }
    } catch (e) {
      app.showToast('Lỗi mạng', 'error');
    }
  }

  window.ManagerVersions = {
    init,
    loadVersions,
    renderVersionAuthorChips,
    renderVersionsGrid,
    deleteVersion,
    toggleVersionRecommend
  };
})();
