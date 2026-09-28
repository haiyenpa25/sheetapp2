/**
 * assets/js/harmonic-numeral.js
 *
 * Hệ Thống Hiển Thị Hợp Âm Số La Mã / Nashville (Ticket L4-7):
 * 1. Chuyển đổi hợp âm sang số La Mã (Roman Numerals: I - ii - iii - IV - V - vi - vii°).
 * 2. Chuyển đổi hợp âm sang hệ thống số Nashville (Nashville Number System: 1 - 2m - 3m - 4 - 5 - 6m - 7dim).
 * 3. Hỗ trợ đầy đủ hợp âm mở rộng (7, maj7, sus4, dim, aug, add9), hợp âm đảo (C/E → I/3 hoặc 1/3) và nốt ngoài âm giai (bVII, bIII, #IV).
 * 4. Tự động quy đổi chuẩn xác theo tông bài hát (Key Trưởng & Key Thứ).
 * 5. Lưu trữ cấu hình trong localStorage ('sheetapp_chord_notation').
 */
const HarmonicNumeral = (() => {
  'use strict';

  const STORAGE_NOTATION_KEY = 'sheetapp_chord_notation';
  let _notationStyle = 'standard'; // 'standard' | 'roman' | 'nashville'

  // Bảng cao độ bán cung (Semitone Pitch Classes 0..11)
  const PITCH_CLASSES = {
    'C': 0, 'B#': 0,
    'C#': 1, 'DB': 1,
    'D': 2,
    'D#': 3, 'EB': 3,
    'E': 4, 'FB': 4,
    'F': 5, 'E#': 5,
    'F#': 6, 'GB': 6,
    'G': 7,
    'G#': 8, 'AB': 8,
    'A': 9,
    'A#': 10, 'BB': 10,
    'B': 11, 'CB': 11
  };

  // Ánh xạ bán cung sang số La Mã (Major Key & Minor Key)
  const ROMAN_MAJOR_SCALE = [
    { num: 'I',    minor: 'i',    deg: '1' }, // 0 semitones
    { num: 'bII',  minor: 'bii',  deg: 'b2' }, // 1
    { num: 'II',   minor: 'ii',   deg: '2' }, // 2
    { num: 'bIII', minor: 'biii', deg: 'b3' }, // 3
    { num: 'III',  minor: 'iii',  deg: '3' }, // 4
    { num: 'IV',   minor: 'iv',   deg: '4' }, // 5
    { num: '#IV',  minor: '#iv',  deg: '#4' }, // 6
    { num: 'V',    minor: 'v',    deg: '5' }, // 7
    { num: 'bVI',  minor: 'bvi',  deg: 'b6' }, // 8
    { num: 'VI',   minor: 'vi',   deg: '6' }, // 9
    { num: 'bVII', minor: 'bvii', deg: 'b7' }, // 10
    { num: 'VII',  minor: 'vii',  deg: '7' }  // 11
  ];

  function getPitchClass(noteStr) {
    if (!noteStr || typeof noteStr !== 'string') return -1;
    const clean = noteStr.trim().toUpperCase();
    return PITCH_CLASSES[clean] ?? -1;
  }

  function parseChord(chordStr) {
    if (!chordStr || typeof chordStr !== 'string') return null;
    const s = chordStr.trim();
    if (!s || s === 'N.C.' || s === '%' || s === '/') return null;

    let rootPart = s;
    let bassPart = '';
    const slashIdx = s.indexOf('/');
    if (slashIdx !== -1) {
      rootPart = s.slice(0, slashIdx).trim();
      bassPart = s.slice(slashIdx + 1).trim();
    }

    const m = rootPart.match(/^([A-Ga-g][#b]?)(.*)$/);
    if (!m) return null;

    const rootNote = m[1].charAt(0).toUpperCase() + (m[1].length > 1 ? m[1].charAt(1).toLowerCase() : '');
    const quality = m[2] || '';

    // Kiểm tra tính chất thứ (minor)
    const isMinor = /^(m(?!aj)|min|-)/i.test(quality);
    const isDim = /^(dim|°)/i.test(quality);
    const isAug = /^(aug|\+)/i.test(quality);

    // Lọc suffix
    let suffix = quality;
    if (isMinor) {
      suffix = quality.replace(/^(m(?!aj)|min|-)/i, '');
    } else if (isDim) {
      suffix = quality.replace(/^(dim|°)/i, '');
    } else if (isAug) {
      suffix = quality.replace(/^(aug|\+)/i, '');
    }

    return {
      rootNote,
      bassPart,
      quality,
      suffix,
      isMinor,
      isDim,
      isAug,
      original: s
    };
  }

  function parseKeyRoot(keyStr) {
    if (!keyStr || typeof keyStr !== 'string') return { root: 'C', isMinor: false };
    const s = keyStr.trim();
    if (!s || s === '--') return { root: 'C', isMinor: false };

    const m = s.match(/^([A-Ga-g][#b]?)(.*)$/);
    if (!m) return { root: 'C', isMinor: false };

    const root = m[1].charAt(0).toUpperCase() + (m[1].length > 1 ? m[1].charAt(1).toLowerCase() : '');
    const isMinor = /^(m|min)/i.test(m[2] || '');
    return { root, isMinor };
  }

  /**
   * Chuyển đổi một hợp âm sang ký hiệu Số La Mã (Roman Numerals)
   * Ví dụ trong Key C:
   * - C → I, Dm → ii, Em → iii, F → IV, G → V, G7 → V7, Am → vi, Bdim → vii°
   * - C/E → I/3, G/B → V/7, Bb → bVII, Cmaj7 → Imaj7
   */
  function chordToRoman(chordStr, keyStr) {
    const chord = parseChord(chordStr);
    if (!chord) return chordStr || '';

    const key = parseKeyRoot(keyStr);
    const chordPitch = getPitchClass(chord.rootNote);
    const tonicPitch = getPitchClass(key.root);
    if (chordPitch === -1 || tonicPitch === -1) return chordStr;

    const semitones = (chordPitch - tonicPitch + 12) % 12;
    const interval = ROMAN_MAJOR_SCALE[semitones];
    if (!interval) return chordStr;

    let numeral = chord.isMinor ? interval.minor : interval.num;

    // Hợp âm giảm (diminished)
    if (chord.isDim) {
      numeral = interval.minor + '°';
    } else if (chord.isAug) {
      numeral = interval.num + '+';
    }

    let result = numeral + (chord.suffix || '');

    // Xử lý nốt bass nếu có hợp âm đảo (Slash chord: C/E → I/3, G/B → V/7)
    if (chord.bassPart) {
      const bassPitch = getPitchClass(chord.bassPart);
      if (bassPitch !== -1) {
        const bassSemi = (bassPitch - tonicPitch + 12) % 12;
        const bassInterval = ROMAN_MAJOR_SCALE[bassSemi];
        result += '/' + (bassInterval ? bassInterval.deg : chord.bassPart);
      } else {
        result += '/' + chord.bassPart;
      }
    }

    return result;
  }

  /**
   * Chuyển đổi một hợp âm sang hệ thống số Nashville (Nashville Number System)
   * Ví dụ trong Key C:
   * - C → 1, Dm → 2m, Em → 3m, F → 4, G → 5, G7 → 5^7 (hoặc 5(7)), Am → 6m, Bdim → 7dim
   * - C/E → 1/3, G/B → 5/7
   */
  function chordToNashville(chordStr, keyStr) {
    const chord = parseChord(chordStr);
    if (!chord) return chordStr || '';

    const key = parseKeyRoot(keyStr);
    const chordPitch = getPitchClass(chord.rootNote);
    const tonicPitch = getPitchClass(key.root);
    if (chordPitch === -1 || tonicPitch === -1) return chordStr;

    const semitones = (chordPitch - tonicPitch + 12) % 12;
    const interval = ROMAN_MAJOR_SCALE[semitones];
    if (!interval) return chordStr;

    let numStr = interval.deg;
    if (chord.isMinor) {
      numStr += 'm';
    } else if (chord.isDim) {
      numStr += 'dim';
    } else if (chord.isAug) {
      numStr += '+';
    }

    let result = numStr + (chord.suffix || '');

    if (chord.bassPart) {
      const bassPitch = getPitchClass(chord.bassPart);
      if (bassPitch !== -1) {
        const bassSemi = (bassPitch - tonicPitch + 12) % 12;
        const bassInterval = ROMAN_MAJOR_SCALE[bassSemi];
        result += '/' + (bassInterval ? bassInterval.deg : chord.bassPart);
      } else {
        result += '/' + chord.bassPart;
      }
    }

    return result;
  }

  /**
   * Bộ chuyển đổi tổng quát theo style cấu hình hiện tại
   */
  function convertChord(chordStr, keyStr, targetStyle) {
    const style = targetStyle || _notationStyle;
    if (style === 'roman') {
      return chordToRoman(chordStr, keyStr);
    }
    if (style === 'nashville') {
      return chordToNashville(chordStr, keyStr);
    }
    return chordStr;
  }

  function getNotationStyle() {
    return _notationStyle;
  }

  function setNotationStyle(style, notify = true) {
    if (['standard', 'roman', 'nashville'].includes(style)) {
      _notationStyle = style;
      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem(STORAGE_NOTATION_KEY, _notationStyle);
        } catch (_) {}
      }

      _updateUI();

      if (notify) {
        if (window.DisplaySettings?.renderLyricViewIfActive) {
          window.DisplaySettings.renderLyricViewIfActive();
        }
        if (window.ChordCanvas?.reposition) {
          window.ChordCanvas.reposition();
        }
        if (typeof EventBus !== 'undefined') {
          EventBus.emit('notation:changed', { style: _notationStyle });
        }
      }
    }
    return _notationStyle;
  }

  function cycleNotationStyle() {
    const styles = ['standard', 'roman', 'nashville'];
    const nextIdx = (styles.indexOf(_notationStyle) + 1) % styles.length;
    const nextStyle = styles[nextIdx];
    setNotationStyle(nextStyle, true);

    const labels = {
      standard: 'Hợp âm chữ (C, G, Am)',
      roman: 'Số La Mã (I, IV, V, vi)',
      nashville: 'Nashville Numbers (1, 4, 5, 6m)'
    };

    if (typeof window !== 'undefined' && window.AppUI?.showToast) {
      window.AppUI.showToast(`🎼 Chế độ hợp âm: ${labels[nextStyle]}`, 'info');
    }

    return nextStyle;
  }

  function _updateUI() {
    if (typeof document === 'undefined') return;
    const btn = document.getElementById('btn-chord-notation');
    if (btn) {
      const labels = { standard: 'C', roman: 'I-V', nashville: '1-5' };
      const icons = { standard: '🔤', roman: '🏛', nashville: '🔢' };
      btn.innerHTML = `<span>${icons[_notationStyle] || '🔤'}</span> <span id="chord-notation-label">${labels[_notationStyle] || 'C'}</span>`;
      btn.title = `Chế độ hợp âm: ${_notationStyle} (Bấm để đổi Chuẩn / La Mã / Nashville)`;
      btn.classList.toggle('active', _notationStyle !== 'standard');
    }
  }

  function init() {
    if (typeof localStorage !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_NOTATION_KEY);
        if (saved && ['standard', 'roman', 'nashville'].includes(saved)) {
          _notationStyle = saved;
        }
      } catch (_) {}
    }

    _updateUI();

    document.getElementById('btn-chord-notation')?.addEventListener('click', () => {
      cycleNotationStyle();
    });
  }

  return {
    init,
    parseChord,
    chordToRoman,
    chordToNashville,
    convertChord,
    getNotationStyle,
    setNotationStyle,
    cycleNotationStyle
  };
})();

window.HarmonicNumeral = HarmonicNumeral;
