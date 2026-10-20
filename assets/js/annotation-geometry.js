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
  return { anchors, matches, fingerprint };
})();
