/** Merge shared MusicXML notes while preserving pitch, lyrics, ties, and slurs. */
const CompactScore = (() => {
  'use strict';

  function _readEvents(doc) {
    const events = [];
    for (const part of doc.querySelectorAll('part')) {
      const staffVoices = new Map();
      for (const note of part.querySelectorAll('measure > note')) {
        const staff = note.querySelector(':scope > staff')?.textContent || '1';
        const voice = note.querySelector(':scope > voice')?.textContent || '1';
        if (!staffVoices.has(staff)) staffVoices.set(staff, new Set());
        staffVoices.get(staff).add(voice);
      }
      [...part.querySelectorAll(':scope > measure')].forEach((measure, measureIndex) => {
        let cursor = 0, lastOnset = 0;
        const measureEvents = [];
        for (const node of measure.children) {
          if (node.tagName === 'backup') { cursor -= Number(node.querySelector('duration')?.textContent || 0); continue; }
          if (node.tagName === 'forward') { cursor += Number(node.querySelector('duration')?.textContent || 0); continue; }
          if (node.tagName !== 'note') continue;
          const duration = Number(node.querySelector(':scope > duration')?.textContent || 0);
          const onset = node.querySelector(':scope > chord') ? lastOnset : cursor;
          if (!node.querySelector(':scope > chord')) { lastOnset = onset; cursor += duration; }
          const pitch = node.querySelector(':scope > pitch');
          const event = {
            part: part.getAttribute('id') || '', measure: measureIndex,
            staff: node.querySelector(':scope > staff')?.textContent || '1',
            onset, duration,
            pitch: pitch ? ['step', 'alter', 'octave'].map(tag => pitch.querySelector(tag)?.textContent || (tag === 'alter' ? '0' : '')).join('/') : null,
            voices: (node.getAttribute('data-sheetapp-voices') || node.querySelector(':scope > voice')?.textContent || '1').split(','),
            node
          };
          measureEvents.push(event);
        }
        for (const event of measureEvents) {
          if (!event.pitch || event.duration <= 0) continue;
          const simultaneous = measureEvents.filter(other => other.staff === event.staff && other.onset === event.onset && other.pitch);
          if (simultaneous.length !== 1) continue;
          const occupied = measureEvents.some(other => other !== event && other.staff === event.staff
            && other.voices.some(voice => !event.voices.includes(voice))
            && other.onset < event.onset + event.duration && other.onset + other.duration > event.onset);
          if (!occupied) event.voices = [...staffVoices.get(event.staff)].sort();
        }
        events.push(...measureEvents);
      });
    }
    return events;
  }

  function getVoiceEvents(xml) {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    return _readEvents(doc).map(({ node, ...event }) => event);
  }

  function _mergeSharedNote(target, duplicate, doc) {
    for (const tie of duplicate.querySelectorAll(':scope > tie')) {
      const exists = [...target.querySelectorAll(':scope > tie')]
        .some(item => item.getAttribute('type') === tie.getAttribute('type'));
      if (!exists) {
        const anchor = target.querySelector(':scope > voice, :scope > type, :scope > stem, :scope > staff, :scope > notations, :scope > lyric');
        target.insertBefore(tie.cloneNode(true), anchor);
      }
    }
    for (const lyric of duplicate.querySelectorAll(':scope > lyric')) {
      const text = lyric.querySelector('text')?.textContent || '';
      const existing = [...target.querySelectorAll(':scope > lyric')];
      if (existing.some(item => item.getAttribute('number') === lyric.getAttribute('number')
          && item.querySelector('text')?.textContent === text)) continue;
      const copy = lyric.cloneNode(true);
      const used = new Set(existing.map(item => item.getAttribute('number')));
      if (used.has(copy.getAttribute('number'))) {
        let number = 1;
        while (used.has(String(number))) number++;
        copy.setAttribute('number', String(number));
      }
      target.appendChild(copy);
    }
    const extra = duplicate.querySelector(':scope > notations');
    if (!extra) return;
    let notations = target.querySelector(':scope > notations');
    if (!notations) {
      notations = doc.createElementNS(target.namespaceURI, 'notations');
      target.insertBefore(notations, target.querySelector(':scope > lyric'));
    }
    for (const symbol of extra.children) {
      const exists = [...notations.children].some(item => {
        if (item.tagName !== symbol.tagName) return false;
        if (symbol.tagName !== 'slur' && symbol.tagName !== 'tied') return item.isEqualNode(symbol);
        return item.getAttribute('type') === symbol.getAttribute('type')
          && item.getAttribute('number') === symbol.getAttribute('number');
      });
      if (!exists) notations.appendChild(symbol.cloneNode(true));
    }
  }

  function _pitchValue(event) {
    if (!event.pitch) return -Infinity;
    const [step, alter, octave] = event.pitch.split('/');
    return Number(octave) * 12 + ({ C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[step] || 0) + Number(alter);
  }

  function _forward(measure, duration) {
    const node = measure.ownerDocument.createElementNS(measure.namespaceURI, 'forward');
    const value = measure.ownerDocument.createElementNS(measure.namespaceURI, 'duration');
    value.textContent = String(duration);
    node.appendChild(value);
    return node;
  }

  function _copyLyrics(target, donor, policy = 'newNumber') {
    for (const lyric of donor.querySelectorAll(':scope > lyric')) {
      const present = [...target.querySelectorAll(':scope > lyric')].some(item => {
        if (item.getAttribute('number') !== lyric.getAttribute('number')) return false;
        return policy !== 'unique' || item.querySelector('text')?.textContent === lyric.querySelector('text')?.textContent;
      });
      if (policy === 'all' || !present) target.appendChild(lyric.cloneNode(true));
    }
  }

  function _copyMelodyMarks(target, donor, samePitch, sameVoice = false) {
    _copyLyrics(target, donor, sameVoice ? 'all' : 'unique');
    if (samePitch) {
      _mergeSharedNote(target, donor, target.ownerDocument);
      return;
    }
    const slurs = donor.querySelectorAll(':scope > notations > slur');
    if (!slurs.length) return;
    let notations = target.querySelector(':scope > notations');
    if (!notations) {
      notations = target.ownerDocument.createElementNS(target.namespaceURI, 'notations');
      target.insertBefore(notations, target.querySelector(':scope > lyric'));
    }
    for (const slur of slurs) {
      const exists = [...notations.querySelectorAll(':scope > slur')].some(item =>
        item.getAttribute('number') === slur.getAttribute('number')
        && item.getAttribute('type') === slur.getAttribute('type'));
      if (!exists) notations.appendChild(slur.cloneNode(true));
    }
  }

  function _trebleStaves(part) {
    const staves = new Set();
    const seen = new Set();
    for (const clef of part.querySelectorAll('measure attributes clef')) {
      const staff = clef.getAttribute('number') || '1';
      if (seen.has(staff)) continue;
      seen.add(staff);
      if (clef.querySelector('sign')?.textContent === 'G') staves.add(staff);
    }
    return staves;
  }

  function _reduceTreble(doc, sourceEvents, prefs) {
    const selected = new Set();
    const promotedBases = new Set();
    for (const part of doc.querySelectorAll('part')) {
      const trebleStaves = _trebleStaves(part);
      if (!trebleStaves.size) continue;
      const partEvents = sourceEvents.filter(event => event.part === (part.getAttribute('id') || ''));
      for (const staff of trebleStaves) {
        const staffEvents = partEvents.filter(event => event.staff === staff);
        const lyricCounts = new Map();
        for (const event of staffEvents) {
          if (!event.pitch || !event.node.querySelector(':scope > lyric')) continue;
          const voice = event.node.querySelector(':scope > voice')?.textContent || '1';
          lyricCounts.set(voice, (lyricCounts.get(voice) || 0) + 1);
        }
        const voices = [...new Set(staffEvents.map(event => event.node.querySelector(':scope > voice')?.textContent || '1'))];
        voices.sort((a, b) => (lyricCounts.get(b) || 0) - (lyricCounts.get(a) || 0)
          || Number(a) - Number(b));
        const lead = voices[0];
        for (const measureIndex of new Set(staffEvents.map(event => event.measure))) {
          const measureEvents = staffEvents.filter(event => event.measure === measureIndex);
          const leadEvents = measureEvents.filter(event => (event.node.querySelector(':scope > voice')?.textContent || '1') === lead);
          const onsets = [...new Set(measureEvents.map(event => event.onset))].sort((a, b) => a - b);
          for (const onset of onsets) {
            let candidates = measureEvents.filter(event => event.onset === onset);
            if (prefs.hideVoices) {
              const leadHere = candidates.filter(event => (event.node.querySelector(':scope > voice')?.textContent || '1') === lead);
              if (leadHere.length) candidates = leadHere;
              else if (leadEvents.some(event => event.onset < onset && event.onset + event.duration > onset)) continue;
              else {
                const firstVoice = candidates.map(event => event.node.querySelector(':scope > voice')?.textContent || '1').sort((a, b) => Number(a) - Number(b))[0];
                candidates = candidates.filter(event => (event.node.querySelector(':scope > voice')?.textContent || '1') === firstVoice);
              }
            }
            const groups = prefs.hideVoices ? [candidates] : voices.map(voice =>
              candidates.filter(event => (event.node.querySelector(':scope > voice')?.textContent || '1') === voice)).filter(group => group.length);
            for (const group of groups) {
              const pitched = group.filter(event => event.pitch);
              const chosen = prefs.hideChordNotes && pitched.length
                ? pitched.reduce((best, event) => _pitchValue(event) > _pitchValue(best) ? event : best)
                : null;
              const keep = chosen ? [chosen] : group;
              keep.forEach(event => selected.add(event.node));
              if (!chosen) continue;
              for (const donor of group) {
                if (donor === chosen) continue;
                _copyMelodyMarks(chosen.node, donor.node, donor.pitch === chosen.pitch, true);
              }
              if (prefs.hideVoices) {
                for (const other of measureEvents) {
                  if (other === chosen || other.onset !== onset) continue;
                  if (other.pitch === chosen.pitch && other.duration === chosen.duration) {
                    _copyMelodyMarks(chosen.node, other.node, true);
                  } else if (other.pitch && other.node.querySelector(':scope > lyric')) {
                    _copyLyrics(chosen.node, other.node);
                  }
                }
              }
              if (chosen.node.querySelector(':scope > chord')) {
                chosen.node.querySelector(':scope > chord').remove();
                const base = group.find(event => !event.node.querySelector(':scope > chord') && event !== chosen);
                if (base) promotedBases.add(base.node);
              }
            }
          }
        }
        for (const event of staffEvents) {
          if (selected.has(event.node)) continue;
          const measure = event.node.parentElement;
          if (!measure) continue;
          if (event.node.querySelector(':scope > chord') || promotedBases.has(event.node) || event.duration <= 0) {
            event.node.remove();
          } else {
            measure.replaceChild(_forward(measure, event.duration), event.node);
          }
        }
      }
    }
  }

  function _pruneUnpairedMarks(doc) {
    for (const part of doc.querySelectorAll('part')) {
      if (!_trebleStaves(part).size) continue;
      const events = _readEvents(doc).filter(event => event.part === (part.getAttribute('id') || '') && event.pitch)
        .sort((a, b) => a.measure - b.measure || a.onset - b.onset);
      for (const selector of [':scope > tie', ':scope > notations > tied', ':scope > notations > slur']) {
        const stacks = new Map();
        for (const event of events) {
          const marks = [...event.node.querySelectorAll(selector)];
          for (const mark of [...marks.filter(item => item.getAttribute('type') === 'stop'),
            ...marks.filter(item => item.getAttribute('type') !== 'stop')]) {
            const key = mark.tagName === 'slur' ? (mark.getAttribute('number') || '1') : event.pitch;
            const stack = stacks.get(key) || [];
            if (mark.getAttribute('type') === 'start') stack.push(mark);
            else if (mark.getAttribute('type') === 'stop') {
              if (stack.length) stack.pop();
              else mark.remove();
            } else if (!stack.length) mark.remove();
            stacks.set(key, stack);
          }
        }
        for (const stack of stacks.values()) stack.forEach(mark => mark.remove());
      }
    }
  }

  /** A matching onset, pitch, duration, and staff represents one shared note. */
  function preprocessXML(xml, prefs) {
      if (!prefs.hideVoices && !prefs.hideChordNotes) return xml;
      try {
          const doc = window.XmlDocCache?.getClonedDoc(xml) || new DOMParser().parseFromString(xml, "application/xml");
          const sourceEvents = _readEvents(doc);
          const memberships = new Map();
          for (const event of sourceEvents) {
            if (!event.pitch) continue;
            const key = [event.part, event.measure, event.staff, event.onset, event.duration, event.pitch].join('|');
            if (!memberships.has(key)) memberships.set(key, new Set());
            event.voices.forEach(voice => memberships.get(key).add(voice));
          }
          _reduceTreble(doc, sourceEvents, prefs);
          _pruneUnpairedMarks(doc);
          for (const event of _readEvents(doc)) {
            if (!event.pitch) continue;
            const key = [event.part, event.measure, event.staff, event.onset, event.duration, event.pitch].join('|');
            const voices = memberships.get(key);
            if (voices?.size > 1) event.node.setAttribute('data-sheetapp-voices', [...voices].sort().join(','));
          }
          return window.XmlDocCache?.serializeDoc?.(doc) ?? new XMLSerializer().serializeToString(doc);
      } catch (err) {
          console.error("XML Preprocess error:", err);
          return xml;
      }
  }

  return { preprocessXML, getVoiceEvents };
})();

window.CompactScore = CompactScore;
