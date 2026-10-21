# SheetApp2 — Đánh Giá Tổng Thể & Lộ Trình Thành "Siêu App"

> **Vai trò người viết:** Project Manager + QA/Tester
> **Ngày rà soát:** 2026-09-24 · **Phạm vi:** toàn bộ `C:\xampp\htdocs\sheetapp2` (backend PHP, app chính, 6 sub-app, tài liệu, quy trình, triển khai)
> **Phương pháp:** đọc mã nguồn + đo số liệu (đếm dòng, grep), đọc DB ở chế độ chỉ đọc. **Chưa chạy thử trên trình duyệt** (máy không có Node.js, chưa test runtime) → các lỗi logic bên dưới là phát hiện từ code, cần tái hiện lại khi test.
> Các mục đánh dấu ✅ **đã tự kiểm chứng trực tiếp trong code**.

---

## 0. TÓM TẮT CHO NGƯỜI RA QUYẾT ĐỊNH

### Kết luận một câu
**App không "tệ" về ý tưởng hay độ rộng tính năng — nó tệ vì được xây quá nhanh, quá rộng, không có nền móng**: 7 "hòn đảo" giao diện, bảo mật gần như bằng 0, không có test, không có môi trường dev riêng, và tài liệu tự mâu thuẫn. Cảm giác "rối" của bạn là **chính xác** và có nguyên nhân đo đếm được.

### Bảng điểm

| Mảng | Điểm /10 | Nhận xét ngắn |
|---|:-:|---|
| Độ rộng tính năng | **8** | Rất nhiều tính năng, ý tưởng tốt, đúng nhu cầu ca đoàn/ban nhạc |
| Độ hoàn thiện tính năng | 5 | Nhiều tính năng "có UI nhưng không chạy thật" |
| Bảo mật | **1** | Ai cũng có thể tạo tài khoản admin mà không cần đăng nhập |
| Kiến trúc backend | 4 | MVC nửa vời, response không thống nhất, nhiều đường code chết |
| Kiến trúc frontend | 3 | Quy chuẩn viết ra nhưng code không theo (EventBus gần như không dùng) |
| UX/UI | 4 | 1 thao tác có tới 6–8 chỗ bấm; 12 modal; 7 bộ giao diện khác nhau |
| Khả năng truy cập (a11y) | 2 | Modal không có focus trap/aria |
| Dữ liệu & migration | 3 | Không có migration có phiên bản, cài mới sẽ lỗi, dữ liệu nửa DB nửa file JSON |
| Test / CI | **0–1** | Không có test tự động, không CI |
| Quy trình & triển khai | 2 | Dev = Prod, AI tự push thẳng `main`, không review |
| Tài liệu | 3 | Nhiều nhưng mâu thuẫn, ~70% là văn bản AI sinh ra |
| **Tổng thể** | **≈ 3.5/10** | Nền tảng cần "cấp cứu" trước khi thêm bất kỳ tính năng nào |

### 3 việc phải làm NGAY trong tuần này
1. **Vá lỗ hổng bảo mật P0** (mục 3.1) — hiện tại người lạ có thể chiếm quyền admin, xoá tài khoản, xoá file.
2. **Đóng băng tính năng mới (Feature Freeze)** cho tới khi xong Giai đoạn 1 (mục 7).
3. **Dừng quy tắc AI tự chạy `./sync.sh` push thẳng lên `main`**; tách môi trường dev (XAMPP local) và prod.

---

## 1. CHẨN ĐOÁN: VÌ SAO APP CẢM THẤY "RỐI VÀ TỆ"?

| # | Nguyên nhân gốc | Bằng chứng |
|---|---|---|
| 1 | **Scope creep do AI sinh tính năng theo "giai đoạn"** — mỗi báo cáo "deep analysis" đẻ ra một loạt tính năng mới trước khi tính năng cũ ổn định | 20+ mục changelog chỉ trong 09-05 → 09-11; 6 sub-app; ~15 domain backend; 4 báo cáo phân tích 35–73 KB mỗi cái |
| 2 | **7 hòn đảo, không có "vỏ app" chung** | Trang chính, `/live-band`, `/learn`, `/editor`, `/manager`, `/members`, `/huong-dan` — mỗi cái header, màu, font, cách đăng nhập riêng; sub-app chỉ có link "về trang chủ" |
| 3 | **Một hành động có quá nhiều đường vào** | Dịch giọng: 6 chỗ · Zoom: 8 chỗ · Tempo: 3 giao diện với 3 bản TAP riêng · Bật sửa hợp âm: 5 chỗ · Lưu setlist: 3 chỗ · Link tới Manager: 4 chỗ |
| 4 | **Tính năng "giả"** — UI hứa nhưng không chạy thật | Live-band: đồng bộ A-B loop, bút vẽ, 6 "trạng thái năng lượng" **không bao giờ tới máy thành viên** (server bỏ qua dữ liệu); "SATB RehearsalMix +3dB" chỉ đổi nhãn chữ; Learn: độ chính xác tập luyện cố định `100.0` |
| 5 | **Quy chuẩn viết một đằng, code một nẻo** | Quy chuẩn yêu cầu EventBus → thực tế chỉ 5 lệnh `EventBus.on` trong 29 module, ~560 lệnh gọi chéo trực tiếp; quy chuẩn "1 file CSS" → thực tế 11 file CSS; "≤400 dòng/file" → 15 file vượt, `editor.js` 4.120 dòng |
| 6 | **Không có lưới an toàn** | Không test, không CI, dev trên chính server prod, AI tự push → sửa chỗ này vỡ chỗ kia mà không ai biết (ví dụ: tính năng Import đã chết hoàn toàn ✅) |

> **Thông điệp cho PM:** vấn đề không phải thiếu tính năng. Vấn đề là **thừa tính năng chưa hoàn thiện**. Siêu app = ít đảo hơn, sâu hơn, chắc hơn.

---

## 2. ĐIỂM MẠNH (GIỮ VÀ PHÁT HUY)

1. **Hiểu đúng người dùng:** ca trưởng, ban nhạc, ca đoàn, người tập đàn — nhu cầu thực tế (tông tập, tempo tập, capo, setlist, lật trang bằng bàn đạp, máy chiếu lời).
2. **Kho dữ liệu giá trị:** ~903 bài Thánh Ca MusicXML + bộ hợp âm HD cho mọi bài. Đây là **tài sản lớn nhất** của dự án.
3. **Lõi đọc sheet khá đầy đủ:** OSMD render, auto-fit zoom, khoá zoom, compact mode 7 tuỳ chọn, transpose + gợi ý capo, metronome + TAP, phát SATB từng bè, in A4, dark mode.
4. **Hệ thống đa bộ hợp âm (HD/TLH/cá nhân) + fork/attribution** trong Manager — ý tưởng cộng tác rất tốt.
5. **`/learn` có kiến trúc tốt nhất:** dùng đúng ApiService/EventBus/Store, một đồng hồ Tone.Transport duy nhất, voicing engine, wait mode MIDI, melody practice — nên lấy làm **mẫu kiến trúc chuẩn** cho các module khác.
6. **Editor MusicXML SATB chạy được thật** (sửa nốt, phát, undo, lưu phiên bản theo user có kiểm tra quyền sở hữu phía server).
7. **SQL an toàn:** không phát hiện SQL injection — mọi giá trị đều bind.
8. **Chi phí hạ tầng thấp:** PHP + SQLite, không cần build pipeline.

---

## 3. ĐIỂM YẾU CHI TIẾT

### 3.1 🔴 BẢO MẬT (P0 — khẩn cấp)

| # | Lỗ hổng | Vị trí | Hậu quả |
|---|---|---|---|
| S1 ✅ | API user **POST/PUT/DELETE không kiểm tra đăng nhập** | `api/controllers/UserController.php:19-87` | Khách lạ gửi `{"role":"admin"}` → tạo được admin; đổi mật khẩu/xoá bất kỳ ai |
| S2 ✅ | **Mật khẩu `123456` in thẳng trên form đăng nhập** + nút đăng nhập 1-chạm vào `admin` | `includes/modals.php:200-209`, `assets/js/auth.js:281` | Ai mở trang cũng đăng nhập admin được (DB hiện tại: cả 4 tài khoản đều dùng 123456) |
| S3 | `api/init_db.php` chạy được từ trình duyệt, tạo lại tài khoản mặc định | `api/init_db.php:208-214` | Reset/tạo tài khoản admin từ URL |
| S4 | Xoá file tuỳ ý qua `xmlPath` không kiểm tra đường dẫn | `api/services/SongService.php:82, 104-106` | `xmlPath:"../../index.php"` rồi DELETE → xoá file hệ thống (kết hợp S1 = không cần đăng nhập) |
| S5 | Setlist, ghi chú, session, arrangement, learning, practice, live_sync — **ghi không cần đăng nhập, không kiểm tra chủ sở hữu** | `SetlistController.php:28-69`, `AnnotationController`, `SessionController`, `ArrangementController:54-112`, `PracticeController:42-58` | Ai cũng xoá/sửa setlist của người khác |
| S6 | **Chiếm phòng Live Band:** không gửi `hostToken` là bỏ qua kiểm tra; `create` ghi đè phòng đang chạy; mã phòng đoán được `BAND-1000…9999` | `LiveSyncService.php:117`, `:27-97`; `live-band.js:605` | Người lạ điều khiển màn hình cả ban nhạc và **máy chiếu nhà thờ** (kèm XSS ở `projector.php:273-282`) |
| S7 | **Dữ liệu nhạy cảm tải trực tiếp qua web** — `.htaccess` chỉ chặn `*.sqlite` | `storage/logs/client_errors.log` (có IP), `storage/data/live_sync/*.json` (chứa hostToken), `*.xml.bak`, `tools/`, `dashboard/knowledge-graph.json` (bản đồ toàn bộ code), mọi file `.md` — trong đó `docs/SYSTEM_DEEP_AUDIT_REPORT.md` có **user SSH + IP nội bộ server** | Lộ token, IP, cấu trúc hệ thống |
| S8 | Stored XSS nhiều nơi (`innerHTML` với dữ liệu người dùng) | `members/members.js:166-179` (display_name → chạy script trong phiên admin), `song-loader.js:388`, `admin-ui.js:86,171,246`, `projector.php:273`, `learn-app.js:249`; MusicXML lưu thô không kiểm tra (có thể nhúng `<script>` XHTML) | Chiếm phiên admin |
| S9 | Đăng ký tự do nhận luôn quyền `banhat` → được ghi đè XML, khôi phục `.bak` của bản gốc Thánh Ca, đổi thể loại bài, gắn "Ca Trưởng khuyên dùng" | `AuthController.php:42-94`, `SongController.php:137`, `ManagerService.php:437,698,877` | Phá hoại dữ liệu gốc |
| S10 | Phiên đăng nhập yếu: không `session_regenerate_id`, cookie không HttpOnly/Secure/SameSite, không CSRF, không giới hạn số lần đăng nhập sai, tài khoản "khoá" vẫn đăng nhập được, logout bằng GET | `AuthController.php:22,76` | Session fixation, CSRF, brute-force |
| S11 | Lộ lỗi nội bộ (SQL, đường dẫn) ra JSON; CORS `*` ở 2 nơi; SSRF trong import (`file://`, `localhost`) | `api/index.php:14,128`, `import_helpers.php:7-19` | Thu thập thông tin tấn công |

### 3.2 🟠 Backend & Dữ liệu

- **Import chết hoàn toàn ✅:** frontend gọi `api/import.php` (không tồn tại, `ApiService.js:91-94`); backend còn 4 lỗi fatal (`DB::pdo()` không có, `SHEETS_DIR` chưa định nghĩa, `ImportService::save` không có…).
- **CategoryController PUT/DELETE luôn lỗi 500** (gọi hàm service không tồn tại).
- **`/learn` route `learning` không dùng được:** ép `song_id` sang int trong khi ID bài là chuỗi slug.
- **OMR worker chỉ chạy trên Windows** (`start /b`) trong khi prod là Linux.
- **Bug `Response::ok($data, 'message')`:** message bị nuốt vào tham số `$pretty` — ~15 chỗ.
- **Trùng lặp chức năng:** quản lý user (UserController ↔ ManagerService), thể loại (2 nơi), xoá phiên bản (2 nơi), bộ hợp âm lưu **2 nơi** (file JSON + bảng `user_chord_sets`) đồng bộ tay → lệch dữ liệu; 3 hàm slugify.
- **`ManagerService.php` 899 dòng** — "god service".
- **Không có migration có phiên bản** (`user_version = 0`); **cài mới sẽ lỗi** (bảng `categories`, `omr_workspace` không được tạo bởi script nào).
- Thiếu khoá ngoại (xoá bài → setlist item mồ côi), thiếu index, kiểu dữ liệu lệch (`song_id` INTEGER vs TEXT).
- SQLite không bật WAL; không có backup DB tự động; `.bak` chỉ giữ 1 bản.

### 3.3 🟠 Frontend app chính

**Lỗi chức năng (tester phát hiện từ code):**

| # | Lỗi | Vị trí | Vi phạm |
|---|---|---|---|
| F1 | **Tempo Setlist bị ghi đè mỗi lần phát bài** — không `await` load, sau đó `song:loaded` reset BPM về tempo trong XML | `setlist-ui.js:361-366`, `metronome.js:27-38` | **Core Rule 4** |
| F2 | **Chuyển bài nhanh → trộn hợp âm bài A vào bài B**, sheet bài cũ render đè bài mới (không có load token / AbortController); OSMD render chồng chéo | `song-loader.js:13-120`, `chord-canvas.js:138-158,1030`, `osmd-renderer.js:282,319,352` | Core Rule 1 |
| F3 | Chọn "Tạo bộ mới" trong dropdown → set hiện tại đổi thành `__create_new_set__`, lưu hợp âm vào bộ tên rác | `toolbar.php:70` + `chord-canvas.js:1191` | Core Rule 3 |
| F4 | Service Worker trả **MusicXML cũ** sau khi sửa (stale-while-revalidate, URL không có version); cache phình vô hạn | `sw.js:71-74` | |
| F5 | Nút "Lưu vào Setlist" không lưu `chord_profile` | `song-info-bar.js:289` | Core Rule 4 |
| F6 | Dịch giọng: app giới hạn ±8 nhưng modal cho chọn ±12 → chọn 9–12 bị bỏ qua im lặng | `app.js:92,156` vs `modals.php:347` | |
| F7 | Nút tên bài & tiêu đề Gig HUD gọi `App.toggleSidebar` **không tồn tại** → bấm không có gì | `toolbar.php:8`, `sheet_viewer.php:113` | |
| F8 | `AppUI` không gắn vào `window` → một số toast không bao giờ hiện | `display-settings.js:387`, `admin-ui.js:323` | |
| F9 | Xoay màn hình/resize **bỏ qua khoá zoom** | `toolbar-controller.js:175-194` | |
| F10 | Phím tắt ngừng hoạt động khi đang focus một nút; tooltip hứa phím `[`, `]`, `S` không tồn tại; "Space" nói là cuộn nhưng thực tế lật trang | `keyboard-handler.js:47,63`, `toolbar.php:5,18` | |
| F11 | Gig mode không dùng Wake Lock/Fullscreen API → **màn hình tự tắt khi đang biểu diễn** | `app-ui.js` | |
| F12 | Capo đặt transpose = số capo — có thể **ngược chiều** (cần xác nhận nghiệp vụ) | `toolbar-controller.js:27-32` | |
| F13 | Mỗi lần mở bài gọi `chordSets.list` 2 lần, render OSMD 2 lần (auto-fit) | `chord-canvas.js:157`, `song-loader.js:96` | Hiệu năng |

**Nợ kỹ thuật:**
- 15 file > 400 dòng: `sheet.css` 2.526, `layout.css` 1.504, `chord-canvas.js` 1.373, `modals.php` 914 (chứa ~260 dòng JS nghiệp vụ inline), `setlist-ui.js` 814…
- Hàm khổng lồ: `createPopup` 283 dòng, `_placeDot` 228, `_render` (SongInfoBar) 191…
- 314 thuộc tính `style="..."` inline, 264 `!important`, z-index lên tới `2147483647`, 353 mã màu hard-code.
- Chuỗi `'HD'` hard-code 36 lần, `'default'` 46 lần; tên người thật hard-code trong `chord-canvas.js:1156`.
- 45 thẻ `<script>`, ~2.1 MB JS không nén; 9 module performance (~63 KB) tải trên trang chính cho một nút Live Sync đang bị ẩn; tự xin quyền MIDI mỗi lần tải trang.
- Đường dẫn tuyệt đối (`/api/...`, `/sw.js`) → **không chạy được ở `localhost/sheetapp2/`** (môi trường XAMPP của chính bạn).

### 3.4 🟠 UX/UI

- **Trang chính có:** 1 toolbar + 4 pill, 4 dropdown, sidebar 3 tab, song info strip, **12 modal tĩnh** + 5 overlay tạo bằng JS, panel metronome nổi, FAB kéo thả 5 nút, Gig HUD, 2 vùng chạm cạnh, nút thoát fullscreen, toast… → **quá tải nhận thức**.
- Tính năng có nhưng **không tìm thấy đường vào:** Session history, Live Sync (nút ẩn), highlight hợp âm (chỉ phím H), Import (chỉ ở màn hình chào mừng), ghi chú annotation (chỉ qua FAB).
- Khoảng giá trị mâu thuẫn: BPM 30–250 (metronome) vs 40–220 (TempoPick).
- Sidebar mất dấu tiếng Việt ("Kho Nhac", "Tim bai hat..."); hard-code "903 bài".
- **7 hệ thiết kế:** accent `#6d28d9` / `#8b5cf6` / `#6366f1` / cyan / stage-dark; font Inter / Outfit / JetBrains Mono / DM Serif; khoá dark-mode lưu 2 key khác nhau.
- A11y: chỉ 14 thuộc tính aria trên toàn bộ includes, 0 trong `modals.php`; không focus trap; 4 bộ xử lý phím Escape riêng.

### 3.5 🟠 Các sub-app

| Sub-app | Hoàn thiện | Chất lượng | Vấn đề chính | Quyết định |
|---|:-:|:-:|---|---|
| **/learn** | 7 | 7 | Tracker giả (accuracy = 100), mất phiên cuối (không xử lý `pagehide`), dữ liệu tập chỉ ghi không đọc; nút mode "chord" không có hành vi; `LEARN_FLAGS` không ai đọc; `learn-app.js` 1.546 dòng | **Giữ — làm mẫu kiến trúc** |
| **/live-band** | 5 | 3 | Polling 350ms (10 máy ≈ 29 req/s); race condition ghi đè trạng thái → thành viên **có thể lỡ lệnh đổi bài**; cue banner lặp lại vô hạn; count-in lệch 0–700ms; đèn nhịp mỗi máy chạy riêng; ~40% tính năng "đồng bộ" thực ra chỉ local; 3 engine (count-in/cue/arrangement) tải nhưng không dùng; `live-band.js` 2.195 dòng | **Giữ — đóng băng tính năng, sửa lõi đồng bộ** |
| **/editor** | 6 | 4 | 1 file `editor.js` **4.120 dòng**; không dùng ApiService/EventBus/Store; mượn sound engine của /learn; không cảnh báo khi rời trang có thay đổi chưa lưu | **Giữ — tách module** |
| **/manager** | 6 | 5 | Đảo riêng (auth/login/UI riêng, ~25 `fetch` trực tiếp); **bộ hợp âm fork không sửa được ở đâu cả**; bộ hợp âm lưu 2 nơi lệch nhau | **Giữ — làm cổng quản trị duy nhất** |
| **/members** | 4 | **1** | Backend không auth; XSS; **reset mật khẩu admin → admin bị hạ xuống banhat** (`members.js:385` + PUT mặc định role) ; mã hợp âm tự sinh có thể trùng | **Cắt — gộp vào tab Users của Manager** |
| **/huong-dan** | 7 | 6 | Quảng cáo tính năng live-band không chạy thật; số liệu hard-code | **Giữ — sửa nội dung cho đúng thực tế** |
| **/dashboard** | – | – | Không phải tính năng SheetApp — là viewer của plugin phân tích code (2.6 MB), public bản đồ toàn bộ code | **Gỡ khỏi web root** |

Trùng lặp xuyên suốt: **4 bản Web MIDI**, **3 AudioContext**, **2 hệ thống "live"** song song trên cùng backend (`live-session.js`+`performance-engine.js` ở app chính vs `live-band.js`), mỗi sub-app tự fetch XML & tự inject hợp âm (Rule 1 bị cài đặt lại nhiều lần theo nhiều cách).

### 3.6 🟠 Quy trình, tài liệu, triển khai

- **Không có git trong bản làm việc này**; `sync.sh` = `git add . && commit "Auto-sync…" && push origin main` với danh tính "AI Agent", **AI_AGENT.md bắt buộc chạy sau mỗi thay đổi mà không chờ user** → không review, không test, `git add .` đẩy cả log/dữ liệu user do `.gitignore` sai đường dẫn.
- **Dev URL = Prod URL** → đang phát triển trực tiếp trên production.
- **≥7 file chỉ dẫn AI chồng chéo** (`CLAUDE.md`, `GEMINI.md`, `.cursorrules`, `AI_AGENT.md`, `.agents/AGENTS.md`, `vibercode.md`, `CODING_STANDARDS.md`) + 3 bộ skill; `.superpowers/` **rỗng** nhưng mọi file đều bảo "đọc nó trước".
- Tài liệu mâu thuẫn: đường dẫn DB (`app.sqlite` vs `sheetapp.sqlite`), schema trong registry sai với DB thật (tên cột, bảng không tồn tại, role), changelog lộn xộn ngày tháng, còn sót mục của dự án khác ("Gas Manager, POS reporting"); `CODE_MAP.md` chỉ là danh sách tên file với route/cột bịa.
- Dockerfile không COPY source, cài `oemer` (PyTorch) vào image PHP, gói `libgl1-mesa-glx` đã bị loại khỏi Debian mới → build hỏng.
- `.htaccess`: `FilesMatch "^api/"` không bao giờ khớp (FilesMatch chỉ so tên file); không CSP; không chặn dotfile/`*.md`/`*.bak`/`*.log`/`tools/`/`storage/`.
- Không backup off-site cho DB + 98 MB MusicXML + bộ hợp âm.
- Công cụ scrape `thanhca.httlvn.org` qua Chrome CDP — **cần xác nhận bản quyền nội dung**.

---

## 4. KIỂM KÊ TÍNH NĂNG (Tester view)

| Nhóm | Tính năng | Trạng thái |
|---|---|---|
| Thư viện | Tìm tên/lời, lọc danh mục, quick jump, yêu thích, gần đây, deeplink | ✅ Hoàn chỉnh |
| Đọc sheet | OSMD render, auto-fit, zoom/khoá zoom/pinch, compact mode, in A4, dark mode | ✅ Hoàn chỉnh (lỗi F9, F13) |
| Hợp âm | HD/TLH/cá nhân, sửa trên nốt, gợi ý theo tông, undo/redo, clone | 🟡 Có bug (F2, F3) |
| Dịch giọng | ±semitone, capo gợi ý, enharmonic | 🟡 Có bug (F6, F12?) |
| Metronome | Web Audio, TAP, count-in, LED | ✅ (3 bản TAP trùng lặp) |
| Phát nhạc | SATB từng bè, tốc độ, âm lượng, mixer | ✅ |
| Auto-scroll | Tốc độ theo mức | 🟡 Chưa đồng bộ BPM/audio |
| Setlist | Tạo, thêm kèm tông/tempo, phát, in, copy slide | 🟡 Có bug nghiêm trọng (F1, F5) |
| Gig mode | HUD, chạm cạnh lật trang | 🟡 Thiếu Wake Lock |
| Ghi chú / Performance notes | Sticky note, nhật ký bài | 🟠 Khó tìm đường vào |
| Import URL/Upload/OMR | | 🔴 **Hỏng hoàn toàn** |
| Session history | | 🔴 Không có đường vào |
| Live Sync trên trang chính | | 🔴 Nút ẩn, code vẫn tải |
| Live Band | Đổi bài/tông/BPM/vị trí, roster, WakeLock, QR, pedal, pad, HUD nhạc cụ, projector | 🟡 Lõi chạy nhưng không tin cậy |
| Live Band | Đồng bộ A-B loop, ink, band state; SATB solo; in-ear split click | 🔴 **Giả / chỉ local** |
| Learn | Timeline, transport, đệm tự động, voicing, bàn phím ảo, MIDI wait mode, melody | ✅ Tốt |
| Learn | Theo dõi tiến độ, accuracy, dashboard tiến bộ | 🔴 Giả |
| Editor | Sửa SATB, phát, undo, phiên bản | ✅ (không cảnh báo mất dữ liệu) |
| Manager | Thống kê, kho nhạc, fork, recommend, phiên bản, thể loại, user | 🟡 Fork không sửa được |
| Members | | 🔴 Nguy hiểm — cắt |
| Tài khoản | Đăng nhập, đăng ký, hồ sơ, 3 role | 🔴 Bảo mật yếu |

---

## 5. ĐỊNH HƯỚNG "SIÊU APP"

### 5.1 Tầm nhìn đề xuất
> **"Nền tảng tất-cả-trong-một cho Ban Hát, Ca Đoàn & Ban Nhạc Hội Thánh: chuẩn bị → tập luyện → biểu diễn → trình chiếu — trên một tài khoản, một kho bài, một giao diện."**

Người dùng mục tiêu (persona) và câu hỏi chính họ cần app trả lời:

| Persona | Việc cần làm (Job-to-be-done) |
|---|---|
| **Ca trưởng / Trưởng ban** | Lên chương trình buổi nhóm, chọn tông/tempo, phân công người, điều khiển cả ban khi biểu diễn |
| **Nhạc công** (guitar/piano/bass/trống) | Xem đúng hợp âm ở đúng tông của mình, lật trang rảnh tay, theo kịp ca trưởng |
| **Thành viên ca đoàn** | Tập đúng bè của mình ở nhà, biết mình đã thuộc tới đâu |
| **Người tập đàn** | Học hợp âm/đệm theo bài có thật |
| **Quản trị / biên tập** | Nhập bài, sửa sheet, duyệt bộ hợp âm, quản lý thành viên |

### 5.2 Kiến trúc sản phẩm: từ 7 hòn đảo → 4 trụ cột

```
                ┌───────────── App Shell chung ─────────────┐
                │ Header · Menu user · Điều hướng · Theme   │
                └───────────────────────────────────────────┘
   ┌────────────┬──────────────┬──────────────┬──────────────┐
   │ 📚 THƯ VIỆN │ 🎤 BIỂU DIỄN │ 🎹 TẬP LUYỆN  │ 🛠 QUẢN LÝ     │
   │ & ĐỌC SHEET│ (Live)       │ (Learn)      │ (Studio)     │
   ├────────────┼──────────────┼──────────────┼──────────────┤
   │ Kho bài    │ Chương trình │ Tập bè SATB  │ Editor sheet │
   │ Đọc sheet  │ buổi nhóm    │ Tập đàn      │ Import/OMR   │
   │ Hợp âm     │ Live Sync    │ Tiến độ      │ Bộ hợp âm    │
   │ Setlist    │ Máy chiếu    │ Wait mode    │ Thành viên   │
   │            │ Gig mode     │              │ Thể loại     │
   └────────────┴──────────────┴──────────────┴──────────────┘
   Hướng dẫn (/huong-dan) → trợ giúp theo ngữ cảnh trong từng trụ cột
   Nền tảng chung: ApiService · SongLoader (Rule 1 một chỗ duy nhất) · SoundEngine · MidiInput · Auth · Design tokens
```

**Nguyên tắc UX cho siêu app:**
1. **Một hành động = một chỗ chính** (+ tối đa 1 phím tắt). Ví dụ: dịch giọng chỉ ở pill tông; zoom chỉ ở pill zoom + pinch.
2. **Chế độ theo vai trò:** "Chế độ Xem" (mặc định, tối giản) / "Chế độ Sửa hợp âm" / "Chế độ Biểu diễn". Ẩn công cụ không thuộc chế độ hiện tại.
3. **Một hệ thiết kế:** 1 bộ token (`base.css`) + biến thể `[data-theme=stage]` cho sân khấu.
4. **Không có tính năng giả:** chưa chạy thật thì không hiện nút.

---

## 6. TÍNH NĂNG CẦN PHÁT TRIỂN THÊM (SAU KHI NỀN MÓNG ỔN ĐỊNH)

Xếp theo **giá trị / công sức**. Chỉ bắt đầu từ Giai đoạn 3.

| Ưu tiên | Tính năng | Giá trị | Công sức |
|:-:|---|---|:-:|
| ★★★ | **Chương trình buổi nhóm (Service Plan)** — nâng Setlist thành chương trình có ngày, phân công người (ai hát, ai đàn), ghi chú từng mục, trạng thái xác nhận | Biến app từ "đọc sheet" thành "vận hành ban nhạc" — lý do cả ban mở app mỗi tuần | M |
| ★★★ | **Offline chắc chắn cho biểu diễn** — "Tải trước setlist" (XML + hợp âm + tông) về máy, chỉ báo đã sẵn sàng offline | Nhà thờ hay mất Wi-Fi; hiện SW còn trả dữ liệu cũ | S–M |
| ★★★ | **Live Sync thế hệ 2** — SSE (hoặc WebSocket nhỏ), trạng thái lưu nguyên tử, cue là sự kiện 1 lần, count-in theo đồng hồ server | Tính năng "WOW" duy nhất cần chạy thật mới có giá trị | M |
| ★★★ | **Máy chiếu lời tích hợp chương trình** — projector đi theo chương trình buổi nhóm, xuất lời theo slide | Thay thế ProPresenter/EasyWorship cho hội thánh nhỏ | S |
| ★★☆ | **Tập bè cho ca đoàn** — giao bài cho thành viên theo bè, track SATB (đã có ở /learn), thanh tiến độ thật, ca trưởng xem ai đã tập | Mở rộng người dùng từ ban nhạc sang toàn ca đoàn | M |
| ★★☆ | **Lịch sử sử dụng bài** — bài nào hát lần cuối khi nào, tần suất, tông hay dùng; cảnh báo lặp bài | Hỗ trợ lên chương trình | S |
| ★★☆ | **Tìm kiếm lời toàn văn (SQLite FTS5)** + tìm theo chủ đề/mùa lễ (Giáng Sinh, Phục Sinh, Tiệc Thánh…) | Tìm bài nhanh | S |
| ★★☆ | **Xuất hợp âm dạng lời + hợp âm (ChordPro / PDF)** theo tông tập | Nhạc công không đọc được khuông nhạc | S |
| ★★☆ | **Quy trình duyệt bộ hợp âm/phiên bản** — đề xuất → ca trưởng duyệt → trở thành "khuyên dùng" | Cộng tác có kiểm soát (thay vì ai cũng gắn được) | M |
| ★☆☆ | Import/OMR sửa lại + hàng đợi xử lý + màn hình kiểm tra trước khi lưu | Tăng kho bài | M–L |
| ★☆☆ | Thông báo (email/Zalo/web push) khi có chương trình mới hoặc được phân công | Tương tác | M |
| ★☆☆ | Đa hội thánh (multi-tenant) — mỗi hội thánh một không gian riêng | Chỉ khi muốn thương mại hoá/mở rộng | L |

**Nên TẠM DỪNG / không làm thêm:** ink vẽ sân khấu đồng bộ, band energy states, SATB RehearsalMix trong live-band, in-ear split, bass/piano HUD mở rộng, "organ mode", rhythm trainer — cho tới khi lõi chạy tin cậy.

---

## 7. LỘ TRÌNH TRIỂN KHAI

### Giai đoạn 0 — CẤP CỨU (Tuần 1) 🔴
**Mục tiêu: không ai lạ có thể phá hệ thống.**

- [ ] `UserController` POST/PUT/DELETE → `Auth::requireAdmin()`; PUT không mặc định `role='banhat'`
- [ ] Xoá nút đăng nhập nhanh + nhãn "Pass: 123456" trong `includes/modals.php` và `auth.js`
- [ ] **Đổi mật khẩu cả 4 tài khoản trên production**; xoá mật khẩu mặc định khỏi `members/index.php`
- [ ] `api/init_db.php`, `api/database/*`, `api/omr_worker.php`, `tools/*.php` → chỉ chạy CLI (`if (PHP_SAPI !== 'cli') exit;`)
- [ ] `.htaccess`: chặn `storage/` (trừ thư mục XML cần phục vụ), `tools/`, `docs/`, `dashboard/`, `.ua/`, `.agents/`, `.agent-skills/`, dotfile, `*.md`, `*.bak`, `*.log`, `*.json` trong storage. Tốt nhất: chuyển web root sang thư mục `public/`
- [ ] Xoá IP/SSH user khỏi `docs/SYSTEM_DEEP_AUDIT_REPORT.md`; gỡ `/dashboard` khỏi web root
- [ ] Yêu cầu đăng nhập + kiểm tra chủ sở hữu cho: setlists, annotations, sessions, arrangements, learning, practice, live_sync
- [ ] Live sync: bắt buộc hostToken cho mọi lệnh ghi; không cho `create` ghi đè phòng đang hoạt động; mã phòng ngẫu nhiên dài hơn
- [ ] Kiểm tra `xmlPath` nằm trong thư mục cho phép trước khi `unlink`/ghi
- [ ] Escape mọi `innerHTML` có dữ liệu người dùng (dùng **1 hàm escape chung** trong core)
- [ ] `session_regenerate_id(true)` khi đăng nhập/đăng ký; cookie HttpOnly + Secure + SameSite=Lax; kiểm tra `users.status` khi đăng nhập
- [ ] Đăng ký mới nhận role `viewer` (ca trưởng nâng quyền sau)
- [ ] Bỏ quy tắc AI tự chạy `./sync.sh` trong `AI_AGENT.md` / `.agents/AGENTS.md`
- [ ] Sao lưu off-site: DB + `storage/Thanh ca` + `storage/data/chord_sets` + `storage/users`

**Tiêu chí xong:** chạy bộ kiểm thử bảo mật ở mục 8.1 — tất cả đều bị từ chối.

### Giai đoạn 1 — ỔN ĐỊNH (Tuần 2–5) 🟠
**Mục tiêu: những gì đang có phải chạy đúng. Feature freeze.**

*Quy trình:*
- [ ] Khởi tạo git cục bộ, làm việc trên nhánh, review trước khi merge; môi trường dev = XAMPP local, staging = subdomain riêng
- [ ] Sửa đường dẫn tuyệt đối để app chạy được ở `localhost/sheetapp2/`
- [ ] CI tối thiểu: `php -l`, kiểm tra cú pháp JS, ESLint cơ bản, smoke test API
- [ ] Viết test tự động cho **4 Core Rules** (mục 8.2) — đây là "luật" quan trọng nhất của app, phải được máy kiểm tra
- [ ] Gộp 7 file chỉ dẫn AI → 1 file `AGENTS.md` ngắn; sửa `PROJECT_REGISTRY.md` cho đúng DB thật; chuyển các báo cáo phân tích vào `docs/archive/`

*Sửa lỗi:*
- [ ] F1 (tempo setlist bị ghi đè), F5 (thiếu chord_profile) — Core Rule 4
- [ ] F2 (race khi chuyển bài): thêm load token + AbortController; tuần tự hoá render OSMD
- [ ] F3 (dropdown "tạo bộ mới"), bỏ `onchange` inline trùng
- [ ] F4 (Service Worker): XML dùng network-first hoặc gắn version vào URL; giới hạn cache; tăng `SW_VERSION`
- [ ] F6–F11 (transpose ±, toggleSidebar, AppUI, khoá zoom khi xoay, phím tắt, Wake Lock trong Gig mode)
- [ ] Xác nhận nghiệp vụ capo (F12)
- [ ] Sửa hoặc gỡ Import; sửa CategoryController; sửa `learning` song_id; sửa `Response::ok` ~15 chỗ
- [ ] Live-band: sửa race presence (tách file presence hoặc `flock`), xoá cue sau khi phát, count-in theo `startAtServer`
- [ ] **Ẩn toàn bộ tính năng giả** (sync loop/ink/band state, SATB mix, in-ear click) cho tới khi làm thật
- [ ] Manager: cho phép sửa bộ hợp âm đã fork; chọn **1 nơi lưu** bộ hợp âm (DB) và migrate
- [ ] Migration có phiên bản (`PRAGMA user_version`), tạo đủ bảng, thêm FK/index, bật WAL
- [ ] Sửa nội dung `/huong-dan` cho khớp thực tế

**Tiêu chí xong:** 0 lỗi P0/P1 mở; checklist test hồi quy (mục 8.3) pass trên iPhone, iPad, PC.

### Giai đoạn 2 — HỢP NHẤT (Tuần 6–12) 🟡
**Mục tiêu: từ 7 đảo → 1 app 4 trụ cột.**

- [ ] **App Shell chung** (`includes/app-shell.php`): header, menu user, điều hướng Thư viện · Biểu diễn · Tập luyện · Quản lý · Hướng dẫn
- [ ] **1 hệ thiết kế:** mở rộng `base.css` + theme `stage`; bỏ palette riêng từng sub-app; thang z-index chuẩn; giảm `!important`
- [ ] **Lớp nền tảng chung trong `assets/js/core/`:** `SongLoader` (Rule 1 thực thi 1 chỗ), `SoundEngine`, `MidiInput`, `escapeHtml`; mở rộng ApiService với `manager`, `practice`, `learning`, `users.me`, `songs.getVersions`
- [ ] Xoá trùng lặp: 4 bản MIDI → 1; 3 AudioContext → 1; 2 hệ live → 1 (`live-band` là nguồn chuẩn); 3 bản TAP → 1
- [ ] **Gộp `/members` vào tab Users của `/manager`**; Manager dùng auth chung
- [ ] Đơn giản hoá trang chính theo "chế độ" (Xem / Sửa hợp âm / Biểu diễn): gom 12 modal, bỏ FAB hoặc toolbar trùng chức năng, 1 hành động = 1 chỗ
- [ ] Tách file lớn theo mô hình thư mục của `/learn`: `editor.js` (4.120) → `live-band.js` (2.195) → `manager.js` (1.813) → `chord-canvas.js` (1.373); chuyển JS inline trong `modals.php` ra module
- [ ] A11y: modal `role="dialog"`, focus trap, 1 bộ quản lý Escape chung
- [ ] Minify/bundle nhẹ (hoặc ít nhất gộp file) — giảm 45 script tag

**Tiêu chí xong:** người dùng đi từ Thư viện → Biểu diễn → Tập luyện → Quản lý mà không thấy "đổi app"; không file JS > 600 dòng.

### Giai đoạn 3 — NÂNG CẤP GIÁ TRỊ (Tháng 4–6) 🟢
- [ ] Live Sync thế hệ 2 (SSE/WebSocket) — kiểm thử với 10 thiết bị thật
- [ ] Chương trình buổi nhóm (Service Plan) + phân công
- [ ] Offline setlist cho biểu diễn
- [ ] Máy chiếu lời theo chương trình
- [ ] Tìm kiếm FTS5 + chủ đề/mùa lễ
- [ ] Theo dõi tiến độ tập thật trong /learn (accuracy thật, đọc lại dữ liệu, dashboard)

### Giai đoạn 4 — SIÊU APP (Tháng 7+) 🔵
- [ ] Tập bè ca đoàn có giao bài & theo dõi
- [ ] Quy trình duyệt bộ hợp âm/phiên bản
- [ ] Xuất ChordPro/PDF, lịch sử sử dụng bài
- [ ] Thông báo; cân nhắc multi-tenant nếu mở rộng ra nhiều hội thánh

---

## 8. KẾ HOẠCH KIỂM THỬ (QA)

### 8.1 Test bảo mật (phải FAIL — tức bị từ chối — sau Giai đoạn 0)
| # | Kịch bản | Kỳ vọng |
|---|---|---|
| SEC-01 | Không đăng nhập, `POST api/index.php?route=users` với `role:"admin"` | 401/403 |
| SEC-02 | Không đăng nhập, `PUT ?route=users` đổi mật khẩu user id=1 | 401/403 |
| SEC-03 | Mở `/api/init_db.php` trên trình duyệt | 403/404 |
| SEC-04 | Tải `/storage/logs/client_errors.log`, `/storage/data/live_sync/*.json`, `/CLAUDE.md`, `/tools/check_db.php`, `/dashboard/` | 403/404 |
| SEC-05 | User A xoá setlist của user B | 403 |
| SEC-06 | Gửi `live_sync update` không kèm hostToken | 403 |
| SEC-07 | Đăng ký với `display_name = <img src=x onerror=alert(1)>`, admin mở trang quản lý thành viên | Hiện chữ thô, không chạy script |
| SEC-08 | Admin cập nhật bài với `xmlPath:"../../index.php"` rồi xoá | Bị từ chối, `index.php` còn nguyên |
| SEC-09 | Đăng nhập sai 10 lần liên tiếp | Bị khoá tạm |
| SEC-10 | Session ID trước và sau đăng nhập | Khác nhau |

### 8.2 Test Core Rules (tự động hoá)
| # | Kịch bản | Kỳ vọng |
|---|---|---|
| CR1-a | Mở bài có HD > 0 hợp âm | Hiện HD, ẩn TLH |
| CR1-b | Mở bài có HD rỗng | Hiện TLH gốc, không inject map rỗng |
| CR2-a | Dịch +3, chuyển sang bài khác từ thư viện | Tông = 0 |
| CR2-b | Mở bài từ setlist có transpose = +2 | Tông = +2 |
| CR3-a | Đăng nhập admin, mở dropdown bộ hợp âm | Không có nút xoá cho HD và TLH |
| CR3-b | Xoá bộ cá nhân đang chọn | Quay về HD |
| CR4-a | Setlist item BPM = 90, bài XML tempo = 72, bấm phát | Metronome = 90, chip hiện 90 |
| CR4-b | Lưu vào setlist từ SongInfoBar | Lưu đủ tông + BPM + chord_profile |
| CR4-c | Tài khoản không phải admin | Vẫn thấy & dùng được nút Lưu Tập |

### 8.3 Test hồi quy thủ công (mỗi lần phát hành) — iPhone Safari, iPad Safari, Chrome PC
- Chuyển nhanh 5 bài liên tiếp (dưới 1 giây/bài) → hợp âm và sheet đúng bài cuối
- Khoá zoom 140% → xoay iPad → vẫn 140%
- Sửa sheet trong Editor → mở lại ở trang chính → thấy bản mới (không bị cache cũ)
- Gig mode 10 phút không chạm → màn hình không tắt
- Live band 1 host + 5 follower: đổi bài 20 lần → 100% follower đổi đúng, cue không lặp lại
- Tắt Wi-Fi sau khi tải setlist → vẫn mở được mọi bài trong setlist
- F12 Console: 0 lỗi đỏ trên cả 4 trụ cột

---

## 9. QUY TRÌNH LÀM VIỆC MỚI (GOVERNANCE)

1. **Feature Freeze** cho tới hết Giai đoạn 1. Mọi ý tưởng mới ghi vào backlog, không code.
2. **Definition of Done** cho mọi thay đổi: code review ✔ · test tự động pass ✔ · test trên iPhone + iPad ✔ · 0 lỗi console ✔ · tài liệu cập nhật đúng thực tế ✔.
3. **AI agent là trợ lý, không phải người merge:** AI làm trên nhánh, con người duyệt rồi mới merge/deploy. Bỏ auto-push.
4. **Một nguồn sự thật cho tài liệu:** `README.md` (sản phẩm), `AGENTS.md` (quy tắc cho AI, ngắn), `PROJECT_REGISTRY.md` (bản đồ + changelog theo đúng thứ tự thời gian), `ROADMAP.md` (lấy từ mục 7 của file này). Không sinh thêm báo cáo "deep analysis" mới cho tới khi backlog cũ được xử lý.
5. **Không có tính năng giả trên UI.** Chưa chạy thật → ẩn sau cờ tính năng (feature flag).
6. **Họp rà soát 2 tuần/lần:** xem bảng điểm mục 0, cập nhật trạng thái các checkbox mục 7.

---

## 10. KPI ĐO TIẾN BỘ

| Chỉ số | Hiện tại | Mục tiêu sau GĐ 1 | Mục tiêu sau GĐ 2 |
|---|---|---|---|
| Lỗ hổng P0 mở | 11 | 0 | 0 |
| Test tự động | 0 | ≥ 30 (API + Core Rules) | ≥ 80 |
| File JS > 1.000 dòng | 5 | 5 | 0 |
| Số lệnh `fetch()` ngoài ApiService | ~45 | ≤ 10 | 0 (trừ file tĩnh) |
| Số "hòn đảo" giao diện | 7 | 6 | 1 app / 4 trụ cột |
| Số modal trên trang chính | 12 + 5 | 12 | ≤ 6 |
| Số chỗ để dịch giọng / zoom | 6 / 8 | 6 / 8 | 2 / 2 |
| Tính năng giả hiện trên UI | ~8 | 0 | 0 |
| Live sync: tỉ lệ follower nhận đúng lệnh đổi bài (10 máy) | chưa đo | ≥ 99% | ≥ 99.9% |
| Điểm tổng thể | ~3.5 | 6 | 8 |

---

## PHỤ LỤC A — File lớn nhất cần tách

| File | Dòng |
|---|--:|
| `editor/editor.js` | 4.120 |
| `assets/css/sheet.css` | 2.526 |
| `editor/editor.css` | 2.455 |
| `live-band/live-band.js` | 2.195 |
| `live-band/live-band.css` | 2.067 |
| `learn/learn.css` | 2.006 |
| `manager/manager.js` | 1.813 |
| `assets/js/learn/learn-app.js` | 1.546 |
| `assets/css/layout.css` | 1.504 |
| `manager/manager.css` | 1.488 |
| `assets/js/chord-canvas.js` | 1.373 |
| `includes/modals.php` | 914 |
| `api/services/ManagerService.php` | 899 |
| `assets/js/setlist-ui.js` | 814 |

## PHỤ LỤC B — Câu hỏi cần chủ dự án trả lời

1. Production hiện tại có còn dùng mật khẩu `123456` không? (Nếu có → đổi ngay hôm nay.)
2. Capo: khi chọn capo 2, bạn muốn transpose = **+2** hay **−2**? (Code hiện đặt +2.)
3. Người đăng ký mới nên có quyền gì mặc định: `viewer` hay `banhat`?
4. Nội dung scrape từ `thanhca.httlvn.org` đã được phép sử dụng chưa?
5. App phục vụ **một** hội thánh hay định mở cho **nhiều** hội thánh? (Quyết định kiến trúc multi-tenant.)
6. Dự án có repo GitHub `haiyenpa25/sheetapp2` — bản ở máy này có đang khớp với bản trên server không?

---
> ⚠ **Lưu ý bảo mật cho chính file này:** file liệt kê chi tiết các lỗ hổng chưa vá. Hiện `.htaccess` **không chặn** file `.md`, nên nếu file này được đẩy lên server production nó sẽ đọc được công khai. Hãy hoàn thành Giai đoạn 0 (chặn `*.md`) trước khi đồng bộ file này lên server, hoặc giữ nó ngoài web root.
