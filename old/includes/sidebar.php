<!-- ===== SIDEBAR ===== -->
<aside id="sidebar" class="sidebar">
  <div class="sidebar-header">
    <div class="logo">
      <span class="logo-icon">🎵</span>
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
      <button id="btn-toggle-sidebar" class="icon-btn" title="Ẩn/Hiện sidebar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
      </button>
    </div>
  </div>


  <!-- SIDEBAR TABS -->
  <div class="sidebar-tabs" id="sidebar-tabs">
    <button class="sidebar-tab active" id="sidebar-tab-lib" data-tab="library">Kho Nhac</button>
    <button class="sidebar-tab" data-tab="setlist">Setlists</button>
    <button class="sidebar-tab" id="sidebar-tab-favs" data-tab="favorites" title="Bai hat yeu thich">&#11088;</button>
  </div>

  <div class="sidebar-search">
    <div class="mt-half">
      <select id="category-filter" class="form-input w-full select-toolbar" style="height: 30px; border-color: var(--border);">
        <option value="">Tat ca danh muc</option>
      </select>
    </div>
    <div class="search-box" style="position:relative;">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="search-icon"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
      <input id="search-input" type="text" placeholder="Tim bai hat..." autocomplete="off">
      <button id="btn-search-lyrics" class="icon-btn-xs" title="Tim theo Loi bai hat" style="position:absolute;right:6px;top:50%;transform:translateY(-50%);font-size:.8rem;opacity:.55;padding:.2rem .4rem;border-radius:4px;border:1px solid var(--border);background:var(--bg-overlay);">&#127925;</button>
    </div>
  </div>

  <div class="sidebar-actions">
    <!-- PWA INSTALL BUTTON -->
    <button id="btn-pwa-install" class="btn btn-sm w-full hidden" style="background: linear-gradient(135deg, #10b981, #059669); color: #fff; border: none; margin-bottom: 0.5rem;" title="Cài đặt ứng dụng lên màn hình chính để dùng offline">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px; margin-right: 4px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      Cài Đặt Ngoại Tuyến (App)
    </button>

    <!-- OMR UPLOAD BUTTON -->
    <input type="file" id="omr-file-input" class="hidden" accept=".jpg,.jpeg,.png,.pdf">
    <button id="btn-omr-upload" class="btn btn-sm w-full hidden" style="background: linear-gradient(135deg, #2563eb, #1e40af); color: #fff; border: none; margin-bottom: 0.5rem;" title="Upload ảnh/PDF để AI nhận diện thành MusicXML">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
      Tạo / Upload Nhạc (AI)
    </button>
    
    <button id="btn-admin-console" class="btn btn-sm w-full hidden" style="background: linear-gradient(135deg, #1e293b, #334155); color: #fff; border: none;">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
      Ban Quan Tri
    </button>
    <button id="btn-create-setlist" class="btn btn-primary btn-sm w-full hidden">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      Tao Setlist Moi
    </button>
  </div>

  <!-- QUICK JUMP -->
  <div class="quick-jump" id="quick-jump">
    <span class="quick-jump-label">Nhay nhanh:</span>
    <div class="quick-jump-btns" id="quick-jump-btns"></div>
  </div>

  <div class="song-list-container">
    <!-- TAB CONTENT: LIBRARY -->
    <div id="tab-content-library" class="sidebar-tab-content">
      <!-- RECENTLY VIEWED -->
      <div id="recently-viewed-section" style="display:none; border-bottom:1px solid var(--border); padding:.4rem 0 .3rem;"></div>
      <div id="song-list" class="song-list">
        <div class="empty-state">
          <span class="empty-icon">🎶</span>
          <p>Chua co bai hat nao</p>
          <small>Nhan "Them Bai Hat" de import</small>
        </div>
      </div>
    </div>

    <!-- TAB CONTENT: SETLIST -->
    <div id="tab-content-setlist" class="sidebar-tab-content hidden">
      <div id="setlist-list" class="song-list">
        <div class="empty-state">
          <span class="empty-icon">📋</span>
          <p>Chua co Setlist nao</p>
          <small>Chi Quan tri moi co the tao</small>
        </div>
      </div>
      <div id="setlist-detail" class="song-list hidden setlist-detail-view">
        <div class="setlist-detail-header">
          <button id="btn-back-setlists" class="icon-btn" title="Quay lai">
            <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <h3 id="setlist-detail-title" class="setlist-detail-title">Setlist</h3>
          <button id="btn-play-setlist" class="btn btn-sm btn-primary">Phat</button>
        </div>
        <div id="setlist-items" class="setlist-items"></div>
        <div id="setlist-add-container" class="setlist-add-container hidden">
          <input type="text" id="setlist-search-song-input" class="form-input w-full" placeholder="Go tim bai hat de them..." autocomplete="off">
          <div id="setlist-search-results" class="song-list hidden setlist-search-results"></div>
        </div>
      </div>
    </div>
  </div>
</aside>
