# SheetApp2 — ROADMAP 7: Trải nghiệm Thư viện trên điện thoại và laptop

> **Trạng thái:** Đã tích hợp mã R6/R7 vào cây làm việc `main` theo yêu cầu của chủ dự án ngày 2026-10-02, đồng thời giữ các sửa đổi riêng có trước trên `main`. Cổng E2E và PHP tổng hợp đều đạt; xem `docs/ROADMAP7_IMPLEMENTATION_REPORT.md`. Chưa commit, push hoặc deploy. Không tự đánh dấu việc của chủ dự án.
> **Ngày khảo sát:** 2026-10-02.
> **Nguồn khảo sát:** mã nguồn và trang chạy `feature/roadmap6` tại `http://127.0.0.1:8766/?song=thanh-ca-002`, Chromium headless, tài khoản khách. `ROADMAP6.md` cho biết R6 đang chờ nghiệm thu/merge; cây làm việc `main` và nhánh R6 có thay đổi riêng. Khi bắt đầu R7 phải đối chiếu lại bản thực sự được chọn làm nền.
> **Phạm vi:** giao diện Thư viện tại `index.php`; điện thoại là ưu tiên đầu tiên, sau đó tablet và laptop. Giữ nguyên quy tắc tông gốc, bộ hợp âm HD/TLH, quyền soạn, API và dữ liệu.

## 1. Kết quả rà soát

| Ưu tiên | Quan sát đã xác nhận | Bằng chứng và hệ quả |
|---|---|---|
| P0 | Ở 360/390/430 px, thanh thao tác dưới có tăng/giảm tông, chọn bộ hợp âm, đổi chế độ xem và vào toàn màn hình. | `includes/toolbar.php` và DOM đang chạy: thanh cao 63 px; các nút chính cao 44 px. Vấn đề là khả năng nhận biết: nhãn “Lời & HÂ” bị rút gọn, một nút toggle không cho thấy đồng thời hai lựa chọn “Bản nhạc”/“Lời & Hợp âm”. |
| P0 | Vào toàn màn hình làm **ẩn hẳn thanh thao tác dưới**. HUD thay thế có dịch tông và thoát, nhưng **không có nút đổi Bản nhạc/Lời** hoặc chọn bộ hợp âm. | `assets/css/library-polish.css` ẩn `.mobile-thumb-bar` trong `.sheet-only-mode`; `includes/sheet_viewer.php` không có điều khiển đổi dạng xem. Người dùng phải thoát toàn màn hình để đổi dạng xem. |
| P0 | Vùng bấm tăng/giảm tông ở HUD toàn màn hình chỉ 30×30 px; HUD tự mờ sau một khoảng thời gian. | Đo DOM ở 360/390/430 px và `assets/css/library-polish.css`; cần vùng chạm dễ dùng và tín hiệu rõ để gọi lại HUD. |
| P1 | Logo đã có trong `includes/sidebar.php`, nhưng bị ẩn từ 1201 px trở lên vì logo cũng xuất hiện ở App Shell. | `assets/css/library-polish.css` và DOM tại 1366/1440 px: `.sidebar-header .logo-text` là `display:none`; `includes/app_nav.php` có `.shell-brand`. Yêu cầu mới là đặt logo ở khu vực chọn bài; cần tránh hai logo và giữ nhận diện ở các trang khác. |
| P1 | Điện thoại có thanh trên và thanh dưới nhưng vùng đọc bị chia nhiều lớp; thông báo có thể phủ lên nhạc và HUD. | Ảnh 390×800 của bản R6 cho thấy thông báo trạng thái ở sát vùng nội dung/thanh dưới; cần thử cả Sheet, Lời, menu, sidebar và chế độ biểu diễn trên nhiều chiều cao. |
| P1 | Các breakpoint 681, 880, 1200, 1201 và 1440 px cùng nhiều quy tắc ưu tiên cho toolbar/sidebar. | `assets/css/layout.css` và `assets/css/library-polish.css`; cần kiểm tra ở bề rộng laptop thực tế, mức zoom 100%/125%, sidebar mở/đóng để tránh nút bị cắt hoặc co không hợp lý. |

Các quan sát trên là từ **Chromium headless với khách**, chưa phải kết luận cho iOS Safari, Android Chrome, quyền Admin/HD hoặc mọi bài hát. Không lấy các số đo này làm kết quả nghiệm thu sau sửa.

## 2. Kết quả cần đạt

1. Trên điện thoại, người xem luôn tìm được và dùng được các thao tác chính: mở danh sách bài, hạ/tăng tông và về tông gốc, biết tông hiện tại, chọn Bản nhạc/Lời & Hợp âm, vào/thoát toàn màn hình. Bộ hợp âm và Công cụ có đường vào rõ ràng. Mỗi thao tác chính tới được trong tối đa hai lần chạm ở chế độ đọc thường và biểu diễn.
2. Mọi nút chạm thường xuyên trên điện thoại có vùng chạm mục tiêu **ít nhất 44×44 CSS px** (hoặc vùng tương đương không chồng lấn). Icon có kích thước vừa, nhãn hoặc tên truy cập rõ; không dựa vào `title` vì điện thoại không có hover.
3. Toàn màn hình ưu tiên diện tích nhạc nhưng có HUD gọi lại được bằng chạm, có chuyển dạng xem, dịch tông và thoát. HUD, thông báo, thanh điều hướng và safe area không đè lên nội dung thiết yếu hoặc nhau.
4. Logo SheetApp hiển thị tại đầu thanh chọn bài ở cả laptop và điện thoại. Khi sidebar đóng, nút mở danh sách bài vẫn rõ; khu vực điều hướng chung của các trang khác hoạt động bình thường.
5. Ở laptop, toolbar một hàng khi đủ chỗ, tên bài không lấn hành động, các tính năng phụ ở menu Công cụ có nhãn rõ. Đọc sheet và lời thoải mái ở 1366/1440 px, kể cả khi mở sidebar và zoom trình duyệt 125%.
6. Không làm thay đổi quyền soạn, dữ liệu hợp âm, chức năng setlist, offline hoặc điều hướng của trang khác.

## 3. Thiết kế ưu tiên

- **Điện thoại, chế độ đọc:** thanh đầu gọn gồm mở bài, tên bài/tông và Công cụ; thanh thao tác sát ngón cái gồm `−  Tông  +`, dạng xem, toàn màn hình. Chọn bộ hợp âm là hành động kế tiếp trong toolbar hoặc Công cụ tùy bề rộng; không giấu một hành động cốt lõi quá hai chạm. Dạng xem phải nói rõ **trạng thái hiện tại và hành động khi chạm**; thử hai phương án toggle có nhãn và lựa chọn hai mục trước khi chốt giao diện 320–360 px.
- **Toàn màn hình điện thoại:** một HUD gọn với dịch tông, đổi Sheet/Lời, thoát; có thể mở rộng nhóm chức năng phụ khi chạm. Khi HUD tự ẩn, để lại dấu hiệu nhỏ, rõ và không che nhạc để gọi lại. Nút tông và nút thoát phải dùng được bằng ngón tay. Trên trình duyệt không hỗ trợ Fullscreen API, trạng thái giao diện và nút thoát vẫn đồng bộ.
- **Sidebar/logo:** dùng logo trong `includes/sidebar.php` làm nhận diện của khu vực chọn bài. Ẩn/thu gọn `.shell-brand` **chỉ trong trang Thư viện** khi sidebar hiện; khi sidebar đóng vẫn giữ điểm nhận diện phù hợp trên thanh đầu. Không thay đổi App Shell toàn hệ thống chỉ để giải quyết trang Thư viện.
- **Laptop:** phân nhóm đọc nhạc (tông, bộ hợp âm, Sheet/Lời), thao tác bài (trước/sau), chế độ và Công cụ; ưu tiên chiều rộng theo không gian thực của phần nội dung khi sidebar mở. Cỡ chữ điều khiển gọn và đọc được, không giảm cỡ chữ bản nhạc hoặc lời chỉ để nhét toolbar.

## 4. Thứ tự triển khai

### R7-0 — Chốt nền R6 và đo hiện trạng (S)

**Việc làm:** Xác nhận R6 đã merge hay chọn commit/nơi làm việc cụ thể; lưu ảnh và kích thước thực của toolbar, HUD, logo/sidebar, vùng đọc, console. Kiểm tra 320, 360, 390, 430, 820, 1366, 1440 px; portrait/landscape, zoom 100% và 125% trên laptop; Sheet/Lời, sidebar mở/đóng, tối/sáng. Ghi ma trận hành động với khách và quyền soạn trên fixture cô lập.

**Nghiệm thu:** Có báo cáo baseline kèm screenshot, DOM geometry, lối vào từng hành động và lỗi tái hiện; ghi rõ bản code/URL/browser. Không ghi DB hoặc storage thật.

**Phụ thuộc:** R6 được đối chiếu; chưa cần merge để lập baseline. **File dự kiến:** tài liệu bằng chứng, E2E khảo sát (≤2). **Skills:** `browser-testing-with-devtools`, `debugging-and-error-recovery`, `planning-and-task-breakdown`.

### R7-1 — Thanh công cụ điện thoại rõ và ổn định (M)

**Việc làm:** Sắp lại thanh trên/dưới, nhãn dạng xem, tông và chỗ mở Công cụ. Chọn cách trình bày Sheet/Lời sau khi thử trên 320–430 px. Đồng bộ trạng thái/`aria-label` của các nút khi đổi bài, đổi tông, đổi bộ hợp âm. Tránh thanh dưới che câu cuối và chú ý safe area/bàn phím ảo.

**Nghiệm thu:** Test RED → PASS cho các đường `−/+/gốc`, Sheet ↔ Lời, bộ hợp âm, Công cụ, mở bài và toàn màn hình; không có nút tràn hoặc vùng bấm giao nhau ở 320/360/390/430 px; các mục chính ≤2 chạm, vùng chạm mục tiêu ≥44×44 px.

**Phụ thuộc:** R7-0. **File dự kiến:** `includes/toolbar.php`, `assets/js/mobile-controller.js`, `assets/css/library-polish.css`, E2E riêng (≤4). **Skills:** `frontend-ui-engineering`, `test-driven-development`, `browser-testing-with-devtools`.

### R7-2 — Giữ điều khiển cần thiết trong toàn màn hình (M)

**Việc làm:** Bổ sung vào HUD cách đổi Sheet/Lời và trạng thái tương ứng; giữ dịch tông, gọi HUD, thoát và đường vào bộ hợp âm/Công cụ. Điều chỉnh bố cục HUD theo chiều rộng thật, ưu tiên vùng chạm 44 px, kể cả khi hiện dải phân đoạn. Không để các nút 30 px như hiện trạng.

**Nghiệm thu:** Trên 320–430 px có thể đổi dạng xem và tăng/giảm tông **không rời toàn màn hình**, gọi lại HUD sau khi tự ẩn, thoát bằng nút/Esc và khi browser tự thoát; 0 vùng bấm chồng nhau và không che nội dung đọc quan trọng. Test cả Fullscreen API thành công/thất bại.

**Phụ thuộc:** R7-1. **File dự kiến:** `includes/sheet_viewer.php`, `assets/js/core/ModeManager.js`, `assets/css/library-polish.css`, E2E riêng (≤4). **Skills:** `debugging-and-error-recovery`, `frontend-ui-engineering`, `test-driven-development`.

### R7-3 — Logo và danh sách bài ở nav trái (S)

**Việc làm:** Bỏ quy tắc ẩn logo sidebar trên laptop, tổ chức lại logo/bộ đếm/nút tài khoản/nút đóng trong đầu sidebar. Thu gọn hoặc ẩn logo App Shell **theo ngữ cảnh Thư viện** để tránh lặp, giữ đường về Thư viện và các tab chính. Kiểm tra mở sidebar từ chế độ đọc và từ HUD nếu được phép trong chế độ đó.

**Nghiệm thu:** Logo nằm trong sidebar chọn bài và nhìn thấy ở 390/820/1366/1440 px khi mở; không có logo kép trên cùng màn hình; sidebar đóng/mở, tìm bài, lọc, chọn bài và điều hướng các trụ cột vẫn hoạt động; focus trả về nút mở sau khi đóng.

**Phụ thuộc:** R7-0; có thể làm sau R7-2 để giảm xung đột CSS. **File dự kiến:** `includes/sidebar.php`, `assets/css/library-polish.css`, có thể `assets/css/app-shell.css` theo cấu trúc thực, E2E riêng (≤4). **Skills:** `frontend-ui-engineering`, `browser-testing-with-devtools`, `test-driven-development`.

### R7-4 — Vùng đọc và lớp phủ trên điện thoại (M)

**Việc làm:** Kiểm tra tỉ lệ sheet/lời, khoảng lề và cỡ chữ; vị trí toast, menu Công cụ, sidebar, dải phân đoạn và HUD ở màn hình ngắn/có notch. Chỉ sửa các điểm gây che nội dung hoặc thao tác khó; giữ zoom/pan của bản nhạc. Thử dòng lời dài và sheet nhiều trang.

**Nghiệm thu:** 320×568, 360×800, 390×844, 430×932 không bị cuộn ngang ngoài vùng sheet chủ ý; câu cuối và nút điều khiển không bị thanh dưới/toast che; sau đổi Sheet/Lời, bài, tông hoặc xoay máy vẫn đọc được từ vị trí hợp lý. Ảnh trước/sau và E2E cho ca bị che.

**Phụ thuộc:** R7-1, R7-2. **File dự kiến:** `assets/css/layout.css`, `assets/css/library-polish.css`, tối đa một module UI theo lỗi thực tế, E2E riêng (≤4). **Skills:** `frontend-ui-engineering`, `debugging-and-error-recovery`, `browser-testing-with-devtools`.

### R7-5 — Toolbar và bố cục laptop (M)

**Việc làm:** Rà lại xung đột breakpoint và độ rộng thật khi sidebar mở/đóng. Cân chiều rộng tên bài, nhãn/icon, thứ tự ưu tiên và menu Công cụ; giữ font điều khiển nhỏ vừa, nút không lệch hàng. Dùng thay đổi CSS tối thiểu, hạn chế thêm `!important` mới.

**Nghiệm thu:** 820/1024/1366/1440/1920 px ở 100%, laptop 1366/1440 px ở zoom 125%: không tràn ngang, không mất đường vào tông, Sheet/Lời, toàn màn hình, bài trước/sau và Công cụ; menu không bị cắt; sheet đủ vùng đọc. Có ảnh so sánh sidebar mở/đóng.

**Phụ thuộc:** R7-3, R7-4. **File dự kiến:** `assets/css/layout.css`, `assets/css/library-polish.css`, E2E riêng (≤3). **Skills:** `frontend-ui-engineering`, `browser-testing-with-devtools`, `test-driven-development`.

### R7-6 — Trợ năng và hiệu năng có đo đạc (S)

**Việc làm:** Kiểm tra tên nút, trạng thái đang chọn, thứ tự Tab/focus, Escape, tương phản, target và thông báo đọc màn hình cho hai dạng xem và HUD. Đo thời gian mở bài, đổi Sheet/Lời, dịch tông và layout shift trên mẫu bài ngắn/dài trước khi tối ưu; chỉ sửa bottleneck được chứng minh.

**Nghiệm thu:** 0 lỗi axe serious/critical trong các trạng thái chính; điều hướng bàn phím và đọc tên chức năng rõ; số đo trước/sau được lưu nếu có sửa hiệu năng, không suy đoán cải thiện. Không làm chậm hoặc nhân đôi render khi đổi bài/chế độ.

**Phụ thuộc:** R7-1 đến R7-5. **File dự kiến:** E2E và tài liệu đo; file nguồn chỉ thêm theo nguyên nhân cụ thể, mỗi ticket con ≤5 file. **Skills:** `browser-testing-with-devtools`, `frontend-ui-engineering`, `performance-optimization` khi số đo cho thấy vấn đề.

### R7-7 — Hồi quy, nghiệm thu và bàn giao (S)

**Việc làm:** Chạy syntax/lint liên quan, PHP và E2E hiện có, hai browser Chromium/WebKit, rồi kiểm tra trực quan trên thiết bị hoặc giả lập iOS Safari/Android Chrome nếu sẵn có. Kiểm tra vai trò khách/Ban Hát/Admin/HD bằng dữ liệu thử cô lập; xác nhận không đổi quyền soạn và Core Rules. Ghi giới hạn kiểm thử và bằng chứng thô RED/PASS từng ticket.

**Nghiệm thu:** Toàn bộ tiêu chí R7-0…R7-6 có bằng chứng; không có regression mới được phát hiện ở Sheet/Lời, tông, bộ hợp âm, fullscreen, sidebar, setlist, offline và các trang App Shell khác. Các lỗi nền đã có phải được phân biệt với lỗi R7.

**Phụ thuộc:** R7-0 đến R7-6. **File dự kiến:** báo cáo triển khai, `PROJECT_REGISTRY.md` (≤2). **Skills:** `code-review-and-quality`, `test-driven-development`, `browser-testing-with-devtools`.

## 5. Quy trình và ranh giới

- Mỗi ticket chỉ bắt đầu khi ticket phụ thuộc đã có bằng chứng. Một người/AI thực thi; đề xuất nhánh `feature/roadmap7` **sau khi chốt nền R6**. Không trộn các thay đổi đang dở trên `main` vào R7.
- Theo `ROADMAP3.md` Phần 0: mỗi ticket tối đa khoảng 5 file; nếu vượt, tách nhỏ; test/E2E dùng DB và storage tạm; lưu output FAIL trước sửa và PASS sau sửa. Không dùng test tìm chuỗi source thay cho kiểm chứng hành vi.
- Không sửa Core Rules, bảng quyết định/chữ ký, quyền theo role, dữ liệu thật; không chạy `sync.bat`/`sync.sh`, không tự push/merge/deploy. Vấn đề ngoài phạm vi được ghi riêng để chủ dự án quyết định.
- `.superpowers/skills/using-superpowers/SKILL.md` không có trong bản khảo sát. Dùng các skill dự án đã có: `using-agent-skills`, `planning-and-task-breakdown`, `frontend-ui-engineering`, `browser-testing-with-devtools`, `debugging-and-error-recovery`, `test-driven-development`; `performance-optimization` chỉ sau khi có số đo. Khi triển khai, kiểm tra lại skill Superpowers nếu framework được bổ sung.

## 6. Thứ tự ưu tiên nghiệm thu

`R7-0 → R7-1 → R7-2 → R7-4 → R7-3 → R7-5 → R7-6 → R7-7`. Logo R7-3 có thể thực hiện ngay sau R7-0 nếu không chạm cùng CSS với các ticket đang chạy, nhưng vẫn nghiệm thu cùng ma trận điện thoại/laptop. Chủ dự án duyệt kết quả giao diện và quyết định merge sau khi có báo cáo R7-7; phần kế hoạch này không đánh dấu thay cho chủ dự án.

## 7. Phản hồi bổ sung sau khi triển khai

Chủ dự án yêu cầu thêm: tên bài ở nav trái nhỏ hơn và bài đang chọn có màu xanh; trên điện thoại thấy nút Soạn khi có quyền; khi tăng bài từ G một bán cung, hợp âm ở dạng Lời phải viết **Ab** như tông hiển thị. Đã đưa vào bản R7 và kiểm tra bằng hành vi trình duyệt; chi tiết cùng giới hạn nghiệm thu trong báo cáo triển khai. Với khách, nút Soạn vẫn ẩn theo quyền hiện hành.
