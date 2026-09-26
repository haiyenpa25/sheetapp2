# AI_AGENT.md — Hướng Dẫn Làm Việc Với AI

> **AI AGENT (Claude / Gemini / ChatGPT): Đây là file bắt buộc đọc đầu tiên.**  
> Thực hiện đúng workflow bên dưới. Không bỏ bước. Không đoán mò.

---

## 0 · WORKFLOW BẮT BUỘC (Theo thứ tự)

```
BƯỚC 1 → Đọc file này (AI_AGENT.md) — nắm quy tắc làm việc
BƯỚC 2 → Đọc CODING_STANDARDS.md   — hiểu tiêu chuẩn code
BƯỚC 3 → Đọc PROJECT_REGISTRY.md   — biết cấu trúc hiện tại của dự án
BƯỚC 4 → Phân tích yêu cầu, hỏi nếu chưa rõ
BƯỚC 5 → Code theo đúng standards
BƯỚC 6 → Build check trước khi kết thúc
BƯỚC 7 → Cập nhật PROJECT_REGISTRY.md nếu tạo file mới
```

**KHÔNG được code trước khi đọc hết 3 file. KHÔNG được bỏ bước nào.**

---

## 1 · NGUYÊN TẮC CỐT LÕI

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
❌ Xóa hàm/component vì "nghĩ không cần nữa"
✅ Comment out + note lý do, hoặc hỏi user trước
```

### 1.4 Luôn build check trước khi kết thúc

```bash
# Frontend (React/Vite)
npm run build

# TypeScript check
npx tsc --noEmit

# Không kết thúc session nếu có lỗi build
```

---

## 2 · CÁCH ĐỌC & VIẾT CODE

### 2.1 Trước khi sửa file

1. **Đọc toàn bộ file** trước khi chỉnh bất kỳ dòng nào
2. Kiểm tra file nào import/sử dụng file đó
3. Tìm pattern hiện có và tuân theo — không tự ý đổi style

### 2.2 Khi tạo file mới

```
✅ Đặt đúng thư mục theo cấu trúc trong PROJECT_REGISTRY.md
✅ Dùng naming convention đã có trong dự án
✅ Cập nhật PROJECT_REGISTRY.md sau khi tạo
✅ Import trong file cần dùng
```

### 2.3 Khi sửa file hiện có

```
✅ Chỉ sửa những gì được yêu cầu
✅ Giữ nguyên naming convention đang dùng
✅ Không reformat toàn bộ file (gây noise trong diff)
✅ Nếu thấy bug khác → báo cáo, không tự sửa
```

### 2.4 Xử lý lỗi TypeScript / Build errors

```
Quy trình:
1. Đọc error message kỹ
2. Fix từng lỗi một (không fix tất cả cùng lúc khi chưa rõ nguyên nhân)
3. Unused imports → xóa
4. Type mismatch → kiểm tra types/, không dùng `any` để tắt lỗi
5. Sau mỗi fix → build lại để verify
```

---

## 3 · GIAO TIẾP VỚI USER

### 3.1 Báo cáo tiến độ

Sau mỗi task lớn, tóm tắt:
- ✅ Đã làm gì
- 🔧 Chi tiết kỹ thuật quan trọng (nếu có)
- ⚠ Vấn đề phát hiện thêm (nếu có)
- 📋 Bước tiếp theo đề xuất

### 3.2 Khi gặp vấn đề

```
Không: "Không làm được vì..."
Có:   "Gặp vấn đề X. Có 2 cách giải quyết:
       A) [mô tả] — ưu điểm Y, nhược điểm Z
       B) [mô tả] — ưu điểm Y, nhược điểm Z
       Tôi đề xuất A vì [lý do]. Bạn xác nhận không?"
```

### 3.3 Breaking changes

Nếu thay đổi ảnh hưởng đến nhiều chỗ → **báo trước**:
```
"⚠ Thay đổi này sẽ ảnh hưởng đến:
- ComponentA.tsx (cần update props)
- hookB.ts (cần update return type)
Tôi sẽ cập nhật cả 3 file. Xác nhận?"
```

---

## 4 · QUY TẮC DEPLOY

### 4.1 Quy trình chuẩn

```bash
# 1. Build
cd frontend && npm run build

# 2. Verify build output
ls dist/  # phải có index.html hoặc output files

# 3. Copy/deploy
[lệnh deploy cụ thể của dự án — xem PROJECT_REGISTRY.md]

# 4. Verify sau deploy
[kiểm tra URL production]
```

### 4.2 Không deploy khi

- Build còn lỗi TypeScript
- Test (nếu có) bị fail
- Chưa được user xác nhận

---

## 5 · ANTI-PATTERNS — Những lỗi phổ biến cần tránh

### Code
```typescript
❌ any everywhere          → mất hết lợi ích TypeScript
❌ console.log còn sót    → cleanup trước khi commit
❌ hardcoded strings       → dùng constants
❌ nested ternary sâu 3+  → extract thành variable/function
❌ useEffect với missing deps → gây bug khó tìm
❌ Copy-paste logic 2+ lần → tạo function dùng chung
```

### Architecture
```
❌ Business logic trong component → đưa vào hook
❌ API call trong component       → đưa vào hook/api module
❌ State management trong UI      → đưa vào store/hook
❌ Magic numbers (35000, 10, 60)  → đặt tên constant
```

### Làm việc với AI
```
❌ Sửa code mà không đọc context
❌ Thêm dependencies không cần thiết
❌ Xóa code "dọn dẹp" không được yêu cầu
❌ Kết thúc mà không chạy build check
❌ Viết toàn bộ file lại khi chỉ cần sửa 1 phần
```

---

## 6 · KHI NHẬN DỰ ÁN MỚI

Checklist đầu phiên:
```
☐ Đọc AI_AGENT.md (file này)
☐ Đọc CODING_STANDARDS.md
☐ Đọc PROJECT_REGISTRY.md
☐ Hiểu stack: ngôn ngữ, framework, build tool, deploy
☐ Hiểu cấu trúc thư mục
☐ Chạy thử dự án nếu có thể (npm run dev)
☐ Xác nhận yêu cầu với user trước khi làm
```

---

*File này dùng chung cho mọi dự án. Đặt ở root của dự án.*  
*AI Agent: Sau khi đọc xong, tiếp tục đọc CODING_STANDARDS.md và PROJECT_REGISTRY.md.*
