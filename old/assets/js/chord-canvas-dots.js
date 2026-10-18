/**
 * chord-canvas-dots.js — Note Mapping, Staff Alignment & Chord Dot Placement (Classic UI)
 */
const ChordCanvasDots = (() => {
  'use strict';

  const DOT_CLASS = 'cc-dot';
  const BTN_CLASS = 'cc-dot-btn';

  function alignDOMChords() {
    const container = document.getElementById('osmd-container');
    if (!container) return;

    const cRect = container.getBoundingClientRect();
    const scale = window.ChordCanvasUI?.getScale?.() || 1.0;
    const minLineW = Math.max(36, Math.round(100 * scale));
    const maxLineH = Math.max(3, Math.ceil(3.5 * scale));
    const dedupeGap = Math.max(2, Math.round(3 * scale));
    const SYS_GAP = Math.max(18, Math.round(38 * scale));
    const noteRange = Math.max(35, Math.round(65 * scale));
    const horizPad = Math.max(3, Math.round(6 * scale));

    const svg = container.querySelector('svg');
    if (!svg) return;

    let staffLineRects = [];
    const staveGroups = Array.from(svg.querySelectorAll('g.vf-stave'));

    if (staveGroups.length) {
      staveGroups.forEach(g => {
        const r = g.getBoundingClientRect();
        if (r.width > 30 * scale && r.height > 0 && r.top > 0) {
          staffLineRects.push(r.top - cRect.top);
        }
      });
    }

    if (!staffLineRects.length) {
      Array.from(svg.querySelectorAll('line, path')).forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.width > minLineW && r.height < maxLineH && r.top > 0) {
          staffLineRects.push(r.top - cRect.top);
        }
      });
    }

    if (!staffLineRects.length) {
      _alignDOMChordsFallback(container);
      return;
    }

    staffLineRects.sort((a, b) => a - b);
    const deduped = [staffLineRects[0]];
    for (let i = 1; i < staffLineRects.length; i++) {
      if (staffLineRects[i] - deduped[deduped.length - 1] > dedupeGap) {
        deduped.push(staffLineRects[i]);
      }
    }

    const systems = [];
    let sysStart = deduped[0], prev = deduped[0];
    for (let i = 1; i < deduped.length; i++) {
      const curr = deduped[i];
      if (curr - prev > SYS_GAP) {
        systems.push({ topLine: sysStart, bottomLine: prev });
        sysStart = curr;
      }
      prev = curr;
    }
    systems.push({ topLine: sysStart, bottomLine: prev });

    const allBadges = Array.from(
      container.querySelectorAll('.cc-edit-badge, .cc-chord-text, .cc-custom-chord-text, .cc-dot-btn')
    );
    if (!allBadges.length) return;

    const assigned = new Map();
    allBadges.forEach(badge => {
      const badgeY = parseFloat(badge.dataset.noteTop ?? badge.style.top);
      if (isNaN(badgeY)) return;
      let bestSys = null, minDist = Infinity, minTopDist = Infinity;
      for (const sys of systems) {
        const dist = badgeY < sys.topLine ? (sys.topLine - badgeY) : (badgeY > sys.bottomLine ? (badgeY - sys.bottomLine) : 0);
        const topDist = Math.abs(badgeY - sys.topLine);
        if (dist < minDist || (dist === minDist && topDist < minTopDist)) {
          minDist = dist; minTopDist = topDist; bestSys = sys;
        }
      }
      if (bestSys) {
        if (!assigned.has(bestSys)) assigned.set(bestSys, []);
        assigned.get(bestSys).push(badge);
      }
    });

    const staveNotes = Array.from(svg.querySelectorAll('g.vf-stavenote'));
    const noteRects = staveNotes.map(sn => {
      const r = sn.getBoundingClientRect();
      return { top: r.top - cRect.top, bottom: r.bottom - cRect.top, left: r.left - cRect.left, right: r.right - cRect.left };
    }).filter(nr => nr.bottom > 0);

    for (const [sys, badges] of assigned.entries()) {
      const badgeH = Math.max(...badges.map(b => b.offsetHeight || 0), Math.round(16 * scale));
      let targetY = Math.round(sys.topLine - badgeH - Math.round(8 * scale));
      const sysNotes = noteRects.filter(nr => nr.top >= sys.topLine - noteRange && nr.bottom <= sys.bottomLine + noteRange);
      if (sysNotes.length) {
        const minNoteTop = Math.min(...sysNotes.map(nr => nr.top));
        if (minNoteTop < sys.topLine) {
          targetY = Math.min(targetY, Math.round(minNoteTop - badgeH - Math.max(4, Math.round(6 * scale))));
        }
      }
      badges.sort((a, b) => (parseFloat(a.style.left) || 0) - (parseFloat(b.style.left) || 0));
      let prevRight = -Infinity;
      badges.forEach(el => {
        el.style.top = targetY + 'px';
        if (el.classList.contains('cc-chord-text')) return;
        const curLeft = parseFloat(el.style.left) || 0;
        const curW = el.offsetWidth || Math.round((el.textContent.trim().length * 10 + 8) * scale);
        if (el.classList.contains('cc-dot-btn')) {
          prevRight = Math.max(prevRight, curLeft + Math.round(8 * scale));
        } else {
          const halfW = curW / 2;
          if (curLeft < prevRight || (curLeft - halfW < prevRight + horizPad)) {
            const newCenter = prevRight + horizPad + halfW;
            el.style.left = newCenter + 'px';
            prevRight = newCenter + halfW;
          } else {
            prevRight = curLeft + halfW;
          }
        }
      });
    }
  }

  function _alignDOMChordsFallback(container) {
    const elements = Array.from(
      container.querySelectorAll('.cc-edit-badge, .cc-chord-text, .cc-custom-chord-text')
    );
    if (!elements.length) return;

    const rows = [];
    elements.forEach(el => {
      const top = parseFloat(el.style.top);
      if (isNaN(top)) return;
      let found = false;
      for (const row of rows) {
        if (Math.abs(row.avgTop - top) < 60) {
          row.els.push(el);
          row.minTop = Math.min(row.minTop, top);
          const sum = row.els.reduce((s, e) => s + parseFloat(e.style.top), 0);
          row.avgTop = sum / row.els.length;
          found = true; break;
        }
      }
      if (!found) rows.push({ avgTop: top, minTop: top, els: [el] });
    });
    rows.forEach(row => row.els.forEach(el => { el.style.top = row.minTop + 'px'; }));
  }

  function buildChordTextPositions(mapped, container) {
    const result = new Map();
    const svg = container?.querySelector('svg');
    if (!svg) return result;

    const cRect = container.getBoundingClientRect();
    const chordTextEls = Array.from(
      svg.querySelectorAll('g.vf-chordsymbol text')
    ).sort((a, b) => {
      const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
      if (Math.abs(ra.top - rb.top) > 15) return ra.top - rb.top;
      return ra.left - rb.left;
    });
    if (!chordTextEls.length) return result;

    const chordNotes = mapped
      .filter(m => m.chord && m.measureIdx >= 0)
      .sort((a, b) => a.measureIdx - b.measureIdx || a.noteIdx - b.noteIdx);
    if (!chordNotes.length) return result;

    const dedupedChordTextEls = [];
    chordTextEls.forEach(el => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const isDuplicate = dedupedChordTextEls.some(p => Math.abs(p.cx - cx) < 10 && Math.abs(p.cy - cy) < 10);
      if (!isDuplicate) dedupedChordTextEls.push({ el, cx, cy });
    });

    const count = Math.min(dedupedChordTextEls.length, chordNotes.length);
    for (let i = 0; i < count; i++) {
      const rect = dedupedChordTextEls[i].el.getBoundingClientRect();
      const key  = `${chordNotes[i].measureIdx}_${chordNotes[i].noteIdx}`;
      result.set(key, {
        bx: rect.left - cRect.left,
        by: rect.top  - cRect.top,
        bw: rect.width,
        bh: rect.height,
      });
    }
    return result;
  }

  function mapNotes(noteEls, chordMap) {
    const osmd = window.OSMDRenderer?.getInstance?.();
    const ml   = osmd?.graphic?.measureList;

    if (ml) {
      try {
        const byEl = new Map();
        for (let mi = 0; mi < ml.length; mi++) {
          const staves = ml[mi];
          if (!staves?.length) continue;
          const primaryStaff = staves[0];
          if (!primaryStaff?.staffEntries) continue;
          const src  = primaryStaff.ParentSourceMeasure ?? primaryStaff.parentSourceMeasure;
          const mIdx = src?.measureListIndex ?? mi;
          let nIdx = 0;
          for (const se of primaryStaff.staffEntries) {
            if (!se) { nIdx++; continue; }
            for (const ve of (se.graphicalVoiceEntries || [])) {
              for (const gn of (ve.notes || [])) {
                const svgG = gn.getSVGGElement?.();
                if (svgG) byEl.set(svgG, { mIdx, nIdx, primary: true });
              }
            }
            nIdx++;
          }
          for (let si = 1; si < staves.length; si++) {
            const secStaff = staves[si];
            if (!secStaff?.staffEntries) continue;
            let sIdx = 0;
            for (const se of secStaff.staffEntries) {
              if (!se) { sIdx++; continue; }
              for (const ve of (se.graphicalVoiceEntries || [])) {
                for (const gn of (ve.notes || [])) {
                  const svgG = gn.getSVGGElement?.();
                  if (svgG) byEl.set(svgG, { mIdx, nIdx: sIdx, primary: false });
                }
              }
              sIdx++;
            }
          }
        }
        if (byEl.size > 0) {
          const result = [];
          for (const el of noteEls) {
            const m = byEl.get(el) || byEl.get(el.parentElement);
            if (!m || !m.primary) continue;
            result.push({
              el, rect: el.getBoundingClientRect(),
              measureIdx: m.mIdx, noteIdx: m.nIdx,
              chord: chordMap[`${m.mIdx}_${m.nIdx}`] || ''
            });
          }
          if (result.some(r => r.measureIdx >= 0)) return result;
        }
      } catch(e) { console.warn('[ChordCanvas.mapNotes]', e); }
    }

    const absMap = ChordCanvasXML.buildAbsMap();
    return noteEls.map((el, i) => ({
      el, rect: el.getBoundingClientRect(),
      measureIdx: absMap[i]?.mi ?? -1, noteIdx: absMap[i]?.ni ?? i,
      chord: absMap[i] ? (chordMap[`${absMap[i].mi}_${absMap[i].ni}`] || '') : ''
    }));
  }

  function placeDot({ rect, measureIdx, noteIdx, chord }, chordTextPositions = new Map(), opts = {}) {
    if (!rect || rect.width === 0 || rect.height === 0) return;
    const container = document.getElementById('osmd-container');
    if (!container) return;
    const cRect = container.getBoundingClientRect();

    const editEnabled   = !!opts.editEnabled;
    const currentSet    = opts.currentSet || 'default';
    const highlightMode = !!opts.highlightMode;
    const onShowPopup   = opts.onShowPopup || (() => {});
    const onSetAddMode  = opts.onSetAddMode || (() => {});

    const scale   = ChordCanvasUI.getScale();
    const dotSize = ChordCanvasUI.getDotSize(scale);
    const fSize   = Math.min(24, Math.max(11, Math.round(15 * scale)));

    const noteTop = rect.top - cRect.top;
    const cx = (rect.left - cRect.left) + rect.width / 2;
    const cy = noteTop - (24 * scale);

    if (chord) {
      if (!editEnabled && currentSet === 'default') return;
      const textPos = chordTextPositions.get(`${measureIdx}_${noteIdx}`);

      if (currentSet === 'default') {
        const badgeX = textPos ? textPos.bx + textPos.bw / 2 : cx;
        const badgeY = textPos ? textPos.by - 6 * scale : cy - dotSize / 2;

        const badge = document.createElement('div');
        badge.className = DOT_CLASS + ' cc-edit-badge';
        badge.textContent = '\u270e';
        badge.title = 'Sửa hợp âm: ' + chord;
        badge.dataset.noteTop = noteTop;
        ChordCanvasUI.applyAbsolute(badge, badgeX, badgeY, [
          'display:' + (editEnabled ? 'flex' : 'none'),
          'align-items:center', 'justify-content:center',
          'width:' + dotSize + 'px', 'height:' + dotSize + 'px', 'border-radius:50%',
          'background:rgba(109,40,217,0.87)',
          'border:2.5px solid rgba(255,255,255,0.8)',
          'color:#fff', 'font-size:' + Math.max(11, Math.round(dotSize * 0.6)) + 'px', 'line-height:1',
          'box-shadow:0 2px 7px rgba(109,40,217,0.55)',
          'pointer-events:auto', 'cursor:pointer', 'user-select:none', 'z-index:12',
          'touch-action:manipulation', '-webkit-tap-highlight-color:transparent',
          'transform: translateX(-50%) translateY(-100%)',
          'transition: transform 0.15s ease, background 0.15s ease, box-shadow 0.15s ease'
        ]);
        badge.addEventListener('mouseenter', () => { badge.style.transform = 'translateX(-50%) translateY(-100%) scale(1.15)'; badge.style.background = 'rgba(109,40,217,1)'; badge.style.boxShadow = '0 4px 12px rgba(109,40,217,0.7)'; });
        badge.addEventListener('mouseleave', () => { badge.style.transform = 'translateX(-50%) translateY(-100%) scale(1)'; badge.style.background = 'rgba(109,40,217,0.87)'; badge.style.boxShadow = '0 2px 7px rgba(109,40,217,0.55)'; });
        badge.addEventListener('pointerdown', e => { e.stopPropagation(); onShowPopup(badge, measureIdx, noteIdx, chord); });
        container.appendChild(badge);

        const span = document.createElement('span');
        span.className = DOT_CLASS + ' cc-chord-text';
        span.title = chord;
        const spanX = textPos ? textPos.bx + textPos.bw / 2 : cx;
        const spanY = textPos ? textPos.by + textPos.bh / 2 : cy;
        ChordCanvasUI.applyAbsolute(span, spanX, spanY, [
          'transform: translate(-50%, -50%)', 'opacity:0', 'width:60px', 'height:22px',
          'pointer-events:' + (editEnabled ? 'auto' : 'none'),
          'cursor:pointer', 'display:block'
        ]);
        span.addEventListener('click', e => {
          if (!editEnabled) return;
          e.stopPropagation(); onShowPopup(span, measureIdx, noteIdx, chord);
        });
        container.appendChild(span);

      } else {
        let spanX = textPos ? textPos.bx + textPos.bw / 2 : cx;
        let spanY = cy - (16 * scale);
        if (textPos) {
          spanY = textPos.by - 4 * scale;
        } else {
          let closestDist = Infinity;
          for (let pos of chordTextPositions.values()) {
            let dist = Math.abs(pos.by - cy);
            if (dist < 120 * scale && dist < closestDist) {
              closestDist = dist;
              spanY = pos.by - 4 * scale;
            }
          }
        }

        const textBadge = document.createElement('div');
        textBadge.className = DOT_CLASS + ' cc-custom-chord-text';
        textBadge.dataset.noteTop = noteTop;
        let displayChord = chord;
        const nStyle = window.HarmonicNumeral?.getNotationStyle?.() || 'standard';
        if (nStyle !== 'standard' && window.HarmonicNumeral?.convertChord) {
          let currentKey = document.getElementById('song-key')?.textContent?.trim() || '';
          if (!currentKey || currentKey === '--') {
            currentKey = window.Store?.get?.('currentSong')?.defaultKey || window.SongInfoBar?.getSongKey?.() || 'C';
          }
          displayChord = window.HarmonicNumeral.convertChord(chord, currentKey);
        }
        textBadge.textContent = displayChord;
        textBadge.title = editEnabled ? 'Sửa hợp âm: ' + chord : chord;

        const chordColor = window.DisplaySettings?.getChordPrefs?.()?.color || '#dc2626';
        const _hex2rgb = h => { const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h); return r ? [parseInt(r[1],16),parseInt(r[2],16),parseInt(r[3],16)] : [220,38,38]; };
        const [cr,cg,cb] = _hex2rgb(chordColor);

        const baseStyle = [
          'position:absolute', `left:${spanX}px`, `top:${spanY}px`,
          'transform:translateX(-50%)',
          'font-family: "Georgia", serif', 'font-weight: bold',
          'white-space: nowrap', 'z-index: 12',
          'letter-spacing: -0.01em', 'line-height: 1',
          `font-size: ${fSize}px`
        ];

        if (editEnabled) {
          baseStyle.push(
            `color: rgb(${cr},${cg},${cb})`,
            'background: #ffffff',
            `border: 1px solid rgba(${cr},${cg},${cb},0.85)`,
            'border-radius: 0px', 'padding: 1px 5px',
            'cursor: pointer', 'pointer-events: auto'
          );
          textBadge.addEventListener('pointerdown', e => { e.stopPropagation(); onShowPopup(textBadge, measureIdx, noteIdx, chord); });
        } else if (highlightMode) {
          baseStyle.push(
            'color: #fff', 'background: #3730a3',
            'border: 1px solid #312e81',
            'border-radius: 0px', 'padding: 2px 6px',
            'cursor: pointer', 'pointer-events: auto',
            'font-family: "Georgia", serif', 'letter-spacing: 0.01em'
          );
          textBadge.addEventListener('pointerdown', e => {
            e.stopPropagation();
            if (!window.Auth?.isBanhat?.()) {
              window.App?.showToast?.('⚠️ Cần đăng nhập với quyền Ban Hát để sửa hợp âm', 'error');
              return;
            }
            onSetAddMode(true);
            onShowPopup(textBadge, measureIdx, noteIdx, chord);
          });
        } else {
          baseStyle.push(
            `color: rgb(${cr},${cg},${cb})`,
            'background: rgba(255,255,255,0.88)',
            'border: none',
            'border-radius: 0px', 'padding: 0 2px', 'box-shadow: none',
            'cursor: pointer', 'pointer-events: auto'
          );
          textBadge.addEventListener('pointerdown', e => {
            e.stopPropagation();
            if (!window.Auth?.isBanhat?.()) {
              window.App?.showToast?.('⚠️ Cần đăng nhập với quyền Ban Hát để sửa hợp âm', 'error');
              return;
            }
            onSetAddMode(true);
            onShowPopup(textBadge, measureIdx, noteIdx, chord);
          });
        }

        textBadge.style.cssText = baseStyle.join(';');
        container.appendChild(textBadge);
      }
    } else {
      const btn = document.createElement('div');
      btn.className = DOT_CLASS + ' ' + BTN_CLASS;
      btn.textContent = '+';
      btn.dataset.noteTop = noteTop;
      ChordCanvasUI.applyAbsolute(btn, cx, cy, [
        'display:' + (editEnabled ? 'flex' : 'none'),
        'align-items:center', 'justify-content:center',
        `width:${dotSize}px`, `height:${dotSize}px`,
        'border-radius:50%', 'background:rgba(109,40,217,0.82)',
        'color:#fff', `font-size:${Math.round(dotSize * 0.65)}px`,
        'line-height:1', 'font-weight:700',
        'box-shadow:0 1px 4px rgba(109,40,217,0.35)',
        'pointer-events:auto', 'cursor:pointer', 'user-select:none',
        'touch-action:manipulation', '-webkit-tap-highlight-color:transparent',
        'transition:transform 0.15s ease, background 0.15s ease',
        'position:absolute'
      ]);
      btn.addEventListener('mouseenter', () => { btn.style.transform = 'translateX(-50%) scale(1.2)'; btn.style.background = 'rgba(109,40,217,1)'; });
      btn.addEventListener('mouseleave', () => { btn.style.transform = 'translateX(-50%) scale(1)';   btn.style.background = 'rgba(109,40,217,0.82)'; });
      let _pointerHandled = false;
      btn.addEventListener('pointerdown', e => {
        e.stopPropagation();
        _pointerHandled = true;
        onShowPopup(btn, measureIdx, noteIdx, '');
      });
      btn.addEventListener('click', e => {
        e.stopPropagation();
        if (_pointerHandled) { _pointerHandled = false; return; }
        onShowPopup(btn, measureIdx, noteIdx, '');
      });
      container.appendChild(btn);
    }
  }

  return { alignDOMChords, buildChordTextPositions, mapNotes, placeDot };
})();

window.ChordCanvasDots = ChordCanvasDots;
