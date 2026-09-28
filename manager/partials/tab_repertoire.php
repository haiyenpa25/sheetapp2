    <!-- ================= TAB 1: KHO BÀI HÁT & THỂ LOẠI (REPERTOIRE) ================= -->
    <section id="tab-repertoire" class="mgr-tab-pane active">
      <!-- Filter Bar -->
      <div class="mgr-pane-filter-bar">
        <div class="mgr-category-pills" id="mgr-cat-pills">
          <button class="mgr-pill active" data-cat-id="">Tất Cả Thể Loại</button>
          <!-- Dynamic Pills from API -->
        </div>

        <div class="mgr-pane-filter-right">
          <label class="mgr-switch-label">
            <input type="checkbox" id="chk-only-has-chords">
            <span>Chỉ bài có bản phối thành viên</span>
          </label>
        </div>
      </div>

      <!-- Bulk Action Bar for Selected Songs (Ticket L6-3) -->
      <div class="mgr-bulk-bar hidden" id="mgr-bulk-bar" style="background:var(--bg-surface-elevated, #1e293b); border:1px solid var(--border); border-radius:var(--radius-md, 8px); padding:0.75rem 1rem; margin-bottom:1rem; display:flex; flex-wrap:wrap; align-items:center; gap:0.75rem; justify-content:space-between;">
        <div style="display:flex; align-items:center; gap:0.5rem;">
          <span style="font-weight:700; color:var(--accent, #3b82f6);">✓ Đã chọn <span id="mgr-bulk-count">0</span> bài</span>
        </div>
        <div style="display:flex; align-items:center; gap:0.6rem; flex-wrap:wrap;">
          <select id="mgr-bulk-season" class="mgr-select-sm" style="padding:0.4rem 0.6rem; border-radius:4px; font-size:0.85rem; border:1px solid var(--border);">
            <option value="__KEEP__">-- Mùa Lễ (Giữ nguyên) --</option>
            <option value="">(Xóa Mùa Lễ)</option>
            <option value="Thường Niên">Thường Niên</option>
            <option value="Giáng Sinh">Giáng Sinh</option>
            <option value="Thương Khó">Thương Khó</option>
            <option value="Phục Sinh">Phục Sinh</option>
            <option value="Thăng Thiên">Thăng Thiên</option>
            <option value="Lễ Ngũ Tuần">Lễ Ngũ Tuần (Đức Thánh Linh)</option>
            <option value="Tái Lâm">Tái Lâm</option>
            <option value="Lễ Cảm Tạ">Lễ Cảm Tạ</option>
            <option value="Truyền Giảng">Truyền Giảng</option>
            <option value="Đầu Năm">Đầu Năm Mới</option>
          </select>

          <input type="text" id="mgr-bulk-theme" placeholder="Nhập Chủ Đề..." list="theme-datalist" style="padding:0.4rem 0.6rem; border-radius:4px; font-size:0.85rem; border:1px solid var(--border); min-width:180px;">
          <datalist id="theme-datalist">
            <option value="Tôn Vinh & Ngợi Khen">
            <option value="Đức Chúa Trời Dắt Chăn">
            <option value="Chúa Giáng Sinh">
            <option value="Sự Thương Khó & Thập Tự Giá">
            <option value="Chúa Phục Sinh">
            <option value="Chúa Thăng Thiên">
            <option value="Chúa Tái Lâm">
            <option value="Đức Thánh Linh">
            <option value="Hội Thánh & Thờ Phượng">
            <option value="Lời Chúa & Kinh Thánh">
            <option value="Sự Cứu Rỗi & Mời Gọi">
            <option value="Đức Tin & Trông Cậy">
            <option value="Cầu Nguyện & Tận Hiến">
            <option value="Bình An & Yên Ủi">
            <option value="Cảm Tạ & Phước Lành">
            <option value="Truyền Giảng & Chứng Nhân">
          </datalist>

          <button id="btn-mgr-bulk-apply" class="mgr-btn mgr-btn-primary mgr-btn-sm" style="font-weight:700;">🏷️ Gắn Nhãn Hàng Loạt</button>
          <button id="btn-mgr-bulk-clear" class="mgr-btn mgr-btn-ghost mgr-btn-sm">Bỏ Chọn</button>
        </div>
      </div>

      <!-- Repertoire Table / Grid -->
      <div class="mgr-repertoire-wrapper">
        <table class="mgr-table" id="mgr-songs-table">
          <thead>
            <tr>
              <th style="width: 40px; text-align:center;">
                <input type="checkbox" id="chk-select-all-songs" title="Chọn tất cả bài đang hiển thị">
              </th>
              <th style="width: 60px;">STT</th>
              <th>Tựa Đề Thánh Ca</th>
              <th style="width: 80px; text-align:center;">Giọng</th>
              <th style="width: 170px;">Thể Loại & Nhãn</th>
              <th>Bản Phối & Hợp Âm Thành Viên (Công Khai)</th>
              <th style="width: 220px; text-align:right;">Hành Động</th>
            </tr>
          </thead>
          <tbody id="mgr-songs-tbody">
            <tr>
              <td colspan="7" class="mgr-table-loading">
                <div class="mgr-spinner"></div>
                <p>Đang nạp kho dữ liệu bài hát...</p>
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Pagination -->
        <div class="mgr-pagination" id="mgr-songs-pagination">
          <span class="mgr-page-info" id="mgr-page-info">Hiển thị 1 - 50</span>
          <div class="mgr-page-btns">
            <button id="btn-prev-page" class="mgr-btn mgr-btn-sm" disabled>← Trang Trước</button>
            <button id="btn-next-page" class="mgr-btn mgr-btn-sm">Trang Kế →</button>
          </div>
        </div>
      </div>
    </section>
