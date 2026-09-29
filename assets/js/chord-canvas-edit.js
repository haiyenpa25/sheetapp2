/**
 * chord-canvas-edit.js — Chord Editing, Popup Orchestration & Undo/Redo Engine
 * Part of SheetApp Sheet Reader
 */
const ChordCanvasEdit = (() => {
  'use strict';

  let _ctx = null;
  let _popup = null;
  let _undoStack = [];
  let _redoStack = [];

  function init(ctx) {
    _ctx = ctx;
  }

  function _getApp() {
    return _ctx || window.ChordCanvas;
  }

  let _currentCursorEl = null;

  function _clearNoteCursor() {
    if (_currentCursorEl) {
      _currentCursorEl.classList.remove('cc-note-cursor');
      _currentCursorEl = null;
    }
    document.querySelectorAll('.cc-note-cursor').forEach(el => el.classList.remove('cc-note-cursor'));
  }

  function _scrollToNote(el) {
    if (!el || typeof el.getBoundingClientRect !== 'function') return;
    const r = el.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    if (r.top < 110 || r.bottom > vh - 100) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    }
  }

  function _closePopup() {
    _clearNoteCursor();
    _popup?.remove();
    _popup = null;
  }

  function _pushUndo() {
    const app = _getApp();
    _undoStack.push({ set: app.getCurrentSet(), chords: { ...app.getCustomChords() } });
    if (_undoStack.length > 20) _undoStack.shift();
    _redoStack = [];
  }

  // R0-4 (ROADMAP5, lỗi B6): loadSong/switchSet phải gọi hàm này. Trước đây stack
  // undo/redo sống sót qua lần chuyển bài/bộ hợp âm, nên Ctrl+Z sau khi đã chuyển
  // sang bài/bộ khác sẽ pop lại state của bài/bộ CŨ rồi lưu (saveCustomSet) dùng
  // songId của bài MỚI đang xem — ghi nhầm dữ liệu bài cũ đè lên bài mới.
  function resetUndo() {
    _undoStack = [];
    _redoStack = [];
  }

  async function showPopup(anchor, measureIdx, noteIdx, existing) {
    const app = _getApp();
    if (!window.Auth?.isBanhat?.()) {
      window.App?.showToast?.('⚠️ Cần đăng nhập với quyền Ban Hát để sửa hợp âm', 'error');
      return;
    }
    if (app.getCurrentSet() === 'default') {
      window.App?.showToast?.('⚡ Tự động chuyển sang bộ HD (Ưu tiên) để sửa hợp âm...', 'info', 2000);
      await app.switchSet('HD');
    }
    _closePopup();

    // R2-1: Con trỏ nốt viền sáng và tự cuộn
    const noteEl = anchor?.closest?.('g.vf-stavenote') || anchor;
    if (noteEl) {
      noteEl.classList.add('cc-note-cursor');
      _currentCursorEl = noteEl;
      _scrollToNote(noteEl);
    }

    // R2-1: Gợi ý hợp âm từ TLH / XML
    let suggestion = '';
    const xmlMap = (typeof ChordCanvasXML !== 'undefined' && ChordCanvasXML.readXmlChords) ? ChordCanvasXML.readXmlChords() : {};
    suggestion = xmlMap[`${measureIdx}_${noteIdx}`] || '';

    _popup = ChordCanvasUI.createPopup(anchor, measureIdx, noteIdx, existing, app.getCurrentSet(), {
      onSave: async (val, opts = {}) => {
        await saveChord(measureIdx, noteIdx, val, !opts.skipRebuild);
      },
      onDelete: async () => {
        await deleteChord(measureIdx, noteIdx);
      },
      onClose: () => _closePopup(),
      // R0-3 & R2-1: Tab/Enter/→ nhập nhanh — mở popup của nốt kế tiếp
      onNext: (mi, ni) => openNextPopup(mi, ni),
      // R2-1: Shift+Tab/← lùi lại nốt trước
      onPrev: (mi, ni) => openPrevPopup(mi, ni)
    }, suggestion);
  }

  function openNextPopup(curMeasureIdx, curNoteIdx) {
    const app = _getApp();
    const noteEls = app.getNoteEls ? app.getNoteEls() : [];
    if (!noteEls.length) return;
    const chords = app.getCustomChords ? app.getCustomChords() : {};
    const mapped = window.ChordCanvasDots ? window.ChordCanvasDots.mapNotes(noteEls, chords) : [];
    let foundIdx = -1;
    for (let i = 0; i < mapped.length; i++) {
      if (mapped[i].measureIdx === curMeasureIdx && mapped[i].noteIdx === curNoteIdx) {
        foundIdx = i;
        break;
      }
    }
    if (foundIdx !== -1 && foundIdx + 1 < mapped.length) {
      const next = mapped[foundIdx + 1];
      setTimeout(() => {
        showPopup(next.el, next.measureIdx, next.noteIdx, next.chord || '');
      }, 40);
    }
  }

  function openPrevPopup(curMeasureIdx, curNoteIdx) {
    const app = _getApp();
    const noteEls = app.getNoteEls ? app.getNoteEls() : [];
    if (!noteEls.length) return;
    const chords = app.getCustomChords ? app.getCustomChords() : {};
    const mapped = window.ChordCanvasDots ? window.ChordCanvasDots.mapNotes(noteEls, chords) : [];
    let foundIdx = -1;
    for (let i = 0; i < mapped.length; i++) {
      if (mapped[i].measureIdx === curMeasureIdx && mapped[i].noteIdx === curNoteIdx) {
        foundIdx = i;
        break;
      }
    }
    if (foundIdx > 0) {
      const prev = mapped[foundIdx - 1];
      setTimeout(() => {
        showPopup(prev.el, prev.measureIdx, prev.noteIdx, prev.chord || '');
      }, 40);
    }
  }

  // R0-2 (ROADMAP5, lỗi B2/B3): chuyển sang bộ cá nhân và bật sửa NGAY, không đụng
  // dữ liệu sẵn có (không tự sao chép). Chỉ gọi sau khi người dùng chọn "Sửa trên
  // bản của tôi" trong showCloneChoiceModal (xem ChordCanvas.setAddMode).
  async function startEditingWithoutCloning(targetSet) {
    await _getApp().switchSet(targetSet);
    window.ChordCanvas?.setAddMode?.(true, { skipConfirm: true });
  }

  // Sao chép TOÀN BỘ hợp âm sourceSet -> targetSet rồi bắt đầu sửa targetSet.
  // Chỉ gọi khi người dùng đã CHỦ ĐỘNG xác nhận ghi đè (showCloneChoiceModal).
  async function cloneAndStartEditing(songId, sourceSet, targetSet) {
    if (!songId) { window.ChordCanvas?.setAddMode?.(true, { skipConfirm: true }); return; }
    AppUI?.setLoadingText?.(`Đang sao chép sang bộ hợp âm "${targetSet}"...`);
    try {
      if (sourceSet === 'default') {
        // TLH chỉ tồn tại trong XML -> server không clone được, tự dựng mảng rồi save().
        const arr = Object.entries(ChordCanvasXML.readXmlChords()).map(([k, chord]) => {
          const [measureIdx, noteIdx] = k.split('_').map(Number);
          return { measureIdx, noteIdx, chord };
        });
        await window.ApiService.chordSets.save(songId, targetSet, arr);
      } else {
        // Nguồn có thật trên server (HD/bộ khác) -> dùng clone() để giữ attribution.
        await window.ApiService.chordSets.clone(songId, sourceSet, targetSet);
      }
      window.ChordCanvas?.clearSetsCache?.(songId);
      window.App?.showToast?.(`✨ Đã sao chép hợp âm sang bộ "${targetSet}"!`, 'success', 3500);
      await _getApp().switchSet(targetSet);
      window.ChordCanvas?.setAddMode?.(true, { skipConfirm: true });
    } catch(e) {
      window.App?.showToast?.('Lỗi sao chép bộ hợp âm: ' + e.message, 'error');
    } finally {
      AppUI?.hideLoading?.();
    }
  }

  async function undo() {
    const app = _getApp();
    if (!_undoStack.length) { window.App?.showToast?.('Không có hành động để hoàn tác', 'info'); return; }
    _redoStack.push({ set: app.getCurrentSet(), chords: { ...app.getCustomChords() } });
    const prev = _undoStack.pop();
    app.setCurrentSet(prev.set);
    app.setCustomChords(prev.chords);
    if (app.getCurrentSet() !== 'default') {
      scheduleSave(1500);
    }
    setTimeout(() => requestAnimationFrame(() => app.build()), 80);
    window.App?.showToast?.('↩ Đã hoàn tác', 'info');
  }

  async function redo() {
    const app = _getApp();
    if (!_redoStack.length) { window.App?.showToast?.('Không có hành động để làm lại', 'info'); return; }
    _undoStack.push({ set: app.getCurrentSet(), chords: { ...app.getCustomChords() } });
    const next = _redoStack.pop();
    app.setCurrentSet(next.set);
    app.setCustomChords(next.chords);
    if (app.getCurrentSet() !== 'default') {
      scheduleSave(1500);
    }
    setTimeout(() => requestAnimationFrame(() => app.build()), 80);
    window.App?.showToast?.('↪ Đã làm lại', 'info');
  }

  async function saveChord(measureIdx, noteIdx, chordInput, refreshLayout = true) {
    _pushUndo();
    const app = _getApp();
    const semitones = window.App?.getCurrentTranspose?.() ?? 0;
    const capo = window.Store?.get?.('capoLevel') ?? 0;
    const effectiveShift = semitones - capo;
    let chordOriginalKey;
    if (effectiveShift !== 0) {
      const useFlatsOriginal = window.ChordCanvasTranspose?.getKeyUseFlats?.() ?? false;
      chordOriginalKey = TransposeEngine.transposeChord(chordInput, -effectiveShift, useFlatsOriginal);
    } else {
      chordOriginalKey = chordInput;
    }

    window.OSMDRenderer?.refreshRules?.();

    if (app.getCurrentSet() === 'default') {
      await ChordCanvasXML.injectXml(measureIdx, noteIdx, chordOriginalKey, refreshLayout);
    } else {
      const chords = app.getCustomChords();
      chords[`${measureIdx}_${noteIdx}`] = chordOriginalKey;
      scheduleSave(1500);
      if (refreshLayout) {
        setTimeout(() => requestAnimationFrame(() => app.build()), 80);
      }
    }
  }

  async function deleteChord(measureIdx, noteIdx) {
    _pushUndo();
    const app = _getApp();
    if (app.getCurrentSet() === 'default') {
      await ChordCanvasXML.removeXml(measureIdx, noteIdx);
    } else {
      const chords = app.getCustomChords();
      const deleted = chords[`${measureIdx}_${noteIdx}`] || '';
      delete chords[`${measureIdx}_${noteIdx}`];
      scheduleSave(1500);
      setTimeout(() => requestAnimationFrame(() => app.build()), 80);
      if (deleted) {
        window.App?.showToast?.(`Đã xóa "${deleted}" — Ctrl+Z để hoàn tác`, 'info');
      }
    }
  }

  let _saveDebounceTimer = null;
  let _baseChecksum = '';
  let _lastConfirmedChords = {};
  let _statusChipEl = null;
  const OFFLINE_QUEUE_KEY = 'sheetapp_offline_chord_queue_v1';
  let _offlineQueue = [];

  function _loadOfflineQueue() {
    try {
      const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
      if (raw) _offlineQueue = JSON.parse(raw);
    } catch (_) { _offlineQueue = []; }
  }

  function _saveOfflineQueue() {
    try {
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(_offlineQueue));
    } catch (_) {}
  }

  function _ensureStatusChip() {
    if (_statusChipEl && document.body.contains(_statusChipEl)) return _statusChipEl;
    let el = document.getElementById('cc-status-chip');
    if (!el) {
      el = document.createElement('div');
      el.id = 'cc-status-chip';
      el.className = 'cc-status-chip floating saved';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      el.innerHTML = '<span class="cc-status-indicator"></span><span class="cc-status-text">Đã lưu ✓</span>';
      const container = document.getElementById('sheet-container') || document.body;
      container.appendChild(el);
    }
    _statusChipEl = el;
    return _statusChipEl;
  }

  function _updateStatusChip(state, text) {
    const chip = _ensureStatusChip();
    if (!chip) return;
    chip.className = `cc-status-chip floating ${state}`;
    const txtEl = chip.querySelector('.cc-status-text');
    if (txtEl) txtEl.textContent = text || '';
  }

  function scheduleSave(delay = 1500) {
    _updateStatusChip('saving', 'Đang soạn…');
    if (_saveDebounceTimer) clearTimeout(_saveDebounceTimer);
    _saveDebounceTimer = setTimeout(() => {
      _saveDebounceTimer = null;
      executeSave();
    }, delay);
  }

  async function flushSave() {
    if (_saveDebounceTimer) {
      clearTimeout(_saveDebounceTimer);
      _saveDebounceTimer = null;
    }
    return executeSave();
  }

  async function executeSave() {
    const app = _getApp();
    const songId = window.App?.getCurrentSongId?.();
    if (!songId) return;

    const currentSet = app.getCurrentSet();
    if (currentSet === 'default') {
      window.App?.showToast?.('❌ Bản TLH gốc là bất biến, không thể lưu đè!', 'error');
      return;
    }

    const myChordCode = (window.Auth?.getChordCode?.() || '').toUpperCase();
    const curSetUpper = (currentSet || '').toUpperCase();

    if (myChordCode && curSetUpper !== myChordCode && curSetUpper !== 'HD') {
      window.App?.showToast?.(`❌ Bạn chỉ có quyền lưu vào bộ hợp âm cá nhân (${myChordCode})!`, 'error');
      return;
    }

    const chordsObj = app.getCustomChords();
    const arr = Object.entries(chordsObj).map(([k, chord]) => {
      const [measureIdx, noteIdx] = k.split('_').map(Number);
      return { measureIdx, noteIdx, chord };
    });

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      _offlineQueue.push({ songId, currentSet, arr, baseChecksum: _baseChecksum, timestamp: Date.now() });
      _saveOfflineQueue();
      _updateStatusChip('offline', `Ngoại tuyến (${_offlineQueue.length} chờ)`);
      window.App?.showToast?.('Đã lưu vào bộ nhớ tạm ngoại tuyến (sẽ đồng bộ khi có mạng)', 'info');
      return;
    }

    _updateStatusChip('saving', 'Đang lưu…');

    try {
      const r = await window.ApiService.chordSets.save(songId, currentSet, arr, _baseChecksum || null);
      if (r && r.success) {
        if (r.checksum) _baseChecksum = r.checksum;
        _lastConfirmedChords = { ...chordsObj };
        _updateStatusChip('saved', 'Đã lưu ✓');
      } else {
        throw new Error(r?.message || 'Lỗi không xác định khi lưu hợp âm');
      }
    } catch (err) {
      if (err.status === 409 || err.data?.conflict) {
        _updateStatusChip('conflict', 'Xung đột ⚠');
        showConflictModal({
          serverChords: err.data?.serverChords || [],
          serverChecksum: err.data?.currentChecksum || '',
          onOverwrite: async () => {
            _updateStatusChip('saving', 'Đang lưu…');
            try {
              const res = await window.ApiService.chordSets.save(songId, currentSet, arr, null);
              if (res && res.success) {
                if (res.checksum) _baseChecksum = res.checksum;
                _lastConfirmedChords = { ...chordsObj };
                _updateStatusChip('saved', 'Đã lưu ✓');
                window.App?.showToast?.('⚡ Đã ghi đè hợp âm lên máy chủ thành công', 'success');
              }
            } catch (overErr) {
              _updateStatusChip('error', 'Lỗi lưu ⚠');
              window.App?.showToast?.('Lỗi ghi đè: ' + overErr.message, 'error');
            }
          },
          onReload: () => {
            const serverArr = err.data?.serverChords || [];
            const newChords = {};
            serverArr.forEach(({ measureIdx, noteIdx, chord }) => {
              newChords[`${measureIdx}_${noteIdx}`] = chord;
            });
            app.setCustomChords(newChords);
            _lastConfirmedChords = { ...newChords };
            if (err.data?.currentChecksum) _baseChecksum = err.data.currentChecksum;
            _updateStatusChip('saved', 'Đã lưu ✓');
            setTimeout(() => requestAnimationFrame(() => app.build()), 80);
            window.App?.showToast?.('⤓ Đã nạp lại hợp âm từ máy chủ', 'info');
          }
        });
        return;
      }

      _updateStatusChip('error', 'Lỗi lưu ⚠');
      if (Object.keys(_lastConfirmedChords).length > 0) {
        app.setCustomChords({ ..._lastConfirmedChords });
        setTimeout(() => requestAnimationFrame(() => app.build()), 80);
        window.App?.showToast?.('⚠ Không thể lưu lên máy chủ. Đã hoàn tác về bản trước đó: ' + err.message, 'error', 5000);
      } else {
        window.App?.showToast?.('⚠ Lỗi lưu: ' + err.message, 'error');
      }
    }
  }

  async function flushOfflineQueue() {
    _loadOfflineQueue();
    if (!_offlineQueue.length) return;
    _updateStatusChip('saving', `Đang đồng bộ ${_offlineQueue.length} bản lưu…`);
    while (_offlineQueue.length > 0) {
      const item = _offlineQueue[0];
      try {
        const r = await window.ApiService.chordSets.save(item.songId, item.currentSet, item.arr, item.baseChecksum);
        if (r && r.success) {
          _offlineQueue.shift();
          _saveOfflineQueue();
          if (r.checksum) _baseChecksum = r.checksum;
        } else {
          break;
        }
      } catch (e) {
        break;
      }
    }
    if (_offlineQueue.length === 0) {
      _updateStatusChip('saved', 'Đã lưu ✓');
      window.App?.showToast?.('Đã đồng bộ xong dữ liệu ngoại tuyến', 'success');
    } else {
      _updateStatusChip('offline', `Ngoại tuyến (${_offlineQueue.length} chờ)`);
    }
  }

  function setBaseChecksum(checksum, chords) {
    _baseChecksum = checksum || '';
    if (chords) _lastConfirmedChords = { ...chords };
    else {
      const app = _getApp();
      _lastConfirmedChords = { ...(app.getCustomChords ? app.getCustomChords() : {}) };
    }
  }

  function showConflictModal({ serverChords, serverChecksum, onOverwrite, onReload }) {
    const isDark = document.body.classList.contains('dark-mode');
    const bgCard = isDark ? '#1e293b' : '#ffffff';
    const textPrimary = isDark ? '#f8fafc' : '#0f172a';
    const textSecondary = isDark ? '#94a3b8' : '#64748b';
    const borderColor = isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0';

    const overlay = document.createElement('div');
    overlay.id = 'cc-conflict-modal';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'cc-conflict-title');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.65);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;z-index:99999;padding:16px;';
    overlay.innerHTML = `
      <div style="background:${bgCard};color:${textPrimary};border:1px solid ${borderColor};border-radius:14px;padding:1.5rem;max-width:460px;width:100%;box-shadow:0 24px 60px rgba(0,0,0,.45);">
        <div id="cc-conflict-title" style="font-size:1.1rem;font-weight:700;line-height:1.2;margin-bottom:.5rem;display:flex;align-items:center;gap:8px;color:#ef4444;">
          ⚠ Phát hiện xung đột dữ liệu (409)
        </div>
        <div style="font-size:0.875rem;color:${textSecondary};line-height:1.5;margin-bottom:1.2rem;">
          Bộ hợp âm của bài hát này đã được thay đổi từ một phiên làm việc khác trên máy chủ trong lúc bạn đang soạn. Bạn muốn giải quyết xung đột như thế nào?
        </div>
        <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:12px;">
          <button id="cc-conflict-reload" class="btn btn-primary btn-sm" style="text-align:left;padding:10px 14px;border-radius:10px;font-weight:600;">
            ⤓ Nạp lại bản từ máy chủ (Khuyên dùng)
            <div style="font-weight:400;font-size:12px;opacity:.9;margin-top:3px;">Cập nhật lại các hợp âm mới nhất từ máy chủ để tránh ghi đè dữ liệu.</div>
          </button>
          <button id="cc-conflict-overwrite" class="btn btn-sm" style="text-align:left;padding:10px 14px;border-radius:10px;background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.35);color:#dc2626;font-weight:600;">
            ⚡ Ghi đè bằng bản hiện tại của tôi
            <div style="font-weight:400;font-size:12px;opacity:.9;margin-top:3px;">Lưu giữ toàn bộ các hợp âm bạn vừa nhập và ghi đè lên máy chủ.</div>
          </button>
        </div>
        <div style="display:flex;justify-content:flex-end;">
          <button id="cc-conflict-close" class="btn btn-ghost btn-sm">Đóng</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const cleanup = () => overlay.remove();
    overlay.querySelector('#cc-conflict-reload').onclick = () => { cleanup(); onReload?.(); };
    overlay.querySelector('#cc-conflict-overwrite').onclick = () => { cleanup(); onOverwrite?.(); };
    overlay.querySelector('#cc-conflict-close').onclick = () => cleanup();
    overlay.onclick = e => { if (e.target === overlay) cleanup(); };
  }

  if (typeof window !== 'undefined') {
    _loadOfflineQueue();
    window.addEventListener('online', () => {
      flushOfflineQueue();
    });
  }

  async function saveCustomSet(immediate = false) {
    if (immediate) return executeSave();
    scheduleSave(1500);
  }

  return {
    init,
    showPopup,
    openNextPopup,
    closePopup: _closePopup,
    pushUndo: _pushUndo,
    undo,
    redo,
    saveChord,
    deleteChord,
    saveCustomSet,
    startEditingWithoutCloning,
    cloneAndStartEditing,
    resetUndo,
    scheduleSave,
    flushSave,
    executeSave,
    flushOfflineQueue,
    setBaseChecksum,
    showConflictModal,
    updateStatusChip: _updateStatusChip
  };
})();

if (typeof window !== 'undefined') {
  window.ChordCanvasEdit = ChordCanvasEdit;
}
