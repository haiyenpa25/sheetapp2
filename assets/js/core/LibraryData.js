/**
 * assets/js/core/LibraryData.js
 * M5-3 & M5-5: Dữ liệu thư viện & Ghim bài dùng chung cho cả Modern và Classic:
 * - Tải danh sách bài hát qua ApiService.songs.list() + fallback OfflineSetlistManager
 * - Giải quyết deep link ?song= (tra trong danh sách hoặc gọi ApiService.songs.get)
 * - Hiển thị trạng thái lỗi danh sách ("Không tải được danh sách · Thử lại") và xử lý Thử lại
 * - Quản lý Ghim nhanh bài hát buổi lễ (PIN_STORAGE_KEY, togglePin, isPinned, #quick-pin-bar)
 */
const LibraryData = (() => {
  'use strict';

  const LOAD_ERROR_MESSAGE = 'Không tải được danh sách · Thử lại';
  const PIN_STORAGE_KEY = 'sheetapp_old_pins';
  let _songs = [];
  let _loadError = false;
  let _pinnedIds = [];

  function _esc(str) {
    return window.SafeHtml?.escape
      ? window.SafeHtml.escape(str)
      : String(str ?? '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
  }

  function loadPins() {
    try {
      const raw = window.SafeStorage
        ? window.SafeStorage.get(PIN_STORAGE_KEY, null)
        : localStorage.getItem(PIN_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      _pinnedIds = Array.isArray(parsed) ? parsed.map(String) : [];
    } catch (_) {
      _pinnedIds = [];
    }
    return _pinnedIds;
  }

  function _savePins() {
    try {
      const json = JSON.stringify(_pinnedIds);
      if (window.SafeStorage) window.SafeStorage.set(PIN_STORAGE_KEY, json);
      else localStorage.setItem(PIN_STORAGE_KEY, json);
    } catch (_) {}
  }

  function isPinned(songId) {
    return _pinnedIds.includes(String(songId));
  }

  function syncPinToolbarBtn(activeSongId) {
    const btn = typeof document !== 'undefined' ? document.getElementById('btn-pin-current-song') : null;
    if (!btn) return;
    const pinned = Boolean(activeSongId && isPinned(activeSongId));
    btn.classList?.toggle?.('active', pinned);
  }

  function renderPinBar(activeSongId, selectFn) {
    const bar = typeof document !== 'undefined' ? document.getElementById('quick-pin-bar') : null;
    if (!bar) return;
    const pinnedSongs = _pinnedIds.map((id) => _songs.find((s) => String(s.id) === id)).filter(Boolean);
    if (!pinnedSongs.length) {
      bar.classList?.add?.('hidden');
      bar.innerHTML = '';
      return;
    }
    bar.classList?.remove?.('hidden');
    bar.innerHTML =
      `<span class="pin-bar-label">📌 Ghim (${pinnedSongs.length}):</span>` +
      `<div class="pin-bar-list">` +
      pinnedSongs
        .map((s) => {
          const num = s.httlvnId ? String(s.httlvnId).padStart(3, '0') + '. ' : '';
          const key = s.defaultKey || s.keySignature || '';
          const activeCls = String(s.id) === String(activeSongId) ? ' active' : '';
          return `<div class="pin-bar-item${activeCls}" data-id="${_esc(s.id)}" title="${_esc(s.title)}"><span class="pin-bar-text">${_esc(num + s.title)}${key ? ` <b>[${_esc(key)}]</b>` : ''}</span><button class="pin-bar-remove" data-remove-id="${_esc(s.id)}" title="Bỏ ghim">&times;</button></div>`;
        })
        .join('') +
      `</div>` +
      `<button id="btn-clear-pins" class="pin-bar-clear" title="Xóa toàn bộ bài đã ghim">Xóa hết</button>`;

    bar.querySelectorAll?.('.pin-bar-item')?.forEach((el) => {
      window.LibraryGestures?.bind?.(el, (e) => {
        const rm = e.target?.closest?.('.pin-bar-remove');
        if (rm) {
          e.stopPropagation?.();
          togglePin(rm.dataset.removeId, activeSongId, selectFn);
          return;
        }
        if (typeof selectFn === 'function') selectFn(el.dataset.id);
      });
    });
    bar.querySelector?.('#btn-clear-pins')?.addEventListener('click', () => {
      _pinnedIds = [];
      _savePins();
      renderPinBar(activeSongId, selectFn);
      syncPinToolbarBtn(activeSongId);
    });
  }

  function togglePin(songId, activeSongId, selectFn) {
    if (!songId) return false;
    const id = String(songId);
    const idx = _pinnedIds.indexOf(id);
    const added = idx === -1;
    if (added) _pinnedIds.push(id);
    else _pinnedIds.splice(idx, 1);
    _savePins();
    syncPinToolbarBtn(activeSongId);
    renderPinBar(activeSongId, selectFn);
    window.App?.showToast?.(added ? '📌 Đã ghim lên thanh Ghim nhanh' : 'Đã bỏ ghim bài hát', 'info');
    return added;
  }

  async function fetchList() {
    _loadError = false;
    try {
      const resp = await window.ApiService.songs.list();
      const list = Array.isArray(resp) ? resp : resp?.data || [];
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
    window.ApiService?.songs?.invalidateCache?.(); if (typeof window !== 'undefined' && Array.isArray(window.__failedScripts) && window.__failedScripts.length > 0) { window.location?.reload?.(); return; }
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
    PIN_STORAGE_KEY,
    loadPins,
    isPinned,
    togglePin,
    renderPinBar,
    syncPinToolbarBtn,
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
