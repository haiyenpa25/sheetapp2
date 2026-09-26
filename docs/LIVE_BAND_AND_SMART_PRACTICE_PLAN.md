# Kế Hoạch Thiết Kế & Triển Khai: Live Band Sync & Smart Rehearsal System
**Hệ thống đồng bộ biểu diễn trực tiếp & Hỗ trợ diễn tập thông minh cho SheetApp**

*Tác giả: SheetApp Engineering & AI Architecture*  
*Ngày lập: 24/08/2026*  
*Phiên bản: 1.0 (Draft Specification)*  

---

## MỤC LỤC
1. [Bối cảnh & Mục tiêu dự án](#1-bối-cảnh--mục-tiêu-dự-án)
2. [Phần I: Hệ Thống Live Band Sync (Đồng bộ thời gian thực)](#2-phần-i-hệ-thống-live-band-sync-đồng-bộ-thời-gian-thực)
   - 2.1. Mô hình kiến trúc Master - Follower
   - 2.2. Luồng trải nghiệm người dùng (UX Flow)
   - 2.3. Dữ liệu đồng bộ thời gian thực (State Payload)
   - 2.4. Phân vai hiển thị theo nhạc cụ (Role-based Views)
3. [Phần II: Bộ Diễn Tập Thông Minh (Smart Rehearsal & Song Roadmap)](#3-phần-ii-bộ-diễn-tập-thông-minh-smart-rehearsal--song-roadmap)
   - 3.1. Đếm phách chuẩn bị (Lead-in Count-in "1, 2, 3, 4")
   - 3.2. Cấu trúc bài hát & Đếm ô nhịp dạo (Section Markers & Cue Banner)
   - 3.3. Đổi Tông & Đổi Tempo theo đoạn (Modulation & Multi-tempo Map)
4. [Thiết Kế Cơ Sở Dữ Liệu & API](#4-thiết-kế-cơ-sở-dữ-liệu--api)
5. [Lộ Trình Triển Khai (Phased Roadmap)](#5-lộ-trình-triển-khai-phased-roadmap)

---

## 1. BỐI CẢNH & MỤC TIÊU DỰ ÁN

Trong các buổi thờ phượng, thánh nhạc và biểu diễn trực tiếp của Ban Nhạc / Ca Đoàn:
- **Khó khăn 1 (Lệch bài / Lệch tông):** Khi Trưởng ban (Leader) đổi bài hát hoặc dịch giọng ngẫu hứng theo không khí buổi lễ, các thành viên (Guitar, Piano, Ca đoàn, Trống) trên các thiết bị iPad/điện thoại cá nhân thường bị lúng túng, không chuyển kịp.
- **Khó khăn 2 (Lệch nhịp khi vào bài):** Khi bắt đầu bài hát hoặc qua các đoạn dạo (Intro / Interlude), ca đoàn và ban nhạc hay bị lệch phách đầu tiên do không có đếm nhịp chuẩn bị trực quan.
- **Khó khăn 3 (Thay đổi tiết tấu & Tông cao trào):** Nhiều bài hát chuyển tông (Modulation) ở Điệp khúc cuối hoặc đổi tempo (nhanh dần/chậm dần), nếu không có kịch bản định sẵn thì người chơi đàn dễ quên.

**Mục tiêu:** Xây dựng giải pháp công nghệ toàn diện biến SheetApp thành một **Hệ điều hành biểu diễn trực tiếp (Live Performance OS)** chuyên nghiệp, trực quan và dễ sử dụng nhất.

---

## 2. PHẦN I: HỆ THỐNG LIVE BAND SYNC (ĐỒNG BỘ THỜI GIAN THỰC)

### 2.1. Mô hình kiến trúc Master - Follower

```
                    ┌─────────────────────────────────────────┐
                    │  👑 TRƯỞNG BAN / CA TRƯỞNG (Host/Master)│
                    │  - Chọn bài trong Setlist               │
                    │  - Dịch giọng (Transpose)               │
                    │  - Cuộn trang / Nhảy ô nhịp             │
                    │  - Bật/Dừng Metronome                   │
                    └────────────────────┬────────────────────┘
                                         │ WebSocket / Fast Polling
                                         ▼
                    ┌─────────────────────────────────────────┐
                    │        MÁY CHỦ SHEETAPP (API HUB)       │
                    │  Endpoint: /api/index.php?route=live_sync│
                    │  Room Storage: storage/data/live_sync/  │
                    └────────────────────┬────────────────────┘
                                         │ Broadcast State (< 300ms)
                    ┌────────────────────┼────────────────────┐
                    │                    │                    │
                    ▼                    ▼                    ▼
     ┌──────────────────────┐ ┌──────────────────────┐ ┌──────────────────────┐
     │   🎸 GUITARIST       │ │   🎹 PIANIST         │ │   🎤 CA ĐOÀN         │
     │ - Đồng bộ Song & Tone│ │ - Đồng bộ Song & Tone│ │ - Đồng bộ Song & Tone│
     │ - Hiện Hợp âm riêng  │ │ - Hiện 2 tay nốt nhạc│ │ - Xem Chế độ Lời     │
     │ - Gợi ý thế bấm Capo │ │ - Bật Metronome nháy │ │   (Lyric View to rõ) │
     └──────────────────────┘ └──────────────────────┘ └──────────────────────┘
```

### 2.2. Luồng trải nghiệm người dùng (UX Flow)

1. **Khởi tạo phòng (Dành cho Trưởng ban / Host):**
   - Trưởng ban mở SheetApp -> Bấm nút **📡 Live Band** trên thanh công cụ.
   - Chọn **"Tạo Phòng Phát Sóng"**. Hệ thống tự sinh mã phòng ngắn gọn (VD: `BAND-2026`) kèm **Mã QR Code** to rõ và **Link 1-chạm** (`https://sheet.hyb.io.vn/?live=BAND-2026`).
   - Host có thể chọn nạp sẵn một **Setlist** (VD: "Chương trình Chúa Nhật Tuần 34").

2. **Tham gia phòng (Dành cho Thành viên / Follower):**
   - Thành viên dùng iPad / iPhone / Android quét mã QR hoặc bấm link được gửi trong Zalo/Messenger.
   - Ứng dụng tự động chuyển sang chế độ **Follower (Đang đồng bộ)** với huy hiệu `📡 LIVE: BAND-2026`.
   - Không yêu cầu tạo tài khoản hay đăng nhập phức tạp.

3. **Tương tác trực tiếp trong biểu diễn:**
   - Khi Host chọn bài tiếp theo: Mọi máy thành viên tự động nạp bài hát mới trong vòng 0.3 giây.
   - Khi Host dịch giọng (+1, -2 tone): Mọi máy tự động dịch giọng theo đúng tone đó.
   - Khi Host cuộn trang: Màn hình thành viên tự động cuộn mượt mà (smooth scrolling) theo vị trí tương ứng.

### 2.3. Dữ liệu đồng bộ thời gian thực (State Payload)

```json
{
  "room": "BAND-2026",
  "active": true,
  "leader": "Trần Văn A (Ca Trưởng)",
  "timestamp": 1724508920.45,
  "data": {
    "songId": "thanh-ca-011",
    "songTitle": "Tôn Vinh Chân Thần",
    "setlistId": 3,
    "setlistIndex": 0,
    "transpose": 2,
    "chordProfile": "HD",
    "scrollTop": 340.5,
    "currentMeasure": 12,
    "metronome": {
      "isPlaying": true,
      "bpm": 84,
      "beats": 4
    }
  }
}
```

### 2.4. Phân vai hiển thị theo nhạc cụ (Role-based Views)
Dù nhận chung dữ liệu bài hát và tông từ Host, mỗi thành viên có quyền chọn giao diện phù hợp với nhạc cụ của mình:
- **Chế độ Guitar:** Hiển thị hợp âm màu nổi bật + tự động tính vị trí kẹp Capo (`suggestBestCapo`).
- **Chế độ Piano / Organ:** Hiển thị 2 khuông nhạc (Khóa Sol + Khóa Fa đầy đủ bè SATB).
- **Chế độ Ca viên (Vocal):** Tự động chuyển sang giao diện Lời Nhạc (`LyricExtractor`) phóng to chữ, cuộn mượt không bị vướng khuông nhạc.

---

## 3. PHẦN II: BỘ DIỄN TẬP THÔNG MINH (SMART REHEARSAL & SONG ROADMAP)

### 3.1. Đếm phách chuẩn bị (Lead-in Count-in "1, 2, 3, 4")
- **Nguyên lý:** Trước khi bắt đầu bài hát hoặc khi bấm nút **▶ Phát / Tập**, hệ thống sẽ không phát nhạc ngay mà kích hoạt đếm nhịp chuẩn bị 1 ô nhịp mẫu.
- **Biểu diễn trực quan (Visual Countdown Overlay):**
  - Màn hình hiện đếm lùi số lớn: `[ 3 ] -> [ 2 ] -> [ 1 ] -> [ VÀO HÁT! ]`.
  - Loa phát âm thanh gõ sắc nét (Cowbell / Mõ gỗ) đúng nhịp điệu bài hát (VD nhịp 4/4 gõ 4 phách).
- **Lợi ích:** Đảm bảo 100% nhạc công và ca đoàn đặt tay vào đàn và cất giọng cùng một tích tắc.

### 3.2. Cấu trúc bài hát & Đếm ô nhịp dạo (Section Markers & Cue Banner)
- **Định nghĩa các phân đoạn (Roadmap Segments):**
  Mỗi bài hát có thể được lưu trữ cấu trúc theo ô nhịp:
  - `[Intro]`: Ô 1 – 4 (Dạo đầu)
  - `[Lời 1]`: Ô 5 – 20
  - `[Điệp khúc 1]`: Ô 21 – 36
  - `[Dạo giữa (Interlude)]`: Ô 37 – 40 (Solo Piano/Guitar)
  - `[Lời 2 / Cao trào]`: Ô 41 – 56
  - `[Outro]`: Ô 57 – 60 (Kết thúc)

- **Thanh cảnh báo chuyển đoạn trực quan (Live Cue Banner):**
  - Khi nhạc công đang chơi đoạn dạo (Intro/Interlude), phía trên đầu bản nhạc sẽ xuất hiện thanh nhắc nhở:
    > 💡 **Đang dạo Intro: Còn 2 ô nhịp nữa -> VÀO LỜI 1 (Phách: 1 - 2 - 3 - 4)**
  - Giúp ca viên không cần đếm nhẩm trong đầu, chỉ cần nhìn banner chuyển sang màu xanh là tự tin hát.

### 3.3. Đổi Tông & Đổi Tempo theo đoạn (Modulation & Multi-tempo Map)
- Cho phép cấu hình các điểm chuyển dịch trực tiếp trên bài:
  - *Ví dụ:* Ô nhịp 41 (bắt đầu Điệp khúc cuối) -> Tự động chuyển Tông `+2` (Sol trưởng lên La trưởng) và đẩy Tempo từ `80 BPM` lên `86 BPM`.
  - Khi phát đến ô nhịp 41, hệ thống hiển thị thông báo flash: `⚡ Chuyển Tông: Sol → La (+2) | Tempo: 86 BPM`.

---

## 4. THIẾT KẾ CƠ SỞ DỮ LIỆU & API

### 4.1. Bảng lưu trữ cấu trúc bài hát (`song_roadmaps` trong SQLite)
```sql
CREATE TABLE IF NOT EXISTS song_roadmaps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    song_id TEXT NOT NULL,
    title TEXT,
    structure_json TEXT NOT NULL, -- Mảng JSON các section: intro, verse, chorus, outro...
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Mẫu `structure_json`:**
```json
[
  { "name": "Intro", "startMeasure": 1, "endMeasure": 4, "type": "instrumental", "leadInBeats": 4 },
  { "name": "Lời 1", "startMeasure": 5, "endMeasure": 20, "type": "vocal", "bpm": 80, "transpose": 0 },
  { "name": "Điệp Khúc", "startMeasure": 21, "endMeasure": 36, "type": "vocal", "bpm": 82, "transpose": 0 },
  { "name": "Dạo Giữa", "startMeasure": 37, "endMeasure": 40, "type": "instrumental", "cues": "Chuẩn bị tăng tone" },
  { "name": "Điệp Khúc Cuối", "startMeasure": 41, "endMeasure": 56, "type": "vocal", "bpm": 86, "transpose": 2 },
  { "name": "Outro", "startMeasure": 57, "endMeasure": 60, "type": "instrumental", "bpm": 70 }
]
```

### 4.2. Danh sách API bổ sung
1. `GET /api/index.php?route=live_sync&room={code}`: Polling trạng thái phòng thời gian thực.
2. `POST /api/index.php?route=live_sync`: Host cập nhật trạng thái phòng.
3. `GET /api/index.php?route=roadmaps&songId={id}`: Lấy cấu trúc roadmap bài hát.
4. `POST /api/index.php?route=roadmaps`: Lưu cấu trúc roadmap bài hát (Dành cho Admin/Ban Hát).

---

## 5. LỘ TRÌNH TRIỂN KHAI (PHASED ROADMAP)

### 🚀 Giai đoạn 1: Nâng cấp Live Band Sync Toàn Diện (Ưu tiên cao nhất)
- [ ] Bổ sung giao diện Modal Live Sync trực quan:
  - Tạo phòng tức thì với mã ngẫu nhiên hoặc tự đặt.
  - Tích hợp bộ tạo **Mã QR Code** trực tiếp trên Canvas (dùng thư viện lightweight qrcode.js).
  - Nút sao chép link 1-chạm (`https://sheet.hyb.io.vn/?live=ROOM_CODE`).
- [ ] Tự động kết nối phòng khi mở link có param `?live=ROOM_CODE`.
- [ ] Đồng bộ toàn diện: Đổi bài, Dịch giọng (Transpose), Vị trí cuộn trang, Lời nhạc.
- [ ] Huy hiệu trạng thái Live Sync nổi trên thanh công cụ.

### 🎯 Giai đoạn 2: Bộ đếm Lead-in Count-in & Cảnh Báo Ô Nhịp Dạo
- [ ] Tích hợp chế độ Count-in "1-2-3-4" vào `metronome.js` và `auto-scroller.js`.
- [ ] Thiết kế Visual Overlay đếm ngược số lớn trên màn hình khi bắt đầu tập.
- [ ] Nút lưu BPM & Số phách trực tiếp cho từng bài trong Setlist.

### 🌟 Giai đoạn 3: Song Roadmap & Multi-tempo / Modulation Map
- [ ] Xây dựng giao diện biên tập Section Editor (đánh dấu ô nhịp Intro, Verse, Chorus, Outro).
- [ ] Tự động nhận diện và đếm ô nhịp dạo còn lại trước khi vào hát.
- [ ] Hỗ trợ tự động chuyển tông và đổi tempo theo ô nhịp kịch bản.

---
*Tài liệu này được lưu trữ tại [docs/LIVE_BAND_AND_SMART_PRACTICE_PLAN.md](file:///home/sheet.hyb.io.vn/public_html/docs/LIVE_BAND_AND_SMART_PRACTICE_PLAN.md).*
