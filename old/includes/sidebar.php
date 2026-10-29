<!-- ===== SIDEBAR (FLAT COMPACT) ===== -->
<aside id="sidebar" class="sidebar">
  <div class="sidebar-header">
    <div class="logo">
      <span class="logo-text">SHEETAPP</span>
      <span id="library-count" class="library-count-badge">...</span>
    </div>
    <div class="sidebar-header-actions">
      <button id="btn-auth" class="sidebar-auth-btn" title="Đăng nhập / Phân quyền">
        <span id="auth-username" class="sidebar-auth-name">Khách</span>
        <span id="auth-role-badge" class="sidebar-role-badge hidden"></span>
      </button>
      <button id="btn-toggle-sidebar" class="icon-btn" title="Ẩn/Hiện danh mục">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
      </button>
    </div>
  </div>

  <!-- SIDEBAR TABS -->
  <div class="sidebar-tabs" id="sidebar-tabs">
    <button class="sidebar-tab active" id="sidebar-tab-lib" data-tab="library">Mục Lục</button>
    <button class="sidebar-tab" data-tab="setlist">Setlist</button>
    <button class="sidebar-tab" id="sidebar-tab-favs" data-tab="favorites" title="Bài hát yêu thích">★ Đã lưu</button>
  </div>

  <!-- FLAT CATEGORY BAR + COMPACT SEARCH & KEY FILTER -->
  <div class="sidebar-search">
    <div id="category-flat-list" class="category-flat-list" aria-label="Danh mục Thánh Ca"></div>
    <div class="filter-row-compact">
      <select id="category-filter" class="form-input select-toolbar" title="Lọc theo danh mục" aria-label="Lọc theo danh mục bài hát">
        <option value="">Tất cả danh mục</option>
      </select>
      <select id="key-filter" class="form-input select-toolbar key-filter-select" title="Lọc theo Tông nhạc" aria-label="Lọc theo tông nhạc">
        <option value="">Tông: Tất cả</option>
      </select>
    </div>
    <div class="search-box">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="search-icon"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
      <label for="search-input" class="library-search-label">Tìm bài hát trong thư viện</label>
      <input id="search-input" type="text" placeholder="Số bài, tên bài (/ để tìm)..." autocomplete="off">
      <button id="btn-search-lyrics" class="btn-lyric-mode" title="Tìm theo Lời bài hát">Lời</button>
    </div>
  </div>

  <div class="sidebar-actions">
    <button id="btn-pwa-install" class="btn btn-sm w-full hidden" title="Cài đặt ứng dụng">
      Cài Đặt Offline
    </button>
    <input type="file" id="omr-file-input" class="hidden" accept=".jpg,.jpeg,.png,.pdf">
    <button id="btn-omr-upload" class="btn btn-sm w-full hidden" title="Upload ảnh/PDF để AI nhận diện thành MusicXML">
      + Upload Nhạc (AI)
    </button>
    <button id="btn-admin-console" class="btn btn-sm w-full hidden">
      Quản Trị
    </button>
    <button id="btn-create-setlist" class="btn btn-primary btn-sm w-full hidden">
      + Tạo Setlist Mới
    </button>
  </div>

  <!-- QUICK JUMP (1-LINE COMPACT) -->
  <div class="quick-jump" id="quick-jump">
    <div class="quick-jump-btns" id="quick-jump-btns"></div>
  </div>

  <div class="song-list-container">
    <!-- TAB CONTENT: LIBRARY -->
    <div id="tab-content-library" class="sidebar-tab-content">
      <div id="recently-viewed-section" style="display:none; border-bottom:1px solid var(--border); padding:2px 0;"></div>
      <div id="song-list" class="song-list">
        <div class="empty-state">
          <p>Đang tải danh mục...</p>
        </div>
      </div>
    </div>

    <!-- TAB CONTENT: SETLIST -->
    <div id="tab-content-setlist" class="sidebar-tab-content hidden">
      <div id="setlist-list" class="song-list">
        <div class="empty-state">
          <p>Chưa có Setlist nào</p>
          <small>Chỉ Quản trị mới có thể tạo</small>
        </div>
      </div>
      <div id="setlist-detail" class="song-list hidden setlist-detail-view">
        <div class="setlist-detail-header">
          <button id="btn-back-setlists" class="icon-btn" title="Quay lại">
            <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <h3 id="setlist-detail-title" class="setlist-detail-title">Setlist</h3>
          <button id="btn-share-setlist" class="icon-btn-xs" title="Copy link chương trình (người nhận cần đăng nhập để xem)"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="3" r="2"/><circle cx="3" cy="7" r="2"/><circle cx="11" cy="11" r="2"/><line x1="4.7" y1="6" x2="9.3" y2="4"/><line x1="4.7" y1="8" x2="9.3" y2="10"/></svg></button>
          <button id="btn-play-setlist" class="btn btn-sm btn-primary">Phát</button>
        </div>
        <div id="setlist-items" class="setlist-items"></div>
        <div id="setlist-add-container" class="setlist-add-container hidden">
          <input type="text" id="setlist-search-song-input" class="form-input w-full" placeholder="Gõ tìm bài hát để thêm..." autocomplete="off">
          <div id="setlist-search-results" class="song-list hidden setlist-search-results"></div>
        </div>
      </div>
    </div>
  </div>
</aside>
