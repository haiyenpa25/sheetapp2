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
  let _osmdZoom         = 1.0;
  let _xmlDoc           = null;
  let _currentSong      = null;
  let _rawChordData     = [];
  let _currentTranspose = 0; // Luôn bắt đầu = 0 theo Core Rule
  let _songsList        = [];
  let _initialized      = false;

  /* ─── OSMD Setup & Zoom ───────────────────────────────────────── */
  function _initOsmd() {
    const container = document.getElementById('learn-score-container');
    if (!container || !window.opensheetmusicdisplay) return null;

    const osmd = new opensheetmusicdisplay.OpenSheetMusicDisplay(container, {
      autoResize: true,
      backend: 'svg',
      drawTitle: false,
      drawComposer: false,
      drawCredits: false,
      drawingParameters: 'compact',
      pageFormat: 'Endless',
    });
    return osmd;
  }

  function _setZoom(newZoom) {
    if (!_osmd) return;
    _osmdZoom = Math.max(0.4, Math.min(1.8, Math.round(newZoom * 100) / 100));
    _osmd.zoom = _osmdZoom;
    _osmd.render();
    const zoomLabel = document.getElementById('learn-zoom-val');
    if (zoomLabel) zoomLabel.textContent = `${Math.round(_osmdZoom * 100)}%`;
  }

  function _zoomIn() {
    _setZoom(_osmdZoom + 0.1);
  }

  function _zoomOut() {
    _setZoom(_osmdZoom - 0.1);
  }

  function _resetZoom() {
    _setZoom(1.0);
  }

  function _fitScore() {
    if (!_osmd) return;
    const container = document.getElementById('learn-score-container');
    const scoreSec = document.querySelector('.learn-score-section');
    if (!container || !scoreSec) return;

    const availableHeight = scoreSec.clientHeight - 60;
    const currentHeight = container.scrollHeight || 1600;
    if (availableHeight > 250 && currentHeight > 250) {
      const targetZoom = Math.min(1.0, Math.max(0.55, Math.round((availableHeight / currentHeight) * _osmdZoom * 100) / 100));
      _setZoom(targetZoom);
    }
  }

  function _scrollToMeasure(measure) {
    const scoreSec = document.querySelector('.learn-score-section');
    const container = document.getElementById('learn-score-container');
    if (!scoreSec || !container) return;

    const meta = _getSongMeta();
    const total = Math.max(1, meta.totalMeasures);
    const scrollableH = container.scrollHeight - scoreSec.clientHeight;
    if (scrollableH <= 0) return;

    const progress = Math.max(0, Math.min(1, (measure - 1) / total));
    const targetScrollTop = progress * container.scrollHeight;
    scoreSec.scrollTo({
      top: Math.max(0, targetScrollTop - 40),
      behavior: 'smooth'
    });
  }

  /* ─── Song Loading ───────────────────────────────────────────── */
  async function _loadSongs() {
    try {
      const res = await ApiService.songs.list();
      _songsList = Array.isArray(res) ? res : (res?.songs ?? res?.data ?? []);
      _renderSongList();

      // Auto-select: Priority 1 = URL param, Priority 2 = localStorage, Priority 3 = Default song #90 or first
      let targetSong = null;
      const pending = LearnStore.get('_pendingSongParam');
      if (pending) {
        const pStr = String(pending).trim().toLowerCase();
        targetSong = _songsList.find(s => {
          const idStr = String(s.id || '').toLowerCase();
          const titleStr = String(s.title || '').toLowerCase();
          const numStr = String(s.httlvnId || '').padStart(3, '0');
          return idStr === pStr ||
                 idStr.includes(pStr) ||
                 numStr === pStr ||
                 String(s.httlvnId) === pStr ||
                 titleStr.includes(pStr);
        });
        LearnStore.set('_pendingSongParam', null);
      }

      if (!targetSong) {
        try {
          const lastId = localStorage.getItem('sheetapp_learn_last_song');
          if (lastId) {
            targetSong = _songsList.find(s => s.id === lastId);
          }
        } catch (e) {}
      }

      if (!targetSong && _songsList.length > 0) {
        targetSong = _songsList.find(s => s.id === 'thanh-ca-090' || s.httlvnId === 90) || _songsList[0];
      }

      if (targetSong) {
        _selectSong(targetSong);
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
      const numBadge = song.httlvnId ? `<span class="song-num-badge">#${song.httlvnId}</span>` : '';
      const keyBadge = song.defaultKey ? `<span class="song-key-badge">${song.defaultKey}</span>` : '';
      item.innerHTML = `
        <div class="song-item-content">
          ${numBadge}
          <span class="song-item-title">${song.title ?? `Bài ${song.id}`}</span>
          ${keyBadge}
        </div>
      `;
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

    // Save to localStorage and update browser URL without full reload
    try {
      localStorage.setItem('sheetapp_learn_last_song', song.id);
      const newUrl = new URL(window.location);
      newUrl.searchParams.set('song', song.id);
      window.history.replaceState({}, '', newUrl);
    } catch (e) {}

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

    const metaLabel = document.getElementById('learn-song-meta');
    if (metaLabel) metaLabel.textContent = `Tông gốc: ${song.defaultKey || 'C'} • #${song.httlvnId || song.id}`;

    try {
      // Fetch XML + chord set concurrently (mặc định HD)
      const chordProfile = LearnStore.get('chordSet') || 'HD';
      const xmlUrl = song.xmlPath.startsWith('/') ? song.xmlPath : '/' + song.xmlPath;
      const [xmlRes, chordData] = await Promise.all([
        fetch(xmlUrl),
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
        if (_osmd.cursor) {
          _osmd.cursor.reset();
          _osmd.cursor.hide();
        }
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
    const firstPart = _xmlDoc ? _xmlDoc.querySelector('part') : null;
    const measuresCount = firstPart
      ? firstPart.querySelectorAll('measure').length
      : (_xmlDoc ? _xmlDoc.querySelectorAll('part:first-of-type > measure').length : 16);

    return {
      beats:         LearnStore.get('_beats') ?? 4,
      beatType:      LearnStore.get('_beatType') ?? 4,
      totalMeasures: measuresCount || 16,
    };
  }

  /* ─── SATB Extraction & Helper Methods ───────────────────────── */
  const _PITCH_MAP = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function _pitchToMidi(step, octave, alter = 0) {
    const s = String(step).toUpperCase();
    const semitone = _PITCH_MAP[s] ?? 0;
    const oct = parseInt(octave, 10);
    const alt = parseInt(alter || 0, 10);
    return 12 * (oct + 1) + semitone + alt;
  }

  function _pitchToNoteStr(step, octave, alter = 0) {
    if (!step || !octave) return null;
    let acc = '';
    const a = parseInt(alter || 0, 10);
    if (a === 1) acc = '#';
    else if (a === -1) acc = 'b';
    else if (a === 2) acc = '##';
    else if (a === -2) acc = 'bb';
    return `${step.toUpperCase()}${acc}${octave}`;
  }

  function _groupChordsInMeasure(measureEl) {
    if (!measureEl) return [];
    const notesByTime = new Map();
    let curTime = 0;
    let lastStartTime = 0;

    for (const child of Array.from(measureEl.children)) {
      const tag = child.tagName.toLowerCase();
      if (tag === 'note') {
        const isChord = child.querySelector('chord') !== null;
        const dur = parseInt(child.querySelector('duration')?.textContent || '0', 10);
        let noteTime = curTime;
        if (isChord) {
          noteTime = lastStartTime;
        } else {
          lastStartTime = curTime;
          curTime += dur;
        }
        if (!notesByTime.has(noteTime)) notesByTime.set(noteTime, []);
        notesByTime.get(noteTime).push(child);
      } else if (tag === 'backup') {
        const dur = parseInt(child.querySelector('duration')?.textContent || '0', 10);
        curTime = Math.max(0, curTime - dur);
      } else if (tag === 'forward') {
        const dur = parseInt(child.querySelector('duration')?.textContent || '0', 10);
        curTime += dur;
      }
    }

    const sortedTimes = Array.from(notesByTime.keys()).sort((a, b) => a - b);
    return sortedTimes.map(t => notesByTime.get(t));
  }

  function _pitchValue(noteEl) {
    const stepEl = noteEl.querySelector('pitch > step');
    const octEl  = noteEl.querySelector('pitch > octave');
    const altEl  = noteEl.querySelector('pitch > alter');
    if (!stepEl || !octEl) return 0;
    return _pitchToMidi(stepEl.textContent.trim(), octEl.textContent.trim(), altEl ? altEl.textContent.trim() : 0);
  }

  function _parseNoteData(noteEl, voiceName) {
    const isRest = noteEl.querySelector('rest') !== null;
    const stepEl = noteEl.querySelector('pitch > step');
    const octEl  = noteEl.querySelector('pitch > octave');
    const altEl  = noteEl.querySelector('pitch > alter');
    return {
      voice: voiceName,
      isRest: isRest,
      step: stepEl ? stepEl.textContent.trim().toUpperCase() : 'C',
      octave: octEl ? parseInt(octEl.textContent.trim(), 10) : 4,
      alter: altEl ? parseInt(altEl.textContent.trim(), 10) : 0,
    };
  }

  function _extractSatbNotesAt(measureNum, beatIndex = 0) {
    if (!_xmlDoc) return null;
    const parts = _xmlDoc.querySelectorAll('part');
    const part1 = _xmlDoc.querySelector('part#P1') || parts[0];
    const part2 = _xmlDoc.querySelector('part#P2') || parts[1];
    if (!part1) return null;

    const m1 = part1.querySelector(`measure[number="${measureNum}"]`);
    const m2 = part2 ? part2.querySelector(`measure[number="${measureNum}"]`) : null;
    if (!m1) return null;

    const p1Chords = _groupChordsInMeasure(m1);
    const p2Chords = m2 ? _groupChordsInMeasure(m2) : [];
    const totalBeats = Math.max(p1Chords.length, 1);
    const safeIdx = Math.max(0, Math.min(beatIndex, totalBeats - 1));

    const chordP1 = p1Chords[safeIdx] || [];
    const chordP2 = p2Chords[safeIdx] || [];

    let sopranoNote = null;
    let altoNote = null;
    if (chordP1.length === 1) {
      sopranoNote = chordP1[0];
    } else if (chordP1.length >= 2) {
      const sorted = [...chordP1].sort((a, b) => _pitchValue(b) - _pitchValue(a));
      sopranoNote = sorted[0];
      altoNote = sorted[1];
    }

    let tenorNote = null;
    let bassNote = null;
    if (chordP2.length === 1) {
      bassNote = chordP2[0];
    } else if (chordP2.length >= 2) {
      const sorted = [...chordP2].sort((a, b) => _pitchValue(b) - _pitchValue(a));
      tenorNote = sorted[0];
      bassNote = sorted[1];
    }

    return {
      soprano: sopranoNote ? _parseNoteData(sopranoNote, 'soprano') : null,
      alto:    altoNote ? _parseNoteData(altoNote, 'alto') : null,
      tenor:   tenorNote ? _parseNoteData(tenorNote, 'tenor') : null,
      bass:    bassNote ? _parseNoteData(bassNote, 'bass') : null,
    };
  }

  /* ─── Transport Callbacks ────────────────────────────────────── */
  function _setupTransportCallbacks() {
    // 1. Theo dõi từng Phách (Beat)
    MusicTransport.onBeat(({ measure, beat }) => {
      // Visual Cursor Tracking
      if (_osmd?.cursor && !_osmd.cursor.isHidden) {
        _osmd.cursor.next();
        if (_osmd.cursor.cursorElement) {
          const cRect = _osmd.cursor.cursorElement.getBoundingClientRect();
          const scoreSec = document.querySelector('.learn-score-section');
          if (scoreSec) {
            const vRect = scoreSec.getBoundingClientRect();
            const targetY = vRect.height * 0.32;
            const diff = cRect.top - vRect.top - targetY;
            if (Math.abs(diff) > 25) {
              scoreSec.scrollBy({ top: diff, behavior: 'smooth' });
            }
          }
        }
      }

      // SATB 4-Part Choir Synthesis
      const satbBeat = _extractSatbNotesAt(measure, (beat - 1) % 4);
      if (satbBeat && window.LearnSoundEngine) {
        const bpm = MusicTransport.getBpm() || 76;
        const durSec = (60 / bpm) * 0.88;
        ['soprano', 'alto', 'tenor', 'bass'].forEach(voice => {
          const vNote = satbBeat[voice];
          if (vNote && !vNote.isRest) {
            const noteStr = _pitchToNoteStr(vNote.step, vNote.octave, vNote.alter);
            if (noteStr) {
              LearnSoundEngine.triggerSatbNote(voice, noteStr, durSec, undefined, 0.7);
            }
          }
        });
      }
    });

    // 2. Theo dõi từng Ô nhịp (Measure)
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

      // Auto-scroll score fallback nếu không dùng cursor
      if (!_osmd?.cursor || _osmd.cursor.isHidden) {
        _scrollToMeasure(measure);
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
    btn.innerHTML = isPlaying
      ? `<svg viewBox="0 0 24 24" fill="currentColor" class="control-btn-icon"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg><span>Tạm dừng</span>`
      : `<svg viewBox="0 0 24 24" fill="currentColor" class="control-btn-icon"><polygon points="5 3 19 12 5 21 5 3"/></svg><span>Play</span>`;
    btn.classList.toggle('btn-learn-play--active', isPlaying);
    btn.disabled = (status === 'idle' || status === 'preparing');

    const stopBtn = document.getElementById('btn-learn-stop');
    if (stopBtn) stopBtn.disabled = (status === 'idle' || status === 'preparing');
  }

  /* ─── Controls Binding ───────────────────────────────────────── */
  function _bindControls() {
    // Zoom controls
    document.getElementById('btn-learn-zoom-in')?.addEventListener('click', () => {
      _zoomIn();
    });
    document.getElementById('btn-learn-zoom-out')?.addEventListener('click', () => {
      _zoomOut();
    });
    document.getElementById('btn-learn-zoom-reset')?.addEventListener('click', () => {
      _resetZoom();
    });
    document.getElementById('btn-learn-zoom-fit')?.addEventListener('click', () => {
      _fitScore();
    });

    // Play/Pause
    document.getElementById('btn-learn-play')?.addEventListener('click', async () => {
      const status = LearnStore.get('uiStatus');
      if (status === 'idle' || status === 'preparing') return;

      if (window.Tone && Tone.context.state !== 'running') {
        try { await Tone.start(); } catch (e) {}
      }

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
        if (_osmd?.cursor) _osmd.cursor.show();
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
      if (_osmd?.cursor) {
        _osmd.cursor.reset();
        _osmd.cursor.hide();
      }
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
          const pSel = document.getElementById('learn-pattern-select');
          if (pSel) pSel.value = 'piano-bass-chord-4-4-v1';
          if (window.PatternEngine) PatternEngine.setPattern('piano-bass-chord-4-4-v1');
        } else if (mode === 'satb') {
          const satbCard = document.getElementById('learn-satb-card');
          if (satbCard) satbCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          const choirTab = document.querySelector('.btn-learn-tab[data-tab="choir"]');
          if (choirTab && window.innerWidth <= 960) choirTab.click();
        }

        EventBus.emit(LEARN_EVENTS.MODE_CHANGED, { mode });
        LearnStore.savePreferences();
      });
    });

    // SATB Solo buttons
    document.querySelectorAll('.btn-voice-solo').forEach(btn => {
      btn.addEventListener('click', () => {
        const voice = btn.dataset.voice;
        const isActive = btn.classList.toggle('active');
        if (window.LearnSoundEngine) {
          LearnSoundEngine.setSatbSolo(voice, isActive);
        }
      });
    });

    // SATB Mute buttons
    document.querySelectorAll('.btn-voice-mute').forEach(btn => {
      btn.addEventListener('click', () => {
        const voice = btn.dataset.voice;
        const isActive = btn.classList.toggle('active');
        if (window.LearnSoundEngine) {
          LearnSoundEngine.setSatbMute(voice, isActive);
        }
      });
    });

    // SATB Volume sliders
    document.querySelectorAll('.voice-slider').forEach(slider => {
      slider.addEventListener('input', (e) => {
        const voice = slider.dataset.voice;
        if (window.LearnSoundEngine) {
          LearnSoundEngine.setSatbVolume(voice, parseFloat(e.target.value));
        }
      });
    });

    // Mobile Tabs Switching
    document.querySelectorAll('.btn-learn-tab').forEach(tabBtn => {
      tabBtn.addEventListener('click', () => {
        const tabName = tabBtn.dataset.tab;
        document.querySelectorAll('.btn-learn-tab').forEach(b => b.classList.remove('active'));
        tabBtn.classList.add('active');
        const mainEl = document.getElementById('learn-main');
        if (mainEl) mainEl.dataset.activeTab = tabName;
        if (tabName === 'score' && _osmd) {
          _fitScore();
        }
      });
    });

    // Song picker open / close
    document.getElementById('btn-learn-song-picker')?.addEventListener('click', () => {
      const panel = document.getElementById('learn-song-picker-panel');
      panel?.classList.toggle('hidden');
      if (!panel?.classList.contains('hidden')) {
        document.getElementById('learn-song-search')?.focus();
      }
    });

    document.getElementById('btn-picker-close')?.addEventListener('click', () => {
      document.getElementById('learn-song-picker-panel')?.classList.add('hidden');
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.getElementById('learn-song-picker-panel')?.classList.add('hidden');
      }
    });

    // Song search
    document.getElementById('learn-song-search')?.addEventListener('input', (e) => {
      const q = e.target.value.trim().toLowerCase();
      document.querySelectorAll('.learn-song-item').forEach(item => {
        const visible = !q || item.textContent.toLowerCase().includes(q);
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
  return {
    init,
    selectSong: _selectSong,
    getOsmd: () => _osmd,
    setZoom: _setZoom,
    getZoom: () => _osmdZoom,
    fitScore: _fitScore,
  };
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
