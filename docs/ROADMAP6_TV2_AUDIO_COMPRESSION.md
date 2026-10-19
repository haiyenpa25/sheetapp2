# ROADMAP6 — Âm thanh theo nhu cầu và nén tài nguyên

Ngày 2026-10-19. Tiếp tục từ commit `56bf2b6`, local `feature/roadmap5`, xuất bản
`feature/roadmap6-library-20261019`. Một AI thực thi, không đổi Apache toàn máy,
không khởi động lại dịch vụ, không merge main hoặc deploy.

## Kết quả đo

Cùng cấu hình `e2e/roadmap6-performance.config.js`: Chromium 390×844, cache lạnh,
service worker bị chặn, 1,6 Mbps xuống / 750 kbps lên / latency 150 ms; không giới
hạn CPU. Mỗi UI một lượt đo, Apache có thể đã ấm; không phải SLA hay p95.

| UI | Trước → sau: byte truyền | JS | Request | SVG đầu | Cảnh báo AudioContext |
|---|---:|---:|---:|---:|---:|
| Modern | 3.524.545 → **1.993.443** | 87 → 84 | 106 → 103 | 24.302 → **11.225 ms** | 2 → **0** |
| Classic | 2.618.848 → **1.299.141** | 47 → 45 | 61 → 59 | 20.154 → **7.759 ms** | 2 → **0** |

Lượng truyền giảm khoảng **43% Modern / 50% Classic**. Số API đầu trang giữ 5/4.
Log trước: `tv2-performance-4g.txt`; sau: `tv24-performance-4g.txt`.
Ngân sách tổng vẫn **2 FAIL**: cả hai vượt 40 JS và 2.500 ms; Modern còn vượt
60 request và 1.500.000 byte. Classic đã đạt hai ngưỡng request/dung lượng.
Không đổi ngưỡng, bảng quyết định hay chữ ký để lấy PASS.

## Âm thanh

- Hai entry không tải sẵn Tone/OsmdAudioPlayer. Đọc bài hoặc dịch giọng không tạo
  AudioContext, không tải hai vendor này. Bấm phát mới nạp qua ScriptLoader.
- Tạo/resume context đồng bộ ngay trong thao tác phát, trước khi chờ thư viện;
  Tone và player dùng context đó. Context mặc định tạm của Tone được dispose.
  Metronome vẫn giữ đường phát riêng theo thao tác người dùng.
- Bỏ mở khóa âm thanh ở mọi lần chạm/mousedown. Giữ silent HTML5 audio khi phát.
- Dùng generation để hủy khi dừng hoặc đổi bài trong lúc chờ thư viện/score.
  Nếu vendor bắt đầu muộn sau lệnh dừng, dừng đúng instance cũ. Gộp bấm phát lặp.
- ScriptLoader lấy app base đúng trong Classic/thư mục con; xóa script tải lỗi
  để lần thử lại thực sự gửi request, không nhận nhầm DOM lỗi là đã tải xong.

Kiểm thử dùng vendor thật xác nhận lượt phát đầu, context running, đổi organ /
choir, chọn bè và dừng trên cả hai UI. Chưa thay cho nghe âm thanh trên thiết bị
thật/iOS/Safari; không tuyên bố âm thanh ngoại tuyến đã hoàn tất.

## Nén file tĩnh

Profile ghi nhận OSMD truyền 1.165.533 byte và ba CSS lớn đều chưa nén. Apache
kiểm thử có headers/rewrite nhưng không bật deflate/filter. API đã có gzip từ
trước, không thay đổi API trong đợt này.

`assets/.htaccess` phục vụ bốn bản gzip dựng sẵn khi client chấp nhận, theo
[hướng dẫn Apache](https://httpd.apache.org/docs/2.4/mod/mod_deflate.html#precompressed).
OSMD giảm còn khoảng 298 KB qua mạng; mã sau giải nén giống hệt nguồn.
Không bundler/minifier hoặc sửa thuật toán renderer/CSS. Các file nguồn được
ghim LF trong `.gitattributes` để giữ byte nhất quán giữa Windows và Linux;
commit chuẩn hóa riêng chỉ thay newline, không đổi nội dung CSS/JS.

Đã kiểm HTTP thực: MIME đúng, `Vary: Accept-Encoding` ở hai biến thể, `gzip;q=0`
được tôn trọng, ETag hai biến thể khác nhau, 304 đúng, không dùng ETag gzip để
trả 304 cho identity, Range trả đúng 20 byte identity. Thiếu module hỗ trợ hoặc
thiếu sidecar thì tiếp tục trả file gốc. Không mở endpoint PHP phục vụ asset.

Khi sửa một trong bốn nguồn, bắt buộc dựng lại và kiểm tra:

```powershell
php tools/generate_asset_gzip.php
php tools/generate_asset_gzip.php --check
```

`tests/library_tv2_gzip_regression.php` kiểm tra sidecar khớp nguồn và HTTP thực;
thay nguồn mà quên dựng lại sẽ FAIL. Kiểm HTTP cần `SHEETAPP_TEST_URL` trỏ bản sao
cách ly. Không ghi DB/storage trong test này. 56 check gồm 52 hành vi và 4 kiểm
tra tồn tại file; không tính kiểm tra tồn tại là hành vi.

## Bằng chứng và giới hạn

Cổng cuối, chạy tuần tự trên bản sao Apache có DB/storage riêng:
**99/99 Chromium ROADMAP6 PASS** (2,7 phút), **174/174 suite PHP / 3.399 check
PASS**, 0 skip/fail (134,12 giây), 331 PHP lint. ESLint phần JS sửa,
`git diff --check` và generator `--check` PASS. Log: `tv24-chromium-final.txt`,
`tv24-php-final.txt`, `tv24-gzip-artifacts-green.txt`.

DB nguồn giữ SHA256
`A91268B27DF548845C67B8F375C2D13B5899FFA4716BA99A00D59E4BC157CAC9`;
checkout nguồn main sạch. Không sửa production code sau các cổng cuối.

Log gốc ở `test-results/roadmap6-evidence/`, bản UTF-8 để duyệt ở
[`roadmap6-evidence/`](roadmap6-evidence/README.md).

| Phần | FAIL trước | Kiểm lại |
|---|---|---|
| Startup AudioContext hai UI | `tv24-boot-red.txt`: 2 FAIL | `tv24-audio-green.txt`: PASS |
| Dừng trong khi native play chưa xong | `tv24-races-red.txt`: 1 FAIL / 2 PASS | `tv24-audio-green.txt`: PASS |
| Classic base path và thử lại script | `tv24-loader-red.txt`: 2 FAIL với loader ở `56bf2b6` | `tv24-loader-green.txt`: 2 PASS |
| Sidecar chưa có | `tv24-gzip-artifacts-red.txt`: 4 FAIL | generator `--check` PASS |
| Có sidecar nhưng HTTP chưa nén | `tv24-gzip-http-red.txt`: FAIL | `tv24-gzip-http-final.txt`: 56 PASS |

TV2-4 đã được sửa và kiểm trên Chromium. TV2 còn mở: tải theo nhu cầu các nhóm
module khác để giảm request/JS; tổng kết runner khi quality gate ngoài regression
thất bại; precache đủ và version hash; catalog/lyrics ngoại tuyến; version gói
gồm XML/hợp âm; session GET song song. Không đánh dấu TV2 hay ROADMAP6 hoàn tất.
