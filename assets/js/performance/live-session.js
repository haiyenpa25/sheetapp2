/**
 * assets/js/performance/live-session.js — Live Band Session State Machine & Manager
 * 
 * Manages Room Lifecycle:
 * - IDLE -> CONNECTING -> CONNECTED -> RECONNECTING -> CLOSED
 * - Generates QR Codes and 1-Click Share Links
 * - Enforces Host Authority with hostToken
 * - Offline-first preloading of Setlists
 */
const LiveSession = (() => {
  'use strict';

  const STORAGE_HOST_TOKEN_PREFIX = 'sheetapp_host_token_';
  const STORAGE_ROLE_KEY          = 'sheetapp_live_role';

  let _mode        = 'off'; // 'off' | 'host' | 'join'
  let _roomCode    = '';
  let _hostToken   = '';
  let _clientId    = '';
  let _role        = 'viewer'; // 'leader' | 'guitar' | 'piano' | 'vocal' | 'viewer'
  let _transport   = null;
  let _lastState   = null;
  let _connectionStatus = 'idle'; // 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'offline'

  function init() {
    _clientId = _getOrCreateClientId();
    _role     = localStorage.getItem(STORAGE_ROLE_KEY) || 'viewer';
    _transport = new PollingTransport(350);

    _transport.subscribe(_handleTransportMessage);
    _bindUI();
    _checkUrlParamAutoJoin();
  }

  function _getOrCreateClientId() {
    let id = localStorage.getItem('sheetapp_client_id');
    if (!id) {
      id = 'client-' + Math.random().toString(36).substring(2, 9) + '-' + Date.now().toString(36);
      localStorage.setItem('sheetapp_client_id', id);
    }
    return id;
  }

  function _bindUI() {
    const btnLiveSync = document.getElementById('btn-live-sync');
    if (btnLiveSync) btnLiveSync.addEventListener('click', showModal);

    document.getElementById('btn-close-livesync-modal')?.addEventListener('click', hideModal);
    document.getElementById('btn-start-host-room')?.addEventListener('click', _handleStartHost);
    document.getElementById('btn-join-live-room')?.addEventListener('click', _handleJoinRoom);
    document.getElementById('btn-leave-live-room')?.addEventListener('click', leaveRoom);
    document.getElementById('btn-copy-live-link')?.addEventListener('click', _handleCopyShareLink);

    // Role selector
    const roleSelect = document.getElementById('live-role-select');
    if (roleSelect) {
      roleSelect.value = _role;
      roleSelect.addEventListener('change', (e) => {
        setRole(e.target.value);
      });
    }
  }

  function showModal() {
    const modal = document.getElementById('livesync-modal');
    if (modal) {
      _updateModalUI();
      modal.classList.remove('hidden');
    }
  }

  function hideModal() {
    const modal = document.getElementById('livesync-modal');
    if (modal) modal.classList.add('hidden');
  }

  async function _handleStartHost() {
    const input = document.getElementById('host-room-code-input');
    let custom = input ? input.value.trim() : '';
    if (!custom) {
      custom = 'BAND-' + Math.floor(1000 + Math.random() * 9000);
    }
    custom = custom.toUpperCase().replace(/[^A-Z0-9_\-]/g, '');

    await startHost(custom);
    _updateModalUI();
  }

  async function _handleJoinRoom() {
    const input = document.getElementById('join-room-code-input');
    const code = input ? input.value.trim().toUpperCase() : '';
    if (!code) {
      window.App?.showToast?.('Vui lòng nhập Mã Phòng để tham gia!', 'warning');
      return;
    }
    await joinRoom(code);
    _updateModalUI();
  }

  async function startHost(roomCode) {
    _mode = 'host';
    _roomCode = roomCode;
    _role = 'leader';
    _connectionStatus = 'connecting';
    _updateBadgeUI();

    const leaderName = window.Auth?.getUser?.() || 'Ca Trưởng';
    const currentSongId = window.App?.getCurrentSongId?.() || '';
    const currentTranspose = window.Store?.get?.('currentTranspose') ?? 0;
    const currentBpm = window.Metronome?.getBpm?.() ?? 80;

    try {
      const res = await window.ApiService.liveSync.create(roomCode, {
        leader: { clientId: _clientId, name: leaderName },
        songId: currentSongId,
        transpose: currentTranspose,
        bpm: currentBpm,
        measure: window.MusicalPosition?.getVisibleMeasure?.() || 1
      });

      if (res && res.success) {
        _hostToken = res.hostToken;
        localStorage.setItem(STORAGE_HOST_TOKEN_PREFIX + roomCode, _hostToken);
        _connectionStatus = 'connected';
        _transport.connect(roomCode, { hostToken: _hostToken });
        _renderQR();
        window.App?.showToast?.(`📡 Đã mở phòng Live: ${roomCode}`, 'success');
        
        // Notify PerformanceEngine
        if (window.PerformanceEngine) {
          window.PerformanceEngine.onSessionStarted({ mode: 'host', room: roomCode, isHost: true });
        }
      } else {
        throw new Error(res.error || 'Không thể tạo phòng');
      }
    } catch (err) {
      window.App?.showToast?.('Lỗi mở phòng: ' + err.message, 'error');
      leaveRoom();
    }
  }

  async function joinRoom(roomCode) {
    _mode = 'join';
    _roomCode = roomCode;
    _connectionStatus = 'connecting';
    _updateBadgeUI();

    // Check if we previously had hostToken for this room
    const savedToken = localStorage.getItem(STORAGE_HOST_TOKEN_PREFIX + roomCode);
    _hostToken = savedToken || '';

    _transport.connect(roomCode, { hostToken: _hostToken });
    _renderQR();
    window.App?.showToast?.(`📡 Đã tham gia phòng Live: ${roomCode}`, 'success');

    // Notify PerformanceEngine
    if (window.PerformanceEngine) {
      window.PerformanceEngine.onSessionStarted({ mode: 'join', room: roomCode, isHost: false });
    }
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
    _updateBadgeUI();
    hideModal();

    if (window.PerformanceEngine) {
      window.PerformanceEngine.onSessionEnded();
    }
    window.App?.showToast?.('👋 Đã rời phòng Live Sync', 'info');
  }

  function broadcastState(patch = {}) {
    if (_mode !== 'host' || !_roomCode) return;

    const payload = {
      leader: { clientId: _clientId, name: window.Auth?.getUser?.() || 'Ca Trưởng' },
      song: {
        songId: window.App?.getCurrentSongId?.() || '',
        setlistId: window.SetlistUI?.getCurrentSetlist?.()?.id || null,
        setlistIndex: window.SetlistUI?.getCurrentIndex?.() || 0
      },
      music: {
        transpose: window.Store?.get?.('currentTranspose') ?? 0,
        chordProfile: window.ChordCanvas?.getCurrentSet?.() || 'HD',
        bpm: window.Metronome?.getBpm?.() ?? 80
      },
      position: {
        measure: window.MusicalPosition?.getVisibleMeasure?.() || 1
      },
      ...patch
    };

    _transport.send(_roomCode, _hostToken, payload).catch(() => {});
  }

  function _handleTransportMessage(msg) {
    if (!msg) return;

    if (msg.type === 'connection') {
      _connectionStatus = msg.status;
      _updateBadgeUI();
    } else if (msg.type === 'closed') {
      window.App?.showToast?.('📡 Phòng Live đã kết thúc bởi Trưởng ban.', 'info');
      leaveRoom();
    } else if (msg.type === 'state' && msg.state) {
      _lastState = msg.state;
      if (window.PerformanceEngine) {
        window.PerformanceEngine.applyRemoteState(msg.state);
      }
    }
  }

  function _checkUrlParamAutoJoin() {
    const params = new URLSearchParams(window.location.search);
    const liveCode = params.get('live');
    if (liveCode) {
      setTimeout(() => {
        joinRoom(liveCode.toUpperCase());
      }, 500);
    }
  }

  function _handleCopyShareLink() {
    if (!_roomCode) return;
    const url = new URL(window.location.origin + window.location.pathname);
    url.searchParams.set('live', _roomCode);
    
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url.href).then(() => {
        window.App?.showToast?.('📋 Đã sao chép link tham gia phòng Live!', 'success');
      }).catch(() => {
        _fallbackPromptCopy(url.href);
      });
    } else {
      _fallbackPromptCopy(url.href);
    }
  }

  function _fallbackPromptCopy(text) {
    prompt('Sao chép link tham gia phòng:', text);
  }

  function _renderQR() {
    const canvas = document.getElementById('live-qr-canvas');
    if (!canvas || !_roomCode) return;
    const url = new URL(window.location.origin + window.location.pathname);
    url.searchParams.set('live', _roomCode);
    QRHelper.drawQR(canvas, url.href, 180);
  }

  function setRole(newRole) {
    _role = newRole;
    localStorage.setItem(STORAGE_ROLE_KEY, newRole);
    window.App?.showToast?.(`Đã đổi vai trò: ${_getRoleLabel(newRole)}`, 'info');
    if (window.PerformanceEngine) {
      window.PerformanceEngine.applyRoleView(newRole);
    }
  }

  function _getRoleLabel(r) {
    const labels = {
      leader: '👑 Trưởng Ban / Ca Trưởng',
      guitar: '🎸 Guitar (Hiện Hợp Âm & Capo)',
      piano:  '🎹 Piano / Organ (Bản Nhạc 2 Tay)',
      vocal:  '🎤 Ca Đoàn (Chế Độ Lời Nhạc)',
      viewer: '👀 Khán Giả / Thành Viên'
    };
    return labels[r] || r;
  }

  function _updateModalUI() {
    const inSession = _mode !== 'off';
    const setupSection = document.getElementById('live-setup-section');
    const activeSection = document.getElementById('live-active-section');
    const roomCodeDisplay = document.getElementById('live-room-code-display');
    const roomLinkDisplay = document.getElementById('live-room-link-display');

    if (setupSection && activeSection) {
      setupSection.classList.toggle('hidden', inSession);
      activeSection.classList.toggle('hidden', !inSession);
    }

    if (inSession && roomCodeDisplay) {
      roomCodeDisplay.textContent = _roomCode;
      const url = new URL(window.location.origin + window.location.pathname);
      url.searchParams.set('live', _roomCode);
      if (roomLinkDisplay) roomLinkDisplay.value = url.href;
      _renderQR();
    }
  }

  function _updateBadgeUI() {
    const badge = document.getElementById('live-sync-badge');
    const btn = document.getElementById('btn-live-sync');
    if (badge) {
      if (_mode === 'host') {
        badge.textContent = `📡 LIVE (Host: ${_roomCode})`;
        badge.className = 'live-badge host-active';
        badge.classList.remove('hidden');
      } else if (_mode === 'join') {
        const icon = _connectionStatus === 'reconnecting' ? '🟡' : (_connectionStatus === 'offline' ? '🔴' : '📡');
        badge.textContent = `${icon} LIVE (Sync: ${_roomCode})`;
        badge.className = `live-badge join-active ${_connectionStatus}`;
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    }

    if (btn) {
      btn.classList.toggle('active-live', _mode !== 'off');
    }
  }

  return {
    init,
    showModal,
    hideModal,
    startHost,
    joinRoom,
    leaveRoom,
    broadcastState,
    setRole,
    getRole: () => _role,
    getMode: () => _mode,
    getRoomCode: () => _roomCode,
    isHost: () => _mode === 'host',
    isConnected: () => _connectionStatus === 'connected'
  };
})();

window.LiveSession = LiveSession;
