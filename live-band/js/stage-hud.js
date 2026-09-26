/**
 * live-band/js/stage-hud.js — Role-Tailored HUDs & Teleprompter Controller
 * Hiển thị giao diện chuyên biệt theo nhạc cụ: Bass Root Note, Piano Voicing, Drummer Flasher, và Lời ca lớn cho Ca sĩ.
 */
(() => {
  'use strict';

  const STORAGE_ROLE_KEY = 'sheetapp_live_role';
  const STORAGE_FONT_SIZE_KEY = 'sheetapp_vocal_font_size';

  let _vocalViewMode = 'sheet'; // 'sheet' | 'lyrics'
  let _vocalFontSize = 1.45;    // rem

  function setRole(newRole, currentMode, currentSongId, transport, showCueBannerFn, onRoleChange) {
    localStorage.setItem(STORAGE_ROLE_KEY, newRole);

    if (transport) {
      transport.setRole?.(newRole);
    }

    const select = document.getElementById('stage-role-select');
    if (select) select.value = newRole;

    const iconEl = document.getElementById('role-pill-icon');
    const roleIcons = { leader: '👑', guitar: '🎸', bass: '🎸', piano: '🎹', vocal: '🎤', drummer: '🥁', viewer: '👀' };
    if (iconEl) iconEl.textContent = roleIcons[newRole] || '🎵';

    const isHost = currentMode === 'host' || newRole === 'leader';
    document.getElementById('host-command-console')?.classList.toggle('hidden', !isHost);

    document.getElementById('hud-guitar')?.classList.toggle('hidden', newRole !== 'guitar');
    document.getElementById('hud-bass')?.classList.toggle('hidden', newRole !== 'bass');
    document.getElementById('hud-piano')?.classList.toggle('hidden', newRole !== 'piano');
    document.getElementById('hud-drummer')?.classList.toggle('hidden', newRole !== 'drummer');
    document.getElementById('hud-vocal')?.classList.toggle('hidden', newRole !== 'vocal');

    applyViewMode(newRole, currentSongId);

    if (typeof onRoleChange === 'function') {
      onRoleChange(newRole);
    }
  }

  function applyViewMode(role, currentSongId) {
    const emptyState = document.getElementById('stage-empty-state');
    const sheetWrapper = document.getElementById('stage-sheet-wrapper');
    const lyricWrapper = document.getElementById('stage-lyric-wrapper');
    if (!sheetWrapper || !lyricWrapper) return;

    if (!currentSongId) {
      if (emptyState) emptyState.classList.remove('hidden');
      sheetWrapper.classList.add('hidden');
      lyricWrapper.classList.add('hidden');
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');
    if (role === 'vocal' && _vocalViewMode === 'lyrics') {
      sheetWrapper.classList.add('hidden');
      lyricWrapper.classList.remove('hidden');
    } else {
      sheetWrapper.classList.remove('hidden');
      lyricWrapper.classList.add('hidden');
    }
  }

  function toggleVocalView(role, currentSongId) {
    _vocalViewMode = _vocalViewMode === 'sheet' ? 'lyrics' : 'sheet';
    const btn = document.getElementById('btn-vocal-toggle-view');
    if (btn) {
      btn.textContent = _vocalViewMode === 'lyrics' ? '🎼 Chuyển Xem: Bản Nhạc (Khuông)' : '📄 Chuyển Xem: Lời Nhạc Lớn (Teleprompter)';
      btn.classList.toggle('active', _vocalViewMode === 'lyrics');
    }
    applyViewMode(role, currentSongId);
  }

  function adjustVocalFontSize(delta) {
    _vocalFontSize = Math.max(1.0, Math.min(2.8, _vocalFontSize + delta));
    localStorage.setItem(STORAGE_FONT_SIZE_KEY, _vocalFontSize);
    document.querySelectorAll('.teleprompter-lines').forEach(el => {
      el.style.fontSize = `${_vocalFontSize}rem`;
    });
  }

  function updateBassHud(baseKey, transpose, currentChordText = null) {
    let effKey = baseKey;
    if (window.TransposeEngine && transpose !== 0) {
      effKey = window.TransposeEngine.transposeKey(baseKey, transpose) || baseKey;
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

  function updatePianoHud(baseKey, transpose) {
    let effKey = baseKey;
    if (window.TransposeEngine && transpose !== 0) {
      effKey = window.TransposeEngine.transposeKey(baseKey, transpose) || baseKey;
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

  function bindStageUI(h) {
    document.getElementById('btn-stage-room-badge')?.addEventListener('click', h.onShowRoom);
    document.getElementById('btn-open-room-modal')?.addEventListener('click', h.onShowRoom);
    document.getElementById('btn-close-room-modal')?.addEventListener('click', h.onHideRoom);
    document.getElementById('btn-host-create')?.addEventListener('click', h.onCreateRoom);
    document.getElementById('btn-join-room')?.addEventListener('click', h.onJoinRoom);
    document.getElementById('btn-host-leave')?.addEventListener('click', h.onLeaveRoom);
    document.getElementById('btn-join-leave')?.addEventListener('click', h.onLeaveRoom);
    document.getElementById('btn-copy-share-link')?.addEventListener('click', h.onCopyShareLink);
    document.getElementById('btn-show-fullscreen-qr')?.addEventListener('click', h.onShowFullscreenQR);
    document.getElementById('btn-close-fs-qr')?.addEventListener('click', h.onHideFullscreenQR);

    document.querySelectorAll('.modal-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => window.StageRoomManager.switchModalTab(btn.getAttribute('data-target')));
    });

    document.getElementById('stage-role-select')?.addEventListener('change', (e) => h.onSetRole(e.target.value));
    document.getElementById('btn-snap-to-host')?.addEventListener('click', h.onSnapToHost);

    document.getElementById('btn-host-trans-down')?.addEventListener('click', () => h.onAdjustTranspose(-1));
    document.getElementById('btn-host-trans-up')?.addEventListener('click', () => h.onAdjustTranspose(1));
    document.getElementById('btn-host-bpm-down')?.addEventListener('click', () => h.onAdjustBpm(-5));
    document.getElementById('btn-host-bpm-up')?.addEventListener('click', () => h.onAdjustBpm(5));
    document.getElementById('btn-host-countin')?.addEventListener('click', h.onTriggerCountIn);
    document.getElementById('btn-host-prev-song')?.addEventListener('click', h.onPrevSong);
    document.getElementById('btn-host-next-song')?.addEventListener('click', h.onNextSong);

    document.getElementById('host-song-dropdown')?.addEventListener('change', (e) => h.onSelectSong(e.target.value));
    document.getElementById('btn-tap-tempo')?.addEventListener('click', h.onTapTempo);
    document.getElementById('btn-toggle-metronome-audio')?.addEventListener('click', h.onToggleMetronome);

    document.getElementById('btn-stage-pad')?.addEventListener('click', h.onTogglePad);
    document.getElementById('btn-toggle-ab-loop')?.addEventListener('click', h.onToggleLoop);
    document.getElementById('btn-toggle-ink')?.addEventListener('click', h.onToggleInk);

    document.querySelectorAll('.btn-band-state').forEach(b => {
      b.addEventListener('click', () => h.onSetBandState(b.getAttribute('data-state')));
    });

    document.getElementById('btn-vocal-toggle-view')?.addEventListener('click', h.onToggleVocalView);
    document.getElementById('btn-vocal-font-down')?.addEventListener('click', () => adjustVocalFontSize(-0.15));
    document.getElementById('btn-vocal-font-up')?.addEventListener('click', () => adjustVocalFontSize(0.15));
  }

  let _wakeLockSentinel = null;

  async function initWakeLock() {
    if ('wakeLock' in navigator) {
      try {
        _wakeLockSentinel = await navigator.wakeLock.request('screen');
        _updateWakeLockUI(true);
        _wakeLockSentinel.addEventListener('release', () => _updateWakeLockUI(false));
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
    pill.classList.toggle('active', isActive);
    pill.querySelector('.wakelock-text').textContent = isActive ? 'Sáng' : 'Tắt';
  }

  window.StageHud = {
    setRole,
    applyViewMode,
    toggleVocalView,
    adjustVocalFontSize,
    updateBassHud,
    updatePianoHud,
    bindStageUI,
    initWakeLock,
    getVocalFontSize: () => _vocalFontSize,
    getVocalViewMode: () => _vocalViewMode
  };
})();

