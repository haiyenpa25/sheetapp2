# 📦 AI Code Standards Templates

Bộ 3 file `.md` giúp AI agent (Claude, Gemini, ChatGPT) code **sạch, đúng kiến trúc, ít lỗi** — dùng được cho mọi dự án.

---

## 📁 Danh sách file

| File | Mục đích | AI đọc khi nào |
|------|----------|----------------|
| `AI_AGENT.md` | Workflow làm việc, anti-patterns, giao tiếp | **Đầu tiên** |
| `CODING_STANDARDS.md` | MVC, SOLID, Clean Code, TypeScript rules | **Thứ hai** |
| `PROJECT_REGISTRY.md` | Cấu trúc dự án, file map, API contract | **Thứ ba** |

---

## 🚀 Cách sử dụng

### Dự án mới

```bash
# 1. Copy 3 file vào root dự án
cp AI_AGENT.md          /path/to/your-project/
cp CODING_STANDARDS.md  /path/to/your-project/
cp PROJECT_REGISTRY.md  /path/to/your-project/

# 2. Điền thông tin vào PROJECT_REGISTRY.md
# (thay các [placeholder] bằng thông tin thật của dự án)
```

### Bắt đầu session với AI

Paste vào đầu mỗi conversation:

```
Trước khi làm bất cứ điều gì, hãy đọc 3 file sau theo thứ tự:
1. AI_AGENT.md
2. CODING_STANDARDS.md  
3. PROJECT_REGISTRY.md

Sau khi đọc xong, xác nhận bạn đã hiểu và tóm tắt ngắn những điểm quan trọng.
Sau đó tôi sẽ giao việc.
```

---

## ✏️ Tùy chỉnh theo dự án

### `AI_AGENT.md`
- Section 4 (Deploy): Cập nhật lệnh deploy cụ thể của bạn
- Section 6 (Nhận dự án mới): Thêm checklist đặc thù

### `CODING_STANDARDS.md`
- Section 3 (React): Thay bằng Vue/Angular/Svelte nếu dùng framework khác
- Section 4 (API): Thêm pattern REST/GraphQL/gRPC cụ thể

### `PROJECT_REGISTRY.md`
- **Toàn bộ file**: Điền thông tin thực của dự án
- Section 9 (Nhật ký): AI tự cập nhật sau mỗi phiên

---

## 📋 Nhân bản cho dự án khác

Chỉ cần copy 3 file và điền lại `PROJECT_REGISTRY.md`.  
`AI_AGENT.md` và `CODING_STANDARDS.md` dùng được nguyên vẹn cho mọi dự án.

```
Dự án A/
├── AI_AGENT.md         ← giống hệt
├── CODING_STANDARDS.md ← giống hệt
└── PROJECT_REGISTRY.md ← điền thông tin Dự án A

Dự án B/
├── AI_AGENT.md         ← giống hệt
├── CODING_STANDARDS.md ← giống hệt
└── PROJECT_REGISTRY.md ← điền thông tin Dự án B
```

---

## 💡 Tips

1. **Commit 3 file này vào git** — cả team và AI đều dùng được
2. **Cập nhật PROJECT_REGISTRY.md** sau mỗi phiên làm việc lớn
3. **Không sửa AI_AGENT.md và CODING_STANDARDS.md** trừ khi muốn thay đổi chuẩn code cho toàn team
4. **Đặt tên khác nếu cần** — Claude dùng `CLAUDE.md`, Gemini dùng `GEMINI.md` — nhưng nội dung tương tự
