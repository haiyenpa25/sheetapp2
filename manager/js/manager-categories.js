/**
 * manager/js/manager-categories.js — Quản lý danh mục bài hát: quyền xem + thêm bài (MusicXML)
 *
 * - Mỗi danh mục có quyền xem: công khai / nội bộ (ban nhạc trở lên) / chỉ admin.
 * - Đổi quyền áp dụng đồng loạt cho mọi bài trong danh mục (công khai hoặc chuyển riêng) — luôn hỏi xác nhận.
 * - Thêm bài: tải một hoặc nhiều file MusicXML vào danh mục; bài vào danh mục không công khai được lưu ở
 *   vùng riêng tư (không ai tải trực tiếp được, không lên GitHub).
 *
 * Phụ thuộc: ApiService, SafeHtml (tuỳ chọn), ManagerRepertoire.loadRepertoire (làm mới danh sách bài)
 * Public API: { loadCategories, filterByCategory, editCategory, handleCategorySubmit, deleteCategory, openUpload, handleUploadSubmit }
 */
(() => {
  'use strict';

  const VISIBILITY = Object.freeze({
    public:     { label: '🌐 Công khai',          cls: 'vis-public',  note: 'Ai cũng xem được, kể cả khách.' },
    private:    { label: '🔒 Nội bộ (ban nhạc)',  cls: 'vis-private', note: 'Chỉ thành viên ban nhạc trở lên (đã đăng nhập) xem được; khách không thấy.' },
    admin_only: { label: '🛡️ Chỉ admin',          cls: 'vis-admin',   note: 'Chỉ quản trị viên xem được.' },
  });
  const DEFAULT_ICON = '🎵';
  const DEFAULT_CATEGORY_ID = 1;
  const MAX_FILE_BYTES = 10 * 1024 * 1024;
  const UPLOAD_EXTENSIONS = ['xml', 'musicxml', 'mxl'];

  let _ctx = null;
  let _uploadCategoryId = 0;

  const _app = () => _ctx || window.ManagerApp || {};
  const _categories = () => _app().state?.categories || [];
  const _find = (id) => _categories().find(c => Number(c.id) === Number(id));
  const _esc = (s) => (window.SafeHtml ? window.SafeHtml.escape(s) : String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])));
  const _count = (c) => Number.parseInt(c.song_count, 10) || 0;
  const _vis = (c) => VISIBILITY[c.visibility] ? c.visibility : 'public';
  const _isAdmin = () => _app().state?.currentUser?.role === 'admin';

  function init(ctx) { _ctx = ctx || null; }

  /* ─── Tải & hiển thị ─── */
  async function loadCategories() {
    try {
      const res = await window.ApiService.manager.categories();
      if (res?.success && Array.isArray(res.categories)) {
        if (_app().state) _app().state.categories = res.categories;
        _renderPills(res.categories);
        _renderGrid(res.categories);
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

  function _renderGrid(categories) {
    const grid = document.getElementById('mgr-categories-grid');
    if (!grid) return;
    const admin = _isAdmin();
    const addBtn = document.getElementById('btn-add-category-modal');
    if (addBtn) addBtn.hidden = !admin;
    grid.innerHTML = categories.map(c => {
      const id = Number(c.id);
      return `
        <div class="cat-card" style="cursor:pointer;" onclick="ManagerApp.filterByCategory(${id})">
          <div class="cat-card-header">
            <span class="cat-card-icon">${_esc(c.icon || DEFAULT_ICON)}</span>
            <div>
              <div class="cat-card-title">${_esc(c.name)}</div>
              <div class="cat-card-count">${_count(c)} bài hát · ${_badge(c)}</div>
            </div>
          </div>
          <div class="cat-card-desc">${_esc(c.description || 'Chưa có mô tả')}</div>
          <div class="cat-card-actions" onclick="event.stopPropagation()">
            <button class="mgr-btn mgr-btn-primary mgr-btn-xs" onclick="ManagerApp.filterByCategory(${id})">🎼 Xem danh sách (${_count(c)})</button>
            ${admin ? `
              <button class="mgr-btn mgr-btn-ghost mgr-btn-xs" onclick="ManagerApp.openUploadSongs(${id})">➕ Thêm bài (XML)</button>
              <button class="mgr-btn mgr-btn-ghost mgr-btn-xs" onclick="ManagerApp.editCategory(${id})">✏️ Sửa</button>
              ${id !== DEFAULT_CATEGORY_ID ? `<button class="mgr-btn mgr-btn-ghost mgr-btn-xs text-danger" onclick="ManagerApp.deleteCategory(${id})">🗑️ Xóa</button>` : ''}
            ` : ''}
          </div>
        </div>`;
    }).join('');
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

    // Đổi quyền xem áp dụng cho TẤT CẢ bài trong danh mục: luôn hỏi trước.
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
        await loadCategories();
        app.loadStats?.();
      } else {
        app.showToast?.(res.error || res.message || 'Lỗi', 'error');
      }
    } catch (err) {
      app.showToast?.(err?.message || 'Lỗi mạng', 'error');
    }
  }

  /* ─── Thêm bài (MusicXML) vào danh mục ─── */
  function openUpload(categoryId) {
    const c = _find(categoryId);
    if (!c) return;
    _uploadCategoryId = Number(c.id);
    document.getElementById('upload-song-category').innerHTML = `${_esc(c.icon || DEFAULT_ICON)} ${_esc(c.name)} · ${_badge(c)}`;
    document.getElementById('upload-song-note').textContent = _vis(c) === 'public'
      ? 'Bài tải vào đây sẽ công khai (mặc định). Muốn giữ riêng, hãy đặt danh mục ở chế độ Nội bộ trước.'
      : 'Danh mục này không công khai: bài được lưu ở vùng riêng tư, khách không xem được và không lên GitHub. Chỉ nhận .xml / .musicxml.';
    document.getElementById('upload-song-files').value = '';
    document.getElementById('upload-song-results').innerHTML = '';
    document.getElementById('btn-upload-song-submit').disabled = false;
    _app().openModal?.('modal-upload-song');
  }

  function _fileProblem(file, nonPublic) {
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (!UPLOAD_EXTENSIONS.includes(ext)) return 'Chỉ nhận .xml, .musicxml hoặc .mxl';
    if (nonPublic && ext === 'mxl') return 'Danh mục không công khai chỉ nhận .xml / .musicxml';
    if (file.size <= 0 || file.size > MAX_FILE_BYTES) return 'Dung lượng phải từ 1 byte đến 10 MB';
    return '';
  }

  async function handleUploadSubmit(e) {
    e.preventDefault();
    const c = _find(_uploadCategoryId);
    const files = Array.from(document.getElementById('upload-song-files').files || []);
    const out = document.getElementById('upload-song-results');
    if (!c || !files.length) { _app().showToast?.('Hãy chọn ít nhất một file MusicXML', 'error'); return; }

    const submit = document.getElementById('btn-upload-song-submit');
    submit.disabled = true;
    out.innerHTML = '';
    let ok = 0;
    for (const file of files) {
      const row = document.createElement('div');
      row.className = 'upload-row';
      out.appendChild(row);
      const problem = _fileProblem(file, _vis(c) !== 'public');
      if (problem) { row.textContent = `✗ ${file.name}: ${problem}`; row.classList.add('upload-fail'); continue; }
      row.textContent = `… ${file.name}`;
      const fd = new FormData();
      fd.append('file', file);
      fd.append('category_id', String(c.id));
      fd.append('visibility', _vis(c));
      const typedTitle = (document.getElementById('upload-song-title')?.value || '').trim();
      if (typedTitle && files.length === 1) fd.append('title', typedTitle);
      try {
        const res = await window.ApiService.importer.upload(fd);
        if (res?.success === false) throw new Error(res.error || res.message || 'Lỗi');
        ok++;
        row.textContent = `✓ ${file.name} → ${res?.song?.title || res?.title || 'đã thêm'}`;
        row.classList.add('upload-ok');
      } catch (err) {
        row.textContent = `✗ ${file.name}: ${err?.message || 'Lỗi tải lên'}`;
        row.classList.add('upload-fail');
      }
    }
    submit.disabled = false;
    if (ok) {
      _app().showToast?.(`Đã thêm ${ok}/${files.length} bài vào "${c.name}"`, 'success');
      await loadCategories();
      window.ManagerRepertoire?.loadRepertoire?.();
      _app().loadStats?.();
    }
  }

  window.ManagerCategories = {
    init, loadCategories, filterByCategory, newCategory, editCategory, handleCategorySubmit,
    deleteCategory, openUpload, handleUploadSubmit, fillVisibilityNote: _fillVisibilityNote,
  };
})();
