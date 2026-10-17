---
name: sqlite-fts5-sync-architecture
description: Specialized skill for SheetApp2's PHP 8 + SQLite WAL backend, Vietnamese FTS5 search, Live Stage Sync (SSE), and API security contracts. Activate when modifying api/controllers/, api/services/, api/core/, or database migrations.
---

# SQLite WAL, FTS5 & Live Stage Sync Architecture (SheetApp2)

## 1. SQLite Concurrency & Prepared Statements
- **100% Prepared Statements:** Tuyệt đối cấm nội suy biến trực tiếp vào chuỗi SQL (`$db->query("... $id")`). Luôn dùng `DB::run($sql, $params)` hoặc `$db->prepare($sql)` với tham số `?` / `:named`.
- **WAL & Busy Timeout:** Mọi kết nối SQLite qua `DB::get()` phải bật `PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON;`.
- **Cách ly Test (Ticket K2):** Tuyệt đối không để bộ kiểm thử (`tests/`) ghi rác vào `storage/data/app.sqlite` hoặc `storage/data/live_sync/`. Sử dụng `SHEETAPP_DB_PATH` và `LiveSyncService::setRoomDir()`.

## 2. Live Stage Sync & Server-Sent Events (SSE)
- **Giải phóng Session Lock:** Trước khi vào vòng lặp SSE (`route=live_sync&action=events`), BẮT BUỘC gọi `session_write_close()` để không làm treo các request HTTP song song của cùng trình duyệt.
- **Heartbeat & Timeout:** Giữ chu kỳ loop ngắn (`@set_time_limit(40)`) và trả về gói sự kiện nhẹ để tương thích với Apache/XAMPP và Shared Hosting.

## 3. API Security & Response Contract
- **Same-Origin + CSRF:** Mọi phương thức ghi (`POST`, `PUT`, `PATCH`, `DELETE`) phải đi qua `RequestSecurity::isSameOrigin($_SERVER)` (hỗ trợ cả `HTTP_ORIGIN` và fallback `HTTP_REFERER`) kèm `X-CSRF-Token` từ `ApiService.js`.
- **Chuẩn JSON Response:** Luôn trả về qua `Response::ok($data)` hoặc `Response::error($msg, $code)` và không bao giờ lộ stacktrace vật lý ra client.
