# Ghi chú theo nhạc cụ — phạm vi đã duyệt qua hội thoại

Ngày: 2026-10-20. Chủ dự án yêu cầu thực hiện sau khi duyệt phân tích.

## Hợp đồng bản đầu

- Modern và Classic dùng chung dữ liệu và module; chỉ admin được ghi như quyền annotation hiện hữu.
- Người xem bật Chung, một hoặc nhiều nhạc cụ, tất cả hoặc ẩn hết; lựa chọn lưu trên thiết bị, độc lập StageLens.
- Admin dùng **Nhạc cụ trên toolbar → chọn nhạc cụ → Ghi chú → dấu + vàng phía trên hợp âm**, thêm/sửa/xóa nội dung. Nhiều ghi chú có ID riêng tại cùng vị trí.
- Danh mục mặc định: Chung, Guitar, Keyboard, Bass, Trống, Hát. Admin bổ sung nhạc cụ qua bảng ghi chú.
- Ghi chú cũ đọc thành lớp Chung, giữ nội dung/màu/icon, không tự ghi lại khi đọc.
- Vị trí theo ô nhịp/khuông/thời điểm âm nhạc; noteIdx là tương thích cho dữ liệu cũ. Dựng lại sau render/zoom/resize trên mọi SVG và khuông.
- Bản đầu là bản phối mặc định theo bài. Chưa có ghi chú riêng từng chương trình, phạm vi nhiều ô nhịp, phát âm thanh hoặc PDF chuyên biệt.
- Dấu vân tay cấu trúc XML phát hiện thay sheet: ghi chú lệch phiên bản được liệt kê để admin đặt lại, không âm thầm gắn sang nốt khác.
- Mỗi ghi chú có nhãn riêng với tên nhạc cụ; các dòng xếp phía trên hợp âm của đúng khuông. OSMD chừa khoảng trống theo số dòng, giữ mốc ngang tại nốt khi zoom/resize. Nội dung dài cắt gọn trên sheet, bấm để đọc đầy đủ.
- Không báo lưu thành công khi lỗi; giữ nội dung nhập; HTTP 409 khi phiên bản đã thay đổi, tải lại trước khi thử lưu.
- Không hứa hỗ trợ offline chưa triển khai. Lỗi tải có nút thử lại; không cho ghi khi chưa tải dữ liệu.

## API

GET annotations/action=load/songId trả annotations, revision, schemaVersion=2, instruments.
POST action=save nhận songId, annotations và revision bắt buộc; trả document mới.
POST action=instrument_save nhận instrumentId (mới: để trống), name và registryRevision.
GET action=instruments trả instruments (id, name, color dạng #RRGGBB) và registryRevision. POST vẫn requireAdmin + Origin/CSRF middleware hiện hành.
File JSON lưu nguyên tử dưới khóa riêng; kiểm tra revision và ghi trong cùng khóa. Không đổi SQLite/migration.

## Lát triển khai và nghiệm thu

1. Kho dữ liệu/API: test cô lập legacy, hai nhạc cụ cùng vị trí, revision xung đột, dữ liệu lỗi, danh mục và ghi nguyên tử.
2. Module chung: checkbox/lưu lựa chọn, CRUD, guest chỉ đọc, lỗi/retry, bài cũ trả muộn, cuộn không mở editor.
3. Ghép hai UI và QA: sheet thật, nhiều trang/khuông, resize/zoom, 360/390/820/1366; PHP gate và Chromium regression. Không ghi DB/storage nguồn.

Không chạy sync, không merge main, không thay bảng quyết định/chữ ký roadmap.

## Hướng dẫn sử dụng

### Người đọc

1. Mở bài ở chế độ **Bản Nhạc** trong Modern hoặc Classic, bấm **Nhạc cụ** trên toolbar (điện thoại cũng có nút này).
2. Tick các nhạc cụ muốn xem, hoặc **Chọn tất cả** / **Ẩn tất cả**. Bộ lọc được nhớ trong `sheetapp_annotation_layers` trên thiết bị, độc lập StageLens.
3. Nhãn trên sheet hiện nhạc cụ và chỉ dẫn; nhãn quá dài được cắt gọn. Mỗi nhạc cụ có màu mặc định dùng chung trên mọi bài và hai giao diện; từng ghi chú có thể chọn màu riêng. Tên nhạc cụ vẫn hiện bên cạnh màu; bật nhiều lớp thì các dòng được xếp riêng.
4. Chạm nhãn để mở ghi chú đầy đủ trong menu; danh sách ghi rõ ô nhịp và khuông. Khi đang soạn, admin bấm nhãn để sửa trực tiếp.
5. **Tải lại ghi chú** lấy phiên bản mới từ máy chủ. Khi lỗi tải có **Thử tải lại**; không coi lỗi mạng là bài chưa có ghi chú.

### Admin

1. Mở bài ở **Bản Nhạc** → **Nhạc cụ** trên toolbar → chọn **Nhạc cụ đang soạn** → **Ghi chú**. Bảng đóng lại để sheet có chỗ thao tác; toolbar có dấu đang soạn.
2. Chạm **+ màu vàng** tại nốt, phía trên dòng hợp âm. Chọn mẫu gợi ý hoặc nhập chữ tự do (tối đa 500 ký tự). Ở **Màu ghi chú**, chọn một màu mẫu hoặc màu tùy chọn; bấm **Theo màu nhạc cụ** để dùng lại mặc định, rồi **Lưu ghi chú**. Trên màn hình rộng ô nhập nằm gần điểm vừa chọn; điện thoại dùng dialog vừa màn hình.
3. Mẫu theo nhạc cụ: Trống có Fill/Vào điệu/Ngắt/Crash/Nhẹ/Tăng dần; Guitar có Quạt/Rải/Palm mute/Ngắt/Vào mạnh; Keyboard có Đệm nền/Rải/Giữ hợp âm/Dạo/Ngưng; Bass có Nốt gốc/Đi đều/Chạy nối/Ngắt/Vào lại; Hát có Vào hát/Nhẹ/Mạnh/Lấy hơi/Ngắt. Nhạc cụ mới dùng mẫu Chung. Bấm nhiều mẫu nối bằng ` · `; đổi nhạc cụ không xóa chữ đã nhập.
4. Vị trí đã có ghi chú của nhạc cụ đang soạn hiện chữ thay dấu +; bấm chữ để sửa/xóa trực tiếp. Những ghi chú cũ trùng điểm vẫn được giữ độc lập. Cũng có thể dùng **Sửa** trong danh sách chi tiết. Mở toolbar → **Kết thúc ghi** để thoát.
5. Trong toolbar, chọn nhạc cụ → **Màu nhạc cụ** → **Lưu màu nhạc cụ**. Màu áp dụng cho những ghi chú đang theo màu mặc định của nhạc cụ, qua các bài và cả hai giao diện. Ghi chú đã chọn màu riêng giữ nguyên màu của nó. Màu nằm trên viền nhãn, ô chọn và dialog; nội dung giữ màu chữ dễ đọc. Đây là màu theo **nhạc cụ**, không phải màu riêng theo điện thoại/máy tính. Màu ghi chú cũ vẫn được giữ trong dữ liệu để tương thích; màu hiển thị lấy theo nhạc cụ nếu chưa chọn màu riêng.
6. Nhập **Nhạc cụ mới** → **Thêm nhạc cụ** để bổ sung danh mục. Không thay quyền thành viên hoặc bộ lọc StageLens.
7. Nếu máy chủ báo phiên khác đã thay đổi: giữ dialog mở, chọn **Tải lại dữ liệu**, kiểm tra rồi lưu lại bản nháp. Lỗi mạng giữ nguyên chữ đã nhập; màu đang chọn cũng giữ qua các lần sheet dựng lại.
8. Nếu bản nhạc đã thay đổi, dùng **Đặt lại vị trí** trên thẻ cảnh báo rồi chọn điểm mới; không tự chuyển ghi chú sang nốt khác.

## Vận hành và tương thích

- Ghi chú vẫn ở `storage/data/annotations/<songId>.json`; danh mục ở `.instruments.json`. Backup cả thư mục này trước khi đưa phiên bản lên máy chủ. Không cần migration SQLite.
- Client cũ thiếu revision sẽ bị từ chối lưu (422), giúp tránh xóa lớp nhạc cụ của client mới. Tải lại trang để nhận frontend mới.
- `AnnotationService::load()` giữ cách đọc danh sách cũ cho PHP. Ghi qua API document có revision; không gọi cơ chế ghi toàn danh sách không kiểm tra phiên bản.
- Dữ liệu cũ chưa có dấu cấu trúc được gắn theo chỉ số ô nhịp/nốt cũ; hệ thống không thể tự biết một lần thay XML diễn ra trước khi thêm tính năng này.
- Không nạp API ghi chú ở lần đọc đầu nếu người dùng chưa mở bảng/chưa lưu bộ lọc bật. Khi đã chọn lớp, tải bất đồng bộ theo bài; có token chặn kết quả đến muộn.
- CSS/geometry/panel/canvas được đưa vào precache. Cache giao diện dùng cả phiên bản và manifest hash, giúp thay đồng bộ module; cache MusicXML và gói `sheetapp-offline-*` được giữ lại.
- Khi thay tài nguyên nằm trong manifest, chạy `php tools/generate_sw_manifest.php` ở bản build/cài đặt cách ly và đưa `sw.js` mới vào bản phát hành. Không chạy sync tự push.
- Chưa cung cấp tải ghi chú ngoại tuyến, bản phối riêng từng chương trình, ghi chú theo đoạn, hoặc xuất PDF chuyên biệt.

## Màu riêng và liên kết hai giao diện

- Màu riêng nằm trong `customColor` của từng ghi chú (hex `#RRGGBB`), không đổi màu nhạc cụ hay ghi chú khác. Không có trường này nghĩa là theo màu nhạc cụ; reset sẽ bỏ trường màu riêng. Máy chủ kiểm tra và chuẩn hóa mã màu. Metadata `color` cũ vẫn được giữ để tương thích.
- Nhãn trên sheet, thẻ chi tiết và viền ô soạn cùng hiển thị màu đang áp dụng; chữ dùng màu dễ đọc trên nền nhạt. Bảng màu có tên và trạng thái chọn để dùng được bằng bàn phím.
- Classic và Modern đọc/ghi cùng API và file JSON. Khi chuyển giao diện qua các nút có sẵn, liên kết giữ bài đang mở, tông, chế độ sheet/lời, kiểu lời, bộ hợp âm và compact nếu có trong URL. Bắt đầu soạn sẽ nhớ lớp hiển thị để ghi chú được tải lại khi đổi giao diện hoặc tải lại trang.
- Kiểm thử HTTP tạo/sửa ghi chú ở cả hai chiều Modern → Classic và Classic → Modern, xác nhận màu và nội dung vẫn giữ. Không cần nhập lại ghi chú khi đổi giao diện.
