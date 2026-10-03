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

  function _destroyPopup() { _clearNoteCursor(); _popup?.remove(); _popup = null; }
  function _closePopup(rebuild = true) { _destroyPopup(); if (rebuild) _getApp()?.build?.(); }

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
      const myChordCode = window.Auth?.getChordCode?.() || window.Auth?.getUser?.() || 'HD';
      window.App?.showToast?.(`⚡ Tự động chuyển sang bộ ${myChordCode} để sửa hợp âm...`, 'info', 2000);
      await app.switchSet(myChordCode);
    }
    _destroyPopup();

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

    const { m, idx } = _findMapped(measureIdx, noteIdx);
    const totalNotes = m.length;
    const curNoteNum = idx >= 0 ? idx + 1 : 1;
    let lyricInfo = `ô nhịp ${measureIdx + 1}`;
    const lyric = window.ChordCanvasXML?.getNoteLyric?.(measureIdx, noteIdx);
    if (lyric && lyric.text) {
      lyricInfo = `ô nhịp ${measureIdx + 1} · Lời ${lyric.verse || 1} "${lyric.text}"`;
    }
    const meta = { totalNotes, curNoteNum, lyricInfo };

    _popup = ChordCanvasUI.createPopup(anchor, measureIdx, noteIdx, existing, app.getCurrentSet(), {
      onSave: async (val, opts = {}) => {
        await saveChord(measureIdx, noteIdx, val, !opts.skipRebuild);
      },
      onDelete: async () => {
        await deleteChord(measureIdx, noteIdx);
      },
      onClose: () => _closePopup(),
      onNext: (mi, ni) => openNextPopup(mi, ni),
      onPrev: (mi, ni) => openPrevPopup(mi, ni),
      onUndo: () => undo()
    }, suggestion, meta);
    _popup?.setAttribute('data-measure-idx', measureIdx);
  }

  function _findMapped(mi, ni) {
    const app = _getApp(), notes = app.getNoteEls?.() || [], ch = app.getCustomChords?.() || {};
    const raw = window.ChordCanvasDots ? window.ChordCanvasDots.mapNotes(notes, ch) : [];
    const seen = new Set(), m = [];
    for (const it of raw) { const k = `${it.measureIdx}_${it.noteIdx}`; if (!seen.has(k)) { seen.add(k); m.push(it); } }
    return { m, idx: m.findIndex(x => x.measureIdx === mi && x.noteIdx === ni) };
  }
  function openNextPopup(curMeasureIdx, curNoteIdx) {
    const { m, idx } = _findMapped(curMeasureIdx, curNoteIdx);
    if (idx !== -1 && idx + 1 < m.length) {
      const n = m[idx + 1], isBand = !document.getElementById('lyric-view-container')?.classList.contains('hidden');
      const el = isBand ? (document.querySelector(`#lyric-view-container .lv-pair[data-measure-idx="${n.measureIdx}"][data-note-idx="${n.noteIdx}"]`) || n.el) : n.el;
      setTimeout(() => showPopup(el, n.measureIdx, n.noteIdx, n.chord || ''), 40);
    }
  }
  function openPrevPopup(curMeasureIdx, curNoteIdx) {
    const { m, idx } = _findMapped(curMeasureIdx, curNoteIdx);
    if (idx > 0) {
      const p = m[idx - 1], isBand = !document.getElementById('lyric-view-container')?.classList.contains('hidden');
      const el = isBand ? (document.querySelector(`#lyric-view-container .lv-pair[data-measure-idx="${p.measureIdx}"][data-note-idx="${p.noteIdx}"]`) || p.el) : p.el;
      setTimeout(() => showPopup(el, p.measureIdx, p.noteIdx, p.chord || ''), 40);
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
      _getApp()?.updateSetUI?.();
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
    app.setCurrentSet(prev.set); app.setCustomChords(prev.chords);
    if (app.getCurrentSet() !== 'default') scheduleSave(1500);
    _getApp()?.updateSetUI?.();
    setTimeout(() => requestAnimationFrame(() => app.build()), 80);
    window.App?.showToast?.('↩ Đã hoàn tác', 'info');
  }

  async function redo() {
    const app = _getApp();
    if (!_redoStack.length) { window.App?.showToast?.('Không có hành động để làm lại', 'info'); return; }
    _undoStack.push({ set: app.getCurrentSet(), chords: { ...app.getCustomChords() } });
    const next = _redoStack.pop();
    app.setCurrentSet(next.set); app.setCustomChords(next.chords);
    if (app.getCurrentSet() !== 'default') scheduleSave(1500);
    _getApp()?.updateSetUI?.();
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
      _getApp()?.updateSetUI?.();
      setTimeout(() => requestAnimationFrame(() => app.build()), 40);
      if (!document.getElementById('lyric-view-container')?.classList.contains('hidden')) window.DisplaySettings?.renderLyricViewIfActive?.();
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
      _getApp()?.updateSetUI?.();
      setTimeout(() => requestAnimationFrame(() => app.build()), 80);
      if (!document.getElementById('lyric-view-container')?.classList.contains('hidden')) window.DisplaySettings?.renderLyricViewIfActive?.();
      if (deleted) window.App?.showToast?.(`Đã xóa "${deleted}" — Ctrl+Z để hoàn tác`, 'info');
    }
  }

  let _saveDebounceTimer = null;
  let _baseChecksum = '', _lastConfirmedChords = {}, _statusChipEl = null;
  const OFFLINE_QUEUE_KEY = 'sheetapp_offline_chord_queue_v1';
  let _offlineQueue = [];
  function _loadOfflineQueue() { try { const raw = localStorage.getItem(OFFLINE_QUEUE_KEY); if (raw) _offlineQueue = JSON.parse(raw); } catch (_) { _offlineQueue = []; } }
  function _saveOfflineQueue() { try { localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(_offlineQueue)); } catch (_) {} }

  function _ensureStatusChip() {
    if (_statusChipEl && document.body.contains(_statusChipEl)) return _statusChipEl;
    let el = document.getElementById('cc-status-chip');
    if (!el) {
      el = document.createElement('div');
      el.id = 'cc-status-chip'; el.className = 'cc-status-chip floating saved';
      el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite');
      el.innerHTML = '<span class="cc-status-indicator"></span><span class="cc-status-text">Đã lưu ✓</span>';
      (document.getElementById('sheet-container') || document.body).appendChild(el);
    }
    return (_statusChipEl = el);
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

    if (!window.Auth?.isAdmin?.() && myChordCode && curSetUpper !== myChordCode && curSetUpper !== 'HD') {
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
        _getApp()?.updateSetUI?.();
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
    const bgCard = isDark ? '#1e293b' : '#ffffff', textPri = isDark ? '#f8fafc' : '#0f172a';
    const textSec = isDark ? '#94a3b8' : '#64748b', border = isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0';
    const overlay = document.createElement('div');
    overlay.id = 'cc-conflict-modal';
    overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'cc-conflict-title');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.65);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;z-index:99999;padding:16px;';
    overlay.innerHTML = `
      <div style="background:${bgCard};color:${textPri};border:1px solid ${border};border-radius:14px;padding:1.4rem;max-width:440px;width:100%;box-shadow:0 24px 60px rgba(0,0,0,.45);">
        <div id="cc-conflict-title" style="font-size:1.05rem;font-weight:700;margin-bottom:.4rem;display:flex;align-items:center;gap:8px;color:#ef4444;">⚠ Phát hiện xung đột dữ liệu (409)</div>
        <div style="font-size:0.85rem;color:${textSec};line-height:1.4;margin-bottom:1.1rem;">Bộ hợp âm đã thay đổi trên máy chủ bởi phiên khác. Bạn muốn giải quyết thế nào?</div>
        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px;">
          <button id="cc-conflict-reload" class="btn btn-primary btn-sm" style="text-align:left;padding:8px 12px;border-radius:10px;font-weight:600;">⤓ Nạp lại bản từ máy chủ (Khuyên dùng)<div style="font-weight:400;font-size:12px;opacity:.9;margin-top:2px;">Cập nhật lại hợp âm mới nhất từ máy chủ.</div></button>
          <button id="cc-conflict-overwrite" class="btn btn-sm" style="text-align:left;padding:8px 12px;border-radius:10px;background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.35);color:#dc2626;font-weight:600;">⚡ Ghi đè bằng bản hiện tại của tôi<div style="font-weight:400;font-size:12px;opacity:.9;margin-top:2px;">Giữ toàn bộ hợp âm vừa nhập và ghi đè máy chủ.</div></button>
        </div>
        <div style="display:flex;justify-content:flex-end;"><button id="cc-conflict-close" class="btn btn-ghost btn-sm">Đóng</button></div>
      </div>`;
    document.body.appendChild(overlay);
    const cleanup = () => overlay.remove();
    overlay.querySelector('#cc-conflict-reload').onclick = () => { cleanup(); onReload?.(); };
    overlay.querySelector('#cc-conflict-overwrite').onclick = () => { cleanup(); onOverwrite?.(); };
    overlay.querySelector('#cc-conflict-close').onclick = cleanup;
    overlay.onclick = e => { if (e.target === overlay) cleanup(); };
  }

  let _measureClipboard = null;

  function copyMeasures(fromStart, fromEnd, toStart, toEnd) {
    if (typeof fromStart === 'object' && fromStart !== null) {
      toStart = fromStart.toStart ?? fromStart.targetMeasure;
      toEnd = fromStart.toEnd; fromEnd = fromStart.fromEnd; fromStart = fromStart.fromStart;
    }
    fromStart = Number(fromStart); fromEnd = fromEnd !== undefined ? Number(fromEnd) : fromStart; toStart = Number(toStart);
    if (isNaN(fromStart) || isNaN(fromEnd) || isNaN(toStart)) { window.App?.showToast?.('Số ô nhịp không hợp lệ', 'error'); return 0; }
    const app = _getApp(), chords = app.getCustomChords();
    if (!chords) return 0;
    _pushUndo();
    const delta = toStart - fromStart;
    let isZero = false;
    for (const k of Object.keys(chords)) {
      const [m] = k.split('_').map(Number);
      if (m === fromStart - 1 || m === fromEnd - 1) { isZero = true; break; }
    }
    const minM = isZero ? (fromStart - 1) : fromStart, maxM = isZero ? (fromEnd - 1) : fromEnd;
    const toCopy = [];
    for (const [k, c] of Object.entries(chords)) {
      const [m, n] = k.split('_').map(Number);
      if (m >= minM && m <= maxM) toCopy.push({ m, n, c });
    }
    if (!toCopy.length) { window.App?.showToast?.(`Không có hợp âm trong ô ${fromStart}–${fromEnd}`, 'info'); return 0; }
    let count = 0;
    toCopy.forEach(({ m, n, c }) => {
      const targetM = m + delta;
      if (targetM >= 0) { chords[`${targetM}_${n}`] = c; count++; }
    });
    scheduleSave(1500);
    setTimeout(() => requestAnimationFrame(() => app.build()), 80);
    const destEnd = toEnd || (toStart + (fromEnd - fromStart));
    window.App?.showToast?.(`✨ Đã chép ${count} hợp âm từ ô ${fromStart}–${fromEnd} sang ô ${toStart}–${destEnd}`, 'success');
    return count;
  }

  function showCopyMeasuresModal(defaultMeasureIdx) {
    const isDark = document.body.classList.contains('dark-mode');
    const bgCard = isDark ? '#1e293b' : '#ffffff', textPri = isDark ? '#f8fafc' : '#0f172a';
    const textSec = isDark ? '#94a3b8' : '#64748b', border = isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0';
    const defM = defaultMeasureIdx !== undefined ? (defaultMeasureIdx + 1) : 1;
    const overlay = document.createElement('div');
    overlay.id = 'cc-copy-measures-modal';
    overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-modal', 'true');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.65);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;z-index:99999;padding:16px;';
    overlay.innerHTML = `<div style="background:${bgCard};color:${textPri};border:1px solid ${border};border-radius:14px;padding:1.4rem;max-width:380px;width:100%;box-shadow:0 24px 60px rgba(0,0,0,.45);"><div style="font-size:1.05rem;font-weight:700;margin-bottom:.35rem;">≡ Chép ô nhịp hợp âm</div><div style="font-size:0.8rem;color:${textSec};margin-bottom:1rem;">Sao chép hợp âm của điệp khúc hoặc đoạn lặp sang ô mới.</div><div style="display:flex;gap:8px;margin-bottom:10px;"><div style="flex:1;"><label style="font-size:12px;font-weight:600;display:block;margin-bottom:3px;">Từ ô</label><input id="cc-copy-from-start" type="number" min="1" value="${defM}" style="width:100%;box-sizing:border-box;padding:6px 8px;border-radius:8px;border:1px solid ${border};background:${isDark ? '#0f172a' : '#f8fafc'};color:${textPri};font-size:13px;"></div><div style="flex:1;"><label style="font-size:12px;font-weight:600;display:block;margin-bottom:3px;">Đến ô</label><input id="cc-copy-from-end" type="number" min="1" value="${defM}" style="width:100%;box-sizing:border-box;padding:6px 8px;border-radius:8px;border:1px solid ${border};background:${isDark ? '#0f172a' : '#f8fafc'};color:${textPri};font-size:13px;"></div></div><div style="margin-bottom:1.1rem;"><label style="font-size:12px;font-weight:600;display:block;margin-bottom:3px;">Dán sang ô</label><input id="cc-copy-to-start" type="number" min="1" placeholder="Ví dụ: 11" style="width:100%;box-sizing:border-box;padding:6px 8px;border-radius:8px;border:1px solid ${border};background:${isDark ? '#0f172a' : '#f8fafc'};color:${textPri};font-size:13px;"></div><div style="display:flex;justify-content:flex-end;gap:8px;"><button id="cc-copy-cancel" class="btn btn-ghost btn-sm" type="button">Hủy</button><button id="cc-btn-do-copy-measures" class="btn btn-primary btn-sm" type="button">✓ Sao chép</button></div></div>`;
    document.body.appendChild(overlay);
    const cleanup = () => overlay.remove();
    overlay.querySelector('#cc-copy-cancel').onclick = cleanup;
    overlay.onclick = e => { if (e.target === overlay) cleanup(); };
    overlay.querySelector('#cc-btn-do-copy-measures').onclick = () => {
      const fs = parseInt(overlay.querySelector('#cc-copy-from-start').value, 10);
      const fe = parseInt(overlay.querySelector('#cc-copy-from-end').value, 10);
      const ts = parseInt(overlay.querySelector('#cc-copy-to-start').value, 10);
      if (isNaN(fs) || isNaN(fe) || isNaN(ts)) { window.App?.showToast?.('Vui lòng điền đủ ô nhịp', 'error'); return; }
      copyMeasures(fs, fe, ts); cleanup();
    };
  }

  function _getCurM() {
    if (_popup?.getAttribute('data-measure-idx')) return parseInt(_popup.getAttribute('data-measure-idx'), 10);
    if (_currentCursorEl) {
      const app = _getApp(), notes = app.getNoteEls?.() || [], ch = app.getCustomChords?.() || {};
      const m = window.ChordCanvasDots?.mapNotes?.(notes, ch)?.find(x => x.el === _currentCursorEl || x.el.contains?.(_currentCursorEl));
      if (m) return m.measureIdx;
    }
    return -1;
  }

  // R2-5: Vùng chạm theo nốt gần nhất, không chồng lên nhau (Voronoi nearest note calculation)
  function findNearestNote(clientX, clientY, maxDist = 90) {
    const app = _getApp(), notes = app.getNoteEls?.() || [], ch = app.getCustomChords?.() || {};
    const m = window.ChordCanvasDots ? window.ChordCanvasDots.mapNotes(notes, ch) : [];
    if (!m.length) return null;
    let best = null, minDist = Infinity;
    for (const item of m) {
      const r = item.rect || item.el?.getBoundingClientRect?.();
      if (!r || r.width === 0) continue;
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const d = Math.hypot(clientX - cx, clientY - cy);
      if (d < minDist) { minDist = d; best = item; }
    }
    return (minDist <= maxDist) ? best : null;
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('keydown', e => {
      if (!window.ChordCanvas?.isAddMode?.()) return;
      if (e.target?.tagName === 'INPUT' && e.target.id !== 'cc-pop-inp') return;
      if (e.target?.tagName === 'TEXTAREA') return;
      if ((e.ctrlKey || e.metaKey) && (e.code === 'KeyC' || e.key === 'c' || e.key === 'C')) {
        const cur = _getCurM();
        if (cur >= 0) {
          const ch = _getApp().getCustomChords?.() || {}, items = [];
          Object.entries(ch).forEach(([k, chord]) => {
            const [m, n] = k.split('_').map(Number);
            if (m === cur) items.push({ noteIdx: n, chord });
          });
          _measureClipboard = { cur, items };
          window.App?.showToast?.(`📋 Đã chép hợp âm ô nhịp ${cur + 1} (Ctrl+V để dán)`, 'info');
        }
      } else if ((e.ctrlKey || e.metaKey) && (e.code === 'KeyV' || e.key === 'v' || e.key === 'V')) {
        const cur = _getCurM();
        if (cur >= 0 && _measureClipboard?.items?.length) {
          e.preventDefault(); _pushUndo();
          const ch = _getApp().getCustomChords();
          _measureClipboard.items.forEach(({ noteIdx, chord }) => { ch[`${cur}_${noteIdx}`] = chord; });
          scheduleSave(1500); setTimeout(() => requestAnimationFrame(() => _getApp().build()), 80);
          window.App?.showToast?.(`✨ Đã dán ${_measureClipboard.items.length} hợp âm vào ô nhịp ${cur + 1}`, 'success');
        }
      }
    });

    // R2-5: Chạm vào khuông nhạc để chọn nốt gần nhất không chồng lấn
    document.addEventListener('pointerdown', e => {
      if (!window.ChordCanvas?.isAddMode?.()) return;
      if (e.target?.closest?.('.cc-popup, .cc-popup-mobile, .modal, .cc-dot-btn, .cc-dot-badge, input, textarea, button')) return;
      const container = document.getElementById('osmd-container');
      if (!container || !container.contains(e.target)) return;
      const nearest = findNearestNote(e.clientX, e.clientY);
      if (nearest) {
        showPopup(nearest.el, nearest.measureIdx, nearest.noteIdx, nearest.chord || '');
      }
    });
  }

  if (typeof window !== 'undefined') {
    _loadOfflineQueue();
    window.addEventListener('online', () => flushOfflineQueue());
  }

  async function saveCustomSet(immediate = false) {
    if (immediate) return executeSave();
    scheduleSave(1500);
  }

  return {
    init, showPopup, openNextPopup, closePopup: _closePopup,
    pushUndo: _pushUndo, undo, redo, saveChord, deleteChord,
    saveCustomSet, startEditingWithoutCloning, cloneAndStartEditing,
    resetUndo, scheduleSave, flushSave, executeSave, flushOfflineQueue,
    setBaseChecksum, showConflictModal, copyMeasures, showCopyMeasuresModal,
    updateStatusChip: _updateStatusChip, findNearestNote
  };
})();

if (typeof window !== 'undefined') {
  window.ChordCanvasEdit = ChordCanvasEdit;
}
