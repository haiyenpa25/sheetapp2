# ROADMAP UX THEO VAI TRÒ — Bộ thao tác nhanh cho màn đọc (2026-10-27)

> **Người đọc:** chủ dự án (duyệt mục 6) và một AI thực thi.
> **Nối tiếp:** `ROADMAP_MOBILE.md` (M0–M6, nhánh `fix/mobile-m6`, chưa gộp `main`). Làm **UX0 trước**: đó là lỗi của đợt mobile, phải sửa xong mới gộp.
> **Phạm vi:** màn đọc bản nhạc ở cả hai giao diện, Modern `/` và Classic `/old/`. Cả hai luôn tồn tại.
> **Luật thực thi:** như `ROADMAP.md` mục 1 (FAIL → PASS, test không ghi DB/storage thật, ≤ 5 file mỗi ticket, không deploy, dừng hỏi khi đổi quyền/Core Rule).
> **Nguồn:** kiểm kê bằng Playwright trên `fix/mobile-m6` @ `7059d26` với vai trò khách, ở 390×844, 844×390, 768×1024, 1180×820, 1366×768, cả hai giao diện. Quyền theo vai trò suy từ `assets/js/auth.js:224-266`. Cổng PHP chạy lại trên cùng commit.

---

## 0. Tóm tắt

**Bản mobile của Antigravity: đúng hướng, nhưng chưa gộp được.**
- Phần ổn định tải làm tốt: khởi động cô lập lỗi, timeout, giữ tên bài khi lỗi, vẽ lại 1 lần khi xoay, lõi dùng chung cho hai giao diện. Modern không có lỗi console ở cả 5 kích thước màn hình.
- **Classic bị lỗi nặng do chính đợt này gây ra** (M4-9b, commit `301360b`). `old/assets/js/toolbar-controller.js:105` gọi `SafeStorage.getItem`/`setItem`, nhưng `SafeStorage` chỉ có `get`/`set`/`remove`. Lỗi ném ra ở mọi màn hình, kéo theo khoảng 12 nút không có listener: toàn màn hình, sáng/tối, hướng dẫn, in, gọn nhẹ, nổi bật hợp âm, ký hiệu hợp âm, ghi chú nhạc cụ, nhập hợp âm, tạo bộ mới, ghim, nhật ký. Test không bắt được lỗi này.
- Lượt chạy E2E và rà mã lõi trên bản sao cách ly còn thấy thêm **5 lỗi Cao**: SW cắt mạng sau 4 s, upload bị timeout 12 s, lỗi tải bộ hợp âm có thể dẫn tới ghi đè HD, mất khoá zoom ở tablet, Classic mất nút xoá bộ hợp âm. Bảng tổng kết M6 có số gán sẵn chứ không phải số đo, và spec E2E ghi đè file trong repo nguồn. Chi tiết: mục 1 (UX0-10…23).
- Cổng PHP: **234/235 suite** đạt (báo cáo ghi 235/235). Suite lỗi (`library_tv2_gzip_regression.php`) là lỗi có sẵn từ `main`: suite in "SKIPPED:" theo kiểu runner không nhận ra khi thiếu `SHEETAPP_TEST_URL`.

**Vì sao thấy "quá ít nút":** đợt gỡ nút trùng (M4-3) đã gỡ đúng các bản trùng, nhưng cũng **đẩy luôn chức năng chính vào menu** mà không đưa ra lối 1 chạm khác:
- zoom mất khỏi toolbar ở tablet ngang và laptop; khoá zoom chỉ còn trong menu;
- nút "Gốc" chỉ còn ở laptop;
- tempo, cuộn, zoom không có trên thanh dưới điện thoại;
- Classic dồn zoom, capo, phát/dừng nhạc, cuộn, metronome vào ⋮. Đang phát nhạc thì không thấy nút Dừng.

Menu ⋯ của Modern vẫn có 25–28 mục trộn lẫn, nên vừa ít nút ngoài màn vừa rối trong menu.

**Hướng mới:** không quay lại kiểu nhiều nút trùng. Màn đọc có ba tầng thao tác:
1. **Thanh nhanh cố định**, giống nhau cho mọi người.
2. **Bảng công cụ nhanh**: lưới icon có chữ, mở bằng 1 chạm, nội dung **theo vai trò đang chọn** (Ban hát / Nhạc công / Dẫn).
3. **Menu ⋯** chỉ còn việc hiếm dùng.

Mỗi điều khiển chính (zoom, tông, tempo, bộ hợp âm, khổ) là **một chip bấm được**. Chip hiện giá trị hiện tại; chạm vào thì mở bảng chọn đầy đủ (ví dụ zoom có danh sách %, vừa bề rộng, vừa trang, khoá).

---

## 1. Việc phải sửa trong bản mobile trước khi gộp (UX0)

| ID | Mức | Lỗi | Vị trí | Sửa | Nghiệm thu |
|---|:-:|---|---|---|---|
| UX0-1 ✅ `b5ed152` | Cao | Classic: `SafeStorage.getItem/setItem` không tồn tại, chết ~12 nút | `old/assets/js/toolbar-controller.js:105,115` | Dùng `SafeStorage.get/set`. Rà toàn repo mọi lời gọi `SafeStorage.` sai tên. Mỗi bước `_bindX` trong toolbar-controller chạy qua `safeInit` để một bước lỗi không kéo các bước sau | E2E Classic 390/768/1366: 0 pageerror; bấm ⛶ vào gig; D đổi sáng/tối; mỗi mục ⋮ có listener. Test VM gọi toolbar-controller với SafeStorage thật |
| UX0-2 ✅ `e9641b5` | Cao | Test M6 không bắt được UX0-1: không kiểm pageerror ở Classic | `e2e/m6-acceptance.spec.js` | Spec nghiệm thu FAIL khi có bất kỳ `pageerror` hoặc console error ở cả hai giao diện | Chạy spec trên bản lỗi → FAIL; sau UX0-1 → PASS |
| UX0-3 ✅ `780e59d` | Cao | Gig HUD ở 768 và 1180: thanh tên bài và dải đoạn bài đè lên hàng Tông/Nhạc/HD/◀▶, gần như không bấm được | gig HUD (Modern) | Xếp HUD thành các hàng không chồng; dải đoạn bài nằm dưới hàng điều khiển | E2E 768/1180: `elementFromPoint` tại tâm mỗi nút HUD trả về chính nút đó |
| UX0-4 ✅ `fc47fa5` | TB | Classic không ẩn mục theo quyền: khách thấy "Nhập/Sửa hợp âm", "Tạo bộ hợp âm mới", "Nhật ký biểu diễn", "✎ Gõ ChordPro" trên từng khổ | `old/assets/js` (menu ⋮, lyric view) | Dùng cùng hàm quyền với Modern (`auth.js` `canEditChords`) | E2E Classic khách: không thấy các mục này |
| UX0-5 ✅ `bdcb9d6` | TB | Gig HUD ghi zoom 75% trong khi menu ghi 100% | Modern | Một nguồn giá trị zoom (Store), mọi nhãn đọc từ đó | E2E: đổi zoom ở HUD → menu hiện cùng số |
| UX0-6 ✅ `6736c7a` | TB | Menu ⋯ điện thoại: nút zoom −/+ và "Khóa zoom" cao 20px, chữ xuống dòng; "⚙Bè SATB" dính chữ; footer che "Về tông gốc"; menu Classic ở 390 bị cắt "Giao diện Mới" | menu Modern, menu Classic | Sửa chỗ chồng/cắt (hệ kích thước đầy đủ làm ở UX3 theo mục 4.4) | Ảnh 390: không chữ chồng; mục cuối menu cuộn tới được |
| UX0-7 ✅ `7f5dabe` | Thấp | Tông hiển thị không nhất quán: điện thoại Modern ghi tên tông "G", tablet ghi số "0" | Modern | Một định dạng chung: tên tông + độ dịch nếu khác 0 (ví dụ "A (+2)") | E2E 390/768: cùng chuỗi |
| UX0-8 ✅ `8ddbd63` | Thấp | Suite gzip bị tính là lỗi khi thiếu `SHEETAPP_TEST_URL` | `tests/library_tv2_gzip_regression.php:32` | In `[SKIP] …` rồi `SUITE_COMPLETE total=N`, theo mẫu runner | Runner: suite tính SKIP, không FAIL |
| UX0-9 | Thấp | `docs/mobile-evidence/M4-3-allocation.md` vẫn ghi "Chờ chủ dự án duyệt"; mục 7 `ROADMAP_MOBILE.md` chưa ghi câu trả lời Q-M1…Q-M5 | tài liệu | Chủ dự án ghi xác nhận (người thực thi không tự điền) | — |

**Bổ sung từ lượt chạy E2E và rà mã lõi** (bản sao cách ly `sheetapp2-verify-m6`, đối chứng với `main`):

| ID | Mức | Lỗi | Vị trí | Sửa | Nghiệm thu |
|---|:-:|---|---|---|---|
| UX0-10 ✅ `0d6888e` | Cao | SW cắt mạng sau 4 s. Trên 4G: trang chưa có shell trong cache (`/manager/`, `/learn/`, `/live-band/`, POST đăng nhập) lỗi cứng. Asset `?v=` mới chưa cache rơi về bản cũ qua `ignoreSearch`, trộn HTML mới với JS cũ. XML thực tế chỉ được chờ 2×4 s. Request hết giờ không bị huỷ | `sw.js:20-35`, dùng ở `:289,326,336` | ~15 s + `AbortController`. Navigation không có shell thì `return fetch(request)`. Khi online không fallback `ignoreSearch` cho asset có `?v=` | Test SW: mạng chậm 8 s → vẫn nhận bản mạng; offline → bản cache; asset `?v=` mới không bao giờ trả bản cũ khi online |
| UX0-11 ✅ `8e8e2a7` | Cao | Timeout 12 s áp cả cho upload/POST (`importer.upload`, `omr.create`, `saveXml`). Ảnh 3–5 MB trên 4G luôn hết giờ dù server xử lý xong; bấm "Thử lại" → nhập trùng | `assets/js/core/ApiService.js:44,59,85-93` | Request khác GET hoặc body FormData: không timeout, hoặc ~120 s | Test VM: POST chậm 20 s không bị huỷ; GET chậm vẫn timeout |
| UX0-12 ✅ `ee151c4` | Cao | Lỗi tải bộ hợp âm bị nuốt: core trả `{error, checksum:''}` nhưng nơi gọi bỏ qua `cr.error`. Lỗi mạng làm HD trông như rỗng → hiện TLH → người soạn thêm 1 hợp âm → lưu với checksum rỗng, server bỏ kiểm xung đột → **ghi đè cả bộ HD** | `assets/js/core/ChordCanvasCore.js:345-351`; `assets/js/chord-canvas.js:145,341`; `old/assets/js/chord-canvas.js:122,375`; `ChordSetController.php:85` | Có `cr.error` thì toast "Không tải được bộ hợp âm" và chặn lưu bộ đó cho tới khi tải lại thành công | Test VM: `load` lỗi → không gọi `save`; E2E: chặn `chord_sets load` → nút lưu bị khoá |
| UX0-13 ✅ `9253fb1` | Cao | Khoá zoom không còn lối bấm ở 681–1100px và desktop rộng (CSS ẩn cả hàng chứa nút) | `assets/css/library-polish.css:2188-2201` | Đưa `#btn-menu-lock-zoom` ra khỏi hàng bị ẩn (làm triệt để ở UX2-1) | E2E 768/1366: khoá zoom bấm được |
| UX0-14 ✅ `af4ac79` | Cao | Classic bỏ page-bar làm mất hẳn: xoá bộ hợp âm tuỳ chỉnh, xoá toàn bộ hợp âm, đổi trang/số trang | `old/assets/css/layout.css:753`, `old/includes/sheet_viewer.php:101,129,133` | Thêm 3 mục vào ⋮ gọi handler sẵn có (theo quyền) | E2E Classic (người có quyền): xoá bộ được; mọi tính năng có trên `main` vẫn có lối bấm |
| UX0-15 ✅ `5b54dad` | TB | `OSMDRenderCore.reportRenderError` gọi `showLoadError(song, {message,onRetry})` trong khi chữ ký là `(song, message, onRetry, onViewLyric)` → panel hiện "[object Object]", nút Thử lại không vẽ lại. `ErrorReporter.report` cũng gọi sai nên mất chi tiết lỗi | `assets/js/core/OSMDRenderCore.js:44-50`; `assets/js/app-ui.js:501`; `old/assets/js/app-ui.js:270` | Gọi đúng chữ ký ở cả hai giao diện | Test VM: lỗi vẽ → panel có chữ lỗi; Thử lại gọi vẽ lại |
| UX0-16 ✅ `29f7175` | TB | Watchdog kiểm 700 ms sau `load`; trên 4G danh sách bài chưa về → hiện banner lỗi giả, không bao giờ gỡ | `index.php:29`, `old/index.php:28` | Gỡ banner khi danh sách render xong; chỉ báo lỗi khi App thật sự chưa sẵn sàng | E2E 4G chậm: không có banner khi cuối cùng danh sách hiện |
| UX0-17 ✅ `7c8b22d` | TB | Điện thoại đang trong chương trình: nút bài trước/sau (`#btn-sp-prev/next`, z-index 850) bị thanh dưới (z-index 999) che; `#nav-arrows` lại bị ẩn khi program bar hiện | `layout.css:2242-2251`, `sheet.css:2950-2963`, `library-polish.css:2191-2192` | Một cặp ◀ ▶ duy nhất trên thanh nhanh, đi theo chương trình khi đang trong chương trình (mục 3.2 #2) | E2E 390 có chương trình: ◀ ▶ bấm được (`elementFromPoint`) |
| UX0-18 ✅ `0dae61c` | TB | Spec E2E ghi vào workspace nguồn (vi phạm luật 6): ghi đè `docs/mobile-evidence/M0-baseline.md`, `M6-acceptance.md`, `M4-8-title-360.png` mỗi lần chạy | `e2e/m6-acceptance.spec.js:10-12`, `e2e/mobile-load-baseline.spec.js:9-11`, `e2e/m4-stage2-layout.spec.js:230` (đường dẫn cứng) | Ghi vào thư mục output của bản sao; bỏ đường dẫn cứng | Chạy spec → `git status` của repo nguồn sạch |
| UX0-19 ✅ `dc741f5` | TB | Bằng chứng M6 không phải số đo: `readM6Store()` gán sẵn toàn "đạt" (`m6-acceptance.spec.js:58`), fallback `?? 0/1/2` (`:144-157`), cột "Trước" gõ cứng. "21/30 hỏng" mâu thuẫn với `M0-baseline.md` (cộng ra 25/30); "Classic 1 lần vẽ/xoay" mâu thuẫn với bảng đo (2, 3, 2). WebKit chỉ có độ trễ 150 ms, không phải 4G + CPU 4× | `e2e/m6-acceptance.spec.js`, `docs/mobile-evidence/M6-acceptance.md` | Sinh lại bảng chỉ từ số đo; ghi rõ điều kiện mỗi trình duyệt; số "Trước" đọc từ file M0 | Đối chiếu: mỗi ô bảng truy được về một số đo trong log |
| UX0-20 ✅ `9e36dfe` | TB | Test kiểm chuỗi nguồn in `[PASS:B]` nên bị tính là hành vi: `tests/m6_acceptance_regression.php`, `tests/js/m5_2..5_*.cjs`, `m1_boot_runner.cjs:162` | các file trên | Đổi sang `[PASS:S]`, hoặc viết lại thành test chạy mã thật | Runner: tỉ lệ hành vi giảm đúng số check đã sửa nhãn |
| UX0-21 ✅ `83448be` | TB | `library-mobile-hd-tlh-switch` hồi quy trên cả hai trình duyệt: `#btn-mobile-chordset` giờ mở bảng chọn thay vì đảo HD↔TLH | `e2e/library-mobile-hd-tlh-switch.spec.js` | Cập nhật spec theo hành vi mới (mở bảng → chọn TLH → hiện TLH) | Spec PASS Chromium + WebKit |
| UX0-22 ✅ `51f81ae` | TB | Hai bằng chứng PASS không tái lập: M4-9b (dark mode Classic, do UX0-1) và M4-8 (tên bài WebKit 360px rộng 108px < 120) | `e2e/m4-*.spec.js` | Sau UX0-1 chạy lại; M4-8 sửa CSS cho đạt ngưỡng hoặc ghi rõ điều kiện | Cả hai PASS 3/3 lần |
| UX0-23 ✅ `5837860` | Thấp | Timeout/abort không bao phần đọc body (`ApiService.js:107-121`); `SafeStorage` trả giá trị cũ khi ghi lỗi do quota (`SafeStorage.js:19-27`); `BootRunner.markReady` chạy cả khi module chính lỗi (`assets/js/app.js:123`); module tải theo nhu cầu (FollowLeader, LiveSync) có thể không được `init()`; Classic `OSMDRenderer.reload()` không đặt `isLoaded` (`old/assets/js/osmd-renderer.js:337-372`) | như cột Lỗi | Sửa từng điểm, mỗi điểm một test | Test VM từng điểm |

Lỗi có sẵn trên `main`, không do nhánh mobile: 10/12 lỗi của các spec cũ (`l02-chord-fallback`, `setlist-item-customization`, `setlist-bpm`, `setlist-navigation`, trên cả hai trình duyệt). Ghi vào `ROADMAP.md` để làm riêng, không chặn gộp.

Đã kiểm, không thấy lỗi: retry chỉ áp cho GET (không gửi trùng POST); token chống đổi bài nhanh hoạt động ở cả hai giao diện; Core Rule 2/3/4 không bị lõi mới đổi; không rò listener theo mỗi lần tải bài; precache `/old/` đúng `SW_BASE`.

**Sửa test M4-3:** spec hiện chỉ kiểm "không quá 2 lối bấm cho mỗi việc", không kiểm "có ít nhất 1 lối bấm", nên UX0-13/14/17 lọt qua. Thêm kiểm tra: mọi thao tác ở mục 3.2 có ≥ 1 lối bấm nhìn thấy ở 390, 768, 1180, 1366 trên cả hai giao diện.

Sau UX0: chạy lại `php tests\run_all_tests.php --strict --js`, toàn bộ spec `e2e/m*.spec.js` trên Chromium + WebKit **trên bản sao cách ly**, xác nhận `git status` của repo nguồn sạch, rồi mới gộp `fix/mobile-m6` vào `main`.

---

## 2. Ai dùng màn đọc, và họ cần gì trong lúc đang chơi/hát

Nguyên tắc: trong lúc đang chơi hoặc hát, người dùng chỉ có **một tay rảnh trong 1–2 giây**. Việc nào phải làm trong lúc đó thì phải 1 chạm. Việc chuẩn bị trước buổi thì được 2 chạm.

| Vai trò | Ai | Việc trong lúc chơi/hát (phải 1 chạm) | Việc chuẩn bị (≤ 2 chạm) |
|---|---|---|---|
| **Dẫn** (`leader`) | Trưởng ban nhạc, ca trưởng | Bài trước/tiếp trong chương trình; đổi tông cho cả ban; phát lệnh sân khấu (Điệp khúc, Lặp lại, Kết, Nhỏ dần); đếm vào bài; xem ai đang theo | Chọn chương trình; mở phòng dẫn (Live) và mã QR; đặt tempo/tông/bộ hợp âm cho từng bài; ghi chú cho thành viên |
| **Nhạc công** (`bannhac`) | Guitar, đàn phím, bass, trống | Lật trang/tự cuộn; zoom; theo người dẫn (bật/tắt); tempo hiển thị + nhịp đèn; đổi khổ | Capo; bộ hợp âm (HD/TLH/bộ riêng); cỡ và ký hiệu hợp âm; góc nhìn nhạc cụ (lens); ghi chú nhạc cụ; khoá zoom |
| **Ban hát** (`banhat`) | Ca đoàn, ca viên | Chuyển Bản nhạc ↔ Lời; chọn khổ; cỡ chữ lời; theo người dẫn | Nghe bè của mình (SATB, tắt/solo từng bè); tập chậm; lặp đoạn A–B; xem tông tập |
| **Người xem** (`viewer`, khách) | Thành viên, người ngoài | Lật trang; zoom; Lời ↔ Bản nhạc | Tìm bài; dịch tông; chia sẻ link; yêu thích |
| **Quản trị** (`admin`) | Người quản lý kho | — | Không làm trên màn đọc: đưa sang `/manager/`, `/editor/` |

**Đề xuất chính: công tắc "Tôi đang là: Ban hát · Nhạc công · Dẫn".**
- Đặt trong bảng công cụ nhanh, nhớ theo thiết bị (`SafeStorage`).
- Mặc định theo vai trò tài khoản: `leader` → Dẫn, `bannhac` → Nhạc công, `banhat` → Ban hát; khách và viewer → Ban hát.
- Chỉ đổi **bộ icon trong bảng công cụ nhanh** và chế độ xem mặc định. Không đổi quyền: mục cần quyền vẫn ẩn với người không có quyền.
- Mã đã có sẵn khái niệm này (`KeyService` và lens "Đang xem như Đàn phím"). Dùng lại, không tạo hệ mới.

---

## 3. Bộ thao tác chuẩn (icon + chip)

### 3.1 Một hệ icon

Hiện tại các icon đang trộn ba kiểu: SVG, emoji (🎸 🔤 📌 ✨ 🐢🚶🚴⚡) và ký tự (◀ ▶ ⛶). Metronome của Classic còn hiện thành tam giác cảnh báo.

- Dùng **một bộ SVG nét** duy nhất, nét 2px, khung 24px, `currentColor`, inline sprite trong `assets/icons/sprite.svg` dùng chung cho hai giao diện. Không thêm thư viện; vẽ hoặc chép từ bộ mã nguồn mở có giấy phép MIT/ISC (ví dụ Lucide) và ghi nguồn.
- Mỗi icon trên tablet/laptop có **nhãn chữ ngắn** bên dưới hoặc bên cạnh. Trên điện thoại, icon ở thanh nhanh có nhãn 10–11px; mọi icon có `aria-label`.
- Không dùng emoji làm nút.

### 3.2 Danh mục thao tác

Cột "Kiểu": **N** = nút, **C** = chip hiện giá trị và mở bảng chọn, **T** = công tắc.

| # | Thao tác | Kiểu | Icon gợi ý | Chạm vào thì | Vai trò dùng nhiều |
|---|---|:-:|---|---|---|
| 1 | Thư viện / tìm bài | N | `library` / `search` | Mở ngăn thư viện, con trỏ vào ô tìm | tất cả |
| 2 | Bài trước / tiếp | N | `chevron-left/right` | Trong chương trình: theo chương trình; ngoài: theo danh sách đang hiện | Dẫn, Nhạc công |
| 3 | **Tông** | C | chữ tông, ví dụ "A +2" | Bảng: −/+, lưới 12 tông (C…B, có ♭/♯), "Về tông gốc", dòng Capo 0–7 với tông bấm thực tế | tất cả |
| 4 | **Zoom** | C | "100%" | Bảng: −/+ (bước 10%), mức sẵn 50 · 75 · 90 · 100 · 125 · 150 · 200%, **Vừa bề rộng**, **Vừa trang**, **Khoá tỉ lệ** (khi khoá: chụm hai ngón và tự co theo màn hình đều không đổi zoom; chip có ổ khoá) | Nhạc công |
| 5 | **Bộ hợp âm** | C | "HD" | Bảng: HD, TLH, bộ công khai, bộ của tôi; ghi rõ "HD (chưa có · đang hiện TLH)" khi HD rỗng (Core Rule 1) | Nhạc công |
| 6 | Bản nhạc ↔ Lời | T | `music` / `text` | Công tắc 2 đoạn, đoạn sáng là chế độ đang xem (sửa lỗi nút điện thoại ghi chế độ đang hiện) | Ban hát |
| 7 | **Khổ** | C | "Khổ 1/4" | Bảng chọn khổ; vuốt ngang trên chip để đổi nhanh | Ban hát |
| 8 | **Tempo** | C | `metronome` "♩92" | Bảng: ±1/±5 BPM, TAP, Bật/Tắt nhịp (âm/đèn), **Đếm vào 1–2 ô nhịp**, mức sẵn | Dẫn, Nhạc công |
| 9 | Tự cuộn | T + C | `chevrons-down` | Chạm: chạy/dừng; mũi tên nhỏ: tốc độ 0,5×–4× hoặc theo tempo | Nhạc công, Ban hát |
| 10 | Lật trang | N | vùng chạm mép + `arrow-left/right` tuỳ chọn | Đã có vùng chạm mép; thêm tuỳ chọn hiện nút lật trang ở góc dưới (cho người không quen chạm mép) và bàn đạp Bluetooth (đã có `pedal-midi-engine`) | Nhạc công |
| 11 | Phát bè (SATB) | T + C | `play` / `pause` | Chạm: phát/dừng, **nút Dừng luôn hiện khi đang phát**; bảng: S · A · T · B tắt/solo, âm lượng, tốc độ 50–100% | Ban hát |
| 12 | Lặp đoạn A–B | N | `repeat` | Đánh dấu A rồi B trên bản nhạc; chạm lần nữa để bỏ | Ban hát |
| 13 | Theo người dẫn | T | `radio` | Bật/tắt theo; chip "Đang theo: <tên> ●" khi đang theo | Nhạc công, Ban hát |
| 14 | Dẫn ban (Live) | N | `cast` | Mở phòng, hiện QR, danh sách người đang theo | Dẫn (quyền leader) |
| 15 | Lệnh sân khấu | N | `megaphone` | Lưới 6 lệnh: Điệp khúc, Phiên khúc, Lặp lại, Kết, Nhỏ dần, Cao trào | Dẫn (đang dẫn phòng) |
| 16 | Capo | C | "Capo 2" | Như dòng Capo trong bảng Tông; chip riêng chỉ hiện ở vai Nhạc công | Nhạc công (guitar) |
| 17 | Cỡ / ký hiệu hợp âm | C | `type` | Bảng: cỡ S/M/L/XL; ký hiệu (C, Do, số La Mã) | Nhạc công |
| 18 | Nổi bật hợp âm | T | `highlighter` | Bật/tắt | Nhạc công |
| 19 | Góc nhìn nhạc cụ | C | `guitar` / `piano` / `drum` / `mic` | Chọn lens | Nhạc công |
| 20 | Ghi chú nhạc cụ | T | `sticky-note` | Hiện/ẩn ghi chú; soạn (theo quyền) | Nhạc công, Dẫn |
| 21 | Sân khấu (gig) | N | `maximize` | Vào chế độ sân khấu, ẩn mọi thứ trừ thanh nhanh tối giản | tất cả |
| 22 | Sáng / tối | T | `moon` / `sun` | Đổi giao diện màu | tất cả |
| 23 | Chia sẻ link | N | `share` | Web Share API trên điện thoại; trên máy tính chép link (giữ `song`, `t`, `set`, `v`) | tất cả |
| 24 | Yêu thích / ghim | T | `star` / `pin` | Bật/tắt | tất cả |
| 25 | In / xuất | N | `printer` | In bản nhạc, in lời và hợp âm, ChordPro (theo cờ) | Dẫn |
| 26 | Soạn hợp âm | N | `pencil` | Vào chế độ soạn (quyền `canEditChords`) | Dẫn, Nhạc công |
| 27 | Hướng dẫn / đổi giao diện / đăng nhập | N | `help`, `layout`, `log-in` | Cuối menu ⋯ | tất cả |

---

## 4. Bố cục mục tiêu

### 4.1 Điện thoại dọc (360–430px)

```
┌───────────────────────────────────────┐
│ ☰  Tên bài (tối đa 2 dòng)   ⓘ   ⋯   │  thanh trên, 52px
│    TC 001 · A (+2) · HD · Khổ 1/4      │  dòng phụ 1 dòng, chạm từng phần để mở bảng
├───────────────────────────────────────┤
│                                       │
│              BẢN NHẠC                 │  chạm mép trái/phải = lật trang
│                                       │
├───────────────────────────────────────┤
│ ‹   [A +2]  [100%]  [Nhạc|Lời]  ▦   › │  thanh nhanh 56px + safe-area
└───────────────────────────────────────┘
```

- Thanh nhanh có đúng 6 ô, mỗi ô ≥ 44×44: ‹, chip Tông, chip Zoom, công tắc Nhạc/Lời, ▦ (bảng công cụ nhanh), ›.
- Bộ hợp âm, Khổ và tempo nằm ở dòng phụ (chạm từng phần để mở bảng) và trong bảng công cụ.
- **▦ Bảng công cụ nhanh** là bottom sheet nửa màn, lưới 4 cột icon có chữ:
  - hàng đầu là công tắc vai trò (Ban hát / Nhạc công / Dẫn);
  - mỗi vai có tối đa 12 ô;
  - đáy bảng có "Tuỳ chỉnh" để người dùng ghim/bỏ ô (lưu theo thiết bị).

| Ban hát (mặc định) | Nhạc công | Dẫn |
|---|---|---|
| Khổ · Phát bè · Bè của tôi (S/A/T/B) · Lặp A–B · Tự cuộn · Cỡ chữ lời · Theo người dẫn · Bộ hợp âm · Tempo · Sân khấu · Sáng/tối · Chia sẻ | Bộ hợp âm · Capo · Tempo/nhịp · Tự cuộn · Khoá zoom · Cỡ/ký hiệu hợp âm · Nổi bật hợp âm · Góc nhìn nhạc cụ · Ghi chú nhạc cụ · Theo người dẫn · Sân khấu · Sáng/tối | Dẫn ban (Live) · Lệnh sân khấu · Tempo + đếm vào · Chương trình · Bộ hợp âm · Khổ · Ghi chú cho ban · Tự cuộn · Sân khấu · In · Chia sẻ · Sáng/tối |

### 4.2 Điện thoại ngang và tablet dọc (768–1024px)

Toolbar chỉ **một hàng**. Hiện tại là 2 hàng, chiếm 92px (24% chiều cao ở 844×390).

```
☰ Tên bài ⓘ │ ‹ › │ [A +2] [HD] [♩92] [Khổ 1/4] [Nhạc|Lời] [100%] │ ▦ ⋯
```

Khi thiếu chỗ, chip bỏ nhãn phụ trước; sau đó mới chuyển vào ▦ theo thứ tự ưu tiên ở mục 3.2 (số lớn chuyển trước).

### 4.3 Tablet ngang và laptop (≥ 1100px)

Một hàng như 4.2, thêm Tự cuộn, Sân khấu và Chia sẻ. Ở cỡ này **zoom và "Về tông gốc" phải luôn thấy**: hiện tại cả hai đang bị mất ở 1180px. Sidebar thư viện thu gọn được và nhớ trạng thái.

### 4.4 Hệ kích thước và hình thức

- Vùng chạm: tối thiểu 44×44 trên điện thoại và tablet; 36×36 trên laptop.
- Chip: cao 40px (điện thoại), 36px (tablet/laptop), bo 18px, chữ 14px đậm vừa, nền nhạt theo token màu. Chip đang khác mặc định (ví dụ tông +2, zoom khoá) có viền màu nhấn.
- Bảng chọn (popover trên tablet/laptop, bottom sheet trên điện thoại): tiêu đề, nút đóng 44×44, mục cao 48px, không cuộn ngang.
- Khoảng cách: lưới 4px; nhóm cách nhau 12px, có vạch chia mảnh.
- Màu và token chung cho hai giao diện qua biến CSS (`--ui-chip-bg`, `--ui-accent`, `--z-*` đã có). Classic giữ bảng màu riêng nhưng cùng kích thước và icon.
- Chế độ tối: select và bảng chọn dùng nền tối (hiện select trong menu tối vẫn nền xám sáng).

### 4.5 Sân khấu (gig)

Ẩn toolbar; chỉ còn thanh nhanh tối giản: ‹ · Tông · Zoom · Khổ · Cuộn · › và nút Thoát ở **góc trên phải, tách riêng**. Dải đoạn bài nằm dưới, không chồng. Chạm giữa màn hình để hiện/ẩn thanh.

### 4.6 Classic

Giữ phong cách riêng, dùng cùng hệ icon, chip và bảng chọn. Thanh Lớp 1: ☰ · ‹ › · Tông · Bộ hợp âm · Zoom · Lời · ▦ · ⋮. **Nút Dừng nhạc đệm hiện trên thanh khi đang phát.** Tên bài hiện trên toolbar (hiện tại không hiện ở 390). Bỏ khoảng trống lớn giữa "Lời" và ‹ › ở laptop.

---

## 5. Roadmap

Thứ tự: UX0 → UX1 → UX2 → UX3 → UX4 → UX5 → UX6 → UX7. Mỗi ticket kiểm trên **cả hai giao diện**, E2E Chromium (Pixel 7) + WebKit (iPhone 13, iPad Mini) trên bản sao cách ly, kèm ảnh trước/sau ở 390, 768, 1180. Bằng chứng lưu ở `docs/ux-evidence/`.

| Giai đoạn | Ticket | Việc | Nghiệm thu |
|---|---|---|---|
| **UX0** Sửa đợt mobile | UX0-1…9 | Mục 1 | Mục 1; sau đó gộp `fix/mobile-m6` |
| **UX1** Hệ icon và chip | UX1-1 | `assets/icons/sprite.svg` + helper `Icon.render(name)` dùng chung; danh sách icon mục 3.2 | Test: mọi tên icon trong mã có trong sprite |
| | UX1-2 | Component chip + bảng chọn dùng chung (`assets/js/core/QuickChip.js`, `QuickSheet.js`): popover trên tablet/laptop, bottom sheet trên điện thoại, đóng bằng Esc/vuốt xuống/chạm ngoài, focus trap | Test VM + E2E: mở/đóng, focus quay về chip |
| | UX1-3 | Thay emoji/ký tự làm nút bằng icon ở thanh nhanh và gig HUD (cả hai giao diện) | Grep: 0 emoji trong nhãn nút Lớp 1 |
| **UX2** Ba chip chính | UX2-1 | **Zoom**: −/+, mức sẵn 50–200%, Vừa bề rộng, Vừa trang, Khoá tỉ lệ; một nguồn giá trị (Store); khoá thì chụm hai ngón và tự co bị bỏ qua | E2E: chọn 150% → bản nhạc 150% và mọi nhãn ghi 150%; khoá rồi xoay máy → vẫn 150% |
| | UX2-2 | **Tông**: −/+, lưới 12 tông, Về gốc, dòng Capo với tông bấm thực tế; giới hạn theo `AppRules` (±12) | E2E: chọn A từ G → +2; Capo 2 → hợp âm hiển thị theo tông bấm; mở bài mới → 0 (Core Rule 2) |
| | UX2-3 | **Bộ hợp âm**: bảng chọn đủ danh sách, nhãn HD rỗng đúng Core Rule 1 | E2E điện thoại: chọn bộ không phải HD/TLH |
| **UX3** Bố cục | UX3-1 | Điện thoại: thanh trên + dòng phụ + thanh nhanh 6 ô (mục 4.1) | Đo 360/390/430: ô ≥ 44px; tên bài ≥ 2 dòng; không tràn |
| | UX3-2 | Điện thoại ngang + tablet: toolbar 1 hàng (mục 4.2), quy tắc co theo ưu tiên | Đo 844×390: toolbar ≤ 56px; 768: không cuộn ngang |
| | UX3-3 | Tablet ngang + laptop (mục 4.3): zoom và Về gốc luôn thấy | Đo 1180/1366: thấy chip Zoom và Tông |
| | UX3-4 | Menu ⋯ chỉ còn việc hiếm (mục 3.2 từ #22 trở đi), ≤ 12 mục, có nhóm | E2E 390: menu không cuộn quá 1 màn |
| **UX4** Bảng công cụ theo vai trò | UX4-1 | ▦ bottom sheet/popover, công tắc vai trò, bộ ô theo mục 4.1, mặc định theo vai trò tài khoản, nhớ theo thiết bị | E2E: banhat mặc định "Ban hát"; đổi sang "Nhạc công" → ô Capo hiện; reload vẫn nhớ |
| | UX4-2 | "Tuỳ chỉnh": ghim/bỏ ô, kéo đổi thứ tự (tối đa 12) | E2E: bỏ một ô → reload → vẫn bỏ |
| | UX4-3 | Ô cần quyền chỉ hiện khi có quyền (dùng một hàm quyền) | E2E khách/viewer/banhat/leader: đúng tập ô |
| **UX5** Tính năng còn thiếu cho từng vai | UX5-1 | Ban hát: chip Khổ trên Lớp 1; Phát bè với S/A/T/B tắt/solo, tốc độ 50–100%, **Dừng luôn hiện khi phát** | E2E: solo A → chỉ bè A phát; đổi bài → dừng phát |
| | UX5-2 | Ban hát: lặp đoạn A–B trên bản nhạc | E2E: A–B lặp đúng ô nhịp |
| | UX5-3 | Nhạc công: tempo chip có đếm vào, nhịp đèn; tuỳ chọn nút lật trang góc dưới | E2E: đếm vào 1 ô nhịp trước khi cuộn |
| | UX5-4 | Dẫn: lối 1 chạm vào Dẫn ban và Lệnh sân khấu khi đang dẫn phòng; chip "Đang theo: …" ở máy người theo | E2E hai trình duyệt: lệnh "Điệp khúc" hiện ở máy theo đúng 1 lần |
| | UX5-5 | Chia sẻ link bài (Web Share / chép link giữ `song`, `t`, `set`, `v`) | E2E: link mở đúng bài, tông, bộ, chế độ |
| **UX6** Classic cùng chuẩn | UX6-1 | Classic dùng sprite icon, chip Tông/Zoom/Bộ hợp âm và bảng chọn dùng chung | E2E Classic: như UX2 |
| | UX6-2 | Classic thanh Lớp 1 theo mục 4.6, có Dừng nhạc đệm khi phát, có tên bài ở 390 | Đo 390/768/1366 |
| | UX6-3 | Classic có ▦ bảng công cụ theo vai trò (dùng chung UX4) | E2E Classic: như UX4-1 |
| **UX7** Nghiệm thu | UX7-1 | Bảng đếm số chạm cho mọi thao tác ở mục 3.2 theo vai trò, trên 390/768/1180 | Thao tác "trong lúc chơi" ở mục 2 đều 1 chạm |
| | UX7-2 | Thử trên máy thật với 1 người mỗi vai (dẫn, nhạc công, ca viên) trong một buổi tập; ghi nhận xét | `docs/ux-evidence/UX7-field.md` |

---

## 6. Quyết định cần chủ dự án

| # | Câu hỏi | Đề xuất |
|---|---|---|
| Q-UX1 | Dùng công tắc vai trò "Ban hát / Nhạc công / Dẫn" để đổi bộ ô trong bảng công cụ? | Có; mặc định theo vai trò tài khoản, người dùng đổi được |
| Q-UX2 | Thanh nhanh điện thoại 6 ô gồm ‹ · Tông · Zoom · Nhạc/Lời · ▦ · › ? | Có. Nếu ban hát là đa số, cân nhắc thay Zoom bằng Khổ |
| Q-UX3 | Dùng bộ icon SVG mã nguồn mở (ví dụ Lucide, giấy phép ISC), chép vào sprite, không dùng CDN? | Có |
| Q-UX4 | Mức zoom sẵn: 50 · 75 · 90 · 100 · 125 · 150 · 200% đủ chưa? | Đủ; thêm Vừa bề rộng và Vừa trang |
| Q-UX5 | Cho người dùng "Tuỳ chỉnh" bảng công cụ (UX4-2)? | Có, lưu theo thiết bị |
| Q-UX6 | Lặp A–B và tốc độ phát bè (UX5-1, UX5-2) có cần trong đợt này không? | Có cho Ban hát; nếu cần rút gọn thì để sau UX6 |
| Q-UX7 | Xác nhận đã duyệt Q-M1…Q-M5 và bảng phân bổ M4-3 của đợt mobile (UX0-9) | Ghi vào `ROADMAP_MOBILE.md` mục 7 và `M4-3-allocation.md` |

---

## 7. Ngoài phạm vi

- Không gộp hai giao diện thành một, không đóng băng Classic.
- Không đổi 4 Core Rule; không đổi quyền backend.
- Không đưa framework, bundler, TypeScript, không nạp icon từ CDN.
- Trang `/manager/`, `/editor/`, `/live-band/`, `/learn/` không thuộc đợt này (trừ khi dùng chung component ở UX1).
