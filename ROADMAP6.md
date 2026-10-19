# SheetApp2 — ROADMAP 6 (bản mới): Trang THƯ VIỆN — Sửa đúng chỗ hỏng, tìm nhanh và đủ, tải nhẹ, dữ liệu đáng tin

> **Ngày lập:** 2026-10-17
> **Phạm vi:** chỉ trang Thư viện — giao diện mới `index.php` (ví dụ `http://localhost/sheetapp2/?song=thanh-ca-001`), giao diện cũ `old/index.php`, và các API/dữ liệu mà Thư viện dùng (`route=songs`, `chord_sets`, `setlists`, `import`).
> **Người đọc:** chủ dự án (duyệt, trả lời mục 5) và **một** người/AI thực thi.
> **Luật thực thi:** `ROADMAP3.md` Phần 0 vẫn áp dụng nguyên văn (bằng chứng FAIL→PASS thô, test không ghi DB/storage thật, không push/deploy/`sync.*`, mỗi ticket ≤ ~5 file, gặp xoá dữ liệu / đổi Core Rule / đổi quyền thì dừng và hỏi).
> **Thay cho:** `ROADMAP6.md` cũ (R6-0…R6-7, giao diện Thư viện, đã triển khai và bị gỡ khỏi thư mục gốc ở commit `6819f39`; lịch sử còn ở `docs/ROADMAP6_IMPLEMENTATION_REPORT.md`). Mã ticket bản này dùng tiền tố **TV** để không nhầm với R6-x cũ.

## TRẠNG THÁI TRIỂN KHAI (người thực thi cập nhật sau mỗi ticket)

> **Điều chỉnh phạm vi 2026-10-18 theo chủ dự án:** Classic (`/old/`) và Hiện đại (`/`)
> đều là chế độ chính thức, cần đổi mới và rà tính năng. Không áp dụng đề xuất đóng băng/gỡ Classic.
> Xem `docs/ROADMAP6_CLASSIC_MODERN_ANALYSIS.md` và nhật ký
> `docs/ROADMAP6_LIBRARY_ACCEPTANCE_REPORT.md`. Bảng quyết định/chữ ký giữ nguyên.

| Giai đoạn | Trạng thái | Ghi chú |
|---|:-:|---|
| TV0 — Sửa hỏng hóc | 🟨 | Đã triển khai TV0-1…8; 37 test Chromium PASS trên hai chế độ. Còn thiết bị thật/WebKit và cổng hồi quy rộng; xem nhật ký |
| TV1 — Tìm kiếm & danh sách | 🟨 | Đã triển khai TV1-1…7 trên hai chế độ; Chromium theo phạm vi PASS, còn nghiệm thu Safari/thiết bị thật. TV1-4 dùng grid giữ nút từng dòng theo trả lời chủ dự án 2026-10-19; xem nhật ký |
| TV2 — Tải trang & ngoại tuyến | ⬜ | |
| TV3 — Giao diện, chạm, trợ năng | ⬜ | |
| TV4 — Bảo mật & API của Thư viện | 🟨 | Đã triển khai TV4-1…6: quyền chương trình/XML, CSRF có cờ, cache/transaction danh mục và hợp đồng API. Cờ csrf_enforce mặc định tắt; còn nghiệm thu rộng/thiết bị thật; xem nhật ký |
| TV5 — Chất lượng dữ liệu | ⬜ | Mọi ticket ghi DB cần chủ dự án duyệt dry-run |
| TV6 — Classic `/old/` | ⬜ | Chủ dự án yêu cầu nâng cấp cả hai chế độ (2026-10-18); xem phân tích điều chỉnh |
| TV7 — Nghiệm thu | ⬜ | |

---

## 0. TÓM TẮT

### Hiện trạng ngắn gọn

Nền tảng ổn: **165 suite PHP / 3.232 check PASS, 0 FAIL** (chạy `php tests/run_all_tests.php` ngày 2026-10-17, 109,9 giây), không có lỗi JS hay HTTP 4xx/5xx khi tải trang ở 4 kích thước màn hình, dữ liệu 1.731 bài nhất quán (0 file XML thiếu, FTS khớp 1:1). Nhưng người dùng thật vẫn gặp lỗi ở những chỗ test chưa đo.

### 6 vấn đề lớn nhất

1. **Chạm để cuộn danh sách bài trên điện thoại/iPad là mở luôn bài đó.** `library-ui.js:66-71` gọi `selectSong()` ngay ở `touchstart`, không chờ biết người dùng đang cuộn. ✅ đã xem mã.
2. **Tìm kiếm và bộ lọc âm thầm cắt còn 50 bài.** Client không gửi `limit`/`category_id`; server mặc định 50; client lọc danh mục *sau khi* đã cắt (`library-ui.js:329-333`, `SongController.php:54`). Ví dụ chủ đề "Đời tín đồ" có 343 bài nhưng chỉ hiện 50. ✅ đã xem mã.
3. **Thanh công cụ bị chồng/cắt ở laptop khi mở sidebar và ở iPad dọc**; toast thông tin che nội dung và chữ trong toast đè lên nhau. 📷 đã xem ảnh chụp.
4. **Trang tải nặng hơn nhiều so với ngân sách đã ghi:** 88 file JS, 112 request, ~3,4 MB khi mở bài lần đầu, trong khi `PROJECT_REGISTRY.md` (L5-5, L5-9) ghi "≤ 30 script". 9 API được gọi khi tải trang.
5. **Dữ liệu mỏng:** chỉ **147/1.731** bài có hợp âm HD thật, **100/1.731** bài có tempo, danh mục 2–7 (828 bài) không có nhãn dịp lễ/chủ đề, **233** bài là "lead sheet" sinh tự động từ lời + hợp âm (ví dụ "ĐẤNG TẠO HOÁ" toàn nốt G giữ chỗ) nhưng giao diện không phân biệt.
6. **Hai giao diện (`/` và `/old/`) đã tách nhánh:** 23 file JS, 4 file CSS, 5 include bị sao chép và đều đã khác nhau. Bản cũ thiếu chống tải chồng bài, tìm kiếm không bỏ dấu ("chua" không ra "CHÚA"), modal không có `role="dialog"`. Mỗi lần sửa phần lõi phải giữ cả hai chạy.

### Điều kiện tiên quyết

- **Một đầu mối ghi mã.** Lúc lập roadmap (2026-10-17), thư mục làm việc đang có thay đổi chưa commit của một phiên khác: `assets/js/core/ApiService.js`, `assets/js/audio-player.js`, `sw.js`, `old/assets/js/library-ui.js`, `storage/data/songs_cache.json`, và file mới `assets/js/core/OfflineVault.js`, `assets/js/vendor/idb-keyval.min.js`, `assets/js/vendor/pitchy-mpm.js`, `tools/audit_satb_harmony.php`. Trước khi làm TV0 phải chốt (commit hoặc bỏ) các thay đổi này và **tắt `sync.bat`/`sync.sh`** trong suốt đợt, như ROADMAP5 đã làm.
- Nhánh làm việc đề xuất: `feature/roadmap6-thu-vien`.

---

## 1. KẾT QUẢ RÀ SOÁT

**Nguồn:** đọc mã tại `main` (`4817312`) + thay đổi chưa commit nêu trên; truy vấn **chỉ đọc** `storage/data/app.sqlite`; chạy Chromium headless (Playwright) với tài khoản **khách** ở 1366×768, 820×1180, 390×844, 360×740, không đăng nhập, không bấm lưu. Chưa thử WebKit/Safari, thiết bị thật, mạng chậm hay tài khoản Admin/HD.

Ký hiệu độ tin cậy: ✅ người lập đã tự kiểm trong mã/dữ liệu · 📷 thấy trên ảnh chụp Chromium · 🔍 suy ra từ đọc mã, chưa thử trên thiết bị.

### 1.1 Số đo khi chạy (khách, Chromium, localhost, không giới hạn CPU/mạng)

| Chỉ số | 1366 | 820 (iPad dọc) | 390 | 360 |
|---|---|---|---|---|
| Thấy bản nhạc SVG lần đầu | 5,6 s lần đầu (máy chủ nguội); 0,8–1,0 s các lần sau | 1,0 s | 1,0 s | 1,1 s |
| Request khi tải xong | 112 (88 JS, 7 CSS, 9 API, 1 XML) | 112 | 112 | 112 |
| Dung lượng tải | 3,4 MB | 3,5 MB | 3,5 MB | 3,5 MB |
| Tìm "an điển" → danh sách cập nhật | 360 ms / 50 kết quả | 396 ms | 557 ms | 408 ms |
| Tìm "123" | 245 ms / 1 kết quả đúng | 299 ms | 341 ms | 332 ms |
| Dịch giọng +1 | 318 ms | 251 ms | 482 ms | chưa đo |
| Tràn ngang trang | không | không | không | không |
| Lỗi console | 0 lỗi; 1 cảnh báo "AudioContext was not allowed to start" ở mọi trang | | | |

9 API khi tải trang: `auth/me`, `songs`, `setlists`, `sessions`, `chord_sets load HD`, `chord_sets list`, `song_usage`, `arrangements sections`, `arrangements arrangements`. Giao diện `/old/`: 49 request, 41 script.

### 1.2 Lỗi chức năng (P0/P1)

| # | Lỗi | Bằng chứng | Tin cậy |
|---|---|---|:-:|
| B1 | Chạm bắt đầu cuộn trên một dòng bài là mở bài đó; cùng mẫu ở nút nhảy nhanh (`:430`), bài gần đây (`:477`), yêu thích (`:492`) | `assets/js/library-ui.js:66-71` | ✅ |
| B2 | Yêu thích nhanh gắn cả `click` và `touchstart` → một chạm tải bài 2 lần | `library-ui.js:491-492` | 🔍 |
| B3 | Danh sách ảo giả định dòng cao 28/38px nhưng CSS ép `min-height: 40px` + dòng phụ + `gap:1px` → cuộn lệch, tô sáng bài đang chọn sai chỗ; `ITEM_H` không tính lại khi xoay máy | `library-ui.js:122` vs `assets/css/library-polish.css:359-363` | ✅ mã / 🔍 hành vi |
| B4 | Tìm kiếm/bộ lọc cắt 50 bài, lọc danh mục chạy sau khi cắt; không có phân trang, không báo "còn nữa" | `library-ui.js:329-333`, `api/controllers/SongController.php:54`, `api/services/SongSearchHelper.php:201` | ✅ |
| B5 | Nút "tìm theo lời" (`#btn-search-lyrics`) chỉ đổi màu, `_onSearch` không đọc `_searchMode` | `library-ui.js:387-392` | ✅ |
| B6 | Từ khoá gõ vào được chèn thẳng vào `innerHTML` ở thông báo "Không tìm thấy" (self-XSS, hiển thị sai `<`); cả hai giao diện | `library-ui.js:164, 342, 383`; `old/assets/js/library-ui.js:233, 331` | ✅ |
| B7 | Laptop 1366 khi mở sidebar: nút "Lời & Hợp âm" nằm dưới nút Toàn màn hình, chữ bị cắt còn "Lời & Hợp"; sau dịch giọng "Bản nhạc" bị cắt còn "♫ B" | ảnh `desk_06_sidebar_open.png`, `desk_04_search_Chua_yeu.png` | 📷 |
| B8 | iPad dọc 820: tên bài còn "HỠI T…", tên bộ hợp âm bị cắt đầu "oài Dinh (HD)…", nhóm dịch giọng biến mất ở chế độ Lời; `#btn-add-chord-mode-bar` tràn quá mép phải (826 px > 820) | `ipad_01_load.png`, `ipad_02_lyrics.png` | 📷 |
| B9 | Toast thông tin ("Đang xem như Đàn phím…", "HD (chưa có · đang hiện TLH)") che nội dung; icon và 2 dòng chữ đè lên nhau | `desk_01_load.png`, `desk_06_sidebar_open.png`, `m390_01_load.png` | 📷 |
| B10 | Nhãn bộ hợp âm mâu thuẫn: dropdown ghi "Hoài Dinh (HD)" trong khi toast cùng bài ghi HD chưa có và đang hiện TLH. Điện thoại ghi "HD→TLH" (rõ hơn) | `desk_05_switched.png`, `desk_06_sidebar_open.png` | 📷 |
| B11 | Lớp z-index vượt thang chuẩn: `99999`, `99998`, `9990`, `9985` trong `library-polish.css` (menu, popup hợp âm, modal ChordPro, HUD, dải phân đoạn) — cao hơn `--z-modal:1000` và `--z-toast:2000` nên modal/toast có thể nằm dưới | `library-polish.css:281, 546, 575, 585, 1278, 1553, 1957`; `base.css:44-61` | ✅ mã |
| B12 | Điện thoại: thanh thao tác dưới đè lên ngăn kéo danh sách bài đang mở, che các kết quả cuối | `m390_04_search_an_dien.png` | 📷 |
| B13 | Chế độ Lời & Hợp âm: khoảng trắng đôi ("Cúi xin  Vua", "Đấng Ủy  lạo"), mảnh gạch nối "Je- sus.", hợp âm đứng riêng dòng không thẳng âm tiết | `m390_05_switched.png`, `ipad_02_lyrics.png` | 📷 |
| B14 | Nhập bài (Import) ghi vào `storage/sheets` — thư mục **không tồn tại**; `realpath()` trả `false` nên đường dẫn thành `/`. Đường dẫn lưu trong DB bị `resolveManagedXmlPath` từ chối và bị `.htaccess` chặn; không đồng bộ FTS, không xoá cache danh sách | `api/services/ImportService.php:9`, `api/import_helpers.php:168`, `api/services/SongService.php:28` | ✅ |
| B15 | Bỏ qua dấu khi tô sáng: tìm "an" tô cả "ẮN" giữa chữ "THẮNG" | `m390_04_search_an_dien.png` | 📷 |
| B16 | Liên kết "bỏ qua tới nội dung" trỏ `#unified-toolbar` nhưng thanh có id `toolbar` | `index.php:67`, `includes/toolbar.php:2` | 🔍 |

### 1.3 Giao diện và chạm

- **Quá nhiều chỗ cho cùng một việc** (🔍 đếm trong `includes/toolbar.php`, `sheet_viewer.php`): đổi Bản nhạc/Lời có 4 nút, dịch giọng 4, soạn hợp âm 4, zoom 3, chọn khổ 3, tự cuộn 3, capo 2 `<select>`. `toolbar.php` có 71 `<button>`; `sheet_viewer.php` 36.
- **Vùng chạm < 44px ở 390px** (📷 đo DOM): `#lv-mode-toggle` 85×19, nút "Gõ ChordPro" 109×24, nút đóng toast 28×28; trong menu Công cụ các nút zoom −/+/khoá trông khoảng 16–20px (chưa đo). Thanh dưới và các nút chính ở chế độ Bản nhạc đều ≥ 44×44 — đạt.
- **Điện thoại xem Bản nhạc** ở zoom 100% chỉ khoảng 1 ô nhịp mỗi hàng, cuộn nhiều; thanh dưới che khuông cuối (`m390_07_sheet_transposed.png`).
- Nhãn nút đổi chế độ xuống 2–3 dòng ở 360/390 ("Lời & HÂ").
- Menu Công cụ trên điện thoại có một dòng chỉ có icon, không có chữ (`m390_08_more_menu.png`).
- Ô tìm kiếm desktop có 2 viền focus lồng nhau.
- **Trợ năng (🔍):** 12 nút chỉ có icon không có tên truy cập (`btn-close-session`, `btn-close-help`, `btn-close-tempo-pick`, `btn-close-admin`, `btn-verse-prev/next`, …); dòng bài `.song-item` là `div` không vào được bằng bàn phím; `#search-input` không có nhãn; `#main-dropdown-menu` có `role="menu"` nhưng chứa checkbox/select/range; banner PWA mang `aria-modal="true"`; `admin_console.php:4` có thuộc tính `class` bị lặp.

### 1.4 Mã nguồn và CSS

- **CSS phân tán (✅ đo dòng/đếm):** 7 file CSS khoảng 309 KB chưa nén. `layout.css` 3.344 dòng, `sheet.css` 3.216, `library-polish.css` 2.017 dòng với **501 `!important`** (đầu file tự ghi chỉ dùng khi cần). Có 19 breakpoint khác nhau (350, 360, 480, 500, 600, 680, 681, 768, 820, 880, 900, 1024, 1100, 1200, 1201, 1250, 1300, 1400, 1440), không có token breakpoint. `library-polish.css` dùng chung 24 selector với `layout.css`, 12 selector với `sheet.css`, và có bộ màu `--lp-*` riêng.
- **Gần chạm trần 600 dòng:** 13 file JS/PHP nằm trong khoảng 577–598 dòng, và nhiều dòng rất dài (`chord-canvas.js` có dòng dài 628 ký tự, `library-ui.js` có 13 dòng hơn 200 ký tự). Con số dòng đang được nén cho vừa trần chứ mã chưa thực sự được tách nhỏ.
- Có 113 chuỗi `'HD'` và 111 chuỗi `'default'` gõ thẳng trong mã. `Store.js:237` và `url-state.js:46` hiểu bộ mặc định khác nhau, nên khi chọn TLH tham số `set` có thể bị bỏ khỏi URL. 🔍
- `library-ui.js` không dùng Store/EventBus mà gọi thẳng `SetlistUI`, `SetlistPlayer`, `App`, `AppUI`. Nút ◀ ▶ được gắn 2 listener: `library-ui.js:37-38` và `setlist-player.js:307-323`, phối hợp với nhau qua một điều kiện chép lặp ở hai nơi.
- Gọi `fetch()` ngoài ApiService: logout trong `core/AppShell.js:138` (đây là API nên không thuộc ngoại lệ được phép) và `old/assets/js/song-loader.js:43` (thiếu chú thích ngoại lệ). Còn sót `console.log` trong `follow-leader.js:234, 337`, `instruments.js:26`, `core/AppShell.js:174`.
- Dòng tổng kết của test runner tự mâu thuẫn: "Regression Suites đã chạy: 165 (Pass: 167…)". Cách đếm cần sửa (luật Phần 0 số 7: không làm tròn số liệu).

### 1.5 API và dữ liệu (✅ truy vấn chỉ đọc)

| Chỉ số | Giá trị |
|---|---|
| Tổng số bài / danh mục | 1.731: Thánh ca 903 · Tôn Vinh Chúa Hằng Hữu 387 · Biệt Thánh Ca 206 · Ca Khúc Chúc Tôn 105 · Kinh Thánh Đối Đáp 100 · NS Trương Văn Xê 28 · Hillsongs 2 |
| Bộ HD có hợp âm thật | **147** (theo danh mục: 1→39, 3→31, 4→77, còn lại 0); 1.584 bộ HD rỗng |
| Tempo đã nhập | **100** (thanh-ca-001…100). `custom_tempo` của **mọi** bộ HD gán cứng 80 (do importer) và không chỗ nào đọc giá trị này |
| Dịp lễ / Chủ đề | 203 / 903, toàn bộ thuộc danh mục 1; danh mục 2–7 đều 0. `tags` 0 bài |
| Tác giả | Có 544 bài; 218 bài còn tiền tố kiểu "Nhạc và lời: …". Bài 259 "Chúa yêu thế gian" ghi lời "Charles Wesley, 1757" ngay trong XML (nghi chép mẫu) |
| Lời | Bài `ton-vinh-chua-hang-huu--241-ta-on-chua` có lời chỉ là "." |
| Bản nhạc sinh tự động | **233** bài (Biệt Thánh Ca 31, Ca Khúc Chúc Tôn 102, Kinh Thánh Đối Đáp 100) do `tools/import_thanh_ca_catalog.php:415-420` tạo từ lời/hợp âm |
| Số bài (`httlvnId`) | Trống ở toàn bộ danh mục 3, 6, 7 (236 bài), nên nhảy theo số không dùng được với các bài này |
| Tên trùng | 58 nhóm, gồm cả cặp trong cùng danh mục 1 (thanh-ca-276/426, 171/431, 089/422) |
| Phân đoạn bài | 100 bài, chia theo heuristic điểm giữa bằng `tools/seed_song_sections.php`, không do người đánh dấu |
| Kiểu chữ tên bài | Danh mục 1 viết HOA toàn bộ; danh mục 2–7 viết thường xen hoa |

Các lỗi backend liên quan Thư viện (✅ đã xem mã trừ khi ghi khác):

- **GET `route=setlists` không đòi đăng nhập.** `getAll` trả mọi chương trình, kể cả bản nháp. `getById` và `offline_package` trả cả danh sách phân công (username, vai trò, nhạc cụ, `chord_code`). ID là số tăng dần nên dễ dò. (`api/controllers/SetlistController.php:71-95`)
- **Ban Hát có thể ghi đè hoặc khôi phục XML của người khác** dưới `storage/users`, vì không có kiểm tra chủ sở hữu (`SongVersionHelper.php:31-61`). 🔍
- **PUT bài hát nhận `xmlPath` tuỳ ý** mà không kiểm tra. Sau đó `syncSongFts` đọc file theo `realpath`, nên có thể đọc file nằm ngoài `storage`. 🔍
- **CSRF:** đã có `RequestSecurity::isValidCsrf` nhưng ngoài test không chỗ nào gọi. `isSameOrigin` trả `true` khi request thiếu cả `Origin` lẫn `Referer`. 🔍
- **Cache danh sách:**
  - Không bị xoá khi đổi tên hoặc xoá danh mục, hay khi chạy các tool đổi nhãn/chính tả, nên có thể cũ tới 1 giờ.
  - Ghi `songs_cache.json` không nguyên tử (thiếu `LOCK_EX` hoặc ghi file tạm rồi đổi tên).
  - Đường fallback ngoại tuyến `storage/data/songs_cache.json` trong ApiService bị `.htaccess` trả 403, nên không bao giờ dùng được.
- **Taxonomy:** API trả khoá dạng slug (`christmas`, `doi-tin-do`), còn DB lưu tên tiếng Việt và server so sánh chính xác. Truyền khoá vào sẽ ra 0 kết quả. Có hai khoá gần trùng `kinh-tiet-ca-doan-ca` / `kinh-tiet-ca`.
- **Lỗi bị nuốt hoặc lộ ra:**
  - `syncSongFts` bắt mọi `Throwable` rồi bỏ qua.
  - `add`/`update`/`delete` trả thẳng thông điệp PDO cho client.
  - `update` một id không tồn tại vẫn trả thành công.
  - Nhánh `lyric_search` trả mảng trần thay vì `{success, data}`.
- **Gói ngoại tuyến:** `package_version` không tính hash XML và hợp âm, nên khi bản nhạc hoặc bộ hợp âm đổi thì gói vẫn được coi là mới.
- **Service worker:**
  - Nhiều file trang chính nạp không có trong danh sách precache: `library-polish.css`, `AppShell.js`, `setlist-*.js`, các file lens, `metronome.js`, `modals/*`.
  - `SW_VERSION` cố định `'v5'`.
  - `sw.js:125` bỏ qua mọi request của `/old/`, nên giao diện cũ hoàn toàn không chạy ngoại tuyến.
- **Khoá session:** mỗi request API đều mở session và giữ khoá tới cuối, nên các request song song (danh sách, hợp âm…) phải chạy lần lượt.

---

## 2. KẾT QUẢ CẦN ĐẠT

1. **Chạm là đúng ý:** cuộn danh sách không bao giờ mở bài, một chạm mở đúng một bài và chỉ tải một lần.
2. **Tìm là đủ:** mọi bộ lọc (từ khoá, danh mục, dịp lễ, chủ đề) trả về đủ kết quả. Danh sách dài thì có "Xem thêm"/phân trang, không cắt âm thầm. Giao diện mới và cũ cho cùng kết quả với cùng một từ khoá.
3. **Không gì đè lên nhạc:** toolbar không chồng hoặc cắt chữ ở 1366 (sidebar mở/đóng), 1440, 820, 390, 360. Toast không che tiêu đề và nội dung. Thang z-index chỉ dùng biến `--z-*`.
4. **Tải nhẹ, đo trung thực:** có một ngân sách hiệu năng mới do chủ dự án duyệt (Q6), được đo bằng script trong CI, và tài liệu ghi đúng con số đo được.
5. **Người dùng biết dữ liệu tin được tới đâu:** bài có bản nhạc sinh tự động, bài chưa có hợp âm HD, bài chưa có tempo đều được đánh dấu rõ. Dữ liệu chỉ được bổ sung qua dry-run có người duyệt.
6. **Một lõi, ít đường song song:** quyết định số phận `/old/` (Q1). Nếu giữ lại thì `/old/` phải đạt cùng ngưỡng an toàn tối thiểu với giao diện mới.

---

## 3. LỘ TRÌNH TRIỂN KHAI

Mỗi ticket có giao diện bắt buộc:
- **E2E Playwright** trên Chromium **và WebKit**;
- ảnh chụp trước và sau ở 1366 (sidebar mở và đóng), 820, 390;
- **không ghi gì vào DB thật** (dùng DB tạm hoặc chặn request ghi).

Ticket có ghi dữ liệu phải chạy `--dry-run` trước, có backup và có chủ dự án duyệt.

### TV0 — Sửa hỏng hóc người dùng gặp ngay (3–4 ngày) 🔴

| ID | Việc | Nghiệm thu |
|---|---|---|
| TV0-1 | **B1/B2.** Danh sách bài chỉ mở bài khi là *chạm thật*: dùng `pointerup`/`click`, chỉ mở khi ngón tay dịch chuyển ≤ 10px và thời gian chạm ≤ 500ms. Áp dụng cho danh sách, nhảy nhanh, gần đây, yêu thích. Mỗi lần chạm gọi `selectSong` đúng 1 lần | E2E chạm cảm ứng (`hasTouch`) ở 390 và 820: vuốt trên dòng bài thì 0 lần đổi bài; chạm một dòng thì đúng 1 request XML; chạm yêu thích thì đúng 1 lần tải |
| TV0-2 | **B3.** Danh sách ảo đo chiều cao dòng thật từ DOM (đo 1 dòng mẫu sau render), tính lại khi `resize`/xoay máy; tô sáng và cuộn tới bài đang chọn đúng vị trí | E2E: danh sách 1.731 bài, chọn bài thứ 800 thì phần tử `.active` nằm trong khung nhìn; xoay 820→1180 thì vẫn đúng |
| TV0-3 | **B6.** Mã hoá từ khoá trong thông báo rỗng bằng `SafeHtml.escape` ở cả hai giao diện. Thêm test hành vi vào `tests/security/xss_output_regression.php` | Gõ `<img src=x onerror=alert(1)>` thì hiện nguyên văn, không có phần tử `img` trong DOM |
| TV0-4 | **B7/B8.** Toolbar laptop/iPad theo thứ tự ưu tiên: khi thiếu chỗ thì thu nhóm phụ vào Công cụ trước khi cắt chữ. Không nút nào giao nhau, không nút nào vượt mép phải | Script kiểm tra hộp ở 1366 (sidebar mở/đóng), 1440, 1180, 820: 0 cặp nút giao nhau, 0 nút có `right > innerWidth`, không nhãn nào bị cắt (`scrollWidth ≤ clientWidth`) |
| TV0-5 | **B9/B10.** Toast đặt ở góc không che tiêu đề/khuông đầu, bố cục icon + chữ không đè nhau, tối đa 1 toast thông tin mỗi lần mở bài. Nhãn bộ hợp âm dùng **một** hàm định dạng chung cho dropdown, chip điện thoại, toast và HUD (ví dụ "HD (chưa có) · đang hiện TLH") | Ảnh 1366/820/390: toast không giao với tiêu đề bài; E2E: bài có HD rỗng thì 4 nơi hiển thị cùng một chuỗi |
| TV0-6 | **B11.** Đưa toàn bộ z-index trong `library-polish.css` về biến `--z-*` (bổ sung biến còn thiếu trong `base.css`); không còn giá trị ≥ 3000 gõ thẳng | Grep chặn tái phát: 0 `z-index:` dạng số ≥ 3000 trong `assets/css`; E2E: mở modal khi HUD đang hiện thì `elementFromPoint` ở giữa modal trả về modal |
| TV0-7 | **B12.** Điện thoại: khi ngăn kéo danh sách mở thì ẩn thanh thao tác dưới, hoặc thêm `padding-bottom` cho danh sách bằng chiều cao thanh + safe area | E2E 390: phần tử kết quả cuối cùng nhìn thấy và bấm được |
| TV0-8 | **B14.** Sửa đường dẫn nhập bài vào `storage/users/<user>/…` (vùng được quản lý), tạo thư mục nếu thiếu, gọi `syncSongFts` và xoá cache danh sách sau khi nhập. Nếu `realpath` thất bại thì báo lỗi, không ghi ra ổ gốc | Test HTTP trên storage tạm: nhập 1 MusicXML thì file nằm trong `storage/users/...`, bài tìm được qua FTS ngay, `GET route=songs` có bài mới |

**Checkpoint TV0:** chủ dự án dùng điện thoại thật cuộn danh sách 30 giây mà không bài nào tự mở; laptop 1366 mở sidebar thấy đủ nhãn toolbar.

### TV1 — Tìm kiếm và danh sách (4–5 ngày) 🟠

| ID | Việc | Nghiệm thu |
|---|---|---|
| TV1-1 | **B4.** API search nhận `category_id`, `limit` (tối đa 200) và `offset`, trả `total`. Client gửi danh mục lên server, không lọc sau khi đã cắt; cuối danh sách có "Xem thêm (còn N bài)" | Test HTTP (DB fixture): theme "Đời tín đồ" trả `total = 343`; E2E: lọc theme này rồi cuộn tới cuối thì bấm "Xem thêm" đủ 343 dòng |
| TV1-2 | **B5.** Quyết định nút "tìm theo lời": hoặc nối vào API (chỉ tìm trong `lyrics_text`), hoặc gỡ bỏ. Không để nút trang trí | E2E: bật chế độ lời thì tìm "yêu thương thế gian" ra bài 259 đứng đầu; hoặc nút không còn trong DOM |
| TV1-3 | **B15.** Tô sáng theo ranh giới từ sau khi chuẩn hoá dấu; không tô giữa chữ; không chạy regex trên chuỗi đã escape (tránh làm vỡ `&amp;`) | Unit test: "an" không tô trong "THẮNG", có tô "ÂN" trong "ÂN ĐIỂN"; tiêu đề có `&` vẫn hiển thị đúng |
| TV1-4 | **Bàn phím và trình đọc màn hình cho danh sách:** `role="listbox"`/`option`, `tabindex` lăn (roving), ↑/↓/Enter/Home/End, `aria-activedescendant`; ô tìm kiếm có `<label>` (ẩn được) | axe-core: 0 lỗi serious/critical ở sidebar; E2E chỉ dùng bàn phím: Tab vào danh sách, ↓ 3 lần, Enter thì mở đúng bài thứ 3 |
| TV1-5 | **Thứ tự ◀ ▶ và danh sách khi có nhiều tập** (theo **Q3**): ◀ ▶ đi trong cùng danh mục đang lọc, hoặc theo thứ tự đã chọn. Bỏ việc gộp phụ thuộc giữa `library-ui.js` và `setlist-player.js` thành một nơi điều phối qua EventBus | E2E: đứng ở Thánh ca 903, bấm ▶ thì đi đúng theo Q3; đang phát chương trình thì ◀ ▶ đi theo chương trình |
| TV1-6 | **Nhảy theo số cho mọi tập:** khi danh mục không có `httlvnId` thì ẩn ô số hoặc dùng số thứ tự trong catalog (theo **Q4**); hiện tiền tố tập khi trùng số (ví dụ "TV 001" và "TC 001") | E2E: chọn danh mục Tôn Vinh rồi gõ "1" thì ra bài 1 của Tôn Vinh, không ra Thánh ca 001 |
| TV1-7 | Gỡ chữ gõ cứng "903 bài" (`includes/toolbar.php:5`, `includes/modals.php:166`), lấy số từ dữ liệu | Grep: 0 lần "903" trong chữ người dùng thấy ở `includes/` |

### TV2 — Tải trang và ngoại tuyến (4–5 ngày) 🟠

| ID | Việc | Nghiệm thu |
|---|---|---|
| TV2-1 | **Đo lại trung thực:** sửa `e2e/library-l5-performance-budget.spec.js` cho đo số script thật (đang là 88, không phải 30) và tổng KB. Ghi số đo vào `PROJECT_REGISTRY.md`, sửa các dòng L5-5/L5-9 đang sai. Sửa dòng tổng kết test runner "165 (Pass: 167)" | Spec chạy ra đúng số hiện tại (để FAIL nếu vượt ngân sách Q6); tổng kết runner: số suite = Pass + Skip + Fail |
| TV2-2 | **Tải theo nhu cầu thật:** đưa các module không cần khi đọc bài (admin, importer, setlist chi tiết, service plan, lens, SATB, live sync, follow-leader, soạn hợp âm) sang `ScriptLoader` khi người dùng mở tính năng. Chia làm nhiều ticket nhỏ, mỗi ticket ≤ 5 file | Đạt ngân sách Q6 (đề xuất: ≤ 40 JS và ≤ 1,5 MB khi mở bài lần đầu); mọi E2E L-series vẫn PASS |
| TV2-3 | **Gộp API khi tải trang:** chỉ gọi `setlists`, `song_usage`, `arrangements` khi cần (mở tab Chương trình, mở popover ⓘ, vào Biểu diễn); `chord_sets list` chỉ gọi khi mở dropdown | Đếm request API khi mở bài lần đầu ≤ 5 (đề xuất); khi đổi bài vẫn ≤ 4 |
| TV2-4 | Không tạo `AudioContext` trước khi người dùng thao tác (tìm nơi gọi khi tải trang) | Console khi tải trang: 0 cảnh báo AudioContext ở cả `/` và `/old/` |
| TV2-5 | **Precache đủ:** `tools/generate_sw_manifest.php` sinh danh sách từ đúng thứ tự script trong `index.php`; `SW_VERSION` tự đổi theo hash manifest | Test: mọi file `index.php` nạp sẵn đều có trong precache; đổi 1 file thì version đổi; E2E ngoại tuyến: mở lại bài đã xem khi mất mạng |
| TV2-6 | **Fallback ngoại tuyến thật:** bỏ đường `storage/data/songs_cache.json` đang bị 403. Phối hợp với phiên đang làm `core/OfflineVault.js`: một nơi duy nhất giữ danh sách bài và lời để tìm kiếm khi mất mạng. Thông báo cho người dùng biết đang ở chế độ ngoại tuyến | E2E offline: tìm theo tên và theo lời vẫn ra kết quả; có chỉ báo "Đang ngoại tuyến" |
| TV2-7 | `package_version` của gói ngoại tuyến tính cả hash XML và checksum bộ hợp âm | Test: đổi XML một bài trong chương trình thì gói chuyển "cần cập nhật" |
| TV2-8 | API đóng session sớm (`session_write_close()`) ngay sau khi đọc xong thông tin đăng nhập ở các route chỉ đọc | Test HTTP: 3 request GET song song không chạy nối tiếp (tổng thời gian < tổng từng request) |

### TV3 — Giao diện, chạm, trợ năng, CSS (1–1,5 tuần) 🟡

| ID | Việc | Nghiệm thu |
|---|---|---|
| TV3-1 | **Một hành động, một chỗ chính.** Bảng phân bổ cho đổi chế độ xem, dịch giọng, soạn hợp âm, zoom, khổ, tự cuộn, capo: mỗi việc có 1 chỗ chính trên mỗi kích thước màn hình, cộng tối đa 1 phím tắt và 1 mục trong Công cụ. Gỡ các nút trùng; gỡ shim `btn-band-toggle`/`btn-menu-chord-edit` khi không còn file nào tham chiếu | Bảng phân bổ được chủ dự án duyệt; script đếm: không hành động nào có hơn 2 nút cùng hiện trên một màn hình |
| TV3-2 | Vùng chạm ≥ 44×44 trên điện thoại cho mọi điều khiển hay dùng, kể cả trong chế độ Lời (`#lv-mode-toggle`, "Gõ ChordPro"), nút đóng toast, và zoom/khoá trong Công cụ | Script đo ở 360/390 trên 3 chế độ (Bản nhạc, Lời, Công cụ mở): 0 phần tử bấm được nhỏ hơn 44 (trừ phần tử nội dòng được ghi ngoại lệ) |
| TV3-3 | Nhãn nút đổi chế độ không xuống dòng ở 360 (dùng nhãn ngắn hoặc 2 đoạn Bản nhạc \| Lời); dòng Công cụ nào cũng có chữ | Ảnh 360/390: mỗi nhãn nằm trên 1 dòng |
| TV3-4 | **Bản nhạc trên điện thoại:** ở 390 mặc định tối thiểu 2 ô nhịp mỗi hàng (zoom vừa khổ + OSMD `stretch`); thanh dưới không che khuông cuối (đệm đáy bằng chiều cao thanh) | E2E 390, bài 001–010: số ô nhịp mỗi hàng ≥ 2; khuông cuối cùng nằm hoàn toàn phía trên thanh dưới |
| TV3-5 | **B13.** Chế độ Lời & Hợp âm: gộp khoảng trắng đôi, nối âm tiết có gạch nối (`syllabic` begin/middle/end) cho đúng ("Jê-sus" thay vì "Je- sus"), hợp âm đặt trên đúng âm tiết, không tách riêng dòng chỉ có hợp âm cuối câu | Unit test trên 5 bài mẫu (001, 004, 011, 259, 614): không có "  " hay "- " giữa âm tiết; mỗi hợp âm có `x` nằm trong khoảng ±4px của âm tiết gắn với nó |
| TV3-6 | **Trợ năng:** tên truy cập cho 12 nút chỉ có icon; menu Công cụ đổi từ `role="menu"` sang `dialog`/nhóm thường; banner PWA bỏ `aria-modal`; `#song-info`, `.gig-hud-info` thành `<button>`; sửa liên kết bỏ qua (B16); sửa `class` lặp trong `admin_console.php` | axe-core ở 1366 và 390 (sáng/tối, Công cụ mở/đóng): 0 lỗi serious/critical |
| TV3-7 | **Gom CSS theo từng bước:** (a) tạo token breakpoint (`--bp-phone 680`, `--bp-tablet 1024`, `--bp-wide 1440`) và đưa 19 breakpoint về tối đa 5; (b) đưa quy tắc của `library-polish.css` vào đúng file gốc (`layout.css`/`sheet.css`/`components.css`), mỗi ticket gom một vùng (sidebar, toolbar, HUD, chế độ Lời); (c) thay `--lp-*` bằng token chung | Sau mỗi bước: ảnh chụp so pixel (tối đa 0,5% khác biệt ở 6 kích thước); số `!important` giảm theo bước, mục tiêu ≤ 120 tổng; 0 file CSS > 1.500 dòng |
| TV3-8 | Dùng một hằng số chung cho tên bộ hợp âm (`ChordSetNames.HD`, `.TLH`); thống nhất cách URL giữ `set` khi chọn TLH (`Store.js:237` và `url-state.js:46`) | E2E: chọn TLH, reload thì vẫn TLH; grep chặn tái phát `'HD'` gõ thẳng trong các file đã sửa |

### TV4 — Bảo mật và API của Thư viện (3–4 ngày) 🟠

| ID | Việc | Nghiệm thu |
|---|---|---|
| TV4-1 | **Đọc chương trình (theo Q2):** khách không thấy bản nháp và không thấy thông tin phân công (username, `chord_code`); `offline_package` đòi đăng nhập hoặc mã chia sẻ | Test HTTP: khách gọi `route=setlists` thì không có bản ghi `status=draft`, không có trường `assignments` |
| TV4-2 | `save_xml`/`restore_xml` dưới `storage/users/<owner>` chỉ cho chủ sở hữu hoặc admin | Test HTTP (storage tạm): Ban Hát A ghi vào thư mục của B thì 403 |
| TV4-3 | PUT bài hát: kiểm tra `xmlPath` bằng `resolveManagedXmlPath`; `syncSongFts` không đọc file ngoài `storage/Thanh ca` và `storage/users` | Test HTTP: PUT với `xmlPath=../../api/core/Config.php` thì 400, FTS không đổi |
| TV4-4 | **CSRF:** bật kiểm tra `X-CSRF-Token` sau cờ `csrf_enforce`; ApiService tự gửi header; khi thiếu cả `Origin` lẫn `Referer` thì từ chối request ghi | Test HTTP: POST thiếu token thì 403 khi bật cờ; E2E lưu hợp âm (DB tạm) vẫn thành công |
| TV4-5 | **Cache danh sách:** ghi nguyên tử (ghi file tạm rồi `rename`, có `LOCK_EX`); xoá cache khi đổi/xoá danh mục và trong các tool đổi nhãn/chính tả; xoá danh mục thì chuyển bài sang danh mục khác trong cùng transaction | Test: đổi tên danh mục rồi `GET route=songs` ngay thì thấy tên mới; test đọc song song khi đang ghi: không bao giờ nhận JSON hỏng |
| TV4-6 | **Hợp đồng API songs:** mọi nhánh trả `{success, data}`; không trả thông điệp PDO; `update` id không tồn tại thì 404; fallback LIKE có đủ cột `tempo`; `syncSongFts` ghi log lỗi thay vì nuốt; taxonomy trả cả `key` và `label`, server nhận cả hai; bỏ khoá trùng `kinh-tiet-ca` | Test HTTP cho từng nhánh; `tests/security/response_contract_regression.php` mở rộng |

### TV5 — Chất lượng dữ liệu Thư viện (liên tục, theo đợt) 🟡

Mọi ticket TV5 gồm: tool CLI có `--dry-run` và `--execute`, chạy trên bản sao trước, xuất bảng thay đổi, **chủ dự án duyệt**, backup, `integrity_check = ok`. Không sửa XML gốc nếu chưa có quyết định riêng.

| ID | Việc | Nghiệm thu |
|---|---|---|
| TV5-1 | **Đánh dấu độ tin cậy trên giao diện:** huy hiệu "Bản nhạc tạm (sinh từ lời & hợp âm)" cho 233 bài sinh tự động (cột mới `sheet_source` = `scanned` / `generated`), "Chưa có HD", "Chưa có tempo"; bộ lọc "Chỉ bài có hợp âm HD" | E2E: bài "ĐẤNG TẠO HOÁ" có huy hiệu; bộ lọc HD cho đúng 147 bài (theo dữ liệu hiện tại) |
| TV5-2 | **Tempo:** bỏ `custom_tempo = 80` gán cứng của importer (đặt NULL); dùng công cụ TAP sẵn có (L6-2) để ca trưởng nhập; ưu tiên 100 bài hay dùng của các tập 2–7 | Dry-run liệt kê 1.731 dòng `custom_tempo` sẽ thành NULL → duyệt → chạy; 0 bài hiện "♩ 80" giả |
| TV5-3 | **Nhãn dịp lễ/chủ đề cho danh mục 2–7** (828 bài) theo danh sách nhãn tiếng Việt chung của ROADMAP5 Phụ lục B; có thể làm hàng loạt trong Manager | Dry-run → duyệt; bộ lọc Thư viện cho kết quả ở cả 7 danh mục |
| TV5-4 | **Làm sạch metadata:** bỏ tiền tố "Nhạc và lời:" ở 218 trường tác giả; sửa lời "." của bài Tôn Vinh 241; rà tác giả bị chép mẫu (bài 259 và các bài cùng mẫu XML); rà 58 nhóm tên trùng (giữ, gộp hay ghi chú — theo **Q5**) | Báo cáo dry-run trong `docs/LIBRARY_DATA_CLEANUP_2026-10.md`; sau khi chạy: 0 tác giả còn tiền tố, 0 lời ngắn hơn 10 ký tự |
| TV5-5 | **Kế hoạch hợp âm HD:** xếp hạng bài cần HD theo mức dùng (chương trình, lượt xem); mỗi đợt 50 bài đi qua quy trình duyệt hiện có (Epic 4.2); hiện tiến độ "HD: 147/1.731" trong Manager | Bảng tiến độ trong Manager; mỗi đợt có biên bản duyệt |
| TV5-6 | **Phân đoạn bài:** thay phân đoạn heuristic của 100 bài bằng phân đoạn do người đánh dấu (công cụ sửa phân đoạn sẵn có); đánh dấu nguồn `auto` / `manual` | Giao diện chỉ hiện dải phân đoạn khi `source=manual`, hoặc hiện kèm chữ "tự động" |

### TV6 — Giao diện cũ `/old/` (theo Q1) ⚪

**Nếu Q1 = đóng băng hoặc gỡ dần (đề xuất):**

| ID | Việc | Nghiệm thu |
|---|---|---|
| TV6-1 | Ghi nhớ lựa chọn giao diện (cookie) và khi chuyển giữa hai giao diện thì mang theo `t`, `set`, `v`, không chỉ `song` | E2E: ở `/` dịch +2 rồi chuyển sang `/old/` thì vẫn +2 |
| TV6-2 | Vá an toàn tối thiểu cho `/old/`: escape `emptyMsg` (đã có ở TV0-3), chống tải chồng bài (dùng `SongLoaderCore`/token như bản mới), tìm kiếm bỏ dấu (dùng chung hàm chuẩn hoá), `role="dialog"` cho 7 modal | E2E: bấm nhanh 2 bài thì bài thứ 2 hiển thị; "chua" ra "CHÚA" |
| TV6-3 | Bỏ các nhánh `if (/old/)` trong lõi (`Store.js:429`, `ServiceWorkerManager.js:12`, `sw.js:125`) bằng cấu hình truyền từ trang (`window.__APP_PROFILE__`) | Grep: 0 lần `'/old/'` trong `assets/js/core/` và `sw.js` |
| TV6-4 | Test `/old/` kiểm toàn bộ file trong `old/` (hiện bỏ sót `chord-canvas.js` 747 dòng, `sheet.css` 1.746, `layout.css` 727); thêm 1 E2E mở bài và đổi tông | `tests/old_ui_flat_compact_regression.php` quét toàn thư mục |
| TV6-5 | Đo số người dùng `/old/` (đếm truy cập ở server, không thu dữ liệu cá nhân) trong 4 tuần để quyết định ngày gỡ | Báo cáo số liệu cho chủ dự án |

**Nếu Q1 = giữ lâu dài:** thêm TV6-6, đưa vùng chạm của `/old/` lên ≥ 44px trên điện thoại (hiện có 70+ phần tử nhỏ hơn, `#btn-switch-new-ui` chỉ 16×24) và ẩn "+ Import MusicXML" với khách.

### TV7 — Nghiệm thu thật (2–3 ngày) ✅

- Chạy toàn bộ: `php tests/run_all_tests.php`, `npm run check:syntax`, `npx eslint assets/js`, `npx playwright test` trên Chromium và WebKit.
- Thử trên **thiết bị thật**: một iPhone (Safari), một Android (Chrome), một iPad dọc, một laptop 1366. Dùng tài khoản khách, Ban Hát, Admin và HD (Hoài Dinh), **trên bản sao DB**.
- Ghi biên bản vào `docs/ROADMAP6_LIBRARY_ACCEPTANCE_REPORT.md` theo mục 4, kèm ảnh chụp, output thô và các mục chưa kiểm được.

---

## 4. THANG NGHIỆM THU (ĐO ĐƯỢC)

| Tiêu chí | Hiện tại (2026-10-17) | Đích |
|---|---|---|
| Vuốt trên danh sách mà mở nhầm bài | Có (B1) | 0 |
| Số kết quả của theme "Đời tín đồ" | 50 / 343 | 343 / 343 |
| Nút toolbar giao nhau hoặc bị cắt (1366 sidebar mở, 820) | ≥ 3 | 0 |
| Toast che tiêu đề/khuông đầu | Có | Không |
| JS / request / KB khi mở bài lần đầu | 88 / 112 / 3.384 | Theo Q6 (đề xuất ≤ 40 / ≤ 60 / ≤ 1.500) |
| API khi mở bài lần đầu | 9 | ≤ 5 |
| Cảnh báo console khi tải trang | 1 (AudioContext) | 0 |
| Phần tử bấm được < 44px ở 390 (giao diện mới, 3 chế độ) | ≥ 3 (chưa đo menu Công cụ) | 0 |
| axe-core serious/critical (1366 và 390, sáng/tối) | Chưa đo | 0 |
| `!important` trong `assets/css` | 664 | ≤ 120 |
| Số breakpoint khác nhau | 19 | ≤ 5 |
| z-index số ≥ 3000 gõ thẳng | 7 chỗ | 0 |
| Bài sinh tự động có huy hiệu | 0 / 233 | 233 / 233 |
| Bộ HD có hợp âm | 147 / 1.731 | Tăng theo đợt TV5-5, có biên bản |
| Bài có tempo thật | 100 / 1.731 | Theo đợt; 0 tempo giả |
| Khách đọc được bản nháp chương trình | Có | Không (theo Q2) |
| Tổng kết test runner nhất quán | Không (165 vs 167) | Có |

---

## 5. QUYẾT ĐỊNH CẦN CHỦ DỰ ÁN

| # | Câu hỏi | Lựa chọn | Đề xuất |
|---|---|---|---|
| Q1 | Số phận giao diện cũ `/old/`? | (a) Đóng băng, chỉ vá an toàn, đo người dùng rồi gỡ · (b) Giữ lâu dài, nâng cấp ngang bản mới · (c) Gỡ ngay | **(a)**: mỗi tính năng mới đang tốn gấp đôi công; bản cũ thiếu chống tải chồng, tìm bỏ dấu, ngoại tuyến |
| Q2 | Khách (chưa đăng nhập) được xem chương trình tới đâu? | (a) Chỉ chương trình đã phát hành, không có phân công · (b) Phải đăng nhập · (c) Giữ như hiện tại | **(a)**: vẫn cho "Theo ca trưởng" và máy chiếu hoạt động, không lộ bản nháp hay thông tin thành viên |
| Q3 | Nút ◀ ▶ đi theo thứ tự nào khi có 7 tập? | (a) Trong danh mục đang lọc · (b) Theo đúng danh sách đang hiển thị · (c) Như hiện tại (lẫn tập) | **(b)**: điều người dùng thấy là điều người dùng đi theo |
| Q4 | Số bài cho các tập không có số chính thức (Biệt Thánh Ca, NS Trương Văn Xê, Hillsongs)? | (a) Dùng thứ tự trong catalog · (b) Không có số, ẩn ô số · (c) Chủ dự án cung cấp số | Chờ chủ dự án |
| Q5 | 58 nhóm tên trùng? | (a) Giữ cả hai, ghi rõ tập · (b) Gộp bài trùng thật, giữ liên kết cũ · (c) Rà từng nhóm | **(c)**: dry-run trước; trong danh mục 1 có cặp như 276/426 cần xem bản nhạc |
| Q6 | Ngân sách hiệu năng chính thức? | Đề xuất ≤ 40 JS, ≤ 60 request, ≤ 1,5 MB, thấy bản nhạc ≤ 2,5 s trên điện thoại tầm trung với mạng 4G giả lập | Chờ chủ dự án |
| Q7 | Có hiện bài "bản nhạc tạm" trong danh sách mặc định không? | (a) Hiện, có huy hiệu · (b) Ẩn, chỉ hiện khi bật bộ lọc | **(a)**: vẫn hữu ích cho người hát theo lời và hợp âm |
| Q8 | Ai nhập HD và tempo cho các tập 2–7, và theo nhịp độ nào? | Tên người phụ trách và số bài mỗi tuần | Chờ chủ dự án |

---

## 6. THỨ TỰ THỰC HIỆN

1. Chốt các thay đổi chưa commit của phiên khác, tắt `sync.*`, tạo nhánh.
2. **TV0** (TV0-1 → TV0-8) → Checkpoint TV0.
3. Chủ dự án trả lời Q1, Q2, Q3, Q6. Có thể làm song song với bước 2.
4. **TV1** và **TV4** (độc lập, nhưng làm tuần tự vì chỉ có một người thực thi).
5. **TV2** (cần Q6) → **TV3**.
6. **TV6** theo Q1.
7. **TV5** chạy theo đợt sau khi TV5-1 (huy hiệu) xong; mỗi đợt dữ liệu cần chủ dự án duyệt.
8. **TV7** nghiệm thu.

## 7. NGOÀI PHẠM VI ĐỢT NÀY

- Không đổi bốn Core Rules (HD mặc định, tông gốc = 0, khoá TLH/HD, đồng bộ setlist).
- Không làm lại các ticket R0–R7 và L0–L6 đã đóng, trừ khi có lỗi tái hiện được (các lỗi B1–B16 ở trên đều có bằng chứng riêng).
- Không đụng Live Band, Learn, Editor, Manager, ngoại trừ phần Manager phục vụ TV5 (nhập nhãn, tiến độ HD).
- Không bundler/minify toàn bộ (P3-2 của `PHUONG_AN_TOI_UU_HE_THONG.md`) trước khi TV2-2 cho thấy tải theo nhu cầu chưa đủ đạt Q6.

---

## PHỤ LỤC A — Nguồn bằng chứng

- Kết quả test PHP: `php tests/run_all_tests.php` ngày 2026-10-17: 165 suite, 3.232 check pass, 0 fail, 79% hành vi, CSDL thật không đổi (K2 checksum PASS).
- Ảnh chụp Chromium (khách) được lưu tạm ngoài repo khi rà soát: `desk_01…06`, `ipad_01…05`, `m390_01…08`, `m360_01…05`, `old_desk_01`, `old_m390_01`. Người thực thi phải **chụp lại** ảnh "trước" của chính mình khi bắt đầu từng ticket; không dùng ảnh rà soát làm bằng chứng nghiệm thu.
- Truy vấn dữ liệu: mở `storage/data/app.sqlite` ở chế độ `SQLITE_OPEN_READONLY`. Cột thật là `xmlPath`, `defaultKey` (camelCase). Bộ hợp âm nằm ở bảng `user_chord_sets`; `storage/data/chord_sets/` chỉ là bản sao dự phòng.
