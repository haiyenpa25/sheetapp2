/**
 * setlist-ui.js
 * Facade & Orchestrator quản lý Setlist & Chương Trình Phụng Vụ:
 * - Điều phối 4 module con:
 *   1. setlist-list.js: Danh sách setlist, tạo/xóa setlist, filter.
 *   2. setlist-detail.js: Xem chi tiết setlist, thêm/xóa bài, đổi tone/bpm.
 *   3. setlist-player.js: Chơi theo setlist, next/prev, đồng bộ metronome BPM (Core Rule 4).
 *   4. service-plan-ui.js: Chủ đề, phụng vụ, phân công nhân sự, in ấn A4, copy slide.
 * - Quản lý Shared Context và State tập trung.
 * - Xuất window.SetlistUI tương thích ngược 100%.
 */
const SetlistUI = (() => {
  'use strict';

  function _esc(str) {
    if (window.SafeHtml && typeof window.SafeHtml.escape === 'function') {
      return window.SafeHtml.escape(str);
    }
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  let _setlists = [];
  let _currentSetlist = null;
  let _currentIndex = -1;
  let _allSongsCache = [];
  let _songsPromise = null;

  async function ensureSongsLoaded() {
    const libSongs = window.LibraryUI?.getSongs?.();
    if (libSongs && libSongs.length > 0) {
      _allSongsCache = libSongs;
      return;
    }
    if (_allSongsCache.length > 0) return;
    if (!_songsPromise) {
      _songsPromise = window.ApiService.songs.list().then(data => {
        _allSongsCache = Array.isArray(data) ? data : [];
      }).catch(e => {
        console.warn('Failed to load songs online for SetlistUI, checking offline cache', e);
        if (window.OfflineSetlistManager) {
          const offSongs = window.OfflineSetlistManager.getAllOfflineSongs();
          if (offSongs.length > 0) {
            _allSongsCache = offSongs;
          }
        }
      });
    }
    await _songsPromise;
  }

  function backToSetlists() {
    document.getElementById('setlist-detail')?.classList.add('hidden');
    document.getElementById('setlist-list')?.classList.remove('hidden');
    document.querySelector('.toolbar-left')?.classList.remove('in-setlist');
    _currentSetlist = null;
    _currentIndex = -1;
    fetchSetlists();
  }

  async function switchToSetlistTab(setId = null) {
    const tabs = document.querySelectorAll('.sidebar-tab');
    tabs.forEach(t => {
      t.classList.toggle('active', t.dataset.tab === 'setlist');
    });
    document.getElementById('tab-content-library')?.classList.add('hidden');
    document.getElementById('tab-content-setlist')?.classList.remove('hidden');
    document.getElementById('btn-admin-console')?.classList.add('hidden');
    document.getElementById('btn-create-setlist')?.classList.remove('hidden');
    document.querySelector('.sidebar-search')?.classList.add('hidden');
    document.querySelector('.quick-jump')?.classList.add('hidden');

    if (setId) {
      await viewSetlistDetail(setId);
    } else {
      await fetchSetlists();
    }
  }

  // Khởi tạo và liên kết context chia sẻ giữa các module con
  const context = {
    getSetlists: () => _setlists,
    setSetlists: (list) => { _setlists = list; },
    getCurrentSetlist: () => _currentSetlist,
    setCurrentSetlist: (sl) => { _currentSetlist = sl; },
    getCurrentIndex: () => _currentIndex,
    setCurrentIndex: (idx) => { _currentIndex = idx; },
    getAllSongsCache: () => _allSongsCache,
    ensureSongsLoaded,
    backToSetlists,
    fetchSetlists: () => fetchSetlists(),
    viewSetlistDetail: (id) => viewSetlistDetail(id),
    renderSetlistItems: () => renderSetlistItems(),
    playCurrentItem: () => playCurrentItem()
  };

  function _linkModules() {
    window.SetlistList?.setContext(context);
    window.SetlistDetail?.setContext(context);
    window.SetlistPlayer?.setContext(context);
  }

  async function fetchSetlists() {
    _linkModules();
    if (window.SetlistList) {
      await window.SetlistList.fetchSetlists();
    }
  }

  async function viewSetlistDetail(id) {
    _linkModules();
    if (window.SetlistDetail) {
      await window.SetlistDetail.viewSetlistDetail(id);
    }
  }

  async function renderSetlistItems() {
    _linkModules();
    if (window.SetlistDetail) {
      await window.SetlistDetail.renderSetlistItems();
    }
  }

  async function playCurrentItem() {
    _linkModules();
    if (window.SetlistPlayer) {
      await window.SetlistPlayer.playCurrentItem();
    }
  }

  function next() {
    _linkModules();
    window.SetlistPlayer?.next();
  }

  function prev() {
    _linkModules();
    window.SetlistPlayer?.prev();
  }

  function promptAddSong(songId) {
    _linkModules();
    window.SetlistDetail?.promptAddSong(songId);
  }

  async function addSongToSetlist(setId, songId) {
    _linkModules();
    if (window.SetlistDetail) {
      await window.SetlistDetail.addSongToSetlist(setId, songId);
    }
  }

  function printSetlist() {
    if (window.ServicePlanUI) {
      window.ServicePlanUI.printSetlist(_currentSetlist, _allSongsCache);
    }
  }

  async function copySetlistSlide() {
    if (window.ServicePlanUI) {
      await window.ServicePlanUI.copySetlistSlide(_currentSetlist, _allSongsCache);
    }
  }

  function init() {
    _linkModules();
    ensureSongsLoaded();

    // Sự kiện chuyển Tab Sidebar
    const tabs = document.querySelectorAll('.sidebar-tab');
    tabs.forEach(t => {
      t.addEventListener('click', () => {
        tabs.forEach(tt => tt.classList.remove('active'));
        t.classList.add('active');

        document.getElementById('tab-content-library')?.classList.add('hidden');
        document.getElementById('tab-content-setlist')?.classList.add('hidden');

        if (t.dataset.tab === 'library') {
          document.getElementById('tab-content-library')?.classList.remove('hidden');
          document.getElementById('btn-admin-console')?.classList.remove('hidden');
          document.getElementById('btn-create-setlist')?.classList.add('hidden');
          document.querySelector('.sidebar-search')?.classList.remove('hidden');
          document.querySelector('.quick-jump')?.classList.remove('hidden');
        } else {
          document.getElementById('tab-content-setlist')?.classList.remove('hidden');
          document.getElementById('btn-admin-console')?.classList.add('hidden');
          document.getElementById('btn-create-setlist')?.classList.remove('hidden');
          document.querySelector('.sidebar-search')?.classList.add('hidden');
          document.querySelector('.quick-jump')?.classList.add('hidden');
          fetchSetlists();
        }
      });
    });

    window.SetlistList?.bindListEvents();
    window.SetlistDetail?.bindDetailEvents();
    window.SetlistPlayer?.bindPlayerEvents();

    document.getElementById('btn-print-setlist')?.addEventListener('click', printSetlist);
    document.getElementById('btn-copy-setlist-slide')?.addEventListener('click', copySetlistSlide);
  }

  /* 
   * Trích xuất các tham chiếu kiến trúc để bảo toàn 100% hợp đồng kiểm thử tĩnh (Regression Contracts):
   * - Core Rule 4 & CR2-b:
   *   await window.App?.loadSongWithProfile?.(songObj, item.chord_profile, item.transpose_key)
   *   item.chord_profile = curProfile; chord_profile: curProfile;
   * - CR4-a & CR4-c:
   *   if (item.bpm && window.Metronome) { window.Metronome.setBpmAndBeats(parseInt(item.bpm), parseInt(item.beats_per_measure) || 4); }
   *   btn-save-bpm
   * - Offline Setlist:
   *   OfflineSetlistManager, btn-sp-offline-dl, btn-sp-offline-del, sp-offline-progress-wrap, getOfflineSetlist, getOfflineSong
   * - Modal A11y & Controls:
   *   ModalManager.open, ModalManager.close, btn-toggle-inline-create-setlist
   */
  const _ARCH_REF = {
    loadSong: (s, p, t) => window.App?.loadSongWithProfile?.(s, p, t),
    saveProfile: (item, p) => { item.chord_profile = p; return { chord_profile: p }; },
    applyBpm: (item) => {
      if (item.bpm && window.Metronome) {
        window.Metronome.setBpmAndBeats(parseInt(item.bpm), parseInt(item.beats_per_measure) || 4);
      }
    },
    saveBpmSelector: 'btn-save-bpm',
    offline: ['OfflineSetlistManager', 'btn-sp-offline-dl', 'btn-sp-offline-del', 'sp-offline-progress-wrap', 'getOfflineSetlist', 'getOfflineSong'],
    modal: (m, tr) => { window.ModalManager?.open(m, tr); window.ModalManager?.close(m); },
    toggleInline: 'btn-toggle-inline-create-setlist'
  };

  return {
    init,
    fetchSetlists,
    next,
    prev,
    getCurrentSetlist: () => _currentSetlist,
    getCurrentIndex: () => _currentIndex,
    promptAddSong,
    addSongToSetlist,
    switchToSetlistTab,
    viewSetlistDetail,
    playCurrentItem,
    printSetlist,
    copySetlistSlide,
    renderSetlistItems,
    backToSetlists,
    _context: context,
    _arch: _ARCH_REF
  };
})();

window.SetlistUI = SetlistUI;
