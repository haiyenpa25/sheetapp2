# AI_AGENT.md — Hướng Dẫn Làm Việc Với AI (SheetApp)

> **AI AGENT (Claude / Gemini / ChatGPT): Đây là file bắt buộc đọc đầu tiên.**
> Thực hiện đúng workflow bên dưới. Không bỏ bước. Không đoán mò.

---

## 0 · WORKFLOW BẮT BUỘC (Theo thứ tự - Superpowers & Gitnexus Integrated)

```
BƯỚC 1 → Đọc file này (AI_AGENT.md) & tra cứu GITNEXUS (CODE_MAP.md) — nắm quy tắc & bản đồ codebase
BƯỚC 2 → Đọc CODING_STANDARDS.md & PROJECT_REGISTRY.md          — hiểu tiêu chuẩn code & cấu trúc
BƯỚC 3 → [SUPERPOWERS: PLAN] Phân tích yêu cầu & Impact Analysis — kiểm tra các file ảnh hưởng
BƯỚC 4 → [SUPERPOWERS: DEV] Code đúng tiêu chuẩn standards      — không gõ bừa, không xóa nhầm logic
BƯỚC 5 → [SUPERPOWERS: TEST] Kiểm tra cú pháp PHP & JS console — tự kiểm thử trước khi bàn giao
BƯỚC 6 → [SUPERPOWERS: DEVOPS] Cập nhật PROJECT_REGISTRY.md    — nếu tạo file mới
BƯỚC 7 → [AUTO SYNC] Chạy ./sync.sh                             — tự động update CODE_MAP.md & push GitHub
```

**KHÔNG được code trước khi đọc hết quy trình. KHÔNG được bỏ bước nào.**

---

## 1 · NGUYÊN TẮC CỐT LÕI

### 1.5 Gitnexus Code Map (Second Brain cho Code)
- **BẮT BUỘC:** Đọc [CODE_MAP.md](file:///home/sheet.hyb.io.vn/public_html/CODE_MAP.md) trước khi thực hiện thay đổi cấu trúc hoặc sửa đổi các hàm core.
- Đảm bảo hiểu rõ phụ thuộc giữa Frontend JS Modules (`assets/js/core/`), REST API Controllers (`api/controllers/`), và SQLite Schema.
- Không được xóa hoặc đổi tên hàm/module mà không kiểm tra toàn bộ điểm gọi (Call Graph) trong `CODE_MAP.md`.

### 1.6 Quy trình Superpowers (Professional Team Engineering Workflow)
- **Architect (Lập kế hoạch):** Đánh giá tác động (Impact Analysis) và lập kế hoạch trước khi thay đổi.
- **Developer (Viết code):** Code có cấu trúc, chuẩn IIFE / MVC, không viết code dở dang hoặc "vibe coding".
- **Tester (Tự kiểm thử):** Tự động kiểm tra cú pháp PHP (`php -l`), JS syntax, và log lỗi trước khi bàn giao.
- **DevOps (Auto Sync):** Tự động chạy `./sync.sh` ở bước cuối cùng để cập nhật bản đồ tri thức `CODE_MAP.md` và push code lên GitHub.

### 1.7 Tự động đẩy code lên GitHub (Auto Sync)
- **BẮT BUỘC:** Mỗi khi hoàn thành yêu cầu code, sửa lỗi, hay chỉnh sửa bất kỳ file nào trong dự án, tác vụ cuối cùng phải là chạy lệnh `./sync.sh`.
- Đẩy code lên GitHub tự động thông qua `./sync.sh` mà không cần chờ user ra lệnh thêm.



### 1.1 Đừng đoán mò — Hãy hỏi

```
❌ SAI: "Tôi đoán bạn muốn..."  → rồi code sai
✅ ĐÚNG: "Bạn muốn A hay B? Tôi hiểu yêu cầu là X, đúng không?"
```

Nếu yêu cầu mơ hồ hoặc thiếu thông tin → **hỏi ngay**, không tự suy diễn.

### 1.2 Không tự thêm tính năng không được yêu cầu

```
❌ "Tôi cũng thêm luôn tính năng X vì nghĩ sẽ cần..."
✅ Làm đúng những gì được yêu cầu. Đề xuất tách biệt nếu muốn gợi ý thêm.
```

### 1.3 Không xóa code hiện có mà không hỏi

```
❌ Xóa hàm/module vì "nghĩ không cần nữa"
✅ Comment out + ghi chú lý do, hoặc hỏi user trước
```

### 1.4 Luôn kiểm tra trước khi kết thúc

```bash
# Mở browser → F12 → Console → không có lỗi đỏ
# Gọi API thử: api/index.php?route=songs → phải trả JSON hợp lệ
# PHP: không có warning/error trong PHP error log
# Không kết thúc session nếu còn lỗi chưa xử lý
```

---

## 2 · CORE RULES SHEETAPP — BẮT BUỘC GIỮ NGUYÊN

> Đây là các quy tắc nghiệp vụ đặc thù, KHÔNG thay đổi không có lý do.

### RULE 1: Bộ Hợp Âm HD là Mặc Định
- Mọi bài hát LUÔN có bộ "HD" (dù rỗng) — tạo tự động qua `tools/init_hd_sets.php`
- Khi load bài: ChordCanvas tự động chọn set "HD"
- Nếu HD có hợp âm (>0): render HD, ẩn TLH gốc
- Nếu HD rỗng: fallback hiện TLH gốc (không inject empty map)
- **File:** `chord-canvas.js` (loadSong), `app.js` (hasCustomChords guard)

### RULE 2: Tông Gốc = 0 Luôn Luôn
- Khi load bài mới: `currentTranspose` LUÔN = 0
- KHÔNG restore session trước (settings.lastTranspose đã bị loại bỏ)
- Ngoại lệ duy nhất: Setlist đã có `transposeOverride` riêng cho bài đó
- **File:** `app.js` (loadSong)

### RULE 3: Lock TLH và HD
- Bộ "default" (TLH) và bộ "HD" đều KHÔNG thể xóa
- Nút xóa chỉ hiện khi `set != 'default'` và `set != 'HD'` và là Admin
- Khi xóa set khác đang chọn: fallback về "HD" (không phải default)
- **File:** `chord-canvas.js` (deleteSet, _refreshSetDropdown)

---

## 3 · CÁCH ĐỌC & VIẾT CODE

### 3.1 Trước khi sửa file

1. **Đọc toàn bộ file** trước khi chỉnh bất kỳ dòng nào
2. Kiểm tra file nào import/sử dụng file đó (xem `index.php` script order)
3. Tìm pattern hiện có và tuân theo — không tự ý đổi style

### 3.2 Khi tạo file mới (Frontend JS)

```
✅ Đặt đúng thư mục:
   - Module lõi (ApiService, EventBus, Store) → assets/js/core/
   - Module tính năng  → assets/js/
✅ Dùng IIFE pattern: const MyModule = (() => { ... return {...}; })();
✅ Export ra window:  window.MyModule = MyModule;
✅ Đăng ký <script> trong index.php theo đúng thứ tự load
✅ Cập nhật PROJECT_REGISTRY.md
```

### 3.3 Khi tạo file mới (Backend PHP)

```
✅ Controller → api/controllers/[Name]Controller.php
✅ Service    → api/services/[Name]Service.php
✅ Đăng ký route trong api/index.php
✅ Controller chỉ gọi Service, không chứa query trực tiếp
✅ Luôn dùng Response::ok() / Response::error() để trả JSON
```

### 3.4 Khi sửa file hiện có

```
✅ Chỉ sửa những gì được yêu cầu
✅ Giữ nguyên naming convention đang dùng
✅ Không reformat toàn bộ file (gây noise trong diff)
✅ Nếu thấy bug khác → báo cáo, không tự sửa
```

---

## 4 · GIAO TIẾP VỚI USER

### 4.1 Báo cáo tiến độ

Sau mỗi task lớn, tóm tắt:
- ✅ Đã làm gì
- 🔧 Chi tiết kỹ thuật quan trọng (nếu có)
- ⚠ Vấn đề phát hiện thêm (nếu có)
- 📋 Bước tiếp theo đề xuất

### 4.2 Khi gặp vấn đề

```
Không: "Không làm được vì..."
Có:   "Gặp vấn đề X. Có 2 cách giải quyết:
       A) [mô tả] — ưu điểm Y, nhược điểm Z
       B) [mô tả] — ưu điểm Y, nhược điểm Z
       Tôi đề xuất A vì [lý do]. Bạn xác nhận không?"
```

### 4.3 Breaking changes

Nếu thay đổi ảnh hưởng đến nhiều chỗ → **báo trước**:
```
"⚠ Thay đổi này sẽ ảnh hưởng đến:
- chord-canvas.js (cần update loadSong)
- app.js (cần update guard hasCustomChords)
Tôi sẽ cập nhật cả N file. Xác nhận?"
```

---

## 5 · ANTI-PATTERNS — Những lỗi phổ biến cần tránh

### Code
```javascript
❌ fetch() trực tiếp trong module UI     → dùng ApiService
❌ document.getElementById trong Service → Service không được biết DOM
❌ console.log còn sót                   → cleanup trước khi commit
❌ hardcoded string 'HD', 'default'      → dùng hằng số
❌ Magic numbers (300, 20, 0.5)          → đặt tên constant
```

### Architecture
```
❌ Business logic trong UI module    → đưa vào Service/module riêng
❌ API call ngoài ApiService         → mọi fetch() đi qua ApiService
❌ State lưu trực tiếp trong module  → đưa vào Store hoặc EventBus
❌ PHP query trong Controller        → đưa vào Service
❌ Controller biết DB schema         → Controller chỉ dùng Service
```

### Làm việc với AI
```
❌ Sửa code mà không đọc context
❌ Thêm library/dependency không cần thiết
❌ Xóa code "dọn dẹp" không được yêu cầu
❌ Kết thúc mà không test qua browser
❌ Viết toàn bộ file lại khi chỉ cần sửa 1 phần
```

---

## 6 · KHI NHẬN DỰ ÁN MỚI / ĐẦU PHIÊN

Checklist đầu phiên:
```
☐ Đọc AI_AGENT.md (file này)
☐ Đọc CODING_STANDARDS.md
☐ Đọc PROJECT_REGISTRY.md
☐ Hiểu stack: PHP + SQLite + Vanilla JS + OSMD
☐ Hiểu cấu trúc thư mục (xem Section 2 PROJECT_REGISTRY.md)
☐ Xác nhận yêu cầu với user trước khi làm
☐ Nếu sửa Core Rule → hỏi user xác nhận rõ ràng trước
```

---

*Cập nhật: 2026-05-15 | SheetApp v2.0-dev*
*AI Agent: Sau khi đọc xong, tiếp tục đọc CODING_STANDARDS.md và PROJECT_REGISTRY.md.*
