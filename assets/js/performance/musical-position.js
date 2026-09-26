/**
 * assets/js/performance/musical-position.js — Musical Position & Measure Locator
 * 
 * Maps musical coordinates (measure, beat, progress) to DOM elements across:
 * 1. OSMD Sheet SVG (GraphicalMeasures / Staves)
 * 2. Lyric View Rows
 * 3. Chord Canvas Overlay
 * 
 * Ensures synchronized viewing across devices with different screen sizes,
 * zoom ratios, staves visibility, and view modes.
 */
const MusicalPosition = (() => {
  'use strict';

  let _measurePositionsCache = [];
  let _lastComputedXml = null;

  /**
   * Tính toán và lưu cache tọa độ y của từng ô nhịp (1-indexed) trên giao diện hiện tại
   */
  function computeMeasurePositions() {
    _measurePositionsCache = [];
    const container = document.getElementById('osmd-container');
    const lyricView = document.getElementById('lyric-view-container');
    const wrapper   = document.querySelector('.sheet-viewer-wrapper');

    if (!wrapper) return;

    // 1. Chế độ Lời Nhạc (Lyric View)
    if (lyricView && !lyricView.classList.contains('hidden') && lyricView.style.display !== 'none') {
      const rows = lyricView.querySelectorAll('.lyric-line, .lyric-row, p');
      const wrapRect = wrapper.getBoundingClientRect();
      rows.forEach((row, idx) => {
        const r = row.getBoundingClientRect();
        _measurePositionsCache.push({
          measure: idx + 1,
          top: r.top - wrapRect.top + wrapper.scrollTop
        });
      });
      return;
    }

    // 2. Chế độ Bản Nhạc OSMD (SVG)
    if (!container) return;
    const osmd = window.OSMDRenderer?.getInstance?.();
    const sheet = osmd?.Sheet || osmd?.sheet;
    const measures = sheet?.SourceMeasures || [];

    if (measures.length === 0) return;

    const wrapRect = wrapper.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    // Duyệt qua GraphicalMeasures của OSMD
    const gMeasures = sheet?.GraphicSheet?.MeasureList || [];
    if (gMeasures.length > 0) {
      gMeasures.forEach((staffMeasures, mIdx) => {
        // Lấy measure đầu tiên trong hệ thống
        const gm = staffMeasures[0];
        if (gm && gm.PositionAndShape) {
          // OSMD đơn vị là Unit (10 Unit ~ 100px phụ thuộc zoom)
          // Tìm SVG element tương ứng hoặc tính qua bounding box
          const bbox = gm.PositionAndShape;
          const zoom = window.OSMDRenderer?.getCurrentZoom?.() || 1.0;
          const topPx = (bbox.AbsolutePosition.y * 10 * zoom);
          _measurePositionsCache.push({
            measure: mIdx + 1,
            top: topPx
          });
        }
      });
    }

    // Fallback nếu không đọc được từ GraphicSheet: ước tính phân bố đều theo chiều cao SVG
    if (_measurePositionsCache.length === 0 && measures.length > 0) {
      const svg = container.querySelector('svg');
      if (svg) {
        const svgHeight = svg.getBoundingClientRect().height;
        const perMeasure = svgHeight / measures.length;
        for (let i = 0; i < measures.length; i++) {
          _measurePositionsCache.push({
            measure: i + 1,
            top: i * perMeasure
          });
        }
      }
    }
  }

  /**
   * Lấy ô nhịp hiện tại mà mắt người đọc đang tập trung trên màn hình
   * (ở khoảng 25% - 35% từ đỉnh viewport xuống)
   */
  function getVisibleMeasure() {
    const wrapper = document.querySelector('.sheet-viewer-wrapper');
    if (!wrapper) return 1;

    // Nếu con trỏ OSMD đang chạy (AutoScroll / Audio Play)
    const osmd = window.OSMDRenderer?.getInstance?.();
    if (osmd?.cursor?.iterator && !osmd.cursor.isHidden) {
      const cur = osmd.cursor.iterator.CurrentMeasureIndex;
      if (cur !== undefined && cur >= 0) return cur + 1;
    }

    if (_measurePositionsCache.length === 0) {
      computeMeasurePositions();
    }

    if (_measurePositionsCache.length === 0) return 1;

    const scrollTop = wrapper.scrollTop;
    const focusY = scrollTop + (wrapper.clientHeight * 0.28);

    let current = _measurePositionsCache[0].measure;
    for (let i = 0; i < _measurePositionsCache.length; i++) {
      if (_measurePositionsCache[i].top <= focusY) {
        current = _measurePositionsCache[i].measure;
      } else {
        break;
      }
    }
    return current;
  }

  /**
   * Cuộn thiết bị Follower đến đúng ô nhịp (1-indexed) một cách êm ái
   * @param {number} measureNum - Số thứ tự ô nhịp
   * @param {boolean} smooth - Có sử dụng hiệu ứng smooth scroll không
   */
  function scrollToMeasure(measureNum, smooth = true) {
    const wrapper = document.querySelector('.sheet-viewer-wrapper');
    if (!wrapper) return;

    if (_measurePositionsCache.length === 0) {
      computeMeasurePositions();
    }

    if (_measurePositionsCache.length === 0) return;

    const found = _measurePositionsCache.find(p => p.measure === measureNum) 
               || _measurePositionsCache[Math.min(measureNum - 1, _measurePositionsCache.length - 1)];

    if (!found) return;

    // Trừ offset để ô nhịp nằm ở khoảng 25% từ trên xuống
    const targetScroll = Math.max(0, found.top - (wrapper.clientHeight * 0.22));

    // Tránh scroll nếu độ lệch quá nhỏ (< 30px) để không bị rung màn hình
    if (Math.abs(wrapper.scrollTop - targetScroll) > 30) {
      wrapper.scrollTo({
        top: targetScroll,
        behavior: smooth ? 'smooth' : 'auto'
      });
    }
  }

  // Lắng nghe render OSMD và Lyric View để cập nhật lại cache vị trí
  if (typeof EventBus !== 'undefined') {
    EventBus.on('song:loaded', () => {
      setTimeout(computeMeasurePositions, 300);
    });
  }

  return {
    computeMeasurePositions,
    getVisibleMeasure,
    scrollToMeasure
  };
})();

window.MusicalPosition = MusicalPosition;
