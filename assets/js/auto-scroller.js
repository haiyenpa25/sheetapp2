/**
 * auto-scroller.js — Cuộn bản nhạc mượt mà theo cursor OSMD
 */
const AutoScroller = (() => {
  'use strict';

  let _rAF = null;
  let _isScrolling = false;
  let _speedMultiplier = 1; // 1 = đúng tốc độ, 2 = gấp đôi...

  const BASE_SPEED_PPF = 0.5;

  function init() {
    const btn    = document.getElementById('btn-auto-scroll');
    const select = document.getElementById('scroll-speed');
    btn?.addEventListener('click', toggle);
    select?.addEventListener('change', e => { _speedMultiplier = parseFloat(e.target.value); });
    // Đọc giá trị mặc định từ select
    if (select) _speedMultiplier = parseFloat(select.value) || 1;
  }

  function toggle() { if (_isScrolling) stop(); else play(); }

  function _detectBpm(osmd) {
    try {
      const measures = osmd.Sheet?.SourceMeasures;  // capital Sheet (OSMD API)
      if (!measures?.length) return 80;
      for (const meas of measures) {
        const exps = meas.staffLinkedExpressions?.[0]?.[0]?.TempoExpressions;
        if (exps?.length) return exps[0].InstantaneousTempo?.TempoInBpm ?? 80;
      }
    } catch(e) {}
    return 80;
  }

  function _getDuration(iter) {
    let minLen = 999;
    if (iter.CurrentVoiceEntries) {
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
    _updateUI();

    osmd.cursor.show();
    osmd.cursor.reset();

    const bpm           = _detectBpm(osmd);
    const msPerWhole    = (60000 / bpm) * 4;
    let timeAccumulator = 0;
    let lastTime        = performance.now();
    let curDuration     = _getDuration(osmd.cursor.iterator);
    let scrollTarget    = null; // target scrollTop for smooth scroll

    function loop(time) {
      if (!_isScrolling) return;

      const dt = time - lastTime;
      lastTime  = time;

      const waitMs = (curDuration * msPerWhole) / _speedMultiplier;
      timeAccumulator += dt;

      if (timeAccumulator >= waitMs) {
        timeAccumulator -= waitMs;
        osmd.cursor.next();

        if (osmd.cursor.iterator.EndReached || osmd.cursor.isHidden) { stop(); return; }
        curDuration = _getDuration(osmd.cursor.iterator);

        // Sprint E1 — Measure progress
        try {
          const curMeasure   = osmd.cursor.iterator.CurrentMeasureIndex ?? 0;
          const totalMeasures = osmd.Sheet?.SourceMeasures?.length ?? 1;  // capital Sheet
          window.App?.updateMeasureProgress?.(curMeasure + 1, totalMeasures);
        } catch(e) {}

        // Tính scroll target mới
        if (osmd.cursor.cursorElement) {
          const cRect   = osmd.cursor.cursorElement.getBoundingClientRect();
          const vRect   = wrapper.getBoundingClientRect();
          const targetY = vRect.height * 0.3; // cursor ở 30% từ trên
          const diff    = cRect.top - vRect.top - targetY;
          if (Math.abs(diff) > 20) {
            scrollTarget = wrapper.scrollTop + diff;
          }
        }
      }

      // Smooth lerp scroll mỗi frame
      if (scrollTarget !== null) {
        const cur  = wrapper.scrollTop;
        const next = cur + (scrollTarget - cur) * 0.12;
        wrapper.scrollTop = next;
        if (Math.abs(scrollTarget - next) < 1) scrollTarget = null;
      }

      _rAF = requestAnimationFrame(loop);
    }

    _rAF = requestAnimationFrame(loop);
  }

  function stop() {
    _isScrolling = false;
    if (_rAF) cancelAnimationFrame(_rAF);
    _rAF = null;
    const osmd = window.OSMDRenderer?.getInstance?.();
    if (osmd?.cursor) osmd.cursor.hide();
    _updateUI();
  }

  function _updateUI() {
    const btn = document.getElementById('btn-auto-scroll');
    if (!btn) return;
    if (_isScrolling) {
      btn.classList.add('active');
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><rect x="6" y="6" width="12" height="12"></rect></svg> Dừng Cuộn`;
      btn.style.color = 'var(--danger)';
    } else {
      btn.classList.remove('active');
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><path d="M12 5v14M19 12l-7 7-7-7"/></svg> Cuộn`;
      btn.style.color = '';
    }
  }

  return { init, play, stop };
})();

window.AutoScroller = AutoScroller;
