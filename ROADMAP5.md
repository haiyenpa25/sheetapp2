# SheetApp2 — ROADMAP 5: Trang THƯ VIỆN — Sheet cho mọi người đàn, Soạn hợp âm nhanh, Thanh công cụ hiện đại, Từ ngữ Tin Lành

> Ngày lập: 2026-09-29
> Phạm vi: **chỉ trang Thư viện** (`index.php`, ví dụ `http://localhost/sheetapp2/?song=thanh-ca-001`).
> Người đọc: chủ dự án (duyệt, quyết định) và **một** người/AI thực thi. Luật thực thi: `ROADMAP3.md` Phần 0 (vẫn áp dụng).
> Nguồn rà soát ngày 2026-09-29:
> - Playwright chụp 6 kích thước màn hình: laptop 1366, desktop 1440, iPad ngang/dọc, điện thoại 390 và 360.
> - Thử luồng **điền hợp âm** thật với 3 vai trò (banhat, hoaidinh, khách). Mọi lệnh ghi đều bị chặn, không lưu gì.
> - Rà toàn bộ chữ trên giao diện và dữ liệu nhãn trong DB (chỉ đọc).
> - Đối chiếu Hiến chương HTTLVN và mục lục **Thánh Ca** tại thanhca.httlvn.org.
>
> Mục đánh dấu ✅ là đã tự kiểm chứng trực tiếp trong code hoặc ảnh chụp.

## TRẠNG THÁI TRIỂN KHAI (người thực thi cập nhật sau mỗi ticket)

Nhánh làm việc: `feature/roadmap5`. `sync.bat`/`sync.sh` đã bị **tắt tạm thời** (có ghi chú cách bật lại ở đầu mỗi file) để tránh 2 tác nhân ghi đè nhau như đợt trước.

| Ticket | Trạng thái | Tóm tắt | Bằng chứng |
|---|:-:|---|---|
| R0-1 | ✅ Xong (2026-09-29) | `$myChordCode`/`$myUsername` chưa gán trong nhánh `save` → mọi người không phải admin bị 403 khi lưu hợp âm, kể cả chủ sở hữu HD thật. Đã gán 1 lần sau `Auth::requireBanhat()`. **Phát hiện thêm:** cảnh báo PHP "Undefined variable" chèn thẳng vào JSON response (rủi ro thật nếu production bật `display_errors`); và `ChordSetController` tự nuốt `HttpException` từ `Auth::require*()` thành lỗi 500 chung chung — đã thêm `catch (HttpException)` riêng | `tests/chord_edit_permission_and_flow_regression.php` 10/10 (hành vi thật, gọi thẳng controller, không chép lại logic phân quyền). Full suite 129/129, 2487 checks, 0 fail. Commit `cf50ec5` |
| R0-2 | ✅ Xong (2026-09-29) | Bấm C khi xem HD (không phải chủ sở hữu) hoặc TLH giờ hiện hộp thoại chọn "Sửa trên bản của tôi" (không đụng dữ liệu cũ) hay "Sao chép, ghi đè" (có `confirm()` xác nhận thêm); Hủy = 0 request ghi. Chủ sở hữu HD thật (chord_code khớp) vẫn vào thẳng chế độ sửa như cũ, không bị hỏi. | `e2e/library-r0-2-chord-clone-confirm.spec.js` 3/3 (chromium+webkit). Full suite 2486 checks, 0 fail thật (1 fail còn lại là môi trường, xác nhận giống hệt trên code gốc). Commit `1a4a79f` |
| R0-3 | ✅ Xong (2026-09-29) | Tab/→ trong popup gọi 2 hàm không tồn tại trên `ChordCanvas` (B4) → hợp âm mất trắng; bấm ra nốt khác đánh dấu "đã lưu" trước khi lưu (B5) → cũng mất. Cả 2 giờ dùng chung callback `onSave`/`onDelete` như Enter/nút Lưu. Phát hiện thêm & sửa luôn: rebuild sau lưu có thể đóng nhầm popup nốt kế tiếp vừa mở (race condition lộ ra khi Tab bắt đầu hoạt động thật) — Tab/advance giờ bỏ qua rebuild tự động đó. | `e2e/library-r0-3-tab-outside-save.spec.js` 2/2 (chromium+webkit, ổn định qua nhiều lần chạy lại). Commit `1a4a79f` |
| R0-4 | ✅ Xong (2026-09-29) | Undo/redo stack sống sót qua `loadSong`/`switchSet` → Ctrl+Z sau khi chuyển bài pop lại state bài cũ rồi lưu bằng `songId` của bài MỚI (ghi nhầm dữ liệu). Thêm `ChordCanvasEdit.resetUndo()`, gọi ở đầu `loadSong()` và `switchSet()`. | `e2e/library-r0-4-undo-stack-song-switch.spec.js` 1/1 (chromium+webkit). RED xác nhận bắt đúng lỗi (POST save songId=thanh-ca-002 mang hợp âm của bài 001). Full suite 2486 checks, 0 fail thật. Commit `59075c4` |
| R0-5 | ✅ Xong (2026-09-29) | `saveChord()` chỉ đảo ngược `semitones`, bỏ quên `capo` hoàn toàn (capo một mình còn không đảo ngược gì, do `if (semitones !== 0)` chặn). Đã đọc `capoLevel` từ Store và đảo đúng `effectiveShift = semitones - capo`, khớp công thức hiển thị trong `ChordCanvasTranspose.applyTranspose()`. | `tests/chord_save_capo_transpose_regression.php` 6/6 — nạp `transpose-engine.js` thật qua Node vm, round-trip đúng qua nhiều tổ hợp (semitones, capo). Full suite 2492 checks, 0 fail thật. Commit `2d0e442` |
| R0-6 | ✅ Xong (2026-09-29) | B11: bỏ `onchange` inline trùng với `addEventListener('change',...)` (2 request → 1). B12: "Tạo Bộ Hợp Âm Mới" trong dropdown gọi thẳng `setAddMode(true)`, không qua ModeManager → Esc không thoát được; đổi sang `ModeManager.setMode(EDIT_CHORDS)`. B17: `keyboard-handler.js` gọi lại `ModeManager.handleEscape` dù ModeManager đã tự đăng ký listener riêng → 1 lần Esc xử lý 2 lần; bỏ lời gọi trùng. Cập nhật 3 test cũ đang static-assert đúng đoạn code lỗi vừa bị xoá. | `e2e/library-r0-6-selector-dedup-and-escape.spec.js` 2/2 (chromium+webkit), RED xác nhận cả 3 lỗi. Full suite 2494 checks, 0 fail thật. Commit `a53a405` |
| R0-7 | ✅ Xong (2026-09-29) | Ở 1366-1650px (sidebar mở), `.main-content` hẹp hơn 1350px dù viewport rộng hơn breakpoint `@media 1300px` → `@container mainarea` ẩn các nút toolbar đúng, nhưng menu ⋮ dự phòng KHÔNG BAO GIỜ hiện được vì `#main-dropdown-menu` bị chuyển ra `document.body` (ngoài phạm vi container). Thêm `ResizeObserver` bật `body.toolbar-controls-compact` (không phụ thuộc vị trí DOM). Ngoài ra "Điền hợp âm" và "Gốc" hoàn toàn không có mục dự phòng nào — đã thêm. | `e2e/library-r0-7-toolbar-controls-reachable.spec.js` 5/5 (chromium+webkit) ở 1366/1440/1920/390px. RED xác nhận 4/5 test fail đúng như báo cáo. Full suite 2494 checks, 0 fail thật. Commit `56fffe0` |
| R0-8 | ✅ Xong (2026-09-29) | `.toolbar` có `overflow-x:auto` không điều kiện → theo CSS2.1 §11.1.1 clip cả `overflow-y` → popover `position:absolute` bên trong bị cắt mất ở mọi kích thước màn hình (kể cả điện thoại). Sửa bằng cách chuyển popover ra `document.body` khi mở (giống menu ⋮), định vị lại bằng `position:fixed`. | `e2e/library-r0-8-song-info-popover-overflow.spec.js` 3/3 (chromium+webkit) ở 1366px và iPad dọc 820px (nút ⓘ chủ động ẩn <680px từ ticket khác, không liên quan). RED xác nhận `elementFromPoint` trúng SVG bên dưới thay vì popover. Full suite 2494 checks, 0 fail thật. Commit `286b33f` |
| R0-9 | ✅ Xong (2026-09-29) | 3 lỗi độc lập: (1) `library-polish.css` nạp sau cùng có luật đặc trưng cao hơn (`0,2,0`) luôn thắng luật responsive `max-width:110px` (`0,1,0`) cho ô tên bài ở iPad dọc, khiến nút ⓘ và Band/Nhạc tràn đè lên nút Biểu Diễn; (2) dải 1201-1400px nhãn "🎹 Keyboard" đầy đủ chưa thu gọn, đè lên "Theo ca trưởng" ở đúng 1366px; (3) `StageLens._updateToolbarUI()` quên đồng bộ nhãn vai trò trong menu ⋮. | `e2e/library-r0-9-ipad-button-overlap.spec.js` 3/3 (chromium+webkit) ở 820 và 1366px, script kiểm tra hộp giao nhau đúng như đặc tả. RED xác nhận cả 3 lỗi. Full suite 2494 checks, 0 fail thật. Commit `9de2bbf` |
| R1-1 | ✅ Xong (2026-09-29) | Tạo sprite Lucide nội bộ `assets/icons/lucide.svg` (60+ symbol) & helper `icon($name, $class, $attrs)`. Thay thế toàn bộ emoji trong `includes/toolbar.php`, `sidebar.php`, `sheet_viewer.php`, `modals.php` và `assets/js/library-ui.js`. CSS icons chuẩn hoá `.icon` (18px mặc định, stroke currentColor). Khung trang thư viện đạt 0 emoji trần (ngoại lệ nốt ♩). | `tests/library_r11_lucide_icons_regression.php` 10/10 PASS. `e2e/library-r1-1-lucide-icons.spec.js` 2/2 PASS (Chromium + WebKit). Full suite 131/131 suites, 2505 checks, 0 fail. |
| R1-2 | ✅ Xong (2026-09-29) | Tái cấu trúc thanh công cụ laptop 48px với 9 nhóm cốt lõi: 1. Menu & Tên bài [G] ⓘ, 2. Dịch tông [− 0 + Gốc], 3. Bộ hợp âm (HD/TLH/+), 4. Tempo [♩ 100], 5. View switch [Bản nhạc \| Lời & Hợp âm], 6. Soạn hợp âm, 7. Biểu Diễn, 8. Chuyển bài [‹ ›], 9. Menu Công Cụ [⋯]. Nút điều khiển phụ chuyển vào `.toolbar-secondary-controls` & menu ⋯. Ghi đè CSS specificity đảm bảo 9 nhóm không bị ẩn ở 1366px. | `tests/library_r12_laptop_toolbar_regression.php` 6/6 PASS. `e2e/library-r1-2-laptop-toolbar.spec.js` 4/4 PASS (Chromium + WebKit). Full suite 132/132 suites, 2512 checks, 0 fail. |
| R1-3 | ✅ Xong (2026-09-29) | Bỏ hoàn toàn dải chip `#song-info-strip` (`display: none !important`), đưa thông tin chi tiết (tên, tông gốc, tông tập, nhịp, tempo, số ô nhịp, bộ hợp âm, số lần sử dụng) vào popover ⓘ (`#song-info-popover`). Đồng bộ tempo lên nút Tempo trên thanh công cụ (`#toolbar-tempo-val`). Bản nhạc bắt đầu ngay dưới thanh công cụ (y = 48px ≤ 100px). | `tests/library_r13_clean_sheet_start_regression.php` 6/6 PASS. `e2e/library-r1-3-clean-sheet-start.spec.js` 2/2 PASS (Chromium + WebKit). Full suite 133/133 suites, 2518 checks, 0 fail. |
| R1-4 | ✅ Xong (2026-09-29) | Dải phân đoạn `#section-jump-bar-container` hiển thị có điều kiện: ẩn khi xem bài thường (tối đa diện tích khuông nhạc), tự động hiện khi phát chương trình (in-setlist) hoặc ở chế độ Biểu Diễn (sheet-only-mode / performance) hoặc LiveSync. Chuẩn hóa nhãn tiếng Việt trên chip: Dạo đầu, Phiên khúc n, Điệp khúc, Kết (kèm tag trợ năng tương thích ngược). Thay toàn bộ icon emoji bằng sprite Lucide SVG (`#icon-music`, `book-open`, `zap`, `guitar`, `disc`, `check`). z-index: 9985 đảm bảo chip tương tác mượt mà trong chế độ Biểu Diễn. | `tests/library_r14_section_jump_bar_regression.php` 9/9 PASS. `e2e/library-r1-4-section-jump-bar.spec.js` 2/2 PASS (Chromium + WebKit). `e2e/library-l3-song-sections.spec.js` 4/4 PASS. `e2e/library-l6-song-sections.spec.js` 6/6 PASS. Full suite 134/134 suites, 2527 checks, 0 fail. |
| R1-5 | ✅ Xong (2026-09-29) | Bảng Công cụ (⋯) thống nhất trên mọi thiết bị theo mục 2.3: popover rộng 320px trên laptop, bottom sheet trên điện thoại (neo đáy, drag handle, mỗi dòng ≥ 44px). 5 nhóm chuẩn đồng nhất: Hiển thị, Nhạc, Ban nhạc, Soạn, Khác. Mọi mục có nhãn chữ + Lucide SVG icon, không bị ẩn lệch giữa các kích thước màn hình, không tràn ngang. Hỗ trợ phím Escape và chạm backdrop đóng mượt mà. | `tests/library_r15_tools_menu_regression.php` 17/17 PASS (behavioral=13). `e2e/library-r1-5-tools-menu.spec.js` 4/4 PASS (Chromium + WebKit). Full suite 135/135 suites, 2544 checks, 0 fail. |
| R1-6 | ✅ Xong (2026-09-29) | Chế độ Biểu Diễn 100% Sạch theo mục 2.5: ẩn hoàn toàn thanh điều hướng (`#app-shell-navbar`), thanh công cụ (`#toolbar`), dải chip (`#song-info-strip`), dải phân đoạn (`#section-jump-bar-container`), thanh ngón cái mobile (`.mobile-thumb-bar`) và nút thoát thô. Pixel nhạc bao phủ ≥ 97% màn hình (100% thực tế khi HUD mờ). Lớp điều khiển mờ duy nhất (`#gig-floating-hud`) thiết kế pill kính mờ (blur 20px), nhóm segmented cohesive, xóa bỏ hoàn toàn các ô xám trống. Nút khóa zoom dùng Lucide SVG thay emoji. Toast "Nhấn F/Esc để thoát" dời lên đỉnh (`top: 14px`) và chỉ hiện 1 lần duy nhất trong phiên qua `sessionStorage`. | `tests/library_r16_clean_performance_mode_regression.php` 14/14 PASS (behavioral=13). `e2e/library-r1-6-performance-mode.spec.js` 8/8 PASS (Chromium + WebKit). `e2e/library-l1-gig-mode.spec.js` 10/10 PASS. Full suite 136/136 suites, 2558 checks, 0 fail. |
| R1-7 | ✅ Xong (2026-09-29) | Sidebar mặc định đóng ở màn hình ≤1440px khi mở bài hát (?song=) hoặc song:loaded, hiển thị dạng drawer overlay. Diện tích nhạc trên laptop 1366px tăng từ ~53% lên ≥ 70% (thực tế 75.3%). Nút ☰ trên thanh công cụ cập nhật nhãn động chính xác theo trạng thái (kèm aria-expanded và aria-label: "Mở danh sách bài hát..." khi đóng, "Đóng danh sách bài hát..." khi mở). Drawer đóng mượt mà bằng phím Esc hoặc click overlay. Thanh công cụ z-index: 310 và overlay neo dưới toolbar không chặn tương tác người dùng. | `tests/library_r17_sidebar_default_closed_regression.php` 7/7 PASS. `e2e/library-r1-7-sidebar-default-closed.spec.js` 6/6 PASS (Chromium + WebKit). `e2e/library-l1-toolbar-and-ipad-area.spec.js` 6/6 PASS. `e2e/library-r0-7-toolbar-controls-reachable.spec.js` 10/10 PASS. Full suite 137/137 suites, 2565 checks, 0 fail. |
| R1-8 | ✅ Xong (2026-09-29) | Điểm đăng nhập duy nhất tập trung trên User Avatar / Widget thanh điều hướng (`#shell-user-widget`) và đầu sidebar drawer. Loại bỏ hoàn toàn các nút đăng nhập trùng lặp: ẩn `#btn-toolbar-auth` khỏi thanh công cụ 48px và xóa `#btn-menu-auth` khỏi menu ⋯. Bỏ triệt để các hành động trùng lặp: (1) "Theo người hướng dẫn" khởi động duy nhất trong menu ⋯ (`#btn-menu-follow-leader`), `#btn-follow-leader` trên toolbar mặc định ẩn và chỉ hiện thành chip khi đang theo; (2) "Xem Lời & Hợp âm" dùng công tắc 2 chế độ `[Bản nhạc | Lời & Hợp âm]` trên toolbar, mục `#btn-lyric-view` trong menu ⋯ chuyển thành in/xuất `chord-sheet.php`; (3) In gom gọn trong menu ⋯; (4) Chỉ 1 nút ☰ duy nhất trên toolbar (`#btn-open-sidebar`), nút trong sidebar đổi thành icon ✕ "Đóng danh sách bài hát"; (5) Ẩn hoàn toàn cụm link phụ trùng lặp Học Đàn / Live Band (`.sidebar-footer-tools`) ở chân sidebar. | `tests/library_r18_login_single_location_regression.php` 16/16 PASS. `e2e/library-r1-8-login-single-location.spec.js` 8/8 PASS (Chromium + WebKit). `e2e/modal-a11y.spec.js` 3/3 PASS. Full suite 138/138 suites, 2581 checks, 0 fail. |
| R1-9 | ✅ Xong (2026-09-29) | Thang thiết kế mục 2.7: nút desktop 32px (`--lp-h`), bo góc 8px (`--lp-radius`), chữ nhãn 13px (`--lp-font`), chữ phụ tối thiểu 12px (`--lp-font-sm`). Rà soát và nâng cấp toàn bộ chữ phụ sub-12px (10px, 10.5px, 11px, 11.5px) lên >= 12px. Chip trung tính và đồng bộ Dark Mode triệt để: không còn chip trắng trong dark-mode (`body.dark-mode .section-chip`, `.si-chip`, `.song-key-badge`, `.filter-badge`, `.quick-jump-btn`), tương phản văn bản >= 4.5:1. Điều chỉnh skip-link mượt mà trên WebKit/Safari. | `tests/library_r19_design_tokens_and_a11y_regression.php` 10/10 PASS. `e2e/library-r1-9-design-tokens-a11y.spec.js` 10/10 PASS (Chromium + WebKit). `e2e/library-l1-a11y-contrast.spec.js` 8/8 PASS. Full suite 139/139 suites, 2591 checks, 0 fail. |
| R2-1 | ✅ Xong (2026-09-29) | Con trỏ nốt theo thứ tự `mapNotes`: viền nốt đang chọn (`.cc-note-cursor`) viền sáng rõ nét và hiệu ứng pulse, hiện hợp âm gợi ý từ TLH / XML kèm phím tắt `T` để nhận nhanh, tự động cuộn màn hình (`_scrollToNote`) đảm bảo nốt luôn trong tầm nhìn. Điều hướng bàn phím mượt mà: phím Enter lưu hợp âm và tiến 1 nốt (`doSaveNext`), phím Shift+Tab / ArrowLeft lùi lại 1 nốt (`doSavePrev`), Tab / ArrowRight tiến nốt. | `tests/library_r21_note_cursor_and_navigation_regression.php` 13/13 PASS. `e2e/library-r2-1-note-cursor.spec.js` 6/6 PASS (Chromium + WebKit). `e2e/library-r0-3-tab-outside-save.spec.js` 4/4 PASS. `e2e/library-r0-2-chord-clone-confirm.spec.js` 6/6 PASS. Full suite 140/140 suites, 2603 checks, 0 fail. |
| R2-2 | ✅ Xong (2026-09-29) | Bảng hợp âm theo tông đang hiển thị & Sửa triệt để lỗi B15: 7 hợp âm thuận (I..vii°), hợp âm 7 (V7, maj7), hợp âm đảo (nốt bass slash qua `/ + số`), sus, gần đây và gợi ý TLH. Tông A hiển thị chính xác `A Bm C#m D E F#m G#dim | E7 A/C# Dsus4 D/F#`. Khi dịch tông (+2), bảng hợp âm tự động thích ứng với tông đang hiển thị thay vì giữ tông gốc (sửa B15). Phím tắt trực quan: 1–7 chọn hợp âm thuận, Shift+1–7 chọn hợp âm 7, `/ + số` tự động điền nốt bass (ví dụ A + /3 = A/C#, D + /6 = D/F#), phím `.` lặp lại hợp âm trước đó, phím `T` nhận gợi ý TLH. Chạm chip tự động đặt hợp âm và nhảy sang nốt kế tiếp. | `tests/library_r22_chord_palette_diatonic_regression.php` 14/14 PASS. `e2e/library-r2-2-chord-palette.spec.js` 8/8 PASS (Chromium + WebKit). Full suite 141/141 suites, 2617 checks, 0 fail. |
| R3-1 | ✅ Xong (2026-09-29) | Thay toàn bộ 35 chỗ trong Phụ lục A (giao diện, thông báo, email, hướng dẫn) sang từ ngữ Tin Lành. Bỏ triệt để các mùa lễ và danh mục Công giáo. Grep barrier chặn tái phát 0 lần xuất hiện 8 từ cấm trong 28 file người dùng thấy. | `tests/library_r31_vocabulary_audit_regression.php` 28/28 PASS (Behavioral: 14, Static: 14). Full suite 150/150 suites, 2765 checks, 0 fail. |
| R3-2 | ✅ Xong (2026-09-29) | Đổi nhãn giao diện: "Mùa lễ" → "Dịp lễ", "Setlists" → "Chương trình" (hỗ trợ gõ 'setlist' để chuyển tab), "Biểu diễn" → "Toàn Màn Hình" (Q1), "STT HTTLVN" → "Số bài Thánh Ca", "Nhật ký biểu diễn" → "Nhật ký phục vụ", "Nhắc Band" → "Nhắc ban nhạc", bỏ thô "(Live Sync)" và "(/manager/)". Chuẩn hóa chính tả "Xoá" → "Xóa". | `tests/library_r32_labels_and_fullscreen_regression.php` 42/42 PASS. Full suite 151/151 suites, 2807 checks, 0 fail. |
| R3-3 | ✅ Xong (2026-09-29) | Bộ nhãn Dịp lễ mới (Phụ lục B.1, 17 dịp lễ) và Chủ đề theo mục lục Thánh Ca HTTLVN (Phụ lục B.2, 16 chủ đề). Đồng bộ 100% danh sách tiếng Việt giữa getTaxonomy() và bộ lọc sidebar (#season-filter, #theme-filter). | `tests/library_r33_unified_taxonomy_regression.php` 43/43 PASS. Full suite 152/152 suites, 2850 checks, 0 fail. |
| R3-4 | ✅ Xong (2026-09-29) | Migration nhãn bài hát 1–903 theo mục lục chuẩn Thánh Ca HTTLVN: điền 100% (903/903) chủ đề, 203 bài có dịp lễ Tin Lành, 700 bài quanh năm (NULL), xoá sạch 100% "Thường Niên" (0 bài). Hỗ trợ --dry-run, --backup, --seed an toàn transaction. | `tools/manage_song_labels.php --seed`. `integrity_check = ok`. `tests/library_r34_labels_migration_regression.php` 93/93 PASS. Full suite 153/153 suites, 2943 checks, 0 fail. |
| R3-5 | ✅ Xong (2026-09-29) | Chuẩn hoá phân đoạn bài: Dạo đầu / Phiên khúc 1..n / Điệp khúc / Kết (dữ liệu song_sections + giao diện). 0 nhãn "Intro/Outro/Lời/Đoạn" còn lại trong CSDL (289 phân đoạn được cập nhật qua tools/seed_song_sections.php --standardize) và modal biên tập thuần Việt. | `tests/library_r35_section_standardization_regression.php` 36/36 PASS. Full suite 154/154 suites, 2979 checks, 0 fail. |
| R3-6 | ✅ Xong (2026-09-29) | Vai trò trong chương trình: thêm "Mục sư / Truyền đạo", "Hướng dẫn chương trình", "Đọc Kinh Thánh", "Người hướng dẫn / Hát chính" (Q5), "Hát dẫn" (thay thế "Lĩnh xướng"). Cập nhật tiêu đề modal "Phân Công Chương Trình Thờ Phượng", nhãn thông báo phân công và bản in service-booklet. | `tests/library_r36_program_roles_regression.php` 23/23 PASS. Full suite 155/155 suites, 3002 checks, 0 fail. |
| R3-7 | ✅ Xong (2026-09-29) | Tìm kiếm khớp cả "Jêsus", "Jê-sus" và "Giê-xu" (không sửa dữ liệu bài hát). Mở rộng bí danh đa chiều (FTS5 BM25, tiêu đề relevance_tier 1–3, lyric_snippet highlight <mark>, Fallback LIKE search, Manager search, và Frontend LibraryUI). | `tests/library_r37_search_alias_matching_regression.php` 25/25 PASS. Test HTTP `q=gie+xu` trả về 50 bài (Rank 1: JÊSUS ĐẸP THAY). Full suite 156/156 suites, 3027 checks, 0 fail. |

**Phát hiện mới, chưa có ticket riêng (ghi lại để không quên):**
- **F-SYS-1:** 17/17 controller trong `api/controllers/` dùng chung khuôn `try { ... } catch (Throwable $e) { Response::serverError(...) }`, nên `HttpException` (401/403 từ `Auth::require*()`) bị nuốt thành 500 ở TẤT CẢ các route, không riêng ChordSet. Đã sửa cho `ChordSetController` (nằm trong phạm vi R0-1). 16 file còn lại (`ManagerController`, `SongController`, `ReviewController`, `SetlistController`, `PracticeController`, `NotificationPreferenceController`, `ExportController`, `PracticeAssignmentController`, `AuthController`, `UserController`, `LiveSyncController`, `LearningController`, `CategoryController`, `ArrangementController`, `ImportController`, `OmrController`) vẫn còn lỗi này — **cần một ticket riêng ngoài phạm vi trang Thư viện** (đề xuất: thêm `catch (HttpException $e) { Response::error($e->getMessage(), $e->getStatusCode()); }` vào một trait/base class dùng chung thay vì sửa tay 16 file).

---

## 0. TÓM TẮT

### Mục tiêu của đợt này
1. **Sheet cho mọi người đàn:** nhạc chiếm tối đa màn hình; mỗi nhạc công (guitar, phím, bass, trống, hát) có góc nhìn phù hợp; ở chế độ Biểu diễn thì **100% là nhạc**.
2. **Soạn hợp âm ("Điền hợp âm") nhanh và an toàn:** lưu được thật, không bao giờ ghi đè nhầm; khoảng 1 chạm cho mỗi hợp âm.
3. **Thanh công cụ hiện đại:** một thanh duy nhất, một bộ icon, ít màu; tính năng phụ gom vào bảng "Công cụ" dễ tìm.
4. **Dùng tốt trên laptop và điện thoại:** không có tính năng "bị giấu mất"; không tốn diện tích cho thứ ít dùng.
5. **Từ ngữ Tin Lành:** Thánh Ca, Chương trình thờ phượng, Lễ Giáng Sinh, Lễ Thương Khó, Lễ Phục Sinh…; **bỏ "phụng vụ"** và mọi từ Công giáo.

### Hiện trạng: 5 vấn đề lớn nhất
| # | Vấn đề | Mức |
|---|---|:-:|
| 1 | ✅ **Không ai ngoài admin lưu được hợp âm.** Trong nhánh `save`, biến `$myChordCode` và `$myUsername` chưa được gán giá trị, nên server luôn trả 403. Người dùng vẫn thấy hợp âm hiện trên màn hình, nhưng reload là mất (`ChordSetController.php:76,107,109`) | 🔴 |
| 2 | **Bấm C để điền hợp âm thì âm thầm ghi đè bộ hợp âm cá nhân**: code tự sao chép HD hoặc TLH vào bộ của bạn, không hỏi (`chord-canvas.js:195-212`). Admin đang ở TLH mà bấm C thì **HD bị ghi đè bằng TLH** | 🔴 |
| 3 | **Laptop 1366–1650px** (có sidebar): Zoom, Tự cuộn, Metronome, Capo, "Gốc", Cỡ hợp âm, Ký hiệu, **Điền hợp âm** đều **không có đường bấm chuột nào**. Thanh công cụ ẩn chúng đi, còn bản dự phòng trong menu ⋮ không bao giờ hiện (`layout.css:1677,1844`) | 🔴 |
| 4 | Laptop có **4 thanh xếp chồng** (điều hướng 44 + công cụ 46 + dải chip 29 + dải phân đoạn 34 px), khoảng 25 chip màu trước khi tới khuông đầu tiên. Nhạc chỉ chiếm khoảng 53% diện tích. Chế độ Biểu diễn **vẫn giữ** dải chip và dải phân đoạn; trên điện thoại còn giữ cả thanh dưới | 🟠 |
| 5 | Từ ngữ: "phụng vụ" ở khoảng 15 chỗ người dùng nhìn thấy; bộ lọc có **Mùa Vọng, Mùa Chay, Mùa Thường Niên, Thánh Thể, Đức Mẹ Maria…**. Nhãn Dịp lễ/Chủ đề trong DB bị **gán hàng loạt theo khoảng số bài và gán sai** (ví dụ bài 76–87 bị gắn "Năm Mới", bài 360 "Hãy Đi Nói" bị gắn "Bình An") | 🟠 |

### ⚠ Điều kiện tiên quyết: một đầu mối duy nhất
Đợt trước có **2 tác nhân cùng sửa giao diện** và tự commit bằng `sync.bat`, dẫn tới ghi đè lẫn nhau và khoảng 30 test E2E hỏng. Trước khi bắt đầu ROADMAP5:
- Chỉ **một** người/AI thực thi; tắt `sync.bat`/`sync.sh` tự push.
- Làm trên nhánh `feature/roadmap5`; chủ dự án duyệt rồi mới merge.
- Mỗi ticket có ảnh chụp **trước/sau** (laptop 1366 + điện thoại 390) và chạy toàn bộ E2E.

---

## 1. KẾT QUẢ RÀ SOÁT CHI TIẾT

### 1.1 Điểm hiện tại (thang 10)

| Hạng mục | Điểm | Ghi chú |
|---|:-:|---|
| Sheet cho mọi người đàn | 6 | Hợp âm dịch đúng, có chế độ Lời & Hợp âm, chọn khổ, chế độ tối tốt; nhưng tốn diện tích và chế độ Biểu diễn chưa sạch |
| Điền hợp âm | **2** | Không lưu được (trừ admin), ghi đè âm thầm, Tab/click làm mất hợp âm, Undo ghi sang bài khác |
| Thanh công cụ | 4 | 3 hệ icon trộn lẫn (SVG, emoji, ký tự Unicode); 4 cỡ nút trong cùng một thanh; nhiều nút trùng lặp; tính năng bị giấu |
| Laptop | 4 | Nhiều điều khiển không bấm được; popover ⓘ mở ra nhưng vô hình |
| Điện thoại | 6 | Thanh dưới tốt; nhưng mở ở chế độ Band mà không báo; menu ⋮ dài 836px; điền hợp âm gần như không dùng được |
| Tiết kiệm diện tích | 4 | Chữ nhạc chỉ chiếm 53–78% |
| Từ ngữ Tin Lành | 5 | Không có "Thánh Kinh" hay "Tin Mừng"; nhưng "phụng vụ" và các mùa lễ Công giáo còn nhiều |
| **Tổng** | **≈4.5** | |

### 1.2 Lỗi điền hợp âm (kết quả thử thật, không lưu gì)

| ID | Lỗi | Vị trí |
|---|---|---|
| **B1** ✅ | Lưu bị 403 với mọi người không phải admin, kể cả **Hoài Dinh với bộ HD**, vì biến chưa được gán | `api/controllers/ChordSetController.php:76,107,109` (chỉ được gán ở dòng 141 và 203) |
| **B2** | Bấm C khi đang ở HD/TLH thì **tự sao chép và ghi đè** bộ cá nhân (BH…), không hỏi. Hàm `showCloneConfirmModal` có sẵn nhưng không được gọi | `chord-canvas.js:195-212`, `chord-canvas-ui.js:445` |
| **B3** | Admin/leader không có mã hợp âm, đang ở TLH mà bấm C thì **ghi đè HD bằng TLH**, không qua duyệt | `chord-canvas.js:196-200` |
| **B4** | **Tab / →** (cách nhập nhanh chính) làm **mất hợp âm vừa gõ**, vì gọi hàm không tồn tại | `chord-canvas-ui.js:340,342` |
| **B5** | Bấm sang nốt khác thì hợp âm đang gõ bị bỏ, không tự lưu | `chord-canvas-ui.js:298-306, 356-363` |
| **B6** | **Undo ghi sang bài khác**: sửa bài 001, chuyển sang 002, bấm Ctrl+Z thì dữ liệu của 001 bị lưu vào 002 | `chord-canvas-edit.js:10` (stack không được xoá khi đổi bài) |
| **B7** | Đang bật capo mà điền hợp âm thì lưu lệch đúng số ngăn capo | `chord-canvas-edit.js:110-114` so với `chord-canvas-transpose.js:78` |
| B8 | Ngay sau khi sao chép, màn hình hiện hợp âm HD trong khi dropdown đang chọn BH, còn ✎ lại đặt theo TLH. Lưu hợp âm đầu tiên thì mọi hợp âm khác biến mất | `chord-canvas.js:305-308, 394-403`, `song-loader.js:281` |
| B9 | Nút ✎ trôi lên dòng tác giả hoặc xuống dưới khoá Fa, vì bộ chọn `g.vf-chordsymbol` không tồn tại trong OSMD 1.8 | `chord-canvas-dots.js` (`buildChordTextPositions`) |
| B10 | Dropdown bộ hợp âm trống sau khi sao chép; chip đếm vẫn hiện "Chưa có" sau khi đã lưu | `chord-canvas.js` (`_updateSetUI`, `_refreshSetDropdown`) |
| B11 | Đổi bộ hợp âm chạy 2 lần (có cả `onchange` inline lẫn `addEventListener`) | `toolbar.php:89`, `chord-canvas.js:551` |
| B12 | Mở điền hợp âm từ menu ⋮ thì bỏ qua ModeManager, nên Esc không thoát được và trạng thái lệch | `toolbar.php:271` |
| B13 | Điện thoại: không có nút điền hợp âm hiển thị; mặc định lại ở chế độ Lời nên không có chấm nào để bấm, và không có hướng dẫn | toolbar |
| B14 | Điện thoại: bảng nhập hợp âm chỉ cao 143px, bị thanh dưới và FAB che; nút "✓ Lưu" chỉ 45×21px | `chord-canvas-ui.js` |
| B15 | Đang dịch +2 mà bảng gợi ý vẫn đưa hợp âm của **tông gốc** | `_detectKey()` |
| B16 | Chấm "+" chỉ 14px, vùng chạm 44px chồng lên nhau, nên bấm trúng nhầm nốt | `chord-canvas-ui.js:22` |
| B17–B19 | Escape bị xử lý 2 lần; khách đã đăng nhập vẫn thấy ➕ rồi bị hỏi đăng nhập; bộ fork của chính mình bị ghi "[Chỉ xem]" | ModeManager, `chord-canvas.js:532-557` |

**Tốc độ hiện tại:** một bài khoảng 24 hợp âm cần khoảng 110 thao tác trên laptop (khoảng 75 chạm trên điện thoại), kèm 24 lần gửi cả bộ lên server và 24 thông báo nổi. Các app chuyên nghiệp chỉ cần khoảng 1–1.3 thao tác cho mỗi hợp âm.

**Điểm tốt nên giữ:** hợp âm được gắn theo nốt, nên **khổ 1 điền xong là khổ 2–4 có luôn** (thánh ca dùng chung nhạc). Khi đang dịch giọng, hợp âm vẫn được lưu theo tông gốc (✔ đã kiểm).

### 1.3 Giao diện và diện tích

**Diện tích nhạc (mặc định):**

| Màn hình | Phần trên (px) | Nhạc |
|---|---|---|
| Laptop 1366×768 | 44 + 46 + 29 + 34 + 49 | ~53% diện tích (sidebar 256px luôn mở) |
| iPad ngang 1180 | 46 + 29 + 34 | 85% |
| Điện thoại 390 | 44 + 36 + 34, thêm 63 ở dưới | 77% |
| Biểu diễn, laptop | vẫn còn dải chip + dải phân đoạn (63px) | 92% |
| Biểu diễn, điện thoại | vẫn còn dải chip + dải phân đoạn + thanh dưới | ~84% |

**Trùng lặp:**
- Dịch giọng: 5 chỗ.
- Zoom: 3 chỗ.
- Đăng nhập: **4 chỗ** (thanh điều hướng, "Khách" ở sidebar, nút ẩn trên thanh công cụ, menu).
- Theo ca trưởng: 2 chỗ.
- Xem Lời & Hợp âm: 2 chỗ.
- In: 2 chỗ.
- Nút ☰: 2 chỗ.
- Học Đàn / Live Band: 2 chỗ.

**Lỗi hiển thị:**
- Nút vai trò đè lên nút "Theo ca trưởng", nhãn bị cắt còn "Key".
- iPad dọc: nút Nhạc/Band **bị che dưới nút ⚡**.
- Popover ⓘ mở ra nhưng **vô hình**, vì bị cắt bởi `overflow`.
- Thanh công cụ ghi "Keyboard" trong khi menu ghi "Guitar".
- Thanh HUD ở chế độ Biểu diễn hiện những ô xám trống.
- Thông báo lúc vào chế độ Biểu diễn đè lên HUD.
- Menu hiện đường dẫn thô "(/manager/)".
- Nút "mở sidebar" trên laptop thực ra lại **đóng** sidebar.

**Thiết kế:**
- 3 hệ icon trộn lẫn. Emoji hiển thị khác nhau giữa Windows, iOS và Android, là điểm làm giao diện trông "cũ" nhất.
- Mỗi chip một màu.
- Chữ trên dải chip chỉ 11px.
- Menu điện thoại trộn 2 kiểu chữ.
- Nhãn chỗ Viết Hoa Từng Chữ, chỗ không.

### 1.4 Từ ngữ (trích từ báo cáo rà soát; danh sách đầy đủ ở Phụ lục A)
- **Công giáo, phải bỏ:** phụng vụ, Mùa Vọng, Mùa Chay, Mùa Thường Niên, Lễ Trọng & Kính, Ca Nhập Lễ, Đáp Ca/Tung Hô, Dâng Lễ/Tiến Lễ, Hiệp Lễ/Thánh Thể, Tạ Lễ/Kết Lễ, Đức Mẹ Maria, Thánh Tâm Chúa, thánh lễ, Lĩnh xướng.
- **Lạc giọng thờ phượng:** "Biểu diễn", "Nhật ký biểu diễn", "Tông biểu diễn", "Worship", "Booklet".
- **Dữ liệu nhãn sai:**
  - 243 bài mang nhãn "Thường Niên" và 403 bài không có nhãn.
  - Các khoảng 76–87, 341–500 bị gán sai chủ đề.
  - Danh mục có 4 mục nhưng mỗi mục 0 bài.
  - Phân đoạn bài dùng lẫn "Intro/Outro/Kết/Lời/Đoạn".

---

## 2. THIẾT KẾ ĐÍCH

### 2.1 Ba chế độ của trang
```text
  XEM (mặc định) ──── ⤢ Biểu diễn ────► BIỂU DIỄN (100% nhạc)
      │                                   chạm giữa = hiện lớp điều khiển mờ
      └──── ✎ Soạn hợp âm ────► SOẠN (con trỏ nốt + bảng hợp âm)
                                  Xong ✓ → quay về XEM
```
Mọi chế độ đều đi qua **ModeManager** (một nguồn sự thật duy nhất; phím C/F/Esc gắn vào đây).

### 2.2 Thanh công cụ laptop / desktop (một thanh 48px)
```text
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ ☰  HỠI THÁNH VƯƠNG, KÍP NGỰ LAI  [G]  ⓘ │ − Tông G +  │ 🎸 HD ▾ │ ♩92 │ [Bản nhạc|Lời & HÂ] │ ✎ │ ⤢ Biểu diễn │ ‹ › │ ⋯ │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```
- **Luôn hiện**, gồm 9 nhóm:
  - Tên bài + tông (bấm để mở danh sách bài); ⓘ mở thông tin bài.
  - Dịch giọng: − Tông +, bấm vào chữ tông để về tông gốc.
  - Bộ hợp âm.
  - Tempo: bấm để mở bảng Tempo, có sẵn metronome.
  - Công tắc chọn 2 chế độ **Bản nhạc | Lời & Hợp âm**, thay cho nút "▶ Band" dễ nhầm là "Phát".
  - ✎ Soạn hợp âm (chỉ hiện khi có quyền).
  - **⤢ Biểu diễn**, có chữ.
  - ‹ › bài trước/sau.
  - ⋯ Công cụ.
- **Dải chip thông tin** bị bỏ: nội dung chuyển vào popover ⓘ. **Dải phân đoạn** chỉ hiện khi đang phát chương trình, hoặc trong chế độ Biểu diễn.
- **Sidebar** mặc định **đóng** ở màn hình ≤1440px khi đang mở một bài (dạng overlay). Nhờ vậy nhạc trên laptop tăng từ khoảng 53% lên khoảng 75%.
- **Đăng nhập** chỉ còn 1 chỗ: avatar trên thanh điều hướng hoặc đầu sidebar.

### 2.3 Bảng "Công cụ" (⋯): cùng một bảng trên mọi thiết bị
Laptop hiện dạng popover rộng 320px; điện thoại hiện dạng bottom sheet cao gần hết màn hình, mỗi dòng 48px.

| Nhóm | Mục |
|---|---|
| **Hiển thị** | Thu phóng (− % + 🔒) · Tối giản bản nhạc · Khổ hát · Cỡ hợp âm · Ký hiệu hợp âm (C / I–V / 1–5) · Góc nhìn nhạc cụ · Sáng/Tối |
| **Nhạc** | Phát bè + âm lượng · Tự cuộn + tốc độ · Giữ nhịp (metronome) · Capo |
| **Ban nhạc** | Theo người hướng dẫn (khi đang theo thì hiện thành chip xanh trên thanh công cụ) |
| **Soạn** | Soạn hợp âm · Bộ hợp âm mới · Phiên bản · Sửa bản nhạc (SATB) |
| **Khác** | In lời & hợp âm · In bản nhạc · Quản lý kho nhạc · Hướng dẫn |

Mọi mục đều có **nhãn chữ + icon cùng một bộ**. Không còn mục nào chỉ hiện ở một kích thước màn hình mà mất ở kích thước khác.

### 2.4 Điện thoại
```text
┌─────────────────────────────────────┐
│ ☰  Hỡi Thánh Vương, Kíp…  G   ⓘ  ⋯ │ 44px
├─────────────────────────────────────┤
│                                     │
│          nhạc / lời & hợp âm        │ ≥ 87%
│                                     │
├─────────────────────────────────────┤
│  − G +  │  HD ▾  │ Nhạc|Lời │  ⤢    │ 56px
└─────────────────────────────────────┘
```
- Thanh dưới là công tắc **Nhạc | Lời** có trạng thái rõ ràng: nhìn là biết đang xem gì.
- Không còn dải chip hay dải phân đoạn ở chế độ mặc định. ⓘ mở bottom sheet gồm thông tin bài, các phân đoạn (chạm để nhảy tới), In và số lần sử dụng.

### 2.5 Chế độ Biểu diễn (Toàn màn hình)
- **Ẩn hết**: thanh điều hướng, thanh công cụ, dải chip, dải phân đoạn, thanh dưới của điện thoại. Giữ màn hình luôn sáng (Wake Lock) và dùng Fullscreen API.
- **Chạm giữa màn hình** thì hiện một lớp điều khiển mờ duy nhất: `‹ Bài │ − Tông + │ Khổ n/N │ Cuộn │ − Zoom + │ Thoát ✕`. Lớp này tự ẩn sau 3 giây.
- **Chạm cạnh trái/phải** để lật trang. Bàn đạp cũng lật trang.
- Thông báo "Nhấn F/Esc để thoát" chỉ hiện **một lần**, dạng nhỏ ở trên, không đè lên lớp điều khiển.

### 2.6 Chế độ Soạn hợp âm mới
**Nguyên tắc:**
1. Dùng **con trỏ nốt**, không dùng popup.
2. Chạm một hợp âm trong bảng thì **đặt vào nốt và tự nhảy sang nốt kế tiếp**.
3. **Lưu gộp** sau khoảng 1.5 giây, kèm checksum để phát hiện xung đột. Một chip trạng thái: "Đang lưu… / Đã lưu ✓ / Ngoại tuyến (3 chờ)".
4. **Hỏi trước khi sao chép**:

   > Bạn đang xem **HD** (chỉ xem).
   > [**Sửa trên bản của tôi (BH)** — giữ bản BH đang có] · [Sao chép HD sang BH (ghi đè, cần xác nhận)] · [**Đề xuất sửa HD** (gửi ca trưởng duyệt)]

**Laptop:**
```text
┌ ✎ Soạn hợp âm · Bộ: ⭐ BH (của tôi) ▾ · ● 18/24 nốt · Đã lưu ✓ 2 giây trước · [Xong ✓] ┐
│   G          Am         [▮ C ▮]  ← con trỏ (nốt được viền + hợp âm mờ gợi ý)          │
├────────────────────── Bảng hợp âm — tông A (đang +2) ──────────────────────────────────┤
│ 1 A  2 Bm  3 C#m  4 D  5 E  6 F#m  7 G#dim │ E7  A/C#  Dsus4  D/F#                      │
│ Gần đây: E  D  A     Gợi ý từ TLH: D  (phím T để nhận)                                │
│ Gõ: [ C#m7 ]   Enter = đặt + tiếp · Tab/→ bỏ qua · Shift+Tab lùi · Del xoá · . lặp     │
└────────────────────────────────────────────────────────────────────────────────────────┘
```
- **Phím tắt:**
  - **1–7**: hợp âm thuận của **tông đang hiển thị**; **Shift+số**: hợp âm 7.
  - **/ + số**: hợp âm đảo (nốt bass).
  - **.**: lặp lại hợp âm trước.
  - **Ctrl+C / Ctrl+V**: chép hợp âm của một đoạn ô nhịp, dùng cho điệp khúc và phần lặp.
  - **T**: nhận gợi ý từ TLH.
  - **Esc**: lưu rồi thoát.
- Khi đang soạn, **←/→ không còn dịch giọng**.

**Điện thoại:** bảng hợp âm nằm dưới, cao khoảng 38% màn hình (thanh dưới tạm ẩn).
```text
│ ◀ nốt 7/24 ▶      ô nhịp 3 · Lời 1 "lai,"      [⌫] [↶] [Xong] │
│ [ G ][ Am ][ Bm ][ C ][ D ][ Em ][ D7 ]   ← chip 48px          │
│ [ /bass ] [ 7 ] [ sus ] [ m ]  [ ⌨ gõ tay ]  [ ≡ chép ô nhịp ] │
```
- Chạm một lần là đặt hợp âm và tự tiến tới nốt sau, khoảng **26 chạm cho cả bài**.
- Vùng chạm tính theo nốt gần nhất, không chồng lên nhau.
- Khi mở bàn phím ảo, bản nhạc tự dời lên (dùng `visualViewport`).

**Soạn trên chế độ Lời & Hợp âm** (cho người không đọc khuông nhạc): mỗi âm tiết là một ô chạm được; chọn hợp âm từ bảng, hoặc gõ kiểu `[G]Cúi xin [Am]Vua`. Dữ liệu ghi vào cùng khoá nốt với chế độ Bản nhạc.

**Đề xuất cho HD:** nút "Đề xuất lên HD" gửi phần khác biệt của bộ cá nhân qua `ApiService.reviews.submit`. Ca trưởng duyệt trong Manager.

### 2.7 Hệ thiết kế
- **Một bộ icon SVG:** Lucide (giấy phép MIT). Lưu **nội bộ** thành một sprite `assets/icons/lucide.svg`, không dùng CDN. **Bỏ emoji** khỏi toàn bộ phần khung giao diện (chỉ giữ ♩ trong nội dung nhạc nếu cần).
- **Kích thước:** nút 32px khi dùng chuột, 40px khi cảm ứng; icon 18px; bo góc 8px; chữ nhãn 13px; chữ phụ tối thiểu 12px.
- **Màu:** 1 màu nhấn (tím) chỉ dành cho hành động chính và trạng thái đang bật; chữ hợp âm màu đỏ (hổ phách ở chế độ tối); mọi thứ còn lại dùng xám trung tính. Chip không còn mỗi cái một màu.
- **Chữ:** viết hoa kiểu câu ("Tối giản bản nhạc"); chỉ viết hoa tên riêng (Chúa, Kinh Thánh, Hội Thánh, Tiệc Thánh).
- File CSS: tiếp tục dùng `assets/css/library-polish.css` làm lớp hoàn thiện. Mọi quy tắc mới đặt ở đây, có ghi chú, không thêm `!important` bừa bãi.

---

## 3. LỘ TRÌNH TRIỂN KHAI

Mỗi ticket ghi rõ việc cần làm và tiêu chí nghiệm thu. Ticket nào có giao diện thì bắt buộc có: **E2E Playwright** (Chromium và WebKit), **ảnh chụp trước/sau** ở laptop 1366 và điện thoại 390, và **không ghi gì vào DB thật** khi chạy test.

### R0 — Sửa hỏng hóc nghiêm trọng (2–3 ngày) 🔴

| ID | Việc | Nghiệm thu |
|---|---|---|
| R0-1 | **B1:** gán `$myChordCode = Auth::chordCode(); $myUsername = Auth::username();` ở đầu nhánh POST của `ChordSetController`. Tắt hiển thị warning trong JSON | Test HTTP (DB tạm): banhat lưu bộ BH thì 200; hoaidinh lưu HD thì 200 và có 1 dòng `chord_set_history`; banhat lưu HD thì 403; viewer thì 403 |
| R0-2 | **B2/B3:** bỏ hoàn toàn việc tự sao chép khi bấm C. Thay bằng hộp thoại hỏi 3 lựa chọn (mục 2.6). Chỉ ghi đè khi người dùng xác nhận. Dùng action `clone` của server để ghi nguồn gốc | E2E: bấm C trên HD mà không chọn gì thì **0 request ghi**; chọn "Sửa trên bản của tôi" khi BH đã có dữ liệu thì BH giữ nguyên; admin ở TLH bấm C thì HD **không đổi** |
| R0-3 | **B4/B5:** Tab/→/Enter/bấm ra ngoài đều **lưu hợp âm đang gõ** rồi mới đi tiếp. Export đúng hàm hoặc gọi thẳng `ChordCanvasEdit` | E2E: gõ "G7" + Tab thì hợp âm được lưu (kiểm tra payload bị chặn) và popup nốt kế tiếp mở ra; gõ "Am" rồi bấm nốt khác thì cũng được lưu |
| R0-4 | **B6:** xoá stack undo/redo khi `loadSong`/`switchSet` | E2E: sửa 001 → chuyển sang 002 → Ctrl+Z thì **không có request ghi nào** cho 002 |
| R0-5 | **B7:** khi lưu, đảo ngược cả `semitones` lẫn `capo` | Unit test: tông +2, capo 3, gõ "C" thì lưu đúng hợp âm ở tông gốc |
| R0-6 | **B11/B12/B17:** bỏ `onchange` inline của `#chord-set-selector`; mục trong menu gọi ModeManager; Esc chỉ xử lý 1 lần | E2E: đổi bộ hợp âm chỉ tạo **1** request `load`; vào soạn từ menu thì Esc thoát được |
| R0-7 | **Laptop bị giấu điều khiển:** bảng Công cụ (⋯) luôn chứa đủ các mục ở mục 2.3, không phụ thuộc container query | E2E ở 1366, 1440, 1920 và 390: mỗi mục Zoom, Tự cuộn, Metronome, Capo, Soạn hợp âm đều **bấm được** trong tối đa 2 thao tác |
| R0-8 | Popover ⓘ hiện ra được (sửa `overflow`/z-index) và có trên điện thoại | E2E: sau khi mở, `elementFromPoint` tại giữa popover trả về chính popover |
| R0-9 | iPad dọc: nút Nhạc/Lời không bị che; nút vai trò không đè "Theo người hướng dẫn"; thanh công cụ và menu cùng một trạng thái vai trò | E2E ở 820 và 1366: không có 2 nút nào giao nhau (script kiểm tra hộp); nhãn vai trò khớp nhau ở 2 nơi |

**Checkpoint R0:** chủ dự án đăng nhập bằng tài khoản ban hát, điền 5 hợp âm vào bài 002, reload thì **vẫn còn đủ**; thử tài khoản Hoài Dinh sửa HD thì lưu được và có lịch sử.

### R1 — Thanh công cụ hiện đại và chế độ Biểu diễn sạch (1 tuần) 🟠

| ID | Việc | Nghiệm thu |
|---|---|---|
| R1-1 | Tạo sprite **Lucide** nội bộ `assets/icons/lucide.svg` và helper PHP `icon('name')`. Thay **mọi emoji và ký tự Unicode** trên thanh công cụ, menu, thanh dưới, HUD, sidebar | Script quét: 0 emoji trong `includes/toolbar.php`, `sidebar.php`, `sheet_viewer.php`, `modals.php` (trừ danh sách được phép) |
| R1-2 | Dựng lại thanh công cụ laptop theo mục 2.2: công tắc 2 chế độ **Bản nhạc \| Lời & Hợp âm**, nút **⤢ Biểu diễn** có chữ, ✎ Soạn hợp âm | Ảnh chụp 1366/1440: một thanh 48px; không có nút nào bị cắt hoặc tràn; tối đa 9 nhóm |
| R1-3 | Bỏ dải chip `#song-info-strip`, chuyển nội dung vào ⓘ. Chip tempo lên thanh công cụ | Nhạc bắt đầu ở y ≤ 100px (1366, không có sidebar) |
| R1-4 ✅ | Dải phân đoạn chỉ hiện khi đang phát chương trình hoặc ở chế độ Biểu diễn; đổi nhãn thành Dạo đầu / Phiên khúc n / Điệp khúc / Kết | E2E: mở bài thường thì không có dải; phát chương trình thì có |
| R1-5 ✅ | Bảng **Công cụ** (mục 2.3): popover trên laptop, bottom sheet trên điện thoại; cùng thứ tự và cùng nhãn | E2E: mỗi mục có nhãn chữ; điện thoại mỗi dòng ≥ 44px; không cần cuộn ngang |
| R1-6 ✅ | **Chế độ Biểu diễn 100%** theo mục 2.5 (ẩn mọi thanh; lớp điều khiển mờ khi chạm giữa; thông báo chỉ hiện 1 lần) | Ảnh chụp: pixel nhạc ≥ 97% màn hình; lớp điều khiển ẩn sau 3 giây; các nút không còn là "ô xám trống" |
| R1-7 ✅ | Sidebar mặc định đóng ở ≤1440px khi mở bằng `?song=`; nút ☰ có nhãn đúng hành động (mở/đóng) | Laptop 1366: nhạc ≥ 70% diện tích |
| R1-8 ✅ | Chỉ còn 1 chỗ đăng nhập (avatar); bỏ trùng lặp: Theo người hướng dẫn, Xem Lời, In, ☰, Học Đàn/Live Band | Kiểm tra: mỗi hành động có đúng 1 chỗ chính (+ tối đa 1 phím tắt) |
| R1-9 ✅ | Thang thiết kế ở mục 2.7: kích thước, màu, chữ; chip trung tính; chế độ tối đồng bộ (không còn chip trắng) | axe-core: 0 lỗi serious/critical ở cả 2 giao diện sáng/tối; mọi chữ phụ ≥ 12px và tương phản ≥ 4.5:1 |

### R2 — Soạn hợp âm mới (1.5 tuần) 🟠

| ID | Việc | Nghiệm thu |
|---|---|---|
| R2-1 ✅ | **Con trỏ nốt** theo thứ tự của `mapNotes`: viền nốt đang chọn, hiện hợp âm mờ gợi ý, tự cuộn tới con trỏ | E2E: Enter đặt hợp âm và con trỏ tiến 1 nốt; Shift+Tab lùi lại |
| R2-2 ✅ | **Bảng hợp âm theo tông đang hiển thị** (sửa B15): 7 hợp âm thuận, hợp âm 7, hợp âm đảo, gần đây, gợi ý TLH; phím 1–7, `/`, `.`, `T` | Unit test: tông A → A Bm C#m D E F#m G#dim; E2E: phím 4 đặt "D" |
| R2-3 ✅ | **Lưu gộp** (debounce 1.5 giây) kèm `baseChecksum`; một chip trạng thái; hàng đợi ngoại tuyến (IndexedDB); nếu lỗi thì hoàn tác hiển thị | E2E: gõ nhanh 10 hợp âm thì ≤ 3 request; server trả 409 (xung đột) thì hiện hộp thoại chọn giữ bản nào |
| R2-4 ✅ | **Chép ô nhịp** (Ctrl+C/V hoặc nút "≡ chép ô nhịp") cho điệp khúc và phần lặp | E2E: chép ô 3–4 sang 11–12 thì 4 hợp âm mới đúng vị trí |
| R2-5 ✅ | **Điện thoại:** bảng hợp âm 38% màn hình, chip 48px, chạm một lần là đặt và tiến; vùng chạm theo nốt gần nhất; tự dời khi mở bàn phím | E2E 390: 24 hợp âm ≤ 30 chạm; nút Lưu/Xong ≥ 44px và không bị che |
| R2-6 ✅ | **Soạn trên chế độ Lời & Hợp âm:** chạm âm tiết rồi chọn hợp âm, hoặc gõ ChordPro | E2E: chạm "Vua" rồi chọn "F" thì chế độ Bản nhạc cũng hiện F ở đúng nốt |
| R2-7 ✅ | Sửa vị trí ✎ và chấm (B9, B16): bám đúng toạ độ nốt; ✎ không trôi lên dòng tác giả | Script: mọi ✎ nằm trong khoảng 0–40px phía trên dòng kẻ khuông của hàng nhạc đó |
| R2-8 ✅ | Hiển thị đúng bộ đang soạn (B8, B10): dropdown và chip đếm cập nhật ngay; không trộn 3 nguồn hợp âm | E2E: đang soạn BH thì chỉ hiện hợp âm BH (và TLH mờ nếu bật gợi ý) |
| R2-9 ✅ | **Đề xuất lên HD** từ trình soạn (review) | E2E (DB tạm): gửi đề xuất thì có 1 `review_request` mang đúng `song_id` |
| R2-10 ✅ | Thống nhất khoá nốt giữa TLH (XML) và bộ cá nhân (OSMD) cho các bài có nhiều bè (`<backup>`) | Test trên 3 bài nhiều bè: sao chép TLH thì hợp âm đúng vị trí |

### R3 — Từ ngữ Tin Lành và dữ liệu nhãn (3–4 ngày) ✅

| ID | Việc | Nghiệm thu |
|---|---|---|
| R3-1 ✅ | Thay toàn bộ **35 chỗ** trong Phụ lục A (giao diện, thông báo, email, hướng dẫn) | Grep chặn tái phát: 0 lần xuất hiện "phụng vụ", "thánh lễ", "Mùa Vọng", "Mùa Chay", "Thường Niên", "Thánh Thể", "Lĩnh xướng", "Đức Mẹ" trong chữ người dùng thấy |
| R3-2 ✅ | Đổi nhãn: "Mùa lễ" → **"Dịp lễ"**; "Setlists" → **"Chương trình"** (vẫn cho tìm "setlist"); "Biểu diễn" → theo quyết định **Q1**; "STT HTTLVN" → "Số bài Thánh Ca"; "Nhật ký biểu diễn" → "Nhật ký phục vụ" | Ảnh chụp sidebar và thanh công cụ |
| R3-3 ✅ | **Bộ nhãn Dịp lễ mới** (Phụ lục B.1) và **Chủ đề theo mục lục Thánh Ca HTTLVN** (Phụ lục B.2). Một danh sách tiếng Việt duy nhất cho cả `getTaxonomy()` lẫn bộ lọc | Test: API taxonomy và bộ lọc sidebar trả về cùng một danh sách |
| R3-4 ✅ | **Migration dữ liệu nhãn** theo khoảng số bài **chính thức** của Thánh Ca (1–903); điền luôn 403 bài đang trống; xoá "Thường Niên". Chạy trên bản sao trước, có `--dry-run` và backup | Dry-run in bảng thay đổi → **chủ dự án duyệt** → chạy thật; `integrity_check = ok`; kiểm 20 bài ngẫu nhiên đúng mục lục |
| R3-5 ✅ | Chuẩn hoá phân đoạn bài: Dạo đầu / Phiên khúc 1..n / Điệp khúc / Kết (dữ liệu `song_sections` + giao diện) | 0 nhãn "Intro/Outro/Lời/Đoạn" còn lại |
| R3-6 ✅ | Vai trò trong chương trình: thêm "Mục sư / Truyền đạo", "Hướng dẫn chương trình", "Đọc Kinh Thánh"; "Lĩnh xướng" → "Hát dẫn" | Ảnh chụp modal phân công |
| R3-7 ✅ | Tìm kiếm khớp cả "Jêsus", "Jê-sus" và "Giê-xu" (không sửa dữ liệu bài hát) | Test HTTP: tìm "gie xu" ra các bài có "JÊSUS" |
| R3-8 ✅ | Dọn dữ liệu test trong chương trình thật ("Setlist Phụng Vụ Test", "E2E …") — **cần chủ dự án đồng ý** | Danh sách dry-run được duyệt (sẵn sàng lệnh `--execute`) |

### R4 — Sheet cho mọi người đàn (1 tuần) 🟢

| ID | Việc | Nghiệm thu |
|---|---|---|
| R4-1 ✅ | **Góc nhìn nhạc cụ** chuyển vào Công cụ → Hiển thị, nhãn tiếng Việt: Guitar · Đàn phím · Bass · Trống · Hát; bỏ nhãn "Stage Lens" | E2E: đổi góc nhìn thì giao diện đổi, và còn nguyên sau reload |
| R4-2 | Chế độ **Lời & Hợp âm**: 2 cột trên iPad/laptop, tô sáng khổ đang hát, cỡ chữ theo "Cỡ hợp âm" | Ảnh chụp 1366: 2 cột; hợp âm ≥ 1.3 lần chữ lời |
| R4-3 | Điện thoại ở chế độ Bản nhạc: ≥ 2 ô nhịp mỗi hàng; hợp âm không đè thân nốt | E2E 390: đếm ô nhịp mỗi hàng ≥ 2; không có hộp hợp âm nào giao với nốt |
| R4-4 | Mặc định theo thiết bị (quyết định **Q2**) và **nhớ lựa chọn** của từng người | E2E: đổi sang Nhạc, reload thì vẫn là Nhạc |
| R4-5 | Bản in "Lời & Hợp âm" và "Tập chương trình thờ phượng" dùng từ ngữ mới và đúng tông/bộ đang chọn | Kiểm tra bản in PDF |

### R5 — Nghiệm thu thật (3 ngày)
1. Tập với ban nhạc: 1 người hướng dẫn và 4 nhạc công, iPad và điện thoại thật, chương trình 5 bài.
2. **Buổi soạn hợp âm:** một người điền trọn 1 bài 24 hợp âm trên laptop (≤ 5 phút) và trên điện thoại (≤ 8 phút), rồi reload để kiểm tra.
3. Chấm theo thang ở Mục 4. Đạt khi trung bình ≥ 9.

---

## 4. THANG NGHIỆM THU 10/10 (ĐO ĐƯỢC)

| Hạng mục | 10 điểm nghĩa là | Đo bằng |
|---|---|---|
| Diện tích nhạc | Laptop ≥ 75% (sidebar đóng); điện thoại ≥ 87%; chế độ Biểu diễn ≥ 97% | Script đo hộp phần tử |
| Thanh công cụ | 1 thanh; ≤ 9 nhóm; 0 emoji; 1 cỡ nút; 0 nút tràn hoặc chồng ở 360–1920px | E2E + quét |
| Tìm tính năng | Mọi tính năng ≤ 2 thao tác trên mọi màn hình; có nhãn chữ | Ma trận E2E |
| Soạn hợp âm: đúng | 0 lần ghi đè không hỏi; lưu được theo đúng quyền; undo không lẫn bài; capo và tông đúng | E2E + HTTP (DB tạm) |
| Soạn hợp âm: nhanh | Laptop ≤ 1.5 thao tác/hợp âm; điện thoại ≤ 1.3 chạm/hợp âm; ≤ 1 request mỗi 1.5 giây | E2E đếm |
| Từ ngữ | 0 từ trong danh sách cấm; nhãn đúng mục lục Thánh Ca | Grep + migration được duyệt |
| Truy cập | axe: 0 lỗi serious ở cả 2 giao diện; chữ ≥ 12px | E2E |
| Thực tế | Ban nhạc chấm ≥ 9; soạn 1 bài ≤ 5 phút (laptop) | Phiếu nghiệm thu R5 |

---

## 5. QUYẾT ĐỊNH CẦN CHỦ DỰ ÁN

| ID | Câu hỏi | Đề xuất |
|---|---|---|
| **Q1** | Tên nút chế độ toàn màn hình | **"Toàn màn hình"** (trung tính, ai cũng hiểu). Phương án khác: "Hầu việc". Tránh "Biểu diễn" |
| **Q2** | Điện thoại mặc định mở chế độ nào | **Lời & Hợp âm** cho khách và người chọn Guitar/Hát; **Bản nhạc** cho Đàn phím. Luôn nhớ lựa chọn cuối cùng |
| **Q3** | Dùng bộ icon Lucide (lưu nội bộ, MIT) | Đồng ý |
| **Q4** | "Setlist" hay "Chương trình" | Nhãn chính là **"Chương trình"**; vẫn cho tìm bằng "setlist" |
| **Q5** | Người hướng dẫn ban nhạc gọi là gì | **"Người hướng dẫn"** trong phần đồng bộ ban nhạc; "Ca trưởng" chỉ dùng cho ca đoàn |
| **Q6** | Có thêm dịp "Lễ Mẹ / Lễ Cha" không | Tuỳ Hội Thánh: có trong danh sách nhưng mặc định tắt |
| **Q7** | Cho phép chạy migration nhãn theo mục lục Thánh Ca (thay 500 dòng nhãn cũ và điền 403 bài trống) | Đồng ý sau khi xem kết quả dry-run |
| **Q8** | Bấm C khi đang ở HD: lựa chọn mặc định trong hộp thoại | **"Sửa trên bản của tôi"** (không bao giờ ghi đè nếu chưa xác nhận) |

---

## 6. THỨ TỰ THỰC HIỆN

1. **Một đầu mối**, nhánh `feature/roadmap5`, tắt tự push.
2. **R0-1 → R0-9** (sửa hỏng hóc). Chạy E2E đầy đủ. **Checkpoint R0** do chủ dự án ký.
3. **R1** (thanh công cụ và chế độ Biểu diễn), rồi **R2** (soạn hợp âm), rồi **R3** (từ ngữ và dữ liệu, chờ Q7), rồi **R4**, rồi **R5**.
4. Mẫu báo cáo mỗi ticket: dùng mẫu ở `ROADMAP3.md` Phần F, **cộng thêm ảnh chụp trước/sau** ở 1366 và 390.

---

## PHỤ LỤC A — Danh sách chữ cần đổi (từ ngữ Tin Lành)

| # | Vị trí | Hiện tại | Đổi thành |
|---|---|---|---|
| 1–3 | `api/services/SongSearchHelper.php:32,34,36` | Mùa Vọng / Mùa Chay / Mùa Thường Niên | Lễ Giáng Sinh / Lễ Thương Khó / *(bỏ — để trống = quanh năm)* |
| 4 | :37 | Lễ Trọng & Kính | Lễ nghi Hội Thánh |
| 5 | :40 | Ca Nhập Lễ | Khai lễ |
| 6 | :41 | Đáp Ca / Tung Hô | Kinh tiết ca / Đoản ca |
| 7 | :42 | Dâng Lễ / Tiến Lễ | Dâng hiến |
| 8 | :43 | Hiệp Lễ / Thánh Thể | Tiệc Thánh |
| 9 | :44 | Tạ Lễ / Kết Lễ | Tất lễ |
| 10–11 | :45,46 | Đức Mẹ Maria · Thánh Tâm Chúa | *(bỏ)* · Huyết Chúa / Thập tự giá |
| 12 | `tests/fts5_taxonomy_search_regression.php` | khoá `advent/lent/ordinary` | cập nhật cùng lúc |
| 13–14 | `includes/sidebar.php:63-65`, `library-ui.js:339,407` | Mùa Lễ / Tất cả Mùa Lễ / đổi mùa lễ | Dịp lễ / Tất cả dịp lễ / đổi dịp lễ |
| 15 | `sidebar.php:43` | STT HTTLVN | Số bài Thánh Ca |
| 16 | `api/init_db.php:33` (danh mục id=4) | Thánh ca theo mùa lễ phụng vụ lớn | Thánh ca các dịp lễ lớn của Hội Thánh |
| 17 | `NotificationDeliveryService.php:205,413` | SheetApp Phụng Vụ | SheetApp Thờ Phượng |
| 18 | `NotificationService.php:148,167,185` | Chương trình Phụng vụ… / nhiệm vụ mới trong Phụng vụ | Chương trình thờ phượng… |
| 19 | `NotificationPreferenceService.php:21-22` | Chương trình phụng vụ mới / Phân công nhiệm vụ phụng vụ | Chương trình thờ phượng mới / Phân công phục vụ buổi nhóm |
| 20 | `SetlistService.php:235` | Chương trình Phụng vụ | Chương trình thờ phượng |
| 21 | `SetlistUsageHelper.php:138` | …nhu cầu phụng vụ | …nhu cầu buổi nhóm |
| 22 | `PracticeAssignmentCreationHelper.php:28,81` | chương trình phụng vụ / 'Phụng vụ' | chương trình thờ phượng / 'Buổi nhóm' |
| 23 | `PracticeAssignmentController.php:32,64` | …chương trình phụng vụ | …chương trình thờ phượng |
| 24 | `SetlistController.php:49` | báo cáo phụng vụ | báo cáo sử dụng bài hát |
| 25 | `huong-dan/index.php:135`, `partials/chapters_6_to_10.php` (8 chỗ) | Phụng Vụ, "In Booklet Phụng Vụ" | Chương trình thờ phượng / Buổi nhóm, "In tập chương trình lễ" |
| 26 | `huong-dan/partials/chapters_1_to_5.php:13` | thánh lễ | buổi nhóm |
| 27 | `modals/ServicePlanAssignModal.js:32` | Lĩnh Xướng | Hát dẫn |
| 28 | `ServicePlanAssignModal.js:25-38` | *(thiếu)* | + Mục sư / Truyền đạo, Hướng dẫn chương trình, Đọc Kinh Thánh |
| 30 | `liturgy-card.js:19` | Giảng Luận | Giảng Lời Chúa |
| 31 | `includes/modals.php:278`, `setlist-list.js:162` | "VD: Lễ Chúa Nhật 1, Worship 20/4" | "VD: Thờ phượng Chúa Nhật 20/4, Lễ Tiệc Thánh" |
| 32 | `includes/modals.php:4`, `sheet_viewer.php:34` | Nhật Ký Biểu Diễn | Nhật ký phục vụ |
| 33 | `print/service-booklet.php:228,309`, `print/chord-sheet.php:227` | Tông biểu diễn | Tông hát |
| 34 | `print/service-booklet.php:137` | Booklet Thờ Phượng | Tập chương trình thờ phượng |
| 35 | `index.php:21-22`, `modals.php:563` | Nhạc Thánh Ca Tương Tác | Thánh Ca tương tác |
| + | Giao diện | Setlists · Band · Nhắc Band · Stage Lens · Preset hiển thị · Khóa View · "(Live Sync)" · "(/manager/)" | Chương trình · Lời & Hợp âm · Nhắc ban nhạc · Góc nhìn nhạc cụ · Kiểu hiển thị · Khóa tỷ lệ · *(bỏ)* · *(bỏ)* |
| + | Chính tả | "Xoá" (khoảng 10 chỗ) | "Xóa" (thống nhất) |

*(Định danh trong code như `liturgy-card`, cột `liturgical_season` được giữ nguyên. Chỉ đổi chữ mà người dùng nhìn thấy.)*

## PHỤ LỤC B — Bộ nhãn mới

### B.1 Dịp lễ (cột `liturgical_season`, theo Hiến chương HTTLVN Điều 7 và phần Biệt lễ ca của Thánh Ca)
Lễ Giáng Sinh · Năm Mới · Chúa Nhật Lễ Lá · Lễ Thương Khó (Tuần Thương Khó, Thứ Sáu Thương Khó) · Lễ Phục Sinh · Lễ Thăng Thiên · Lễ Đức Thánh Linh Giáng Lâm (Ngũ Tuần) · Lễ Cảm Tạ · Lễ Tiệc Thánh · Lễ Báp-têm · Lễ Dâng Con · Hôn Lễ · Tang Lễ · Lễ Cung Hiến · Lễ Tấn Phong Mục Sư · Tiễn Biệt · Buổi Truyền Giảng · *(để trống = quanh năm)* · *(tuỳ chọn Q6: Lễ Mẹ / Lễ Cha)*

### B.2 Chủ đề (cột `theme`, theo mục lục Thánh Ca HTTLVN)
1. Thờ phượng (Ngợi khen · Thờ kính · Khai lễ · Tất lễ · Buổi sáng/tối · Ngày Chúa Nhật)
2. Đức Chúa Trời
3. Chúa Jêsus Christ (Giáng sinh · Đời sống & chức vụ · Thương khó · Phục sinh · Thăng thiên · Tái lâm)
4. Đức Thánh Linh
5. Hội Thánh
6. Kinh Thánh
7. Tin Lành (Lời mời · Ăn năn · Huyết Chúa · Thập tự giá)
8. Đời tín đồ (Đức tin · Cầu nguyện · Tận hiến · Bình an · Cảm tạ)
9. Thiên đàng
10. Truyền giảng
11. Thiếu nhi
12. Thanh niên
13. Đơn ca – Song ca
14. Hợp ca
15. Kinh tiết ca & Đoản ca
16. Thi Thiên

### B.3 Đối chiếu nhãn cũ → mới (phục vụ R3-4)
| Khoảng bài (chính thức) | Chủ đề đúng | Nhãn cũ (sai) |
|---|---|---|
| 1–38 | Thờ phượng | 1–40 Tôn Vinh |
| 39–52 | Đức Chúa Trời | 41–52 |
| 53–75 | Chúa Jêsus – Giáng sinh | ✔ |
| **76–87** | **Chúa Jêsus – Đời sống & chức vụ** | **Năm Mới** ✘ |
| 88–102 | Thương khó | 88–101 |
| 103–112 / 113–118 | Phục sinh / Thăng thiên | lệch 1 bài |
| 119–134 / 135–144 | Tái lâm / Đức Thánh Linh | ✔ |
| 145–149 / 150–155 | Hội Thánh / Kinh Thánh | gộp sai |
| 156–205 / 206–334 | Tin Lành / Đời tín đồ | gần đúng |
| 335–348 | Thiên đàng | ✘ |
| **349–362** | **Truyền giảng** | **Bình An** ✘ |
| 363–392 | Thiếu nhi · Thanh niên · Đơn/Song ca | ✘ |
| 393–411 | Dâng con · Báp-têm · Tiệc Thánh · Hôn lễ · Tang lễ · Năm mới · Tiễn biệt · Tấn phong | **Lễ Cảm Tạ** ✘ |
| 413–455 | Hợp ca · Kinh tiết ca · Đoản ca | ✘ |
| **456–509** | **Thi Thiên** | **Truyền Giảng** ✘ |
| 510–903 | theo mục lục tại thanhca.httlvn.org (đang trống) | — |

*Nguồn: Hiến chương HTTLVN (Điều 7, 62); mục lục Thánh Ca tại thanhca.httlvn.org. Phải đối chiếu lại toàn bộ khi chạy dry-run R3-4.*
