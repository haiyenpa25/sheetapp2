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
  let _currentChordSet    = 'HD';
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

  // Advanced Stage Features State
  let _isPadActive        = false;
  let _padAutoKey         = true;
  let _timerInterval      = null;
  let _timerMode          = 'off';       // 'off' | 'countdown' | 'stopwatch'
  let _timerRemainingSec  = 0;
  let _timerStopwatchSec  = 0;

  // Phase 2 Rehearsal State
  let _isLoopActive       = false;
  let _loopStartMeasure   = 1;
  let _loopEndMeasure     = 16;
  let _selectedSatbPart   = 'all';       // 'all' | 'soprano' | 'alto' | 'tenor' | 'bass'
  let _isInkActive        = false;

  // Band Live Sync & Instruments State
  let _tapTimestamps           = [];
  let _metronomeAudioCtx       = null;
  let _isMetronomeAudioEnabled = false;
  let _beatPulserInterval      = null;
  let _currentBeat             = 1;
  let _currentBandState        = 'normal';

  const BAND_STATES = {
    break:  { label: 'BREAK / NGẮT PHÁCH 1', icon: '🛑', color: '#ef4444' },
    build:  { label: 'BUILD-UP / DỒN NHỊP', icon: '🌊', color: '#3b82f6' },
    drop:   { label: 'ĐỆM ÊM / GIẢM VOLUME', icon: '🤫', color: '#8b5cf6' },
    drive:  { label: 'CAO TRÀO / FULL DRIVE', icon: '🔥', color: '#f97316' },
    solo:   { label: 'SOLO TIME (HẠ NỀN)', icon: '🎸', color: '#eab308' },
    end:    { label: 'DỨT KẾT / OUTRO', icon: '🏁', color: '#64748b' },
    normal: { label: 'CHƠI BÌNH THƯỜNG', icon: '🎵', color: '#10b981' }
  };

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

    // Start Master Visual Beat Pulser
    _startVisualBeatPulser();

    // Initialize Bluetooth Foot Pedal & Web MIDI Engine
    window.PedalMidiEngine?.init?.((action) => _handlePedalAction(action));

    // Initialize Collaborative Stage Ink Engine (Apple Pencil / S-Pen)
    window.StageInkEngine?.init?.('stage-annotation-layer', 'stage-osmd-container', {
      onBroadcast: (stroke) => {
        if (_mode === 'host') broadcastState({ inkStroke: stroke });
      },
      onClear: () => {
        if (_mode === 'host') broadcastState({ inkClear: true });
      }
    });

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

    // Quick Song Search in Host Console
    document.getElementById('host-song-search')?.addEventListener('input', (e) => {
      const q = (e.target.value || '').trim().toLowerCase();
      const dropdown = document.getElementById('host-song-dropdown');
      if (!dropdown) return;
      if (!q) {
        dropdown.innerHTML = '<option value="">-- Chọn bài hát phát sóng --</option>' +
          _songsList.map(s => `<option value="${s.id}">${s.httlvnId ? s.httlvnId + '. ' : ''}${s.title}</option>`).join('');
        return;
      }
      const filtered = _songsList.filter(s => {
        const idStr = String(s.id || '').toLowerCase();
        const titleStr = String(s.title || '').toLowerCase();
        const numStr = String(s.httlvnId || '');
        return idStr.includes(q) || titleStr.includes(q) || numStr === q;
      });
      dropdown.innerHTML = `<option value="">-- Tìm thấy ${filtered.length} bài --</option>` +
        filtered.map(s => `<option value="${s.id}">${s.httlvnId ? s.httlvnId + '. ' : ''}${s.title}</option>`).join('');
      if (filtered.length === 1 && _mode === 'host') {
        dropdown.value = filtered[0].id;
        hostSelectSong(filtered[0].id);
      }
    });

    // Host Chord Set Selector
    document.getElementById('host-chord-set-select')?.addEventListener('change', (e) => {
      if (_currentSongId) {
        _currentChordSet = e.target.value;
        if (_mode === 'host') {
          hostSelectSong(_currentSongId, _currentChordSet);
        } else {
          _loadSong(_currentSongId, _currentTranspose, _currentChordSet);
        }
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

    // ── Advanced Stage UI Bindings ──
    // Ambient Pad
    document.getElementById('btn-stage-pad')?.addEventListener('click', toggleAmbientPad);
    document.getElementById('btn-host-pad-toggle')?.addEventListener('click', toggleAmbientPad);
    document.getElementById('pad-volume-slider')?.addEventListener('input', (e) => {
      const val = parseInt(e.target.value) || 0;
      document.getElementById('pad-volume-val')?.replaceChildren(document.createTextNode(`${val}%`));
      window.AmbientPadEngine?.setVolume(val / 100);
    });
    document.getElementById('toggle-stereo-split')?.addEventListener('change', (e) => {
      window.AmbientPadEngine?.setStereoSplit(e.target.checked);
      showCueBanner(e.target.checked ? '🎧 Đã bật In-Ear Split (L: Click / R: Nhạc)' : '🎧 Đã chuyển Stereo Chuẩn', '🎧', 2500);
    });
    document.getElementById('toggle-pad-autokey')?.addEventListener('change', (e) => {
      _padAutoKey = e.target.checked;
    });

    // Projector View Open
    document.getElementById('btn-stage-projector')?.addEventListener('click', () => {
      const code = _roomCode || 'STAGE';
      window.open(`/live-band/projector.php?room=${encodeURIComponent(code)}`, '_blank');
    });

    // Stage Audio & Hardware Settings Modal
    document.getElementById('btn-stage-audio-settings')?.addEventListener('click', _showAudioSettingsModal);
    document.getElementById('btn-close-audio-settings')?.addEventListener('click', _hideAudioSettingsModal);
    document.getElementById('btn-test-pedal-action')?.addEventListener('click', () => {
      window.PedalMidiEngine?.dispatchAction('next', 'Thử Nghiệm');
    });

    // Countdown Timer Settings Modal
    document.getElementById('btn-stage-timer')?.addEventListener('click', _showTimerModal);
    document.getElementById('btn-close-timer-modal')?.addEventListener('click', _hideTimerModal);
    document.querySelectorAll('.timer-preset-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const mins = parseInt(e.currentTarget.getAttribute('data-minutes')) || 5;
        startCountdown(mins);
        _hideTimerModal();
      });
    });
    document.getElementById('btn-start-countdown')?.addEventListener('click', () => {
      const input = document.getElementById('timer-custom-minutes');
      const mins = parseInt(input?.value) || 10;
      startCountdown(mins);
      _hideTimerModal();
    });
    document.getElementById('btn-start-stopwatch')?.addEventListener('click', () => {
      startStopwatch();
      _hideTimerModal();
    });
    document.getElementById('btn-reset-timer')?.addEventListener('click', () => {
      resetTimer();
      _hideTimerModal();
    });

    // ── Phase 2 UI Bindings ──
    // A-B Rehearsal Loop
    document.getElementById('btn-toggle-ab-loop')?.addEventListener('click', toggleAbLoop);
    document.getElementById('loop-start-measure')?.addEventListener('change', (e) => {
      _loopStartMeasure = Math.max(1, parseInt(e.target.value) || 1);
    });
    document.getElementById('loop-end-measure')?.addEventListener('change', (e) => {
      _loopEndMeasure = Math.max(_loopStartMeasure + 1, parseInt(e.target.value) || (_loopStartMeasure + 8));
    });
    document.getElementById('btn-set-loop-current')?.addEventListener('click', () => {
      _loopStartMeasure = Math.max(1, _currentMeasure);
      _loopEndMeasure = _currentMeasure + 8;
      const startInp = document.getElementById('loop-start-measure');
      const endInp = document.getElementById('loop-end-measure');
      if (startInp) startInp.value = _loopStartMeasure;
      if (endInp) endInp.value = _loopEndMeasure;
      showCueBanner(`📍 Đặt đoạn lặp: Ô ${_loopStartMeasure} ➔ ${_loopEndMeasure}`, '📍', 2000);
    });

    // Collaborative Stage Ink Toolbar
    document.getElementById('btn-toggle-ink')?.addEventListener('click', toggleInkMode);
    document.querySelectorAll('.btn-ink-tool').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.btn-ink-tool').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        const tool = e.currentTarget.getAttribute('data-tool');
        const color = e.currentTarget.getAttribute('data-color');
        if (tool && window.StageInkEngine) {
          window.StageInkEngine.setTool(tool);
          if (color) window.StageInkEngine.setColor(color);
        }
      });
    });
    document.getElementById('btn-ink-clear-all')?.addEventListener('click', () => {
      if (confirm('Bạn có chắc muốn xóa tất cả nét vẽ trên bản nhạc?')) {
        window.StageInkEngine?.clearAll(true);
        showCueBanner('🧹 Đã xóa tất cả nét vẽ', '🧹', 1500);
      }
    });

    // SATB Voice Part Selection
    document.querySelectorAll('.btn-satb-part').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const part = e.currentTarget.getAttribute('data-part') || 'all';
        setSatbPart(part);
      });
    });

    // Band Live Sync & Tempo Pulser (Instruments & Teamplay)
    document.getElementById('btn-tap-tempo')?.addEventListener('click', _handleTapTempo);
    document.getElementById('btn-toggle-metronome-audio')?.addEventListener('click', _toggleMetronomeAudio);

    // Dynamic Band Energy State Buttons (1-Touch)
    document.querySelectorAll('.btn-band-state').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const stateKey = e.currentTarget.getAttribute('data-state');
        if (stateKey) setBandState(stateKey);
      });
    });

    // Section Transition Quick Cues & 2-Bar Heads-Up Warning
    document.querySelectorAll('.btn-quick-cue').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const secName = e.currentTarget.getAttribute('data-section');
        if (secName) cueSectionTransition(secName);
      });
    });
    document.getElementById('btn-cue-2bars-warning')?.addEventListener('click', cue2BarsWarning);

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
                // Check A-B Loop boundaries
                if (_isLoopActive && m >= _loopEndMeasure) {
                  _currentMeasure = _loopStartMeasure;
                  lastSent = now;
                  window.MusicalPosition?.scrollToMeasure?.(_loopStartMeasure, true);
                  showCueBanner(`🔁 Vòng lại đoạn A (Ô ${_loopStartMeasure})`, '🔁', 1500);
                  broadcastState({ position: { measure: _loopStartMeasure } });
                  ticking = false;
                  return;
                }

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
            if (_isLoopActive && currentVisMeasure >= _loopEndMeasure) {
              window.MusicalPosition?.scrollToMeasure?.(_loopStartMeasure, true);
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

    // 2. Song & Chord Set parameter
    const songId = params.get('song');
    const chordSet = params.get('set') || 'HD';
    const trans = parseInt(params.get('trans') || '0', 10);
    if (songId) {
      const dropdown = document.getElementById('host-song-dropdown');
      if (dropdown) dropdown.value = songId;
      await _loadSong(songId, isNaN(trans) ? 0 : trans, chordSet);
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

    // 1. Song Change & Chord Set Sync
    const targetSongId = state.song?.songId || state.songId;
    const targetChordSet = state.song?.chordSet || state.chordSet || 'HD';
    if (targetSongId && (targetSongId !== _currentSongId || targetChordSet !== _currentChordSet)) {
      const title = state.song?.songTitle || targetSongId;
      showCueBanner(`📡 Ca Trưởng chuyển bài: ${title} (${targetChordSet})`, '🎵', 3000);
      await _loadSong(targetSongId, state.music?.transpose ?? 0, targetChordSet);
    } else if (state.song?.chordSet && state.song.chordSet !== _currentChordSet) {
      // Chỉ đổi bộ hợp âm
      await _loadSong(_currentSongId, _currentTranspose, state.song.chordSet);
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
      _startVisualBeatPulser();
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

    // 7. A-B Rehearsal Loop Sync
    if (state.loop) {
      _isLoopActive = !!state.loop.active;
      _loopStartMeasure = state.loop.start || 1;
      _loopEndMeasure = state.loop.end || 16;
      const loopBtn = document.getElementById('btn-toggle-ab-loop');
      const loopLabel = document.getElementById('loop-btn-label');
      if (loopBtn) loopBtn.classList.toggle('active', _isLoopActive);
      if (loopLabel) loopLabel.textContent = _isLoopActive ? `Vòng Lặp: Ô ${_loopStartMeasure}-${_loopEndMeasure}` : 'Vòng Lặp A-B: Tắt';
    }

    // 8. Collaborative Stage Ink Sync
    if (state.inkStroke) {
      window.StageInkEngine?.renderRemoteStroke?.(state.inkStroke);
    }
    if (state.inkClear) {
      window.StageInkEngine?.clearAll?.(false);
    }

    // 9. Band Dynamic Energy State Sync (Teamplay)
    if (state.bandState && state.bandState.key) {
      _applyBandStateUI(state.bandState.key);
      showCueBanner(`⚡ LỆNH BAN NHẠC: ${state.bandState.label}`, state.bandState.icon || '⚡', 3500);
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
    _startVisualBeatPulser();
    broadcastState({
      music: { bpm: _currentBpm },
      song: { bpm: _currentBpm }
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

  /* ── Dynamic Chord Set Selector for Host ─────────────────── */
  async function _refreshHostChordSetSelect(songId, currentSet) {
    const sel = document.getElementById('host-chord-set-select');
    if (!sel) return;

    let available = ['HD', 'default'];
    try {
      const res = await window.ApiService?.chordSets?.list?.(songId);
      if (res && res.success && Array.isArray(res.sets) && res.sets.length > 0) {
        available = res.sets;
      }
    } catch (e) {}

    if (!available.includes('HD')) available.unshift('HD');
    if (!available.includes('default')) available.push('default');

    const target = currentSet || _currentChordSet || 'HD';
    const targetUpper = target.toUpperCase();

    sel.innerHTML = available.map(s => {
      const sUpper = s.toUpperCase();
      let label = s;
      if (s === 'default' || sUpper === 'TLH') label = 'TLH (Gốc) 🔒';
      else if (sUpper === 'HD') label = '⭐ HD';
      else if (sUpper === 'ADMIN') label = 'Admin';
      else if (sUpper === 'BH') label = 'Ban Hát';
      else label = s;
      const isSel = (sUpper === targetUpper) || (target === 'default' && s === 'default');
      return `<option value="${s}" ${isSel ? 'selected' : ''}>${label}</option>`;
    }).join('');

    // Đảm bảo target có trong option nếu chưa có
    const hasTarget = Array.from(sel.options).some(o => o.value.toUpperCase() === targetUpper);
    if (!hasTarget && target !== 'default' && targetUpper !== 'TLH') {
      const opt = document.createElement('option');
      opt.value = target;
      opt.textContent = target;
      opt.selected = true;
      sel.appendChild(opt);
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

  async function _loadSong(songId, transpose = 0, chordSet = null) {
    _currentSongId = songId;
    _currentTranspose = transpose;
    if (chordSet) _currentChordSet = chordSet;

    const emptyState = document.getElementById('stage-empty-state');
    const sheetWrapper = document.getElementById('stage-sheet-wrapper');
    const lyricWrapper = document.getElementById('stage-lyric-wrapper');

    if (emptyState) emptyState.classList.add('hidden');

    let rawXml = _cachedXmls.get(songId);
    if (!rawXml) {
      try {
        const songObj = _songsList.find(s => s.id === songId);
        let path = songObj?.xmlPath || `storage/Thanh ca/${songId}.xml`;
        if (!path.startsWith('/') && !path.startsWith('http')) {
          path = '/' + path;
        }
        const res = await fetch(path);
        if (res.ok) {
          rawXml = await res.text();
          _cachedXmls.set(songId, rawXml);
        }
      } catch (err) {
        console.warn('Error fetching XML for song:', songId, err);
      }
    }

    // Nạp bộ hợp âm cá nhân (HD, ADMIN, ...) và inject vào XML trước khi render OSMD
    let effectiveXml = rawXml || '';
    if (rawXml && window.ChordCanvasXML?.cloneAndInjectChords && _currentChordSet !== 'default' && _currentChordSet.toUpperCase() !== 'TLH') {
      try {
        const chordRes = await window.ApiService?.chordSets?.load(songId, _currentChordSet);
        if (chordRes && chordRes.success && Array.isArray(chordRes.chords)) {
          const chordsMap = {};
          chordRes.chords.forEach(c => {
            if (c && c.chord) {
              chordsMap[`${c.measureIdx}_${c.noteIdx}`] = c.chord;
            }
          });
          if (Object.keys(chordsMap).length > 0) {
            effectiveXml = window.ChordCanvasXML.cloneAndInjectChords(rawXml, chordsMap);
          }
        }
      } catch (err) {
        console.warn('[LiveBand] Load chords error:', err);
      }
    }

    _currentXmlString = effectiveXml || '';

    // Cập nhật nhãn bộ hợp âm trên Stage Pill
    const setBadge = document.getElementById('nav-song-set');
    if (setBadge) setBadge.textContent = `Bộ: ${_currentChordSet}`;

    // Cập nhật dropdown chọn bộ hợp âm của Host
    _refreshHostChordSetSelect(songId, _currentChordSet);

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
    _updateBassHud();
    _updatePianoHud();
    _startVisualBeatPulser();

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

    // Auto-update Ambient Pad key if active
    if (_isPadActive && _padAutoKey && window.AmbientPadEngine) {
      let effKey = _currentBaseKey;
      if (window.TransposeEngine && _currentTranspose !== 0) {
        effKey = window.TransposeEngine.transposeKey(_currentBaseKey, _currentTranspose) || _currentBaseKey;
      }
      window.AmbientPadEngine.playKey(effKey, true);
      _updatePadUI(true, effKey);
    }

    // Re-apply view mode for active role
    _applyViewMode();
  }

  function _setTranspose(val, isHostAction = false) {
    _currentTranspose = val;
    _updateKeyUI();
    _updateGuitarCapoHint();

    // Auto-update Ambient Pad key if active
    if (_isPadActive && _padAutoKey && window.AmbientPadEngine) {
      let effKey = _currentBaseKey;
      if (window.TransposeEngine && _currentTranspose !== 0) {
        effKey = window.TransposeEngine.transposeKey(_currentBaseKey, _currentTranspose) || _currentBaseKey;
      }
      window.AmbientPadEngine.playKey(effKey, true);
      _updatePadUI(true, effKey);
    }

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

    _updateGuitarCapoHint();
    _updateBassHud();
    _updatePianoHud();
  }

  function _updateBpmUI(bpm) {
    const bpmBadge = document.getElementById('nav-song-bpm');
    const hostBpmVal = document.getElementById('host-bpm-val');
    const drummerBpm = document.getElementById('drummer-bpm-display');
    const bandBpm = document.getElementById('band-tempo-bpm');

    if (bpmBadge) bpmBadge.textContent = `${bpm} BPM`;
    if (hostBpmVal) hostBpmVal.textContent = `${bpm} BPM`;
    if (drummerBpm) drummerBpm.textContent = `${bpm} BPM`;
    if (bandBpm) bandBpm.textContent = `${bpm} BPM`;
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
    const roleIcons = { leader: '👑', guitar: '🎸', bass: '🎸', piano: '🎹', vocal: '🎤', drummer: '🥁', viewer: '👀' };
    if (iconEl) iconEl.textContent = roleIcons[newRole] || '🎵';

    // Show/Hide Host Command Console
    const isHost = _mode === 'host' || newRole === 'leader';
    document.getElementById('host-command-console')?.classList.toggle('hidden', !isHost);

    // Show/Hide Role-Specific HUDs
    document.getElementById('hud-guitar')?.classList.toggle('hidden', newRole !== 'guitar');
    document.getElementById('hud-bass')?.classList.toggle('hidden', newRole !== 'bass');
    document.getElementById('hud-piano')?.classList.toggle('hidden', newRole !== 'piano');
    document.getElementById('hud-drummer')?.classList.toggle('hidden', newRole !== 'drummer');
    document.getElementById('hud-vocal')?.classList.toggle('hidden', newRole !== 'vocal');

    if (newRole === 'bass') {
      _updateBassHud();
    } else if (newRole === 'piano') {
      _updatePianoHud();
    }

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

  /* ── Master Beat Pulser & Metronome Audio ─────────────────── */
  function _handleTapTempo() {
    const now = performance.now();
    if (_tapTimestamps.length > 0 && (now - _tapTimestamps[_tapTimestamps.length - 1]) > 2000) {
      _tapTimestamps = [];
    }
    _tapTimestamps.push(now);

    const tapBtn = document.getElementById('btn-tap-tempo');
    if (tapBtn) {
      tapBtn.style.transform = 'scale(0.92)';
      setTimeout(() => { if (tapBtn) tapBtn.style.transform = ''; }, 100);
    }

    if (_tapTimestamps.length >= 2) {
      const intervals = [];
      for (let i = 1; i < _tapTimestamps.length; i++) {
        intervals.push(_tapTimestamps[i] - _tapTimestamps[i - 1]);
      }
      const recent = intervals.slice(-4);
      const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
      if (avg > 0) {
        let calculated = Math.round(60000 / avg);
        calculated = Math.max(40, Math.min(240, calculated));
        _currentBpm = calculated;
        _updateBpmUI(_currentBpm);
        _startVisualBeatPulser();

        if (_mode === 'host' || _role === 'leader') {
          broadcastState({
            music: { bpm: _currentBpm },
            song: { bpm: _currentBpm }
          });
        }
      }
    }
  }

  function _toggleMetronomeAudio() {
    _isMetronomeAudioEnabled = !_isMetronomeAudioEnabled;
    const btn = document.getElementById('btn-toggle-metronome-audio');
    if (btn) {
      btn.classList.toggle('active', _isMetronomeAudioEnabled);
      btn.textContent = _isMetronomeAudioEnabled ? '🔊 Click: Bật' : '🔇 Click: Tắt';
    }
    if (_isMetronomeAudioEnabled) {
      _initMetronomeAudioContext();
      showCueBanner('🔊 Đã bật Click nhịp tai nghe', '🎧', 1800);
    } else {
      showCueBanner('🔇 Đã tắt Click nhịp tai nghe', 'ℹ️', 1500);
    }
  }

  function _initMetronomeAudioContext() {
    if (!_metronomeAudioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        _metronomeAudioCtx = new AudioContextClass();
      }
    }
    if (_metronomeAudioCtx && _metronomeAudioCtx.state === 'suspended') {
      _metronomeAudioCtx.resume();
    }
  }

  function _playMetronomeClick(isBeatOne) {
    if (!_isMetronomeAudioEnabled || !_metronomeAudioCtx) return;
    try {
      if (_metronomeAudioCtx.state === 'suspended') {
        _metronomeAudioCtx.resume();
      }
      const osc = _metronomeAudioCtx.createOscillator();
      const gain = _metronomeAudioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.value = isBeatOne ? 960 : 540;

      const now = _metronomeAudioCtx.currentTime;
      gain.gain.setValueAtTime(isBeatOne ? 0.4 : 0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + (isBeatOne ? 0.05 : 0.035));

      osc.connect(gain);
      gain.connect(_metronomeAudioCtx.destination);

      osc.start(now);
      osc.stop(now + (isBeatOne ? 0.05 : 0.035));
    } catch (e) {}
  }

  function _startVisualBeatPulser() {
    _stopVisualBeatPulser();
    const intervalMs = (60 / Math.max(40, _currentBpm)) * 1000;

    _beatPulserInterval = setInterval(() => {
      const isBeatOne = (_currentBeat === 1);

      // Flash Strip LEDs
      document.querySelectorAll('#stage-beat-pulser .pulse-led').forEach(el => {
        const b = parseInt(el.getAttribute('data-beat'));
        if (b === _currentBeat) {
          el.classList.add(isBeatOne ? 'flash-beat-1' : 'flash-beat-sub');
          setTimeout(() => el.classList.remove('flash-beat-1', 'flash-beat-sub'), 110);
        }
      });

      // Flash Drummer HUD LEDs
      document.querySelectorAll('#drummer-beat-leds .beat-led').forEach(el => {
        const b = parseInt(el.getAttribute('data-beat'));
        if (b === _currentBeat) {
          el.classList.add('flash');
          setTimeout(() => el.classList.remove('flash'), 110);
        }
      });

      // Play audio click if enabled
      _playMetronomeClick(isBeatOne);

      _currentBeat = (_currentBeat >= 4) ? 1 : _currentBeat + 1;
    }, intervalMs);
  }

  function _stopVisualBeatPulser() {
    if (_beatPulserInterval) {
      clearInterval(_beatPulserInterval);
      _beatPulserInterval = null;
    }
  }

  function _startDrummerFlasher() {
    _startVisualBeatPulser();
  }

  function _stopDrummerFlasher() {
    // Keep running master visual beat pulser
  }

  /* ── Band Dynamic Energy States (Teamplay Actions) ───────── */
  function setBandState(stateKey, broadcast = true) {
    const st = BAND_STATES[stateKey] || BAND_STATES.normal;
    _currentBandState = stateKey;

    _applyBandStateUI(stateKey);
    showCueBanner(`⚡ LỆNH BAN NHẠC: ${st.label}`, st.icon, 3500);

    if (broadcast && (_mode === 'host' || _role === 'leader')) {
      broadcastState({
        bandState: {
          key: stateKey,
          label: st.label,
          icon: st.icon
        }
      });
    }
  }

  function _applyBandStateUI(stateKey) {
    const st = BAND_STATES[stateKey] || BAND_STATES.normal;
    const textEl = document.getElementById('band-state-text');
    const pillEl = document.getElementById('band-current-state-pill');
    if (textEl) textEl.textContent = st.label;
    if (pillEl) {
      pillEl.style.borderColor = st.color;
      pillEl.style.boxShadow = `0 0 16px ${st.color}40`;
    }

    document.querySelectorAll('.btn-band-state').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-state') === stateKey);
    });
  }

  /* ── Section Transitions & 2-Bar Warning Cue ──────────────── */
  function cueSectionTransition(sectionName) {
    showCueBanner(`⚡ CHUYỂN KHÚC: ${sectionName.toUpperCase()}!`, '⚡', 3500);

    if (_sections && _sections.length > 0) {
      const match = _sections.find(s => s.name && s.name.toLowerCase().includes(sectionName.toLowerCase()));
      if (match && match.start_measure > 0) {
        _currentMeasure = match.start_measure;
        window.MusicalPosition?.scrollToMeasure?.(match.start_measure, true);
        if (_mode === 'host' || _role === 'leader') {
          broadcastState({
            position: { measure: match.start_measure, sectionId: match.id },
            cue: { text: `⚡ CHUYỂN KHÚC: ${match.name.toUpperCase()} (Ô ${match.start_measure})`, icon: '⚡' }
          });
          return;
        }
      }
    }

    if (_mode === 'host' || _role === 'leader') {
      broadcastState({
        cue: { text: `⚡ CHUYỂN KHÚC: ${sectionName.toUpperCase()}!`, icon: '⚡' }
      });
    }
  }

  function cue2BarsWarning() {
    const cueBtn = document.getElementById('btn-cue-2bars-warning');
    if (cueBtn) {
      cueBtn.classList.add('active');
      setTimeout(() => cueBtn.classList.remove('active'), 1500);
    }

    showCueBanner('⚠️ CHUẨN BỊ CHUYỂN KHÚC SAU 2 Ô NHỊP!', '⚠️', 4500);

    if (_mode === 'host' || _role === 'leader') {
      broadcastState({
        cue: {
          text: '⚠️ CHUẨN BỊ CHUYỂN KHÚC SAU 2 Ô NHỊP!',
          icon: '⚠️',
          durationMs: 4500
        }
      });
    }
  }

  /* ── Bass HUD updater ──────────────────────────────────────── */
  function _updateBassHud(currentChordText = null) {
    let effKey = _currentBaseKey;
    if (window.TransposeEngine && _currentTranspose !== 0) {
      effKey = window.TransposeEngine.transposeKey(_currentBaseKey, _currentTranspose) || _currentBaseKey;
    }

    const scaleRootsMap = {
      'C':  ['C', 'D', 'E', 'F', 'G', 'A', 'B'],
      'G':  ['G', 'A', 'B', 'C', 'D', 'E', 'F#'],
      'D':  ['D', 'E', 'F#', 'G', 'A', 'B', 'C#'],
      'A':  ['A', 'B', 'C#', 'D', 'E', 'F#', 'G#'],
      'E':  ['E', 'F#', 'G#', 'A', 'B', 'C#', 'D#'],
      'B':  ['B', 'C#', 'D#', 'E', 'F#', 'G#', 'A#'],
      'F':  ['F', 'G', 'A', 'Bb', 'C', 'D', 'E'],
      'Bb': ['Bb', 'C', 'D', 'Eb', 'F', 'G', 'A'],
      'Eb': ['Eb', 'F', 'G', 'Ab', 'Bb', 'C', 'D'],
      'Ab': ['Ab', 'Bb', 'C', 'Db', 'Eb', 'F', 'G'],
      'Db': ['Db', 'Eb', 'F', 'Gb', 'Ab', 'Bb', 'C'],
      'Am': ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
      'Em': ['E', 'F#', 'G', 'A', 'B', 'C', 'D'],
      'Dm': ['D', 'E', 'F', 'G', 'A', 'Bb', 'C'],
      'Bm': ['B', 'C#', 'D', 'E', 'F#', 'G', 'A'],
      'F#m':['F#', 'G#', 'A', 'B', 'C#', 'D', 'E'],
      'Gm': ['G', 'A', 'Bb', 'C', 'D', 'Eb', 'F'],
      'Cm': ['C', 'D', 'Eb', 'F', 'G', 'Ab', 'Bb']
    };

    const roots = scaleRootsMap[effKey] || ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
    const scaleChipsEl = document.getElementById('bass-scale-chips');
    if (scaleChipsEl) {
      scaleChipsEl.innerHTML = roots.map((r, i) => `
        <span class="bass-root-chip ${i === 0 ? 'active' : ''}">${r}</span>
      `).join('');
    }

    let bassNote = roots[0];
    let isSlash = false;
    let hintText = 'Nốt gốc cơ bản';

    if (currentChordText) {
      const parts = currentChordText.split('/');
      if (parts.length === 2 && parts[1].trim()) {
        bassNote = parts[1].trim();
        isSlash = true;
        hintText = `Hợp âm đảo: Bass bấm nốt ${bassNote}`;
      } else {
        const rootMatch = currentChordText.match(/^[A-G][#b]?/);
        if (rootMatch) {
          bassNote = rootMatch[0];
        }
      }
    }

    const rootEl = document.getElementById('bass-root-note');
    const hintEl = document.getElementById('bass-slash-hint');
    if (rootEl) rootEl.textContent = bassNote;
    if (hintEl) {
      hintEl.textContent = hintText;
      hintEl.style.color = isSlash ? '#f59e0b' : '#94a3b8';
    }
  }

  /* ── Piano / Keyboard HUD updater ─────────────────────────── */
  function _updatePianoHud() {
    let effKey = _currentBaseKey;
    if (window.TransposeEngine && _currentTranspose !== 0) {
      effKey = window.TransposeEngine.transposeKey(_currentBaseKey, _currentTranspose) || _currentBaseKey;
    }

    const voicingsMap = {
      'C':  ['Cmaj7', 'Dm7', 'Em7', 'Fmaj7', 'G7', 'Am7', 'Bm7b5'],
      'G':  ['Gmaj7', 'Am7', 'Bm7', 'Cmaj7', 'D7', 'Em7', 'F#m7b5'],
      'D':  ['Dmaj7', 'Em7', 'F#m7', 'Gmaj7', 'A7', 'Bm7', 'C#m7b5'],
      'A':  ['Amaj7', 'Bm7', 'C#m7', 'Dmaj7', 'E7', 'F#m7', 'G#m7b5'],
      'E':  ['Emaj7', 'F#m7', 'G#m7', 'Amaj7', 'B7', 'C#m7', 'D#m7b5'],
      'F':  ['Fmaj7', 'Gm7', 'Am7', 'Bbmaj7', 'C7', 'Dm7', 'Em7b5'],
      'Bb': ['Bbmaj7', 'Cm7', 'Dm7', 'Ebmaj7', 'F7', 'Gm7', 'Am7b5'],
      'Eb': ['Ebmaj7', 'Fm7', 'Gm7', 'Abmaj7', 'Bb7', 'Cm7', 'Dm7b5'],
      'Am': ['Am7', 'Bm7b5', 'Cmaj7', 'Dm7', 'Em7', 'Fmaj7', 'G7'],
      'Em': ['Em7', 'F#m7b5', 'Gmaj7', 'Am7', 'Bm7', 'Cmaj7', 'D7'],
      'Dm': ['Dm7', 'Em7b5', 'Fmaj7', 'Gm7', 'Am7', 'Bbmaj7', 'C7']
    };

    const voicings = voicingsMap[effKey] || ['Cmaj7', 'Dm7', 'Em7', 'Fmaj7', 'G7', 'Am7', 'Bm7b5'];
    const voicingChipsEl = document.getElementById('piano-voicing-chips');
    if (voicingChipsEl) {
      voicingChipsEl.innerHTML = voicings.map(v => `
        <span class="piano-voicing-chip">${v}</span>
      `).join('');
    }

    const progEl = document.getElementById('piano-progression-text');
    if (progEl) {
      progEl.textContent = effKey.endsWith('m') ? 'i - iv - V7 - VI' : 'I - IV - V7 - vi';
    }

    const padEl = document.getElementById('piano-pad-sync-badge');
    if (padEl) {
      const isPadOn = window.AmbientPadEngine?.isPlaying?.();
      padEl.textContent = isPadOn ? `🎹 Pad: Tông ${effKey} [BẬT]` : '🎹 Pad: Tắt';
      padEl.style.color = isPadOn ? '#c084fc' : '#94a3b8';
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

  /* ── Ambient Pad Synth Controller ─────────────────────────── */
  function toggleAmbientPad() {
    if (!window.AmbientPadEngine) return;
    let effectiveKey = _currentBaseKey;
    if (window.TransposeEngine && _currentTranspose !== 0) {
      effectiveKey = window.TransposeEngine.transposeKey(_currentBaseKey, _currentTranspose) || _currentBaseKey;
    }

    const isNowPlaying = window.AmbientPadEngine.toggle(effectiveKey);
    _isPadActive = isNowPlaying;
    _updatePadUI(isNowPlaying, effectiveKey);
    showCueBanner(isNowPlaying ? `🎹 Bật Ambient Pad: Tông ${effectiveKey}` : '🎹 Đã tắt Ambient Pad', '🎹', 2000);
  }

  function _updatePadUI(isActive, key) {
    const navPill = document.getElementById('btn-stage-pad');
    const navLabel = document.getElementById('nav-pad-label');
    const hostBtnText = document.getElementById('host-pad-btn-text');

    if (navPill) navPill.classList.toggle('active', isActive);
    if (navLabel) navLabel.textContent = isActive ? `Pad: ${key}` : 'Pad: Tắt';
    if (hostBtnText) hostBtnText.textContent = isActive ? `Tắt Pad (${key})` : 'Bật Pad Drone';
  }

  /* ── Foot Pedal & MIDI Action Handler ─────────────────────── */
  function _handlePedalAction(action) {
    if (action === 'next') {
      const activeChip = document.querySelector('.roadmap-chip.active');
      const nextChip = activeChip ? activeChip.nextElementSibling : document.querySelector('.roadmap-chip');
      if (nextChip && nextChip.classList.contains('roadmap-chip')) {
        nextChip.click();
      } else {
        const targetM = _currentMeasure + 4;
        _currentMeasure = targetM;
        window.MusicalPosition?.scrollToMeasure?.(targetM, true);
        if (_mode === 'host') broadcastState({ position: { measure: targetM } });
      }
    } else if (action === 'prev') {
      const activeChip = document.querySelector('.roadmap-chip.active');
      const prevChip = activeChip ? activeChip.previousElementSibling : null;
      if (prevChip && prevChip.classList.contains('roadmap-chip')) {
        prevChip.click();
      } else {
        const targetM = Math.max(1, _currentMeasure - 4);
        _currentMeasure = targetM;
        window.MusicalPosition?.scrollToMeasure?.(targetM, true);
        if (_mode === 'host') broadcastState({ position: { measure: targetM } });
      }
    } else if (action === 'countin') {
      if (_mode === 'host') {
        hostTriggerCountIn();
      } else {
        _triggerVisualCountIn({ bpm: _currentBpm, beats: 4 });
      }
    } else if (action === 'chorus') {
      if (_mode === 'host') hostSendCue('chorus');
    } else if (action === 'snap') {
      snapToHost();
    }
  }

  /* ── Service Countdown Timer Controller ───────────────────── */
  function startCountdown(minutes) {
    clearInterval(_timerInterval);
    _timerMode = 'countdown';
    _timerRemainingSec = minutes * 60;
    _tickTimer();
    _timerInterval = setInterval(_tickTimer, 1000);
    showCueBanner(`⏱️ Bắt đầu đếm ngược ${minutes} phút`, '⏱️', 2000);
  }

  function startStopwatch() {
    clearInterval(_timerInterval);
    _timerMode = 'stopwatch';
    _timerStopwatchSec = 0;
    _tickTimer();
    _timerInterval = setInterval(_tickTimer, 1000);
    showCueBanner('⏱️ Bắt đầu bấm giờ sân khấu', '⏱️', 2000);
  }

  function resetTimer() {
    clearInterval(_timerInterval);
    _timerInterval = null;
    _timerMode = 'off';
    _timerRemainingSec = 0;
    _timerStopwatchSec = 0;
    const label = document.getElementById('nav-timer-label');
    const pill = document.getElementById('btn-stage-timer');
    if (label) label.textContent = '00:00';
    if (pill) pill.classList.remove('urgent');
    showCueBanner('⏱️ Đã đặt lại đồng hồ', '⏱️', 1500);
  }

  function _tickTimer() {
    const label = document.getElementById('nav-timer-label');
    const pill = document.getElementById('btn-stage-timer');
    if (!label) return;

    if (_timerMode === 'countdown') {
      if (_timerRemainingSec > 0) {
        _timerRemainingSec--;
        const m = Math.floor(_timerRemainingSec / 60);
        const s = _timerRemainingSec % 60;
        label.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        if (pill) pill.classList.toggle('urgent', _timerRemainingSec <= 60);
      } else {
        label.textContent = '00:00';
        if (pill) pill.classList.add('urgent');
        clearInterval(_timerInterval);
        showCueBanner('🔔 ĐÃ ĐẾN GIỜ KHAI LỄ / BIỂU DIỄN!', '🔔', 5000);
      }
    } else if (_timerMode === 'stopwatch') {
      _timerStopwatchSec++;
      const m = Math.floor(_timerStopwatchSec / 60);
      const s = _timerStopwatchSec % 60;
      label.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
  }

  /* ── Modals Triggers ──────────────────────────────────────── */
  function _showAudioSettingsModal() {
    document.getElementById('modal-stage-audio-settings')?.classList.remove('hidden');
  }

  function _hideAudioSettingsModal() {
    document.getElementById('modal-stage-audio-settings')?.classList.add('hidden');
  }

  function _showTimerModal() {
    document.getElementById('modal-stage-timer-settings')?.classList.remove('hidden');
  }

  function _hideTimerModal() {
    document.getElementById('modal-stage-timer-settings')?.classList.add('hidden');
  }

  /* ── Phase 2: A-B Rehearsal Looping Controller ────────────── */
  function toggleAbLoop() {
    _isLoopActive = !_isLoopActive;
    const loopBtn = document.getElementById('btn-toggle-ab-loop');
    const loopLabel = document.getElementById('loop-btn-label');

    const startInp = document.getElementById('loop-start-measure');
    const endInp = document.getElementById('loop-end-measure');
    if (startInp) _loopStartMeasure = Math.max(1, parseInt(startInp.value) || 1);
    if (endInp) _loopEndMeasure = Math.max(_loopStartMeasure + 1, parseInt(endInp.value) || (_loopStartMeasure + 8));

    if (loopBtn) loopBtn.classList.toggle('active', _isLoopActive);
    if (loopLabel) loopLabel.textContent = _isLoopActive ? `Vòng Lặp: Ô ${_loopStartMeasure}-${_loopEndMeasure}` : 'Vòng Lặp A-B: Tắt';

    if (_isLoopActive) {
      showCueBanner(`🔁 Bật Vòng Lặp Tập: Ô ${_loopStartMeasure} ➔ ${_loopEndMeasure}`, '🔁', 2500);
      _currentMeasure = _loopStartMeasure;
      window.MusicalPosition?.scrollToMeasure?.(_loopStartMeasure, true);
    } else {
      showCueBanner('🔁 Đã tắt Vòng Lặp Tập A-B', 'ℹ️', 1500);
    }

    if (_mode === 'host') {
      broadcastState({
        loop: {
          active: _isLoopActive,
          start: _loopStartMeasure,
          end: _loopEndMeasure
        },
        position: { measure: _currentMeasure }
      });
    }
  }

  /* ── Phase 2: Collaborative Stage Ink Controller ─────────── */
  function toggleInkMode() {
    _isInkActive = !_isInkActive;
    const btn = document.getElementById('btn-toggle-ink');
    const tools = document.getElementById('ink-tools-group');

    if (btn) btn.classList.toggle('active', _isInkActive);
    if (tools) tools.classList.toggle('hidden', !_isInkActive);

    window.StageInkEngine?.setEnabled(_isInkActive);
    showCueBanner(_isInkActive ? '✏️ Bật Bút Vẽ Chú Thích (Apple Pencil / Chạm)' : '✏️ Tắt Bút Chú Thích', '✏️', 1800);
  }

  /* ── Phase 2: SATB Vocal Part RehearsalMix Controller ────── */
  function setSatbPart(part) {
    _selectedSatbPart = part;
    document.querySelectorAll('.btn-satb-part').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-part') === part);
    });

    const satbLabel = document.querySelector('.satb-label');
    if (satbLabel) {
      satbLabel.textContent = part === 'all' ? '🎧 Tách Bè Solo:' : `🎧 Bè [${part.toUpperCase()}]: +3dB Solo`;
    }

    showCueBanner(part === 'all' ? '👑 Đã chọn: Tất Cả Bè (Tutti)' : `🎤 Đã chọn: Bè ${part.toUpperCase()} (+3dB Solo)`, '🎤', 2000);
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
    hideRoomModal,
    toggleAmbientPad,
    startCountdown,
    resetTimer,
    toggleAbLoop,
    toggleInkMode,
    setSatbPart,
    setBandState,
    cueSectionTransition,
    cue2BarsWarning,
    handleTapTempo: _handleTapTempo,
    toggleMetronomeAudio: _toggleMetronomeAudio
  };
})();

// Auto-boot when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  LiveBandApp.init();
});

window.LiveBandApp = LiveBandApp;
