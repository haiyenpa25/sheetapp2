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
    const dkMatch = text.match(/^\[?(ĐK|đk|DC|Điệp\s*khúc|Chorus)\]?[:.\s-]*(.*)/is);
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
          if (window.GuitarLens?.isSimplifyActive?.()) str = window.GuitarLens.simplifyChord(str);
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
  function _renderInlineSection(syllables, key) {
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
      let cStr = w.chord;
      if (cStr && window.GuitarLens?.isSimplifyActive?.()) cStr = window.GuitarLens.simplifyChord(cStr);
      const nStyle = window.HarmonicNumeral?.getNotationStyle?.() || 'standard';
      if (cStr && nStyle !== 'standard' && window.HarmonicNumeral?.convertChord) {
        cStr = window.HarmonicNumeral.convertChord(cStr, key);
      }
      const safeChord = cStr ? (window.SafeHtml ? window.SafeHtml.escape(cStr) : cStr) : '';
      const safeText  = w.text  ? (window.SafeHtml ? window.SafeHtml.escape(w.text)  : w.text)  : '';
      if (w.chord) {
        html += `<span class="lvi-token"><span class="lvi-chord">[${safeChord}]</span>${w.text ? ` <span class="lvi-word">${safeText}</span>` : ''}</span> `;
      } else if (w.text) {
        html += `<span class="lvi-token lvi-word-only">${safeText}</span> `;
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
    const actualTranspose = window.Store?.get?.('currentTranspose') ?? window.App?.getCurrentTranspose?.() ?? transposeOffset ?? 0;
    let key = document.getElementById('song-key')?.textContent?.trim() || '';
    if (key === '--') key = '';
    if (window.KeyService?.displayKey) {
      const origKey = window.Store?.get?.('currentSong')?.defaultKey || window.SongInfoBar?.getSongKey?.() || '';
      if (origKey) {
        key = window.KeyService.displayKey(origKey, actualTranspose) || key;
      }
    }
    let html = '<div class="lv-wrapper">';

    if (title && title !== 'Chọn bài hát để bắt đầu') {
      const isGuitar = window.StageLens?.getCurrentRole?.() === 'guitar' || document.body?.dataset?.stageLens === 'guitar';
      const personalCapo = isGuitar ? (window.GuitarLens?.getPersonalCapo?.() || 0) : 0;
      const capoBadge = personalCapo > 0
        ? `<span class="lv-capo-badge" style="margin-left:6px;padding:2px 7px;border-radius:4px;background:var(--accent-amber,#f59e0b);color:#18181b;font-size:0.75rem;font-weight:700;">🎸 Capo ${personalCapo}</span>` : '';
      const trBadge = actualTranspose !== 0
        ? `<span class="lv-trans-badge">${actualTranspose > 0 ? '+' : ''}${actualTranspose}</span>` : '';
      const modeLabel   = isInline ? '↕ Dạng Hợp Âm' : '≡ Dạng Inline';
      const modeTitle   = isInline ? 'Chuyển sang kiểu hợp âm trên lời' : 'Chuyển sang kiểu hợp âm trong dòng';
      html += `
        <header class="lv-header">
          <div class="lv-header-top">
            <h2 class="lv-title">${title}</h2>
            <button class="lv-mode-btn" id="lv-mode-toggle" title="${modeTitle}">${modeLabel}</button>
          </div>
          ${key ? `<p class="lv-key">🎼 Tông <strong>${key}</strong>${trBadge}${capoBadge}</p>` : ''}
        </header>`;
    }

    for (const view of views) {
      const sectionClass = view.isChorus ? 'lv-chorus' : 'lv-regular';
      const labelIcon = view.isChorus ? '✦' : '';
      const safeNum = window.SafeHtml ? window.SafeHtml.escape(String(view.num)) : String(view.num);

      html += `
        <section class="lv-verse ${sectionClass}" data-verse-num="${safeNum}">
          <div class="lv-label-row">
            <span class="lv-verse-pill ${view.isChorus ? 'lv-pill-chorus' : 'lv-pill-verse'}">
              ${labelIcon ? `<span class="lv-pill-icon">${labelIcon}</span>` : ''}${window.SafeHtml ? window.SafeHtml.escape(view.label) : view.label}
            </span>
          </div>`;

      if (isInline) {
        // Inline mode: [C] word word [D] word
        html += `<p class="lvi-line">${_renderInlineSection(view.syllables, key)}</p>`;
      } else {
        // Stacked mode: chord trên, lyric dưới
        html += `<div class="lv-flow">`;
        for (const syl of view.syllables) {
          const spClass = syl.isWordEnd ? 'lv-we' : 'lv-wm';
          const rest    = !syl.text || syl.text === '\u00a0';
          let cStr = syl.chord;
          if (cStr && window.GuitarLens?.isSimplifyActive?.()) cStr = window.GuitarLens.simplifyChord(cStr);
          const nStyle = window.HarmonicNumeral?.getNotationStyle?.() || 'standard';
          if (cStr && nStyle !== 'standard' && window.HarmonicNumeral?.convertChord) {
            cStr = window.HarmonicNumeral.convertChord(cStr, key);
          }
          let chordDisplay = cStr ? (window.SafeHtml ? window.SafeHtml.escape(cStr) : cStr) : '';
          const isBassRole = window.StageLens?.getCurrentRole?.() === 'bass' || document.body?.dataset?.stageLens === 'bass';
          if (cStr && isBassRole && window.BassLens?.isBigBassActive?.() && nStyle === 'standard') {
            const bInfo = window.BassLens.parseBassInfo(cStr);
            if (bInfo) {
              const safeBass = window.SafeHtml ? window.SafeHtml.escape(bInfo.bassNote) : bInfo.bassNote;
              const safeFull = window.SafeHtml ? window.SafeHtml.escape(bInfo.fullChord) : bInfo.fullChord;
              chordDisplay = bInfo.isSlash
                ? `<span class="lv-bass-root">${safeBass}</span><span class="lv-bass-sub">(${safeFull})</span>`
                : `<span class="lv-bass-root">${safeBass}</span>`;
            }
          }
          const safeChord = cStr ? (window.SafeHtml ? window.SafeHtml.escape(cStr) : cStr) : '';
          const safeText = syl.text ? (window.SafeHtml ? window.SafeHtml.escape(syl.text) : syl.text) : '';
          const chordEl = cStr
            ? `<b class="lv-chord ${isBassRole ? 'lv-chord-bass' : ''}" data-chord="${safeChord}">${chordDisplay}</b>`
            : `<b class="lv-chord lv-chord-empty"></b>`;
          const sylEl = rest
            ? `<span class="lv-syl lv-rest">\u00a0\u00a0</span>`
            : `<span class="lv-syl">${safeText}</span>`;
          html += `<span class="lv-pair ${spClass}">${chordEl}${sylEl}</span>`;
        }
        html += `</div>`;
      }

      html += `</section>`;
    }

    html += '</div>';
    container.innerHTML = html;
    _applyStyles(container);
    highlightVerse(window.VerseManager?.getCurrentVerse?.() || 1);

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

  function highlightVerse(verseNum) {
    const container = document.getElementById('lyric-view-container');
    if (!container) return;
    const vStr = String(verseNum || 1);
    const verses = container.querySelectorAll('.lv-verse');
    verses.forEach(sec => {
      const isTarget = sec.getAttribute('data-verse-num') === vStr;
      sec.classList.toggle('lv-active-verse', isTarget);
    });
  }

  function _applyStyles(container) {
    // Ticket L1-7: Hợp âm lớn 24-32px chuẩn sân khấu
    const preset = window.DisplaySettings?.getChordPreset?.() || 'standard';
    let baseChordSize = '26px';
    if (preset === 'stage') {
      baseChordSize = '30px';
    } else if (preset === 'high-contrast') {
      baseChordSize = '28px';
    }
    container.style.setProperty('--lv-chord-size', baseChordSize);
    container.style.setProperty('--lv-syl-size', '21px');

    const p = window.DisplaySettings?.getChordPrefs?.();
    if (p) {
      if (p.color) container.style.setProperty('--lv-chord-color', p.color);
      if (p.size && p.size > 3.0) {
        container.style.setProperty('--lv-chord-size', Math.round(p.size * 8.5) + 'px');
      }
    } else {
      try {
        const s = localStorage.getItem('sheetapp_chord_prefs');
        if (s) {
          const c = JSON.parse(s);
          if (c.color) container.style.setProperty('--lv-chord-color', c.color);
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

  return { render, extract, reloadIfActive, highlightVerse };
})();

window.LyricExtractor = LyricExtractor;
