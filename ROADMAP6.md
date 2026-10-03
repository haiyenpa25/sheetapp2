# SheetApp2 — ROADMAP 6: Hoàn thiện giao diện Thư viện

> **Trạng thái:** Đã triển khai R6-0 đến R6-7 trên `feature/roadmap6`; chờ chủ dự án nghiệm thu và quyết định merge. Giới hạn kiểm thử ghi trong `docs/ROADMAP6_IMPLEMENTATION_REPORT.md`.
> **Ngày khảo sát:** 2026-10-01.
> **Phạm vi:** Chỉ trang Thư viện (`index.php`, `includes/toolbar.php`, các module UI liên quan). Giữ nguyên các Core Rules và quyền lưu hợp âm hiện hành.
> **Nhánh đề xuất:** `feature/roadmap6`; một người/AI thực thi từng ticket. Áp dụng `ROADMAP3.md` Phần 0: test trên DB/storage tạm, bằng chứng RED/PASS, không chạy `sync.bat`/`sync.sh`, không tự push/merge, không sửa ô quyết định/chữ ký của chủ dự án.

## 0. Mục tiêu và ranh giới

1. Thanh công cụ đẹp, dễ đọc và có đường vào mọi tính năng quan trọng trên laptop, iPad, điện thoại; icon vừa mắt, vùng bấm đủ rộng.
2. Người có quyền (Admin và tài khoản sở hữu `chord_code=HD`) vào luồng điền hợp âm đúng, lưu và tải lại không mất; người khác không sửa đè HD/TLH.
3. Toàn Màn Hình thật sự tập trung vào nhạc, vẫn dễ thoát và đồng bộ trạng thái với Fullscreen API khi trình duyệt tự thoát.
4. Thông báo, menu, thanh dưới và dải phân đoạn không che nội dung nhạc hoặc điều khiển.

Không mở lại các ticket R0–R5 đã hoàn thành chỉ vì chúng có cùng tên tính năng. Mỗi ticket R6 phải bắt đầu bằng lỗi tái hiện được hoặc tiêu chí trải nghiệm chưa đạt trong bản đang chạy.

## 1. Căn cứ khảo sát

Khảo sát mã nguồn tại `main` (`08287ef`) và trang chạy ở `http://localhost/sheetapp2/?song=thanh-ca-001` với tài khoản khách, Chromium headless, 1366×768 và 390×844. Trang chạy sử dụng working tree `main` đang có **6 file sửa chưa commit**; đặc biệt `ModeManager.js`, `arrangement-engine.js`, `library-polish.css` đang được thay đổi. Trước khi thực thi R6 phải đối chiếu lại sau khi các thay đổi này được chốt. Không dùng ảnh chụp này làm bằng chứng rằng nhánh `feature/roadmap6` đã có cùng hành vi.

| Quan sát | Bằng chứng hiện có | Mức tin cậy |
|---|---|---|
| Desktop: toolbar cao 48px ở y=44; nút Soạn ẩn với khách, đúng quyền; icon `icon-xs` khai báo 12px, nhiều icon hiển thị 12–15px | DOM thật và `assets/css/library-polish.css` | Đã xác nhận cho khách |
| Menu Công cụ vẫn hiện “Soạn hợp âm” và “Bộ hợp âm mới” với khách; `auth.js` ẩn `#btn-menu-chord-edit` nhưng nút hiển thị là `#btn-menu-add-chord-mode` | Mở menu thật + đối chiếu `includes/toolbar.php`, `assets/js/auth.js` | Đã xác nhận |
| Toast 1366px tại x=922, y=100, rộng 420px, cao 71px; mobile tại x=16, y=54, rộng 358px, cao 71px; ảnh chụp cho thấy toast che vùng tiêu đề/nội dung đầu bài | DOM và ảnh chụp trong phiên khảo sát | Đã xác nhận |
| Toàn Màn Hình 390px: dải phân đoạn chiếm 35px trên cùng, HUD ở đáy 52px; toast nổi trên tên bài | DOM và ảnh chụp trong phiên khảo sát | Đã xác nhận |
| Sau khi gọi `document.exitFullscreen()` từ trình duyệt, `document.fullscreenElement` thành `null` nhưng `body.dataset.appMode` vẫn là `performance`; phím Esc do ứng dụng xử lý thì quay về `view` đúng | Thử trực tiếp trên Chromium | Đã xác nhận |
| Lưu HD trực tiếp cho Admin hoặc `chord_code=HD` được backend cho phép; các vai trò khác bị chặn ghi HD | `api/controllers/ChordSetController.php` và `api/core/Auth.php` | Chỉ xác nhận bằng source; cần E2E trên DB tạm |

**Mâu thuẫn đặc tả cần giải quyết khi thực thi:** ROADMAP5 R1-4 yêu cầu dải phân đoạn hiện trong Toàn Màn Hình, còn R1-6 yêu cầu diện tích nhạc tối đa và mô tả ẩn dải này. Đề xuất R6: phân đoạn truy cập trong HUD khi chạm, không chiếm một hàng cố định. Chủ dự án có thể chọn giữ dải cố định; khi đó ticket R6-4 phải nghiệm thu theo lựa chọn đó.

## 2. Nguyên tắc thiết kế

- Giữ màu thương hiệu hiện có, dùng trạng thái trung tính cho điều khiển thường và một màu nhấn cho hành động đang bật. Dùng Lucide sprite nội bộ; không thêm emoji hoặc thư viện icon mới.
- Icon toolbar mục tiêu 16–18px, menu/HUD 18–20px; **kích thước icon không quyết định kích thước vùng bấm**. Nút desktop tối thiểu 32px, mục chạm mobile mục tiêu 44px. WCAG 2.2 AA yêu cầu đích trỏ tối thiểu 24×24 CSS px hoặc đạt ngoại lệ khoảng cách; mức 44px ở mobile là mục tiêu trải nghiệm của dự án, cao hơn mức AA. Nguồn: [W3C 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum).
- Giữ toolbar desktop một hàng 48px và mobile 44px ở trên + thanh thao tác dưới. Trên màn hình hẹp, chuyển chức năng phụ vào Công cụ nhưng mọi hành động chính phải tới được trong tối đa hai thao tác.
- Dùng tên chức năng rõ ràng (`Soạn hợp âm`, `Toàn Màn Hình`, `Công cụ`), `aria-label`, `aria-expanded`, focus thấy được, keyboard/ESC hoạt động. Không làm icon lớn để bù cho nhãn thiếu.
- Mọi thay đổi quyền phải được kiểm tra cả UI và API. Chỉ ẩn nút ở UI không thay thế cho kiểm tra backend.

## 3. Thứ tự ticket

### R6-0 — Chốt baseline và ma trận hành vi (S)

**Mục đích:** Tránh triển khai trên một trạng thái source khác với trang đang chạy. Ghi nhận lại hành vi trên nhánh thực thi, kiểm tra các thay đổi chưa commit ở `main`, thống nhất bộ ảnh 1366/1440/820/390/360px và bốn vai trò khách/Ban Hát/Admin/HD bằng tài khoản thử trên DB tạm.

**Nghiệm thu:** Có ảnh trước thay đổi, bảng đo vị trí/vùng bấm/đường vào toolbar, kết quả console, và ma trận quyền với request ghi được bắt trên môi trường cô lập. Không có test nào ghi DB/storage thật.

**Phụ thuộc:** Không. **File dự kiến:** E2E khảo sát mới và tài liệu bằng chứng (≤2 file). **Skill:** `debugging-and-error-recovery`, `test-driven-development`, `frontend-ui-engineering`.

### R6-1 — Sửa đường vào Soạn hợp âm và quyền hiển thị (M)

**Mục đích:** Đồng bộ một ID/nguồn quyền cho nút Soạn ở toolbar, menu Công cụ và mobile. Khách không thấy hành động ghi; Ban Hát có đường vào bản cá nhân; Admin và chủ sở hữu HD có đường vào trực tiếp khi đang xem HD. Giữ luồng hỏi trước khi sao chép hoặc ghi đè.

**Nghiệm thu:** E2E với từng vai trò trên DB tạm: trạng thái nút/menu khớp quyền API; khách không phát sinh request ghi; Admin và `chord_code=HD` mở chế độ soạn HD; người không sở hữu HD không sửa HD trực tiếp. Test RED trước khi sửa lỗi ID menu.

**Phụ thuộc:** R6-0. **File dự kiến:** `assets/js/auth.js`, `includes/toolbar.php`, `assets/js/toolbar-controller.js`, một E2E mới (4 file). **Skill:** `debugging-and-error-recovery`, `test-driven-development`, `security-and-hardening`.

### R6-2 — Kiểm chứng lưu hợp âm Admin/HD từ đầu đến cuối (M)

**Mục đích:** Xác nhận nhấn C/chạm Soạn → đặt hợp âm → trạng thái lưu → tải lại vẫn đúng; xử lý lỗi 403/409, mạng mất và thoát khi còn dữ liệu chờ. Chỉ sửa nguyên nhân nếu test chứng minh lỗi, không đổi ma trận quyền HD/TLH.

**Nghiệm thu:** Bộ test trên DB/storage tạm chứng minh hợp âm Admin và HD tồn tại sau reload, không ghi nhầm sang bài/bộ khác; 403/409 có thông báo và không báo “Đã lưu” sai; không cần mở DevTools để hiểu trạng thái lưu.

**Phụ thuộc:** R6-1. **File dự kiến:** tối đa 3 file nguồn thuộc `chord-canvas*`/`ChordSetController.php` theo lỗi thực tế và tối đa 2 file test (≤5). **Skill:** `debugging-and-error-recovery`, `test-driven-development`, `api-and-interface-design`.

### R6-3 — Chuẩn hóa toolbar và icon (M)

**Mục đích:** Cân lại kích thước icon, khoảng cách, nhãn và thứ tự ưu tiên theo 2 chế độ xem; hạn chế cụm nút bị cắt, trùng, hoặc chỉ nhận biết bằng icon. Giữ các hành động chính: bài/tông, bộ hợp âm, tempo, chuyển dạng xem, soạn (nếu có quyền), toàn màn hình, bài trước/sau, Công cụ.

**Nghiệm thu:** 1366/1440/820/390/360px không có nút giao nhau hoặc tràn ngang; mỗi hành động chính tới được trong ≤2 thao tác; icon toolbar 16–18px, vùng chạm mobile ≥44px; 0 lỗi axe serious/critical trong các trạng thái sáng/tối; ảnh trước/sau cho chủ dự án xem.

**Phụ thuộc:** R6-1. **File dự kiến:** `includes/toolbar.php`, `assets/css/library-polish.css`, một E2E mới, có thể `assets/js/toolbar-controller.js` (≤4). **Skill:** `frontend-ui-engineering`, `test-driven-development`.

### R6-4 — Toàn Màn Hình đồng bộ và không che nhạc (M)

**Mục đích:** Lắng nghe `fullscreenchange` để ứng dụng rời `performance` khi trình duyệt thoát Fullscreen API; xử lý trường hợp API từ chối để UI không báo trạng thái sai. Quyết định vị trí dải phân đoạn theo mục 1, giữ HUD tự ẩn và đường thoát rõ ràng. [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Document/fullscreenchange_event) xác nhận sự kiện và cách đọc `document.fullscreenElement`.

**Nghiệm thu:** Click vào/ra, Esc, `document.exitFullscreen()`, lỗi/không hỗ trợ API, đổi tab và quay lại đều để `ModeManager`, `body` và browser cùng trạng thái; khi HUD ẩn không có toast/dải cố định che tiêu đề hoặc khuông đầu; kiểm tra Chromium và WebKit trên desktop/mobile.

**Phụ thuộc:** R6-0; lựa chọn dải phân đoạn. **File dự kiến:** `assets/js/core/ModeManager.js`, `assets/css/library-polish.css`, một E2E mới, thêm `arrangement-engine.js` nếu cần (≤4). **Skill:** `debugging-and-error-recovery`, `test-driven-development`, `frontend-ui-engineering`.

### R6-5 — Thông báo và các lớp nổi (S)

**Mục đích:** Đưa toast trạng thái lúc tải bài/đổi chế độ ra khỏi vùng tiêu đề, khuông đầu và điều khiển; gộp thông báo trùng, ưu tiên thông báo lỗi so với nhắc thao tác.

**Nghiệm thu:** Script đo bounding box xác nhận toast không giao tiêu đề/khuông đầu/HUD ở 1366, 820 và 390px; thông báo lỗi vẫn đọc được và có lối đóng; ảnh trước/sau + E2E. Không chỉ sửa bằng tăng z-index.

**Phụ thuộc:** R6-3, R6-4. **File dự kiến:** `assets/css/library-polish.css`, module phát toast liên quan, một E2E mới (≤3). **Skill:** `frontend-ui-engineering`, `test-driven-development`.

### R6-6 — Rà lại trải nghiệm đọc và Công cụ trên mobile (M)

**Mục đích:** Kiểm tra tiêu đề lặp, thanh dưới che lời/hợp âm, menu Công cụ dài, mở/đóng sidebar và việc chuyển Bản nhạc ↔ Lời & Hợp âm. Chỉ mở ticket sửa con nếu quan sát có lỗi tái hiện; tránh thêm tính năng ngoài phạm vi.

**Nghiệm thu:** 360/390/820px không có nội dung hoặc nút bị che ở đầu/cuối trang; menu có nhóm rõ ràng, cuộn được và đóng bằng Esc/backdrop; vị trí đọc được giữ hợp lý sau đổi dạng xem và reload; ảnh đối chiếu sáng/tối.

**Phụ thuộc:** R6-3, R6-5. **File dự kiến:** tối đa 3 file UI/CSS theo lỗi tái hiện và tối đa 2 E2E (≤5). **Skill:** `frontend-ui-engineering`, `debugging-and-error-recovery`, `test-driven-development`.

### R6-7 — Nghiệm thu và bàn giao (S)

**Mục đích:** Chạy test PHP, syntax JS, ESLint, E2E Chromium/WebKit trên môi trường cô lập; đo lại ảnh, không dùng số liệu ghi cứng. Báo riêng lỗi có sẵn và lỗi mới bằng log thô.

**Nghiệm thu:** 0 regression mới, 0 JS console error trong luồng khảo sát; tiêu chí R6-1 đến R6-6 có bằng chứng PASS; chủ dự án xem bản UI thật trước khi merge. Không tự đánh dấu việc chủ dự án hoặc ô duyệt.

**Phụ thuộc:** R6-1 đến R6-6. **File dự kiến:** báo cáo nghiệm thu (1 file). **Skill:** `code-review-and-quality`, `git-workflow-and-versioning`.

## 4. Checkpoint và quyết định còn mở

- **Sau R6-2:** chủ dự án dùng tài khoản thử Admin và HD kiểm tra một bài, reload và xác nhận hợp âm còn nguyên; không dùng DB thật cho E2E.
- **Sau R6-4:** xem thử Toàn Màn Hình trên laptop và điện thoại, chốt cách gọi dải phân đoạn. Đề xuất mặc định: chỉ hiện khi gọi HUD, giữ diện tích nhạc.
- **Sau R6-7:** duyệt ảnh sáng/tối, desktop/mobile và log test trước khi merge.

**Quyết định cần chủ dự án trả lời trước khi thực thi R6-4:** Dải phân đoạn nên cố định trên mép trên trong Toàn Màn Hình hay chỉ mở cùng HUD? Đề xuất phương án HUD. Không tự sửa bảng quyết định/chữ ký của các roadmap trước.

**Ghi chú thực thi 2026-10-01:** Đã triển khai phương án dải phân đoạn mở cùng HUD trong worktree `feature/roadmap6` để chủ dự án xem UI thật. Bằng chứng test, giới hạn WebKit và các lỗi nền được ghi trong `docs/ROADMAP6_IMPLEMENTATION_REPORT.md`. Ô duyệt của chủ dự án vẫn để mở.

## 5. Lệnh kiểm tra khi thực thi

```powershell
php tests\run_all_tests.php
npm run check:syntax
npm run lint
npx playwright test --reporter=line
git diff --check
```

Chỉ chạy suite có thể viết dữ liệu sau khi xác nhận chúng trỏ tới DB/storage tạm theo `ROADMAP3.md` Phần 0. Kết quả thực thi, các lỗi nền và giới hạn nghiệm thu được ghi trong `docs/ROADMAP6_IMPLEMENTATION_REPORT.md`.
