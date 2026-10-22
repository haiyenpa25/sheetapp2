# ROADMAP — SheetApp2 (bản gộp 2026-10-22)

> **Người đọc:** chủ dự án (duyệt, trả lời mục 4) và **một** người/AI thực thi.
> **Đây là roadmap duy nhất đang hiệu lực.** Không còn file roadmap/phương án nào khác ở thư mục gốc.
> **Gộp từ** (đã `git mv` vào `docs/history/`, chỉ để tra cứu):
> `ROADMAPS.md` (chỉ mục + luật), `ROADMAP6_TV_2026-10-17.md` (Thư viện TV0–TV7),
> `PHUONG_AN_TOI_UU_HE_THONG_2026-10-21.md` (OPT-01…26), `PHUONG_AN_2_2026-10-21.md` (FIX-01…45, P2-01…13),
> `PHUONG_AN_2_EXECUTION.md` (bằng chứng từng FIX).
> Mã ticket cũ (TVx-y, OPT-xx, FIX-xx, P2-xx) được giữ ở cột "Nguồn" để tra ngược. Ticket mới dùng tiền tố **BUG-** (lỗi) và **OP-** (tối ưu).

---

## 0. Bàn giao cho người thực thi (Gemini) — đọc trước

**Nhánh làm việc:** `fix/opt-review-20261021` (đã đẩy lên GitHub). Chưa gộp về `main`. Lấy về: `git fetch origin && git checkout fix/opt-review-20261021`.

**Trạng thái lúc bàn giao (2026-10-22):**
- Đã commit trên nhánh: các bản vá FIX của Phương án 2, gộp roadmap, OP-01 (runner), OP-03 (SSE 250 ms), TV2-7 (`package_version`).
- **BUG-01…41 chưa sửa dòng nào.** Các agent sửa đã bị dừng trước khi commit. Bỏ qua các worktree trong `.claude/worktrees/agent-*` (sửa dở, chưa test). Làm lại từ đầu theo Phụ lục A.
- Toàn bộ test suite **chưa chạy lại** sau các commit 2026-10-22; từng suite liên quan đã PASS riêng. Chạy cổng đầy đủ trước khi bắt đầu, để có mốc.

**Thứ tự làm:**
1. Chạy cổng: `php tests\run_all_tests.php --strict --js` (cần Apache XAMPP đang chạy, nếu không suite HTTP bị SKIP). Lưu output làm mốc.
2. BUG mức **C** trước: BUG-01, 12, 13, 14, 15, 25, 26. Sau đó mức **T**, rồi **L**.
3. Mỗi BUG: viết test tái hiện → chạy, lưu `docs/fix-evidence/r8/BUG-XX-FAIL.txt` → sửa → lưu `BUG-XX-PASS.txt`. Một commit cho mỗi BUG hoặc mỗi nhóm nhỏ cùng file.
4. Sau khi xong toàn bộ BUG: chạy lại cổng đầy đủ, `php tools/generate_sw_manifest.php` (sinh lại `sw.js` nếu JS/CSS đổi), cập nhật cột trạng thái ở mục 3 (thêm ✅ + hash commit).
5. Rồi mới sang Giai đoạn 2 (OP-), Giai đoạn 3 (TV).

**Mẫu test có sẵn để chép:**
- PHP service trên DB memory: `tests/offline_package_version_regression.php` (fixture `tests/fixtures/test_db_fixture.php`; in `PASS:B:` cho check hành vi và dòng cuối `SUITE_COMPLETE total=N passed=N failed=0`).
- JS chạy mã thật trong Node VM: `tests/js/async_context_guards.cjs` + `tests/async_context_guards_regression.php`; XSS: `tests/js/reported_xss.cjs` + `tests/reported_xss_regression.php`; Classic: `tests/js/classic_song_load.cjs`.
- Chạy một suite: `C:\xampp\php\php.exe tests\<tên>_regression.php`. Runner tự nhận mọi `tests/**/*_regression.php`.

**Bẫy đã biết:**
- `exit()` trong PHP bỏ qua `finally`: dọn file tạm bằng `register_shutdown_function`.
- File trong repo dùng CRLF; công cụ thay chuỗi theo `\n` sẽ trượt.
- Một test chặn file JS/PHP > 600 dòng; nhiều file đang ở 570–598 dòng.
- Suite trong `tests/http/` gọi `http://localhost/sheetapp2` (bản checkout chính), không phải worktree.
- Thoát HTML dùng `SafeHtml.escape(...)`; chuỗi JS trong thuộc tính inline dùng `SafeHtml.inlineJsString(...)` (`assets/js/core/SafeHtml.js`). Kiểm `SafeHtml` được nạp trước module trên trang đó.
- Không chạy `sync.sh`/`sync.bat`. Không ghi vào `storage/` hay `storage/data/app.sqlite` trong test.

---

## 1. Luật thực thi (bắt buộc)

Lấy từ `docs/history/ROADMAP3.md` Phần 0 (2026-09-26), giữ nguyên.

1. Chỉ làm ticket trong file này, đúng thứ tự. Không tự mở epic hay tính năng mới.
2. Không đánh dấu hoàn thành việc của chủ dự án.
3. Không sửa bảng quyết định và ô chữ ký. Chỉ chủ dự án được điền.
4. Mỗi ticket có bằng chứng thô: lệnh đã chạy, output lúc FAIL (trước khi sửa) và lúc PASS (sau khi sửa).
5. Test tìm chuỗi trong source (`str_contains`, `preg_match` trên file code) không tính là bằng chứng hành vi; chỉ dùng để chặn tái phát.
6. Test và E2E không ghi vào DB hoặc storage thật. Dùng fixture memory hoặc bản sao cách ly.
7. Không làm tròn số liệu. Mọi con số phải do script đo.
8. Không deploy, không chạy `sync.sh`/`sync.bat`, không chạy migration trên DB thật khi chưa có backup và xác nhận của chủ dự án. Push/merge chỉ khi chủ dự án yêu cầu trong phiên.
9. Mỗi ticket chạm tối đa khoảng 5 file. Lớn hơn thì tách.
10. Dừng và hỏi khi cần xoá dữ liệu, đổi Core Rule, đổi quyền theo role, hoặc phát hiện lỗ hổng mới.

**Quy trình nhánh (chủ dự án chọn 2026-10-22):** làm trên nhánh, đẩy nhánh lên GitHub, rồi gộp về `main` để mọi máy dùng chung một nguồn.

**Môi trường kiểm thử:**
```powershell
$env:Path = "C:\Program Files\nodejs;C:\xampp\php;" + $env:Path
php tests\run_all_tests.php --strict --js   # PHP suites + lint + JS syntax + ESLint
npx playwright test --reporter=line         # E2E (chỉ trên bản sao cách ly, xem e2e/assert-isolated-root.js)
```

---

## 2. Đã xong (tóm tắt, chi tiết ở `docs/history/`)

| Đợt | Kết quả | Bằng chứng |
|---|---|---|
| ROADMAP6 TV0 (8 ticket) | Chạm/cuộn danh sách, danh sách ảo, XSS từ khoá, toolbar, toast, z-index, drawer điện thoại, đường nhập bài | `docs/ROADMAP6_LIBRARY_ACCEPTANCE_REPORT.md` |
| ROADMAP6 TV1 (7 ticket) | Tìm kiếm phân trang đủ kết quả, tìm theo lời, tô sáng, bàn phím, ◀ ▶, nhảy số theo tập, bỏ "903" gõ cứng | như trên |
| ROADMAP6 TV4 (6 ticket) | Đọc chương trình cho khách, quyền XML, PUT xmlPath, CSRF có cờ, cache/transaction danh mục, hợp đồng API | như trên |
| ROADMAP6 TV2 (một phần) | TV2-5 manifest sinh từ `index.php`; TV2-8 đóng session sớm; một phần TV2-1/3/4; gzip 4 asset | `docs/ROADMAP6_TV2_PROGRESS.md` |
| OPT-01…09, 11, 13 | Test không ghi storage thật, dọn 63 backup (Q1), log xoay vòng, cache đúng chỗ, bỏ auto-push, `.gitignore`, tách changelog, dọn mã chết một phần, quyền đọc bộ hợp âm (Q4), siết endpoint phụ, SQL về service | `docs/OPT_REVIEW_2026-10-21.md`, `docs/opt-evidence/` |
| FIX-01…37, 39…44 | 43/45 lỗi của Phương án 2 đã sửa; Q-C/Q-D áp dụng trên DB thật sau backup | `docs/history/PHUONG_AN_2_EXECUTION.md`, `docs/fix-evidence/` |
| P2-01, P2-06, P2-12 | Generator SW `--check`, CI strict + Chromium smoke, registry khớp mã | như trên |

Cổng hồi quy gần nhất (2026-10-21): **207/207 suite PASS, 4.049 check, 0 skip**; browser nghiệm thu 8/8 Chromium/WebKit.
Commit trên nhánh `fix/opt-review-20261021`: `1a36dca`, `e0e9d69`, `945233e`, `6962ce8` (đã đẩy lên GitHub 2026-10-22).

---

## 3. Việc còn lại

### Giai đoạn 1 — Lỗi mới (rà soát 2026-10-22)

Ba lượt rà chỉ đọc trên mã sau commit `6962ce8` (backend, frontend Modern, Classic + app phụ). Mức: **C** Cao, **T** Trung bình, **L** Thấp. "Xác nhận" là đã lần theo mã; "Khả năng" là chưa tái hiện.
Quyết định quyền của chủ dự án (2026-10-22): BUG-01 cần Ban Hát + cấm trùng tên; BUG-04 viewer đọc chương trình như khách; BUG-06 chỉ leader/admin, ẩn người tắt chia sẻ; viewer **vẫn được** tạo/phân công chương trình (không sửa).

**Backend**

| ID | Mức | Lỗi | Vị trí |
|---|:-:|---|---|
| BUG-01 | C | Viewer fork được bộ trùng tên bộ của người khác → chủ thật không lưu/xoá được, mọi người đọc hợp âm giả | `ManagerService::forkSong`, `ChordSetService::forkSet`, rename trong `saveUserChordSet` |
| BUG-02 | T | Duyệt `update_hd` cho đề xuất `song_version` ghi metadata vào HD và sửa nhầm bộ có id trùng | `ReviewService` submit/approve, `ReviewActionHelper:77-100` |
| BUG-03 | T | Xoá bài có XML luôn lỗi 500 (`strpos(..., false)` khi `storage/uploads` không tồn tại) | `SongService.php:358` |
| BUG-04 | T | Viewer đã đăng nhập đọc chương trình nháp, phân công, gói offline | `SetlistController.php:43-98` |
| BUG-05 | T | `save_arrangement` xoá/ghi bước của kịch bản thuộc bài khác (IDOR) | `ArrangementService.php:182-205` |
| BUG-06 | T | `leader_view` mở cho mọi Ban Hát và lộ số liệu người tắt chia sẻ | `PracticeController:35-45`, `PracticeService:362-421` |
| BUG-07 | T | `create_from_plan` không giao bài cho người được phân công sau lần tạo đầu | `PracticeAssignmentCreationHelper:71-110` |
| BUG-08 | L | Diff MusicXML trong review luôn rỗng (đường dẫn tương đối) | `ReviewService:123-130, 331` |
| BUG-09 | L | Manager sửa hợp âm không cập nhật checksum → ghi đè thầm lặng | `ManagerService:341-362` |
| BUG-10 | L | `respond_assignment` của admin báo thành công mà không đổi gì | `SetlistService:370-382` |
| BUG-11 | L | `mark_done` phát lại sự kiện mỗi lần gọi, kể cả bài tập đã lưu trữ | `PracticeAssignmentService:322-347` |

**Frontend Modern**

| ID | Mức | Lỗi | Vị trí |
|---|:-:|---|---|
| BUG-12 | C | Chuyển bài qua preload không xoá undo/không đóng popup → Ctrl+Z ghi hợp âm bài cũ vào bài mới | `chord-canvas.js` `applyPreloaded` |
| BUG-13 | C | XSS: tên bài/tông chèn thẳng vào chế độ Lời | `lyric-extractor.js:244-247` |
| BUG-14 | C | XSS qua cue Live Sync và tên phân đoạn | `cue-engine.js:114`, `arrangement-engine.js:256` |
| BUG-15 | C | Cache preload giữ hợp âm/checksum cũ (409 giả, mất bản sửa, sống qua đăng xuất), bỏ qua `versionId` | `song-preloader.js`, `song-loader.js:44-58` |
| BUG-16 | T | "Lưu Tập" ở mọi dòng setlist ghi thông số bài đang mở (Core Rule 4) | `setlist-detail.js:126-137, 316-320` |
| BUG-17 | T | XSS qua `<beats>` trong MusicXML ở thanh thông tin | `song-info-bar.js:263` |
| BUG-18 | T | XSS qua tên hợp âm ở Guitar Lens | `guitar-lens.js:209-226, 390` |
| BUG-19 | T | Dịch giọng trong lúc tải bài bị đè (follower lệch tông host) | `song-loader.js:108-115`, `app.js` |
| BUG-20 | T | Listener `pointerdown` của popup hợp âm sống sau khi popup bị đóng bằng code → ghi hợp âm vào bài mới | `chord-canvas-ui.js:436-442` |
| BUG-21 | T | `pushState` không có `popstate` → URL lệch bài; follower không reset URL (CODING_STANDARDS 4.4) | `url-state.js:62-66`, `performance-engine.js:137` |
| BUG-22 | L | Chọn phiên bản reset tông/bộ kể cả trong setlist; danh sách phiên bản của bài cũ | `song-loader.js:534, 567` |
| BUG-23 | L | FIX-05 chưa hết: preload còn dựng `storage/Thanh ca/<id>.xml`; gọi `LibraryUI.getSongById` không tồn tại | `song-preloader.js:159-163`, `app.js:210` |
| BUG-24 | L | Hàng đợi lưu offline kẹt vĩnh viễn khi gặp 409; gửi trùng | `chord-canvas-edit.js:383-408` |

**Classic và app phụ**

| ID | Mức | Lỗi | Vị trí |
|---|:-:|---|---|
| BUG-25 | C | Classic: Ctrl+Z sau khi đổi bài ghi hợp âm bài cũ đè bài mới (thiếu `resetUndo`) | `old/assets/js/chord-canvas.js` |
| BUG-26 | C | Classic: XSS qua `?set=` và chuỗi hợp âm trong popup | `old/assets/js/chord-canvas-ui.js:142, 147, 428` |
| BUG-27 | T | Classic: XSS qua tên nhạc cụ trong MusicXML | `old/assets/js/instruments.js:50` |
| BUG-28 | T | Editor: mở phiên bản đã lưu luôn 403 (fetch thẳng `storage/users`) | `editor/editor.js:330-336` |
| BUG-29 | T | Live-band/máy chiếu: cue và lệnh ban nhạc hiện lại sau mỗi cập nhật | `stage-room.js:181-192`, `projector-app.js:284-286` |
| BUG-30 | T | Live-band: máy đếm nhịp khởi động lại ở mọi state → không phát nhịp | `stage-room.js:165-167`, `live-band.js:301-305` |
| BUG-31 | T | Live-band: tông gốc luôn C (`song.key` thay vì `defaultKey`) | `live-band.js:475` |
| BUG-32 | T | Live-band: bài mới giữ tông bài trước (Core Rule 2) | `live-band.js:320` |
| BUG-33 | T | Live-band: không nạp bộ HD, nhãn ghi HD nhưng hiện TLH (Core Rule 1) | `live-band.js:469-515` |
| BUG-34 | T | Live-band: listener cuộn cộng dồn sau mỗi bài | `live-band.js:126, 514` |
| BUG-35 | T | Live-band: WakeLock không xin lại sau khi rời tab | `stage-hud.js:249-256` |
| BUG-36 | T | Learn: bộ hợp âm bài trước mang sang bài mới; HD ít hợp âm bị bỏ (Core Rule 1) | `learn-app.js:166`, `learn-score.js:171` |
| BUG-37 | T | Phản hồi bất đồng bộ cũ đè bài mới ở live-band, máy chiếu, learn, manager, editor (Khả năng) | xem báo cáo |
| BUG-38 | L | Editor không cảnh báo khi rời trang/đổi bài lúc chưa lưu | `editor/editor.js` |
| BUG-39 | L | Manager: nút Ghim hiện cho banhat (backend chỉ cho leader/admin) | `manager-community.js:71`, `manager-repertoire.js:206`, `manager-versions.js:100` |
| BUG-40 | L | Classic: `deleteSet` bỏ qua kết quả; OMR dùng escape HTML trong chuỗi JS | `old/assets/js/chord-canvas.js:425`, `old/assets/js/importer.js:234` |
| BUG-41 | L | Learn: link "Quay về" sai khi cài trong thư mục con | `learn-controls.js:27` |

Đưa sang tối ưu: căn hợp âm gọi `getBBox` O(hợp âm × nốt) mỗi lần render và `readXmlChords` duyệt lại XML nhiều lần (`chord-canvas.js:89-115`) → **OP-12**. Ghi chú phụ chưa xếp hạng (metadata bài private qua `arrangements`/`annotations`/`hd_history`; `getById` ép `(int)`; `SessionService` không giới hạn) → rà tiếp ở đợt sau.

### Giai đoạn 2 — Tối ưu không phải chờ quyết định

| ID | Việc | Nguồn | Nghiệm thu |
|---|---|---|---|
| OP-01 ✅ | (`dae93ca`) Runner: suite không khai báo loại thì tính là static; đếm hành vi từ nhãn `PASS:B`/`PASS:S` thật, không tin số suite tự khai | OPT-19, P2-07 | Test của chính runner: suite không khai báo bị đếm static; tổng Pass + Skip + Fail = số suite |
| OP-02 | ~~Gom truy vấn hợp âm gói offline~~ **Bỏ** (2026-10-22): `loadSet` chỉ quét đĩa khi thiếu dòng HD; lợi rất nhỏ, dễ lệch lọc quyền | OPT-20, P2-08 | — |
| OP-03 ✅ | SSE live sync poll 100 ms → 250 ms (`f8842c2`) | OPT-20 | 4 suite HTTP live sync PASS |
| OP-04 | Index `songs(httlvnId)` dưới dạng migration (chạy trên DB thật cần chủ dự án duyệt, luật 8) | OPT-20 | Test migration trên DB memory; `EXPLAIN QUERY PLAN` dùng index |
| OP-05 | Tool chỉ đọc đối soát `songs` ↔ `songs_fts` | OPT-20 | Chạy trên bản sao: in số lệch; exit ≠ 0 khi lệch |
| OP-06 | Một bộ đọc SATB chung cho editor và learn (cherry-pick `e14b7af` từ nhánh agent `a5852`) | OPT-23, P2-02 | Golden SHA 6 bài thật cho cả hai consumer |
| OP-07 | Bỏ thẻ script trùng với preset của ScriptLoader; nạp theo nhu cầu (mỗi đợt ≤ 5 file) | OPT-15, TV2-2, P2-05 | Đo lại 4G: tiến tới ≤ 40 JS; mọi E2E Thư viện PASS |
| OP-08 | E2E cho live-band, learn, editor (lưới an toàn trước khi gộp transport) | P2-13 | Mỗi app ≥ 3 spec hành vi trên bản sao cách ly |
| OP-09 | Live transport bước 1: test đặc tả + gộp code trùng (`32eb9f6`, `cf45156`), sau đó một transport chung SSE + polling | OPT-22, P2-03 | E2E host/follower qua cả hai đường |
| OP-10 | Xoá `assets/js/key-service.js` (không trang nào nạp) và cập nhật test tham chiếu — **cần chủ dự án duyệt danh sách** (luật AI_AGENT 1.3) | OPT-08 | Grep 0 tham chiếu; suite PASS |
| OP-12 | Căn hợp âm: tính bbox nốt một lần mỗi hệ; memo `readXmlChords` theo `originalXml` | Rà 2026-10-22 | Đo thời gian `_build` trước/sau trên bài 001 ở zoom 100%; ảnh căn hợp âm không đổi |
| OP-11 | Lưu trữ phần tool một lần còn lại (`migrate_json_chord_sets_to_db` sau OP-21) và chuyển fixture `create_test_*`/`setup_e2e_*` vào `e2e/helpers/` | OPT-26 | Suite và E2E PASS |

### Giai đoạn 3 — Thư viện còn mở (từ ROADMAP6)

Chi tiết từng ticket và tiêu chí nghiệm thu: `docs/history/ROADMAP6_TV_2026-10-17.md` mục 3.

| Nhóm | Ticket còn mở | Ghi chú |
|---|---|---|
| TV2 Tải trang | TV2-1 (đo trung thực, sửa số trong registry), TV2-2 (= OP-07), TV2-3 (API khi tải trang ≤ 5), TV2-4 (0 cảnh báo AudioContext cả hai UI), TV2-6 (fallback ngoại tuyến thật), ~~TV2-7~~ ✅ `f8842c2` (`package_version` gồm hash XML + hợp âm) | Ngân sách đề xuất Q6: ≤ 40 JS, ≤ 60 request, ≤ 1,5 MB, SVG ≤ 2,5 s trên 4G |
| TV3 Giao diện | TV3-1…8: một hành động một chỗ, vùng chạm ≥ 44px, nhãn 1 dòng, ≥ 2 ô nhịp/hàng ở 390, Lời & Hợp âm đúng âm tiết, axe-core 0 lỗi nặng, gom CSS (= OPT-25), hằng số tên bộ | TV3-1 cần chủ dự án duyệt bảng phân bổ |
| TV5 Dữ liệu | TV5-1…6: huy hiệu bản nhạc tạm/chưa HD/chưa tempo, bỏ tempo 80 giả, nhãn dịp lễ tập 2–7, làm sạch metadata, kế hoạch HD, phân đoạn thủ công | Mọi ticket ghi DB: dry-run → chủ dự án duyệt → backup |
| TV6 Classic | Classic là chế độ chính thức lâu dài (chủ dự án 2026-10-18). TV6-1…4, TV6-6; hội tụ module với Modern theo đợt 2–3 module (= OPT-21) | E2E hai giao diện mỗi đợt |
| TV7 Nghiệm thu | Chromium + WebKit + thiết bị thật (iPhone, Android, iPad dọc, laptop 1366) trên bản sao DB | Biên bản vào `docs/ROADMAP6_LIBRARY_ACCEPTANCE_REPORT.md` |

### Giai đoạn 4 — Chờ quyết định hoặc chờ server

| ID | Việc | Nguồn | Chờ |
|---|---|---|---|
| OP-20 | Bật `csrf_enforce` trên production | OPT-10, TV4-4 | Q5: staging chạy E2E thao tác ghi PASS |
| OP-21 | SQLite là nguồn duy nhất của bộ hợp âm (bỏ đọc dự phòng từ JSON) | OPT-12, P2-09 | Q6: chọn nguồn đúng cho 3 file lệch (57/60 khớp) |
| OP-22 | Gzip toàn bộ JS/CSS | OPT-14, P2-04 | FIX-38: kiểm cách OpenLiteSpeed phục vụ `.gz` |
| OP-23 | Nối file nhóm `core/*` (không bundler) | OPT-16 | Q7, và chỉ khi OP-07 chưa đạt ngân sách |
| OP-24 | Tách `ManagerService` theo nghiệp vụ (`e1e72c5`), đổi tiêu chí 600 dòng/file | OPT-24, P2-10 | Q8 |

---

## 4. Việc của chủ dự án và quyết định còn mở

Người thực thi **không** đánh dấu các mục này.

| # | Việc / câu hỏi | Đề xuất | Trạng thái |
|---|---|---|---|
| FIX-45 | 2 tài khoản dùng chung còn mật khẩu yếu (chi tiết đã che): đổi mật khẩu, tài khoản dùng chung chỉ để viewer | Đổi ngay | Chưa làm |
| FIX-38 | Kiểm gzip trên production bằng `curl -I` | Người có quyền server | Chưa làm |
| Q5 | Bật CSRF production lúc nào? | Sau staging E2E ghi PASS | Chưa trả lời |
| Q6 (OPT) | Nguồn đúng cho 3 file JSON bộ hợp âm lệch DB | Xem `docs/OPT_REVIEW_2026-10-21.md` mục "Chênh lệch dữ liệu" | Chưa trả lời |
| Q6 (TV) | Ngân sách hiệu năng chính thức | ≤ 40 JS / ≤ 60 request / ≤ 1,5 MB / SVG ≤ 2,5 s trên 4G | Chưa trả lời |
| Q7 | Chấp nhận bước nối file JS (không bundler)? | Chỉ khi OP-07 chưa đạt ngân sách | Chưa trả lời |
| Q8 | Đổi "≤ 600 dòng/file" thành "≤ 30 dòng/hàm, một trách nhiệm/file"? | Có | Chưa trả lời |
| Q4 (TV) | Số bài cho tập không có số chính thức | (a) thứ tự catalog · (b) ẩn ô số · (c) chủ dự án cung cấp | Chưa trả lời |
| Q5 (TV) | 58 nhóm tên trùng | Rà từng nhóm qua dry-run | Chưa trả lời |
| Q7 (TV) | Hiện "bản nhạc tạm" trong danh sách mặc định? | Hiện, có huy hiệu | Chưa trả lời |
| Q8 (TV) | Ai nhập HD và tempo cho tập 2–7, nhịp độ nào? | Tên người phụ trách, số bài/tuần | Chưa trả lời |
| Worktree | Gỡ 4 worktree agent cũ trong `.claude/worktrees/` sau khi lấy xong `e14b7af` (OP-06) và `32eb9f6`/`cf45156` (OP-09) | `git worktree remove` | Chưa duyệt |

Đã trả lời trước đây: Q1 (TV) giữ Classic lâu dài; Q2 (TV) khách chỉ xem chương trình đã phát hành, không phân công; Q3 (TV) ◀ ▶ theo danh sách đang hiện; Q1–Q4 (OPT); Q-A…Q-D (Phương án 2).

---

## 5. Thang nghiệm thu

| Chỉ số | Hiện tại | Đích |
|---|---|---|
| Lỗi mức Cao còn mở trong mã | xem Giai đoạn 1 | 0 |
| Tài khoản nhận mật khẩu yếu | 2 | 0 (FIX-45) |
| Modern, 4G cache lạnh (JS / request / byte / SVG) | 84 / 103 / 1.993.443 / 11.225 ms (đo 2026-10-20) | theo Q6 (TV) |
| Cảnh báo AudioContext khi tải trang | còn | 0 |
| Nguồn đọc bộ hợp âm | DB + đĩa | chỉ DB (OP-21) |
| `csrf_enforce` production | tắt | bật (OP-20) |
| CI | PHP strict + JS + Chromium smoke | + E2E live-band/learn/editor |
| Tỉ lệ suite hành vi | runner mặc định coi là hành vi | số đếm từ nhãn thật (OP-01) |
| `!important` trong `assets/css` | 673 | ≤ 120 (TV3-7) |
| Bộ HD có hợp âm / bài có tempo thật | 147 / 100 trên 1.731 | tăng theo đợt TV5 |

---

## 6. Ngoài phạm vi

- Không đổi 4 Core Rule (HD mặc định, tông gốc = 0, khoá TLH/HD, đồng bộ setlist).
- Không đưa framework, bundler hay TypeScript vào dự án.
- Không đóng băng hay gỡ Classic `/old/`.
- Không viết lại lịch sử Git (mật khẩu cũ xử lý bằng cách đổi mật khẩu).

---

## 7. Lịch sử (chỉ để tra cứu, không làm theo)

Tất cả nằm trong [docs/history/](docs/history/).

| File | Ngày | Nội dung | Kết cục |
|---|---|---|---|
| `SHEETAPP2_DANH_GIA_TONG_THE_VA_LO_TRINH_2026-09-24.md` | 09-24 | Đánh giá tổng thể ban đầu | Đầu vào của ROADMAP 1–2 |
| `ROADMAP.md` (trong history) | 09-24 | Giai đoạn 0–3.9 | Xong; một số dấu [x] bị ROADMAP2/3 bác |
| `ROADMAP2.md` | 09-25 | Nghiệm thu lại GĐ0–3, kế hoạch GĐ4 | Bị thay bởi ROADMAP3 |
| `GIAO_VIEC_G3.9.md`, `GEMINI_IMPLEMENTATION_RULES.md` | 09-25 | Phiếu giao việc, luật bàn giao cũ | Xong / thay bằng mục 1 |
| `ROADMAP3.md` | 09-26 | GĐ 4.9 "Ổn định trước Pilot" | Xong; Phần 0 thành mục 1 ở trên |
| `ROADMAP4.md`, `ROADMAP5.md` | 09-26 → 09-29 | Thư viện L0–L6, R0–R5 | Xong |
| `ROADMAP6_R6_2026-10-01.md`, `ROADMAP7.md` | 10-01 → 10-02 | Thư viện R6-x, tối ưu điện thoại/laptop | Xong |
| `KE_HOACH_SKILLS_VA_GITHUB.md` | 10-17 | Skill, thư viện GitHub, OfflineVault | Xong |
| `PHUONG_AN_TOI_UU_HE_THONG_2026-10-17.md` | 10-17 | Tối ưu P0–P3 | Xong ở `e3dc9a3` |
| `ROADMAP6_TV_2026-10-17.md` | 10-17 | Thư viện TV0–TV7 | TV0/1/4 xong; phần còn lại ở Giai đoạn 3 |
| `PHUONG_AN_TOI_UU_HE_THONG_2026-10-21.md` | 10-21 | OPT-01…26 | Phần còn lại ở Giai đoạn 2 và 4 |
| `PHUONG_AN_2_2026-10-21.md`, `PHUONG_AN_2_EXECUTION.md` | 10-21 | FIX-01…45, P2-01…13 | 43/45 xong; FIX-38/45 ở mục 4 |
| `ROADMAPS.md` | 10-21 | Chỉ mục roadmap | Thay bằng file này (đổi tên giữ lịch sử) |

**Tài liệu vận hành còn dùng:** `docs/DATABASE_MIGRATION_RUNBOOK.md`, `docs/STAGING_AND_BACKUP_RUNBOOK.md`, `docs/LIBRARY_DATA_RELEASE.md`, `docs/INSTRUMENT_ANNOTATIONS.md`, `docs/ADR_005_TENANT_ISOLATION.md` (đã gỡ khỏi mã, chỉ tham khảo).

**Quy ước:** khi roadmap này xong hoặc bị thay, `git mv` nó vào `docs/history/ROADMAP_<ngày>.md` và cập nhật bảng trên. Không dùng `docs/archive/` (bị `.gitignore`).

---

## Phụ lục A — Cách sửa đề xuất cho từng BUG

Rút từ ba báo cáo rà soát 2026-10-22. Người thực thi phải đọc lại mã trước khi sửa; dòng số có thể lệch vài dòng. Nếu thấy lỗi không tái hiện được thì ghi "không tái hiện" kèm bằng chứng, không sửa mò.

### Backend

- **BUG-01** — `ManagerService::forkSong` dùng `Auth::requireBanhat()` (hoặc helper tương đương trong `api/core/Auth.php`, khớp `ChordSetController`). Ở `ChordSetService::forkSet`, nhánh fork của `ChordSetController` và đổi tên trong `ManagerService::saveUserChordSet`: từ chối nếu đã có dòng `(song_id, set_name)` (so `COLLATE NOCASE`) của **chủ khác**. Test: viewer fork → 403; banhat fork trùng tên bộ của người khác → lỗi, dữ liệu nạn nhân không đổi; chủ vẫn lưu/xoá được bộ của mình.
- **BUG-02** — `ReviewService` submit: `review_type = 'update_hd'` chỉ hợp lệ khi `target_type === 'chord_set'`. Approve: kiểm lại `target_type` và snapshot có dạng hợp âm trước khi gọi `writeHd`; câu `UPDATE … WHERE id = $targetId` ở `ReviewActionHelper` chỉ chạy khi target là bộ hợp âm.
- **BUG-03** — `SongService` delete: `$up = realpath(__DIR__ . '/../../storage/uploads'); if ($up !== false && str_starts_with($xmlFile, $up . DIRECTORY_SEPARATOR)) @unlink(...)`. Test: xoá bài có XML trả thành công, file thư viện gốc không bị xoá.
- **BUG-04** — `SetlistController`: chọn `SetlistService` (đầy đủ) khi `Auth::isBanhat()` (banhat trở lên), còn khách **và viewer** dùng `SetlistPublicReadService`. `offline_package` cần banhat, hoặc chương trình `published` và trả bản không có phân công. Áp dụng cho `getAll`, `getById`, `song_usage`.
- **BUG-05** — `ArrangementService` `save_arrangement`: khi có `id`, `SELECT id FROM arrangements WHERE id = ? AND song_id = ?`; không có thì báo lỗi, không DELETE/INSERT bước. Kiểm mọi `section_id` thuộc `song_id`.
- **BUG-06** — `PracticeController` `leader_view`: `AuthPolicy::authorize('view_team_progress')` (leader/admin). Trong `PracticeService`, người không đồng ý chia sẻ: bỏ `user_id`, `role` và mọi chỉ số (chỉ giữ số đếm ẩn danh nếu cần).
- **BUG-07** — `PracticeAssignmentCreationHelper` `create_from_plan`: khi bài tập đã tồn tại vẫn `INSERT OR IGNORE` targets; chỉ gửi thông báo cho target mới chèn (`rowCount() > 0`).
- **BUG-08** — `ReviewService` diff MusicXML: đổi `file_exists($path)` sang `SongService::resolveManagedXmlPath($path)`.
- **BUG-09** — `ManagerService` sửa hợp âm: cập nhật `checksum` cùng cách `ChordSetService` tính (đọc hàm `getChecksum`/`saveSet` để dùng lại).
- **BUG-10** — `SetlistService` respond_assignment: kiểm `rowCount()`; bằng 0 thì trả lỗi, không ghi audit "đã cập nhật".
- **BUG-11** — `PracticeAssignmentService` mark_done: thêm điều kiện `status NOT IN ('completed','excused')` và bài tập `status = 'active'`; chỉ phát sự kiện khi thực sự chuyển trạng thái.
- **Không sửa:** viewer tạo/phân công chương trình — chủ dự án giữ như hiện tại.

### Frontend Modern

- **BUG-12** — `chord-canvas.js` `applyPreloaded`: gọi `ChordCanvasEdit.closePopup(false)` và `resetUndo()` giống luồng `loadSong`.
- **BUG-13** — `lyric-extractor.js`: `SafeHtml.escape(title)`, `SafeHtml.escape(key)`.
- **BUG-14** — `cue-engine.js` `showBanner`: escape `text` từ host; hai cue nội bộ đang tự `_escapeHtml` thì cho đi đường riêng. `arrangement-engine.js`: escape `sec.name`.
- **BUG-15** — `song-preloader.js`/`song-loader.js`: không dùng cache khi `song.versionId`; đơn giản nhất là chỉ cache XML, luôn tải hợp âm mới. Nếu vẫn cache hợp âm thì xoá entry khi lưu/xoá/clone bộ, khi đăng nhập/đăng xuất, khi `saveModifiedXML`.
- **BUG-16** — `setlist-detail.js`: nút "Lưu Tập" chỉ hiện/chạy khi `String(item.song_id) === App.getCurrentSongId()`.
- **BUG-17** — `song-info-bar.js`: escape `timeBeats`, `timeBeatType`.
- **BUG-18** — `guitar-lens.js`: escape tên hợp âm trong `renderChordSvg` và thuộc tính `title`.
- **BUG-19** — `song-loader.js`: sau khi tải XML đọc lại `Store.get('currentTranspose')` thay vì giá trị chụp lúc bắt đầu; `app.js` `commitTranspose` không render khi đang có lượt tải chưa xong (dùng load token sẵn có).
- **BUG-20** — `chord-canvas-ui.js`: hàm dựng popup trả về `dispose()` gỡ listener `pointerdown` (capture) và đặt `_saved = true`; gọi trong `_destroyPopup`.
- **BUG-21** — `url-state.js`: đổi bài dùng `replaceState` (hoặc thêm `popstate` nạp bài theo URL). `performance/performance-engine.js`: gọi `URLState.resetForNewSong` trước khi follower nạp bài.
- **BUG-22** — `song-loader.js` chọn phiên bản: truyền `Store.get('currentTranspose')` và `ChordCanvas.getCurrentSet()`; sau `await` kiểm songId còn đúng mới vẽ danh sách phiên bản.
- **BUG-23** — `song-preloader.js`: lấy `xmlPath` thật từ `LibraryUI.getSongObj` hoặc `ApiService.songs.get`; thay `LibraryUI.getSongById` (không tồn tại) ở `app.js`, `performance-engine.js`.
- **BUG-24** — `chord-canvas-edit.js` hàng đợi offline: cờ `_flushing`; gặp 409 thì hiện `showConflictModal` hoặc chuyển mục sang danh sách xử lý tay, không `break` lặp mãi.

### Classic và app phụ

- **BUG-25** — `old/assets/js/chord-canvas.js`: thêm `resetUndo()` (xoá `_undoStack`, `_redoStack`), gọi trong `loadSong`, `switchSet`, `clearSong` (theo `assets/js/chord-canvas-edit.js`).
- **BUG-26** — `old/assets/js/chord-canvas-ui.js`: escape `currentSet` (~142), `existing` trong `value="…"` (~147), `name` trong hộp xác nhận xoá (~428).
- **BUG-27** — `old/assets/js/instruments.js` ~50: `SafeHtml.escape(name)`.
- **BUG-28** — `editor/editor.js`: tải phiên bản qua `api/index.php?route=songs&action=version_xml&version_id=…` (xem cách Modern làm sau FIX-29 trong `ApiService.js`).
- **BUG-29** — `live-band/js/stage-room.js`, `live-band/js/projector-app.js`: nhớ `cueId` (và mốc `bandState`) đã hiện; chỉ hiện khi mới và `expiresAt` chưa qua.
- **BUG-30** — chỉ khởi động lại đèn/nhịp khi `bpm !== _currentBpm`.
- **BUG-31** — `live-band.js`: `song?.defaultKey || song?.key || 'C'`.
- **BUG-32** — `live-band.js`: host chọn bài mới thì nạp với transpose 0 (Core Rule 2).
- **BUG-33** — `live-band.js`: nạp HD qua `ApiService.chordSets.load` và tiêm vào XML như Modern; HD rỗng thì giữ TLH và nhãn ghi đúng cái đang hiện (Core Rule 1).
- **BUG-34** — `live-band.js`: `_bindScrollObserver` chỉ gắn một lần (cờ module, gọi trong `init`).
- **BUG-35** — `live-band/js/stage-hud.js`: trong handler `release` đặt sentinel = null; gắn handler `release` cho sentinel xin lại.
- **BUG-36** — `assets/js/learn/learn-app.js`: đổi bài chọn HD trừ khi URL có `set`. `learn/ui/learn-score.js`: bỏ heuristic `isStubProfile`.
- **BUG-37** — thêm load token (`const t = ++_loadToken;` và kiểm sau mỗi `await`) ở `live-band.js` `_loadSong`, `projector-app.js`, `learn-app.js` `_selectSong`, `manager/js/manager-repertoire.js` `selectSong`, `editor/editor.js` `loadSong`.
- **BUG-38** — `editor/editor.js`: `confirm()` khi `_isDirty` lúc đổi bài/phiên bản; thêm `beforeunload` khi còn thay đổi chưa lưu.
- **BUG-39** — nút Ghim trong `manager-community.js`, `manager-repertoire.js`, `manager-versions.js`: chỉ hiện cho `leader` và `admin`.
- **BUG-40** — `old/assets/js/chord-canvas.js` `deleteSet`: xoá thất bại thì giữ bộ, báo lỗi, không chuyển sang HD. `old/assets/js/importer.js` ~234: dùng `SafeHtml.inlineJsString` cho tên file trong `onclick`.
- **BUG-41** — `assets/js/learn/ui/learn-controls.js`: dựng link "Quay về" bằng `ApiService.resolveUrl` thay vì `/?song=`.
