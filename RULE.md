# RULE.md — Quy Tắc Bất Biến Chống Lỗi Hồi Quy (SheetApp2)

> **Mục đích:** Tài liệu này quy định các quy tắc kỹ thuật bắt buộc (Invariants) nhằm chặn đứng triệt để các lỗi hồi quy thường gặp khi sửa code trên SheetApp2 (cả giao diện Mới `/` và Cũ `/old/`, trên Web, iPad và Điện thoại Android/iOS). Mọi lập trình viên và AI Agent **BẮT BUỘC** đọc và tuân thủ trước khi sửa bất kỳ file nào.

---

## 1. Quy tắc Dịch Giọng & Nhạc Lý Enharmonic (Tăng / Giảm Tông)

### 1.1. Chống lỗi hiển thị sai tên tông & hợp âm Trưởng (`A#`, `G#`, `D#` thay vì `Bb`, `Ab`, `Eb`)
1. **Tuyệt đối không dùng tên thăng cho 3 hợp âm/tông Trưởng giáng chuẩn:**
   - Ở bậc bán cung **10 (`Bb`)**: Hợp âm Trưởng / 7 / maj7 / sus / add **LUÔN LUÔN là `Bb`** (tuyệt đối không bao giờ trả về `A#`, `A#7`, `A#maj7`).
     - Ví dụ: Từ **`A` tăng `+1`** phải ra **`Bb`**; từ **`B` giảm `-1`** phải ra **`Bb`**.
   - Ở bậc bán cung **8 (`Ab`)**: Hợp âm Trưởng / 7 / maj7 / sus / add **LUÔN LUÔN là `Ab`** (tuyệt đối không bao giờ trả về `G#`, `G#7`, `G#maj7`).
     - Ví dụ: Từ **`A` giảm `-1`** phải ra **`Ab`**; từ **`G` tăng `+1`** phải ra **`Ab`**.
   - Ở bậc bán cung **3 (`Eb`)**: Hợp âm Trưởng / 7 / maj7 / sus / add **LUÔN LUÔN là `Eb`** (tuyệt đối không bao giờ trả về `D#`, `D#7`, `D#maj7`).
     - Ví dụ: Từ **`D` tăng `+1`** phải ra **`Eb`**; từ **`E` giảm `-1`** phải ra **`Eb`**.
2. **Hợp âm Thứ (`m`, `min`) và Giảm (`dim`, `m7b5`) đi theo dấu hóa của Tông Đích (`targetKey`):**
   - Trong các tông thăng (`C`, `G`, `D`, `A`, `E`, `B`, `F#`, `Am`, `Em`, `Bm`, `F#m`, `C#m`, `G#m`): các bậc thứ/giảm giữ dấu thăng chuẩn nhạc lý (`F#m`, `C#m`, `G#m`, `D#m`, `A#m`, `F#dim`, `C#dim`, `G#dim`).
   - Trong các tông giáng (`F`, `Bb`, `Eb`, `Ab`, `Db`, `Gb`, `Dm`, `Gm`, `Cm`, `Fm`, `Bbm`, `Ebm`): dùng dấu giáng tương ứng (`Gm`, `Cm`, `Fm`, `Bbm`, `Ebm`, `Abm`).
3. **Nguồn xác định Tông Gốc (`origKey` / `origFifths`) phải đồng nhất và tôn trọng `<fifths>` của XML:**
   - Khi file MusicXML có thẻ `<fifths>` hợp lệ (kể cả `<fifths>0</fifths>` cho tông Đô trưởng / La thứ), hệ thống **phải tôn trọng `<fifths>` của XML** (kết hợp đếm dấu hóa hợp âm trong XML nếu cần phân biệt C/F).
   - Chỉ khi file MusicXML **thiếu thẻ `<fifths>`** (hoặc chưa nạp XML) và `Store.get('currentSong')?.id` khớp với `App.getCurrentSongId()`, `ChordCanvasTranspose.getKeyFifths()` và `old/assets/js/chord-canvas.js` mới fallback sang `defaultKey` (qua `KeyService.parseKey`).
4. **Một nguồn sự thật duy nhất (`KeyService` & `TransposeEngine`):**
   - Mọi nơi hiển thị tông hoặc dịch hợp âm (Toolbar, `SongInfoBar`, `ChordCanvas`, `LyricExtractor`, `DisplaySettings`, `SetlistDetail`, `Gig HUD`, `/old/`) đều phải đi qua `KeyService.displayKey()` và `TransposeEngine.transposeChord()`.

---

## 2. Quy tắc Dấu `+` Màu Tím (Ghi Hợp Âm) & Phân Quyền `hoaidinh` / `admin`

### 2.1. Quyền của `admin` và `hoaidinh` (Chủ bộ hợp âm `HD`)
1. **Quyền sửa trực tiếp bộ `HD` & cấm ghi đè `HD` từ `TLH`/Clone:**
   - Tài khoản có `role === 'admin'`, hoặc `chord_code === 'HD'` (tài khoản `hoaidinh` trong CSDL có `chord_code = 'HD'`) là chủ sở hữu hợp pháp của bộ hợp âm chuẩn **`HD`**. Tài khoản mạo danh tên `HoaiDinh` nhưng không có `chord_code = 'HD'` phải bị từ chối `403`.
   - Khi các tài khoản có quyền bật chế độ ghi hợp âm (dấu `+` màu tím) trên bộ `HD`, hệ thống **bật ngay lập tức các dấu `+` màu tím để sửa trực tiếp trên `HD`**, không hiện hộp thoại bắt sao chép sang bộ cá nhân khác.
   - Khi đang xem `TLH` (`default`) và bật dấu `+` với đích là `HD`, **tuyệt đối không hiển thị nút ghi đè toàn bộ `HD` bằng `TLH`** và backend chặn mọi thao tác `action = 'clone'` có `target = 'HD'` (`403 Forbidden`). Mọi cập nhật vào `HD` phải đi qua `writeHd` có lưu lịch sử `chord_set_history`.
2. **Quyền Tạo Bộ Hợp Âm Mới (`➕ Tạo Bộ Hợp Âm Mới`):**
   - Khi `admin` (hoặc `leader` / `hoaidinh`) bấm nút **"➕ Tạo Bộ Hợp Âm Mới"** (`#btn-new-chord-set` hoặc chọn mục `➕ Tạo Bộ Hợp Âm Mới...` trong dropdown), hệ thống **phải mở hộp thoại `ChordCanvasUI.showNewSetModal`** để cho phép nhập tên bộ hợp âm mới tùy ý (không được tự ý chặn lại rồi ép chuyển về `HD`).

### 2.2. Chống mất dấu `+` màu tím hoặc mất hợp âm khi Load / Chuyển bài / Đăng nhập
1. **Luôn vẽ lại (`_build`) sau khi nạp xong dữ liệu hợp âm:**
   - Trong `ChordCanvas.loadSong()` và `ChordCanvas.applyPreloaded()`, sau khi nạp xong `_customChords` từ API hoặc bộ nhớ đệm, nếu OSMD đã có `<svg>` trên DOM thì **bắt buộc phải gọi `requestAnimationFrame(_build)`** để vẽ ngay hợp âm và các dấu `+` màu tím (tránh race condition khi OSMD render xong trước API `chordSets.load`).
2. **Giữ nguyên chế độ ghi hợp âm khi người có quyền chuyển bài hoặc tải lại XML:**
   - Không được tự ý tắt `_editEnabled = false` khi `reloadCurrentXML()` hoặc khi vừa đăng nhập thành công (`Auth.doLogin`), trừ khi người dùng đăng xuất hoặc mất quyền sửa hợp âm.

---

## 3. Quy tắc Vị Trí Đặt Hợp Âm, Kích Thước Font Chữ & Màu Sắc

### 3.1. Vị trí đặt hợp âm và dấu `+` màu tím trên bản nhạc
1. **Đồng bộ hệ quy chiếu tọa độ (`#osmd-container` vs `<svg>`):**
   - Mọi tính toán tọa độ Y từ OSMD (`_getStaffTop`) **bắt buộc phải cộng độ lệch `(svgRect.top - containerRect.top)`** để khớp 100% với tọa độ `getBoundingClientRect()` của nốt nhạc (`noteTop`).
2. **Chỉ neo hợp âm và dấu `+` trên Khuông Nhạc Chính (Treble / Staff 0):**
   - Trong bản nhạc 2 khuông (Piano / SATB Treble + Bass), hợp âm và dấu `+` màu tím chỉ gắn với nốt của khuông chính (`primaryStaff` — khuông trên của mỗi hệ thống `system`).
   - Khi gom hệ thống dòng kẻ trong `alignDOMChords()`, **phải lấy vị trí dòng kẻ trên cùng của khuông chính từng hệ (`osmd.graphic.measureList[mi][0]`)**; tuyệt đối không để khoảng trống giữa khuông Treble và khuông Bass làm nhảy hợp âm hoặc dấu `+` xuống khuông Bass.
3. **Chống đè ngang giữa chữ hợp âm (`.cc-custom-chord-text`) và dấu `+` màu tím (`.cc-dot-btn`):**
   - Trong chế độ sửa (`editEnabled = true`), các nhãn hợp âm và dấu `+` màu tím trên cùng một hàng phải giữ khoảng cách tối thiểu, không để dấu `+` của nốt kế tiếp đè lên chữ hợp âm đứng trước, và không để `.cc-tlh-ghost-chord` làm lệch vị trí của dấu `+` tại cùng một phách.

### 3.2. Kích thước font chữ & Màu sắc hợp âm
1. **Màu sắc đồng nhất theo `DisplaySettings.getChordPrefs()`:**
   - Mặc định chuẩn (`standard`): Đỏ `#dc2626` (nổi bật, rõ ràng trên nền giấy trắng và nền tối).
   - Chế độ Sân khấu (`stage`): Cam đậm `#ea580c`.
   - Chế độ Tương phản cao (`high_contrast`): Vàng hổ phách `#fbbf24`.
   - Mọi thành phần hiển thị hợp âm (SVG OSMD, DOM `.cc-custom-chord-text`, và chế độ Lời `.lv-chord`) phải đọc từ `DisplaySettings.getChordPrefs()` để không bị lệch màu.
2. **Kích thước chữ hợp âm (`font-size`) tự co giãn chuẩn theo Zoom & Preset:**
   - Kích thước chữ hợp âm DOM phải tính theo cả mức Zoom (`scale`) lẫn cấu hình cỡ chữ của người dùng (`chordPrefs.size / 2.85`), đảm bảo tối thiểu `>= 12px` trên điện thoại và không bị biến dạng khi phóng to/thu nhỏ.

---

## 4. Quy tắc Tìm Bài Hát Trên Android & iPad (Không Mất Danh Sách)

1. **Reset vị trí cuộn (`scrollTop = 0`) khi đổi từ khóa tìm kiếm / lọc, nhưng giữ nguyên khi bấm "Xem thêm":**
   - Khi người dùng đã cuộn sâu xuống danh sách (VD: bài số 500, `scrollTop = 18000px`) rồi gõ tìm kiếm mới hoặc chọn bộ lọc (`!opts.appendPage`), **bắt buộc phải đặt `container.scrollTop = 0` và `_measuredItemH = 0` trước khi tính cửa sổ Virtual Scroll (`_renderVirtualChunk` / `_renderVirtualSlice`)**. Ngược lại, khi bấm nút **"Xem thêm"** (`opts.appendPage === true`) để tải trang kế tiếp, phải giữ nguyên `scrollTop` hiện tại để danh sách không bị nhảy về đầu trên điện thoại và iPad.
2. **Chống mất danh sách khi bàn phím ảo Android / iPad bật lên:**
   - Khi bàn phím ảo bật lên làm giảm `clientHeight` của `.song-list-container`, chiều cao khung nhìn ảo (`vh`) trong `_renderVirtualChunk` phải có giá trị sàn an toàn (`Math.max(container.clientHeight || 0, 320)`) để luôn render đủ số dòng bài hát hiển thị.
3. **Fallback tức thì sang dữ liệu Local RAM (`songs`) khi gõ tiếng Việt IME hoặc mạng chập chờn:**
   - Nếu API tìm kiếm (`LibrarySearch.run`) trả về lỗi, bị hủy do gõ nhanh trên bộ gõ tiếng Việt Android/iPad, hoặc trả về rỗng khi tìm theo số bài/tên bài mà trong bộ nhớ `songs` (đã tải sẵn) có bài khớp, hệ thống phải tự động lọc trên mảng `songs` tại client để danh sách không bao giờ bị trống vô lý.

---

## 5. Quy tắc Thanh Công Cụ Ngoài Mặt Tiền (Web · iPad · Điện Thoại · `/old/`) & Chương Trình (Chỉ Người Đã Đăng Nhập)

1. **6 Cụm tính năng cốt lõi luôn hiện ngoài giao diện Sheet (Lớp 1 — không giấu vào menu `⋮`):**
   - Trên cả **Web (`≥ 1101px`)**, **iPad (`681px–1100px`)**, **Điện thoại (`≤ 680px`)**, **Gig HUD (Toàn màn hình)** và **Giao diện Cũ (`/old/`)**, người chơi nhạc phải thao tác trực tiếp được ngay ngoài màn hình:
     1. **Tăng / Giảm tông** (`-` `Tông` `+`)
     2. **Zoom (`-` `Chọn %` `+`) đi kèm trực tiếp với biểu tượng Khóa Zoom (`🔒` / `🔓`)**
     3. **Tempo / Đếm nhịp** (`♩ BPM`)
     4. **Chọn Bộ hợp âm** (`🎸 HD / TLH / ...`)
     5. **Chuyển chế độ xem: Bản nhạc ↔ Lời & Hợp âm**
     6. **Qua bài (`◀` `▶`) & Toàn màn hình (`⛶`)**
2. **Chương trình (Setlist) chỉ dành cho người đã đăng nhập (cập nhật 2026-10-29, thay quy tắc "khách xem được" của R9):**
   - Khách (chưa đăng nhập) **không thấy gì** về chương trình: tab Chương trình ẩn (Modern và `/old/`), mọi `GET` của route `setlists` (danh sách, chi tiết, `offline_package`, `manifest`, `song_usage`) trả **401**, kể cả liên kết `?setlist=<id>`.
   - Thành viên ban nhạc (`banhat`, `bannhac`, `leader`, `admin`) luôn thấy toàn bộ chương trình.
   - Tài khoản `viewer` đã đăng nhập chỉ nhận bản rút gọn của chương trình `published` (không lộ nhân sự, ghi chú nội bộ); khi bấm Phát, bài nạp đúng Tông tập, Bộ hợp âm, Tempo, Câu hát và được chỉnh Tông/Hợp âm/Tempo/Zoom cục bộ mà không hiện nút Sửa/Xóa server.

---

## 6. Quy tắc Bộ Hợp Âm HD Mặc Định (cập nhật 2026-10-29)

1. Mọi người (kể cả khách) mở bài đều vào bộ `HD`; không nhớ bộ của lần trước (chỉ liên kết có `?set=` mới đổi bộ).
2. HD rỗng → hiện **bản nhạc sạch** (không rơi về TLH). Chỉ đổi hành vi này qua cờ `AppRules.HD_EMPTY_SHOWS_TLH`, tuyệt đối không thêm fallback ngầm ở nơi khác.
3. Bộ HD của bài được khởi tạo từ hợp âm TLH trong MusicXML bằng `tools/clone_tlh_to_hd.php` (dry-run → sao lưu → ghi qua `ChordSetService::writeHd`, có lịch sử); bài XML không có hợp âm thì HD để rỗng.
4. Bộ `HD` và `default` (TLH) vẫn không xoá được và không ghi đè bằng thao tác sao chép (xem §2).

---

## 7. Quy tắc Danh mục riêng & Bài có bản quyền (cập nhật 2026-10-29)

1. Danh mục có quyền xem `visibility`: `public` | `private` (nội bộ — ban nhạc trở lên đã đăng nhập) | `admin_only`. Bài trong danh mục không công khai **bị ép theo danh mục**; đổi quyền danh mục áp dụng đồng loạt cho mọi bài (có xác nhận).
2. XML của bài không công khai chỉ nằm ở `storage/private/xml/` (Apache chặn trực tiếp, Git bỏ qua); `xmlPath` là URL API `songs&action=xml&id=` có kiểm quyền. **Tuyệt đối không** đặt XML bản quyền vào `storage/Thanh ca/` hay `storage/users/*/imported/` (tải trực tiếp được) và không `git add -f` các đường dẫn đã bị ignore.
3. Bài không công khai có mã bắt đầu `pv-`; `.gitignore` loại `storage/private/`, `storage/data/chord_sets/pv-*/`, `storage/data/annotations/pv-*`. Không đưa bài có bản quyền lên repo công khai.
4. Mọi route làm việc theo mã bài đi qua `SongAccessGuard` (gọi trong `api/index.php`); route mới theo mã bài **phải** thêm vào `SongAccessGuard::ROUTES`. Không đọc bài bằng SQL trực tiếp mà bỏ qua `SongService::getById` / `visibilitySqlClause`; không đổi `songs.category_id` bằng `UPDATE` trực tiếp (dùng `SongService::update` để ép quyền).
5. Mã mới phải chạy đúng khi web **chưa chạy migration** (kiểm bằng `DB::hasColumn`, như `SongService::categoryVisibility`). Chi tiết và quy trình cập nhật web: `docs/PRIVATE_CATALOG.md`.
