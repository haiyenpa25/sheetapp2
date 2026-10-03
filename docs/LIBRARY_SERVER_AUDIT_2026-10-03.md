# Rà soát Thư viện trên server — 2026-10-03

## Lỗi đã tái hiện

- `GET api/index.php?route=songs&action=search&q=Chua` trả HTTP 500. Log LiteSpeed ghi `no such column: s.liturgical_season`.
- CSDL `storage/data/app.sqlite` đang có schema cũ (không có `schema_migrations`, `songs.liturgical_season`, `users.email`), trong khi mã hiện tại dùng các cột này. Danh sách 903 bài vẫn hiện vì được trả từ `songs_cache.json`.
- File `app.sqlite` thuộc `root:root`, mode `0644`; log LiteSpeed có `attempt to write a readonly database` khi mở kết nối. Điều này ảnh hưởng các API dùng DB và mọi thao tác ghi.
- Khi API đăng nhập trả 401, giao diện hiển thị sai thành “Lỗi mạng”.

## Sửa mã và kiểm chứng cô lập

- Migration 003 giờ tạo chỉ mục `learning_arrangements(song_id)` trên schema cũ, và vẫn tạo chỉ mục `(user_id, song_id)` khi cột `user_id` tồn tại. Trước sửa, `tests/legacy_migration_indexes_regression.php` FAIL với `no such column: user_id`; sau sửa PASS.
- Giao diện đăng nhập hiển thị thông điệp API cho lỗi 4xx. `tests/library_login_error_regression.js` FAIL trước sửa (`Lỗi mạng`), PASS sau sửa. Kiểm tra bằng Chromium với phản hồi 401 giả lập: modal hiện đúng “Sai tài khoản hoặc mật khẩu” mà không gửi dữ liệu đăng nhập thật.
- Tạo bản sao nhất quán của CSDL bằng SQLite backup API tại `/tmp/sheetapp-roadmap5-audit.sqlite`. Trên bản sao, 15 migration chạy PASS; `integrity_check=ok`, `foreign_key_check` rỗng, 903 bài và 4 tài khoản được giữ. `SongService::getById()` và `SongService::search()` hoạt động. Migration 002 đã xóa **1** `setlist_items` mồ côi trỏ tới setlist không tồn tại trong bản sao.
- Kiểm tra 903/903 đường dẫn MusicXML trong cache đều có file. Chromium ở 390px và 1366px tải được bài 001, không có lỗi JavaScript hay HTTP trong lượt kiểm tra đó; đã chụp ảnh trước khi sửa tại `/tmp/sheetapp-before-390.png` và `/tmp/sheetapp-before-1366.png`.

## Cập nhật production sau khi chủ dự án xác nhận

Backup nhất quán trước migration: `/home/sheet.hyb.io.vn/backups/sheetapp-roadmap5-before-migration-20261003T033722Z.sqlite` (SHA-256 `dee6246473a06759474a257eefec664f32d58e1291a8c9b5a34fd076793b8bcf`, quyền `0600`, nằm ngoài thư mục web). Đổi chủ sở hữu `app.sqlite`, WAL và SHM thành `sheet5566`, rồi chạy `tools/migrate.php` dưới chính tài khoản web. Kết quả: 15/15 migration áp dụng, `integrity_check=ok`, 0 vi phạm khóa ngoại; 903 bài và 4 tài khoản giữ nguyên, `setlist_items` từ 5 còn 4 do xóa đúng 1 dòng mồ côi đã xác nhận.

Kiểm tra HTTP: `auth/me`, danh sách bài, bài 001, `sessions`, bộ hợp âm và tìm kiếm đều trả 200. Tìm `gie xu` trả 50 bài, bài đầu là “JÊSUS ĐẸP THAY”. Chromium tại 390px và 1366px tải bản nhạc, không có lỗi JavaScript/HTTP và không tràn ngang; tìm “Chua” trong sidebar hiển thị kết quả. Luồng đăng nhập thành công của tài khoản thật chưa thử vì không dùng mật khẩu production trong kiểm thử; bộ hồi quy xác thực trên fixture đạt 7/7 và giao diện lỗi 401 đã được thử với phản hồi giả lập.

Sau khi DB hoạt động, bộ kiểm thử bí danh phát hiện “Jê sus” có trong lời nhưng không được nhận diện/tô sáng khi tìm “gie xu”. Sửa `SongSearchHelper` để nhận cả cách viết có khoảng trắng; bộ kiểm thử liên quan đạt 26/26. HTTP production hiện trả 14 đoạn lời có `<mark>` trong 50 kết quả.

Không chạy Playwright E2E mặc định trên server này: `e2e/global-teardown.js` sao chép snapshot đè lại `app.sqlite` thật, có thể mất dữ liệu phát sinh trong lúc test.

## Bằng chứng lệnh và output

```text
Trước sửa: curl 'https://sheet.hyb.io.vn/api/index.php?route=songs&action=search&q=Chua'
{"success":false,"error":"Lỗi hệ thống. Vui lòng thử lại sau."}  HTTP:500

Trước sửa: SHEETAPP_DB_PATH=/tmp/sheetapp-roadmap5-audit.sqlite php tools/migrate.php
❌ LỖI MIGRATION: SQLSTATE[HY000]: General error: 1 no such column: user_id

Sau sửa, trên production: php tools/migrate.php (chạy dưới tài khoản sheet5566)
✅ Đã thực thi thành công 15 migration
Integrity Check: ok; Foreign Keys: ok; Journal Mode: wal

Sau sửa: curl 'https://sheet.hyb.io.vn/api/index.php?route=songs&action=search&q=gie+xu'
HTTP 200; success=true; 50 kết quả; 14 đoạn lời có <mark>

Kiểm thử liên quan: migration 2/2; auth fixture 7/7; migration integrity 5/5;
tìm kiếm bí danh 26/26; JS syntax 284 file PASS; browser 390px/1366px không lỗi.
```
