/**
 * assets/js/core/OSMDRenderCore.js
 * M3-1: Một hàng đợi vẽ OSMD duy nhất, token chống chồng lệnh, debounce resize/xoay 250ms,
 * bỏ qua khi bề rộng 0 hoặc khung đang ẩn, try/catch báo lỗi vào panel M2-4.
 */
const OSMDRenderCore = (() => {
  'use strict';

  const RESIZE_DEBOUNCE_MS = 250;
  let _token = 0;
  let _pendingRender = false;
  let _resizeTimer = null;
  let _queuePromise = Promise.resolve();

  function _resolveContainer(containerOrId) {
    if (!containerOrId) return null;
    if (typeof containerOrId === 'string') {
      return typeof document !== 'undefined' ? document.getElementById(containerOrId) : null;
    }
    return containerOrId;
  }

  function canRender(containerOrId) {
    const c = _resolveContainer(containerOrId);
    if (!c || (c.clientWidth ?? 0) <= 0) return false;
    if (c.classList?.contains?.('hidden') || c.closest?.('.hidden')) return false;
    const style = (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function')
      ? window.getComputedStyle(c)
      : c.style;
    if (style && (style.display === 'none' || style.visibility === 'hidden')) return false;
    return true;
  }

  function nextToken() {
    return ++_token;
  }

  function getToken() {
    return _token;
  }

  function reportRenderError(err) {
    try {
      window.ErrorReporter?.report?.('osmd.render', err);
      const song = window.Store?.get?.('currentSong');
      window.AppUI?.showLoadError?.(song, {
        message: 'Không vẽ được bản nhạc',
        onRetry: () => {
          const cur = window.Store?.get?.('currentSong') || song;
          if (cur) window.SongLoader?.load?.(cur, window.Store?.get?.('currentTranspose') ?? 0);
        },
      });
    } catch (_) {}
  }

  function enqueueRender(containerOrId, renderFn, opts = {}) {
    const token = opts.token || ++_token;
    if (!canRender(containerOrId)) {
      _pendingRender = true;
      return Promise.resolve({ rendered: false, pending: true, token });
    }
    _pendingRender = false;
    const run = async () => {
      if (token !== _token && !opts.allowOlderToken) {
        return { rendered: false, stale: true, token };
      }
      if (!canRender(containerOrId)) {
        _pendingRender = true;
        return { rendered: false, pending: true, token };
      }
      try {
        await renderFn(token);
        return { rendered: true, pending: false, token };
      } catch (err) {
        reportRenderError(err);
        if (opts.rethrow) throw err;
        return { rendered: false, error: err, token };
      }
    };
    _queuePromise = _queuePromise.then(run, run);
    return _queuePromise;
  }

  function scheduleResize(containerOrId, renderFn, debounceMs = RESIZE_DEBOUNCE_MS) {
    if (_resizeTimer) clearTimeout(_resizeTimer);
    return new Promise((resolve) => {
      _resizeTimer = setTimeout(() => {
        _resizeTimer = null;
        enqueueRender(containerOrId, renderFn).then(resolve, () => resolve({ rendered: false }));
      }, debounceMs);
    });
  }

  function clearPendingResize() {
    if (_resizeTimer) {
      clearTimeout(_resizeTimer);
      _resizeTimer = null;
    }
  }

  function hasPendingRender() {
    return _pendingRender;
  }

  function setPendingRender(val) {
    _pendingRender = Boolean(val);
  }

  return {
    RESIZE_DEBOUNCE_MS,
    canRender,
    nextToken,
    getToken,
    reportRenderError,
    enqueueRender,
    scheduleResize,
    clearPendingResize,
    hasPendingRender,
    setPendingRender,
  };
})();

if (typeof window !== 'undefined') {
  window.OSMDRenderCore = OSMDRenderCore;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = OSMDRenderCore;
}
