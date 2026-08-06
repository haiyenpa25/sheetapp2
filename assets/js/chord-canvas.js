/**
 * chord-canvas.js — Multi-Set Chord Manager (Core)
 *
 * Hỗ trợ:
 *  - "Mặc định": đọc/ghi hợp âm trực tiếp vào XML gốc (thông qua ChordCanvasXML)
 *  - Custom sets: lưu trong api/chord_sets.php (JSON)
 *  - Giao diện và XML được tách rời sang ChordCanvasUI và ChordCanvasXML.
 */
const ChordCanvas = (() => {
  'use strict';

  /* ─── State ───────────────────────────────────────────────────────────────── */
  let _editEnabled   = false;
  let _highlightMode = false; // Chế độ nổi bật: badge tím đậm ngay cả khi không edit
  let _popup         = null;
  let _currentSet    = 'default';
  let _prevSet       = 'default'; // Track set tr\u01b0\u1edbc \u0111\u1ec3 quy\u1ebft \u0111\u1ecbnh reload OSMD
  let _customChords  = {};
  let _noteEls       = [];
  let _ro            = null;
  let _undoStack     = [];   // [{set, chords}]
  let _redoStack     = [];   // [{set, chords}]
  let _songUseFlats  = null; // Cache: null = chưa biết, true/false = đã phân tích

  const DOT_CLASS    = 'cc-dot';
  const BTN_CLASS    = 'cc-dot-btn';
  const HIGHLIGHT_KEY = 'sheetapp_chord_highlight'; // localStorage key

  let _isInitialized = false;

  /* ─── Init ──────────────────────────────────────────────────── */
  function init() {
    if (_isInitialized) return;
    _isInitialized = true;

    // Restore highlight mode từ localStorage
    try { _highlightMode = localStorage.getItem(HIGHLIGHT_KEY) === 'true'; } catch(e) {}

    // Cả 2 nút: hidden compat + visible bar button đều trigger toggleAddMode
    document.getElementById('btn-add-chord-mode')?.addEventListener('click', toggleAddMode);
    document.getElementById('btn-add-chord-mode-bar')?.addEventListener('click', toggleAddMode);

    // Nút Hoàn tất: lưu set hiện tại rồi tắt edit mode
    const doneBtn = document.getElementById('btn-cancel-add-chord');
    if (doneBtn) {
      doneBtn.addEventListener('click', async () => {
        // Nếu đang sửa custom set (HD, ...) — đảm bảo đã được lưu
        if (_currentSet !== 'default' && Object.keys(_customChords).length > 0) {
          await _saveCustomSet();
        }
        setAddMode(false);
      });
    }

    // Nút highlight mode
    document.getElementById('btn-chord-highlight')?.addEventListener('click', toggleHighlight);

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') { _closePopup(); setAddMode(false); }
    });
    
    // ResizeObserver: rebuild khi container resize (khi đổi cửa sổ)
    const container = document.getElementById('osmd-container');
    if (container) {
      let rTid = null;
      _ro = new ResizeObserver(() => {
        // Luôn rebuild khi container resize — kể cả view mode thường
        clearTimeout(rTid);
        rTid = setTimeout(() => { if (!_popup) _build(); }, 150);
      });
      _ro.observe(container);
    }

    // visualViewport: cho phép rebuild khi pinch-zoom trên iPad (ResizeObserver không bắt được)
    if (window.visualViewport) {
      let vpTid = null;
      const onVpChange = () => {
        // Luôn rebuild khi viewport thay đổi (pinch zoom mobile)
        clearTimeout(vpTid);
        vpTid = setTimeout(() => { if (!_popup) _build(); }, 250);
      };
      window.visualViewport.addEventListener('resize', onVpChange);
      window.visualViewport.addEventListener('scroll', onVpChange);
    }
    

  }

  function onOSMDRendered() { 
    _alignOSMDChords();
    // Dùng rAF + timeout để đảm bảo SVG đã layout xong trước khi build dots
    setTimeout(() => requestAnimationFrame(_build), 350); 
  }
  function reposition() { 
    _alignOSMDChords();
    setTimeout(() => requestAnimationFrame(_build), 200); 
  }

  function _alignOSMDChords() {
    const container = document.getElementById('osmd-container');
    if (!container) return;
    const svg = container.querySelector('svg');
    if (!svg) return;
    
    // Tìm tất cả Hợp âm OSMD (dựa vào font marker OSMDChordFont)
    const chords = Array.from(svg.querySelectorAll('text[font-family*="OSMDChordFont"]'));
    if (!chords.length) return;

    // Phân nhóm hợp âm theo dòng (system). Các hợp âm cùng dòng thường có Y chênh lệch < 80px
    const systems = [];
    chords.forEach(c => {
      const yStr = c.getAttribute('y');
      if (!yStr) return;
      const y = parseFloat(yStr);
      let found = false;
      for (const sys of systems) {
        if (Math.abs(sys.avgY - y) < 80) {
          sys.chords.push(c);
          sys.minY = Math.min(sys.minY, y);
          let sum = 0;
          sys.chords.forEach(txt => sum += parseFloat(txt.getAttribute('y')));
          sys.avgY = sum / sys.chords.length;
          found = true;
          break;
        }
      }
      if (!found) {
        systems.push({ avgY: y, minY: y, chords: [c] });
      }
    });

    // Ép toàn bộ hợp âm trên cùng 1 dòng về 1 tọa độ Y thẳng tắp
    systems.forEach(sys => {
      sys.chords.forEach(c => c.setAttribute('y', sys.minY));
    });
  }

  async function loadSong(songId, initialSet = 'HD') {
    _clear();
    setAddMode(false);
    _currentSet   = initialSet || 'HD';
    _customChords = {};
    _songUseFlats = null; // Reset cache phân tích giáng/thăng cho bài mới

    // Pre-fetch chords đồng thời với XML fetch của app.js (không block)
    if (songId) {
      try {
        const r = await window.ApiService.chordSets.load(songId, _currentSet);
        if (r.success && r.chords) {
          r.chords.forEach(({ measureIdx, noteIdx, chord }) => {
            _customChords[`${measureIdx}_${noteIdx}`] = chord;
          });
        }
      } catch(e) {}
    }

    setTimeout(_refreshSetDropdown, 300);
  }

  function clearSong() { _clear(); setAddMode(false); }

  /* ─── Mode ──────────────────────────────────────────────────── */
  function setAddMode(on) {
    _editEnabled = !!on;

    // Sync cả 2 nút toggle (hidden compat + visible bar)
    document.getElementById('btn-add-chord-mode')?.classList.toggle('active', on);
    document.getElementById('btn-add-chord-mode-bar')?.classList.toggle('active', on);

    // Floating hint banner (mới)
    document.getElementById('chord-edit-hint')?.classList.toggle('hidden', !on);

    // Inline edit controls trong bar: clear-all và cancel
    document.getElementById('btn-clear-all-chords')?.classList.toggle('hidden', !on);
    document.getElementById('btn-cancel-add-chord')?.classList.toggle('hidden', !on);

    // Legacy compat
    document.getElementById('add-chord-hint')?.classList.toggle('hidden', !on);

    // Chord dots
    // Thay vì ẩn hiện display, ta gọi _build() để nó tự render lại trạng thái Edit/View
    if (on) {
      _build();
    } else {
      _closePopup();
      _build();
    }
  }

  function toggleAddMode() {
    // Kiểm tra quyền — cần ít nhất role "banhat"
    if (!_editEnabled && !window.Auth?.isBanhat?.()) {
      window.App?.showToast?.('⚠️ Cần đăng nhập với quyền Ban Hát để thêm hợp âm', 'error');
      return;
    }
    setAddMode(!_editEnabled);
  }

  /* ─── Highlight Mode ─────────────────────────────────────────── */
  /**
   * Chế độ nổi bật: badge tím đậm thường trực, không cần vào edit mode.
   * Phân biệt với edit mode: click badge mở popup nhưng cursor không dời về từng nốt.
   */
  function toggleHighlight() {
    _highlightMode = !_highlightMode;
    try { localStorage.setItem(HIGHLIGHT_KEY, String(_highlightMode)); } catch(e) {}

    // Sync nút
    const btn = document.getElementById('btn-chord-highlight');
    if (btn) {
      btn.classList.toggle('active', _highlightMode);
      btn.title = _highlightMode ? 'Tắt nổi bật hợp âm' : 'Bật nổi bật hợp âm';
    }

    // Rebuild overlay
    _build();
  }

  function setHighlightMode(on) {
    _highlightMode = !!on;
    try { localStorage.setItem(HIGHLIGHT_KEY, String(_highlightMode)); } catch(e) {}
    const btn = document.getElementById('btn-chord-highlight');
    if (btn) btn.classList.toggle('active', _highlightMode);
    _build();
  }


  /* ─── Build dots ─────────────────────────────────────────────── */
  function _clear() {
    document.querySelectorAll('.' + DOT_CLASS).forEach(d => d.remove());
    _closePopup();
    _noteEls = [];
  }

  let _containerEl = null;
  let _styleBlockEl = null;

  function _build() {
    _clear();
    if (!_containerEl) _containerEl = document.getElementById('osmd-container');
    const container = _containerEl;
    if (!container) return;
    const svg = container.querySelector('svg');
    if (!svg) return;

    let notes = Array.from(svg.querySelectorAll('g.vf-stavenote'));
    if (!notes.length) {
      notes = Array.from(svg.querySelectorAll('g')).filter(g => g.querySelector('ellipse') && !g.querySelector('g > g > ellipse'));
    }
    if (!notes.length) return;

    _noteEls = notes;
    
    // Quản lý hiển thị Hợp âm gốc của OSMD
    if (!_styleBlockEl) {
        _styleBlockEl = document.getElementById('cc-custom-style');
        if (!_styleBlockEl) {
            _styleBlockEl = document.createElement('style');
            _styleBlockEl.id = 'cc-custom-style';
            document.head.appendChild(_styleBlockEl);
        }
    }
    let styleBlock = _styleBlockEl;

    if (_currentSet === 'default') {
        styleBlock.textContent = '';
    } else {
        // Ẩn nội dung text của ChordSymbol (dựa vào class vf-chordsymbol)
        // ĐỒNG THỜI ẩn tất cả các thẻ text trong SVG có màu trùng với màu hợp âm (để triệt tiêu hoàn toàn hợp âm rác)
        const chordColor = window.DisplaySettings?.getChordPrefs?.()?.color || '#dc2626';
        styleBlock.textContent = `
          #osmd-container svg g.vf-chordsymbol text,
          #osmd-container svg g.vf-chordsymbol tspan,
          #osmd-container svg text[fill="${chordColor}"],
          #osmd-container svg text[fill="${chordColor}"] tspan {
            fill: transparent !important;
            stroke: transparent !important;
            user-select: none;
          }
        `;
    }

    const rawChordMap = _currentSet === 'default'
      ? ChordCanvasXML.readXmlChords()
      : _applyTranspose(_customChords);

    const mapped = _mapNotes(notes, rawChordMap);

    // ── DEDUP 1: theo key (measureIdx_noteIdx) ─────────────────────────
    // S và A cùng beat sẽ có cùng key → loại bỏ Alto/Bass voice
    const seenKeys = new Set();
    // ── DEDUP 2: theo vị trí X (cùng nhịp + X gần nhau ±8px) ──────────
    // Safety net cho SATB fallback (khi OSMD map không có) và bất kỳ edge case
    const seenBeat = []; // [{mIdx, cx}]
    const dedupedMapped = mapped.filter(m => {
      const key = `${m.measureIdx}_${m.noteIdx}`;
      if (seenKeys.has(key)) return false;
      seenKeys.add(key);

      // Dedup theo X trong cùng mập — tránh 2 dot tại cùng beat khác khuông nhạc
      const cx = m.rect.left + m.rect.width / 2;
      const tooClose = seenBeat.some(p => p.mIdx === m.measureIdx && Math.abs(p.cx - cx) < 8);
      if (tooClose) return false;
      seenBeat.push({ mIdx: m.measureIdx, cx });

      return true;
    });

    // ── Xây dựng map: vị trí chord text SVG → để đặt badge PHÍA TRÊN chữ hợp âm
    // getBoundingClientRect() trả về viewport px → zoom-safe, luôn đúng sau mỗi re-render
    const chordTextPositions = _buildChordTextPositions(dedupedMapped, container);

    dedupedMapped.forEach(m => _placeDot(m, chordTextPositions));

    // Canh thẳng hàng ngang các hợp âm trên cùng một dòng (tránh nhảy múa lên xuống theo nốt)
    _alignDOMChords();
  }

  /* ─── Align DOM Chords — cố định theo đường kẻ trên cùng của khuông nhạc ──── */
  /**
   * Chiến lược:
   * 1. Quét SVG tìm TẤT CẢ horizontal staff lines (dòng kẻ ngang).
   * 2. Nhóm thành các "system" (khuông nhạc) theo dải Y.
   * 3. Mỗi system có topLine = đường kẻ trên cùng → Y cố định cho badge = topLine - GAP.
   * 4. GAP là px màn hình thực (không nhân scale) → không thay đổi khi zoom.
   */
  function _alignDOMChords() {
    const container = document.getElementById('osmd-container');
    if (!container) return;

    const cRect = container.getBoundingClientRect();
    const GAP_PX = 22; // px từ top staff line lên badge — KHÔNG đổi khi zoom

    // ── 1. Tìm top Y của mỗi khuông nhạc (stave) qua g.vf-stave ──────────────
    // g.vf-stave.getBoundingClientRect().top === đường kẻ TRÊN CÙNG của khuông đó
    // Đây là cách đáng tin hơn scan <line>/<path> từng phần tử.
    const svg = container.querySelector('svg');
    if (!svg) return;

    let staffLineRects = [];
    const staveGroups = Array.from(svg.querySelectorAll('g.vf-stave'));

    if (staveGroups.length) {
      staveGroups.forEach(g => {
        const r = g.getBoundingClientRect();
        if (r.width > 40 && r.height > 0 && r.top > 0) {
          staffLineRects.push(r.top - cRect.top);
        }
      });
    }

    // Fallback: scan <line> ngang trong SVG (OSMD không có vf-stave)
    if (!staffLineRects.length) {
      Array.from(svg.querySelectorAll('line')).forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.width > 60 && r.height < 3 && r.top > 0) {
          staffLineRects.push(r.top - cRect.top);
        }
      });
    }

    if (!staffLineRects.length) {
      _alignDOMChordsFallback(container);
      return;
    }

    // ── 2. Nhóm thành hệ (system) ─────────────────────────────────
    // SATB: treble+bass cùng system, gap ~80-100px. Giữa 2 system gap ~180px+
    // Dùng SYS_GAP = 150px: lớn hơn treble-bass gap, nhỏ hơn inter-system gap
    staffLineRects.sort((a, b) => a - b);
    // Loại bỏ duplicate (cùng Y ± 3px — có thể do border của g.vf-stave)
    const deduped = [staffLineRects[0]];
    for (let i = 1; i < staffLineRects.length; i++) {
      if (staffLineRects[i] - deduped[deduped.length - 1] > 3) {
        deduped.push(staffLineRects[i]);
      }
    }

    const systems = [];
    let sysStart = deduped[0];
    let prev = deduped[0];
    const SYS_GAP = 150; // px — đủ lớn để phân biệt inter-system, đủ nhỏ để gom SATB staves

    for (let i = 1; i < deduped.length; i++) {
      const curr = deduped[i];
      if (curr - prev > SYS_GAP) {
        systems.push({ topY: sysStart, bottomY: prev });
        sysStart = curr;
      }
      prev = curr;
    }
    systems.push({ topY: sysStart, bottomY: prev });

    // ── 3. Gom badge + dot-btn theo system, ép về Y cố định ──
    const allBadges = Array.from(
      container.querySelectorAll('.cc-edit-badge, .cc-chord-text, .cc-custom-chord-text, .cc-dot-btn')
    );
    if (!allBadges.length) return;

    systems.forEach(sys => {
      // Badge thuộc về system nào? Badge nằm trên topY (tối đa 120px phía trên)
      const targetY = sys.topY - GAP_PX;

      const inSystem = allBadges.filter(el => {
        const elTop = parseFloat(el.style.top);
        if (isNaN(elTop)) return false;
        // Badge nằm trong vùng từ (topY - 140) đến (bottomY + 40)
        return elTop >= sys.topY - 140 && elTop <= sys.bottomY + 40;
      });

      inSystem.forEach(el => {
        el.style.top = targetY + 'px';
        // Cập nhật transform để vẫn center theo chiều dọc
        const cur = el.style.transform || '';
        if (!cur.includes('translateY')) {
          // translate(-50%, -50%) → giữ nguyên, chỉ override top
        }
      });
    });
  }

  /** Fallback khi không có staff line data: chỉ align về minTop trong mỗi dải 60px */
  function _alignDOMChordsFallback(container) {
    const elements = Array.from(
      container.querySelectorAll('.cc-edit-badge, .cc-chord-text, .cc-custom-chord-text')
    );
    if (!elements.length) return;

    const rows = [];
    elements.forEach(el => {
      const top = parseFloat(el.style.top);
      if (isNaN(top)) return;
      let found = false;
      for (const row of rows) {
        if (Math.abs(row.avgTop - top) < 60) {
          row.els.push(el);
          row.minTop = Math.min(row.minTop, top);
          const sum = row.els.reduce((s, e) => s + parseFloat(e.style.top), 0);
          row.avgTop = sum / row.els.length;
          found = true; break;
        }
      }
      if (!found) rows.push({ avgTop: top, minTop: top, els: [el] });
    });
    rows.forEach(row => row.els.forEach(el => { el.style.top = row.minTop + 'px'; }));
  }


  /* ─── Build chord text position map ────────────────────────── */
  /**
   * Map từ `${measureIdx}_${noteIdx}` → { bx, by, bw, bh } trong container coords.
   * Dùng để đặt badge ✎ PHÍA TRÊN văn bản hợp âm thay vì đè lên nó.
   * @returns {Map<string, {bx:number, by:number, bw:number, bh:number}>}
   */
  function _buildChordTextPositions(mapped, container) {
    const result = new Map();
    const svg = container?.querySelector('svg');
    if (!svg) return result;

    const cRect = container.getBoundingClientRect();

    // Lấy tất cả chord text SVG, sort top→bottom, left→right (đúng thứ tự bài nhạc)
    const chordTextEls = Array.from(
      svg.querySelectorAll('g.vf-chordsymbol text')
    ).sort((a, b) => {
      const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
      if (Math.abs(ra.top - rb.top) > 15) return ra.top - rb.top;
      return ra.left - rb.left;
    });
    if (!chordTextEls.length) return result;

    // Mapped notes có hợp âm, cùng thứ tự OSMD render
    const chordNotes = mapped
      .filter(m => m.chord && m.measureIdx >= 0)
      .sort((a, b) => a.measureIdx - b.measureIdx || a.noteIdx - b.noteIdx);
    if (!chordNotes.length) return result;

    // X-proximity dedup cho vị trí text hợp âm (tránh mapping sai khi text quá sát nhau)
    const dedupedChordTextEls = [];
    chordTextEls.forEach(el => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const isDuplicate = dedupedChordTextEls.some(p => Math.abs(p.cx - cx) < 10 && Math.abs(p.cy - cy) < 10);
      if (!isDuplicate) dedupedChordTextEls.push({ el, cx, cy });
    });

    // Match 1-1
    const count = Math.min(dedupedChordTextEls.length, chordNotes.length);
    for (let i = 0; i < count; i++) {
      const rect = dedupedChordTextEls[i].el.getBoundingClientRect();
      const key  = `${chordNotes[i].measureIdx}_${chordNotes[i].noteIdx}`;
      result.set(key, {
        bx: rect.left - cRect.left,
        by: rect.top  - cRect.top,
        bw: rect.width,
        bh: rect.height,
      });
    }
    return result;
  }



  /* ─── Map notes ─────────────────────────────────────── */
  function _mapNotes(noteEls, chordMap) {
    const osmd = window.OSMDRenderer?.getInstance?.();
    const ml   = osmd?.graphic?.measureList;

    if (ml) {
      try {
        const byEl = new Map();
        for (let mi = 0; mi < ml.length; mi++) {
          const staves = ml[mi];
          if (!staves?.length) continue;
          const primaryStaff = staves[0];
          if (!primaryStaff?.staffEntries) continue;
          const src  = primaryStaff.ParentSourceMeasure ?? primaryStaff.parentSourceMeasure;
          const mIdx = src?.measureListIndex ?? mi;
          // Primary stave (treble) — se tao dot
          let nIdx = 0;
          for (const se of primaryStaff.staffEntries) {
            if (!se) { nIdx++; continue; }
            for (const ve of (se.graphicalVoiceEntries || [])) {
              for (const gn of (ve.notes || [])) {
                const svgG = gn.getSVGGElement?.();
                if (svgG) byEl.set(svgG, { mIdx, nIdx, primary: true });
              }
            }
            nIdx++;
          }
          // Secondary staves (bass clef 1+) — danh dau primary=false
          for (let si = 1; si < staves.length; si++) {
            const secStaff = staves[si];
            if (!secStaff?.staffEntries) continue;
            let sIdx = 0;
            for (const se of secStaff.staffEntries) {
              if (!se) { sIdx++; continue; }
              for (const ve of (se.graphicalVoiceEntries || [])) {
                for (const gn of (ve.notes || [])) {
                  const svgG = gn.getSVGGElement?.();
                  if (svgG) byEl.set(svgG, { mIdx, nIdx: sIdx, primary: false });
                }
              }
              sIdx++;
            }
          }
        }
        if (byEl.size > 0) {
          const result = [];
          for (const el of noteEls) {
            const m = byEl.get(el) || byEl.get(el.parentElement);
            if (!m || !m.primary) continue; // bo qua bass clef
            result.push({
              el, rect: el.getBoundingClientRect(),
              measureIdx: m.mIdx, noteIdx: m.nIdx,
              chord: chordMap[`${m.mIdx}_${m.nIdx}`] || ''
            });
          }
          if (result.some(r => r.measureIdx >= 0)) return result;
        }
      } catch(e) { console.warn('[ChordCanvas._mapNotes]', e); }
    }

    // Fallback: khong co OSMD structure
    const absMap = ChordCanvasXML.buildAbsMap();
    return noteEls.map((el, i) => ({
      el, rect: el.getBoundingClientRect(),
      measureIdx: absMap[i]?.mi ?? -1, noteIdx: absMap[i]?.ni ?? i,
      chord: absMap[i] ? (chordMap[`${absMap[i].mi}_${absMap[i].ni}`] || '') : ''
    }));
  }

  /* ─── Place dots ────────────────────────────────────────────── */
  function _placeDot({ el, rect, measureIdx, noteIdx, chord }, chordTextPositions = new Map()) {
    if (!rect || rect.width === 0 || rect.height === 0) return;
    const container = document.getElementById('osmd-container');
    const cRect = container.getBoundingClientRect();

    const scale   = ChordCanvasUI.getScale();
    const dotSize = ChordCanvasUI.getDotSize(scale);
    // Font size: scale tỉ lệ đẹp với zoom, min 13px, max 22px
    const fSize   = Math.min(22, Math.max(13, Math.round(14 * scale)));

    // Vị trí fallback dựa vào nốt nhạc (cách nốt một khoảng tỉ lệ thuận với scale)
    const cx = (rect.left - cRect.left) + rect.width / 2;
    const cy = (rect.top  - cRect.top)  - (25 * scale);

    if (chord) {
      if (!_editEnabled && _currentSet === 'default') return;

      // Tìm vị trí chord text SVG (nếu OSMD đã render)
      const textPos = chordTextPositions.get(`${measureIdx}_${noteIdx}`);

      if (_currentSet === 'default') {
        // Mặc định: OSMD đã vẽ hợp âm, ta chỉ chèn badge ✎ phía trên
        const badgeX = textPos ? textPos.bx + textPos.bw / 2 : cx;
        const badgeY = textPos ? textPos.by - 6 : cy - dotSize / 2;

        const badge = document.createElement('div');
        badge.className = DOT_CLASS + ' cc-edit-badge';
        badge.textContent = '\u270e';
        badge.title = 'Sửa hợp âm: ' + chord;
        ChordCanvasUI.applyAbsolute(badge, badgeX, badgeY, [
          'display:' + (_editEnabled ? 'flex' : 'none'),
          'align-items:center', 'justify-content:center',
          'width:' + dotSize + 'px', 'height:' + dotSize + 'px', 'border-radius:50%',
          'background:rgba(109,40,217,0.87)',
          'border:2.5px solid rgba(255,255,255,0.8)',
          'color:#fff', 'font-size:' + fSize + 'px', 'line-height:1',
          'box-shadow:0 2px 7px rgba(109,40,217,0.55)',
          'pointer-events:auto', 'cursor:pointer', 'user-select:none', 'z-index:12',
          'touch-action:manipulation', '-webkit-tap-highlight-color:transparent',
          'transform: translateX(-50%) translateY(-100%)',
          'transition: transform 0.15s ease, background 0.15s ease, box-shadow 0.15s ease'
        ]);
        badge.addEventListener('mouseenter', () => { badge.style.transform = 'translateX(-50%) translateY(-100%) scale(1.15)'; badge.style.background = 'rgba(109,40,217,1)'; badge.style.boxShadow = '0 4px 12px rgba(109,40,217,0.7)'; });
        badge.addEventListener('mouseleave', () => { badge.style.transform = 'translateX(-50%) translateY(-100%) scale(1)'; badge.style.background = 'rgba(109,40,217,0.87)'; badge.style.boxShadow = '0 2px 7px rgba(109,40,217,0.55)'; });
        badge.addEventListener('pointerdown', e => { e.stopPropagation(); _showPopup(badge, measureIdx, noteIdx, chord); });
        container.appendChild(badge);

        const span = document.createElement('span');
        span.className = DOT_CLASS + ' cc-chord-text';
        span.title = chord;
        const spanX = textPos ? textPos.bx + textPos.bw / 2 : cx;
        const spanY = textPos ? textPos.by + textPos.bh / 2 : cy;
        ChordCanvasUI.applyAbsolute(span, spanX, spanY, [
          'transform: translate(-50%, -50%)', 'opacity:0', 'width:60px', 'height:22px',
          'pointer-events:' + (_editEnabled ? 'auto' : 'none'),
          'cursor:pointer', 'display:block'
        ]);
        span.addEventListener('click', e => {
          if (!_editEnabled) return;
          e.stopPropagation(); _showPopup(span, measureIdx, noteIdx, chord);
        });
        container.appendChild(span);

      } else {
        // Custom: Dùng DOM Overlay vĩnh viễn (do OSMD đã bị ẩn fill: transparent)
        let spanX = textPos ? textPos.bx + textPos.bw / 2 : cx;
        // spanY: top edge của badge — _alignDOMChords sẽ ép về staffTopY - GAP
        let spanY = cy - (18 * scale); // rough initial Y, sẽ được align
        if (textPos) {
          spanY = textPos.by - 4; // ngay trên text SVG
        } else {
          let closestDist = Infinity;
          for (let pos of chordTextPositions.values()) {
            let dist = Math.abs(pos.by - cy);
            if (dist < 120 * scale && dist < closestDist) {
              closestDist = dist;
              spanY = pos.by - 4;
            }
          }
        }

        const textBadge = document.createElement('div');
        textBadge.className = DOT_CLASS + ' cc-custom-chord-text';
        textBadge.textContent = chord;
        textBadge.title = _editEnabled ? 'Sửa hợp âm: ' + chord : chord;

        const chordColor = window.DisplaySettings?.getChordPrefs?.()?.color || '#dc2626';
        // Parse màu để tạo nền nhạt tương ứng
        const _hex2rgb = h => { const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h); return r ? [parseInt(r[1],16),parseInt(r[2],16),parseInt(r[3],16)] : [220,38,38]; };
        const [cr,cg,cb] = _hex2rgb(chordColor);

        const baseStyle = [
          'position:absolute', `left:${spanX}px`, `top:${spanY}px`,
          'transform:translateX(-50%)',  // CHỈ center theo X, top là điểm neo
          'font-family: "Georgia", serif', 'font-weight: bold',
          'white-space: nowrap', 'z-index: 12',
          'letter-spacing: -0.01em', 'line-height: 1'
        ];
        baseStyle.push(`font-size: ${fSize}px`);

        if (_editEnabled) {
          // Chế độ chỉnh sửa: viền màu accent, nền trắng
          baseStyle.push(
            `color: rgb(${cr},${cg},${cb})`,
            'background: rgba(255,255,255,0.97)',
            `border: 1.5px solid rgba(${cr},${cg},${cb},0.7)`,
            'border-radius: 6px',
            'padding: 2px 7px',
            `box-shadow: 0 2px 8px rgba(${cr},${cg},${cb},0.22)`,
            'cursor: pointer', 'pointer-events: auto',
            'transition: transform 0.15s ease, box-shadow 0.15s ease'
          );
          textBadge.addEventListener('mouseenter', () => {
            textBadge.style.transform = 'translateX(-50%) scale(1.1)';
            textBadge.style.boxShadow = `0 4px 14px rgba(${cr},${cg},${cb},0.38)`;
          });
          textBadge.addEventListener('mouseleave', () => {
            textBadge.style.transform = 'translateX(-50%) scale(1)';
            textBadge.style.boxShadow = `0 2px 8px rgba(${cr},${cg},${cb},0.22)`;
          });
          // pointerdown = phản hồi ngay lập tức trên touch
          textBadge.addEventListener('pointerdown', e => { e.stopPropagation(); _showPopup(textBadge, measureIdx, noteIdx, chord); });
        } else if (_highlightMode) {
          // Chế độ nổi bật: badge tím đậm — như edit mode nhưng không cần chỉnh sửa
          baseStyle.push(
            'color: #fff',
            'background: rgba(109,40,217,0.9)',
            'border: 1.5px solid rgba(109,40,217,0.7)',
            'border-radius: 7px',
            'padding: 3px 8px',
            'box-shadow: 0 3px 10px rgba(109,40,217,0.4)',
            'cursor: pointer', 'pointer-events: auto',
            'transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease',
            'font-family: "Georgia", serif', 'letter-spacing: 0.01em'
          );
          textBadge.addEventListener('mouseenter', () => {
            textBadge.style.transform = 'translateX(-50%) scale(1.12)';
            textBadge.style.background = 'rgba(109,40,217,1)';
            textBadge.style.boxShadow = '0 6px 18px rgba(109,40,217,0.55)';
          });
          textBadge.addEventListener('mouseleave', () => {
            textBadge.style.transform = 'translateX(-50%) scale(1)';
            textBadge.style.background = 'rgba(109,40,217,0.9)';
            textBadge.style.boxShadow = '0 3px 10px rgba(109,40,217,0.4)';
          });
          textBadge.addEventListener('pointerdown', e => {
            e.stopPropagation();
            if (!window.Auth?.isBanhat?.()) {
              window.App?.showToast?.('⚠️ Cần đăng nhập với quyền Ban Hát để sửa hợp âm', 'error');
              return;
            }
            setAddMode(true);
            _showPopup(textBadge, measureIdx, noteIdx, chord);
          });
        } else {
          // Chế độ xem thường: pill nền nhạt + viền mờ — dễ đọc như tập bài hát in
          baseStyle.push(
            `color: rgb(${cr},${cg},${cb})`,
            `background: rgba(${cr},${cg},${cb},0.06)`,
            `border: 1px solid rgba(${cr},${cg},${cb},0.22)`,
            'border-radius: 5px',
            'padding: 1px 6px',
            'box-shadow: none',
            'cursor: pointer', 'pointer-events: auto',
            'transition: background 0.15s ease, transform 0.12s ease'
          );
          textBadge.addEventListener('mouseenter', () => {
            textBadge.style.background = `rgba(${cr},${cg},${cb},0.13)`;
            textBadge.style.transform = 'translateX(-50%) scale(1.05)';
          });
          textBadge.addEventListener('mouseleave', () => {
            textBadge.style.background = `rgba(${cr},${cg},${cb},0.06)`;
            textBadge.style.transform = 'translateX(-50%) scale(1)';
          });
          textBadge.addEventListener('pointerdown', e => {
            e.stopPropagation();
            if (!window.Auth?.isBanhat?.()) {
              window.App?.showToast?.('⚠️ Cần đăng nhập với quyền Ban Hát để sửa hợp âm', 'error');
              return;
            }
            setAddMode(true);
            _showPopup(textBadge, measureIdx, noteIdx, chord);
          });
        }


        textBadge.style.cssText = baseStyle.join(';');
        container.appendChild(textBadge);
      }
    } else {
      // Nút '+' thêm hợp âm — visual nhỏ theo zoom, touch area mở rộng qua CSS
      const btn = document.createElement('div');
      btn.className = DOT_CLASS + ' ' + BTN_CLASS;
      btn.textContent = '+';
      // Visual = dotSize (scale với zoom), không ép tối thiểu 36px nữa
      // Touch area mở rộng qua CSS class cc-dot-btn::after (xem sheet.css)
      // cy đồng hướng với chord badge — sẽ được _alignDOMChords ớ về cùng dòng
      ChordCanvasUI.applyAbsolute(btn, cx, cy, [
        'display:' + (_editEnabled ? 'flex' : 'none'),
        'align-items:center', 'justify-content:center',
        `width:${dotSize}px`, `height:${dotSize}px`,
        'border-radius:50%',
        'background:rgba(109,40,217,0.82)',
        'color:#fff', `font-size:${Math.round(dotSize * 0.65)}px`,
        'line-height:1', 'font-weight:700',
        'box-shadow:0 1px 4px rgba(109,40,217,0.35)',
        'pointer-events:auto', 'cursor:pointer', 'user-select:none',
        'touch-action:manipulation',
        '-webkit-tap-highlight-color:transparent',
        'transition:transform 0.15s ease, background 0.15s ease',
        'position:absolute'  // đảm bảo ::after works
      ]);
      btn.addEventListener('mouseenter', () => { btn.style.transform = 'translateX(-50%) scale(1.2)'; btn.style.background = 'rgba(109,40,217,1)'; });
      btn.addEventListener('mouseleave', () => { btn.style.transform = 'translateX(-50%) scale(1)';   btn.style.background = 'rgba(109,40,217,0.82)'; });
      let _pointerHandled = false;
      btn.addEventListener('pointerdown', e => {
        e.stopPropagation();
        _pointerHandled = true;
        _showPopup(btn, measureIdx, noteIdx, '');
      });
      btn.addEventListener('click', e => {
        e.stopPropagation();
        if (_pointerHandled) { _pointerHandled = false; return; }
        _showPopup(btn, measureIdx, noteIdx, '');
      });
      container.appendChild(btn);
    }
  }

  /* ─── Popup ─────────────────────────────────────────────────── */
  function _showPopup(anchor, measureIdx, noteIdx, existing) {
    // Guard 1: cần quyền banhat
    if (!window.Auth?.isBanhat?.()) {
      window.App?.showToast?.('⚠️ Cần đăng nhập với quyền Ban Hát để sửa hợp âm', 'error');
      return;
    }
    // Guard 2: TLH (default) là bản gốc — không cho sửa, chỉ đọc
    if (_currentSet === 'default') {
      window.App?.showToast?.('🔒 Bộ TLH là bản gốc, không thể sửa. Vui lòng chọn bộ HD hoặc tạo bộ mới.', 'info');
      return;
    }
    _closePopup();
    _popup = ChordCanvasUI.createPopup(anchor, measureIdx, noteIdx, existing, _currentSet, {
      onSave: async (val) => {
        // onClose đã được gọi bởi doSave() trong UI trước khi onSave
        // Nên KHÔNG gọi _closePopup() ở đây nữa (sẽ null _popup đúng lúc)
        await _saveChord(measureIdx, noteIdx, val);
      },
      onDelete: async () => {
        await _deleteChord(measureIdx, noteIdx);
      },
      onClose: () => _closePopup()
    });
  }

  function openNextPopup(curMeasureIdx, curNoteIdx) {
    if (!_noteEls.length) return;
    const mapped = _mapNotes(_noteEls, {});
    let foundIdx = -1;
    for (let i = 0; i < mapped.length; i++) {
       if (mapped[i].measureIdx === curMeasureIdx && mapped[i].noteIdx === curNoteIdx) {
          foundIdx = i;
          break;
       }
    }
    if (foundIdx !== -1 && foundIdx + 1 < mapped.length) {
       const next = mapped[foundIdx + 1];
       const container = document.getElementById('osmd-container');
       if (!container) return;
       // Tìm hàm show bằng document querySelector
       const dotBtn = container.querySelector(`.chord-dot-btn[style*="left:${(next.rect.left - container.getBoundingClientRect().left) + next.rect.width/2}px"]`);
       setTimeout(() => {
          if (dotBtn) dotBtn.click();
          else _showPopup(next.el, next.measureIdx, next.noteIdx, '');
       }, 50);
    }
  }

  function _closePopup() { _popup?.remove(); _popup = null; }

  /* ─── Save / Delete / Undo / Redo ─────────────────────────── */
  function _pushUndo() {
    _undoStack.push({ set: _currentSet, chords: {..._customChords} });
    if (_undoStack.length > 20) _undoStack.shift();
    _redoStack = []; // clear redo on new action
  }

  async function undo() {
    if (!_undoStack.length) { window.App?.showToast?.('Không có hành động để hoàn tác', 'info'); return; }
    _redoStack.push({ set: _currentSet, chords: {..._customChords} });
    const prev = _undoStack.pop();
    _currentSet   = prev.set;
    _customChords = prev.chords;
    if (_currentSet !== 'default') {
      await _saveCustomSet();
    }
    setTimeout(() => requestAnimationFrame(_build), 80);
    window.App?.showToast?.('↩ Đã hoàn tác', 'info');
  }

  async function redo() {
    if (!_redoStack.length) { window.App?.showToast?.('Không có hành động để làm lại', 'info'); return; }
    _undoStack.push({ set: _currentSet, chords: {..._customChords} });
    const next = _redoStack.pop();
    _currentSet   = next.set;
    _customChords = next.chords;
    if (_currentSet !== 'default') {
      await _saveCustomSet();
    }
    setTimeout(() => requestAnimationFrame(_build), 80);
    window.App?.showToast?.('↪ Đã làm lại', 'info');
  }

  async function _saveChord(measureIdx, noteIdx, chordInput, refreshLayout = true) {
    _pushUndo();
    const semitones = window.App?.getCurrentTranspose?.() ?? 0;
    let chordOriginalKey;
    if (semitones !== 0) {
      // Khi lưu về original key: dùng flat preference của KEY GỐC
      // (không dùng flat preference của input — vì input có thể không có giáng)
      // VD: bài Bb, transpose +2 → C, user gõ "C" → lưu phải là "Bb" (không phải "A#")
      const useFlatsOriginal = _getKeyUseFlats();
      chordOriginalKey = TransposeEngine.transposeChord(chordInput, -semitones, useFlatsOriginal);
    } else {
      chordOriginalKey = chordInput;
    }

    // Đảm bảo màu hợp âm luôn đúng (tránh màu đen sau khi reload)
    window.OSMDRenderer?.refreshRules?.();

    if (_currentSet === 'default') {
      // Default set: cần inject vào XML gốc → full reload OSMD (có scroll-lock)
      await ChordCanvasXML.injectXml(measureIdx, noteIdx, chordOriginalKey, refreshLayout);
    } else {
      // Custom set (HD, ...): chỉ cần update bộ nhớ + lưu server + rebuild dots
      // KHÔNG cần full OSMD reload → scroll không bị nhảy
      _customChords[`${measureIdx}_${noteIdx}`] = chordOriginalKey;
      await _saveCustomSet();
      // Rebuild dots tại chỗ (không reload OSMD SVG)
      if (refreshLayout) {
        setTimeout(() => requestAnimationFrame(_build), 80);
      }
    }
  }

  async function _deleteChord(measureIdx, noteIdx) {
    _pushUndo();
    if (_currentSet === 'default') {
      await ChordCanvasXML.removeXml(measureIdx, noteIdx);
    } else {
      const deleted = _customChords[`${measureIdx}_${noteIdx}`] || '';
      delete _customChords[`${measureIdx}_${noteIdx}`];
      await _saveCustomSet();
      setTimeout(() => requestAnimationFrame(_build), 80);
      // Toast hint undo sau khi xóa
      if (deleted) {
        window.App?.showToast?.(`Đã xóa "${deleted}" — Ctrl+Z để hoàn tác`, 'info');
      }
    }
  }


  async function _saveCustomSet() {
    const songId = window.App?.getCurrentSongId?.();
    if (!songId || _currentSet === 'default') return;
    const arr = Object.entries(_customChords).map(([k, chord]) => {
      const [measureIdx, noteIdx] = k.split('_').map(Number);
      return { measureIdx, noteIdx, chord };
    });

    try {
      const r = await window.ApiService.chordSets.save(songId, _currentSet, arr);
      if (r.success) window.App?.showToast?.(`Đã lưu hợp âm cho "${_currentSet}"`, 'success');
      else window.App?.showToast?.('Lỗi lưu: ' + (r.message || ''), 'error');
    } catch(e) { window.App?.showToast?.('Lỗi: ' + e.message, 'error'); }
  }

  /* ─── Switch / Create chord sets ────────────────────────────── */
  async function switchSet(name) {
    _closePopup();
    _currentSet   = name;
    _customChords = {};
    if (name !== 'default') {
      const songId = window.App?.getCurrentSongId?.();
      if (songId) {
        try {
          const r = await window.ApiService.chordSets.load(songId, name);
          if (r.success && r.chords) {
            r.chords.forEach(({ measureIdx, noteIdx, chord }) => { _customChords[`${measureIdx}_${noteIdx}`] = chord; });
          }
        } catch(e) {}
      }
    }
    // Với custom set (HD, ...): chỉ cần rebuild dots, KHÔNG cần reload toàn bộ OSMD
    // Chỉ reload OSMD khi đổi sang/từ 'default' (cần render lại harmony trong SVG)
    if (name === 'default' || _prevSet === 'default') {
      if (window.App?.reloadCurrentXML) {
        AppUI?.setLoadingText?.('Đang nạp hồ sơ...');
        await window.App.reloadCurrentXML();
      } else {
        _build();
      }
    } else {
      // Custom ⇒ custom: chỉ rebuild dots (nhanh, không mất scroll)
      setTimeout(() => requestAnimationFrame(_build), 80);
    }
    _prevSet = name;
    _updateSetUI();
    window.URLState?.update?.({ set: name });
  }

  async function createSet(name) {
    if (!name?.trim()) return;
    const songId = window.App?.getCurrentSongId?.();
    if (!songId) return;

    try {
      const r = await window.ApiService.chordSets.save(songId, name, []);
      if (!r.success) { window.App?.showToast?.('Tạo thất bại', 'error'); return; }
    } catch(e) { return; }

    await switchSet(name);
    setAddMode(true);
    await _refreshSetDropdown();
    window.App?.showToast?.(`Đã tạo bộ "${name}" - bắt đầu nhập!`, 'success');
  }

  function showNewSetModal() {
    ChordCanvasUI.showNewSetModal({ onCreate: (name) => createSet(name) });
  }

  async function deleteSet(name) {
    // RULE: TLH (default) và HD đều bị lock — không cho xóa
    if (!name || name === 'default' || name === 'HD') {
      window.App?.showToast?.('Bộ này được bảo vệ, không thể xóa!', 'error');
      return;
    }
    const songId = window.App?.getCurrentSongId?.();
    if (!songId) return;
    try {
      await window.ApiService.chordSets.delete(songId, name);
    } catch(e) {}
    if (_currentSet === name) await switchSet('HD'); // fallback về HD thay vì default
    _refreshSetDropdown();
  }

  /* ─── Set dropdown UI ───────────────────────────────────────── */
  async function _refreshSetDropdown() {
    const selector  = document.getElementById('chord-set-selector');
    const deleteBtn = document.getElementById('btn-delete-chord-set');
    const countBadge = document.getElementById('chord-set-count');
    if (!selector) return;

    const songId = window.App?.getCurrentSongId?.();
    if (!songId) {
      selector.innerHTML = '<option value="default">TLH (gốc)</option>';
      selector.disabled = true; return;
    }

    selector.disabled = false;
    let sets = ['default'];
    try {
      const r = await window.ApiService.chordSets.list(songId);
      if (r.success) {
        // Đảm bảo HD luôn trong danh sách (dù rỗng)
        const hdInList = r.sets.some(s => s === 'HD');
        sets = ['default', ...(hdInList ? r.sets : ['HD', ...r.sets])];
      }
    } catch(e) {}

    // Hiện số hợp âm trong set hiện tại
    const chordCount = Object.keys(_customChords).length;
    const countText  = _currentSet !== 'default'
      ? (chordCount > 0 ? `● ${chordCount} hợp âm` : '○ Chưa có')
      : '';
    if (countBadge) {
      countBadge.textContent = countText;
      countBadge.style.color = chordCount > 0 ? 'var(--success,#16a34a)' : 'var(--text-muted,#9ca3af)';
    }

    const canCreate = window.Auth?.isBanhat?.() ?? false;

    selector.innerHTML = sets.map(s =>
      `<option value="${s}" ${s === _currentSet ? 'selected' : ''}>${
        s === 'default' ? 'TLH (gốc)' : s
      }</option>`
    ).join('') + (canCreate ? `<option value="__create_new_set__" style="color: var(--accent,#6d28d9); font-weight: bold;">➕ Tạo Bộ Hợp Âm Mới...</option>` : '');

    if (!selector.dataset.boundCreateHandler) {
      selector.dataset.boundCreateHandler = 'true';
      selector.addEventListener('change', (e) => {
        const val = e.target.value;
        if (val === '__create_new_set__') {
          selector.value = _currentSet;
          showNewSetModal();
        }
      });
    }

    const isAdmin    = window.Auth?.isAdmin?.()   ?? false;
    const isLoggedIn = window.Auth?.isLoggedIn?.() ?? false;
    // RULE: TLH và HD đều lock — nút xóa chỉ hiện khi set khác default + HD
    const isDeletable = _currentSet !== 'default' && _currentSet !== 'HD' && isAdmin;
    if (deleteBtn) deleteBtn.style.display = isDeletable ? 'inline-flex' : 'none';
    const newBtn = document.getElementById('btn-new-chord-set');
    if (newBtn) newBtn.classList.toggle('hidden', !isLoggedIn);
  }


  /** Cập nhật nhanh UI selector + nút xóa/tạo mà không cần gọi API. */
  function _updateSetUI() {
    _refreshSetDropdown(); // refreshSetDropdown đã cover toàn bộ UI sync
  }

  /* ─── Accidental Preference Detection ──────────────────────────────────
   * NGUỒN CHÂN LÝ: <fifths> trong MusicXML (khóa biểu)
   *
   * Quy tắc nhạc lý:
   *   fifths < 0  → flat key  (F, Bb, Eb, Ab, Db, Gb, Cb)
   *   fifths = 0  → C major / A minor → sharp (trung lập, dùng # theo quy ước)
   *   fifths > 0  → sharp key (G, D, A, E, B, F#, C#)
   *
   * Bảng đầy đủ:
   *  -6=Gb  -5=Db  -4=Ab  -3=Eb  -2=Bb  -1=F  0=C
   *  +1=G   +2=D   +3=A   +4=E   +5=B   +6=F#
   * ─────────────────────────────────────────────────────────────────────── */

  /**
   * Đọc <fifths> từ XML — nguồn duy nhất, đáng tin cậy nhất.
   * Fallback: quét harmony chords nếu XML không có key signature.
   */
  function _getKeyFifths() {
    try {
      const xml = window.OSMDRenderer?.getCurrentXml?.() || window.App?.getOriginalXml?.();
      if (!xml) return null; // null = XML chưa sẵn, KHÔNG cache
      const doc    = new DOMParser().parseFromString(xml, 'text/xml');
      const fifths = parseInt(doc.querySelector('key > fifths')?.textContent ?? 'NaN');

      // Đếm flat/sharp trong harmony để cross-check
      let flat = 0, sharp = 0;
      doc.querySelectorAll('harmony').forEach(h => {
        const ra = parseFloat(h.querySelector('root > root-alter')?.textContent || '0');
        const ba = parseFloat(h.querySelector('bass > bass-alter')?.textContent || '0');
        if (ra < 0) flat++; else if (ra > 0) sharp++;
        if (ba < 0) flat++; else if (ba > 0) sharp++;
      });

      if (!isNaN(fifths)) {
        // Nếu fifths = 0 (C major) NHƯNG chord-scan rõ ràng là flat → OMR sai
        // VD: bài Bb nhưng OMR xuất fifths=0, trong khi có Bb,Eb,Ab chords
        if (fifths === 0 && flat > 0 && flat > sharp) return -1; // chord-scan thắng
        return fifths; // tin vào key sig
      }

      // Không có key sig trong XML → dùng chord scan
      return flat > sharp ? -1 : (sharp > flat ? 1 : 0);
    } catch { return null; }
  }

  /** fifths < 0 → flat, ngược lại → sharp */
  function _fifthsToUseFlats(f) { return f < 0; }

  /**
   * Tính fifths của KEY SAU KHI transpose n semitones.
   *
   * Dùng bảng Semitone → Fifths Offset (Circle of Fifths):
   *   Lên 1 st  → -5 fifths  (C→Db, G→Ab, A→Bb)
   *   Lên 2 st  → +2 fifths  (C→D)
   *   Lên 3 st  → -3 fifths  (C→Eb)
   *   Lên 5 st  → -1 fifths  (C→F)
   *   Lên 7 st  → +1 fifths  (C→G)
   *   Lên 10 st → -2 fifths  (C→Bb)
   *
   * Quy tắc: OFFSET[n] + OFFSET[12-n] = 0 (tính đối xứng).
   * Dùng normalize mod 12 để xử lý semitones âm.
   */
  const _SEMITONE_FIFTHS_OFFSET = [0, -5, 2, -3, 4, -1, 6, 1, -4, 3, -2, 5];

  function _calcTransposedFifths(origFifths, semitones) {
    const norm  = ((semitones % 12) + 12) % 12;
    let   newF  = origFifths + _SEMITONE_FIFTHS_OFFSET[norm];
    // Normalize về khoảng -6..6
    while (newF >  6) newF -= 12;
    while (newF < -6) newF += 12;
    return newF;
  }

  /**
   * Lấy flat/sharp preference của KEY GỐC.
   * VD: Eb trưởng (fifths=-3) → useFlats=true → Bb, Ab, Eb (không phải A#, G#, D#)
   */
  function _getKeyUseFlats() {
    if (_songUseFlats !== null) return _songUseFlats;
    const fifths = _getKeyFifths();
    if (fifths === null) return false; // XML chưa sẵn: trả về false nhưng KHÔNG cache
    _songUseFlats = _fifthsToUseFlats(fifths); // cache chỉ khi biết chắc
    return _songUseFlats;
  }

  /**
   * Lấy flat/sharp preference của KEY SAU KHI transpose.
   * VD: A trưởng (fifths=+3) + lên 1 st → Bb trưởng (fifths=-2) → useFlats=true
   *     Eb trưởng (fifths=-3) + lên 3 st → F# trưởng (fifths=+6) → useFlats=false
   */
  function _getTransposedKeyUseFlats(semitones) {
    const orig = _getKeyFifths() ?? 0; // nếu chưa có XML, giả sử C major
    return _fifthsToUseFlats(_calcTransposedFifths(orig, semitones));
  }

  function _applyTranspose(chordMap) {
    const semitones = window.App?.getCurrentTranspose?.() ?? 0;
    if (semitones === 0) return chordMap;
    const useFlats = _getTransposedKeyUseFlats(semitones);
    const out = {};
    for (const [k, chord] of Object.entries(chordMap)) {
      out[k] = TransposeEngine.transposeChord(chord, semitones, useFlats);
    }
    return out;
  }

  /* ─── Exports ────────────────────────────────────────────────── */
  function resetSet() {
    _currentSet = 'HD';   // Reset về HD (không phải default) khi chuyển bài
    _customChords = {};
    _updateSetUI();
  }

  return {
    init, onOSMDRendered, reposition, loadSong, clearSong,
    setAddMode, toggleAddMode, switchSet, createSet, deleteSet,
    showNewSetModal, resetSet,
    confirmDeleteSet: async () => {
      const sel  = document.getElementById('chord-set-selector');
      const name = sel?.value;
      // RULE: TLH (default) và HD đều bị lock
      if (!name || name === 'default' || name === 'HD') {
        window.App?.showToast?.('Bộ TLH và HD được bảo vệ, không thể xóa!', 'error');
        return;
      }
      ChordCanvasUI.showDeleteConfirmModal(name, {
        onConfirm: async () => await deleteSet(name)
      });
    },
    refreshSetDropdown: _refreshSetDropdown,
    openNextPopup,
    isPopupOpen: () => !!_popup,
    saveChordWithoutReload: (m, n, c) => _saveChord(m, n, c, false),
    clearAllChords: async () => {
      if (_currentSet === 'default') {
        window.App?.showToast?.('Không thể xoá toàn bộ ở cấu hình Mặc định!', 'error');
        return;
      }
      _customChords = {};
      await _saveCustomSet();
      if (window.App?.reloadCurrentXML) await window.App.reloadCurrentXML();
      window.App?.showToast?.('Đã xoá toàn bộ hợp âm!', 'success');
    },
    getCurrentSet: () => _currentSet,
    getCustomChords: () => _customChords,
    toggleHighlight,
    setHighlightMode,
    isHighlightMode: () => _highlightMode,
    undo,
    redo
  };
})();

window.ChordCanvas = ChordCanvas;

