/**
 * assets/js/live-sync.js — Live Band Performance Sync Module
 * Synchronizes song selection and sheet scrolling in real-time across band members.
 */
const LiveSync = (() => {
  'use strict';

  let _mode       = 'off'; // 'off' | 'host' | 'join'
  let _room       = '';
  let _pollTimer  = null;
  let _lastSent   = 0;
  let _lastSyncTs = 0;
  let _lastSongId = '';

  function init() {
    _bindUI();
    _bindScrollListener();
  }

  function _bindUI() {
    const btn = document.getElementById('btn-live-sync');
    if (btn) btn.addEventListener('click', showModal);

    // Modal buttons
    document.getElementById('btn-close-livesync-modal')?.addEventListener('click', hideModal);
    document.getElementById('btn-start-host-room')?.addEventListener('click', _handleStartHost);
    document.getElementById('btn-join-live-room')?.addEventListener('click', _handleJoinRoom);
    document.getElementById('btn-leave-live-room')?.addEventListener('click', leaveRoom);
  }

  function showModal() {
    const modal = document.getElementById('livesync-modal');
    if (modal) modal.classList.remove('hidden');
  }

  function hideModal() {
    const modal = document.getElementById('livesync-modal');
    if (modal) modal.classList.add('hidden');
  }

  function _handleStartHost() {
    const custom = document.getElementById('host-room-code-input')?.value.trim();
    const code   = custom || 'ROOM-' + Math.floor(100 + Math.random() * 900);
    startHost(code);
    hideModal();
  }

  function _handleJoinRoom() {
    const code = document.getElementById('join-room-code-input')?.value.trim();
    if (!code) {
      window.App?.showToast?.('Vui lòng nhập Mã Phòng để tham gia!', 'error');
      return;
    }
    joinRoom(code);
    hideModal();
  }

  function startHost(roomCode) {
    _mode = 'host';
    _room = roomCode;
    _updateBadgeUI();
    window.App?.showToast?.(`📡 Đã mở phòng phát sóng Live: ${roomCode}`, 'success');
    broadcastState();
  }

  function joinRoom(roomCode) {
    _mode = 'join';
    _room = roomCode;
    _updateBadgeUI();
    _startPolling();
    window.App?.showToast?.(`📡 Đã tham gia phòng Live: ${roomCode}`, 'success');
  }

  function leaveRoom() {
    _mode = 'off';
    _room = '';
    if (_pollTimer) clearInterval(_pollTimer);
    _updateBadgeUI();
    hideModal();
    window.App?.showToast?.('👋 Đã rời phòng Live Sync', 'info');
  }

  function broadcastState() {
    if (_mode !== 'host' || !_room) return;
    const songId = window.App?.getCurrentSongId?.() || '';
    const wrapper = document.querySelector('.sheet-viewer-wrapper');
    const scrollTop = wrapper ? wrapper.scrollTop : 0;

    const payload = {
      room: _room,
      songId: songId,
      scrollTop: scrollTop,
      leader: window.Auth?.username?.() || 'Ca Trưởng'
    };

    fetch('/api/index.php?route=live_sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).catch(() => {});
  }

  function _bindScrollListener() {
    const wrapper = document.querySelector('.sheet-viewer-wrapper');
    if (!wrapper) return;
    wrapper.addEventListener('scroll', () => {
      if (_mode === 'host' && Date.now() - _lastSent > 400) {
        _lastSent = Date.now();
        broadcastState();
      }
    });

    // Lắng nghe sự kiện đổi bài
    if (window.EventBus) {
      EventBus.on('song:loaded', ({ song }) => {
        if (_mode === 'host') {
          setTimeout(broadcastState, 200);
        }
      });
    }
  }

  function _startPolling() {
    if (_pollTimer) clearInterval(_pollTimer);
    _pollTimer = setInterval(async () => {
      if (_mode !== 'join' || !_room) return;
      try {
        const res = await fetch(`/api/index.php?route=live_sync&room=${encodeURIComponent(_room)}`);
        const json = await res.json();
        if (json.success && json.active && json.data) {
          const data = json.data;
          if (data.timestamp > _lastSyncTs) {
            _lastSyncTs = data.timestamp;

            // Đổi bài nếu bài hát thay đổi
            if (data.songId && data.songId !== _lastSongId && data.songId !== window.App?.getCurrentSongId?.()) {
              _lastSongId = data.songId;
              window.App?.showToast?.(`📡 Ca trưởng chuyển bài: ${data.songTitle || data.songId}`, 'info');
              window.SongLoader?.load?.({ id: data.songId, xmlPath: `storage/Thanh ca/${data.songId}.xml` });
            }

            // Tự động cuộn trang theo Ca trưởng
            if (data.scrollTop !== undefined) {
              const wrapper = document.querySelector('.sheet-viewer-wrapper');
              if (wrapper && Math.abs(wrapper.scrollTop - data.scrollTop) > 40) {
                wrapper.scrollTo({ top: data.scrollTop, behavior: 'smooth' });
              }
            }
          }
        }
      } catch (e) {}
    }, 1000);
  }

  function _updateBadgeUI() {
    const badge = document.getElementById('live-sync-badge');
    const btn = document.getElementById('btn-live-sync');
    if (badge) {
      if (_mode === 'host') {
        badge.textContent = `📡 LIVE (Host: ${_room})`;
        badge.className = 'live-badge host-active';
        badge.classList.remove('hidden');
      } else if (_mode === 'join') {
        badge.textContent = `📡 LIVE (Sync: ${_room})`;
        badge.className = 'live-badge join-active';
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    }

    if (btn) {
      btn.classList.toggle('active-live', _mode !== 'off');
    }
  }

  return { init, showModal, hideModal, startHost, joinRoom, leaveRoom, broadcastState };
})();

document.addEventListener('DOMContentLoaded', () => LiveSync.init());
window.LiveSync = LiveSync;
