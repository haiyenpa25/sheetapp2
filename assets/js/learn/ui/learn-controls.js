/**
 * assets/js/learn/ui/learn-controls.js — UI Event Handlers & Control Binding
 * Part of SheetApp Learn Studio
 */
const LearnControls = (() => {
  'use strict';

  /* ─── URL & Navigation Synchronization ───────────────────────── */
  function updateUrlAndBackLink(songId, chordSet, transpose, songTitle) {
    if (!songId) return;

    try {
      localStorage.setItem('sheetapp_learn_last_song', songId);
      const newUrl = new URL(window.location);
      newUrl.searchParams.set('song', songId);
      newUrl.searchParams.set('set', chordSet || 'HD');
      if (typeof transpose === 'number' && transpose !== 0) {
        newUrl.searchParams.set('trans', transpose);
      } else {
        newUrl.searchParams.delete('trans');
      }
      window.history.replaceState({}, '', newUrl);
    } catch (e) {}

    const backBtn = document.querySelector('.learn-back-btn');
    if (backBtn) {
      backBtn.href = `/?song=${encodeURIComponent(songId)}&set=${encodeURIComponent(chordSet || 'HD')}`;
      backBtn.title = `Quay về SheetApp đánh live bài "${songTitle || songId}"`;
    }
  }

  /* ─── Dynamic Chord Sets Dropdown ────────────────────────────── */
  async function refreshChordSetDropdown(songId, currentProfile) {
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
      console.warn('[LearnControls] Could not fetch chord sets:', e);
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

    const targetSet = currentProfile || (window.LearnStore ? LearnStore.get('chordSet') : 'HD') || 'HD';
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
      return `<option value="${window.SafeHtml ? window.SafeHtml.escape(s) : s}" ${isSelected ? 'selected' : ''}>${window.SafeHtml ? window.SafeHtml.escape(label) : label}</option>`;
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

  /* ─── Pattern & Meter Filtering ──────────────────────────────── */
  function filterPatternOptionsByMeter(filterMeter, beats, beatType) {
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

    const currentOpt = patternSelect.querySelector(`option[value="${patternSelect.value}"]`);
    if (currentOpt && currentOpt.hidden && firstMatchVal) {
      patternSelect.value = firstMatchVal;
      if (window.PatternEngine) PatternEngine.setPattern(firstMatchVal);
    }
  }

  function autoSelectPattern(beats, beatType) {
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

    const autoTab = document.querySelector('.btn-meter-tab[data-meter="auto"]');
    if (autoTab) {
      document.querySelectorAll('.btn-meter-tab').forEach(t => t.classList.remove('active'));
      autoTab.classList.add('active');
    }
    filterPatternOptionsByMeter('auto', beats, beatType);

    patternSelect.value = targetPattern;
    PatternEngine.setPattern(targetPattern);
  }

  function _applyTranspose(delta, ctx) {
    if (!ctx.getCurrentTranspose || !ctx.setCurrentTranspose) return;
    const cur = ctx.getCurrentTranspose();
    const nextTrans = cur + delta;
    if (nextTrans >= -12 && nextTrans <= 12) {
      ctx.setCurrentTranspose(nextTrans);
      const valEl = document.getElementById('learn-trans-val');
      if (valEl) valEl.textContent = nextTrans > 0 ? `+${nextTrans}` : `${nextTrans}`;
      const osmd = window.LearnScore ? LearnScore.getOsmd() : null;
      if (osmd && osmd.Sheet && window.opensheetmusicdisplay?.TransposeCalculator) {
        try {
          osmd.TransposeCalculator = new opensheetmusicdisplay.TransposeCalculator();
          osmd.Sheet.Transpose = nextTrans;
          osmd.updateGraphic();
          osmd.render();
        } catch(e) {}
      }
      if (ctx.rebuildTimeline) ctx.rebuildTimeline();
      if (window.MelodyPracticeEngine) MelodyPracticeEngine.setTranspose(nextTrans);
      const currentSong = ctx.getCurrentSong ? ctx.getCurrentSong() : null;
      updateUrlAndBackLink(currentSong?.id, window.LearnStore?.get('chordSet'), nextTrans, currentSong?.title);
    }
  }

  /* ─── Control Binding ────────────────────────────────────────── */
  function bind(ctx) {
    // 1. Score Click Handler
    if (window.LearnScore && LearnScore.setupScoreClickHandler) {
      LearnScore.setupScoreClickHandler((m) => {
        if (ctx.seekToMeasure) ctx.seekToMeasure(m);
      });
    }

    // 2. Zoom Controls
    document.getElementById('btn-learn-zoom-in')?.addEventListener('click', () => {
      if (window.LearnScore) LearnScore.zoomIn();
    });
    document.getElementById('btn-learn-zoom-out')?.addEventListener('click', () => {
      if (window.LearnScore) LearnScore.zoomOut();
    });
    document.getElementById('btn-learn-zoom-reset')?.addEventListener('click', () => {
      if (window.LearnScore) LearnScore.resetZoom();
    });
    document.getElementById('btn-learn-zoom-fit')?.addEventListener('click', () => {
      if (window.LearnScore) LearnScore.fitScore();
    });

    // 3. Play / Pause & Stop Controls
    document.getElementById('btn-learn-play')?.addEventListener('click', () => {
      if (ctx.handlePlayPause) ctx.handlePlayPause();
    });

    document.getElementById('btn-learn-stop')?.addEventListener('click', () => {
      if (ctx.handleStop) ctx.handleStop();
    });

    // 4. BPM Controls
    document.getElementById('btn-learn-bpm-dec')?.addEventListener('click', () => {
      const newBpm = Math.max(20, (window.LearnStore ? LearnStore.get('bpm') : 80) - 5);
      if (window.LearnStore) LearnStore.set('bpm', newBpm);
      if (window.MusicTransport) MusicTransport.setBpm(newBpm);
      const lbl = document.getElementById('learn-bpm-value');
      if (lbl) lbl.textContent = newBpm;
      if (window.LearnStore) LearnStore.savePreferences();
    });

    document.getElementById('btn-learn-bpm-inc')?.addEventListener('click', () => {
      const newBpm = Math.min(300, (window.LearnStore ? LearnStore.get('bpm') : 80) + 5);
      if (window.LearnStore) LearnStore.set('bpm', newBpm);
      if (window.MusicTransport) MusicTransport.setBpm(newBpm);
      const lbl = document.getElementById('learn-bpm-value');
      if (lbl) lbl.textContent = newBpm;
      if (window.LearnStore) LearnStore.savePreferences();
    });

    // 5. Transpose Controls
    document.getElementById('btn-learn-trans-dec')?.addEventListener('click', () => {
      _applyTranspose(-1, ctx);
    });

    document.getElementById('btn-learn-trans-inc')?.addEventListener('click', () => {
      _applyTranspose(1, ctx);
    });

    // 6. Chord Set Profile Select
    document.getElementById('learn-chord-set-select')?.addEventListener('change', (e) => {
      if (ctx.handleChordSetChange) ctx.handleChordSetChange(e.target.value);
    });

    // 7. Accompaniment Pattern Select & Meter Tabs
    document.getElementById('learn-pattern-select')?.addEventListener('change', (e) => {
      if (window.PatternEngine) {
        PatternEngine.setPattern(e.target.value);
      }
    });

    document.querySelectorAll('.btn-meter-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.btn-meter-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (ctx.getSongMeta) {
          const meta = ctx.getSongMeta();
          filterPatternOptionsByMeter(btn.dataset.meter, meta.beats, meta.beatType);
        }
      });
    });

    // 8. Melody Controls
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

    // 9. Accompaniment Toggle & Volume Sliders
    document.getElementById('learn-pattern-toggle')?.addEventListener('change', (e) => {
      if (window.PatternEngine) {
        PatternEngine.setEnabled(e.target.checked);
      }
    });

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

    // Arrangement Density
    document.querySelectorAll('.btn-density[data-density]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.btn-density').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (window.PatternEngine) {
          PatternEngine.setDensity(btn.dataset.density);
        }
      });
    });

    // 10. Loop & Tempo Ladder Controls
    document.getElementById('learn-section-select')?.addEventListener('change', (e) => {
      if (window.LoopController) {
        LoopController.selectSection(e.target.value);
      }
    });

    document.getElementById('btn-learn-loop-toggle')?.addEventListener('click', () => {
      if (window.LoopController) {
        LoopController.setLoop(!LoopController.isLooping());
      }
    });

    document.getElementById('btn-toggle-wait-mode')?.addEventListener('click', () => {
      if (ctx.handleToggleWaitMode) ctx.handleToggleWaitMode();
    });

    document.querySelectorAll('.btn-tempo-ladder[data-ratio]').forEach(btn => {
      btn.addEventListener('click', () => {
        const ratio = parseFloat(btn.dataset.ratio);
        if (window.LoopController) {
          LoopController.setTempoRatio(ratio);
        }
      });
    });

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

    // 11. Learn Mode Selector
    document.querySelectorAll('.btn-learn-mode').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;
        document.querySelectorAll('.btn-learn-mode').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (window.LearnStore) LearnStore.set('mode', mode);
        const osmd = window.LearnScore ? LearnScore.getOsmd() : null;

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
          if (window.MelodyPracticeEngine) MelodyPracticeEngine.setActive(true, osmd);
        } else if (mode === 'chord') {
          const patternCard = document.getElementById('learn-pattern-card');
          if (patternCard) patternCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          const chordTab = document.querySelector('.btn-learn-tab[data-tab="chords"]');
          if (chordTab && window.innerWidth <= 960) chordTab.click();
          if (window.MelodyPracticeEngine) MelodyPracticeEngine.setActive(false);
          if (window.EventBus && window.LEARN_EVENTS) {
            EventBus.emit(LEARN_EVENTS.TOAST, { message: 'Đã chuyển sang chế độ Tập Đệm Hát Hợp Âm', type: 'info' });
          }
        } else {
          if (window.MelodyPracticeEngine) MelodyPracticeEngine.setActive(false);
        }

        if (window.EventBus && window.LEARN_EVENTS) EventBus.emit(LEARN_EVENTS.MODE_CHANGED, { mode });
        if (window.LearnStore) LearnStore.savePreferences();
      });
    });

    // 12. SATB Solo / Mute / Volume Sliders
    document.querySelectorAll('.btn-voice-solo').forEach(btn => {
      btn.addEventListener('click', () => {
        const voice = btn.dataset.voice;
        const isActive = btn.classList.toggle('active');
        if (window.LearnSoundEngine) {
          LearnSoundEngine.setSatbSolo(voice, isActive);
        }
      });
    });

    document.querySelectorAll('.btn-voice-mute').forEach(btn => {
      btn.addEventListener('click', () => {
        const voice = btn.dataset.voice;
        const isActive = btn.classList.toggle('active');
        if (window.LearnSoundEngine) {
          LearnSoundEngine.setSatbMute(voice, isActive);
        }
      });
    });

    document.querySelectorAll('.voice-slider').forEach(slider => {
      slider.addEventListener('input', (e) => {
        const voice = slider.dataset.voice;
        if (window.LearnSoundEngine) {
          LearnSoundEngine.setSatbVolume(voice, parseFloat(e.target.value));
        }
      });
    });

    // 13. Mobile Tabs
    document.querySelectorAll('.btn-learn-tab').forEach(tabBtn => {
      tabBtn.addEventListener('click', () => {
        const tabName = tabBtn.dataset.tab;
        document.querySelectorAll('.btn-learn-tab').forEach(b => b.classList.remove('active'));
        tabBtn.classList.add('active');
        const mainEl = document.getElementById('learn-main');
        if (mainEl) mainEl.dataset.activeTab = tabName;
        if (tabName === 'score' && window.LearnScore) {
          LearnScore.fitScore();
        }
      });
    });

    // 14. Song Picker Panel
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

    document.getElementById('learn-song-search')?.addEventListener('input', (e) => {
      const q = e.target.value.trim().toLowerCase();
      document.querySelectorAll('.learn-song-item').forEach(item => {
        const visible = !q || item.textContent.toLowerCase().includes(q);
        item.style.display = visible ? '' : 'none';
      });
    });
  }

  return {
    bind,
    updateUrlAndBackLink,
    refreshChordSetDropdown,
    filterPatternOptionsByMeter,
    autoSelectPattern
  };
})();

if (typeof window !== 'undefined') {
  window.LearnControls = LearnControls;
}
