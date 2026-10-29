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

    // 2. M4-2a: Mở sheet chọn đầy đủ danh sách bộ hợp âm thay cho chỉ đảo HD ↔ TLH
    document.getElementById('btn-mobile-chordset')?.addEventListener('click', async (e) => {
      e.currentTarget.blur();
      if (window.ChordCanvas?.isAddMode?.()) {
        window.App?.showToast?.('Chạm Soạn để hoàn tất trước khi đổi bộ hợp âm', 'info');
        return;
      }
      await _openChordSetSheet();
    });

    document.getElementById('btn-gig-chordset')?.addEventListener('click', () => {
      document.getElementById('btn-mobile-chordset')?.click();
    });

    // 2b. M4-2a: Chuyển bài trước / sau trên thanh dưới
    document.getElementById('btn-mobile-prev-song')?.addEventListener('click', (e) => {
      e.currentTarget.blur();
      if (window.App?.navigatePrev) window.App.navigatePrev();
      else document.getElementById('btn-prev-song')?.click();
    });
    document.getElementById('btn-mobile-next-song')?.addEventListener('click', (e) => {
      e.currentTarget.blur();
      if (window.App?.navigateNext) window.App.navigateNext();
      else document.getElementById('btn-next-song')?.click();
    });

    // 3. Chuyển chế độ Band ↔ Bản Nhạc
    document.getElementById('btn-mobile-view-toggle')?.addEventListener('click', (e) => {
      e.currentTarget.blur();
      const bandBtn = document.getElementById('btn-band-toggle') || document.getElementById('btn-toggle-view');
      bandBtn?.click();
      setTimeout(sync, 60);
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

    // 5. R9 UI-2: Zoom + Khóa Zoom & Tempo ngoài mặt trước điện thoại
    document.getElementById('mobile-zoom-select')?.addEventListener('change', (e) => {
      const pct = parseInt(e.target.value, 10) || 100;
      if (window.App?.setZoom) window.App.setZoom(pct);
      else {
        const zs = document.getElementById('zoom-slider');
        if (zs) { zs.value = String(pct); zs.dispatchEvent(new Event('change')); }
      }
      setTimeout(sync, 40);
    });
    document.getElementById('btn-mobile-lock-zoom')?.addEventListener('click', (e) => {
      e.currentTarget.blur();
      document.getElementById('btn-lock-zoom')?.click();
      setTimeout(sync, 40);
    });
    document.getElementById('btn-mobile-tempo')?.addEventListener('click', (e) => {
      e.currentTarget.blur();
      const tempoBtn = document.getElementById('si-tempo-pill') || document.getElementById('btn-menu-metronome');
      tempoBtn?.click();
      setTimeout(sync, 60);
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
    _syncZoomAndTempoDisplay();
  }

  function _syncZoomAndTempoDisplay() {
    const zSel = document.getElementById('mobile-zoom-select');
    if (zSel) {
      const mainZ = document.getElementById('zoom-slider');
      const curPct = mainZ?.value ? parseInt(mainZ.value, 10) : Math.round((window.Store?.get?.('currentZoom') || window.App?.getCurrentZoom?.() || 1) * 100);
      if (curPct && Array.from(zSel.options).length) {
        const best = Array.from(zSel.options).reduce((a, b) => Math.abs(parseInt(b.value, 10) - curPct) < Math.abs(parseInt(a.value, 10) - curPct) ? b : a);
        zSel.value = best.value;
      }
    }
    const lockBtn = document.getElementById('btn-mobile-lock-zoom');
    if (lockBtn) {
      const locked = (window.SafeStorage ? window.SafeStorage.get('sheetapp_zoom_locked') : localStorage.getItem('sheetapp_zoom_locked')) === '1'
        || Boolean(document.getElementById('btn-lock-zoom')?.classList.contains('active'));
      lockBtn.classList.toggle('active', locked);
      lockBtn.setAttribute('aria-pressed', String(locked));
      lockBtn.innerHTML = `<svg class="icon icon-xs" aria-hidden="true"><use href="#icon-${locked ? 'lock' : 'unlock'}"/></svg>`;
    }
    const bpmVal = document.getElementById('mobile-bpm-val');
    const siBpm = document.getElementById('si-bpm-val');
    if (bpmVal && siBpm?.textContent) bpmVal.textContent = siBpm.textContent.trim();
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

    const status = window.ChordSetNames.readStatus();
    const curSet = status.currentSet;
    const fallback = curSet === window.ChordSetNames.HD && status.customCount === 0 && status.xmlCount > 0;
    label.textContent = window.ChordSetNames.short(status);
    const button = document.getElementById('btn-mobile-chordset');
    const setDescription = window.ChordSetNames.describe(status);
    button?.setAttribute('aria-label', `${setDescription}. Chạm để đổi ${curSet === 'HD' ? 'sang TLH' : 'sang HD'}`);
    if (button) button.title = setDescription;
    button?.classList.toggle('showing-tlh-fallback', fallback);
    const gigChordset = document.getElementById('btn-gig-chordset');
    if (gigChordset) {
      gigChordset.textContent = label.textContent;
      gigChordset.title = setDescription;
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
      label.textContent = window.innerWidth <= 430 ? 'Lời' : 'Lời & HÂ';
      btn.classList.add('active');
      btn.title = 'Đang xem Lời & Hợp âm · Chạm để xem Bản Nhạc';
      btn.setAttribute('aria-label', 'Đang xem Lời và hợp âm. Chạm để xem Bản nhạc');
    } else {
      icon.innerHTML = '<svg class="icon icon-xs" aria-hidden="true"><use href="#icon-music"/></svg>';
      label.textContent = window.innerWidth <= 430 ? 'Nhạc' : 'Bản Nhạc';
      btn.classList.remove('active');
      btn.title = 'Đang xem Bản Nhạc · Chạm để xem Lời & Hợp âm';
      btn.setAttribute('aria-label', 'Đang xem Bản nhạc. Chạm để xem Lời và hợp âm');
    }
    const gigView = document.getElementById('btn-gig-view-toggle');
    if (gigView) {
      gigView.textContent = isBandActive ? 'Lời' : 'Nhạc';
      gigView.setAttribute('aria-label', btn.getAttribute('aria-label'));
    }
  }

  async function _openChordSetSheet() {
    const selector = document.getElementById('chord-set-selector');
    if (window.ChordCanvas?.refreshSetDropdown) {
      try { await window.ChordCanvas.refreshSetDropdown(true); } catch (_) {}
    } else if (selector) {
      selector.dispatchEvent(new Event('focus'));
    }
    const curSet = window.ChordCanvas?.getCurrentSet?.() || selector?.value || 'HD';
    const rawOpts = selector ? Array.from(selector.options) : [];
    const options = rawOpts.length > 0
      ? rawOpts.map(o => ({ value: o.value, label: o.textContent || o.value }))
      : [
          { value: 'HD', label: '⭐ HD (Hoài Dinh)' },
          { value: 'default', label: 'TLH (Gốc) 🔒' },
        ];

    document.getElementById('mobile-chordset-sheet')?.remove();
    const esc = s => window.SafeHtml?.escape ? window.SafeHtml.escape(s) : String(s);
    const sheet = document.createElement('div');
    sheet.id = 'mobile-chordset-sheet';
    sheet.className = 'mobile-chordset-sheet';
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    sheet.setAttribute('aria-label', 'Chọn bộ hợp âm');
    sheet.innerHTML = `
      <div class="mobile-chordset-backdrop"></div>
      <div class="mobile-chordset-panel">
        <div class="mobile-chordset-header">
          <strong>Chọn bộ hợp âm</strong>
          <button type="button" class="mobile-chordset-close" aria-label="Đóng">✕</button>
        </div>
        <div class="mobile-chordset-list">
          ${options.map(o => `
            <button type="button" class="mobile-chordset-option${o.value === curSet ? ' active' : ''}" data-set-value="${esc(o.value)}">
              <span>${esc(o.label)}</span>
              ${o.value === curSet ? '<span aria-hidden="true">✓</span>' : ''}
            </button>
          `).join('')}
        </div>
      </div>
    `;
    document.body.appendChild(sheet);
    const close = () => sheet.remove();
    sheet.querySelector('.mobile-chordset-backdrop')?.addEventListener('click', close);
    sheet.querySelector('.mobile-chordset-close')?.addEventListener('click', close);
    sheet.querySelectorAll('.mobile-chordset-option').forEach(btn => {
      btn.addEventListener('click', async () => {
        const val = btn.getAttribute('data-set-value') || 'HD';
        close();
        if (val.startsWith('__')) {
          window.ChordCanvas?.handleSelectChange?.(val);
        } else if (window.ChordCanvas?.switchSet) {
          await window.ChordCanvas.switchSet(val);
        } else if (selector) {
          selector.value = val;
          selector.dispatchEvent(new Event('change'));
        }
        sync();
      });
    });
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
