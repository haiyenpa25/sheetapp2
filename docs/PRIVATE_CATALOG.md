# Danh mục riêng và bài có bản quyền

Ngày: 2026-10-29. Áp dụng cho trang Quản lý → tab **Quản Lý Thể Loại**.

## Cách hoạt động

- Mỗi danh mục có **quyền xem**:
  | Giá trị | Ai xem được |
  |---|---|
  | `public` 🌐 | Ai cũng xem được, kể cả khách |
  | `private` 🔒 (Nội bộ) | Thành viên ban nhạc trở lên (`banhat`, `bannhac`, `leader`, `admin`) đã đăng nhập |
  | `admin_only` 🛡️ | Chỉ quản trị viên |
- Bài thuộc danh mục không công khai **bị ép theo danh mục**. Đổi quyền danh mục áp dụng **đồng loạt** cho mọi bài trong đó (có hộp xác nhận ghi rõ số bài): "Công khai" đưa cả danh mục ra ngoài, "Nội bộ" đóng lại.
- **Thêm bài**: nút "➕ Thêm bài (XML)" trên thẻ danh mục (chỉ admin), chọn một hoặc nhiều file `.xml` / `.musicxml` (`.mxl` chỉ cho danh mục công khai), tối đa 10 MB mỗi file.
- Chuyển một bài đã có sang danh mục riêng thì bài thành riêng tư; chuyển ra danh mục công khai thì bài **vẫn riêng** cho tới khi công khai chủ động.

## Bài riêng tư được bảo vệ thế nào

1. **File XML** nằm ở `storage/private/xml/<mã bài>.xml`: Apache chặn truy cập trực tiếp (kiểm thử: 403) và Git bỏ qua. CSDL chỉ lưu URL `api/index.php?route=songs&action=xml&id=<mã>`; API kiểm quyền rồi mới phát (`Cache-Control: private, no-store`). Người không được xem nhận **404** (không lộ bài có tồn tại).
2. **Mã bài** mang tiền tố `pv-`. `.gitignore` loại `storage/private/`, `storage/data/chord_sets/pv-*/` và `storage/data/annotations/pv-*` — hợp âm và ghi chú của bài riêng cũng không lên GitHub.
3. **Chốt chặn trung tâm** `api/core/SongAccessGuard.php` (gọi từ `api/index.php`) áp dụng cho các route theo mã bài: hợp âm, ghi chú, xuất ChordPro (có lời), bản phối, tập luyện, phiên, đánh giá, chương trình. Danh sách bài, tìm kiếm, bộ nhớ đệm danh sách công khai và chương trình cho `viewer` cũng loại bài/danh mục không công khai.
4. Bài riêng tư chỉ được **công khai** bằng cách đổi quyền danh mục; XML vẫn nằm ở vùng riêng và được phát qua API.

## Cập nhật web (làm theo thứ tự)

1. **Sao lưu**: `storage/data/app.sqlite` (và cả thư mục `storage/private/` nếu đã có).
2. `git status` rồi `git pull --ff-only` (không dùng `reset --hard`, `checkout -f`, `clean -fd`).
3. **Chạy migration 017**: `php tools/migrate.php` (thêm cột `categories.visibility`, mặc định `public`, không đổi dữ liệu cũ). Trước bước này web vẫn chạy bình thường: mọi danh mục coi như công khai, và tạo danh mục riêng sẽ báo "chạy migration 017".
4. Bảo đảm tiến trình web ghi được `storage/private/` (tự tạo thư mục `xml/` và `.htaccess`).
5. Kiểm tra: tạo danh mục Nội bộ → thêm một bài → mở bài khi đã đăng nhập (thấy) → đăng xuất (không thấy, `…&action=xml&id=…` trả 404).

## Lưu ý về dữ liệu

- **Bài riêng tư chỉ tồn tại ở nơi bạn tải lên** (CSDL + `storage/private/xml/`), không đi qua Git. Máy local và web sẽ khác nhau cho tới khi có cơ chế đồng bộ riêng; sao lưu `storage/private/` cùng CSDL.
- Công cụ xuất seed phát hành (`tools/export_library_seed.py`) từ chối chạy khi trong CSDL có bài không công khai. Muốn phát hành seed, cần xử lý các bài riêng trước (chưa có tuỳ chọn tự loại trừ).
- Đồng bộ dữ liệu qua GitHub (kho riêng tư) **chưa làm**: cần bạn chọn phương án A/B/C.
