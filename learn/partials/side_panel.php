    <!-- ── Side Panel (Studio Controls) ───────────────────────────────── -->
    <aside class="learn-side-panel">

      <!-- Mode selector -->
      <div class="learn-mode-bar">
        <button class="btn-learn-mode active" data-mode="piano"  title="Học Piano">
          <svg viewBox="0 0 24 24" fill="currentColor" class="mode-icon"><path d="M20 5H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-9 10H9v-5h2v5zm4 0h-2v-5h2v5zm4 0h-2v-5h2v5z"/></svg>
          Piano
        </button>
        <button class="btn-learn-mode"        data-mode="melody" title="Tập Nốt Giai Điệu (Giọng 1)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="mode-icon"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
          Giai Điệu
        </button>
        <button class="btn-learn-mode"        data-mode="chord"  title="Tập Đệm Hợp Âm">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="mode-icon"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          Đệm Hát
        </button>
        <button class="btn-learn-mode"        data-mode="satb"   title="Luyện giọng Ca Đoàn SATB">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="mode-icon"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
          Ca Đoàn
        </button>
      </div>

      <!-- Accompaniment Pattern Selector -->
      <div class="learn-panel-card" id="learn-pattern-card">
        <div class="learn-panel-card-header">
          <span class="learn-panel-card-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;vertical-align:-3px;margin-right:4px;">
              <path d="M2 10s3-3 5-3 5 6 7 6 5-3 8-3"/><path d="M2 14s3-3 5-3 5 6 7 6 5-3 8-3"/>
            </svg>
            Kiểu đệm tự động
          </span>
          <label class="learn-toggle-switch" title="Bật/Tắt đệm">
            <input type="checkbox" id="learn-pattern-toggle" checked>
            <span class="learn-toggle-slider"></span>
          </label>
        </div>

        <!-- Meter Filter Tabs -->
        <div class="learn-meter-tabs" id="learn-meter-tabs">
          <button type="button" class="btn-meter-tab active" data-meter="auto" title="Tự động theo nhịp bài hát">⭐ Theo bài</button>
          <button type="button" class="btn-meter-tab" data-meter="4/4" title="Điệu 4/4">4/4</button>
          <button type="button" class="btn-meter-tab" data-meter="3/4" title="Điệu 3/4">3/4</button>
          <button type="button" class="btn-meter-tab" data-meter="6/8" title="Điệu 6/8">6/8</button>
          <button type="button" class="btn-meter-tab" data-meter="2/4" title="Điệu 2/4">2/4</button>
          <button type="button" class="btn-meter-tab" data-meter="all" title="Mọi điệu">Tất cả</button>
        </div>

        <select id="learn-pattern-select" class="learn-select">
          <optgroup label="Nhịp 4/4 & Chung">
            <option value="smart-ballad" selected>🎹 Pop / Worship Ballad (4/4 Mượt Mà)</option>
            <option value="smart-rumba">🌴 Rumba Thánh Ca (Trầm Ấm Lãng Mạn)</option>
            <option value="smart-worship">✨ Arpeggio Suối Reo (Rải 16th Mượt Mà)</option>
            <option value="smart-disco">🎉 Praise / Disco Hân Hoan (4/4 Sôi Động)</option>
            <option value="piano-block-4-4-v1">📦 Piano Block (Dậm Đều Từng Phách)</option>
          </optgroup>
          <optgroup label="Nhịp 3/4 (Boston / Waltz)">
            <option value="smart-boston">💃 Boston Trữ Tình (3/4 Chậm Rãi Nhẹ Nhàng)</option>
            <option value="smart-waltz">🍷 Slow Waltz (3/4 Quý Phái Mềm Mại)</option>
            <option value="smart-joyful-waltz">⛪ Joyful Valse (3/4 Vui Tươi Mừng Lễ)</option>
          </optgroup>
          <optgroup label="Nhịp 6/8 (Slow Rock / Ballad 6/8)">
            <option value="smart-slowrock-6-8">🌊 Thánh Ca 6/8 Slow Rock (Sóng Biển Dập Dềnh)</option>
            <option value="smart-ballad-6-8">🕊 Ballad 6/8 Nhẹ Nhàng Âm Vang</option>
          </optgroup>
          <optgroup label="Nhịp 2/4 (Hành Khúc / Polka)">
            <option value="smart-march">🎺 Hành Khúc / March 1-2 (Trang Nghiêm Tiến Lên)</option>
            <option value="smart-fox">🦊 Fox / Polka 2/4 (Nhanh Vui Rộn Rã)</option>
          </optgroup>
          <optgroup label="Trang Trọng & Nhà Thờ (Mọi Nhịp)">
            <option value="smart-hymn">⛪ Thánh Ca 4 Bè (Hòa Âm Trang Trọng)</option>
            <option value="organ-church-4-4-v1">🏛 Organ Đại Thánh Đường (Pedal Bass)</option>
          </optgroup>
        </select>

        <!-- Density control -->
        <div class="learn-density-control">
          <span class="learn-sub-label">Độ dày đệm:</span>
          <div class="btn-group-density" role="group">
            <button type="button" class="btn-density" data-density="soft" title="Đệm êm dịu, thưa nốt">Êm dịu</button>
            <button type="button" class="btn-density active" data-density="medium" title="Đệm tiêu chuẩn, cân bằng">Vừa</button>
            <button type="button" class="btn-density" data-density="rich" title="Đệm dày dặn, nhiều nốt hoa mỹ">Dày dặn</button>
          </div>
        </div>

        <!-- Sound Mixer preview -->
        <div class="learn-mini-mixer">
          <div class="mixer-item">
            <span>Piano</span>
            <input type="range" id="slider-vol-piano" min="-30" max="4" value="-2" title="Âm lượng Piano">
          </div>
          <div class="mixer-item">
            <span>Bass</span>
            <input type="range" id="slider-vol-bass" min="-30" max="4" value="-1" title="Âm lượng Bass">
          </div>
          <div class="mixer-item">
            <span style="display:flex;align-items:center;gap:4px;">
              <input type="checkbox" id="learn-drum-toggle" title="Bật/Tắt Trống & Bộ gõ mộc" style="margin:0;cursor:pointer;accent-color:var(--learn-accent);">
              Trống/Gõ
            </span>
            <input type="range" id="slider-vol-drum" min="-35" max="4" value="-4" title="Âm lượng Trống & Bộ gõ mộc">
          </div>
        </div>
      </div>

      <!-- Melody Practice Card -->
      <div class="learn-panel-card" id="learn-melody-card">
        <div class="learn-panel-card-header">
          <span class="learn-panel-card-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;vertical-align:-3px;margin-right:4px;">
              <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
            </svg>
            Tập Đánh Nốt Giai Điệu
          </span>
          <span class="melody-mode-badge" id="melody-badge-state">Giọng 1</span>
        </div>
        <div class="melody-card-body">
          <p class="melody-desc">
            Trích xuất nốt giọng 1 (khoá Sol) từ sheet nhạc. Bàn phím ảo và con trỏ sẽ dẫn đường từng nốt theo thời gian thực.
          </p>

          <div class="melody-toggle-row">
            <div class="melody-toggle-label">
              <span class="title">Chờ đánh đúng nốt</span>
              <span class="sub">Chỉ đi tiếp khi bạn bấm trúng nốt</span>
            </div>
            <label class="learn-toggle-switch">
              <input type="checkbox" id="melody-wait-toggle" checked>
              <span class="learn-toggle-slider"></span>
            </label>
          </div>

          <div class="melody-toggle-row">
            <div class="melody-toggle-label">
              <span class="title">Âm thanh mẫu Piano</span>
              <span class="sub">Tự động đàn mẫu nốt khi tới lượt</span>
            </div>
            <label class="learn-toggle-switch">
              <input type="checkbox" id="melody-preview-toggle" checked>
              <span class="learn-toggle-slider"></span>
            </label>
          </div>

          <div class="melody-stats-bar">
            <div class="stat-box">
              <span class="stat-label">Tổng nốt</span>
              <span class="stat-val" id="melody-stat-total">0</span>
            </div>
            <div class="stat-box">
              <span class="stat-label">Chính xác</span>
              <span class="stat-val text-success" id="melody-stat-accuracy">100%</span>
            </div>
            <div class="stat-box">
              <span class="stat-label">Đã đánh</span>
              <span class="stat-val text-accent" id="melody-stat-hits">0</span>
            </div>
          </div>
        </div>
      </div>

      <!-- SATB Choir Mixer Card -->
      <div class="learn-panel-card" id="learn-satb-card">
        <div class="learn-panel-card-header">
          <span class="learn-panel-card-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;vertical-align:-3px;margin-right:4px;">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
            Luyện Ca Đoàn (4 Bè SATB)
          </span>
          <span class="satb-badge-mode" id="satb-active-badge">4 Bè</span>
        </div>
        <div class="satb-mixer-body">
          <!-- Soprano -->
          <div class="satb-voice-row" data-voice="soprano">
            <div class="voice-info">
              <span class="voice-dot voice-dot-soprano"></span>
              <span class="voice-name">Soprano (Nữ Cao)</span>
            </div>
            <div class="voice-actions">
              <button type="button" class="btn-voice-btn btn-voice-solo" data-voice="soprano" title="Chỉ nghe bè này">Solo</button>
              <button type="button" class="btn-voice-btn btn-voice-mute" data-voice="soprano" title="Tắt bè này để tự hát">Mute</button>
            </div>
            <div class="voice-slider-wrap">
              <input type="range" class="voice-slider" data-voice="soprano" min="-30" max="4" value="-2">
            </div>
          </div>
          <!-- Alto -->
          <div class="satb-voice-row" data-voice="alto">
            <div class="voice-info">
              <span class="voice-dot voice-dot-alto"></span>
              <span class="voice-name">Alto (Nữ Trầm)</span>
            </div>
            <div class="voice-actions">
              <button type="button" class="btn-voice-btn btn-voice-solo" data-voice="alto" title="Chỉ nghe bè này">Solo</button>
              <button type="button" class="btn-voice-btn btn-voice-mute" data-voice="alto" title="Tắt bè này để tự hát">Mute</button>
            </div>
            <div class="voice-slider-wrap">
              <input type="range" class="voice-slider" data-voice="alto" min="-30" max="4" value="-2">
            </div>
          </div>
          <!-- Tenor -->
          <div class="satb-voice-row" data-voice="tenor">
            <div class="voice-info">
              <span class="voice-dot voice-dot-tenor"></span>
              <span class="voice-name">Tenor (Nam Cao)</span>
            </div>
            <div class="voice-actions">
              <button type="button" class="btn-voice-btn btn-voice-solo" data-voice="tenor" title="Chỉ nghe bè này">Solo</button>
              <button type="button" class="btn-voice-btn btn-voice-mute" data-voice="tenor" title="Tắt bè này để tự hát">Mute</button>
            </div>
            <div class="voice-slider-wrap">
              <input type="range" class="voice-slider" data-voice="tenor" min="-30" max="4" value="-2">
            </div>
          </div>
          <!-- Bass -->
          <div class="satb-voice-row" data-voice="bass">
            <div class="voice-info">
              <span class="voice-dot voice-dot-bass"></span>
              <span class="voice-name">Bass (Nam Trầm)</span>
            </div>
            <div class="voice-actions">
              <button type="button" class="btn-voice-btn btn-voice-solo" data-voice="bass" title="Chỉ nghe bè này">Solo</button>
              <button type="button" class="btn-voice-btn btn-voice-mute" data-voice="bass" title="Tắt bè này để tự hát">Mute</button>
            </div>
            <div class="voice-slider-wrap">
              <input type="range" class="voice-slider" data-voice="bass" min="-30" max="4" value="-1.5">
            </div>
          </div>
        </div>
      </div>

      <!-- Chord Card -->
      <div class="chord-card-container">
        <div id="learn-chord-card">
          <!-- Mounted by ChordCard.mount() -->
        </div>
      </div>

    </aside>
