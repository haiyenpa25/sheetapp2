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

      <!-- Repertoire Table / Grid -->
      <div class="mgr-repertoire-wrapper">
        <table class="mgr-table" id="mgr-songs-table">
          <thead>
            <tr>
              <th style="width: 70px;">STT</th>
              <th>Tựa Đề Thánh Ca</th>
              <th style="width: 90px; text-align:center;">Giọng</th>
              <th style="width: 170px;">Thể Loại</th>
              <th>Bản Phối & Hợp Âm Thành Viên (Công Khai)</th>
              <th style="width: 240px; text-align:right;">Hành Động</th>
            </tr>
          </thead>
          <tbody id="mgr-songs-tbody">
            <tr>
              <td colspan="6" class="mgr-table-loading">
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
