/**
 * assets/js/learn/transport/learn-transport-bridge.js — MusicTransport Callbacks & Event Dispatch
 * Part of SheetApp Learn Studio
 */
const LearnTransportBridge = (() => {
  'use strict';

  function setup(ctx) {
    if (!window.MusicTransport) return;

    // 1. Beat Callback
    MusicTransport.onBeat(({ measure, beat, time }) => {
      // Visual Metronome Beat Indicator update
      const beatDots = document.querySelectorAll('.beat-dot');
      beatDots.forEach(dot => {
        const dotBeat = parseInt(dot.dataset.beat, 10);
        dot.classList.toggle('active', dotBeat === beat);
      });

      // Metronome Audio Click (Ting on beat 1 downbeat, cốc on beats 2,3,4)
      if (window.LearnSoundEngine && LearnSoundEngine.isMetronomeEnabled && LearnSoundEngine.isMetronomeEnabled()) {
        LearnSoundEngine.playMetronomeClick(beat, beat === 1, time);
      }

      // Visual Cursor Tracking
      const osmd = ctx.getOsmd ? ctx.getOsmd() : null;
      if (osmd?.cursor && !osmd.cursor.isHidden) {
        osmd.cursor.next();
        if (osmd.cursor.cursorElement) {
          const cRect = osmd.cursor.cursorElement.getBoundingClientRect();
          const scoreSec = document.querySelector('.learn-score-section');
          if (scoreSec) {
            const vRect = scoreSec.getBoundingClientRect();
            const targetY = vRect.height * 0.32;
            const diff = cRect.top - vRect.top - targetY;
            if (Math.abs(diff) > 25) {
              scoreSec.scrollBy({ top: diff, behavior: 'smooth' });
            }
          }
        }
      }

      // Check chord changes on this beat for ChordCard, Keyboard & Wait Mode
      const timeline = window.LearnStore ? LearnStore.get('timeline') || [] : [];
      const chordOnBeat = timeline.find(e => e.measure === measure && e.beat === beat);
      if (chordOnBeat) {
        const nextChord = window.ChordTimelineNormalizer ? ChordTimelineNormalizer.getNextChord(timeline, chordOnBeat) : null;
        if (window.LearnStore) {
          LearnStore.setCurrentChord(chordOnBeat, nextChord);
          LearnStore.setCurrentPosition(measure, beat);
        }
        if (window.ChordCard) ChordCard.setChord(chordOnBeat, nextChord, ctx.getCurrentSong()?.defaultKey);
        if (window.EventBus && window.LEARN_EVENTS) {
          EventBus.emit(LEARN_EVENTS.CHORD_CHANGED, { chord: chordOnBeat, next: nextChord });
        }

        // Wait Mode pause on chord transition
        if (ctx.isWaitMode && ctx.isWaitMode() && (chordOnBeat.transposedSymbol || chordOnBeat.symbol)) {
          const chordSym = chordOnBeat.transposedSymbol || chordOnBeat.symbol;
          ctx.onChordWait(chordSym);
        }
      }

      // Mode-specific note playback
      const currentMode = (window.LearnStore ? LearnStore.get('mode') : null) || 'piano';
      if (currentMode === 'satb') {
        const satbBeat = ctx.extractSatbNotesAt ? ctx.extractSatbNotesAt(measure, beat - 1) : null;
        if (satbBeat && window.LearnSoundEngine) {
          const bpm = MusicTransport.getBpm() || 76;
          const durSec = (60 / bpm) * 0.88;
          ['soprano', 'alto', 'tenor', 'bass'].forEach(voice => {
            const vNote = satbBeat[voice];
            if (vNote && !vNote.isRest) {
              const noteStr = ctx.pitchToNoteStr ? ctx.pitchToNoteStr(vNote.step, vNote.octave, vNote.alter) : null;
              if (noteStr) {
                LearnSoundEngine.triggerSatbNote(voice, noteStr, durSec, time, 0.7);
              }
            }
          });
        }
      } else if (currentMode === 'melody') {
        const satbBeat = ctx.extractSatbNotesAt ? ctx.extractSatbNotesAt(measure, beat - 1) : null;
        if (satbBeat?.soprano && !satbBeat.soprano.isRest && window.LearnSoundEngine) {
          const bpm = MusicTransport.getBpm() || 76;
          const durSec = (60 / bpm) * 0.90;
          const vNote = satbBeat.soprano;
          const noteStr = ctx.pitchToNoteStr ? ctx.pitchToNoteStr(vNote.step, vNote.octave, vNote.alter) : null;
          if (noteStr) {
            LearnSoundEngine.triggerNote('piano', noteStr, durSec, time, 0.9, 'right');
          }
        }
      }
    });

    // 2. Measure Callback
    MusicTransport.onMeasure(({ measure }) => {
      const timeline = window.LearnStore ? LearnStore.get('timeline') || [] : [];
      const chord    = window.ChordTimelineNormalizer ? ChordTimelineNormalizer.getChordAt(timeline, measure, 1) : null;
      const next     = window.ChordTimelineNormalizer ? ChordTimelineNormalizer.getNextChord(timeline, chord) : null;

      if (window.LearnStore) {
        LearnStore.setCurrentChord(chord, next);
        LearnStore.setCurrentPosition(measure, 1);
      }

      if (window.ChordCard) ChordCard.setChord(chord, next, ctx.getCurrentSong()?.defaultKey);

      if (chord && window.EventBus && window.LEARN_EVENTS) {
        EventBus.emit(LEARN_EVENTS.CHORD_CHANGED, { chord, next });
      }

      // Auto-scroll score fallback nếu không dùng cursor
      const osmd = ctx.getOsmd ? ctx.getOsmd() : null;
      if (!osmd?.cursor || osmd.cursor.isHidden) {
        if (ctx.scrollToMeasure) {
          ctx.scrollToMeasure(measure);
        }
      }

      // Record practice stats
      if (window.PracticeTracker) {
        PracticeTracker.recordMeasure(measure, MusicTransport.getBpm());
      }
    });
  }

  return { setup };
})();

if (typeof window !== 'undefined') {
  window.LearnTransportBridge = LearnTransportBridge;
}
