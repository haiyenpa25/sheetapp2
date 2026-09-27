<!-- TOP TOOLBAR — UNIFIED PRO BAND TOOLBAR -->
<header class="toolbar unified-toolbar" id="toolbar">
  <!-- 1. CỤM BÀI HÁT (Bên trái: Hamburger + Tên bài + Tông gốc) -->
  <div class="toolbar-left" id="toolbar-left-group">
    <button id="btn-open-sidebar" class="icon-btn" title="Mở danh sách bài hát (903 bài) [Phím S]">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
    </button>
    <div class="song-info-pill" id="song-info" title="Bấm mở danh sách bài hát" onclick="App?.toggleSidebar?.()">
      <span id="song-title" class="song-title">Chọn bài hát...</span>
      <span id="song-key" class="song-key-badge" title="Tông gốc">--</span>
    </div>
    <button id="btn-song-info-popover" class="icon-btn-pill btn-song-info-popover" title="Xem chi tiết: Tông, BPM, Nhịp, Số ô nhịp, Phụng vụ (ⓘ)" aria-label="Chi tiết bài hát" style="margin-left: 2px;">
      <span style="font-weight: 800; font-size: 0.95rem; font-family: serif;">ⓘ</span>
    </button>
    <!-- Popover Chi Tiết Bài Hát (Ticket L1-3: Gộp thanh thông tin vào thanh công cụ) -->
    <div id="song-info-popover" class="song-info-popover hidden" role="dialog" aria-label="Thông tin chi tiết bài hát">
      <div class="si-popover-header">
        <span class="si-popover-title">THÔNG TIN BÀI HÁT</span>
        <button id="btn-close-song-info-popover" class="si-popover-close" title="Đóng">✕</button>
      </div>
      <div class="si-popover-body" id="si-popover-content">
        <div class="si-popover-row"><span class="si-popover-label">Tên bài:</span><span class="si-popover-value" id="si-pop-title">--</span></div>
        <div class="si-popover-row"><span class="si-popover-label">Tông gốc:</span><span class="si-popover-value" id="si-pop-key">--</span></div>
        <div class="si-popover-row"><span class="si-popover-label">Tông đang tập:</span><span class="si-popover-value" id="si-pop-practice-key">--</span></div>
        <div class="si-popover-row"><span class="si-popover-label">Nhịp / Phách:</span><span class="si-popover-value" id="si-pop-time">--</span></div>
        <div class="si-popover-row"><span class="si-popover-label">Tempo:</span><span class="si-popover-value" id="si-pop-tempo">--</span></div>
        <div class="si-popover-row"><span class="si-popover-label">Số ô nhịp:</span><span class="si-popover-value" id="si-pop-measures">--</span></div>
        <div class="si-popover-row"><span class="si-popover-label">Bộ hợp âm:</span><span class="si-popover-value" id="si-pop-chordset">--</span></div>
      </div>
    </div>
  </div>

  <!-- 2. CỤM ĐIỀU KHIỂN TRỌNG TÂM CHO BAN NHẠC (PRO BAND CONTROLS) -->
  <div class="toolbar-center band-controls" id="toolbar-controls">
    
    <!-- Cụm Dịch Tông (Transpose Pill) -->
    <div class="band-pill transpose-pill" role="group" aria-label="Điều chỉnh tông nhạc" title="Dịch giọng bài hát (Phím [ và ] )">
      <button id="btn-transpose-down" class="icon-btn-pill" title="Hạ 1 nửa cung (← hoặc Phím [ )" disabled>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      <span id="transpose-display" class="transpose-value" title="Số nửa cung đang dịch">0</span>
      <button id="btn-transpose-up" class="icon-btn-pill" title="Tăng 1 nửa cung (→ hoặc Phím ] )" disabled>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="18 15 12 9 6 15"/></svg>
      </button>
      <button id="btn-transpose-reset" class="btn-pill-reset" title="Về tông gốc của bài (phím 0)" disabled>Gốc</button>

      <!-- Capo (Chọn ngăn kẹp Capo & Gợi ý cho Guitar, Ticket L0-12) -->
      <div id="capo-wrap" class="capo-wrap">
        <label for="capo-select" class="capo-label">Capo</label>
        <select id="capo-select" class="capo-select" title="Chọn ngăn kẹp Capo (0-7)">
          <option value="0" selected>0</option><option value="1">1</option><option value="2">2</option>
          <option value="3">3</option><option value="4">4</option><option value="5">5</option>
          <option value="6">6</option><option value="7">7</option>
        </select>
        <span id="capo-hint" class="capo-hint"></span>
      </div>
      <span id="capo-badge" class="capo-badge" style="display:none">Capo 0</span>
    </div>

    <!-- Cụm Thu Phóng & Khóa Zoom (Zoom Pill) -->
    <div class="band-pill zoom-pill" role="group" aria-label="Thu phóng bản nhạc" title="Thu phóng bản nhạc (Zoom & Khóa View)">
      <button id="btn-zoom-out" class="icon-btn-pill" title="Thu nhỏ bản nhạc (−)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/></svg>
      </button>
      <select id="zoom-slider" class="select-zoom-pill" disabled title="Chọn tỷ lệ thu phóng">
        <option value="50">50%</option>
        <option value="65">65%</option>
        <option value="80">80%</option>
        <option value="90">90%</option>
        <option value="100" selected>100%</option>
        <option value="115">115%</option>
        <option value="130">130%</option>
        <option value="150">150%</option>
        <option value="175">175%</option>
        <option value="200">200%</option>
      </select>
      <button id="btn-zoom-in" class="icon-btn-pill" title="Phóng to bản nhạc (+)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      </button>
      <button id="btn-lock-zoom" class="icon-btn-pill btn-lock-zoom" title="Khóa tỷ lệ zoom (khi đổi bài giữ nguyên)">
        <span class="lock-icon">🔓</span>
      </button>
      <span id="zoom-value-label" style="display:none">100%</span>
    </div>

    <!-- Cụm Bản Phối Hợp Âm (Chord Set Pill) -->
    <div class="band-pill chord-set-pill" id="chord-set-bar" role="group" aria-label="Chọn bản phối hợp âm" title="Bản phối hợp âm">
      <span class="pill-icon" style="font-size: 0.95rem;">🎸</span>
      <select id="chord-set-selector" class="chord-set-select" disabled onchange="ChordCanvas.handleSelectChange ? ChordCanvas.handleSelectChange(this.value) : ChordCanvas.switchSet(this.value)" title="Chọn bản phối hợp âm">
        <option value="HD" selected>⭐ HD (Mặc định)</option>
        <option value="default">TLH (gốc)</option>
      </select>
      <span id="chord-set-count" class="chord-set-count"></span>

      <!-- Nút Điền Hợp Âm — toggle chế độ điền/sửa hợp âm trực tiếp trên sheet -->
      <button id="btn-add-chord-mode-bar" class="btn-chord-edit-pill btn-chord-edit" title="Điền / Sửa hợp âm trực tiếp trên sheet (phím C)" disabled>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="chord-edit-icon"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        <span class="chord-edit-text">Điền HÂ</span>
      </button>

      <!-- Nút Tạo bộ hợp âm mới -->
      <button id="btn-new-chord-set" class="icon-btn-pill" title="Tạo bản phối mới" onclick="ChordCanvas.showNewSetModal()">
        <span style="font-size: 0.85rem;">➕</span>
      </button>

      <!-- Giữ lại các ID ẩn để JS cũ hoạt động 100% -->
      <button id="btn-chord-highlight" style="display:none;" disabled></button>
      <button id="btn-delete-chord-set" style="display:none;" onclick="ChordCanvas.confirmDeleteSet()"></button>
      <button id="btn-clear-all-chords" style="display:none;"></button>
      <button id="btn-cancel-add-chord" style="display:none;"></button>
    </div>

    <!-- Cụm Preset Hiển Thị Hợp Âm (Aa) (Ticket L1-2) -->
    <button id="btn-chord-preset" class="band-pill btn-chord-preset" title="Preset hiển thị hợp âm: Chuẩn / Sân khấu lớn / Tương phản cao (nút Aa)" aria-label="Preset hiển thị hợp âm" style="cursor:pointer; padding: 0 8px;">
      <span class="preset-icon" style="font-weight: 800; font-size: 0.95rem; letter-spacing: -0.5px;">Aa</span>
      <span id="chord-preset-label" class="preset-label" style="font-size: 0.72rem; margin-left: 2px; opacity: 0.85;">Chuẩn</span>
    </button>

    <!-- Cụm Chọn Khổ (Ticket L1-6 ⭐: Tất cả khổ / Một khổ / Trải khổ) -->
    <div class="band-pill verse-pill hidden" id="verse-pill" role="group" aria-label="Chọn khổ hát" title="Chế độ hiển thị khổ">
      <button id="btn-verse-mode" class="btn-verse-mode" title="Đổi chế độ: Tất cả khổ ↔ Một khổ ↔ Trải khổ (Phím V)">
        <span class="verse-icon" style="font-size: 0.88rem;">📖</span>
        <span id="verse-mode-label" class="verse-mode-label" style="font-size: 0.76rem; font-weight: 700;">Tất cả khổ</span>
      </button>
      <div id="verse-nav-controls" class="verse-nav-controls hidden" style="display: inline-flex; align-items: center; gap: 2px;">
        <button id="btn-verse-prev" class="icon-btn-pill btn-verse-nav" title="Khổ trước (Shift+V)">◀</button>
        <span id="verse-indicator" class="verse-indicator" title="Khổ hiện tại / Tổng số khổ" style="font-size: 0.74rem; font-weight: 800; font-family: var(--font-mono); min-width: 26px; text-align: center;">1/1</span>
        <button id="btn-verse-next" class="icon-btn-pill btn-verse-nav" title="Khổ tiếp theo (V)">▶</button>
      </div>
    </div>

    <!-- Cụm Xem Band (Lời + Hợp âm chữ) / Bản Nhạc (Ticket L0-4 & L1-7) -->
    <button id="btn-band-toggle" class="band-pill btn-toggle-view btn-band-toggle" title="Chuyển chế độ: Band (Lời & Hợp âm chữ) ↔ Bản Nhạc">
      <span class="view-icon">▶</span>
      <span class="view-text">Band</span>
    </button>
    <button id="btn-toggle-view" style="display:none;" aria-hidden="true"></button>

    <!-- Cụm Cuộn Trang & Gõ Nhịp (Scroll & Tempo Pill) -->
    <div class="band-pill scroll-pill">
      <button id="btn-auto-scroll" class="btn-pill-scroll" disabled title="Tự động cuộn bản nhạc (Phím Space)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>
        <span class="btn-text">Cuộn</span>
      </button>
      <select id="scroll-speed" class="select-scroll-speed" disabled title="Tốc độ cuộn">
        <option value="1" selected>1×</option>
        <option value="2">2×</option>
        <option value="3">3×</option>
        <option value="4">4×</option>
      </select>
      <button id="btn-toolbar-metronome" class="icon-btn-pill" disabled title="Mở bộ Giữ Nhịp & Tempo (Metronome)">
        <span class="metronome-icon-pulse">⚡</span>
      </button>
    </div>
  </div>

  <!-- 3. CỤM PHẢI: BIỂU DIỄN & MENU CÔNG CỤ -->
  <div class="toolbar-right">
    <!-- NÚT TÀI KHOẢN & PHÂN QUYỀN NHẠC CÔNG (USER PILL) -->
    <button id="btn-toolbar-auth" class="btn-toolbar-user" title="Đăng nhập / Phân quyền nhạc công">
      <span class="user-pill-icon">👤</span>
      <span id="toolbar-auth-name" class="user-pill-name">Khách</span>
      <span id="toolbar-auth-badge" class="user-pill-role hidden"></span>
    </button>

    <!-- NÚT SÂN KHẤU / BIỂU DIỄN (BAND GIG MODE) -->
    <button id="btn-fullscreen" class="btn-gig-mode" title="Vào chế độ Biểu Diễn Toàn Màn Hình (Phím F)">
      <span class="gig-icon">⚡</span>
      <span class="gig-text">Biểu Diễn</span>
    </button>

    <!-- NÚT CHUYỂN BÀI TRƯỚC / SAU -->
    <div class="nav-arrows" id="nav-arrows">
      <button id="btn-prev-song" class="icon-btn" title="Bài trước (↑)" disabled>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <button id="btn-next-song" class="icon-btn" title="Bài tiếp theo (↓)" disabled>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
      </button>
    </div>

    <!-- MENU CÔNG CỤ & CÀI ĐẶT MỞ RỘNG (GOM TOÀN BỘ TÍNH NĂNG PHỤ) -->
    <div class="control-group" id="more-options-group" style="position: relative;">
      <button id="btn-more-options" class="icon-btn" title="Menu Công Cụ & Cài Đặt">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
      </button>

      <div class="dropdown-menu hidden" id="main-dropdown-menu">
        <!-- NHÓM 1: ÂM THANH & TÁCH BÈ SATB -->
        <div class="menu-section-header">ÂM THANH & BÈ SATB</div>
        <div class="menu-audio-actions">
          <button id="btn-play-audio" class="btn btn-ghost btn-xs btn-menu-item" disabled title="Phát nhạc đệm bè">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;"><polygon points="5 3 19 12 5 21 5 3" fill="currentColor"/></svg>
            <span class="btn-text">Phát Bè</span>
          </button>
          <button id="btn-stop-audio" class="btn btn-ghost btn-xs btn-stop hidden" title="Dừng phát nhạc">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;"><rect x="6" y="6" width="12" height="12" fill="currentColor"/></svg>
            <span class="btn-text">Dừng</span>
          </button>
          <button id="btn-audio-settings" class="icon-btn-xs" disabled title="Tùy chỉnh bè phát">⚙️</button>
        </div>

        <div id="audio-settings-panel" class="audio-settings-panel hidden" style="padding: 6px 10px; border-bottom: 1px solid var(--border);">
          <div class="audio-panel-row">
            <span class="audio-panel-label">Bè:</span>
            <div class="voice-selector" id="voice-selector" role="group" aria-label="Chọn bè">
              <button class="voice-btn voice-s" data-voice="soprano" data-touch-allow="true" disabled>S</button>
              <button class="voice-btn voice-a" data-voice="alto" data-touch-allow="true" disabled>A</button>
              <button class="voice-btn voice-t" data-voice="tenor" data-touch-allow="true" disabled>T</button>
              <button class="voice-btn voice-b" data-voice="bass" data-touch-allow="true" disabled>B</button>
              <button class="voice-btn voice-all active" data-voice="satb" data-touch-allow="true" disabled>♪</button>
            </div>
          </div>
          <div class="audio-panel-row">
            <span class="audio-panel-label">Tốc độ:</span>
            <select id="audio-speed" class="select-toolbar" data-touch-allow="true" disabled>
              <option value="0.5">0.5×</option><option value="0.75">0.75×</option><option value="1.0" selected>1.0×</option><option value="1.25">1.25×</option><option value="1.5">1.5×</option>
            </select>
          </div>
          <div class="audio-panel-row">
            <span class="audio-panel-label">Âm lượng:</span>
            <input id="audio-volume" type="range" class="audio-volume-slider" min="-20" max="24" step="1" value="18" data-touch-allow="true" disabled>
          </div>
          <button id="btn-metronome" style="display:none"></button>
          <select id="audio-playback-mode" style="display:none"><option value="satb">SATB</option></select>
        </div>

        <button id="btn-mixer" class="btn btn-ghost btn-sm btn-menu-item" disabled title="Bật/Tắt nhạc cụ">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>
          Bộ Trộn Âm (Mixer)
        </button>

        <!-- NHÓM 2: HIỂN THỊ & GỌN NHẸ -->
        <div class="menu-section-header">HIỂN THỊ & GỌN NHẸ</div>

        <button id="btn-compact-mode" class="btn btn-ghost btn-sm btn-menu-item" title="Bật/Tắt chế độ Gọn Nhẹ">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 14h6v6H4zm10 0h6v6h-6zM4 4h6v6H4zm10 0h6v6h-6z"/></svg>
          Tối Giản Bản Nhạc
        </button>
        <button id="btn-compact-settings" style="display:none"></button>
        <div id="compact-settings-panel" class="compact-settings-panel hidden" style="padding: 4px 10px; font-size: 0.76rem;">
          <label class="check-row"><input type="checkbox" id="chk-compact-bass" checked> Ẩn Khóa Fa</label>
          <label class="check-row"><input type="checkbox" id="chk-compact-voices" checked> Ẩn Bè Phụ</label>
          <label class="check-row"><input type="checkbox" id="chk-compact-chordnotes" checked> Ẩn Nốt Chùm</label>
          <label class="check-row"><input type="checkbox" id="chk-compact-lyrics"> Ẩn Lời Ca (Nhạc cụ)</label>
          <label class="check-row"><input type="checkbox" id="chk-compact-measures"> Ẩn Số Ô Nhịp</label>
          <label class="check-row"><input type="checkbox" id="chk-compact-texts" checked> Tối giản Tác Giả</label>
          <label class="check-row"><input type="checkbox" id="chk-compact-title"> Ẩn Tên Bài Hát</label>
        </div>

        <button id="btn-lyric-view" class="btn btn-ghost btn-sm btn-menu-item" title="Xem lời nhạc hợp âm dạng chữ">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          Xem Lời & Hợp Âm Chữ
        </button>

        <!-- NHÓM 3: BẢN PHỐI & BIÊN TẬP -->
        <div class="menu-section-header">BẢN PHỐI & BIÊN TẬP</div>
        <button id="btn-menu-chord-edit" class="btn btn-ghost btn-sm btn-menu-item" title="Điền / Chỉnh sửa hợp âm trực tiếp trên sheet (phím C)" onclick="window.ChordCanvas?.toggleAddMode?.()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Điền Hợp Âm Trực Tiếp (phím C)
        </button>
        <button id="btn-song-versions" class="btn btn-ghost btn-sm btn-menu-item" disabled title="Chọn phiên bản MusicXML">
          <span style="font-size: 0.85rem;">👥</span>
          <span id="btn-version-label">Bản Gốc</span>
        </button>
        <div id="dropdown-song-versions" class="dropdown-menu hidden" style="min-width: 240px; padding: 4px 0;">
          <div id="version-list-items"></div>
          <button id="btn-create-new-version" style="display:none;"></button>
        </div>

        <button id="btn-toolbar-editor" class="btn btn-ghost btn-sm btn-menu-item" title="Mở Editor nốt 4 bè SATB" onclick="(function(){ var sid = window.App?.getCurrentSongId?.(); window.location.href = sid ? ('/editor/?song=' + sid) : '/editor/'; })()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Sửa Sheet (Editor SATB)
        </button>
        <button id="btn-menu-open-editor" style="display:none;"></button>

        <?php $bHref = $baseHref ?? '/'; ?>
        <a href="<?= $bHref ?>manager/#tab-users" data-target="/manager/#tab-users" target="_blank" class="btn btn-ghost btn-sm btn-menu-item" title="Quản lý thành viên ban nhạc & bộ hợp âm nhạc công">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          <span>Ban Nhạc & Thành Viên</span>
        </a>

        <a href="<?= $bHref ?>manager/" target="_blank" class="btn btn-ghost btn-sm btn-menu-item" title="Cổng Quản Lý Kho Nhạc & Hợp Âm">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          <span>Quản Lý Kho Nhạc (/manager/)</span>
        </a>

        <!-- NHÓM PHỤ THU VÀO TỪ TOOLBAR (< 1300px, Ticket L0-4) -->
        <div class="menu-section-header menu-section-compact-only">ĐIỀU KHIỂN BẢN NHẠC</div>
        <div class="menu-compact-controls menu-section-compact-only" style="padding: 6px 10px; border-bottom: 1px solid var(--border);">
          <div class="audio-panel-row" style="margin-bottom: 6px;">
            <span class="audio-panel-label">Thu phóng:</span>
            <div style="display:inline-flex; align-items:center; gap:4px;">
              <button id="btn-menu-zoom-out" class="icon-btn-xs" title="Thu nhỏ">−</button>
              <span id="menu-zoom-val" style="font-size:0.75rem;font-weight:700;min-width:36px;text-align:center;">100%</span>
              <button id="btn-menu-zoom-in" class="icon-btn-xs" title="Phóng to">+</button>
              <button id="btn-menu-lock-zoom" class="icon-btn-xs" title="Khóa tỷ lệ zoom">🔓</button>
            </div>
          </div>
          <div class="audio-panel-row" style="margin-bottom: 6px;">
            <span class="audio-panel-label">Tự cuộn:</span>
            <button id="btn-menu-auto-scroll" class="btn btn-ghost btn-xs btn-menu-item" style="padding:2px 8px;margin:0;">
              <span class="btn-text">Cuộn</span>
            </button>
            <select id="menu-scroll-speed" class="select-toolbar" style="font-size:0.72rem;padding:1px 4px;margin-left:6px;">
              <option value="1" selected>1×</option><option value="2">2×</option><option value="3">3×</option><option value="4">4×</option>
            </select>
          </div>
          <div class="audio-panel-row" style="margin-bottom: 6px;">
            <span class="audio-panel-label">Kẹp Capo:</span>
            <select id="menu-capo-select" class="select-toolbar" style="font-size:0.72rem;padding:1px 4px;margin-left:6px;" title="Chọn ngăn kẹp Capo">
              <option value="0" selected>0 (Không kẹp)</option>
              <option value="1">Ngăn 1</option><option value="2">Ngăn 2</option>
              <option value="3">Ngăn 3</option><option value="4">Ngăn 4</option>
              <option value="5">Ngăn 5</option><option value="6">Ngăn 6</option>
              <option value="7">Ngăn 7</option>
            </select>
          </div>
          <div class="audio-panel-row">
            <span class="audio-panel-label">Giữ nhịp:</span>
            <button id="btn-menu-metronome" class="btn btn-ghost btn-xs btn-menu-item" style="padding:2px 8px;margin:0;">
              <span>⚡ Metronome</span>
            </button>
          </div>
        </div>

        <button id="btn-menu-auth" class="btn btn-ghost btn-sm btn-menu-item menu-section-compact-only" title="Đăng nhập / Phân quyền">
          <span>👤 Tài Khoản / Đăng Nhập</span>
        </button>

        <!-- NHÓM 4: HỆ THỐNG & IN ẤN -->
        <div class="menu-section-header">HỆ THỐNG & IN ẤN</div>
        <button id="btn-print" class="btn btn-ghost btn-sm btn-menu-item" disabled title="In sheet nhạc">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
          In Bản Nhạc
        </button>
        <button id="btn-dark-toggle" class="btn btn-ghost btn-sm btn-menu-item" title="Đổi chế độ Sáng / Tối (D)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
          Chế Độ Sáng / Tối
        </button>
        <button id="btn-dark-mode" style="display:none"></button>
        <button id="btn-session-panel" style="display:none"></button>
        <button id="btn-live-sync" style="display:none"></button>
        <span id="live-sync-badge" style="display:none"></span>

        <button id="btn-help" class="btn btn-ghost btn-sm btn-menu-item" title="Hướng dẫn sử dụng (?)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          Hướng Dẫn Sử Dụng
        </button>
      </div>
    </div>
</header>

<!-- MOBILE BOTTOM THUMB BAR (Ticket L1-8: Thanh điều khiển cạnh dưới cho ngón cái) -->
<nav class="mobile-thumb-bar" id="mobile-thumb-bar" aria-label="Thanh điều khiển nhanh cho điện thoại">
  <div class="mobile-thumb-group mobile-transpose-group" role="group" aria-label="Dịch giọng">
    <button id="btn-mobile-transpose-down" class="btn-thumb-action" title="Hạ 1 nửa cung" aria-label="Hạ tông">−</button>
    <button id="mobile-transpose-display" class="btn-thumb-tone" title="Tông hiện tại (chạm để về tông gốc)">--</button>
    <button id="btn-mobile-transpose-up" class="btn-thumb-action" title="Tăng 1 nửa cung" aria-label="Tăng tông">+</button>
  </div>

  <div class="mobile-thumb-group mobile-chordset-group" role="group" aria-label="Bộ hợp âm">
    <button id="btn-mobile-chordset" class="btn-thumb-chordset" title="Chọn bản phối hợp âm">
      <span class="thumb-icon">🎸</span>
      <span id="mobile-chordset-label" class="thumb-label">HD</span>
    </button>
  </div>

  <div class="mobile-thumb-group mobile-view-group" role="group" aria-label="Chế độ xem">
    <button id="btn-mobile-view-toggle" class="btn-thumb-view" title="Chuyển chế độ Band ↔ Bản Nhạc">
      <span id="mobile-view-icon" class="thumb-icon">▶</span>
      <span id="mobile-view-label" class="thumb-label">Band</span>
    </button>
  </div>

  <div class="mobile-thumb-group mobile-gig-group" role="group" aria-label="Biểu diễn">
    <button id="btn-mobile-gig" class="btn-thumb-gig" title="Chế độ Biểu Diễn sân khấu" aria-label="Biểu diễn">
      <span class="thumb-icon">⚡</span>
    </button>
  </div>
</nav>

<script>
  /* More Options Dropdown Position & Event handling */
  document.addEventListener('DOMContentLoaded', function() {
    const btnOptions = document.getElementById('btn-more-options');
    const menuOptions = document.getElementById('main-dropdown-menu');
    if (btnOptions && menuOptions) {
      function positionMenu() {
        const r = btnOptions.getBoundingClientRect();
        const w = menuOptions.offsetWidth || 230;
        let left = r.right - w;
        if (left < 8) left = 8;
        if (left + w > window.innerWidth - 8) left = window.innerWidth - w - 8;
        menuOptions.style.cssText = `position:fixed; top:${r.bottom + 6}px; left:${left}px; right:auto; z-index:99999;`;
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

      // Đóng khi chọn một mục trong menu (Ticket L0-6)
      menuOptions.addEventListener('click', (e) => {
        const item = e.target.closest('.btn-menu-item, a');
        if (item) {
          if (!item.closest('.menu-compact-controls') && item.id !== 'btn-audio-settings') {
            menuOptions.classList.add('hidden');
          }
        }
      });

      // Đóng khi chạm/click ra ngoài hoặc bấm Escape (Ticket L0-6)
      const handleOutside = (e) => {
        if (!btnOptions.contains(e.target) && !menuOptions.contains(e.target)) {
          menuOptions.classList.add('hidden');
        }
      };
      document.addEventListener('click', handleOutside);
      document.addEventListener('pointerdown', handleOutside);
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') menuOptions.classList.add('hidden');
      });
      window.addEventListener('scroll', () => menuOptions.classList.add('hidden'), { passive: true });
      window.addEventListener('resize', () => menuOptions.classList.add('hidden'));
    }

    /* Band / Bản Nhạc Toggle Button (btn-band-toggle / btn-toggle-view) */
    const btnBandToggle = document.getElementById('btn-band-toggle') || document.getElementById('btn-toggle-view');
    const btnLyric = document.getElementById('btn-lyric-view');
    if (btnBandToggle && btnLyric) {
      btnBandToggle.addEventListener('click', () => btnLyric.click());
      const lyricContainer = document.getElementById('lyric-view-container');
      if (lyricContainer) {
        new MutationObserver(() => {
          const isLyric = !lyricContainer.classList.contains('hidden');
          btnBandToggle.classList.toggle('active', isLyric);
          const txt = btnBandToggle.querySelector('.view-text') || btnBandToggle.querySelector('.band-toggle-text');
          if (txt) txt.textContent = isLyric ? 'Nhạc' : 'Band';
          btnBandToggle.title = isLyric ? 'Quay lại Bản Nhạc' : 'Chuyển sang chế độ Band (Lời + Hợp âm chữ)';
        }).observe(lyricContainer, { attributes: true, attributeFilter: ['class'] });
      }
    }

    /* Menu Compact Controls Handlers */
    document.getElementById('btn-menu-zoom-out')?.addEventListener('click', () => {
      document.getElementById('btn-zoom-out')?.click();
      const cur = document.getElementById('zoom-slider')?.value || '100';
      const label = document.getElementById('menu-zoom-val');
      if (label) label.textContent = cur + '%';
    });
    document.getElementById('btn-menu-zoom-in')?.addEventListener('click', () => {
      document.getElementById('btn-zoom-in')?.click();
      const cur = document.getElementById('zoom-slider')?.value || '100';
      const label = document.getElementById('menu-zoom-val');
      if (label) label.textContent = cur + '%';
    });
    document.getElementById('btn-menu-lock-zoom')?.addEventListener('click', () => {
      document.getElementById('btn-lock-zoom')?.click();
      const isLocked = localStorage.getItem('sheetapp_zoom_locked') === 'true';
      const btn = document.getElementById('btn-menu-lock-zoom');
      if (btn) btn.textContent = isLocked ? '🔒' : '🔓';
    });
    document.getElementById('btn-menu-auto-scroll')?.addEventListener('click', () => {
      document.getElementById('btn-auto-scroll')?.click();
    });
    document.getElementById('menu-scroll-speed')?.addEventListener('change', (e) => {
      const sp = document.getElementById('scroll-speed');
      if (sp) { sp.value = e.target.value; sp.dispatchEvent(new Event('change')); }
    });
    document.getElementById('btn-menu-metronome')?.addEventListener('click', () => {
      document.getElementById('btn-toolbar-metronome')?.click();
    });
    document.getElementById('btn-menu-auth')?.addEventListener('click', () => {
      document.getElementById('btn-toolbar-auth')?.click();
    });
  });
</script>
