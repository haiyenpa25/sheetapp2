# OMR & Category Feature Design

## Tiêu chuẩn (Overview)
Tích hợp tính năng thêm bài hát bằng Nhận diện quang học (OMR) từ Hình ảnh/PDF, và tái cấu trúc hệ thống lưu trữ thêm trường Danh Mục (Category) để quản lý nhóm bài hát theo chủ đề (VD: Thánh ca).

## 1. Cơ sở dữ liệu (Database Architecture)
Tái kiến trúc hệ thống SQLite:
- **Bảng `categories` (MỚI)**:
  - `id` (INTEGER PRIMARY KEY)
  - `name` (TEXT) - VD: "Thánh ca"
- **Bảng `songs` (SỬA)**:
  - Thêm cột `category_id` (INTEGER, FOREIGN KEY refs `categories.id`)
- **Bảng `omr_workspace` (MỚI)**:
  - `id` (TEXT PRIMARY KEY)
  - `original_filename` (TEXT)
  - `status` (TEXT) - 'waiting', 'processing', 'completed', 'error'
  - `musicxml_path` (TEXT)
  - `created_at` (DATETIME)
- **Migration**: Chạy script tạo các bảng và tự động thêm category "Thánh ca", sau đó gán `category_id` của toàn bộ 903 bài hiện có vào nhóm này.

## 2. Trạm Xử lý OMR (Backend & Storage)
- **Engine Tích hợp**:
  - Dùng Audiveris Java CLI thực thi thông qua lệnh `exec()` của PHP.
  - Cần yêu cầu máy chủ/máy trạm có sẵn Java (JRE).
- **Thư mục làm việc**:
  - `storage/omr_workspace/`: Chứa các file PDF/Ảnh chờ xử lý và các tệp XML rác sinh ra. Khu vực này có quyền xoá tệp an toàn.
  - Sau khi duyệt, file `.mxl` mới được di chuyển sang `storage/sheets/` chính thức.
- **Workflow / Polling API**:
  - Upload API -> Trả về ID phiên.
  - Start OMR API -> Chạy Audiveris (Chạy ngầm / Async).
  - Status API -> Giúp client theo dõi trạng thái từ 'processing' về 'completed'. Định kỳ gọi từ client (Polling mỗi 3 giây).

## 3. Giao diện người dùng (UI / UX)
- **Màn hình Admin "OMR Station"**:
  - Trạm upload Hình ảnh/PDF.
  - Danh sách các Queue OMR đang xử lý.
  - Nút "Xem trước" (Review) và Form để gán cấu hình (Title, Category).
  - Nút "Xoá rác" dọn dẹp các bản nháp hỏng.
- **Màn hình Sidebar Khách (Frontend)**:
  - Bổ sung bộ lọc "Danh mục bài hát". Khi có nhiều category (Thánh ca, Nhạc trẻ), user có thể chuyển đổi chế độ xem thay vì xem toàn bộ 1000 bài lộn xộn.
