/**
 * assets/js/osmd-svg-text.js
 * Nhận diện các node <text> trong SVG do OSMD vẽ, dựa trên mô hình đồ hoạ của OSMD
 * (không đoán theo cỡ chữ / toạ độ).
 *
 * Dùng bởi: osmd-renderer.js (_compactTitleSVG, _tagChordSymbols)
 * Public API: { CHORD_TEXT_REGEX, getMetaTextNodes(osmd), getLyricTextNodes(osmd) }
 */
const OSMDSvgText = (() => {
  'use strict';

  const CHORD_TEXT_REGEX = /^[A-G][b#]?(m|maj|min|dim|aug|sus|add|M)?[0-9]?(\/[A-G][b#]?)?$/;

  function _textNodeOf(label) {
    const n = label?.SVGNode || label?.svgNode;
    if (!n) return null;
    return n.tagName?.toLowerCase() === 'text' ? n : (n.querySelector?.('text') || null);
  }

  /** Tiêu đề + các dòng phụ (phụ đề, tác giả nhạc, tác giả lời, bản quyền). */
  function getMetaTextNodes(osmd) {
    const g = osmd?.graphic;
    return {
      title: _textNodeOf(g?.Title),
      meta: [g?.Subtitle, g?.Composer, g?.Lyricist, g?.Copyright].map(_textNodeOf).filter(Boolean)
    };
  }

  /** Tập node <text> của lời bài hát — để âm tiết như "A" (A-men) không bị coi là hợp âm. */
  function getLyricTextNodes(osmd) {
    const nodes = new Set();
    try {
      osmd?.graphic?.measureList?.forEach(sys => sys?.forEach(m => m?.staffEntries?.forEach(se => {
        (se?.LyricsEntries || se?.lyricsEntries || []).forEach(le => {
          const t = _textNodeOf(le?.GraphicalLabel || le?.graphicalLabel);
          if (t) nodes.add(t);
        });
      })));
    } catch (_) {}
    return nodes;
  }

  return { CHORD_TEXT_REGEX, getMetaTextNodes, getLyricTextNodes };
})();

window.OSMDSvgText = OSMDSvgText;
