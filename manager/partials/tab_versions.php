    <!-- ================= TAB 3: PHIÊN BẢN MUSICXML FORK ================= -->
    <section id="tab-versions" class="mgr-tab-pane">
      <div class="mgr-info-callout">
        <span class="mgr-callout-icon">💡</span>
        <div class="mgr-callout-text">
          <strong>Cơ chế Fork MusicXML Chuyên Sâu:</strong> Đây là các bản nốt nhạc độc lập được nhân bản từ bản gốc Master, cho phép Ca Trưởng hoặc Nhạc Trưởng phân chia 4 bè SATB, đổi ô nhịp hoặc soạn bè dạo riêng bằng Visual Editor mà không ảnh hưởng tới bản gốc của hội thánh.
        </div>
      </div>

      <!-- Filter Bar for Versions -->
      <div class="mgr-pane-filter-bar">
        <div class="mgr-filter-group">
          <span class="mgr-filter-title">Tác giả:</span>
          <div class="mgr-pill-row" id="mgr-version-author-chips">
            <button class="mgr-pill active" data-ver-author="">Tất Cả Tác Giả</button>
          </div>
        </div>

        <div class="mgr-pane-filter-right" style="display:flex; align-items:center; gap:0.75rem;">
          <label class="mgr-switch-label">
            <input type="checkbox" id="chk-ver-recommended-only">
            <span>⭐ Chỉ bản Ca Trưởng khuyên dùng</span>
          </label>
          <button id="btn-tab-create-version" class="mgr-btn mgr-btn-primary mgr-btn-sm">
            <span>✨</span> Tạo Bản Fork Mới
          </button>
        </div>
      </div>

      <div class="mgr-versions-grid" id="mgr-versions-grid">
        <div class="mgr-table-loading" style="grid-column: 1/-1;">
          <div class="mgr-spinner"></div>
          <p>Đang nạp danh sách bản phối MusicXML...</p>
        </div>
      </div>
    </section>
