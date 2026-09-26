    <!-- ================= TAB 8: ĐA HỘI THÁNH (MULTI-TENANT - ADMIN) ================= -->
    <section id="tab-tenants" class="mgr-tab-pane">
      <div class="mgr-section-header">
        <div>
          <h3>🏛️ Quản Trị Hệ Thống Đa Hội Thánh (Multi-Tenant Hub)</h3>
          <p class="text-muted">Quản lý các cơ sở dữ liệu hội thánh độc lập theo kiến trúc Database-per-Tenant (ADR-005).</p>
        </div>
        <button id="btn-create-tenant-modal" class="mgr-btn mgr-btn-primary">➕ Khởi Tạo Hội Thánh Mới</button>
      </div>

      <!-- KPI Cards -->
      <div class="mgr-hero-kpi-grid" style="grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); margin-bottom: 24px;">
        <div class="mgr-kpi-card">
          <div class="kpi-icon">🏛️</div>
          <div class="kpi-info">
            <span class="kpi-value" id="kpi-tenants-total">...</span>
            <span class="kpi-label">Hội Thánh Đã Kích Hoạt</span>
          </div>
        </div>
        <div class="mgr-kpi-card">
          <div class="kpi-icon">🛡️</div>
          <div class="kpi-info">
            <span class="kpi-value" style="color: #10b981;">Cô Lập 100%</span>
            <span class="kpi-label">Kiến Trúc DB-per-Tenant</span>
          </div>
        </div>
        <div class="mgr-kpi-card">
          <div class="kpi-icon">📖</div>
          <div class="kpi-info">
            <span class="kpi-value" style="color: #38bdf8;">Master 903</span>
            <span class="kpi-label">Thánh Ca Dùng Chung</span>
          </div>
        </div>
      </div>

      <!-- Tenants Table -->
      <div class="mgr-users-table-wrapper">
        <table class="mgr-table" id="mgr-tenants-table">
          <thead>
            <tr>
              <th>Tên Hội Thánh</th>
              <th>Mã Slug</th>
              <th>Đường Dẫn CSDL SQLite</th>
              <th>Quản Trị Viên</th>
              <th>Ngày Khởi Tạo</th>
              <th style="text-align:right;">Hành Động</th>
            </tr>
          </thead>
          <tbody id="mgr-tenants-tbody">
            <!-- Rendered via JS -->
          </tbody>
        </table>
      </div>
    </section>
