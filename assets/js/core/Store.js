/**
 * core/Store.js — Centralized State Management
 * Single source of truth cho app state.
 * Tự emit EventBus event khi state thay đổi.
 */
const Store = (() => {
  'use strict';

  const _state = {
    currentSong:      null,   // Song object { id, title, xmlPath, defaultKey, ... }
    originalXml:      null,   // Raw MusicXML string (không bị modify)
    currentTranspose: 0,      // Semitone offset
    currentZoom:      1.0,    // Zoom ratio (0.5-2.0)
    capoLevel:        0,      // Capo ngăn
  };

  function get(key) {
    return key ? _state[key] : { ..._state };
  }

  function set(key, value) {
    if (!(key in _state)) {
      console.warn(`[Store] Unknown key: ${key}`);
      return;
    }
    const prev = _state[key];
    _state[key] = value;
    if (prev !== value && window.EventBus) {
      EventBus.emit('state:changed', { key, value, prev });
      EventBus.emit(`state:${key}`, { value, prev });
    }
  }

  function reset(keys = null) {
    const targets = keys || Object.keys(_state);
    const defaults = { currentSong: null, originalXml: null, currentTranspose: 0, currentZoom: 1.0, capoLevel: 0 };
    targets.forEach(k => set(k, defaults[k]));
  }

  return { get, set, reset };
})();

window.Store = Store;
