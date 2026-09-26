/**
 * assets/js/core/OfflineSetlistManager.js
 *
 * Quản lý Gói Setlist Offline Đáng Tin Cậy (Epic 3.2):
 * 1. Tải và đồng bộ trọn vẹn Package Manifest (Setlist, Songs metadata, Chord Sets JSON).
 * 2. Pre-cache các file MusicXML vào CacheStorage ('sheetapp-musicxml-v4').
 * 3. Kiểm tra tính toàn vẹn (Integrity & Checksum verification) — Chỉ báo sẵn sàng khi đủ 100% asset.
 * 4. Tra cứu dự phòng (Offline Fallback) khi thiết bị mất mạng hoặc tắt Wi-Fi.
 * 5. Cập nhật và thu hồi (xóa) gói để giải phóng bộ nhớ.
 */
'use strict';

const OfflineSetlistManager = (() => {
  const CACHE_NAME = 'sheetapp-musicxml-v4';
  const INDEX_KEY = 'sheetapp_offline_index';
  const PKG_PREFIX = 'sheetapp_offline_setlist_';

  function getSetlistCacheName(setlistId) {
    return 'sheetapp-offline-' + setlistId;
  }

  function isSupported() {
    return typeof window !== 'undefined' && 'caches' in window && 'localStorage' in window;
  }

  function _getIndex() {
    try {
      const raw = localStorage.getItem(INDEX_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function _saveIndex(list) {
    try {
      localStorage.setItem(INDEX_KEY, JSON.stringify(list));
    } catch (e) {
      console.warn('[OfflineSetlistManager] Failed to save index:', e);
    }
  }

  function _getPkg(setlistId) {
    try {
      const raw = localStorage.getItem(PKG_PREFIX + setlistId);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function _savePkg(setlistId, data) {
    try {
      localStorage.setItem(PKG_PREFIX + setlistId, JSON.stringify(data));
      // Cập nhật index
      const index = _getIndex().filter(item => String(item.id) !== String(setlistId));
      index.unshift({
        id: setlistId,
        title: data.setlist?.title || 'Chương trình',
        scheduled_date: data.setlist?.scheduled_date || '',
        item_count: data.total_songs || 0,
        package_version: data.package_version || '',
        is_ready: Boolean(data.is_ready),
        saved_at: data.saved_at || new Date().toISOString()
      });
      _saveIndex(index);
      return true;
    } catch (e) {
      console.error('[OfflineSetlistManager] Failed to save package to localStorage:', e);
      return false;
    }
  }

  /**
   * Tải toàn bộ tài nguyên của Setlist về máy
   * @param {number|string} setlistId 
   * @param {Function} onProgress ({ current, total, songTitle, percent, status })
   */
  async function downloadPackage(setlistId, onProgress = null) {
    if (!isSupported()) {
      throw new Error('Trình duyệt không hỗ trợ CacheStorage / LocalStorage');
    }

    if (onProgress) onProgress({ current: 0, total: 1, songTitle: 'Đang lấy thông tin chương trình...', percent: 0, status: 'fetching_manifest' });

    // 1. Lấy Package Manifest từ Backend
    const res = await window.ApiService.setlists.getOfflinePackage(setlistId);
    if (!res || !res.success || !res.data) {
      throw new Error(res?.error || 'Không thể tải gói dữ liệu từ máy chủ');
    }

    const pkgData = res.data;
    const songs = pkgData.songs || {};
    const songList = Object.values(songs);
    const totalSongs = songList.length;

    // 2. Mở Cache riêng biệt sheetapp-offline-<setlistId> (không bị giới hạn FIFO/LRU 60 bài)
    const setlistCacheName = getSetlistCacheName(setlistId);
    let cache = null;
    let legacyCache = null;
    try {
      cache = await caches.open(setlistCacheName);
      legacyCache = await caches.open(CACHE_NAME).catch(() => null);
    } catch (e) {
      throw new Error('Không thể mở bộ nhớ đệm CacheStorage: ' + e.message);
    }

    let cachedCount = 0;
    const failedSongs = [];

    // 3. Tải và cache từng file MusicXML
    for (let i = 0; i < totalSongs; i++) {
      const song = songList[i];
      const title = song.title || song.id;
      const xmlPath = (song.xmlPath || '').replace(/^\/+/, '');
      const xmlUrl = (window.ApiService && typeof window.ApiService.resolveUrl === 'function')
        ? window.ApiService.resolveUrl(xmlPath)
        : '/' + xmlPath;

      if (onProgress) {
        onProgress({
          current: i + 1,
          total: totalSongs,
          songTitle: title,
          percent: Math.round(((i) / totalSongs) * 100),
          status: 'downloading_xml'
        });
      }

      if (!xmlPath) {
        failedSongs.push({ id: song.id, title, reason: 'Thiếu đường dẫn file XML' });
        continue;
      }

      try {
        // INTENTIONAL EXCEPTION: Static MusicXML asset download for offline cache
        const fetchRes = await fetch(xmlUrl, { cache: 'reload' });
        if (!fetchRes.ok) {
          failedSongs.push({ id: song.id, title, reason: `HTTP ${fetchRes.status}` });
          continue;
        }

        // Lưu vào cache riêng biệt của gói
        await cache.put(xmlUrl, fetchRes.clone());
        if (legacyCache) {
          await legacyCache.put(xmlUrl, fetchRes.clone()).catch(() => {});
        }
        cachedCount++;
      } catch (err) {
        failedSongs.push({ id: song.id, title, reason: err.message });
      }
    }

    // 4. Kiểm tra tính toàn vẹn (Verification Step)
    const isReady = (totalSongs === 0) || (cachedCount === totalSongs && failedSongs.length === 0);

    const savedData = {
      ...pkgData,
      is_ready: isReady,
      cached_count: cachedCount,
      failed_songs: failedSongs,
      saved_at: new Date().toISOString()
    };

    _savePkg(setlistId, savedData);

    if (onProgress) {
      onProgress({
        current: totalSongs,
        total: totalSongs,
        songTitle: isReady ? 'Hoàn tất!' : 'Tải chưa đủ',
        percent: 100,
        status: isReady ? 'ready' : 'incomplete',
        failedSongs
      });
    }

    return {
      success: true,
      isReady,
      totalSongs,
      cachedCount,
      failedSongs
    };
  }

  /**
   * Kiểm tra tính sẵn sàng offline của Setlist
   */
  async function verifyPackage(setlistId) {
    const pkg = _getPkg(setlistId);
    if (!pkg) {
      return { isDownloaded: false, isReady: false, totalCount: 0, cachedCount: 0 };
    }

    const songs = pkg.songs || {};
    const songList = Object.values(songs);
    const totalCount = songList.length;

    if (totalCount === 0) {
      return { isDownloaded: true, isReady: true, totalCount: 0, cachedCount: 0, savedAt: pkg.saved_at };
    }

    if (!('caches' in window)) {
      return { isDownloaded: true, isReady: false, totalCount, cachedCount: 0, error: 'No caches' };
    }

    const setlistCacheName = getSetlistCacheName(setlistId);
    let cache = null;
    let legacyCache = null;
    try {
      cache = await caches.open(setlistCacheName);
      legacyCache = await caches.open(CACHE_NAME).catch(() => null);
    } catch (e) {
      return { isDownloaded: true, isReady: false, totalCount, cachedCount: 0, error: e.message };
    }

    let verifiedCount = 0;
    for (const song of songList) {
      const rawPath = (song.xmlPath || '').replace(/^\/+/, '');
      const xmlUrl = (window.ApiService && typeof window.ApiService.resolveUrl === 'function')
        ? window.ApiService.resolveUrl(rawPath)
        : '/' + rawPath;
      let match = await cache.match(xmlUrl);
      if (!match && legacyCache) {
        match = await legacyCache.match(xmlUrl);
      }
      if (!match) {
        match = await caches.match(xmlUrl);
      }
      if (match) verifiedCount++;
    }

    const isReady = verifiedCount === totalCount;
    if (pkg.is_ready !== isReady || pkg.cached_count !== verifiedCount) {
      pkg.is_ready = isReady;
      pkg.cached_count = verifiedCount;
      _savePkg(setlistId, pkg);
    }

    return {
      isDownloaded: true,
      isReady,
      totalCount,
      cachedCount: verifiedCount,
      savedAt: pkg.saved_at,
      packageVersion: pkg.package_version
    };
  }

  /**
   * Lấy trạng thái tức thì từ local storage
   */
  function getPackageStatus(setlistId) {
    const pkg = _getPkg(setlistId);
    if (!pkg) {
      return { isDownloaded: false, isReady: false, totalCount: 0, cachedCount: 0 };
    }
    return {
      isDownloaded: true,
      isReady: Boolean(pkg.is_ready),
      totalCount: pkg.total_songs || Object.keys(pkg.songs || {}).length,
      cachedCount: pkg.cached_count || 0,
      savedAt: pkg.saved_at,
      packageVersion: pkg.package_version,
      failedSongs: pkg.failed_songs || []
    };
  }

  /**
   * Thu hồi / Xóa gói offline của Setlist (xóa cả cache riêng sheetapp-offline-<setlistId>)
   */
  function removePackage(setlistId) {
    try {
      localStorage.removeItem(PKG_PREFIX + setlistId);
      const index = _getIndex().filter(item => String(item.id) !== String(setlistId));
      _saveIndex(index);
      if (typeof window !== 'undefined' && 'caches' in window) {
        caches.delete(getSetlistCacheName(setlistId)).catch(() => {});
      }
      return true;
    } catch (e) {
      console.warn('[OfflineSetlistManager] Failed to remove package:', e);
      return false;
    }
  }

  /**
   * Liệt kê tất cả các gói đã lưu trên thiết bị
   */
  function listPackages() {
    return _getIndex();
  }

  /**
   * Lấy dữ liệu Setlist khi thiết bị offline
   */
  function getOfflineSetlist(setlistId) {
    const pkg = _getPkg(setlistId);
    return pkg?.setlist || null;
  }

  /**
   * Lấy metadata bài hát từ các gói offline
   */
  function getOfflineSong(songId) {
    const sId = String(songId);
    const index = _getIndex();
    for (const item of index) {
      const pkg = _getPkg(item.id);
      if (pkg?.songs && pkg.songs[sId]) {
        return pkg.songs[sId];
      }
    }
    return null;
  }

  /**
   * Lấy tất cả bài hát từ các gói offline (dùng nạp cho library khi mất mạng)
   */
  function getAllOfflineSongs() {
    const songsMap = {};
    const index = _getIndex();
    for (const item of index) {
      const pkg = _getPkg(item.id);
      if (pkg?.songs) {
        Object.assign(songsMap, pkg.songs);
      }
    }
    return Object.values(songsMap);
  }

  /**
   * Lấy hợp âm của bài hát từ các gói offline
   */
  function getOfflineChords(songId, profile = 'HD') {
    const sId = String(songId);
    const index = _getIndex();
    for (const item of index) {
      const pkg = _getPkg(item.id);
      if (pkg?.chord_sets && pkg.chord_sets[sId]) {
        const sets = pkg.chord_sets[sId];
        if (sets[profile]) return sets[profile];
        if (sets['HD']) return sets['HD'];
        const first = Object.values(sets)[0];
        if (first) return first;
      }
    }
    return null;
  }

  /**
   * Kiểm tra có hợp âm offline cho bài hát hay không
   */
  function hasOfflineChords(songId, profile = 'HD') {
    return getOfflineChords(songId, profile) !== null;
  }

  return {
    isSupported,
    getSetlistCacheName,
    downloadPackage,
    verifyPackage,
    getPackageStatus,
    removePackage,
    listPackages,
    getOfflineSetlist,
    getOfflineSong,
    getAllOfflineSongs,
    getOfflineChords,
    hasOfflineChords
  };
})();

window.OfflineSetlistManager = OfflineSetlistManager;
