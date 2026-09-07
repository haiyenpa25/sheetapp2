/**
 * learn/ui/chord-card.js — Stage 2: Chord Info Panel
 *
 * Hiển thị hợp âm hiện tại: symbol, notes, thế đảo, bass, next chord.
 * Sử dụng Tonal.js để tính toán nhạc lý.
 *
 * Phụ thuộc: Tonal.js, LEARN_EVENTS, EventBus, VirtualKeyboard
 */
const ChordCard = (() => {
  'use strict';

  /* ─── State ──────────────────────────────────────────────────── */
  let _container = null;
  let _currentChord = null;
  let _nextChord    = null;

  /* ─── Chord Theory Helpers ───────────────────────────────────── */
  function _getChordInfo(symbol) {
    if (!symbol || !window.Tonal) return null;
    try {
      const chord = Tonal.Chord.get(symbol);
      if (!chord?.notes?.length) return null;
      return {
        name:   chord.name || symbol,
        notes:  chord.notes,
        root:   chord.root,
        type:   chord.type,
        bass:   chord.bass || chord.root,
      };
    } catch { return null; }
  }

  function _buildInversions(notes) {
    if (!notes?.length) return [];
    const inversions = [];
    for (let i = 0; i < notes.length; i++) {
      const inv = [...notes.slice(i), ...notes.slice(0, i)];
      inversions.push(inv);
    }
    return inversions;
  }

  /* ─── Render ─────────────────────────────────────────────────── */
  function _render() {
    if (!_container) return;

    const chord = _currentChord;
    const next  = _nextChord;

    if (!chord) {
      _container.innerHTML = `
        <div class="chord-card chord-card--empty">
          <div class="chord-card-placeholder">🎵 Chọn bài và nhấn Play</div>
        </div>`;
      return;
    }

    const sym     = chord.transposedSymbol ?? chord.symbol;
    const info    = _getChordInfo(sym);
    const invs    = info ? _buildInversions(info.notes) : [];
    const notesStr = info ? info.notes.join(' — ') : sym;
    const bassStr  = chord.bass ?? (info?.bass ?? info?.root ?? '');

    // Next chord
    const nextSym   = next ? (next.transposedSymbol ?? next.symbol) : null;
    const nextInfo  = nextSym ? _getChordInfo(nextSym) : null;

    _container.innerHTML = `
      <div class="chord-card">
        <div class="chord-card-main">
          <div class="chord-symbol">${sym || '—'}</div>
          ${info?.name && info.name !== sym ? `<div class="chord-full-name">${info.name}</div>` : ''}
        </div>

        <div class="chord-card-notes">
          <div class="chord-label">Các nốt</div>
          <div class="chord-notes-list">${notesStr}</div>
          ${bassStr ? `<div class="chord-bass-note">Bass: <strong>${bassStr}</strong></div>` : ''}
        </div>

        ${invs.length > 1 ? `
        <div class="chord-card-inversions">
          <div class="chord-label">Thế đảo</div>
          ${invs.map((inv, i) => `
            <div class="chord-inversion ${i === 0 ? 'chord-inv-root' : ''}">
              <span class="inv-label">${i === 0 ? 'Gốc' : `Đảo ${i}`}:</span>
              <span class="inv-notes">${inv.join(' ')}</span>
            </div>`).join('')}
        </div>` : ''}

        <div class="chord-card-actions">
          <button class="btn-hear-chord" id="btn-hear-chord" title="Nghe hợp âm">
            🔊 Nghe
          </button>
          <button class="btn-show-keyboard" id="btn-show-keyboard" title="Hiện bàn phím">
            🎹 Phím
          </button>
        </div>

        ${next ? `
        <div class="chord-card-next">
          <div class="chord-label">Tiếp theo</div>
          <div class="chord-next-symbol">${nextSym}</div>
          ${nextInfo ? `<div class="chord-next-notes">${nextInfo.notes.join(' ')}</div>` : ''}
        </div>` : ''}
      </div>`;

    // Bind actions
    _container.querySelector('#btn-hear-chord')?.addEventListener('click', _hearChord);
    _container.querySelector('#btn-show-keyboard')?.addEventListener('click', _toggleKeyboard);
  }

  /* ─── Actions ────────────────────────────────────────────────── */
  function _hearChord() {
    if (!window.Tone || !_currentChord) return;
    const sym   = _currentChord.transposedSymbol ?? _currentChord.symbol;
    const info  = _getChordInfo(sym);
    if (!info?.notes?.length) return;

    try {
      const synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.02, decay: 0.1, sustain: 0.6, release: 0.8 }
      }).toDestination();

      const notes = info.notes.map(n => `${n}4`);
      synth.triggerAttackRelease(notes, '2n');
      setTimeout(() => synth.dispose(), 3000);

      // Bass note
      if (_currentChord.bass) {
        const bassSynth = new Tone.Synth({
          oscillator: { type: 'triangle' },
          envelope: { attack: 0.02, decay: 0.2, sustain: 0.5, release: 1 }
        }).toDestination();
        bassSynth.triggerAttackRelease(`${_currentChord.bass}2`, '2n');
        setTimeout(() => bassSynth.dispose(), 3000);
      }
    } catch (e) { console.warn('[ChordCard] hear error:', e); }
  }

  function _toggleKeyboard() {
    const kbSection = document.querySelector('.learn-keyboard-section');
    if (kbSection) {
      kbSection.classList.toggle('hidden');
    }
  }

  /* ─── Public API ─────────────────────────────────────────────── */
  function mount(el) {
    _container = el;
    _render();
  }

  function setChord(chord, nextChord = null) {
    _currentChord = chord;
    _nextChord    = nextChord;
    _render();

    // Sync VirtualKeyboard
    if (window.VirtualKeyboard) {
      VirtualKeyboard.setChord(chord, nextChord);
    }
  }

  function clear() {
    _currentChord = null;
    _nextChord    = null;
    _render();
  }

  return { mount, setChord, clear };
})();

if (typeof window !== 'undefined') {
  window.ChordCard = ChordCard;
}
