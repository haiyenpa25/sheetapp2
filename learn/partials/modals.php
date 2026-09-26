  <!-- ═══ MODAL BẢNG TIẾN ĐỘ TẬP LUYỆN & CA TRƯỞNG (Epic 3.6) ═════ -->
  <div id="learn-dashboard-modal" class="learn-modal-backdrop hidden" aria-hidden="true">
    <div class="learn-dashboard-dialog" role="dialog" aria-modal="true" aria-labelledby="learn-dash-title">
      <!-- Modal Header -->
      <div class="learn-dash-header">
        <div class="learn-dash-title-wrap">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:22px;height:22px;color:#a78bfa;">
            <path d="M12 20V10M18 20V4M6 20v-4"/>
          </svg>
          <h2 id="learn-dash-title">Tiến Độ Luyện Tập Thật</h2>
        </div>
        <div class="learn-dash-tabs">
          <button class="learn-dash-tab-btn active" data-tab="personal">Cá Nhân</button>
          <button class="learn-dash-tab-btn" data-tab="leader">Góc Nhìn Ca Trưởng</button>
        </div>
        <button class="learn-modal-close" title="Đóng">&times;</button>
      </div>

      <!-- Modal Body -->
      <div class="learn-dash-body">
        <div id="learn-dash-loading" class="learn-dash-spinner" style="display:none;">Đang tải dữ liệu...</div>

        <!-- Section 1: Cá nhân -->
        <div id="learn-dash-personal-section">
          <!-- KPI Cards -->
          <div class="learn-kpi-grid">
            <div class="learn-kpi-card">
              <span class="learn-kpi-label">Thời lượng tập</span>
              <strong class="learn-kpi-val" id="kpi-practice-hours">0 giờ</strong>
            </div>
            <div class="learn-kpi-card">
              <span class="learn-kpi-label">Tổng buổi tập</span>
              <strong class="learn-kpi-val" id="kpi-practice-sessions">0 buổi</strong>
            </div>
            <div class="learn-kpi-card">
              <span class="learn-kpi-label">Độ chính xác thật</span>
              <strong class="learn-kpi-val" id="kpi-practice-accuracy">0%</strong>
            </div>
            <div class="learn-kpi-card">
              <span class="learn-kpi-label">Chuỗi ngày tập</span>
              <strong class="learn-kpi-val" id="kpi-practice-streak">0 ngày 🔥</strong>
            </div>
          </div>

          <!-- Consent Toggle Switch -->
          <div class="learn-consent-box">
            <div class="learn-consent-info">
              <strong>🔒 Quyền riêng tư & Chia sẻ với Ca Trưởng</strong>
              <p>Cho phép Ca Trưởng và Ban Hát theo dõi tiến độ luyện tập của bạn để sắp xếp phụng vụ. Nếu tắt, tiến độ của bạn sẽ được ẩn danh hoàn toàn.</p>
            </div>
            <label class="learn-switch">
              <input type="checkbox" id="learn-consent-checkbox" checked>
              <span class="learn-slider"></span>
            </label>
          </div>

          <!-- 30-Day Activity Heatmap -->
          <div class="learn-dash-block">
            <h4 class="learn-dash-subhead">Hoạt Động 30 Ngày Gần Nhất</h4>
            <div class="learn-heatmap-grid" id="learn-dash-heatmap"></div>
          </div>

          <!-- Weak measures -->
          <div class="learn-dash-block">
            <h4 class="learn-dash-subhead">Các Ô Nhịp Cần Rèn Thêm (Accuracy &lt; 85%)</h4>
            <div id="learn-dash-weak-measures" class="learn-weak-list"></div>
          </div>

          <!-- Recent sessions -->
          <div class="learn-dash-block">
            <h4 class="learn-dash-subhead">Nhật Ký Phiên Tập Gần Nhất</h4>
            <div class="learn-table-wrap">
              <table class="learn-dash-table">
                <thead>
                  <tr>
                    <th>Thời gian</th>
                    <th>Bài hát</th>
                    <th>Chế độ</th>
                    <th>Thời lượng</th>
                    <th>Chính xác</th>
                  </tr>
                </thead>
                <tbody id="learn-dash-recent-tbody"></tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Section 2: Góc nhìn Ca Trưởng -->
        <div id="learn-dash-leader-section" style="display:none;">
          <div class="learn-leader-banner">
            <strong>📋 Bảng Theo Dõi Tiến Độ Toàn Ca Đoàn (Leader Dashboard)</strong>
            <p>Hệ thống tự động bảo vệ riêng tư: Các thành viên tắt chia sẻ sẽ được ẩn danh dạng <em>"Thành viên ẩn danh #X"</em> để đảm bảo tính minh bạch và sự đồng thuận (Consent-First).</p>
          </div>
          <div id="learn-leader-loading" class="learn-dash-spinner" style="display:none;">Đang tải danh sách ca đoàn...</div>
          <div class="learn-table-wrap">
            <table class="learn-dash-table">
              <thead>
                <tr>
                  <th>Thành viên</th>
                  <th>Số lượt tập</th>
                  <th>Tổng phút</th>
                  <th>Accuracy</th>
                  <th>Lần tập gần nhất</th>
                  <th>Bài hát gần đây</th>
                </tr>
              </thead>
              <tbody id="learn-leader-tbody"></tbody>
            </table>
          </div>
        </div>

      </div><!-- /.learn-dash-body -->
    </div>
  </div>

  <!-- Modal: Bài tập của tôi (Epic 4.1 Practice Assignments) -->
  <div id="modal-learn-assignments" class="modal-overlay hidden" role="dialog" aria-modal="true" aria-labelledby="modal-assignments-title">
    <div class="modal-backdrop"></div>
    <div class="modal-dialog modal-lg">
      <div class="modal-header">
        <h3 id="modal-assignments-title" class="modal-title">📋 Bài Tập Của Tôi</h3>
        <button type="button" class="btn-modal-close" id="btn-close-assignments-modal" aria-label="Đóng">&times;</button>
      </div>
      <div class="modal-body">
        <div class="lac-filter-bar">
          <button class="lac-filter-tab active" data-filter="all" type="button">Tất cả</button>
          <button class="lac-filter-tab" data-filter="in_progress" type="button">Đang tập</button>
          <button class="lac-filter-tab" data-filter="completed" type="button">Đã thuộc</button>
        </div>
        <div id="lac-list-container" class="lac-list-container">
          <div class="lac-loading">Đang tải danh sách bài tập...</div>
        </div>
      </div>
    </div>
  </div>
