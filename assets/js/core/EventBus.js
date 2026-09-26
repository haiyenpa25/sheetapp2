/**
 * core/EventBus.js — Pub/Sub Event System
 * Giải quyết coupling giữa các module (không cần gọi trực tiếp nhau)
 *
 * Sự kiện chuẩn:
 *   song:selected   { song }
 *   song:loaded     { song, xml }
 *   song:cleared    {}
 *   transpose:changed { value }
 *   zoom:changed    { value }
 *   chord:saved     { measureIdx, noteIdx, chord }
 */

const EventBus = (() => {
  'use strict';
  const _listeners = {};

  function on(event, handler) {
    (_listeners[event] = _listeners[event] || []).push(handler);
    // Return off function for cleanup
    return () => off(event, handler);
  }

  function off(event, handler) {
    if (!_listeners[event]) return;
    _listeners[event] = _listeners[event].filter(h => h !== handler);
  }

  function emit(event, data = {}) {
    (_listeners[event] || []).forEach(h => {
      try { h(data); } catch(e) { console.error(`[EventBus] ${event}:`, e); }
    });
  }

  /** One-time listener */
  function once(event, handler) {
    const off = on(event, (data) => { off(); handler(data); });
  }

  return { on, off, emit, once };
})();

window.EventBus = EventBus;
