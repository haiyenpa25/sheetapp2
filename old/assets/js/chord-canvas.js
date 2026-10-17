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

    const mapped = ChordCanvasDots.mapNotes(notes, rawChordMap);

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
    const chordTextPositions = ChordCanvasDots.buildChordTextPositions(dedupedMapped, container);

    dedupedMapped.forEach(m => ChordCanvasDots.placeDot(m, chordTextPositions, {
      editEnabled: _editEnabled,
      currentSet: _currentSet,
      highlightMode: _highlightMode,
      onShowPopup: _showPopup,
      onSetAddMode: setAddMode
    }));

    // Canh thẳng hàng ngang các hợp âm trên cùng một dòng (tránh nhảy múa lên xuống theo nốt)
    ChordCanvasDots.alignDOMChords();
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
    const mapped = ChordCanvasDots.mapNotes(_noteEls, {});
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

    selector.innerHTML = sets.map(s =>
      `<option value="${s}" ${s === _currentSet ? 'selected' : ''}>${
        s === 'default' ? 'TLH (gốc)' : s
      }</option>`
    ).join('');

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

