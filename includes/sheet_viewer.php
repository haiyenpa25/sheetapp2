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

  <!-- HANDS-FREE EDGE-TAP & CENTER-TAP ZONES FOR GIG / BAND PLAYING (Ticket L1-5) -->
  <div id="edge-tap-prev" class="edge-tap-zone edge-tap-left" title="Chạm mép trái: Lật trang trước (PageUp)"></div>
  <div id="edge-tap-center" class="edge-tap-center" title="Chạm giữa màn hình: Hiện/Ẩn bảng điều khiển HUD"></div>
  <div id="edge-tap-next" class="edge-tap-zone edge-tap-right" title="Chạm mép phải: Lật trang sau (PageDown)"></div>

  <!-- FLOATING GIG HUD (Xuất hiện khi ở chế độ Biểu Diễn) -->
  <div id="gig-floating-hud" class="gig-floating-hud">
    <div class="gig-hud-info" onclick="App?.toggleSidebar?.()" title="Bấm đổi bài">
      <span id="gig-hud-title" class="gig-hud-title">Bài hát</span>
      <span id="gig-hud-key" class="gig-hud-key">--</span>
    </div>
    <!-- Dòng chương trình lễ trong HUD Sân khấu (Ticket L3-1) -->
    <div id="gig-hud-setlist-row" class="gig-hud-setlist-row hidden" title="Chương trình lễ">
      <span id="gig-sp-pos" class="gig-sp-pos">--/--</span>
      <span id="gig-sp-next" class="gig-sp-next">Tiếp: --</span>
      <div class="gig-sp-navs">
        <button id="btn-gig-sp-prev" class="btn-gig-action btn-gig-sp-btn" title="Bài trước (◀)">◀</button>
        <button id="btn-gig-sp-next" class="btn-gig-action btn-gig-sp-btn" title="Bài tiếp theo (▶)">▶</button>
      </div>
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

      <!-- Nút Chuyển Khổ trong Biểu Diễn (Ticket L1-6 ⭐) -->
      <button id="btn-gig-verse" class="btn-gig-action btn-gig-verse hidden" title="Chuyển khổ hát (Phím V)">Khổ 1/1</button>

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

  <!-- FOLLOW LEADER BANNER (Dải trạng thái theo ca trưởng — Ticket L3-5) -->
  <div id="follow-leader-banner" class="follow-leader-banner hidden" role="status" aria-live="polite">
    <div class="fl-banner-inner">
      <div class="fl-banner-left">
        <span class="fl-pulse-dot" id="fl-pulse-dot" aria-hidden="true"></span>
        <span class="fl-banner-icon" aria-hidden="true">📡</span>
        <span id="fl-leader-status" class="fl-leader-status">
          <span id="fl-leader-name" class="fl-leader-name">Đang theo: Ca Trưởng</span>
          <span id="fl-room-code-tag" class="fl-room-code-tag">BAND-1234</span>
        </span>
      </div>
      <div class="fl-banner-actions">
        <button id="btn-follow-toggle-pause" class="btn-fl-pause" title="Tạm ngưng nhận đồng bộ từ ca trưởng">
          <span id="fl-pause-icon">⏸️</span>
          <span id="fl-pause-label">Tạm ngưng</span>
        </button>
        <button id="btn-follow-leave" class="btn-fl-leave" title="Rời khỏi phòng theo dõi" aria-label="Rời">&times;</button>
      </div>
    </div>
  </div>

  <!-- HOST QUICK CUES BAR (Thanh nhắc ban nhạc nhanh của Ca Trưởng — Ticket L3-6) -->
  <div id="host-quick-cues-bar" class="host-quick-cues-bar hidden" role="toolbar" aria-label="Thanh nhắc ban nhạc nhanh của Ca Trưởng">
    <div class="hqc-inner">
      <span class="hqc-label">👑 Nhắc Band:</span>
      <div class="hqc-chips">
        <button type="button" class="btn-cue-chip" data-cue="repeat" data-icon="🔁" data-text="Lặp Điệp Khúc" title="Gửi: Lặp Điệp Khúc">🔁 Lặp ĐK</button>
        <button type="button" class="btn-cue-chip" data-cue="slow" data-icon="⏳" data-text="Khổ cuối chậm" title="Gửi: Khổ cuối chậm">⏳ Chậm lại</button>
        <button type="button" class="btn-cue-chip" data-cue="key" data-icon="🎺" data-text="Lên tông (+1)" title="Gửi: Lên tông">🎺 Lên tông</button>
        <button type="button" class="btn-cue-chip" data-cue="ending" data-icon="🛑" data-text="Chuẩn bị kết" title="Gửi: Chuẩn bị kết">🛑 Kết</button>
        <button type="button" class="btn-cue-chip" data-cue="intro" data-icon="🎹" data-text="Dạo lại intro" title="Gửi: Dạo lại intro">🎹 Dạo lại</button>
      </div>
    </div>
  </div>

  <!-- LEADER NOTES BANNER (Dải vàng ghi chú ca trưởng — Ticket L3-3) -->
  <div id="leader-notes-banner" class="leader-notes-banner hidden" role="note" aria-label="Ghi chú ca trưởng">
    <div class="ln-banner-inner">
      <div class="ln-banner-left">
        <span class="ln-banner-icon" aria-hidden="true">📌</span>
        <strong class="ln-banner-badge">Ghi chú ca trưởng:</strong>
        <span id="leader-notes-text" class="ln-banner-text"></span>
      </div>
      <div class="ln-banner-actions">
        <button id="btn-toggle-leader-notes" class="btn-ln-toggle" title="Thu gọn / Mở rộng ghi chú" aria-expanded="true">
          <span id="ln-toggle-icon" class="ln-toggle-icon">▲</span>
          <span id="ln-toggle-label" class="ln-toggle-label">Thu gọn</span>
        </button>
        <button id="btn-close-leader-notes" class="btn-ln-close" title="Ẩn dải ghi chú" aria-label="Đóng">&times;</button>
      </div>
    </div>
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

  <!-- LITURGY CARD / NON-SONG PLACEHOLDER (Thẻ chờ phụng vụ — Ticket L3-4) -->
  <div id="liturgy-card" class="liturgy-card hidden" role="region" aria-label="Tiết mục phụng vụ">
    <div class="liturgy-card-inner">
      <div class="liturgy-card-icon" id="lc-icon" aria-hidden="true">🙏</div>
      <div class="liturgy-card-badge" id="lc-badge">CẦU NGUYỆN</div>
      <h2 class="liturgy-card-title" id="lc-title">Cầu Nguyện Khai Lễ</h2>
      
      <div class="liturgy-card-notes hidden" id="lc-notes-box">
        <span class="lc-notes-label">📌 Ghi chú ca trưởng:</span>
        <p class="lc-notes-text" id="lc-notes-text"></p>
      </div>

      <div class="liturgy-card-meta">
        <span class="lc-meta-item" id="lc-item-duration">⏱️ Thời lượng mục: 5 phút</span>
        <span class="lc-meta-divider">•</span>
        <span class="lc-meta-item" id="lc-total-duration">⏱️ Tổng thời lượng chương trình: 45 phút</span>
      </div>

      <div class="liturgy-card-actions">
        <button id="btn-lc-prev" class="btn btn-ghost btn-lc-btn" title="Mục trước (◀)">◀ Mục trước</button>
        <button id="btn-lc-next" class="btn btn-primary btn-lc-btn" title="Mục tiếp theo (▶)">Mục tiếp theo ▶</button>
      </div>
    </div>
  </div>

  <!-- HALF-PAGE DIVIDER (Ticket L1-9: Vạch chia nửa trang chuẩn forScore) -->
  <div id="half-page-divider" class="half-page-divider hidden" aria-hidden="true">
    <div class="half-page-divider-line"></div>
    <span class="half-page-divider-badge">Nửa Trang Kế Tiếp</span>
  </div>
</div>



