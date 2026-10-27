/**
 * assets/js/core/ErrorReporter.js — Global client error reporter (M1-5)
 * Dùng chung cho Modern và Classic: gửi log lỗi qua ApiService (client_log)
 * và hiển thị toast có nút "Tải lại" tối đa 1 lần mỗi 30 giây khi gặp lỗi chưa bắt.
 */
const ErrorReporter = (() => {
  'use strict';

  const TOAST_COOLDOWN_MS = 30000;
  const TOAST_ID = 'error-reporter-toast';
  let _lastToastAt = 0;

  function report(errData) {
    if (typeof window === 'undefined') return;
    if (window.ApiService && typeof window.ApiService.reportError === 'function') {
      window.ApiService.reportError(errData).catch(e => {
        if (typeof console !== 'undefined' && typeof console.warn === 'function') {
          console.warn('[ErrorReporter] Failed to send client_log:', e);
        }
      });
    } else if (window.ApiService && window.ApiService.errors && typeof window.ApiService.errors.report === 'function') {
      window.ApiService.errors.report(errData).catch(e => {
        if (typeof console !== 'undefined' && typeof console.warn === 'function') {
          console.warn('[ErrorReporter] Failed to send client_log:', e);
        }
      });
    }
  }

  function _showReloadToast() {
    if (typeof document === 'undefined' || typeof document.createElement !== 'function') return false;
    const now = Date.now();
    if (_lastToastAt > 0 && now - _lastToastAt < TOAST_COOLDOWN_MS) {
      return false;
    }
    _lastToastAt = now;

    const existing = document.getElementById(TOAST_ID);
    if (existing && existing.parentNode) {
      existing.parentNode.removeChild(existing);
    }

    const root = document.body || document.documentElement;
    if (!root || typeof root.appendChild !== 'function') return false;

    const toast = document.createElement('div');
    toast.id = TOAST_ID;
    toast.setAttribute('role', 'alert');
    toast.style.cssText = [
      'position:fixed',
      'bottom:16px',
      'left:50%',
      'transform:translateX(-50%)',
      'z-index:999998',
      'background:#1e293b',
      'color:#f8fafc',
      'border:1px solid #f59e0b',
      'border-radius:10px',
      'padding:10px 14px',
      'display:flex',
      'align-items:center',
      'gap:10px',
      'box-shadow:0 8px 24px rgba(0,0,0,0.45)',
      'font-family:system-ui,-apple-system,sans-serif',
      'font-size:14px',
      'max-width:92vw',
    ].join(';');

    const text = document.createElement('span');
    text.textContent = 'Đã xảy ra lỗi không mong muốn · ';

    const reloadBtn = document.createElement('button');
    reloadBtn.id = 'error-reporter-reload-btn';
    reloadBtn.type = 'button';
    reloadBtn.textContent = 'Tải lại';
    reloadBtn.style.cssText = [
      'background:#f59e0b',
      'color:#0f172a',
      'border:none',
      'border-radius:6px',
      'padding:6px 12px',
      'font-weight:700',
      'cursor:pointer',
      'min-height:36px',
    ].join(';');
    reloadBtn.onclick = function () {
      if (typeof window !== 'undefined' && window.location && typeof window.location.reload === 'function') {
        window.location.reload();
      }
    };

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Đóng');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = [
      'background:transparent',
      'color:#cbd5e1',
      'border:none',
      'padding:4px 8px',
      'cursor:pointer',
      'font-size:14px',
    ].join(';');
    closeBtn.onclick = function () {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    };

    toast.appendChild(text);
    toast.appendChild(reloadBtn);
    toast.appendChild(closeBtn);
    root.appendChild(toast);
    return true;
  }

  function init() {
    if (typeof window === 'undefined') return;

    window.onerror = function (message, source, lineno, colno, error) {
      const errData = {
        type: 'error',
        message: String(message || ''),
        source: String(source || ''),
        lineno: lineno || 0,
        colno: colno || 0,
        stack: error && error.stack ? String(error.stack) : '',
      };
      report(errData);
      _showReloadToast();
    };

    window.onunhandledrejection = function (event) {
      const reason = event && event.reason ? (event.reason.message || String(event.reason)) : 'unknown';
      const errData = {
        type: 'rejection',
        message: reason,
        reason,
        stack: event && event.reason && event.reason.stack ? String(event.reason.stack) : '',
      };
      report(errData);
      _showReloadToast();
    };
  }

  function resetToastCooldown() {
    _lastToastAt = 0;
  }

  return { init, report, resetToastCooldown };
})();

if (typeof window !== 'undefined') {
  window.ErrorReporter = ErrorReporter;
  ErrorReporter.init();
}
