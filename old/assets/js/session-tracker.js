/**
 * session-tracker.js
 * Quản lý nhật ký biểu diễn (performance sessions).
 * Mỗi bài hát có file session riêng: /api/sessions.php?songId=xxx
 */
const SessionTracker = (() => {
  'use strict';

  let currentSongId   = null;
  let currentSettings = null;
  let _saveTimer      = null;
  const DEBOUNCE_MS   = 1500;

  /**
   * Load session gần nhất cho bài hát.
   * Trả về { lastTranspose, zoomLevel, chordOverrides, history }
   */
  async function loadSong(songId) {
    currentSongId = songId;
    try {
      const data = await window.ApiService?.sessions?.load?.(songId);
      currentSettings = (data && data.userSettings) ? data.userSettings : _defaultSettings();
      return currentSettings;
    } catch (err) {
      console.warn('[Session] Không thể load session:', err);
      currentSettings = _defaultSettings();
      return currentSettings;
    }
  }

  /**
   * Lưu session hiện tại (debounced).
   */
  function save(updates = {}) {
    if (!currentSongId) return;
    currentSettings = { ...currentSettings, ...updates };
    clearTimeout(_saveTimer);
    _saveTimer = setTimeout(_doSave, DEBOUNCE_MS);
  }

  /**
   * Lưu ngay lập tức (không debounce).
   */
  async function saveNow(note = null) {
    if (!currentSongId) return;
    clearTimeout(_saveTimer);

    if (note !== null) {
      const today = _today();
      const existing = currentSettings.history.find(h => h.date === today);
      if (existing) {
        existing.note = note;
        existing.tone = currentSettings.lastTranspose;
      } else {
        currentSettings.history.push({
          date: today,
          tone: currentSettings.lastTranspose,
          note
        });
      }
    }

    await _doSave();
    return currentSettings;
  }

  /** Cập nhật transpose trong settings */
  function setTranspose(semitones) {
    save({ lastTranspose: semitones });
  }

  /** Cập nhật zoom trong settings */
  function setZoom(level) {
    save({ zoomLevel: level });
  }

  /** Lấy settings hiện tại */
  function getSettings() {
    return currentSettings || _defaultSettings();
  }

  /** Lấy lịch sử */
  function getHistory() {
    return currentSettings?.history || [];
  }

  // ---- INTERNAL ----

  async function _doSave() {
    if (!currentSongId || !currentSettings) return;
    try {
      await window.ApiService?.sessions?.saveUserSettings?.(currentSongId, currentSettings);
    } catch (err) {
      console.warn('[Session] Lỗi lưu session:', err);
    }
  }

  function _defaultSettings() {
    return {
      lastTranspose:  0,
      zoomLevel:      1.0,
      history:        []
    };
  }

  function _today() {
    return new Date().toISOString().split('T')[0];
  }

  return {
    loadSong,
    save,
    saveNow,
    setTranspose,
    setZoom,
    getSettings,
    getHistory
  };
})();

window.SessionTracker = SessionTracker;
