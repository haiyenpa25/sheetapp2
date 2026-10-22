# Thực thi PHUONG_AN_2 — 2026-10-21

Nhánh `fix/opt-review-20261021`; một người thực thi. Giữ các thay đổi OPT trước đó, khôi phục theo dõi cấu hình mặc định theo Q-A. Không sửa bảng quyết định/chữ ký. Chưa commit, merge, push hoặc deploy.

## Các quyết định đã nhận trong hội thoại

- Q-A: `features.json` trong Git, `features.local.json` ngoài Git ghi đè. Đã giữ cờ hiện hành và bổ sung hướng dẫn cập nhật server.
- Q-B: giữ bộ riêng tư; chương trình nhắc chọn bộ công khai/HD. Gói offline ghi rõ bộ bị từ chối, không coi là tải đủ.
- Q-C: duyệt tạo unique index sau backup; không thay chủ sở hữu. Dry-run thực tế có **0 mã trùng, 0 bộ sai chủ**. Các dòng 5/6/8 thuộc đúng user `banhat`; nhận định gán lại chủ trong đề xuất là false positive.
- Q-D: duyệt xoá đúng manifest gồm **81 domain_events, 37 notifications, 2 notification_deliveries**, sau backup.
- Q-E: **việc chủ dự án**: đổi mật khẩu yếu; tài khoản dùng chung chỉ viewer. Chưa đổi mật khẩu/role thật, chưa đánh dấu hoàn thành.
- Q-F: **việc chủ dự án/người có quyền server**: kiểm gzip production trước merge. Chưa đánh dấu hoàn thành.

## Mã đã sửa và kiểm chứng

Bằng chứng thô nằm trong [fix-evidence](fix-evidence/). Số check dưới đây là của từng suite, không cộng lại thành số ca độc lập vì có suite dùng chung.

| Ticket | Kết quả | Bằng chứng |
|---|---|---|
| FIX-01 | Resolve review chỉ đọc theo chủ; không tạo/chiếm bộ người khác; chặn saveSet khác chủ | `FIX-01.txt`: 6 check service và 165 HTTP check ở lượt tương ứng; suite HTTP mở rộng hiện 173 check |
| FIX-02 | Chặn tên chuẩn sau sanitize/transliteration ở fork/clone/Manager; load HD ưu tiên dòng đầu | `FIX-02.txt`: 39 check; cần rà riêng nếu nơi triển khai đã có HD giả tồn tại trước bản chính |
| FIX-03/04 | Chụp context khi hẹn lưu; flush trước đổi bài/bộ; seed checksum; phản hồi cũ không rollback context mới | `FIX-03-04.txt`: 8 check VM sau mở rộng; `FIX-03-05-browser.txt`: lưu A/B qua HTTP đúng hợp âm, không 409 |
| FIX-05 | Follower và cả preload setlist dùng đường dẫn XML thật, truyền XML đã nạp cho loader | `FIX-05.txt`: 4 check VM; `FIX-03-05-browser.txt`: hai context nhận bài qua transport live thực, SVG và xmlPath khớp |
| FIX-06/21 | Encode bộ Classic, stage catalog, admin, OMR; quote/encode ID trong inline handler | `FIX-06-21.txt`, `FIX-27.txt`: Chromium fixture, suite mở rộng 11 check |
| FIX-07 | Defaults trong Git + local override; giữ nguyên feature hiện hành | `FIX-07.txt`: 5 check; `docs/LIBRARY_DATA_RELEASE.md` |
| FIX-08 | Bỏ merge=ours cho manifest runtime | `.gitattributes`; manifest sinh lại và --check đạt |
| FIX-09 | Tool nhãn/spelling đồng bộ FTS qua song_id, không dựa rowid | `FIX-09.txt`: suite 13 check, fixture rowid bị dịch |
| FIX-10 | Lock log thất bại vẫn append có LOCK_EX và báo lỗi; xoay lỗi không làm mất bản ghi | `FIX-10.txt`: 18 check |
| FIX-11 | Manager search/detail/versions lọc quyền bài và phiên bản | `FIX-11.txt`: 7 check |
| FIX-12 | Cảnh báo profile riêng khi thêm chương trình; offline đánh dấu forbidden và không báo sẵn sàng | `FIX-12.txt`: 5 check backend; Q-B |
| FIX-13 | Không di chuyển chủ: kết luận sai chủ bị bác bởi DB thật; sửa thông báo lỗi xoá cho đúng ngữ cảnh | `data-repair-dry-run.json`, `FIX-13-19-44.txt` |
| FIX-14 | Tên XML phiên bản có suffix ngẫu nhiên, tạo exclusive; không ghi đè khi thiếu số thứ tự | `FIX-14.txt`: 2 check |
| FIX-15 | Generation dưới cache lock ngăn truy vấn cũ xuất bản lại snapshot sau invalidate | `FIX-15.txt`: 3 check race bổ sung, suite snapshot hiện hành |
| FIX-16/17/18 | Gate export mọi định dạng; phòng live chỉ hết hạn theo expiry; logout GET trả 405 trước phá session | `FIX-16-17-18.txt` và suite auxiliary guards: 4 check |
| FIX-19 | Kiểm mã hợp âm case-insensitive/trim; generator tránh trùng/tên chuẩn; unique index đã áp dụng có duyệt | `FIX-19.txt`: 4 check; `data-repair-applied.json` |
| FIX-20 | Hạn mức log 60/session/15 phút và 500/IP/15 phút, không làm cả IP bị khoá sau 10 log | `FIX-20.txt`: suite HTTP 95 check |
| FIX-22/23 | Preload vô hiệu load cũ; cả hai UI chặn switch trả muộn | `FIX-03-04.txt`, `FIX-23-26-30.txt` |
| FIX-24/28 | Classic token chặn XML cũ, dùng đúng OfflineVault saveXml/getXml theo đường dẫn | `FIX-24-28.txt`: 3 check; `FIX-03-05-browser.txt`: đổi bài với XML trả muộn, Modern/Classic trên Chromium/WebKit |
| FIX-25 | Play token chặn BPM item cũ sau await và khi kết thúc chương trình | `FIX-25.txt`: suite async 7 check |
| FIX-26 | Hai UI bỏ notes cũ sau đổi bài; huỷ timer lưu khi đổi bài | `FIX-23-26-30.txt` |
| FIX-27 | Classic hiển thị tông gốc/tập, ưu tiên BPM setlist → notes → XML | `FIX-27.txt`: suite Chromium 11 check |
| FIX-29 | XML version qua API kiểm quyền bài/phiên bản và managed path, private/no-store; frontend dùng API | `FIX-29.txt`: 7 check service; HTTP mở rộng 173 check, gồm 8 check version XML |
| FIX-30 | Offline chỉ trả đúng profile, không đổi nhãn HD hoặc dùng bộ bất kỳ | `FIX-23-26-30.txt` |
| FIX-31 | Xoá cache tên bộ lúc login/logout; response cũ không tái lập cache qua đổi tài khoản | `FIX-31.txt`: 2 check |
| FIX-32/33 | Null profile về HD; xoá thất bại giữ bộ/hợp âm; bỏ binding DOM chết, giữ nút thực | `FIX-03-04.txt`: 3 check bổ sung về null/preload/delete |
| FIX-34 | Practice start/finish và unload keepalive gửi CSRF header | `FIX-34.txt`: 2 check VM |
| FIX-35 | PointerTap dùng chung: chỉ chọn nốt sau tap, huỷ khi kéo/cancel; touchcancel reset pinch | `FIX-35.txt`: 11 check Chromium, cả Dots và renderer |
| FIX-36 | Bỏ encode hai lần tiêu đề mục không phải bài | `setlist-detail.js`; kiểm cú pháp và hồi quy tổng |
| FIX-37 | SW chỉ cache catalog public có header rõ ràng; không nhầm navigation shell; Vault public v3 bỏ cache cũ | `FIX-37.txt`: 5 check SW + 2 check Vault |
| FIX-38 | Chờ người có quyền server kiểm production theo Q-F | Không đánh dấu thay chủ dự án |
| FIX-39 | Generator từ index.php, hash CRLF độc lập, --check không ghi; tách vendor hash | `FIX-39-P2-01.txt`: 77 check; tích hợp phần generator/test của 11eacc9 trên cây hiện tại |
| FIX-40 | Bốn suite ban đầu và Core Rule bổ sung dùng storage/mail/audit tạm và cleanup | `FIX-40.txt`: cả 4 đạt, không chạm file storage ứng dụng |
| FIX-41 | Global E2E/session/setup bắt buộc bản sao ngoài workspace và URL khớp marker; bỏ snapshot/restore DB thật; sửa đường dẫn PHP | `FIX-41.txt`, `FIX-41-portability.txt`: 4 check guard, 45 spec chuyển helper theo lô; chưa chạy toàn bộ legacy E2E |
| FIX-42 | PHP_BINARY/Node binary portable; SSE đợi stream thực thay delay mù | `final-strict-suite-rerun.txt`; hồi quy live atomic/SSE và runner |
| FIX-43 | Runbook đúng phạm vi DB+manifest; mật khẩu backup qua env/stdin; drill chỉ dùng DB fixture | `FIX-43.txt`: 24 check; chưa cài scheduler production |
| FIX-44 | Đã xoá đúng manifest được duyệt sau backup | `data-repair-applied.json`, `data-repair-verification.json` |
| FIX-45 | Chờ chủ dự án đổi mật khẩu/hạ quyền tài khoản dùng chung theo Q-E | Không ghi mật khẩu hoặc đổi role thật |

## Thao tác DB thật đã được duyệt và hoàn tất

Lệnh: `php tools/apply_data_repair_plan.php --plan=docs/fix-evidence/data-repair-dry-run.json --backup-dir=C:/xampp/htdocs/sheetapp2/storage/backups --apply-index --apply-cleanup`.

Tool đối chiếu plan hash `88c6042ef330d0c4c56c45456b7c1d4702d9bfd96cfb5a0779fabf44b5d4d5ce`, tạo backup bằng VACUUM INTO, kiểm integrity rồi chạy transaction. Backup: `storage/backups/app_before_phuong_an_2_20261021_123809_e229a7456df8.sqlite`; SHA256 `396f4872d137d9ca819a82ed2760df84835437183b45ae3261ff1d353ba6e0c9`.

Đã tạo `users_chord_code_unique`; xoá đúng 2 delivery, 37 notification, 81 event. `php tools/verify_data_repair.php` mở DB/backup read-only, xác nhận integrity/FK, từng ID được duyệt, toàn bộ dòng ngoài danh sách và mọi bảng còn lại khớp backup. Không đổi chủ sở hữu. DB sau apply: SHA256 `ca329059a0fb9d8cd13f0fc438fbc0e2ec8124b6ecdd6e00b90274f5796704f1`.

## Cổng hồi quy và phạm vi nghiệm thu

- Snapshot trước: `batch-A-suite.txt` 182/191 đạt, 9 lỗi ngân sách dòng. Đã sửa.
- Snapshot giữa: `batch-AC-D-suite.txt` **198/198 suite đạt**, 0 skip, 3.931 check; chưa bao phủ các sửa cuối.
- Lượt tổng đầu sau các bản vá: `final-strict-suite.txt` đạt 198/207, 9 lỗi. Đã sửa test bám binding/chữ ký cũ, renderer 600 dòng (giảm còn 598), format guard CLI và session fixture PHP bị guard E2E chặn. 9 suite chạy riêng lại đều đạt (`final-gate-followup.txt`). Lượt tổng sau sửa tại `final-strict-suite-rerun.txt`: **207/207 suite PASS, 0 skip, 4.049 check PASS, 0 fail**, PHP lint 377 file, JS syntax và ESLint PASS; 268,71 giây. Lượt này chạy trước khi thêm require cách ly cho standalone Core Rule; thay đổi một dòng đó đã được kiểm riêng 9/9 và checksum audit không đổi.
- Browser nghiệm thu cuối: **8/8 đạt trên Chromium/WebKit** (38,7 giây), gồm lưu A/B, host/follower qua live transport thực và XML A trả muộn sau B trên cả Modern/Classic. Lượt đầu lỗi fixture đọc `.data` trên ApiService.songs.get và chọn tài khoản không phải admin; đã sửa fixture, giữ log các lượt lỗi. Legacy follow-leader spec cũ dừng ở nút toolbar ẩn; chưa coi toàn bộ legacy E2E đạt.
- Smoke: **8/8 đạt**, Chromium/WebKit × Modern/Classic × 1366/390; SVG, tông gốc, transpose, client log và không pageerror. `browser-smoke-final.txt`.
- Component ROADMAP6: **79 đạt, 57 skip**, 0 fail ở lượt đã chạy; không tính các case skip là đạt.
- Test ghi dữ liệu chỉ ở DB memory/thư mục tạm/bản sao. DB thật chỉ thay đổi trong thao tác Q-C/Q-D nói trên.

## Đợt E và phần chưa nghiệm thu

P2-01 và P2-06 đã tích hợp (generator; CI strict/JS, manifest --check, Chromium). P2-12 đã cập nhật registry theo controller/router/schema/load order thật và sinh CODE_MAP. Workflow GitHub chưa chạy trên remote.

P2-02/03/05/07/08/11/13 vẫn là công việc tối ưu tiếp, chưa tuyên bố hoàn tất. P2-04 phụ thuộc gzip production; P2-09 chờ Q6 đối soát 3 file JSON lệch (57/60 khớp); P2-10 chờ Q8. Chưa xoá worktree. Các vấn đề kiến trúc cũ về fallback DB/disk và rollback JSON của HD chưa được coi là đã giải quyết bằng những bản vá này.

Chưa đủ điều kiện tự xác nhận merge/triển khai: còn FIX-38/FIX-45 do chủ dự án thực hiện, và nghiệm thu rộng E2E cho từng race trên cả hai UI. Không đánh dấu toàn bộ 45 ticket hoặc toàn bộ phương án OPT đã xong.
Kiểm tra standalone bổ sung phát hiện Core Rule ghi 1 dòng audit fixture (service_plan_create). Đã cách ly suite này; chạy lại 9/9 check đạt, checksum audit trước/sau không đổi. Giữ dòng đã ghi, không xoá log thật. Audit hiện 8.482 dòng, SHA256 c478f2ce2378f9d6a7feb79dda5166504869a4e6c2ff8cabef2644b1ebbae6a0. Mail vận hành vẫn 462 file.
