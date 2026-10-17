/**
 * history-manager.js
 * Quản lý Recently Viewed (10 bài gần nhất) và Favorites
 * Lưu trong localStorage — không cần backend
 */
const HistoryManager = (() => {
  'use strict';

  const HISTORY_KEY   = 'sheetapp_history_v1';
  const FAVORITES_KEY = 'sheetapp_favorites_v1';
  const MAX_HISTORY   = 15;

  let _onChangeCb = null;

  /* ---- PUBLIC API ---- */

  function init(onChangeCb) {
    _onChangeCb = onChangeCb || null;
  }

  /** Ghi lại bài vừa mở */
  function trackView(song) {
    if (!song || !song.id) return;
    const history = getHistory();
    // Remove nếu đã có (để đẩy lên đầu)
    const filtered = history.filter(s => s.id !== song.id);
    filtered.unshift({
      id:       song.id,
      title:    song.title,
      httlvnId: song.httlvnId,
      defaultKey: song.defaultKey,
      viewedAt: Date.now()
    });
    const trimmed = filtered.slice(0, MAX_HISTORY);
    _save(HISTORY_KEY, trimmed);
    _notify();
  }

  /** Lấy danh sách lịch sử (mới nhất trước) */
  function getHistory() {
    return _load(HISTORY_KEY) || [];
  }

  /** Bật/tắt yêu thích */
  function toggleFavorite(song) {
    if (!song || !song.id) return false;
    const favs = getFavorites();
    const idx  = favs.findIndex(s => s.id === song.id);
    if (idx >= 0) {
      favs.splice(idx, 1);
    } else {
      favs.push({
        id:       song.id,
        title:    song.title,
        httlvnId: song.httlvnId,
        defaultKey: song.defaultKey,
        savedAt:  Date.now()
      });
    }
    _save(FAVORITES_KEY, favs);
    _notify();
    return idx < 0; // true = đã thêm, false = đã xóa
  }

  /** Kiểm tra bài có trong favorites không */
  function isFavorite(songId) {
    return getFavorites().some(s => s.id === String(songId));
  }

  /** Lấy danh sách favorites */
  function getFavorites() {
    return _load(FAVORITES_KEY) || [];
  }

  /** Xóa toàn bộ lịch sử*/
  function clearHistory() {
    _save(HISTORY_KEY, []);
    _notify();
  }

  /* ---- INTERNAL ---- */

  function _save(key, data) {
    try { localStorage.setItem(key, JSON.stringify(data)); } catch(e) {}
  }

  function _load(key) {
    try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch(e) { return null; }
  }

  function _notify() {
    if (_onChangeCb) _onChangeCb();
  }

  return { init, trackView, getHistory, toggleFavorite, isFavorite, getFavorites, clearHistory };
})();
