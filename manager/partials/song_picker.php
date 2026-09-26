    <!-- ================= SONG SEARCH & SELECTED SONG WORKSPACE ================= -->
    <section class="mgr-song-picker-section">
      <div class="mgr-picker-bar">
        <div class="mgr-picker-left">
          <span class="picker-icon">🎯</span>
          <div class="picker-text">
            <strong>Tìm & Chọn Bài Hát:</strong>
            <span class="text-muted">Chọn nhanh bất kỳ bài hát nào trong 903 bài để xem hợp âm, đổi thể loại, hoặc tạo bản phối mới</span>
          </div>
        </div>

        <div class="mgr-picker-search-wrap">
          <input type="text" id="mgr-picker-input" placeholder="🔍 Gõ số hoặc tên bài (VD: 001, 105, Hỡi Thánh Vương, Phục Sinh...)" autocomplete="off">
          <div id="mgr-picker-results" class="mgr-picker-results hidden"></div>
        </div>
      </div>

      <!-- SELECTED SONG INSPECTOR PANEL (Mở ra khi một bài được chọn) -->
      <div id="mgr-selected-song-panel" class="mgr-selected-song-panel hidden">
        <div class="song-panel-header">
          <div class="song-panel-info">
            <div class="song-panel-badges">
              <span class="key-badge" id="sel-song-num">#001</span>
              <span class="key-badge" id="sel-song-key">G</span>
              <span class="cat-badge" id="sel-song-cat-badge">🎵 Thánh Ca</span>
            </div>
            <h2 class="song-panel-title" id="sel-song-title">HỠI THÁNH VƯƠNG, KÍP NGỰ LAI</h2>
            <div class="song-panel-meta text-xs text-muted">
              Mã bài: <code id="sel-song-id">thanh-ca-001</code> • File XML: <span id="sel-song-xml">storage/Thanh ca/001...xml</span>
            </div>
          </div>

          <div class="song-panel-actions">
            <!-- Category Changer -->
            <div class="category-changer-wrap">
              <label class="text-xs text-muted">Thể Loại:</label>
              <select id="sel-song-cat-select" class="mgr-input mgr-btn-xs" style="width: auto;">
                <!-- Populated dynamically -->
              </select>
              <button id="btn-save-song-cat" class="mgr-btn mgr-btn-ghost mgr-btn-xs" title="Lưu thay đổi thể loại">💾 Lưu</button>
            </div>

            <button id="btn-sel-song-fork" class="mgr-btn mgr-btn-primary mgr-btn-sm">
              ✨ Tạo Bản Phối / Hợp Âm Mới
            </button>
            <a id="btn-sel-song-sheet" href="../" target="_blank" class="mgr-btn mgr-btn-ghost mgr-btn-sm">
              📖 Mở Sheet Reader
            </a>
            <a id="btn-sel-song-live" href="../live-band/" target="_blank" class="mgr-btn mgr-btn-ghost mgr-btn-sm">
              🎯 Mở Live Band
            </a>
            <button id="btn-close-song-panel" class="mgr-modal-close" title="Đóng bảng chi tiết">✕</button>
          </div>
        </div>

        <!-- Chord Sets for Selected Song -->
        <div class="song-panel-chords-section">
          <h4 class="section-subtitle">🎸 Các Bộ Hợp Âm Đang Có Của Bài Hát Này:</h4>
          <div class="song-panel-chords-grid" id="sel-song-chords-grid">
            <!-- Rendered via JS -->
          </div>
        </div>

        <!-- MusicXML Fork Versions for Selected Song -->
        <div class="song-panel-chords-section" style="margin-top: 1.25rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 0.5rem;">
            <h4 class="section-subtitle" style="margin:0;">📑 Các Phiên Bản MusicXML Đã Fork:</h4>
            <button id="btn-sel-song-xml-fork" class="mgr-btn mgr-btn-ghost mgr-btn-xs">
              + Nhân Bản MusicXML (SATB)
            </button>
          </div>
          <div class="song-panel-chords-grid" id="sel-song-versions-grid">
            <!-- Rendered via JS -->
          </div>
        </div>
      </div>
    </section>
