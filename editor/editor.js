/**
 * editor/editor.js — MusicXML Note Editor Pro (4 Bè SATB)
 * Độc lập 4 bè · Kéo thả thẳng đứng (Vertical Drag) · Kiểm tra đủ ô nhịp · Bảo toàn bản gốc & Quản lý phiên bản theo user
 */
(() => {
  'use strict';

  /* ─── State Quản Lý Toàn Cục ─────────────────────────────────── */
  let _songsList = [];
  let _currentSong = null;
  let _currentVersion = null; // null = Bản Gốc (Master)
  let _songVersionsList = [];
  let _xmlDoc = null;
  let _osmd = null;
  let _audioCtx = null;

  // Lịch sử Undo / Redo
  let _undoStack = [];
  let _redoStack = [];
  const MAX_UNDO = 30;
  let _isDirty = false;

  // Vị trí nốt đang chọn
  let _selectedPosition = {
    measureNumber: 1,
    voice: 'soprano', // 'soprano' | 'alto' | 'tenor' | 'bass'
    beatIndex: 0,
    activeVoiceMap: { soprano: null, alto: null, tenor: null, bass: null }
  };

  let _zoom = 1.0;
  let _smartOverwriteMode = true;

  // Trạng thái SATB Audio Mixer
  const _mixerState = {
    soprano: { volume: 0.85, solo: false, mute: false },
    alto:    { volume: 0.85, solo: false, mute: false },
    tenor:   { volume: 0.85, solo: false, mute: false },
    bass:    { volume: 0.85, solo: false, mute: false },
    tempo: 90,
    metronome: false
  };

  // Trạng thái sức khỏe ô nhịp toàn bài
  let _measureHealth = {}; // { [measureNum]: { status: 'ok'|'underflow'|'overflow', missing: number, excess: number } }

  // Trạng thái Kéo thả nốt thẳng đứng (Vertical Drag-to-Pitch 60 FPS Optimistic UI)
  const _dragState = {
    active: false,
    pointerId: null,
    targetEl: null,
    visualEl: null,
    startY: 0,
    startX: 0,
    baseMidi: 60,
    currentStep: 'C',
    currentOctave: 4,
    currentAlter: 0,
    previewStep: 'C',
    previewOctave: 4,
    hasMoved: false,
    voice: 'soprano'
  };

  /* ─── Web Audio Synthesizer (Bộ Tạo Âm Thanh & Mixer) ───────── */
  function _getAudioContext() {
    if (!_audioCtx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      _audioCtx = new AudioCtx();
    }
    if (_audioCtx.state === 'suspended') {
      _audioCtx.resume();
    }
    return _audioCtx;
  }

  function _pitchToMidi(step, octave, alter = 0) {
    const offsets = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
    const base = offsets[step?.toUpperCase()] ?? 0;
    return (parseInt(octave, 10) + 1) * 12 + base + (parseInt(alter, 10) || 0);
  }

  function _midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  // Tính âm lượng thực tế của bè sau khi xét Solo / Mute
  function _getVoiceEffectiveGain(voice) {
    const ch = _mixerState[voice];
    if (!ch) return 0.2;
    if (ch.mute) return 0;

    // Nếu có ít nhất 1 bè đang Solo
    const anySolo = Object.values(_mixerState).some(v => v.solo);
    if (anySolo) {
      return ch.solo ? ch.volume * 0.35 : 0;
    }
    return ch.volume * 0.25;
  }

  /* ─── State Điều Khiển Phát Nhạc Pro & Nhạc Cụ Studio ──────── */
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

  function _toNoteName(step, octave, alter = 0) {
    if (!step) return 'C4';
    let acc = '';
    const a = parseInt(alter, 10) || 0;
    if (a === 1) acc = '#';
    else if (a === -1) acc = 'b';
    else if (a === 2) acc = '##';
    else if (a === -2) acc = 'bb';
    return `${step.toUpperCase()}${acc}${octave || 4}`;
  }

  // Phát 1 nốt đơn (Ưu tiên Studio SoundEngine Grand Piano / Church Organ)
  function playSinglePitch(step, octave, alter = 0, durationSec = 0.5) {
    if (!step) return;
    const noteName = _toNoteName(step, octave, alter);
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

    // Web Audio Fallback
    try {
      const ctx = _getAudioContext();
      const midi = _pitchToMidi(step, octave, alter);
      const freq = _midiToFreq(midi);

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

  // Phát hòa âm 4 bè SATB tại phách đang chọn
  function playSatbChord() {
    const vMap = _selectedPosition.activeVoiceMap;
    if (!vMap) return;
    const durSec = Math.max(0.6, 60 / _mixerState.tempo);

    if (window.LearnSoundEngine) {
      try {
        window.LearnSoundEngine.init();
        ['soprano', 'alto', 'tenor', 'bass'].forEach(v => {
          const n = vMap[v];
          if (n && n.step && !n.isRest) {
            const noteName = _toNoteName(n.step, n.octave, n.alter);
            let vel = 0.8;
            if (_playbackState.rehearsalMode) {
              vel = (v === _selectedPosition.voice) ? 1.0 : 0.22;
            }
            if (_playbackState.instrument === 'choir') {
              window.LearnSoundEngine.triggerSatbNote(v, noteName, durSec, undefined, vel);
            } else {
              const inst = _playbackState.instrument === 'piano' ? 'piano' : 'organ';
              window.LearnSoundEngine.triggerNote(inst, noteName, durSec, undefined, vel);
            }
          }
        });
        showToast('🔊 Đang phát hòa âm 4 bè SATB...', 'info', 1000);
        return;
      } catch (e) {
        console.warn('[SoundEngine Chord]', e);
      }
    }

    // Web Audio Fallback
    const ctx = _getAudioContext();
    const now = ctx.currentTime;
    ['soprano', 'alto', 'tenor', 'bass'].forEach(v => {
      const n = vMap[v];
      const effGain = _getVoiceEffectiveGain(v);
      if (n && n.step && !n.isRest && effGain > 0) {
        try {
          const midi = _pitchToMidi(n.step, n.octave, n.alter);
          const freq = _midiToFreq(midi);

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

    showToast('🔊 Đang phát hòa âm 4 bè SATB...', 'info', 1200);
  }

  /* ─── Score Playback Engine Với Con Trỏ OSMD Động ──────────── */
  function toggleScorePlayback() {
    if (_playbackState.isPlaying) {
      pauseScorePlayback();
    } else {
      startScorePlayback();
    }
  }

  function startScorePlayback() {
    if (!_osmd) return;
    if (window.LearnSoundEngine) {
      window.LearnSoundEngine.init();
    }

    const cursor = _osmd.cursor;
    if (!cursor) return;

    if (cursor.iterator?.EndReached) {
      cursor.reset();
    }
    cursor.show();

    _playbackState.isPlaying = true;
    _updateTransportPlayButton(true);
    showToast('▶ Bắt đầu phát bản nhạc...', 'info', 1500);

    _playbackStep();
  }

  function _playbackStep() {
    if (!_playbackState.isPlaying || !_osmd || !_osmd.cursor) return;

    const cursor = _osmd.cursor;
    if (cursor.iterator?.EndReached) {
      stopScorePlayback();
      showToast('✓ Đã phát xong bài hát!', 'success', 2000);
      return;
    }

    const gNotes = cursor.GNotesUnderCursor();
    const tempo = _mixerState.tempo || 84;

    // Tìm trường độ nhỏ nhất để tính nhịp bước tiếp theo
    let minDur = 0.25; // default 1 phách
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

    // Phát âm thanh các nốt dưới con trỏ
    if (gNotes && gNotes.length > 0) {
      gNotes.forEach(gn => {
        const sn = gn.sourceNote;
        if (sn && !sn.isRest() && sn.Pitch) {
          const stepName = ['C', 'D', 'E', 'F', 'G', 'A', 'B'][sn.Pitch.fundamentalNote] || sn.Pitch.step;
          const oct = sn.Pitch.octave;
          const alt = sn.Pitch.accidental || sn.Pitch.alter || 0;
          const noteName = _toNoteName(stepName, oct, alt);

          // Phân loại bè
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
            vel = (voice === _selectedPosition.voice) ? 1.0 : 0.2;
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

    // Metronome Click nếu bật
    if (_playbackState.metronome && window.LearnSoundEngine) {
      const isDownbeat = (_playbackState.stepIndex % 4 === 0);
      window.LearnSoundEngine.playMetronomeClick(_playbackState.stepIndex, isDownbeat);
    }
    _playbackState.stepIndex++;

    // Tự động cuộn theo dõi con trỏ màn hình
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

    // Cập nhật vị trí hiển thị thời gian
    _updateTransportTimeDisplay();

    // Bước sang nốt tiếp theo
    cursor.next();

    // Vòng lặp A-B
    if (_playbackState.loopEnabled) {
      const curMeasure = (cursor.iterator?.currentMeasureIndex || 0) + 1;
      if (curMeasure > _playbackState.loopEndMeasure) {
        cursor.reset();
      }
    }

    _playbackState.timer = setTimeout(_playbackStep, stepDurationMs);
  }

  function pauseScorePlayback() {
    _playbackState.isPlaying = false;
    if (_playbackState.timer) {
      clearTimeout(_playbackState.timer);
      _playbackState.timer = null;
    }
    _updateTransportPlayButton(false);
    if (window.LearnSoundEngine) {
      window.LearnSoundEngine.stopAll();
    }
  }

  function stopScorePlayback() {
    pauseScorePlayback();
    if (_osmd && _osmd.cursor) {
      _osmd.cursor.reset();
      _osmd.cursor.show();
    }
    _playbackState.stepIndex = 0;
    const timeDisplay = document.getElementById('transport-time-display');
    if (timeDisplay) timeDisplay.textContent = '00:00 / 00:00';
  }

  function rewindScorePlayback() {
    stopScorePlayback();
    const wrap = document.getElementById('sheet-wrapper');
    if (wrap) wrap.scrollTo({ top: 0, behavior: 'smooth' });
    showToast('⏮ Đã trở về đầu bài hát', 'info', 1000);
  }

  function _updateTransportPlayButton(isPlaying) {
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

  function _updateTransportTimeDisplay() {
    const timeDisplay = document.getElementById('transport-time-display');
    if (!timeDisplay || !_osmd || !_osmd.cursor) return;
    const curMeas = (_osmd.cursor.iterator?.currentMeasureIndex || 0) + 1;
    const totalMeas = _osmd.GraphicSheet?.MeasureList?.length || 1;
    timeDisplay.textContent = `Ô ${curMeas} / ${totalMeas}`;
  }

  /* ─── Web MIDI Plug & Play Keyboard Input ───────────────────── */
  let _midiAccess = null;

  function initWebMidi() {
    if (!navigator.requestMIDIAccess) {
      const badge = document.getElementById('midi-status-badge');
      if (badge) {
        badge.title = 'Trình duyệt không hỗ trợ Web MIDI API (Hãy dùng Google Chrome hoặc Edge)';
      }
      return;
    }

    navigator.requestMIDIAccess({ sysex: false }).then(
      (midiAccess) => {
        _midiAccess = midiAccess;
        _updateMidiStatus();
        _midiAccess.onstatechange = () => _updateMidiStatus();
      },
      (err) => {
        console.warn('[WebMIDI] Request access error:', err);
      }
    );
  }

  function _updateMidiStatus() {
    const badge = document.getElementById('midi-status-badge');
    const textEl = document.getElementById('midi-status-text');
    if (!badge || !_midiAccess) return;

    const inputs = Array.from(_midiAccess.inputs.values());
    if (inputs.length > 0) {
      badge.classList.remove('disconnected');
      badge.classList.add('connected');
      const devName = inputs[0].name || 'Đã kết nối';
      if (textEl) textEl.textContent = `🎹 MIDI: ${devName}`;
      badge.title = `Đã kết nối với đàn ${devName} qua Web MIDI. Gõ phím trên đàn để nhập nốt!`;

      inputs.forEach(input => {
        input.onmidimessage = _handleMidiMessage;
      });
    } else {
      badge.classList.remove('connected');
      badge.classList.add('disconnected');
      if (textEl) textEl.textContent = '🎹 MIDI: Chưa cắm';
      badge.title = 'Cắm đàn Piano/Organ qua USB hoặc Bluetooth MIDI để gõ nốt trực tiếp';
    }
  }

  function _handleMidiMessage(event) {
    const [status, noteNumber, velocity] = event.data;
    const command = status >> 4;

    // Note On (command 9 và velocity > 0)
    if (command === 9 && velocity > 0) {
      const badge = document.getElementById('midi-status-badge');
      if (badge) {
        badge.classList.add('note-active');
        setTimeout(() => badge.classList.remove('note-active'), 150);
      }

      // Chuyển MIDI số sang Step, Octave, Alter
      const chromaticMap = [
        { step: 'C', alter: 0 },
        { step: 'C', alter: 1 },
        { step: 'D', alter: 0 },
        { step: 'D', alter: 1 },
        { step: 'E', alter: 0 },
        { step: 'F', alter: 0 },
        { step: 'F', alter: 1 },
        { step: 'G', alter: 0 },
        { step: 'G', alter: 1 },
        { step: 'A', alter: 0 },
        { step: 'A', alter: 1 },
        { step: 'B', alter: 0 }
      ];
      const item = chromaticMap[noteNumber % 12];
      const oct = Math.floor(noteNumber / 12) - 1;

      // Phát âm thanh phản hồi tức thì
      playSinglePitch(item.step, oct, item.alter, 0.4);

      // Điền hoặc đổi cao độ của nốt đang chọn
      modifyPitch(item.step, oct, item.alter);
    }
  }

  /* ─── Phép Màu AI: Tự Động Hòa Âm 4 Bè SATB ───────────────── */
  function openAiHarmonizeModal() {
    document.getElementById('ai-harmonize-modal')?.classList.remove('hidden');
  }

  function closeAiHarmonizeModal() {
    document.getElementById('ai-harmonize-modal')?.classList.add('hidden');
  }

  async function executeAiHarmonization() {
    if (!_xmlDoc) return;
    const scopeEl = document.getElementById('select-ai-scope');
    const scope = scopeEl?.value || 'all';

    _pushUndoState('AI Hòa Âm 4 Bè SATB');
    showToast('✨ AI đang phân tích giai điệu và thiết lập hòa âm 4 bè...', 'info', 2000);

    try {
      // 1. Nhận diện giọng điệu (Key)
      const fifthsVal = parseInt(_xmlDoc.querySelector('key fifths')?.textContent || '0', 10);
      const fifthsMap = {
        0: 'C', 1: 'G', 2: 'D', 3: 'A', 4: 'E', 5: 'B',
        '-1': 'F', '-2': 'Bb', '-3': 'Eb', '-4': 'Ab', '-5': 'Db'
      };
      const keyName = fifthsMap[fifthsVal] || 'C';

      // Tập hợp các hợp âm hòa thanh kinh điển theo giọng
      const chordsDict = {
        C:  { I: ['C','E','G'], ii: ['D','F','A'], IV: ['F','A','C'], V: ['G','B','D'], vi: ['A','C','E'] },
        G:  { I: ['G','B','D'], ii: ['A','C','E'], IV: ['C','E','G'], V: ['D','F#','A'], vi: ['E','G','B'] },
        F:  { I: ['F','A','C'], ii: ['G','Bb','D'], IV: ['Bb','D','F'], V: ['C','E','G'], vi: ['D','F','A'] },
        D:  { I: ['D','F#','A'], ii: ['E','G','B'], IV: ['G','B','D'], V: ['A','C#','E'], vi: ['B','D','F#'] },
        Bb: { I: ['Bb','D','F'], ii: ['C','Eb','G'], IV: ['Eb','G','Bb'], V: ['F','A','C'], vi: ['G','Bb','D'] }
      }[keyName] || {
        I: ['C','E','G'], ii: ['D','F','A'], IV: ['F','A','C'], V: ['G','B','D'], vi: ['A','C','E']
      };

      const p1 = _xmlDoc.querySelector('part#P1') || _xmlDoc.querySelector('part');
      if (!p1) throw new Error('Không tìm thấy dữ liệu bè trong MusicXML');

      const measures = Array.from(p1.querySelectorAll('measure'));
      const startIdx = (scope === 'from_current') ? Math.max(0, _selectedPosition.measureNumber - 1) : 0;

      for (let mIdx = startIdx; mIdx < measures.length; mIdx++) {
        const m = measures[mIdx];
        const mNum = parseInt(m.getAttribute('number') || String(mIdx + 1), 10);
        const satbGroup = _getMeasureChordsSATB(mNum);

        satbGroup.forEach((chordGroup, beatIdx) => {
          const s = chordGroup.soprano;
          if (!s || s.isRest || !s.step) return;

          // Chọn hợp âm phù hợp với nốt Soprano
          let chord = chordsDict.I;
          if (chordsDict.V.some(t => t.startsWith(s.step))) chord = chordsDict.V;
          else if (chordsDict.IV.some(t => t.startsWith(s.step))) chord = chordsDict.IV;
          else if (chordsDict.vi.some(t => t.startsWith(s.step))) chord = chordsDict.vi;
          else if (chordsDict.ii.some(t => t.startsWith(s.step))) chord = chordsDict.ii;

          // Bass: Nốt gốc (Root) ở quãng 2 hoặc 3
          const bNote = chord[0];
          const bStep = bNote[0];
          const bOct = (bStep === 'C' || bStep === 'D' || bStep === 'E') ? 3 : 2;

          // Alto: Quãng 3 hoặc 5 ở quãng 4
          const aNote = chord[1];
          const aStep = aNote[0];
          const aOct = 4;

          // Tenor: Nốt còn lại ở quãng 3
          const tNote = chord[2];
          const tStep = tNote[0];
          const tOct = 3;

          // Cập nhật vào nốt XML
          const currSatb = _extractSatbNotesAt(mNum, beatIdx);
          if (currSatb) {
            if (currSatb.alto?.element) _setNotePitchInXml(currSatb.alto.element, aStep, aOct, 0);
            if (currSatb.tenor?.element) _setNotePitchInXml(currSatb.tenor.element, tStep, tOct, 0);
            if (currSatb.bass?.element) _setNotePitchInXml(currSatb.bass.element, bStep, bOct, 0);
          }
        });
      }

      await _renderOsmdFromXmlDoc();
      closeAiHarmonizeModal();
      playSatbChord();
      showToast('✨ Phép màu AI: Đã tự động hòa âm 4 bè SATB hoàn hảo!', 'success', 3000);
    } catch (err) {
      console.error('[AIHarmonizer]', err);
      showToast('⚠️ Lỗi hòa âm: ' + err.message, 'danger', 3000);
    }
  }

  function _setNotePitchInXml(noteEl, step, octave, alter = 0) {
    if (!noteEl || !_xmlDoc) return;
    const rest = noteEl.querySelector('rest');
    if (rest) rest.remove();

    let pitchEl = noteEl.querySelector('pitch');
    if (!pitchEl) {
      pitchEl = _xmlDoc.createElement('pitch');
      noteEl.insertBefore(pitchEl, noteEl.querySelector('duration') || noteEl.firstChild);
    }

    let stepEl = pitchEl.querySelector('step');
    if (!stepEl) {
      stepEl = _xmlDoc.createElement('step');
      pitchEl.appendChild(stepEl);
    }
    stepEl.textContent = step.toUpperCase();

    let octEl = pitchEl.querySelector('octave');
    if (!octEl) {
      octEl = _xmlDoc.createElement('octave');
      pitchEl.appendChild(octEl);
    }
    octEl.textContent = String(octave);

    let altEl = pitchEl.querySelector('alter');
    if (alter !== 0) {
      if (!altEl) {
        altEl = _xmlDoc.createElement('alter');
        pitchEl.appendChild(altEl);
      }
      altEl.textContent = String(alter);
    } else if (altEl) {
      altEl.remove();
    }
  }

  /* ─── Choir Rehearsal Focus Mode (Luyện Bè Solo) ───────────── */
  function toggleRehearsalMode() {
    _playbackState.rehearsalMode = !_playbackState.rehearsalMode;
    const btn = document.getElementById('btn-toggle-rehearsal');
    const container = document.querySelector('.sheet-paper-container');

    if (btn) btn.classList.toggle('active', _playbackState.rehearsalMode);
    if (container) {
      container.classList.toggle('rehearsal-mode-active', _playbackState.rehearsalMode);
      ['soprano', 'alto', 'tenor', 'bass'].forEach(v => {
        container.classList.remove(`focus-${v}`);
      });
      if (_playbackState.rehearsalMode) {
        container.classList.add(`focus-${_selectedPosition.voice}`);
      }
    }

    const voiceName = _selectedPosition.voice.toUpperCase();
    if (_playbackState.rehearsalMode) {
      showToast(`🎯 Đã bật Chế độ Luyện Bè: Nổi bật bè ${voiceName} (Âm lượng 100%, 3 bè phụ 20%)`, 'info', 2500);
      playSatbChord();
    } else {
      showToast('Đã tắt Chế độ Luyện Bè', 'info', 1500);
    }
  }

  /* ─── Pro Export Hub (Xuất Bản In Ấn / XML / MIDI) ─────────── */
  function openExportModal() {
    document.getElementById('export-score-modal')?.classList.remove('hidden');
  }

  function closeExportModal() {
    document.getElementById('export-score-modal')?.classList.add('hidden');
  }

  function exportPdfScore() {
    closeExportModal();
    showToast('📄 Đang mở cửa sổ in PDF Vector A4...', 'info', 1500);
    setTimeout(() => {
      window.print();
    }, 200);
  }

  function exportMusicXmlScore() {
    if (!_xmlDoc) return;
    try {
      const serializer = new XMLSerializer();
      const xmlString = serializer.serializeToString(_xmlDoc);
      const blob = new Blob([xmlString], { type: 'application/vnd.recordare.musicxml+xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const filename = (_currentSong?.slug || 'sheetapp-score') + '.musicxml';
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      closeExportModal();
      showToast(`🎼 Đã tải file MusicXML (${filename}) thành công!`, 'success', 2500);
    } catch (e) {
      showToast('⚠️ Lỗi xuất MusicXML: ' + e.message, 'danger', 3000);
    }
  }

  function exportMidiScore() {
    if (!_xmlDoc) return;
    try {
      const midiBlob = _createStandardMidiFile();
      const url = URL.createObjectURL(midiBlob);
      const a = document.createElement('a');
      const filename = (_currentSong?.slug || 'sheetapp-score') + '.mid';
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      closeExportModal();
      showToast(`🎹 Đã tải file MIDI (${filename}) thành công!`, 'success', 2500);
    } catch (e) {
      showToast('⚠️ Lỗi xuất MIDI: ' + e.message, 'danger', 3000);
    }
  }

  function _createStandardMidiFile() {
    // Generate Standard MIDI Format 0 file
    const ticksPerQuarter = 480;
    const bpm = _mixerState.tempo || 84;
    const microsecPerQuarter = Math.round(60000000 / bpm);

    const trackEvents = [];

    // Helper variable-length quantity
    function writeVarLen(val) {
      let buffer = val & 0x7f;
      while ((val >>= 7) > 0) {
        buffer <<= 8;
        buffer |= 0x80;
        buffer += (val & 0x7f);
      }
      const bytes = [];
      while (true) {
        bytes.push(buffer & 0xff);
        if (buffer & 0x80) buffer >>= 8;
        else break;
      }
      return bytes;
    }

    // Tempo event at delta 0: FF 51 03
    trackEvents.push(0x00, 0xff, 0x51, 0x03,
      (microsecPerQuarter >> 16) & 0xff,
      (microsecPerQuarter >> 8) & 0xff,
      microsecPerQuarter & 0xff
    );

    // Track Name: FF 03 [len] [chars]
    const title = (_currentSong?.title || 'SheetApp Choral Score');
    const titleBytes = Array.from(new TextEncoder().encode(title));
    trackEvents.push(0x00, 0xff, 0x03, titleBytes.length, ...titleBytes);

    // Collect note events from all measures
    const p1 = _xmlDoc.querySelector('part#P1') || _xmlDoc.querySelector('part');
    if (p1) {
      const measures = Array.from(p1.querySelectorAll('measure'));
      measures.forEach(m => {
        const mNum = parseInt(m.getAttribute('number') || '1', 10);
        const satbGroup = _getMeasureChordsSATB(mNum);
        satbGroup.forEach(chord => {
          ['soprano', 'alto', 'tenor', 'bass'].forEach(v => {
            const n = chord[v];
            if (n && !n.isRest && n.step) {
              const midi = _pitchToMidi(n.step, n.octave, n.alter);
              // Note On delta 0, Note Off delta ticksPerQuarter
              trackEvents.push(0x00, 0x90, midi, 0x5a); // Note on vel 90
              trackEvents.push(...writeVarLen(ticksPerQuarter), 0x80, midi, 0x00); // Note off
            }
          });
        });
      });
    }

    // End of Track: 00 FF 2F 00
    trackEvents.push(0x00, 0xff, 0x2f, 0x00);

    // Header Chunk: MThd, len 6, fmt 0, 1 track, ticksPerQuarter
    const header = [
      0x4d, 0x54, 0x68, 0x64, // 'MThd'
      0x00, 0x00, 0x00, 0x06, // len 6
      0x00, 0x00,             // fmt 0
      0x00, 0x01,             // 1 track
      (ticksPerQuarter >> 8) & 0xff, ticksPerQuarter & 0xff
    ];

    // Track Chunk: MTrk, len, events
    const trkLen = trackEvents.length;
    const trackHeader = [
      0x4d, 0x54, 0x72, 0x6b, // 'MTrk'
      (trkLen >> 24) & 0xff,
      (trkLen >> 16) & 0xff,
      (trkLen >> 8) & 0xff,
      trkLen & 0xff
    ];

    const fullMidiBytes = new Uint8Array([...header, ...trackHeader, ...trackEvents]);
    return new Blob([fullMidiBytes], { type: 'audio/midi' });
  }

  // Phát toàn bộ ô nhịp theo tempo BPM
  function playMeasure() {
    const mNum = _selectedPosition.measureNumber;
    if (!_xmlDoc) return;
    showToast(`▶ Đang phát ô nhịp ${mNum}...`, 'info', 1500);

    const satbGroup = _getMeasureChordsSATB(mNum);
    if (!satbGroup || satbGroup.length === 0) return;

    const secPerBeat = 60 / _mixerState.tempo;
    satbGroup.forEach((chordData, idx) => {
      setTimeout(() => {
        _selectedPosition.beatIndex = idx;
        _selectedPosition.activeVoiceMap = chordData;
        playSatbChord();
        _refreshInspectorUI();
      }, idx * secPerBeat * 1000);
    });
  }

  /* ─── XML Parser & SATB Extraction ───────────────────────────── */
  function _extractSatbNotesAt(measureNum, beatIndex = 0) {
    if (!_xmlDoc) return null;

    const parts = _xmlDoc.querySelectorAll('part');
    const part1 = _xmlDoc.querySelector('part#P1') || parts[0];
    const part2 = _xmlDoc.querySelector('part#P2') || parts[1];
    if (!part1) return null;

    const m1 = part1.querySelector(`measure[number="${measureNum}"]`);
    const m2 = part2 ? part2.querySelector(`measure[number="${measureNum}"]`) : null;
    if (!m1) return null;

    const p1Chords = _groupChordsInMeasure(m1);
    const p2Chords = m2 ? _groupChordsInMeasure(m2) : [];

    const totalBeats = Math.max(p1Chords.length, 1);
    const safeIdx = Math.max(0, Math.min(beatIndex, totalBeats - 1));

    const chordP1 = p1Chords[safeIdx] || [];
    const chordP2 = p2Chords[safeIdx] || [];
    const allChordsAtBeat = [...chordP1, ...chordP2];

    // Phân loại Khóa Sol: Soprano (trên) & Alto (dưới)
    let sopranoNote = null;
    let altoNote = null;
    if (chordP1.length === 1) {
      sopranoNote = chordP1[0];
    } else if (chordP1.length >= 2) {
      const sorted = [...chordP1].sort((a, b) => _pitchValue(b) - _pitchValue(a));
      sopranoNote = sorted[0];
      altoNote = sorted[1];
    }

    // Phân loại Khóa Fa: Tenor (trên) & Bass (dưới)
    let tenorNote = null;
    let bassNote = null;
    if (chordP2.length === 1) {
      bassNote = chordP2[0];
    } else if (chordP2.length >= 2) {
      const sorted = [...chordP2].sort((a, b) => _pitchValue(b) - _pitchValue(a));
      tenorNote = sorted[0];
      bassNote = sorted[1];
    }

    return {
      beatIndex: safeIdx,
      totalBeats: totalBeats,
      soprano: sopranoNote ? _parseNoteData(sopranoNote, 'soprano', allChordsAtBeat) : null,
      alto:    altoNote ? _parseNoteData(altoNote, 'alto', allChordsAtBeat) : null,
      tenor:   tenorNote ? _parseNoteData(tenorNote, 'tenor', allChordsAtBeat) : null,
      bass:    bassNote ? _parseNoteData(bassNote, 'bass', allChordsAtBeat) : null
    };
  }

  function _getMeasureChordsSATB(measureNum) {
    if (!_xmlDoc) return [];
    const parts = _xmlDoc.querySelectorAll('part');
    const part1 = _xmlDoc.querySelector('part#P1') || parts[0];
    if (!part1) return [];
    const m1 = part1.querySelector(`measure[number="${measureNum}"]`);
    if (!m1) return [];
    const chords = _groupChordsInMeasure(m1);
    return chords.map((_, i) => {
      const satb = _extractSatbNotesAt(measureNum, i);
      return {
        soprano: satb?.soprano,
        alto: satb?.alto,
        tenor: satb?.tenor,
        bass: satb?.bass
      };
    });
  }

  function _groupChordsInMeasure(measureEl) {
    if (!measureEl) return [];
    // Nhóm nốt theo mốc thời gian thực tế trong ô nhịp (xử lý chuẩn xác thẻ <backup> và <forward>)
    const notesByTime = new Map();
    let curTime = 0;
    let lastStartTime = 0;

    for (const child of Array.from(measureEl.children)) {
      const tag = child.tagName.toLowerCase();
      if (tag === 'note') {
        const isChord = child.querySelector('chord') !== null;
        const dur = parseInt(child.querySelector('duration')?.textContent || '0', 10);
        let noteTime = curTime;
        if (isChord) {
          noteTime = lastStartTime;
        } else {
          lastStartTime = curTime;
          curTime += dur;
        }
        if (!notesByTime.has(noteTime)) notesByTime.set(noteTime, []);
        notesByTime.get(noteTime).push(child);
      } else if (tag === 'backup') {
        const dur = parseInt(child.querySelector('duration')?.textContent || '0', 10);
        curTime = Math.max(0, curTime - dur);
      } else if (tag === 'forward') {
        const dur = parseInt(child.querySelector('duration')?.textContent || '0', 10);
        curTime += dur;
      }
    }

    const sortedTimes = Array.from(notesByTime.keys()).sort((a, b) => a - b);
    return sortedTimes.map(t => notesByTime.get(t));
  }

  function _pitchValue(noteEl) {
    const stepEl = noteEl.querySelector('pitch > step');
    const octEl  = noteEl.querySelector('pitch > octave');
    const altEl  = noteEl.querySelector('pitch > alter');
    if (!stepEl || !octEl) return 0;
    return _pitchToMidi(stepEl.textContent.trim(), octEl.textContent.trim(), altEl ? altEl.textContent.trim() : 0);
  }

  function _parseNoteData(noteEl, voiceName, chordGroup = null) {
    const isRest = noteEl.querySelector('rest') !== null;
    const stepEl = noteEl.querySelector('pitch > step');
    const octEl  = noteEl.querySelector('pitch > octave');
    const altEl  = noteEl.querySelector('pitch > alter');
    const typeEl = noteEl.querySelector('type');
    const dotEl  = noteEl.querySelector('dot') !== null;
    const durEl  = noteEl.querySelector('duration');
    let lyricEl= noteEl.querySelector('lyric > text');
    if (!lyricEl && chordGroup && Array.isArray(chordGroup)) {
      for (const sib of chordGroup) {
        const sibLyric = sib.querySelector('lyric > text');
        if (sibLyric && sibLyric.textContent.trim()) {
          lyricEl = sibLyric;
          break;
        }
      }
    }
    const tieEl  = noteEl.querySelector('tie') || noteEl.querySelector('tied');
    const slurEl = noteEl.querySelector('slur');
    const fermataEl = noteEl.querySelector('fermata');
    const tupletEl  = noteEl.querySelector('time-modification');
    const staccatoEl = noteEl.querySelector('staccato');
    const accentEl = noteEl.querySelector('accent');
    const tenutoEl = noteEl.querySelector('tenuto');

    return {
      xmlNode: noteEl,
      voice: voiceName,
      isRest: isRest,
      step: stepEl ? stepEl.textContent.trim().toUpperCase() : 'C',
      octave: octEl ? parseInt(octEl.textContent.trim(), 10) : 4,
      alter: altEl ? parseInt(altEl.textContent.trim(), 10) : 0,
      type: typeEl ? typeEl.textContent.trim().toLowerCase() : 'quarter',
      isDot: dotEl,
      duration: durEl ? parseInt(durEl.textContent.trim(), 10) : 4,
      lyric: lyricEl ? lyricEl.textContent.trim() : '',
      isTie: !!tieEl,
      isSlur: !!slurEl,
      isFermata: !!fermataEl,
      isTuplet: !!tupletEl,
      isStaccato: !!staccatoEl,
      isAccent: !!accentEl,
      isTenuto: !!tenutoEl,
      _chordSiblings: chordGroup
    };
  }

  /* ─── Cập Nhật Giao Diện Inspector & Thanh Trạng Thái ───────── */
  function _refreshInspectorUI() {
    const { measureNumber, voice, beatIndex } = _selectedPosition;
    const satb = _extractSatbNotesAt(measureNumber, beatIndex);
    if (!satb) return;

    _selectedPosition.activeVoiceMap = {
      soprano: satb.soprano,
      alto:    satb.alto,
      tenor:   satb.tenor,
      bass:    satb.bass
    };

    // 1. Nhãn vị trí ô nhịp & phách
    const posLabel = document.getElementById('pos-info-label');
    if (posLabel) {
      posLabel.innerHTML = `Ô nhịp: <strong>${measureNumber}</strong> | Phách: <strong>${(beatIndex || 0) + 1}/${satb.totalBeats || 1}</strong>`;
    }

    // 2. Cảnh báo ô nhịp tại nốt này
    const health = _measureHealth[measureNumber];
    const alertChip = document.getElementById('measure-alert-chip');
    const alertText = document.getElementById('measure-alert-text');
    if (alertChip) {
      if (health && health.status === 'underflow') {
        if (alertText) alertText.textContent = `⚠️ Thiếu ${health.missingBeats} phách`;
        alertChip.className = 'measure-alert-chip underflow';
        alertChip.classList.remove('hidden');
      } else if (health && health.status === 'overflow') {
        if (alertText) alertText.textContent = `⛔ Thừa ${health.excessBeats} phách`;
        alertChip.className = 'measure-alert-chip overflow';
        alertChip.classList.remove('hidden');
      } else {
        alertChip.classList.add('hidden');
      }
    }

    // 3. Cập nhật 4 Tab Bè SATB
    ['soprano', 'alto', 'tenor', 'bass'].forEach(v => {
      const data = satb[v];
      const lbl = document.getElementById(`lbl-pitch-${v}`);
      if (lbl) {
        if (!data) {
          lbl.textContent = 'Trống';
        } else if (data.isRest) {
          lbl.textContent = '𝄽 Nghỉ';
        } else {
          const accSym = data.alter === 1 ? '♯' : (data.alter === -1 ? '♭' : '');
          lbl.textContent = `${data.step}${accSym}${data.octave}`;
        }
      }
    });

    document.querySelectorAll('.satb-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.voice === voice);
    });

    // 4. Đồng bộ nút điều khiển của bè đang chọn
    const curNote = _selectedPosition.activeVoiceMap[voice];
    if (!curNote) {
      _setControlsDisabled(true);
      return;
    }
    _setControlsDisabled(false);

    // Cập nhật Smart QuickBar Hint & Toggle Status
    const quickbarHint = document.getElementById('smart-quickbar-hint');
    if (quickbarHint) {
      const typeMapVi = {
        whole: 'Tròn (4 phách)',
        half: 'Trắng (2 phách)',
        quarter: 'Đen (1 phách)',
        eighth: 'Móc đơn (1/2)',
        '16th': 'Móc kép (1/4)'
      };
      const typeVi = typeMapVi[curNote.type] || curNote.type;
      const voiceVi = { soprano: 'Soprano', alto: 'Alto', tenor: 'Tenor', bass: 'Bass' }[voice] || voice;
      if (curNote.isRest) {
        quickbarHint.innerHTML = `Bè <strong>${voiceVi}</strong> · Dấu lặng <strong>${typeVi}</strong>`;
      } else {
        const acc = curNote.alter === 1 ? '♯' : (curNote.alter === -1 ? '♭' : '');
        quickbarHint.innerHTML = `Bè <strong>${voiceVi}</strong> · Nốt <strong>${curNote.step}${acc}${curNote.octave} (${typeVi})</strong>`;
      }
    }

    // Step (C..B)
    document.querySelectorAll('.btn-step').forEach(btn => {
      btn.classList.toggle('active', !curNote.isRest && btn.dataset.step === curNote.step);
    });

    // Octave
    const octValEl = document.getElementById('current-octave-val');
    if (octValEl) octValEl.textContent = curNote.octave;
    document.querySelectorAll('.pill-oct').forEach(pill => {
      pill.classList.toggle('active', parseInt(pill.dataset.oct, 10) === curNote.octave);
    });

    // Palette & Inspector: Accidental
    document.querySelectorAll('[data-acc]').forEach(btn => {
      let isMatch = false;
      if (btn.dataset.acc === 'sharp' && curNote.alter === 1) isMatch = true;
      if (btn.dataset.acc === 'flat' && curNote.alter === -1) isMatch = true;
      if (btn.dataset.acc === 'natural' && curNote.alter === 0) isMatch = true;
      btn.classList.toggle('active', isMatch);
    });

    // Palette & Inspector: Duration
    document.querySelectorAll('[data-dur], .btn-dur:not(.btn-dot)').forEach(btn => {
      const type = btn.dataset.dur || btn.dataset.type;
      btn.classList.toggle('active', type === curNote.type);
    });

    // Dot & Articulations
    document.getElementById('btn-pal-dot')?.classList.toggle('active', !!curNote.isDot);
    document.getElementById('btn-pal-tie')?.classList.toggle('active', !!curNote.isTie);
    document.getElementById('btn-pal-slur')?.classList.toggle('active', !!curNote.isSlur);
    document.getElementById('btn-pal-staccato')?.classList.toggle('active', !!curNote.isStaccato);
    document.getElementById('btn-pal-accent')?.classList.toggle('active', !!curNote.isAccent);
    document.getElementById('btn-pal-tenuto')?.classList.toggle('active', !!curNote.isTenuto);
    document.getElementById('btn-pal-fermata')?.classList.toggle('active', !!curNote.isFermata);
    document.getElementById('btn-pal-tuplet')?.classList.toggle('active', !!curNote.isTuplet);

    // Lyric
    const lyricInput = document.getElementById('input-note-lyric');
    if (lyricInput && document.activeElement !== lyricInput) {
      lyricInput.value = curNote.lyric || '';
    }

    // Mini piano highlight
    _highlightPianoKey(curNote.step, curNote.octave, curNote.alter);

    // Đồng bộ highlight nốt trên bản nhạc SVG
    _highlightSelectedSvgNote();

    // Cập nhật trạng thái ô nhịp Realtime BÁO ĐỎ / BÁO XANH
    _updateRealtimeMeasureUI();
  }

  function _setControlsDisabled(disabled) {
    document.querySelectorAll('.inspector-body button:not(.btn-solo):not(.btn-mute):not(.btn-m-action), .inspector-body input:not(.ch-volume):not(#slider-tempo)').forEach(el => {
      el.disabled = disabled;
    });
  }

  /* ─── Lịch Sử Undo / Redo & Quản Lý Trạng Thái Lưu ──────────── */
  function _saveSnapshotForUndo() {
    if (!_xmlDoc) return;
    const xmlString = new XMLSerializer().serializeToString(_xmlDoc);
    _undoStack.push(xmlString);
    if (_undoStack.length > MAX_UNDO) _undoStack.shift();
    _redoStack = [];
    _updateUndoRedoButtons();
    _setDirty(true);
  }

  function _setDirty(dirty) {
    _isDirty = dirty;
    const badge = document.getElementById('unsaved-status-badge');
    if (badge) {
      badge.textContent = dirty ? '● Có thay đổi chưa lưu' : 'Đã đồng bộ';
      badge.className = dirty ? 'badge-clean dirty' : 'badge-clean';
    }
  }

  async function undo() {
    if (_undoStack.length === 0) return;
    const currentXml = new XMLSerializer().serializeToString(_xmlDoc);
    _redoStack.push(currentXml);
    const prevXml = _undoStack.pop();
    await _parseAndLoadXml(prevXml, false);
    _updateUndoRedoButtons();
    showToast('↶ Đã hoàn tác', 'info', 1000);
  }

  async function redo() {
    if (_redoStack.length === 0) return;
    const currentXml = new XMLSerializer().serializeToString(_xmlDoc);
    _undoStack.push(currentXml);
    const nextXml = _redoStack.pop();
    await _parseAndLoadXml(nextXml, false);
    _updateUndoRedoButtons();
    showToast('↷ Đã làm lại', 'info', 1000);
  }

  function _updateUndoRedoButtons() {
    const undoBtn = document.getElementById('btn-undo');
    const redoBtn = document.getElementById('btn-redo');
    if (undoBtn) undoBtn.disabled = _undoStack.length === 0;
    if (redoBtn) redoBtn.disabled = _redoStack.length === 0;
  }

  /* ─── Core Mutations: Chỉnh Sửa Nốt & Nhạc Lý ─────────────────── */
  async function modifyPitch(newStep, newOctave = null, newAlter = null) {
    const curNote = _selectedPosition.activeVoiceMap[_selectedPosition.voice];
    if (!curNote || !curNote.xmlNode) {
      showToast('Chưa chọn nốt nhạc nào để sửa!', 'error');
      return;
    }

    const wasRest = curNote.isRest;
    _saveSnapshotForUndo();
    const noteEl = curNote.xmlNode;

    // Bỏ rest nếu có
    const restEl = noteEl.querySelector('rest');
    if (restEl) restEl.remove();

    let pitchEl = noteEl.querySelector('pitch');
    if (!pitchEl) {
      pitchEl = _xmlDoc.createElement('pitch');
      noteEl.insertBefore(pitchEl, noteEl.firstChild);
    }

    let stepEl = pitchEl.querySelector('step');
    if (!stepEl) {
      stepEl = _xmlDoc.createElement('step');
      pitchEl.appendChild(stepEl);
    }
    stepEl.textContent = newStep.toUpperCase();

    const defaultVoicePitch = {
      soprano: { step: 'G', octave: 4 },
      alto:    { step: 'E', octave: 4 },
      tenor:   { step: 'C', octave: 3 },
      bass:    { step: 'G', octave: 2 }
    };
    const defaultP = defaultVoicePitch[_selectedPosition.voice] || { step: 'C', octave: 4 };
    const targetOct = newOctave !== null ? newOctave : (curNote.isRest ? defaultP.octave : curNote.octave);
    let octEl = pitchEl.querySelector('octave');
    if (!octEl) {
      octEl = _xmlDoc.createElement('octave');
      pitchEl.appendChild(octEl);
    }
    octEl.textContent = String(targetOct);

    const targetAlt = newAlter !== null ? newAlter : (curNote.isRest ? 0 : curNote.alter);
    let altEl = pitchEl.querySelector('alter');
    if (targetAlt !== 0) {
      if (!altEl) {
        altEl = _xmlDoc.createElement('alter');
        pitchEl.appendChild(altEl);
      }
      altEl.textContent = String(targetAlt);
    } else if (altEl) {
      altEl.remove();
    }

    playSinglePitch(newStep, targetOct, targetAlt, 0.4);

    // Nếu vừa điền nốt vào dấu lặng trong chế độ Smart:
    // Tự động chuyển con trỏ sang phách tiếp theo để người dùng gõ nốt liên tục!
    if (_smartOverwriteMode && wasRest) {
      _selectedPosition.beatIndex++;
    }

    await _renderOsmdFromXmlDoc();
  }

  function modifyAccidental(accType) {
    const curNote = _selectedPosition.activeVoiceMap[_selectedPosition.voice];
    if (!curNote) return;
    let alter = 0;
    if (accType === 'sharp') alter = 1;
    if (accType === 'flat') alter = -1;
    modifyPitch(curNote.step, curNote.octave, alter);
  }

  function modifyOctave(delta) {
    const curNote = _selectedPosition.activeVoiceMap[_selectedPosition.voice];
    if (!curNote) return;
    const newOct = Math.max(1, Math.min(7, curNote.octave + delta));
    if (newOct !== curNote.octave) {
      modifyPitch(curNote.step, newOct, curNote.alter);
    }
  }

  // Tăng/Giảm Nửa Cung (Semitone Chromatic Step)
  function stepSemitone(delta) {
    const curNote = _selectedPosition.activeVoiceMap[_selectedPosition.voice];
    if (!curNote) return;
    const defaultVoiceMidi = { soprano: 67, alto: 64, tenor: 48, bass: 43 };
    const curMidi = curNote.isRest ? (defaultVoiceMidi[_selectedPosition.voice] || 60) : _pitchToMidi(curNote.step, curNote.octave, curNote.alter);
    const newMidi = Math.max(24, Math.min(96, curMidi + delta));

    // Chromatic Scale Mapping
    const chromaticMap = [
      { step: 'C', alter: 0 },
      { step: 'C', alter: 1 },
      { step: 'D', alter: 0 },
      { step: 'D', alter: 1 },
      { step: 'E', alter: 0 },
      { step: 'F', alter: 0 },
      { step: 'F', alter: 1 },
      { step: 'G', alter: 0 },
      { step: 'G', alter: 1 },
      { step: 'A', alter: 0 },
      { step: 'A', alter: 1 },
      { step: 'B', alter: 0 }
    ];
    const item = chromaticMap[newMidi % 12];
    const newOct = Math.floor(newMidi / 12) - 1;
    modifyPitch(item.step, newOct, item.alter);
  }

  function _durationToType(subDuration, divisions) {
    const mult = subDuration / (divisions || 4);
    if (mult >= 3.5) return 'whole';
    if (mult >= 1.75) return 'half';
    if (mult >= 0.85) return 'quarter';
    if (mult >= 0.4) return 'eighth';
    if (mult >= 0.2) return '16th';
    return '32nd';
  }

  // Lấy divisions chính xác cho ô nhịp (duyệt ngược về trước nếu ô hiện tại không khai báo attributes)
  function _getDivisionsForMeasure(measureEl) {
    if (measureEl) {
      let cur = measureEl;
      while (cur) {
        const divEl = cur.querySelector('attributes > divisions');
        if (divEl) {
          const val = parseInt(divEl.textContent.trim(), 10);
          if (val > 0) return val;
        }
        cur = cur.previousElementSibling;
      }
    }
    const gDiv = _xmlDoc?.querySelector('divisions');
    if (gDiv) {
      const val = parseInt(gDiv.textContent.trim(), 10);
      if (val > 0) return val;
    }
    return 2;
  }

  async function modifyDuration(newType) {
    const curNote = _selectedPosition.activeVoiceMap[_selectedPosition.voice];
    if (!curNote || !curNote.xmlNode) return;

    _saveSnapshotForUndo();
    const noteEl = curNote.xmlNode;
    const divisions = _getDivisionsForMeasure(noteEl.closest('measure'));
    const multMap = { whole: 4, half: 2, quarter: 1, eighth: 0.5, '16th': 0.25 };
    const mult = multMap[newType] || 1;
    let newDuration = Math.max(1, Math.round(divisions * mult));
    if (curNote.isDot) newDuration = Math.round(newDuration * 1.5);

    let typeEl = noteEl.querySelector('type');
    if (!typeEl) {
      typeEl = _xmlDoc.createElement('type');
      noteEl.appendChild(typeEl);
    }
    typeEl.textContent = newType;

    let durEl = noteEl.querySelector('duration');
    if (!durEl) {
      durEl = _xmlDoc.createElement('duration');
      noteEl.appendChild(durEl);
    }
    durEl.textContent = String(newDuration);

    showToast(`Đã đổi trường độ: ${newType}`, 'info', 1000);
    await _renderOsmdFromXmlDoc();
  }

  function toggleDot() {
    const curNote = _selectedPosition.activeVoiceMap[_selectedPosition.voice];
    if (!curNote || !curNote.xmlNode) return;

    _saveSnapshotForUndo();
    const noteEl = curNote.xmlNode;
    const dotEl = noteEl.querySelector('dot');
    if (dotEl) {
      dotEl.remove();
    } else {
      noteEl.appendChild(_xmlDoc.createElement('dot'));
    }
    modifyDuration(curNote.type);
  }

  // Xóa nốt thành Dấu Lặng (Rest) — An toàn 100% phách
  async function deleteNoteAsRest() {
    const curNote = _selectedPosition.activeVoiceMap[_selectedPosition.voice];
    if (!curNote || !curNote.xmlNode) return;

    _saveSnapshotForUndo();
    const curEl = curNote.xmlNode;
    const siblings = curNote._chordSiblings || [curEl];
    const anchorNode = siblings[0] || curEl;

    // Xóa các nốt phụ trong hợp âm (chord notes) nếu có
    for (let i = 1; i < siblings.length; i++) {
      if (siblings[i] && siblings[i].parentNode) {
        siblings[i].remove();
      }
    }

    // Dọn sạch pitch, chord, stem, beam, notations, lyric, dot, accidental, tie
    anchorNode.querySelectorAll('pitch, chord, stem, beam, notations, lyric, dot, accidental, tie, tied').forEach(el => el.remove());

    if (!anchorNode.querySelector('rest')) {
      const newRest = _xmlDoc.createElement('rest');
      const durEl = anchorNode.querySelector('duration');
      if (durEl) anchorNode.insertBefore(newRest, durEl);
      else anchorNode.insertBefore(newRest, anchorNode.firstChild);
    }

    showToast('𝄽 Đã chuyển thành dấu lặng (bảo toàn phách)', 'info', 1200);
    await _renderOsmdFromXmlDoc();
  }

  // Phân rã nốt thành các dấu lặng nhỏ để thêm nốt vào (Subdivide to Rests)
  async function subdivideNoteToRests(factor = 2) {
    const curNote = _selectedPosition.activeVoiceMap[_selectedPosition.voice];
    if (!curNote || !curNote.xmlNode) {
      showToast('Hãy chọn vị trí nốt để phân rã!', 'error');
      return;
    }

    const curEl = curNote.xmlNode;
    const oldDuration = curNote.duration;
    if (oldDuration < factor) {
      showToast('Nốt này quá ngắn, không thể chia nhỏ hơn!', 'warn');
      return;
    }

    _saveSnapshotForUndo();
    const measureEl = curEl.closest('measure');
    const divisionsEl = measureEl?.querySelector('attributes > divisions');
    const divisions = divisionsEl ? (parseInt(divisionsEl.textContent, 10) || 4) : 4;

    const subDuration = Math.max(1, Math.floor(oldDuration / factor));
    const subType = _durationToType(subDuration, divisions);

    // Xác định anchor node nếu nốt hiện tại là một phần của hợp âm
    const siblings = curNote._chordSiblings || [curEl];
    const anchorNode = siblings[0] || curEl;
    const voiceText = anchorNode.querySelector('voice')?.textContent || '1';
    const staffText = anchorNode.querySelector('staff')?.textContent || '1';

    // Xóa tất cả các nốt phụ trong hợp âm (trừ anchorNode)
    for (let i = 1; i < siblings.length; i++) {
      if (siblings[i] && siblings[i].parentNode) {
        siblings[i].remove();
      }
    }

    // Biến anchorNode thành dấu lặng thứ nhất (dọn sạch pitch, chord, stem, v.v.)
    anchorNode.querySelectorAll('pitch, chord, stem, beam, notations, lyric, dot, accidental, tie, tied').forEach(el => el.remove());
    if (!anchorNode.querySelector('rest')) {
      const restEl = _xmlDoc.createElement('rest');
      const durEl = anchorNode.querySelector('duration');
      if (durEl) anchorNode.insertBefore(restEl, durEl);
      else anchorNode.insertBefore(restEl, anchorNode.firstChild);
    }

    let durEl = anchorNode.querySelector('duration');
    if (!durEl) {
      durEl = _xmlDoc.createElement('duration');
      anchorNode.appendChild(durEl);
    }
    durEl.textContent = String(subDuration);

    let typeEl = anchorNode.querySelector('type');
    if (!typeEl) {
      typeEl = _xmlDoc.createElement('type');
      anchorNode.appendChild(typeEl);
    }
    typeEl.textContent = subType;

    // Tạo thêm factor - 1 dấu lặng tuần tự ngay sau anchorNode
    let prevNode = anchorNode;
    for (let i = 1; i < factor; i++) {
      const newRestNote = _xmlDoc.createElement('note');
      newRestNote.appendChild(_xmlDoc.createElement('rest'));

      const newDurEl = _xmlDoc.createElement('duration');
      newDurEl.textContent = String(subDuration);
      newRestNote.appendChild(newDurEl);

      const newVoiceEl = _xmlDoc.createElement('voice');
      newVoiceEl.textContent = voiceText;
      newRestNote.appendChild(newVoiceEl);

      const newTypeEl = _xmlDoc.createElement('type');
      newTypeEl.textContent = subType;
      newRestNote.appendChild(newTypeEl);

      const newStaffEl = _xmlDoc.createElement('staff');
      newStaffEl.textContent = staffText;
      newRestNote.appendChild(newStaffEl);

      prevNode.parentNode.insertBefore(newRestNote, prevNode.nextSibling);
      prevNode = newRestNote;
    }

    showToast(`✨ Đã phân rã thành ${factor} dấu lặng! Bấm phím đàn hoặc C-B để điền nốt vào`, 'success', 2500);
    await _renderOsmdFromXmlDoc();
  }

  // Gộp dấu lặng hiện tại với dấu lặng liền sau (Merge adjacent rests)
  async function mergeWithNextRest() {
    const curNote = _selectedPosition.activeVoiceMap[_selectedPosition.voice];
    if (!curNote || !curNote.xmlNode) return;

    if (!curNote.isRest) {
      showToast('Hãy chọn 1 dấu lặng để gộp với dấu lặng tiếp theo!', 'warn');
      return;
    }

    const curEl = curNote.xmlNode;
    const curVoice = curEl.querySelector('voice')?.textContent || '1';

    // Tìm nốt kế tiếp trong cùng bè
    let nextNode = curEl.nextElementSibling;
    while (nextNode) {
      if (nextNode.nodeName === 'note') {
        const nv = nextNode.querySelector('voice')?.textContent || '1';
        if (nv === curVoice) break;
      }
      nextNode = nextNode.nextElementSibling;
    }

    if (!nextNode || nextNode.nodeName !== 'note' || !nextNode.querySelector('rest')) {
      showToast('Không tìm thấy dấu lặng liền sau trong cùng bè để gộp!', 'warn');
      return;
    }

    _saveSnapshotForUndo();
    const divisionsEl = curEl.closest('measure')?.querySelector('attributes > divisions');
    const divisions = divisionsEl ? (parseInt(divisionsEl.textContent, 10) || 4) : 4;

    const dur1 = parseInt(curEl.querySelector('duration')?.textContent, 10) || 0;
    const dur2 = parseInt(nextNode.querySelector('duration')?.textContent, 10) || 0;
    const combinedDur = dur1 + dur2;
    const combinedType = _durationToType(combinedDur, divisions);

    curEl.querySelector('duration').textContent = String(combinedDur);
    let typeEl = curEl.querySelector('type');
    if (!typeEl) {
      typeEl = _xmlDoc.createElement('type');
      curEl.appendChild(typeEl);
    }
    typeEl.textContent = combinedType;

    nextNode.remove();

    showToast('𝄾+𝄾 Đã gộp 2 dấu lặng thành công (bảo toàn phách)', 'success', 1500);
    await _renderOsmdFromXmlDoc();
  }

  // Tách phách (Split Note): Chia đôi nốt để thêm nốt mới mà không phá vỡ ô nhịp
  async function splitCurrentNote() {
    const curNote = _selectedPosition.activeVoiceMap[_selectedPosition.voice];
    if (!curNote || !curNote.xmlNode) return;

    _saveSnapshotForUndo();
    const noteEl = curNote.xmlNode;
    const oldDuration = curNote.duration;
    if (oldDuration <= 1) {
      showToast('Nốt này quá ngắn, không thể tách đôi!', 'warn');
      return;
    }

    const divisionsEl = noteEl.closest('measure')?.querySelector('attributes > divisions');
    const divisions = divisionsEl ? (parseInt(divisionsEl.textContent, 10) || 4) : 4;

    const halfDur = Math.floor(oldDuration / 2);
    const halfType = _durationToType(halfDur, divisions);

    const durEl = noteEl.querySelector('duration');
    if (durEl) durEl.textContent = String(halfDur);
    let typeEl = noteEl.querySelector('type');
    if (typeEl) typeEl.textContent = halfType;

    // Tạo nốt thứ 2 nhân bản nối tiếp
    const cloneEl = noteEl.cloneNode(true);
    const cloneDurEl = cloneEl.querySelector('duration');
    if (cloneDurEl) cloneDurEl.textContent = String(halfDur);
    const cloneTypeEl = cloneEl.querySelector('type');
    if (cloneTypeEl) cloneTypeEl.textContent = halfType;

    // Chèn clone ngay sau note gốc
    noteEl.parentNode.insertBefore(cloneEl, noteEl.nextSibling);

    showToast('✂️ Đã tách đôi nốt thành công (bảo toàn phách)', 'success', 1500);
    await _renderOsmdFromXmlDoc();
  }

  // Bật/Tắt Dấu nối (Tie)
  function toggleTie() {
    const curNote = _selectedPosition.activeVoiceMap[_selectedPosition.voice];
    if (!curNote || !curNote.xmlNode) return;
    _saveSnapshotForUndo();
    const noteEl = curNote.xmlNode;
    let notEl = noteEl.querySelector('notations');
    if (!notEl) {
      notEl = _xmlDoc.createElement('notations');
      noteEl.appendChild(notEl);
    }
    const tiedEl = notEl.querySelector('tied');
    if (tiedEl) {
      tiedEl.remove();
    } else {
      const t = _xmlDoc.createElement('tied');
      t.setAttribute('type', 'start');
      notEl.appendChild(t);
    }
    _renderOsmdFromXmlDoc();
  }

  // Sửa Lời ca (Lyric) với hỗ trợ nhảy nốt thông minh
  function applyLyricText(text, autoAdvance = false) {
    const curNote = _selectedPosition.activeVoiceMap[_selectedPosition.voice];
    if (!curNote || !curNote.xmlNode) return;

    _saveSnapshotForUndo();
    const noteEl = curNote.xmlNode;
    let lyricEl = noteEl.querySelector('lyric');

    // Nếu nốt này không có lyric, kiểm tra xem nốt khác trong chord có lyric không để sửa đồng bộ
    if (!lyricEl && curNote._chordSiblings) {
      for (const sib of curNote._chordSiblings) {
        const sibLyric = sib.querySelector('lyric');
        if (sibLyric) {
          lyricEl = sibLyric;
          break;
        }
      }
    }

    if (!text || !text.trim()) {
      if (lyricEl) lyricEl.remove();
    } else {
      if (!lyricEl) {
        lyricEl = _xmlDoc.createElement('lyric');
        noteEl.appendChild(lyricEl);
      }
      let txtEl = lyricEl.querySelector('text');
      if (!txtEl) {
        txtEl = _xmlDoc.createElement('text');
        lyricEl.appendChild(txtEl);
      }
      txtEl.textContent = text.trim();
    }

    _renderOsmdFromXmlDoc();

    if (autoAdvance) {
      _selectedPosition.beatIndex++;
      _refreshInspectorUI();
      const nextInput = document.getElementById('input-note-lyric');
      if (nextInput) {
        nextInput.value = '';
        nextInput.focus();
      }
    }
  }

  // Bật / Tắt Dấu Luyến (Slur)
  function toggleSlur() {
    const curNote = _selectedPosition.activeVoiceMap[_selectedPosition.voice];
    if (!curNote || !curNote.xmlNode) return;
    _saveSnapshotForUndo();
    const noteEl = curNote.xmlNode;
    let notEl = noteEl.querySelector('notations');
    if (!notEl) {
      notEl = _xmlDoc.createElement('notations');
      noteEl.appendChild(notEl);
    }
    const slurEl = notEl.querySelector('slur');
    if (slurEl) {
      slurEl.remove();
      showToast('Đã bỏ dấu luyến', 'info', 1000);
    } else {
      const s = _xmlDoc.createElement('slur');
      s.setAttribute('type', 'start');
      notEl.appendChild(s);
      showToast('⌒ Đã thêm dấu luyến', 'info', 1000);
    }
    _renderOsmdFromXmlDoc();
  }

  // Bật / Tắt Dấu Mắt Ngỗng (Fermata)
  function toggleFermata() {
    const curNote = _selectedPosition.activeVoiceMap[_selectedPosition.voice];
    if (!curNote || !curNote.xmlNode) return;
    _saveSnapshotForUndo();
    const noteEl = curNote.xmlNode;
    let notEl = noteEl.querySelector('notations');
    if (!notEl) {
      notEl = _xmlDoc.createElement('notations');
      noteEl.appendChild(notEl);
    }
    const fermataEl = notEl.querySelector('fermata');
    if (fermataEl) {
      fermataEl.remove();
      showToast('Đã bỏ dấu mắt ngỗng', 'info', 1000);
    } else {
      const f = _xmlDoc.createElement('fermata');
      f.setAttribute('type', 'upright');
      notEl.appendChild(f);
      showToast('𝄐 Đã gắn dấu mắt ngỗng', 'info', 1000);
    }
    _renderOsmdFromXmlDoc();
  }

  // Bật / Tắt Liên ba (Tuplet)
  function toggleTuplet() {
    const curNote = _selectedPosition.activeVoiceMap[_selectedPosition.voice];
    if (!curNote || !curNote.xmlNode) return;
    _saveSnapshotForUndo();
    const noteEl = curNote.xmlNode;
    let notEl = noteEl.querySelector('notations');
    if (!notEl) {
      notEl = _xmlDoc.createElement('notations');
      noteEl.appendChild(notEl);
    }
    const tupletEl = notEl.querySelector('tuplet');
    if (tupletEl) {
      tupletEl.remove();
      const timeMod = noteEl.querySelector('time-modification');
      if (timeMod) timeMod.remove();
      showToast('Đã hủy liên 3', 'info', 1000);
    } else {
      const t = _xmlDoc.createElement('tuplet');
      t.setAttribute('type', 'start');
      notEl.appendChild(t);
      let tm = noteEl.querySelector('time-modification');
      if (!tm) {
        tm = _xmlDoc.createElement('time-modification');
        const an = _xmlDoc.createElement('actual-notes'); an.textContent = '3';
        const nn = _xmlDoc.createElement('normal-notes'); nn.textContent = '2';
        tm.appendChild(an);
        tm.appendChild(nn);
        noteEl.appendChild(tm);
      }
      showToast('³ Đã đặt liên 3 (3 nốt gom 2 phách)', 'info', 1000);
    }
    _renderOsmdFromXmlDoc();
  }

  // Bật / Tắt Dấu Ngắt (Staccato)
  function toggleStaccato() {
    const curNote = _selectedPosition.activeVoiceMap[_selectedPosition.voice];
    if (!curNote || !curNote.xmlNode) return;
    _saveSnapshotForUndo();
    const noteEl = curNote.xmlNode;
    let notEl = noteEl.querySelector('notations');
    if (!notEl) {
      notEl = _xmlDoc.createElement('notations');
      noteEl.appendChild(notEl);
    }
    let artEl = notEl.querySelector('articulations');
    if (!artEl) {
      artEl = _xmlDoc.createElement('articulations');
      notEl.appendChild(artEl);
    }
    const staccatoEl = artEl.querySelector('staccato');
    if (staccatoEl) {
      staccatoEl.remove();
      if (!artEl.children.length) artEl.remove();
      showToast('Đã bỏ dấu ngắt (staccato)', 'info', 1000);
    } else {
      const s = _xmlDoc.createElement('staccato');
      artEl.appendChild(s);
      showToast('• Đã gắn dấu ngắt (staccato)', 'info', 1000);
    }
    _renderOsmdFromXmlDoc();
  }

  // Bật / Tắt Dấu Nhấn (Accent)
  function toggleAccent() {
    const curNote = _selectedPosition.activeVoiceMap[_selectedPosition.voice];
    if (!curNote || !curNote.xmlNode) return;
    _saveSnapshotForUndo();
    const noteEl = curNote.xmlNode;
    let notEl = noteEl.querySelector('notations');
    if (!notEl) {
      notEl = _xmlDoc.createElement('notations');
      noteEl.appendChild(notEl);
    }
    let artEl = notEl.querySelector('articulations');
    if (!artEl) {
      artEl = _xmlDoc.createElement('articulations');
      notEl.appendChild(artEl);
    }
    const accentEl = artEl.querySelector('accent');
    if (accentEl) {
      accentEl.remove();
      if (!artEl.children.length) artEl.remove();
      showToast('Đã bỏ dấu nhấn (accent)', 'info', 1000);
    } else {
      const a = _xmlDoc.createElement('accent');
      artEl.appendChild(a);
      showToast('> Đã gắn dấu nhấn (accent)', 'info', 1000);
    }
    _renderOsmdFromXmlDoc();
  }

  // Bật / Tắt Dấu Ngân Đủ (Tenuto)
  function toggleTenuto() {
    const curNote = _selectedPosition.activeVoiceMap[_selectedPosition.voice];
    if (!curNote || !curNote.xmlNode) return;
    _saveSnapshotForUndo();
    const noteEl = curNote.xmlNode;
    let notEl = noteEl.querySelector('notations');
    if (!notEl) {
      notEl = _xmlDoc.createElement('notations');
      noteEl.appendChild(notEl);
    }
    let artEl = notEl.querySelector('articulations');
    if (!artEl) {
      artEl = _xmlDoc.createElement('articulations');
      notEl.appendChild(artEl);
    }
    const tenutoEl = artEl.querySelector('tenuto');
    if (tenutoEl) {
      tenutoEl.remove();
      if (!artEl.children.length) artEl.remove();
      showToast('Đã bỏ dấu ngân đủ (tenuto)', 'info', 1000);
    } else {
      const t = _xmlDoc.createElement('tenuto');
      artEl.appendChild(t);
      showToast('— Đã gắn dấu ngân đủ (tenuto)', 'info', 1000);
    }
    _renderOsmdFromXmlDoc();
  }

  // Thêm Nốt Mới Ngay Sau Nốt Hiện Tại (Tự do, không cản trở)
  async function insertNoteAfter(durType = null) {
    const curNote = _selectedPosition.activeVoiceMap[_selectedPosition.voice];
    if (!curNote || !curNote.xmlNode) {
      showToast('Hãy chọn vị trí nốt để chèn nốt sau!', 'error');
      return;
    }

    _saveSnapshotForUndo();
    const curEl = curNote.xmlNode;
    const measureEl = curEl.closest('measure');
    const divisions = _getDivisionsForMeasure(measureEl);

    const chosenType = durType || document.querySelector('.btn-dur-card.active')?.dataset?.dur || 'quarter';
    const multMap = { whole: 4, half: 2, quarter: 1, eighth: 0.5, '16th': 0.25 };
    const mult = multMap[chosenType] || 1;
    const targetDuration = Math.max(1, Math.round(divisions * mult));

    const defaultVoicePitch = {
      soprano: { step: 'G', octave: 4 },
      alto:    { step: 'E', octave: 4 },
      tenor:   { step: 'C', octave: 3 },
      bass:    { step: 'G', octave: 2 }
    };
    const defaultP = defaultVoicePitch[_selectedPosition.voice] || { step: 'C', octave: 4 };
    const step = curNote.isRest ? defaultP.step : curNote.step;
    const oct  = curNote.isRest ? defaultP.octave : curNote.octave;
    const alt  = curNote.isRest ? 0 : curNote.alter;

    const newNote = _xmlDoc.createElement('note');

    const pitchEl = _xmlDoc.createElement('pitch');
    const stepEl  = _xmlDoc.createElement('step');
    stepEl.textContent = step;
    const octEl   = _xmlDoc.createElement('octave');
    octEl.textContent = String(oct);
    pitchEl.appendChild(stepEl);
    pitchEl.appendChild(octEl);
    if (alt !== 0) {
      const altEl = _xmlDoc.createElement('alter');
      altEl.textContent = String(alt);
      pitchEl.appendChild(altEl);
    }
    newNote.appendChild(pitchEl);

    const durEl = _xmlDoc.createElement('duration');
    durEl.textContent = String(targetDuration);
    newNote.appendChild(durEl);

    const curVoiceEl = curEl.querySelector('voice');
    if (curVoiceEl) {
      const voiceEl = _xmlDoc.createElement('voice');
      voiceEl.textContent = curVoiceEl.textContent;
      newNote.appendChild(voiceEl);
    }

    const typeEl = _xmlDoc.createElement('type');
    typeEl.textContent = chosenType;
    newNote.appendChild(typeEl);

    const curStaffEl = curEl.querySelector('staff');
    if (curStaffEl) {
      const staffEl = _xmlDoc.createElement('staff');
      staffEl.textContent = curStaffEl.textContent;
      newNote.appendChild(staffEl);
    }

    // Bỏ qua các nốt chord liên kết để chèn nốt sau trọn vẹn hợp âm
    let insertAfterNode = curEl;
    let nextSib = curEl.nextElementSibling;
    while (nextSib && nextSib.tagName === 'note' && nextSib.querySelector('chord')) {
      insertAfterNode = nextSib;
      nextSib = nextSib.nextElementSibling;
    }

    insertAfterNode.parentNode.insertBefore(newNote, insertAfterNode.nextSibling);

    showToast('✨ Đã thêm nốt mới thành công!', 'success', 1200);
    playSinglePitch(step, oct, alt, 0.3);
    _selectedPosition.beatIndex++;
    await _renderOsmdFromXmlDoc();
  }

  // Thêm Nốt Mới Ngay Trước Nốt Hiện Tại
  async function insertNoteBefore(durType = null) {
    const curNote = _selectedPosition.activeVoiceMap[_selectedPosition.voice];
    if (!curNote || !curNote.xmlNode) {
      showToast('Hãy chọn vị trí nốt để chèn nốt trước!', 'error');
      return;
    }

    _saveSnapshotForUndo();
    const curEl = curNote.xmlNode;
    const measureEl = curEl.closest('measure');
    const divisions = _getDivisionsForMeasure(measureEl);

    const chosenType = durType || document.querySelector('.btn-dur-card.active')?.dataset?.dur || 'quarter';
    const multMap = { whole: 4, half: 2, quarter: 1, eighth: 0.5, '16th': 0.25 };
    const mult = multMap[chosenType] || 1;
    const targetDuration = Math.max(1, Math.round(divisions * mult));

    const defaultVoicePitch = {
      soprano: { step: 'G', octave: 4 },
      alto:    { step: 'E', octave: 4 },
      tenor:   { step: 'C', octave: 3 },
      bass:    { step: 'G', octave: 2 }
    };
    const defaultP = defaultVoicePitch[_selectedPosition.voice] || { step: 'C', octave: 4 };
    const step = curNote.isRest ? defaultP.step : curNote.step;
    const oct  = curNote.isRest ? defaultP.octave : curNote.octave;
    const alt  = curNote.isRest ? 0 : curNote.alter;

    const newNote = _xmlDoc.createElement('note');

    const pitchEl = _xmlDoc.createElement('pitch');
    const stepEl  = _xmlDoc.createElement('step');
    stepEl.textContent = step;
    const octEl   = _xmlDoc.createElement('octave');
    octEl.textContent = String(oct);
    pitchEl.appendChild(stepEl);
    pitchEl.appendChild(octEl);
    if (alt !== 0) {
      const altEl = _xmlDoc.createElement('alter');
      altEl.textContent = String(alt);
      pitchEl.appendChild(altEl);
    }
    newNote.appendChild(pitchEl);

    const durEl = _xmlDoc.createElement('duration');
    durEl.textContent = String(targetDuration);
    newNote.appendChild(durEl);

    const curVoiceEl = curEl.querySelector('voice');
    if (curVoiceEl) {
      const voiceEl = _xmlDoc.createElement('voice');
      voiceEl.textContent = curVoiceEl.textContent;
      newNote.appendChild(voiceEl);
    }

    const typeEl = _xmlDoc.createElement('type');
    typeEl.textContent = chosenType;
    newNote.appendChild(typeEl);

    const curStaffEl = curEl.querySelector('staff');
    if (curStaffEl) {
      const staffEl = _xmlDoc.createElement('staff');
      staffEl.textContent = curStaffEl.textContent;
      newNote.appendChild(staffEl);
    }

    curEl.parentNode.insertBefore(newNote, curEl);

    showToast('✨ Đã thêm nốt mới phía trước!', 'success', 1200);
    playSinglePitch(step, oct, alt, 0.3);
    await _renderOsmdFromXmlDoc();
  }

  // Thêm Dấu Lặng Mới Ngay Sau Nốt Hiện Tại
  async function insertRestAfter(durType = null) {
    const curNote = _selectedPosition.activeVoiceMap[_selectedPosition.voice];
    if (!curNote || !curNote.xmlNode) {
      showToast('Hãy chọn vị trí nốt!', 'error');
      return;
    }

    _saveSnapshotForUndo();
    const curEl = curNote.xmlNode;
    const measureEl = curEl.closest('measure');
    const divisions = _getDivisionsForMeasure(measureEl);

    const chosenType = durType || document.querySelector('.btn-dur-card.active')?.dataset?.dur || 'quarter';
    const multMap = { whole: 4, half: 2, quarter: 1, eighth: 0.5, '16th': 0.25 };
    const mult = multMap[chosenType] || 1;
    const targetDuration = Math.max(1, Math.round(divisions * mult));

    const newNote = _xmlDoc.createElement('note');
    const restEl = _xmlDoc.createElement('rest');
    newNote.appendChild(restEl);

    const durEl = _xmlDoc.createElement('duration');
    durEl.textContent = String(targetDuration);
    newNote.appendChild(durEl);

    const curVoiceEl = curEl.querySelector('voice');
    if (curVoiceEl) {
      const voiceEl = _xmlDoc.createElement('voice');
      voiceEl.textContent = curVoiceEl.textContent;
      newNote.appendChild(voiceEl);
    }

    const typeEl = _xmlDoc.createElement('type');
    typeEl.textContent = chosenType;
    newNote.appendChild(typeEl);

    const curStaffEl = curEl.querySelector('staff');
    if (curStaffEl) {
      const staffEl = _xmlDoc.createElement('staff');
      staffEl.textContent = curStaffEl.textContent;
      newNote.appendChild(staffEl);
    }

    let insertAfterNode = curEl;
    let nextSib = curEl.nextElementSibling;
    while (nextSib && nextSib.tagName === 'note' && nextSib.querySelector('chord')) {
      insertAfterNode = nextSib;
      nextSib = nextSib.nextElementSibling;
    }

    insertAfterNode.parentNode.insertBefore(newNote, insertAfterNode.nextSibling);
    showToast('𝄽 Đã thêm dấu lặng mới!', 'info', 1200);
    _selectedPosition.beatIndex++;
    await _renderOsmdFromXmlDoc();
  }

  // Nhân bản nốt hiện tại (Duplicate Note)
  async function duplicateCurrentNote() {
    const curNote = _selectedPosition.activeVoiceMap[_selectedPosition.voice];
    if (!curNote || !curNote.xmlNode) {
      showToast('Hãy chọn nốt để nhân bản!', 'error');
      return;
    }

    _saveSnapshotForUndo();
    const curEl = curNote.xmlNode;
    const cloneEl = curEl.cloneNode(true);

    // Xóa dấu nối cũ khỏi bản clone nếu có
    cloneEl.querySelectorAll('tie, tied').forEach(t => t.remove());

    let insertAfterNode = curEl;
    let nextSib = curEl.nextElementSibling;
    while (nextSib && nextSib.tagName === 'note' && nextSib.querySelector('chord')) {
      insertAfterNode = nextSib;
      nextSib = nextSib.nextElementSibling;
    }

    insertAfterNode.parentNode.insertBefore(cloneEl, insertAfterNode.nextSibling);
    showToast('📋 Đã nhân bản nốt thành công!', 'success', 1200);
    if (!curNote.isRest) {
      playSinglePitch(curNote.step, curNote.octave, curNote.alter, 0.3);
    }
    _selectedPosition.beatIndex++;
    await _renderOsmdFromXmlDoc();
  }

  // Xóa hẳn nốt khỏi cây DOM (Hard Delete)
  async function deleteNoteCompletely() {
    const curNote = _selectedPosition.activeVoiceMap[_selectedPosition.voice];
    if (!curNote || !curNote.xmlNode) {
      showToast('Hãy chọn nốt cần xóa!', 'error');
      return;
    }

    _saveSnapshotForUndo();
    const curEl = curNote.xmlNode;

    // Nếu nốt này là nốt gốc và có nốt chord ngay sau:
    // Chuyển nốt chord tiếp theo thành nốt gốc (xóa thẻ <chord/>) để nốt bè kia không bị mất/lỗi
    if (!curEl.querySelector('chord')) {
      const nextNote = curEl.nextElementSibling;
      if (nextNote && nextNote.tagName === 'note' && nextNote.querySelector('chord')) {
        nextNote.querySelector('chord').remove();
      }
    }

    curEl.remove();

    showToast('🗑 Đã xóa bỏ nốt khỏi ô nhịp', 'info', 1200);
    _selectedPosition.beatIndex = Math.max(0, _selectedPosition.beatIndex - 1);
    await _renderOsmdFromXmlDoc();
  }

  // Thêm 1 ô nhịp sau ô nhịp hiện tại
  function addMeasureAfter() {
    if (!_xmlDoc) return;
    _saveSnapshotForUndo();

    const curMNum = _selectedPosition.measureNumber;
    const parts = _xmlDoc.querySelectorAll('part');

    parts.forEach(part => {
      const allMeasures = Array.from(part.querySelectorAll('measure'));
      const targetM = part.querySelector(`measure[number="${curMNum}"]`) || allMeasures[allMeasures.length - 1];
      if (!targetM) return;

      const newM = _xmlDoc.createElement('measure');
      newM.setAttribute('number', String(curMNum + 1));

      // Lấy divisions hiện tại
      const divEl = _xmlDoc.querySelector('divisions');
      const divisions = divEl ? parseInt(divEl.textContent, 10) : 1;

      // Thêm nốt lặng tròn (4 phách)
      const restNote = _xmlDoc.createElement('note');
      restNote.appendChild(_xmlDoc.createElement('rest'));
      const durEl = _xmlDoc.createElement('duration');
      durEl.textContent = String(divisions * 4);
      restNote.appendChild(durEl);
      const typeEl = _xmlDoc.createElement('type');
      typeEl.textContent = 'whole';
      restNote.appendChild(typeEl);
      newM.appendChild(restNote);

      if (targetM.nextSibling) {
        part.insertBefore(newM, targetM.nextSibling);
      } else {
        part.appendChild(newM);
      }

      // Đánh số lại các ô nhịp sau
      let num = 1;
      part.querySelectorAll('measure').forEach(m => {
        m.setAttribute('number', String(num++));
      });
    });

    _selectedPosition.measureNumber = curMNum + 1;
    _selectedPosition.beatIndex = 0;
    showToast(`+ Đã thêm ô nhịp mới sau ô ${curMNum}!`, 'success', 1500);
    _renderOsmdFromXmlDoc();
  }

  // Xóa ô nhịp hiện tại
  function deleteCurrentMeasure() {
    if (!_xmlDoc) return;
    const curMNum = _selectedPosition.measureNumber;
    const parts = _xmlDoc.querySelectorAll('part');
    const firstPartMeasures = parts[0]?.querySelectorAll('measure');
    if (!firstPartMeasures || firstPartMeasures.length <= 1) {
      showToast('Không thể xóa ô nhịp duy nhất của bản nhạc!', 'warn');
      return;
    }

    if (!confirm(`Bạn có chắc chắn muốn xóa ô nhịp ${curMNum} trên toàn bộ các bè?`)) {
      return;
    }

    _saveSnapshotForUndo();

    parts.forEach(part => {
      const mEl = part.querySelector(`measure[number="${curMNum}"]`);
      if (mEl) mEl.remove();

      let num = 1;
      part.querySelectorAll('measure').forEach(m => {
        m.setAttribute('number', String(num++));
      });
    });

    _selectedPosition.measureNumber = Math.max(1, curMNum - 1);
    _selectedPosition.beatIndex = 0;
    showToast(`- Đã xóa ô nhịp ${curMNum}!`, 'info', 1500);
    _renderOsmdFromXmlDoc();
  }

  // Đổi số chỉ nhịp
  function changeTimeSignature(timeSigStr) {
    if (!timeSigStr || !_xmlDoc) return;
    const [beats, beatType] = timeSigStr.split('/');
    if (!beats || !beatType) return;

    _saveSnapshotForUndo();

    const curMNum = _selectedPosition.measureNumber;
    const parts = _xmlDoc.querySelectorAll('part');

    parts.forEach(part => {
      const mEl = part.querySelector(`measure[number="${curMNum}"]`) || part.querySelector('measure[number="1"]');
      if (!mEl) return;

      let attrEl = mEl.querySelector('attributes');
      if (!attrEl) {
        attrEl = _xmlDoc.createElement('attributes');
        mEl.insertBefore(attrEl, mEl.firstChild);
      }

      let timeEl = attrEl.querySelector('time');
      if (!timeEl) {
        timeEl = _xmlDoc.createElement('time');
        attrEl.appendChild(timeEl);
      }

      let beatsEl = timeEl.querySelector('beats');
      if (!beatsEl) {
        beatsEl = _xmlDoc.createElement('beats');
        timeEl.appendChild(beatsEl);
      }
      beatsEl.textContent = beats;

      let typeEl = timeEl.querySelector('beat-type');
      if (!typeEl) {
        typeEl = _xmlDoc.createElement('beat-type');
        timeEl.appendChild(typeEl);
      }
      typeEl.textContent = beatType;
    });

    showToast(`Đã đổi số chỉ nhịp ô ${curMNum} thành ${timeSigStr}`, 'success', 1500);
    _renderOsmdFromXmlDoc();
  }

  /* ─── HỆ THỐNG KIỂM TRA & CẢNH BÁO ĐỦ Ô NHỊP (REALTIME BEAT VALIDATOR) ─ */
  function validateAllMeasures() {
    if (!_xmlDoc) return;
    _measureHealth = {};

    const parts = _xmlDoc.querySelectorAll('part');
    const part1 = _xmlDoc.querySelector('part#P1') || parts[0];
    if (!part1) return;

    const measures = part1.querySelectorAll('measure');
    let underflowCount = 0;
    let overflowCount = 0;

    let currentDivisions = 2;
    let currentBeats = 4;
    let currentBeatType = 4;

    // Kiểm tra xem bài có nhịp lấy đà (pickup) ở ô đầu không
    let pickupDiv = 0;
    if (measures.length > 2) {
      const m0 = measures[0];
      let m0Div = 0;
      m0.querySelectorAll('note').forEach(n => {
        if (!n.querySelector('chord') && (n.querySelector('voice')?.textContent || '1') === '1') {
          m0Div += parseInt(n.querySelector('duration')?.textContent || 0, 10);
        }
      });
      const beats0 = parseInt(m0.querySelector('attributes > time > beats')?.textContent || currentBeats, 10);
      const bType0 = parseInt(m0.querySelector('attributes > time > beat-type')?.textContent || currentBeatType, 10);
      const div0 = parseInt(m0.querySelector('attributes > divisions')?.textContent || currentDivisions, 10);
      const target0 = Math.round(beats0 * (4 / bType0) * div0);
      if (m0Div < target0) {
        pickupDiv = m0Div;
      }
    }

    measures.forEach((mEl, mIdx) => {
      const mNum = parseInt(mEl.getAttribute('number') || (mIdx + 1), 10);

      // Đọc time & divisions nếu ô nhịp có khai báo attributes
      const divEl = mEl.querySelector('attributes > divisions');
      if (divEl) {
        const dVal = parseInt(divEl.textContent.trim(), 10);
        if (dVal > 0) currentDivisions = dVal;
      }

      const beatsEl = mEl.querySelector('attributes > time > beats');
      const bTypeEl = mEl.querySelector('attributes > time > beat-type');
      if (beatsEl && bTypeEl) {
        currentBeats = parseInt(beatsEl.textContent.trim(), 10) || currentBeats;
        currentBeatType = parseInt(bTypeEl.textContent.trim(), 10) || currentBeatType;
      }

      const targetDivisions = Math.round(currentBeats * (4 / currentBeatType) * currentDivisions);

      // Tính tổng duration của Voice 1 (bỏ qua chord notes vì chord cùng phách với nốt chính)
      let totalDiv = 0;
      mEl.querySelectorAll('note').forEach(n => {
        if (!n.querySelector('chord')) {
          const v = n.querySelector('voice')?.textContent || '1';
          if (v === '1') {
            const d = parseInt(n.querySelector('duration')?.textContent || 0, 10);
            totalDiv += d;
          }
        }
      });

      let status = 'ok';
      let missing = 0;
      let excess = 0;

      // Nhịp lấy đà (pickup measure) ở ô đầu tiên & ô cuối bù lấy đà
      const isPickup = (mIdx === 0 && totalDiv < targetDivisions && measures.length > 2);
      const isFinalPickupComplement = (mIdx === measures.length - 1 && pickupDiv > 0 && totalDiv + pickupDiv === targetDivisions);

      if (isPickup) {
        status = 'pickup';
      } else if (isFinalPickupComplement) {
        status = 'pickup-final';
      } else if (totalDiv < targetDivisions) {
        status = 'underflow';
        missing = targetDivisions - totalDiv;
        underflowCount++;
      } else if (totalDiv > targetDivisions) {
        status = 'overflow';
        excess = totalDiv - targetDivisions;
        overflowCount++;
      }

      _measureHealth[mNum] = {
        measureNum: mNum,
        status: status,
        target: targetDivisions,
        total: totalDiv,
        missing: missing,
        excess: excess,
        missingBeats: missing > 0 ? (missing / currentDivisions).toFixed(1).replace('.0', '') : 0,
        excessBeats: excess > 0 ? (excess / currentDivisions).toFixed(1).replace('.0', '') : 0,
        divisions: currentDivisions
      };
    });

    _renderMeasureHealthBar(underflowCount, overflowCount);
    _applyMeasureSvgHighlights();
    _updateRealtimeMeasureUI();
  }

  function _renderMeasureHealthBar(underflowCount, overflowCount) {
    const summaryBadge = document.getElementById('health-summary-badge');
    const autoFixBtn   = document.getElementById('btn-auto-fix-all-rests');
    const stripPills   = document.getElementById('measure-strip-pills');
    if (!summaryBadge || !stripPills) return;

    const totalIssues = underflowCount + overflowCount;
    if (totalIssues === 0) {
      summaryBadge.textContent = '100% Ô nhịp đủ phách';
      summaryBadge.className = 'badge-health-ok';
      if (autoFixBtn) autoFixBtn.classList.add('hidden');
    } else {
      summaryBadge.textContent = `⚠️ Có ${totalIssues} ô nhịp chưa chuẩn (${underflowCount} thiếu, ${overflowCount} thừa)`;
      summaryBadge.className = 'badge-health-warn';
      if (autoFixBtn) autoFixBtn.classList.toggle('hidden', underflowCount === 0);
    }

    stripPills.innerHTML = '';
    Object.values(_measureHealth).forEach(m => {
      const pill = document.createElement('div');
      pill.className = `measure-pill ${m.status}`;
      if (m.measureNum === _selectedPosition.measureNumber) pill.classList.add('active');
      pill.textContent = m.measureNum;
      pill.title = `Ô nhịp ${m.measureNum}: ` + (m.status === 'ok' ? 'Đủ phách' : (m.status === 'underflow' ? `Thiếu ${m.missingBeats} phách` : `Thừa ${m.excessBeats} phách`));

      pill.onclick = () => {
        _selectedPosition.measureNumber = m.measureNum;
        _selectedPosition.beatIndex = 0;
        _refreshInspectorUI();
        _highlightActiveMeasurePill(m.measureNum);
      };
      stripPills.appendChild(pill);
    });
  }

  function _highlightActiveMeasurePill(mNum) {
    document.querySelectorAll('.measure-pill').forEach(p => {
      p.classList.toggle('active', p.textContent === String(mNum));
    });
  }

  // Tô viền các ô nhịp cảnh báo (BÁO ĐỎ) trực tiếp trên SVG bằng tọa độ chính xác từ OSMD
  function _applyMeasureSvgHighlights() {
    const container = document.getElementById('osmd-editor-container');
    if (!container || !_osmd || !_osmd.GraphicSheet) return;

    const svg = container.querySelector('svg');
    if (!svg) return;

    // Xóa tất cả các khung highlight cũ
    svg.querySelectorAll('.measure-highlight-rect').forEach(r => r.remove());

    const ml = _osmd.GraphicSheet.MeasureList;
    if (!ml || !ml.length) return;

    Object.values(_measureHealth).forEach(m => {
      // Tìm index của ô nhịp trong GraphicSheet
      let targetStaves = null;
      for (let i = 0; i < ml.length; i++) {
        const staves = ml[i];
        if (staves && staves[0]) {
          const s0 = staves[0];
          const mNum = parseInt(s0.parentSourceMeasure?.MeasureNumberXML ?? s0.MeasureNumber, 10);
          if (mNum === m.measureNum) {
            targetStaves = staves;
            break;
          }
        }
      }

      if (!targetStaves || !targetStaves.length) return;

      const s0 = targetStaves[0];
      const sLast = targetStaves[targetStaves.length - 1];
      if (!s0 || !s0.PositionAndShape) return;

      const x = s0.PositionAndShape.AbsolutePosition.x * 10;
      const y = (s0.PositionAndShape.AbsolutePosition.y - 2) * 10;
      const w = s0.PositionAndShape.Size.width * 10;
      const sLastH = (sLast.PositionAndShape?.Size?.height || 4);
      const bottomY = (sLast.PositionAndShape.AbsolutePosition.y + sLastH + 3) * 10;
      const h = Math.max(50, bottomY - y);

      const isError = (m.status === 'underflow' || m.status === 'overflow');
      const isActive = (m.measureNum === _selectedPosition.measureNumber);

      if (isError) {
        // BÁO ĐỎ: Viền đỏ đứt nét và nền phớt đỏ cảnh báo sai nhịp
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('class', 'measure-highlight-rect measure-highlight-error');
        rect.setAttribute('x', String(x));
        rect.setAttribute('y', String(y));
        rect.setAttribute('width', String(w));
        rect.setAttribute('height', String(h));
        rect.setAttribute('rx', '6');
        rect.setAttribute('data-measure', String(m.measureNum));
        svg.prepend(rect);
      } else if (isActive) {
        // Viền xanh nhẹ nhàng chỉ định ô nhịp đang thao tác
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('class', 'measure-highlight-rect measure-highlight-active');
        rect.setAttribute('x', String(x));
        rect.setAttribute('y', String(y));
        rect.setAttribute('width', String(w));
        rect.setAttribute('height', String(h));
        rect.setAttribute('rx', '6');
        rect.setAttribute('data-measure', String(m.measureNum));
        svg.prepend(rect);
      }
    });
  }

  // Đồng bộ trạng thái BÁO ĐỎ / BÁO XANH trên QuickBar, Thước đo phách Inspector và Nút Lưu
  function _updateRealtimeMeasureUI() {
    const curMNum = _selectedPosition.measureNumber;
    const h = _measureHealth[curMNum];

    const quickbar = document.getElementById('smart-note-quickbar');
    const qStatusText = document.getElementById('quickbar-status-text');
    const qAutofillBtn = document.getElementById('quick-btn-autofill');

    const beatCard = document.getElementById('inspector-beat-card');
    const bIcon = document.getElementById('inspector-beat-icon');
    const bTitle = document.getElementById('inspector-meter-title');
    const bCounts = document.getElementById('inspector-meter-counts');
    const bBar = document.getElementById('inspector-meter-bar');
    const bHint = document.getElementById('inspector-meter-hint');
    const bAutofillBtn = document.getElementById('btn-inspector-autofill');

    // Nút Lưu trên header
    const saveBtn = document.getElementById('btn-open-save-modal');
    let totalErrors = 0;
    Object.values(_measureHealth).forEach(m => {
      if (m.status === 'underflow' || m.status === 'overflow') totalErrors++;
    });

    if (saveBtn) {
      if (totalErrors > 0) {
        saveBtn.classList.add('btn-save-has-warning');
        saveBtn.innerHTML = `<span>⚠️ LƯU BẢN SỬA (${totalErrors} ô lỗi)</span>`;
      } else {
        saveBtn.classList.remove('btn-save-has-warning');
        saveBtn.innerHTML = `<span>✓ LƯU BẢN SỬA</span>`;
      }
    }

    if (!h) {
      if (quickbar) {
        quickbar.classList.add('status-ok');
        quickbar.classList.remove('status-warning');
      }
      if (qAutofillBtn) qAutofillBtn.classList.add('hidden');
      if (bAutofillBtn) bAutofillBtn.classList.add('hidden');
      return;
    }

    const curDiv = h.divisions || 2;
    const targetBeats = (h.target / curDiv).toFixed(1).replace('.0', '');
    const currentBeats = (h.total / curDiv).toFixed(1).replace('.0', '');

    if (h.status === 'underflow') {
      // BÁO ĐỎ: THIẾU PHÁCH
      if (quickbar) {
        quickbar.classList.remove('status-ok');
        quickbar.classList.add('status-warning');
      }
      if (qStatusText) {
        qStatusText.textContent = `⛔ Ô nhịp ${curMNum}: Thiếu ${h.missingBeats} phách (${currentBeats}/${targetBeats} phách)`;
      }
      if (qAutofillBtn) qAutofillBtn.classList.remove('hidden');

      if (beatCard) {
        beatCard.classList.remove('status-ok');
        beatCard.classList.add('status-warning');
      }
      if (bIcon) bIcon.textContent = '⛔';
      if (bTitle) bTitle.textContent = `Ô NHỊP ${curMNum}: THIẾU ${h.missingBeats} PHÁCH`;
      if (bCounts) bCounts.textContent = `${currentBeats} / ${targetBeats} phách`;
      if (bBar) {
        const pct = Math.min(100, Math.max(10, Math.round((h.total / h.target) * 100)));
        bBar.style.width = `${pct}%`;
      }
      if (bHint) bHint.textContent = `⚠️ Thiếu ${h.missingBeats} phách. Bấm bù tự động hoặc thêm nốt.`;
      if (bAutofillBtn) bAutofillBtn.classList.remove('hidden');

    } else if (h.status === 'overflow') {
      // BÁO ĐỎ: THỪA PHÁCH
      if (quickbar) {
        quickbar.classList.remove('status-ok');
        quickbar.classList.add('status-warning');
      }
      if (qStatusText) {
        qStatusText.textContent = `⛔ Ô nhịp ${curMNum}: Thừa ${h.excessBeats} phách (${currentBeats}/${targetBeats} phách)`;
      }
      if (qAutofillBtn) qAutofillBtn.classList.add('hidden');

      if (beatCard) {
        beatCard.classList.remove('status-ok');
        beatCard.classList.add('status-warning');
      }
      if (bIcon) bIcon.textContent = '⛔';
      if (bTitle) bTitle.textContent = `Ô NHỊP ${curMNum}: THỪA ${h.excessBeats} PHÁCH`;
      if (bCounts) bCounts.textContent = `${currentBeats} / ${targetBeats} phách`;
      if (bBar) bBar.style.width = '100%';
      if (bHint) bHint.textContent = `⚠️ Thừa ${h.excessBeats} phách. Hãy xóa bớt hoặc giảm trường độ.`;
      if (bAutofillBtn) bAutofillBtn.classList.add('hidden');

    } else if (h.status === 'pickup') {
      // NHỊP LẤY ĐÀ
      if (quickbar) {
        quickbar.classList.add('status-ok');
        quickbar.classList.remove('status-warning');
      }
      if (qStatusText) {
        qStatusText.textContent = `✓ Ô nhịp ${curMNum}: Nhịp lấy đà (${currentBeats} phách)`;
      }
      if (qAutofillBtn) qAutofillBtn.classList.add('hidden');

      if (beatCard) {
        beatCard.classList.add('status-ok');
        beatCard.classList.remove('status-warning');
      }
      if (bIcon) bIcon.textContent = '✓';
      if (bTitle) bTitle.textContent = `Ô NHỊP ${curMNum}: NHỊP LẤY ĐÀ`;
      if (bCounts) bCounts.textContent = `${currentBeats} phách`;
      if (bBar) bBar.style.width = '100%';
      if (bHint) bHint.textContent = `Nhịp lấy đà hợp lệ theo nhạc lý`;
      if (bAutofillBtn) bAutofillBtn.classList.add('hidden');

    } else {
      // BÁO XANH: CHUẨN NHỊP ĐỦ PHÁCH
      if (quickbar) {
        quickbar.classList.add('status-ok');
        quickbar.classList.remove('status-warning');
      }
      if (qStatusText) {
        qStatusText.textContent = `✓ Ô nhịp ${curMNum}: Chuẩn ${targetBeats}/${targetBeats} phách`;
      }
      if (qAutofillBtn) qAutofillBtn.classList.add('hidden');

      if (beatCard) {
        beatCard.classList.add('status-ok');
        beatCard.classList.remove('status-warning');
      }
      if (bIcon) bIcon.textContent = '✓';
      if (bTitle) bTitle.textContent = `Ô NHỊP ${curMNum}: ĐỦ PHÁCH`;
      if (bCounts) bCounts.textContent = `${targetBeats} / ${targetBeats} phách`;
      if (bBar) bBar.style.width = '100%';
      if (bHint) bHint.textContent = `✓ Nhịp chuẩn, sẵn sàng lưu`;
      if (bAutofillBtn) bAutofillBtn.classList.add('hidden');
    }
  }

  // Tự động bù dấu lặng cho 1 ô nhịp đang thiếu phách (1-Click Rescue)
  async function autoFillRestForMeasure(measureNum) {
    const h = _measureHealth[measureNum];
    if (!h || h.status !== 'underflow' || h.missing <= 0) {
      showToast(`Ô nhịp ${measureNum} đã đủ phách, không cần bù!`, 'info');
      return;
    }

    _saveSnapshotForUndo();
    const parts = _xmlDoc.querySelectorAll('part');
    const div = h.divisions || 2;

    parts.forEach(part => {
      const mEl = part.querySelector(`measure[number="${measureNum}"]`);
      if (!mEl) return;

      let remaining = h.missing;

      while (remaining > 0) {
        let durToAdd = 0;
        let typeToAdd = 'quarter';
        if (remaining >= div * 2) {
          durToAdd = div * 2;
          typeToAdd = 'half';
        } else if (remaining >= div) {
          durToAdd = div;
          typeToAdd = 'quarter';
        } else if (remaining >= Math.round(div / 2)) {
          durToAdd = Math.max(1, Math.round(div / 2));
          typeToAdd = 'eighth';
        } else {
          durToAdd = remaining;
          typeToAdd = '16th';
        }

        const restNote = _xmlDoc.createElement('note');
        restNote.appendChild(_xmlDoc.createElement('rest'));

        const durEl = _xmlDoc.createElement('duration');
        durEl.textContent = String(durToAdd);
        restNote.appendChild(durEl);

        const voiceEl = _xmlDoc.createElement('voice');
        voiceEl.textContent = '1';
        restNote.appendChild(voiceEl);

        const typeEl = _xmlDoc.createElement('type');
        typeEl.textContent = typeToAdd;
        restNote.appendChild(typeEl);

        const staffEl = _xmlDoc.createElement('staff');
        staffEl.textContent = '1';
        restNote.appendChild(staffEl);

        mEl.appendChild(restNote);
        remaining -= durToAdd;
      }
    });

    showToast(`⚡ Đã tự động bù dấu lặng chuẩn cho ô nhịp ${measureNum}!`, 'success', 1500);
    await _renderOsmdFromXmlDoc();
  }

  // Tự động bù dấu lặng cho TẤT CẢ các ô nhịp đang thiếu trên toàn bản nhạc
  async function autoFillAllRests() {
    let fixed = 0;
    const underflows = Object.values(_measureHealth).filter(h => h.status === 'underflow' && h.missing > 0);
    if (!underflows.length) {
      showToast('Tất cả ô nhịp đều đã đủ phách!', 'info');
      return;
    }

    _saveSnapshotForUndo();
    const parts = _xmlDoc.querySelectorAll('part');

    underflows.forEach(h => {
      const div = h.divisions || 2;
      parts.forEach(part => {
        const mEl = part.querySelector(`measure[number="${h.measureNum}"]`);
        if (!mEl) return;

        let remaining = h.missing;

        while (remaining > 0) {
          let durToAdd = 0;
          let typeToAdd = 'quarter';
          if (remaining >= div * 2) {
            durToAdd = div * 2;
            typeToAdd = 'half';
          } else if (remaining >= div) {
            durToAdd = div;
            typeToAdd = 'quarter';
          } else if (remaining >= Math.round(div / 2)) {
            durToAdd = Math.max(1, Math.round(div / 2));
            typeToAdd = 'eighth';
          } else {
            durToAdd = remaining;
            typeToAdd = '16th';
          }

          const restNote = _xmlDoc.createElement('note');
          restNote.appendChild(_xmlDoc.createElement('rest'));

          const durEl = _xmlDoc.createElement('duration');
          durEl.textContent = String(durToAdd);
          restNote.appendChild(durEl);

          const voiceEl = _xmlDoc.createElement('voice');
          voiceEl.textContent = '1';
          restNote.appendChild(voiceEl);

          const typeEl = _xmlDoc.createElement('type');
          typeEl.textContent = typeToAdd;
          restNote.appendChild(typeEl);

          const staffEl = _xmlDoc.createElement('staff');
          staffEl.textContent = '1';
          restNote.appendChild(staffEl);

          mEl.appendChild(restNote);
          remaining -= durToAdd;
        }
      });
      fixed++;
    });

    if (fixed > 0) {
      showToast(`⚡ Đã tự động bù dấu lặng cho ${fixed} ô nhịp!`, 'success', 2000);
      await _renderOsmdFromXmlDoc();
    }
  }

  /* ─── TƯƠNG TÁC KÉO THẢ NỐT THẲNG ĐỨNG (VERTICAL DRAG-TO-PITCH) ─ */
  const _svgNoteMap = new Map();
  const _svgLyricMap = new Map();
  let _hasBoundGlobalDragListeners = false;

  function _buildSvgNoteMap() {
    _svgNoteMap.clear();
    _svgLyricMap.clear();
    if (!_osmd || !_osmd.GraphicSheet) return;

    const gs = _osmd.GraphicSheet;
    (gs.MeasureList || []).forEach(staves => {
      staves.forEach((staffMeasure, sIdx) => {
        // Quan trọng: Sử dụng MeasureNumberXML để khớp chính xác 100% với MusicXML kể cả bài có nhịp lấy đà
        const mNum = parseInt(staffMeasure.parentSourceMeasure?.MeasureNumberXML ?? staffMeasure.MeasureNumber, 10);
        const entries = staffMeasure.staffEntries || [];
        entries.forEach((se, seIdx) => {
          // 1. Ánh xạ lời ca
          (se.LyricsEntries || []).forEach(le => {
            const txt = le.graphicalLabel?.Label?.text;
            if (txt) {
              const cleanTxt = txt.replace(/^\d+\./, '').trim().toLowerCase();
              if (cleanTxt) {
                _svgLyricMap.set(`${mNum}_${cleanTxt}`, {
                  measureNumber: mNum,
                  beatIndex: seIdx,
                  staffIndex: sIdx
                });
              }
            }
          });

          // 2. Ánh xạ stavenote
          (se.graphicalVoiceEntries || []).forEach(gve => {
            (gve.notes || []).forEach(gn => {
              const el = gn.getSVGGElement?.();
              if (el) {
                if (!_svgNoteMap.has(el)) {
                  _svgNoteMap.set(el, {
                    measureNumber: mNum,
                    beatIndex: seIdx,
                    staffIndex: sIdx,
                    notes: []
                  });
                }
                const p = gn.sourceNote?.Pitch;
                _svgNoteMap.get(el).notes.push({
                  step: p?.step,
                  octave: p?.octave,
                  alter: p?.alter,
                  isRest: gn.sourceNote?.isRest?.(),
                  absY: gn.PositionAndShape?.AbsolutePosition?.y || 0
                });
              }
            });
          });
        });
      });
    });
  }

  function _resolveVoiceFromClick(info, clientY, staveNoteEl, targetEl = null) {
    if (!info) return 'soprano';

    const noteheads = Array.from(staveNoteEl.querySelectorAll('g.vf-notehead'));
    if (noteheads.length >= 2) {
      // Sắp xếp notehead từ trên xuống dưới theo tọa độ Y
      const sorted = noteheads.map(nh => {
        const r = nh.getBoundingClientRect();
        return { el: nh, centerY: r.top + r.height / 2, rect: r };
      }).sort((a, b) => a.centerY - b.centerY);

      // Nếu click trúng chính xác một notehead element
      const clickedHead = targetEl ? targetEl.closest('g.vf-notehead') : null;
      if (clickedHead) {
        if (clickedHead === sorted[0].el) {
          return info.staffIndex === 0 ? 'soprano' : 'tenor';
        }
        if (clickedHead === sorted[sorted.length - 1].el) {
          return info.staffIndex === 0 ? 'alto' : 'bass';
        }
      }

      // So sánh khoảng cách tới tâm đầu nốt trên vs đầu nốt dưới
      const topDist = Math.abs(clientY - sorted[0].centerY);
      const botDist = Math.abs(clientY - sorted[sorted.length - 1].centerY);
      const isTop = topDist <= botDist;

      if (info.staffIndex === 0) {
        return isTop ? 'soprano' : 'alto';
      } else {
        return isTop ? 'tenor' : 'bass';
      }
    }

    if (info.staffIndex === 0) {
      if (_selectedPosition.voice === 'alto') return 'alto';
      return 'soprano';
    } else {
      if (_selectedPosition.voice === 'tenor') return 'tenor';
      return 'bass';
    }
  }

  function _highlightSelectedSvgNote() {
    const container = document.getElementById('osmd-editor-container');
    if (!container) return;

    // Reset các class highlight cũ
    container.querySelectorAll('.selected-note-item, .selected-voice-notehead, .selected-chord-peer').forEach(el => {
      el.classList.remove('selected-note-item', 'selected-voice-notehead', 'selected-chord-peer');
    });

    const { measureNumber, beatIndex, voice } = _selectedPosition;
    const isUpperStaff = (voice === 'soprano' || voice === 'alto');
    const isTopVoice = (voice === 'soprano' || voice === 'tenor');

    container.querySelectorAll('svg g.vf-stavenote').forEach(n => {
      const info = _svgNoteMap.get(n);
      if (info && info.measureNumber === measureNumber && info.beatIndex === beatIndex) {
        const matchesStaff = isUpperStaff ? (info.staffIndex === 0) : (info.staffIndex === 1);
        if (matchesStaff) {
          n.classList.add('selected-note-item');

          // Phân biệt nốt của bè đang chọn và bè phụ trong hợp âm
          const noteheads = Array.from(n.querySelectorAll('g.vf-notehead'));
          if (noteheads.length >= 2) {
            noteheads.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
            const activeNh = isTopVoice ? noteheads[0] : noteheads[1];
            const peerNh = isTopVoice ? noteheads[1] : noteheads[0];
            activeNh?.classList.add('selected-voice-notehead');
            peerNh?.classList.add('selected-chord-peer');
          } else if (noteheads.length === 1) {
            noteheads[0].classList.add('selected-voice-notehead');
          }
        }
      }
    });
  }

  function _wireVerticalDragEvents() {
    const container = document.getElementById('osmd-editor-container');
    if (!container) return;

    _buildSvgNoteMap();

    const noteGroups = container.querySelectorAll('svg g.vf-stavenote');
    noteGroups.forEach(staveNote => {
      staveNote.style.cursor = 'ns-resize';
      staveNote.style.pointerEvents = 'all';

      // Tạo hoặc cập nhật hitbox vô hình để người dùng click không bao giờ trượt
      let hitbox = staveNote.querySelector('.vf-hitbox');
      if (hitbox) hitbox.style.display = 'none';
      let b = null;
      try {
        b = staveNote.getBBox();
      } catch (err) {}
      if (hitbox) hitbox.style.display = '';

      if (b && b.width > 0 && b.height > 0) {
        if (!hitbox) {
          hitbox = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          hitbox.setAttribute('class', 'vf-hitbox');
          hitbox.setAttribute('fill', 'transparent');
          hitbox.setAttribute('pointer-events', 'all');
          hitbox.style.cursor = 'ns-resize';
          staveNote.insertBefore(hitbox, staveNote.firstChild);
        }
        const padX = 14;
        const padY = 10;
        hitbox.setAttribute('x', b.x - padX);
        hitbox.setAttribute('y', b.y - padY);
        hitbox.setAttribute('width', Math.max(38, b.width + padX * 2));
        hitbox.setAttribute('height', Math.max(44, b.height + padY * 2));
      }

      staveNote.onpointerdown = (e) => {
        e.preventDefault();
        e.stopPropagation();

        const info = _svgNoteMap.get(staveNote);
        if (info) {
          _selectedPosition.measureNumber = info.measureNumber;
          _selectedPosition.beatIndex = info.beatIndex;
          _selectedPosition.voice = _resolveVoiceFromClick(info, e.clientY, staveNote, e.target);
        }

        _refreshInspectorUI();

        const curNote = _selectedPosition.activeVoiceMap[_selectedPosition.voice];
        if (curNote && !curNote.isRest) {
          playSinglePitch(curNote.step, curNote.octave, curNote.alter, 0.25);

          // Phân biệt nốt bè đang chọn nếu là hợp âm 2 bè trên cùng 1 đuôi nốt
          const noteheads = Array.from(staveNote.querySelectorAll('g.vf-notehead'));
          let visualEl = staveNote;
          if (noteheads.length >= 2) {
            noteheads.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
            const isTopVoice = (_selectedPosition.voice === 'soprano' || _selectedPosition.voice === 'tenor');
            visualEl = (isTopVoice ? noteheads[0] : noteheads[1]) || staveNote;
          }

          _dragState.active = true;
          _dragState.pointerId = e.pointerId;
          _dragState.targetEl = staveNote;
          _dragState.visualEl = visualEl;
          _dragState.startY = e.clientY;
          _dragState.startX = e.clientX;
          _dragState.currentStep = curNote.step;
          _dragState.currentOctave = curNote.octave;
          _dragState.currentAlter = curNote.alter;
          _dragState.previewStep = curNote.step;
          _dragState.previewOctave = curNote.octave;
          _dragState.hasMoved = false;

          visualEl.classList.add('is-dragging-note');
          visualEl.style.transition = 'none';

          // Hiển thị overlay nốt bóng (toạ độ fixed theo clientX, clientY)
          const overlay = document.getElementById('drag-ghost-overlay');
          const badge = document.getElementById('drag-ghost-badge');
          const line = document.getElementById('drag-guide-line');
          if (overlay && badge && line) {
            overlay.classList.remove('hidden');
            badge.style.left = `${e.clientX}px`;
            badge.style.top = `${e.clientY}px`;
            const accSym = curNote.alter === 1 ? '♯' : (curNote.alter === -1 ? '♭' : '');
            badge.textContent = `${curNote.step}${accSym}${curNote.octave} (0)`;
            line.style.left = `${e.clientX}px`;
            line.style.top = '0';
            line.style.height = '100vh';
          }
        }
      };
    });

    // Bắt sự kiện click & kéo vào các từ lời ca bên dưới nốt
    container.querySelectorAll('svg text').forEach(textEl => {
      const raw = (textEl.textContent || '').trim();
      if (!raw || /^\d+$/.test(raw)) return;

      const clean = raw.replace(/^\d+\./, '').trim().toLowerCase();
      for (const [key, loc] of _svgLyricMap.entries()) {
        const [, word] = key.split('_');
        if (clean === word || clean.includes(word) || word.includes(clean)) {
          textEl.style.cursor = 'ns-resize';
          textEl.onpointerdown = (e) => {
            e.preventDefault();
            e.stopPropagation();
            _selectedPosition.measureNumber = loc.measureNumber;
            _selectedPosition.beatIndex = loc.beatIndex;

            if (loc.staffIndex === 0) {
              if (_selectedPosition.voice !== 'soprano' && _selectedPosition.voice !== 'alto') {
                _selectedPosition.voice = 'soprano';
              }
            } else {
              if (_selectedPosition.voice !== 'tenor' && _selectedPosition.voice !== 'bass') {
                _selectedPosition.voice = 'bass';
              }
            }

            _refreshInspectorUI();

            const cur = _selectedPosition.activeVoiceMap[_selectedPosition.voice];
            if (cur && !cur.isRest) {
              playSinglePitch(cur.step, cur.octave, cur.alter, 0.25);

              _dragState.active = true;
              _dragState.pointerId = e.pointerId;
              _dragState.targetEl = textEl;
              _dragState.visualEl = null;
              _dragState.startY = e.clientY;
              _dragState.startX = e.clientX;
              _dragState.currentStep = cur.step;
              _dragState.currentOctave = cur.octave;
              _dragState.currentAlter = cur.alter;
              _dragState.previewStep = cur.step;
              _dragState.previewOctave = cur.octave;
              _dragState.hasMoved = false;

              const overlay = document.getElementById('drag-ghost-overlay');
              const badge = document.getElementById('drag-ghost-badge');
              const line = document.getElementById('drag-guide-line');
              if (overlay && badge && line) {
                overlay.classList.remove('hidden');
                badge.style.left = `${e.clientX}px`;
                badge.style.top = `${e.clientY}px`;
                const accSym = cur.alter === 1 ? '♯' : (cur.alter === -1 ? '♭' : '');
                badge.textContent = `${cur.step}${accSym}${cur.octave} (0)`;
                line.style.left = `${e.clientX}px`;
                line.style.top = '0';
                line.style.height = '100vh';
              }
            }
          };
          break;
        }
      }
    });

    // Lắng nghe pointermove và pointerup trên window một lần duy nhất (Optimistic 60 FPS Engine)
    if (!_hasBoundGlobalDragListeners) {
      _hasBoundGlobalDragListeners = true;

      window.addEventListener('pointermove', (e) => {
        if (!_dragState.active) return;
        e.preventDefault();

        const deltaY = _dragState.startY - e.clientY; // > 0: kéo LÊN (cao độ tăng), < 0: kéo XUỐNG
        const stepPixels = Math.max(4, 5 * _zoom); // Chuẩn độ cao 1 bậc khuông nhạc = 5px * zoom
        const deltaSteps = Math.round(deltaY / stepPixels);

        if (Math.abs(deltaY) > 3) {
          _dragState.hasMoved = true;
        }

        // Tịnh tiến nốt SVG ngay lập tức (60 FPS GPU Transform, không re-render)
        if (_dragState.visualEl) {
          const visualY = -(deltaSteps * stepPixels);
          _dragState.visualEl.style.transform = `translateY(${visualY}px)`;
        }

        const diatonicSteps = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
        const currentIdx = _dragState.currentOctave * 7 + diatonicSteps.indexOf(_dragState.currentStep);
        const newIdx = Math.max(14, Math.min(56, currentIdx + deltaSteps)); // Giới hạn từ C2 đến B7

        const newStep = diatonicSteps[((newIdx % 7) + 7) % 7];
        const newOctave = Math.floor(newIdx / 7);

        const badge = document.getElementById('drag-ghost-badge');
        const line = document.getElementById('drag-guide-line');
        if (badge) {
          badge.style.left = `${e.clientX}px`;
          badge.style.top = `${e.clientY}px`;
          const accSym = _dragState.currentAlter === 1 ? '♯' : (_dragState.currentAlter === -1 ? '♭' : '');
          const diffSign = deltaSteps > 0 ? `+${deltaSteps}` : (deltaSteps < 0 ? `${deltaSteps}` : '0');
          badge.textContent = `${newStep}${accSym}${newOctave} (${diffSign})`;
        }
        if (line) {
          line.style.left = `${e.clientX}px`;
        }

        if (newStep !== _dragState.previewStep || newOctave !== _dragState.previewOctave) {
          _dragState.previewStep = newStep;
          _dragState.previewOctave = newOctave;
          playSinglePitch(newStep, newOctave, _dragState.currentAlter, 0.15);
        }
      });

      window.addEventListener('pointerup', () => {
        if (!_dragState.active) return;
        _dragState.active = false;

        document.getElementById('drag-ghost-overlay')?.classList.add('hidden');

        // Phục hồi transform SVG trước khi OSMD vẽ lại hoàn chỉnh
        if (_dragState.visualEl) {
          _dragState.visualEl.style.transform = '';
          _dragState.visualEl.classList.remove('is-dragging-note');
        }

        if (_dragState.hasMoved && _dragState.previewStep && 
            (_dragState.previewStep !== _dragState.currentStep || _dragState.previewOctave !== _dragState.currentOctave)) {
          modifyPitch(_dragState.previewStep, _dragState.previewOctave, _dragState.currentAlter);
        }
      });

      window.addEventListener('pointercancel', () => {
        if (!_dragState.active) return;
        _dragState.active = false;
        document.getElementById('drag-ghost-overlay')?.classList.add('hidden');
        if (_dragState.visualEl) {
          _dragState.visualEl.style.transform = '';
          _dragState.visualEl.classList.remove('is-dragging-note');
        }
      });
    }

    _highlightSelectedSvgNote();
  }

  /* ─── Render OSMD từ Cây DOM XML ─────────────────────────────── */
  async function _renderOsmdFromXmlDoc() {
    if (!_xmlDoc || !_osmd) return;
    const xmlString = new XMLSerializer().serializeToString(_xmlDoc);
    await _osmd.load(xmlString);
    _osmd.setLogLevel('warn');
    _osmd.render();
    validateAllMeasures();
    _refreshInspectorUI();
    _wireVerticalDragEvents();
  }

  async function _parseAndLoadXml(xmlString, resetUndo = true) {
    const parser = new DOMParser();
    _xmlDoc = parser.parseFromString(xmlString, 'text/xml');
    if (resetUndo) {
      _undoStack = [];
      _redoStack = [];
      _setDirty(false);
      _updateUndoRedoButtons();
    }
    await _renderOsmdFromXmlDoc();
  }

  /* ─── Bàn Phím Piano Ảo Mini ─────────────────────────────────── */
  function _buildMiniPiano() {
    const container = document.getElementById('mini-piano');
    if (!container) return;
    container.innerHTML = '';

    const notesInOctave = [
      { step: 'C', isBlack: false },
      { step: 'C', alter: 1, isBlack: true, label: 'C♯' },
      { step: 'D', isBlack: false },
      { step: 'D', alter: 1, isBlack: true, label: 'D♯' },
      { step: 'E', isBlack: false },
      { step: 'F', isBlack: false },
      { step: 'F', alter: 1, isBlack: true, label: 'F♯' },
      { step: 'G', isBlack: false },
      { step: 'G', alter: 1, isBlack: true, label: 'G♯' },
      { step: 'A', isBlack: false },
      { step: 'A', alter: 1, isBlack: true, label: 'A♯' },
      { step: 'B', isBlack: false }
    ];

    [3, 4, 5].forEach(oct => {
      notesInOctave.forEach(item => {
        const key = document.createElement('div');
        key.className = `piano-key ${item.isBlack ? 'piano-black-key' : 'piano-white-key'}`;
        key.dataset.step = item.step;
        key.dataset.octave = oct;
        key.dataset.alter = item.alter || 0;

        const pitchName = item.isBlack ? `${item.step}♯${oct} / ${item.label || ''}` : `${item.step}${oct}`;
        key.title = pitchName;

        if (!item.isBlack && item.step === 'C') {
          const span = document.createElement('span');
          span.textContent = `C${oct}`;
          key.appendChild(span);
        }

        const handleKeyTrigger = (e) => {
          e.preventDefault();
          modifyPitch(item.step, oct, item.alter || 0);
        };

        key.addEventListener('click', handleKeyTrigger);
        key.addEventListener('touchstart', (e) => {
          e.preventDefault();
          handleKeyTrigger(e);
        }, { passive: false });

        container.appendChild(key);
      });
    });
  }

  function _highlightPianoKey(step, octave, alter = 0) {
    if (!step) {
      document.querySelectorAll('.piano-key.active').forEach(k => k.classList.remove('active'));
      return;
    }
    const targetMidi = _pitchToMidi(step, octave, alter);
    document.querySelectorAll('.piano-key').forEach(k => {
      const kMidi = _pitchToMidi(k.dataset.step, parseInt(k.dataset.octave, 10), parseInt(k.dataset.alter, 10));
      k.classList.toggle('active', kMidi === targetMidi);
    });
  }

  /* ─── Quản Lý Phiên Bản Người Dùng & API ─────────────────────── */
  async function fetchSongVersions(songId) {
    try {
      const res = await fetch(`/api/index.php?route=songs&action=get_versions&song_id=${encodeURIComponent(songId)}`);
      const data = await res.json();
      _songVersionsList = data.data || [];
      _renderVersionsDropdown();
    } catch (e) {
      console.warn('[Editor] Tải phiên bản thất bại:', e);
    }
  }

  function _renderVersionsDropdown() {
    const listEl = document.getElementById('editor-version-items-list');
    const labelEl = document.getElementById('editor-version-label');
    const iconEl = document.getElementById('editor-version-icon');
    if (!listEl) return;

    listEl.innerHTML = '';

    // Mục 1: Bản Gốc
    const isMaster = !_currentVersion;
    if (labelEl) labelEl.textContent = isMaster ? 'Bản Gốc (Master)' : _currentVersion.version_name;
    if (iconEl) iconEl.textContent = isMaster ? '⭐️' : '👤';

    const masterBtn = document.createElement('button');
    masterBtn.className = 'ver-item-btn' + (isMaster ? ' active' : '');
    masterBtn.innerHTML = `
      <span>⭐️ <strong>Bản Gốc (Master)</strong></span>
      ${isMaster ? '<span>● Đang chọn</span>' : ''}
    `;
    masterBtn.onclick = async () => {
      _currentVersion = null;
      document.getElementById('editor-version-dropdown')?.classList.add('hidden');
      await loadSong(_currentSong, null);
    };
    listEl.appendChild(masterBtn);

    // Mục 2..N: Các phiên bản
    _songVersionsList.forEach(v => {
      const isSelected = _currentVersion && String(_currentVersion.id) === String(v.id);
      const btn = document.createElement('button');
      btn.className = 'ver-item-btn' + (isSelected ? ' active' : '');
      btn.innerHTML = `
        <div>
          <span>👤 <strong>${v.version_name}</strong></span>
          <div style="font-size:0.7rem; color:var(--text-muted);">${v.username} · ${v.created_at?.slice(0, 10)}</div>
        </div>
        ${isSelected ? '<span>● Đang chọn</span>' : ''}
      `;
      btn.onclick = async () => {
        document.getElementById('editor-version-dropdown')?.classList.add('hidden');
        _currentVersion = v;
        await loadSong(_currentSong, v);
      };
      listEl.appendChild(btn);
    });
  }

  // Mở modal lưu phiên bản
  function openSaveVersionModal() {
    const modal = document.getElementById('save-version-modal');
    if (!modal) return;

    // Kiểm tra ô nhịp cảnh báo
    let badCount = 0;
    Object.values(_measureHealth).forEach(m => {
      if (m.status !== 'ok') badCount++;
    });

    const warnBox = document.getElementById('save-measure-warning-box');
    const warnText = document.getElementById('save-warning-text');
    if (warnBox && warnText) {
      if (badCount > 0) {
        warnBox.classList.remove('hidden');
        warnText.textContent = `Phát hiện ${badCount} ô nhịp chưa chuẩn phách!`;
      } else {
        warnBox.classList.add('hidden');
      }
    }

    // Thiết lập radio options
    const overwriteOption = document.getElementById('label-choice-overwrite');
    const overwriteRadio = document.getElementById('radio-save-overwrite');
    const newRadio = document.getElementById('radio-save-new');
    const nameInput = document.getElementById('input-version-name');

    if (_currentVersion) {
      overwriteOption?.classList.remove('hidden');
      if (overwriteRadio) overwriteRadio.checked = true;
      if (nameInput) nameInput.value = _currentVersion.version_name;
    } else {
      overwriteOption?.classList.add('hidden');
      if (newRadio) newRadio.checked = true;
      if (nameInput) nameInput.value = `Bản chỉnh sửa ngày ${new Date().toLocaleDateString('vi-VN')}`;
    }

    modal.classList.remove('hidden');
  }

  function closeSaveVersionModal() {
    document.getElementById('save-version-modal')?.classList.add('hidden');
  }

  // Thực hiện lưu phiên bản lên server
  async function confirmSaveVersion() {
    if (!_currentSong || !_xmlDoc) return;

    const isOverwrite = document.getElementById('radio-save-overwrite')?.checked;
    const versionName = document.getElementById('input-version-name')?.value?.trim() || '';
    const description = document.getElementById('input-version-desc')?.value?.trim() || '';

    const confirmBtn = document.getElementById('btn-confirm-save-version');
    if (confirmBtn) confirmBtn.disabled = true;

    try {
      const xmlString = new XMLSerializer().serializeToString(_xmlDoc);
      const payload = {
        song_id: _currentSong.id,
        xml: xmlString,
        version_name: versionName,
        description: description,
        version_id: (isOverwrite && _currentVersion) ? _currentVersion.id : null
      };

      const res = await fetch('/api/index.php?route=songs&action=save_version', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        _setDirty(false);
        closeSaveVersionModal();
        showToast(data.message || '✅ Đã lưu phiên bản thành công!', 'success', 2500);

        if (data.data) {
          _currentVersion = data.data;
        }
        await fetchSongVersions(_currentSong.id);
      } else {
        showToast(`❌ ${data.error || 'Lưu thất bại'}`, 'error', 3000);
      }
    } catch (e) {
      console.error('[Editor] Lưu phiên bản lỗi:', e);
      showToast('Lỗi kết nối khi lưu phiên bản!', 'error');
    } finally {
      if (confirmBtn) confirmBtn.disabled = false;
    }
  }

  /* ─── Tải Bài Hát & Xử Lý Nạp File ────────────────────────────── */
  async function fetchSongsList() {
    try {
      const res = await fetch('/api/index.php?route=songs');
      const data = await res.json();
      _songsList = Array.isArray(data) ? data : (data.data || []);
      _renderSongListModal();

      const params = new URLSearchParams(window.location.search);
      const songParam = params.get('song') || params.get('id');
      if (songParam) {
        const pClean = String(songParam).trim().toLowerCase();
        const found = _songsList.find(s => {
          const sId = String(s.id || '').toLowerCase();
          const httlvnId = String(s.httlvnId || '');
          return sId === pClean || 
                 httlvnId === pClean || 
                 sId === `thanh-ca-${pClean.padStart(3, '0')}` ||
                 sId.includes(pClean);
        });
        if (found) {
          await loadSong(found);
          return;
        }
      }

      if (_songsList.length > 0) {
        await loadSong(_songsList[0]);
      }
    } catch (e) {
      console.error('[Editor] Tải danh sách bài hát lỗi:', e);
      showToast('Không tải được danh sách bài hát!', 'error');
    }
  }

  async function loadSong(song, version = null) {
    if (!song) return;
    _currentSong = song;
    _currentVersion = version;

    const label = document.getElementById('current-song-label');
    if (label) label.textContent = `${song.title} (${song.id})`;

    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.classList.remove('hidden');

    try {
      const rawPath = version ? (version.xml_path || version.xmlPath) : (song.xmlPath || song.xml_path);
      if (!rawPath) throw new Error('Không tìm thấy đường dẫn XML!');
      const cleanPath = rawPath.replace(/^\//, '');
      const fetchUrl = '/' + encodeURI(cleanPath);
      const res = await fetch(fetchUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const xmlText = await res.text();

      _selectedPosition.measureNumber = 1;
      _selectedPosition.beatIndex = 0;
      await _parseAndLoadXml(xmlText, true);

      // Cập nhật URL
      const url = new URL(window.location);
      url.searchParams.set('song', song.id);
      window.history.replaceState({}, '', url);

      await fetchSongVersions(song.id);
      showToast(`Đã nạp: "${song.title}" (${version ? version.version_name : 'Bản Gốc'})`, 'success', 1500);
    } catch (e) {
      console.error('[Editor] Load XML error:', e);
      showToast('Lỗi khi tải file MusicXML: ' + e.message, 'error');
    } finally {
      if (overlay) overlay.classList.add('hidden');
    }
  }

  function _renderSongListModal(filterText = '') {
    const listEl = document.getElementById('modal-song-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    const filter = filterText.toLowerCase().trim();
    const filtered = _songsList.filter(s => {
      if (!filter) return true;
      return s.title.toLowerCase().includes(filter) || String(s.id).includes(filter);
    });

    if (filtered.length === 0) {
      listEl.innerHTML = '<div style="padding:1rem;color:#94a3b8;text-align:center;">Không tìm thấy bài hát phù hợp.</div>';
      return;
    }

    filtered.slice(0, 100).forEach(song => {
      const btn = document.createElement('button');
      btn.className = 'song-list-item';
      if (_currentSong && String(_currentSong.id) === String(song.id)) {
        btn.classList.add('selected');
      }
      btn.innerHTML = `
        <span class="item-title">${song.title}</span>
        <span class="item-meta">MS: ${song.id}</span>
      `;
      btn.onclick = async () => {
        document.getElementById('song-picker-modal')?.classList.add('hidden');
        await loadSong(song);
      };
      listEl.appendChild(btn);
    });
  }

  function showToast(msg, type = 'info', timeout = 2000) {
    const toast = document.getElementById('editor-toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.className = `editor-toast ${type}`;
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.add('hidden'), timeout);
  }

  /* ─── BIND EVENTS (Lắng Nghe Mọi Thao Tác) ─────────────────────── */
  function _bindEvents() {
    // Zoom
    document.getElementById('btn-zoom-in')?.addEventListener('click', () => {
      _zoom = Math.min(2.0, _zoom + 0.1);
      _applyZoom();
    });
    document.getElementById('btn-zoom-out')?.addEventListener('click', () => {
      _zoom = Math.max(0.4, _zoom - 0.1);
      _applyZoom();
    });

    // Undo / Redo
    document.getElementById('btn-undo')?.addEventListener('click', undo);
    document.getElementById('btn-redo')?.addEventListener('click', redo);

    // Save Version Modal
    document.getElementById('btn-open-save-modal')?.addEventListener('click', openSaveVersionModal);
    document.getElementById('btn-close-save-modal')?.addEventListener('click', closeSaveVersionModal);
    document.getElementById('btn-cancel-save')?.addEventListener('click', closeSaveVersionModal);
    document.getElementById('btn-confirm-save-version')?.addEventListener('click', confirmSaveVersion);
    document.getElementById('btn-modal-autofill-rests')?.addEventListener('click', () => {
      autoFillAllRests();
      closeSaveVersionModal();
    });

    // Radio lựa chọn trong modal lưu
    document.querySelectorAll('input[name="save-mode"]').forEach(radio => {
      radio.addEventListener('change', () => {
        document.querySelectorAll('.choice-option').forEach(opt => opt.classList.remove('selected'));
        radio.closest('.choice-option')?.classList.add('selected');
      });
    });

    // Version dropdown button
    const verBtn = document.getElementById('btn-editor-version');
    const verDropdown = document.getElementById('editor-version-dropdown');
    verBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      verDropdown?.classList.toggle('hidden');
    });
    document.addEventListener('click', (e) => {
      if (!verBtn?.contains(e.target) && !verDropdown?.contains(e.target)) {
        verDropdown?.classList.add('hidden');
      }
    });

    // Song picker modal
    document.getElementById('btn-select-song')?.addEventListener('click', () => {
      document.getElementById('song-picker-modal')?.classList.remove('hidden');
      _renderSongListModal();
    });
    document.getElementById('btn-close-picker-modal')?.addEventListener('click', () => {
      document.getElementById('song-picker-modal')?.classList.add('hidden');
    });
    document.getElementById('song-search-input')?.addEventListener('input', (e) => {
      _renderSongListModal(e.target.value);
    });

    // Prev / Next song
    document.getElementById('btn-prev-song')?.addEventListener('click', () => {
      if (!_songsList.length || !_currentSong) return;
      const idx = _songsList.findIndex(s => String(s.id) === String(_currentSong.id));
      if (idx > 0) loadSong(_songsList[idx - 1]);
    });
    document.getElementById('btn-next-song')?.addEventListener('click', () => {
      if (!_songsList.length || !_currentSong) return;
      const idx = _songsList.findIndex(s => String(s.id) === String(_currentSong.id));
      if (idx >= 0 && idx < _songsList.length - 1) loadSong(_songsList[idx + 1]);
    });

    // SATB Tab switching
    document.querySelectorAll('.satb-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        _selectedPosition.voice = btn.dataset.voice;
        _refreshInspectorUI();
        const cur = _selectedPosition.activeVoiceMap[_selectedPosition.voice];
        if (cur && !cur.isRest) playSinglePitch(cur.step, cur.octave, cur.alter);
      });
    });

    // Step selection (C..B)
    document.querySelectorAll('.btn-step').forEach(btn => {
      btn.addEventListener('click', () => modifyPitch(btn.dataset.step));
    });

    // Octave
    document.getElementById('btn-oct-dec')?.addEventListener('click', () => modifyOctave(-1));
    document.getElementById('btn-oct-inc')?.addEventListener('click', () => modifyOctave(1));
    document.querySelectorAll('.pill-oct').forEach(pill => {
      pill.addEventListener('click', () => {
        modifyOctave(parseInt(pill.dataset.oct, 10) - (_selectedPosition.activeVoiceMap[_selectedPosition.voice]?.octave || 4));
      });
    });

    // Music Palette: Durations
    document.querySelectorAll('[data-dur]').forEach(btn => {
      btn.addEventListener('click', () => modifyDuration(btn.dataset.dur));
    });
    document.getElementById('btn-pal-dot')?.addEventListener('click', toggleDot);
    document.getElementById('btn-pal-tie')?.addEventListener('click', toggleTie);
    document.getElementById('btn-pal-slur')?.addEventListener('click', toggleSlur);
    document.getElementById('btn-pal-staccato')?.addEventListener('click', toggleStaccato);
    document.getElementById('btn-pal-accent')?.addEventListener('click', toggleAccent);
    document.getElementById('btn-pal-tenuto')?.addEventListener('click', toggleTenuto);
    document.getElementById('btn-pal-tuplet')?.addEventListener('click', toggleTuplet);
    document.getElementById('btn-pal-fermata')?.addEventListener('click', toggleFermata);
    document.getElementById('btn-pal-delete-rest')?.addEventListener('click', deleteNoteAsRest);
    document.getElementById('btn-pal-split-note')?.addEventListener('click', splitCurrentNote);

    // Semitone (+/- nửa cung)
    document.getElementById('btn-semi-dec')?.addEventListener('click', () => stepSemitone(-1));
    document.getElementById('btn-semi-inc')?.addEventListener('click', () => stepSemitone(1));

    // Toggle mini piano
    document.getElementById('btn-toggle-mini-piano')?.addEventListener('click', (e) => {
      const keysEl = document.getElementById('mini-piano');
      if (keysEl) {
        keysEl.classList.toggle('collapsed');
        e.target.textContent = keysEl.classList.contains('collapsed') ? 'Mở rộng ▼' : 'Thu gọn ▲';
      }
    });

    // Toggle Chế độ Bảo Toàn Phách (Smart Overwrite)
    document.getElementById('btn-toggle-smart-overwrite')?.addEventListener('click', () => {
      _smartOverwriteMode = !_smartOverwriteMode;
      _refreshInspectorUI();
      showToast(_smartOverwriteMode ? '⚡ Chế độ Bảo Toàn Phách: ĐÃ BẬT' : '⚠️ Chế độ Bảo Toàn Phách: ĐÃ TẮT', 'info', 1500);
    });

    // Smart Rest Subdivide & Consolidation (Thanh QuickBar + Inspector)
    document.getElementById('btn-subdivide-2')?.addEventListener('click', () => subdivideNoteToRests(2));
    document.getElementById('btn-subdivide-4')?.addEventListener('click', () => subdivideNoteToRests(4));
    document.getElementById('btn-merge-rests')?.addEventListener('click', () => mergeWithNextRest());
    document.getElementById('quick-btn-to-rest')?.addEventListener('click', () => deleteNoteAsRest());
    document.getElementById('quick-btn-subdivide-2')?.addEventListener('click', () => subdivideNoteToRests(2));
    document.getElementById('quick-btn-subdivide-4')?.addEventListener('click', () => subdivideNoteToRests(4));
    document.getElementById('quick-btn-merge-rests')?.addEventListener('click', () => mergeWithNextRest());

    // Smart Quickbar action buttons
    document.getElementById('quick-btn-insert-after')?.addEventListener('click', () => insertNoteAfter());
    document.getElementById('quick-btn-insert-rest')?.addEventListener('click', () => insertRestAfter());
    document.getElementById('quick-btn-duplicate')?.addEventListener('click', () => duplicateCurrentNote());
    document.getElementById('quick-btn-hard-delete')?.addEventListener('click', () => deleteNoteCompletely());
    document.getElementById('quick-btn-autofill')?.addEventListener('click', () => {
      autoFillRestForMeasure(_selectedPosition.measureNumber);
    });

    // Thao tác Thêm nốt & Sao chép & Xóa hẳn (Inspector)
    document.getElementById('btn-insert-note-after')?.addEventListener('click', () => insertNoteAfter());
    document.getElementById('btn-insert-note-before')?.addEventListener('click', () => insertNoteBefore());
    document.getElementById('btn-insert-rest-after')?.addEventListener('click', () => insertRestAfter());
    document.getElementById('btn-duplicate-note')?.addEventListener('click', duplicateCurrentNote);
    document.getElementById('btn-hard-delete-note')?.addEventListener('click', deleteNoteCompletely);

    // Modal phím tắt
    const shortcutModal = document.getElementById('shortcut-guide-modal');
    document.getElementById('btn-open-shortcut-modal')?.addEventListener('click', () => {
      shortcutModal?.classList.remove('hidden');
    });
    document.getElementById('btn-close-shortcut-modal')?.addEventListener('click', () => {
      shortcutModal?.classList.add('hidden');
    });
    shortcutModal?.addEventListener('click', (e) => {
      if (e.target === shortcutModal) shortcutModal.classList.add('hidden');
    });

    // Cấu trúc ô nhịp
    document.getElementById('btn-add-measure-after')?.addEventListener('click', addMeasureAfter);
    document.getElementById('btn-del-measure')?.addEventListener('click', deleteCurrentMeasure);
    document.getElementById('select-time-sig')?.addEventListener('change', (e) => {
      if (e.target.value) {
        changeTimeSignature(e.target.value);
        e.target.value = '';
      }
    });

    // Music Palette: Accidentals
    document.querySelectorAll('[data-acc]').forEach(btn => {
      btn.addEventListener('click', () => modifyAccidental(btn.dataset.acc));
    });

    // Bù dấu lặng tự động & Quick fix chip
    document.getElementById('btn-auto-fix-all-rests')?.addEventListener('click', autoFillAllRests);
    document.getElementById('btn-quick-autofill')?.addEventListener('click', () => {
      autoFillRestForMeasure(_selectedPosition.measureNumber);
    });
    document.getElementById('btn-inspector-autofill')?.addEventListener('click', () => {
      autoFillRestForMeasure(_selectedPosition.measureNumber);
    });

    // Tab switching trong footer inspector (Nốt & Lời, Mixer, Piano)
    document.querySelectorAll('.tool-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tool-tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tool-pane').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        const targetId = btn.dataset.tab ? btn.dataset.tab.replace('tab-', 'pane-') : '';
        if (targetId) document.getElementById(targetId)?.classList.add('active');
      });
    });

    // Thu gọn / Mở rộng panel chân trang
    const foldBtn = document.getElementById('btn-toggle-panel-fold');
    foldBtn?.addEventListener('click', () => {
      const panel = document.getElementById('satb-panel');
      panel?.classList.toggle('folded');
      foldBtn.textContent = panel?.classList.contains('folded') ? '▲' : '▼';
    });

    // Nút nghe hợp âm SATB trên Tab 1
    document.getElementById('btn-play-chord')?.addEventListener('click', playSatbChord);

    // Mixer Channels: Solo & Mute & Volume
    ['soprano', 'alto', 'tenor', 'bass'].forEach(voice => {
      const chEl = document.getElementById(`mixer-${voice}`);
      if (!chEl) return;

      const volSlider = chEl.querySelector('.ch-volume');
      const soloBtn = chEl.querySelector('.btn-solo');
      const muteBtn = chEl.querySelector('.btn-mute');

      volSlider?.addEventListener('input', (e) => {
        _mixerState[voice].volume = parseFloat(e.target.value);
      });
      soloBtn?.addEventListener('click', () => {
        _mixerState[voice].solo = !_mixerState[voice].solo;
        soloBtn.classList.toggle('active', _mixerState[voice].solo);
      });
      muteBtn?.addEventListener('click', () => {
        _mixerState[voice].mute = !_mixerState[voice].mute;
        muteBtn.classList.toggle('active', _mixerState[voice].mute);
      });
    });

    // Mixer Tempo
    const tempoSlider = document.getElementById('slider-tempo');
    const tempoVal = document.getElementById('val-tempo');
    tempoSlider?.addEventListener('input', (e) => {
      _mixerState.tempo = parseInt(e.target.value, 10);
      if (tempoVal) tempoVal.textContent = _mixerState.tempo;
    });

    // Mixer Actions
    document.getElementById('btn-mixer-play-chord')?.addEventListener('click', playSatbChord);
    document.getElementById('btn-mixer-play-measure')?.addEventListener('click', playMeasure);
    document.getElementById('btn-mixer-metronome')?.addEventListener('click', (e) => {
      _mixerState.metronome = !_mixerState.metronome;
      e.target.classList.toggle('active', _mixerState.metronome);
      showToast(_mixerState.metronome ? '🔔 Đã bật máy gõ nhịp' : '🔕 Đã tắt gõ nhịp', 'info', 1000);
    });

    // Lyric Input & Smart Auto-Advance
    const lyricInput = document.getElementById('input-note-lyric');
    document.getElementById('btn-apply-lyric')?.addEventListener('click', () => {
      applyLyricText(lyricInput?.value);
    });
    lyricInput?.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === '-') {
        e.preventDefault();
        applyLyricText(lyricInput.value, true);
      } else if (e.key === 'Enter') {
        applyLyricText(lyricInput.value, false);
      }
    });

    // Navigation nốt trước / sau
    function _navPrevNote() {
      if (_selectedPosition.beatIndex > 0) {
        _selectedPosition.beatIndex--;
      } else if (_selectedPosition.measureNumber > 1) {
        _selectedPosition.measureNumber--;
        const prevSatb = _getMeasureChordsSATB(_selectedPosition.measureNumber);
        _selectedPosition.beatIndex = Math.max(0, prevSatb.length - 1);
      }
      _refreshInspectorUI();
      const cur = _selectedPosition.activeVoiceMap[_selectedPosition.voice];
      if (cur && !cur.isRest) playSinglePitch(cur.step, cur.octave, cur.alter, 0.25);
    }

    function _navNextNote() {
      const curSatb = _getMeasureChordsSATB(_selectedPosition.measureNumber);
      if (_selectedPosition.beatIndex < curSatb.length - 1) {
        _selectedPosition.beatIndex++;
      } else {
        _selectedPosition.measureNumber++;
        _selectedPosition.beatIndex = 0;
      }
      _refreshInspectorUI();
      const cur = _selectedPosition.activeVoiceMap[_selectedPosition.voice];
      if (cur && !cur.isRest) playSinglePitch(cur.step, cur.octave, cur.alter, 0.25);
    }

    document.getElementById('btn-nav-prev-note')?.addEventListener('click', _navPrevNote);
    document.getElementById('btn-nav-next-note')?.addEventListener('click', _navNextNote);
    document.getElementById('btn-play-single')?.addEventListener('click', () => {
      const cur = _selectedPosition.activeVoiceMap[_selectedPosition.voice];
      if (cur && !cur.isRest) playSinglePitch(cur.step, cur.octave, cur.alter, 0.35);
    });
    document.getElementById('btn-play-chord')?.addEventListener('click', () => {
      playSatbChord();
    });

    /* ─── BIND TRANSPORT & PRO STUDIO CONTROLS ─── */
    document.getElementById('btn-transport-play')?.addEventListener('click', toggleScorePlayback);
    document.getElementById('btn-transport-stop')?.addEventListener('click', rewindScorePlayback);

    document.getElementById('select-playback-instrument')?.addEventListener('change', (e) => {
      _playbackState.instrument = e.target.value;
      showToast(`Nhạc cụ: ${e.target.options[e.target.selectedIndex].text}`, 'info', 1200);
    });

    document.getElementById('btn-toggle-reverb')?.addEventListener('click', function() {
      this.classList.toggle('active');
      const isActive = this.classList.contains('active');
      if (window.LearnSoundEngine) {
        window.LearnSoundEngine.setReverbWet(isActive ? 0.35 : 0.0);
      }
      showToast(isActive ? '⛪ Đã bật Vang Thánh Đường' : 'Đã tắt Reverb', 'info', 1000);
    });

    document.getElementById('btn-toggle-metronome')?.addEventListener('click', function() {
      this.classList.toggle('active');
      _playbackState.metronome = this.classList.contains('active');
      if (window.LearnSoundEngine) {
        window.LearnSoundEngine.setMetronomeEnabled(_playbackState.metronome);
      }
      showToast(_playbackState.metronome ? '⏱ Đã bật gõ nhịp Metronome' : 'Đã tắt gõ nhịp', 'info', 1000);
    });

    document.getElementById('transport-tempo-slider')?.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      _mixerState.tempo = val;
      const lbl = document.getElementById('transport-tempo-val');
      if (lbl) lbl.textContent = `${val} BPM`;
    });

    document.getElementById('btn-transport-loop')?.addEventListener('click', function() {
      this.classList.toggle('active');
      _playbackState.loopEnabled = this.classList.contains('active');
      showToast(_playbackState.loopEnabled ? '🔁 Đã bật lặp đoạn A-B' : 'Đã tắt lặp đoạn', 'info', 1000);
    });

    document.getElementById('btn-ai-harmonize')?.addEventListener('click', openAiHarmonizeModal);
    document.getElementById('btn-close-ai-modal')?.addEventListener('click', closeAiHarmonizeModal);
    document.getElementById('btn-cancel-ai')?.addEventListener('click', closeAiHarmonizeModal);
    document.getElementById('btn-confirm-ai-harmonize')?.addEventListener('click', executeAiHarmonization);

    document.getElementById('btn-toggle-rehearsal')?.addEventListener('click', toggleRehearsalMode);

    /* ─── BIND PRO EXPORT HUB ─── */
    document.getElementById('btn-open-export-modal')?.addEventListener('click', openExportModal);
    document.getElementById('btn-close-export-modal')?.addEventListener('click', closeExportModal);
    document.getElementById('btn-export-pdf')?.addEventListener('click', exportPdfScore);
    document.getElementById('btn-export-xml')?.addEventListener('click', exportMusicXmlScore);
    document.getElementById('btn-export-midi')?.addEventListener('click', exportMidiScore);

    // Phím tắt bàn phím (Keyboard Shortcuts - Chuẩn MuseScore & DAW Siêu Mượt)
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      // Hoàn tác & Làm lại
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
        e.preventDefault();
        redo();
        return;
      }

      // Lưu phiên bản
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        openSaveVersionModal();
        return;
      }

      // Mở bảng tra cứu phím tắt
      if ((e.ctrlKey || e.metaKey) && (e.key === '/' || e.key === '?')) {
        e.preventDefault();
        document.getElementById('shortcut-guide-modal')?.classList.toggle('hidden');
        return;
      }
      if (e.key === 'Escape') {
        document.getElementById('shortcut-guide-modal')?.classList.add('hidden');
        document.getElementById('export-score-modal')?.classList.add('hidden');
        document.getElementById('save-version-modal')?.classList.add('hidden');
        document.getElementById('ai-harmonize-modal')?.classList.add('hidden');
        return;
      }

      // CHỌN BÈ SATB: Alt + 1..4 hoặc Ctrl + 1..4
      if ((e.altKey || e.ctrlKey) && ['1', '2', '3', '4'].includes(e.key)) {
        e.preventDefault();
        const voiceNames = ['soprano', 'alto', 'tenor', 'bass'];
        const vIdx = parseInt(e.key, 10) - 1;
        const targetVoice = voiceNames[vIdx];
        if (targetVoice) {
          _selectedPosition.voice = targetVoice;
          _refreshInspectorUI();
          const cur = _selectedPosition.activeVoiceMap[targetVoice];
          if (cur && !cur.isRest) playSinglePitch(cur.step, cur.octave, cur.alter, 0.25);
          showToast(`Đã chọn bè: ${targetVoice.toUpperCase()}`, 'info', 700);
        }
        return;
      }

      // PHÍM V: Chuyển đổi nhanh lần lượt giữa 4 bè SATB (Soprano -> Alto -> Tenor -> Bass)
      if (e.key.toLowerCase() === 'v' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        const voiceOrder = ['soprano', 'alto', 'tenor', 'bass'];
        const curIdx = voiceOrder.indexOf(_selectedPosition.voice);
        const nextIdx = e.shiftKey ? (curIdx - 1 + 4) % 4 : (curIdx + 1) % 4;
        const nextVoice = voiceOrder[nextIdx];
        _selectedPosition.voice = nextVoice;
        _refreshInspectorUI();
        const cur = _selectedPosition.activeVoiceMap[nextVoice];
        if (cur && !cur.isRest) playSinglePitch(cur.step, cur.octave, cur.alter, 0.25);
        showToast(`Đã chuyển bè: ${nextVoice.toUpperCase()}`, 'info', 700);
        return;
      }

      // CHỌN TRƯỜNG ĐỘ (Chuẩn MuseScore / Palette Tooltips: 6=Tròn, 5=Trắng, 4=Đen, 3=Móc đơn, 2=Móc kép)
      if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        if (e.key === '6') {
          e.preventDefault();
          modifyDuration('whole');
          return;
        }
        if (e.key === '5') {
          e.preventDefault();
          modifyDuration('half');
          return;
        }
        if (e.key === '4') {
          e.preventDefault();
          modifyDuration('quarter');
          return;
        }
        if (e.key === '3') {
          e.preventDefault();
          modifyDuration('eighth');
          return;
        }
        if (e.key === '2') {
          e.preventDefault();
          modifyDuration('16th');
          return;
        }
        if (e.key === '1') {
          e.preventDefault();
          _selectedPosition.voice = 'soprano';
          _refreshInspectorUI();
          const cur = _selectedPosition.activeVoiceMap['soprano'];
          if (cur && !cur.isRest) playSinglePitch(cur.step, cur.octave, cur.alter, 0.25);
          showToast('Đã chọn bè: SOPRANO', 'info', 700);
          return;
        }
      }

      // Dấu chấm dôi (Dot): Phím . hoặc >
      if ((e.key === '.' || e.key === '>') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        toggleDot();
        return;
      }

      // Thêm nốt mới phía sau (Insert)
      if (e.key === 'Insert') {
        e.preventDefault();
        insertNoteAfter();
        return;
      }

      // Xóa hẳn nốt khỏi ô nhịp (Shift + Delete / Shift + Backspace)
      if (e.shiftKey && (e.key === 'Delete' || e.key === 'Backspace')) {
        e.preventDefault();
        deleteNoteCompletely();
        return;
      }

      // Đổi nốt thành dấu lặng an toàn (Delete / Backspace / X / R)
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteNoteAsRest();
        return;
      }
      if ((e.key.toLowerCase() === 'x' || e.key.toLowerCase() === 'r') && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        deleteNoteAsRest();
        return;
      }

      // Shift+X hoặc Alt+S: Phân rã thành 2 dấu lặng để soạn nốt
      if ((e.shiftKey && e.key.toLowerCase() === 'x') || (e.altKey && e.key.toLowerCase() === 's')) {
        e.preventDefault();
        subdivideNoteToRests(2);
        return;
      }

      // Alt+4: Phân rã thành 4 dấu lặng
      if (e.altKey && e.key === '4') {
        e.preventDefault();
        subdivideNoteToRests(4);
        return;
      }

      // Alt+M: Gộp 2 dấu lặng liền kề
      if (e.altKey && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        mergeWithNextRest();
        return;
      }

      // Dấu nối (Tie): Phím T
      if (e.key.toLowerCase() === 't' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        toggleTie();
        return;
      }

      // Space: Nghe toàn bài (Shift+Space: Nghe hòa âm 4 bè SATB tại nốt)
      if (e.key === ' ') {
        e.preventDefault();
        if (e.shiftKey) {
          playSatbChord();
        } else {
          toggleScorePlayback();
        }
        return;
      }

      // ĐIỀU HƯỚNG NỐT: ArrowLeft / ArrowRight hoặc Tab / Shift+Tab (Chuẩn MuseScore)
      if (e.key === 'ArrowLeft' || (e.key === 'Tab' && e.shiftKey)) {
        e.preventDefault();
        _navPrevNote();
        return;
      }
      if (e.key === 'ArrowRight' || (e.key === 'Tab' && !e.shiftKey)) {
        e.preventDefault();
        _navNextNote();
        return;
      }

      // CHỈNH CAO ĐỘ:
      // Shift + ArrowUp / ArrowDown: Tăng / giảm 1 quãng 8 (Octave)
      if (e.shiftKey && e.key === 'ArrowUp') {
        e.preventDefault();
        modifyOctave(1);
        return;
      }
      if (e.shiftKey && e.key === 'ArrowDown') {
        e.preventDefault();
        modifyOctave(-1);
        return;
      }

      // ArrowUp / ArrowDown: Tăng / giảm nửa cung (Semitone)
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        stepSemitone(1);
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        stepSemitone(-1);
        return;
      }

      // Phím chữ C, D, E, F, G, A, B: Điền hoặc đổi cao độ tức thì với âm thanh piano chân thực
      const keyUpper = e.key.toUpperCase();
      if (['C', 'D', 'E', 'F', 'G', 'A', 'B'].includes(keyUpper) && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        const cur = _selectedPosition.activeVoiceMap[_selectedPosition.voice];
        if (cur) {
          const defaultVoicePitch = {
            soprano: { step: 'G', octave: 4 },
            alto:    { step: 'E', octave: 4 },
            tenor:   { step: 'C', octave: 3 },
            bass:    { step: 'G', octave: 2 }
          };
          const defP = defaultVoicePitch[_selectedPosition.voice] || { step: 'C', octave: 4 };
          const oct = cur.isRest ? defP.octave : cur.octave;
          const alt = cur.isRest ? 0 : cur.alter;
          modifyPitch(keyUpper, oct, alt);
        }
        return;
      }

      // Phóng to / Thu nhỏ: Ctrl/Alt + (+ / -)
      if ((e.key === '+' || e.key === '=') && (e.ctrlKey || e.altKey)) {
        e.preventDefault();
        _zoom = Math.min(2.0, _zoom + 0.1);
        _applyZoom();
        return;
      }
      if (e.key === '-' && (e.ctrlKey || e.altKey)) {
        e.preventDefault();
        _zoom = Math.max(0.4, _zoom - 0.1);
        _applyZoom();
        return;
      }
    });
  }

  function _applyZoom() {
    if (!_osmd) return;
    _osmd.zoom = _zoom;
    _osmd.render();
    validateAllMeasures();
    _wireVerticalDragEvents();
    const lbl = document.getElementById('zoom-label');
    if (lbl) lbl.textContent = `${Math.round(_zoom * 100)}%`;
  }

  /* ─── Khởi Tạo Khi Tải Trang ─────────────────────────────────── */
  async function init() {
    const container = document.getElementById('osmd-editor-container');
    if (!container) return;

    _osmd = new opensheetmusicdisplay.OpenSheetMusicDisplay(container, {
      autoResize: true,
      backend: 'svg',
      drawTitle: true,
      drawSubtitle: true,
      drawComposer: true,
      drawLyricist: true,
      drawMetronomeMarks: true,
      drawPartNames: false
    });

    _bindEvents();
    _buildMiniPiano();
    initWebMidi();
    await fetchSongsList();
  }

  document.addEventListener('DOMContentLoaded', init);

  // Xuất API toàn cục
  window.SheetEditor = {
    loadSong,
    modifyPitch,
    modifyDuration,
    undo,
    redo,
    autoFillAllRests,
    toggleScorePlayback,
    startScorePlayback,
    pauseScorePlayback,
    stopScorePlayback,
    rewindScorePlayback,
    toggleRehearsalMode,
    executeAiHarmonization,
    exportPdfScore,
    exportMusicXmlScore,
    exportMidiScore,
    saveVersion: confirmSaveVersion,
    getOsmd: () => _osmd,
    getSvgNoteMap: () => _svgNoteMap,
    getSelectedPosition: () => _selectedPosition,
    getXmlDoc: () => _xmlDoc
  };
})();
