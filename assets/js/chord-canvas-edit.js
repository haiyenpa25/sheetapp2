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

  function _closePopup() {
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
    _popup = ChordCanvasUI.createPopup(anchor, measureIdx, noteIdx, existing, app.getCurrentSet(), {
      onSave: async (val, opts = {}) => {
        await saveChord(measureIdx, noteIdx, val, !opts.skipRebuild);
      },
      onDelete: async () => {
        await deleteChord(measureIdx, noteIdx);
      },
      onClose: () => _closePopup(),
      // R0-3: Tab/→ nhập nhanh — mở popup của nốt kế tiếp sau khi đã lưu nốt hiện tại
      onNext: (mi, ni) => openNextPopup(mi, ni)
    });
  }

  function openNextPopup(curMeasureIdx, curNoteIdx) {
    const app = _getApp();
    const noteEls = app.getNoteEls ? app.getNoteEls() : [];
    if (!noteEls.length) return;
    const mapped = window.ChordCanvasDots ? window.ChordCanvasDots.mapNotes(noteEls, {}) : [];
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
      const dotBtn = container.querySelector(`.cc-dot-btn[style*="left:${(next.rect.left - container.getBoundingClientRect().left) + next.rect.width / 2}px"]`);
      setTimeout(() => {
        if (dotBtn) dotBtn.click();
        else showPopup(next.el, next.measureIdx, next.noteIdx, '');
      }, 50);
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
      await saveCustomSet();
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
      await saveCustomSet();
    }
    setTimeout(() => requestAnimationFrame(() => app.build()), 80);
    window.App?.showToast?.('↪ Đã làm lại', 'info');
  }

  async function saveChord(measureIdx, noteIdx, chordInput, refreshLayout = true) {
    _pushUndo();
    const app = _getApp();
    const semitones = window.App?.getCurrentTranspose?.() ?? 0;
    let chordOriginalKey;
    if (semitones !== 0) {
      const useFlatsOriginal = window.ChordCanvasTranspose?.getKeyUseFlats?.() ?? false;
      chordOriginalKey = TransposeEngine.transposeChord(chordInput, -semitones, useFlatsOriginal);
    } else {
      chordOriginalKey = chordInput;
    }

    window.OSMDRenderer?.refreshRules?.();

    if (app.getCurrentSet() === 'default') {
      await ChordCanvasXML.injectXml(measureIdx, noteIdx, chordOriginalKey, refreshLayout);
    } else {
      const chords = app.getCustomChords();
      chords[`${measureIdx}_${noteIdx}`] = chordOriginalKey;
      await saveCustomSet();
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
      await saveCustomSet();
      setTimeout(() => requestAnimationFrame(() => app.build()), 80);
      if (deleted) {
        window.App?.showToast?.(`Đã xóa "${deleted}" — Ctrl+Z để hoàn tác`, 'info');
      }
    }
  }

  async function saveCustomSet() {
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

    if (myChordCode && curSetUpper !== myChordCode) {
      window.App?.showToast?.(`❌ Bạn chỉ có quyền lưu vào bộ hợp âm cá nhân (${myChordCode})!`, 'error');
      return;
    }

    const arr = Object.entries(app.getCustomChords()).map(([k, chord]) => {
      const [measureIdx, noteIdx] = k.split('_').map(Number);
      return { measureIdx, noteIdx, chord };
    });

    try {
      const r = await window.ApiService.chordSets.save(songId, currentSet, arr);
      if (r.success) window.App?.showToast?.(`Đã lưu hợp âm cho "${currentSet}"`, 'success');
      else window.App?.showToast?.('Lỗi lưu: ' + (r.message || ''), 'error');
    } catch (e) {
      window.App?.showToast?.('Lỗi: ' + e.message, 'error');
    }
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
    resetUndo
  };
})();

if (typeof window !== 'undefined') {
  window.ChordCanvasEdit = ChordCanvasEdit;
}
