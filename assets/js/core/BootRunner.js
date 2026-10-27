/**
 * assets/js/core/BootRunner.js — Isolated Module Bootstrap Runner (M1-1)
 * Isolates module init() failures so a broken or missing script never aborts
 * application startup or prevents song selection.
 */
const BootRunner = (() => {
  'use strict';

  const _failures = [];

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

  function getFailures() {
    return _failures.slice();
  }

  return {
    safeInit,
    getFailures,
  };
})();

if (typeof window !== 'undefined') {
  window.BootRunner = BootRunner;
}
