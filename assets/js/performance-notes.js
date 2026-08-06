/**
 * performance-notes.js — Nhật Ký per-song
 *
 * ══════════════════════════════════════════════════════════════
 * PHÂN QUYỀN:
 *   Admin  → Panel chỉnh sửa (Tông, BPM, Ghi chú, nút Lưu)
 *   Khách  → Nội dung hiển thị INLINE trên info bar (không popup)
 *
 * LƯU TRỮ: Server-side (api/sessions.php → storage/data/sessions/)
 *
 * TRIGGER MỞ PANEL:
 *   1. Nút "Nhật ký" trên page-bar (admin only)
 *   2. Nút ✎ sửa trên info bar (admin only)
 * ══════════════════════════════════════════════════════════════
 */
const PerformanceNotes = (() => {
  'use strict';

  /* ── State ── */
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
  async function loadSong(songId) {
    _songId = songId;
    _cache  = {};

    try {
      const data = await window.ApiService?.sessions?.load?.(songId);
      if (data && data.perfNotes) {
        _cache = data.perfNotes;
      }
    } catch (e) {
      console.warn('[PerfNotes] Load error:', e);
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
   *  _createPanel — Edit panel với Presets & Auto Sync
   * ══════════════════════════════════════ */
  function _createPanel() {
    _panel = document.createElement('div');
    _panel.id = 'perf-notes-panel';

    _panel.innerHTML = `
      <div class="pnp-header">
        <span>📋 Nhật Ký & Ghi Chú Bài Tập</span>
        <button id="pnp-close" title="Đóng">✕</button>
      </div>
      <div class="pnp-body">
        <div style="display:flex; gap:0.5rem; margin-bottom: 0.5rem; align-items: flex-end;">
          <div style="flex:1;">
            <label>🎵 Tông lưu</label>
            <input id="pnp-key" type="text" maxlength="8" placeholder="VD: G, Bb, F#m…">
          </div>
          <div style="flex:1;">
            <label>⏱ BPM</label>
            <input id="pnp-bpm" type="number" min="30" max="300" placeholder="VD: 72">
          </div>
          <button id="pnp-auto-sync" class="btn btn-ghost btn-sm" style="font-size:0.75rem;" title="Tự động lấy Tông & Tempo hiện tại">⚡ Tự Lấy</button>
        </div>

        <div class="pnp-row pnp-row-full">
          <label>📝 Ghi chú biểu diễn / bài tập</label>
          <textarea id="pnp-text" rows="5"
            placeholder="VD:&#10;- Dạo guitar 2 lần&#10;- Nữ hát câu 1, Nam hát câu 2&#10;- Điệp khúc: Cả ban hợp xướng&#10;- Kết: Fade out nhẹ"></textarea>
        </div>

        <!-- QUICK PRESETS -->
        <div style="margin-bottom:0.75rem;">
          <div style="font-size:0.75rem; color:var(--text-muted,#6b7280); margin-bottom:0.25rem;">Gợi ý mẫu nhanh:</div>
          <div style="display:flex; gap:4px; flex-wrap:wrap;">
            <button class="pnp-preset-btn btn btn-ghost btn-xs" data-text="🔄 Điệp khúc x2">🔄 Điệp khúc x2</button>
            <button class="pnp-preset-btn btn btn-ghost btn-xs" data-text="🎸 Dạo guitar">🎸 Dạo guitar</button>
            <button class="pnp-preset-btn btn btn-ghost btn-xs" data-text="👩 Nữ -> 👨 Nam">👩 Nữ -> 👨 Nam</button>
            <button class="pnp-preset-btn btn btn-ghost btn-xs" data-text="🛑 Kết nhẹ (Fade out)">🛑 Kết nhẹ</button>
          </div>
        </div>

        <div class="pnp-actions">
          <span id="pnp-saved" class="pnp-saved-hint" style="opacity:0">✓ Đã lưu</span>
          <button id="pnp-save-btn" class="btn btn-primary btn-sm">💾 Lưu Ghi Chú</button>
        </div>
      </div>`;

    document.body.appendChild(_panel);

    // Auto sync current Key & BPM
    document.getElementById('pnp-auto-sync')?.addEventListener('click', () => {
      const curKey = window.SongInfoBar?.getSongInfo?.()?.key || '';
      const curBpm = window.Metronome?.getBpm?.() || '';
      if (curKey) document.getElementById('pnp-key').value = curKey;
      if (curBpm) document.getElementById('pnp-bpm').value = curBpm;
      window.App?.showToast?.('⚡ Đã lấy Tông & BPM hiện tại!', 'success');
      _doSave();
    });

    // Quick Presets click handler
    _panel.querySelectorAll('.pnp-preset-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const textInp = document.getElementById('pnp-text');
        if (textInp) {
          const insertText = e.currentTarget.dataset.text || '';
          textInp.value = textInp.value ? (textInp.value + '\n' + insertText) : insertText;
          _doSave();
        }
      });
    });

    // Auto-save on input
    ['pnp-key', 'pnp-bpm', 'pnp-text'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', () => {
        clearTimeout(_saveTimer);
        _saveTimer = setTimeout(_doSave, 1200);
      });
    });
    document.getElementById('pnp-save-btn').addEventListener('click', _doSave);
    document.getElementById('pnp-close').addEventListener('click', () => _panel.classList.add('hidden'));

    /* Click ngoài panel → đóng */
    document.addEventListener('pointerdown', e => {
      if (_panel &&
          !_panel.classList.contains('hidden') &&
          !_panel.contains(e.target) &&
          !e.target.closest('#btn-perf-notes') &&
          !e.target.closest('#si-ni-edit-btn') &&
          !e.target.closest('.si-notes')) {
        _panel.classList.add('hidden');
      }
    });
  }


  /* ══════════════════════════════════════
   *  _renderPanel — đổ data vào inputs
   * ══════════════════════════════════════ */
  function _renderPanel() {
    if (!_panel) return;
    const k = document.getElementById('pnp-key');
    const b = document.getElementById('pnp-bpm');
    const t = document.getElementById('pnp-text');
    if (k) k.value = _cache.key  || '';
    if (b) b.value = _cache.bpm  || '';
    if (t) t.value = _cache.text || '';
  }

  /* ══════════════════════════════════════
   *  _doSave — POST lên server
   * ══════════════════════════════════════ */
  async function _doSave() {
    if (!_songId || !_panel) return;

    const data = {
      key:       document.getElementById('pnp-key')?.value.trim()  || '',
      bpm:       document.getElementById('pnp-bpm')?.value.trim()  || '',
      text:      document.getElementById('pnp-text')?.value.trim() || '',
      updatedAt: new Date().toISOString(),
    };

    _cache = data;

    try {
      await window.ApiService?.sessions?.savePerfNotes?.(_songId, data);
    } catch (e) {
      console.warn('[PerfNotes] Save error:', e);
    }

    // Cập nhật inline display ngay sau khi lưu
    window.SongInfoBar?.refreshNotesChip?.(_songId);

    const hint = document.getElementById('pnp-saved');
    if (hint) { hint.style.opacity = '1'; setTimeout(() => hint.style.opacity = '0', 1500); }
  }

  return { init, loadSong, clearSong, toggle, getNotes };
})();

window.PerformanceNotes = PerformanceNotes;
