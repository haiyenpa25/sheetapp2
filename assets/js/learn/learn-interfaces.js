/**
 * learn/learn-interfaces.js — Stage 0: Architecture Contracts & Type Definitions
 * Định nghĩa các interface/type dùng chung trong toàn bộ /learn module.
 * Đây là nguồn sự thật duy nhất cho data shapes.
 *
 * KHÔNG import ở đây. File này chỉ document & expose constants.
 * @module LearnInterfaces
 */

/* ─── ChordTimelineEvent ─────────────────────────────────────────────────────
 * Đơn vị cơ bản của Normalized Musical Timeline.
 * Output của ChordTimelineNormalizer — dùng bởi PatternEngine, ChordPanel,
 * VirtualKeyboard, VoicingEngine.
 *
 * @typedef {Object} ChordTimelineEvent
 * @property {string}  id            - Unique ID, dạng "m{measure}-b{beat*100}"
 * @property {number}  measure       - Ô nhịp (1-indexed, dùng MeasureNumberXML)
 * @property {number}  beat          - Phách bắt đầu trong ô (1.0, 1.5, 2.0...)
 * @property {number}  durationBeats - Số phách kéo dài
 * @property {string}  symbol        - Ký hiệu hợp âm gốc, vd "G/B"
 * @property {string}  normalizedSymbol - Sau sanitize, vd "G/B"
 * @property {string|null} transposedSymbol - Sau transpose (null nếu transpose=0)
 * @property {string}  source        - "HD" | "default" | tên chord set
 * @property {string|null} bass      - Bass note nếu slash chord, vd "B"
 */

/* ─── PatternEvent ───────────────────────────────────────────────────────────
 * Một event trong Pattern — không chứa chord cụ thể, chỉ định nghĩa structure.
 *
 * @typedef {Object} PatternEvent
 * @property {number}  at           - Thời điểm trong 1 measure (tính bằng beats, 0-indexed)
 * @property {number}  duration     - Độ dài (beats)
 * @property {string}  pitch        - "root" | "third" | "fifth" | "seventh" | bass note
 * @property {string}  voicing      - "root-position" | "nearest" | "open" | "closed"
 * @property {number[]} degrees     - Scale degrees, vd [1, 3, 5]
 * @property {number}  octave       - Octave offset từ reference
 * @property {number}  velocity     - 0–127
 */

/* ─── PatternDefinition ──────────────────────────────────────────────────────
 * Một kiểu đệm hoàn chỉnh (vd Worship 4/4 Basic).
 *
 * @typedef {Object} PatternDefinition
 * @property {string}  id               - Slug ID, vd "piano-worship-4-4-basic-v1"
 * @property {string}  name             - Tên hiển thị
 * @property {string}  instrumentFamily - "piano" | "organ"
 * @property {string}  meter            - "4/4" | "3/4" | "6/8"
 * @property {string}  difficulty       - "beginner" | "basic" | "intermediate" | "advanced"
 * @property {string}  category         - "worship" | "ballad" | "pop" | "waltz" | "arpeggio"
 * @property {number}  stepsPerBeat     - Subdivision (1=quarter, 2=eighth)
 * @property {number}  tempoMin         - BPM min phù hợp
 * @property {number}  tempoMax         - BPM max phù hợp
 * @property {Object[]} lanes           - Các track (bass, piano, etc.)
 * @property {PatternEvent[]} lanes[].events
 */

/* ─── PlayableNoteEvent ──────────────────────────────────────────────────────
 * Output của VoicingEngine — đã có pitch cụ thể, sẵn sàng cho LearnSoundEngine.
 *
 * @typedef {Object} PlayableNoteEvent
 * @property {number}  atSeconds    - Thời điểm tuyệt đối (Audio Clock)
 * @property {number}  durationSec  - Độ dài giây
 * @property {string}  note         - Tên nốt MIDI, vd "G3", "B2"
 * @property {number}  midi         - MIDI number (0–127)
 * @property {number}  velocity     - 0–127
 * @property {string}  instrument   - "piano" | "bass" | "pad" | "organ" | "drum"
 * @property {string}  lane         - Lane ID từ Pattern
 */

/* ─── LearnState ─────────────────────────────────────────────────────────────
 * Namespace trong Store cho /learn page.
 * Khởi tạo bởi learn-store.js
 *
 * @typedef {Object} LearnState
 * @property {number|null} songId
 * @property {string}  mode             - "piano" | "organ" | "chord" | "satb" | "melody"
 * @property {string}  difficulty       - "beginner" | "basic" | "intermediate" | "advanced"
 * @property {string}  chordSet         - "HD" | "default" | custom
 * @property {string|null} patternId
 * @property {string}  instrumentPreset - "piano-lite" | "piano-grand" | "organ-church"
 * @property {number}  bpm              - Practice BPM
 * @property {number}  speed            - 0.5–1.5
 * @property {Object}  loop
 * @property {boolean} loop.enabled
 * @property {number|null} loop.startMeasure
 * @property {number|null} loop.endMeasure
 * @property {Object}  current
 * @property {number}  current.measure
 * @property {number}  current.beat
 * @property {ChordTimelineEvent|null} current.chord
 * @property {Object}  midi
 * @property {boolean} midi.enabled
 * @property {string|null} midi.inputId
 */

/* ─── LearnUIState ───────────────────────────────────────────────────────────
 * UI State Machine cho /learn
 *
 * @typedef {'idle'|'song_selected'|'preparing'|'ready'|'playing'|'paused'|'looping'|'completed'} LearnUIStatus
 */

/* ─── EventBus Events ────────────────────────────────────────────────────────
 * Các event /learn phát qua EventBus.
 * Payload document bên dưới.
 */
const LEARN_EVENTS = Object.freeze({
  READY:            'learn:ready',           // { songId }
  PLAY:             'learn:play',            // {}
  PAUSE:            'learn:pause',           // {}
  STOP:             'learn:stop',            // {}
  POSITION_CHANGED: 'learn:position_changed',// { measure, beat, timeSeconds }
  CHORD_CHANGED:    'learn:chord_changed',   // { chord: ChordTimelineEvent, next: ChordTimelineEvent|null }
  PATTERN_CHANGED:  'learn:pattern_changed', // { patternId }
  MODE_CHANGED:     'learn:mode_changed',    // { mode }
  LOOP_CHANGED:     'learn:loop_changed',    // { enabled, startMeasure, endMeasure }
  MIDI_NOTE_ON:     'learn:midi_note_on',    // { note, midi, velocity, timestamp }
  MIDI_NOTE_OFF:    'learn:midi_note_off',   // { note, midi, timestamp }
  EVALUATION:       'learn:evaluation',      // { measure, accuracy, timing }
  SESSION_STARTED:  'learn:session_started', // { sessionId, songId, mode }
  SESSION_FINISHED: 'learn:session_finished',// { sessionId, summary }
});

/* ─── Feature Flags ──────────────────────────────────────────────────────────
 * Kiểm soát tính năng theo giai đoạn.
 * Stage 0-5: chỉ SHELL và CHORD_TIMELINE, TRANSPORT, PIANO cơ bản.
 */
const LEARN_FLAGS = Object.freeze({
  SHELL:             true,   // Stage 1 — /learn page shell
  CHORD_TIMELINE:    true,   // Stage 2 — ChordTimelineNormalizer
  TRANSPORT:         true,   // Stage 3 — MusicTransport
  SOUND_ENGINE:      true,   // Stage 4 — LearnSoundEngine (synth lite)
  PIANO_PATTERN:     true,   // Stage 5 — Basic piano accompaniment
  SATB_TRAINER:      true,   // Stage 5+ — Listen & Follow mode
  ORGAN_MODE:        false,  // Stage 8
  MIDI_EVAL:         false,  // Stage 9
  PRACTICE_PROGRESS: false,  // Stage 7
  LIVE_SESSION:      false,  // OFF — /learn không bật Live mặc định
});

/* ─── Quality Gates ──────────────────────────────────────────────────────────
 * Danh sách kiểm tra trước mỗi feature merge (reference từ deep analysis)
 */
const LEARN_QUALITY_GATES = [
  'No duplicate song loader',
  'No duplicate transpose logic',
  'No DOM pixel → musical timing dependency',
  'No server audio rendering',
  'No per-note HTTP request',
  'No hard-coded chord notes if Tonal can parse',
  'No audio setInterval as source-of-truth',
  'iOS user gesture tested',
  'mobile tested',
  'transpose tested',
  '4/4 tested',
  '3/4 tested if relevant',
  '6/8 tested if relevant',
  'cleanup/dispose tested',
];

// Expose cho debug
if (typeof window !== 'undefined') {
  window.LearnInterfaces = { LEARN_EVENTS, LEARN_FLAGS, LEARN_QUALITY_GATES };
}
