/**
 * assets/js/performance/transport-clock.js — Synchronized Shared Clock & Offset Calibration
 * 
 * Synchronizes client Web Audio clock with server timeline:
 * - Calculates network Round-Trip Time (RTT) and Clock Offset.
 * - Translates a shared server timestamp `startAt` into local AudioContext `currentTime`.
 */
const TransportClock = (() => {
  'use strict';

  let _clockOffsetSeconds = 0.0;
  let _lastRttMs = 0.0;
  let _isCalibrated = false;

  /**
   * Hiệu chỉnh độ lệch đồng hồ giữa client và server
   * @param {number} clientSendTs - Unix timestamp (ms) khi client gửi request
   * @param {number} serverTs - Unix timestamp (seconds dạng float) trả về từ server
   * @param {number} clientRecvTs - Unix timestamp (ms) khi client nhận response
   */
  function calibrate(clientSendTs, serverTs, clientRecvTs) {
    if (!serverTs) return;
    const rtt = (clientRecvTs - clientSendTs) / 1000.0;
    const clientMid = ((clientSendTs + clientRecvTs) / 2.0) / 1000.0;
    _clockOffsetSeconds = serverTs - clientMid;
    _lastRttMs = rtt * 1000.0;
    _isCalibrated = true;
  }

  /**
   * Lấy thời gian server hiện tại (tính bằng giây)
   */
  function nowServerSeconds() {
    const clientNowSec = Date.now() / 1000.0;
    return clientNowSec + _clockOffsetSeconds;
  }

  /**
   * Chuyển đổi server timestamp `startAt` thành AudioContext `currentTime` trên máy local
   * @param {number} serverStartAt - Server timestamp (seconds)
   * @param {AudioContext} audioCtx - AudioContext của Web Audio API
   */
  function toAudioContextTime(serverStartAt, audioCtx) {
    if (!audioCtx) return 0.0;
    const serverNow = nowServerSeconds();
    const delayFromNow = Math.max(0, serverStartAt - serverNow);
    return audioCtx.currentTime + delayFromNow;
  }

  return {
    calibrate,
    nowServerSeconds,
    toAudioContextTime,
    getOffset: () => _clockOffsetSeconds,
    getRtt: () => _lastRttMs,
    isCalibrated: () => _isCalibrated
  };
})();

window.TransportClock = TransportClock;
