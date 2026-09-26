/**
 * assets/js/core/FeatureFlags.js
 *
 * Quản trị tập trung các cờ tính năng (Feature Flags) cho toàn bộ SheetApp2.
 * Giúp ẩn các tính năng đang phát triển / chưa có backend hoàn chỉnh,
 * bảo đảm không có nút bấm "giả" trên giao diện người dùng.
 */
(function(window) {
  'use strict';

  const DEFAULT_FLAGS = {
    // Live Band Studio
    LIVE_BAND_A_B_LOOP: true,        // Đồng bộ vòng lặp A-B loop giữa Ca Trưởng và Ban Nhạc
    LIVE_BAND_STAGE_INK: true,       // Bút vẽ chú thích Apple Pencil / S-Pen đồng bộ
    LIVE_BAND_BAND_STATES: true,     // 6 trạng thái năng lượng ban nhạc (Break, Build, Drop...)
    LIVE_BAND_STEREO_SPLIT: true,    // Tách kênh In-Ear (L: Click / R: Nhạc đệm Pad)
    LIVE_BAND_SATB: false,           // ẨN: Live Band chưa có multi-track audio engine tách bè vocal

    // Main Sheet Viewer
    MIXER_PART_TOGGLE: true,         // Bật/tắt dải bè nhạc cụ khi bài hát có > 1 bè
    OFFLINE_XML_CACHE: true,         // Cache MusicXML quota FIFO v4

    // Smart Learning
    LEARN_PRACTICE_TRACKER: true,    // Đo lường độ chính xác luyện tập thực tế
    LEARN_MELODY_WAIT: true,         // Chờ nốt giai điệu MIDI
    LEARN_VOICING_ASSIST: true       // Gợi ý hợp âm nâng cao
  };

  // Hỗ trợ ghi đè cờ qua localStorage khi thử nghiệm (Dev/Admin)
  function getFlag(key) {
    try {
      const stored = localStorage.getItem('sheetapp_flag_' + key);
      if (stored !== null) {
        return stored === 'true' || stored === '1';
      }
    } catch (e) {}

    if (typeof window !== 'undefined' && window.__FEATURES__ && typeof window.__FEATURES__[key] !== 'undefined') {
      return Boolean(window.__FEATURES__[key]);
    }

    return DEFAULT_FLAGS[key] ?? false;
  }

  function setFlag(key, value) {
    try {
      localStorage.setItem('sheetapp_flag_' + key, String(!!value));
    } catch (e) {}
  }

  function getAllFlags() {
    const result = { ...DEFAULT_FLAGS };
    for (const key of Object.keys(DEFAULT_FLAGS)) {
      result[key] = getFlag(key);
    }
    return result;
  }

  window.FeatureFlags = {
    get: getFlag,
    set: setFlag,
    all: getAllFlags,
    DEFAULTS: Object.freeze(DEFAULT_FLAGS)
  };

})(typeof window !== 'undefined' ? window : this);
