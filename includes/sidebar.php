<!-- ===== SIDEBAR ===== -->
<aside id="sidebar" class="sidebar">
  <div class="sidebar-header">
    <div class="logo">
      <span class="logo-icon"><?= icon('music') ?></span>
      <span class="logo-text">SheetApp</span>
      <span id="library-count" class="library-count-badge">...</span>
    </div>
    <div class="sidebar-header-actions">
      <!-- AUTH BUTTON — trong sidebar -->
      <button id="btn-auth" class="sidebar-auth-btn" title="Đăng nhập / Phân quyền">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        <span id="auth-username" class="sidebar-auth-name">Khách</span>
        <span id="auth-role-badge" class="sidebar-role-badge hidden"></span>
      </button>
      <button id="btn-toggle-sidebar" class="icon-btn btn-close-sidebar" title="Đóng danh sách bài hát (Esc)" aria-label="Đóng danh sách bài hát">
        <?= icon('x') ?>
      </button>
    </div>
  </div>


  <!-- SIDEBAR TABS -->
  <div class="sidebar-tabs" id="sidebar-tabs">
    <button class="sidebar-tab active" id="sidebar-tab-lib" data-tab="library">Kho Nhạc</button>
    <button class="sidebar-tab" data-tab="setlist">Setlists</button>
    <button class="sidebar-tab" id="sidebar-tab-favs" data-tab="favorites" title="Bài hát yêu thích"><?= icon('star') ?></button>
  </div>

  <div class="sidebar-search">
    <div class="search-box sidebar-search-box">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="search-icon"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
      <input id="search-input" type="text" placeholder="Tìm bài hát..." autocomplete="off">
      <div class="sidebar-search-actions">
        <button id="btn-quick-numpad" class="btn-quick-numpad" title="Bàn phím số nhanh (#)" aria-label="Mở bàn phím số nhanh">#</button>
        <button id="btn-search-lyrics" class="icon-btn-xs btn-search-lyrics" title="Tìm theo lời bài hát"><?= icon('music') ?></button>
      </div>
    </div>

    <!-- Hàng điều khiển: Sắp xếp + Nút gom bộ lọc Lọc (Ticket L2-3) -->
    <div class="mt-half sidebar-controls-row">
      <select id="sort-filter" class="form-input select-toolbar sort-filter-select" title="Sắp xếp bài hát" aria-label="Sắp xếp danh sách bài hát">
        <option value="num" selected>STT HTTLVN</option>
        <option value="title">Tên (A-Z)</option>
        <option value="key">Tông gốc</option>
      </select>
      <button id="btn-filter-toggle" class="btn btn-sm btn-filter-toggle" aria-expanded="false" aria-controls="sidebar-filters-panel" aria-label="Gom bộ lọc bài hát" title="Mở bộ lọc">
        <span><?= icon('filter') ?> Lọc</span>
        <span id="filter-active-badge" class="filter-active-badge hidden">0</span>
      </button>
    </div>

    <!-- PANEL GOM BỘ LỌC (TỰ ẨN KHI KHÔNG CÓ DỮ LIỆU - TICKET L2-3) -->
    <div id="sidebar-filters-panel" class="sidebar-filters-panel hidden">
      <div id="category-filter-wrap" class="sidebar-filter-item">
        <label for="category-filter" class="sidebar-filter-label">Danh mục:</label>
        <select id="category-filter" class="form-input select-toolbar sidebar-filter-select" aria-label="Lọc theo danh mục bài hát">
          <option value="">Tất cả danh mục</option>
        </select>
      </div>

      <div id="season-filter-wrap" class="sidebar-filter-item">
        <label for="season-filter" class="sidebar-filter-label">Mùa Lễ:</label>
        <select id="season-filter" class="form-input select-toolbar sidebar-filter-select" title="Lọc theo Mùa Lễ" aria-label="Lọc theo mùa lễ">
          <option value="">Tất cả Mùa Lễ</option>
        </select>
      </div>

      <div id="theme-filter-wrap" class="sidebar-filter-item">
        <label for="theme-filter" class="sidebar-filter-label">Chủ đề:</label>
        <select id="theme-filter" class="form-input select-toolbar sidebar-filter-select" title="Lọc theo Chủ Đề Thờ Phượng" aria-label="Lọc theo chủ đề thờ phượng">
          <option value="">Tất cả Chủ Đề</option>
        </select>
      </div>

      <div id="filter-empty-hint" class="filter-empty-hint hidden">
        Toàn bộ bài hát thuộc Thánh ca (không có bộ lọc phụ)
      </div>

      <button id="btn-clear-filters" class="btn btn-xs btn-clear-filters" title="Đặt lại bộ lọc">
        Xóa bộ lọc
      </button>
    </div>
  </div>

  <div class="sidebar-actions">
    <!-- PWA INSTALL BUTTON -->
    <button id="btn-pwa-install" class="btn btn-sm w-full btn-pwa-install-sidebar hidden" title="Cài đặt ứng dụng lên màn hình chính để dùng offline">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-14"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      Cài Đặt Ngoại Tuyến (App)
    </button>

    <!-- OMR UPLOAD BUTTON -->
    <button id="btn-omr-upload" class="btn btn-sm w-full btn-omr-sidebar hidden" title="Upload ảnh/PDF để AI nhận diện thành MusicXML">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
      Tạo / Upload Nhạc (AI)
    </button>
    
    <button id="btn-admin-console" class="btn btn-sm w-full btn-admin-sidebar hidden">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
      Ban Quản Trị
    </button>
    <button id="btn-create-setlist" class="btn btn-primary btn-sm w-full hidden">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      Tạo Setlist Mới
    </button>
  </div>

  <!-- QUICK JUMP -->
  <div class="quick-jump" id="quick-jump">
    <span class="quick-jump-label">Nhảy nhanh:</span>
    <div class="quick-jump-btns" id="quick-jump-btns"></div>
  </div>

  <div class="song-list-container">
    <!-- TAB CONTENT: LIBRARY -->
    <div id="tab-content-library" class="sidebar-tab-content">
      <!-- 1. CHƯƠNG TRÌNH HÔM NAY / SẮP TỚI (TICKET L2-4) -->
      <div id="upcoming-setlist-section" class="upcoming-setlist-section hidden"></div>
      <!-- 2. GẦN ĐÂY -->
      <div id="recently-viewed-section" class="recently-viewed-section hidden"></div>
      <!-- 3. YÊU THÍCH (TICKET L2-4) -->
      <div id="quick-favorites-section" class="quick-favorites-section hidden"></div>
      <div id="song-list" class="song-list">
        <div class="empty-state">
          <span class="empty-icon"><?= icon('music') ?></span>
          <p>Chưa có bài hát nào</p>
          <small>Nhấn "Thêm Bài Hát" để nhập bài</small>
        </div>
      </div>
    </div>

    <!-- TAB CONTENT: SETLIST -->
    <div id="tab-content-setlist" class="sidebar-tab-content hidden">
      <div id="setlist-list" class="song-list">
        <div class="empty-state">
          <span class="empty-icon"><?= icon('file-text') ?></span>
          <p>Chưa có Setlist nào</p>
          <small>Chỉ Quản trị mới có thể tạo</small>
        </div>
      </div>
      <div id="setlist-detail" class="song-list hidden setlist-detail-view">
        <div class="setlist-detail-header">
          <button id="btn-back-setlists" class="icon-btn" title="Quay lại">
            <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <h3 id="setlist-detail-title" class="setlist-detail-title">Setlist</h3>
          <div class="d-flex items-center gap-1">
            <button id="btn-print-setlist" class="icon-btn-xs" title="In Chương Trình Biểu Diễn A4"><?= icon('printer') ?></button>
            <button id="btn-copy-setlist-slide" class="icon-btn-xs" title="Copy Danh Sách Cho Slide Màn Hình"><?= icon('copy') ?></button>
            <button id="btn-play-setlist" class="btn btn-sm btn-primary">Phát</button>
          </div>
        </div>

        <div id="setlist-items" class="setlist-items"></div>
        <div id="setlist-add-container" class="setlist-add-container hidden">
          <input type="text" id="setlist-search-song-input" class="form-input w-full" placeholder="Gõ tìm bài hát để thêm..." autocomplete="off">
          <div id="setlist-search-results" class="song-list hidden setlist-search-results"></div>
        </div>
      </div>
    </div>
  </div>

  <!-- TIỆN ÍCH PHỤ TRỢ (Ẩn hoàn toàn bằng d-none theo Ticket R1-8; bảo lưu anchor $bHref cho Ticket L0-14) -->
  <div class="sidebar-footer-tools d-none" aria-hidden="true">
    <div class="d-flex gap-2">
      <?php $bHref = $baseHref ?? '/'; ?>
      <a href="<?= $bHref ?>learn/" class="sidebar-mini-link sidebar-mini-learn d-none"></a>
      <a href="<?= $bHref ?>live-band/" class="sidebar-mini-link sidebar-mini-live d-none"></a>
      <a href="<?= $bHref ?>manager/" class="sidebar-mini-link sidebar-mini-mgr d-none"></a>
    </div>
  </div>
</aside>
