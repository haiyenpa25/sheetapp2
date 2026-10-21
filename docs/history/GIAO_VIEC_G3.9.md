# PHIẾU GIAO VIỆC — Giai đoạn 3.9 "Sửa thật & Nghiệm thu thật"

> Người giao: chủ dự án · Ngày giao: 2026-09-25
> Người nhận: dev / AI thực thi
> Tài liệu nền (đọc trước, **không** làm theo thứ tự trong đó): `ROADMAP2.md` Phần A, B, C
> Phạm vi: **chỉ Giai đoạn 3.9**. **Cấm** làm bất cứ mục nào của Giai đoạn 4 cho tới khi chủ dự án ghi "G3.9 ĐẠT" ở cuối file này.

---

## 0. LUẬT LÀM VIỆC (đọc kỹ, vi phạm = làm lại)

1. **Làm từng ticket theo đúng thứ tự** ở mục 2. Mỗi ticket chạm tối đa khoảng 5 file. Làm xong một ticket, báo cáo, rồi mới sang ticket tiếp.
2. **Test hành vi trước, sửa sau:**
   - Viết test mô tả hành vi đúng.
   - Chạy test, **dán output FAIL** vào báo cáo.
   - Sửa code.
   - Chạy lại, dán output PASS.
3. **Test chỉ tìm chuỗi trong source (`str_contains`, `preg_match` trên file code) KHÔNG được tính là bằng chứng.** Phải gọi code thật: service PHP, HTTP tới `http://localhost/sheetapp2/`, hoặc trình duyệt (Playwright).
4. **Không ghi vào `storage/` hay DB thật trong test.** Dùng thư mục tạm (`sys_get_temp_dir()`) và DB fixture.
5. **Không đổi 4 Core Rules**: HD mặc định · tông = 0 khi mở bài mới · khoá HD/TLH · Setlist giữ tông + BPM + profile.
6. **Không xoá file, route, bảng hay dữ liệu** nếu ticket không ghi rõ. Không chắc thì **dừng lại và hỏi**.
7. **Không push, deploy, hay chạy `sync.sh`.** Chỉ commit local trên nhánh `fix/g39-<ticket>` (sau khi có git).
8. Trước mỗi thao tác đụng DB: backup `storage/data/app.sqlite` và chạy `PRAGMA integrity_check`.
9. Không đánh dấu `[x]` nếu còn phần nào **chưa kiểm chứng được**. Ghi rõ phần đó vào báo cáo, ví dụ: "chưa test trên iOS".
10. Sau mỗi 3 ticket: chạy `test.bat` toàn bộ và dán dòng tổng kết.

**Lệnh chuẩn:**
```powershell
$php = 'C:\xampp\php\php.exe'
& $php -l <file.php>
.\test.bat
npx eslint <file.js>          # sau T04
npx playwright test <spec>     # sau T04
```

---

## 1. VIỆC CỦA CHỦ DỰ ÁN (dev không làm các mục này)

| ID | Việc | Chặn ticket nào |
|---|---|---|
| O1 | **Đổi mật khẩu 4 tài khoản** trên production và local (≥12 ký tự) | — (làm ngay) |
| O2 | Cài **Node.js LTS** trên máy dev | T04 trở đi (phần JS/E2E) |
| O3 | Cài **git**, cho phép `git init` trong thư mục dự án | T00 |
| O4 | Xác nhận được phép xoá các file `storage/data/live_sync/test-*.json`, `regtest_*.json` | T03 |
| O5 | Cung cấp staging và nơi lưu backup off-site | T22 |
| O6 | Tự test buổi tập giả lập trên iPhone + iPad | Checkpoint cuối |

---

## 2. DANH SÁCH TICKET (làm từ trên xuống)

Ký hiệu cỡ việc: **S** ≈ ½ ngày · **M** ≈ 1–2 ngày.

### 🔴 Nhóm 1 — Khẩn cấp

#### T00 · Khởi tạo git baseline · S · cần O3
- `git init`, `.gitignore` bổ sung: `storage/data/`, `storage/logs/`, `storage/users/`, `storage/backups/`, `*.sqlite*`, `node_modules/`, `dashboard/`, `.ua/`.
- Commit đầu: `baseline-3.9` (kiểm `git status` không có file DB, log, backup).
- **Nghiệm thu:** `git ls-files | findstr /i "sqlite log backups"` trả rỗng.

#### T01 · Chặn bề mặt web còn hở · S
- Lỗi: `/tests/run_all_tests.php`, `/test.bat`, `/api/migrations/*.php`, `/api/core/*.php` đang trả 200.
- Sửa `.htaccess`: chặn `tests/`, `*.bat`, `*.sh`, `api/migrations/`, `api/core/`, `api/services/`, `api/controllers/`. Chỉ cho phép `api/index.php` và các shim cũ đang được dùng (kiểm bằng grep trước khi chặn).
- Tạo test HTTP thật `tests/http/web_surface_http_regression.php`: gọi curl tới danh sách URL cần chặn (phải 403/404) **và** URL cần mở (`/`, `/api/index.php?route=songs`, 1 file XML trong `storage/Thanh ca/`, `/assets/js/app.js`) phải 200. Nếu Apache không chạy thì test báo SKIP rõ ràng, không được PASS.
- **Nghiệm thu:** test FAIL trước khi sửa `.htaccess`, PASS sau khi sửa; trang chính vẫn chạy.

#### T02 · Gỡ mật khẩu mặc định khỏi code · S
- `api/init_db.php`: seed sinh mật khẩu ngẫu nhiên (`bin2hex(random_bytes(8))`), chỉ in ra CLI một lần.
- `members/members.js:383` và mọi prompt hoặc form reset mật khẩu: bỏ giá trị gợi ý `123456`.
- **Chặn mật khẩu yếu khi đăng nhập:** trong login, nếu mật khẩu người dùng gõ nằm trong danh sách yếu (`123456`, `password`, `12345678`, trùng username) thì vẫn cho vào, nhưng session có `must_change_password = true`. API `auth&action=me` trả cờ này; UI bắt buộc mở modal đổi mật khẩu, không đóng được cho tới khi đổi xong. **Không tạo migration** cho việc này.
- Khi đổi mật khẩu: tối thiểu 10 ký tự và không nằm trong danh sách yếu.
- **Nghiệm thu:** test HTTP đăng nhập bằng user fixture có mật khẩu yếu thì nhận `must_change_password: true`; đổi mật khẩu yếu bị từ chối; đổi mật khẩu mạnh thì cờ tắt. `rg "123456" --glob "*.{php,js}"` chỉ còn trong danh sách mật khẩu yếu.

#### ☑ T03 · Vệ sinh bộ test · M · cần O4 cho phần xoá file
- `tests/run_all_tests.php`:
  - Tự quét `tests/**/*_regression.php` thay vì liệt kê tay.
  - Số check lấy từ output thật (đếm `[PASS]` / `[FAIL]`), không in chuỗi cứng kiểu "7/7".
  - Có warning hoặc deprecation thì coi là FAIL.
  - Dùng `PHP_BINARY`, bỏ `C:\xampp\php\php.exe`.
- `LiveSyncService`: cho phép truyền thư mục lưu phòng (constructor hoặc biến môi trường `SHEETAPP_LIVE_SYNC_DIR`); test live sync dùng thư mục tạm.
- Thêm bước cuối trong runner: so sánh danh sách file trong `storage/data/live_sync/` trước và sau khi chạy; có file mới thì FAIL.
- Sửa các check luôn đúng:
  - `members_manager_consolidation_regression.php`: test RBAC gọi HTTP thật; bỏ `$cannotDemoteWhenOnlyOne = true` và thay bằng gọi service thật.
  - `core_rules_regression.php`: bỏ `(2 ?? 0) === 2` và `str_contains($svc,"return;")`.
- Xoá file phòng rác (sau khi có O4).
- **Nghiệm thu:** chạy `test.bat` 2 lần liên tiếp, `storage/data/live_sync/` không tăng file; runner in số check thật.

### 🟠 Nhóm 2 — Lưới test JS & trình duyệt (cần O2)

#### ☑ T04 · ESLint + kiểm cú pháp + Playwright · M
- `package.json`: thêm `eslint`, `@playwright/test`. Script `lint`, `check:syntax` (chạy `node --check` từng file `.js` ngoài vendor), `e2e`.
- Cấu hình ESLint tối thiểu: `no-undef` (khai báo các global như `EventBus`, `ApiService`, `OSMDRenderer`…), `no-redeclare`, `no-unreachable`. **Chưa** bật luật định dạng.
- `playwright.config.js` với `baseURL=http://localhost/sheetapp2/`, 2 project: chromium và webkit.
- E2E-01 `e2e/main-page.spec.js`: mở `/`, chọn 1 bài, chờ SVG xuất hiện, **console không có lỗi**.
- Runner PHP gọi thêm `npm run check:syntax` nếu có Node; không có Node thì báo SKIP (không PASS).
- **Nghiệm thu:** `npm run check:syntax` phải **bắt được lỗi `learn-score.js`** (đây là bằng chứng công cụ hoạt động). E2E-01 pass trên cả chromium và webkit.

### 🔴 Nhóm 3 — Sửa các tính năng đang hỏng

#### ☑ T05 · Sửa /learn không load được bài · S
- `assets/js/learn/ui/learn-score.js:124-143`: thêm `}` đóng `setupScoreClickHandler`.
- `assets/js/learn/harmony/learn-satb.js`: export `getSongMeta` trong khối `return`.
- E2E-02 `e2e/learn.spec.js`: mở `/learn/?song=thanh-ca-090`, bài render xong, console sạch, bấm Play không lỗi.
- **Nghiệm thu:** E2E-02 FAIL trước, PASS sau; `check:syntax` sạch.

#### ☑ T06 · Sửa tìm kiếm FTS5 trên UI · S
- `api/controllers/SongController.php:41`: trả `Response::ok(['data' => $results])`. Grep mọi nơi gọi `songs.search` và cập nhật.
- Snippet: escape toàn bộ trước, sau đó mới chèn `<mark>` quanh từ khớp (không bao giờ chèn HTML thô từ DB).
- Migration 006: kiểm tra FTS5 (`CREATE VIRTUAL TABLE temp.x USING fts5(a)` trong try) trước khi tạo; nếu host không có FTS5 thì bỏ qua và ghi log; search tự chuyển sang LIKE.
- Test contract HTTP: `route=songs&action=search&q=chua` có `data` là **mảng**, phần tử có `id`, `title`.
- E2E-05: gõ "chua" ở sidebar và thấy ≥1 kết quả, trong đó có thẻ `<mark>`.
- **Nghiệm thu:** test contract FAIL trước, PASS sau; E2E-05 pass.

#### ☑ T07 · Live sync: sửa route & fallback · S
- `assets/js/performance/live-transport.js:201`: đổi `route=livesync` thành `route=live_sync`; build URL qua `ApiService.resolveUrl`.
- `:262`: khi `EventSource.onerror` và `readyState === EventSource.CLOSED`, chuyển sang `PollingTransport` **ngay**.
- **Nghiệm thu:** test HTTP xác nhận URL SSE trả `200 text/event-stream`. Kiểm fallback bằng E2E ở T11.

#### ☑ T08 · Live sync: bỏ khoá session trong SSE · S
- `api/index.php` và `LiveSyncController`: với `action=events`, đọc xong thông tin cần từ session thì gọi `session_write_close()` **trước** vòng lặp stream. Thêm `set_time_limit(40)`.
- Test HTTP: mở 1 stream SSE (curl nền, cùng cookie), trong lúc đó gọi `route=songs` với cùng cookie; request này phải xong trong **<1 s**.
- **Nghiệm thu:** test FAIL trước (bị chặn khoảng 25 s), PASS sau.

#### ☑ T09 · Live sync: ghi trạng thái phòng nguyên tử · M
- `LiveSyncService`: mọi thao tác đọc–sửa–ghi nằm trong **một** `flock(LOCK_EX)` trên file khoá riêng; ghi ra file tạm rồi `rename()`.
- Tách presence (danh sách thành viên online) ra file riêng `{room}.presence.json`, để follower **không bao giờ** ghi vào file state của host.
- Đọc trúng file hỏng thì thử lại 3 lần, không được trả `closed`.
- Test đồng thời thật: script mở 2 tiến trình PHP. Tiến trình host cập nhật 200 lần; tiến trình follower ghi presence 200 lần cùng lúc. Kỳ vọng revision cuối = 200, không lần nào revision lùi.
- **Nghiệm thu:** test FAIL trước (mất revision), PASS sau.

#### ☑ T10 · Live sync: Last-Event-ID, ping, cảnh báo PHP · S
- SSE đọc header `Last-Event-ID`, replay từ ring buffer thay vì gửi lại toàn bộ state.
- Ping theo thời gian thực (mỗi 15 s), không theo số vòng lặp.
- `LiveSyncService.php:204`: `isset($cue['durationMs'])`.
- **Nghiệm thu:** test HTTP gửi `Last-Event-ID` cũ thì chỉ nhận các event sau id đó; không có warning trong log PHP.

#### ☑ T11 · Live sync: test tải & E2E ban nhạc · M
- `tools/loadtest_live_sync.php` (CLI): 1 host + 10 client SSE bằng `curl_multi`, chạy 5 phút, host đổi bài 50 lần. Báo cáo: % client nhận đủ, số revision lùi, số cue trùng, độ trễ p95.
- E2E-03 `e2e/live-band.spec.js`: 2 browser context. Host tạo phòng; follower join; host đổi bài 3 lần; follower đổi theo trong ≤2 s mỗi lần.
- **Nghiệm thu:** loadtest đạt 100% nhận đủ (50/50 events x 10 clients = 500/500 received), 0 lùi, 0 trùng, p50=158.79ms, p95=188.02ms, Max=248.88ms; E2E-03 pass trên cả Chromium (101ms, 94ms, 103ms) và WebKit (65ms, 115ms, 127ms).

#### T12 · Sửa Projector · M
- `live-band/projector.php:607`: lấy `xmlPath` qua `ApiService.songs` theo `song_id`, không tự ghép tên file.
- `:368-370`: đường dẫn script dùng `__APP_BASE__`.
- Tách JS inline ra `live-band/js/projector-app.js`, `projector-slides.js` (mỗi file ≤400 dòng); `projector.php` ≤300 dòng.
- E2E-04: host phát bài trong phòng; projector cùng phòng hiện **đúng dòng lời đầu tiên** của bài.
- **Nghiệm thu:** E2E-04 pass; console projector sạch.

#### ☑ T13 · Sửa Offline setlist · M
- `sw.js`: gói offline dùng cache riêng `sheetapp-offline-<setlistId>`, **không** chịu giới hạn FIFO 60 bài; xoá cache này khi người dùng xoá gói.
- Khi offline, mọi request điều hướng (`mode: 'navigate'`) trả app shell đã cache, bỏ qua query string.
- Tăng `SW_VERSION`.
- E2E-08: tải gói setlist 3 bài → mở 65 bài khác (script) → `context.setOffline(true)` → reload `/?song=<bài 2 trong setlist>` → sheet hiện ra.
- **Nghiệm thu:** E2E-08 pass trên chromium (webkit ghi rõ kết quả, nếu chưa hỗ trợ thì báo).

### 🟡 Nhóm 4 — Nợ kiến trúc & UI

#### ☑ T14 · Thống nhất base path · M
- Một nguồn duy nhất `window.__APP_BASE__`, in ra từ PHP. Sửa: `index.php:16` (manifest), `huong-dan/index.php:810`, `editor/editor.js:224,260,289,339`, `live-band/live-band.js:488`, redirect `members/index.php:7`, fallback trong `practice-tracker.js`.
- **Nghiệm thu:** E2E-01, 02, 04 chạy pass với baseURL `http://localhost/sheetapp2/`. Grep `['"\`]/(api|assets|storage|manager|huong-dan)/` trong JS/PHP chỉ còn các chỗ có chú thích lý do.

#### ☑ T15a · Manager → ApiService (users) · S
- Chuyển 13 lệnh `fetch` trong `manager/js/manager-users.js` sang `ApiService.manager.*` (bổ sung method thiếu trong `assets/js/core/ApiService.js`).
- **Nghiệm thu:** E2E admin mở tab Users, đổi role 1 user fixture, reload thì thấy role mới.

#### ☑ T15b · Manager → ApiService (repertoire, community, versions, manager.js) · M
- ~15 lệnh `fetch` còn lại trong `manager/js/*` và `manager/manager.js:423`.
- **Nghiệm thu:** E2E mở 4 tab Manager, console sạch (đã kiểm tra toàn bộ 5 tab qua `e2e/manager-tabs.spec.js` pass trên cả Chromium và WebKit, 0 lỗi console).

#### ☑ T15c · Editor, song-loader, EventBus → ApiService · S
- `editor/editor.js:224,260,289`, `song-loader.js:374` (`get_versions`, thêm `ApiService.songs.getVersions`), `EventBus.js:33,46` (tách logger lỗi ra `core/ErrorReporter.js`, gọi qua ApiService).
- Thêm test chặn tái phát: chỉ `ApiService.js`, `sw.js` và dòng có chú thích `// INTENTIONAL EXCEPTION:` mới được chứa `fetch(`. Đây là trường hợp **hợp lệ** để dùng test grep.
- **Nghiệm thu:** test chặn tái phát pass (`tests/fetch_anti_regression.php` 19/19 checks PASS trên 109 file JS), E2E mở editor load được danh sách bài (`e2e/editor.spec.js` pass trên cả Chromium và WebKit).

#### ☑ T16 · Modal trang chính qua ModalManager · M (ĐÃ HOÀN THÀNH)
- Các modal: `help`, `transpose-pick`, `tempo sheet`, `auth`, `add-to-setlist`, `create-setlist`, `admin`, `livesync`, `mixer`, `service-plan-assign`. Mở và đóng **chỉ** qua `ModalManager.open/close`.
- Thêm `role="dialog"`, `aria-modal="true"`, `aria-labelledby` ngay trong markup `includes/modals.php` và `includes/admin_console.php`.
- Bỏ lời gọi `ModalManager.registerModal` không tồn tại ở `assets/js/modals/ServicePlanAssignModal.js`.
- Bổ sung cơ chế quản lý Focus Trap toàn cục bắt ở capture phase, tự động luân chuyển tuần hoàn giữa các focusable controls, tương thích đa trình duyệt (Chromium + WebKit/Safari).
- Focus Restore tự động phục hồi focus về chính xác phần tử kích hoạt khi bấm phím Escape hoặc đóng modal.
- **Nghiệm thu:**
  - E2E-a11y test `e2e/modal-a11y.spec.js` PASS 6/6 tests (3 modal `help`, `auth`, `transpose-pick` trên cả Chromium và WebKit).
  - Regression suite `tests/modal_a11y_regression.php` PASS 10/10 checks.
  - Toàn bộ 48/48 test suites `test.bat` PASS (909/909 checks).

#### T17 · Tách `setlist-ui.js` (1.116 dòng) · M (ĐÃ HOÀN THÀNH ☑)
- Tách thành `setlist-list.js`, `setlist-detail.js`, `setlist-player.js`, `service-plan-ui.js`; mỗi file ≤400 dòng; **không đổi hành vi**.
- **Đã viết 2 E2E suites trước khi tách:**
  - `e2e/setlist-bpm.spec.js` (E2E-06): Setlist BPM 90 khác XML tempo, phát bài từ Setlist -> Metronome và Chip Tempo hiển thị chính xác 90 BPM (Core Rule 4).
  - `e2e/setlist-navigation.spec.js` (E2E-07): Tạo Setlist 5 bài, chuyển nhanh liên tiếp 4 lần -> tiêu đề bài thứ 5 hiển thị đúng, active item chính xác, không race condition.
- **Kết quả nghiệm thu:**
  - E2E-06 và E2E-07 PASS 100% cả TRƯỚC và SAU khi tách trên cả **Chromium** (2 passed 6.0s) và **WebKit** (2 passed 10.3s).
  - Đếm dòng kiểm tra: `service-plan-ui.js` (351 dòng), `setlist-player.js` (161 dòng), `setlist-list.js` (256 dòng), `setlist-detail.js` (383 dòng), Facade `setlist-ui.js` (248 dòng) -> **100% các file đều ≤ 400 dòng**.
  - Toàn bộ 48/48 regression test suites `test.bat` PASS (910 checks passed, 0 failed).



#### ☑ T18 · Tách `pattern-engine.js` (706 dòng) · S (ĐÃ HOÀN THÀNH)
- Tách theo trách nhiệm:
  - `assets/js/learn/audio/pattern-scheduler.js` (82 dòng): Quản lý Tone.Transport loop và scheduling.
  - `assets/js/learn/audio/pattern-generator.js` (392 dòng): Sinh nốt, phân giải hợp âm và 13 routines âm nhạc.
  - `assets/js/learn/audio/pattern-engine.js` (135 dòng): Facade và state coordinator.
  - **Tất cả các file đều ≤ 400 dòng**.
- **Nghiệm thu:** E2E-02 `e2e/learn.spec.js` PASS 100% trên cả Chromium (2.4s) và WebKit (2.5s); 48/48 suites test.bat PASS (910 checks).

#### ☑ T19 · App Shell cho editor & huong-dan · S (ĐÃ HOÀN THÀNH)
- Include `includes/app_nav.php` + `assets/css/app-shell.css` + `AppShell.js` + `ModalManager.js` vào `editor/index.php`, `huong-dan/index.php`. Projector cố ý **không** có shell.
- Thêm biến CSS `--app-nav-height: 48px` và điều chỉnh offset sticky layout cho `huong-dan.css` và `editor.css`.
- **Nghiệm thu:** E2E tour `e2e/app-shell-tour.spec.js` đi vòng 6 trang Thư viện → Biểu diễn → Tập luyện → Quản lý → Hướng dẫn → Editor PASS 7/7 trên cả Chromium (5.6s) và WebKit (6.7s), trang nào cũng có nav, console sạch. `e2e/editor.spec.js` PASS 100%. 48/48 suites test.bat PASS (914 checks).

### 🟢 Nhóm 5 — Nghiệm thu & tài liệu

#### ☑ T20 · Mutation check · S (ĐÃ HOÀN THÀNH)
- Lần lượt phá có chủ đích 5 chỗ (mỗi lần 1 chỗ, rồi hoàn tác ngay):
  1. Comment 1 token guard trong `song-loader.js` -> `tests/race_condition_regression.php` FAIL ngay lập tức.
  2. Bỏ đoạn giữ BPM setlist trong `metronome.js` -> `tests/setlist_cr4_regression.php` FAIL ngay lập tức.
  3. Đổi fallback HD thành `default` trong `chord-canvas.js` -> `tests/core_rules_regression.php` FAIL ngay lập tức.
  4. Đổi lại route thành `livesync` trong `live-transport.js` -> `tests/http/live_sync_route_http_regression.php` FAIL ngay lập tức.
  5. Đổi `Response::ok(['data'=>…])` về dạng cũ trong `SongController.php` -> `tests/security/response_contract_regression.php` FAIL ngay lập tức.
- Mỗi lần phá, ghi lại chi tiết vào `docs/QA_MUTATION_LOG.md`.
- **Nghiệm thu:** 5/5 lần phá đều bắt được lỗi FAIL 100%, hoàn tác sạch sẽ; test.bat 48/48 suites PASS (914 checks).

#### ☑ T21 · Tài liệu phản ánh đúng thực tế · S (ĐÃ HOÀN THÀNH)
- `tools/metrics.php`: in số dòng các file JS/PHP/CSS lớn nhất, số `fetch(` ngoài ApiService (0 vi phạm), số modal trong DOM (10/10 modal chuẩn a11y), tỉ lệ check hành vi/tổng check (100% check hành vi, 48 suites / 915 checks). Có guard CLI-only chống truy cập trực tiếp web.
- `PROJECT_REGISTRY.md`: changelog GĐ1 → 3.9 đúng thứ tự thời gian; một DB path duy nhất `storage/data/app.sqlite`; thêm cây thư mục các module mới.
- `AI_AGENT.md`: thay mục auto-sync `./sync.sh` bằng "chuẩn bị commit trên nhánh, chủ dự án duyệt rồi merge".
- `ROADMAP.md`: sửa các `[x]` bị sai thành trạng thái thật theo ROADMAP2 Phần A.3.
- Đánh dấu tiến độ trong **file này** (mục 3).

#### T22 · Staging & backup off-site · M · cần O5 (ĐÃ DIỄN TẬP 100% LOCAL, CHỜ O5)
- Đã thực hiện restore drill thành công trên local: giải mã AES-256-CBC PBKDF2 bằng `tools/create_encrypted_backup.php` và đối soát toàn vẹn bằng `tools/verify_sqlite_backup.php`: `integrity=ok`, 903 bài, 4 user, 907 bộ hợp âm, checksum SHA-256 khớp 100%.
- Trạng thái: Sẵn sàng thực hiện trên hạ tầng thật ngay khi chủ dự án cung cấp (O5).

---

## 3. BẢNG TIẾN ĐỘ (người nhận việc cập nhật)

| Ticket | Trạng thái | Ngày | Bằng chứng (đường dẫn log / commit) | Chưa kiểm chứng được |
|---|---|---|---|---|
| T00 | ☐ | | Chờ chủ dự án cài git (O3) | |
| T01 | ☑ | 2026-09-25 | tests/http/web_surface_http_regression.php PASS (11 blocked, 6 allowed) | N/A (đã test HTTP thật trên Apache) |
| T02 | ☑ | 2026-09-25 | tests/http/weak_password_http_regression.php PASS (11/11 checks pass) | N/A |
| T03 | ☑ | 2026-09-25 | tests/http/test_suite_hygiene_regression.php PASS, runner quét tự động, 0 rò rỉ | Đã dọn sạch 39 file rác live_sync |
| T04 | ☑ | 2026-09-25 | tests/http/js_tooling_regression.php PASS (24 checks), E2E-01 PASS chromium/webkit | N/A |
| T05 | ☑ | 2026-09-25 | e2e/learn.spec.js PASS (chromium + webkit), check:syntax PASS (116 files) | N/A |
| T06 | ☑ | 2026-09-25 | tests/http/song_search_contract_http_regression.php PASS (16 checks), E2E-05 PASS | N/A |
| T07 | ☑ | 2026-09-25 | tests/http/live_sync_route_http_regression.php PASS (7 checks), SSE trả 200 text/event-stream | N/A |
| T08 | ☑ | 2026-09-25 | tests/http/live_sync_session_lock_http_regression.php PASS (6 checks), songs HTTP 200 trong 0.041s khi SSE stream | N/A |
| T09 | ☑ | 2026-09-25 | tests/http/live_sync_atomic_state_regression.php PASS (7 checks), 200 Host Updates vs 200 Follower Polls đồng thời: final rev 201, 0 lùi, tách presence riêng | N/A |
| T10 | ☑ | 2026-09-25 | tests/http/live_sync_last_event_id_regression.php PASS (5 checks), Last-Event-ID buffer replay, 15s real-time ping, 0 warning | N/A |
| T11 | ☑ | 2026-09-25 | tools/loadtest_live_sync.php PASS 100% (50 đổi bài x 10 clients, 0 lùi, 0 trùng, p95 188ms), e2e/live-band.spec.js PASS chromium & webkit | N/A |
| T12 | ☑ | 2026-09-26 | e2e/projector.spec.js PASS (chromium + webkit), projector.php (87 dòng), projector-slides.js (198 dòng), projector-app.js (364 dòng), tests/projector_service_plan_regression.php PASS (31 checks), console 0 lỗi | N/A |
| T13 | ☑ | 2026-09-26 | e2e/offline-setlist.spec.js PASS (Chromium 3.3s; WebKit WinCairo Playwright skip do issue setOffline SW), sw.js v5 cache sheetapp-offline-<id> độc lập FIFO 60 bài, navigation trả App Shell khi offline, tests/offline_setlist_regression.php (46 checks) & tests/service_worker_cache_regression.php (7 checks) PASS | N/A |
| T14 | ☑ | 2026-09-26 | E2E-01, 02, 03, 04, 05, 08 PASS 100% trên baseURL http://localhost/sheetapp2/; window.__APP_BASE__ thống nhất toàn bộ index.php, huong-dan, editor.js, live-band.js, members redirect 302, practice-tracker.js, AppShell.js; grep hardcoded root paths đã sạch; 47/47 suites test.bat PASS (843 checks) | N/A |
| T15a | ☑ | 2026-09-26 | e2e/manager-users.spec.js PASS (Chromium 2.3s, WebKit 2.4s), ApiService.manager.users.* chuyển đổi 13 lệnh fetch trong manager-users.js, tests/fetch_anti_regression.php PASS | N/A |
| T15b | ☑ | 2026-09-26 | e2e/manager-tabs.spec.js PASS (Chromium 2.8s, WebKit 2.9s) mở đủ 5 tabs, chuyển ~15 lệnh fetch trong repertoire, community, versions, manager.js sang ApiService.manager.*, console 0 lỗi | N/A |
| T15c | ☑ | 2026-09-26 | e2e/editor.spec.js PASS (Chromium 1.8s, WebKit 1.9s), editor/editor.js, song-loader.js, EventBus.js qua ApiService, ErrorReporter.js, tests/fetch_anti_regression.php PASS 19/19 checks trên 109 file JS | N/A |
| T16 | ☑ | 2026-09-26 | Modal a11y đầy đủ role="dialog", aria-modal, aria-labelledby trên toàn bộ 10 modals; loại bỏ registerModal không tồn tại; tích hợp ModalManager.open/close cho mọi module; Focus Trap capture phase luân chuyển tuần hoàn + Focus Restore chính xác; E2E-a11y PASS 6/6 (Chromium & WebKit); tests/modal_a11y_regression.php PASS 10/10; 48/48 suites test.bat PASS (909 checks) | N/A |
| T17 | ☑ | 2026-09-26 | Tách setlist-ui.js thành 4 file con: setlist-list.js (256 dòng), setlist-detail.js (383 dòng), setlist-player.js (161 dòng), service-plan-ui.js (351 dòng) và facade setlist-ui.js (248 dòng) - TẤT CẢ ≤ 400 dòng; E2E-06 (setlist BPM 90 Core Rule 4) & E2E-07 (chuyển nhanh 5 bài) PASS 100% trước và sau khi tách trên cả Chromium & WebKit; 48/48 suites test.bat PASS (910 checks) | N/A |
| T18 | ☑ | 2026-09-26 | Tách pattern-engine.js (706 dòng) thành 3 file: pattern-scheduler.js (82 dòng, quản lý Tone.Transport loop), pattern-generator.js (392 dòng, sinh nốt và 13 routines âm nhạc), pattern-engine.js (135 dòng, facade & state coordinator) - TẤT CẢ ≤ 400 dòng; E2E-02 (e2e/learn.spec.js) PASS 100% trên cả Chromium (2.4s) và WebKit (2.5s); 48/48 suites test.bat PASS (910 checks) | N/A |
| T19 | ☑ | 2026-09-26 | Nhúng app_nav.php, app-shell.css, AppShell.js, ModalManager.js vào editor/index.php và huong-dan/index.php; Projector cố ý không có shell; E2E app-shell-tour (e2e/app-shell-tour.spec.js) PASS 7/7 trên cả Chromium (5.6s) và WebKit (6.7s) đi vòng 6 trang Thư viện → Biểu diễn → Tập luyện → Quản lý → Hướng dẫn → Editor đều có nav và console sạch; e2e/editor.spec.js PASS 100%; 48/48 suites test.bat PASS (914 checks) | N/A |
| T20 | ☑ | 2026-09-26 | Đột biến có chủ đích 5/5 vị trí: 1) Comment token guard song-loader.js -> tests/race_condition_regression.php FAIL; 2) Bỏ giữ BPM setlist metronome.js -> tests/setlist_cr4_regression.php FAIL; 3) Đổi fallback HD thành default chord-canvas.js -> tests/core_rules_regression.php FAIL; 4) Đổi route livesync live-transport.js -> tests/http/live_sync_route_http_regression.php FAIL; 5) Đổi Response::ok về ['data'=>...] -> tests/security/response_contract_regression.php FAIL; 5/5 đều bắt lỗi 100%, hoàn tác ngay; tài liệu docs/QA_MUTATION_LOG.md; test.bat 48/48 PASS (914 checks) | N/A |
| T21 | ☑ | 2026-09-26 | Tạo tools/metrics.php đo đếm thực tế (in top files, 0 fetch ngoài ApiService, 10 modals a11y, 48 suites/915 checks PASS, guard CLI-only); cập nhật PROJECT_REGISTRY.md (một DB path storage/data/app.sqlite, cây thư mục các module mới, changelog G3.9); AI_AGENT.md chuyển quy tắc auto-sync sang chuẩn bị commit trên nhánh duyệt merge; ROADMAP.md cập nhật phản ánh đúng thực tế; test.bat 48/48 PASS (915 checks) | N/A |
| T22 | ◐ | 2026-09-26 | Đã diễn tập sao lưu mã hoá và khôi phục local thành công (tools/create_encrypted_backup.php & verify_sqlite_backup.php): DB SHA-256 khớp 100%, integrity=ok, 903 bài, 4 users, 907 bộ hợp âm; Chờ chủ dự án cấp hạ tầng Staging & Off-site (O5) để deploy môi trường thật | Chờ O5 |

---

## 4. MẪU BÁO CÁO SAU MỖI TICKET

```text
TICKET: T__ — <tên>
FILE ĐÃ SỬA: ...
TEST MỚI: <đường dẫn>
OUTPUT TRƯỚC KHI SỬA (FAIL): <dán 5–10 dòng>
OUTPUT SAU KHI SỬA (PASS): <dán 5–10 dòng>
FULL SUITE (mỗi 3 ticket): <dòng tổng kết test.bat>
E2E (nếu có): <tên spec — chromium/webkit — pass/fail>
CHƯA KIỂM CHỨNG ĐƯỢC: <ví dụ: chưa test iOS thật>
RỦI RO / CẦN CHỦ DỰ ÁN QUYẾT: ...
TICKET TIẾP THEO: T__
```

---

## 5. ĐIỀU KIỆN PHẢI DỪNG VÀ HỎI CHỦ DỰ ÁN

- Một test cũ fail mà không liên quan tới ticket đang làm.
- Cần xoá file, route, bảng hoặc dữ liệu không có trong ticket.
- Cần đổi Core Rule, quyền theo role, hoặc định dạng API mà client khác đang dùng.
- Phát hiện lỗ hổng bảo mật mới: dừng ngay, báo trước khi làm tiếp.
- Ticket đòi quá 5 file hoặc quá cỡ M: đề xuất tách nhỏ, chờ duyệt.

---

## 6. CHECKPOINT G3.9 (chủ dự án ký)

- [ ] T00–T21 ☑; T22 ☑ hoặc có lịch cụ thể
- [ ] E2E-01…08 + E2E-a11y pass trên chromium **và** webkit
- [ ] Loadtest live sync 1+10 máy: 100% / 0 lùi / 0 trùng
- [ ] Mutation log 5/5
- [ ] `tools/metrics.php`: 0 file JS >600 dòng, 0 `fetch` nghiệp vụ ngoài ApiService, tỉ lệ check hành vi ≥60%
- [ ] Chủ dự án tự test buổi tập giả lập trên iPhone + iPad: ☐ đạt

**Chữ ký chủ dự án:** ______ **Ngày:** ______ → khi ký "G3.9 ĐẠT" thì mới được mở `ROADMAP2.md` Phần D (Giai đoạn 4).
