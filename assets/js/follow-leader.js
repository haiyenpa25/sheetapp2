/**
 * assets/js/follow-leader.js — Follow Leader UI & Controller (Ticket L3-5)
 * 
 * Manages:
 * - Toolbar button #btn-follow-leader & dropdown item
 * - Connect modal #follow-leader-modal (join room, QR scanner, host room)
 * - Main page floating status banner #follow-leader-banner
 * - Pause / Resume state machine for followers
 * - Synchronized 4 elements: song, transpose, verse, position
 */
const FollowLeader = (() => {
  'use strict';

  let _isFollowing = false;
  let _isPaused = false;
  let _leaderName = 'Ca Trưởng';
  let _roomCode = '';
  let _pendingState = null;
  let _videoStream = null;
  let _scanInterval = null;

  function init() {
    _bindToolbarEvents();
    _bindModalEvents();
    _bindBannerEvents();
    _checkUrlParamAutoJoin();
  }

  function _bindToolbarEvents() {
    const btnToolbar = document.getElementById('btn-follow-leader');
    if (btnToolbar) {
      btnToolbar.addEventListener('click', (e) => {
        e.preventDefault();
        openModal();
      });
    }

    const btnMenu = document.getElementById('btn-menu-follow-leader');
    if (btnMenu) {
      btnMenu.addEventListener('click', (e) => {
        e.preventDefault();
        openModal();
      });
    }
  }

  function _bindModalEvents() {
    // Nút đóng modal
    document.getElementById('btn-close-follow-modal')?.addEventListener('click', closeModal);

    // Chuyển tabs trong modal
    const tabFollower = document.getElementById('fl-tab-follower');
    const tabHost = document.getElementById('fl-tab-host');

    if (tabFollower && tabHost) {
      tabFollower.addEventListener('click', (e) => {
        e.preventDefault();
        switchTab('follower');
      });

      tabHost.addEventListener('click', (e) => {
        e.preventDefault();
        switchTab('host');
      });
    }

    // Nút Tham gia theo dõi (Follower)
    document.getElementById('btn-fl-join-submit')?.addEventListener('click', async (e) => {
      e?.preventDefault?.();
      const input = document.getElementById('fl-room-input');
      const code = input ? input.value.trim().toUpperCase() : '';
      if (!code) {
        window.App?.showToast?.('Vui lòng nhập mã phòng của Ca Trưởng!', 'warning');
        return;
      }
      await join(code);
    });

    // Enter trong input mã phòng
    document.getElementById('fl-room-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('btn-fl-join-submit')?.click();
      }
    });

    // Nút Bật/Tắt Camera quét QR
    document.getElementById('btn-fl-toggle-qr-cam')?.addEventListener('click', _toggleQrScanner);

    // Nút Mở phòng Ca Trưởng (Host)
    document.getElementById('btn-fl-host-submit')?.addEventListener('click', async (e) => {
      e?.preventDefault?.();
      const input = document.getElementById('fl-host-code-input');
      let custom = input ? input.value.trim() : '';
      if (!custom) {
        custom = 'BAND-' + Math.floor(1000 + Math.random() * 9000);
      }
      custom = custom.toUpperCase().replace(/[^A-Z0-9_\-]/g, '');
      await startHost(custom);
    });

    // Nút Copy link
    document.getElementById('btn-fl-copy-share-link')?.addEventListener('click', () => {
      const input = document.getElementById('fl-host-link-display');
      if (input && input.value) {
        navigator.clipboard?.writeText(input.value).then(() => {
          window.App?.showToast?.('📋 Đã sao chép link tham gia!', 'success');
        }).catch(() => {
          prompt('Sao chép link tham gia:', input.value);
        });
      }
    });

    // Nút Rời phòng từ host modal
    document.getElementById('btn-fl-host-leave')?.addEventListener('click', leave);
  }

  function _bindBannerEvents() {
    // Nút Tạm ngưng / Theo lại
    document.getElementById('btn-follow-toggle-pause')?.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePause();
    });

    // Nút Rời phòng
    document.getElementById('btn-follow-leave')?.addEventListener('click', (e) => {
      e.stopPropagation();
      leave();
    });
  }

  function openModal() {
    const modal = document.getElementById('follow-leader-modal');
    if (modal) {
      if (window.ModalManager) {
        window.ModalManager.open(modal);
      } else {
        modal.classList.remove('hidden');
      }
      _syncModalHostView();
    }
    // Tải trước ngầm các module mà không chặn việc mở modal
    _ensureLiveLoaded().then(() => {
      _syncModalHostView();
    }).catch(err => console.warn('[FollowLeader] Preload live modules error:', err));
  }

  function switchTab(tabName) {
    const tabFollower = document.getElementById('fl-tab-follower');
    const tabHost = document.getElementById('fl-tab-host');
    const panelFollower = document.getElementById('fl-panel-follower');
    const panelHost = document.getElementById('fl-panel-host');

    if (tabName === 'host') {
      tabHost?.classList.add('active');
      tabHost?.setAttribute('aria-selected', 'true');
      tabFollower?.classList.remove('active');
      tabFollower?.setAttribute('aria-selected', 'false');
      panelHost?.classList.remove('hidden');
      panelFollower?.classList.add('hidden');
      _stopQrScanner();
    } else {
      tabFollower?.classList.add('active');
      tabFollower?.setAttribute('aria-selected', 'true');
      tabHost?.classList.remove('active');
      tabHost?.setAttribute('aria-selected', 'false');
      panelFollower?.classList.remove('hidden');
      panelHost?.classList.add('hidden');
    }
  }

  function closeModal() {
    const modal = document.getElementById('follow-leader-modal');
    if (modal) {
      if (window.ModalManager) {
        window.ModalManager.close(modal);
      } else {
        modal.classList.add('hidden');
      }
    }
    _stopQrScanner();
  }

  async function _ensureLiveLoaded() {
    if (window.LiveSync?.ensureLoaded) {
      await window.LiveSync.ensureLoaded();
    }
  }

  async function join(roomCode) {
    console.log('[FollowLeader] join called with:', roomCode);
    if (!roomCode) return;
    await _ensureLiveLoaded();
    _roomCode = roomCode.toUpperCase();
    _isFollowing = true;
    _isPaused = false;
    _pendingState = null;

    closeModal();
    _updateBannerUI();

    if (window.LiveSession?.joinRoom) {
      await window.LiveSession.joinRoom(_roomCode);
    }
    window.App?.showToast?.(`📡 Đang theo dõi phòng: ${_roomCode}`, 'success');
  }

  async function startHost(roomCode) {
    if (!roomCode) return;
    await _ensureLiveLoaded();
    _roomCode = roomCode.toUpperCase();
    _isFollowing = false;

    if (window.LiveSession?.startHost) {
      await window.LiveSession.startHost(_roomCode);
    }
    _syncModalHostView();
  }

  function leave() {
    _isFollowing = false;
    _isPaused = false;
    _roomCode = '';
    _pendingState = null;
    _leaderName = 'Ca Trưởng';

    if (window.LiveSession?.leaveRoom) {
      window.LiveSession.leaveRoom();
    }
    _updateBannerUI();
    closeModal();
    window.App?.showToast?.('👋 Đã rời phòng theo dõi', 'info');
  }

  function pause() {
    if (!_isFollowing || _isPaused) return;
    _isPaused = true;
    _updateBannerUI();
    window.App?.showToast?.('⏸️ Đã tạm ngưng theo ca trưởng. Bản nhạc của bạn sẽ không bị chuyển.', 'info');
  }

  function resume() {
    if (!_isFollowing || !_isPaused) return;
    _isPaused = false;
    _updateBannerUI();
    window.App?.showToast?.('▶️ Đã tiếp tục theo ca trưởng.', 'success');

    // Áp dụng ngay lập tức trạng thái mới nhất nhận được
    const stateToApply = _pendingState || window.LiveSession?.getLastState?.();
    if (stateToApply && window.PerformanceEngine?.applyPendingState) {
      window.PerformanceEngine.applyPendingState(stateToApply);
      _pendingState = null;
    }
  }

  function togglePause() {
    if (_isPaused) {
      resume();
    } else {
      pause();
    }
  }

  function onRemoteStateReceived(state) {
    if (!state) return;
    if (state.leader?.name) {
      _leaderName = state.leader.name;
      _updateBannerLeaderName();
    }
    if (_isPaused) {
      _pendingState = state;
    }
  }

  function onConnectionChange(status) {
    if (!_isFollowing) return;
    const dot = document.getElementById('fl-pulse-dot');
    if (dot) {
      dot.className = 'fl-pulse-dot ' + (status === 'connected' ? 'connected' : 'connecting');
    }
  }

  function _updateBannerUI() {
    const banner = document.getElementById('follow-leader-banner');
    const btnToolbar = document.getElementById('btn-follow-leader');
    const btnPause = document.getElementById('btn-follow-toggle-pause');
    const pauseIcon = document.getElementById('fl-pause-icon');
    const pauseLabel = document.getElementById('fl-pause-label');
    const roomTag = document.getElementById('fl-room-code-tag');
    const dot = document.getElementById('fl-pulse-dot');

    console.log('[FollowLeader] _updateBannerUI banner exists:', !!banner, 'isFollowing:', _isFollowing);
    if (banner) {
      banner.classList.toggle('hidden', !_isFollowing);
      banner.classList.toggle('is-paused', _isPaused);
    }

    if (btnToolbar) {
      btnToolbar.classList.toggle('is-following', _isFollowing);
      if (_isFollowing) {
        btnToolbar.setAttribute('title', `Đang theo: ${_leaderName} (${_roomCode})`);
      } else {
        btnToolbar.setAttribute('title', 'Theo ca trưởng / Đồng bộ ban nhạc (📡)');
      }
    }

    if (roomTag) {
      roomTag.textContent = _roomCode || '';
    }

    if (btnPause && pauseIcon && pauseLabel) {
      if (_isPaused) {
        pauseIcon.textContent = '▶️';
        pauseLabel.textContent = 'Theo lại';
        btnPause.setAttribute('title', 'Tiếp tục nhận đồng bộ từ ca trưởng');
        btnPause.classList.add('btn-resume');
      } else {
        pauseIcon.textContent = '⏸️';
        pauseLabel.textContent = 'Tạm ngưng';
        btnPause.setAttribute('title', 'Tạm ngưng nhận đồng bộ từ ca trưởng');
        btnPause.classList.remove('btn-resume');
      }
    }

    if (dot) {
      dot.className = 'fl-pulse-dot ' + (_isPaused ? 'paused' : 'connected');
    }

    _updateBannerLeaderName();
  }

  function _updateBannerLeaderName() {
    const nameEl = document.getElementById('fl-leader-name');
    if (!nameEl) return;
    if (_isPaused) {
      nameEl.textContent = '⏸️ Đã tạm ngưng - Bấm để theo lại';
    } else {
      nameEl.textContent = `Đang theo: ${_leaderName}`;
    }
  }

  function _syncModalHostView() {
    const isHost = window.LiveSession?.isHost?.() ?? false;
    const idleView = document.getElementById('fl-host-idle-view');
    const activeView = document.getElementById('fl-host-active-view');
    const roomDisplay = document.getElementById('fl-host-room-display');
    const linkDisplay = document.getElementById('fl-host-link-display');
    const canvas = document.getElementById('fl-host-qr-canvas');

    if (idleView && activeView) {
      idleView.classList.toggle('hidden', isHost);
      activeView.classList.toggle('hidden', !isHost);
    }

    if (isHost && _roomCode) {
      if (roomDisplay) roomDisplay.textContent = _roomCode;
      const url = new URL(window.location.origin + window.location.pathname);
      url.searchParams.set('live', _roomCode);
      if (linkDisplay) linkDisplay.value = url.href;

      if (canvas && window.QRHelper) {
        window.QRHelper.drawQR(canvas, url.href, 180);
      }
    }
  }

  async function _toggleQrScanner() {
    const box = document.getElementById('fl-qr-scanner-box');
    const textEl = document.getElementById('fl-cam-btn-text');
    if (!box) return;

    if (!box.classList.contains('hidden')) {
      _stopQrScanner();
    } else {
      try {
        box.classList.remove('hidden');
        if (textEl) textEl.textContent = 'Tắt Camera';

        const video = document.getElementById('fl-qr-video');
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Thiết bị không hỗ trợ truy cập camera.');
        }

        _videoStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        });
        if (video) {
          video.srcObject = _videoStream;
          video.setAttribute('playsinline', 'true');
          await video.play();
          _startQrVideoLoop(video);
        }
      } catch (err) {
        _stopQrScanner();
        window.App?.showToast?.('Không thể mở camera: ' + (err.message || 'Bị từ chối'), 'warning');
      }
    }
  }

  function _startQrVideoLoop(video) {
    const canvas = document.getElementById('fl-qr-canvas-hidden');
    if (!canvas || !video) return;
    const ctx = canvas.getContext('2d');

    _scanInterval = setInterval(() => {
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        // Quét ảnh bằng jsQR nếu thư viện đã tải, hoặc kiểm tra link
        if (window.jsQR) {
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = window.jsQR(imageData.data, imageData.width, imageData.height);
          if (code && code.data) {
            _handleScannedUrl(code.data);
          }
        }
      }
    }, 400);
  }

  function _handleScannedUrl(data) {
    try {
      const url = new URL(data);
      const room = url.searchParams.get('live') || url.searchParams.get('room');
      if (room) {
        _stopQrScanner();
        join(room);
      }
    } catch (e) {
      if (/^[A-Z0-9_\-]{3,20}$/i.test(data.trim())) {
        _stopQrScanner();
        join(data.trim());
      }
    }
  }

  function _stopQrScanner() {
    if (_scanInterval) {
      clearInterval(_scanInterval);
      _scanInterval = null;
    }
    if (_videoStream) {
      _videoStream.getTracks().forEach(t => t.stop());
      _videoStream = null;
    }
    const box = document.getElementById('fl-qr-scanner-box');
    const textEl = document.getElementById('fl-cam-btn-text');
    if (box) box.classList.add('hidden');
    if (textEl) textEl.textContent = 'Bật Camera';
  }

  function _checkUrlParamAutoJoin() {
    try {
      const params = new URLSearchParams(window.location.search);
      const live = params.get('live') || params.get('follow');
      if (live) {
        setTimeout(() => {
          join(live.toUpperCase());
        }, 300);
      }
    } catch (e) {}
  }

  return {
    init,
    openModal,
    closeModal,
    switchTab,
    join,
    startHost,
    leave,
    pause,
    resume,
    togglePause,
    isFollowing: () => _isFollowing,
    isPaused: () => _isPaused,
    getRoomCode: () => _roomCode,
    getLeaderName: () => _leaderName,
    getPendingState: () => _pendingState,
    setPendingState: (s) => { _pendingState = s; },
    onRemoteStateReceived,
    onConnectionChange
  };
})();

// Khởi chạy khi DOM sẵn sàng
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => FollowLeader.init());
} else {
  FollowLeader.init();
}

window.FollowLeader = FollowLeader;
