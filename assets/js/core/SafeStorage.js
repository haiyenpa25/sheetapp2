/**
 * assets/js/core/SafeStorage.js
 * M2-6: Truy cập localStorage an toàn, không bao giờ throw trên Safari Private / Zalo WebView / đầy bộ nhớ.
 */
const SafeStorage = (() => {
  'use strict';

  const _mem = new Map();

  function _storage() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
      if (typeof localStorage !== 'undefined') return localStorage;
    } catch (_) {}
    return null;
  }

  function get(key, fallback = null) {
    const k = String(key);
    try {
      const st = _storage();
      if (st) {
        const val = st.getItem(k);
        if (val !== null && val !== undefined) return val;
      }
    } catch (_) {}
    return _mem.has(k) ? _mem.get(k) : fallback;
  }

  function set(key, value) {
    const k = String(key);
    const v = String(value ?? '');
    _mem.set(k, v);
    try {
      const st = _storage();
      if (st) {
        st.setItem(k, v);
        return true;
      }
    } catch (_) {}
    return false;
  }

  function remove(key) {
    const k = String(key);
    _mem.delete(k);
    try {
      const st = _storage();
      if (st) st.removeItem(k);
    } catch (_) {}
    return true;
  }

  function getJson(key, fallback = null) {
    const raw = get(key, null);
    if (raw === null || raw === undefined || raw === '') return fallback;
    try {
      return JSON.parse(raw);
    } catch (_) {
      return fallback;
    }
  }

  function setJson(key, value) {
    try {
      return set(key, JSON.stringify(value));
    } catch (_) {
      return false;
    }
  }

  return {
    get,
    set,
    remove,
    getJson,
    setJson,
  };
})();

if (typeof window !== 'undefined') {
  window.SafeStorage = SafeStorage;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SafeStorage;
}
