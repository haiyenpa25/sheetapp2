# Nhiều Hội Thánh (HT)

Ngày: 2026-11-05. Cờ `MULTI_CHURCH` (mặc định **tắt**). Quy tắc bất biến: `RULE.md` mục 8.

## Mô hình

- Kho bài thánh ca và **bộ hợp âm dùng chung hết**. Mỗi HT có **chương trình lễ riêng**, thành viên riêng, và có thể có **danh mục bài riêng** (chỉ HT đó thấy; quản trị HT tự thêm bài XML vào đó).
- Một người có thể thuộc **nhiều HT** với vai trò khác nhau. Admin hệ thống đứng trên mọi HT.
- Vai trò trong HT: `church_admin` · `leader` · `member` · `viewer` (xem bảng quyền ở `RULE.md` §8.3). Đây là trần quyền cộng thêm vào vai trò hệ thống.
- Người mới vào HT bằng **mã mời** (8 ký tự) → trạng thái "chờ duyệt" → quản trị HT duyệt và chọn vai trò. Quản trị HT đổi mã bất cứ lúc nào (mã cũ hết hiệu lực).

## Dùng

| Việc | Ở đâu |
|---|---|
| Chọn HT đang làm việc | Tab **Chương trình** của app chính (chỉ hiện khi thuộc từ 2 HT; Modern + Classic), hoặc `/manager/` → Nâng cao → **Hội Thánh** |
| Xin vào HT bằng mã mời | `/manager/` → **Hội Thánh** |
| Duyệt / đổi vai trò / khóa thành viên, xem & đổi mã mời, đổi tên HT | `/manager/` → **Hội Thánh** (quản trị HT hoặc admin hệ thống) |
| Tạo HT mới (+ 3 tài khoản `banhat/bannhac/admin.<viết tắt>`, mật khẩu hiện một lần) | `/manager/` → **Hội Thánh** (chỉ admin hệ thống) |
| Xem HT của từng tài khoản, gán/gỡ/đổi vai trò | `/manager/` → **Thành viên** → cột *Hội Thánh* + nút **⛪ HT** (chỉ admin hệ thống) |
| Xóa HT (xóa chương trình + quan hệ thành viên; giữ tài khoản, bài, XML) | `/manager/` → **Hội Thánh** → *Xóa Hội Thánh* (chỉ admin hệ thống, có xác nhận) |
| Danh mục bài riêng của HT + thêm bài (XML) vào đó | `/manager/` → **Hội Thánh** → "Danh mục bài riêng" → ➕ Thêm bài (quản trị HT hoặc admin hệ thống) |

API: route `churches` (xem `PROJECT_REGISTRY.md`), 404 khi cờ tắt.

## Bật trên web (theo thứ tự, không bỏ bước)

1. **Sao lưu** `storage/data/app.sqlite` (ví dụ `cp app.sqlite app.sqlite.bak-pre018`).
2. Triển khai mã (nhánh đã duyệt) rồi chạy `php tools/migrate.php`. Migration 018 chạy lại an toàn: tạo `churches`, `church_members`, cột `church_id`; gom dữ liệu cũ vào HT "Hội Thánh mặc định" (`mac-dinh`); mọi tài khoản thành thành viên (admin→quản trị HT, leader→leader, bannhac/banhat→member, viewer→viewer).
3. Chạy `php tools/verify_multi_church.php` — phải báo **Ổn** (mọi chương trình có HT, mọi HT có quản trị, không tài khoản nào lơ lửng).
4. Đổi tên "Hội Thánh mặc định" cho đúng tên thật (tab Hội Thánh → Đổi tên).
5. Tạo thêm HT bằng tab Hội Thánh (tự sinh 3 tài khoản `banhat/bannhac/admin.<viết tắt>`; **chép mật khẩu ngay**, chỉ hiện một lần; tài khoản bị bắt đổi mật khẩu ở lần đăng nhập đầu nhờ cột `users.must_change_password`, cần chạy migration 019 — migration 018 và 019 đều chạy bằng `php tools/migrate.php`). Người đã có tài khoản thì gán vào HT bằng nút ⛪ HT ở tab Thành viên.
6. Bật cờ: thêm `"MULTI_CHURCH": true` vào `storage/config/features.local.json`.
7. Kiểm: đăng nhập bằng một tài khoản thường của HT A → không thấy chương trình của HT B; đổi HT ở tab Chương trình; mở `/manager/` → tab Hội Thánh.
8. **Hoàn tác**: đặt `"MULTI_CHURCH": false` — mọi thứ về hành vi một HT như cũ (dữ liệu và cột mới nằm yên, vô hại).

## Lưu ý vận hành

- Tài khoản mới tạo **sau** migration chưa thuộc HT nào: khi cờ bật họ không tạo/ghi được chương trình cho đến khi vào HT (mã mời) và được duyệt. `verify_multi_church.php` cảnh báo trường hợp này.
- Gói offline đã tải trước đó (chưa ghi `church_id`) vẫn hiện ở mọi HT; gói tải sau thì chỉ hiện ở HT sở hữu.
- Đổi HT tải lại trang và bỏ tham số liên kết `setlist`/`program` (chương trình cũ có thể thuộc HT khác).
- Phòng Live đã ghi `churchId` khi tạo; khóa phòng theo HT sẽ làm ở giai đoạn Band nhạc.
- Chưa làm: gộp thông báo (notifications) theo HT; báo cáo "Thống Kê Thờ Phượng" đã theo HT (qua `SetlistUsageHelper`) nhưng bảng KPI tổng của `/manager/` vẫn đếm toàn hệ thống.

## Kiểm thử

`tests/multi_church_foundation_regression.php` (schema + chuyển dữ liệu), `multi_church_isolation_regression.php` (cô lập 11 điểm vào), `multi_church_api_regression.php` (API quản lý HT), `multi_church_roles_regression.php` (trần quyền theo vai trò HT), `multi_church_categories_regression.php` (danh mục riêng), `multi_church_accounts_regression.php` (tạo HT kèm tài khoản, xóa HT, quyền tải bài); e2e: `e2e/manager-churches.spec.js`, `e2e/church-switcher.spec.js`, `e2e/manager-user-churches.spec.js`, `e2e/church-private-songs.spec.js` (chạy ở bản sao cô lập đã bật cờ; các spec này để lại HT/bài thử trong bản sao đó, không dọn).

## Giới hạn đã biết

- Cờ bắt đổi mật khẩu chỉ áp ở giao diện đăng nhập (như luật mật khẩu yếu có sẵn); máy chủ chưa chặn API cho tới khi đổi. Admin đặt lại mật khẩu cho người khác không tự bật cờ.
- Quản trị HT chỉ **thêm** được bài vào danh mục riêng; sửa/xóa bài riêng vẫn do admin hệ thống.
- Quyền riêng tư bài tải vào danh mục HT do máy chủ ép (`SongService::clampToCategory`), không phụ thuộc giao diện.
