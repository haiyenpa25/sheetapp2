  <!-- ══════════════ 4. MAIN STAGE CANVAS AREA ══════════════ -->
  <main id="stage-viewport" class="stage-viewport">
    
    <!-- Empty State (Khi chưa chọn bài) -->
    <div id="stage-empty-state" class="stage-empty-state">
      <div class="empty-icon-pulse">📡</div>
      <h2 class="empty-title">Chào Mừng Đến Live Band Studio</h2>
      <p class="empty-subtitle">Sẵn sàng đồng bộ trực tiếp giữa Ca Trưởng, Nhạc Công và Ca Đoàn.</p>
      <div class="empty-actions">
        <button id="btn-empty-start-host" class="btn btn-primary btn-lg">👑 Mở Phòng Ca Trưởng (Host)</button>
        <button id="btn-empty-join-room" class="btn btn-secondary btn-lg">🔗 Tham Gia Phòng (Join)</button>
      </div>
    </div>

    <!-- OSMD Sheet Music Container -->
    <div id="stage-sheet-wrapper" class="stage-sheet-wrapper hidden">
      <div id="stage-osmd-container" class="stage-osmd-container"></div>
      <canvas id="stage-annotation-layer" class="stage-annotation-layer"></canvas>
    </div>

    <!-- Vocal Teleprompter View Container -->
    <div id="stage-lyric-wrapper" class="stage-lyric-wrapper hidden">
      <div id="stage-lyric-content" class="stage-lyric-content">
        <!-- Nội dung lời bài hát chữ lớn được render tại đây -->
      </div>
    </div>

  </main>

  <!-- Snap to Host Floating Button -->
  <button id="btn-snap-to-host" class="btn-snap-to-host hidden" title="Bấm để cuộn ngay về vị trí Ca Trưởng đang đứng">
    <span class="snap-icon">🔄</span>
    <span id="snap-label">Quay về Ca Trưởng (Đang ở Ô 1)</span>
  </button>

  <!-- Floating Live Cue Alert Banner -->
  <div id="stage-cue-banner" class="stage-cue-banner hidden">
    <div class="cue-banner-box">
      <span class="cue-banner-icon" id="cue-banner-icon">⚡</span>
      <div class="cue-banner-text" id="cue-banner-text">Chuẩn bị vào Điệp Khúc</div>
    </div>
  </div>

  <!-- Giant Visual Count-In Overlay -->
  <div id="stage-countin-overlay" class="stage-countin-overlay hidden">
    <div class="countin-center-box">
      <div class="countin-number" id="countin-giant-number">4</div>
      <div class="countin-subtext" id="countin-subtext">CHUẨN BỊ VÀO BÀI...</div>
      <div class="countin-dots" id="countin-dots">
        <span class="countin-dot active"></span>
        <span class="countin-dot"></span>
        <span class="countin-dot"></span>
        <span class="countin-dot"></span>
      </div>
    </div>
  </div>
