/**
 * manager/js/manager-categories.js — Quản lý danh mục & bài hát: quyền xem + thêm/sửa tên/xóa bài (MusicXML) + đồng bộ GitHub
 *
 * - Mỗi danh mục có quyền xem: công khai / nội bộ (ban nhạc trở lên) / chỉ admin.
 * - Thêm bài: tải một hoặc nhiều file MusicXML vào danh mục; bài công khai tự lưu theo thư mục
 *   storage/Thanh ca/<category-slug>/; bài riêng tư lưu ở vùng riêng tư (không lên GitHub).
 * - Quản lý bài hát trực tiếp trong danh mục: Xem danh sách, Thêm (Upload XML), Sửa tên/thông tin, Xóa bài hát.
 * - Đồng bộ kho bài hát công khai với GitHub (storage/Thanh ca/<slug>/ + storage/seed/library.sqlite).
 */
(() => {
  'use strict';

  const VISIBILITY = Object.freeze({
    public:     { label: '🌐 Công khai',          cls: 'vis-public',  note: 'Ai cũng xem được, kể cả khách (lưu tại storage/Thanh ca/<danh-mục>/).' },
    private:    { label: '🔒 Nội bộ (ban nhạc)',  cls: 'vis-private', note: 'Chỉ thành viên ban nhạc trở lên (đã đăng nhập) xem được; khách không thấy.' },
    admin_only: { label: '🛡️ Chỉ admin',          cls: 'vis-admin',   note: 'Chỉ quản trị viên xem được.' },
  });
  const DEFAULT_ICON = '🎵';
  const DEFAULT_CATEGORY_ID = 1;

  let _ctx = null;
  let _activeCategoryId = 0;
  let _activeCategorySongs = [];
  let _activeSongKeyword = '';

  const _app = () => _ctx || window.ManagerApp || {};
  const _categories = () => _app().state?.categories || [];
  const _find = (id) => _categories().find(c => Number(c.id) === Number(id));
  const _esc = (s) => (window.SafeHtml ? window.SafeHtml.escape(s) : String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])));
  const _escJs = (s) => (window.SafeHtml ? window.SafeHtml.inlineJsString(s) : String(s ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'"));
  const _count = (c) => Number.parseInt(c.song_count, 10) || 0;
  const _vis = (c) => VISIBILITY[c?.visibility] ? c.visibility : 'public';
  const _isAdmin = () => _app().state?.currentUser?.role === 'admin';
  const _canEditSong = () => ['admin', 'leader'].includes(_app().state?.currentUser?.role || '');

  function init(ctx) {
    _ctx = ctx || null;
    document.getElementById('form-edit-song')?.addEventListener('submit', handleEditSongSubmit);
  }

  /* ─── Tải & hiển thị danh mục ─── */
  async function loadCategories() {
    try {
      const res = await window.ApiService.manager.categories();
      if (res?.success && Array.isArray(res.categories)) {
        if (_app().state) _app().state.categories = res.categories;
        _renderPills(res.categories);
        _renderGrid(res.categories);
        _renderCategorySongsSelect(res.categories);
        if (!_activeCategoryId && res.categories.length > 0) {
          const newestCustom = res.categories.find(c => Number(c.id) > 13) || res.categories[0];
          _activeCategoryId = Number(newestCustom.id);
        }
        if (_activeCategoryId) {
          await selectCategoryForSongs(_activeCategoryId, false);
        }
      }
    } catch (err) {
      console.error('[ManagerCategories] loadCategories failed:', err);
    }
  }

  function _badge(c) {
    const v = VISIBILITY[_vis(c)];
    return `<span class="vis-badge ${v.cls}" title="${_esc(v.note)}">${v.label}</span>`;
  }

  function _renderPills(categories) {
    const box = document.getElementById('mgr-cat-pills');
    if (!box) return;
    box.innerHTML = '<button class="mgr-pill active" data-cat-id="">Tất Cả</button>' + categories.map(c => `
      <button class="mgr-pill" data-cat-id="${Number(c.id)}">
        <span>${_esc(c.icon || DEFAULT_ICON)}</span><span>${_esc(c.name)}</span>
        ${_vis(c) !== 'public' ? '<span title="Không công khai">🔒</span>' : ''}
        <span style="font-size:0.75rem; opacity:0.7;">(${_count(c)})</span>
      </button>`).join('');
  }

  function _renderCategorySongsSelect(categories) {
    const sel = document.getElementById('mgr-cat-songs-select');
    if (!sel) return;
    sel.innerHTML = categories.map(c =>
      `<option value="${Number(c.id)}" ${Number(c.id) === Number(_activeCategoryId) ? 'selected' : ''}>${_esc(c.icon || DEFAULT_ICON)} ${_esc(c.name)} (${_count(c)} bài)</option>`
    ).join('');
  }

  function _renderGrid(categories) {
    const grid = document.getElementById('mgr-categories-grid');
    if (!grid) return;
    const admin = _isAdmin();
    for (const btnId of ['btn-add-category-modal', 'btn-add-song-top', 'btn-sync-github-library', 'btn-cat-songs-upload']) {
      const el = document.getElementById(btnId);
      if (el) el.hidden = !admin;
    }
    grid.innerHTML = categories.map(c => {
      const id = Number(c.id);
      const isSelected = id === Number(_activeCategoryId);
      return `
        <div class="cat-card ${isSelected ? 'active' : ''}" style="cursor:pointer; ${isSelected ? 'border-color:var(--accent,#6d28d9); box-shadow:0 0 0 2px rgba(109,40,217,0.18);' : ''}" onclick="window.ManagerCategories.selectCategoryForSongs(${id}, true)">
          <div class="cat-card-header">
            <span class="cat-card-icon">${_esc(c.icon || DEFAULT_ICON)}</span>
            <div>
              <div class="cat-card-title">${_esc(c.name)}</div>
              <div class="cat-card-count">${_count(c)} bài hát · ${_badge(c)}</div>
            </div>
          </div>
          <div class="cat-card-desc">${_esc(c.description || ('Thư mục: storage/Thanh ca/' + (c.slug && c.slug !== 'thanh-ca' ? c.slug + '/' : '')))}</div>
          <div class="cat-card-actions" onclick="event.stopPropagation()">
            <button class="mgr-btn mgr-btn-primary mgr-btn-xs" onclick="window.ManagerCategories.selectCategoryForSongs(${id}, true)">🎼 Quản lý bài (${_count(c)})</button>
            ${admin ? `
              <button class="mgr-btn mgr-btn-ghost mgr-btn-xs" onclick="ManagerApp.openUploadSongs(${id})">➕ Thêm bài (XML)</button>
              <button class="mgr-btn mgr-btn-ghost mgr-btn-xs" onclick="ManagerApp.editCategory(${id})">✏️ Sửa DM</button>
              ${id !== DEFAULT_CATEGORY_ID ? `<button class="mgr-btn mgr-btn-ghost mgr-btn-xs text-danger" onclick="ManagerApp.deleteCategory(${id})">🗑️ Xóa DM</button>` : ''}
            ` : ''}
          </div>
        </div>`;
    }).join('');
  }

  /* ─── Quản lý danh sách bài hát ngay trong Tab Danh Mục ─── */
  async function selectCategoryForSongs(categoryId, scrollToSection = false) {
    const id = Number(categoryId) || DEFAULT_CATEGORY_ID;
    _activeCategoryId = id;
    const sel = document.getElementById('mgr-cat-songs-select');
    if (sel) sel.value = String(id);
    _renderGrid(_categories());

    const cat = _find(id);
    const titleEl = document.getElementById('mgr-cat-songs-title');
    if (titleEl && cat) {
      titleEl.innerHTML = `${_esc(cat.icon || DEFAULT_ICON)} Bài hát trong: <strong>${_esc(cat.name)}</strong>`;
    }
    const tbody = document.getElementById('mgr-cat-songs-tbody');
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="5" class="mgr-table-loading"><div class="mgr-spinner"></div><p>Đang tải danh sách bài hát...</p></td></tr>';
    }
    if (scrollToSection) {
      document.getElementById('mgr-cat-songs-section')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    try {
      const res = await window.ApiService.manager.repertoire({ category_id: id, limit: 1000, offset: 0 });
      _activeCategorySongs = Array.isArray(res?.songs) ? res.songs : [];
      _renderCategorySongsTable();
    } catch (err) {
      if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="mgr-table-loading text-danger">Không thể tải danh sách bài hát của danh mục.</td></tr>';
    }
  }

  function filterCategorySongs(keyword) {
    _activeSongKeyword = String(keyword || '').trim().toLowerCase();
    _renderCategorySongsTable();
  }

  function openUploadForCurrentCategory() {
    openUpload(_activeCategoryId || DEFAULT_CATEGORY_ID);
  }

  function _renderCategorySongsTable() {
    const tbody = document.getElementById('mgr-cat-songs-tbody');
    if (!tbody) return;
    const admin = _isAdmin();
    const canEdit = _canEditSong();
    const kw = _activeSongKeyword;
    const list = kw
      ? _activeCategorySongs.filter(s =>
          String(s.title || '').toLowerCase().includes(kw) ||
          String(s.id || '').toLowerCase().includes(kw) ||
          String(s.httlvnId || '').toLowerCase().includes(kw))
      : _activeCategorySongs;

    if (list.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="mgr-table-loading">
            <p>${kw ? 'Không có bài hát nào khớp từ khóa lọc.' : 'Danh mục này chưa có bài hát nào.'}</p>
            ${admin ? `<button class="mgr-btn mgr-btn-primary mgr-btn-sm" style="margin-top:0.5rem;" onclick="window.ManagerCategories.openUploadForCurrentCategory()">➕ Upload Bài Hát (XML) Ngay</button>` : ''}
          </td>
        </tr>`;
      return;
    }

    tbody.innerHTML = list.map(song => `
      <tr>
        <td><strong style="color:var(--text-muted);">#${_esc(song.httlvnId || '—')}</strong></td>
        <td>
          <div class="song-title-cell">
            <span class="song-main-title">${_esc(song.title)}</span>
            <span class="song-sub-info">Mã: <code>${_esc(song.id)}</code></span>
          </div>
        </td>
        <td style="text-align:center;"><span class="key-badge">${_esc(song.defaultKey || 'C')}</span></td>
        <td><code style="font-size:0.76rem; color:var(--text-muted); word-break:break-all;">${_esc(song.xmlPath || '')}</code></td>
        <td style="text-align:right;">
          <div class="table-actions" style="justify-content:flex-end;">
            ${canEdit ? `<button class="mgr-btn mgr-btn-ghost mgr-btn-xs" onclick="window.ManagerCategories.openEditSongModal('${_escJs(song.id)}')">✏️ Sửa tên</button>` : ''}
            ${admin ? `<button class="mgr-btn mgr-btn-ghost mgr-btn-xs text-danger" onclick="window.ManagerCategories.deleteSong('${_escJs(song.id)}', '${_escJs(song.title)}')">🗑️ Xóa</button>` : ''}
            <button class="mgr-btn mgr-btn-ghost mgr-btn-xs" onclick="ManagerApp.selectSong('${_escJs(song.id)}')">🎯 Chi tiết</button>
            <a href="../index.php?song=${encodeURIComponent(song.id)}" class="mgr-btn mgr-btn-primary mgr-btn-xs" title="Mở bản nhạc">👁️ Mở Sheet</a>
          </div>
        </td>
      </tr>
    `).join('');
  }

  function filterByCategory(categoryId) {
    const app = _app();
    app.switchTab?.('tab-repertoire');
    if (app.state?.repertoire) {
      app.state.repertoire.categoryId = categoryId;
      app.state.repertoire.offset = 0;
    }
    document.querySelectorAll('#mgr-cat-pills .mgr-pill').forEach(pill => {
      pill.classList.toggle('active', pill.dataset.catId == categoryId);
    });
    window.ManagerRepertoire?.loadRepertoire?.();
  }

  /* ─── Sửa tên / thông tin bài hát & Xóa bài hát ─── */
  async function openEditSongModal(songId) {
    if (!songId) return;
    let song = _activeCategorySongs.find(s => s.id === songId)
      || (_app().state?.repertoire?.songs || []).find(s => s.id === songId)
      || (_app().state?.selectedSong?.id === songId ? _app().state.selectedSong : null);

    if (!song) {
      try {
        const res = await window.ApiService.manager.songDetails(songId);
        if (res?.id) song = res;
      } catch (_) {}
    }
    if (!song) {
      _app().showToast?.('Không tìm thấy thông tin bài hát để sửa', 'error');
      return;
    }

    document.getElementById('edit-song-id').value = song.id;
    document.getElementById('edit-song-title').value = song.title || '';
    document.getElementById('edit-song-num').value = song.httlvnId || '';
    document.getElementById('edit-song-key').value = song.defaultKey || 'C';
    document.getElementById('edit-song-composer').value = song.composer || '';

    const catSel = document.getElementById('edit-song-category');
    if (catSel) {
      catSel.innerHTML = _categories().map(c =>
        `<option value="${Number(c.id)}" ${Number(c.id) === Number(song.category_id || 1) ? 'selected' : ''}>${_esc(c.icon || DEFAULT_ICON)} ${_esc(c.name)}</option>`
      ).join('');
    }
    _app().openModal?.('modal-edit-song');
  }

  async function handleEditSongSubmit(e) {
    e.preventDefault();
    const songId = document.getElementById('edit-song-id')?.value?.trim();
    const title = document.getElementById('edit-song-title')?.value?.trim();
    const numVal = document.getElementById('edit-song-num')?.value?.trim();
    const keyVal = document.getElementById('edit-song-key')?.value?.trim() || 'C';
    const catId = Number(document.getElementById('edit-song-category')?.value || 1);
    const composer = document.getElementById('edit-song-composer')?.value?.trim() || '';

    if (!songId || !title) {
      _app().showToast?.('Tên bài hát không được để trống', 'error');
      return;
    }

    const submitBtn = document.getElementById('btn-edit-song-submit');
    if (submitBtn) submitBtn.disabled = true;
    try {
      const res = await window.ApiService.manager.manageSong({
        sub_action: 'update',
        song_id: songId,
        title,
        httlvnId: numVal === '' ? null : Number(numVal),
        defaultKey: keyVal,
        category_id: catId,
        composer
      });
      if (res?.success) {
        _app().showToast?.(res.message || 'Đã cập nhật bài hát thành công!', 'success');
        _app().closeModal?.('modal-edit-song');
        await loadCategories();
        window.ManagerRepertoire?.loadRepertoire?.();
        if (_app().state?.selectedSong?.id === songId) {
          window.ManagerRepertoire?.selectSong?.(songId);
        }
      } else {
        _app().showToast?.(res?.error || res?.message || 'Lỗi cập nhật bài hát', 'error');
      }
    } catch (err) {
      _app().showToast?.(err?.message || 'Lỗi mạng khi cập nhật bài hát', 'error');
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  }

  async function deleteSong(songId, songTitle = '') {
    if (!songId) return;
    const label = songTitle ? `"${songTitle}" (${songId})` : songId;
    if (!window.confirm(`Bạn có chắc chắn muốn XÓA bài hát ${label}?\n\nFile MusicXML và bộ hợp âm của bài này sẽ bị xóa khỏi hệ thống.`)) {
      return;
    }
    try {
      const res = await window.ApiService.manager.manageSong({
        sub_action: 'delete',
        song_id: songId
      });
      if (res?.success) {
        _app().showToast?.(res.message || `Đã xóa bài hát ${label}`, 'success');
        if (_app().state?.selectedSong?.id === songId) {
          _app().state.selectedSong = null;
          document.getElementById('mgr-selected-song-panel')?.classList.add('hidden');
        }
        await loadCategories();
        window.ManagerRepertoire?.loadRepertoire?.();
        _app().loadStats?.();
      } else {
        _app().showToast?.(res?.error || res?.message || 'Không thể xóa bài hát', 'error');
      }
    } catch (err) {
      _app().showToast?.(err?.message || 'Lỗi mạng khi xóa bài hát', 'error');
    }
  }

  /* ─── Đồng bộ kho bài hát theo danh mục lên GitHub ─── */
  async function syncLibraryWithGitHub() {
    const btn = document.getElementById('btn-sync-github-library');
    if (!window.confirm('Đồng bộ kho bài hát công khai với GitHub?\n\n• Lưu các file XML bài hát công khai theo đúng thư mục danh mục (storage/Thanh ca/<danh-mục>/)\n• Cập nhật gói dữ liệu chung (storage/seed/library.sqlite)\n• Commit & đẩy lên GitHub (origin/main) để Web và Local đồng nhất dữ liệu.')) {
      return;
    }
    if (btn) {
      btn.disabled = true;
      btn.textContent = '⏳ Đang đồng bộ GitHub...';
    }
    try {
      const res = await window.ApiService.manager.syncLibrary({ push_git: true });
      if (res?.success) {
        _app().showToast?.(res.message || 'Đã đồng bộ kho bài hát lên GitHub!', 'success');
        await loadCategories();
      } else {
        _app().showToast?.(res?.error || res?.message || 'Lỗi đồng bộ thư viện', 'error');
      }
    } catch (err) {
      _app().showToast?.(err?.message || 'Lỗi khi đồng bộ với GitHub', 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = '🔄 Đồng Bộ GitHub (Kho Nhạc)';
      }
    }
  }

  /* ─── Thêm / sửa / xóa danh mục ─── */
  function _fillVisibilityNote() {
    const sel = document.getElementById('cat-edit-visibility');
    const note = document.getElementById('cat-visibility-note');
    if (sel && note) note.textContent = VISIBILITY[sel.value]?.note || '';
  }

  function newCategory() {
    document.getElementById('cat-modal-title').textContent = '📂 Thêm Danh Mục Mới';
    document.getElementById('cat-edit-id').value = '';
    document.getElementById('cat-edit-name').value = '';
    document.getElementById('cat-edit-desc').value = '';
    document.getElementById('cat-edit-icon').value = DEFAULT_ICON;
    document.getElementById('cat-edit-visibility').value = 'public';
    _fillVisibilityNote();
    _app().openModal?.('modal-category');
  }

  function editCategory(id) {
    const c = _find(id);
    if (!c) return;
    document.getElementById('cat-modal-title').textContent = '✏️ Chỉnh Sửa Danh Mục';
    document.getElementById('cat-edit-id').value = c.id;
    document.getElementById('cat-edit-name').value = c.name || '';
    document.getElementById('cat-edit-icon').value = c.icon || DEFAULT_ICON;
    document.getElementById('cat-edit-desc').value = c.description || '';
    document.getElementById('cat-edit-visibility').value = _vis(c);
    _fillVisibilityNote();
    _app().openModal?.('modal-category');
  }

  async function handleCategorySubmit(e) {
    e.preventDefault();
    const app = _app();
    const id = document.getElementById('cat-edit-id').value;
    const visibility = document.getElementById('cat-edit-visibility').value;
    const existing = id ? _find(id) : null;

    if (existing && _vis(existing) !== visibility) {
      const msg = `Đổi quyền xem của "${existing.name}" thành ${VISIBILITY[visibility].label}?\n\n`
        + `Việc này áp dụng cho ${_count(existing)} bài trong danh mục (kể cả bài đã chọn quyền riêng).`
        + (visibility === 'public' ? '\nSau khi công khai, khách xem được các bài này.' : '');
      if (!window.confirm(msg)) return;
    }

    try {
      const res = await window.ApiService.manager.manageCategory({
        sub_action: id ? 'update' : 'create',
        id,
        name: document.getElementById('cat-edit-name').value.trim(),
        icon: document.getElementById('cat-edit-icon').value.trim(),
        description: document.getElementById('cat-edit-desc').value.trim(),
        visibility,
      });
      if (res.success) {
        app.showToast?.(res.message || 'Thành công!', 'success');
        app.closeModal?.('modal-category');
        await loadCategories();
        window.ManagerRepertoire?.loadRepertoire?.();
        app.loadStats?.();
      } else {
        app.showToast?.(res.error || res.message || 'Lỗi', 'error');
      }
    } catch (err) {
      app.showToast?.(err?.message || 'Lỗi mạng', 'error');
    }
  }

  async function deleteCategory(id) {
    const app = _app();
    if (!window.confirm('Bạn có chắc muốn xóa thể loại này? Các bài hát sẽ được chuyển về thể loại Thánh Ca mặc định (bài riêng tư vẫn giữ quyền riêng).')) return;
    try {
      const res = await window.ApiService.manager.manageCategory({ sub_action: 'delete', id });
      if (res.success) {
        app.showToast?.('Đã xóa thể loại', 'success');
        if (Number(_activeCategoryId) === Number(id)) _activeCategoryId = DEFAULT_CATEGORY_ID;
        await loadCategories();
        app.loadStats?.();
      } else {
        app.showToast?.(res.error || res.message || 'Lỗi', 'error');
      }
    } catch (err) {
      app.showToast?.(err?.message || 'Lỗi mạng', 'error');
    }
  }

  /* ─── Thêm bài (MusicXML): giao diện chuẩn bị + sửa tên nằm ở manager-upload.js ─── */
  const openUpload = (categoryId) => window.ManagerUpload?.open?.(categoryId);
  const handleUploadSubmit = (e) => window.ManagerUpload?.submit?.(e);
  const activeCategory = () => _find(_activeCategoryId);

  /** Gọi sau khi tải xong: chuyển sang danh mục vừa thêm và làm mới số liệu. */
  async function afterUpload(categoryId, okCount, total) {
    _activeCategoryId = Number(categoryId);
    _app().showToast?.(`Đã thêm ${okCount}/${total} bài vào "${_find(categoryId)?.name || 'danh mục'}"`, 'success');
    await loadCategories();
    window.ManagerRepertoire?.loadRepertoire?.();
    _app().loadStats?.();
  }

  window.ManagerCategories = {
    init, loadCategories, filterByCategory, selectCategoryForSongs, filterCategorySongs,
    openUploadForCurrentCategory, openEditSongModal, handleEditSongSubmit, deleteSong,
    syncLibraryWithGitHub, newCategory, editCategory, handleCategorySubmit,
    deleteCategory, openUpload, handleUploadSubmit, afterUpload, activeCategory, fillVisibilityNote: _fillVisibilityNote,
  };
})();
