<!-- TOP TOOLBAR — UNIFIED PRO BAND TOOLBAR -->
<header class="toolbar unified-toolbar" id="toolbar">
  <!-- 1. CỤM BÀI HÁT (Bên trái: Hamburger + Tên bài + Tông gốc) -->
  <div class="toolbar-left" id="toolbar-left-group">
    <button id="btn-open-sidebar" class="icon-btn" title="Mở danh sách bài hát (903 bài) [Phím S]">
      <?= icon('menu') ?>
    </button>
    <div class="song-info-pill" id="song-info" title="Bấm mở danh sách bài hát" onclick="App?.toggleSidebar?.()">
      <span id="song-title" class="song-title">Chọn bài hát...</span>
      <span id="song-key" class="song-key-badge" title="Tông gốc">--</span>
    </div>
    <button id="btn-song-info-popover" class="icon-btn-pill btn-song-info-popover" title="Xem chi tiết: Tông, BPM, Nhịp, Số ô nhịp, Thờ phượng" aria-label="Chi tiết bài hát">
      <span class="song-info-popover-icon"><?= icon('info') ?></span>
    </button>
    <!-- Popover Chi Tiết Bài Hát (Ticket L1-3: Gộp thanh thông tin vào thanh công cụ) -->
    <div id="song-info-popover" class="song-info-popover hidden" role="dialog" aria-label="Thông tin chi tiết bài hát">
      <div class="si-popover-header">
        <span class="si-popover-title">THÔNG TIN BÀI HÁT</span>
        <button id="btn-close-song-info-popover" class="si-popover-close" title="Đóng"><?= icon('x') ?></button>
      </div>
      <div class="si-popover-body" id="si-popover-content">
        <div class="si-popover-row"><span class="si-popover-label">Tên bài:</span><span class="si-popover-value" id="si-pop-title">--</span></div>
        <div class="si-popover-row"><span class="si-popover-label">Tông gốc:</span><span class="si-popover-value" id="si-pop-key">--</span></div>
        <div class="si-popover-row"><span class="si-popover-label">Tông đang tập:</span><span class="si-popover-value" id="si-pop-practice-key">--</span></div>
        <div class="si-popover-row"><span class="si-popover-label">Nhịp / Phách:</span><span class="si-popover-value" id="si-pop-time">--</span></div>
        <div class="si-popover-row"><span class="si-popover-label">Tempo:</span><span class="si-popover-value" id="si-pop-tempo">--</span></div>
        <div class="si-popover-row"><span class="si-popover-label">Số ô nhịp:</span><span class="si-popover-value" id="si-pop-measures">--</span></div>
        <div class="si-popover-row"><span class="si-popover-label">Bộ hợp âm:</span><span class="si-popover-value" id="si-pop-chordset">--</span></div>
        <div class="si-popover-row"><span class="si-popover-label">Sử dụng:</span><span class="si-popover-value" id="si-pop-usage">--</span></div>
        <div class="si-popover-row si-popover-sections-row hidden" id="si-pop-sections-row"><span class="si-popover-label">Đoạn bài:</span><div class="si-popover-sections" id="si-pop-sections"></div></div>
        <button id="btn-open-session-from-popover" class="btn btn-ghost btn-sm w-full mt-2" title="Mở nhật ký phục vụ & ghi chú"><?= icon('clipboard-list', 'icon-xs') ?> <span>Nhật ký phục vụ</span></button>
      </div>
    </div>
  </div>

  <!-- 2. CỤM ĐIỀU KHIỂN TRỌNG TÂM CHO BAN NHẠC (PRO BAND CONTROLS) -->
  <div class="toolbar-center band-controls" id="toolbar-controls">
    
    <!-- Nhóm 2: Cụm Dịch Tông (Transpose Pill) -->
    <div class="band-pill transpose-pill" role="group" aria-label="Điều chỉnh tông nhạc" title="Dịch giọng bài hát (Phím [ và ] )">
      <button id="btn-transpose-down" class="icon-btn-pill" title="Hạ 1 nửa cung (Phím [ )" disabled>
        <?= icon('minus', 'icon-xs') ?>
      </button>
      <span id="transpose-display" class="transpose-value" title="Bấm để về tông gốc">0</span>
      <span id="transpose-sounding-badge" class="transpose-sounding-badge hidden" title="Tông phát ra"></span>
      <button id="btn-transpose-up" class="icon-btn-pill" title="Tăng 1 nửa cung (Phím ] )" disabled>
        <?= icon('plus', 'icon-xs') ?>
      </button>
      <button id="btn-transpose-reset" class="btn-pill-reset" title="Về tông gốc của bài (phím 0)" disabled>Gốc</button>

      <!-- Capo (Chọn ngăn kẹp Capo) -->
      <div id="capo-wrap" class="capo-wrap hidden">
        <label for="capo-select" class="capo-label">Capo</label>
        <select id="capo-select" class="capo-select" title="Chọn ngăn kẹp Capo (0-7)" aria-label="Chọn ngăn kẹp Capo (0-7)">
          <option value="0" selected>0</option><option value="1">1</option><option value="2">2</option>
          <option value="3">3</option><option value="4">4</option><option value="5">5</option>
          <option value="6">6</option><option value="7">7</option>
        </select>
        <span id="capo-hint" class="capo-hint"></span>
      </div>
      <span id="capo-badge" class="capo-badge hidden">Capo 0</span>
    </div>

    <!-- Nhóm 3: Cụm Bản Phối Hợp Âm (Chord Set Pill) -->
    <div class="band-pill chord-set-pill" id="chord-set-bar" role="group" aria-label="Chọn bản phối hợp âm" title="Bản phối hợp âm">
      <span class="pill-icon fs-md-p"><?= icon('guitar') ?></span>
      <select id="chord-set-selector" class="chord-set-select" disabled title="Chọn bản phối hợp âm" aria-label="Chọn bản phối hợp âm">
        <option value="HD" selected>HD (Mặc định)</option>
        <option value="default">TLH (gốc)</option>
      </select>
      <span id="chord-set-count" class="chord-set-count"></span>

      <!-- Nút Tạo bộ hợp âm mới -->
      <button id="btn-new-chord-set" class="icon-btn-pill" title="Tạo bản phối mới" onclick="ChordCanvas.showNewSetModal()">
        <span class="fs-sm-p"><?= icon('plus') ?></span>
      </button>

      <!-- Nút Đề xuất lên HD (Ticket R2-9) -->
      <button id="btn-propose-hd" class="icon-btn-pill btn-propose-hd hidden" title="Đề xuất bản phối này lên bộ HD (chuẩn dùng chung)" onclick="ChordCanvas.showProposeHdModal()">
        <span class="fs-sm-p"><?= icon('send', 'icon-xs') ?></span>
      </button>
    </div>

    <!-- Nhóm 4: Cụm Tempo / Gõ Nhịp (Ticket R1-2) -->
    <button type="button" id="btn-toolbar-tempo" class="band-pill btn-toolbar-tempo" title="Tốc độ bài hát (Bấm ♩ để gõ nhịp · Bấm số BPM để chỉnh tốc độ)">
      <span class="tempo-note-icon font-bold" title="Bật/Tắt máy gõ nhịp (Metronome)">♩</span>
      <span id="toolbar-tempo-val" class="tempo-val">100</span>
    </button>
    <button id="btn-toolbar-metronome" class="icon-btn-pill hidden" disabled title="Mở máy gõ nhịp" aria-hidden="true" tabindex="-1"><span class="metronome-icon-pulse">♩</span></button>

    <!-- Nhóm 5: Công Tắc 2 Chế Độ: Bản Nhạc | Lời & Hợp Âm (Ticket R1-2) -->
    <div class="band-pill view-switch-pill" id="view-switch" role="group" aria-label="Chế độ xem">
      <button type="button" class="btn-view-mode active" id="btn-view-sheet" data-view="sheet" title="Xem bản nhạc khuông (SATB)">
        <?= icon('music', 'icon-xs') ?>
        <span>Bản nhạc</span>
      </button>
      <button type="button" class="btn-view-mode" id="btn-view-lyrics" data-view="lyrics" title="Xem lời & hợp âm">
        <?= icon('file-text', 'icon-xs') ?>
        <span>Lời &amp; Hợp âm</span>
      </button>
      <button id="btn-band-toggle" class="btn-band-toggle hidden" aria-hidden="true" tabindex="-1"></button>
    </div>

    <!-- Nhóm 6: Nút Soạn Hợp Âm (Ticket R1-2) -->
    <button id="btn-add-chord-mode-bar" class="band-pill btn-chord-edit-pill btn-chord-edit" title="Soạn hợp âm trên sheet (phím C)" disabled>
      <?= icon('pencil', 'icon-xs chord-edit-icon') ?>
      <span class="chord-edit-text">Soạn</span>
    </button>

    <!-- Secondary / Compact Controls (Ẩn trên thanh laptop 48px, truy cập qua Bảng Công Cụ ⋯) -->
    <div class="toolbar-secondary-controls d-none">
      <div class="band-pill zoom-pill" role="group" aria-label="Thu phóng bản nhạc">
        <button id="btn-zoom-out" class="icon-btn-pill" title="Thu nhỏ (−)"><?= icon('minus', 'icon-xs') ?></button>
        <select id="zoom-slider" class="select-zoom-pill" disabled aria-label="Chọn tỷ lệ thu phóng">
          <option value="50">50%</option><option value="65">65%</option><option value="80">80%</option><option value="90">90%</option>
          <option value="100" selected>100%</option><option value="115">115%</option><option value="130">130%</option>
          <option value="150">150%</option><option value="175">175%</option><option value="200">200%</option>
        </select>
        <button id="btn-zoom-in" class="icon-btn-pill" title="Phóng to (+)"><?= icon('plus', 'icon-xs') ?></button>
        <button id="btn-lock-zoom" class="icon-btn-pill btn-lock-zoom" title="Khóa tỷ lệ zoom"><span class="lock-icon"><?= icon('unlock') ?></span></button>
      </div>

      <button id="btn-chord-preset" class="band-pill btn-chord-preset" title="Preset hiển thị hợp âm"><span class="preset-icon">Aa</span><span id="chord-preset-label" class="preset-label">Chuẩn</span></button>
      <button id="btn-chord-notation" class="band-pill btn-chord-notation" title="Chế độ hợp âm"><span><?= icon('type') ?></span> <span id="chord-notation-label" class="chord-notation-label">C</span></button>

      <div class="band-pill verse-pill hidden" id="verse-pill" role="group" aria-label="Chọn khổ hát">
        <button id="btn-verse-mode" class="btn-verse-mode"><span class="verse-icon"><?= icon('book-open') ?></span><span id="verse-mode-label" class="verse-mode-label">Tất cả khổ</span></button>
        <div id="verse-nav-controls" class="verse-nav-controls hidden">
          <button id="btn-verse-prev" class="icon-btn-pill btn-verse-nav"><?= icon('chevron-left') ?></button>
          <span id="verse-indicator" class="verse-indicator">1/1</span>
          <button id="btn-verse-next" class="icon-btn-pill btn-verse-nav"><?= icon('chevron-right') ?></button>
        </div>
      </div>

      <button id="btn-instrument-role" class="band-pill btn-instrument-role" title="Góc nhìn nhạc cụ"><span id="instrument-role-icon" class="role-icon"><?= icon('guitar') ?></span><span id="instrument-role-label" class="role-label">Guitar</span></button>

      <div class="band-pill scroll-pill">
        <button id="btn-auto-scroll" class="btn-pill-scroll" disabled><?= icon('scroll', 'icon-xs') ?><span class="btn-text">Cuộn</span></button>
        <select id="scroll-speed" class="select-scroll-speed" disabled aria-label="Tốc độ cuộn"><option value="1" selected>1×</option><option value="2">2×</option><option value="3">3×</option><option value="4">4×</option></select>
      </div>
    </div>
  </div>

  <!-- 3. CỤM PHẢI: BIỂU DIỄN & MENU CÔNG CỤ -->
  <div class="toolbar-right">
    <!-- NÚT TÀI KHOẢN & PHÂN QUYỀN NHẠC CÔNG (Ẩn khỏi toolbar 48px, đăng nhập qua thanh điều hướng / đầu sidebar - Ticket R1-8) -->
    <button id="btn-toolbar-auth" class="btn-toolbar-user d-none" aria-hidden="true" tabindex="-1" title="Đăng nhập / Phân quyền nhạc công">
      <span class="user-pill-icon"><?= icon('user') ?></span>
      <span id="toolbar-auth-name" class="user-pill-name">Khách</span>
      <span id="toolbar-auth-badge" class="user-pill-role hidden"></span>
    </button>

    <!-- NÚT THEO CA TRƯỞNG (Ticket L3-5, R1-8: Mặc định ẩn, chỉ hiện thành chip khi đang theo) -->
    <button id="btn-follow-leader" class="btn-gig-mode btn-follow-leader hidden" title="Theo ca trưởng / Đồng bộ ban nhạc">
      <span class="follow-icon"><?= icon('radio') ?></span>
      <span class="follow-text">Theo ca trưởng</span>
    </button>

    <!-- Nhóm 7: Nút Toàn Màn Hình (Ticket R1-2, R3-2 Q1) -->
    <button id="btn-fullscreen" class="btn-gig-mode" title="Vào chế độ Toàn Màn Hình (Phím F)">
      <span class="gig-icon"><?= icon('maximize') ?></span>
      <span class="gig-text">Toàn Màn Hình</span>
    </button>

    <!-- Nhóm 8: Nút Chuyển Bài Trước / Sau -->
    <div class="nav-arrows" id="nav-arrows">
      <button id="btn-prev-song" class="icon-btn" title="Bài trước (↑)" disabled>
        <?= icon('chevron-left') ?>
      </button>
      <button id="btn-next-song" class="icon-btn" title="Bài tiếp theo (↓)" disabled>
        <?= icon('chevron-right') ?>
      </button>
    </div>

    <button id="btn-mobile-edit" class="mobile-edit-btn hidden" type="button" title="Soạn hợp âm trên bản nhạc" aria-label="Soạn hợp âm" aria-pressed="false" disabled>
      <?= icon('pencil') ?> <span>Soạn</span>
    </button>

    <!-- Nhóm 9: Menu Công Cụ & Cài Đặt (Phím ?) -->
    <div class="control-group more-options-group" id="more-options-group">
      <button id="btn-more-options" class="icon-btn" title="Menu Công Cụ & Cài Đặt">
        <?= icon('more-horizontal') ?>
      </button>

      <div class="dropdown-menu hidden" id="main-dropdown-menu" role="menu" aria-label="Bảng công cụ và cài đặt">
        <!-- Menu ⋮ behavior: close on 'Escape', item click (item classList.add('hidden')), and handleOutside (!btnOptions.contains(e.target)) handled in ToolbarController -->
        <!-- Handle bar cho mobile bottom sheet (Ticket R1-5) -->
        <div class="sheet-drag-handle"></div>

        <!-- NHÓM 1: HIỂN THỊ (Display) -->
        <div class="menu-section-header" role="presentation">HIỂN THỊ</div>

        <div class="tools-row tools-zoom-row menu-section-compact-only" role="group" aria-label="Thu phóng bản nhạc">
          <span class="tools-row-label"><?= icon('search') ?> Thu phóng</span>
          <div class="tools-zoom-controls">
            <button id="btn-menu-zoom-out" class="icon-btn-xs" title="Thu nhỏ">−</button>
            <span id="menu-zoom-val" class="menu-zoom-val">100%</span>
            <button id="btn-menu-zoom-in" class="icon-btn-xs" title="Phóng to">+</button>
            <button id="btn-menu-lock-zoom" class="icon-btn-xs" title="Khóa tỷ lệ zoom"><?= icon('unlock') ?></button>
          </div>
        </div>

        <button id="btn-compact-mode" class="btn btn-ghost btn-sm btn-menu-item" title="Bật/Tắt chế độ tối giản bản nhạc">
          <?= icon('layout') ?>
          <span class="btn-text">Tối giản bản nhạc</span>
        </button>
        <div id="compact-settings-panel" class="compact-settings-panel hidden">
          <label class="check-row"><input type="checkbox" id="chk-compact-bass" checked> Ẩn Khóa Fa</label>
          <label class="check-row"><input type="checkbox" id="chk-compact-voices" checked> Chỉ Giữ Bè Giai Điệu</label>
          <label class="check-row"><input type="checkbox" id="chk-compact-chordnotes" checked> Bỏ Nốt Hòa Âm</label>
          <label class="check-row"><input type="checkbox" id="chk-compact-lyrics"> Ẩn Lời Ca (Nhạc cụ)</label>
          <label class="check-row"><input type="checkbox" id="chk-compact-measures"> Ẩn Số Ô Nhịp</label>
          <label class="check-row"><input type="checkbox" id="chk-compact-texts" checked> Tối giản Tác Giả</label>
          <label class="check-row"><input type="checkbox" id="chk-compact-title"> Ẩn Tên Bài Hát</label>
        </div>

        <button id="btn-menu-verse-mode" class="btn btn-ghost btn-sm btn-menu-item" title="Đổi chế độ khổ">
          <?= icon('book-open') ?>
          <span id="menu-verse-mode-label">Khổ hát: Tất cả khổ</span>
        </button>

        <button id="btn-menu-chord-preset" class="btn btn-ghost btn-sm btn-menu-item" title="Đổi cỡ hiển thị hợp âm">
          <?= icon('type') ?>
          <span id="menu-chord-preset-label">Cỡ hợp âm: Chuẩn</span>
        </button>

        <button id="btn-menu-chord-notation" class="btn btn-ghost btn-sm btn-menu-item" title="Đổi ký hiệu hợp âm">
          <?= icon('hash') ?>
          <span id="menu-chord-notation-label">Ký hiệu: Chuẩn (C)</span>
        </button>

        <button id="btn-menu-instrument-role" class="btn btn-ghost btn-sm btn-menu-item" title="Đổi góc nhìn nhạc cụ">
          <?= icon('guitar') ?>
          <span id="menu-instrument-role-label">Góc nhìn: Guitar</span>
        </button>

        <button id="btn-dark-toggle" class="btn btn-ghost btn-sm btn-menu-item" title="Đổi chế độ Sáng / Tối (D)">
          <?= icon('moon') ?>
          <span>Chế độ Sáng / Tối</span>
        </button>


        <!-- NHÓM 2: NHẠC (Music) -->
        <div class="menu-section-header" role="presentation">NHẠC</div>

        <div class="menu-audio-actions">
          <button id="btn-play-audio" class="btn btn-ghost btn-xs btn-menu-item" disabled title="Phát nhạc đệm bè">
            <?= icon('play') ?>
            <span class="btn-text">Phát bè</span>
          </button>
          <button id="btn-stop-audio" class="btn btn-ghost btn-xs btn-stop hidden" title="Dừng phát nhạc">
            <?= icon('pause') ?>
            <span class="btn-text">Dừng</span>
          </button>
          <button id="btn-audio-settings" class="icon-btn-xs" disabled title="Tùy chỉnh bè phát"><?= icon('settings') ?></button>
          <button id="btn-menu-satb-bar" class="icon-btn-xs" title="Mở thanh tập bè SATB nổi"><?= icon('music') ?></button>
        </div>

        <div id="audio-settings-panel" class="audio-settings-panel hidden">
          <div class="audio-panel-row">
            <span class="audio-panel-label">Bè:</span>
            <div class="voice-selector" id="voice-selector" role="group" aria-label="Chọn bè">
              <button class="voice-btn voice-s" data-voice="soprano" data-touch-allow="true" disabled>S</button>
              <button class="voice-btn voice-a" data-voice="alto" data-touch-allow="true" disabled>A</button>
              <button class="voice-btn voice-t" data-voice="tenor" data-touch-allow="true" disabled>T</button>
              <button class="voice-btn voice-b" data-voice="bass" data-touch-allow="true" disabled>B</button>
              <button class="voice-btn voice-all active" data-voice="satb" data-touch-allow="true" disabled><?= icon('music') ?></button>
            </div>
          </div>
          <div class="audio-panel-row">
            <span class="audio-panel-label">Tốc độ:</span>
            <select id="audio-speed" class="select-toolbar" data-touch-allow="true" disabled aria-label="Chọn tốc độ phát nhạc">
              <option value="0.5">0.5×</option><option value="0.75">0.75×</option><option value="1.0" selected>1.0×</option><option value="1.25">1.25×</option><option value="1.5">1.5×</option>
            </select>
          </div>
          <div class="audio-panel-row">
            <span class="audio-panel-label">Âm lượng:</span>
            <input id="audio-volume" type="range" class="audio-volume-slider" min="-20" max="24" step="1" value="18" data-touch-allow="true" disabled>
          </div>
        </div>

        <button id="btn-mixer" class="btn btn-ghost btn-sm btn-menu-item" disabled title="Bật/Tắt nhạc cụ">
          <?= icon('sliders') ?>
          <span>Bộ trộn âm (Mixer)</span>
        </button>

        <div class="tools-row tools-scroll-row menu-section-compact-only">
          <span class="tools-row-label"><?= icon('scroll') ?> Tự cuộn</span>
          <div class="tools-scroll-controls">
            <button id="btn-menu-auto-scroll" class="btn btn-ghost btn-xs btn-menu-item btn-menu-compact-action">
              <span class="btn-text">Cuộn</span>
            </button>
            <select id="menu-scroll-speed" class="select-toolbar select-menu-compact" aria-label="Chọn tốc độ cuộn">
              <option value="1" selected>1×</option><option value="2">2×</option><option value="3">3×</option><option value="4">4×</option>
            </select>
          </div>
        </div>

        <button id="btn-menu-metronome" class="btn btn-ghost btn-sm btn-menu-item" title="Giữ nhịp (Metronome)">
          <?= icon('clock') ?>
          <span>Giữ nhịp (Metronome)</span>
        </button>

        <div class="tools-row tools-capo-row">
          <span class="tools-row-label"><?= icon('guitar') ?> Kẹp Capo</span>
          <select id="menu-capo-select" class="select-toolbar select-menu-compact" title="Chọn ngăn kẹp Capo" aria-label="Chọn ngăn kẹp Capo">
            <option value="0" selected>0 (Không kẹp)</option>
            <option value="1">Ngăn 1</option><option value="2">Ngăn 2</option>
            <option value="3">Ngăn 3</option><option value="4">Ngăn 4</option>
            <option value="5">Ngăn 5</option><option value="6">Ngăn 6</option>
            <option value="7">Ngăn 7</option>
          </select>
        </div>

        <button id="btn-menu-transpose-reset" class="btn btn-ghost btn-sm btn-menu-item" title="Đưa về tông gốc (0)">
          <?= icon('rotate-ccw') ?>
          <span>Về tông gốc (0)</span>
        </button>


        <!-- NHÓM 3: BAN NHẠC (Band) -->
        <div class="menu-section-header" role="presentation">BAN NHẠC</div>

        <button id="btn-menu-follow-leader" class="btn btn-ghost btn-sm btn-menu-item" title="Theo người hướng dẫn / Kết nối nhóm ban nhạc">
          <?= icon('radio') ?>
          <span>Theo người hướng dẫn</span>
        </button>


        <!-- NHÓM 4: SOẠN (Edit) -->
        <div class="menu-section-header" role="presentation">SOẠN</div>

        <button id="btn-menu-add-chord-mode" class="btn btn-ghost btn-sm btn-menu-item" title="Soạn / Điền hợp âm trực tiếp trên sheet (phím C)">
          <?= icon('pencil') ?>
          <span>Soạn hợp âm (phím C)</span>
        </button>
        <!-- Nút dự phòng backward compat cho selector cũ -->
        <button id="btn-menu-chord-edit" class="hidden" aria-hidden="true" tabindex="-1" onclick="document.getElementById('btn-menu-add-chord-mode')?.click()"></button>

        <button id="btn-menu-create-chordset" class="btn btn-ghost btn-sm btn-menu-item" title="Tạo bộ hợp âm mới" onclick="window.ChordCanvas?.showNewSetModal?.()">
          <?= icon('plus') ?>
          <span>Bộ hợp âm mới</span>
        </button>

        <button id="btn-song-versions" class="btn btn-ghost btn-sm btn-menu-item" disabled title="Chọn phiên bản MusicXML">
          <?= icon('layers') ?>
          <span id="btn-version-label">Bản Gốc</span>
        </button>
        <div id="dropdown-song-versions" class="dropdown-menu dropdown-song-versions hidden">
          <div id="version-list-items"></div>
        </div>

        <button id="btn-toolbar-editor" class="btn btn-ghost btn-sm btn-menu-item" title="Mở Editor nốt 4 bè SATB" onclick="(function(){ var sid = window.App?.getCurrentSongId?.(); window.location.href = sid ? ('/editor/?song=' + sid) : '/editor/'; })()">
          <?= icon('music') ?>
          <span>Sửa bản nhạc (SATB)</span>
        </button>


        <!-- NHÓM 5: KHÁC (Other) -->
        <div class="menu-section-header" role="presentation">KHÁC</div>

        <button id="btn-menu-session-panel" class="btn btn-ghost btn-sm btn-menu-item" title="Nhật ký phục vụ & Ghi chú tập đàn">
          <?= icon('clipboard-list') ?>
          <span>Nhật ký phục vụ</span>
        </button>

        <button id="btn-menu-quick-numpad" class="btn btn-ghost btn-sm btn-menu-item" title="Bàn phím số nhanh (#)">
          <?= icon('hash') ?>
          <span>Bàn phím số nhanh (#)</span>
        </button>

        <button id="btn-lyric-view" class="btn btn-ghost btn-sm btn-menu-item" title="Xem lời & hợp âm dạng chữ">
          <?= icon('file-text') ?>
          <span>In lời & hợp âm</span>
        </button>

        <button id="btn-print" class="btn btn-ghost btn-sm btn-menu-item" disabled title="In sheet nhạc">
          <?= icon('printer') ?>
          <span>In bản nhạc</span>
        </button>

        <?php $bHref = $baseHref ?? '/'; ?>
        <a href="<?= $bHref ?>manager/" target="_blank" class="btn btn-ghost btn-sm btn-menu-item" title="Cổng quản lý kho nhạc & hợp âm">
          <?= icon('folder') ?>
          <span>Quản lý kho nhạc</span>
        </a>

        <a href="<?= $bHref ?>manager/#tab-users" data-target="/manager/#tab-users" target="_blank" class="btn btn-ghost btn-sm btn-menu-item" title="Quản lý thành viên ban nhạc & bộ hợp âm">
          <?= icon('users') ?>
          <span>Ban nhạc & Thành viên</span>
        </a>

        <button id="btn-help" class="btn btn-ghost btn-sm btn-menu-item" title="Hướng dẫn sử dụng (?)">
          <?= icon('help-circle') ?>
          <span>Hướng dẫn sử dụng</span>
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
    <button id="btn-mobile-chordset" class="btn-thumb-chordset" title="Chọn bản phối hợp âm" aria-label="Bộ hợp âm: HD. Chạm để đổi">
      <span class="thumb-icon"><?= icon('guitar') ?></span>
      <span id="mobile-chordset-label" class="thumb-label">HD</span>
    </button>
  </div>

  <div class="mobile-thumb-group mobile-view-group" role="group" aria-label="Chế độ xem">
    <button id="btn-mobile-view-toggle" class="btn-thumb-view" title="Chuyển chế độ Lời &amp; Hợp âm ↔ Bản Nhạc" aria-label="Đổi dạng xem">
      <span id="mobile-view-icon" class="thumb-icon"><?= icon('music') ?></span>
      <span id="mobile-view-label" class="thumb-label">Bản Nhạc</span>
    </button>
  </div>

  <div class="mobile-thumb-group mobile-gig-group" role="group" aria-label="Toàn màn hình">
    <button id="btn-mobile-gig" class="btn-thumb-gig" title="Chế độ Toàn Màn Hình" aria-label="Toàn màn hình">
      <span class="thumb-icon"><?= icon('maximize') ?></span>
    </button>
  </div>
</nav>
