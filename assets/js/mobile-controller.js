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
      if (window.ChordCanvas?.isAddMode?.()) {
        window.App?.showToast?.('Chạm Soạn để hoàn tất trước khi đổi bộ hợp âm', 'info');
        return;
      }
      const curSet = window.ChordCanvas?.getCurrentSet?.() || 'HD';
      const selector = document.getElementById('chord-set-selector');
      const nextSet = curSet === 'HD' ? 'default' : 'HD';

      if (window.ChordCanvas?.switchSet) {
        await window.ChordCanvas.switchSet(nextSet);
      } else if (selector) {
        selector.value = nextSet;
        selector.dispatchEvent(new Event('change'));
      }
      sync();
    });

    document.getElementById('btn-gig-chordset')?.addEventListener('click', () => {
      document.getElementById('btn-mobile-chordset')?.click();
    });

    // 3. Chuyển chế độ Band ↔ Bản Nhạc
    document.getElementById('btn-mobile-view-toggle')?.addEventListener('click', (e) => {
      e.currentTarget.blur();
      const bandBtn = document.getElementById('btn-band-toggle') || document.getElementById('btn-toggle-view');
      bandBtn?.click();
      setTimeout(sync, 60);
    });

    document.getElementById('btn-tablet-view-toggle')?.addEventListener('click', (e) => {
      e.currentTarget.blur();
      const lyricView = document.getElementById('lyric-view-container');
      document.getElementById(lyricView && !lyricView.classList.contains('hidden') ? 'btn-view-sheet' : 'btn-view-lyrics')?.click();
      sync();
    });

    document.getElementById('btn-gig-view-toggle')?.addEventListener('click', () => {
      document.getElementById('btn-mobile-view-toggle')?.click();
    });
    document.getElementById('btn-gig-tools')?.addEventListener('click', (event) => {
      event.stopPropagation();
      document.getElementById('btn-more-options')?.click();
    });

    // 4. Biểu diễn toàn màn hình sân khấu
    document.getElementById('btn-mobile-gig')?.addEventListener('click', (e) => {
      e.currentTarget.blur();
      document.getElementById('btn-fullscreen')?.click();
    });

    document.getElementById('btn-mobile-edit')?.addEventListener('click', (e) => {
      e.currentTarget.blur();
      if (!window.Auth?.isBanhat?.()) return;
      const lyricView = document.getElementById('lyric-view-container');
      if (lyricView && !lyricView.classList.contains('hidden')) {
        document.getElementById('btn-view-sheet')?.click();
      }
      const edit = document.getElementById('btn-add-chord-mode-bar');
      if (edit && !edit.disabled) edit.click();
      sync();
    });

    // Theo dõi thay đổi kích thước màn hình
    window.addEventListener('resize', _debounce(sync, 150));
  }

  function _subscribeState() {
    if (typeof EventBus !== 'undefined') {
      EventBus.on('transpose:changed', () => sync());
      EventBus.on('state:currentTranspose', () => sync());
      EventBus.on('song:loaded', () => sync());
      EventBus.on('app:mode_change', () => sync());
    }

    // Quan sát thay đổi ở DOM chính
    const observer = new MutationObserver(() => sync());
    const songKeyEl = document.getElementById('song-key');
    if (songKeyEl) observer.observe(songKeyEl, { childList: true, characterData: true, subtree: true });
    const transDisp = document.getElementById('transpose-display');
    if (transDisp) observer.observe(transDisp, { childList: true, characterData: true, subtree: true });
    const lyricView = document.getElementById('lyric-view-container');
    if (lyricView) observer.observe(lyricView, { attributes: true, attributeFilter: ['class'] });
  }

  function sync() {
    _syncTransposeDisplay();
    _syncChordSetDisplay();
    _syncViewToggleDisplay();
    _syncEditDisplay();
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
    disp.setAttribute('aria-label', `Tông hiện tại ${displayKey}. Chạm để về tông gốc`);
    disp.classList.toggle('has-transpose', semi !== 0);
  }

  function _syncChordSetDisplay() {
    const label = document.getElementById('mobile-chordset-label');
    if (!label) return;

    const curSet = window.ChordCanvas?.getCurrentSet?.() || 'HD';
    const fallback = curSet === 'HD' && !!window.ChordCanvas?.getChordStatus?.()?.isFallback;
    if (curSet === 'default') {
      label.textContent = 'TLH';
    } else if (curSet === 'HD') {
      label.textContent = fallback ? 'HD→TLH' : 'HD';
    } else {
      label.textContent = curSet.length > 4 ? curSet.slice(0, 3) + '…' : curSet;
    }
    const button = document.getElementById('btn-mobile-chordset');
    const setDescription = fallback ? 'HD trống, đang hiện hợp âm TLH' : `Bộ hợp âm: ${label.textContent}`;
    button?.setAttribute('aria-label', `${setDescription}. Chạm để đổi ${curSet === 'HD' ? 'sang TLH' : 'sang HD'}`);
    if (button) button.title = setDescription;
    button?.classList.toggle('showing-tlh-fallback', fallback);
    const gigChordset = document.getElementById('btn-gig-chordset');
    if (gigChordset) {
      gigChordset.textContent = label.textContent;
      gigChordset.setAttribute('aria-label', `${setDescription}. Chạm để đổi ${curSet === 'HD' ? 'sang TLH' : 'sang HD'}`);
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
      icon.innerHTML = '<svg class="icon icon-xs" aria-hidden="true"><use href="#icon-file-text"/></svg>';
      label.textContent = 'Lời & HÂ';
      btn.classList.add('active');
      btn.title = 'Đang xem Lời & Hợp âm · Chạm để xem Bản Nhạc';
      btn.setAttribute('aria-label', 'Đang xem Lời và hợp âm. Chạm để xem Bản nhạc');
    } else {
      icon.innerHTML = '<svg class="icon icon-xs" aria-hidden="true"><use href="#icon-music"/></svg>';
      label.textContent = 'Bản Nhạc';
      btn.classList.remove('active');
      btn.title = 'Đang xem Bản Nhạc · Chạm để xem Lời & Hợp âm';
      btn.setAttribute('aria-label', 'Đang xem Bản nhạc. Chạm để xem Lời và hợp âm');
    }
    const gigView = document.getElementById('btn-gig-view-toggle');
    if (gigView) {
      gigView.textContent = isBandActive ? 'Lời' : 'Nhạc';
      gigView.setAttribute('aria-label', btn.getAttribute('aria-label'));
    }
    const tabletView = document.getElementById('btn-tablet-view-toggle');
    if (tabletView) {
      tabletView.innerHTML = isBandActive
        ? '<svg class="icon icon-xs" aria-hidden="true"><use href="#icon-music"/></svg><span>Nhạc</span>'
        : '<svg class="icon icon-xs" aria-hidden="true"><use href="#icon-file-text"/></svg><span>Lời</span>';
      tabletView.title = isBandActive ? 'Chuyển sang Bản nhạc' : 'Chuyển sang Lời & Hợp âm';
      tabletView.setAttribute('aria-label', tabletView.title);
    }
  }

  function _syncEditDisplay() {
    const btn = document.getElementById('btn-mobile-edit');
    if (!btn) return;
    const active = document.body.classList.contains('chord-edit-mode');
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', String(active));
    btn.setAttribute('aria-label', active ? 'Hoàn tất soạn hợp âm' : 'Soạn hợp âm');
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
