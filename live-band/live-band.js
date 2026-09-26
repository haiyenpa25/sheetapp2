/**
 * live-band/live-band.js — SheetApp Live Band Studio Controller (Coordinator)
 * 
 * Standalone Performance & Rehearsal Command Engine
 * Delegates to StageRoomManager, StageTimer, StageAudio, StageRehearsal, StageHud, and StageCatalog.
 */
const LiveBandApp = (() => {
  'use strict';

  const STORAGE_HOST_TOKEN_PREFIX = 'sheetapp_host_token_';
  const STORAGE_ROLE_KEY          = 'sheetapp_live_role';
  const STORAGE_CLIENT_ID_KEY     = 'sheetapp_client_id';

  // State
  let _mode = 'off', _roomCode = '', _hostToken = '', _clientId = '';
  let _role = 'guitar', _connectionStatus = 'idle';

  let _currentSongId      = '';
  let _currentSongTitle   = '';
  let _currentXmlString   = '';
  let _currentBaseKey     = 'C';
  let _currentTranspose   = 0;
  let _currentChordSet    = 'HD';
  let _currentBpm         = 80;
  let _currentMeasure     = 1;
  let _hostMeasure        = 1;
  let _isDetached         = false;

  let _songsList          = [];
  let _setlist            = null;
  let _setlistIndex       = 0;
  const _cachedXmls       = new Map();

  let _transport          = null;
  let _osmd               = null;

  /* ── Initialization ───────────────────────────────────────── */
  async function init() {
    _clientId = _getOrCreateClientId();
    _role     = localStorage.getItem(STORAGE_ROLE_KEY) || 'guitar';

    _transport = (typeof SSETransport !== 'undefined') ? new SSETransport(350) : new PollingTransport(350);
    _transport.subscribe(_handleTransportMessage);

    _initOSMD();
    _bindUI();
    window.StageHud?.initWakeLock?.();

    window.StageTimer?.startVisualBeatPulser(_currentBpm, (isBeatOne) => {
      window.StageAudio?.playMetronomeClick(isBeatOne);
    });

    window.PedalMidiEngine?.init?.((action) => {
      window.StageRehearsal?.handlePedalAction(action, {
        onNext: hostNextSong,
        onPrev: hostPrevSong,
        onCountIn: hostTriggerCountIn,
        onChorus: () => hostSendCue('chorus'),
        onSnap: snapToHost
      });
    });

    window.StageInkEngine?.init?.('stage-annotation-layer', 'stage-osmd-container', {
      onBroadcast: (stroke) => { if (_mode === 'host') broadcastState({ inkStroke: stroke }); },
      onClear: () => { if (_mode === 'host') broadcastState({ inkClear: true }); }
    });

    if (window.StageCatalog) {
      _songsList = await window.StageCatalog.loadSongCatalog((list) => { _songsList = list; });
      await window.StageCatalog.checkUrlAutoParams({
        onSetRole: (r) => { _role = r; },
        onLoadSong: (sId, trans, set) => _loadSong(sId, trans, set),
        onJoinRoom: (code) => joinRoom(code)
      });
    }

    const roleParam = new URLSearchParams(window.location.search).get('role');
    setRole(roleParam || _role, false);
    console.log('[LiveBandApp] Initialized successfully. Client ID:', _clientId);
  }

  function _getOrCreateClientId() {
    let id = localStorage.getItem(STORAGE_CLIENT_ID_KEY);
    if (!id) {
      id = 'client-' + Math.random().toString(36).substring(2, 9) + '-' + Date.now().toString(36);
      localStorage.setItem(STORAGE_CLIENT_ID_KEY, id);
    }
    return id;
  }

  /* ── OSMD Sheet Setup ─────────────────────────────────────── */
  function _initOSMD() {
    const container = document.getElementById('stage-osmd-container');
    if (!container || !window.opensheetmusicdisplay) return;
    try {
      _osmd = new opensheetmusicdisplay.OpenSheetMusicDisplay(container, {
        autoResize: true,
        backend: 'svg',
        drawTitle: true,
        drawSubtitle: true,
        drawComposer: true,
        pageFormat: 'Endless',
        coloringEnabled: true,
        engravingRules: {
          ChordSymbolFontFamily: 'OSMDChordFont, sans-serif',
          ChordSymbolTextHeight: 2.6,
          ChordSymbolYOffset: 1.2,
          DefaultColorChordSymbol: '#d97706',
          StaffLineWidth: 0.12,
          StemWidth: 0.15
        }
      });
    } catch (err) {
      console.warn('[LiveBandApp] OSMD init warning:', err);
    }
  }

  /* ── Throttled Scroll Listener ────────────────────────────── */
  function _bindScrollObserver() {
    const viewport = document.getElementById('stage-viewport');
    if (!viewport) return;

    let ticking = false;
    let lastSent = 0;

    viewport.addEventListener('scroll', () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const now = Date.now();
          if (_mode === 'host') {
            if (now - lastSent > 280) {
              const m = window.MusicalPosition?.getVisibleMeasure?.() || 1;
              if (m !== _currentMeasure) {
                if (window.StageRehearsal?.isLoopActive?.() && m >= window.StageRehearsal.getLoopRange().end) {
                  const startM = window.StageRehearsal.getLoopRange().start;
                  _currentMeasure = startM;
                  lastSent = now;
                  window.MusicalPosition?.scrollToMeasure?.(startM, true);
                  window.StageRehearsal.showCueBanner(`🔁 Vòng lại đoạn A (Ô ${startM})`, '🔁', 1500);
                  broadcastState({ position: { measure: startM } });
                  ticking = false;
                  return;
                }
                _currentMeasure = m;
                lastSent = now;
                broadcastState({ position: { measure: m } });
                window.StageCatalog?.highlightActiveSectionByMeasure(m);
              }
            }
          } else if (_mode === 'join') {
            const currentVisMeasure = window.MusicalPosition?.getVisibleMeasure?.() || 1;
            if (window.StageRehearsal?.isLoopActive?.() && currentVisMeasure >= window.StageRehearsal.getLoopRange().end) {
              window.MusicalPosition?.scrollToMeasure?.(window.StageRehearsal.getLoopRange().start, true);
            }
            if (Math.abs(currentVisMeasure - _hostMeasure) > 2) {
              _isDetached = true;
              _updateSnapButton(true, currentVisMeasure, _hostMeasure);
            } else {
              _isDetached = false;
              _updateSnapButton(false);
            }
          }
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });
  }

  function _updateSnapButton(show, currentM = 0, hostM = 0) {
    const btn = document.getElementById('btn-snap-to-host');
    const label = document.getElementById('snap-label');
    if (!btn) return;
    if (show) {
      if (label) label.textContent = `Quay về Ca Trưởng (Bạn: Ô ${currentM} • Ca Trưởng: Ô ${hostM})`;
      btn.classList.remove('hidden');
    } else {
      btn.classList.add('hidden');
    }
  }

  function snapToHost() {
    _isDetached = false;
    _updateSnapButton(false);
    if (_hostMeasure > 0 && window.MusicalPosition) {
      window.MusicalPosition.scrollToMeasure(_hostMeasure, true);
    }
  }

  /* ── Room Lifecycle ───────────────────────────────────────── */
  async function createHostRoom(roomCode) {
    _mode = 'host';
    _roomCode = roomCode;
    _role = 'leader';
    _connectionStatus = 'connecting';
    window.StageRoomManager.updateRoomBadges(_mode, _roomCode);

    try {
      const res = await window.ApiService.liveSync.create(roomCode, {
        leader: { clientId: _clientId, name: 'Ca Trưởng' },
        songId: _currentSongId,
        songTitle: _currentSongTitle,
        transpose: _currentTranspose,
        bpm: _currentBpm,
        measure: _currentMeasure
      });

      if (res && res.success) {
        _hostToken = res.hostToken;
        localStorage.setItem(STORAGE_HOST_TOKEN_PREFIX + roomCode, _hostToken);
        _connectionStatus = 'connected';
        _transport.connect(roomCode, { hostToken: _hostToken, clientId: _clientId, role: _role });

        setRole('leader', false);
        window.StageRoomManager.renderQR(roomCode);
        window.StageRoomManager.updateRoomModalUI(_mode, _roomCode);
        window.StageRoomManager.updateRoomBadges(_mode, _roomCode);
        window.StageRehearsal?.showCueBanner(`📡 Đã mở phòng phát sóng: ${roomCode}`, '⚡', 3500);
      } else {
        throw new Error(res.error || 'Không thể tạo phòng');
      }
    } catch (err) {
      alert('Lỗi tạo phòng: ' + err.message);
      leaveRoom();
    }
  }

  async function joinRoom(roomCode) {
    _mode = 'join';
    _roomCode = roomCode;
    _connectionStatus = 'connecting';
    window.StageRoomManager.updateRoomBadges(_mode, _roomCode);

    const savedToken = localStorage.getItem(STORAGE_HOST_TOKEN_PREFIX + roomCode);
    _hostToken = savedToken || '';

    _transport.connect(roomCode, { hostToken: _hostToken, clientId: _clientId, role: _role });
    window.StageRoomManager.renderQR(roomCode);
    window.StageRoomManager.updateRoomModalUI(_mode, _roomCode);
    window.StageRoomManager.updateRoomBadges(_mode, _roomCode);
    window.StageRehearsal?.showCueBanner(`📡 Đã kết nối phòng Live: ${roomCode}`, '⚡', 3000);
  }

  function leaveRoom() {
    if (_mode === 'host' && _hostToken) {
      window.ApiService.liveSync.close(_roomCode, _hostToken).catch(() => {});
    }
    _mode = 'off';
    _roomCode = '';
    _hostToken = '';
    _connectionStatus = 'idle';
    _transport.disconnect();

    window.StageRoomManager.updateRoomBadges(_mode, _roomCode);
    window.StageRoomManager.updateRoomModalUI(_mode, _roomCode);
    window.StageRoomManager.hideRoomModal();
    window.StageRehearsal?.showCueBanner('👋 Đã rời phòng Live', 'ℹ️', 2500);
  }

  function broadcastState(patch = {}) {
    if (_mode !== 'host' || !_roomCode) return;
    const payload = window.StageRoomManager.buildBroadcastPayload({
      clientId: _clientId,
      songId: _currentSongId,
      songTitle: _currentSongTitle,
      chordSet: _currentChordSet,
      setlist: _setlist,
      setlistIndex: _setlistIndex,
      baseKey: _currentBaseKey,
      transpose: _currentTranspose,
      bpm: _currentBpm,
      measure: _currentMeasure
    }, patch);

    _transport.send(_roomCode, _hostToken, payload).catch(() => {});
  }

  /* ── Remote State Handling ────────────────────────────────── */
  function _handleTransportMessage(msg) {
    if (!msg) return;
    if (msg.type === 'connection') {
      _connectionStatus = msg.status;
      window.StageRoomManager.updateRoomBadges(_mode, _roomCode);
    } else if (msg.type === 'closed') {
      window.StageRehearsal?.showCueBanner('📡 Ca Trưởng đã kết thúc buổi biểu diễn.', '🛑', 4000);
      leaveRoom();
    } else if (msg.type === 'roster' && msg.roster) {
      window.StageRoomManager.updateRosterUI(msg.roster);
    } else if (msg.type === 'state' && msg.state) {
      if (msg.roster) window.StageRoomManager.updateRosterUI(msg.roster);
      window.StageRoomManager.applyRemoteState(msg.state, {
        mode: _mode,
        currentSongId: _currentSongId,
        currentChordSet: _currentChordSet,
        currentTranspose: _currentTranspose,
        currentBpm: _currentBpm,
        currentMeasure: _currentMeasure,
        isDetached: _isDetached,
        onLoadSong: (id, trans, set) => _loadSong(id, trans, set),
        onSetTranspose: (trans) => _setTranspose(trans, false),
        onUpdateBpm: (bpm) => {
          _currentBpm = bpm;
          _updateBpmUI(bpm);
          window.StageTimer?.startVisualBeatPulser(bpm, (isBeatOne) => window.StageAudio?.playMetronomeClick(isBeatOne));
        },
        onSetHostMeasure: (m) => { _hostMeasure = m; },
        onSetCurrentMeasure: (m) => { _currentMeasure = m; },
        onUpdateSnap: (show, cur, host) => _updateSnapButton(show, cur, host)
      });
    }
  }

  /* ── Host Actions ─────────────────────────────────────────── */
  async function hostSelectSong(songId, chordSet = null) {
    if (!songId) return;
    const song = _songsList.find(s => s.id === songId);
    _currentSongTitle = song?.title || songId;
    if (chordSet) _currentChordSet = chordSet;

    await _loadSong(songId, _currentTranspose, _currentChordSet);
    broadcastState({
      song: { songId, songTitle: _currentSongTitle, chordSet: _currentChordSet },
      position: { measure: 1 }
    });
  }

  function hostAdjustTranspose(delta) {
    _setTranspose(_currentTranspose + delta, true);
  }

  function hostAdjustBpm(delta) {
    _currentBpm = Math.max(40, Math.min(240, _currentBpm + delta));
    _updateBpmUI(_currentBpm);
    window.StageTimer?.startVisualBeatPulser(_currentBpm, (isBeatOne) => window.StageAudio?.playMetronomeClick(isBeatOne));
    broadcastState({ music: { bpm: _currentBpm }, song: { bpm: _currentBpm } });
  }

  function hostSendCue(cueType) {
    const cueMap = {
      chorus: { text: '⚡ CHUẨN BỊ VÀO ĐIỆP KHÚC', icon: '⚡' },
      repeat: { text: '🔁 LẶP LẠI ĐOẠN NÀY', icon: '🔁' },
      soft:   { text: '🤫 HÁT NHỎ DẦN (PIANO)', icon: '🤫' },
      loud:   { text: '🔥 CAO TRÀO / QUẠT MẠNH (FORTE)', icon: '🔥' },
      outro:  { text: '🛑 CHUẨN BỊ KẾT BÀI (OUTRO)', icon: '🛑' }
    };
    const cue = cueMap[cueType] || { text: cueType.toUpperCase(), icon: '⚡' };
    window.StageRehearsal?.showCueBanner(cue.text, cue.icon, 3500);
    broadcastState({ cue: { type: cueType, text: cue.text, icon: cue.icon, durationMs: 3500, sentAt: Date.now() } });
  }

  function hostTriggerCountIn() {
    broadcastState({ transport: { state: 'count_in', bpm: _currentBpm, countInBars: 1 } });
    window.StageAudio?.triggerVisualCountIn({
      bpm: _currentBpm,
      beats: 4,
      onComplete: () => broadcastState({ transport: { state: 'playing' } })
    });
  }

  function hostPrevSong() {
    if (!_setlist?.items?.length) return;
    if (_setlistIndex > 0) {
      _setlistIndex--;
      hostSelectSong(_setlist.items[_setlistIndex].song_id);
    }
  }

  function hostNextSong() {
    if (!_setlist?.items?.length) return;
    if (_setlistIndex < _setlist.items.length - 1) {
      _setlistIndex++;
      hostSelectSong(_setlist.items[_setlistIndex].song_id);
    }
  }

  /* ── Teleprompter Lyrics Renderer ─────────────────────────── */
  function _renderTeleprompterLyrics(songTitle, xmlString) {
    const container = document.getElementById('stage-lyric-wrapper');
    if (!container) return;
    if (!xmlString) {
      container.innerHTML = '<div class="text-muted text-center py-2">Chưa có lời bài hát</div>';
      return;
    }

    let lyricsHtml = '';
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
      const parts = xmlDoc.querySelectorAll('measure');
      const currentStanza = [];

      parts.forEach((m) => {
        const lyrics = m.querySelectorAll('lyric text');
        if (lyrics.length > 0) {
          const words = Array.from(lyrics).map(l => l.textContent.trim()).filter(Boolean);
          if (words.length > 0) currentStanza.push(words.join(' '));
        }
      });

      const fontSize = window.StageHud?.getVocalFontSize?.() || 1.45;
      if (currentStanza.length > 0) {
        lyricsHtml = `
          <div class="teleprompter-section active">
            <div class="teleprompter-title">LỜI BÀI HÁT — ${window.SafeHtml.escape(songTitle)}</div>
            <div class="teleprompter-lines" style="font-size: ${fontSize}rem;">
              ${currentStanza.map(line => `<div class="teleprompter-line">${window.SafeHtml.escape(line)}</div>`).join('')}
            </div>
          </div>
        `;
      }
    } catch (e) {}

    if (!lyricsHtml) {
      lyricsHtml = `<div class="teleprompter-section active"><div class="teleprompter-lines">(Xem bản nhạc để theo dõi lời bài hát)</div></div>`;
    }
    container.innerHTML = lyricsHtml;
  }

  /* ── Tap Tempo Integration ────────────────────────────────── */
  function _handleTapTempo() {
    const tapBtn = document.getElementById('btn-tap-tempo');
    if (tapBtn) {
      tapBtn.style.transform = 'scale(0.92)';
      setTimeout(() => { if (tapBtn) tapBtn.style.transform = ''; }, 100);
    }

    if (window.TapTempo) {
      const res = window.TapTempo.tap();
      if (res.tapCount >= 2) {
        _currentBpm = res.bpm;
        _updateBpmUI(_currentBpm);
        window.StageTimer?.startVisualBeatPulser(_currentBpm, (isBeatOne) => window.StageAudio?.playMetronomeClick(isBeatOne));
        if (_mode === 'host' || _role === 'leader') {
          broadcastState({ music: { bpm: _currentBpm }, song: { bpm: _currentBpm } });
        }
      }
    }
  }

  function _updateBpmUI(bpm) {
    const textEl = document.getElementById('nav-bpm-val');
    const hostEl = document.getElementById('host-bpm-val');
    const songBpmEl = document.getElementById('nav-song-bpm');
    if (textEl) textEl.textContent = bpm;
    if (hostEl) hostEl.textContent = bpm;
    if (songBpmEl) songBpmEl.textContent = `${bpm} BPM`;
  }

  function _setTranspose(transpose, broadcast = false) {
    _currentTranspose = transpose;
    const valEl = document.getElementById('host-transpose-val');
    if (valEl) valEl.textContent = (transpose > 0 ? `+${transpose}` : String(transpose));

    let effKey = _currentBaseKey;
    if (window.TransposeEngine && transpose !== 0) {
      effKey = window.TransposeEngine.transposeKey(_currentBaseKey, transpose) || _currentBaseKey;
    }
    const keyBadge = document.getElementById('stage-current-key-badge') || document.getElementById('nav-song-key');
    if (keyBadge) keyBadge.textContent = keyBadge.id === 'nav-song-key' ? `Tông: ${effKey}` : effKey;

    window.StageHud?.updateBassHud(_currentBaseKey, _currentTranspose);
    window.StageHud?.updatePianoHud(_currentBaseKey, _currentTranspose);

    if (broadcast && (_mode === 'host' || _role === 'leader')) {
      broadcastState({ music: { transpose: _currentTranspose, key: effKey } });
    }
  }

  async function _loadSong(songId, transpose = 0, chordSet = 'HD') {
    if (!songId) return;
    _currentSongId = songId;
    _currentChordSet = chordSet;
    const song = _songsList.find(s => s.id === songId);
    _currentSongTitle = song?.title || songId;
    _currentBaseKey = song?.key || 'C';

    const titleEl = document.getElementById('nav-song-title') || document.getElementById('stage-song-title');
    if (titleEl) titleEl.textContent = `${_currentSongTitle} (${_currentChordSet})`;
    const setEl = document.getElementById('nav-song-set');
    if (setEl) setEl.textContent = `Bộ: ${_currentChordSet}`;

    _setTranspose(transpose, false);

    try {
      let xmlText = _cachedXmls.get(songId);
      if (!xmlText) {
        const rawPath = song?.xmlPath || song?.xml_path || `storage/Thanh ca/${songId}.xml`;
        const cleanPath = rawPath.replace(/^\//, '');
        const base = (typeof window.__APP_BASE__ === 'string') ? window.__APP_BASE__ : '';
        const fullUrl = (window.ApiService && typeof window.ApiService.resolveUrl === 'function')
          ? window.ApiService.resolveUrl(cleanPath)
          : (base ? `${base}/${cleanPath}` : `/${cleanPath}`);
        // INTENTIONAL EXCEPTION: Static MusicXML asset fetch
        const res = await fetch(fullUrl);
        if (res.ok) {
          xmlText = await res.text();
          _cachedXmls.set(songId, xmlText);
        }
      }

      if (xmlText && _osmd) {
        _currentXmlString = xmlText;
        await _osmd.load(xmlText);
        _osmd.render();
        window.MusicalPosition?.attachContainer?.('stage-viewport');
        _renderTeleprompterLyrics(_currentSongTitle, xmlText);
        if (window.StageCatalog) {
          await window.StageCatalog.loadSections(songId, (m) => {
            _currentMeasure = m;
            window.MusicalPosition?.scrollToMeasure?.(m, true);
            if (_mode === 'host') broadcastState({ position: { measure: m } });
          });
        }
        _bindScrollObserver();
      }
    } catch (e) {
      console.error('[LiveBandApp] Load XML error:', e);
    }
    window.StageHud?.applyViewMode(_role, _currentSongId);
  }

  function setRole(newRole, notify = true) {
    _role = newRole;
    window.StageHud?.setRole(newRole, _mode, _currentSongId, _transport, window.StageRehearsal?.showCueBanner, (r) => {
      if (r === 'bass') window.StageHud?.updateBassHud(_currentBaseKey, _currentTranspose);
      if (r === 'piano') window.StageHud?.updatePianoHud(_currentBaseKey, _currentTranspose);
    });
    if (notify) window.StageRehearsal?.showCueBanner(`Đã đổi vai trò: ${newRole.toUpperCase()}`, '🎭', 2000);
  }

  /* ── UI Event Binding ─────────────────────────────────────── */
  function _bindUI() {
    window.StageHud?.bindStageUI({
      onShowRoom: () => window.StageRoomManager.showRoomModal(_mode, _roomCode),
      onHideRoom: window.StageRoomManager.hideRoomModal,
      onCreateRoom: () => {
        const input = document.getElementById('host-room-input');
        let custom = input ? input.value.trim() : '';
        if (!custom) custom = 'BAND-' + Math.floor(1000 + Math.random() * 9000);
        createHostRoom(custom.toUpperCase().replace(/[^A-Z0-9_\-]/g, ''));
      },
      onJoinRoom: () => {
        const code = document.getElementById('join-room-input')?.value?.trim()?.toUpperCase();
        if (code) joinRoom(code);
      },
      onLeaveRoom: leaveRoom,
      onCopyShareLink: () => window.StageRoomManager.copyShareLink(_roomCode, window.StageRehearsal?.showCueBanner),
      onShowFullscreenQR: () => window.StageRoomManager.showFullscreenQR(_roomCode),
      onHideFullscreenQR: window.StageRoomManager.hideFullscreenQR,
      onSetRole: (r) => setRole(r),
      onSnapToHost: snapToHost,
      onAdjustTranspose: (d) => hostAdjustTranspose(d),
      onAdjustBpm: (d) => hostAdjustBpm(d),
      onTriggerCountIn: hostTriggerCountIn,
      onPrevSong: hostPrevSong,
      onNextSong: hostNextSong,
      onSelectSong: (sId) => hostSelectSong(sId),
      onTapTempo: _handleTapTempo,
      onToggleMetronome: () => window.StageAudio?.toggleMetronomeAudio(window.StageRehearsal?.showCueBanner),
      onTogglePad: () => window.StageAudio?.toggleAmbientPad(_currentBaseKey, _currentTranspose, window.StageRehearsal?.showCueBanner),
      onToggleLoop: () => window.StageRehearsal?.toggleAbLoop((m) => window.MusicalPosition?.scrollToMeasure?.(m, true), broadcastState),
      onToggleInk: window.StageRehearsal?.toggleInkMode,
      onSetBandState: (st) => window.StageRehearsal?.setBandState(st, broadcastState),
      onToggleVocalView: () => window.StageHud?.toggleVocalView(_role, _currentSongId)
    });
  }

  /* ── Public API ───────────────────────────────────────────── */
  return {
    init, createHostRoom, joinRoom, leaveRoom, setRole,
    hostSelectSong, hostAdjustTranspose, hostAdjustBpm,
    hostTriggerCountIn, hostSendCue, hostPrevSong, hostNextSong, snapToHost,
    showRoomModal: () => window.StageRoomManager.showRoomModal(_mode, _roomCode),
    hideRoomModal: window.StageRoomManager.hideRoomModal,
    toggleAmbientPad: () => window.StageAudio?.toggleAmbientPad(_currentBaseKey, _currentTranspose, window.StageRehearsal?.showCueBanner),
    startCountdown: (m) => window.StageTimer?.startCountdown(m, window.StageRehearsal?.showCueBanner),
    resetTimer: () => window.StageTimer?.resetTimer(window.StageRehearsal?.showCueBanner),
    toggleAbLoop: () => window.StageRehearsal?.toggleAbLoop((m) => window.MusicalPosition?.scrollToMeasure?.(m, true), broadcastState),
    toggleInkMode: window.StageRehearsal?.toggleInkMode,
    setSatbPart: window.StageRehearsal?.setSatbPart,
    setBandState: (k) => window.StageRehearsal?.setBandState(k, broadcastState),
    cueSectionTransition: (n) => window.StageRehearsal?.cueSectionTransition(n, window.StageCatalog?.getSections?.() || [], (m) => window.MusicalPosition?.scrollToMeasure?.(m, true), broadcastState),
    cue2BarsWarning: () => window.StageRehearsal?.cue2BarsWarning(broadcastState),
    handleTapTempo: _handleTapTempo,
    toggleMetronomeAudio: () => window.StageAudio?.toggleMetronomeAudio(window.StageRehearsal?.showCueBanner)
  };
})();

document.addEventListener('DOMContentLoaded', () => {
  LiveBandApp.init();
});

window.LiveBandApp = LiveBandApp;
