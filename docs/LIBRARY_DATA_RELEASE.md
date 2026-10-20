# Phát hành source và dữ liệu thư viện

Ngày: 2026-10-20. Theo yêu cầu trực tiếp của chủ dự án: xuất bản lên `main`, bao gồm CSDL và storage cần để chạy thư viện. Chủ dự án đã chọn **CSDL phát hành sạch dữ liệu cá nhân**, vì repository GitHub đang công khai.

## Nội dung bản phát hành

| Danh mục | Bài |
|---|---:|
| Thánh ca | 903 |
| Tôn Vinh Chúa Hằng Hữu | 387 |
| Biệt Thánh Ca | 206 |
| Ca Khúc Chúc Tôn | 105 |
| Kinh Thánh Đối Đáp | 100 |
| NS Trương Văn Xê | 28 |
| Hillsongs - Worship | 2 |
| Tổng | 1.731 |

- `storage/Thanh ca/`: đủ 1.731 MusicXML, gồm 828 file trước đây chưa được theo dõi trong Git.
- `storage/seed/library.sqlite`: CSDL SQLite chứa lược đồ và 16 migration đã áp dụng, 7 danh mục, 1.731 bài, 1.737 bộ hợp âm công khai, 388 đoạn nhạc, bản phối và phiên bản công khai. Manifest cạnh file chứa SHA256 và số đếm được truy vấn từ DB.
- `storage/data/chord_sets/`, `storage/data/annotations/`: các JSON hợp âm/nhạc cụ/ghi chú hiện có; không đưa file khóa vào Git. Các snapshot JSON cũ vẫn giữ để tương thích bộ test hiện tại; dữ liệu hợp âm chính nằm trong SQLite.
- `storage/users/admin/thanh-ca-001/v1_ban-chuyen-soan-4-be-satb-demo.xml`: file phiên bản được CSDL tham chiếu. Không đưa `.bak` vào bản phát hành.
- `storage/config/features.json` và quy tắc bảo vệ storage.

DB đang chạy `storage/data/app.sqlite`, WAL/SHM, khóa, cache/manifest sinh lại, log, các bản backup, phòng live sync, upload OMR tạm và dữ liệu tenant vẫn bị ignore. Đây là trạng thái vận hành cá nhân hoặc dữ liệu sinh lại, không phải thành phần cần để clone và chạy thư viện. Không công khai bản sao SQLite gốc qua Git.

## Quyền riêng tư

Export dùng kết nối read-only và SQLite backup để chụp dữ liệu nhất quán. Năm tài khoản nguồn được thay bằng contributor ẩn danh, role viewer, trạng thái inactive và hash sentinel `!` không đăng nhập được. Tên đăng nhập/email/profile, mật khẩu cũ, thông báo, lịch sử luyện tập, workspace OMR và hoạt động cá nhân không nằm trong seed. Gỡ các chuỗi đã xóa khỏi trang trống SQLite bằng secure-delete/VACUUM; kiểm tra cả byte thô để phát hiện hash mật khẩu/email còn sót. Giữ ID contributor để bảo toàn khóa ngoại của các bản phối công khai.

Script từ chối xuất nếu có bài hoặc bản phối private cần rà soát riêng. DB gốc không bị đổi; SHA256 sau kiểm thử vẫn `A91268B27DF548845C67B8F375C2D13B5899FFA4716BA99A00D59E4BC157CAC9`.

## Cài mới

```bash
php tools/install_library.php
```

Chạy bằng PHP CLI trong source đã clone, không chạy qua URL. Lệnh tạo `storage/data/app.sqlite` từ seed, tạo admin mới và in mật khẩu ngẫu nhiên một lần; lưu mật khẩu tại nơi riêng. Có thể dùng `--admin=<username>` và `--password-stdin` để nhập mật khẩu qua stdin. Không truyền mật khẩu bằng tham số dòng lệnh.

Cài đặt kiểm tra SHA256, integrity, khóa ngoại; từ chối ghi đè DB đã tồn tại, kể cả khi có hai tiến trình cài cùng lúc. Apache phải hỗ trợ `.htaccess` và rewrite. Trên Nginx phải chặn storage riêng tư tương đương. Cho PHP quyền ghi storage, không cấp quyền `777` toàn cây. Không cần Node/Python để phục vụ ứng dụng PHP; Python chỉ dùng khi xuất bản seed mới.

## Server đang có DB

Sao lưu toàn bộ storage trước khi cập nhật source. Git có thể từ chối pull khi file local chưa được theo dõi trùng file mới trong bản phát hành: giữ bản sao riêng và đối chiếu thay vì ép ghi đè. Sau khi cập nhật source, chạy:

```bash
php tools/update_library.php --apply
```

Lệnh tạo bản SQLite nhất quán cạnh DB, tên `app.sqlite.before-library-<thời gian>-<mã>.sqlite`. Toàn bộ nhập nằm trong transaction; lỗi sẽ rollback. Thêm các danh mục/bài/bộ hợp âm/phiên bản/đoạn/bản phối còn thiếu; map ID danh mục, section và người sở hữu theo DB đích; đồng bộ FTS cho bài mới. Các bài có sẵn được cập nhật phân loại theo danh mục phát hành; tiêu đề và nội dung bài hiện có giữ nguyên. Bộ hợp âm trùng bài/tên set giữ nguyên, không ghi đè bản phối đang dùng. Không đổi mật khẩu, tài khoản hoặc chương trình của server.

Lệnh có thể chạy lại mà không nhân đôi hợp âm hay tài khoản contributor. CSDL cần có lược đồ phiên bản hiện hành; nếu thiếu cột/migration, kiểm tra migration trên bản sao trước. Không thay DB hiện tại bằng seed và không tự chạy migration trên DB thật khi chưa có backup.

## Xuất lại seed

```bash
python tools/export_library_seed.py --output=/path/to/review/library.sqlite
```

Thư mục đích mới nằm ngoài webroot/Git. Script từ chối đè file đã tồn tại và tạo `library.manifest.json` cạnh DB. Rà soát bản xuất, thay cặp seed/manifest sau khi kiểm thử quyền riêng tư và clone sạch. Không force-add `storage/data/app.sqlite`. Các thay đổi nhạc/ghi chú trên một server không tự được push vào Git.

## Kiểm thử và giới hạn

Ca thử sử dụng bản cài riêng có marker `.roadmap6-isolated`; không chạy test ghi lên DB/storage thật. Kiểm tra tất cả đường dẫn MusicXML trong seed, cài admin mới, từ chối ghi đè, cập nhật từ thư viện thiếu các nhóm bổ sung và giữ nguyên dữ liệu server. Kiểm tra trình duyệt truy vấn đủ danh mục, đọc sheet Biệt Thánh Ca cả hai giao diện, ghi/lưu màu và chuyển giao diện. Kiểm tra HTTP chặn tải trực tiếp DB và registry private.

`npm audit` ghi nhận 7 cảnh báo high hiện có trong `puppeteer-core` và cây phụ thuộc của nó (devDependencies); không có critical. Không thêm dependency hoặc tự nâng major trong đợt đóng gói dữ liệu này. Runtime PHP không dùng các gói Node này. Kết quả không xác nhận server production đã triển khai hay kiểm thử Safari/iPad phần cứng.
