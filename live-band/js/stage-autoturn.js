/**
 * live-band/js/stage-autoturn.js
 * Lật trang tự động theo nhịp (tầng 1): Ca trưởng bật, bản nhạc tự cuộn qua từng ô nhịp theo BPM và số phách mỗi ô.
 * Không nghe nhạc, chỉ đếm giờ — nên chắc chắn và chạy được trên mọi thiết bị. Máy nhạc công đã tự theo vị trí Ca trưởng.
 * Có đồng hồ bù trôi (dùng thời gian thực mỗi nhịp kiểm, không cộng dồn khoảng hẹn giờ) và hỗ trợ vòng lặp A-B.
 *
 * Phụ thuộc: không. Public API: { start, stop, isRunning, beatsPerMeasure }
 */
const StageAutoTurn = (() => {
  'use strict';

  const TICK_MS = 120;
  const SECONDS_PER_MINUTE = 60;
  const COMPOUND_DENOMINATOR = 8;
  const COMPOUND_GROUP = 3;

  let _timer = null;
  let _beats = 0;          // số phách đã trôi kể từ ô bắt đầu (số thực)
  let _lastTickAt = 0;
  let _measure = 1;
  let _startMeasure = 1;
  let _cfg = null;

  /** Số phách "đếm bằng tay" mỗi ô: 6/8 → 2 (hai nhịp ba), còn lại lấy tử số. */
  function beatsPerMeasure(numerator, denominator) {
    const n = Number(numerator) || 4;
    const d = Number(denominator) || 4;
    return (d === COMPOUND_DENOMINATOR && n % COMPOUND_GROUP === 0 && n >= 6) ? n / COMPOUND_GROUP : n;
  }

  function isRunning() { return _timer !== null; }

  /**
   * @param {{getBpm:Function, getBeatsPerMeasure:Function, getTotalMeasures:Function, getLoop:Function,
   *          startMeasure:number, onMeasure:Function, onEnd?:Function}} cfg
   */
  function start(cfg) {
    stop();
    _cfg = cfg;
    _startMeasure = Math.max(1, Number(cfg.startMeasure) || 1);
    _measure = _startMeasure;
    _beats = 0;
    _lastTickAt = performance.now();
    _timer = setInterval(_tick, TICK_MS);
  }

  function stop() {
    if (_timer) clearInterval(_timer);
    _timer = null;
  }

  function _tick() {
    const now = performance.now();
    const bpm = Math.max(1, Number(_cfg.getBpm()) || 80);
    _beats += ((now - _lastTickAt) / 1000) * (bpm / SECONDS_PER_MINUTE);
    _lastTickAt = now;

    const perMeasure = Math.max(1, Number(_cfg.getBeatsPerMeasure()) || 4);
    let next = _startMeasure + Math.floor(_beats / perMeasure);

    const loop = _cfg.getLoop?.();
    if (loop?.active && next > loop.end) {
      _startMeasure = loop.start;
      _beats = 0;
      next = loop.start;
    }

    const total = Number(_cfg.getTotalMeasures?.()) || 0;
    if (total > 0 && next > total) {
      stop();
      _cfg.onEnd?.();
      return;
    }

    if (next !== _measure) {
      _measure = next;
      _cfg.onMeasure(next);
    }
  }

  function _setUi(on) {
    const btn = document.getElementById('btn-host-autoturn');
    if (!btn) return;
    btn.setAttribute('aria-pressed', String(on));
    btn.classList.toggle('active', on);
    btn.textContent = on ? '⏸ Dừng lật trang' : '⏯ Tự lật trang';
  }

  const _notify = (msg) => window.StageRehearsal?.showCueBanner?.(msg, '⏯', 2200);
  const _loopState = () => ({ active: !!window.StageRehearsal?.isLoopActive?.(), ...(window.StageRehearsal?.getLoopRange?.() || {}) });

  /**
   * Bật/tắt từ giao diện Ca trưởng. ctx: { getOsmd, getBpm, getCurrentMeasure, onMeasure }.
   * Nút, vòng lặp A-B và thông báo do module tự xử lý. Trả về true nếu đang chạy sau lệnh.
   */
  function toggle(ctx) {
    if (isRunning()) { stop(); _setUi(false); return false; }
    const measures = ctx.getOsmd()?.Sheet?.SourceMeasures || [];
    if (!measures.length) { _notify('Chưa có bản nhạc để lật trang'); return false; }
    const signature = measures[0].ActiveTimeSignature;
    start({
      getBpm: ctx.getBpm,
      getBeatsPerMeasure: () => beatsPerMeasure(signature?.Numerator, signature?.Denominator),
      getTotalMeasures: () => measures.length,
      getLoop: _loopState,
      startMeasure: ctx.getCurrentMeasure(),
      onMeasure: ctx.onMeasure,
      onEnd: () => { _setUi(false); _notify('Hết bài — đã dừng lật trang tự động'); }
    });
    _setUi(true);
    return true;
  }

  /** Dừng và đưa nút về trạng thái tắt (vd. khi đổi bài). */
  function reset() { stop(); _setUi(false); }

  return { start, stop, isRunning, beatsPerMeasure, toggle, reset };
})();

window.StageAutoTurn = StageAutoTurn;
