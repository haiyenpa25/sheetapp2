/**
 * url-state.js — v1.0
 * Quản lý URL params để persist viewing state.
 * Không tạo browser history mới (dùng replaceState) → back button vẫn đúng.
 *
 * Params:
 *   song    = song slug         (mandatory, set by library-ui)
 *   t       = transpose int     (-8..+8, omit if 0)
 *   v       = view              ('lyric', omit if 'sheet')
 *   lv      = lyric variant     ('inline', omit if 'stacked')
 *   set     = chord set name    (omit if 'default')
 *   compact = compact mode      ('1', omit if off)
 */
const URLState = (() => {
  'use strict';

  // Default values — omit from URL if matches
  const DEFAULTS = { t: 0, v: 'sheet', lv: 'stacked', set: 'HD', compact: false };
  let _inPopstate = false;

  /**
   * Đọc state hiện tại từ URL
   */
  function get() {
    const p = new URLSearchParams(location.search);
    return {
      song:    p.get('song')    || null,
      setlist: p.get('setlist') || p.get('program') || null,
      t:       parseInt(p.get('t') || '0', 10),
      v:       p.get('v')       || 'sheet',
      lv:      p.get('lv')      || 'stacked',
      set:     p.get('set')     || 'HD',
      compact: p.get('compact') === '1',
    };
  }

  /**
   * Cập nhật một hoặc nhiều params, giữ nguyên các params khác
   * @param {Object} patch — params cần thay đổi
   */
  function update(patch) {
    const url = new URL(location.href);
    for (const [k, v] of Object.entries(patch)) {
      const isDefault =
        (k === 't'       && v === 0)         ||
        (k === 'v'       && v === 'sheet')    ||
        (k === 'lv'      && v === 'stacked')  ||
        (k === 'set'     && v === 'HD')       ||
        (k === 'compact' && !v);

      if (isDefault) {
        url.searchParams.delete(k);
      } else {
        url.searchParams.set(k, String(v));
      }
    }
    history.replaceState(null, '', url);
  }

  /**
   * Reset params khi chọn bài mới (xóa transpose/set/view cũ)
   * Dùng pushState để tạo history entry mới (back button đúng)
   */
  function resetForNewSong(songId) {
    const curSetlist = new URLSearchParams(location.search).get('setlist') || new URLSearchParams(location.search).get('program');
    const url = new URL(location.origin + location.pathname);
    url.searchParams.set('song', songId);
    if (curSetlist && window.SetlistUI?.getCurrentSetlist?.()) url.searchParams.set('setlist', curSetlist);
    if (_inPopstate) history.replaceState({ song: songId }, '', url); else history.pushState({ song: songId }, '', url);
  }

  /**
   * Restore state sau khi song đã load xong.
   * Trả về object state để caller apply từng phần.
   */
  function restore() {
    return get();
  }

  function interfaceUrl(classic) {
    const base = (window.__APP_BASE__ || '').replace(/\/$/, '');
    const url = new URL(`${base}/${classic ? 'old/' : ''}`, location.origin);
    const params = new URLSearchParams(location.search);
    ['song', 'setlist', 'program', 't', 'v', 'lv', 'set', 'compact'].forEach(key => {
      if (params.has(key)) url.searchParams.set(key, params.get(key));
    });
    const activeSong = window.App?.getCurrentSongId?.();
    if (activeSong) url.searchParams.set('song', activeSong);
    // The two interfaces can have different device defaults; make the current view explicit.
    if (!url.searchParams.has('v')) url.searchParams.set('v', 'sheet');
    return url.href;
  }

  window.addEventListener?.('popstate', (ev) => { const sid = ev?.state?.song || get().song; if (!sid || String(window.App?.getCurrentSongId?.() || '') === String(sid)) return; _inPopstate = true; try { const sObj = window.LibraryUI?.getSongObj?.(sid) || window.LibraryUI?.getSongById?.(sid); if (sObj && window.App?.loadSong) { resetForNewSong(sid); window.App.loadSong(sObj, get().t || 0); } else window.LibraryUI?.selectSongById?.(sid); } finally { _inPopstate = false; } });
  return { get, update, resetForNewSong, restore, interfaceUrl };
})();

window.URLState = URLState;
