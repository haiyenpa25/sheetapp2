/**
/**
 * learn/practice/practice-tracker.js — Stage 7: Client-First Practice Session Tracker
 *
 * Theo dõi quá trình luyện tập của người dùng:
 * - Ghi nhận thời gian luyện tập thực tế (chỉ tính khi đang phát nhạc hoặc đang tập)
 * - Thu thập BPM cao nhất đạt được trong buổi tập
 * - Tính toán tỉ lệ chính xác thực tế (accuracy) dựa trên số lần đánh đúng/sai thật
 * - Tự động đồng bộ batch lên server khi tạm dừng hoặc kết thúc bài
 * - Bắt sự kiện pagehide/beforeunload để tránh mất phiên cuối cùng (keepalive beacon gộp stats)
 * - 100% Non-blocking, tuyệt đối không gửi HTTP theo từng nốt
 *
 * Expose: window.PracticeTracker
 */
const PracticeTracker = (() => {
  'use strict';

  let _activeSessionId = null;
  let _assignmentId = null;
  let _songId = null;
  let _mode = 'piano';
  let _startBpm = 76;
  let _maxBpm = 76;
  let _sessionStartTime = 0;
  let _totalPracticeSeconds = 0;
  let _lastPlayTimestamp = 0;
  let _measureStats = new Map(); // measureNo -> { attempts, hits, bestBpm, timingTotal }
  let _totalAttempts = 0;
  let _correctHits = 0;
  let _timingScoreTotal = 0;

  function _getBase() {
    if (typeof window !== 'undefined' && typeof window.__APP_BASE__ === 'string') {
      return window.__APP_BASE__.replace(/\/+$/, '');
    }
    if (window.ApiService && typeof window.ApiService.resolveUrl === 'function') {
      return window.ApiService.resolveUrl('').replace(/\/+$/, '');
    }
    return '';
  }

  /**
   * Bắt đầu phiên luyện tập cho bài hát
   */
  async function startSession(songId, mode = 'piano', bpm = 76, assignmentId = null) {
    if (!songId) return;

    // Nếu đang có phiên cũ chưa kết thúc, kết thúc phiên cũ trước
    if (_activeSessionId) {
      await finishSession();
    }

    _songId = songId;
    _mode = mode || 'piano';
    _startBpm = bpm || 76;
    _maxBpm = bpm || 76;
    _assignmentId = assignmentId ? parseInt(assignmentId, 10) : null;
    _sessionStartTime = Date.now();
    _totalPracticeSeconds = 0;
    _totalAttempts = 0;
    _correctHits = 0;
    _timingScoreTotal = 0;
    _measureStats.clear();

    // Khách vãng lai / chưa đăng nhập: theo dõi cục bộ, không ghi vào server
    if (!window.__IS_LOGGED_IN__ || !window.__USER_ROLE__ || window.__USER_ROLE__ === 'guest') {
      return;
    }

    try {
      let data = null;
      if (window.ApiService?.practice?.start) {
        data = await window.ApiService.practice.start({
          song_id: _songId,
          mode: _mode,
          start_bpm: _startBpm,
          assignment_id: _assignmentId
        });
      } else {
        const base = _getBase();
        // INTENTIONAL EXCEPTION: Standalone practice-tracker fallback without ApiService
        const res = await fetch(`${base}/api/?route=practice&action=start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            song_id: _songId,
            mode: _mode,
            start_bpm: _startBpm,
            assignment_id: _assignmentId
          })
        });
        if (res.ok) {
          data = await res.json();
        }
      }

      if (data?.session?.session_id) {
        _activeSessionId = data.session.session_id;
        console.log('[PracticeTracker] Started practice session #', _activeSessionId);
      }
    } catch (e) {
      console.warn('[PracticeTracker] Start session offline fallback:', e);
    }
  }

  /**
   * Gọi khi nhạc bắt đầu chạy
   */
  function onPlaybackStart(bpm) {
    _lastPlayTimestamp = Date.now();
    if (bpm > _maxBpm) _maxBpm = bpm;
  }

  /**
   * Gọi khi nhạc dừng hoặc pause
   */
  function onPlaybackStop() {
    if (_lastPlayTimestamp > 0) {
      const elapsed = Math.round((Date.now() - _lastPlayTimestamp) / 1000);
      _totalPracticeSeconds += elapsed;
      _lastPlayTimestamp = 0;
    }
  }

  /**
   * Ghi nhận lượt tập 1 ô nhịp
   */
  function recordMeasure(measureNo, bpm, isHit = true, timingScore = 100.0) {
    if (!measureNo) return;
    if (bpm > _maxBpm) _maxBpm = bpm;

    const current = _measureStats.get(measureNo) || { attempts: 0, hits: 0, bestBpm: bpm, timingTotal: 0 };
    current.attempts += 1;
    if (isHit) current.hits += 1;
    if (bpm > current.bestBpm) current.bestBpm = bpm;
    current.timingTotal += timingScore;
    _measureStats.set(measureNo, current);

    _totalAttempts += 1;
    if (isHit) _correctHits += 1;
    _timingScoreTotal += timingScore;
  }

  /**
   * Ghi nhận độ chính xác hợp âm
   */
  function recordChordAccuracy(chord, isCorrect = true, bpm = 76) {
    _totalAttempts += 1;
    if (isCorrect) _correctHits += 1;
    _timingScoreTotal += 100.0;
  }

  /**
   * Ghi nhận đánh nốt (cho Melody / Piano)
   */
  function recordNoteHit(isCorrect, measureNo = null, bpm = 76, timingScore = 100.0) {
    if (measureNo) {
      recordMeasure(measureNo, bpm, isCorrect, timingScore);
    } else {
      _totalAttempts += 1;
      if (isCorrect) _correctHits += 1;
      _timingScoreTotal += timingScore;
    }
  }

  /**
   * Tính toán tỉ lệ chính xác thực tế (%)
   */
  function getAccuracyTotal() {
    if (_totalAttempts <= 0) return 0.0;
    return Math.round((_correctHits / _totalAttempts) * 1000) / 10;
  }

  /**
   * Tính toán điểm đúng nhịp trung bình
   */
  function getAverageTimingScore() {
    if (_totalAttempts <= 0) return 100.0;
    return Math.round((_timingScoreTotal / _totalAttempts) * 10) / 10;
  }

  /**
   * Xuất danh sách thống kê các ô nhịp
   */
  function _buildStatsArray() {
    const statsArray = [];
    _measureStats.forEach((v, k) => {
      const mAcc = v.attempts > 0 ? Math.round((v.hits / v.attempts) * 1000) / 10 : 0.0;
      const mTiming = v.attempts > 0 ? Math.round((v.timingTotal / v.attempts) * 10) / 10 : 100.0;
      statsArray.push({
        measure_no: k,
        attempts: v.attempts,
        accuracy: mAcc,
        timing_score: mTiming,
        best_bpm: v.bestBpm
      });
    });
    return statsArray;
  }

  /**
   * Kết thúc phiên luyện tập và đẩy batch summary lên server
   */
  async function finishSession() {
    onPlaybackStop();

    if (!_activeSessionId || _totalPracticeSeconds < 2) {
      _activeSessionId = null;
      return;
    }

    const sessionId = _activeSessionId;
    const duration = _totalPracticeSeconds;
    const maxBpm = _maxBpm;
    const accuracyTotal = getAccuracyTotal();
    const timingScore = getAverageTimingScore();
    const statsArray = _buildStatsArray();
    const notesTotal = _totalAttempts;
    const notesCorrect = _correctHits;
    _activeSessionId = null;

    try {
      const payload = {
        session_id: sessionId,
        duration_seconds: duration,
        max_bpm: maxBpm,
        accuracy_total: accuracyTotal,
        notes_total: notesTotal,
        notes_correct: notesCorrect,
        timing_score: timingScore,
        stats: statsArray
      };

      if (window.ApiService?.practice?.finish) {
        await window.ApiService.practice.finish(payload);
      } else {
        const base = _getBase();
        // INTENTIONAL EXCEPTION: Standalone practice-tracker fallback without ApiService
        await fetch(`${base}/api/?route=practice&action=finish`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      console.log(`[PracticeTracker] Finished session #${sessionId}: ${duration}s, max BPM ${maxBpm}, acc ${accuracyTotal}% (${notesCorrect}/${notesTotal} notes)`);
    } catch (e) {
      console.warn('[PracticeTracker] Save session failed:', e);
    }
  }

  /**
   * Lưu nhanh khi người dùng đóng tab / rời trang (PageHide / BeforeUnload)
   * Sử dụng SendBeacon hoặc Fetch keepalive gộp cả batch stats để không mất phiên cuối
   */
  function _flushOnLeave() {
    if (!_activeSessionId || _totalPracticeSeconds < 1) return;
    onPlaybackStop();
    const sessionId = _activeSessionId;
    const duration = Math.max(1, _totalPracticeSeconds);
    const maxBpm = _maxBpm;
    const accuracyTotal = getAccuracyTotal();
    const timingScore = getAverageTimingScore();
    const statsArray = _buildStatsArray();
    const notesTotal = _totalAttempts;
    const notesCorrect = _correctHits;
    _activeSessionId = null;

    const payload = JSON.stringify({
      session_id: sessionId,
      duration_seconds: duration,
      max_bpm: maxBpm,
      accuracy_total: accuracyTotal,
      notes_total: notesTotal,
      notes_correct: notesCorrect,
      timing_score: timingScore,
      stats: statsArray
    });

    try {
      const base = _getBase();
      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        const blob = new Blob([payload], { type: 'application/json' });
        const sent = navigator.sendBeacon(`${base}/api/?route=practice&action=finish`, blob);
        if (sent) return;
      }

      if (typeof fetch !== 'undefined') {
        // INTENTIONAL EXCEPTION: Keepalive beacon fallback on page unload
        fetch(`${base}/api/?route=practice&action=finish`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          keepalive: true
        }).catch(() => {});
      }
    } catch (e) {
      // Ignore leave errors
    }
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', _flushOnLeave);
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        _flushOnLeave();
      }
    });
    window.addEventListener('beforeunload', _flushOnLeave);
  }

  return {
    startSession,
    onPlaybackStart,
    onPlaybackStop,
    recordMeasure,
    recordChordAccuracy,
    recordNoteHit,
    getAccuracyTotal,
    getAverageTimingScore,
    finishSession
  };
})();

if (typeof window !== 'undefined') {
  window.PracticeTracker = PracticeTracker;
}
