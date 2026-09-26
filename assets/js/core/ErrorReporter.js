/**
 * assets/js/core/ErrorReporter.js — Global client error reporter
 * Tách biệt hoàn toàn khỏi EventBus.js, gửi log lỗi qua ApiService.
 */
const ErrorReporter = (() => {
  'use strict';

  function report(errData) {
    if (window.ApiService && typeof window.ApiService.reportError === 'function') {
      window.ApiService.reportError(errData).catch(() => {});
    } else if (window.ApiService && window.ApiService.errors && typeof window.ApiService.errors.report === 'function') {
      window.ApiService.errors.report(errData).catch(() => {});
    }
  }

  function init() {
    window.onerror = function(message, source, lineno, colno, error) {
      const errData = {
        type: 'error',
        message: String(message || ''),
        source: String(source || ''),
        lineno: lineno || 0,
        colno: colno || 0,
        stack: error ? error.stack : ''
      };
      report(errData);
    };

    window.onunhandledrejection = function(event) {
      const errData = {
        type: 'rejection',
        reason: event.reason ? (event.reason.message || String(event.reason)) : 'unknown',
        stack: event.reason && event.reason.stack ? event.reason.stack : ''
      };
      report(errData);
    };
  }

  return { init, report };
})();

if (typeof window !== 'undefined') {
  window.ErrorReporter = ErrorReporter;
  ErrorReporter.init();
}
