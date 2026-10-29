/**
 * AppRules.js — Hằng số và quy tắc nghiệp vụ dùng chung (M5-1)
 *
 * Bảo toàn tuyệt đối 4 Core Rules:
 *   1. HD mặc định (`DEFAULT_CHORD_SET = 'HD'`); HD rỗng thì hiện bản nhạc sạch (`HD_EMPTY_SHOWS_TLH = false`,
 *      trước 2026-10-29 là fallback TLH `FALLBACK_CHORD_SET = 'default'`).
 *   2. Tông về 0 (`INITIAL_TRANSPOSE = 0`) khi mở bài mới (trừ khi chương trình/setlist áp tông).
 *   3. Không xoá bộ `default` (TLH) và `HD` (`LOCKED_CHORD_SETS`).
 *   4. Thống nhất giới hạn dịch giọng ±12 nửa cung theo quyết định Q-M4.
 */
(function (global) {
  'use strict';

  const MAX_TRANSPOSE = 12;
  const MIN_TRANSPOSE = -12;
  const INITIAL_TRANSPOSE = 0;
  const TRANSPOSE_DEBOUNCE_MS = 100;

  const DEFAULT_CHORD_SET = 'HD';
  const FALLBACK_CHORD_SET = 'default';
  const LOCKED_CHORD_SETS = Object.freeze(['default', 'HD']);
  // Quyết định 2026-10-29 (thay Core Rule 1 cũ): HD rỗng thì hiện bản nhạc SẠCH, không rơi về TLH trong XML.
  // Đặt true để quay lại hành vi cũ (HD rỗng hiện TLH).
  const HD_EMPTY_SHOWS_TLH = false;

  function isTransposeValid(val) {
    const n = Number(val);
    return Number.isFinite(n) && n >= MIN_TRANSPOSE && n <= MAX_TRANSPOSE;
  }

  function clampTranspose(val) {
    const n = parseInt(val, 10) || 0;
    return Math.max(MIN_TRANSPOSE, Math.min(MAX_TRANSPOSE, n));
  }

  function isLockedChordSet(setName) {
    const s = String(setName || '').trim();
    return LOCKED_CHORD_SETS.includes(s);
  }

  const AppRules = Object.freeze({
    MAX_TRANSPOSE,
    MIN_TRANSPOSE,
    INITIAL_TRANSPOSE,
    TRANSPOSE_DEBOUNCE_MS,
    DEFAULT_CHORD_SET,
    FALLBACK_CHORD_SET,
    LOCKED_CHORD_SETS,
    HD_EMPTY_SHOWS_TLH,
    isTransposeValid,
    clampTranspose,
    isLockedChordSet,
  });

  global.AppRules = AppRules;
})(typeof window !== 'undefined' ? window : globalThis);
