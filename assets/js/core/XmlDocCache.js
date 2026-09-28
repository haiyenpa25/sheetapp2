/**
 * XmlDocCache.js — Centralized MusicXML DOM Document Cache
 * Part of SheetApp Performance Engine (Ticket L5-3)
 *
 * Cache đối tượng Document XML trong bộ nhớ để tránh việc 8+ module
 * cùng gọi new DOMParser().parseFromString() trên cùng một chuỗi XML.
 */
const XmlDocCache = (() => {
  'use strict';

  let _lastXml = null;
  let _cachedDoc = null;
  let _parseCount = 0; // Đếm số lần parse thực tế phục vụ đo lường và kiểm thử

  /**
   * Lấy Document XML đã parse. Nếu xmlString trùng khớp với cache, trả về ngay Document đã có.
   * @param {string} xmlString - Nội dung MusicXML
   * @returns {Document|null}
   */
  function getDoc(xmlString) {
    if (!xmlString || typeof xmlString !== 'string') return null;
    if (_lastXml === xmlString && _cachedDoc) {
      return _cachedDoc;
    }
    _lastXml = xmlString;
    _parseCount++;
    try {
      _cachedDoc = new DOMParser().parseFromString(xmlString, 'text/xml');
    } catch (e) {
      console.error('[XmlDocCache] Lỗi parse XML:', e);
      _cachedDoc = null;
    }
    return _cachedDoc;
  }

  /**
   * Lấy bản sao (clone) của Document XML đã parse khi cần chỉnh sửa (mutate)
   * mà không làm thay đổi hay nhiễm bẩn Document gốc trong cache.
   * @param {string} xmlString - Nội dung MusicXML
   * @returns {Document|null}
   */
  function getClonedDoc(xmlString) {
    const doc = getDoc(xmlString);
    return doc ? doc.cloneNode(true) : null;
  }

  /**
   * Serialize Document XML thành chuỗi, đảm bảo luôn có tiền tố XML declaration hợp lệ cho OSMD.
   * @param {Document|Node} doc
   * @returns {string}
   */
  function serializeDoc(doc) {
    if (!doc) return '';
    let str = (typeof XMLSerializer !== 'undefined') ? new XMLSerializer().serializeToString(doc) : '';
    if (str && !str.startsWith('<?xml')) {
      str = '<?xml version="1.0" encoding="UTF-8"?>\n' + str;
    }
    return str;
  }

  /**
   * Xóa bộ nhớ đệm
   */
  function clear() {
    _lastXml = null;
    _cachedDoc = null;
  }

  function getParseCount() { return _parseCount; }
  function resetParseCount() { _parseCount = 0; }

  return {
    getDoc,
    getClonedDoc,
    serializeDoc,
    clear,
    getParseCount,
    resetParseCount
  };
})();

if (typeof window !== 'undefined') {
  window.XmlDocCache = XmlDocCache;
}
