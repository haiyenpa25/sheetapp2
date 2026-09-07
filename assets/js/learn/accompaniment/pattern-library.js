/**
 * learn/accompaniment/pattern-library.js — Stage 5: Accompaniment Pattern Definitions
 *
 * Chứa thư viện các mẫu đệm piano/organ chuẩn hóa.
 * Các pattern được định nghĩa theo musical degrees (bậc hợp âm 1, 3, 5, 7, 9)
 * thay vì nốt cố định, cho phép VoicingEngine áp dụng lên bất kỳ hợp âm nào.
 *
 * Expose: window.PatternLibrary
 */
const PatternLibrary = (() => {
  'use strict';

  const PATTERNS = [
    /* ─── 4/4 PATTERNS ─────────────────────────────────────────── */
    {
      id: 'piano-block-4-4-v1',
      name: 'Piano Block (4/4 Cơ bản)',
      description: 'Đánh hợp âm cả khối ở mỗi phách — phù hợp cho người mới bắt đầu',
      meter: '4/4',
      instrumentFamily: 'piano',
      difficulty: 'beginner',
      category: 'block',
      tempoMin: 50,
      tempoMax: 130,
      lanes: [
        {
          id: 'bass',
          instrument: 'bass',
          events: [
            { at: 0, duration: 1.8, pitch: 'root', octave: -2, velocity: 80 },
            { at: 2, duration: 1.8, pitch: 'root', octave: -2, velocity: 75 }
          ]
        },
        {
          id: 'piano_rh',
          instrument: 'piano',
          events: [
            { at: 0, duration: 0.9, degrees: [1, 3, 5], voicing: 'root-position', octave: 0, velocity: 70 },
            { at: 1, duration: 0.9, degrees: [1, 3, 5], voicing: 'root-position', octave: 0, velocity: 65 },
            { at: 2, duration: 0.9, degrees: [1, 3, 5], voicing: 'root-position', octave: 0, velocity: 70 },
            { at: 3, duration: 0.9, degrees: [1, 3, 5], voicing: 'root-position', octave: 0, velocity: 65 }
          ]
        }
      ]
    },

    {
      id: 'piano-bass-chord-4-4-v1',
      name: 'Bass + Chords (4/4 Pop/Ballad)',
      description: 'Bass phách 1 & 3, Tay phải dặm phách 2 & 4 — nhịp điệu phổ biến nhất',
      meter: '4/4',
      instrumentFamily: 'piano',
      difficulty: 'basic',
      category: 'bass-chord',
      tempoMin: 60,
      tempoMax: 140,
      lanes: [
        {
          id: 'bass',
          instrument: 'bass',
          events: [
            { at: 0, duration: 1.5, pitch: 'root', octave: -2, velocity: 85 },
            { at: 2, duration: 1.5, pitch: 'fifth', octave: -2, velocity: 75 }
          ]
        },
        {
          id: 'piano_rh',
          instrument: 'piano',
          events: [
            { at: 1, duration: 0.8, degrees: [1, 3, 5], voicing: 'nearest', octave: 0, velocity: 75 },
            { at: 2.5, duration: 0.4, degrees: [1, 3, 5], voicing: 'nearest', octave: 0, velocity: 60 },
            { at: 3, duration: 0.8, degrees: [1, 3, 5], voicing: 'nearest', octave: 0, velocity: 75 }
          ]
        }
      ]
    },

    {
      id: 'piano-arpeggio-4-4-v1',
      name: 'Arpeggio Rải Nốt (4/4 Nhẹ nhàng)',
      description: 'Rải bậc 1-5-8-10 tay trái kết hợp dải nốt tay phải — êm dịu phong cách thánh ca',
      meter: '4/4',
      instrumentFamily: 'piano',
      difficulty: 'intermediate',
      category: 'arpeggio',
      tempoMin: 50,
      tempoMax: 100,
      lanes: [
        {
          id: 'bass',
          instrument: 'bass',
          events: [
            { at: 0, duration: 3.8, pitch: 'root', octave: -2, velocity: 80 }
          ]
        },
        {
          id: 'piano_rh',
          instrument: 'piano',
          events: [
            { at: 0,   duration: 0.45, degrees: [1], voicing: 'open', octave: -1, velocity: 70 },
            { at: 0.5, duration: 0.45, degrees: [5], voicing: 'open', octave: -1, velocity: 65 },
            { at: 1.0, duration: 0.45, degrees: [3], voicing: 'open', octave: 0,  velocity: 68 },
            { at: 1.5, duration: 0.45, degrees: [5], voicing: 'open', octave: 0,  velocity: 65 },
            { at: 2.0, duration: 0.45, degrees: [1], voicing: 'open', octave: 1,  velocity: 72 },
            { at: 2.5, duration: 0.45, degrees: [5], voicing: 'open', octave: 0,  velocity: 65 },
            { at: 3.0, duration: 0.45, degrees: [3], voicing: 'open', octave: 0,  velocity: 68 },
            { at: 3.5, duration: 0.45, degrees: [5], voicing: 'open', octave: 0,  velocity: 62 }
          ]
        }
      ]
    },

    /* ─── 3/4 WALTZ PATTERNS ────────────────────────────────────── */
    {
      id: 'piano-waltz-3-4-v1',
      name: 'Waltz Cổ Điển (3/4 Bùm-Chát-Chát)',
      description: 'Bass ở phách 1, tay phải dặm ở phách 2 và 3',
      meter: '3/4',
      instrumentFamily: 'piano',
      difficulty: 'basic',
      category: 'waltz',
      tempoMin: 70,
      tempoMax: 160,
      lanes: [
        {
          id: 'bass',
          instrument: 'bass',
          events: [
            { at: 0, duration: 1.8, pitch: 'root', octave: -2, velocity: 85 }
          ]
        },
        {
          id: 'piano_rh',
          instrument: 'piano',
          events: [
            { at: 1, duration: 0.8, degrees: [1, 3, 5], voicing: 'nearest', octave: 0, velocity: 70 },
            { at: 2, duration: 0.8, degrees: [1, 3, 5], voicing: 'nearest', octave: 0, velocity: 70 }
          ]
        }
      ]
    },

    /* ─── 6/8 WORSHIP PATTERNS ──────────────────────────────────── */
    {
      id: 'piano-worship-6-8-v1',
      name: 'Worship Ballad (6/8 Sâu lắng)',
      description: 'Rải 6 phách mượt mà theo phong cách thờ phượng hiện đại',
      meter: '6/8',
      instrumentFamily: 'piano',
      difficulty: 'intermediate',
      category: 'ballad',
      tempoMin: 45,
      tempoMax: 85,
      lanes: [
        {
          id: 'bass',
          instrument: 'bass',
          events: [
            { at: 0, duration: 2.8, pitch: 'root', octave: -2, velocity: 80 },
            { at: 3, duration: 2.8, pitch: 'fifth', octave: -2, velocity: 70 }
          ]
        },
        {
          id: 'piano_rh',
          instrument: 'piano',
          events: [
            { at: 0, duration: 0.9, degrees: [1], voicing: 'open', octave: 0, velocity: 72 },
            { at: 1, duration: 0.9, degrees: [3], voicing: 'open', octave: 0, velocity: 65 },
            { at: 2, duration: 0.9, degrees: [5], voicing: 'open', octave: 0, velocity: 68 },
            { at: 3, duration: 0.9, degrees: [1], voicing: 'open', octave: 1, velocity: 70 },
            { at: 4, duration: 0.9, degrees: [5], voicing: 'open', octave: 0, velocity: 65 },
            { at: 5, duration: 0.9, degrees: [3], voicing: 'open', octave: 0, velocity: 62 }
          ]
        }
      ]
    },

    /* ─── ORGAN PATTERN ─────────────────────────────────────────── */
    {
      id: 'organ-church-4-4-v1',
      name: 'Organ Thánh Ca (4/4 Ngân dài)',
      description: 'Hợp âm ngân vang ấm áp với pedal bass nền',
      meter: '4/4',
      instrumentFamily: 'organ',
      difficulty: 'basic',
      category: 'organ',
      tempoMin: 50,
      tempoMax: 110,
      lanes: [
        {
          id: 'bass',
          instrument: 'organ_pedal',
          events: [
            { at: 0, duration: 3.8, pitch: 'root', octave: -2, velocity: 85 }
          ]
        },
        {
          id: 'piano_rh',
          instrument: 'organ',
          events: [
            { at: 0, duration: 3.8, degrees: [1, 3, 5], voicing: 'nearest', octave: 0, velocity: 75 }
          ]
        }
      ]
    }
  ];

  /* ─── Public API ─────────────────────────────────────────────── */
  function getAll() {
    return [...PATTERNS];
  }

  function getById(id) {
    return PATTERNS.find(p => p.id === id) || PATTERNS[0];
  }

  function getForMeter(meter) {
    const list = PATTERNS.filter(p => p.meter === meter);
    return list.length ? list : PATTERNS.filter(p => p.meter === '4/4');
  }

  function getForCategory(category) {
    return PATTERNS.filter(p => p.category === category);
  }

  return {
    getAll,
    getById,
    getForMeter,
    getForCategory
  };
})();

if (typeof window !== 'undefined') {
  window.PatternLibrary = PatternLibrary;
}
