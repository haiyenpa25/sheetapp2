# Báo Cáo Rà Soát Lỗi Toàn Hệ Thống SheetApp (`Error.md`)

> **Ngày rà soát:** 31/10/2026  
> **Phạm vi kiểm tra:** Toàn bộ Backend (`api/`), Frontend mới (`index.php`, `assets/js/`), Giao diện cũ (`old/`), Trung tâm Quản lý (`manager/`), Các phân hệ phụ (`live-band/`, `learn/`, `editor/`), Cơ sở dữ liệu SQLite (`storage/data/app.sqlite`), Hệ thống đồng bộ Kho Thánh Ca ↔ GitHub (`LibrarySyncService`, `tools/`), và Nhật ký lỗi thực tế (`storage/logs/client_errors.log`).

---

## Bảng Tổng Hợp Nhanh (15 Lỗi Phát Hiện)

| Mã lỗi | Mức độ | Phân hệ | Tóm tắt lỗi | File chính bị ảnh hưởng |
| :--- | :---: | :--- | :--- | :--- |
| **ERR-01** | 🔴 Cao | Auth / Session | Race condition khi trình duyệt gửi nhiều request song song làm tự hủy cookie "Ghi nhớ đăng nhập" (`sheet_remember`) | `api/core/RememberLogin.php` |
| **ERR-02** | 🔴 Cao | Auth / Security | Đổi mật khẩu hoặc khóa tài khoản chưa thu hồi hết token `sheet_remember` ở một số nhánh | `api/services/ManagerUserHelper.php`, `api/controllers/UserController.php` |
| **ERR-03** | 🔴 Cao | Phân quyền (RBAC) | Lệch phân quyền 5 vai trò (`viewer`, `banhat`, `bannhac`, `leader`, `admin`) giữa Backend và giao diện `/manager/`, `/old/`, `/learn/` | `manager/partials/header.php`, `manager/js/manager-*.js`, `old/assets/js/admin-ui.js` |
| **ERR-04** | 🔴 Cao | Đồng bộ GitHub | Chạy trực tiếp `git add / commit / push` trong luồng HTTP request không có khóa `flock` chống xung đột | `api/services/LibrarySyncService.php` |
| **ERR-05** | 🔴 Cao | Hệ thống / Quyền file | Một số file tạo từ CLI/Test mang quyền `root:root` thay vì `sheet5566:sheet5566`, dễ gây lỗi `readonly database` cho Web | `api/core/RememberLogin.php`, `tests/remember_login_regression.php` |
| **ERR-06** | 🟠 Trung bình | Quản lý Danh mục | Sửa danh mục trong `/manager/` làm mất thứ tự hiển thị (`display_order` bị ghi đè về `0`) | `api/services/ManagerRepertoireHelper.php`, `manager/js/manager-categories.js` |
| **ERR-07** | 🟠 Trung bình | Quản lý Danh mục | Đổi tên danh mục làm đổi `slug` nhưng không đổi tên thư mục `storage/Thanh ca/<slug>/` và không cập nhật `songs.xmlPath` | `api/services/CategoryService.php` |
| **ERR-08** | 🟠 Trung bình | Bảo mật / Kho file | Chuyển danh mục giữa `public` ↔ `private`/`admin_only` không di chuyển file XML vật lý giữa `storage/Thanh ca/` và `storage/private/xml/` | `api/services/CategoryService.php`, `api/services/SongService.php` |
| **ERR-09** | 🟠 Trung bình | Quản lý Bài hát | Đổi danh mục của một bài hát công khai không di chuyển file XML sang thư mục `storage/Thanh ca/<slug-mới>/` | `api/services/SongService.php`, `api/services/LibrarySyncService.php` |
| **ERR-10** | 🟠 Trung bình | Đồng bộ Web ↔ Local | `tools/update_library.php` chỉ thêm mới (`INSERT`), không cập nhật tên bài đã sửa, đường dẫn XML mới hoặc xóa bài đã bị xóa trên Web | `tools/update_library.php` |
| **ERR-11** | 🟠 Trung bình | Hiển thị Bản nhạc | Lỗi `OpenSheetMusicDisplay: Invalid MXL file` khi mở file nén `.mxl` hoặc khi đường dẫn XML trả về trang lỗi | `assets/js/core/SongLoaderCore.js`, `assets/js/core/ApiService.js` |
| **ERR-12** | 🟠 Trung bình | Giao diện cũ (`/old/`) | Modal Quản trị trong `/old/` bị trống hoàn toàn danh sách Danh mục do đọc sai cấu trúc JSON `res.data` | `old/assets/js/admin-ui.js` |
| **ERR-13** | 🟡 Thấp | Giao diện cũ (`/old/`) | Import bài hát trong `/old/` bỏ quên tên bài hát người dùng nhập và ghép sai đường dẫn OMR `/old/storage/...` | `old/assets/js/importer.js` |
| **ERR-14** | 🟡 Thấp | Nhạc lý / Dịch tông | Lệch tên hợp âm biến âm (ví dụ `A#` vs `Bb`) giữa chữ hợp âm lớp phủ và ký hiệu hợp âm trong khuông nhạc OSMD | `assets/js/osmd-transpose-speller.js`, `assets/js/transpose-engine.js` |
| **ERR-15** | 🟡 Thấp | Cấu trúc Git / Test | 1.455 file `storage/data/chord_sets/*` bị theo dõi trực tiếp trong Git, gây xung đột và làm trượt test SHA-256 mỗi khi sửa hợp âm trên Web | `storage/data/chord_sets/`, `tests/fixtures/library_storage_guard.php` |

---

## Chi Tiết Từng Lỗi & Hướng Khắc Phục

### Nhóm 1 — Bảo Mật, Phiên Đăng Nhập & Phân Quyền (RBAC)

#### [ERR-01] Race condition khi tải nhiều request song song làm mất phiên "Ghi nhớ đăng nhập" (`sheet_remember`)
- **Mức độ:** 🔴 Cao
- **Vị trí:** `api/core/RememberLogin.php` (dòng 39–57) & `api/core/Session.php` (dòng 20–28)
- **Hiện tượng:** Người dùng đã tích "Ghi nhớ đăng nhập", nhưng khi mở lại ứng dụng sau khi phiên `PHPSESSID` hết hạn (đặc biệt trên PWA hoặc khi trang khởi tạo bắn 2–3 request API song song), tài khoản thỉnh thoảng bị tự động đăng xuất mất cookie `sheet_remember`.
- **Nguyên nhân gốc:**
  - Khi trình duyệt gửi 2 request song song chưa có `PHPSESSID` nhưng mang cùng một cookie `sheet_remember = selector:validator_A`:
  - Request 1 chạy `RememberLogin::consume()`, xác thực thành công và **xoay vòng (đổi) `token_hash`** trong bảng `auth_remember_tokens` sang `validator_B` cho cùng `selector`.
  - Request 2 (vẫn mang `validator_A`) chạy ngay sau đó vài mili-giây sẽ rơi vào nhánh `!hash_equals($row['token_hash'], $hash)` ở dòng 47–50: hệ thống tưởng nhầm là cookie bị đánh cắp nên gọi `self::revoke($pdo, $m[1])` và xóa luôn cookie của người dùng!
  - Ngoài ra, ở dòng 49, chú thích ghi *"nghi bị đánh cắp → hủy token"* nhưng chỉ xóa 1 dòng `selector` thay vì thu hồi toàn bộ token của user (`revokeAllForUser`).
- **Hướng khắc phục:**
  - Cho phép khoảng đệm ân hạn ngắn (grace window ~15–30 giây): nếu token vừa mới được xoay vòng (`last_used_at` cách hiện tại < 15 giây), không hủy token khi request song song đến trễ.

---

#### [ERR-02] Chưa thu hồi toàn bộ token `sheet_remember` khi đổi mật khẩu hoặc khóa tài khoản
- **Mức độ:** 🔴 Cao
- **Vị trí:** `api/services/ManagerUserHelper.php` (dòng 210–248) & `api/controllers/UserController.php`
- **Hiện tượng:** Khi Admin đặt lại mật khẩu (`reset_password`) hoặc khóa tài khoản (`toggle_status`) của một thành viên trong `/manager/`, nếu thiết bị của thành viên đó đang có cookie `sheet_remember`, cần đảm bảo mọi token nhớ đăng nhập trong bảng `auth_remember_tokens` bị xóa sạch ngay lập tức.
- **Nguyên nhân gốc:** `RememberLogin::revokeAllForUser($pdo, $userId)` mới được viết trong `RememberLogin.php` nhưng chưa được gắn vào đầy đủ các luồng đổi mật khẩu cá nhân (`UserController`) và quản trị viên (`ManagerUserHelper`).
- **Hướng khắc phục:** Gọi `RememberLogin::revokeAllForUser($pdo, $targetId)` tại các nhánh `reset_password`, `toggle_status` (khi `status = 0`), `delete` trong `ManagerUserHelper.php` và khi người dùng tự đổi mật khẩu.

---

#### [ERR-03] Lệch phân quyền 5 nhóm vai trò (`viewer`, `banhat`, `bannhac`, `leader`, `admin`) trên Frontend & `/manager/`
- **Mức độ:** 🔴 Cao
- **Vị trí:**
  1. `manager/partials/header.php` (dòng 44)
  2. `manager/js/manager-users.js` (dòng 342, 346)
  3. `manager/js/manager-reviews.js` (dòng 44)
  4. `old/assets/js/admin-ui.js` (dòng 243–247)
  5. `assets/js/learn/ui/learn-dashboard-ui.js` (dòng 23) & `assets/js/core/ModeManager.js` (dòng 154)
- **Hiện tượng & Nguyên nhân gốc:**
  - Hệ thống đã nâng cấp lên 5 vai trò (`viewer`, `banhat`, `bannhac`, `leader`, `admin` — xem `api/core/AuthPolicy.php`), và thực tế trong CSDL đã có tài khoản mang vai trò `bannhac`. Tuy nhiên nhiều chỗ ở giao diện vẫn kiểm tra cứng chỉ 2 vai trò cũ (`admin` và `banhat`):
  - **Sai nhãn vai trò trên Header `/manager/` (`manager/partials/header.php:44` & `manager/js/manager-users.js:342`):** Tài khoản `bannhac` (Ban Nhạc) và `leader` (Ca Trưởng) bị hiển thị thành **`👁️ Thành Viên` / `Viewer`**.
  - **Chặn nhầm Ca Trưởng (`leader`) ở tab Phê Duyệt (`manager/js/manager-reviews.js:44`):** Code viết `if (role !== 'admin' && role !== 'banhat') return;`. Trong khi theo `AuthPolicy::canApproveReview`, chỉ **`leader` và `admin`** mới có quyền duyệt bài! Hậu quả là `leader` vào không tải được danh sách duyệt, còn `banhat` thì tự động gọi API và bị lỗi `403 Forbidden`.
  - **Ẩn nhầm tab Thành Viên (`manager/js/manager-users.js:346`):** Cho `banhat` thấy tab Thành viên nhưng lại ẩn với `leader` và `bannhac`.
  - **Sai quyền trong bảng Quản trị cũ (`old/assets/js/admin-ui.js:243–247`):** Thẻ `<select>` chỉ có 3 `<option>` (`admin`, `banhat`, `viewer`). Khi hiển thị tài khoản có role `bannhac` hoặc `leader`, do không khớp option nào nên trình duyệt tự nhảy về option đầu tiên là **`Admin`** — nếu bấm lưu hoặc đổi quyền nhầm sẽ cực kỳ nguy hiểm!
- **Hướng khắc phục:** Đồng bộ toàn bộ các điểm kiểm tra role trên JS/PHP theo đúng ma trận `AuthPolicy.php` (5 vai trò).

---

#### [ERR-04] Đồng bộ GitHub chạy trực tiếp `git add / commit / push` trong tiến trình Web không có khóa `flock`
- **Mức độ:** 🔴 Cao
- **Vị trí:** `api/services/LibrarySyncService.php` (dòng 316–325) & `api/controllers/ManagerController.php` (dòng 288)
- **Hiện tượng:** Khi bấm nút "Đồng bộ Kho & GitHub" trên giao diện Web, PHP gọi trực tiếp `exec("git add ... && git commit ... && git push")`.
- **Nguyên nhân gốc:**
  - Không có cơ chế khóa file (`flock`) chống 2 người bấm cùng lúc hoặc bấm đúp chuột, dễ gây lỗi `.git/index.lock` làm kẹt toàn bộ kho Git trên server.
  - Nếu kết nối mạng từ hosting tới GitHub bị treo, worker PHP-FPM sẽ bị giữ cứng cho tới khi timeout.
- **Hướng khắc phục:** Bổ sung `flock` vào file lock riêng (`storage/logs/library_sync.lock`) trước khi chạy `LibrarySyncService::syncAll()` và thêm `GIT_TERMINAL_PROMPT=0` cùng timeout cho lệnh `git push`.

---

#### [ERR-05] Một số file hệ thống mang quyền `root:root` thay vì `sheet5566:sheet5566`
- **Mức độ:** 🔴 Cao
- **Vị trí:** `./api/core/RememberLogin.php`, `./tests/remember_login_regression.php` (và nguy cơ trên `storage/data/app.sqlite-wal` khi chạy CLI bằng quyền `root`)
- **Hiện tượng:** Khi chạy các lệnh kiểm thử hoặc tạo file bằng tài khoản `root` trên máy chủ, file mới sinh ra thuộc sở hữu `root:root`. Tiến trình Web chạy dưới user `sheet5566` sẽ không thể ghi hoặc xóa các file này (đặc biệt nguy hiểm nếu file đó nằm trong `storage/data/` hoặc `.git/`).
- **Hướng khắc phục:** Chạy `chown -R sheet5566:sheet5566` cho toàn bộ thư mục dự án và đảm bảo các công cụ CLI luôn giữ quyền `sheet5566:sheet5566`.

---

### Nhóm 2 — Quản Lý Danh Mục, Bài Hát & Đồng Bộ Dữ Liệu (Web ↔ Local)

#### [ERR-06] Sửa danh mục trong `/manager/` làm mất thứ tự hiển thị (`display_order` bị ghi đè về `0`)
- **Mức độ:** 🟠 Trung bình
- **Vị trí:** `api/services/ManagerRepertoireHelper.php` (dòng 159, 167) & `manager/js/manager-categories.js` (dòng 354)
- **Hiện tượng:** Các danh mục gốc có thứ tự chuẩn từ `1` đến `7` (`Thánh ca` = 1, `Tôn Vinh` = 2, ...). Nhưng hễ bấm nút **"✏️ Sửa"** ở bất kỳ danh mục nào trong `/manager/` rồi bấm Lưu, danh mục đó lập tức bị nhảy lên vị trí đầu tiên (trên cả `Thánh ca`).
- **Nguyên nhân gốc:**
  - Hàm `saveCategoryForm()` trong `manager-categories.js:354` chỉ gửi `{ id, name, icon, description, visibility }`, không gửi `display_order`.
  - Tại `ManagerRepertoireHelper.php:159`, câu lệnh `$order = (int)($data['display_order'] ?? 0);` gán mặc định thành `0` rồi cập nhật thẳng `UPDATE categories SET ..., display_order = 0 WHERE id = ?`.
- **Hướng khắc phục:** Trong `ManagerRepertoireHelper::manageCategory`, nếu `$data['display_order']` không được truyền lên khi `update`, cần giữ nguyên giá trị `display_order` hiện có trong CSDL.

---

#### [ERR-07] Đổi tên danh mục làm đổi `slug` nhưng không di chuyển thư mục XML & không cập nhật `songs.xmlPath`
- **Mức độ:** 🟠 Trung bình
- **Vị trí:** `api/services/CategoryService.php` (dòng 80, 88)
- **Hiện tượng:** Khi đổi tên một danh mục công khai (ví dụ đổi `"Biệt Thánh"` thành `"Nhạc Biệt Thánh"`), cột `slug` trong bảng `categories` tự động đổi từ `biet-thanh` sang `nhac-biet-thanh`.
- **Nguyên nhân gốc & Hậu quả:**
  - Các bài hát cũ của danh mục này vẫn có `xmlPath = "storage/Thanh ca/biet-thanh/..."`, trong khi các bài hát mới tải lên sau khi đổi tên lại được lưu vào `"storage/Thanh ca/nhac-biet-thanh/..."`.
  - Khi chạy `LibrarySyncService::normalizePublicSongs()`, toàn bộ bài cũ sẽ bị di chuyển sang thư mục mới hoặc nếu đổi tên 1 trong 7 danh mục gốc sẽ làm lệch `slug` chuẩn.
- **Hướng khắc phục:** Khi `update` danh mục đã tồn tại (đặc biệt là 7 danh mục mặc định `id <= 7`), chỉ nên cập nhật `name` hiển thị và **giữ nguyên `slug` ổn định** trừ khi người dùng chủ động yêu cầu đổi slug kèm di chuyển thư mục.

---

#### [ERR-08] Chuyển quyền danh mục giữa Công khai (`public`) ↔ Nội bộ (`private`/`admin_only`) không di chuyển file XML vật lý
- **Mức độ:** 🟠 Trung bình
- **Vị trí:** `api/services/CategoryService.php` (dòng 89–94) & `api/services/SongService.php` (dòng 350–362)
- **Hiện tượng & Nguyên nhân gốc:**
  1. **Chuyển từ `public` → `private` / `admin_only`:** CSDL cập nhật `songs.visibility = 'private', is_public = 0`, nhưng file XML vẫn nằm nguyên tại `storage/Thanh ca/<slug>/<file>.xml`. Do thư mục `storage/Thanh ca/` là thư mục tĩnh công khai và được đưa lên GitHub, người ngoài biết đường dẫn hoặc xem trên GitHub vẫn đọc được file XML của danh mục nội bộ!
  2. **Chuyển từ `private` → `public`:** CSDL cập nhật `songs.visibility = 'public', is_public = 1`, nhưng mã bài hát vẫn mang tiền tố `pv-...` và file XML vẫn nằm trong `storage/private/xml/pv-*.xml` (vốn bị `.gitignore` bỏ qua và bị `LibrarySyncService::exportSeed` lọc bỏ vì `id NOT LIKE 'pv-%'`). Kết quả là bài hát hiển thị công khai trên Web nhưng khi đồng bộ sang GitHub / Local thì biến mất hoàn toàn!
- **Hướng khắc phục:** Khi chuyển đổi `visibility` của danh mục hoặc bài hát giữa `public` và `private`, cần di chuyển vật lý file XML giữa `storage/Thanh ca/<slug>/` và `storage/private/xml/` đồng thời cập nhật lại `xmlPath` (và chuẩn hóa `id` nếu từ `pv-` chuyển sang `public`).

---

#### [ERR-09] Đổi danh mục của một bài hát công khai không di chuyển file XML sang thư mục danh mục mới
- **Mức độ:** 🟠 Trung bình
- **Vị trí:** `api/services/SongService.php` (dòng 349–355), `api/services/ManagerRepertoireHelper.php` (dòng 297–313), `api/services/LibrarySyncService.php` (dòng 66)
- **Hiện tượng:** Khi sửa một bài hát hoặc chuyển danh mục từ `Chúa Giê-xu` sang `Tôn Vinh`, cột `category_id` trong CSDL đã đổi nhưng file XML vẫn nằm ở `storage/Thanh ca/chua-gie-xu/...`.
- **Nguyên nhân gốc:** Hàm `SongService::update()` và `LibrarySyncService::normalizePublicSongs()` mới chỉ di chuyển file nếu file đang nằm ở `storage/users/` hoặc `storage/uploads/`, chưa kiểm tra trường hợp file đang nằm ở `storage/Thanh ca/<slug-cũ>/` khác với `<slug-mới>` của danh mục hiện tại.
- **Hướng khắc phục:** Trong `SongService::update()` và `LibrarySyncService::normalizePublicSongs()`, nếu bài hát thuộc danh mục có `slug = X` nhưng `xmlPath` đang nằm ở `storage/Thanh ca/Y/` (`Y != X`), tự động `rename()` file sang `storage/Thanh ca/X/` và cập nhật `xmlPath`.

---

#### [ERR-10] Công cụ `tools/update_library.php` chỉ thêm mới (`INSERT`), không đồng bộ sửa tên bài hoặc xóa bài từ Web về Local
- **Mức độ:** 🟠 Trung bình
- **Vị trí:** `tools/update_library.php` (dòng 42–65)
- **Hiện tượng:** Sau khi sửa tên bài hát, đổi đường dẫn XML hoặc xóa bài hát trên Web rồi đồng bộ lên GitHub (`storage/seed/library.sqlite`), nếu ở máy Local kéo Git về và chạy `php tools/update_library.php --apply`, máy Local **không nhận được tên bài hát mới** và **không xóa các bài đã bị xóa**.
- **Nguyên nhân gốc:** Vòng lặp đối chiếu trong `tools/update_library.php` khi thấy `$id` đã có trong `localSongs` thì chỉ kiểm tra mỗi `category_id` (`UPDATE songs SET category_id=? WHERE id=?`), bỏ qua hoàn toàn các trường `title`, `number`, `httlvnId`, `xmlPath`, `defaultKey`, `chord_sets` (`HD`), và không xử lý các bài có ở Local nhưng đã bị xóa khỏi `seed`.
- **Hướng khắc phục:** Cập nhật `tools/update_library.php` (hoặc dùng chung `LibrarySyncService::importSeed()`) để đồng bộ đầy đủ cả `title`, `number`, `httlvnId`, `xmlPath`, `defaultKey`, `category_id`, bộ hợp âm `HD` và dọn các bài công khai đã bị xóa khỏi kho chuẩn.

---

### Nhóm 3 — Hiển Thị Bản Nhạc OSMD, Giao Diện Cũ (`/old/`) & Cấu Trúc Kho Git

#### [ERR-11] Lỗi `OpenSheetMusicDisplay: Invalid MXL file` khi mở file nén `.mxl` hoặc khi thiếu file XML
- **Mức độ:** 🟠 Trung bình (Đã ghi nhận thực tế trong `storage/logs/client_errors.log` lúc `2026-10-31 01:22:02`)
- **Vị trí:** `assets/js/core/SongLoaderCore.js` (dòng 126–131) & `assets/js/core/ApiService.js` (dòng 145–148)
- **Hiện tượng:** Khi tải lên hoặc mở một bài hát định dạng `.mxl` (MusicXML nén ZIP), hoặc khi đường dẫn XML trả về nội dung không phải XML, trình duyệt báo lỗi `Error: OpenSheetMusicDisplay: Invalid MXL file` và treo màn hình tải bài.
- **Nguyên nhân gốc:**
  1. `ImportService.php` cho phép người dùng tải lên cả `.xml`, `.musicxml` và `.mxl`.
  2. Tuy nhiên `SongLoaderCore.loadXml()` luôn gọi `ApiService.fetchXml(song.xmlPath)` dùng `res.text()`. Vì `.mxl` là file nhị phân (ZIP), `res.text()` ép giải mã UTF-8 làm hỏng toàn bộ các byte nhị phân (biến thành ký tự `\uFFFD`). Khi truyền chuỗi hỏng này vào `osmd.load(xml)`, OSMD thấy đầu chuỗi có chữ `PK` nên giải nén ZIP và ném lỗi `Invalid MXL file`!
  3. Ngoài ra, nếu `ImportService` giải nén `.mxl` ngay lúc upload thành `.xml` thuần hoặc nếu `fetchXml` kiểm tra định dạng `.mxl` để đọc dạng `ArrayBuffer`/`Blob` (hoặc truyền thẳng URL cho OSMD tự tải `.mxl`), lỗi này sẽ được xử lý triệt để.
- **Hướng khắc phục:**
  - **Cách tốt nhất (Backend + Frontend):** Khi upload file `.mxl` trong `ImportService::processUploadedXml`, tự động giải nén lấy file `.xml` bên trong để lưu thành `.xml` thuần (giúp `extractDefaultKeyFromXmlFile` đọc được cả giọng gốc `<fifths>` vốn hiện tại đang không đọc được nếu file bị nén ZIP!). Đồng thời ở `SongLoaderCore.loadXml`, kiểm tra nếu chuỗi trả về không chứa `<score-partwise` hoặc `<score-timewise` thì hiển thị thông báo rõ ràng thay vì đưa chuỗi lỗi vào `osmd.load()`.

---

#### [ERR-12] Bảng Quản Trị cũ trong `/old/` (`old/assets/js/admin-ui.js`) bị trống hoàn toàn danh sách Danh mục
- **Mức độ:** 🟠 Trung bình
- **Vị trí:** `old/assets/js/admin-ui.js` (dòng 72–73)
- **Hiện tượng:** Khi mở hộp thoại "Bảng Điều Khiển Quản Trị" ngay bên trong giao diện `/old/`, tab **"📂 Thể Loại Nhạc"** luôn trống trơn không có danh mục nào, và ở tab **"🎼 Cơ Sở Bài Hát"**, mọi ô chọn thể loại của tất cả bài hát đều hiển thị `-- Chưa gán --`.
- **Nguyên nhân gốc:**
  - API `GET api/index.php?route=categories` (`CategoryController.php:18`) trả về mảng JSON trực tiếp (`[ { "id": 1, "name": "Thánh ca", ... }, ... ]`).
  - Trong khi ở giao diện mới (`assets/js/admin-ui.js:73`) đã sửa thành `currentCategories = Array.isArray(res) ? res : (res.data || []);`, thì ở giao diện cũ (`old/assets/js/admin-ui.js:73`) vẫn viết `currentCategories = res.data || [];` khiến `currentCategories` luôn là mảng rỗng `[]`!
- **Hướng khắc phục:** Sửa dòng 73 của `old/assets/js/admin-ui.js` thành `currentCategories = Array.isArray(res) ? res : (res.data || []);`.

---

#### [ERR-13] Import bài hát trong `/old/` (`old/assets/js/importer.js`) bỏ quên tên bài hát người dùng nhập & ghép sai URL OMR
- **Mức độ:** 🟡 Thấp
- **Vị trí:** `old/assets/js/importer.js` (dòng 148–158, 204–212, 309–311)
- **Hiện tượng & Nguyên nhân gốc:**
  1. Ở `_importFromThanhca()` và `_importFromDirectUrl()`, người dùng có nhập tên bài hát vào ô `#import-title-input` (biến `title`), nhưng khi gọi `ApiService.importer.search(url)` và `ApiService.importer.fetch(url)` lại quên truyền `{ title }` (khác với bản mới ở `assets/js/importer.js` đã truyền `{ title, category_id }`).
  2. Ở `_publishOmrResult()` (dòng 309), đường dẫn file `.mxl` kết quả OMR được ghép bằng `window.location.pathname.replace(/\/[^/]*$/, '')`, nên khi đứng ở `/old/` hoặc `/old/index.php`, URL bị ghép sai thành `/old/storage/omr_workspace/<jobId>.mxl` gây lỗi 404.
- **Hướng khắc phục:** Đồng bộ logic truyền `{ title, category_id }` và cách tính đường dẫn gốc từ `assets/js/importer.js` sang `old/assets/js/importer.js`.

---

#### [ERR-14] Lệch tên hợp âm biến âm (Enharmonic Spelling) giữa chữ hợp âm lớp phủ và ký hiệu trong khuông nhạc OSMD
- **Mức độ:** 🟡 Thấp
- **Vị trí:** `assets/js/osmd-transpose-speller.js` vs `assets/js/transpose-engine.js`
- **Hiện tượng:** Khi dịch giọng (Transpose) các bài có hợp âm ngoài âm giai (chromatic chords / secondary dominants), đôi khi chữ hợp âm hiển thị phía trên khuông nhạc là `Bb` nhưng ký hiệu hợp âm gắn trong OSMD hiển thị là `A#` (hoặc `F#` vs `Gb`).
- **Nguyên nhân gốc:** Hai file `osmd-transpose-speller.js` và `transpose-engine.js` sử dụng hai bảng quy chiếu bậc biến âm độc lập nhau thay vì gọi chung một hàm chuẩn hóa theo dấu hóa của giọng đích (`targetFifths`).
- **Hướng khắc phục:** Gom quy tắc đọc tên hợp âm biến âm theo `targetFifths` về một hàm dùng chung trong `transpose-engine.js`.

---

#### [ERR-15] 1.455 file `storage/data/chord_sets/*` bị theo dõi trực tiếp trong Git làm trượt test hồi quy khi sửa hợp âm trên Web
- **Mức độ:** 🟡 Thấp
- **Vị trí:** `storage/data/chord_sets/`, `storage/seed/library.manifest.json`, `tests/fixtures/library_storage_guard.php`
- **Hiện tượng:** Mỗi khi Admin hoặc Ban nhạc sửa hợp âm chuẩn `HD` trên giao diện Web (ví dụ vừa qua có 3 bài `thanh-ca-038`, `thanh-ca-719`, `thanh-ca-738`), hệ thống ghi đè file `storage/data/chord_sets/<id>/HD.json`. Nếu chưa chạy lệnh xuất lại `library.manifest.json`, toàn bộ 7 bộ test kiểm tra kho (`tests/library_bundle_regression.php`, `tests/library_l52..l59`) sẽ báo `FAIL` do lệch mã băm SHA-256, đồng thời gây xung đột (`git pull` bị chặn) khi đồng bộ.
- **Nguyên nhân gốc:** Dữ liệu hợp âm `HD` vừa được lưu trong CSDL (`chord_sets` + `storage/seed/library.sqlite`) lại vừa lưu thành 1.455 file JSON rời bị track trong Git và khóa cứng SHA-256 trong `library.manifest.json`.
- **Hướng khắc phục:** Khi `LibrarySyncService::exportSeed()` chạy (hoặc khi lưu hợp âm `HD` của bài công khai), tự động cập nhật lại hash tương ứng trong `storage/seed/library.manifest.json` để kho chuẩn và bộ test luôn khớp 100%.

---

## Thứ Tự Ưu Tiên Xử Lý Đề Xuất

1. **Ưu tiên 1 (Làm ngay — Nhóm phân quyền & Danh mục / Đồng bộ):**
   - Sửa **ERR-03** (Đồng bộ đủ 5 vai trò `viewer`, `banhat`, `bannhac`, `leader`, `admin` trên `/manager/` và `/old/`).
   - Sửa **ERR-12** (Sửa lỗi mất danh sách Danh mục trong modal Quản trị của `/old/`).
   - Sửa **ERR-06**, **ERR-07**, **ERR-08**, **ERR-09**, **ERR-10** (Giữ nguyên `display_order` và `slug` khi sửa danh mục; tự động chuyển file XML khi đổi danh mục hoặc đổi `public` ↔ `private`; cập nhật `tools/update_library.php` để đồng bộ cả sửa tên và xóa bài).
2. **Ưu tiên 2 (Bảo mật phiên & Xử lý file `.mxl`):**
   - Sửa **ERR-01** & **ERR-02** (Chống mất cookie `sheet_remember` khi có request song song + thu hồi token khi khóa/đổi mật khẩu).
   - Sửa **ERR-11** (Tự động giải nén `.mxl` sang `.xml` khi upload và kiểm tra tính hợp lệ của XML trước khi đưa vào OSMD).
   - Sửa **ERR-04** & **ERR-05** (Thêm `flock` cho đồng bộ GitHub và đảm bảo quyền `sheet5566:sheet5566`).
3. **Ưu tiên 3 (Hoàn thiện chi tiết):**
   - Sửa **ERR-13**, **ERR-14**, **ERR-15**.

