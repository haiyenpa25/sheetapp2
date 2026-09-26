# Agent Workspace Rules — Superpowers & Gitnexus Integration

## 1. Superpowers Team Workflow Rules
- **Phase 1 (Architect / Spec):** Trước khi sửa bất kỳ file nào, AI Agent phải thực hiện Impact Analysis, xác định tất cả các file bị ảnh hưởng và xây dựng kế hoạch cụ thể. Không được "vibe coding" (viết code ngẫu hứng).
- **Phase 2 (Developer):** Tuân thủ tiêu chuẩn mã nguồn (`CODING_STANDARDS.md`), giữ vững các Core Rules (HD set, currentTranspose = 0, Lock TLH/HD).
- **Phase 3 (Tester / Self-Verification):** Sau khi viết code xong, bắt buộc phải tự động kiểm tra cú pháp (PHP `php -l`, JS syntax check) và kiểm tra log lỗi trước khi bàn giao.
- **Phase 4 (DevOps / Auto-Sync):** Tác vụ cuối cùng BẮT BUỘC là chạy `./sync.sh`.

## 2. Gitnexus Second Brain Rules
- File [CODE_MAP.md](file:///home/sheet.hyb.io.vn/public_html/CODE_MAP.md) đóng vai trò là Bản đồ tri thức (Codebase Knowledge Graph) của dự án.
- Mọi Agent khi tiếp nhận tác vụ phải tra cứu [CODE_MAP.md](file:///home/sheet.hyb.io.vn/public_html/CODE_MAP.md) để nắm toàn bộ sơ đồ phụ thuộc giữa `assets/js/core/`, `api/controllers/`, `api/services/`, và SQLite Database.
- Khi thêm/sửa/xóa file, lệnh `./sync.sh` sẽ tự động kích hoạt `node tools/generate_code_map.js` để cập nhật lại [CODE_MAP.md](file:///home/sheet.hyb.io.vn/public_html/CODE_MAP.md).

## 3. Auto GitHub Sync Rule
- Từ thời điểm này trở đi, mỗi khi người dùng yêu cầu code, sửa lỗi, hay chỉnh sửa bất kỳ file nào trong dự án, tác vụ cuối cùng sau khi hoàn thành code BẮT BUỘC phải là chạy lệnh `./sync.sh`.
- Tự động đẩy code lên GitHub qua `./sync.sh` mà không cần chờ người dùng ra lệnh thêm.
