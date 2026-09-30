/**
 * metronome.js — Máy gõ nhịp (Metronome) chuyên nghiệp dạng Mini-Bar gắn đáy (Ticket L1-10)
 * 
 * Tính năng chính:
 * 1. Mini-bar gắn ở cạnh đáy màn hình, không còn thẻ nổi che đè bản nhạc.
 * 2. Visual Beat LED Flasher (đèn nháy báo phách nhịp), hiển thị nháy chuẩn xác.
 * 3. Hỗ trợ nhịp 6/8: 2 phách chấm (compound_2) hoặc 6 phách nhấn mạnh đúng phách 1 và phách 4 (compound_6).
 * 4. Tap Tempo tích hợp, Count-in đếm nhịp chuẩn bị.
 * 5. Tự động điều chỉnh khoảng đệm (has-metronome-bar) để vùng nhạc không bị che.
 * 6. Tuân thủ Core Rule 4 (bảo toàn BPM Setlist) và Ticket L0-15 (bỏ qua 104 giả).
 */
const Metronome = (() => {
  'use strict';

  let _audioContext = null;
  let _isPlaying = false;
  let _bpm = 80;
  let _beatsPerMeasure = 4;
  let _meterMode = 'standard'; // 'standard' | 'compound_2' | 'compound_6'
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
    
    // Đọc nhịp/BPM khi bài hát mới load (bảo toàn BPM Setlist theo Core Rule 4)
    EventBus.on('song:loaded', () => {
      stop();
      const curSetlist = window.SetlistUI?.getCurrentSetlist?.();
      const curIdx = window.SetlistUI?.getCurrentIndex?.();
      const setlistItem = (curSetlist && curIdx >= 0) ? curSetlist.items?.[curIdx] : null;

      if (setlistItem && setlistItem.bpm) {
        _bpm = parseInt(setlistItem.bpm);
        _applyBeatsFromNumber(parseInt(setlistItem.beats_per_measure) || 4);
      } else {
        const info = SongInfoBar?.getSongInfo?.();
        const infoTempo = info?.tempo ? parseInt(info.tempo) : 0;
        const timeBeats = parseInt(info?.timeBeats) || 4;

        if (info && infoTempo && infoTempo !== 104) {
          _bpm = infoTempo;
        } else {
          _bpm = 80; // Ticket L0-15: coi 104 là chưa có tempo, mặc định metronome 80
        }
        _applyBeatsFromNumber(timeBeats);
      }
      _updateBpmUI();
      _renderBeatDots();
    });

    EventBus.on('song:cleared', () => {
      stop();
      _beatsPerMeasure = 4;
      _meterMode = 'standard';
      _bpm = 80;
      _updateBpmUI();
      _renderBeatDots();
    });

    // Tạo các đèn nháy ban đầu
    _renderBeatDots();
  }

  function _applyBeatsFromNumber(beats) {
    if (beats === 6) {
      _beatsPerMeasure = 6;
      _meterMode = 'compound_6';
    } else {
      _beatsPerMeasure = beats > 0 ? beats : 4;
      _meterMode = 'standard';
    }
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

    // Nút đóng ở Mini-bar
    document.getElementById('btn-close-metronome')?.addEventListener('click', () => {
      hidePanel();
    });

    // Nút Play ở Mini-bar
    document.getElementById('btn-metronome-toggle-play')?.addEventListener('click', () => {
      togglePlay();
    });

    // Nút Count-in Đếm Nhịp Chuẩn Bị
    document.getElementById('btn-metronome-count-in')?.addEventListener('click', () => {
      if (window.PerformanceEngine) {
        window.PerformanceEngine.triggerHostCountIn(1);
      } else if (window.CountInEngine) {
        window.CountInEngine.startCountIn({ bpm: _bpm, beats: _beatsPerMeasure });
      }
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

    // BPM Slider nếu có
    const bpmSlider = document.getElementById('metronome-bpm-slider');
    if (bpmSlider) {
      bpmSlider.addEventListener('input', (e) => {
        setBpm(parseInt(e.target.value));
      });
    }

    // Volume Slider nếu có
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

    // Beats Per Measure Select (hỗ trợ 6-dotted và 6 nhấn 1 & 4)
    const beatsSelect = document.getElementById('metronome-beats-select');
    if (beatsSelect) {
      beatsSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        if (val === '6-dotted') {
          _beatsPerMeasure = 2;
          _meterMode = 'compound_2';
        } else if (val === '6') {
          _beatsPerMeasure = 6;
          _meterMode = 'compound_6';
        } else {
          _beatsPerMeasure = parseInt(val, 10) || 4;
          _meterMode = 'standard';
        }
        _updateBpmUI();
        _renderBeatDots();
      });
    }

    // Tempo Presets nếu có
    document.querySelectorAll('.btn-tempo-preset').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const bpm = parseInt(e.currentTarget.dataset.bpm, 10);
        if (bpm) setBpm(bpm);
      });
    });
  }

  function _initAudio() {
    if (_audioContext) return;
    _audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }

  /**
   * Kiểm tra xem phách hiện tại có phải là phách nhấn (accent) không.
   * - Nhịp thường: phách 1 (index 0).
   * - Nhịp 6/8 compound_6: phách 1 (index 0) và phách 4 (index 3).
   */
  function isAccentBeat(beatIndex) {
    if (_beatsPerMeasure === 6 && _meterMode === 'compound_6') {
      return beatIndex === 0 || beatIndex === 3;
    }
    return beatIndex === 0;
  }

  /* ── 3 BỘ PHÁT ÂM THANH SYNTHESIZER ── */
  function _scheduleNote(beatNumber, time) {
    if (!_audioContext) return;

    const baseGain = (_volume / 100) * 0.8;
    if (baseGain <= 0.001) return;

    const isPrimaryAccent = (beatNumber === 0);
    const isSecondaryAccent = (_beatsPerMeasure === 6 && _meterMode === 'compound_6' && beatNumber === 3);

    // Tính toán gain dựa theo phách nhấn
    let gainFactor = 0.55;
    if (isPrimaryAccent) {
      gainFactor = 1.0;
    } else if (isSecondaryAccent) {
      gainFactor = 0.85;
    }
    const targetGain = baseGain * gainFactor;

    // Hẹn giờ nháy đèn LED chuẩn xác cùng lúc với tiếng gõ âm thanh
    const delayMs = Math.max(0, (time - _audioContext.currentTime) * 1000);
    setTimeout(() => {
      if (_isPlaying) {
        _flashBeatUI(beatNumber);
        if (typeof EventBus !== 'undefined') {
          EventBus.emit('metronome:tick', { beat: beatNumber, isAccent: isPrimaryAccent });
        }
      }
    }, delayMs);

    if (_soundType === 'woodblock') {
      // 1. MÕ GỖ (Woodblock)
      const osc = _audioContext.createOscillator();
      const gainNode = _audioContext.createGain();

      osc.connect(gainNode);
      gainNode.connect(_audioContext.destination);

      osc.type = 'sine';
      if (isPrimaryAccent) {
        osc.frequency.value = 1000;
      } else if (isSecondaryAccent) {
        osc.frequency.value = 880;
      } else {
        osc.frequency.value = 700;
      }

      gainNode.gain.setValueAtTime(targetGain, time);
      gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.04);

      osc.start(time);
      osc.stop(time + 0.05);
    } 
    else if (_soundType === 'cowbell') {
      // 2. CHUÔNG BÒ (Cowbell)
      const osc1 = _audioContext.createOscillator();
      const osc2 = _audioContext.createOscillator();
      const filter = _audioContext.createBiquadFilter();
      const gainNode = _audioContext.createGain();

      osc1.type = 'square';
      osc2.type = 'square';

      if (isPrimaryAccent) {
        osc1.frequency.value = 580;
        osc2.frequency.value = 850;
      } else if (isSecondaryAccent) {
        osc1.frequency.value = 560;
        osc2.frequency.value = 820;
      } else {
        osc1.frequency.value = 520;
        osc2.frequency.value = 760;
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
      if (isPrimaryAccent) {
        osc.frequency.value = 1000;
      } else if (isSecondaryAccent) {
        osc.frequency.value = 880;
      } else {
        osc.frequency.value = 520;
      }

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

    if (window.TapTempo) {
      const res = window.TapTempo.tap();
      if (res.tapCount >= 2) {
        setBpm(res.bpm);
      }
      return;
    }

    const now = performance.now();
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
    const num = parseInt(val, 10);
    if (num >= 30 && num <= 250) {
      _bpm = num;
      _updateBpmUI();
      if (typeof EventBus !== 'undefined') {
        EventBus.emit('metronome:bpm', { bpm: _bpm });
      }
    }
  }

  /* ── UI RENDER & UPDATES ── */
  function _updateBpmUI() {
    const bpmVal = document.getElementById('metronome-bpm-val');
    const bpmSlider = document.getElementById('metronome-bpm-slider');
    const beatsSelect = document.getElementById('metronome-beats-select');
    
    if (bpmVal) bpmVal.textContent = _bpm;
    if (bpmSlider) bpmSlider.value = _bpm;
    if (beatsSelect) {
      if (_meterMode === 'compound_2') {
        beatsSelect.value = '6-dotted';
      } else if (_meterMode === 'compound_6') {
        beatsSelect.value = '6';
      } else {
        beatsSelect.value = String(_beatsPerMeasure);
      }
    }
  }

  function _renderBeatDots() {
    const container = document.getElementById('metronome-beats-container');
    if (!container) return;
    
    container.innerHTML = '';
    for (let i = 0; i < _beatsPerMeasure; i++) {
      const dot = document.createElement('span');
      const isAccent1 = (i === 0);
      const isAccent4 = (_beatsPerMeasure === 6 && _meterMode === 'compound_6' && i === 3);
      const accentClass = isAccent1 ? 'beat-1' : (isAccent4 ? 'beat-4' : '');
      dot.className = `beat-dot beat-${i + 1} ${accentClass}`.trim();
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
      setTimeout(() => {
        activeDot.classList.remove('flash');
      }, 120);
    }
  }

  function _updateUI() {
    // 1. Sync button nổi trong panel / mini-bar
    const panelPlayBtn = document.getElementById('btn-metronome-toggle-play');
    if (panelPlayBtn) {
      panelPlayBtn.classList.toggle('active', _isPlaying);
      panelPlayBtn.innerHTML = _isPlaying ? '⏸ Dừng' : '▶ Nhịp';
    }

    // 2. Sync button phụ trên thanh công cụ Audio Settings Panel
    const toolbarBtn = document.getElementById('btn-metronome');
    if (toolbarBtn) {
      toolbarBtn.classList.toggle('active', _isPlaying);
      toolbarBtn.innerHTML = _isPlaying ? '⏸ Dừng' : '🔊 Bật';
      toolbarBtn.style.color = _isPlaying ? 'var(--danger)' : '';
    }

    // 3. Sync button chính trên thanh công cụ lớn (icon ♩)
    const mainToolbarBtn = document.getElementById('btn-toolbar-metronome');
    if (mainToolbarBtn) {
      mainToolbarBtn.classList.toggle('active', _isPlaying);
      mainToolbarBtn.classList.toggle('btn-active', _isPlaying);
      mainToolbarBtn.style.color = _isPlaying ? 'var(--danger)' : '';
    }
    document.getElementById('btn-toolbar-tempo')?.classList.toggle('metronome-active', _isPlaying);
  }

  /* ── PANEL VISIBILITY & MUSIC AREA COVERAGE ── */
  function showPanel() {
    const panel = document.getElementById('metronome-panel');
    if (panel) {
      panel.classList.remove('hidden');
      document.body.classList.add('has-metronome-bar');
      document.querySelector('.sheet-viewer-wrapper')?.classList.add('has-metronome-bar');
    }
  }

  function hidePanel() {
    const panel = document.getElementById('metronome-panel');
    if (panel) {
      panel.classList.add('hidden');
      document.body.classList.remove('has-metronome-bar');
      document.querySelector('.sheet-viewer-wrapper')?.classList.remove('has-metronome-bar');
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

  /**
   * Kiểm tra xem vùng hiển thị bản nhạc có bị che đè bởi metronome không.
   * Với thiết kế mini-bar gắn cạnh đáy và viewer có margin-bottom tương ứng, luôn trả về false.
   */
  function isMusicAreaCovered() {
    const panel = document.getElementById('metronome-panel');
    const viewer = document.querySelector('.sheet-viewer-wrapper');
    if (!panel || panel.classList.contains('hidden') || !viewer) return false;

    const pRect = panel.getBoundingClientRect();
    const vRect = viewer.getBoundingClientRect();
    return pRect.top < vRect.bottom - 2;
  }

  function getBpm() { return _bpm; }
  function getBeatsPerMeasure() { return _beatsPerMeasure; }
  function getMeterMode() { return _meterMode; }

  function setMeterMode(mode) {
    if (mode === 'compound_2') {
      _meterMode = 'compound_2';
      _beatsPerMeasure = 2;
    } else if (mode === 'compound_6') {
      _meterMode = 'compound_6';
      _beatsPerMeasure = 6;
    } else {
      _meterMode = 'standard';
    }
    _updateBpmUI();
    _renderBeatDots();
  }

  /** Đặt cả BPM + nhịp cùng lúc (dùng khi play setlist item) */
  function setBpmAndBeats(bpm, beats) {
    if (bpm && bpm >= 30 && bpm <= 250) _bpm = bpm;
    if (beats) {
      _applyBeatsFromNumber(beats);
    }
    _updateBpmUI();
    _renderBeatDots();
    if (typeof EventBus !== 'undefined') {
      EventBus.emit('metronome:bpm', { bpm: _bpm });
    }
  }

  function setBeatsPerMeasure(beats) {
    if (beats && beats >= 1 && beats <= 12) {
      _applyBeatsFromNumber(beats);
      _updateBpmUI();
      _renderBeatDots();
    }
  }

  return {
    init,
    play,
    stop,
    togglePlay,
    setBpm,
    getBpm,
    getBeatsPerMeasure,
    setBeatsPerMeasure,
    setBpmAndBeats,
    getMeterMode,
    setMeterMode,
    isAccentBeat,
    isMusicAreaCovered,
    showPanel,
    hidePanel,
    togglePanel
  };

})();

window.Metronome = Metronome;
