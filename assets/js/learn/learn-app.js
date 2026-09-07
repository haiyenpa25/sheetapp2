/**
 * learn/learn-app.js — Stage 1: /learn Bootstrap & App Controller
 *
 * Orchestrates toàn bộ /learn page:
 * - Song picker & loading (reuse ApiService, OSMDRenderer, song XML)
 * - Chord timeline normalization
 * - UI state machine
 * - EventBus wiring
 *
 * KHÔNG chứa business logic — delegate sang modules chuyên biệt.
 * Phụ thuộc: core/ApiService.js, core/EventBus.js, core/Store.js
 *             learn-store.js, learn-interfaces.js
 *             timeline/chord-timeline-normalizer.js
 *             ui/chord-card.js, ui/virtual-keyboard.js
 *             transport/music-transport.js
 */
const LearnApp = (() => {
  'use strict';

  /* ─── State ──────────────────────────────────────────────────── */
  let _osmd      = null;
  let _xmlDoc    = null;
  let _songsList = [];
  let _initialized = false;

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
      item.addEventListener('click', () => _selectSong(song));
      list.appendChild(item);
    });
  }

  async function _selectSong(song) {
    if (!song?.xmlPath) {
      _showError('Bài này chưa có file sheet nhạc.');
      return;
    }

    // Update state
    LearnStore.resetForSong(song.id, song.title);
    LearnStore.set('chordSet', 'HD');
    _setUiStatus('preparing');
    _showLoading(`Đang tải "${song.title}"...`);

    // Update song label
    const label = document.getElementById('learn-song-label');
    if (label) label.textContent = song.title;

    try {
      // Fetch XML + chord set concurrently
      const chordProfile = LearnStore.get('chordSet');
      const [xmlRes, chordData] = await Promise.all([
        fetch(song.xmlPath),
        _loadChordSet(song.id, chordProfile),
      ]);

      if (!xmlRes.ok) throw new Error(`XML fetch failed: ${xmlRes.status}`);
      const xml = await xmlRes.text();

      // Parse XML
      const parser = new DOMParser();
      _xmlDoc = parser.parseFromString(xml, 'application/xml');

      // Render OSMD
      _hideLoading();
      _showLoading('Đang render sheet nhạc...');
      if (!_osmd) _osmd = _initOsmd();
      if (_osmd) {
        await _osmd.load(xml);
        await _osmd.render();
      }

      // Build chord timeline
      const timeline = ChordTimelineNormalizer.normalize(
        _xmlDoc,
        chordData,
        LearnStore.get('bpm') // not transpose here — use store transpose
      );
      LearnStore.setTimeline(timeline);

      // Extract song metadata (BPM, meter)
      _extractSongMeta();

      // Update transport config
      const meta = _getSongMeta();
      MusicTransport.configure({
        bpm:             LearnStore.get('bpm'),
        beatsPerMeasure: meta.beats,
        beatType:        meta.beatType,
        totalMeasures:   meta.totalMeasures,
      });
      MusicTransport.setupTicker();

      // Setup transport callbacks
      _setupTransportCallbacks();

      _hideLoading();
      _setUiStatus('ready');

      // Show initial chord (first in timeline)
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

  async function _loadChordSet(songId, profileName) {
    try {
      // ApiService.chordSets.load returns { name, chords: [{measureIdx, noteIdx, chord}] }
      const res = await ApiService.chordSets.load(songId, profileName);
      return res?.chords ?? [];
    } catch {
      // Fallback to default
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

    // If song has tempo marking and no user-set BPM override
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
    // Position changed — update chord display
    MusicTransport.onMeasure(({ measure }) => {
      const timeline = LearnStore.get('timeline');
      const chord    = ChordTimelineNormalizer.getChordAt(timeline, measure, 1);
      const next     = ChordTimelineNormalizer.getNextChord(timeline, chord);

      LearnStore.setCurrentChord(chord, next);
      LearnStore.setCurrentPosition(measure, 1);

      if (window.ChordCard) ChordCard.setChord(chord, next);

      if (chord) {
        EventBus.emit(LEARN_EVENTS.CHORD_CHANGED, { chord, next });
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
        _setUiStatus('paused');
      } else {
        await MusicTransport.play();
        _setUiStatus('playing');
      }
      LearnStore.savePreferences();
    });

    // Stop
    document.getElementById('btn-learn-stop')?.addEventListener('click', () => {
      MusicTransport.stop();
      _setUiStatus('ready');
      // Reset to first chord
      const timeline = LearnStore.get('timeline');
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

    // Mode selector
    document.querySelectorAll('.btn-learn-mode').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;
        LearnStore.set('mode', mode);
        document.querySelectorAll('.btn-learn-mode').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
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
      // Will load after songs list arrives
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
