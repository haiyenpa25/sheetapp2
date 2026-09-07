/**
 * learn/learn-app.js — Stage 1-6: /learn Bootstrap & Master Controller
 *
 * Orchestrates toàn bộ /learn Interactive Music Learning Studio:
 * - Song picker & loading (reuse ApiService, OSMDRenderer, song XML)
 * - Chord timeline normalization & dynamic Transpose
 * - Accompaniment PatternEngine & LearnSoundEngine
 * - Looper & Section Practice via LoopController
 * - Practice Session Tracking via PracticeTracker
 * - UI state machine & EventBus wiring
 *
 * Tuân thủ Core Rules:
 * - HD chord set mặc định
 * - Transpose = 0 khi mở bài mới
 * - Không sửa MusicXML gốc, không audio server-side, không per-note HTTP.
 */
const LearnApp = (() => {
  'use strict';

  /* ─── State ──────────────────────────────────────────────────── */
  let _osmd             = null;
  let _xmlDoc           = null;
  let _currentSong      = null;
  let _rawChordData     = [];
  let _currentTranspose = 0; // Luôn bắt đầu = 0 theo Core Rule
  let _songsList        = [];
  let _initialized      = false;

  /* ─── OSMD Setup ─────────────────────────────────────────────── */
  function _initOsmd() {
    const container = document.getElementById('learn-score-container');
    if (!container || !window.opensheetmusicdisplay) return null;

    const osmd = new opensheetmusicdisplay.OpenSheetMusicDisplay(container, {
      autoResize: true,
      backend: 'svg',
      drawTitle: false,
      drawComposer: false,
      drawingParameters: 'compact',
    });
    return osmd;
  }

  /* ─── Song Loading ───────────────────────────────────────────── */
  async function _loadSongs() {
    try {
      const res = await ApiService.songs.list();
      _songsList = res?.songs ?? res?.data ?? [];
      _renderSongList();

      // Auto-select from URL param
      const pending = LearnStore.get('_pendingSongParam');
      if (pending) {
        const song = _songsList.find(s =>
          String(s.id) === String(pending) ||
          s.slug === pending ||
          (s.title || '').toLowerCase().includes(String(pending).toLowerCase())
        );
        if (song) _selectSong(song);
        LearnStore.set('_pendingSongParam', null);
      }
    } catch (e) {
      console.error('[LearnApp] Load songs failed:', e);
      _showError('Không thể tải danh sách bài.');
    }
  }

  function _renderSongList() {
    const list = document.getElementById('learn-song-list');
    if (!list) return;

    list.innerHTML = '';
    _songsList.forEach(song => {
      const item = document.createElement('div');
      item.className  = 'learn-song-item';
      item.dataset.id = song.id;
      item.textContent = song.title ?? `Bài ${song.id}`;
      item.addEventListener('click', () => {
        _selectSong(song);
        document.getElementById('learn-song-picker-panel')?.classList.add('hidden');
      });
      list.appendChild(item);
    });
  }

  async function _selectSong(song) {
    if (!song?.xmlPath) {
      _showError('Bài này chưa có file sheet nhạc.');
      return;
    }

    // Dừng nhạc nếu đang chạy bài cũ
    if (window.MusicTransport && MusicTransport.isPlaying()) {
      MusicTransport.stop();
      if (window.PatternEngine) PatternEngine.stop();
    }

    _currentSong = song;
    _currentTranspose = 0; // Reset Transpose về 0

    const transValEl = document.getElementById('learn-trans-val');
    if (transValEl) transValEl.textContent = '0';

    // Update state
    LearnStore.resetForSong(song.id, song.title);
    LearnStore.set('chordSet', 'HD');
    LearnStore.set('transpose', 0);
    _setUiStatus('preparing');
    _showLoading(`Đang tải "${song.title}"...`);

    // Update song label
    const label = document.getElementById('learn-song-label');
    if (label) label.textContent = song.title;

    try {
      // Fetch XML + chord set concurrently (mặc định HD)
      const chordProfile = LearnStore.get('chordSet') || 'HD';
      const [xmlRes, chordData] = await Promise.all([
        fetch(song.xmlPath),
        _loadChordSet(song.id, chordProfile),
      ]);

      if (!xmlRes.ok) throw new Error(`XML fetch failed: ${xmlRes.status}`);
      const xml = await xmlRes.text();

      // Parse XML
      const parser = new DOMParser();
      _xmlDoc = parser.parseFromString(xml, 'application/xml');
      _rawChordData = chordData || [];

      // Render OSMD
      _hideLoading();
      _showLoading('Đang render sheet nhạc...');
      if (!_osmd) _osmd = _initOsmd();
      if (_osmd) {
        await _osmd.load(xml);
        await _osmd.render();
      }

      // Extract song metadata (BPM, meter)
      _extractSongMeta();

      // Rebuild normalized chord timeline with current transpose
      _rebuildTimeline();

      // Update transport config
      const meta = _getSongMeta();
      MusicTransport.configure({
        bpm:             LearnStore.get('bpm'),
        beatsPerMeasure: meta.beats,
        beatType:        meta.beatType,
        totalMeasures:   meta.totalMeasures,
      });
      MusicTransport.setupTicker();

      // Setup accompaniment engine
      if (window.PatternEngine) {
        PatternEngine.init();
        // Tự động chọn pattern phù hợp với số phách
        _autoSelectPattern(meta.beats, meta.beatType);
      }

      // Khởi tạo Loop Controller cho bài hát
      if (window.LoopController) {
        await LoopController.initForSong(song.id, meta.totalMeasures, LearnStore.get('bpm'));
      }

      // Bắt đầu phiên luyện tập mới
      if (window.PracticeTracker) {
        await PracticeTracker.startSession(song.id, LearnStore.get('mode') || 'piano', LearnStore.get('bpm'));
      }

      // Setup transport callbacks
      _setupTransportCallbacks();

      _hideLoading();
      _setUiStatus('ready');

      // Show initial chord (first in timeline)
      const timeline = LearnStore.get('timeline') || [];
      const firstChord = timeline[0] ?? null;
      const secondChord = timeline[1] ?? null;
      if (window.ChordCard) ChordCard.setChord(firstChord, secondChord);

      EventBus.emit(LEARN_EVENTS.READY, { songId: song.id });

    } catch (e) {
      _hideLoading();
      _setUiStatus('idle');
      console.error('[LearnApp] Load song failed:', e);
      _showError('Lỗi tải bài: ' + e.message);
    }
  }

  function _rebuildTimeline() {
    if (!_xmlDoc || !_rawChordData) return;

    const timeline = ChordTimelineNormalizer.normalize(
      _xmlDoc,
      _rawChordData,
      _currentTranspose
    );
    LearnStore.setTimeline(timeline);
    LearnStore.set('transpose', _currentTranspose);

    const { measure, beat } = MusicTransport.getMeasureBeat();
    const chord = ChordTimelineNormalizer.getChordAt(timeline, measure, beat) || timeline[0] || null;
    const next  = ChordTimelineNormalizer.getNextChord(timeline, chord);
    LearnStore.setCurrentChord(chord, next);

    if (window.ChordCard) ChordCard.setChord(chord, next);
    if (chord) EventBus.emit(LEARN_EVENTS.CHORD_CHANGED, { chord, next });
  }

  function _autoSelectPattern(beats, beatType) {
    const patternSelect = document.getElementById('learn-pattern-select');
    if (!patternSelect || !window.PatternEngine) return;

    let targetPattern = 'piano-bass-chord-4-4-v1';
    if (beats === 3 && beatType === 4) {
      targetPattern = 'piano-waltz-3-4-v1';
    } else if (beats === 6 && beatType === 8) {
      targetPattern = 'piano-worship-6-8-v1';
    }

    patternSelect.value = targetPattern;
    PatternEngine.setPattern(targetPattern);
  }

  async function _loadChordSet(songId, profileName) {
    try {
      const res = await ApiService.chordSets.load(songId, profileName);
      return res?.chords ?? [];
    } catch {
      try {
        const res2 = await ApiService.chordSets.load(songId, 'default');
        return res2?.chords ?? [];
      } catch { return []; }
    }
  }

  /* ─── Song Metadata ──────────────────────────────────────────── */
  function _extractSongMeta() {
    if (!_xmlDoc) return;
    const firstMeasure = _xmlDoc.querySelector('measure');
    if (!firstMeasure) return;

    const beatsEl    = firstMeasure.querySelector('time > beats');
    const beatTypeEl = firstMeasure.querySelector('time > beat-type');
    const tempoEl    = _xmlDoc.querySelector('sound[tempo]');

    if (beatsEl)    LearnStore.set('_beats',    parseInt(beatsEl.textContent, 10));
    if (beatTypeEl) LearnStore.set('_beatType', parseInt(beatTypeEl.textContent, 10));

    if (tempoEl) {
      const songBpm = parseFloat(tempoEl.getAttribute('tempo'));
      if (songBpm > 0) {
        LearnStore.set('bpm', songBpm);
        const bpmLabel = document.getElementById('learn-bpm-value');
        if (bpmLabel) bpmLabel.textContent = Math.round(songBpm);
      }
    }
  }

  function _getSongMeta() {
    return {
      beats:         LearnStore.get('_beats') ?? 4,
      beatType:      LearnStore.get('_beatType') ?? 4,
      totalMeasures: _xmlDoc
        ? (_xmlDoc.querySelectorAll('part > measure').length)
        : 100,
    };
  }

  /* ─── Transport Callbacks ────────────────────────────────────── */
  function _setupTransportCallbacks() {
    MusicTransport.onMeasure(({ measure }) => {
      const timeline = LearnStore.get('timeline') || [];
      const chord    = ChordTimelineNormalizer.getChordAt(timeline, measure, 1);
      const next     = ChordTimelineNormalizer.getNextChord(timeline, chord);

      LearnStore.setCurrentChord(chord, next);
      LearnStore.setCurrentPosition(measure, 1);

      if (window.ChordCard) ChordCard.setChord(chord, next);

      if (chord) {
        EventBus.emit(LEARN_EVENTS.CHORD_CHANGED, { chord, next });
      }

      // Record practice stats
      if (window.PracticeTracker) {
        PracticeTracker.recordMeasure(measure, MusicTransport.getBpm());
      }
    });
  }

  /* ─── UI State Machine ───────────────────────────────────────── */
  function _setUiStatus(status) {
    LearnStore.setUiStatus(status);
    const body = document.querySelector('.learn-page');
    if (body) {
      body.dataset.status = status;
    }
    _updatePlayButton(status);
  }

  function _updatePlayButton(status) {
    const btn = document.getElementById('btn-learn-play');
    if (!btn) return;
    const isPlaying = status === 'playing';
    btn.textContent = isPlaying ? '⏸ Dừng' : '▶ Play';
    btn.classList.toggle('btn-learn-play--active', isPlaying);
  }

  /* ─── Controls Binding ───────────────────────────────────────── */
  function _bindControls() {
    // Play/Pause
    document.getElementById('btn-learn-play')?.addEventListener('click', async () => {
      const status = LearnStore.get('uiStatus');
      if (status === 'idle' || status === 'song_selected') return;

      if (MusicTransport.isPlaying()) {
        MusicTransport.pause();
        if (window.PatternEngine) PatternEngine.pause();
        if (window.PracticeTracker) PracticeTracker.onPlaybackStop();
        _setUiStatus('paused');
      } else {
        await MusicTransport.unlock();
        if (window.LearnSoundEngine) LearnSoundEngine.init();
        if (window.PatternEngine) PatternEngine.start();
        if (window.PracticeTracker) PracticeTracker.onPlaybackStart(MusicTransport.getBpm());
        await MusicTransport.play();
        _setUiStatus('playing');
      }
      LearnStore.savePreferences();
    });

    // Stop
    document.getElementById('btn-learn-stop')?.addEventListener('click', () => {
      MusicTransport.stop();
      if (window.PatternEngine) PatternEngine.stop();
      if (window.PracticeTracker) PracticeTracker.onPlaybackStop();
      _setUiStatus('ready');

      // Reset to first chord
      const timeline = LearnStore.get('timeline') || [];
      if (window.ChordCard) ChordCard.setChord(timeline[0] ?? null, timeline[1] ?? null);
    });

    // BPM decrease
    document.getElementById('btn-learn-bpm-dec')?.addEventListener('click', () => {
      const newBpm = Math.max(20, LearnStore.get('bpm') - 5);
      LearnStore.set('bpm', newBpm);
      MusicTransport.setBpm(newBpm);
      const lbl = document.getElementById('learn-bpm-value');
      if (lbl) lbl.textContent = newBpm;
      LearnStore.savePreferences();
    });

    // BPM increase
    document.getElementById('btn-learn-bpm-inc')?.addEventListener('click', () => {
      const newBpm = Math.min(300, LearnStore.get('bpm') + 5);
      LearnStore.set('bpm', newBpm);
      MusicTransport.setBpm(newBpm);
      const lbl = document.getElementById('learn-bpm-value');
      if (lbl) lbl.textContent = newBpm;
      LearnStore.savePreferences();
    });

    // Transpose Down (-)
    document.getElementById('btn-learn-trans-dec')?.addEventListener('click', () => {
      if (_currentTranspose > -12) {
        _currentTranspose--;
        const valEl = document.getElementById('learn-trans-val');
        if (valEl) valEl.textContent = _currentTranspose > 0 ? `+${_currentTranspose}` : `${_currentTranspose}`;
        _rebuildTimeline();
      }
    });

    // Transpose Up (+)
    document.getElementById('btn-learn-trans-inc')?.addEventListener('click', () => {
      if (_currentTranspose < 12) {
        _currentTranspose++;
        const valEl = document.getElementById('learn-trans-val');
        if (valEl) valEl.textContent = _currentTranspose > 0 ? `+${_currentTranspose}` : `${_currentTranspose}`;
        _rebuildTimeline();
      }
    });

    // Chord Set Profile Select
    document.getElementById('learn-chord-set-select')?.addEventListener('change', async (e) => {
      const profile = e.target.value;
      LearnStore.set('chordSet', profile);
      if (_currentSong) {
        _showLoading(`Đang tải bộ hợp âm ${profile}...`);
        _rawChordData = await _loadChordSet(_currentSong.id, profile);
        _rebuildTimeline();
        _hideLoading();
      }
    });

    // Accompaniment Pattern Select
    document.getElementById('learn-pattern-select')?.addEventListener('change', (e) => {
      if (window.PatternEngine) {
        PatternEngine.setPattern(e.target.value);
      }
    });

    // Accompaniment Toggle (Mute/Unmute)
    document.getElementById('learn-pattern-toggle')?.addEventListener('change', (e) => {
      if (window.PatternEngine) {
        PatternEngine.setEnabled(e.target.checked);
      }
    });

    // Volume Sliders
    document.getElementById('slider-vol-piano')?.addEventListener('input', (e) => {
      if (window.LearnSoundEngine) LearnSoundEngine.setVolume('piano', parseFloat(e.target.value));
    });
    document.getElementById('slider-vol-bass')?.addEventListener('input', (e) => {
      if (window.LearnSoundEngine) LearnSoundEngine.setVolume('bass', parseFloat(e.target.value));
    });

    // Section Selector
    document.getElementById('learn-section-select')?.addEventListener('change', (e) => {
      if (window.LoopController) {
        LoopController.selectSection(e.target.value);
      }
    });

    // Loop Toggle Button
    document.getElementById('btn-learn-loop-toggle')?.addEventListener('click', () => {
      if (window.LoopController) {
        LoopController.setLoop(!LoopController.isLooping());
      }
    });

    // Tempo Ladder Buttons
    document.querySelectorAll('.btn-tempo-ladder[data-ratio]').forEach(btn => {
      btn.addEventListener('click', () => {
        const ratio = parseFloat(btn.dataset.ratio);
        if (window.LoopController) {
          LoopController.setTempoRatio(ratio);
        }
      });
    });

    // Auto-advance Tempo Toggle
    document.getElementById('btn-learn-auto-tempo')?.addEventListener('click', (e) => {
      const btn = e.currentTarget;
      const willEnable = !btn.classList.contains('active');
      if (window.LoopController) {
        LoopController.toggleAutoAdvance(willEnable);
      }
    });

    // Mode selector
    document.querySelectorAll('.btn-learn-mode').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;
        LearnStore.set('mode', mode);
        document.querySelectorAll('.btn-learn-mode').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Nếu chuyển sang Organ, cập nhật pattern tương ứng
        if (mode === 'piano') {
          document.getElementById('learn-pattern-select').value = 'piano-bass-chord-4-4-v1';
          if (window.PatternEngine) PatternEngine.setPattern('piano-bass-chord-4-4-v1');
        }

        EventBus.emit(LEARN_EVENTS.MODE_CHANGED, { mode });
        LearnStore.savePreferences();
      });
    });

    // Song picker open
    document.getElementById('btn-learn-song-picker')?.addEventListener('click', () => {
      document.getElementById('learn-song-picker-panel')?.classList.toggle('hidden');
    });

    // Song search
    document.getElementById('learn-song-search')?.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase();
      document.querySelectorAll('.learn-song-item').forEach(item => {
        const visible = item.textContent.toLowerCase().includes(q);
        item.style.display = visible ? '' : 'none';
      });
    });
  }

  /* ─── UI Helpers ─────────────────────────────────────────────── */
  function _showLoading(msg) {
    const el = document.getElementById('learn-loading');
    if (el) { el.textContent = msg || 'Đang tải...'; el.classList.remove('hidden'); }
  }

  function _hideLoading() {
    const el = document.getElementById('learn-loading');
    if (el) el.classList.add('hidden');
  }

  function _showError(msg) {
    const el = document.getElementById('learn-error');
    if (el) { el.textContent = msg; el.classList.remove('hidden'); }
    setTimeout(() => el?.classList.add('hidden'), 4000);
  }

  /* ─── Init ───────────────────────────────────────────────────── */
  function init() {
    if (_initialized) return;
    _initialized = true;

    // Load saved preferences
    LearnStore.loadPreferences();

    // Mount UI modules
    const chordCardEl  = document.getElementById('learn-chord-card');
    const keyboardEl   = document.getElementById('learn-virtual-keyboard');
    if (chordCardEl  && window.ChordCard)       ChordCard.mount(chordCardEl);
    if (keyboardEl   && window.VirtualKeyboard) VirtualKeyboard.mount(keyboardEl);

    // Bind controls
    _bindControls();

    // Load songs
    _loadSongs();

    // Check URL for song param
    const urlParams = new URLSearchParams(window.location.search);
    const songParam = urlParams.get('song') ?? urlParams.get('id');
    if (songParam) {
      LearnStore.set('_pendingSongParam', songParam);
    }

    // EventBus listeners
    EventBus.on(LEARN_EVENTS.CHORD_CHANGED, ({ chord, next }) => {
      if (window.ChordCard) ChordCard.setChord(chord, next);
    });
  }

  /* ─── Public API ─────────────────────────────────────────────── */
  return { init, selectSong: _selectSong };
})();

// Auto-init when DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => LearnApp.init());
} else {
  LearnApp.init();
}

if (typeof window !== 'undefined') {
  window.LearnApp = LearnApp;
}
