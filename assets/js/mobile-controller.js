/**
 * mobile-controller.js — Mobile Thumb Bar & Responsive Control (Ticket L1-8)
 * Điều khiển cạnh dưới màn hình điện thoại (52px thumb bar):
 * - Dịch giọng: [-] [Tông] [+]
 * - Đổi nhanh bộ hợp âm: [HD ↔ TLH]
 * - Đổi chế độ: [Band ↔ Bản Nhạc]
 * - Vào chế độ Biểu diễn: [⚡]
 * - Đảm bảo vừa bề ngang và các touch targets >= 44px
 */
const MobileController = (() => {
  'use strict';

  function init() {
    _bindEvents();
    _subscribeState();
    sync();
  }

  function _bindEvents() {
    // 1. Dịch tông nhanh ngón cái
    document.getElementById('btn-mobile-transpose-down')?.addEventListener('click', (e) => {
      e.currentTarget.blur();
      if (window.App?.transposeBy) {
        window.App.transposeBy(-1);
      } else {
        document.getElementById('btn-transpose-down')?.click();
      }
      sync();
    });

    document.getElementById('btn-mobile-transpose-up')?.addEventListener('click', (e) => {
      e.currentTarget.blur();
      if (window.App?.transposeBy) {
        window.App.transposeBy(+1);
      } else {
        document.getElementById('btn-transpose-up')?.click();
      }
      sync();
    });

    document.getElementById('mobile-transpose-display')?.addEventListener('click', (e) => {
      e.currentTarget.blur();
      if (window.App?.resetTranspose) {
        window.App.resetTranspose();
      } else {
        document.getElementById('btn-transpose-reset')?.click();
      }
      sync();
    });

    // 2. Chuyển đổi bộ hợp âm ngón cái (HD ↔ TLH)
    document.getElementById('btn-mobile-chordset')?.addEventListener('click', async (e) => {
      e.currentTarget.blur();
      const curSet = window.ChordCanvas?.getCurrentSet?.() || 'HD';
      const selector = document.getElementById('chord-set-selector');
      
      let nextSet = 'HD';
      if (selector && selector.options && selector.options.length > 1) {
        let curIdx = selector.selectedIndex;
        if (curIdx < 0) curIdx = 0;
        const nextIdx = (curIdx + 1) % selector.options.length;
        nextSet = selector.options[nextIdx].value;
      } else {
        nextSet = (curSet === 'HD') ? 'default' : 'HD';
      }

      if (window.ChordCanvas?.switchSet) {
        await window.ChordCanvas.switchSet(nextSet);
      } else if (selector) {
        selector.value = nextSet;
        selector.dispatchEvent(new Event('change'));
      }
      sync();
    });

    // 3. Chuyển chế độ Band ↔ Bản Nhạc
    document.getElementById('btn-mobile-view-toggle')?.addEventListener('click', (e) => {
      e.currentTarget.blur();
      const bandBtn = document.getElementById('btn-band-toggle') || document.getElementById('btn-toggle-view');
      bandBtn?.click();
      setTimeout(sync, 60);
    });

    // 4. Biểu diễn toàn màn hình sân khấu
    document.getElementById('btn-mobile-gig')?.addEventListener('click', (e) => {
      e.currentTarget.blur();
      document.getElementById('btn-fullscreen')?.click();
    });

    // Theo dõi thay đổi kích thước màn hình
    window.addEventListener('resize', _debounce(sync, 150));
  }

  function _subscribeState() {
    if (typeof EventBus !== 'undefined') {
      EventBus.on('transpose:changed', () => sync());
      EventBus.on('state:currentTranspose', () => sync());
      EventBus.on('song:loaded', () => sync());
    }

    // Quan sát thay đổi ở DOM chính
    const observer = new MutationObserver(() => sync());
    const songKeyEl = document.getElementById('song-key');
    if (songKeyEl) observer.observe(songKeyEl, { childList: true, characterData: true, subtree: true });
    const transDisp = document.getElementById('transpose-display');
    if (transDisp) observer.observe(transDisp, { childList: true, characterData: true, subtree: true });
  }

  function sync() {
    _syncTransposeDisplay();
    _syncChordSetDisplay();
    _syncViewToggleDisplay();
  }

  function _syncTransposeDisplay() {
    const disp = document.getElementById('mobile-transpose-display');
    if (!disp) return;

    let baseKey = window.Store?.get?.('currentSong')?.defaultKey
      || window.SongInfoBar?.getSongData?.()?.key
      || document.getElementById('song-key')?.textContent?.trim()
      || '';
    if (baseKey === '--') baseKey = '';

    const semi = window.Store?.get?.('currentTranspose')
      ?? (window.App?.getCurrentTranspose?.() || 0);

    let displayKey = baseKey || (semi === 0 ? '0' : (semi > 0 ? `+${semi}` : `${semi}`));

    if (baseKey) {
      if (semi !== 0 && window.KeyService?.displayKey) {
        const practiced = window.KeyService.displayKey(baseKey, semi);
        const sign = semi > 0 ? `+${semi}` : `${semi}`;
        displayKey = `${practiced || baseKey} (${sign})`;
      } else if (semi !== 0) {
        displayKey = `${baseKey} (${semi > 0 ? '+' : ''}${semi})`;
      } else {
        displayKey = baseKey;
      }
    }

    disp.textContent = displayKey;
    disp.title = `Tông: ${displayKey} · Chạm để về gốc`;
    disp.classList.toggle('has-transpose', semi !== 0);
  }

  function _syncChordSetDisplay() {
    const label = document.getElementById('mobile-chordset-label');
    if (!label) return;

    const curSet = window.ChordCanvas?.getCurrentSet?.() || 'HD';
    if (curSet === 'default') {
      label.textContent = 'TLH';
    } else if (curSet === 'HD') {
      label.textContent = 'HD';
    } else {
      label.textContent = curSet.length > 4 ? curSet.slice(0, 3) + '…' : curSet;
    }
  }

  function _syncViewToggleDisplay() {
    const icon = document.getElementById('mobile-view-icon');
    const label = document.getElementById('mobile-view-label');
    const btn = document.getElementById('btn-mobile-view-toggle');
    if (!icon || !label || !btn) return;

    const lyricContainer = document.getElementById('lyric-view-container');
    const isBandActive = lyricContainer && !lyricContainer.classList.contains('hidden');

    if (isBandActive) {
      icon.textContent = '🎼';
      label.textContent = 'Nhạc';
      btn.classList.add('active');
      btn.title = 'Đang xem Band · Chạm để xem Bản Nhạc';
    } else {
      icon.textContent = '▶';
      label.textContent = 'Band';
      btn.classList.remove('active');
      btn.title = 'Đang xem Bản Nhạc · Chạm để xem Band (Lời & Hợp âm chữ lớn)';
    }
  }

  function _debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  }

  return {
    init,
    sync
  };
})();

window.MobileController = MobileController;
