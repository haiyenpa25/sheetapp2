/**
 * assets/js/core/ChordCanvasCore.js
 * M5-4: Logic hợp âm dùng chung cho cả Modern (chord-canvas.js + chord-canvas-edit.js)
 * và Classic (old/assets/js/chord-canvas.js):
 * - Token chống chồng lệnh khi tải/chuyển bộ hợp âm
 * - Tải bộ hợp âm từ ApiService.chordSets.load + fallback OfflineSetlistManager
 * - Chuyển đổi/lưu mảng hợp âm qua ApiService.chordSets.save
 * - Ngăn xếp Undo/Redo dùng chung, tự động xóa khi đổi bài/đổi bộ (chặn BUG-12 & BUG-25)
 */
const ChordCanvasCore = (() => {
  'use strict';

  const MAX_UNDO = 20;
  let _loadToken = 0;
  let _undoStack = [];
  let _redoStack = [];

  function nextToken() {
    return ++_loadToken;
  }

  function getToken() {
    return _loadToken;
  }

  function isCurrentToken(token) {
    return token === _loadToken;
  }

  function resetUndo() {
    _undoStack = [];
    _redoStack = [];
  }

  function pushUndo(currentSet, customChords) {
    _undoStack.push({ set: currentSet, chords: { ...(customChords || {}) } });
    if (_undoStack.length > MAX_UNDO) _undoStack.shift();
    _redoStack = [];
  }

  function popUndo(currentSet, customChords) {
    if (!_undoStack.length) return null;
    _redoStack.push({ set: currentSet, chords: { ...(customChords || {}) } });
    return _undoStack.pop();
  }

  function popRedo(currentSet, customChords) {
    if (!_redoStack.length) return null;
    _undoStack.push({ set: currentSet, chords: { ...(customChords || {}) } });
    return _redoStack.pop();
  }

  function canUndo() {
    return _undoStack.length > 0;
  }

  function canRedo() {
    return _redoStack.length > 0;
  }

  function _readOfflineChordsMap(songId, setName) {
    const out = {};
    const list = window.OfflineSetlistManager?.hasOfflineChords?.(songId, setName)
      ? window.OfflineSetlistManager.getOfflineChords(songId, setName) || []
      : [];
    list.forEach(({ measureIdx, noteIdx, chord }) => {
      out[`${measureIdx}_${noteIdx}`] = chord;
    });
    return out;
  }

  async function loadChordSet(songId, setName = 'HD', options = {}) {
    const token = typeof options.token === 'number' ? options.token : ++_loadToken;
    resetUndo();
    const targetSet = setName || 'HD';
    if (targetSet === 'default' || !songId) {
      return { stale: token !== _loadToken, set: targetSet, chords: {}, checksum: '' };
    }
    try {
      const r = await window.ApiService.chordSets.load(songId, targetSet);
      if (token !== _loadToken || (options.verifySongId && songId !== window.App?.getCurrentSongId?.())) {
        return { stale: true, set: targetSet, chords: {}, checksum: '' };
      }
      const chords = {};
      if (r && r.success && Array.isArray(r.chords)) {
        r.chords.forEach(({ measureIdx, noteIdx, chord }) => {
          chords[`${measureIdx}_${noteIdx}`] = chord;
        });
      } else if (options.useOfflineFallback !== false) {
        Object.assign(chords, _readOfflineChordsMap(songId, targetSet));
      }
      return { stale: false, set: targetSet, chords, checksum: r?.checksum || '' };
    } catch (err) {
      if (token !== _loadToken || (options.verifySongId && songId !== window.App?.getCurrentSongId?.())) {
        return { stale: true, set: targetSet, chords: {}, checksum: '' };
      }
      const chords = options.useOfflineFallback !== false ? _readOfflineChordsMap(songId, targetSet) : {};
      return { stale: false, set: targetSet, chords, checksum: '', error: err };
    }
  }

  function serializeChords(chordsObj) {
    return Object.entries(chordsObj || {}).map(([k, chord]) => {
      const [measureIdx, noteIdx] = k.split('_').map(Number);
      return { measureIdx, noteIdx, chord };
    });
  }

  async function saveChordSet(songId, setName, chordsObj, checksum = null) {
    if (!songId || !setName || setName === 'default') {
      return { success: false, message: 'Bộ TLH là bản gốc, không thể lưu đè' };
    }
    const arr = serializeChords(chordsObj);
    return window.ApiService.chordSets.save(songId, setName, arr, checksum);
  }

  return {
    MAX_UNDO,
    nextToken,
    getToken,
    isCurrentToken,
    resetUndo,
    pushUndo,
    popUndo,
    popRedo,
    canUndo,
    canRedo,
    loadChordSet,
    serializeChords,
    saveChordSet,
  };
})();

if (typeof window !== 'undefined') {
  window.ChordCanvasCore = ChordCanvasCore;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ChordCanvasCore;
}
