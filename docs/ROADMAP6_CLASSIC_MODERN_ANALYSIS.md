# ROADMAP6 — Classic và Hiện đại là hai chế độ chính thức

Ngày: 2026-10-18. Đầu vào: chỉ đạo chủ dự án trong phiên triển khai ROADMAP6.

## Phạm vi đã điều chỉnh

Chủ dự án yêu cầu giữ và đổi mới cả `/old/` (Classic) lẫn `/` (Hiện đại),
đồng thời cho phép người thực thi đề xuất tối ưu và phân bổ công việc dữ liệu vào quản trị.
Không áp dụng đề xuất đóng băng/gỡ Classic trong roadmap ban đầu.
Bảng quyết định và chữ ký của chủ dự án trong ROADMAP6 được giữ nguyên.

Hai chế độ phải có cùng kết quả nghiệp vụ, quyền truy cập và độ an toàn.
Không cần cùng bố cục hoặc tải tất cả tính năng ngay khi mở trang.
Classic giữ danh sách gọn, dải danh mục phẳng, lọc tông và Ghim nhanh.
Hiện đại giữ toolbar thích ứng, chế độ sân khấu và thanh thao tác điện thoại.

## Phân tích mã hiện tại

| Vùng | Hiện đại | Classic | Hướng thực hiện |
|---|---|---|---|
| Danh sách | `assets/js/library-ui.js`, ảo hóa >35 bài | `old/assets/js/library-ui.js`, ảo hóa >120 bài, dòng gán cứng 26px | Dùng chung xử lý chạm và hợp đồng dữ liệu; kiểm tra riêng chiều cao DOM của mỗi bố cục |
| Tìm kiếm | Gọi API, có lọc lại phía client | Chủ yếu lọc bộ nhớ; phụ thuộc OfflineVault cho tìm bỏ dấu | Dùng chung chuẩn hóa, ngữ nghĩa tìm tên/lời, phân trang và bộ lọc; so tập ID kết quả ở hai chế độ |
| Chạm | Đã bỏ touchstart nhưng thiếu thời hạn/hủy chạm | Cùng thiếu sót, thêm Ghim nhanh | Một bộ nhận diện chạm thật dùng chung, kiểm thử cả hai |
| Tải bài | Có SongLoaderCore và chống kết quả cũ | Loader riêng chưa có token chống tải chồng | Dùng cùng quy tắc hủy/kết quả mới nhất; giữ hook trình bày riêng |
| Chuyển chế độ | Liên kết chỉ giữ song | Liên kết chỉ giữ song | Giữ song/t/set/v, ghi nhớ lựa chọn; tên công khai Classic/Hiện đại |
| Ngoại tuyến | Có SW nhưng precache thiếu | SW hiện loại `/old/` | Hai shell cache riêng trong cùng phạm vi, kho bài chung; thử mở cả hai khi mất mạng |
| Trợ năng/cảm ứng | Có điều khiển thiếu nhãn/kích thước | Bố cục dày, nhiều nút nhỏ | Trên cảm ứng nâng vùng chạm lên 44px; desktop vẫn có thể giữ mật độ Classic |
| API/bảo mật | Dùng backend chung | Dùng backend chung | Mọi bản sửa API phải có test hợp đồng áp dụng cho cả hai |

## Thứ tự triển khai lại

1. Hạ tầng test thành phần không dùng máy chủ và không chạy setup/teardown ghi storage thật.
2. TV0-1 thành hai lát cắt ≤5 file mã/test: Hiện đại trước, sau đó Classic dùng cùng module.
   Cập nhật đăng ký/precache riêng để module mới không làm mất khả năng tải ngoại tuyến.
3. TV0-2 đo danh sách thật ở cả hai chế độ; kiểm tra đủ 1.731 bài, chọn bài 800 và đổi hướng màn hình.
4. TV0-3 đến TV0-8: tái hiện và sửa theo ticket; yêu cầu giao diện được kiểm ở cả hai shell.
5. TV1: thống nhất tìm kiếm, phân trang, bàn phím; giữ lọc tông/Ghim nhanh Classic.
6. TV4: backend chung, lưu ý mọi thay đổi quyền/ghi dữ liệu vẫn tuân luật duyệt của ROADMAP3.
7. TV2: đo riêng ngân sách hai chế độ; tính cả script tải động, KB và request, không chỉ thẻ script ban đầu.
8. TV3 và TV6: nâng cả hai giao diện; TV6 không còn là kế hoạch đóng băng/gỡ Classic.
9. TV5: chuẩn bị báo cáo dry-run và luồng quản trị; không tự sinh tempo/HD hoặc xác nhận dữ liệu nhạc chưa có nguồn.
10. TV7: nghiệm thu chéo chế độ, trình duyệt, vai trò và thiết bị. Không đánh dấu kiểm thiết bị thật từ mô phỏng.

## Đề xuất tối ưu (chưa phải quyết định điền thay chủ dự án)

- Trước/sau đi theo danh sách đang hiển thị; khi phát chương trình thì theo chương trình.
- Tập chưa có số chính thức: không tự gán số vào DB; hiển thị tên tập và tìm theo tên,
  có thể bổ sung số catalog qua quản trị sau khi xác nhận nguồn.
- Bài trùng tên giữ nguyên, phân biệt bằng tập; xuất từng nhóm để người phụ trách rà.
- Bản nhạc sinh tự động vẫn xuất hiện, có huy hiệu nguồn rõ ràng.
- Quản trị phục vụ kiểm duyệt nguồn bản nhạc, HD, tempo, nhãn và phân đoạn;
  cập nhật hàng loạt có xem trước thay đổi và kết quả xác minh.
- Mục tiêu thử nghiệm: ≤40 JS, ≤60 request, ≤1.500 KB, hiện nhạc ≤2,5 giây trên 4G giả lập;
  chỉ công nhận khi đo được trên cả hai chế độ, không sửa ngưỡng để làm test xanh.

## Bằng chứng và giới hạn

Log hiện lưu trong `test-results/roadmap6-evidence/`; trạng thái từng ticket ghi ở
`docs/ROADMAP6_LIBRARY_ACCEPTANCE_REPORT.md`. Test thành phần dùng mã JS thật trong
trình duyệt với dữ liệu giả, không thay thế nghiệm thu toàn trang/API hay thiết bị thật.
WebKit hiện lỗi khởi tạo trang trên máy Windows; phải báo chưa kiểm được, không tính PASS.
