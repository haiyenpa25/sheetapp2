/**
 * live-band/live-band.js — SheetApp Live Band Studio Controller
 * 
 * Standalone Performance & Rehearsal Command Engine
 * Handles:
 * - Room Lifecycle (Host / Follower) with PIN & QR Code
 * - Master-Follower musical state synchronization (< 300ms revision diffing)
 * - Screen WakeLock API for non-dimming stage displays
 * - Synchronized visual & Web Audio Count-In ("1, 2, 3, 4")
 * - Role-tailored HUDs (Guitar Capo, Drummer Beat Flasher, Vocal Teleprompter, Piano SATB)
 * - Song Roadmap Section Jumps & Instant Tactical Cues
 * - Musical Position measure scrolling with detach/snap-back capability
 */
const LiveBandApp = (() => {
  'use strict';

  const STORAGE_HOST_TOKEN_PREFIX = 'sheetapp_host_token_';
  const STORAGE_ROLE_KEY          = 'sheetapp_live_role';
  const STORAGE_CLIENT_ID_KEY     = 'sheetapp_client_id';
  const STORAGE_FONT_SIZE_KEY     = 'sheetapp_vocal_font_size';

  // State
  let _mode               = 'off';       // 'off' | 'host' | 'join'
  let _roomCode           = '';
  let _hostToken          = '';
  let _clientId           = '';
  let _role               = 'guitar';    // 'leader' | 'guitar' | 'piano' | 'vocal' | 'drummer' | 'viewer'
  let _connectionStatus   = 'idle';      // 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'offline'

  let _currentSongId      = '';
  let _currentSongTitle   = '';
  let _currentXmlString   = '';
  let _currentBaseKey     = 'C';
  let _currentTranspose   = 0;
  let _currentBpm         = 80;
  let _currentMeasure     = 1;
  let _hostMeasure        = 1;
  let _isDetached         = false;       // If true, user manually scrolled away; show Snap button

  let _songsList          = [];
  let _setlist            = null;
  let _setlistIndex       = 0;
  let _sections           = [];
  let _cachedXmls         = new Map();

  let _transport          = null;
  let _wakeLockSentinel   = null;
  let _osmd               = null;
  let _vocalViewMode      = 'sheet';     // 'sheet' | 'lyrics'
  let _vocalFontSize      = 1.45;        // rem
  let _audioCtx           = null;
  let _drummerBeatInterval = null;
  let _cueDismissTimer    = null;

  /* ── Initialization ───────────────────────────────────────── */
  async function init() {
    _clientId = _getOrCreateClientId();
    _role     = localStorage.getItem(STORAGE_ROLE_KEY) || 'guitar';
    _vocalFontSize = parseFloat(localStorage.getItem(STORAGE_FONT_SIZE_KEY)) || 1.45;

    _transport = new PollingTransport(350);
    _transport.subscribe(_handleTransportMessage);

    _initOSMD();
    _bindUI();
    _initWakeLock();
    await _loadSongCatalog();

    // Check URL parameters for ?room=, ?song=, ?role=
    await _checkUrlAutoParams();

    // Initial role styling if not already set by URL
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

  /* ── Screen WakeLock API ──────────────────────────────────── */
  async function _initWakeLock() {
    if ('wakeLock' in navigator) {
      try {
        _wakeLockSentinel = await navigator.wakeLock.request('screen');
        _updateWakeLockUI(true);

        _wakeLockSentinel.addEventListener('release', () => {
          _updateWakeLockUI(false);
        });

        document.addEventListener('visibilitychange', async () => {
          if (document.visibilityState === 'visible' && !_wakeLockSentinel) {
            try {
              _wakeLockSentinel = await navigator.wakeLock.request('screen');
              _updateWakeLockUI(true);
            } catch (e) {}
          }
        });
      } catch (err) {
        _updateWakeLockUI(false);
      }
    } else {
      _updateWakeLockUI(false);
    }
  }

  function _updateWakeLockUI(isActive) {
    const pill = document.getElementById('btn-stage-wakelock');
    if (!pill) return;
    if (isActive) {
      pill.classList.add('active');
      pill.querySelector('.wakelock-text').textContent = 'Sáng';
      pill.title = 'Màn hình luôn sáng chống tắt (WakeLock đang bật)';
    } else {
      pill.classList.remove('active');
      pill.querySelector('.wakelock-text').textContent = 'Tắt';
      pill.title = 'Bấm để bật chế độ giữ màn hình luôn sáng';
    }
  }

  /* ── Web Audio Synth for Count-In & Metronome ────────────── */
  function _getAudioContext() {
    if (!_audioCtx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) _audioCtx = new AudioCtx();
    }
    if (_audioCtx && _audioCtx.state === 'suspended') {
      _audioCtx.resume();
    }
    return _audioCtx;
  }

  function _playClickSound(freq = 880, duration = 0.04) {
    try {
      const ctx = _getAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      gain.gain.setValueAtTime(1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration);
    } catch (e) {}
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
          ChordSymbolFontFamily: "OSMDChordFont, sans-serif",
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

  /* ── UI Event Binding ─────────────────────────────────────── */
  function _bindUI() {
    // Room Modal Triggers
    document.getElementById('btn-stage-room-badge')?.addEventListener('click', showRoomModal);
    document.getElementById('btn-open-room-modal')?.addEventListener('click', showRoomModal);
    document.getElementById('btn-close-room-modal')?.addEventListener('click', hideRoomModal);
    document.getElementById('btn-empty-start-host')?.addEventListener('click', () => {
      showRoomModal();
      _switchModalTab('#tab-host-panel');
    });
    document.getElementById('btn-empty-join-room')?.addEventListener('click', () => {
      showRoomModal();
      _switchModalTab('#tab-join-panel');
    });

    // Modal Tabs
    document.querySelectorAll('.modal-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget.getAttribute('data-target');
        _switchModalTab(target);
      });
    });

    // Create / Join / Leave Room
    document.getElementById('btn-submit-create-host')?.addEventListener('click', _handleCreateHostRoom);
    document.getElementById('btn-submit-join-room')?.addEventListener('click', _handleJoinRoom);
    document.getElementById('btn-host-leave-room')?.addEventListener('click', leaveRoom);
    document.getElementById('btn-follower-leave-room')?.addEventListener('click', leaveRoom);
    document.getElementById('btn-copy-share-link')?.addEventListener('click', _handleCopyShareLink);

    // Fullscreen QR Modal
    document.getElementById('btn-fullscreen-qr')?.addEventListener('click', _showFullscreenQR);
    document.getElementById('btn-close-fs-qr')?.addEventListener('click', _hideFullscreenQR);

    // Role Dropdown
    document.getElementById('stage-role-select')?.addEventListener('change', (e) => {
      setRole(e.target.value);
    });

    // WakeLock toggle button
    document.getElementById('btn-stage-wakelock')?.addEventListener('click', async () => {
      if (!_wakeLockSentinel) {
        await _initWakeLock();
      } else {
        await _wakeLockSentinel.release();
        _wakeLockSentinel = null;
        _updateWakeLockUI(false);
      }
    });

    // Fullscreen Toggle
    document.getElementById('btn-stage-fullscreen')?.addEventListener('click', _toggleFullscreen);

    // Host Console Controls
    document.getElementById('host-song-dropdown')?.addEventListener('change', (e) => {
      if (_mode === 'host' && e.target.value) {
        hostSelectSong(e.target.value);
      }
    });
    document.getElementById('btn-host-prev-song')?.addEventListener('click', hostPrevSong);
    document.getElementById('btn-host-next-song')?.addEventListener('click', hostNextSong);
    document.getElementById('btn-host-pick-setlist')?.addEventListener('click', _openSetlistPicker);
    document.getElementById('btn-close-setlist-modal')?.addEventListener('click', _closeSetlistPicker);

    // Transpose
    document.getElementById('btn-host-transpose-down')?.addEventListener('click', () => hostAdjustTranspose(-1));
    document.getElementById('btn-host-transpose-up')?.addEventListener('click', () => hostAdjustTranspose(1));

    // Tempo & Count-In
    document.getElementById('btn-host-bpm-dec')?.addEventListener('click', () => hostAdjustBpm(-5));
    document.getElementById('btn-host-bpm-inc')?.addEventListener('click', () => hostAdjustBpm(5));
    document.getElementById('btn-host-countin-trigger')?.addEventListener('click', hostTriggerCountIn);

    // Cue Commander Buttons
    document.querySelectorAll('.btn-cue-trigger').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const cue = e.currentTarget.getAttribute('data-cue');
        hostSendCue(cue);
      });
    });

    // Vocal View Toggle & Font Scaler
    document.getElementById('btn-vocal-toggle-view')?.addEventListener('click', _toggleVocalView);
    document.getElementById('btn-vocal-font-dec')?.addEventListener('click', () => _adjustVocalFontSize(-0.15));
    document.getElementById('btn-vocal-font-inc')?.addEventListener('click', () => _adjustVocalFontSize(0.15));

    // Snap to Host Button
    document.getElementById('btn-snap-to-host')?.addEventListener('click', snapToHost);

    // Viewport Scroll Listener (Throttled)
    _bindScrollObserver();
  }

  function _switchModalTab(targetPaneId) {
    document.querySelectorAll('.modal-tab-btn').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-target') === targetPaneId);
    });
    document.querySelectorAll('.modal-tab-pane').forEach(p => {
      p.classList.toggle('active', ('#' + p.id) === targetPaneId);
    });
  }

  function _toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
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
            // Host broadcast position
            if (now - lastSent > 280) {
              const m = window.MusicalPosition?.getVisibleMeasure?.() || 1;
              if (m !== _currentMeasure) {
                _currentMeasure = m;
                lastSent = now;
                broadcastState({
                  position: { measure: m }
                });
                _highlightActiveSectionByMeasure(m);
              }
            }
          } else if (_mode === 'join') {
            // Follower scrolling check
            const currentVisMeasure = window.MusicalPosition?.getVisibleMeasure?.() || 1;
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
  function showRoomModal() {
    const modal = document.getElementById('modal-live-room');
    if (modal) {
      _updateRoomModalUI();
      modal.classList.remove('hidden');
    }
  }

  function hideRoomModal() {
    document.getElementById('modal-live-room')?.classList.add('hidden');
  }

  async function _handleCreateHostRoom() {
    const input = document.getElementById('host-room-input');
    let custom = input ? input.value.trim() : '';
    if (!custom) {
      custom = 'BAND-' + Math.floor(1000 + Math.random() * 9000);
    }
    custom = custom.toUpperCase().replace(/[^A-Z0-9_\-]/g, '');
    await createHostRoom(custom);
  }

  async function _handleJoinRoom() {
    const input = document.getElementById('join-room-input');
    const code = input ? input.value.trim().toUpperCase() : '';
    if (!code) {
      alert('Vui lòng nhập Mã Phòng!');
      return;
    }
    await joinRoom(code);
  }

  async function createHostRoom(roomCode) {
    _mode = 'host';
    _roomCode = roomCode;
    _role = 'leader';
    _connectionStatus = 'connecting';
    _updateRoomBadges();

    const leaderName = 'Ca Trưởng';

    try {
      const res = await window.ApiService.liveSync.create(roomCode, {
        leader: { clientId: _clientId, name: leaderName },
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
        _renderQR(roomCode);
        _updateRoomModalUI();
        _updateRoomBadges();
        showCueBanner(`📡 Đã mở phòng phát sóng: ${roomCode}`, '⚡', 3500);
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
    _updateRoomBadges();

    const savedToken = localStorage.getItem(STORAGE_HOST_TOKEN_PREFIX + roomCode);
    _hostToken = savedToken || '';

    _transport.connect(roomCode, { hostToken: _hostToken, clientId: _clientId, role: _role });
    _renderQR(roomCode);
    _updateRoomModalUI();
    _updateRoomBadges();
    showCueBanner(`📡 Đã kết nối phòng Live: ${roomCode}`, '⚡', 3000);
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

    _updateRoomBadges();
    _updateRoomModalUI();
    hideRoomModal();

    showCueBanner('👋 Đã rời phòng Live', 'ℹ️', 2500);
  }

  async function _checkUrlAutoParams() {
    const params = new URLSearchParams(window.location.search);

    // 1. Role parameter
    const role = params.get('role');
    if (role && ['leader', 'guitar', 'piano', 'vocal', 'drummer', 'viewer'].includes(role)) {
      _role = role;
    }

    // 2. Song parameter
    const songId = params.get('song');
    if (songId) {
      const dropdown = document.getElementById('host-song-dropdown');
      if (dropdown) dropdown.value = songId;
      await _loadSong(songId, 0);
    }

    // 3. Room auto-join
    const code = params.get('room') || params.get('live');
    if (code) {
      setTimeout(() => {
        joinRoom(code.toUpperCase());
      }, 200);
    }
  }

  function _handleCopyShareLink() {
    if (!_roomCode) return;
    const url = new URL(window.location.origin + window.location.pathname);
    url.searchParams.set('room', _roomCode);

    if (navigator.clipboard) {
      navigator.clipboard.writeText(url.href).then(() => {
        showCueBanner('📋 Đã sao chép link tham gia phòng!', '✅', 2500);
      }).catch(() => {
        prompt('Sao chép link tham gia:', url.href);
      });
    } else {
      prompt('Sao chép link tham gia:', url.href);
    }
  }

  /* ── QR Code Rendering ────────────────────────────────────── */
  function _renderQR(roomCode) {
    const canvas = document.getElementById('stage-qr-canvas');
    if (!canvas || !roomCode || !window.QRHelper) return;
    const url = new URL(window.location.origin + window.location.pathname);
    url.searchParams.set('room', roomCode);
    window.QRHelper.drawQR(canvas, url.href, 220);

    const shareInput = document.getElementById('share-link-input');
    if (shareInput) shareInput.value = url.href;
  }

  function _showFullscreenQR() {
    const overlay = document.getElementById('modal-fullscreen-qr-overlay');
    const canvas = document.getElementById('fs-qr-canvas');
    const badge = document.getElementById('fs-qr-room-code');
    if (!overlay || !canvas || !_roomCode || !window.QRHelper) return;

    if (badge) badge.textContent = _roomCode;
    const url = new URL(window.location.origin + window.location.pathname);
    url.searchParams.set('room', _roomCode);
    window.QRHelper.drawQR(canvas, url.href, 340);

    overlay.classList.remove('hidden');
  }

  function _hideFullscreenQR() {
    document.getElementById('modal-fullscreen-qr-overlay')?.classList.add('hidden');
  }

  /* ── Transport Message Handler ────────────────────────────── */
  function _handleTransportMessage(msg) {
    if (!msg) return;

    if (msg.type === 'connection') {
      _connectionStatus = msg.status;
      _updateRoomBadges();
    } else if (msg.type === 'closed') {
      showCueBanner('📡 Ca Trưởng đã kết thúc buổi biểu diễn.', '🛑', 4000);
      leaveRoom();
    } else if (msg.type === 'roster' && msg.roster) {
      _updateRosterUI(msg.roster);
    } else if (msg.type === 'state' && msg.state) {
      if (msg.roster) _updateRosterUI(msg.roster);
      _applyRemoteState(msg.state);
    }
  }

  function _updateRosterUI(roster) {
    const navCount = document.getElementById('nav-roster-count');
    const modalTotal = document.getElementById('modal-roster-total');
    const modalDetails = document.getElementById('modal-roster-details');

    const total = roster.total || 1;
    if (navCount) navCount.textContent = total;
    if (modalTotal) modalTotal.textContent = total;

    if (modalDetails && roster.roles) {
      const parts = [];
      if (roster.roles.leader) parts.push(`👑 ${roster.roles.leader}`);
      if (roster.roles.guitar) parts.push(`🎸 ${roster.roles.guitar}`);
      if (roster.roles.piano)  parts.push(`🎹 ${roster.roles.piano}`);
      if (roster.roles.vocal)  parts.push(`🎤 ${roster.roles.vocal}`);
      if (roster.roles.drummer) parts.push(`🥁 ${roster.roles.drummer}`);
      modalDetails.textContent = parts.join(' • ') || 'Đang chờ thành viên...';
    }
  }

  function _updateRoomBadges() {
    const pill = document.getElementById('btn-stage-room-badge');
    const label = document.getElementById('nav-room-label');
    if (!pill || !label) return;

    pill.className = 'stage-pill-badge room-badge';
    if (_mode === 'host') {
      pill.classList.add('connected');
      label.textContent = `HOST: ${_roomCode}`;
    } else if (_mode === 'join') {
      pill.classList.add('connected');
      label.textContent = `LIVE: ${_roomCode}`;
    } else {
      pill.classList.add('disconnected');
      label.textContent = 'CHƯA VÀO PHÒNG';
    }
  }

  function _updateRoomModalUI() {
    const isHost = _mode === 'host';
    const isJoin = _mode === 'join';

    document.getElementById('host-setup-view')?.classList.toggle('hidden', isHost);
    document.getElementById('host-active-view')?.classList.toggle('hidden', !isHost);
    document.getElementById('display-room-code')?.replaceChildren(document.createTextNode(_roomCode));

    document.getElementById('join-active-status')?.classList.toggle('hidden', !isJoin);
    document.getElementById('display-joined-room')?.replaceChildren(document.createTextNode(_roomCode));
  }

  /* ── Follower Remote State Application ────────────────────── */
  async function _applyRemoteState(state) {
    if (!state || _mode === 'host') return;

    // 1. Song Change
    const targetSongId = state.song?.songId || state.songId;
    if (targetSongId && targetSongId !== _currentSongId) {
      const title = state.song?.songTitle || targetSongId;
      showCueBanner(`📡 Ca Trưởng chuyển bài: ${title}`, '🎵', 3000);
      await _loadSong(targetSongId, state.music?.transpose ?? 0);
    }

    // 2. Transpose Change
    if (state.music && state.music.transpose !== undefined) {
      if (_currentTranspose !== state.music.transpose) {
        _setTranspose(state.music.transpose, false);
      }
    }

    // 3. BPM Change
    if (state.music && state.music.bpm) {
      _currentBpm = state.music.bpm;
      _updateBpmUI(_currentBpm);
    }

    // 4. Measure Position
    const targetMeasure = state.position?.measure || state.measure;
    if (targetMeasure && targetMeasure > 0) {
      _hostMeasure = targetMeasure;
      if (!_isDetached) {
        _currentMeasure = targetMeasure;
        window.MusicalPosition?.scrollToMeasure?.(targetMeasure, true);
        _highlightActiveSectionByMeasure(targetMeasure);
      } else {
        _updateSnapButton(true, _currentMeasure, _hostMeasure);
      }
    }

    // 5. Cue Message
    if (state.cue && state.cue.text) {
      showCueBanner(state.cue.text, state.cue.icon || '⚡', state.cue.durationMs || 3000);
    }

    // 6. Transport Count-in
    if (state.transport && state.transport.state === 'count_in') {
      const startAt = state.transport.startAt || 0;
      _triggerVisualCountIn({
        bpm: state.music?.bpm || _currentBpm,
        beats: 4,
        startAtServer: startAt
      });
    }
  }

  /* ── Host Broadcasting ────────────────────────────────────── */
  function broadcastState(patch = {}) {
    if (_mode !== 'host' || !_roomCode) return;

    const payload = {
      leader: { clientId: _clientId, name: 'Ca Trưởng' },
      song: {
        songId: _currentSongId,
        songTitle: _currentSongTitle,
        setlistId: _setlist?.id || null,
        setlistIndex: _setlistIndex
      },
      music: {
        baseKey: _currentBaseKey,
        transpose: _currentTranspose,
        bpm: _currentBpm
      },
      position: {
        measure: _currentMeasure
      },
      ...patch
    };

    _transport.send(_roomCode, _hostToken, payload).catch(() => {});
  }

  /* ── Host Tactical Actions ────────────────────────────────── */
  async function hostSelectSong(songId) {
    if (!songId) return;
    const song = _songsList.find(s => s.id === songId);
    _currentSongTitle = song?.title || songId;

    await _loadSong(songId, _currentTranspose);
    broadcastState({
      song: { songId, songTitle: _currentSongTitle },
      position: { measure: 1 }
    });
  }

  function hostAdjustTranspose(delta) {
    _setTranspose(_currentTranspose + delta, true);
  }

  function hostAdjustBpm(delta) {
    _currentBpm = Math.max(40, Math.min(240, _currentBpm + delta));
    _updateBpmUI(_currentBpm);
    broadcastState({
      music: { bpm: _currentBpm }
    });
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
    showCueBanner(cue.text, cue.icon, 3500);

    broadcastState({
      cue: {
        type: cueType,
        text: cue.text,
        icon: cue.icon,
        durationMs: 3500,
        sentAt: Date.now()
      }
    });
  }

  function hostTriggerCountIn() {
    const serverStartAt = (window.TransportClock?.nowServerSeconds?.() || (Date.now() / 1000.0)) + 0.35;

    broadcastState({
      transport: {
        state: 'count_in',
        bpm: _currentBpm,
        countInBars: 1,
        startAt: serverStartAt
      }
    });

    _triggerVisualCountIn({
      bpm: _currentBpm,
      beats: 4,
      startAtServer: serverStartAt,
      onComplete: () => {
        broadcastState({
          transport: { state: 'playing' }
        });
      }
    });
  }

  function hostPrevSong() {
    if (!_setlist || !_setlist.items || _setlist.items.length === 0) return;
    if (_setlistIndex > 0) {
      _setlistIndex--;
      const nextId = _setlist.items[_setlistIndex].song_id;
      hostSelectSong(nextId);
    }
  }

  function hostNextSong() {
    if (!_setlist || !_setlist.items || _setlist.items.length === 0) return;
    if (_setlistIndex < _setlist.items.length - 1) {
      _setlistIndex++;
      const nextId = _setlist.items[_setlistIndex].song_id;
      hostSelectSong(nextId);
    }
  }

  /* ── Visual Count-In Overlay Engine ───────────────────────── */
  function _triggerVisualCountIn({ bpm = 80, beats = 4, startAtServer = 0, onComplete = null }) {
    const overlay = document.getElementById('stage-countin-overlay');
    const numEl = document.getElementById('countin-giant-number');
    const subEl = document.getElementById('countin-subtext');
    if (!overlay || !numEl) return;

    overlay.classList.remove('hidden');

    const beatDurationMs = (60 / bpm) * 1000;
    let currentBeat = beats;

    const tick = () => {
      if (currentBeat > 0) {
        numEl.textContent = currentBeat;
        if (subEl) subEl.textContent = `CHUẨN BỊ VÀO BÀI... (PHÁCH ${beats - currentBeat + 1}/${beats})`;
        
        // Sound click (Higher pitch on Beat 1)
        _playClickSound(currentBeat === beats ? 920 : 540, 0.04);

        currentBeat--;
        setTimeout(tick, beatDurationMs);
      } else {
        numEl.textContent = 'VÀO!';
        numEl.style.color = '#10b981';
        if (subEl) subEl.textContent = 'HÁT / ĐÀN CÙNG NHAU!';
        _playClickSound(1080, 0.08);

        setTimeout(() => {
          overlay.classList.add('hidden');
          numEl.style.color = '';
          if (onComplete) onComplete();
        }, beatDurationMs * 0.85);
      }
    };

    tick();
  }

  /* ── Floating Cue Banner ──────────────────────────────────── */
  function showCueBanner(text, icon = '⚡', durationMs = 3000) {
    const banner = document.getElementById('stage-cue-banner');
    const textEl = document.getElementById('cue-banner-text');
    const iconEl = document.getElementById('cue-banner-icon');
    if (!banner || !textEl) return;

    clearTimeout(_cueDismissTimer);
    if (iconEl) iconEl.textContent = icon;
    textEl.textContent = text;

    banner.classList.remove('hidden');

    if (durationMs > 0) {
      _cueDismissTimer = setTimeout(() => {
        banner.classList.add('hidden');
      }, durationMs);
    }
  }

  /* ── Song Loading & Rendering ─────────────────────────────── */
  async function _loadSongCatalog() {
    try {
      const res = await window.ApiService?.songs?.list?.();
      _songsList = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : []);

      const dropdown = document.getElementById('host-song-dropdown');
      if (dropdown && _songsList.length > 0) {
        dropdown.innerHTML = '<option value="">-- Chọn bài hát phát sóng --</option>' +
          _songsList.map(s => `<option value="${s.id}">${s.httlvnId ? s.httlvnId + '. ' : ''}${s.title}</option>`).join('');
      }
    } catch (e) {}
  }

  async function _loadSong(songId, transpose = 0) {
    _currentSongId = songId;
    _currentTranspose = transpose;

    const emptyState = document.getElementById('stage-empty-state');
    const sheetWrapper = document.getElementById('stage-sheet-wrapper');
    const lyricWrapper = document.getElementById('stage-lyric-wrapper');

    if (emptyState) emptyState.classList.add('hidden');

    let xml = _cachedXmls.get(songId);
    if (!xml) {
      try {
        const songObj = _songsList.find(s => s.id === songId);
        let path = songObj?.xmlPath || `storage/Thanh ca/${songId}.xml`;
        if (!path.startsWith('/') && !path.startsWith('http')) {
          path = '/' + path;
        }
        const res = await fetch(path);
        if (res.ok) {
          xml = await res.text();
          _cachedXmls.set(songId, xml);
        }
      } catch (err) {
        console.warn('Error fetching XML for song:', songId, err);
      }
    }

    _currentXmlString = xml || '';

    // Update Song Title Pill
    const songObj = _songsList.find(s => s.id === songId);
    _currentSongTitle = songObj?.title || songId;
    _currentBaseKey = songObj?.key || 'C';
    _currentBpm = parseInt(songObj?.bpm) || 80;

    const titleEl = document.getElementById('nav-song-title');
    if (titleEl) titleEl.textContent = `${songId}. ${_currentSongTitle}`;

    _updateKeyUI();
    _updateBpmUI(_currentBpm);
    _updateGuitarCapoHint();

    // Make sure container is visible so OSMD can measure container width properly
    _applyViewMode();

    // Render OSMD
    if (_osmd && _currentXmlString) {
      try {
        await _osmd.load(_currentXmlString);
        if (transpose !== 0 && opensheetmusicdisplay.TransposeCalculator) {
          _osmd.TransposeCalculator = new opensheetmusicdisplay.TransposeCalculator();
          _osmd.Sheet.Transpose = transpose;
          _osmd.updateGraphic();
        }
        _osmd.render();

        const svg = document.getElementById('stage-osmd-container')?.querySelector('svg');
        if (svg) {
          svg.style.width = '100%';
          svg.style.maxWidth = '960px';
        }

        window.MusicalPosition?.computeMeasurePositions?.();
      } catch (err) {
        console.warn('OSMD Render error:', err);
      }
    }

    // Render Vocal Teleprompter
    _renderVocalTeleprompter(_currentXmlString, _currentSongTitle);

    // Load Sections & Roadmap
    await _loadSections(songId);

    // Re-apply view mode for active role
    _applyViewMode();
  }

  function _setTranspose(val, isHostAction = false) {
    _currentTranspose = val;
    _updateKeyUI();
    _updateGuitarCapoHint();

    if (_osmd && _osmd.Sheet && opensheetmusicdisplay.TransposeCalculator) {
      try {
        _osmd.TransposeCalculator = new opensheetmusicdisplay.TransposeCalculator();
        _osmd.Sheet.Transpose = _currentTranspose;
        _osmd.updateGraphic();
        _osmd.render();
      } catch (e) {}
    }

    if (isHostAction) {
      broadcastState({
        music: { transpose: _currentTranspose }
      });
      showCueBanner(`⚡ Đổi tông: ${_formatTransposeText(_currentTranspose)}`, '🎹', 2000);
    }
  }

  function _updateKeyUI() {
    const keyBadge = document.getElementById('nav-song-key');
    const hostKeyBadge = document.getElementById('host-key-val');

    let effectiveKey = _currentBaseKey;
    if (window.TransposeEngine && _currentTranspose !== 0) {
      effectiveKey = window.TransposeEngine.transposeKey(_currentBaseKey, _currentTranspose) || _currentBaseKey;
    }

    const txt = `Tông: ${effectiveKey} (${_currentTranspose >= 0 ? '+' : ''}${_currentTranspose})`;
    if (keyBadge) keyBadge.textContent = txt;
    if (hostKeyBadge) hostKeyBadge.textContent = `${effectiveKey} (${_currentTranspose >= 0 ? '+' : ''}${_currentTranspose})`;
  }

  function _updateBpmUI(bpm) {
    const bpmBadge = document.getElementById('nav-song-bpm');
    const hostBpmVal = document.getElementById('host-bpm-val');
    const drummerBpm = document.getElementById('drummer-bpm-display');

    if (bpmBadge) bpmBadge.textContent = `${bpm} BPM`;
    if (hostBpmVal) hostBpmVal.textContent = `${bpm} BPM`;
    if (drummerBpm) drummerBpm.textContent = `${bpm} BPM`;
  }

  function _formatTransposeText(t) {
    if (t === 0) return 'Gốc (0)';
    return `${t > 0 ? '+' : ''}${t} nửa cung`;
  }

  /* ── Guitar Capo Suggester ────────────────────────────────── */
  function _updateGuitarCapoHint() {
    const textEl = document.getElementById('guitar-capo-text');
    if (!textEl) return;

    let effKey = _currentBaseKey;
    if (window.TransposeEngine && _currentTranspose !== 0) {
      effKey = window.TransposeEngine.transposeKey(_currentBaseKey, _currentTranspose) || _currentBaseKey;
    }

    // Best open guitar shape recommendation:
    // C, G, D, A, E
    const capoTable = {
      'C':  { fret: 0, shape: 'C' },
      'C#': { fret: 1, shape: 'C' },
      'Db': { fret: 1, shape: 'C' },
      'D':  { fret: 0, shape: 'D' },
      'Eb': { fret: 3, shape: 'C' },
      'E':  { fret: 0, shape: 'E' },
      'F':  { fret: 1, shape: 'E' },
      'F#': { fret: 2, shape: 'E' },
      'Gb': { fret: 2, shape: 'E' },
      'G':  { fret: 0, shape: 'G' },
      'Ab': { fret: 1, shape: 'G' },
      'A':  { fret: 0, shape: 'A' },
      'Bb': { fret: 3, shape: 'G' },
      'B':  { fret: 2, shape: 'A' }
    };

    const rec = capoTable[effKey] || { fret: 0, shape: effKey };
    if (rec.fret === 0) {
      textEl.textContent = `Tone ${effKey} → Không cần kẹp Capo (Bấm thế ${rec.shape} chuẩn)`;
    } else {
      textEl.textContent = `Tone ${effKey} → Gợi ý: Kẹp Capo ngăn ${rec.fret} (Đánh theo thế tay hợp âm ${rec.shape})`;
    }
  }

  /* ── Vocal Teleprompter View ──────────────────────────────── */
  function _renderVocalTeleprompter(xmlString, songTitle) {
    const container = document.getElementById('stage-lyric-content');
    if (!container) return;

    if (!xmlString) {
      container.innerHTML = '<div class="text-muted text-center py-2">Chưa có lời bài hát</div>';
      return;
    }

    // If LyricExtractor is available, use it or fallback parser
    let lyricsHtml = '';
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
      const parts = xmlDoc.querySelectorAll('measure');

      const stanzas = [];
      let currentStanza = [];
      let currentVerseNum = '1';

      parts.forEach((m, idx) => {
        const lyrics = m.querySelectorAll('lyric text');
        if (lyrics.length > 0) {
          const words = Array.from(lyrics).map(l => l.textContent.trim()).filter(Boolean);
          if (words.length > 0) {
            currentStanza.push(words.join(' '));
          }
        }
      });

      if (currentStanza.length > 0) {
        lyricsHtml = `
          <div class="teleprompter-section active">
            <div class="teleprompter-title">LỜI BÀI HÁT — ${songTitle}</div>
            <div class="teleprompter-lines" style="font-size: ${_vocalFontSize}rem;">
              ${currentStanza.map(line => `<div class="teleprompter-line">${line}</div>`).join('')}
            </div>
          </div>
        `;
      }
    } catch (e) {}

    if (!lyricsHtml) {
      lyricsHtml = `<div class="teleprompter-section active"><div class="teleprompter-lines" style="font-size:${_vocalFontSize}rem;">(Xem bản nhạc để theo dõi lời bài hát)</div></div>`;
    }

    container.innerHTML = lyricsHtml;
  }

  function _toggleVocalView() {
    _vocalViewMode = _vocalViewMode === 'sheet' ? 'lyrics' : 'sheet';
    const btn = document.getElementById('btn-vocal-toggle-view');
    if (btn) {
      btn.textContent = _vocalViewMode === 'lyrics' ? '🎼 Chuyển Xem: Bản Nhạc (Khuông)' : '📄 Chuyển Xem: Lời Nhạc Lớn (Teleprompter)';
      btn.classList.toggle('active', _vocalViewMode === 'lyrics');
    }
    _applyViewMode();
  }

  function _adjustVocalFontSize(delta) {
    _vocalFontSize = Math.max(1.0, Math.min(2.8, _vocalFontSize + delta));
    localStorage.setItem(STORAGE_FONT_SIZE_KEY, _vocalFontSize);
    document.querySelectorAll('.teleprompter-lines').forEach(el => {
      el.style.fontSize = `${_vocalFontSize}rem`;
    });
  }

  /* ── Role Management ──────────────────────────────────────── */
  function setRole(newRole, notify = true) {
    _role = newRole;
    localStorage.setItem(STORAGE_ROLE_KEY, newRole);

    if (_transport) {
      _transport.setRole?.(newRole);
    }

    const select = document.getElementById('stage-role-select');
    if (select) select.value = newRole;

    const iconEl = document.getElementById('role-pill-icon');
    const roleIcons = { leader: '👑', guitar: '🎸', piano: '🎹', vocal: '🎤', drummer: '🥁', viewer: '👀' };
    if (iconEl) iconEl.textContent = roleIcons[newRole] || '🎵';

    // Show/Hide Host Command Console
    const isHost = _mode === 'host' || newRole === 'leader';
    document.getElementById('host-command-console')?.classList.toggle('hidden', !isHost);

    // Show/Hide Role-Specific HUDs
    document.getElementById('hud-guitar')?.classList.toggle('hidden', newRole !== 'guitar');
    document.getElementById('hud-drummer')?.classList.toggle('hidden', newRole !== 'drummer');
    document.getElementById('hud-vocal')?.classList.toggle('hidden', newRole !== 'vocal');

    // Drummer Flasher LED loop
    if (newRole === 'drummer') {
      _startDrummerFlasher();
    } else {
      _stopDrummerFlasher();
    }

    _applyViewMode();

    if (notify) {
      showCueBanner(`Đã đổi vai trò: ${roleIcons[newRole]} ${newRole.toUpperCase()}`, '🎭', 2000);
    }
  }

  function _applyViewMode() {
    const emptyState = document.getElementById('stage-empty-state');
    const sheetWrapper = document.getElementById('stage-sheet-wrapper');
    const lyricWrapper = document.getElementById('stage-lyric-wrapper');
    if (!sheetWrapper || !lyricWrapper) return;

    if (!_currentSongId) {
      if (emptyState) emptyState.classList.remove('hidden');
      sheetWrapper.classList.add('hidden');
      lyricWrapper.classList.add('hidden');
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');
    if (_role === 'vocal' && _vocalViewMode === 'lyrics') {
      sheetWrapper.classList.add('hidden');
      lyricWrapper.classList.remove('hidden');
    } else {
      sheetWrapper.classList.remove('hidden');
      lyricWrapper.classList.add('hidden');
    }
  }

  /* ── Drummer Flasher LED ──────────────────────────────────── */
  function _startDrummerFlasher() {
    _stopDrummerFlasher();
    let beat = 1;
    const intervalMs = (60 / _currentBpm) * 1000;

    _drummerBeatInterval = setInterval(() => {
      document.querySelectorAll('#drummer-beat-leds .beat-led').forEach(el => {
        const b = parseInt(el.getAttribute('data-beat'));
        if (b === beat) {
          el.classList.add('flash');
          setTimeout(() => el.classList.remove('flash'), 120);
        }
      });
      beat = beat >= 4 ? 1 : beat + 1;
    }, intervalMs);
  }

  function _stopDrummerFlasher() {
    if (_drummerBeatInterval) {
      clearInterval(_drummerBeatInterval);
      _drummerBeatInterval = null;
    }
  }

  /* ── Roadmap Sections ─────────────────────────────────────── */
  async function _loadSections(songId) {
    const chipsContainer = document.getElementById('host-roadmap-chips');
    if (!chipsContainer) return;

    try {
      const res = await window.ApiService?.arrangements?.getSections?.(songId);
      _sections = Array.isArray(res?.data) ? res.data : [];

      if (_sections.length === 0) {
        chipsContainer.innerHTML = '<span class="roadmap-empty-hint">Chưa có phân đoạn bài hát</span>';
        return;
      }

      chipsContainer.innerHTML = _sections.map(sec => `
        <button class="roadmap-chip" data-type="${sec.type || 'verse'}" data-start="${sec.start_measure}" data-id="${sec.id}">
          ${sec.name} (${sec.start_measure}-${sec.end_measure})
        </button>
      `).join('');

      chipsContainer.querySelectorAll('.roadmap-chip').forEach(chip => {
        chip.addEventListener('click', (e) => {
          const startM = parseInt(e.currentTarget.getAttribute('data-start'));
          const secId = e.currentTarget.getAttribute('data-id');
          if (startM > 0) {
            _currentMeasure = startM;
            window.MusicalPosition?.scrollToMeasure?.(startM, true);
            if (_mode === 'host') {
              broadcastState({
                position: { measure: startM, sectionId: secId }
              });
            }
          }
        });
      });
    } catch (e) {
      chipsContainer.innerHTML = '<span class="roadmap-empty-hint">Chưa có phân đoạn bài hát</span>';
    }
  }

  function _highlightActiveSectionByMeasure(measure) {
    if (!_sections || _sections.length === 0) return;
    const chips = document.querySelectorAll('.roadmap-chip');
    chips.forEach(chip => {
      const start = parseInt(chip.getAttribute('data-start')) || 1;
      chip.classList.toggle('active', measure >= start && measure < start + 16);
    });
  }

  /* ── Setlist Picker (For Host) ────────────────────────────── */
  async function _openSetlistPicker() {
    const modal = document.getElementById('modal-pick-setlist');
    const list = document.getElementById('setlist-picker-list');
    if (!modal || !list) return;

    modal.classList.remove('hidden');
    try {
      const res = await window.ApiService?.setlists?.list?.();
      const setlists = Array.isArray(res?.data) ? res.data : [];

      if (setlists.length === 0) {
        list.innerHTML = '<div class="text-muted text-center py-2">Chưa có Setlist nào trong hệ thống</div>';
        return;
      }

      list.innerHTML = setlists.map(s => `
        <div class="setlist-pick-item" data-id="${s.id}">
          <div>
            <div class="setlist-item-title">${s.name}</div>
            <div class="setlist-item-meta">${s.description || 'Chương trình thờ phượng'}</div>
          </div>
          <button class="btn btn-sm btn-primary">Chọn</button>
        </div>
      `).join('');

      list.querySelectorAll('.setlist-pick-item').forEach(item => {
        item.addEventListener('click', async (e) => {
          const sId = e.currentTarget.getAttribute('data-id');
          await _selectSetlist(sId);
          _closeSetlistPicker();
        });
      });
    } catch (err) {
      list.innerHTML = '<div class="text-danger text-center py-2">Lỗi tải danh sách setlist</div>';
    }
  }

  function _closeSetlistPicker() {
    document.getElementById('modal-pick-setlist')?.classList.add('hidden');
  }

  async function _selectSetlist(setlistId) {
    try {
      const res = await window.ApiService?.setlists?.get?.(setlistId);
      _setlist = res?.data || null;
      _setlistIndex = 0;

      if (_setlist && _setlist.items && _setlist.items.length > 0) {
        showCueBanner(`📋 Đã nạp Setlist: ${_setlist.name} (${_setlist.items.length} bài)`, '✅', 3000);
        // Preload all XMLs in this setlist
        _setlist.items.forEach(async (it) => {
          if (it.song_id && !_cachedXmls.has(it.song_id)) {
            try {
              const r = await fetch(`/storage/Thanh ca/${it.song_id}.xml`);
              if (r.ok) _cachedXmls.set(it.song_id, await r.text());
            } catch (e) {}
          }
        });

        // Load first song
        const firstSongId = _setlist.items[0].song_id;
        hostSelectSong(firstSongId);
      }
    } catch (e) {}
  }

  /* ── Public API ───────────────────────────────────────────── */
  return {
    init,
    createHostRoom,
    joinRoom,
    leaveRoom,
    setRole,
    hostSelectSong,
    hostAdjustTranspose,
    hostAdjustBpm,
    hostTriggerCountIn,
    hostSendCue,
    hostPrevSong,
    hostNextSong,
    snapToHost,
    showRoomModal,
    hideRoomModal
  };
})();

// Auto-boot when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  LiveBandApp.init();
});

window.LiveBandApp = LiveBandApp;
