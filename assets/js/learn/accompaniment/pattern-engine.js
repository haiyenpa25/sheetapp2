/**
 * learn/accompaniment/pattern-engine.js — Stage 5: Accompaniment Scheduling Engine
 *
 * Điều phối phát tự động các mẫu đệm piano/organ theo thời gian thực:
 * - Đồng bộ chặt chẽ với MusicTransport và Tone.Transport clock
 * - Tra cứu hợp âm chính xác tại từng phách từ Normalized Chord Timeline
 * - Dùng VoicingEngine để phối nốt và voice leading
 * - Gửi lệnh kích hoạt nốt sang LearnSoundEngine theo thời gian audio chính xác (Web Audio Clock)
 *
 * Expose: window.PatternEngine
 */
const PatternEngine = (() => {
  'use strict';

  let _activePatternId = 'piano-block-4-4-v1';
  let _enabled = true;
  let _scheduledEventId = null;
  let _lastScheduledMeasure = -1;

  /**
   * Khởi tạo Pattern Engine
   */
  function init() {
    // Đọc pattern ưu tiên từ Store nếu có
    const savedPattern = window.LearnStore?.get('patternId');
    if (savedPattern) {
      _activePatternId = savedPattern;
    }
  }

  /**
   * Đổi pattern đang sử dụng
   */
  function setPattern(patternId) {
    if (!patternId) return;
    _activePatternId = patternId;
    if (window.LearnStore) {
      LearnStore.set('patternId', patternId);
      LearnStore.savePreferences();
    }
    if (window.EventBus) {
      EventBus.emit(LEARN_EVENTS.PATTERN_CHANGED, { patternId });
    }
  }

  function getActivePattern() {
    return window.PatternLibrary ? PatternLibrary.getById(_activePatternId) : null;
  }

  function setEnabled(enabled) {
    _enabled = !!enabled;
    if (!_enabled && window.LearnSoundEngine) {
      LearnSoundEngine.stopAll();
    }
  }

  function isEnabled() {
    return _enabled;
  }

  /**
   * Lên lịch phát cho 1 ô nhịp cụ thể tại audio time T
   * @param {number} measureNo - Số thứ tự ô nhịp (1-indexed)
   * @param {number} audioTime - Thời điểm Web Audio Clock (giây)
   * @param {number} bpm - Nhịp độ hiện tại
   */
  function _scheduleMeasure(measureNo, audioTime, bpm) {
    if (!_enabled || !window.PatternLibrary || !window.VoicingEngine || !window.LearnSoundEngine) return;

    const pattern = PatternLibrary.getById(_activePatternId);
    if (!pattern || !pattern.lanes) return;

    const timeline = window.LearnStore ? LearnStore.get('timeline') : [];
    if (!timeline || !timeline.length) return;

    const secPerBeat = 60 / Math.max(20, bpm);

    pattern.lanes.forEach(lane => {
      const instrument = lane.instrument || 'piano';

      lane.events.forEach(ev => {
        const beatNumber = 1 + (ev.at || 0);

        // Tìm hợp âm có hiệu lực tại ô nhịp và phách này
        let chord = ChordTimelineNormalizer.getChordAt(timeline, measureNo, beatNumber);
        if (!chord) {
          // Fallback lấy hợp âm đầu tiên của ô nhịp
          chord = ChordTimelineNormalizer.getChordAt(timeline, measureNo, 1);
        }
        if (!chord) return;

        // Phối nốt
        const notes = VoicingEngine.resolveEvent(ev, chord, bpm);
        const noteAudioTime = audioTime + ((ev.at || 0) * secPerBeat);

        notes.forEach(n => {
          LearnSoundEngine.triggerNote(
            instrument,
            n.note,
            n.durationSec,
            noteAudioTime,
            n.velocity
          );
        });
      });
    });
  }

  /**
   * Bắt đầu scheduling gắn vào Tone.Transport
   */
  function start() {
    if (!window.Tone) return;

    stop(); // Đảm bảo dọn dẹp các event cũ trước khi lên lịch mới
    _lastScheduledMeasure = -1;

    const transport = Tone.getTransport();

    // Lên lịch callback lặp lại vào đầu mỗi ô nhịp (1m)
    _scheduledEventId = transport.scheduleRepeat((time) => {
      const { measure } = MusicTransport.getMeasureBeat();
      const bpm = MusicTransport.getBpm();

      // Tránh lặp kép cùng ô nhịp trong 1 tick
      if (measure !== _lastScheduledMeasure) {
        _lastScheduledMeasure = measure;
        _scheduleMeasure(measure, time, bpm);
      }
    }, '1m');
  }

  /**
   * Dừng scheduling
   */
  function stop() {
    if (_scheduledEventId !== null && window.Tone) {
      Tone.getTransport().clear(_scheduledEventId);
      _scheduledEventId = null;
    }
    _lastScheduledMeasure = -1;

    if (window.VoicingEngine) {
      VoicingEngine.reset();
    }
    if (window.LearnSoundEngine) {
      LearnSoundEngine.stopAll();
    }
  }

  /**
   * Tạm dừng
   */
  function pause() {
    if (window.LearnSoundEngine) {
      LearnSoundEngine.stopAll();
    }
  }

  return {
    init,
    setPattern,
    getActivePattern,
    setEnabled,
    isEnabled,
    start,
    stop,
    pause
  };
})();

if (typeof window !== 'undefined') {
  window.PatternEngine = PatternEngine;
}
