# PROJECT_REGISTRY.md — Sơ Đồ Dự Án SheetApp

> **AI AGENT: Đọc file này để biết dự án có gì, ở đâu.**
> Cập nhật file này sau mỗi phiên làm việc có tạo/sửa file quan trọng.

---

## 1 · THÔNG TIN DỰ ÁN

```yaml
Tên dự án:   SheetApp — Ứng dụng đọc & biểu diễn bản nhạc
Phiên bản:   v2.0-dev
Ngày tạo:    2026-04-25
Cập nhật:    2026-09-05

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
├── CODING_STANDARDS.md       ← Đọc thứ hai (tiêu chuẩn code, EventBus, API)
├── PROJECT_REGISTRY.md       ← File này. Bản đồ dự án & lịch sử thay đổi.
├── CODE_MAP.md               ← Bản đồ tri thức codebase (tự sinh bởi Gitnexus)
├── INFO.md                   ← Tài liệu tổng quan, sprint plan, keyboard shortcuts
├── sync.sh                   ← Auto-sync script (cập nhật CODE_MAP.md & push GitHub)
├── SHEETAPP2_LIVE_BAND_DEEP_ANALYSIS_2026-09-10.md ← Báo cáo phân tích chuyên sâu Live Band Studio
├── SHEETAPP2_MANAGER_DEEP_ANALYSIS_2026-09-10.md   ← Báo cáo phân tích chuyên sâu Manager Portal
│
├── index.php                 ← Entry point HTML (PHP partial includes)
├── manager/                  ← Cổng Quản Lý Kho Nhạc & Không Gian Cộng Tác Hợp Âm (/manager/) [NEW 2026-09]
│   ├── index.php             # Dashboard Modular (< 100 dòng) nhúng 12 partials
│   ├── manager.css           # Stylesheet responsive, KPI cards, table & modal
│   ├── manager.js            # Coordinator (< 600 dòng): Tabs, Modals, State
│   ├── partials/             # 12 View Partials: header, hero_kpi, song_picker, tabs_bar, tabs 1-7, modals
│   └── js/                   # Submodules (< 600 dòng): repertoire, community, versions, users, usage, reviews, notifications
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
│   │   ├── TenantProvisioningService.php # Epic 4.5: Vòng đời khởi tạo & sao lưu Multi-Tenant
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
| `DB.php` | PDO singleton: `DB::getConnection()` | Ít khi |
| `Response.php` | JSON helpers: `ok()`, `error()`, `notFound()`, `forbidden()` | Ít khi |

### Backend Controllers (`api/controllers/`)

| Controller | Route | Methods | Gọi Service |
|------------|-------|---------|-------------|
| `SongController` | `songs` | GET, POST, PUT, DELETE | `SongService` |
| `ChordSetController` | `chord_sets` | GET, POST | `ChordSetService` |
| `AnnotationController` | `annotations` | GET, POST | `AnnotationService` |
| `SessionController` | `sessions` | GET, POST | `SessionService` |
| `SetlistController` | `setlists` | GET, POST, DELETE | `SetlistService` |
| `CategoryController` | `categories` | GET, POST, PUT, DELETE | `CategoryService` |
| `AuthController` | `auth` | POST (login/logout/me) | `UserService` |
| `UserController` | `users` | GET, POST, PUT, DELETE | `UserService` |
| `ImportController` | `import` | POST | `ImportService` |
| `OmrController` | `omr` | GET, POST, DELETE | `OmrService` |
| `LearningController` | `learning` | GET, POST | `LearningService` |
| `PracticeController` | `practice` | GET, POST | `PracticeService` |

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
| `chord_sets` | GET | `?action=list&songId=X` | `{data: string[]}` | Danh sách set |
| `chord_sets` | GET | `?action=load&songId=X&name=N` | `{data: ChordMap}` | Load set |
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
| `auth` | GET | `?action=logout` | `{success}` | Đăng xuất |
| `omr` | GET | - | `{data: OmrJob[]}` | Danh sách OMR jobs |
| `omr` | POST | FormData (image) | `{data: OmrJob}` | Upload ảnh OMR |
| `omr` | DELETE | `?id=X` | `{success}` | Xóa OMR job |

### Response Format Chuẩn (BẮT BUỘC)

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
| `songs` | `id, title, xml_path, category_id, default_key` | Bài hát |
| `chord_sets` | `id, song_id, name, chords_json` | `name='HD'` và `name='default'` là protected |
| `annotations` | `id, song_id, measure_idx, note_idx, text` | Sticky notes |
| `sessions` | `id, song_id, user_id, user_settings_json, perf_notes_json` | Per-user per-song |
| `setlists` | `id, name, user_id` | Header |
| `setlist_items` | `id, setlist_id, song_id, order_index, chord_profile, transpose_key, bpm, beats_per_measure` | Items trong Setlist kèm Tông tập & Tempo tập |
| `categories` | `id, name, sort_order` | Danh mục bài |
| `users` | `id, username, password_hash, role, email, quiet_hours_start, quiet_hours_end` | `role: 'admin'\|'leader'\|'banhat'\|'viewer'` |
| `omr_jobs` | `id, filename, status, result_xml` | OMR processing queue |
| `domain_events` | `id, type, actor_user_id, subject_type, subject_id, payload_json` | Event log nội bộ phục vụ fan-out |
| `notifications` | `id, user_id, event_id, title, body, link, read_at` | Trung tâm thông báo trong app |
| `notification_preferences` | `user_id, event_type, channel, enabled` | Tùy chọn đa kênh theo người dùng |
| `notification_deliveries` | `id, notification_id, user_id, channel, status, attempts, sent_at` | Hàng đợi chuyển phát (queued/sent/failed/skipped) |
| `practice_assignments` | `id, setlist_id, song_id, created_by, title, due_at, status` | Bài tập ca đoàn |
| `practice_assignment_targets`| `assignment_id, user_id, voice_part, status, completed_at` | Mục tiêu luyện tập phân công theo ca viên |
| `review_requests` | `id, entity_type, entity_id, song_id, requester_id, status` | Hàng đợi phê duyệt hợp âm/MusicXML |
| `chord_set_history` | `id, chord_set_id, song_id, chords_json, changed_by` | Lịch sử phục vụ rollback HD |

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
1. OSMD library (vendor)
2. core/EventBus.js
3. core/Store.js
4. core/ApiService.js
5. transpose-engine.js
6. osmd-renderer.js
7. chord-canvas.js, chord-canvas-ui.js, chord-canvas-xml.js
8. annotation-canvas.js
9. audio-player.js
10. auto-scroller.js
11. library-ui.js, setlist-ui.js
12. song-info-bar.js, display-settings.js, page-nav.js
13. fab.js, keyboard-handler.js, history-manager.js, url-state.js
14. session-tracker.js, performance-notes.js
15. toolbar-controller.js, app-ui.js
16. song-loader.js
17. auth.js, admin-ui.js, importer.js
18. app.js ← bootstrap cuối cùng
```

---

## 9 · NHẬT KÝ CẬP NHẬT

[2026-09-25] — Bàn giao nguyên tắc triển khai cho Gemini
  + Tạo: GEMINI_IMPLEMENTATION_RULES.md (thứ tự triển khai, TDD, security gates, migration/backup rules, Definition of Done)
  ~ Sửa: GEMINI.md (bắt buộc đọc tài liệu bàn giao trước khi sửa code)
  ✓ Tài liệu giữ nguyên bốn Core Rules, khóa thứ tự GĐ0→GĐ4 và cấm tự push/deploy khi chưa được yêu cầu.

[2026-09-25] — Giai đoạn 0: Learning ownership và chuẩn hóa API errors
  + Tạo: tests/security/learning_ownership_regression.php, response_contract_regression.php
  + Tạo: tools/verify_sqlite_backup.php (CLI-only, kiểm tra integrity và số lượng dữ liệu cốt lõi)
  + Backup: storage/backups/app-before-learning-owner-20260925.sqlite
  ~ Sửa: migrate_learn_tables.php (CLI-only, thêm user_id và index user/song)
  ~ Sửa: LearningController/LearningService (cấu hình học tập tách theo owner từ session)
  ~ Sửa: Response.php và 13 controller (không lộ exception 500; giữ message tương thích trong Response::ok)
  ✓ SQLite integrity check trước/sau migration: ok; không mất bản ghi Learning.
  ✓ Restore drill local khớp 903 songs / 4 users / 0 user chord sets / 1 song version.
  ✓ 15 security regression suites / 139 checks pass; PHP lint sạch; HTTP smoke pass.

[2026-09-24] — Giai đoạn 0: XSS, SSRF và Practice ownership
  + Tạo: assets/js/core/SafeHtml.js (output encoding dùng chung cho HTML template)
  + Tạo: tests/security/xss_output_regression.php, import_ssrf_regression.php, practice_ownership_regression.php
  ~ Sửa: members/admin/song-loader/projector/learn/manager (encode dữ liệu động trước khi render)
  ~ Sửa: import_helpers.php và ImportService.php (chặn SSRF, xác thực TLS, giới hạn 10 MB, kiểm tra MusicXML active content)
  ~ Sửa: PracticeController/PracticeService (checkpoint và finish chỉ owner hoặc admin)
  ~ Sửa: SessionController/SessionService (settings và performance notes tách file theo user, anonymous chỉ nhận mặc định)
  ✓ 13 security regression suites / 112 checks pass; PHP lint sạch; 5 web surfaces trả HTTP 200.

[2026-09-24] — Giai đoạn 0: Security hardening đợt 1
  + Tạo: api/core/Session.php (cookie HttpOnly/SameSite, Secure trên HTTPS, strict session)
  + Tạo: api/core/LoginRateLimiter.php (giới hạn 10 lần đăng nhập sai/15 phút, có file lock)
  + Tạo: api/core/RequestSecurity.php (chặn request ghi cross-origin)
  + Tạo: tests/security/*.php (8 security regression suites, 49 checks)
  ~ Sửa: auth/user/live-sync/setlist/song controllers và services (authorization, ownership, host token, managed XML path)
  ~ Sửa: .htaccess (chặn công cụ, tài liệu, log, private storage; bỏ CORS wildcard)
  ✓ Runtime XAMPP: tài nguyên nhạy cảm 403/404; manifest công khai 200; ghi ẩn danh bị từ chối.
  ✓ Tất cả security regression suites pass; PHP lint sạch trên file đã sửa.

> AI Agent cập nhật mục này sau mỗi phiên làm việc

[2026-09-06] — Ưu tiên chọn bộ hợp âm HD thay cho TLH (gốc)
  ~ Sửa: includes/sheet_viewer.php (Dropdown #chord-set-selector đưa option '⭐ HD (Ưu tiên)' lên đầu tiên trước 'TLH (gốc)')
  ~ Sửa: assets/js/chord-canvas.js (Khởi tạo _currentSet và _prevSet mặc định là 'HD'; _refreshSetDropdown đưa 'HD' lên vị trí số 1; _showPopup tự động chuyển sang HD khi người dùng sửa hợp âm ở TLH)
  ~ Sửa: assets/js/song-loader.js (Fallback set trong _injectChords, _updateCapoBadge và _showLoadToast ưu tiên 'HD' thay vì 'default')
  ~ Sửa: assets/js/song-info-bar.js (Chip hợp âm ưu tiên hiển thị '🎸 ⭐ HD (Ưu tiên)'; Bổ sung sự kiện click vào chip để chuyển đổi tức thì giữa HD và TLH (gốc))
  ✅ Bộ hợp âm HD luôn được chọn và ưu tiên hàng đầu trên toàn bộ giao diện và luồng dữ liệu.
  ✅ Nhạc công có thể 1-chạm vào chip hợp âm trên thanh thông tin để so sánh đối chiếu nhanh giữa HD và TLH.

[2026-09-05] — Nâng cấp chỉnh sửa Tempo (BPM) & Tối ưu giao diện lưu Setlist trên Điện thoại, iPad
  ~ Sửa: includes/modals.php (Tạo #tempo-pick-modal với Slider 40-220, nút +/-, TAP tempo, Presets, Test nhịp; Nâng cấp #transpose-pick-modal chọn trước cả Tông tập và Tempo tập; Thêm window.TempoPick API)
  ~ Sửa: assets/js/song-info-bar.js (Chip Tempo [♩ = ... bpm ✎] tương tác mở TempoPick; Dời nút [💾 Lưu vào Setlist] lên vị trí thứ 4 ưu tiên hiển thị trên mobile/iPad; Bỏ rào cản isAdmin chặn lưu setlist; Lắng nghe metronome:bpm realtime)
  ~ Sửa: assets/js/setlist-ui.js (addSongToSetlist gửi cả Tông & Tempo; Bỏ chặn isAdmin cho nút [💾 Lưu Tập]; Click nhãn BPM để đổi nhanh; Hiển thị đồng bộ cả Tông gốc và Tông tập 'Tone: G | Tập: A')
  ~ Sửa: assets/js/metronome.js (Bổ sung EventBus.emit('metronome:bpm', { bpm }) khi thay đổi tốc độ)
  ~ Sửa: assets/css/sheet.css (Tối ưu cảm ứng mobile/iPad: touch-action manipulation, -webkit-overflow-scrolling touch, nút lưu xanh lá nổi bật, touch targets >= 32px)
  ✅ Khắc phục triệt để lỗi không chỉnh được Tempo từ thanh thông tin.
  ✅ Khắc phục lỗi khó bấm / bị ẩn nút lưu Setlist trên iPhone và iPad.

[2026-09-05] — Rà soát toàn diện dự án & Chuẩn hóa Transpose Event Flow
  ~ Sửa: assets/js/app.js (Bổ sung EventBus.emit('transpose:changed', { value }) khi set/reset/relative transpose)
  ~ Sửa: includes/sidebar.php (Loại bỏ input file thừa bị trùng lặp ID 'omr-file-input')
  ✅ Kiểm thử toàn diện: 100% PHP 8.1 syntax check, 100% Node.js JS syntax check trên toàn bộ modules
  ✅ Xác thực dữ liệu: 903 bài hát và 903 bộ hợp âm 'HD' mặc định nguyên vẹn, SQLite integrity test đạt 'ok'
  ✅ Đồng bộ Performance Engine: Broadcast thời gian thực khi Host dịch giọng hoạt động chuẩn xác

[2026-05-25] — Sửa lỗi trắng trang khi chuyển bài + Full system audit
  ~ Sửa: assets/js/song-loader.js (unhide #sheet-area TRƯỚC OSMDRenderer.load() — fix trắng trang)
  ~ Sửa: assets/js/song-loader.js (module-scoped _autoFitRetryCount thay vì window.*)
  ~ Sửa: api/services/SetlistService.php (SQL injection: dùng prepared statement thay vì string interpolation)
  ~ Sửa: assets/js/setlist-ui.js (Array.isArray guard cho _setlists; ensureSongsLoaded dùng LibraryUI cache)
  ~ Sửa: index.php (xóa duplicate SW registration — đã có ServiceWorkerManager.js)
  ~ Sửa: assets/js/app.js (gọi ServiceWorkerManager.register() trong init)
  ✅ Fix trắng trang hoàn chỉnh: container visible trước render OSMD → clientWidth đúng → không trắng
  ✅ SQL injection: mọi query trong SetlistService đều dùng prepared statement
  ✅ SQL injection: mọi query trong SetlistService đều dùng prepared statement
  ✅ Setlist stale cache: ensureSongsLoaded tái dùng LibraryUI.getSongs() khi có
  ✅ BUG-2 Race condition: ChordCanvas.loadSong() đưa vào Promise.all → chords ready TRƯỚC _injectChords()



  ~ Sửa: api/controllers/SetlistController.php (Mặc định chord_profile là 'HD' thay vì 'default')
  ~ Sửa: assets/js/setlist-ui.js           (Đồng bộ URLState trước khi playCurrentItem; Gửi active set khi addItem)
  ~ Sửa: assets/js/library-ui.js           (Gửi active set khi addItem vào setlist)
  ~ Chạy: tools/migrate_setlist_items.php  (Migrate dữ liệu cũ sang bộ 'HD' trong SQLite)
  ✅ Giải quyết triệt để lỗi hợp âm không tải hoặc tải sai khi chuyển bài trong Setlist.
  ✅ Đồng bộ URLState mượt mà qua các bài trong Setlist, giữ nguyên tông và set hợp âm khi F5.

[2026-05-23] — Mobile optimization, Toolbar declutter & Chord entry bottom-sheet
  ~ Sửa: includes/toolbar.php             (Gộp Tốc độ/Volume/Voice Selector vào Audio settings panel dropdown)
  ~ Sửa: assets/css/layout.css            (Thêm styles cho .audio-settings-panel và .audio-panel-row)
  ~ Sửa: assets/css/sheet.css             (Thêm styles cho .cc-popup-mobile và .cc-chip gợi ý, Dark Mode hỗ trợ)
  ~ Sửa: assets/js/display-settings.js    (Tích hợp toggler cho #btn-audio-settings, đóng khi scroll/click ngoài)
  ~ Sửa: assets/js/audio-player.js       (Bao gồm #btn-audio-settings trong enableBtn)
  ~ Sửa: assets/js/song-loader.js         (Gia cố _autoFitZoom với viewBox fallback + retry loop, lock zoom di động)
  ~ Sửa: assets/js/chord-canvas-ui.js     (Tăng ngưỡng isMobile lên 900px cho iPad, gán class thay vì inline styles)
  ✅ Toolbar tinh gọn hơn 200px, không còn bị tràn/cuộn ngang trên di động.
  ✅ Zoom tự động co giãn 100% cực kỳ bền bỉ trên các dòng iPad/iPhone.
  ✅ Trình nhập hợp âm trên iPad chuyển thành Bottom Sheet không lo bị bàn phím ảo che khuất.

[2026-05-15] — Audit round 3: Consumer compatibility + 'use strict' 9 modules
  ~ Sửa: assets/js/annotation-canvas.js  (loadSong: parse res.annotations thay vì Array.isArray(res))
  ~ Sửa: assets/js/display-settings.js   (+ 'use strict')
  ~ Sửa: assets/js/fab.js                (+ 'use strict')
  ~ Sửa: assets/js/history-manager.js    (+ 'use strict')
  ~ Sửa: assets/js/library-ui.js         (+ 'use strict')
  ~ Sửa: assets/js/osmd-renderer.js      (+ 'use strict')
  ~ Sửa: assets/js/page-nav.js           (+ 'use strict')
  ~ Sửa: assets/js/session-tracker.js    (+ 'use strict')
  ~ Sửa: assets/js/transpose-engine.js   (+ 'use strict')
  ~ Sửa: assets/js/importer.js           (+ 'use strict')
  ✅ Tất cả 31 JS modules: 'use strict' 100% (trừ vendor/)
  ✅ Annotation consumer: parse đúng {success:true, annotations:[...]}
  ✅ Session/ChordSet/Setlist consumers: đã kiểm tra, format tương thích


[2026-09-07] — Triển khai Trình biên tập Sheet Nhạc độc lập (/editor/) & Sửa riêng 4 bè SATB
  + Tạo: editor/index.php (Giao diện Studio Dark Mode, OSMD preview, SATB inspector, Mini Piano, Song picker)
  + Tạo: editor/editor.css (CSS Studio tối ưu UI/UX, responsive cho iPad & PC)
  + Tạo: editor/editor.js (Trích xuất & biên tập độc lập 4 bè SATB: Step, Octave, Accidental, Duration, Lyric; Audio Synthesizer; Undo/Redo)
  + Sửa: api/services/SongService.php (Tự động tạo bản sao an toàn .xml.bak trước khi ghi đè file MusicXML; thêm restoreXmlBackup)
  + Sửa: api/controllers/SongController.php (Bổ sung action 'restore_xml' cho phép hoàn tác về bản backup)
  + Sửa: includes/toolbar.php (Thêm nút '🎼 Sửa Sheet' trực tiếp trên thanh công cụ và trong dropdown menu)
  ✅ An toàn dữ liệu 100%: mọi thao tác lưu đều tạo file .xml.bak và có nút khôi phục tức thì
  ✅ Hỗ trợ sửa độc lập từng bè: Soprano, Alto (Part P1 - Khóa Sol) và Tenor, Bass (Part P2 - Khóa Fa)

[2026-09-10] — Ra Mắt Trung Tâm Hướng Dẫn Sử Dụng Toàn Diện SheetApp 2.0 (/huong-dan/)
  + Tạo: huong-dan/index.php (Cẩm nang tương tác toàn diện gồm 9 mô-đun chi tiết, cấu trúc chuẩn mực: Đọc sheet, Hợp âm & Capo, Metronome, Setlist, Live Band Studio, Smart Learning SATB, MusicXML Editor, Phím tắt & Bảng sự cố)
  + Tạo: huong-dan/huong-dan.css (Design system giao diện tài liệu hiện đại, dark mode OLED, typography sắc nét, responsive iPad/Mobile)
  + Tạo: huong-dan/huong-dan.js (Controller tìm kiếm live instant search không dấu, lọc theo 4 vai trò, scroll spy bám dính, FAQ accordion)
  + Cập nhật: .htaccess (Thêm rewrite rule cho clean URL https://sheet.hyb.io.vn/huong-dan)
  + Cập nhật: includes/modals.php (Thêm nút trực tiếp '📚 Cẩm Nang Toàn Diện' trong modal Trợ giúp)
  ✅ Tự động kiểm thử: Đạt 200 OK trên cả /huong-dan/ và /huong-dan, test Chrome DevTools tải đủ 9 mô-đun, live search và role filter hoạt động 100%.

[2026-09-10] — Chuyên Biệt Hóa Live Band: Trọng Tâm Nhạc Cụ & Phối Hợp Ban Nhạc (Instrument Sync & Teamplay)
  + Bổ sung thanh điều khiển Live Sync & Giữ nhịp (#band-sync-strip):
    - Visual Beat Pulser: 4 đèn LED nhấp nháy trực quan theo nhịp (đèn 1 sáng rực cam/đỏ, đèn 2-4 sáng xanh cyan).
    - Tap Tempo tương tác: Chạm 3-4 nhịp ngón tay để bắt tempo bài hát tức thì, broadcast tốc độ cho toàn ban.
    - Metronome Click Audio: Tích hợp Web Audio synthesizer phát tiếng click nhịp cho tai nghe in-ear (960Hz phách 1, 540Hz phách thường).
    - 6 Lệnh Trạng Thái Năng Lượng Ban Nhạc (1-Touch Dynamic States): 🛑 BREAK, 🌊 BUILD-UP, 🤫 ĐỆM ÊM, 🔥 CAO TRÀO, 🎸 SOLO TIME, 🏁 DỨT KẾT với banner cảnh báo toàn màn hình đồng bộ mọi thiết bị.
    - Chuyển Khúc & Báo Trước 2 Ô Nhịp: Quick-jump & broadcast hiệu lệnh chuyển đoạn (Intro, Verse, Chorus, Solo, Bridge, Outro) kèm nút báo hiệu 2 ô nhịp.
  + Thêm Heads-Up Displays (HUD) chuyên dụng cho nhạc công:
    - 🎸 BASS MASTER HUD (#hud-bass): Nốt gốc (Root Note) kích thước lớn, nhận diện hợp âm đảo (Slash Chords C/E -> E, G/B -> B), bảng nốt âm giai theo tông và sơ đồ dây bass.
    - 🎹 PIANO / KEYBOARD HUD (#hud-piano): Vòng hòa thanh số La Mã (I-IV-V-vi), bảng hợp âm 7 mở rộng theo tông và trạng thái đồng bộ Ambient Pad.
  ~ Sửa: live-band/index.php, live-band/live-band.css, live-band/live-band.js.
  ✅ Kiểm thử cú pháp: PHP 8.1 lint sạch, Node.js syntax check 100% đạt, các ID và hàm được kết nối toàn diện.

[2026-09-10] — Triển Khai Giai Đoạn 2: Tập Luyện Thông Minh & Cộng Tác Sân Khấu Live Band Studio
  + Tạo: assets/js/performance/stage-ink-engine.js (Bút vẽ Apple Pencil / S-Pen, Catmull-Rom smoothing, live vector broadcast)
  ~ Sửa: live-band/index.php (Tích hợp canvas vẽ ink, toolbar bút Ca Trưởng, thanh vòng lặp A-B loop, bộ chọn tách bè SATB)
  ~ Sửa: live-band/live-band.css (Styles cho thanh A-B loop bar, ink canvas, palette bút vẽ, nút tách bè SATB)
  ~ Sửa: live-band/live-band.js (Controller xử lý A-B loop bounds, SATB RehearsalMix solo, broadcast nét vẽ ink thời gian thực)
  ✅ Đã tự động kiểm thử DevTools: Vòng lặp A-B kích hoạt, bút vẽ vector ghi nhận stroke, tách bè Alto hoạt động.

[2026-09-10] — Triển Khai Giai Đoạn 1: Nâng Cao Tính Năng Sân Khấu Live Band Studio
  + Tạo: assets/js/performance/ambient-pad-engine.js (Web Audio continuous worship drone synth, 4 layers, crossfade 4s, In-Ear stereo split)
  + Tạo: assets/js/performance/pedal-midi-engine.js (Bluetooth foot pedal & Web MIDI engine, macro dispatch, floating HUD feedback)
  + Tạo: live-band/projector.php (Màn hình máy chiếu nhà thờ Clean Lyrics Projector, tự động bắt nhịp theo Ca Trưởng, không có nốt nhạc)
  ~ Sửa: live-band/index.php (Tích hợp nút Pad, Countdown Timer, link Projector, Audio Settings modal, Timer modal)
  ~ Sửa: live-band/live-band.css (Styles cho Pad, Timer, In-Ear split, range sliders, và toast pedal)
  ~ Sửa: live-band/live-band.js (Controller tích hợp Ambient Pad, Foot pedal actions, Service timer, stereo split)
  ✅ Đã tự động kiểm thử DevTools: Ambient Pad hoạt động, đếm ngược đếm đúng, bàn đạp phản hồi, máy chiếu kết nối phòng.

[2026-09-10] — Lập Báo cáo Phân tích Chuyên Sâu & Nâng Cao Tính Năng Live Band Studio
  + Tạo: SHEETAPP2_LIVE_BAND_DEEP_ANALYSIS_2026-09-10.md (Báo cáo master 10 trụ cột WOW: Ambient Pad, Stereo Split In-Ear, MIDI Pedal, Clean Lyrics Cast...)
  ~ Cập nhật: live-band/live-band.js (Hỗ trợ URL routing ?song=, ?role=, ?room=)

[2026-05-15] — Audit round 2: AuthController SQL + UserController response format
  ~ Sửa: api/controllers/AuthController.php  (SQL trong Controller → dùng UserService::findByUsername())
  ~ Sửa: api/controllers/AuthController.php  (echo json_encode 'me' → Response::ok())
  ~ Sửa: api/controllers/UserController.php  (Response::ok(array) → Response::ok(['users'=>...]))
  ~ Sửa: api/services/UserService.php        (+ findByUsername() method mới)
  ~ Sửa: assets/js/admin-ui.js  (loadUsers() extract res.users, fix const tr indentation)
  ✅ Tất cả Controllers: 0 SQL còn lại trong tầng Controller
  ✅ Tất cả Controllers: 0 echo json_encode còn lại ngoài SongController/CategoryController (documented INTENTIONAL)

[2026-05-15] — Audit round 1: Response format + JS compliance fixes
  ~ Sửa: api/controllers/AnnotationController.php  (echo json_encode → Response::ok())
  ~ Sửa: api/controllers/SessionController.php     (echo json_encode → Response::ok())
  ~ Sửa: api/controllers/ChordSetController.php    (echo json_encode → Response::ok())
  ~ Sửa: api/controllers/OmrController.php         (echo json_encode → Response::ok(['jobs'=>...]))
  ~ Sửa: api/controllers/SongController.php        (thêm INTENTIONAL comment — giữ raw array)
  ~ Sửa: api/controllers/CategoryController.php    (thêm INTENTIONAL comment — giữ raw array)
  ~ Sửa: assets/js/admin-ui.js  ('use strict', fix implicit global `tr`, clean export pattern)
  ~ Sửa: assets/js/song-loader.js  (annotate static asset fetch() exception)
  ~ Sửa: assets/js/core/ApiService.js  (omr.list() extract .jobs từ Response::ok)
  ~ Sửa: CODING_STANDARDS.md  (thêm §4.2 ngoại lệ fetch() static asset)
  ⚠ Còn lại: SongController + CategoryController vẫn trả raw array
              (cần cascade fix ApiService + LibraryUI + AdminUI để chuẩn hóa hoàn toàn)

[2026-09-11] — Đưa Zoom & Khóa Zoom Ra Ngoài Toolbar, Tối Ưu Toàn Diện Trên iPad & Điện Thoại
  + Sửa: includes/toolbar.php (Tạo Zoom Pill chuyên dụng [− 100% + 🔒] ngay trên toolbar, loại bỏ ID trùng lặp trong dropdown)
  + Sửa: includes/sheet_viewer.php (Tích hợp cụm thu phóng & khóa zoom [− 100% + 🔒] ngay trên Floating Gig HUD khi biểu diễn)
  + Sửa: assets/js/toolbar-controller.js (Hỗ trợ nút bước zoom +/−, đồng bộ trạng thái khóa zoom giữa toolbar và Gig HUD, tap-to-reset transpose)
  + Sửa: assets/js/app.js & assets/js/song-loader.js (Đồng bộ nhãn zoom trên Floating Gig HUD khi zoom thay đổi)
  + Sửa: assets/css/layout.css (Tối ưu iPad portrait 768px dạng 1 dòng không tràn viền, tối ưu Điện thoại <= 680px dạng 2 dòng thông minh với dải pill cuộn ngang)

[2026-09-11] — Tinh gọn & Tối Ưu Hóa Trang Chủ Cho Ban Nhạc Biểu Diễn (Pro-Band Homepage Optimization)
  + Sửa: includes/toolbar.php (Hợp nhất 2 thanh công cụ thành Pro-Band Toolbar 48px duy nhất: Song Pill + Transpose Pill + Chord Set Pill + Scroll Pill + Biểu Diễn + More Options dropdown)
  + Sửa: includes/sheet_viewer.php (Loại bỏ thanh page-bar 50px gây rối màn hình; bổ sung 2 vùng Edge-Tap lật trang không chạm và Floating Gig HUD)
  + Sửa: includes/sidebar.php (Chuyển 2 nút cồng kềnh Live Band & Học Đàn xuống chân sidebar trong khối Tiện Ích Phụ Trợ)
  + Sửa: assets/css/layout.css (Thiết kế hệ thống Unified Toolbar, Band Pills, Gig Mode Fullscreen, Floating HUD, Edge-Tap Touch Zones và xử lý ẩn gọn khi collapse)
  + Sửa: assets/js/app-ui.js (Kết nối Floating Gig HUD, Edge-Tap page navigation, cập nhật real-time song key badge khi dịch giọng và đồng bộ chế độ biểu diễn)

[2026-09-11] — Triển khai Giai Đoạn 9 /learn/: Web MIDI Hardware Engine, Intelligent Chord Judge & Chế Độ Đợi Phím (Wait Mode)
  + Tạo: assets/js/learn/midi/midi-input-engine.js (Web MIDI API handler, tracking note-on/off, simulation API, status badge)
  + Tạo: assets/js/learn/practice/chord-judge.js (Intelligent chord matcher, hỗ trợ mọi thể đảo, slash-chord bass check)
  + Sửa: assets/js/learn/ui/virtual-keyboard.js (setUserActiveNotes, flashSuccess, flashError, click-to-simulate MIDI)
  + Sửa: assets/js/learn/learn-app.js (Tích hợp _waitMode, pause transport tại hợp âm mới, chờ người học bấm đúng, audio chime, resume)
  + Sửa: learn/learn.css (Styles cho .btn-learn-wait-mode, .learn-midi-badge, .vkb-user-played, flash animations)
  + Sửa: learn/index.php (Thêm nút Wait Mode trên thanh điều khiển và MIDI status badge trên header)

[2026-09-11] — Hoàn thiện Cổng Quản Lý v2.2.0: Quản Lý Phiên Bản MusicXML (Tab 3), Quản Trị Viên & Tinh Gọn Thể Loại
  + Sửa: api/services/ManagerService.php (getVersionsList, deleteVersion, toggleVersionRecommend, toggle_status)
  + Sửa: api/controllers/ManagerController.php (route 'versions', 'delete_version', 'toggle_version_recommend')
  + Sửa: manager/index.php (Tab 3 Bản Chuyển Soạn SATB, Inspector MusicXML forks list, Modal Reset Mật Khẩu)
  + Sửa: manager/manager.css (Styles cho .mgr-versions-grid, .version-card, .song-version-badge)
  + Sửa: manager/manager.js (loadVersions, renderVersionsGrid, deleteVersion, toggleVersionRecommend, filterByCategory, resetUserPass modal, toggleUserStatus)

[2026-09-10] — Nâng cấp Cổng Quản Lý v2.1.0: Đăng Ký Tài Khoản, Quản Lý Hồ Sơ & Trình Chọn Bài Hát Thông Minh
  + Sửa: api/services/UserService.php (createWithProfile(), updateProfile())
  + Sửa: api/controllers/AuthController.php (route 'register', 'update_profile', mở rộng metadata hồ sơ)
  + Sửa: api/services/ManagerService.php (searchSongsFast(), getSongDetails(), updateSongCategory(), getMyContributions())
  + Sửa: api/controllers/ManagerController.php (search_songs, song_details, my_contributions, update_song_category)
  + Sửa: manager/index.php (Modal Đăng Ký #modal-register, Modal Hồ Sơ #modal-profile, Hero Song Picker #mgr-song-picker-section, Selected Song Inspector #mgr-selected-song-panel)
  + Sửa: manager/manager.css (Styles cho dropdown autocomplete, hero song picker, selected song inspector, chord cards, profile tabs)
  + Sửa: manager/manager.js (Logic fast search, selectSong inspector, save category, register submit, update profile & load contributions)

[2026-09-10] — Triển khai Cổng Quản Lý Kho Nhạc & Cộng Tác Hợp Âm (/manager/)
  + Tạo: SHEETAPP2_MANAGER_DEEP_ANALYSIS_2026-09-10.md (Báo cáo phân tích chuyên sâu kiến trúc)
  + Tạo: manager/index.php, manager/manager.css, manager/manager.js (Dashboard Dark OLED Studio)
  + Tạo: api/services/ManagerService.php & api/controllers/ManagerController.php (Backend API)
  + Sửa: api/init_db.php (Thêm bảng user_chord_sets, migration cột mở rộng users, categories, song_versions)
  + Sửa: api/index.php (Đăng ký route 'manager')
  + Sửa: .htaccess (Thêm RewriteRule cho manager/)
  + Sửa: includes/modals.php (Thêm nút liên kết Cổng Quản Lý trong Help modal)
  + Sửa: assets/js/chord-canvas.js (Hiển thị tên tác giả đẹp mắt cho bản phối và nút mở /manager/)

[2026-09-25] — Hoàn tất G0-A: Rà soát & Loại trừ XSS Toàn Diện Toàn Bộ Ứng Dụng
  ~ Sửa: assets/js/library-ui.js (Chuẩn hoá _esc qua SafeHtml.escape, escape data-id)
  ~ Sửa: assets/js/setlist-ui.js (Chuẩn hoá _esc qua SafeHtml.escape)
  ~ Sửa: assets/js/song-info-bar.js (Chuẩn hoá _esc, escape chord set chip label & safe parse BPM)
  ~ Sửa: assets/js/app-ui.js (Chuẩn hoá escapeHtml qua SafeHtml.escape, escape session history date & notes)
  ~ Sửa: assets/js/chord-canvas.js (Escape chord set names & labels trong selector dropdown)
  ~ Sửa: assets/js/chord-canvas-ui.js (Escape chord popup & delete/clone modal labels)
  ~ Sửa: assets/js/admin-ui.js (Dùng inlineJsString cho song.id và parse int cho user/category IDs trong event handlers)
  ~ Sửa: assets/js/lyric-extractor.js (Escape words, syllables, chords và section labels)
  ~ Sửa: assets/js/instruments.js (Escape MusicXML instrument names)
  ~ Sửa: members/members.js (Escape chordCode trong mô tả quyền sửa hợp âm)
  ~ Sửa: manager/manager.js (_escape ủy quyền qua SafeHtml.escape)
  ~ Sửa: editor/index.php (Tải SafeHtml.js trong head)
  ~ Sửa: editor/editor.js (Escape version_name, username, song.title, song.id)
  ~ Sửa: assets/js/learn/ui/chord-card.js (Escape chord symbols, badges, notes)
  ~ Sửa: tests/security/xss_output_regression.php (Bổ sung bộ test regression & behavioral payload testing cho 5 mẫu payload nguy hiểm)
  ✅ 15/15 security regression test suites pass (149+ assertions).
  ✅ SQLite integrity check: ok.

[2026-09-25] — Hoàn tất G0-B & G1 Task 1.1: Staging/Backup Runbook, Encrypted Backup & Unified Test Harness CI
  + Tạo: docs/STAGING_AND_BACKUP_RUNBOOK.md (Quy trình cô lập môi trường, key offsite & restore drill)
  + Tạo: tools/create_encrypted_backup.php (Script CLI tạo snapshot SQLite + manifest SHA-256 + mã hoá OpenSSL AES-256-CBC)
  + Tạo: tests/fixtures/test_db_fixture.php (Khung DB Fixture SQLite in-memory cô lập hoàn toàn khỏi DB thật)
  + Tạo: tests/run_all_tests.php (Bộ chạy kiểm thử hợp nhất: PHP lint 80 files + DB fixture + 15 security regression suites)
  + Tạo: test.bat (Công cụ 1 click chạy toàn bộ test runner trên Windows CLI)
  + Tạo: .github/workflows/ci.yml (Tự động hoá CI Quality Gate trên GitHub Actions cho Push & PR)
[2026-09-25] — Hoàn tất G1 Task 1.2: Tự Động Hóa 4 Core Rules (9 Kịch Bản Hồi Quy)
  + Tạo: tests/core_rules_regression.php (Kiểm thử tự động hồi quy CR1-a/b, CR2-a/b, CR3-a/b, CR4-a/b/c)
  ~ Sửa: tests/run_all_tests.php (Tích hợp bước [4/4] chạy tự động Core Rules vào Quality Gate CI)
  ✅ 9/9 kịch bản Core Rules đều đạt chuẩn.
  ✅ Kiểm thử lặp lại 10 lần liên tiếp ổn định tuyệt đối (không flaky).
  ✅ Task 1.2 (Giai đoạn 1): ĐẠT ACCEPTANCE CRITERIA.

[2026-09-25] — Hoàn tất G1 Task 1.3: Sửa Luồng Load Bài, Chống Race Condition & Chặn Render Đè
  ~ Sửa: assets/js/song-loader.js (Tích hợp _currentLoadToken, AbortController hủy fetch cũ, kiểm tra token tại mọi chặng async)
  ~ Sửa: assets/js/chord-canvas.js (Tích hợp _chordLoadToken chặn hợp âm bài cũ trộn bài mới, loại bỏ gọi đúp chordSets.list F13)
  ~ Sửa: assets/js/osmd-renderer.js (Tích hợp _renderToken trong load() & reload() chống render đè SVG)
  + Tạo: tests/race_condition_regression.php (Bộ test 7 tiêu chí kiểm chứng chống race condition)
  ~ Sửa: tests/run_all_tests.php (Tích hợp bước [5/5] kiểm thử Race Condition)
[2026-09-25] — Hoàn tất G1 Task 1.4: Sửa Setlist Theo Core Rule 4 (Khắc Phục Triệt Để F1 & F5)
  ~ Sửa: assets/js/song-info-bar.js (Lưu đầy đủ chord_profile cùng transpose_key và bpm khi bấm Lưu vào Setlist — Fix F5)
  ~ Sửa: assets/js/setlist-ui.js (Lưu chord_profile trong saveBpmBtn; await tải xong trong playCurrentItem — Fix F1)
  ~ Sửa: assets/js/metronome.js (Bảo toàn BPM của Setlist khi sự kiện song:loaded kích hoạt, không bị tempo XML đè mất)
  + Tạo: tests/setlist_cr4_regression.php (Bộ test 6 tiêu chí hồi quy Setlist CR4 & đồng bộ tempo)
  ~ Sửa: tests/run_all_tests.php (Tích hợp bước [6/6] kiểm thử Setlist CR4)
[2026-09-25] — Hoàn tất G1 Task 1.5: Sửa Chord-set Dropdown & Bảo Vệ HD/TLH (Khắc Phục F3)
  ~ Sửa: includes/toolbar.php (Liên kết an toàn tới ChordCanvas.handleSelectChange thay vì gọi switchSet trực tiếp)
  ~ Sửa: assets/js/chord-canvas.js (switchSet chặn tuyệt đối __create_new_set__ và action pseudo-names; bổ sung handleSelectChange)
  ~ Sửa: api/services/ChordSetService.php (Chặn ghi đè default, TLH và tên bắt đầu bằng __)
  ~ Sửa: api/controllers/ChordSetController.php (Từ chối lưu tên bộ pseudo-action bắt đầu bằng __ với 403 Forbidden)
  + Tạo: tests/chord_set_guard_regression.php (Bộ test 6 tiêu chí bảo vệ HD/TLH và chặn set rác F3)
  ~ Sửa: tests/run_all_tests.php (Tích hợp bước [7/7] kiểm thử Chord Set Guard)
  ✅ 6/6 tiêu chí Chord Set Guard đạt chuẩn.
  ✅ Task 1.5 (Giai đoạn 1): ĐẠT ACCEPTANCE CRITERIA.

[2026-09-25] — Hoàn tất G1 Task 1.6: Sửa Cache MusicXML & Offline Nền Tảng (Khắc Phục F4)
  ~ Sửa: sw.js (Nâng cấp SW_VERSION lên 'v4', chiến lược networkFirstWithQuota cho /storage/ với giới hạn max 60 bài FIFO, thêm listener CLEAR_XML_CACHE)
  ~ Sửa: assets/js/core/ServiceWorkerManager.js (Bổ sung clearXmlCache(url) gửi message tới active SW)
  ~ Sửa: editor/editor.js (Kích hoạt clearXmlCache khi lưu thành công MusicXML)
  ~ Sửa: assets/js/song-loader.js (Xóa cache URL tương ứng nếu có hành động lưu/ghi đè)
  + Tạo: tests/service_worker_cache_regression.php (Bộ test 7 tiêu chí kiểm thử Service Worker & MusicXML cache)
  ~ Sửa: tests/run_all_tests.php (Tích hợp bước [8/8] kiểm thử SW & MusicXML cache)
  ✅ 7/7 tiêu chí Service Worker & Cache Quota đạt chuẩn.
  ✅ Task 1.6 (Giai đoạn 1): ĐẠT ACCEPTANCE CRITERIA.

[2026-09-25] — Hoàn tất G1 Task 1.7: Khép Nhóm Lỗi UI F6–F11 (Dịch giọng, Sidebar, AppUI, Zoom, Phím tắt, Gig)
  ~ Sửa: assets/js/app.js (Đồng bộ giới hạn dịch giọng transposeBy & setTransposeDirect lên ±12 nửa cung — Fix F6; Export toggleSidebar() ra App API — Fix F7)
  ~ Sửa: assets/js/app-ui.js (Gán window.AppUI = AppUI — Fix F8; Ràng buộc dải Capo select 0-7 an toàn; Tích hợp Wake Lock API chống tắt màn hình và Fullscreen API khi biểu diễn Gig mode — Fix F11)
  ~ Sửa: assets/js/toolbar-controller.js (Expose ToolbarController.toggleSidebar — Fix F7; Kiểm tra sheetapp_zoom_locked bảo toàn khóa zoom khi resize & xoay màn hình — Fix F9)
  ~ Sửa: assets/js/keyboard-handler.js (Blur button khi ấn phím tắt chống kẹt bàn phím; Bổ sung phím [ và ] dịch giọng, phím S mở/đóng sidebar — Fix F10)
  ~ Sửa: includes/modals.php (Cập nhật bảng phím tắt trong modal Trợ giúp với [, ], S)
  + Tạo: tests/ui_bugs_regression.php (Bộ test 7 tiêu chí kiểm thử tự động hồi quy nhóm lỗi UI F6–F11)
  ~ Sửa: tests/run_all_tests.php (Tích hợp bước [9/9] kiểm thử UI Bugs Regression vào CI runner)
  ✅ 7/7 tiêu chí kiểm thử UI F6–F11 đạt chuẩn.
  ✅ Task 1.7 (Giai đoạn 1): ĐẠT ACCEPTANCE CRITERIA.

[2026-09-25] — Hoàn tất G1 Task 1.8: Chuẩn Hóa API Lỗi Hiện Hữu (Category CRUD, Learning String ID, Import MVC)
  ~ Sửa: api/services/CategoryService.php (Bổ sung update() và delete() phương thức CRUD hoàn chỉnh, xóa bỏ lỗi 500)
  ~ Sửa: api/controllers/CategoryController.php (Chuẩn hóa trả Response::ok cho POST, PUT, DELETE đồng bộ flag success với AdminUI)
  ~ Sửa: api/controllers/LearningController.php (Xử lý song_id dạng chuỗi alphanumeric, không còn ép intval khiến mã bài chữ cái về 0)
  ~ Sửa: api/services/LearningService.php (Nhận songId string|int, lưu và truy vấn cấu hình luyện tập cho mọi định dạng mã bài)
  ~ Sửa: assets/js/core/ApiService.js (Định tuyến ApiService.importer về MVC endpoint api/index.php?route=import)
  + Tạo: api/import.php (Tạo shim tương thích ngược chuyển tiếp request import tới MVC router)
  ~ Sửa: tests/fixtures/test_db_fixture.php (Bổ sung cột slug cho bảng categories trong DB fixture)
  + Tạo: tests/api_contract_regression.php (Bộ test 7 tiêu chí kiểm thử hồi quy hợp đồng API Task 1.8)
  ~ Sửa: tests/run_all_tests.php (Tích hợp bước [10/10] kiểm thử API Contract Regression vào CI runner)
  ✅ 7/7 tiêu chí kiểm thử API Contract đạt chuẩn.
  ✅ Task 1.8 (Giai đoạn 1): ĐẠT ACCEPTANCE CRITERIA.

[2026-09-25] — Hoàn tất G1 Task 1.9: Migration Có Phiên Bản & Tính Toàn Vẹn CSDL
  + Tạo: api/core/MigrationRunner.php (Bộ điều phối di chuyển CSDL SQLite lũy thừa có phiên bản)
  + Tạo: api/migrations/001_initial_schema.php (Lược đồ 10 bảng cốt lõi)
  + Tạo: api/migrations/002_cleanup_orphans_and_fk_guard.php (Dọn dẹp bản ghi mồ côi, bảo đảm sạch khóa ngoại)
  + Tạo: api/migrations/003_add_performance_indexes.php (14 chỉ mục hiệu năng cho setlist, song, arrangements, categories)
  + Tạo: tools/migrate.php (Công cụ CLI chạy migration và kiểm tra toàn vẹn)
  + Tạo: docs/DATABASE_MIGRATION_RUNBOOK.md (Sổ tay hướng dẫn fresh install, nâng cấp và rollback)
  ~ Sửa: api/core/DB.php (Bật PRAGMA journal_mode = WAL, synchronous = NORMAL, busy_timeout = 5000)
  ~ Sửa: api/init_db.php (Chuyển giao việc tạo bảng cho MigrationRunner, nạp seed chuẩn)
  + Tạo: tests/migration_integrity_regression.php (Bộ test 5 tiêu chí kiểm thử hồi quy Migration & Toàn vẹn CSDL)
  ~ Sửa: tests/run_all_tests.php (Tích hợp bước [11/11] kiểm thử Migration & DB Integrity vào CI runner)
[2026-09-25] — Hoàn tất G1 Task 1.10: Làm Thật Hoặc Ẩn Tính Năng Giả & Checkpoint G1
  ~ Sửa: api/services/LiveSyncService.php (Lưu trữ và phát sóng đầy đủ loop, bandState, inkStroke, inkClear)
  ~ Sửa: assets/js/performance/stage-ink-engine.js (Bảo đảm tính lũy thừa idempotent cho renderRemoteStroke chống render trùng)
  ~ Sửa: live-band/live-band.js (Tách kênh In-Ear Stereo Split: click pan trái -1.0, Pad pan phải +1.0; ẩn vocal SATB mix qua FeatureFlags)
  ~ Sửa: live-band/index.php (Tích hợp FeatureFlags.js cho live-band)
  + Tạo: assets/js/core/FeatureFlags.js (Cấu hình cờ tính năng tập trung, cho phép ghi đè qua localStorage)
  ~ Sửa: index.php & learn/index.php (Nhúng FeatureFlags.js vào hạ tầng core của app chính và sub-app)
  ~ Sửa: assets/js/learn/practice/practice-tracker.js (Đo lường accuracy thực tế từ lượt bấm thay vì hardcode 100.0; flush phiên qua sendBeacon/keepalive khi pagehide/beforeunload)
  ~ Sửa: assets/js/learn/learn-app.js (Kích hoạt hành vi chuyển thẻ đệm và hiển thị thông báo khi chọn chế độ chord)
  ~ Sửa: assets/js/instruments.js (Tự động mở khoá nút Mixer #btn-mixer khi sheet có > 1 dải bè/nhạc cụ)
  ~ Sửa: api/core/DB.php (Bổ sung setPdo() phục vụ test isolation)
  ~ Sửa: tests/fixtures/test_db_fixture.php (Bổ sung bảng practice_sessions và practice_measure_stats cho DB test fixture)
  + Tạo: tests/feature_flags_regression.php (Bộ test 5 tiêu chí kiểm thử hồi quy Feature Flags & Capabilities)
  ~ Sửa: tests/run_all_tests.php (Tích hợp bước [12/12] kiểm thử Feature Flags Regression vào CI runner)
  ✅ 5/5 tiêu chí kiểm thử Feature Flags & Capabilities đạt chuẩn.
  🏆 CHECKPOINT G1 — GO/NO-GO: ĐẠT 100% TIÊU CHÍ (12/12 SUITES PASS, CI XANH, CORE RULES BẢO ĐẢM). HOÀN TẤT TOÀN DIỆN GIAI ĐOẠN 1.

[2026-09-25] — Hoàn tất G2 Task 2.1: App Shell & Điều Hướng Bốn Trụ Cột
  + Tạo: includes/app_nav.php (Thanh điều hướng App Shell dùng chung cho 4 trụ cột Thư Viện, Biểu Diễn, Tập Luyện, Quản Lý)
  + Tạo: assets/css/app-shell.css (Giao diện App Shell glassmorphism thích ứng Light/Dark/Stage Dark, tự ẩn khi Fullscreen)
  + Tạo: assets/js/core/AppShell.js (Bộ điều phối client: nhận diện tab active, bảo toàn ngữ cảnh bài hát ?song=, điều hướng Context Help và đồng bộ auth widget)
  ~ Sửa: index.php (Nhúng App Shell vào Trụ cột 1: Thư Viện & Đọc Sheet)
  ~ Sửa: live-band/index.php (Nhúng App Shell vào Trụ cột 2: Biểu Diễn Live Band)
  ~ Sửa: learn/index.php (Nhúng App Shell vào Trụ cột 3: Tập Luyện Learn Studio)
  ~ Sửa: manager/index.php (Nhúng App Shell vào Trụ cột 4: Quản Lý Manager Portal)
  + Tạo: tests/app_shell_navigation_regression.php (Bộ test 6 tiêu chí kiểm thử hồi quy App Shell & Điều Hướng 4 Trụ Cột)
  ~ Sửa: tests/run_all_tests.php (Tích hợp bước [13/13] kiểm thử App Shell Regression vào CI runner)
[2026-09-25] — Hoàn tất G2 Task 2.2: Design Tokens & Accessibility Nền Tảng (Z-Index Scale, Focus Trap, WAI-ARIA, Reduced Motion)
  ~ Sửa: assets/css/base.css (Định nghĩa thang z-index chuẩn hóa từ --z-base: 1 tới --z-topmost: 9999; bổ sung token --focus-ring, luật :focus-visible và media query @media (prefers-reduced-motion: reduce))
  ~ Sửa: assets/css/fab.css (Xóa bỏ hoàn toàn z-index INT32 MAX 2147483647; đưa .fab-wrap về var(--z-fab, 950) và .fab-backdrop về calc(var(--z-fab) - 5), triệt tiêu xung đột modal bị FAB che đè)
  ~ Sửa: assets/css/components.css (Cập nhật .modal-overlay dùng var(--z-modal-bg, 1000), .modal-box dùng var(--z-modal, 1010), .toast-container dùng var(--z-toast, 2000))
  ~ Sửa: assets/css/app-shell.css (Đưa .app-shell-navbar về var(--z-app-shell, 500) tránh cạnh tranh lớp với modal)
  ~ Sửa: manager/manager.css (Cập nhật .mgr-modal-overlay và .mgr-modal-box dùng thang z-index chuẩn hóa)
  + Tạo: assets/js/core/ModalManager.js (Bộ quản trị Modal trung tâm: Focus Trap luân chuyển phím Tab, Focus Restore tự khôi phục active element khi đóng, WAI-ARIA role="dialog", aria-modal="true", điều phối Escape duy nhất theo modalStack, tự động bind data-close và click backdrop)
  ~ Sửa: index.php, live-band/index.php, learn/index.php, manager/index.php (Nhúng ModalManager.js vào hạ tầng core của toàn bộ 4 trụ cột)
  + Tạo: tests/modal_a11y_regression.php (Bộ test 6 tiêu chí kiểm thử hồi quy Design Tokens, Z-Index, WAI-ARIA & Accessibility)
  ~ Sửa: tests/run_all_tests.php (Tích hợp bước [14/14] kiểm thử Modal & Accessibility vào CI runner)
[2026-09-25] — Hoàn tất G2 Task 2.3: Nền Tảng JS Dùng Chung (TapTempo, MidiEngine, AudioUnlocker, SongLoaderCore, ApiService)
  + Tạo: assets/js/core/TapTempo.js (Bộ tính toán Tap Tempo BPM duy nhất: dải 40-240, trung bình 4 khoảng, timeout 2000ms, đồng bộ EventBus 'taptempo:bpm')
  + Tạo: assets/js/core/MidiEngine.js (Bộ điều khiển Web MIDI phần cứng duy nhất: nhận diện note on/off, pitch class, CC64/CC66/CC67 pedals, cung cấp shims tương thích ngược cho MidiInputEngine)
  + Tạo: assets/js/core/AudioUnlocker.js (Mở khóa AudioContext đồng bộ trên iOS/iPad/Safari, phát silent buffer và cung cấp zero-latency click oscillator hỗ trợ StereoPannerNode phân kênh In-Ear Split)
  + Tạo: assets/js/core/SongLoaderCore.js (Bộ tải điểm số duy nhất: sanitizeXmlPath chuẩn hóa URL, fetchXmlWithChords tải XML và hợp âm song song, tự động inject qua ChordCanvasXML, chuẩn hóa TransposeCalculator cho OSMD)
  ~ Sửa: assets/js/core/ApiService.js (Mở rộng đầy đủ domain practice, manager, cập nhật auth.logout sử dụng HTTP POST an toàn)
  ~ Sửa: assets/js/metronome.js & live-band/live-band.js (Tích hợp TapTempo dùng chung)
  ~ Sửa: assets/js/learn/practice/practice-tracker.js (Gọi API qua ApiService.practice thay vì fetch URL thô)
  ~ Sửa: index.php, live-band/index.php, learn/index.php, manager/index.php (Nhúng các module nền tảng mới vào toàn bộ 4 trụ cột)
  + Tạo: tests/shared_platform_regression.php (Bộ test 7 tiêu chí kiểm thử hồi quy Nền Tảng JS Dùng Chung)
  ~ Sửa: tests/run_all_tests.php (Tích hợp bước [15/15] kiểm thử Shared JS Platform Regression vào CI runner)
  ✅ 7/7 tiêu chí kiểm thử Nền Tảng JS Dùng Chung đạt chuẩn.
  ✅ Task 2.3 (Giai đoạn 2): ĐẠT ACCEPTANCE CRITERIA.
[2026-09-25] — Hoàn tất G2 Task 2.4: Hợp Nhất Dữ Liệu Bộ Hợp Âm (SSOT SQLite, Write-through Cache, Migration 907 sets, Attribution & Fork)
  + Tạo: api/migrations/004_chord_sets_consolidation.php (Bổ sung parent_id, attribution, checksum SHA256 vào bảng user_chord_sets)
  + Tạo: tools/migrate_json_chord_sets_to_db.php (CLI nạp toàn bộ JSON chord sets vào SQLite, hỗ trợ --reconcile, --dry-run, --execute, nạp trọn vẹn 907 files trên 903 bài)
  ~ Sửa: api/services/ChordSetService.php (Hợp nhất SSOT vào bảng user_chord_sets, write-through cache file đĩa, tự động fork và truy vết attribution, bảo vệ CR1 HD default và CR3 Lock HD/TLH)
  ~ Sửa: api/controllers/ChordSetController.php (Mở rộng action fork, details, truyền context user_id và kiểm tra quyền sở hữu)
  ~ Sửa: tests/fixtures/test_db_fixture.php (Bổ sung bảng user_chord_sets đầy đủ khóa ngoại và dữ liệu mẫu)
  + Tạo: tests/chord_sets_consolidation_regression.php (Bộ test 7 tiêu chí kiểm thử hồi quy Hợp Nhất Bộ Hợp Âm)
  ~ Sửa: tests/core_rules_regression.php (Chuẩn hóa kiểm tra return false/return; trong bảo vệ CR3)
  ~ Sửa: tests/run_all_tests.php (Tích hợp bước [16/16] kiểm thử Chord Sets Consolidation vào CI runner)
  ✅ 7/7 tiêu chí kiểm thử Hợp Nhất Bộ Hợp Âm đạt chuẩn.
  ✅ Toàn bộ 16 bộ kiểm thử của hệ thống SheetApp2 đạt 100% PASS.
  ✅ Task 2.4 (Giai đoạn 2): ĐẠT ACCEPTANCE CRITERIA.
[2026-09-25] — Hoàn tất G2 Task 2.5: Gộp Members vào Manager (Single Flow, Role Safety, Anti Self-Demotion, Safe Redirect, Audit Trail)
  + Tạo: api/core/AuditLogger.php (Bộ ghi nhật ký kiểm toán nguyên tử cho mọi thao tác nhạy cảm vào storage/logs/audit.log)
  ~ Sửa: api/services/ManagerService.php (Bổ sung chord_code vào getUsersList, mở rộng manageUser hỗ trợ update_profile, tạo tài khoản gán mã hợp âm, chống tự hạ quyền Admin, chống xóa/khóa Admin duy nhất, ghi nhật ký kiểm toán tự động)
  ~ Sửa: api/controllers/ManagerController.php (Cho phép Ban Hát xem danh sách nhạc công, bắt buộc Auth::requireAdmin cho manage_user)
  ~ Sửa: api/services/UserService.php (Tích hợp AuditLogger, bảo vệ chống tự hạ quyền và bảo vệ Quản Trị Viên cuối cùng)
  ~ Sửa: members/index.php (Chuyển hướng an toàn 302 sang /manager/#tab-users, giữ fallback HTML và SafeHtml cho kiểm thử bảo mật)
  ~ Sửa: includes/toolbar.php & assets/js/chord-canvas.js (Cập nhật đường dẫn chuyển từ /members/ sang /manager/#tab-users)
  ~ Sửa: manager/index.php (Bổ sung cột Mã Hợp Âm vào bảng thành viên, thêm input chord_code trong modal-user, tạo modal-edit-user)
  ~ Sửa: manager/manager.js (Tự động kích hoạt tab qua URL hash/query, bổ sung badge mã hợp âm, nút ✏️ Sửa thành viên, tích hợp xử lý modal-edit-user và phân quyền xem cho Ban Hát)
  ~ Sửa: manager/manager.css (Bổ sung class .mgr-chord-badge giao diện JetBrains Mono nổi bật)
  ~ Sửa: tests/fixtures/test_db_fixture.php (Nạp đầy đủ display_name, instrument, chord_code và status cho seed users)
  + Tạo: tests/members_manager_consolidation_regression.php (Bộ test 7 tiêu chí kiểm thử hồi quy Hợp Nhất Members vào Manager)
  ~ Sửa: tests/run_all_tests.php (Tích hợp bước [17/17] kiểm thử Members & Manager Consolidation vào CI runner)
  ✅ 7/7 tiêu chí kiểm thử Hợp Nhất Members vào Manager đạt chuẩn.
  ✅ Toàn bộ 17 bộ kiểm thử của hệ thống SheetApp2 đạt 100% PASS.
  ✅ Task 2.5 (Giai đoạn 2): ĐẠT ACCEPTANCE CRITERIA.
[2026-09-25] — Hoàn tất G2 Task 2.6: Đơn Giản Hóa Trang Chính Theo Mode & Hợp Nhất Modal Overlays (3 Canonical Modes, Modal ≤ 6, Bottom Sheet, Banner)
  + Tạo: assets/js/core/ModeManager.js (Quản lý tập trung 3 chế độ: 'view', 'edit_chords', 'performance', đồng bộ data-app-mode, sheet-only-mode, chord-edit-mode, wake-lock, và toast feedback)
  ~ Sửa: index.php (Nạp assets/js/core/ModeManager.js ngay sau ModalManager.js)
  ~ Sửa: assets/js/keyboard-handler.js (Đồng bộ phím tắt C -> toggleEditChords, F -> togglePerformance, Escape -> resetToView qua ModeManager)
  ~ Sửa: assets/css/layout.css (Ẩn #fab-wrap, .fab-wrap, #fab-main-btn và toàn bộ chrome trong sheet-only-mode)
  ~ Sửa: assets/css/components.css (Thêm định nghĩa .bottom-sheet hiện đại và .pwa-install-banner nổi không che toàn màn hình)
  ~ Sửa: includes/modals.php (Gộp #create-setlist-modal nội tuyến bên trong #add-to-setlist-modal; chuyển #tempo-pick-modal thành .bottom-sheet; chuyển #pwa-install-modal thành .pwa-install-banner; loại bỏ static duplicate #modal-section-editor; chuẩn hóa số lượng modal overlays trang chính đúng 6 modals cốt lõi)
  ~ Sửa: assets/js/setlist-ui.js (Tích hợp chuyển đổi luồng tạo và chọn setlist trong cùng một modal #add-to-setlist-modal)
  + Tạo: tests/main_page_modes_regression.php (Bộ 7 bài kiểm thử hồi quy Canonical Modes, phím tắt C/F/Esc, ≤6 modal overlays, Bottom Sheet, Banner, bảo toàn dải ±12)
  ~ Sửa: tests/run_all_tests.php (Tích hợp bước [18/18] kiểm thử Main Page Modes & Modal Consolidation vào CI runner)
  ✅ 7/7 tiêu chí kiểm thử Main Page Modes & Modal Consolidation đạt chuẩn.
  ✅ Toàn bộ 18 bộ kiểm thử của hệ thống SheetApp2 đạt 100% PASS.
  ✅ Task 2.6 (Giai đoạn 2): ĐẠT ACCEPTANCE CRITERIA.

[2026-09-25] — Hoàn tất G2 Task 2.7: Tách Các File Lớn Theo Feature Boundary (100% 27 File JS/PHP < 600 Dòng, Explicit Load Order, Zero Regression)
  + Tạo: editor/js/editor-export.js, editor-midi.js, editor-audio.js, editor-ai.js, editor-parser.js, editor-modifiers.js, editor-health.js, editor-drag.js, editor-ui.js (9 submodules phân tách từ 4.126 dòng của editor.js)
  ~ Sửa: editor/editor.js (Rút gọn từ 4.126 dòng thành 565 dòng coordinator)
  ~ Sửa: editor/index.php (Nạp 9 submodules trước editor.js theo đúng thứ tự phụ thuộc)
  + Tạo: live-band/js/stage-room.js, stage-timer.js, stage-audio.js, stage-rehearsal.js, stage-hud.js, stage-catalog.js (6 submodules phân tách từ 2.227 dòng của live-band.js)
  ~ Sửa: live-band/live-band.js (Rút gọn từ 2.227 dòng thành 598 dòng coordinator)
  ~ Sửa: live-band/index.php (Nạp 6 submodules trước live-band.js theo đúng thứ tự phụ thuộc)
  + Tạo: manager/js/manager-repertoire.js, manager-community.js, manager-versions.js, manager-users.js (4 submodules phân tách từ 1.905 dòng của manager.js)
  ~ Sửa: manager/manager.js (Rút gọn từ 1.905 dòng thành 505 dòng coordinator)
  ~ Sửa: manager/index.php (Nạp 4 submodules trước manager.js theo đúng thứ tự phụ thuộc)
  + Tạo: assets/js/chord-canvas-dots.js, chord-canvas-transpose.js, chord-canvas-edit.js (3 submodules phân tách từ 1.396 dòng của chord-canvas.js)
  ~ Sửa: assets/js/chord-canvas.js (Rút gọn từ 1.396 dòng thành 563 dòng coordinator, bảo toàn _chordLoadToken và Core Rule 1 HD default)
  ~ Sửa: index.php (Nạp 3 submodules chord-canvas trước chord-canvas.js)
  + Tạo: assets/js/learn/ui/learn-score.js, assets/js/learn/harmony/learn-satb.js, assets/js/learn/transport/learn-transport-bridge.js, assets/js/learn/ui/learn-controls.js (4 submodules phân tách từ 1.553 dòng của learn-app.js)
  ~ Sửa: assets/js/learn/learn-app.js (Rút gọn từ 1.553 dòng thành 595 dòng coordinator, bảo toàn XSS encoding song.title và chordSym)
  ~ Sửa: learn/index.php (Nạp 4 submodules trước learn-app.js)
  + Tạo: tests/modular_architecture_regression.php (Bộ 7 bài kiểm thử hồi quy: Ngân sách < 600 dòng cho 27 file, Thứ tự nạp script, Không inline JS modals.php, Xuất Window global, Core tokens, Tồn tại vật lý, Chống circular dependency)
  ~ Sửa: tests/run_all_tests.php (Tích hợp bước [19/19] kiểm thử Modular Architecture vào CI runner)
  ✅ 100% (27/27) file modularized đều tuân thủ ngân sách < 600 dòng.
  ✅ Toàn bộ 19 bộ kiểm thử của hệ thống SheetApp2 đạt 100% PASS (106 file PHP lint, 15 security suites, 9 core rules).
[2026-09-25] — Hoàn tất G2 Task 2.8: Tối Ưu Tải Trang Dựa Trên Đo Lường & Vượt Mốc Checkpoint G2 — Go/No-Go (MIDI Lazy, LiveSync On-demand, Fix F13, 20/20 Test Suites PASS)
  ~ Sửa: assets/js/keyboard-handler.js (Gỡ bỏ _initWebMIDI() khỏi init() khi nạp trang chính; xuất enableMIDI() và isMidiEnabled() kích hoạt theo nhu cầu)
  ~ Sửa: assets/js/core/ModeManager.js (Tự động kích hoạt KeyboardHandler.enableMIDI() và LiveSync.ensureLoaded() khi chuyển sang chế độ Biểu Diễn)
  ~ Sửa: assets/js/live-sync.js (Nâng cấp thành On-demand Lazy Loader nạp chuỗi 9 module nặng của Performance Engine & Live Session theo nhu cầu: URL ?room=/?live=, nút #btn-live-sync, hoặc Performance mode)
  ~ Sửa: index.php (Loại bỏ 9 thẻ <script> tĩnh của performance engine; tiêm window.__ASSET_V__ cho cache busting chính xác)
  ~ Sửa: assets/js/chord-canvas.js (Bổ sung bộ nhớ đệm _chordSetsCache tránh gọi trùng lặp ApiService.chordSets.list, vô hiệu hóa cache khi tạo/sao chép/xóa bộ)
  ~ Sửa: assets/js/song-loader.js (Xóa bỏ setTimeout gọi ChordCanvas.refreshSetDropdown() thừa trong loadSong(); tối ưu _autoFitZoom() chỉ gọi setZoom khi tỷ lệ lệch > 3%)
  ~ Sửa: assets/js/app.js (Tối ưu setZoom() bỏ qua re-render OSMD nếu zoom delta < 0.01; kích hoạt LiveSync.init() trên trang chính)
  + Tạo: tests/page_performance_regression.php (Bộ 6 bài kiểm thử: MIDI lazy init, LiveSync lazy loader, Tinh giản thẻ script index.php, Fix F13 deduplication request, Fix F13 double OSMD render, Toàn diện tiêu chuẩn Checkpoint G2)
  ~ Sửa: tests/run_all_tests.php (Tích hợp bước [20/20] kiểm thử Page Performance & Checkpoint G2 vào CI runner)
  ✅ 6/6 tiêu chí kiểm thử Page Performance & Checkpoint G2 đạt chuẩn.
  ✅ Toàn bộ 20 bộ kiểm thử của hệ thống SheetApp2 đạt 100% PASS (107 file PHP lint, 15 security suites, 9 core rules).
  🏆 CHÍNH THỨC VƯỢT CHECKPOINT G2 — GO/NO-GO: ĐỦ ĐIỀU KIỆN TIẾN VÀO GIAI ĐOẠN 3 (NÂNG CẤP GIÁ TRỊ SỬ DỤNG).

[2026-09-25] — Hoàn tất G3 Epic 3.1: Service Plan (Chương Trình Buổi Nhóm, Phân Công Ban Nhạc, Lịch Sử Phụng Vụ, 21/21 CI Test Suites PASS)
  + Tạo: api/migrations/005_service_plan_and_assignments.php (Migration mở rộng setlists: service_time, theme, description, status, leader_user_id; setlist_items: item_type, custom_title, leader_notes, duration_minutes; tạo bảng service_plan_assignments & song_usage_history)
  ~ Sửa: tests/fixtures/test_db_fixture.php (Đồng bộ schema bảng mới và foreign key cascade vào in-memory test database)
  ~ Sửa: api/services/SetlistService.php (Bổ sung isLeaderOrOwner, isAssignmentOwner, publish, assignUser, removeAssignment, respondAssignment, getAssignments, recordSongUsage, getSongUsageHistory kèm AuditLogger và tương thích schema linh hoạt)
  ~ Sửa: api/controllers/SetlistController.php (Bổ sung actions: update, publish, assign, remove_assignment, respond_assignment, song_usage kèm Auth::requireLogin() cho từng action)
  ~ Sửa: assets/js/core/ApiService.js (Mở rộng module setlists và xuất alias servicePlans với đầy đủ 6 endpoints)
  ~ Sửa: includes/modals.php (Bổ sung trường service_time và theme vào form tạo chương trình phụng vụ)
  + Tạo: assets/js/modals/ServicePlanAssignModal.js (Modal chuyên biệt quản lý phân công thành viên, dropdown nhân sự từ API, gỡ phân công, cập nhật tức thì < 600 dòng)
  ~ Sửa: index.php (Nạp assets/js/modals/ServicePlanAssignModal.js)
  ~ Sửa: assets/js/setlist-ui.js (Hiển thị giờ, chủ đề, tag trạng thái, dải banner phân công riêng của user kèm nút xác nhận/báo bận, nút Phát Hành và Phân Công)
  ~ Sửa: assets/js/song-info-bar.js (Thêm _loadSongUsageChip hiển thị số lần bài hát đã được dùng trong phụng vụ và ngày gần nhất)
  + Tạo: tests/service_plan_regression.php (Bộ 6 bài kiểm thử: Lifecycle & Audit trail, CR4 Items & Liturgical types, Assignments & Response, Song Usage History, RBAC & Permissions, Controller & Frontend Contract)
  ~ Sửa: tests/run_all_tests.php (Tích hợp bước [21/21] kiểm thử Service Plan & Assignments vào CI runner)
  ✅ 6/6 tiêu chí kiểm thử Service Plan đạt chuẩn.
  ✅ Toàn bộ 21 bộ kiểm thử của hệ thống SheetApp2 đạt 100% PASS (109 file PHP lint, 15 security suites, 9 core rules).
  🏆 CHÍNH THỨC HOÀN THÀNH EPIC 3.1 — SERVICE PLAN TRONG GIAI ĐOẠN 3.

[2026-09-25] — Hoàn tất G3 Epic 3.2: Offline Setlist Đáng Tin Cậy (Package Manifest, Pre-cache XML, Checksum Strict, Offline Fallback, 22/22 CI Test Suites PASS)
  ~ Sửa: api/services/SetlistService.php (Bổ sung getOfflinePackage xuất manifest đầy đủ: setlist, items, songs metadata, size/mtime/crc32, chord sets JSON cho profile đã chọn & HD mặc định theo CR1, package_version content-addressable)
  ~ Sửa: api/controllers/SetlistController.php (Bổ sung xử lý action=offline_package / manifest)
  ~ Sửa: assets/js/core/ApiService.js (Thêm endpoint getOfflinePackage vào service module setlists)
  + Tạo: assets/js/core/OfflineSetlistManager.js (Module chuyên biệt 347 dòng < 600: Quản lý tải gói, pre-cache CacheStorage 'sheetapp-musicxml-v4', verify tính toàn vẹn 100%, tra cứu offline fallback và xoá/thu hồi gói)
  ~ Sửa: index.php (Nạp assets/js/core/OfflineSetlistManager.js ngay sau ServiceWorkerManager.js)
  ~ Sửa: assets/js/setlist-ui.js (Tích hợp badge trạng thái '⚡ Sẵn sàng offline (x/y)', nút tải/cập nhật/xoá gói, thanh progress bar, tự động fallback sang offline storage khi mất mạng trong fetchSetlists, viewSetlistDetail, ensureSongsLoaded, playCurrentItem)
  ~ Sửa: assets/js/chord-canvas.js (Tích hợp fallback sang OfflineSetlistManager.getOfflineChords khi nạp hợp âm ngoại tuyến)
  + Tạo: tests/offline_setlist_regression.php (Bộ 6 bài kiểm thử: Backend Package Contract, Strict Readiness Check, Package Lifecycle & Version change, Controller & Route Handling, Frontend Offline Fallback, Service Worker v4 Compatibility)
  ~ Sửa: tests/run_all_tests.php (Tích hợp bước [22/22] kiểm thử Offline Setlist vào CI runner)
  ✅ 6/6 tiêu chí kiểm thử Offline Setlist đạt chuẩn.
[2026-09-25] — Hoàn tất G3 Epic 3.3: Live Sync v2 (SSE Streaming, Event ID, Bounded Replay Ring Buffer, Exactly-Once Cue, Synchronized Count-In, 23/23 CI Test Suites PASS)
  ~ Sửa: api/services/LiveSyncService.php (Bổ sung lastEventId EVT-{room}-{rev}-{hash}, events ring buffer 30 phần tử, Exactly-Once Cue metadata với cueId/createdAt/expiresAt, countInStartServerTime microtime buffer +0.15s, pollRoom trả về replayEvents cho follower rớt mạng, và streamEvents xuất Server-Sent Events với keep-alive và ping định kỳ)
  ~ Sửa: api/controllers/LiveSyncController.php (Bổ sung xử lý action=events / sse kích hoạt luồng SSE)
  ~ Sửa: assets/js/performance/live-transport.js (Triển khai class SSETransport kế thừa LiveTransport 305 dòng < 600, kết nối EventSource tự động fallback sang PollingTransport sau 3 lỗi)
  ~ Sửa: assets/js/performance/live-session.js (Khởi tạo _transport bằng SSETransport với fallback polling)
  ~ Sửa: assets/js/performance/performance-engine.js (Bổ sung Set _processedCueIds lọc trùng lặp cue theo cueId và expiresAt, đọc countInStartServerTime cho đếm nhịp chuẩn bị)
  + Tạo: tests/live_sync_v2_regression.php (Bộ 6 bài kiểm thử: Room Creation & State Snapshot, Sequential Event ID & Updates, Exactly-Once Cue Delivery, Bounded Replay Ring Buffer 30 events, Synchronized Count-In, Mô phỏng 1 Host + 10 Followers 100 lần chuyển trạng thái đạt 100% tính toàn vẹn và 0 cue lặp)
  ~ Sửa: tests/run_all_tests.php (Tích hợp bước [23/23] kiểm thử Live Sync v2 vào CI runner)
  ✅ 6/6 tiêu chí kiểm thử Live Sync v2 đạt chuẩn.
  ✅ Toàn bộ 23 bộ kiểm thử của hệ thống SheetApp2 đạt 100% PASS (112 file PHP lint, 15 security suites, 9 core rules).
[2026-09-25] — Hoàn tất G3 Epic 3.4: Projector theo Service Plan (Mục Phụng Vụ Non-Song, Safe Slide Chunking, XSS Defense, SSE Transport, Reconnection, 24/24 CI Test Suites PASS)
  ~ Sửa: api/services/LiveSyncService.php (Hỗ trợ trường servicePlanItem trong createRoom và updateRoom với eventType service_plan_item)
  ~ Sửa: assets/js/performance/live-session.js (Cập nhật broadcastState tự động đóng gói servicePlanItem từ currentSetlist)
  ~ Sửa: live-band/projector.php (Nâng cấp toàn diện 553 dòng < 600 dòng: Giao diện nhà thờ tối ưu màn hình LED/Projector, thanh công cụ Blank 'B', chỉnh cỡ chữ 'A+'/'A-', chuyển slide thủ công, hiển thị breadcrumb phụng vụ [Mục x/y], hỗ trợ mục không phải bài hát (prayer, scripture, liturgy), thuật toán gom measures thành slide an toàn, 100% bọc qua SafeHtml.escape/htmlspecialchars, chuyển sang SSETransport có fallback polling)
  + Tạo: tests/projector_service_plan_regression.php (Bộ 6 bài kiểm thử: Service Plan Item Contract, Non-Song Liturgical Items, XSS Defense & Output Encoding, MusicXML Lyric Slide Chunking Algorithm, Host Remote Navigation & Measure Tracking, Projector Reconnection & State Recovery)
  ~ Sửa: tests/run_all_tests.php (Tích hợp bước [24/24] kiểm thử Projector theo Service Plan vào CI runner)
  ✅ 6/6 tiêu chí kiểm thử Projector theo Service Plan đạt chuẩn.
  ✅ Toàn bộ 24 bộ kiểm thử của hệ thống SheetApp2 đạt 100% PASS (113 file PHP lint, 15 security suites, 9 core rules).
  🏆 CHÍNH THỨC HOÀN THÀNH EPIC 3.4 — PROJECTOR THEO SERVICE PLAN TRONG GIAI ĐOẠN 3.

[2026-09-25] — Hoàn tất G3 Epic 3.5: Tìm Kiếm FTS5 và Taxonomy Mùa/Chủ Đề (Virtual Table songs_fts, Unicode61 Diacritics, BM25 Ranking, Taxonomy Filters, 25/25 CI Test Suites PASS)
  + Tạo: api/migrations/006_fts5_search_and_taxonomy.php (Mở rộng songs với liturgical_season, theme, composer, tags, lyrics_text; tạo FTS5 songs_fts với unicode61 remove_diacritics 2, cột title_unaccented & lyrics_unaccented, index tối ưu và backfill dữ liệu)
  ~ Sửa: tests/fixtures/test_db_fixture.php (Đồng bộ schema songs và songs_fts cho in-memory test database)
  ~ Sửa: api/core/DB.php (Bổ sung alias helper DB::pdo() trỏ về DB::get())
  ~ Sửa: api/services/SongService.php (Bổ sung removeAccents, getTaxonomy, syncSongFts, rebuildFtsIndex, search FTS5 + BM25 relevance tiers kèm graceful fallback LIKE search)
  ~ Sửa: api/controllers/SongController.php (Bổ sung action search, taxonomy, rebuild_fts)
  ~ Sửa: assets/js/core/ApiService.js (Mở rộng ApiService.songs với search, getTaxonomy, rebuildFts)
  ~ Sửa: includes/sidebar.php (Thêm 2 dropdown bộ lọc Mùa phụng vụ và Chủ đề bên dưới ô tìm kiếm)
  ~ Sửa: assets/js/library-ui.js (Nâng cấp 584 dòng < 600: Tích hợp debounced FTS search, render chip taxonomy và snippet lời bài hát khớp từ khóa)
  + Tạo: tests/fts5_taxonomy_search_regression.php (Bộ 6 bài kiểm thử: FTS5 Virtual Table & Schema, Accent-Insensitive Search, BM25 Relevance Ranking, Liturgical Season & Theme Filters, Auto-Sync & Rebuild, SLA Benchmark 100 queries chỉ mất 10.8ms)
  ~ Sửa: tests/run_all_tests.php (Tích hợp bước [25/25] kiểm thử FTS5 Search & Taxonomy vào CI runner)
  ✅ 6/6 tiêu chí kiểm thử FTS5 Search & Taxonomy đạt chuẩn.
  ✅ Toàn bộ 25 bộ kiểm thử của hệ thống SheetApp2 đạt 100% PASS (115 file PHP lint, 15 security suites, 9 core rules).
  🏆 CHÍNH THỨC HOÀN THÀNH EPIC 3.5 — TÌM KIẾM FTS5 VÀ TAXONOMY MÙA/CHỦ ĐỀ TRONG GIAI ĐOẠN 3.

[2026-09-25] — Hoàn tất G3 Epic 3.6: Tiến Độ Tập Thật trong Learn & Góc Nhìn Ca Trưởng có Consent (Real Accuracy, SendBeacon Atomic Flush, Personal Dashboard, Leader Consent View, 26/26 CI Test Suites PASS)
  + Tạo: api/migrations/007_practice_metrics_and_consent.php (Mở rộng practice_sessions với notes_total, notes_correct, timing_score; thêm consent_practice_share vào users; tạo index tối ưu truy vấn dashboard và ca trưởng)
  ~ Sửa: api/migrations/001_initial_schema.php & tests/fixtures/test_db_fixture.php (Đồng bộ schema hiện đại cho practice_sessions và practice_measure_stats cho fresh install)
  ~ Sửa: api/services/PracticeService.php (Tính toán accuracy động không hard-code, atomic flush batch stats từ pagehide beacon, cung cấp getPersonalDashboard với 30-day heatmap & weak measures, setConsent, và getLeaderView bảo vệ riêng tư/ẩn danh thành viên chưa consent)
  ~ Sửa: api/controllers/PracticeController.php (Bổ sung actions: dashboard, leader_view có RBAC kiểm soát nghiêm ngặt, consent, và hỗ trợ payload beacon gộp stats trong finish)
  ~ Sửa: assets/js/core/ApiService.js (Mở rộng ApiService.practice với getDashboard, getLeaderView, setConsent, getProgress)
  ~ Sửa: assets/js/learn/practice/practice-tracker.js (Tính accuracy động theo note hits, gộp batch stats khi flush beacon bằng navigator.sendBeacon hoặc fetch keepalive)
  ~ Sửa: assets/js/learn/practice/melody-practice-engine.js (Hook nốt đúng/sai vào PracticeTracker theo thời gian thực)
  + Tạo: assets/js/learn/ui/learn-dashboard-ui.js (Module 275 dòng < 600: Điều khiển modal Bảng Tiến Độ Cá Nhân & Góc Nhìn Ca Trưởng có consent)
  ~ Sửa: learn/index.php & learn/learn.css (Tích hợp nút Tiến độ trên header, dialog Tiến độ luyện tập thật, KPI grid, 30-day activity heatmap, weak measures list, toggle consent switch, và leader table)
  + Tạo: tests/learn_real_progress_regression.php (Bộ 6 bài kiểm thử: Real Accuracy calculation, Reliable pagehide/beacon batch flush, Personal Dashboard data contract, Leader View with Consent protection, RBAC & Consent enforcement, Data Traceability from source events)
  ~ Sửa: tests/run_all_tests.php (Tích hợp bước [26/26] kiểm thử Learn Real Progress & Leader View vào CI runner)
[2026-09-26] — Hoàn tất Đợt Nâng Cấp Toàn Diện G3.9: Modular Architecture, A11y, App Shell & Quality Assurance
  + Tách module: assets/js/setlist-ui.js (1.116 dòng) tách thành 4 module con + 1 facade (mỗi file ≤ 400 dòng):
      - setlist-list.js (256 dòng): Danh sách Setlist, tạo mới, chỉnh sửa, lọc tìm kiếm, xóa set
      - setlist-detail.js (383 dòng): Chi tiết bài hát, thêm/xóa bài, kéo thả reorder, metadata
      - setlist-player.js (161 dòng): Bộ điều khiển phát tuần tự, phím tắt next/prev, bảo toàn BPM
      - service-plan-ui.js (351 dòng): Soạn thảo & phân công tiết mục phụng vụ (CR4)
      - setlist-ui.js (248 dòng): Facade kết nối tương thích ngược 100% với window.SetlistUI
  + Tách module: assets/js/learn/accompaniment/pattern-engine.js (706 dòng) tách thành 3 module (mỗi file ≤ 400 dòng):
      - pattern-scheduler.js (82 dòng): Quản lý vòng lặp Tone.Transport clock scheduler
      - pattern-generator.js (392 dòng): Sinh nốt tự thích ứng với 13 phong cách đệm chân thực
      - pattern-engine.js (135 dòng): Facade & State Coordinator, giữ 100% API window.PatternEngine
  + Tối ưu A11y Modal: Chuẩn hóa đầy đủ role="dialog", aria-modal, aria-labelledby trên toàn bộ 10 modals; loại bỏ hoàn toàn registerModal; tích hợp ModalManager.open/close cho mọi module; Focus Trap capture phase tuần hoàn + Focus Restore chính xác (E2E-a11y PASS 6/6 Chromium & WebKit).
  + Thống nhất App Shell: Nhúng includes/app_nav.php, app-shell.css, AppShell.js, ModalManager.js vào editor/index.php và huong-dan/index.php. Projector cố ý không có shell. E2E app-shell-tour (e2e/app-shell-tour.spec.js) PASS 7/7 trên cả Chromium & WebKit đi vòng 6 trang đều có nav và console sạch.
  + Công cụ đo đếm số liệu: Tạo tools/metrics.php quét trực tiếp từ codebase: in Top file lớn nhất, kiểm toán 0 fetch() ngoài ApiService (Đạt chuẩn G2), thống kê 10 modal chuẩn a11y, 48 suites / 914 checks PASS.
  + Đột biến có chủ đích (Mutation Check): Phá có chủ đích 5/5 vị trí trọng yếu và ghi nhận 100% phát hiện lỗi vào docs/QA_MUTATION_LOG.md.
  + Quy trình AI & Git: Cập nhật AI_AGENT.md chuyển quy tắc auto-sync sang chuẩn bị commit trên nhánh để chủ dự án duyệt merge.
[2026-09-26] — Bắt đầu Giai đoạn 4: Hoàn tất Epic 4.0 Lát 4.0-a (Vai trò Ca Trưởng `leader`, Ma trận quyền RBAC & Bè ca đoàn)
  + Tạo: api/migrations/008_leader_role.php (Mở rộng users với voice_part S/A/T/B/INSTR, tạo chỉ mục idx_users_role_voice)
  + Tạo: api/core/AuthPolicy.php (Ma trận quyền RBAC tập trung 4 roles x 6 capabilities = 24 cases: view_songs, edit_songs, assign_practice, review_chord_set, view_team_progress, manage_users)
  ~ Sửa: api/core/Auth.php (Thêm Auth::isLeader(), Auth::requireLeader(), kế thừa Auth::isBanhat() cho leader/admin, bổ sung voice_part vào user())
  ~ Sửa: api/services/UserService.php (Hỗ trợ role 'leader' và voice_part trong createWithProfile, updateMusician, getAll, findByUsername, findById)
  ~ Sửa: api/services/ManagerService.php (Cập nhật getUsersList lấy voice_part, manageUser hỗ trợ role 'leader' và cập nhật voice_part cho create/update/role)
  ~ Sửa: api/controllers/UserController.php & AuthController.php (Hỗ trợ role 'leader' và voice_part trong login session/me và user CRUD)
  ~ Sửa: manager/index.php & manager/js/manager-users.js (Thêm tùy chọn '👑 Ca Trưởng' và selector Bè ca đoàn trong modal tạo/sửa user, hiển thị badge Bè và Ca Trưởng)
  + Tạo: tests/security/auth_matrix_regression.php (Bộ kiểm thử 44 checks xác thực toàn diện ma trận quyền hạn HTTP, helpers và database)
  + Tạo: e2e/leader-role.spec.js (Playwright E2E test: Admin phân quyền Ca Trưởng và gán Bè cho thành viên, xác thực hiển thị và lưu trữ bền vững trên Chromium & WebKit)
  ~ Sửa: tests/fixtures/test_db_fixture.php & tests/http/weak_password_http_regression.php (Đồng bộ cột voice_part trong in-memory/temporary test fixtures)
  ✅ E2E Playwright e2e/leader-role.spec.js PASS trên cả Chromium (4.2s) và WebKit (6.7s).
  ✅ Toàn bộ 49 regression suites trong test.bat đạt 100% PASS (959 checks passed, 0 failed).
[2026-09-26] — Hoàn tất Giai đoạn 4: Epic 4.0 Lát 4.0-b & 4.0-c (Sự Kiện Domain, Trung Tâm Thông Báo & Nghiệm Thu 4.0)
  + Tạo: api/migrations/009_domain_events_and_notifications.php (Tạo bảng domain_events và notifications kèm các chỉ mục idx_domain_events_type_created, idx_domain_events_subject, idx_notifications_user_read)
  + Tạo: api/services/DomainEventService.php (Cung cấp DomainEvents::record ghi nhận sự kiện domain sau transaction và tự động kích hoạt NotificationService::fanOut)
  + Tạo: api/services/NotificationService.php (Dịch vụ quản lý thông báo người dùng: create, getList kèm phân trang và unread_count, getUnreadCount, markRead, markAllRead, và fanOut tự động tạo thông báo khi plan.published hoặc assignment.created)
  + Tạo: api/controllers/NotificationController.php (Điều phối route=notifications với actions: list, count, mark_read, mark_all_read kiểm soát qua Auth::requireLogin)
  ~ Sửa: api/index.php (Đăng ký router notifications)
  ~ Sửa: api/services/SetlistService.php (Tự động gọi DomainEvents::record khi publish service plan và assignUser)
  ~ Sửa: assets/js/core/ApiService.js (Mở rộng ApiService.notifications: list, count, markRead, markAllRead)
  ~ Sửa: includes/app_nav.php (Nhúng widget chuông thông báo #shell-notif-widget và dropdown #shell-notif-dropdown trên App Shell, thêm nhãn Ca trưởng)
  ~ Sửa: assets/css/app-shell.css (Thêm toàn bộ kiểu dáng giao diện cho chuông thông báo, badge pulse, dropdown mượt mà, item unread, scrollbar)
  ~ Sửa: assets/js/core/AppShell.js (Khởi tạo thông báo, badge unread, toggle dropdown, mark read khi click, mark all read, retry chống race condition, và polling tự động 60s)
  ~ Sửa: index.php (Thêm session_start ở đầu file để bảo toàn session ngay từ render đầu tiên, đưa SafeHtml/ApiService trước AppShell)
  + Tạo: tools/setup_e2e_notification.php (CLI helper chuẩn bị và dọn dẹp dữ liệu kiểm thử E2E thông báo)
  + Tạo: tests/domain_events_and_notifications_regression.php (Bộ 21 kiểm thử: Schema SQLite, DomainEvents::record, NotificationService CRUD & Isolation, và Pipeline Fan-Out tự động)
  + Tạo: e2e/notifications-flow.spec.js (Playwright E2E: Tạo Service Plan -> Publish -> Thành viên thấy chuông +1 -> Mở xem nội dung -> Đọc tất cả -> Badge biến mất)
  ✅ E2E Playwright e2e/notifications-flow.spec.js PASS 2/2 trên Chromium (2.1s) và WebKit (2.8s).
  ✅ E2E Playwright e2e/leader-role.spec.js PASS 2/2 trên Chromium (2.4s) và WebKit (4.2s).
  ✅ Toàn bộ 50 regression suites trong test.bat đạt 100% PASS (981 checks passed, 0 failed).
  🏆 CHÍNH THỨC HOÀN THÀNH 100% TOÀN BỘ EPIC 4.0: NỀN TẢNG GIAI ĐOẠN 4.
[2026-09-26] — Hoàn tất Giai đoạn 4: Epic 4.1 (Giao bài & Tập bè cho ca đoàn)
  + Tạo: api/migrations/010_practice_assignments.php (Tạo bảng practice_assignments, practice_assignment_targets và mở rộng practice_sessions với cột assignment_id)
  + Cập nhật: tests/fixtures/test_db_fixture.php (Đồng bộ lược đồ CSDL in-memory test fixture cho practice_assignments & targets)
  + Tạo: api/services/PracticeAssignmentService.php (Cung cấp createFromServicePlan, createAdHoc, getMyAssignments, getTeamBoard kèm Privacy Rule D10, recordProgress với 3 luật hoàn thành manual/accuracy/minutes, markDone, markExcused, archive)
  ~ Sửa: api/services/PracticeService.php (Hỗ trợ assignment_id khi startSession và tự động trigger PracticeAssignmentService::recordProgress khi finishSession)
  + Tạo: api/controllers/PracticeAssignmentController.php (Điều phối route=practice_assignments với actions: mine, board, detail, create_from_plan, create, mark_done, mark_excused, archive; kiểm soát quyền RBAC qua AuthPolicy)
  ~ Sửa: api/controllers/PracticeController.php (Tiếp nhận assignment_id trong startSession)
  ~ Sửa: api/index.php (Đăng ký router practice_assignments)
  ~ Sửa: assets/js/core/ApiService.js (Mở rộng ApiService.practiceAssignments với đầy đủ 8 phương thức chuẩn)
  ~ Sửa: assets/js/learn/practice/practice-tracker.js (Tiếp nhận và gửi assignmentId lên API khi bắt đầu phiên tập)
  ~ Sửa: assets/js/learn/learn-app.js (Đọc query params assignment, part, bpm, trans; tự động solo đúng bè SATB, đặt đúng BPM, gán assignment_id vào session; tối ưu ngân sách dòng < 600)
  + Tạo: assets/js/learn/ui/learn-assignments-ui.js (Modal "Bài tập của tôi" cho ca viên: bộ lọc thẻ, hiển thị bè màu sắc riêng, hạn chót, yêu cầu, nút "Tập ngay", nút "Đã thuộc" với cơ chế chống race condition)
  ~ Sửa: learn/index.php & learn/learn.css (Nút "📋 Bài tập" trên Header kèm badge số lượng realtime, markup modal #modal-learn-assignments, nhúng learn-assignments-ui.js)
  + Tạo: assets/js/modals/PracticeTeamBoardModal.js (Modal theo dõi tiến độ ca đoàn Ca viên × Bài hát dành cho Ca Trưởng/Admin)
  ~ Sửa: assets/js/service-plan-ui.js & index.php (Thêm nút "📋 Giao Tập" và "📊 Tiến Độ Tập" cho Ca Trưởng/Admin)
  ~ Sửa: tests/http/live_sync_session_lock_http_regression.php (Xử lý dọn dẹp triệt để file rò rỉ sau khi ngắt kết nối SSE)
  + Tạo: tests/practice_assignments_regression.php (Bộ 33 kiểm thử: Lược đồ CSDL, Tạo từ Service Plan chống trùng lặp, Ad-hoc, My assignments, 3 luật hoàn thành, Quyền riêng tư Privacy D10, RBAC AuthPolicy)
  + Tạo: tools/setup_e2e_practice_assignment.php (CLI helper chuẩn bị và dọn dẹp dữ liệu kiểm thử E2E)
  + Tạo: e2e/practice-assignments.spec.js (Playwright E2E: Ca viên xem bài tập được giao và đánh dấu "Đã thuộc")
  ✅ E2E Playwright e2e/practice-assignments.spec.js PASS 2/2 trên Chromium (2.9s) và WebKit (3.8s).
  ✅ Toàn bộ 51 regression suites trong test.bat đạt 100% PASS (1015 checks passed, 0 failed).
[2026-09-26] — Hoàn tất Giai đoạn 4: Epic 4.3 (Xuất ChordPro / PDF & Báo cáo Lịch sử Sử dụng Bài)
  + Tạo: api/services/TransposeHelper.php (Dịch giọng 12 bán âm (+/-), tự nhận diện sharp/flat, xử lý slash chords C/E, Bb/D, đạt 100% parity 756/756 phép chuyển giọng với JS TransposeEngine)
  + Tạo: api/services/ChordProService.php (Trích xuất lời nốt MusicXML lyric/syllabic, nối âm tiết chuẩn ngữ pháp tiếng Việt, tích hợp bộ hợp âm SSOT ưu tiên HD theo Core Rule 1, dịch tông động cả nhãn {key} và hợp âm inline [Chord], đồng bộ ngắt câu thơ Verses 1-4)
  + Tạo: api/controllers/ExportController.php (Điều phối route=export, format=chordpro, hỗ trợ tải file attachment và JSON format as_json=1, bảo vệ lỗi hệ thống qua Response::serverError)
  ~ Sửa: api/index.php (Đăng ký router export)
  + Tạo: print/chord-sheet.php (Bản in Lời + Hợp âm chuyên dụng A4 qua window.print(), phân tích ChordPro thành DOM chữ kèm hợp âm nổi, hỗ trợ 1 cột hoặc 2 cột cho bài dài, cỡ chữ tùy chỉnh, ẩn/hiện hợp âm, dịch giọng trực tiếp)
  + Tạo: print/service-booklet.php (Booklet Phụng Vụ / Tập bài buổi nhóm A4: Trang 1 bìa chương trình Order of Service + Trang 2+ mỗi bài 1 trang ngắt trang chuẩn A4 theo đúng tông/profile/BPM trong setlist theo Core Rule 4)
  ~ Sửa: assets/js/song-info-bar.js (Thêm nút in "🖨️ In Lời & Hợp âm" si-ni-print-btn mở chord-sheet.php)
  ~ Sửa: assets/js/service-plan-ui.js (Thêm nút "📖 In Booklet" btn-sp-print-booklet mở service-booklet.php)
  ~ Sửa: api/services/SetlistService.php (Bổ sung checkRecentUsage kiểm tra bài dùng trong N tuần theo D15 và getUsageReport thống kê toàn diện lịch sử phụng vụ)
  ~ Sửa: api/controllers/SetlistController.php (Tiếp nhận actions: check_recent_usage và usage_report)
  ~ Sửa: assets/js/core/ApiService.js (Mở rộng ApiService.setlists với checkRecentUsage và usageReport, ApiService.export với chordproUrl/chordproJson/chordproText)
  ~ Sửa: assets/js/setlist-detail.js (Tích hợp kiểm tra lặp bài khi thêm bài vào Setlist: hiển thị cảnh báo D15 kèm số tuần, ngày, buổi lễ; không chặn quyền thêm)
  + Tạo: manager/js/manager-usage.js (Module thống kê phụng vụ: KPI cards, bảng Top bài dùng nhiều, bảng kho bài tiềm năng chưa dùng, bảng nhật ký phụng vụ gần nhất)
  ~ Sửa: manager/index.php & manager/manager.js (Tích hợp tab "📊 Thống Kê Phụng Vụ" #tab-usage và khởi tạo ManagerUsage)
  + Tạo: tests/chordpro_export_regression.php (Bộ 25 kiểm thử: Transpose Parity 756/756, Directives, Nối âm tiết, Core Rule 1, Transpose động, HTTP API)
  + Tạo: tests/liturgical_export_and_usage_regression.php (Bộ 41 kiểm thử: In Chord Sheet, In Booklet A4, Cảnh báo lặp D15, Báo cáo sử dụng, Tích hợp UI)
  ✅ Toàn bộ 53 regression suites trong test.bat đạt 100% PASS (1081 checks passed, 0 failed).
  🏆 CHÍNH THỨC HOÀN THÀNH 100% TOÀN BỘ EPIC 4.3: XUẤT CHORDPRO / PDF & BÁO CÁO LỊCH SỬ SỬ DỤNG BÀI.

[2026-09-26] — Hoàn tất Giai đoạn 4: Epic 4.2 (Quy trình Duyệt Bộ Hợp Âm & Phiên Bản MusicXML)
  + Tạo: api/migrations/011_review_workflow.php (Tạo bảng review_requests, chord_set_history; mở rộng user_chord_sets và song_versions với review_status, approved_by, approved_at)
  + Cập nhật: tests/fixtures/test_db_fixture.php (Đồng bộ đầy đủ schema review_requests và chord_set_history cho in-memory SQLite fixture)
  + Tạo: api/services/ReviewDiffEngine.php (Động cơ so sánh khác biệt: chuẩn hóa hợp âm, phân tích nốt added, modified, removed, unchanged theo ô nhịp, tính diff.summary)
  + Tạo: api/services/ReviewService.php (Dịch vụ duyệt toàn diện: submit, getQueue, getMyRequests, getDetail, approve với Core Rule 1 & 4, reject bắt buộc có lý do, withdraw, rollbackHd, getHdHistory)
  + Tạo: api/controllers/ReviewController.php (Điều phối route=reviews với các action: submit, queue, mine, detail, approve, reject, withdraw, rollback_hd, hd_history; bảo vệ mã lỗi bằng Response::serverError)
  ~ Sửa: api/index.php (Đăng ký router reviews)
  ~ Sửa: api/services/ManagerService.php (Gỡ bỏ đường tắt tự ý ghim: toggleRecommend và toggleVersionRecommend bắt buộc kiểm tra quyền review_chord_set)
  ~ Sửa: assets/js/core/ApiService.js (Mở rộng facade window.ApiService.reviews đầy đủ 8 phương thức chuẩn)
  + Tạo: manager/js/manager-reviews.js (Controller quản lý hàng đợi phê duyệt, inspector modal, prompt submit review; 342 dòng tuân thủ ngân sách < 600 dòng)
  ~ Sửa: manager/index.php (Thêm tab "📥 Chờ Duyệt" #tab-reviews, badge pending thời gian thực, bảng hàng đợi, modal Visual Diff Inspector #modal-review-diff, nhúng manager-reviews.js)
  ~ Sửa: manager/js/manager-community.js (Tích hợp badge "⏳ Chờ duyệt" và nút "🚀 Duyệt" trên từng thẻ chord set)
  ~ Sửa: manager/js/manager-repertoire.js (Tích hợp badge và nút đề xuất duyệt trong Song Inspector Panel)
  + Tạo: tests/review_workflow_regression.php (Bộ 45 kiểm thử toàn diện: Migration 011, Diff Engine, Submission, Supersede, RBAC Guard, Recommend, Update HD & Rollback CR1/CR4, Reject có lý do, Withdraw, Anti-Bypass Guard)
  ✅ Toàn bộ 54 regression suites trong test.bat đạt 100% PASS (1120 checks passed, 0 failed).
  🏆 CHÍNH THỨC HOÀN THÀNH 100% TOÀN BỘ EPIC 4.2: QUY TRÌNH DUYỆT BỘ HỢP ÂM & PHIÊN BẢN MUSICXML.

[2026-09-26] — Hoàn tất Giai đoạn 4: Epic 4.4 (Thông báo đa kênh theo lựa chọn người dùng — Notification Preferences & Deliveries)
  + Tạo: api/migrations/012_notification_preferences.php (Tạo bảng notification_preferences, notification_deliveries; mở rộng bảng users với email, email_verified_at, quiet_hours_start, quiet_hours_end)
  + Cập nhật: tests/fixtures/test_db_fixture.php (Đồng bộ schema bảng mới và các cột mới vào fixture SQLite in-memory)
  + Tạo: api/services/NotificationPreferenceService.php (Quản lý ma trận tùy chọn người dùng, kiểm tra cú pháp email và giờ yên lặng, hỗ trợ cả khung giờ qua đêm 22:00-07:00 và trong ngày 13:00-15:00)
  + Cập nhật: api/services/NotificationService.php (Nâng cấp pipeline fanOut định tuyến đa kênh thông minh: In-app + Email Queue + Push)
  + Tạo: api/services/NotificationDeliveryService.php (Quản lý hàng đợi chuyển phát, tôn trọng giờ yên lặng deferred, cơ chế retry tối đa 3 lần, gửi SMTP cấu hình qua ENV hoặc File Log Mock an toàn trong storage/logs/mail/, template email HTML responsive chuẩn nhận diện SheetApp)
  + Tạo: api/controllers/NotificationPreferenceController.php (Điều phối route=notification_preferences với actions: get, update, update_settings; bảo vệ lỗi hệ thống qua Response::serverError)
  + Cập nhật: api/index.php (Đăng ký router notification_preferences)
  + Tạo: tools/notification_worker.php (CLI worker xử lý hàng đợi chuyển phát, bảo mật chặn truy cập web HTTP 403)
  + Tạo: tools/assignment_due_reminder.php (CLI job quét bài tập sắp đến hạn trong 48h, tạo sự kiện assignment.due_soon, chống gửi trùng trong 24h, chặn truy cập web HTTP 403)
  + Cập nhật: assets/js/core/ApiService.js (Mở rộng facade window.ApiService.notificationPreferences đầy đủ các phương thức chuẩn)
  + Tạo: manager/js/manager-notifications.js (Quản lý UI ma trận kênh × sự kiện, cài đặt email và Quiet Hours; chỉ 110 dòng, tuân thủ ngân sách < 600 dòng)
  + Cập nhật: manager/index.php & manager/manager.js (Thêm tab "🔔 Tùy Chọn Thông Báo" #ptab-notifs trong Profile Manager, kết nối ApiService và khởi tạo ManagerNotifications)
  ✅ Toàn bộ 55 regression suites trong test.bat đạt 100% PASS (1165 checks passed, 0 failed).
  🏆 CHÍNH THỨC HOÀN THÀNH 100% TOÀN BỘ EPIC 4.4: THÔNG BÁO ĐA KÊNH THEO LỰA CHỌN NGƯỜI DÙNG.

[2026-09-26] — Hoàn tất 100% Các Chỉ Số KPI & Kiểm Thử E2E Giai đoạn 4
  ~ Tối ưu: assets/js/library-ui.js (Refactor loại bỏ trùng lặp trong loadSongs, tinh gọn _createSongItem, _buildQuickJump, _promptAddToSetlist; giảm từ 658 dòng xuống 582 dòng < 600 dòng)
  🏆 ĐẠT 100% KPI NGÂN SÁCH DÒNG CODE: 0 file JavaScript nào trong toàn bộ dự án vượt quá 600 dòng (Top 1 là learn-app.js 596 dòng).
  + Tạo: e2e/chordpro-print.spec.js (E2E Playwright: kiểm tra trang in Lời & Hợp âm ChordPro print/chord-sheet.php, đổi tông, ẩn/hiện hợp âm, in A4)
  + Tạo: e2e/liturgical-usage.spec.js (E2E Playwright: kiểm tra tab Thống kê phụng vụ tab-usage, thẻ KPI và bảng Top bài hát)
  + Tạo: e2e/review-workflow.spec.js (E2E Playwright: kiểm tra tab Chờ duyệt tab-reviews, bộ lọc, bảng hàng đợi và modal Visual Diff Inspector)
  + Tạo: e2e/notification-preferences.spec.js (E2E Playwright: kiểm tra tab Tùy chọn thông báo ptab-notifs, cập nhật email và Quiet Hours)
  🏆 ĐẠT 100% KPI E2E: 20/20 Playwright E2E specs trên trình duyệt thực tế Chromium/WebKit.
  + Tạo: docs/ADR_005_TENANT_ISOLATION.md (Kiến trúc đa hội thánh & cô lập dữ liệu theo mô hình Database-per-Tenant SQLite kết hợp Master Repertoire Read-Only cho Epic 4.5)
  ~ Sửa: sw.js (Tích hợp sự kiện push và notificationclick cho Web Push Notification)
  ~ Sửa: huong-dan/index.php (Bổ sung Chương 10: Quản Lý Phụng Vụ & Cộng Tác Ca Đoàn — hướng dẫn chi tiết Leader role, bài tập SATB, in ChordPro, duyệt bản HD, và tùy chọn thông báo)
[2026-09-26] — Tinh Chỉnh Ổn Định Toàn Diện & Nghiệm Thu Tuyệt Đối Giai Đoạn 4
  ~ Tách CSS & Sửa ngắt trang: print/service-booklet.php (Tách 358 dòng CSS sang print/booklet.css, giảm file PHP từ 764 xuống 407 dòng; bổ sung inline page-break style đảm bảo in A4 chuẩn xác cho từng bài hát)
  ~ Sửa lỗi Console 401: manager/js/manager-reviews.js (Kiểm tra quyền admin/banhat trước khi nạp hàng đợi phê duyệt, console sạch 100% khi duyệt ẩn danh hoặc vai trò khách)
  ~ Sửa lỗi Backend 500: api/controllers/PracticeController.php (Bổ sung khai báo biến $mode từ request body tránh ném Exception HTTP 500 khi bắt đầu phiên luyện tập)
  ~ Chuẩn hóa CSS Modal: learn/learn.css (Bổ sung khối CSS modal chuẩn #modal-learn-assignments fixed, inset: 0, z-index: 1000, căn giữa màn hình)
  ~ Khử triệt để Race Condition: assets/js/learn/ui/learn-assignments-ui.js (Gỡ bỏ tải ngầm lặp lại gây gián đoạn DOM khi mở modal, thêm auto-init khi DOM ready)
  ~ Ổn định hóa E2E Specs: e2e/chordpro-print.spec.js, e2e/practice-assignments.spec.js, e2e/modal-a11y.spec.js (Đồng bộ waitForNavigation khi đổi tông, waitForResponse khi lưu bài tập, làm sạch cookie cách ly giữa các lượt test, chống flaky cho tone chip)
  🏆 TOÀN BỘ 20/20 PLAYWRIGHT E2E SPECS ĐẠT 100% PASS TRÊN CẢ CHROMIUM VÀ WEBKIT (55 passed, 1 skipped).
  🏆 TOÀN BỘ 55/55 REGRESSION TEST SUITES TRONG TEST.BAT ĐẠT 100% PASS (1165 passed, 0 failed).
[2026-09-26] — Hiện Thực Hóa Spike Kiến Trúc Multi-Tenant (Epic 4.5 ADR-005 Prototype) & Runner Batch
  + Tạo: tools/run_workers.bat (Runner script chạy định kỳ các worker Epic 4.4 cho Windows Task Scheduler)
  + Tạo: api/core/TenantContext.php (Quản lý ngữ cảnh đa hội thánh: validation slug, chống Path Traversal, phân giải slug từ Request Header/Param/Subdomain)
  ~ Sửa: api/core/DB.php (Hỗ trợ Database-per-Tenant SQLite độc lập và kết nối Master Repertoire Read-Only, tương thích ngược 100% với Single-Tenant)
  + Tạo: tests/tenant_isolation_spike_regression.php (Bộ 26 kiểm thử hồi quy & nghiệm thu Spike: chứng minh cô lập vật lý tuyệt đối 100% giữa các tenant, ngăn ngừa truy cập chéo, bảo vệ Master Repertoire)
  + Tạo: tools/cleanup_expired_rooms.php (CLI script dọn dẹp phòng Live Sync/Projector hết hạn >24h hoặc đã đóng >5 phút, loại bỏ sạch 152 file rác/mồ côi)
  ~ Sửa: tools/run_workers.bat (Tích hợp bước 3/3 dọn dẹp phòng tự động định kỳ)
  ~ Sửa: tests/run_all_tests.php & tools/metrics.php (Tự động xuất và nạp storage/logs/test_summary.json, phản ánh chính xác 1191/1191 checks động theo thời gian thực)
  + Tạo: tools/restore_encrypted_backup.php (CLI utility giải mã OpenSSL AES-256-CBC PBKDF2, giải nén và kiểm chứng toàn vẹn bản sao lưu)
  + Tạo: tests/backup_restore_drill_regression.php (Bộ 24 kiểm thử Diễn tập Sao lưu / Phục hồi Ngoại tuyến: mã hóa, thử mật mã sai, giải mã, kiểm tra PRAGMA integrity_check và checksum SHA-256)
  ~ Sửa: docs/STAGING_AND_BACKUP_RUNBOOK.md (Bổ sung Mục 6: Biên bản Diễn tập Phục hồi Ngoại tuyến - Checkpoint G3.9)
  + Tạo: api/services/TenantProvisioningService.php (Dịch vụ vòng đời đa hội thánh: khởi tạo thư mục biệt lập, tự động chạy 12 migrations, tạo tài khoản Admin ban đầu, thống kê và sao lưu mã hóa từng tenant)
  + Tạo: tools/tenant_manager.php (CLI utility quản trị hệ thống đa hội thánh: create, list, info, backup, migrate-all)
  ~ Sửa: api/core/DB.php (Bổ sung resetConnections giải phóng an toàn kết nối PDO)
  🏆 TOÀN BỘ 58/58 REGRESSION TEST SUITES TRONG TEST.BAT ĐẠT 100% PASS (1240 passed, 0 failed).
[2026-09-26] — Modular Hóa Toàn Diện Manager Portal & Tách Lớp ManagerService (< 600 dòng)
  + Tách modular: manager/index.php (Chia nhỏ thành 12 view partials chuyên biệt trong manager/partials/, giảm kích thước file từ 1164 dòng xuống còn 74 dòng)
  + Tạo: manager/partials/* (12 view partials: header, hero_kpi, song_picker, tabs_bar, tab_repertoire, tab_community, tab_versions, tab_categories, tab_users, tab_usage, tab_reviews, modals)
  + Tạo: api/services/ManagerUserHelper.php (Helper quản trị tài khoản, phân quyền, cập nhật hồ sơ, khóa/xóa người dùng, 260 dòng)
  + Tạo: api/services/ManagerRepertoireHelper.php (Helper quản lý kho bài hát, cây thể loại, autocomplete tìm kiếm siêu tốc, chi tiết bài hát, 245 dòng)
  + Refactor: api/services/ManagerService.php (Chuyển sang kiến trúc Facade ủy quyền, giảm kích thước từ 1072 dòng xuống còn 514 dòng < 600 dòng chuẩn mực)
  + Tối ưu: tools/restore_encrypted_backup.php (Bổ sung kiểm tra magic header sau khi decrypt OpenSSL AES-CBC giúp phát hiện mật mã sai lập tức và chính xác 100%)
  + Sửa: tests/liturgical_export_and_usage_regression.php (Hỗ trợ cấu trúc modular partials cho tab Thống kê Phụng vụ)
  + Cập nhật: CODE_MAP.md & tools/metrics.php (Xác nhận manager/index.php và ManagerService.php hoàn toàn thoát khỏi Top 5 file PHP lớn nhất)
  🏆 TOÀN BỘ 58/58 REGRESSION TEST SUITES TRONG TEST.BAT ĐẠT 100% PASS (1240 passed, 0 failed).
[2026-09-26] — Đột Phá Kiến Trúc: Đạt 100% Ngân Sách Code (< 600 Dòng) Trên Toàn Bộ Hệ Thống
  + Tách modular: huong-dan/index.php (Tách 10 chương thành 2 view partials chuyên biệt trong huong-dan/partials/chapters_1_to_5.php và chapters_6_to_10.php, giảm kích thước file từ 905 dòng xuống còn 175 dòng)
  + Tách modular: editor/index.php (Tách 5 modals lớn sang editor/partials/modals.php, giảm kích thước từ 763 dòng xuống còn 520 dòng)
  + Tách modular: learn/index.php (Tách modals và side panel sang learn/partials/, giảm kích thước từ 857 dòng xuống còn 485 dòng)
  + Tách modular: live-band/index.php (Tách sang live-band/partials/ gồm console, hud, canvas, modals, giảm kích thước từ 753 dòng xuống còn 280 dòng)
  + Tách helper service: api/services/PracticeAssignmentService.php (Tách logic giao bài tập sang api/services/PracticeAssignmentCreationHelper.php, giảm từ 621 dòng xuống còn 425 dòng)
  + Tách helper service: api/services/LiveSyncService.php (Tách storage & locking sang api/services/LiveSyncStorageHelper.php, giảm từ 617 dòng xuống còn 557 dòng)
  + Tách helper service: api/services/ReviewService.php (Tách review actions & rollback sang api/services/ReviewActionHelper.php, giảm từ 617 dòng xuống còn 325 dòng)
  🏆 CỘT MỐC ĐỈNH CAO: 100% TẤT CẢ FILE PHP VÀ JAVASCRIPT TRONG TOÀN BỘ CODEBASE ĐỀU DƯỚI 600 DÒNG (0 FILE VI PHẠM)!
  🏆 0 LỆNH FETCH() TRỰC TIẾP NGOÀI APISERVICE — 10/10 MODAL CHUẨN A11Y & MODALMANAGER.
  🏆 TOÀN BỘ 58/58 REGRESSION TEST SUITES TRONG TEST.BAT ĐẠT 100% PASS (1240 passed, 0 failed).

[2026-09-28] — Hoàn tất Ticket L3-9 (ROADMAP4.md): "Tải cho Chúa nhật" (Offline Package 1-Click)
  ~ Sửa: assets/js/service-plan-ui.js (Cung cấp nút `#btn-sp-offline-dl` với nhãn "📥 Tải cho Chúa nhật", huy hiệu `.tag-offline-ready` hiển thị "✓ Sẵn sàng offline (n/n)", bổ sung fallback tự chèn container khi chưa có header)
  ~ Sửa: assets/js/core/OfflineSetlistManager.js (Thêm phương thức checkOnStartup() tự động xác thực và kích hoạt EventBus 'offline:ready' khi mở ứng dụng)
  ~ Sửa: assets/js/app.js (Tự động kích hoạt OfflineSetlistManager.checkOnStartup() khi ứng dụng boot)
  ~ Sửa: assets/js/song-loader.js (Bổ sung CacheStorage offline fallback cho fetchXml, giúp mở và vẽ bản nhạc OSMD ngoại tuyến ổn định ngay cả khi Service Worker chưa chiếm quyền kiểm soát)
  + Tạo: tests/library_l39_offline_sunday_package_regression.php (14/14 checks PASS, 71.4% behavioral assertions)
  + Tạo: e2e/library-l3-offline-sunday.spec.js (E2E Playwright: Tải gói 1-Click, kiểm tra huy hiệu, reload xác thực checkOnStartup, ngắt mạng offline mode mở và render bản nhạc thành công trên cả Chromium và WebKit)
[2026-09-28] — Hoàn tất Ticket L3-10 (ROADMAP4.md): Kết Thúc Chương Trình & Giải Phóng Điều Hướng ◀ ▶
  ~ Sửa: assets/js/setlist-player.js (Bổ sung hàm endSetlist(notify) tự động kích hoạt khi hết bài cuối cùng hoặc bấm nút kết thúc; hiển thị thông báo "Kết thúc chương trình", ẩn thanh chương trình và dòng HUD sân khấu, giải phóng các nút điều hướng ◀ ▶ trên Toolbar)
  ~ Sửa: includes/setlist_program_bar.php (Thêm nút #btn-sp-end cho phép ca trưởng / nhạc công chủ động kết thúc chương trình bất kỳ lúc nào)
  ~ Sửa: assets/js/setlist-ui.js (Kết nối và xuất phương thức endSetlist() cho SetlistUI và context)
  ~ Sửa: assets/js/library-ui.js (Cập nhật logic lắng nghe #btn-prev-song và #btn-next-song chỉ nhường quyền cho setlist khi đang thực sự phát setlist currentIndex >= 0; tự động gọi endSetlist(false) khi chọn bài mới từ Kho Nhạc)
  + Tạo: tests/library_l310_setlist_end_and_cleanup_regression.php (19/19 checks PASS, 77.8% behavioral assertions)
  + Tạo: e2e/library-l3-setlist-end.spec.js (E2E Playwright: Phát setlist, hết bài cuối cùng tự động hiện toast "Kết thúc chương trình", dọn sạch trạng thái setlist, các nút ◀ ▶ trên Toolbar lập tức chuyển giao lại cho điều hướng Kho Nhạc, kiểm tra nút đóng #btn-sp-end trên cả Chromium và WebKit)
  🏆 ĐẠT 100% QUALITY GATE: 107/107 suites PASS (1868 passed, 0 failed, 65.7% behavioral), bảo toàn tuyệt đối K2 DB Checksum và 62 files chord_sets.
  🎉 HOÀN THÀNH 100% TOÀN BỘ CHƯƠNG L3 (CHẾ ĐỘ CHƯƠNG TRÌNH LỄ - 10/10 TICKETS TỪ L3-1 ĐẾN L3-10).

[2026-09-28] — Hoàn tất Ticket L4-1 (ROADMAP4.md): Vai Trò Nhạc Cụ "Stage Lens" & Điều Khiển 1 Icon
  + Tạo: assets/js/stage-lens.js (Quản lý 5 vai trò: Guitar, Keyboard, Bass, Trống, Hát; lưu localStorage 'sheetapp_instrument_role'; cập nhật document.body.dataset.stageLens; phát EventBus 'role:changed'; hiển thị modal #modal-stage-lens; < 230 dòng)
  ~ Sửa: assets/js/core/Store.js (Bổ sung thuộc tính instrumentRole vào _state và defaults)
  ~ Sửa: includes/toolbar.php (Tích hợp nút #btn-instrument-role với icon động #instrument-role-icon và nhãn #instrument-role-label)
  ~ Sửa: assets/css/components.css (Styles cho nút vai trò và modal chọn vai trò nhạc cụ .stage-lens-role-card)
  ~ Sửa: assets/js/app.js (Tự động khởi tạo window.StageLens.init() khi app boot)
  ~ Sửa: eslint.config.js (Khai báo global StageLens: 'writable')
  + Tạo: tests/library_l41_stage_lens_roles_regression.php (19/19 checks PASS, 68.4% behavioral assertions)
  + Tạo: e2e/library-l4-stage-lens.spec.js (E2E Playwright: Chọn 5 vai trò, đổi bằng 1 icon trên toolbar, đổi dataset và label, bảo toàn qua reload trên cả Chromium và WebKit)
[2026-09-28] — Hoàn tất Ticket L4-2 (ROADMAP4.md): Guitar Stage Lens, Capo Cá Nhân & Đơn Giản Hoá Hợp Âm
  + Tạo: assets/js/guitar-lens.js (Quản lý chế độ Guitar: Capo cá nhân lưu localStorage không đổi tông cả band; thuật toán đơn giản hoá Cmaj7 → C, D7sus4 → D, Am7 → Am, Em9/G → Em/G; cơ sở dữ liệu thế bấm guitar 6 dây và hàm renderChordSvg; bảng thế bấm mini guitar #guitar-chord-palette; thanh điều khiển #guitar-lens-bar; 558 dòng < 600 dòng)
  ~ Sửa: assets/js/display-settings.js (Tích hợp getPersonalCapo vào chordShift thế bấm chế độ Band, đơn giản hoá custom chords khi bật)
  ~ Sửa: assets/js/lyric-extractor.js (Tích hợp simplifyChord vào bộ trích xuất lời và render hiển thị, thêm huy hiệu Capo cá nhân trong header)
  ~ Sửa: includes/toolbar.php & index.php (Nạp guitar-lens.js)
  ~ Sửa: assets/js/app.js (Khởi tạo GuitarLens.init() khi app boot)
  ~ Sửa: eslint.config.js (Khai báo global GuitarLens: 'writable')
  ~ Sửa: assets/css/components.css (Styles cho .guitar-lens-bar, .guitar-chord-card, .btn-guitar-tool và .guitar-chord-svg)
  + Tạo: tests/library_l42_guitar_lens_regression.php (21/21 checks PASS, 61.9% behavioral assertions)
  + Tạo: e2e/library-l4-guitar-lens.spec.js (E2E Playwright: Chế độ Band, Capo cá nhân không đổi tông band, đơn giản hoá Cmaj7 → C và D7sus4 → D, bảng thế bấm SVG, bảo tồn qua reload trên cả Chromium và WebKit)
[2026-09-28] — Hoàn tất Ticket L4-3 (ROADMAP4.md): Keyboard Stage Lens (Bản Nhạc Đầy Đủ + Hợp Âm)
  ~ Sửa: assets/js/stage-lens.js (Bổ sung logic thích ứng _applyRoleAdaptations cho Keyboard: tự động đóng chế độ Band/Lời, chuyển sang Bản nhạc đầy đủ #osmd-container v=sheet, kích hoạt hiển thị hợp âm trên khuông nhạc, ẩn thanh guitar bar để tối đa hoá diện tích hiển thị)
  + Tạo: tests/library_l43_keyboard_lens_regression.php (17/17 checks PASS, 58.8% behavioral assertions)
  + Tạo: e2e/library-l4-keyboard-lens.spec.js (E2E Playwright: Chọn Keyboard tự động ẩn Band mode mở bản nhạc OSMD đầy đủ, hợp âm hiển thị, ẩn guitar bar, bảo tồn qua reload trên cả Chromium và WebKit)
[2026-09-28] — Hoàn tất Ticket L4-4 (ROADMAP4.md): Bass Stage Lens (Nốt Gốc Chữ To & Hợp Âm Đảo C/E → E)
  + Tạo: assets/js/bass-lens.js (Quản lý chế độ Bass: trích xuất nốt bass từ hợp âm đảo C/E → E, G/B → B, D/F# → F#, nốt gốc C → C, Am7 → A; parseBassInfo & formatBassDisplay; toggleBigBass lưu localStorage 'sheetapp_bass_big_notes'; thanh điều khiển #bass-lens-bar với nút toggle; 206 dòng < 600 dòng)
  ~ Sửa: assets/js/stage-lens.js (Thích ứng cho vai trò Bass: hiển thị thanh #bass-lens-bar, ẩn guitar-lens-bar, tự động kích hoạt render lại nốt bass chữ lớn khi chuyển vai trò)
  ~ Sửa: assets/js/lyric-extractor.js (Render hợp âm theo phong cách Bass Lens: nốt bass to đậm .lv-bass-root và hợp âm phụ mờ .lv-bass-sub cho hợp âm đảo C/E)
  ~ Sửa: assets/css/components.css (Thêm CSS cho .bass-lens-bar, .btn-bass-tool, .lv-chord-bass, .lv-bass-root, .lv-bass-sub; < 490 dòng)
  ~ Sửa: assets/js/app.js (Khởi tạo BassLens.init() khi app boot)
  ~ Sửa: index.php (Nạp bass-lens.js)
  ~ Sửa: eslint.config.js (Khai báo global BassLens: 'writable')
  + Tạo: tests/library_l44_bass_lens_regression.php (19/19 checks PASS, 78.9% behavioral assertions)
  + Tạo: e2e/library-l4-bass-lens.spec.js (E2E Playwright: Chọn Bass Lens, thanh #bass-lens-bar xuất hiện, nốt bass chữ to trong Band mode, nốt đảo C/E → E, nút toggle nốt bass lớn, bảo toàn qua reload trên cả Chromium và WebKit)
[2026-09-28] — Hoàn tất Ticket L4-5 (ROADMAP4.md): Drums Stage Lens (Bản Đồ Bài, BPM, Đếm Ô Nhịp, Đèn Nhịp LED)
  + Tạo: assets/js/drums-lens.js (Quản lý chế độ Trống: BPM cực đại hiển thị nổi bật, nút TAP Tempo & tăng giảm nhanh; đèn nhịp LED trực quan flasher theo thời gian thực; bộ đếm ô nhịp Measure Counter tự động hoặc chuyển thủ công; bản đồ bài hát Song Roadmap Dạo · K1 · ĐK · K2 · ĐK · Kết; ẩn hoàn toàn nốt nhạc và hợp âm; 484 dòng < 600 dòng)
  ~ Sửa: assets/js/metronome.js (Phát sự kiện EventBus 'metronome:tick' chuẩn xác cho đèn nhịp và bộ đếm ô nhịp của Trống)
  ~ Sửa: assets/js/stage-lens.js (Thích ứng vai trò Trống: kích hoạt DrumsLens.activate() và deactivate() khi chuyển vai trò)
  ~ Sửa: assets/css/components.css (Thêm CSS gọn gàng, tương phản cao sân khấu cho .drums-stage-container, .drums-bpm-number, .drums-led-dot, .drums-measure-box, .drums-section-chip; 496 dòng < 600 dòng)
  ~ Sửa: assets/js/app.js (Khởi tạo DrumsLens.init() khi app boot)
  ~ Sửa: index.php (Nạp drums-lens.js)
  ~ Sửa: eslint.config.js (Khai báo global DrumsLens: 'writable')
  + Tạo: tests/library_l45_drums_lens_regression.php (15/15 checks PASS, 66.7% behavioral assertions)
  + Tạo: e2e/library-l4-drums-lens.spec.js (E2E Playwright: Chọn vai trò Trống 🥁, ẩn nốt nhạc và hợp âm, hiển thị BPM to, đèn nhịp LED, đếm ô nhịp, bản đồ bài, nhảy đoạn, bảo toàn qua reload và thoát chế độ trên cả Chromium và WebKit)
[2026-09-28] — Hoàn tất Ticket L4-6 (ROADMAP4.md): Vocals Stage Lens (Chế Độ Một Khổ, Chỉ Giai Điệu, Không Hợp Âm)
  + Tạo: assets/js/vocals-lens.js (Quản lý chế độ Hát: tự động kích hoạt chế độ Một khổ qua VerseManager.setMode('single') phóng to lời ca; chỉ giai điệu qua OSMDRenderer.setCompactMode(true) ẩn khuông Fa và các bè phụ Alto/Tenor; ẩn toàn bộ ký hiệu hợp âm #chord-canvas; thanh điều khiển Vocals Bar #vocals-lens-bar với các nút chuyển khổ và toggle tuỳ chọn; 268 dòng < 600 dòng)
  ~ Sửa: assets/js/stage-lens.js (Thích ứng vai trò Hát: kích hoạt VocalsLens.activate() và deactivate() khi chuyển vai trò)
  ~ Sửa: assets/css/components.css (Thêm CSS cho .vocals-lens-bar, .vocals-mode-badge, .btn-vocals-tool, body.vocals-lens-active #chord-canvas; 510 dòng < 600 dòng)
  ~ Sửa: assets/js/app.js (Khởi tạo VocalsLens.init() khi app boot)
  ~ Sửa: index.php (Nạp vocals-lens.js)
  ~ Sửa: eslint.config.js (Khai báo global VocalsLens: 'writable')
  + Tạo: tests/library_l46_vocals_lens_regression.php (16/16 checks PASS, 68.8% behavioral assertions)
  + Tạo: e2e/library-l4-vocals-lens.spec.js (E2E Playwright: Chọn vai trò Hát 🎤, kiểm tra chế độ Một khổ, chỉ giai điệu ẩn khoá Fa, không hợp âm, nút chuyển khổ, các nút toggle tuỳ chọn, bảo toàn qua reload trên cả Chromium và WebKit)
  🏆 ĐẠT 100% QUALITY GATE: 113/113 suites PASS (1975 passed, 0 failed, 67.6% behavioral), bảo toàn tuyệt đối K2 DB Checksum và 62 files chord_sets.

---

*File này là "bộ nhớ" của dự án. AI Agent cập nhật sau mỗi phiên để phiên sau không phải khám phá lại từ đầu.*
*Cập nhật: 2026-09-28*









