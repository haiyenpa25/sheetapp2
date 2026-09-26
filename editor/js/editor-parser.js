/**
 * editor/js/editor-parser.js — MusicXML SATB Note & Measure Parser
 * Tách và nhóm nốt 4 bè SATB chính xác theo trục thời gian, phách, và hợp âm đa âm.
 */
(() => {
  'use strict';

  function groupChordsInMeasure(measureEl) {
    if (!measureEl) return [];
    const notesByTime = new Map();
    let curTime = 0;
    let lastStartTime = 0;

    for (const child of Array.from(measureEl.children)) {
      const tag = child.tagName.toLowerCase();
      if (tag === 'note') {
        const isChord = child.querySelector('chord') !== null;
        const dur = parseInt(child.querySelector('duration')?.textContent || '0', 10);
        let noteTime = isChord ? lastStartTime : curTime;
        if (!isChord) {
          lastStartTime = curTime;
          curTime += dur;
        }
        if (!notesByTime.has(noteTime)) notesByTime.set(noteTime, []);
        notesByTime.get(noteTime).push(child);
      } else if (tag === 'backup') {
        const dur = parseInt(child.querySelector('duration')?.textContent || '0', 10);
        curTime = Math.max(0, curTime - dur);
      } else if (tag === 'forward') {
        const dur = parseInt(child.querySelector('duration')?.textContent || '0', 10);
        curTime += dur;
      }
    }

    const sortedTimes = Array.from(notesByTime.keys()).sort((a, b) => a - b);
    return sortedTimes.map(t => notesByTime.get(t));
  }

  function pitchValue(noteEl) {
    const stepEl = noteEl.querySelector('pitch > step');
    const octEl  = noteEl.querySelector('pitch > octave');
    const altEl  = noteEl.querySelector('pitch > alter');
    if (!stepEl || !octEl) return 0;
    const pitchToMidi = window.EditorAudio?.pitchToMidi || ((s, o, a = 0) => {
      const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[s?.toUpperCase()] ?? 0;
      return (parseInt(o, 10) + 1) * 12 + base + (parseInt(a, 10) || 0);
    });
    return pitchToMidi(stepEl.textContent.trim(), octEl.textContent.trim(), altEl ? altEl.textContent.trim() : 0);
  }

  function parseNoteData(noteEl, voiceName, chordGroup = null) {
    const isRest = noteEl.querySelector('rest') !== null;
    const stepEl = noteEl.querySelector('pitch > step');
    const octEl  = noteEl.querySelector('pitch > octave');
    const altEl  = noteEl.querySelector('pitch > alter');
    const typeEl = noteEl.querySelector('type');
    const dotEl  = noteEl.querySelector('dot') !== null;
    const durEl  = noteEl.querySelector('duration');
    let lyricEl  = noteEl.querySelector('lyric > text');
    if (!lyricEl && chordGroup && Array.isArray(chordGroup)) {
      for (const sib of chordGroup) {
        const sibLyric = sib.querySelector('lyric > text');
        if (sibLyric && sibLyric.textContent.trim()) {
          lyricEl = sibLyric;
          break;
        }
      }
    }

    return {
      xmlNode: noteEl,
      voice: voiceName,
      isRest: isRest,
      step: stepEl ? stepEl.textContent.trim().toUpperCase() : 'C',
      octave: octEl ? parseInt(octEl.textContent.trim(), 10) : 4,
      alter: altEl ? parseInt(altEl.textContent.trim(), 10) : 0,
      type: typeEl ? typeEl.textContent.trim().toLowerCase() : 'quarter',
      isDot: dotEl,
      duration: durEl ? parseInt(durEl.textContent.trim(), 10) : 4,
      lyric: lyricEl ? lyricEl.textContent.trim() : '',
      isTie: !!(noteEl.querySelector('tie') || noteEl.querySelector('tied')),
      isSlur: !!noteEl.querySelector('slur'),
      isFermata: !!noteEl.querySelector('fermata'),
      isTuplet: !!noteEl.querySelector('time-modification'),
      isStaccato: !!noteEl.querySelector('staccato'),
      isAccent: !!noteEl.querySelector('accent'),
      isTenuto: !!noteEl.querySelector('tenuto'),
      _chordSiblings: chordGroup
    };
  }

  function extractSatbNotesAt(xmlDoc, measureNum, beatIndex = 0) {
    if (!xmlDoc) return null;
    const parts = xmlDoc.querySelectorAll('part');
    const part1 = xmlDoc.querySelector('part#P1') || parts[0];
    const part2 = xmlDoc.querySelector('part#P2') || parts[1];
    if (!part1) return null;

    const m1 = part1.querySelector(`measure[number="${measureNum}"]`);
    const m2 = part2 ? part2.querySelector(`measure[number="${measureNum}"]`) : null;
    if (!m1) return null;

    const p1Chords = groupChordsInMeasure(m1);
    const p2Chords = m2 ? groupChordsInMeasure(m2) : [];
    const totalBeats = Math.max(p1Chords.length, 1);
    const safeIdx = Math.max(0, Math.min(beatIndex, totalBeats - 1));

    const chordP1 = p1Chords[safeIdx] || [];
    const chordP2 = p2Chords[safeIdx] || [];
    const allChordsAtBeat = [...chordP1, ...chordP2];

    let sopranoNote = null;
    let altoNote = null;
    if (chordP1.length === 1) {
      sopranoNote = chordP1[0];
    } else if (chordP1.length >= 2) {
      const sorted = [...chordP1].sort((a, b) => pitchValue(b) - pitchValue(a));
      sopranoNote = sorted[0];
      altoNote = sorted[1];
    }

    let tenorNote = null;
    let bassNote = null;
    if (chordP2.length === 1) {
      bassNote = chordP2[0];
    } else if (chordP2.length >= 2) {
      const sorted = [...chordP2].sort((a, b) => pitchValue(b) - pitchValue(a));
      tenorNote = sorted[0];
      bassNote = sorted[1];
    }

    return {
      beatIndex: safeIdx,
      totalBeats: totalBeats,
      soprano: sopranoNote ? parseNoteData(sopranoNote, 'soprano', allChordsAtBeat) : null,
      alto:    altoNote ? parseNoteData(altoNote, 'alto', allChordsAtBeat) : null,
      tenor:   tenorNote ? parseNoteData(tenorNote, 'tenor', allChordsAtBeat) : null,
      bass:    bassNote ? parseNoteData(bassNote, 'bass', allChordsAtBeat) : null
    };
  }

  function getMeasureChordsSATB(xmlDoc, measureNum) {
    if (!xmlDoc) return [];
    const parts = xmlDoc.querySelectorAll('part');
    const part1 = xmlDoc.querySelector('part#P1') || parts[0];
    if (!part1) return [];
    const m1 = part1.querySelector(`measure[number="${measureNum}"]`);
    if (!m1) return [];
    const chords = groupChordsInMeasure(m1);
    return chords.map((_, i) => {
      const satb = extractSatbNotesAt(xmlDoc, measureNum, i);
      return {
        soprano: satb?.soprano,
        alto: satb?.alto,
        tenor: satb?.tenor,
        bass: satb?.bass
      };
    });
  }

  window.EditorParser = {
    groupChordsInMeasure,
    pitchValue,
    parseNoteData,
    extractSatbNotesAt,
    getMeasureChordsSATB
  };
})();
