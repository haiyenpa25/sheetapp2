/**
 * metronome.js — Máy gõ nhịp (Metronome) chuyên nghiệp sử dụng Web Audio API
 * Tích hợp Floating Glassmorphic Panel, Visual Beat Flashing, Tap Tempo, Sound Presets và Volume Control.
 */
const Metronome = (() => {
  'use strict';

  let _audioContext = null;
  let _isPlaying = false;
  let _bpm = 80;
  let _beatsPerMeasure = 4;
  let _currentBeat = 0;
  let _nextNoteTime = 0.0;     // Thời điểm phát phách tiếp theo (giây)
  let _lookahead = 25.0;       // Tần suất gọi bộ lập lịch (mili-giây)
  let _scheduleAheadTime = 0.1; // Khoảng thời gian lập lịch trước (giây)
  let _timerID = null;

  // Cấu hình âm thanh & âm lượng mặc định
  let _volume = 60; // 0 - 100
  let _soundType = 'woodblock'; // 'woodblock' | 'cowbell' | 'beep'
  let _tapTimes = [];

  function init() {
    _bindEvents();
    
    // Đọc nhịp/BPM khi bài hát mới load
    EventBus.on('song:loaded', () => {
      stop();
      const info = SongInfoBar?.getSongInfo?.();
      if (info) {
        _bpm = parseInt(info.tempo) || 80;
        _beatsPerMeasure = parseInt(info.timeBeats) || 4;
      } else {
        _bpm = 80;
        _beatsPerMeasure = 4;
      }
      _updateBpmUI();
      _renderBeatDots();
    });

    EventBus.on('song:cleared', () => {
      stop();
      _beatsPerMeasure = 4;
      _bpm = 80;
      _updateBpmUI();
      _renderBeatDots();
    });

    // Tạo các đèn nháy ban đầu
    _renderBeatDots();
  }

  function _bindEvents() {
    // Toggler ở Audio Settings Panel
    document.getElementById('btn-metronome')?.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePanel();
    });

    // Toggler chính trên Thanh công cụ (Toolbar)
    document.getElementById('btn-toolbar-metronome')?.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePanel();
    });

    // Nút đóng ở Floating Panel
    document.getElementById('btn-close-metronome')?.addEventListener('click', () => {
      hidePanel();
    });

    // Nút Play ở Floating Panel
    document.getElementById('btn-metronome-toggle-play')?.addEventListener('click', () => {
      togglePlay();
    });

    // Nút TAP Tempo
    document.getElementById('btn-metronome-tap')?.addEventListener('click', () => {
      _handleTap();
    });

    // Tăng / giảm BPM lẻ
    document.getElementById('btn-metronome-dec')?.addEventListener('click', () => {
      setBpm(_bpm - 1);
    });
    document.getElementById('btn-metronome-inc')?.addEventListener('click', () => {
      setBpm(_bpm + 1);
    });

    // BPM Slider
    const bpmSlider = document.getElementById('metronome-bpm-slider');
    if (bpmSlider) {
      bpmSlider.addEventListener('input', (e) => {
        setBpm(parseInt(e.target.value));
      });
    }

    // Volume Slider
    const volSlider = document.getElementById('metronome-volume-slider');
    if (volSlider) {
      volSlider.addEventListener('input', (e) => {
        _volume = parseInt(e.target.value);
      });
    }

    // Sound Select
    const soundSelect = document.getElementById('metronome-sound-select');
    if (soundSelect) {
      soundSelect.addEventListener('change', (e) => {
        _soundType = e.target.value;
      });
    }
  }

  function _initAudio() {
    if (_audioContext) return;
    _audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }

  /* ── 3 BỘ PHÁT ÂM THANH SYNTHESIZER ── */
  function _scheduleNote(beatNumber, time) {
    if (!_audioContext) return;

    // Tính toán Gain dựa trên volume
    const targetGain = (_volume / 100) * 0.8;
    if (targetGain <= 0.001) return;

    // Hẹn giờ nháy đèn LED chuẩn xác cùng lúc với tiếng gõ âm thanh
    const delayMs = Math.max(0, (time - _audioContext.currentTime) * 1000);
    setTimeout(() => {
      if (_isPlaying) {
        _flashBeatUI(beatNumber);
      }
    }, delayMs);

    if (_soundType === 'woodblock') {
      // 1. MÕ GỖ (Woodblock): Sắc bén, trầm ấm tự nhiên
      const osc = _audioContext.createOscillator();
      const gainNode = _audioContext.createGain();

      osc.connect(gainNode);
      gainNode.connect(_audioContext.destination);

      osc.type = 'sine';
      osc.frequency.value = (beatNumber === 0) ? 1000 : 750;

      gainNode.gain.setValueAtTime(targetGain, time);
      // Decay cực nhanh tạo âm gỗ mõ đanh
      gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.04);

      osc.start(time);
      osc.stop(time + 0.05);
    } 
    else if (_soundType === 'cowbell') {
      // 2. CHUÔNG BÒ (Cowbell): Tông kim loại đặc trưng, cực kỳ lý tưởng cho Trống
      const osc1 = _audioContext.createOscillator();
      const osc2 = _audioContext.createOscillator();
      const filter = _audioContext.createBiquadFilter();
      const gainNode = _audioContext.createGain();

      osc1.type = 'square';
      osc2.type = 'square';

      // Phối hợp 2 tần số vuông để giả lập âm chuông kim loại đục đặc trưng (chuẩn Roland 808)
      if (beatNumber === 0) {
        osc1.frequency.value = 580;
        osc2.frequency.value = 850;
      } else {
        osc1.frequency.value = 540;
        osc2.frequency.value = 800;
      }

      filter.type = 'bandpass';
      filter.frequency.value = 1000;

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(_audioContext.destination);

      gainNode.gain.setValueAtTime(targetGain, time);
      gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.09);

      osc1.start(time);
      osc2.start(time);
      osc1.stop(time + 0.1);
      osc2.stop(time + 0.1);
    } 
    else {
      // 3. DIGITAL BEEP (Bíp điện tử)
      const osc = _audioContext.createOscillator();
      const gainNode = _audioContext.createGain();

      osc.connect(gainNode);
      gainNode.connect(_audioContext.destination);

      osc.type = 'sine';
      osc.frequency.value = (beatNumber === 0) ? 880 : 440;

      gainNode.gain.setValueAtTime(targetGain, time);
      gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.08);

      osc.start(time);
      osc.stop(time + 0.1);
    }
  }

  function _nextNote() {
    const secondsPerBeat = 60.0 / _bpm;
    _nextNoteTime += secondsPerBeat;

    _currentBeat = (_currentBeat + 1) % _beatsPerMeasure;
  }

  function _scheduler() {
    while (_nextNoteTime < _audioContext.currentTime + _scheduleAheadTime) {
      _scheduleNote(_currentBeat, _nextNoteTime);
      _nextNote();
    }
    _timerID = setTimeout(_scheduler, _lookahead);
  }

  function play() {
    _initAudio();
    if (_isPlaying) return;

    // Kích hoạt AudioContext trên các thiết bị Safari iOS / iPad
    if (_audioContext.state === 'suspended') {
      _audioContext.resume();
    }

    _isPlaying = true;
    _currentBeat = 0;
    _nextNoteTime = _audioContext.currentTime + 0.05;
    
    _scheduler();
    _updateUI();
  }

  function stop() {
    if (!_isPlaying) return;
    _isPlaying = false;
    clearTimeout(_timerID);
    _updateUI();
  }

  function togglePlay() {
    if (_isPlaying) {
      stop();
    } else {
      play();
    }
  }

  /* ── TAP TEMPO ALGORITHM ── */
  function _handleTap() {
    const tapBtn = document.getElementById('btn-metronome-tap');
    if (tapBtn) {
      tapBtn.classList.add('tapped');
      setTimeout(() => tapBtn.classList.remove('tapped'), 100);
    }

    const now = performance.now();
    // Nếu cú TAP cách cú trước quá 2 giây, coi như bắt đầu chuỗi TAP mới
    if (_tapTimes.length > 0 && (now - _tapTimes[_tapTimes.length - 1] > 2000)) {
      _tapTimes = [];
    }

    _tapTimes.push(now);

    if (_tapTimes.length >= 2) {
      let totalDiff = 0;
      for (let i = 1; i < _tapTimes.length; i++) {
        totalDiff += (_tapTimes[i] - _tapTimes[i - 1]);
      }
      const avgInterval = totalDiff / (_tapTimes.length - 1);
      const calculatedBpm = Math.round(60000 / avgInterval);

      if (calculatedBpm >= 30 && calculatedBpm <= 250) {
        setBpm(calculatedBpm);
      }
    }
  }

  function setBpm(val) {
    const num = parseInt(val);
    if (num >= 30 && num <= 250) {
      _bpm = num;
      _updateBpmUI();
    }
  }

  /* ── UI RENDER & UPDATES ── */
  function _updateBpmUI() {
    const bpmVal = document.getElementById('metronome-bpm-val');
    const bpmSlider = document.getElementById('metronome-bpm-slider');
    
    if (bpmVal) bpmVal.textContent = _bpm;
    if (bpmSlider) bpmSlider.value = _bpm;
  }

  function _renderBeatDots() {
    const container = document.getElementById('metronome-beats-container');
    if (!container) return;
    
    container.innerHTML = '';
    for (let i = 0; i < _beatsPerMeasure; i++) {
      const dot = document.createElement('span');
      dot.className = `beat-dot beat-${i + 1}`;
      container.appendChild(dot);
    }
  }

  function _flashBeatUI(beatNumber) {
    const container = document.getElementById('metronome-beats-container');
    if (!container) return;
    
    const dots = container.querySelectorAll('.beat-dot');
    const activeDot = dots[beatNumber];
    if (activeDot) {
      activeDot.classList.add('flash');
      // Tự động tắt đèn sau 120ms để tạo cảm giác nhấp nháy tự nhiên
      setTimeout(() => {
        activeDot.classList.remove('flash');
      }, 120);
    }
  }

  function _updateUI() {
    // 1. Sync button nổi trong panel
    const panelPlayBtn = document.getElementById('btn-metronome-toggle-play');
    if (panelPlayBtn) {
      panelPlayBtn.classList.toggle('active', _isPlaying);
      panelPlayBtn.innerHTML = _isPlaying ? '⏸ Dừng nhịp' : '🔊 Bật nhịp';
    }

    // 2. Sync button phụ trên thanh công cụ Audio Settings Panel
    const toolbarBtn = document.getElementById('btn-metronome');
    if (toolbarBtn) {
      toolbarBtn.classList.toggle('active', _isPlaying);
      toolbarBtn.innerHTML = _isPlaying ? '⏸ Dừng' : '🔊 Bật';
      toolbarBtn.style.color = _isPlaying ? 'var(--danger)' : '';
    }

    // 3. Sync button chính trên thanh công cụ lớn
    const mainToolbarBtn = document.getElementById('btn-toolbar-metronome');
    if (mainToolbarBtn) {
      mainToolbarBtn.classList.toggle('active', _isPlaying);
      mainToolbarBtn.style.color = _isPlaying ? 'var(--danger)' : '';
      if (_isPlaying) {
        mainToolbarBtn.classList.add('btn-active');
      } else {
        mainToolbarBtn.classList.remove('btn-active');
      }
    }
  }

  /* ── PANEL VISIBILITY ── */
  function showPanel() {
    const panel = document.getElementById('metronome-panel');
    if (panel) {
      panel.classList.remove('hidden');
    }
  }

  function hidePanel() {
    const panel = document.getElementById('metronome-panel');
    if (panel) {
      panel.classList.add('hidden');
    }
  }

  function togglePanel() {
    const panel = document.getElementById('metronome-panel');
    if (panel) {
      const isHidden = panel.classList.contains('hidden');
      if (isHidden) {
        showPanel();
      } else {
        hidePanel();
      }
    }
  }

  function getBpm() { return _bpm; }
  function getBeatsPerMeasure() { return _beatsPerMeasure; }

  /** Đặt cả BPM + nhịp cùng lúc (dùng khi play setlist item) */
  function setBpmAndBeats(bpm, beats) {
    if (bpm && bpm >= 30 && bpm <= 250) _bpm = bpm;
    if (beats && beats >= 1 && beats <= 12) _beatsPerMeasure = beats;
    _updateBpmUI();
    _renderBeatDots();
  }

  return { init, play, stop, togglePlay, setBpm, getBpm, getBeatsPerMeasure, setBpmAndBeats, showPanel, hidePanel, togglePanel };
})();

window.Metronome = Metronome;
