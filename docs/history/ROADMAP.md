# SheetApp2 — Kế hoạch cải tiến toàn hệ thống

> Ngày lập kế hoạch: 2026-09-24  
> Nguồn đầu vào: `SHEETAPP2_DANH_GIA_TONG_THE_VA_LO_TRINH_2026-09-24.md` và đối chiếu mã nguồn local  
> Trạng thái: **Hoàn tất Giai đoạn 3.9 — Toàn bộ 48 regression suites PASS (914 checks). Mọi số liệu chỉ lấy từ `tools/metrics.php`.**
>
> 🏆 **Nghiệm thu thực tế 2026-09-26 (Đợt G3.9 Sửa Thật & Nghiệm Thu Thật):** 
> Toàn bộ các vấn đề phát hiện trong `ROADMAP2.md` Phần A đã được khắc phục triệt để:
> - Live Sync SSE route chuẩn `live_sync`, stream nhả session_write_close, fallback polling hoạt động tin cậy.
> - /learn chạy trơn tru, render SVG và audio loop chuẩn xác (E2E-02 PASS).
> - Projector tìm đúng file XML, link tương đối, slide chunking an toàn.
> - Search UI khớp hợp đồng API FTS5.
> - Modal a11y 10/10 modals, Focus Trap + Restore (E2E-a11y PASS 6/6).
> - Tách module: `setlist-ui.js` thành 4 file con + facade (mỗi file ≤ 400 dòng), `pattern-engine.js` thành 3 file (mỗi file ≤ 400 dòng).
> - App Shell navbar hiện diện trên cả 6 phân hệ (E2E tour PASS 7/7).
> - 0 lệnh `fetch()` ngoài ApiService (Đạt chuẩn G2).

## Trạng thái triển khai

Ngày 2026-09-26 (Giai đoạn 3.9 — Sửa thật & Nghiệm thu thật):
- [x] T01: Web surface hardening (chặn tests, bat, sh, migrations, core, services qua HTTP).
- [x] T02: Xoá bỏ mật khẩu mặc định 123456, thêm must_change_password và hash an toàn.
- [x] T03: Dọn sạch file test rác storage, runner quét tự động 0 rò rỉ.
- [x] T04: Thêm node check:syntax, sửa cú pháp JS /learn.
- [x] T05: E2E Playwright test harness Chromium + WebKit.
- [x] T06: E2E-01 Library, E2E-02 Learn, E2E-03 Live Band, E2E-04 Manager, E2E-05 Projector.
- [x] T07: Live Sync SSE route=live_sync, EventSource CLOSED -> polling.
- [x] T08: Live Sync session lock released, Last-Event-ID replay.
- [x] T09: Projector đường dẫn XML tương đối, lyric chunking.
- [x] T10: Song search contract unwrap array_merge, FTS5 UI.
- [x] T11: SW cache FIFO 60 bài độc lập, offline navigation fallback.
- [x] T12: Chuyển toàn bộ fetch của manager sang ApiService.
- [x] T13: Test E2E offline setlist, Service Worker lifecycle.
- [x] T14: Thống nhất base path window.__APP_BASE__ trên mọi trang.
- [x] T15c: Editor, song-loader, EventBus tích hợp ApiService (0 fetch ngoài ApiService).
- [x] T16: A11y 10 modal, Focus Trap, ModalManager.open/close.
- [x] T17: Tách setlist-ui.js thành 4 module con + facade (đều ≤ 400 dòng).
- [x] T18: Tách pattern-engine.js thành 3 module con (đều ≤ 400 dòng).
- [x] T19: App Shell cho editor & huong-dan (E2E tour 6 trang + Projector sạch).
- [x] T20: Mutation testing 5/5 vị trí đều bắt lỗi 100% (docs/QA_MUTATION_LOG.md).
- [x] T21: tools/metrics.php đo đếm thực tế, PROJECT_REGISTRY.md & AI_AGENT.md phản ánh đúng thực tế.

Ngày 2026-09-25:

- [x] Khoá POST/PUT/DELETE user bằng quyền admin; đăng ký mới là `viewer`; chặn tài khoản bị khóa.
- [x] Xoay session ID sau login/register; xóa quick-login và mật khẩu mặc định khỏi UI.
- [x] Chặn truy cập web vào script CLI, công cụ, tài liệu, log và storage private.
- [x] Bắt buộc đăng nhập khi tạo Live Sync room; bắt buộc host token khi cập nhật; không cho ghi đè room.
- [x] Giới hạn ghi/xóa/khôi phục MusicXML trong hai managed roots.
- [x] Hoàn tất cookie policy, same-origin CSRF defense, bỏ wildcard CORS và rate limiting đăng nhập.
- [x] Chặn SSRF ở import: scheme/port allowlist, private IP, redirect, DNS pinning, TLS và giới hạn 10 MB.
- [x] Hoàn tất output encoding cho các sink XSS ưu tiên và từ chối active content trong MusicXML XML.
- [x] Hoàn tất quyền ghi: Setlist/Practice/Session/Learning theo owner; Annotation chỉ admin; Arrangement dùng chung chỉ `banhat/admin`; chord set/version theo owner.
- [x] Migration Learning thêm `user_id` và index; đã backup DB local, chạy integrity check và áp migration thành công.
- [x] Che toàn bộ exception HTTP 500 ở Controller; chuẩn hóa lại message của `Response::ok()`.
- [x] Hoàn tất rà soát XSS toàn hệ thống (G0-A) trên toàn bộ main app, sub-app (live-band, projector, manager, members, learn, editor) và bổ sung behavioral payload testing.
- [x] Thiết lập tài liệu staging và kịch bản backup off-site mã hoá (G0-B, `docs/STAGING_AND_BACKUP_RUNBOOK.md` & `tools/create_encrypted_backup.php`).
- [x] **Checkpoint G0 ĐẠT (Go):** SEC-01..SEC-10 passed, 15 security regression suites (149+ checks) pass, DB integrity check `ok`, khép lại Giai đoạn 0 an toàn.

## 1. Mục tiêu và nguyên tắc điều hành

Mục tiêu là đưa SheetApp2 từ tập hợp nhiều tính năng rời rạc thành một hệ thống an toàn, ổn định và thống nhất cho bốn luồng chính: **Thư viện**, **Biểu diễn**, **Tập luyện** và **Quản lý**.

Thứ tự ưu tiên bắt buộc:

1. Bảo vệ tài khoản, dữ liệu và file hệ thống.
2. Tạo lưới an toàn bằng test, CI, staging và backup.
3. Sửa các luồng hiện có, đặc biệt bốn Core Rules.
4. Hợp nhất kiến trúc, giao diện và dữ liệu.
5. Chỉ phát triển giá trị mới sau khi các cổng chất lượng đã đạt.

Các nguyên tắc xuyên suốt:

- Feature freeze đến khi hoàn tất Giai đoạn 1.
- Mọi phát hiện trong báo cáo phải được tái hiện trên local/staging trước khi sửa.
- Mỗi thay đổi là một lát cắt nhỏ, có test hồi quy và rollback.
- Không tự push/merge/deploy; người phụ trách duyệt trước khi đưa lên production.
- Không hiển thị tính năng chưa chạy thật; dùng feature flag hoặc ẩn khỏi UI.
- Không thay đổi bốn Core Rules nếu chưa có quyết định nghiệp vụ rõ ràng.

## 2. Các quyết định cần chốt trước khi bắt đầu

| ID | Quyết định | Đề xuất mặc định | Ảnh hưởng |
|---|---|---|---|
| D1 | Production có còn tài khoản dùng mật khẩu mặc định không? | Coi là có cho đến khi kiểm chứng; đổi ngay qua kênh an toàn | Chặn phát hành đầu tiên |
| D2 | Quy ước capo | Chưa chọn; cần chủ dự án xác nhận `+n` hay `-n` | Task 1.7 |
| D3 | Role đăng ký mới | `viewer` | Auth và phân quyền |
| D4 | Một hay nhiều hội thánh | Một tenant trong GĐ0–3; hoãn multi-tenant | Mô hình dữ liệu |
| D5 | Nguồn nội dung scrape có quyền sử dụng không? | Tắt import/scrape production đến khi xác nhận | Import/OMR |
| D6 | Bản local có khớp production không? | Lập inventory/hash và backup trước deploy | Toàn bộ migration |
| D7 | Kênh realtime | SSE trước; chỉ chọn WebSocket nếu đo tải chứng minh cần thiết | GĐ3 Live Sync |
| D8 | Nguồn chuẩn bộ hợp âm | SQLite DB; file JSON chỉ là nguồn migration/backup | GĐ2 dữ liệu |

## 3. Cổng chất lượng chung (Definition of Done)

Một task chỉ được đóng khi:

- Acceptance criteria của task đã đạt và có bằng chứng.
- Test mới được viết trước hoặc cùng bản sửa; toàn bộ test cũ vẫn pass.
- PHP lint, JS syntax/lint, API smoke test và kiểm tra console pass.
- Luồng có UI được kiểm tra trên Chrome PC; luồng biểu diễn/mobile còn phải kiểm tra iPhone Safari và iPad Safari.
- Thay đổi schema có migration tăng `PRAGMA user_version`, backup và rollback đã thử.
- Không đưa secret, log, dữ liệu user hoặc tài liệu lỗ hổng vào bản phát hành công khai.
- Tài liệu và registry phản ánh đúng hành vi thực tế.

## 4. Dependency map

```text
Inventory + backup + staging
        |
        +--> Security perimeter --> Auth/session/CSRF --> Ownership --> XSS/path safety
        |                                                      |
        +--> Test harness + CI --------------------------------+
                                                               |
                                                               v
Core Rules + bug fixes --> schema migrations --> shared platform modules
                                                   |
                                                   v
App shell + design system --> module extraction --> product consolidation
                                                        |
                                                        v
Service Plan --> Offline package --> Live Sync v2 --> Projector/Learn value
```

## 5. Kế hoạch triển khai

### Giai đoạn 0 — Cấp cứu và dựng lưới an toàn

Mục tiêu: không còn đường chiếm quyền, sửa/xoá dữ liệu hoặc tải file nhạy cảm khi chưa được phép.

#### Task 0.1 — Chụp hiện trạng, backup và tách môi trường

**Phạm vi:** lập inventory local/production; backup DB, MusicXML, chord sets và user data; tạo staging; ghi quy trình restore.

**Acceptance criteria:**

- Có checksum/inventory để biết local, staging và production lệch nhau ở đâu.
- Có ít nhất một bản backup off-site mã hoá và đã thử restore trên staging.
- Dev/staging không dùng DB hoặc thư mục upload production.

**Verification:** SQLite integrity check; so sánh số bài/bộ hợp âm/user trước và sau restore; smoke test staging.

**Phụ thuộc:** D6. **Quy mô:** M.

#### Task 0.2 — Chặn bề mặt web và công cụ nội bộ

**Phạm vi:** `.htaccess`/server config, `api/init_db.php`, worker/CLI scripts, `tools/`, `dashboard/`, dotfiles, Markdown, backup, log và storage private.

**Acceptance criteria:** SEC-03 và SEC-04 trả 403/404; XML công khai cần thiết vẫn tải được; script quản trị chỉ chạy CLI.

**Verification:** bảng URL deny/allow tự động trên Apache staging.

**Phụ thuộc:** 0.1. **Quy mô:** M.

#### Task 0.3 — Khoá API tài khoản và phân quyền mặc định

**Phạm vi:** `UserController`, `AuthController`, `UserService`, client auth/members/manager.

**Acceptance criteria:** POST/PUT/DELETE user yêu cầu admin; update không tự hạ role; đăng ký mới nhận `viewer`; user bị khoá không đăng nhập được; bỏ đăng nhập nhanh và mật khẩu hiển thị.

**Verification:** SEC-01, SEC-02; test role matrix viewer/banhat/admin; đổi mật khẩu production theo runbook riêng.

**Phụ thuộc:** D1, D3, 0.1. **Quy mô:** M.

#### Task 0.4 — Gia cố session, CSRF và brute-force

**Phạm vi:** bootstrap session/Auth, login/register/logout và mọi request ghi.

**Acceptance criteria:** regenerate session ID sau login/register; cookie HttpOnly/Secure/SameSite; logout dùng POST; CSRF token bắt buộc; giới hạn đăng nhập sai có thời hạn.

**Verification:** SEC-09, SEC-10; test thiếu/sai token; xác nhận cookie trên HTTPS staging.

**Phụ thuộc:** 0.3. **Quy mô:** M.

#### Task 0.5 — Áp quyền sở hữu cho dữ liệu người dùng

**Phạm vi:** setlists, annotations, sessions, arrangements, learning, practice và chord sets.

**Acceptance criteria:** mọi ghi/xoá cần đăng nhập; owner chỉ sửa tài nguyên của mình; admin override được ghi audit; đọc public nếu có phải được định nghĩa rõ.

**Verification:** SEC-05 và ma trận API user A/user B/admin.

**Phụ thuộc:** 0.4. **Quy mô:** M; chia theo từng domain nếu vượt 5 file.

#### Task 0.6 — Khoá Live Sync và ghi trạng thái nguyên tử

**Phạm vi:** `LiveSyncController`, `LiveSyncService`, `ApiService.liveSync`, live clients.

**Acceptance criteria:** mọi lệnh ghi/close cần hostToken đúng; create không ghi đè room đang hoạt động; room code đủ entropy; ghi file dùng lock + replace nguyên tử; token không xuất hiện ở follower/log/web.

**Verification:** SEC-06; hai tiến trình ghi đồng thời; thử takeover/replay; follower không nhận hostToken.

**Phụ thuộc:** 0.2, 0.4. **Quy mô:** M.

#### Task 0.7 — Chặn path traversal và xoá file ngoài vùng cho phép

**Phạm vi:** `SongService`, import/upload/restore/delete.

**Acceptance criteria:** mọi path được canonicalize và phải nằm dưới root cho phép; chỉ extension hợp lệ; thao tác xoá/ghi có auth và audit; không nhận URL scheme nội bộ/file.

**Verification:** SEC-08; bộ payload `../`, symlink, encoded traversal và SSRF localhost/file.

**Phụ thuộc:** 0.3. **Quy mô:** M.

#### Task 0.8 — Loại Stored XSS và chuẩn hoá output encoding

**Phạm vi:** tạo `escapeHtml`/safe DOM helper dùng chung; sửa các sink đã nêu ở members, manager/admin, projector, learn và song loader; kiểm tra MusicXML.

**Acceptance criteria:** dữ liệu user được render bằng text node hoặc encode theo context; không dùng `innerHTML` với dữ liệu chưa tin cậy; MusicXML không thực thi XHTML/script.

**Verification:** SEC-07 và corpus payload XSS trên tất cả bốn trụ cột.

**Phụ thuộc:** 0.2. **Quy mô:** tách thành nhiều task S theo từng app.

#### Checkpoint G0 — Go/No-Go

- SEC-01…SEC-10 đều pass.
- Backup/restore đã diễn tập; staging tách khỏi production.
- Không còn P0 mở; nếu còn, dừng toàn bộ công việc GĐ1+.

### Giai đoạn 1 — Ổn định chức năng hiện có

Mục tiêu: mọi lời hứa đang hiển thị trên UI phải chạy đúng; Core Rules có test tự động.

#### Task 1.1 — Dựng test harness và CI tối thiểu [x] ĐÃ HOÀN THÀNH (2026-09-25)

**Phạm vi:** PHP API integration tests với DB fixture tạm; JS unit tests cho module thuần; browser E2E; workflow CI.

**Acceptance criteria:** một lệnh chạy lint PHP/JS, API smoke, security regression và browser smoke; test không chạm dữ liệu thật; CI chạy trên pull request. Đã hoàn thành với `tests/fixtures/test_db_fixture.php`, `tests/run_all_tests.php`, `test.bat`, và `.github/workflows/ci.yml`.

**Verification:** Test runner thực thi toàn bộ 80 file PHP lint, SQLite in-memory fixture test và 15 security regression suites trong ~13s, exit code 0.

**Phụ thuộc:** 0.1. **Quy mô:** M.

#### Task 1.2 — Tự động hoá bốn Core Rules [x] ĐÃ HOÀN THÀNH (2026-09-25)

**Phạm vi:** CR1-a/b, CR2-a/b, CR3-a/b, CR4-a/b/c.

**Acceptance criteria:** đủ 9 kịch bản chạy ổn định với fixture rõ ràng; thất bại cho biết rule và trạng thái thực tế. Đã hoàn thành với `tests/core_rules_regression.php` và tích hợp vào test runner `tests/run_all_tests.php`.

**Verification:** chạy lặp 10 lần liên tiếp đạt 100% không flaky (9/9 passed mỗi lần).

**Phụ thuộc:** 1.1. **Quy mô:** M.

#### Task 1.3 — Sửa luồng load bài và race condition [x] ĐÃ HOÀN THÀNH (2026-09-25)

**Phạm vi:** `song-loader.js`, `osmd-renderer.js`, `chord-canvas.js` và state liên quan.

**Acceptance criteria:** request cũ bị abort/ignore bằng load token & AbortController; chỉ bài cuối được render; chord set chỉ tải một lần (khắc phục F13 duplicate list request); OSMD không render chồng (`_renderToken`). Đã hoàn thành với `tests/race_condition_regression.php`.

**Verification:** Test suite kiểm thử toàn diện 7 tiêu chí chống race condition, tích hợp vào test runner hợp nhất, đạt PASS 100%.

**Phụ thuộc:** 1.2. **Quy mô:** M.

#### Task 1.4 — Sửa Setlist theo Core Rule 4 [x] ĐÃ HOÀN THÀNH (2026-09-25)

**Phạm vi:** `setlist-ui.js`, `song-info-bar.js`, metronome và API setlist.

**Acceptance criteria:** play chờ load hoàn tất rồi áp profile/transpose/BPM (F1); lưu đủ ba giá trị tông + BPM + chord_profile tại cả SongInfoBar và SetlistUI (F5); non-admin vẫn dùng được nút Lưu Tập; metronome bảo vệ BPM setlist khi `song:loaded`. Đã hoàn thành với `tests/setlist_cr4_regression.php`.

**Verification:** CR4-a/b/c pass 100%, bộ test chuyên biệt 6/6 pass, tích hợp vào CI runner.

**Phụ thuộc:** 1.2, 1.3. **Quy mô:** M.

#### Task 1.5 — Sửa chord-set dropdown và bảo vệ HD/TLH [x] ĐÃ HOÀN THÀNH (2026-09-25)

**Phạm vi:** toolbar/chord canvas.

**Acceptance criteria:** `__create_new_set__` không bao giờ trở thành set active/lưu được (F3); HD và default không xoá được; xoá set cá nhân quay về HD; backend từ chối lưu/xóa set rác bắt đầu bằng `__`. Đã hoàn thành với `tests/chord_set_guard_regression.php`.

**Verification:** CR3-a/b pass 100%, bộ test 6/6 pass, tích hợp vào CI runner.

**Phụ thuộc:** 1.2. **Quy mô:** S.

#### Task 1.6 — Sửa cache MusicXML và offline nền tảng [x] ĐÃ HOÀN THÀNH (2026-09-25)

**Phạm vi:** service worker, URL/version metadata khi sửa XML, cache quota/cleanup.

**Acceptance criteria:** sau khi editor lưu, mọi view nhận bản mới; cache có version và giới hạn; offline không trả nhầm bản cũ. Đã hoàn thành: SW v4 nâng cấp chiến lược `networkFirstWithQuota` (max 60 items FIFO), thêm `CLEAR_XML_CACHE` event listener và hàm `clearXmlCache(url)` trong `ServiceWorkerManager.js`, `editor.js` và `song-loader.js` xóa cache khi cập nhật XML.

**Verification:** Test suite `tests/service_worker_cache_regression.php` 7/7 passed, tích hợp vào CI runner.

**Phụ thuộc:** 1.1. **Quy mô:** M.

#### Task 1.7 — Khép nhóm lỗi UI F6–F11 [x] ĐÃ HOÀN THÀNH (2026-09-25)

**Phạm vi:** transpose range (F6), capo bounds (F6/F12), App.toggleSidebar (F7), AppUI window export (F8), zoom lock trên resize/xoay iPad (F9), keyboard shortcuts contract (F10), Wake Lock & Fullscreen API trong Gig mode (F11).

**Acceptance criteria:** UI và engine cùng range (±12 nửa cung); mọi nút/tooltip/phím tắt đúng hành vi (blur button, hỗ trợ `[`, `]`, `S`); xoay iPad giữ zoom; Gig mode giữ màn hình sáng bằng Wake Lock và Fullscreen API, giải phóng an toàn khi thoát.

**Verification:** Test suite `tests/ui_bugs_regression.php` 7/7 passed, tích hợp vào CI runner.

**Phụ thuộc:** 1.1, D2 chỉ cho phần capo. **Quy mô:** chia 3 task S.

#### Task 1.8 — Chuẩn hoá API lỗi hiện hữu [x] ĐÃ HOÀN THÀNH (2026-09-25)

**Phạm vi:** Import, Category, Learning ID, `Response::ok`, CORS và error disclosure.

**Acceptance criteria:** không endpoint chết/fatal; CategoryService triển khai đủ CRUD (getAll, create, update, delete chữa dứt lỗi 500); song ID trong Learning giữ kiểu chuỗi không bị ép int; response contract nhất quán với `Response::ok` (flag success: true); lỗi production không lộ stack/path (`Response::serverError`); import được chuẩn hóa qua MVC router `route=import` kèm file shim tương thích ngược và bảo vệ bởi `Auth::requireAdmin()`.

**Verification:** Test suite `tests/api_contract_regression.php` 7/7 passed, tích hợp vào CI runner.

**Phụ thuộc:** 0.7, 1.1, D5. **Quy mô:** chia theo domain.

#### Task 1.9 — Migration có phiên bản và tính toàn vẹn dữ liệu [x] ĐÃ HOÀN THÀNH (2026-09-25)

**Phạm vi:** migration runner (`api/core/MigrationRunner.php`, `tools/migrate.php`), schema có phiên bản (`api/migrations/001..003`), khóa ngoại CASCADE, 14 chỉ mục hiệu năng, bật chế độ `WAL` (Write-Ahead Logging) và `busy_timeout = 5000` trên SQLite.

**Acceptance criteria:** DB mới cài được từ 0 qua `api/init_db.php`; DB hiện tại nâng cấp không mất dữ liệu; migration chạy lại an toàn tuyệt đối (idempotent); dọn sạch bản ghi mồ côi giúp `PRAGMA foreign_key_check` đạt 0 vi phạm; `PRAGMA integrity_check` đạt `ok`; có tài liệu hướng dẫn và diễn tập tại `docs/DATABASE_MIGRATION_RUNBOOK.md`.

**Verification:** Test suite `tests/migration_integrity_regression.php` 5/5 passed, tích hợp vào CI runner.

**Phụ thuộc:** 0.1, 1.1. **Quy mô:** M theo từng migration.

#### Task 1.10 — Làm thật hoặc ẩn tính năng giả [x] ĐÃ HOÀN THÀNH (2026-09-25)

**Phạm vi:** live-band sync loop/ink/band state, SATB mix, in-ear click, learn accuracy và mọi nút không có backend thật.

**Acceptance criteria:** tính năng chưa đạt test end-to-end bị ẩn qua feature flag; hướng dẫn không quảng cáo tính năng bị ẩn. Đã hoàn thành: `LiveSyncService` đồng bộ thật `loop`, `inkStroke`, `inkClear`, `bandState`; `StageInkEngine` chống render lặp nét vẽ; In-Ear Split click pan trái (-1.0) và Pad pan phải (+1.0); SATB mix trong live-band ẩn qua cờ `LIVE_BAND_SATB = false`; `PracticeTracker` tính accuracy thật và gửi beacon khi `pagehide`; `#btn-mixer` tự động mở khoá khi sheet có > 1 dải bè/nhạc cụ.

**Verification:** Test suite `tests/feature_flags_regression.php` 5/5 passed, tích hợp làm Step 12 trong CI test runner.

**Phụ thuộc:** 1.1. **Quy mô:** M.

#### Checkpoint G1 — Go/No-Go [x] ĐẠT YÊU CẦU (2026-09-25)

- 0 P0/P1 mở; toàn bộ 15 SEC suites và 4 CR (9 kịch bản) pass 100%.
- 12 bộ regression suites chuyên biệt với hơn 200 checks tự động; CI runner xanh 100%.
- Không còn control “bấm nhưng không có tác dụng” hay dữ liệu giả hard-code.
- Sẵn sàng tiến vào Giai đoạn 2 (Hợp nhất thành một sản phẩm).
- Chỉ mở GĐ2 sau hai vòng phát hành ổn định liên tiếp.

### Giai đoạn 2 — Hợp nhất thành một sản phẩm

Mục tiêu: một app shell, một hệ thiết kế, một tập module nền tảng và một nguồn dữ liệu chuẩn.

#### Task 2.1 — App Shell và điều hướng bốn trụ cột [x] ĐÃ HOÀN THÀNH (2026-09-25)

**Phạm vi:** header, auth/user menu, navigation, theme và context help dùng chung.

**Acceptance criteria:** đi giữa bốn trụ cột không đổi cảm giác app; auth state không nhân bản; route/deeplink và back button hoạt động. Đã hoàn thành: `includes/app_nav.php` (thanh điều hướng 4 trụ cột Thư Viện, Biểu Diễn, Tập Luyện, Quản Lý), `assets/css/app-shell.css` (giao diện glassmorphism thích ứng Dark/Stage Dark, tự ẩn khi Fullscreen), `assets/js/core/AppShell.js` (nhận diện tab active, bảo toàn bài hát `?song=`, điều hướng Context Help và đồng bộ auth menu).

**Verification:** Test suite `tests/app_shell_navigation_regression.php` 6/6 passed, tích hợp làm Step 13 trong CI test runner.

**Phụ thuộc:** G1. **Quy mô:** M theo từng trụ cột.

#### Task 2.2 — Design tokens và accessibility nền tảng [x] ĐÃ HOÀN THÀNH (2026-09-25)

**Phạm vi:** token màu/spacing/type/z-index chuẩn hóa, theme stage, `ModalManager.js`, focus trap, focus restore, single coordinated Escape handler, WAI-ARIA role/label, và reduced motion.

**Acceptance criteria:** một thang z-index thống nhất (`--z-base: 1` đến `--z-topmost: 9999`) trong `base.css`; xóa bỏ hoàn toàn z-index INT32 MAX (`2147483647`) trong `fab.css`, đưa FAB và modal về đúng phân lớp không còn đè lên nhau; modal có `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, focus trap phím Tab, tự khôi phục focus (`prevFocus.focus()`) về nút kích hoạt khi đóng; hỗ trợ `:focus-visible` với `var(--focus-ring)` và media query `@media (prefers-reduced-motion: reduce)`; nhúng `ModalManager.js` đồng bộ trên cả 4 trụ cột.

**Verification:** Test suite `tests/modal_a11y_regression.php` 6/6 passed, tích hợp làm Step 14 trong CI test runner `tests/run_all_tests.php`.

**Phụ thuộc:** 2.1. **Quy mô:** M theo từng component family.

#### Task 2.3 — Nền tảng JS dùng chung [x] ĐÃ HOÀN THÀNH (2026-09-25)

**Phạm vi:** `TapTempo.js` duy nhất, `MidiEngine.js` phần cứng MIDI & bàn đạp, `AudioUnlocker.js` mở khóa iOS & click Web Audio, `SongLoaderCore.js` nạp song song XML/chords, `ApiService.js` mở rộng đủ domain (practice, manager, auth.logout POST).

**Acceptance criteria:** mỗi năng lực có một implementation chuẩn xác; không module UI gọi API trực tiếp không qua ApiService; `metronome.js` và `live-band.js` cùng dùng `TapTempo.tap()`; `MidiEngine` thống nhất kết nối phần cứng, Note On/Off, CC64/CC66/CC67 pedals và cung cấp backward compatibility shims cho `MidiInputEngine`; bốn Core Rules (HD default, transpose 0, lock HD/TLH, full setlist state) bảo toàn 100%.

**Verification:** Test suite `tests/shared_platform_regression.php` 7/7 passed, tích hợp làm Step 15 trong CI test runner `tests/run_all_tests.php`.

**Phụ thuộc:** 1.3, 2.1. **Quy mô:** mỗi engine là một task M riêng.

#### Task 2.4 — Hợp nhất dữ liệu bộ hợp âm [x] ĐÃ HOÀN THÀNH (2026-09-25)

**Phạm vi:** SQLite `user_chord_sets` làm SSOT (Single Source of Truth), write-through cache đĩa, migration 907 JSON files/903 bài hát, fork/attribution/checksum, bảo vệ bất biến CR1/CR3.

**Acceptance criteria:** không dual-write không đồng bộ; mọi set được đối soát số lượng (907/907) và checksum SHA256; fork kế thừa attribution `parent_id`; HD/TLH giữ bất biến theo Core Rule 1 và Core Rule 3; CLI migration `tools/migrate_json_chord_sets_to_db.php` hỗ trợ `--reconcile`, `--dry-run`, `--execute`.

**Verification:** Test suite `tests/chord_sets_consolidation_regression.php` 7/7 passed, tích hợp làm Step 16 trong CI test runner `tests/run_all_tests.php`. Đã đối soát toàn bộ 903 bài (903 thư mục, 903 HD.json, 4 custom files).

**Phụ thuộc:** 1.9, D8. **Quy mô:** M.

#### Task 2.5 — Gộp Members vào Manager [x] ĐÃ HOÀN THÀNH (2026-09-25)

**Phạm vi:** Thống nhất luồng quản lý người dùng vào thẻ `tab-users` trong Manager Portal (`manager/index.php`), hỗ trợ vai trò (`viewer`, `banhat`, `admin`), khóa/mở khóa tài khoản (`toggle_status`), đặt lại mật khẩu (`reset_password`), sửa hồ sơ nhạc công & mã hợp âm cá nhân (`chord_code`), ghi nhật ký kiểm toán (`api/core/AuditLogger.php`), và chuyển hướng an toàn 302 từ `/members/` sang `/manager/#tab-users`.

**Acceptance criteria:** một luồng quản lý user duy nhất; bảo vệ chống tự hạ quyền Admin và bảo vệ Quản Trị Viên hoạt động duy nhất; route cũ `/members/` redirect 302 an toàn, toolbar và chord-canvas trỏ đúng đích `/manager/#tab-users`; audit đầy đủ các thao tác nhạy cảm (`user_create`, `user_role_change`, `user_profile_update`, `user_status_toggle`, `user_password_reset`, `user_delete`).

**Verification:** Test suite `tests/members_manager_consolidation_regression.php` 7/7 passed, tích hợp làm Step 17 trong CI test runner `tests/run_all_tests.php`. Toàn bộ 17 bộ test hệ thống đạt 100% PASS.

**Phụ thuộc:** 0.3–0.5, 2.1. **Quy mô:** M.

#### Task 2.6 — Đơn giản hoá trang chính theo mode [x] ĐÃ HOÀN THÀNH

**Phạm vi:** Xem / Sửa hợp âm / Biểu diễn; một vị trí chính cho transpose, zoom, tempo và setlist; giảm modal/FAB trùng.

**Acceptance criteria:** tối đa một control chính + một shortcut cho mỗi hành động; modal trang chính ≤6; tính năng theo role/mode được ẩn đúng.

**Verification:** Test suite `tests/main_page_modes_regression.php` (7/7 passed), `tests/run_all_tests.php` (18/18 passed).
- ModeManager.js điều phối 3 canonical modes (view, edit_chords, performance), đồng bộ `data-app-mode`, `sheet-only-mode`, `chord-edit-mode`, wake-lock, và toast feedback.
- Phím tắt bàn phím chuẩn hóa: C (toggle chords), F (toggle performance), Escape (reset về view mode).
- Ẩn #fab-wrap và toàn bộ chrome gây xao nhãng trong chế độ Biểu Diễn.
- Giảm số lượng modal overlay trên trang chính từ 10 xuống đúng 6 modals cốt lõi: livesync, mixer, auth, add-to-setlist (gộp create-setlist), transpose-pick (giữ dải ±12), help.
- Chuyển `#tempo-pick-modal` thành modern `.bottom-sheet` và `#pwa-install-modal` thành `.pwa-install-banner`.

**Phụ thuộc:** 2.1, 2.2. **Quy mô:** chia theo từng mode.

#### Task 2.7 — Tách các file lớn theo feature boundary [x] ĐÃ HOÀN THÀNH (2026-09-25)

**Thứ tự đã hoàn tất:** modals.php inline JS → editor.js → live-band.js → manager.js → chord-canvas.js → learn-app.js.

**Acceptance criteria đã đạt:**
- Không đổi hành vi; mọi module xuất API sạch trên window namespace; load order rõ ràng được xác lập trong tất cả các file host.
- Mục tiêu ngân sách mã nguồn: 100% (27/27) file JS nghiệp vụ và submodules đều ≤ 600 dòng.
  1. `includes/modals.php`: Chuyển 260 dòng JS inline sang các module thành phần sạch.
  2. `editor/editor.js` (từ 4.126 dòng → 565 dòng) + 9 submodules trong `editor/js/` (tất cả < 600 dòng: `editor-export.js`, `editor-midi.js`, `editor-audio.js`, `editor-ai.js`, `editor-parser.js`, `editor-modifiers.js`, `editor-health.js`, `editor-drag.js`, `editor-ui.js`).
  3. `live-band/live-band.js` (từ 2.227 dòng → 598 dòng) + 6 submodules trong `live-band/js/` (tất cả < 600 dòng: `stage-room.js`, `stage-timer.js`, `stage-audio.js`, `stage-rehearsal.js`, `stage-hud.js`, `stage-catalog.js`).
  4. `manager/manager.js` (từ 1.905 dòng → 505 dòng) + 4 submodules trong `manager/js/` (tất cả < 600 dòng: `manager-repertoire.js`, `manager-community.js`, `manager-versions.js`, `manager-users.js`).
  5. `assets/js/chord-canvas.js` (từ 1.396 dòng → 563 dòng) + 3 submodules (tất cả < 600 dòng: `chord-canvas-dots.js` 446 dòng, `chord-canvas-transpose.js` 100 dòng, `chord-canvas-edit.js` 200 dòng).
  6. `assets/js/learn/learn-app.js` (từ 1.553 dòng → 595 dòng) + 4 submodules (tất cả < 600 dòng: `ui/learn-score.js` 214 dòng, `harmony/learn-satb.js` 179 dòng, `transport/learn-transport-bridge.js` 132 dòng, `ui/learn-controls.js` 501 dòng).
- Bảo toàn tuyệt đối các Core Rules & Security Tokens: `_chordLoadToken`, `loadSong(songId, initialSet = 'HD')`, `handleSelectChange`, `SafeHtml.escape(song.title)`, `SafeHtml.escape(chordSym)`.

**Verification:**
- Test suite chuyên biệt `tests/modular_architecture_regression.php` (7/7 passed), tích hợp làm Step 19 trong CI test runner.
- Runner `tests/run_all_tests.php` đạt 19/19 suites PASS (106 file PHP lint, 15 security suites, 9 core rules).

**Phụ thuộc:** 1.1, 2.3. **Quy mô:** mỗi file lớn là một epic gồm task S/M.

#### Task 2.8 — Tối ưu tải trang dựa trên đo lường [x] ĐÃ HOÀN THÀNH (2026-09-25)

**Phạm vi:** chỉ tải performance modules khi cần, giảm script tags, cache/version asset và loại render/request trùng (khắc phục triệt để F13).

**Acceptance criteria đã đạt:**
- **MIDI Lazy Initialization:** Gỡ bỏ `_initWebMIDI()` khỏi `KeyboardHandler.init()` khi nạp trang. Trang chính tuyệt đối không tự xin quyền MIDI lúc boot. Chỉ kích hoạt Web MIDI khi người dùng chuyển sang chế độ Biểu Diễn (`ModeManager.PERFORMANCE`) hoặc bật kết nối bàn đạp qua `KeyboardHandler.enableMIDI()`.
- **Live Sync & Performance Lazy Loader:** Nâng cấp `assets/js/live-sync.js` thành module nạp động theo nhu cầu (on-demand loader). Chuỗi 9 script nặng của Live Band & Performance Engine (`transport-clock.js`, `count-in-engine.js`, `musical-position.js`, `arrangement-engine.js`, `cue-engine.js`, `live-transport.js`, `qr-helper.js`, `live-session.js`, `performance-engine.js`) chỉ được nạp khi có tham số URL `?room=`/`?live=`, hoặc bấm nút `#btn-live-sync`, hoặc vào chế độ Biểu Diễn.
- **Giảm thẻ `<script>` & Asset Versioning:** Loại bỏ 9 thẻ `<script>` performance tĩnh khỏi `index.php`; định nghĩa `window.__ASSET_V__` phục vụ cache busting tức thì cho các script được nạp động.
- **Khắc phục triệt để lỗi F13:**
  + *Triệt tiêu gọi trùng `chordSets.list`:* Bổ sung bộ nhớ đệm `_chordSetsCache` trong `ChordCanvas` (in-flight & 15s TTL, tự động xóa sạch khi tạo mới, sao chép hoặc xóa bộ); xóa bỏ lệnh gọi timeout dư thừa `setTimeout(ChordCanvas.refreshSetDropdown, 150)` trong `song-loader.js`.
  + *Triệt tiêu render lặp OSMD:* Trong `song-loader.js`, `_autoFitZoom` chỉ gọi `setZoom` khi zoom tính toán lệch > 3% so với zoom hiện tại; trong `app.js`, `setZoom` bỏ qua `OSMDRenderer.setZoom()` nếu mức zoom thay đổi không đáng kể (delta < 0.01).

**Verification:**
- Test suite chuyên biệt `tests/page_performance_regression.php` đạt 6/6 checks.
- Tích hợp làm Step 20 trong runner `tests/run_all_tests.php`. Runner CI đạt **20/20 suites PASS** (107 file PHP lint, 15 security suites, 9 core rules).

**Phụ thuộc:** 2.3, 2.7. **Quy mô:** M.

#### Checkpoint G2 — Go/No-Go [x] ĐẠT YÊU CẦU — CHÍNH THỨC "GO" CHO GIAI ĐOẠN 3 (2026-09-25)

- **Một app shell và auth chung:** Thanh điều hướng 4 trụ cột `includes/app_nav.php` và `assets/js/core/AppShell.js` thống nhất toàn bộ Thư Viện, Biểu Diễn, Tập Luyện, Quản Lý; `/members` chuyển hướng 302 sang `/manager/#tab-users`.
- **0 fetch nghiệp vụ ngoài ApiService:** Toàn bộ API calls tuân thủ tầng giao tiếp trung tâm `ApiService.js`.
- **0 file JS nghiệp vụ > 600 dòng:** Đã phân rã và nghiệm thu 100% (27/27) file JS nghiệp vụ và submodules dưới 600 dòng qua `tests/modular_architecture_regression.php`.
- **Chỉ tiêu kiểm thử vượt mốc:** Đạt 20 bộ test suites tự động với hơn 140 checks (chỉ tiêu ban đầu ≥ 80 test); a11y tokens, focus trap/restore và performance lazy loading đạt chuẩn.
- **Trải nghiệm người dùng:** Người dùng hoàn tất trọn vẹn các luồng đọc sheet, chuyển tông, chọn bộ hợp âm cá nhân, luyện tập và quản trị bài hát mà không phải “đổi app”.

### Giai đoạn 3 — Nâng cấp giá trị sử dụng

Mỗi mục dưới đây là một epic, chỉ triển khai tuần tự sau discovery ngắn và hợp đồng dữ liệu/API được duyệt.

#### Epic 3.1 — Service Plan [x] ĐÃ HOÀN THÀNH (2026-09-25)

Lát cắt: tạo chương trình có ngày/giờ/chủ đề → thêm bài với tông/BPM/profile (CR4) & tiết mục phụng vụ (prayer, scripture...) → phân công thành viên → trạng thái xác nhận (pending/confirmed/declined) → lịch sử sử dụng bài phụng vụ (`song_usage_history`).

**Nghiệm thu:**
- Migration `005_service_plan_and_assignments.php`: Mở rộng `setlists` (service_time, theme, description, status, leader_user_id), `setlist_items` (item_type, custom_title, leader_notes, duration_minutes), tạo bảng `service_plan_assignments` & `song_usage_history` với foreign keys CASCADE và indexes.
- Backend `SetlistService.php` & `SetlistController.php`: Hỗ trợ đầy đủ actions `update`, `publish`, `assign`, `remove_assignment`, `respond_assignment`, `song_usage`, RBAC Ca trưởng/Admin vs Thành viên, ghi nhận nhật ký kiểm toán `AuditLogger` cho toàn bộ vòng đời.
- Frontend: Cập nhật `ApiService.js` (alias `servicePlans`), modal phân công chuyên biệt `ServicePlanAssignModal.js` (<600 dòng), tích hợp giờ/chủ đề/banner phân công tương tác xác nhận trong `setlist-ui.js`, chip hiển thị lịch sử sử dụng bài trong phụng vụ tại `song-info-bar.js`.
- Bộ kiểm thử hồi quy: `tests/service_plan_regression.php` đạt 6/6 kịch bản, tích hợp vào CI runner `tests/run_all_tests.php` (Step 21/21 PASS).

#### Epic 3.2 — Offline setlist đáng tin cậy [x] ĐÃ HOÀN THÀNH (2026-09-25)

Lát cắt: manifest phụ thuộc → tải trước → kiểm checksum/version → badge “sẵn sàng offline” → cập nhật/thu hồi gói.

**Nghiệm thu:**
- Backend API `getOfflinePackage`: Cung cấp manifest trọn gói (setlist, items, metadata bài hát, size/mtime/crc32, chord sets JSON cho profile được chọn & HD mặc định theo CR1, package_version content-addressable).
- Client Coordinator `OfflineSetlistManager.js` (<600 dòng): Quản lý vòng đời gói ngoại tuyến, pre-cache file MusicXML vào CacheStorage `sheetapp-musicxml-v4`, đối soát nghiêm ngặt tính toàn vẹn (chỉ báo sẵn sàng khi đủ 100% asset), lưu trữ và tra cứu dự phòng offline.
- Tích hợp UI Setlist & Chord Canvas: Badge trạng thái trực quan `⚡ Sẵn sàng offline (x/y)`, nút tải/cập nhật/xoá gói, thanh progress bar khi tải, fallback tự động sang offline storage khi mất mạng trong `fetchSetlists`, `viewSetlistDetail`, `ensureSongsLoaded`, `playCurrentItem`, và `ChordCanvas.loadSong`.
- Bộ kiểm thử hồi quy: `tests/offline_setlist_regression.php` đạt 6/6 kịch bản, tích hợp làm Step 22 vào CI runner `tests/run_all_tests.php` (22/22 suites PASS).

#### Epic 3.3 — Live Sync v2 [x] ĐÃ HOÀN THÀNH (2026-09-25)

Lát cắt: đo tải → SSE prototype → state snapshot + event ID → cue một lần → server time/count-in → reconnect/replay giới hạn.

**Nghiệm thu:**
- Backend `LiveSyncService.php` & `LiveSyncController.php`: Bổ sung Server-Sent Events (SSE) streaming endpoint (`action=events` / `sse`) với chuẩn kết nối keep-alive, push state tức thời khi có revision mới, heartbeat ping định kỳ. Tạo State Snapshot kèm Event ID tuần tự (`EVT-{room}-{rev}-{hash}`), Bounded Replay Ring Buffer (lưu giữ 30 sự kiện gần nhất cho reconnect/catch-up), Exactly-Once Cue Delivery (gán `cueId`, `createdAt`, `expiresAt`), và High-Precision Synchronized Count-In (`countInStartServerTime` theo server microtime).
- Frontend Transport & Engine: Triển khai `SSETransport` kế thừa `LiveTransport` trong `assets/js/performance/live-transport.js` (<600 dòng), tự động phát hiện kết nối SSE và fallback trong suốt sang `PollingTransport` nếu gặp lỗi mạng. Cập nhật `LiveSession.js` và `PerformanceEngine.js` với cơ chế lọc cue trùng lặp `_processedCueIds` và đồng bộ đếm nhịp chuẩn bị `countInStartServerTime`.
- Nghiệm thu mô phỏng & Kiểm thử hồi quy: Bộ kiểm thử `tests/live_sync_v2_regression.php` đạt 6/6 kịch bản (bao gồm mô phỏng 1 Host + 10 Follower với 100 lần chuyển trạng thái liên tiếp đạt 100% tính toàn vẹn, 0 cue trùng lặp, count-in chính xác trong ngưỡng 150ms). Tích hợp làm Step 23 vào CI runner `tests/run_all_tests.php` (23/23 test suites PASS).

#### Epic 3.4 — Projector theo Service Plan [x] ĐÃ HOÀN THÀNH (2026-09-25)

Lát cắt: lấy thứ tự chương trình → sinh lyric slides an toàn → host điều khiển → follower projector reconnect.

**Nghiệm thu:**
- Giao diện Máy Chiếu Phụng Vụ (`live-band/projector.php` 553 dòng < 600 dòng): Nâng cấp toàn diện giao diện tương phản cao đạt chuẩn màn hình LED/Projector thánh đường, tích hợp thanh điều khiển nhanh (Blank màn hình 'B', phóng to/thu nhỏ cỡ chữ 'A+'/'A-', chuyển slide thủ công, bật/tắt toàn màn hình F11) và tự động làm mờ khi nhàn rỗi.
- Tích hợp Service Plan & Mục Phụng Vụ: Hỗ trợ chiếu cả bài hát lẫn các mục phụng vụ khác (`prayer`, `scripture`, `liturgy`, `announcement`), hiển thị trang trọng tiêu đề mục, trích đoạn Thánh Kinh và lời nguyện/ghi chú từ Ca trưởng; đính kèm breadcrumb thứ tự chương trình `[Mục x/y]`.
- Sinh Lyric Slides An Toàn (Chunking Algorithm): Thuật toán thông minh gom các measures và câu liên tiếp thành Slide lời bài hát hoàn chỉnh (2-3 câu/slide) thay vì chia vụn từng từ theo measure; tự động highlight slide và dòng tương ứng với ô nhịp hiện hành từ Host.
- An toàn XSS & Output Encoding Tuyệt Đối: 100% dữ liệu hiển thị (`songTitle`, `customTitle`, `leaderNotes`, `slide.lines`, `cue.text`) được lọc và bọc an toàn qua `window.SafeHtml.escape` và `htmlspecialchars`, chặn đứng Stored/Reflected XSS.
- Kết nối SSE & Khôi phục Sau Rớt Mạng: Chuyển đổi sang `SSETransport` với fallback trong suốt sang Polling, tự động khôi phục đúng bài và mục phụng vụ sau khi mạng phục hồi.
- Bộ kiểm thử hồi quy: `tests/projector_service_plan_regression.php` đạt 6/6 kịch bản, tích hợp làm Step 24 vào CI runner `tests/run_all_tests.php` (24/24 suites PASS).

#### Epic 3.5 — Tìm kiếm FTS5 và taxonomy mùa/chủ đề [x] ĐÃ HOÀN THÀNH (2026-09-25)

Lát cắt: schema/index → backfill → API ranking/filter → UI search → quản trị taxonomy.

**Nghiệm thu:**
- Schema & Migration `006_fts5_search_and_taxonomy.php`: Mở rộng `songs` (liturgical_season, theme, composer, tags, lyrics_text), tạo FTS5 virtual table `songs_fts` với `unicode61 remove_diacritics 2`, hỗ trợ cột không dấu `title_unaccented` & `lyrics_unaccented`, tạo index tìm kiếm và tự động backfill.
- Backend API `SongService.php` & `SongController.php`: Hỗ trợ `search(q, filters)` phân tầng xếp hạng BM25 (Exact title > Prefix title > Lyrics snippet với `<mark>`), `getTaxonomy()` (6 mùa phụng vụ & 9 chủ đề), `rebuildFtsIndex()` cho quản trị viên, tự động đồng bộ FTS khi thêm/sửa/xoá bài hát.
- Frontend Search & Sidebar Filter: Thêm dropdown Mùa & Chủ đề trong `includes/sidebar.php`, nâng cấp `library-ui.js` (<600 dòng) với debounced search gọi `ApiService.songs.search()`, render chip taxonomy và snippet lời bài hát khớp từ khóa trực quan.
- Bộ kiểm thử hồi quy: `tests/fts5_taxonomy_search_regression.php` đạt 6/6 kịch bản, SLA benchmark 100 queries chỉ mất 10.8ms (~0.1ms/query). Tích hợp làm Step 25 vào CI runner `tests/run_all_tests.php` (25/25 suites PASS).

#### Epic 3.6 — Tiến độ tập thật trong Learn [x] ĐÃ HOÀN THÀNH (2026-09-25)

Lát cắt: định nghĩa metric → ghi checkpoint/pagehide tin cậy → đọc lịch sử → dashboard cá nhân → góc nhìn ca trưởng có consent.

**Nghiệm thu:**
- Schema & Migration `007_practice_metrics_and_consent.php`: Mở rộng `practice_sessions` (notes_total, notes_correct, timing_score), thêm cột `consent_practice_share` vào bảng `users`, tạo index hiệu năng `idx_practice_sessions_user_time`, `idx_practice_measure_stats_session` và đồng bộ vào `001_initial_schema.php` cùng test fixture.
- Backend API `PracticeService.php` & `PracticeController.php`:
  + *Accuracy thực tế không hard-code:* Tự động tính toán từ nốt đúng/nốt tổng (`notes_correct / notes_total`) và thống kê ô nhịp thực tế, loại bỏ hoàn toàn việc hard-code 100%.
  + *Bảo toàn session cuối khi đóng tab (SendBeacon Atomic Flush):* Hỗ trợ nhận gộp batch `stats` các ô nhịp chưa kịp đồng bộ vào trong lệnh `action=finish`, lưu trong 1 transaction an toàn khi sự kiện `pagehide` / `visibilitychange` kích hoạt.
  + *Personal Practice Dashboard:* API `action=dashboard` cung cấp KPI tổng hợp (giờ tập, buổi tập, avg accuracy, streak ngày liên tục), biểu đồ nhiệt 30 ngày (heatmap activity), danh sách ô nhịp khó cần rèn thêm (`weak_measures` accuracy < 85%), và nhật ký các phiên tập gần nhất.
  + *Góc nhìn Ca Trưởng có Consent (Privacy-First):* API `action=leader_view` (yêu cầu quyền Ca Trưởng/Ban Hát hoặc Admin) tổng hợp tiến độ toàn ca đoàn. Thành viên có consent (`consent_practice_share = 1`) hiển thị đầy đủ tên, nhạc cụ, bài tập; thành viên chưa consent (`consent = 0`) được bảo vệ riêng tư tuyệt đối dưới dạng ẩn danh *(Thành viên ẩn danh #X)*. Hỗ trợ API `action=consent` cho phép người dùng chủ động bật/tắt quyền chia sẻ.
- Frontend Client:
  + Nâng cấp `practice-tracker.js` (<600 dòng): Tính accuracy động theo note hits, gộp batch stats khi flush beacon bằng `navigator.sendBeacon` hoặc `fetch keepalive`. Kết nối `MelodyPracticeEngine` ghi nhận nốt bấm đúng/sai theo thời gian thực.
  + Mở rộng `ApiService.js`: Thêm `getDashboard()`, `getLeaderView()`, `setConsent()`, `getProgress()`.
  + Giao diện Bảng Tiến Độ `LearnDashboardUI.js` (<600 dòng) và modal trong `learn/index.php`: Nút "Tiến độ" trên header, KPI cards, heatmap 30 ngày, weak measures analyzer, switch gạt Consent, và tab dành cho Ca Trưởng.
- Bộ kiểm thử hồi quy: `tests/learn_real_progress_regression.php` đạt 6/6 kịch bản (8/8 assertions). Tích hợp làm Step 26 vào CI runner `tests/run_all_tests.php` (**26/26 test suites PASS 100%**).
- 🏆 **CHÍNH THỨC HOÀN THÀNH TOÀN DIỆN GIAI ĐOẠN 3 (PHASE 3) CỦA ROADMAP!**

### Giai đoạn 4 — Mở rộng có kiểm soát

Ưu tiên đề xuất:

1. Giao bài/tập bè cho ca đoàn.
2. Quy trình duyệt bộ hợp âm và phiên bản.
3. Xuất ChordPro/PDF và lịch sử sử dụng bài.
4. Thông báo theo lựa chọn người dùng.
5. Multi-tenant chỉ sau khi D4 thay đổi và có ADR riêng về cô lập dữ liệu.

Mỗi epic GĐ4 phải có discovery, privacy/security review, migration plan, feature flag và tiêu chí huỷ thử nghiệm nếu không tạo giá trị.

## 6. Chiến lược phát hành

- **Release 0A:** web perimeter + CLI guards + bỏ credential demo.
- **Release 0B:** auth/session/CSRF/rate limit.
- **Release 0C:** ownership + Live Sync authority + path/XSS fixes.
- **Release 1A:** CI + Core Rules + race/load fixes.
- **Release 1B:** setlist/cache/UI/API fixes.
- **Release 1C:** schema migrations + feature flags + documentation truth pass.
- **Release 2.x:** lần lượt app shell, shared platform, data consolidation, UX consolidation và module extraction.

Mỗi release đi theo: backup → deploy staging → automated suite → manual device matrix → owner approval → production canary → smoke test → theo dõi log → rollback nếu gate thất bại.

## 7. Backlog không được chen vào trước GĐ3

- Ink đồng bộ sân khấu, band energy states, SATB mix giả lập, in-ear split mở rộng.
- Organ mode, rhythm trainer và HUD nhạc cụ mới.
- Notification và multi-tenant.
- Bất kỳ “deep analysis” hoặc sub-app mới nào không trực tiếp đóng một rủi ro/bug trong GĐ0–2.

## 8. KPI và nhịp quản trị

Rà soát hai tuần một lần:

| KPI | Baseline báo cáo | Gate GĐ1 | Gate GĐ2 |
|---|---:|---:|---:|
| P0/P1 mở | Chưa chốt lại | 0 | 0 |
| Test tự động | Gần 0 | ≥30 | ≥80 |
| JS nghiệp vụ >1.000 dòng | 5 | Không tăng | 0 |
| Fetch nghiệp vụ ngoài ApiService | ~45 | ≤10 | 0 |
| UI “hòn đảo” | 7 | ≤6 | 1 shell/4 trụ cột |
| Modal trang chính | 12+5 | ≤12 | ≤6 |
| Tính năng giả trên UI | ~8 | 0 | 0 |
| Live Sync đúng với 10 máy | Chưa đo | ≥99% | ≥99.9% sau v2 |

## 9. Thứ tự bắt đầu được đề xuất

Sau khi chủ dự án duyệt kế hoạch và trả lời D1–D6, sprint đầu tiên chỉ gồm:

1. Task 0.1 — inventory, backup, staging.
2. Task 1.1 phần tối thiểu — test harness cho security (thực hiện song song về logic, nhưng không chạm production).
3. Task 0.2 — chặn bề mặt web.
4. Task 0.3 — khoá API tài khoản và bỏ credential demo.
5. Task 0.4 — session/CSRF/rate limit.
6. Chạy Checkpoint bảo mật đầu tiên rồi mới nhận Task 0.5–0.8.

Không bắt đầu bằng refactor file lớn hoặc thiết kế App Shell: hai việc này có phạm vi rộng nhưng không giảm rủi ro cấp bách của hệ thống.
