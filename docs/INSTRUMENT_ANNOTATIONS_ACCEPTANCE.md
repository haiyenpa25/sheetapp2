# Nghiệm thu ghi chú theo nhạc cụ

Ngày: 2026-10-20. Phạm vi được chủ dự án duyệt trong hội thoại: mở rộng ghi chú trên sheet cho nhiều nhạc cụ, ở cả Modern và Classic. Hướng dẫn: [INSTRUMENT_ANNOTATIONS.md](INSTRUMENT_ANNOTATIONS.md).

## Kết quả sử dụng

- Admin chọn nhạc cụ rồi thêm/sửa/xóa chỉ dẫn tại điểm trên sheet; nhiều ghi chú cùng điểm có ID riêng. Giữ cả lựa chọn màu và biểu tượng trước đây.
- Người đọc tick một/nhiều lớp, hiện tất cả hoặc ẩn tất cả; nhớ lựa chọn trên thiết bị. Bộ lọc độc lập StageLens.
- Danh mục mặc định Chung/Guitar/Keyboard/Bass/Trống/Hát; admin bổ sung nhạc cụ trong bảng ghi chú.
- Nhãn tự tránh ký âm, lời và cả hai kiểu lớp hợp âm của Modern/Classic. Điểm dày dùng nhãn thu gọn; chạm mở đúng ghi chú toàn văn.
- Mốc theo ô nhịp/khuông/thời điểm âm nhạc; dựng lại khi render/zoom/resize. Thay cấu trúc XML thì yêu cầu kiểm tra/đặt lại vị trí thay vì tự gắn sang nốt khác.
- Lưu theo revision, khóa và thay file nguyên tử. Lỗi lưu giữ bản nháp; xung đột 409 có thể tải dữ liệu mới rồi lưu lại. GET không tạo file cho bài chưa có ghi chú.
- Quyền ghi vẫn chỉ admin, kiểm tra ở API. Mất quyền đóng editor; chuyển sang soạn hợp âm kết thúc soạn ghi chú. Không đổi Core Rule, quyền role hay SQLite schema.
- Cache giao diện được gắn manifest hash và precache các module ghi chú cùng CSS; nâng cấp không trộn mã cũ/mới, giữ gói nhạc ngoại tuyến hiện hữu.

## Kiểm thử

| Phạm vi | Kết quả |
|---|---|
| Chromium, tính năng trên bản cuối | **22/22 PASS**: 16 ca thành phần, 5 ca HTTP/hai trang thật, 1 ca nâng cấp PWA |
| WebKit, thành phần UI | **16/16 PASS**; cùng bộ thành phần cũng đạt 16/16 Chromium |
| PHP, service ghi chú cô lập | **24/24 check PASS**, gồm 23 hành vi và 1 kiểm tra có phương thức |
| PHP, cổng tổng hợp | **175/175 suite, 3.423 check PASS**, 333 PHP lint; 2.720 hành vi / 703 static, không skip/fail |
| JavaScript syntax | **330 file PASS** |
| ESLint phần sửa | **PASS**; khai báo global Service Worker `clients` bằng CLI |

Hai trang thật đã kiểm tra ở **1366, 820, 390, 360 px**: tạo/lưu/tải lại, không tràn ngang; nhiều nhãn không chồng chữ/hợp âm và không chồng nhau sau khi bố cục ổn định. Dữ liệu HTTP được snapshot/khôi phục trong bản Apache thử riêng. Ca cuộn, nhiều SVG/khuông, phách tương đương, tải muộn, retry, 409 và bàn phím có kiểm tra hành vi riêng.

Trước đợt chốt tương thích và GET chỉ đọc, toàn bộ cấu hình ROADMAP6 đạt **119/119 Chromium**. Sau đó đã chạy lại toàn bộ **22 ca tính năng** trên bản cuối và cổng PHP. Hai engine có ca riêng cho môi trường thiếu `randomUUID` và giữ focus sau khi thẻ ghi chú được dựng lại. Không coi đây là kết quả toàn bộ bộ E2E cũ của dự án; WebKit ở đây là kiểm tra thành phần, không phải Safari/iPad phần cứng.

## Bằng chứng thô

- [PHP trước thay đổi](instrument-annotations-evidence/php-red.txt).
- [Các ca trình duyệt trước sửa](instrument-annotations-evidence/browser-red.txt): chức năng mới, va chạm nhãn Classic, quyền/mode, retry/cache, chi tiết thu gọn, focus, màu/icon, ID dự phòng và PWA.
- [PHP bản cuối](instrument-annotations-evidence/php-final.txt).
- [Trình duyệt](instrument-annotations-evidence/browser-final.txt): hồi quy, các ca tính năng cuối và hai engine.
- [Syntax, lint và checksum nguồn](instrument-annotations-evidence/quality.txt).

Log được xuất UTF-8, chỉ bỏ khoảng trắng cuối dòng. Ảnh kiểm tra nằm cục bộ trong `test-results/instrument-annotations/{modern,classic}-{1366,820,390,360}.png`, ngoài Git.

## Lệnh tái kiểm

Chạy PHP từ bản cài thử có DB/storage riêng; không chạy trên bản nguồn:

```powershell
$env:PATH = 'C:/Program Files/nodejs;C:/xampp/php;' + $env:PATH
$env:SHEETAPP_TEST_URL = 'http://localhost/sheetapp2-instrument-php-20261020'
php tests/run_all_tests.php
```

Chạy trình duyệt từ worktree; ca HTTP yêu cầu marker `.roadmap6-isolated`, URL/root khớp nhau và không trùng checkout nguồn:

```powershell
$env:SHEETAPP_TV_TEST_URL = 'http://localhost/sheetapp2-roadmap6-oct19-061901'
$env:SHEETAPP_TV_ISOLATED_ROOT = 'C:/xampp/htdocs/sheetapp2-roadmap6-oct19-061901'
npx playwright test -c e2e/roadmap6.config.js library-tv-instrument --project=chromium
npx playwright test -c e2e/roadmap6.config.js library-tv-instrument-annotations --project=webkit
```

## Giới hạn và bàn giao

- Bản đầu dùng bản phối mặc định chung theo bài. Chưa có lớp riêng từng chương trình, phạm vi nhiều ô nhịp, tải ghi chú offline hay xuất PDF chuyên biệt.
- Ghi chú cũ thuộc Chung và giữ metadata; dữ liệu chưa từng có dấu cấu trúc XML không thể tự phát hiện các lần thay sheet trong quá khứ.
- Chưa đo lại ngân sách 4G trong đợt này; không đánh dấu TV2/ROADMAP6 hoàn tất.
- DB nguồn giữ SHA256 `A91268B27DF548845C67B8F375C2D13B5899FFA4716BA99A00D59E4BC157CAC9`; checkout nguồn ở main không có thay đổi. Cổng PHP dùng bản cài riêng `sheetapp2-instrument-php-20261020`, khác bản HTTP E2E `sheetapp2-roadmap6-oct19-061901`, mỗi nơi có DB/storage riêng.
- Không chạy sync, không merge main/deploy, không sửa bảng quyết định/chữ ký. Xuất bản tiếp trên nhánh `feature/roadmap6-library-20261019` theo ủy quyền GitHub trước đó.

## Bản điều chỉnh toolbar và màu nhạc cụ — 2026-10-20

Theo yêu cầu chốt lại trong hội thoại: toolbar → nhạc cụ → Ghi chú → dấu + vàng tại nốt → mẫu/chữ tự do → lưu phía trên dòng hợp âm. Mỗi nhạc cụ có một màu chung do admin đổi; người xem tick một/nhiều/tất cả. Cả Modern và Classic dùng chung module và API. Màu của thiết bị vật lý không thuộc phạm vi này.

- Toolbar Modern ở 681–1100 px dùng hai hàng, giữ đầy đủ nút toàn màn hình, trước/sau, chuyển chế độ và nhạc cụ; ca touch ở 820 px không chồng/cắt nút.
- Vị trí đã có ghi chú của nhạc cụ đang soạn dùng chính nhãn để sửa, không hiện thêm dấu + của lớp đó. Dữ liệu trùng điểm từ bản cũ vẫn giữ nguyên.
- OSMD chừa khoảng trống theo số dòng và mức zoom. Các nhạc cụ có hàng riêng; nhãn tránh lời, nốt, hợp âm và không chuyển nhầm lên khuông khác. Bản rất dày có thể cao hơn vì thêm khoảng trống. Nội dung dài trên nhãn được cắt gọn, có toàn văn qua thao tác mở chi tiết.
- Màu dùng chung theo registry, mã hex được kiểm tra phía máy chủ, vẫn có bảo vệ revision/role. Registry cũ thiếu màu được bổ sung trong phản hồi mà không tự ghi file khi GET. Không migration SQLite.
- Bản PHP mới: **175/175 suite, 3.427 check (2.724 hành vi, 703 static), 333 PHP lint**, không skip/fail; chạy trên bản cài cô lập.
- Hồi quy ROADMAP6 trên Chromium bản cuối: **124/124**, gồm **25/25** ca tính năng ghi chú.
- Tính năng Chromium: **25/25** gồm thành phần, HTTP thật hai UI ở 1366/820/390/360, lưu/tải màu, đúng khuông/phía trên hợp âm và nâng cache PWA.
- Thành phần Chromium + WebKit: **38/38** (19 mỗi engine). WebKit còn chạy **24/24** ca gồm 19 thành phần và 5 HTTP thật cho cả Modern/Classic trên bản cài riêng `sheetapp2-instrument-php-20261020`. WebKit headless không có hộp chọn màu hệ điều hành; ca màu phát sự kiện input của picker. Đây không phải kiểm tra Safari/iPad phần cứng.
- JS syntax **330 file**, ESLint ba module sửa PASS. SW manifest hash `1c594c1904`.

Bằng chứng đợt này: [PHP](instrument-annotations-evidence/toolbar-php-final.txt), [trình duyệt](instrument-annotations-evidence/toolbar-browser-final.txt), [lỗi tái hiện trước sửa](instrument-annotations-evidence/toolbar-browser-red.txt).

Cập nhật bàn giao local: chuyển checkout `C:/xampp/htdocs/sheetapp2` từ main sang nhánh đã kiểm tra `feature/roadmap5` để URL `http://localhost/sheetapp2/` có chức năng. Đây là đổi nhánh local; không merge main hay triển khai production. Bản gốc main vẫn giữ commit `623b745`. Backup DB/annotations tại `C:/xampp/sheetapp2-backups/instrument-toolbar-20261020-105222`; backup integrity `ok`, DB SHA256 `A91268B27DF548845C67B8F375C2D13B5899FFA4716BA99A00D59E4BC157CAC9`. Các dòng bàn giao trước mục này mô tả trạng thái phiên bản cũ.

## Phát hành main và dọn bản thử — 2026-10-20

Chủ dự án đã yêu cầu trực tiếp đưa bản hoàn tất lên main và chỉ giữ một source chính. Main được fast-forward tới mã `9bbea63` đã kiểm thử ở trên; việc phát hành không sửa mã ứng dụng. Checkout chính ở `C:/xampp/htdocs/sheetapp2` trên main, URL chính `http://localhost/sheetapp2/`, cùng chế độ Classic tại `/old/`.

Bảy thư mục `sheetapp2-instrument-php-20261020`, `sheetapp2-roadmap6-check-20261018-130707`, `sheetapp2-roadmap6-final-20261018-133659`, `sheetapp2-roadmap6-import-20261018-133307`, `sheetapp2-roadmap6-oct19-061901`, `sheetapp2-roadmap6-review-20261018-215048`, `sheetapp2-roadmap6-work` đã được chuyển khỏi htdocs, vào `C:/xampp/sheetapp2-backups/source-archive-20261020-110530`. Source chính và DB thật được giữ nguyên. Worktree trong bản lưu trữ là detached, không chiếm nhánh main.

Các URL thử nghiệm/lệnh chạy ở những mục lịch sử phía trên không còn là các server đang phục vụ. Khi tái kiểm HTTP, tạo bản cài cô lập có DB/storage riêng, marker `.roadmap6-isolated`, rồi truyền URL/root tương ứng; không trỏ bộ test vào source chính. Bằng chứng kiểm thử được giữ trong Git tại `docs/instrument-annotations-evidence/`. Đây là xuất bản lên GitHub main và dọn source local; không tự xác nhận server production đã triển khai.

## Hoàn thiện màu riêng và liên thông hai giao diện — 2026-10-20

Chủ dự án chốt màu riêng từng ghi chú, mặc định theo màu nhạc cụ, thực hiện trực tiếp trên main. Field `customColor` là tùy chọn; máy chủ chỉ nhận hex sáu chữ số và chuẩn hóa chữ thường. Bỏ field này để trở về màu nhạc cụ. Việc đổi màu registry chỉ tác động các ghi chú đang theo mặc định, không ghi đè màu riêng. Giữ metadata màu/icon cũ và cơ chế revision/role hiện có; không đổi SQLite.

Editor có sáu màu mẫu, màu tùy chọn, xem trước và nút **Theo màu nhạc cụ**. Màu được dùng nhất quán trên nhãn sheet, thẻ chi tiết và viền editor. Màu/chữ nháp giữ nguyên khi lỗi hoặc đổi nhạc cụ. CSS căn lại native dialog sau khi tái hiện việc margin reset của trang kéo hộp soạn sát mép trên điện thoại; desktop vẫn mở gần vị trí nốt.

`URLState.interfaceUrl()` dùng chung cho các liên kết chuyển giao diện, giữ bài đang mở cùng các tham số tông, sheet/lời, kiểu lời, bộ hợp âm và compact trong URL. Khi bắt đầu soạn, client nhớ lớp hiển thị để khi chuyển giao diện/tải lại trang thì ghi chú được tải lại. Ca HTTP ghi màu tím ở giao diện đầu, chuyển giao diện giữ tông/chế độ xem, đổi sang màu đỏ rồi quay lại; chạy ở cả hai chiều và hai engine. Có thêm ca ở 390 px kiểm tra editor nằm giữa và vừa màn hình.

Đợt kiểm tra đầu phát hiện guard mật khẩu quét chuỗi cũng nhận nhầm mã màu mẫu `#123456` trong test. Đã dùng mẫu màu `#284b63`; không sửa hay bỏ guard. Các ca mật khẩu được chạy lại; không đổi chính sách mật khẩu.
