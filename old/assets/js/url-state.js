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

  /**
   * Đọc state hiện tại từ URL
   */
  function get() {
    const p = new URLSearchParams(location.search);
    return {
      song:    p.get('song')    || null,
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
    const url = new URL(location.origin + location.pathname);
    url.searchParams.set('song', songId);
    history.pushState({ song: songId }, '', url);
  }

  /**
   * Restore state sau khi song đã load xong.
   * Trả về object state để caller apply từng phần.
   */
  function restore() {
    return get();
  }

  return { get, update, resetForNewSong, restore };
})();

window.URLState = URLState;
