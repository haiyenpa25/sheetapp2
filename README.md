# 🎼 SheetApp — Ứng Dụng Quản Lý & Hiển Thị Bản Nhạc Hợp Âm Thông Minh (v2.0-dev)

> **SheetApp** là nền tảng Web Application chuyên nghiệp dành cho **Ban Hát, Ca Đoàn & Nhạc Công** giúp đọc bản nhạc MusicXML, soạn hợp âm trực quan trên nốt nhạc, tự động dịch giọng (Transpose/Capo), đếm nhịp (Metronome), đồng bộ biểu diễn thời gian thực (Live Band Sync) và hỗ trợ bàn đạp Bluetooth đạp chân rảnh tay.

---

## ✨ 🌟 Các Tính Năng Nổi Bật (Key Features)

### 1. 🎼 Hiển Thị Bản Nhạc MusicXML & Chế Độ Gọn Nhẹ (Compact Mode)
- **Engine Render SVG Sắc Nét:** Sử dụng `OpenSheetMusicDisplay (OSMD)` render bản nhạc MusicXML mượt mà trên mọi màn hình (PC, iPad, Điện thoại).
- **Chế Độ Gọn Nhẹ 7 Tùy Chọn (Compact Mode):**
  - Ẩn Khóa Fa (dành cho người hát/guitar).
  - Ẩn các Bè phụ (Alto, Tenor, Bass), ẩn Nốt chùm.
  - **Mới:** Ẩn Lời Ca (dành riêng cho hòa tấu nhạc cụ) & Ẩn Số Ô Nhịp.
- **Khóa Tỷ Lệ View (Lock Zoom 🔒):** Khóa cố định mức Zoom (ví dụ: 140%) trên thiết bị di động, khi đổi sang bài hát khác hệ thống sẽ **giữ nguyên tỷ lệ view** mà không cần căn chỉnh lại.
- **In Ấn Chuẩn A4 (Print Layout):** Tự động căn chỉnh ngắt trang A4 đẹp mắt khi bấm `Ctrl + P`.

---

### 2. 🎸 Hệ Thống Soạn Hợp Âm & Đa Bộ Hợp Âm (Chord Canvas & Multi-Sets)
- **Chỉnh Sửa Trực Quan:** Bấm trực tiếp vào từng nốt nhạc để chèn/sửa/xóa hợp âm.
- **Gợi Ý Thông Minh:** Hệ thống tự động phân tích Tông bài hát (Key Detection) để đưa ra gợi ý hợp âm phù hợp (key-aware).
- **Đa Bộ Hợp Âm Cá Nhân (Custom Named Chord Sets):**
  - Hỗ trợ bộ mặc định `TLH (gốc)` và bộ `HD`.
  - Cho phép người dùng/tài khoản tạo thêm bộ hợp âm cá nhân mới (VD: *Guitar Nam*, *Piano Chú B*, *Ca Đoàn A*).
- **Khóa An Toàn (Core Rules):** Bảo vệ bộ `TLH` và `HD` không bị xóa nhầm.

---

### 3. 🎵 Dịch Giọng Thông Minh (Transpose & Capo Engine)
- **Transpose Bán Âm:** Dịch giọng +/- 12 bán âm linh hoạt.
- **Gợi Ý Đặt Capo:** Tự động gợi ý nấc đặt Capo tối ưu (0-7) và quy đổi dáng hợp âm gốc cho Guitar.
- **Giữ Tông Gốc:** Luôn tải bản nhạc ở `Transpose = 0` ban đầu để tránh sai lệch nốt gốc.

---

### 4. 📡 Đồng Bộ Biểu Diễn Realtime Ban Nhạc (Live Band Sync)
- **Ca Trưởng / Trưởng Nhóm (Host):** Phát sóng phòng biểu diễn (VD: `ROOM-888`). Khi Ca trưởng chọn bài hoặc cuộn trang, ứng dụng tự động phát tín hiệu.
- **Thành Viên Ban Nhạc (Join):** Nhập mã phòng để thiết bị (iPad, Laptop) **tự động chuyển bài và cuộn trang đồng bộ theo Ca trưởng theo thời gian thực (<0.3 giây)**.

---

### 5. 🎹 Bàn Đạp Bluetooth Foot Pedal & Web MIDI
- Tự động kết nối bàn đạp đạp chân Bluetooth / USB MIDI (PageFlip, AirTurn, Donner, iRig).
- Đạp chân để lật trang/cuộn bài hát rảnh tay khi đang biểu diễn.

---

### 6. ⏱️ Máy Đếm Nhịp Pro (Metronome Engine)
- **Web Audio API Engine:** Âm thanh chuẩn xác, không bị trễ tiếng.
- **Chỉ Số Nhịp Lập Lịch:** Hỗ trợ nhịp `2/4`, `3/4`, `4/4`, `6/8` với phách 1 đầu ô nhịp đánh chuông/âm cao (Accented Beat).
- **Visual Beat LED:** Đèn LED nháy nhịp động trực quan bằng mắt.
- **TAP Tempo & Presets:** Tính BPM nhanh bằng cách gõ tay, kèm phím chọn tốc độ chuẩn (*Largo 60*, *Andante 76*, *Moderato 108*, *Allegro 132*).

---

### 7. 📝 Nhật Ký Bài Tập & Ghi Chú Biểu Diễn (Practice Notes)
- Lưu ghi chú biểu diễn riêng cho từng bài hát.
- **Nút "⚡ Tự Lấy Tông & BPM":** Tự động điền Tông đang chuyển và Tempo hiện tại vào ô ghi chú.
- **Gợi Ý Mẫu Nhanh:** Các nút chèn mẫu ghi chú nhanh (`🔄 Điệp khúc x2`, `🎸 Dạo guitar`, `👩 Nữ -> 👨 Nam`, `🛑 Kết nhẹ`).

---

### 8. 📋 Quản Lý Setlist Biểu Diễn & Xuất Dữ Liệu
- Tạo danh sách bài hát (Setlist) cho từng buổi nhóm/buổi tập.
- Đặt Tông và BPM ghi đè cho từng bài trong Setlist.
- **🖨️ In Chương Trình A4:** 1-click in trang lịch tập A4 chuyên nghiệp.
- **📋 Copy Slide:** Copy danh sách bài hát kèm Tông & BPM dán thẳng vào phần mềm trình chiếu nhà thờ (ProPresenter, EasyWorship).

---

### 9. 🔐 Phân Quyền & Quản Lý Tài Khoản (User Roles)
- **Admin:** Quản trị toàn quyền, tạo/xóa tài khoản, tạo Setlist, nạp bài hát.
- **Ban Hát / Nhạc Công (`banhat`):** Tạo bộ hợp âm cá nhân, lưu ghi chú bài hát, tạo Setlist cá nhân.
- **Viewer (Khách):** Xem sheet nhạc, bật đếm nhịp, xem ghi chú.

---

## 🏗️ 📐 Kiến Trúc Dự Án (Architecture & Code Map)

Dự án được xây dựng theo mô hình **Modular Architecture (Pure PHP MVC + Vanilla JS IIFE Modules)** giúp ứng dụng chạy cực nhanh, không phụ thuộc vào framework nặng:

```
sheetapp2/
├── api/                       # RESTful API Backend (PHP 8.1+)
│   ├── controllers/           # Auth, Song, ChordSet, LiveSync, Session, User Controllers
│   ├── services/              # Business Logic & Data Persistence Services
│   ├── core/                  # Database, Auth & Response Handlers
│   └── index.php              # Central API Router
├── assets/
│   ├── css/                   # Vanilla CSS Design System & Print Layouts
│   └── js/                    # Core & Feature Modules
│       ├── core/              # OSMDRenderer, Store, EventBus, ServiceWorkerManager
│       ├── chord-canvas.js    # Core Multi-Set Chord Engine
│       ├── song-loader.js     # Song Loading & Transpose Pipeline
│       ├── live-sync.js       # Realtime Band Sync Engine
│       ├── metronome.js       # Web Audio Metronome Engine
│       └── app.js             # Application Entry Point
├── includes/                  # PHP Layout Views (Toolbar, Sidebar, Sheet Viewer, Modals)
├── storage/                   # File Storage (MusicXML, Chord Sets, Live Sync Rooms, Cache)
├── CODE_MAP.md                # Bản đồ phụ thuộc mã nguồn (Tự động cập nhật qua Gitnexus)
├── CODING_STANDARDS.md        # Tiêu chuẩn mã nguồn dự án
└── sync.sh                    # Script tự động cập nhật CODE_MAP.md & Sync GitHub
```

---

## ⌨️ 🛠️ Phím Tắt Tiện Ích (Keyboard Shortcuts)

| Phím Tắt | Chức Năng |
| :--- | :--- |
| **`ArrowRight` / `ArrowLeft`** | Dịch tông Tăng / Giảm 1 bán âm |
| **`0`** | Reset về Tông gốc ban đầu |
| **`PageDown` / `PageUp`** | Chuyển trang Tiếp theo / Trước |
| **`Space`** | Cuộn mượt màn hình sheet |
| **`C`** | Bật/Tắt chế độ Thêm Hợp Âm |
| **`H`** | Bật/Tắt chế độ Nổi Bật Hợp Âm (Highlight) |
| **`F`** | Bật/Tắt chế độ Toàn Màn Hình (Fullscreen) |
| **`D`** | Bật/Tắt chế độ Sân Khấu (Dark Mode) |
| **`Ctrl + P`** | In bản nhạc chuẩn A4 |
| **`Ctrl + Z` / `Ctrl + Y`** | Undo / Redo thao tác hợp âm |

---

## 🚀 💻 Hướng Dẫn Cài Đặt (Installation)

### 1. Yêu Cầu Môi Trường Server:
- **PHP:** PHP 8.1 trở lên (hỗ trợ `pdo_sqlite`, `json`, `mbstring`).
- **Web Server:** Nginx, Apache hoặc LiteSpeed Web Server.
- **Database:** SQLite (tự động khởi tạo file DB trong `storage/`).

### 2. Triển Khai (Deployment):
```bash
# 1. Clone repository về server
git clone git@github.com:haiyenpa25/sheetapp2.git public_html

# 2. Cấp quyền ghi cho thư mục storage
chmod -R 777 public_html/storage

# 3. Cấp quyền thực thi cho sync.sh
chmod +x public_html/sync.sh
```

---

## ⚙️ 🤖 Quy Trình Đồng Bộ GitHub (Auto-Sync)

Dự án áp dụng quy tắc **Gitnexus Second Brain & Auto GitHub Sync**: Mỗi khi có thay đổi code, chỉ cần chạy script tự động:

```bash
./sync.sh
```

Script sẽ tự động:
1. Chạy `node tools/generate_code_map.js` để tái tạo bản đồ tri thức [CODE_MAP.md](CODE_MAP.md).
2. Tạo Git commit kèm mốc thời gian thực.
3. Push trực tiếp lên branch `main` của GitHub repository `haiyenpa25/sheetapp2`.

---

## 📄 Giấy Phép (License)

Dự án được phát triển và sở hữu bởi **SheetApp Team**. Mọi quyền được bảo lưu.
