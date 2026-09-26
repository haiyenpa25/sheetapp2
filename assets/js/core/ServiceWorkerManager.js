/**
 * assets/js/core/ServiceWorkerManager.js
 * Đăng ký SW + thông báo có version mới + Quản lý PWA Install Prompt
 */
'use strict';

const ServiceWorkerManager = (() => {
  let _deferredPrompt = null;

  function register() {
    if (!('serviceWorker' in navigator)) return;

    const doRegister = async () => {
      try {
        const appBase = (typeof window.__APP_BASE__ === 'string') ? window.__APP_BASE__ : '';
        const swUrl = (appBase ? appBase : '') + '/sw.js';
        const swScope = (appBase ? appBase : '') + '/';
        const reg = await navigator.serviceWorker.register(swUrl, { scope: swScope });

        // Kiểm tra update
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          newWorker?.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // Có bản mới — thông báo nhẹ nhàng
              window.App?.showToast?.('🔄 Có cập nhật mới! Tải lại để áp dụng.', 'info');
            }
          });
        });
      } catch (e) {
        // SW không hỗ trợ — không crash app
      }
    };

    if (document.readyState === 'complete') {
      doRegister();
    } else {
      window.addEventListener('load', doRegister);
    }
  }

  function _initPwa() {
    const installBtn = document.getElementById('btn-pwa-install');
    const modal      = document.getElementById('pwa-install-modal');
    const closeBtn   = document.getElementById('btn-close-pwa-modal');
    const promptBtn  = document.getElementById('btn-pwa-prompt-trigger');
    const iosDiv     = document.getElementById('pwa-ios-instructions');
    const generalDiv = document.getElementById('pwa-general-instructions');

    if (!installBtn || !modal) return;

    // Detect device type
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
                  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

    // 1. Android/Chrome native prompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      _deferredPrompt = e;
      if (!isStandalone) {
        installBtn.classList.remove('hidden');
      }
    });

    // 2. iOS Safari manual check
    if (isIOS && !isStandalone) {
      installBtn.classList.remove('hidden');
    }

    // Bind click events
    installBtn.addEventListener('click', () => {
      if (isIOS) {
        iosDiv?.classList.remove('hidden');
        generalDiv?.classList.add('hidden');
        modal.classList.remove('hidden');
      } else if (_deferredPrompt) {
        generalDiv?.classList.remove('hidden');
        iosDiv?.classList.add('hidden');
        modal.classList.remove('hidden');
      } else {
        // Fallback for browsers that don't support beforeinstallprompt but are on desktop/Android
        window.App?.showToast?.('💡 Để cài đặt: Hãy chọn nút menu của Trình duyệt -> "Cài đặt ứng dụng" hoặc "Thêm vào MH chính"', 'info');
      }
    });

    promptBtn?.addEventListener('click', async () => {
      if (!_deferredPrompt) return;
      modal.classList.add('hidden');
      _deferredPrompt.prompt();
      const choice = await _deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        installBtn.classList.add('hidden');
      }
      _deferredPrompt = null;
    });

    closeBtn?.addEventListener('click', () => modal.classList.add('hidden'));
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.add('hidden');
    });
  }

  // Tự động khởi tạo khi DOM sẵn sàng
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _initPwa);
  } else {
    _initPwa();
  }

  function clearXmlCache(url = null) {
    if (navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'CLEAR_XML_CACHE',
        url: url
      });
    }
  }

  return { register, clearXmlCache };
})();

window.ServiceWorkerManager = ServiceWorkerManager;
