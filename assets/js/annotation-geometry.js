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
        result.push({ measureIdx, staffIdx, noteIdx, beat, el });
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
  function position(button, context) {
    const { bounds, rect, occupied, obstacles: score } = context;
    const overlaps = (box, other) => box.left < other.right && box.right > other.left && box.top < other.bottom && box.bottom > other.top;
    const collides = box => score.some(other => overlaps(box, other)) || occupied.some(other => overlaps(box, other));
    const search = compact => {
      const width = button.offsetWidth, height = button.offsetHeight;
      const clamp = left => Math.max(0, Math.min(bounds.width - width, left));
      const lefts = [clamp(rect.left - bounds.left), clamp(rect.right - bounds.left + 12), clamp(rect.left - bounds.left - width - 6)];
      if (compact) lefts.push(0, Math.max(0, bounds.width - width));
      for (let step = 0; step < (compact ? 7 : 5); step++) {
        for (const left of lefts) {
          const offset = step ? Math.ceil(step / 2) * (height + 4) * (step % 2 ? -1 : 1) : 0;
          const top = rect.top - bounds.top - height - 5 + offset;
          const box = { left, right: left + width, top, bottom: top + height };
          if (top >= 0 && box.bottom <= bounds.height && !collides(box)) return box;
        }
      }
      return null;
    };
    let box = search(false);
    if (!box && button.classList.contains('ano-dot')) {
      button.textContent = '✎'; button.classList.add('ano-compact'); box = search(true);
    }
    if (!box) box = search(true);
    if (!box) { button.remove(); return; }
    button.style.left = `${box.left}px`; button.style.top = `${box.top}px`; occupied.push(box);
  }
  return { anchors, matches, fingerprint, obstacles, position };
})();
