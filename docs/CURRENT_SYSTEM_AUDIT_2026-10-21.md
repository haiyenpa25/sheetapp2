# Rà soát hệ thống hiện tại — 2026-10-21

Phạm vi: mã đang làm việc trên nhánh `fix/opt-review-20261021`, gồm các thay đổi chưa commit từ đợt OPT. Kiểm tra lại luồng ghi/đọc hợp âm, transaction, cache, cổng CI và tình trạng dữ liệu. Đây là rà soát có trọng tâm, không phải chứng nhận an toàn toàn hệ thống. Sau rà soát, chủ dự án đã duyệt sửa riêng lỗ hổng alias riêng tư trong cuộc hội thoại.

## Bản sửa alias riêng tư sau phê duyệt

- Manager truyền chủ sở hữu thực tế và `is_public` của bộ gốc khi tạo/cập nhật alias. Chỉnh sửa bằng admin không đổi chủ bộ sang admin hoặc user mặc định 1.
- Thay đổi quyền không gửi lại hợp âm vẫn đồng bộ alias; đổi tên đưa alias cũ về riêng tư, không xoá file/dòng cũ.
- Ghi nội dung và quyền alias bằng một UPDATE; lỗi DB ở luồng có quyền rõ ràng được ném lên, không dùng fallback JSON để báo thành công. Manager chỉ công bố metadata bộ gốc sau khi cập nhật quyền alias thành công. Lỗi ghi DB của các lời gọi legacy không truyền quyền vẫn là phát hiện riêng bên dưới.
- Test mới `tests/manager_alias_privacy_regression.php`: RED trước sửa, GREEN sau sửa, **80 checks**. Có tạo/sửa bộ riêng tư, công khai rồi chuyển riêng tư chỉ bằng metadata, sửa alias legacy sai chủ trên fixture, đổi tên, admin sửa, kiểm tra khách/chủ/người khác/admin qua load/details/list và lỗi DB khi đổi quyền.
- Hồi quy trên bản sao ngoài workspace: **8/8 suite PASS, 349 checks** (gồm các kiểm tra hành vi và suite legacy; không tuyên bố tất cả là behavioral). Các suite: Manager alias 80, HTTP privacy 161, chord consolidation 32, members/manager 7, review integrity 9, review workflow 45, chord guard 6, core rules 9. PHP lint 3 file PASS; diff whitespace PASS. Output RED/GREEN và hồi quy: `docs/opt-evidence/manager-alias-privacy.txt`.
- Chưa chạy lại lượt tổng strict/JS: automatic approval review từ chối lệnh khởi động Apache riêng kèm runner, chỉ trả lý do `blocked by policy`. Đã dùng các suite liên quan không cần khởi động Apache riêng; HTTP privacy tự chạy fixture server của suite. Không sử dụng server vận hành thay thế.
- Kiểm tra sau sửa: checksum DB/audit, số mail và backup thật giữ nguyên các giá trị ở cuối báo cáo. Không sửa/di chuyển dữ liệu vận hành, không push/deploy. Alias lỗi đã có sẵn chỉ được đồng bộ khi bộ tương ứng được cập nhật; chưa quét/sửa hàng loạt các bản sao lịch sử. Các alias cũ từ những lần đổi tên trước bản sửa cũng cần đối soát riêng.

Ba phát hiện còn lại dưới đây vẫn mở. Cơ chế tạo dòng alias trùng chưa được loại bỏ; việc đó thuộc OPT-12/Q6.

## Phát hiện cần xử lý

### P1 — Bộ riêng tư có bản sao alias công khai sau khi lưu qua Manager — đã sửa mã sau duyệt

`api/services/ManagerService.php:335` gọi `saveSet()` bằng tên alias nhưng không truyền chủ sở hữu. `ChordSetService::saveSet()` tạo dòng DB mới với `user_id=1`, `is_public=1`; cập nhật dòng gốc ở Manager không cập nhật alias đó.

Đã tái hiện trên fixture memory: dòng `PrivateAudit` của user 2 vẫn `is_public=0`, nhưng xuất hiện `banhat__PrivateAudit` của user 1 với `is_public=1`. Khách không đọc được tên gốc, **đọc được toàn bộ hợp âm mới qua alias**. Chính sách Q4 ở truy vấn đọc không ngăn được bản sao đã bị ghi công khai này.

Hướng dài hạn: bỏ việc dùng API ghi DB để xuất file alias; giữ một dòng DB chuẩn theo ID/chủ sở hữu, áp dụng quyền của dòng chuẩn cho mọi alias. Bản sửa được duyệt hiện tại giữ cơ chế alias nhưng đồng bộ quyền/chủ như phần trên. Không suy ra quyền sửa dữ liệu vận hành từ phê duyệt sửa mã.

### P1 — DB từ chối ghi nhưng hàm lưu vẫn báo thành công

`api/services/ChordSetService.php:185` nuốt exception DB rồi trả kết quả ghi JSON ở dòng 192. Trigger fixture cố ý từ chối INSERT: `saveSet()` trả `true`, DB có 0 dòng, JSON chứa dữ liệu mới. API gọi hàm có thể thông báo đã lưu trong khi lần tải sau ưu tiên DB và không phản ánh bản vừa lưu.

Đề xuất: DB là nguồn chuẩn; lỗi DB phải trả thất bại hoặc ném lỗi, không báo thành công chỉ vì ghi file được. Tách rõ lỗi xuất bản sao JSON khỏi kết quả commit DB. Cần test lỗi INSERT/UPDATE và lỗi ghi file.

### P1 — Rollback DB không rollback JSON hợp âm HD

`writeHd()` gọi `saveSet()` trước khi transaction ngoài commit (`api/services/ChordSetService.php:238`). Probe: mở transaction, ghi HD mới, rollback; DB giữ HD cũ, history trở về 0 dòng nhưng JSON vẫn chứa HD mới. `ReviewActionHelper::approve()` có giao dịch ngoài và còn ghi trạng thái/event sau lời gọi này, nên có đường thực tế phát sinh lỗi sau khi file đã đổi. Probe chứng minh lỗi ở service; chưa gây lỗi qua toàn bộ HTTP approve.

Đề xuất: chỉ xuất JSON từ dữ liệu đã commit, có cơ chế xuất lại khi lỗi; không coi transaction SQLite bao phủ filesystem. Giữ luồng lịch sử HD và các Core Rule.

### P2 — Một lần fork tạo hai dòng DB

`forkSet()` INSERT dòng tên thật rồi gọi `saveSet()` với tên alias (`api/services/ChordSetService.php:315`). Probe một lần fork tạo cả `AuditFork` và `banhat__AuditFork`. Hai dòng có vòng đời độc lập, dễ lệch dữ liệu/quyền và gây tên trùng trong danh sách. Cùng gốc kiến trúc với lỗi riêng tư trên; nên xử lý trong OPT-12, không chỉ ẩn alias khỏi UI.

## Các điểm còn mở được xác nhận lại

- Đối soát thật, chỉ đọc: **60 file, 57 khớp, 2 thiếu dòng DB, 1 khác nội dung**. Hai file thiếu: `song-f3-test/HD.json`, `thanh-ca-001/banhat__Acoustic_Guitar.json`; file lệch: `thanh-ca-001/HD.json`. Chưa có quyết định Q6 về nguồn đúng; không tự nhập/ghi đè/xoá.
- `csrf_enforce` mặc định false và cấu hình local không có override. Chưa bật; cần quy trình staging/E2E ghi theo Q5. Không kết luận mọi endpoint đều khai thác CSRF được vì router còn kiểm tra Origin.
- CI chỉ gọi `php tests/run_all_tests.php`, chưa dùng `--strict --js`, chưa cài/chạy Node và Playwright. Kết quả chạy local không thay thế cổng CI (OPT-18).
- Runner mặc định nhãn `[PASS]` của suite ngoài danh sách static thành behavioral; tỷ lệ test hành vi chưa đủ tin cậy (OPT-19).
- Các phần TV2/TV3/TV5/TV6/TV7 và OPT P2/P3 vẫn theo trạng thái chưa nghiệm thu trong roadmap/báo cáo trước. Lượt này không đo lại tải 4G, offline hay thiết bị thật.

## Bằng chứng và giới hạn

- Probe mới: `php docs/opt-evidence/current-write-audit.php`; DB memory, JSON chỉ trong thư mục tạm ngẫu nhiên và tự dọn. Kết quả thô: `docs/opt-evidence/current-system-audit.txt`. Các ca lỗi là bằng chứng tái hiện, không tính thành test PASS của chức năng.
- Chạy lại trong lượt này: cache snapshot **7/7**, schema metadata **10/10**, log rotation **14/14**; tổng **31 checks PASS**. Probe alias xoá HD vẫn bị chặn, còn 1 dòng HD. `git diff --check` không có lỗi whitespace.
- Lượt tổng gần nhất trước đợt rà soát này: **184/184 suite PASS, 3.740 checks, 0 SKIP**, lint PHP + JS/ESLint PASS. Không chạy lại toàn bộ suite trong lượt này. Ba lỗi ghi và lỗ hổng Manager cho thấy suite đó còn thiếu các kịch bản trên.
- DB SHA256 vẫn `a91268b27df548845c67b8f375c2d13b5899ffa4716ba99a00d59e4bc157cac9`; audit vẫn 8.481 dòng, SHA256 `33b244f60903d760b2fc902a4ca56fbf422d38d31c36d842223eba6f5ede97c3`; mail 462 file; backup 10 file, 0 ứng viên prune.

Ưu tiên tiếp theo: sửa lỗi báo thành công/transaction và bỏ hai nguồn ghi song song trong OPT-12. Đối soát dữ liệu vận hành, gồm alias lịch sử đã sai quyền, là bước riêng cần phạm vi rõ ràng, backup và xác nhận. Không đổi bảng quyết định/chữ ký, không push/deploy/sync.
