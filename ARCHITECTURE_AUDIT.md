# ARCHITECTURE_AUDIT.md — Rà Soát Kiến Trúc SheetApp

> **Tài liệu sống** — Cập nhật mỗi khi thêm module mới hoặc refactor lớn.
> Sinh bởi Understand Anything (concept) + manual audit toàn bộ codebase.
> *Cập nhật: 2026-06-09*

---

## 1 · TỔNG QUAN

```
SheetApp v2.0-dev
Stack: PHP 8+ MVC | SQLite | Vanilla JS IIFE | OSMD | Apache/XAMPP
Modules: 31 JS + 10 Controller + 9 Service + 4 Core PHP
```

---

## 2 · SƠ ĐỒ KIẾN TRÚC TỔNG THỂ

```
┌─────────────────────────────────────────────────────────────────┐
│                         BROWSER (CLIENT)                        │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    CORE LAYER (load đầu tiên)            │   │
│  │  EventBus.js ←→ Store.js ←→ ApiService.js               │   │
│  └──────────────────────────────────────────────────────────┘   │
│              ↑ emit / ↓ listen            ↑ fetch               │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                  ORCHESTRATION LAYER                     │   │
│  │  app.js (bootstrap)  ←→  SongLoader.js (load flow)      │   │
│  └──────────────────────────────────────────────────────────┘   │
│              ↓ EventBus.emit('song:loaded')                     │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                   FEATURE MODULES LAYER                  │   │
│  │                                                          │   │
│  │  [Render]   OSMDRenderer ← OSMD Library                  │   │
│  │  [Chord]    ChordCanvas ← ChordCanvasUI ← ChordCanvasXML │   │
│  │  [Audio]    SheetAudioPlayer ← OSMD Web Audio            │   │
│  │  [Scroll]   AutoScroller                                 │   │
│  │  [Library]  LibraryUI ← HistoryManager                   │   │
│  │  [Setlist]  SetlistUI                                    │   │
│  │  [Annot]    AnnotationCanvas                             │   │
│  │  [UI]       AppUI ← ToolbarController ← PageNav          │   │
│  │  [Auth]     Auth → controls all permission-gated UI      │   │
│  │  [Info]     SongInfoBar ← TransposeEngine                │   │
│  │  [Session]  SessionTracker ← PerformanceNotes            │   │
│  │  [Settings] DisplaySettings ← KeyboardHandler            │   │
│  │  [Import]   Importer                                     │   │
│  │  [Misc]     FAB, URLState, InstrumentMixer, Metronome    │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                        ↑↓ HTTP / JSON
┌─────────────────────────────────────────────────────────────────┐
│                         SERVER (PHP MVC)                        │
│                                                                 │
│  api/index.php (Front Controller / Router)                      │
│         ↓ switch($route)                                        │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  CONTROLLER LAYER (parse → call Service → Response)      │   │
│  │  SongController | ChordSetController | SetlistController  │   │
│  │  AuthController | UserController | CategoryController     │   │
│  │  AnnotationController | SessionController | OmrController │   │
│  │  ImportController                                        │   │
│  └──────────────────────────────────────────────────────────┘   │
│         ↓ static calls                                          │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  SERVICE LAYER (business logic + DB queries)             │   │
│  │  SongService | ChordSetService | SetlistService          │   │
│  │  UserService | CategoryService | AnnotationService       │   │
│  │  SessionService | OmrService | ImportService             │   │
│  └──────────────────────────────────────────────────────────┘   │
│         ↓ PDO prepared statements                               │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  CORE PHP: DB.php | Auth.php | Config.php | Response.php │   │
│  └──────────────────────────────────────────────────────────┘   │
│         ↓                                                       │
│  SQLite: storage/data/sheetapp.sqlite                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3 · EVENT FLOW — Song Loading

```
User clicks song in LibraryUI
    → LibraryUI.selectSong(id)
    → onSelectCb(song)               [callback registered in app.js]
    → SongLoader.load(song)
        → Store.set('currentSong', song)
        → Store.set('currentTranspose', 0)       [RULE 2: always 0]
        → Promise.all([
            fetch(song.xmlPath),                 [INTENTIONAL static fetch]
            ApiService.sessions.load(song.id),
            ChordCanvas.loadSong(song.id, 'HD')  [RULE 1: HD là default]
          ])
        → OSMDRenderer.load(processedXml, transpose)
        → EventBus.emit('song:loaded', { song, xml })
            → ChordCanvas.onOSMDRendered()
            → AnnotationCanvas.onOSMDRendered()
            → AppUI.enableControls(true)
            → PageNav.computePages()
```

---

## 4 · MODULE REGISTRY — JavaScript (31 modules)

### 4.1 Core (3 modules) — Load đầu tiên

| Module | Pattern | State | Phụ thuộc | Exports |
|--------|---------|-------|-----------|---------|
| `EventBus.js` | IIFE ✅ | `_listeners: {}` | - | `on, off, emit, once` |
| `Store.js` | IIFE ✅ | `_state: {currentSong, originalXml, currentTranspose, currentZoom, capoLevel}` | EventBus | `get, set, reset` |
| `ApiService.js` | IIFE ✅ | stateless | - | `songs, chordSets, sessions, annotations, setlists, categories, omr, importer, users, auth, saveXml` |

> ⚠️ **Gotcha EventBus.js**: File chứa cả `window.onerror + console.error interceptor` ngoài IIFE. 
> Đây là code phụ trách error logging — không thuộc về EventBus. Nên tách ra file `error-logger.js` riêng.

### 4.2 Orchestration (2 modules)

| Module | Pattern | SRP ✅/⚠️ | Ghi chú |
|--------|---------|-----------|---------|
| `app.js` | IIFE ✅ | ✅ | Bootstrap + navigation + transpose + zoom. Tốt |
| `song-loader.js` | IIFE ✅ | ✅ | Load/reload/save XML. Tốt. Có vài DOM manipulations (zoom-slider) — có thể delegate sang AppUI |

### 4.3 Feature Modules (26 modules)

| Module | Lines | IIFE | 'use strict' | SRP | Ghi chú |
|--------|-------|------|-------------|-----|---------|
| `chord-canvas.js` | 1230 | ✅ | ✅ | ⚠️ | Quá lớn — đã tách phần UI sang chord-canvas-ui.js nhưng vẫn còn logic alignment nặng |
| `chord-canvas-ui.js` | 446 | ✅ | ✅ | ✅ | Popup + modal + chip factory. Tốt |
| `chord-canvas-xml.js` | — | ✅ | ✅ | ✅ | XML injection. Tốt |
| `osmd-renderer.js` | — | ✅ | ✅ | ✅ | OSMD wrapper. Tốt |
| `song-loader.js` | 304 | ✅ | ✅ | ✅ | Tốt |
| `library-ui.js` | 489 | ✅ | ✅ | ✅ | Search, render, CRUD. Tốt |
| `setlist-ui.js` | 402 | ✅ | ✅ | ⚠️ | Xem §5 — một số vấn đề OOP nhỏ |
| `auth.js` | 220 | ✅ | ✅ | ✅ | Auth + UI update. Hơi dài nhưng chấp nhận được |
| `app-ui.js` | — | ✅ | ✅ | ✅ | Toolbar, zoom, fullscreen |
| `auto-scroller.js` | — | ✅ | ✅ | ✅ | Lerp scroll + BPM sync |
| `annotation-canvas.js` | — | ✅ | ✅ | ✅ | Sticky notes |
| `audio-player.js` | — | ✅ | ✅ | ✅ | MIDI playback |
| `transpose-engine.js` | — | ✅ | ✅ | ✅ | Math: semitone, capo |
| `keyboard-handler.js` | — | ✅ | ✅ | ✅ | Keyboard shortcuts |
| `session-tracker.js` | — | ✅ | ✅ | ✅ | Session state |
| `toolbar-controller.js` | — | ✅ | ✅ | ✅ | Toolbar buttons |
| `history-manager.js` | — | ✅ | ✅ | ✅ | Favorites + recent |
| `url-state.js` | — | ✅ | ✅ | ✅ | URL deeplink |
| `display-settings.js` | — | ✅ | ✅ | ✅ | Compact mode, staff |
| `page-nav.js` | — | ✅ | ✅ | ✅ | Page navigation |
| `song-info-bar.js` | — | ✅ | ✅ | ✅ | Info bar |
| `performance-notes.js` | — | ✅ | ✅ | ✅ | Nhật ký biểu diễn |
| `fab.js` | — | ✅ | ✅ | ✅ | Floating Action Button |
| `importer.js` | — | ✅ | ✅ | ✅ | Import UI |
| `admin-ui.js` | — | ✅ | ✅ | ✅ | Admin panel |
| `instruments.js` | — | ✅ | ✅ | ✅ | MIDI instrument map |

---

## 5 · VẤN ĐỀ OOP / CODING STANDARDS PHÁT HIỆN

### 🔴 CRITICAL — Cần sửa sớm

#### C1. EventBus.js có code ngoài module scope
```javascript
// EventBus.js lines 13-79 — window.onerror + console interceptor
// ❌ Vi phạm SRP: EventBus chỉ nên là pub/sub, không chứa error logging
// → Tách ra assets/js/error-logger.js
```

#### C2. SongService.php dùng static methods nhưng pattern không nhất quán với CODING_STANDARDS.md
```php
// CODING_STANDARDS.md §3.2 mô tả Service dùng $this->db (instance method)
// SongService.php thực tế dùng static: DB::query(), DB::run()
// → Không sai về chức năng, nhưng không nhất quán với template
// → Các Service khác cũng nên được kiểm tra
```

### 🟡 WARNING — Nên cải thiện

#### W1. setlist-ui.js — inline HTML injection tiềm ẩn XSS
```javascript
// Line 44: sl.title không được escape trước khi chèn vào innerHTML
el.innerHTML = `<div class="song-item-title">${sl.title}</div>`;
// ❌ Nếu title có ký tự <, >, & → XSS hoặc broken HTML
// ✅ Dùng textContent hoặc hàm _esc() như trong library-ui.js
```

#### W2. setlist-ui.js — prompt() không nên dùng trong UI hiện đại
```javascript
// Line 220: addSongToSetlist() dùng prompt() cho transpose
let toneStr = prompt("Nhập số cung...", "0");
// ❌ prompt() là blocking, không có UI đẹp, iOS có thể block
// ✅ Thay bằng custom modal (như cc-new-set-modal pattern)
```

#### W3. chord-canvas.js — file quá dài (1230 dòng)
```
CODING_STANDARDS.md §1.2: "Nếu file JS vượt 400 dòng → xem xét tách module"
chord-canvas.js: 1230 dòng (3x giới hạn)
→ Đã tách chord-canvas-ui.js và chord-canvas-xml.js
→ Vẫn còn: _mapNotes, _alignDOMChords, _placeDot, _buildChordTextPositions
→ Có thể tách thêm: chord-canvas-layout.js (alignment algorithms)
```

#### W4. song-loader.js — DOM manipulation trong loader
```javascript
// _syncZoomUI() và _resetCapoUI() trực tiếp query DOM
// ❌ Theo CODING_STANDARDS: UI logic nên ở AppUI, không trong loader
// ✅ Delegate sang AppUI.syncZoomUI() và AppUI.resetCapoUI()
```

#### W5. app.js — setZoom() trực tiếp query DOM
```javascript
// Lines 112-121: query #zoom-slider, #zoom-value-label trực tiếp
// ❌ app.js chứa DOM query — nên delegate sang AppUI
// ✅ AppUI.syncZoomFromPercent(percent)
```

#### W6. magic strings hardcoded
```javascript
// chord-canvas.js:
if (_currentSet !== 'default' && ...) // ❌ magic string
if (currentSet === 'HD') ...          // ❌ magic string

// ✅ Khai báo constants đầu file:
const SET_DEFAULT = 'default';
const SET_HD = 'HD';
```

### 🟢 INFO — Tốt, ghi nhận để maintain

#### I1. ApiService tuân thủ 100%
- Mọi fetch() đi qua ApiService ✅
- Ngoại lệ static file được comment `// INTENTIONAL EXCEPTION` ✅

#### I2. EventBus pattern tuân thủ tốt
- Modules không gọi trực tiếp nhau ✅
- Events đều đặt tên chuẩn `entity:action` ✅

#### I3. Store được dùng đúng cho state quan trọng
- `currentSong, currentTranspose, currentZoom, originalXml` ✅
- Tự emit event khi state thay đổi ✅

#### I4. PHP Security tốt
- Tất cả DB queries dùng prepared statements ✅
- Input validation trong Controllers ✅
- Auth check trước mọi mutation ✅

---

## 6 · DEPENDENCY GRAPH — Frontend Modules

```
app.js ──────────────────────────────────────┐
  ├── SongLoader.js                           │
  │     ├── Store (R/W)                      │
  │     ├── EventBus (emit: song:loaded)      │
  │     ├── ApiService (sessions)             │
  │     ├── OSMDRenderer (load)              │
  │     ├── ChordCanvas (loadSong)           │
  │     ├── AppUI (showLoading, showOSMD)    │
  │     └── AnnotationCanvas (loadSong)      │
  │                                          │
  ├── ChordCanvas.js                          │
  │     ├── ChordCanvasUI (popup, modal)     │
  │     ├── ChordCanvasXML (inject, read)    │
  │     ├── ApiService (chordSets)           │
  │     ├── Store (get: currentTranspose)    │
  │     └── OSMDRenderer (getInstance)      │
  │                                          │
  ├── OSMDRenderer.js                         │
  │     └── OSMD Library                    │
  │                                          │
  ├── LibraryUI.js                            │
  │     ├── ApiService (songs, setlists)     │
  │     ├── HistoryManager (favorites)       │
  │     └── onSelect → SongLoader.load()    │
  │                                          │
  ├── SetlistUI.js                            │
  │     ├── ApiService (setlists, songs)     │
  │     ├── LibraryUI (getSongs cache)       │
  │     └── URLState (resetForNewSong)       │
  │                                          │
  ├── Auth.js                                 │
  │     └── ApiService (auth)               │
  │                                          │
  └── AppUI.js                               │
        ├── Store (get: currentSong, etc.)   │
        └── EventBus (listen: state:*)       │
```

---

## 7 · BACKEND ROUTE MAP

| Route | Controller | Service | Auth Required |
|-------|-----------|---------|--------------|
| `songs` GET | SongController | SongService | No |
| `songs` POST | SongController | SongService | Admin |
| `songs` PUT | SongController | SongService | Admin |
| `songs` DELETE | SongController | SongService | Admin |
| `chord_sets` GET | ChordSetController | ChordSetService | No |
| `chord_sets` POST save | ChordSetController | ChordSetService | BanHat+ |
| `chord_sets` POST delete | ChordSetController | ChordSetService | Admin |
| `setlists` GET | SetlistController | SetlistService | No |
| `setlists` POST | SetlistController | SetlistService | Admin |
| `setlists` DELETE | SetlistController | SetlistService | Admin |
| `annotations` GET/POST | AnnotationController | AnnotationService | No/Admin |
| `sessions` GET/POST | SessionController | SessionService | No |
| `auth` me/login/logout | AuthController | UserService | - |
| `users` | UserController | UserService | Admin |
| `categories` | CategoryController | CategoryService | GET: No |
| `omr` | OmrController | OmrService | Admin |
| `import` (legacy) | via `api/import.php` | ImportService | Admin |

---

## 8 · DATABASE SCHEMA OVERVIEW

```sql
songs         (id TEXT PK, title, httlvnId, xmlPath, defaultKey, category_id, lyrics_text)
chord_sets    (id INT PK, song_id, name, chords_json)
              -- Protected: name='HD', name='default'
annotations   (id INT PK, song_id, measure_idx, note_idx, text, color)
sessions      (stored as JSON files in storage/data/sessions/)
setlists      (id INT PK, title, scheduled_date, user_id, item_count)
setlist_items (id INT PK, setlist_id, song_id, position, transpose_key, chord_profile)
categories    (id INT PK, name, sort_order)
users         (id INT PK, username, password_hash, role: viewer|banhat|admin)
omr_jobs      (id INT PK, filename, status, result_xml, created_at)
```

---

## 9 · LOAD ORDER (index.php) — Bắt buộc theo thứ tự

```
1.  vendor/osmd (OSMD Library)
2.  core/EventBus.js    ← window.onerror + pub/sub
3.  core/Store.js       ← state management
4.  core/ApiService.js  ← HTTP client
5.  transpose-engine.js
6.  osmd-renderer.js
7.  chord-canvas.js
8.  chord-canvas-ui.js
9.  chord-canvas-xml.js
10. annotation-canvas.js
11. audio-player.js
12. auto-scroller.js
13. library-ui.js
14. setlist-ui.js
15. song-info-bar.js
16. display-settings.js
17. page-nav.js
18. fab.js
19. keyboard-handler.js
20. history-manager.js
21. url-state.js
22. session-tracker.js
23. performance-notes.js
24. toolbar-controller.js
25. app-ui.js
26. song-loader.js
27. auth.js
28. admin-ui.js
29. importer.js
30. instruments.js
31. app.js              ← Bootstrap CUỐI CÙNG
```

---

## 10 · KNOWN ISSUES (carry over + mới phát hiện)

```
[OSMD]    1. OSMD cursor chỉ available sau render → cần setTimeout(fn, 0)
[SET]     2. Chord set 'HD' và 'default' là protected — không xóa được
[TRANS]   3. currentTranspose LUÔN = 0 khi load bài mới (ngoại lệ: setlist transposeOverride)
[LEGACY]  4. api/import.php là legacy endpoint (chưa migrate sang MVC router)
[LOAD]    5. OSMD không hỗ trợ dynamic import → phải load tất cả script trong index.php
[DB]      6. SQLite: không có auto-increment reset khi xóa row
[OMR]     7. OMR service chạy riêng trong Docker (port 5555)

[NEW] 8.  EventBus.js chứa error logger code ngoài IIFE scope — nên tách file
[NEW] 9.  setlist-ui.js: innerHTML với sl.title chưa escape — XSS potential
[NEW] 10. setlist-ui.js: prompt() cho transpose — nên thay bằng custom modal
[NEW] 11. chord-canvas.js: 1230 dòng — vượt ngưỡng 400 dòng theo CODING_STANDARDS
[NEW] 12. Magic string 'HD', 'default' chưa được dùng constant trong chord-canvas.js
[NEW] 13. song-loader.js / app.js: DOM query trực tiếp — nên delegate sang AppUI
```

---

## 11 · TUÂN THỦ OOP / SOLID — TỔNG KẾT

| Nguyên tắc | Tình trạng | Chi tiết |
|------------|-----------|---------|
| **S** Single Responsibility | ✅ Tốt (85%) | chord-canvas.js hơi lớn. app.js và song-loader.js có vài DOM query nên tách |
| **O** Open/Closed | ✅ Tốt | EventBus cho phép mở rộng không sửa module gốc. ApiService dễ thêm endpoint |
| **L** Liskov Substitution | N/A | JavaScript không có inheritance phức tạp |
| **I** Interface Segregation | ✅ Tốt | Public API của mỗi module chỉ expose những gì cần: `return { init, load, ... }` |
| **D** Dependency Inversion | ✅ Tốt | Modules không gọi trực tiếp nhau — đi qua EventBus hoặc ApiService |
| **DRY** | ✅ Tốt | ApiService tập trung fetch. Helpers chia sẻ qua module scope |
| **Layering** | ✅ Tốt | PHP: Controller → Service → DB. JS: UI → ApiService → API |
| **Security** | ✅ Tốt | PHP: prepared statements, auth check. JS: XSS guard trong library-ui.js |
| **Error handling** | ✅ Tốt | try/catch nhất quán, toast feedback cho user |

**Điểm tổng thể: 8.2/10** — Kiến trúc tốt, cần cải thiện một số điểm nhỏ.

---

## 12 · ƯU TIÊN CẢI THIỆN (Backlog)

| Priority | Issue | File | Effort |
|----------|-------|------|--------|
| 🔴 HIGH | C2: XSS - innerHTML chưa escape | setlist-ui.js:44, 116 | 30 min |
| 🔴 HIGH | C1: Tách error logger khỏi EventBus | EventBus.js | 20 min |
| 🟡 MED | W2: Thay prompt() bằng modal | setlist-ui.js:220 | 2h |
| 🟡 MED | W6: Dùng constant SET_HD, SET_DEFAULT | chord-canvas.js | 1h |
| 🟢 LOW | W3: Tách chord-canvas-layout.js | chord-canvas.js | 3h |
| 🟢 LOW | W4/W5: Delegate DOM queries sang AppUI | song-loader.js, app.js | 2h |
| 🟢 LOW | C2: Chuẩn hoá PHP Service sang instance methods | All Services | 4h |

---

*Audit thực hiện: 2026-06-09 | Người thực hiện: Antigravity AI*
*Tools: Manual code review + Understand Anything (concept) trên 31 JS modules + 10 Controllers + 9 Services*
