/**
 * core/EventBus.js — Pub/Sub Event System
 * Giải quyết coupling giữa các module (không cần gọi trực tiếp nhau)
 *
 * Sự kiện chuẩn:
 *   song:selected     { song }
 *   song:loaded       { song, xml }
 *   song:cleared      {}
 *   transpose:changed { value }
 *   zoom:changed      { value }
 *   chord:saved       { measureIdx, noteIdx, chord }
 */
const EventBus = (() => {
  'use strict';
  const _listeners = {};

  function on(event, handler) {
    (_listeners[event] = _listeners[event] || []).push(handler);
    return () => off(event, handler);
  }

  function off(event, handler) {
    if (!_listeners[event]) return;
    _listeners[event] = _listeners[event].filter(h => h !== handler);
  }

  function emit(event, data = {}) {
    (_listeners[event] || []).forEach(h => {
      try { h(data); } catch (e) { console.error(`[EventBus] ${event}:`, e); }
    });
  }

  function once(event, handler) {
    const offFn = on(event, (data) => { offFn(); handler(data); });
  }

  return { on, off, emit, once };
})();

window.EventBus = EventBus;

if (!window.escapeHtml) {
  const _ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  window.escapeHtml = (v) => String(v ?? '').replace(/[&<>"']/g, c => _ESC_MAP[c]);
  window.safeHtml = (strings, ...vals) => strings.reduce((out, s, i) => out + window.escapeHtml(vals[i - 1]) + s);
}

