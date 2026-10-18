/**
 * library-ui.js — Thư viện bài hát (Giao Diện Cũ: Phẳng, Gọn, Mật Độ Cao)
 * Hỗ trợ:
 *  - Danh sách 1 dòng (Số bài + Tên bài + Tông + Ghim 📌 + Yêu thích ★)
 *  - Dải danh mục phẳng 1 chạm (#category-flat-list) + Bộ lọc Tông (#key-filter)
 *  - Thanh Ghim Nhanh Bài Hát Buổi Lễ (#quick-pin-bar)
 *  - Nhảy nhanh theo số bài (jumpByNumber)
 */
const LibraryUI = (() => {
  'use strict';

  const PIN_STORAGE_KEY = 'sheetapp_old_pins';
  const CAT_SHORT_NAMES = {
    'Thánh ca': 'Thánh Ca',
    'Thánh Ca Tin Lành': 'TCTL',
    'Tôn Vinh Chúa Hằng Hữu': 'TVCHH',
    'Thánh Vịnh': 'Thánh Vịnh',
    'Thánh Ca Truyền Giảng': 'TCTG',
    'Biệt Thánh Ca': 'Biệt TC',
    'Biệt TC': 'Biệt TC',
    'Ca Khúc Chúc Tôn': 'CKCT',
    'Thánh Ca Đội Kèn Thánh': 'TCĐKT',
    'Thánh Ca Tôn Thờ': 'TCTT',
    'Kinh Thánh': 'Kinh Thánh',
    'Kinh Thánh Đối Đáp': 'Kinh Thánh',
    'NS Trương Văn Xê': 'TV Xê',
    'Hillsongs - Worship': 'Hillsong',
  };

  let ROW_HEIGHT = 26;
  let songs = [], activeSongId = null, onSelectCb = null, onDeleteCb = null;
  let _searchDebounce = null, _searchMode = 'title', _pinnedIds = [];
  let _vList = [], _vStart = -1, _vEnd = -1, _vRaf = 0;

  const listEl     = () => document.getElementById('song-list');
  const scrollWrapEl = () => document.querySelector('.song-list-container');
  const searchEl   = () => document.getElementById('search-input');
  const categoryEl = () => document.getElementById('category-filter');
  const keyEl      = () => document.getElementById('key-filter');

  function init() {
    _loadPins();
    searchEl()?.addEventListener('input', () => {
      clearTimeout(_searchDebounce);
      _searchDebounce = setTimeout(_onSearch, 150);
    });
    scrollWrapEl()?.addEventListener('scroll', () => {
      if (_vList.length <= 120 || _vRaf) return;
      _vRaf = requestAnimationFrame(() => { _vRaf = 0; _renderVirtualSlice(false); });
    }, { passive: true });
    window.addEventListener('resize', () => { _renderVirtualSlice(true); if (activeSongId) _highlightActive(activeSongId); }, { passive: true });
    loadSongs();

    document.getElementById('btn-prev-song')?.addEventListener('click', () => {
      if (!window.SetlistUI?.getCurrentSetlist?.()) App?.navigatePrev?.();
    });
    document.getElementById('btn-next-song')?.addEventListener('click', () => {
      if (!window.SetlistUI?.getCurrentSetlist?.()) App?.navigateNext?.();
    });
    document.getElementById('btn-search-lyrics')?.addEventListener('click', _toggleSearchMode);
    categoryEl()?.addEventListener('change', () => {
      _syncFlatCategoryActive(categoryEl()?.value || '');
      _onSearch();
    });
    keyEl()?.addEventListener('change', _onSearch);
    document.getElementById('btn-pin-current-song')?.addEventListener('click', () => {
      if (activeSongId) togglePin(activeSongId);
    });

    document.getElementById('sidebar-tab-favs')?.addEventListener('click', _showFavorites);
    document.getElementById('sidebar-tab-lib')?.addEventListener('click', () => {
      document.querySelectorAll('.sidebar-tab').forEach(t => t.classList.remove('active'));
      document.getElementById('sidebar-tab-lib')?.classList.add('active');
      document.querySelectorAll('.sidebar-tab-content').forEach(c => c.classList.add('hidden'));
      document.getElementById('tab-content-library')?.classList.remove('hidden');
      _onSearch();
    });

    const list = listEl();
    if (list) {
      window.LibraryGestures.bind(list, (e) => {
        const btn = e.target.closest('.song-delete-btn');
        if (btn) { e.stopPropagation(); _handleDelete(btn); return; }
        const addSetBtn = e.target.closest('.song-add-setlist-btn');
        if (addSetBtn) { e.stopPropagation(); _promptAddToSetlist(addSetBtn.closest('.song-item')?.dataset.id); return; }
        const pinBtn = e.target.closest('.song-pin-btn');
        if (pinBtn) { e.stopPropagation(); togglePin(pinBtn.closest('.song-item')?.dataset.id, pinBtn); return; }
        const favBtn = e.target.closest('.song-fav-btn');
        if (favBtn) { e.stopPropagation(); _handleFav(favBtn); return; }
        const item = e.target.closest('.song-item');
        if (!item?.dataset.id) return;
        selectSong(item.dataset.id);
      });
    }
  }

  // ── Quick Pins (Ghim nhanh buổi lễ) ──────────────────────────
  function _loadPins() {
    try {
      const raw = localStorage.getItem(PIN_STORAGE_KEY);
      _pinnedIds = Array.isArray(JSON.parse(raw)) ? JSON.parse(raw).map(String) : [];
    } catch { _pinnedIds = []; }
  }
  function _savePins() { try { localStorage.setItem(PIN_STORAGE_KEY, JSON.stringify(_pinnedIds)); } catch {} }
  function isPinned(songId) { return _pinnedIds.includes(String(songId)); }

  function togglePin(songId, btnEl = null) {
    if (!songId) return;
    const id = String(songId), idx = _pinnedIds.indexOf(id), added = idx === -1;
    if (added) _pinnedIds.push(id); else _pinnedIds.splice(idx, 1);
    _savePins();
    const targetBtn = btnEl || listEl()?.querySelector(`.song-item[data-id="${CSS.escape(id)}"] .song-pin-btn`);
    if (targetBtn) {
      targetBtn.classList.toggle('pin-active', added);
      targetBtn.title = added ? 'Bỏ ghim khỏi thanh Ghim nhanh' : 'Ghim bài này lên thanh Ghim nhanh';
    }
    _syncPinToolbarBtn();
    _renderPinBar();
    App?.showToast?.(added ? '📌 Đã ghim lên thanh Ghim nhanh' : 'Đã bỏ ghim bài hát', 'info');
  }

  function _syncPinToolbarBtn() {
    const btn = document.getElementById('btn-pin-current-song');
    if (!btn) return;
    const pinned = activeSongId && isPinned(activeSongId);
    btn.classList.toggle('active', !!pinned);
    btn.innerHTML = pinned ? '<span>📌 Đã ghim</span>' : '<span>📌 Ghim</span>';
  }

  function _renderPinBar() {
    const bar = document.getElementById('quick-pin-bar');
    if (!bar) return;
    const pinnedSongs = _pinnedIds.map(id => songs.find(s => String(s.id) === id)).filter(Boolean);
    if (!pinnedSongs.length) {
      bar.classList.add('hidden');
      bar.innerHTML = '';
      return;
    }
    bar.classList.remove('hidden');
    bar.innerHTML = `<span class="pin-bar-label">📌 Ghim (${pinnedSongs.length}):</span>` +
      `<div class="pin-bar-list">` +
      pinnedSongs.map(s => {
        const num = s.httlvnId ? String(s.httlvnId).padStart(3, '0') + '. ' : '';
        const key = s.defaultKey || s.keySignature || '';
        const activeCls = String(s.id) === String(activeSongId) ? ' active' : '';
        return `<div class="pin-bar-item${activeCls}" data-id="${_esc(s.id)}" title="${_esc(s.title)}">
          <span class="pin-bar-text">${_esc(num + s.title)}${key ? ` <b>[${_esc(key)}]</b>` : ''}</span>
          <button class="pin-bar-remove" data-remove-id="${_esc(s.id)}" title="Bỏ ghim">&times;</button>
        </div>`;
      }).join('') +
      `</div>` +
      `<button id="btn-clear-pins" class="pin-bar-clear" title="Xóa toàn bộ bài đã ghim">Xóa hết</button>`;

    bar.querySelectorAll('.pin-bar-item').forEach(el => {
      window.LibraryGestures.bind(el, (e) => {
        const rm = e.target.closest('.pin-bar-remove');
        if (rm) {
          e.stopPropagation();
          togglePin(rm.dataset.removeId);
          return;
        }
        selectSong(el.dataset.id);
      });
    });
    bar.querySelector('#btn-clear-pins')?.addEventListener('click', () => {
      _pinnedIds = [];
      _savePins();
      _renderPinBar();
      _syncPinToolbarBtn();
      listEl()?.querySelectorAll('.song-pin-btn.pin-active').forEach(b => b.classList.remove('pin-active'));
    });
  }

  function _handleDelete(btn) {
    const item = btn.closest('.song-item');
    if (!item) return;
    const id   = item.dataset.id;
    const name = songs.find(s => s.id === id)?.title || 'bài này';
    if (confirm(`Xoá "${name}" khỏi thư viện?`)) deleteSong(id);
  }

  function _handleFav(btn) {
    const item = btn.closest('.song-item');
    if (!item || !window.HistoryManager) return;
    const id   = item.dataset.id;
    const song = songs.find(s => s.id === id);
    if (!song) return;
    const added = HistoryManager.toggleFavorite(song);
    btn.textContent = added ? '★' : '☆';
    btn.title       = added ? 'Bỏ yêu thích' : 'Thêm yêu thích';
    btn.classList.toggle('fav-active', added);
    App?.showToast(added ? '★ Đã lưu vào Yêu Thích' : 'Đã bỏ Yêu Thích', 'success');
  }

  // ── Load / Render ─────────────────────────────────────────────
  async function loadSongs() {
    try {
      const resp = await ApiService.songs.list();
      songs = Array.isArray(resp) ? resp : (resp?.data || []);
      songs.sort((a, b) => ((Number(a.category_id) || 1) - (Number(b.category_id) || 1)) || ((Number(a.httlvnId) || 999999) - (Number(b.httlvnId) || 999999)) || (a.title || '').localeCompare(b.title || '', 'vi', { sensitivity: 'base' }));
      render(songs);
      _updateCount(songs.length);
      _buildCategoryFilter();
      _buildKeyFilter();
      _buildQuickJump(songs);
      _buildRecentlyViewed();
      _renderPinBar();
      const urlSongId = new URLSearchParams(window.location.search).get('song');
      if (urlSongId) selectSong(urlSongId, false);
    } catch (err) {
      console.error('[Library] Lỗi tải danh sách:', err);
      songs = []; render([]);
    }
  }

  function render(list, opts = {}) {
    const el = listEl();
    if (!el) return;
    _vList = Array.isArray(list) ? list : [];
    _vStart = -1; _vEnd = -1;

    if (_vList.length === 0) {
      el.style.paddingTop = '0px';
      el.style.paddingBottom = '0px';
      el.innerHTML = `<div class="empty-state"><p>${_esc(opts.emptyMsg || 'Không tìm thấy bài hát')}</p><small>${_esc(opts.emptyHint || 'Thử từ khóa hoặc bộ lọc khác')}</small></div>`;
      return;
    }

    const wrap = scrollWrapEl();
    if (wrap && !activeSongId) wrap.scrollTop = 0;
    _renderVirtualSlice(true);
    if (activeSongId) _highlightActive(activeSongId);
  }

  function _renderVirtualSlice(force = false) {
    const el = listEl();
    if (!el || _vList.length === 0) return;
    const canAdmin = window.Auth?.isAdmin?.() ?? false;
    const canEdit  = window.Auth?.isBanhat?.() ?? false;

    const sample = el.querySelector('.song-item') || _createSongItem(_vList[0], canAdmin, canEdit);
    const isProbe = !sample.isConnected;
    if (isProbe) el.appendChild(sample);
    const measuredHeight = sample.getBoundingClientRect().height;
    if (isProbe) sample.remove();
    if (measuredHeight > 0) ROW_HEIGHT = measuredHeight;

    if (_vList.length <= 120) {
      if (!force && _vStart === 0 && _vEnd === _vList.length) return;
      _vStart = 0; _vEnd = _vList.length;
      el.style.paddingTop = '0px';
      el.style.paddingBottom = '0px';
      const frag = document.createDocumentFragment();
      _vList.forEach(s => frag.appendChild(_createSongItem(s, canAdmin, canEdit)));
      el.innerHTML = '';
      el.appendChild(frag);
      return;
    }

    const wrap = scrollWrapEl();
    const scrollTop = wrap ? wrap.scrollTop : 0;
    const viewH = (wrap && wrap.clientHeight > 0) ? wrap.clientHeight : 780;
    const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - 12);
    const end   = Math.min(_vList.length, Math.ceil((scrollTop + viewH) / ROW_HEIGHT) + 12);
    if (!force && start === _vStart && end === _vEnd) return;
    _vStart = start; _vEnd = end;

    el.style.paddingTop = (start * ROW_HEIGHT) + 'px';
    el.style.paddingBottom = ((_vList.length - end) * ROW_HEIGHT) + 'px';
    const frag = document.createDocumentFragment();
    for (let i = start; i < end; i++) {
      frag.appendChild(_createSongItem(_vList[i], canAdmin, canEdit));
    }
    el.innerHTML = '';
    el.appendChild(frag);
    if (activeSongId) {
      const active = el.querySelector(`.song-item[data-id="${CSS.escape(String(activeSongId))}"]`);
      if (active) active.classList.add('active');
    }
  }

  /** Tạo DOM node một bài hát trên ĐÚNG 1 DÒNG (Số + Tên + Danh mục + Tông + Ghim/Sao) */
  function _createSongItem(song, canAdmin, canEdit) {
    const div = document.createElement('div');
    div.className  = 'song-item';
    div.dataset.id = song.id;
    const keySig   = song.defaultKey || song.keySignature || '';
    const numStr   = song.httlvnId ? String(song.httlvnId).padStart(3, '0') : '—';
    const catLabel = song.category ? (CAT_SHORT_NAMES[song.category] || song.category) : '';
    div.title      = `${song.httlvnId ? numStr + ' - ' : ''}${song.title}${song.category ? ' — ' + song.category : ''}${keySig ? ' [' + keySig + ']' : ''}`;

    const addSpan = (cls, txt, ttl) => { const s = document.createElement('span'); s.className = cls; s.textContent = txt; if (ttl) s.title = ttl; div.appendChild(s); };
    addSpan('song-item-num', numStr);
    addSpan('song-item-title', song.title);
    if (catLabel) addSpan('song-cat-badge', catLabel, `Danh mục: ${song.category}`);
    if (keySig) addSpan('song-key-badge', keySig);

    const acts = document.createElement('div');
    acts.className = 'song-item-actions';
    const addBtn = (cls, txt, ttl) => { const b = document.createElement('button'); b.className = cls; b.textContent = txt; b.title = ttl; acts.appendChild(b); };

    const pinned = isPinned(song.id);
    addBtn(`song-pin-btn icon-btn-xs${pinned ? ' pin-active' : ''}`, '📌', pinned ? 'Bỏ ghim' : 'Ghim bài này lên thanh Ghim nhanh');
    const isFav = window.HistoryManager?.isFavorite?.(song.id) ?? false;
    addBtn(`song-fav-btn icon-btn-xs${isFav ? ' fav-active' : ''}`, isFav ? '★' : '☆', isFav ? 'Bỏ yêu thích' : 'Thêm yêu thích');
    if (canEdit) addBtn('song-add-setlist-btn icon-btn-xs', '+', 'Thêm vào Setlist');
    if (canAdmin) addBtn('song-delete-btn icon-btn-xs', '×', 'Xoá bài hát');

    div.appendChild(acts);
    return div;
  }

  // ── Search & Filter ──────────────────────────────────────────
  function _onSearch() {
    const q = (searchEl()?.value || '').trim().toLowerCase(), cat = categoryEl()?.value || '', key = keyEl()?.value || '';
    let filtered = songs;
    if (cat) filtered = filtered.filter(s => s.category === cat);
    if (key) filtered = filtered.filter(s => (s.defaultKey || s.keySignature || '') === key);
    _buildQuickJump(filtered);

    if (q) {
      if (window.OfflineVault?.searchSongs) {
        filtered = window.OfflineVault.searchSongs(filtered, q, _searchMode);
      } else if (_searchMode === 'lyric') {
        filtered = filtered.filter(s => (s.title?.toLowerCase().includes(q)) || (s.lyricSnippet?.toLowerCase().includes(q)));
      } else {
        const isNumQuery = /^\d+$/.test(q), qNum = isNumQuery ? parseInt(q, 10) : NaN;
        filtered = filtered.filter(s => {
          const titleMatch = s.title?.toLowerCase().includes(q);
          return !isNumQuery ? titleMatch : (titleMatch || s.httlvnId === qNum || String(s.httlvnId || '').padStart(3, '0').includes(q));
        });
      }
    }
    _updateCount(filtered.length);
    render(filtered, { emptyMsg: q ? `Không tìm thấy "${q}"` : 'Không có bài hát phù hợp', emptyHint: 'Thử từ khóa hoặc đổi danh mục / tông' });
  }

  function _toggleSearchMode() {
    _searchMode = _searchMode === 'title' ? 'lyric' : 'title';
    const btn = document.getElementById('btn-search-lyrics');
    if (btn) {
      btn.classList.toggle('active', _searchMode === 'lyric');
      btn.title = _searchMode === 'lyric' ? 'Đang tìm theo Lời (click để tìm theo Tên)' : 'Tìm theo Lời bài hát';
    }
    _onSearch();
  }

  // ── Category Filter (Select + Flat Strip) ────────────────────
  function _buildCategoryFilter() {
    const sel = categoryEl();
    if (!sel || songs.length === 0) return;
    const catCounts = {}, catOrder = {};
    songs.forEach(s => {
      if (s.category) {
        catCounts[s.category] = (catCounts[s.category] || 0) + 1;
        if (!catOrder[s.category]) catOrder[s.category] = Number(s.category_id) || 99;
      }
    });
    const cats = Object.keys(catCounts).sort((a, b) => (catOrder[a] - catOrder[b]) || a.localeCompare(b, 'vi'));
    const current = sel.value;
    sel.innerHTML = `<option value="">Tất cả danh mục (${songs.length})</option>` +
      cats.map(c => `<option value="${_esc(c)}"${c === current ? ' selected' : ''}>${_esc(c)} (${catCounts[c]})</option>`).join('');

    const flatEl = document.getElementById('category-flat-list');
    if (flatEl) {
      flatEl.innerHTML = `<button type="button" class="cat-flat-btn${!current ? ' active' : ''}" data-cat="">Tất cả <span>${songs.length}</span></button>` +
        cats.map(c => `<button type="button" class="cat-flat-btn${c === current ? ' active' : ''}" data-cat="${_esc(c)}" title="${_esc(c)} (${catCounts[c]} bài)">${_esc(CAT_SHORT_NAMES[c] || c)} <span>${catCounts[c]}</span></button>`).join('');
      flatEl.querySelectorAll('.cat-flat-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const val = btn.dataset.cat || '';
          if (sel) sel.value = val;
          _syncFlatCategoryActive(val);
          _onSearch();
        });
      });
    }
  }

  function _syncFlatCategoryActive(val) {
    document.getElementById('category-flat-list')?.querySelectorAll('.cat-flat-btn').forEach(btn => {
      btn.classList.toggle('active', (btn.dataset.cat || '') === val);
    });
  }

  // ── Key Filter (Lọc nhanh theo Tông) ─────────────────────────
  function _buildKeyFilter() {
    const sel = keyEl();
    if (!sel || songs.length === 0) return;
    const keyCounts = {};
    songs.forEach(s => { const k = s.defaultKey || s.keySignature || ''; if (k) keyCounts[k] = (keyCounts[k] || 0) + 1; });
    const keys = Object.keys(keyCounts).sort((a, b) => a.localeCompare(b)), current = sel.value;
    sel.innerHTML = `<option value="">Tông: Tất cả</option>` +
      keys.map(k => `<option value="${_esc(k)}"${k === current ? ' selected' : ''}>${_esc(k)} (${keyCounts[k]})</option>`).join('');
  }

  // ── Quick Jump (1 dòng gọn: All | 1..100 | 101..200...) ──────
  function _buildQuickJump(list) {
    const container = document.getElementById('quick-jump-btns'), wrap = document.getElementById('quick-jump');
    if (!container) return;
    const ranges = [['001',1,100],['101',101,200],['201',201,300],['301',301,400],['401',401,500],['501',501,600],['601',601,700],['701',701,800],['801',801,999]];
    const hasAnyNumbered = list.some(s => (s.httlvnId || 0) > 0);
    if (wrap) wrap.style.display = hasAnyNumbered ? '' : 'none';
    if (!hasAnyNumbered) { container.innerHTML = ''; return; }

    const frag = document.createDocumentFragment();
    const mkBtn = (cls, txt, ttl, fn) => {
      const b = document.createElement('button'); b.className = cls; b.textContent = txt; b.title = ttl;
      window.LibraryGestures.bind(b, () => { container.querySelectorAll('.quick-jump-btn').forEach(x => x.classList.remove('active')); b.classList.add('active'); fn(); });
      frag.appendChild(b);
    };
    mkBtn('quick-jump-btn quick-jump-all active', 'Tất cả', 'Hiện tất cả bài trong danh mục đang chọn', () => render(list));
    ranges.forEach(([label, min, max]) => {
      if (list.some(s => (s.httlvnId || 0) >= min && (s.httlvnId || 0) <= max)) {
        mkBtn('quick-jump-btn', label, `Từ bài ${min} đến ${max}`, () => render(list.filter(s => (s.httlvnId || 0) >= min && (s.httlvnId || 0) <= max)));
      }
    });
    container.innerHTML = '';
    container.appendChild(frag);
  }

  function _buildRecentlyViewed() {
    const section = document.getElementById('recently-viewed-section');
    if (!section || !window.HistoryManager) return;
    const recent = HistoryManager.getRecent?.() ?? [];
    if (recent.length === 0) { section.style.display = 'none'; return; }
    section.style.display = '';
    section.innerHTML = `<div class="recent-header"><span>Gần đây</span><button id="btn-clear-history" class="btn btn-ghost btn-xs">Xóa</button></div><div class="recent-list">${
      recent.slice(0, 4).map(s => `<div class="recent-item" data-id="${_esc(s.id)}"><span class="recent-num">${s.httlvnId ? String(s.httlvnId).padStart(3,'0') : '—'}</span><span class="recent-title">${_esc(s.title)}</span></div>`).join('')
    }</div>`;
    section.querySelectorAll('.recent-item').forEach(item => window.LibraryGestures.bind(item, () => selectSong(item.dataset.id)));
    section.querySelector('#btn-clear-history')?.addEventListener('click', e => {
      e.stopPropagation();
      HistoryManager.clearHistory?.();
      section.style.display = 'none';
    });
  }

  function _showFavorites() {
    document.querySelectorAll('.sidebar-tab').forEach(t => t.classList.remove('active'));
    document.getElementById('sidebar-tab-favs')?.classList.add('active');
    document.querySelectorAll('.sidebar-tab-content').forEach(c => c.classList.add('hidden'));
    document.getElementById('tab-content-library')?.classList.remove('hidden');
    render(window.HistoryManager?.getFavorites?.() ?? [], { emptyMsg: 'Chưa có bài đã lưu', emptyHint: 'Nhấn ☆ trên bài hát để lưu' });
  }

  async function _promptAddToSetlist(songId) {
    if (!songId) return;
    const resp = await ApiService.setlists.list();
    const data = Array.isArray(resp) ? resp : (resp?.data ?? []);
    if (!data.length) { window.App?.showToast('Chưa có Setlist nào được tạo', 'error'); return; }
    const modal = document.getElementById('add-to-setlist-modal');
    const opts  = document.getElementById('add-to-setlist-options');
    if (!modal || !opts) return;
    opts.innerHTML = data.map(sl => `<div class="song-item" data-id="${sl.id}"><span class="song-item-title">${_esc(sl.title)}</span></div>`).join('');
    opts.querySelectorAll('.song-item').forEach(item => {
      item.addEventListener('click', async () => {
        modal.classList.add('hidden');
        const currentSet = window.ChordCanvas?.getCurrentSet?.() || 'HD';
        const currentTranspose = window.Store?.get?.('currentTranspose') ?? 0;
        const result = await ApiService.setlists.addItem({ setlist_id: parseInt(item.dataset.id), song_id: songId, chord_profile: currentSet, transpose_key: currentTranspose });
        if (result) window.App?.showToast('Đã thêm bài hát vào Setlist', 'success');
      });
    });
    modal.classList.remove('hidden');
    document.getElementById('btn-close-add-setlist')?.addEventListener('click', () => modal.classList.add('hidden'), { once: true });
    modal.addEventListener('click', e => { if (e.target === modal) modal.classList.add('hidden'); }, { once: true });
  }

  function selectSong(songId, updateUrl = true) {
    if (!songId) return;
    activeSongId = String(songId);
    _highlightActive(activeSongId);
    _syncPinToolbarBtn();
    _renderPinBar();
    if (updateUrl) {
      if (window.URLState?.resetForNewSong) window.URLState.resetForNewSong(songId);
      else {
        const url = new URL(window.location.href);
        url.searchParams.set('song', songId);
        window.history.pushState({}, '', url);
      }
    }
    const song = songs.find(s => String(s.id) === String(songId));
    if (song && onSelectCb) onSelectCb(song);
  }

  function jumpByNumber(num) {
    const n = parseInt(num, 10);
    if (isNaN(n) || n <= 0) return false;
    const cat = categoryEl()?.value || '';
    let match = cat ? songs.find(s => s.category === cat && Number(s.httlvnId) === n) : null;
    if (!match) match = songs.find(s => Number(s.httlvnId) === n);
    if (match) { selectSong(match.id); return true; }
    window.App?.showToast?.(`Không tìm thấy bài số ${n}`, 'error');
    return false;
  }

  function _highlightActive(id) {
    const el = listEl();
    if (!el) return;
    if (_vList.length > 120) {
      const idx = _vList.findIndex(s => String(s.id) === String(id));
      const wrap = scrollWrapEl();
      if (idx >= 0 && wrap) {
        const itemTop = idx * ROW_HEIGHT;
        const viewH = wrap.clientHeight || 700;
        if (itemTop < wrap.scrollTop || itemTop + ROW_HEIGHT > wrap.scrollTop + viewH) {
          wrap.scrollTop = Math.max(0, itemTop - Math.floor(viewH / 2));
          _renderVirtualSlice(true);
        }
      }
    }
    el.querySelectorAll('.song-item.active').forEach(i => i.classList.remove('active'));
    const active = el.querySelector(`.song-item[data-id="${CSS.escape(String(id))}"]`);
    if (active) { active.classList.add('active'); active.scrollIntoView({ behavior: 'instant', block: 'nearest' }); }
  }

  function addSong(song) {
    if (!songs.find(s => String(s.id) === String(song.id))) {
      songs.push(song);
      songs.sort((a, b) => ((Number(a.category_id) || 99) - (Number(b.category_id) || 99)) || ((a.httlvnId || 0) - (b.httlvnId || 0)) || String(a.title || '').localeCompare(String(b.title || ''), 'vi'));
    }
    render(songs);
    _updateCount(songs.length);
    selectSong(song.id);
  }

  async function deleteSong(id) {
    await ApiService.songs.delete(id);
    songs = songs.filter(s => String(s.id) !== String(id));
    render(songs);
    _updateCount(songs.length);
    if (String(activeSongId) === String(id)) { activeSongId = null; AppUI?.showWelcome?.(); }
    if (onDeleteCb) onDeleteCb(id);
  }

  function _updateCount(n) { const badge = document.getElementById('library-count'); if (badge) badge.textContent = n; }
  function _esc(str) { return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function onSelect(cb) { onSelectCb = cb; }
  function onDelete(cb) { onDeleteCb = cb; }
  function getSongs()   { return songs; }
  function getActiveSong() { return songs.find(s => String(s.id) === String(activeSongId)) || null; }
  function getSongObj(id) { return songs.find(s => String(s.id) === String(id)) || null; }

  return { init, loadSongs, render, selectSong, jumpByNumber, togglePin, isPinned, addSong, deleteSong, onSelect, onDelete, getSongs, getActiveSong, getSongObj };
})();

window.LibraryUI = LibraryUI;
