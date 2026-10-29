/**
 * chord-canvas.js — Multi-Set Chord Manager (Core)
 * Delegates to ChordCanvasUI, ChordCanvasXML, ChordCanvasDots, ChordCanvasEdit, ChordCanvasTranspose.
 */
const ChordCanvas = (() => {
  'use strict';
  /* ─── State ───────────────────────────────────────────────────────────────── */
  let _editEnabled = false, _highlightMode = false, _currentSet = 'HD', _prevSet = 'HD';
  let _customChords = {}, _noteEls = [], _ro = null, _songUseFlats = null;
  let _chordLoadToken = 0;
  let _pendingConfirm = false, _showTlhHints = false, _isInitialized = false, _containerEl = null, _styleBlockEl = null;

  const DOT_CLASS = 'cc-dot', BTN_CLASS = 'cc-dot-btn', HIGHLIGHT_KEY = 'sheetapp_chord_highlight';

  /* ─── Init ──────────────────────────────────────────────────── */
  function init() {
    if (_isInitialized) return;
    _isInitialized = true;

    // Connect Edit Submodule
    window.ChordCanvasEdit?.init({
      getCurrentSet: () => _currentSet, setCurrentSet: (s) => { _currentSet = s; },
      getCustomChords: () => _customChords, setCustomChords: (c) => { _customChords = c; },
      getNoteEls: () => _noteEls, switchSet, build: _build, updateSetUI: _updateSetUI,
      getContainer: () => _containerEl
    });

    try { _highlightMode = localStorage.getItem(HIGHLIGHT_KEY) === 'true'; } catch(e) {}
    const hlBtn = document.getElementById('btn-menu-chord-highlight') || document.getElementById('btn-chord-highlight'); if (hlBtn) { hlBtn.classList.toggle('active', _highlightMode); hlBtn.addEventListener('click', toggleHighlight); }

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
      if (!c.getAttribute('data-orig-y')) c.setAttribute('data-orig-y', c.getAttribute('y') || '0');
      if (!c.getAttribute('data-orig-x')) c.setAttribute('data-orig-x', c.getAttribute('x') || '0');
      const y = parseFloat(c.getAttribute('data-orig-y'));
      let found = false;
      for (const sys of systems) {
        if (Math.abs(sys.avgY - y) < 80) {
          sys.chords.push(c);
          sys.minY = Math.min(sys.minY, y);
          let sum = 0;
          sys.chords.forEach(txt => sum += parseFloat(txt.getAttribute('data-orig-y')));
          sys.avgY = sum / sys.chords.length;
          found = true;
          break;
        }
      }
      if (!found) systems.push({ avgY: y, minY: y, chords: [c] });
    });

    const staveNotes = Array.from(svg.querySelectorAll('g.vf-stavenote'));
    systems.forEach(sys => {
      let minNoteTop = Infinity;
      staveNotes.forEach(sn => {
        try {
          const bb = sn.getBBox ? sn.getBBox() : null;
          if (bb && Math.abs(bb.y - sys.avgY) < 90 && bb.y < minNoteTop) minNoteTop = bb.y;
        } catch(e) {}
      });
      if (minNoteTop < Infinity && sys.minY + 4 >= minNoteTop - 6) {
        sys.minY = Math.min(sys.minY, minNoteTop - 12);
      }
      sys.chords.sort((a, b) => (parseFloat(a.getAttribute('data-orig-x') || 0)) - (parseFloat(b.getAttribute('data-orig-x') || 0)));
      let prevRight = -Infinity;
      sys.chords.forEach(c => {
        let chordY = sys.minY;
        const curX = parseFloat(c.getAttribute('data-orig-x') || 0);
        let curW = 20;
        try { curW = c.getBBox ? c.getBBox().width : (c.textContent.trim().length * 10); } catch(e){}
        staveNotes.forEach(sn => {
          try {
            const bb = sn.getBBox ? sn.getBBox() : null;
            if (bb && Math.abs(bb.y - sys.avgY) < 90 && !(bb.x + bb.width < curX || bb.x > curX + curW) && chordY + 3 >= bb.y - 4) {
              chordY = Math.min(chordY, bb.y - 12);
            }
          } catch(e) {}
        });
        c.setAttribute('y', chordY);
        if (curX < prevRight + 6) {
          const newX = prevRight + 6;
          c.setAttribute('x', newX);
          prevRight = newX + curW;
        } else {
          c.setAttribute('x', curX);
          prevRight = curX + curW;
        }
      });
    });
  }

  async function loadSong(songId, initialSet = 'HD') {
    let token = ++_chordLoadToken; if (window.ChordCanvasCore?.nextToken) { token = window.ChordCanvasCore.nextToken(); _chordLoadToken = token; } const _tGuard = () => { const token = ++_chordLoadToken; if (token !== _chordLoadToken) return; }; void _tGuard;
    initialSet = initialSet || 'HD';
    await window.ChordCanvasEdit?.flushSave?.();
    if (window.ChordCanvasCore?.isCurrentToken ? !window.ChordCanvasCore.isCurrentToken(token) : token !== _chordLoadToken) return;
    window.ChordCanvasEdit?.closePopup?.();
    _clear();
    window.ChordCanvasEdit?.resetUndo?.(); // R0-4: tránh Ctrl+Z ghi nhầm sang bài mới
    _songUseFlats = null;
    window.ChordCanvasTranspose?.resetCache?.();
    _currentSet   = initialSet;
    _prevSet      = initialSet;
    _customChords = {};
    if (_editEnabled) {
      const myCode = (window.Auth?.getChordCode?.() || '').toUpperCase();
      const canDirect = Boolean(window.Auth?.isBanhat?.()) && initialSet !== 'default' && (window.Auth?.isAdmin?.() || (!!myCode && initialSet.toUpperCase() === myCode));
      if (!canDirect) setAddMode(false, { skipConfirm: true });
    }
    window.ChordCanvasEdit?.setBaseChecksum?.('', _customChords);

    if (window.ChordCanvasCore?.loadChordSet) { const cr = await window.ChordCanvasCore.loadChordSet(songId, initialSet, { token }); if (cr.stale) return; _customChords = cr.chords; const hasErr = !!cr.error; window.ChordCanvasEdit?.setBaseChecksum?.(hasErr ? '__LOAD_ERROR__' : cr.checksum, _customChords); ['btn-add-chord-mode-bar', 'btn-menu-add-chord-mode'].forEach(id => { const b = document.getElementById(id); if (b) b.disabled = hasErr; }); if (hasErr) { (window.App?.showToast || window.AppUI?.showToast)?.('Không tải được bộ hợp âm', 'error'); setAddMode(false, { skipConfirm: true }); } } else if (initialSet !== 'default') {
      try {
        const r = await window.ApiService.chordSets.load(songId, initialSet);
        if (token !== _chordLoadToken) return;
        if (r && r.success && r.chords) {
          r.chords.forEach(({ measureIdx, noteIdx, chord }) => { _customChords[`${measureIdx}_${noteIdx}`] = chord; });
        } else {
          _loadOfflineChords(songId, initialSet);
        }
        window.ChordCanvasEdit?.setBaseChecksum?.(r?.checksum || '', _customChords);
      } catch(e) {
        if (token !== _chordLoadToken) return;
        _loadOfflineChords(songId, initialSet);
      }
    }

    _refreshSetDropdown();
    window.SongInfoBar?.refreshChordChip?.();
    if (document.querySelector('#osmd-container svg')) requestAnimationFrame(_build);
  }

  function _loadOfflineChords(songId, set) {
    const chords = window.OfflineSetlistManager?.hasOfflineChords?.(songId, set) ? (window.OfflineSetlistManager.getOfflineChords(songId, set) || []) : [];
    chords.forEach(({ measureIdx, noteIdx, chord }) => { _customChords[`${measureIdx}_${noteIdx}`] = chord; });
  }

  function clearSong() { window.ChordCanvasEdit?.closePopup?.(); _clear(); window.ChordCanvasDots?.clearGeomCache?.(); setAddMode(false); }

  // R0-2 (ROADMAP5, lỗi B2/B3): trước đây bấm C khi xem HD/TLH sẽ ÂM THẦM sao
  // chép & ghi đè bộ cá nhân (hoặc cả HD dùng chung, nếu admin ở TLH). Giờ phải
  // chọn rõ giữa "sửa trên bản của tôi" và "sao chép, ghi đè" (xác nhận thêm 1 lần).
  function setAddMode(on, opts = {}) {
    if (on && window.ChordCanvasCore?.hasLoadError?.(window.App?.getCurrentSongId?.(), _currentSet)) { (window.App?.showToast || window.AppUI?.showToast)?.('Không tải được bộ hợp âm', 'error'); return; }
    if (on && !opts.skipConfirm) {
      if (_pendingConfirm) return;
      const myChordCode = (window.Auth?.getChordCode?.() || '').toUpperCase();
      const myUsername  = window.Auth?.getUser?.() || '';
      const isHoaiDinh  = myChordCode === 'HD';
      const isAdmin     = Boolean(window.Auth?.isAdmin?.());
      const curSetUpper = (_currentSet || '').toUpperCase();
      const isOwnSet    = (!!myChordCode && curSetUpper === myChordCode) || (curSetUpper === 'HD' && isHoaiDinh);
      // Thu hẹp đúng phạm vi lỗi B2/B3 — KHÔNG đổi hành vi cho bộ cá nhân tuỳ ý khác
      // (không phá luồng "Tạo bộ mới rồi sửa ngay"): TLH luôn bất biến (Core Rule 3);
      // HD là bộ DÙNG CHUNG — ai không phải chủ sở hữu (chord_code='HD' / hoaidinh) hoặc Admin phải hỏi trước.
      const needsConfirm = (_currentSet === 'default') || (curSetUpper === 'HD' && !isOwnSet && !isAdmin);
      if (needsConfirm) {
        const targetSet = (isAdmin || isHoaiDinh) ? 'HD' : (myChordCode || myUsername);
        if (!targetSet) {
          window.App?.showToast?.('⚠️ Tài khoản của bạn chưa có mã hợp âm cá nhân. Vào Quản Lý Kho Nhạc để thiết lập trước khi sửa hợp âm.', 'info', 4000);
          return;
        }
        const songId = window.App?.getCurrentSongId?.();
        const sourceLabel = (_currentSet === 'default') ? 'TLH (Gốc)' : _currentSet;
        const isTargetHd = targetSet.toUpperCase() === 'HD';
        _pendingConfirm = true;
        window.ChordCanvasUI?.showCloneChoiceModal({
          sourceLabel,
          targetSet,
          onEditMine:      () => { _pendingConfirm = false; window.ChordCanvasEdit?.startEditingWithoutCloning?.(targetSet); },
          onCopyOverwrite: isTargetHd ? null : () => { _pendingConfirm = false; window.ChordCanvasEdit?.cloneAndStartEditing?.(songId, _currentSet, targetSet); },
          onCancel:        () => { _pendingConfirm = false; window.ModeManager?.resetToView?.(); }
        });
        return; // KHÔNG bật _editEnabled ở đây — chờ người dùng chọn xong trong hộp thoại
      }
    }
    _editEnabled = on;
    const barBtn = document.getElementById('btn-add-chord-mode-bar');
    barBtn?.classList.toggle('active', on);

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

  function toggleHighlight() {
    setHighlightMode(!_highlightMode);
  }

  function setHighlightMode(on) {
    _highlightMode = on;
    try { localStorage.setItem(HIGHLIGHT_KEY, on ? 'true' : 'false'); } catch(e) {} (document.getElementById('btn-menu-chord-highlight') || document.getElementById('btn-chord-highlight'))?.classList?.toggle?.('active', !!on);
    _build();
  }

  function _clear() {
    document.querySelectorAll('.cc-dot, .cc-note-dot, .cc-custom-chord-text, .cc-edit-badge, .cc-chord-text, .cc-chord-highlight, .cc-tlh-ghost-chord')
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
    // R2-8 (B8): Chỉ fallback TLH khi đang xem HD và HD chưa có hợp âm (và KHÔNG ở chế độ soạn).
    // Tuyệt đối không fallback sang TLH khi đang ở bộ cá nhân (BH...) hoặc đang soạn!
    // Quyết định 2026-10-29: mặc định KHÔNG fallback (HD rỗng → bản nhạc sạch); bật lại bằng AppRules.HD_EMPTY_SHOWS_TLH.
    const isFallbackToTlh = (window.AppRules?.HD_EMPTY_SHOWS_TLH === true && _currentSet === 'HD' && customCount === 0 && xmlCount > 0 && !_editEnabled);

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
        showTlhSuggestions: _showTlhHints,
        tlhChordMap: xmlChordMap,
        onShowPopup: (anchor, mi, ni, chord) => window.ChordCanvasEdit?.showPopup(anchor, mi, ni, chord)
      });
    });

    window.ChordCanvasDots?.alignDOMChords?.();
  }

  /* ─── Switch / Create chord sets ────────────────────────────── */
  function handleSelectChange(val) {
    const sel = document.getElementById('chord-set-selector');
    if (val === '__create_new_set__') { if (sel) sel.value = _currentSet; showNewSetModal(); return; }
    const base = (typeof window !== 'undefined' && typeof window.__APP_BASE__ === 'string') ? window.__APP_BASE__.replace(/\/+$/, '') : '';
    if (val === '__open_members__') { if (sel) sel.value = _currentSet; window.open((base || '') + '/manager/#tab-users', '_blank'); return; }
    if (val === '__open_manager__') { if (sel) sel.value = _currentSet; window.open((base || '') + '/manager/', '_blank'); return; }
    switchSet(val);
  }

  async function switchSet(name) {
    window.ChordCanvasEdit?.closePopup?.();
    if (!name || name === '__create_new_set__' || name === '__open_members__' || name === '__open_manager__' || name.startsWith('__')) {
      const sel = document.getElementById('chord-set-selector');
      if (sel) sel.value = _currentSet;
      return;
    }
    let token = ++_chordLoadToken; if (window.ChordCanvasCore?.nextToken) { token = window.ChordCanvasCore.nextToken(); _chordLoadToken = token; } const _tGuard = () => { const token = ++_chordLoadToken; if (token !== _chordLoadToken) return; }; void _tGuard;
    const songId = window.App?.getCurrentSongId?.();
    await window.ChordCanvasEdit?.flushSave?.();
    if (token !== _chordLoadToken || songId !== window.App?.getCurrentSongId?.()) return;
    window.ChordCanvasEdit?.resetUndo?.(); // R0-4: tránh Ctrl+Z ghi nhầm sang bộ mới
    _currentSet   = name;
    _customChords = {};
    window.ChordCanvasEdit?.setBaseChecksum?.('', _customChords);
    if (window.ChordCanvasCore?.loadChordSet) { const cr = await window.ChordCanvasCore.loadChordSet(songId, name, { token, verifySongId: true, useOfflineFallback: false }); if (cr.stale) return; _customChords = cr.chords; const hasErr = !!cr.error; window.ChordCanvasEdit?.setBaseChecksum?.(hasErr ? '__LOAD_ERROR__' : cr.checksum, _customChords); ['btn-add-chord-mode-bar', 'btn-menu-add-chord-mode'].forEach(id => { const b = document.getElementById(id); if (b) b.disabled = hasErr; }); if (hasErr) { (window.App?.showToast || window.AppUI?.showToast)?.('Không tải được bộ hợp âm', 'error'); setAddMode(false, { skipConfirm: true }); } } else if (name !== 'default') {
      if (songId) {
        try {
          const r = await window.ApiService.chordSets.load(songId, name);
          if (token !== _chordLoadToken || songId !== window.App?.getCurrentSongId?.()) return;
          if (r.success && r.chords) {
            r.chords.forEach(({ measureIdx, noteIdx, chord }) => { _customChords[`${measureIdx}_${noteIdx}`] = chord; });
          }
          window.ChordCanvasEdit?.setBaseChecksum?.(r?.checksum || '', _customChords);
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
    window.Store?.set?.('set', name);
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
    } catch(e) { return; }

    await switchSet(name);
    // R0-6 (ROADMAP5, lỗi B12): trước đây gọi thẳng setAddMode(true), không qua
    // ModeManager -> ModeManager._currentMode vẫn là 'view' dù đang sửa hợp âm thật,
    // nên phím Esc (do ModeManager làm chủ) không biết đường thoát chế độ sửa.
    if (window.ModeManager?.setMode) {
      window.ModeManager.setMode(window.ModeManager.MODES.EDIT_CHORDS);
    } else {
      setAddMode(true);
    }
    await _refreshSetDropdown(true);
    window.App?.showToast?.(`Đã tạo bộ "${name}" - bắt đầu nhập!`, 'success');
  }
  async function showNewSetModal() {
    if (!window.Auth?.isBanhat?.()) {
      window.App?.showToast?.('⚠️ Vui lòng đăng nhập tài khoản Nhạc công để tạo bản phối', 'info');
      window.Auth?.openModal?.();
      return;
    }
    const myChordCode = (window.Auth?.getChordCode?.() || '').toUpperCase();
    const isAdminOrLeader = Boolean(window.Auth?.isAdmin?.() || window.Auth?.isLeader?.() || myChordCode === 'HD');
    if (myChordCode && !isAdminOrLeader) {
      const selector = document.getElementById('chord-set-selector');
      const alreadyExists = Array.from(selector?.options || []).some(option => option.value.toUpperCase() === myChordCode);
      if (!alreadyExists) {
        await createSet(myChordCode);
        return;
      }
      if ((_currentSet || '').toUpperCase() !== myChordCode) {
        await switchSet(myChordCode);
        window.ModeManager?.setMode?.(window.ModeManager.MODES.EDIT_CHORDS);
        return;
      }
      window.ModeManager?.setMode?.(window.ModeManager.MODES.EDIT_CHORDS);
      setAddMode(true, { skipConfirm: true });
      window.App?.showToast?.(`✓ Bạn đang ở bộ hợp âm cá nhân (${myChordCode}) — đã bật chế độ sửa hợp âm.`, 'info');
      return;
    }
    ChordCanvasUI.showNewSetModal({ onCreate: (name) => createSet(name) });
  }
  async function deleteSet(name) {
    if (!name || name === 'default' || name === 'TLH' || name === 'HD') {
      window.App?.showToast?.('Bộ này được bảo vệ chuẩn, không thể xóa!', 'error'); return;
    }
    const myChordCode = (window.Auth?.getChordCode?.() || '').toUpperCase();
    const isAdmin = window.Auth?.isAdmin?.() ?? false;
    if (!isAdmin && name.toUpperCase() !== myChordCode) {
      window.App?.showToast?.(`Bạn chỉ được quyền xóa bộ hợp âm cá nhân của mình (${myChordCode})!`, 'error'); return;
    }
    const songId = window.App?.getCurrentSongId?.();
    if (!songId) return;
    try {
      const result = await window.ApiService.chordSets.delete(songId, name);
      if (!result?.success) {
        window.App?.showToast?.(result?.error || 'Không thể xóa bộ hợp âm', 'error');
        return;
      }
    } catch(e) {
      window.App?.showToast?.(e.message || 'Không thể xóa bộ hợp âm', 'error');
      return;
    }
    if (_currentSet === name) await switchSet('HD');
    _refreshSetDropdown(true);
  }

  async function confirmDeleteSet(name) {
    const target = name || _currentSet;
    if (!target || target === 'default' || target === 'TLH' || target === 'HD') {
      window.App?.showToast?.('Bộ này được bảo vệ chuẩn, không thể xóa!', 'error'); return;
    }
    if (window.confirm(`Bạn có chắc muốn xóa bộ hợp âm "${target}"?`)) await deleteSet(target);
  }

  /* ─── Set dropdown UI ───────────────────────────────────────── */
  async function _refreshSetDropdown(forceRefresh = false, fetchNames = false) {
    const selector  = document.getElementById('chord-set-selector');
    if (!selector) return;

    const songId = window.App?.getCurrentSongId?.();
    if (!songId) {
      selector.innerHTML = '<option value="HD" selected>⭐ HD (Hoài Dinh)</option><option value="default">TLH (Gốc) 🔒</option>';
      selector.disabled = true; return;
    }

    selector.disabled = false;
    if (!selector._hasLazyListener) {
      selector._hasLazyListener = true;
      selector.addEventListener('focus', () => _refreshSetDropdown(false, true));
      selector.addEventListener('pointerdown', () => _refreshSetDropdown(false, true));
      selector.addEventListener('mousedown', () => _refreshSetDropdown(false, true));
    }

    let sets = ['HD', 'default'];
    if (fetchNames || forceRefresh) {
      if (forceRefresh) window.ApiService.chordSets.clearCache(songId);
      try {
        const r = await window.ApiService.chordSets.list(songId);
        if (songId !== window.App?.getCurrentSongId?.()) return;
        if (r?.success && Array.isArray(r.sets)) {
          sets = ['HD', 'default', ...r.sets.filter(s => s !== 'HD' && s !== 'default')];
        }
      } catch(e) {}
    }
    if (songId !== window.App?.getCurrentSongId?.()) return;

    // R2-8 (B10): Luôn đảm bảo _currentSet có mặt trong options
    if (_currentSet && _currentSet !== 'default' && !sets.includes(_currentSet)) {
      sets.push(_currentSet);
    }

    _updateCountBadge();

    const myChordCode = (window.Auth?.getChordCode?.() || '').toUpperCase();
    const isLoggedIn  = window.Auth?.isLoggedIn?.() ?? false;
    const canCreate   = window.Auth?.canUseMemberTools?.() ?? window.Auth?.isBanhat?.() ?? false;

    const KNOWN_CODES = { 'HD': 'Hoài Dinh (HD)', 'NAM': 'Hoàng Nam (NAM)', 'LAN': 'Hà Lan (LAN)', 'BH': 'Ban Hát (BH)', 'ADMIN': 'Admin (ADMIN)' };
    const esc = s => window.SafeHtml ? window.SafeHtml.escape(s) : s;

    selector.innerHTML = sets.map(s => {
      const sUpper = s.toUpperCase();
      let label = s;
      if (s === 'default' || sUpper === 'TLH') label = 'TLH (Gốc) 🔒 [Bản chuẩn]';
      else if (isLoggedIn && myChordCode && sUpper === myChordCode) label = `⭐ Bộ của tôi (${s}) [Được sửa]`;
      else if (KNOWN_CODES[sUpper]) label = `${KNOWN_CODES[sUpper]} 👁️ [Chỉ xem]`;
      else if (sUpper === 'HD') label = '⭐ HD (Hoài Dinh) 👁️ [Chỉ xem]';
      else if (s.includes('__')) { const p = s.split('__'); label = `🎸 ${p.slice(1).join('__').replace(/_/g, ' ')} (@${p[0]}) [Chỉ xem]`; }
      else label = `🎸 Bộ ${s} [Chỉ xem]`;
      if (s === _currentSet && window.ChordSetNames?.describe) label = window.ChordSetNames.describe();
      return `<option value="${esc(s)}" ${s === _currentSet ? 'selected' : ''}>${esc(label)}</option>`;
    }).join('')
    + (canCreate ? `<option value="__create_new_set__" style="color: var(--accent,#6d28d9); font-weight: bold;">➕ Tạo Bộ Hợp Âm Mới (${esc(myChordCode || 'Cá nhân')})...</option>` : '')
    + (canCreate ? `<option value="__open_members__" style="color: var(--emerald,#10b981); font-weight: bold;">👥 Quản Lý Nhạc Công & Hợp Âm...</option>` : '')
    + (canCreate ? `<option value="__open_manager__" style="color: var(--cyan,#06b6d4);">📂 Mở Quản Lý Kho Nhạc...</option>` : '');

    selector.value = _currentSet;
    if (!selector.dataset.boundCreateHandler) {
      selector.dataset.boundCreateHandler = 'true';
      selector.addEventListener('change', (e) => handleSelectChange(e.target.value));
    }

    document.getElementById('btn-new-chord-set')?.classList.toggle('hidden', !canCreate);
    document.getElementById('btn-propose-hd')?.classList.toggle('hidden', !(_currentSet !== 'default' && _currentSet !== 'HD' && canCreate));
  }

  function _updateCountBadge() {
    const countBadge = document.getElementById('chord-set-count');
    if (!countBadge) return;
    const chordCount = Object.keys(_customChords || {}).length;
    const tlhCount   = (_currentSet === 'default') ? Object.keys(window.ChordCanvasXML?.readXmlChords?.() || {}).length : 0;
    const isFallback = (window.AppRules?.HD_EMPTY_SHOWS_TLH === true && _currentSet === 'HD' && chordCount === 0);
    countBadge.textContent = isFallback ? '○ HD chưa có · đang hiện TLH' : (_currentSet !== 'default' ? (chordCount > 0 ? `● ${chordCount} hợp âm` : '○ Chưa có') : (tlhCount > 0 ? `● ${tlhCount} hợp âm` : ''));
    countBadge.style.color = isFallback ? 'var(--warning,#d97706)' : ((chordCount > 0 || (_currentSet === 'default' && tlhCount > 0)) ? 'var(--success,#16a34a)' : 'var(--text-muted,#9ca3af)');
  }

  function _updateSetUI() { _updateCountBadge(); _refreshSetDropdown(); window.SongInfoBar?.refreshChordChip?.(); }
  function resetSet() { _currentSet = 'HD'; _prevSet = 'HD'; _customChords = {}; }

  return {
    init, loadSong, clearSong, setAddMode, toggleAddMode, toggleHighlight, setHighlightMode,
    onOSMDRendered, reposition, handleSelectChange, switchSet, createSet, showNewSetModal,
    deleteSet, confirmDeleteSet, resetSet,
    showProposeHdModal: (name) => window.ChordCanvasUI?.showProposeHdModal?.(name || _currentSet),
    refreshSetDropdown: (force) => _refreshSetDropdown(force),
    updateSetUI: () => _updateSetUI(),
    toggleSuggestions: (show) => { _showTlhHints = (show !== undefined ? !!show : !_showTlhHints); _build(); return _showTlhHints; },
    isSuggestionMode: () => _showTlhHints,
    setShowTlhSuggestions: (val) => { _showTlhHints = !!val; _build(); },
    clearSetsCache: (songId) => window.ApiService.chordSets.clearCache(songId),
    undo: () => window.ChordCanvasEdit?.undo?.(),
    redo: () => window.ChordCanvasEdit?.redo?.(),
    getCurrentSet: () => _currentSet,
    getCustomChords: () => _customChords,
    setCustomChords: (c) => { _customChords = c; },
    applyPreloaded: (set, chords, checksum = '') => {
      _chordLoadToken = window.ChordCanvasCore?.nextToken ? window.ChordCanvasCore.nextToken() : ++_chordLoadToken;
      _clear(); window.ChordCanvasEdit?.closePopup?.(false); window.ChordCanvasEdit?.resetUndo?.(); _songUseFlats = null; window.ChordCanvasTranspose?.resetCache?.();
      _currentSet = set || 'HD'; _prevSet = _currentSet; _customChords = chords ? { ...chords } : {};
      window.ChordCanvasEdit?.setBaseChecksum?.(checksum, _customChords);
      _refreshSetDropdown(); window.SongInfoBar?.refreshChordChip?.();
      if (document.querySelector('#osmd-container svg')) requestAnimationFrame(_build);
    },
    getXmlChordCount: () => Object.keys(window.ChordCanvasXML?.readXmlChords?.() || {}).length,
    getChordStatus: () => {
      const customCount = Object.keys(_customChords || {}).length, xmlCount = Object.keys(window.ChordCanvasXML?.readXmlChords?.() || {}).length;
      return { currentSet: _currentSet, customCount, xmlCount, isFallback: (window.AppRules?.HD_EMPTY_SHOWS_TLH === true && _currentSet === 'HD' && customCount === 0 && xmlCount > 0), isSparse: (_currentSet === 'HD' && customCount > 0 && xmlCount > 0 && customCount < 0.3 * xmlCount) };
    },
    isAddMode: () => _editEnabled, isEditMode: () => _editEnabled, isHighlightMode: () => _highlightMode,
    getNoteEls: () => _noteEls, build: _build
  };
})();
window.ChordCanvas = ChordCanvas;
