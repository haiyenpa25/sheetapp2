/**
 * performance-notes.js — Nhật Ký per-song
 *
 * ══════════════════════════════════════════════════════════════
 * PHÂN QUYỀN:
 *   Ban Hát / Nhạc / Ca trưởng / Admin → Panel chỉnh sửa (Tông, BPM, lời nhắc riêng)
 *   Ghi chú chung cho ban nhạc và ghi chú theo nhạc cụ (dấu + trên bản nhạc) nằm ở AnnotationPanel.
 *   perfNotes.instruments cũ vẫn được giữ nguyên khi lưu (không mất dữ liệu).
 *   Khách  → Nội dung hiển thị INLINE trên info bar (không popup)
 *
 * LƯU TRỮ: Server-side, riêng từng người dùng (sessions → perfNotes.instruments)
 *
 * TRIGGER MỞ PANEL:
 *   1. Nút Ghi chú (thanh dưới điện thoại, menu ⋮, page-bar Classic)
 *   2. Nút ✎ sửa trên info bar
 * ══════════════════════════════════════════════════════════════
 */
const PerformanceNotes = (() => {
  'use strict';

  const TAB_GENERAL = 'text';
  const AUTOSAVE_DELAY_MS = 1200;
  const NOTE_TABS = [
    { id: TAB_GENERAL, label: 'Chung', placeholder: 'Dạo mấy lần, ai hát câu nào, kết thế nào…', presets: ['Điệp khúc x2', 'Nữ → Nam', 'Kết nhẹ (fade out)'] },
  ];

  /* ── State ── */
  let _activeTab = TAB_GENERAL;
  let _draft     = { text: '', instruments: {} };
  let _songId    = null;
  let _cache     = {};
  let _panel     = null;
  let _saveTimer = null;

  /* ══════════════════════════════════════
   *  Init
   * ══════════════════════════════════════ */
  function init() {
    document.getElementById('btn-perf-notes')?.addEventListener('click', toggle);
  }

  /* ══════════════════════════════════════
   *  loadSong — fetch notes từ server
   * ══════════════════════════════════════ */
  async function loadSong(songId, sessionData = null) {
    clearTimeout(_saveTimer);
    _songId = songId;
    _cache  = {};

    if (sessionData && sessionData.perfNotes) {
      _cache = sessionData.perfNotes;
    } else {
      try {
        const data = await window.ApiService?.sessions?.load?.(songId);
        if (songId !== _songId) return {};
        if (data && data.perfNotes) {
          _cache = data.perfNotes;
        }
      } catch (e) {
        console.warn('[PerfNotes] Load error:', e);
      }
    }

    // Refresh panel nếu đang mở
    if (_panel && !_panel.classList.contains('hidden')) _renderPanel();

    // Refresh inline display trên info bar
    window.SongInfoBar?.refreshNotesChip?.(_songId);

    return _cache;
  }

  function clearSong() {
    _songId = null;
    _cache  = {};
    _panel?.classList.add('hidden');
    _draft = { text: '', instruments: {} };
  }

  /* ══════════════════════════════════════
   *  getNotes — trả cache
   * ══════════════════════════════════════ */
  function getNotes(songId) {
    return _cache || {};
  }

  /* ══════════════════════════════════════
   *  toggle — chỉ Admin mới dùng panel chỉnh sửa
   * ══════════════════════════════════════ */
  /* ══════════════════════════════════════
   *  toggle — Ban Hát và Admin dùng panel chỉnh sửa
   * ══════════════════════════════════════ */
  function toggle() {
    const canEdit = window.Auth?.isBanhat?.() || window.Auth?.isAdmin?.();

    if (!canEdit) {
      window.App?.showToast?.('Vui lòng đăng nhập tài khoản Ban Hát để lưu ghi chú!', 'info');
      return;
    }

    if (!_panel) _createPanel();

    const hidden = _panel.classList.toggle('hidden');
    if (!hidden) _renderPanel();
  }

  /* ══════════════════════════════════════
   *  _createPanel — Tông, BPM và ghi chú theo từng nhạc cụ
   * ══════════════════════════════════════ */
  function _createPanel() {
    _panel = document.createElement('div');
    _panel.id = 'perf-notes-panel';
    // Tạo ở trạng thái ẩn: toggle() ngay sau đó mới mở đúng ở lần bấm đầu tiên
    _panel.className = 'hidden';
    _panel.setAttribute('role', 'dialog');
    _panel.setAttribute('aria-label', 'Ghi chú cá nhân');

    const tabs = NOTE_TABS.map(t =>
      `<button type="button" class="pnp-tab" data-tab="${t.id}" aria-pressed="false">${t.label}<i class="pnp-tab-dot" aria-hidden="true"></i></button>`).join('');

    _panel.innerHTML = `
      <div class="pnp-header">
        <span>Ghi chú cá nhân <small class="pnp-sub">chỉ mình bạn thấy</small></span>
        <button type="button" id="pnp-close" title="Đóng" aria-label="Đóng">✕</button>
      </div>
      <div class="pnp-body">
        <div id="pnp-setlist-notice" class="pnp-notice hidden"></div>
        <div class="pnp-meta">
          <label>Tông <input id="pnp-key" type="text" maxlength="8" placeholder="G, Bb…" autocomplete="off"></label>
          <label>BPM <input id="pnp-bpm" type="number" min="30" max="300" inputmode="numeric" placeholder="72"></label>
          <button type="button" id="pnp-auto-sync" class="pnp-chip-btn" title="Lấy Tông & Tempo đang dùng">Lấy hiện tại</button>
        </div>
        <div class="pnp-tabs${NOTE_TABS.length < 2 ? ' hidden' : ''}" role="group" aria-label="Ghi chú theo nhạc cụ">${tabs}</div>
        <textarea id="pnp-text" rows="4" aria-label="Nội dung ghi chú"></textarea>
        <div id="pnp-presets" class="pnp-presets"></div>
        <div class="pnp-actions">
          <span id="pnp-saved" class="pnp-saved-hint" role="status" style="opacity:0">Đã lưu</span>
          <button type="button" id="pnp-save-btn" class="btn btn-primary btn-sm">Lưu ghi chú</button>
        </div>
      </div>`;

    document.body.appendChild(_panel);
    _bindPanelEvents();
  }

  function _bindPanelEvents() {
    const scheduleSave = () => {
      clearTimeout(_saveTimer);
      _saveTimer = setTimeout(_doSave, AUTOSAVE_DELAY_MS);
    };

    _panel.querySelector('#pnp-auto-sync').addEventListener('click', () => {
      const origKey = window.SongInfoBar?.getSongKey?.() || '';
      const curTranspose = window.Store?.get?.('currentTranspose') ?? 0;
      let curKey = origKey;
      if (origKey && curTranspose !== 0 && window.TransposeEngine) {
        curKey = window.TransposeEngine.transposeChord(origKey, curTranspose) || origKey;
      }
      const curBpm = window.Metronome?.getBpm?.() || '';
      if (curKey) _panel.querySelector('#pnp-key').value = curKey;
      if (curBpm) _panel.querySelector('#pnp-bpm').value = curBpm;
      window.App?.showToast?.(`Đã lấy Tông ${curKey || '--'} · BPM ${curBpm || 'mặc định'}`, 'success');
      _doSave();
    });

    _panel.querySelectorAll('.pnp-tab').forEach(btn =>
      btn.addEventListener('click', () => _selectTab(btn.dataset.tab)));

    _panel.querySelector('#pnp-presets').addEventListener('click', (e) => {
      const btn = e.target.closest('.pnp-preset-btn');
      if (!btn) return;
      const area = _panel.querySelector('#pnp-text');
      area.value = area.value ? `${area.value}\n${btn.dataset.text}` : btn.dataset.text;
      _captureActiveTab();
      scheduleSave();
    });

    ['pnp-key', 'pnp-bpm', 'pnp-text'].forEach(id => {
      _panel.querySelector('#' + id).addEventListener('input', () => {
        if (id === 'pnp-text') _captureActiveTab();
        scheduleSave();
      });
    });
    _panel.querySelector('#pnp-save-btn').addEventListener('click', _doSave);
    _panel.querySelector('#pnp-close').addEventListener('click', _close);
    _panel.addEventListener('keydown', (e) => { if (e.key === 'Escape') _close(); });

    /* Chạm ngoài panel → đóng */
    document.addEventListener('pointerdown', e => {
      if (_panel &&
          !_panel.classList.contains('hidden') &&
          !_panel.contains(e.target) &&
          !e.target.closest('#btn-perf-notes, #btn-menu-session-panel, #btn-session-panel, #btn-toolbar-notes, #si-ni-edit-btn, .si-notes')) {
        _close();
      }
    });
  }

  function _close() {
    _panel?.classList.add('hidden');
  }

  /* ── Tab nhạc cụ ── */
  function _tabText(tabId) {
    return tabId === TAB_GENERAL ? (_draft.text || '') : (_draft.instruments[tabId] || '');
  }

  /** Lưu nội dung ô nhập vào bản nháp của tab đang mở (chưa gửi server). */
  function _captureActiveTab() {
    const value = _panel.querySelector('#pnp-text').value;
    if (_activeTab === TAB_GENERAL) _draft.text = value;
    else if (value.trim()) _draft.instruments[_activeTab] = value;
    else delete _draft.instruments[_activeTab];
    _paintTabDots();
  }

  function _paintTabDots() {
    _panel.querySelectorAll('.pnp-tab').forEach(btn => {
      const has = _tabText(btn.dataset.tab).trim() !== '';
      btn.classList.toggle('has-note', has);
    });
  }

  function _selectTab(tabId) {
    if (_panel.querySelector('#pnp-text')) _captureActiveTab();
    _activeTab = NOTE_TABS.some(t => t.id === tabId) ? tabId : TAB_GENERAL;
    const tab = NOTE_TABS.find(t => t.id === _activeTab);
    _panel.querySelectorAll('.pnp-tab').forEach(btn => {
      const on = btn.dataset.tab === _activeTab;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-pressed', String(on));
    });
    const area = _panel.querySelector('#pnp-text');
    area.value = _tabText(_activeTab);
    area.placeholder = tab.placeholder;
    _panel.querySelector('#pnp-presets').innerHTML = tab.presets.map(t =>
      `<button type="button" class="pnp-preset-btn pnp-chip-btn" data-text="${window.SafeHtml.escape(t)}">${window.SafeHtml.escape(t)}</button>`).join('');
    _paintTabDots();
  }

  /* ══════════════════════════════════════
   *  _renderPanel — đổ data vào inputs
   * ══════════════════════════════════════ */
  function _renderPanel() {
    if (!_panel) return;
    _draft = {
      text: _cache.text || '',
      instruments: { ...(_cache.instruments || {}) },
    };
    _panel.querySelector('#pnp-key').value = _cache.key || '';
    _panel.querySelector('#pnp-bpm').value = _cache.bpm || '';
    _selectTab(_activeTab);

    // Thông báo trạng thái nếu đang tập trong Setlist
    const noticeEl = _panel.querySelector('#pnp-setlist-notice');
    const setlist = window.SetlistUI?.getCurrentSetlist?.();
    const idx = window.SetlistUI?.getCurrentIndex?.();
    if (setlist && setlist.items && idx !== undefined && idx >= 0) {
      noticeEl.classList.remove('hidden');
      noticeEl.textContent = `Setlist "${setlist.title || ''}" · bài ${Number.parseInt(idx, 10) + 1}/${setlist.items.length} — lưu sẽ đồng bộ Tông & Tempo vào bài này.`;
    } else {
      noticeEl.classList.add('hidden');
    }
  }

  /* ══════════════════════════════════════
   *  _doSave — POST lên server & đồng bộ Setlist
   * ══════════════════════════════════════ */
  async function _doSave() {
    if (!_songId || !_panel) return;

    const keyVal = document.getElementById('pnp-key')?.value.trim()  || '';
    const bpmVal = document.getElementById('pnp-bpm')?.value.trim()  || '';
    _captureActiveTab();
    const instruments = {};
    Object.entries(_draft.instruments).forEach(([id, value]) => {
      if (value.trim()) instruments[id] = value.trim();
    });

    const data = {
      key:       keyVal,
      bpm:       bpmVal,
      text:      (_draft.text || '').trim(),
      instruments,
      updatedAt: new Date().toISOString(),
    };

    const songId = _songId;
    let saved = true;
    try {
      await window.ApiService?.sessions?.savePerfNotes?.(songId, data);
    } catch (e) {
      saved = false;
      console.warn('[PerfNotes] Save error:', e);
      window.App?.showToast?.('Không lưu được ghi chú. Hãy thử lại.', 'error');
    }
    if (songId !== _songId) return;
    if (saved) _cache = data;

    // Cập nhật inline display ngay sau khi lưu
    window.SongInfoBar?.refreshNotesChip?.(_songId);

    // 🔥 Đồng bộ vào Setlist nếu đang mở bài trong Setlist
    const setlist = window.SetlistUI?.getCurrentSetlist?.();
    const curIdx = window.SetlistUI?.getCurrentIndex?.();
    if (setlist && setlist.items && curIdx !== undefined && curIdx >= 0) {
      const item = setlist.items[curIdx];
      if (item && String(item.song_id) === String(_songId)) {
        const curTranspose = window.Store?.get?.('currentTranspose') ?? 0;
        const bpmNum = parseInt(bpmVal, 10) || null;
        const beatsNum = window.Metronome?.getBeatsPerMeasure?.() || 4;

        try {
          await window.ApiService?.setlists?.updateItem?.(item.id, {
            transpose_key: curTranspose,
            bpm: bpmNum,
            beats_per_measure: beatsNum
          });
          item.transpose_key = curTranspose;
          item.bpm = bpmNum;
          item.beats_per_measure = beatsNum;
          window.SetlistUI?.renderSetlistItems?.();
        } catch (err) {
          console.warn('[PerfNotes] Lỗi sync vào setlist:', err);
        }
      }
    }

    const hint = document.getElementById('pnp-saved');
    if (hint && saved) { hint.style.opacity = '1'; setTimeout(() => hint.style.opacity = '0', 1500); }
  }

  return { init, loadSong, clearSong, toggle, getNotes };
})();

window.PerformanceNotes = PerformanceNotes;
