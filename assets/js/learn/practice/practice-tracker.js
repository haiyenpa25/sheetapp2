/**
 * learn/practice/practice-tracker.js — Stage 7: Client-First Practice Session Tracker
 *
 * Theo dõi quá trình luyện tập của người dùng:
 * - Ghi nhận thời gian luyện tập thực tế (chỉ tính khi đang phát nhạc)
 * - Thu thập BPM cao nhất đạt được trong buổi tập
 * - Tự động đồng bộ batch lên server khi tạm dừng hoặc kết thúc bài
 * - 100% Non-blocking, tuyệt đối không gửi HTTP theo từng nốt
 *
 * Expose: window.PracticeTracker
 */
const PracticeTracker = (() => {
  'use strict';

  let _activeSessionId = null;
  let _songId = null;
  let _mode = 'piano';
  let _startBpm = 76;
  let _maxBpm = 76;
  let _sessionStartTime = 0;
  let _totalPracticeSeconds = 0;
  let _lastPlayTimestamp = 0;
  let _measureStats = new Map(); // measureNo -> { attempts, bestBpm }

  /**
   * Bắt đầu phiên luyện tập cho bài hát
   */
  async function startSession(songId, mode = 'piano', bpm = 76) {
    if (!songId) return;

    // Nếu đang có phiên cũ chưa kết thúc, kết thúc phiên cũ trước
    if (_activeSessionId) {
      await finishSession();
    }

    _songId = songId;
    _mode = mode || 'piano';
    _startBpm = bpm || 76;
    _maxBpm = bpm || 76;
    _sessionStartTime = Date.now();
    _totalPracticeSeconds = 0;
    _measureStats.clear();

    try {
      const res = await fetch('/api/?route=practice&action=start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          song_id: _songId,
          mode: _mode,
          start_bpm: _startBpm
        })
      });
      const data = await res.json();
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
  function recordMeasure(measureNo, bpm) {
    if (!measureNo) return;
    if (bpm > _maxBpm) _maxBpm = bpm;

    const current = _measureStats.get(measureNo) || { attempts: 0, bestBpm: bpm };
    current.attempts += 1;
    if (bpm > current.bestBpm) current.bestBpm = bpm;
    _measureStats.set(measureNo, current);
  }

  /**
   * Kết thúc phiên luyện tập và đẩy batch summary lên server
   */
  async function finishSession() {
    onPlaybackStop();

    if (!_activeSessionId || _totalPracticeSeconds < 3) {
      _activeSessionId = null;
      return;
    }

    const sessionId = _activeSessionId;
    const duration = _totalPracticeSeconds;
    const maxBpm = _maxBpm;
    _activeSessionId = null;

    try {
      // 1. Gửi batch checkpoint thống kê ô nhịp
      if (_measureStats.size > 0) {
        const statsArray = [];
        _measureStats.forEach((v, k) => {
          statsArray.push({
            measure_no: k,
            attempts: v.attempts,
            accuracy: 100.0,
            timing_score: 100.0,
            best_bpm: v.bestBpm
          });
        });

        await fetch('/api/?route=practice&action=checkpoint', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: sessionId,
            stats: statsArray
          })
        });
      }

      // 2. Gửi lệnh hoàn tất phiên
      await fetch('/api/?route=practice&action=finish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          duration_seconds: duration,
          max_bpm: maxBpm,
          accuracy_total: 100.0
        })
      });

      console.log(`[PracticeTracker] Finished session #${sessionId}: ${duration}s, max BPM ${maxBpm}`);
    } catch (e) {
      console.warn('[PracticeTracker] Save session failed:', e);
    }
  }

  return {
    startSession,
    onPlaybackStart,
    onPlaybackStop,
    recordMeasure,
    finishSession
  };
})();

if (typeof window !== 'undefined') {
  window.PracticeTracker = PracticeTracker;
}
