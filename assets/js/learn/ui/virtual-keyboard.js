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
  const OCTAVES_SHOWN  = 4;   // C3 → B6
  const FIRST_OCTAVE   = 3;
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
    return notes.map((n, i) => {
      const midi = Tonal.Note.midi(`${n}4`);
      return midi ?? 60 + i;
    }).filter(Boolean);
  }

  /**
   * Build LH bass note.
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

    // Legend
    const legend = document.createElement('div');
    legend.className = 'vkb-legend';
    legend.innerHTML = `
      <span class="vkb-legend-rh">■ Tay phải</span>
      <span class="vkb-legend-lh">■ Tay trái</span>
      <span class="vkb-legend-next">□ Tiếp theo</span>
    `;
    _container.appendChild(legend);

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

    // Label C notes
    if (noteName === 'C') {
      const label = document.createElement('span');
      label.className = 'vkb-key-label';
      label.textContent = `C${oct}`;
      el.appendChild(label);
    }

    // Click to hear
    el.addEventListener('click', () => _playNote(noteName, oct));

    return el;
  }

  /* ─── Highlight ──────────────────────────────────────────────── */
  function _updateHighlights() {
    // Clear all
    _keyEls.forEach(el => {
      el.classList.remove('vkb-active-rh', 'vkb-active-lh', 'vkb-next');
    });

    // Mark current chord
    const markMidi = (midiList, cls) => {
      for (const midi of midiList) {
        const name = _midiToNoteName(midi);
        const el = _keyEls.get(name);
        if (el) el.classList.add(cls);
      }
    };

    markMidi(_rhNotes, 'vkb-active-rh');
    markMidi(_lhNotes, 'vkb-active-lh');
    markMidi(_nextNotes, 'vkb-next');
  }

  /* ─── Play Note (hear on click) ──────────────────────────────── */
  function _playNote(noteName, oct) {
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

  function clear() {
    _rhNotes = []; _lhNotes = []; _nextNotes = [];
    _updateHighlights();
  }

  function destroy() {
    if (_container) _container.innerHTML = '';
    _keyEls.clear();
    _container = null;
  }

  return { mount, setChord, clear, destroy };
})();

if (typeof window !== 'undefined') {
  window.VirtualKeyboard = VirtualKeyboard;
}
