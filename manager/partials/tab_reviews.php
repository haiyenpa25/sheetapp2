    <!-- ================= TAB 7: HÀNG ĐỢI PHÊ DUYỆT (REVIEW QUEUE) ================= -->
    <section id="tab-reviews" class="mgr-tab-pane">
      <div class="mgr-info-callout" style="margin-bottom: 1rem;">
        <span class="mgr-callout-icon">🛡️</span>
        <div class="mgr-callout-text">
          <strong>Quy Trình Phê Duyệt & Kiểm Soát Chất Lượng:</strong> Đề xuất cập nhật bản HD hoặc ghim đề xuất khuyên dùng từ Ban Hát / Thành viên. Trưởng Ban Hát (Leader) hoặc Quản Trị Viên (Admin) có thể kiểm tra trực quan bảng sai khác (Visual Diff) theo từng ô nhịp trước khi phê duyệt hoặc từ chối kèm lý do. Mọi thay đổi HD đều được lưu snapshot lịch sử để có thể hoàn tác bất kỳ lúc nào.
        </div>
      </div>

      <!-- Filter Bar -->
      <div class="mgr-pane-filter-bar" style="margin-bottom: 16px;">
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
          <div style="display:flex;align-items:center;gap:6px;">
            <label style="font-size:0.85rem;color:var(--text-muted);font-weight:600;">Trạng thái:</label>
            <select id="reviews-filter-status" class="mgr-input" style="padding:4px 8px;font-size:0.82rem;width:auto;">
              <option value="pending" selected>⏳ Đang chờ duyệt (Pending)</option>
              <option value="approved">✅ Đã phê duyệt</option>
              <option value="rejected">❌ Đã từ chối</option>
              <option value="">Tất cả trạng thái</option>
            </select>
          </div>

          <div style="display:flex;align-items:center;gap:6px;">
            <label style="font-size:0.85rem;color:var(--text-muted);font-weight:600;">Loại đề xuất:</label>
            <select id="reviews-filter-type" class="mgr-input" style="padding:4px 8px;font-size:0.82rem;width:auto;">
              <option value="">Tất cả loại</option>
              <option value="update_hd">💎 Cập nhật bản HD</option>
              <option value="recommend">⭐ Ghim Khuyên dùng</option>
            </select>
          </div>

          <button id="btn-refresh-reviews" class="mgr-btn mgr-btn-sm mgr-btn-ghost">🔄 Tải Lại</button>
        </div>
      </div>

      <!-- Queue Table -->
      <div class="mgr-repertoire-wrapper">
        <table class="mgr-table" id="mgr-reviews-table">
          <thead>
            <tr>
              <th style="width: 50px; text-align:center;">STT</th>
              <th>Bài Hát Đề Xuất</th>
              <th style="width: 140px; text-align:center;">Loại Đề Xuất</th>
              <th style="width: 170px;">Người Gửi / Thời Gian</th>
              <th style="width: 180px;">Tóm Tắt Khác Biệt</th>
              <th style="width: 110px; text-align:center;">Trạng Thái</th>
              <th style="width: 170px; text-align:center;">Hành Động</th>
            </tr>
          </thead>
          <tbody id="tbody-reviews-queue">
            <tr>
              <td colspan="7" class="mgr-table-loading">
                <div class="mgr-spinner"></div>
                <p>Đang tải hàng đợi phê duyệt...</p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
