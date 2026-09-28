# SheetApp2 — ROADMAP 4: Trang THƯ VIỆN lên 10/10 cho Ban Nhạc trong Chương Trình Lễ

> Ngày lập: 2026-09-26
> Phạm vi: **chỉ trang chính / Thư viện** (`index.php`, ví dụ `http://localhost/sheetapp2/?song=thanh-ca-001`). Các trang khác (live-band, learn, editor, manager) từ nay là **phụ**.
> Người đọc: chủ dự án (duyệt, quyết định) và AI/dev thực thi. Người thực thi vẫn phải theo **luật làm việc ở `ROADMAP3.md` Phần 0**.
> Nguồn phân tích (2026-09-26):
> - Playwright chụp trang thật ở 4 kích thước (iPad ngang/dọc, iPhone, desktop), gồm chế độ tối và chế độ biểu diễn.
> - Đo hiệu năng thật.
> - Kiểm kê code và dữ liệu (DB chỉ đọc + quét 903 file MusicXML).
> - Benchmark 11 app chuyên nghiệp: Planning Center Music Stand, OnSong, forScore, MobileSheets, SongbookPro, WorshipTools/Loop, MultiTracks ChartBuilder, Ultimate Guitar, Newzik, BandHelper, Setlist Helper.
>
> Các mục đánh dấu ✅ là đã tự kiểm chứng trực tiếp.

---

## 0. TÓM TẮT

### Điểm hiện tại: **4.6 / 10**

| Hạng mục | Điểm | Lý do chính |
|---|:-:|---|
| Ấn tượng đầu & bố cục | 4 | Trên iPad ngang, sidebar chiếm 25% bề ngang, thanh công cụ chiếm 18% chiều cao. Nhạc chỉ còn khoảng 62% màn hình |
| Đọc được trên sân khấu | 4 | Hợp âm (15px) **nhỏ hơn** lời (20px). Chế độ tối **không tối** bản nhạc (bị đảo màu 2 lần nên triệt tiêu) |
| Việc chính của band | 5.5 | **Không tìm được theo số bài** ("123" ra 0 kết quả). Hợp âm thiếu hoặc mâu thuẫn |
| Nút bấm / cảm ứng | 3 | **59/59 nút** trên iPad ngang nhỏ hơn 44px. Thanh công cụ tràn, giấu mất nút Biểu diễn, Bài trước/sau và menu ⋮ |
| Danh sách thư viện | 5 | Đủ chức năng nhưng mỗi dòng dày 51px, 7 bộ lọc chiếm 315px, bộ lọc mùa/chủ đề rỗng |
| Khả năng truy cập | 4 | Tương phản chữ phụ 2.4–3.4:1; viền focus gần như vô hình |
| Hiệu năng | 6 | Hiện bản nhạc sau 1.3–1.5 s. Mỗi lần đổi bài render 2 lần, gọi 9 API. Dịch giọng mất ~1 s |
| Ổn định | 5 | 14 lỗi quan sát được, trong đó có 3 module "chết" do không được gắn vào `window` |

### Ba lỗi làm trang "không ra gì" (sửa ngay trong tuần đầu)

1. ✅ **~96% bài hát KHÔNG HIỆN HỢP ÂM NÀO.** 865/903 bộ HD đang rỗng. Khi đang chọn bộ HD, CSS ẩn toàn bộ hợp âm TLH có sẵn trong XML (`chord-canvas.js:296-310`), và không có nhánh dự phòng khi HD rỗng. Ví dụ bài 002: XML có 33 hợp âm, trên màn hình hiện 0. Điều này **vi phạm Core Rule 1** ("HD rỗng → hiện TLH gốc"). Tài sản hợp âm thật của app (TLH, có trong 100% file XML) đang bị giấu đi.
2. ✅ **`ChordCanvas`, `HistoryManager`, `PageNav` không được gắn vào `window`.** Có 29 lời gọi `window.ChordCanvas?.…` ở 11 file, tất cả đều im lặng không làm gì. Hậu quả:
   - chip hợp âm luôn báo "0";
   - bấm chip không đổi được HD/TLH;
   - phím **C** không bật chế độ sửa hợp âm;
   - chế độ xem lời luôn dùng TLH;
   - "Lưu vào Setlist" không ghi nhận bộ hợp âm đang dùng;
   - **Yêu thích ⭐ và Gần đây không hoạt động.**
3. **Thanh công cụ tràn trên iPad ngang** (rộng 1.329px trong khung 890px). Nút **Biểu diễn**, **Bài trước/sau** và **menu ⋮** bị đẩy ra ngoài màn hình, không có dấu hiệu nào để cuộn tới.

### Đích đến "10/10"

> Một nhạc công cầm iPad, trong nhà thờ thiếu sáng, **mở đúng bài trong ≤3 giây, đọc rõ hợp âm từ cách 1 mét, đúng tông của buổi lễ, lật trang không cần tay, chuyển bài tiếp theo tức thì**, và không bao giờ phải chạm vào một menu nào trong lúc chơi.

Tiêu chí đo được cho từng hạng mục nằm ở **Mục 6**.

### Điểm khác biệt có thể vượt các app thế giới

Thánh ca có **3–5 khổ lời chồng dưới cùng một hàng nốt** (dữ liệu: 304 bài có 3 khổ, 275 bài có 4 khổ, 128 bài có 5 khổ trở lên). Benchmark cho thấy **chưa app lớn nào giải quyết tốt chuyện này**. Chuẩn MusicXML/MNX còn đang thảo luận. SheetApp có thể làm tốt nhất ở đây, bằng tính năng **"Chọn khổ"**: xem tất cả khổ, xem một khổ chữ lớn, hoặc trải các khổ nối tiếp nhau (Mục 4, L1-6).

---

## 1. NGƯỜI DÙNG & BỐI CẢNH

### 1.1 Kịch bản chuẩn: Chúa nhật 8:30 sáng

| Thời điểm | Ai | Làm gì trên trang Thư viện | Hiện tại |
|---|---|---|---|
| Thứ 5 | Ca trưởng | Lên chương trình 5 bài, chọn tông/tempo/khổ cho từng bài | Setlist có tông/BPM. **Chưa có chọn khổ, chưa có ghi chú chuyển đoạn** |
| Thứ 7 | Nhạc công | Mở chương trình, tập, tải về máy | Có gói offline, nhưng đường vào bị giấu |
| 8:15 | Cả band | Mở iPad, vào "Chương trình hôm nay" | **Không có lối tắt**; phải vào tab Setlists trong sidebar |
| 8:30–9:30 | Cả band | Đọc hợp âm, lật trang, qua bài kế tiếp theo ca trưởng | Hợp âm thiếu hoặc nhỏ; chế độ tối không tối; nút bài sau bị ẩn; mỗi lần đổi bài trắng màn hình 0.5–0.9 s; bàn đạp chế độ phím mũi tên **nhảy sang bài khác** thay vì lật trang |
| Bất ngờ | Ca trưởng | "Hát lại điệp khúc", "Khổ cuối chậm lại", "Lên tông" | Không có kênh báo hiệu trên trang chính |

### 1.2 Vai trò trong band

| Vai trò | Cần thấy | Không cần |
|---|---|---|
| Guitar | Hợp âm **to**, thế bấm theo capo, lời để dò | Khoá Fa, bè Alto/Tenor/Bass |
| Keyboard / Piano | Hợp âm + khuông (thường là cả SATB) | — |
| Bass | Nốt gốc, hợp âm đảo (C/E → E) | Lời chi tiết |
| Trống | Cấu trúc bài (Khổ–ĐK–Khổ), tempo, số ô nhịp | Nốt, hợp âm |
| Hát / ca đoàn | Lời + giai điệu, đúng khổ đang hát | Hợp âm |

### 1.3 Thiết bị (theo thứ tự ưu tiên)

1. **iPad ngang** (1180×820): chủ lực trên giá nhạc.
2. iPad dọc (820×1180).
3. Điện thoại (390×844): dự phòng, xem nhanh.
4. Laptop: soạn và chuẩn bị.

---

## 2. HIỆN TRẠNG CHI TIẾT

### 2.1 Kiểm kê tính năng

Mức độ hoàn thiện: 🟢 ổn · 🟡 một phần · 🔴 hỏng · ⚫ ẩn (có nhưng không tìm thấy đường vào).

| Nhóm | Tính năng | Mức | Vấn đề chính (file:dòng) |
|---|---|:-:|---|
| **Tìm bài** | Tìm theo tên (không dấu) | 🟡 | Kết quả trộn lẫn khớp lời, xếp hạng chưa tốt ("thanh tam" ra 50 kết quả) |
| | Tìm theo **số bài** | 🔴 | "123" hoặc "#123" ra 0 kết quả; Enter không mở bài |
| | Tìm theo lời | 🟡 | Có đoạn trích lời, nhưng `lyrics_text` bị **trộn các khổ theo từng âm tiết** ("1.Thành 2.Ngợi…"), nên tìm cả cụm từ hỏng. Nút 🎵 chỉ 20×20px. `_searchMode` không được dùng (`library-ui.js:330-338`) |
| | Lọc danh mục / mùa / chủ đề | ⚫ | 100% bài chung một danh mục; mùa/chủ đề **0% có dữ liệu** nên chọn gì cũng ra rỗng |
| | Nhảy nhanh 1-100… | 🟡 | Chip cao 18px, chữ 8.4px; gắn cả touchstart lẫn click nên có thể kích 2 lần |
| | Yêu thích / Gần đây | 🔴 | `HistoryManager` không được export (`history-manager.js`) |
| | Danh sách 903 bài | 🟡 | Render đủ 903 dòng (7.224 node DOM); dòng dày 51px; tải danh sách **2 lần** lúc khởi động (270KB, gồm cả `lyrics_text`) |
| **Mở & hiển thị** | Deeplink `?song=&set=&t=` | 🟡 | `t` chỉ có tác dụng khi phát từ setlist; `?set=default` bị bỏ qua |
| | Render OSMD | 🟢 | Lõi ổn. Nhưng render **3 lần** khi tải lần đầu, **2 lần** mỗi lần đổi bài |
| | Zoom / tự vừa khung / khoá zoom / pinch | 🟡 | Nút −/+ trên thanh công cụ **bị disabled** sau khi tải; tự vừa khung gây render thêm 1 lần |
| | Chế độ gọn (ẩn khoá Fa, bè, lời, số ô nhịp…) | 🟡 | Viết lại XML mỗi lần reload; ẩn nhãn lặp bằng `setTimeout` 400ms |
| | Chế độ tối | 🔴 | Đảo màu 2 lần triệt tiêu nhau; bản nhạc vẫn sáng; hợp âm màu hồng nhạt |
| **Hợp âm** | Bộ HD / TLH / cá nhân | 🔴 | 3 lỗi nêu ở Mục 0; chip "HD · ○ 0" trái ngược với "● 5 hợp âm" |
| | Vị trí hợp âm (overlay) | 🟡 | Khoảng cách cố định 22px, cỡ chữ kẹp 13–22px, **không co giãn theo zoom**; không tránh va chạm; bộ chọn `g.vf-chordsymbol` không còn tồn tại trong OSMD 1.8.6; ẩn hợp âm **theo màu** nên nếu người dùng đổi màu hợp âm thành đen thì lời và tiêu đề biến mất |
| | Sửa hợp âm | 🟡 | Phím C hỏng; nút xoá bộ gọi hàm không tồn tại `confirmDeleteSet` (`toolbar.php:89`) |
| **Tông** | Dịch giọng ±12 | 🟢 / 🟡 | Đúng, nhưng mỗi bước reparse toàn bộ XML (~0.9–1.5 s); hợp âm hiện trễ 350ms sau nốt |
| | Capo | 🔴 | Chọn capo = dịch cả bài lên N bán cung (**sai ý nghĩa**); gợi ý capo tốt nhất tính ra rồi bị ẩn (`display:none`) |
| | Tên tông (enharmonic) | 🟡 | 4 chỗ dùng 4 cách khác nhau: G+1 hiện **G#** ở badge nhưng **Ab** ở thanh thông tin |
| **Thanh thông tin** | Tông / Tập / BPM / nhịp / số ô nhịp / chip hợp âm | 🟡 | "Tone:" lẫn tiếng Anh; BPM 104 là **giá trị mặc định giả** (901/903 file); chip "Dùng 1 lần" **nhân đôi** mỗi lần render; gọi `song_usage` 3 lần |
| **Nhịp** | Metronome / count-in / TAP | 🟢 | Đầy đủ, nhưng là thẻ nổi 273×424 đè lên nhạc; icon ⚡ trùng với chế độ biểu diễn; nhịp 6/8 tính thành 6 phách đen |
| **Phát nhạc** | SATB / mixer | 🟡 | Giấu trong menu ⋮ |
| **Lật trang** | Tự cuộn | 🟡 | **Tốc độ mặc định 2×**; bỏ qua BPM của setlist; tooltip ghi "Space" nhưng Space lại lật trang |
| | Trang / chạm cạnh | 🟡 | "Trang" = 0.92 chiều cao màn hình, không theo hàng nhạc nên có thể cắt đôi một hàng; `PageNav` không được export |
| | Bàn đạp / MIDI | 🔴 | **Mũi tên lên/xuống = ĐỔI BÀI**, nên bàn đạp ở chế độ mũi tên sẽ nhảy bài giữa lễ; 2 hệ MIDI song song |
| **Biểu diễn** | Gig mode | 🟡 | HUD nổi, chạm cạnh; nút fullscreen có 2 handler (toast đôi, 2 wake lock); nút "Thoát" bị cắt trên iPhone |
| **Setlist** | Phát / bài trước-sau / tông / BPM / profile | 🟡 | Nút bài trước/sau bị ẩn do tràn; không tải trước bài kế; không có "bài tiếp theo"; `leader_notes`, `item_type` có trong schema nhưng không hiển thị; DB có **0 setlist thật** |
| | Theo ca trưởng (live sync) | ⚫ | Chỉ vào được qua `?room=`, nút bị ẩn |
| **Xem chữ** | Lời + hợp âm chữ | ⚫ / 🟡 | **Nền rất tốt** (mỗi khổ một khối, hợp âm trên lời), nhưng giấu trong ⋮, hợp âm cỡ ~8px, luôn dùng TLH, ĐK bị gộp vào khổ 1 |
| **Khác** | Ghi chú dán / nhật ký biểu diễn / in / PWA / phím tắt | 🟡 / ⚫ | Ghi chú chỉ vào được qua FAB; in luôn dùng `set=HD`; "?" không mở trợ giúp |
| | Modal chào mừng | 🔴 | Hiện lại ở **mỗi tab mới** (lưu bằng `sessionStorage`), chặn màn hình khi mở link trên sân khấu |
| | Link sang trang khác | 🔴 | `/manager/`, `/learn/`, `/editor/` dùng đường dẫn gốc nên hỏng dưới `/sheetapp2/` |
| | Vai trò `leader` | 🔴 | Frontend chỉ nhận `admin`/`banhat`, nên leader bị coi như khách (`auth.js:443`) |

### 2.2 Dữ liệu thật: app hiển thị được gì?

| Dữ liệu | Thực tế | Hệ quả |
|---|---|---|
| Bài hát | 903; tên / số / tông / lời có đủ 100% | Tốt |
| Tông | F 166 · G 145 · Eb 122 · Ab 121 · C 107 · Bb 105 · D 70 | **55% bài ở tông giáng**, nên enharmonic phải đúng |
| Hợp âm TLH (trong XML) | **100% file có** (trung vị 22, tối đa 127) | **Tài sản chính**, hiện đang bị giấu |
| Hợp âm HD | Chỉ **38/903** có nội dung (trung vị 21) | HD chưa thể là nguồn mặc định cho mọi bài |
| Khổ lời | 3 khổ: 304 · 4 khổ: 275 · 5+ khổ: 128 | Cần tính năng "Chọn khổ" |
| Bè | 899 bài = 2 khuông (S/A khoá Sol, T/B khoá Fa) | Chế độ gọn "ẩn khoá Fa" rất có giá trị cho guitar |
| Tempo | 901/903 = 104 bpm (**mặc định của công cụ chuyển đổi**) | Không được hiển thị như tempo thật |
| Nhịp | 4/4: 475 · 3/4: 195 · 6/8: 95 · 6/4: 44 · đổi nhịp: 23 | Metronome phải xử lý 6/8 đúng |
| Cấu trúc | repeat 41 · volta 33 · segno 18 · coda 9 · rehearsal mark **0** | Bản đồ bài (Khổ–ĐK) phải **soạn tay**, không tự suy ra được từ XML |
| Mùa lễ / chủ đề / tác giả | **0%** | Ẩn bộ lọc cho tới khi có dữ liệu |
| Setlist | **0** setlist thật | Luồng chương trình lễ chưa từng được dùng thật |
| Lỗi chính tả | Ví dụ "NGUYỀN" (bài 002) | Cần một lượt rà dữ liệu |

### 2.3 Hiệu năng đo được (Apache local, chưa bóp băng thông)

| Chỉ số | Hiện tại | Mục tiêu 10/10 |
|---|---|---|
| Request / dung lượng khi vào lần đầu | 86 request · 2.97 MB · 61 file script | ≤25 request · ≤1.5 MB (OSMD + app) |
| Hiện bản nhạc đầu tiên | 1.3–1.5 s | ≤1.0 s (lần đầu) · ≤0.3 s (từ cache) |
| Số lần render khi tải | 3 | **1** |
| Đổi bài (click) | 0.9 s, 2 lần render, 9 request | ≤0.3 s (bài kế trong setlist đã tải trước: **tức thì**) |
| Dịch giọng 1 bước | 0.9–1.5 s | ≤0.3 s |
| Long task khi tải | 8–9 task, tổng ~1 s, dài nhất 220–640 ms | Không task nào >100 ms sau khi đã hiện nhạc |
| Node DOM | ~9.960 (7.224 thuộc danh sách) | ≤3.000 (danh sách ảo hoá) |
| Bộ nhớ sau 20 lần đổi bài | 12.5 → 15 MB rồi ổn định | Giữ nguyên (không rò rỉ) |

---

## 3. TẦM NHÌN THIẾT KẾ

### 3.1 Bảy nguyên tắc

1. **Nhạc là nhân vật chính.** Khi đang xem bài, ≥85% màn hình là nhạc; ở chế độ Sân khấu là ≥95%.
2. **Hợp âm là thứ band đọc đầu tiên.** Chữ hợp âm luôn ≥1.3 lần cỡ lời, co giãn theo zoom, tương phản cao.
3. **Không bao giờ để bài trống hợp âm khi dữ liệu có hợp âm.** HD → TLH → báo rõ "chưa có hợp âm".
4. **Một hành động, một nút chính** (to ≥44px), cộng tối đa một phím tắt hoặc bàn đạp.
5. **Chương trình lễ là trung tâm của buổi lễ.** Mở app vào Chúa nhật thì thấy ngay "Chương trình hôm nay".
6. **Không có gì bất ngờ trong lúc chơi:** không toast đè nhạc, không modal, không nhảy bài do bàn đạp.
7. **Tối thật sự** trong nhà thờ: nền đen, chữ ngà, hợp âm màu hổ phách.

### 3.2 Ba trạng thái của trang

```text
┌──────────────┐   chọn bài   ┌──────────────┐   ⚡ hoặc bàn đạp   ┌──────────────┐
│  DUYỆT       │ ───────────▶ │  ĐỌC         │ ─────────────────▶ │  SÂN KHẤU    │
│ (Thư viện)   │ ◀─────────── │ (1 bài)      │ ◀───────────────── │ (toàn màn)   │
└──────────────┘  ≡ / vuốt    └──────────────┘   chạm 2 lần / Esc  └──────────────┘
  sidebar mở,                  sidebar đóng (overlay),               không thanh công cụ,
  tìm/lọc/chương trình         1 thanh công cụ 48px                  HUD tự mờ, lật trang,
                                                                      thanh "bài tiếp theo"
```

### 3.3 Khung bố cục đề xuất

**iPad ngang: trạng thái ĐỌC**
```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ ≡  001 HỠI THÁNH VƯƠNG…  [G→A ▾]  [HD ▾]  [Khổ: Tất cả ▾]  [Aa]  [▶ Band] [⚡]│ 48px
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│                         (bản nhạc hoặc chế độ Band)                          │
│                              ≥ 85% màn hình                                  │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│ Chương trình: 2/5 · Tiếp: "Ca Cảm Tạ" (F→G)                   [◀]  [▶]      │ 40px, chỉ hiện khi phát setlist
└──────────────────────────────────────────────────────────────────────────────┘
```

**iPad ngang: trạng thái SÂN KHẤU (nền tối)**
```text
┌──────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│   G           C       D7        G                                            │  hợp âm 28px hổ phách
│   Cúi xin Vua Thánh ngự lai,                                                 │  lời 22px ngà
│                                                                              │
│  ◀ vùng chạm                                              vùng chạm ▶        │
│                                                                              │
│ ▔▔▔▔▔▔▔ (HUD tự mờ sau 3 s; chạm giữa màn hình để hiện lại) ▔▔▔▔▔▔▔▔▔▔▔▔▔▔ │
│  Khổ 2/4 · ♩72 · 2/5 → Ca Cảm Tạ          ●●○○ nhịp        [Thoát]         │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Điện thoại: trạng thái ĐỌC**
```text
┌───────────────────────────┐
│ ≡ 001 Hỡi Thánh…  G  ⋮    │ 44px
├───────────────────────────┤
│ (mặc định: chế độ Band    │
│  lời + hợp âm chữ lớn;    │
│  bản nhạc 1 chạm)         │
├───────────────────────────┤
│ [−] [G] [+]  [HD]  [▶⚡]   │ 52px thanh dưới, vừa ngón cái
└───────────────────────────┘
```

---

## 4. LỘ TRÌNH TRIỂN KHAI

Tổng thời gian khoảng **8–9 tuần** làm việc thật. Các giai đoạn nối tiếp nhau; L5 (nền kỹ thuật) và L6 (dữ liệu) chạy song song với các giai đoạn khác.

| Giai đoạn | Tên | Thời lượng | Điểm dự kiến sau khi xong |
|---|---|:-:|:-:|
| **L0** | Sửa cho đúng | 1 tuần | 6.5 |
| **L1** | Đọc tuyệt vời trên sân khấu | 2 tuần | 8 |
| **L2** | Tìm và mở bài trong 3 giây | 1 tuần | 8.5 |
| **L3** | Chế độ Chương trình lễ | 2 tuần | 9.3 |
| **L4** | Theo vai trò nhạc cụ | 1.5 tuần | 9.7 |
| **L5** | Hiệu năng & nền kỹ thuật (song song) | xuyên suốt | — |
| **L6** | Chất lượng dữ liệu (song song, cần người) | xuyên suốt | — |
| **L7** | Nghiệm thu buổi lễ thật | 1 tuần | **10** |

Mỗi ticket bên dưới ghi: **ID · việc cần làm · nghiệm thu**. Ticket nào có UI thì bắt buộc có E2E Playwright chạy được trên cả Chromium và WebKit.

---

### L0 — SỬA CHO ĐÚNG (tuần 1) — mục tiêu 6.5/10

| ID | Việc | Nghiệm thu |
|---|---|---|
| **L0-1** | Gắn `window.ChordCanvas`, `window.HistoryManager`, `window.PageNav` (và `AdminUI`). **Cẩn thận:** khi `ChordCanvas` bắt đầu chạy thật, `song-loader.js:34 resetSet()` sẽ gọi `switchSet('default')`, ghi `set=default` vào URL và reload XML của bài trước. Phải bỏ hoặc chặn đoạn này | E2E: chip hợp âm hiện đúng số hợp âm; phím C bật chế độ sửa (khi đăng nhập); bấm ⭐ thì bài xuất hiện trong tab Yêu thích sau reload; "Gần đây" có bài vừa mở. Test chặn tái phát: mọi module IIFE có dòng `window.X = X` |
| **L0-2** | **Dự phòng HD rỗng → TLH (Core Rule 1).** Bộ HD có 0 hợp âm thì không chèn CSS ẩn và hiện TLH, kèm nhãn "HD chưa có · đang hiện TLH". Quyết định L-D1 cho trường hợp HD "thưa" | E2E: bài 002 hiện ≥20 hợp âm; bài 001 (HD có 5 hợp âm) hiện theo quyết định L-D1; không còn bài nào mà XML có hợp âm nhưng màn hình hiện 0 (script quét 20 bài ngẫu nhiên) |
| **L0-3** | Ẩn hợp âm SVG bằng **class hoặc data attribute** gắn lúc render, không ẩn theo màu | Test: đổi màu hợp âm thành `#000000` thì lời và tiêu đề vẫn hiện |
| **L0-4** | **Thanh công cụ không tràn:** dưới 1.300px, thu các nút phụ vào ⋮; luôn hiện các nút: tên bài, tông, bộ hợp âm, Band/Nhạc, ⚡, ⋮ | E2E ở 1180×820, 820×1180, 390×844: `toolbar.scrollWidth ≤ clientWidth`; ⚡, ◀ ▶ (khi phát setlist) và ⋮ nằm trong khung nhìn |
| **L0-5** | **Chế độ tối thật:** bỏ đảo màu 2 lần; tô màu SVG bằng CSS variables (nốt, khuông, lời màu ngà `#E8E2D0` trên nền `#0B0B0C`, hợp âm hổ phách `#FBBF24`) | Ảnh chụp E2E ở chế độ tối: pixel nền của vùng nhạc có độ sáng <10%; tương phản hợp âm ≥8:1 |
| **L0-6** | Nút zoom −/+ không còn bị disabled; chip "Dùng N lần" không nhân đôi; menu ⋮ đóng sau khi chọn mục, khi chạm ra ngoài hoặc bấm Esc | 3 E2E nhỏ tương ứng |
| **L0-7** | **Tìm theo số bài:** chuỗi toàn chữ số (hoặc `#123`) thì lọc đúng bài 123 lên đầu; Enter mở kết quả đầu tiên | E2E: gõ "123" + Enter → mở `thanh-ca-123` |
| **L0-8** | **Bàn đạp an toàn:** ở chế độ Đọc và Sân khấu, ↑/↓ và PageUp/PageDown = **lật trang**; đổi bài chỉ bằng nút, Shift+↑/↓ hoặc bàn đạp được cấu hình riêng. Tốc độ tự cuộn mặc định **1×** | E2E: bấm ↓ 3 lần, bài không đổi, trang cuộn xuống |
| **L0-9** | Bỏ **modal chào mừng** mỗi phiên: mặc định vào như khách; đăng nhập chỉ từ nút trên thanh App Shell (quyết định L-D4) | E2E: mở tab mới với `?song=` → thấy nhạc ngay, không có modal |
| **L0-10** | Toast "Đang xem dưới quyền Khách" hiện 1 lần rồi không hiện lại; FAB không đè lên nhạc (thu vào ⋮ hoặc chỉ hiện khi đăng nhập) | Ảnh chụp: không phần tử nổi nào che vùng nhạc |
| **L0-11** | Tên tông thống nhất: một hàm duy nhất `KeyService.displayKey(fifths, semis)` dùng cho badge, thanh thông tin, chế độ xem chữ và HUD; theo quy tắc tông giáng/thăng | Unit test JS: G+1 = Ab, F+1 = Gb (hoặc F#, theo bảng quy tắc), Eb−1 = D; E2E: 4 chỗ hiện giống nhau |
| **L0-12** | **Capo đúng nghĩa:** capo N thì hợp âm hiển thị = thế bấm (dịch **xuống** N), nhạc thật giữ nguyên tông, kèm badge "Capo 3 · nghe ra B♭". Gợi ý capo tốt nhất phải hiện ra (không ẩn) | Unit test: bài Eb + capo 3 → thế bấm C; E2E: badge hiện đúng |
| **L0-13** | Chữ tiếng Việt có dấu ở toàn bộ sidebar ("Kho Nhạc", "Tìm bài hát…", "Tạo Setlist Mới"…); "Tone" → "Tông" | Grep chặn tái phát danh sách chuỗi không dấu |
| **L0-14** | Link sang các trang khác dùng `__APP_BASE__`; sửa hoặc bỏ `confirmDeleteSet`; frontend nhận role `leader` | E2E: không link nào trả 404 dưới `/sheetapp2/` |
| **L0-15** | BPM: coi 104 là "chưa có tempo" (chip hiện "♩ —", bấm để đặt); thống nhất tempo mặc định cho metronome và thanh thông tin (L-D6) | E2E: bài không có tempo thật hiện "♩ —" |
| **L0-16** | Gỡ handler trùng: nút fullscreen, nút sửa hợp âm, 4 bộ xử lý Escape (ModeManager làm chủ duy nhất) | E2E: bật/tắt ⚡ chỉ ra 1 toast; Esc đóng đúng lớp trên cùng |

---

### L1 — ĐỌC TUYỆT VỜI TRÊN SÂN KHẤU (tuần 2–3) — mục tiêu 8/10

| ID | Việc | Nghiệm thu |
|---|---|---|
| **L1-1** | **Hợp âm co giãn theo zoom và chống va chạm:** cỡ chữ = hệ số × cỡ lời (mặc định 1.35); khoảng cách tới khuông theo tỉ lệ zoom; dàn ngang tránh chồng chữ (ví dụ `Cmaj7/G`); tính vị trí một lần rồi cache (không gọi `getBoundingClientRect` cho từng nốt mỗi lần cuộn) | E2E đo: ở zoom 70%, 100%, 150%, tỉ lệ chiều cao chữ hợp âm / chữ lời ≥1.3; không có 2 hộp hợp âm nào giao nhau (script kiểm tra) |
| **L1-2** | **3 preset hiển thị hợp âm** (nút `Aa`): *Chuẩn*, *Sân khấu lớn* (1.6×, đậm), *Tương phản cao* (nền pill tối, chữ hổ phách); lưu theo thiết bị | E2E đổi preset → cỡ và màu đúng, còn nguyên sau reload |
| **L1-3** | **Một thanh công cụ 48px:** gộp thanh thông tin vào thanh công cụ (tông, BPM, nhịp đưa vào một popover "ⓘ"); sidebar trên iPad ngang **đóng mặc định khi đang xem bài** (dạng overlay, vuốt từ trái để mở) | Ảnh chụp iPad ngang: vùng nhạc ≥85% diện tích màn hình |
| **L1-4** | **Nút cảm ứng ≥44×44px** cho mọi điều khiển chính (tông, capo, zoom, bộ hợp âm, khổ, ⚡, ◀ ▶, chip nhảy nhanh, ⭐) | Script E2E: 0 phần tử tương tác nhìn thấy được mà có cạnh <44px ở 3 kích thước màn hình (trừ các phần tử được đánh dấu cho phép) |
| **L1-5** | **Chế độ Sân khấu thật:** mặc định nền tối; không thanh công cụ; HUD tự mờ sau 3 s, chạm giữa màn hình để hiện lại; khoá chạm ngoài vùng lật trang; Wake Lock + Fullscreen API; vùng an toàn trên iPhone; nút Thoát không bị cắt | E2E: sau 3 s, HUD có opacity 0; chạm cạnh phải thì lật trang; iPhone 390px không có nút nào nằm ngoài khung |
| **L1-6** ⭐ | **Chọn khổ** (điểm khác biệt số 1): lọc `<lyric number>` trong XML **trước khi** render; 3 chế độ: *Tất cả khổ* (như sách), *Một khổ* (chữ lớn, số khổ nổi bật, nút Khổ ◀ ▶ hoặc bàn đạp để chuyển), *Trải khổ* (bài lặp lại lần lượt Khổ 1 → 2 → 3 để cuộn một chiều) | E2E: bài 002 (5 khổ) ở chế độ Một khổ chỉ hiện 1 dòng lời mỗi hàng nhạc; chuyển sang khổ 3 thì lời đổi; chế độ Trải khổ có số hàng nhạc ≈ 5 lần |
| **L1-7** ⭐ | **Chế độ BAND (lời + hợp âm chữ lớn)** nâng cấp từ "Xem Lời & Hợp Âm Chữ" có sẵn, và đưa **ra thanh công cụ** (nút `▶ Band`): hợp âm 24–32px trên lời 20–24px; **dùng bộ hợp âm đang chọn** (HD → TLH); đúng tông và capo; tách **ĐK / Điệp khúc** thành khối riêng; iPad ngang hiện 2 cột; khổ đang hát được tô sáng (khi có setlist hoặc leader sync); **mặc định trên điện thoại** (L-D2) | E2E: chế độ Band dùng đúng bộ đang chọn (so với thanh công cụ); dịch +2 thì hợp âm đổi đúng; ảnh chụp iPad ngang có 2 cột; cỡ chữ hợp âm ≥24px |
| **L1-8** | **Điện thoại:** tự vừa bề ngang với ≥2 ô nhịp mỗi hàng; mặc định ẩn tên tác giả và chú thích; thanh điều khiển ở cạnh dưới cho ngón cái | Ảnh chụp 390px: không chữ nào đè nhau; ≥2 ô nhịp mỗi hàng |
| **L1-9** | **Lật nửa trang** (half-page turn, học từ forScore): nửa trên hiện trước phần tiếp theo, có vạch chia rõ; lật theo hàng nhạc (không cắt đôi một hàng) | E2E: sau khi lật, không hàng nhạc nào bị cắt ở mép trên (so với hộp của từng hàng) |
| **L1-10** | **Metronome dạng mini-bar** gắn ở cạnh dưới (đèn nhịp, BPM, count-in), không còn thẻ nổi đè nhạc; icon ♩ riêng; nhịp 6/8 = 2 phách chấm (có tuỳ chọn 6) | E2E: bật metronome, vùng nhạc không bị che; 6/8 nhấn đúng phách 1 và 4 |
| **L1-11** | Chữ phụ đạt tương phản ≥4.5:1 và ≥11px; viền focus 2px rõ ràng; thứ tự Tab hợp lý (thanh công cụ trước sidebar) | Chạy axe-core trong E2E: 0 vi phạm mức serious/critical ở trang Đọc |

---

### L2 — TÌM VÀ MỞ BÀI TRONG 3 GIÂY (tuần 4) — mục tiêu 8.5/10

| ID | Việc | Nghiệm thu |
|---|---|---|
| **L2-1** | **Xếp hạng tìm kiếm:** số bài khớp chính xác > tên khớp đầu chuỗi > tên chứa từ > lời. Hiện "Kết quả theo tên" và "Kết quả theo lời" thành 2 nhóm | Test HTTP: "thanh tam" → bài có tên "Thành Tâm Tôn Vua Thánh" đứng đầu |
| **L2-2** | **Dòng danh sách gọn** (36px: số · tên · tông); **ảo hoá danh sách** (chỉ render các dòng đang nhìn thấy); tên dài thì xuống dòng thay vì cắt ở ~25 ký tự | DOM của danh sách ≤400 node; cuộn đạt 60fps; 1180×820 hiện ≥16 bài |
| **L2-3** | **Gom bộ lọc vào nút "Lọc"**; tự ẩn bộ lọc không có dữ liệu (danh mục chỉ có 1 lựa chọn, mùa/chủ đề rỗng) | E2E: không hiện bộ lọc nào mà chọn vào ra 0 kết quả |
| **L2-4** | **Đầu danh sách:** "📅 Chương trình hôm nay / sắp tới" (nếu có), "Gần đây" (5 bài), "Yêu thích" | E2E: có setlist ngày gần nhất thì khối này hiện đầu tiên |
| **L2-5** | **Bàn phím số nhanh** (tuỳ chọn): nút "#" mở bàn phím số lớn, gõ 1-2-3 thì mở bài | E2E trên iPad |
| **L2-6** | Tìm theo lời chính xác theo từng khổ (phụ thuộc L6-1), đoạn trích là câu liền mạch có `<mark>` | Test: "cúi xin vua thánh" → bài 001, đoạn trích đúng câu |
| **L2-7** | Danh sách gọn chỉ trả trường cần thiết (không kèm `lyrics_text`); tải **một lần** dùng chung cho LibraryUI và SetlistUI; cache bằng ETag | Tải lần đầu: 1 request danh sách, ≤60KB (gzip) |

---

### L3 — CHẾ ĐỘ CHƯƠNG TRÌNH LỄ (tuần 5–6) — mục tiêu 9.3/10

| ID | Việc | Nghiệm thu |
|---|---|---|
| **L3-1** | **Thanh chương trình** (40px, cạnh dưới) khi phát setlist: "2/5 · Tiếp: Ca Cảm Tạ (F→G)" + ◀ ▶ lớn; ở chế độ Sân khấu thu thành dòng nhỏ trong HUD | E2E với setlist 5 bài |
| **L3-2** | **Tải trước bài kế tiếp** (XML đã parse + bộ hợp âm) để chuyển bài **tức thì**; không trắng màn hình | Đo: chuyển sang bài kế ≤150 ms tới khi có SVG |
| **L3-3** | Mỗi mục trong setlist lưu: tông, BPM, bộ hợp âm, **khổ sẽ hát** (ví dụ "1, 3, 4"), **ghi chú ca trưởng** (`leader_notes` đã có trong schema); hiện ghi chú ở đầu bài dạng dải vàng có thể thu gọn | E2E: mục có khổ "1,3" thì chế độ Một khổ chỉ chạy qua khổ 1 và 3 |
| **L3-4** | Mục không phải bài hát (Cầu nguyện, Kinh Thánh, Thông báo) hiện thành thẻ chờ, kèm tổng thời lượng dự kiến | E2E |
| **L3-5** | **Theo ca trưởng ngay trên trang chính:** nút "📡 Theo ca trưởng" (nhập mã hoặc quét QR); hiện "Đang theo: [tên]" + nút tạm ngưng theo / theo lại; đồng bộ bài, tông, khổ, vị trí | E2E 2 trình duyệt: host đổi bài/khổ → follower đổi theo trong ≤1 s |
| **L3-6** | **Thông điệp ca trưởng** (học từ OnSong Messages): banner màu trên máy mọi người, ví dụ "Lặp ĐK", "Khổ cuối chậm", "Lên tông", "Kết"; tự tắt sau 5 s; không che hợp âm | E2E: gửi cue → banner hiện rồi tự tắt; không lặp lại khi có revision mới |
| **L3-7** | **Bản đồ bài và nhảy đoạn:** dải "Dạo · K1 · ĐK · K2 · ĐK · Kết" ở đầu bài; chạm (hoặc bàn đạp) để nhảy; dữ liệu từ `song_sections` (soạn tay trong Manager, ưu tiên 100 bài hay dùng) | E2E với bài 001 (có dữ liệu mẫu) |
| **L3-8** | Count-in và metronome **lấy BPM của mục setlist**; tự cuộn theo BPM × số ô nhịp (có nút tăng/giảm, luôn cho phép chỉnh tay) | E2E: mục BPM 72 → metronome 72 và tốc độ cuộn tính theo 72 |
| **L3-9** | **"Tải cho Chúa nhật":** một nút tải cả chương trình về máy, huy hiệu "✓ Sẵn sàng offline (5/5)"; kiểm tra lại khi mở app | E2E offline (Chromium) + thử tay trên iPad |
| **L3-10** | Hết bài cuối thì hiện "Kết thúc chương trình"; dọn trạng thái setlist, không để các nút ◀ ▶ bị chiếm | E2E |

---

### L4 — THEO VAI TRÒ NHẠC CỤ, "STAGE LENS" (tuần 7) — mục tiêu 9.7/10

| ID | Việc | Nghiệm thu |
|---|---|---|
| **L4-1** | Lần đầu mở, chọn vai trò: **Guitar · Keyboard · Bass · Trống · Hát** (lưu theo thiết bị; đổi bằng 1 icon) | E2E đổi vai trò → giao diện đổi, còn nguyên sau reload |
| **L4-2** | **Guitar:** chế độ Band + capo **cá nhân** (không đổi tông của cả band) + hiển thị thế bấm; tuỳ chọn "Đơn giản hoá hợp âm" (bỏ 7/9/sus) | Unit test đơn giản hoá: Cmaj7 → C, D7sus4 → D |
| **L4-3** | **Keyboard:** bản nhạc đầy đủ + hợp âm | — |
| **L4-4** | **Bass:** nốt gốc chữ to, hợp âm đảo lấy nốt bass (C/E → E) | Unit test |
| **L4-5** | **Trống:** bản đồ bài + BPM + đếm ô nhịp + đèn nhịp; không nốt, không hợp âm | E2E |
| **L4-6** | **Hát:** chế độ Một khổ, chỉ giai điệu (ẩn khoá Fa, bè), không hợp âm | E2E |
| **L4-7** | Tuỳ chọn hiển thị hợp âm dạng **số La Mã / Nashville** (I–IV–V) | Unit test theo tông |

---

### L5 — HIỆU NĂNG & NỀN KỸ THUẬT (song song, bắt đầu từ tuần 1)

| ID | Việc | Nghiệm thu |
|---|---|---|
| **L5-1** | **Render 1 lần mỗi bài:** tính zoom vừa khung **trước** lần render đầu (từ bề ngang khung và bề ngang trang trong XML); bỏ `updateGraphic()` thừa; ResizeObserver duy nhất làm chủ việc layout lại | Bộ đếm render trong E2E: tải = 1, đổi bài = 1, resize = 1 |
| **L5-2** | **Dịch giọng không reparse:** giữ đối tượng OSMD, đặt `Sheet.Transpose` rồi `render()`; hợp âm overlay cập nhật cùng khung hình (không trễ 350 ms) | Dịch 1 bước ≤300 ms |
| **L5-3** | **Parse XML 1 lần và cache** theo bài (thay cho 8 chỗ gọi DOMParser); tính vị trí hợp âm dùng dữ liệu hình học của OSMD, có cache | Profile: ≤2 lần gọi DOMParser mỗi lần đổi bài |
| **L5-4** | **Gộp request mỗi lần đổi bài:** `song_usage` 1 lần (lấy ra khỏi `_render`); `sessions` 1 lần dùng chung; danh sách bộ hợp âm cache; tổng ≤4 request | Đếm request trong E2E |
| **L5-5** | **[x] Tải theo nhu cầu:** admin console, importer, OMR, editor hooks, live sync, audio (Tone, osmd-audio-player) chỉ nạp khi dùng; không render OSMD khi khung đang ẩn (hết cảnh báo "width not > 0") | Vào lần đầu ≤30 script; console không còn cảnh báo SkyBottomLine — ✅ ĐÃ HOÀN THÀNH 100% |
| **L5-6** | **[x] Precache Service Worker tự sinh bằng PHP:** `tools/generate_sw_manifest.php` quét toàn bộ tài nguyên App Shell (CSS, JS, vendor, 903 bài API) theo `filemtime` & hash, tự sinh manifest & nạp vào `sw.js`; tích hợp auto-sync; offline hoàn chỉnh | Offline: mở app lần đầu sau khi đã vào 1 lần → chạy được hoàn toàn (E2E Chromium & WebKit 100% PASS) — ✅ ĐÃ HOÀN THÀNH 100% |
| **L5-7** | **[x] State tập trung (Store):** song / set / transpose / zoom / mode / verse nằm trong Store; URL, thanh công cụ, HUD, chế độ Band là 4 bên đăng ký nghe; hỗ trợ alias 2 chiều và subscribe | Test: đổi `Store.set('transpose', 2)` thì cả 4 chỗ hiển thị cập nhật (E2E Chromium & WebKit PASS) — ✅ ĐÃ HOÀN THÀNH 100% |
| **L5-8** | **[x] Dọn CSS của trang chính:** thang z-index bằng biến (`--z-*`), giảm `!important` (từ 388 xuống 109, giảm 72% ≥ 70%), bỏ 24 phần tử giả "legacy ID" và làm sạch inline styles trong includes | Metrics: `!important` giảm 72% ≥ 70%; 0 phần tử giả; 16/16 test PASS — ✅ ĐÃ HOÀN THÀNH 100% |
| **L5-9** | **[x] Ngân sách hiệu năng trong CI:** Playwright đo thời gian hiện bản nhạc (935ms ≤ 4.5s), số lần render (=== 1), số request (4 ≤ 4), dịch tông (82ms ≤ 300ms) và script ban đầu (30 ≤ 30); cơ chế fail nếu vượt ngưỡng | Chạy E2E xanh 100% (Chromium & WebKit PASS) — ✅ ĐÃ HOÀN THÀNH 100% |

---

### L6 — CHẤT LƯỢNG DỮ LIỆU (song song; cần người duyệt)

| ID | Việc | Ai | Nghiệm thu |
|---|---|---|---|
| **L6-1** | **[x] Trích lời theo khổ đúng chuẩn:** tách theo `<lyric number>`, ghép âm tiết theo `<syllabic>`; tách ĐK riêng biệt `[ĐK]`; tự động chọn part bè chính (074, 614); tạo lại `lyrics_text` và index FTS5 (đã chạy kiểm thử trên bản sao trước) | Dev | 10 bài mẫu: lời từng khổ là câu liền mạch; tìm kiếm FTS5 và snippet `[ĐK]` chính xác; E2E & 20/20 test hồi quy PASS — ✅ ĐÃ HOÀN THÀNH 100% |
| **L6-2** | **[x] Xoá tempo giả 104 (đặt NULL); công cụ để ca trưởng nhập tempo thật cho 100 bài hay dùng (có TAP):** migration 015 thêm cột `tempo`, xóa bỏ toàn bộ 104; công cụ `tools/manage_tempos.php` quản lý tempo & seed tempo chuẩn cho 100 bài hay dùng; nâng cấp song-info-bar và TempoPickerSheet hỗ trợ TAP tempo và lưu tempo tức thì cho ca trưởng | Dev + ca trưởng | 100 bài có tempo thật; 0 bài mang tempo 104; E2E Chromium & 23/23 test hồi quy PASS — ✅ ĐÃ HOÀN THÀNH 100% |
| **L6-3** | **Gắn nhãn mùa lễ / chủ đề hàng loạt** trong Manager (chọn nhiều bài → gắn nhãn) | Dev + người biên tập | ≥300 bài có nhãn; bộ lọc hiện lại |
| **L6-4** | Chiến lược HD: (a) giữ TLH làm mặc định và HD bổ sung dần qua luồng duyệt, hoặc (b) nhân bản TLH thành HD cho 865 bài rồi chỉnh dần (L-D1) | Chủ dự án quyết | Không bài nào thiếu hợp âm |
| **L6-5** | Rà chính tả tên bài (ví dụ "NGUYỀN" → "NGUYỆN"); script liệt kê từ nghi sai | Dev + người duyệt | Danh sách sửa được duyệt |
| **L6-6** | Soạn **bản đồ bài** (song_sections) cho 50–100 bài hay dùng nhất | Ca trưởng | Có dữ liệu cho L3-7 |

---

### L7 — NGHIỆM THU BẰNG BUỔI LỄ THẬT (tuần 9)

1. **Buổi tập giả lập:** 1 ca trưởng + 4 nhạc công (guitar, keyboard, bass, trống), iPad thật, chương trình 5 bài, có 1 bài đổi tông, 1 bài chỉ hát khổ 1 và 3, 1 thông điệp "Lặp ĐK".
2. **Chúa nhật thật (pilot):** dùng song song với giấy trong 2 tuần.
3. Sau mỗi buổi, mỗi người chấm theo **thang 10 điểm của Mục 6** và ghi lại 3 điều khó chịu nhất. Làm vòng sửa ngắn rồi chấm lại.
4. **Đạt 10/10** khi: trung bình ≥9.5, không ai phải chạm vào menu trong lúc chơi, 0 lần mất hợp âm, 0 lần lật trang hoặc chuyển bài sai.

---

## 5. KIẾN TRÚC ĐÍCH CỦA TRANG (tóm tắt cho dev)

```text
URL (?song,set,t,verse,mode,room) ⇄ Store (song, set, transpose, capo, verse, zoom, mode, role, setlist)
                                        │ subscribe
        ┌───────────────┬───────────────┼───────────────┬────────────────┐
   Toolbar 48px     SheetView (OSMD)  BandView (chữ)  StageHUD        SetlistRail
                        │                  │
                 SongModel cache (XML parse 1 lần, verses[], chords{HD,TLH,personal}, sections)
                        │
                 ChordResolver (HD→TLH fallback · transpose · capo · enharmonic · simplify · roman)
```

- **ChordResolver** là nơi *duy nhất* quyết định hợp âm nào hiện ra: thực thi Core Rule 1, dịch giọng, capo và tên nốt. SheetView, BandView, bản in và ChordPro đều dùng chung.
- **SongModel** được tạo một lần mỗi bài và tái dùng cho render, chế độ Band, chọn khổ và thanh thông tin.
- **Không module nào gọi trực tiếp sang module khác qua `window.X?.y()`** mà không có test hành vi.

---

## 6. THANG ĐIỂM 10/10 ĐO ĐƯỢC (dùng cho nghiệm thu)

| Hạng mục | 10 điểm nghĩa là… | Cách đo |
|---|---|---|
| Bố cục | Trạng thái Đọc: vùng nhạc ≥85% (iPad ngang); Sân khấu ≥95%; không phần tử nổi nào che nhạc | Ảnh chụp + script đo hộp phần tử |
| Đọc trên sân khấu | Hợp âm ≥1.3× lời ở mọi mức zoom; chế độ tối có nền ≤10% độ sáng; tương phản hợp âm ≥7:1; không chữ nào đè nhau | E2E đo |
| Hợp âm | 0 bài mà XML có hợp âm nhưng màn hình trống; bản nhạc, chế độ Band và bản in cho cùng một chuỗi hợp âm | Script quét toàn bộ 903 bài (headless) |
| Tìm bài | Theo số: 1 lần gõ + Enter; theo tên: bài đúng nằm trong top 3; theo lời: đoạn trích đúng câu | Test HTTP + E2E |
| Chuyển bài | Bài kế trong setlist ≤150 ms; từ thư viện ≤300 ms (khi đã có cache) | E2E đo |
| Dịch giọng / capo | ≤300 ms; tên tông đúng quy tắc; capo hiển thị thế bấm | E2E + unit test |
| Lật trang | Không cắt đôi hàng nhạc; bàn đạp không bao giờ đổi bài ngoài ý muốn | E2E |
| Nút bấm | 0 nút chính nhỏ hơn 44px | Script E2E |
| Truy cập | axe-core: 0 vi phạm serious/critical | E2E |
| Hiệu năng | Vào lần đầu ≤1.0 s tới khi có nhạc; 1 lần render mỗi bài; ≤4 request mỗi lần đổi bài; không long task >100 ms sau khi đã hiện nhạc | Ngân sách hiệu năng trong CI |
| Offline | Toàn bộ chương trình mở được khi mất mạng sau khi bấm "Tải cho Chúa nhật" | E2E + thử tay trên iPad |
| Thực tế | Band chấm trung bình ≥9.5 sau 2 buổi lễ | Phiếu chấm L7 |

---

## 7. QUYẾT ĐỊNH CẦN CHỦ DỰ ÁN CHỐT

| ID | Câu hỏi | Đề xuất |
|---|---|---|
| **L-D1** | HD "thưa" (ví dụ bài 001: HD có 5 hợp âm, TLH đầy đủ): hiện gì? | **Hiện HD** (đúng Core Rule 1), nhưng khi HD có dưới 30% số hợp âm của TLH thì hiện chip "HD còn thiếu — xem TLH" để đổi bằng 1 chạm. Dài hạn: L6-4 |
| **L-D2** | Chế độ mặc định khi mở bài | iPad/laptop: **bản nhạc**; điện thoại: **chế độ Band** (lời + hợp âm chữ). Người dùng đổi được và thiết bị ghi nhớ |
| **L-D3** | Sidebar trên iPad ngang khi đang xem bài | **Đóng dạng overlay** (vuốt hoặc ≡ để mở) |
| **L-D4** | Bỏ modal chào mừng / đăng nhập mỗi phiên | **Bỏ**; mặc định là khách, đăng nhập từ nút trên thanh App Shell |
| **L-D5** | Hai tài khoản `hoaidinh` và `banhat` vẫn dùng `123456` | Bạn đã chọn để mở cho mọi người. Lưu ý: `hoaidinh` **sửa được bộ HD mà cả band dùng**. Đề xuất nhẹ: đổi riêng mật khẩu `hoaidinh`, hoặc hạ quyền 2 tài khoản này xuống `viewer` và tạo tài khoản sửa riêng |
| **L-D6** | Tempo khi bài không có dữ liệu | Hiện "♩ —"; metronome mặc định 72 (nhịp thánh ca phổ biến) |
| **L-D7** | Cho phép thêm bước build (gộp/minify, Vite/esbuild)? | **Cho phép** (chỉ là devDependency, kết quả vẫn là file tĩnh), vì cần cho L5-6 offline chắc chắn. Nếu không: dùng phương án PHP |
| **L-D8** | Chế độ "Trải khổ" có hiện số khổ trên từng hàng nhạc không? | Có (ví dụ "K2" ở đầu mỗi hàng) |
| **L-D9** | Ai soạn bản đồ bài và gắn nhãn mùa lễ? | Ca trưởng + 1 người biên tập, trong Manager |

---

## 8. THỨ TỰ BẮT ĐẦU (cho người thực thi)

1. Đọc `ROADMAP3.md` Phần 0 (luật làm việc) — vẫn áp dụng.
2. **Trước L0, làm 2 ticket nền còn nợ từ ROADMAP3:**
   - **K2** (cách ly DB cho test/E2E, snapshot/restore): L0–L4 sẽ thêm rất nhiều E2E, không được ghi vào DB thật.
   - **K1** (lỗ hổng `Response::forbidden` không dừng).
   Các ticket khác của ROADMAP3 tạm hoãn, trừ khi chủ dự án yêu cầu.
3. Làm **L0-1 → L0-16** theo thứ tự. Sau mỗi 3 ticket, chạy full test PHP + E2E.
4. **Checkpoint L0:** chủ dự án mở `?song=thanh-ca-002` trên iPad thật, thấy hợp âm, bật chế độ tối, lật trang bằng chạm cạnh. Đạt thì sang L1.
5. L1 → L4 theo thứ tự; L5 và L6 chạy song song, mỗi tuần 1–2 ticket.
6. L7: buổi tập và buổi lễ thật.

**Mẫu báo cáo:** giống `ROADMAP3.md` Phần F, bổ sung dòng **"Ảnh chụp trước/sau"** cho mọi ticket có UI (iPad ngang + điện thoại).

---

## PHỤ LỤC A — 25 cải tiến UX xếp theo tác động / công sức

| # | Cải tiến | Tác động | Công sức | Ticket |
|---|---|:-:|:-:|---|
| 1 | Thanh công cụ không tràn | Cao | Thấp | L0-4 |
| 2 | Chế độ tối thật | Cao | Thấp | L0-5 |
| 3 | Hợp âm ≥1.3× lời | Cao | Thấp | L1-1 |
| 4 | Tìm theo số bài | Cao | Thấp | L0-7 |
| 5 | Sidebar overlay trên iPad | Cao | Thấp | L1-3 |
| 6 | HD → TLH, chip trung thực | Cao | Trung bình | L0-1, L0-2 |
| 7 | Nút ≥44px | Cao | Trung bình | L1-4 |
| 8 | Bỏ modal chào mừng | Cao | Thấp | L0-9 |
| 9 | Gộp thanh thông tin | Trung bình | Thấp | L1-3 |
| 10 | Sân khấu: HUD tự mờ | Cao | Thấp | L1-5 |
| 11 | Chế độ Band chữ lớn | Cao | Trung bình | L1-7 |
| 12 | Sửa chip nhân đôi | Trung bình | Thấp | L0-6 |
| 13 | Menu ⋮ tự đóng | Trung bình | Thấp | L0-6 |
| 14 | Nút zoom hoạt động | Trung bình | Thấp | L0-6 |
| 15 | Đặt tên / icon rõ (⚡ vs ♩, "Biểu diễn" trùng tên) | Trung bình | Thấp | L0-4, L1-10 |
| 16 | Tiếng Việt có dấu | Trung bình | Thấp | L0-13 |
| 17 | Danh sách gọn + nút Lọc | Trung bình | Trung bình | L2-2, L2-3 |
| 18 | Ẩn bộ lọc rỗng | Trung bình | Thấp | L2-3 |
| 19 | Thanh chương trình "Tiếp: …" | Cao | Trung bình | L3-1 |
| 20 | Viền focus + thứ tự Tab | Trung bình | Thấp | L1-11 |
| 21 | Tương phản chữ phụ | Trung bình | Thấp | L1-11 |
| 22 | Điện thoại ≥2 ô nhịp, ẩn tác giả | Trung bình | Trung bình | L1-8 |
| 23 | Hiệu năng: render 1 lần, tải theo nhu cầu | Trung bình | Trung bình | L5-1…L5-5 |
| 24 | Metronome mini-bar | Trung bình | Trung bình | L1-10 |
| 25 | Link đúng base path, "?" mở trợ giúp | Thấp | Thấp | L0-14 |

## PHỤ LỤC B — Học từ các app chuyên nghiệp (đã đưa vào lộ trình)

| Mẫu thiết kế | App | Ticket |
|---|---|---|
| Lật nửa trang | forScore, Music Stand | L1-9 |
| Flow / bản đồ bài + nhảy đoạn | OnSong, ChartBuilder | L3-7 |
| Thông điệp ca trưởng | OnSong Messages | L3-6 |
| Theo trang của ca trưởng (Session / Cue) | Music Stand, forScore, Newzik | L3-5 |
| Capo cá nhân không đổi tông cả band | ChartBuilder, BandHelper | L4-2 |
| Góc nhìn theo vai trò (lời / hợp âm / bản đồ) | WorshipTools, ChartBuilder | L4 |
| Số La Mã / Nashville | Music Stand, ChartBuilder | L4-7 |
| Chế độ Biểu diễn khoá chạm | MobileSheets | L1-5 |
| Tự cuộn theo tempo, có tạm dừng | MobileSheets | L3-8 |
| Tải chương trình về máy | Setlist Helper (Music Stand bị chê vì chỉ cache 10 plan) | L3-9 |
| Đơn giản hoá hợp âm | Ultimate Guitar | L4-2 |
| Không để cài đặt "tự nhảy" (ví dụ lỗi mở sai tông của OnSong) | Bài học từ phàn nàn của người dùng | Core Rule 2 + L5-7 |
