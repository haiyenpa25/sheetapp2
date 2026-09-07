/**
 * learn/practice/loop-controller.js — Stage 6: Section Looping & Tempo Ladder
 *
 * Quản lý tính năng luyện tập chuyên sâu:
 * - A/B Loop theo ô nhịp tùy chỉnh
 * - Tự động nhận diện hoặc tải phân đoạn bài hát (Intro, Verse, Chorus, Outro...)
 * - Bậc thang nhịp độ (Tempo Ladder): 50%, 75%, 100%, 110%
 * - Tự động tăng tốc độ (Auto-advance BPM) sau mỗi chu kỳ lặp thành công
 *
 * Expose: window.LoopController
 */
const LoopController = (() => {
  'use strict';

  let _sections = [];
  let _activeSection = null;
  let _loopEnabled = false;
  let _startMeasure = 1;
  let _endMeasure = 8;
  let _totalMeasures = 32;

  // Tempo ladder state
  let _baseBpm = 76;
  let _currentRatio = 1.0;
  let _autoAdvanceEnabled = false;
  let _loopsCompleted = 0;
  let _loopsTargetForAdvance = 2; // Tăng BPM sau mỗi 2 vòng lặp trọn vẹn
  let _lastCompletedMeasure = -1;

  /**
   * Khởi tạo Loop Controller cho bài hát
   */
  async function initForSong(songId, totalMeasures = 32, baseBpm = 76) {
    _totalMeasures = totalMeasures || 32;
    _baseBpm = baseBpm || 76;
    _sections = [];
    _activeSection = null;
    _loopEnabled = false;
    _loopsCompleted = 0;

    // Tải sections từ backend arrangements API nếu có
    if (window.ApiService?.arrangements?.getSections && songId) {
      try {
        const res = await ApiService.arrangements.getSections(songId);
        if (Array.isArray(res?.data) && res.data.length > 0) {
          _sections = res.data.map(s => ({
            id: s.id,
            name: s.name || s.type,
            type: s.type || 'verse',
            start: parseInt(s.start_measure, 10),
            end: parseInt(s.end_measure, 10)
          }));
        }
      } catch (e) {
        console.warn('[LoopController] Load sections fallback to auto-divide:', e);
      }
    }

    // Nếu bài chưa có phân đoạn thủ công, tự sinh các đoạn 8 ô nhịp tiện dụng
    if (!_sections.length) {
      const step = 8;
      let secIdx = 1;
      for (let m = 1; m <= _totalMeasures; m += step) {
        const end = Math.min(_totalMeasures, m + step - 1);
        _sections.push({
          id: `auto_${secIdx}`,
          name: `Đoạn ${secIdx} (m${m}-${end})`,
          type: 'verse',
          start: m,
          end: end
        });
        secIdx++;
      }
    }

    _renderSectionSelect();
    _bindEvents();
  }

  /**
   * Render danh sách phân đoạn vào thẻ select
   */
  function _renderSectionSelect() {
    const select = document.getElementById('learn-section-select');
    if (!select) return;

    select.innerHTML = '<option value="all">Toàn bài (Không lặp)</option>';
    _sections.forEach(sec => {
      const opt = document.createElement('option');
      opt.value = sec.id;
      opt.textContent = `${sec.name} [m.${sec.start}–${sec.end}]`;
      select.appendChild(opt);
    });

    select.value = 'all';
  }

  /**
   * Bật/tắt chế độ lặp
   */
  function setLoop(enabled, startM = null, endM = null) {
    _loopEnabled = !!enabled;
    if (startM !== null) _startMeasure = Math.max(1, startM);
    if (endM !== null) _endMeasure = Math.min(_totalMeasures, endM);

    if (window.MusicTransport) {
      MusicTransport.setLoop(_loopEnabled, _startMeasure, _endMeasure);
    }

    _updateLoopUI();
  }

  /**
   * Chọn phân đoạn tập
   */
  function selectSection(sectionId) {
    if (sectionId === 'all' || !sectionId) {
      _activeSection = null;
      setLoop(false);
      return;
    }

    const sec = _sections.find(s => String(s.id) === String(sectionId));
    if (!sec) return;

    _activeSection = sec;
    setLoop(true, sec.start, sec.end);

    // Di chuyển con trỏ phát về đầu phân đoạn
    if (window.MusicTransport) {
      MusicTransport.stop();
      MusicTransport.play(sec.start);
    }
  }

  /**
   * Cài đặt tỉ lệ nhịp độ (Tempo Ladder: 0.5, 0.75, 1.0, 1.1)
   */
  function setTempoRatio(ratio) {
    _currentRatio = Math.max(0.4, Math.min(1.5, ratio));
    const targetBpm = Math.round(_baseBpm * _currentRatio);

    if (window.MusicTransport) {
      MusicTransport.setBpm(targetBpm);
    }
    if (window.LearnStore) {
      LearnStore.set('bpm', targetBpm);
      LearnStore.set('speed', _currentRatio);
    }

    const bpmEl = document.getElementById('learn-bpm-value');
    if (bpmEl) bpmEl.textContent = targetBpm;

    // Cập nhật trạng thái active của nút ladder
    document.querySelectorAll('.btn-tempo-ladder').forEach(btn => {
      const r = parseFloat(btn.dataset.ratio);
      btn.classList.toggle('active', Math.abs(r - _currentRatio) < 0.02);
    });
  }

  /**
   * Bật/tắt tự động tăng tốc (Auto-advance ladder)
   */
  function toggleAutoAdvance(enabled) {
    _autoAdvanceEnabled = !!enabled;
    _loopsCompleted = 0;
    const btn = document.getElementById('btn-learn-auto-tempo');
    if (btn) btn.classList.toggle('active', _autoAdvanceEnabled);
  }

  /**
   * Lắng nghe chu kỳ lặp để kích hoạt auto-advance
   */
  function _bindEvents() {
    if (!window.MusicTransport) return;

    MusicTransport.onMeasure(({ measure }) => {
      if (!_loopEnabled || !_autoAdvanceEnabled) return;

      // Khi chạm đến ô nhịp cuối của vòng lặp và quay lại
      if (measure === _startMeasure && _lastCompletedMeasure === _endMeasure) {
        _loopsCompleted++;
        console.log(`[LoopController] Loop completed: ${_loopsCompleted}/${_loopsTargetForAdvance}`);

        if (_loopsCompleted >= _loopsTargetForAdvance) {
          _loopsCompleted = 0;
          // Tự động tăng 5 BPM nếu chưa vượt 110%
          const currentBpm = MusicTransport.getBpm();
          const maxBpm = Math.round(_baseBpm * 1.15);
          if (currentBpm < maxBpm) {
            const nextBpm = Math.min(maxBpm, currentBpm + 5);
            MusicTransport.setBpm(nextBpm);
            const bpmEl = document.getElementById('learn-bpm-value');
            if (bpmEl) bpmEl.textContent = nextBpm;
            console.log('[LoopController] Auto-advanced BPM to:', nextBpm);
          }
        }
      }
      _lastCompletedMeasure = measure;
    });
  }

  function _updateLoopUI() {
    const loopBtn = document.getElementById('btn-learn-loop-toggle');
    if (loopBtn) {
      loopBtn.classList.toggle('active', _loopEnabled);
      loopBtn.textContent = _loopEnabled ? '🔁 Lặp: BẬT' : '🔁 Lặp: TẮT';
    }
  }

  function getSections() {
    return [..._sections];
  }

  function isLooping() {
    return _loopEnabled;
  }

  return {
    initForSong,
    setLoop,
    selectSection,
    setTempoRatio,
    toggleAutoAdvance,
    getSections,
    isLooping
  };
})();

if (typeof window !== 'undefined') {
  window.LoopController = LoopController;
}
