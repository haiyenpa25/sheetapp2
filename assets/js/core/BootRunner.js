/**
 * assets/js/core/BootRunner.js — Isolated Module Bootstrap Runner & Watchdog (M1-1, M1-2)
 * Isolates module init() failures so a broken or missing script never aborts
 * application startup or prevents song selection. Also runs an 8-second standalone
 * watchdog that shows a reload banner if App has not marked itself ready.
 */
const BootRunner = (() => {
  'use strict';

  const DEFAULT_WATCHDOG_MS = 8000;
  const BANNER_ID = 'boot-watchdog-banner';
  const _failures = [];
  let _isReady = false;
  let _watchdogTimer = null;

  function _recordFailure(name, err) {
    const message = err && err.message ? String(err.message) : String(err || 'Unknown boot error');
    const stack = err && err.stack ? String(err.stack) : '';
    _failures.push({ name: String(name || 'unknown'), message });
    if (typeof console !== 'undefined' && typeof console.error === 'function') {
      console.error(`[BootRunner] Init failed in ${name}:`, err);
    }
    if (typeof window !== 'undefined' && window.ErrorReporter && typeof window.ErrorReporter.report === 'function') {
      try {
        window.ErrorReporter.report({
          type: 'boot_error',
          module: String(name || 'unknown'),
          message: `[BootRunner:${name}] ${message}`,
          stack,
        });
      } catch (_) {}
    }
  }

  function safeInit(name, fn) {
    if (typeof fn !== 'function') return false;
    try {
      const res = fn();
      if (res && typeof res.catch === 'function') {
        res.catch(err => _recordFailure(name, err));
      }
      return true;
    } catch (err) {
      _recordFailure(name, err);
      return false;
    }
  }

  function _showWatchdogBanner() {
    if (typeof document === 'undefined') return null;
    const existing = document.getElementById(BANNER_ID);
    if (existing) return existing;

    const mount = () => {
      if (_isReady) return;
      if (document.getElementById(BANNER_ID)) return;
      const root = document.body || document.documentElement;
      if (!root || typeof document.createElement !== 'function') return;

      const banner = document.createElement('div');
      banner.id = BANNER_ID;
      banner.setAttribute('role', 'alert');
      banner.style.cssText = [
        'position:fixed',
        'top:12px',
        'left:50%',
        'transform:translateX(-50%)',
        'z-index:999999',
        'background:#1e293b',
        'color:#f8fafc',
        'border:1px solid #ef4444',
        'border-radius:10px',
        'padding:10px 14px',
        'display:flex',
        'align-items:center',
        'gap:8px',
        'box-shadow:0 8px 24px rgba(0,0,0,0.45)',
        'font-family:system-ui,-apple-system,sans-serif',
        'font-size:14px',
        'max-width:92vw',
      ].join(';');

      const label = document.createElement('span');
      label.textContent = 'Ứng dụng chưa tải xong · ';

      const btn = document.createElement('button');
      btn.id = 'boot-watchdog-reload-btn';
      btn.type = 'button';
      btn.textContent = 'Tải lại';
      btn.style.cssText = [
        'background:#ef4444',
        'color:#ffffff',
        'border:none',
        'border-radius:6px',
        'padding:6px 12px',
        'font-weight:600',
        'cursor:pointer',
        'min-height:36px',
      ].join(';');
      btn.onclick = function () {
        if (typeof window !== 'undefined' && window.location && typeof window.location.reload === 'function') {
          window.location.reload();
        }
      };

      banner.appendChild(label);
      banner.appendChild(btn);
      if (typeof root.appendChild === 'function') {
        root.appendChild(banner);
      }
    };

    if (document.body || document.documentElement) {
      mount();
    } else if (typeof document.addEventListener === 'function') {
      document.addEventListener('DOMContentLoaded', mount);
    }
    return document.getElementById(BANNER_ID);
  }

  function startWatchdog(customTimeoutMs) {
    if (typeof setTimeout !== 'function') return;
    if (_watchdogTimer !== null && typeof clearTimeout === 'function') {
      clearTimeout(_watchdogTimer);
    }
    const configured = (typeof window !== 'undefined' && Number(window.__BOOT_WATCHDOG_MS__) > 0)
      ? Number(window.__BOOT_WATCHDOG_MS__)
      : DEFAULT_WATCHDOG_MS;
    const ms = Number(customTimeoutMs) > 0 ? Number(customTimeoutMs) : configured;

    _watchdogTimer = setTimeout(() => {
      _watchdogTimer = null;
      if (!_isReady) {
        _showWatchdogBanner();
      }
    }, ms);
  }

  function markReady() {
    if (_failures.some(f => f && (f.name === 'LibraryUI' || f.name === 'LibraryUI.onSelect' || f.name === 'SongLoader'))) return;
    _isReady = true;
    if (_watchdogTimer !== null && typeof clearTimeout === 'function') {
      clearTimeout(_watchdogTimer);
      _watchdogTimer = null;
    }
    if (typeof document !== 'undefined' && typeof document.getElementById === 'function') {
      const banner = document.getElementById(BANNER_ID);
      if (banner && banner.parentNode) {
        banner.parentNode.removeChild(banner);
      } else if (banner && typeof banner.remove === 'function') {
        banner.remove();
      }
    }
  }

  function isReady() {
    return _isReady;
  }

  function getFailures() {
    return _failures.slice();
  }

  return {
    safeInit,
    startWatchdog,
    markReady,
    isReady,
    getFailures,
  };
})();

if (typeof window !== 'undefined') {
  window.BootRunner = BootRunner;
  BootRunner.startWatchdog();
}
