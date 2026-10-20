/**
 * chord-canvas.js — Multi-Set Chord Manager (Core)
 * Hỗ trợ "Mặc định" (XML gốc qua ChordCanvasXML) và Custom sets (HD, ...).
 */
const ChordCanvas = (() => {
  'use strict';

  let _editEnabled   = false;
  let _highlightMode = false;
  let _popup         = null;
  let _currentSet    = 'default';
  let _prevSet       = 'default';
  let _customChords  = {};
  let _noteEls       = [];
  let _ro            = null;
  let _undoStack     = [];
  let _redoStack     = [];
  let _songUseFlats  = null;
  let _isInitialized = false;
  let _containerEl   = null;
  let _styleBlockEl  = null;

  const DOT_CLASS     = 'cc-dot';
  const HIGHLIGHT_KEY = 'sheetapp_chord_highlight';
  const _SEMITONE_FIFTHS_OFFSET = [0, -5, 2, -3, 4, -1, 6, 1, -4, 3, -2, 5];

  function init() {
    if (_isInitialized) return;
    _isInitialized = true;

    try { _highlightMode = localStorage.getItem(HIGHLIGHT_KEY) === 'true'; } catch(e) {}

    document.getElementById('btn-add-chord-mode')?.addEventListener('click', toggleAddMode);
    document.getElementById('btn-add-chord-mode-bar')?.addEventListener('click', toggleAddMode);

    const doneBtn = document.getElementById('btn-cancel-add-chord');
    if (doneBtn) {
      doneBtn.addEventListener('click', async () => {
        if (_currentSet !== 'default' && Object.keys(_customChords).length > 0) {
          await _saveCustomSet();
        }
        setAddMode(false);
      });
    }

    document.getElementById('btn-chord-highlight')?.addEventListener('click', toggleHighlight);
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') { _closePopup(); setAddMode(false); }
    });

    const container = document.getElementById('osmd-container');
    if (container) {
      let rTid = null;
      _ro = new ResizeObserver(() => {
        clearTimeout(rTid);
        rTid = setTimeout(() => { if (!_popup) _build(); }, 150);
      });
      _ro.observe(container);
    }

    if (window.visualViewport) {
      let vpTid = null;
      const onVpChange = () => {
        clearTimeout(vpTid);
        vpTid = setTimeout(() => { if (!_popup) _build(); }, 250);
      };
      window.visualViewport.addEventListener('resize', onVpChange);
      window.visualViewport.addEventListener('scroll', onVpChange);
    }
  }

  function onOSMDRendered() {
    _alignOSMDChords();
    setTimeout(() => requestAnimationFrame(_build), 350);
  }

  function reposition() {
    _alignOSMDChords();
    setTimeout(() => requestAnimationFrame(_build), 200);
  }

  function _alignOSMDChords() {
    const container = document.getElementById('osmd-container');
    const svg = container?.querySelector('svg');
    if (!svg) return;

    const chords = Array.from(svg.querySelectorAll('text[font-family*="OSMDChordFont"]'));
    if (!chords.length) return;

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
          sys.chords.forEach(txt => { sum += parseFloat(txt.getAttribute('y')); });
          sys.avgY = sum / sys.chords.length;
          found = true;
          break;
        }
      }
      if (!found) systems.push({ avgY: y, minY: y, chords: [c] });
    });

    systems.forEach(sys => {
      sys.chords.forEach(c => c.setAttribute('y', sys.minY));
    });
  }

  async function loadSong(songId, initialSet = 'HD') {
    _clear();
    setAddMode(false);
    _currentSet   = initialSet || 'HD';
    _customChords = {};
    _songUseFlats = null;

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

  function setAddMode(on) {
    _editEnabled = !!on;
    document.getElementById('btn-add-chord-mode')?.classList.toggle('active', on);
    document.getElementById('btn-add-chord-mode-bar')?.classList.toggle('active', on);
    document.getElementById('chord-edit-hint')?.classList.toggle('hidden', !on);
    document.getElementById('btn-clear-all-chords')?.classList.toggle('hidden', !on);
    document.getElementById('btn-cancel-add-chord')?.classList.toggle('hidden', !on);
    document.getElementById('add-chord-hint')?.classList.toggle('hidden', !on);

    if (!on) _closePopup();
    _build();
  }

  function toggleAddMode() {
    if (!_editEnabled && !window.Auth?.isBanhat?.()) {
      window.App?.showToast?.('⚠️ Cần đăng nhập với quyền Ban Hát để thêm hợp âm', 'error');
      return;
    }
    setAddMode(!_editEnabled);
  }

  function toggleHighlight() {
    _highlightMode = !_highlightMode;
    try { localStorage.setItem(HIGHLIGHT_KEY, String(_highlightMode)); } catch(e) {}
    const btn = document.getElementById('btn-chord-highlight');
    if (btn) {
      btn.classList.toggle('active', _highlightMode);
      btn.title = _highlightMode ? 'Tắt nổi bật hợp âm' : 'Bật nổi bật hợp âm';
    }
    _build();
  }

  function setHighlightMode(on) {
    _highlightMode = !!on;
    try { localStorage.setItem(HIGHLIGHT_KEY, String(_highlightMode)); } catch(e) {}
    const btn = document.getElementById('btn-chord-highlight');
    if (btn) btn.classList.toggle('active', _highlightMode);
    _build();
  }

  function _clear() {
    document.querySelectorAll('.' + DOT_CLASS).forEach(d => d.remove());
    _closePopup();
    _noteEls = [];
  }

  function _build() {
    _clear();
    if (!_containerEl) _containerEl = document.getElementById('osmd-container');
    const container = _containerEl;
    const svg = container?.querySelector('svg');
    if (!svg) return;

    let notes = Array.from(svg.querySelectorAll('g.vf-stavenote'));
    if (!notes.length) {
      notes = Array.from(svg.querySelectorAll('g')).filter(g => g.querySelector('ellipse') && !g.querySelector('g > g > ellipse'));
    }
    if (!notes.length) return;
    _noteEls = notes;

    if (!_styleBlockEl) {
      _styleBlockEl = document.getElementById('cc-custom-style');
      if (!_styleBlockEl) {
        _styleBlockEl = document.createElement('style');
        _styleBlockEl.id = 'cc-custom-style';
        document.head.appendChild(_styleBlockEl);
      }
    }

    // Core Rule 1: HD chưa có hợp âm (và không đang soạn) thì hiện TLH gốc thay vì để trống
    const showTlh = _currentSet === 'default'
      || (_currentSet === 'HD' && !Object.keys(_customChords || {}).length && !_editEnabled);

    if (showTlh) {
      _styleBlockEl.textContent = '';
    } else {
      const chordColor = window.DisplaySettings?.getChordPrefs?.()?.color || '#dc2626';
      _styleBlockEl.textContent = `
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

    const rawChordMap = showTlh
      ? ChordCanvasXML.readXmlChords()
      : _applyTranspose(_customChords);

    const mapped = window.ChordCanvasDots.mapNotes(notes, rawChordMap);
    const seenKeys = new Set();
    const seenBeat = [];
    const dedupedMapped = mapped.filter(m => {
      const key = `${m.measureIdx}_${m.noteIdx}`;
      if (seenKeys.has(key)) return false;
      seenKeys.add(key);

      const cx = m.rect.left + m.rect.width / 2;
      if (seenBeat.some(p => p.mIdx === m.measureIdx && Math.abs(p.cx - cx) < 8)) return false;
      seenBeat.push({ mIdx: m.measureIdx, cx });
      return true;
    });

    const chordTextPositions = window.ChordCanvasDots.buildChordTextPositions(dedupedMapped, container);
    dedupedMapped.forEach(m => window.ChordCanvasDots.placeDot(m, chordTextPositions, {
      editEnabled: _editEnabled,
      currentSet: showTlh ? 'default' : _currentSet,
      highlightMode: _highlightMode,
      onShowPopup: _showPopup,
      onSetAddMode: setAddMode
    }));

    window.ChordCanvasDots.alignDOMChords();
  }

  function _showPopup(anchor, measureIdx, noteIdx, existing) {
    if (!window.Auth?.isBanhat?.()) {
      window.App?.showToast?.('⚠️ Cần đăng nhập với quyền Ban Hát để sửa hợp âm', 'error');
      return;
    }
    if (_currentSet === 'default') {
      window.App?.showToast?.('🔒 Bộ TLH là bản gốc, không thể sửa. Vui lòng chọn bộ HD hoặc tạo bộ mới.', 'info');
      return;
    }
    _closePopup();
    _popup = ChordCanvasUI.createPopup(anchor, measureIdx, noteIdx, existing, _currentSet, {
      onSave: async (val) => { await _saveChord(measureIdx, noteIdx, val); },
      onDelete: async () => { await _deleteChord(measureIdx, noteIdx); },
      onClose: () => _closePopup()
    });
  }

  function openNextPopup(curMeasureIdx, curNoteIdx) {
    if (!_noteEls.length) return;
    const mapped = window.ChordCanvasDots.mapNotes(_noteEls, {});
    const foundIdx = mapped.findIndex(m => m.measureIdx === curMeasureIdx && m.noteIdx === curNoteIdx);
    if (foundIdx !== -1 && foundIdx + 1 < mapped.length) {
      const next = mapped[foundIdx + 1];
      const container = document.getElementById('osmd-container');
      if (!container) return;
      const dotBtn = container.querySelector(`.chord-dot-btn[style*="left:${(next.rect.left - container.getBoundingClientRect().left) + next.rect.width / 2}px"]`);
      setTimeout(() => {
        if (dotBtn) dotBtn.click();
        else _showPopup(next.el, next.measureIdx, next.noteIdx, '');
      }, 50);
    }
  }

  function _closePopup() { _popup?.remove(); _popup = null; }

  function _pushUndo() {
    _undoStack.push({ set: _currentSet, chords: { ..._customChords } });
    if (_undoStack.length > 20) _undoStack.shift();
    _redoStack = [];
  }

  async function undo() {
    if (!_undoStack.length) { window.App?.showToast?.('Không có hành động để hoàn tác', 'info'); return; }
    _redoStack.push({ set: _currentSet, chords: { ..._customChords } });
    const prev = _undoStack.pop();
    _currentSet   = prev.set;
    _customChords = prev.chords;
    if (_currentSet !== 'default') await _saveCustomSet();
    setTimeout(() => requestAnimationFrame(_build), 80);
    window.App?.showToast?.('↩ Đã hoàn tác', 'info');
  }

  async function redo() {
    if (!_redoStack.length) { window.App?.showToast?.('Không có hành động để làm lại', 'info'); return; }
    _undoStack.push({ set: _currentSet, chords: { ..._customChords } });
    const next = _redoStack.pop();
    _currentSet   = next.set;
    _customChords = next.chords;
    if (_currentSet !== 'default') await _saveCustomSet();
    setTimeout(() => requestAnimationFrame(_build), 80);
    window.App?.showToast?.('↪ Đã làm lại', 'info');
  }

  async function _saveChord(measureIdx, noteIdx, chordInput, refreshLayout = true) {
    _pushUndo();
    const semitones = window.App?.getCurrentTranspose?.() ?? 0;
    const chordOriginalKey = semitones !== 0
      ? TransposeEngine.transposeChord(chordInput, -semitones, _getKeyUseFlats())
      : chordInput;

    window.OSMDRenderer?.refreshRules?.();

    if (_currentSet === 'default') {
      await ChordCanvasXML.injectXml(measureIdx, noteIdx, chordOriginalKey, refreshLayout);
    } else {
      _customChords[`${measureIdx}_${noteIdx}`] = chordOriginalKey;
      await _saveCustomSet();
      if (refreshLayout) setTimeout(() => requestAnimationFrame(_build), 80);
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
      if (deleted) window.App?.showToast?.(`Đã xóa "${deleted}" — Ctrl+Z để hoàn tác`, 'info');
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
    if (name === 'default' || _prevSet === 'default') {
      if (window.App?.reloadCurrentXML) {
        AppUI?.setLoadingText?.('Đang nạp hồ sơ...');
        await window.App.reloadCurrentXML();
      } else {
        _build();
      }
    } else {
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
    await _refreshSetDropdown(true);
    window.App?.showToast?.(`Đã tạo bộ "${name}" - bắt đầu nhập!`, 'success');
  }

  function showNewSetModal() {
    ChordCanvasUI.showNewSetModal({ onCreate: (name) => createSet(name) });
  }

  async function deleteSet(name) {
    if (!name || name === 'default' || name === 'HD') {
      window.App?.showToast?.('Bộ này được bảo vệ, không thể xóa!', 'error');
      return;
    }
    const songId = window.App?.getCurrentSongId?.();
    if (!songId) return;
    try { await window.ApiService.chordSets.delete(songId, name); } catch(e) {}
    if (_currentSet === name) await switchSet('HD');
    _refreshSetDropdown(true);
  }

  async function _refreshSetDropdown(forceRefresh = false, fetchNames = false) {
    const selector   = document.getElementById('chord-set-selector');
    const deleteBtn  = document.getElementById('btn-delete-chord-set');
    const countBadge = document.getElementById('chord-set-count');
    if (!selector) return;

    const songId = window.App?.getCurrentSongId?.();
    if (!songId) {
      selector.innerHTML = '<option value="default">TLH (gốc)</option>';
      selector.disabled = true;
      return;
    }

    selector.disabled = false;
    if (!selector._hasLazyListener) {
      selector._hasLazyListener = true;
      for (const event of ['focus', 'pointerdown', 'mousedown']) {
        selector.addEventListener(event, () => _refreshSetDropdown(false, true));
      }
    }
    let sets = ['default', 'HD'];
    if (fetchNames || forceRefresh) {
      if (forceRefresh) window.ApiService.chordSets.clearCache(songId);
      try {
        const r = await window.ApiService.chordSets.list(songId);
        if (songId !== window.App?.getCurrentSongId?.()) return;
        if (r?.success && Array.isArray(r.sets)) {
          sets = ['default', 'HD', ...r.sets.filter(s => s !== 'HD' && s !== 'default')];
        }
      } catch(e) {}
    }
    if (songId !== window.App?.getCurrentSongId?.()) return;
    if (_currentSet && !sets.includes(_currentSet)) sets.push(_currentSet);

    const chordCount = Object.keys(_customChords).length;
    if (countBadge) {
      countBadge.textContent = _currentSet !== 'default' ? (chordCount > 0 ? `● ${chordCount} hợp âm` : '○ Chưa có') : '';
      countBadge.style.color = chordCount > 0 ? 'var(--success,#16a34a)' : 'var(--text-muted,#9ca3af)';
    }

    selector.innerHTML = sets.map(s =>
      `<option value="${window.SafeHtml.escape(s)}" ${s === _currentSet ? 'selected' : ''}>${window.SafeHtml.escape(s === _currentSet ? window.ChordSetNames.describe() : (s === 'default' ? 'TLH (gốc)' : s))}</option>`
    ).join('');

    const isAdmin    = window.Auth?.isAdmin?.() ?? false;
    const isLoggedIn = window.Auth?.isLoggedIn?.() ?? false;
    const isDeletable = _currentSet !== 'default' && _currentSet !== 'HD' && isAdmin;
    if (deleteBtn) deleteBtn.style.display = isDeletable ? 'inline-flex' : 'none';
    document.getElementById('btn-new-chord-set')?.classList.toggle('hidden', !isLoggedIn);
  }

  function _updateSetUI() { _refreshSetDropdown(); }

  function _getKeyFifths() {
    try {
      const xml = window.OSMDRenderer?.getCurrentXml?.() || window.App?.getOriginalXml?.();
      if (!xml) return null;
      const doc    = new DOMParser().parseFromString(xml, 'text/xml');
      const fifths = parseInt(doc.querySelector('key > fifths')?.textContent ?? 'NaN');
      let flat = 0, sharp = 0;
      doc.querySelectorAll('harmony').forEach(h => {
        const ra = parseFloat(h.querySelector('root > root-alter')?.textContent || '0');
        const ba = parseFloat(h.querySelector('bass > bass-alter')?.textContent || '0');
        if (ra < 0) flat++; else if (ra > 0) sharp++;
        if (ba < 0) flat++; else if (ba > 0) sharp++;
      });
      if (!isNaN(fifths)) {
        if (fifths === 0 && flat > 0 && flat > sharp) return -1;
        return fifths;
      }
      return flat > sharp ? -1 : (sharp > flat ? 1 : 0);
    } catch { return null; }
  }

  function _fifthsToUseFlats(f) { return f < 0; }

  function _calcTransposedFifths(origFifths, semitones) {
    const norm = ((semitones % 12) + 12) % 12;
    let newF   = origFifths + _SEMITONE_FIFTHS_OFFSET[norm];
    while (newF >  6) newF -= 12;
    while (newF < -6) newF += 12;
    return newF;
  }

  function _getKeyUseFlats() {
    if (_songUseFlats !== null) return _songUseFlats;
    const fifths = _getKeyFifths();
    if (fifths === null) return false;
    _songUseFlats = _fifthsToUseFlats(fifths);
    return _songUseFlats;
  }

  function _getTransposedKeyUseFlats(semitones) {
    const orig = _getKeyFifths() ?? 0;
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

  function resetSet() {
    _currentSet = 'HD';
    _customChords = {};
    _updateSetUI();
  }

  return {
    init, onOSMDRendered, reposition, build: _build, loadSong, clearSong,
    setAddMode, toggleAddMode, switchSet, createSet, deleteSet,
    showNewSetModal, resetSet,
    confirmDeleteSet: async () => {
      const name = document.getElementById('chord-set-selector')?.value;
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
