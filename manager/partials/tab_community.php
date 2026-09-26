    <!-- ================= TAB 2: BỘ HỢP ÂM CỘNG ĐỒNG (COMMUNITY CHORDS) ================= -->
    <section id="tab-community" class="mgr-tab-pane">
      <div class="mgr-pane-filter-bar">
        <!-- Instrument Filter Pills -->
        <div class="mgr-filter-group">
          <span class="mgr-filter-title">Nhạc cụ:</span>
          <div class="mgr-pill-row" id="mgr-instrument-pills">
            <button class="mgr-pill active" data-inst="">Tất Cả</button>
            <button class="mgr-pill" data-inst="guitar">🎸 Guitar</button>
            <button class="mgr-pill" data-inst="piano">🎹 Piano / Key</button>
            <button class="mgr-pill" data-inst="bass">🎻 Bass</button>
            <button class="mgr-pill" data-inst="general">🎼 Tổng Hợp</button>
          </div>
        </div>

        <!-- Author Filter Chips -->
        <div class="mgr-filter-group">
          <span class="mgr-filter-title">Người soạn:</span>
          <div class="mgr-pill-row" id="mgr-author-chips">
            <button class="mgr-pill active" data-author="">Tất Cả Tác Giả</button>
            <!-- Render dynamic user chips -->
          </div>
        </div>

        <div class="mgr-pane-filter-right">
          <label class="mgr-switch-label">
            <input type="checkbox" id="chk-recommended-only">
            <span>⭐ Chỉ bản Ca Trưởng khuyên dùng</span>
          </label>
        </div>
      </div>

      <!-- Community Cards Grid -->
      <div class="mgr-community-grid" id="mgr-community-grid">
        <div class="mgr-table-loading" style="grid-column: 1/-1;">
          <div class="mgr-spinner"></div>
          <p>Đang nạp các bộ hợp âm đóng góp...</p>
        </div>
      </div>
    </section>
