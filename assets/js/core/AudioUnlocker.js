/**
 * assets/js/core/AudioUnlocker.js
 *
 * Tiện ích âm thanh dùng chung (Audio Infrastructure) cho SheetApp2:
 * 1. Mở khóa AudioContext trên iOS/iPad/Safari/Chrome:
 *    - Gọi resume() ĐỒNG BỘ trong user gesture event trước mọi await
 *    - Phát buffer im lặng (silent buffer) để kéo tuyến âm thanh ra loa ngoài
 * 2. Bộ tạo âm gõ nhịp (Click/Beep Oscillator) siêu nhẹ:
 *    - Zero-latency không cần nạp file audio ngoài
 *    - Hỗ trợ StereoPannerNode phân kênh In-Ear Monitor (trái -1.0 / phải +1.0)
 *
 * Expose: window.AudioUnlocker
 */
(function(window) {
  'use strict';

  let _sharedContext = null;
  let _isUnlocked = false;

  /**
   * Lấy AudioContext chia sẻ (Web Audio API tiêu chuẩn)
   */
  function getAudioContext() {
    if (!_sharedContext) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        _sharedContext = new AudioCtx();
      }
    }
    return _sharedContext;
  }

  /**
   * Mở khóa AudioContext đồng bộ trong user gesture (touchstart / click)
   */
  function unlock(customContext = null) {
    const ctx = customContext || getAudioContext();
    if (!ctx) return false;

    try {
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      // Phát buffer im lặng 1 mẫu
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);

      _isUnlocked = true;
      return true;
    } catch (err) {
      console.warn('[AudioUnlocker] Unlock warning:', err);
      return false;
    }
  }

  /**
   * Phát âm thanh gõ nhịp click/beep sắc nét
   * @param {Object} options
   * @param {number} [options.freq=800] Tần số âm thanh (Hz)
   * @param {number} [options.duration=0.04] Độ dài âm (giây)
   * @param {number} [options.volume=0.3] Mức âm lượng (0.0 đến 1.0)
   * @param {number} [options.pan=0.0] Vị trí toàn cảnh (-1.0 Trái, 0 Giữa, 1.0 Phải)
   */
  function playClick(options = {}) {
    const {
      freq = 800,
      duration = 0.04,
      volume = 0.3,
      pan = 0.0
    } = options;

    const ctx = getAudioContext();
    if (!ctx) return false;

    try {
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      // Đường bao Envelope: Tấn công tức thì (Attack) và suy giảm tự nhiên (Decay)
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

      // Stereo Panner (hỗ trợ In-Ear Split)
      if (typeof ctx.createStereoPanner === 'function' && pan !== 0.0) {
        const panner = ctx.createStereoPanner();
        panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), ctx.currentTime);
        osc.connect(gain);
        gain.connect(panner);
        panner.connect(ctx.destination);
      } else {
        osc.connect(gain);
        gain.connect(ctx.destination);
      }

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration);
      return true;
    } catch (e) {
      return false;
    }
  }

  function isUnlocked() {
    return _isUnlocked;
  }

  const AudioUnlocker = {
    getAudioContext,
    unlock,
    playClick,
    isUnlocked
  };

  window.AudioUnlocker = AudioUnlocker;

})(window);
