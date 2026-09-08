/**
 * learn/ui/chord-card.js — Stage 2 & Phase 2: Chord Info & Roman Numeral Degree Panel
 *
 * Hiển thị hợp âm hiện tại: symbol, Roman numeral degree, notes, thế đảo, bass, next chord.
 * Sử dụng Tonal.js để phân tích công năng hòa âm bậc La Mã.
 *
 * Phụ thuộc: Tonal.js, LEARN_EVENTS, EventBus, VirtualKeyboard, LearnSoundEngine
 */
const ChordCard = (() => {
  'use strict';

  /* ─── State ──────────────────────────────────────────────────── */
  let _container = null;
  let _currentChord = null;
  let _nextChord    = null;
  let _songKey      = 'C';

  /* ─── Chord Theory & Roman Numeral Helpers ────────────────────── */
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

  function _getRomanDegree(symbol, songKey) {
    if (!symbol || !songKey || !window.Tonal) return '';
    try {
      const cleanSym = symbol.split('/')[0].trim();
      const chord = Tonal.Chord.get(cleanSym);
      const chordRoot = chord.root || cleanSym.replace(/[^A-Ga-g#b]/g, '');
      const cleanKey = songKey.trim();
      const dist = Tonal.Interval.distance(cleanKey, chordRoot);
      if (!dist) return '';

      const isMinor = chord.type?.includes('minor') || (cleanSym.includes('m') && !cleanSym.includes('maj'));
      const is7th = cleanSym.includes('7');

      const degreeMap = {
        '1P': { name: 'Bậc I · Chủ âm (Tonic)', roman: 'I' },
        '2M': { name: isMinor ? 'Bậc ii · Bậc 2 thứ' : 'Bậc II · Bậc 2', roman: isMinor ? 'ii' : 'II' },
        '2m': { name: 'Bậc ♭II · Neapolitan', roman: '♭II' },
        '3M': { name: isMinor ? 'Bậc iii · Bậc 3 thứ' : 'Bậc III · Bậc 3', roman: isMinor ? 'iii' : 'III' },
        '3m': { name: 'Bậc ♭III', roman: '♭III' },
        '4P': { name: 'Bậc IV · Hạ át (Subdominant)', roman: 'IV' },
        '5P': { name: is7th ? 'Bậc V7 · Hợp âm Át 7 (Dominant 7)' : 'Bậc V · Át âm (Dominant)', roman: is7th ? 'V7' : 'V' },
        '6M': { name: isMinor ? 'Bậc vi · Thứ song song' : 'Bậc VI', roman: isMinor ? 'vi' : 'VI' },
        '6m': { name: 'Bậc ♭VI', roman: '♭VI' },
        '7M': { name: 'Bậc vii° · Dẫn âm (Leading tone)', roman: 'vii°' },
        '7m': { name: is7th ? 'Bậc ♭VII7' : 'Bậc ♭VII · Bậc 7 giáng', roman: is7th ? '♭VII7' : '♭VII' }
      };

      return degreeMap[dist]?.name || (degreeMap[dist]?.roman ? `Bậc ${degreeMap[dist].roman}` : '');
    } catch (e) {
      return '';
    }
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
          <div class="chord-card-placeholder">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px;height:20px;vertical-align:-4px;margin-right:6px;opacity:0.7;">
              <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
            </svg>
            Chọn bài và nhấn Play
          </div>
        </div>`;
      return;
    }

    const sym     = chord.transposedSymbol ?? chord.symbol;
    const info    = _getChordInfo(sym);
    const invs    = info ? _buildInversions(info.notes) : [];
    const notesStr = info ? info.notes.join(' — ') : sym;
    const bassStr  = chord.bass ?? (info?.bass ?? info?.root ?? '');
    const romanBadge = _getRomanDegree(sym, _songKey);

    // Next chord
    const nextSym   = next ? (next.transposedSymbol ?? next.symbol) : null;
    const nextInfo  = nextSym ? _getChordInfo(nextSym) : null;

    _container.innerHTML = `
      <div class="chord-card">
        <div class="chord-card-main">
          <div class="chord-symbol">${sym || '—'}</div>
          ${romanBadge ? `<div class="chord-degree-badge">${romanBadge}</div>` : ''}
          ${info?.name && info.name !== sym ? `<div class="chord-full-name">${info.name}</div>` : ''}
        </div>

        <div class="chord-card-notes">
          <div class="chord-label">CÁC NỐT (TRIA/7TH)</div>
          <div class="chord-notes-list">${notesStr}</div>
          ${bassStr ? `<div class="chord-bass-note">Nốt Bass: <strong>${bassStr}</strong></div>` : ''}
        </div>

        ${invs.length > 1 ? `
        <div class="chord-card-inversions">
          <div class="chord-label">THẾ ĐẢO NGÓN TAY</div>
          ${invs.map((inv, i) => `
            <div class="chord-inversion ${i === 0 ? 'chord-inv-root' : ''}">
              <span class="inv-label">${i === 0 ? 'Gốc (Root)' : `Đảo ${i}`}:</span>
              <span class="inv-notes">${inv.join(' ')}</span>
            </div>`).join('')}
        </div>` : ''}

        <div class="chord-card-actions">
          <button class="btn-hear-chord" id="btn-hear-chord" title="Nghe mẫu hợp âm Grand Piano">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;vertical-align:-2px;margin-right:4px;">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
            </svg>
            Nghe Grand Piano
          </button>
          <button class="btn-show-keyboard" id="btn-show-keyboard" title="Hiện/Ẩn bàn phím ảo">
            <svg viewBox="0 0 24 24" fill="currentColor" style="width:14px;height:14px;vertical-align:-2px;margin-right:4px;">
              <path d="M20 5H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-9 10H9v-5h2v5zm4 0h-2v-5h2v5zm4 0h-2v-5h2v5z"/>
            </svg>
            Bàn phím
          </button>
        </div>

        ${next ? `
        <div class="chord-card-next">
          <div class="chord-label">HỢP ÂM TIẾP THEO</div>
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
    if (!_currentChord) return;
    const sym   = _currentChord.transposedSymbol ?? _currentChord.symbol;
    const info  = _getChordInfo(sym);
    if (!info?.notes?.length) return;

    if (window.LearnSoundEngine) {
      // Dùng trực tiếp bộ Grand Piano và Reverb của LearnSoundEngine
      const bassNote = _currentChord.bass || info.root;
      if (bassNote) {
        LearnSoundEngine.triggerNote('bass', `${bassNote}2`, 2.0, undefined, 0.85, 'left');
      }
      info.notes.forEach((n, idx) => {
        setTimeout(() => {
          LearnSoundEngine.triggerNote('piano', `${n}4`, 2.0, undefined, 0.75, 'right');
        }, idx * 15);
      });
    }
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

  function setSongKey(key) {
    if (key) {
      _songKey = key;
      if (_currentChord) _render();
    }
  }

  function setChord(chord, nextChord = null, songKey = null) {
    _currentChord = chord;
    _nextChord    = nextChord;
    if (songKey) _songKey = songKey;
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

  return { mount, setChord, setSongKey, clear };
})();

if (typeof window !== 'undefined') {
  window.ChordCard = ChordCard;
}
