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
  Deploy:    Git Auto-sync (./sync.sh)

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
│
├── index.php                 ← Entry point HTML (PHP partial includes)
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
│       ├── setlist-ui.js     # Setlist management UI (Tông tập, Tempo tập)
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
│   ├── data/sheetapp.sqlite  # SQLite database
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
| `users` | `id, username, password_hash, role` | `role: 'admin'\|'user'` |
| `omr_jobs` | `id, filename, status, result_xml` | OMR processing queue |

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

[2026-05-15] — Triển khai hệ thống tài liệu 3 file từ docs-templates/
  + Tạo: AI_AGENT.md (root), CODING_STANDARDS.md (root), PROJECT_REGISTRY.md (root)
  ~ Tham khảo: docs-templates/AI_AGENT.md, CODING_STANDARDS.md, PROJECT_REGISTRY.md
  ⚠ Còn lại: Cần điền Prod URL khi có

[2026-05-14] — Phát triển Gas Manager, modernize POS reporting
  ~ Sửa: Nhiều file reporting

[2026-05-11] — Refactor MVC architecture
  + Tạo: api/core/ (Auth, Config, DB, Response)
  + Tạo: api/controllers/ (10 controllers)
  + Tạo: api/services/ (9 services)
  + Tạo: assets/js/core/ (ApiService, EventBus, Store)
```

---

*File này là "bộ nhớ" của dự án. AI Agent cập nhật sau mỗi phiên để phiên sau không phải khám phá lại từ đầu.*
*Cập nhật: 2026-05-25*
