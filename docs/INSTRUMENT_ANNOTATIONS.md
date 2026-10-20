# Ghi chú theo nhạc cụ — phạm vi đã duyệt qua hội thoại

Ngày: 2026-10-20. Chủ dự án yêu cầu thực hiện sau khi duyệt phân tích.

## Hợp đồng bản đầu

- Modern và Classic dùng chung dữ liệu và module; chỉ admin được ghi như quyền annotation hiện hữu.
- Người xem bật Chung, một hoặc nhiều nhạc cụ, tất cả hoặc ẩn hết; lựa chọn lưu trên thiết bị, độc lập StageLens.
- Admin chọn nhạc cụ, bấm vị trí trên sheet, thêm/sửa/xóa nội dung. Nhiều ghi chú có ID riêng tại cùng vị trí.
- Danh mục mặc định: Chung, Guitar, Keyboard, Bass, Trống, Hát. Admin bổ sung nhạc cụ qua bảng ghi chú.
- Ghi chú cũ đọc thành lớp Chung, giữ nội dung/màu/icon, không tự ghi lại khi đọc.
- Vị trí theo ô nhịp/khuông/thời điểm âm nhạc; noteIdx là tương thích cho dữ liệu cũ. Dựng lại sau render/zoom/resize trên mọi SVG và khuông.
- Bản đầu là bản phối mặc định theo bài. Chưa có ghi chú riêng từng chương trình, phạm vi nhiều ô nhịp, phát âm thanh hoặc PDF chuyên biệt.
- Dấu vân tay cấu trúc XML phát hiện thay sheet: ghi chú lệch phiên bản được liệt kê để admin đặt lại, không âm thầm gắn sang nốt khác.
- Nhãn ngắn trên sheet; bảng chi tiết liệt kê toàn văn và vị trí. Nhiều nhãn được gom theo điểm để hạn chế che nhạc.
- Không báo lưu thành công khi lỗi; giữ nội dung nhập; HTTP 409 khi phiên bản đã thay đổi, tải lại trước khi thử lưu.
- Không hứa hỗ trợ offline chưa triển khai. Lỗi tải có nút thử lại; không cho ghi khi chưa tải dữ liệu.

## API

GET annotations/action=load/songId trả annotations, revision, schemaVersion=2, instruments.
POST action=save nhận songId, annotations và revision bắt buộc; trả document mới.
POST action=instrument_save nhận instrumentId (mới: để trống), name và registryRevision.
GET action=instruments trả instruments và registryRevision. POST vẫn requireAdmin + Origin/CSRF middleware hiện hành.
File JSON lưu nguyên tử dưới khóa riêng; kiểm tra revision và ghi trong cùng khóa. Không đổi SQLite/migration.

## Lát triển khai và nghiệm thu

1. Kho dữ liệu/API: test cô lập legacy, hai nhạc cụ cùng vị trí, revision xung đột, dữ liệu lỗi, danh mục và ghi nguyên tử.
2. Module chung: checkbox/lưu lựa chọn, CRUD, guest chỉ đọc, lỗi/retry, bài cũ trả muộn, cuộn không mở editor.
3. Ghép hai UI và QA: sheet thật, nhiều trang/khuông, resize/zoom, 360/390/820/1366; PHP gate và Chromium regression. Không ghi DB/storage nguồn.

Không chạy sync, không merge main, không thay bảng quyết định/chữ ký roadmap.
