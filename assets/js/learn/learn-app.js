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
  let _rawXmlString     = '';
  let _currentTranspose = 0; // Luôn bắt đầu = 0 theo Core Rule
  let _songsList        = [];
  let _initialized      = false;

  // Stage 9: Wait Mode & MIDI
  let _waitMode          = false;
  let _isWaitingForChord = false;
  let _targetWaitChord   = null;
  let _waitResumeTimer   = null;

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

  function _jumpCursorToMeasure(measureNum) {
    if (!_osmd?.cursor) return;
    _osmd.cursor.reset();
    const targetIdx = measureNum - 1;
    while (_osmd.cursor.iterator && _osmd.cursor.iterator.currentMeasureIndex < targetIdx && !_osmd.cursor.iterator.EndReached) {
      _osmd.cursor.next();
    }
    _osmd.cursor.show();
  }

  function _findMeasureAtCoords(x, y) {
    if (!_osmd?.graphic?.measureList) return null;
    const list = _osmd.graphic.measureList;
    for (let i = 0; i < list.length; i++) {
      const staff0 = list[i][0];
      if (!staff0?.PositionAndShape) continue;
      const pos = staff0.PositionAndShape.AbsolutePosition;
      const size = staff0.PositionAndShape.Size;
      const mx = pos.x * 10;
      const my = pos.y * 10;
      const mw = size.width * 10;
      const mh = Math.max(260, (size.height || 25) * 10);
      if (x >= mx && x <= mx + mw && y >= my - 30 && y <= my + mh + 40) {
        return i + 1;
      }
    }
    return null;
  }

  function _seekToMeasure(measureNum) {
    const meta = _getSongMeta();
    const target = Math.max(1, Math.min(meta.totalMeasures || 999, measureNum));

    // Cancel any active wait-mode pauses when manually seeking
    if (_waitResumeTimer) clearTimeout(_waitResumeTimer);
    _isWaitingForChord = false;
    _targetWaitChord = null;
    _notifyWaitStatus();

    // Jump visual cursor
    _jumpCursorToMeasure(target);

    // Update chord display & virtual keyboard
    const timeline = LearnStore.get('timeline') || [];
    const chord = ChordTimelineNormalizer.getChordAt(timeline, target, 1);
    const next = ChordTimelineNormalizer.getNextChord(timeline, chord);
    LearnStore.setCurrentChord(chord, next);
    LearnStore.setCurrentPosition(target, 1);
    if (window.ChordCard) ChordCard.setChord(chord, next, _currentSong?.defaultKey);
    if (chord) EventBus.emit(LEARN_EVENTS.CHORD_CHANGED, { chord, next });

    // Transport seek
    if (window.MusicTransport) {
      if (MusicTransport.isPlaying()) {
        MusicTransport.play(target);
      } else {
        MusicTransport.seek(target);
      }
    }

    _scrollToMeasure(target);
  }

  function _setupScoreClickHandler() {
    const container = document.getElementById('learn-score-container');
    if (!container || container._hasClickHandler) return;
    container._hasClickHandler = true;

    container.addEventListener('click', (e) => {
      if (!_osmd?.graphic?.measureList) return;
      const svg = container.querySelector('svg');
      if (!svg) return;

      const rect = svg.getBoundingClientRect();
      const clickX = (e.clientX - rect.left) / _osmdZoom;
      const clickY = (e.clientY - rect.top) / _osmdZoom;

      const measureNum = _findMeasureAtCoords(clickX, clickY);
      if (measureNum) {
        _seekToMeasure(measureNum);
      }
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

    // Reset wait mode transient state
    if (_waitResumeTimer) clearTimeout(_waitResumeTimer);
    _isWaitingForChord = false;
    _targetWaitChord = null;
    _notifyWaitStatus();

    _currentSong = song;

    // Check if transpose was passed via URL or state
    const pendingTrans = LearnStore.get('_pendingTransParam');
    _currentTranspose = (typeof pendingTrans === 'number') ? pendingTrans : 0;
    LearnStore.set('_pendingTransParam', null);

    // Check if chord set was requested via URL or previous store
    const pendingSet = LearnStore.get('_pendingSetParam');
    const initialSet = pendingSet || LearnStore.get('chordSet') || 'HD';
    LearnStore.set('_pendingSetParam', null);

    const transValEl = document.getElementById('learn-trans-val');
    if (transValEl) transValEl.textContent = _currentTranspose > 0 ? `+${_currentTranspose}` : `${_currentTranspose}`;

    // Update state
    LearnStore.resetForSong(song.id, song.title);
    LearnStore.set('chordSet', initialSet);
    LearnStore.set('transpose', _currentTranspose);
    _setUiStatus('preparing');
    _showLoading(`Đang tải "${song.title}"...`);

    // Save and sync browser URL + Back-to-SheetApp link
    _updateUrlAndBackLink(song.id, initialSet, _currentTranspose);

    // Update song label
    const label = document.getElementById('learn-song-label');
    if (label) label.textContent = song.title;

    const metaLabel = document.getElementById('learn-song-meta');
    if (metaLabel) metaLabel.textContent = `Tông gốc: ${song.defaultKey || 'C'} • #${song.httlvnId || song.id}`;

    try {
      // Refresh available chord sets for this song and fetch XML + chords concurrently
      _refreshChordSetDropdown(song.id, initialSet);

      const xmlUrl = song.xmlPath.startsWith('/') ? song.xmlPath : '/' + song.xmlPath;
      const [xmlRes, chordData] = await Promise.all([
        fetch(xmlUrl),
        _loadChordSet(song.id, initialSet),
      ]);

      if (!xmlRes.ok) throw new Error(`XML fetch failed: ${xmlRes.status}`);
      const xml = await xmlRes.text();
      _rawXmlString = xml;

      // Parse original XML first to get Ground Truth harmonies
      const parser = new DOMParser();
      const originalDoc = parser.parseFromString(xml, 'application/xml');
      const xmlHarmonies = window.ChordTimelineNormalizer ? window.ChordTimelineNormalizer._extractHarmoniesFromXml(originalDoc, 0) : [];

      // Kiểm tra tính đầy đủ của chordData: Nếu XML có >= 6 hợp âm chuẩn mà chordData chỉ có <= 5 hợp âm nháp,
      // KHÔNG inject để tránh xoá sạch 17+ hợp âm chuẩn của sheet nhạc!
      const isStubProfile = (xmlHarmonies.length >= 6 && (!chordData || chordData.length <= 5));
      const shouldInjectChords = window.ChordCanvasXML?.cloneAndInjectChords 
        && initialSet !== 'default' 
        && initialSet.toUpperCase() !== 'TLH'
        && !isStubProfile;

      let effectiveXml = xml;
      if (shouldInjectChords) {
        const chordsMap = {};
        if (Array.isArray(chordData)) {
          chordData.forEach(item => {
            if (item && item.chord) {
              chordsMap[`${item.measureIdx}_${item.noteIdx}`] = item.chord;
            }
          });
        }
        if (Object.keys(chordsMap).length > 0) {
          effectiveXml = window.ChordCanvasXML.cloneAndInjectChords(xml, chordsMap);
        }
      }

      // Parse effective XML for rendering and timeline
      _xmlDoc = shouldInjectChords ? parser.parseFromString(effectiveXml, 'application/xml') : originalDoc;
      _rawChordData = isStubProfile ? [] : (chordData || []);

      // Render OSMD with full chord annotations
      _hideLoading();
      _showLoading('Đang render sheet nhạc...');
      if (!_osmd) _osmd = _initOsmd();
      if (_osmd) {
        await _osmd.load(effectiveXml);
        if (_currentTranspose !== 0 && opensheetmusicdisplay.TransposeCalculator) {
          try {
            _osmd.TransposeCalculator = new opensheetmusicdisplay.TransposeCalculator();
            _osmd.Sheet.Transpose = _currentTranspose;
            _osmd.updateGraphic();
          } catch(e) {}
        }
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

      // Trích xuất nốt giai điệu giọng 1 cho chế độ Melody Practice
      if (window.MelodyPracticeEngine) {
        MelodyPracticeEngine.extractFromXml(_xmlDoc, _currentTranspose);
        if (LearnStore.get('mode') === 'melody') {
          MelodyPracticeEngine.setActive(true, _osmd);
        }
      }

      _hideLoading();
      _setUiStatus('ready');

      // Show initial chord (first in timeline)
      const timeline = LearnStore.get('timeline') || [];
      const firstChord = timeline[0] ?? null;
      const secondChord = timeline[1] ?? null;
      if (window.ChordCard) ChordCard.setChord(firstChord, secondChord, song.defaultKey);

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

  function _filterPatternOptionsByMeter(filterMeter, beats, beatType) {
    const patternSelect = document.getElementById('learn-pattern-select');
    if (!patternSelect) return;

    const optgroups = patternSelect.querySelectorAll('optgroup');
    let effectiveFilter = filterMeter;
    if (filterMeter === 'auto') {
      if (beats === 3) effectiveFilter = '3/4';
      else if (beats === 6) effectiveFilter = '6/8';
      else if (beats === 2) effectiveFilter = '2/4';
      else effectiveFilter = '4/4';
    }

    let firstMatchVal = null;

    optgroups.forEach(og => {
      const label = og.label || '';
      const isHymnOrAll = label.includes('Mọi Nhịp') || label.includes('Trang Trọng');
      const matches = (effectiveFilter === 'all') || isHymnOrAll || label.includes(effectiveFilter);

      og.style.display = matches ? '' : 'none';
      Array.from(og.querySelectorAll('option')).forEach(opt => {
        opt.hidden = !matches;
        if (matches && !firstMatchVal) {
          firstMatchVal = opt.value;
        }
      });
    });

    // Nếu option hiện tại bị ẩn trong filter này, tự chuyển sang option hợp lệ đầu tiên
    const currentOpt = patternSelect.querySelector(`option[value="${patternSelect.value}"]`);
    if (currentOpt && currentOpt.hidden && firstMatchVal) {
      patternSelect.value = firstMatchVal;
      if (window.PatternEngine) PatternEngine.setPattern(firstMatchVal);
    }
  }

  function _autoSelectPattern(beats, beatType) {
    const patternSelect = document.getElementById('learn-pattern-select');
    if (!patternSelect || !window.PatternEngine) return;

    let targetPattern = 'smart-ballad';
    if (window.PatternLibrary?.getRecommendedFor) {
      const rec = PatternLibrary.getRecommendedFor(beats, beatType);
      targetPattern = (typeof rec === 'string') ? rec : (rec?.patterns?.[0]?.id || 'smart-ballad');
    } else {
      if (beats === 3) targetPattern = 'smart-boston';
      else if (beats === 6) targetPattern = 'smart-slowrock-6-8';
      else if (beats === 2) targetPattern = 'smart-march';
    }

    // Đồng bộ nút tab filter
    const autoTab = document.querySelector('.btn-meter-tab[data-meter="auto"]');
    if (autoTab) {
      document.querySelectorAll('.btn-meter-tab').forEach(t => t.classList.remove('active'));
      autoTab.classList.add('active');
    }
    _filterPatternOptionsByMeter('auto', beats, beatType);

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

  /* ─── URL & Back-to-App Synchronization ──────────────────────── */
  function _updateUrlAndBackLink(songId, chordSet, transpose) {
    const sId = songId || _currentSong?.id;
    const cSet = chordSet || LearnStore.get('chordSet') || 'HD';
    const trans = typeof transpose === 'number' ? transpose : _currentTranspose;

    if (!sId) return;

    try {
      localStorage.setItem('sheetapp_learn_last_song', sId);
      const newUrl = new URL(window.location);
      newUrl.searchParams.set('song', sId);
      newUrl.searchParams.set('set', cSet);
      if (trans !== 0) {
        newUrl.searchParams.set('trans', trans);
      } else {
        newUrl.searchParams.delete('trans');
      }
      window.history.replaceState({}, '', newUrl);
    } catch (e) {}

    // Đồng bộ nút "Quay về SheetApp" với đúng bài đang tập & bộ hợp âm
    const backBtn = document.querySelector('.learn-back-btn');
    if (backBtn) {
      backBtn.href = `/?song=${encodeURIComponent(sId)}&set=${encodeURIComponent(cSet)}`;
      backBtn.title = `Quay về SheetApp đánh live bài "${_currentSong?.title || sId}"`;
    }
  }

  /* ─── Dynamic Chord Sets Dropdown ────────────────────────────── */
  async function _refreshChordSetDropdown(songId, currentProfile) {
    const selectEl = document.getElementById('learn-chord-set-select');
    if (!selectEl) return;

    let availableSets = ['HD', 'default'];
    try {
      if (window.ApiService?.chordSets?.list) {
        const res = await ApiService.chordSets.list(songId);
        if (res && res.success && Array.isArray(res.sets) && res.sets.length > 0) {
          availableSets = res.sets;
        }
      }
    } catch (e) {
      console.warn('[LearnApp] Could not fetch chord sets:', e);
    }

    if (!availableSets.includes('TLH')) availableSets.unshift('TLH');
    if (!availableSets.includes('HD')) availableSets.unshift('HD');
    if (!availableSets.includes('default')) availableSets.push('default');

    const KNOWN_LABELS = {
      'HD': '⭐ Hoài Dinh (HD)',
      'ADMIN': 'Admin (ADMIN)',
      'BH': 'Ban Hát (BH)',
      'NAM': 'Hoàng Nam (NAM)',
      'LAN': 'Hà Lan (LAN)',
      'TLH': '🎼 TLH (Gốc) 🔒 [Bản chuẩn 100% hợp âm]',
      'default': '🎼 TLH (Gốc) 🔒 [Bản chuẩn 100% hợp âm]'
    };

    const targetSet = currentProfile || LearnStore.get('chordSet') || 'HD';
    const targetSetUpper = targetSet.toUpperCase();

    selectEl.innerHTML = availableSets.map(s => {
      const sUpper = s.toUpperCase();
      let label = s;
      if (s === 'default' || sUpper === 'TLH') {
        label = 'TLH (Gốc) 🔒 [Bản chuẩn]';
      } else if (KNOWN_LABELS[sUpper]) {
        label = KNOWN_LABELS[sUpper];
      } else if (s.includes('__')) {
        const parts = s.split('__');
        label = `🎸 ${parts.slice(1).join('__').replace(/_/g, ' ')} (@${parts[0]})`;
      } else {
        label = `🎸 Bộ ${s}`;
      }
      const isSelected = (sUpper === targetSetUpper) || (targetSet === 'default' && s === 'default');
      return `<option value="${s}" ${isSelected ? 'selected' : ''}>${label}</option>`;
    }).join('');

    const hasTarget = Array.from(selectEl.options).some(o => o.value.toUpperCase() === targetSetUpper);
    if (!hasTarget && targetSet !== 'default' && targetSetUpper !== 'TLH') {
      const opt = document.createElement('option');
      opt.value = targetSet;
      opt.textContent = KNOWN_LABELS[targetSetUpper] || `Bộ ${targetSet}`;
      opt.selected = true;
      selectEl.appendChild(opt);
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
      btn.innerHTML = `<span>✅ Chuẩn: <strong>${_targetWaitChord || chordSym || ''}</strong></span>`;
      btn.classList.remove('waiting-for-chord');
    } else if (chordSym) {
      btn.innerHTML = `<span>⏸ Bấm: <strong>${chordSym}</strong></span>`;
      btn.classList.add('waiting-for-chord');
    } else {
      btn.innerHTML = '<span>⏸ Đợi Phím (BẬT)</span>';
      btn.classList.remove('waiting-for-chord');
    }
  }

  function _checkWaitChordMatch() {
    if (!_isWaitingForChord || !_targetWaitChord) return;
    if (!window.ChordJudge || !window.MidiInputEngine) return;

    const activeMidis = MidiInputEngine.getActiveNotes();
    if (!activeMidis || activeMidis.length === 0) return;

    const result = ChordJudge.judge(_targetWaitChord, activeMidis);
    if (result.match === 'exact') {
      const matchedChord = _targetWaitChord;
      _isWaitingForChord = false;

      // Visual feedback
      if (window.VirtualKeyboard && VirtualKeyboard.flashSuccess) {
        VirtualKeyboard.flashSuccess();
      }

      // Audio feedback chime
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

      // Record practice stats
      if (window.PracticeTracker && PracticeTracker.recordChordAccuracy) {
        PracticeTracker.recordChordAccuracy(matchedChord, true);
      }

      // Resume transport after pedagogical pause
      if (_waitResumeTimer) clearTimeout(_waitResumeTimer);
      _waitResumeTimer = setTimeout(() => {
        _targetWaitChord = null;
        if (_waitMode) {
          _notifyWaitStatus();
          if (window.PatternEngine) PatternEngine.start();
          if (window.MusicTransport && !MusicTransport.isPlaying() && LearnStore.get('uiStatus') === 'playing') {
            MusicTransport.play();
          }
        }
      }, 400);
    } else if (result.match === 'partial') {
      const btn = document.getElementById('btn-toggle-wait-mode');
      if (btn && _waitMode) {
        btn.innerHTML = `<span>⚠️ Thiếu: <strong>${_targetWaitChord}</strong> (${result.matchedCount}/${result.requiredCount})</span>`;
      }
    }
  }

  /* ─── Transport Callbacks ────────────────────────────────────── */
  function _setupTransportCallbacks() {
    // 1. Theo dõi từng Phách (Beat)
    MusicTransport.onBeat(({ measure, beat, time }) => {
      // Visual Metronome Beat Indicator update
      const beatDots = document.querySelectorAll('.beat-dot');
      beatDots.forEach(dot => {
        const dotBeat = parseInt(dot.dataset.beat, 10);
        dot.classList.toggle('active', dotBeat === beat);
      });

      // Metronome Audio Click (Ting on beat 1 downbeat, cốc on beats 2,3,4)
      if (window.LearnSoundEngine && LearnSoundEngine.isMetronomeEnabled && LearnSoundEngine.isMetronomeEnabled()) {
        LearnSoundEngine.playMetronomeClick(beat, beat === 1, time);
      }

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

      // Check chord changes on this beat for ChordCard, Keyboard & Wait Mode
      const timeline = LearnStore.get('timeline') || [];
      const chordOnBeat = timeline.find(e => e.measure === measure && e.beat === beat);
      if (chordOnBeat) {
        const nextChord = ChordTimelineNormalizer.getNextChord(timeline, chordOnBeat);
        LearnStore.setCurrentChord(chordOnBeat, nextChord);
        LearnStore.setCurrentPosition(measure, beat);
        if (window.ChordCard) ChordCard.setChord(chordOnBeat, nextChord, _currentSong?.defaultKey);
        EventBus.emit(LEARN_EVENTS.CHORD_CHANGED, { chord: chordOnBeat, next: nextChord });

        // Wait Mode pause on chord transition
        if (_waitMode && (chordOnBeat.transposedSymbol || chordOnBeat.symbol)) {
          const chordSym = chordOnBeat.transposedSymbol || chordOnBeat.symbol;
          _targetWaitChord = chordSym;
          _isWaitingForChord = true;
          MusicTransport.pause();
          if (window.PatternEngine) PatternEngine.pause();
          _notifyWaitStatus(chordSym);
          _checkWaitChordMatch();
        }
      }

      // Mode-specific note playback
      const currentMode = (window.LearnStore ? LearnStore.get('mode') : null) || 'piano';
      if (currentMode === 'satb') {
        const satbBeat = _extractSatbNotesAt(measure, beat - 1);
        if (satbBeat && window.LearnSoundEngine) {
          const bpm = MusicTransport.getBpm() || 76;
          const durSec = (60 / bpm) * 0.88;
          ['soprano', 'alto', 'tenor', 'bass'].forEach(voice => {
            const vNote = satbBeat[voice];
            if (vNote && !vNote.isRest) {
              const noteStr = _pitchToNoteStr(vNote.step, vNote.octave, vNote.alter);
              if (noteStr) {
                LearnSoundEngine.triggerSatbNote(voice, noteStr, durSec, time, 0.7);
              }
            }
          });
        }
      } else if (currentMode === 'melody') {
        const satbBeat = _extractSatbNotesAt(measure, beat - 1);
        if (satbBeat?.soprano && !satbBeat.soprano.isRest && window.LearnSoundEngine) {
          const bpm = MusicTransport.getBpm() || 76;
          const durSec = (60 / bpm) * 0.90;
          const vNote = satbBeat.soprano;
          const noteStr = _pitchToNoteStr(vNote.step, vNote.octave, vNote.alter);
          if (noteStr) {
            LearnSoundEngine.triggerNote('piano', noteStr, durSec, time, 0.9, 'right');
          }
        }
      }
    });

    // 2. Theo dõi từng Ô nhịp (Measure)
    MusicTransport.onMeasure(({ measure }) => {
      const timeline = LearnStore.get('timeline') || [];
      const chord    = ChordTimelineNormalizer.getChordAt(timeline, measure, 1);
      const next     = ChordTimelineNormalizer.getNextChord(timeline, chord);

      LearnStore.setCurrentChord(chord, next);
      LearnStore.setCurrentPosition(measure, 1);

      if (window.ChordCard) ChordCard.setChord(chord, next, _currentSong?.defaultKey);

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
    _setupScoreClickHandler();

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
        if (_osmd?.cursor) _osmd.cursor.show();
        await MusicTransport.play();
        _setUiStatus('playing');
      }
      LearnStore.savePreferences();
    });

    // Stop
    document.getElementById('btn-learn-stop')?.addEventListener('click', () => {
      MusicTransport.stop();
      if (_waitResumeTimer) clearTimeout(_waitResumeTimer);
      _isWaitingForChord = false;
      _targetWaitChord = null;
      _notifyWaitStatus();
      if (window.PatternEngine) PatternEngine.stop();
      if (window.PracticeTracker) PracticeTracker.onPlaybackStop();
      if (_osmd?.cursor) {
        _osmd.cursor.reset();
        _osmd.cursor.hide();
      }
      document.querySelectorAll('.beat-dot').forEach(dot => dot.classList.remove('active'));
      _setUiStatus('ready');

      // Reset to first chord
      const timeline = LearnStore.get('timeline') || [];
      if (window.ChordCard) ChordCard.setChord(timeline[0] ?? null, timeline[1] ?? null, _currentSong?.defaultKey);
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
        if (_osmd && _osmd.Sheet && opensheetmusicdisplay.TransposeCalculator) {
          try {
            _osmd.TransposeCalculator = new opensheetmusicdisplay.TransposeCalculator();
            _osmd.Sheet.Transpose = _currentTranspose;
            _osmd.updateGraphic();
            _osmd.render();
          } catch(e) {}
        }
        _rebuildTimeline();
        if (window.MelodyPracticeEngine) MelodyPracticeEngine.setTranspose(_currentTranspose);
        _updateUrlAndBackLink();
      }
    });

    // Transpose Up (+)
    document.getElementById('btn-learn-trans-inc')?.addEventListener('click', () => {
      if (_currentTranspose < 12) {
        _currentTranspose++;
        const valEl = document.getElementById('learn-trans-val');
        if (valEl) valEl.textContent = _currentTranspose > 0 ? `+${_currentTranspose}` : `${_currentTranspose}`;
        if (_osmd && _osmd.Sheet && opensheetmusicdisplay.TransposeCalculator) {
          try {
            _osmd.TransposeCalculator = new opensheetmusicdisplay.TransposeCalculator();
            _osmd.Sheet.Transpose = _currentTranspose;
            _osmd.updateGraphic();
            _osmd.render();
          } catch(e) {}
        }
        _rebuildTimeline();
        if (window.MelodyPracticeEngine) MelodyPracticeEngine.setTranspose(_currentTranspose);
        _updateUrlAndBackLink();
      }
    });

    // Chord Set Profile Select
    document.getElementById('learn-chord-set-select')?.addEventListener('change', async (e) => {
      const profile = e.target.value;
      LearnStore.set('chordSet', profile);
      if (_currentSong) {
        _showLoading(`Đang tải bộ hợp âm ${profile}...`);
        _rawChordData = await _loadChordSet(_currentSong.id, profile);

        // Re-inject chords and re-render OSMD with new chord set
        if (_rawXmlString && _osmd) {
          let effectiveXml = _rawXmlString;
          if (window.ChordCanvasXML?.cloneAndInjectChords && profile !== 'default' && profile.toUpperCase() !== 'TLH') {
            const chordsMap = {};
            if (Array.isArray(_rawChordData)) {
              _rawChordData.forEach(item => {
                if (item && item.chord) {
                  chordsMap[`${item.measureIdx}_${item.noteIdx}`] = item.chord;
                }
              });
            }
            if (Object.keys(chordsMap).length > 0) {
              effectiveXml = window.ChordCanvasXML.cloneAndInjectChords(_rawXmlString, chordsMap);
            }
          }
          const parser = new DOMParser();
          _xmlDoc = parser.parseFromString(effectiveXml, 'application/xml');
          try {
            await _osmd.load(effectiveXml);
            if (_currentTranspose !== 0 && opensheetmusicdisplay.TransposeCalculator) {
              _osmd.TransposeCalculator = new opensheetmusicdisplay.TransposeCalculator();
              _osmd.Sheet.Transpose = _currentTranspose;
              _osmd.updateGraphic();
            }
            await _osmd.render();
          } catch (err) {
            console.warn('[LearnApp] OSMD re-render error:', err);
          }
        }

        _rebuildTimeline();
        _updateUrlAndBackLink(_currentSong.id, profile, _currentTranspose);
        _hideLoading();
      }
    });

    // Accompaniment Pattern Select
    document.getElementById('learn-pattern-select')?.addEventListener('change', (e) => {
      if (window.PatternEngine) {
        PatternEngine.setPattern(e.target.value);
      }
    });

    // Meter Filter Tabs
    document.querySelectorAll('.btn-meter-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.btn-meter-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const meta = _getSongMeta();
        _filterPatternOptionsByMeter(btn.dataset.meter, meta.beats, meta.beatType);
      });
    });

    // Melody Controls (Wait toggle, Piano preview, Nav buttons)
    document.getElementById('melody-wait-toggle')?.addEventListener('change', (e) => {
      if (window.MelodyPracticeEngine) MelodyPracticeEngine.setWaitForNote(e.target.checked);
    });

    document.getElementById('melody-preview-toggle')?.addEventListener('change', (e) => {
      if (window.MelodyPracticeEngine) MelodyPracticeEngine.setPianoSound(e.target.checked);
    });

    document.getElementById('btn-melody-prev')?.addEventListener('click', () => {
      if (window.MelodyPracticeEngine) MelodyPracticeEngine.prevNote();
    });

    document.getElementById('btn-melody-next')?.addEventListener('click', () => {
      if (window.MelodyPracticeEngine) MelodyPracticeEngine.nextNote();
    });

    document.getElementById('btn-melody-reset')?.addEventListener('click', () => {
      if (window.MelodyPracticeEngine) MelodyPracticeEngine.reset();
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
    document.getElementById('slider-vol-drum')?.addEventListener('input', (e) => {
      if (window.LearnSoundEngine) LearnSoundEngine.setVolume('drum', parseFloat(e.target.value));
    });

    // Drum Toggle
    const drumToggle = document.getElementById('learn-drum-toggle');
    if (drumToggle) {
      drumToggle.checked = window.LearnSoundEngine ? window.LearnSoundEngine.isDrumsEnabled() : false;
      drumToggle.addEventListener('change', (e) => {
        if (window.LearnSoundEngine) LearnSoundEngine.setDrumsEnabled(e.target.checked);
      });
    }

    // Arrangement Density Buttons
    document.querySelectorAll('.btn-density[data-density]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.btn-density').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (window.PatternEngine) {
          PatternEngine.setDensity(btn.dataset.density);
        }
      });
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

    // Stage 9: Wait Mode Toggle Button
    const waitModeBtn = document.getElementById('btn-toggle-wait-mode');
    waitModeBtn?.addEventListener('click', () => {
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

    // Metronome Click Toggle
    const metroBtn = document.getElementById('btn-learn-metro');
    metroBtn?.addEventListener('click', () => {
      if (window.LearnSoundEngine) {
        const active = LearnSoundEngine.toggleMetronome();
        metroBtn.classList.toggle('active', active);
      }
    });

    // Hand Practice Selector (Both / Right / Left)
    document.querySelectorAll('.btn-hand-mode').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.btn-hand-mode').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const hand = btn.dataset.hand || 'both';
        if (window.LearnSoundEngine) {
          LearnSoundEngine.setHandPractice(hand);
        }
      });
    });

    // Mode selector
    document.querySelectorAll('.btn-learn-mode').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;
        LearnStore.set('mode', mode);
        document.querySelectorAll('.btn-learn-mode').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Nếu chuyển sang Organ/Piano, đồng bộ pattern
        if (mode === 'piano') {
          const pSel = document.getElementById('learn-pattern-select');
          if (pSel && !pSel.value) {
            pSel.value = 'smart-ballad';
            if (window.PatternEngine) PatternEngine.setPattern('smart-ballad');
          }
          if (window.MelodyPracticeEngine) MelodyPracticeEngine.setActive(false);
        } else if (mode === 'satb') {
          const satbCard = document.getElementById('learn-satb-card');
          if (satbCard) satbCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          const choirTab = document.querySelector('.btn-learn-tab[data-tab="choir"]');
          if (choirTab && window.innerWidth <= 960) choirTab.click();
          if (window.MelodyPracticeEngine) MelodyPracticeEngine.setActive(false);
        } else if (mode === 'melody') {
          const melodyCard = document.getElementById('learn-melody-card');
          if (melodyCard) melodyCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          if (window.MelodyPracticeEngine) {
            MelodyPracticeEngine.setActive(true, _osmd);
          }
        } else {
          if (window.MelodyPracticeEngine) MelodyPracticeEngine.setActive(false);
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

    // Check URL for song, chord set, and transpose params BEFORE loading songs
    const urlParams = new URLSearchParams(window.location.search);
    const songParam = urlParams.get('song') ?? urlParams.get('id');
    if (songParam) {
      LearnStore.set('_pendingSongParam', songParam);
    }
    const setParam = urlParams.get('set');
    if (setParam) {
      LearnStore.set('_pendingSetParam', setParam);
    }
    const transParam = urlParams.get('trans');
    if (transParam !== null) {
      const parsedTrans = parseInt(transParam, 10);
      if (!isNaN(parsedTrans)) {
        LearnStore.set('_pendingTransParam', parsedTrans);
      }
    }

    // Load songs
    _loadSongs();

    // EventBus listeners
    EventBus.on(LEARN_EVENTS.CHORD_CHANGED, ({ chord, next }) => {
      if (window.ChordCard) ChordCard.setChord(chord, next, _currentSong?.defaultKey);
    });

    // Stage 9: Initialize Web MIDI Hardware Engine
    if (window.MidiInputEngine) {
      MidiInputEngine.init();
      MidiInputEngine.onMidiEvent((evt) => {
        if (evt.type === 'note_on') {
          if (window.MelodyPracticeEngine && MelodyPracticeEngine.isActive()) {
            MelodyPracticeEngine.checkPlayedNote(evt.midi || evt.note);
          }
          if (_waitMode && _isWaitingForChord) {
            _checkWaitChordMatch();
          }
        } else if (evt.type === 'active_notes_changed') {
          if (_waitMode && _isWaitingForChord) {
            _checkWaitChordMatch();
          }
        }
      });
    }

    EventBus.on('LEARN_MIDI_NOTES_CHANGED', () => {
      if (_waitMode && _isWaitingForChord) {
        _checkWaitChordMatch();
      }
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
    seekToMeasure: _seekToMeasure,
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
