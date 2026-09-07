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
      soprano: sopranoNote ? _parseNoteData(sopranoNote, 'soprano') : null,
      alto:    altoNote ? _parseNoteData(altoNote, 'alto') : null,
      tenor:   tenorNote ? _parseNoteData(tenorNote, 'tenor') : null,
      bass:    bassNote ? _parseNoteData(bassNote, 'bass') : null
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
    const groups = [];
    let currentChord = [];
    const noteEls = measureEl.querySelectorAll('note');
    noteEls.forEach(noteEl => {
      const isChord = noteEl.querySelector('chord') !== null;
      if (!isChord) {
        if (currentChord.length > 0) groups.push(currentChord);
        currentChord = [noteEl];
      } else {
        currentChord.push(noteEl);
      }
    });
    if (currentChord.length > 0) groups.push(currentChord);
    return groups;
  }

  function _pitchValue(noteEl) {
    const stepEl = noteEl.querySelector('pitch > step');
    const octEl  = noteEl.querySelector('pitch > octave');
    const altEl  = noteEl.querySelector('pitch > alter');
    if (!stepEl || !octEl) return 0;
    return _pitchToMidi(stepEl.textContent.trim(), octEl.textContent.trim(), altEl ? altEl.textContent.trim() : 0);
  }

  function _parseNoteData(noteEl, voiceName) {
    const isRest = noteEl.querySelector('rest') !== null;
    const stepEl = noteEl.querySelector('pitch > step');
    const octEl  = noteEl.querySelector('pitch > octave');
    const altEl  = noteEl.querySelector('pitch > alter');
    const typeEl = noteEl.querySelector('type');
    const dotEl  = noteEl.querySelector('dot') !== null;
    const durEl  = noteEl.querySelector('duration');
    const lyricEl= noteEl.querySelector('lyric > text');
    const tieEl  = noteEl.querySelector('tie') || noteEl.querySelector('tied');
    const slurEl = noteEl.querySelector('slur');
    const fermataEl = noteEl.querySelector('fermata');
    const tupletEl  = noteEl.querySelector('time-modification');

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
      isTuplet: !!tupletEl
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

    // Dot
    document.getElementById('btn-pal-dot')?.classList.toggle('active', !!curNote.isDot);
    document.getElementById('btn-pal-tie')?.classList.toggle('active', !!curNote.isTie);
    document.getElementById('btn-pal-slur')?.classList.toggle('active', !!curNote.isSlur);
    document.getElementById('btn-pal-fermata')?.classList.toggle('active', !!curNote.isFermata);
    document.getElementById('btn-pal-tuplet')?.classList.toggle('active', !!curNote.isTuplet);

    // Lyric
    const lyricInput = document.getElementById('input-note-lyric');
    if (lyricInput && document.activeElement !== lyricInput) {
      lyricInput.value = curNote.lyric || '';
    }

    // Mini piano highlight
    _highlightPianoKey(curNote.step, curNote.octave, curNote.alter);
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

    const targetOct = newOctave !== null ? newOctave : curNote.octave;
    let octEl = pitchEl.querySelector('octave');
    if (!octEl) {
      octEl = _xmlDoc.createElement('octave');
      pitchEl.appendChild(octEl);
    }
    octEl.textContent = String(targetOct);

    const targetAlt = newAlter !== null ? newAlter : curNote.alter;
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
  function _wireVerticalDragEvents() {
    const container = document.getElementById('osmd-editor-container');
    if (!container) return;

    const noteGroups = container.querySelectorAll('svg g.vf-stavenote');
    noteGroups.forEach(staveNote => {
      staveNote.style.cursor = 'ns-resize';

      staveNote.onpointerdown = (e) => {
        e.preventDefault();
        e.stopPropagation();

        _dragState.active = true;
        _dragState.pointerId = e.pointerId;
        _dragState.targetEl = staveNote;
        _dragState.startY = e.clientY;
        _dragState.startX = e.clientX;

        // Bỏ chọn các nốt khác
        noteGroups.forEach(n => n.classList.remove('selected-note-item'));
        staveNote.classList.add('selected-note-item');

        // Tìm số ô nhịp
        const measureGroup = staveNote.closest('g[id^="measure_"]') || staveNote.closest('g.vf-measure');
        if (measureGroup) {
          const mMatch = measureGroup.id ? measureGroup.id.match(/\d+/) : null;
          if (mMatch) _selectedPosition.measureNumber = parseInt(mMatch[0], 10);
        }

        _refreshInspectorUI();

        const curNote = _selectedPosition.activeVoiceMap[_selectedPosition.voice];
        if (curNote && !curNote.isRest) {
          _dragState.currentStep = curNote.step;
          _dragState.currentOctave = curNote.octave;
          _dragState.currentAlter = curNote.alter;
          _dragState.baseMidi = _pitchToMidi(curNote.step, curNote.octave, curNote.alter);

          // Hiển thị overlay nốt bóng
          const overlay = document.getElementById('drag-ghost-overlay');
          const badge = document.getElementById('drag-ghost-badge');
          const line = document.getElementById('drag-guide-line');
          if (overlay && badge && line) {
            overlay.classList.remove('hidden');
            const rect = container.getBoundingClientRect();
            badge.style.left = `${e.clientX - rect.left}px`;
            badge.style.top = `${e.clientY - rect.top}px`;
            badge.textContent = `${curNote.step}${curNote.octave}`;
            line.style.left = `${e.clientX - rect.left}px`;
            line.style.top = '0';
            line.style.height = '100%';
          }
        }

        try {
          staveNote.setPointerCapture(e.pointerId);
        } catch (err) {}
      };

      staveNote.onpointermove = (e) => {
        if (!_dragState.active) return;
        e.preventDefault();

        const deltaY = _dragState.startY - e.clientY;
        const stepPixels = Math.max(4, 6 * _zoom);
        const deltaSteps = Math.round(deltaY / stepPixels);

        const diatonicSteps = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
        const currentIdx = _dragState.currentOctave * 7 + diatonicSteps.indexOf(_dragState.currentStep);
        const newIdx = Math.max(14, Math.min(56, currentIdx + deltaSteps)); // C2 to B7

        const newStep = diatonicSteps[((newIdx % 7) + 7) % 7];
        const newOctave = Math.floor(newIdx / 7);

        // Cập nhật nhãn nổi
        const rect = container.getBoundingClientRect();
        const badge = document.getElementById('drag-ghost-badge');
        if (badge) {
          badge.style.top = `${e.clientY - rect.top}px`;
          badge.textContent = `${newStep}${newOctave}`;
        }

        // Phát âm thanh nếu đổi cao độ
        if (newStep !== _dragState.previewStep || newOctave !== _dragState.previewOctave) {
          _dragState.previewStep = newStep;
          _dragState.previewOctave = newOctave;
          playSinglePitch(newStep, newOctave, _dragState.currentAlter, 0.2);
        }
      };

      staveNote.onpointerup = (e) => {
        if (!_dragState.active) return;
        _dragState.active = false;

        document.getElementById('drag-ghost-overlay')?.classList.add('hidden');

        if (_dragState.previewStep && (_dragState.previewStep !== _dragState.currentStep || _dragState.previewOctave !== _dragState.currentOctave)) {
          modifyPitch(_dragState.previewStep, _dragState.previewOctave, _dragState.currentAlter);
        }

        try {
          staveNote.releasePointerCapture(e.pointerId);
        } catch (err) {}
      };

      staveNote.onpointercancel = staveNote.onpointerup;
    });
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

        if (!item.isBlack && item.step === 'C') {
          const span = document.createElement('span');
          span.textContent = `C${oct}`;
          key.appendChild(span);
        }

        key.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          key.classList.add('active');
          modifyPitch(item.step, oct, item.alter || 0);
        });
        key.addEventListener('pointerup', () => key.classList.remove('active'));
        key.addEventListener('pointerleave', () => key.classList.remove('active'));

        container.appendChild(key);
      });
    });
  }

  function _highlightPianoKey(step, octave, alter = 0) {
    document.querySelectorAll('.piano-key').forEach(k => {
      const match = k.dataset.step === step &&
                    parseInt(k.dataset.octave, 10) === octave &&
                    parseInt(k.dataset.alter, 10) === alter;
      k.classList.toggle('active', match);
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
      const songId = params.get('song');
      if (songId) {
        const found = _songsList.find(s => String(s.id) === String(songId));
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
    document.getElementById('btn-pal-tuplet')?.addEventListener('click', toggleTuplet);
    document.getElementById('btn-pal-fermata')?.addEventListener('click', toggleFermata);
    document.getElementById('btn-pal-delete-rest')?.addEventListener('click', deleteNoteAsRest);
    document.getElementById('btn-pal-split-note')?.addEventListener('click', splitCurrentNote);

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
    document.getElementById('btn-nav-prev-note')?.addEventListener('click', () => {
      if (_selectedPosition.beatIndex > 0) {
        _selectedPosition.beatIndex--;
      } else if (_selectedPosition.measureNumber > 1) {
        _selectedPosition.measureNumber--;
        _selectedPosition.beatIndex = 0;
      }
      _refreshInspectorUI();
    });
    document.getElementById('btn-nav-next-note')?.addEventListener('click', () => {
      _selectedPosition.beatIndex++;
      _refreshInspectorUI();
    });
    document.getElementById('btn-play-single')?.addEventListener('click', () => {
      const cur = _selectedPosition.activeVoiceMap[_selectedPosition.voice];
      if (cur && !cur.isRest) playSinglePitch(cur.step, cur.octave, cur.alter);
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
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteNoteAsRest();
      }
      if (e.key.toLowerCase() === 't') {
        e.preventDefault();
        toggleTie();
      }
      if (e.key === ' ') {
        e.preventDefault();
        playSatbChord();
      }
      if (e.key === '1') { _selectedPosition.voice = 'soprano'; _refreshInspectorUI(); }
      if (e.key === '2') { _selectedPosition.voice = 'alto';    _refreshInspectorUI(); }
      if (e.key === '3') { _selectedPosition.voice = 'tenor';   _refreshInspectorUI(); }
      if (e.key === '4') { _selectedPosition.voice = 'bass';    _refreshInspectorUI(); }

      // Arrow Up / Down for pitch
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        const cur = _selectedPosition.activeVoiceMap[_selectedPosition.voice];
        if (cur && !cur.isRest) {
          const newMidi = _pitchToMidi(cur.step, cur.octave, cur.alter) + 1;
          const steps = ['C', 'C', 'D', 'D', 'E', 'F', 'F', 'G', 'G', 'A', 'A', 'B'];
          modifyPitch(steps[newMidi % 12], Math.floor(newMidi / 12) - 1, [1,3,6,8,10].includes(newMidi % 12) ? 1 : 0);
        }
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const cur = _selectedPosition.activeVoiceMap[_selectedPosition.voice];
        if (cur && !cur.isRest) {
          const newMidi = _pitchToMidi(cur.step, cur.octave, cur.alter) - 1;
          const steps = ['C', 'C', 'D', 'D', 'E', 'F', 'F', 'G', 'G', 'A', 'A', 'B'];
          modifyPitch(steps[newMidi % 12], Math.floor(newMidi / 12) - 1, [1,3,6,8,10].includes(newMidi % 12) ? 1 : 0);
        }
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
    saveVersion: confirmSaveVersion
  };
})();
