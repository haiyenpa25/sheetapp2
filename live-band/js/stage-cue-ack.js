/**
 * live-band/js/stage-cue-ack.js
 * Báo "đã nhận" lệnh sân khấu (cue): nhạc công chạm nút trên banner → Ca trưởng thấy "Đã nhận X/Y".
 * - Máy nhạc công: onCue(cue) hiện nút "✓ Đã nhận" trên banner; chạm → POST live_sync&action=ack.
 * - Máy Ca trưởng: watch(cueId) hỏi live_sync&action=acks vài giây một lần và ghi đếm vào #cue-ack-status.
 *
 * Phụ thuộc: ApiService.liveSync. Public API: { init, onCue, watch }
 */
const StageCueAck = (() => {
  'use strict';

  const POLL_INTERVAL_MS = 1500;
  const WATCH_MAX_MS = 15000;
  const ACKED_LABEL = '✓ Đã báo nhận';
  const ACK_LABEL = '✓ Đã nhận';
  const ACK_BANNER_MS = 8000;
  const ACKED_BANNER_MS = 1200;

  let _getRoom = () => '';
  let _getClientId = () => '';
  let _currentCueId = '';
  let _watchTimer = null;

  function init({ getRoom, getClientId }) {
    _getRoom = getRoom || _getRoom;
    _getClientId = getClientId || _getClientId;
    document.getElementById('btn-cue-ack')?.addEventListener('click', _sendAck);
  }

  /** Máy nhạc công nhận lệnh mới: hiện nút báo nhận (lệnh không có mã thì bỏ qua). */
  function onCue(cue) {
    const btn = document.getElementById('btn-cue-ack');
    _currentCueId = cue?.cueId ? String(cue.cueId) : '';
    if (!btn) return;
    btn.classList.toggle('hidden', !_currentCueId);
    btn.disabled = false;
    btn.textContent = ACK_LABEL;
    // Banner lệnh thường tự tắt sau ~3 giây: giữ lâu hơn để kịp chạm "Đã nhận".
    if (_currentCueId) window.StageRehearsal?.showCueBanner?.(cue.text, cue.icon || '⚡', ACK_BANNER_MS);
  }

  async function _sendAck() {
    const btn = document.getElementById('btn-cue-ack');
    if (!_currentCueId || !btn) return;
    btn.disabled = true;
    try {
      await window.ApiService.liveSync.ack(_getRoom(), _getClientId(), _currentCueId);
      btn.textContent = ACKED_LABEL;
      const text = document.getElementById('cue-banner-text')?.textContent || '';
      window.StageRehearsal?.showCueBanner?.(text, document.getElementById('cue-banner-icon')?.textContent || '⚡', ACKED_BANNER_MS);
    } catch (e) {
      btn.disabled = false; // mạng lỗi: cho chạm lại
    }
  }

  /** Máy Ca trưởng: theo dõi số người đã nhận lệnh $cueId trong vài giây đầu. */
  function watch(cueId) {
    const status = document.getElementById('cue-ack-status');
    if (!status || !cueId) return;
    clearInterval(_watchTimer);
    const startedAt = Date.now();
    const tick = async () => {
      try {
        const res = await window.ApiService.liveSync.acks(_getRoom(), cueId);
        if (res?.success) {
          status.textContent = `Đã nhận ${res.acked}/${res.total}`;
          status.classList.toggle('all-acked', res.total > 0 && res.acked >= res.total);
          if (res.total > 0 && res.acked >= res.total) clearInterval(_watchTimer);
        }
      } catch (e) { /* bỏ qua một nhịp */ }
      if (Date.now() - startedAt > WATCH_MAX_MS) clearInterval(_watchTimer);
    };
    status.textContent = 'Đã nhận 0/…';
    status.classList.remove('all-acked');
    _watchTimer = setInterval(tick, POLL_INTERVAL_MS);
    tick();
  }

  return { init, onCue, watch };
})();

window.StageCueAck = StageCueAck;
