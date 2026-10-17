---
name: pwa-offline-stage-performance
description: Specialized skill for SheetApp2's Dual-UI architecture (Modern UI `/` and Classic Flat High-Density UI `/old/`), Service Worker offline caching, Virtual Scrolling, and iPad/Tablet stage ergonomics. Activate when working on sw.js, manifest.json, old/, or library-ui.js.
---

# PWA Offline, Stage Ergonomics & Dual-UI Architecture (SheetApp2)

## 1. Dual-UI Unification (`/` vs `/old/`)
- **Single Source of Truth cho Core & Engine:** Giao diện chính (`/`) và Giao diện Cũ (`/old/`) dùng chung 100% tầng Core & Engine tại `assets/js/` (`core/EventBus.js`, `core/Store.js`, `core/ApiService.js`, `core/ServiceWorkerManager.js`, `url-state.js`, `history-manager.js`, `session-tracker.js`, `transpose-engine.js`, `audio-player.js`, `annotation-canvas.js`).
- **Quy tắc `jsTag()` trong `old/index.php`:** Chỉ giữ các file UI đặc thù của `/old/` trong `old/assets/js/` (`library-ui.js`, `keyboard-handler.js`, `app.js`, `toolbar-controller.js`...); các module Core/Engine tự động fallback về `../assets/js/`.
- **Chuẩn Giao diện Phẳng Mật độ cao (`/old/`):**
  - Không bo tròn (`border-radius: 0 !important`, `--radius-*: 0px`).
  - Danh sách bài hát 1 dòng cao `26px` (`ROW_HEIGHT = 26`), hiển thị `Số bài + Tên bài + Badge Tông phẳng + Ghim 📌 + Sao ★`.
  - Hỗ trợ Virtual Scrolling (`_renderVirtualSlice`) khi danh sách `> 120` bài hát để cuộn 903 bài đạt 60fps.

## 2. PWA & Subdirectory Path Portability
- **Relative Paths:** Không bao giờ dùng đường dẫn tuyệt đối bắt đầu bằng `/` cho tài nguyên tĩnh trong `manifest.json` hoặc HTML (`assets/img/icon-192.png`, `start_url: "./"`), đảm bảo chạy đúng cả trên domain gốc (`https://sheet.hyb.io.vn/`) lẫn thư mục con (`http://localhost/sheetapp2/`).
- **Giới hạn `< 600` dòng/file:** Mọi file `.js` và `.php` trong toàn dự án phải luôn giữ dưới `600` dòng (kiểm tra qua `php tools/metrics.php`).
