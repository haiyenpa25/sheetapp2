# 🎵 SheetApp — Tai Lieu He Thong & Ke Hoach Nang Cap

> Version: 2.0-dev | Stack: PHP + SQLite + OSMD + Vanilla JS
> Cap nhat: 2026-04-25

---

## 1. TONG QUAN

SheetApp la ung dung DOC VA BIEU DIEN BAN NHAC chuyen nghiep cho:
- Nhac cong guitar/piano can xem hop am + sheet cung luc
- Ca doan/nhom nhac quan ly tap bai, setlist bieu dien
- Nguoi tap nhac annotate ghi chu tren ban nhac

Nguon du lieu: MusicXML (.xml) render qua OSMD — chuan quoc te cho sheet nhac.

---

## 1b. CORE RULES — Bat Buoc Giu Nguyen

> Day la cac quy tac KHONG thay doi. Moi developer phai doc va tuan thu.

### RULE 1: Bo Hop Am HD la Mac Dinh
- Moi bai hat LUON co bo "HD" (du rong) — tao tu dong qua tools/init_hd_sets.php
- Khi load bai: ChordCanvas tu dong chon set "HD"
- Neu HD co hop am (>0): render HD, an TLH goc
- Neu HD rong: fallback hien TLH goc (khong inject empty map — tranh mat hop am)
- File: chord-canvas.js (loadSong), app.js (hasCustomChords guard)

### RULE 2: Tong Goc = 0 Luon Luon
- Khi load bai moi: currentTranspose LUON = 0
- KHONG restore session truoc (settings.lastTranspose bi loai bo)
- Ngoai le duy nhat: Setlist da co transposeOverride rieng cho bai do
- File: app.js (loadSong line ~231)

### RULE 3: Lock TLH va HD
- Bo "default" (TLH) va bo "HD" deu khong the xoa
- Nut xoa chi hien khi set != 'default' va != 'HD' va la Admin
- Khi xoa set khac va dang chon no: fallback ve "HD" (khong phai default)
- File: chord-canvas.js (deleteSet, confirmDeleteSet, _refreshSetDropdown)

---

## 2. KIEN TRUC MODULE

Frontend (Browser):
  LibraryUI | OSMDRenderer | ChordCanvas | AnnotationCanvas
                    App Controller (app.js)
          Auth | FAB | PageNav | Sessions | PerformanceNotes

Backend (PHP): songs | chord_sets | annotations | sessions | setlists
Database (SQLite): songs | annotations | chord_sets | users | sessions

---

## 3. 12 NHOM TINH NANG

### 3.1 Thu Vien Bai Hat (LibraryUI)
[x] Danh sach bai so thu tu HTTLVN
[x] Tim kiem ten (khong dau)
[x] Tim kiem theo loi (api lyric_search)
[x] Loc theo danh muc
[x] Quick Jump (nhay 100 bai)
[x] Yeu thich (sao) localStorage
[x] Bai xem gan day (top 5)
[x] URL deeplink ?song=ID
[ ] Sort A-Z / theo tong — CHUA CO
[ ] Batch select / multi action — CHUA CO

### 3.2 Hien Thi Sheet Nhac (OSMD Renderer)
[x] Render MusicXML → SVG
[x] Hop am goc XML mau do
[x] Compact Mode (an be/khoa Fa) — 5 options
[x] Zoom 30-200%
[x] Responsive resize + xoay man hinh
[x] Endless scroll (khong ngat trang)
[ ] In tung trang A4 (page-break) — CHUA CO

### 3.3 Hop Am Overlay (Chord Canvas)
[x] Them/sua/xoa hop am tren not
[x] Multi chord set (bo hop am)
[x] Goi y theo tong (key-aware, detect tu XML)
[x] Lich su 20 chord (localStorage)
[x] Thu vien 30+ suffix (6 nhom)
[x] Search chord trong library
[x] Undo/Redo Ctrl+Z/Y — 20 buoc
[x] Tab/Space → not tiep (fast entry)
[x] Chord count badge (so hop am trong set hien tai)
[ ] Undo cho Default XML set — CHUA CO

### 3.4 Transpose & Capo
[x] Transpose +/- semitone (nut + phim mui ten)
[x] Capo dropdown 0-7 (sync voi transpose)
[x] Capo hint voi ten tong goc ("→ ngan 2, dan the G goc")
[x] Enharmonic #/b tu dong
[ ] Tooltip chord sau capo — CHUA CO

### 3.5 Ghi Chu (Annotation Canvas)
[x] Sticky note tren not nhac
[x] Luu server (api/annotations.php)
[ ] Mau sac theo loai — CHUA CO
[ ] Preset icon (dan, hat, nhanh, cham...) — CHUA CO
[ ] Annotation per-measure — CHUA CO

### 3.6 Nhat Ky Bieu Dien (Performance Notes)
[x] Tong luu / BPM / Ghi chu tu do
[x] Auto-save localStorage per-song
[ ] Sync len server — CHUA CO
[ ] Template preset — CHUA CO

### 3.7 Audio Player
[x] Phat MIDI qua OSMD (Web Audio)
[x] Toc do 0.5x-1.5x
[x] Be SATB rieng le (Soprano/Alto/Tenor/Bass)
[ ] Progress bar — CHUA CO
[ ] Volume control tong — CHUA CO
[ ] Sync voi auto-scroll — CHUA CO

### 3.8 Auto Scroller
[x] Cuon theo cursor OSMD
[x] BPM detection tu XML (TempoExpressions)
[x] Lerp smooth scroll (khong jump)
[x] 4 muc toc do: Rua/Cham/Vua/Nhanh
[ ] Sync voi audio — CHUA CO

### 3.9 Fullscreen & Display
[x] Sheet-only fullscreen (an sidebar + toolbar)
[x] Phim F / ESC
[x] San Khau (dark overlay)
[ ] True dark mode (CSS variables) — CHUA CO
[ ] Browser Fullscreen API — CHUA CO

### 3.10 Setlist & Session
[x] Tao/quan ly Setlist
[x] Nhat ky buoi choi (Session)
[x] Luu transpose per-session
[x] Dong bo Tong tap va Tempo tap trong Setlist
[x] Hien thi song song Tong goc va Tong tap (Tone: G | Tap: A)
[x] Chon Tong tap va Tempo tap khi them bai vao Setlist
[x] Luu nhanh thong so tap (BPM, Tong) tren mobile/iPad

### 3.11 Import
[x] Upload MusicXML
[x] Import tu URL (scrapers)
[~] OMR anh → XML — PARTIAL

### 3.12 UX General
[x] FAB draggable (5 actions: Loi/Hop am/Ghi chu/Tuy chon/In)
[x] Toast notifications
[x] Keyboard shortcuts day du
[x] Mobile responsive (<768px compact)
[x] Print CSS (chord overlay + annotation)
[x] Song Info Strip (key/tempo tuong tac khi load bai) — DA HOAN THANH
[x] TempoPick popup (slider, TAP tempo, test nhip) — DA HOAN THANH
[x] Toi uu nut Luu Setlist tren mobile & iPad (vi tri uu tien top 4, touch target >= 32px) — DA HOAN THANH
[ ] Measure progress indicator — CHUA CO

---

## 4. PHAN TICH UX & GAP

### Flow hien tai vs Ly tuong:

HIEN TAI:                         LY TUONG:
---------                         ---------
Chon bai                          Chon bai
  |                                  |
[Tu doc sheet, mo tong]           Song Info Bar: Tong Nhip BPM
  |                                  |
[Tim nut transpose]               1-click Capo goi y
  |                                  |
[Mo chord mode, nhap tung cai]    Chord goi y san theo tong
  |                                  |
Bieu dien (van tay cuon)          PLAY = audio + scroll sync

### Top 10 Van De UX:

1. [DO CAO] Khong co Song Info Card → user khong biet key/tempo ngay  → Sprint A
2. [DO CAO] Audio va Auto-scroll tach roi, khong dung cung duoc       → Sprint B
3. [TRUNG]  Annotation button an (display:none), kho tim               → Sprint C
4. [TRUNG]  Performance Notes chi localStorage, mat khi doi thiet bi   → Sprint C
5. [TRUNG]  Chord popup header tong nho, kho nhan biet                 → Sprint D
6. [TRUNG]  Undo khong ho tro Default XML set                          → Sprint D
7. [THAP]   Khong co progress indicator vi tri trong ban nhac           → Sprint E
8. [THAP]   Capo khong hien thi chord names se choi sau khi kep        → Sprint A
9. [THAP]   Khong co true dark mode (chi "San Khau" overlay)           → Sprint F
10.[THAP]   Khong co Quick Jump den o nhip cu the                      → Sprint E

---

## 5. WRITING PLAN 6 SPRINT

=== SPRINT A — Song Info + Capo Enhancement ===
MUC TIEU: Khi load bai → user biet ngay: tong, nhip, tempo, o nhip

A1 — Song Info Strip (file moi: assets/js/song-info-bar.js)
  - Parse tu XML: key signature, time signature, tempo, measure count
  - Strip mong (28px) ngay duoi toolbar, collapsible
  - Click expand → full info + chord summary
  Hien thi: [TC001 · Ten Bai Hat · G truong · 4/4 · 72bpm · 32 nhip] [≡]

A2 — Capo Smart Panel
  - Hien thi top 3 hop am se thay doi sau capo
  - Badge mau xanh "Goi y" voi so ngan tot nhat
  Hien thi: Capo [2 ▾]  → Dan ngan 2: Am→Gm, C→Bb, G→F...

=== SPRINT B — Unified Playback Controller ===
MUC TIEU: Merge Audio + Scroll thanh 1 playback unified

B1 — Playback Bar (thay the 2 control groups rieng le)
  - File moi: playback-controller.js
  - Progress bar click-to-seek, volume slider, bpm display
  - Khi play → auto scroll theo cursor OSMD
  Hien thi: |◀ ▶/⏸ ▶▶| [═══░░] 1:24/4:32 | Toc [1.0x] | 🔊 [██░░] 75%|

B2 — An btn-auto-scroll rieng le, merge vao Playback Bar

=== SPRINT C — Annotation 2.0 + Performance Sync ===
MUC TIEU: Ghi chu professional + luu server

C1 — Annotation voi mau + icon
  - 3 loai: Nhac nho (vang) | Ky thuat (xanh) | Quan trong (do)
  - 4 icon: Dan | Hat | Nhanh | Cham
  - DB: them cot color + icon vao annotations table

C2 — Measure-level Annotation
  - Click so o nhip → popup ghi chu cho ca o do
  - Dai mau nho (8px) phia tren o nhip co note

C3 — Performance Notes Sync Server
  - POST api/sessions.php?action=save_notes
  - Fallback localStorage neu chua dang nhap

=== SPRINT D — Chord Workflow Polish ===
MUC TIEU: Nhap chord nhanh hon, undo manh hon

D1 — Chord Popup Header ro rang hon
  - Ten tong lon hon, mau tim dam
  - Hien thi o nhip va ten not dang edit

D2 — Undo cho Default Set (XML snapshot)
  - Truoc inject XML → luu _xmlSnapshot[] (max 10)
  - Undo: restore snapshot → re-render OSMD
  - File: chord-canvas-xml.js them snapshot logic

D3 — Chord Batch View Panel
  - List unique chord names tu _customChords
  - Click → scroll den vi tri dau tien

=== SPRINT E — Navigation & Progress ===

E1 — Measure Progress Bar
  - Strip mong (6px) duoi sheet
  - Click → jump den o nhip do (scroll)
  - Sync khi auto-scroll chay

E2 — Quick Measure Jump
  - Input "Nhay den o nhip: [__]" trong page-bar
  - Enter → scroll smooth den o nhip do

=== SPRINT F — Dark Theme & Accessibility ===

F1 — True Dark Mode
  - CSS variables: --bg-base, --text-primary, --accent, --border
  - Nut toggle toolbar (sun/moon)
  - Luu localStorage
  - Sheet SVG: invert nhe (khong full invert)

F2 — Font Size Control
  - Tuy chinh: chord size, annotation size
  - Preset: Nho 80% / Vua 100% / Lon 130%

---

## 6. KEYBOARD SHORTCUTS

| Phim                    | Hanh dong                   |
|-------------------------|-----------------------------|
| <- / ->                 | Transpose -1 / +1 semitone  |
| 0                       | Reset transpose              |
| C                       | Toggle chord edit mode       |
| F                       | Toggle sheet-only fullscreen |
| P                       | In ban nhac                  |
| PageUp / PageDown       | Trang truoc / tiep           |
| Ctrl+Z                  | Undo chord                   |
| Ctrl+Shift+Z / Ctrl+Y   | Redo chord                   |
| Ctrl++ / Ctrl+-         | Zoom in / out                |
| Esc                     | Dong popup / thoat fullscreen|
| Tab / Space (popup)     | Luu → not ke tiep           |
| Enter (popup)           | Luu chord                    |

---

## 7. API REFERENCE

| Endpoint               | Method           | Chuc nang            |
|------------------------|------------------|----------------------|
| api/songs.php          | GET              | Danh sach bai        |
| api/songs.php?id=X     | DELETE           | Xoa bai              |
| api/songs.php?lyric=Q  | GET              | Tim theo loi         |
| api/categories.php     | GET              | Danh muc             |
| api/annotations.php    | GET/POST/DELETE  | Ghi chu not          |
| api/chord_sets.php     | GET/POST         | Bo hop am            |
| api/sessions.php       | GET/POST         | Nhat ky bieu dien    |
| api/setlists.php       | GET/POST         | Setlist              |
| api/import.php         | POST             | Import bai           |
| api/save_xml.php       | POST             | Luu XML chinh sua    |
| api/auth.php           | POST             | Auth                 |

---

## 8. CAU TRUC FILE QUAN TRONG

SheetApp/
├── index.php                   # Entry point
├── INFO.md                     # File nay
├── includes/
│   ├── toolbar.php             # Top toolbar (audio/scroll/compact)
│   ├── sidebar.php             # Sidebar library
│   ├── sheet_viewer.php        # Page-bar + OSMD container
│   └── modals.php              # All modal dialogs
├── assets/
│   ├── css/sheet.css           # Main CSS (877 lines)
│   └── js/
│       ├── app.js              # Main controller (715 lines)
│       ├── app-ui.js           # UI state management
│       ├── chord-canvas.js     # Chord overlay core
│       ├── chord-canvas-ui.js  # Chord popup + smart suggest
│       ├── chord-canvas-xml.js # XML chord inject
│       ├── annotation-canvas.js# Sticky notes
│       ├── performance-notes.js# Song journal
│       ├── osmd-renderer.js    # OSMD wrapper (480 lines)
│       ├── transpose-engine.js # Math: capo, enharmonic
│       ├── auto-scroller.js    # Lerp scroll + BPM sync
│       ├── audio-player.js     # MIDI playback
│       ├── library-ui.js       # Song list + search (428 lines)
│       ├── setlist-ui.js       # Setlist management
│       ├── fab.js              # Floating Action Button (draggable)
│       ├── history-manager.js  # Favorites + recent history
│       └── display-settings.js # Compact mode settings
└── api/                        # PHP REST endpoints (10 files)