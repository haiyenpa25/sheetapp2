# ROADMAP6 — Báo cáo thực thi kỹ thuật

Ngày: 2026-10-01 · Nhánh: `feature/roadmap6` · Worktree: `C:\xampp\htdocs\sheetapp2-roadmap6`

## Phần đã triển khai

| Ticket | Kết quả |
| --- | --- |
| R6-0 | Chạy baseline trên máy chủ PHP và bản sao DB/storage riêng; sửa kỳ vọng E2E cũ về quyền khách và nhãn Fullscreen. |
| R6-1 | Ẩn đúng hai lệnh soạn hợp âm trong menu Công cụ với khách; Admin và HD vào chế độ soạn thực sự. Sửa lệnh tạo bộ hợp âm mới trỏ tới hàm có thật. |
| R6-2 | Ngăn nút “Bộ hợp âm mới” ghi mảng rỗng đè bộ cá nhân/HD đã tồn tại. Admin được sửa trực tiếp HD. Kiểm tra lưu hợp âm HD và ADMIN, đọc lại sau reload; 403 và 409 hiển thị trạng thái lỗi/xung đột, không báo đã lưu. |
| R6-3 | Chuẩn hóa SVG trong nút Fullscreen khi đổi chế độ; icon toolbar 16–18px; giữ nút soạn ẩn theo quyền kể cả toolbar compact. Nút thanh dưới điện thoại tối thiểu 44px. |
| R6-4 | Đồng bộ chế độ với `fullscreenchange`, Esc, API bị từ chối/không hỗ trợ. Dải phân đoạn đặt nổi trên HUD và ẩn cùng HUD, theo phương án đã nêu trong kế hoạch. Tải phân đoạn khi vào Fullscreen. |
| R6-5 | Toast chuyển xuống vùng dưới, chỉ một thông báo tại một thời điểm, lỗi được ưu tiên, có nút đóng và vai trò hỗ trợ đọc màn hình. Thông báo thông thường không phủ màn biểu diễn. |
| R6-6 | Kiểm tra 360/390/820/1366/1440px không tràn ngang; menu mobile cuộn và đóng bằng Esc; cập nhật bài test cũ theo nhãn của chế độ hiện hành. |
| R6-7 | Chạy các kiểm tra dưới đây và sửa tham chiếu `KeyService` để ESLint toàn dự án sạch. WebKit đã chạy lại được; sửa thêm chọn khuông gần nốt nhất khi nút Soạn trên mobile bị lệch. Chủ dự án cần xem UI trước khi merge. |

## Kiểm thử

- E2E Chromium: đợt mở rộng 76/76 PASS trên R6, toolbar, mobile, phân đoạn, Fullscreen, chế độ Band và accessibility sáng/tối. Bài smoke mobile cho đọc, Công cụ và Fullscreen không có `pageerror`.
- PHP: `chord_edit_permission_and_flow_regression.php` 10/10, `hd_history_and_permission_regression.php` 14/14, `chord_sets_consolidation_regression.php` 32/32 PASS. Các bài PHP này cần `tests/fixtures/test_db_fixture.php`, hiện là file local chưa được theo dõi trong worktree gốc; đã sao chép vào worktree thử để chạy và không đưa vào thay đổi ROADMAP6.
- Cú pháp JS: 279 file PASS. ESLint toàn dự án PASS sau khi sửa hai tham chiếu `KeyService` chưa khai báo trong `assets/js/chord-canvas-transpose.js`.
- Bộ PHP tổng hợp sau khi sửa các kiểm tra bị tác động bởi ROADMAP6: 155/163 nhóm PASS, 10 nhóm FAIL (3.185 checks PASS, 10 FAIL). Sáu nhóm giữ kỳ vọng 62 file `chord_sets` trong khi bản dữ liệu thử hiện có 60; bốn nhóm còn lại thuộc API 401/403, LiveSync SSE, tra bài bằng số và quyền cập nhật tempo. Chi tiết ở `test-results/roadmap6-php-suite-final.log`. Những lỗi này không nằm trong luồng UI ROADMAP6 và chưa được sửa trong nhánh này.
- WebKit: phiên chạy lại đã khởi động được. Bộ R6 mới nhất đạt 38/38 PASS trên desktop/mobile; lỗi căn nút tím ở ba ca mobile được tái hiện RED rồi sửa bằng chọn khuông gần nốt gốc nhất, sau đó 12/12 ca vị trí trên Chromium/WebKit và toàn bộ R6 trên hai trình duyệt đạt 76/76.

Ảnh kiểm tra: `test-results/r6-admin-edit.png`, `test-results/r6-admin-mobile-edit.png`, `test-results/r6-lyrics-1366.png` và `test-results/r6-lyrics-390.png` trong worktree thử. E2E dùng máy chủ `127.0.0.1:8766` và bản sao DB/storage; không chạy `sync` hoặc push.

## Bàn giao

Các thay đổi đang ở worktree và chưa merge. Chủ dự án xem UI thật, xác nhận cách hiện dải phân đoạn cùng HUD, rồi quyết định merge. Không đánh dấu ô duyệt hoặc chữ ký của chủ dự án.

## Rà soát bổ sung 2026-10-02: nút tím Soạn hợp âm

Lỗi thực tế trên `localhost/sheetapp2`: Admin bấm Soạn trên bộ HD nhưng `ChordCanvas.isAddMode()` vẫn `false`. Điều kiện xác nhận sao chép dành cho người không sở hữu HD đã chặn cả Admin. Đã sửa điều kiện này trong bản chạy chính; E2E tái hiện FAIL trước sửa và PASS sau sửa.

Lỗi căn chỉnh thứ hai nằm ở `chord-canvas-dots.js`: thuật toán gom khuông theo khoảng cách 150px gộp nhiều khuông, kéo các nút tím của những dòng dưới lên hàng đầu. Thuật toán nay nhóm theo 40px và dùng tọa độ nốt gốc để chọn đúng khuông. Khi cuộn, tọa độ nốt được đo lại và các khuông ngoài viewport vẫn tham gia căn chỉnh. Trong chế độ Soạn, dải phân đoạn và toast thông thường không chắn nút bấm. Đã áp dụng bản sửa tối thiểu vào `main` đang chạy, đồng thời đưa cùng sửa đổi vào `feature/roadmap6`.

Kiểm thử bổ sung: bấm nút tím và mở popup trên desktop/mobile, giữ vị trí sau cuộn, và đo khoảng cách nút với nốt ở 360/390/820/1366px cùng bài 001/002/123. Các ca này PASS trên bản `localhost/sheetapp2`. Bộ R6 đạt 31/31; chín ca hồi quy cũ về bảng hợp âm mobile, hiển thị bộ đang soạn, chống va chạm và dải phân đoạn đạt 9/9. Kiểm tra ESLint, cú pháp JavaScript và kiến trúc module đạt.

## Rà soát giao diện 2026-10-02: cỡ chữ bản nhạc

Ảnh người dùng gửi từ `127.0.0.1:8766` có mọi phần giao diện lớn hơn bản chụp Chromium ở 100% xấp xỉ 1,25 lần (sidebar khoảng 313px so với CSS 256px), phù hợp với mức phóng đại trình duyệt khoảng 125%. Bản nhạc của bài 002 trước chỉnh có lời 20px ở desktop, 20px ở mobile theo đơn vị SVG; đã chỉnh OSMD `LyricsHeight` thành 1,8 (18px) trên màn hình rộng hơn 680px, giữ 2,0 (20px) ở điện thoại. Không đổi cỡ chữ chế độ Lời & Hợp âm phục vụ biểu diễn. Người dùng có thể đưa Chrome về 100% bằng Ctrl+0 nếu toàn bộ trình duyệt vẫn lớn.

Đã kiểm tra ảnh thật bài 002 ở 1900/1366/820/390px: không tràn ngang, các nút tím bám theo từng khuông, không có `pageerror`. Bộ E2E Chromium gồm R6, chế độ Band và hợp âm không va chạm đạt 42/42 sau thay đổi; kiểm thử cỡ chữ mới có RED trước sửa và PASS sau sửa.

## Nghiệm thu bổ sung 2026-10-02

- Xác nhận vai trò Ban Hát đang xem HD phải chọn sửa bộ riêng BH; Admin và chủ HD vào soạn trực tiếp. Sửa bài E2E cũ dùng ID hộp thoại không tồn tại để kiểm tra dialog thật.
- Đo toast lỗi không chạm khuông đầu tại 1366/820/390px. Ba ca PASS.
- Sửa ba bộ E2E cũ dùng cookie cố định `localhost` để chạy đúng trên máy chủ nhánh `127.0.0.1`; cập nhật kỳ vọng quyền khách và bỏ dòng menu bị ẩn khỏi phép đo vùng chạm. Đợt Chromium mở rộng đạt 76/76.
- Đợt WebKit đầu có 35/38 PASS; ba lỗi nút tím bị gán sang khuông kế tiếp trên mobile đã được sửa. Đợt R6 cuối trên Chromium và WebKit đạt 76/76.
- Quality gate PHP tổng hợp vẫn 155 nhóm PASS, 10 FAIL với cùng nguyên nhân nền đã liệt kê ở trên; kiểm tra toàn vẹn DB xác nhận dữ liệu thử không rò sang bản thật. ESLint và cú pháp 279 file JavaScript PASS.
