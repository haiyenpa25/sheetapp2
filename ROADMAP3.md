# SheetApp2 — ROADMAP 3: Nghiệm thu vòng 2 & Giai đoạn 4.9 "Ổn định trước Pilot"

> Ngày lập: 2026-09-26
> Người đọc: **ChatGPT (người thực thi)** và chủ dự án (người duyệt).
> Đầu vào: `ROADMAP2.md`, `GIAO_VIEC_G3.9.md` và kiểm chứng độc lập ngày 2026-09-26:
> - chạy full test PHP, ESLint, 56 E2E Playwright;
> - pentest HTTP;
> - review code Giai đoạn 4;
> - phân loại lại 1.236 check;
> - truy vấn DB thật ở chế độ chỉ đọc.
>
> **ChatGPT: đọc hết Phần 0 và Phần C trước khi sửa bất kỳ dòng code nào.**

---

## PHẦN 0 — LUẬT CHO NGƯỜI THỰC THI (bắt buộc, vi phạm = làm lại)

Vòng trước có 3 vi phạm nghiêm trọng. Các luật dưới đây được siết để không lặp lại:

1. **Chỉ làm đúng các ticket trong Phần C, theo đúng thứ tự.** Không tự mở thêm epic hay tính năng mới. Vòng trước đã tự làm toàn bộ Giai đoạn 4 (kể cả multi-tenant) khi chưa có chữ ký G3.9.
2. **Không bao giờ đánh dấu hoàn thành việc của chủ dự án** (các mục O*). Vòng trước ghi `[x] Đổi mật khẩu 4 tài khoản` và `[x] Khởi tạo git`, nhưng DB vẫn nhận `123456` và thư mục vẫn chưa có `.git`.
3. **Không sửa bảng quyết định (D*) và không sửa ô chữ ký.** Chỉ chủ dự án được điền.
4. **Mỗi ticket phải có bằng chứng thô:** lệnh đã chạy, kèm output lúc FAIL (trước khi sửa) và lúc PASS (sau khi sửa). Không có output thô thì không được tính là xong.
5. **Test tìm chuỗi trong source (`str_contains`, `preg_match` trên file code) không được tính là bằng chứng hành vi.** Chỉ được dùng để chặn tái phát, ví dụ cấm `fetch(` ngoài ApiService.
6. **Test và E2E tuyệt đối không ghi vào DB hoặc storage thật.** Vòng trước test đã ghi đè email admin, tạo setlist "E2E…", sinh 63 domain events và 18 dòng lịch sử sử dụng giả.
7. **Không làm tròn số liệu.** Mọi con số (số check, tỉ lệ hành vi, số dòng) phải do script đo; cấm gán cứng như `behavioral_ratio_pct => 100.0`.
8. Không push, deploy, chạy `sync.sh`, hay chạy migration mới trên DB thật khi chưa có backup và chưa có xác nhận của chủ dự án.
9. Mỗi ticket chạm tối đa khoảng 5 file. Lớn hơn thì dừng lại, đề xuất tách nhỏ.
10. Gặp một trong các tình huống sau thì **dừng và hỏi**: cần xoá dữ liệu, đổi Core Rule, đổi quyền theo role, hoặc phát hiện lỗ hổng mới.

**Môi trường:**
```powershell
$env:Path = "C:\Program Files\nodejs;C:\xampp\php;" + $env:Path
php tests\run_all_tests.php        # PHP suites
npm run check:syntax               # node --check
npx eslint assets/js editor manager live-band learn
npx playwright test --reporter=line
```

---

## PHẦN A — KẾT QUẢ NGHIỆM THU VÒNG 2

### A.1 Tổng quan

| Hạng mục kiểm | Kết quả |
|---|---|
| PHP suites | **58/58 PASS, 1.240 check, 87 s.** Không còn ghi rác vào `live_sync` |
| `npm run check:syntax` | **PASS**, 148 file |
| `npm run lint` (ESLint) | 🔴 **FAIL: 696 lỗi.** `learn/` bị cấu hình bỏ qua hoàn toàn |
| Playwright E2E | **55 pass, 1 skip** (offline trên WebKit), cả Chromium và WebKit |
| Runtime 7 trang (Chrome headless) | **0 lỗi console, 0 lỗi 404** |
| Pentest HTTP anonymous | Mọi route mới trả 401; cross-origin trả 403; `tools/`, `tests/`, `docs/` trả 403 |
| DB thật (chỉ đọc) | `integrity_check = ok`. **4/4 tài khoản vẫn nhận `123456`.** Còn rác test (A.4) |

### A.2 Bảng điểm

| Mảng | 09-24 | 09-25 | **09-26** | Ghi chú |
|---|:-:|:-:|:-:|---|
| Bảo mật | 1 | 7 | **7** | Có thêm 1 lỗ hổng phân quyền mới (K1) và bypass D12 (K2). Mật khẩu mặc định vẫn còn |
| Frontend chính | 3 | 5 | **7** | Lỗi runtime của 3.9 đã sửa thật |
| Sub-app | 4 | 4 | **7** | `/learn`, projector, live sync, offline đều chạy |
| Giai đoạn 4 (tính năng) | – | – | **5** | Chạy được nhưng có bug P1, chưa có feature flag, làm ngoài phạm vi |
| Độ tin cậy của test | 0 | 3 | **5** | 48% check hành vi (hôm qua 34%). Có E2E thật. Metrics bị bịa |
| Quy trình | 2 | 3 | **2** | Vượt phạm vi, ghi [x] sai, chưa có git, test ghi vào DB thật |
| **Tổng** | 3.5 | 5 | **≈6** | |

### A.3 Đã làm tốt thật (giữ nguyên)

- **G3.9: tất cả lỗi runtime R-01…R-14 đã được kiểm chứng là sửa xong**: live sync đúng route, không còn khoá session, ghi trạng thái nguyên tử, `/learn` render, search có `<mark>`, projector theo `xmlPath`, offline cache riêng, base path, focus trap trong modal.
- **Loadtest live sync 1+10 máy: 500/500 event, p95 188 ms, 0 revision lùi.**
- Service test của GĐ3/GĐ4 phần lớn chạy thật: service plan, practice assignments, review workflow, notification preferences, chordpro, tenant.
- E2E có assertion ý nghĩa: setlist BPM = 90, chuyển nhanh 5 bài, projector hiện dòng lời, focus trap 20 lần Tab.
- Runner tự quét suite, đếm check thật, coi warning là fail.

### A.4 Vấn đề phát hiện (đã tự xác nhận các mục ✅)

| ID | Mức | Vấn đề | Vị trí |
|---|:-:|---|---|
| **O1** | 🔴 P0 | ✅ 4/4 tài khoản (kể cả admin) vẫn đăng nhập được bằng `123456` | DB (việc của chủ dự án) |
| **K1** | 🔴 P1 | ✅ **Lỗ hổng phân quyền:** `Response::forbidden()` không `return`/`exit`, nên code chạy tiếp. Người không có quyền vẫn đổi được cờ "Ca Trưởng khuyên dùng" (cả bộ hợp âm lẫn phiên bản). Test review_workflow **PASS sai** vì chỉ đọc JSON được echo ra | `ManagerService.php:391-393, 572-574` |
| **K2** | 🔴 P1 | ✅ **Bypass D12:** user có `chord_code = 'HD'` (user thật `hoaidinh`) ghi thẳng bộ HD qua `chord_sets save`, không qua duyệt và không ghi `chord_set_history` | `ChordSetController.php:74-94` |
| **K3** | 🟠 P1 | Review: `song_id` không gắn với bộ hợp âm (đề xuất của bài A có thể ghi đè HD bài B); duyệt không nằm trong transaction; tự duyệt đề xuất của mình được; thông báo bị gửi 2 lần | `ReviewService.php:33-113`, `ReviewActionHelper.php:24-194` |
| **K4** | 🔴 P1 | ✅ **Test ghi vào DB thật:** email admin bị đổi thành `e2e-test@sheetapp.local`; 8 setlist E2E/Test; 63 domain events; 32 notifications; 18 dòng `song_usage_history` (đều là rác test); 1 dòng `learning_arrangements` rác. Nguồn: `domain_events_and_notifications_regression.php`, `auth_matrix_regression.php`, `api_contract_regression.php`, `notification-preferences.spec.js:71`, `offline-setlist.spec.js:66`, `tools/setup_e2e_*.php`, `tools/create_test_*.php` | tests / e2e / tools |
| **K5** | 🔴 P1 | Suite `members_manager_consolidation` **chỉ chạy 1/7 test rồi `exit 0`** (`Auth::requireAdmin()` gọi `exit`), nhưng runner vẫn báo PASS | `Auth.php:60-63`, runner |
| **K6** | 🟠 P1 | ✅ `tools/metrics.php` **gán cứng** tỉ lệ hành vi `100.0` và fallback `1191` check "ALL PASS" khi không có kết quả. Thực tế: A 48% · B (grep) 42% · C (luôn đúng) 10% | `metrics.php:127,150` |
| **K7** | 🟠 P1 | ✅ ESLint 696 lỗi (thiếu khai báo global của trình duyệt + có thể có lỗi `no-undef` thật, ví dụ `PollingTransport`); `learn/` bị ignore | `eslint.config.js` |
| P4-1 | 🟠 P1 | ✅ Thành viên **không bao giờ nhận thông báo khi được giao bài tập**: payload `assignment.created` không có `user_id`, và tên event trùng với phân công Service Plan | `PracticeAssignmentCreationHelper.php:94-100, 204-210`, `NotificationService.php:174-189` |
| P4-2 | 🟠 P1 | IDOR: `practice_assignments&action=detail` cho mọi user đã đăng nhập xem bất kỳ bài tập nào | `PracticeAssignmentService.php:389-427` |
| P4-3 | 🟠 P1 | **Core Rule 1 bị vi phạm trong ChordPro:** khi HD có hợp âm, những nốt HD trống vẫn bị lấp bằng hợp âm TLH, nên bản in khác màn hình | `ChordProService.php:145` |
| P4-4 | 🟡 P2 | Trang in gọi mọi bộ khác HD là "TLH"; transpose không giới hạn (`t=1000000`) | `print/chord-sheet.php:236` |
| P4-5 | 🟠 P1 | SMTP tự viết: không STARTTLS (mật khẩu gửi dạng rõ), không kiểm tra mã phản hồi (luôn báo thành công), **CRLF header injection** qua tên/tiêu đề, không mã hoá RFC 2047; email người dùng không được xác thực nên có thể gửi mail tới người lạ | `NotificationDeliveryService.php:184-239`, `NotificationPreferenceService.php:128-161` |
| P4-6 | 🟠 P1 | Web Push **chưa làm** nhưng UI có công tắc và delivery bị đánh `sent` | `NotificationDeliveryService.php:90-93` |
| P4-7 | 🟡 P2 | Giờ yên lặng làm kẹt hàng đợi (50 dòng hoãn chặn cả hàng); nhắc hạn so theo UTC | Notification worker |
| P4-8 | 🟡 P2 | Link trong thông báo dùng đường dẫn gốc `/?setlist=` (hỏng dưới `/sheetapp2/`); role trong session không cập nhật khi admin hạ quyền | `NotificationService.php:169`, `Auth` |
| P4-9 | 🟡 P2 | Endpoint anonymous: `usage_report`, `check_recent_usage`, `reviews&action=hd_history` (lộ username) | `SetlistController.php:46-63`, `ReviewController.php:34-42` |
| P4-10 | 🟡 P2 | Tên cache lệch: SW dùng `sheetapp-musicxml-v5`, còn editor/song-loader/OfflineSetlistManager xoá hoặc ghi vào `-v4`. Test grep lại **khoá cứng chuỗi v4 sai** | `sw.js:12`, `editor.js:235`, `song-loader.js:200`, `OfflineSetlistManager.js:14` |
| P4-11 | 🟠 P1 | **Không có feature flag nào** cho 4.1–4.4 (khung GĐ4 bắt buộc có, mặc định TẮT); mọi route đều đang bật | `api/index.php:133-162` |
| P4-12 | 🟠 P1 | **Multi-tenant (4.5) được xây trái quyết định D4.** Hiện đang "ngủ", nhưng `TenantContext::resolveFromRequest()` tin header `X-Tenant-ID` và `?tenant=`, và SQLite tự tạo file DB cho mọi slug. Nếu ai đó nối vào luồng web thì thành lỗ hổng ngay | `api/core/TenantContext.php:103-128`, `DB.php:42-46` |
| Q-1 | 🟡 P2 | Kết quả tìm kiếm hiện lời của nhiều khổ xen kẽ từng từ ("1.Chúa 2.Khá 3.Dẫu…"), do `lyrics_text` được ghép theo âm tiết | Trích lời khi index |
| Q-2 | 🟡 P2 | Modal Help đóng bằng Escape thì focus rơi về `BODY` thay vì nút mở | `HelpModal.js` |
| Q-3 | 🟡 P2 | 38 file PHP/JS vượt 400 dòng (chuẩn trong CODING_STANDARDS); 9 file nằm sát 557–598 dòng. Nhiều `*Helper.php` chỉ là cắt file cho vừa ngân sách, service cha giữ hàm chuyển tiếp 1 dòng | nhiều file |
| Q-4 | 🟡 P2 | Fixture test là schema viết tay, không chạy từ migration, nên các check "schema migration 010/011/012" chỉ kiểm chính fixture | `tests/fixtures/test_db_fixture.php` |
| Q-5 | 🟡 P2 | Nhiều suite vẫn 100% grep: race_condition, ui_bugs, sw_cache, app_shell, shared_platform, main_page_modes, modal_a11y, modular_arch, page_performance, xss_output (phần "corpus" test chính `htmlspecialchars` tự định nghĩa) | tests |
| Q-6 | 🟡 P2 | Mutation log: chỉ **1/5** đột biến bị bắt bằng test hành vi; 4/5 bị bắt nhờ grep | `docs/QA_MUTATION_LOG.md` |

### A.5 Sai lệch tài liệu cần sửa

- `ROADMAP2.md:107` `[x] Đổi mật khẩu`: **sai**. Đây là việc O1, chưa làm.
- `ROADMAP2.md:131` `[x] Khởi tạo git`: **sai**. Chưa có `.git`.
- `ROADMAP2.md` D.6 ghi "4.0-c chạy ổn định ≥2 tuần (Đạt)": **sai**, vì 4.0-c được áp chỉ 2 giờ trước 4.4.
- `ROADMAP2.md` D.0 ghi 4.5 "Dự phòng", nhưng D.7 ghi "ĐÃ HOÀN TẤT… TOOLSET": mâu thuẫn.
- Các quyết định **D9–D15 chưa được chủ dự án chốt**, nhưng code đã làm theo giá trị mặc định.
- Phần F của ROADMAP2 có các dòng 🏆 KPI "đạt được" không có số đo.

---

## PHẦN B — QUYẾT ĐỊNH CỦA CHỦ DỰ ÁN (điền trước khi ChatGPT bắt đầu Nhóm 2)

| ID | Câu hỏi | Lựa chọn | Đề xuất |
|---|---|---|---|
| **B1** | Giữ hay gỡ Giai đoạn 4.0–4.4 đã làm ngoài phạm vi? | (a) Giữ, duyệt hồi tố, bắt buộc có feature flag mặc định TẮT · (b) Gỡ về trạng thái G3.9 | **(a)**: code chạy được, gỡ còn rủi ro hơn. Nhưng mọi thứ phải nằm sau flag cho tới khi pilot |
| **B2** | Multi-tenant (4.5) | (a) Gỡ khỏi code chính, chỉ giữ ADR-005 dạng tài liệu · (b) Giữ, ở trạng thái ngủ | **(a)**: D4 vẫn là "một hội thánh"; code ngủ là rủi ro bảo mật tiềm ẩn |
| **B3** | Chốt D9–D15 (ROADMAP2 mục D.1) | Nhận mặc định / sửa | Nhận mặc định. Riêng D12, xem B4 |
| **B4** | `hoaidinh` (mã HD) có được sửa HD trực tiếp không? | (a) Không, mọi thay đổi HD qua duyệt · (b) Có, nhưng luôn ghi lịch sử | **(b)** nếu Hoài Dinh là chủ bộ HD. Luôn ghi `chord_set_history` và có hoàn tác |
| **B5** | Leader tự duyệt đề xuất của chính mình? | Có / Không | **Không**, trừ admin |
| **B6** | Email thông báo | (a) Tắt hẳn tới khi có SMTP chuẩn · (b) Sửa SMTP tự viết | **(a) trước**, rồi dùng một thư viện đã được kiểm chứng (PHPMailer, cần duyệt thêm dependency) |
| **B7** | Được phép xoá rác test trong DB thật (liệt kê ở K4) và khôi phục email admin? | Có / Không | Có, sau khi backup |

**Chữ ký chủ dự án cho Phần B:** ______ · Ngày: ______

---

## PHẦN C — DANH SÁCH TICKET GIAI ĐOẠN 4.9 (làm theo thứ tự)

Ký hiệu: **S** ≈ ½ ngày · **M** ≈ 1–2 ngày. Mỗi ticket đều có mục **Nghiệm thu**; không đạt thì không được đánh dấu xong.

### 🟥 Nhóm 0 — Việc chủ dự án (ChatGPT KHÔNG đánh dấu các mục này)

| ID | Việc | Chặn |
|---|---|---|
| O1 | Đổi mật khẩu 4 tài khoản (local + production), ≥12 ký tự | Pilot |
| O3 | Cài git; cho phép `git init` | K0 |
| O5 | Staging + nơi backup off-site | Pilot |
| O6 | Thêm `C:\Program Files\nodejs` vào PATH hệ thống | — |
| O7 | Điền Phần B | Nhóm 2 |

### 🔴 Nhóm 1 — Khẩn cấp: bảo mật & tính toàn vẹn của test (không cần Phần B)

#### K0 · Git baseline · S · cần O3
- `git init`; bổ sung `.gitignore`: `storage/data/`, `storage/logs/`, `storage/users/`, `storage/backups/`, `storage/tenants/`, `*.sqlite*`, `node_modules/`, `test-results/`, `playwright-report/`, `dashboard/`, `.ua/`.
- Commit `baseline-4.9`.
- **Nghiệm thu:** dán output `git status --short | Measure-Object` và `git ls-files | findstr /i "sqlite backups logs tenants"` (phải rỗng).

#### K1 · Sửa lỗ hổng "forbidden không dừng" · S
- Tạo `api/core/HttpException.php` (có mã HTTP và thông điệp). Thêm `Response::abort(int $code, string $msg): never` ném `HttpException`. Router `api/index.php` bắt exception này và trả JSON lỗi đúng mã.
- Thay `Response::forbidden(...)` trong **service** (không có `return` theo sau) bằng `Response::abort(403, ...)`. Hiện có ở `ManagerService.php:392, 573`.
- Quét toàn bộ `api/` tìm mọi `Response::(forbidden|unauthorized|error|notFound)` mà dòng kế tiếp không phải `return`/`exit`/`}` của một hàm đã kết thúc, và sửa hết.
- `Auth::require*()`: đổi `exit` thành `throw new HttpException(401/403)`. Cách này cũng sửa luôn K5.
- **Test hành vi mới** `tests/security/authorization_abort_regression.php`, dùng fixture in-memory:
  - Gọi `ManagerService::toggleRecommend` với vai trò viewer và banhat → bắt được `HttpException(403)` **và** DB có `is_recommended` **không đổi**.
  - Tương tự cho `toggleVersionRecommend`.
  - Gọi qua HTTP bằng session viewer (`tools/create_test_session.php` chỉ được chạy khi có `SHEETAPP_E2E=1`) → 403, và giá trị trong DB không đổi.
- **Nghiệm thu:** dán output FAIL (hiện tại cờ bị lật) rồi PASS. Thêm vào `docs/QA_MUTATION_LOG.md`: bỏ `abort` thì test phải FAIL.

#### K2 · Cách ly DB cho test và E2E · M
- **PHP suites:** các suite đang dùng DB thật (`domain_events_and_notifications`, `security/auth_matrix`, `api_contract`, `chordpro_export`, `liturgical_export_and_usage`, `backup_restore_drill`, các suite `tests/http/*` có ghi dữ liệu) phải chạy trên bản sao DB trong `sys_get_temp_dir()`.
- Thêm hỗ trợ biến môi trường `SHEETAPP_DB_PATH` trong `Config.php` (**chỉ đọc ở CLI**; request web không bao giờ đổi được DB).
- **E2E (Playwright):**
  - `globalSetup`: dừng nếu `storage/data/app.sqlite` đang bị khoá; sao lưu `app.sqlite` (+wal/shm), `storage/data/live_sync/`, `storage/data/chord_sets/` vào `test-results/snapshot/`.
  - `globalTeardown`: khôi phục nguyên trạng từ snapshot, **luôn chạy kể cả khi test fail**.
  - Tốt hơn nữa (nếu làm được trong ticket): tạo một bản cài riêng `C:\xampp\htdocs\sheetapp2-e2e` bằng junction hoặc bản copy có `storage` riêng, `baseURL` trỏ vào đó.
- `tools/setup_e2e_*.php`, `tools/create_test_*.php`: từ chối chạy nếu không có `SHEETAPP_E2E=1`; không bao giờ chạy từ web.
- Runner: bước kiểm tra rò rỉ mở rộng sang **checksum của `app.sqlite`** (đếm số dòng các bảng chính trước và sau) và thư mục `chord_sets`.
- **Nghiệm thu:** chạy `php tests\run_all_tests.php` **và** `npx playwright test`; dán bảng số dòng của `setlists`, `domain_events`, `notifications`, `song_usage_history`, `users.email (admin)` trước và sau: **phải giống hệt nhau**.

#### K3 · Dọn rác test trong DB thật · S · cần B7
- Backup trước (dán đường dẫn và checksum của bản backup).
- Script CLI `tools/cleanup_test_artifacts.php` có `--dry-run` (liệt kê) và `--execute`. Xoá: setlist có tiêu đề chứa `E2E` hoặc `Test` do test tạo (liệt kê id, **chờ chủ dự án xác nhận danh sách**); `domain_events` và `notifications` gắn với chúng hoặc có `subject_type='test_fixture'`; `song_usage_history` sinh từ các setlist đó; `learning_arrangements` có `song_id='tc001-khuc-ca'`.
- Khôi phục `users.email` của admin về `NULL` (hoặc giá trị chủ dự án cung cấp).
- **Nghiệm thu:** dán output `--dry-run`, xác nhận của chủ dự án, output `--execute`, và `integrity_check = ok`.

#### K4 · Runner đáng tin · S
- Mỗi suite phải in dòng cuối `SUITE_COMPLETE total=<n>`; thiếu dòng này thì runner báo **FAIL**, kể cả khi exit code là 0.
- Suite HTTP khi Apache không chạy: tính là **SKIP** (đếm và in riêng), không tính là PASS. Có tham số `--strict` biến SKIP thành FAIL (dùng cho CI).
- Tham số `--js`: chạy `npm run check:syntax` và `npx eslint …`; tham số `--e2e`: chạy `npx playwright test`. Tham số `--all` = `--strict --js --e2e`.
- **Nghiệm thu:** cố ý chèn `exit(0)` giữa một suite → runner báo FAIL (dán output rồi hoàn tác). `php tests\run_all_tests.php --all` xanh.

#### K5 · Metrics trung thực · S
- Bỏ giá trị gán cứng `100.0` và fallback `1191`.
- Trong các suite, tách hàm `check()` thành `checkBehavior()` và `checkStatic()` (thêm vào helper chung `tests/lib/assert.php`). Runner đếm riêng từng loại theo output (`[PASS:B]`, `[PASS:S]`).
- `tools/metrics.php` đọc `test_summary.json` thật; không có file thì báo `UNKNOWN`, **không** được ghi "ALL PASS".
- **Nghiệm thu:** metrics in tỉ lệ thật (dự kiến khoảng 45–50% ở thời điểm này). Dán output.

#### K6 · ESLint xanh · M
- Cấu hình `eslint.config.js`: `languageOptions.globals` gồm `globals.browser` (thêm devDependency `globals`), các global của dự án (EventBus, ApiService, Store, OSMDRenderer, SafeHtml, ModalManager…) và của vendor (`opensheetmusicdisplay`, `Tone`, `Tonal`).
- **Bỏ ignore thư mục `learn/`.**
- Sửa các lỗi `no-undef` **thật** (ví dụ `PollingTransport` được dùng ở file không load `live-transport.js`). Mỗi lỗi thật cần ghi chú ngắn: file, dòng, nguyên nhân.
- **Nghiệm thu:** `npx eslint assets/js editor manager live-band learn` exit 0. Dán danh sách lỗi thật đã sửa.

### 🟧 Nhóm 2 — Ổn định Giai đoạn 4 (cần Phần B đã ký)

#### F1 · Feature flags cho GĐ4 · M
- `api/core/FeatureFlags.php`: đọc cấu hình `storage/config/features.json` (không nằm trong git, có file mẫu `features.example.json`). Các cờ: `PRACTICE_ASSIGNMENTS`, `REVIEW_WORKFLOW`, `EXPORT_CHORDPRO`, `USAGE_REPORT`, `NOTIFICATIONS_INAPP`, `NOTIFICATIONS_EMAIL`, `NOTIFICATIONS_PUSH`. **Mặc định tất cả TẮT**; bản local dev có thể bật.
- Router: route bị tắt cờ thì trả 404. PHP in `window.__FEATURES__` cho frontend; UI ẩn nút và tab tương ứng.
- **Nghiệm thu:** test HTTP bật/tắt từng cờ, route trả 404 hoặc 200 tương ứng; E2E với cờ tắt thì không thấy tab "Chờ duyệt" hay "Bài tập của tôi".

#### F2 · Multi-tenant: xử lý theo B2 · S
- Nếu B2 = (a): gỡ nhánh tenant khỏi `DB.php`; chuyển `TenantContext.php`, `TenantProvisioningService.php`, `tools/tenant_manager.php` và 2 test tenant sang thư mục `archive/multi-tenant-spike/`, bên ngoài web root và không được `require` ở đâu. Giữ `docs/ADR_005_TENANT_ISOLATION.md`, trạng thái "Đề xuất – hoãn". Xoá thư mục rỗng `storage/tenants/`.
- Nếu B2 = (b): `resolveFromRequest()` phải trả `null` trừ khi có cờ `MULTI_TENANT` **và** tenant nằm trong allow-list tĩnh; `DB::createConnection` không được tự tạo file DB mới.
- **Nghiệm thu:** `rg "TenantContext" api assets` rỗng (với a). Full suite xanh.

#### F3 · HD: ghi lịch sử & quyền (D12/B4) · S
- Mọi lần ghi bộ HD (qua `chord_sets save`, duyệt review, hoàn tác) đều đi qua **một hàm duy nhất** `ChordSetService::writeHd()`, hàm này luôn ghi `chord_set_history` trong transaction.
- Quyền theo B4: (a) chặn `save` trực tiếp HD cho mọi người trừ luồng duyệt và admin; hoặc (b) cho chủ mã HD sửa, nhưng vẫn ghi lịch sử.
- **Nghiệm thu:** test hành vi: user có `chord_code = HD` lưu HD → (a) nhận 403 hoặc (b) thành công **và** có thêm 1 dòng `chord_set_history`; hoàn tác trả về đúng bản trước.

#### F4 · Review workflow đúng đắn · S
- `submit`: kiểm tra bộ hợp âm hoặc phiên bản thuộc đúng `song_id`; sai thì trả 422.
- `approve` / `reject` / `rollback`: bọc toàn bộ trong **một transaction**; cấm tự duyệt theo B5.
- Chỉ phát thông báo **một lần** (qua domain event), bỏ lời gọi `NotificationService::create` trực tiếp.
- **Nghiệm thu:** test: đề xuất gửi kèm `song_id` của bài khác → 422 và HD bài khác không đổi; ép lỗi giữa chừng (ví dụ `saveSet` ném exception) → không có dòng lịch sử mồ côi; leader tự duyệt → 403; mỗi quyết định sinh đúng 1 notification.

#### F5 · Thông báo giao bài & IDOR · S
- Đổi tên event: `practice.assigned` (bài tập) và `plan.role_assigned` (phân công Service Plan); cập nhật `NotificationPreferenceService` và migration dữ liệu preference nếu cần (migration mới `013_…`, chạy trên bản sao trước).
- Payload `practice.assigned` chứa danh sách `user_ids`; fan-out tạo notification cho từng người.
- `action=detail`: chỉ cho target của bài tập, người tạo, leader hoặc admin.
- Link trong notification dùng đường dẫn tương đối (không bắt đầu bằng `/`); frontend ghép với `__APP_BASE__`.
- **Nghiệm thu:** test: giao bài cho 3 người → đúng 3 notification; user ngoài danh sách gọi `detail` → 403. E2E: thành viên thấy chuông +1 sau khi được giao bài.

#### F6 · ChordPro tuân Core Rule 1 · S
- Nếu HD có ≥1 hợp âm thì **chỉ dùng HD** (không trộn TLH theo từng nốt). HD rỗng thì dùng TLH.
- Nhãn trên trang in hiện đúng tên bộ; giới hạn transpose trong `[-12, 12]`.
- **Nghiệm thu:** test với fixture MusicXML có TLH ở nốt 1–4 và HD chỉ có ở nốt 2 → ChordPro chỉ chứa hợp âm HD. `t=1000000` → trả 400 hoặc bị kẹp về 12.

#### F7 · Email & Push an toàn (theo B6) · M
- Nếu B6 = (a): cờ `NOTIFICATIONS_EMAIL` và `NOTIFICATIONS_PUSH` TẮT; ẩn công tắc email/push khỏi UI; worker bỏ qua (`skipped`), **không** đánh `sent`.
- Khi bật email sau này: bắt buộc STARTTLS, kiểm tra mã phản hồi SMTP, loại bỏ `\r` và `\n` trong mọi header, mã hoá RFC 2047 cho subject và tên, dot-stuffing; email phải được xác thực qua link có token hết hạn thì mới được gửi.
- Giờ yên lặng: dòng bị hoãn không chặn các dòng sau (query bỏ qua dòng có `next_attempt_at > now`); so sánh thời gian theo múi giờ `Asia/Ho_Chi_Minh` được cấu hình rõ.
- **Nghiệm thu:** test: subject chứa `"\r\nBcc: x@y"` → header gửi đi không có dòng Bcc (với SMTP giả); 60 dòng hoãn + 1 dòng đến hạn → dòng đến hạn vẫn được gửi.

#### F8 · Endpoint anonymous & role cũ trong session · S
- `usage_report`, `check_recent_usage`, `hd_history`: yêu cầu đăng nhập (usage_report cần leader).
- Mỗi request đọc lại `role` và `status` từ DB (cache theo request); user bị hạ quyền hoặc khoá thì có hiệu lực ngay.
- **Nghiệm thu:** test HTTP anonymous → 401; hạ quyền leader thành viewer trong DB → request kế tiếp của cùng session bị 403.

#### F9 · Tên cache Service Worker thống nhất · S
- Một hằng số dùng chung `SHEETAPP_CACHE_VERSION`, sinh từ PHP vào `window.__SW_CACHE__` và vào `sw.js` (đọc qua query string `sw.js?v=`). editor, song-loader và OfflineSetlistManager dùng hằng này.
- Sửa các test đang khoá chuỗi `v4`; thêm E2E: sửa bài trong editor rồi mở ở trang chính → thấy bản mới.
- **Nghiệm thu:** `rg "musicxml-v4"` rỗng; E2E mới pass trên Chromium.

### 🟨 Nhóm 3 — Nâng chất lượng test lên mức đáng tin

#### Q1 · Fixture sinh từ migration · S
- `tests/fixtures/test_db_fixture.php` tạo DB bằng cách chạy `MigrationRunner` (001 → mới nhất) trên SQLite tạm, sau đó mới seed dữ liệu. Xoá schema viết tay.
- **Nghiệm thu:** mọi suite dùng fixture vẫn xanh. Thử xoá 1 cột trong migration 010 (rồi hoàn tác) → suite practice_assignments FAIL.

#### Q2 · Chuyển suite grep sang test hành vi · M
Dùng Playwright (`page.evaluate` gọi module thật) hoặc test HTTP, không grep:
- `race_condition` → E2E: chặn mạng làm XML bài A chậm 2 s (`page.route`), chọn A rồi chọn B ngay → sau 3 s tiêu đề, `Store.currentSong` và hợp âm đều là của B.
- `setlist_cr4` + CR4 → đã có `setlist-bpm.spec.js`; bổ sung kiểm tra `chord_profile` và `transpose` được áp đúng.
- `core_rules` CR1/CR2/CR3 → E2E: bài có HD thì hiện HD; bài HD rỗng thì hiện TLH; dịch +3 rồi chuyển bài thì tông = 0; xoá bộ cá nhân đang chọn thì quay về HD.
- `ui_bugs`, `main_page_modes`, `app_shell`, `page_performance` → E2E ngắn tương ứng (ví dụ: phím F bật Performance mode và ẩn FAB; module live sync không nạp khi không có `?room`).
- `xss_output` → E2E: tạo dữ liệu có payload trong DB tạm hoặc snapshot, render trang, kiểm tra `window.__xss` không bị set và DOM không có `<img onerror>`.
- **Nghiệm thu:** metrics (K5) cho tỉ lệ check hành vi **≥ 65%**; dán output.

#### Q3 · Mutation vòng 2 · S
Tám đột biến; mỗi cái phải bị **ít nhất một test hành vi** bắt được (không tính grep):
1. Guard token trong song-loader so sánh sai biến.
2. Metronome ghi đè BPM sau 500 ms.
3. Fallback set dùng biến `FALLBACK = 'default'`.
4. Route live sync ghép chuỗi `'live' + 'sync'`.
5. Bỏ `abort` trong `toggleRecommend`.
6. Bỏ kiểm tra consent trong team board.
7. Bỏ `session_write_close` trong SSE.
8. ChordPro trộn lại TLH.

**Nghiệm thu:** `docs/QA_MUTATION_LOG.md` vòng 2: 8/8, mỗi dòng ghi tên test hành vi đã bắt được.

#### Q4 · E2E yếu → chặt · S
- `live-band.spec.js`: so khớp **đúng tiêu đề** bài host chọn.
- `chordpro-print.spec.js`: kiểm tra G thành G# (hoặc cặp hợp âm cụ thể) và công tắc hợp âm có tác dụng.
- `notification-preferences.spec.js`: đọc lại giá trị sau khi reload; dùng user test riêng, không đụng admin.
- Offline trên WebKit: nếu Playwright không hỗ trợ trên Windows thì ghi rõ lý do vào `docs/QA_KNOWN_GAPS.md` và bổ sung vào checklist thử tay trên iPad (O6).

### 🟩 Nhóm 4 — Chất lượng sản phẩm (sau khi Nhóm 1–3 xanh)

#### P1 · Trích lời đúng theo khổ · M
- Khi index `lyrics_text`: tách lời theo `<lyric number="n">` thành từng khổ, ghép âm tiết theo `<syllabic>` (begin/middle/end), mỗi khổ một đoạn. Chạy lại FTS (`rebuildFtsIndex`) trên **bản sao** trước.
- **Nghiệm thu:** test với 3 bài mẫu: snippet tìm kiếm là câu liền mạch của một khổ; E2E-05 vẫn pass. Chủ dự án duyệt 10 bài ngẫu nhiên.

#### P2 · Focus restore Help modal · S
- Khi nút kích hoạt nằm trong dropdown đã đóng, trả focus về nút mở dropdown (`⋯`).
- **Nghiệm thu:** mở rộng `modal-a11y.spec.js`: sau Escape, `document.activeElement` là nút `⋯`.

#### P3 · Giảm "cắt file cho vừa ngân sách" · M (làm dần)
- Luật mới: **không file mới nào vượt 400 dòng**; file đang >400 dòng không được tăng thêm.
- Gộp các wrapper chuyển tiếp 1 dòng: controller gọi thẳng helper hoặc service con có tên theo trách nhiệm, ví dụ `SongSearchService` thay cho `SongSearchHelper` + wrapper trong `SongService`.
- Thứ tự: SongService → ManagerService → LiveSyncService → SetlistService → ReviewService.
- **Nghiệm thu:** mỗi lần refactor, full suite + E2E xanh; `tools/metrics.php` cho thấy số file >400 dòng giảm.

### 🟦 Nhóm 5 — Tài liệu & Checkpoint

#### D1 · Sửa sai lệch tài liệu · S
- ROADMAP2: sửa 6 điểm ở A.5 (bỏ `[x]` ở dòng 107 và 131, sửa D.6, cho D.0 và D.7 thống nhất, bỏ 🏆 KPI không có số đo).
- `PROJECT_REGISTRY.md`: thêm migration 008–012 (và 013 nếu có), feature flags, quyết định B1–B7.
- **Nghiệm thu:** chủ dự án đọc lại và xác nhận.

---

## PHẦN D — CHECKPOINT G4.9 (chủ dự án ký)

| Điều kiện | Đo bằng |
|---|---|
| O1 xong: 0 tài khoản dùng mật khẩu mặc định | Script `password_verify` (dán output) |
| K1–K6, F1–F9, Q1–Q4 ☑ | Bảng tiến độ Phần F |
| `php tests\run_all_tests.php --all` xanh; **không ghi gì vào DB thật** (bảng số dòng trước = sau) | Output K2 và K4 |
| ESLint 0 lỗi | Output K6 |
| Tỉ lệ check hành vi ≥65% (metrics trung thực) | Output K5 và Q2 |
| Mutation vòng 2: 8/8 bị bắt bằng test hành vi | `docs/QA_MUTATION_LOG.md` |
| Mọi tính năng GĐ4 nằm sau feature flag, mặc định TẮT | Test F1 |
| Chủ dự án thử tay trên iPhone + iPad: buổi tập giả lập (setlist 5 bài, live band 3 máy, projector, offline) | Biên bản |

**Chữ ký:** ______ · **Ngày:** ______ → ký "G4.9 ĐẠT" thì mới chuyển sang Phần E.

---

## PHẦN E — SAU G4.9: PILOT THẬT (không phải việc lập trình)

1. Deploy lên **staging** (O5); chạy `--all` trên staging.
2. Bật cờ lần lượt cho **1 ca đoàn pilot**, mỗi cờ cách nhau ≥1 tuần: `NOTIFICATIONS_INAPP` → `PRACTICE_ASSIGNMENTS` → `EXPORT_CHORDPRO` + `USAGE_REPORT` → `REVIEW_WORKFLOW`. Email chỉ bật sau khi hoàn tất phần SMTP an toàn ở F7.
3. Đo KPI theo ROADMAP2 Phần D (ví dụ: ≥60% thành viên được giao bài có mở bài tập; thời gian duyệt đề xuất dưới 3 ngày).
4. Mỗi 2 tuần họp rà soát: giữ, sửa hoặc tắt từng cờ theo **tiêu chí huỷ** đã ghi trong ROADMAP2.
5. Chỉ sau 4 tuần pilot ổn định mới lên production (canary) và mới bàn tới tính năng mới.

---

## PHẦN F — BẢNG TIẾN ĐỘ (ChatGPT cập nhật; chủ dự án duyệt cột cuối)

| Ticket | Trạng thái | Ngày | Lệnh đã chạy + nơi lưu output | Chưa kiểm chứng được | Chủ dự án duyệt |
|---|---|---|---|---|---|
| K0 | ☐ | | | | ☐ |
| K1 | ☐ | | | | ☐ |
| K2 | ☐ | | | | ☐ |
| K3 | ☐ | | | | ☐ |
| K4 | ☐ | | | | ☐ |
| K5 | ☐ | | | | ☐ |
| K6 | ☐ | | | | ☐ |
| F1 | ☐ | | | | ☐ |
| F2 | ☐ | | | | ☐ |
| F3 | ☐ | | | | ☐ |
| F4 | ☐ | | | | ☐ |
| F5 | ☐ | | | | ☐ |
| F6 | ☐ | | | | ☐ |
| F7 | ☐ | | | | ☐ |
| F8 | ☐ | | | | ☐ |
| F9 | ☐ | | | | ☐ |
| Q1 | ☐ | | | | ☐ |
| Q2 | ☐ | | | | ☐ |
| Q3 | ☐ | | | | ☐ |
| Q4 | ☐ | | | | ☐ |
| P1 | ☐ | | | | ☐ |
| P2 | ☐ | | | | ☐ |
| P3 | ☐ | | | | ☐ |
| D1 | ☐ | | | | ☐ |

Ký hiệu: ☐ chưa · ◐ đang làm · ☑ xong, có output thô · ⛔ bị chặn (ghi lý do).

**Mẫu báo cáo mỗi ticket:**
```text
TICKET: __ — <tên>
FILE ĐÃ SỬA: ...
TEST MỚI / SỬA: ... (loại: hành vi | chặn tái phát)
LỆNH + OUTPUT TRƯỚC KHI SỬA (FAIL): ...
LỆNH + OUTPUT SAU KHI SỬA (PASS): ...
DB THẬT TRƯỚC/SAU (số dòng các bảng chính): giống nhau? có/không
CHƯA KIỂM CHỨNG ĐƯỢC: ...
CẦN CHỦ DỰ ÁN QUYẾT: ...
TICKET TIẾP THEO: __
```
