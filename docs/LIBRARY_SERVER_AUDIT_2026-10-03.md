# Rà soát Thư viện trên server — 2026-10-03

## Lỗi đã tái hiện

- `GET api/index.php?route=songs&action=search&q=Chua` trả HTTP 500. Log LiteSpeed ghi `no such column: s.liturgical_season`.
- CSDL `storage/data/app.sqlite` đang có schema cũ (không có `schema_migrations`, `songs.liturgical_season`, `users.email`), trong khi mã hiện tại dùng các cột này. Danh sách 903 bài vẫn hiện vì được trả từ `songs_cache.json`.
- File `app.sqlite` thuộc `root:root`, mode `0644`; log LiteSpeed có `attempt to write a readonly database` khi mở kết nối. Điều này ảnh hưởng các API dùng DB và mọi thao tác ghi.
- Khi API đăng nhập trả 401, giao diện hiển thị sai thành “Lỗi mạng”.

## Sửa mã và kiểm chứng cô lập

- Migration 003 giờ tạo chỉ mục `learning_arrangements(song_id)` trên schema cũ, và vẫn tạo chỉ mục `(user_id, song_id)` khi cột `user_id` tồn tại. Trước sửa, `tests/legacy_migration_indexes_regression.php` FAIL với `no such column: user_id`; sau sửa PASS.
- Giao diện đăng nhập hiển thị thông điệp API cho lỗi 4xx. `tests/library_login_error_regression.js` FAIL trước sửa (`Lỗi mạng`), PASS sau sửa. Kiểm tra bằng Chromium với phản hồi 401 giả lập: modal hiện đúng “Sai tài khoản hoặc mật khẩu” mà không gửi dữ liệu đăng nhập thật.
- Tạo bản sao nhất quán của CSDL bằng SQLite backup API tại `/tmp/sheetapp-roadmap5-audit.sqlite`. Trên bản sao, 15 migration chạy PASS; `integrity_check=ok`, `foreign_key_check` rỗng, 903 bài và 4 tài khoản được giữ. `SongService::getById()` và `SongService::search()` hoạt động. Migration 002 sẽ xóa **1** `setlist_items` mồ côi đang trỏ tới setlist không tồn tại trên production.
- Kiểm tra 903/903 đường dẫn MusicXML trong cache đều có file. Chromium ở 390px và 1366px tải được bài 001, không có lỗi JavaScript hay HTTP trong lượt kiểm tra đó; đã chụp ảnh trước khi sửa tại `/tmp/sheetapp-before-390.png` và `/tmp/sheetapp-before-1366.png`.

## Việc vận hành còn chờ xác nhận

ROADMAP3 Phần 0 yêu cầu backup và xác nhận của chủ dự án trước khi chạy migration trên CSDL thật. Cần chuẩn bị bản backup riêng, chỉnh chủ sở hữu `app.sqlite` cho tài khoản web `sheet5566`, chạy migration, rồi kiểm tra đăng nhập, tìm kiếm, tải bài qua HTTP. Chạy migration 002 đồng nghĩa xóa 1 dòng mồ côi nêu trên.

Không chạy Playwright E2E mặc định trên server này: `e2e/global-teardown.js` sao chép snapshot đè lại `app.sqlite` thật, có thể mất dữ liệu phát sinh trong lúc test. Bộ kiểm tra bí danh hiện có báo 22/25 checks PASS trên bản sao; hai lỗi HTTP do production chưa migration và một lỗi snippet do dữ liệu lời cũ, cần đánh giá sau khi cập nhật production.
