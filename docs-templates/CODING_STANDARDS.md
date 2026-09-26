# CODING STANDARDS — Quy Tắc Code Bắt Buộc

> ⚠ **AI AGENT: Đọc toàn bộ file này TRƯỚC khi viết bất kỳ dòng code nào.**  
> Đây là nguồn sự thật duy nhất về tiêu chuẩn code của dự án.

---

## 1 · NGUYÊN TẮC KIẾN TRÚC (Architecture Principles)

### 1.1 MVC — Tách biệt trách nhiệm

| Layer | Trách nhiệm | KHÔNG làm |
|-------|-------------|-----------|
| **Model** | Dữ liệu, DB, business rules | Render UI, gọi framework |
| **View** | Hiển thị dữ liệu thuần túy | Xử lý logic, gọi DB trực tiếp |
| **Controller** | Điều phối Model ↔ View | Chứa business logic phức tạp |

**Quy tắc vàng:** Component/View chỉ nhận data qua props hoặc hook. **Không bao giờ** gọi API trực tiếp trong component.

```
✅ Component → Hook → API module → Backend
❌ Component → Backend (trực tiếp)
```

---

### 1.2 SOLID

**S — Single Responsibility**
- Mỗi file/class/function làm đúng 1 việc
- Nếu hàm làm 2 việc → tách ra 2 hàm
- Nếu file vượt 300 dòng → xem xét tách module

**O — Open/Closed**
- Thêm tính năng bằng cách mở rộng, không sửa code hiện có
- Dùng composition thay vì sửa trực tiếp

**L — Liskov Substitution**
- Các implementation có thể hoán đổi (mock ↔ real, dev ↔ prod)
- Không hardcode environment cụ thể trong business logic

**I — Interface Segregation**
- Hook/API chỉ expose những gì consumer thực sự cần
- Không trả về object khổng lồ nếu chỉ cần 2 field

**D — Dependency Inversion**
- Module cấp cao phụ thuộc vào abstraction (interface/hook)
- Không import implementation cụ thể vào presentation layer

---

### 1.3 DRY — Don't Repeat Yourself

```
❌ SAI: Copy-paste logic ở 3 nơi
✅ ĐÚNG: Tạo hàm/hook/util dùng chung
```

- Mọi hằng số → file constants riêng (không hardcode string)
- Mọi logic tái sử dụng → utility function hoặc custom hook
- Mọi API call pattern → wrapper function chung

---

### 1.4 Clean Code

**Đặt tên:**
```
✅ getActiveOrders()     — rõ ràng, mô tả đúng
✅ isUserAuthenticated   — boolean bắt đầu bằng is/has/can
✅ MAX_RETRY_COUNT       — constant viết hoa
❌ getData()             — quá chung
❌ flag                  — không có nghĩa
❌ x, temp, data2        — không mô tả
```

**Hàm:**
- Mỗi hàm ≤ 30 dòng; dài hơn → tách nhỏ
- Tham số ≤ 3; nhiều hơn → dùng object `{param1, param2, ...}`
- Return sớm thay vì nested if-else sâu

**Comment:**
```javascript
// ✅ ĐÚNG: Giải thích TẠI SAO
// GAS iframe không hỗ trợ window.location.search nên phải dùng __PARAMS__
const params = window.__GAS_PARAMS__;

// ❌ SAI: Mô tả lại những gì code đã nói
// Gán params từ GAS
const params = window.__GAS_PARAMS__;
```

---

## 2 · QUY TẮC TYPESCRIPT / JAVASCRIPT

### 2.1 TypeScript

```typescript
// ✅ Dùng type alias cho union/intersection
type Status = 'NEW' | 'PREPARING' | 'COMPLETED' | 'CANCELLED';
type DateRange = '1' | '7' | '14' | 'month' | 'quarter' | 'year' | 'custom';

// ✅ Interface cho object shape có thể extend
interface Order {
  id: string;
  status: Status;
  totalAmount: number;
}

// ✅ Generic cho reusable functions
async function fetchData<T>(endpoint: string): Promise<ApiResponse<T>> { ... }

// ❌ Không dùng any trừ khi thực sự cần
const data: any = ...;  // ❌ Tránh
const data: Order = ...; // ✅
```

### 2.2 Async/Await

```typescript
// ✅ Luôn xử lý error
async function loadData() {
  try {
    setLoading(true);
    const result = await api.getData();
    setData(result);
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Lỗi không xác định');
  } finally {
    setLoading(false);
  }
}

// ❌ Không bỏ qua error
const result = await api.getData(); // crash nếu lỗi
```

### 2.3 Constants

```typescript
// ✅ Tập trung constants
export const STATUS = {
  NEW: 'NEW',
  PREPARING: 'PREPARING',
  COMPLETED: 'COMPLETED',
} as const;

// ❌ Magic string rải rác
if (order.status === 'NEW') { ... }  // hardcode = bug source
```

---

## 3 · QUY TẮC REACT (Frontend)

### 3.1 Component

```typescript
// ✅ Functional component, props typed rõ ràng
interface OrderCardProps {
  order: Order;
  onUpdate: (id: string, status: Status) => void;
  onPrint: (order: Order) => void;
}

function OrderCard({ order, onUpdate, onPrint }: OrderCardProps) {
  // chỉ render, không gọi API
  return <div>...</div>;
}

// ❌ Không gọi API trong component
function OrderCard({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState(null);
  useEffect(() => {
    fetch('/api/orders/' + orderId).then(...); // ❌ Vi phạm MVC
  }, []);
}
```

### 3.2 Custom Hooks

```typescript
// ✅ Hook = Controller. Chứa logic, trả về data + actions
export function useOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await orderApi.getAll();
      setOrders(res.data);
    } catch (e) {
      setError('Không tải được đơn hàng');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  return { orders, loading, error, refetch: fetchOrders };
}
```

### 3.3 State Management

```typescript
// ✅ useState cho local UI state
const [isOpen, setIsOpen] = useState(false);

// ✅ useCallback cho handlers (tránh re-render không cần thiết)
const handleSubmit = useCallback(async (data: FormData) => {
  await save(data);
}, [save]);

// ✅ useMemo cho computed values đắt tiền
const totalRevenue = useMemo(
  () => orders.reduce((sum, o) => sum + o.amount, 0),
  [orders]
);

// ❌ Không init state bằng async call
const [data] = useState(() => fetchData()); // ❌ fetchData trả Promise
```

---

## 4 · QUY TẮC API LAYER

### 4.1 Cấu trúc API module

```typescript
// src/api/productApi.ts

import { callBackend, mock } from './core';
import type { Product } from '../types';

// Constants
const MOCK_PRODUCTS: Product[] = [
  { id: '1', name: 'Cà phê sữa', price: 35000 },
];

// Public API functions
export async function getProducts(): Promise<Product[]> {
  if (IS_DEV) return mock(MOCK_PRODUCTS, 300); // mock cho local dev
  const res = await callBackend('getProducts');
  return res.data;
}

export async function addProduct(data: Omit<Product, 'id'>): Promise<Product> {
  if (IS_DEV) return mock({ ...data, id: Date.now().toString() }, 400);
  const res = await callBackend('addProduct', data);
  return res.data;
}
```

### 4.2 Response format chuẩn

```typescript
// Backend luôn trả về format này
type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

// ✅ Check success trước khi dùng data
const res = await api.getOrders();
if (!res.success) throw new Error(res.error);
return res.data;
```

---

## 5 · QUY TẮC FILE & THƯ MỤC

```
src/
├── api/          # API calls (1 file = 1 domain)
├── components/   # React components (chỉ render)
│   ├── common/   # Dùng chung: Button, Modal, Input
│   └── feature/  # Feature-specific components
├── hooks/        # Custom hooks (business logic)
├── store/        # Global state (Zustand/Redux)
├── types/        # TypeScript types & interfaces
├── utils/        # Pure utility functions
└── constants/    # App-wide constants
```

**Quy tắc đặt tên file:**
```
components/  → PascalCase:  OrderCard.tsx, UserProfile.tsx
hooks/       → camelCase:   useOrders.ts, useAuth.ts
api/         → camelCase:   orderApi.ts, productApi.ts
utils/       → camelCase:   formatDate.ts, currencyUtils.ts
types/       → PascalCase:  Order.ts, Product.ts (hoặc index.ts)
constants/   → UPPER_SNAKE: ORDER_STATUS.ts, hoặc camelCase: orderConstants.ts
```

---

## 6 · CHECKLIST TRƯỚC KHI COMMIT

```
☐ TypeScript: 0 lỗi type error (tsc --noEmit)
☐ Build: npm run build thành công
☐ Component không gọi API trực tiếp (qua hook/api module)
☐ Không có magic string (dùng constants)
☐ Hàm mới có ≤ 30 dòng
☐ Error được xử lý (try/catch hoặc .catch())
☐ Không có console.log còn sót (trừ debug có chủ đích)
☐ Constants không hardcode trong component
☐ File mới được thêm vào đúng thư mục
```

---

*Template này dùng chung cho mọi dự án. Copy vào root dự án và điều chỉnh Section 4 theo stack cụ thể.*
