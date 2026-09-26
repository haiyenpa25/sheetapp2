# PROJECT_REGISTRY.md — Sơ Đồ Dự Án

> **AI AGENT: Đọc file này để biết dự án có gì, ở đâu.**  
> Cập nhật file này sau mỗi phiên làm việc có tạo/sửa file quan trọng.

---

## 1 · THÔNG TIN DỰ ÁN

```yaml
Tên dự án:   [Tên dự án của bạn]
Phiên bản:   v1.0.0
Ngày tạo:    [DD/MM/YYYY]
Cập nhật:    [DD/MM/YYYY]

Stack:
  Frontend:  [React + TypeScript + Vite | Next.js | Vue | ...]
  Backend:   [Node.js/Express | GAS | Firebase | Laravel | ...]
  Database:  [PostgreSQL | MySQL | Firestore | Google Sheets | ...]
  Deploy:    [Vercel | Railway | GAS | VPS | ...]

Môi trường:
  Dev URL:   http://localhost:[port]
  Prod URL:  [production URL]
```

---

## 2 · CẤU TRÚC THƯ MỤC

```
[tên-dự-án]/
├── [backend-folder]/         # Server / API
│   ├── [entry file]          # Entry point
│   ├── [routes/controllers]  # Request handlers
│   ├── [models/services]     # Business logic
│   └── [db/migrations]       # Database layer
├── [frontend-folder]/        # Client / UI
│   ├── src/
│   │   ├── api/              # API calls (1 file = 1 domain)
│   │   ├── components/       # UI components (chỉ render)
│   │   ├── hooks/            # Custom hooks (logic)
│   │   ├── store/            # Global state
│   │   ├── types/            # TypeScript types
│   │   ├── utils/            # Helper functions
│   │   └── constants/        # App constants
│   └── [config files]
├── AI_AGENT.md               # ← Đọc đầu tiên
├── CODING_STANDARDS.md       # ← Đọc thứ hai
└── PROJECT_REGISTRY.md       # ← File này. Cập nhật thường xuyên.
```

> **Điền vào cấu trúc thực tế của dự án bạn ở đây.**

---

## 3 · FILE REGISTRY

> Liệt kê các file quan trọng. AI Agent đọc để không tạo duplicate.

### Backend

| File/Module | Mô tả | Pattern quan trọng |
|-------------|-------|--------------------|
| `[entry].js/ts` | Entry point, server setup | - |
| `[routes].js/ts` | API routes | REST: GET/POST/PUT/DELETE |
| `[controller].js/ts` | Request handlers | Không chứa DB logic |
| `[service].js/ts` | Business logic | Reusable, testable |
| `[model].js/ts` | Data models | Schema + validation |
| `[db].js/ts` | DB connection + queries | Connection pool |

### Frontend API Layer (`src/api/`)

| File | Domain | Ghi chú |
|------|--------|---------|
| `core.ts` | Bridge | `callBackend()`, env detection |
| `[domain]Api.ts` | [Tính năng] | [Mô tả] |

> *Thêm vào đây khi tạo file api mới*

### Frontend Hooks (`src/hooks/`)

| File | Dùng bởi | Trả về |
|------|----------|--------|
| `use[Domain].ts` | `[Component].tsx` | `{data, loading, error, actions}` |

> *Thêm vào đây khi tạo hook mới*

### Frontend Components (`src/components/`)

| File | Mô tả | Status |
|------|-------|--------|
| `[Feature]/index.tsx` | [Mô tả] | ✅ Done / 🔄 WIP / 📋 TODO |

> *Thêm vào đây khi tạo component mới*

### Types (`src/types/`)

| File | Exports |
|------|---------|
| `[domain].ts` | `type [TypeName]`, `interface [InterfaceName]` |

---

## 4 · API CONTRACT

### Backend API Endpoints

| Method | Path | Body/Params | Response | Ghi chú |
|--------|------|-------------|----------|---------|
| GET | `/api/[resource]` | - | `{data: T[]}` | - |
| POST | `/api/[resource]` | `{field1, field2}` | `{data: T}` | - |
| PUT | `/api/[resource]/:id` | `{field1}` | `{data: T}` | - |
| DELETE | `/api/[resource]/:id` | - | `{success: true}` | - |

> *Điền endpoints thực tế của dự án*

### Response Format Chuẩn

```typescript
// Mọi API response phải theo format này
type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
};
```

---

## 5 · ENVIRONMENT VARIABLES

```bash
# .env.example — Copy thành .env và điền giá trị

# App
NODE_ENV=development
PORT=3000

# Database
DATABASE_URL=

# Auth
JWT_SECRET=
JWT_EXPIRES_IN=7d

# External APIs
API_KEY=

# Frontend
VITE_API_URL=http://localhost:3000
```

> **Không bao giờ commit file .env thật. Chỉ commit .env.example**

---

## 6 · BUILD & DEPLOY

### Lệnh thường dùng

```bash
# Development
npm run dev           # Chạy dev server

# Build
npm run build         # Build production
npm run build:check   # Build + type check

# Deploy
[lệnh deploy]         # Deploy lên production

# Kiểm tra
npm run lint          # ESLint check
npx tsc --noEmit      # TypeScript check (no output)
```

### Deploy Pipeline

```
[Mô tả quy trình deploy của dự án]

Ví dụ:
1. npm run build → tạo dist/
2. Copy dist/ sang server
3. Restart server

Hoặc:
1. git push origin main
2. CI/CD tự build và deploy
```

---

## 7 · KNOWN ISSUES & GOTCHAS

> Ghi lại các vấn đề đặc thù của dự án để AI không mắc lại

```
1. [Mô tả vấn đề 1] → [Cách xử lý đúng]
2. [Mô tả vấn đề 2] → [Cách xử lý đúng]

Ví dụ từ dự án GAS:
- window.location.search luôn rỗng trong GAS iframe → Dùng window.__GAS_PARAMS__
- Build là single-file → Không dùng dynamic import
```

---

## 8 · QUYẾT ĐỊNH KIẾN TRÚC (Architecture Decision Records)

> Ghi lại những quyết định quan trọng và lý do để AI không "cải tiến" sai

| Quyết định | Lý do | Thay thế đã loại bỏ |
|------------|-------|---------------------|
| [Dùng Zustand thay Redux] | [Nhẹ hơn, ít boilerplate] | [Redux quá phức tạp cho scale này] |
| [API module pattern] | [Dễ mock, dễ test, tách biệt rõ] | [Gọi thẳng trong component] |

---

## 9 · NHẬT KÝ CẬP NHẬT

> AI Agent cập nhật mục này sau mỗi phiên làm việc

```
[2026-MM-DD] — [Mô tả ngắn những gì đã làm]
  + Tạo: [danh sách file mới]
  ~ Sửa: [danh sách file đã sửa]
  - Xóa: [danh sách file đã xóa]
  ⚠ Còn lại: [việc chưa hoàn thành]

Ví dụ:
[2026-05-15] — Redesign OrderCard + Modern Kanban board
  + Tạo: docs-templates/AI_AGENT.md, CODING_STANDARDS.md
  ~ Sửa: AdminApp.tsx (OrderCard, OrdersTab), api.js (getOrderHistory), reportApi.ts
  ⚠ Còn lại: MenuTab chưa migrate sang useMenu hook
```

---

*File này là "bộ nhớ" của dự án. AI Agent cập nhật sau mỗi phiên để phiên sau không phải khám phá lại từ đầu.*
