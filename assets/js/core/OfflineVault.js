/**
 * assets/js/core/OfflineVault.js — Kho Lưu Trữ Offline IndexedDB & Tìm Kiếm Không Dấu Tức Thì
 * Sprint S1 (KE_HOACH_SKILLS_VA_GITHUB.md):
 *  1. Lưu trữ danh mục 903 bài hát và nội dung MusicXML vào IndexedDB qua window.idbKeyval
 *     (vượt giới hạn 5MB của localStorage, hoạt động 100% offline trên iPad/Tablet nhà thờ).
 *  2. Cung cấp hàm chuẩn hóa bỏ dấu tiếng Việt (window.normalizeVi) và bộ lọc tìm kiếm mờ
 *     (OfflineVault.searchSongs) tốc độ < 1ms cho cả giao diện chính (/) và giao diện cũ (/old/).
 */
const OfflineVault = (() => {
  'use strict';

  const CATALOG_KEY = 'sheetapp_catalog_v2';
  const XML_PREFIX  = 'sheetapp_xml:';
  const _memXml     = new Map();

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
        s._normLyric = normalizeVi(s.lyricSnippet || '');
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

      if (mode === 'lyric') {
        const rawLyric = (s.lyricSnippet || '').toLowerCase();
        if (rawLyric.includes(q)) return true;
        const normLyric = s._normLyric ?? normalizeVi(s.lyricSnippet || '');
        if (tokens.length > 0 && tokens.every(t => normLyric.includes(t))) {
          return true;
        }
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

  /** Lưu nội dung MusicXML của 1 bài hát vào IndexedDB + RAM */
  async function saveXml(xmlPath, xmlContent) {
    if (!xmlPath || !xmlContent) return false;
    const key = XML_PREFIX + String(xmlPath).replace(/^\/+/, '');
    _memXml.set(key, xmlContent);
    try {
      if (typeof window !== 'undefined' && window.idbKeyval) {
        await window.idbKeyval.set(key, xmlContent);
        return true;
      }
    } catch (_) {}
    return false;
  }

  /** Lấy nội dung MusicXML từ RAM hoặc IndexedDB */
  async function getXml(xmlPath) {
    if (!xmlPath) return null;
    const key = XML_PREFIX + String(xmlPath).replace(/^\/+/, '');
    if (_memXml.has(key)) return _memXml.get(key);
    try {
      if (typeof window !== 'undefined' && window.idbKeyval) {
        const xml = await window.idbKeyval.get(key);
        if (typeof xml === 'string' && xml.length > 0) {
          _memXml.set(key, xml);
          return xml;
        }
      }
    } catch (_) {}
    return null;
  }

  return {
    normalizeVi,
    indexSongs,
    searchSongs,
    saveCatalog,
    getCatalog,
    saveXml,
    getXml,
  };
})();

if (typeof window !== 'undefined') {
  window.OfflineVault = OfflineVault;
  window.normalizeVi  = OfflineVault.normalizeVi;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = OfflineVault;
}
