/**
 * assets/js/osmd-svg-text.js
 * Nhận diện các node <text> trong SVG do OSMD vẽ, dựa trên mô hình đồ hoạ của OSMD
 * (không đoán theo cỡ chữ / toạ độ).
 *
 * Dùng bởi: osmd-renderer.js (_compactTitleSVG, _tagChordSymbols, chế độ Gọn nhẹ)
 * Public API: { CHORD_TEXT_REGEX, getMetaTextNodes(osmd), getLyricTextNodes(osmd), compactTitle(osmd, container), hideRepeatLabels(container, hide) }
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
    } catch (_) { /* node lời thiếu/đổi cấu trúc theo bản OSMD: trả tập đã gom được */ }
    return nodes;
  }

  /** Tinh chỉnh tiêu đề SVG sau render. Trả true khi đã xử lý xong (không cần thử lại), false khi chưa có SVG. */
  function compactTitle(osmd, container) {
    if (!container) return false;
    const svg = container.querySelector('svg');
    if (!svg) return false;

    const texts = Array.from(svg.querySelectorAll('text')).filter(t => !(t.getAttribute('font-family') || '').includes('OSMDChordFont'));
    if (!texts.length) return true;

    // Ưu tiên node thật của OSMD. Đoán "chữ to nhất = tiêu đề" sai khi hợp âm
    // được phóng to (preset Sân khấu) — hợp âm đầu tiên bị gắn nhầm class tiêu đề.
    const { title: graphicTitle, meta: metaNodes } = getMetaTextNodes(osmd);
    let titleEl = graphicTitle;
    let maxSize = titleEl ? parseFloat(titleEl.getAttribute('font-size') || '0') : 0;
    if (!titleEl) {
      // OSMD không vẽ tiêu đề (vd. chế độ điện thoại) → chỉ nhận chữ thật sự lớn hơn lời,
      // có ≥3 ký tự chữ; nếu không có thì bỏ qua (tránh gắn nhầm dấu "-" hay hợp âm).
      const lyricNodes = getLyricTextNodes(osmd);
      const lyricFs = Math.max(0, ...[...lyricNodes].map(t => parseFloat(t.getAttribute('font-size') || '0')));
      texts.forEach(t => {
        const s = t.textContent.trim();
        if (lyricNodes.has(t) || CHORD_TEXT_REGEX.test(s) || s.length < 3 || !/\p{L}{2}/u.test(s)) return;
        const fs = parseFloat(t.getAttribute('font-size') || '0');
        if (fs > lyricFs + 2 && fs > maxSize) { maxSize = fs; titleEl = t; }
      });
    }

    if (titleEl) {
      titleEl.classList.add('osmd-title-text');
      const tspan = titleEl.querySelector('tspan');
      if (tspan) {
        const raw = tspan.textContent.trim();
        if (raw === raw.toUpperCase() && raw.length > 2 && !/^\d+$/.test(raw)) {
          tspan.textContent = raw.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
        }
      }

      const isMobile = typeof window !== 'undefined' && window.innerWidth <= 680;
      const titleContent = (titleEl.querySelector('tspan') || titleEl).textContent.trim().toLowerCase();
      texts.forEach(t => {
        if (t === titleEl) return;
        const content = t.textContent.trim().toLowerCase(), fs = parseFloat(t.getAttribute('font-size') || '0');
        if (content === titleContent && fs < maxSize) t.style.display = 'none';
      });
      // Điện thoại: chỉ ẩn dòng tác giả/lời/bản quyền. Trước đây ẩn mọi chữ trong
      // vòng 160 đơn vị quanh tiêu đề → mất luôn khổ 1–3 của hàng nhạc đầu tiên.
      if (isMobile) metaNodes.forEach(t => { t.classList.add('osmd-meta-text'); t.style.display = 'none'; });
    }

    svg.querySelectorAll('rect').forEach(rect => {
      const height = parseFloat(rect.getAttribute('height') || '999'), fill = rect.getAttribute('fill') || '', stroke = rect.getAttribute('stroke') || '';
      if (height < 40 && stroke && stroke !== 'none' && fill === 'none') rect.style.display = 'none';
    });
    return true;
  }

  /**
   * Ẩn/hiện chữ Điệp Khúc, Coda, D.C., Fine... trong SVG khi compact mode bật.
   * Các text này xuất phát từ <rehearsal> hoặc <direction><words> trong MusicXML.
   */
  function hideRepeatLabels(container, hide) {
    if (!container) return;
    const svg = container.querySelector('svg');
    if (!svg) return;

    const REPEAT_PATTERN = /^(đi[eệ]p\s*kh[úu]c|coda|d\.?c\.?|da\s*capo|fine|segno|d\.?s\.?|chorus|refrain)/i;

    svg.querySelectorAll('text').forEach(t => {
      const txt = t.textContent.trim();
      if (REPEAT_PATTERN.test(txt)) {
        t.style.display = hide ? 'none' : '';
      }
    });
  }

  return { CHORD_TEXT_REGEX, getMetaTextNodes, getLyricTextNodes, compactTitle, hideRepeatLabels };
})();

window.OSMDSvgText = OSMDSvgText;
