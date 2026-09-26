/**
 * editor/js/editor-audio.js — Web Audio Synthesizer, SATB Mixer & Transport Playback Engine
 * Tích hợp Tone.js / LearnSoundEngine (Grand Piano, Church Organ, SATB Choir) và Web Audio fallback.
 */
(() => {
  'use strict';

  let _audioCtx = null;

  const _playbackState = {
    isPlaying: false,
    instrument: 'piano', // 'piano' | 'organ' | 'choir' | 'strings'
    reverbWet: 0.35,
    metronome: false,
    rehearsalMode: false,
    loopEnabled: false,
    loopStartMeasure: 1,
    loopEndMeasure: 8,
    timer: null,
    stepIndex: 0
  };

  function getAudioContext() {
    if (!_audioCtx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      _audioCtx = new AudioCtx();
    }
    if (_audioCtx.state === 'suspended') {
      _audioCtx.resume();
    }
    return _audioCtx;
  }

  function pitchToMidi(step, octave, alter = 0) {
    const offsets = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
    const base = offsets[step?.toUpperCase()] ?? 0;
    return (parseInt(octave, 10) + 1) * 12 + base + (parseInt(alter, 10) || 0);
  }

  function midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  function getVoiceEffectiveGain(voice, mixerState) {
    if (!mixerState) return 0.2;
    const ch = mixerState[voice];
    if (!ch) return 0.2;
    if (ch.mute) return 0;

    const anySolo = Object.values(mixerState).some(v => v.solo);
    if (anySolo) {
      return ch.solo ? ch.volume * 0.35 : 0;
    }
    return ch.volume * 0.25;
  }

  function toNoteName(step, octave, alter = 0) {
    if (!step) return 'C4';
    let acc = '';
    const a = parseInt(alter, 10) || 0;
    if (a === 1) acc = '#';
    else if (a === -1) acc = 'b';
    else if (a === 2) acc = '##';
    else if (a === -2) acc = 'bb';
    return `${step.toUpperCase()}${acc}${octave || 4}`;
  }

  function playSinglePitch(step, octave, alter = 0, durationSec = 0.5) {
    if (!step) return;
    const noteName = toNoteName(step, octave, alter);
    if (window.LearnSoundEngine) {
      try {
        window.LearnSoundEngine.init();
        const inst = _playbackState.instrument === 'piano' ? 'piano' : 'organ';
        window.LearnSoundEngine.triggerNote(inst, noteName, durationSec, undefined, 0.85);
        return;
      } catch (e) {
        console.warn('[SoundEngine SingleNote]', e);
      }
    }

    try {
      const ctx = getAudioContext();
      const midi = pitchToMidi(step, octave, alter);
      const freq = midiToFreq(midi);

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      const now = ctx.currentTime;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.28, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + durationSec);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + durationSec + 0.05);
    } catch (e) {
      console.warn('[AudioSynth]', e);
    }
  }

  function playSatbChord(selectedPosition, mixerState, showToastFn) {
    const vMap = selectedPosition?.activeVoiceMap;
    if (!vMap) return;
    const durSec = Math.max(0.6, 60 / (mixerState?.tempo || 84));

    if (window.LearnSoundEngine) {
      try {
        window.LearnSoundEngine.init();
        ['soprano', 'alto', 'tenor', 'bass'].forEach(v => {
          const n = vMap[v];
          if (n && n.step && !n.isRest) {
            const noteName = toNoteName(n.step, n.octave, n.alter);
            let vel = 0.8;
            if (_playbackState.rehearsalMode) {
              vel = (v === selectedPosition.voice) ? 1.0 : 0.22;
            }
            if (_playbackState.instrument === 'choir') {
              window.LearnSoundEngine.triggerSatbNote(v, noteName, durSec, undefined, vel);
            } else {
              const inst = _playbackState.instrument === 'piano' ? 'piano' : 'organ';
              window.LearnSoundEngine.triggerNote(inst, noteName, durSec, undefined, vel);
            }
          }
        });
        if (typeof showToastFn === 'function') {
          showToastFn('🔊 Đang phát hòa âm 4 bè SATB...', 'info', 1000);
        }
        return;
      } catch (e) {
        console.warn('[SoundEngine Chord]', e);
      }
    }

    const ctx = getAudioContext();
    const now = ctx.currentTime;
    ['soprano', 'alto', 'tenor', 'bass'].forEach(v => {
      const n = vMap[v];
      const effGain = getVoiceEffectiveGain(v, mixerState);
      if (n && n.step && !n.isRest && effGain > 0) {
        try {
          const midi = pitchToMidi(n.step, n.octave, n.alter);
          const freq = midiToFreq(midi);

          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = (v === 'bass' || v === 'tenor') ? 'sine' : 'triangle';
          osc.frequency.setValueAtTime(freq, now);

          gain.gain.setValueAtTime(0, now);
          gain.gain.linearRampToValueAtTime(effGain, now + 0.03);
          gain.gain.exponentialRampToValueAtTime(0.001, now + durSec);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(now);
          osc.stop(now + durSec + 0.05);
        } catch (e) {}
      }
    });

    if (typeof showToastFn === 'function') {
      showToastFn('🔊 Đang phát hòa âm 4 bè SATB...', 'info', 1200);
    }
  }

  function toggleScorePlayback(osmd, mixerState, selectedPosition, showToastFn) {
    if (_playbackState.isPlaying) {
      pauseScorePlayback();
    } else {
      startScorePlayback(osmd, mixerState, selectedPosition, showToastFn);
    }
  }

  function startScorePlayback(osmd, mixerState, selectedPosition, showToastFn) {
    if (!osmd) return;
    if (window.LearnSoundEngine) {
      window.LearnSoundEngine.init();
    }

    const cursor = osmd.cursor;
    if (!cursor) return;

    if (cursor.iterator?.EndReached) {
      cursor.reset();
    }
    cursor.show();

    _playbackState.isPlaying = true;
    updateTransportPlayButton(true);
    if (typeof showToastFn === 'function') {
      showToastFn('▶ Bắt đầu phát bản nhạc...', 'info', 1500);
    }

    playbackStep(osmd, mixerState, selectedPosition, showToastFn);
  }

  function playbackStep(osmd, mixerState, selectedPosition, showToastFn) {
    if (!_playbackState.isPlaying || !osmd || !osmd.cursor) return;

    const cursor = osmd.cursor;
    if (cursor.iterator?.EndReached) {
      stopScorePlayback(osmd);
      if (typeof showToastFn === 'function') {
        showToastFn('✓ Đã phát xong bài hát!', 'success', 2000);
      }
      return;
    }

    const gNotes = cursor.GNotesUnderCursor();
    const tempo = mixerState?.tempo || 84;

    let minDur = 0.25;
    if (gNotes && gNotes.length > 0) {
      gNotes.forEach(gn => {
        const sn = gn.sourceNote;
        if (sn && sn.Length && sn.Length.RealValue > 0) {
          if (sn.Length.RealValue < minDur) {
            minDur = sn.Length.RealValue;
          }
        }
      });
    }

    const stepDurationSec = Math.max(0.12, (minDur * 4) * (60 / tempo));
    const stepDurationMs = Math.max(120, Math.round(stepDurationSec * 1000));

    if (gNotes && gNotes.length > 0) {
      gNotes.forEach(gn => {
        const sn = gn.sourceNote;
        if (sn && !sn.isRest() && sn.Pitch) {
          const stepName = ['C', 'D', 'E', 'F', 'G', 'A', 'B'][sn.Pitch.fundamentalNote] || sn.Pitch.step;
          const oct = sn.Pitch.octave;
          const alt = sn.Pitch.accidental || sn.Pitch.alter || 0;
          const noteName = toNoteName(stepName, oct, alt);

          const staffIdx = sn.ParentStaffEntry?.parentStaff?.idInMusicSheet || 0;
          const voiceId = sn.VoiceEntry?.parentVoice?.VoiceId || 1;
          let voice = 'soprano';
          if (staffIdx === 0) {
            voice = (voiceId === 1) ? 'soprano' : 'alto';
          } else {
            voice = (voiceId === 1 || voiceId === 3) ? 'tenor' : 'bass';
          }

          let vel = 0.8;
          if (_playbackState.rehearsalMode) {
            vel = (voice === selectedPosition?.voice) ? 1.0 : 0.2;
          }

          if (window.LearnSoundEngine) {
            if (_playbackState.instrument === 'choir') {
              window.LearnSoundEngine.triggerSatbNote(voice, noteName, stepDurationSec, undefined, vel);
            } else {
              const inst = _playbackState.instrument === 'piano' ? 'piano' : 'organ';
              window.LearnSoundEngine.triggerNote(inst, noteName, stepDurationSec, undefined, vel);
            }
          }
        }
      });
    }

    if (_playbackState.metronome && window.LearnSoundEngine) {
      const isDownbeat = (_playbackState.stepIndex % 4 === 0);
      window.LearnSoundEngine.playMetronomeClick(_playbackState.stepIndex, isDownbeat);
    }
    _playbackState.stepIndex++;

    const cursorEl = cursor.cursorElement;
    if (cursorEl) {
      const wrap = document.getElementById('sheet-wrapper');
      if (wrap) {
        const wrapRect = wrap.getBoundingClientRect();
        const curRect = cursorEl.getBoundingClientRect();
        if (curRect.bottom > wrapRect.bottom - 100 || curRect.top < wrapRect.top + 60) {
          cursorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    }

    updateTransportTimeDisplay(osmd);
    cursor.next();

    if (_playbackState.loopEnabled) {
      const curMeasure = (cursor.iterator?.currentMeasureIndex || 0) + 1;
      if (curMeasure > _playbackState.loopEndMeasure) {
        cursor.reset();
      }
    }

    _playbackState.timer = setTimeout(() => playbackStep(osmd, mixerState, selectedPosition, showToastFn), stepDurationMs);
  }

  function pauseScorePlayback() {
    _playbackState.isPlaying = false;
    if (_playbackState.timer) {
      clearTimeout(_playbackState.timer);
      _playbackState.timer = null;
    }
    updateTransportPlayButton(false);
    if (window.LearnSoundEngine) {
      window.LearnSoundEngine.stopAll();
    }
  }

  function stopScorePlayback(osmd) {
    pauseScorePlayback();
    if (osmd && osmd.cursor) {
      osmd.cursor.reset();
      osmd.cursor.show();
    }
    _playbackState.stepIndex = 0;
    const timeDisplay = document.getElementById('transport-time-display');
    if (timeDisplay) timeDisplay.textContent = '00:00 / 00:00';
  }

  function rewindScorePlayback(osmd, showToastFn) {
    stopScorePlayback(osmd);
    const wrap = document.getElementById('sheet-wrapper');
    if (wrap) wrap.scrollTo({ top: 0, behavior: 'smooth' });
    if (typeof showToastFn === 'function') {
      showToastFn('⏮ Đã trở về đầu bài hát', 'info', 1000);
    }
  }

  function updateTransportPlayButton(isPlaying) {
    const btn = document.getElementById('btn-transport-play');
    const icon = document.getElementById('transport-play-icon');
    const label = document.getElementById('transport-play-label');
    if (!btn) return;
    if (isPlaying) {
      btn.classList.add('is-playing');
      if (icon) icon.textContent = '⏸';
      if (label) label.textContent = 'TẠM DỪNG';
    } else {
      btn.classList.remove('is-playing');
      if (icon) icon.textContent = '▶';
      if (label) label.textContent = 'PHÁT BÀI';
    }
  }

  function updateTransportTimeDisplay(osmd) {
    const timeDisplay = document.getElementById('transport-time-display');
    if (!timeDisplay || !osmd || !osmd.cursor) return;
    const curMeas = (osmd.cursor.iterator?.currentMeasureIndex || 0) + 1;
    const totalMeas = osmd.GraphicSheet?.MeasureList?.length || 1;
    timeDisplay.textContent = `Ô ${curMeas} / ${totalMeas}`;
  }

  window.EditorAudio = {
    getAudioContext,
    pitchToMidi,
    midiToFreq,
    getVoiceEffectiveGain,
    toNoteName,
    playSinglePitch,
    playSatbChord,
    toggleScorePlayback,
    startScorePlayback,
    pauseScorePlayback,
    stopScorePlayback,
    rewindScorePlayback,
    updateTransportPlayButton,
    updateTransportTimeDisplay,
    getPlaybackState: () => _playbackState
  };
})();
