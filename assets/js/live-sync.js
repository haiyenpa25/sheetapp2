/**
 * assets/js/live-sync.js — On-demand Lazy Loader & Backward Compatibility Adapter
 * for Performance Engine & Live Session (Protocol V2)
 */
const LiveSync = (() => {
  'use strict';

  let _loadPromise = null;
  let _isLoaded    = false;

  function _loadScriptAsync(src) {
    return new Promise((resolve, reject) => {
      // Nếu script đã có trong DOM thì không nạp lại
      const existing = document.querySelector(`script[src*="${src}"]`);
      if (existing) {
        return resolve();
      }

      const v = window.__ASSET_V__ || Date.now();
      const s = document.createElement('script');
      s.src = src.includes('?') ? `${src}&v=${v}` : `${src}?v=${v}`;
      s.async = false; // Bảo đảm thứ tự thực thi chính xác
      s.onload = () => resolve();
      s.onerror = (e) => reject(new Error(`Failed to load ${src}: ${e?.message || 'network error'}`));
      document.body.appendChild(s);
    });
  }

  function ensureLoaded() {
    if (_isLoaded) return Promise.resolve(true);
    if (_loadPromise) return _loadPromise;

    _loadPromise = (async () => {
      const modules = [
        'assets/js/performance/transport-clock.js',
        'assets/js/performance/count-in-engine.js',
        'assets/js/performance/musical-position.js',
        'assets/js/performance/arrangement-engine.js',
        'assets/js/performance/cue-engine.js',
        'assets/js/performance/live-transport.js',
        'assets/js/performance/qr-helper.js',
        'assets/js/performance/live-session.js',
        'assets/js/performance/performance-engine.js'
      ];

      for (const m of modules) {
        await _loadScriptAsync(m);
      }

      // Khởi tạo các subsystem sau khi toàn bộ script đã nạp xong
      if (window.ArrangementEngine?.init) window.ArrangementEngine.init();
      if (window.CueEngine?.init)        window.CueEngine.init();
      if (window.LiveSession?.init)      window.LiveSession.init();
      if (window.PerformanceEngine?.init) window.PerformanceEngine.init();

      _isLoaded = true;
      return true;
    })().catch(err => {
      _loadPromise = null; // Cho phép thử lại nếu xảy ra lỗi mạng
      console.error('[LiveSync] Failed to load performance modules:', err);
      throw err;
    });

    return _loadPromise;
  }

  function init() {
    // 1. Tự động nạp nếu có URL params ?room= hoặc ?live=
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.has('room') || params.has('live')) {
        ensureLoaded().then(() => {
          const room = params.get('room');
          if (room && window.LiveSession?.joinRoom) {
            window.LiveSession.joinRoom(room);
          }
        }).catch(() => {});
      }
    } catch (e) {}

    // 2. Gán sự kiện cho nút Live Sync trên giao diện
    const btnLiveSync = document.getElementById('btn-live-sync');
    if (btnLiveSync && !btnLiveSync.dataset.liveSyncBound) {
      btnLiveSync.dataset.liveSyncBound = 'true';
      btnLiveSync.addEventListener('click', async (e) => {
        e.preventDefault();
        window.AppUI?.showLoading?.('Đang kết nối phòng hòa âm...');
        try {
          await ensureLoaded();
          window.AppUI?.hideLoading?.();
          window.LiveSession?.showModal?.();
        } catch (err) {
          window.AppUI?.hideLoading?.();
          window.AppUI?.showToast?.('Không thể tải module Live Sync', 'error');
        }
      });
    }
  }

  // Khởi tạo listener khi DOM sẵn sàng
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }

  return {
    init,
    ensureLoaded,
    loadModules: ensureLoaded,
    isLoaded: () => _isLoaded,
    showModal: async () => {
      await ensureLoaded();
      window.LiveSession?.showModal?.();
    },
    hideModal: () => window.LiveSession?.hideModal?.(),
    startHost: async (room) => {
      await ensureLoaded();
      return window.LiveSession?.startHost?.(room);
    },
    joinRoom: async (room) => {
      await ensureLoaded();
      return window.LiveSession?.joinRoom?.(room);
    },
    leaveRoom: () => window.LiveSession?.leaveRoom?.(),
    broadcastState: (data) => window.LiveSession?.broadcastState?.(data)
  };
})();

if (typeof window !== 'undefined') {
  window.LiveSync = LiveSync;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LiveSync;
}
