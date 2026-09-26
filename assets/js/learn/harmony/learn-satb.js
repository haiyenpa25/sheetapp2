/**
 * assets/js/learn/harmony/learn-satb.js — SATB Voice Extraction & MusicXML Parsing
 * Part of SheetApp Learn Studio
 */
const LearnSatb = (() => {
  'use strict';

  const _PITCH_MAP = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

  function pitchToMidi(step, octave, alter = 0) {
    const s = String(step).toUpperCase();
    const semitone = _PITCH_MAP[s] ?? 0;
    const oct = parseInt(octave, 10);
    const alt = parseInt(alter || 0, 10);
    return 12 * (oct + 1) + semitone + alt;
  }

  function pitchToNoteStr(step, octave, alter = 0) {
    if (!step || !octave) return null;
    let acc = '';
    const a = parseInt(alter || 0, 10);
    if (a === 1) acc = '#';
    else if (a === -1) acc = 'b';
    else if (a === 2) acc = '##';
    else if (a === -2) acc = 'bb';
    return `${step.toUpperCase()}${acc}${octave}`;
  }

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
        let noteTime = curTime;
        if (isChord) {
          noteTime = lastStartTime;
        } else {
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
    return pitchToMidi(stepEl.textContent.trim(), octEl.textContent.trim(), altEl ? altEl.textContent.trim() : 0);
  }

  function parseNoteData(noteEl, voiceName) {
    const isRest = noteEl.querySelector('rest') !== null;
    const stepEl = noteEl.querySelector('pitch > step');
    const octEl  = noteEl.querySelector('pitch > octave');
    const altEl  = noteEl.querySelector('pitch > alter');
    return {
      voice: voiceName,
      isRest: isRest,
      step: stepEl ? stepEl.textContent.trim().toUpperCase() : 'C',
      octave: octEl ? parseInt(octEl.textContent.trim(), 10) : 4,
      alter: altEl ? parseInt(altEl.textContent.trim(), 10) : 0,
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
      soprano: sopranoNote ? parseNoteData(sopranoNote, 'soprano') : null,
      alto:    altoNote ? parseNoteData(altoNote, 'alto') : null,
      tenor:   tenorNote ? parseNoteData(tenorNote, 'tenor') : null,
      bass:    bassNote ? parseNoteData(bassNote, 'bass') : null,
    };
  }

  function extractSongMeta(xmlDoc) {
    if (!xmlDoc) return;
    const firstMeasure = xmlDoc.querySelector('measure');
    if (!firstMeasure) return;

    const beatsEl    = firstMeasure.querySelector('time > beats');
    const beatTypeEl = firstMeasure.querySelector('time > beat-type');
    const tempoEl    = xmlDoc.querySelector('sound[tempo]');

    if (beatsEl)    LearnStore.set('_beats',    parseInt(beatsEl.textContent, 10));
    if (beatTypeEl) LearnStore.set('_beatType', parseInt(beatTypeEl.textContent, 10));

    if (tempoEl) {
      const songBpm = parseFloat(tempoEl.getAttribute('tempo'));
      if (songBpm > 0) {
        LearnStore.set('bpm', songBpm);
        const bpmLabel = document.getElementById('learn-bpm-value');
        if (bpmLabel) bpmLabel.textContent = Math.round(songBpm);
      }
    }
  }

  function getSongMeta(xmlDoc) {
    const firstPart = xmlDoc ? xmlDoc.querySelector('part') : null;
    const measuresCount = firstPart
      ? firstPart.querySelectorAll('measure').length
      : (xmlDoc ? xmlDoc.querySelectorAll('part:first-of-type > measure').length : 16);

    return {
      beats:         LearnStore.get('_beats') ?? 4,
      beatType:      LearnStore.get('_beatType') ?? 4,
      totalMeasures: measuresCount || 16,
    };
  }

  return {
    pitchToMidi,
    pitchToNoteStr,
    groupChordsInMeasure,
    pitchValue,
    parseNoteData,
    extractSatbNotesAt,
    extractSongMeta,
    getSongMeta,
  };
})();

if (typeof window !== 'undefined') {
  window.LearnSatb = LearnSatb;
}
