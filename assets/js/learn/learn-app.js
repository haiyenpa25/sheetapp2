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
  let _xmlDoc           = null;
  let _currentSong      = null;
  let _rawChordData     = [];
  let _rawXmlString     = '';
  let _currentTranspose = 0; // Luôn bắt đầu = 0 theo Core Rule
  let _songsList        = [];
  let _initialized      = false;

  // Stage 9: Wait Mode & MIDI
  let _waitMode          = false;
  let _isWaitingForChord = false;
  let _targetWaitChord   = null;
  let _waitResumeTimer   = null;

  /* ─── UI State Machine ───────────────────────────────────────── */
  function _setUiStatus(status) {
    LearnStore.setUiStatus(status);
    const body = document.querySelector('.learn-page');
    if (body) body.dataset.status = status;
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

  function _seekToMeasure(measureNum) {
    const meta = window.LearnSatb ? LearnSatb.getSongMeta(_xmlDoc) : { totalMeasures: 99 };
    const target = Math.max(1, Math.min(meta.totalMeasures || 999, measureNum));
    if (_waitResumeTimer) clearTimeout(_waitResumeTimer);
    _isWaitingForChord = false;
    _targetWaitChord = null;
    _notifyWaitStatus();
    if (window.LearnScore) {
      LearnScore.jumpCursorToMeasure(target);
      LearnScore.scrollToMeasure(target);
    }
    const timeline = LearnStore.get('timeline') || [];
    const chord = ChordTimelineNormalizer.getChordAt(timeline, target, 1);
    const next = ChordTimelineNormalizer.getNextChord(timeline, chord);
    LearnStore.setCurrentChord(chord, next);
    LearnStore.setCurrentPosition(target, 1);
    if (window.ChordCard) ChordCard.setChord(chord, next, _currentSong?.defaultKey);
    if (chord) EventBus.emit(LEARN_EVENTS.CHORD_CHANGED, { chord, next });
    if (window.MusicTransport) {
      if (MusicTransport.isPlaying()) MusicTransport.play(target);
      else MusicTransport.seek(target);
    }
  }

  /* ─── Song Loading ───────────────────────────────────────────── */
  async function _loadSongs() {
    try {
      const res = await ApiService.songs.list();
      _songsList = Array.isArray(res) ? res : (res?.songs ?? res?.data ?? []);
      _renderSongList();

      let targetSong = null;
      const pending = LearnStore.get('_pendingSongParam');
      if (pending) {
        const pStr = String(pending).trim().toLowerCase();
        targetSong = _songsList.find(s => {
          const idStr = String(s.id || '').toLowerCase();
          const titleStr = String(s.title || '').toLowerCase();
          const numStr = String(s.httlvnId || '').padStart(3, '0');
          return idStr === pStr || idStr.includes(pStr) || numStr === pStr || String(s.httlvnId) === pStr || titleStr.includes(pStr);
        });
        LearnStore.set('_pendingSongParam', null);
      }

      if (!targetSong) {
        try {
          const lastId = localStorage.getItem('sheetapp_learn_last_song');
          if (lastId) targetSong = _songsList.find(s => s.id === lastId);
        } catch (e) {}
      }

      if (!targetSong && _songsList.length > 0) {
        targetSong = _songsList.find(s => s.id === 'thanh-ca-090' || s.httlvnId === 90) || _songsList[0];
      }

      if (targetSong) _selectSong(targetSong);
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
      const numBadge = song.httlvnId ? `<span class="song-num-badge">#${window.SafeHtml.escape(song.httlvnId)}</span>` : '';
      const keyBadge = song.defaultKey ? `<span class="song-key-badge">${window.SafeHtml.escape(song.defaultKey)}</span>` : '';
      item.innerHTML = `
        <div class="song-item-content">
          ${numBadge}
          <span class="song-item-title">${window.SafeHtml.escape(song.title ?? `Bài ${song.id}`)}</span>
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

    if (window.MusicTransport && MusicTransport.isPlaying()) {
      MusicTransport.stop();
      if (window.PatternEngine) PatternEngine.stop();
    }

    if (_waitResumeTimer) clearTimeout(_waitResumeTimer);
    _isWaitingForChord = false;
    _targetWaitChord = null;
    _notifyWaitStatus();

    _currentSong = song;

    const pendingTrans = LearnStore.get('_pendingTransParam');
    _currentTranspose = (typeof pendingTrans === 'number') ? pendingTrans : 0;
    LearnStore.set('_pendingTransParam', null);

    const pendingSet = LearnStore.get('_pendingSetParam');
    const initialSet = pendingSet || LearnStore.get('chordSet') || 'HD';
    LearnStore.set('_pendingSetParam', null);

    const transValEl = document.getElementById('learn-trans-val');
    if (transValEl) transValEl.textContent = _currentTranspose > 0 ? `+${_currentTranspose}` : `${_currentTranspose}`;

    LearnStore.resetForSong(song.id, song.title);
    LearnStore.set('chordSet', initialSet);
    LearnStore.set('transpose', _currentTranspose);
    _setUiStatus('preparing');
    _showLoading(`Đang tải "${song.title}"...`);

    if (window.LearnControls) {
      LearnControls.updateUrlAndBackLink(song.id, initialSet, _currentTranspose, song.title);
      LearnControls.refreshChordSetDropdown(song.id, initialSet);
    }

    const label = document.getElementById('learn-song-label');
    if (label) label.textContent = song.title;

    const metaLabel = document.getElementById('learn-song-meta');
    if (metaLabel) metaLabel.textContent = `Tông gốc: ${song.defaultKey || 'C'} • #${song.httlvnId || song.id}`;

    try {
      const xmlUrl = (window.ApiService && typeof window.ApiService.resolveUrl === 'function')
        ? window.ApiService.resolveUrl(song.xmlPath)
        : (song.xmlPath.startsWith('/') ? song.xmlPath : '/' + song.xmlPath);
      const [xmlRes, chordData] = await Promise.all([
        // INTENTIONAL EXCEPTION: Static MusicXML asset fetch
        fetch(xmlUrl),
        _loadChordSet(song.id, initialSet),
      ]);

      if (!xmlRes.ok) throw new Error(`XML fetch failed: ${xmlRes.status}`);
      const xml = await xmlRes.text();
      _rawXmlString = xml;

      const prepared = window.LearnScore
        ? LearnScore.prepareEffectiveXml(xml, chordData, initialSet)
        : { xmlString: xml, xmlDoc: new DOMParser().parseFromString(xml, 'application/xml'), rawChordData: chordData || [] };

      _xmlDoc = prepared.xmlDoc;
      _rawChordData = prepared.rawChordData;

      _hideLoading();
      _showLoading('Đang render sheet nhạc...');
      if (window.LearnScore) {
        await LearnScore.loadScore(prepared.xmlString, _currentTranspose);
      }

      if (window.LearnSatb) LearnSatb.extractSongMeta(_xmlDoc);
      _rebuildTimeline();

      const meta = window.LearnSatb ? LearnSatb.getSongMeta(_xmlDoc) : { beats: 4, beatType: 4, totalMeasures: 16 };
      MusicTransport.configure({
        bpm:             LearnStore.get('bpm'),
        beatsPerMeasure: meta.beats,
        beatType:        meta.beatType,
        totalMeasures:   meta.totalMeasures,
      });
      MusicTransport.setupTicker();

      if (window.PatternEngine) {
        PatternEngine.init();
        if (window.LearnControls) {
          LearnControls.autoSelectPattern(meta.beats, meta.beatType);
        }
      }

      if (window.LoopController) {
        await LoopController.initForSong(song.id, meta.totalMeasures, LearnStore.get('bpm'));
      }

      const pendingAssId = LearnStore.get('_pendingAssignmentParam');
      const pendingPart   = LearnStore.get('_pendingPartParam');
      const pendingBpm    = LearnStore.get('_pendingBpmParam');

      if (pendingBpm && window.MusicTransport) {
        MusicTransport.setBpm(pendingBpm);
        LearnStore.set('bpm', pendingBpm);
        const bpmValEl = document.getElementById('learn-bpm-val') || document.getElementById('learn-bpm-value');
        if (bpmValEl) bpmValEl.textContent = pendingBpm;
      }

      if (window.PracticeTracker) {
        await PracticeTracker.startSession(song.id, LearnStore.get('mode') || 'piano', LearnStore.get('bpm'), pendingAssId);
      }

      if (pendingPart && window.LearnSoundEngine) {
        const partMap = { S: 'soprano', A: 'alto', T: 'tenor', B: 'bass' };
        const targetVoice = partMap[pendingPart];
        if (targetVoice) {
          LearnSoundEngine.setSatbSolo(targetVoice, true);
          document.querySelectorAll('.btn-voice-solo').forEach(b => {
            b.classList.toggle('active', b.dataset.voice === targetVoice);
          });
        }
      }

      _setupTransportBridge();

      if (window.MelodyPracticeEngine) {
        MelodyPracticeEngine.extractFromXml(_xmlDoc, _currentTranspose);
        if (LearnStore.get('mode') === 'melody') {
          const osmdInst = window.LearnScore ? LearnScore.getOsmd() : null;
          MelodyPracticeEngine.setActive(true, osmdInst);
        }
      }

      _hideLoading();
      _setUiStatus('ready');

      const timeline = LearnStore.get('timeline') || [];
      if (window.ChordCard) ChordCard.setChord(timeline[0] ?? null, timeline[1] ?? null, song.defaultKey);
      EventBus.emit(LEARN_EVENTS.READY, { songId: song.id });

    } catch (e) {
      _hideLoading();
      _setUiStatus('idle');
      console.error('[LearnApp] Load song failed:', e, e.stack);
      _showError('Lỗi tải bài: ' + e.message);
    }
  }

  function _rebuildTimeline() {
    if (!_xmlDoc) return;
    const currentProfile = LearnStore.get('chordSet') || 'HD';
    const timeline = ChordTimelineNormalizer.normalize(
      _xmlDoc,
      _rawChordData || [],
      _currentTranspose,
      currentProfile
    );
    LearnStore.setTimeline(timeline);
    LearnStore.set('transpose', _currentTranspose);

    const { measure, beat } = MusicTransport.getMeasureBeat();
    const chord = ChordTimelineNormalizer.getChordAt(timeline, measure, beat) || timeline[0] || null;
    const next  = ChordTimelineNormalizer.getNextChord(timeline, chord);
    LearnStore.setCurrentChord(chord, next);

    if (window.ChordCard) ChordCard.setChord(chord, next, _currentSong?.defaultKey);
    if (chord) EventBus.emit(LEARN_EVENTS.CHORD_CHANGED, { chord, next });
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

  /* ─── Stage 9: Wait Mode & MIDI Evaluation ─────────────────── */
  function _notifyWaitStatus(chordSym = null, isSuccess = false) {
    const btn = document.getElementById('btn-toggle-wait-mode');
    if (!btn) return;
    if (!_waitMode) {
      btn.innerHTML = '<span>⏸ Đợi Phím</span>';
      btn.classList.remove('active', 'waiting-for-chord');
      return;
    }
    btn.classList.add('active');
    if (isSuccess) {
      btn.innerHTML = `<span>✅ Chuẩn: <strong>${window.SafeHtml.escape(_targetWaitChord || chordSym || '')}</strong></span>`;
      btn.classList.remove('waiting-for-chord');
    } else if (chordSym) {
      btn.innerHTML = `<span>⏸ Bấm: <strong>${window.SafeHtml.escape(chordSym)}</strong></span>`;
      btn.classList.add('waiting-for-chord');
    } else {
      btn.innerHTML = '<span>⏸ Đợi Phím (BẬT)</span>';
      btn.classList.remove('waiting-for-chord');
    }
  }

  function _checkWaitChordMatch() {
    if (!_isWaitingForChord || !_targetWaitChord || !window.ChordJudge || !window.MidiInputEngine) return;
    const activeMidis = MidiInputEngine.getActiveNotes();
    if (!activeMidis || activeMidis.length === 0) return;

    const result = ChordJudge.judge(_targetWaitChord, activeMidis);
    if (result.match === 'exact') {
      const matchedChord = _targetWaitChord;
      _isWaitingForChord = false;
      if (window.VirtualKeyboard?.flashSuccess) VirtualKeyboard.flashSuccess();
      try {
        if (window.Tone && Tone.context.state === 'running') {
          const synth = new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: 'sine' },
            envelope: { attack: 0.01, decay: 0.1, sustain: 0.1, release: 0.3 }
          }).toDestination();
          synth.volume.value = -10;
          synth.triggerAttackRelease(['C5', 'G5'], '16n');
        }
      } catch (e) {}

      _notifyWaitStatus(matchedChord, true);
      if (window.PracticeTracker?.recordChordAccuracy) PracticeTracker.recordChordAccuracy(matchedChord, true);
      if (_waitResumeTimer) clearTimeout(_waitResumeTimer);
      _waitResumeTimer = setTimeout(() => {
        _targetWaitChord = null;
        if (_waitMode) {
          _notifyWaitStatus();
          if (window.PatternEngine) PatternEngine.start();
          if (window.MusicTransport && !MusicTransport.isPlaying() && LearnStore.get('uiStatus') === 'playing') MusicTransport.play();
        }
      }, 400);
    } else if (result.match === 'partial') {
      const btn = document.getElementById('btn-toggle-wait-mode');
      if (btn && _waitMode) {
        btn.innerHTML = `<span>⚠️ Thiếu: <strong>${window.SafeHtml.escape(_targetWaitChord)}</strong> (${Number.parseInt(result.matchedCount, 10) || 0}/${Number.parseInt(result.requiredCount, 10) || 0})</span>`;
      }
    }
  }

  /* ─── Control Handlers ───────────────────────────────────────── */
  async function _handlePlayPause() {
    const status = LearnStore.get('uiStatus');
    if (status === 'idle' || status === 'preparing') return;
    if (window.Tone && Tone.context.state !== 'running') {
      try { await Tone.start(); } catch (e) {}
    }

    if (MusicTransport.isPlaying() || _isWaitingForChord) {
      MusicTransport.pause();
      if (_waitResumeTimer) clearTimeout(_waitResumeTimer);
      _isWaitingForChord = false;
      _targetWaitChord = null;
      _notifyWaitStatus();
      if (window.PatternEngine) PatternEngine.pause();
      if (window.PracticeTracker) PracticeTracker.onPlaybackStop();
      document.querySelectorAll('.beat-dot').forEach(dot => dot.classList.remove('active'));
      _setUiStatus('paused');
    } else {
      await MusicTransport.unlock();
      if (window.LearnSoundEngine) LearnSoundEngine.init();
      if (window.PatternEngine) PatternEngine.start();
      if (window.PracticeTracker) PracticeTracker.onPlaybackStart(MusicTransport.getBpm());
      const osmd = window.LearnScore ? LearnScore.getOsmd() : null;
      if (osmd?.cursor) osmd.cursor.show();
      await MusicTransport.play();
      _setUiStatus('playing');
    }
    LearnStore.savePreferences();
  }

  function _handleStop() {
    MusicTransport.stop();
    if (_waitResumeTimer) clearTimeout(_waitResumeTimer);
    _isWaitingForChord = false;
    _targetWaitChord = null;
    _notifyWaitStatus();
    if (window.PatternEngine) PatternEngine.stop();
    if (window.PracticeTracker) PracticeTracker.onPlaybackStop();
    const osmd = window.LearnScore ? LearnScore.getOsmd() : null;
    if (osmd?.cursor) { osmd.cursor.reset(); osmd.cursor.hide(); }
    document.querySelectorAll('.beat-dot').forEach(dot => dot.classList.remove('active'));
    _setUiStatus('ready');
    const timeline = LearnStore.get('timeline') || [];
    if (window.ChordCard) ChordCard.setChord(timeline[0] ?? null, timeline[1] ?? null, _currentSong?.defaultKey);
  }

  async function _handleChordSetChange(profile) {
    LearnStore.set('chordSet', profile);
    if (_currentSong) {
      _showLoading(`Đang tải bộ hợp âm ${profile}...`);
      _rawChordData = await _loadChordSet(_currentSong.id, profile);

      if (_rawXmlString && window.LearnScore) {
        const prepared = LearnScore.prepareEffectiveXml(_rawXmlString, _rawChordData, profile);
        _xmlDoc = prepared.xmlDoc;
        try {
          await LearnScore.loadScore(prepared.xmlString, _currentTranspose);
        } catch (err) {
          console.warn('[LearnApp] OSMD re-render error:', err);
        }
      }

      _rebuildTimeline();
      if (window.LearnControls) {
        LearnControls.updateUrlAndBackLink(_currentSong.id, profile, _currentTranspose, _currentSong.title);
      }
      _hideLoading();
    }
  }

  function _handleToggleWaitMode() {
    _waitMode = !_waitMode;
    _notifyWaitStatus();
    if (!_waitMode && _isWaitingForChord) {
      _isWaitingForChord = false;
      _targetWaitChord = null;
      if (_waitResumeTimer) clearTimeout(_waitResumeTimer);
      if (window.PatternEngine) PatternEngine.start();
      if (window.MusicTransport && !MusicTransport.isPlaying() && LearnStore.get('uiStatus') === 'playing') {
        MusicTransport.play();
      }
    }
  }

  function _setupTransportBridge() {
    if (!window.LearnTransportBridge) return;
    LearnTransportBridge.setup({
      getOsmd: () => (window.LearnScore ? LearnScore.getOsmd() : null),
      getCurrentSong: () => _currentSong,
      isWaitMode: () => _waitMode,
      onChordWait: (chordSym) => {
        _targetWaitChord = chordSym;
        _isWaitingForChord = true;
        MusicTransport.pause();
        if (window.PatternEngine) PatternEngine.pause();
        _notifyWaitStatus(chordSym);
        _checkWaitChordMatch();
      },
      extractSatbNotesAt: (m, b) => (window.LearnSatb ? LearnSatb.extractSatbNotesAt(_xmlDoc, m, b) : null),
      pitchToNoteStr: (s, o, a) => (window.LearnSatb ? LearnSatb.pitchToNoteStr(s, o, a) : null),
      scrollToMeasure: (m) => { if (window.LearnScore) LearnScore.scrollToMeasure(m); }
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

    LearnStore.loadPreferences();

    const chordCardEl = document.getElementById('learn-chord-card');
    const keyboardEl  = document.getElementById('learn-virtual-keyboard');
    if (chordCardEl && window.ChordCard) ChordCard.mount(chordCardEl);
    if (keyboardEl && window.VirtualKeyboard) VirtualKeyboard.mount(keyboardEl);

    if (window.LearnScore) {
      LearnScore.init({
        onSeek: _seekToMeasure,
        getSongMeta: () => (window.LearnSatb ? LearnSatb.getSongMeta(_xmlDoc) : { totalMeasures: 99 })
      });
    }

    if (window.LearnControls) {
      LearnControls.bind({
        seekToMeasure: _seekToMeasure,
        handlePlayPause: _handlePlayPause,
        handleStop: _handleStop,
        getCurrentTranspose: () => _currentTranspose,
        setCurrentTranspose: (t) => { _currentTranspose = t; },
        getCurrentSong: () => _currentSong,
        rebuildTimeline: _rebuildTimeline,
        handleChordSetChange: _handleChordSetChange,
        getSongMeta: () => (window.LearnSatb ? LearnSatb.getSongMeta(_xmlDoc) : { beats: 4, beatType: 4 }),
        handleToggleWaitMode: _handleToggleWaitMode,
      });
    }

    const p = new URLSearchParams(window.location.search);
    const sParam = p.get('song') ?? p.get('id');
    if (sParam) LearnStore.set('_pendingSongParam', sParam);
    if (p.get('set')) LearnStore.set('_pendingSetParam', p.get('set'));
    const tr = parseInt(p.get('trans') ?? p.get('transpose'), 10);
    if (!isNaN(tr)) LearnStore.set('_pendingTransParam', tr);
    const ass = parseInt(p.get('assignment'), 10);
    if (!isNaN(ass)) LearnStore.set('_pendingAssignmentParam', ass);
    if (p.get('part')) LearnStore.set('_pendingPartParam', p.get('part').trim().toUpperCase());
    const bpm = parseInt(p.get('bpm'), 10);
    if (!isNaN(bpm) && bpm > 0) LearnStore.set('_pendingBpmParam', bpm);

    _loadSongs();

    EventBus.on(LEARN_EVENTS.CHORD_CHANGED, ({ chord, next }) => {
      if (window.ChordCard) ChordCard.setChord(chord, next, _currentSong?.defaultKey);
    });

    if (window.MidiInputEngine) {
      MidiInputEngine.init();
      MidiInputEngine.onMidiEvent((evt) => {
        if (evt.type === 'note_on') {
          if (window.MelodyPracticeEngine?.isActive()) MelodyPracticeEngine.checkPlayedNote(evt.midi || evt.note);
          if (_waitMode && _isWaitingForChord) _checkWaitChordMatch();
        } else if (evt.type === 'active_notes_changed') {
          if (_waitMode && _isWaitingForChord) _checkWaitChordMatch();
        }
      });
    }

    EventBus.on('LEARN_MIDI_NOTES_CHANGED', () => {
      if (_waitMode && _isWaitingForChord) _checkWaitChordMatch();
    });
  }

  /* ─── Public API ─────────────────────────────────────────────── */
  return {
    init,
    selectSong: _selectSong,
    getOsmd: () => (window.LearnScore ? LearnScore.getOsmd() : null),
    setZoom: (z) => (window.LearnScore ? LearnScore.setZoom(z) : null),
    getZoom: () => (window.LearnScore ? LearnScore.getZoom() : 1.0),
    fitScore: () => (window.LearnScore ? LearnScore.fitScore() : null),
    seekToMeasure: _seekToMeasure,
  };
})();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => LearnApp.init());
} else {
  LearnApp.init();
}

if (typeof window !== 'undefined') {
  window.LearnApp = LearnApp;
}
