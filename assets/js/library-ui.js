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
  let _searchSeq = 0;
  let _lastRenderedSongs = [];

  const listEl     = () => document.getElementById('song-list');
  const searchEl   = () => document.getElementById('search-input');
  const categoryEl = () => document.getElementById('category-filter');

  function init() {
    if (window.HistoryManager?.init) {
      window.HistoryManager.init(() => _buildRecentlyViewed());
    }
    // Search — debounce 200ms
    searchEl()?.addEventListener('input', () => {
      clearTimeout(_searchDebounce);
      _searchDebounce = setTimeout(_onSearch, 200);
    });
    // Enter mở kết quả đầu tiên (Ticket L0-7)
    searchEl()?.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        clearTimeout(_searchDebounce);
        await _onSearch();
        const first = listEl()?.querySelector('.song-item');
        if (first?.dataset?.id) { selectSong(first.dataset.id); searchEl()?.blur(); }
      }
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
    document.getElementById('season-filter')?.addEventListener('change', _onSearch);
    document.getElementById('theme-filter')?.addEventListener('change', _onSearch);

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
    } catch (err) {
      console.error('[Library] Lỗi tải danh sách (có thể đang ngoại tuyến):', err);
      songs = window.OfflineSetlistManager?.getAllOfflineSongs?.() || [];
    }
    songs.sort((a, b) => (a.httlvnId || 0) - (b.httlvnId || 0));
    render(songs.length > 0 ? _sortSongs(songs) : []);
    _updateCount(songs.length);
    if (songs.length > 0) {
      _buildCategoryFilter();
      _buildQuickJump(songs);
      _buildRecentlyViewed();
    }
    const urlSongId = new URLSearchParams(window.location.search).get('song');
    if (urlSongId) selectSong(urlSongId, false);
  }

  function render(list, opts = {}) {
    _lastRenderedSongs = Array.isArray(list) ? list : [];
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

  function _createBadge(text, color) {
    const b = document.createElement('span');
    b.className = 'song-key-badge';
    if (color) b.style.color = color;
    b.textContent = text;
    return b;
  }
  function _createActionBtn(cls, title, text) {
    const btn = document.createElement('button');
    btn.className = cls; btn.title = title; btn.textContent = text;
    return btn;
  }

  /** Tạo DOM node một song item */
  function _createSongItem(song, canAdmin, canEdit) {
    const div = document.createElement('div');
    div.className = 'song-item';
    div.dataset.id = song.id;
    div.title = song.title;

    const num = document.createElement('div');
    num.className = 'song-item-num';
    num.textContent = song.httlvnId ? String(song.httlvnId).padStart(3, '0') : '';
    div.appendChild(num);

    const info = document.createElement('div');
    info.className = 'song-item-info';
    const title = document.createElement('div');
    title.className = 'song-item-title';
    const q = (searchEl()?.value || '').trim();
    if (q) title.innerHTML = _highlightText(song.title, q);
    else title.textContent = song.title;
    info.appendChild(title);

    const meta = document.createElement('div');
    meta.className = 'song-item-meta';
    const songKey = song.defaultKey || song.keySignature;
    if (songKey) meta.appendChild(_createBadge(songKey));
    if (song.liturgical_season) meta.appendChild(_createBadge(song.liturgical_season, '#8b5cf6'));
    if (song.theme) meta.appendChild(_createBadge(song.theme, '#f59e0b'));
    info.appendChild(meta);

    const snippet = song.lyric_snippet || song.lyricSnippet;
    if (snippet) {
      const snip = document.createElement('div');
      snip.className = 'song-item-snippet';
      snip.style.cssText = 'font-size:0.72rem;color:var(--text-muted);font-style:italic;margin-top:2px';
      snip.innerHTML = snippet;
      info.appendChild(snip);
    }
    div.appendChild(info);

    const acts = document.createElement('div');
    acts.className = 'song-item-actions';
    const isFav = window.HistoryManager?.isFavorite?.(song.id) ?? false;
    acts.appendChild(_createActionBtn(`song-fav-btn icon-btn-xs${isFav ? ' fav-active' : ''}`, isFav ? 'Bỏ yêu thích' : 'Thêm yêu thích', isFav ? '★' : '☆'));
    if (canEdit) acts.appendChild(_createActionBtn('song-add-setlist-btn icon-btn-xs', 'Thêm vào Setlist', '+'));
    if (canAdmin) acts.appendChild(_createActionBtn('song-delete-btn icon-btn-xs', 'Xoá bài hát', '🗑'));
    div.appendChild(acts);

    return div;
  }

  // ── Search ───────────────────────────────────────────────────
  let _searchMode = 'title'; // 'title' | 'lyric'

  function _sortSongs(list) {
    const mode = document.getElementById('sort-filter')?.value || 'num';
    const copy = [...list];
    if (mode === 'title') {
      copy.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'vi', { sensitivity: 'base' }));
    } else if (mode === 'key') {
      copy.sort((a, b) => {
        const keyA = a.defaultKey || a.keySignature || '';
        const keyB = b.defaultKey || b.keySignature || '';
        if (!keyA && !keyB) return (a.httlvnId || 0) - (b.httlvnId || 0);
        if (!keyA) return 1;
        if (!keyB) return -1;
        const cmp = keyA.localeCompare(keyB);
        return cmp !== 0 ? cmp : (a.httlvnId || 0) - (b.httlvnId || 0);
      });
    } else {
      copy.sort((a, b) => (a.httlvnId || 0) - (b.httlvnId || 0));
    }
    return copy;
  }

  function _removeAccents(str) {
    if (!str) return '';
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
  }

  async function _onSearch() {
    const seq    = ++_searchSeq;
    const q      = (searchEl()?.value || '').trim();
    const cat    = categoryEl()?.value || '';
    const season = document.getElementById('season-filter')?.value || '';
    const theme  = document.getElementById('theme-filter')?.value || '';
    const mode   = document.getElementById('sort-filter')?.value || 'num';

    // Ẩn thanh nhảy nhanh (Quick Jump STT) nếu đang lọc
    const quickJumpEl = document.querySelector('.quick-jump');
    if (quickJumpEl) {
      quickJumpEl.style.display = (mode === 'num' && !q && !cat && !season && !theme) ? '' : 'none';
    }

    // Nếu có từ khóa hoặc bộ lọc phụng vụ -> gọi API FTS5
    if (q || season || theme) {
      try {
        const res = await window.ApiService?.songs?.search?.(q, { season, theme });
        if (seq !== _searchSeq) return;
        if (res && (res.success || Array.isArray(res))) {
          let list = Array.isArray(res) ? res : (res.data || []);
          if (cat) list = list.filter(s => s.category === cat);
          const numM = q.match(/^(?:#|bài\s+|bai\s+|stt\s+)?(\d+)$/i);
          if (numM) {
            const target = parseInt(numM[1], 10);
            list.sort((a, b) => (Number(a.httlvnId) === target ? -1 : Number(b.httlvnId) === target ? 1 : (Number(a.httlvnId) || 0) - (Number(b.httlvnId) || 0)));
          } else {
            list = _sortSongs(list);
          }
          render(list, {
            emptyMsg: q ? `Không tìm thấy "${q}"` : 'Không có bài hát phù hợp',
            emptyHint: 'Thử đổi mùa phụng vụ hoặc từ khóa khác'
          });
          return;
        }
      } catch (err) {
        // Fallback local memory search bên dưới
      }
    }

    if (seq !== _searchSeq) return;

    // Client-side fallback & memory filtering
    const qLower = q.toLowerCase();
    const qUnacc = _removeAccents(qLower);
    let filtered = songs;

    if (cat) filtered = filtered.filter(s => s.category === cat);
    if (season) filtered = filtered.filter(s => (s.liturgical_season || '').toLowerCase() === season.toLowerCase());
    if (theme) filtered = filtered.filter(s => (s.theme || '').toLowerCase().includes(theme.toLowerCase()));

    if (q) {
      const numM = q.match(/^(?:#|bài\s+|bai\s+|stt\s+)?(\d+)$/i);
      const target = numM ? parseInt(numM[1], 10) : null;
      filtered = filtered.filter(s => {
        if (target !== null && Number(s.httlvnId) === target) return true;
        const tLower = (s.title || '').toLowerCase();
        return tLower.includes(qLower) || _removeAccents(tLower).includes(qUnacc);
      });
      if (target !== null) {
        filtered.sort((a, b) => (Number(a.httlvnId) === target ? -1 : Number(b.httlvnId) === target ? 1 : (Number(a.httlvnId) || 0) - (Number(b.httlvnId) || 0)));
      } else {
        filtered = _sortSongs(filtered);
      }
    } else {
      filtered = _sortSongs(filtered);
    }
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
    const makeBtn = (label, cls, filterFn) => {
      const btn = document.createElement('button');
      btn.className = `quick-jump-btn ${cls}`.trim();
      btn.textContent = label;
      const handler = () => {
        container.querySelectorAll('.quick-jump-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        render(filterFn ? list.filter(filterFn) : songs);
      };
      btn.addEventListener('touchstart', handler, { passive: true });
      btn.addEventListener('click', handler);
      return btn;
    };

    frag.appendChild(makeBtn('Tất cả', 'quick-jump-all', null));
    ranges.forEach(([label, min, max]) => {
      if (list.some(s => (s.httlvnId || 0) >= min && (s.httlvnId || 0) <= max)) {
        frag.appendChild(makeBtn(label, '', s => (s.httlvnId || 0) >= min && (s.httlvnId || 0) <= max));
      }
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
    const data = Array.isArray(resp) ? resp : (resp?.data ?? []);
    if (!data.length) { window.App?.showToast('Chưa có Setlist nào được tạo', 'error'); return; }

    const modal = document.getElementById('add-to-setlist-modal');
    const opts  = document.getElementById('add-to-setlist-options');
    if (!modal || !opts) return;

    opts.innerHTML = data.map(sl =>
      `<div class="song-item" data-id="${_esc(sl.id)}" style="touch-action:manipulation">
        <div class="song-item-info"><div class="song-item-title">${_esc(sl.title)}</div></div>
      </div>`
    ).join('');

    const closeModal = () => window.ModalManager ? window.ModalManager.close(modal) : modal.classList.add('hidden');

    opts.querySelectorAll('.song-item').forEach(item => {
      item.addEventListener('click', async () => {
        closeModal();
        const setId = parseInt(item.dataset.id, 10);
        window.SetlistUI?.switchToSetlistTab?.(setId);
        if (window.SetlistUI?.addSongToSetlist) await window.SetlistUI.addSongToSetlist(setId, songId);
      });
    });

    if (window.ModalManager) window.ModalManager.open(modal);
    else modal.classList.remove('hidden');

    document.getElementById('btn-close-add-setlist')?.addEventListener('click', closeModal, { once: true });
    modal.addEventListener('click', e => { if (e.target === modal) closeModal(); }, { once: true });
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

    let song = songs.find(s => String(s.id) === String(songId))
            || _lastRenderedSongs.find(s => String(s.id) === String(songId));
    if (song && !songs.some(s => String(s.id) === String(song.id))) {
      songs.push(song);
    }
    if (!song && window.OfflineSetlistManager?.getOfflineSong) {
      song = window.OfflineSetlistManager.getOfflineSong(songId);
      if (song && !songs.some(s => String(s.id) === String(song.id))) {
        songs.push(song);
      }
    }
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
    if (window.SafeHtml?.escape) return window.SafeHtml.escape(str);
    return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function _highlightText(text, query) {
    if (!text) return '';
    const safeText = _esc(text);
    const cleanQ = (query || '').trim();
    if (!cleanQ) return safeText;

    const map = { a: '[aáàảãạăắằẳẵặâấầẩẫậ]', e: '[eéèẻẽẹêếềểễệ]', i: '[iíìỉĩị]', o: '[oóòỏõọôốồổỗộơớờởỡợ]', u: '[uúùủũụưứừửữự]', y: '[yýỳỷỹỵ]', d: '[dđ]' };
    const words = cleanQ.split(/\s+/).filter(Boolean);
    const parts = words.map(w => w.toLowerCase().split('').map(c => map[c] || c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join(''));
    if (parts.length === 0) return safeText;
    return safeText.replace(new RegExp('(' + parts.join('|') + ')', 'gi'), '<mark>$1</mark>');
  }

  function onSelect(cb) { onSelectCb = cb; }
  function onDelete(cb) { onDeleteCb = cb; }
  function getSongs()   { return songs; }
  function getActiveSong() { return songs.find(s => String(s.id) === String(activeSongId)) || null; }
  function getSongObj(id) {
    return songs.find(s => String(s.id) === String(id)) || _lastRenderedSongs.find(s => String(s.id) === String(id)) || null;
  }

  return { init, loadSongs, render, selectSong, addSong, deleteSong, onSelect, onDelete, getSongs, getActiveSong, getSongObj };
})();

window.LibraryUI = LibraryUI;
