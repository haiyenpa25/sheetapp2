/**
 * assets/js/vendor/pitchy-mpm.js
 * McLeod Pitch Method (MPM) Real-Time Vocal Pitch Detector (ianprime0509/pitchy pattern, MIT)
 * Phục vụ chấm điểm cao độ giọng hát 4 bè SATB & Tuner trong /learn/
 */
(function (global) {
  'use strict';

  const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const DEFAULT_CLARITY_THRESHOLD = 0.85;
  const MIN_RMS = 0.008;

  let _micStream = null;
  let _audioCtx  = null;
  let _analyser  = null;
  let _rafId     = 0;

  /** Chuyển tần số (Hz) sang thông tin nốt MIDI, tên nốt và độ lệch Cents */
  function frequencyToNote(freq, a4 = 440) {
    if (!freq || freq <= 0 || !Number.isFinite(freq)) return null;
    const exactMidi = 69 + 12 * Math.log2(freq / a4);
    const midi      = Math.round(exactMidi);
    const cents     = Math.round((exactMidi - midi) * 100);
    const noteClass = ((midi % 12) + 12) % 12;
    const octave    = Math.floor(midi / 12) - 1;
    const noteName  = NOTE_NAMES[noteClass] + octave;
    return { frequency: Math.round(freq * 100) / 100, midi, noteName, cents };
  }

  /**
   * Thuật toán McLeod Pitch Method (NSDF + Parabolic Interpolation)
   * @param {Float32Array|number[]} buffer Mẫu âm thanh miền thời gian
   * @param {number} sampleRate Tần số lấy mẫu (VD: 44100 hoặc 48000)
   * @returns {{ frequency: number, clarity: number, midi: number, noteName: string, cents: number } | null}
   */
  function detectPitch(buffer, sampleRate = 44100) {
    if (!buffer || buffer.length < 64 || sampleRate <= 0) return null;
    const n = buffer.length;

    // 1. Kiểm tra năng lượng tín hiệu (RMS) để lọc nhiễu nền
    let sumSq = 0;
    for (let i = 0; i < n; i++) sumSq += buffer[i] * buffer[i];
    const rms = Math.sqrt(sumSq / n);
    if (rms < MIN_RMS) return null;

    // Giới hạn khoảng tau ứng với dải giọng hát & nhạc cụ (65 Hz .. 1200 Hz)
    const minTau = Math.max(2, Math.floor(sampleRate / 1200));
    const maxTau = Math.min(Math.floor(n / 2), Math.ceil(sampleRate / 65));
    if (maxTau <= minTau) return null;

    // 2. Tính hàm Normalized Square Difference Function (NSDF)
    const nsdf = new Float32Array(maxTau + 1);
    for (let tau = 0; tau <= maxTau; tau++) {
      let acf = 0;
      let div = 0;
      const limit = n - tau;
      for (let i = 0; i < limit; i++) {
        const x1 = buffer[i];
        const x2 = buffer[i + tau];
        acf += x1 * x2;
        div += x1 * x1 + x2 * x2;
      }
      nsdf[tau] = div > 0 ? (2 * acf) / div : 0;
    }

    // 3. Tìm các cực đại dương sau điểm cắt 0 đầu tiên (Key Maximums)
    const maxPositions = [];
    let pos = minTau;
    while (pos < maxTau && nsdf[pos] > 0) pos++;
    while (pos < maxTau && nsdf[pos] <= 0) pos++;

    let curMaxPos = 0;
    let overallMax = -1;
    while (pos < maxTau) {
      if (nsdf[pos] > 0) {
        if (curMaxPos === 0 || nsdf[pos] > nsdf[curMaxPos]) {
          curMaxPos = pos;
        }
      } else if (curMaxPos > 0) {
        maxPositions.push(curMaxPos);
        if (nsdf[curMaxPos] > overallMax) overallMax = nsdf[curMaxPos];
        curMaxPos = 0;
      }
      pos++;
    }
    if (curMaxPos > 0) {
      maxPositions.push(curMaxPos);
      if (nsdf[curMaxPos] > overallMax) overallMax = nsdf[curMaxPos];
    }
    if (maxPositions.length === 0 || overallMax <= 0) return null;

    // 4. Chọn cực đại đầu tiên vượt ngưỡng k * overallMax (k = 0.93 theo McLeod)
    const threshold = 0.93 * overallMax;
    let chosenTau = maxPositions[0];
    for (let i = 0; i < maxPositions.length; i++) {
      const t = maxPositions[i];
      if (nsdf[t] >= threshold) {
        chosenTau = t;
        break;
      }
    }

    // 5. Nội suy Parabol quanh chosenTau để đạt độ chính xác dưới 1 mẫu
    let refinedTau = chosenTau;
    let clarity = nsdf[chosenTau];
    if (chosenTau > 0 && chosenTau < maxTau) {
      const y1 = nsdf[chosenTau - 1];
      const y2 = nsdf[chosenTau];
      const y3 = nsdf[chosenTau + 1];
      const denom = 2 * y2 - y1 - y3;
      if (Math.abs(denom) > 1e-9) {
        const delta = (y3 - y1) / (2 * denom);
        refinedTau = chosenTau + delta;
        clarity = Math.min(1, y2 + 0.25 * (y3 - y1) * delta);
      }
    }

    if (clarity < DEFAULT_CLARITY_THRESHOLD || refinedTau <= 0) return null;
    const freq = sampleRate / refinedTau;
    const noteInfo = frequencyToNote(freq);
    if (!noteInfo) return null;

    return {
      frequency: noteInfo.frequency,
      clarity: Math.round(clarity * 1000) / 1000,
      midi: noteInfo.midi,
      noteName: noteInfo.noteName,
      cents: noteInfo.cents,
    };
  }

  /** Bắt đầu thu micro và gọi onPitch(result) theo thời gian thực */
  async function startMic(onPitch, fftSize = 2048) {
    stopMic();
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Trình duyệt không hỗ trợ Microphone (getUserMedia)');
    }
    _micStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false }
    });
    const Ctx = window.AudioContext || window.webkitAudioContext;
    _audioCtx = new Ctx();
    if (_audioCtx.state === 'suspended') await _audioCtx.resume().catch(() => {});

    const src = _audioCtx.createMediaStreamSource(_micStream);
    _analyser = _audioCtx.createAnalyser();
    _analyser.fftSize = fftSize;
    src.connect(_analyser);

    const buf = new Float32Array(_analyser.fftSize);
    const loop = () => {
      if (!_analyser || !_audioCtx) return;
      _analyser.getFloatTimeDomainData(buf);
      const res = detectPitch(buf, _audioCtx.sampleRate);
      if (typeof onPitch === 'function') onPitch(res);
      _rafId = requestAnimationFrame(loop);
    };
    _rafId = requestAnimationFrame(loop);
    return true;
  }

  /** Dừng thu micro và giải phóng tài nguyên */
  function stopMic() {
    if (_rafId) { cancelAnimationFrame(_rafId); _rafId = 0; }
    if (_micStream) {
      _micStream.getTracks().forEach(t => t.stop());
      _micStream = null;
    }
    if (_audioCtx && _audioCtx.state !== 'closed') {
      _audioCtx.close().catch(() => {});
    }
    _audioCtx = null;
    _analyser = null;
  }

  const PitchDetector = { detectPitch, frequencyToNote, startMic, stopMic };
  global.PitchDetector = PitchDetector;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = PitchDetector;
  }
})(typeof window !== 'undefined' ? window : globalThis);
