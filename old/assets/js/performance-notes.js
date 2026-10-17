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
  function toggle() {
    const isAdmin = window.Auth?.isAdmin?.() ?? false;

    // Khách/User: không show panel — nội dung đã inline trên strip
    if (!isAdmin) return;

    if (!_panel) _createPanel();

    const hidden = _panel.classList.toggle('hidden');
    if (!hidden) _renderPanel();
  }

  /* ══════════════════════════════════════
   *  _createPanel — ADMIN edit panel
   * ══════════════════════════════════════ */
  function _createPanel() {
    _panel = document.createElement('div');
    _panel.id = 'perf-notes-panel';

    _panel.innerHTML = `
      <div class="pnp-header">
        <span>📋 Nhật ký</span>
        <button id="pnp-close" title="Đóng">✕</button>
      </div>
      <div class="pnp-body">
        <div class="pnp-row">
          <label>🎵 Tông lưu</label>
          <input id="pnp-key" type="text" maxlength="8" placeholder="VD: G, Bb, F#m…">
        </div>
        <div class="pnp-row">
          <label>⏱ BPM</label>
          <input id="pnp-bpm" type="number" min="30" max="300" placeholder="VD: 72">
        </div>
        <div class="pnp-row pnp-row-full">
          <label>📝 Ghi chú biểu diễn</label>
          <textarea id="pnp-text" rows="6"
            placeholder="VD:&#10;- Câu 1-2: Đàn dạo 2 lần&#10;- Câu 3: Hát + đàn&#10;- Điệp khúc: Tất cả cùng hát&#10;- Coda: Fade out nhẹ"></textarea>
        </div>
        <div class="pnp-actions">
          <span id="pnp-saved" class="pnp-saved-hint" style="opacity:0">✓ Đã lưu</span>
          <button id="pnp-save-btn" class="btn btn-primary btn-sm">💾 Lưu</button>
        </div>
      </div>`;

    document.body.appendChild(_panel);

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
