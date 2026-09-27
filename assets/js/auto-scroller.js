/**
 * assets/js/auto-scroller.js — Cuộn bản nhạc mượt mà theo tempo BPM và cursor OSMD
 * 
 * Tính năng chính (Ticket L3-8 & MobileSheets UX):
 * 1. Tự cuộn theo BPM × số ô nhịp:
 *    - Ưu tiên BPM mục setlist nếu đang trong chương trình lễ.
 *    - Ưu tiên Metronome BPM nếu người dùng đã đặt hoặc chỉnh tay.
 *    - Fallback thông minh bỏ qua BPM 104 giả (Ticket L0-15).
 * 2. Hỗ trợ Tạm Dừng (Pause) và Tiếp Tục (Resume) mượt mà không làm mất vị trí cursor.
 * 3. Cho phép chỉnh tay BPM và hệ số tốc độ (1x, 2x, 3x, 4x...).
 */
const AutoScroller = (() => {
  'use strict';

  let _rAF = null;
  let _isScrolling = false;
  let _isPaused = false;
  let _speedMultiplier = 1; // 1 = đúng tốc độ, 2 = gấp đôi...
  let _manualBpm = null;

  // Trạng thái giữ nhịp khi pause/resume
  let _curDuration = 0.25;
  let _timeAccumulator = 0;
  let _lastTime = 0;
  let _scrollTarget = null;

  function init() {
    const btn    = document.getElementById('btn-auto-scroll');
    const select = document.getElementById('scroll-speed');
    btn?.addEventListener('click', toggle);
    select?.addEventListener('change', e => { 
      _speedMultiplier = parseFloat(e.target.value) || 1; 
    });
    // Đọc giá trị mặc định từ select
    if (select) _speedMultiplier = parseFloat(select.value) || 1;

    // Gắn sự kiện lắng nghe bài hát
    if (typeof EventBus !== 'undefined') {
      EventBus.on('song:loaded', () => {
        stop();
        _manualBpm = null;
        _isPaused = false;
        const curSetlist = window.SetlistUI?.getCurrentSetlist?.();
        const curIdx     = window.SetlistUI?.getCurrentIndex?.();
        const setlistItem = (curSetlist && curIdx >= 0) ? curSetlist.items?.[curIdx] : null;
        if (setlistItem && setlistItem.bpm) {
          _manualBpm = parseInt(setlistItem.bpm, 10);
        }
      });

      EventBus.on('song:cleared', () => {
        stop();
        _manualBpm = null;
        _isPaused = false;
      });
    }
  }

  function toggle() {
    if (_isScrolling && !_isPaused) {
      pause();
    } else if (_isScrolling && _isPaused) {
      resume();
    } else {
      play();
    }
  }

  function _detectBpm(osmd) {
    if (_manualBpm && _manualBpm > 0) return _manualBpm;

    // 1. Ưu tiên BPM của mục setlist hiện hành
    const curSetlist = window.SetlistUI?.getCurrentSetlist?.();
    const curIdx     = window.SetlistUI?.getCurrentIndex?.();
    const setlistItem = (curSetlist && curIdx >= 0) ? curSetlist.items?.[curIdx] : null;
    if (setlistItem && setlistItem.bpm) {
      const b = parseInt(setlistItem.bpm, 10);
      if (b > 0) return b;
    }

    // 2. Ưu tiên BPM từ Metronome nếu có
    if (window.Metronome?.getBpm) {
      const mb = window.Metronome.getBpm();
      if (mb && mb > 0 && mb !== 104) return mb;
    }

    // 3. Ưu tiên SongInfoBar nếu có tempo thật (!== 104)
    const songTempo = window.SongInfoBar?.getSongInfo?.()?.tempo;
    if (songTempo && parseInt(songTempo, 10) !== 104) {
      return parseInt(songTempo, 10);
    }

    // 4. Lấy từ OSMD tempo expressions
    try {
      const measures = osmd?.Sheet?.SourceMeasures;
      if (measures?.length) {
        for (const meas of measures) {
          const exps = meas.staffLinkedExpressions?.[0]?.[0]?.TempoExpressions;
          if (exps?.length) {
            const detected = exps[0].InstantaneousTempo?.TempoInBpm;
            if (detected && detected !== 104) return detected;
          }
        }
      }
    } catch(e) {}

    return window.Metronome?.getBpm?.() || 80;
  }

  function _getDuration(iter) {
    let minLen = 999;
    if (iter?.CurrentVoiceEntries) {
      for (const ve of iter.CurrentVoiceEntries) {
        const l = ve.Notes?.[0]?.Length?.RealValue;
        if (l != null && l < minLen) minLen = l;
      }
    }
    return minLen === 999 ? 0.25 : minLen;
  }

  function play() {
    const wrapper = document.querySelector('.sheet-viewer-wrapper');
    const osmd    = window.OSMDRenderer?.getInstance?.();
    if (!wrapper || !osmd) return;

    if (window.SheetAudioPlayer) window.SheetAudioPlayer.stop();

    _isScrolling = true;
    _isPaused = false;
    _updateUI();

    if (osmd.cursor) {
      osmd.cursor.show();
      osmd.cursor.reset();
    }

    _timeAccumulator = 0;
    _lastTime        = performance.now();
    _curDuration     = _getDuration(osmd.cursor?.iterator);
    _scrollTarget    = null;

    _startLoop();
  }

  function pause() {
    if (!_isScrolling || _isPaused) return;
    _isPaused = true;
    if (_rAF) cancelAnimationFrame(_rAF);
    _rAF = null;
    _updateUI();
  }

  function resume() {
    if (!_isScrolling || !_isPaused) return;
    _isPaused = false;
    _lastTime = performance.now();
    _updateUI();
    _startLoop();
  }

  function _startLoop() {
    const wrapper = document.querySelector('.sheet-viewer-wrapper');
    const osmd    = window.OSMDRenderer?.getInstance?.();
    if (!wrapper || !osmd) return;

    const bpm        = _detectBpm(osmd);
    const msPerWhole = (60000 / bpm) * 4;

    function loop(time) {
      if (!_isScrolling || _isPaused) return;

      const dt = time - _lastTime;
      _lastTime = time;

      const waitMs = (_curDuration * msPerWhole) / _speedMultiplier;
      _timeAccumulator += dt;

      if (_timeAccumulator >= waitMs) {
        _timeAccumulator -= waitMs;
        if (osmd.cursor) {
          osmd.cursor.next();

          if (osmd.cursor.iterator.EndReached || osmd.cursor.isHidden) {
            stop();
            return;
          }
          _curDuration = _getDuration(osmd.cursor.iterator);

          // Sprint E1 — Measure progress
          try {
            const curMeasure    = osmd.cursor.iterator.CurrentMeasureIndex ?? 0;
            const totalMeasures = osmd.Sheet?.SourceMeasures?.length ?? 1;
            window.App?.updateMeasureProgress?.(curMeasure + 1, totalMeasures);
          } catch(e) {}

          // Tính scroll target mới
          if (osmd.cursor.cursorElement) {
            const cRect   = osmd.cursor.cursorElement.getBoundingClientRect();
            const vRect   = wrapper.getBoundingClientRect();
            const targetY = vRect.height * 0.3; // cursor ở 30% từ trên xuống
            const diff    = cRect.top - vRect.top - targetY;
            if (Math.abs(diff) > 20) {
              _scrollTarget = wrapper.scrollTop + diff;
            }
          }
        }
      }

      // Smooth lerp scroll mỗi frame
      if (_scrollTarget !== null) {
        const cur  = wrapper.scrollTop;
        const next = cur + (_scrollTarget - cur) * 0.12;
        wrapper.scrollTop = next;
        if (Math.abs(_scrollTarget - next) < 1) _scrollTarget = null;
      }

      _rAF = requestAnimationFrame(loop);
    }

    if (_rAF) cancelAnimationFrame(_rAF);
    _rAF = requestAnimationFrame(loop);
  }

  function stop() {
    _isScrolling = false;
    _isPaused = false;
    if (_rAF) cancelAnimationFrame(_rAF);
    _rAF = null;
    const osmd = window.OSMDRenderer?.getInstance?.();
    if (osmd?.cursor) osmd.cursor.hide();
    _updateUI();
  }

  function setBpm(bpm) {
    const val = parseInt(bpm, 10);
    if (val > 0) {
      _manualBpm = val;
    }
  }

  function getBpm() {
    return _manualBpm || _detectBpm(window.OSMDRenderer?.getInstance?.());
  }

  function setSpeed(multiplier) {
    const m = parseFloat(multiplier);
    if (m > 0) {
      _speedMultiplier = m;
      const select = document.getElementById('scroll-speed');
      if (select) select.value = String(m);
    }
  }

  function getSpeed() {
    return _speedMultiplier;
  }

  function _updateUI() {
    const btn = document.getElementById('btn-auto-scroll');
    if (!btn) return;

    if (_isScrolling && !_isPaused) {
      btn.classList.add('active');
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><rect x="6" y="6" width="12" height="12"></rect></svg> Tạm Dừng`;
      btn.style.color = 'var(--danger, #ef4444)';
      btn.title = 'Tạm dừng tự động cuộn (Space / Click)';
    } else if (_isScrolling && _isPaused) {
      btn.classList.add('active');
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> Tiếp Tục`;
      btn.style.color = 'var(--warning, #f59e0b)';
      btn.title = 'Tiếp tục tự động cuộn (Space / Click)';
    } else {
      btn.classList.remove('active');
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><path d="M12 5v14M19 12l-7 7-7-7"/></svg> Cuộn`;
      btn.style.color = '';
      btn.title = 'Tự động cuộn bản nhạc theo tempo (Phím Space)';
    }
  }

  return {
    init,
    play,
    start: play,
    stop,
    pause,
    resume,
    toggle,
    setBpm,
    getBpm,
    setSpeed,
    getSpeed,
    isScrolling: () => _isScrolling && !_isPaused,
    isPaused: () => _isPaused,
    isActive: () => _isScrolling
  };
})();

window.AutoScroller = AutoScroller;
