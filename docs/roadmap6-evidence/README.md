# Bằng chứng tiêu biểu ROADMAP6

Các file FAIL ghi kết quả trước khi sửa; PASS ghi lượt kiểm lại tương ứng.
Đây là output kiểm thử trên SQLite memory hoặc bản sao Apache có DB/storage riêng.
Tên thư mục Windows, mã bài và ID fixture trong log không phải thông tin đăng nhập.

Nguồn đầy đủ tại `test-results/roadmap6-evidence/` trên máy thực thi. Thư mục đó bị
Git ignore; bản chọn lọc này chuyển sang UTF-8 và bỏ khoảng trắng cuối dòng để duyệt
trực tiếp trên GitHub. Log gốc được giữ nguyên, không sửa kết quả/kỳ vọng/số đo. Xem
[biên bản nghiệm thu](../ROADMAP6_LIBRARY_ACCEPTANCE_REPORT.md) cho kết quả tổng hợp,
lượt bị loại và các giới hạn.

Lệnh tái hiện:

```powershell
# SHEETAPP_TEST_URL / SHEETAPP_TV_TEST_URL phải trỏ bản sao cách ly,
# SHEETAPP_TV_ISOLATED_ROOT phải là root có marker .roadmap6-isolated.
# Không chạy PHP gate và E2E ghi dữ liệu đồng thời trên cùng bản sao.
php tests/run_all_tests.php
npx playwright test -c e2e/roadmap6.config.js --project=chromium
```

PHP gate chạy từ root bản sao để các test cũ cũng không đụng storage nguồn.
Test HTTP thiếu biến môi trường sẽ SKIP, không được tính là đã nghiệm thu HTTP.
Không chạy các script sync, seed/migration hoặc công cụ sửa nhãn trên dữ liệu thật.
