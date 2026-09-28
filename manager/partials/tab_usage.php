    <!-- ================= TAB 6: THỐNG KÊ THỜ PHƯỢNG & LỊCH SỬ SỬ DỤNG BÀI (EPIC 4.3) ================= -->
    <section id="tab-usage" class="mgr-tab-pane">
      <!-- Filter Bar -->
      <div class="mgr-pane-filter-bar" style="margin-bottom: 16px;">
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
          <label style="font-size:0.85rem;color:var(--text-muted);">Từ ngày: <input type="date" id="usage-filter-from" class="mgr-input" style="padding:4px 8px;font-size:0.8rem;width:auto;"></label>
          <label style="font-size:0.85rem;color:var(--text-muted);">Đến ngày: <input type="date" id="usage-filter-to" class="mgr-input" style="padding:4px 8px;font-size:0.8rem;width:auto;"></label>
          <button id="btn-filter-usage" class="mgr-btn mgr-btn-sm mgr-btn-primary">🔍 Lọc Dữ Liệu</button>
          <button id="btn-reset-usage" class="mgr-btn mgr-btn-sm mgr-btn-ghost">🔄 Đặt Lại</button>
        </div>
      </div>

      <!-- KPI Summary Cards -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:12px;margin-bottom:20px;">
        <div class="mgr-kpi-card">
          <div class="kpi-icon">⛪</div>
          <div class="kpi-info">
            <div class="kpi-value" id="stat-usage-services">0</div>
            <div class="kpi-label">Buổi Nhóm Thờ Phượng</div>
          </div>
        </div>
        <div class="mgr-kpi-card">
          <div class="kpi-icon">🎵</div>
          <div class="kpi-info">
            <div class="kpi-value" id="stat-usage-plays">0</div>
            <div class="kpi-label">Lượt Hát Bài Thánh Ca</div>
          </div>
        </div>
        <div class="mgr-kpi-card">
          <div class="kpi-icon">📖</div>
          <div class="kpi-info">
            <div class="kpi-value" id="stat-usage-unique">0</div>
            <div class="kpi-label">Bài Hát Đã Khai Thác</div>
          </div>
        </div>
        <div class="mgr-kpi-card">
          <div class="kpi-icon">📊</div>
          <div class="kpi-info">
            <div class="kpi-value" id="stat-usage-coverage">0%</div>
            <div class="kpi-label">Độ Phủ Thư Viện Bài</div>
          </div>
        </div>
      </div>

      <!-- Grid 2 Bảng: Top Bài Dùng Nhiều Nhất & Bài Tiềm Năng Chưa Dùng -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(420px, 1fr));gap:20px;margin-bottom:24px;">
        <!-- Bảng 1: Top Bài Hát Dùng Nhiều Nhất -->
        <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:8px;padding:16px;">
          <h4 style="margin-bottom:12px;font-size:0.95rem;font-weight:700;display:flex;align-items:center;gap:6px;">
            <span>⭐</span> Top Bài Hát Hát Thường Xuyên
          </h4>
          <table class="mgr-table" style="font-size:0.82rem;">
            <thead>
              <tr>
                <th style="width:36px;text-align:center;">#</th>
                <th>Tựa Bài Hát</th>
                <th style="width:65px;text-align:center;">Số Lần</th>
                <th style="width:90px;text-align:center;">Lần Cuối</th>
                <th style="width:85px;text-align:center;">Tông</th>
                <th style="width:55px;text-align:center;">Hợp Âm</th>
                <th style="width:75px;text-align:center;">Bản In</th>
              </tr>
            </thead>
            <tbody id="tbody-usage-most">
              <!-- Rendered via JS -->
            </tbody>
          </table>
        </div>

        <!-- Bảng 2: Bài Hát Tiềm Năng (Lâu Chưa Hát / Chưa Dùng) -->
        <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:8px;padding:16px;">
          <h4 style="margin-bottom:12px;font-size:0.95rem;font-weight:700;display:flex;align-items:center;gap:6px;">
            <span>💡</span> Kho Bài Hát Tiềm Năng (> 12 tuần chưa hát)
          </h4>
          <table class="mgr-table" style="font-size:0.82rem;">
            <thead>
              <tr>
                <th style="width:36px;text-align:center;">#</th>
                <th>Tựa Bài Hát</th>
                <th style="width:70px;text-align:center;">Giọng Gốc</th>
                <th style="width:110px;text-align:center;">Lần Cuối Dùng</th>
                <th style="width:75px;text-align:center;">Bản In</th>
              </tr>
            </thead>
            <tbody id="tbody-usage-dormant">
              <!-- Rendered via JS -->
            </tbody>
          </table>
        </div>
      </div>

      <!-- Bảng 3: Nhật Ký Sử Dụng Bài Hát Gần Nhất -->
      <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:8px;padding:16px;">
        <h4 style="margin-bottom:12px;font-size:0.95rem;font-weight:700;display:flex;align-items:center;gap:6px;">
          <span>📅</span> Nhật Ký Thờ Phượng Gần Đây
        </h4>
        <table class="mgr-table" style="font-size:0.82rem;">
          <thead>
            <tr>
              <th style="width:100px;">Ngày Diễn Ra</th>
              <th>Buổi Nhóm / Thờ Phượng</th>
              <th>Bài Hát Đã Sử Dụng</th>
              <th style="width:110px;text-align:center;">Tông Biểu Diễn</th>
              <th style="width:85px;text-align:center;">Booklet</th>
            </tr>
          </thead>
          <tbody id="tbody-usage-history">
            <!-- Rendered via JS -->
          </tbody>
        </table>
      </div>
    </section>
