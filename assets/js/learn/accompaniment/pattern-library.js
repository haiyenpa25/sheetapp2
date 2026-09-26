/**
 * learn/accompaniment/pattern-library.js
 * Thư viện các Điệu Đệm Tự Động (Auto-Accompaniment Styles & Grooves)
 *
 * Phân loại bài bản theo Loại Nhịp (Meters):
 * - Nhịp 4/4: Pop/Worship Ballad, Liturgical Rumba, Arpeggio Suối Reo, Praise/Disco, Piano Block
 * - Nhịp 3/4: Boston Trữ Tình, Slow Waltz, Joyful Waltz
 * - Nhịp 6/8: Slow Rock Thánh Ca (Dập dềnh 6 phách), Ballad 6/8
 * - Nhịp 2/4: Hành Khúc March, Fox / Polka
 * - Mọi nhịp: Thánh Ca 4 Bè SATB, Organ Đại Thánh Đường
 *
 * Expose: window.PatternLibrary
 */
const PatternLibrary = (() => {
  'use strict';

  const PATTERNS = [
    // ─── NHÓM 1: NHỊP 4/4 ──────────────────────────────────────────
    {
      id: 'smart-ballad',
      name: '🎹 Pop / Worship Ballad 4/4 (Mượt Mà & Chân Thực)',
      shortName: 'Ballad 4/4',
      description: 'Bass 1-5-8, rải ngón êm dịu, hợp âm mở Add9, Shaker/Brush nhẹ nhàng',
      meter: '4/4',
      instrumentFamily: 'piano',
      category: 'ballad',
      tempoMin: 55,
      tempoMax: 120,
      icon: '🎹'
    },
    {
      id: 'smart-rumba',
      name: '🌴 Rumba Thánh Ca 4/4 (Trầm Ấm Phụng Vụ)',
      shortName: 'Rumba 4/4',
      description: 'Đảo phách Bùm ... Chát . Chát . Bùm . Chát đặc trưng phụng vụ nhà thờ Việt Nam',
      meter: '4/4',
      instrumentFamily: 'piano',
      category: 'latin',
      tempoMin: 65,
      tempoMax: 110,
      icon: '🌴'
    },
    {
      id: 'smart-worship',
      name: '✨ Arpeggio Suối Reo 4/4 (Rải 16th Thánh Thót)',
      shortName: 'Suối Reo 16th',
      description: 'Rải ngón 16th liên tục trải dài quãng 8 thanh thoát — phong cách ngợi khen, suy niệm',
      meter: '4/4',
      instrumentFamily: 'piano',
      category: 'arpeggio',
      tempoMin: 50,
      tempoMax: 95,
      icon: '✨'
    },
    {
      id: 'smart-disco',
      name: '🎉 Praise / Disco 4/4 (Hân Hoan & Sôi Động)',
      shortName: 'Praise 4/4',
      description: 'Bass chạy nảy quãng 8, hợp âm dậm nẩy phách 2-4 rộn rã mừng lễ lớn',
      meter: '4/4',
      instrumentFamily: 'piano',
      category: 'dance',
      tempoMin: 90,
      tempoMax: 135,
      icon: '🎉'
    },
    {
      id: 'piano-block-4-4-v1',
      name: '📦 Piano Block 4/4 (Dậm Đều Từng Phách)',
      shortName: 'Block 4/4',
      description: 'Đánh hợp âm cả khối ở mỗi phách — lý tưởng cho người mới bắt đầu luyện nhịp',
      meter: '4/4',
      instrumentFamily: 'piano',
      category: 'block',
      tempoMin: 50,
      tempoMax: 130,
      icon: '📦'
    },

    // ─── NHÓM 2: NHỊP 3/4 ──────────────────────────────────────────
    {
      id: 'smart-boston',
      name: '🌙 Boston Trữ Tình 3/4 (Sâu Lắng & Chậm Rãi)',
      shortName: 'Boston 3/4',
      description: 'Phách 1 dậm bass trầm ngân dài, phách 2 và 3 rải lơi trữ tình tha thiết',
      meter: '3/4',
      instrumentFamily: 'piano',
      category: 'waltz',
      tempoMin: 55,
      tempoMax: 90,
      icon: '🌙'
    },
    {
      id: 'smart-waltz',
      name: '💃 Slow Waltz 3/4 (Bùm Chát Chát Quý Tộc)',
      shortName: 'Slow Waltz 3/4',
      description: 'Bass trầm phách 1, tay phải dậm nhẹ 2 hợp âm phách 2 và 3 chuẩn xác',
      meter: '3/4',
      instrumentFamily: 'piano',
      category: 'waltz',
      tempoMin: 70,
      tempoMax: 130,
      icon: '💃'
    },
    {
      id: 'smart-joyful-waltz',
      name: '🔔 Joyful Waltz 3/4 (Valse Hân Hoan Mừng Lễ)',
      shortName: 'Joyful Valse 3/4',
      description: 'Nhịp điệu khiêu vũ rộn ràng, rải hoa mỹ mừng Chúa Giáng Sinh & Phục Sinh',
      meter: '3/4',
      instrumentFamily: 'piano',
      category: 'waltz',
      tempoMin: 110,
      tempoMax: 165,
      icon: '🔔'
    },

    // ─── NHÓM 3: NHỊP 6/8 ──────────────────────────────────────────
    {
      id: 'smart-slowrock-6-8',
      name: '🌊 Slow Rock Thánh Ca 6/8 (Sóng Biển Dập Dềnh)',
      shortName: 'Slow Rock 6/8',
      description: 'Linh hồn nhạc Thánh Ca: Rải 1-2-3, 4-5-6 nhịp nhàng như sóng biển, Bass phách 1 & 4',
      meter: '6/8',
      instrumentFamily: 'piano',
      category: 'slowrock',
      tempoMin: 45,
      tempoMax: 90,
      icon: '🌊'
    },
    {
      id: 'smart-ballad-6-8',
      name: '🕊️ Ballad 6/8 (Trang Nghiêm & Trầm Hùng)',
      shortName: 'Ballad 6/8',
      description: 'Nhịp dậm 2 phách chính sâu lắng, bè đệm ngân vang cho các bài nguyện ca',
      meter: '6/8',
      instrumentFamily: 'piano',
      category: 'slowrock',
      tempoMin: 45,
      tempoMax: 85,
      icon: '🕊️'
    },

    // ─── NHÓM 4: NHỊP 2/4 ──────────────────────────────────────────
    {
      id: 'smart-march',
      name: '🎺 Hành Khúc Joyful March 2/4 (Hân Hoan Tiến Bước)',
      shortName: 'March 2/4',
      description: 'Nhịp 1 - 2 dứt khoát, rộn ràng, Bass luân phiên bậc 1 và 5 oai hùng',
      meter: '2/4',
      instrumentFamily: 'piano',
      category: 'march',
      tempoMin: 80,
      tempoMax: 135,
      icon: '🎺'
    },
    {
      id: 'smart-fox',
      name: '🦊 Fox / Polka 2/4 (Tươi Vui Rộn Rã)',
      shortName: 'Fox / Polka 2/4',
      description: 'Tiết tấu nhanh vui, nảy phách, rất thích hợp các bài thiếu nhi và sinh hoạt',
      meter: '2/4',
      instrumentFamily: 'piano',
      category: 'fox',
      tempoMin: 95,
      tempoMax: 145,
      icon: '🦊'
    },

    // ─── NHÓM 5: MỌI NHỊP (ALL METERS) ────────────────────────────
    {
      id: 'smart-hymn',
      name: '⛪️ Thánh Ca 4 Bè SATB (Hòa Âm Trang Trọng)',
      shortName: 'Hòa Âm 4 Bè',
      description: 'Đệm dày dặn 4 bè SATB với tiếng Grand Piano và Organ ngân vang thính phòng',
      meter: 'all',
      instrumentFamily: 'piano',
      category: 'choral',
      tempoMin: 50,
      tempoMax: 120,
      icon: '⛪️'
    },
    {
      id: 'organ-church-4-4-v1',
      name: '🏛 Organ Đại Thánh Đường (Pedal Bass & Ngân Dài)',
      shortName: 'Organ Giáo Đường',
      description: 'Hợp âm Organ nhà thờ vang dội với bè Bass Pedal trầm ấm sâu lắng',
      meter: 'all',
      instrumentFamily: 'organ',
      category: 'organ',
      tempoMin: 50,
      tempoMax: 110,
      icon: '🏛'
    }
  ];

  function getAll() {
    return [...PATTERNS];
  }

  function getById(id) {
    return PATTERNS.find(p => p.id === id) || PATTERNS[0];
  }

  function getForMeter(meter) {
    if (!meter || meter === 'all') return PATTERNS;
    return PATTERNS.filter(p => p.meter === meter || p.meter === 'all');
  }

  function getRecommendedFor(beats, beatType) {
    let targetMeter = '4/4';
    if (beats === 3 && beatType === 4) targetMeter = '3/4';
    else if (beats === 6 && beatType === 8) targetMeter = '6/8';
    else if (beats === 2 && beatType === 4) targetMeter = '2/4';
    else if (beats === 4 && beatType === 4) targetMeter = '4/4';

    return {
      targetMeter,
      patterns: getForMeter(targetMeter)
    };
  }

  return {
    getAll,
    getById,
    getForMeter,
    getRecommendedFor
  };
})();

if (typeof window !== 'undefined') {
  window.PatternLibrary = PatternLibrary;
}
