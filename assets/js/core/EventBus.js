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
window.onerror = function(message, source, lineno, colno, error) {
  const errData = {
    type: 'error',
    message: String(message || ''),
    source: String(source || ''),
    lineno: lineno || 0,
    colno: colno || 0,
    stack: error ? error.stack : ''
  };
  fetch('api/log_error.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(errData)
  }).catch(() => {});
};

window.onunhandledrejection = function(event) {
  const errData = {
    type: 'rejection',
    reason: event.reason ? (event.reason.message || String(event.reason)) : 'unknown',
    stack: event.reason && event.reason.stack ? event.reason.stack : ''
  };
  fetch('api/log_error.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(errData)
  }).catch(() => {});
};

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
