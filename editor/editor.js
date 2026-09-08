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

  // Trạng thái Kéo thả nốt thẳng đứng (Vertical Drag-to-Pitch)
  const _dragState = {
    active: false,
    pointerId: null,
    targetEl: null,
    startY: 0,
    startX: 0,
    baseMidi: 60,
    currentStep: 'C',
    currentOctave: 4,
    currentAlter: 0,
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

  // Phát 1 nốt đơn
  function playSinglePitch(step, octave, alter = 0, durationSec = 0.5) {
    if (!step) return;
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
    const ctx = _getAudioContext();
    const now = ctx.currentTime;
    const durSec = Math.max(0.6, 60 / _mixerState.tempo);

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
  function modifyPitch(newStep, newOctave = null, newAlter = null) {
    const curNote = _selectedPosition.activeVoiceMap[_selectedPosition.voice];
    if (!curNote || !curNote.xmlNode) {
      showToast('Chưa chọn nốt nhạc nào để sửa!', 'error');
      return;
    }

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
    _renderOsmdFromXmlDoc();
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

  function modifyDuration(newType) {
    const curNote = _selectedPosition.activeVoiceMap[_selectedPosition.voice];
    if (!curNote || !curNote.xmlNode) return;

    _saveSnapshotForUndo();
    const noteEl = curNote.xmlNode;

    let typeEl = noteEl.querySelector('type');
    if (!typeEl) {
      typeEl = _xmlDoc.createElement('type');
      noteEl.appendChild(typeEl);
    }
    typeEl.textContent = newType;

    const divisionsEl = noteEl.closest('measure')?.querySelector('attributes > divisions');
    const divisions = divisionsEl ? (parseInt(divisionsEl.textContent, 10) || 4) : 4;
    const multMap = { whole: 4, half: 2, quarter: 1, eighth: 0.5, '16th': 0.25 };
    const mult = multMap[newType] || 1;
    let newDuration = Math.round(divisions * mult);
    if (curNote.isDot) newDuration = Math.round(newDuration * 1.5);

    let durEl = noteEl.querySelector('duration');
    if (!durEl) {
      durEl = _xmlDoc.createElement('duration');
      noteEl.appendChild(durEl);
    }
    durEl.textContent = String(newDuration);

    _renderOsmdFromXmlDoc();
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
  function deleteNoteAsRest() {
    const curNote = _selectedPosition.activeVoiceMap[_selectedPosition.voice];
    if (!curNote || !curNote.xmlNode) return;

    _saveSnapshotForUndo();
    const noteEl = curNote.xmlNode;
    const pitchEl = noteEl.querySelector('pitch');
    if (pitchEl) pitchEl.remove();

    if (!noteEl.querySelector('rest')) {
      const newRest = _xmlDoc.createElement('rest');
      noteEl.insertBefore(newRest, noteEl.firstChild);
    }

    showToast('𝄽 Đã chuyển thành dấu lặng (bảo toàn phách)', 'info', 1200);
    _renderOsmdFromXmlDoc();
  }

  // Tách phách (Split Note): Chia đôi nốt để thêm nốt mới mà không phá vỡ ô nhịp
  function splitCurrentNote() {
    const curNote = _selectedPosition.activeVoiceMap[_selectedPosition.voice];
    if (!curNote || !curNote.xmlNode) return;

    _saveSnapshotForUndo();
    const noteEl = curNote.xmlNode;
    const oldDuration = curNote.duration;
    if (oldDuration <= 1) {
      showToast('Nốt này quá ngắn, không thể tách đôi!', 'warn');
      return;
    }

    const halfDur = Math.floor(oldDuration / 2);
    const durEl = noteEl.querySelector('duration');
    if (durEl) durEl.textContent = String(halfDur);

    // Tạo nốt thứ 2 nhân bản nối tiếp
    const cloneEl = noteEl.cloneNode(true);
    const cloneDurEl = cloneEl.querySelector('duration');
    if (cloneDurEl) cloneDurEl.textContent = String(halfDur);

    // Chèn clone ngay sau note gốc
    noteEl.parentNode.insertBefore(cloneEl, noteEl.nextSibling);

    showToast('✂️ Đã tách đôi nốt thành công (bảo toàn phách)', 'success', 1500);
    _renderOsmdFromXmlDoc();
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

  // Thêm Nốt Mới Ngay Sau Nốt Hiện Tại
  async function insertNoteAfter(durType = null) {
    const curNote = _selectedPosition.activeVoiceMap[_selectedPosition.voice];
    if (!curNote || !curNote.xmlNode) {
      showToast('Hãy chọn vị trí nốt để chèn nốt sau!', 'error');
      return;
    }

    _saveSnapshotForUndo();
    const curEl = curNote.xmlNode;
    const measureEl = curEl.closest('measure');
    const divisionsEl = measureEl?.querySelector('attributes > divisions');
    const divisions = divisionsEl ? (parseInt(divisionsEl.textContent, 10) || 4) : 4;

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

    curEl.parentNode.insertBefore(newNote, curEl.nextSibling);

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
    const divisionsEl = measureEl?.querySelector('attributes > divisions');
    const divisions = divisionsEl ? (parseInt(divisionsEl.textContent, 10) || 4) : 4;

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
    const divisionsEl = measureEl?.querySelector('attributes > divisions');
    const divisions = divisionsEl ? (parseInt(divisionsEl.textContent, 10) || 4) : 4;

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

    curEl.parentNode.insertBefore(newNote, curEl.nextSibling);
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

    curEl.parentNode.insertBefore(cloneEl, curEl.nextSibling);
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

  /* ─── HỆ THỐNG KIỂM TRA & CẢNH BÁO ĐỦ Ô NHỊP (BEAT VALIDATOR) ─ */
  function validateAllMeasures() {
    if (!_xmlDoc) return;
    _measureHealth = {};

    const parts = _xmlDoc.querySelectorAll('part');
    const part1 = _xmlDoc.querySelector('part#P1') || parts[0];
    if (!part1) return;

    const measures = part1.querySelectorAll('measure');
    let underflowCount = 0;
    let overflowCount = 0;

    let currentDivisions = 4;
    let currentBeats = 4;
    let currentBeatType = 4;

    measures.forEach((mEl, mIdx) => {
      const mNum = parseInt(mEl.getAttribute('number') || (mIdx + 1), 10);

      // Đọc time & divisions nếu ô nhịp có khai báo attributes
      const divEl = mEl.querySelector('attributes > divisions');
      if (divEl) currentDivisions = parseInt(divEl.textContent.trim(), 10) || currentDivisions;

      const beatsEl = mEl.querySelector('attributes > time > beats');
      const bTypeEl = mEl.querySelector('attributes > time > beat-type');
      if (beatsEl && bTypeEl) {
        currentBeats = parseInt(beatsEl.textContent.trim(), 10) || currentBeats;
        currentBeatType = parseInt(bTypeEl.textContent.trim(), 10) || currentBeatType;
      }

      const targetDivisions = Math.round(currentBeats * (4 / currentBeatType) * currentDivisions);

      // Tính tổng duration của nốt nối tiếp (bỏ qua chord notes)
      let totalDiv = 0;
      mEl.querySelectorAll('note').forEach(n => {
        if (!n.querySelector('chord')) {
          const d = parseInt(n.querySelector('duration')?.textContent || 0, 10);
          totalDiv += d;
        }
      });

      let status = 'ok';
      let missing = 0;
      let excess = 0;

      // Không xét lỗi nếu là ô nhịp lấy đà (pickup measure)
      const isPickup = (mIdx === 0 && totalDiv < targetDivisions && measures.length > 3);

      if (!isPickup && totalDiv < targetDivisions) {
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

  function _applyMeasureSvgHighlights() {
    const container = document.getElementById('osmd-editor-container');
    if (!container) return;

    // Tô viền các ô nhịp cảnh báo trên SVG
    Object.values(_measureHealth).forEach(m => {
      if (m.status === 'ok') return;
      // Tìm measure SVG group
      const measureSvg = container.querySelector(`g#vf-measure-${m.measureNum}`) ||
                         container.querySelector(`g[id*="measure_${m.measureNum}"]`);
      if (measureSvg) {
        measureSvg.classList.add(m.status === 'underflow' ? 'measure-warning-underflow' : 'measure-warning-overflow');
      }
    });
  }

  // Tự động bù dấu lặng cho 1 ô nhịp đang thiếu phách
  function autoFillRestForMeasure(measureNum) {
    const h = _measureHealth[measureNum];
    if (!h || h.status !== 'underflow' || h.missing <= 0) return;

    _saveSnapshotForUndo();
    const parts = _xmlDoc.querySelectorAll('part');
    parts.forEach(part => {
      const mEl = part.querySelector(`measure[number="${measureNum}"]`);
      if (!mEl) return;

      const restNote = _xmlDoc.createElement('note');
      restNote.appendChild(_xmlDoc.createElement('rest'));

      const durEl = _xmlDoc.createElement('duration');
      durEl.textContent = String(h.missing);
      restNote.appendChild(durEl);

      const typeEl = _xmlDoc.createElement('type');
      typeEl.textContent = h.missing >= h.divisions ? 'quarter' : 'eighth';
      restNote.appendChild(typeEl);

      mEl.appendChild(restNote);
    });

    showToast(`⚡ Đã bù dấu lặng cho ô nhịp ${measureNum}!`, 'success', 1500);
    _renderOsmdFromXmlDoc();
  }

  // Tự động bù dấu lặng cho TẤT CẢ các ô nhịp đang thiếu
  function autoFillAllRests() {
    let fixed = 0;
    Object.values(_measureHealth).forEach(h => {
      if (h.status === 'underflow' && h.missing > 0) {
        autoFillRestForMeasure(h.measureNum);
        fixed++;
      }
    });
    if (fixed > 0) {
      showToast(`⚡ Đã tự động bù dấu lặng cho ${fixed} ô nhịp!`, 'success', 2000);
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

          _dragState.active = true;
          _dragState.pointerId = e.pointerId;
          _dragState.targetEl = staveNote;
          _dragState.startY = e.clientY;
          _dragState.startX = e.clientX;
          _dragState.currentStep = curNote.step;
          _dragState.currentOctave = curNote.octave;
          _dragState.currentAlter = curNote.alter;
          _dragState.previewStep = curNote.step;
          _dragState.previewOctave = curNote.octave;

          // Hiển thị overlay nốt bóng
          const overlay = document.getElementById('drag-ghost-overlay');
          const badge = document.getElementById('drag-ghost-badge');
          const line = document.getElementById('drag-guide-line');
          if (overlay && badge && line) {
            overlay.classList.remove('hidden');
            const cRect = container.getBoundingClientRect();
            badge.style.left = `${e.clientX - cRect.left}px`;
            badge.style.top = `${e.clientY - cRect.top}px`;
            badge.textContent = `${curNote.step}${curNote.octave}`;
            line.style.left = `${e.clientX - cRect.left}px`;
            line.style.top = '0';
            line.style.height = '100%';
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
              _dragState.startY = e.clientY;
              _dragState.startX = e.clientX;
              _dragState.currentStep = cur.step;
              _dragState.currentOctave = cur.octave;
              _dragState.currentAlter = cur.alter;
              _dragState.previewStep = cur.step;
              _dragState.previewOctave = cur.octave;

              const overlay = document.getElementById('drag-ghost-overlay');
              const badge = document.getElementById('drag-ghost-badge');
              const line = document.getElementById('drag-guide-line');
              if (overlay && badge && line) {
                overlay.classList.remove('hidden');
                const cRect = container.getBoundingClientRect();
                badge.style.left = `${e.clientX - cRect.left}px`;
                badge.style.top = `${e.clientY - cRect.top}px`;
                badge.textContent = `${cur.step}${cur.octave}`;
                line.style.left = `${e.clientX - cRect.left}px`;
                line.style.top = '0';
                line.style.height = '100%';
              }
            }
          };
          break;
        }
      }
    });

    // Lắng nghe pointermove và pointerup trên window một lần duy nhất
    if (!_hasBoundGlobalDragListeners) {
      _hasBoundGlobalDragListeners = true;

      window.addEventListener('pointermove', (e) => {
        if (!_dragState.active) return;
        e.preventDefault();

        const deltaY = _dragState.startY - e.clientY;
        const stepPixels = Math.max(5, 7 * _zoom);
        const deltaSteps = Math.round(deltaY / stepPixels);

        const diatonicSteps = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
        const currentIdx = _dragState.currentOctave * 7 + diatonicSteps.indexOf(_dragState.currentStep);
        const newIdx = Math.max(14, Math.min(56, currentIdx + deltaSteps)); // C2 to B7

        const newStep = diatonicSteps[((newIdx % 7) + 7) % 7];
        const newOctave = Math.floor(newIdx / 7);

        const badge = document.getElementById('drag-ghost-badge');
        const line = document.getElementById('drag-guide-line');
        const cRect = container.getBoundingClientRect();
        if (badge) {
          badge.style.left = `${e.clientX - cRect.left}px`;
          badge.style.top = `${e.clientY - cRect.top}px`;
          badge.textContent = `${newStep}${newOctave}`;
        }
        if (line) {
          line.style.left = `${e.clientX - cRect.left}px`;
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

        if (_dragState.previewStep && (_dragState.previewStep !== _dragState.currentStep || _dragState.previewOctave !== _dragState.currentOctave)) {
          modifyPitch(_dragState.previewStep, _dragState.previewOctave, _dragState.currentAlter);
        }
      });

      window.addEventListener('pointercancel', () => {
        if (!_dragState.active) return;
        _dragState.active = false;
        document.getElementById('drag-ghost-overlay')?.classList.add('hidden');
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

    // Thao tác Thêm nốt & Sao chép & Xóa hẳn
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

    // Phím tắt bàn phím (Keyboard Shortcuts)
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
        e.preventDefault();
        redo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        openSaveVersionModal();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === '/' || e.key === '?')) {
        e.preventDefault();
        document.getElementById('shortcut-guide-modal')?.classList.toggle('hidden');
        return;
      }
      if (e.key === 'Escape') {
        document.getElementById('shortcut-guide-modal')?.classList.add('hidden');
      }

      // Insert key to insert note after
      if (e.key === 'Insert') {
        e.preventDefault();
        insertNoteAfter();
        return;
      }

      // Hard delete (Shift+Delete) vs Soft delete to rest (Delete)
      if (e.shiftKey && (e.key === 'Delete' || e.key === 'Backspace')) {
        e.preventDefault();
        deleteNoteCompletely();
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteNoteAsRest();
        return;
      }

      if (e.key.toLowerCase() === 't') {
        e.preventDefault();
        toggleTie();
        return;
      }
      if (e.key === ' ') {
        e.preventDefault();
        playSatbChord();
        return;
      }

      // Voice selection shortcuts (1: Soprano, 2: Alto, 3: Tenor, 4: Bass) with instant audio feedback
      if (e.key === '1') {
        _selectedPosition.voice = 'soprano';
        _refreshInspectorUI();
        const cur = _selectedPosition.activeVoiceMap['soprano'];
        if (cur && !cur.isRest) playSinglePitch(cur.step, cur.octave, cur.alter, 0.25);
        return;
      }
      if (e.key === '2') {
        _selectedPosition.voice = 'alto';
        _refreshInspectorUI();
        const cur = _selectedPosition.activeVoiceMap['alto'];
        if (cur && !cur.isRest) playSinglePitch(cur.step, cur.octave, cur.alter, 0.25);
        return;
      }
      if (e.key === '3') {
        _selectedPosition.voice = 'tenor';
        _refreshInspectorUI();
        const cur = _selectedPosition.activeVoiceMap['tenor'];
        if (cur && !cur.isRest) playSinglePitch(cur.step, cur.octave, cur.alter, 0.25);
        return;
      }
      if (e.key === '4') {
        _selectedPosition.voice = 'bass';
        _refreshInspectorUI();
        const cur = _selectedPosition.activeVoiceMap['bass'];
        if (cur && !cur.isRest) playSinglePitch(cur.step, cur.octave, cur.alter, 0.25);
        return;
      }

      // Horizontal navigation: ArrowLeft / ArrowRight
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        _navPrevNote();
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        _navNextNote();
        return;
      }

      // Alt + ArrowUp / ArrowDown for semitone step
      if (e.altKey && e.key === 'ArrowUp') {
        e.preventDefault();
        stepSemitone(1);
        return;
      }
      if (e.altKey && e.key === 'ArrowDown') {
        e.preventDefault();
        stepSemitone(-1);
        return;
      }

      // Shift + ArrowUp / ArrowDown for octave step
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

      // Arrow Up / Down for semitone stepping
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

      // Direct letter key shortcuts (C, D, E, F, G, A, B)
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
    saveVersion: confirmSaveVersion,
    getOsmd: () => _osmd,
    getSvgNoteMap: () => _svgNoteMap,
    getSelectedPosition: () => _selectedPosition,
    getXmlDoc: () => _xmlDoc
  };
})();
