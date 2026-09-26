/**
 * live-band/js/projector-slides.js — MusicXML Lyric Parsing & Slide Chunking Engine
 * 
 * Part of Ticket T12 (Epic 3.4).
 * Responsibilities:
 * 1. Safe parsing of MusicXML lyric elements (filtering verse 1 to avoid verse interleaving).
 * 2. Smart slide chunking (grouping consecutive lines into slides of 2-3 lines).
 * 3. Highlighting active slide and line based on live measure progression.
 * 4. Safe liturgical slide rendering (scripture, prayer, announcement).
 * 5. Strict XSS defense via window.SafeHtml.
 */
(function(root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ProjectorSlides = factory();
  }
})(typeof self !== 'undefined' ? self : this, function() {
  'use strict';

  function escapeHtml(str) {
    if (typeof window !== 'undefined' && window.SafeHtml && typeof window.SafeHtml.escape === 'function') {
      return window.SafeHtml.escape(str);
    }
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Parse MusicXML and generate slide chunks
   * @param {string} xmlText 
   * @param {number} linesPerSlide 
   * @returns {{ slides: Array, rawLines: Array }}
   */
  function parseMusicXmlLyrics(xmlText, linesPerSlide = 3) {
    if (!xmlText || typeof xmlText !== 'string') {
      return { slides: [], rawLines: [] };
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'text/xml');
    const measures = doc.querySelectorAll('measure');

    const rawLines = [];

    measures.forEach((m, mIdx) => {
      const lyricElements = Array.from(m.querySelectorAll('lyric'));
      if (lyricElements.length === 0) return;

      // Ưu tiên lời của Verse 1 (number="1" hoặc không có number) để tránh trộn lẫn các lời
      const hasVerse1 = lyricElements.some(l => {
        const num = l.getAttribute('number');
        return num === '1' || num === null || num === '';
      });

      const words = [];
      lyricElements.forEach(l => {
        const num = l.getAttribute('number');
        if (!hasVerse1 || num === '1' || num === null || num === '') {
          const textEl = l.querySelector('text');
          const text = textEl ? textEl.textContent.trim() : '';
          if (text) words.push(text);
        }
      });

      if (words.length > 0) {
        rawLines.push({
          measure: mIdx + 1,
          text: words.join(' ')
        });
      }
    });

    if (rawLines.length === 0) {
      return { slides: [], rawLines: [] };
    }

    const slides = [];
    for (let i = 0; i < rawLines.length; i += linesPerSlide) {
      const chunk = rawLines.slice(i, i + linesPerSlide);
      slides.push({
        startMeasure: chunk[0].measure,
        endMeasure: chunk[chunk.length - 1].measure,
        lines: chunk
      });
    }

    return { slides, rawLines };
  }

  /**
   * Render slide hiện hành lên content DOM
   */
  function renderCurrentSlide(contentEl, slideCounterEl, slides, activeSlideIdx, activeLineIdx, songTitle) {
    if (!contentEl || !slides || slides.length === 0) return;
    const slide = slides[activeSlideIdx];
    if (!slide) return;

    if (slideCounterEl) {
      slideCounterEl.textContent = `Slide ${activeSlideIdx + 1}/${slides.length}`;
    }

    contentEl.innerHTML = `
      <div class="projector-slide-wrap" id="projector-slide-wrap">
        <div class="projector-song-heading">${window.SafeHtml.escape(songTitle || '')}</div>
        <div class="projector-lyrics-box">
          ${slide.lines.map((l, idx) => `
            <div class="projector-line ${idx === activeLineIdx ? 'active' : ''}" data-measure="${Number.parseInt(l.measure, 10) || 0}">
              ${window.SafeHtml.escape(l.text)}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  /**
   * Tính toán slide và dòng khớp với ô nhịp
   */
  function calculateMeasureHighlight(slides, measure) {
    if (!slides || slides.length === 0) return { targetSlideIdx: -1, bestLineIdx: 0 };

    let targetSlideIdx = -1;
    for (let s = 0; s < slides.length; s++) {
      const slide = slides[s];
      if (measure >= slide.startMeasure && (s === slides.length - 1 || measure < slides[s + 1].startMeasure)) {
        targetSlideIdx = s;
        break;
      }
    }

    if (targetSlideIdx === -1) {
      targetSlideIdx = 0;
    }

    const curSlide = slides[targetSlideIdx];
    let bestLineIdx = 0;
    if (curSlide && Array.isArray(curSlide.lines)) {
      curSlide.lines.forEach((l, idx) => {
        if (measure >= l.measure) bestLineIdx = idx;
      });
    }

    return { targetSlideIdx, bestLineIdx };
  }

  /**
   * Hiển thị mục phụng vụ không phải bài hát (Non-song liturgical items)
   */
  function renderLiturgicalSlide(contentEl, slideCounterEl, headerTitleEl, planBadgeEl, item) {
    if (slideCounterEl) slideCounterEl.textContent = '';
    const typeLabels = {
      prayer: 'LỜI NGUYỆN TÍN HỮU',
      scripture: 'BÀI ĐỌC THÁNH THƯ',
      liturgy: 'NGHI THỨC PHỤNG VỤ',
      announcement: 'THÔNG BÁO MỤC VỤ'
    };
    const icons = {
      prayer: '🙏',
      scripture: '📖',
      liturgy: '⛪',
      announcement: '🔔'
    };

    const itemType = item.itemType || 'liturgy';
    const typeTitle = typeLabels[itemType] || 'PHỤNG VỤ';
    const icon = icons[itemType] || '⛪';
    const customTitle = item.customTitle || typeTitle;
    const leaderNotes = item.leaderNotes || '';
    const itemNum = (item.itemIndex >= 0 && item.totalItems) ? `[MỤC ${item.itemIndex + 1}/${item.totalItems}] • ` : '';

    if (planBadgeEl) planBadgeEl.textContent = typeTitle;
    if (headerTitleEl) headerTitleEl.textContent = `${itemNum}${customTitle.toUpperCase()}`;

    if (contentEl) {
      contentEl.innerHTML = `
        <div class="liturgy-slide">
          <div class="liturgy-icon">${icon}</div>
          <div class="liturgy-title">${window.SafeHtml.escape(customTitle)}</div>
          ${item.customTitle && item.customTitle !== typeTitle ? `<div class="liturgy-subtitle">${window.SafeHtml.escape(typeTitle)}</div>` : ''}
          ${leaderNotes ? `<div class="liturgy-notes">${window.SafeHtml.escape(leaderNotes)}</div>` : ''}
        </div>
      `;
    }
  }

  return {
    parseMusicXmlLyrics,
    renderCurrentSlide,
    calculateMeasureHighlight,
    renderLiturgicalSlide
  };
});
