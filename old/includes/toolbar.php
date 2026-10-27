<!-- TOP TOOLBAR (M4-9b: Gộp toolbar + page-bar thành một hàng Lớp 1; phần còn lại vào ⋮) -->
<header class="toolbar" id="toolbar">
  <!-- MOBILE HAMBURGER (chỉ mobile, sidebar mở) -->
  <button id="btn-open-sidebar" class="icon-btn mobile-only" title="Mở danh sách bài hát">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
  </button>

  <div class="toolbar-left">
    <!-- SONG INFO: ẩn khỏi toolbar, JS vẫn đọc được -->
    <div class="song-info" id="song-info" style="display:none;">
      <span id="song-title" class="song-title">Chọn bài hát để bắt đầu</span>
      <span id="song-key" class="song-key-badge" style="display:none;"></span>
    </div>
  </div>

  <div class="toolbar-controls" id="toolbar-controls">

    <!-- ① TÔNG (Lớp 1) -->
    <div class="control-group layer1-transpose-group" role="group" aria-label="Điều chỉnh tông">
      <div class="transpose-controls">
        <button id="btn-transpose-down" class="icon-btn transpose-btn" title="Hạ 1 cung (←)" disabled>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        <span id="transpose-display" class="transpose-display" role="button" tabindex="0" title="Chạm để về tông gốc (0)">0</span>
        <button id="btn-transpose-up" class="icon-btn transpose-btn" title="Tăng 1 cung (→)" disabled>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="18 15 12 9 6 15"/></svg>
        </button>
      </div>
      <button id="btn-transpose-reset" class="btn btn-ghost btn-xs pb-reset-btn"
              title="Về tông gốc của bài (phím 0)" disabled>↺ Gốc</button>
    </div>

    <!-- ② BỘ HỢP ÂM (Lớp 1) -->
    <div class="control-group layer1-chord-group" role="group" aria-label="Bộ hợp âm">
      <select id="chord-set-selector" class="chord-set-select" disabled onchange="ChordCanvas.switchSet(this.value)" title="Chọn bộ hợp âm">
        <option value="default">TLH (gốc)</option>
      </select>
      <span id="chord-set-count" class="chord-set-count" style="font-size:.7rem;color:var(--text-muted,#9ca3af);white-space:nowrap;display:none;"></span>
    </div>

    <!-- ③ LỜI NHẠC (Lớp 1 — M4-9b hiện lại nút Lời) -->
    <button id="btn-lyric-view" class="btn btn-ghost btn-sm" title="Chuyển đổi Bản nhạc ↔ Lời & Hợp âm">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
      <span class="btn-text">Lời</span>
    </button>

    <div class="toolbar-spacer" style="flex:1 1 auto;min-width:2px;"></div>

    <!-- ④ BÀI TRƯỚC / SAU (Lớp 1) -->
    <div class="nav-arrows" id="nav-arrows">
      <button id="btn-prev-song" class="icon-btn" title="Bài trước (↑)" disabled>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <button id="btn-next-song" class="icon-btn" title="Bài tiếp theo (↓)" disabled>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
      </button>
    </div>

    <!-- ⑤ TOÀN MÀN HÌNH (Lớp 1) -->
    <div class="control-group">
      <button id="btn-fullscreen" class="icon-btn" title="Toàn màn hình (F)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
      </button>
    </div>

    <!-- ⑥ MENU ⋮ (Lớp 2 — chứa đầy đủ công cụ phụ và listener) -->
    <div class="control-group" id="more-options-group" style="position: relative;">
      <button id="btn-more-options" class="btn btn-ghost btn-sm" title="Tuỳ chọn thêm (⋮)" aria-label="Tuỳ chọn thêm">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
        <span class="btn-text">Tuỳ Chọn</span>
      </button>

      <div class="dropdown-menu hidden" id="main-dropdown-menu">
        <div class="classic-menu-section-title">Hiển thị</div>

        <div class="classic-menu-row">
          <span class="classic-menu-label">Thu phóng</span>
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

        <div class="classic-menu-row">
          <span class="classic-menu-label">Capo</span>
          <div id="capo-wrap" class="capo-wrap">
            <label for="capo-select" class="capo-label">Ngăn</label>
            <select id="capo-select" class="capo-select" title="Chọn ngăn kẹp Capo">
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
          <span id="capo-badge" class="capo-badge hidden" style="display:none">Capo 0</span>
        </div>

        <div id="menu-page-nav" class="classic-menu-row" role="group" aria-label="Điều hướng trang">
          <span class="classic-menu-label">Trang</span>
          <div class="classic-page-nav-controls" style="display:inline-flex;align-items:center;gap:4px;">
            <button id="menu-btn-page-prev" class="icon-btn pb-nav-btn" title="Trang trước (PageUp)" onclick="window.PageNav?.goToPrev?.()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <span id="menu-page-indicator" class="page-indicator" style="min-width:44px;text-align:center;font-size:.78rem;font-weight:600;">1 / 1</span>
            <button id="menu-btn-page-next" class="icon-btn pb-nav-btn" title="Trang sau (PageDown)" onclick="window.PageNav?.goToNext?.()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
        </div>
        <div class="classic-menu-row-end-anchor" style="display:none">
        </div>

        <div class="classic-menu-inline-group">
          <button id="btn-compact-mode" class="btn btn-ghost btn-sm btn-menu-item" title="Bật/Tắt chế độ Gọn Nhẹ">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 14h6v6H4zm10 0h6v6h-6zM4 4h6v6H4zm10 0h6v6h-6z"/><line x1="14" y1="14" x2="20" y2="20"/><line x1="20" y1="14" x2="14" y2="20"/></svg>
            <span>Chế độ Gọn Nhẹ</span>
          </button>
          <button id="btn-compact-settings" class="icon-btn" title="Tuỳ chỉnh Gọn Nhẹ">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          </button>
        </div>

        <button id="btn-dark-mode" class="btn btn-ghost btn-sm btn-menu-item" title="Chế độ Sáng / Tối (D)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
          <span>Giao diện Sáng / Tối</span>
        </button>
        <button id="btn-dark-toggle" class="icon-btn" style="display:none;" aria-hidden="true" title="Chế độ tối/sáng (D)"></button>

        <div class="classic-menu-section-title">Tập luyện</div>

        <div class="classic-menu-inline-group">
          <button id="btn-play-audio" class="btn btn-ghost btn-sm btn-menu-item" disabled title="Phát nhạc đệm (Audio)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3" fill="currentColor"/></svg>
            <span>Phát nhạc đệm</span>
          </button>
          <button id="btn-stop-audio" class="btn btn-ghost btn-sm btn-stop hidden" title="Dừng phát nhạc">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="6" width="12" height="12" fill="currentColor"/></svg>
            <span>Dừng</span>
          </button>
          <button id="btn-audio-settings" class="icon-btn" disabled title="Tùy chỉnh Âm thanh & Bè phát">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/>
              <line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/>
              <line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/>
              <line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/>
              <line x1="17" y1="16" x2="23" y2="16"/>
            </svg>
          </button>
        </div>

        <div class="classic-menu-inline-group">
          <button id="btn-auto-scroll" class="btn btn-ghost btn-sm btn-menu-item" disabled title="Tự động cuộn bản nhạc">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>
            <span>Tự động cuộn</span>
          </button>
          <select id="scroll-speed" class="select-toolbar select-scroll-speed" disabled title="Tốc độ cuộn">
            <option value="1">🐢</option>
            <option value="2" selected>🚶</option>
            <option value="3">🚴</option>
            <option value="4">⚡</option>
          </select>
        </div>

        <button id="btn-toolbar-metronome" class="btn btn-ghost btn-sm btn-menu-item" disabled title="Mở bộ Giữ Nhịp & Tạo Tempo (Metronome)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="metronome-icon-pulse">
            <path d="M12 2L2 22h20L12 2z" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M12 5l-2 10" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="12" cy="18" r="1.5" fill="currentColor"/>
          </svg>
          <span>Gõ Nhịp (Metronome)</span>
        </button>

        <button id="btn-mixer" class="btn btn-ghost btn-sm btn-menu-item" disabled title="Bật/Tắt nhạc cụ">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>
          <span>Mixer Nhạc Cụ</span>
        </button>

        <button id="menu-instrument-annotations" class="btn btn-ghost btn-sm btn-menu-item" title="Ghi chú nhạc cụ trên bản nhạc">
          <span>🎸</span>
          <span>Ghi chú nhạc cụ</span>
        </button>

        <div class="classic-menu-section-title">Hợp âm &amp; Buổi lễ</div>

        <button id="menu-chord-highlight" class="btn btn-ghost btn-sm btn-menu-item" title="Nổi bật hợp âm (H)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          <span>Nổi bật hợp âm</span>
        </button>

        <button id="menu-chord-notation" class="btn btn-ghost btn-sm btn-menu-item" title="Hệ ký hiệu hợp âm: Chuẩn / La Mã / Nashville">
          <span>🔤</span>
          <span>Hệ ký hiệu hợp âm</span>
        </button>

        <button id="menu-add-chord" class="btn btn-ghost btn-sm btn-menu-item" title="Bật/tắt nhập hợp âm (phím C)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          <span>Nhập / Sửa hợp âm</span>
        </button>

        <button id="menu-new-chord-set" class="btn btn-ghost btn-sm btn-menu-item" title="Tạo bộ hợp âm mới">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          <span>Tạo bộ hợp âm mới</span>
        </button>

        <button id="menu-delete-chord-set" class="btn btn-ghost btn-sm btn-menu-item hidden" style="color:var(--danger,#dc2626);" title="Xoá bộ hợp âm đang chọn" onclick="window.ChordCanvas?.confirmDeleteSet?.()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M9 6V4h6v2"/></svg>
          <span>Xoá bộ hợp âm</span>
        </button>

        <button id="menu-clear-all-chords" class="btn btn-ghost btn-sm btn-menu-item hidden" style="color:var(--danger,#dc2626);" title="Xoá toàn bộ hợp âm trong bộ này" onclick="if(confirm('Xoá TOÀN BỘ hợp âm trong hồ sơ này?')) window.ChordCanvas?.clearAllChords?.()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
          <span>Xoá tất cả hợp âm</span>
        </button>
        <button style="display:none" aria-hidden="true">
          <svg style="display:none"><line/></svg>
          <span style="display:none"></span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          <span>Tạo bộ hợp âm mới</span>
        </button>

        <button id="menu-pin-song" class="btn btn-ghost btn-sm btn-menu-item" title="Ghim bài này lên thanh Ghim nhanh (phím G)">
          <span>📌</span>
          <span>Ghim bài hát</span>
        </button>

        <button id="btn-session-panel" class="btn btn-ghost btn-sm btn-menu-item" disabled title="Nhật ký biểu diễn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
          <span>Nhật ký biểu diễn</span>
        </button>

        <button id="btn-print" class="btn btn-ghost btn-sm btn-menu-item" disabled title="In sheet nhạc">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
          <span>In Bản Nhạc</span>
        </button>

        <div class="classic-menu-section-title">Hệ thống</div>

        <button id="btn-help" class="btn btn-ghost btn-sm btn-menu-item" title="Hướng dẫn sử dụng (?)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <span>Hướng dẫn sử dụng</span>
        </button>

        <a id="btn-switch-new-ui" href="<?= $baseHref ?? '../' ?>" class="btn btn-primary btn-sm btn-menu-item"
           onclick="if (window.URLState) { event.preventDefault(); window.location.href = URLState.interfaceUrl(false); }"
           title="Chuyển sang Giao diện Mới (SheetApp 2.0 đầy đủ)"
           style="text-decoration:none;display:inline-flex;align-items:center;gap:.35rem;font-weight:600;white-space:nowrap;">
          <span>✨ Giao Diện Mới</span>
        </a>
      </div>

      <!-- AUDIO SETTINGS PANEL DROPDOWN -->
      <div id="audio-settings-panel" class="dropdown-menu audio-settings-panel hidden">
        <div class="audio-panel-row">
          <span class="audio-panel-label">Bè Phát:</span>
          <div class="voice-selector" id="voice-selector" role="group" aria-label="Chọn bè phát">
            <button class="voice-btn voice-s" data-voice="soprano"
                    title="Soprano — Nữ Cao&#10;Giai điệu chính (Khóa Sol, nốt trên)" disabled>S</button>
            <button class="voice-btn voice-a" data-voice="alto"
                    title="Alto — Nữ Trầm&#10;Hòa âm (Khóa Sol, nốt dưới)" disabled>A</button>
            <button class="voice-btn voice-t" data-voice="tenor"
                    title="Tenor — Nam Cao&#10;Dẫn âm (Khóa Fa, nốt trên)" disabled>T</button>
            <button class="voice-btn voice-b" data-voice="bass"
                    title="Bass — Nam Trầm&#10;Nền hòa âm (Khóa Fa, nốt dưới)" disabled>B</button>
            <button class="voice-btn voice-all active" data-voice="satb"
                    title="Hòa âm — Phát cả 4 bè cùng lúc" disabled>♪</button>
          </div>
        </div>

        <div class="audio-panel-row">
          <span class="audio-panel-label">Tốc Độ:</span>
          <select id="audio-speed" class="select-toolbar" disabled title="Tốc độ phát">
            <option value="0.5">0.5×</option>
            <option value="0.75">0.75×</option>
            <option value="1.0" selected>1.0×</option>
            <option value="1.25">1.25×</option>
            <option value="1.5">1.5×</option>
          </select>
        </div>

        <div class="audio-panel-row">
          <span class="audio-panel-label">Âm Sắc:</span>
          <select id="audio-timbre" class="select-toolbar" disabled title="Chọn âm sắc nhạc cụ phát bè">
            <option value="piano" selected>🎹 Piano</option>
            <option value="organ">⛪ Đàn Ống (Organ)</option>
            <option value="choir">🎶 Hợp Xướng (Choir)</option>
          </select>
        </div>

        <div class="audio-panel-row">
          <span class="audio-panel-label">Âm Lượng:</span>
          <label class="volume-label" title="Âm lượng">
            <span class="volume-icon">🔊</span>
            <input id="audio-volume" type="range" class="audio-volume-slider"
                   min="-20" max="24" step="1" value="18" disabled
                   title="Âm lượng (+18 dB mặc định — kéo sang phải để to hơn)">
          </label>
        </div>

        <div class="audio-panel-row" style="border-top: 1px solid var(--border); padding-top: .6rem; margin-top: .2rem;">
          <span class="audio-panel-label">Gõ Nhịp (Metronome):</span>
          <button id="btn-metronome" class="btn btn-ghost btn-xs" title="Bật/Tắt máy gõ nhịp giữ nhịp cho trống">🔊 Bật</button>
        </div>
      </div>

      <select id="audio-playback-mode" style="display:none" aria-hidden="true">
        <option value="satb" selected>SATB</option>
        <option value="soprano">Soprano</option>
        <option value="alto">Alto</option>
        <option value="tenor">Tenor</option>
        <option value="bass">Bass</option>
      </select>

      <!-- Compact Settings Dropdown -->
      <div id="compact-settings-panel" class="dropdown-menu compact-settings-panel hidden">
        <label class="check-row">
          <input type="checkbox" id="chk-compact-bass" checked> Ẩn Khóa Fa
        </label>
        <label class="check-row">
          <input type="checkbox" id="chk-compact-voices" checked> Ẩn Bè Phụ
        </label>
        <label class="check-row">
          <input type="checkbox" id="chk-compact-chordnotes" checked> Ẩn Nốt Dưới (Nốt Chùm)
        </label>
        <label class="check-row divider-top">
          <input type="checkbox" id="chk-compact-texts" checked> Tối giản Nhạc Sĩ/Tác Giả
        </label>
        <label class="check-row">
          <input type="checkbox" id="chk-compact-title"> Ẩn Tên Bài Hát
        </label>
      </div>
    </div>

    <script>
      document.addEventListener('DOMContentLoaded', function() {
        const btnOptions = document.getElementById('btn-more-options');
        const menuOptions = document.getElementById('main-dropdown-menu');
        if (!btnOptions || !menuOptions) return;

        function positionMenu() {
          const r = btnOptions.getBoundingClientRect();
          const w = menuOptions.offsetWidth || 240;
          let left = r.right - w;
          if (left < 8) left = 8;
          if (left + w > window.innerWidth - 8) left = window.innerWidth - w - 8;
          menuOptions.style.cssText = `position:fixed; top:${r.bottom + 4}px; left:${left}px; right:auto; z-index:99999; max-height:calc(100vh - ${r.bottom + 16}px); overflow-y:auto;`;
        }

        btnOptions.addEventListener('click', (e) => {
          e.stopPropagation();
          const isHidden = menuOptions.classList.contains('hidden');
          if (isHidden) {
            if (menuOptions.parentNode !== document.body) document.body.appendChild(menuOptions);
            menuOptions.classList.remove('hidden');
            positionMenu();
          } else {
            menuOptions.classList.add('hidden');
          }
        });

        document.addEventListener('click', (e) => {
          if (!btnOptions.contains(e.target) && !menuOptions.contains(e.target)) {
            menuOptions.classList.add('hidden');
          }
        });
        window.addEventListener('resize', () => menuOptions.classList.add('hidden'));
        menuOptions.querySelectorAll('.btn-menu-item').forEach(btn => {
          btn.addEventListener('click', () => menuOptions.classList.add('hidden'));
        });
      });
    </script>

  </div>
</header>
