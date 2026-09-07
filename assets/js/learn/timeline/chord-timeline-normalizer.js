/**
 * learn/timeline/chord-timeline-normalizer.js — Stage 2: Trái Tim của /learn
 *
 * Chuyển đổi chord set (measureIdx_noteIdx visual format) thành
 * Normalized Musical Timeline (measure + beat + duration).
 *
 * Input:  chordMap từ ChordCanvas.getCustomChords() + MusicXML doc
 * Output: ChordTimelineEvent[]
 *
 * Phụ thuộc: Tonal.js (window.Tonal)
 * KHÔNG phụ thuộc vào DOM pixel hay SVG layout.
 */
const ChordTimelineNormalizer = (() => {
  'use strict';

  /* ─── Chord Sanitizer ────────────────────────────────────────── */

  /**
   * Chuẩn hóa chord symbol sang format Tonal.js nhận.
   * Giữ rawSymbol, tạo normalizedSymbol.
   * @param {string} raw
   * @returns {{ rawSymbol: string, normalizedSymbol: string, bass: string|null }}
   */
  function _sanitizeSymbol(raw) {
    if (!raw) return { rawSymbol: '', normalizedSymbol: '', bass: null };

    let sym = String(raw).trim();
    let bass = null;

    // Tách slash chord: G/B → root=G, bass=B
    const slashIdx = sym.indexOf('/');
    if (slashIdx > 0) {
      bass = sym.slice(slashIdx + 1).trim();
      sym  = sym.slice(0, slashIdx).trim();
    }

    // Normalize variations phổ biến
    sym = sym
      .replace(/min$|m$|-$/, 'm')       // Gmin → Gm, G- → Gm
      .replace(/maj$|Maj$/, '')          // Gmaj → G
      .replace(/^([A-G])(b)/, '$1♭')    // Normalize flat (cosmetic only)
      .replace(/^([A-G])(#)/, '$1#');

    // Phục hồi flat notation cho Tonal
    sym = sym.replace('♭', 'b');

    const normalized = bass ? `${sym}/${bass}` : sym;
    return { rawSymbol: raw, normalizedSymbol: normalized, bass };
  }

  /* ─── MusicXML Parser Helpers ─────────────────────────────────── */

  /**
   * Parse <time> element từ measure để lấy beats và beat-type.
   * @param {Element} measureEl
   * @returns {{ beats: number, beatType: number }}
   */
  function _parseMeter(measureEl) {
    const timeEl = measureEl.querySelector('time');
    if (!timeEl) return { beats: 4, beatType: 4 };
    return {
      beats:    parseInt(timeEl.querySelector('beats')?.textContent || '4', 10),
      beatType: parseInt(timeEl.querySelector('beat-type')?.textContent || '4', 10),
    };
  }

  /**
   * Parse <divisions> từ measure (số divisions per quarter note).
   * @param {Element} measureEl
   * @returns {number}
   */
  function _parseDivisions(measureEl) {
    const divEl = measureEl.querySelector('attributes > divisions');
    return divEl ? parseInt(divEl.textContent, 10) : 1;
  }

  /**
   * Tính beat position từ duration và divisions.
   * @param {number} totalDivisions - Tổng số divisions đã đi qua
   * @param {number} divisions      - Divisions per quarter
   * @param {number} beatType       - Beat type (4 = quarter)
   * @returns {number} Beat position (1.0-indexed)
   */
  function _divisionsToBeat(totalDivisions, divisions, beatType) {
    // Divisions per beat = divisions * (4/beatType)
    const divisionsPerBeat = divisions * (4 / beatType);
    return 1 + totalDivisions / divisionsPerBeat;
  }

  /**
   * Convert note duration element sang số beats.
   * @param {Element} noteEl
   * @param {number}  divisions
   * @param {number}  beatType
   * @returns {number}
   */
  function _noteDurationBeats(noteEl, divisions, beatType) {
    const dur = parseInt(noteEl.querySelector('duration')?.textContent || '0', 10);
    const divisionsPerBeat = divisions * (4 / beatType);
    return dur / divisionsPerBeat;
  }

  /* ─── Chord Set → Beat Map ────────────────────────────────────── */

  /**
   * Build a lookup map: measureIdx → [ {noteIdx, symbol} ]
   * từ chord set data (format hiện tại của SheetApp).
   *
   * @param {Object[]|Object} chordData - Array of {measureIdx, noteIdx, chord} or map object
   * @returns {Map<number, Array<{noteIdx: number, symbol: string}>>}
   */
  function _buildChordLookup(chordData) {
    const lookup = new Map(); // measureIdx → [{noteIdx, symbol}]

    const items = Array.isArray(chordData)
      ? chordData
      : Object.entries(chordData || {}).map(([k, v]) => {
          const [mi, ni] = k.split('_').map(Number);
          return { measureIdx: mi, noteIdx: ni, chord: v };
        });

    for (const item of items) {
      const mi = item.measureIdx ?? item.m;
      const ni = item.noteIdx   ?? item.n;
      const ch = item.chord     ?? item.c;
      if (!ch) continue;
      if (!lookup.has(mi)) lookup.set(mi, []);
      lookup.get(mi).push({ noteIdx: ni, symbol: ch });
    }

    // Sort each measure by noteIdx
    for (const [, arr] of lookup) {
      arr.sort((a, b) => a.noteIdx - b.noteIdx);
    }

    return lookup;
  }

  /* ─── XML <harmony> Parser Helpers ────────────────────────────── */

  /**
   * Parse MusicXML <harmony> element thành chord symbol & bass.
   * Hỗ trợ <root>, <kind>, <bass>, <degree>.
   * @param {Element} harmonyEl
   * @returns {{ symbol: string, bass: string|null }|null}
   */
  function _parseHarmonyElement(harmonyEl) {
    if (!harmonyEl) return null;

    // Root step & alter
    const rootEl = harmonyEl.querySelector('root');
    if (!rootEl) return null;
    const step = rootEl.querySelector('root-step')?.textContent?.trim() || '';
    if (!step) return null;

    const alterVal = parseInt(rootEl.querySelector('root-alter')?.textContent || '0', 10);
    let alterStr = '';
    if (alterVal === 1) alterStr = '#';
    else if (alterVal === -1) alterStr = 'b';
    else if (alterVal === 2) alterStr = '##';
    else if (alterVal === -2) alterStr = 'bb';

    const root = step + alterStr;

    // Kind
    const kindEl = harmonyEl.querySelector('kind');
    const kindText = kindEl?.getAttribute('text');
    const kindVal = kindEl?.textContent?.trim() || '';

    let suffix = '';
    if (kindText !== null && kindText !== undefined && kindText !== '') {
      suffix = kindText;
    } else {
      switch (kindVal.toLowerCase()) {
        case 'major': suffix = ''; break;
        case 'minor': suffix = 'm'; break;
        case 'dominant':
        case 'dominant-seventh': suffix = '7'; break;
        case 'major-seventh': suffix = 'maj7'; break;
        case 'minor-seventh': suffix = 'm7'; break;
        case 'diminished': suffix = 'dim'; break;
        case 'augmented': suffix = 'aug'; break;
        case 'suspended-fourth': suffix = 'sus4'; break;
        case 'suspended-second': suffix = 'sus2'; break;
        case 'diminished-seventh': suffix = 'dim7'; break;
        case 'half-diminished': suffix = 'm7b5'; break;
        case 'major-sixth': suffix = '6'; break;
        case 'minor-sixth': suffix = 'm6'; break;
        case 'ninth': suffix = '9'; break;
        case 'major-ninth': suffix = 'maj9'; break;
        case 'minor-ninth': suffix = 'm9'; break;
        default: suffix = kindVal === 'none' ? '' : kindVal; break;
      }
    }

    // Bass
    let bass = null;
    const bassEl = harmonyEl.querySelector('bass');
    if (bassEl) {
      const bStep = bassEl.querySelector('bass-step')?.textContent?.trim() || '';
      const bAlterVal = parseInt(bassEl.querySelector('bass-alter')?.textContent || '0', 10);
      let bAlterStr = '';
      if (bAlterVal === 1) bAlterStr = '#';
      else if (bAlterVal === -1) bAlterStr = 'b';
      if (bStep) {
        bass = bStep + bAlterStr;
      }
    }

    const symbol = bass ? `${root}${suffix}/${bass}` : `${root}${suffix}`;
    return { symbol, bass };
  }

  /**
   * Trích xuất các sự kiện hợp âm trực tiếp từ thẻ <harmony> trong MusicXML
   * khi bài hát chưa có bộ hợp âm tùy biến trong DB.
   * @param {Document} xmlDoc
   * @param {number}   [transpose=0]
   * @returns {ChordTimelineEvent[]}
   */
  function _extractHarmoniesFromXml(xmlDoc, transpose = 0) {
    if (!xmlDoc) return [];

    const firstPart = xmlDoc.querySelector('part');
    const measures = Array.from(firstPart ? firstPart.querySelectorAll('measure') : xmlDoc.querySelectorAll('part > measure'));
    if (!measures.length) return [];

    const events = [];
    let globalDivisions = 1;
    let globalBeats     = 4;
    let globalBeatType  = 4;

    measures.forEach((measureEl, measureIdx) => {
      const xmlNum = parseInt(measureEl.getAttribute('number') || (measureIdx + 1), 10);

      const attrDiv = measureEl.querySelector('attributes > divisions');
      if (attrDiv) globalDivisions = parseInt(attrDiv.textContent, 10);
      const meterEl = measureEl.querySelector('time');
      if (meterEl) {
        globalBeats    = parseInt(meterEl.querySelector('beats')?.textContent || '4', 10);
        globalBeatType = parseInt(meterEl.querySelector('beat-type')?.textContent || '4', 10);
      }

      const divisionsPerBeat = globalDivisions * (4 / globalBeatType);
      let currentDivPosition = 0;
      const measureHarmonies = [];

      for (const child of measureEl.children) {
        const tag = child.tagName;
        if (tag === 'note') {
          const isChord = !!child.querySelector('chord');
          const dur = parseInt(child.querySelector('duration')?.textContent || '0', 10);
          if (!isChord) {
            currentDivPosition += dur;
          }
        } else if (tag === 'backup') {
          const dur = parseInt(child.querySelector('duration')?.textContent || '0', 10);
          currentDivPosition = Math.max(0, currentDivPosition - dur);
        } else if (tag === 'forward') {
          const dur = parseInt(child.querySelector('duration')?.textContent || '0', 10);
          currentDivPosition += dur;
        } else if (tag === 'attributes') {
          const divEl = child.querySelector('divisions');
          if (divEl) globalDivisions = parseInt(divEl.textContent, 10);
        } else if (tag === 'harmony') {
          const parsed = _parseHarmonyElement(child);
          if (parsed && parsed.symbol) {
            const offsetEl = child.querySelector('offset');
            const offsetDiv = offsetEl ? parseInt(offsetEl.textContent, 10) : 0;
            const beatAt = 1 + Math.max(0, currentDivPosition + offsetDiv) / divisionsPerBeat;
            measureHarmonies.push({
              beat: beatAt,
              symbol: parsed.symbol,
              bass: parsed.bass,
            });
          }
        }
      }

      // Sắp xếp các hợp âm trong measure theo beat
      measureHarmonies.sort((a, b) => a.beat - b.beat);

      measureHarmonies.forEach((entry, i) => {
        const beatAt = Math.round(entry.beat * 100) / 100;
        const nextBeat = i + 1 < measureHarmonies.length
          ? Math.round(measureHarmonies[i + 1].beat * 100) / 100
          : (globalBeats + 1);
        const durationBeats = Math.max(0.5, nextBeat - beatAt);
        const sanitized = _sanitizeSymbol(entry.symbol);

        events.push({
          id:               `m${xmlNum}-b${Math.round(beatAt * 100)}`,
          measure:          xmlNum,
          beat:             beatAt,
          durationBeats,
          symbol:           entry.symbol,
          normalizedSymbol: sanitized.normalizedSymbol,
          transposedSymbol: transpose !== 0 ? _transposeSymbol(sanitized.normalizedSymbol, transpose) : null,
          source:           'musicxml-harmony',
          bass:             sanitized.bass || entry.bass,
        });
      });
    });

    return events;
  }

  /* ─── Main Normalization ──────────────────────────────────────── */

  /**
   * Normalize chord data từ XML + chordMap thành ChordTimelineEvent[].
   * Tự động fallback trích xuất <harmony> gốc từ MusicXML nếu chưa có custom chord set.
   *
   * @param {Document} xmlDoc   - MusicXML Document
   * @param {Object}   chordMap - Chord set data (array or map)
   * @param {number}   [transpose=0] - Current transpose semitones
   * @returns {ChordTimelineEvent[]}
   */
  function normalize(xmlDoc, chordMap, transpose = 0) {
    if (!xmlDoc) return [];

    const chordLookup = _buildChordLookup(chordMap);

    // Fallback nếu không có custom chord nào trong DB
    if (chordLookup.size === 0) {
      return _extractHarmoniesFromXml(xmlDoc, transpose);
    }

    const events = [];
    const firstPart = xmlDoc.querySelector('part');
    const measures = Array.from(firstPart ? firstPart.querySelectorAll('measure') : xmlDoc.querySelectorAll('part > measure'));
    let globalDivisions = 1;
    let globalBeats     = 4;
    let globalBeatType  = 4;

    measures.forEach((measureEl, measureIdx) => {
      // MeasureNumberXML (canonical identifier, từ XML attribute)
      const xmlNum = parseInt(measureEl.getAttribute('number') || (measureIdx + 1), 10);

      // Update running meter/divisions if measure has attributes
      const attrDiv = measureEl.querySelector('attributes > divisions');
      if (attrDiv) globalDivisions = parseInt(attrDiv.textContent, 10);
      const meterEl = measureEl.querySelector('time');
      if (meterEl) {
        globalBeats    = parseInt(meterEl.querySelector('beats')?.textContent || '4', 10);
        globalBeatType = parseInt(meterEl.querySelector('beat-type')?.textContent || '4', 10);
      }

      const divisionsPerBeat = globalDivisions * (4 / globalBeatType);

      if (!chordLookup.has(measureIdx)) return; // No chords this measure

      const chordEntries = chordLookup.get(measureIdx);

      // Walk notes in this measure to build noteIdx → beat mapping
      const noteBeats = _buildNoteBeatsMap(measureEl, globalDivisions, globalBeatType);

      chordEntries.forEach((entry, i) => {
        const beatAtNote = noteBeats.get(entry.noteIdx) ?? 1;
        const nextBeat   = i + 1 < chordEntries.length
          ? (noteBeats.get(chordEntries[i + 1].noteIdx) ?? globalBeats + 1)
          : (globalBeats + 1); // End of measure

        const durationBeats = Math.max(0.5, nextBeat - beatAtNote);
        const sanitized = _sanitizeSymbol(entry.symbol);

        /** @type {ChordTimelineEvent} */
        const event = {
          id:               `m${xmlNum}-b${Math.round(beatAtNote * 100)}`,
          measure:          xmlNum,
          beat:             beatAtNote,
          durationBeats,
          symbol:           entry.symbol,
          normalizedSymbol: sanitized.normalizedSymbol,
          transposedSymbol: transpose !== 0 ? _transposeSymbol(sanitized.normalizedSymbol, transpose) : null,
          source:           'chord-set',
          bass:             sanitized.bass,
        };

        events.push(event);
      });
    });

    return events;
  }

  /**
   * Build a map of noteIdx (0-based within measure) → beat (1.0-based)
   * Timeline-aware: respects <backup> and <forward> tags.
   *
   * @param {Element} measureEl
   * @param {number}  divisions
   * @param {number}  beatType
   * @returns {Map<number, number>}
   */
  function _buildNoteBeatsMap(measureEl, divisions, beatType) {
    const beatMap = new Map();
    const divisionsPerBeat = divisions * (4 / beatType);
    let currentDivPosition = 0;
    let noteIdx = 0;

    for (const child of measureEl.children) {
      const tag = child.tagName;

      if (tag === 'note') {
        const isChord  = !!child.querySelector('chord');
        const isRest   = !!child.querySelector('rest');
        const dur      = parseInt(child.querySelector('duration')?.textContent || '0', 10);

        if (!isChord) {
          // Non-chord notes start at current position
          beatMap.set(noteIdx, 1 + currentDivPosition / divisionsPerBeat);
          noteIdx++;
          if (!isRest) currentDivPosition += dur;
          else currentDivPosition += dur;
        } else {
          // <chord> notes share position with previous note — skip incrementing noteIdx
          // but don't advance position
        }
      } else if (tag === 'backup') {
        const dur = parseInt(child.querySelector('duration')?.textContent || '0', 10);
        currentDivPosition = Math.max(0, currentDivPosition - dur);
      } else if (tag === 'forward') {
        const dur = parseInt(child.querySelector('duration')?.textContent || '0', 10);
        currentDivPosition += dur;
      } else if (tag === 'attributes') {
        // Update divisions/meter within measure
        const divEl = child.querySelector('divisions');
        if (divEl) divisions = parseInt(divEl.textContent, 10);
      }
    }

    return beatMap;
  }

  /**
   * Transpose chord symbol bằng Tonal.js.
   * @param {string} symbol
   * @param {number} semitones
   * @returns {string}
   */
  function _transposeSymbol(symbol, semitones) {
    try {
      if (!symbol) return symbol;
      if (!window.Tonal) return symbol; // Tonal chưa load
      const interval = window.Tonal.Interval.fromSemitones(semitones);
      return window.Tonal.Chord.transpose(symbol, interval) || symbol;
    } catch {
      return symbol;
    }
  }

  /**
   * Lấy chord tại một vị trí cụ thể (measure + beat).
   * @param {ChordTimelineEvent[]} timeline
   * @param {number} measure
   * @param {number} beat
   * @returns {ChordTimelineEvent|null}
   */
  function getChordAt(timeline, measure, beat) {
    // Find last chord in same measure that starts at or before beat
    let result = null;
    for (const evt of timeline) {
      if (evt.measure > measure) break;
      if (evt.measure === measure && evt.beat <= beat) {
        result = evt;
      } else if (evt.measure < measure) {
        result = evt; // carry over from previous measures
      }
    }
    return result;
  }

  /**
   * Lấy chord tiếp theo sau một event.
   * @param {ChordTimelineEvent[]} timeline
   * @param {ChordTimelineEvent}   current
   * @returns {ChordTimelineEvent|null}
   */
  function getNextChord(timeline, current) {
    if (!current) return timeline[0] ?? null;
    const idx = timeline.findIndex(e => e.id === current.id);
    return idx >= 0 && idx + 1 < timeline.length ? timeline[idx + 1] : null;
  }

  /**
   * Quick validation: kiểm tra timeline hợp lệ.
   * @param {ChordTimelineEvent[]} timeline
   * @returns {{ valid: boolean, errors: string[] }}
   */
  function validate(timeline) {
    const errors = [];
    for (const evt of timeline) {
      if (!evt.id)                       errors.push(`Missing id`);
      if (!Number.isFinite(evt.measure)) errors.push(`measure NaN at ${evt.id}`);
      if (!Number.isFinite(evt.beat))    errors.push(`beat NaN at ${evt.id}`);
      if (evt.beat < 1)                  errors.push(`beat < 1 at ${evt.id}`);
      if (evt.durationBeats <= 0)        errors.push(`durationBeats <= 0 at ${evt.id}`);
      if (!evt.symbol)                   errors.push(`No symbol at ${evt.id}`);
    }
    return { valid: errors.length === 0, errors };
  }

  /* ─── Public API ─────────────────────────────────────────────── */
  return {
    normalize,
    getChordAt,
    getNextChord,
    validate,
    // Expose internals for testing
    _sanitizeSymbol,
    _buildNoteBeatsMap,
    _transposeSymbol,
    _parseHarmonyElement,
    _extractHarmoniesFromXml,
  };
})();

if (typeof window !== 'undefined') {
  window.ChordTimelineNormalizer = ChordTimelineNormalizer;
}
