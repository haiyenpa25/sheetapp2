/**
 * assets/js/core/LibraryData.js
 * M5-3: Dữ liệu thư viện dùng chung cho cả Modern và Classic:
 * - Tải danh sách bài hát qua ApiService.songs.list() + fallback OfflineSetlistManager
 * - Giải quyết deep link ?song= (tra trong danh sách hoặc gọi ApiService.songs.get)
 * - Hiển thị trạng thái lỗi danh sách ("Không tải được danh sách · Thử lại") và xử lý Thử lại
 */
const LibraryData = (() => {
  'use strict';

  const LOAD_ERROR_MESSAGE = 'Không tải được danh sách · Thử lại';
  let _songs = [];
  let _loadError = false;

  async function fetchList() {
    _loadError = false;
    try {
      const resp = await window.ApiService.songs.list();
      const list = Array.isArray(resp) ? resp : (resp?.data || []);
      _songs = Array.isArray(list) ? list : [];
    } catch (err) {
      _loadError = true;
      console.error('[LibraryData] Lỗi tải danh sách:', err);
      const offline = window.OfflineSetlistManager?.getAllOfflineSongs?.() || [];
      _songs = Array.isArray(offline) ? offline : [];
    }
    return _songs;
  }

  function getSongs() {
    return _songs;
  }

  function setSongs(list) {
    _songs = Array.isArray(list) ? list : [];
    return _songs;
  }

  function hasLoadError() {
    return _loadError;
  }

  function shouldShowErrorState() {
    return _loadError && _songs.length === 0;
  }

  function findSong(songId, extraList = []) {
    if (!songId) return null;
    const target = String(songId);
    return (
      _songs.find((s) => String(s.id) === target) ||
      (Array.isArray(extraList) ? extraList.find((s) => String(s.id) === target) : null) ||
      window.OfflineSetlistManager?.getOfflineSong?.(songId) ||
      null
    );
  }

  function upsertSong(song) {
    if (!song || !song.id) return;
    if (!_songs.some((s) => String(s.id) === String(song.id))) {
      _songs.push(song);
    }
  }

  function removeSong(songId) {
    _songs = _songs.filter((s) => String(s.id) !== String(songId));
    return _songs;
  }

  function getDeepLinkSongId(search) {
    const rawSearch =
      typeof search === 'string'
        ? search
        : typeof window !== 'undefined' && window.location
          ? window.location.search || ''
          : '';
    if (!rawSearch) return '';
    try {
      return new URLSearchParams(rawSearch).get('song') || '';
    } catch (_) {
      return '';
    }
  }

  function resolveSong(songId, extraList = [], onResolved = null) {
    if (!songId) return Promise.resolve(null);
    const localSong = findSong(songId, extraList);
    if (localSong) {
      upsertSong(localSong);
      if (typeof onResolved === 'function') onResolved(localSong, 'local');
      return Promise.resolve(localSong);
    }
    if (!window.ApiService?.songs?.get) return Promise.resolve(null);
    return window.ApiService.songs
      .get(songId)
      .then((s) => {
        if (s && s.id) {
          upsertSong(s);
          if (typeof onResolved === 'function') onResolved(s, 'remote');
          return s;
        }
        return null;
      })
      .catch((err) => {
        window.ErrorReporter?.report?.('library.resolveSong', err);
        return null;
      });
  }

  function retryLoad(reloadFn) {
    window.ApiService?.songs?.invalidateCache?.();
    if (typeof reloadFn === 'function') return reloadFn();
  }

  function renderLoadError(containerEl, reloadFn, options = {}) {
    if (!containerEl) return;
    const iconHtml = options.icon ? `<span class="empty-icon">${options.icon}</span>` : '';
    containerEl.innerHTML = `<div class="empty-state" id="library-load-error">${iconHtml}<p>${LOAD_ERROR_MESSAGE}</p><button type="button" class="btn btn-sm btn-primary" id="btn-retry-song-list" style="margin-top:6px;">Thử lại</button></div>`;
    containerEl.querySelector?.('#btn-retry-song-list')?.addEventListener('click', () => retryLoad(reloadFn));
  }

  return {
    LOAD_ERROR_MESSAGE,
    fetchList,
    getSongs,
    setSongs,
    hasLoadError,
    shouldShowErrorState,
    findSong,
    upsertSong,
    removeSong,
    getDeepLinkSongId,
    resolveSong,
    retryLoad,
    renderLoadError,
  };
})();

if (typeof window !== 'undefined') {
  window.LibraryData = LibraryData;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LibraryData;
}
