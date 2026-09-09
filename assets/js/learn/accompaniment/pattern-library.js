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
      name: '🎹 Pop / Worship Ballad (4/4 Mượt Mà & Chân Thực)',
      description: 'Bass quãng 1-5-8, tay phải đệm lơi phách & hợp âm mở Add9, tiếng Shaker/Brush êm dịu',
      meter: '4/4',
      instrumentFamily: 'piano',
      category: 'smart',
      difficulty: 'intermediate',
      tempoMin: 55,
      tempoMax: 130
    },
    {
      id: 'smart-slowrock-6-8',
      name: '🌊 Thánh Ca 6/8 Slow Rock (Sóng Biển Nhấp Nhô)',
      description: 'Chuẩn xác cho nhịp 6/8: Rải 1-2-3-4-5-6 nhịp nhàng, Bass trầm dậm phách 1 và 4',
      meter: '6/8',
      instrumentFamily: 'piano',
      category: 'smart',
      difficulty: 'intermediate',
      tempoMin: 45,
      tempoMax: 95
    },
    {
      id: 'smart-waltz',
      name: '💃 Boston / Slow Waltz 3/4 (Trữ Tình Quý Tộc)',
      description: 'Bass trầm phách 1, tay phải dậm nhẹ hợp âm đảo phách 2 và 3 — chuẩn nhịp điệu 3/4',
      meter: '3/4',
      instrumentFamily: 'piano',
      category: 'smart',
      difficulty: 'basic',
      tempoMin: 70,
      tempoMax: 160
    },
    {
      id: 'smart-hymn',
      name: '⛪️ Thánh Ca 4 Bè (Hòa Âm Trang Trọng)',
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
      name: '✨ Arpeggio Suối Reo (Rải 16th Mượt Mà)',
      description: 'Rải ngón liên tục 16th notes thanh thoát theo từng hợp âm — phong cách thánh ca ngợi khen',
      meter: 'all',
      instrumentFamily: 'piano',
      category: 'smart',
      difficulty: 'intermediate',
      tempoMin: 50,
      tempoMax: 95
    },
    {
      id: 'smart-march',
      name: '🎺 Hành Khúc / Hân Hoan (Joyful March 2/4 - 4/4)',
      description: 'Nhịp dậm dứt khoát, rộn ràng, Bass luân phiên bậc 1 và bậc 5 tươi vui',
      meter: 'all',
      instrumentFamily: 'piano',
      category: 'smart',
      difficulty: 'basic',
      tempoMin: 80,
      tempoMax: 140
    },
    {
      id: 'smart-rumba',
      name: '🌴 Rumba Thánh Ca (Trầm Ấm Lãng Mạn)',
      description: 'Nhịp dậm đảo phách đặc trưng Bùm ... Chát . Chát . Bùm . Chát của Rumba phụng vụ',
      meter: '4/4',
      instrumentFamily: 'piano',
      category: 'smart',
      difficulty: 'intermediate',
      tempoMin: 65,
      tempoMax: 110
    },
    {
      id: 'piano-block-4-4-v1',
      name: '📦 Piano Block (Dậm Đều Từng Phách)',
      description: 'Đánh hợp âm cả khối ở mỗi phách — phù hợp cho người mới bắt đầu luyện nhịp',
      meter: '4/4',
      instrumentFamily: 'piano',
      category: 'block',
      difficulty: 'beginner',
      tempoMin: 50,
      tempoMax: 130
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
