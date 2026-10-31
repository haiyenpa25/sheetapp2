/**
 * manager/js/manager-upload.js — Thêm bài (MusicXML): chọn nhiều file, xem và SỬA tên từng bài trước khi tải.
 *
 * - Tên gợi ý: <work-title>/<movement-title> trong XML (bỏ tên mặc định của phần mềm soạn nhạc như
 *   "Untitled score"); nếu không có thì lấy từ tên file ("012 Tên bài.xml" → số bài 12 + "Tên bài").
 * - Mỗi file một dòng: Tên bài (bắt buộc), Số bài, Tác giả; bỏ dòng không muốn tải; chọn file nhiều lần được.
 * - Tải tuần tự từng file; dòng thành công được gỡ khỏi danh sách, dòng lỗi giữ lại để sửa và tải lại.
 *
 * Phụ thuộc: ApiService.importer.upload, ManagerCategories (danh mục, làm mới sau khi tải).
 * Public API: { init, open, submit }
 */
(() => {
  'use strict';

  const MAX_FILE_BYTES = 10 * 1024 * 1024;
  const UPLOAD_EXTENSIONS = ['xml', 'musicxml', 'mxl'];
  const SNIFF_BYTES = 64 * 1024; // <work-title> nằm ở đầu file, không cần đọc cả file nhiều MB
  const PLACEHOLDER_TITLES = ['untitled score', 'untitled', 'title', 'subtitle', 'composer / arranger', 'composer'];
  const MAX_TITLE_LENGTH = 200;
  const DEFAULT_CATEGORY_ID = 1;
  const VISIBILITY_PUBLIC = 'public';

  let _ctx = null;
  let _rows = [];
  let _seq = 0;
  let _categoryId = DEFAULT_CATEGORY_ID;
  let _pendingReads = Promise.resolve();

  const _app = () => _ctx || {};
  const _categories = () => _app().state?.categories || [];
  const _find = (id) => _categories().find(c => Number(c.id) === Number(id));
  const _isPublic = (c) => (c?.visibility || VISIBILITY_PUBLIC) === VISIBILITY_PUBLIC;
  const _el = (id) => document.getElementById(id);

  function init(ctx) {
    _ctx = ctx || null;
    _el('upload-song-files')?.addEventListener('change', _onFilesChosen);
  }

  /* ─── Đọc tên gợi ý từ file ─── */
  function _decodeEntities(s) {
    const t = document.createElement('textarea');
    t.innerHTML = s;
    return t.value.trim();
  }

  function _titleFromXml(text) {
    for (const tag of ['work-title', 'movement-title']) {
      const m = text.match(new RegExp(`<${tag}>\\s*([^<]+?)\\s*</${tag}>`, 'u'));
      if (!m) continue;
      const title = _decodeEntities(m[1]);
      if (title && !PLACEHOLDER_TITLES.includes(title.toLowerCase())) return title.slice(0, MAX_TITLE_LENGTH);
    }
    return '';
  }

  function _fromFileName(name) {
    let base = name.replace(/\.[^.]+$/, '').replace(/_+/g, ' ').replace(/\s+/g, ' ').trim();
    if (!/\s/.test(base)) base = base.replace(/-+/g, ' ').trim(); // "tai-chinhe" → "tai chinhe"; giữ gạch nối trong tên thật ("GIÊ-HÔ-VA")
    const m = base.match(/^(\d{1,4})[\s._-]+(.+)$/u);
    return m ? { num: String(Number(m[1])), title: m[2].trim() } : { num: '', title: base };
  }

  function _fileProblem(file, nonPublic) {
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (!UPLOAD_EXTENSIONS.includes(ext)) return 'Chỉ nhận .xml, .musicxml hoặc .mxl';
    if (nonPublic && ext === 'mxl') return 'Danh mục không công khai chỉ nhận .xml / .musicxml';
    if (file.size <= 0 || file.size > MAX_FILE_BYTES) return 'Dung lượng phải từ 1 byte đến 10 MB';
    return '';
  }

  async function _buildRow(file) {
    const nonPublic = !_isPublic(_find(_categoryId));
    const row = { id: ++_seq, file, title: '', num: '', composer: '', source: 'file', error: _fileProblem(file, nonPublic) };
    if (row.error) return row;
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    let xmlTitle = '';
    if (ext !== 'mxl') {
      try { xmlTitle = _titleFromXml(await file.slice(0, SNIFF_BYTES).text()); } catch (_) { /* không đọc được: dùng tên file */ }
    }
    const fromName = _fromFileName(file.name);
    row.num = fromName.num;
    if (xmlTitle) { row.title = xmlTitle; row.source = 'xml'; } else { row.title = fromName.title; }
    return row;
  }

  /* ─── Danh sách chuẩn bị tải ─── */
  function _field(labelText, input) {
    const label = document.createElement('label');
    label.className = 'up-field';
    const span = document.createElement('span');
    span.textContent = labelText;
    label.append(span, input);
    return label;
  }

  function _input(cls, value, attrs = {}) {
    const inp = document.createElement('input');
    inp.className = `mgr-input ${cls}`;
    inp.value = value;
    Object.entries(attrs).forEach(([k, v]) => inp.setAttribute(k, v));
    return inp;
  }

  function _hint(row) {
    if (row.error) return { text: row.error, cls: 'up-hint-error' };
    if (row.source === 'file') return { text: 'Tên lấy từ tên file (trong file XML chưa có tên) — hãy kiểm tra lại.', cls: 'up-hint-warn' };
    return { text: 'Tên lấy từ file XML — sửa nếu cần.', cls: '' };
  }

  function _renderRow(row) {
    const wrap = document.createElement('div');
    wrap.className = 'up-row' + (row.error ? ' up-row-bad' : '');
    wrap.dataset.rowId = String(row.id);

    const head = document.createElement('div');
    head.className = 'up-row-head';
    const name = document.createElement('span');
    name.className = 'up-file';
    name.textContent = `${row.file.name} · ${Math.max(1, Math.round(row.file.size / 1024))} KB`;
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'up-remove';
    del.setAttribute('aria-label', `Bỏ file ${row.file.name}`);
    del.textContent = '✕';
    del.addEventListener('click', () => { _rows = _rows.filter(r => r.id !== row.id); _render(); });
    head.append(name, del);
    wrap.appendChild(head);

    const hint = _hint(row);
    if (!row.error) {
      const title = _input('up-in-title', row.title, { maxlength: String(MAX_TITLE_LENGTH), placeholder: 'Tên bài (bắt buộc)' });
      title.addEventListener('input', () => { row.title = title.value; title.classList.remove('up-invalid'); });
      const num = _input('up-in-num', row.num, { type: 'number', min: '1', max: '99999', inputmode: 'numeric', placeholder: 'VD: 12' });
      num.addEventListener('input', () => { row.num = num.value; });
      const composer = _input('up-in-composer', row.composer, { placeholder: 'Tuỳ chọn' });
      composer.addEventListener('input', () => { row.composer = composer.value; });
      const sub = document.createElement('div');
      sub.className = 'up-sub';
      sub.append(_field('Số bài', num), _field('Tác giả', composer));
      wrap.append(_field('Tên bài *', title), sub);
    }
    const hintEl = document.createElement('div');
    hintEl.className = `up-hint ${hint.cls}`;
    hintEl.textContent = hint.text;
    wrap.appendChild(hintEl);
    return wrap;
  }

  const _uploadable = () => _rows.filter(r => !r.error);

  function _render() {
    const stage = _el('upload-song-stage');
    if (!stage) return;
    stage.replaceChildren(..._rows.map(_renderRow));
    const n = _uploadable().length;
    const btn = _el('btn-upload-song-submit');
    if (btn) { btn.textContent = n ? `Tải lên (${n} bài)` : 'Tải lên'; btn.disabled = n === 0; }
  }

  function _onFilesChosen(e) {
    const input = e.target;
    const files = Array.from(input.files || []);
    const known = new Set(_rows.map(r => `${r.file.name}|${r.file.size}`));
    const fresh = files.filter(f => !known.has(`${f.name}|${f.size}`));
    // submit() chờ việc đọc này xong: chọn file rồi bấm Tải ngay vẫn có đủ dòng
    _pendingReads = _pendingReads.then(async () => {
      for (const f of fresh) _rows.push(await _buildRow(f));
      input.value = ''; // chọn thêm lần nữa / chọn lại đúng file đó vẫn nhận
      _render();
    });
  }

  /* ─── Mở hộp thoại ─── */
  function _updateNote(catId) {
    const c = _find(catId) || _categories()[0];
    if (!c) return;
    _categoryId = Number(c.id);
    const note = _el('upload-song-note');
    if (!note) return;
    const folder = (c.slug && c.slug !== 'thanh-ca') ? `storage/Thanh ca/${c.slug}/` : 'storage/Thanh ca/';
    note.textContent = _isPublic(c)
      ? `Bài tải vào đây sẽ công khai và lưu vào thư mục "${folder}" để đồng bộ GitHub.`
      : 'Danh mục này không công khai: bài được lưu ở vùng riêng tư, khách không xem được và không lên GitHub. Chỉ nhận .xml / .musicxml.';
  }

  function open(categoryId) {
    const cats = _categories();
    const target = _find(categoryId) || window.ManagerCategories?.activeCategory?.() || cats[0];
    if (!target) return;
    _categoryId = Number(target.id);
    const wrap = _el('upload-song-category');
    if (wrap) {
      const sel = document.createElement('select');
      sel.id = 'upload-song-cat-select';
      sel.className = 'mgr-input';
      cats.forEach(c => {
        const o = document.createElement('option');
        o.value = String(c.id);
        o.textContent = `${c.name}${_isPublic(c) ? '' : ' (không công khai)'}`;
        o.selected = Number(c.id) === _categoryId;
        sel.appendChild(o);
      });
      sel.addEventListener('change', async () => {
        _updateNote(Number(sel.value));
        _rows = await Promise.all(_rows.map(_revalidate));
        _render();
      });
      wrap.replaceChildren(sel);
    }
    _updateNote(_categoryId);
    _rows = [];
    _pendingReads = Promise.resolve();
    const results = _el('upload-song-results');
    if (results) results.replaceChildren();
    const files = _el('upload-song-files');
    if (files) files.value = '';
    _render();
    _app().openModal?.('modal-upload-song');
  }

  async function _revalidate(row) {
    const problem = _fileProblem(row.file, !_isPublic(_find(_categoryId)));
    if (problem) return { ...row, error: problem };
    return row.error ? _buildRow(row.file) : row;
  }

  /* ─── Tải lên ─── */
  function _log(text, ok) {
    const out = _el('upload-song-results');
    if (!out) return;
    const line = document.createElement('div');
    line.className = `upload-row ${ok ? 'upload-ok' : 'upload-fail'}`;
    line.textContent = text;
    out.appendChild(line);
  }

  async function submit(e) {
    e?.preventDefault();
    await _pendingReads;
    const cat = _find(_categoryId);
    const rows = _uploadable();
    if (!cat || !rows.length) { _app().showToast?.('Hãy chọn ít nhất một file MusicXML hợp lệ', 'error'); return; }

    const empty = rows.find(r => !r.title.trim());
    if (empty) {
      _app().showToast?.('Mỗi bài cần có tên — hãy nhập tên vào ô còn trống', 'error');
      document.querySelector(`.up-row[data-row-id="${empty.id}"] .up-in-title`)?.classList.add('up-invalid');
      document.querySelector(`.up-row[data-row-id="${empty.id}"] .up-in-title`)?.focus();
      return;
    }

    const submitBtn = _el('btn-upload-song-submit');
    if (submitBtn) submitBtn.disabled = true;
    let ok = 0;
    for (const row of rows) {
      const fd = new FormData();
      fd.append('file', row.file);
      fd.append('category_id', String(cat.id));
      fd.append('visibility', cat.visibility || VISIBILITY_PUBLIC);
      fd.append('title', row.title.trim());
      if (row.num) fd.append('httlvnId', String(Number(row.num)));
      if (row.composer.trim()) fd.append('composer', row.composer.trim());
      try {
        const res = await window.ApiService.importer.upload(fd);
        if (res?.success === false) throw new Error(res.error || res.message || 'Lỗi');
        ok++;
        _rows = _rows.filter(r => r.id !== row.id);
        _log(`✓ ${row.file.name} → ${res?.song?.title || res?.title || row.title.trim()}`, true);
      } catch (err) {
        _log(`✗ ${row.file.name}: ${err?.message || 'Lỗi tải lên'}`, false);
      }
    }
    _render();
    if (ok) await window.ManagerCategories?.afterUpload?.(cat.id, ok, rows.length);
  }

  window.ManagerUpload = { init, open, submit };
})();
