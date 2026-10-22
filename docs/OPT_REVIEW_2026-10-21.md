# Rà soát lại phương án tối ưu — 2026-10-21

> **Đợt sửa tiếp:** [PHUONG_AN_2_EXECUTION.md](history/PHUONG_AN_2_EXECUTION.md) ghi các bản vá FIX, kiểm thử và trạng thái mới nhất. Q-C/Q-D đã được duyệt và thực hiện sau backup: unique index mã hợp âm, xoá đúng 81 event/37 notification/2 delivery; không thay chủ bộ. Các số liệu kiểm thử bên dưới là mốc lịch sử của phiên OPT.

Nhánh bàn giao: `fix/opt-review-20261021`. Đối chiếu bản Claude đã làm tại `b7f5f13` và chạy lại kiểm thử. Đây là báo cáo tiến độ thực thi, **chưa phải nghiệm thu toàn bộ OPT-01…26**. Không điền bảng quyết định hoặc chữ ký của chủ dự án.

Chủ dự án đã duyệt **Q4** trong cuộc hội thoại: bộ riêng tư chỉ chủ bộ đọc; khách/người khác/admin đọc HD, TLH/default và bộ công khai. Sau đó duyệt riêng **Q1 (đúng danh sách 63 backup)** và **sửa lỗi alias bộ chuẩn**. Không suy ra phê duyệt Q5/Q6 hoặc các quyết định khác.

## Kết quả kiểm chứng

- `php tests/run_all_tests.php --strict --js` sau sửa alias: **184/184 suite PASS, 0 SKIP, 0 FAIL; 3.740 checks PASS; 349 PHP files lint PASS; JS syntax và ESLint PASS**. Thời gian runner đo: 360,78 giây. Các lượt trước OPT-04 và trước sửa alias được giữ trong evidence.
- Chromium và WebKit: **8/8** tổ hợp Modern/Classic × 1366/390 px. Mỗi ca mở bài, thấy SVG, xác nhận tông ban đầu = 0, bấm tăng tông, gửi log qua ApiService/router thành công và không có `pageerror`. Có ảnh chụp trong thư mục bằng chứng. Đây là smoke test, không thay thế toàn bộ E2E thao tác ghi hoặc đo 4G.
- Test R34: **98 checks × 3 lượt PASS**, số file backup thật **73 → 73**. Fixture tổng hợp đủ 903 bài, không sao chép DB vận hành. Dry-run giữ nguyên checksum DB fixture.
- OPT-04 bổ sung: snapshot cache/ETag **7 checks PASS**, CLI invalidation tempo/lời/chính tả **9 checks PASS**, GET/HEAD/ETag thường/yếu/wildcard trên HTTP **6 checks PASS**. JSON và ETag dùng chung khóa khi thay thế; cache cũ được bổ sung ETag một lần.
- Log rotation: **14 checks PASS**. Quyền bộ hợp âm và bảo vệ alias qua HTTP/service/Manager: **161 checks PASS**. Log endpoint/đăng ký/lỗi nội bộ/export trên HTTP: **44 checks PASS**, giữ lỗi validation dự kiến là HTTP 400 và chỉ che lỗi nội bộ bằng 500. Metadata schema: **10 checks PASS**. Biên controller/service: **6 checks PASS**.
- CI fixture khi không còn `features.json` trong Git: chỉ bật ChordPro trên bản cài kiểm thử; suite export **27 checks PASS**. Không bật feature trên production.

Toàn bộ lượt tổng chạy ở bản sao ngoài workspace, phục vụ bằng Apache riêng tại `http://127.0.0.1:8922/sheetapp2`. Test HTTP chuyên biệt tự khởi động PHP server riêng với fixture memory/thư mục tạm. Không chạy toàn bộ E2E trên bản vận hành.

Lượt đầu dùng PHP development server: 174/179 suite PASS. Đã sửa hai lỗi test: thiếu `SUITE_COMPLETE` ở backup-prune và URL hardcode ở ChordPro. Các kiểm tra `.htaccess`, gzip và SSE đồng thời được chạy lại trên Apache. Test shim log cũ được cập nhật để đòi **403 khi thiếu Origin**, có test riêng kiểm tra ghi hợp lệ **200**; không bỏ qua lỗi để làm xanh suite.

**Lưu ý OPT-19:** tỷ lệ Behavioral/Static runner in ra vẫn có mặc định phân loại sai. Không dùng con số phần trăm đó làm chứng cứ tỷ lệ test hành vi. Các test mới có nhãn PASS:B và thực thi PHP/HTTP/SQLite/filesystem thật trên fixture cô lập.

## Phát hiện alias bộ chuẩn — đã duyệt và sửa

Probe bổ sung sau lượt tổng phát hiện Core Rule 3 chưa được chặn ở alias khi xoá: `deleteSet(song, 'HD', ..., true)` trả false, nhưng `deleteSet(song, 'banhat__HD', ..., true)` xoá được dòng HD của banhat. Đã tái hiện **chỉ trên DB memory**, không xoá dữ liệu thật. Xem `protected-alias-probe.php` và output tương ứng.

Theo `ROADMAPS.md` mục 2.10: **“Dừng và hỏi khi cần xoá dữ liệu, đổi Core Rule, đổi quyền theo role, hoặc phát hiện lỗ hổng mới.”** Chủ dự án đã duyệt sửa riêng trong cuộc hội thoại. DELETE tại ChordSetService nay bảo vệ `LOWER(set_name)` của dòng DB thực tế; Manager kiểm tra tên bộ chuẩn trước luồng xoá trực tiếp theo ID. Đây là giữ nguyên Core Rule 3, không thay đổi quy tắc đó.

Test mới tái hiện FAIL trước khi sửa và PASS sau khi sửa cho cả HD/TLH/default, chủ bộ/admin, HTTP/service/Manager. Bộ test đạt **161 checks PASS**, có kiểm tra bộ cá nhân hợp lệ vẫn xoá được. Probe sau sửa trả `qualified_hd_alias_delete=false`, `remaining_hd_rows=1`. Bằng chứng: `alias-guard-{red,green}.txt`, `alias-manager-{red,green}.txt`, `protected-alias-fixed.txt`.

## Q1 — đã xoá đúng danh sách được duyệt

- Đối chiếu lại danh sách hiện hành với `prune-dry-run.txt`: đúng **63 file**, đúng **470.441.984 byte**, đường dẫn tuyệt đối nằm trong `C:\xampp\htdocs\sheetapp2\storage\backups`, không có reparse point trong danh sách.
- Đã chạy `tools/prune_backups.php --apply` sau khi nhận duyệt. Backup giảm **73 → 10 file**, giữ 3 bản r34 mới nhất và các file ngoài danh sách.
- Kiểm chứng đủ **10/10 checksum** của file giữ lại không đổi. Dry-run sau xoá còn **0 ứng viên**.
- Bằng chứng: `prune-approved-recheck.txt`, `prune-preserved-before.json`, `prune-applied.txt`, `prune-verification.txt`, `prune-after.txt`. Không xoá dữ liệu hoặc backup khác.

## Từng ticket

| Ticket | Kết quả rà soát / việc đã thực hiện | Còn lại |
|---|---|---|
| OPT-01 | Khép lỗ hổng còn sót: R34 dry-run nhận `--db`, dùng PHP_BINARY, fixture 903 bài, VACUUM INTO. Tool không bật WAL trong dry-run/status. Ba lượt PASS | Không còn trong phạm vi ticket này |
| OPT-02 | Đã nhận duyệt Q1, xoá đúng 63 file / 470.441.984 byte; còn 10 file với checksum giữ nguyên, dry-run còn 0 ứng viên. Test tool 12 checks | Đã thực hiện bước xoá được duyệt; không xoá thêm file khác |
| OPT-03 | Thêm RotatingLog dùng khóa chung cho rotate+append, 5 MiB/file, 3 archive; audit và client log dùng chung. Runner đặt đường dẫn client log tạm, dọn cả lock/archive | Chưa dọn log/mail cũ; không tự xoá dữ liệu vận hành |
| OPT-04 | Lưu ETag cạnh cache; reader/writer/invalidation dùng khóa chung để ETag khớp đúng JSON, không hash lại khi sidecar hợp lệ. Tempo/lời/chính tả/update_library đều dùng SongService::invalidateCache theo DB đang xử lý | Đã PASS test fixture và HTTP; không chạy tool ghi lên DB thật |
| OPT-05 | Script cũ đã bỏ push ở commit trước; thay npm `sync` bằng `prepare:assets`, chạy được đa nền tảng; batch dừng khi bước generator lỗi | Giữ file sync.sh/sync.bat làm entry point tương thích, không chạy chúng trong phiên này. Tên `prepare:assets` tránh tự chạy như npm lifecycle `prepare` khi cài dependency |
| OPT-06 | `git rm --cached` đúng 3 file: cache, features.json, XML .bak; file local giữ nguyên. Ignore config server, CI tạo cấu hình fixture riêng | Không còn 3 file này trong index; cần chủ dự án review commit trước khi merge |
| OPT-07 | Registry đã tách lịch sử ở commit trước. Rà lại còn 6 mục, bỏ mục thứ sáu đã có nguyên văn trong changelog; giữ 5 mục | Không sửa bảng ADR/quyết định |
| OPT-08 | Members UI/cờ JS đã được Claude dọn một phần ở b7f5f13 | key-service.js cũ vẫn còn; cần duyệt danh sách trước khi xoá và cập nhật test liên quan |
| OPT-09 | **Đã thực thi theo Q4**: list/load/details/checksum cùng lọc quyền; không quét đĩa làm lộ tên; fallback file cá nhân chỉ sau khi DB xác nhận quyền; delete phải xoá được dòng DB. Sửa caller Manager truyền danh tính/quyền hiện hành. Đã duyệt và sửa thêm chặn alias xoá bộ chuẩn ở service và Manager | Không bỏ fallback HD/TLH/default; việc chuyển hoàn toàn sang DB thuộc OPT-12 |
| OPT-10 | Chưa bật production; mặc định csrf_enforce vẫn false | TV4-4, staging E2E thao tác ghi, Q5 |
| OPT-11 | Client log qua router và shim; Origin/CSRF guard chung, body ≤8 KiB, hạn mức IP; đăng ký giới hạn IP dù đổi username. ChordPro dùng resolveManagedXmlPath. Các catch Throwable được nêu trong phương án dùng serverError | Đã kiểm tra các trường hợp lỗi nội bộ trả JSON 500 an toàn. Không tự thay chính sách quyền khác |
| OPT-12 | Đối soát tool trên bản sao và script chỉ đọc trên DB nguồn cho cùng kết quả **57/60 khớp, 2 thiếu, 1 khác dữ liệu** | **Chưa đủ điều kiện bỏ fallback**; Q6 và backup/đối soát trước khi ghi DB thật |
| OPT-13 | SQL Review/Setlist chuyển vào service; DB gom metadata cache theo PDO và schema_version. Test DDL/thay connection không dùng cache cũ | Đã PASS test riêng và lượt tổng |
| OPT-14 | Chưa mở rộng gzip toàn bộ assets | Theo TV2; hiện rewrite vẫn chỉ nhắm 4 asset cũ |
| OPT-15 | Chưa bỏ script nạp trùng preset | TV2-2; chưa đo lại ngân sách sau thay đổi này vì chưa triển khai |
| OPT-16 | Chưa thực hiện bước nối JS | Chờ OPT-15, số đo request và Q7 |
| OPT-17 | Đã sinh lại manifest/hash để phát hành ApiService mới | Chưa có generator --check trong CI hoặc cache vendor theo hash nội dung; chưa hoàn tất ticket |
| OPT-18 | CI thêm config fixture để fresh checkout vẫn kiểm tra HTTP export khi config server không còn tracked | Chưa thêm job ESLint/Playwright/cache và strict trong workflow; local --strict --js PASS không thay thế việc chạy GitHub Actions |
| OPT-19 | Ghi nhận runner vẫn mặc định suite không khai báo là behavioral | Cần tách thành các đợt ≤5 file: đổi mặc định về static, khai báo từng suite, test báo cáo runner |
| OPT-20 | Chưa triển khai trọn bộ tối ưu backend | Index httlvnId, batch offline chords, SSE 250 ms, job đối soát FTS |
| OPT-21 | Chưa hội tụ Classic/Modern | TV6, từng nhóm 2–3 module có E2E hai UI |
| OPT-22 | Chưa gộp live transport | Cần E2E live-band và fallback polling |
| OPT-23 | Chưa có SatbParser chung | Cần test MusicXML thật cho hai consumer |
| OPT-24 | Chưa đổi chính sách ngân sách file | Q8; không tự thay Core Rule/tiêu chuẩn |
| OPT-25 | Chưa gộp CSS/token breakpoint | TV3-7 |
| OPT-26 | Claude đã chuyển một phần report/tool vào history/archive | Chưa hoàn tất toàn bộ danh sách; migrate_json_chord_sets_to_db vẫn ở tools/ và còn test tham chiếu |

OPT-04 tách thành snapshot/ETag (3 file) và CLI invalidation (5 file). OPT-11 tách thành endpoint log (5 file), đăng ký/API client (3 file), export/error handling (5 file), giữ validation 400 bằng exception có kiểu (4 file). OPT-13 tách thành metadata schema (4 file) và chuyển SQL controller/service (5 file). Tài liệu/evidence là phần bàn giao chung. Không có một lần thay cả hệ thống hoặc đổi Core Rule.

## Chênh lệch dữ liệu chặn OPT-12

Script chỉ đọc `audit-readonly.php` kiểm tra JSON bằng cùng cách `md5(json_encode(...))` như tool migration và so thêm dữ liệu giải mã:

1. Chưa có dòng DB tương ứng `storage/data/chord_sets/song-f3-test/HD.json`.
2. Chưa có dòng DB tương ứng `storage/data/chord_sets/thanh-ca-001/banhat__Acoustic_Guitar.json`.
3. `storage/data/chord_sets/thanh-ca-001/HD.json` khác checksum/count so với DB; **dữ liệu giải mã cũng khác**, không chỉ metadata checksum cũ.

Không tự xoá file có tên giống fixture, không lấy JSON đè HD trong DB. Cần chủ dự án chọn nguồn đúng cho ba trường hợp này, rồi backup và xác nhận thao tác trên DB thật. Bảng Q6 trong phương án được giữ nguyên.

## An toàn dữ liệu và phạm vi kiểm thử

- DB nguồn có SHA256 `a91268b27df548845c67b8f375c2d13b5899ffa4716ba99a00d59e4bc157cac9`, khớp mốc bàn giao trong registry trước phiên này.
- Snapshot trước/sau kiểm chứng trước Q1: `source-before.json`, `source-after.json`. Sau Q1: `source-after-approved.json`; checksum DB/audit và số mail giữ nguyên, riêng backup giảm 73 → 10 theo phê duyệt.
- Ba file ghi trạng thái D trong Git là **ngừng theo dõi trong index**, không phải xoá bản local.
- Không push, deploy, chạy sync hoặc migration trên DB thật; không đánh dấu việc vận hành/nghiệm thu của chủ dự án đã xong.
- Các mục P2/P3 trong bảng là công việc còn mở; chưa đạt mục tiêu ≤40 JS/≤60 request/4G hoặc hợp nhất Classic. Ưu tiên tiếp theo là duyệt danh sách mã chết OPT-08, xử lý đối soát OPT-12 và chuẩn bị TV4-4 trước khi bật production.

## Bằng chứng và lệnh tái hiện

Trong `docs/opt-evidence/`:

- `*-red.txt`, `*-green.txt`: output FAIL/PASS cho R34, log rotation, privacy HTTP, client log/registration/error/export, metadata và service boundaries.
- `baseline-suite.txt`: lượt đầu; `final-suite.txt`: lượt Apache strict + JS đầy đủ.
- `browser-smoke.cjs`, `browser-smoke.txt`, 8 ảnh PNG: smoke hai trình duyệt/hai UI/hai kích thước.
- `prune-dry-run.txt`: danh sách **chưa xoá**, sẵn để duyệt Q1.
- `reconcile.txt`: tool chạy trên bản sao; `audit-readonly.php`, `source-before.json`, `source-after.json`: kiểm tra chỉ đọc DB nguồn.
- `ci-fresh-feature-flags.txt`: test export với cấu hình CI tách khỏi cấu hình server.
- `cache-{red,green}.txt`, `tool-cache-{red,green}.txt`, `catalog-http.php`, `catalog-http.txt`: OPT-04, gồm HTTP 304/HEAD và cache đúng DB của CLI.
- `validation-{red,green}.txt`: giữ lỗi nhập liệu dự kiến là 400 trong khi lỗi DB vẫn 500 an toàn; `protected-alias-probe.{php,txt}`: phát hiện mới cần duyệt.

Lượt tổng (chỉ chạy trong bản sao đã cài đủ dữ liệu và có Apache riêng):

```powershell
$env:Path = 'C:\Program Files\nodejs;C:\xampp\php;' + $env:Path
$env:SHEETAPP_TEST_URL = 'http://127.0.0.1:8922/sheetapp2'
php tests/run_all_tests.php --strict --js
```

Smoke không chạy global setup/teardown ghi DB; vẫn chỉ dùng bản sao:

```powershell
$env:SHEETAPP_OPT_TEST_URL = 'http://127.0.0.1:8922/sheetapp2'
node docs/opt-evidence/browser-smoke.cjs
php docs/opt-evidence/audit-readonly.php
```

Commit message chuẩn bị: `fix: close OPT P0 isolation gaps and harden chord reads and auxiliary endpoints`.
