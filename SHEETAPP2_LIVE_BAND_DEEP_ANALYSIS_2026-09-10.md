# SHEETAPP2 — BÁO CÁO PHÂN TÍCH CHUYÊN SÂU & NÂNG CAO TÍNH NĂNG LIVE BAND STUDIO (`/live-band/`)

> **Phiên bản tài liệu:** 2.0 — Advanced Stage & Worship Command Ecosystem  
> **Ngày lập báo cáo:** 10/09/2026  
> **Hệ thống áp dụng:** `https://sheet.hyb.io.vn/live-band/`  
> **Đối tượng sử dụng:** Ban quản trị dự án, AI Engineering Agents (Antigravity/Gemini Flash), Trưởng ban âm nhạc, Ca Trưởng ca đoàn, Nhạc công biểu diễn sân khấu.

---

## MỤC LỤC TỔNG QUAN

1. [KẾT LUẬN ĐIỀU HÀNH & TẦM NHÌN CHIẾN LƯỢC](#1-kết-luận-điều-hành--tầm-nhìn-chiến-lược)
2. [MA TRẬN ĐỐI SÁCH VỚI CÁC SẢN PHẨM QUỐC TẾ](#2-ma-trận-đối-sách-với-các-sản-phẩm-quốc-tế)
3. [ĐÁNH GIÁ HIỆN TRẠNG PHÂN HỆ `/live-band/` (V1.0)](#3-đánh-giá-hiện-trạng-phân-hệ-live-band-v10)
4. [10 TRỤ CỘT TÍNH NĂNG NÂNG CAO ĐỘT PHÁ (THE 10 WOW PILLARS)](#4-10-trụ-cột-tính-năng-nâng-cao-đột-phá-the-10-wow-pillars)
   - [Pillar 1: Intelligent Ambient Pad Continuous Drone (Bản Đệm Nền Thờ Phượng Vô Tận)](#pillar-1-intelligent-ambient-pad-continuous-drone)
   - [Pillar 2: Dual-Channel In-Ear Monitor (Stereo Split Click & Voice Prompts)](#pillar-2-dual-channel-in-ear-monitor)
   - [Pillar 3: Bluetooth Foot Pedal & Web MIDI Hardware Integration](#pillar-3-bluetooth-foot-pedal--web-midi-hardware-integration)
   - [Pillar 4: Multi-Display Stage Cast & Clean Lyrics Projector (Xuất Màn Hình Máy Chiếu Nhà Thờ)](#pillar-4-multi-display-stage-cast--clean-lyrics-projector)
   - [Pillar 5: Real-Time Stage Scribble & Collaborative Vector Ink (Bút Vẽ Bút Cảm Ứng Đồng Bộ)](#pillar-5-real-time-stage-scribble--collaborative-vector-ink)
   - [Pillar 6: Smart Rehearsal Looping & Dynamic Song Flow (Vòng Lặp Tập Dượt A-B)](#pillar-6-smart-rehearsal-looping--dynamic-song-flow)
   - [Pillar 7: SATB Vocal Part Soloing & Audio RehearsalMix (Tách Bè Ca Đoàn Tự Học & Tập Dượt)](#pillar-7-satb-vocal-part-soloing--audio-rehearsalmix)
   - [Pillar 8: Soundman / FOH Backstage Intercom & Emergency HUD (Kênh Giao Tiếp Kín Kỹ Thuật Âm Thanh)](#pillar-8-soundman--foh-backstage-intercom--emergency-hud)
   - [Pillar 9: Stage Thermal, Battery & Memory Performance Hardening (Tối Ưu Pin & Độ Mượt Sân Khấu)](#pillar-9-stage-thermal-battery--memory-performance-hardening)
   - [Pillar 10: Service Countdown Timer, Dynamic Liturgy & Setlist Flow (Lộ Trình Thánh Lễ & Đếm Ngược)](#pillar-10-service-countdown-timer-dynamic-liturgy--setlist-flow)
5. [KIẾN TRÚC MẠNG HYBRID SIÊU TỐC & CHỊU TẢI (NETWORK ARCHITECTURE)](#5-kiến-trúc-mạng-hybrid-siêu-tốc--chịu-tải-network-architecture)
6. [ĐẶC TẢ GIAO THỨC & DỮ LIỆU SCHEMA (DATA SPECIFICATIONS)](#6-đặc-tả-giao-thức--dữ-liệu-schema-data-specifications)
7. [LỘ TRÌNH TRIỂN KHAI THEO GIAI ĐOẠN (IMPLEMENTATION ROADMAP)](#7-lộ-trình-triển-khai-theo-giai-đoạn-implementation-roadmap)

---

# 1. KẾT LUẬN ĐIỀU HÀNH & TẦM NHÌN CHIẾN LƯỢC

### 1.1 Tầm Nhìn
Việc tách riêng **Live Sync** thành ứng dụng chuyên biệt tại `https://sheet.hyb.io.vn/live-band/` là một bước đi chiến lược chuẩn xác. Nó biến SheetApp từ một "trình đọc sheet nhạc kèm tính năng phụ" thành một **Stage & Worship Command Ecosystem** (Trung tâm Chỉ Huy Sân Khấu & Ca Đoàn Trực Tiếp).

Nhu cầu thực tế tại các nhà thờ, ca đoàn Công giáo/Tin lành, ban nhạc Acoustic, sự kiện phụng vụ và phòng trà:
- **Ca Trưởng:** Cần nắm quyền kiểm soát tuyệt đối buổi diễn (chuyển bài không độ trễ, đổi tông nhanh khi ca viên hát phô, nhắc nhịp, nhắc vào điệp khúc mà không cần quay lại ngoắc tay ra hiệu gây xao nhãng buổi phụng vụ).
- **Nhạc công (Guitar, Piano/Organ, Trống, Bass):** Cần nốt nhạc rõ ràng, tông chuẩn, gợi ý Capo tức thì, nhịp click chính xác qua tai nghe, không bị tắt màn hình giữa bài.
- **Ca đoàn (Vocal 4 bè SATB):** Cần lời nhạc lớn, tự động cuộn (Teleprompter), có thể solo riêng bè của mình (Soprano, Alto, Tenor, Bass) để nhẩm giai điệu.
- **Kỹ thuật viên máy chiếu (Visual/Projection):** Cần lời bài hát tự động xuất ra màn hình LED/máy chiếu nhà thờ đồng bộ theo từng câu hát của Ca Trưởng mà không cần người gõ tay thủ công bằng PowerPoint hay ProPresenter.

### 1.2 Triết Lý Kỹ Thuật: "100% Web Native — Không Cần Cài App"
Khác với các giải pháp truyền thống bắt buộc phải mua iPad đắt tiền và cài app từ App Store với chi phí hàng trăm USD/năm, SheetApp Live Band Studio cam kết:
1. **Chạy trên mọi phần cứng:** iPad, iPhone, máy tính bảng Android, điện thoại Xiaomi/Samsung giá rẻ, laptop Windows, macOS, TV thông minh.
2. **PWA 1-chạm:** Người dùng chỉ cần quét mã QR bằng Camera là tức thì vào phòng diễn, không cần đăng ký tài khoản rườm rà.
3. **MusicXML Vector Engine:** Đổi tông (Transpose) và định dạng khuông nhạc theo thời gian thực thay vì lật các trang PDF tĩnh bị méo hình.

---

# 2. MA TRẬN ĐỐI SÁCH VỚI CÁC SẢN PHẨM QUỐC TẾ

| Tiêu Chí / Tính Năng | OnSong Pro (iOS) | Planning Center Music Stand | ForScore Cue | MultiTracks ChartBuilder | **SheetApp Live Band Studio (Mục Tiêu Nâng Cao)** |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Nền tảng hỗ trợ** | Chỉ iOS/iPadOS | iOS, Android, Web | Chỉ Apple (iOS/macOS) | iOS, Android | **Đa nền tảng 100% (PWA Web mọi OS)** |
| **Chi phí / Thuê bao** | $49 - $99/năm | Gói trả phí theo hội thánh | Mua 1 lần ($19.99) | $15 - $50/tháng | **Miễn phí / Tối ưu chi phí cho hội đoàn** |
| **Định dạng bài nhạc** | ChordPro, PDF, Text | PDF scan | PDF | Tuyến tính nội bộ | **MusicXML 4 bè SATB tương tác + Chord** |
| **Độ trễ đồng bộ (Latency)** | ~500ms (Bluetooth/Wi-Fi) | 1 - 2 giây | <200ms (Apple Mesh) | ~1 giây | **< 100ms (Hybrid Long-poll + WebRTC)** |
| **Dịch giọng (Transpose)** | Chỉ đổi text hợp âm | Không đổi được nốt nhạc PDF | Không hỗ trợ | Có hỗ trợ | **Dịch cả nốt nhạc MusicXML + Hợp âm HD** |
| **Worship Ambient Pad** | Cần mua thêm In-app ($) | Không có | Không có | Có (Pad Player riêng) | **Tích hợp sẵn Web Audio Ambient Drone** |
| **Dual In-Ear Click/Prompt** | Có (yêu cầu audio interface) | Không có | Không có | Có | **Stereo Split (L: Click/Cue, R: Backing)** |
| **Bàn đạp chân (Pedal)** | Bluetooth MIDI | Bluetooth Pedal | Phím tắt bàn phím | Bluetooth Pedal | **Web MIDI API + Bluetooth Hotkey Engine** |
| **Xuất máy chiếu nhà thờ** | Xuất HDMI cơ bản | Không | Không | Cần phần mềm riêng | **Web Presentation API Clean Lyrics Output** |
| **Chế độ Offline LAN Mesh** | Có (Apple Multipeer) | Không (Cần Internet) | Có (Bonjour) | Có | **P2P WebRTC DataChannel Local Mesh** |

---

# 3. ĐÁNH GIÁ HIỆN TRẠNG PHÂN HỆ `/live-band/` (V1.0)

### 3.1 Những Gì Đã Hoàn Thành Rất Tốt
1. **Kiến trúc tách rời độc lập:** Route sạch `https://sheet.hyb.io.vn/live-band/`, không xung đột với ứng dụng chính.
2. **Stage Dark Theme:** Nền đen OLED `#09090f`, chữ tương phản cao, chống lóa mắt trên sân khấu tối.
3. **Screen WakeLock:** API giữ màn hình thiết bị luôn sáng, giải quyết triệt để lỗi tự khóa màn hình khi đang đàn.
4. **Count-In Sync & Web Audio Click:** Đếm ngược 4 phách kèm âm thanh bíp tần số kép (920Hz / 540Hz) giúp cả ban bắt nhịp chuẩn xác.
5. **Hiệu lệnh chiến thuật (Tactical Cues):** Banner viền Neon nổi bật báo vào Điệp khúc, Cao trào, Nhỏ dần, Kết bài.
6. **Vai trò cá nhân hóa (Role HUDs):** Guitar Capo Suggester, Drummer LED Flasher, Vocal Teleprompter.
7. **Chia sẻ QR Code phóng to:** Quét mã camera vào phòng trực tiếp trong 1 giây.

### 3.2 Các Điểm Nghẽn Cần Đột Phá Lên V2.0
- **Phụ thuộc kết nối Internet:** Nếu Wi-Fi nhà thờ bị rớt cáp quang (mất Internet ngoài) nhưng router LAN vẫn chạy, hệ thống polling hiện tại sẽ báo ngắt kết nối. Cần có giải pháp **Local Mesh Fallback**.
- **Không gian chuyển bài bị "khoảng lặng chết" (Dead Silence):** Khi Ca Trưởng đổi bài từ bài 1 sang bài 2 trong giờ thờ phượng/cầu nguyện, không gian nhà thờ bị im lặng ngượng ngùng. Cần **Ambient Pad Generator** đệm nền vô tận kết nối các bài hát.
- **Tiếng Click Metronome lọt ra ngoài loa:** Nếu nhạc công bật âm lượng máy to để nghe nhịp, tiếng click sẽ lọt ra ngoài micro. Cần giải pháp **Stereo Split Audio**.
- **Chưa tận dụng Bàn Đạp Chân (Foot Pedal):** Nhạc công Piano/Guitar cả hai tay đều bận đàn, không thể đưa tay lên vuốt màn hình để chuyển ô nhịp hoặc kích hoạt Cue.

---

# 4. 10 TRỤ CỘT TÍNH NĂNG NÂNG CAO ĐỘT PHÁ (THE 10 WOW PILLARS)

---

## Pillar 1: Intelligent Ambient Pad Continuous Drone
### (Bản Đệm Nền Thờ Phượng Vô Tận)

#### 1. Khái niệm & Giá trị
Trong các buổi thờ phượng hoặc phụng vụ, âm thanh nền (Ambient Pad) là lớp âm thanh dạng sóng tổng hợp êm dịu, ấm áp (dựa trên nốt Chủ âm 1 và Bậc năm 5 - Root & 5th drone). Âm thanh này tạo bầu không khí trang nghiêm, che đi các khoảng lặng vụng về khi ca đoàn lật bài, khi linh mục/mục sư cầu nguyện hoặc khi đổi bài hát.

#### 2. Kiến trúc Kỹ thuật (Web Audio Wavetable Synth)
Không cần tải file audio MP3 nặng hàng chục Megabyte, Live Band Studio sẽ tích hợp bộ tổng hợp âm **Continuous Wavetable Synth**:
- Tạo 4 lớp âm sắc hòa quyện:
  - **Sub Warmth:** Sinewave trầm ấm tại tần số cơ bản (Root frequency, vd: C2 = 65.4Hz).
  - **Warm String Pad:** Sawtooth wave qua Low-pass filter cắt ở 450Hz tạo độ dày.
  - **Choral Shimmer:** Lớp Triangle wave nhân đôi octave (Root + 5th) kèm LFO (Low Frequency Oscillator 0.2Hz) tạo cảm giác bềnh bồng.
  - **Air Texture:** Lớp tiếng gió nhẹ (Pink noise đã lọc qua dải 2kHz - 6kHz) tạo độ sâu điện ảnh.

#### 3. Thuật toán Smooth Crossfade Khi Đổi Tông
Khi Ca Trưởng chuyển từ bài Tông **C** sang bài Tông **G**:
1. Động cơ tự động giữ nốt chung (nốt G là bậc 5 của C và là bậc 1 của G).
2. Nốt C cũ sẽ mờ dần (Fade-out) trong vòng **3.5 giây** theo hàm mũ `exponentialRampToValueAtTime`.
3. Nốt D mới (bậc 5 của G) sẽ trỗi dậy êm ái (Fade-in) trong vòng **4.0 giây**.
4. Toàn bộ ban nhạc và giáo dân sẽ cảm nhận một sự chuyển tông hoàn hảo như nhạc phim, không có bất kỳ tiếng "khựng" hay giật cục nào.

---

## Pillar 2: Dual-Channel In-Ear Monitor
### (Stereo Split Click & Voice Prompts Cho Tai Nghe Nhạc Công)

#### 1. Vấn đề thực tế
Trên sân khấu, nhạc công đeo tai nghe kiểm âm (In-Ear Monitor - IEM). Nếu chỉ xuất âm thanh thông thường qua cổng 3.5mm hoặc Bluetooth:
- Nếu cắm vào dàn mixer PA chính của hội trường: Tiếng click đếm nhịp "tách... tách..." sẽ phát ra loa lớn khiến người nghe khó chịu.
- Nếu không cắm mixer: Nhạc công không thể phát tiếng lót đệm hay tiếng mẫu (samples) từ máy.

#### 2. Giải pháp Kỹ thuật: "Stereo Splitter Matrix"
Sử dụng `ChannelMergerNode` và `ChannelSplitterNode` của Web Audio API:
```text
┌─────────────────────────────────────────────────────────────┐
│                    LIVE BAND STEREO ENGINE                  │
├──────────────────────────────┬──────────────────────────────┤
│    KÊNH TRÁI (LEFT CHANNEL)   │   KÊNH PHẢI (RIGHT CHANNEL)  │
│        [STAGE IN-EAR]        │        [HOUSE MAIN PA]       │
├──────────────────────────────┼──────────────────────────────┤
│ • Click Metronome phách 1/4  │ • Nhạc đệm Backing Track     │
│ • Giọng đếm phách tiếng Việt  │ • Âm đệm Ambient Pad Synth   │
│   ("Một - Hai - Vào!")       │ • Tiếng đàn ảo SATB solo     │
│ • Cảnh báo Cue của Ca Trưởng │ (Tuyệt đối KHÔNG có tiếng    │
│   ("Chuẩn bị Điệp khúc")     │  click hay giọng nói chỉ huy)│
└──────────────────────────────┴──────────────────────────────┘
```
Nhạc công chỉ cần dùng 1 sợi cáp chữ Y (1 đầu 3.5mm ra 2 đầu 6.5mm):
- Dây Trái cắm vào bộ phát tai nghe in-ear của ban nhạc.
- Dây Phải cắm thẳng vào cổng DI Box ra dàn mixer lớn.

---

## Pillar 3: Bluetooth Foot Pedal & Web MIDI Hardware Integration
### (Tích Hợp Bàn Đạp Chân Bluetooth & Bàn Điều Khiển Phần Cứng)

#### 1. Thiết bị mục tiêu
Tương thích hoàn toàn với tất cả các dòng bàn đạp phổ biến trên thị trường thế giới:
- **AirTurn (BT500, DUO, QUAD)**
- **PageFlip (Butterfly, Firefly)**
- **Donner Wireless Page Turner**
- **Coda Music Technologies STOMP**
- Bàn phím số không dây hoặc nút bấm Bluetooth gắn trên cần đàn Guitar.

#### 2. Kiến trúc Web MIDI & Key Mapping Engine
Live Band Studio hỗ trợ 2 chế độ nhận diện đồng thời:
1. **Chế độ Keyboard Emulation:** Bắt các mã phím tiêu chuẩn của bàn đạp:
   - `ArrowLeft` / `ArrowRight`
   - `PageUp` / `PageDown`
   - `Space` / `Enter`
2. **Chế độ Web MIDI API (`navigator.requestMIDIAccess`):**
   - Bắt các sự kiện `Control Change (CC)` hoặc `Program Change (PC)` từ bàn đạp MIDI chuyên nghiệp.

#### 3. Bản Đồ Thao Tác Bằng Chân (Foot Pedal Macro Actions)
Người dùng có thể gán thao tác trực quan trong màn hình cài đặt:
- **Giẫm 1 lần Pedal Phải:** Cuộn tới 2 ô nhịp / Nhảy tới Phân đoạn tiếp theo (Next Section).
- **Giẫm 1 lần Pedal Trái:** Cuộn lùi 2 ô nhịp / Nhảy về Phân đoạn trước đó.
- **Giẫm giữ 1.5 giây Pedal Phải:** Kích hoạt ngay **Count-In 4 phách** cho cả ban nhạc.
- **Giẫm đúp (Double Tap) Pedal Trái:** Bắn hiệu lệnh khẩn cấp **"⚡ Điệp Khúc"** hoặc **"🛑 Chuẩn Bị Kết"**.

---

## Pillar 4: Multi-Display Stage Cast & Clean Lyrics Projector
### (Xuất Màn Hình Máy Chiếu Nhà Thờ & Màn Hình LED Phụ)

#### 1. Nhu cầu thực tế
Trong hầu hết các buổi phụng vụ, nhà thờ có:
1. Màn hình tablet của Ca Trưởng (đầy đủ nốt nhạc, khuông nhạc 4 bè, hợp âm, nút bấm chỉ huy).
2. Máy chiếu hoặc màn hình LED lớn treo giữa cung thánh cho cộng đoàn/giáo dân hát theo.
Hiện nay, các ca đoàn phải bố trí 1 người ngồi gõ PowerPoint hoặc bấm phần mềm chiếu lời riêng, thường xuyên xảy ra tình trạng: Ca Trưởng đã hát sang lời 2 nhưng máy chiếu vẫn kẹt ở lời 1.

#### 2. Tính Năng "Clean Lyrics Cast" (Presentation API)
Live Band Studio tích hợp **Web Presentation API** (`new PresentationRequest('/live-band/projector.php')`):
- Khi kết nối với cáp HDMI máy chiếu hoặc Chromecast/AirPlay:
  - Hệ thống tự động mở cửa sổ trình chiếu thứ hai.
  - **Tự động lọc bỏ:** Toàn bộ khuông nhạc, nốt nhạc, hợp âm, nút bấm điều khiển.
  - **Chỉ giữ lại:** Lời bài hát thuần túy (Clean Typography), cỡ chữ khổng lồ (Dynamic Responsive Font), tương phản cực cao (Nền đen chữ trắng hoặc chữ vàng kim sang trọng).
- **Đồng bộ tự động theo ô nhịp:** Ca Trưởng cuộn đến ô nhịp nào, câu lời ca tương ứng trên máy chiếu sẽ tự động nhảy sáng (highlight) và cuộn trang mượt mà trong 0.2 giây.

---

## Pillar 5: Real-Time Stage Scribble & Collaborative Vector Ink
### (Bút Vẽ Bút Cảm Ứng Đồng Bộ Theo Thời Gian Thực)

#### 1. Trải nghiệm luyện tập thực tế
Trong các buổi tập dượt ca đoàn:
- Ca Trưởng thường muốn ghi chú vào bản nhạc: *"Đoạn này hát nhỏ"*, *"Bè Alto lấy hơi ở đây"*, khoanh tròn dấu lặng, hoặc gạch chéo 2 ô nhịp không đàn.
- Nếu ghi chú bằng giấy thì mỗi người một bản, sửa đổi rất tốn thời gian.

#### 2. Kiến trúc Vector Ink Canvas
- Xây dựng một lớp `StageAnnotationLayer` trong suốt phủ trực tiếp lên trên SVG của OpenSheetMusicDisplay.
- Hỗ trợ đầy đủ: Apple Pencil trên iPad, S-Pen trên Samsung Tab, và ngón tay cảm ứng.
- Thuật toán làm mượt nét vẽ **Catmull-Rom Spline** giúp chữ viết tay mượt mà, tự nhiên như viết trên giấy thật.
- **Phát sóng nét vẽ tức thì (Live Vector Broadcast):**
  - Tọa độ nét vẽ được chuẩn hóa theo tỷ lệ tương đối của ô nhịp (`measureRelativeX`, `measureRelativeY`).
  - Dù ca viên dùng màn hình điện thoại 6 inch hay tablet 12.9 inch, nét mực Ca Trưởng khoanh tròn vẫn rơi chính xác 100% vào nốt nhạc đó.
  - Kích thước payload cực nhẹ (< 1KB cho một nét vẽ gồm danh sách điểm vector nén).

---

## Pillar 6: Smart Rehearsal Looping & Dynamic Song Flow
### (Vòng Lặp Tập Dượt A-B & Xếp Lại Cấu Trúc Bài Linh Hoạt)

#### 1. Vòng Lặp A-B Loop Thông Minh
- Trong lúc tập hát, có một đoạn điệp khúc hoặc chuyển bè rất khó mà ca đoàn hay hát sai:
  - Ca Trưởng chỉ cần chạm vào ô nhịp bắt đầu (Điểm A) và ô nhịp kết thúc (Điểm B) trên thanh Roadmap.
  - Bật công tắc **🔁 Loop Practice**: Hệ thống sẽ tự động phát metronome lặp đi lặp lại từ A đến B.
  - Mỗi khi hết đoạn B, hệ thống tự động đếm 2 phách chuẩn bị rồi vòng lại đoạn A.
  - Ca viên không cần thao tác gì, chỉ tập trung luyện giọng cho đến khi thuần thục.

#### 2. Thay Đổi Cấu Trúc Bài Sống (Dynamic Arrangement On-the-fly)
- Không bị bó buộc vào thứ tự cố định của bài hát:
  - Nếu linh mục/mục sư giảng dài hơn hoặc lễ sinh đi rước lễ đông hơn dự kiến, Ca Trưởng cần kéo dài bài hát.
  - Bảng điều khiển Roadmap cho phép Ca Trưởng bấm ngay vào các chip: `[Hát lại Điệp Khúc]` -> `[Gian Tấu Đàn]` -> `[Vào Lời 3]` -> `[Điệp khúc Cao trào]` -> `[Outro]`.
  - Toàn bộ thiết bị của ban nhạc và máy chiếu sẽ lập tức nhảy theo đúng phân đoạn đó mà không ai bị lỡ nhịp.

---

## Pillar 7: SATB Vocal Part Soloing & Audio RehearsalMix
### (Tách Bè Ca Đoàn Tự Học & Tập Dượt Đa Kênh)

#### 1. Nhu cầu phân bè Ca Đoàn (Soprano, Alto, Tenor, Bass)
Ca đoàn phụng vụ có 4 bè riêng biệt. Các ca viên mới thường gặp khó khăn: khi cả 4 bè cùng hát, họ bị "cuốn" theo giai điệu của bè chính (Soprano) và quên mất giai điệu bè của mình (Alto/Tenor/Bass).

#### 2. Kiến trúc Audio RehearsalMix
Lấy cảm hứng từ công nghệ RehearsalMix nổi tiếng thế giới của MultiTracks:
- Tận dụng bộ tổng hợp âm SATB Web Audio Synth của SheetApp:
- Mỗi ca viên khi chọn vai trò của mình (Ví dụ: `🎤 Ca Viên — Bè Alto`):
  - **Chế độ Mute Others:** Âm thanh của bè Alto sẽ được tăng âm lượng lên `+3dB` và pan ra chính giữa tai nghe.
  - Các bè còn lại (Soprano, Tenor, Bass) được hạ âm lượng xuống `-12dB` và pan nhẹ sang 2 bên tai nghe để làm nền tham chiếu.
  - Ca viên có thể nghe rõ từng nốt luyến láy của bè mình một cách dễ dàng và tự tin.

---

## Pillar 8: Soundman / FOH Backstage Intercom & Emergency HUD
### (Kênh Giao Tiếp Kín Kỹ Thuật Âm Thanh & Báo Động Sân Khấu)

#### 1. Vấn đề thực tế
Khoảng cách giữa bàn mixer kỹ thuật âm thanh (thường nằm cuối nhà thờ) và Ca Trưởng/Ban nhạc (nằm trên cung thánh) thường rất xa (30m - 50m).
- Khi có sự cố (Micro Ca Trưởng hết pin, tiếng đàn Guitar quá chói, loa monitor bị hú), kỹ thuật viên âm thanh không có cách nào báo cho Ca Trưởng mà không phải chạy lên hoặc ra hiệu tay vụng về.

#### 2. Giải pháp: "Backstage Intercom Banner"
- Kỹ thuật viên âm thanh có thể truy cập `https://sheet.hyb.io.vn/live-band/?role=soundman`.
- Giao diện Soundman có các nút bấm nhanh:
  - 🔋 *"Mic 1 (Ca Trưởng) sắp hết pin"*
  - 🎸 *"Giảm bớt âm lượng đàn Guitar"*
  - 🔊 *"Loa Monitor đang bị chạm hú"*
  - ⏱ *"Bài hát kết thúc sớm 1 phút"*
- Thông báo này sẽ chỉ hiển thị rung nhẹ và nhấp nháy góc dưới màn hình của Ca Trưởng (hoặc kèm âm báo "tút" nhẹ vào tai nghe in-ear của Ca Trưởng), hoàn toàn không làm phân tâm các ca viên khác và không lọt ra ngoài.

---

## Pillar 9: Stage Thermal, Battery & Memory Performance Hardening
### (Tối Ưu Hóa Năng Lượng, Tản Nhiệt & Bộ Nhớ Sân Khấu)

#### 1. Thách Thức Sân Khấu Sống
Một buổi lễ hoặc buổi diễn kéo dài liên tục từ 2 đến 4 tiếng. Nếu ứng dụng web chạy ngốn CPU:
- Tablet sẽ bị nóng rực (Thermal Throttling), gây giật lag hoặc tự sập nguồn.
- Pin tụt nhanh (mỗi giờ tốn 40-50% pin).
- Trình duyệt Safari/Chrome bị tràn bộ nhớ (Out of Memory Crash) khi mở qua 30-40 bài hát.

#### 2. Các Giải Pháp Tối Ưu Đẳng Cấp
1. **Pure OLED Zero-Power Black (`#000000`):**
   - Chuyển toàn bộ nền từ xám đậm `#09090f` sang đen tuyệt đối `#000000`.
   - Trên các màn hình OLED/AMOLED (iPad Pro, iPhone, Samsung Galaxy Tab), các điểm ảnh màu đen sẽ tắt hoàn toàn nguồn điện, giúp tiết kiệm tới **45% năng lượng pin**.
2. **Dynamic RequestAnimationFrame Sleep:**
   - Khi bản nhạc không cuộn và không có tương tác người dùng, vòng lặp render đồ họa sẽ đưa về trạng thái "Sleep" (0% GPU usage).
   - Chỉ đánh thức khi nhận được event đổi ô nhịp hoặc tương tác chạm.
3. **SVG DOM Virtualization & OSMD Memory Recycling:**
   - Dọn dẹp triệt để các phần tử SVG cũ trong bộ nhớ RAM khi chuyển bài (`osmd.clear()` và giải phóng bộ nhớ đệm canvas).
   - Đảm bảo ứng dụng chạy liên tục 6 tiếng trong ngày Chủ Nhật mà RAM không vượt quá 120MB.

---

## Pillar 10: Service Countdown Timer, Dynamic Liturgy & Setlist Flow
### (Lộ Trình Thánh Lễ & Bộ Đếm Thời Gian Chuẩn Xác)

#### 1. Đồng Hồ Đếm Ngược Giờ Khai Lễ (Pre-Service Countdown)
- Hiển thị đồng hồ đếm ngược lớn sắc nét trên màn hình điều khiển: *"Còn 04:35 bắt đầu Thánh Lễ"*.
- Giúp toàn bộ ca đoàn và ban nhạc chuẩn bị sẵn sàng tư thế, nhạc cụ trước khi chuông nhà thờ điểm.

#### 2. Lộ Trình Phụng Vụ Động (Dynamic Liturgy Roadmap)
Một buổi Thánh Lễ có các phần cố định:
```text
[1. Ca Nhập Lễ] ➔ [2. Kinh Thương Xót] ➔ [3. Kinh Vinh Danh] ➔ 
[4. Đáp Ca]     ➔ [5. Dâng Lễ]         ➔ [6. Kinh Thánh Thánh] ➔ 
[7. Hiệp Lễ]    ➔ [8. Tạ Lễ / Kết Lễ]
```
- Mỗi bài hát trong Setlist được gắn thẻ với phần phụng vụ tương ứng.
- Khi một phần hát xong, thẻ đó tự động chuyển sang màu xanh lá (`✓ Đã hoàn thành`).
- Ca Trưởng luôn biết mình đang ở giai đoạn nào của buổi phụng vụ, không bao giờ bị nhầm lẫn giữa các bài hát.

---

# 5. KIẾN TRÚC MẠNG HYBRID SIÊU TỐC & CHỊU TẢI (NETWORK ARCHITECTURE)

Để phục vụ từ một nhóm nhỏ 5 nhạc công cho đến ca đoàn lớn 80 người và toàn thể cộng đoàn hàng trăm người cùng kết nối, kiến trúc mạng phải giải quyết bài toán: **Độ trễ tối thiểu + Chịu tải cao + Hoạt động được cả khi mất Internet**.

```
                        ┌──────────────────────────────────────────────┐
                        │          CA TRƯỞNG (HOST COMMAND)            │
                        └───────┬──────────────────────────────┬───────┘
                                │                              │
                [Internet Online Mode]                [Local Offline Mode]
                                │                              │
                                ▼                              ▼
                 ┌─────────────────────────────┐  ┌─────────────────────────────┐
                 │ Cloud Server (CyberPanel)   │  │ Local LAN P2P Mesh (WebRTC) │
                 │ • Long-Polling Revision     │  │ • DataChannel peer-to-peer  │
                 │ • SSE / WebSocket Fast Bus  │  │ • Local Wi-Fi Router mDNS   │
                 └──────────────┬──────────────┘  └──────────────┬──────────────┘
                                │                                │
                                └────────────────┬───────────────┘
                                                 │
                                                 ▼
        ┌─────────────────────────────────────────────────────────────────────────────────┐
        │                          THIẾT BỊ THÀNH VIÊN SÂN KHẤU                           │
        ├─────────────────┬─────────────────┬─────────────────┬───────────────────────────┤
        │  🎸 Guitar HUD  │  🎹 Piano SATB  │ 🥁 Drummer LED  │ 🎤 Ca Đoàn Teleprompter   │
        └─────────────────┴─────────────────┴─────────────────┴───────────────────────────┘
```

### 5.1 Kiến Trúc 3 Lớp Mạng (Tri-Layer Hybrid Transport)
1. **Lớp 1: HTTP/2 Long-Polling Siêu Nhẹ (<300ms) [Đang Chạy Tốt]:**
   - Sử dụng revision diffing.
   - Nếu bản nhạc không đổi, server chỉ trả về `{ modified: false, rev: 14 }` nặng chưa đầy 40 bytes.
   - Tương thích 100% với mọi tường lửa, Cloudflare proxy, và mọi loại mạng di động 4G/5G.
2. **Lớp 2: WebSocket Streaming (<50ms) [Giai đoạn tiếp theo]:**
   - Kênh truyền hai chiều liên tục phục vụ phát nhịp Metronome đồng bộ và gửi hiệu lệnh Cue tức thì.
3. **Lớp 3: Local P2P WebRTC DataChannel [Offline Resilience]:**
   - Khi mạng nhà thờ bị mất kết nối Internet ra quốc tế:
   - Các thiết bị trong cùng mạng Wi-Fi nội bộ tự động bắt tay qua WebRTC DataChannel.
   - Dữ liệu đồng bộ chạy trực tiếp giữa các iPad/điện thoại mà không cần đi ra máy chủ ngoài Internet.

---

# 6. ĐẶC TẢ GIAO THỨC & DỮ LIỆU SCHEMA (DATA SPECIFICATIONS)

### 6.1 Cấu Trúc Trạng Thái Phòng V2.0 (`room_state_v2.json`)
```json
{
  "roomCode": "STAGE-2026",
  "revision": 84,
  "createdAt": 1789012345,
  "updatedAt": 1789012399,
  "service": {
    "title": "Thánh Lễ Chúa Nhật XX Thường Niên",
    "countdownTarget": 1789014000,
    "currentLiturgyStep": "offertory"
  },
  "host": {
    "clientId": "client-abc-123",
    "name": "Ca Trưởng Giuse",
    "device": "iPad Pro 12.9"
  },
  "song": {
    "songId": "thanh-ca-001",
    "songTitle": "Hỡi Thánh Vương, Kíp Ngự Lai",
    "setlistId": "setlist-sunday-2026",
    "setlistIndex": 2,
    "totalSongs": 5
  },
  "music": {
    "baseKey": "G",
    "transpose": 2,
    "effectiveKey": "A",
    "bpm": 84,
    "timeSignature": "3/4"
  },
  "position": {
    "measure": 17,
    "sectionId": "sec-chorus",
    "sectionName": "Điệp Khúc",
    "isLooping": false,
    "loopRange": [17, 24]
  },
  "ambientPad": {
    "enabled": true,
    "rootKey": "A",
    "texture": "warm_choral",
    "volume": 0.65
  },
  "cue": {
    "id": "cue-9812",
    "type": "chorus",
    "text": "⚡ CHUẨN BỊ VÀO ĐIỆP KHÚC",
    "icon": "⚡",
    "durationMs": 3500,
    "sentAt": 1789012395
  },
  "transport": {
    "state": "playing",
    "bpm": 84,
    "countInBars": 1,
    "startAt": 1789012390.45
  },
  "intercom": {
    "urgent": false,
    "sender": "Soundman FOH",
    "message": "Mic Ca Trưởng pin 15%"
  },
  "roster": {
    "total": 12,
    "roles": {
      "leader": 1,
      "guitar": 2,
      "piano": 1,
      "vocal": 6,
      "drummer": 1,
      "soundman": 1
    }
  }
}
```

---

# 7. LỘ TRÌNH TRIỂN KHAI THEO GIAI ĐOẠN (IMPLEMENTATION ROADMAP)

Để đảm bảo chất lượng kỹ thuật cao nhất và không làm gián đoạn hệ thống đang hoạt động, quá trình nâng cấp Live Band Studio sẽ được chia thành 4 giai đoạn cụ thể:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                       LỘ TRÌNH PHÁT TRIỂN 4 GIAI ĐOẠN                        │
├──────────────────────────────────────────────────────────────────────────────┤
│ GIAI ĐOẠN 1: NÂNG CAO TRẢI NGHIỆM BIỂU DIỄN & TAI NGHE (STAGE ENHANCEMENT)    │
│ • Intelligent Ambient Pad Continuous Drone Synth (Web Audio).                │
│ • Dual-Channel In-Ear Monitor Splitter (L: Click & Voice Prompts, R: Audio). │
│ • Bluetooth Foot Pedal Hotkey & Web MIDI Mapping Engine.                     │
├──────────────────────────────────────────────────────────────────────────────┤
│ GIAI ĐOẠN 2: TRÌNH CHIẾU MÁY CHIẾU & TẬP LUYỆN (PROJECTION & REHEARSAL)      │
│ • Web Presentation API Clean Lyrics Projector (Xuất máy chiếu nhà thờ).      │
│ • Vòng lặp tập dượt thông minh A-B Loop Rehearsal.                           │
│ • SATB Vocal Part Soloing (Tách âm lượng bè riêng cho ca viên).              │
├──────────────────────────────────────────────────────────────────────────────┤
│ GIAI ĐOẠN 3: TƯƠNG TÁC CỘNG TÁC & PHÒNG THỜ PHƯỢNG (INTERACTION & LITURGY)   │
│ • Live Collaborative Vector Ink (Bút vẽ Apple Pencil đồng bộ tức thì).       │
│ • Service Countdown Timer & Phân đoạn Thánh Lễ (Liturgy Roadmap).            │
│ • Soundman Backstage Intercom (Kênh giao tiếp kín âm thanh).                 │
├──────────────────────────────────────────────────────────────────────────────┤
│ GIAI ĐOẠN 4: HẠ TẦNG OFFLINE & MẠNG HYBRID (ENTERPRISE RESILIENCE)           │
│ • WebRTC DataChannel Local Wi-Fi Mesh (Không cần Internet vẫn sync 100%).    │
│ • Tối ưu năng lượng Pure OLED Black Battery & Memory Hardening.              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

# 8. KẾT LUẬN & ĐỀ XUẤT HÀNH ĐỘNG TIẾP THEO

Báo cáo phân tích nâng cao này đã phác thảo toàn bộ bức tranh kiến trúc kỹ thuật và định vị sản phẩm của **Live Band Studio** (`https://sheet.hyb.io.vn/live-band/`). 

Hệ thống đã có một nền tảng vững chắc (V1.0 hoạt động ổn định, cú pháp chuẩn xác, tự động đồng bộ). Khi từng bước triển khai các trụ cột trong lộ trình trên, SheetApp sẽ trở thành giải pháp số 1 tại Việt Nam và mang tầm quốc tế cho các ban nhạc, ca đoàn phụng vụ và các buổi biểu diễn âm nhạc trực tiếp.
