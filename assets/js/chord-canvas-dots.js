/**
 * chord-canvas-dots.js — Note Mapping, Staff Alignment & Chord Dot Placement
 * Part of SheetApp Sheet Reader
 */
const ChordCanvasDots = (() => {
  'use strict';

  const DOT_CLASS = 'cc-note-dot';
  const BTN_CLASS = 'cc-dot-btn';

  const STAFF_LINE_MIN_WIDTH = 100;
  const CHORD_GAP_RATIO = 0.35;

  function alignDOMChords() {
    const container = document.getElementById('osmd-container');
    if (!container) return;

    const cRect = container.getBoundingClientRect();
    const scale = window.ChordCanvasUI?.getScale?.() || 1.0;
    const GAP_PX = Math.round(22 * scale);

    const svg = container.querySelector('svg');
    if (!svg) return;

    let staffLineRects = [];
    const staveGroups = Array.from(svg.querySelectorAll('g.vf-stave'));

    if (staveGroups.length) {
      staveGroups.forEach(g => {
        const r = g.getBoundingClientRect();
        if (r.width > 40 && r.height > 0 && r.top > 0) {
          staffLineRects.push(r.top - cRect.top);
        }
      });
    }

    if (!staffLineRects.length) {
      // OSMD 1.8.x vẽ dòng kẻ khuông bằng <path> (không có g.vf-stave / <line>),
      // nên phải tính cả path nằm ngang dài; nếu không sẽ rơi vào fallback và hợp âm
      // HD nằm cao hơn khuông ~76px, đè lên dòng tên tác giả.
      Array.from(svg.querySelectorAll('line, path')).forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.width > STAFF_LINE_MIN_WIDTH && r.height < 3 && r.top > 0) {
          staffLineRects.push(r.top - cRect.top);
        }
      });
    }

    if (!staffLineRects.length) {
      alignDOMChordsFallback(container);
      return;
    }

    staffLineRects.sort((a, b) => a - b);
    const deduped = [staffLineRects[0]];
    for (let i = 1; i < staffLineRects.length; i++) {
      if (staffLineRects[i] - deduped[deduped.length - 1] > 3) {
        deduped.push(staffLineRects[i]);
      }
    }

    const systems = [];
    let sysStart = deduped[0];
    let prev = deduped[0];
    const SYS_GAP = 150;

    for (let i = 1; i < deduped.length; i++) {
      const curr = deduped[i];
      if (curr - prev > SYS_GAP) {
        systems.push({ topLine: sysStart, bottomLine: prev });
        sysStart = curr;
      }
      prev = curr;
    }
    systems.push({ topLine: sysStart, bottomLine: prev });

    const allBadges = Array.from(container.querySelectorAll('.cc-custom-chord-text, .cc-dot-btn'));
    if (!allBadges.length) return;

    const assigned = new Map();
    allBadges.forEach(badge => {
      const badgeY = parseFloat(badge.style.top);
      if (isNaN(badgeY)) return;

      let bestSys = null;
      let minAbove = Infinity;

      for (const sys of systems) {
        const dist = sys.topLine - badgeY;
        if (dist >= -40 && dist < minAbove) {
          minAbove = dist;
          bestSys = sys;
        }
      }

      if (!bestSys) {
        let minDist = Infinity;
        for (const sys of systems) {
          const d = Math.abs(badgeY - sys.topLine);
          if (d < minDist) { minDist = d; bestSys = sys; }
        }
      }

      if (bestSys) {
        if (!assigned.has(bestSys)) assigned.set(bestSys, []);
        assigned.get(bestSys).push(badge);
      }
    });

    for (const [sys, badges] of assigned.entries()) {
      // top của badge = dòng kẻ trên cùng − chiều cao chữ − khe hở, để mép dưới
      // chữ hợp âm luôn nằm ngay trên khuông (chữ đã to 28px theo preset).
      const badgeH = Math.max(...badges.map(b => b.offsetHeight || 0), 0);
      const fixedY = Math.round(sys.topLine - badgeH - GAP_PX * CHORD_GAP_RATIO);
      badges.sort((a, b) => (parseFloat(a.style.left) || 0) - (parseFloat(b.style.left) || 0));
      let prevRight = -Infinity;
      badges.forEach(badge => {
        badge.style.top = fixedY + 'px';
        const curLeft = parseFloat(badge.style.left) || 0;
        let curW = badge.offsetWidth;
        if (!curW || curW <= 0) curW = badge.textContent.trim().length * 14 + 12;
        if (curLeft < prevRight + 6) {
          const newLeft = prevRight + 6;
          badge.style.left = newLeft + 'px';
          prevRight = newLeft + curW;
        } else {
          prevRight = curLeft + curW;
        }
      });
    }
  }

  function alignDOMChordsFallback(container) {
    const badges = Array.from(container.querySelectorAll('.cc-custom-chord-text, .cc-dot-btn'));
    if (!badges.length) return;

    const rows = [];
    const ROW_THRESHOLD = 30;

    badges.forEach(b => {
      const y = parseFloat(b.style.top) || 0;
      let placed = false;
      for (const row of rows) {
        if (Math.abs(row.avgY - y) < ROW_THRESHOLD) {
          row.items.push({ el: b, y });
          row.avgY = row.items.reduce((s, it) => s + it.y, 0) / row.items.length;
          placed = true;
          break;
        }
      }
      if (!placed) rows.push({ avgY: y, items: [{ el: b, y }] });
    });

    rows.forEach(row => {
      const minY = Math.min(...row.items.map(it => it.y));
      row.items.sort((a, b) => (parseFloat(a.el.style.left) || 0) - (parseFloat(b.el.style.left) || 0));
      let prevRight = -Infinity;
      row.items.forEach(it => {
        it.el.style.top = `${minY}px`;
        const curLeft = parseFloat(it.el.style.left) || 0;
        let curW = it.el.offsetWidth || (it.el.textContent.trim().length * 14 + 12);
        if (curLeft < prevRight + 6) {
          const newLeft = prevRight + 6;
          it.el.style.left = newLeft + 'px';
          prevRight = newLeft + curW;
        } else {
          prevRight = curLeft + curW;
        }
      });
    });
  }

  let _cachedChordTextPositions = null;
  let _cachedChordTextKey = null;
  let _cachedNoteMapping = null;
  let _cachedNoteGeomKey = null;

  function clearGeomCache() {
    _cachedChordTextPositions = null;
    _cachedChordTextKey = null;
    _cachedNoteMapping = null;
    _cachedNoteGeomKey = null;
  }

  function buildChordTextPositions(mapped, container) {
    const token = window.OSMDRenderer?.getRenderToken?.() || 0;
    const cWidth = container?.clientWidth || 0;
    const cacheKey = `${token}_${mapped.length}_${cWidth}`;
    if (_cachedChordTextPositions && _cachedChordTextKey === cacheKey) {
      return _cachedChordTextPositions;
    }

    const cRect = container.getBoundingClientRect();
    const result = new Map();
    const svg = container.querySelector('svg');
    if (!svg) return result;

    const rawChords = Array.from(svg.querySelectorAll('g.vf-chordsymbol, g.osmd-chord-symbol, [data-chord-symbol="true"], text.osmd-chord-symbol, text.osmd-chord-text'));
    const chordGroups = rawChords.filter(el => el.tagName.toLowerCase() === 'g' || !el.closest('g.osmd-chord-symbol, g.vf-chordsymbol'));
    if (!chordGroups.length) return result;

    chordGroups.forEach(g => {
      const r = g.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      const gcx = (r.left - cRect.left) + r.width / 2;
      const gcy = (r.top  - cRect.top);

      let closest = null;
      let minDist = Infinity;
      mapped.forEach(m => {
        const mcx = (m.rect.left - cRect.left) + m.rect.width / 2;
        const mcy = (m.rect.top  - cRect.top);
        const dist = Math.hypot(mcx - gcx, mcy - gcy);
        if (dist < minDist) { minDist = dist; closest = m; }
      });

      if (closest && minDist < 60) {
        result.set(`${closest.measureIdx}_${closest.noteIdx}`, {
          bx: r.left - cRect.left,
          by: r.top  - cRect.top,
          bw: r.width,
          bh: r.height
        });
      }
    });

    _cachedChordTextPositions = result;
    _cachedChordTextKey = cacheKey;
    return result;
  }

  function mapNotes(noteEls, chordMap) {
    const osmd = window.OSMDRenderer?.getInstance?.();
    const token = window.OSMDRenderer?.getRenderToken?.() || 0;
    const container = document.getElementById('osmd-container');
    const cWidth = container?.clientWidth || 0;
    const geomKey = `${token}_${noteEls.length}_${cWidth}`;

    if (_cachedNoteMapping && _cachedNoteGeomKey === geomKey) {
      return _cachedNoteMapping.map(m => ({
        ...m,
        chord: chordMap[`${m.measureIdx}_${m.noteIdx}`] || ''
      }));
    }

    const ml = osmd?.graphic?.measureList;
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
          if (result.some(r => r.measureIdx >= 0)) {
            _cachedNoteMapping = result;
            _cachedNoteGeomKey = geomKey;
            return result;
          }
        }
      } catch(e) { console.warn('[ChordCanvasDots.mapNotes]', e); }
    }

    const absMap = window.ChordCanvasXML?.buildAbsMap?.() || [];
    const fallbackResult = noteEls.map((el, i) => ({
      el, rect: el.getBoundingClientRect(),
      measureIdx: absMap[i]?.mi ?? -1, noteIdx: absMap[i]?.ni ?? i,
      chord: absMap[i] ? (chordMap[`${absMap[i].mi}_${absMap[i].ni}`] || '') : ''
    }));
    _cachedNoteMapping = fallbackResult;
    _cachedNoteGeomKey = geomKey;
    return fallbackResult;
  }

  function _getStaffTop(measureIdx) {
    try {
      const osmd = window.OSMDRenderer?.getInstance?.();
      const ml = osmd?.graphic?.measureList;
      if (ml && ml[measureIdx]) {
        const s0 = ml[measureIdx][0];
        const sl = s0?.ParentStaffLine;
        const y = sl?.PositionAndShape?.AbsolutePosition?.y;
        if (y != null) {
          const unit = osmd.graphic?.unitInPixels || 10;
          return y * unit;
        }
      }
    } catch (_) {}
    return null;
  }

  function placeDot({ el, rect, measureIdx, noteIdx, chord }, chordTextPositions, opts = {}) {
    if (!rect || rect.width === 0 || rect.height === 0) return;
    const container = document.getElementById('osmd-container');
    if (!container) return;
    const cRect = container.getBoundingClientRect();

    const scale   = ChordCanvasUI.getScale();
    const dotSize = ChordCanvasUI.getDotSize(scale);
    const preset = window.DisplaySettings?.getChordPreset?.() || 'standard';
    const presetMultiplier = (preset === 'stage' ? 1.6 : (preset === 'high_contrast' ? 1.3 : 1.0));
    const fSize   = Math.max(16, Math.round(20 * scale * 1.35 * presetMultiplier));

    const staffTop = _getStaffTop(measureIdx);
    const cx = (rect.left - cRect.left) + rect.width / 2;
    const cy = staffTop != null ? (staffTop - 20 * scale) : ((rect.top - cRect.top) - (28 * scale));

    const editEnabled = opts.editEnabled ?? false;
    const highlightEnabled = opts.highlightEnabled ?? false;
    const currentSet = opts.currentSet ?? 'HD';
    const onShowPopup = opts.onShowPopup;

    if (chord) {
      if (!editEnabled && currentSet === 'default') return;

      const textPos = chordTextPositions?.get(`${measureIdx}_${noteIdx}`);

      if (currentSet === 'default') {
        const badgeX = textPos ? (textPos.bx + textPos.bw / 2) : cx;
        let badgeY;
        if (staffTop != null) {
          if (textPos && textPos.by < staffTop && textPos.by > staffTop - 45) {
            badgeY = Math.max(staffTop - 36, Math.min(staffTop - 12, textPos.by - 4));
          } else {
            badgeY = Math.max(staffTop - 36, Math.min(staffTop - 12, staffTop - 22 * scale));
          }
        } else {
          badgeY = textPos ? (textPos.by - 6) : (cy - dotSize / 2);
        }

        const badge = document.createElement('div');
        badge.className = DOT_CLASS + ' cc-edit-badge';
        badge.textContent = '\u270e';
        badge.title = 'Sửa hợp âm: ' + chord;
        ChordCanvasUI.applyAbsolute(badge, badgeX, badgeY, [
          'display:' + (editEnabled ? 'flex' : 'none'),
          'align-items:center', 'justify-content:center',
          'width:' + dotSize + 'px', 'height:' + dotSize + 'px', 'border-radius:50%',
          'background:rgba(109,40,217,0.87)',
          'border:2.5px solid rgba(255,255,255,0.8)',
          'color:#fff', 'font-size:' + fSize + 'px', 'line-height:1',
          'box-shadow:0 2px 7px rgba(109,40,217,0.55)',
          'pointer-events:auto', 'cursor:pointer', 'user-select:none', 'z-index:12',
          'touch-action:manipulation', '-webkit-tap-highlight-color:transparent',
          'transform: translateX(-50%)',
          'transition: transform 0.15s ease, background 0.15s ease, box-shadow 0.15s ease'
        ]);
        badge.addEventListener('mouseenter', () => { badge.style.transform = 'translateX(-50%) scale(1.15)'; badge.style.background = 'rgba(109,40,217,1)'; badge.style.boxShadow = '0 4px 12px rgba(109,40,217,0.7)'; });
        badge.addEventListener('mouseleave', () => { badge.style.transform = 'translateX(-50%) scale(1)'; badge.style.background = 'rgba(109,40,217,0.87)'; badge.style.boxShadow = '0 2px 7px rgba(109,40,217,0.55)'; });
        badge.addEventListener('pointerdown', e => { e.stopPropagation(); onShowPopup?.(badge, measureIdx, noteIdx, chord); });
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
          e.stopPropagation();
          onShowPopup?.(span, measureIdx, noteIdx, chord);
        });
        container.appendChild(span);

      } else {
        let spanX = textPos ? (textPos.bx + textPos.bw / 2) : cx;
        let spanY;
        if (staffTop != null) {
          spanY = Math.max(staffTop - 36, Math.min(staffTop - 12, staffTop - 22 * scale));
        } else {
          spanY = textPos ? (textPos.by - 4) : (cy - 18 * scale);
        }

        const textBadge = document.createElement('div');
        textBadge.className = DOT_CLASS + ' cc-custom-chord-text';
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
          'letter-spacing: -0.01em', 'line-height: 1'
        ];
        baseStyle.push(`font-size: ${fSize}px`);

        if (editEnabled) {
          baseStyle.push(
            `color: rgb(${cr},${cg},${cb})`,
            'background: rgba(255,255,255,0.97)',
            `border: 1.5px solid rgba(${cr},${cg},${cb},0.7)`,
            'border-radius: 6px',
            'padding: 2px 7px',
            `box-shadow: 0 2px 8px rgba(${cr},${cg},${cb},0.22)`,
            'cursor: pointer', 'pointer-events: auto',
            'transition: transform 0.15s ease, box-shadow 0.15s ease'
          );
        } else {
          baseStyle.push(
            `color: rgb(${cr},${cg},${cb})`,
            'background: transparent',
            'border: none',
            'padding: 1px 3px',
            'cursor: default',
            'pointer-events: none',
            'user-select: none'
          );
        }

        textBadge.style.cssText = baseStyle.join(';');

        if (editEnabled) {
          textBadge.addEventListener('mouseenter', () => {
            textBadge.style.transform = 'translateX(-50%) scale(1.15)';
            textBadge.style.boxShadow = `0 4px 14px rgba(${cr},${cg},${cb},0.45)`;
            textBadge.style.zIndex = '20';
          });
          textBadge.addEventListener('mouseleave', () => {
            textBadge.style.transform = 'translateX(-50%) scale(1)';
            textBadge.style.boxShadow = `0 2px 8px rgba(${cr},${cg},${cb},0.22)`;
            textBadge.style.zIndex = '12';
          });
          textBadge.addEventListener('pointerdown', e => {
            e.stopPropagation();
            onShowPopup?.(textBadge, measureIdx, noteIdx, chord);
          });
          textBadge.addEventListener('click', e => {
            e.stopPropagation();
            onShowPopup?.(textBadge, measureIdx, noteIdx, chord);
          });
        }

        container.appendChild(textBadge);
      }

      if (highlightEnabled && el) {
        const hl = document.createElement('div');
        hl.className = DOT_CLASS + ' cc-chord-highlight';
        ChordCanvasUI.applyAbsolute(hl, cx, rect.top - cRect.top + rect.height / 2, [
          'width:' + (dotSize * 1.8) + 'px', 'height:' + (dotSize * 1.8) + 'px',
          'transform:translate(-50%, -50%)', 'border-radius:50%',
          'background:rgba(234,179,8,0.22)', 'border:1.5px solid rgba(234,179,8,0.65)',
          'pointer-events:none', 'z-index:5'
        ]);
        container.appendChild(hl);
      }

    } else if (editEnabled) {
      const btn = document.createElement('div');
      btn.className = DOT_CLASS + ' ' + BTN_CLASS;
      btn.textContent = '+';
      const dotY = staffTop != null ? Math.max(staffTop - 34, Math.min(staffTop - 10, staffTop - 20 * scale)) : cy;
      ChordCanvasUI.applyAbsolute(btn, cx, dotY, [
        'display:' + (editEnabled ? 'flex' : 'none'),
        'align-items:center', 'justify-content:center',
        `width:${dotSize}px`, `height:${dotSize}px`,
        'border-radius:50%',
        'background:rgba(109,40,217,0.82)',
        'color:#fff', `font-size:${Math.round(dotSize * 0.65)}px`,
        'line-height:1', 'font-weight:700',
        'box-shadow:0 1px 4px rgba(109,40,217,0.35)',
        'pointer-events:auto', 'cursor:pointer', 'user-select:none',
        'touch-action:manipulation',
        '-webkit-tap-highlight-color:transparent',
        'transition:transform 0.15s ease, background 0.15s ease',
        'position:absolute'
      ]);
      btn.addEventListener('mouseenter', () => { btn.style.transform = 'translateX(-50%) scale(1.2)'; btn.style.background = 'rgba(109,40,217,1)'; });
      btn.addEventListener('mouseleave', () => { btn.style.transform = 'translateX(-50%) scale(1)';   btn.style.background = 'rgba(109,40,217,0.82)'; });
      let _pointerHandled = false;
      btn.addEventListener('pointerdown', e => {
        e.stopPropagation();
        _pointerHandled = true;
        onShowPopup?.(btn, measureIdx, noteIdx, '');
      });
      btn.addEventListener('click', e => {
        e.stopPropagation();
        if (_pointerHandled) { _pointerHandled = false; return; }
        onShowPopup?.(btn, measureIdx, noteIdx, '');
      });
      container.appendChild(btn);
    }
  }

  return {
    alignDOMChords,
    alignDOMChordsFallback,
    buildChordTextPositions,
    mapNotes,
    placeDot,
    clearGeomCache
  };
})();

if (typeof window !== 'undefined') {
  window.ChordCanvasDots = ChordCanvasDots;
}
