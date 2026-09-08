/**
 * learn/accompaniment/pattern-library.js — Stage 5 & Phase 2: Accompaniment Styles & Patterns
 *
 * Chứa danh mục các phong cách đệm (Accompaniment Styles):
 * - Smart Adaptive Styles: Tự động điều chỉnh dậm nhịp theo hợp âm thực tế của bài hát
 * - Traditional & Classical Styles: Waltz 3/4, Church Organ, Arpeggio
 * - Score-Aware True Accompaniment: Lấy trực tiếp hòa âm 4 bè của bản nhạc gốc
 *
 * Expose: window.PatternLibrary
 */
const PatternLibrary = (() => {
  'use strict';

  const PATTERNS = [
    {
      id: 'smart-ballad',
      name: '🎹 Smart Ballad (Dậm nhịp Pop/Ballad tự thích ứng)',
      description: 'Dậm Bass phách 1-3, tay phải dậm nhịp 2-4 mượt mà — tự động chuyển khi đổi hợp âm',
      meter: '4/4',
      instrumentFamily: 'piano',
      category: 'smart',
      difficulty: 'basic',
      tempoMin: 55,
      tempoMax: 130
    },
    {
      id: 'smart-hymn',
      name: '⛪️ Thánh Ca 4 Bè (Hòa âm chuẩn theo bản nhạc)',
      description: 'Đệm dày dặn 4 bè SATB với tiếng Grand Piano và Organ ngân vang thính phòng',
      meter: 'all',
      instrumentFamily: 'piano',
      category: 'smart',
      difficulty: 'basic',
      tempoMin: 50,
      tempoMax: 120
    },
    {
      id: 'smart-worship',
      name: '🌊 Worship Arpeggio (Rải nốt mượt mà tự nhiên)',
      description: 'Rải bậc 1-5-8-10 thanh thoát theo đúng nốt của từng hợp âm — phong cách thờ phượng',
      meter: 'all',
      instrumentFamily: 'piano',
      category: 'smart',
      difficulty: 'intermediate',
      tempoMin: 50,
      tempoMax: 95
    },
    {
      id: 'smart-waltz',
      name: '💃 Smart Waltz 3/4 (Bùm-Chát-Chát tự thích ứng)',
      description: 'Bass trầm phách 1, tay phải dậm nhẹ phách 2 và 3 — chuẩn nhịp điệu 3/4',
      meter: '3/4',
      instrumentFamily: 'piano',
      category: 'smart',
      difficulty: 'basic',
      tempoMin: 70,
      tempoMax: 160
    },
    {
      id: 'organ-church-4-4-v1',
      name: '🎺 Organ Đại Thánh Đường (Pedal Bass & Ngân Dài)',
      description: 'Hợp âm Organ nhà thờ vang dội với bè Bass Pedal trầm ấm sâu lắng',
      meter: 'all',
      instrumentFamily: 'organ',
      category: 'organ',
      difficulty: 'basic',
      tempoMin: 50,
      tempoMax: 110
    },
    {
      id: 'piano-block-4-4-v1',
      name: '📦 Piano Block (Dậm đều từng phách)',
      description: 'Đánh hợp âm cả khối ở mỗi phách — phù hợp cho người mới bắt đầu luyện nhịp',
      meter: '4/4',
      instrumentFamily: 'piano',
      category: 'block',
      difficulty: 'beginner',
      tempoMin: 50,
      tempoMax: 130
    }
  ];

  function getAll() {
    return [...PATTERNS];
  }

  function getById(id) {
    return PATTERNS.find(p => p.id === id) || PATTERNS[0];
  }

  function getForMeter(meter) {
    const list = PATTERNS.filter(p => p.meter === meter || p.meter === 'all');
    return list.length ? list : PATTERNS;
  }

  return {
    getAll,
    getById,
    getForMeter
  };
})();

if (typeof window !== 'undefined') {
  window.PatternLibrary = PatternLibrary;
}
