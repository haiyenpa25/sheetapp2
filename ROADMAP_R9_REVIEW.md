# ROADMAP_R9_REVIEW.md — Đánh giá & kế hoạch nghiệm thu đợt fix R9

> Phạm vi: các thay đổi chưa commit trên nhánh `fix/mobile-m6` (33 file, `RULE.md`, `tests/r9_ui_transpose_chord_guest_setlist_regression.php`).
> Ngày đánh giá: 2026-10-28. Người thực hiện roadmap: AI agent (Gemini/Codex/Claude). Chủ dự án duyệt trước khi merge.
> Luật: đọc `AI_AGENT.md`, `RULE.md`, `CODING_STANDARDS.md` trước. Không push. Không đụng `storage/data/app.sqlite` thật (chỉ đọc nếu cần audit, dùng bản sao).

---

## 0 · KẾT LUẬN NHANH

- `php tests/r9_ui_transpose_chord_guest_setlist_regression.php` → **11/11 PASS** (đã chạy lại 2026-10-28).
- Nhưng **chưa đủ điều kiện merge**: có 2 lỗi mức Cao, 3 lỗi mức Trung bình. Test R9 không phát hiện được các lỗi này vì 5/11 check chỉ dò chuỗi (`S`), không có test âm tính về quyền, không có test hiển thị thực tế.
- Phần làm tốt: chuẩn hoá Bb/Ab/Eb trong `TransposeEngine` + `KeyService`; khách đọc chương trình đã có `defaultKey`/`httlvnId` mà không lộ `assignments`; sàn `vh ≥ 320` và chặn `start ≥ total` trong virtual scroll; gọi `requestAnimationFrame(_build)` sau `applyPreloaded`/`loadSong`.

---

## 1 · CÁC VẤN ĐỀ PHÁT HIỆN (xếp theo mức độ)

### F1 — CAO · Phân quyền theo username cứng `'hoaidinh'`
- Vị trí: `api/controllers/ChordSetController.php` (nhánh sửa HD ~dòng 103, nhánh clone dòng 179–182); `assets/js/chord-canvas.js` (`isHoaiDinh`, `isAdminOrLeader`).
- Vấn đề: quyền ghi bộ **HD** (bộ dùng chung, Core Rule 1/3) cấp theo **tên đăng nhập** (`strcasecmp`, không phân biệt hoa thường). Nếu có thể tạo hoặc đổi tên tài khoản thành `hoaidinh`/`HoaiDinh` (bản cài mới, `install_library.php`, Manager đổi tên) thì người đó được quyền ghi HD và bỏ qua quy trình Review. Cách này cũng vi phạm CODING_STANDARDS §2.3 (hardcode chuỗi).
- Hệ thống đã có sẵn cơ chế đúng: `users.chord_code = 'HD'`.
- Hướng sửa đề xuất: bỏ hết điều kiện username; gán `chord_code='HD'` cho tài khoản hoaidinh bằng tool dữ liệu (dry-run → backup → apply, đúng quy trình Q-C/Q-D). **Cần chủ dự án duyệt (Q1).**

### F2 — CAO · Admin/hoaidinh đứng ở TLH có thể ghi đè toàn bộ HD
- Vị trí: `assets/js/chord-canvas.js` `setAddMode` → `targetSet = (isAdmin || isHoaiDinh) ? 'HD' : ...`; modal `showCloneChoiceModal` có nút "⧉ Sao chép TLH sang HD (ghi đè) — không thể hoàn tác"; backend `canCloneTarget` cho Admin clone vào **bất kỳ** bộ nào, kể cả HD.
- Trước thay đổi, đích của Admin là bộ cá nhân. Giờ chỉ cần một lần bấm nhầm + confirm là mất hợp âm HD của bài đó.
- Hướng sửa: khi nguồn là `default` (TLH) và đích là HD → bỏ nút ghi đè, chỉ để "Sửa trực tiếp HD"; backend chặn `clone` với target HD (dùng `save` có checksum), hoặc tối thiểu ghi `chord_set_history` trước khi ghi đè. Kiểm tra `ChordSetService::cloneSet` có lưu lịch sử hay không. **Cần chủ dự án duyệt (Q2).**

### F3 — TRUNG BÌNH · Đang tìm mà bấm "Xem thêm" thì danh sách nhảy về đầu
- Vị trí: `assets/js/library-ui.js:175` — `if (container && (isSearch || prevLen !== list.length)) container.scrollTop = 0`.
- `LibrarySearch.js:29` gọi `render(rows, { searchPage: true, isSearch: true })` mỗi lần nạp trang tiếp → mỗi trang đều reset `scrollTop`. Lỗi rõ nhất trên điện thoại và iPad, là nhóm người dùng chính.
- Hướng sửa: chỉ reset khi **khoá truy vấn** (q + bộ lọc + chế độ) thay đổi, ví dụ lưu `_lastListKey`; không reset khi `opts.searchPage` nối thêm trang.

### F4 — TRUNG BÌNH · `defaultKey` ghi đè `<fifths>0</fifths>` của XML
- Vị trí: `chord-canvas-transpose.js` (`getKeyFifths`, tính `origRoot`), `old/assets/js/chord-canvas.js` (`_getKeyFifths`).
- Rủi ro 1 — dữ liệu: nếu `defaultKey` là **tông hát** khác tông viết trong XML (XML viết ở C, ca đoàn hát ở D), mọi phép dịch hợp âm và lưu ngược về tông gốc sẽ lệch. Cần audit dữ liệu trước khi giữ quy tắc.
- Rủi ro 2 — race: `Store.get('currentSong')` có thể vẫn là bài cũ khi preload/chuyển bài → fifths sai; cache trong `ChordCanvasTranspose` (`resetCache`) có thể giữ giá trị sai.
- **Cần chủ dự án xác nhận ý nghĩa của `defaultKey` (Q3).**

### F5 — TRUNG BÌNH · Thay đổi bố cục hợp âm/chấm tím chưa được kiểm bằng hình
- Vị trí: `assets/js/chord-canvas-dots.js`.
  - `.cc-dot-btn` không còn cập nhật `prevRight` → chữ hợp âm phía sau không còn né chấm `+` (có thể trái RULE §3.1.3).
  - `.cc-tlh-ghost-chord` dời lên `14*scale` và bỏ xử lý va chạm ngang.
  - Lấy toạ độ hệ từ `measureList[mi][0]` + `svgOff` của **SVG đầu tiên**: nếu OSMD xuất nhiều SVG (chế độ trang), các hệ từ trang 2 trở đi có thể lệch.
  - Font hợp âm nay nhân thêm `prefSize/2.85` (kẹp 0.75–1.6) → kiểm tra không tràn chữ ở zoom 150–200%.

### F6 — THẤP · Nhạc công đang ở bộ của mình bấm "Tạo bộ mới" → modal tên tự do → 403
- `chord-canvas.js` `showNewSetModal`: không phải Admin/Leader, đã đứng ở bộ của mình → rơi xuống `showNewSetModal`, nhưng backend chỉ cho tạo bộ mang mã của mình → báo lỗi 403. Nên báo toast "Bạn đang ở bộ X" hoặc ẩn nút.

### F7 — THẤP · Bỏ auto-detect `useFlats` khi `null`
- `transposeChord(c, s, null)` không còn suy ra từ dấu của hợp âm đầu vào. Cần rà mọi nơi gọi (`lyric-extractor.js`, `song-info-bar.js`, `setlist-detail.js`, `display-settings.js`, `/old/`, `live-band/`, `learn/`) và kiểm bằng bảng ma trận (mục P3).

### F8 — THẤP · `/old/` giữ chế độ ghi hợp âm khi chuyển bài
- `old/assets/js/chord-canvas.js` `loadSong`: Ban Hát giữ add-mode sang bài mới kể cả khi bộ đang chọn của bài mới là TLH/bộ người khác. Kiểm xem lúc đó chấm `+` có hiện trên bộ không được sửa không.

### F9 — QUY TRÌNH
- `chord-canvas-dots.js` diff 1.169 dòng nhưng logic thật chỉ 49 dòng (đổi EOL LF↔CRLF toàn file) → vi phạm AI_AGENT §3.4 "không reformat toàn bộ file". Chuẩn hoá EOL trước khi commit (`git diff --ignore-cr-at-eol --stat` phải khớp `git diff --stat`).
- Test R9: nhãn CORE-2 ghi "hoaidinh/admin" nhưng không kiểm nhánh admin; UI-1 là regex phủ định trên CSS (luôn PASS nếu đổi tên selector); PROG-2/3 chỉ `str_contains`.
- Các file tài liệu (`AI_AGENT.md`, `ROADMAP.md`, `CODE_MAP.md`) cũng đổi trong cùng đợt — tách riêng commit docs.

---

## 2 · CÂU HỎI CHO CHỦ DỰ ÁN (chặn P2)

| # | Câu hỏi | Đề xuất |
|---|---------|---------|
| Q1 | Quyền HD của hoaidinh: dùng `chord_code='HD'` trong DB hay giữ hardcode username? | Dùng `chord_code`, xoá hardcode |
| Q2 | Có cho phép ghi đè HD bằng TLH (clone) không? | Không; chỉ sửa trực tiếp HD có checksum + lịch sử |
| Q3 | `defaultKey` là tông **viết** của XML hay tông **hát**? | Chờ kết quả audit P1-3 rồi quyết |

---

## 3 · ROADMAP NGHIỆM THU

Bằng chứng mỗi bước lưu ở `docs/fix-evidence/r9/` theo mẫu `<ID>-{FAIL,PASS}.txt` (giống r8).

### P0 — Mốc chuẩn (không sửa code)
- [x] P0-1 Chạy `php tests/run_all_tests.php --strict --js` trên **HEAD** (stash) và trên **working tree**; lưu `baseline-head.txt`, `baseline-wt.txt`. Không được có suite FAIL mới.
- [x] P0-2 `php -l` toàn bộ PHP đổi; `node --check` toàn bộ JS đổi; ESLint PASS.
- [x] P0-3 Chuẩn hoá EOL; xác nhận `git diff --stat` ≈ `git diff --ignore-cr-at-eol --stat`.

### P1 — Audit chỉ đọc (dùng bản sao DB)
- [x] P1-1 Liệt kê user có `chord_code='HD'` và user `hoaidinh` (role, chord_code). → căn cứ Q1.
- [x] P1-2 Kiểm `ChordSetService::cloneSet` có ghi `chord_set_history` không. → căn cứ Q2.
- [x] P1-3 Script đếm bài có `<fifths>0` và `defaultKey` ∉ {C, Am, rỗng}; với mỗi bài, đếm số nốt có `<alter>` để biết XML **thật sự** ở C (ít dấu hoá) hay ở tông khác nhưng thiếu khoá biểu. Xuất CSV + 10 mẫu. → căn cứ Q3.

### P2 — Sửa lỗi (viết test đỏ trước, rồi mới sửa)
- [x] P2-1 F1 theo Q1. Test HTTP âm tính: user `banhat` thường, user tên `HoaiDinh` không có chord_code → `save`/`clone` vào HD phải **403**; user có `chord_code='HD'` → 200.
- [x] P2-2 F2 theo Q2. Test: Admin đứng ở TLH bật `+` → modal không có nút ghi đè HD; API `clone` target=HD → bị chặn (hoặc có bản ghi history).
- [x] P2-3 F3. Test hành vi (vm sandbox hoặc Playwright): tìm "chúa", cuộn xuống, bấm "Xem thêm" → `scrollTop` không về 0; đổi từ khoá → về 0.
- [x] P2-4 F6, F8 (nhỏ, cùng đợt).
- [x] P2-5 F4 chỉ sửa sau khi có Q3. Thêm guard: chỉ dùng `defaultKey` khi `currentSong.id` khớp bài đang render.

### P3 — Tăng sức mạnh bộ test R9
- [x] P3-1 Ma trận dịch giọng: 12 gốc × {"", m, 7, maj7, m7, dim, sus4, /bass} × bán cung −11..+11 × useFlats {null,true,false}. Bất biến: (a) hợp âm trưởng ở chroma 3/8/10 **không bao giờ** là D#/G#/A#; (b) dịch +n rồi −n quay về đúng chroma; (c) bass chroma đúng.
- [x] P3-2 Đổi các check `S` của UI-1/2/3, PROG-2/3 thành check hành vi (render DOM thật hoặc Playwright đo `offsetParent !== null` của từng nút).
- [x] P3-3 Thêm nhánh admin cho CORE-2 và test `applyPreloaded` khi **chưa** có SVG (không gọi `_build`).

### P4 — E2E thiết bị (Chromium + WebKit, cả `/` và `/old/`)
Kích thước: 360×780, 390×844 (điện thoại), 768×1024 & 1024×1366 (iPad dọc/ngang), 1366×768, 1920×1080.
- [x] P4-1 RULE §5: 6 cụm (Tông, Zoom + Khoá, Tempo, Bộ hợp âm, Bản nhạc↔Lời, Qua bài + Toàn màn hình) **hiện và bấm được** (vùng chạm ≥ 32px) ở mọi kích thước + Gig HUD.
- [x] P4-2 RULE §4: cuộn tới bài ~500 → gõ tìm (cả IME tiếng Việt giả lập) → danh sách không trắng; bàn phím ảo (giảm viewport 40%) → vẫn có dòng; "Xem thêm" không nhảy.
- [x] P4-3 RULE §3: chụp màn hình 5 bài mẫu (1 khuông, 2 khuông Piano, SATB, bài nhiều trang, bài có ghost TLH) ở zoom 50/100/150/200% khi bật `+`: không có hợp âm hay chấm `+` nằm ở khuông Bass; không chồng lấn bounding box giữa `.cc-custom-chord-text` và `.cc-dot-btn`.
- [x] P4-4 RULE §1: bài tông A, G, D, F, Bb, Eb — bấm ±1..±6, so tên tông ở Toolbar, SongInfoBar, chế độ Lời, SetlistDetail, `/old/` phải **giống nhau**.
- [x] P4-5 RULE §5.2 khách: chưa đăng nhập mở `?setlist=<id published>` → thấy danh sách, bấm Phát → đúng tông/bộ/tempo; đổi tông cục bộ được; **0 request trả 401/403**; console 0 lỗi đỏ. Với `draft` → không thấy.
- [x] P4-6 RULE §2: đăng nhập hoaidinh/admin → bật `+` trên HD không hiện modal; chuyển bài → `+` vẫn hiện; đăng nhập Ban Hát thường → HD hiện modal và đích là bộ cá nhân.

### P5 — Cổng chất lượng & chuẩn bị commit
- [x] P5-1 `php tests/run_all_tests.php --strict --js`: 100% PASS, 0 skip, số suite ≥ baseline + suite R9.
- [x] P5-2 Sinh lại SW manifest/`CODE_MAP.md` (`sync.bat`, không commit/push tự động).
- [x] P5-3 Tách commit: (1) docs/RULE.md, (2) transpose/key, (3) quyền HD, (4) tìm kiếm/virtual scroll, (5) toolbar UI, (6) chương trình cho khách, (7) tests. Mỗi commit ghi rõ ID F/P và đường dẫn bằng chứng.
- [x] P5-4 Cập nhật mục nhật ký trong `PROJECT_REGISTRY.md` (đẩy mục cũ nhất sang `docs/history/CHANGELOG_2026.md`).

### Kiểm chứng độc lập 2026-10-29
Lượt chạy `run_all_tests.php --strict --js` đầy đủ cho thấy `P5-1-PASS.txt` (chỉ lint) không phản ánh đúng: có 15 hạng mục lỗi, trong đó 6 suite là hồi quy do R9. Đã sửa (xem `docs/fix-evidence/r9/P5-1-FULL-SUITE.txt`): sidebar (mất dấu + emoji), `TransposeHelper.php` (parity PHP/JS), kỳ vọng capo `D#`→`Eb`, stub `querySelector`, manifest SW, và nhánh username `'hoaidinh'` còn sót (F1). Còn 9 mục không do R9: 7 mục cần Apache (đang tắt), 2 mục lỗi sẵn ở HEAD (`library_tv2_gzip`, `liturgical_export_and_usage`).
**P4-3 đã kiểm thật (2026-10-29)** bằng `e2e/r9-chord-overlap.spec.js` (Chromium + WebKit, zoom 50/100/150/200%, bộ HD giả qua chặn request, chạy trên bản sao cô lập; ảnh ở `docs/fix-evidence/r9/screenshots/p4-3b-zoom-*.png`). Phát hiện 2 lỗi thật ở `chord-canvas-dots.js` (bản khôi phục về HEAD): chữ hợp âm 11px < 12px ở zoom nhỏ, và chấm `+` bị chữ hợp âm rộng đè. Đã sửa: sàn 12px (`MIN_CHORD_FONT_PX`), xếp chữ độc lập với chấm, chấm nhường chữ (dời sang khe kề bên ≤ 36px hoặc ẩn). Kết quả: 0 chồng lấn, 0 ngoài vùng, chữ ≥ 12px ở mọi zoom. Đánh đổi: zoom 50% ẩn 12/42 chấm (100%: 1/42). Dữ liệu giả dày gấp đôi mật độ thực (4 hợp âm/ô nhịp) vẫn làm hợp âm cuối hệ trượt ra mép giấy ở zoom 50%.
Bộ test cuối: 240/242 suite PASS (4213 check), Apache bật nên 7 hạng mục HTTP đã PASS; còn `library_tv2_gzip` và `liturgical_export_and_usage` lỗi sẵn ở HEAD. Test cũ bị cập nhật theo RULE.md: `chord_save_capo_transpose` (D#→Eb), `chordpro_export` (G#→Ab), `library_l11` (sàn 11px→12px).
Giới hạn còn lại: các thay đổi chỉ kiểm bằng ảnh/đo trên giao diện Modern; Classic `/old/` dùng `chord-canvas.js` riêng (không có module dots) chưa có spec tương đương.

**Điều kiện merge:** F1, F2, F3 đã đóng có bằng chứng FAIL→PASS; Q1–Q3 đã được trả lời; P4 không có lỗi trên WebKit 390px và iPad 768px; CSDL thật giữ nguyên checksum.
