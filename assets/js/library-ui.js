/**
 * library-ui.js — Thư viện bài hát
 * v3: pointerdown instant, không preventDefault trên action buttons,
 *     visual feedback qua CSS :active (không cần JS), dedup bằng pointerId
 */
const LibraryUI = (() => {
  'use strict';

  let songs        = [];
  let activeSongId = null;
  let onSelectCb   = null;
  let onDeleteCb   = null;
  let _searchDebounce = null;

  const listEl     = () => document.getElementById('song-list');
  const searchEl   = () => document.getElementById('search-input');
  const categoryEl = () => document.getElementById('category-filter');

  function init() {
    // Search — debounce 200ms
    searchEl()?.addEventListener('input', () => {
      clearTimeout(_searchDebounce);
      _searchDebounce = setTimeout(_onSearch, 200);
    });

    loadSongs();

    document.getElementById('btn-prev-song')?.addEventListener('click', () => {
      // Nếu đang trong setlist → nhường quyền cho SetlistUI (tránh double-fire)
      if (window.SetlistUI?.getCurrentSetlist?.()) return;
      App?.navigatePrev?.();
    });
    document.getElementById('btn-next-song')?.addEventListener('click', () => {
      // Nếu đang trong setlist → nhường quyền cho SetlistUI (tránh double-fire)
      if (window.SetlistUI?.getCurrentSetlist?.()) return;
      App?.navigateNext?.();
    });
    document.getElementById('btn-search-lyrics')?.addEventListener('click', _toggleSearchMode);
    categoryEl()?.addEventListener('change', _onSearch);
    document.getElementById('sort-filter')?.addEventListener('change', _onSearch);

    // Sidebar tabs

    document.getElementById('sidebar-tab-favs')?.addEventListener('click', _showFavorites);
    document.getElementById('sidebar-tab-lib')?.addEventListener('click', () => {
      document.querySelectorAll('.sidebar-tab').forEach(t => t.classList.remove('active'));
      document.getElementById('sidebar-tab-lib')?.classList.add('active');
      document.querySelectorAll('.sidebar-tab-content').forEach(c => c.classList.add('hidden'));
      document.getElementById('tab-content-library')?.classList.remove('hidden');
      render(songs);
    });

    // Category filter
    _buildCategoryFilter();

    // ── Event Delegation ──
    // GIẢI PHÁP DỨT ĐIỂM CHO iOS 300ms:
    // Dùng touchstart + pointerdown. touchstart phản hồi ngay (0ms), 
    // click bị block bằng e.preventDefault() trên touchend (implicit via pointerdown).
    // KHÔNG dùng e.preventDefault() trên touchstart vì sẽ ngăn scroll.
    const list = listEl();
    if (list) {
      // Track xem song nào vừa được chọn bằng touch để dedup với click sau đó
      let _lastTouchId = '';
      let _lastTouchTime = 0;

      // touchstart = 0ms delay, phản hồi NGAY
      list.addEventListener('touchstart', (e) => {
        const item = e.target.closest('.song-item');
        if (!item?.dataset.id) return;

        // Bỏ qua action buttons — chúng cần click để hoạt động đúng
        if (e.target.closest('.song-delete-btn,.song-add-setlist-btn,.song-fav-btn')) return;

        _lastTouchId   = item.dataset.id;
        _lastTouchTime = Date.now();
        selectSong(item.dataset.id);
      }, { passive: true }); // passive: KHÔNG gọi preventDefault → scroll vẫn hoạt động

      // click = fallback cho desktop và trường hợp touch không fire
      list.addEventListener('click', (e) => {
        const btn = e.target.closest('.song-delete-btn');
        if (btn) { e.stopPropagation(); _handleDelete(btn); return; }

        const addSetBtn = e.target.closest('.song-add-setlist-btn');
        if (addSetBtn) { e.stopPropagation(); _promptAddToSetlist(addSetBtn.closest('.song-item')?.dataset.id); return; }

        const favBtn = e.target.closest('.song-fav-btn');
        if (favBtn) { e.stopPropagation(); _handleFav(favBtn); return; }

        const item = e.target.closest('.song-item');
        if (!item?.dataset.id) return;

        // Nếu touchstart đã xử lý item này trong vòng 600ms → bỏ qua (tránh double-fire)
        if (item.dataset.id === _lastTouchId && Date.now() - _lastTouchTime < 600) return;

        selectSong(item.dataset.id);
      });
    }
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
    App?.showToast(added ? '★ Đã thêm vào Yêu Thích' : 'Đã bỏ Yêu Thích', 'success');
  }

  // ── Load / Render ─────────────────────────────────────────────
  async function loadSongs() {
    try {
      songs = await ApiService.songs.list();
      if (!Array.isArray(songs)) songs = [];
      songs.sort((a, b) => (a.httlvnId || 0) - (b.httlvnId || 0));
      render(songs);
      _updateCount(songs.length);
      _buildCategoryFilter();
      _buildQuickJump(songs);
      _buildRecentlyViewed();
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

    if (!list || list.length === 0) {
      el.innerHTML = `<div class="empty-state">
        <span class="empty-icon">🎶</span>
        <p>${opts.emptyMsg || 'Không tìm thấy bài hát'}</p>
        <small>${opts.emptyHint || 'Thử từ khóa khác'}</small>
      </div>`;
      return;
    }

    // Dùng DocumentFragment để batch DOM insert — nhanh hơn innerHTML cho list lớn
    const frag = document.createDocumentFragment();
    const canAdmin = window.Auth?.isAdmin?.() ?? false;
    const canEdit  = window.Auth?.isBanhat?.() ?? false;

    list.forEach(song => {
      const div = _createSongItem(song, canAdmin, canEdit);
      frag.appendChild(div);
    });

    el.innerHTML = '';
    el.appendChild(frag);

    if (activeSongId) _highlightActive(activeSongId);
  }

  /** Tạo DOM node một song item */
  function _createSongItem(song, canAdmin, canEdit) {
    const div = document.createElement('div');
    div.className   = 'song-item';
    div.dataset.id  = song.id;
    div.title = song.title;

    // Số thứ tự
    const num = document.createElement('div');
    num.className   = 'song-item-num';
    num.textContent = song.httlvnId ? String(song.httlvnId).padStart(3, '0') : '';
    div.appendChild(num);

    // Info
    const info = document.createElement('div');
    info.className = 'song-item-info';
    const title = document.createElement('div');
    title.className   = 'song-item-title';
    title.textContent = song.title;
    info.appendChild(title);
    const meta = document.createElement('div');
    meta.className = 'song-item-meta';
    if (song.keySignature) {
      const badge = document.createElement('span');
      badge.className   = 'song-key-badge';
      badge.textContent = song.keySignature;
      meta.appendChild(badge);
    }
    info.appendChild(meta);
    div.appendChild(info);

    // Actions
    const acts = document.createElement('div');
    acts.className = 'song-item-actions';

    // Fav
    const isFav = window.HistoryManager?.isFavorite?.(song.id) ?? false;
    const favBtn = document.createElement('button');
    favBtn.className   = `song-fav-btn icon-btn-xs${isFav ? ' fav-active' : ''}`;
    favBtn.title       = isFav ? 'Bỏ yêu thích' : 'Thêm yêu thích';
    favBtn.textContent = isFav ? '★' : '☆';
    acts.appendChild(favBtn);

    // Add to setlist (admin/banhat)
    if (canEdit) {
      const addBtn = document.createElement('button');
      addBtn.className   = 'song-add-setlist-btn icon-btn-xs';
      addBtn.title       = 'Thêm vào Setlist';
      addBtn.textContent = '+';
      acts.appendChild(addBtn);
    }

    // Delete (admin only)
    if (canAdmin) {
      const delBtn = document.createElement('button');
      delBtn.className   = 'song-delete-btn icon-btn-xs';
      delBtn.title       = 'Xoá bài hát';
      delBtn.textContent = '🗑';
      acts.appendChild(delBtn);
    }

    div.appendChild(acts);
    return div;
  }

  // ── Search ───────────────────────────────────────────────────
  let _searchMode = 'title'; // 'title' | 'lyric'

  function _sortSongs(list) {
    const mode = document.getElementById('sort-filter')?.value || 'num';
    const copy = [...list];
    if (mode === 'title') {
      copy.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'vi'));
    } else if (mode === 'key') {
      copy.sort((a, b) => (a.defaultKey || '').localeCompare(b.defaultKey || ''));
    } else {
      copy.sort((a, b) => (a.httlvnId || 0) - (b.httlvnId || 0));
    }
    return copy;
  }

  function _onSearch() {
    const q   = (searchEl()?.value || '').trim().toLowerCase();
    const cat = categoryEl()?.value || '';
    let filtered = songs;
    if (cat) filtered = filtered.filter(s => s.category === cat);
    if (q) {
      if (_searchMode === 'lyric') {
        filtered = filtered.filter(s =>
          (s.title?.toLowerCase().includes(q)) || (s.lyricSnippet?.toLowerCase().includes(q))
        );
      } else {
        filtered = filtered.filter(s => {
          // Match theo tên bài
          const titleMatch = s.title?.toLowerCase().includes(q);
          // Match theo số httlvnId (chỉ khi query là chuỗi toàn số)
          const isNumQuery = /^\d+$/.test(q);
          if (!isNumQuery) return titleMatch;
          const qNum = parseInt(q, 10);
          // So sánh số nguyên chính xác: "50" → bài 50 (050), không ra 150, 250
          const numMatch = !isNaN(qNum) && s.httlvnId === qNum;
          return titleMatch || numMatch;
        });
      }
    }
    filtered = _sortSongs(filtered);
    render(filtered, {
      emptyMsg: q ? `Không tìm thấy "${q}"` : 'Không có bài hát',
      emptyHint: q ? 'Thử từ khóa khác' : ''
    });
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

  // ── Category Filter ──────────────────────────────────────────
  function _buildCategoryFilter() {
    const sel = categoryEl();
    if (!sel || songs.length === 0) return;
    const cats = [...new Set(songs.map(s => s.category).filter(Boolean))].sort();
    const current = sel.value;
    sel.innerHTML = '<option value="">Tất cả danh mục</option>' +
      cats.map(c => `<option value="${_esc(c)}"${c === current ? ' selected' : ''}>${_esc(c)}</option>`).join('');
  }

  // ── Quick Jump ───────────────────────────────────────────────
  function _buildQuickJump(list) {
    const container = document.getElementById('quick-jump-btns');
    if (!container) return;
    const ranges = [
      ['1-100',1,100],['101-200',101,200],['201-300',201,300],
      ['301-400',301,400],['401-500',401,500],['501-600',501,600],
      ['601-700',601,700],['701-800',701,800],['801-900',801,900],['901+',901,9999]
    ];
    const frag = document.createDocumentFragment();

    // Nút "Tất cả" — dùng touchstart để instant
    const allBtn = document.createElement('button');
    allBtn.className   = 'quick-jump-btn quick-jump-all';
    allBtn.textContent = 'Tất cả';
    const allHandler = () => {
      container.querySelectorAll('.quick-jump-btn').forEach(b => b.classList.remove('active'));
      allBtn.classList.add('active');
      render(songs);
    };
    allBtn.addEventListener('touchstart', allHandler, { passive: true });
    allBtn.addEventListener('click', allHandler);
    frag.appendChild(allBtn);

    ranges.forEach(([label, min, max]) => {
      const has = list.some(s => (s.httlvnId || 0) >= min && (s.httlvnId || 0) <= max);
      if (!has) return;
      const btn = document.createElement('button');
      btn.className   = 'quick-jump-btn';
      btn.textContent = label;
      const handler = () => {
        container.querySelectorAll('.quick-jump-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        render(songs.filter(s => (s.httlvnId || 0) >= min && (s.httlvnId || 0) <= max));
      };
      btn.addEventListener('touchstart', handler, { passive: true });
      btn.addEventListener('click', handler);
      frag.appendChild(btn);
    });

    container.innerHTML = '';
    container.appendChild(frag);
  }

  // ── Recently Viewed ──────────────────────────────────────────
  function _buildRecentlyViewed() {
    const section = document.getElementById('recently-viewed-section');
    if (!section || !window.HistoryManager) return;
    const recent = HistoryManager.getRecent?.() ?? [];
    if (recent.length === 0) { section.style.display = 'none'; return; }

    section.style.display = '';
    section.innerHTML = `<div class="recent-header">
      <span>Gần đây</span>
      <button id="btn-clear-history" class="btn btn-ghost btn-xs">Xóa</button>
    </div>
    <div class="recent-list">${
      recent.slice(0,5).map(s => `
        <div class="recent-item" data-id="${_esc(s.id)}" style="touch-action:manipulation">
          <span class="recent-num">${s.httlvnId ? String(s.httlvnId).padStart(3,'0') : ''}</span>
          <span class="recent-title">${_esc(s.title)}</span>
        </div>`).join('')
    }</div>`;

    // recent-item: touchstart instant
    let _rLastId = '', _rLastTime = 0;
    section.querySelectorAll('.recent-item').forEach(item => {
      item.addEventListener('touchstart', () => {
        _rLastId   = item.dataset.id;
        _rLastTime = Date.now();
        selectSong(item.dataset.id);
      }, { passive: true });
      item.addEventListener('click', () => {
        if (item.dataset.id === _rLastId && Date.now() - _rLastTime < 600) return;
        selectSong(item.dataset.id);
      });
    });
    section.querySelector('#btn-clear-history')?.addEventListener('click', e => {
      e.stopPropagation();
      HistoryManager.clearHistory?.();
      section.style.display = 'none';
    });
  }

  // ── Favorites ────────────────────────────────────────────────
  function _showFavorites() {
    document.querySelectorAll('.sidebar-tab').forEach(t => t.classList.remove('active'));
    document.getElementById('sidebar-tab-favs')?.classList.add('active');
    document.querySelectorAll('.sidebar-tab-content').forEach(c => c.classList.add('hidden'));
    document.getElementById('tab-content-library')?.classList.remove('hidden');
    const favs = window.HistoryManager?.getFavorites?.() ?? [];
    render(favs, { emptyMsg: 'Chưa có bài yêu thích', emptyHint: 'Nhấn ★ trên bài hát để thêm' });
  }

  // ── Setlist ──────────────────────────────────────────────────
  async function _promptAddToSetlist(songId) {
    if (!songId) return;
    const resp = await ApiService.setlists.list();
    // API trả về {success: true, data: [...]} không phải raw array
    const data = Array.isArray(resp) ? resp : (resp?.data ?? []);
    if (!data.length) { window.App?.showToast('Chưa có Setlist nào được tạo', 'error'); return; }

    // Hiện modal thay vì prompt()
    const modal = document.getElementById('add-to-setlist-modal');
    const opts  = document.getElementById('add-to-setlist-options');
    if (!modal || !opts) return;
    opts.innerHTML = data.map(sl =>
      `<div class="song-item" data-id="${sl.id}" style="touch-action:manipulation">
        <div class="song-item-info"><div class="song-item-title">${_esc(sl.title)}</div></div>
      </div>`
    ).join('');
    opts.querySelectorAll('.song-item').forEach(item => {
      item.addEventListener('click', async () => {
        modal.classList.add('hidden');
        const currentSet = window.ChordCanvas?.getCurrentSet?.() || 'HD';
        // BUG-E fix: truyền transpose_key = transpose hiện tại (không để mặc định 0)
        const currentTranspose = window.Store?.get?.('currentTranspose') ?? 0;
        const result = await ApiService.setlists.addItem({
          setlist_id: parseInt(item.dataset.id),
          song_id: songId,
          chord_profile: currentSet,
          transpose_key: currentTranspose
        });
        if (result) window.App?.showToast('Đã thêm bài hát vào Setlist', 'success');
      });
    });
    modal.classList.remove('hidden');
    document.getElementById('btn-close-add-setlist')?.addEventListener('click', () => modal.classList.add('hidden'), { once: true });
    modal.addEventListener('click', e => { if (e.target === modal) modal.classList.add('hidden'); }, { once: true });
  }

  // ── Select Song ──────────────────────────────────────────────
  function selectSong(songId, updateUrl = true) {
    if (!songId) return;
    activeSongId = String(songId);
    _highlightActive(activeSongId);

    if (updateUrl) {
      if (window.URLState?.resetForNewSong) {
        window.URLState.resetForNewSong(songId);
      } else {
        const url = new URL(window.location.href);
        url.searchParams.set('song', songId);
        window.history.pushState({}, '', url);
      }
    }

    const song = songs.find(s => String(s.id) === String(songId));
    if (song && onSelectCb) onSelectCb(song);
  }

  function _highlightActive(id) {
    const el = listEl();
    if (!el) return;
    el.querySelectorAll('.song-item.active').forEach(i => i.classList.remove('active'));
    const active = el.querySelector(`.song-item[data-id="${CSS.escape(String(id))}"]`);
    if (active) {
      active.classList.add('active');
      // Scroll: behavior instant trên mobile để không giật
      active.scrollIntoView({ behavior: 'instant', block: 'nearest' });
    }
  }

  // ── CRUD ─────────────────────────────────────────────────────
  function addSong(song) {
    if (!songs.find(s => String(s.id) === String(song.id))) {
      songs.push(song);
      songs.sort((a, b) => (a.httlvnId || 0) - (b.httlvnId || 0));
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
    if (String(activeSongId) === String(id)) {
      activeSongId = null;
      AppUI?.showWelcome?.();
    }
    if (onDeleteCb) onDeleteCb(id);
  }

  // ── Helpers ───────────────────────────────────────────────────
  function _updateCount(n) {
    const badge = document.getElementById('library-count');
    if (badge) badge.textContent = n;
  }

  function _esc(str) {
    return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function onSelect(cb) { onSelectCb = cb; }
  function onDelete(cb) { onDeleteCb = cb; }
  function getSongs()   { return songs; }
  function getActiveSong() { return songs.find(s => String(s.id) === String(activeSongId)) || null; }
  function getSongObj(id) { return songs.find(s => String(s.id) === String(id)) || null; }

  return { init, loadSongs, render, selectSong, addSong, deleteSong, onSelect, onDelete, getSongs, getActiveSong, getSongObj };
})();

window.LibraryUI = LibraryUI;
