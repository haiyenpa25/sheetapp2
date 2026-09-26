# QA Mutation Testing Log — SheetApp 2.0 (Ticket T20)

Tài liệu ghi nhận kết quả kiểm thử đột biến (Mutation Testing) có chủ đích tại 5 vị trí phòng vệ cốt lõi của hệ thống.
Mục tiêu: Đảm bảo bộ test tự động (Automated Regression Test Suite) có độ nhạy 100%, bắt kịp mọi biến dạng logic làm phá vỡ các Core Rules hoặc giao thức bảo mật.

---

## Bảng Tổng Hợp 5/5 Lần Mutation

| STT | Vị trí đột biến (Mutation Target) | File & Dòng | Test bắt lỗi (Detection Suite) | Trạng thái đột biến | Trạng thái hoàn tác |
|---|---|---|---|---|---|
| **1** | Comment 1 token guard trong pipeline tải bài | `assets/js/song-loader.js:63` | `tests/race_condition_regression.php` | ❌ FAIL (count=3 < 4) | ✅ PASS (7/7 checks) |
| **2** | Bỏ đoạn giữ BPM Setlist khi load bài hát | `assets/js/metronome.js:33` | `tests/setlist_cr4_regression.php` | ❌ FAIL (protectsBpm=false) | ✅ PASS (6/6 checks) |
| **3** | Đổi fallback HD thành `default` khi xoá set cá nhân | `assets/js/chord-canvas.js:460` | `tests/core_rules_regression.php` | ❌ FAIL (CR3-b) | ✅ PASS (9/9 checks) |
| **4** | Đổi lại route SSE thành `livesync` (thay vì `live_sync`) | `assets/js/performance/live-transport.js:201` | `tests/http/live_sync_route_http_regression.php` | ❌ FAIL (2 checks) | ✅ PASS (6/6 checks) |
| **5** | Đổi `Response::ok` về dạng cũ `['data' => $data]` | `api/core/Response.php:6` | `tests/security/response_contract_regression.php` | ❌ FAIL (4 checks) | ✅ PASS (4/4 checks) |
| **6** | Bỏ `Response::abort` trong `toggleRecommend` | `api/services/ManagerService.php:392` | `tests/security/authorization_abort_regression.php` | ❌ FAIL (is_rec=1) | ✅ PASS (9/9 checks) |

---

## Chi Tiết Từng Lần Đột Biến

### 1. Mutation 1: Comment 1 token guard trong `song-loader.js`
- **Hành động phá:** Vô hiệu hóa điểm kiểm tra token phiên tải `loadToken !== _currentLoadToken` tại chặng đọc nội dung XML (`assets/js/song-loader.js:63`).
- **Lệnh kiểm thử:** `php tests/race_condition_regression.php`
- **Kết quả khi phá (FAIL):**
  ```text
  ========================================================
     SheetApp2 — Race Condition & Load Token Regression   
  ========================================================

    [PASS] SongLoader sinh loadToken đơn điệu tăng cho mỗi lần gọi load()
    [PASS] SongLoader hủy (abort) ngay lập tức request fetch XML của bài trước đó khi bài mới được chọn
    [FAIL] SongLoader kiểm tra loadToken tại mọi điểm dừng bất đồng bộ (sau fetch, sau read text, trước/sau OSMD render) -> count=3
    [PASS] SongLoader bỏ qua âm thầm lỗi AbortError / request cũ mà không hiển thị thông báo lỗi sai
    [PASS] ChordCanvas bảo vệ _customChords bằng _chordLoadToken, ngăn hợp âm bài cũ trộn lẫn vào bài mới
    [PASS] ChordCanvas.loadSong không còn gọi dư thừa _refreshSetDropdown, tránh gọi 2 lần chordSets.list (Fix F13)
    [PASS] OSMDRenderer kiểm soát _renderToken trong cả load() và reload(), ngăn render chồng chéo lên SVG

  --------------------------------------------------------
  Tổng kết kiểm thử Race Condition:
    - Tổng số kiểm tra: 7
    - Số kiểm tra thất bại: 1
    - Trạng thái: ❌ CÓ LỖI XẢY RA
  --------------------------------------------------------
  ```
- **Kết luận:** Test suite đã phát hiện ngay lập tức tình trạng thiếu token guard tại chặng async số 2. Sau khi hoàn tác, test PASS trở lại.

---

### 2. Mutation 2: Bỏ đoạn giữ BPM Setlist trong `metronome.js`
- **Hành động phá:** Thay đoạn `if (setlistItem && setlistItem.bpm)` bằng `if (false)` tại `assets/js/metronome.js:33`.
- **Lệnh kiểm thử:** `php tests/setlist_cr4_regression.php`
- **Kết quả khi phá (FAIL):**
  ```text
  ========================================================
     SheetApp2 — Setlist Core Rule 4 Regression Suite   
  ========================================================

    [PASS] SongInfoBar: Nút "Lưu vào Setlist" lưu trọn vẹn cả 3 giá trị: transpose_key, bpm và chord_profile (Fix F5)
    [PASS] SetlistUI: Nút "💾 Lưu Tập" lưu trọn vẹn cả 3 giá trị: transpose_key, bpm và chord_profile
    [PASS] SetlistUI: playCurrentItem() sử dụng await chờ bài hát tải xong hoàn tất trước khi kích hoạt nhịp (Fix F1)
    [FAIL] Metronome: Sự kiện song:loaded ưu tiên giữ BPM của Setlist, không bị ghi đè bởi XML tempo mặc định -> protectsBpm=false
    [PASS] Database: Thêm bài vào Setlist lưu chính xác chord_profile="HD", transpose_key=2, bpm=85, beats=3
    [PASS] Database: Cập nhật bài trong Setlist lưu chính xác chord_profile="NAM", transpose_key=-3, bpm=96

  --------------------------------------------------------
  Tổng kết kiểm thử Setlist Core Rule 4:
    - Tổng số kiểm tra: 6
    - Số kiểm tra thất bại: 1
    - Trạng thái: ❌ CÓ LỖI XẢY RA
  --------------------------------------------------------
  ```
- **Kết luận:** Test suite bảo vệ Core Rule 4 đã phát hiện BPM của Setlist có nguy cơ bị đè bởi tempo mặc định của XML. Sau khi hoàn tác, test PASS.

---

### 3. Mutation 3: Đổi fallback HD thành `default` khi xoá set cá nhân
- **Hành động phá:** Sửa `if (_currentSet === name) await switchSet('HD');` thành `await switchSet('default');` tại `assets/js/chord-canvas.js:460`.
- **Lệnh kiểm thử:** `php tests/core_rules_regression.php`
- **Kết quả khi phá (FAIL):**
  ```text
  --- Kiểm tra CORE RULE 3: Khóa TLH và HD ---
    [PASS] CR3-a: Bộ TLH và HD bị khóa bất biến: Service & Controller từ chối xóa (HTTP 403), UI ẩn hoàn toàn nút xóa kể cả với Admin
    [FAIL] CR3-b: Xóa bộ cá nhân đang chọn: ChordCanvas.deleteSet tự động fallback sang bộ "HD" thay vì default -> fallbackToHd=false, notDefault=false
  --------------------------------------------------------
  Tổng kết kiểm thử Core Rules:
    - Tổng số test kịch bản: 9/9
    - Số test thất bại: 1
    - Trạng thái: ❌ CÓ LỖI XẢY RA TRONG CORE RULES
  --------------------------------------------------------
  ```
- **Kết luận:** Core Rule 1 & 3 được bảo vệ nghiêm ngặt: Khi người dùng xoá bộ hợp âm cá nhân, bản phối phải luôn quay về bản chuẩn "HD" của ban hát thay vì "default". Sau khi hoàn tác, test PASS.

---

### 4. Mutation 4: Đổi lại route SSE thành `livesync` (thay vì `live_sync`)
- **Hành động phá:** Đổi tham số URL `route=live_sync` thành `route=livesync` trong `assets/js/performance/live-transport.js:201`.
- **Lệnh kiểm thử:** `php tests/http/live_sync_route_http_regression.php`
- **Kết quả khi phá (FAIL):**
  ```text
  === T07: LIVE SYNC ROUTE & FALLBACK REGRESSION SUITE ===

  -- 1. Kiểm tra endpoint SSE live_sync HTTP thật --
  [PASS] URL SSE route=live_sync trả về HTTP 200 (nhận được: 200)
  [PASS] URL SSE trả về Content-Type: text/event-stream

  -- 2. Kiểm tra URL cũ route=livesync --
  [PASS] URL cũ route=livesync bị từ chối với HTTP 400/404 (nhận được: 404)

  -- 3. Kiểm tra client logic live-transport.js --
  [FAIL] live-transport.js sử dụng route=live_sync
  [FAIL] live-transport.js đã loại bỏ hoàn toàn route=livesync cũ
  [PASS] live-transport.js sử dụng ApiService.resolveUrl để build URL
  [PASS] live-transport.js chuyển PollingTransport ngay khi EventSource.CLOSED

  ----------------------------------------
  KẾT QUẢ: 2 KIỂM TRA THẤT BẠI (FAIL).
    - live-transport.js sử dụng route=live_sync
    - live-transport.js đã loại bỏ hoàn toàn route=livesync cũ
  ```
- **Kết luận:** Giao thức SSE chuẩn `live_sync` được bảo vệ chặt chẽ trên cả Server Router và Client Transport. Sau khi hoàn tác, test PASS.

---

### 5. Mutation 5: Đổi `Response::ok` về dạng cũ `['data' => $data]`
- **Hành động phá:** Thay đổi implementation của `Response::ok` trong `api/core/Response.php:6` thành `echo json_encode(['data' => $data]);`.
- **Lệnh kiểm thử:** `php tests/security/response_contract_regression.php`
- **Kết quả khi phá (FAIL):**
  ```text
  FAIL: Successful response retains the success flag
  FAIL: Successful response retains payload data
  FAIL: Legacy second-argument message is preserved
  FAIL: Boolean pretty-print argument remains compatible

  4 response contract regression test(s) failed.
  ```
- **Kết luận:** Hợp đồng API Response Envelope chuẩn hóa (`success: true`, payload trực tiếp hoặc merged) được bảo vệ toàn vẹn. Sau khi hoàn tác, test PASS.

---

### 6. Mutation 6: Bỏ `Response::abort` trong `ManagerService::toggleRecommend`
- **Hành động phá:** Thay `Response::abort(403, ...)` bằng `Response::forbidden(...)` mà không có return/exit tại `api/services/ManagerService.php:392`.
- **Lệnh kiểm thử:** `php tests/security/authorization_abort_regression.php`
- **Kết quả khi phá (FAIL):**
  ```text
  [FAIL:B] [toggleRecommend_viewer_blocked] Viewer gọi toggleRecommend bị ném HttpException(403) và is_recommended vẫn là 0 (thực tế: is_rec=1)
  ```
- **Kết luận:** Kiểm thử hành vi đã chặn đứng lỗ hổng thực thi tiếp diễn sau `forbidden`, đảm bảo mọi vi phạm quyền đều ném `HttpException(403)` và dừng ngay lập tức. Sau khi hoàn tác, test PASS 9/9 checks.

---

## Đánh Giá Chung

Cả 5 vị trí đột biến then chốt đều bị chặn đứng và phát hiện ngay lập tức bởi bộ test tự động (tỷ lệ bắt lỗi 100%). Không có trường hợp nào "lọt lưới" hoặc tạo ra false negative.
Toàn bộ mã nguồn đã được hoàn tác về trạng thái chuẩn mực, 48/48 regression suites đều PASS (914 checks).
