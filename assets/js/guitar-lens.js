/**
 * assets/js/guitar-lens.js
 *
 * Guitar Lens — Chế độ chuyên biệt cho Nhạc công Guitar (Ticket L4-2):
 * 1. Chế độ Band + Capo cá nhân (không đổi tông của cả band).
 * 2. Tuỳ chọn "Đơn giản hoá hợp âm" (bỏ 7/9/sus: Cmaj7 → C, D7sus4 → D...).
 * 3. Hiển thị thế bấm Guitar (Guitar Chord Diagrams SVG).
 * 4. Bảng thế bấm mini (Guitar Chord Palette) cho toàn bộ hợp âm trong bài hát.
 */
const GuitarLens = (() => {
  'use strict';

  const STORAGE_CAPO_KEY = 'sheetapp_guitar_personal_capo';
  const STORAGE_SIMPLIFY_KEY = 'sheetapp_guitar_simplify_chords';
  const STORAGE_SHOW_PALETTE_KEY = 'sheetapp_guitar_show_palette';

  let _personalCapo = 0;
  let _simplifyActive = false;
  let _showPalette = true;

  /* ═══ 1. THUẬT TOÁN ĐƠN GIẢN HOÁ HỢP ÂM (CHORD SIMPLIFICATION) ═══ */
  /**
   * Đơn giản hoá hợp âm theo yêu cầu nghiệm thu L4-2:
   * Cmaj7 → C, D7sus4 → D, Am7 → Am, Em9/G → Em/G, Cadd9 → C...
   * Giữ nguyên Root và Quality (m / dim / aug) cơ bản, loại bỏ các phần mở rộng (7, 9, 11, 13, sus, add).
   */
  function simplifyChord(chord) {
    if (!chord || typeof chord !== 'string') return chord;
    const s = chord.trim();
    if (!s || s === 'N.C.' || s === '%' || s === '/') return s;

    // Tách slash bass (ví dụ: Cmaj7/E, Em9/G)
    const slashIdx = s.indexOf('/');
    const mainChord = slashIdx !== -1 ? s.slice(0, slashIdx).trim() : s;
    const bassPart = slashIdx !== -1 ? s.slice(slashIdx).trim() : '';

    // Trích xuất Root ([A-G] kèm accidental # hoặc b)
    const match = mainChord.match(/^([A-G][#b]?)(.*)$/);
    if (!match) return s;

    const root = match[1];
    const suffix = match[2].trim();

    // Nếu không có hậu tố: đã là hợp âm trưởng tự nhiên (C, D, F#...)
    if (!suffix) {
      return root + bassPart;
    }

    // 1. Suspended chords (sus, sus2, sus4, 7sus4, 9sus4, 7sus...)
    if (/sus/i.test(suffix)) {
      return root + bassPart;
    }

    // 2. Minor và Minor extensions: m, min, -, m7, min7, m9, m11, m13, m6, m7b5, m/maj7...
    // Chú ý: kiểm tra không phải maj/Maj
    if (/^m(?!aj)/.test(suffix) || /^min/i.test(suffix) || /^-(?![0-9])/.test(suffix)) {
      return root + 'm' + bassPart;
    }

    // 3. Major 7th & extensions (maj7, maj9, maj13, M7, ^7, Δ7, ma7...)
    // Biến thành hợp âm Trưởng tự nhiên (Cmaj7 -> C)
    if (/^(maj|ma|\^|Δ)(7|9|11|13)?(#11|\+4)?$/i.test(suffix) || /^M(7|9|11|13)?$/.test(suffix)) {
      return root + bassPart;
    }

    // 4. Dominant và Add extensions (7, 9, 11, 13, 7#9, 7b9, 7#5, 7b5, add9, add2, 6, 6/9...)
    // Quy về hợp âm Trưởng tự nhiên (G7 -> G, Cadd9 -> C, B7 -> B)
    if (/^(7|9|11|13|add|2|6)/i.test(suffix)) {
      return root + bassPart;
    }

    // 5. Diminished (dim, dim7, °, o)
    if (/^(dim|°|o)/i.test(suffix)) {
      return root + 'dim' + bassPart;
    }

    // 6. Augmented (aug, +)
    if (/^(aug|\+)/i.test(suffix)) {
      return root + 'aug' + bassPart;
    }

    // 7. Power chord 5
    if (suffix === '5') {
      return root + '5' + bassPart;
    }

    // Fallback: nếu không nhận diện được phần mở rộng lạ, quy về root
    return root + bassPart;
  }

  /* ═══ 2. CƠ SỞ DỮ LIỆU THẾ BẤM GUITAR (GUITAR CHORD FRETBOARD DB) ═══ */
  // 6 dây từ Dây 6 (E trầm) đến Dây 1 (e cao). Giá trị: số ngăn phím (0 = buông, 'x' = không gảy)
  const GUITAR_CHORD_DB = {
    // C family
    'C':     { frets: ['x', 3, 2, 0, 1, 0], baseFret: 1 },
    'Cm':    { frets: ['x', 3, 5, 5, 4, 3], baseFret: 3, barre: 3 },
    'C7':    { frets: ['x', 3, 2, 3, 1, 0], baseFret: 1 },
    'Cmaj7': { frets: ['x', 3, 2, 0, 0, 0], baseFret: 1 },
    'Csus4': { frets: ['x', 3, 3, 0, 1, 1], baseFret: 1 },
    'C/E':   { frets: [0, 3, 2, 0, 1, 0], baseFret: 1 },
    'C/G':   { frets: [3, 3, 2, 0, 1, 0], baseFret: 1 },
    // C# / Db
    'C#':    { frets: ['x', 4, 6, 6, 6, 4], baseFret: 4, barre: 4 },
    'C#m':   { frets: ['x', 4, 6, 6, 5, 4], baseFret: 4, barre: 4 },
    'Db':    { frets: ['x', 4, 6, 6, 6, 4], baseFret: 4, barre: 4 },
    'Dbm':   { frets: ['x', 4, 6, 6, 5, 4], baseFret: 4, barre: 4 },
    // D family
    'D':     { frets: ['x', 'x', 0, 2, 3, 2], baseFret: 1 },
    'Dm':    { frets: ['x', 'x', 0, 2, 3, 1], baseFret: 1 },
    'D7':    { frets: ['x', 'x', 0, 2, 1, 2], baseFret: 1 },
    'Dmaj7': { frets: ['x', 'x', 0, 2, 2, 2], baseFret: 1 },
    'Dsus4': { frets: ['x', 'x', 0, 2, 3, 3], baseFret: 1 },
    'D7sus4':{ frets: ['x', 'x', 0, 2, 1, 3], baseFret: 1 },
    'D/F#':  { frets: [2, 0, 0, 2, 3, 2], baseFret: 1 },
    'D/A':   { frets: ['x', 0, 0, 2, 3, 2], baseFret: 1 },
    // D# / Eb
    'Eb':    { frets: ['x', 6, 5, 3, 4, 3], baseFret: 3 },
    'Ebm':   { frets: ['x', 6, 8, 8, 7, 6], baseFret: 6, barre: 6 },
    'D#':    { frets: ['x', 6, 5, 3, 4, 3], baseFret: 3 },
    'D#m':   { frets: ['x', 6, 8, 8, 7, 6], baseFret: 6, barre: 6 },
    // E family
    'E':     { frets: [0, 2, 2, 1, 0, 0], baseFret: 1 },
    'Em':    { frets: [0, 2, 2, 0, 0, 0], baseFret: 1 },
    'E7':    { frets: [0, 2, 0, 1, 0, 0], baseFret: 1 },
    'Esus4': { frets: [0, 2, 2, 2, 0, 0], baseFret: 1 },
    'Em/G':  { frets: [3, 2, 2, 0, 0, 0], baseFret: 1 },
    'Em/B':  { frets: ['x', 2, 2, 0, 0, 0], baseFret: 1 },
    // F family
    'F':     { frets: [1, 3, 3, 2, 1, 1], baseFret: 1, barre: 1 },
    'Fm':    { frets: [1, 3, 3, 1, 1, 1], baseFret: 1, barre: 1 },
    'F7':    { frets: [1, 3, 1, 2, 1, 1], baseFret: 1, barre: 1 },
    'Fmaj7': { frets: ['x', 'x', 3, 2, 1, 0], baseFret: 1 },
    'F/A':   { frets: ['x', 0, 3, 2, 1, 1], baseFret: 1 },
    'F/C':   { frets: ['x', 3, 3, 2, 1, 1], baseFret: 1 },
    // F# / Gb
    'F#':    { frets: [2, 4, 4, 3, 2, 2], baseFret: 2, barre: 2 },
    'F#m':   { frets: [2, 4, 4, 2, 2, 2], baseFret: 2, barre: 2 },
    'F#7':   { frets: [2, 4, 2, 3, 2, 2], baseFret: 2, barre: 2 },
    'Gb':    { frets: [2, 4, 4, 3, 2, 2], baseFret: 2, barre: 2 },
    'Gbm':   { frets: [2, 4, 4, 2, 2, 2], baseFret: 2, barre: 2 },
    // G family
    'G':     { frets: [3, 2, 0, 0, 0, 3], baseFret: 1 },
    'Gm':    { frets: [3, 5, 5, 3, 3, 3], baseFret: 3, barre: 3 },
    'G7':    { frets: [3, 2, 0, 0, 0, 1], baseFret: 1 },
    'Gmaj7': { frets: [3, 2, 0, 0, 0, 2], baseFret: 1 },
    'Gsus4': { frets: [3, 3, 0, 0, 1, 3], baseFret: 1 },
    'G/B':   { frets: ['x', 2, 0, 0, 0, 3], baseFret: 1 },
    'G/D':   { frets: ['x', 'x', 0, 0, 0, 3], baseFret: 1 },
    // G# / Ab
    'Ab':    { frets: [4, 6, 6, 5, 4, 4], baseFret: 4, barre: 4 },
    'Abm':   { frets: [4, 6, 6, 4, 4, 4], baseFret: 4, barre: 4 },
    'G#':    { frets: [4, 6, 6, 5, 4, 4], baseFret: 4, barre: 4 },
    'G#m':   { frets: [4, 6, 6, 4, 4, 4], baseFret: 4, barre: 4 },
    // A family
    'A':     { frets: ['x', 0, 2, 2, 2, 0], baseFret: 1 },
    'Am':    { frets: ['x', 0, 2, 2, 1, 0], baseFret: 1 },
    'A7':    { frets: ['x', 0, 2, 0, 2, 0], baseFret: 1 },
    'Amaj7': { frets: ['x', 0, 2, 1, 2, 0], baseFret: 1 },
    'Asus4': { frets: ['x', 0, 2, 2, 3, 0], baseFret: 1 },
    'A/C#':  { frets: ['x', 4, 2, 2, 2, 0], baseFret: 1 },
    'Am/C':  { frets: ['x', 3, 2, 2, 1, 0], baseFret: 1 },
    // A# / Bb
    'Bb':    { frets: ['x', 1, 3, 3, 3, 1], baseFret: 1, barre: 1 },
    'Bbm':   { frets: ['x', 1, 3, 3, 2, 1], baseFret: 1, barre: 1 },
    'A#':    { frets: ['x', 1, 3, 3, 3, 1], baseFret: 1, barre: 1 },
    'A#m':   { frets: ['x', 1, 3, 3, 2, 1], baseFret: 1, barre: 1 },
    // B family
    'B':     { frets: ['x', 2, 4, 4, 4, 2], baseFret: 2, barre: 2 },
    'Bm':    { frets: ['x', 2, 4, 4, 3, 2], baseFret: 2, barre: 2 },
    'B7':    { frets: ['x', 2, 1, 2, 0, 2], baseFret: 1 },
    'Bsus4': { frets: ['x', 2, 4, 4, 5, 2], baseFret: 2, barre: 2 },
  };

  /**
   * Tra cứu thế bấm hợp âm.
   * Nếu không có chính xác, tự động fallback qua simplifyChord.
   */
  function getChordFingering(chord) {
    if (!chord) return null;
    const clean = chord.trim();
    if (GUITAR_CHORD_DB[clean]) {
      return { ...GUITAR_CHORD_DB[clean], name: clean };
    }
    // Thử bỏ slash bass (C/E -> C)
    const noSlash = clean.split('/')[0].trim();
    if (GUITAR_CHORD_DB[noSlash]) {
      return { ...GUITAR_CHORD_DB[noSlash], name: clean };
    }
    // Thử đơn giản hoá (Cmaj7 -> C, D7sus4 -> D)
    const simplified = simplifyChord(clean);
    if (GUITAR_CHORD_DB[simplified]) {
      return { ...GUITAR_CHORD_DB[simplified], name: clean, simplifiedName: simplified };
    }
    const simpNoSlash = simplified.split('/')[0].trim();
    if (GUITAR_CHORD_DB[simpNoSlash]) {
      return { ...GUITAR_CHORD_DB[simpNoSlash], name: clean, simplifiedName: simpNoSlash };
    }
    return null;
  }

  /* ═══ 3. TẠO SƠ ĐỒ THẾ BẤM SVG (SVG CHORD DIAGRAM) ═══ */
  /**
   * Sinh chuỗi SVG hiển thị cần đàn 6 dây x 4 phím sắc nét, chuẩn Dark & Light mode.
   */
  function renderChordSvg(chordName, width = 76, height = 90) {
    const fingering = getChordFingering(chordName);
    const displayName = chordName || '';
    if (!fingering) {
      return `
        <svg class="guitar-chord-svg" width="${width}" height="${height}" viewBox="0 0 76 90" aria-label="${displayName}">
          <text x="38" y="16" text-anchor="middle" font-size="13" font-weight="700" fill="currentColor">${displayName}</text>
          <text x="38" y="52" text-anchor="middle" font-size="10" fill="var(--text-muted, #888)">Thế bấm?</text>
        </svg>
      `;
    }

    const { frets, baseFret = 1 } = fingering;
    // Tọa độ cần đàn
    const startX = 14;
    const stringSpacing = 9.5; // 6 dây: 14, 23.5, 33, 42.5, 52, 61.5
    const startY = 28;
    const fretSpacing = 13;   // 4 phím: 28, 41, 54, 67, 80

    let svg = `<svg class="guitar-chord-svg" width="${width}" height="${height}" viewBox="0 0 76 90" aria-label="Hợp âm ${displayName}">`;
    // 1. Tên hợp âm trên đỉnh
    svg += `<text x="38" y="15" text-anchor="middle" font-size="12" font-weight="800" fill="var(--accent-amber, #f59e0b)">${displayName}</text>`;

    // 2. Ký hiệu Nut hoặc Fret đầu cần
    if (baseFret === 1) {
      svg += `<line x1="${startX}" y1="${startY}" x2="${startX + 5 * stringSpacing}" y2="${startY}" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>`;
    } else {
      svg += `<line x1="${startX}" y1="${startY}" x2="${startX + 5 * stringSpacing}" y2="${startY}" stroke="currentColor" stroke-width="1.2"/>`;
      svg += `<text x="7" y="${startY + 10}" text-anchor="middle" font-size="8.5" font-weight="700" fill="currentColor">${baseFret}fr</text>`;
    }

    // 3. Các đường phím ngang (frets)
    for (let f = 1; f <= 4; f++) {
      const y = startY + f * fretSpacing;
      svg += `<line x1="${startX}" y1="${y}" x2="${startX + 5 * stringSpacing}" y2="${y}" stroke="currentColor" stroke-width="0.8" opacity="0.45"/>`;
    }

    // 4. Các đường dây dọc (strings)
    for (let s = 0; s < 6; s++) {
      const x = startX + s * stringSpacing;
      const strokeW = s < 3 ? 1.2 : 0.8; // Dây trầm dày hơn
      svg += `<line x1="${x}" y1="${startY}" x2="${x}" y2="${startY + 4 * fretSpacing}" stroke="currentColor" stroke-width="${strokeW}" opacity="0.7"/>`;
    }

    // 5. Ký hiệu dây trên nut (x: không gảy, o: buông) và nốt bấm
    for (let s = 0; s < 6; s++) {
      const x = startX + s * stringSpacing;
      const val = frets[s];

      if (val === 'x' || val === 'X') {
        svg += `<text x="${x}" y="${startY - 4}" text-anchor="middle" font-size="9" font-weight="700" fill="var(--danger, #ef4444)">×</text>`;
      } else if (val === 0) {
        svg += `<circle cx="${x}" cy="${startY - 5}" r="3" fill="none" stroke="currentColor" stroke-width="1.2"/>`;
      } else if (typeof val === 'number' && val > 0) {
        const fretOffset = baseFret === 1 ? val : (val - baseFret + 1);
        if (fretOffset >= 1 && fretOffset <= 4) {
          const cy = startY + (fretOffset - 0.5) * fretSpacing;
          svg += `<circle cx="${x}" cy="${cy}" r="4" fill="var(--accent-amber, #f59e0b)"/>`;
        }
      }
    }

    svg += `</svg>`;
    return svg;
  }

  /* ═══ 4. QUẢN LÝ CAPO CÁ NHÂN & ĐƠN GIẢN HÓA ═══ */
  function getPersonalCapo() {
    return _personalCapo;
  }

  function setPersonalCapo(capoVal, notify = true) {
    const val = Math.max(0, Math.min(11, parseInt(capoVal, 10) || 0));
    _personalCapo = val;

    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_CAPO_KEY, String(_personalCapo));
      } catch (_) {}
    }

    if (window.Store) {
      window.Store.set('guitarPersonalCapo', _personalCapo);
    }

    _updateUI();

    if (notify && window.App?.showToast) {
      if (_personalCapo > 0) {
        window.App.showToast(`🎸 Capo cá nhân: Ngăn ${_personalCapo} (Thế bấm dịch ${_personalCapo} cung)`, 'info', 1600);
      } else {
        window.App.showToast('🎸 Capo cá nhân: Không dùng (Capo 0)', 'info', 1400);
      }
    }

    // Cập nhật hiển thị chế độ Band / Lyric
    if (window.DisplaySettings?.renderLyricViewIfActive) {
      window.DisplaySettings.renderLyricViewIfActive();
    }

    if (typeof EventBus !== 'undefined') {
      EventBus.emit('guitar:capo-changed', { capo: _personalCapo });
    }
  }

  function isSimplifyActive() {
    return _simplifyActive;
  }

  function toggleSimplify(forceVal) {
    _simplifyActive = typeof forceVal === 'boolean' ? forceVal : !_simplifyActive;

    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_SIMPLIFY_KEY, _simplifyActive ? '1' : '0');
      } catch (_) {}
    }

    if (window.Store) {
      window.Store.set('guitarSimplifyChords', _simplifyActive);
    }

    _updateUI();

    if (window.App?.showToast) {
      const msg = _simplifyActive ? '⚡ Đơn giản hoá hợp âm: ĐANG BẬT (bỏ 7/9/sus)' : '⚡ Đơn giản hoá hợp âm: ĐÃ TẮT (nguyên bản)';
      window.App.showToast(msg, 'info', 1600);
    }

    if (window.DisplaySettings?.renderLyricViewIfActive) {
      window.DisplaySettings.renderLyricViewIfActive();
    }

    refreshPalette();

    if (typeof EventBus !== 'undefined') {
      EventBus.emit('guitar:simplify-changed', { active: _simplifyActive });
    }

    return _simplifyActive;
  }

  /* ═══ 5. BẢNG THẾ BẤM TRỰC QUAN (CHORD PALETTE) ═══ */
  function extractCurrentChords() {
    if (typeof document === 'undefined') return [];
    const chords = new Set();

    // 1. Trích xuất từ Lyric View nếu có
    const lyricChords = document.querySelectorAll('#lyric-view-container .lv-chord:not(.lv-chord-empty)');
    if (lyricChords.length > 0) {
      lyricChords.forEach(el => {
        const text = el.textContent?.trim();
        if (text && text !== 'N.C.' && text !== '%') {
          chords.add(_simplifyActive ? simplifyChord(text) : text);
        }
      });
    }

    // 2. Trích xuất từ ChordCanvas customChords
    if (chords.size === 0 && window.ChordCanvas?.getCustomChords) {
      const custom = window.ChordCanvas.getCustomChords() || {};
      Object.values(custom).forEach(c => {
        if (c) {
          const shifted = c;
          chords.add(_simplifyActive ? simplifyChord(shifted) : shifted);
        }
      });
    }

    return Array.from(chords);
  }

  function refreshPalette() {
    if (typeof document === 'undefined') return;
    const paletteEl = document.getElementById('guitar-chord-palette');
    if (!paletteEl) return;

    const chords = extractCurrentChords();
    if (chords.length === 0) {
      paletteEl.innerHTML = `<span class="palette-empty" style="color:var(--text-muted);font-size:0.75rem;padding:6px 10px;">Chưa có hợp âm để hiển thị thế bấm</span>`;
      return;
    }

    let html = '';
    for (const c of chords) {
      const svg = renderChordSvg(c, 64, 76);
      html += `
        <div class="guitar-chord-card" data-chord="${window.SafeHtml ? window.SafeHtml.escape(c) : c}" title="Bấm để xem thế bấm ${c}" style="display:inline-flex;flex-direction:column;align-items:center;background:var(--bg-card, rgba(255,255,255,0.06));border:1px solid var(--border);border-radius:6px;padding:4px 6px;cursor:pointer;touch-action:manipulation;">
          ${svg}
        </div>
      `;
    }
    paletteEl.innerHTML = html;
  }

  /* ═══ 6. GIAO DIỆN THANH CÔNG CỤ GUITAR LENS BAR ═══ */
  function _createGuitarLensBar() {
    if (typeof document === 'undefined') return null;
    let bar = document.getElementById('guitar-lens-bar');
    if (bar) return bar;

    bar = document.createElement('div');
    bar.id = 'guitar-lens-bar';
    bar.className = 'guitar-lens-bar hidden';
    bar.setAttribute('aria-label', 'Bảng điều khiển Guitar Stage Lens');

    bar.innerHTML = `
      <div class="guitar-lens-inner" style="display:flex;align-items:center;flex-wrap:wrap;gap:8px;padding:6px 12px;background:var(--bg-surface,#18181b);border-bottom:1px solid var(--border,#3f3f46);font-size:0.82rem;">
        <span class="guitar-lens-tag" style="font-weight:700;color:var(--accent-amber,#f59e0b);display:flex;align-items:center;gap:4px;">
          <span>🎸</span> Guitar Lens:
        </span>

        <!-- Capo cá nhân -->
        <div class="guitar-capo-control" style="display:inline-flex;align-items:center;gap:3px;background:rgba(255,255,255,0.08);border-radius:6px;padding:2px 6px;">
          <span style="color:var(--text-muted,#a1a1aa);font-size:0.78rem;">Capo:</span>
          <button type="button" id="btn-guitar-capo-dec" class="icon-btn-xs" title="Giảm Capo cá nhân" style="min-width:24px;min-height:24px;padding:0;cursor:pointer;">−</button>
          <strong id="guitar-capo-val" style="min-width:18px;text-align:center;color:var(--text-primary,#fff);">${_personalCapo}</strong>
          <button type="button" id="btn-guitar-capo-inc" class="icon-btn-xs" title="Tăng Capo cá nhân" style="min-width:24px;min-height:24px;padding:0;cursor:pointer;">+</button>
        </div>

        <!-- Đơn giản hoá hợp âm -->
        <button type="button" id="btn-guitar-simplify" class="btn-guitar-tool ${_simplifyActive ? 'active' : ''}" title="Bỏ hợp âm 7/9/sus, quy về hợp âm chuẩn" style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:6px;border:1px solid var(--border,#3f3f46);background:var(--bg-overlay,rgba(255,255,255,0.06));color:var(--text-primary,#fff);cursor:pointer;touch-action:manipulation;min-height:32px;">
          <span>⚡</span>
          <span id="btn-guitar-simplify-label">${_simplifyActive ? 'Đơn giản hoá: BẬT' : 'Đơn giản hoá'}</span>
        </button>

        <!-- Chuyển nhanh chế độ Band -->
        <button type="button" id="btn-guitar-quick-band" class="btn-guitar-tool" title="Mở nhanh chế độ Lời & Hợp âm chữ (Band Mode)" style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:6px;border:1px solid var(--border,#3f3f46);background:var(--bg-overlay,rgba(255,255,255,0.06));color:var(--text-primary,#fff);cursor:pointer;touch-action:manipulation;min-height:32px;">
          <span>📄</span>
          <span>Chế độ Band</span>
        </button>

        <!-- Bật/tắt dải thế bấm -->
        <button type="button" id="btn-guitar-toggle-palette" class="btn-guitar-tool ${_showPalette ? 'active' : ''}" title="Ẩn/hiện dải thế bấm bài hát" style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:6px;border:1px solid var(--border,#3f3f46);background:var(--bg-overlay,rgba(255,255,255,0.06));color:var(--text-primary,#fff);cursor:pointer;touch-action:manipulation;min-height:32px;">
          <span>📖</span>
          <span>Bảng thế bấm</span>
        </button>

        <!-- Dải Palette cuộn ngang -->
        <div id="guitar-chord-palette" class="guitar-chord-palette ${_showPalette ? '' : 'hidden'}" style="width:100%;display:flex;align-items:center;gap:8px;overflow-x:auto;padding:6px 0;scrollbar-width:thin;">
        </div>
      </div>
    `;

    // Chèn thanh guitar bar ngay trước #sheet-area
    const sheetArea = document.getElementById('sheet-area') || document.getElementById('main-container') || document.body;
    if (sheetArea && sheetArea.parentNode) {
      sheetArea.parentNode.insertBefore(bar, sheetArea);
    } else if (document.body) {
      document.body.appendChild(bar);
    }

    // Gắn sự kiện
    bar.querySelector('#btn-guitar-capo-dec')?.addEventListener('click', () => {
      setPersonalCapo(Math.max(0, _personalCapo - 1));
    });
    bar.querySelector('#btn-guitar-capo-inc')?.addEventListener('click', () => {
      setPersonalCapo(Math.min(11, _personalCapo + 1));
    });

    bar.querySelector('#btn-guitar-simplify')?.addEventListener('click', () => {
      toggleSimplify();
    });

    bar.querySelector('#btn-guitar-quick-band')?.addEventListener('click', () => {
      const btnBand = document.getElementById('btn-band-toggle') || document.getElementById('btn-lyric-view');
      if (btnBand) btnBand.click();
    });

    bar.querySelector('#btn-guitar-toggle-palette')?.addEventListener('click', () => {
      _showPalette = !_showPalette;
      try {
        localStorage.setItem(STORAGE_SHOW_PALETTE_KEY, _showPalette ? '1' : '0');
      } catch (_) {}
      const palette = bar.querySelector('#guitar-chord-palette');
      if (palette) palette.classList.toggle('hidden', !_showPalette);
      const btn = bar.querySelector('#btn-guitar-toggle-palette');
      if (btn) btn.classList.toggle('active', _showPalette);
      if (_showPalette) refreshPalette();
    });

    return bar;
  }

  function _updateUI() {
    if (typeof document === 'undefined') return;
    const capoEl = document.getElementById('guitar-capo-val');
    if (capoEl) capoEl.textContent = String(_personalCapo);

    const simpBtn = document.getElementById('btn-guitar-simplify');
    const simpLabel = document.getElementById('btn-guitar-simplify-label');
    if (simpBtn) simpBtn.classList.toggle('active', _simplifyActive);
    if (simpLabel) simpLabel.textContent = _simplifyActive ? 'Đơn giản hoá: BẬT' : 'Đơn giản hoá';

    const isGuitar = window.StageLens?.getCurrentRole?.() === 'guitar' || document.body?.dataset?.stageLens === 'guitar';
    const bar = document.getElementById('guitar-lens-bar');
    if (bar) {
      bar.classList.toggle('hidden', !isGuitar);
    }
  }

  function init() {
    if (typeof localStorage !== 'undefined') {
      try {
        const savedCapo = localStorage.getItem(STORAGE_CAPO_KEY);
        if (savedCapo !== null) _personalCapo = parseInt(savedCapo, 10) || 0;

        const savedSimp = localStorage.getItem(STORAGE_SIMPLIFY_KEY);
        if (savedSimp !== null) _simplifyActive = savedSimp === '1';

        const savedPal = localStorage.getItem(STORAGE_SHOW_PALETTE_KEY);
        if (savedPal !== null) _showPalette = savedPal !== '0';
      } catch (_) {}
    }

    _createGuitarLensBar();
    _updateUI();

    // Lắng nghe thay đổi vai trò
    if (typeof EventBus !== 'undefined') {
      EventBus.on('role:changed', (data) => {
        const isGuitar = data?.role === 'guitar';
        const bar = document.getElementById('guitar-lens-bar');
        if (bar) bar.classList.toggle('hidden', !isGuitar);
        if (isGuitar) {
          setTimeout(refreshPalette, 200);
        }
      });

      EventBus.on('song:loaded', () => {
        setTimeout(refreshPalette, 300);
      });
    }

    // Tải palette lần đầu
    setTimeout(refreshPalette, 600);
  }

  return {
    init,
    simplifyChord,
    getChordFingering,
    renderChordSvg,
    getPersonalCapo,
    setPersonalCapo,
    isSimplifyActive,
    toggleSimplify,
    refreshPalette,
    extractCurrentChords
  };
})();

window.GuitarLens = GuitarLens;
