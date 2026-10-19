# ROADMAP6 — Phạm vi đưa lên GitHub

Ngày 2026-10-19. Chủ dự án yêu cầu tiếp tục triển khai và đưa mã lên GitHub.

Nhánh xuất bản: `feature/roadmap6-library-20261019`, từ baseline `623b745` của main.
Local làm việc tại worktree `sheetapp2-roadmap6-work`, nhánh `feature/roadmap5`.
Origin/feature/roadmap5 đã phân kỳ nên giữ nguyên, không force-push. Không merge main,
deploy, chạy sync hoặc migration DB nguồn.

## Phần mã trong đợt

- TV1-1…7 ở cả Hiện đại và Classic: phân trang/tổng thật, tìm lời/highlight, bàn phím
  grid giữ nút từng dòng, điều hướng theo danh sách và nhảy số đúng tập.
- TV4-1…6: khách chỉ đọc chương trình published qua API/lịch sử/bản in, không nhận
  phân công; gói offline yêu cầu đăng nhập. Quyền XML, vùng đọc FTS, request CSRF,
  transaction danh mục/cache/ETag và hợp đồng API songs.
- Kiểm thử hành vi dùng SQLite memory hoặc bản sao Apache có marker riêng.
  Không đưa DB, XML cá nhân, cookie/token thật, node_modules hoặc ảnh chụp vào commit.

`csrf_enforce` mặc định **false** trong FeatureFlags. Khi bật trong cấu hình máy chủ,
request ghi cần token session; kể cả khi cờ tắt vẫn cần Origin/Referer cùng nguồn.
ApiService gửi header tự động. Các công cụ HTTP ngoài trình duyệt cần gửi Origin.
File `storage/config/features.json` từng máy không nằm trong Git.

## Nghiệm thu và việc còn lại

Trước commit/push: **84/84 Chromium ROADMAP6**, **173/173 suite PHP / 3.342 check PASS**;
329 PHP lint, ESLint phần JS sửa và `git diff --check` PASS. Hai cổng chạy tuần tự trên
cùng bản sao. DB nguồn giữ nguyên SHA256; log cuối có trong `roadmap6-evidence/`.

Xem [nhật ký chi tiết](ROADMAP6_LIBRARY_ACCEPTANCE_REPORT.md) để phân biệt triển khai,
kiểm thử đã chạy và phần chưa nghiệm thu. Các log tiêu biểu được lưu ở
`roadmap6-evidence/`; dữ liệu fixture trong log không phải dữ liệu sản xuất.

TV0 đã có ở baseline nhưng còn kiểm chứng thiết bị thật. TV2, TV3, TV5, TV6 và TV7
chưa hoàn tất. Bộ E2E cũ chưa được chứng nhận xanh toàn bộ; WebKit trên Windows chưa
khởi tạo được trang. Không dùng kết quả Chromium ROADMAP6 để thay cho Safari/iOS.
TV5 sửa dữ liệu cần dry-run và duyệt riêng; không tạo HD/tempo giả.

## Nhóm commit

1. Lõi tìm kiếm và API songs, có kiểm backend.
2. Quyền đọc chương trình và XML, có fixture/HTTP.
3. Request CSRF và transaction/cache danh mục, có kiểm HTTP.
4. Thư viện Hiện đại/Classic, module dùng chung và kiểm Chromium.
5. Kiểm thử Chromium và cập nhật guard hồi quy của Thư viện.
6. Tiến độ, bằng chứng và hướng dẫn duyệt.
