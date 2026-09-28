/**
 * chord-canvas.js — Multi-Set Chord Manager (Core)
 *
 * Hỗ trợ:
 *  - "Mặc định": đọc/ghi hợp âm trực tiếp vào XML gốc (thông qua ChordCanvasXML)
 *  - Custom sets: lưu trong api/chord_sets.php (JSON)
 *  - Modularized: Delegates to ChordCanvasUI, ChordCanvasXML, ChordCanvasDots, ChordCanvasEdit, ChordCanvasTranspose.
 */
const ChordCanvas = (() => {
  'use strict';

  /* ─── State ───────────────────────────────────────────────────────────────── */
  let _editEnabled    = false;
  let _highlightMode  = false;
  let _currentSet     = 'HD';
  let _prevSet        = 'HD';
  let _customChords   = {};
  let _noteEls        = [];
  let _ro             = null;
  let _songUseFlats   = null;
  let _chordLoadToken = 0; // Race condition guard

  const DOT_CLASS     = 'cc-dot';
  const BTN_CLASS     = 'cc-dot-btn';
  const HIGHLIGHT_KEY = 'sheetapp_chord_highlight';

  let _isInitialized  = false;
  let _containerEl    = null;
  let _styleBlockEl   = null;

  /* ─── Init ──────────────────────────────────────────────────── */
  function init() {
    if (_isInitialized) return;
    _isInitialized = true;

    // Connect Edit Submodule
    window.ChordCanvasEdit?.init({
      getCurrentSet: () => _currentSet,
      setCurrentSet: (s) => { _currentSet = s; },
      getCustomChords: () => _customChords,
      setCustomChords: (c) => { _customChords = c; },
      getNoteEls: () => _noteEls,
      switchSet,
      build: _build,
      getContainer: () => _containerEl
    });

    try { _highlightMode = localStorage.getItem(HIGHLIGHT_KEY) === 'true'; } catch(e) {}

    // Ticket L0-16: Ủy quyền nút sửa hợp âm sang ModeManager để tránh kích hoạt trùng lặp
    document.getElementById('btn-add-chord-mode')?.addEventListener('click', () => {
      if (window.ModeManager?.toggleEditChords) window.ModeManager.toggleEditChords();
      else toggleAddMode();
    });

    const doneBtn = document.getElementById('btn-cancel-add-chord');
    if (doneBtn) {
      doneBtn.addEventListener('click', async () => {
        if (_currentSet !== 'default' && Object.keys(_customChords).length > 0) {
          await window.ChordCanvasEdit?.saveCustomSet?.();
        }
        setAddMode(false);
      });
    }

    document.getElementById('btn-chord-highlight')?.addEventListener('click', toggleHighlight);

    const container = document.getElementById('osmd-container');
    if (container) {
      let rTid = null;
      _ro = new ResizeObserver(() => {
        clearTimeout(rTid);
        rTid = setTimeout(() => { _build(); }, 150);
      });
      _ro.observe(container);
    }

    if (window.visualViewport) {
      let vpTid = null;
      const onVpChange = () => {
        clearTimeout(vpTid);
        vpTid = setTimeout(() => { _build(); }, 250);
      };
      window.visualViewport.addEventListener('resize', onVpChange);
    }
  }

  function onOSMDRendered() { 
    _alignOSMDChords();
    requestAnimationFrame(_build); 
  }

  function reposition() { 
    _alignOSMDChords();
    requestAnimationFrame(_build); 
  }

  function _alignOSMDChords() {
    const container = document.getElementById('osmd-container');
    if (!container) return;
    const svg = container.querySelector('svg');
    if (!svg) return;

    const chords = Array.from(svg.querySelectorAll('text[font-family*="OSMDChordFont"], .osmd-chord-text'));
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

    systems.forEach(sys => {
      sys.chords.sort((a, b) => (parseFloat(a.getAttribute('x') || 0)) - (parseFloat(b.getAttribute('x') || 0)));
      let prevRight = -Infinity;
      sys.chords.forEach(c => {
        c.setAttribute('y', sys.minY);
        const curX = parseFloat(c.getAttribute('x') || 0);
        let curW = 20;
        try { curW = c.getBBox ? c.getBBox().width : (c.textContent.trim().length * 10); } catch(e){}
        if (curX < prevRight + 6) {
          const newX = prevRight + 6;
          c.setAttribute('x', newX);
          prevRight = newX + curW;
        } else {
          prevRight = curX + curW;
        }
      });
    });
  }

  async function loadSong(songId, initialSet = 'HD') {
    const token = ++_chordLoadToken;
    _clear();
    _songUseFlats = null;
    window.ChordCanvasTranspose?.resetCache?.();
    _currentSet   = initialSet;
    _prevSet      = initialSet;
    _customChords = {};

    if (initialSet !== 'default') {
      try {
        const r = await window.ApiService.chordSets.load(songId, initialSet);
        if (token !== _chordLoadToken) return;
        if (r && r.success && r.chords) {
          r.chords.forEach(({ measureIdx, noteIdx, chord }) => { _customChords[`${measureIdx}_${noteIdx}`] = chord; });
        } else {
          _loadOfflineChords(songId, initialSet);
        }
      } catch(e) {
        if (token !== _chordLoadToken) return;
        _loadOfflineChords(songId, initialSet);
      }
    }

    _refreshSetDropdown();
    window.SongInfoBar?.refreshChordChip?.();
  }

  function _loadOfflineChords(songId, set) {
    if (window.OfflineSetlistManager?.hasOfflineChords?.(songId, set)) {
      const chords = window.OfflineSetlistManager.getOfflineChords(songId, set) || [];
      chords.forEach(({ measureIdx, noteIdx, chord }) => { _customChords[`${measureIdx}_${noteIdx}`] = chord; });
    }
  }

  function clearSong() { _clear(); setAddMode(false); }

  function setAddMode(on) {
    _editEnabled = on;
    const btn = document.getElementById('btn-add-chord-mode');
    const barBtn = document.getElementById('btn-add-chord-mode-bar');
    const bar = document.getElementById('add-chord-bar');

    btn?.classList.toggle('active', on);
    barBtn?.classList.toggle('active', on);
    bar?.classList.toggle('hidden', !on);

    if (on) {
      if (_currentSet === 'default') {
        const myChordCode = (window.Auth?.getChordCode?.() || '').toUpperCase();
        const targetSet = myChordCode || 'HD';
        const currentSongId = window.App?.getCurrentSongId?.();
        _cloneAndStartEditing(currentSongId, 'default', targetSet);
        return;
      }

      const myChordCode = (window.Auth?.getChordCode?.() || '').toUpperCase();
      const isAdmin = window.Auth?.isAdmin?.() ?? false;
      const curSetUpper = (_currentSet || '').toUpperCase();

      if (myChordCode && curSetUpper !== myChordCode && !isAdmin) {
        const currentSongId = window.App?.getCurrentSongId?.();
        _cloneAndStartEditing(currentSongId, _currentSet, myChordCode);
        return;
      }
    }

    if (!on) window.ChordCanvasEdit?.closePopup?.();
    _build();
  }

  function toggleAddMode() {
    if (!window.Auth?.isBanhat?.()) {
      window.App?.showToast?.('⚠️ Vui lòng đăng nhập tài khoản Nhạc công để chỉnh sửa hợp âm', 'info');
      window.Auth?.openModal?.();
      return;
    }
    setAddMode(!_editEnabled);
  }

  async function _cloneAndStartEditing(songId, sourceSet, targetSet) {
    if (!songId) { _build(); return; }
    AppUI?.setLoadingText?.(`Đang tạo bộ hợp âm cá nhân "${targetSet}"...`);

    try {
      const sourceChords = sourceSet === 'default'
        ? ChordCanvasXML.readXmlChords()
        : { ..._customChords };

      const arr = Object.entries(sourceChords).map(([k, chord]) => {
        const [measureIdx, noteIdx] = k.split('_').map(Number);
        return { measureIdx, noteIdx, chord };
      });

      await window.ApiService.chordSets.save(songId, targetSet, arr);
      _chordSetsCache.delete(songId);
      window.App?.showToast?.(`✨ Đã tự động tạo bộ cá nhân "${targetSet}" từ bản gốc!`, 'success', 3500);
      await switchSet(targetSet);
    } catch(e) {
      window.App?.showToast?.('Lỗi tạo bộ cá nhân: ' + e.message, 'error');
    } finally {
      AppUI?.hideLoading?.();
      _build();
    }
  }

  function toggleHighlight() {
    setHighlightMode(!_highlightMode);
  }

  function setHighlightMode(on) {
    _highlightMode = on;
    try { localStorage.setItem(HIGHLIGHT_KEY, on ? 'true' : 'false'); } catch(e) {}
    const btn = document.getElementById('btn-chord-highlight');
    if (btn) {
      btn.classList.toggle('active', on);
      btn.title = on ? 'Đang bật nổi bật hợp âm (click để tắt)' : 'Bật nổi bật hợp âm';
    }
    _build();
  }

  function _clear() {
    window.ChordCanvasEdit?.closePopup?.();
    document.querySelectorAll('.cc-dot, .cc-note-dot, .cc-custom-chord-text, .cc-edit-badge, .cc-chord-text, .cc-chord-highlight')
      .forEach(el => el.remove());
  }

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
    window.OSMDRenderer?.tagChordSymbols?.();
    
    if (!_styleBlockEl) {
      _styleBlockEl = document.getElementById('cc-custom-style');
      if (!_styleBlockEl) {
        _styleBlockEl = document.createElement('style');
        _styleBlockEl.id = 'cc-custom-style';
        document.head.appendChild(_styleBlockEl);
      }
    }
    let styleBlock = _styleBlockEl;

    const customCount = Object.keys(_customChords || {}).length;
    const xmlChordMap = (typeof ChordCanvasXML !== 'undefined' && ChordCanvasXML.readXmlChords) ? ChordCanvasXML.readXmlChords() : {};
    const xmlCount = Object.keys(xmlChordMap).length;
    const isFallbackToTlh = (_currentSet !== 'default' && customCount === 0 && xmlCount > 0);

    if (_currentSet === 'default' || isFallbackToTlh) {
      styleBlock.textContent = '';
    } else {
      styleBlock.textContent = `body #osmd-container svg .osmd-chord-symbol, body.dark-mode #osmd-container svg .osmd-chord-symbol, body #osmd-container svg [data-chord-symbol="true"], body.dark-mode #osmd-container svg [data-chord-symbol="true"], body #osmd-container svg .osmd-chord-text, body.dark-mode #osmd-container svg .osmd-chord-text, body #osmd-container svg [data-chord-text="true"], body.dark-mode #osmd-container svg [data-chord-text="true"], #osmd-container svg g.vf-chordsymbol text, #osmd-container svg g.vf-chordsymbol tspan { fill: transparent !important; stroke: transparent !important; user-select: none; }`;
    }

    const rawChordMap = (_currentSet === 'default' || isFallbackToTlh)
      ? xmlChordMap
      : (window.ChordCanvasTranspose?.applyTranspose?.(_customChords) || _customChords);

    const mapped = window.ChordCanvasDots ? window.ChordCanvasDots.mapNotes(notes, rawChordMap) : [];

    const seenKeys = new Set();
    const seenBeat = [];
    const dedupedMapped = mapped.filter(m => {
      const key = `${m.measureIdx}_${m.noteIdx}`;
      if (seenKeys.has(key)) return false;
      seenKeys.add(key);

      const cx = m.rect.left + m.rect.width / 2;
      const tooClose = seenBeat.some(p => p.mIdx === m.measureIdx && Math.abs(p.cx - cx) < 8);
      if (tooClose) return false;
      seenBeat.push({ mIdx: m.measureIdx, cx });

      return true;
    });

    const chordTextPositions = window.ChordCanvasDots
      ? window.ChordCanvasDots.buildChordTextPositions(dedupedMapped, container)
      : new Map();

    dedupedMapped.forEach(m => {
      window.ChordCanvasDots?.placeDot(m, chordTextPositions, {
        editEnabled: _editEnabled,
        highlightEnabled: _highlightMode,
        currentSet: (_currentSet === 'default' || isFallbackToTlh) ? 'default' : _currentSet,
        onShowPopup: (anchor, mi, ni, chord) => window.ChordCanvasEdit?.showPopup(anchor, mi, ni, chord)
      });
    });

    window.ChordCanvasDots?.alignDOMChords?.();
  }

  /* ─── Switch / Create chord sets ────────────────────────────── */
  function handleSelectChange(val) {
    const sel = document.getElementById('chord-set-selector');
    if (val === '__create_new_set__') {
      if (sel) sel.value = _currentSet;
      showNewSetModal();
      return;
    }
    const base = (typeof window !== 'undefined' && typeof window.__APP_BASE__ === 'string')
      ? window.__APP_BASE__.replace(/\/+$/, '')
      : '';
    if (val === '__open_members__') {
      if (sel) sel.value = _currentSet;
      window.open((base ? base : '') + '/manager/#tab-users', '_blank');
      return;
    }
    if (val === '__open_manager__') {
      if (sel) sel.value = _currentSet;
      window.open((base ? base : '') + '/manager/', '_blank');
      return;
    }
    switchSet(val);
  }

  async function switchSet(name) {
    window.ChordCanvasEdit?.closePopup?.();
    if (!name || name === '__create_new_set__' || name === '__open_members__' || name === '__open_manager__' || name.startsWith('__')) {
      const sel = document.getElementById('chord-set-selector');
      if (sel) sel.value = _currentSet;
      return;
    }
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
    window.SongLoader?.syncSidebarNavLinks?.(window.App?.getCurrentSongId?.(), name);
    window.DisplaySettings?.renderLyricViewIfActive?.();
  }

  async function createSet(name) {
    if (!name?.trim()) return;
    const songId = window.App?.getCurrentSongId?.();
    if (!songId) return;

    try {
      const r = await window.ApiService.chordSets.save(songId, name, []);
      if (!r.success) { window.App?.showToast?.('Tạo thất bại', 'error'); return; }
      _chordSetsCache.delete(songId);
    } catch(e) { return; }

    await switchSet(name);
    setAddMode(true);
    await _refreshSetDropdown(true);
    window.App?.showToast?.(`Đã tạo bộ "${name}" - bắt đầu nhập!`, 'success');
  }

  function showNewSetModal() {
    if (!window.Auth?.isBanhat?.()) {
      window.App?.showToast?.('⚠️ Vui lòng đăng nhập tài khoản Nhạc công để tạo bản phối', 'info');
      window.Auth?.openModal?.();
      return;
    }
    const myChordCode = (window.Auth?.getChordCode?.() || '').toUpperCase();
    if (myChordCode) { createSet(myChordCode); return; }
    ChordCanvasUI.showNewSetModal({ onCreate: (name) => createSet(name) });
  }

  async function deleteSet(name) {
    if (!name || name === 'default' || name === 'TLH' || name === 'HD') {
      window.App?.showToast?.('Bộ này được bảo vệ chuẩn, không thể xóa!', 'error');
      return;
    }
    const myChordCode = (window.Auth?.getChordCode?.() || '').toUpperCase();
    const isAdmin = window.Auth?.isAdmin?.() ?? false;
    if (!isAdmin && name.toUpperCase() !== myChordCode) {
      window.App?.showToast?.(`Bạn chỉ được quyền xóa bộ hợp âm cá nhân của mình (${myChordCode})!`, 'error');
      return;
    }
    const songId = window.App?.getCurrentSongId?.();
    if (!songId) return;
    try {
      await window.ApiService.chordSets.delete(songId, name);
      _chordSetsCache.delete(songId);
    } catch(e) {}
    if (_currentSet === name) await switchSet('HD');
    _refreshSetDropdown(true);
  }

  async function confirmDeleteSet(name) {
    const target = name || _currentSet;
    if (!target || target === 'default' || target === 'TLH' || target === 'HD') {
      window.App?.showToast?.('Bộ này được bảo vệ chuẩn, không thể xóa!', 'error');
      return;
    }
    if (window.confirm(`Bạn có chắc muốn xóa bộ hợp âm "${target}"?`)) await deleteSet(target);
  }

  /* ─── Set dropdown UI ───────────────────────────────────────── */
  const _chordSetsCache = new Map();

  async function _refreshSetDropdown(forceRefresh = false) {
    const selector  = document.getElementById('chord-set-selector');
    const deleteBtn = document.getElementById('btn-delete-chord-set');
    const countBadge = document.getElementById('chord-set-count');
    if (!selector) return;

    const songId = window.App?.getCurrentSongId?.();
    if (!songId) {
      selector.innerHTML = '<option value="HD" selected>⭐ HD (Hoài Dinh)</option><option value="default">TLH (Gốc) 🔒</option>';
      selector.disabled = true; return;
    }

    selector.disabled = false;
    let sets = ['HD', 'default'];
    try {
      const now = Date.now();
      const cached = _chordSetsCache.get(songId);
      if (!forceRefresh && cached && (now - cached.timestamp < 15000)) {
        sets = cached.sets;
      } else {
        const r = await window.ApiService.chordSets.list(songId);
        if (r.success) {
          const otherSets = r.sets.filter(s => s !== 'HD' && s !== 'default');
          sets = ['HD', 'default', ...otherSets];
          _chordSetsCache.set(songId, { timestamp: now, sets });
        }
      }
    } catch(e) {}

    const chordCount = Object.keys(_customChords).length;
    const tlhCount   = Object.keys(window.ChordCanvasXML?.readXmlChords?.() || {}).length;
    const isFallback = (_currentSet === 'HD' && chordCount === 0);
    const countText  = isFallback
      ? '○ HD chưa có · đang hiện TLH'
      : (_currentSet !== 'default'
          ? (chordCount > 0 ? `● ${chordCount} hợp âm` : '○ Chưa có')
          : (tlhCount > 0 ? `● ${tlhCount} hợp âm` : ''));
    if (countBadge) {
      countBadge.textContent = countText;
      countBadge.style.color = isFallback
        ? 'var(--warning,#d97706)'
        : ((chordCount > 0 || (_currentSet === 'default' && tlhCount > 0)) ? 'var(--success,#16a34a)' : 'var(--text-muted,#9ca3af)');
    }

    const myChordCode = (window.Auth?.getChordCode?.() || '').toUpperCase();
    const isAdmin     = window.Auth?.isAdmin?.()   ?? false;
    const isLoggedIn  = window.Auth?.isLoggedIn?.() ?? false;
    const canCreate   = window.Auth?.isBanhat?.() ?? false;

    const KNOWN_CODES = { 'HD': 'Hoài Dinh (HD)', 'NAM': 'Hoàng Nam (NAM)', 'LAN': 'Hà Lan (LAN)', 'BH': 'Ban Hát (BH)', 'ADMIN': 'Admin (ADMIN)' };

    selector.innerHTML = sets.map(s => {
      const sUpper = s.toUpperCase();
      let label = s;
      if (s === 'default' || sUpper === 'TLH') label = 'TLH (Gốc) 🔒 [Bản chuẩn]';
      else if (isLoggedIn && myChordCode && sUpper === myChordCode) label = `⭐ Bộ của tôi (${s}) [Được sửa]`;
      else if (KNOWN_CODES[sUpper]) label = `${KNOWN_CODES[sUpper]} 👁️ [Chỉ xem]`;
      else if (sUpper === 'HD') label = '⭐ HD (Hoài Dinh) 👁️ [Chỉ xem]';
      else if (s.includes('__')) {
        const parts = s.split('__');
        label = `🎸 ${parts.slice(1).join('__').replace(/_/g, ' ')} (@${parts[0]}) [Chỉ xem]`;
      } else label = `🎸 Bộ ${s} [Chỉ xem]`;
      const safeVal = window.SafeHtml ? window.SafeHtml.escape(s) : s;
      const safeLabel = window.SafeHtml ? window.SafeHtml.escape(label) : label;
      return `<option value="${safeVal}" ${s === _currentSet ? 'selected' : ''}>${safeLabel}</option>`;
    }).join('') 
    + (canCreate ? `<option value="__create_new_set__" style="color: var(--accent,#6d28d9); font-weight: bold;">➕ Tạo Bộ Hợp Âm Mới (${window.SafeHtml ? window.SafeHtml.escape(myChordCode || 'Cá nhân') : (myChordCode || 'Cá nhân')})...</option>` : '')
    + (canCreate ? `<option value="__open_members__" style="color: var(--emerald,#10b981); font-weight: bold;">👥 Quản Lý Nhạc Công & Hợp Âm (/manager/#tab-users)...</option>` : '')
    + (canCreate ? `<option value="__open_manager__" style="color: var(--cyan,#06b6d4);">📂 Mở Quản Lý Kho Nhạc (/manager/)...</option>` : '');

    selector.value = _currentSet;

    if (!selector.dataset.boundCreateHandler) {
      selector.dataset.boundCreateHandler = 'true';
      selector.addEventListener('change', (e) => handleSelectChange(e.target.value));
    }

    const isDeletable = _currentSet !== 'default' && _currentSet !== 'HD' && (isAdmin || (myChordCode && _currentSet.toUpperCase() === myChordCode));
    if (deleteBtn) deleteBtn.style.display = isDeletable ? 'inline-flex' : 'none';
    const newBtn = document.getElementById('btn-new-chord-set');
    if (newBtn) newBtn.classList.toggle('hidden', !isLoggedIn);
  }

  function _updateSetUI() { _refreshSetDropdown(); window.SongInfoBar?.refreshChordChip?.(); }
  function resetSet() { _currentSet = 'HD'; _prevSet = 'HD'; _customChords = {}; }

  /* ─── Exports ────────────────────────────────────────────────── */
  return {
    init, loadSong, clearSong, setAddMode, toggleAddMode, toggleHighlight, setHighlightMode,
    onOSMDRendered, reposition, handleSelectChange, switchSet, createSet, showNewSetModal,
    deleteSet, confirmDeleteSet, resetSet,
    refreshSetDropdown: (force) => _refreshSetDropdown(force),
    undo: () => window.ChordCanvasEdit?.undo?.(),
    redo: () => window.ChordCanvasEdit?.redo?.(),
    getCurrentSet: () => _currentSet,
    getCustomChords: () => _customChords,
    setCustomChords: (c) => { _customChords = c; },
    applyPreloaded: (set, chords) => {
      _clear(); _songUseFlats = null; window.ChordCanvasTranspose?.resetCache?.();
      _currentSet = set || 'HD'; _prevSet = _currentSet; _customChords = chords ? { ...chords } : {};
      _refreshSetDropdown(); window.SongInfoBar?.refreshChordChip?.();
    },
    getXmlChordCount: () => Object.keys(window.ChordCanvasXML?.readXmlChords?.() || {}).length,
    getChordStatus: () => {
      const customCount = Object.keys(_customChords || {}).length;
      const xmlCount = Object.keys(window.ChordCanvasXML?.readXmlChords?.() || {}).length;
      return {
        currentSet: _currentSet, customCount, xmlCount,
        isFallback: (_currentSet !== 'default' && customCount === 0 && xmlCount > 0),
        isSparse: (_currentSet !== 'default' && customCount > 0 && xmlCount > 0 && customCount < 0.3 * xmlCount)
      };
    },
    getNoteEls: () => _noteEls,
    build: _build
  };
})();

window.ChordCanvas = ChordCanvas;
