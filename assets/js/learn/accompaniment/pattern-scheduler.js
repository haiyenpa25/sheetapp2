/**
 * learn/accompaniment/pattern-scheduler.js — Tone.js Exact Transport Clock Scheduler
 *
 * Lên lịch phát đệm tự động đồng bộ theo ô nhịp và thời gian thực của Tone.js Transport:
 * - Khắc phục hoàn toàn độ trễ lookAhead của Tone.js bằng getTicksAtTime(time)
 * - Tự động tính toán vị trí ô nhịp chính xác bù sai số clock floating point
 * - Điều phối vòng lặp scheduleRepeat('1m')
 *
 * Expose: window.PatternScheduler
 */
const PatternScheduler = (() => {
  'use strict';

  let _scheduledEventId = null;
  let _lastScheduledMeasure = -1;

  /* ─── Tone.js Exact Measure Resolution at Audio Time ─── */
  function getMeasureAtTime(audioTime) {
    if (!window.Tone) return 1;
    const T = Tone.getTransport();
    if (typeof T.getTicksAtTime === 'function') {
      const ticks = T.getTicksAtTime(audioTime);
      const timeSig = Array.isArray(T.timeSignature) ? T.timeSignature[0] : (T.timeSignature || 4);
      const ticksPerBar = (T.PPQ || 192) * timeSig;
      // Cộng 10 ticks margin để triệt tiêu sai số floating point của Tone.js clock
      const bar = Math.floor((ticks + 10) / ticksPerBar);
      return Math.max(1, bar + 1);
    }
    return window.MusicTransport ? MusicTransport.getMeasureBeat().measure : 1;
  }

  function start(onMeasureCallback) {
    if (!window.Tone) return;
    stop();
    _lastScheduledMeasure = -1;

    const transport = Tone.getTransport ? Tone.getTransport() : (Tone.Transport || null);
    if (!transport || typeof transport.scheduleRepeat !== 'function') return;

    _scheduledEventId = transport.scheduleRepeat((time) => {
      const measure = getMeasureAtTime(time);
      const bpm = window.MusicTransport ? MusicTransport.getBpm() : (transport.bpm?.value || 76);

      if (measure !== _lastScheduledMeasure) {
        _lastScheduledMeasure = measure;
        if (typeof onMeasureCallback === 'function') {
          onMeasureCallback(measure, time, bpm);
        }
      }
    }, '1m');
  }

  function stop() {
    if (_scheduledEventId !== null && window.Tone) {
      const transport = Tone.getTransport ? Tone.getTransport() : (Tone.Transport || null);
      if (transport && typeof transport.clear === 'function') {
        transport.clear(_scheduledEventId);
      }
      _scheduledEventId = null;
    }
    _lastScheduledMeasure = -1;

    if (window.VoicingEngine) VoicingEngine.reset();
    if (window.LearnSoundEngine) LearnSoundEngine.stopAll();
  }

  function pause() {
    if (window.LearnSoundEngine) LearnSoundEngine.stopAll();
  }

  return {
    getMeasureAtTime,
    start,
    stop,
    pause
  };
})();

if (typeof window !== 'undefined') {
  window.PatternScheduler = PatternScheduler;
}
