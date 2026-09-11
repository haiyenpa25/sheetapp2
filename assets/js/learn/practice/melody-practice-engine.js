/**
 * assets/js/learn/practice/melody-practice-engine.js
 * Chuyên trách Chế Độ Tập Nốt Giai Điệu Bài Hát (Melody Solo / Giọng 1 Khoá Sol)
 *
 * Tính năng chính:
 * 1. Trích xuất nốt giai điệu (Voice 1 / Khoá Sol / Soprano) trực tiếp từ MusicXML
 * 2. Tự động chuyển tông (Transpose-aware) chuẩn xác 100%
 * 3. Quản lý vị trí nốt hiện tại (targetNote), nốt tiếp theo (nextNote), ca từ (lyrics)
 * 4. Chế độ Chờ Đánh Đúng Nốt (Wait-for-Note): Tạm dừng cho đến khi học viên bấm đúng phím
 * 5. So khớp nốt (Note Matcher): Cho phép bấm đúng nốt hoặc đúng quãng 8 (từ MIDI hoặc bàn phím ảo)
 * 6. Phản hồi âm thanh & thị giác: Đánh đúng -> Piano vang lên + xanh lá + con trỏ nhảy tiếp; Đánh sai -> phím đỏ nhẹ
 * 7. Đồng bộ con trỏ OSMD theo từng nốt nhạc trên khuông nhạc
 *
 * Expose: window.MelodyPracticeEngine
 */
const MelodyPracticeEngine = (() => {
  'use strict';

  const STEP_TO_VIETNAMESE = {
    'C': 'Đô',
    'D': 'Rê',
    'E': 'Mi',
    'F': 'Fa',
    'G': 'Sol',
    'A': 'La',
    'B': 'Si'
  };

  const NOTE_TO_MIDI_BASE = {
    'C': 0, 'C#': 1, 'Db': 1,
    'D': 2, 'D#': 3, 'Eb': 3,
    'E': 4,
    'F': 5, 'F#': 6, 'Gb': 6,
    'G': 7, 'G#': 8, 'Ab': 8,
    'A': 9, 'A#': 10, 'Bb': 10,
    'B': 11
  };

  let _melodyNotes = [];        // Danh sách toàn bộ nốt giai điệu đã lọc (không tính nốt nghỉ)
  let _currentIdx = 0;          // Chỉ mục nốt hiện tại đang luyện
  let _isActive = false;        // Đang ở chế độ Melody Practice hay không
  let _isWaitMode = true;       // Chờ người học bấm đúng nốt mới chạy tiếp
  let _transpose = 0;           // Độ dịch tông hiện tại
  let _osmd = null;             // Tham chiếu OSMD instance
  let _hitScore = { correct: 0, wrong: 0, streak: 0 };

  /**
   * Tính toán MIDI note number từ step, alter, octave
   */
  function _calcMidi(step, alter = 0, octave = 4) {
    const base = NOTE_TO_MIDI_BASE[step] ?? 0;
    return 12 * (octave + 1) + base + alter;
  }

  /**
   * Tạo tên nốt tiếng Việt (VD: Sol4, Fa#4, Mi♭4)
   */
  function _toVietnamese(step, alter = 0, octave = 4) {
    const base = STEP_TO_VIETNAMESE[step] || step;
    let acc = '';
    if (alter > 0) acc = '#'.repeat(alter);
    else if (alter < 0) acc = '♭'.repeat(Math.abs(alter));
    return `${base}${acc}${octave}`;
  }

  /**
   * Tạo tên nốt quốc tế (VD: G4, F#4, Eb4)
   */
  function _toPitchName(step, alter = 0, octave = 4) {
    let acc = '';
    if (alter > 0) acc = '#'.repeat(alter);
    else if (alter < 0) acc = 'b'.repeat(Math.abs(alter));
    return `${step}${acc}${octave}`;
  }

  /**
   * Trích xuất toàn bộ nốt giai điệu giọng 1 từ XML Document
   * @param {Document} xmlDoc
   * @param {number} transpose
   */
  function extractFromXml(xmlDoc, transpose = 0) {
    _melodyNotes = [];
    _currentIdx = 0;
    _transpose = transpose;
    _hitScore = { correct: 0, wrong: 0, streak: 0 };

    if (!xmlDoc) return _melodyNotes;

    try {
      const measures = xmlDoc.querySelectorAll('measure');
      let globalNoteIdx = 0;

      measures.forEach((measureEl, mIdx) => {
        const measureNo = parseInt(measureEl.getAttribute('number') || (mIdx + 1), 10);
        const notes = Array.from(measureEl.querySelectorAll('note'));

        // Gom các note thành từng cụm nốt đồng thời (Chord clusters)
        // Trong MusicXML bè thánh ca/hợp xướng, Soprano (giai điệu chính) và Alto (bè hai)
        // thường nằm chung Voice 1 ở Staff 1. Note đầu là bè trầm, note có <chord/> là bè cao (Soprano).
        const clusters = [];
        let currentCluster = [];

        notes.forEach(noteEl => {
          // Lọc chỉ lấy staff 1 (khoá Sol) và voice 1 (bè chính)
          const staffEl = noteEl.querySelector('staff');
          const staffVal = staffEl ? staffEl.textContent.trim() : '1';
          const voiceEl = noteEl.querySelector('voice');
          const voiceVal = voiceEl ? voiceEl.textContent.trim() : '1';

          // Bỏ qua nếu là bè khoá Fa (staff 2) hoặc phụ bè voice 2
          if (staffVal !== '1' || voiceVal !== '1') return;

          const isChord = noteEl.querySelector('chord') !== null;
          if (!isChord) {
            if (currentCluster.length > 0) {
              clusters.push(currentCluster);
            }
            currentCluster = [noteEl];
          } else {
            currentCluster.push(noteEl);
          }
        });
        if (currentCluster.length > 0) {
          clusters.push(currentCluster);
        }

        // Xử lý từng cụm nốt: lấy nốt cao nhất (Soprano / Giai điệu chính)
        clusters.forEach(cluster => {
          let lyric = '';
          const pitchedNotes = [];

          cluster.forEach(noteEl => {
            // Lấy ca từ (lyrics) từ bất kỳ note nào trong cụm có chứa lời ca
            if (!lyric) {
              const lyricEl = noteEl.querySelector('lyric text');
              if (lyricEl) lyric = lyricEl.textContent.trim();
            }

            // Bỏ qua nốt nghỉ
            if (noteEl.querySelector('rest')) return;

            const pitchEl = noteEl.querySelector('pitch');
            if (!pitchEl) return;

            const step = pitchEl.querySelector('step')?.textContent.trim().toUpperCase() || 'C';
            const alter = parseInt(pitchEl.querySelector('alter')?.textContent.trim() || '0', 10);
            const octave = parseInt(pitchEl.querySelector('octave')?.textContent.trim() || '4', 10);
            const origMidi = _calcMidi(step, alter, octave);

            pitchedNotes.push({
              step,
              alter,
              octave,
              origMidi
            });
          });

          if (pitchedNotes.length === 0) return;

          // Luôn lấy nốt có cao độ cao nhất (Max MIDI) trong cụm - đây chính là Giai Điệu (Soprano)
          const topNote = pitchedNotes.reduce((max, n) => (n.origMidi > max.origMidi ? n : max), pitchedNotes[0]);

          const transMidi = topNote.origMidi + _transpose;

          // Tính pitch name sau khi transpose
          let effPitch = _toPitchName(topNote.step, topNote.alter, topNote.octave);
          let effVietnamese = _toVietnamese(topNote.step, topNote.alter, topNote.octave);
          if (window.Tonal && _transpose !== 0) {
            try {
              effPitch = Tonal.Note.fromMidi(transMidi) || effPitch;
              const parsed = Tonal.Note.get(effPitch);
              if (parsed && parsed.letter) {
                effVietnamese = _toVietnamese(parsed.letter, parsed.alt, parsed.oct);
              }
            } catch (e) {}
          }

          _melodyNotes.push({
            id: `m${measureNo}_n${globalNoteIdx++}`,
            measureIndex: mIdx,
            measureNo,
            step: topNote.step,
            alter: topNote.alter,
            octave: topNote.octave,
            origMidi: topNote.origMidi,
            midi: transMidi,
            pitchName: effPitch,
            vietnameseName: effVietnamese,
            pitchClass: transMidi % 12,
            lyric
          });
        });
      });
    } catch (err) {
      console.warn('[MelodyPracticeEngine] Lỗi trích xuất nốt giai điệu:', err);
    }

    _updateUIHUD();
    _updateKeyboardGuide();
    return _melodyNotes;
  }

  /**
   * Cập nhật hiển thị nốt dẫn đường trên Bàn phím ảo
   */
  function _updateKeyboardGuide() {
    if (!_isActive || !_melodyNotes.length) return;

    const currentNote = _melodyNotes[_currentIdx] || null;
    const nextNote = _melodyNotes[_currentIdx + 1] || null;

    if (window.VirtualKeyboard?.setMelodyGuide) {
      VirtualKeyboard.setMelodyGuide(currentNote, nextNote);
    }
  }

  /**
   * Cập nhật thông tin HUD nốt trên thanh giao diện
   */
  function _updateUIHUD() {
    const curVn = document.getElementById('melody-vn-cur');
    const curIntl = document.getElementById('melody-intl-cur');
    const nextVn = document.getElementById('melody-vn-next');
    const nextIntl = document.getElementById('melody-intl-next');
    const lyricEl = document.getElementById('melody-hud-lyric');
    const statusEl = document.getElementById('melody-hud-status');
    const counterEl = document.getElementById('melody-hud-counter');

    // Side panel stats
    const statTotal = document.getElementById('melody-stat-total');
    const statAccuracy = document.getElementById('melody-stat-accuracy');
    const statHits = document.getElementById('melody-stat-hits');

    if (statTotal) statTotal.textContent = _melodyNotes.length;
    if (statHits) statHits.textContent = _hitScore.correct;
    if (statAccuracy) {
      const totalAttempts = _hitScore.correct + _hitScore.wrong;
      const pct = totalAttempts > 0 ? Math.round((_hitScore.correct / totalAttempts) * 100) : 100;
      statAccuracy.textContent = `${pct}%`;
    }

    if (!curVn) return;

    if (!_isActive || !_melodyNotes.length) {
      curVn.textContent = '--';
      if (curIntl) curIntl.textContent = '';
      if (nextVn) nextVn.textContent = '--';
      if (nextIntl) nextIntl.textContent = '';
      if (lyricEl) lyricEl.textContent = 'Chọn chế độ Giai điệu để bắt đầu...';
      if (counterEl) counterEl.textContent = '0 / 0';
      if (statusEl) {
        statusEl.textContent = 'Chưa bật';
        statusEl.className = 'melody-status-chip';
      }
      return;
    }

    const currentNote = _melodyNotes[_currentIdx];
    const nextNote = _melodyNotes[_currentIdx + 1];

    if (currentNote) {
      curVn.textContent = currentNote.vietnameseName;
      if (curIntl) curIntl.textContent = currentNote.pitchName;
      if (lyricEl) {
        lyricEl.textContent = currentNote.lyric ? `"${currentNote.lyric}"` : `Ô nhịp ${currentNote.measureNo}`;
      }
      if (statusEl) {
        statusEl.textContent = `Chờ ${currentNote.vietnameseName}`;
        statusEl.className = 'melody-status-chip';
      }
    } else {
      curVn.textContent = 'Xong!';
      if (curIntl) curIntl.textContent = '✓';
      if (lyricEl) lyricEl.textContent = 'Chúc mừng! Bạn đã hoàn thành toàn bộ giai điệu!';
      if (statusEl) {
        statusEl.textContent = 'Hoàn thành';
        statusEl.className = 'melody-status-chip correct';
      }
    }

    if (nextNote) {
      if (nextVn) nextVn.textContent = nextNote.vietnameseName;
      if (nextIntl) nextIntl.textContent = nextNote.pitchName;
    } else {
      if (nextVn) nextVn.textContent = 'Hết';
      if (nextIntl) nextIntl.textContent = '';
    }

    if (counterEl) {
      counterEl.textContent = `${Math.min(_currentIdx + 1, _melodyNotes.length)} / ${_melodyNotes.length}`;
    }
  }

  /**
   * Di chuyển con trỏ OSMD đến đúng nốt hiện tại
   */
  function _syncOsmdCursor() {
    if (!_osmd?.cursor || !_melodyNotes.length) return;
    const targetNote = _melodyNotes[_currentIdx];
    if (!targetNote) return;

    try {
      if (_osmd.cursor.isHidden) _osmd.cursor.show();

      const iterator = _osmd.cursor.iterator;
      if (iterator) {
        let safetyLoop = 0;
        while (iterator.currentMeasureIndex < targetNote.measureIndex && !iterator.EndReached && safetyLoop < 500) {
          _osmd.cursor.next();
          safetyLoop++;
        }
      }

      if (_osmd.cursor.cursorElement) {
        const rect = _osmd.cursor.cursorElement.getBoundingClientRect();
        const scoreWrapper = document.getElementById('learn-score-container');
        if (scoreWrapper && (rect.top < 100 || rect.bottom > window.innerHeight - 200)) {
          _osmd.cursor.cursorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    } catch (e) {
      console.warn('[MelodyPracticeEngine] Lỗi đồng bộ cursor OSMD:', e);
    }
  }

  let _lastCheckTime = 0;
  let _lastCheckedNote = '';

  /**
   * So khớp nốt học viên vừa đánh (từ Bàn phím ảo hoặc thiết bị MIDI cắm ngoài)
   * @param {string|number} inputNote - Ký hiệu nốt (vd: 'G4', 'E4') hoặc số MIDI
   * @returns {boolean} true nếu đánh đúng nốt mục tiêu
   */
  function checkPlayedNote(inputNote) {
    if (!_isActive || !_melodyNotes.length) return false;

    // Chống dội phím / double-trigger trong 60ms
    const now = Date.now();
    const noteKey = String(inputNote);
    if (noteKey === _lastCheckedNote && (now - _lastCheckTime) < 60) {
      return false;
    }
    _lastCheckTime = now;
    _lastCheckedNote = noteKey;

    const targetNote = _melodyNotes[_currentIdx];
    if (!targetNote) return false;

    let playedMidi = 0;
    let playedPitchName = '';

    if (typeof inputNote === 'number') {
      playedMidi = inputNote;
      playedPitchName = window.Tonal ? Tonal.Note.fromMidi(playedMidi) : '';
    } else {
      playedPitchName = String(inputNote).trim();
      playedMidi = window.Tonal ? Tonal.Note.midi(playedPitchName) : _calcMidi(playedPitchName[0], 0, 4);
    }

    const playedPitchClass = playedMidi % 12;
    const targetPitchClass = targetNote.pitchClass;

    const isExactMatch = (playedMidi === targetNote.midi);
    const isPitchClassMatch = (playedPitchClass === targetPitchClass);

    if (isPitchClassMatch) {
      // ĐÁNH ĐÚNG NỐT!
      _hitScore.correct++;
      _hitScore.streak++;

      // Phát âm thanh piano vang trong trẻo
      if (window.LearnSoundEngine) {
        const soundPitch = isExactMatch ? targetNote.pitchName : (playedPitchName || targetNote.pitchName);
        LearnSoundEngine.triggerNote('piano', soundPitch, 0.6, undefined, 0.9, 'right');
      }

      // Hiệu ứng phím sáng rực xanh lá
      if (window.VirtualKeyboard?.flashNoteHit) {
        VirtualKeyboard.flashNoteHit(targetNote.pitchName, true);
      }

      // Hiệu ứng Toast / HUD nhỏ
      const hudMsg = document.getElementById('melody-hit-feedback');
      if (hudMsg) {
        hudMsg.textContent = isExactMatch ? '✨ Chính xác!' : '✓ Đúng nốt!';
        hudMsg.className = 'melody-hit-feedback hit-perfect';
        setTimeout(() => hudMsg.className = 'melody-hit-feedback hidden', 500);
      }

      // Tự động chuyển sang nốt kế tiếp
      _currentIdx++;
      if (_currentIdx < _melodyNotes.length) {
        _updateUIHUD();
        _updateKeyboardGuide();
        _syncOsmdCursor();
      } else {
        _onCompletedMelody();
      }

      return true;
    } else {
      // ĐÁNH SAI NỐT
      _hitScore.wrong++;
      _hitScore.streak = 0;

      // Phát âm thanh chân thực của nốt vừa đánh (để học viên biết mình bấm nhầm nốt gì)
      if (window.LearnSoundEngine && playedPitchName) {
        LearnSoundEngine.triggerNote('piano', playedPitchName, 0.45, undefined, 0.72, 'right');
      }

      // Cập nhật thống kê và HUD
      _updateUIHUD();
      const statusEl = document.getElementById('melody-hud-status');
      if (statusEl) {
        statusEl.textContent = `Thử lại (${targetNote.vietnameseName})`;
        statusEl.className = 'melody-status-chip wrong';
      }

      // Phím rung nhẹ đỏ
      if (window.VirtualKeyboard?.flashNoteHit) {
        VirtualKeyboard.flashNoteHit(playedPitchName || 'C4', false);
      }

      return false;
    }
  }

  function _onCompletedMelody() {
    _updateUIHUD();
    if (window.VirtualKeyboard?.setMelodyGuide) {
      VirtualKeyboard.setMelodyGuide(null, null);
    }
    window.App?.showToast?.('🎉 Chúc mừng bạn đã hoàn thành trọn vẹn giai điệu bài hát!', 'success');
  }

  /**
   * Kích hoạt hoặc chuyển chế độ Melody Practice
   * @param {boolean} active
   * @param {OSMD} osmdInstance
   */
  function setActive(active, osmdInstance = null) {
    _isActive = !!active;
    if (osmdInstance) _osmd = osmdInstance;

    const panel = document.getElementById('learn-melody-card');
    const hudBar = document.getElementById('learn-melody-hud-bar');

    if (_isActive) {
      panel?.classList.remove('hidden');
      hudBar?.classList.remove('hidden');
      document.body.classList.add('mode-melody-active');
      _currentIdx = 0;
      _updateUIHUD();
      _updateKeyboardGuide();
      _syncOsmdCursor();
    } else {
      panel?.classList.add('hidden');
      hudBar?.classList.add('hidden');
      document.body.classList.remove('mode-melody-active');
      if (window.VirtualKeyboard?.setMelodyGuide) {
        VirtualKeyboard.setMelodyGuide(null, null);
      }
    }
  }

  function reset() {
    _currentIdx = 0;
    _hitScore = { correct: 0, wrong: 0, streak: 0 };
    _updateUIHUD();
    _updateKeyboardGuide();
    _syncOsmdCursor();
  }

  function nextNote() {
    if (_currentIdx < _melodyNotes.length - 1) {
      _currentIdx++;
      _updateUIHUD();
      _updateKeyboardGuide();
      _syncOsmdCursor();
    }
  }

  function prevNote() {
    if (_currentIdx > 0) {
      _currentIdx--;
      _updateUIHUD();
      _updateKeyboardGuide();
      _syncOsmdCursor();
    }
  }

  return {
    extractFromXml,
    checkPlayedNote,
    setActive,
    reset,
    nextNote,
    prevNote,
    isActive: () => _isActive,
    isWaitMode: () => _isWaitMode,
    setWaitMode: (val) => { _isWaitMode = !!val; },
    getMelodyNotes: () => _melodyNotes,
    getCurrentNote: () => _melodyNotes[_currentIdx] || null,
    getNextNote: () => _melodyNotes[_currentIdx + 1] || null,
    getScore: () => ({ ..._hitScore })
  };
})();

if (typeof window !== 'undefined') {
  window.MelodyPracticeEngine = MelodyPracticeEngine;
}
