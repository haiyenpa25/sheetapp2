# Rà soát dự án SheetApp — đánh giá, lỗi phát hiện và phương án (2026-10-31)

> Viết cho: chủ dự án (để xem và quyết định cải thiện sau).
> Phạm vi: chỉ rà soát và đề xuất, KHÔNG sửa mã. Số liệu lấy từ kho mã tại commit `00fc1f7` (nhánh `main`) và từ bộ test chạy ngày 2026-10-31.
> Quy ước: **[Đã kiểm]** = tôi đã chạy/đo trực tiếp; **[Chưa kiểm]** = suy luận từ mã, cần xác nhận trước khi làm.

---

## 1. Tóm tắt nhanh

| Hạng mục | Tình trạng |
|---|---|
| Chức năng lõi (đọc nhạc, dịch tông, hợp âm HD, setlist) | Chạy ổn trên Modern và Classic; vừa sửa 3 lỗi hiển thị/UX trong phiên này |
| Kiểm thử | 249 suite; 223–231 đạt, 17–25 lỗi. Lỗi còn lại phần lớn là **môi trường/dữ liệu sống**, không phải lỗi mã (xem mục 4) |
| Rủi ro cao nhất | Nút "Đồng bộ GitHub" cho phép `git commit` + `git push` từ một yêu cầu web (mục 3.1) |
| Nợ kỹ thuật lớn nhất | CSS rất lớn (nhiều file 2.000–3.300 dòng), hai giao diện Modern/Classic song song, dữ liệu người dùng lẫn trong kho Git |
| Quy trình | Tốt: có luật bất biến (`RULE.md`), test hồi quy cho từng lỗi, `PROJECT_REGISTRY.md` được cập nhật đều |

---

## 2. Những gì đã làm trong phiên này (đã đẩy lên `main`)

1. **Menu danh sách bài biến mất khi gõ tìm trên máy tính bảng Android** — bàn phím ảo bắn `resize`/`orientationchange` giả làm đóng sidebar. Sửa ở Modern và Classic (chỉ coi là xoay thật khi bề rộng đổi ≥100px và không đang nhập liệu).
2. **Chống bản cũ bị cache** — script nạp lười, trang Quản lý, trang in nay có `?v=` theo thời điểm sửa file. Không nâng phiên bản service worker (tránh xoá gói offline Chủ nhật của người dùng).
3. **Dịch tông sinh ♮/♯/♭ thừa** — OSMD ghi tên nốt không theo tông mới. Thêm `assets/js/osmd-transpose-speller.js`, áp dụng cả hai giao diện.
4. **Về tông gốc vẫn còn dấu bình** — OSMD giữ khoá nhạc đã dịch trong bản vẽ khi trừ về 0; nay về 0 thì dựng lại từ XML gốc.
5. Combobox danh mục thay dải chip, hệ cỡ/icon đồng nhất, thêm bài XML có sửa tên, ghi chú ban nhạc/nhạc cụ, sửa Tông và Toàn màn hình trên điện thoại (từ các phiên trước, gộp trong cùng đợt push).

Bằng chứng chính: test mới `android_keyboard_sidebar_regression`, `osmd_transpose_speller_regression` (2.100 nốt), cùng kiểm bằng Chromium thật trên 4 bài × 3 chuỗi dịch × 2 giao diện.

---

## 3. Phát hiện và đánh giá rủi ro

Mức: 🔴 cao · 🟠 trung bình · 🟡 thấp.

### 3.1 🔴 Đồng bộ GitHub chạy từ yêu cầu web — [Đã kiểm mã]
- `ManagerController` action `sync_library` → `LibrarySyncService::syncAll($pushGit)` → `exec("git add … && git commit … && git push origin main")` ngay trong tiến trình web (`api/services/LibrarySyncService.php`, quanh dòng 316–322).
- Quyền: đã bọc `Auth::requireAdmin()`, nên chỉ Admin gọi được. Nhưng:
  - Tài khoản Admin bị lộ ⇒ kẻ xấu có thể đẩy commit tuỳ ý lên `main` bằng khoá Git của máy chủ.
  - `git add` có thể kéo cả file không mong muốn (dữ liệu người dùng, XML riêng tư) vào lịch sử công khai — **không thể xoá hẳn** sau khi push.
  - Trái với luật dự án "không tự ý push" (`AI_AGENT.md` §1.7).
  - Một lệnh dài chạy trong request web có thể treo worker PHP; không có khoá chống chạy song song [Chưa kiểm].
- **Phương án**: (A, khuyến nghị) bỏ push khỏi web — nút chỉ sinh seed/manifest, việc commit/push do người chạy tay `tools/sync_library_github.php --push` trên máy dev. (B) Giữ lại nhưng: danh sách file `git add` cố định (allow-list), khoá file chống chạy song song, ghi audit log, tắt mặc định bằng cờ `FeatureFlags`, dùng deploy key chỉ-ghi-một-nhánh.

### 3.2 🔴 Dữ liệu người dùng nằm trong kho Git — [Đã kiểm]
- `git ls-files storage` có **1.455 file `storage/data/chord_sets/*`** và hàng trăm XML trong `storage/Thanh ca/`. `.gitignore` chặn `storage/data/*` nhưng các file này đã được theo dõi từ trước nên vẫn bị `git status` báo "M" mỗi khi người dùng sửa hợp âm trên web (ví dụ `thanh-ca-038/HD.json` sửa lúc 16:35 hôm nay).
- Hậu quả: mọi commit từ máy dev dễ vô tình kéo theo hoặc xung đột với dữ liệu sống; test "khớp manifest phát hành" liên tục đỏ khi người dùng sửa HD trên web (xem mục 4).
- **Phương án**: tách rõ hai loại dữ liệu — (1) *seed phát hành* (đã có `storage/seed/library.sqlite` + manifest) là thứ duy nhất nằm trong Git; (2) *dữ liệu vận hành* ra khỏi Git (`git rm --cached`) và sao lưu riêng. Test manifest nên đọc từ bản seed, không đọc thư mục sống.

### 3.3 🟠 Hai giao diện song song (Modern + Classic) nhân đôi công việc — [Đã kiểm]
- `old/` là bản sao rút gọn nhưng nhiều module có hai bản (`osmd-renderer.js`, `toolbar-controller.js`, `app-ui.js`, `library-ui.js`…). Mỗi lỗi phải sửa hai lần; trong phiên này cả 3 lỗi đều cần vá ở cả hai nơi, và lỗi "về tông gốc" chỉ Modern mắc.
- Rủi ro: hai bản dần lệch hành vi; test chỉ phủ một phần.
- **Phương án**: quyết định chính sách rõ ràng — hoặc (A) đóng băng Classic (chỉ sửa lỗi nghiêm trọng, ghi vào `RULE.md`), hoặc (B) hợp nhất dần các module chung lên `assets/js/` và để Classic chỉ khác phần giao diện (`old/` hiện đã fallback sang `assets/js/` cho file không tồn tại — đây là hướng tốt, mở rộng thêm).

### 3.4 🟠 CSS quá lớn và có luật chồng chéo — [Đã kiểm]
- `layout.css` 3.355 dòng, `sheet.css` 3.244, `library-polish.css` 2.575, `learn.css` 2.566, `editor.css` 2.455, `live-band.css` 2.256. Quy ước dự án nói "một file `sheet.css`, dưới 600 dòng/file" — **không còn đúng với CSS**; chỉ JS/PHP tuân thủ.
- Đã gặp trong phiên: luật `display:grid !important` của `control-deck.css` thắng luật ẩn khác; toast che nút; thanh đáy che HUD. Dùng `!important` để thắng nhau là dấu hiệu CSS khó kiểm soát.
- **Phương án**: (1) chia theo thành phần (`library/`, `toolbar/`, `sheet/`, `modals/`) với giới hạn dòng như JS; (2) đo số `!important` và đặt trần giảm dần; (3) dùng token chung (`--lp-h`, `--o-h` đã có) cho mọi kích thước/chữ — mở rộng ra toàn bộ nút.

### 3.5 🟠 Kiểm thử: nhiều test phụ thuộc môi trường/dữ liệu sống — [Đã kiểm]
- Nhóm lỗi cố định ở mọi lần chạy (không do mã mới): `tests/http/*` (cần máy chủ HTTP và cổng), `library_l61/l62/l63`, `r35`, `r37`, `l27`, `pointer_tap`, `reported_xss`, `chordpro_export`, `liturgical_export_and_usage`, `auxiliary_guards`.
- Nhóm lỗi do dữ liệu sống: các test kiểm tra "JSON chord_sets khớp manifest" (`library_bundle`, `l52`–`l59`) đỏ ngay khi một người dùng sửa HD trên web.
- `bug02_to_07_backend_medium` đạt 12/12 nhưng bị gắn cờ do cảnh báo PHP `headers already sent` (từ `http_response_code()` sau khi test đã in) — [Chưa kiểm xem có sẵn ở bản cũ].
- Ngân sách "dưới 600 dòng" được kiểm bằng cách đếm cả dòng cuối (nên `wc -l` phải ≤ 598) — dễ gây lỗi khó hiểu cho người mới (vừa vấp 2 lần trong phiên này).
- **Phương án**: (1) tách bộ test thành 3 nhóm chạy riêng: *offline thuần* (bắt buộc xanh trước merge), *cần dữ liệu seed cố định*, *cần máy chủ HTTP*; (2) test manifest dùng bản sao seed, không đọc `storage/data` thật; (3) sửa 10–12 suite lỗi cố định hoặc gắn nhãn `known-fail` kèm lý do và hạn xử lý; (4) ghi rõ cách đếm dòng vào `CODING_STANDARDS.md`.

### 3.6 🟠 Dịch tông: còn khả năng lệch giữa nốt nhạc và hợp âm chữ — [Chưa kiểm sâu]
- Có **hai nơi** cùng quyết định tên hợp âm: OSMD (nốt + hợp âm trong XML) và `transpose-engine.js`/`TransposeHelper.php` (hợp âm HD phủ lớp). `RULE.md` có quy tắc "không bao giờ A#/G#/D# cho trưởng", nhưng bộ viết tên mới (`osmd-transpose-speller.js`) dùng quy tắc *gần tông mới nhất* — hai cách có thể cho tên khác nhau ở nốt ngoài thang âm (ví dụ chữ hợp âm HD là `Bb` nhưng XML hiện `A#`).
- Tông thứ (minor) chưa có test hành vi riêng ở mức hiển thị; test mới phủ 12 tông trưởng.
- **Phương án**: một nguồn sự thật cho cách ghi tên (module `KeyService`/speller dùng chung cho cả hợp âm HD); thêm test 12 tông thứ + hợp âm slash; thêm kiểm đối chiếu tên hợp âm HD với tên OSMD sau dịch.

### 3.7 🟡 Hiệu năng và độ tin cậy — [Chưa kiểm]
- Về tông gốc nay dựng lại từ XML (chậm hơn dịch tại chỗ khoảng một lần parse). Chấp nhận được, nhưng nên đo trên bài dài và máy yếu.
- Mỗi lần mở bài tải nhiều module nạp lười; sau khi thêm `?v=` theo `filemtime`, **mọi lần sửa một file JS dùng chung sẽ đổi version của tất cả** (hàm lấy mtime lớn nhất) → người dùng tải lại toàn bộ. Nên cân nhắc băm nội dung từng file (đã có cho service worker) thay vì một version chung.
- `sw.js` + manifest sinh lại phải chạy mỗi khi đổi asset (`tools/generate_sw_manifest.php`); dễ quên. Nên đưa vào bước kiểm bắt buộc (test đã có một phần).

### 3.8 🟡 Tài liệu và gọn kho — [Đã kiểm]
- 13 file `.md` ở thư mục gốc (`AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `AI_AGENT.md`, 4 roadmap…) với nội dung chồng lấn; `docs/` có >30 mục. Người mới khó biết đọc cái nào trước.
- File rác: `storage/data/songs.json.bak`, `storage/backups/` 82 MB (đã bỏ khỏi Git nhưng chiếm đĩa); `storage/Thanh ca/` 159 MB trong Git (gói pack ~26 MB, chấp nhận được hiện tại nhưng sẽ phình khi thêm XML).
- **Phương án**: một `README` mục lục trỏ tới 3 file cốt lõi (`AI_AGENT.md`, `RULE.md`, `ROADMAP.md`); chuyển roadmap đã xong sang `docs/history/`; đặt chính sách xoá backup quá N ngày.

### 3.9 🟡 Bảo mật nền — [Chưa kiểm sâu]
- Có điểm tốt đã thấy: `.htaccess` chặn `storage/` (trừ `Thanh ca/`), chặn XML riêng tư, kiểm quyền xem theo mã bài (`SongAccessGuard`), log lỗi client có Origin/CSRF + hạn mức.
- Cần rà tiếp: cờ cookie phiên (`Secure`, `HttpOnly`, `SameSite`) ở môi trường thật; giới hạn thử mật khẩu đăng nhập; `exec()` còn lại trong `LibrarySyncService` (mục 3.1); thư mục `node_modules/` nằm cùng cây web — kiểm tra đã bị chặn truy cập qua web.
- **Phương án**: chạy một đợt `security-review` riêng cho `api/` + `.htaccess`, bổ sung test cho các điểm trên.

---

## 4. Kết quả kiểm thử đầy đủ lần cuối — [Đã kiểm]

Chạy `php tests/run_all_tests.php` (không `--strict`), bản có đủ sửa lỗi của phiên này:
- **Lỗi cố định/môi trường (có từ trước)**: `auxiliary_guards`, `chordpro_export`, `tests/http/live_sync_*` (3), `tests/http/song_search_contract`, `tests/http/web_surface`, `library_l27`, `l61`, `l62`, `l63`, `r35`, `r37`, `liturgical_export_and_usage`, `pointer_tap`, `reported_xss`.
- **Lỗi do dữ liệu sống vào 16:35 (không phải mã)**: `library_bundle`, `library_l52`, `l53`, `l54`, `l57`, `l58`, `l59` — vì `thanh-ca-038/HD.json` bị người dùng sửa.
- Cơ sở dữ liệu thật được runner kiểm toàn vẹn: PASS.
- Lưu ý: runner báo `thanh-ca-038` đã khác git; tôi **không** commit/hoàn tác file đó.

---

## 5. Phương án cải thiện đề xuất (theo thứ tự ưu tiên)

| # | Việc | Mức | Công sức | Lý do |
|---|---|---|---|---|
| 1 | Gỡ `git push` khỏi yêu cầu web (3.1) | 🔴 | Nhỏ | Giảm bề mặt tấn công và rủi ro lộ dữ liệu vào lịch sử Git |
| 2 | Đưa dữ liệu vận hành (`chord_sets`, ghi chú) ra khỏi Git, giữ seed (3.2) | 🔴 | Vừa | Hết xung đột/nhiễu, test manifest ổn định |
| 3 | Chia bộ test thành 3 nhóm; sửa hoặc gắn nhãn 17 suite lỗi cố định (3.5) | 🟠 | Vừa | Cổng chất lượng hiện "luôn đỏ" nên mất ý nghĩa cảnh báo |
| 4 | Quyết định chính sách Classic: đóng băng hay hợp nhất (3.3) | 🟠 | Nhỏ (quyết định) | Giảm một nửa công vá lỗi lặp |
| 5 | Một nguồn sự thật cho tên nốt/hợp âm sau dịch + test 12 tông thứ (3.6) | 🟠 | Vừa | Tránh lệch giữa nốt trong bản nhạc và chữ hợp âm HD |
| 6 | Chia nhỏ CSS, đặt trần `!important` (3.4) | 🟠 | Lớn | Các lỗi chồng luật CSS đã xuất hiện nhiều lần |
| 7 | Version theo băm từng file thay vì mtime lớn nhất (3.7) | 🟡 | Nhỏ | Ít buộc tải lại toàn bộ mỗi lần phát hành |
| 8 | Dọn tài liệu gốc + chính sách xoá backup (3.8) | 🟡 | Nhỏ | Dễ vào dự án, đỡ tốn đĩa |
| 9 | Đợt rà bảo mật riêng cho `api/` và `.htaccess` (3.9) | 🟡 | Vừa | Xác nhận các điểm [Chưa kiểm] |
| 10 | **Đăng nhập: "Ghi nhớ trên thiết bị"** cho cả Modern và Classic (mục 8) | 🟠 | Vừa | Hiện phiên mất khi đóng trình duyệt; người chơi phải đăng nhập lại mỗi buổi |
| 11 | **Hợp âm: luôn vào bộ HD cho mọi tài khoản** (mục 9) | 🟠 | Nhỏ | Đảm bảo luật cốt lõi đúng cả khi có `?set=`, setlist, bộ cá nhân |

Gợi ý lộ trình: **Tuần 1** làm #1, #2, #4, #10, #11 (quyết định + việc nhỏ); **Tuần 2** làm #3, #5; **sau đó** #6–#9 chen vào các đợt sửa tính năng.

---

## 6. Những điều cần chủ dự án quyết định

1. Có giữ nút "Đồng bộ GitHub" trên web không? (khuyến nghị: bỏ phần push)
2. Dữ liệu hợp âm do người dùng sửa trên web có được phép đồng bộ ngược về GitHub không, và nếu có thì ai duyệt?
3. Classic `/old/` sẽ được giữ bao lâu và ở mức hỗ trợ nào?
4. Chấp nhận để bộ test có nhóm "known-fail" tạm thời kèm hạn xử lý, hay phải xanh 100% mới được merge?
5. "Ghi nhớ đăng nhập" giữ bao lâu (đề xuất 30 ngày) và có cho Admin tự bật được không? (mục 8)
6. Có cần cho phép mở bài ở bộ cá nhân thay HD theo lựa chọn của người dùng không, hay HD tuyệt đối? (mục 9)

---

## 7. Giới hạn của bản rà soát này

- Tôi không chạy thử trên thiết bị Android/iPad thật; kết quả giao diện đến từ Chromium giả lập và test VM.
- Các mục đánh dấu **[Chưa kiểm]** là suy luận từ mã; cần xác nhận trước khi đầu tư công sức.
- Không đo hiệu năng thực tế (thời gian dựng bản nhạc, kích thước tải) trong đợt này.
- Danh sách ">600 dòng" chỉ tính JS/PHP/CSS ngoài `vendor`, `node_modules`, `storage`.

---

## 8. Bổ sung: Đăng nhập có "Ghi nhớ trên thiết bị" (Modern + Classic)

### 8.1 Hiện trạng — [Đã kiểm mã]
- Phiên đăng nhập là **cookie phiên thuần**: `api/core/Session.php` đặt `'lifetime' => 0` ⇒ cookie mất khi đóng trình duyệt/ứng dụng (trên iPad/Android PWA nhiều khi mất ngay khi hệ điều hành thu hồi tiến trình).
- Phía máy chủ phiên PHP sống theo `session.gc_maxlifetime` (đo ở CLI: 14.400 giây = 4 giờ; **cấu hình PHP của web chưa kiểm**) — tức là kể cả giữ tab, nghỉ quá hạn này cũng bị đăng xuất.
- Không có ô "Ghi nhớ" ở cả hai giao diện: Modern (`includes/modals.php`, `assets/js/auth.js`) và Classic (`old/includes/modals.php`, `old/assets/js/auth.js`) chỉ có tên đăng nhập + mật khẩu. `ApiService.auth.login({ username, password })` không có tham số ghi nhớ; `AuthController` `login` không tạo token dài hạn.
- Trình duyệt chỉ nhớ nhờ trình quản lý mật khẩu (có `autocomplete="username/current-password"`), không phải tính năng của ứng dụng.

### 8.2 Phương án đề xuất (an toàn, không lưu mật khẩu ở máy)
**Không** lưu mật khẩu trong `localStorage`. Dùng **token ghi nhớ dạng selector + validator** (chuẩn "remember me"):

1. **CSDL**: bảng `auth_remember_tokens(id, user_id, selector, validator_hash, user_agent_hash, created_at, last_used_at, expires_at, revoked_at)`; chỉ lưu **băm** của validator (SHA-256), không lưu validator thô. Cần migration (có runbook sẵn: `docs/DATABASE_MIGRATION_RUNBOOK.md`).
2. **Đăng nhập**: thêm hộp kiểm "Ghi nhớ trên thiết bị này" (mặc định tắt trên máy dùng chung). Khi bật, máy chủ phát cookie `HttpOnly; Secure; SameSite=Lax; Max-Age=30 ngày` chứa `selector:validator`.
3. **Tự đăng nhập lại**: khi không có phiên mà có cookie hợp lệ ⇒ tạo phiên mới, **xoay vòng** token (phát validator mới, huỷ cái cũ). Nếu `selector` đúng mà validator sai ⇒ coi là bị đánh cắp, huỷ **mọi** token của người dùng đó.
4. **Đăng xuất / đổi mật khẩu / Admin khoá tài khoản** ⇒ huỷ token tương ứng; thêm mục "Đăng xuất mọi thiết bị" trong Quản lý → Thành viên.
5. **Phiên PHP**: đặt `session.gc_maxlifetime` ≥ 8 giờ khi phiên đang dùng; khi chơi nhạc, gọi nhẹ `auth?action=me` định kỳ (đã có kiểu gọi này) để làm mới.
6. **Giao diện** (đối xứng Modern/Classic): cùng một đoạn HTML hộp kiểm trong `modals.php` của cả hai; `auth.js` gửi cờ `remember: true`; hiển thị ngày hết hạn trong hộp thoại tài khoản; nút to đủ chạm (≥36px) theo chuẩn mobile của dự án.
7. **Bảo mật bổ sung**: giới hạn số lần đăng nhập sai theo IP + tài khoản; ghi `audit.log`; chỉ bật khi HTTPS; token gắn băm `User-Agent` để cảnh báo khi đổi thiết bị.

### 8.3 Việc cần làm (ước lượng) và kiểm thử
- Backend: migration + `RememberTokenService` + sửa `AuthController`/`Session` (nhỏ–vừa). Frontend: 2 `modals.php` + 2 `auth.js` + `ApiService.auth.login` (nhỏ).
- Test cần có: (a) đăng nhập có ghi nhớ → xoá cookie phiên → vẫn đăng nhập lại được; (b) token dùng lần hai sau xoay vòng bị từ chối và huỷ chuỗi; (c) đăng xuất huỷ token; (d) đổi mật khẩu huỷ mọi token; (e) hết hạn 30 ngày thì không vào được; (f) không bao giờ có mật khẩu/validator thô trong CSDL, log, `localStorage`; (g) cả hai giao diện hiển thị hộp kiểm và hoạt động; (h) cookie có `HttpOnly`, `Secure`, `SameSite`.
- Rủi ro: máy dùng chung (thư viện, nhà thờ) — để mặc định **tắt** và nhắc rõ khi bật.

---

## 9. Bổ sung: Hợp âm mặc định HD cho tất cả tài khoản

### 9.1 Luật hiện hành — [Đã kiểm mã]
- `RULE.md`/`AI_AGENT.md` Core Rule 1: mọi bài mở ra đều vào bộ **HD**; HD rỗng ⇒ bản nhạc sạch (cờ `AppRules.HD_EMPTY_SHOWS_TLH = false`).
- Trong mã: `SongLoader.load(song, transpose, profileOverride = 'HD')` và `ChordCanvas.loadSong(songId, initialSet = 'HD')` đều rơi về `'HD'` khi không truyền gì — **không có chỗ nào tự chọn bộ cá nhân theo `chord_code` của người dùng khi mở bài**. Nghĩa là mặc định đã là HD với mọi tài khoản (khách, Ban Hát, Ban Nhạc, Admin).
- `chord-canvas.js` dùng `chord_code` của người dùng chỉ để xét **quyền sửa** (ví dụ chỉ chủ bộ hoặc Admin sửa thẳng bộ đó, người khác phải tạo/duyệt) và để chọn `targetSet` khi bấm sao chép — không phải để đổi bộ hiển thị.

### 9.2 Những chỗ có thể làm bộ mặc định lệch khỏi HD — [Chưa kiểm hành vi, suy ra từ mã]
1. **URL `?set=XYZ`**: `url-state.js` đọc `set` từ địa chỉ (`p.get('set') || 'HD'`). Link được chia sẻ hoặc dấu trang chứa `?set=BN` sẽ mở bộ khác dù người mở là tài khoản khác. Đây là chủ ý khi *chia sẻ*, nhưng với yêu cầu "mặc định HD" cần quy tắc: chỉ nhận `set` khi do người dùng chọn trong phiên đó, hoặc bỏ qua khi bài đổi (đã có `resetForNewSong`).
2. **Setlist**: `setlist-player.js`/`setlist-detail.js` dùng `item.chord_profile || 'HD'`. Chương trình do người khác lập có thể lưu `chord_profile` là bộ cá nhân; khi phát sẽ mở bộ đó. Đúng với Core Rule 4 (đồng bộ tập), nhưng nên nêu rõ trong luật: *setlist được phép khác HD, mở thủ công thì luôn HD*.
3. **Bộ nhớ đệm tải trước** (`SongPreloader`): khoá theo `(songId, set)`; cần test để sau khi đăng nhập/đăng xuất không lấy nhầm bộ của phiên trước.
4. **Sau khi đăng nhập**: `auth.js` gọi `reloadCurrentXML()`; cần kiểm bộ đang chọn có giữ nguyên HD, không nhảy sang bộ cá nhân.
5. **Dữ liệu**: mọi bài phải có bản ghi HD (`tools/create_hd_sets.php`, `tools/clone_tlh_to_hd.php`); bài mới thêm qua Quản lý hoặc import cần được tự tạo HD rỗng (Core Rule 1) — kiểm thử riêng cho đường thêm bài XML mới.

### 9.3 Phương án đề xuất
- **Quy định bằng một hằng số duy nhất**: `AppRules.DEFAULT_CHORD_SET = 'HD'` đã có; mọi nơi dùng nó thay vì chuỗi `'HD'` rải rác (chuẩn `CODING_STANDARDS.md` §2.3).
- **Hàm chọn bộ khởi đầu tập trung** (ví dụ `AppRules.resolveInitialSet({ source, requested })`): `source` ∈ {`library`, `search`, `history`, `setlist`, `deeplink`}. Với `library/search/history` ⇒ luôn HD cho mọi vai trò; với `setlist`/`deeplink` ⇒ dùng bộ đã lưu/được chia sẻ nếu người xem có quyền xem bộ đó, ngược lại HD.
- **Máy chủ làm lớp phòng thủ** (`CODING_STANDARDS.md` §4.5): `ChordSetController` khi nhận `load` không rõ tên ⇒ mặc định `HD`.
- **Giao diện**: thanh thông tin luôn hiện rõ bộ đang xem (đã có `⭐ HD (Hoài Dinh)`), kèm nút "Về HD" một chạm khi đang ở bộ khác — hữu ích cho cả điện thoại.

### 9.4 Kiểm thử cần có
- Với từng vai trò (khách, `banhat`, `bannhac`, `leader`, `admin`, tài khoản có `chord_code` cá nhân): mở bài từ Thư viện, Tìm kiếm, Lịch sử ⇒ bộ hiển thị = HD; đăng nhập/đăng xuất giữa chừng ⇒ vẫn HD.
- Link `?set=` do người khác chia sẻ: hành vi đúng như quy tắc đã chọn (xem câu hỏi số 6).
- Cả hai giao diện (Modern + Classic), kể cả khi HD rỗng ⇒ bản nhạc sạch, không tự chuyển sang TLH.
- Bài mới thêm qua Quản lý/import có bản ghi HD.

*(Mục 8–9 là phần bổ sung theo yêu cầu; chưa chỉnh sửa mã.)*
