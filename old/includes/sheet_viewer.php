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

  <!-- OSMD PAGE BAR -->
  <div id="page-bar" class="page-bar hidden">

    <!-- ① Transpose -->
    <div class="pb-group" role="group" aria-label="Điều chỉnh tông">
      <div class="transpose-controls">
        <button id="btn-transpose-down" class="icon-btn transpose-btn" title="Hạ 1 cung (←)" disabled>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        <span id="transpose-display" class="transpose-display">0</span>
        <button id="btn-transpose-up" class="icon-btn transpose-btn" title="Tăng 1 cung (→)" disabled>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="18 15 12 9 6 15"/></svg>
        </button>
      </div>
      <button id="btn-transpose-reset" class="btn btn-ghost btn-xs pb-reset-btn"
              title="Về tông gốc của bài (phím 0)" disabled>↺ Gốc</button>
      <!-- Capo dropdown -->
      <div id="capo-wrap" class="capo-wrap hidden">
        <label for="capo-select" class="capo-label">Capo</label>
        <select id="capo-select" class="capo-select" title="Chọn ngăn khẹp Capo">
          <option value="0">0</option>
          <option value="1">1</option>
          <option value="2">2</option>
          <option value="3">3</option>
          <option value="4">4</option>
          <option value="5">5</option>
          <option value="6">6</option>
          <option value="7">7</option>
        </select>
        <span id="capo-hint" class="capo-hint"></span>
      </div>
      <span id="capo-badge" class="capo-badge hidden" title="Đề xuất Capo tự động" style="display:none">Capo 0</span>
    </div>

    <!-- ② Zoom -->
    <div class="pb-group pb-sep" role="group" aria-label="Thu phóng">
      <div class="zoom-select-wrap">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="zoom-icon-sm"><circle cx="11" cy="11" r="8"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
        <select id="zoom-slider" class="zoom-select" disabled title="Chọn mức phóng to">
          <option value="10">10%</option><option value="15">15%</option>
          <option value="20">20%</option><option value="25">25%</option>
          <option value="30">30%</option><option value="35">35%</option>
          <option value="40">40%</option><option value="45">45%</option>
          <option value="50">50%</option><option value="60">60%</option>
          <option value="70">70%</option><option value="80">80%</option>
          <option value="90">90%</option><option value="100" selected>100%</option>
          <option value="110">110%</option><option value="120">120%</option>
          <option value="130">130%</option><option value="140">140%</option>
          <option value="150">150%</option><option value="160">160%</option>
          <option value="170">170%</option><option value="180">180%</option>
          <option value="190">190%</option><option value="200">200%</option>
        </select>
        <span id="zoom-value-label" style="display:none">100%</span>
      </div>
    </div>

    <!-- ③ Hợp Âm -->
    <div class="pb-group pb-group--chord pb-sep" id="chord-set-bar" role="group" aria-label="Quản lý hợp âm">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="pb-chord-icon" aria-hidden="true"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg>
      <select id="chord-set-selector" class="chord-set-select" disabled onchange="ChordCanvas.switchSet(this.value)">
        <option value="default">TLH (gốc)</option>
      </select>
      <span id="chord-set-count" class="chord-set-count" style="font-size:.7rem;color:var(--text-muted,#9ca3af);white-space:nowrap;"></span>
      <button id="btn-new-chord-set" class="btn btn-xs btn-ghost pb-btn-icon-text"
              title="Tạo bộ hợp âm mới" onclick="ChordCanvas.showNewSetModal()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        <span>Tạo</span>
      </button>
      <!-- Nút Nhập HÂ — toggle chế độ nhập hợp âm (visible) -->
      <button id="btn-add-chord-mode-bar" class="btn btn-xs btn-chord-edit" title="Bật/tắt nhập hợp âm (phím C)" disabled>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        <span>Nhập HÂ</span>
      </button>
      <!-- Nút Nổi Bật — toggle highlight mode badge tím -->
      <button id="btn-chord-highlight" class="btn btn-xs btn-ghost pb-btn-icon-text"
              title="Nổi bật hợp âm" disabled>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
        <span class="desktop-only">Nổi bật</span>
      </button>
      <!-- Xóa set — hiện khi set != default -->
      <button id="btn-delete-chord-set" class="btn btn-xs btn-danger" title="Xóa bộ hợp âm" style="display:none" onclick="ChordCanvas.confirmDeleteSet()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M9 6V4h6v2"/></svg>
      </button>
      <!-- Edit mode controls — hiện khi đang nhập -->
      <button id="btn-clear-all-chords" class="btn btn-xs btn-danger hidden"
              title="Xoá toàn bộ hợp âm"
              onclick="if(confirm('Xoá TOÀN BỘ hợp âm trong hồ sơ này?')) window.ChordCanvas.clearAllChords()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
        <span class="desktop-only">Xoá tất</span>
      </button>
      <button id="btn-cancel-add-chord" class="btn btn-xs btn-primary hidden">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
        <span class="desktop-only">Hoàn tất</span>
      </button>
    </div>

    <!-- Spacer đẩy Nav sang phải -->
    <!-- ⑤ Nhật Ký Biểu Diễn -->
    <button id="btn-perf-notes" class="btn btn-xs btn-ghost pb-btn-icon-text"
            title="Nhật ký — tông, BPM, ghi chú biểu diễn" disabled>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
      </svg>
      <span class="desktop-only">Nhật ký</span>
    </button>

    <div class="pb-spacer"></div>

    <!-- ④ Nav Trang -->
    <div class="pb-group" role="group" aria-label="Điều hướng trang">
      <button id="btn-page-prev" class="icon-btn pb-nav-btn" title="Trang trước (PageUp)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <span id="page-indicator" class="page-indicator">1 / 1</span>
      <button id="btn-page-next" class="icon-btn pb-nav-btn" title="Trang tiếp (PageDown)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
      </button>
    </div>

    <!-- Ẩn: backward compat cho FAB / JS cũ -->
    <button id="btn-add-chord-mode" style="display:none" aria-hidden="true"></button>
    <span id="add-chord-hint" style="display:none" aria-hidden="true"></span>
    <button id="btn-add-annotate-mode" style="display:none" aria-hidden="true"></button>
    <span id="add-annotate-hint" style="display:none" aria-hidden="true"></span>

  </div>

  <!-- Floating Chord Edit Hint (ngoài page-bar) -->
  <div id="chord-edit-hint" class="chord-edit-hint hidden" role="status">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="hint-icon"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
    <span>Chế độ nhập hợp âm — Click vào nốt nhạc để thêm hoặc sửa</span>
    <button class="hint-close-btn" onclick="window.ChordCanvas?.setAddMode(false)" title="Thoát chế độ nhập">Xong</button>
  </div>

  <!-- Song Info Strip — Sprint A1 -->
  <div id="song-info-strip" class="song-info-strip si-hidden">
    <div class="si-top-row">
      <div id="si-inner" class="si-inner"></div>
      <button id="btn-song-info-toggle" class="si-toggle" title="Thu gọn">▼</button>
    </div>
    <!-- Nội dung Nhật ký hiển thị inline -->
    <div id="si-notes-inline" class="si-notes-inline si-notes-hidden"></div>
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



