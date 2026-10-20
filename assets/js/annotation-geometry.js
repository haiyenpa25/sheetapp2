/* Shared semantic anchors for every OSMD page and staff. */
window.AnnotationGeometry = (() => {
  'use strict';
  function anchors() {
    const measures = window.OSMDRenderer?.getInstance?.()?.graphic?.measureList || [];
    const result = [];
    measures.forEach((staves, mi) => (staves || []).forEach((staff, staffIdx) => {
      const measureIdx = staff.ParentSourceMeasure?.measureListIndex ?? mi;
      (staff.staffEntries || []).forEach((entry, noteIdx) => {
        const elements = (entry.graphicalVoiceEntries || []).flatMap(voice =>
          (voice.notes || []).map(note => note.getSVGGElement?.()).filter(Boolean));
        const el = elements.find(node => node.isConnected && node.getBoundingClientRect().width > 0);
        if (!el) return;
        const time = entry.relInMeasureTimestamp ?? entry.sourceStaffEntry?.Timestamp;
        const numerator = time?.numerator ?? time?.Numerator;
        const denominator = time?.denominator ?? time?.Denominator;
        const beat = Number.isInteger(numerator) && denominator > 0 ? `${numerator}/${denominator}` : undefined;
        result.push({ measureIdx, staffIdx, noteIdx, beat, el, line: staff.ParentStaffLine || staff.parentStaffLine });
      });
    }));
    return result;
  }
  function matches(note, anchor) {
    if (note.measureIdx !== anchor.measureIdx || (note.staffIdx || 0) !== anchor.staffIdx) return false;
    if (note.beat && anchor.beat) {
      const [a, b] = note.beat.split('/').map(Number), [c, d] = anchor.beat.split('/').map(Number);
      return a * d === c * b;
    }
    return note.noteIdx === anchor.noteIdx;
  }
  function fingerprint(xml) {
    if (!xml) return '';
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    if (doc.querySelector('parsererror')) return '';
    const structure = Array.from(doc.querySelectorAll('part')).map(part =>
      Array.from(part.querySelectorAll('measure')).map(measure =>
        Array.from(measure.children).filter(node => ['note', 'backup', 'forward', 'attributes'].includes(node.tagName))
          .map(node => node.outerHTML).join('')).join('|')).join('||');
    if (!structure) return '';
    let hash = 2166136261;
    for (let i = 0; i < structure.length; i++) hash = Math.imul(hash ^ structure.charCodeAt(i), 16777619);
    return (hash >>> 0).toString(16).padStart(8, '0');
  }
  function obstacles(container, bounds) {
    return Array.from(container.querySelectorAll('svg text,svg path,svg line,svg rect,svg ellipse,.cc-note-dot,.cc-dot'))
      .filter(node => {
        const style = window.getComputedStyle(node);
        if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
        // TLH chord text remains in SVG with transparent fill when HD is shown.
        return !(node instanceof window.SVGElement && ['rgba(0, 0, 0, 0)', 'transparent', 'none'].includes(style.fill) && ['none', 'rgba(0, 0, 0, 0)'].includes(style.stroke));
      })
      .map(node => node.getBoundingClientRect()).filter(rect => rect.width || rect.height)
      .map(rect => ({ left: rect.left - bounds.left - 2, right: rect.right - bounds.left + 2,
        top: rect.top - bounds.top - 2, bottom: rect.bottom - bounds.top + 2 }));
  }
  const ruleStates = new WeakMap();
  function reserveSpace(rows) {
    const renderer = window.OSMDRenderer, instance = renderer?.getInstance?.();
    if (!instance?.rules || !renderer.setZoom) return false;
    const keys = ['StaffDistance', 'BetweenStaffDistance', 'MinimumDistanceBetweenSystems', 'MinSkyBottomDistBetweenSystems', 'MinSkyBottomDistBetweenStaves', 'MinimumStaffLineDistance', 'TitleBottomDistance', 'PageTopMargin', 'PageTopMarginNarrow'];
    let saved = ruleStates.get(instance);
    if (!saved) { saved = { base: Object.fromEntries(keys.map(key => [key, instance.rules[key]])), amount: 0 }; ruleStates.set(instance, saved); }
    const zoom = renderer.getCurrentZoom?.() || 1;
    const amount = rows ? Math.ceil((rows * 32 + 24) / (10 * zoom)) : 0;
    if (saved.amount === amount) return false;
    saved.amount = amount;
    keys.forEach(key => { if (Number.isFinite(saved.base[key])) instance.rules[key] = saved.base[key] + amount; });
    // Let the renderer keep its own chord caches, compact view and callbacks coherent.
    Promise.resolve(renderer.setZoom(zoom)).catch(error => window.App?.showToast?.(`Không sắp được dòng ghi chú: ${error.message}`, 'error'));
    return true;
  }
  function plan(anchors, notes, instruments, editing, instrumentId) {
    const groups = new Map(), result = [];
    anchors.forEach(anchor => {
      const key = anchor.line || anchor.el.ownerSVGElement;
      if (!groups.has(key)) groups.set(key, []);
      const found = notes.filter(note => matches(note, anchor));
      found.forEach(note => groups.get(key).push({ anchor, found: [note] }));
      if (editing && !found.some(note => note.instrumentId === instrumentId)) groups.get(key).push({ anchor, found: null });
    });
    let rows = 0;
    groups.forEach(items => {
      let baseRow = 0;
      [...instruments.map(item => item.id), '+'].forEach(id => {
        const layers = [];
        items.filter(item => (item.found?.[0].instrumentId || '+') === id).forEach(item => {
          const rect = item.anchor.el.getBoundingClientRect(), bounds = item.anchor.el.ownerSVGElement.getBoundingClientRect();
          const name = instruments.find(ins => ins.id === id)?.name || id;
          const width = item.found ? Math.min(165, (name.length + item.found[0].text.length + 5) * 7 + 16) : 28;
          const left = Math.max(bounds.left, Math.min(rect.left, bounds.right - width));
          let row = layers.findIndex(right => right + 6 <= left);
          if (row < 0) { row = layers.length; layers.push(0); }
          layers[row] = left + width; result.push({ ...item, row: baseRow + row });
        });
        baseRow += layers.length;
      });
      rows = Math.max(rows, baseRow);
    });
    return { items: result, rows };
  }
  function chordTop(anchor, bounds) {
    const svg = anchor.el.ownerSVGElement, svgRect = svg.getBoundingClientRect();
    const y = anchor.line?.PositionAndShape?.AbsolutePosition?.y;
    if (!Number.isFinite(y)) return anchor.el.getBoundingClientRect().top - bounds.top - 8;
    const zoom = window.OSMDRenderer?.getCurrentZoom?.() || 1;
    const scale = svgRect.width / (parseFloat(svg.getAttribute('width')) || svg.viewBox.baseVal.width);
    const staffTop = svgRect.top - bounds.top + y * 10 * zoom * scale;
    // Native TLH symbols and custom HD symbols both stay below the annotation rows.
    const chords = Array.from(document.querySelectorAll('#osmd-container .cc-custom-chord-text,#osmd-container .cc-dot,#osmd-container [data-chord-symbol]'))
      .map(node => node.getBoundingClientRect()).filter(rect => rect.height && Math.abs(rect.top - (staffTop + bounds.top)) < 65 * zoom);
    return Math.min(staffTop - 34 * zoom, ...chords.map(rect => rect.top - bounds.top - 5));
  }
  function position(button, context) {
    const { bounds, rect, occupied, obstacles: score, anchor, row = 0, top: plannedTop } = context;
    const overlaps = (box, other) => box.left < other.right && box.right > other.left && box.top < other.bottom && box.bottom > other.top;
    const width = button.offsetWidth, height = button.offsetHeight;
    const left = Math.max(0, Math.min(bounds.width - width, rect.left - bounds.left));
    const limit = plannedTop ?? (anchor ? chordTop(anchor, bounds) : rect.top - bounds.top - 8);
    let top = limit - height - row * 32;
    // Keep the exact horizontal anchor; move only upwards when titles/notation need clearance.
    while (top >= 0) {
      const box = { left, right: left + width, top, bottom: top + height };
      if (!score.some(other => overlaps(box, other)) && !occupied.some(other => overlaps(box, other))) {
        button.style.left = `${left}px`; button.style.top = `${top}px`; occupied.push(box); return;
      }
      top -= height + 6;
    }
    // A mock renderer or unusually dense title can lack room. Keep the note accessible.
    button.style.left = `${left}px`; button.style.top = '0px'; occupied.push({ left, right: left + width, top: 0, bottom: height });
  }
  return { anchors, matches, fingerprint, obstacles, position, plan, reserveSpace, chordTop };
})();
