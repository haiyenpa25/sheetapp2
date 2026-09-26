/**
 * assets/js/core/TapTempo.js
 *
 * Bộ tính toán Tap Tempo BPM dùng chung cho toàn hệ thống SheetApp2:
 * - Hỗ trợ gõ nhịp liên tiếp, tự động xóa bộ nhớ đệm sau 2000ms không gõ
 * - Tính giá trị trung bình trượt của 4 khoảng thời gian gần nhất
 * - Ràng buộc dải BPM an toàn từ 40 đến 240
 * - Đồng bộ qua EventBus ('taptempo:bpm') và hỗ trợ callback trực tiếp
 *
 * Expose: window.TapTempo
 */
(function(window) {
  'use strict';

  const MIN_BPM = 40;
  const MAX_BPM = 240;
  const TIMEOUT_MS = 2000;
  const MAX_INTERVALS_SAMPLES = 4;

  let _tapTimestamps = [];
  let _currentBpm = 80;
  const _listeners = new Set();

  /**
   * Ghi nhận một lần gõ nhịp (Tap)
   * @returns {{ bpm: number, rawBpm: number, tapCount: number }}
   */
  function tap() {
    const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();

    // Nếu khoảng cách giữa 2 lần gõ > 2s thì reset chuỗi
    if (_tapTimestamps.length > 0 && (now - _tapTimestamps[_tapTimestamps.length - 1]) > TIMEOUT_MS) {
      _tapTimestamps = [];
    }

    _tapTimestamps.push(now);

    let calculatedBpm = _currentBpm;
    let rawBpm = _currentBpm;

    if (_tapTimestamps.length >= 2) {
      const intervals = [];
      for (let i = 1; i < _tapTimestamps.length; i++) {
        intervals.push(_tapTimestamps[i] - _tapTimestamps[i - 1]);
      }

      // Lấy tối đa 4 khoảng thời gian gần nhất để tính trung bình
      const recent = intervals.slice(-MAX_INTERVALS_SAMPLES);
      const avgInterval = recent.reduce((sum, val) => sum + val, 0) / recent.length;

      if (avgInterval > 0) {
        rawBpm = 60000 / avgInterval;
        calculatedBpm = Math.round(rawBpm);
        calculatedBpm = Math.max(MIN_BPM, Math.min(MAX_BPM, calculatedBpm));
        _currentBpm = calculatedBpm;

        // Bắn sự kiện tới các listeners và EventBus
        _notifyBpmChange(_currentBpm, rawBpm);
      }
    }

    return {
      bpm: calculatedBpm,
      rawBpm,
      tapCount: _tapTimestamps.length
    };
  }

  /**
   * Reset bộ đệm nhịp
   */
  function reset() {
    _tapTimestamps = [];
  }

  /**
   * Đặt BPM chủ động
   */
  function setBpm(val) {
    const n = Math.round(Number(val));
    if (!isNaN(n)) {
      _currentBpm = Math.max(MIN_BPM, Math.min(MAX_BPM, n));
      _notifyBpmChange(_currentBpm, _currentBpm);
    }
    return _currentBpm;
  }

  /**
   * Lấy BPM hiện tại
   */
  function getBpm() {
    return _currentBpm;
  }

  /**
   * Đăng ký lắng nghe thay đổi BPM
   */
  function onBpmChange(cb) {
    if (typeof cb === 'function') {
      _listeners.add(cb);
      return () => _listeners.delete(cb);
    }
    return () => {};
  }

  function _notifyBpmChange(bpm, raw) {
    _listeners.forEach(cb => {
      try { cb(bpm, raw); } catch (e) { console.error('[TapTempo] listener error:', e); }
    });

    if (window.EventBus) {
      window.EventBus.emit('taptempo:bpm', { bpm, rawBpm: raw });
    }
  }

  const TapTempo = {
    tap,
    reset,
    setBpm,
    getBpm,
    onBpmChange,
    MIN_BPM,
    MAX_BPM
  };

  window.TapTempo = TapTempo;

})(window);
