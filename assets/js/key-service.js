/**
 * key-service.js
 * Quản lý & quy chuẩn hoá điệu tính (Key) và Enharmonic thống nhất toàn ứng dụng.
 * Ticket L0-11 (ROADMAP4.md)
 */
var KeyService = window.KeyService || (() => {
  'use strict';

  // Ánh xạ Fifths (-7 .. +7) sang tên điệu tính Major (Trưởng)
  const FIFTHS_MAJOR = {
    '-7': 'Cb',
    '-6': 'Gb',
    '-5': 'Db',
    '-4': 'Ab',
    '-3': 'Eb',
    '-2': 'Bb',
    '-1': 'F',
     '0': 'C',
     '1': 'G',
     '2': 'D',
     '3': 'A',
     '4': 'E',
     '5': 'B',
     '6': 'F#',
     '7': 'C#'
  };

  // Ánh xạ Fifths (-7 .. +7) sang tên điệu tính Minor (Thứ)
  const FIFTHS_MINOR = {
    '-7': 'Abm',
    '-6': 'Ebm',
    '-5': 'Bbm',
    '-4': 'Fm',
    '-3': 'Cm',
    '-2': 'Gm',
    '-1': 'Dm',
     '0': 'Am',
     '1': 'Em',
     '2': 'Bm',
     '3': 'F#m',
     '4': 'C#m',
     '5': 'G#m',
     '6': 'D#m',
     '7': 'A#m'
  };

  // Tra ngược tên tông sang Fifths
  const KEY_TO_FIFTHS = {
    'C': 0, 'AM': 0, 'AMIN': 0,
    'G': 1, 'EM': 1, 'EMIN': 1,
    'D': 2, 'BM': 2, 'BMIN': 2,
    'A': 3, 'F#M': 3, 'F#MIN': 3,
    'E': 4, 'C#M': 4, 'C#MIN': 4,
    'B': 5, 'G#M': 5, 'G#MIN': 5,
    'F#': 6, 'D#M': 6, 'D#MIN': 6,
    'C#': 7, 'A#M': 7, 'A#MIN': 7,
    'F': -1, 'DM': -1, 'DMIN': -1,
    'BB': -2, 'GM': -2, 'GMIN': -2, 'A#': -2,
    'EB': -3, 'CM': -3, 'CMIN': -3, 'D#': -3,
    'AB': -4, 'FM': -4, 'FMIN': -4, 'G#': -4,
    'DB': -5, 'BBM': -5, 'BBMIN': -5,
    'GB': -6, 'EBM': -6, 'EBMIN': -6,
    'CB': -7, 'ABM': -7, 'ABMIN': -7
  };

  // Bước nhảy fifths tương ứng với số semitones dịch chuyển (0..11)
  const _SEMITONE_FIFTHS_OFFSET = [0, -5, 2, -3, 4, -1, 6, 1, -4, 3, -2, 5];

  /**
   * Tính fifths mới sau khi dịch chuyển số bán cung (semitones)
   * Giữ trong khoảng chuẩn -6..+6 của thánh ca (55% bài ở tông giáng).
   */
  function calcTransposedFifths(origFifths, semitones) {
    if (typeof origFifths !== 'number' || isNaN(origFifths)) return 0;
    const norm = ((semitones % 12) + 12) % 12;
    let newF = origFifths + _SEMITONE_FIFTHS_OFFSET[norm];
    while (newF > 6) newF -= 12;
    while (newF < -6) newF += 12;
    return newF;
  }

  /**
   * Phân tích chuỗi tông thành { fifths, isMinor, root, suffix }
   */
  function parseKey(keyStr) {
    if (keyStr === null || keyStr === undefined) return null;
    const str = String(keyStr).trim();
    if (!str || str === '--') return null;

    // Nếu đầu vào là một chuỗi số fifths (VD: "-3", "1")
    if (/^-?\d+$/.test(str)) {
      const f = parseInt(str, 10);
      return { fifths: f, isMinor: false, root: FIFTHS_MAJOR[String(f)] || 'C', suffix: '' };
    }

    const m = str.match(/^([A-Ga-g][#b]?)(.*)$/);
    if (!m) return null;

    const rawRoot = m[1];
    const root = rawRoot.charAt(0).toUpperCase() + (rawRoot.length > 1 ? rawRoot.charAt(1).toLowerCase() : '');
    const suffix = m[2] || '';
    const isMinor = /^(m|min|minor)/i.test(suffix) && !/^maj/i.test(suffix);

    const lookupKey = (root + (isMinor ? 'm' : '')).toUpperCase();
    const fifths = KEY_TO_FIFTHS[lookupKey] ?? 0;

    return { fifths, isMinor, root, suffix };
  }

  /**
   * Lấy fifths từ tên điệu tính
   */
  function getFifths(keyStr) {
    const parsed = parseKey(keyStr);
    return parsed ? parsed.fifths : 0;
  }

  /**
   * Kiểm tra xem một tông có phải tông thứ không
   */
  function isMinorKey(keyStr) {
    const parsed = parseKey(keyStr);
    return parsed ? parsed.isMinor : false;
  }

  /**
   * Hàm cốt lõi theo Ticket L0-11:
   * displayKey(fifthsOrKey, semis, isMinor)
   * - Hỗ trợ cả 2 dạng tham số:
   *   1) Số fifths: displayKey(1, 1) -> "Ab"
   *   2) Tên tông: displayKey('G', 1) -> "Ab", displayKey('F', 1) -> "Gb", displayKey('Eb', -1) -> "D"
   */
  function displayKey(fifthsOrKey, semis = 0, isMinor = null) {
    if (fifthsOrKey === null || fifthsOrKey === undefined || fifthsOrKey === '') {
      return '';
    }

    const s = parseInt(semis, 10) || 0;

    // Trường hợp 1: fifthsOrKey là một con số (số fifths)
    if (typeof fifthsOrKey === 'number') {
      const minor = Boolean(isMinor);
      const newFifths = calcTransposedFifths(fifthsOrKey, s);
      const map = minor ? FIFTHS_MINOR : FIFTHS_MAJOR;
      return map[String(newFifths)] || (minor ? 'Am' : 'C');
    }

    // Trường hợp 2: fifthsOrKey là chuỗi
    const parsed = parseKey(fifthsOrKey);
    if (!parsed) {
      return String(fifthsOrKey).trim();
    }

    if (s === 0) {
      return parsed.root + parsed.suffix;
    }

    const minor = isMinor !== null ? Boolean(isMinor) : parsed.isMinor;
    const newFifths = calcTransposedFifths(parsed.fifths, s);
    const map = minor ? FIFTHS_MINOR : FIFTHS_MAJOR;
    const newBase = map[String(newFifths)] || (minor ? 'Am' : 'C');

    // Giữ lại phần suffix phức tạp nếu có (ngoài m/min cơ bản)
    const extraSuffix = parsed.suffix.replace(/^(m|min|minor)/i, '');
    return newBase + extraSuffix;
  }

  return {
    displayKey,
    calcTransposedFifths,
    parseKey,
    getFifths,
    isMinorKey,
    FIFTHS_MAJOR,
    FIFTHS_MINOR
  };
})();

if (typeof window !== 'undefined') {
  window.KeyService = KeyService;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = KeyService;
}
