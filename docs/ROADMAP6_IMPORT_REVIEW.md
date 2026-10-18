# TV0-8 — Phần nhập MusicXML cần xử lý thống nhất

Ngày 2026-10-18. Chỉ đọc mã; chưa thử kết nối tới dịch vụ bên ngoài.

Baseline `3b5fb69` đã đưa ImportService về `storage/users/<user>/imported/`,
nhưng `_generateFilename()` và `_extractXmlFromScript()` vẫn tham chiếu `SHEETS_DIR`
không còn được định nghĩa. Hai nhánh nhập từ script vẫn ghi `storage/sheets/`.
Ngoài ra `.htaccess` chặn mọi file dưới `storage/users`, kể cả file vừa nhập.

Phát hiện thêm trong `api/import_scrapers.php::_guessHttlvnXmlUrl()`:
nhánh dò link dùng trực tiếp `get_headers()` thay vì `_fetchUrl()`.
Vì vậy nhánh này không đi qua kiểm tra URL public, giới hạn redirect và DNS pinning
đang có trong bộ tải chính. Đây là một nhánh bảo mật chưa nêu riêng trong ROADMAP6.

Đề xuất phạm vi bản sửa, không đổi quyền vai trò:

1. Dò URL bằng cùng bộ tải có kiểm tra an toàn; chặn đích nội bộ/redirect ra nội bộ.
2. Hàm trích XML trong script chỉ trả dữ liệu, không ghi file hoặc tạo đường dẫn.
3. Tất cả kiểu nhập dùng một đường ghi vào thư mục quản lý đã `realpath` thành công;
   tạo tên file không trùng trong chính thư mục đó, đồng bộ FTS và xóa cache.
4. Chỉ mở đọc file MusicXML trong thư mục `users/<user>/imported`, không mở toàn bộ
   thư mục người dùng; kiểm tra HTTP xác nhận file khác vẫn bị chặn.
5. Test HTTP trên bản sao Apache: upload hai file cùng tên không ghi đè;
   có thể tải lại XML, tìm theo lời ngay và xuất hiện trong danh sách.

Theo ROADMAP3 Phần 0 mục 10, phát hiện nhánh bảo mật mới phải hỏi trước khi sửa.
Tạm giữ TV0-8 chờ xác nhận cho phạm vi trên; không tính là đã hoàn tất.
