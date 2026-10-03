# Rà soát trải nghiệm soạn hợp âm trên điện thoại

Ngày: 2026-10-02
Phạm vi: trang Thư viện (`index.php`), luồng xem và soạn hợp âm trên điện thoại. Phần đầu là đánh giá trước sửa; trạng thái triển khai nằm ở cuối báo cáo.

## Kết luận ngắn

**Cần có công tắc chọn rõ HD / TLH.** Nút hiện tại có trên thanh dưới nhưng chạm sẽ lần lượt đi qua mọi bộ hợp âm và cả các mục thao tác trong danh sách chọn. Vì thế người dùng không thể tin rằng một chạm luôn đổi HD sang TLH hoặc ngược lại. Khi màn hình rộng tối đa 350 px, chữ HD/TLH bị ẩn; khó biết bộ nào đang được xem. Vấn đề người dùng báo “chưa vẽ/soạn được trên điện thoại” cần được xem là lỗi trải nghiệm đầu cuối, dù kiểm thử hiện có đã xác nhận nút **Soạn** xuất hiện cho Admin/HD và vào được chế độ đặt hợp âm.

Trong báo cáo này, “vẽ” được hiểu là **chạm nốt để đặt hợp âm** trên bản nhạc. Nếu ý định là vẽ nét bút/ghi chú tự do, đó là luồng `annotation-canvas.js` khác và cần khảo sát riêng.

## Điều đã xác nhận từ mã và kiểm thử hiện có

| Quan sát | Bằng chứng | Tác động |
|---|---|---|
| Thanh điện thoại đã có nút bộ hợp âm và nút Soạn riêng | `includes/toolbar.php:175`, `includes/toolbar.php:409-414` | Không cần thêm một hệ điều khiển mới; cần sửa hành vi và độ rõ của điều khiển sẵn có. |
| Nút bộ hợp âm lấy `selectedIndex + 1` của toàn bộ `<select>` | `assets/js/mobile-controller.js:51-70` | Có từ ba bộ trở lên thì HD → TLH nhưng TLH → bộ thứ ba, không quay về HD. |
| `<select>` chứa bộ cá nhân và các lựa chọn `__create_new_set__`, `__open_members__`, `__open_manager__` | `assets/js/chord-canvas.js:479-528` | Nút điện thoại có thể đi vào mục thao tác; `switchSet()` bỏ qua mục `__...`, tạo cảm giác bấm mà không đổi. |
| Màn hình tối đa 350 px ẩn nhãn chữ của nút bộ hợp âm | `assets/css/library-polish.css:1917-1931` | Trạng thái HD/TLH không đọc được bằng mắt trên màn hình rất hẹp. |
| Nút Soạn chỉ hiện cho tài khoản có quyền; từ dạng Lời, chạm Soạn chuyển về Bản nhạc | `assets/js/auth.js:205-215`, `assets/js/mobile-controller.js:102-113` | Khách không thể soạn; người có quyền cần được báo rõ đang sửa bộ nào sau khi chuyển dạng xem. |
| Với HD trống, trang có thể đang hiển thị hợp âm TLH dù bộ đang chọn vẫn là HD | `assets/js/chord-canvas.js:290-292`, `assets/js/chord-canvas.js:543-548` | Nhãn chỉ ghi “HD” dễ làm người dùng tưởng đang nhìn hợp âm HD. |
| Bảng chọn hợp âm mobile chiếm khoảng 38% màn hình và kiểm thử được mở bằng phím `C` | `assets/css/library-polish.css:1252-1278`, `e2e/library-r2-5-mobile-palette.spec.js` | Kiểm thử palette chưa chứng minh người dùng chỉ dùng cảm ứng có thể vào Soạn, chọn HD/TLH, đặt, lưu, tải lại. |
| E2E mới xác nhận Admin/HD thấy Soạn, bấm được và thấy điểm đặt hợp âm | `e2e/library-r7-responsive.spec.js:228-249` | Chưa xác nhận vòng đời dữ liệu từ một lần chạm đến sau reload trên điện thoại thật. |

Các kết luận trên là **phân tích source và phạm vi test**, chưa phải kết quả thử trên iPhone/Android vật lý. Báo cáo R7 trước đó cũng ghi chưa thử thiết bị thật (`docs/ROADMAP7_IMPLEMENTATION_REPORT.md`).

## Trải nghiệm cần đạt

1. Mở bài trên điện thoại: nhìn thấy rõ **“Đang xem: HD”** hoặc **“Đang xem: TLH”**. Nếu HD trống và đang hiển thị TLH thay thế, nhãn phải nói rõ **“HD trống · đang hiện TLH”**.
2. Chạm bộ hợp âm: chọn trực tiếp **HD** hoặc **TLH**. Bộ cá nhân nằm trong mục **Bộ khác…**, không chen vào thao tác đổi nhanh. Trạng thái chọn phải còn rõ ở 320 px và với trình đọc màn hình.
3. Chạm **Soạn**: nếu có quyền sửa bộ hiện tại, hiện rõ tên bộ đích rồi cho chạm nốt và chọn hợp âm. Nếu đang xem TLH hoặc HD mà tài khoản không được sửa trực tiếp, hộp thoại phải nêu bộ sẽ được sửa/sao chép và yêu cầu xác nhận trước khi ghi đè.
4. Chạm một nốt, đặt một hợp âm, chờ lưu, tải lại: hợp âm còn đúng bài và đúng bộ. Trạng thái **Đang lưu / Đã lưu / Lỗi lưu** phải nhận ra được trên điện thoại.
5. Chuyển HD ↔ TLH khi có chỉnh sửa chưa lưu: bảo toàn dữ liệu hoặc chặn chuyển bằng thông báo cụ thể; không ghi hợp âm sang nhầm bộ.

## Đề xuất theo ưu tiên

| Ưu tiên | Việc cần làm | Nghiệm thu |
|---|---|---|
| **P0** | Đổi nút bộ hợp âm thành công tắc HD ↔ TLH thật sự hoặc bảng chọn hai mục rõ ràng. Không dùng thứ tự `<option>` để quyết định. | Với danh sách có HD, TLH, BH và các mục `__...`, 10 lần chạm liên tiếp chỉ luân phiên HD/TLH; không mở mục quản lý, không chạm nhầm bộ BH. |
| **P0** | Giữ nhãn HD/TLH và trạng thái fallback đọc được trên 320/350/390 px; kiểm tra vùng chạm ít nhất 44 px. | Ở mọi kích thước trên, người thử chỉ nhìn màn hình biết bộ đang chọn và nguồn hợp âm thực đang hiện. |
| **P0** | Kiểm thử cảm ứng hoàn chỉnh cho Admin, chủ HD, Ban Hát và khách trên DB/storage thử cô lập. | Chạm Soạn → chạm nốt → chọn hợp âm → thấy Đã lưu → reload vẫn đúng; khách không có thao tác ghi; người không có quyền không ghi đè HD/TLH. |
| **P1** | Làm rõ luồng Soạn trên HD/TLH: nhãn “Đang sửa bộ …”, lời giải thích khi bị chuyển sang bộ cá nhân, cảnh báo khi sao chép ghi đè. | Người dùng biết chính xác dữ liệu sẽ lưu vào bộ nào trước lần chạm đầu tiên. |
| **P1** | Kiểm tra điểm chạm nốt, bảng hợp âm, bàn phím ảo, xoay màn hình và safe area trên iOS Safari/Android Chrome. | Không có nốt hoặc nút Xong/Lưu bị che; thao tác chạm không kích hoạt cuộn trang ngoài ý muốn. |
| **P2** | Cân nhắc lối vào “Bộ khác…” cho người cần xem bộ cá nhân và so sánh HD/TLH. | Không làm dài thêm chuỗi chạm đổi nhanh HD/TLH. |

## Kịch bản kiểm thử tối thiểu còn thiếu

- Bài có HD đầy đủ; bài HD trống đang fallback TLH; bài có thêm bộ BH.
- 320, 350, 390 px; dọc và ngang; guest, Ban Hát, Admin, chủ HD.
- Mỗi vai trò chuyển HD → TLH → HD bằng cảm ứng, xác nhận cả nhãn và hợp âm hiển thị.
- Người có quyền từ dạng Lời chạm Soạn, đặt hợp âm trên bản nhạc, chờ lưu, tải lại và kiểm tra đúng `song_id`/tên bộ.
- Lỗi mạng, 403 và 409 phải hiện lỗi lưu thật; rời bài hoặc đổi bộ khi đang lưu không được báo “Đã lưu” giả.
- Thử trực tiếp trên ít nhất một iPhone Safari và một Android Chrome; ghi lại video ngắn các thao tác không làm được nếu lỗi vẫn còn.

## Giới hạn và quyết định cần chốt trước khi sửa mã

- Giữ Core Rules: HD được chọn mặc định, HD rỗng hiện TLH thay thế, không xóa HD/TLH, không thay đổi quyền sửa HD/TLH.
- Báo cáo này chưa kết luận chính xác nguyên nhân của phản ánh “chưa vẽ được” trên thiết bị của người dùng; cần thiết bị, tài khoản, bài hát và thao tác tái hiện để phân biệt lỗi quyền, điểm chạm, bảng hợp âm hay lưu dữ liệu.
- Các thay đổi đang nằm chưa commit trên nhánh `main`; theo quy định dự án, phần triển khai tiếp theo cần được bố trí trên `feature/roadmap5` và không dùng `sync.bat`/`sync.sh` tự push. Báo cáo này không đánh dấu ticket hoặc quyết định của chủ dự án là hoàn thành.

## Cập nhật triển khai ngày 2026-10-02

- Đã sửa nút điện thoại để chỉ chuyển giữa HD và TLH, không còn duyệt qua bộ cá nhân hoặc mục quản lý.
- Ở màn hình 320–350 px, nhãn bộ hợp âm được giữ lại; khi HD trống và đang hiện TLH, nhãn hiện `HD→TLH` cùng mô tả rõ cho trình đọc màn hình.
- Khi đang Soạn, thao tác đổi bộ bị chặn và có hướng dẫn hoàn tất Soạn trước, tránh chuyển bộ giữa phiên chỉnh sửa.
- Kiểm thử mới `e2e/library-mobile-hd-tlh-switch.spec.js` tái hiện lỗi RED (TLH chuyển nhầm sang BH; đổi bộ khi đang Soạn), sau sửa đạt **7/7 trên Chromium**. Kiểm thử cảm ứng bao phủ khách, Ban Hát, Admin, chủ HD, 403, 409 và mất mạng; các request ghi hợp âm đều được API giả lập chặn, không ghi vào DB/storage thật. WebKit trên máy thử không khởi chạy được (`browserType.launch` thoát trước khi mở trang), nên chưa có kết quả WebKit cho thay đổi này.
- Phần kiểm tra trên iPhone/Android vật lý vẫn cần nghiệm thu riêng. Mã nằm trong cây làm việc `main` hiện hành vì `feature/roadmap5` đang được checkout tại worktree khác có thay đổi riêng; chưa commit/push/deploy.

Bằng chứng kiểm thử trên bản đang chạy ở `127.0.0.1/sheetapp2`, dùng cấu hình Playwright tạm không chạy global setup/teardown:

```text
RED 1: Expected: "HD"; Received: "BH" (lần chạm thứ hai từ TLH).
RED 2: Expected: "HD"; Received: "default" (đổi bộ khi còn Soạn).
PASS: npx playwright test e2e/library-mobile-hd-tlh-switch.spec.js --config=scratch/mobile-test.config.js --reporter=line
      7 passed (23.1s)
ESLint: npx eslint assets/js/mobile-controller.js e2e/library-mobile-hd-tlh-switch.spec.js → exit 0.
```

`scratch/mobile-test.config.js` chỉ được dùng để chạy kiểm thử mà không tác động dữ liệu thật và đã xoá sau khi kiểm tra.
