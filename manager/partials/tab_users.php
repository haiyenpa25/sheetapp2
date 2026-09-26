    <!-- ================= TAB 5: QUẢN TRỊ THÀNH VIÊN (USERS - ADMIN) ================= -->
    <section id="tab-users" class="mgr-tab-pane">
      <div class="mgr-section-header">
        <div>
          <h3>👥 Quản Trị Thành Viên & Phân Quyền Hệ Thống</h3>
          <p class="text-muted">Kiểm soát danh sách tài khoản, phân quyền tạo hợp âm và theo dõi đóng góp.</p>
        </div>
        <button id="btn-add-user-modal" class="mgr-btn mgr-btn-primary">+ Tạo Tài Khoản Thành Viên</button>
      </div>

      <div class="mgr-users-table-wrapper">
        <table class="mgr-table" id="mgr-users-table">
          <thead>
            <tr>
              <th>Thành Viên</th>
              <th>Vai Trò</th>
              <th>Nhạc Cụ Sở Trường</th>
              <th>Mã Hợp Âm</th>
              <th>Số Bộ Hợp Âm Đóng Góp</th>
              <th>Số Bản Phối XML</th>
              <th>Ngày Tham Gia</th>
              <th style="text-align:right;">Hành Động</th>
            </tr>
          </thead>
          <tbody id="mgr-users-tbody">
            <!-- Rendered via JS -->
          </tbody>
        </table>
      </div>
    </section>
