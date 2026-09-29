/**
 * assets/js/drums-lens.js
 *
 * Drums Lens — Chế độ chuyên biệt cho Nhạc công Trống (Ticket L4-5):
 * 1. Giao diện sân khấu tối giản: Không nốt nhạc, không hợp âm rườm rà.
 * 2. BPM cực đại dễ nhìn từ xa với nút TAP Tempo và chỉnh nhanh.
 * 3. Đèn nhịp LED (Beat Flasher) nhấp nháy trực quan theo phách thời gian thực.
 * 4. Bộ đếm ô nhịp (Measure Counter) tự động đếm theo từng bar hoặc chuyển thủ công.
 * 5. Bản đồ bài hát (Song Sections Map / Roadmap): Dạo · K1 · ĐK · K2 · ĐK · Kết.
 */
const DrumsLens = (() => {
  'use strict';

  let _isActive = false;
  let _bpm = 80;
  let _beatsPerMeasure = 4;
  let _currentBeat = 0;
  let _currentMeasure = 1;
  let _totalMeasures = 64;
  let _currentSectionId = null;
  let _sections = [];

  const DEFAULT_SECTIONS = [
    { id: 'sec-intro',   name: 'Dạo',   type: 'intro',  start_measure: 1,  end_measure: 8,  color: '#8b5cf6' },
    { id: 'sec-verse1',  name: 'K1',    type: 'verse',  start_measure: 9,  end_measure: 24, color: '#3b82f6' },
    { id: 'sec-chorus1', name: 'ĐK',    type: 'chorus', start_measure: 25, end_measure: 40, color: '#f59e0b' },
    { id: 'sec-verse2',  name: 'K2',    type: 'verse',  start_measure: 41, end_measure: 56, color: '#3b82f6' },
    { id: 'sec-chorus2', name: 'ĐK',    type: 'chorus', start_measure: 57, end_measure: 72, color: '#f59e0b' },
    { id: 'sec-outro',   name: 'Kết',   type: 'outro',  start_measure: 73, end_measure: 80, color: '#ef4444' }
  ];

  function isActive() {
    return _isActive;
  }

  function getBpm() {
    return _bpm;
  }

  function setBpm(val) {
    const num = parseInt(val, 10);
    if (!isNaN(num) && num >= 30 && num <= 260) {
      _bpm = num;
      if (window.Metronome?.setBpm) {
        window.Metronome.setBpm(_bpm);
      }
      _updateBpmDisplay();
    }
    return _bpm;
  }

  function getCurrentMeasure() {
    return _currentMeasure;
  }

  function setMeasure(measure) {
    const m = parseInt(measure, 10);
    if (!isNaN(m) && m >= 1) {
      _currentMeasure = Math.min(m, _totalMeasures);
      _updateMeasureDisplay();
      _syncActiveSectionWithMeasure();
    }
    return _currentMeasure;
  }

  function getTotalMeasures() {
    return _totalMeasures;
  }

  function setTotalMeasures(total) {
    const t = parseInt(total, 10);
    if (!isNaN(t) && t >= 1) {
      _totalMeasures = t;
      _updateMeasureDisplay();
    }
  }

  function resetMeasure() {
    return setMeasure(1);
  }

  function nextMeasure() {
    return setMeasure(_currentMeasure + 1);
  }

  function prevMeasure() {
    return setMeasure(Math.max(1, _currentMeasure - 1));
  }

  function getSections() {
    return _sections.length > 0 ? _sections : DEFAULT_SECTIONS;
  }

  function getCurrentSection() {
    const list = getSections();
    return list.find(s => s.id === _currentSectionId) || list[0];
  }

  function jumpToSection(secId) {
    const list = getSections();
    const sec = list.find(s => s.id === secId);
    if (sec) {
      _currentSectionId = sec.id;
      setMeasure(sec.start_measure);
      _updateSectionUI();
      if (window.ArrangementEngine?.jumpToSection) {
        window.ArrangementEngine.jumpToSection(sec.id);
      }
    }
  }

  function _loadSongSections() {
    if (window.ArrangementEngine?.getSections) {
      const arr = window.ArrangementEngine.getSections();
      if (arr && arr.length > 0) {
        _sections = arr.map(s => ({ ...s }));
        const lastSec = _sections[_sections.length - 1];
        if (lastSec && lastSec.end_measure > _totalMeasures) {
          _totalMeasures = lastSec.end_measure;
        }
        return;
      }
    }
    _sections = DEFAULT_SECTIONS.map(s => ({ ...s }));
  }

  function _syncActiveSectionWithMeasure() {
    const list = getSections();
    const matched = list.find(s => _currentMeasure >= s.start_measure && _currentMeasure <= s.end_measure);
    if (matched && matched.id !== _currentSectionId) {
      _currentSectionId = matched.id;
      _updateSectionUI();
    }
  }

  /* ═══ GIAO DIỆN DOM & RENDER ═══ */
  function _createDrumsStageContainer() {
    if (typeof document === 'undefined') return null;
    let container = document.getElementById('drums-stage-container');
    if (container) return container;

    container = document.createElement('div');
    container.id = 'drums-stage-container';
    container.className = 'drums-stage-container hidden';
    container.setAttribute('aria-label', 'Sân khấu Trống — Góc nhìn nhạc cụ');

    const sheetArea = document.getElementById('sheet-area') || document.getElementById('main-container') || document.body;
    if (sheetArea && sheetArea.parentNode) {
      sheetArea.parentNode.insertBefore(container, sheetArea);
    } else {
      document.body.appendChild(container);
    }

    return container;
  }

  function _renderStageDom() {
    if (typeof document === 'undefined') return;
    const container = _createDrumsStageContainer();
    if (!container) return;

    const curSong = window.Store?.get?.('currentSong') || {};
    const title = curSong.title || document.getElementById('song-title')?.textContent?.trim() || 'Bài hát';
    const key = curSong.defaultKey || document.getElementById('song-key')?.textContent?.trim() || '--';

    container.innerHTML = `
      <div class="drums-stage-inner">
        <!-- 1. Header: Tên bài & Tông & Nhịp -->
        <header class="drums-stage-header">
          <div class="drums-song-meta">
            <span class="drums-badge">🥁 Trống Lens</span>
            <h2 class="drums-song-title">${window.SafeHtml ? window.SafeHtml.escape(title) : title}</h2>
            <span class="drums-song-key">Tông: <strong>${window.SafeHtml ? window.SafeHtml.escape(key) : key}</strong></span>
          </div>
          <button type="button" id="btn-drums-exit" class="btn-drums-exit" title="Thoát chế độ Trống">✕ Đóng</button>
        </header>

        <!-- 2. Trung tâm: BPM & Đèn nhịp LED -->
        <section class="drums-bpm-flasher-card" aria-label="BPM và Đèn nhịp">
          <div class="drums-bpm-display">
            <span class="drums-bpm-number" id="drums-bpm-val">${_bpm}</span>
            <span class="drums-bpm-label">BPM</span>
          </div>

          <div class="drums-bpm-actions">
            <button type="button" class="btn-drums-bpm" data-delta="-5" title="Giảm 5 BPM">-5</button>
            <button type="button" class="btn-drums-bpm" data-delta="-1" title="Giảm 1 BPM">-1</button>
            <button type="button" id="btn-drums-tap" class="btn-drums-bpm drums-tap-btn" title="Chạm lấy nhịp TAP Tempo">TAP</button>
            <button type="button" class="btn-drums-bpm" data-delta="+1" title="Tăng 1 BPM">+1</button>
            <button type="button" class="btn-drums-bpm" data-delta="+5" title="Tăng 5 BPM">+5</button>
          </div>

          <!-- Đèn nhịp LED nhấp nháy trực quan -->
          <div class="drums-led-flasher" id="drums-led-container" aria-label="Đèn nhịp LED">
            <!-- Sinh động theo số phách -->
          </div>

          <!-- Nút Play/Stop Metronome lớn -->
          <div class="drums-play-action">
            <button type="button" id="btn-drums-toggle-metronome" class="btn-drums-play">
              <span id="drums-play-icon">▶</span>
              <span id="drums-play-text">Bật nhịp</span>
            </button>
          </div>
        </section>

        <!-- 3. Bộ đếm ô nhịp (Measure Counter) -->
        <section class="drums-measure-card" aria-label="Bộ đếm ô nhịp">
          <div class="drums-measure-header">
            <span class="drums-sec-title">⏱ ĐẾM Ô NHỊP (MEASURE)</span>
          </div>
          <div class="drums-measure-counter">
            <button type="button" id="btn-drums-prev-measure" class="btn-measure-nav" title="Ô trước">◀</button>
            <div class="drums-measure-box">
              <span class="drums-measure-current" id="drums-current-measure">${_currentMeasure}</span>
              <span class="drums-measure-sep">/</span>
              <span class="drums-measure-total" id="drums-total-measure">${_totalMeasures}</span>
            </div>
            <button type="button" id="btn-drums-next-measure" class="btn-measure-nav" title="Ô sau">▶</button>
            <button type="button" id="btn-drums-reset-measure" class="btn-measure-reset" title="Về đầu bài (Ô 1)">↺ Về ô 1</button>
          </div>
        </section>

        <!-- 4. Bản đồ bài hát (Song Sections Map / Roadmap) -->
        <section class="drums-roadmap-card" aria-label="Bản đồ bài hát">
          <div class="drums-roadmap-header">
            <span class="drums-sec-title">🗺 BẢN ĐỒ BÀI HÁT (ROADMAP)</span>
          </div>
          <div class="drums-roadmap-chips" id="drums-sections-list">
            <!-- Thẻ phân đoạn -->
          </div>
        </section>
      </div>
    `;

    _bindEvents(container);
    _renderLedDots();
    _updateSectionUI();
    _updateBpmDisplay();
    _updateMeasureDisplay();
  }

  function _renderLedDots() {
    if (typeof document === 'undefined') return;
    const container = document.getElementById('drums-led-container');
    if (!container) return;

    container.innerHTML = '';
    for (let i = 0; i < _beatsPerMeasure; i++) {
      const dot = document.createElement('div');
      dot.className = `drums-led-dot ${i === 0 ? 'accent' : ''}`;
      dot.dataset.beat = String(i);
      dot.innerHTML = `<span class="led-num">${i + 1}</span>`;
      container.appendChild(dot);
    }
  }

  function _bindEvents(container) {
    if (!container) return;

    // Thoát Drums Lens
    container.querySelector('#btn-drums-exit')?.addEventListener('click', () => {
      deactivate();
      if (window.StageLens?.setRole) {
        window.StageLens.setRole('guitar');
      }
    });

    // Chỉnh BPM ±1, ±5
    container.querySelectorAll('.btn-drums-bpm[data-delta]').forEach(btn => {
      btn.addEventListener('click', () => {
        const delta = parseInt(btn.dataset.delta, 10);
        setBpm(_bpm + delta);
      });
    });

    // TAP Tempo
    container.querySelector('#btn-drums-tap')?.addEventListener('click', () => {
      if (window.TapTempo?.tap) {
        const res = window.TapTempo.tap();
        if (res?.tapCount >= 2 && res.bpm) {
          setBpm(res.bpm);
        }
      } else {
        const now = Date.now();
        if (!_bindEvents._taps) _bindEvents._taps = [];
        _bindEvents._taps.push(now);
        if (_bindEvents._taps.length > 4) _bindEvents._taps.shift();
        if (_bindEvents._taps.length >= 2) {
          const diffs = [];
          for (let i = 1; i < _bindEvents._taps.length; i++) {
            diffs.push(_bindEvents._taps[i] - _bindEvents._taps[i - 1]);
          }
          const avg = diffs.reduce((a, b) => a + b, 0) / diffs.length;
          if (avg > 200 && avg < 2000) {
            setBpm(Math.round(60000 / avg));
          }
        }
      }
    });

    // Bật/tắt Metronome
    container.querySelector('#btn-drums-toggle-metronome')?.addEventListener('click', () => {
      if (window.Metronome?.togglePlay) {
        window.Metronome.togglePlay();
      }
    });

    // Điều hướng ô nhịp
    container.querySelector('#btn-drums-prev-measure')?.addEventListener('click', () => prevMeasure());
    container.querySelector('#btn-drums-next-measure')?.addEventListener('click', () => nextMeasure());
    container.querySelector('#btn-drums-reset-measure')?.addEventListener('click', () => resetMeasure());
  }

  function _updateBpmDisplay() {
    if (typeof document === 'undefined') return;
    const bpmEl = document.getElementById('drums-bpm-val');
    if (bpmEl) bpmEl.textContent = String(_bpm);
  }

  function _updateMeasureDisplay() {
    if (typeof document === 'undefined') return;
    const curEl = document.getElementById('drums-current-measure');
    if (curEl) curEl.textContent = String(_currentMeasure);
    const totEl = document.getElementById('drums-total-measure');
    if (totEl) totEl.textContent = String(_totalMeasures);
  }

  function _updateSectionUI() {
    if (typeof document === 'undefined') return;
    const list = document.getElementById('drums-sections-list');
    if (!list) return;

    list.innerHTML = '';
    const sections = getSections();

    sections.forEach(sec => {
      const chip = document.createElement('button');
      chip.type = 'button';
      const isCur = sec.id === _currentSectionId;
      chip.className = `drums-section-chip ${isCur ? 'active' : ''}`;
      chip.dataset.sectionId = sec.id;
      chip.style.setProperty('--sec-color', sec.color || '#3b82f6');

      chip.innerHTML = `
        <span class="drums-sec-name">${window.SafeHtml ? window.SafeHtml.escape(sec.name) : sec.name}</span>
        <span class="drums-sec-range">m.${sec.start_measure}-${sec.end_measure}</span>
      `;

      chip.addEventListener('click', () => {
        jumpToSection(sec.id);
      });

      list.appendChild(chip);
    });
  }

  function flashBeat(beatIndex, isAccent) {
    _currentBeat = beatIndex;
    // Khi đến phách đầu (accent beat 0), tự động tăng ô nhịp nếu đang kích hoạt
    if (beatIndex === 0 && _isActive && _currentMeasure < _totalMeasures) {
      _currentMeasure++;
      _updateMeasureDisplay();
      _syncActiveSectionWithMeasure();
    }

    if (typeof document === 'undefined') return;
    const dots = document.querySelectorAll('#drums-led-container .drums-led-dot');
    if (dots.length === 0) return;

    dots.forEach((dot, idx) => {
      if (idx === beatIndex) {
        dot.classList.add('flash');
        setTimeout(() => dot.classList.remove('flash'), 120);
      } else {
        dot.classList.remove('flash');
      }
    });
  }

  function activate() {
    _isActive = true;
    _loadSongSections();

    if (window.Metronome?.getBpm) {
      _bpm = window.Metronome.getBpm() || _bpm;
    }
    if (window.Metronome?.getBeatsPerMeasure) {
      _beatsPerMeasure = window.Metronome.getBeatsPerMeasure() || 4;
    }

    if (typeof document !== 'undefined') {
      _renderStageDom();

      const container = document.getElementById('drums-stage-container');
      if (container) container.classList.remove('hidden');

      // Ẩn nốt nhạc & ẩn hợp âm theo đúng chuẩn Ticket L4-5
      const osmdContainer = document.getElementById('osmd-container');
      if (osmdContainer) osmdContainer.style.display = 'none';

      const chordCanvas = document.getElementById('chord-canvas');
      if (chordCanvas) chordCanvas.style.display = 'none';

      const lyricContainer = document.getElementById('lyric-view-container');
      if (lyricContainer) lyricContainer.classList.add('hidden');
    }

    if (typeof EventBus !== 'undefined') {
      EventBus.emit('drums:activated', { bpm: _bpm, measure: _currentMeasure });
    }
  }

  function deactivate() {
    _isActive = false;
    if (typeof document !== 'undefined') {
      const container = document.getElementById('drums-stage-container');
      if (container) container.classList.add('hidden');

      // Phục hồi khuông nhạc / hợp âm
      const osmdContainer = document.getElementById('osmd-container');
      if (osmdContainer) osmdContainer.style.display = 'block';

      const chordCanvas = document.getElementById('chord-canvas');
      if (chordCanvas) chordCanvas.style.display = 'block';
    }

    if (typeof EventBus !== 'undefined') {
      EventBus.emit('drums:deactivated');
    }
  }

  function init() {
    if (typeof EventBus !== 'undefined') {
      EventBus.on('metronome:tick', (data) => {
        if (_isActive && data && typeof data.beat === 'number') {
          flashBeat(data.beat, !!data.isAccent);
        }
      });

      EventBus.on('song:loaded', () => {
        if (window.Metronome?.getBpm) {
          _bpm = window.Metronome.getBpm() || _bpm;
        }
        _currentMeasure = 1;
        _loadSongSections();
        if (_isActive) {
          _renderStageDom();
        }
      });

      EventBus.on('role:changed', (data) => {
        if (data?.role === 'drums') {
          activate();
        } else if (_isActive) {
          deactivate();
        }
      });
    }
  }

  return {
    init,
    activate,
    deactivate,
    isActive,
    getBpm,
    setBpm,
    getCurrentMeasure,
    setMeasure,
    getTotalMeasures,
    setTotalMeasures,
    resetMeasure,
    nextMeasure,
    prevMeasure,
    getSections,
    getCurrentSection,
    jumpToSection,
    flashBeat
  };
})();

window.DrumsLens = DrumsLens;
