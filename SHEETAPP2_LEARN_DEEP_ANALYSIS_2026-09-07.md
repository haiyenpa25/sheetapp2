# SHEETAPP2 — PHÂN TÍCH CHUYÊN SÂU MODULE `/learn`

> **Phiên bản tài liệu:** 1.0  
> **Ngày phân tích:** 07/09/2026  
> **Repository:** `haiyenpa25/sheetapp2`  
> **Mục tiêu:** Biến SheetApp từ ứng dụng đọc/chỉnh sửa sheet và tập band thành một **Interactive Music Learning & Practice Platform** có thể học Piano, Organ, hợp âm, kiểu đệm, SATB, MIDI và luyện tập theo từng bài MusicXML.  
> **Đối tượng sử dụng tài liệu:** Chủ dự án, Antigravity, Claude/GPT coding agent, lập trình viên bảo trì SheetApp.

---

# 0. KẾT LUẬN ĐIỀU HÀNH

## 0.1 Có nên làm `/learn` không?

**NÊN LÀM. Đây là hướng mở rộng rất phù hợp với SheetApp2 hiện tại.**

Repo hiện tại đã có phần lớn “hạ tầng âm nhạc” mà một ứng dụng học đàn trên web cần:

- MusicXML.
- OpenSheetMusicDisplay (OSMD).
- Tone.js.
- OsmdAudioPlayer.
- Tonal.js.
- Transpose Engine.
- Chord Canvas + nhiều chord set.
- Metronome Web Audio.
- SATB audio playback.
- Song Sections / Arrangement Roadmap.
- MusicalPosition theo ô nhịp.
- Count-in.
- PWA + Service Worker.
- Web MIDI đã có use case cho foot pedal.
- Live Band Sync.

Do đó `/learn` **không phải một dự án mới tách biệt**. Nó nên là lớp Practice/Learning mới nằm trên Core Music Engine hiện hữu.

---

## 0.2 Có quá tốn server không?

### Câu trả lời ngắn

**Không, nếu thiết kế đúng.**

Phần nặng nhất của `/learn` nên chạy **trên trình duyệt của người học**, gồm:

- render sheet;
- phân tích hợp âm;
- tính thế đảo;
- sinh pattern;
- tạo nốt đệm;
- phát Piano/Organ/Bass/Drum;
- metronome;
- MIDI input;
- so khớp nốt;
- cursor;
- A/B loop.

Server chủ yếu làm:

1. trả MusicXML;
2. trả chord set;
3. trả pattern/lesson metadata;
4. xác thực tài khoản;
5. lưu tiến độ học;
6. lưu learning arrangement.

Vì thế **CPU server không tăng nhiều** khi thêm `/learn` solo.

### Những thứ thực sự có thể làm server nặng

1. Live Sync polling rất dày nếu hàng trăm người cùng vào room.
2. Lưu từng nốt MIDI lên server theo thời gian thực.
3. Host hàng GB sample âm thanh mà không có cache/CDN.
4. Render audio backing track ở server.
5. Chạy OMR/AI/audio transcription trực tiếp trên server web.
6. Dùng SQLite với rất nhiều concurrent write cho lịch sử học.

Tất cả các vấn đề này đều tránh được bằng kiến trúc đề xuất trong tài liệu này.

---

## 0.3 Định vị sản phẩm đề xuất

```text
SheetApp
│
├── /                Performance / Band Mode
│   ├── Sheet Viewer
│   ├── Chords
│   ├── Transpose
│   ├── Setlist
│   ├── Metronome
│   └── Live Band Sync
│
├── /editor          Score Editing Studio
│   ├── MusicXML editing
│   ├── SATB note editing
│   └── Version/save tools
│
└── /learn           Interactive Learning Studio
    ├── Learn chords
    ├── Piano accompaniment
    ├── Organ accompaniment
    ├── Melody practice
    ├── SATB practice
    ├── Rhythm practice
    ├── A/B Loop
    ├── Virtual keyboard
    ├── MIDI evaluation
    ├── Practice history
    └── Personalized difficulty
```

**Một bài MusicXML — ba trải nghiệm khác nhau.**

---

# 1. HIỆN TRẠNG SOURCE SHEETAPP2

## 1.1 Stack hiện tại

Theo README/CODE_MAP hiện tại:

```text
Frontend
├── Vanilla JavaScript IIFE Modules
├── OSMD
├── Tone.js
├── OsmdAudioPlayer
└── Tonal.js

Backend
├── PHP MVC
├── REST-like API Router
└── SQLite

Storage
├── SQLite
├── MusicXML files
├── JSON chord sets
├── JSON session files
└── JSON live room state
```

CODE_MAP ngày 07/09/2026 mô tả pipeline:

```text
Browser
  ↓
index.php
  ↓
EventBus / Store / ApiService
  ↓
Feature Modules
  ↓
api/index.php
  ↓
Controller
  ↓
Service
  ↓
SQLite / storage files
```

Đây là kiến trúc đủ nhẹ để tiếp tục phát triển `/learn` mà chưa cần chuyển framework.

---

## 1.2 Những module hiện tại có giá trị trực tiếp với `/learn`

### Có thể tái sử dụng mạnh

| Module | Mức tái sử dụng | Vai trò trong `/learn` |
|---|---:|---|
| `osmd-renderer.js` | 95% | Render sheet |
| `song-loader.js` | 80% | Load song/XML |
| `transpose-engine.js` | 95% | Transpose score/chord |
| `chord-canvas.js` | 60% | Nguồn chord set |
| `chord-canvas-xml.js` | 70% | Đọc harmony gốc |
| `audio-player.js` | 50% | SATB/listen mode + iOS audio unlock |
| `metronome.js` | 50% | UI/logic BPM, nhưng clock nên unify |
| `performance/musical-position.js` | 90% | Measure locator/navigation |
| `performance/arrangement-engine.js` | 85% | Sections / roadmap |
| `performance/count-in-engine.js` | 80% | Count-in |
| `core/EventBus.js` | 100% | Module communication |
| `core/Store.js` | 100% | State |
| `core/ApiService.js` | 100% | API abstraction |
| `sw.js` | 70% | Offline/cache foundation |

---

## 1.3 Module KHÔNG nên hiểu nhầm là đã đáp ứng `/learn`

### `instruments.js`

Module này hiện thiên về:

> bật/tắt các Part/Instrument hiển thị trong OSMD.

Nó **không phải Audio Instrument/Sound Engine**.

Do đó `/learn` vẫn cần:

```text
LearnSoundEngine
```

để quản lý:

- Piano sound;
- Organ sound;
- Pad;
- Bass;
- Drum;
- mixer;
- gain;
- effects;
- sampler lifecycle.

---

## 1.4 Chord set hiện tại — điểm mạnh và giới hạn

Custom chord hiện được lưu theo dạng:

```json
{
  "measureIdx": 12,
  "noteIdx": 3,
  "chord": "G/B"
}
```

và được map thành key:

```text
12_3 => G/B
```

### Đây rất tốt cho UI

Vì hợp âm có thể bám vào một note/staff entry cụ thể.

### Nhưng chưa đủ cho accompaniment

Audio engine không nên hỏi:

> "hợp âm gắn ở noteIdx bao nhiêu?"

Audio engine phải biết:

```text
Measure 12
Beat 1.0 → G
Beat 3.0 → D/F#
```

Do đó cần **normalize** chord data.

---

# 2. NGUYÊN TẮC KIẾN TRÚC QUAN TRỌNG NHẤT

## 2.1 Không biến `/learn` thành một app copy

### Sai

```text
/learn
├── tự load XML
├── tự transpose
├── tự parse chord
├── tự render OSMD
├── tự viết metronome
└── tự quản lý song
```

Kết quả:

- duplicate code;
- bug fix phải sửa 2–3 chỗ;
- transpose dễ lệch;
- chord source không đồng nhất;
- khó bảo trì.

### Đúng

```text
                         MUSIC DOMAIN CORE
                                │
           ┌────────────────────┼────────────────────┐
           │                    │                    │
       MusicXML            Chord Sets           Arrangement
           │                    │                    │
           └──────────────┬─────┴──────────────┬─────┘
                          │                    │
                     Shared Engines       Timeline Model
                          │                    │
             ┌────────────┼────────────┐       │
             │            │            │       │
             ▼            ▼            ▼       ▼
             /         /editor       /learn PracticeEngine
```

---

## 2.2 Single Source of Truth

### Score Source

MusicXML là nguồn chuẩn cho:

- notes;
- measures;
- key signature;
- time signature;
- tempo nếu có;
- lyrics;
- parts;
- harmony gốc.

### Chord Source

Chord Profile xác định:

```text
TLH / default
HD
Piano Beginner
Piano Advanced
Guitar
Custom...
```

### Learning metadata

Không sửa XML chỉ để lưu thông tin học.

Ví dụ:

```text
learning_arrangements
learning_patterns
practice_sessions
practice_measure_stats
```

được lưu riêng.

---

# 3. TẦM NHÌN CHO `/learn`

## 3.1 `/learn` không chỉ là audio player

Nó phải trả lời được 5 câu hỏi của người học:

1. **Tôi phải đánh nốt/hợp âm gì?**
2. **Đánh bằng tay nào/thế nào?**
3. **Đánh theo rhythm/kiểu đệm nào?**
4. **Tôi đánh có đúng không?**
5. **Tôi đang yếu đoạn nào?**

Nếu đáp ứng được 5 câu này, SheetApp chuyển từ “sheet reader” sang “learning platform”.

---

# 4. USER FLOW ĐỀ XUẤT

## 4.1 Trang `/learn`

```text
┌──────────────────────────────────────────────────────────────┐
│ SheetApp Learn                                               │
│ [Tìm bài...]                     [Học gần đây] [Tiến độ]     │
├──────────────────────────────────────────────────────────────┤
│ Bài: Thánh Ca ...                                            │
│ Tone: G   BPM: 76   Nhịp: 4/4                               │
│                                                              │
│ HỌC GÌ?                                                      │
│ [Piano] [Organ] [Hợp âm] [Melody] [SATB] [Rhythm]           │
│                                                              │
│ TRÌNH ĐỘ                                                     │
│ [Mới học] [Cơ bản] [Trung bình] [Nâng cao]                  │
│                                                              │
│ KIỂU                                                         │
│ [Block] [Ballad] [Worship] [Arpeggio] [Pop] ...             │
│                                                              │
│                 [ BẮT ĐẦU TẬP ]                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 4.2 Màn Practice

Desktop:

```text
┌──────────────────────────────────────────────────────────────┐
│ Song | G | 76 BPM | Piano | Worship | Basic                 │
├───────────────────────────────────────────────┬──────────────┤
│                                               │ HỢP ÂM       │
│              MUSIC SCORE                     │ G            │
│                                               │ G B D        │
│       [current measure highlighted]           │              │
│                                               │ Next: Em     │
│                                               │              │
├───────────────────────────────────────────────┴──────────────┤
│               VIRTUAL PIANO KEYBOARD                         │
│       highlighted notes + suggested fingering               │
├──────────────────────────────────────────────────────────────┤
│ ⏮ | ◀ | ▶ | ⏭ | Loop | 60% | BPM 76 | Mixer | MIDI        │
└──────────────────────────────────────────────────────────────┘
```

Mobile/iPhone:

```text
┌─────────────────────────┐
│ G • 76 • Piano          │
├─────────────────────────┤
│                         │
│       SCORE             │
│                         │
├─────────────────────────┤
│ G                       │
│ Notes: G B D            │
│ Next: Em                │
├─────────────────────────┤
│ Virtual Keyboard        │
├─────────────────────────┤
│ ◀  ▶  Loop  70%   ⚙    │
└─────────────────────────┘
```

---

# 5. CÁC LEARNING MODE

# 5.1 Mode A — LISTEN & FOLLOW

Mức độ ưu tiên: **P0**

Dùng nền audio SATB hiện tại.

Tính năng:

- Play/pause.
- Cursor chạy theo score.
- Tempo 50–120%.
- Start từ measure.
- Count-in.
- A/B loop.
- Bật/tắt metronome.
- Voice focus:
  - Soprano;
  - Alto;
  - Tenor;
  - Bass;
  - Full SATB.

### Giá trị

Đây là mode dễ làm nhất và cho `/learn` có giá trị ngay từ bản đầu.

---

# 5.2 Mode B — CHORD TRAINER

Mức độ ưu tiên: **P0**

Khi chord hiện tại là:

```text
G/B
```

Panel hiển thị:

```text
G/B

Chord tones:
G — B — D

Bass:
B

Root position:
G B D

1st inversion:
B D G

2nd inversion:
D G B
```

Nút:

- `Nghe hợp âm`;
- `Root position`;
- `Thế đảo gần nhất`;
- `Hiện bàn phím`;
- `Đánh lại`.

### Nên dùng Tonal.js

Tonal hiện đã có trong repo và phù hợp cho:

- note;
- interval;
- chord;
- scale;
- key;
- inversion logic.

Không nên tự viết parser nhạc lý từ đầu nếu Tonal đã giải quyết được.

---

# 5.3 Mode C — PIANO CHORD PRACTICE

Mức độ ưu tiên: **P0/P1**

### Level 1 — Beginner

Mỗi hợp âm đánh một lần/phách đầu:

```text
| G       | Em      | C       | D       |
| G B D   | E G B   | C E G   | D F# A  |
```

### Level 2 — Basic

```text
Left hand: root
Right hand: chord
```

Ví dụ G:

```text
LH: G2
RH: G3 B3 D4
```

### Level 3 — Intermediate

- bass + chord;
- nearest inversion;
- broken chord;
- 8th-note rhythm.

### Level 4 — Advanced

- voice leading;
- passing tone;
- slash chords;
- octave doubling;
- optional add2/add9;
- chord anticipation;
- sus resolution.

**Quan trọng:** level học là metadata, không sửa chord source gốc.

---

# 5.4 Mode D — PIANO ACCOMPANIMENT

Mức độ ưu tiên: **P1**

Đây là một trong những feature tạo khác biệt nhất.

## Style Library ban đầu

### Nhịp 4/4

- Block Chord.
- Bass + Chord.
- Broken Chord 8th.
- Ballad 4/4.
- Worship Basic.
- Worship Flow.
- Pop 4/4.
- Slow Rock.

### Nhịp 3/4

- Waltz Basic.
- Waltz Arpeggio.

### Nhịp 6/8

- Worship 6/8.
- Ballad 6/8.

### Sau này

- Gospel.
- Hymn.
- March.
- Swing.
- Bossa.
- Country.

Không nên làm 30 style ngay.

**6–10 style tốt quan trọng hơn 100 style kém.**

---

# 5.5 Mode E — ORGAN PRACTICE

Mức độ ưu tiên: **P1/P2**

Không nên cố mô phỏng workstation arranger organ đầy đủ ngay từ đầu.

Bản đầu có thể hỗ trợ:

```text
Right Hand:
- Melody
- Chord
- Melody + chord voicing

Left Hand:
- Root
- Chord stab

Pedal:
- Bass root
```

## Sound presets

- Church Organ.
- Drawbar-ish Organ.
- Warm Organ.
- Pad + Organ.
- Organ + Piano Layer.

## Style

Có thể dùng chung PatternEngine với Piano, chỉ đổi:

```text
instrument mapping
velocity
register
octave
articulation
```

---

# 5.6 Mode F — MELODY TRAINER

Mức độ ưu tiên: **P1**

Người học có thể:

- nghe melody;
- giảm tốc;
- loop 1–4 ô;
- ẩn tên nốt;
- hiện tên nốt;
- virtual keyboard highlight;
- MIDI keyboard kiểm tra melody.

Mode này dùng tốt cho:

- piano melody;
- organ lead;
- người học đọc nốt;
- trẻ em.

---

# 5.7 Mode G — SATB TRAINER

Mức độ ưu tiên: **P0/P1**

Repo đã có SATB playback.

Nâng cấp `/learn`:

- solo từng bè;
- full choir nhưng bè đang học to hơn;
- các bè khác nhỏ xuống;
- loop ô khó;
- 50%, 60%, 70%, 80%, 90%, 100%;
- tự tăng tempo;
- đánh dấu measure đã tập.

Đây là feature rất phù hợp cho đối tượng ca đoàn/ban hát hiện tại của SheetApp.

---

# 5.8 Mode H — RHYTHM TRAINER

Mức độ ưu tiên: **P2**

Tập:

- phách mạnh/yếu;
- clap/tap;
- rhythm pattern;
- subdivision;
- 4/4, 3/4, 6/8;
- nghe rồi tap lại.

Có thể dùng Pointer/Keyboard hoặc MIDI pad.

---

# 6. A/B LOOP — FEATURE BẮT BUỘC

Một ứng dụng học nhạc mà không có A/B loop sẽ rất hạn chế.

## Cách chọn

### Theo measure

```text
A = measure 12
B = measure 16
```

### Theo section

```text
Verse 1
Chorus
Bridge
```

### Từ UI

Người dùng click:

```text
[Loop đoạn này]
```

trên một section.

---

## Auto Practice Loop

Ví dụ:

```text
Start: 60 BPM
Repeat: 3 lần
Nếu hoàn thành → +5 BPM
Target: 80 BPM
```

Flow:

```text
60 BPM ×3
↓
65 BPM ×3
↓
70 BPM ×3
↓
75 BPM ×3
↓
80 BPM ×3
```

Đây là feature rất có giá trị cho học đàn thực tế.

---

# 7. CHORD TIMELINE — TRÁI TIM CỦA `/learn`

## 7.1 Vấn đề hiện tại

Chord custom đang lưu:

```text
measureIdx + noteIdx
```

Điều này là **visual coordinate**.

Practice engine cần **musical coordinate**:

```text
measure + beat + duration
```

---

## 7.2 Model chuẩn đề xuất

```js
ChordTimelineEvent = {
  id: "m12-b3",
  measure: 12,
  beat: 3.0,
  durationBeats: 2.0,
  symbol: "D/F#",
  source: "HD",
  originalSymbol: "D/F#",
  transposedSymbol: "E/G#"
}
```

---

## 7.3 `ChordTimelineNormalizer`

```text
MusicXML
   │
   ├─ Measures
   ├─ divisions
   ├─ time signature
   ├─ note duration
   └─ harmony
             \
              \
Chord Set JSON ---> ChordTimelineNormalizer
                         │
                         ▼
               Normalized Timeline
                         │
           ┌─────────────┼─────────────┐
           ▼             ▼             ▼
      PatternEngine  ChordPanel   MIDI Trainer
```

---

## 7.4 Mapping `noteIdx → beat`

Không nên dựa vào pixel.

Nên đọc musical timestamps từ:

1. MusicXML source;
2. OSMD source measure/staff entry timestamps nếu ổn định;
3. fallback XML parser.

Output phải deterministic.

### Acceptance test

Với bài:

```text
4/4
Measure 1:
Beat 1 = G
Beat 3 = D
```

Timeline luôn phải trả:

```json
[
  {"measure":1,"beat":1,"symbol":"G","durationBeats":2},
  {"measure":1,"beat":3,"symbol":"D","durationBeats":2}
]
```

bất kể:

- zoom;
- màn hình;
- SVG layout;
- hide bass clef;
- compact mode.

---

# 8. MUSIC TRANSPORT — CLOCK DUY NHẤT

## 8.1 Hiện tại có nhiều timing concept

Repo đã có:

- Metronome scheduler.
- CountIn Engine AudioContext.
- OsmdAudioPlayer playback clock.
- TransportClock cho Live Sync.

Nếu `/learn` thêm một timer nữa, hệ thống sẽ rất dễ drift.

---

## 8.2 Đề xuất

Tạo:

```text
LearnTransport
```

hoặc tốt hơn:

```text
MusicTransport
```

làm abstraction chung.

### Với `/learn` solo

Tone.js `Transport` là lựa chọn hợp lý vì repo đã load Tone.js và Tone hỗ trợ:

- BPM;
- time signatures;
- schedule;
- repeat;
- loop;
- pause/start/stop;
- sample-accurate scheduling.

### Mô hình

```text
                    MusicTransport
                         │
      ┌──────────────────┼───────────────────┐
      │                  │                   │
 Metronome          PatternEngine        CursorSync
      │                  │                   │
      └──────────────────┼───────────────────┘
                         │
                    same beat clock
```

---

## 8.3 Không dùng `setInterval` làm clock âm nhạc chính

`requestAnimationFrame` và `setInterval` phù hợp cho UI, không nên là nguồn timing âm thanh.

### Nguyên tắc

```text
Audio clock = truth
Visual = follow audio clock
```

Không phải:

```text
DOM timer = truth
Audio = follow DOM
```

---

# 9. PATTERN ENGINE

Đây là engine tạo kiểu đệm.

## 9.1 Pattern không chứa chord cụ thể

### Sai

```json
{
  "notes": ["G3", "B3", "D4"]
}
```

### Đúng

```json
{
  "lane": "piano-rh",
  "at": 0,
  "duration": 0.5,
  "voicing": "nearest",
  "degrees": [1,3,5]
}
```

Sau đó engine mới áp vào chord hiện tại.

---

## 9.2 Pattern schema đề xuất

```json
{
  "id": "piano-worship-4-4-basic-v1",
  "name": "Worship 4/4 Basic",
  "instrumentFamily": "piano",
  "meter": "4/4",
  "difficulty": "basic",
  "stepsPerBeat": 2,
  "swing": 0,
  "lanes": [
    {
      "id": "bass",
      "instrument": "bass",
      "events": [
        {"at":0,"duration":1,"pitch":"root","octave":2,"velocity":80},
        {"at":2,"duration":1,"pitch":"fifth","octave":2,"velocity":65}
      ]
    },
    {
      "id": "piano",
      "instrument": "piano",
      "events": [
        {"at":0,"duration":0.75,"voicing":"nearest","velocity":72},
        {"at":1.5,"duration":0.5,"voicing":"nearest","velocity":58},
        {"at":3,"duration":0.75,"voicing":"nearest","velocity":68}
      ]
    }
  ]
}
```

---

## 9.3 Pattern phải meter-aware

Không ép pattern 4/4 vào 6/8.

Pattern metadata phải có:

```text
meter
subdivision
compatibleTempoRange
feel
```

Ví dụ:

```json
{
  "meter": "6/8",
  "feel": "compound",
  "tempoMin": 45,
  "tempoMax": 100
}
```

---

# 10. VOICING ENGINE

Pattern quyết định **khi nào đánh**.

Voicing Engine quyết định **đánh nốt nào**.

---

## 10.1 Beginner voicing

```text
Root position
```

G:

```text
G3 B3 D4
```

---

## 10.2 Nearest inversion

Progression:

```text
G → Em → C → D
```

Không nên luôn:

```text
G3 B3 D4
E3 G3 B3
C3 E3 G3
D3 F#3 A3
```

Tay phải nhảy nhiều.

Có thể chọn:

```text
G3 B3 D4
G3 B3 E4
G3 C4 E4
F#3 A3 D4
```

mục tiêu:

> tối thiểu hóa tổng khoảng di chuyển voice.

---

## 10.3 Cost function đơn giản

```text
cost =
    movementCost
  + rangePenalty
  + crossingPenalty
  + duplicatePenalty
```

Chọn inversion có cost thấp nhất.

Không cần AI.

---

## 10.4 Range preset

### Piano RH Beginner

```text
C3 → C5
```

### Piano RH Full

```text
G2 → C6
```

### Organ RH

```text
C3 → C6
```

### Bass

```text
C1 → C3
```

Range nên configurable.

---

# 11. AUTO ACCOMPANIMENT PIPELINE

```text
Song
 │
 ├── MusicXML
 ├── BPM
 ├── Meter
 └── Chord Set
       │
       ▼
ChordTimelineNormalizer
       │
       ▼
ChordTimeline
       │
       ├─────────────► UI chord focus
       │
       ▼
PatternEngine
       │
       ▼
Symbolic Events
       │
       ▼
VoicingEngine
       │
       ▼
Playable MIDI-like Events
       │
       ▼
MusicTransport
       │
       ▼
LearnSoundEngine
       │
       ├─ Piano
       ├─ Organ
       ├─ Bass
       ├─ Pad
       └─ Drums
```

Đây là pipeline trung tâm nên được giữ rõ ràng.

---

# 12. SOUND ENGINE

## 12.1 Giai đoạn MVP

Dùng Tone.js synth/sampler nhẹ.

### Lợi ích

- đã có thư viện;
- ít dependency mới;
- chạy client-side;
- timing tốt;
- dễ làm mixer.

### MVP voice

- Piano basic.
- Soft Piano.
- Organ basic.
- Warm Pad.
- Electric Bass.
- Drum click/basic kit.

---

## 12.2 Giai đoạn chất lượng âm cao hơn

Có thể đánh giá `smplr`.

Nó hỗ trợ browser Web Audio với:

- Soundfont;
- sampled grand piano;
- electric piano;
- drum machine;
- SoundFont2 `.sf2`.

Tuy nhiên:

- phải kiểm tra license của từng bộ sample;
- không preload toàn bộ sample bank;
- cần lazy load.

---

## 12.3 Sound Pack Strategy

### Không làm

```text
App load
↓
Download toàn bộ 128 GM instruments
↓
50–300 MB
```

### Làm

```text
User chọn Piano
↓
Load Piano Pack
↓
cache
```

Sau đó chọn Organ:

```text
Load Organ Pack
↓
cache
```

---

## 12.4 Preset tiers

### Lite

Synth-based, gần như không có sample download.

### Standard

- Piano sampled.
- Organ sampled/synth.
- Bass.
- Drum.

### HQ

User tự chọn tải thêm.

Điều này đặc biệt phù hợp mobile.

---

# 13. MIXER

```text
MASTER
├── Piano    [Mute] [Vol]
├── Organ    [Mute] [Vol]
├── Bass     [Mute] [Vol]
├── Pad      [Mute] [Vol]
├── Drums    [Mute] [Vol]
├── Metronome[Mute] [Vol]
└── Melody   [Mute] [Vol]
```

### Presets

```text
Practice Piano
Piano + Bass
Full Band
No Drum
Melody Focus
```

Mixer state có thể lưu local trước.

---

# 14. VIRTUAL PIANO KEYBOARD

Mức độ ưu tiên: **P0/P1**.

## 14.1 Current chord

G:

```text
G B D
```

Highlight 3 phím.

---

## 14.2 Next chord preview

```text
Current: G
Next: Em
```

Có thể dùng:

- màu chính cho current;
- outline cho next.

---

## 14.3 Hands

```text
LH: G2
RH: G3 B3 D4
```

Hiển thị riêng 2 tay.

---

## 14.4 Fingering

Không nên ưu tiên ở MVP vì fingering đúng phụ thuộc context.

Sau này có thể:

```text
RH: 1 3 5
```

nhưng phải theo voicing/path chứ không hard-code mọi chord.

---

# 15. MIDI INPUT & AUTO EVALUATION

## 15.1 Đây là Phase 2, không phải blocker của MVP

Web MIDI rất hấp dẫn nhưng browser support chưa đồng đều.

Vì vậy app phải chạy đầy đủ khi **không có MIDI**.

---

## 15.2 MIDI flow

```text
MIDI Keyboard
     │
     ▼
navigator.requestMIDIAccess()
     │
     ▼
MidiInputEngine
     │
     ├── noteOn
     ├── noteOff
     ├── velocity
     └── timestamp
            │
            ▼
       PracticeJudge
            │
       ┌────┼────┐
       ▼    ▼    ▼
     Pitch Timing Chord
```

---

## 15.3 Chord Match

Expected:

```text
G = {G, B, D}
```

User plays:

```text
B3 D4 G4
```

### Beginner mode

✅ Correct — inversion accepted.

### Strict mode

Nếu expected root position:

⚠ đúng chord nhưng sai thế đảo.

---

## 15.4 Timing score

```text
delta = playedTime - expectedTime
```

Ví dụ:

```text
|delta| <= 50 ms  → Excellent
<= 100 ms         → Good
<= 180 ms         → Acceptable
> 180 ms          → Early/Late
```

Các threshold cần configurable và không nên quá khắt khe cho Beginner.

---

## 15.5 Hold validation

Không chỉ note-on.

Có thể kiểm tra:

- chord đủ nốt;
- giữ đủ duration tối thiểu;
- release quá sớm;
- extra note.

---

# 16. PRACTICE JUDGE

Không nên chỉ cho điểm tổng.

Phải biết **người học yếu ở đâu**.

## Metrics

```text
Pitch Accuracy
Chord Completeness
Timing Accuracy
Tempo Stability
Wrong Extra Notes
Missed Notes
Repeated Attempts
Best BPM
```

---

## Theo measure

```text
Measure 1  95%
Measure 2  91%
Measure 3  62%  ← weak
Measure 4  68%  ← weak
Measure 5  94%
```

App gợi ý:

```text
Bạn nên tập lại ô 3–4 ở 65 BPM.
```

Đây là personalization bằng thuật toán đơn giản, chưa cần AI.

---

# 17. LEARNING DIFFICULTY

Mỗi mode có 4 level:

```text
Beginner
Basic
Intermediate
Advanced
```

Không nên hiểu level chỉ là BPM.

Ví dụ Piano:

| Level | Voicing | Rhythm | Bass | Extra |
|---|---|---|---|---|
| Beginner | Root | 1 chord/bar | Root | none |
| Basic | Root/close | 2–4 attacks/bar | Root | none |
| Intermediate | Nearest inversion | Pattern | Root/5th | passing |
| Advanced | Voice leading | Full style | walking/approach | extensions |

---

# 18. CHORD SIMPLIFICATION ENGINE

Một feature rất đáng có.

Ví dụ source:

```text
Gmaj7/B
Cadd9
Dsus4/F#
Em7
```

Beginner mode có thể hiển thị:

```text
G
C
D
Em
```

Nhưng cần cảnh báo:

> "Hợp âm đơn giản hóa để luyện tập".

Không được sửa chord gốc.

---

# 19. CHORD FUNCTION / NHẠC LÝ

Sau MVP có thể thêm:

Tone G:

```text
G  → I
Am → ii
Bm → iii
C  → IV
D  → V
Em → vi
F#dim → vii°
```

Panel:

```text
D major
Function: V
Tendency: resolves to G (I)
```

Tonal.js hỗ trợ các khái niệm key/progression đủ tốt để làm nền.

---

# 20. SONG SECTION + LEARNING

Repo hiện đã có:

```text
Intro
Verse
Chorus
Bridge
Outro
```

với `start_measure` và `end_measure`.

Đây là tài sản rất giá trị.

## `/learn` dùng như sau

```text
[Tập Intro]
[Tập Verse 1]
[Tập Chorus]
[Tập Bridge]
[Tập toàn bài]
```

### Progress theo section

```text
Intro       ██████████ 100%
Verse       ███████░░░  72%
Chorus      █████░░░░░  54%
Bridge      ██░░░░░░░░  21%
```

---

# 21. LEARNING ARRANGEMENT

Performance Arrangement hiện tại và Learning Arrangement không nên nhập làm một.

## Performance Arrangement

```text
Intro → Verse → Chorus → Chorus → Bridge → Chorus → Outro
```

## Learning Arrangement

```text
Instrument: Piano
Style: Worship Basic
Level: Basic
ChordSet: HD
Loop: Chorus
Start BPM: 60
Target BPM: 80
```

Có thể reference Performance Arrangement nhưng metadata riêng.

---

# 22. DATA MODEL ĐỀ XUẤT

## 22.1 `learning_patterns`

```sql
id
slug
name
instrument_family
meter
difficulty
category
pattern_json
version
is_active
created_at
updated_at
```

Pattern system có thể bắt đầu bằng JSON file để giảm migration, nhưng DB sẽ tốt hơn khi cần editor/admin.

---

## 22.2 `learning_arrangements`

```sql
id
song_id
name
chord_set_name
instrument_mode
pattern_id
difficulty
bpm_start
bpm_target
settings_json
created_by
is_public
created_at
updated_at
```

---

## 22.3 `practice_sessions`

```sql
id
user_id
song_id
learning_arrangement_id
mode
started_at
ended_at
duration_seconds
start_bpm
max_bpm
accuracy_pitch
accuracy_timing
accuracy_total
settings_json
created_at
```

---

## 22.4 `practice_measure_stats`

```sql
id
practice_session_id
measure_no
attempts
correct_notes
wrong_notes
missed_notes
accuracy
timing_score
best_bpm
```

---

## 22.5 `user_song_progress`

Cache summary để dashboard nhanh:

```sql
user_id
song_id
mode
last_measure
best_bpm
mastery_percent
total_seconds
last_practiced_at
```

Unique:

```text
(user_id, song_id, mode)
```

---

# 23. KHÔNG DÙNG `SessionService` HIỆN TẠI CHO LEARNING PROGRESS

`SessionService` hiện tạo file từ `songId`.

Điều này không phù hợp với:

```text
User A + Song X
User B + Song X
```

vì `/learn` cần dữ liệu riêng của từng user.

## Đề xuất

Giữ SessionService cũ để không phá compatibility.

Tạo riêng:

```text
LearningProgressService
PracticeSessionService
```

---

# 24. API ĐỀ XUẤT

```text
GET  /api/?route=learning&action=patterns
GET  /api/?route=learning&action=arrangements&song_id=...
POST /api/?route=learning&action=save_arrangement

POST /api/?route=practice&action=start
POST /api/?route=practice&action=checkpoint
POST /api/?route=practice&action=finish
GET  /api/?route=practice&action=progress&song_id=...
GET  /api/?route=practice&action=history&song_id=...
```

---

## 24.1 Không POST mỗi MIDI note

### Sai

```text
note on → HTTP
note off → HTTP
note on → HTTP
...
```

Một người có thể sinh hàng nghìn request/buổi tập.

### Đúng

Browser giữ event raw trong memory/local store.

Mỗi checkpoint:

```json
{
  "sessionId": 123,
  "duration": 28,
  "measures": [
    {"m":3,"attempts":2,"accuracy":0.72},
    {"m":4,"attempts":2,"accuracy":0.81}
  ]
}
```

Server nhận dữ liệu tổng hợp.

---

# 25. CLIENT-SIDE FIRST

Đây là nguyên tắc quyết định server có nhẹ hay không.

## Browser xử lý

```text
MusicXML parsing
Chord normalization
Pattern generation
Voicing
Audio rendering
MIDI input
Practice scoring
Cursor animation
Looping
Tempo progression
```

## Server xử lý

```text
Authentication
Song metadata
Chord profiles
Learning arrangements
Progress persistence
Permissions
Admin management
```

---

# 26. PHÂN TÍCH TẢI SERVER

## 26.1 `/learn` Solo + Tone synth

### Server CPU

**Rất thấp.**

Server chỉ trả static assets và API data.

### Browser CPU

Tăng vì:

- OSMD;
- Tone/WebAudio;
- playback scheduling;
- keyboard visualization.

Nhưng đây là CPU thiết bị user, không phải CPU server.

---

## 26.2 `/learn` + sampled Piano

### Server CPU

Vẫn thấp nếu chỉ serve static files.

### Bandwidth

Tăng khi user lần đầu tải sample.

### Giải pháp

- CDN/static cache;
- HTTP cache-control;
- Service Worker;
- lazy load;
- load only needed notes/samples;
- không preload full GM bank.

---

## 26.3 `/learn` + MIDI evaluation

### Server

Gần như không tăng nếu evaluation ở client.

### Client

Xử lý vài chục/sự kiện MIDI mỗi giây rất nhẹ so với render/audio.

---

## 26.4 `/learn` + Practice Progress

Tải server thấp nếu:

- checkpoint theo batch;
- finish session mới ghi chi tiết;
- không gửi raw event liên tục.

---

## 26.5 Live Band / Live Learn

Đây mới là hotspot.

`PollingTransport` hiện mặc định:

```text
350 ms / poll
```

Tương đương tối đa lý thuyết khoảng:

```text
2.86 HTTP poll / giây / client
```

Nếu đều active:

| Live clients | Poll requests/s xấp xỉ |
|---:|---:|
| 10 | 29 |
| 25 | 71 |
| 50 | 143 |
| 100 | 286 |
| 300 | 857 |

Đây chưa tính:

- host updates;
- static assets;
- other API calls.

### Kết luận

`/learn` **không nên bật LiveSession mặc định**.

Solo learn:

```text
LiveTransport = OFF
```

Nếu sau này có lớp học realtime đông người:

```text
PollingTransport
       ↓
SSE / WebSocket
```

Code hiện tại đã tạo abstraction `LiveTransport`, nên việc thay transport sau này là hướng rất đúng.

---

# 27. SQLITE CÓ ĐỦ KHÔNG?

## Hiện tại

DB wrapper hiện chỉ cấu hình:

```sql
PRAGMA foreign_keys = ON;
```

chưa thấy WAL/busy_timeout tại lớp DB hiện hành.

---

## Giai đoạn MVP

SQLite vẫn đủ nếu:

- số user nhỏ/vừa;
- phần lớn là read;
- progress ghi batch;
- live state không ghi SQLite;
- không lưu từng MIDI event.

### Nên bổ sung

```sql
PRAGMA journal_mode=WAL;
PRAGMA busy_timeout=5000;
```

sau khi test kỹ môi trường server/backup.

WAL giúp read và write concurrency tốt hơn, nhưng SQLite vẫn có giới hạn writer concurrency.

---

## Khi nào nên lên MySQL?

Nên cân nhắc khi có một hoặc nhiều dấu hiệu:

- hàng trăm concurrent authenticated users;
- progress/session write nhiều;
- dashboard analytics lớn;
- teacher/classroom features;
- multi-tenant;
- nhiều web workers/PHP workers cùng ghi;
- thường xuyên `database is locked`.

Vì hạ tầng production của bạn đã quen MySQL, đây là migration hợp lý khi scale.

**Không cần đổi DB chỉ để bắt đầu `/learn`.**

---

# 28. SERVER SPEC ĐỊNH HƯỚNG

Đây là **ước tính kiến trúc**, không thay thế load test.

## 28.1 Quy mô nhỏ — 1 đến ~30 concurrent learners

Nếu `/learn` solo, client-side:

```text
2 vCPU
2–4 GB RAM
SSD
PHP OPcache
Apache/Nginx
SQLite WAL hoặc MySQL
```

thường đã rất dư cho phần backend.

---

## 28.2 ~30–100 concurrent learners

Vẫn có thể nhẹ nếu:

- static cache tốt;
- samples qua CDN/static;
- no live polling;
- progress batched.

Ưu tiên đo:

```text
PHP request/s
p95 latency
CPU
RAM
network egress
SQLite lock errors
```

trước khi nâng VPS.

---

## 28.3 100+ live-connected clients

Nếu cùng bật `PollingTransport(350)`:

**đây là lúc cần thay realtime architecture trước khi chỉ nâng CPU.**

Nâng server mà giữ polling dày chỉ trì hoãn vấn đề.

---

# 29. BANDWIDTH — THỨ CẦN QUẢN LÝ HƠN CPU

## App core hiện đã cache vendor

Service Worker hiện pre-cache:

- OSMD;
- Tone.js;
- OsmdAudioPlayer;
- Tonal.js.

Đây là nền tốt.

---

## Sample pack mới

Cần thêm cache riêng:

```text
CACHE_LEARN_SOUNDS
CACHE_LEARN_PATTERNS
```

Không nên gom sample audio chung vào cache MusicXML.

---

## Cache Strategy

```text
Vendor JS          Cache First
MusicXML           Stale While Revalidate
Pattern JSON        Stale While Revalidate
Sound Samples       Cache First + versioned
API progress        Network only / queued offline
HTML                Network First
```

---

# 30. OFFLINE LEARNING

Một feature rất phù hợp PWA.

## Người dùng chọn

```text
[Tải bài này để tập offline]
```

App cache:

- MusicXML;
- chord set;
- arrangement;
- selected style;
- selected sound pack subset.

Không cache:

- toàn bộ kho bài;
- toàn bộ instruments.

---

## Offline Progress

```text
IndexedDB
↓
Pending practice summaries
↓
Network online
↓
Sync to API
```

Không nên dùng localStorage cho lượng dữ liệu session lớn.

---

# 31. iPHONE / iPAD

Repo hiện đã có nhiều xử lý Web Audio cho iOS.

Nên tái sử dụng kinh nghiệm này.

## Audio start

Play phải phát sinh từ user gesture.

Màn `/learn` nên có nút rõ ràng:

```text
[BẮT ĐẦU TẬP]
```

và trong handler đó:

- unlock AudioContext;
- init sounds;
- sau đó mới async load nếu cần.

---

## Web MIDI

Web MIDI không có support đồng đều trên mọi browser/device.

Do đó:

```text
MIDI available?
├─ Yes → Enable MIDI Practice
└─ No  → Virtual Keyboard / Listen mode
```

Không để UI crash hoặc khóa feature core khi không có MIDI.

---

# 32. UI STATE MACHINE

```text
IDLE
 ↓
SONG_SELECTED
 ↓
PREPARING
 ↓
READY
 ├── PLAYING
 ├── PAUSED
 ├── LOOPING
 └── EVALUATING
 ↓
COMPLETED
```

Audio/sample chưa load:

```text
PREPARING_SOUND
```

MIDI permission:

```text
MIDI_DISABLED
MIDI_REQUESTING
MIDI_READY
MIDI_UNAVAILABLE
```

State rõ giúp tránh code boolean rối.

---

# 33. STORE ĐỀ XUẤT CHO `/learn`

```js
Store.learn = {
  songId: null,
  mode: "piano",
  difficulty: "basic",
  chordSet: "HD",
  patternId: null,
  instrumentPreset: "piano-lite",
  bpm: 76,
  speed: 1,
  loop: {
    enabled: false,
    startMeasure: null,
    endMeasure: null
  },
  current: {
    measure: 1,
    beat: 1,
    chord: null
  },
  midi: {
    enabled: false,
    inputId: null
  }
}
```

Không nhất thiết phải đổi Store implementation; chỉ cần namespace state rõ.

---

# 34. EVENT CONTRACT ĐỀ XUẤT

```text
learn:ready
learn:play
learn:pause
learn:stop
learn:position_changed
learn:chord_changed
learn:pattern_changed
learn:mode_changed
learn:loop_changed
learn:midi_note_on
learn:midi_note_off
learn:evaluation
learn:session_started
learn:session_finished
```

Payload phải document rõ.

---

# 35. CẤU TRÚC FILE ĐỀ XUẤT

Không dồn tất cả vào `learn.js` 3000 dòng.

```text
learn/
├── index.php
├── learn.css
└── learn.js                  # bootstrap only

assets/js/learn/
├── learn-app.js
├── learn-store.js
├── learn-ui.js
│
├── timeline/
│   ├── chord-timeline-normalizer.js
│   ├── score-timeline.js
│   └── timeline-validator.js
│
├── transport/
│   ├── music-transport.js
│   ├── loop-controller.js
│   └── cursor-sync.js
│
├── harmony/
│   ├── chord-analyzer.js
│   ├── chord-simplifier.js
│   ├── voicing-engine.js
│   └── voice-leading.js
│
├── accompaniment/
│   ├── pattern-engine.js
│   ├── pattern-library.js
│   ├── piano-accompaniment.js
│   ├── organ-accompaniment.js
│   ├── bass-accompaniment.js
│   └── drum-accompaniment.js
│
├── audio/
│   ├── learn-sound-engine.js
│   ├── sound-pack-loader.js
│   ├── learn-mixer.js
│   └── ios-audio-unlock.js
│
├── midi/
│   ├── midi-input-engine.js
│   ├── note-state.js
│   └── midi-device-ui.js
│
├── practice/
│   ├── practice-engine.js
│   ├── practice-judge.js
│   ├── tempo-ladder.js
│   ├── practice-recorder.js
│   └── weak-measure-detector.js
│
└── ui/
    ├── virtual-keyboard.js
    ├── chord-card.js
    ├── practice-controls.js
    ├── mixer-panel.js
    ├── progress-panel.js
    └── lesson-selector.js
```

---

# 36. BACKEND FILE ĐỀ XUẤT

```text
api/controllers/
├── LearningController.php
└── PracticeController.php

api/services/
├── LearningService.php
└── PracticeService.php
```

Nếu repository convention yêu cầu mỗi domain nhỏ hơn:

```text
PatternService.php
LearningArrangementService.php
PracticeProgressService.php
```

Nhưng không nên over-engineer từ ngày đầu.

---

# 37. NHỮNG FILE HIỆN TẠI NÊN REFACTOR TRƯỚC/SONG SONG

## 37.1 `chord-canvas.js`

File hiện khá lớn và chứa cả:

- state;
- mapping;
- UI bridge;
- persistence;
- transpose behavior.

Để `/learn` dùng chord sạch hơn, nên tách một read-only domain service:

```text
ChordRepository / ChordProfileProvider
```

API:

```js
getChordSet(songId, setName)
getActiveChordSet()
normalizeForTranspose(...)
```

`/learn` không nên gọi private internals của ChordCanvas.

---

## 37.2 Audio unlock

Logic iOS hiện nằm trong `audio-player.js`.

Nên extract:

```text
AudioContextGate
```

để SATB và `/learn` cùng dùng.

---

## 37.3 Transport

Nên tránh để:

- Metronome;
- CountIn;
- Learn accompaniment;
- cursor;

mỗi cái chạy clock riêng.

Có thể refactor từ từ, nhưng `/learn` nên dùng một Transport ngay từ đầu.

---

# 38. FEATURE PRIORITY

## P0 — MVP “DÙNG ĐƯỢC THỰC SỰ”

1. `/learn` shell.
2. Song selection.
3. Reuse OSMD rendering.
4. Load chord profile.
5. ChordTimelineNormalizer.
6. Current chord panel.
7. Virtual keyboard.
8. Hear chord.
9. Basic Piano block chord.
10. BPM/speed.
11. Metronome integration.
12. Count-in.
13. Loop by measure.
14. Loop by section.
15. Piano Pattern: Block / Bass+Chord / Arpeggio.
16. Save last local settings.
17. Mobile responsive.
18. iOS audio unlock.

### MVP không cần

- MIDI scoring;
- teacher mode;
- AI;
- 30 sounds;
- classroom realtime;
- advanced gamification.

---

# 39. P1 — PHIÊN BẢN HỌC NHẠC MẠNH

1. Worship/Ballad/Pop/6/8/Waltz patterns.
2. Voicing Engine.
3. nearest inversion.
4. Piano 4 levels.
5. Organ mode.
6. Mixer.
7. Better sampled piano.
8. Practice Sessions.
9. Progress per song/section.
10. Tempo ladder.
11. Weak measure detection.
12. Offline selected songs.

---

# 40. P2 — MIDI & EVALUATION

1. MIDI device selector.
2. Note-on/off tracking.
3. Chord matching.
4. Melody matching.
5. Timing score.
6. Extra note detection.
7. Hold duration.
8. Wait Mode.
9. Practice heatmap.
10. Personalized next exercise.

---

# 41. P3 — ADVANCED LEARNING PLATFORM

1. Teacher account.
2. Assign lesson.
3. Class/group.
4. Student progress dashboard.
5. Teacher-created accompaniment.
6. Custom pattern editor.
7. Fingering annotations.
8. Roman numeral/function lessons.
9. Ear training.
10. Sight reading mode.
11. Shared live lesson.
12. AI suggestions — only after clean deterministic core.

---

# 42. WAIT MODE — FEATURE RẤT ĐÁNG LÀM

Mode giống:

> App dừng lại và chỉ đi tiếp khi user đánh đúng.

```text
Expected chord: C
↓
Wait
↓
User presses C E G
↓
Correct
↓
Next chord
```

### Các lựa chọn

```text
Wait for:
○ Correct chord
○ Correct melody note
○ Correct full measure
```

Feature này biến trải nghiệm từ playback sang interactive tutor.

---

# 43. PRACTICE MODES ĐỀ XUẤT TRÊN UI

Không hiển thị 20 option cùng lúc.

Trang đầu chỉ cần:

```text
🎹 Piano
🎹 Organ
🎼 Hợp âm
🎤 SATB
🎵 Giai điệu
```

Sau khi chọn mới hiện options liên quan.

---

# 44. PIANO UI

```text
Piano
│
├── Cấp độ
│   ├── Mới học
│   ├── Cơ bản
│   ├── Trung bình
│   └── Nâng cao
│
├── Kiểu đệm
│   ├── Block
│   ├── Bass + Chord
│   ├── Arpeggio
│   ├── Worship
│   └── Ballad
│
├── Tiếng
│   ├── Piano Lite
│   ├── Grand Piano
│   └── Electric Piano
│
└── Practice
    ├── Listen
    ├── Play Along
    └── MIDI Check
```

---

# 45. ORGAN UI

```text
Organ
│
├── Right Hand
│   ├── Melody
│   ├── Chord
│   └── Melody + chord
│
├── Left Hand
│   ├── Root
│   └── Chord
│
├── Pedal Bass
│   └── On/Off
│
├── Style
│   ├── Hymn
│   ├── Worship
│   ├── Ballad
│   └── 6/8
│
└── Voice
    ├── Church Organ
    ├── Warm Organ
    └── Organ + Pad
```

---

# 46. CHORD DISPLAY MODES

Người dùng có thể chọn:

```text
Sheet đầy đủ
Sheet + chord nổi bật
Melody + chord
Lyric + chord
Chord chart only
```

Repo đã có lyric extraction và compact display; nên tái sử dụng thay vì tạo renderer text mới từ đầu nếu có thể.

---

# 47. SMART FOLLOW

Khi play:

- current measure highlight;
- current chord highlight;
- next chord preview;
- virtual keyboard update;
- auto scroll theo measure.

### Không scroll liên tục theo pixel

Nên scroll theo musical position/measure để ổn định với mobile và zoom.

Repo đã có `MusicalPosition`, đây là hướng đúng.

---

# 48. CHORD TRANSPOSE

Mọi layer phải dùng cùng transpose state.

```text
Original chord: G
Transpose +2
Displayed: A
Pattern plays: A
Keyboard highlights: A C# E
MIDI expected: A C# E
```

Không được để:

```text
Sheet = A
Sound = G
```

### Luật

```text
one transpose source
```

Dùng Store/current transpose chung.

---

# 49. SLASH CHORD

Ví dụ:

```text
G/B
```

### Piano Beginner

RH:

```text
G B D
```

LH:

```text
B
```

### Bass lane

Phải ưu tiên slash bass.

Không được mặc định root G.

---

# 50. CHORD EXTENSIONS

Cần support dần:

```text
maj7
m7
7
sus2
sus4
add9
dim
aug
6
9
m7b5
slash chords
```

Tonal xử lý được nhiều chord symbol, nhưng cần test với naming convention của kho SheetApp.

---

# 51. CHORD SANITIZATION

Vì chord đến từ nhiều nguồn OMR/manual, cần normalize:

```text
Gmin → Gm
G-   → Gm
Gmaj → G
Bb   → Bb
A#   → A# / normalized per key preference
```

Tuy nhiên **không đổi display source âm thầm**.

Có hai field:

```text
rawSymbol
normalizedSymbol
```

---

# 52. TEMPO

Phân biệt:

```text
Song BPM
Practice BPM
Playback Speed
```

Ví dụ source 100 BPM:

```text
Practice BPM = 70
```

Không nhất thiết ghi ngược vào song metadata.

---

# 53. TEMPO LADDER

```json
{
  "startBpm": 60,
  "targetBpm": 90,
  "step": 5,
  "successRepeats": 3
}
```

Nếu MIDI chưa có, user có thể bấm:

```text
[Đã đánh ổn]
```

để tăng BPM.

MIDI phase sau tự đánh giá.

---

# 54. PRACTICE DASHBOARD

Không cần làm ngay nhưng data model nên sẵn sàng.

```text
Tuần này
3h 42m luyện tập

Bài đang học
1. Bài A — 78%
2. Bài B — 54%
3. Bài C — 31%

Đoạn cần luyện
Bài A — Bridge m.24–28
```

---

# 55. GAMIFICATION — DÙNG VỪA PHẢI

Có thể có:

- streak;
- personal best BPM;
- mastered section;
- practice minutes.

Không nên biến ứng dụng thánh ca/học nhạc thành game quá nhiều badge gây nhiễu.

Trọng tâm vẫn là:

```text
Tập đúng → tập đều → tăng tốc → chơi được bài
```

---

# 56. PATTERN AUTHORING

Giai đoạn đầu pattern là static JSON/version-controlled.

Sau ổn định mới làm:

```text
/pattern-editor
```

hoặc admin modal.

### Lợi ích static JSON ban đầu

- dễ review Git;
- không cần UI phức tạp;
- dễ test;
- rollback đơn giản.

---

# 57. PATTERN UNIT TEST

Ví dụ pattern 4/4 phải bảo đảm:

```text
0 <= event.at < 4 beats
```

6/8 compound có normalized beat model rõ.

Test:

- no negative time;
- no NaN;
- no note outside safe range;
- supported meter;
- no dangling sample;
- deterministic output.

---

# 58. CHORD TIMELINE TEST

Bắt buộc xây fixture MusicXML.

Fixtures:

```text
4/4 one chord/bar
4/4 two chords/bar
4/4 four chords/bar
3/4
6/8
pickup measure
repeat
slash chord
key change
transpose
rest-only measure
SATB score
```

Đây là vùng dễ bug nhất của `/learn`.

---

# 59. REPEATS & ROADMAP

MusicXML có thể có:

- repeat barline;
- first/second ending;
- DC/DS/Coda;
- explicit arrangement section.

MVP có thể đơn giản:

> luyện theo linear measures.

Nhưng architecture nên tách:

```text
ScoreTimeline
PerformanceRoadmap
```

để sau này playback đúng repeat.

---

# 60. AUDIO PERFORMANCE

## Tránh tạo node liên tục không cleanup

Mỗi voice/instrument cần lifecycle:

```text
create
load
connect
play
stop
dispose
```

Khi đổi song/style:

- cancel old scheduled events;
- release notes;
- dispose unnecessary instruments;
- keep reusable sample buffers cached.

---

# 61. MOBILE PERFORMANCE

OSMD + audio + big SVG có thể làm thiết bị cũ lag.

### Tối ưu

- không rerender OSMD mỗi beat;
- current chord highlight bằng class/overlay;
- cursor update throttle/RAF;
- sample lazy load;
- disable expensive visual animations trên low-end;
- không scan toàn DOM mỗi tick;
- cache measure→DOM map.

---

# 62. `ChordCanvas` KHÔNG NÊN REBUILD MỖI BEAT

ChordCanvas hiện có logic scan/map SVG để dựng overlay.

Trong `/learn`, playback không nên gọi `_build()` liên tục.

Thay vào đó:

```text
timeline event
↓
change current chord state
↓
update one small UI component
```

---

# 63. PWA CACHE VERSIONING

Sound packs cần version:

```text
piano-lite-v1
piano-grand-v2
organ-church-v1
```

Khi update preset:

- cache key đổi;
- xóa old pack có kiểm soát.

Không dùng một cache vĩnh viễn không version.

---

# 64. SECURITY

`/learn` có thêm authenticated progress write, nên cần:

- auth check server-side;
- ownership check;
- validate song_id;
- validate pattern_id;
- limit JSON payload size;
- rate limit write endpoints;
- sanitize text metadata;
- CSRF strategy phù hợp với auth model hiện tại;
- review CORS nếu API dùng session/cookie.

Client không được quyết định `user_id` tùy ý.

Server lấy user từ auth session/token.

---

# 65. PRIVACY

Practice analytics không cần lưu raw MIDI vô hạn.

Default nên lưu:

```text
summary
measure statistics
best BPM
accuracy
practice duration
```

Raw MIDI event chỉ lưu khi có mục đích rõ ràng/debug và có retention.

---

# 66. OBSERVABILITY

Để biết có tốn server thật không, thêm metrics.

## Backend

```text
request count
p50/p95 API latency
5xx rate
DB lock count
DB write duration
live poll requests/s
```

## Frontend

```text
score load time
OSMD render time
sound pack load time
audio underruns/errors
MIDI availability
practice engine errors
```

Không nâng VPS chỉ dựa trên cảm giác.

---

# 67. LOAD TEST SCENARIOS

## Scenario A

50 users solo learn:

```text
load song
play locally
checkpoint every session phase
```

Mục tiêu:

- API p95 < 500 ms trên môi trường production mục tiêu;
- no DB lock errors;
- server CPU ổn định.

---

## Scenario B

100 users load different songs.

Tập trung:

- static file throughput;
- cache hit;
- XML delivery.

---

## Scenario C

100 Live users.

Đây là test riêng để quyết định:

```text
Polling vs SSE/WebSocket
```

Không dùng kết quả Solo Learn để suy ra Live capacity.

---

# 68. REALTIME ROADMAP

Code hiện đã có `LiveTransport` abstraction và comment hướng tới SSE/WebSocket.

Đây là điểm rất tốt.

Khi scale:

```text
LiveTransport
├── PollingTransport      current
├── SSETransport          option
└── WebSocketTransport    future
```

`/learn` không cần phụ thuộc cụ thể transport nào.

---

# 69. AI — NÊN THÊM KHI NÀO?

Không nên bắt đầu `/learn` bằng AI.

Các việc sau deterministic tốt hơn AI:

- chord parsing;
- inversions;
- transpose;
- pattern generation;
- MIDI correctness;
- timing;
- weak measure;
- tempo ladder.

AI sau này có thể:

- giải thích tại sao dùng chord;
- gợi ý bài học bằng ngôn ngữ tự nhiên;
- tạo bài tập từ performance history;
- suggest style;
- tạo teacher notes.

Nhưng AI không nên là timing/audio core.

---

# 70. OMR KHÔNG NÊN NẰM TRONG RUNTIME `/learn`

OMR/PDF→MusicXML là ingestion pipeline.

```text
PDF/Image
↓
OMR
↓
Review/Edit
↓
MusicXML canonical
↓
/learn
```

Khi user học, không chạy OMR lại.

Vì vậy OMR dù nặng cũng không làm every-practice server cost tăng nếu tách đúng.

---

# 71. KIẾN TRÚC SERVER TỐI ƯU

```text
                ┌────────────────────┐
                │   Browser / PWA    │
                │ OSMD + Tone + MIDI │
                └─────────┬──────────┘
                          │
                   small REST API
                          │
                ┌─────────▼──────────┐
                │ PHP Application    │
                │ Auth/API/Metadata  │
                └─────────┬──────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
      SQLite/MySQL     MusicXML       Static Samples
                          │               │
                          │          CDN/cache optional
                          │               │
                          └───────────────┘
```

---

# 72. KHÔNG RENDER BACKING AUDIO TRÊN SERVER

### Không nên

```text
User selects Worship
↓
PHP generates MP3
↓
server CPU render
↓
download
```

### Nên

```text
User selects Worship
↓
Pattern JSON
↓
Browser schedules notes
↓
Web Audio plays locally
```

Kết quả:

- transpose tức thì;
- tempo tức thì;
- loop tức thì;
- mixer tức thì;
- server nhẹ.

---

# 73. SOURCE REUSE MATRIX

| Nhu cầu `/learn` | Source hiện tại | Hành động |
|---|---|---|
| Load song | `song-loader.js` | Reuse/extract |
| Render score | `osmd-renderer.js` | Reuse |
| Transpose | `transpose-engine.js` | Reuse |
| Chord sets | `chord-canvas.js` + API | Extract read layer |
| Chord theory | Tonal.js | Reuse |
| SATB | `audio-player.js` | Reuse/refactor |
| BPM UI | `metronome.js` | Reuse UI, unify clock |
| Count-in | `count-in-engine.js` | Reuse/refactor |
| Measure navigation | `musical-position.js` | Reuse |
| Sections | `arrangement-engine.js` | Reuse |
| Live | `LiveTransport` | Keep optional/off |
| Audio style | none | NEW |
| Voicing | none | NEW |
| Chord timeline | none | NEW |
| MIDI learning | none/footpedal only | NEW |
| Practice judge | none | NEW |
| Progress analytics | insufficient | NEW |
| Sound pack | none | NEW |
| Virtual piano | none | NEW |

---

# 74. MVP TECHNICAL SEQUENCE

Không code 20 feature song song.

## Stage 0 — Architecture contract

1. Chốt shared music interfaces.
2. Chốt Timeline model.
3. Chốt `/learn` state/events.
4. Tạo test fixtures.

---

## Stage 1 — `/learn` shell

1. `/learn/index.php`.
2. Song picker.
3. OSMD viewer.
4. load song.
5. responsive layout.

**STOP và test.**

---

## Stage 2 — Chord timeline

1. Chord source adapter.
2. Timeline normalizer.
3. current chord panel.
4. next chord.
5. unit tests.

**Không làm accompaniment trước khi bước này ổn.**

---

## Stage 3 — Transport

1. Tone Transport abstraction.
2. BPM.
3. start/pause/stop.
4. position.
5. loop measure.
6. cursor.
7. count-in.

---

## Stage 4 — Chord sound

1. chord → notes.
2. basic PolySynth/Sampler.
3. `Hear chord`.
4. Virtual keyboard.

---

## Stage 5 — Piano basic accompaniment

1. Block.
2. Bass + chord.
3. Arpeggio.
4. Pattern library.
5. mixer basic.

---

## Stage 6 — Sections + Practice

1. loop by section.
2. tempo ladder.
3. practice session local.
4. progress UI.

---

## Stage 7 — Server progress

1. migrations.
2. services/controllers.
3. batched checkpoint.
4. dashboard summary.

---

## Stage 8 — Organ + expanded styles

---

## Stage 9 — MIDI

Chỉ làm sau khi Audio/Timeline/Transport ổn.

---

# 75. MVP ACCEPTANCE CRITERIA

Một MVP đạt chuẩn khi user có thể:

1. mở `/learn`;
2. chọn một bài hiện có;
3. chọn chord set HD/TLH;
4. thấy sheet;
5. thấy hợp âm hiện tại;
6. bấm nghe hợp âm;
7. thấy phím Piano tương ứng;
8. chọn Piano Block/Bass+Chord/Arpeggio;
9. Play;
10. accompaniment đi đúng hợp âm và đúng measure;
11. thay BPM;
12. transpose và audio thay theo;
13. loop một đoạn;
14. chọn Chorus và tập riêng;
15. chạy trên desktop/mobile;
16. iPhone có audio sau user gesture;
17. không gửi request liên tục khi đang chơi;
18. không sửa MusicXML/chord data gốc chỉ vì đang học.

Nếu 18 mục này ổn, mới mở rộng MIDI/advanced styles.

---

# 76. QUALITY GATES

Trước merge mỗi feature:

```text
[ ] No duplicate song loader
[ ] No duplicate transpose logic
[ ] No DOM pixel → musical timing dependency
[ ] No server audio rendering
[ ] No per-note HTTP request
[ ] No hard-coded chord notes if Tonal can parse
[ ] No audio setInterval as source-of-truth
[ ] iOS user gesture tested
[ ] mobile tested
[ ] transpose tested
[ ] 4/4 tested
[ ] 3/4 tested if relevant
[ ] 6/8 tested if relevant
[ ] cleanup/dispose tested
```

---

# 77. RỦI RO LỚN NHẤT

## Risk 1 — Chord timing sai

**Mức:** Critical.

Nếu mapping noteIdx→beat không chuẩn:

- chord UI đúng;
- accompaniment sai.

Giải pháp:

- Timeline Normalizer;
- fixtures;
- không dùng pixels.

---

## Risk 2 — Nhiều AudioContext/clock

**Mức:** High.

Có thể gây:

- drift;
- double click;
- audio không dừng;
- iOS lỗi.

Giải pháp:

- central audio/transport lifecycle.

---

## Risk 3 — Sample quá nặng

**Mức:** Medium/High mobile.

Giải pháp:

- Lite default;
- lazy sound pack;
- cache;
- progressive download.

---

## Risk 4 — MIDI browser compatibility

**Mức:** Medium.

Giải pháp:

- optional capability;
- virtual keyboard fallback;
- HTTPS.

---

## Risk 5 — SQLite high-write

**Mức:** Low ở MVP / High khi scale.

Giải pháp:

- batch writes;
- WAL;
- metrics;
- MySQL migration threshold.

---

## Risk 6 — Live polling

**Mức:** High nếu scale live.

Không phải risk của Solo `/learn`, nhưng là risk hệ thống chung.

Giải pháp:

- Live off by default;
- SSE/WebSocket khi concurrency tăng.

---

# 78. SERVER COST MATRIX

| Tính năng | Server CPU | Bandwidth | DB Write | Nhận xét |
|---|---:|---:|---:|---|
| Render MusicXML | Thấp | Thấp | Không | Client OSMD |
| Transpose | Rất thấp | Không | Không | Client |
| Chord Trainer | Rất thấp | Không | Không | Client Tonal |
| Piano Synth | Rất thấp | Rất thấp | Không | Client Web Audio |
| Sampled Piano | Rất thấp | Trung bình lần đầu | Không | Cache sau tải |
| Auto accompaniment | Rất thấp | Thấp | Không | Client Pattern Engine |
| Virtual keyboard | Gần 0 | 0 | 0 | Client UI |
| MIDI evaluation | Gần 0 | 0 | Low summary | Client |
| Practice history | Thấp | Thấp | Thấp/Trung bình | Batch |
| Live Polling | Trung bình/Cao | Trung bình | File I/O | Current hotspot |
| AI/OMR runtime | Cao | Tùy | Tùy | Tách worker/service |

---

# 79. ĐIỂM SỐ KHẢ THI

| Hạng mục | Điểm |
|---|---:|
| Tận dụng source hiện tại | 9/10 |
| Khả thi trên browser | 9.5/10 |
| Tải server nếu thiết kế đúng | 9/10 |
| Khả năng chạy mobile | 8/10 |
| iOS audio | 7.5/10, repo đã có kinh nghiệm |
| Web MIDI cross-browser | 6/10 |
| Chord timeline hiện tại | 5/10 — cần normalizer |
| Auto accompaniment mới | 7.5/10 |
| Khả năng trở thành sản phẩm khác biệt | 9.5/10 |

---

# 80. ĐIỀU TÔI KHUYÊN KHÔNG LÀM Ở VERSION ĐẦU

Không làm cùng lúc:

- 100 instruments;
- AI teacher;
- video lesson;
- WebRTC;
- classroom live;
- advanced notation editor trong `/learn`;
- auto fingering AI;
- full Yamaha-style arranger;
- raw MIDI cloud recording.

MVP cần chứng minh:

> **Một bài hiện có của SheetApp có thể tự biến thành bài tập Piano/Hợp âm có đệm, loop và transpose đúng.**

Chỉ cần làm cực tốt điều đó, `/learn` đã có giá trị rất lớn.

---

# 81. PHẠM VI “VIP” HỢP LÝ SAU MVP

Sau khi nền ổn:

```text
SheetApp Learn Pro
├── Piano Tutor
├── Organ Tutor
├── SATB Tutor
├── Chord Theory
├── Ear Training
├── MIDI Assessment
├── Practice Analytics
├── Teacher Assignments
├── Pattern Editor
├── Offline Packs
└── Smart Recommendations
```

---

# 82. KIẾN TRÚC ĐÍCH 10/10

```mermaid
graph TD
    A[MusicXML Song] --> B[Score Domain]
    C[Chord Profiles] --> D[Chord Profile Provider]
    B --> E[Timeline Normalizer]
    D --> E
    F[Song Sections / Arrangement] --> E

    E --> G[Normalized Musical Timeline]
    G --> H[Music Transport]
    G --> I[Chord Analyzer]

    I --> J[Voicing Engine]
    K[Pattern Library] --> L[Pattern Engine]
    J --> L
    G --> L

    H --> L
    H --> M[Cursor Sync]
    H --> N[Metronome / Count-in]

    L --> O[Learn Sound Engine]
    O --> P[Piano]
    O --> Q[Organ]
    O --> R[Bass]
    O --> S[Pad]
    O --> T[Drum]

    U[MIDI Input] --> V[Practice Judge]
    G --> V
    V --> W[Practice Recorder]
    W --> X[Progress API]

    Y[/learn UI] --> H
    Y --> K
    Y --> U
    M --> Y
    I --> Y
```

---

# 83. FOLDER BOUNDARY 10/10

```text
Shared Music Domain
├── score
├── harmony
├── timing
└── position

Performance Domain
├── live
├── setlist
└── cues

Editor Domain
└── score mutation

Learning Domain
├── accompaniment
├── tutor
├── midi
├── practice
└── progress
```

Đây là cách tránh `/learn` xâm nhập vào `/editor` và performance code.

---

# 84. CHIẾN LƯỢC MIGRATION KHÔNG PHÁ SOURCE

## Rule 1

Không sửa behavior của `/` chỉ để `/learn` chạy.

## Rule 2

Khi cần shared code:

```text
extract shared module
→ test `/`
→ migrate `/`
→ test
→ reuse `/learn`
```

## Rule 3

Feature flags:

```text
LEARN_ENABLED=true
LEARN_MIDI_ENABLED=false
LEARN_SAMPLED_AUDIO_ENABLED=false
```

ở giai đoạn thử nghiệm.

---

# 85. ANTIGRAVITY IMPLEMENTATION RULES

Agent code phải tuân thủ:

1. đọc `CODE_MAP.md` trước sửa code;
2. kiểm tra dependency graph;
3. không duplicate module;
4. một task nhỏ/một nhóm file;
5. update code map sau thay đổi;
6. test trước commit;
7. giữ backward compatibility;
8. không sửa `MusicXML` source bởi learning state;
9. không thêm framework lớn nếu Vanilla JS đủ;
10. không thêm dependency audio nếu Tone.js đáp ứng MVP;
11. bất kỳ dependency sample nào phải audit license;
12. tránh file > khoảng 500–700 dòng nếu domain có thể tách hợp lý;
13. mọi engine mới phải có public interface documented;
14. pattern và timeline cần unit fixtures.

---

# 86. PROMPT GỐC ĐỀ XUẤT CHO ANTIGRAVITY

> Dùng phần này sau khi đã commit/backup repo.

```text
Bạn đang phát triển SheetApp2.

Mục tiêu dài hạn là tạo route `/learn` thành Interactive Music Learning Studio.

NGUYÊN TẮC BẮT BUỘC:
1. Đọc CODE_MAP.md và coding standards trước khi sửa bất kỳ file nào.
2. Không duplicate SongLoader, OSMDRenderer, TransposeEngine, EventBus, Store hoặc ApiService.
3. Không sửa MusicXML/chord source để lưu learning state.
4. Không tạo server-side audio renderer.
5. Audio/timing `/learn` phải chạy client-side.
6. Không gửi HTTP request cho từng MIDI note.
7. Không dùng pixel/DOM position làm musical timing source.
8. Chord custom hiện theo measureIdx/noteIdx phải đi qua một ChordTimelineNormalizer để thành measure/beat/duration.
9. `/learn` không bật LiveSession mặc định.
10. Không triển khai MIDI trước khi Timeline + Transport + Basic Piano accompaniment đã ổn.

Hãy thực hiện TỪNG GIAI ĐOẠN, không code toàn bộ cùng lúc.

GIAI ĐOẠN ĐẦU:
A. Thiết kế interfaces và fixtures cho:
- ChordTimelineEvent
- MusicTransport
- Pattern definition
- PlayableNoteEvent

B. Tạo `/learn` shell dùng lại SongLoader/OSMD.

C. Tạo ChordTimelineNormalizer và test với 4/4, 3/4, 6/8, 1 chord/bar, 2 chords/bar, slash chord, transpose.

DỪNG sau giai đoạn này và báo cáo:
- file tạo/sửa;
- dependency impact;
- test results;
- những vấn đề chưa giải quyết.

Không tiếp tục accompaniment trước khi Timeline tests pass.
```

---

# 87. ĐỀ XUẤT ROADMAP SẢN PHẨM

## Version 0.1 — Chord Learn

```text
Sheet
Current chord
Chord notes
Hear chord
Virtual keyboard
Transpose
Loop
```

---

## Version 0.2 — Piano Basic

```text
Block
Bass + Chord
Arpeggio
BPM
Count-in
Sections
```

---

## Version 0.3 — Piano Styles

```text
Worship
Ballad
4/4
6/8
Waltz
Voicing
Mixer
```

---

## Version 0.4 — Practice Tracking

```text
Session
Tempo ladder
Progress
Weak sections
Offline
```

---

## Version 0.5 — Organ

```text
Organ voices
RH/LH/Pedal
Styles
```

---

## Version 0.6 — MIDI

```text
Input
Wait Mode
Chord judge
Melody judge
Timing
```

---

## Version 1.0 — Learning Platform

```text
Piano + Organ + SATB
MIDI evaluation
Progress dashboard
Teacher-ready data model
Stable offline packs
```

---

# 88. ƯỚC TÍNH ĐỘ KHÓ TƯƠNG ĐỐI

Không phải ước tính thời gian, chỉ là complexity.

| Feature | Complexity |
|---|---:|
| `/learn` shell | 2/10 |
| Chord card | 2/10 |
| Virtual keyboard | 3/10 |
| Hear chord | 3/10 |
| A/B loop | 4/10 |
| Chord timeline chuẩn | 7/10 |
| Block accompaniment | 4/10 |
| Pattern Engine | 7/10 |
| Voicing Engine | 7/10 |
| Organ basic | 5/10 |
| Sample sound management | 6/10 |
| MIDI note match | 5/10 |
| MIDI timing evaluation | 7/10 |
| Full practice analytics | 7/10 |
| Repeats/DC/DS roadmap | 8/10 |
| Classroom realtime | 9/10 |

**Rủi ro kỹ thuật lớn nhất không phải UI — mà là Timeline/Timing.**

---

# 89. SERVER VERDICT CUỐI

## Nếu `/learn` được làm như tài liệu này

```text
Browser = music workstation
Server  = data/control plane
```

thì:

### Không cần GPU

### Không cần audio server mạnh

### Không cần Redis ở MVP

### Không cần WebSocket chỉ cho solo learn

### SQLite vẫn có thể chạy MVP

### VPS bình thường đủ cho giai đoạn đầu

---

## Thứ cần đầu tư trước server mạnh

1. Kiến trúc timeline tốt.
2. Client-side audio engine.
3. Cache sound pack.
4. Batched progress writes.
5. Metrics.
6. Load test.

Sau đó mới quyết định nâng server.

---

# 90. KHUYẾN NGHỊ CHỐT

Tôi khuyên **BẮT ĐẦU `/learn` ngay**, nhưng làm theo thứ tự:

```text
1. ChordTimeline
2. MusicTransport
3. Chord Trainer
4. Virtual Piano
5. Basic Piano accompaniment
6. Pattern Engine
7. Voicing
8. Practice Tracking
9. Organ
10. MIDI
```

Không đảo thứ tự.

Nếu làm Piano style trước khi Timeline chuẩn, bạn sẽ phải sửa lại rất nhiều.

---

# 91. ĐỊNH NGHĨA THÀNH CÔNG CỦA SHEETAPP LEARN

Một user mở một bài thánh ca hiện có và có thể:

```text
chọn bài
↓
chọn Tone
↓
chọn bộ hợp âm
↓
chọn Piano
↓
chọn Basic / Worship
↓
nghe app đệm đúng theo score
↓
nhìn bàn phím để biết đánh gì
↓
loop Chorus
↓
giảm còn 60 BPM
↓
tập 3 lần
↓
tăng 65 BPM
↓
cắm MIDI nếu có
↓
app báo ô nào còn sai
↓
lần sau mở lại tiếp tục từ tiến độ cũ
```

Nếu SheetApp đạt flow này tốt, sản phẩm đã vượt rất xa một viewer MusicXML thông thường.

---

# 92. NGUỒN ĐÃ ĐỐI CHIẾU

## SheetApp2 repository

- Repository: https://github.com/haiyenpa25/sheetapp2
- README: https://raw.githubusercontent.com/haiyenpa25/sheetapp2/main/README.md
- CODE_MAP: https://raw.githubusercontent.com/haiyenpa25/sheetapp2/main/CODE_MAP.md
- Main index: https://raw.githubusercontent.com/haiyenpa25/sheetapp2/main/index.php
- Service Worker: https://raw.githubusercontent.com/haiyenpa25/sheetapp2/main/sw.js
- ChordCanvas: https://raw.githubusercontent.com/haiyenpa25/sheetapp2/main/assets/js/chord-canvas.js
- Audio Player: https://raw.githubusercontent.com/haiyenpa25/sheetapp2/main/assets/js/audio-player.js
- MusicalPosition: https://raw.githubusercontent.com/haiyenpa25/sheetapp2/main/assets/js/performance/musical-position.js
- ArrangementEngine: https://raw.githubusercontent.com/haiyenpa25/sheetapp2/main/assets/js/performance/arrangement-engine.js
- LiveSession: https://raw.githubusercontent.com/haiyenpa25/sheetapp2/main/assets/js/performance/live-session.js
- LiveTransport: https://raw.githubusercontent.com/haiyenpa25/sheetapp2/main/assets/js/performance/live-transport.js
- LiveSyncService: https://raw.githubusercontent.com/haiyenpa25/sheetapp2/main/api/services/LiveSyncService.php
- SessionService: https://raw.githubusercontent.com/haiyenpa25/sheetapp2/main/api/services/SessionService.php
- DB: https://raw.githubusercontent.com/haiyenpa25/sheetapp2/main/api/core/DB.php
- ArrangementService: https://raw.githubusercontent.com/haiyenpa25/sheetapp2/main/api/services/ArrangementService.php

## Technology references

- Tone.js: https://tonejs.github.io/
- Tone Transport docs: https://tonejs.github.io/docs/14.5.3/Transport
- Tonal: https://tonaljs.github.io/tonal/docs/
- MDN Web MIDI: https://developer.mozilla.org/en-US/docs/Web/API/Web_MIDI_API
- SQLite WAL: https://www.sqlite.org/wal.html
- smplr: https://github.com/danigb/smplr

---

# 93. NOTE CHO PHASE TRIỂN KHAI TIẾP THEO

**Bước tiếp theo hợp lý nhất không phải code UI.**

Nên tạo một tài liệu kỹ thuật riêng:

```text
LEARN_PHASE_01_ARCHITECTURE.md
```

chỉ dành cho:

1. ChordTimeline data contract.
2. Cách map `measureIdx/noteIdx` → musical beat.
3. MusicTransport interface.
4. Pattern JSON schema.
5. Fixtures/test cases.
6. Public APIs giữa shared core và `/learn`.

Sau khi Phase 01 pass test mới bắt đầu Piano accompaniment.

---

# 94. FINAL DECISION

> **GO — Nên phát triển `/learn`.**

SheetApp2 đang có đúng loại tài sản nền mà module này cần. Nếu giữ accompaniment, MIDI và scoring trên browser, dự án **không phải loại ứng dụng tiêu tốn server**. Điểm phải giải quyết kỹ nhất là **musical timeline**, sau đó là **một clock duy nhất cho audio**, rồi mới tới sound/style/MIDI.

Mục tiêu tốt nhất cho `/learn` không phải “thêm một trang nghe nhạc”, mà là:

> **Biến mọi MusicXML + chord set có sẵn trong SheetApp thành một bài học đàn tương tác có thể nghe, xem, loop, đổi tone, đổi tempo, chọn kiểu đệm và tự luyện theo từng đoạn.**

Đó là hướng đủ khác biệt, đủ thực dụng, và đặc biệt phù hợp với kho sheet/band/ca đoàn mà SheetApp hiện đã xây dựng.
