# ROADMAP6 — TV2, đợt tiếp tục 2026-10-19

Phạm vi: tiếp tục trên `feature/roadmap5`, xuất bản vào
`feature/roadmap6-library-20261019`. Một AI thực thi trong worktree cách ly.
Cả Modern và Classic được duy trì. Không chạy sync, merge main hay deploy.

## Thay đổi đã kiểm tra

- Danh sách tên bộ hợp âm chỉ tải khi focus/chạm dropdown. Focus, pointerdown và
  mousedown liên tiếp dùng chung request đang chạy và cache của ApiService; bỏ
  cache trùng trong Modern ChordCanvas. Sau tạo/xóa vẫn có refresh cưỡng bức.
  Phản hồi bài cũ không sửa dropdown bài đang xem; bộ đang chọn luôn có option.
- Modern không tự tải chín module Performance khi chỉ đọc bài. ModeManager,
  nút Live và tham số room/live vẫn giữ đường nạp theo thao tác tương ứng.
- Lịch sử dùng bài chỉ tải khi mở popover ⓘ; cập nhật chip không gọi lại API.
  Lỗi mạng được phép thử lại khi mở lại popover, không cần chuyển bài.
- ArrangementEngine gộp yêu cầu đồng thời cùng bài, nhớ cả kết quả rỗng và bỏ
  phản hồi cũ sau đổi bài nhanh A → B → A hoặc clear. Đổi bài trong Biểu diễn
  vẫn tải phân đoạn của bài mới.
- Hồi quy phát hiện thêm resize tự nhảy từ vị trí đang duyệt về bài đã chọn;
  sửa cả hai LibraryUI. Grid dùng chung giữ focus vào đúng nút khi dòng bị thay
  bởi một lượt dựng danh sách ảo, đồng thời tôn trọng focus ngoài danh sách.

## Bằng chứng trước và sau

Log gốc: `test-results/roadmap6-evidence/`. Bản xuất UTF-8 để duyệt nằm ở
[`roadmap6-evidence/`](roadmap6-evidence/README.md); chỉ bỏ khoảng trắng cuối dòng.

| Kiểm tra | Trước sửa | Kiểm lại |
|---|---|---|
| Dropdown Modern/Classic không gọi API khi mở bài | `tv2-chord-list-red.txt`: 2 FAIL | `tv2-chord-list-green.txt`: 2 PASS |
| Không tự tải usage/Performance; mở tính năng vẫn hoạt động | `tv2-demand-red.txt`: FAIL | `tv2-demand-green.txt`: PASS |
| Đồng thời, kết quả rỗng, phản hồi cũ của phân đoạn | `tv2-arrangements-red.txt`: FAIL | `tv2-arrangements-green.txt`: PASS |
| Thử lại lịch sử sau lỗi mạng | `tv2-usage-retry-red.txt`: FAIL | `tv2-targeted-corrected.txt`: PASS |
| Giữ focus khi thay dòng ảo | `tv2-focus-red.txt`: FAIL | `tv2-targeted-corrected.txt`: PASS |
| Resize giữ vị trí duyệt ở cả hai UI | `tv2-resize-red.txt`: 2 FAIL | `tv2-targeted-corrected.txt`: PASS |

Lượt tổng đầu `tv2-chromium-full.txt` có **87 PASS / 1 FAIL**, không phải kết quả
nghiệm thu cuối. Trace riêng xác nhận có sự kiện resize muộn, kéo danh sách về
bài đã chọn. Test resize nay phát sự kiện trực tiếp để tái hiện chắc chắn.
Lượt tập trung sau sửa: **8/8 PASS**, 31,2 giây. Lượt tổng tiếp theo
`tv2-chromium-rotation-intermediate.txt`: **89 PASS / 1 FAIL**, phát hiện bỏ hẳn
auto-scroll khi resize làm mất bài đang chọn khỏi khung nhìn khi xoay màn hình.
Đã bổ sung ưu tiên cursor bàn phím, rồi mới giữ bài đang chọn; kiểm lại cả xoay
màn hình và bàn phím: **5/5 PASS**, 13,4 giây (`tv2-rotation-corrected.txt`).

Cổng Chromium cuối sau sửa: **90/90 PASS**, 5,3 phút
(`tv2-chromium-accepted.txt`); bao gồm toàn bộ 84 kiểm thử ROADMAP6 trước đợt này.
Hai lượt tổng thất bại phía trên là bằng chứng trung gian, không dùng để kết luận PASS.

Cổng PHP cuối chạy **sau** E2E, từ bản sao Apache: **173/173 suite, 3.342 check
PASS**, 0 skip/fail, 329 file PHP lint, 233,6 giây (`tv2-php-final.txt`). Ba suite
tương thích L3-7/L5-4/page performance đều PASS. ESLint các JS sửa và
`git diff --check` PASS. Không có thay đổi production code sau các cổng cuối.

DB ở thư mục nguồn giữ SHA256
`A91268B27DF548845C67B8F375C2D13B5899FFA4716BA99A00D59E4BC157CAC9`;
checkout main nguồn sạch. Không merge, deploy hoặc sửa dữ liệu nguồn.

Ba guard PHP cũ yêu cầu cache trùng trong ChordCanvas hoặc tải Performance ngay
khi đọc đã được chuyển sang hợp đồng tải theo nhu cầu. Kiểm thử cache nay chạy
ApiService thật trong Node VM: gộp request đồng thời, cache hit, clear, save,
clone và delete. Phép đọc mã mới của L3-7 được phân loại static. Các lượt PHP
thử trực tiếp từ worktree không có DB đã bị chặn/thiếu fixture, không được tính
là PASS; cổng PHP đầy đủ phải chạy từ bản sao Apache như hướng dẫn bên dưới.

## Đo hiệu năng thật

Baseline trước sửa (`tv2-baseline.txt`): Chromium desktop, browser cache tắt,
service worker bị chặn, mạng/CPU không giới hạn; đo đến network idle.

| UI | JS qua mạng | Tổng request | API | Byte CDP báo |
|---|---:|---:|---:|---:|
| Modern trước sửa | 96 | 119 | 9 | 3.614.903 |
| Classic trước sửa | 47 | 62 | 5 | 2.618.021 |

Đo sau sửa bằng `e2e/roadmap6-performance.config.js`, viewport 390×844,
cache trình duyệt tắt, service worker bị chặn. Chromium CDP: download 1,6 Mbps,
upload 750 kbps, latency 150 ms; không giới hạn CPU. Máy chủ Apache có thể đã ấm.
Đếm request thực (gồm JS động và URL có query), dung lượng response header cộng
body đã mã hóa qua `request.sizes()`. Hai phương pháp byte CDP và Playwright
không được dùng để suy ra chính xác phần trăm tiết kiệm dung lượng.

| UI sau sửa | JS | Request | API | Byte truyền | SVG đầu | Ngân sách |
|---|---:|---:|---:|---:|---:|---|
| Modern | 87 | 106 | 5 | 3.524.545 | 24.302 ms | FAIL |
| Classic | 47 | 61 | 4 | 2.618.848 | 20.154 ms | FAIL |

`tv2-performance-4g.txt`: **2 FAIL đúng do vượt ngưỡng**, không lỗi thu thập
request. Mục tiêu làm việc theo ủy quyền tối ưu của chủ dự án: ≤40 JS,
≤60 request, ≤1.500.000 byte, SVG ≤2.500 ms. Không sửa bảng quyết định/chữ ký Q6.
Mỗi UI vẫn có hai cảnh báo AudioContext; TV2-4 chưa được sửa trong đợt này.

Modern còn một request setlists cho thẻ chương trình sắp tới trên Thư viện;
đã giữ tính năng này, chưa đánh dấu TV2-3 hoàn tất. API còn lại: auth/me, songs,
sessions và chord_sets/load. Classic không có request thẻ chương trình này.

Lệnh tái hiện, chạy tuần tự với các cổng ghi fixture trên cùng bản sao:

```powershell
$env:SHEETAPP_TV_TEST_URL = 'http://localhost/sheetapp2-roadmap6-oct19-061901'
$env:SHEETAPP_TV_ISOLATED_ROOT = 'C:/xampp/htdocs/sheetapp2-roadmap6-oct19-061901'
npx playwright test -c e2e/roadmap6-performance.config.js
npx playwright test -c e2e/roadmap6.config.js --project=chromium
# Chạy PHP gate từ root bản sao; SHEETAPP_TEST_URL trỏ cùng URL cách ly.
php tests/run_all_tests.php
```

## Phần tiếp theo

TV2 còn mở: sửa tổng kết runner khi có quality gate thất bại ngoài regression;
tải theo nhu cầu các nhóm module còn lại; AudioContext sau thao tác; precache từ
hai entry; ngoại tuyến; version gói gồm XML/hợp âm; chứng minh session GET song
song. TV3/TV5/TV6/TV7 và Safari/thiết bị thật chưa được coi là hoàn tất.
