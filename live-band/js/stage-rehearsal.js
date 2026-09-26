/**
 * live-band/js/stage-rehearsal.js — Live Band Rehearsal, Loop, Ink, & Tactical Cues Engine
 * Quản lý vòng lặp A-B, bút vẽ chú thích sân khấu (Apple Pencil), tách bè Solo SATB, và lệnh ban nhạc (Teamplay Cues).
 */
(() => {
  'use strict';

  let _cueDismissTimer  = null;
  let _isLoopActive     = false;
  let _loopStartMeasure = 1;
  let _loopEndMeasure   = 16;
  let _isInkActive      = false;
  let _selectedSatbPart = 'all';
  let _currentBandState = 'normal';

  const BAND_STATES = {
    break:  { label: 'BREAK / NGẮT PHÁCH 1', icon: '🛑', color: '#ef4444' },
    build:  { label: 'BUILD-UP / DỒN NHỊP', icon: '🌊', color: '#3b82f6' },
    drop:   { label: 'ĐỆM ÊM / GIẢM VOLUME', icon: '🤫', color: '#8b5cf6' },
    drive:  { label: 'CAO TRÀO / FULL DRIVE', icon: '🔥', color: '#f97316' },
    solo:   { label: 'SOLO TIME (HẠ NỀN)', icon: '🎸', color: '#eab308' },
    end:    { label: 'DỨT KẾT / OUTRO', icon: '🏁', color: '#64748b' },
    normal: { label: 'CHƠI BÌNH THƯỜNG', icon: '🎵', color: '#10b981' }
  };

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

  function setBandState(stateKey, broadcastStateFn) {
    const st = BAND_STATES[stateKey] || BAND_STATES.normal;
    _currentBandState = stateKey;

    applyBandStateUI(stateKey);
    showCueBanner(`⚡ LỆNH BAN NHẠC: ${st.label}`, st.icon, 3500);

    if (typeof broadcastStateFn === 'function') {
      broadcastStateFn({
        bandState: {
          key: stateKey,
          label: st.label,
          icon: st.icon
        }
      });
    }
  }

  function applyBandStateUI(stateKey) {
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

  function toggleAbLoop(scrollToMeasureFn, broadcastStateFn) {
    _isLoopActive = !_isLoopActive;
    const loopBtn = document.getElementById('btn-toggle-ab-loop');
    const loopLabel = document.getElementById('loop-btn-label');

    const startInp = document.getElementById('loop-start-measure');
    const endInp = document.getElementById('loop-end-measure');
    if (startInp) _loopStartMeasure = Math.max(1, parseInt(startInp.value, 10) || 1);
    if (endInp) _loopEndMeasure = Math.max(_loopStartMeasure + 1, parseInt(endInp.value, 10) || (_loopStartMeasure + 8));

    if (loopBtn) loopBtn.classList.toggle('active', _isLoopActive);
    if (loopLabel) loopLabel.textContent = _isLoopActive ? `Vòng Lặp: Ô ${_loopStartMeasure}-${_loopEndMeasure}` : 'Vòng Lặp A-B: Tắt';

    if (_isLoopActive) {
      showCueBanner(`🔁 Bật Vòng Lặp Tập: Ô ${_loopStartMeasure} ➔ ${_loopEndMeasure}`, '🔁', 2500);
      if (typeof scrollToMeasureFn === 'function') {
        scrollToMeasureFn(_loopStartMeasure, true);
      }
    } else {
      showCueBanner('🔁 Đã tắt Vòng Lặp Tập A-B', 'ℹ️', 1500);
    }

    if (typeof broadcastStateFn === 'function') {
      broadcastStateFn({
        loop: {
          active: _isLoopActive,
          start: _loopStartMeasure,
          end: _loopEndMeasure
        }
      });
    }
  }

  function toggleInkMode() {
    _isInkActive = !_isInkActive;
    const btn = document.getElementById('btn-toggle-ink');
    const tools = document.getElementById('ink-tools-group');

    if (btn) btn.classList.toggle('active', _isInkActive);
    if (tools) tools.classList.toggle('hidden', !_isInkActive);

    window.StageInkEngine?.setEnabled(_isInkActive);
    showCueBanner(_isInkActive ? '✏️ Bật Bút Vẽ Chú Thích (Apple Pencil / Chạm)' : '✏️ Tắt Bút Chú Thích', '✏️', 1800);
  }

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

  function cueSectionTransition(sectionName, sections, scrollToMeasureFn, broadcastStateFn) {
    showCueBanner(`⚡ CHUYỂN KHÚC: ${sectionName.toUpperCase()}!`, '⚡', 3500);

    if (sections && sections.length > 0) {
      const match = sections.find(s => s.name && s.name.toLowerCase().includes(sectionName.toLowerCase()));
      if (match && match.start_measure > 0) {
        if (typeof scrollToMeasureFn === 'function') {
          scrollToMeasureFn(match.start_measure, true);
        }
        if (typeof broadcastStateFn === 'function') {
          broadcastStateFn({
            position: { measure: match.start_measure, sectionId: match.id },
            cue: { text: `⚡ CHUYỂN KHÚC: ${match.name.toUpperCase()} (Ô ${match.start_measure})`, icon: '⚡' }
          });
          return;
        }
      }
    }

    if (typeof broadcastStateFn === 'function') {
      broadcastStateFn({
        cue: { text: `⚡ CHUYỂN KHÚC: ${sectionName.toUpperCase()}!`, icon: '⚡' }
      });
    }
  }

  function cue2BarsWarning(broadcastStateFn) {
    const cueBtn = document.getElementById('btn-cue-2bars-warning');
    if (cueBtn) {
      cueBtn.classList.add('active');
      setTimeout(() => cueBtn.classList.remove('active'), 1500);
    }

    showCueBanner('⚠️ CHUẨN BỊ CHUYỂN KHÚC SAU 2 Ô NHỊP!', '⚠️', 4500);

    if (typeof broadcastStateFn === 'function') {
      broadcastStateFn({
        cue: {
          text: '⚠️ CHUẨN BỊ CHUYỂN KHÚC SAU 2 Ô NHỊP!',
          icon: '⚠️',
          durationMs: 4500
        }
      });
    }
  }

  function handlePedalAction(action, context) {
    const { onNext, onPrev, onCountIn, onChorus, onSnap } = context;
    if (action === 'next' && typeof onNext === 'function') onNext();
    else if (action === 'prev' && typeof onPrev === 'function') onPrev();
    else if (action === 'countin' && typeof onCountIn === 'function') onCountIn();
    else if (action === 'chorus' && typeof onChorus === 'function') onChorus();
    else if (action === 'snap' && typeof onSnap === 'function') onSnap();
  }

  window.StageRehearsal = {
    BAND_STATES,
    showCueBanner,
    setBandState,
    applyBandStateUI,
    toggleAbLoop,
    toggleInkMode,
    setSatbPart,
    cueSectionTransition,
    cue2BarsWarning,
    handlePedalAction,
    isLoopActive: () => _isLoopActive,
    getLoopRange: () => ({ start: _loopStartMeasure, end: _loopEndMeasure })
  };
})();
