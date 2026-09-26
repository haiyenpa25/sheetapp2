# SheetApp2 — Sổ Tay Quản Lý Di Chuyển Cơ Sở Dữ Liệu (Database Migration Runbook)

Tài liệu hướng dẫn quản trị cơ sở dữ liệu SQLite theo chuẩn phiên bản hóa (Task 1.9 — Giai đoạn 1).

---

## 1. Kiến Trúc Di Chuyển (Migration Architecture)

- **Động cơ lưu trữ:** SQLite 3 với chế độ ghi nhật ký `PRAGMA journal_mode = WAL` (Write-Ahead Logging) và đồng bộ `PRAGMA synchronous = NORMAL`.
- **Độ trễ chờ khóa (Busy Timeout):** 5000ms giúp xử lý mượt mà khi nhiều tiến trình ghi/đọc đồng thời.
- **Bảng theo dõi:** `schema_migrations (version TEXT PRIMARY KEY, applied_at DATETIME)`
- **Thư mục migration:** `api/migrations/*.php` thực thi tuần tự theo thứ tự chữ cái.
- **Bộ điều phối:** [MigrationRunner.php](file:///c:/xampp/htdocs/sheetapp2/api/core/MigrationRunner.php) tự động kiểm tra `foreign_key_check` và `integrity_check` sau mỗi đợt chạy.

---

## 2. Quy Trình Khởi Tạo Mới Từ Đầu (Fresh Install)

Khi triển khai môi trường mới hoặc reset DB:

```bash
# Chạy script khởi tạo qua giao diện CLI
php api/init_db.php
```

Quy trình sẽ tự động:
1. Chạy toàn bộ migrations từ `001_initial_schema.php` trở đi.
2. Thiết lập cấu trúc bảng chuẩn, khóa ngoại `ON DELETE CASCADE / SET NULL`.
3. Tạo các chỉ mục hiệu năng cho khóa ngoại và trường tìm kiếm.
4. Nạp các danh mục phụng vụ chuẩn (Thánh Ca, Thờ Phượng, Hợp Xướng...).
5. Tạo tài khoản mẫu ban đầu (admin, hoaidinh, banhat) nếu chưa có.
6. Thiết lập quy tắc bảo mật `.htaccess` chặn tải trực tiếp file `.sqlite`.

---

## 3. Quy Trình Nâng Cấp Không Mất Mát Dữ Liệu (Non-Destructive Upgrade)

Khi triển khai bản cập nhật mã nguồn có thêm migration mới:

```bash
# Bước 1: Sao lưu an toàn bản DB hiện tại
php tools/create_encrypted_backup.php

# Bước 2: Chạy migration qua công cụ CLI
php tools/migrate.php
```

Nguyên tắc:
- Mọi migration đều có tính chất lũy thừa (Idempotent) — chạy lại nhiều lần không sinh lỗi.
- Chỉ những migration chưa có trong `schema_migrations` mới được thực thi.
- Dữ liệu hiện có của người dùng, bài hát và hợp âm được bảo toàn nguyên vẹn 100%.

---

## 4. Danh Sách Các Bản Migration Đã Triển Khai

| Phiên bản | Tên tệp | Nội dung chính |
|---|---|---|
| `001` | `001_initial_schema.php` | Khởi tạo đầy đủ 10 bảng cốt lõi của ứng dụng |
| `002` | `002_cleanup_orphans_and_fk_guard.php` | Dọn dẹp bản ghi mồ côi (setlist_items không có cha), bảo đảm sạch khóa ngoại |
| `003` | `003_add_performance_indexes.php` | Thiết lập 14 chỉ mục tối ưu cho setlist, song, arrangements, categories, learning |

---

## 5. Quy Trình Rollback & Khôi Phục Sự Cố (Restore Drill)

Nếu gặp sự cố trong quá trình triển khai:

1. Xác định bản sao lưu gần nhất trong `storage/backups/`.
2. Dùng công cụ khôi phục hoặc sao chép bản snapshot an toàn đè lại `storage/data/app.sqlite`.
3. Kiểm tra tính toàn vẹn:
```bash
php -r "require 'api/core/DB.php'; echo DB::get()->query('PRAGMA integrity_check')->fetchColumn();"
# Kết quả phải trả về: ok
```
4. Kiểm tra khóa ngoại:
```bash
php -r "require 'api/core/DB.php'; echo json_encode(DB::get()->query('PRAGMA foreign_key_check')->fetchAll());"
# Kết quả phải trả về: [] (mảng rỗng, không có vi phạm)
```
