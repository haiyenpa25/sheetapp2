<!-- SHEET VIEWER -->
<div class="sheet-viewer-wrapper" id="sheet-viewer-wrapper">
  <!-- WELCOME SCREEN -->
  <div id="welcome-screen" class="welcome-screen">
    <div class="welcome-content">
      <div class="welcome-icon">🎼</div>
      <h2>Chào mừng đến SheetApp</h2>
      <p>Hiển thị thánh ca tương tác với khả năng dịch giọng và ghi chú hợp âm</p>
      <div class="welcome-features">
        <div class="feature-item">
          <span class="feat-icon">🎵</span>
          <div>
            <strong>Hiển thị Sheet Nhạc</strong>
            <small>Render MusicXML sắc nét qua OSMD</small>
          </div>
        </div>
        <div class="feature-item">
          <span class="feat-icon">🎹</span>
          <div>
            <strong>Dịch Giọng Tức Thì</strong>
            <small>Tăng/giảm tông, hợp âm tự động theo</small>
          </div>
        </div>
        <div class="feature-item">
          <span class="feat-icon">✏️</span>
          <div>
            <strong>Chỉnh Hợp Âm</strong>
            <small>Click vào hợp âm để thay đổi</small>
          </div>
        </div>
        <div class="feature-item">
          <span class="feat-icon">📋</span>
          <div>
            <strong>Nhật Ký Biểu Diễn</strong>
            <small>Lưu lịch sử mỗi buổi tập</small>
          </div>
        </div>
      </div>
      <button id="btn-import-welcome" class="btn btn-primary btn-lg mt-2">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        Import Bài Đầu Tiên
      </button>
    </div>
  </div>

  <!-- SKELETON LOADING — hiện trong khi OSMD đang render -->
  <div id="loading-screen" class="loading-screen hidden" aria-label="Đang tải sheet nhạc" role="status">
    <div class="skeleton-sheet" aria-hidden="true">
      <!-- Title skeleton -->
      <div class="skeleton-title">
        <div class="skeleton-bar w-40 h-6 mx-auto"></div>
        <div class="skeleton-bar w-24 h-4 mx-auto mt-2"></div>
      </div>
      <!-- Staff lines skeleton x3 -->
      <div class="skeleton-staff-row">
        <div class="skeleton-clef"></div>
        <div class="skeleton-lines">
          <div class="skeleton-bar w-full h-px"></div>
          <div class="skeleton-bar w-full h-px mt-3"></div>
          <div class="skeleton-bar w-full h-px mt-3"></div>
          <div class="skeleton-bar w-full h-px mt-3"></div>
          <div class="skeleton-bar w-full h-px mt-3"></div>
        </div>
        <div class="skeleton-notes">
          <div class="skeleton-note"></div>
          <div class="skeleton-note delay-1"></div>
          <div class="skeleton-note delay-2"></div>
          <div class="skeleton-note delay-3"></div>
          <div class="skeleton-note delay-1"></div>
          <div class="skeleton-note delay-2"></div>
        </div>
      </div>
      <div class="skeleton-staff-row mt-8">
        <div class="skeleton-clef"></div>
        <div class="skeleton-lines">
          <div class="skeleton-bar w-full h-px"></div>
          <div class="skeleton-bar w-full h-px mt-3"></div>
          <div class="skeleton-bar w-full h-px mt-3"></div>
          <div class="skeleton-bar w-full h-px mt-3"></div>
          <div class="skeleton-bar w-full h-px mt-3"></div>
        </div>
        <div class="skeleton-notes">
          <div class="skeleton-note delay-2"></div>
          <div class="skeleton-note delay-3"></div>
          <div class="skeleton-note"></div>
          <div class="skeleton-note delay-1"></div>
          <div class="skeleton-note delay-3"></div>
          <div class="skeleton-note delay-2"></div>
        </div>
      </div>
    </div>
    <p id="loading-text" class="skeleton-loading-text">Đang tải sheet nhạc...</p>
  </div>

  <!-- DUMMY HIDDEN PAGE BAR (Để JS cũ không bị lỗi khi tìm element) -->
  <div id="page-bar" class="page-bar hidden" style="display:none !important;" aria-hidden="true">
    <span id="page-indicator" style="display:none;">1 / 1</span>
    <button id="btn-page-prev" style="display:none;"></button>
    <button id="btn-page-next" style="display:none;"></button>
    <button id="btn-perf-notes" style="display:none;"></button>
    <button id="btn-add-chord-mode" style="display:none;"></button>
    <span id="add-chord-hint" style="display:none;"></span>
    <button id="btn-add-annotate-mode" style="display:none;"></button>
    <span id="add-annotate-hint" style="display:none;"></span>
  </div>

  <!-- HANDS-FREE EDGE-TAP ZONES FOR GIG / BAND PLAYING -->
  <div id="edge-tap-prev" class="edge-tap-zone edge-tap-left" title="Chạm mép trái: Lật trang trước (PageUp)"></div>
  <div id="edge-tap-next" class="edge-tap-zone edge-tap-right" title="Chạm mép phải: Lật trang sau (PageDown)"></div>

  <!-- FLOATING GIG HUD (Xuất hiện khi ở chế độ Biểu Diễn) -->
  <div id="gig-floating-hud" class="gig-floating-hud">
    <div class="gig-hud-info" onclick="App?.toggleSidebar?.()" title="Bấm đổi bài">
      <span id="gig-hud-title" class="gig-hud-title">Bài hát</span>
      <span id="gig-hud-key" class="gig-hud-key">--</span>
    </div>
    <div class="gig-hud-actions">
      <!-- Cụm Dịch Tông -->
      <button id="btn-gig-trans-down" class="btn-gig-action" title="Hạ 1 nửa cung (Phím [ )">−</button>
      <span id="gig-hud-trans" class="gig-hud-trans-val" title="Tông đang dịch">0</span>
      <button id="btn-gig-trans-up" class="btn-gig-action" title="Tăng 1 nửa cung (Phím ] )">+</button>
      
      <!-- Cụm Thu Phóng & Khóa Zoom (GIG MODE) -->
      <div class="gig-hud-zoom-wrap" title="Thu phóng & Khóa View trong Biểu Diễn">
        <button id="btn-gig-zoom-out" class="btn-gig-action" title="Thu nhỏ zoom">−</button>
        <span id="gig-hud-zoom" class="gig-hud-zoom-val" title="Tỷ lệ zoom hiện tại">100%</span>
        <button id="btn-gig-zoom-in" class="btn-gig-action" title="Phóng to zoom">+</button>
        <button id="btn-gig-lock-zoom" class="btn-gig-action btn-gig-lock" title="Khóa tỷ lệ zoom (khi đổi bài giữ nguyên)">🔓</button>
      </div>

      <button id="btn-gig-scroll-toggle" class="btn-gig-action btn-gig-scroll" title="Bật/Tắt cuộn (Space)">▼ Cuộn</button>
      <button id="btn-gig-exit" class="btn-gig-action btn-gig-exit" title="Thoát Biểu Diễn (Esc)">✕ Thoát</button>
    </div>
  </div>

  <!-- Floating Chord Edit Hint (ngoài page-bar) -->
  <div id="chord-edit-hint" class="chord-edit-hint hidden" role="status">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="hint-icon"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
    <span>Chế độ điền hợp âm — Click vào nốt nhạc (+) để thêm hoặc click hợp âm để sửa</span>
    <button class="hint-close-btn" onclick="window.ChordCanvas?.setAddMode(false)" title="Thoát chế độ điền hợp âm">✓ Hoàn tất</button>
  </div>

  <!-- Song Info Strip — Single Row Consolidate -->
  <div id="song-info-strip" class="song-info-strip si-hidden">
    <div id="si-inner" class="si-inner"></div>
    <button id="btn-song-info-toggle" class="si-toggle" title="Thu gọn / Mở rộng thông tin">▼</button>
  </div>

  <!-- OSMD CONTAINER -->
  <div id="sheet-area" class="sheet-area hidden">
    <div id="osmd-container" class="osmd-container"></div>
    <!-- Measure Progress Bar — Sprint E1 -->
    <div id="measure-progress-bar" class="measure-progress-bar" title="Click để nhảy đến vị trí">
      <div id="measure-progress-fill" class="measure-progress-fill"></div>
    </div>
    <div id="lyric-view-container" class="lyric-view-container hidden"></div>
  </div>
</div>



