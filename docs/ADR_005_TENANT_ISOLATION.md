# ADR-005: Chiến Lược Cô Lập Dữ Liệu & Kiến Trúc Đa Hội Thánh (Multi-Tenant Architecture)

- **Trạng thái:** ĐỀ XUẤT / SẴN SÀNG CHO GIAI ĐOẠN 4 (Epic 4.5)
- **Tác giả:** SheetApp Core Architecture Team
- **Ngày lập:** 2026-09-26
- **Liên quan:** [ROADMAP2.md](file:///c:/xampp/htdocs/sheetapp2/ROADMAP2.md) (Mục D.7 Epic 4.5), [PROJECT_REGISTRY.md](file:///c:/xampp/htdocs/sheetapp2/PROJECT_REGISTRY.md)

---

## 1. Bối cảnh & Vấn đề (Context)

SheetApp 2.0 hiện tại được thiết kế cho mô hình đơn tổ chức (Single-Tenant), phục vụ 1 hội thánh hoặc 1 ban nhạc/ca đoàn với 1 cơ sở dữ liệu SQLite duy nhất (`storage/data/sheetapp.sqlite`).

Khi mở rộng cho nhiều hội thánh (Multi-Tenant), các yêu cầu cốt lõi bao gồm:
1. **Cô lập dữ liệu tuyệt đối (Zero Cross-Tenant Leakage):** Không một hội thánh nào được phép nhìn thấy, tìm kiếm, hoặc chỉnh sửa setlist, bài tập, bản ghi âm, danh sách thành viên hay tùy chọn cá nhân của hội thánh khác.
2. **Kho bài hát chung (Master Repertoire):** 903 bài Thánh Ca Thần Đạo (MusicXML, nốt nhạc, lời, phân loại phụng vụ) là tài nguyên dùng chung, read-only. Không sao chép 903 file XML nhân lên cho từng tenant.
3. **Bộ hợp âm độc lập & Bản phối riêng:** Mỗi hội thánh có các ca viên, ca trưởng, bộ hợp âm riêng, phiên bản MusicXML chỉnh sửa riêng (`song_versions`), và quy trình duyệt nội bộ riêng (`review_requests`).
4. **Vận hành & Sao lưu dễ dàng (Operational Simplicity):** Dễ dàng backup, restore, hoặc xoá dữ liệu của 1 hội thánh khi họ ngừng sử dụng mà không ảnh hưởng tới các hội thánh khác.

---

## 2. So sánh Các Phương Án Kiến Trúc

### Phương án A: Shared Database + Cột `tenant_id` (Row-Level Multi-Tenancy)
- **Cơ chế:** Mọi bảng trong 1 database SQLite đều được thêm cột `tenant_id INTEGER NOT NULL`. Mọi câu truy vấn SQL (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) bắt buộc phải có mệnh đề `WHERE tenant_id = ?`.
- **Ưu điểm:**
  - Cấu trúc thư mục đơn giản, chỉ 1 file SQLite duy nhất.
  - Chạy migration 1 lần cho tất cả.
- **Nhược điểm & Rủi ro bảo mật:**
  - **Rủi ro rò rỉ dữ liệu cực cao:** Chỉ cần một developer hoặc một truy vấn lồng quên mệnh đề `AND tenant_id = ?`, dữ liệu giữa các hội thánh sẽ lập tức bị lộ.
  - **Backup / Restore đơn lẻ phức tạp:** Không thể khôi phục dữ liệu hôm qua cho Hội thánh A mà không ghi đè dữ liệu của Hội thánh B.
  - **Tranh chấp ghi SQLite (Write Concurrency Lock):** Toàn bộ các hội thánh dùng chung 1 database SQLite, dễ nghẽn khoá ghi khi nhiều buổi tập diễn ra cùng lúc vào tối thứ Bảy hoặc sáng Chúa Nhật.

---

### Phương án B: Database-per-Tenant SQLite (Khuyến nghị)
- **Cơ chế:**
  - **1 Database Master (`storage/data/master_repertoire.sqlite`):** Chứa danh mục 903 bài Thánh Ca gốc, metadata phân loại, mùa phụng vụ. Chế độ mở: Read-Only (`PDO::SQLITE_OPEN_READONLY`).
  - **Mỗi Tenant một Database riêng (`storage/tenants/{tenant_slug}/data.sqlite`):** Chứa người dùng, vai trò, bộ hợp âm cá nhân/HD, setlists, bài tập ca đoàn, hàng đợi phê duyệt, thông báo.
- **Ưu điểm vượt trội:**
  - **Cô lập vật lý 100%:** Việc rò rỉ dữ liệu chéo qua câu lệnh SQL là **bất khả thi về mặt vật lý**, vì connection PDO của Tenant A không thể trỏ tới file SQLite của Tenant B.
  - **Hiệu năng & Tranh chấp:** Mỗi hội thánh có file SQLite riêng, độc lập hoàn toàn về transaction và write locks.
  - **Sao lưu & Di chuyển siêu đơn giản:** Backup 1 hội thánh chỉ là copy 1 file `.sqlite`. Muốn xoá hội thánh chỉ việc xoá thư mục tenant.
  - **Tuân thủ quyền riêng tư (GDPR / Privacy):** Dễ dàng xuất toàn bộ dữ liệu hoặc xoá vĩnh viễn theo yêu cầu của hội thánh.
- **Thách thức:** Cần quản lý vòng đời migration cho từng database tenant.

---

## 3. Quyết định (Decision)

> **LỰA CHỌN: Phương án B (Database-per-Tenant SQLite) kết hợp Master Repertoire.**

---

## 4. Chi tiết Thiết Kế Kiến Trúc

```text
storage/
├── data/
│   ├── master_repertoire.sqlite    (Read-Only: 903 bài Thánh Ca, MusicXML, Taxonomy)
│   └── platform_admin.sqlite       (Quản trị hệ thống: tenants, subscriptions, super-admins)
└── tenants/
    ├── hoi-thanh-tin-lanh-sai-gon/
    │   ├── data.sqlite             (Users, ChordSets, Setlists, Assignments, Reviews)
    │   ├── logs/
    │   └── live_sync/
    └── hoi-thanh-ha-noi/
        ├── data.sqlite
        ├── logs/
        └── live_sync/
```

### 4.1 Định danh & Định tuyến Tenant (Tenant Identification)
- Hỗ trợ 2 phương thức:
  1. **Subdomain:** `saigon.sheetapp.vn` → tenant slug: `hoi-thanh-tin-lanh-sai-gon`.
  2. **Path-based (trên localhost / dev):** `localhost/sheetapp2/t/saigon/` → tenant slug: `saigon`.
- Middleware `TenantContext`:
  - Khởi tạo ngay tại `api/index.php` hoặc `includes/bootstrap.php`.
  - Phân giải slug, kiểm tra tính hợp lệ trong `platform_admin.sqlite`.
  - Thiết lập đường dẫn file SQLite tương ứng cho lớp `DB::get()`.

### 4.2 Lớp Kết Nối Cơ Sở Dữ Liệu (`DB::get()`)
- `DB::get()`: Trả về kết nối PDO tới database của tenant hiện hành trong phiên làm việc.
- `DB::getMaster()`: Trả về kết nối PDO Read-Only tới `master_repertoire.sqlite`.
- Khi cần truy vấn bài hát:
  - Thông tin bài hát lấy từ `DB::getMaster()`.
  - Thông tin bộ hợp âm, ghi chú, lịch sử sử dụng lấy từ `DB::get()`.

### 4.3 Quản lý Session & Đăng nhập
- Session cookie gắn liền với Tenant Context (sử dụng session name riêng hoặc lưu `tenant_id` trong session).
- Quản trị viên hệ thống (Super Admin) tách biệt với Quản trị viên hội thánh (Tenant Admin).

### 4.4 Migration Runner Đa Tenant (`tools/migrate_tenants.php`)
- Script CLI duyệt qua danh sách các tenant đang kích hoạt trong `platform_admin.sqlite`.
- Chạy toàn bộ các file migration từ `api/migrations/*.php` trên từng file SQLite của tenant.
- Tự động rollback nếu 1 tenant thất bại và ghi nhận báo cáo chi tiết.

### 4.5 Yêu cầu Kiểm Thử Cô Lập Bắt Buộc (Cross-Tenant Isolation Test Suite)
- Tạo 2 tenant giả lập: `tenant_alpha` và `tenant_beta`.
- Test suite gửi request với session của `tenant_alpha` truy cập tài nguyên của `tenant_beta` (setlist, review request, bài tập).
- **Quy tắc bắt buộc:** 100% request chéo phải trả về `HTTP 403 Forbidden` hoặc `HTTP 404 Not Found`.

---

## 5. Kế hoạch Triển khai (Khi được kích hoạt)
1. **Giai đoạn 1:** Tách `master_repertoire.sqlite` (bảng `songs`, `categories`) khỏi `sheetapp.sqlite`.
2. **Giai đoạn 2:** Triển khai `TenantContext` và cấu trúc thư mục `storage/tenants/`.
3. **Giai đoạn 3:** Xây dựng script `tools/migrate_tenants.php` và `tools/tenant_manager.php`.
4. **Giai đoạn 4:** Viết bộ kiểm thử hồi quy cô lập `tests/tenant_isolation_regression.php`.
5. **Giai đoạn 5:** Pilot với 2 hội thánh thử nghiệm đầu tiên.
