# VIBERCODE.md — Hướng Dẫn Dùng Understand Anything Với SheetApp

> **Đọc file này trước khi viết tính năng mới.**
> Understand Anything giúp bạn hiểu rõ cấu trúc SheetApp — module nào phụ thuộc vào đâu, event nào chạy qua đâu — trước khi động tay vào code.

---

## 🧠 Understand Anything Là Gì?

**Understand Anything** là AI plugin phân tích codebase và tạo **interactive knowledge graph** — một bản đồ trực quan toàn bộ dự án:
- Mọi file, function, class là một node có thể click và khám phá
- Thấy dependency giữa các module (ai gọi ai, ai emit event nào)
- Tìm nhanh bằng ngôn ngữ tự nhiên: *"đoạn nào xử lý transpose?"*
- Phân tích impact khi sửa code: *"sửa file này ảnh hưởng đến đâu?"*

**GitHub:** https://github.com/Egonex-AI/Understand-Anything
**Live Demo:** https://understand-anything.com/demo/

---

## 🚀 Cài Đặt (Chạy 1 Lần)

### Bước 1 — Clone tool về máy
```bash
git clone https://github.com/Egonex-AI/Understand-Anything C:\tools\understand-anything
```

### Bước 2 — Cài Gemini CLI (nếu chưa có)
```bash
npm install -g @google/gemini-cli
```

### Bước 3 — Copy skill vào SheetApp (tùy chọn, để Gemini CLI tự nhận)
```bash
copy C:\tools\understand-anything\GEMINI.md C:\xampp\htdocs\SheetApp\GEMINI_UA.md
```

---

## ▶️ Dùng Mỗi Khi Viết Tính Năng Mới

### Option A — Qua Gemini CLI
```bash
cd C:\xampp\htdocs\SheetApp
gemini
```
Sau đó gõ trong chat:
```
/understand
```
→ Tự động phân tích SheetApp, sinh `knowledge-graph.json`, mở dashboard trong browser.

### Option B — Câu hỏi nhanh không cần graph
```bash
cd C:\xampp\htdocs\SheetApp
gemini "module nào đang xử lý chord overlay? tôi muốn thêm tính năng X"
```

---

## 💡 Câu Hỏi Hữu Ích Trước Khi Code

Paste những câu này vào Gemini CLI / Claude khi bắt đầu tính năng mới:

```
Tôi muốn thêm tính năng [TÊN TÍNH NĂNG] vào SheetApp.
Hãy xác định:
1. Những module nào liên quan (frontend JS + backend PHP)?
2. Events nào tôi cần emit / lắng nghe qua EventBus?
3. Tôi cần thêm endpoint nào trong api/index.php?
4. Có module nào đang làm gần giống chưa?
```

---

## 🗺️ Quick Map — SheetApp Architecture

> Tóm tắt nhanh để không cần chạy tool mỗi lần

### Frontend Event Flow
```
User Action
  → library-ui.js        emit: song:selected
  → song-loader.js       emit: song:loaded / song:cleared
  → osmd-renderer.js     render OSMD SVG
  → chord-canvas.js      load chord overlay
  → audio-player.js      prepare MIDI
  → auto-scroller.js     setup scroll
  → app-ui.js            update toolbar state
```

### Backend Request Flow
```
Browser fetch()
  → ApiService.js (core)        centralized HTTP client
  → api/index.php               router: ?route=songs|chord_sets|...
  → api/controllers/[X]Controller.php   parse params
  → api/services/[X]Service.php         query SQLite
  → Response::ok() / Response::error()  trả JSON
```

### Module Groups
| Nhóm | Files | Ghi chú |
|------|-------|---------|
| Core | `EventBus.js`, `Store.js`, `ApiService.js` | Load đầu tiên, không sửa bừa |
| Chord | `chord-canvas.js`, `chord-canvas-ui.js`, `chord-canvas-xml.js` | HD set là mặc định |
| Render | `osmd-renderer.js`, `song-loader.js` | OSMD cursor chỉ có sau render |
| UI | `library-ui.js`, `setlist-ui.js`, `app-ui.js` | Chỉ xử lý DOM |
| Backend | `controllers/` → `services/` | Controller không chứa SQL |

---

## ⚠️ Rules Nhớ Trước Khi Code

```
✅ Mọi fetch() phải đi qua ApiService — không fetch() thẳng trong UI module
✅ Giao tiếp giữa module qua EventBus — không gọi trực tiếp
✅ Business logic vào Service — Controller chỉ parse + gọi Service
✅ File JS mới: IIFE pattern + export ra window + đăng ký trong index.php
✅ File PHP mới: đăng ký route trong api/index.php + cập nhật PROJECT_REGISTRY.md
✅ Chord set 'HD' và 'default' KHÔNG được xóa
✅ currentTranspose LUÔN = 0 khi load bài mới
```

---

## 📁 Files Hay Đụng Nhất

| Muốn làm gì | File cần đọc |
|-------------|-------------|
| Thêm tính năng UI mới | `app.js` → `app-ui.js` → `includes/*.php` |
| Thêm API endpoint | `api/index.php` → tạo Controller + Service |
| Sửa chord logic | `chord-canvas.js` + `chord-canvas-ui.js` |
| Thêm keyboard shortcut | `keyboard-handler.js` |
| Thêm field vào bài hát | `SongService.php` + `SongController.php` + `ApiService.js` |
| Sửa giao diện toolbar | `includes/toolbar.php` + `assets/css/sheet.css` |
| Debug event flow | Mở F12 → Console, tìm EventBus.emit/on calls |

---

*Cập nhật: 2026-06-09 | Tool: https://github.com/Egonex-AI/Understand-Anything*
