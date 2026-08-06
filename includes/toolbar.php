<!-- TOP TOOLBAR -->
<header class="toolbar" id="toolbar">
  <!-- MOBILE HAMBURGER (chỉ mobile, sidebar mở) -->
  <button id="btn-open-sidebar" class="icon-btn mobile-only" title="Mở danh sách bài hát">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
  </button>

  <div class="toolbar-left">
    <!-- SONG INFO: ẩn khỏi toolbar, JS vẫn đọc được -->
    <div class="song-info" id="song-info" style="display:none;">
      <span id="song-title" class="song-title">Chọn bài hát để bắt đầu</span>
      <!-- song-key badge ẩn khỏi toolbar, chỉ dùng bởi JS để lấy text cho lyric view -->
      <span id="song-key" class="song-key-badge" style="display:none;"></span>
    </div>
  </div>

  <div class="toolbar-controls" id="toolbar-controls">

    <!-- PLAY AUDIO -->
    <div class="control-group" style="position: relative;">
      <button id="btn-play-audio" class="btn btn-ghost btn-sm" disabled title="Phát nhạc đệm (Audio)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3" fill="currentColor"/></svg>
        <span class="btn-text">Phát</span>
      </button>
      <!-- STOP AUDIO -->
      <button id="btn-stop-audio" class="btn btn-ghost btn-sm btn-stop hidden" title="Dừng phát nhạc">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="6" width="12" height="12" fill="currentColor"/></svg>
        <span class="btn-text">Dừng</span>
      </button>

      <!-- AUDIO SETTINGS TOGGLER -->
      <button id="btn-audio-settings" class="icon-btn" disabled title="Tùy chỉnh Âm thanh & Bè phát">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/>
          <line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/>
          <line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/>
          <line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/>
          <line x1="17" y1="16" x2="23" y2="16"/>
        </svg>
      </button>

      <!-- AUDIO SETTINGS PANEL DROPDOWN -->
      <div id="audio-settings-panel" class="dropdown-menu audio-settings-panel hidden">
        <div class="audio-panel-row">
          <span class="audio-panel-label">Bè Phát:</span>
          <!-- Voice Selector: 5 chế độ phát bè SATB -->
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
          <!-- AUDIO SPEED -->
          <select id="audio-speed" class="select-toolbar" disabled title="Tốc độ phát">
            <option value="0.5">0.5×</option>
            <option value="0.75">0.75×</option>
            <option value="1.0" selected>1.0×</option>
            <option value="1.25">1.25×</option>
            <option value="1.5">1.5×</option>
          </select>
        </div>

        <div class="audio-panel-row">
          <span class="audio-panel-label">Âm Lượng:</span>
          <!-- VOLUME SLIDER — Âm lượng phát -->
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

      <!-- Hidden select giữ lại để JS legacy đọc được -->
      <select id="audio-playback-mode" style="display:none" aria-hidden="true">
        <option value="satb" selected>SATB</option>
        <option value="soprano">Soprano</option>
        <option value="alto">Alto</option>
        <option value="tenor">Tenor</option>
        <option value="bass">Bass</option>
      </select>
    </div>

    <!-- AUTO SCROLL — Gộp nút + tốc độ thành 1 control -->
    <div class="control-group scroll-control-group">
      <button id="btn-auto-scroll" class="btn btn-ghost btn-sm" disabled title="Tự động cuộn bản nhạc">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>
        <span class="btn-text">Cuộn</span>
      </button>
      <select id="scroll-speed" class="select-toolbar select-scroll-speed" disabled title="Tốc độ cuộn">
        <option value="1">🐢</option>
        <option value="2" selected>🚶</option>
        <option value="3">🚴</option>
        <option value="4">⚡</option>
      </select>
    </div>

    <!-- DEDICATED METRONOME (GIỮ NHỊP) -->
    <div class="control-group">
      <button id="btn-toolbar-metronome" class="btn btn-ghost btn-sm" disabled title="Mở bộ Giữ Nhịp & Tạo Tempo (Metronome)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="metronome-icon-pulse" style="width: 15px; height: 15px; transition: transform 0.2s ease;">
          <path d="M12 2L2 22h20L12 2z" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M12 5l-2 10" stroke-linecap="round" stroke-linejoin="round"/>
          <circle cx="12" cy="18" r="1.5" fill="currentColor"/>
        </svg>
        <span class="btn-text">Gõ Nhịp</span>
      </button>
    </div>

    <!-- 📡 LIVE SYNC BUTTON -->
    <div class="control-group">
      <button id="btn-live-sync" class="btn btn-ghost btn-sm" title="📡 Đồng Bộ Biểu Diễn Live Ban Nhạc">
        <span style="font-size: 0.9rem;">📡</span>
        <span class="btn-text">Live Sync</span>
      </button>
      <span id="live-sync-badge" class="live-badge hidden" style="margin-left: 4px;"></span>
    </div>


    <!-- COMPACT MODE + SETTINGS -->
    <div class="control-group" style="position: relative;">
      <button id="btn-compact-mode" class="btn btn-ghost btn-sm" title="Bật/Tắt chế độ Gọn Nhẹ">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 14h6v6H4zm10 0h6v6h-6zM4 4h6v6H4zm10 0h6v6h-6z"/><line x1="14" y1="14" x2="20" y2="20"/><line x1="20" y1="14" x2="14" y2="20"/></svg>
        <span class="btn-text">Gọn Nhẹ</span>
      </button>
      <button id="btn-compact-settings" class="icon-btn" title="Tuỳ chỉnh Gọn Nhẹ">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
      </button>
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


    <!-- LYRIC VIEW TOGGLE — di chuyển vào FAB, giữ lại button ẩn để JS vẫn trigger được -->
    <button id="btn-lyric-view" class="btn btn-ghost btn-sm" title="Tuỳ chọn hiển thị Hợp Âm Lời Nhạc" style="display:none;">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
      <span class="btn-text">Lời Nhạc</span>
    </button>

    <!-- MORE OPTIONS DROPDOWN -->
    <div class="control-group" id="more-options-group" style="position: relative;">
      <button id="btn-more-options" class="btn btn-ghost btn-sm" title="Tuỳ chọn thêm">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
        <span class="btn-text">Tuỳ Chọn</span>
      </button>
      <div class="dropdown-menu hidden" id="main-dropdown-menu">

        <button id="btn-mixer" class="btn btn-ghost btn-sm btn-menu-item" disabled title="Bật/Tắt nhạc cụ">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>
          Mixer
        </button>

        <button id="btn-dark-mode" class="btn btn-ghost btn-sm btn-menu-item" title="Bật giao diện Sân Khấu (Kéo màn hình đen)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
          Sân Khấu
        </button>

        <button id="btn-session-panel" class="btn btn-ghost btn-sm btn-menu-item" disabled title="Nhật ký biểu diễn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
          Nhật ký
        </button>


        <button id="btn-print" class="btn btn-ghost btn-sm btn-menu-item" disabled title="In sheet nhạc">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
          In Bản Nhạc
        </button>

      </div>
    </div>

    <script>
      /* More Options Dropdown — logic không thuộc module nào nên đặt trực tiếp ở đây */
      document.addEventListener('DOMContentLoaded', function() {
        const btnOptions = document.getElementById('btn-more-options');
        const menuOptions = document.getElementById('main-dropdown-menu');
        if (!btnOptions || !menuOptions) return;

        function positionMenu() {
          const r = btnOptions.getBoundingClientRect();
          const w = menuOptions.offsetWidth || 160;
          let left = r.right - w;
          if (left < 8) left = 8;
          if (left + w > window.innerWidth - 8) left = window.innerWidth - w - 8;
          menuOptions.style.cssText = `position:fixed; top:${r.bottom + 4}px; left:${left}px; right:auto; z-index:99999;`;
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
        window.addEventListener('scroll', () => menuOptions.classList.add('hidden'), { passive: true });
        window.addEventListener('resize', () => menuOptions.classList.add('hidden'));
        menuOptions.querySelectorAll('.btn').forEach(btn => {
          btn.addEventListener('click', () => menuOptions.classList.add('hidden'));
        });
      });
    </script>


    <!-- AUTH BUTTON đã chuyển lên toolbar-left-group phía trên -->

    <!-- HELP BUTTON -->
    <div class="control-group">
      <button id="btn-help" class="icon-btn" title="Hướng dẫn sử dụng (?)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      </button>
    </div>

    <div style="width: 1px; height: 20px; background: var(--border); margin: 0 0.2rem;"></div>

    <!-- PREV/NEXT NAV (Di chuyển về cuối dòng) -->
    <div class="nav-arrows" id="nav-arrows">
      <button id="btn-prev-song" class="icon-btn" title="Bài trước (↑)" disabled>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <button id="btn-next-song" class="icon-btn" title="Bài tiếp theo (↓)" disabled>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
      </button>
    </div>

    <!-- DARK MODE — Sprint F -->
    <div class="control-group">
      <button id="btn-dark-toggle" class="icon-btn" title="Chế độ tối/sáng (D)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
      </button>
    </div>

    <!-- FULLSCREEN -->
    <div class="control-group">
      <button id="btn-fullscreen" class="icon-btn" title="Toàn màn hình (F)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
      </button>
    </div>


  </div>
</header>

