/**
 * KeyService.js
 * Quản lý định dạng và chuyển dịch điệu tính (Musical Key) chuẩn mực,
 * giải quyết triệt để vấn đề enharmonic (thăng/giáng) theo Circle of Fifths và chuẩn Thánh Ca.
 * 
 * Quy tắc cốt lõi:
 * - G + 1 = Ab (không dùng G# trưởng)
 * - F + 1 = Gb (vì F là tông giáng; G - 1 = F#)
 * - Eb - 1 = D
 * - Dùng chung 1 nguồn sự thật cho Toolbar badge, SongInfoBar, Chế độ xem chữ / Band mode, và Stage HUD.
 */
var KeyService = window.KeyService || (() => {
  'use strict';

  // Circle of Fifths sang Tên Tông (Trưởng / Thứ)
  const FIFTHS_TO_KEY_MAJOR = {
    '-7': 'Cb', '-6': 'Gb', '-5': 'Db', '-4': 'Ab', '-3': 'Eb', '-2': 'Bb', '-1': 'F',
    '0': 'C',
    '1': 'G', '2': 'D', '3': 'A', '4': 'E', '5': 'B', '6': 'F#', '7': 'C#'
  };

  const FIFTHS_TO_KEY_MINOR = {
    '-7': 'Abm', '-6': 'Ebm', '-5': 'Bbm', '-4': 'Fm', '-3': 'Cm', '-2': 'Gm', '-1': 'Dm',
    '0': 'Am',
    '1': 'Em', '2': 'Bm', '3': 'F#m', '4': 'C#m', '5': 'G#m', '6': 'D#m', '7': 'A#m'
  };

  // Tên nốt sang Fifths (để nhận biết tông thăng hay tông giáng)
  const KEY_TO_FIFTHS = {
    'C': 0, 'G': 1, 'D': 2, 'A': 3, 'E': 4, 'B': 5, 'F#': 6, 'C#': 7,
    'F': -1, 'Bb': -2, 'Eb': -3, 'Ab': -4, 'Db': -5, 'Gb': -6, 'Cb': -7,
    'Am': 0, 'Em': 1, 'Bm': 2, 'F#m': 3, 'C#m': 4, 'G#m': 5, 'D#m': 6, 'A#m': 7,
    'Dm': -1, 'Gm': -2, 'Cm': -3, 'Fm': -4, 'Bbm': -5, 'Ebm': -6, 'Abm': -7
  };

  // Chroma index (0-11)
  const NOTE_TO_CHROMA = {
    'C': 0, 'B#': 0,
    'C#': 1, 'Db': 1,
    'D': 2,
    'D#': 3, 'Eb': 3,
    'E': 4, 'Fb': 4,
    'F': 5, 'E#': 5,
    'F#': 6, 'Gb': 6,
    'G': 7,
    'G#': 8, 'Ab': 8,
    'A': 9,
    'A#': 10, 'Bb': 10,
    'B': 11, 'Cb': 11
  };

  /**
   * Phân tích chuỗi tông
   * Ví dụ: "Eb", "F#m", "G", "C"
   */
  function parseKey(keyStr) {
    if (!keyStr) return null;
    const str = String(keyStr).trim();
    if (!str) return null;

    const m = str.match(/^([A-Ga-g][#b]?)(m|min|minor)?$/);
    if (!m) return null;

    let root = m[1].charAt(0).toUpperCase() + (m[1].charAt(1) || '');
    const isMinor = Boolean(m[2]);
    const cleanKey = isMinor ? (root + 'm') : root;
    const chroma = NOTE_TO_CHROMA[root] ?? 0;
    const fifths = KEY_TO_FIFTHS[cleanKey] ?? (KEY_TO_FIFTHS[root] ?? 0);

    // Ưu tiên tông giáng nếu có fifths < 0 hoặc tên chứa 'b' hoặc là 'F'
    const preferFlats = fifths < 0 || root.includes('b') || root === 'F';

    return {
      root,
      isMinor,
      cleanKey,
      chroma,
      fifths,
      preferFlats
    };
  }

  /**
   * Chuyển đổi fifths sang tên tông
   */
  function fifthsToKey(fifths, isMinor = false) {
    const f = parseInt(fifths, 10) || 0;
    const map = isMinor ? FIFTHS_TO_KEY_MINOR : FIFTHS_TO_KEY_MAJOR;
    return map[String(f)] || (isMinor ? 'Am' : 'C');
  }

  /**
   * Hàm cốt lõi duy nhất để hiển thị tông (displayKey)
   * @param {number|string} fifthsOrKey - số lượng fifths (-7..7) hoặc chuỗi tông ('G', 'F', 'Eb'...)
   * @param {number} [semis=0] - số bán cung dịch chuyển
   * @param {boolean} [isMinor=false] - tông thứ hay trưởng (nếu đầu vào là fifths)
   * @returns {string} - Tên tông chuẩn hoá
   */
  function displayKey(fifthsOrKey, semis = 0, isMinor = false) {
    if (fifthsOrKey === null || fifthsOrKey === undefined || fifthsOrKey === '') {
      return '';
    }

    let origKeyInfo = null;

    if (typeof fifthsOrKey === 'number') {
      const f = parseInt(fifthsOrKey, 10) || 0;
      const keyName = fifthsToKey(f, isMinor);
      origKeyInfo = parseKey(keyName);
    } else {
      const str = String(fifthsOrKey).trim();
      origKeyInfo = parseKey(str);
      if (!origKeyInfo) {
        return str; // Không nhận diện được nốt nhạc, trả về nguyên mẫu
      }
      if (isMinor) {
        origKeyInfo.isMinor = true;
      }
    }

    const s = parseInt(semis, 10) || 0;
    if (s === 0) {
      return origKeyInfo.cleanKey;
    }

    const minor = origKeyInfo.isMinor;
    const origChroma = origKeyInfo.chroma;
    const targetChroma = ((origChroma + s) % 12 + 12) % 12;
    const preferFlats = origKeyInfo.preferFlats;

    if (!minor) {
      // Major Keys enharmonic resolver
      switch (targetChroma) {
        case 0:  return 'C';
        case 1:  return preferFlats ? 'Db' : (['D', 'B'].includes(origKeyInfo.root) ? 'C#' : 'Db');
        case 2:  return 'D';
        case 3:  return 'Eb'; // Thánh ca và chuẩn lý thuyết luôn dùng Eb trưởng (không dùng D#)
        case 4:  return 'E';
        case 5:  return 'F';
        case 6:  return preferFlats ? 'Gb' : 'F#'; // F + 1 = Gb (vì F là tông giáng); G - 1 = F#
        case 7:  return 'G';
        case 8:  return 'Ab'; // G + 1 = Ab (không dùng G# trưởng)
        case 9:  return 'A';
        case 10: return 'Bb'; // Chuẩn luôn dùng Bb trưởng (không dùng A#)
        case 11: return 'B';
        default: return 'C';
      }
    } else {
      // Minor Keys enharmonic resolver
      switch (targetChroma) {
        case 0:  return 'Cm';
        case 1:  return 'C#m';
        case 2:  return 'Dm';
        case 3:  return preferFlats ? 'Ebm' : 'D#m';
        case 4:  return 'Em';
        case 5:  return 'Fm';
        case 6:  return 'F#m';
        case 7:  return 'Gm';
        case 8:  return preferFlats ? 'Abm' : 'G#m';
        case 9:  return 'Am';
        case 10: return 'Bbm';
        case 11: return 'Bm';
        default: return 'Am';
      }
    }
  }

  function normalizeKey(keyStr) {
    return displayKey(keyStr, 0);
  }

  return {
    displayKey,
    parseKey,
    fifthsToKey,
    normalizeKey,
    FIFTHS_TO_KEY_MAJOR,
    FIFTHS_TO_KEY_MINOR,
    KEY_TO_FIFTHS
  };
})();

if (typeof window !== 'undefined') {
  window.KeyService = KeyService;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = KeyService;
}
