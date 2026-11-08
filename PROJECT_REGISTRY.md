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
│   │   ├── ManagerVersionHelper.php    # Helper: Phiên bản MusicXML Fork (danh sách, xóa, ghim)
│   │   ├── LiveSyncStreamHelper.php    # Helper: vòng lặp SSE của Live Sync (replay, state, ping)
│   │   ├── ReviewService.php           # Phê duyệt hợp âm & visual diff
│   │   ├── PracticeAssignmentService.php # Giao bài & tập bè ca đoàn
│   │   ├── NotificationService.php     # In-app notifications
│   │   ├── NotificationPreferenceService.php # Tùy chọn thông báo đa kênh
│   │   ├── NotificationDeliveryService.php   # Dispatcher kênh webhook/email
│   │   ├── MusicXmlHealthService.php   # Báo cáo chất lượng MusicXML + phát hiện bài trùng khi nhập
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
│       ├── toolbar-customizer.js # Ẩn/hiện nút toolbar theo thiết bị (Modern + Classic)
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
| `ChurchController` | `churches` (cờ MULTI_CHURCH) | GET (mine, members), POST (switch, join, update_member, rename, regenerate_code, create) | `ChurchService`, `ChurchAccessGuard` |

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

## 2026-11-08 (e) — Thu nhỏ nút trên điện thoại/iPad (Modern thanh dưới, Classic toolbar)

- Modern, điện thoại (≤680px): thanh dưới `#mobile-thumb-bar` hàng 44→36px, icon 1.4em→1.2em (≈16px), khe/lề 6→4px, `--dock-h` 104→84px (`assets/css/control-deck.css`): thanh cao 107→85px, chừa thêm chỗ cho bản nhạc. iPad dọc Modern dùng toolbar phía trên (không có thanh dưới) nên giữ nguyên.
- Classic, `old/assets/css/ui-scale.css`: token riêng trên `#toolbar` (iPad/cảm ứng ≤1024px: nút 36px, chữ 13px; điện thoại ≤480px: 34px) — sidebar/modal vẫn 40px; `old/assets/css/control-deck.css` khối ≤480px: nút/transpose 40/38→34px. Toolbar điện thoại ~138→120px, iPad 85px.
- Sàn vùng chạm theo CODING_STANDARDS §4.6 (32–36px). Nới ngưỡng e2e thanh dưới điện thoại 44/40→36: `m4-reader-layout` (M4-2a), `library-l1-mobile-view`, `library-r7-responsive`; HUD Biểu diễn và toolbar tablet Modern (M4-2c) vẫn 44. Test PHP không khóa các con số này.
- Lưu ý: e2e `m4-reader-layout` M4-2c/M4-3/M4-5 (webkit) lỗi sẵn từ trước (đã xác nhận trên mã gốc), không do thay đổi này. Chạy e2e: robocopy bản sao bằng PowerShell (Git Bash làm hỏng cờ `/MIR`).

## 2026-11-08 (d) — Sheet nhạc: tách renderer, hết catch rỗng nuốt lỗi, chặn lưu đè khi tải bộ hợp âm lỗi

- `osmd-renderer.js` 600→529 dòng: `compactTitle` và `hideRepeatLabels` chuyển sang `OSMDSvgText` (`osmd-svg-text.js`), renderer giữ hàm bọc `_compactTitleSVG`; 6 chỗ gọi callback sẵn sàng gom vào `_notifyReady()` có log lỗi. `/old/` dùng bản renderer riêng nên không đổi. Test L18 đọc cả hai file.
- Rà 24 `catch` rỗng ở module bản nhạc: lỗi thật nay có log (callback OSMD, tải bộ hợp âm/danh sách bộ); chỗ cố ý (localStorage bị chặn, `getBBox` phần tử ẩn, `abort()`) giữ hành vi, thêm chú thích lý do.
- `chord-canvas.js` nhánh dự phòng tải bộ hợp âm: lỗi nay đặt checksum `__LOAD_ERROR__`, khóa nút thêm hợp âm và báo toast như nhánh chính (trước đây nuốt lỗi, có thể lưu đè bộ thật).
- Còn sát trần 600 dòng (581–597): `chord-canvas-dots`, `chord-canvas-edit`, `song-loader`, `chord-canvas-ui`, `chord-canvas` — tách file nào khi thêm tính năng vào file đó. Chưa làm: duyệt 10 bài hợp âm trùng + 4 nhóm XML y hệt (cần chủ dự án), đo render trên iPad/điện thoại thật.
- Lưu ý: chạy lẻ `tests/core_rules_regression.php` trên máy dev báo `no such column: church_id` do cờ MULTI_CHURCH cục bộ; đặt `SHEETAPP_IGNORE_LOCAL_FEATURES=1` thì đạt. Strict: 263 suite, 4.755 check, 0 lỗi.

## 2026-11-08 (c) — Ẩn/hiện nút toolbar (Modern + Classic)

- `assets/js/toolbar-customizer.js` (mới, dùng chung; Classic nạp qua `../assets/js`): người dùng vào menu ⋮ → **⚙ Tùy chỉnh thanh công cụ**, bỏ tick để ẩn 12 nhóm nút (tông, zoom, nhịp độ, bản nhạc↔lời, ghi chú, soạn hợp âm, ký hiệu, gọn nhẹ, cuộn, bài trước/sau, toàn màn hình, theo ca trưởng), gồm cả thanh ngón cái điện thoại. Chỉ liệt kê nút có thật trong giao diện đang mở.
- Ẩn bằng CSS `display:none !important` (nút vẫn trong DOM nên phím tắt/JS không hỏng), lưu localStorage `sheetapp.toolbar.hidden.v1` theo thiết bị, có "Khôi phục mặc định". Không ẩn được: nút ⋮ Tuỳ Chọn, nút mở danh sách bài. Luật ẩn thêm 4 `:not(#id)` giả để thắng `control-deck.css` của Classic (`body #toolbar#toolbar #id {display:… !important}`); nút trùng id trong menu ⋮ của Classic (`btn-toolbar-metronome`, `btn-lyric-view` ở Modern) được loại bằng selector có phạm vi `#toolbar-controls`.
- Test `tests/toolbar_customizer_regression.php` (18 check; 12 hành vi qua Node + 5 cấu trúc). Đã kiểm trong trình duyệt thật: Modern desktop + 390px, Classic.

## 2026-11-08 (b) — Báo cáo chất lượng MusicXML + phát hiện bài trùng khi nhập

- Đo kho 1.731 bài (chỉ đọc): 0 XML hỏng/thiếu, 0 phần nhạc rỗng; 10 bài có hợp âm trùng cùng vị trí, 2 bài có lời rỗng; 147 nhóm trùng tên chuẩn hoá (nhiều nhóm là cùng bài ở tuyển tập khác nhau) và 4 nhóm trùng nội dung XML y hệt nhưng khác tên.
- `api/services/MusicXmlHealthService.php` (mới): `analyze()` báo hợp âm trùng, lời rỗng/không có lời, toàn dấu lặng, XML hỏng; `findDuplicates()` so tên chuẩn hoá (bỏ số đầu, dấu câu) và nội dung y hệt (so kích thước trước rồi mới băm). Chỉ so với bài công khai để không lộ tên bài riêng tư. CHỈ BÁO CÁO: không sửa XML, không chặn lưu.
- `ImportService::storeImportedSong` tính báo cáo TRƯỚC khi lưu và trả thêm `warnings`/`duplicates` (cả đường công khai lẫn riêng tư; lỗi phân tích không làm hỏng việc nhập). `assets/js/importer.js` (chỉ Modern; Classic giữ nguyên vì trường mới là phụ thêm) hiện danh sách ⚠ dưới kết quả nhập.
- Công cụ `tools/scan_library_health.php` (CLI, chỉ đọc) liệt kê toàn kho. Test `tests/musicxml_health_regression.php` (17 check). Chưa làm: tự sửa hợp âm trùng (cần chủ dự án duyệt từng bài), chặn/hợp nhất bài trùng.

## 2026-11-08 — Dọn chất lượng mã + độ tin cậy test

- Tách file PHP vượt 600 dòng: `ManagerService` (634→512) giao 3 hàm phiên bản MusicXML cho `ManagerVersionHelper`; `LiveSyncService` (640→525) giao vòng lặp SSE cho `LiveSyncStreamHelper` (giữ `session_write_close`, `set_time_limit(40)` và đọc phòng ở service). Hành vi không đổi; test `live_sync_last_event_id` đọc cả hai file khi kiểm mã ping 15s.
- Xóa 21 dòng `console.log` khởi tạo/gỡ lỗi ở 13 file JS (không đụng vendor). Các `fetch()` ngoài `ApiService` đều đã có chú thích `INTENTIONAL EXCEPTION` (tải XML tĩnh, dự phòng đăng xuất/practice) nên giữ nguyên. Cảnh báo "AudioContext was not allowed to start" ở /learn do chính `Tone.js` tạo khi nạp, không phải mã dự án.
- Test: bật `extension=zip` (php.ini XAMPP) để ERR-11 chạy thật; `library_tv2_gzip_regression` tự dùng bản sao cô lập `<thư-mục>-e2e` khi thiếu `SHEETAPP_TEST_URL` (không đặt toàn cục vì suite HTTP Live Sync cần cùng kho dữ liệu); gắn nhãn hành vi cho `review_workflow` và `auth_matrix` (+89 check). Strict: 260 suite, 4.715 check, 0 lỗi, 0 skip.
- Lưu ý: robocopy `/MIR` vào bản sao e2e phải thêm `/XF .sheetapp-e2e-isolated.json`, nếu không file đánh dấu bị xóa và Playwright từ chối chạy; chạy Playwright từ trong thư mục bản sao.
- Dịch giọng (đề xuất mục 6): quét 55.440 phép dịch hợp âm (cả đường có Tonal và dự phòng) + 528 ca nhãn giọng — cao độ/hậu tố/bass đúng 100%. Sửa 2 chỗ nhãn giọng lệch hợp âm vẽ: `KeyService.displayKey` nay cho `D −1 = Db` (trước là `C#`, 7 thăng) và giọng thứ bậc 8 luôn `G#m` (trước `Abm` ở nguồn giáng); `performance-notes.js` (nút Tự đồng bộ) đi qua `KeyService` thay vì `transposeChord`. Test mới `tests/transpose_spelling_audit_regression.php` + `tests/js/transpose_spelling_audit.cjs`.
- Kiểm lại đa Hội Thánh: `tools/verify_multi_church.php` ổn (2 HT, 0 chương trình mồ côi, 0 tài khoản chưa thuộc HT); 7 suite PHP và 16 e2e (Chromium + WebKit) đạt.
