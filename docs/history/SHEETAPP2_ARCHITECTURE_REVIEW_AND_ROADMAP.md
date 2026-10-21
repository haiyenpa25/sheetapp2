# SHEETAPP2 — ĐÁNH GIÁ KIẾN TRÚC & KẾ HOẠCH NÂNG CẤP LIVE PERFORMANCE ENGINE

**Repository:** https://github.com/haiyenpa25/sheetapp2  
**Tài liệu nền:** `LIVE_BAND_AND_SMART_PRACTICE_PLAN.md`  
**Ngày:** 24/08/2026  
**Trạng thái:** Architecture Review / Recommended Roadmap  
**Mục tiêu:** Chuẩn hóa hướng phát triển SheetApp từ ứng dụng đọc bản nhạc thành **Live Worship / Band Performance OS**

---

# 1. KẾT LUẬN ĐIỀU HÀNH

Kế hoạch hiện tại đi đúng hướng và có giá trị thực tế cao cho ban nhạc, ca đoàn và nhóm thờ phượng.

Đánh giá tổng thể:

| Hạng mục | Điểm đánh giá |
|---|---:|
| Ý tưởng sản phẩm | 9/10 |
| Khả năng tận dụng code hiện tại | 8.5/10 |
| Thiết kế kỹ thuật hiện tại | 7/10 |
| Khả năng mở rộng nếu chuẩn hóa lại kiến trúc | 9.5/10 |

SheetApp hiện đã có nhiều thành phần nền quan trọng:

- MusicXML / OSMD.
- Transpose.
- Capo.
- Metronome.
- Auto Scroll.
- Setlist.
- Practice Notes.
- Lyric View.
- Foot Pedal.
- Live Sync sơ bộ.

Do đó, hướng đúng không phải là viết lại toàn bộ ứng dụng mà là xây thêm một tầng trung tâm:

```text
SHEETAPP
   │
   └── PERFORMANCE ENGINE
          │
          ├── Live Session
          ├── Musical Position
          ├── Synchronized Clock
          ├── Arrangement
          ├── Cue Engine
          ├── Tempo Map
          ├── Modulation Map
          └── Role-based View
```

Nguyên tắc quan trọng nhất:

> **Host đồng bộ trạng thái âm nhạc, không đồng bộ giao diện của thiết bị.**

---

# 2. MỤC TIÊU SẢN PHẨM

SheetApp không nên chỉ được xem là:

> Ứng dụng hiển thị MusicXML có thêm Live Sync.

Mục tiêu dài hạn nên là:

> **SheetApp Performance Engine — hệ điều hành hỗ trợ luyện tập và biểu diễn trực tiếp cho ban nhạc, ca đoàn và nhóm thờ phượng.**

Hệ thống cần giúp giải quyết:

1. Lệch bài.
2. Lệch tông.
3. Lệch vị trí bản nhạc.
4. Không biết khi nào vào hát.
5. Không nhớ đoạn dạo còn bao nhiêu ô.
6. Quên điểm đổi tông.
7. Quên tempo từng đoạn.
8. Mỗi nhạc cụ cần một kiểu hiển thị khác nhau.
9. Người điều khiển cần thay đổi bài trong thời gian thực.
10. Thành viên cần theo kịp mà không thao tác quá nhiều.

---

# 3. NHỮNG ĐIỂM ĐÚNG TRONG KẾ HOẠCH HIỆN TẠI

## 3.1. Master / Follower là mô hình phù hợp

Cấu trúc:

```text
Leader / Host
      │
      ▼
Live Session
      │
 ┌────┼────┐
 ▼    ▼    ▼
Guitar Piano Vocal
```

rất phù hợp với môi trường ban nhạc.

Leader quyết định:

- Bài hát.
- Arrangement.
- Tông.
- Tempo.
- Vị trí hiện tại.
- Section hiện tại.
- Cue tiếp theo.
- Trạng thái Play / Stop.

Follower chỉ cần nhận trạng thái.

---

## 3.2. Role-based View là hướng rất mạnh

Mỗi thiết bị không nhất thiết hiển thị giống nhau.

Ví dụ:

### Guitar

```text
Chord View
Capo
Chord Diagram
Section Cue
```

### Piano / Organ

```text
Full Score
Grand Staff
Measure Cursor
Tempo
Cue
```

### Vocal

```text
Lyric View
Large Text
Section Highlight
Next-line Cue
```

### Leader

```text
Full Score
Transport Controls
Arrangement
Jump Section
Transpose
Cue Control
```

Tất cả vẫn có thể ở cùng một phiên Live Session.

---

# 4. VẤN ĐỀ KIẾN TRÚC SỐ 1 — KHÔNG ĐỒNG BỘ `scrollTop`

Đây là thay đổi quan trọng nhất cần thực hiện trước khi mở rộng Live Sync.

## 4.1. Vấn đề

Không nên dùng:

```json
{
  "scrollTop": 340
}
```

làm vị trí chính của phiên Live.

Lý do:

- Laptop và iPad có chiều cao viewport khác nhau.
- Người dùng zoom khác nhau.
- Guitar có thể ẩn bớt staff.
- Vocal dùng Lyric View.
- Có thiết bị dùng Compact Mode.
- Font size khác nhau.
- Responsive layout khác nhau.

Ví dụ:

```text
Leader Laptop
scrollTop 340px
      │
      ├── Guitar iPad  → Measure 8
      ├── Piano PC     → Measure 10
      └── Vocal iPhone → Lyric line khác
```

Cùng một giá trị pixel nhưng không còn cùng vị trí âm nhạc.

---

# 5. GIẢI PHÁP — MUSICAL POSITION

Live Sync phải dùng một tọa độ độc lập với giao diện.

Đề xuất:

```json
{
  "position": {
    "measure": 12,
    "beat": 3,
    "progress": 0.62
  }
}
```

Trong đó:

| Field | Ý nghĩa |
|---|---|
| `measure` | Ô nhịp hiện tại |
| `beat` | Phách hiện tại |
| `progress` | Tiến độ tương đối trong ô nhịp |
| `sectionId` | Section hiện tại |
| `roadmapStep` | Bước hiện tại trong arrangement |

Follower nhận:

```text
measure = 12
beat = 3
```

sau đó tự xác định vị trí hiển thị trên thiết bị của mình.

```text
               MUSICAL POSITION
                      │
             measure = 12
                      │
       ┌──────────────┼──────────────┐
       ▼              ▼              ▼
     Guitar         Piano          Vocal
       │              │              │
       ▼              ▼              ▼
 chord anchor      OSMD box      lyric anchor
       │              │              │
       ▼              ▼              ▼
 local scroll      local scroll    local scroll
```

---

# 6. TÁCH `VIEW STATE` VÀ `PERFORMANCE STATE`

Không được trộn hai loại dữ liệu.

## 6.1. Performance State

Phải được đồng bộ:

```text
song
arrangement
transpose
tempo
measure
beat
section
roadmap step
transport state
cue
```

## 6.2. View State

Không nên đồng bộ mặc định:

```text
zoom
font size
staff visibility
compact mode
lyric mode
scroll pixel
dark mode
page size
orientation
```

Nguyên tắc:

```text
SERVER:
WHAT + WHEN + WHERE

CLIENT:
HOW TO DISPLAY
```

---

# 7. VẤN ĐỀ KIẾN TRÚC SỐ 2 — LATENCY

Nếu follower poll mỗi 1 giây thì không thể đảm bảo trải nghiệm dưới 300 ms.

Luồng hiện tại về nguyên tắc có thể giống:

```text
Host action
   │
   ▼
Throttle
   │
   ▼
HTTP POST
   │
   ▼
Server state
   │
   ▼
Follower Poll
   │
   ▼
UI update
```

Nếu polling interval là 1000 ms thì latency có thể vượt 1 giây.

---

# 8. KHÔNG CẦN VỘI CHUYỂN SANG WEBSOCKET

Không nên buộc toàn bộ business logic phụ thuộc WebSocket ngay.

Đề nghị tạo abstraction:

```text
LiveTransport
    │
    ├── PollingTransport
    │
    ├── SSETransport
    │
    └── WebSocketTransport
```

Business logic chỉ gọi:

```javascript
transport.connect()
transport.send(state)
transport.subscribe(callback)
transport.disconnect()
```

Không quan tâm transport phía dưới là gì.

---

# 9. LỘ TRÌNH TRANSPORT

## V1

```text
PHP API
+
Fast Polling
+
Room State
```

Polling có thể giảm xuống khoảng:

```text
250–500 ms
```

nhưng cần:

- ETag / revision.
- Không trả full state khi không thay đổi.
- Debounce.
- Event sequence.
- Lightweight JSON.

---

## V2

Có thể xem xét:

```text
Server-Sent Events
```

cho follower nếu kiến trúc hosting phù hợp.

---

## V3

```text
WebSocket
```

khi:

- số client tăng;
- cần latency thấp;
- cần cue realtime;
- cần transport clock tốt hơn.

---

# 10. VẤN ĐỀ KIẾN TRÚC SỐ 3 — KHÔNG STREAM METRONOME TICK

Không được làm:

```text
Host tick
   │
   ├── network → Guitar tick
   ├── network → Piano tick
   └── network → Vocal tick
```

Internet/network latency làm metronome lệch.

Ví dụ:

```text
Host        ●
Guitar        ●
Piano       ●
Vocal           ●
```

Điều này không chấp nhận được cho âm nhạc.

---

# 11. GIẢI PHÁP — SYNCHRONIZED CLOCK

Server/Host chỉ gửi:

```json
{
  "transport": {
    "state": "playing",
    "bpm": 84,
    "beatsPerMeasure": 4,
    "startAt": 1787554125.500
  }
}
```

Client tự chạy metronome local bằng Web Audio API.

```text
            SHARED CLOCK
                 │
          startAt = T
                 │
      ┌──────────┼──────────┐
      ▼          ▼          ▼
    iPad       Laptop      Phone
      │          │          │
 WebAudio     WebAudio    WebAudio
      │          │          │
      ●          ●          ●
```

---

# 12. CLOCK SYNC

Đề nghị client thực hiện clock calibration.

Ví dụ:

```text
Client send: t1
Server recv: t2
Server send: t3
Client recv: t4
```

Ước lượng:

```text
RTT = (t4 - t1) - (t3 - t2)
```

Clock Offset:

```text
offset = ((t2 - t1) + (t3 - t4)) / 2
```

Không cần đạt mức đồng bộ DAW chuyên nghiệp.

Mục tiêu thực tế:

```text
Visual Cue:
< 100 ms

Count-in:
càng gần nhau càng tốt

Metronome:
local scheduling
```

---

# 13. COUNT-IN ENGINE

Không nên thiết kế Count-in chỉ như một overlay.

Nó nên trở thành một phần của Transport Engine.

State:

```text
STOPPED
   │
   ▼
COUNT_IN
   │
   ▼
PLAYING
   │
   ▼
PAUSED
```

Ví dụ payload:

```json
{
  "transport": {
    "state": "count_in",
    "bpm": 84,
    "meter": {
      "beats": 4,
      "beatUnit": 4
    },
    "countInBars": 1,
    "startAt": 1787554125.500
  }
}
```

Client có thể hiển thị:

```text
4
3
2
1
VÀO
```

hoặc:

```text
1
2
3
4
VÀO
```

tùy lựa chọn UX.

---

# 14. SONG ROADMAP KHÔNG NÊN GẮN TRỰC TIẾP 1:1 VỚI SONG

Đây là thay đổi kiến trúc rất quan trọng.

Một bài hát có thể có nhiều cách trình bày.

Ví dụ:

## Arrangement A

```text
Intro
Verse 1
Chorus
Verse 2
Chorus
Outro
```

## Arrangement B

```text
Intro
Verse 1
Chorus
Interlude
Chorus
Modulate +2
Chorus x2
Outro
```

Do đó:

```text
SONG
  │
  ├── ARRANGEMENT A
  ├── ARRANGEMENT B
  └── ARRANGEMENT C
```

---

# 15. DATA MODEL ĐỀ NGHỊ

## `songs`

```text
id
title
musicxml_path
default_key
default_bpm
default_meter
```

---

## `arrangements`

```text
id
song_id
name
description
default_transpose
created_at
updated_at
```

---

## `arrangement_steps`

```text
id
arrangement_id
sequence
section_id
repeat_count
transpose_delta
bpm
cue_text
```

---

## `song_sections`

```text
id
song_id
name
type
start_measure
end_measure
```

Ví dụ:

```text
Intro
Verse
Chorus
Bridge
Interlude
Outro
```

---

# 16. SCORE MAP VÀ PERFORMANCE ROADMAP PHẢI TÁCH RIÊNG

## Score Map

Mô tả cấu trúc vật lý của file MusicXML:

```text
Measure 1 → 60
```

---

## Performance Roadmap

Mô tả thứ tự thật sự khi biểu diễn.

Ví dụ:

```text
Intro
 ↓
Verse 1
 ↓
Chorus
 ↓
Verse 2
 ↓
Chorus
 ↓
Interlude
 ↓
Chorus
 ↓
Chorus +2
 ↓
Outro
```

Roadmap có thể quay lại cùng một vùng score nhiều lần.

---

# 17. ROADMAP STEP

Đề xuất format:

```json
{
  "id": "step-07",
  "sectionId": "chorus",
  "visit": 3,
  "startMeasure": 21,
  "endMeasure": 36,
  "repeat": 1,
  "transpose": 2,
  "bpm": 86,
  "cue": "Điệp khúc cuối - tăng tone"
}
```

Như vậy hệ thống biết:

```text
Không chỉ đang ở Chorus

mà là:

Chorus lần thứ 3
+
Tăng tone +2
+
Tempo 86
```

---

# 18. CUE ENGINE

Cue Engine nên là một module riêng.

Không nhét logic cue vào:

```text
auto-scroller.js
```

hoặc:

```text
metronome.js
```

Kiến trúc:

```text
Musical Position
       │
       ▼
    Cue Engine
       │
  ┌────┼─────────┐
  ▼    ▼         ▼
Visual Audio   Haptic
```

---

# 19. CÁC LOẠI CUE

Ví dụ:

```text
SECTION_CHANGE
MODULATION
TEMPO_CHANGE
VOCAL_ENTRY
INSTRUMENT_ENTRY
STOP
ENDING
FERMATA
REPEAT
JUMP
```

Payload:

```json
{
  "cue": {
    "type": "MODULATION",
    "triggerMeasure": 41,
    "preNotifyMeasures": 2,
    "message": "Chuẩn bị tăng tone G → A"
  }
}
```

---

# 20. CUE TIMELINE

Ví dụ:

```text
Measure 39
⚡ 2 ô nữa tăng tone

Measure 40
⚡ 1 ô nữa tăng tone

Measure 41
⚡ G → A
```

Đối với Vocal:

```text
2 ô nữa → Vào Điệp Khúc
```

Đối với Guitar:

```text
2 ô nữa → +2 tone
```

Đối với Drummer:

```text
2 ô nữa → Build up
```

Tức là cùng một roadmap nhưng cue có thể render khác theo role.

---

# 21. KHÔNG NÊN AUTO-TRANSPOSE FULL SCORE NGAY Ở V1

Nếu transpose hiện tại phải reload/re-render OSMD thì việc đổi tông ngay giữa bài có rủi ro:

```text
Measure 40
    │
    ▼
Measure 41
    │
    ▼
Transpose
    │
    ▼
Reload MusicXML
    │
    ▼
Render OSMD
```

Nếu render mất vài trăm ms hoặc hơn:

- giật màn hình;
- mất vị trí;
- cursor nhảy;
- follower lệch;
- thiết bị yếu có thể lag.

---

# 22. MODULATION ROADMAP NÊN CHIA THÀNH 3 CẤP

## V1 — Notification Only

```text
⚡ 2 ô nữa tăng tone
⚡ 1 ô nữa
⚡ G → A
```

Không đổi score.

---

## V2 — Chord Layer Transpose

Chỉ đổi:

```text
G  → A
D  → E
Em → F#m
```

trên lớp chord.

Không reload full MusicXML.

---

## V3 — Full Score Modulation

Chỉ thực hiện sau khi:

- renderer đủ nhanh;
- cache sẵn;
- có pre-render;
- không mất cursor;
- không gây frame drop.

---

# 23. PERFORMANCE STATE V2

Payload đề xuất:

```json
{
  "protocolVersion": 2,
  "room": "BAND-2026",
  "revision": 184,
  "active": true,

  "leader": {
    "clientId": "client-host-01",
    "name": "Ca trưởng"
  },

  "song": {
    "songId": "thanh-ca-011",
    "arrangementId": "arr-011-b",
    "setlistId": 3,
    "setlistIndex": 0
  },

  "music": {
    "baseKey": "G",
    "transpose": 0,
    "bpm": 84,
    "meter": {
      "beats": 4,
      "beatUnit": 4
    }
  },

  "position": {
    "roadmapStep": 4,
    "sectionId": "chorus",
    "measure": 21,
    "beat": 1,
    "progress": 0.0
  },

  "transport": {
    "state": "playing",
    "startAt": 1787554125.500
  },

  "cue": {
    "type": "SECTION_CHANGE",
    "message": "Điệp khúc",
    "nextSection": "interlude"
  },

  "serverTime": 1787554132.120
}
```

---

# 24. REVISION / EVENT SEQUENCE

Cần thêm:

```text
revision
```

Ví dụ:

```text
181
182
183
184
```

Follower chỉ xử lý state mới hơn.

```javascript
if (newState.revision <= currentRevision) {
    return;
}
```

Giúp tránh:

- request trả về sai thứ tự;
- network packet delay;
- race condition;
- rollback state.

---

# 25. ROOM MODEL

Room không nên chỉ là một file state đơn giản về lâu dài.

Đề nghị:

```text
LiveRoom
   │
   ├── roomCode
   ├── hostClientId
   ├── createdAt
   ├── expiresAt
   ├── revision
   ├── currentState
   └── participants
```

---

# 26. CLIENT ID

Mỗi thiết bị có:

```text
clientId
```

ví dụ:

```text
device-a71f2
```

Không nhất thiết cần tài khoản.

Có thể lưu bằng:

```text
localStorage
```

---

# 27. PARTICIPANT ROLE

```text
LEADER
GUITAR
KEYBOARD
VOCAL
DRUM
BASS
VIEWER
```

Role chủ yếu dùng để:

- preset giao diện;
- cue;
- quyền điều khiển;
- analytics sau này.

---

# 28. HOST AUTHORITY

Host là nguồn trạng thái chính.

Follower không được tự ý ghi:

```text
song
transpose
position
transport
```

trừ khi được cấp quyền.

Có thể có:

```text
CO_LEADER
```

sau này.

---

# 29. RECONNECT

Live Performance bắt buộc có reconnect.

State:

```text
CONNECTED
RECONNECTING
OFFLINE
RESYNCING
```

Khi mất mạng:

```text
Follower
   │
   ▼
giữ state cuối
   │
   ▼
tiếp tục local clock
   │
   ▼
reconnect
   │
   ▼
fetch latest revision
   │
   ▼
resync
```

Không nên blank màn hình.

---

# 30. OFFLINE-FIRST CHO BẢN NHẠC

Nếu đang live mà mạng Internet mất, follower vẫn phải đọc được bài.

Do đó nên cache:

```text
MusicXML
Arrangement
Song Metadata
Role Preferences
```

trước khi buổi nhóm bắt đầu.

Live Sync chỉ truyền:

```text
small state
```

không truyền nguyên bản nhạc liên tục.

---

# 31. SETLIST PRELOAD

Khi join Live Room:

```text
Load Setlist
      │
      ▼
Download song metadata
      │
      ▼
Cache MusicXML
      │
      ▼
Cache arrangement
```

Khi Leader đổi bài:

```text
switch instantly
```

thay vì tải từ đầu.

---

# 32. PHÂN LỚP MODULE

Kiến trúc đề xuất:

```text
assets/js/
│
├── performance/
│   ├── performance-engine.js
│   ├── live-session.js
│   ├── musical-position.js
│   ├── transport-clock.js
│   ├── cue-engine.js
│   ├── arrangement-engine.js
│   └── role-profile.js
│
├── transport/
│   ├── live-transport.js
│   ├── polling-transport.js
│   └── websocket-transport.js
│
├── music/
│   ├── metronome.js
│   ├── auto-scroller.js
│   ├── song-loader.js
│   └── lyric-extractor.js
│
└── ui/
    ├── live-room-modal.js
    ├── cue-banner.js
    ├── count-in-overlay.js
    └── live-status.js
```

---

# 33. PERFORMANCE ENGINE

`performance-engine.js` là coordinator.

Ví dụ:

```text
PerformanceEngine
      │
      ├── LiveSession
      ├── ArrangementEngine
      ├── TransportClock
      ├── CueEngine
      └── MusicalPosition
```

Không để module UI điều khiển business logic trực tiếp.

---

# 34. EVENT BUS

Nên dùng một event layer chung.

Ví dụ:

```text
performance:songChanged
performance:positionChanged
performance:sectionChanged
performance:cue
performance:transportStarted
performance:transportStopped
live:connected
live:disconnected
```

Module nghe event thay vì gọi chéo nhau hàng loạt.

---

# 35. TRÁNH GOD OBJECT

Không tạo một file:

```text
live-sync.js
```

rồi nhét vào:

- network;
- room;
- UI;
- song;
- scroll;
- metronome;
- cue;
- transpose;
- reconnect.

Nên chia trách nhiệm rõ ràng.

---

# 36. STATE MACHINE

Live Session nên có state machine.

```text
IDLE
 │
 ▼
JOINING
 │
 ▼
CONNECTED
 │
 ├── RECONNECTING
 │
 ├── RESYNCING
 │
 └── CLOSED
```

Transport:

```text
STOPPED
COUNT_IN
PLAYING
PAUSED
```

---

# 37. ROLE PROFILE

Ví dụ:

```json
{
  "role": "guitar",
  "view": {
    "showChords": true,
    "showLyrics": true,
    "showFullScore": false,
    "showCapo": true,
    "showCue": true
  }
}
```

Không lưu role display vào Live Room.

Role preference là local preference.

---

# 38. LEADER CONTROL

Leader UI nên có:

```text
Current Song
Current Section
Next Section

[ Previous ]
[ Next Section ]

Transpose
Tempo

[ Count-in ]
[ Start ]
[ Pause ]
[ Stop ]

Upcoming Cue
```

Trong live không nên bắt Leader thao tác quá nhiều.

---

# 39. JUMP BY SECTION

Không nên chỉ có:

```text
Next Song
Previous Song
```

Nên có:

```text
Intro
Verse
Chorus
Bridge
Interlude
Outro
```

Leader có thể:

```text
Jump → Chorus
```

Hệ thống cập nhật:

```text
roadmapStep
section
measure
cue
```

---

# 40. SMART REHEARSAL

Smart Rehearsal có thể dùng cùng Performance Engine.

Khác biệt:

```text
LIVE MODE
Leader điều khiển nhiều thiết bị

PRACTICE MODE
Một người / nhóm tập
```

Engine bên dưới giống nhau.

---

# 41. LOOP SECTION

Sau khi roadmap ổn định, thêm:

```text
Loop Verse
Loop Chorus
Loop Measure 21–28
```

Rất hữu ích cho luyện tập.

---

# 42. PRACTICE SPEED

Cho phép:

```text
50%
60%
70%
80%
90%
100%
```

hoặc BPM trực tiếp.

---

# 43. TEMPO MAP

Không nên chỉ lưu BPM trên từng section nếu muốn hỗ trợ nâng cao.

Đề nghị data model:

```json
[
  {
    "measure": 1,
    "bpm": 80,
    "type": "set"
  },
  {
    "measure": 41,
    "bpm": 86,
    "type": "set"
  }
]
```

Sau này có thể mở rộng:

```text
ritardando
accelerando
```

---

# 44. MODULATION MAP

Ví dụ:

```json
[
  {
    "measure": 41,
    "transposeDelta": 2,
    "fromKey": "G",
    "toKey": "A"
  }
]
```

---

# 45. PRE-CUE

Một cue nên hỗ trợ:

```text
triggerMeasure
preNotifyMeasures
```

Ví dụ:

```json
{
  "triggerMeasure": 41,
  "preNotifyMeasures": 2
}
```

Engine tự tạo:

```text
Measure 39 → warning
Measure 40 → final warning
Measure 41 → action
```

---

# 46. DATABASE ROADMAP ĐỀ NGHỊ

Tối thiểu:

```text
songs
arrangements
song_sections
arrangement_steps
setlists
setlist_items
live_rooms
```

Sau này:

```text
practice_sessions
practice_notes
user_role_profiles
```

---

# 47. KHÔNG NÊN LƯU TẤT CẢ VÀO `structure_json`

JSON phù hợp MVP nhưng nếu mọi dữ liệu đều nằm trong một JSON lớn thì sau này khó:

- tìm section;
- reorder;
- query;
- audit;
- update một step;
- validate;
- migrate.

Nên dùng DB quan hệ cho các thành phần chính.

Có thể vẫn giữ:

```text
metadata_json
```

cho các field ít dùng.

---

# 48. API V2 ĐỀ NGHỊ

## Room

```text
POST /api/live/rooms
GET  /api/live/rooms/{room}
POST /api/live/rooms/{room}/join
POST /api/live/rooms/{room}/state
GET  /api/live/rooms/{room}/state
```

---

## Arrangement

```text
GET  /api/songs/{songId}/arrangements
POST /api/songs/{songId}/arrangements
GET  /api/arrangements/{id}
PUT  /api/arrangements/{id}
```

---

## Sections

```text
GET  /api/songs/{songId}/sections
POST /api/songs/{songId}/sections
```

---

# 49. API RESPONSE STANDARD

Ví dụ:

```json
{
  "ok": true,
  "data": {},
  "meta": {
    "serverTime": 1787554132.120,
    "revision": 184
  }
}
```

Error:

```json
{
  "ok": false,
  "error": {
    "code": "ROOM_NOT_FOUND",
    "message": "Live room not found"
  }
}
```

---

# 50. SECURITY

Room code không nên là quyền admin.

Cần tách:

```text
roomCode
```

và:

```text
hostToken
```

Follower:

```text
?live=BAND-2026
```

Host cần token riêng.

---

# 51. ROOM EXPIRATION

Room tự hết hạn:

```text
4 giờ
8 giờ
12 giờ
```

tránh hàng nghìn room chết tồn tại mãi.

---

# 52. RATE LIMIT

API update state cần throttle.

Ví dụ:

```text
Song change
→ immediate

Section change
→ immediate

Position
→ 4–10 updates/s

Raw scroll
→ không sync
```

---

# 53. KHÔNG GỬI FULL STATE MỖI FRAME

Có thể dùng:

```text
snapshot
```

và:

```text
event
```

Ví dụ:

```json
{
  "type": "POSITION",
  "revision": 185,
  "position": {
    "measure": 22,
    "beat": 1
  }
}
```

---

# 54. SNAPSHOT + EVENTS

Khi join:

```text
GET FULL SNAPSHOT
```

Sau đó:

```text
events
```

Khi reconnect:

```text
GET FULL SNAPSHOT
```

Đây là kiến trúc ổn định.

---

# 55. PHASE 0 — PERFORMANCE PROTOCOL V2

**Mục tiêu:** Chuẩn hóa trước khi code feature mới.

Tasks:

- [ ] Tạo schema `PerformanceStateV2`.
- [ ] Bỏ `scrollTop` khỏi core state.
- [ ] Thêm `measure`.
- [ ] Thêm `beat`.
- [ ] Thêm `sectionId`.
- [ ] Thêm `roadmapStep`.
- [ ] Thêm `revision`.
- [ ] Thêm `serverTime`.
- [ ] Tạo `LiveTransport` interface.
- [ ] Tạo state machine.
- [ ] Viết documentation.

Đây là phase bắt buộc.

---

# 56. PHASE 1 — LIVE SESSION + MUSICAL POSITION

Tasks:

- [ ] Room create.
- [ ] QR Code.
- [ ] One-click join.
- [ ] Host token.
- [ ] Follower mode.
- [ ] Song sync.
- [ ] Transpose sync.
- [ ] Measure sync.
- [ ] Role view giữ local.
- [ ] Reconnect.
- [ ] Revision protection.

Mục tiêu:

```text
Leader đổi bài
→ follower đổi bài

Leader đến Measure 20
→ follower đến cùng Measure 20
```

không phụ thuộc pixel.

---

# 57. PHASE 2 — SYNCHRONIZED COUNT-IN

Tasks:

- [ ] Clock calibration.
- [ ] Transport Clock.
- [ ] Count-in state.
- [ ] WebAudio local scheduler.
- [ ] Visual countdown.
- [ ] Start-at timestamp.
- [ ] Reconnect clock.

---

# 58. PHASE 3 — ARRANGEMENT / SONG ROADMAP

Tasks:

- [ ] `song_sections`.
- [ ] `arrangements`.
- [ ] `arrangement_steps`.
- [ ] Arrangement Editor.
- [ ] Repeat.
- [ ] Jump.
- [ ] Setlist Item → Arrangement.
- [ ] Roadmap cursor.

---

# 59. PHASE 4 — CUE ENGINE

Tasks:

- [ ] Cue schema.
- [ ] Cue banner.
- [ ] Pre-cue.
- [ ] Section change.
- [ ] Vocal entry.
- [ ] Instrument entry.
- [ ] Ending.
- [ ] Modulation warning.
- [ ] Role-based cue presentation.

---

# 60. PHASE 5 — TEMPO MAP + MODULATION

Tasks:

- [ ] Tempo points.
- [ ] Modulation points.
- [ ] Cue before modulation.
- [ ] Chord transpose at runtime.
- [ ] Optional automatic tempo update.
- [ ] Full score modulation chỉ khi renderer đủ ổn định.

---

# 61. PHASE 6 — ROLE PRESETS

Preset:

```text
Leader
Keyboard
Guitar
Bass
Drum
Vocal
Viewer
```

Tasks:

- [ ] View defaults.
- [ ] Cue defaults.
- [ ] Control permissions.
- [ ] Saved local profile.

---

# 62. PHASE 7 — WEBSOCKET TRANSPORT

Chỉ thực hiện sau khi business logic ổn định.

Tasks:

- [ ] `WebSocketTransport`.
- [ ] Connection lifecycle.
- [ ] Heartbeat.
- [ ] Reconnect.
- [ ] Snapshot resync.
- [ ] Event sequence.
- [ ] Load testing.

Nếu thiết kế transport interface đúng từ đầu, phase này không phải sửa Performance Engine.

---

# 63. PHASE 8 — SMART PRACTICE

Sau khi Live Engine ổn định:

- [ ] Loop section.
- [ ] Practice tempo.
- [ ] Start from section.
- [ ] Auto count-in.
- [ ] Practice notes by section.
- [ ] Personal difficulty markers.
- [ ] Rehearsal history.

---

# 64. PHASE 9 — ADVANCED FEATURES

Có thể phát triển sau:

- [ ] MIDI Page Turn.
- [ ] MIDI Clock.
- [ ] Bluetooth pedal mapping.
- [ ] Apple Watch / wearable cue.
- [ ] Haptic cue.
- [ ] Stage display.
- [ ] Confidence monitor.
- [ ] Conductor mode.
- [ ] Multiple leaders.
- [ ] Remote rehearsal.
- [ ] Rehearsal analytics.

---

# 65. UI NGUYÊN TẮC LIVE

Trong lúc biểu diễn:

> Ít thao tác hơn quan trọng hơn nhiều tính năng.

Leader chỉ nên cần:

```text
Next Song
Previous Song
Next Section
Jump Section
Transpose
Count-in
Start
Stop
```

Không mở modal phức tạp giữa bài.

---

# 66. FOLLOWER UI

Follower cần thấy tối thiểu:

```text
📡 LIVE

Song
Key
Tempo

Current Section
Next Section

Cue
```

Ví dụ:

```text
LIVE • BAND-2026

TÔN VINH CHÂN THẦN
Key: G
Tempo: 84

ĐANG:
Điệp khúc

TIẾP:
Dạo giữa

⚡ 2 ô nữa
```

---

# 67. LIVE STATUS

Các trạng thái:

```text
🟢 LIVE
🟡 RECONNECTING
🔴 OFFLINE
```

Không nên che bản nhạc.

---

# 68. PERFORMANCE SAFETY

Mọi automation phải có khả năng tắt.

Ví dụ:

```text
Auto Scroll      ON/OFF
Auto Section     ON/OFF
Auto Tempo       ON/OFF
Auto Modulation  ON/OFF
```

Trong biểu diễn thật, hệ thống không được ép người dùng vào automation không mong muốn.

---

# 69. TESTING BẮT BUỘC

Không test chỉ trên một laptop.

Matrix:

| Device | View |
|---|---|
| Windows Laptop | Full Score |
| iPad | Full Score |
| iPhone | Lyric |
| Android Tablet | Guitar |
| Desktop | Leader |

---

# 70. TEST CASE LIVE SYNC

## Case 1

```text
Leader → Measure 20
iPad → Measure 20
iPhone Lyric → đúng lyric tương ứng
```

---

## Case 2

Leader:

```text
Transpose +2
```

Expected:

```text
Guitar chords update
Leader score update
Vocal lyrics không bị reload không cần thiết
```

---

## Case 3

Network mất 5 giây.

Expected:

```text
Follower vẫn hiển thị sheet
Status = RECONNECTING
Network phục hồi
State resync
Không reload toàn app
```

---

# 71. PERFORMANCE BUDGET

Mục tiêu UX:

```text
Song Switch:
< 500 ms nếu đã preload

Cue:
< 150 ms perceived delay

Position update:
mượt

UI:
60 FPS khi scroll nếu thiết bị cho phép

Network payload:
nhỏ
```

---

# 72. LOGGING

Cần logging cho Live Engine:

```text
room_created
participant_joined
participant_left
song_changed
section_changed
transport_started
transport_stopped
connection_lost
connection_restored
sync_error
```

Không log quá nhiều raw position nếu không cần.

---

# 73. DEBUG PANEL

Dev mode nên có:

```text
Room
Client ID
Role
Revision
Server Offset
RTT
Current Measure
Beat
Section
Roadmap Step
Last Event
Connection State
```

Rất hữu ích cho debug nhiều thiết bị.

---

# 74. MIGRATION TỪ LIVE SYNC HIỆN TẠI

Không xóa ngay code cũ.

Đề nghị:

```text
live-sync.js
     │
     └── Legacy Adapter
              │
              ▼
      Performance Engine V2
```

Từng bước thay thế:

```text
songId
→ giữ

transpose
→ giữ

scrollTop
→ chuyển sang musical position

polling
→ đưa vào PollingTransport
```

---

# 75. QUY TẮC CODE CHO ANTIGRAVITY

Antigravity cần tuân thủ:

1. Không sửa hàng loạt nếu chưa xác định dependency.
2. Không nhét mọi thứ vào `live-sync.js`.
3. Mỗi module một trách nhiệm.
4. UI không chứa business logic.
5. Transport không chứa music logic.
6. Song renderer không chứa room logic.
7. Metronome không phụ thuộc network.
8. Cue Engine không phụ thuộc DOM trực tiếp.
9. State phải versioned.
10. Mọi migration phải backward-compatible nếu có thể.

---

# 76. CẤU TRÚC DEPENDENCY ĐỀ NGHỊ

```text
UI
 │
 ▼
PerformanceEngine
 │
 ├── LiveSession
 │     │
 │     └── LiveTransport
 │
 ├── ArrangementEngine
 │
 ├── CueEngine
 │
 ├── TransportClock
 │
 └── MusicalPosition
       │
       ▼
Music Renderer / Lyric / Chord
```

Không được để:

```text
Music Renderer → LiveTransport
```

hoặc:

```text
Metronome → HTTP API
```

---

# 77. QUY TẮC QUAN TRỌNG NHẤT CHO KIẾN TRÚC

## Rule 1

```text
SYNC MUSIC STATE
NOT SCREEN STATE
```

## Rule 2

```text
SYNC CLOCK
NOT AUDIO TICKS
```

## Rule 3

```text
SONG ≠ ARRANGEMENT
```

## Rule 4

```text
SCORE POSITION ≠ PERFORMANCE ROADMAP
```

## Rule 5

```text
TRANSPORT ≠ BUSINESS LOGIC
```

## Rule 6

```text
ROLE VIEW = LOCAL
PERFORMANCE STATE = SHARED
```

---

# 78. ƯU TIÊN THỰC HIỆN

Thứ tự khuyến nghị:

```text
PHASE 0
Performance Protocol v2
        │
        ▼
PHASE 1
Live Session
+
Musical Position
        │
        ▼
PHASE 2
Count-in
+
Synchronized Clock
        │
        ▼
PHASE 3
Arrangement
+
Roadmap
        │
        ▼
PHASE 4
Cue Engine
        │
        ▼
PHASE 5
Tempo
+
Modulation
        │
        ▼
PHASE 6
Role Presets
        │
        ▼
PHASE 7
WebSocket
        │
        ▼
PHASE 8
Smart Practice
```

---

# 79. NHỮNG VIỆC KHÔNG NÊN LÀM NGAY

Không nên:

- [ ] Auto full-score transpose giữa bài ngay.
- [ ] Chuyển toàn bộ sang WebSocket trước khi chuẩn hóa protocol.
- [ ] Đồng bộ `scrollTop`.
- [ ] Stream audio/metronome tick qua mạng.
- [ ] Nhét roadmap thành một JSON lớn duy nhất về lâu dài.
- [ ] Cho follower thay state leader tùy ý.
- [ ] Phụ thuộc network để xem được sheet.
- [ ] Gắn cue logic trực tiếp vào renderer.
- [ ] Viết lại toàn bộ app.

---

# 80. QUICK WIN

Có thể làm sớm:

### Quick Win 1

Thay:

```text
scrollTop
```

bằng:

```text
measure
```

---

### Quick Win 2

Thêm:

```text
revision
```

vào Live State.

---

### Quick Win 3

Preload toàn bộ Setlist.

---

### Quick Win 4

Thêm:

```text
Current Section
Next Section
```

---

### Quick Win 5

Count-in local bằng WebAudio.

---

# 81. DEFINITION OF DONE — LIVE SYNC V2

Live Sync V2 được xem là hoàn thành khi:

- [ ] Leader tạo room được.
- [ ] Follower join bằng QR/link.
- [ ] Không cần login.
- [ ] Bài đổi đồng bộ.
- [ ] Tông đổi đồng bộ.
- [ ] Measure đồng bộ.
- [ ] Role View giữ độc lập.
- [ ] Reconnect tự động.
- [ ] Network mất không làm mất sheet.
- [ ] Revision chống state cũ.
- [ ] Không sync raw scroll.
- [ ] Có status LIVE / RECONNECTING / OFFLINE.

---

# 82. DEFINITION OF DONE — COUNT-IN

- [ ] Leader bấm Count-in.
- [ ] Tất cả client nhận chung `startAt`.
- [ ] Client tự schedule click local.
- [ ] Visual countdown đồng bộ.
- [ ] Sau count-in chuyển sang Playing.
- [ ] Không stream từng tiếng click qua server.

---

# 83. DEFINITION OF DONE — ROADMAP

- [ ] Một song có nhiều arrangement.
- [ ] Arrangement có nhiều step.
- [ ] Step hỗ trợ repeat.
- [ ] Step hỗ trợ transpose delta.
- [ ] Step hỗ trợ BPM.
- [ ] Step hỗ trợ cue.
- [ ] Setlist Item chọn được arrangement.
- [ ] Leader jump section được.

---

# 84. ĐỊNH HƯỚNG DÀI HẠN

Khi kiến trúc trên hoàn chỉnh, SheetApp có thể phát triển thành:

```text
             SHEETAPP
                 │
        LIVE PERFORMANCE OS
                 │
  ┌──────────────┼───────────────┐
  │              │               │
Practice        Worship         Band
  │              │               │
  ├ Loop         ├ Live Sync     ├ Setlist
  ├ Tempo        ├ Cue           ├ Roles
  ├ Notes        ├ Roadmap       ├ Pedal
  └ History      └ Count-in      └ MIDI
```

Đây là hướng có giá trị hơn rất nhiều so với việc tiếp tục thêm từng tính năng rời rạc.

---

# 85. KẾT LUẬN

Kế hoạch hiện tại **đúng hướng**, nhưng trước khi triển khai toàn bộ cần chuẩn hóa tầng Performance Engine.

Thay đổi quan trọng nhất:

```text
Không đồng bộ PIXEL.
Đồng bộ MUSIC POSITION.
```

Thay đổi quan trọng thứ hai:

```text
Không đồng bộ METRONOME TICK.
Đồng bộ CLOCK.
```

Thay đổi quan trọng thứ ba:

```text
Không xem SONG và ARRANGEMENT là một.
```

Nếu ba nền tảng trên được làm đúng, các chức năng sau:

```text
Live Sync
Count-in
Roadmap
Cue
Multi-tempo
Modulation
Role View
Smart Practice
```

sẽ có thể phát triển độc lập mà không phá kiến trúc cũ.

---

# 86. CHỈ THỊ TRIỂN KHAI CHO ANTIGRAVITY

Antigravity nên bắt đầu bằng:

```text
PHASE 0 — PERFORMANCE PROTOCOL V2
```

Không triển khai đồng thời tất cả chức năng.

Trình tự:

```text
1. Audit code hiện tại.
2. Map dependency.
3. Tạo PerformanceStateV2.
4. Tạo LiveTransport abstraction.
5. Tạo MusicalPosition.
6. Migrate Live Sync hiện tại sang V2.
7. Test đa thiết bị.
8. Chỉ sau khi pass mới sang Count-in.
```

Sau mỗi phase:

```text
CODE
 ↓
TEST
 ↓
DOCUMENT
 ↓
COMMIT
 ↓
NEXT PHASE
```

Không chuyển phase nếu test chưa đạt.

---

**Khuyến nghị cuối cùng:**

> Hãy xây `Performance Engine` thành xương sống của SheetApp.  
> Mọi tính năng Live, Practice, Cue, Roadmap và Role sau này đều chạy trên cùng một mô hình trạng thái âm nhạc thống nhất.

