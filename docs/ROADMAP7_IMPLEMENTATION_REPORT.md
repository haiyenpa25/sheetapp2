# ROADMAP7 — Báo cáo triển khai Thư viện

Ngày: 2026-10-02. Trạng thái: mã R6/R7 đã được tích hợp vào cây làm việc `main` tại `C:\xampp\htdocs\sheetapp2` theo yêu cầu tiếp theo của chủ dự án. Các sửa đổi riêng trên `main` được giữ; chưa commit/push/deploy. Trang chính: `http://127.0.0.1/sheetapp2/?song=thanh-ca-002`. Worktree `feature/roadmap6` vẫn còn nguyên để đối chiếu.

## Thay đổi

| Phần | Kết quả |
|---|---|
| Điện thoại | Thanh dưới có tông `−/gốc/+`, bộ hợp âm, Sheet/Lời và toàn màn hình; nút 44 px, kể cả 320 px. Nhãn truy cập nói rõ trạng thái dạng xem. Khi có quyền, nút **Soạn** hiện trực tiếp trên thanh đầu; bấm từ dạng Lời sẽ về sheet rồi mở các điểm đặt hợp âm. Khách không thấy Soạn. |
| Toàn màn hình | HUD thêm Sheet/Lời, bộ hợp âm, Công cụ, dịch tông và thoát; các thao tác thường dùng có vùng chạm ít nhất 44 px. HUD tự ẩn sau 3 giây nhưng có nút **Điều khiển** để gọi lại. Dải phân đoạn đặt trên HUD và không chặn các nút. |
| Nav trái | Logo SheetApp hiện trong đầu danh sách bài; logo App Shell ẩn khi sidebar mở, trở lại khi đóng. Tên bài 12 px; bài đang đọc có nền, viền và vạch chọn màu xanh. Đóng sidebar bằng nút/overlay đưa focus về nút mở. |
| Vùng đọc | Bỏ thông báo info lặp lại lúc tải bài trên điện thoại vì tên/tông/bộ hợp âm đã có trên giao diện; lỗi và cảnh báo vẫn hiện. Sheet và khổ lời cuối cuộn lên trên thanh dưới. |
| Hợp âm Lời | Xác định cách viết thăng/giáng theo **tông đích** từ MusicXML và `KeyService` rồi truyền vào `TransposeEngine`. Với bài G tăng một bán cung, tông và hợp âm chữ cùng hiển thị **Ab**. Không đổi dữ liệu hợp âm gốc hoặc quy tắc HD/TLH. |
| Laptop | Kiểm tra toolbar ở 820/1024/1092/1366/1440/1920 CSS px; tông, Sheet/Lời, toàn màn hình, danh sách bài và Công cụ nằm trong viewport. 1092 CSS px dùng để kiểm tra bề rộng gần với laptop 1366 ở mức zoom 125%. |

## Bằng chứng RED → PASS

Lệnh E2E: `SHEETAPP_E2E_BASE_URL=http://127.0.0.1:8766/ playwright test e2e/library-r7-responsive.spec.js --project=chromium --project=webkit`. Test dùng snapshot và khôi phục DB/storage qua `e2e/global-setup.js` và `global-teardown.js`.

| Lỗi tái hiện trước sửa | Output RED | Output sau sửa |
|---|---|---|
| Thanh dưới tràn ở 320 px | `btn-mobile-gig Expected <= 320; Received 343.515625` | Nút trong viewport; test Chromium/WebKit PASS |
| HUD thiếu đổi dạng xem | `#btn-gig-view-toggle element(s) not found` | Đổi Sheet/Lời trong fullscreen PASS |
| Dải phân đoạn chặn HUD | `section-jump-bar-container ... intercepts pointer events` | HUD bấm được, dải không chồng ở 320 px PASS |
| Logo bị ẩn trên laptop | `.sidebar-header .logo-text Received: hidden` | Logo hiện trong sidebar 1366 px PASS |
| Focus khi đóng sidebar | `#btn-open-sidebar Expected: focused; Received: inactive` | Focus trở về nút mở PASS |
| Toast tải bài che nhạc điện thoại | `Expected: 0; Received: 1` info toast | 0 info toast lặp; các toast cảnh báo/lỗi không bị đổi PASS |
| Tên bài và bài đang chọn | `fontSize Expected <= 12.5; Received 13` | 12 px, nền/vạch xanh PASS |
| Admin thiếu nút Soạn trên điện thoại | `#btn-mobile-edit element(s) not found` | Admin và chủ HD thấy nút, vào mode soạn và thấy nút đặt hợp âm trên nốt PASS; khách không thấy |
| G +1 ở dạng Lời cho hợp âm G# | `expected chord Ab: false` trong khi tông đã Ab | Hợp âm `Ab`, không còn `G#` ở trường hợp bài G +1 PASS |

Kết quả cuối: **44/44 E2E ROADMAP7 PASS** trên Chromium và WebKit. Trước phản hồi bổ sung của chủ dự án, **48/48 E2E** cho R7 cùng các bài cũ `library-l1-mobile-view`, `library-r1-2-laptop-toolbar`, `library-r1-5-tools-menu` PASS. **8/8 E2E** đường vào Soạn và điểm đặt hợp âm của Admin/HD từ ROADMAP6 PASS. Axe trên thanh điều khiển đọc và HUD: 0 lỗi serious/critical trong cả hai browser. `php -l` hai partial sửa, `node --check` và ESLint các JS sửa, `git diff --check` đều PASS.

Sau tích hợp trên `main`: chạy `library-r7-responsive.spec.js`, `library-r6-interactions.spec.js`, `library-r1-4-section-jump-bar.spec.js` với `SHEETAPP_E2E_BASE_URL=http://127.0.0.1/sheetapp2/`; **122/122 PASS** trên Chromium và WebKit (3,2 phút). Global setup/teardown xác nhận khôi phục DB/storage từ snapshot. `php -l` hai partial và kiểm tra cú pháp **280 file JavaScript** PASS. Bản gốc các file được chép đè trước tích hợp lưu ở `C:\xampp\htdocs\sheetapp2-integration-backup-20261002`.

Ảnh kiểm tra: [điện thoại 320 px](roadmap7/r7-phone-320.png), [toàn màn hình 320 px](roadmap7/r7-fullscreen-320.png), [Admin thấy Soạn](roadmap7/r7-admin-phone-toolbar.png), [bài đang chọn màu xanh](roadmap7/r7-selected-song-blue.png).

## Cổng PHP và dữ liệu thử

Trên worktree R6 trước tích hợp, `php tests/run_all_tests.php` có 12 suite FAIL vì dữ liệu/test nền của worktree đó. Sau tích hợp trên `main`, lần chạy đầu còn hai bài lỗi vì `arrangement-engine.js` vượt ngân sách 600 dòng (608 dòng). Đã rút gọn hàm mới xuống 599 dòng mà giữ hành vi; hai bài đó đạt. Lần chạy cuối: **164 suite, 3205 checks PASS, 0 FAIL**, lint **319 file PHP** và syntax JavaScript PASS. Runner xác nhận DB/storage thật toàn vẹn; số bản ghi và **62 file chord set** trước/sau kiểm thử giống nhau. Hai bài PHP về quy tắc tông (`library_l011_key_service_regression.php` 6/6, `library_l011_key_enharmonics_regression.php` 16/16) cũng PASS. Output đầy đủ lưu trong bản sao lưu tích hợp tại `php-full-gate.log`.

Một test cũ `liturgical_export_and_usage_regression.php` chạy riêng đã tạo setlist thử ID 182 rồi thoát sớm. Đã sao lưu chính bản ghi đó và hai dòng liên quan dưới `test-results/r7_test_setlist_182_backup.json`, xoá có điều kiện trong transaction; sau dọn: `PRAGMA integrity_check = ok`, `setlists = 0`, `song_usage_history = 0` như trước kiểm thử. Không chạy riêng test đó lần nữa trên DB thật.

## Giới hạn nghiệm thu

- Mã R6/R7 đang có trên cây làm việc `main` tại `127.0.0.1/sheetapp2`; chưa commit, push, sync hoặc deploy ra môi trường khác.
- Chưa thử trên thiết bị iPhone/Android vật lý. WebKit và Chromium tự động đã qua; safe area và cảm giác chạm thực tế cần xem thêm khi chủ dự án nghiệm thu.
- Cổng PHP tổng hợp và E2E đã xanh trên `main`; không đánh dấu các việc cần quyết định của chủ dự án.
