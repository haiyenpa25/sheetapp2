# ROADMAP6 — Nhật ký triển khai và nghiệm thu

Ngày bắt đầu: 2026-10-18. Nhánh: `feature/roadmap5` theo AGENTS.md.
Baseline: `3b5fb69`. Một AI thực thi; không push/deploy/chạy sync.

Theo yêu cầu mới của chủ dự án, nâng cấp cả Classic và Hiện đại.
Xem [phân tích điều chỉnh](ROADMAP6_CLASSIC_MODERN_ANALYSIS.md).
Không sửa bảng quyết định/chữ ký; không chạy migration trên DB thật.

## Hạ tầng kiểm tra

`e2e/roadmap6.config.js`: test thành phần trình duyệt, không server,
không global setup/teardown và không đọc/ghi DB/storage thật.
Cấu hình E2E mặc định có teardown ghi đè DB thật nên không dùng cho đợt này.
Log thô: `test-results/roadmap6-evidence/`.

## TV0-1 — Chạm đúng ý (đang nghiệm thu)

- Nguyên nhân còn lại ở baseline: thiếu mốc 500ms, thiếu pointercancel,
  khoảng cách kiểm theo từng trục nên vuốt chéo >10px vẫn lọt;
  Gần đây/Yêu thích/Nhảy nhanh không dùng chung guard.
- Sửa: `LibraryGestures.bind` dùng khoảng cách Euclid, thời hạn 500ms,
  hủy chạm, chặn đa chạm; chỉ click kích hoạt, giữ click bàn phím.
- Hiện đại và Classic dùng chung module; Classic áp dụng cả Ghim nhanh.
- FAIL: `npx playwright test --config=e2e/roadmap6.config.js library-tv0-touch`;
  `TV0-1-FAIL.txt` (Chromium tái hiện mở bài khi vuốt; WebKit lỗi môi trường).
- Classic FAIL riêng: `npx playwright test --config=e2e/roadmap6.config.js --project=chromium -g Classic`;
  `TV0-1-classic-FAIL.txt`: 2 failed, selections nhận song-0 sau vuốt chéo.
- PASS và kiểm hồi quy: đang cập nhật. Chưa nghiệm thu số request XML toàn trang,
  thao tác cuộn trên thiết bị thật hay Safari/iOS.

## Các phần chưa hoàn tất

TV0-2…TV7 chưa được đánh dấu hoàn thành. Những sửa đã có trong baseline phải được
kiểm chứng lại; không suy ra hoàn tất từ tên commit hoặc test tìm chuỗi.
