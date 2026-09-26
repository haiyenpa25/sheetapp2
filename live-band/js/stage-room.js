/**
 * live-band/js/stage-room.js — Stage Room & Multi-Device Session Coordinator
 * Quản lý vòng đời phòng biểu diễn (Host / Follower), QR Code, PIN chia sẻ, và Roster thành viên ban nhạc.
 */
(() => {
  'use strict';

  function showRoomModal(mode, roomCode) {
    const modal = document.getElementById('modal-live-room');
    if (modal) {
      updateRoomModalUI(mode, roomCode);
      modal.classList.remove('hidden');
    }
  }

  function hideRoomModal() {
    document.getElementById('modal-live-room')?.classList.add('hidden');
  }

  function switchModalTab(targetPaneId) {
    document.querySelectorAll('.modal-tab-btn').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-target') === targetPaneId);
    });
    document.querySelectorAll('.modal-tab-pane').forEach(p => {
      p.classList.toggle('active', ('#' + p.id) === targetPaneId);
    });
  }

  function updateRoomBadges(mode, roomCode) {
    const pill = document.getElementById('btn-stage-room-badge');
    const label = document.getElementById('nav-room-label');
    if (!pill || !label) return;

    pill.className = 'stage-pill-badge room-badge';
    if (mode === 'host') {
      pill.classList.add('connected');
      label.textContent = `HOST: ${roomCode}`;
    } else if (mode === 'join') {
      pill.classList.add('connected');
      label.textContent = `LIVE: ${roomCode}`;
    } else {
      pill.classList.add('disconnected');
      label.textContent = 'CHƯA VÀO PHÒNG';
    }
  }

  function updateRoomModalUI(mode, roomCode) {
    const isHost = mode === 'host';
    const isJoin = mode === 'join';

    document.getElementById('host-setup-view')?.classList.toggle('hidden', isHost);
    document.getElementById('host-active-view')?.classList.toggle('hidden', !isHost);
    document.getElementById('display-room-code')?.replaceChildren(document.createTextNode(roomCode));

    document.getElementById('join-active-status')?.classList.toggle('hidden', !isJoin);
    document.getElementById('display-joined-room')?.replaceChildren(document.createTextNode(roomCode));
  }

  function updateRosterUI(roster) {
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

  function renderQR(roomCode) {
    const canvas = document.getElementById('stage-qr-canvas');
    if (!canvas || !roomCode || !window.QRHelper) return;
    const url = new URL(window.location.origin + window.location.pathname);
    url.searchParams.set('room', roomCode);
    window.QRHelper.drawQR(canvas, url.href, 220);

    const shareInput = document.getElementById('share-link-input');
    if (shareInput) shareInput.value = url.href;
  }

  function showFullscreenQR(roomCode) {
    const overlay = document.getElementById('modal-fullscreen-qr-overlay');
    const canvas = document.getElementById('fs-qr-canvas');
    const badge = document.getElementById('fs-qr-room-code');
    if (!overlay || !canvas || !roomCode || !window.QRHelper) return;

    if (badge) badge.textContent = roomCode;
    const url = new URL(window.location.origin + window.location.pathname);
    url.searchParams.set('room', roomCode);
    window.QRHelper.drawQR(canvas, url.href, 340);

    overlay.classList.remove('hidden');
  }

  function hideFullscreenQR() {
    document.getElementById('modal-fullscreen-qr-overlay')?.classList.add('hidden');
  }

  function copyShareLink(roomCode, showCueBannerFn) {
    if (!roomCode) return;
    const url = new URL(window.location.origin + window.location.pathname);
    url.searchParams.set('room', roomCode);

    if (navigator.clipboard) {
      navigator.clipboard.writeText(url.href).then(() => {
        if (typeof showCueBannerFn === 'function') {
          showCueBannerFn('📋 Đã sao chép link tham gia phòng!', '✅', 2500);
        }
      }).catch(() => {
        prompt('Sao chép link tham gia:', url.href);
      });
    } else {
      prompt('Sao chép link tham gia:', url.href);
    }
  }

  function buildBroadcastPayload(context, patch = {}) {
    return {
      leader: { clientId: context.clientId, name: 'Ca Trưởng' },
      song: {
        songId: context.songId,
        songTitle: context.songTitle,
        chordSet: context.chordSet || 'HD',
        setlistId: context.setlist?.id || null,
        setlistIndex: context.setlistIndex || 0
      },
      music: {
        baseKey: context.baseKey,
        transpose: context.transpose,
        bpm: context.bpm
      },
      position: {
        measure: context.measure
      },
      ...patch
    };
  }

  async function applyRemoteState(state, ctx) {
    if (!state || ctx.mode === 'host') return;

    const targetSongId = state.song?.songId || state.songId;
    const targetChordSet = state.song?.chordSet || state.chordSet || 'HD';
    if (targetSongId && (targetSongId !== ctx.currentSongId || targetChordSet !== ctx.currentChordSet)) {
      const title = state.song?.songTitle || targetSongId;
      window.StageRehearsal?.showCueBanner(`📡 Ca Trưởng chuyển bài: ${title} (${targetChordSet})`, '🎵', 3000);
      await ctx.onLoadSong(targetSongId, state.music?.transpose ?? 0, targetChordSet);
    } else if (state.song?.chordSet && state.song.chordSet !== ctx.currentChordSet) {
      await ctx.onLoadSong(ctx.currentSongId, ctx.currentTranspose, state.song.chordSet);
    }

    if (state.music && state.music.transpose !== undefined && ctx.currentTranspose !== state.music.transpose) {
      ctx.onSetTranspose(state.music.transpose);
    }

    if (state.music && state.music.bpm) {
      ctx.onUpdateBpm(state.music.bpm);
    }

    const targetMeasure = state.position?.measure || state.measure;
    if (targetMeasure && targetMeasure > 0) {
      ctx.onSetHostMeasure(targetMeasure);
      if (!ctx.isDetached) {
        ctx.onSetCurrentMeasure(targetMeasure);
        window.MusicalPosition?.scrollToMeasure?.(targetMeasure, true);
        window.StageCatalog?.highlightActiveSectionByMeasure(targetMeasure);
      } else {
        ctx.onUpdateSnap(true, ctx.currentMeasure, targetMeasure);
      }
    }

    if (state.cue && state.cue.text) {
      window.StageRehearsal?.showCueBanner(state.cue.text, state.cue.icon || '⚡', state.cue.durationMs || 3000);
    }

    if (state.transport && state.transport.state === 'count_in') {
      window.StageAudio?.triggerVisualCountIn({ bpm: state.music?.bpm || ctx.currentBpm, beats: 4 });
    }

    if (state.bandState && state.bandState.key) {
      window.StageRehearsal?.applyBandStateUI(state.bandState.key);
      window.StageRehearsal?.showCueBanner(`⚡ LỆNH BAN NHẠC: ${state.bandState.label}`, state.bandState.icon || '⚡', 3500);
    }
  }

  window.StageRoomManager = {
    showRoomModal,
    hideRoomModal,
    switchModalTab,
    updateRoomBadges,
    updateRoomModalUI,
    updateRosterUI,
    renderQR,
    showFullscreenQR,
    hideFullscreenQR,
    copyShareLink,
    buildBroadcastPayload,
    applyRemoteState
  };
})();

