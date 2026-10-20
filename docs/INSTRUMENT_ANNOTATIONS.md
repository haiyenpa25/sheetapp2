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

## Hướng dẫn sử dụng

### Người đọc

1. Mở bài ở chế độ **Bản Nhạc** trong Modern hoặc Classic, chọn **Ghi chú nhạc cụ** ngay phía trên sheet.
2. Tick các nhạc cụ muốn xem, hoặc **Chọn tất cả** / **Ẩn tất cả**. Bộ lọc được nhớ trong `sheetapp_annotation_layers` trên thiết bị, độc lập StageLens.
3. Nhãn trên sheet hiện nhạc cụ và chỉ dẫn; nhãn quá dài được cắt gọn. Nhiều ghi chú cùng điểm được gom theo số lượng.
4. Chỗ chật dùng dấu **✎**. Chạm nhãn/dấu để mở và đưa ghi chú đầy đủ vào tầm nhìn; danh sách ghi rõ ô nhịp và khuông.
5. **Tải lại ghi chú** lấy phiên bản mới từ máy chủ. Khi lỗi tải có **Thử tải lại**; không coi lỗi mạng là bài chưa có ghi chú.

### Admin

1. Trong bảng ghi chú, chọn **Soạn ghi chú**, chọn **Nhạc cụ đang soạn**, rồi chạm dấu **+** trên sheet.
2. Nhập nội dung (tối đa 500 ký tự), chọn màu/biểu tượng nếu muốn và **Lưu ghi chú**. Có thể thêm nhiều chỉ dẫn, cùng hoặc khác nhạc cụ, tại cùng một điểm.
3. **Sửa** trên thẻ ghi chú mở dialog có lựa chọn nhạc cụ, nội dung và **Xóa ghi chú**. Kết thúc bằng **Kết thúc soạn**.
4. Nhập **Nhạc cụ mới** → **Thêm nhạc cụ** để bổ sung danh mục dùng chung. Không tạo thêm chế độ StageLens hay thay quyền thành viên.
5. Nếu máy chủ báo phiên khác đã thay đổi: giữ dialog mở, chọn **Tải lại dữ liệu**, kiểm tra thông tin mới rồi lưu lại bản nháp. Lỗi mạng cũng giữ nguyên nội dung nhập.
6. Nếu bản nhạc đã thay đổi, dùng **Đặt lại vị trí** trên thẻ có cảnh báo, chọn điểm mới, kiểm tra nội dung rồi lưu. Không tự chuyển ghi chú sang một nốt khác.

## Vận hành và tương thích

- Ghi chú vẫn ở `storage/data/annotations/<songId>.json`; danh mục ở `.instruments.json`. Backup cả thư mục này trước khi đưa phiên bản lên máy chủ. Không cần migration SQLite.
- Client cũ thiếu revision sẽ bị từ chối lưu (422), giúp tránh xóa lớp nhạc cụ của client mới. Tải lại trang để nhận frontend mới.
- `AnnotationService::load()` giữ cách đọc danh sách cũ cho PHP. Ghi qua API document có revision; không gọi cơ chế ghi toàn danh sách không kiểm tra phiên bản.
- Dữ liệu cũ chưa có dấu cấu trúc được gắn theo chỉ số ô nhịp/nốt cũ; hệ thống không thể tự biết một lần thay XML diễn ra trước khi thêm tính năng này.
- Không nạp API ghi chú ở lần đọc đầu nếu người dùng chưa mở bảng/chưa lưu bộ lọc bật. Khi đã chọn lớp, tải bất đồng bộ theo bài; có token chặn kết quả đến muộn.
- CSS/geometry/panel/canvas được đưa vào precache. Cache giao diện dùng cả phiên bản và manifest hash, giúp thay đồng bộ module; cache MusicXML và gói `sheetapp-offline-*` được giữ lại.
- Khi thay tài nguyên nằm trong manifest, chạy `php tools/generate_sw_manifest.php` ở bản build/cài đặt cách ly và đưa `sw.js` mới vào bản phát hành. Không chạy sync tự push.
- Chưa cung cấp tải ghi chú ngoại tuyến, bản phối riêng từng chương trình, ghi chú theo đoạn, hoặc xuất PDF chuyên biệt.
