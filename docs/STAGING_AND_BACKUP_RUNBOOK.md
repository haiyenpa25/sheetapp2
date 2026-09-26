# SheetApp2 — Tài Liệu Thiết Lập Staging & Quy Trình Backup Off-site Mã Hoá

> Ngày ban hành: 2026-09-25  
> Trạng thái: Hoàn tất tài liệu điều hành & quy trình phục hồi (G0-B)  
> Áp dụng cho: Quản trị viên hệ thống, DevOps, và AI Agent

---

## 1. Mục Tiêu & Nguyên Tắc Tách Biệt Môi Trường

Nhằm ngăn chặn sự cố can thiệp trực tiếp vào dữ liệu ca đoàn và hệ thống production (`sheet.hyb.io.vn`), hệ thống SheetApp2 vận hành theo mô hình 3 tầng độc lập:

| Môi trường | URL truy cập | Vị trí lưu trữ dữ liệu | Quyền hạn / Dữ liệu |
|---|---|---|---|
| **Development** | `http://localhost/sheetapp2/` | `C:\xampp\htdocs\sheetapp2\storage\data\` | Dữ liệu kiểm thử, SQLite local, log chi tiết |
| **Staging** | `https://staging.sheet.hyb.io.vn/` | Thư mục staging riêng biệt trên server | Bản sao có cấu trúc giống Production, dữ liệu ẩn danh |
| **Production** | `https://sheet.hyb.io.vn/` | Server chính thức | Dữ liệu thật, khóa nghiêm ngặt, tự động backup |

### Quy tắc bất biến:
1. **Không dùng chung cơ sở dữ liệu:** Staging tuyệt đối không trỏ tới `storage/data/app.sqlite` của Production.
2. **Không tự động push vào nhánh chính (main):** Mọi thay đổi phải đi qua Pull Request, kiểm thử local và staging trước khi merge vào Production.
3. **Bảo mật file cấu hình & Secret:** Không lưu trữ mật khẩu, session token hoặc private key trong mã nguồn git.

---

## 2. Thiết Lập Môi Trường Staging

### 2.1 Cấu hình Web Server (Apache / LiteSpeed / Nginx)
- Tạo VirtualHost hoặc Subdomain riêng: `staging.sheet.hyb.io.vn`.
- Thư mục gốc (DocumentRoot): `/home/sheet.hyb.io.vn/staging_html/`.
- Kích hoạt `.htaccess` để bảo vệ các thư mục nhạy cảm (`storage/data/`, `storage/logs/`, `tools/`, `docs/`, `*.sqlite`, `*.log`, `*.md`).

### 2.2 Cấu hình Ứng dụng & SQLite
1. Sao chép cây thư mục mã nguồn từ bản phát hành mới nhất sang thư mục staging.
2. Tạo tệp SQLite trắng hoặc nhập từ bản backup staging:
   ```bash
   mkdir -p storage/data storage/logs storage/users
   chmod -R 750 storage/data storage/logs
   ```
3. Chạy kiểm tra tính toàn vẹn:
   ```bash
   php tools/check_db.php
   ```

---

## 3. Quy Trình Tạo Bản Sao Lưu (Full Backup) & Mã Hoá Off-Site

### 3.1 Các thành phần bắt buộc trong gói Backup
Một gói sao lưu hợp lệ phải bao gồm đầy đủ 4 thành phần:
1. **Cơ sở dữ liệu SQLite:** `storage/data/app.sqlite` (sau khi đồng bộ checkpoint WAL).
2. **Kho bản nhạc Thánh Ca Master:** `storage/Thanh ca/` (~903 file MusicXML).
3. **Các bản phối cá nhân & phiên bản SATB:** `storage/users/` (các file XML do thành viên tạo).
4. **Bản đồ bảng mã hợp âm & cấu hình:** bảng `user_chord_sets`, `song_versions`, `users`.

### 3.2 Lệnh thực hiện sao lưu & kiểm tra tính toàn vẹn
Chạy script CLI chuyên dụng tạo snapshot nhất quán:
```bash
php tools/create_encrypted_backup.php --output=storage/backups/backup-$(date +%Y%m%d_%H%M%S).tar.gz.enc --passphrase="<KHOA_MA_HOA_MANH>"
```

*Trường hợp thực hiện thủ công bằng lệnh hệ thống:*
```bash
# 1. Tạo snapshot SQLite an toàn (sử dụng lệnh VACUUM INTO để khóa đọc nhất quán)
php -r "$db = new PDO('sqlite:storage/data/app.sqlite'); $db->exec('VACUUM INTO \"storage/data/snapshot.sqlite\"');"

# 2. Đóng gói các tệp dữ liệu quan trọng
tar -czf storage/backups/snapshot.tar.gz \
    storage/data/snapshot.sqlite \
    storage/Thanh\ ca \
    storage/users

# 3. Mã hoá gói sao lưu bằng OpenSSL AES-256-CBC
openssl enc -aes-256-cbc -salt -pbkdf2 -iter 100000 \
    -in storage/backups/snapshot.tar.gz \
    -out storage/backups/sheetapp-backup-$(date +%Y%m%d).enc \
    -k "<OFFSITE_BACKUP_SECRET_KEY>"

# 4. Dọn dẹp tệp snapshot tạm thời
rm -f storage/data/snapshot.sqlite storage/backups/snapshot.tar.gz
```

### 3.3 Chuyển giao lưu trữ Off-site
Tệp `.enc` đã được mã hoá mạnh bằng AES-256-CBC và PBKDF2 (100.000 vòng lặp) được đồng bộ ra ngoài server qua:
- S3 Compatible Storage (Cloudflare R2, AWS S3, Wasabi).
- Hoặc SFTP Remote Backup Server tách biệt vật lý.
- Giữ chu kỳ lưu trữ (Retention Policy): 7 bản hàng ngày, 4 bản hàng tuần, 12 bản hàng tháng.

---

## 4. Quy Trình Khôi Phục & Diễn Tập (Restore Runbook)

Khi cần khôi phục dữ liệu lên môi trường Staging hoặc khắc phục sự cố:

### Bước 1: Giải mã gói sao lưu
```bash
openssl enc -d -aes-256-cbc -pbkdf2 -iter 100000 \
    -in sheetapp-backup-YYYYMMDD.enc \
    -out restored_package.tar.gz \
    -k "<OFFSITE_BACKUP_SECRET_KEY>"

tar -xzf restored_package.tar.gz -C /tmp/restore_drill/
```

### Bước 2: Kiểm chứng cơ sở dữ liệu đã khôi phục
Chạy script `verify_sqlite_backup.php` để đối chiếu số lượng:
```bash
php tools/verify_sqlite_backup.php /tmp/restore_drill/storage/data/snapshot.sqlite
```
**Tiêu chí thành công:**
- `integrity=ok`
- `songs=903`
- `users >= 4`
- Các bảng `song_versions`, `user_chord_sets` đầy đủ.

### Bước 3: Đưa dữ liệu vào vị trí hoạt động
```bash
cp /tmp/restore_drill/storage/data/snapshot.sqlite storage/data/app.sqlite
cp -rn /tmp/restore_drill/storage/Thanh\ ca/* storage/Thanh\ ca/
cp -rn /tmp/restore_drill/storage/users/* storage/users/
rm -rf /tmp/restore_drill restored_package.tar.gz
```

---

## 5. Cổng Nghiệm Thu Checkpoint G0 (Definition of Done)

Hệ thống đạt đủ điều kiện đóng **Giai đoạn 0 (Bảo mật khẩn cấp & Lưới an toàn)** khi:
1. Toàn bộ 15 bộ Security Regression Suites (149+ test assertions) đạt trạng thái **PASS**.
2. Các lỗ hổng bảo mật P0 (S1–S11) được vá triệt để:
   - Không còn bypass quyền User API (yêu cầu Admin token/session).
   - Đã loại bỏ mật khẩu hiển thị và quick-login trên form.
   - Thư mục nội bộ, script CLI, docs và storage nhạy cảm đã bị chặn từ Web.
   - Live Sync yêu cầu đăng nhập và `hostToken` nguyên tử.
   - MusicXML upload/delete bị giới hạn nghiêm ngặt trong 2 managed roots.
   - Không còn lỗ hổng Stored XSS trong toàn bộ 6 ứng dụng.
3. Diễn tập sao lưu và khôi phục cơ sở dữ liệu cục bộ đã thành công với đối chiếu toàn vẹn `integrity=ok`.
4. Quy trình thiết lập Staging và sao lưu mã hoá off-site đã được chuẩn hóa thành tài liệu hướng dẫn điều hành.

---

## 6. Biên Bản Diễn Tập Phục Hồi Ngoại Tuyến (Restore Drill Report — Checkpoint G3.9)

- **Ngày thực hiện:** 2026-09-26 11:01:45
- **Công cụ tự động hóa:**
  - Tạo sao lưu mã hóa: `tools/create_encrypted_backup.php` (OpenSSL AES-256-CBC, PBKDF2 100.000 vòng lặp)
  - Giải mã & Phục hồi: `tools/restore_encrypted_backup.php`
  - Bộ kiểm thử hồi quy: `tests/backup_restore_drill_regression.php` (24/24 checks PASS)
- **Kết quả diễn tập:**
  - Header mã hóa: Chuẩn `Salted__` (16 bytes salt + ciphertext)
  - Thử nghiệm mật mã sai: Từ chối giải mã an toàn, exit code 1, không lộ dữ liệu
  - Thử nghiệm mật mã đúng: Giải mã và giải nén thành công 100%
  - Trạng thái toàn vẹn SQLite: `PRAGMA integrity_check = ok`
  - Đối chiếu SHA-256 Checksum: Khớp tuyệt đối với `manifest.json`
  - Kiểm tra dữ liệu: 903 bài hát, 4 tài khoản người dùng, 11 bảng cốt lõi đầy đủ.
- **Trạng thái:** ĐẠT YÊU CẦU CHECKPOINT G3.9 (VERIFIED).
