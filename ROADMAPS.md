# ROADMAPS — Chỉ mục lộ trình SheetApp2

> **Cập nhật:** 2026-10-21 · Đây là điểm vào duy nhất cho mọi kế hoạch/roadmap.
> Người đọc: chủ dự án và người/AI thực thi. Đọc file này trước, rồi mở đúng tài liệu đang hiệu lực.

---

## 1. Đang hiệu lực

| Tài liệu | Phạm vi | Trạng thái |
|---|---|---|
| [ROADMAP6.md](ROADMAP6.md) | Trang Thư viện, Modern `/` và Classic `/old/` (ticket **TV0–TV7**) | 🟨 TV0, TV1, TV2, TV4 đã triển khai một phần; TV3, TV5, TV6, TV7 chưa bắt đầu. Bảng trạng thái ở đầu file |
| [PHUONG_AN_TOI_UU_HE_THONG.md](PHUONG_AN_TOI_UU_HE_THONG.md) | Toàn hệ thống: dọn kho, kiến trúc, hiệu năng, bảo mật, dữ liệu, kiểm thử (ticket **OPT-**) | ⬜ Đề xuất 2026-10-21, chờ chủ dự án duyệt |

Bằng chứng nghiệm thu của ROADMAP6 nằm ở `docs/ROADMAP6_*.md` và `docs/roadmap6-evidence/`.

---

## 2. Luật thực thi (bắt buộc, áp dụng cho mọi roadmap)

Lấy từ `ROADMAP3.md` Phần 0 (2026-09-26). Các roadmap sau đều dẫn chiếu luật này.

1. Chỉ làm ticket trong roadmap đang hiệu lực, đúng thứ tự. Không tự mở epic hay tính năng mới.
2. Không đánh dấu hoàn thành việc của chủ dự án.
3. Không sửa bảng quyết định và ô chữ ký. Chỉ chủ dự án được điền.
4. Mỗi ticket phải có bằng chứng thô: lệnh đã chạy, output lúc FAIL (trước khi sửa) và lúc PASS (sau khi sửa).
5. Test tìm chuỗi trong source (`str_contains`, `preg_match` trên file code) không tính là bằng chứng hành vi. Chỉ dùng để chặn tái phát.
6. Test và E2E không ghi vào DB hoặc storage thật. Dùng fixture memory hoặc bản sao cách ly.
7. Không làm tròn số liệu. Mọi con số phải do script đo.
8. Không push, deploy, chạy `sync.sh`/`sync.bat`, hay chạy migration trên DB thật khi chưa có backup và xác nhận của chủ dự án.
9. Mỗi ticket chạm tối đa khoảng 5 file. Lớn hơn thì dừng và đề xuất tách.
10. Dừng và hỏi khi cần xoá dữ liệu, đổi Core Rule, đổi quyền theo role, hoặc phát hiện lỗ hổng mới.

**Môi trường kiểm thử:**
```powershell
$env:Path = "C:\Program Files\nodejs;C:\xampp\php;" + $env:Path
php tests\run_all_tests.php        # PHP suites
npm run check:syntax               # node --check
npx eslint assets/js editor manager live-band learn
npx playwright test --reporter=line
```

---

## 3. Lịch sử (đã xong hoặc bị thay thế — chỉ để tra cứu)

Tất cả nằm trong [docs/history/](docs/history/). Không làm theo các file này nữa.

| File | Ngày | Nội dung | Kết cục |
|---|---|---|---|
| `SHEETAPP2_DANH_GIA_TONG_THE_VA_LO_TRINH_2026-09-24.md` | 09-24 | Đánh giá tổng thể ban đầu | Đầu vào của ROADMAP 1–2 |
| `ROADMAP.md` | 09-24 | Giai đoạn 0–3.9 | Xong; một số dấu [x] bị ROADMAP2/3 bác |
| `ROADMAP2.md` | 09-25 | Nghiệm thu lại GĐ0–3, kế hoạch GĐ4 | Bị thay bởi ROADMAP3 |
| `GIAO_VIEC_G3.9.md` | 09-25 | Phiếu giao việc G3.9 | Xong |
| `GEMINI_IMPLEMENTATION_RULES.md` | 09-25 | Luật bàn giao cho Gemini thời G0–G3.9 | Thay bởi mục 2 của file này |
| `ROADMAP3.md` | 09-26 | GĐ 4.9 "Ổn định trước Pilot" (K, F, Q, P, D) | Xong; Phần 0 chuyển sang mục 2 ở trên |
| `ROADMAP4.md` | 09-26 | Thư viện L0–L6 | Xong. Đưa lên từ bản local ngày 2026-10-21; đã che chi tiết mật khẩu ở mục L-D5 |
| `ROADMAP5.md` | 09-29 | Thư viện R0–R5 | Xong; nghiệm thu ở `docs/history/ROADMAP5_R5_ACCEPTANCE_REPORT.md` |
| `ROADMAP6_R6_2026-10-01.md`, `ROADMAP7.md` | 10-01 → 10-02 | Thư viện R6-x (bản cũ, khác `ROADMAP6.md` hiện hành), tối ưu điện thoại/laptop | Xong; báo cáo ở `docs/history/ROADMAP6_IMPLEMENTATION_REPORT.md`, `docs/history/ROADMAP7_IMPLEMENTATION_REPORT.md` |
| `KE_HOACH_SKILLS_VA_GITHUB.md` | 10-17 | Sprint S1–S3: skill, thư viện GitHub, OfflineVault | Xong |
| `PHUONG_AN_TOI_UU_HE_THONG_2026-10-17.md` | 10-17 | Phương án tối ưu P0–P3 | Đã thực hiện ở commit `e3dc9a3`; thay bằng bản 2026-10-21 |

---

## 4. Tài liệu vận hành còn dùng (không phải roadmap)

- `docs/DATABASE_MIGRATION_RUNBOOK.md`: migration, nâng cấp, rollback
- `docs/STAGING_AND_BACKUP_RUNBOOK.md`: staging, backup mã hoá, diễn tập phục hồi
- `docs/LIBRARY_DATA_RELEASE.md`: cài mới hoặc cập nhật thư viện từ seed
- `docs/INSTRUMENT_ANNOTATIONS.md`: ghi chú theo nhạc cụ
- `docs/ADR_005_TENANT_ISOLATION.md`: quyết định kiến trúc đa hội thánh (đã gỡ khỏi mã, chỉ để tham khảo)

**Quy ước:** khi một roadmap xong hoặc bị thay, `git mv` nó vào `docs/history/` và cập nhật bảng ở mục 3. Không dùng `docs/archive/` vì thư mục đó bị `.gitignore` nên sẽ không lên GitHub.
