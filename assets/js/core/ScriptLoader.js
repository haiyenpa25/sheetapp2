/**
 * ScriptLoader.js — Dynamic On-Demand Script Loader
 * Part of SheetApp Performance Engine (Ticket L5-5)
 *
 * Quản lý nạp động các module JS theo nhu cầu sử dụng thực tế (on-demand),
 * tránh tải trước hàng chục module ít dùng gây nghẽn network và DOM parsing.
 */
const ScriptLoader = (() => {
  'use strict';

  const _loaded = new Set();
  const _inFlight = new Map();

  /**
   * Tải một file JS động theo nhu cầu.
   * @param {string} src - Đường dẫn file JS (ví dụ: 'assets/js/admin-ui.js')
   * @returns {Promise<boolean>}
   */
  function load(src) {
    if (!src) return Promise.resolve(false);
    if (_loaded.has(src)) return Promise.resolve(true);
    if (_inFlight.has(src)) return _inFlight.get(src);

    const baseHref = document.querySelector('base')?.getAttribute('href') || './';
    const cleanSrc = src.startsWith('/') ? src.slice(1) : src;
    const fullUrl = cleanSrc.startsWith('http') ? cleanSrc : `${baseHref}${cleanSrc}`;

    const promise = new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src*="${src}"]`);
      if (existing) {
        _loaded.add(src);
        _inFlight.delete(src);
        resolve(true);
        return;
      }

      const script = document.createElement('script');
      script.src = fullUrl;
      script.async = true;
      script.onload = () => {
        _loaded.add(src);
        _inFlight.delete(src);
        resolve(true);
      };
      script.onerror = (err) => {
        _inFlight.delete(src);
        console.warn(`[ScriptLoader] Không thể tải: ${src}`, err);
        reject(err);
      };
      document.head.appendChild(script);
    });

    _inFlight.set(src, promise);
    return promise;
  }

  /**
   * Tải đồng thời danh sách nhiều script theo thứ tự tuần tự.
   * @param {string[]} srcs
   * @returns {Promise<boolean>}
   */
  async function loadSequence(srcs = []) {
    for (const s of srcs) {
      await load(s);
    }
    return true;
  }

  function isLoaded(src) {
    return _loaded.has(src) || !!document.querySelector(`script[src*="${src}"]`);
  }

  /* ── Presets nạp theo nhóm tính năng ── */
  async function loadAudio() {
    return loadSequence([
      'assets/js/vendor/Tone.js',
      'assets/js/vendor/OsmdAudioPlayer.min.js',
      'assets/js/core/TapTempo.js',
      'assets/js/core/AudioUnlocker.js',
      'assets/js/core/MidiEngine.js',
      'assets/js/instruments.js',
      'assets/js/audio-player.js',
      'assets/js/metronome.js',
      'assets/js/auto-scroller.js'
    ]);
  }

  async function loadAdmin() {
    return loadSequence([
      'assets/js/auth.js',
      'assets/js/importer.js',
      'assets/js/admin-ui.js'
    ]);
  }

  async function loadSetlist() {
    return loadSequence([
      'assets/js/core/OfflineSetlistManager.js',
      'assets/js/service-plan-ui.js',
      'assets/js/leader-notes-banner.js',
      'assets/js/liturgy-card.js',
      'assets/js/setlist-player.js',
      'assets/js/setlist-list.js',
      'assets/js/setlist-detail.js',
      'assets/js/setlist-ui.js'
    ]);
  }

  async function loadLiveSync() {
    return loadSequence([
      'assets/js/live-sync.js',
      'assets/js/follow-leader.js'
    ]);
  }

  async function loadLenses() {
    return loadSequence([
      'assets/js/stage-lens.js',
      'assets/js/guitar-lens.js',
      'assets/js/bass-lens.js',
      'assets/js/drums-lens.js',
      'assets/js/vocals-lens.js'
    ]);
  }

  async function loadModal(name) {
    const map = {
      'help': 'assets/js/modals/HelpModal.js',
      'transpose': 'assets/js/modals/TransposePickerModal.js',
      'tempo': 'assets/js/modals/TempoPickerSheet.js',
      'numpad': 'assets/js/modals/QuickNumpadModal.js',
      'service_assign': 'assets/js/modals/ServicePlanAssignModal.js',
      'practice_board': 'assets/js/modals/PracticeTeamBoardModal.js'
    };
    const path = map[name] || `assets/js/modals/${name}.js`;
    return load(path);
  }

  /** Prefetch nhẹ nhàng các script thường dùng khi trình duyệt rảnh rỗi */
  function prefetchIdle() {
    const idleFn = window.requestIdleCallback || ((cb) => setTimeout(cb, 1500));
    idleFn(() => {
      // Prefetch các module nền tảng phổ biến
      const idleScripts = [
        'assets/js/auth.js',
        'assets/js/core/ServiceWorkerManager.js'
      ];
      idleScripts.forEach(src => {
        if (!isLoaded(src)) {
          const link = document.createElement('link');
          link.rel = 'prefetch';
          link.as = 'script';
          const baseHref = document.querySelector('base')?.getAttribute('href') || './';
          link.href = `${baseHref}${src}`;
          document.head.appendChild(link);
        }
      });
    });
  }

  /** Thiết lập trigger tự động nạp module theo tương tác người dùng */
  function setupAutoTriggers() {
    if (typeof document === 'undefined') return;

    // 1. Audio & Metronome auto-trigger
    const audioTriggerSelectors = '#btn-metronome, #btn-metronome-toggle-play, #btn-play, #btn-audio-play, .btn-audio-toggle, #btn-auto-scroll';
    document.addEventListener('click', async (e) => {
      const btn = e.target.closest(audioTriggerSelectors);
      if (btn && (!window.Metronome || !window.SheetAudioPlayer)) {
        await loadAudio();
        if (window.Metronome && !window.Metronome.isInitialized) window.Metronome.init();
        if (window.SheetAudioPlayer && !window.SheetAudioPlayer.isInitialized) window.SheetAudioPlayer.init();
        if (btn.id === 'btn-metronome' || btn.id === 'btn-metronome-toggle-play') {
          window.Metronome?.toggle?.();
        }
      }
    }, true);

    // 2. Admin & Importer auto-trigger
    document.addEventListener('click', async (e) => {
      const btn = e.target.closest('#btn-admin-console, #btn-admin, #btn-importer, #btn-import');
      if (btn && (!window.AdminUI || !window.Importer)) {
        await loadAdmin();
        if (window.AdminUI && !window.AdminUI.isInitialized) window.AdminUI.init?.();
        if (window.Importer && !window.Importer.isInitialized) window.Importer.init?.();
      }
    }, true);

    // 3. Setlist auto-trigger
    document.addEventListener('click', async (e) => {
      const btn = e.target.closest('#btn-setlist, [data-pillar="setlist"], .nav-tab-setlist');
      if (btn && !window.SetlistUI) {
        await loadSetlist();
        if (window.SetlistUI) window.SetlistUI.init?.();
      }
    }, true);

    // 4. Modal buttons on-demand loader (#btn-quick-numpad, #btn-help)
    document.addEventListener('click', async (e) => {
      const btnNumpad = e.target.closest('#btn-quick-numpad');
      if (btnNumpad && !window.QuickNumpadModal) {
        e.preventDefault();
        e.stopPropagation();
        await loadModal('numpad');
        window.QuickNumpadModal?.open?.();
        return;
      }

      const btnHelp = e.target.closest('#btn-help');
      if (btnHelp && !window.HelpModal) {
        e.preventDefault();
        e.stopPropagation();
        await loadModal('help');
        window.HelpModal?.open?.();
        return;
      }
    }, true);

    // 5. Keyboard shortcuts on-demand loader
    document.addEventListener('keydown', async (e) => {
      const tag = document.activeElement?.tagName?.toLowerCase();
      if (['input','textarea','select'].includes(tag)) return;
      if (e.key === 'm' || e.key === 'M') {
        if (!window.Metronome) {
          await loadAudio();
          if (window.Metronome) {
            window.Metronome.init();
            window.Metronome.toggle();
          }
        }
      } else if (e.key === '#' || e.key === 'n' || e.key === 'N') {
        if (!window.QuickNumpadModal) {
          e.preventDefault();
          e.stopPropagation();
          await loadModal('numpad');
          window.QuickNumpadModal?.open?.();
        }
      } else if (e.key === '?') {
        if (!window.HelpModal) {
          e.preventDefault();
          e.stopPropagation();
          await loadModal('help');
          window.HelpModal?.open?.();
        }
      }
    }, true);
  }

  // Khởi chạy auto triggers ngay lập tức
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', setupAutoTriggers);
    } else {
      setupAutoTriggers();
    }
  }

  return {
    load,
    loadSequence,
    isLoaded,
    loadAudio,
    loadAdmin,
    loadSetlist,
    loadLiveSync,
    loadLenses,
    loadModal,
    prefetchIdle,
    setupAutoTriggers
  };
})();

if (typeof window !== 'undefined') {
  window.ScriptLoader = ScriptLoader;
}

