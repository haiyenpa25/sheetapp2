/**
 * assets/js/core/FeatureFlags.js
 *
 * Quản trị tập trung các cờ tính năng (Feature Flags) cho toàn bộ SheetApp2.
 * Giúp ẩn các tính năng đang phát triển / chưa có backend hoàn chỉnh,
 * bảo đảm không có nút bấm "giả" trên giao diện người dùng.
 */
(function(window) {
  'use strict';

  // Chỉ khai báo cờ có code thật đọc qua FeatureFlags.get(); cờ server lấy từ window.__FEATURES__.
  const DEFAULT_FLAGS = {
    LIVE_BAND_SATB: false            // ẨN bộ chọn bè (live-band/js/stage-rehearsal.js): chưa có engine tách bè vocal
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
