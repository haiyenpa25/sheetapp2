# ROADMAP6 — Nhật ký triển khai và nghiệm thu

Ngày 2026-10-18, cập nhật 2026-10-19. Nhánh `feature/roadmap5`, baseline ban đầu `3b5fb69`, worktree tiếp nhận `623b745`.
Một AI thực thi; đã được chủ dự án yêu cầu push GitHub, không deploy hoặc chạy sync. Classic và Hiện đại đều là chế độ chính thức.
Xem [phân tích phạm vi](ROADMAP6_CLASSIC_MODERN_ANALYSIS.md).

Đợt tiếp tục TV2: xem [thay đổi, số đo và giới hạn](ROADMAP6_TV2_PROGRESS.md).
Ngân sách 4G hiện **FAIL ở cả hai giao diện**, được báo riêng với kiểm thử hành vi.

Đợt mới nhất: [âm thanh theo nhu cầu và nén tài nguyên](ROADMAP6_TV2_AUDIO_COMPRESSION.md).

## Kết quả TV0

| Ticket | Thay đổi / xác minh | Log trong `test-results/roadmap6-evidence/` |
|---|---|---|
| TV0-1 | LibraryGestures dùng chung: vuốt >10px, giữ >500ms, hủy/đa chạm không mở bài; giữ click bàn phím. Native touch Chromium 390/820: vuốt 0 XML, chạm 1 XML, cả hai chế độ | TV0-1-FAIL, classic-FAIL, duration-FAIL, both-PASS, native-PASS |
| TV0-2 | Đo hàng thực, gap/offset header và spacers, đo lại khi resize. Fixture 1.731 bài, tên dài, bài 800 và xoay màn hình. Tên dài rút gọn ở danh sách ảo, giữ tên đầy đủ trong title | TV0-2-both-FAIL, TV0-2-PASS |
| TV0-3 | Escape empty-state đã có ở baseline; thêm kiểm thử renderer thực bằng VM và DOM để xác nhận | TV0-3-PASS, TV0-3-php-PASS |
| TV0-4 | Sửa phân bố toolbar, menu cho nút phụ, giữ nhãn chế độ đọc. Đo khi sidebar mở/đóng ở 1366, 1440, 1180 và 820 | TV0-4-FAIL, label-FAIL, TV0-4-PASS |
| TV0-5 | ChordSetNames dùng chung: HD thiếu hiện đang dùng TLH; bộ cá nhân rỗng không nhận nhầm TLH. Cập nhật sau XML không gọi API thêm. Toast có bố cục, nút đóng, thay thông báo cũ | TV0-5-FAIL, integration-FAIL, classic-FAIL, TV0-5-PASS, toast-PASS |
| TV0-6 | Token z-index cho CSS Thư viện và menu toolbar; hit testing xác nhận modal trên HUD | TV0-6-FAIL, TV0-6-PASS |
| TV0-7 | Ẩn thanh đáy khi drawer mở ở điện thoại; cuộn cuối rồi mở bài cuối thành công | TV0-7-FAIL, TV0-7-PASS |
| TV0-8 | Đường nhập thống nhất, tránh ghi đè, kiểm tra URL, FTS/cache cập nhật; chỉ mở HTTP cho file nhập đúng mẫu | TV0-8-unit-FAIL/PASS, TV0-8-http-FAIL/PASS |

Tên log ở bảng có đuôi `.txt`. Lệnh Chromium:
`npx playwright test --config=e2e/roadmap6.config.js --project=chromium`.
`SHEETAPP_TV_TEST_URL` trỏ bản sao Apache. Test nhập cần thêm
`SHEETAPP_TV_ISOLATED_ROOT` và marker `.roadmap6-isolated`.
Kết quả TV0 ban đầu: **37 passed**, 50,7 giây (`chromium-tv0-final.txt`). Unit nhập: 7 check PASS.
Chưa kiểm thử file nén MXL trong đợt này.

## TV1 — Đã triển khai TV1-1…7

| Phần | Kết quả và giới hạn | Bằng chứng |
|---|---|---|
| TV1-1 backend | SQL trả total độc lập với limit/offset, tối đa 200; lọc danh mục/chủ đề/tông/quyền trước phân trang; sắp xếp ổn định; số chính xác chỉ chèn trang đầu, không trùng trang sau. Nhánh fallback cũng phân trang | `TV1-1-backend-FAIL.txt`, `TV1-1-controller-FAIL.txt`, `TV1-1-filters-FAIL.txt`; 18 check trong `tests/library_tv11_pagination_regression.php` |
| TV1-1 client | LibrarySearch dùng chung cho Classic/Hiện đại; nút Xem thêm có số còn lại; lỗi mạng cho thử lại cùng offset; phản hồi cũ không ghi đè truy vấn mới; truy vấn mới về đầu danh sách | `TV1-1-client-FAIL.txt`, `TV1-1-3-client-final.txt`, `TV1-shared.txt`, `TV1-http-final.txt` |
| TV1-2 | Chỉ tìm trong lời, loại kết quả chỉ có tên/tác giả/số bài. Tìm offline trên lời hoặc snippet đã có, không xem như đầy đủ khi chỉ có snippet. Xếp hạng ưu tiên vị trí cụm lời liên tục rồi BM25 | `TV1-2-backend-FAIL.txt`, `TV1-2-ranking-FAIL.txt`, `TV1-2-ranking-PASS.txt`, `TV1-2-offline-PASS.txt` |
| TV1-3 | Tô sáng trên văn bản thô theo ranh giới từ rồi escape từng đoạn, giữ nguyên entity và ký tự nhạc; không lồng mark. Chọn đúng câu/điệp khúc thay vì khớp giữa chữ ở khổ khác. Dùng chung highlighter JS cho hai chế độ | `TV1-3-FAIL.txt`, `TV1-3-classic-FAIL.txt`, `TV1-3-snippet-FAIL.txt`, `TV1-3-final.txt`, `TV1-shared.txt` |
| TV1-7 | Số ở modal/nav lấy từ catalog đầy đủ, không thay bằng số kết quả đang lọc. Gỡ phạm vi 903 gõ cứng khỏi includes cả hai chế độ | `TV1-7-FAIL.txt`, `TV1-7-PASS.txt`; `rg -n '903' includes old/includes` không có kết quả |

HTTP thực trên bản sao: chủ đề **Đời tín đồ** có total 343, hai trang 200+143,
không trùng. Bộ lọc Hiện đại bấm Xem thêm đủ 343. Hai giao diện tìm
“yêu thương thế gian” ở chế độ lời ra bài **Tôn Vinh 259 — Chúa yêu thế gian** đầu tiên.
Không nhầm với Thánh ca 259 (Canh giữ kêu cầu). `e2e/library-tv1-http.spec.js`: 4 PASS.

Chia thực thi thành các lát backend, client chung, đăng ký entry/precache và kiểm chứng HTTP
để giữ mỗi lát khoảng 5 file; phần số lượng tách logic và nội dung includes.
### Đợt tiếp tục 2026-10-19: TV1-4…6

Chủ dự án chọn **grid, giữ nút trong từng dòng** thay cho listbox ở TV1-4.
Không sửa bảng quyết định/chữ ký trong roadmap. Các lát thực thi tách phần điều khiển
dùng chung, đăng ký entry/precache, tích hợp từng giao diện, và kiểm chứng trang thật.

| Ticket | Kết quả | Bằng chứng thô trong `test-results/roadmap6-evidence/` |
|---|---|---|
| TV1-4 | `LibraryList`: grid có nhãn thật, row count/index/selected, active descendant hợp lệ; Up/Down/Home/End đi qua danh sách ảo, Enter/Space mở bài; Tab tới nút của dòng đang chọn; phím trong grid không lọt ra phím đổi bài/cuộn trang. Đồng bộ ARIA khi chọn bằng chuột. Sửa tương phản số lượng danh mục và nhãn select Classic | `TV1-4-FAIL.txt`, `TV1-4-http-first.txt`, `TV1-4-PASS.txt`, `TV1-4-mouse-FAIL.txt`, `TV1-4-mouse-PASS.txt` |
| TV1-5 | `SongNavigation` giữ một nơi nhận toolbar/phím tắt; theo đúng thứ tự danh sách đang hiện, không vòng qua đầu/cuối. Chương trình chỉ ưu tiên khi đang phát; chỉ xem chi tiết không bắt điều hướng. Chọn thủ công thoát phát. Giữ bộ hợp âm/tông/BPM của mục chương trình. Classic áp dụng tempo sau khi tải xong, tránh bị ghi đè | `TV1-5-FAIL.txt`, `TV1-5-classic-FAIL.txt`, `TV1-5-PASS.txt`, `TV1-5-http.txt` |
| TV1-6 | Nhảy theo số chính thức trong tập đang chọn; nếu không lọc tập thì theo tập của bài đang mở. Không dò số từ id/tên hay rơi sang tập khác. Tiền tố TC/TV phân biệt số trùng trong danh sách hỗn hợp; preview có tập. Tập chưa có số ẩn nút nhập và chỉ dẫn tìm tên. Kiểm lại tập hiện tại khi mở để tránh preview cũ | `TV1-6-FAIL.txt`, `TV1-6-PASS.txt`, `chromium-oct19.txt` |

Chromium tổng hợp: **68/68 PASS** (`chromium-oct19.txt`, 1,1 phút), gồm cả
54 ca đã có và 14 ca mới. Thêm **2/2 PASS** kiểm toolbar/phím tắt trên trang Apache
khởi động thật (`TV1-5-http.txt`): danh sách rút gọn 001/903 đi thẳng đúng thứ tự.
Kiểm grid/sidebar bằng axe ở 1366/390 trên cả hai giao diện: 0 serious/critical;
đây chỉ là phạm vi sidebar, không thay cho nghiệm thu toàn trang TV3.
Rà soát sau đó bổ sung ca thoát chương trình trong lúc tải: Classic không được áp
BPM cũ sau khi đã thoát. `TV1-5-cancel-FAIL.txt` tái hiện lỗi; token lượt phát và kiểm
mục hiện tại chặn phần hoàn tất cũ. `TV1-5-cancel-PASS.txt`: 3/3 ca Classic PASS.
ESLint các module JS thay đổi PASS (`lint-oct19-final.txt`); cú pháp **310 file JS PASS**
(`syntax-oct19.txt`).

Cổng PHP trên bản sao Apache: **170/170 suite, 3.312 check PASS** (2.615 hành vi,
697 static), 114,27 giây (`php-oct19-final.txt`). Chạy trước bổ sung guard hủy lượt
phát Classic; sau bổ sung chạy lại kiểm thử Classic, ESLint và 44 check guard cấu trúc
Classic (`classic-guard-oct19.txt`), rồi hồi quy Chromium tổng hợp.

Sau sửa hủy lượt phát: **71/71 Chromium PASS**, 1,3 phút
(`chromium-oct19-final.txt`). Kiểm thử grid còn được chạy với KeyboardHandler thật
của từng giao diện: **2/2 PASS** (`TV1-4-global-keyboard.txt`). Đã xem 4 ảnh
`TV1-grid-{modern,classic}-{1366,390}.png`: tiền tố tập và focus không chồng chữ;
Classic vẫn có vùng chạm nhỏ, thuộc TV3/TV6. Số 1.739 trong ảnh là catalog của bản sao
đã chạy fixture nhập nhiều đợt, không phải số bài trên DB nguồn.

Lần thử HTTP nhảy số đầu tiên thất bại do test chờ URL đổi rồi mở drawer trước khi
`song:loaded` đóng drawer; test đã chuyển sang chờ hoàn tất tải bài. Đây là sửa đồng bộ
kiểm thử, không phải bằng chứng FAIL sản phẩm. FAIL sản phẩm của TV1-6 nằm ở fixture
resolver trước khi sửa. Tương tự, lần PHP đầu đợt còn guard L310 tìm coupling cũ;
đã cập nhật ba guard theo nơi điều phối mới, giữ phân loại static và mô phỏng hành vi.
`TV1-5-php.txt`: L310 PASS, tỷ lệ hành vi 61,1%; không dùng guard làm bằng chứng điều hướng.

## Kiểm tra sau tiếp nhận baseline 623b745

- Bản sao DB TV0 chưa có migration 016 của commit ngoài phiên; lỗi HTTP 500 do thiếu
  `s.visibility` đã được xác định từ log Apache. Chạy migration **chỉ trên bản sao có marker**;
  integrity/foreign keys OK, API 200. Log `migrate-review-only.txt`.
- Các guard PHP còn tìm chuỗi logic cũ sau khi tách phân trang được cập nhật vị trí;
  vẫn có kiểm thử hành vi fixture/HTTP cho số bài, thứ tự và giới hạn 200.
- Hai suite hợp âm tìm các hằng số cũ không còn đúng với baseline: cỡ chữ nay theo preset,
  khoảng cách theo zoom. Trước khi đổi guard, chạy mã ChordCanvasDots thật trong Chromium:
  hộp hợp âm không giao nốt/nhau ở scale 0,75/1/1,5 trên hai chế độ; cỡ chữ theo preset
  có giới hạn. **7 PASS** (`chord-geometry.txt`). Guard tìm mã được ghi rõ static, không
  dùng làm bằng chứng hình học; không sửa thuật toán chỉ để khớp chuỗi cũ.
- Sửa ba chỗ chữ 10,5/11/11,5px mới có trong library-polish về 12px, giữ line height.
- Quality gate sau các sửa: **170/170 suite, 3.312 check PASS**, 112,44 giây,
  `php-review-acceptance.txt`. Lần cuối sau cập nhật nội dung số lượng ghi riêng ở
  `php-review-final-all.txt`: **170/170 suite, 3.312 check PASS**, 111,06 giây.
- Chromium tổng hợp: **54/54 PASS**, 46,6 giây (`chromium-review-final.txt`).
  ESLint phần JS đã sửa PASS (`lint-review-final.txt`); kiểm tra cú pháp toàn bộ JS
  nằm trong quality gate PHP, PASS. `git diff --check` không có lỗi whitespace.
- Đã xem ảnh toàn trang kết quả lời ở hai chế độ:
  `TV1-modern-lyrics.png`, `TV1-classic-lyrics.png` trong thư mục bằng chứng.
  Classic vẫn có tên bài rút gọn do cột hẹp; giữ tên đầy đủ trong title.
  Không dùng ảnh này để đánh dấu toàn bộ UI/TV3/TV6 hoàn tất.

## Cách ly và giới hạn

- Config ROADMAP6 không dùng global setup/teardown của config cũ. Test thành phần không cần DB.
  Test HTTP/PHP chạy trên bản sao riêng có DB/storage riêng; node_modules dùng junction.
  Đường dẫn bản sao lưu trong `*-root.txt` dưới thư mục bằng chứng nguồn.
- DB nguồn trước các test và sau TV0 có SHA256
  `538B81D4408308C23C8F4EDFE1F746A991444BED54E08137776B103659B3C31F`.
  Lúc 15:37 phát hiện tác nhân bên ngoài commit `623b745`, checkout sang main và DB nguồn
  đã có hash khác. Không quy thay đổi này cho test cách ly; cũng không khẳng định DB nguồn
  còn nguyên sau sự kiện bên ngoài. Phiên này không sửa DB nguồn.
- Chuyển sang worktree `C:/xampp/htdocs/sheetapp2-roadmap6-work` trên `feature/roadmap5`
  để tránh ghi chồng. Các thay đổi TV0 trước đó đã được tác nhân bên ngoài đưa vào commit trên.
  Phiên này không tạo commit/merge đó, chưa đánh giá các thay đổi RBAC đi kèm.
  Kiểm lại cuối đợt: source main sạch, vẫn ở 623b745; SHA256 DB nguồn là
  `A91268B27DF548845C67B8F375C2D13B5899FFA4716BA99A00D59E4BC157CAC9`,
  khớp mốc ngay sau khi phát hiện thay đổi bên ngoài. Phần làm tiếp chỉ ở worktree riêng.
- Bộ PHP TV0: `php-tv0-final.txt` có 165/166 suite PASS, 3.251 check PASS, 1 FAIL do
  chord-canvas đúng 600 dòng theo cách đếm của test (<600). Đã bỏ một dòng trắng,
  không nới assertion. Một lần chạy lại thiếu URL cách ly và thiếu cache fixture;
  log `php-tv0-final-pass.txt` bị loại khỏi nghiệm thu. Đã sửa cấu hình và tạo cache
  trên bản sao: `php-tv0-final-isolated.txt` đạt **166/166 suite, 3.252 check PASS**.
- E2E Chromium cũ chưa xanh: lần chạy rộng đã dừng sau nhiều lỗi kỳ vọng cũ,
  gồm locator số không duy nhất, điều khiển sidebar/toolbar bị ẩn, toast fullscreen,
  và thứ tự nhiều tập. Log `e2e-full-chromium.txt`; không tính là nghiệm thu toàn ứng dụng.
- WebKit không tạo được page trên Windows, kể cả smoke tối giản (`webkit-environment.txt`).
  Đây là lỗi môi trường, không phải PASS.
- Chưa nghiệm thu Safari/iOS hoặc cuộn 30 giây trên thiết bị thật của chủ dự án.
  Không đánh dấu việc/chữ ký của chủ dự án.

## Còn lại

TV0 đã có triển khai và kiểm thử Chromium theo phạm vi trên, còn các cổng nghiệm thu.
TV1 đã triển khai đủ các ticket, còn nghiệm thu rộng. TV2–TV7 chưa hoàn tất: hiệu năng, trợ năng, quyền xem
chương trình, chất lượng dữ liệu, đồng bộ hai chế độ và nghiệm thu rộng.
Không dùng số lịch sử 165 suite / 3.232 check hoặc 88 JS như số đo sau sửa.
TV5 ghi dữ liệu vẫn cần dry-run được duyệt; không tự tạo HD/tempo giả.

## TV4 — Đợt tiếp tục TV4-1…3 (2026-10-19)

Chủ dự án đã giao tối ưu theo đánh giá của người thực thi và yêu cầu tiếp tục. Áp dụng
phương án Q2(a) cho khách chưa đăng nhập: chỉ bản `published`, không phân công;
`completed` cũng không thuộc danh sách công khai theo phương án này. Gói ngoại tuyến/
manifest yêu cầu đăng nhập. Bảng quyết định/chữ ký của chủ dự án vẫn giữ nguyên.

TV4-1 chia hai lát: (a) projection công khai, controller, fixture và kiểm backend;
(b) cùng chính sách ở bản in và kiểm HTTP/UI. Không đổi phương thức đọc nội bộ của
SetlistService; người đã đăng nhập tiếp tục nhận dữ liệu phục vụ làm việc.

| Ticket | Kết quả | Log trong `test-results/roadmap6-evidence/` |
|---|---|---|
| TV4-1 | `SetlistPublicReadService` dùng cột cho phép rõ ràng, không SELECT toàn bộ/không truy vấn phân công; bỏ thông tin người tạo/ca trưởng, mô tả nội bộ và ghi chú mục. Giữ bộ hợp âm, tông, BPM, số phách, thứ tự/khổ để phát. Danh sách, ID trực tiếp, lịch sử sử dụng và bản in đều áp dụng cùng điều kiện `published`. Lịch sử tính lại tổng/ngày cuối từ tập đã lọc. Bản không công khai trả 404 như ID không tồn tại. Hai alias offline trả 401 cho khách | `TV4-1-FAIL.txt` → `TV4-1-PASS.txt` (13 check backend); `TV4-1-http-FAIL.txt` → `TV4-1-http-PASS.txt`; `TV4-1-ui.txt` (5 HTTP/Chromium PASS, cả hai giao diện) |
| TV4-2 | Baseline đã chặn ghi/khôi phục dưới thư mục người khác nhưng trả 400. Helper báo mã nghiệp vụ `forbidden`, controller trả đúng 403. HTTP kiểm cả XML và `.bak` không đổi khi bị từ chối; chủ sở hữu và admin lưu/khôi phục được | `TV4-2-http-FAIL.txt` → `TV4-2-http-PASS.txt` |
| TV4-3 | PUT từ chối cả đường ngoài vùng và chuỗi rỗng với HTTP 400; toàn bộ cập nhật gồm title/lyrics/FTS không bị thực hiện. FTS dùng lại `resolveManagedXmlPath` trước khi đọc file; XML hợp lệ dưới `test-results/` cũng không được đọc | `TV4-3-http-FAIL.txt` (gồm lời từ file ngoài bị nhập vào FTS) → `TV4-3-http-PASS.txt` |

Test dùng fixture nháp/phát hành/hoàn tất có phân công và ghi chú đánh dấu riêng.
HTTP tạo/xóa đúng fixture trong bản sao có marker; file XML dùng tên riêng, kiểm
canonical root khác cả source/worktree, chỉ xóa các file của test. Không ghi DB/storage nguồn.
Một lần chuẩn bị fixture dùng nhầm `notes` thay vì `leader_notes` đã sửa trước log FAIL
sản phẩm. Kiểm anonymous ghi XML giữ mã 403 của `requireBanhat` đang có; không tính lần
kỳ vọng 401 sai trong test là lỗi sản phẩm.

TV4-4 (CSRF), TV4-5 (cache/transaction danh mục), TV4-6 (hợp đồng API) còn lại.
Chưa coi TV4 hoàn tất hoặc các thay đổi RBAC ngoài phiên là đã được nghiệm thu toàn bộ.

Cổng PHP sau TV4-1…3: **171/171 suite, 3.325 check PASS**, 112,96 giây;
327 file PHP lint PASS, 2.628 check hành vi và 697 static (`php-tv4-final.txt`).
Chromium tổng hợp sau TV4-1…3: **78/78 PASS**, 1,3 phút
(`chromium-tv4-final.txt`), gồm 71 ca cũ và 7 ca HTTP/UI mới; có kiểm người đăng nhập
vẫn mở/in bản nháp, nhận ghi chú và tải gói ngoại tuyến. `git diff --check` PASS.
Kiểm checksum của runner áp dụng cho DB bản sao; DB nguồn được kiểm riêng bằng SHA256,
vẫn `A91268B27DF548845C67B8F375C2D13B5899FFA4716BA99A00D59E4BC157CAC9`.
Các fixture HTTP được dọn sau test. Không push, commit, deploy hoặc migration DB nguồn.

Nội dung commit đề xuất cho riêng lát TV4-1…3 sau khi duyệt:
`fix(library): restrict guest program reads and validate XML access`.
Gồm projection công khai/API/bản in, phản hồi 403/400 đúng trường hợp, đường đọc XML
của FTS và kiểm thử cách ly. Worktree còn cả phần TV1 chưa commit từ đợt trước;
cần chia theo các lát đã ghi, không gom toàn bộ thành một thay đổi không rõ phạm vi.

## TV4-4…6 và xuất bản nhánh GitHub (2026-10-19)

Chủ dự án yêu cầu “thực hiện tiếp ... up lên github”, cho phép commit/push phần mã đã
kiểm chứng. Local tiếp tục ở `feature/roadmap5`; nhánh cùng tên trên origin đã phân kỳ,
nên xuất bản sang nhánh mới `feature/roadmap6-library-20261019`, không force-push,
không gộp main/deploy, không chạy sync. Chia commit theo lõi API, quyền đọc,
request/cache danh mục, giao diện hai chế độ và bằng chứng/tài liệu.

| Ticket | Triển khai và xác minh | Bằng chứng thô trong `test-results/roadmap6-evidence/` |
|---|---|---|
| TV4-4 | `csrf_enforce` trong FeatureFlags, mặc định false. Mọi request ghi phải có Origin hoặc Referer cùng nguồn; bật cờ thì thêm token khớp session. Cookie token được cập nhật khi lệch session. ApiService đã có gửi header, kiểm thật lưu/đọc lại bộ hợp âm riêng với cờ bật | `TV4-4-FAIL.txt` → `TV4-4-PASS.txt` (8 check); `TV4-4-http-FAIL.txt` → `TV4-4-http-PASS.txt` |
| TV4-5 | CategoryService chuyển bài về danh mục 1 và xóa trong transaction; Manager dùng chung, invalidate cache sau tạo/đổi/xóa. Bảo vệ danh mục 1 và cập nhật lời xác nhận Admin. Trigger lỗi chứng minh rollback chuyển bài. Cache dùng LOCK_EX + rename, bỏ fallback copy có thể lộ JSON dở dang. 250 lượt ghi/2.500 lượt đọc không có JSON lỗi. ETag hash từ cùng snapshot trả về, sửa 304 sai khi đổi tên cùng độ dài | `TV4-5-http-FAIL.txt` → `TV4-5-http-PASS.txt`; `TV4-5-cache-PASS.txt`; `TV4-5-etag-FAIL.txt` → `TV4-5-etag-PASS.txt` |
| TV4-6 | Nhánh đọc/ghi songs có success/data; giữ alias top-level đang được client dùng. PUT không tồn tại trả 404, lỗi PDO chỉ ghi log server. LIKE có tempo; lỗi sync FTS có log. Taxonomy có key/label/name, một mục Kinh tiết ca; nhận cả mã/nhãn và alias cũ mà không sửa DB | `TV4-6-FAIL.txt` → `TV4-6-PASS.txt` (9 check cuối, thêm FTS/LIKE); `TV4-6-http-FAIL.txt` → `TV4-6-http-PASS.txt` |

TV4-5 chia lát danh mục/Manager/nhãn xác nhận và lát ghi cache/ETag/đọc song song.
TV4-6 chia backend, adapter controller, fixture và kiểm HTTP để giới hạn kích thước sửa.
Các tool `manage_song_labels.php` và `check_song_spelling.php` đã có invalidate sau
transaction trong baseline; chỉ đọc kiểm tra, không chạy sửa dữ liệu.

Lượt PHP ban đầu `php-tv44-46-final.txt` không dùng để nghiệm thu cuối: còn một nhãn
Kinh tiết ca chưa giữ đúng từ vựng dự án, chưa có bản ETag cuối và có ca HTTP chạy chồng.
Giữ nguyên nhãn “Kinh tiết ca / Đoản ca” cho key chuẩn; không nới test từ vựng.
Sau đó đóng băng mã, chạy lại PHP rồi Chromium tuần tự trên bản sao.
CSRF chỉ được bật trong bản sao khi kiểm thử và khôi phục file cấu hình sau test.

Lượt `php-github-final.txt` phát hiện R3-1 đòi tên “Kinh tiết ca / Đoản ca”, còn R3-3
đòi “Kinh tiết ca & Đoản ca” trong cùng trường name. Trước đây hai mục trùng che mâu
thuẫn này. Theo TV4-6, giữ một mục chuẩn, cập nhật kỳ vọng chính xác của R3-3 về cùng
tên với R3-1; test mới kiểm cả alias cũ qua bộ lọc, kể cả nhánh LIKE. Không bỏ assertion.

Lượt Chromium `chromium-github-final.txt` phát hiện lỗi tích hợp sau đổi hợp đồng:
ApiService.songs.list vẫn trả envelope, khiến LibraryUI Hiện đại nhận mảng rỗng.
Probe xác nhận catalog=0, không phải OSMD tải chậm; nhận định ban đầu về timeout bị
loại bỏ và giữ nguyên timeout cấu hình. Sửa adapter trả items, giữ cả response cũ/mới;
`TV4-6-adapter-FAIL.txt` → `TV4-6-adapter-PASS.txt` (2 ca). Lượt này không tính PASS.

Lượt `chromium-push-acceptance.txt`: 83/84 PASS, còn thời gian chờ render TC 903
trong ca điều hướng trang thật. Probe riêng mở đúng TC 903, không có lỗi JS.
Ca test bổ sung assertion URL đích ngay khi bấm (vẫn timeout mặc định), sau đó cho
phần render bản nhạc 89 ô nhịp tối đa 15 giây; không đổi timeout toàn bộ cấu hình,
không dùng ca chức năng này để chứng nhận hiệu năng TV2.

Chromium đóng băng trước push: **84/84 PASS**, 4,9 phút
(`chromium-published-final.txt`), timeout cấu hình giữ nguyên. Bao gồm TV0/TV1 và
TV4-1…6, hai dạng response cho adapter và kiểm URL/render riêng của ca điều hướng.

Cổng cuối sau Chromium, chạy tuần tự cùng bản sao: **173/173 suite PHP, 3.342 check
PASS**, 215,25 giây; 329 file PHP lint PASS, 2.645 check hành vi (79,1%), 697 static
(`php-published-final.txt`). ESLint các JS sửa PASS, `git diff --check` PASS.
Log cuối và FAIL/PASS chọn lọc được chép UTF-8 vào `docs/roadmap6-evidence/` để duyệt
trên GitHub. DB nguồn giữ SHA256 nêu trên; không commit DB, XML cá nhân hoặc token.
