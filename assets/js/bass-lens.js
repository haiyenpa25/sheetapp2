/**
 * assets/js/bass-lens.js
 *
 * Bass Lens — Chế độ chuyên biệt cho Nhạc công Bass (Ticket L4-4):
 * 1. Nốt gốc (Root note) chữ to, tương phản cao.
 * 2. Hợp âm đảo lấy nốt bass (C/E → E, G/B → B, D/F# → F#).
 * 3. Hỗ trợ hiển thị nốt Bass nổi bật trên sân khấu, dễ đọc từ khoảng cách xa.
 */
const BassLens = (() => {
  'use strict';

  const STORAGE_BIG_BASS_KEY = 'sheetapp_bass_big_notes';
  let _bigBassActive = true;

  /**
   * Trích xuất nốt bass từ hợp âm theo yêu cầu nghiệm thu L4-4:
   * - Hợp âm đảo (slash chord): C/E → E, G/B → B, D/F# → F#, Em9/G → G
   * - Hợp âm thường: C → C, Am7 → A, F#m → F#, Bbmaj7 → Bb
   */
  function extractBassNote(chord) {
    if (!chord || typeof chord !== 'string') return '';
    const s = chord.trim();
    if (!s || s === 'N.C.' || s === '%' || s === '/') return '';

    // 1. Kiểm tra hợp âm đảo có nốt Bass sau dấu slash '/'
    const slashIdx = s.indexOf('/');
    if (slashIdx !== -1) {
      const bassPart = s.slice(slashIdx + 1).trim();
      const bassMatch = bassPart.match(/^([A-G][#b]?)/);
      if (bassMatch) {
        return bassMatch[1];
      }
      return bassPart;
    }

    // 2. Hợp âm thường: trích xuất nốt gốc (Root Note)
    const rootMatch = s.match(/^([A-G][#b]?)/);
    if (rootMatch) {
      return rootMatch[1];
    }

    return s;
  }

  /**
   * Trích xuất thông tin chi tiết cho nhạc công Bass:
   * Trả về: { bassNote, rootNote, isSlash, fullChord, displayHtml }
   */
  function parseBassInfo(chord) {
    if (!chord || typeof chord !== 'string') return null;
    const clean = chord.trim();
    if (!clean || clean === 'N.C.' || clean === '%') return null;

    const bass = extractBassNote(clean);
    const rootMatch = clean.match(/^([A-G][#b]?)/);
    const root = rootMatch ? rootMatch[1] : '';
    const isSlash = clean.includes('/') && bass !== root;

    return {
      bassNote: bass,
      rootNote: root,
      isSlash,
      fullChord: clean
    };
  }

  /**
   * Tạo chuỗi HTML hiển thị nốt Bass to kèm hợp âm phụ
   */
  function formatBassDisplay(chord) {
    const info = parseBassInfo(chord);
    if (!info) return chord || '';

    const safeBass = window.SafeHtml ? window.SafeHtml.escape(info.bassNote) : info.bassNote;
    const safeFull = window.SafeHtml ? window.SafeHtml.escape(info.fullChord) : info.fullChord;

    if (info.isSlash) {
      // Hợp âm đảo: Nốt bass khổng lồ + ghi chú hợp âm gốc (ví dụ: E [C/E])
      return `<span class="bass-root-highlight">${safeBass}</span><span class="bass-slash-hint">(${safeFull})</span>`;
    }

    // Hợp âm gốc: Nốt gốc to
    return `<span class="bass-root-highlight">${safeBass}</span>`;
  }

  function isBigBassActive() {
    return _bigBassActive;
  }

  function toggleBigBass(forceVal) {
    _bigBassActive = typeof forceVal === 'boolean' ? forceVal : !_bigBassActive;

    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_BIG_BASS_KEY, _bigBassActive ? '1' : '0');
      } catch (_) {}
    }

    _updateUI();

    if (window.DisplaySettings?.renderLyricViewIfActive) {
      window.DisplaySettings.renderLyricViewIfActive();
    }

    if (typeof EventBus !== 'undefined') {
      EventBus.emit('bass:settings-changed', { bigBass: _bigBassActive });
    }

    return _bigBassActive;
  }

  /* ═══ GIAO DIỆN THANH CÔNG CỤ BASS LENS BAR ═══ */
  function _createBassLensBar() {
    if (typeof document === 'undefined') return null;
    let bar = document.getElementById('bass-lens-bar');
    if (bar) return bar;

    bar = document.createElement('div');
    bar.id = 'bass-lens-bar';
    bar.className = 'bass-lens-bar hidden';
    bar.setAttribute('aria-label', 'Bảng điều khiển Bass Stage Lens');

    bar.innerHTML = `
      <div class="bass-lens-inner" style="display:flex;align-items:center;flex-wrap:wrap;gap:8px;padding:6px 12px;background:var(--bg-surface,#18181b);border-bottom:1px solid var(--border,#3f3f46);font-size:0.82rem;">
        <span class="bass-lens-tag" style="font-weight:700;color:var(--accent-cyan,#06b6d4);display:flex;align-items:center;gap:4px;">
          <span>🎻</span> Bass Lens:
        </span>

        <button type="button" id="btn-bass-toggle-big" class="btn-bass-tool ${_bigBassActive ? 'active' : ''}" title="Hiển thị nốt Bass cỡ lớn dễ nhìn từ xa" style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:6px;border:1px solid var(--border,#3f3f46);background:var(--bg-overlay,rgba(255,255,255,0.06));color:var(--text-primary,#fff);cursor:pointer;touch-action:manipulation;min-height:32px;">
          <span>🔍</span>
          <span id="btn-bass-big-label">${_bigBassActive ? 'Nốt Bass Lớn: BẬT' : 'Nốt Bass Lớn'}</span>
        </button>

        <button type="button" id="btn-bass-quick-band" class="btn-bass-tool" title="Xem dạng Lời & Hợp âm Bass chữ lớn" style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:6px;border:1px solid var(--border,#3f3f46);background:var(--bg-overlay,rgba(255,255,255,0.06));color:var(--text-primary,#fff);cursor:pointer;touch-action:manipulation;min-height:32px;">
          <span>📄</span>
          <span>Chế độ Band (Bass)</span>
        </button>
      </div>
    `;

    const sheetArea = document.getElementById('sheet-area') || document.getElementById('main-container') || document.body;
    if (sheetArea && sheetArea.parentNode) {
      sheetArea.parentNode.insertBefore(bar, sheetArea);
    } else if (document.body) {
      document.body.appendChild(bar);
    }

    bar.querySelector('#btn-bass-toggle-big')?.addEventListener('click', () => {
      toggleBigBass();
    });

    bar.querySelector('#btn-bass-quick-band')?.addEventListener('click', () => {
      const btnBand = document.getElementById('btn-band-toggle') || document.getElementById('btn-lyric-view');
      if (btnBand) btnBand.click();
    });

    return bar;
  }

  function _updateUI() {
    if (typeof document === 'undefined') return;

    const btnBig = document.getElementById('btn-bass-toggle-big');
    const labelBig = document.getElementById('btn-bass-big-label');
    if (btnBig) btnBig.classList.toggle('active', _bigBassActive);
    if (labelBig) labelBig.textContent = _bigBassActive ? 'Nốt Bass Lớn: BẬT' : 'Nốt Bass Lớn';

    const isBass = window.StageLens?.getCurrentRole?.() === 'bass' || document.body?.dataset?.stageLens === 'bass';
    const bar = document.getElementById('bass-lens-bar');
    if (bar) {
      bar.classList.toggle('hidden', !isBass);
    }
  }

  function init() {
    if (typeof localStorage !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_BIG_BASS_KEY);
        if (saved !== null) _bigBassActive = saved !== '0';
      } catch (_) {}
    }

    _createBassLensBar();
    _updateUI();

    if (typeof EventBus !== 'undefined') {
      EventBus.on('role:changed', (data) => {
        const isBass = data?.role === 'bass';
        const bar = document.getElementById('bass-lens-bar');
        if (bar) bar.classList.toggle('hidden', !isBass);
      });
    }
  }

  return {
    init,
    extractBassNote,
    parseBassInfo,
    formatBassDisplay,
    isBigBassActive,
    toggleBigBass
  };
})();

window.BassLens = BassLens;
