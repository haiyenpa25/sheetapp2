/**
 * assets/js/core/OfflineVault.js — Kho Lưu Trữ Offline IndexedDB & Tìm Kiếm Không Dấu Tức Thì
 * Sprint S1 (KE_HOACH_SKILLS_VA_GITHUB.md) + M2-6 (LRU 10 bài XML + Gói Setlist Offline trên IndexedDB):
 *  1. Lưu trữ danh mục 903 bài hát, gói setlist offline và nội dung MusicXML vào IndexedDB qua window.idbKeyval
 *     (vượt giới hạn 5MB của localStorage, hoạt động 100% offline trên iPad/Tablet nhà thờ).
 *  2. Giới hạn bộ nhớ RAM _memXml ở LRU 10 bài hát để tránh tràn RAM trên thiết bị di động.
 *  3. Cung cấp hàm chuẩn hóa bỏ dấu tiếng Việt (window.normalizeVi) và bộ lọc tìm kiếm mờ
 *     (OfflineVault.searchSongs) tốc độ < 1ms cho cả giao diện chính (/) và giao diện cũ (/old/).
 */
const OfflineVault = (() => {
  'use strict';

  const CATALOG_KEY   = 'sheetapp_catalog_public_v3';
  const XML_PREFIX    = 'sheetapp_xml:';
  const PKG_INDEX_KEY = 'sheetapp_offline_index';
  const PKG_PREFIX    = 'sheetapp_offline_setlist_';
  const MAX_MEM_XML   = 10;

  const _memXml  = new Map();
  const _memPkgs = new Map();
  let _memPkgIndex = null;

  function _putMemXml(key, xmlContent) {
    if (_memXml.has(key)) _memXml.delete(key);
    _memXml.set(key, xmlContent);
    while (_memXml.size > MAX_MEM_XML) {
      const oldestKey = _memXml.keys().next().value;
      if (oldestKey === undefined) break;
      _memXml.delete(oldestKey);
    }
  }

  /** Chuẩn hóa chuỗi tiếng Việt về không dấu, chữ thường để tìm kiếm tức thì (< 1ms) */
  function normalizeVi(str) {
    if (!str) return '';
    return String(str)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[đĐ]/g, 'd')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** Tạo chỉ mục tìm kiếm không dấu trên danh sách bài hát */
  function indexSongs(songs) {
    if (!Array.isArray(songs)) return [];
    for (let i = 0; i < songs.length; i++) {
      const s = songs[i];
      if (s && !s._normTitle) {
        s._normTitle = normalizeVi(s.title || '');
        s._normLyric = normalizeVi(s.lyrics_text || s.lyricSnippet || '');
      }
    }
    return songs;
  }

  /**
   * Tìm kiếm bài hát hỗ trợ cả có dấu & không dấu tiếng Việt, số bài (001..903) và multi-token
   */
  function searchSongs(songs, rawQuery, mode = 'title') {
    if (!Array.isArray(songs) || !rawQuery) return songs;
    const q = String(rawQuery).trim().toLowerCase();
    if (!q) return songs;

    indexSongs(songs);
    const normQ = normalizeVi(q);
    const tokens = normQ.split(' ').filter(Boolean);
    const isNumQuery = /^\d+$/.test(q);
    const qNum = isNumQuery ? parseInt(q, 10) : NaN;

    return songs.filter(s => {
      if (mode === 'lyric') {
        const lyric = s._normLyric ?? normalizeVi(s.lyrics_text || s.lyricSnippet || '');
        return tokens.length > 0 && tokens.every(token => lyric.includes(token));
      }
      if (isNumQuery) {
        if (s.httlvnId === qNum || String(s.httlvnId || '').padStart(3, '0').includes(q)) {
          return true;
        }
      }
      const rawTitle = (s.title || '').toLowerCase();
      if (rawTitle.includes(q)) return true;

      const normTitle = s._normTitle ?? normalizeVi(s.title || '');
      if (tokens.length > 0 && tokens.every(t => normTitle.includes(t))) {
        return true;
      }

      return false;
    });
  }

  /** Lưu danh mục bài hát vào IndexedDB */
  async function saveCatalog(songs) {
    if (!Array.isArray(songs) || songs.length === 0) return false;
    try {
      if (typeof window !== 'undefined' && window.idbKeyval) {
        await window.idbKeyval.set(CATALOG_KEY, { updatedAt: Date.now(), songs });
        return true;
      }
    } catch (_) {}
    return false;
  }

  /** Đọc danh mục bài hát từ IndexedDB khi mất mạng */
  async function getCatalog() {
    try {
      if (typeof window !== 'undefined' && window.idbKeyval) {
        const entry = await window.idbKeyval.get(CATALOG_KEY);
        if (entry && Array.isArray(entry.songs) && entry.songs.length > 0) {
          return entry.songs;
        }
      }
    } catch (_) {}
    return null;
  }

  /** Lưu nội dung MusicXML của 1 bài hát vào IndexedDB + RAM (LRU 10 bài) */
  async function saveXml(xmlPath, xmlContent) {
    if (!xmlPath || !xmlContent) return false;
    const key = XML_PREFIX + String(xmlPath).replace(/^\/+/, '');
    _putMemXml(key, xmlContent);
    try {
      if (typeof window !== 'undefined' && window.idbKeyval) {
        await window.idbKeyval.set(key, xmlContent);
        return true;
      }
    } catch (_) {}
    return false;
  }

  /** Lấy nội dung MusicXML từ RAM (cập nhật thứ tự LRU) hoặc IndexedDB */
  async function getXml(xmlPath) {
    if (!xmlPath) return null;
    const key = XML_PREFIX + String(xmlPath).replace(/^\/+/, '');
    if (_memXml.has(key)) {
      const cached = _memXml.get(key);
      _putMemXml(key, cached);
      return cached;
    }
    try {
      if (typeof window !== 'undefined' && window.idbKeyval) {
        const xml = await window.idbKeyval.get(key);
        if (typeof xml === 'string' && xml.length > 0) {
          _putMemXml(key, xml);
          return xml;
        }
      }
    } catch (_) {}
    return null;
  }

  /** Lưu gói Setlist Offline vào RAM + IndexedDB */
  async function savePackage(setlistId, data) {
    if (setlistId === undefined || setlistId === null || !data) return false;
    const id = String(setlistId);
    _memPkgs.set(id, data);
    try {
      if (typeof window !== 'undefined' && window.idbKeyval) {
        await window.idbKeyval.set(PKG_PREFIX + id, data);
        return true;
      }
    } catch (_) {}
    return true;
  }

  function getPackage(setlistId) {
    if (setlistId === undefined || setlistId === null) return null;
    return _memPkgs.get(String(setlistId)) || null;
  }

  async function removePackage(setlistId) {
    if (setlistId === undefined || setlistId === null) return false;
    const id = String(setlistId);
    _memPkgs.delete(id);
    try {
      if (typeof window !== 'undefined' && window.idbKeyval && typeof window.idbKeyval.del === 'function') {
        await window.idbKeyval.del(PKG_PREFIX + id);
      }
    } catch (_) {}
    return true;
  }

  async function savePackageIndex(list) {
    if (!Array.isArray(list)) return false;
    _memPkgIndex = list;
    try {
      if (typeof window !== 'undefined' && window.idbKeyval) {
        await window.idbKeyval.set(PKG_INDEX_KEY, list);
        return true;
      }
    } catch (_) {}
    return true;
  }

  function getPackageIndex() {
    return Array.isArray(_memPkgIndex) ? _memPkgIndex : null;
  }

  async function hydratePackages() {
    try {
      if (typeof window !== 'undefined' && window.idbKeyval) {
        const idx = await window.idbKeyval.get(PKG_INDEX_KEY);
        if (Array.isArray(idx)) {
          _memPkgIndex = idx;
          for (const item of idx) {
            if (item && item.id !== undefined) {
              const pkg = await window.idbKeyval.get(PKG_PREFIX + String(item.id));
              if (pkg) _memPkgs.set(String(item.id), pkg);
            }
          }
        }
      }
    } catch (_) {}
    return _memPkgIndex;
  }

  return {
    _memXml,
    normalizeVi,
    indexSongs,
    searchSongs,
    saveCatalog,
    getCatalog,
    saveXml,
    getXml,
    savePackage,
    getPackage,
    removePackage,
    savePackageIndex,
    getPackageIndex,
    hydratePackages,
  };
})();

if (typeof window !== 'undefined') {
  window.OfflineVault = OfflineVault;
  window.normalizeVi  = OfflineVault.normalizeVi;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = OfflineVault;
}
