# Báo cáo kiểm thử Thư viện và chế độ Rút gọn

## Đính chính yêu cầu Tối giản bản nhạc

**Kết luận cập nhật:** lần sửa trước mới bảo toàn nốt và ký hiệu khi gộp nốt trùng; **chưa tạo bản nhạc chỉ có giai điệu**. Đây là thiếu sót về cách hiểu yêu cầu. Chế độ Tối giản cần bỏ khuông/bè khóa Fa và bỏ bè hòa âm trên khóa Sol, chỉ để lại **một tuyến giai điệu** cùng lời ca và ký hiệu gắn với tuyến đó. Khi hai bè nhập vào một nốt, nốt ấy vẫn thuộc cả hai bè về mặt logic nhưng chỉ xuất hiện một lần trên bản tối giản.

### Bằng chứng từ mã và ba bài thật

| Bài | Nốt khóa Sol P1 | Nốt chùm thêm trên Sol | Nốt bè phụ riêng trên Sol | Nốt khóa Fa P2 |
|---|---:|---:|---:|---:|
| 001 | 71 | 29 | 1 | 71 |
| 011 | 168 | 66 | 17 | 182 |
| 021 | 154 | 63 | 12 | 148 |

`CompactScore.preprocessXML()` hiện chỉ bỏ nốt **trùng cùng thời điểm, cao độ, trường độ và khuông**. Vì vậy, nốt hòa âm khác cao độ trong P1 vẫn tồn tại; riêng bài 021, gần như toàn bộ 154 nốt P1 vẫn được đưa vào OSMD. `OSMDRenderer._applyCompactMode()` ẩn P2, nhưng `_ensureCompactLyricsReadable()` có thể khôi phục P2 nếu lời chồng. Việc gộp nốt chung đã bổ sung trước đó không giải quyết được hai điểm này.

### Quy tắc cần thực hiện

1. Xác định tuyến giai điệu theo **thời gian và bè** trong từng bài. Chọn đúng một nốt đang vang tại mỗi sự kiện của giai điệu; nốt hòa âm khóa Sol và toàn bộ khuông khóa Fa không còn trên bản tối giản. Nếu hai bè cùng dùng một nốt, giữ nốt đó một lần. Không suy luận “nốt có lời = giai điệu”: bài 021 ô nhịp đầu có D4 và G4 cùng lúc, nhưng MusicXML gắn lời vào D4; việc chọn cao độ giai điệu cần đối chiếu bản nhạc gốc.
2. Chuyển lời, dấu nối, dấu luyến và sắc thái thuộc giai điệu sang nốt còn giữ, theo đúng vị trí âm nhạc. Chỉ giữ đường nối/luyến khi hai đầu của nó còn thuộc tuyến giai điệu; không sao chép tùy tiện ký hiệu của bè hòa âm sang nốt khác cao độ.
3. Dàn trang lại lời trên **một khuông**: đủ khoảng ngang cho các âm tiết, tách các câu lời theo dòng và ngắt hệ khi cần. Lời chồng không được chữa bằng cách bật lại khóa Fa.
4. Kiểm thử trên bản XML thật và bản hiển thị: đối chiếu từng ô nhịp ở 001, 011, 021 và bài mẫu của người dùng; kiểm tra ở desktop lẫn điện thoại. Một ca đạt phải xác nhận cao độ giai điệu, thời điểm, lời và đường luyến, không chỉ đếm số nốt hoặc kiểm tra trang không lỗi.

**Trạng thái 2026-10-03:** đã triển khai tuyến giai điệu một khuông. Bản Tối giản chọn bè khóa Sol có nhiều nốt mang lời nhất (hòa thì ưu tiên số bè nhỏ), lấy nốt cao trong chùm của bè đó, bỏ nốt hòa âm và bè phụ; khi bè chính đang ngân hoặc nghỉ thì không thêm nốt bè phụ. Lời của nốt chùm được chuyển sang nốt giữ lại; nốt chung được ghi một lần nhưng giữ quan hệ hai bè. Dấu nối/luyến không đủ cặp sau khi lọc được bỏ để tránh đường cong sai. XML gốc không đổi và bật/tắt Tối giản khôi phục bản thường.

| Bài | Nốt khóa Sol gốc → Tối giản | Số âm tiết lời khóa Sol | Dấu còn hợp lệ trên giai điệu |
|---|---:|---:|---|
| 001 | 71 → 41 | 152 → 152 | 6 dấu luyến |
| 011 | 168 → 85 | 150 → 150 | 20 dấu nối |
| 021 | 154 → 79 | 182 → 182 | 48 dấu luyến |

Kiểm thử OSMD thật ở 320 px (bài 011), 390 px và 1366 px (bài 021): khuông Fa ẩn và **0 cặp lời chồng** theo ngưỡng giao nhau 3 px. Màn hình 320 px cho cuộn ngang bản nhạc rộng tối thiểu 370 px để lời vẫn đọc được. [Ảnh 011 ở 320 px](library-audit-20261002/compact-melody-011-320.png), [ảnh 021 ở 390 px](library-audit-20261002/compact-melody-021-390.png). Ca E2E bật/tắt ngay trên trang Thư viện đã đạt. Giới hạn: MusicXML không đánh dấu sẵn nốt nào là giai điệu trong mọi bản phối; quy tắc chọn bè/nốt cần đối chiếu thêm với những bài có giai điệu nằm dưới bè hòa âm.

Quét tự động **903/903 bản XML**: 898 bản giảm số nốt, 5 bản không có nốt cần giảm, 0 lỗi parse, 0 bản mất toàn bộ nốt, **0 bài mất âm tiết thuộc bè giai điệu**. Một số âm tiết ở bè hòa âm/đối đáp được bỏ theo mục tiêu một tuyến giai điệu; phép quét không xác nhận cao độ giai điệu đúng bằng tai trên cả 903 bài. Kiểm thử tập trung: **16/16 E2E đạt** (gồm trang thật bật/tắt), 283 file JS đạt cú pháp, ESLint đạt, PHP L5-3 đạt 56/56, hai file PHP sửa nhãn đạt kiểm tra cú pháp. Dữ liệu bài hát và SQLite gốc không bị chỉnh sửa.

## Bổ sung: một nốt ghi cho hai bè

MusicXML có thể ghi một nốt duy nhất khi hai bè nhập lại. Bộ xử lý hiện xác định các bè trên từng khuông và từng thời điểm: nếu chỉ có một nốt, không có nốt hoặc dấu nghỉ của bè khác kéo qua thời điểm đó, nốt được gắn với cả hai bè. Khi hai nốt trùng được gộp, quan hệ bè cũng được giữ trong thuộc tính `data-sheetapp-voices`. Bản nhạc vẫn vẽ một nốt; `CompactScore.getVoiceEvents()` trả nốt ấy trong cả hai bè khi cần tách logic. Nốt riêng và dấu nghỉ rõ ràng không bị nhận là nốt chung.

Ca kiểm thử mới trước khi sửa thất bại vì chưa có cách lấy quan hệ bè. Sau khi sửa: **9/9 ca Rút gọn đạt** trên Chromium, gồm nốt ghi một lần, dấu nghỉ, lời, dấu nối/luyến, nạp/vẽ bằng OSMD thật và đối chiếu cao độ/lời/dấu của bài 021; ESLint, PHP L5-3 (56/56) và `git diff --check` đạt. Trường hợp XML bỏ trống bè mà không ghi dấu nghỉ vẫn có thể mơ hồ về ý định biên soạn. Cần đối chiếu bài và ô nhịp cụ thể nếu phát hiện suy luận sai.

Ngày kiểm tra: 2026-10-02. Phạm vi: trang Thư viện trên cây làm việc `main` hiện tại. Báo cáo kiểm thử và phân tích; chưa sửa thuật toán Rút gọn hoặc dữ liệu bài hát.

> **Cập nhật cùng ngày:** lỗi Rút gọn đã được sửa sau lượt kiểm thử này. Các số liệu và ảnh trong các phần đầu là **trước khi sửa**; xem phần “Kết quả sau khi sửa” ở cuối báo cáo.

## Kết luận

**Có lỗi hiển thị thật ở chế độ Rút gọn.** Nút bật/tắt vẫn hoạt động và không phát sinh lỗi JavaScript, nhưng bản nhạc sau xử lý có thể mất dấu luyến/nối, đổi nốt, mất một số âm tiết và làm lời chồng lên nhau. Các bài 011 và 021 tái hiện rõ; bài 001 là mẫu đối chứng ít chồng chữ hơn. Kết quả này chỉ xác nhận trên các bài đã kiểm, chưa ngoại suy cho mọi bài trong thư viện.

Bài 001 và 021 có hai bè ở khóa Sol và hai bè ở khóa Fa (hai `part`, mỗi `part` có `voice` 1 và 2), đúng dạng bốn bè được phản ánh. Bài 011 còn có `voice` 3 trong cả hai khóa.

## Cách kiểm tra và an toàn dữ liệu

- Chạy `php tests/run_all_tests.php` với runner tạo SQLite và thư mục hợp âm tạm. SHA-256 của `storage/data/app.sqlite` trước/sau giữ nguyên: `1F56BE985605BCE69E6486BC362A21FA2B35ECF4E25776E3C0A6DC82FAF7A4FA`.
- Kiểm tra cú pháp JavaScript bằng `npm run check:syntax`; kiểm tra lint các thư mục được cấu hình bằng `npx eslint assets/js editor manager live-band`.
- So sánh MusicXML gốc với XML đưa vào OSMD khi Rút gọn, và ảnh trình duyệt Chromium 1366×900. Đếm cặp chữ SVG 18 px có vùng vẽ đè lên nhau hơn 3 px theo cả hai chiều. Đây là phép đo phát hiện chồng chữ, không phải điểm chất lượng thẩm mỹ tổng quát.
- Phép đếm 18 px ở lần đầu cũng tính các dấu nối âm tiết “-”; không được hiểu là toàn bộ số cặp **từ** chồng nhau. Lượt kiểm sau sửa dùng riêng các nút lời của OSMD để đo chính xác phần chữ lời.
- Bộ E2E rộng chạy trên **bản sao thư mục và dữ liệu riêng** tại `C:\xampp\htdocs\sheetapp2-audit-20261002\sheetapp2`, qua PHP server cổng 8766. Kết quả của bộ này cần phân loại lỗi sản phẩm và lỗi do PHP built-in server khác Apache.

## Kết quả kiểm tra nền

| Kiểm tra | Kết quả |
|---|---|
| PHP tổng hợp | 164/164 regression suites, 3.205 check đạt, 0 lỗi; runner báo DB/storage thật nguyên vẹn. |
| JavaScript syntax | 281/281 file đạt. |
| ESLint `assets/js editor manager live-band` | Đạt. |
| ESLint kèm `learn` | Lệnh dừng do `learn` bị ignore toàn bộ trong cấu hình ESLint; đây là vấn đề cấu hình kiểm thử, chưa chứng minh lỗi mã `learn`. |
| Nút Rút gọn bài 011 | Bật: render count 1→2 và URL có `compact=true`; tắt: count 2→3, URL bỏ tham số; không có page error. |

## Lỗi Rút gọn đã tái hiện

| Bài | Nốt gốc → Rút gọn | Dấu nối/luyến gốc → Rút gọn | Âm tiết XML gốc → Rút gọn | Cặp chữ đè nhau trên hình gốc → Rút gọn |
|---|---:|---:|---:|---:|
| 001 — Hỡi Thánh Vương | 142 → 80 | luyến 14 → 0 | 152 → 152 | 0 → 0 |
| 011 — Ngợi Khen Cứu Chúa | 350 → 184 | nối 120 → 0 | 212 → 207 | 4 → 29 |
| 021 — Cứu Chúa Siêu Việt | 302 → 148 | nối 8 → 0; luyến 96 → 0 | 182 → 182 | 17 → 116 |

Ảnh đối chiếu: bài 011 [bản thường](library-audit-20261002/compact-011-normal.png) / [Rút gọn](library-audit-20261002/compact-011-on.png); bài 021 [bản thường](library-audit-20261002/compact-021-normal.png) / [Rút gọn](library-audit-20261002/compact-021-on.png).

Ở khung điện thoại 390 px, phép đo cùng tiêu chí trên chữ lời 20 px cho thấy bài 011 tăng từ 5 lên 24 cặp đè nhau, bài 021 tăng từ 17 lên 522 cặp. [Ảnh bài 011 khi Rút gọn trên điện thoại](library-audit-20261002/compact-011-mobile-390.png). Số cặp phụ thuộc cỡ chữ và bố cục, dùng để xác định lỗi chứ không so chất lượng giữa các bài.

Thử tách từng tùy chọn (vẫn bật Rút gọn, đếm cặp chữ chồng):

| Bài | Không cắt nốt/bè/khóa Fa | Chỉ ẩn khóa Fa | Ẩn khóa Fa + bè phụ | Cài đặt mặc định (thêm ẩn nốt chùm) |
|---|---:|---:|---:|---:|
| 011 | 4 | 3 | 29 | 29 |
| 021 | 17 | 106 | 116 | 116 |

**Nguyên nhân xác nhận từ mã và dữ liệu thử:**

1. `assets/js/osmd-renderer.js` trong `preprocessXML()` xóa mọi `<slur>`, `<tied>` và `<tie>` khi bật Ẩn Bè Phụ, kể cả ký hiệu gắn trên nốt còn giữ. Bài 011 và 021 cho thấy số dấu này về 0.
2. Cùng bước đó xóa nốt có `voice > 1` trực tiếp. Bài 011 mất 5 phần tử lời trong XML sau xử lý. Các quan hệ giữa bè, lời và thời điểm nốt cần được giữ hoặc dựng lại trước khi render.
3. Ẩn Nốt Chùm đang lấy cao độ lớn nhất rồi thay cao độ nốt đầu của mỗi chùm. Đo trên XML đã xử lý: 001 có 59 nốt đầu bị đổi cao độ, 011 có 133, 021 có 116. Đó là hành vi thuật toán hiện tại; cần đối chiếu giai điệu chủ đích trước khi coi từng nốt đổi là đúng/sai.
4. Ẩn Khóa Fa không cần cắt XML nhưng riêng bài 021 đã làm lời chồng từ 17 lên 106 cặp. Đây là lỗi bố cục sau khi giảm số khuông, không thể chữa chỉ bằng việc giữ dấu luyến.

## Hướng sửa đề xuất

Ưu tiên xử lý: **P1** cho mất dấu nối/luyến và lời chồng, vì bản nhạc có thể bị đọc hoặc hát sai; **P1** cho việc tự đổi cao độ khi ẩn nốt chùm cho đến khi xác định rõ bè giai điệu cần giữ; **P2** cho việc cập nhật các E2E L0/L1 cũ theo vị trí điều khiển mới.

- Giữ nguyên MusicXML gốc như nguồn chuẩn. Thiết kế thuật toán rút gọn theo **vị trí thời gian, bè và khuông**, chọn giai điệu cần giữ cho từng nhịp trước khi bỏ nốt trùng; không chọn cao độ cao nhất trên toàn ô nhịp như đại diện mặc định.
- Khi bỏ một bè, chuyển các lời hoặc dấu luyến/nối cần thiết sang nốt được giữ tại cùng vị trí; chỉ bỏ ký hiệu thuộc nốt thực sự bị bỏ. Không xóa toàn bộ `<tie>/<tied>/<slur>`.
- Với bài nhiều khổ lời, đo giới hạn độ rộng âm tiết trước khi thu hẹp khuông/ô nhịp. Nếu không còn đủ chỗ, giữ khuông Fa hoặc tăng khoảng cách để bảo đảm lời không đè nhau.
- Dùng bài 001, 011, 021 và bài thực tế người dùng cung cấp làm tập nghiệm thu. Test phải so MusicXML gốc/Rút gọn ở mức nốt, lời, dấu và kiểm tra chồng chữ trên Chromium + WebKit hoặc thiết bị thật.

## Trạng thái E2E giao diện rộng

**148/148 ca Chromium đạt** trên bản sao độc lập, chạy các spec `library-r*`, `library-mobile-hd-tlh-switch` và `library-l1-mobile-view` ([nhật ký chạy](library-audit-20261002/current-ui-e2e-audit.log)). Phạm vi gồm điều khiển thanh công cụ, các mức rộng 320–1920 px, menu Công cụ, chỉnh/lưu hợp âm, HD/TLH, chế độ đọc/biểu diễn, cuộn trang, truy cập bàn phím và các kiểm tra accessibility có trong spec. Các ca này không kiểm tra tính toàn vẹn dấu luyến/nối hay va chạm lời sau khi Rút gọn, nên kết quả đạt không phủ nhận lỗi đã tái hiện ở trên.

Đã thử khởi chạy toàn bộ bộ E2E cũ (351 ca Chromium) và dừng sau khoảng 132 ca vì nhiều spec L0/L1 vẫn tìm nút trực tiếp trên toolbar trong khi giao diện hiện tại đặt nút trong menu Công cụ. Ví dụ `library-l1-verse-selection.spec.js` chờ click `#btn-verse-mode` đang ẩn; ảnh trạng thái lúc lỗi cho thấy menu Công cụ hiện trên toolbar. Các thất bại kiểu này là **test không khớp giao diện hiện tại**, chưa đủ bằng chứng kết luận tính năng tương ứng hỏng. Cần cập nhật test rồi chạy lại toàn bộ nếu muốn dùng nó làm cổng phát hành.

## Giới hạn

- Chưa kiểm tra iPhone/Android vật lý. WebKit trên máy này từng không khởi chạy được ở phiên trước.
- Tại thời điểm kiểm thử ban đầu chưa sửa mã Rút gọn. Không cập nhật trạng thái ticket hay quyết định của chủ dự án.

## Kết quả sau khi sửa — 2026-10-02

- `assets/js/compact-score.js` gộp các nốt của hai bè chỉ khi **cùng khuông, cùng thời điểm, cùng cao độ và cùng trường độ**. Nốt khác nhau được giữ. Nếu nốt chung là đầu một chùm, nốt riêng kế tiếp được chuyển thành đầu chùm hợp lệ. Lời, dấu nối và dấu luyến của nốt gộp được giữ trên nốt còn lại.
- `assets/js/osmd-renderer.js` không còn xóa toàn bộ bè phụ, dấu luyến/nối hoặc tự thay nốt mang lời bằng nốt cao nhất. Nếu việc ẩn khóa Fa khiến các nút lời thực sự chồng nhiều, trình vẽ tự giữ khuông Fa để ưu tiên khả năng đọc. Tùy chọn và trợ giúp được đổi tên để mô tả đúng hành vi gộp nốt.
- Ca mới `e2e/library-compact-score.spec.js`: **5/5 đạt**, gồm nốt dùng chung, nốt riêng, lời/dấu nối/luyến, thứ tự MusicXML, nốt chùm và phương án giữ khuông khi lời chồng. Trước khi sửa, hai ca đầu đã **FAIL đúng lỗi** (mất E4 và đổi C4 thành G4).
- Hồi quy PHP: **164 bộ, 3.205 kiểm tra đạt, 0 lỗi** ([nhật ký](library-audit-20261002/compact-php-final.log)). Cú pháp JavaScript: **283 file đạt**; ESLint các file sửa đạt. E2E giao diện liên quan trên bản sao dữ liệu: **72/72 ca Chromium đạt** ([nhật ký](library-audit-20261002/compact-e2e-final.log)). MusicXML mẫu có nốt dùng chung đã nạp thành công trong OSMD thật.
- Kiểm tra ảnh sau sửa: bài 021 ở 1366 px và 390 px, bài 011 ở 390 px đều có **0 cặp nút lời SVG chồng nhau** theo ngưỡng 3 px; không có lỗi JavaScript. Ảnh: [021 desktop](library-audit-20261002/compact-021-fixed-desktop.png), [021 điện thoại](library-audit-20261002/compact-021-fixed-mobile.png), [011 điện thoại](library-audit-20261002/compact-011-fixed-mobile.png).

Giới hạn: chưa có bản nhạc cụ thể của người báo lỗi để đối chiếu ý định bè giai điệu từng nhịp. Thuật toán hiện bảo toàn mọi cao độ khác nhau thay vì tự suy đoán bỏ một bè; đây là lựa chọn an toàn khi XML không ghi rõ nốt nào là giai điệu chủ. Chưa kiểm tra trên thiết bị vật lý hoặc WebKit.

Bằng chứng RED trước khi sửa, chạy `npx playwright test --config=scratch/compact-playwright.config.js --reporter=list`:

```text
2 failed
Expected value: "E4"; Received array: ["C4", "D4"]
Expected: "C"; Received: "G"
```

Khi thêm xử lý ban đầu vào cùng `osmd-renderer.js`, sáu bộ PHP chặn giới hạn 600 dòng ([nhật ký FAIL](library-audit-20261002/compact-php-before-extraction.log)); đã tách module và chạy lại toàn bộ đạt. Kiểm tra L5-3 được chuyển từ tìm chuỗi mã cũ sang gọi thật `CompactScore.preprocessXML()` và xác nhận `XmlDocCache.getClonedDoc()` chạy một lần.
