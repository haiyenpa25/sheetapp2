/**
 * lyric-extractor.js — v3.2
 * Word-wrap flow: tất cả syllables chảy tự do trong 1 flex container.
 * + Inline mode: hợp âm [C] nằm ngay trong dòng lời.
 */
const LyricExtractor = (() => {
  'use strict';

  const MODE_KEY = 'sheetapp_lyric_mode'; // 'stacked' | 'inline'
  let _currentMode = localStorage.getItem(MODE_KEY) || 'stacked';

  /* ─── Transpose chord text ─── */
  function _transposeChordText(chordStr, semitones) {
    if (!chordStr || semitones === 0) return chordStr;
    // TransposeEngine.transposeChord có fallback nội bộ (không cần Tonal.js)
    if (window.TransposeEngine?.transposeChord) {
      return window.TransposeEngine.transposeChord(chordStr, semitones) || chordStr;
    }
    // Tonal.js trực tiếp (only when TransposeEngine not available at all)
    if (!window.Tonal) return chordStr;
    try {
      const match = chordStr.match(/^([A-G][#b]?)(.*)/);
      if (!match) return chordStr;
      const root   = match[1];
      const suffix = match[2] || '';
      const INTERVALS = ['1P','2m','2M','3m','3M','4P','4A','5P','6m','6M','7m','7M'];
      const dir = semitones < 0 ? '-' : '';
      const abs = Math.abs(semitones) % 12;
      const interval = dir + INTERVALS[abs];
      const newRoot = window.Tonal.Note.transpose(root, interval);
      if (!newRoot) return chordStr;
      return newRoot + suffix;
    } catch(e) {
      return chordStr;
    }
  }

  /* ─── Parse <harmony> → chord text ─── */
  function parseHarmonyToText(h) {
    const step  = h.querySelector('root-step')?.textContent?.trim() || '';
    const alter = h.querySelector('root-alter')?.textContent?.trim();
    const kind  = h.querySelector('kind')?.getAttribute('text') || '';
    let str = step + (alter === '1' ? '#' : alter === '-1' ? 'b' : '') + kind;
    const bs = h.querySelector('bass > bass-step')?.textContent?.trim();
    if (bs) {
      const ba = h.querySelector('bass > bass-alter')?.textContent?.trim();
      str += '/' + bs + (ba === '1' ? '#' : ba === '-1' ? 'b' : '');
    }
    return str;
  }

  /* ─── Clean verse-number prefix ─── */
  function cleanFirstSyl(text) {
    if (!text) return { text, isChorus: false };
    const dkMatch = text.match(/^(ĐK|đk|DC|Điệp\s*khúc|Chorus)[:.\s]*(.*)/is);
    if (dkMatch) return { text: dkMatch[2].trim(), isChorus: true };
    const numMatch = text.match(/^\d+[\.\s]+(.*)/);
    if (numMatch) return { text: numMatch[1].trim(), isChorus: false };
    return { text, isChorus: false };
  }

  /* ─── Extract syllables per verse ─── */
  function extract(xmlString, transposeOffset = 0) {
    const doc = new DOMParser().parseFromString(xmlString, 'text/xml');
    const part = doc.querySelector('part');
    if (!part) return [];

    const measures = part.querySelectorAll('measure');
    const verseMap   = {};
    const verseLabel = {};
    let currentChord = null;
    const known = new Set();

    measures.forEach(m => {
      for (const c of m.children) {
        if (c.tagName === 'harmony') {
          let str = parseHarmonyToText(c);
          const custom = c.hasAttribute('color');
          if (!custom && transposeOffset !== 0) str = _transposeChordText(str, transposeOffset);
          currentChord = str;

        } else if (c.tagName === 'note') {
          if (c.querySelector('chord') || c.querySelector('grace')) continue;

          if (c.querySelector('rest')) {
            if (currentChord) {
              known.forEach(n => { verseMap[n].push({ text: '\u00a0', chord: currentChord, isWordEnd: true }); });
              currentChord = null;
            }
            continue;
          }

          const lyrics = c.querySelectorAll('lyric');
          if (lyrics.length > 0) {
            lyrics.forEach(lyr => {
              const num = lyr.getAttribute('number') || '1';
              const raw = lyr.querySelector('text')?.textContent || '';
              const syl = lyr.querySelector('syllabic')?.textContent || 'single';
              const isEnd = syl === 'single' || syl === 'end';

              if (!verseMap[num]) {
                verseMap[num] = [];
                const { text: cleaned, isChorus } = cleanFirstSyl(raw);
                verseLabel[num] = isChorus ? 'chorus' : ('verse:' + num);
                known.add(num);
                verseMap[num].push({ text: cleaned, chord: currentChord, isWordEnd: isEnd });
              } else {
                verseMap[num].push({ text: raw, chord: currentChord, isWordEnd: isEnd });
              }
            });
            currentChord = null;
          } else if (currentChord) {
            known.forEach(n => { verseMap[n]?.push({ text: '\u00a0', chord: currentChord, isWordEnd: true }); });
            currentChord = null;
          }
        }
      }
    });

    const sorted = Array.from(known).sort((a, b) => parseInt(a) - parseInt(b));
    const views = [];
    for (const num of sorted) {
      const syls = (verseMap[num] || []).filter(s => s.text.trim() || s.chord);
      if (!syls.length) continue;
      const raw = verseLabel[num] || ('verse:' + num);
      const isChorus = raw === 'chorus';
      const idx = raw.match(/verse:(\d+)/)?.[1] || num;
      views.push({ num, label: isChorus ? 'Điệp Khúc' : 'Lời ' + idx, isChorus, syllables: syls });
    }
    return views;
  }

  /* ─── Build inline HTML từ syllables ─── */
  function _renderInlineSection(syllables) {
    // Ghép syllable thành words, chord lấy từ syl đầu của mỗi word
    const words = [];
    let buf = '', chordBuf = null, firstOfWord = true;

    for (const syl of syllables) {
      if (firstOfWord && syl.chord) chordBuf = syl.chord;
      const t = (syl.text === '\u00a0' || !syl.text) ? '' : syl.text;
      buf += t;
      if (syl.isWordEnd) {
        const wordText = buf.trim();
        if (chordBuf || wordText) words.push({ chord: chordBuf, text: wordText });
        buf = ''; chordBuf = null; firstOfWord = true;
      } else {
        firstOfWord = false;
      }
    }
    if (buf.trim() || chordBuf) words.push({ chord: chordBuf, text: buf.trim() });

    let html = '';
    for (const w of words) {
      if (w.chord) {
        html += `<span class="lvi-token"><span class="lvi-chord">[${w.chord}]</span>${w.text ? ` <span class="lvi-word">${w.text}</span>` : ''}</span> `;
      } else if (w.text) {
        html += `<span class="lvi-token lvi-word-only">${w.text}</span> `;
      }
    }
    return html;
  }

  /* ─── Render (stacked hoặc inline) ─── */
  function render(containerId, xmlString, transposeOffset = 0) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    if (!xmlString) {
      container.innerHTML = `<div class="lv-empty"><span>🎵</span><p>Đang tải...</p></div>`;
      return;
    }

    const views = extract(xmlString, transposeOffset);
    if (!views.length) {
      container.innerHTML = `<div class="lv-empty"><span>🎵</span><strong>Không có lời bài hát</strong><p>File nhạc này chưa có Lyrics trong chuẩn MusicXML.</p></div>`;
      return;
    }

    const isInline = _currentMode === 'inline';
    const title = document.getElementById('song-title')?.textContent?.trim() || '';
    const key   = document.getElementById('song-key')?.textContent?.trim()   || '';
    let html = '<div class="lv-wrapper">';

    if (title && title !== 'Chọn bài hát để bắt đầu') {
      const trBadge = transposeOffset !== 0
        ? `<span class="lv-trans-badge">${transposeOffset > 0 ? '+' : ''}${transposeOffset}</span>` : '';
      const modeLabel   = isInline ? '↕ Dạng Hợp Âm' : '≡ Dạng Inline';
      const modeTitle   = isInline ? 'Chuyển sang kiểu hợp âm trên lời' : 'Chuyển sang kiểu hợp âm trong dòng';
      html += `
        <header class="lv-header">
          <div class="lv-header-top">
            <h2 class="lv-title">${title}</h2>
            <button class="lv-mode-btn" id="lv-mode-toggle" title="${modeTitle}">${modeLabel}</button>
          </div>
          ${key ? `<p class="lv-key">🎼 Giọng <strong>${key}</strong>${trBadge}</p>` : ''}
        </header>`;
    }

    for (const view of views) {
      const sectionClass = view.isChorus ? 'lv-chorus' : 'lv-regular';
      const labelIcon = view.isChorus ? '✦' : '';

      html += `
        <section class="lv-verse ${sectionClass}">
          <div class="lv-label-row">
            <span class="lv-verse-pill ${view.isChorus ? 'lv-pill-chorus' : 'lv-pill-verse'}">
              ${labelIcon ? `<span class="lv-pill-icon">${labelIcon}</span>` : ''}${view.label}
            </span>
          </div>`;

      if (isInline) {
        // Inline mode: [C] word word [D] word
        html += `<p class="lvi-line">${_renderInlineSection(view.syllables)}</p>`;
      } else {
        // Stacked mode: chord trên, lyric dưới
        html += `<div class="lv-flow">`;
        for (const syl of view.syllables) {
          const spClass = syl.isWordEnd ? 'lv-we' : 'lv-wm';
          const rest    = !syl.text || syl.text === '\u00a0';
          const chordEl = syl.chord
            ? `<b class="lv-chord">${syl.chord}</b>`
            : `<b class="lv-chord lv-chord-empty"></b>`;
          const sylEl = rest
            ? `<span class="lv-syl lv-rest">\u00a0\u00a0</span>`
            : `<span class="lv-syl">${syl.text}</span>`;
          html += `<span class="lv-pair ${spClass}">${chordEl}${sylEl}</span>`;
        }
        html += `</div>`;
      }

      html += `</section>`;
    }

    html += '</div>';
    container.innerHTML = html;
    _applyStyles(container);

    // Bind toggle
    document.getElementById('lv-mode-toggle')?.addEventListener('click', () => {
      _currentMode = _currentMode === 'stacked' ? 'inline' : 'stacked';
      localStorage.setItem(MODE_KEY, _currentMode);
      window.URLState?.update?.({ lv: _currentMode });
      if (window.DisplaySettings?.renderLyricViewIfActive) {
        window.DisplaySettings.renderLyricViewIfActive();
      } else {
        render(containerId, xmlString, transposeOffset);
      }
    });
  }

  function _applyStyles(container) {
    const p = window.DisplaySettings?.getChordPrefs?.();
    if (p) {
      if (p.color) container.style.setProperty('--lv-chord-color', p.color);
      if (p.size) {
        const em = Math.max(0.65, Math.min(1.1, p.size * 0.22));
        container.style.setProperty('--lv-chord-size', em + 'em');
      }
    } else {
      try {
        const s = localStorage.getItem('sheetapp_chord_prefs');
        if (s) {
          const c = JSON.parse(s);
          if (c.color) container.style.setProperty('--lv-chord-color', c.color);
          if (c.size)  container.style.setProperty('--lv-chord-size', Math.max(0.65, Math.min(1.1, c.size * 0.22)) + 'em');
        }
      } catch (_) {}
    }
  }

  function reloadIfActive() {
    const el = document.getElementById('lyric-view-container');
    if (!el || el.classList.contains('hidden')) return;
    if (window.DisplaySettings?.renderLyricViewIfActive) {
      window.DisplaySettings.renderLyricViewIfActive();
      return;
    }
    const raw = window.App?.getOriginalXml?.();
    if (!raw) return;
    render('lyric-view-container', raw, window.App?.getCurrentTranspose?.() || 0);
  }

  return { render, extract, reloadIfActive };
})();

window.LyricExtractor = LyricExtractor;
