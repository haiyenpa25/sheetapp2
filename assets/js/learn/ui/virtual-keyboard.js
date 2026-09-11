/**
 * learn/ui/virtual-keyboard.js — Stage 4: Virtual Piano Keyboard
 *
 * Render bàn phím Piano ảo với highlight hợp âm hiện tại.
 * Hiển thị: current chord (solid), next chord (outline), 2 tay (LH/RH).
 *
 * Phụ thuộc: Tonal.js (window.Tonal), LEARN_EVENTS, EventBus
 * KHÔNG phụ thuộc vào OSMD hay timing engine.
 */
const VirtualKeyboard = (() => {
  'use strict';

  /* ─── Config ─────────────────────────────────────────────────── */
  const OCTAVES_SHOWN  = 4;   // C2 → B5 (Bao trọn cả tay trái Bass C2-C3 và tay phải Hợp âm C4-C5)
  const FIRST_OCTAVE   = 2;
  const NOTE_NAMES     = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  const WHITE_NOTES    = ['C','D','E','F','G','A','B'];
  const BLACK_NOTES    = ['C#','D#','F#','G#','A#'];

  /* ─── State ──────────────────────────────────────────────────── */
  let _container  = null;
  let _currentChord = null;
  let _nextChord    = null;
  let _rhNotes = []; // Right hand MIDI numbers
  let _lhNotes = []; // Left hand MIDI numbers
  let _nextNotes = [];
  let _keyEls  = new Map(); // noteName+octave → DOM element

  /* ─── Chord → Notes ──────────────────────────────────────────── */

  /**
   * Chord symbol → array of note names (no octave).
   * @param {string} symbol
   * @returns {string[]}
   */
  function _chordNotes(symbol) {
    if (!symbol || !window.Tonal) return [];
    try {
      const chord = Tonal.Chord.get(symbol);
      return chord?.notes ?? [];
    } catch { return []; }
  }

  /**
   * Build RH voicing (root position, octave C3-C5 range).
   * @param {string[]} notes
   * @returns {number[]} MIDI numbers
   */
  function _buildRhVoicing(notes) {
    if (!notes.length) return [];
    if (window.VoicingEngine) {
      const midis = VoicingEngine.pickNearestInversion(notes, 4, 66);
      if (midis && midis.length) return midis;
    }
    return notes.map((n, i) => {
      const midi = Tonal.Note.midi(`${n}4`);
      return midi ?? 60 + i;
    }).filter(Boolean);
  }

  /**
   * Build LH bass note (Octave 2 range C2-B2).
   * @param {string|null} bass  - slash bass note
   * @param {string[]}    notes - chord notes
   * @returns {number[]} MIDI numbers
   */
  function _buildLhVoicing(bass, notes) {
    if (!window.Tonal) return [];
    const bassNote = bass ?? notes[0];
    if (!bassNote) return [];
    const midi = Tonal.Note.midi(`${bassNote}2`);
    return midi ? [midi] : [];
  }

  /**
   * MIDI → note name (e.g. 60 → "C4")
   */
  function _midiToNoteName(midi) {
    const oct = Math.floor(midi / 12) - 1;
    const name = NOTE_NAMES[midi % 12];
    return `${name}${oct}`;
  }

  /* ─── Render ─────────────────────────────────────────────────── */

  function _render() {
    if (!_container) return;
    _container.innerHTML = '';
    _keyEls.clear();

    const wrapper = document.createElement('div');
    wrapper.className = 'vkb-wrapper';

    for (let oct = FIRST_OCTAVE; oct < FIRST_OCTAVE + OCTAVES_SHOWN; oct++) {
      const octaveEl = document.createElement('div');
      octaveEl.className = 'vkb-octave';
      octaveEl.dataset.octave = oct;

      // White keys
      for (const noteName of WHITE_NOTES) {
        const key = _createKey(noteName, oct, false);
        octaveEl.appendChild(key);
      }

      // Black keys (overlaid via CSS position)
      for (const noteName of BLACK_NOTES) {
        const key = _createKey(noteName, oct, true);
        octaveEl.appendChild(key);
      }

      wrapper.appendChild(octaveEl);
    }

    _container.appendChild(wrapper);
    _updateHighlights();
  }

  function _createKey(noteName, oct, isBlack) {
    const el = document.createElement('div');
    el.className = `vkb-key ${isBlack ? 'vkb-black' : 'vkb-white'}`;
    el.dataset.note = noteName;
    el.dataset.octave = oct;
    const keyId = `${noteName}${oct}`;
    el.dataset.keyId = keyId;
    _keyEls.set(keyId, el);

    // Lưu đồng thời tên nốt giáng (Enharmonic flat: Eb = D#, Ab = G#, etc.)
    const flatMap = { 'C#': 'Db', 'D#': 'Eb', 'F#': 'Gb', 'G#': 'Ab', 'A#': 'Bb' };
    if (flatMap[noteName]) {
      _keyEls.set(`${flatMap[noteName]}${oct}`, el);
    }

    // Label C notes
    if (noteName === 'C') {
      const label = document.createElement('span');
      label.className = 'vkb-key-label';
      label.textContent = `C${oct}`;
      el.appendChild(label);
    }

    // Click phát âm thanh piano và đánh giá nốt chính xác
    el.addEventListener('click', () => {
      _playNote(noteName, oct);
    });

    return el;
  }

  /* ─── Highlight ──────────────────────────────────────────────── */
  function _updateHighlights() {
    // Clear all classes and finger badges
    _keyEls.forEach(el => {
      el.classList.remove('vkb-active-rh', 'vkb-active-lh', 'vkb-next');
      const badge = el.querySelector('.vkb-finger-badge');
      if (badge) badge.remove();
    });

    // Mark current chord RH with fingers
    const rhFingers = _rhNotes.length === 3 ? ['1', '3', '5']
                    : (_rhNotes.length === 4 ? ['1', '2', '3', '5']
                    : (_rhNotes.length === 2 ? ['1', '5'] : ['1']));

    _rhNotes.forEach((midi, idx) => {
      const name = _midiToNoteName(midi);
      const el = _keyEls.get(name);
      if (el) {
        el.classList.add('vkb-active-rh');
        const finger = rhFingers[idx];
        if (finger) {
          const badge = document.createElement('span');
          badge.className = 'vkb-finger-badge vkb-finger-rh';
          badge.textContent = finger;
          badge.title = `Ngón tay phải: ${finger}`;
          el.appendChild(badge);
        }
      }
    });

    // Mark current chord LH (Bass) with finger 5
    _lhNotes.forEach(midi => {
      const name = _midiToNoteName(midi);
      const el = _keyEls.get(name);
      if (el) {
        el.classList.add('vkb-active-lh');
        if (!el.querySelector('.vkb-finger-badge')) {
          const badge = document.createElement('span');
          badge.className = 'vkb-finger-badge vkb-finger-lh';
          badge.textContent = '5';
          badge.title = 'Ngón tay trái (Bass): 5';
          el.appendChild(badge);
        }
      }
    });

    // Mark next chord (outline preview)
    for (const midi of _nextNotes) {
      const name = _midiToNoteName(midi);
      const el = _keyEls.get(name);
      if (el && !el.classList.contains('vkb-active-rh') && !el.classList.contains('vkb-active-lh')) {
        el.classList.add('vkb-next');
      }
    }
  }

  /* ─── Play Note (hear on click) ──────────────────────────────── */
  function _playNote(noteName, oct) {
    const fullNote = `${noteName}${oct}`;

    // Nếu đang ở chế độ Luyện Nốt Giai Điệu: Gửi nốt sang MelodyPracticeEngine để chấm điểm
    if (window.MelodyPracticeEngine?.isActive?.()) {
      window.MelodyPracticeEngine.checkPlayedNote(fullNote);
      return;
    }

    // Nếu đang ở chế độ Luyện Hợp Âm
    if (window.ChordJudge?.checkUserNote) {
      window.ChordJudge.checkUserNote(fullNote);
    }

    if (window.LearnSoundEngine) {
      window.LearnSoundEngine.triggerNote('piano', fullNote, 0.5, undefined, 0.85);
      return;
    }
    if (!window.Tone) return;
    try {
      const synth = new Tone.Synth({
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.01, decay: 0.1, sustain: 0.5, release: 0.5 }
      }).toDestination();
      synth.triggerAttackRelease(`${noteName}${oct}`, '8n');
      setTimeout(() => synth.dispose(), 2000);
    } catch (e) { /* ignore */ }
  }

  /* ─── Public API ─────────────────────────────────────────────── */

  /**
   * Mount vào container element.
   * @param {HTMLElement} containerEl
   */
  function mount(containerEl) {
    _container = containerEl;
    _render();
  }

  /**
   * Cập nhật chord hiển thị.
   * @param {import('../learn-interfaces').ChordTimelineEvent|null} chord
   * @param {import('../learn-interfaces').ChordTimelineEvent|null} nextChord
   */
  function setChord(chord, nextChord = null) {
    _currentChord = chord;
    _nextChord = nextChord;

    if (chord?.symbol) {
      const sym = chord.transposedSymbol ?? chord.symbol;
      const notes = _chordNotes(sym);
      _rhNotes = _buildRhVoicing(notes);
      _lhNotes = _buildLhVoicing(chord.bass, notes);
    } else {
      _rhNotes = [];
      _lhNotes = [];
    }

    if (nextChord?.symbol) {
      const sym2 = nextChord.transposedSymbol ?? nextChord.symbol;
      const n2 = _chordNotes(sym2);
      _nextNotes = _buildRhVoicing(n2);
    } else {
      _nextNotes = [];
    }

    _updateHighlights();
  }

  let _userPlayedKeys = new Set();

  function setUserActiveNotes(noteNames = []) {
    // Clear previous user played highlights
    _userPlayedKeys.forEach(keyId => {
      const el = _keyEls.get(keyId);
      if (el) el.classList.remove('vkb-user-played');
    });
    _userPlayedKeys.clear();

    noteNames.forEach(keyId => {
      const el = _keyEls.get(keyId);
      if (el) {
        el.classList.add('vkb-user-played');
        _userPlayedKeys.add(keyId);
      }
    });
  }

  function flashSuccess() {
    if (!_container) return;
    _container.classList.add('vkb-flash-success');
    setTimeout(() => {
      _container?.classList.remove('vkb-flash-success');
    }, 600);
  }

  function flashError() {
    if (!_container) return;
    _container.classList.add('vkb-flash-error');
    setTimeout(() => {
      _container?.classList.remove('vkb-flash-error');
    }, 600);
  }

  let _melodyTargetKey = null;
  let _melodyNextKey = null;

  function setMelodyGuide(currentNote, nextNote = null) {
    // Clear previous melody highlights
    if (_melodyTargetKey) {
      const el = _keyEls.get(_melodyTargetKey);
      if (el) {
        el.classList.remove('vkb-melody-target');
        const b = el.querySelector('.vkb-melody-badge');
        if (b) b.remove();
      }
      _melodyTargetKey = null;
    }
    if (_melodyNextKey) {
      const el = _keyEls.get(_melodyNextKey);
      if (el) el.classList.remove('vkb-melody-next');
      _melodyNextKey = null;
    }

    if (!currentNote) return;

    // Highlight target note with glowing badge
    const targetKey = currentNote.pitchName;
    const targetEl = _keyEls.get(targetKey) || (currentNote.midi ? _keyEls.get(_midiToNoteName(currentNote.midi)) : null);
    if (targetEl) {
      targetEl.classList.add('vkb-melody-target');
      _melodyTargetKey = targetEl.dataset.keyId || targetKey;

      let badge = targetEl.querySelector('.vkb-melody-badge');
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'vkb-melody-badge';
        targetEl.appendChild(badge);
      }
      badge.textContent = currentNote.vietnameseName || currentNote.pitchName;
      badge.title = `Nốt cần đánh: ${currentNote.vietnameseName} (${currentNote.pitchName})`;
    }

    // Outline next note preview
    if (nextNote) {
      const nextKey = nextNote.pitchName;
      const nextEl = _keyEls.get(nextKey) || (nextNote.midi ? _keyEls.get(_midiToNoteName(nextNote.midi)) : null);
      if (nextEl && nextEl !== targetEl) {
        nextEl.classList.add('vkb-melody-next');
        _melodyNextKey = nextEl.dataset.keyId || nextKey;
      }
    }
  }

  function flashNoteHit(noteName, isCorrect = true) {
    let el = _keyEls.get(noteName);
    if (!el && window.Tonal && typeof noteName === 'string') {
      const midi = Tonal.Note.midi(noteName);
      if (midi != null) el = _keyEls.get(_midiToNoteName(midi));
    }
    if (el) {
      const cls = isCorrect ? 'vkb-hit-success' : 'vkb-hit-wrong';
      el.classList.add(cls);
      setTimeout(() => el.classList.remove(cls), 500);
    }
    if (isCorrect) flashSuccess();
    else flashError();
  }

  function clear() {
    setChord(null, null);
    setMelodyGuide(null, null);
    setUserActiveNotes([]);
  }

  function destroy() {
    clear();
    if (_container) _container.innerHTML = '';
    _container = null;
  }

  return { 
    mount, 
    setChord, 
    setMelodyGuide,
    flashNoteHit,
    clear, 
    destroy,
    setUserActiveNotes,
    flashSuccess,
    flashError
  };
})();

if (typeof window !== 'undefined') {
  window.VirtualKeyboard = VirtualKeyboard;
}
