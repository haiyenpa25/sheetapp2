# Phát hành source và dữ liệu thư viện

Ngày: 2026-10-20. Theo yêu cầu trực tiếp của chủ dự án: xuất bản lên `main`, bao gồm CSDL và storage cần để chạy thư viện. Chủ dự án đã chọn **CSDL phát hành sạch dữ liệu cá nhân**, vì repository GitHub đang công khai.

## Nội dung bản phát hành

| Danh mục | Bài |
|---|---:|
| Thánh ca | 903 |
| Tôn Vinh Chúa Hằng Hữu | 387 |
| Biệt Thánh Ca | 206 |
| Ca Khúc Chúc Tôn | 105 |
| Kinh Thánh Đối Đáp | 100 |
| NS Trương Văn Xê | 28 |
| Hillsongs - Worship | 2 |
| Tổng | 1.731 |

- `storage/Thanh ca/`: đủ 1.731 MusicXML, gồm 828 file trước đây chưa được theo dõi trong Git.
- `storage/seed/library.sqlite`: CSDL SQLite chứa lược đồ và 16 migration đã áp dụng, 7 danh mục, 1.731 bài, 1.737 bộ hợp âm công khai, 388 đoạn nhạc, bản phối và phiên bản công khai. Manifest cạnh file chứa SHA256 và số đếm được truy vấn từ DB.
- `storage/data/chord_sets/`, `storage/data/annotations/`: các JSON hợp âm/nhạc cụ/ghi chú hiện có; không đưa file khóa vào Git. Các snapshot JSON cũ vẫn giữ để tương thích bộ test hiện tại; dữ liệu hợp âm chính nằm trong SQLite.
- `storage/users/admin/thanh-ca-001/v1_ban-chuyen-soan-4-be-satb-demo.xml`: file phiên bản được CSDL tham chiếu. Không đưa `.bak` vào bản phát hành.
- `storage/config/features.json` và quy tắc bảo vệ storage.

DB đang chạy `storage/data/app.sqlite`, WAL/SHM, khóa, cache/manifest sinh lại, log, các bản backup, phòng live sync, upload OMR tạm và dữ liệu tenant vẫn bị ignore. Đây là trạng thái vận hành cá nhân hoặc dữ liệu sinh lại, không phải thành phần cần để clone và chạy thư viện. Không công khai bản sao SQLite gốc qua Git.

## Quyền riêng tư

Export dùng kết nối read-only và SQLite backup để chụp dữ liệu nhất quán. Năm tài khoản nguồn được thay bằng contributor ẩn danh, role viewer, trạng thái inactive và hash sentinel `!` không đăng nhập được. Tên đăng nhập/email/profile, mật khẩu cũ, thông báo, lịch sử luyện tập, workspace OMR và hoạt động cá nhân không nằm trong seed. Gỡ các chuỗi đã xóa khỏi trang trống SQLite bằng secure-delete/VACUUM; kiểm tra cả byte thô để phát hiện hash mật khẩu/email còn sót. Giữ ID contributor để bảo toàn khóa ngoại của các bản phối công khai.

Script từ chối xuất nếu có bài hoặc bản phối private cần rà soát riêng. DB gốc không bị đổi; SHA256 sau kiểm thử vẫn `A91268B27DF548845C67B8F375C2D13B5899FFA4716BA99A00D59E4BC157CAC9`.

## Cài mới

```bash
php tools/install_library.php
```

Chạy bằng PHP CLI trong source đã clone, không chạy qua URL. Lệnh tạo `storage/data/app.sqlite` từ seed, tạo admin mới và in mật khẩu ngẫu nhiên một lần; lưu mật khẩu tại nơi riêng. Có thể dùng `--admin=<username>` và `--password-stdin` để nhập mật khẩu qua stdin. Không truyền mật khẩu bằng tham số dòng lệnh.

Cài đặt kiểm tra SHA256, integrity, khóa ngoại; từ chối ghi đè DB đã tồn tại, kể cả khi có hai tiến trình cài cùng lúc. Apache phải hỗ trợ `.htaccess` và rewrite. Trên Nginx phải chặn storage riêng tư tương đương. Cho PHP quyền ghi storage, không cấp quyền `777` toàn cây. Không cần Node/Python để phục vụ ứng dụng PHP; Python chỉ dùng khi xuất bản seed mới.

## Server đang có DB

Sao lưu toàn bộ storage trước khi cập nhật source. Git có thể từ chối pull khi file local chưa được theo dõi trùng file mới trong bản phát hành: giữ bản sao riêng và đối chiếu thay vì ép ghi đè. Sau khi cập nhật source, chạy:

```bash
php tools/update_library.php --apply
```

Lệnh tạo bản SQLite nhất quán cạnh DB, tên `app.sqlite.before-library-<thời gian>-<mã>.sqlite`. Toàn bộ nhập nằm trong transaction; lỗi sẽ rollback. Thêm các danh mục/bài/bộ hợp âm/phiên bản/đoạn/bản phối còn thiếu; map ID danh mục, section và người sở hữu theo DB đích; đồng bộ FTS cho bài mới. Các bài có sẵn được cập nhật phân loại theo danh mục phát hành; tiêu đề và nội dung bài hiện có giữ nguyên. Bộ hợp âm trùng bài/tên set giữ nguyên, không ghi đè bản phối đang dùng. Không đổi mật khẩu, tài khoản hoặc chương trình của server.

Lệnh có thể chạy lại mà không nhân đôi hợp âm hay tài khoản contributor. CSDL cần có lược đồ phiên bản hiện hành; nếu thiếu cột/migration, kiểm tra migration trên bản sao trước. Không thay DB hiện tại bằng seed và không tự chạy migration trên DB thật khi chưa có backup.

## Xuất lại seed

```bash
python tools/export_library_seed.py --output=/path/to/review/library.sqlite
```

Thư mục đích mới nằm ngoài webroot/Git. Script từ chối đè file đã tồn tại và tạo `library.manifest.json` cạnh DB. Rà soát bản xuất, thay cặp seed/manifest sau khi kiểm thử quyền riêng tư và clone sạch. Không force-add `storage/data/app.sqlite`. Các thay đổi nhạc/ghi chú trên một server không tự được push vào Git.

## Kiểm thử và giới hạn

Ca thử sử dụng bản cài riêng có marker `.roadmap6-isolated`; không chạy test ghi lên DB/storage thật. Kiểm tra tất cả đường dẫn MusicXML trong seed, cài admin mới, từ chối ghi đè, cập nhật từ thư viện thiếu các nhóm bổ sung và giữ nguyên dữ liệu server. Kiểm tra trình duyệt truy vấn đủ danh mục, đọc sheet Biệt Thánh Ca cả hai giao diện, ghi/lưu màu và chuyển giao diện. Kiểm tra HTTP chặn tải trực tiếp DB và registry private.

`npm audit` ghi nhận 7 cảnh báo high hiện có trong `puppeteer-core` và cây phụ thuộc của nó (devDependencies); không có critical. Không thêm dependency hoặc tự nâng major trong đợt đóng gói dữ liệu này. Runtime PHP không dùng các gói Node này. Kết quả không xác nhận server production đã triển khai hay kiểm thử Safari/iPad phần cứng.


## Kết quả bản cuối

- PHP: **176/176 suite, 3.473 check (2.768 hành vi, 705 static), 337 file lint**, không skip/fail. Bộ cài/cập nhật riêng: 37 check nằm trong tổng trên.
- Trình duyệt: **20/20** trên Chromium/WebKit headless, gồm danh mục/asset của cả 7 nhóm, sheet Biệt Thánh Ca, CRUD ghi chú, màu và chuyển giao diện. Không có lỗi runtime trong các ca render.
- Python export: **2/2**, kiểm tra byte riêng tư bị xóa, source không đổi, từ chối ghi đè và từ chối phát hành bài private.
- Đọc và parse **1.731/1.731** XML không lỗi; mọi đường dẫn bài có file trong bản xuất từ Git index. JS spec mới qua syntax/ESLint; `git diff --check` PASS. Whitespace trong MusicXML direction text được giữ như nội dung bản nhạc.
- Snapshot release SHA256: `6366e9fdb0752d47c6c626b35c25fc93cbd699326279b38398345b3fce99d745`.
- Sửa các giả định của test phát hiện khi clone sạch: ID admin không cố định, thư mục rỗng không lưu trong Git, `.`/`..` không phải file LiveSync bị rò rỉ. Không thêm file giả để làm đủ số lượng; các guard JSON đối chiếu checksum nội dung và được kiểm tra với file bị thay đổi/bị thiếu.

Bằng chứng thô: [bản cuối](instrument-annotations-evidence/library-bundle-final.txt), [các lỗi tái hiện trước sửa](instrument-annotations-evidence/library-bundle-red.txt). Bản cài HTTP được dựng từ đúng nội dung Git index, cài bằng `install_library.php`, dùng DB/storage riêng. Sau kiểm thử được chuyển khỏi webroot vào `C:/xampp/sheetapp2-backups/source-archive-20261020-110530/sheetapp2-bundle-20261020`; trong htdocs chỉ giữ source chính `sheetapp2`.


### Kiểm tra lại sau khi đồng bộ main

Lần push đầu bị từ chối vì remote có thêm commit `5f8cbb1` sửa hiển thị/cache/Cloudflare. Đã rebase, giữ nguyên phần sửa đó và cả hai mục nhật ký trong registry. Dựng lại hai bản cài độc lập từ Git index: `sheetapp2-bundle-merged-20261020` cho trình duyệt, `sheetapp2-bundle-php-20261020` cho PHP/HTTP.

Bản ghép đạt **176/176 suite, 3.473 check, 337 PHP lint**. Bộ trình duyệt có **74 ca duy nhất**: lượt tổng đạt 72, hai ca PWA dừng vì điều kiện ghim tên fixture cũ; đổi guard sang kiểm tra marker/root thực và URL khớp basename, rồi chạy lại **2/2 PWA đạt** trên Chromium/WebKit. Tổng 74 ca đã có lượt chạy đạt, gồm phần thành phần, HTTP, danh mục, liên thông giao diện và offline. Không thay mã service worker của commit remote. JS syntax toàn source **332 file PASS**.

[Bằng chứng bản ghép](instrument-annotations-evidence/library-bundle-merged-final.txt) giữ nguyên cả lỗi guard và lượt chạy lại. Hai bản cài sau cùng cũng được chuyển ra thư mục backup ngoài webroot; DB thật giữ nguyên checksum. Các kết quả trước mục này là lịch sử của bản trước khi ghép remote.
