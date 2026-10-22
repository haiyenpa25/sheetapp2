# Staging và sao lưu — hướng dẫn theo công cụ hiện có

Cập nhật 2026-10-21 (FIX-43). Đây là quy trình, không phải xác nhận staging/scheduler/off-site đã được thiết lập. Chủ dự án xác nhận trước deploy, migration, xoá hoặc phục hồi dữ liệu thật.

## Môi trường cách ly

Staging phải có DocumentRoot, DB, storage, session và tài khoản riêng. Không dùng workspace nguồn làm dữ liệu thử. `tests/run_all_tests.php --strict --js` và E2E ghi phải chạy trên bản sao ngoài workspace. Global E2E yêu cầu `.sheetapp-e2e-isolated.json` và URL trùng marker; không còn snapshot/restore đè DB nguồn sau test.

Không coi biến DB_PATH của PHP CLI là cấu hình DB cho Apache: `Config::get('DB_PATH')` chỉ dùng override đó ở CLI. Dùng bản sao cây ứng dụng riêng cho HTTP. Bảo vệ api/core, api/services, storage/data, storage/config, logs, tools và docs bằng cấu hình máy chủ; kiểm lại HTTP 403/404 trước mở staging.

## Giữ cấu hình tính năng (Q-A)

`features.json` là mặc định trong Git; `features.local.json` ngoài Git nạp sau để ghi đè. Trước cập nhật lần đầu, sao chép cấu hình đang dùng sang local nếu local chưa tồn tại. Không ghi đè local hiện có. Xem `docs/LIBRARY_DATA_RELEASE.md`. Chưa bật CSRF production trước staging/E2E ghi.

## Phạm vi backup thực tế

`tools/create_encrypted_backup.php` hiện đóng gói **snapshot DB SQLite và manifest**, dưới dạng ZIP (hoặc GZ/JSON nếu thiếu ZipArchive), rồi mã hoá AES-256-CBC/PBKDF2 khi có passphrase. Tệp `.enc` không phải `.tar.gz`; không dùng `tar -xzf` để mở trực tiếp. Manifest có SHA256 snapshot, integrity, số songs/users.

Tool này **chưa sao lưu MusicXML, storage/users, cấu hình local hoặc upload**. Cần một backup filesystem riêng cho `storage/Thanh ca`, `storage/users`, `storage/data/chord_sets`, annotations, tài sản upload cần giữ và cấu hình server; ghi version code và thời điểm tương ứng. Không gọi bản DB-only là full backup. Để chụp DB và file đồng bộ, lên lịch khoảng bảo trì/ngừng ghi, hoặc dùng snapshot filesystem phù hợp do quản trị viên triển khai.

## Tạo và xác minh DB backup

Truyền passphrase qua biến `SHEETAPP_BACKUP_PASSPHRASE` của **tiến trình hiện tại**, lấy từ kho secret, hoặc dùng `--passphrase-stdin`. Không gõ passphrase vào argv, script trong Git hay lịch sử shell. Tên mặc định: `sheetapp_backup_YYYYmmdd_HHMMSS.enc`.

```powershell
# Biến môi trường đã được cấp cho tiến trình từ nguồn secret bên ngoài.
php tools/create_encrypted_backup.php
php tools/restore_encrypted_backup.php --input=storage/backups/sheetapp_backup_YYYYmmdd_HHMMSS.enc --verify-only
```

Có thể chỉ định `--output=<file.enc>`. Kiểm thử hoặc dry-run vận hành dùng DB/thư mục riêng:

```powershell
php tools/create_encrypted_backup.php --db=<fixture.sqlite> --backup-dir=<temp-backups> --output=<temp-backup.enc>
```

`--verify-only` giải mã và đối chiếu SHA256/integrity trong thư mục tạm rồi dọn phần DB/manifest đã giải nén. Tiêu chí: exit 0, integrity ok, SHA256 KHỚP; số songs/users phải khớp manifest của bản sao lưu, không dùng mốc cứng 903 bài. Giữ checksum của cả tệp mã hoá để đối chiếu sau chuyển off-site.

```powershell
Get-FileHash -Algorithm SHA256 -LiteralPath <backup.enc>
```

Không có `tools/check_db.php` hoặc `tools/verify_sqlite_backup.php`; dùng tool restore nêu trên. Regression drill tạo DB từ fixture memory và backup trong temp: `php tests/backup_restore_drill_regression.php`.

## Phục hồi thử và phục hồi thật

Phục hồi thử vào thư mục mới, ngoài DocumentRoot và ngoài DB đang mở:

```powershell
php tools/restore_encrypted_backup.php --input=<backup.enc> --out-dir=<new-empty-restore-dir>
```

Kết quả gồm `app.sqlite` và `manifest.json`. Lệnh không tự đưa DB vào vị trí hoạt động. Trước phục hồi thật: chủ dự án duyệt bản nguồn/đích; backup hiện trạng; dừng các tiến trình đang giữ DB và WAL; xác minh backup; khôi phục cả filesystem đi kèm cùng mốc; kiểm integrity, khóa ngoại, đăng nhập và mở bài trên staging. Việc chuyển vào production và xử lý WAL/SHM do người có quyền máy chủ thực hiện trong maintenance, không chép snapshot đè khi Apache còn giữ DB.

## Lịch chạy và giữ bản

Repository chưa cài scheduler. Đề xuất một lượt mỗi ngày lúc 02:00, cộng một lượt trước mỗi migration/release. Chủ dự án tạo Task Scheduler (Windows) hoặc cron (Linux) bằng tài khoản riêng; WorkingDirectory là đúng ứng dụng, PHP lấy đường dẫn thực tế trên máy. Cấp secret cho tiến trình, ghi exit code và báo lỗi khi tạo/xác minh thất bại; không đưa secret vào trường Arguments của lịch.

Chỉ chuyển off-site qua kênh/tài khoản đã được chủ dự án cấu hình. Kiểm SHA256 tệp mã hoá sau truyền và diễn tập restore định kỳ. Lưu khóa giải mã tách khỏi backup, có người được phân công phục hồi.

Chính sách đề xuất: 7 bản ngày, 4 bản tuần, 12 bản tháng; một file có thể đại diện nhiều mốc và phải giữ nếu còn thuộc bất kỳ mốc nào. Đây chưa phải job xoá tự động. Lập danh sách tên/checksum/kích thước cần giữ/xoá, xác minh bản off-site phục hồi được, rồi xin duyệt danh sách trước khi xoá.

`tools/prune_backups.php` chỉ xử lý mẫu backup SQLite tự động, **không xử lý `.enc`**; không coi việc chạy nó là đã áp retention cho backup mã hoá. Không đổi đuôi `.enc` sang `.sqlite` để tool nhận nhầm.

## Việc của chủ dự án trước merge

- Q-E: đổi mật khẩu hai tài khoản yếu; tài khoản dùng chung chỉ viewer. Chưa thực hiện trên DB thật.
- Q-F: kiểm gzip trên production (OpenLiteSpeed), ghi status/header thật. Dùng `curl -I -H "Accept-Encoding: gzip" <asset-url>`; nếu server trả file `.gz` mà thiếu `Content-Encoding: gzip`, ngừng quy tắc precompressed ở server đó trước release. Không suy kết quả Apache local sang production.
- Q-C/Q-D và Q6: duyệt dry-run và backup trước migration/dọn dữ liệu, không suy ra từ phê duyệt sửa mã.
