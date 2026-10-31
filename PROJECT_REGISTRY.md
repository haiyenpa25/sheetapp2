# PROJECT_REGISTRY.md — Sơ Đồ Dự Án SheetApp

> **AI AGENT: Đọc file này để biết dự án có gì, ở đâu.**
> Cập nhật file này sau mỗi phiên làm việc có tạo/sửa file quan trọng.

---

## 1 · THÔNG TIN DỰ ÁN

```yaml
Tên dự án:   SheetApp — Ứng dụng đọc & biểu diễn bản nhạc
Phiên bản:   v2.0-dev
Ngày tạo:    2026-04-25
Cập nhật:    2026-10-21

Stack:
  Frontend:  Vanilla JS (ES6+ IIFE modules) + OSMD (OpenSheetMusicDisplay)
  Backend:   PHP 8.1+ (MVC: Controller → Service → DB)
  Database:  SQLite (via PDO)
  Server:    LiteSpeed / Apache / Nginx + PHP 8.1
  Deploy:    Chuẩn bị commit trên nhánh, kiểm tra Quality Gate, chủ dự án duyệt rồi merge

Môi trường:
  Dev URL:   https://sheet.hyb.io.vn/
  Prod URL:  https://sheet.hyb.io.vn/
  DB Path:   storage/data/app.sqlite
  OMR URL:   http://localhost:5555 (Docker service)
```

---

## 2 · CẤU TRÚC THƯ MỤC

```
SheetApp/
├── AI_AGENT.md               ← Đọc đầu tiên (quy tắc làm việc & Core Rules)
├── RULE.md                   ← Quy tắc bất biến chống hồi quy (Transpose, Chấm tím +, Android/iPad, UI 6 tính năng, Chương trình khách)
├── CODING_STANDARDS.md       ← Đọc thứ hai (tiêu chuẩn code, EventBus, API)
├── PROJECT_REGISTRY.md       ← File này. Bản đồ dự án (nhật ký cũ: docs/history/CHANGELOG_2026.md)
├── CODE_MAP.md               ← Bản đồ tri thức codebase (tự sinh bởi Gitnexus)
├── ROADMAP.md                ← Roadmap duy nhất đang hiệu lực + luật thực thi (đọc trước khi nhận việc)
├── sync.sh / sync.bat        ← Kiểm cú pháp, sinh SW manifest & CODE_MAP.md (không commit/push)
│
├── index.php                 ← Entry point HTML (PHP partial includes)
├── manager/                  ← Cổng Quản Lý Kho Nhạc & Không Gian Cộng Tác Hợp Âm (/manager/) [NEW 2026-09]
│   ├── index.php             # Dashboard Modular (< 100 dòng) nhúng 12 partials
│   ├── manager.css           # Stylesheet responsive, KPI cards, table & modal
│   ├── manager.js            # Coordinator (< 600 dòng): Tabs, Modals, State
│   ├── partials/             # 12 View Partials: header, hero_kpi, song_picker, tabs_bar, tabs 1-7, modals
│   └── js/                   # Submodules (< 600 dòng): repertoire, categories, upload, community, versions, users, usage, reviews, notifications
├── editor/                   ← Trình biên tập sheet nhạc MusicXML 4 bè SATB (/editor/)
│   ├── index.php             # Giao diện chính của Editor
│   ├── editor.css            # Stylesheet chuyên dụng Studio Dark Mode
│   ├── editor.js             # Coordinator (< 600 dòng): State, OSMD, Save, Event wiring
│   └── js/                   # 9 Submodules (< 600 dòng): export, midi, audio, ai, parser, modifiers, health, drag, ui
├── live-band/                ← Dedicated Live Band & Rehearsal Studio (/live-band/) [NEW 2026-09]
│   ├── index.php             # Giao diện sân khấu Stage Dark Mode cho Ca Trưởng & Ban Nhạc
│   ├── live-band.css         # Stylesheet sân khấu tối ưu tương phản & LED flasher
│   ├── live-band.js          # Coordinator (< 600 dòng): Master-Follower, WakeLock, Count-In, Cue HUD
│   ├── projector.php         # Màn hình máy chiếu nhà thờ Clean Lyrics Projector [NEW]
│   └── js/                   # 6 Submodules (< 600 dòng): stage-room, stage-timer, stage-audio, stage-rehearsal, stage-hud, stage-catalog
├── huong-dan/                ← Trung tâm Hướng dẫn sử dụng toàn diện (/huong-dan/) [NEW 2026-09]
│   ├── index.php             # Ứng dụng cẩm nang tương tác 9 mô-đun chi tiết
│   ├── huong-dan.css         # Stylesheet tài liệu chuyên nghiệp, responsive
│   └── huong-dan.js          # Controller: Live Search, Role Filter, Scroll Spy, FAQ Accordion
├── learn/                    ← Interactive Music Learning Studio (/learn/) [NEW 2026-09]
│   ├── index.php             # Trang chính /learn — Shell + song picker + OSMD
│   └── learn.css             # Stylesheet premium dark cho /learn
├── assets/js/                ← Core JS modules
│   ├── chord-canvas.js       # Multi-Set Chord Manager Coordinator (< 600 dòng)
│   ├── chord-canvas-dots.js  # Staff alignment & SVG dot rendering (< 600 dòng)
│   ├── chord-canvas-transpose.js # Fifths & key transpose calculation (< 600 dòng)
│   ├── chord-canvas-edit.js  # Popup orchestration & undo/redo stack (< 600 dòng)
│   └── learn/                ← JS modules chuyên biệt cho /learn
│       ├── learn-interfaces.js   # Type definitions, LEARN_EVENTS, LEARN_FLAGS
│       ├── learn-store.js        # LearnStore — state namespace cho /learn
│       ├── learn-app.js          # LearnApp — coordinator chính (< 600 dòng)
│       ├── timeline/
│       │   └── chord-timeline-normalizer.js  # Chuyển chord visual→musical
│       ├── transport/
│       │   ├── music-transport.js            # Unified Tone.js Transport
│       │   └── learn-transport-bridge.js     # Beat & measure callbacks (< 600 dòng)
│       ├── harmony/
│       │   ├── voicing-engine.js             # Thuật toán xếp bè hợp âm
│       │   └── learn-satb.js                 # Trích xuất 4 bè SATB từ MusicXML (< 600 dòng)
│       └── ui/
│           ├── chord-card.js                 # Chord info panel (symbol, inversions)
│           ├── virtual-keyboard.js           # Bàn phím Piano ảo
│           ├── learn-score.js                # OSMD score viewer & zoom (< 600 dòng)
│           └── learn-controls.js             # UI event handlers & control binding (< 600 dòng)
├── includes/                 ← PHP view partials
│   ├── toolbar.php           # Top toolbar: audio, scroll, compact controls
│   ├── sidebar.php           # Sidebar: thư viện bài hát & setlist
│   ├── sheet_viewer.php      # Page-bar + OSMD container
│   └── modals.php            # Tất cả modal dialogs (TransposePick, TempoPick, Help...)
│
├── api/                      ← Backend PHP REST API
│   ├── index.php             # Front Controller / Router (switch route)
│   ├── core/                 # Infrastructure — ít thay đổi
│   │   ├── Auth.php          # Session auth helpers (isAdmin, requireLogin...)
│   │   ├── Config.php        # App config (DB_PATH, OMR_ENGINE_URL)
│   │   ├── DB.php            # PDO singleton
│   │   └── Response.php      # JSON response helpers (ok, error, notFound...)
│   ├── controllers/          # Request handlers (parse → Service → Response)
│   │   ├── SongController.php
│   │   ├── ChordSetController.php
│   │   ├── AnnotationController.php
│   │   ├── SessionController.php
│   │   ├── SetlistController.php
│   │   ├── CategoryController.php
│   │   ├── AuthController.php
│   │   ├── UserController.php
│   │   ├── ImportController.php
│   │   └── OmrController.php
│   ├── services/             # Business logic + DB queries
│   │   ├── SongService.php
│   │   ├── ChordSetService.php
│   │   ├── AnnotationService.php
│   │   ├── SessionService.php
│   │   ├── SetlistService.php
│   │   ├── CategoryService.php
│   │   ├── UserService.php
│   │   ├── ManagerService.php          # Facade (< 600 dòng): Quản lý kho, cộng tác hợp âm & bản phối
│   │   ├── ManagerUserHelper.php       # Helper: Phân quyền & tài khoản thành viên
│   │   ├── ManagerRepertoireHelper.php # Helper: Kho bài hát, thể loại & tìm kiếm nhanh
│   │   ├── ReviewService.php           # Phê duyệt hợp âm & visual diff
│   │   ├── PracticeAssignmentService.php # Giao bài & tập bè ca đoàn
│   │   ├── NotificationService.php     # In-app notifications
│   │   ├── NotificationPreferenceService.php # Tùy chọn thông báo đa kênh
│   │   ├── NotificationDeliveryService.php   # Dispatcher kênh webhook/email
│   │   ├── ImportService.php
│   │   └── OmrService.php
│   ├── omr_worker.php        # OMR background worker (Audiveris / OEMER)
│   ├── import_helpers.php    # Helper functions cho import
│   └── import_scrapers.php   # Web scraper logic
│
├── assets/
│   ├── css/
│   │   ├── sheet.css         ← CSS chính: OSMD viewer, song info strip, chord overlay
│   │   ├── base.css          ← CSS nền tảng: typography, reset, variables
│   │   ├── layout.css        ← Layout: sidebar, toolbar, responsive drawer
│   │   └── components.css    ← UI components: buttons, inputs, modal dialogs
│   └── js/
│       ├── core/             # Load đầu tiên, toàn bộ app phụ thuộc
│       │   ├── ApiService.js # Centralized HTTP client (mọi fetch đi qua đây)
│       │   ├── EventBus.js   # Pub/Sub — giao tiếp giữa modules
│       │   ├── Store.js      # Centralized state (currentSong, transpose, zoom)
│       │   └── ServiceWorkerManager.js # PWA offline caching & service worker lifecycle
│       │
│       ├── core/ControlDeck.js # Nút proxy (data-deck-target) phản chiếu trạng thái điều khiển gốc; ẩn theo quyền (Soạn)
│       ├── app.js            # App bootstrap + init sequence
│       ├── app-ui.js         # UI state: toolbar, FAB, fullscreen
│       ├── song-loader.js    # Load bài: fetch XML, init modules
│       ├── osmd-renderer.js  # OSMD wrapper: render, zoom, cursor
│       ├── chord-canvas.js   # Chord overlay core (set management)
│       ├── chord-canvas-ui.js # Chord popup + smart suggest UI
│       ├── chord-canvas-xml.js # XML chord injection
│       ├── annotation-canvas.js # Sticky note annotations
│       ├── audio-player.js   # MIDI playback (OSMD Web Audio)
│       ├── auto-scroller.js  # Lerp scroll + BPM sync
│       ├── metronome.js      # Máy đếm nhịp Pro Web Audio + TAP tempo
│       ├── transpose-engine.js # Math: semitone, capo, enharmonic
│       ├── library-ui.js     # Song list + search + favorites
│       ├── setlist-ui.js     # Setlist Facade & Coordinator (< 400 dòng)
│       ├── setlist-list.js   # Setlist CRUD, lọc tìm kiếm & chọn set (< 400 dòng)
│       ├── setlist-detail.js # Chi tiết bài hát trong set, reorder, metadata (< 400 dòng)
│       ├── setlist-player.js # Phát tuần tự, next/prev, đồng bộ BPM (< 400 dòng)
│       ├── service-plan-ui.js # Soạn thảo & điều phối Chương trình Phụng vụ (< 400 dòng)
│       ├── session-tracker.js # Buổi chơi tracker
│       ├── performance-notes.js # Nhật ký biểu diễn per-song
│       ├── song-info-bar.js  # Info bar: key, tempo click, quick save, setlist
│       ├── live-sync.js      # Realtime Band Sync (Host / Client)
│       ├── display-settings.js # Compact mode, staff visibility
│       ├── page-nav.js       # Page navigation controls
│       ├── keyboard-handler.js # Keyboard shortcuts
│       ├── history-manager.js # Favorites + recently viewed
│       ├── url-state.js      # URL deeplink ?song=ID
│       ├── fab.js            # Floating Action Button (draggable)
│       ├── toolbar-controller.js # Toolbar button logic
│       ├── admin-ui.js       # Admin panel (users, categories)
│       ├── importer.js       # Import UI (URL, upload, OMR)
│       ├── auth.js           # Auth UI (login/logout)
│       ├── lyric-extractor.js # Lyric extraction utilities
│       └── instruments.js    # MIDI instrument mapping
│
├── storage/                  ← Không commit vào git
│   ├── data/app.sqlite       # SQLite database (Single Source of Truth duy nhất)
│   ├── xml/                  # MusicXML files của các bài
│   ├── omr/                  # OMR uploaded images & output
│   └── logs/                 # PHP error logs
│
├── docs/                     ← Tài liệu chi tiết theo tính năng
├── tools/                    ← CLI scripts (init DB, migrate)
└── omr-service/              ← Python/Docker OMR service
```

---

## 3 · FILE REGISTRY — CÁC FILE QUAN TRỌNG

### Backend Core (`api/core/`)

| File | Mô tả | Thay đổi khi nào |
|------|-------|-----------------|
| `Auth.php` | Session auth: `isAdmin()`, `requireLogin()`, `userId()` | Thêm role mới |
| `Config.php` | Config: `DB_PATH`, `OMR_ENGINE_URL` | Thêm config key |
| `DB.php` | PDO singleton: `DB::get()`, test inject `setPdo()` | Ít khi |
| `Response.php` | JSON helpers: `ok()`, `error()`, `notFound()`, `forbidden()` | Ít khi |

`RotatingLog.php` ghi log có khóa chung, giới hạn 5 MiB/file và giữ 3 bản xoay vòng. `DB::hasTable/hasColumn` dùng cache theo PDO và SQLite schema_version.

### Backend Controllers (`api/controllers/`)

| Controller | Route | Methods | Gọi Service |
|------------|-------|---------|-------------|
| `SongController` | `songs` | GET, POST, PUT, DELETE | `SongService` |
| `ChordSetController` | `chord_sets` | GET, POST | `ChordSetService` |
| `AnnotationController` | `annotations` | GET, POST | `AnnotationService` |
| `SessionController` | `sessions` | GET, POST | `SessionService` |
| `SetlistController` | `setlists` | GET, POST, DELETE | `SetlistService` |
| `CategoryController` | `categories` | GET, POST, PUT, DELETE | `CategoryService` |
| `AuthController` | `auth` | GET (me), POST (login/logout) | `UserService` |
| `ClientLogController` | `client_log` | POST (Origin/CSRF, ≤8 KiB, hạn mức IP) | `ClientLogService` |
| `UserController` | `users` | GET, POST, PUT, DELETE | `UserService` |
| `ImportController` | `import` | POST | `ImportService` |
| `OmrController` | `omr` | GET, POST, DELETE | `OmrService` |
| `LearningController` | `learning` | GET, POST | `LearningService` |
| `PracticeController` | `practice` | GET, POST | `PracticeService` |
| `LiveSyncController` | `live_sync` | GET, POST | `LiveSyncService` |
| `ArrangementController` | `arrangements` | GET, POST, PUT, DELETE | `ArrangementService` |
| `ManagerController` | `manager` | GET, POST | `ManagerService` và các helper |
| `NotificationController` | `notifications` | GET, POST | `NotificationService` |
| `PracticeAssignmentController` | `practice_assignments` | GET, POST | `PracticeAssignmentService` |
| `ExportController` | `export` | GET | `ChordProService`; kiểm cờ EXPORT_CHORDPRO |
| `ReviewController` | `reviews` | GET, POST | `ReviewService` |
| `NotificationPreferenceController` | `notification_preferences` | GET, POST | `NotificationPreferenceService` |

### Learn Studio Modules (`assets/js/learn/`)

| Module | File | Vai trò |
|--------|------|---------|
| Core App | `learn-app.js` | Bootstrap controller, song loading, OSMD render |
| State | `learn-store.js` | Isolated state namespace (LearnStore) |
| Interfaces | `learn-interfaces.js` | Types, LEARN_EVENTS, LEARN_FLAGS |
| Timeline | `timeline/chord-timeline-normalizer.js` | Chuẩn hóa tọa độ visual sang nhạc lý (Trái tim /learn) |
| Transport | `transport/music-transport.js` | Tone.Transport unified clock, ticker, count-in |
| Patterns | `accompaniment/pattern-library.js` | Thư viện mẫu đệm 4/4, 3/4, 6/8, Organ |
| Voicing | `harmony/voicing-engine.js` | Smooth voice leading, nearest inversion, slash bass |
| Audio | `audio/learn-sound-engine.js` | Polyphonic Web Audio synths (Piano, Bass, Organ) |
| Scheduler | `accompaniment/pattern-engine.js` | Lên lịch phát đệm tự động theo ô nhịp và hợp âm |
| Looper | `practice/loop-controller.js` | A/B looping, sections, tempo ladder (50%-110%) |
| Tracker | `practice/practice-tracker.js` | Theo dõi phiên tập client-first, batch sync server |
| Virtual Keyboard | `ui/virtual-keyboard.js` | Bàn phím piano ảo C3-B6, highlight RH/LH/Next |
| Chord Card | `ui/chord-card.js` | Hiển thị hợp âm, thế đảo, nghe nốt, xem trước |

### Frontend Core (`assets/js/core/`)

| File | Public API | Phụ thuộc |
|------|-----------|-----------|
| `ApiService.js` | `songs`, `chordSets`, `sessions`, `annotations`, `setlists`, `categories`, `omr`, `importer`, `users`, `auth`, `saveXml` | - |
| `EventBus.js` | `on(event, handler)`, `off()`, `emit(event, data)`, `once()` | - |
| `Store.js` | `get(key)`, `set(key, val)`, `reset(keys)` | `EventBus` |
| `PointerTap.js` | `bind(element, handler)`; phân biệt tap với kéo/hủy pointer | DOM Pointer Events |

### Frontend Modules (`assets/js/`)

| File | Chức năng chính | Emit events | Lắng nghe events |
|------|-----------------|-------------|-----------------|
| `app.js` | Bootstrap, init order | `transpose:changed` | `song:selected` |
| `song-loader.js` | Fetch XML, init song | `song:loaded`, `song:cleared` | `song:selected` |
| `osmd-renderer.js` | Render OSMD SVG | - | `song:loaded`, `zoom:changed` |
| `chord-canvas.js` | Chord overlay | `chord:saved` | `song:loaded`, `transpose:changed` |
| `audio-player.js` | MIDI playback | - | `song:loaded` |
| `auto-scroller.js` | Lerp scroll | - | `song:loaded` |
| `metronome.js` | Web Audio Metronome & TAP | `metronome:bpm` | `song:loaded` |
| `song-info-bar.js` | Tông, Tempo tương tác, Lưu Setlist | `tempo:changed` | `song:loaded`, `transpose:changed`, `metronome:bpm` |
| `setlist-ui.js` | Setlist UI, chọn Tông & Tempo tập | `setlist:changed` | `song:loaded` |
| `library-ui.js` | Song list UI | `song:selected` | - |
| `app-ui.js` | Toolbar, zoom, fullscreen | `transpose:changed`, `zoom:changed` | `song:loaded` |

### Live Band & Performance Modules (`assets/js/performance/`)

| File | Chức năng chính | Ghi chú |
|------|-----------------|---------|
| `live-transport.js` | Quản lý kết nối transport polling, heartbeat, presence roster | Tự động phát sinh UUID và emit `roster`, `state` |
| `ambient-pad-engine.js` | Bộ tổng hợp âm Ambient Pad Drone Web Audio (Root + 5th) | Smooth Crossfade 4s, hỗ trợ In-Ear Stereo Split |
| `pedal-midi-engine.js` | Bàn đạp chân Bluetooth (AirTurn/PageFlip/Donner) & Web MIDI | Lắng nghe phím và MIDI CC64, hiển thị Toast phản hồi |
| `musical-position.js` | Ánh xạ vị trí ô nhịp (Measure mapping) cho OSMD | Cuộn chuẩn xác đa kích thước màn hình |
| `count-in-engine.js` | Bộ đếm nhịp vào bài 4 phách (Visual & Web Audio Synth) | Tần số kép 920Hz / 540Hz |
| `cue-engine.js` | Quản lý phát lệnh sân khấu Neon Banner | Cues: Điệp khúc, Cao trào, Nhỏ dần, Lặp lại |
| `stage-ink-engine.js` | Động cơ bút vẽ Apple Pencil & Vector Ink đồng bộ thời gian thực | Hỗ trợ Pen, Highlighter, Eraser, Catmull-Rom |
| `qr-helper.js` | Vẽ mã QR Code kích thước tùy biến lên HTML5 Canvas | Hỗ trợ full màn hình để quét nhanh |

---

## 4 · API CONTRACT

### Tất cả endpoints qua `api/index.php?route=<name>`

| Route | Method | Params/Body | Response | Ghi chú |
|-------|--------|-------------|----------|---------|
| `songs` | GET | - | `{data: Song[]}` | Danh sách bài |
| `songs` | GET | `?lyric_search=q` | `{data: Song[]}` | Tìm theo lời |
| `songs` | GET | `?id=X` | `{data: Song}` | Chi tiết 1 bài |
| `songs` | POST | `{title, xmlPath, ...}` | `{data: Song}` | Thêm bài |
| `songs` | PUT | `?id=X` + body | `{data: Song}` | Cập nhật |
| `songs` | PUT | `?action=save_xml&id=X` | `{success}` | Lưu XML |
| `songs` | DELETE | `?id=X` | `{success}` | Xóa bài |
| `chord_sets` | GET | `?action=list&songId=X` | `{success, sets: string[]}` | Danh sách set được đọc |
| `chord_sets` | GET | `?action=load&songId=X&name=N` | `{success, chords, checksum}` | Load set theo quyền |
| `chord_sets` | POST | `{action:save, songId, name, chords}` | `{success}` | Lưu set |
| `chord_sets` | POST | `{action:delete, songId, name}` | `{success}` | Xóa set |
| `annotations` | GET | `?action=load&songId=X` | `{data: Annotation[]}` | Load ghi chú |
| `annotations` | POST | `{action:save, songId, annotations:[]}` | `{success}` | Lưu ghi chú |
| `sessions` | GET | `?songId=X` | `{data: Session}` | Load session |
| `sessions` | POST | `{songId, userSettings}` | `{success}` | Lưu settings |
| `sessions` | POST | `{songId, perfNotes}` | `{success}` | Lưu perf notes |
| `setlists` | GET | - | `{data: Setlist[]}` | Tất cả setlist |
| `setlists` | GET | `?id=X` | `{data: Setlist}` | 1 setlist |
| `setlists` | POST | `{name, ...}` | `{data: Setlist}` | Tạo setlist |
| `setlists` | POST | `?action=add_item` + `{setlist_id, song_id, order_index, chord_profile, transpose_key, bpm, beats_per_measure}` | `{success}` | Thêm bài vào setlist kèm Tông và Tempo |
| `setlists` | PATCH / POST | `?action=update_item&id=X` + `{bpm, beats_per_measure, transpose_key, chord_profile}` | `{success}` | Cập nhật thông số tập (Tông, Tempo) của bài trong setlist |
| `setlists` | DELETE | `?id=X` | `{success}` | Xóa setlist |
| `setlists` | DELETE | `?action=remove_item&id=X` | `{success}` | Xóa item |
| `categories` | GET | - | `{data: Category[]}` | Danh mục |
| `auth` | POST | `?action=login` + `{username, password}` | `{data: User}` | Đăng nhập |
| `auth` | GET | `?action=me` | `{data: User}` | User hiện tại |
| `auth` | POST | `?action=logout` | `{success}` | Đăng xuất; GET trả 405 |
| `omr` | GET | - | `{data: OmrJob[]}` | Danh sách OMR jobs |
| `omr` | POST | FormData (image) | `{data: OmrJob}` | Upload ảnh OMR |
| `omr` | DELETE | `?id=X` | `{success}` | Xóa OMR job |
| `songs` | GET / HEAD | `?action=version_xml&version_id=X` | MusicXML / body rỗng | Kiểm quyền bài và phiên bản; private, no-store |
| `live_sync` | GET / POST | `room`, `rev`; action create/close hoặc cập nhật state | `{success, ...}` | Host token, polling/SSE |
| `arrangements` | GET / POST / PUT / DELETE | `song_id`, `id`, action theo controller | `{success, ...}` | Đoạn/bản phối |
| `manager` | GET / POST | `action` theo ManagerController | `{success, ...}` | Kho nhạc, bộ hợp âm, thành viên |
| `notifications` | GET / POST | list/unread/read theo action | `{success, ...}` | Cờ NOTIFICATIONS_INAPP |
| `practice_assignments` | GET / POST | action và assignment ID | `{success, ...}` | Cờ PRACTICE_ASSIGNMENTS |
| `export` | GET | `song_id`, `format` | File xuất | Cờ EXPORT_CHORDPRO cho mọi định dạng |
| `reviews` | GET / POST | action và target | `{success, ...}` | Cờ REVIEW_WORKFLOW; submit không tạo/chiếm bộ |
| `notification_preferences` | GET / POST | action get/save | `{success, ...}` | Tùy chọn cá nhân |

### Response format

`Response::ok()` ghép `success: true` với các trường truyền vào; controller có thể dùng `data`, `sets`, `chords` hoặc trường trực tiếp. Kiểm contract tại controller và ApiService trước khi dùng `.data`.

```javascript
// Thành công
{ "success": true, "data": T }

// Lỗi
{ "success": false, "error": "Mô tả lỗi bằng tiếng Việt" }
```

---

## 5 · DATABASE SCHEMA (SQLite)

### Bảng chính

| Bảng | Cột quan trọng | Ghi chú |
|------|---------------|---------|
| `songs` | `id, title, httlvnId, xmlPath, category_id, defaultKey, visibility, is_public, created_by` | Tên cột camelCase được giữ theo schema thật |
| `user_chord_sets` | `id, song_id, user_id, username, set_name, chords_json, is_public, checksum` | HD/TLH/default được bảo vệ cả khi gọi bằng alias |
| `setlists` | `id, title, created_by, scheduled_date, status, leader_user_id` | Header chương trình |
| `setlist_items` | `id, setlist_id, song_id, display_order, chord_profile, transpose_key, bpm, beats_per_measure, selected_verses` | Tông và tempo tập |
| `categories` | `id, name, slug, icon, description, display_order, visibility` | Danh mục bài; `visibility`: public/private/admin_only (migration 017) |
| `users` | `id, username, password_hash, role, email, quiet_hours_start, quiet_hours_end` | `role: 'admin'\|'leader'\|'bannhac'\|'banhat'\|'viewer'` |
| `omr_workspace` | `id, original_filename, status, musicxml_path, created_at` | OMR processing queue |
| `domain_events` | `id, type, actor_user_id, subject_type, subject_id, payload_json` | Event log nội bộ phục vụ fan-out |
| `notifications` | `id, user_id, event_id, title, body, link, read_at` | Trung tâm thông báo trong app |
| `notification_preferences` | `user_id, event_type, channel, enabled` | Tùy chọn đa kênh theo người dùng |
| `notification_deliveries` | `id, notification_id, user_id, channel, status, attempts, sent_at` | Hàng đợi chuyển phát (queued/sent/failed/skipped) |
| `practice_assignments` | `id, setlist_id, song_id, created_by, title, due_at, status` | Bài tập ca đoàn |
| `practice_assignment_targets`| `assignment_id, user_id, voice_part, status, completed_at` | Mục tiêu luyện tập phân công theo ca viên |
| `review_requests` | `id, target_type, target_id, song_id, submitted_by, reviewer_id, status` | Hàng đợi phê duyệt hợp âm/MusicXML |
| `chord_set_history` | `id, song_id, set_name, chords_json, created_by, review_request_id` | Lịch sử phục vụ rollback HD |
| `song_versions` | `id, song_id, user_id, username, version_name, xml_path, is_public` | XML riêng qua API có kiểm quyền |
| `service_plan_assignments` | `id, setlist_id, user_id, role, status` | Phân công chương trình |

Ghi chú nằm trong `storage/data/annotations/*.json`; settings/notes theo user và bài ở `storage/data/sessions/*.json`. Không có bảng SQL `annotations`/`sessions`. Unique index `users_chord_code_unique` trên `UPPER(TRIM(chord_code))` (bỏ mã rỗng) được tạo bằng tool apply đã duyệt; không tự áp dụng trên bản cài khác.

---

## 6 · KNOWN ISSUES & GOTCHAS

> Ghi lại để AI không mắc lại lần sau

```
1. OSMD cursor chỉ available sau render xong
   → Phải wrap trong setTimeout(fn, 0) hoặc dùng OSMD callback

2. Chord set 'HD' và 'default' là protected — không xóa được
   → Luôn check trước khi show nút xóa: set !== 'HD' && set !== 'default'

3. Khi load bài mới: currentTranspose LUÔN reset về 0
   → Không restore từ session, không restore từ localStorage
   → Ngoại lệ: setlist item có transposeOverride riêng

4. import.php là legacy endpoint (chưa migrate sang MVC router)
   → ApiService.importer gọi trực tiếp 'api/import.php', không qua api/index.php

5. OSMD không hỗ trợ dynamic import → phải load tất cả script trong index.php
   → Thứ tự load quan trọng: core/ trước, feature modules sau

6. SQLite: không có auto-increment reset khi xóa row
   → ID tiếp theo tiếp tục tăng, không bắt đầu lại từ 1

7. OMR service chạy riêng trong Docker (port 5555)
   → Nếu Docker chưa chạy, mọi OMR call sẽ fail — cần handle gracefully
```

---

## 7 · ARCHITECTURE DECISION RECORDS

| Quyết định | Lý do | Thay thế đã loại bỏ |
|------------|-------|---------------------|
| Vanilla JS (không React/Vue) | OSMD là vanilla lib, không cần build pipeline, đơn giản hơn | React quá phức tạp cho use case này |
| IIFE module pattern | Không có bundler → tránh global pollution | ES Modules (import/export) cần bundler |
| EventBus cho inter-module | Decoupling: module không import nhau trực tiếp | Gọi trực tiếp giữa modules → coupling chặt |
| SQLite | Đơn giản, không cần server DB riêng | MySQL (overkill cho use case nhỏ) |
| 1 CSS file (sheet.css) | Tránh CSS phân mảnh, dễ quản lý | Nhiều file CSS → import order phức tạp |
| PHP MVC (Controller+Service) | Tách business logic khỏi HTTP layer | Flat PHP files → business logic rải rác |
| ApiService tập trung fetch() | Dễ mock, dễ đổi URL, dễ add retry/auth header | fetch() rải rác trong mỗi module |

---

## 8 · LOAD ORDER TRONG index.php

> Thứ tự script quan trọng — vi phạm gây lỗi "X is not defined"

```
1. Vendor OSMD/Tonal (defer); Tone/SATB tải theo nhu cầu.
2. Inline cache/features → idb-keyval, OfflineVault, ScriptLoader, FeatureFlags.
3. SafeHtml, PointerTap, KeyService, ApiService, EventBus, Store.
4. Core cache/modal/mode/shell/verse/tempo/audio/MIDI/loader/error/SW/offline helpers.
5. Renderers, transpose, session-tracker, auth, history, URL state (defer).
6. Modals, library/search/navigation, chương trình/setlist, importer/admin, display/lenses.
7. Chord XML/UI/transpose/dots/edit → chord-canvas coordinator; annotation helpers → canvas.
8. Notes, instruments, audio, metronome, scroller, page-nav, app-ui, song-info-bar.
9. LiveSync adapter và FollowLeader; performance engine tải qua ensureLoaded().
10. SongPreloader, SongLoader, keyboard, toolbar, mobile, app.js, fab.js.
```

---

## 9 · NHẬT KÝ CẬP NHẬT

> Chỉ giữ 5 mục mới nhất. Nhật ký đầy đủ: `docs/history/CHANGELOG_2026.md`. Khi thêm mục mới, đưa mục cũ nhất ở đây sang file đó.

## 2026-10-31 — Menu danh sách bài biến mất khi gõ tìm trên máy tính bảng Android + chống phiên bản cũ bị giữ cache

- Nguyên nhân: bàn phím ảo Android bắn `resize` (chỉ đổi chiều cao, đôi máy còn bắn `orientationchange` giả) → `toolbar-controller.js` coi là xoay màn hình và đóng sidebar. Modern: chỉ xử lý `resize` khi bề rộng đổi ≥100px, bỏ qua khi đang focus ô nhập. Classic (`old/assets/js/toolbar-controller.js`): `orientationchange` chờ 400ms, chỉ đóng sidebar khi bề rộng thật sự đổi và không đang nhập liệu.
- Cache: module tải lười qua `ScriptLoader` trước đây dùng URL trần (máy chủ cho hạn 1 năm + Cloudflare) nên giữ bản cũ. Nay thêm `?v=` lấy từ `window.__ASSET_V__` (`includes/asset_version.php` = mtime mới nhất của `assets/js/**` + file vào); `index.php`, `old/index.php`; Quản lý (`manager/index.php`, `mgrAssetV()`) và trang in dùng `?v=` theo mtime. KHÔNG nâng phiên bản SW v5→v6 vì sẽ xoá gói offline Chủ nhật của người dùng; URL đã có version nên không cần xoá cache Cloudflare.
- Test mới `tests/android_keyboard_sidebar_regression.php` + `tests/js/android_keyboard_sidebar.cjs` (25 check, đã kiểm đột biến: chạy trên mã HEAD thì FAIL). Sinh lại manifest SW và `.gz`.
- Lưu ý chủ dự án: `LibrarySyncService` (nút "Đồng bộ GitHub") chạy `git add/commit/push` từ yêu cầu web.

## 2026-10-30 (b) — Sửa Tông trên điện thoại, Ghi chú ban nhạc + ghi chú theo nhạc cụ (dấu +), Toàn màn hình, header điện thoại (Modern + Classic)

- Header điện thoại: Classic ≤480px dùng `display:contents` cho `.toolbar-controls`, mọi nút 40px, mỗi hàng giãn kín chiều ngang như lưới (giữ đủ 10 điều khiển, 3 hàng; cụm Tông/Zoom có khung), không tràn ở 360/390/430px (`old/assets/css/control-deck.css`). Modern ≤680px: thứ tự ☰ · tên bài · Ghi chú · ⋯, nút phẳng (`instrument-annotations.css`).
- Tông (Modern, điện thoại): toast "info" nằm đè lên thanh `− Tông +` ở đáy ~4 giây sau khi mở bài nên chạm đầu tiên bị nuốt. Toast điện thoại chuyển lên đầu màn hình, `pointer-events:none` (chỉ nút × nhận chạm) — `library-polish.css`.
- Toàn màn hình (Modern, điện thoại): luật ẩn `.mobile-thumb-bar` bị `display:grid !important` của `control-deck.css` thắng nên thanh đáy che HUD biểu diễn; thêm luật ưu tiên cao hơn.
- Ghi chú (2 loại, một nút "Ghi chú" — chấm cam khi bài có ghi chú): ① **Ghi chú bài cho ban nhạc** dùng chung (điệu, tempo 20–300, lời dặn; ai cũng xem, thành viên sửa) lưu `bandNote` trong `storage/data/annotations/<bài>.json`, action `band_note_save`. ② **Ghi chú theo nhạc cụ**: chọn nhạc cụ → "＋ Ghi chú" → chạm dấu + trên bản nhạc (như soạn hợp âm); chip bật/tắt từng nhạc cụ, "Tất cả", "Ẩn hết"; thanh nổi "Đang ghi: … ✓ Xong". Quyền (chủ dự án chọn 2026-10-30): POST `annotations` từ Admin → **Ban Hát trở lên**; máy chủ gắn `createdBy/author`, thành viên chỉ sửa/xóa ghi chú của mình (403), Admin sửa tất cả; danh mục/màu nhạc cụ vẫn chỉ Admin. Ghi chú cũ không có tác giả chỉ Admin sửa. Classic mở cùng panel qua `#btn-toolbar-notes` (nút gốc ẩn nhưng khối giữ lại vì popover nằm trong). Panel `#perf-notes-panel` (sửa lỗi phải bấm 2 lần) đổi thành **Ghi chú cá nhân** (chỉ mình bạn thấy), bỏ thẻ nhạc cụ; `perfNotes.instruments` cũ vẫn được giữ khi lưu.
- Nút Toàn màn hình (cả hai giao diện): iPhone Safari không có Fullscreen API nên `ModeManager._requestFullscreen` gọi `resetToView()` → bấm không có tác dụng; nay thử chuẩn → `webkitRequestFullscreen` (iPad cũ) → nếu không được thì giữ chế độ bằng CSS và cuộn 1px thu thanh địa chỉ; chỉ tự thoát khi người dùng rời toàn màn hình THẬT đã vào. Classic (`old/assets/js/app-ui.js`) trước đây chỉ bật lớp CSS, nay xin toàn màn hình thật cùng dự phòng; header điện thoại (luật `display:flex !important` của đợt sửa header) và `#song-info-strip` bị ẩn khi toàn màn hình. Kiểm bằng Chromium: vào/thoát bằng nút và bằng thao tác thoát của trình duyệt, iPhone (giả lập không API) + iPad, cả hai giao diện.
- Thư viện "hay tải lại, tải lâu" (đo bằng Chromium + log lỗi thật `storage/logs/client_errors.log`): (1) SW mới `skipWaiting` → `controllerchange` → `location.reload()` giữa lúc đang xem, mỗi lần đổi mã (nhiều lần/ngày) — bỏ tự reload (`ServiceWorkerManager.js`; test M2-2 cập nhật theo). (2) Mỗi lần cập nhật SW tải lại ~150 file (≈3,6 MB gồm vendor) thẳng từ máy chủ gốc — nay `PRECACHE_FILE_HASH` (sinh bởi `tools/generate_sw_manifest.php`, 1 dòng JSON) cho phép chép file không đổi từ cache cũ, file đổi tải theo URL `?swv=<hash file>` (Cloudflare giữ được); HTML/danh mục dùng lại bản gần nhất (vốn network-first). Đo: cập nhật 0 request, < 1 giây. (3) Toast "Đã xảy ra lỗi · Tải lại" hiện với mọi lỗi kể cả script Zalo chèn (`zaloJSV2` trong log), Script error, AbortError, mất mạng — nay chỉ lỗi trong `assets/js/` của app (`ErrorReporter.js`). (4) Watchdog 8 giây báo "Ứng dụng chưa tải xong · Tải lại" khi mạng chậm — nay chờ tiếp (tối đa 45 giây) khi trang còn đang tải và không có script hỏng (`BootRunner.js`). (5) Nút đổi giao diện gọi `URLState.interfaceUrl` khi JS cũ chưa có hàm (lỗi thật 20 và 24/10) — kiểm `typeof` trước. (6) Khách gọi `setlists` → 401 đỏ mỗi lần mở app — bỏ (`library-ui.js`, tải lại khi `auth:changed`). Giao diện thư viện điện thoại: rộng `min(440px, 100vw − 44px)` (tên bài 174→200px Modern, ~125→168px Classic), bỏ nhãn "Nhảy nhanh", Classic ẩn nút Quản lý với khách. Test `tests/library_reload_and_speed_regression.php` (17 check, có chạy JS thật cho ErrorReporter/BootRunner).
- Dấu ghi chú chỉ vẽ khi người dùng đã mở panel/bật lớp (không làm rối bản nhạc mặc định); dữ liệu ghi chú luôn tải cùng bài (nhẹ, có cache) để hiện chấm báo.
- Test mới `tests/mobile_tone_and_instrument_notes_regression.php`, `tests/annotation_member_notes_regression.php` (19 check: tác giả do máy chủ gắn, chặn sửa/xóa của người khác, ghi chú chung không mất khi lưu nhạc cụ và ngược lại, tempo, 409); cập nhật khẳng định nhãn ở `library_r32`. Kiểm bằng Chromium (điện thoại/iPad, khách + thành viên giả lập, lệnh lưu bị chặn bắt): lưu ghi chú chung, chọn Trống, 116 dấu +, ghi "Fill" hiện nhãn đúng — cả hai giao diện. **Chưa commit.**

## 2026-10-30 — Một combobox danh mục, hệ cỡ/icon đồng nhất, thêm bài có sửa tên (Modern + Classic + Quản lý)

- Danh mục: dải chip nhiều hàng (`#category-flat-list`, `.cat-flat-btn`) bị **gỡ khỏi cả hai giao diện**, thay bằng MỘT combobox `#category-filter` (nhãn "Tên · số bài", thêm "· nội bộ" cho danh mục không công khai, tự ẩn khi chỉ có 1 danh mục). Nhãn "Lọc" (Modern) chỉ đếm dịp lễ/chủ đề; chọn danh mục thì `#song-list.cat-filtered` ẩn nhãn danh mục lặp trên từng dòng. Nhảy nhanh (Modern) một dòng cuộn ngang. Classic: danh mục một hàng riêng, bộ lọc tông cạnh ô tìm kiếm.
- Cỡ/icon: Modern đưa ô tìm, combobox, sắp xếp, nút Lọc vào token `--lp-h/--lp-ctl-font` (`library-polish.css`; trước đó mỗi nơi tự đặt 24–30px). Classic có `old/assets/css/ui-scale.css` (token `--o-h/--o-fs`: chuột 30px/12px, cảm ứng 40px/14px; chữ trước đây 8,75–10px). Icon-nút chuyển từ emoji/glyph (📌 ★ ☆ 🔓 🛠️ 📂 🔊 🔤…) sang sprite `assets/icons/lucide.svg` (thêm `star-fill`, `pin`), cỡ theo `em`; Classic nhúng sprite trong `old/index.php`. Thanh đáy điện thoại ẩn khi mở sidebar (luật ẩn bị `control-deck.css` thắng trước đây). Đo tự động 5 cỡ màn hình × 2 giao diện: chữ <11px 40→0, nút <32px (điện thoại) 52→6, emoji-icon 11→2.
- Quản lý: thêm bài qua `manager/js/manager-upload.js` — danh sách chuẩn bị, mỗi file một dòng với **tên bài sửa được** (gợi ý từ `<work-title>`, bỏ "Untitled score"; nếu không có thì từ tên file, tách số đầu "012 Tên…"), số bài, tác giả; file sai định dạng bị đánh dấu; tên trống bị chặn; tải tuần tự, dòng lỗi giữ lại để tải lại. Nguyên nhân gốc bài "tai chinhe" (XML MuseScore để "Untitled score"). `manager-categories.js` chỉ còn ủy quyền (`openUpload`, `handleUploadSubmit`, `afterUpload`).
- Lỗi giao diện Quản lý sửa kèm: trang tràn ngang 25px ở 390px khi đã đăng nhập (App Shell dùng chung; `app-shell.css`) làm chạm trượt nút; 5 thẻ KPI chiếm ~1000px trên điện thoại → lưới 2 cột; toast `pointer-events:auto` che nút "Tải lên"/"Lưu" → không chặn chạm, hiện ở đầu màn hình trên điện thoại; lớp toast `error` lệch với `mgr-toast-error`; `manager/index.php` dùng `?v=filemtime` thay `?v=2.x` cứng (CDN giữ 7 ngày nên JS sửa không đến người dùng).
- Sinh lại `.gz` (`tools/generate_asset_gzip.php`; `layout.css.gz` đã lỗi thời từ trước) và manifest SW. Test cập nhật: `old_ui_flat_compact_regression.php` (khẳng định combobox, cấm dải chip). Kiểm chứng thêm bằng bản sao cô lập (DB + `storage/Thanh ca` riêng, đã xoá): sửa tên, tải 3 file, tên/số/tác giả lưu đúng, FTS tìm thấy.
- **Chưa commit.** Working tree còn thay đổi của phiên trước (`LibrarySyncService`, `manage_song`, `storage/seed/*`, `CODE_MAP.md`…) — xem `git status`. Cần chủ dự án xem lại: nút "Đồng bộ GitHub" chạy `git add/commit/push origin main` từ yêu cầu web.

## 2026-10-29 (b) — Danh mục riêng, thêm bài XML, chốt chặn quyền xem theo mã bài

- Danh mục có quyền xem (`categories.visibility`: public/private/admin_only, migration 017 — **chạy `php tools/migrate.php` trên web**; trước đó mã vẫn chạy, coi mọi danh mục là công khai). Trang Quản lý → Quản Lý Thể Loại: nhãn quyền, đổi quyền đồng loạt (có xác nhận), nút "Thêm bài (XML)". Module mới `manager/js/manager-categories.js` (chuyển từ `manager-repertoire.js`).
- Bài vào danh mục không công khai: ép riêng tư, mã `pv-…`, XML ở `storage/private/xml/` (`PrivateSongXmlService`, Apache chặn, Git bỏ qua), `xmlPath` là URL API `songs&action=xml&id=` kiểm quyền (404 cho người không được xem). `.gitignore` loại XML riêng và hợp âm/ghi chú `pv-*`.
- Vá rò rỉ có sẵn: **không controller nào kiểm quyền xem bài theo mã** → thêm `api/core/SongAccessGuard.php` (hợp âm, ghi chú, xuất ChordPro, bản phối, tập luyện, phiên, đánh giá, chương trình); `ManagerRepertoireHelper` hết lộ danh mục riêng/đổi danh mục bỏ qua ép quyền; danh sách công khai, bộ nhớ đệm, chương trình cho viewer loại bài/danh mục không công khai; kiểm trùng tên danh mục tiếng Việt (SQLite `LOWER()` chỉ hạ ASCII).
- Test: `tests/private_catalog_regression.php` (41 check), `e2e/private-catalog.spec.js` (Chromium + WebKit, bản sao cô lập), kiểm Apache 403 cho `storage/private/`. Bộ test strict: 242/244 (còn `library_tv2_gzip`, `liturgical_export_and_usage` lỗi sẵn). Hướng dẫn: `docs/PRIVATE_CATALOG.md`.

## 2026-10-29 — Tài khoản bannhac, chương trình chỉ cho người đăng nhập, HD mặc định, kiểm chồng lấn hợp âm

- Tài khoản: `tools/create_band_user.php` (CLI, dry-run mặc định, mật khẩu lấy từ biến môi trường `SHEETAPP_USER_PASSWORD`, sao lưu trước khi ghi). Đã tạo `bannhac` (role `bannhac`, chord_code `BN`) trên CSDL local; CSDL web chạy cùng lệnh.
- Chương trình: khách chưa đăng nhập không thấy gì — mọi `GET` route `setlists` yêu cầu đăng nhập (401), tab Chương trình ẩn (Modern + `/old/`); `viewer` đã đăng nhập vẫn nhận bản rút gọn của chương trình `published`. Sửa `RULE.md` §5.2 và `tests/library_tv41_public_setlists_regression.php`.
- HD mặc định: HD rỗng hiện bản nhạc sạch (cờ `AppRules.HD_EMPTY_SHOWS_TLH = false`, thay Core Rule 1 cũ). `tools/clone_tlh_to_hd.php` + `tools/xml_chords_to_json.cjs` sao chép hợp âm XML vào HD: 1.449 bài (38.539 hợp âm) được ghi, 135 bài XML không có hợp âm giữ HD rỗng; sao lưu và 1.449 dòng lịch sử. Test mới `tests/hd_empty_clean_regression.php`.
- Hợp âm/chấm `+` (R9 P4-3): sàn chữ 12px, hợp âm xếp độc lập với chấm, chấm nhường chữ; `e2e/r9-chord-overlap.spec.js`; danh sách chương trình Classic hết dính nhau (`old/assets/css/layout.css`); `TransposeHelper.php` đồng bộ quy tắc Bb/Ab/Eb với JS.
- Seed phát hành: sau khi clone HD đã sinh lại `storage/seed/library.sqlite` + `library.manifest.json` (đúng 1.449 bộ HD đổi, 1.737 bộ hợp âm, 1.455 file JSON khớp manifest). Xoá 2 bộ rác test (`BH_TEST_R29`, `BH_POLYPHONIC_TEST`) khỏi CSDL local; sửa `library_r29`/`library_r210` truyền `userId` cho `deleteSet` nên không còn rò vào CSDL thật. Bộ test strict: 241/243 suite, chỉ còn `library_tv2_gzip` và `liturgical_export_and_usage` lỗi sẵn ở HEAD.
- Chưa làm (cần chủ dự án quyết): danh mục riêng + tải XML riêng tư, đồng bộ dữ liệu GitHub — xem phương án trong phiên 2026-10-29.

## 2026-10-28 — Nghiệm thu đợt fix R9 theo ROADMAP_R9_REVIEW (F1–F9, Q1–Q3, P0–P5)

- Phân quyền & chống mất dữ liệu bộ hợp âm chuẩn HD (`F1`, `F2`, `Q1`, `Q2`): đồng bộ `username` và `chord_code` từ CSDL trong `Auth::checkDb()`; tìm kiếm người dùng không phân biệt hoa thường ở `UserService::findByUsername`; `ChordSetController` chỉ cấp quyền sửa trực tiếp bộ `HD` cho Admin hoặc chủ sở hữu có `chord_code = 'HD'` (chặn tài khoản giả mạo `HoaiDinh` không có `chord_code` với HTTP 403). Cấm ghi đè bộ `HD` bằng thao tác sao chép (`action === 'clone'` trả 403, ẩn nút `#cc-clone-copy` khi đích là `HD`).
- Sửa lỗi cuộn danh sách bài khi bấm "Xem thêm" (`F3`, `P2-3`) và quyền tạo bộ mới / chuyển bài (`F6`, `F8`, `P2-4`): `LibrarySearch.run` truyền `searchAppend: offset > 0`, `LibraryUI.render` (Modern & Classic) giữ nguyên `scrollTop` khi nạp thêm trang; nhạc công Ban Hát đã ở bộ cá nhân gọi `showNewSetModal()` bật sửa ngay trên bộ của mình thay vì mở modal báo lỗi 403; Classic `/old/` tắt `_editEnabled` khi chuyển sang bộ không có quyền sửa trực tiếp; `applyPreloaded` kiểm tra `#osmd-container svg` trước khi gọi `_build()`.
- Chuẩn hoá tông & dịch giọng (`F4`, `F7`, `Q3`, `P2-5`, `P3-1`): tôn trọng `<fifths>0</fifths>` trong MusicXML (chỉ fallback sang `defaultKey` khi XML thiếu `<fifths>` và `currentSong.id` khớp bài đang mở); kiểm chứng ma trận 7.392 phép thử `TransposeEngine.transposeChord` & `KeyService.displayKey` (không bao giờ xuất `A#`, `G#`, `D#` cho giọng/hợp âm trưởng).
- Khôi phục `assets/js/chord-canvas-dots.js` về HEAD & chuẩn hoá EOL (`F5`, `F9`, `P0-3`): xoá diff 1.169 dòng do đổi CRLF/LF; nâng cấp `tests/r9_ui_transpose_chord_guest_setlist_regression.php` lên kiểm thử hành vi thật (8/8 PASS); lưu đầy đủ bằng chứng `P0`–`P5` tại `docs/fix-evidence/r9/`.
