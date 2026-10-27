# ROADMAP MOBILE — Ổn định tải và màn đọc trên điện thoại, tablet (2026-10-27)

> **Người đọc:** chủ dự án (duyệt mục 7) và một AI thực thi (Codex).
> **Phạm vi:** Thư viện sheet ở cả hai giao diện: Modern `/` (`index.php`, `assets/`) và Classic `/old/` (`old/index.php`, `old/assets/`). **Hai giao diện luôn tồn tại song song**, không gỡ, không đóng băng cái nào.
> **Luật thực thi:** giữ nguyên `ROADMAP.md` mục 1 (bằng chứng FAIL → PASS, test không ghi DB/storage thật, ≤ 5 file mỗi ticket, không deploy, không `sync.*`, dừng và hỏi khi đổi quyền/Core Rule/xoá dữ liệu).
> **Quan hệ với `ROADMAP.md`:** file này ưu tiên trước Giai đoạn 2–3 của `ROADMAP.md`. Các ticket TV2/TV3/TV6 cũ trùng ý được ghi ở cột "Thay cho" / "Sửa".
> **Nguồn:** ba lượt rà chỉ đọc trên `main` @ `1604a1b`: luồng khởi động và tải bài trong mã; kiểm kê điều khiển bằng Playwright Chromium (isMobile, hasTouch) ở 390×844, 768×1024, 1024×768 với tài khoản khách. Lượt đo trên mạng chậm, lỗi ngẫu nhiên và WebKit (iPhone/iPad) **chưa có kết quả**, xem mục 1.4.

---

## 0. Tóm tắt cho chủ dự án

Người dùng chủ yếu mở bằng điện thoại và tablet. Trên mạng nhà thờ hoặc 4G yếu, hay gặp: trang trắng, chạm bài không mở, bài không hiện, mất tên bài. Mã cho thấy **ba nguyên nhân chính**, tất cả đều có ở cả hai giao diện:

1. **Khởi động dây chuyền, không cô lập lỗi.** `app.js` gọi khoảng 30 `init()` lần lượt, không `try/catch`. Việc gắn "chạm bài thì mở bài" đặt ở **cuối** (Modern `assets/js/app.js:69`, Classic `old/assets/js/app.js:44`). Chỉ cần một module bất kỳ lỗi là danh sách vẫn hiện nhưng chạm bài không có gì xảy ra.
2. **Không có timeout ở bất kỳ request nào** (API, XML, cả service worker). Mạng chập chờn thì màn "Đang tải…" treo tới khi iOS tự cắt (khoảng 60 giây trở lên), dù trong máy đã có bản cache dùng được.
3. **Lỗi bất kỳ khi mở bài sẽ xoá luôn màn bài.** `song-loader.js` chỉ ghi tên bài sau khi vẽ xong; khi lỗi thì gọi `AppUI.showWelcome()` (dòng 189), đặt lại tiêu đề "Chọn bài hát để bắt đầu", và chỉ có một toast 3 giây. Đây đúng là triệu chứng "không hiện bài, không hiện tên".

Cảm giác "tính năng loạn, cứ lỗi" đến từ hai việc:
- **Quá nhiều nút cho cùng một việc.** Modern có 4 cặp nút bài trước/sau, 3 bộ zoom, 4 nút đổi Bản nhạc/Lời, 5 nút soạn hợp âm. Menu ⋯ trên điện thoại có 29 mục, dài khoảng 1.320px trên màn 844px.
- **Hai bản mã tách đôi và lệch nhau.** Có 22 file JS, 5 file PHP và 4 file CSS bị sao chép giữa hai giao diện, rồi sửa riêng. Từ tháng 9, `assets/js` có 137 commit, còn `old/assets/js` chỉ có 19, nên lỗi sửa ở Modern vẫn còn ở Classic. Quy tắc nghiệp vụ cũng lệch: dịch giọng ±12 ở Modern nhưng ±8 ở Classic.

Hướng xử lý: **dùng chung phần lõi** (khởi động, tải dữ liệu, tải bài, vẽ bản nhạc, lưu trữ) trong `assets/js/core/` cho cả hai giao diện. **Mỗi giao diện giữ phần hiển thị riêng** (toolbar, CSS, bố cục). Màn đọc sắp lại theo 3 lớp: việc dùng khi đọc ở 1 chạm, việc phụ vào menu có nhóm, việc quản trị rời khỏi màn đọc.

---

## 1. Hiện trạng đo được

### 1.1 Tải trang lần đầu (kích thước file trên đĩa, chưa nén)

| | Modern | Classic |
|---|---|---|
| File JS | 87 file, ~2,19 MB (OSMD 1,14 MB, nạp đồng bộ, không có `?v`) | 48 file (22 riêng của `old/`, 26 dùng chung), ~1,66 MB |
| JS không `defer` | 22 file core (`index.php:189-210`) | chưa đếm |
| CSS | 8 file, ~304 KB, cộng Google Fonts chặn render; `library-polish.css` có 418 `!important` | 5 file, ~108 KB |
| API lúc khởi động | 3 (`auth.me`, `songs.list`, `setlists.list`) + `sw.js` | tương tự |
| API mỗi lần mở bài | 3–4 (XML, `sessions.load`, `chord_sets.load`, `songUsage`) | ít hơn một chút |
| Service worker | Có đăng ký | **Không** tự đăng ký, nhưng bị SW của Modern (scope `/`) điều khiển nếu máy từng mở Modern |

`SongLoaderCore.js` được nạp ở trang chính nhưng không dùng (chỉ learn/live-band dùng).

### 1.2 Điều khiển trên màn đọc (khách, Chromium, `?song=thanh-ca-001`)

Không có lỗi console hay pageerror ở 6 lượt tải. Lỗi nằm ở bố cục và vùng chạm:

| # | Vấn đề | Giao diện | Bằng chứng |
|---|---|---|---|
| U1 | Gig HUD tràn ở 768 dọc: tên bài bắt đầu x=−74, **nút Thoát ở x=761–842 (ngoài màn)**, chỉ thoát được bằng Esc | Modern | `#btn-gig-exit` |
| U2 | Gig trên điện thoại: "Thoát ✕" nằm giữa "Nhạc" và "HD", dễ bấm nhầm. Không có zoom, không có bài trước/sau. Nút "⌄" không có nhãn | Modern | |
| U3 | Điện thoại chỉ **đảo HD↔TLH**, không chọn được bộ cá nhân hay bộ khác; `#chord-set-selector` bị ẩn | Modern | `mobile-controller.js:59` |
| U4 | Tablet: 13/13 điều khiển nhìn thấy đều < 44px (32–40). Zoom chỉ có trong menu với nút **20×20**; capo cũng chỉ trong menu | Modern | |
| U5 | Menu ⋯ điện thoại có 29 mục, kéo từ y=208 tới ~1.528. "Giao diện Cũ", "Hướng dẫn" nằm cuối. "Tối giản bản nhạc" chỉ còn icon (`layout.css:528`) | Modern | |
| U6 | Khách thấy nút không dùng được: "Tạo Chương Trình Mới" (`setlist-ui.js:74,194` gỡ `hidden` mà không kiểm vai trò), "Sửa bản nhạc (SATB)", "Quản lý kho nhạc", "Ban nhạc & Thành viên", "Nhật ký phục vụ", "✎ Gõ ChordPro" trên mỗi khổ lời. Viewer thấy "+ bộ mới" (`chord-canvas.js:512` dùng `isLoggedIn`) nhưng bị chặn khi bấm | Modern | |
| U7 | Chỉ dùng được bằng bàn phím: lật trang (PageUp/Down), nổi bật hợp âm (H), chuyển phân đoạn (J), hoàn tác (Ctrl+Z/Y). Tablet và điện thoại **không có** | Modern | `keyboard-handler.js` |
| U8 | Trùng lặp: 4 cặp ◀ ▶, 3 bộ zoom (+3 nút khoá), 4 nút Bản nhạc/Lời, 5 nút soạn hợp âm, 3 nút đăng nhập (2 cái ẩn), 3 nút về tông gốc | Modern | |
| U9 | Tên bài bị CSS bóp: `max-width: 90px` ở ≤480px (`layout.css:668`), `.song-info-pill { max-width: 110px !important }` ở ≤880px (`layout.css:1855`) | Modern | |
| U10 | Toolbar rộng 672px trên điện thoại 390 (885px trên 768), page-bar 687px, `overflow-x:auto` mà không có dấu hiệu cuộn. Ẩn sau vuốt ngang: ⋮, đổi giao diện, trợ giúp, ◀ ▶, sáng/tối, toàn màn hình, lật trang, ghim bài | Classic | |
| U11 | Vùng chạm rất nhỏ: select capo/zoom cao **13px**, nút "▼" 17×10, link "Giao Diện Mới" 16×24 không có chữ. Ở 1024: 53/77 điều khiển < 44px, 27 cái cao < 24px | Classic | |
| U12 | Nút Lời & hợp âm `display:none`, chỉ mở được qua `?v=lyric` | Classic | `btn-lyric-view` |
| U13 | Menu ⋮ chỉ có 2 mục (Mixer, Sân Khấu); nút không có listener riêng | Classic | |
| U14 | Viewport thiếu `viewport-fit=cover`, nên mọi `env(safe-area-inset-*)` bằng 0. Thanh dưới (y=781, cao 63) và HUD có thể nằm dưới thanh Home khi chạy PWA | Cả hai | `index.php:16`, `old/index.php:15` |

**Chỉ Modern có:** gig HUD, khổ hát, cỡ/ký hiệu hợp âm, góc nhìn nhạc cụ, live sync, phiên bản MusicXML, bàn số nhanh, lọc dịp lễ/chủ đề/sắp xếp, program bar, in/copy chương trình, count-in, chip phân đoạn, thông báo.
**Chỉ Classic có:** ghim bài, lọc theo tông, nút lật trang, nút "Nổi bật hợp âm", slider BPM + lưu BPM, chọn âm sắc và chế độ phát.

### 1.3 Hai bản mã tách đôi (dòng Classic / Modern, kích thước diff)

| Nhóm | File (dòng old/modern, diff) |
|---|---|
| Lõi tải và vẽ | `osmd-renderer.js` 584/597 (707), `song-loader.js` 320/594 (462), `app.js` 153/233 (156), `app-ui.js` 264/487 (379) |
| Hợp âm | `chord-canvas.js` 584/561 (695), `chord-canvas-ui.js` 447/580 (631), `chord-canvas-dots.js` 468/586 (458), `chord-canvas-xml.js` 314/423 (187) |
| Thư viện, chương trình | `library-ui.js` 548/595 (825), `setlist-ui.js` 539/261 (800, Modern đã tách 4 file) |
| Điều khiển | `toolbar-controller.js` 210/593 (507), `song-info-bar.js` 237/566 (587), `page-nav.js` 162/376 (538), `display-settings.js` 431/581 (1012), `auto-scroller.js` 142/298 (440), `metronome.js` 399/586 (271), `keyboard-handler.js` 170/228 (244) |
| Khác | `auth.js` 220/500 (358), `instruments.js` 142/176 (318), `admin-ui.js` 317/402 (223), `performance-notes.js` 188/285 (153), `importer.js` 402/459 (99) |
| PHP | `modals.php` 417/595 (622), `toolbar.php` 294/437 (637), `sheet_viewer.php` 262/291 (341), `sidebar.php` 101/187 (154), `admin_console.php` 245/333 (148) |
| CSS | `layout.css` 747/3339, `sheet.css` 1746/3216, `components.css` 212/577, `base.css` 96/203 |

Quy tắc lệch nhau: giới hạn dịch giọng ±12 / ±8; debounce dịch 100 ms / 400 ms; Classic không có AbortController, không có hợp âm offline, zoom lấy từ session thay vì tính vừa khung.

### 1.4 Đo trên mạng chậm, lỗi ngẫu nhiên, WebKit

**Chưa có số liệu.** Lượt đo đang chạy lúc viết file này. Ticket **M0-1** đo lại bằng script trong repo và lấy kết quả đó làm mốc chính thức; không dùng số ước lượng.

---

## 2. Nguyên nhân lỗi tải, xếp theo mức ảnh hưởng

"Xác nhận" là đã lần theo mã. "Suy luận" là chưa tái hiện trên máy.

| # | Nguyên nhân | Triệu chứng người dùng | Vị trí | Mức tin |
|---|---|---|---|---|
| L1 | Init dây chuyền không `try/catch`; `onSelect` gắn cuối; `ChordCanvas?.init?.()` không cứu được ReferenceError khi file 404 hay lỗi parse. Ngoài `App.init`, Modern còn 7 bootstrap `DOMContentLoaded` riêng (admin-ui, fab, follow-leader, leader-notes-banner, liturgy-card, live-sync, app) | Danh sách hiện, chạm bài không mở; hoặc trang trắng | `assets/js/app.js:11-89`, `old/assets/js/app.js:11-64` | Xác nhận |
| L2 | OSMD local lỗi thì `onerror` chèn script CDN dạng async, nhưng các script `defer` (`app.js`) **chạy trước**. `new opensheetmusicdisplay…` ném lỗi, `App.init` dừng trước `LibraryUI.init`. `tonal.min.js` dùng cùng mẫu | Trang trắng, không có danh sách | `index.php:158-161`, `old/index.php:163-166`, `osmd-renderer.js:34` | Xác nhận |
| L3 | Không timeout: `ApiService._request` (`ApiService.js:43-61`), tải XML (`song-loader.js:78`, `old/assets/js/song-loader.js:47`), các nhánh network-first trong `sw.js` | Treo "Đang tải…" hàng chục giây dù có cache | | Xác nhận |
| L4 | Tên bài chỉ gán sau khi vẽ xong (`song-loader.js:142`); mọi lỗi vào `catch` (`:182-190`) → `showWelcome()` xoá màn bài. Nguồn lỗi: OSMD hết bộ nhớ, XML hỏng, `ChordCanvas.loadSong` trong `Promise.all`, `localStorage.getItem` ném SecurityError khi chặn cookie (`:315`) | Bài không hiện, tên cũng mất | | Xác nhận |
| L5 | Classic có 4 nguồn vẽ lại không token: OSMD `autoResize: true` (`old/assets/js/osmd-renderer.js:28`), ResizeObserver (`:63-80`, vẫn chạy khi bề rộng 0), `resize` → `setZoom` (`old/assets/js/toolbar-controller.js:83-115`), `orientationchange` (`:121+`). Xoay máy có thể vẽ 4 lần. Mỗi lần mở bài vẽ 2 lần (`setTimeout(_autoFitZoom, 80)`). Modern đã gom về 1 ResizeObserver nhưng callback (`osmd-renderer.js:59-82`) không có `try/catch` | Bản nhạc lớn trên iPhone làm Safari đóng tab rồi tải lại | | Xác nhận mã; việc Safari đóng tab là suy luận |
| L6 | Link `?song=` của bài không có trong danh sách (riêng tư, hoặc danh sách lỗi) thì không làm gì, không gọi `ApiService.songs.get` (`library-ui.js:96-97, 517-529`). Classic khi danh sách lỗi hiện "Không tìm thấy bài hát", không có nút thử lại (`old/assets/js/library-ui.js:206-209`) | Mở link chia sẻ không ra bài | | Xác nhận |
| L7 | Màn ≤ 680px mặc định chế độ Lời ("band"); mã tự bấm nút đổi chế độ **sau khi** đã vẽ OSMD (tốn bộ nhớ). Bài sau khi khung nhạc đang ẩn thì lệnh vẽ bị treo chờ (`osmd-renderer.js:189-191`) | "Bản nhạc không hiện" | `song-loader.js` `_restoreFromURL` | Xác nhận mã; cách người dùng hiểu là suy luận |
| L8 | Regex lookbehind `(?<!…)` ném SyntaxError trên Safari < 16.4 (iPadOS 15, 16.0–16.3) | Tìm kiếm vỡ ở cả hai giao diện trên iPad cũ | `assets/js/core/LibrarySearch.js:60` | Xác nhận |
| L9 | SW: `skipWaiting` + `clients.claim`, activate xoá cache cũ khi trang cũ còn chạy, không xử lý `controllerchange`. Offline thì nhánh `ignoreSearch` có thể trả JS/CSS khác phiên bản với HTML. Classic hành xử khác nhau tuỳ máy đã từng mở Modern chưa. iOS xoá storage sau khoảng 7 ngày không dùng | Lỗi lạ sau khi cập nhật; lần mở sau lại tải lạnh ~2,2 MB | `sw.js`, `ServiceWorkerManager.js:12` | Suy luận |
| L10 | Storage: Classic giữ mọi XML trong Map RAM `_memXml` không giới hạn và IDB không giới hạn; ~33 `localStorage.setItem` không `try`; `VerseManager.init:26` đọc storage không guard; `OfflineSetlistManager` nhét gói offline vào localStorage (~5 MB) | Lỗi ở Safari riêng tư hoặc khi đầy bộ nhớ | | Suy luận |
| L11 | Lỗi bị nuốt: `ErrorReporter` chỉ có ở Modern và chỉ gửi log, không báo người dùng; Classic không có handler lỗi toàn cục; nhiều `catch(e){}` trống (onReady, `fetchXml`, `ChordCanvas.loadSong` của Classic) | Không ai biết vì sao lỗi | | Xác nhận |

---

## 3. Thiết kế màn đọc mục tiêu (áp dụng cho cả hai giao diện)

Một thư viện sheet phải ưu tiên **đọc bản nhạc**. Mọi thứ khác lùi lại sau.

### Lớp 1 — luôn cách 1 chạm khi đọc (vùng chạm ≥ 44×44, `touch-action: manipulation`)

| Điện thoại (thanh dưới 6 ô, nằm trên safe-area) | Tablet (một hàng duy nhất) |
|---|---|
| Tông − · số tông (chạm để về gốc) · + | như điện thoại, thêm Capo dạng chip |
| Bộ hợp âm: mở **sheet chọn đủ danh sách** (HD, TLH, bộ công khai, bộ của tôi) | select bộ hợp âm rộng ≥ 160px, không cắt chữ |
| Bản nhạc ↔ Lời | công tắc 2 đoạn |
| ◀ ▶: trong chương trình thì theo chương trình, ngoài chương trình thì theo danh sách đang hiện | ◀ ▶ |
| Toàn màn hình | Zoom − % +, Toàn màn hình |
| Thanh trên: ☰ thư viện · **tên bài (không bao giờ trống)** · ⋯ | thêm ♩ tempo, tự cuộn |

Lật trang: thêm vùng chạm mép trái/phải trên bản nhạc (cả hai giao diện), thay cho việc chỉ có phím PageUp/Down.

### Lớp 2 — menu ⋯ / ⋮ chia nhóm, mỗi nhóm ≤ 12 mục, mọi mục có chữ

- **Hiển thị:** zoom + khoá zoom (điện thoại), cỡ và ký hiệu hợp âm, tối giản, khổ hát, góc nhìn nhạc cụ, nổi bật hợp âm, sáng/tối.
- **Tập luyện:** metronome, phát bè/SATB, tự cuộn, count-in, ghi chú nhạc cụ (chuyển nút "Nhạc cụ" từ toolbar xuống đây).
- **Ban nhạc:** theo ca trưởng, phiên bản, ghim/yêu thích, in.
- **Cuối menu:** đổi giao diện, hướng dẫn, đăng nhập/đăng xuất.

### Lớp 3 — theo quyền, không đặt trên màn đọc

Mục không đủ quyền thì **ẩn hẳn**, không hiện rồi báo lỗi.
- Soạn hợp âm, tạo bộ, đề xuất HD, ChordPro: từ banhat trở lên, gom sau một nút "Soạn".
- Tạo/sửa chương trình: tab Chương trình, theo quyền backend hiện hành.
- Editor, Manager, thành viên, import/OMR, ghi chú admin: link sang `/manager/`, `/editor/`, chỉ hiện cho người có quyền.

### Gig mode (Modern)

Chỉ giữ Tông, Bộ hợp âm, Xem, ◀ ▶, Cuộn. Nút Thoát ở góc trên, tách khỏi cụm điều khiển. HUD co vừa 360–1024px.

### Classic

Giữ phong cách hiện tại nhưng cùng thứ tự ưu tiên. Gộp toolbar + page-bar thành **một hàng Lớp 1** (Tông, Bộ hợp âm, Lời, ◀ ▶, Toàn màn hình), phần còn lại vào ⋮ thay cho cuộn ngang. Hiện lại nút Lời. Mọi select cao ≥ 36px.

### Quy tắc hiển thị tên bài (cả hai)

- Gán tên bài, số bài, danh mục **ngay khi bắt đầu tải** (dữ liệu đã có từ danh sách), không chờ vẽ xong.
- Tên dài thì xuống tối đa 2 dòng hoặc rút gọn có `title`; không đặt `max-width` cứng 90/110px.
- Khi lỗi: giữ tên bài, hiện panel "Không tải được bản nhạc · Thử lại · Xem lời" ngay trong khung nhạc. Không quay về màn chào.

---

## 4. Roadmap

Thứ tự bắt buộc: M0 → M1 → M2 → M3 → M4 → M5 → M6. Mỗi ticket kiểm trên **cả hai giao diện**, trừ khi ghi rõ. Mỗi ticket có E2E Playwright ở Chromium (Pixel 7, 412×915) và WebKit (iPhone 13 390×844, iPad Mini 768×1024), chạy trên bản sao cách ly (`e2e/assert-isolated-root.js`).

### M0 — Đo mốc trung thực (1 ngày)

| ID | Việc | Nghiệm thu | Thay cho |
|---|---|---|---|
| M0-1 ✅ `5f58219` | Script `e2e/mobile-load-baseline.spec.js`: 2 giao diện × 3 thiết bị × 3 điều kiện (bình thường; Chromium 4G chậm qua CDP: latency 150 ms, 1,6 Mbps xuống, 750 kbps lên, CPU chậm 4×; chặn ngẫu nhiên 10% request JS/CSS/API bằng `page.route` với seed cố định). Mỗi tổ hợp 5 lần, cache lạnh. Ghi: danh sách có hiện, tên bài đúng, có SVG và thời gian tới SVG, số request/byte, lỗi console, request lỗi | Bảng kết quả vào `docs/mobile-evidence/M0-baseline.md`, **đếm số lần hỏng** chứ không chỉ trung bình. Spec chưa bắt FAIL theo ngưỡng; chỉ ghi số | TV2-1 |
| M0-2 ✅ `748608a` | Thêm vào cùng spec: đổi nhanh 5 bài liên tiếp bằng chạm; xoay máy 3 lần với bài lớn nhất (theo kích thước file XML); lần tải thứ hai qua SW | Số liệu thô trong cùng file | |

### M1 — Khởi động an toàn, không bao giờ trắng trang (2–3 ngày) 🔴

| ID | Việc | Nghiệm thu | Sửa |
|---|---|---|---|
| M1-1 | `assets/js/core/BootRunner.js` (dùng chung): `safeInit(name, fn)` bắt lỗi từng module, ghi `ErrorReporter`, chạy tiếp. Cả hai `app.js` dùng BootRunner; **gắn `onSelect` đầu tiên**; gọi module qua `window.X` | Test VM: một module ném lỗi trong init thì các module sau vẫn init và chạm bài vẫn gọi `SongLoader.load` | L1 |
| M1-2 | Watchdog: sau 8 giây mà App chưa báo sẵn sàng thì hiện banner "Ứng dụng chưa tải xong · Tải lại" (không phụ thuộc module nào khác) | E2E: chặn `app.js` → banner hiện trong ≤ 9 s | L1 |
| M1-3 | Gom 7 bootstrap `DOMContentLoaded` rời của Modern vào BootRunner (giữ thứ tự hiện tại) | Grep: `app.js` là nơi duy nhất gọi init lúc khởi động; E2E Thư viện cũ vẫn PASS | L1 |
| M1-4 | `ScriptLoader.loadWithFallback(local, cdn)` trả Promise. Khởi tạo OSMD **lười**: chỉ khi mở bài đầu tiên. Danh sách bài không phụ thuộc OSMD. Gắn `?v=` cho file vendor | E2E: chặn file OSMD local → danh sách vẫn hiện; mở bài thì dùng CDN và vẽ được | L2 |
| M1-5 | `ErrorReporter` dùng chung cho Classic; lỗi chưa bắt (`error`, `unhandledrejection`) hiện toast có nút "Tải lại" tối đa 1 lần mỗi 30 giây; thay các `catch(e){}` trống trên đường tải bằng ghi log | E2E: ném lỗi giả trong handler → có toast, có bản ghi client_log | L11 |

### M2 — Tải dữ liệu và tải bài bền vững (3–4 ngày) 🔴

| ID | Việc | Nghiệm thu | Sửa |
|---|---|---|---|
| M2-1 | `ApiService._request` và tải XML có timeout bằng `AbortController` (đề xuất 12 s, đặt hằng số), retry 1 lần với GET; lỗi trả về kiểu thống nhất `{offline, timeout, status}` | Test VM: request treo → reject sau timeout; GET lỗi lần 1, đúng lần 2 → thành công | L3 |
| M2-2 | `sw.js`: network-first đua với timeout 4 s rồi trả cache; xử lý `controllerchange` (tải lại một lần khi trang đang rảnh, không khi đang chơi); không trả JS/CSS lệch phiên bản HTML. Quyết định Classic theo **Q-M1** | Test SW hiện có + test mới: mạng treo → trả cache trong ≤ 5 s; `generate_sw_manifest.php --check` PASS | L9 |
| M2-3 | `assets/js/core/SongLoaderCore.js` dùng thật cho cả hai giao diện: token chống chồng lệnh, timeout, abort khi đổi bài, offline (OfflineVault), trả `{xml, source}`. Viết dựa trên file đã có | Test VM: đổi bài A→B nhanh → chỉ B được vẽ; XML A trả muộn bị bỏ | L4, L6 |
| M2-4 | Tên bài/số/danh mục gán ngay khi bắt đầu tải. Lỗi vẽ hoặc tải → panel lỗi tại chỗ (Thử lại, Xem lời), **không** gọi `showWelcome`. Dùng `Promise.allSettled` cho sessions và hợp âm: lỗi phụ không làm hỏng bản nhạc | E2E: XML trả 500 → tên bài vẫn đúng, có nút Thử lại; `chord_sets` lỗi → bản nhạc vẫn hiện (hợp âm TLH theo Core Rule 1) | L4 |
| M2-5 | Deep link `?song=`: bài không có trong danh sách thì gọi `ApiService.songs.get`; danh sách lỗi thì hiện "Không tải được danh sách · Thử lại", không phải "Không tìm thấy bài hát" | E2E: chặn `songs.list` → thông báo đúng; mở `?song=` bài ngoài trang đầu → bài hiện | L6 |
| M2-6 | `assets/js/core/SafeStorage.js`: get/set/remove không bao giờ ném; thay các `localStorage` trên đường khởi động và tải bài ở cả hai giao diện. Giới hạn `_memXml` của Classic (LRU 10 bài). Gói offline chuyển từ localStorage sang IndexedDB qua OfflineVault | Test VM: storage ném SecurityError/QuotaExceeded → app vẫn khởi động và mở bài | L10 |
| M2-7 | Bỏ regex lookbehind trong `LibrarySearch.js` (kiểm ranh giới bằng mã hoặc regex không lookbehind), giữ đúng kết quả TV1-3 | Test hiện có của tô sáng vẫn PASS; test mới chạy khi giả lập không hỗ trợ lookbehind | L8 |

### M3 — Vẽ bản nhạc nhẹ và ổn định trên máy yếu (2–3 ngày) 🟠

| ID | Việc | Nghiệm thu | Sửa |
|---|---|---|---|
| M3-1 | `assets/js/core/OSMDRenderCore.js` dùng chung: một hàng đợi vẽ duy nhất, token, debounce resize/xoay (đề xuất 250 ms), bỏ qua khi bề rộng 0 hoặc khung đang ẩn, `try/catch` báo lỗi vào panel M2-4 | Test VM: 10 sự kiện resize trong 200 ms → 1 lần vẽ | L5 |
| M3-2 | Classic: `autoResize: false`; bỏ vẽ trong handler `resize`/`orientationchange` của `toolbar-controller.js`; tính zoom vừa khung **trước** lần vẽ đầu như Modern | E2E Classic: mở bài → đúng 1 lần vẽ; xoay máy → đúng 1 lần | L5 |
| M3-3 | Điện thoại mặc định chế độ theo **Q-M2**. Nếu mở Lời: không vẽ OSMD cho tới khi người dùng chuyển sang Bản nhạc; khung nhạc ẩn thì không giữ lệnh vẽ treo | E2E 390: mở bài ở chế độ Lời → 0 lần vẽ OSMD; chuyển Bản nhạc → 1 lần | L7 |
| M3-4 | Đo bộ nhớ khi mở bài XML lớn nhất (Chromium `performance.memory`) trước/sau M3-1..3 | Số liệu trong `docs/mobile-evidence/M3-memory.md` | |

### M4 — Màn đọc theo 3 lớp (4–6 ngày, mỗi ticket ≤ 5 file) 🟠

Ticket có đuôi "a" là Modern, "b" là Classic. Không có đuôi là chung.

| ID | Việc | Nghiệm thu | Sửa |
|---|---|---|---|
| M4-1 | Viewport `viewport-fit=cover` ở cả hai `index.php`; thanh dưới, HUD, toolbar dùng `env(safe-area-inset-*)` | Ảnh iPhone 13 WebKit: thanh dưới nằm trên vùng Home | U14 |
| M4-2a | Modern Lớp 1 điện thoại: thanh dưới 6 ô theo mục 3; bộ hợp âm mở sheet chọn đủ danh sách thay cho đảo HD↔TLH | E2E 390: chọn được bộ khác HD/TLH; mọi ô ≥ 44×44 | U3 |
| M4-2c | Modern Lớp 1 tablet: một hàng, select bộ hợp âm ≥ 160px, zoom − % + ra ngoài menu | E2E 768/1024: 0 điều khiển Lớp 1 < 44px; không chữ nào bị cắt | U4 |
| M4-3 | Modern: gỡ nút trùng theo bảng phân bổ (mỗi hành động 1 chỗ chính + tối đa 1 trong menu + phím tắt). **Bảng phân bổ cần chủ dự án duyệt (Q-M3)** trước khi gỡ | Script đếm: không hành động nào có > 2 nút cùng hiện trên một màn hình | U8, TV3-1 |
| M4-4 | Modern menu ⋯: 4 nhóm có tiêu đề, mọi mục có chữ, "Đổi giao diện" và "Đăng nhập" ở nhóm cuối cố định | E2E 390: menu không quá 2 màn cuộn; mỗi mục có tên truy cập | U5 |
| M4-5 | Ẩn hẳn mục không đủ quyền (U6), dựa trên **một** hàm quyền dùng chung (`auth.js`); sửa `setlist-ui.js:74,194` và `chord-canvas.js:512` | E2E khách và viewer: không thấy các mục ở U6; banhat vẫn thấy | U6 |
| M4-6 | Gig HUD co vừa 360–1024; nút Thoát ở góc trên tách khỏi cụm điều khiển; thêm ◀ ▶ và zoom ở điện thoại | E2E 768 dọc: `#btn-gig-exit` nằm trong khung; 390: Thoát không kề nút khác | U1, U2 |
| M4-7 | Vùng chạm lật trang mép trái/phải trên bản nhạc (cả hai giao diện), không xung đột chạm vào nốt (dùng `PointerTap`) | E2E: chạm mép phải → trang sau; chạm nốt ở giữa → không lật | U7 |
| M4-8 | Tên bài: bỏ `max-width` 90/110px cứng, tối đa 2 dòng hoặc rút gọn có `title` | Ảnh 360/390/768: tên dài đọc được ít nhất 2 từ đầu, có `title` đầy đủ | U9 |
| M4-9b | Classic: gộp toolbar + page-bar thành một hàng Lớp 1 (Tông, Bộ hợp âm, Lời, ◀ ▶, Toàn màn hình), phần còn lại vào ⋮; hiện lại nút Lời; ⋮ có đủ mục và listener | E2E Classic 390: toolbar không cuộn ngang (`scrollWidth ≤ clientWidth`); ◀ ▶ và Lời thấy ngay | U10, U12, U13 |
| M4-10b | Classic: mọi select/nút Lớp 1 cao ≥ 36px (mục tiêu 44px trên điện thoại) | Script đo 390/768/1024: 0 điều khiển Lớp 1 < 36px | U11 |

### M5 — Một lõi, hai giao diện (theo đợt, liên tục) 🟡

Mục tiêu: lỗi sửa một lần có hiệu lực ở cả hai giao diện. Mỗi đợt gom **một** cặp file, có E2E chạy trên cả hai giao diện trước và sau.

| ID | Việc | Ghi chú |
|---|---|---|
| M5-1 | Hằng số nghiệp vụ dùng chung `assets/js/core/AppRules.js`: giới hạn dịch giọng, debounce, tên bộ HD/TLH/default. Thống nhất ±12 / ±8 theo **Q-M4** | Core Rule không đổi |
| M5-2 | Classic dùng `SongLoaderCore` (M2-3) và `OSMDRenderCore` (M3-1) thay cho `old/assets/js/song-loader.js` và phần vẽ của `old/assets/js/osmd-renderer.js` | Giữ hàm public cũ làm lớp mỏng nếu module khác gọi |
| M5-3 | Dữ liệu thư viện dùng chung (`assets/js/core/LibraryData.js`): danh sách, deep link, thử lại; hai `library-ui.js` chỉ còn phần hiển thị | |
| M5-4 | Hợp âm: tách phần logic (tải/lưu/undo/token) của `chord-canvas*.js` thành core dùng chung; phần vẽ chấm/popup giữ riêng | Nhiều lỗi BUG-12/25 nằm ở đây |
| M5-5 | Đưa tính năng chỉ có ở một bên sang bên kia theo **Q-M5** | Mỗi tính năng 1 ticket |

### M6 — Nghiệm thu (1–2 ngày)

- Chạy lại spec M0 và so với mốc: **0 trang trắng, 0 lần mất tên bài, 0 lần chạm bài không mở** ở cả hai giao diện, mọi thiết bị, mọi điều kiện. Với điều kiện chặn 10% request: mỗi lần hỏng đều có panel/banner "Thử lại", và thử lại thành công.
- `php tests\run_all_tests.php --strict --js` PASS; Playwright Chromium + WebKit PASS.
- Thử trên máy thật: một iPhone (Safari), một Android (Chrome), một iPad dọc, mạng wifi yếu thật. Ghi biên bản vào `docs/mobile-evidence/M6-acceptance.md`.

---

## 5. Thang nghiệm thu

| Chỉ số | Hiện tại | Đích |
|---|---|---|
| Một module lỗi lúc khởi động làm hỏng mở bài | có (L1) | không |
| Request không có timeout | tất cả | 0 |
| Lỗi tải/vẽ làm mất tên bài | có (L4) | không |
| Số lần vẽ OSMD khi xoay máy (Classic) | tới ~4 | 1 |
| Số lần vẽ khi mở bài (Classic) | 2 | 1 |
| Trang trắng / mất tên / chạm không mở (spec M0) | chưa đo | 0 |
| Điều khiển Lớp 1 < 44px (Modern tablet) | 13/13 | 0 |
| Điều khiển cao < 24px (Classic 1024) | 27 | 0 |
| Toolbar Classic cuộn ngang ở 390 | có (672px) | không |
| Chọn bộ hợp âm bất kỳ trên điện thoại (Modern) | không | có |
| Số cặp nút ◀ ▶ (Modern) | 4 | ≤ 2 |
| Mục không đủ quyền vẫn hiện cho khách | ≥ 6 | 0 |
| `viewport-fit=cover` | không | có |
| Tìm kiếm trên Safari < 16.4 | vỡ | chạy |

---

## 6. Ngoài phạm vi

- Không gỡ hay đóng băng giao diện nào; không gộp hai giao diện thành một.
- Không đổi 4 Core Rule (HD mặc định, tông gốc = 0, khoá TLH/HD, đồng bộ setlist).
- Không đưa framework, bundler, TypeScript.
- Không đổi quyền backend; M4-5 chỉ ẩn nút cho khớp quyền đã có.

---

## 7. Quyết định cần chủ dự án

| # | Câu hỏi | Đề xuất |
|---|---|---|
| Q-M1 | Classic có chạy offline (đăng ký SW) không, hay loại `/old/` khỏi SW? | Cho Classic đăng ký cùng SW, cùng manifest, để hai giao diện hành xử giống nhau |
| Q-M2 | Điện thoại mở bài mặc định ở chế độ nào? | Bản nhạc; vai trò Ban Hát mặc định Lời (nhớ lựa chọn của người dùng) |
| Q-M3 | Duyệt bảng phân bổ nút (mỗi hành động ở đâu) trước khi gỡ nút trùng | Người thực thi lập bảng ở `docs/mobile-evidence/M4-3-allocation.md`, chủ dự án duyệt |
| Q-M4 | Giới hạn dịch giọng thống nhất: ±12 hay ±8? | ±12 (đủ một quãng tám) |
| Q-M5 | Tính năng chỉ có ở một bên (mục 1.2): đưa sang bên kia, giữ nguyên, hay bỏ? | Đưa ghim bài và nút nổi bật hợp âm sang Modern; còn lại giữ nguyên |
