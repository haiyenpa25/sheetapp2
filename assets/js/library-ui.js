// library-ui.js — Thư viện bài hát (v3: pointerdown instant, L2-1 search ranking)
const LibraryUI = (() => {
  'use strict';

  let songs = [], activeSongId = null, onSelectCb = null, onDeleteCb = null, _searchDebounce = null, _searchSeq = 0, _lastRenderedSongs = [];

  const listEl     = () => document.getElementById('song-list');
  const searchEl   = () => document.getElementById('search-input');
  const categoryEl = () => document.getElementById('category-filter');

  function init() {
    if (window.HistoryManager?.init) {
      window.HistoryManager.init(() => { _buildRecentlyViewed(); _buildQuickFavorites(); });
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

    document.getElementById('btn-prev-song')?.addEventListener('click', () => { if (!(window.SetlistUI?.getCurrentSetlist?.() && (window.SetlistUI?.getCurrentIndex?.() ?? -1) >= 0)) App?.navigatePrev?.(); });
    document.getElementById('btn-next-song')?.addEventListener('click', () => { if (!(window.SetlistUI?.getCurrentSetlist?.() && (window.SetlistUI?.getCurrentIndex?.() ?? -1) >= 0)) App?.navigateNext?.(); });
    document.getElementById('btn-search-lyrics')?.addEventListener('click', _toggleSearchMode);
    [categoryEl(), document.getElementById('sort-filter'), document.getElementById('season-filter'), document.getElementById('theme-filter')].forEach(el => el?.addEventListener('change', _onSearch));
    const btnToggle = document.getElementById('btn-filter-toggle'), panel = document.getElementById('sidebar-filters-panel');
    btnToggle?.addEventListener('click', () => {
      const isHidden = panel?.classList.toggle('hidden');
      btnToggle.setAttribute('aria-expanded', isHidden ? 'false' : 'true');
    });
    document.getElementById('btn-clear-filters')?.addEventListener('click', () => {
      if (categoryEl()) categoryEl().value = '';
      const sEl = document.getElementById('season-filter'); if (sEl) sEl.value = '';
      const tEl = document.getElementById('theme-filter'); if (tEl) tEl.value = '';
      _onSearch();
    });

    // Sidebar tabs
    document.getElementById('sidebar-tab-favs')?.addEventListener('click', _showFavorites);
    document.getElementById('sidebar-tab-lib')?.addEventListener('click', () => {
      document.querySelectorAll('.sidebar-tab').forEach(t => t.classList.remove('active'));
      document.getElementById('sidebar-tab-lib')?.classList.add('active');
      document.querySelectorAll('.sidebar-tab-content').forEach(c => c.classList.add('hidden'));
      document.getElementById('tab-content-library')?.classList.remove('hidden');
      render(songs);
    });

    _buildCategoryFilter();

    // ── Event Delegation (touch instant 0ms + click fallback) ──
    const list = listEl();
    if (list) {
      let _lastTouchId = '', _lastTouchTime = 0;
      list.addEventListener('touchstart', (e) => {
        const item = e.target.closest('.song-item');
        if (!item?.dataset.id || e.target.closest('.song-delete-btn,.song-add-setlist-btn,.song-fav-btn')) return;
        _lastTouchId = item.dataset.id; _lastTouchTime = Date.now();
        selectSong(item.dataset.id);
      }, { passive: true });

      list.addEventListener('click', (e) => {
        const btn = e.target.closest('.song-delete-btn');
        if (btn) { e.stopPropagation(); _handleDelete(btn); return; }
        const addSetBtn = e.target.closest('.song-add-setlist-btn');
        if (addSetBtn) { e.stopPropagation(); _promptAddToSetlist(addSetBtn.closest('.song-item')?.dataset.id); return; }
        const favBtn = e.target.closest('.song-fav-btn');
        if (favBtn) { e.stopPropagation(); _handleFav(favBtn); return; }
        const item = e.target.closest('.song-item');
        if (!item?.dataset.id) return;
        if (item.dataset.id === _lastTouchId && Date.now() - _lastTouchTime < 600) return;
        selectSong(item.dataset.id);
      });
    }
  }

  function _handleDelete(btn) {
    const item = btn.closest('.song-item');
    if (!item) return;
    const id = item.dataset.id, name = songs.find(s => s.id === id)?.title || 'bài này';
    if (confirm(`Xoá "${name}" khỏi thư viện?`)) deleteSong(id);
  }

  function _handleFav(btn) {
    const item = btn.closest('.song-item');
    if (!item || !window.HistoryManager) return;
    const id = item.dataset.id, song = songs.find(s => s.id === id);
    if (!song) return;
    const added = HistoryManager.toggleFavorite(song);
    btn.textContent = added ? '★' : '☆';
    btn.title       = added ? 'Bỏ yêu thích' : 'Thêm yêu thích';
    btn.classList.toggle('fav-active', added);
    App?.showToast(added ? '★ Đã thêm vào Yêu Thích' : 'Đã bỏ Yêu Thích', 'success');
    _buildQuickFavorites();
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
      _buildUpcomingSetlist();
      _buildRecentlyViewed();
      _buildQuickFavorites();
    }
    const urlSongId = new URLSearchParams(window.location.search).get('song');
    if (urlSongId) selectSong(urlSongId, false);
  }

  // ITEM_H: chiều cao mỗi song-item tương ứng CSS compact desktop (28px) vs mobile (38px)
  const ITEM_H = window.innerWidth >= 1024 ? 28 : 38, V_BUFFER = 6;

  let _virtualSongs = null, _virtualRaf = null, _vScrollBound = false;

  function _renderVirtualChunk() {
    if (!_virtualSongs || !_virtualSongs.length) return;
    const el = listEl(), container = el?.closest('.song-list-container') || el;
    if (!el || !container) return;
    const st = container.scrollTop || el.scrollTop || 0, vh = container.clientHeight || 600, total = _virtualSongs.length;
    const start = Math.max(0, Math.floor(st / ITEM_H) - V_BUFFER);
    const end = Math.min(total, Math.ceil((st + vh) / ITEM_H) + V_BUFFER);
    const topPad = start * ITEM_H, bottomPad = Math.max(0, (total - end) * ITEM_H);
    const frag = document.createDocumentFragment();
    if (topPad > 0) {
      const topDiv = document.createElement('div');
      topDiv.className = 'virtual-spacer';
      topDiv.style.height = `${topPad}px`;
      frag.appendChild(topDiv);
    }
    const canAdmin = window.Auth?.isAdmin?.() ?? false, canEdit = window.Auth?.isBanhat?.() ?? false;
    for (let i = start; i < end; i++) frag.appendChild(_createSongItem(_virtualSongs[i], canAdmin, canEdit));
    if (bottomPad > 0) {
      const botDiv = document.createElement('div');
      botDiv.className = 'virtual-spacer';
      botDiv.style.height = `${bottomPad}px`;
      frag.appendChild(botDiv);
    }
    el.innerHTML = '';
    el.appendChild(frag);
    if (activeSongId) _highlightActive(activeSongId, false);
  }

  function render(list, opts = {}) {
    _lastRenderedSongs = Array.isArray(list) ? list : [];
    const el = listEl();
    if (!el) return;

    if (!list || list.length === 0) {
      _virtualSongs = null;
      el.innerHTML = `<div class="empty-state"><span class="empty-icon">🎶</span><p>${opts.emptyMsg || 'Không tìm thấy bài hát'}</p><small>${opts.emptyHint || 'Thử từ khóa khác'}</small></div>`;
      return;
    }

    const isSearch = opts.isSearch || !!(searchEl()?.value || '').trim();
    const hasLyricMatches = isSearch && list.some(s => s.match_type === 'lyric');

    // Ticket L2-2: Ảo hoá danh sách khi danh sách lớn (> 35 bài)
    if (list.length > 35 && !(isSearch && hasLyricMatches)) {
      _virtualSongs = list;
      const container = el.closest('.song-list-container') || el;
      if (container && !_vScrollBound) {
        _vScrollBound = true;
        const onScroll = () => {
          if (!_virtualSongs) return;
          cancelAnimationFrame(_virtualRaf);
          _virtualRaf = requestAnimationFrame(_renderVirtualChunk);
        };
        container.addEventListener('scroll', onScroll, { passive: true });
        if (el !== container) el.addEventListener('scroll', onScroll, { passive: true });
      }
      _renderVirtualChunk();
      return;
    }

    _virtualSongs = null;
    const frag = document.createDocumentFragment();
    const canAdmin = window.Auth?.isAdmin?.() ?? false, canEdit = window.Auth?.isBanhat?.() ?? false;

    if (isSearch && hasLyricMatches) {
      const titleMatches = list.filter(s => s.match_type !== 'lyric');
      const lyricMatches = list.filter(s => s.match_type === 'lyric');
      if (titleMatches.length > 0) {
        const hTitle = document.createElement('div');
        hTitle.className = 'search-group-header search-group-title';
        hTitle.textContent = `🎵 Kết quả theo tên (${titleMatches.length})`;
        frag.appendChild(hTitle);
        titleMatches.forEach(song => frag.appendChild(_createSongItem(song, canAdmin, canEdit)));
      }
      if (lyricMatches.length > 0) {
        const hLyric = document.createElement('div');
        hLyric.className = 'search-group-header search-group-lyric';
        hLyric.textContent = `📝 Kết quả theo lời (${lyricMatches.length})`;
        frag.appendChild(hLyric);
        lyricMatches.forEach(song => frag.appendChild(_createSongItem(song, canAdmin, canEdit)));
      }
    } else {
      list.forEach(song => frag.appendChild(_createSongItem(song, canAdmin, canEdit)));
    }
    el.innerHTML = '';
    el.appendChild(frag);
    if (activeSongId) _highlightActive(activeSongId);
  }

  const _createBadge = (text, color) => { const b = document.createElement('span'); b.className = 'song-key-badge'; if (color) b.style.color = color; b.textContent = text; return b; };
  const _createActionBtn = (cls, title, text) => { const btn = document.createElement('button'); btn.className = cls; btn.title = title; btn.textContent = text; return btn; };

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
    const activeCount = (cat ? 1 : 0) + (season ? 1 : 0) + (theme ? 1 : 0);
    const badge  = document.getElementById('filter-active-badge');
    if (badge) { badge.textContent = String(activeCount); badge.classList.toggle('hidden', activeCount === 0); }
    document.getElementById('btn-filter-toggle')?.classList.toggle('active', activeCount > 0);

    // Ẩn thanh nhảy nhanh (Quick Jump STT) nếu đang lọc
    const quickJumpEl = document.querySelector('.quick-jump');
    if (quickJumpEl) {
      quickJumpEl.style.display = (mode === 'num' && !q && !cat && !season && !theme) ? '' : 'none';
    }

    // Nếu có từ khóa hoặc bộ lọc mùa lễ -> gọi API FTS5
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
          } else if (!q) {
            list = _sortSongs(list);
          }
          render(list, { isSearch: !!q, emptyMsg: q ? `Không tìm thấy "${q}"` : 'Không có bài hát phù hợp', emptyHint: 'Thử đổi mùa lễ hoặc từ khóa khác' });
          return;
        }
      } catch (err) { /* fallback local */ }
    }
    if (seq !== _searchSeq) return;

    // Client-side fallback & memory filtering
    const qLower = q.toLowerCase(), qUnacc = _removeAccents(qLower);
    let filtered = songs;
    if (cat) filtered = filtered.filter(s => s.category === cat);
    if (season) filtered = filtered.filter(s => (s.liturgical_season || '').toLowerCase() === season.toLowerCase());
    if (theme) filtered = filtered.filter(s => (s.theme || '').toLowerCase().includes(theme.toLowerCase()));

    if (q) {
      const numM = q.match(/^(?:#|bài\s+|bai\s+|stt\s+)?(\d+)$/i);
      const target = numM ? parseInt(numM[1], 10) : null;
      const titleMatches = [], lyricMatches = [];
      filtered.forEach(s => {
        const isNum = target !== null && Number(s.httlvnId) === target;
        const tLower = (s.title || '').toLowerCase(), tUnacc = _removeAccents(tLower);
        if (isNum) titleMatches.push({ ...s, match_type: 'title', relevance_tier: 0 });
        else if (tLower === qLower || tUnacc === qUnacc) titleMatches.push({ ...s, match_type: 'title', relevance_tier: 1 });
        else if (tLower.startsWith(qLower) || tUnacc.startsWith(qUnacc)) titleMatches.push({ ...s, match_type: 'title', relevance_tier: 2 });
        else if (tLower.includes(qLower) || tUnacc.includes(qUnacc)) titleMatches.push({ ...s, match_type: 'title', relevance_tier: 3 });
        else if (s.lyrics_text && (_removeAccents(s.lyrics_text.toLowerCase()).includes(qUnacc) || s.lyrics_text.toLowerCase().includes(qLower))) lyricMatches.push({ ...s, match_type: 'lyric', relevance_tier: 4 });
      });
      titleMatches.sort((a, b) => (a.relevance_tier || 0) - (b.relevance_tier || 0) || (Number(a.httlvnId) || 0) - (Number(b.httlvnId) || 0));
      lyricMatches.sort((a, b) => (Number(a.httlvnId) || 0) - (Number(b.httlvnId) || 0));
      filtered = [...titleMatches, ...lyricMatches];
      if (target !== null) {
        filtered.sort((a, b) => (Number(a.httlvnId) === target ? -1 : Number(b.httlvnId) === target ? 1 : (Number(a.httlvnId) || 0) - (Number(b.httlvnId) || 0)));
      }
    } else {
      filtered = _sortSongs(filtered);
    }
    render(filtered, { isSearch: !!q, emptyMsg: q ? `Không tìm thấy "${q}"` : 'Không có bài hát', emptyHint: q ? 'Thử từ khóa khác' : '' });
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

  // ── Dynamic Taxonomy & Category Filters (Ticket L2-3) ─────────
  function _buildCategoryFilter() {
    if (!songs || !songs.length) return;
    const cats = [...new Set(songs.map(s => s.category).filter(Boolean))].sort();
    const seasons = [...new Set(songs.map(s => s.liturgical_season).filter(Boolean))].sort();
    const themes = [...new Set(songs.map(s => s.theme).filter(Boolean))].sort();
    const sync = (id, wrapId, list, label) => {
      const el = document.getElementById(id), wrap = document.getElementById(wrapId);
      if (wrap) wrap.style.display = list.length > (id === 'category-filter' ? 1 : 0) ? '' : 'none';
      if (el) {
        if (list.length <= (id === 'category-filter' ? 1 : 0)) el.value = '';
        else {
          const cur = el.value;
          el.innerHTML = `<option value="">${label}</option>` + list.map(v => `<option value="${_esc(v)}"${v === cur ? ' selected' : ''}>${_esc(v)}</option>`).join('');
        }
      }
    };
    sync('category-filter', 'category-filter-wrap', cats, 'Tất cả danh mục');
    sync('season-filter', 'season-filter-wrap', seasons, 'Tất cả Mùa Lễ');
    sync('theme-filter', 'theme-filter-wrap', themes, 'Tất cả Chủ Đề');
    const avail = (cats.length > 1 ? 1 : 0) + (seasons.length > 0 ? 1 : 0) + (themes.length > 0 ? 1 : 0);
    document.getElementById('filter-empty-hint')?.classList.toggle('hidden', avail > 0);
  }

  // ── Quick Jump ───────────────────────────────────────────────
  function _buildQuickJump(list) {
    const container = document.getElementById('quick-jump-btns');
    if (!container) return;
    const ranges = [['1-100',1,100],['101-200',101,200],['201-300',201,300],['301-400',301,400],['401-500',401,500],['501-600',501,600],['601-700',601,700],['701-800',701,800],['801-900',801,900],['901+',901,9999]];
    const frag = document.createDocumentFragment();
    const makeBtn = (label, cls, filterFn) => {
      const btn = document.createElement('button');
      btn.className = `quick-jump-btn ${cls}`.trim();
      btn.textContent = label;
      const h = () => { container.querySelectorAll('.quick-jump-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); render(filterFn ? list.filter(filterFn) : songs); };
      btn.addEventListener('touchstart', h, { passive: true });
      btn.addEventListener('click', h);
      return btn;
    };
    frag.appendChild(makeBtn('Tất cả', 'quick-jump-all', null));
    ranges.forEach(([label, min, max]) => {
      if (list.some(s => (s.httlvnId || 0) >= min && (s.httlvnId || 0) <= max)) {
        frag.appendChild(makeBtn(label, '', s => (s.httlvnId || 0) >= min && (s.httlvnId || 0) <= max));
      }
    });
    container.innerHTML = ''; container.appendChild(frag);
  }

  // ── Upcoming Setlist (Ticket L2-4) ───────────────────────────
  async function _buildUpcomingSetlist() {
    const sec = document.getElementById('upcoming-setlist-section');
    if (!sec) return;
    try {
      const resp = await ApiService?.setlists?.list?.();
      const list = Array.isArray(resp) ? resp : (resp?.data ?? []);
      if (!list || !list.length) { sec.classList.add('hidden'); sec.style.display = 'none'; return; }
      const today = new Date().toISOString().split('T')[0];
      const item = list.filter(s => s.scheduled_date && s.scheduled_date >= today).sort((a,b) => a.scheduled_date.localeCompare(b.scheduled_date))[0] || list[0];
      const isToday = item.scheduled_date === today;
      sec.style.display = ''; sec.classList.remove('hidden');
      sec.innerHTML = `<div class="upcoming-setlist-card" data-id="${_esc(item.id)}" style="display:flex;align-items:center;justify-content:space-between;gap:8px;touch-action:manipulation;">` +
        `<div class="upcoming-setlist-info" style="flex:1;min-width:0;cursor:pointer;"><div style="font-size:0.68rem;font-weight:700;color:var(--accent);display:flex;align-items:center;gap:4px;text-transform:uppercase;"><svg class="icon icon-xs"><use href="#icon-calendar"/></svg><span>${isToday ? 'Chương trình hôm nay' : 'Chương trình sắp tới'}</span></div>` +
        `<div class="upcoming-setlist-title" style="font-size:0.8rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px;">${_esc(item.title)}</div>` +
        `<div style="font-size:0.68rem;color:var(--text-muted);margin-top:2px;">${item.item_count || 1} bài ${item.scheduled_date ? '· ' + item.scheduled_date : ''}</div></div>` +
        `<button class="btn btn-xs btn-primary btn-play-upcoming" style="flex-shrink:0;padding:4px 8px;font-size:0.72rem;display:inline-flex;align-items:center;gap:3px;" title="Mở chương trình"><svg class="icon icon-xs"><use href="#icon-play"/></svg> Mở</button></div>`;
      const open = () => { document.querySelector('[data-tab="setlist"]')?.click(); window.SetlistUI?.selectSetlist?.(item.id); };
      sec.querySelector('.upcoming-setlist-info')?.addEventListener('click', open);
      sec.querySelector('.btn-play-upcoming')?.addEventListener('click', open);
    } catch { sec.classList.add('hidden'); sec.style.display = 'none'; }
  }

  // ── Recently Viewed & Quick Favorites (Ticket L2-4) ───────────
  function _buildRecentlyViewed() {
    const sec = document.getElementById('recently-viewed-section');
    if (!sec || !window.HistoryManager) return;
    const recent = HistoryManager.getRecent?.() ?? [];
    if (!recent.length) { sec.style.display = 'none'; return; }
    sec.style.display = '';
    sec.innerHTML = `<div class="recent-header"><span>Gần đây</span><button id="btn-clear-history" class="btn btn-ghost btn-xs">Xóa</button></div>` +
      `<div class="recent-list">${recent.slice(0,5).map(s => `<div class="recent-item" data-id="${_esc(s.id)}" style="touch-action:manipulation"><span class="recent-num">${s.httlvnId ? String(s.httlvnId).padStart(3,'0') : ''}</span><span class="recent-title">${_esc(s.title)}</span></div>`).join('')}</div>`;
    let _rId = '', _rTime = 0;
    sec.querySelectorAll('.recent-item').forEach(it => {
      it.addEventListener('touchstart', () => { _rId = it.dataset.id; _rTime = Date.now(); selectSong(it.dataset.id); }, { passive: true });
      it.addEventListener('click', () => { if (it.dataset.id === _rId && Date.now() - _rTime < 600) return; selectSong(it.dataset.id); });
    });
    sec.querySelector('#btn-clear-history')?.addEventListener('click', e => { e.stopPropagation(); HistoryManager.clearHistory?.(); sec.style.display = 'none'; });
  }

  function _buildQuickFavorites() {
    const sec = document.getElementById('quick-favorites-section');
    if (!sec || !window.HistoryManager) return;
    const favs = HistoryManager.getFavorites?.() ?? [];
    if (!favs.length) { sec.classList.add('hidden'); sec.style.display = 'none'; return; }
    sec.style.display = ''; sec.classList.remove('hidden');
    sec.innerHTML = `<div class="recent-header"><span>⭐ Yêu thích (${favs.length})</span></div>` +
      `<div class="recent-list">${favs.slice(0,5).map(s => `<div class="recent-item fav-item" data-id="${_esc(s.id)}" style="touch-action:manipulation"><span class="recent-num">${s.httlvnId ? String(s.httlvnId).padStart(3,'0') : ''}</span><span class="recent-title">${_esc(s.title)}</span></div>`).join('')}</div>`;
    sec.querySelectorAll('.recent-item').forEach(it => {
      it.addEventListener('click', () => selectSong(it.dataset.id));
      it.addEventListener('touchstart', () => selectSong(it.dataset.id), { passive: true });
    });
  }

  function _showFavorites() {
    document.querySelectorAll('.sidebar-tab').forEach(t => t.classList.remove('active'));
    document.getElementById('sidebar-tab-favs')?.classList.add('active');
    document.querySelectorAll('.sidebar-tab-content').forEach(c => c.classList.add('hidden'));
    document.getElementById('tab-content-library')?.classList.remove('hidden');
    render(window.HistoryManager?.getFavorites?.() ?? [], { emptyMsg: 'Chưa có bài yêu thích', emptyHint: 'Nhấn ★ trên bài hát để thêm' });
  }

  async function _promptAddToSetlist(songId) {
    if (!songId) return;
    const resp = await ApiService.setlists.list(), data = Array.isArray(resp) ? resp : (resp?.data ?? []);
    if (!data.length) { window.App?.showToast('Chưa có Setlist nào được tạo', 'error'); return; }
    const modal = document.getElementById('add-to-setlist-modal'), opts = document.getElementById('add-to-setlist-options');
    if (!modal || !opts) return;
    opts.innerHTML = data.map(sl => `<div class="song-item" data-id="${_esc(sl.id)}" style="touch-action:manipulation"><div class="song-item-info"><div class="song-item-title">${_esc(sl.title)}</div></div></div>`).join('');
    const close = () => window.ModalManager ? window.ModalManager.close(modal) : modal.classList.add('hidden');
    opts.querySelectorAll('.song-item').forEach(it => it.addEventListener('click', async () => {
      close(); const setId = parseInt(it.dataset.id, 10); window.SetlistUI?.switchToSetlistTab?.(setId);
      if (window.SetlistUI?.addSongToSetlist) await window.SetlistUI.addSongToSetlist(setId, songId);
    }));
    window.ModalManager ? window.ModalManager.open(modal) : modal.classList.remove('hidden');
    document.getElementById('btn-close-add-setlist')?.addEventListener('click', close, { once: true });
    modal.addEventListener('click', e => { if (e.target === modal) close(); }, { once: true });
  }

  function selectSong(songId, updateUrl = true) {
    if (!songId) return;
    if (window.SetlistPlayer?.endSetlist && window.SetlistUI?.getCurrentSetlist?.() && (window.SetlistUI?.getCurrentIndex?.() ?? -1) >= 0) window.SetlistPlayer.endSetlist(false);
    activeSongId = String(songId);
    _highlightActive(activeSongId);
    if (updateUrl) {
      if (window.URLState?.resetForNewSong) window.URLState.resetForNewSong(songId);
      else { const u = new URL(window.location.href); u.searchParams.set('song', songId); window.history.pushState({}, '', u); }
    }
    let song = songs.find(s => String(s.id) === String(songId)) || _lastRenderedSongs.find(s => String(s.id) === String(songId));
    if (!song && window.OfflineSetlistManager?.getOfflineSong) song = window.OfflineSetlistManager.getOfflineSong(songId);
    if (song && !songs.some(s => String(s.id) === String(song.id))) songs.push(song);
    if (song && onSelectCb) onSelectCb(song);
  }

  function _highlightActive(id, autoScroll = true) {
    const el = listEl();
    if (!el) return;
    el.querySelectorAll('.song-item.active').forEach(i => i.classList.remove('active'));
    let active = el.querySelector(`.song-item[data-id="${CSS.escape(String(id))}"]`);
    if (!active && autoScroll && _virtualSongs) {
      const idx = _virtualSongs.findIndex(s => String(s.id) === String(id));
      const container = el.closest('.song-list-container');
      if (idx !== -1 && container) {
        container.scrollTop = Math.max(0, idx * ITEM_H - (container.clientHeight || 600) / 2);
        _renderVirtualChunk();
        active = el.querySelector(`.song-item[data-id="${CSS.escape(String(id))}"]`);
      }
    }
    if (active) {
      active.classList.add('active');
      if (autoScroll) active.scrollIntoView({ behavior: 'instant', block: 'nearest' });
    }
  }

  // ── CRUD ─────────────────────────────────────────────────────
  function addSong(song) {
    if (!songs.find(s => String(s.id) === String(song.id))) {
      songs.push(song);
      songs.sort((a, b) => (a.httlvnId || 0) - (b.httlvnId || 0));
    }
    render(songs); _updateCount(songs.length); selectSong(song.id);
  }

  async function deleteSong(id) {
    await ApiService.songs.delete(id);
    songs = songs.filter(s => String(s.id) !== String(id));
    render(songs); _updateCount(songs.length);
    if (String(activeSongId) === String(id)) { activeSongId = null; AppUI?.showWelcome?.(); }
    if (onDeleteCb) onDeleteCb(id);
  }

  // ── Helpers ───────────────────────────────────────────────────
  function _updateCount(n) { const b = document.getElementById('library-count'); if (b) b.textContent = n; }
  function _esc(str) {
    if (window.SafeHtml?.escape) return window.SafeHtml.escape(str);
    return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function _highlightText(text, query) {
    if (!text) return '';
    const safeText = _esc(text), cleanQ = (query || '').trim();
    if (!cleanQ) return safeText;
    const map = { a: '[aáàảãạăắằẳẵặâấầẩẫậ]', e: '[eéèẻẽẹêếềểễệ]', i: '[iíìỉĩị]', o: '[oóòỏõọôốồổỗộơớờởỡợ]', u: '[uúùủũụưứừửữự]', y: '[yýỳỷỹỵ]', d: '[dđ]' };
    const parts = cleanQ.split(/\s+/).filter(Boolean).map(w => w.toLowerCase().split('').map(c => map[c] || c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join(''));
    return parts.length === 0 ? safeText : safeText.replace(new RegExp('(' + parts.join('|') + ')', 'gi'), '<mark>$1</mark>');
  }

  const onSelect = cb => { onSelectCb = cb; }, onDelete = cb => { onDeleteCb = cb; }, getSongs = () => songs;
  const getActiveSong = () => songs.find(s => String(s.id) === String(activeSongId)) || null;
  const getSongObj = id => songs.find(s => String(s.id) === String(id)) || _lastRenderedSongs.find(s => String(s.id) === String(id)) || null;

  return { init, loadSongs, render, selectSong, addSong, deleteSong, onSelect, onDelete, getSongs, getActiveSong, getSongObj };
})();

window.LibraryUI = LibraryUI;
