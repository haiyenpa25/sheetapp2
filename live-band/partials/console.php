  <!-- ══════════════ 2. HOST MASTER COMMAND CONSOLE ══════════════ -->
  <!-- Chỉ hiển thị khi vai trò là Leader hoặc người dùng là Host -->
  <aside id="host-command-console" class="host-command-console hidden">
    <div class="host-console-inner">
      <!-- Section 1: Song & Setlist Switcher -->
      <div class="host-console-group host-song-group">
        <button id="btn-host-prev-song" class="btn-host-nav" title="Bài trước trong Setlist">⏮</button>
        <div class="host-song-select-wrap">
          <input type="search" id="host-song-search" class="host-song-search" placeholder="🔍 Tìm số bài (#90) hoặc tên..." autocomplete="off" title="Lọc nhanh trong 903 bài">
          <select id="host-song-dropdown" class="host-song-dropdown" aria-label="Chọn bài hát">
            <option value="">-- Chọn bài hát phát sóng --</option>
          </select>
        </div>
        <select id="host-chord-set-select" class="host-chord-set-select" title="Bộ hợp âm phát sóng cho toàn ban nhạc">
          <option value="HD" selected>⭐ HD</option>
          <option value="default">TLH (Gốc)</option>
        </select>
        <button id="btn-host-next-song" class="btn-host-nav" title="Bài tiếp theo trong Setlist">⏭</button>
        <button id="btn-host-pick-setlist" class="btn-host-pill" title="Nạp Setlist chương trình">📋 Setlist</button>
      </div>

      <!-- Section 2: Master Transpose Controls -->
      <div class="host-console-group host-transpose-group">
        <span class="group-label">Dịch Giọng:</span>
        <button id="btn-host-transpose-down" class="btn-host-step" title="Hạ 1 nửa cung (semitone)">−</button>
        <span id="host-key-val" class="host-key-badge">C (0)</span>
        <button id="btn-host-transpose-up" class="btn-host-step" title="Tăng 1 nửa cung (semitone)">+</button>
      </div>

      <!-- Section 3: Metronome & Count-in -->
      <div class="host-console-group host-tempo-group">
        <div class="tempo-stepper">
          <button id="btn-host-bpm-dec" class="btn-host-step">−5</button>
          <span id="host-bpm-val" class="host-bpm-val">80 BPM</span>
          <button id="btn-host-bpm-inc" class="btn-host-step">+5</button>
        </div>
        <button id="btn-host-countin-trigger" class="btn-host-countin-trigger" title="Đếm nhịp chuẩn bị 1-2-3-4 cho toàn ban nhạc">
          <span class="countin-fire-icon">🔥</span>
          <span>ĐẾM NHỊP VÀO</span>
        </button>
      </div>

      <!-- Section 3b: Ambient Pad Quick Toggle -->
      <div class="host-console-group host-pad-group">
        <button id="btn-host-pad-toggle" class="btn-host-pill pad-toggle-btn" title="Bật/Tắt âm nền Ambient Pad theo Tông">
          <span>🎹</span>
          <span id="host-pad-btn-text">Bật Pad Drone</span>
        </button>
      </div>

      <!-- Section 4: Cue Commander -->
      <div class="host-console-group host-cue-group">
        <span class="group-label">Hiệu Lệnh Sân Khấu:</span>
        <div class="cue-buttons-wrap">
          <button class="btn-cue-trigger btn-cue-chorus" data-cue="chorus" title="Nhắc vào Điệp Khúc">⚡ Điệp Khúc</button>
          <button class="btn-cue-trigger btn-cue-repeat" data-cue="repeat" title="Lặp lại đoạn này">🔁 Lặp Lại</button>
          <button class="btn-cue-trigger btn-cue-soft" data-cue="soft" title="Hát êm (Piano)">🤫 Nhỏ Dần</button>
          <button class="btn-cue-trigger btn-cue-loud" data-cue="loud" title="Quạt mạnh / Cao trào (Forte)">🔥 Cao Trào</button>
          <button class="btn-cue-trigger btn-cue-outro" data-cue="outro" title="Chuẩn bị Kết bài">🛑 Chuẩn Bị Kết</button>
        </div>
      </div>
    </div>

    <!-- Section Roadmap Chips Bar -->
    <div id="host-roadmap-bar" class="host-roadmap-bar">
      <div class="roadmap-label">Phân Đoạn:</div>
      <div id="host-roadmap-chips" class="roadmap-chips-list">
        <!-- Sẽ được điền động theo bài hát: [Intro] [Lời 1] [Điệp khúc] [Outro] -->
        <span class="roadmap-empty-hint">Chưa có phân đoạn bài hát</span>
      </div>
    </div>

    <!-- Rehearsal A-B Loop Bar & Collaborative Ink -->
    <div id="host-rehearsal-loop-bar" class="host-rehearsal-loop-bar">
      <div class="loop-bar-left">
        <button id="btn-toggle-ab-loop" class="btn-host-pill loop-pill-btn" title="Bật/Tắt vòng lặp tập dượt A-B">
          <span>🔁</span>
          <span id="loop-btn-label">Vòng Lặp A-B: Tắt</span>
        </button>
        <div class="loop-inputs-wrap">
          <label>Từ Ô:</label>
          <input type="number" id="loop-start-measure" class="loop-measure-input" value="1" min="1" max="200">
          <label>Đến Ô:</label>
          <input type="number" id="loop-end-measure" class="loop-measure-input" value="16" min="1" max="200">
          <button id="btn-set-loop-current" class="btn-host-step" title="Đặt đoạn 8 ô nhịp quanh vị trí hiện tại">📍 8 Ô Hiện Tại</button>
        </div>
      </div>
      <!-- Collaborative Ink Toolbar (Ca Trưởng) -->
      <div class="host-ink-toolbar" id="host-ink-toolbar">
        <button id="btn-toggle-ink" class="btn-host-pill ink-toggle-btn" title="Bật/Tắt chế độ vẽ chú thích Apple Pencil/S-Pen">
          <span>✏️</span>
          <span id="ink-toggle-label">Bút Chú Thích</span>
        </button>
        <div id="ink-tools-group" class="ink-tools-group hidden">
          <button class="btn-ink-tool active" data-tool="pen" data-color="#ef4444" title="Bút đỏ">🔴</button>
          <button class="btn-ink-tool" data-tool="pen" data-color="#f59e0b" title="Bút vàng">🟡</button>
          <button class="btn-ink-tool" data-tool="highlighter" title="Dạ quang">🖍️</button>
          <button class="btn-ink-tool" data-tool="eraser" title="Tẩy nét">🧹</button>
          <button id="btn-ink-clear-all" class="btn-ink-tool" title="Xóa tất cả nét vẽ">🗑️</button>
        </div>
      </div>
    </div>
  </aside>
