<?php
/**
 * includes/follow_leader_modal.php — Modal Theo Ca Trưởng & Kết Nối Ban Nhạc (Ticket L3-5)
 */
?>
<div id="follow-leader-modal" class="modal-overlay hidden" role="dialog" aria-modal="true" aria-labelledby="fl-modal-title">
  <div class="modal-box fl-modal-box">
    <div class="modal-header">
      <div class="d-flex items-center gap-2">
        <span class="fs-lg">📡</span>
        <h3 id="fl-modal-title" class="m-0 font-bold fs-base">Theo Ca Trưởng (Live Band Sync)</h3>
      </div>
      <button type="button" id="btn-close-follow-modal" class="icon-btn" title="Đóng modal" aria-label="Đóng">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>

    <!-- TABS CHUYỂN ĐỔI CHẾ ĐỘ -->
    <div class="fl-modal-tabs" role="tablist">
      <button type="button" id="fl-tab-follower" class="fl-tab-btn active" role="tab" aria-selected="true" aria-controls="fl-panel-follower">
        🎸 Theo Dõi Ca Trưởng
      </button>
      <button type="button" id="fl-tab-host" class="fl-tab-btn" role="tab" aria-selected="false" aria-controls="fl-panel-host">
        👑 Tôi Là Ca Trưởng
      </button>
    </div>

    <div class="modal-body mt-half">
      <!-- PANEL 1: THÀNH VIÊN THEO DÕI (FOLLOWER) -->
      <div id="fl-panel-follower" class="fl-tab-panel" role="tabpanel">
        <p class="text-xs text-muted mb-4">
          Tự động đồng bộ bài hát, tông nhạc, khổ hát và vị trí bản nhạc theo thời gian thực cùng ca trưởng.
        </p>

        <!-- Nhập Mã Phòng -->
        <div class="fl-field-group">
          <label for="fl-room-input" class="d-block mb-1 font-semibold text-sm">
            Mã phòng của ca trưởng:
          </label>
          <div class="d-flex gap-2">
            <input type="text" id="fl-room-input" class="form-input fl-room-input" placeholder="VD: BAND-2026" maxlength="20" autocomplete="off">
            <button type="button" id="btn-fl-join-submit" class="btn btn-primary fl-btn-submit">
              📡 Vào Theo
            </button>
          </div>
        </div>

        <!-- Quét Mã QR -->
        <div class="fl-qr-scan-section">
          <div class="d-flex justify-between items-center mb-2">
            <span class="text-sm font-semibold">Hoặc quét mã QR trên màn hình ca trưởng:</span>
            <button type="button" id="btn-fl-toggle-qr-cam" class="btn btn-ghost btn-xs">
              📷 <span id="fl-cam-btn-text">Bật Camera</span>
            </button>
          </div>

          <div id="fl-qr-scanner-box" class="fl-qr-scanner-box hidden">
            <video id="fl-qr-video" class="fl-qr-video" playsinline></video>
            <canvas id="fl-qr-canvas-hidden" class="hidden"></canvas>
            <div id="fl-qr-scan-guide" class="fl-qr-scan-guide">
              <span class="fl-qr-scan-line"></span>
            </div>
            <p class="text-xs text-muted text-center mt-half">
              Hướng camera về phía mã QR trên iPad/máy tính của Ca Trưởng
            </p>
          </div>
        </div>
      </div>

      <!-- PANEL 2: CA TRƯỞNG MỞ PHÒNG (HOST) -->
      <div id="fl-panel-host" class="fl-tab-panel hidden" role="tabpanel">
        <p class="text-xs text-muted mb-4">
          Mở phòng phát sóng thời gian thực. Khi bạn chuyển bài, đổi tông, chọn khổ hay cuộn nhạc, toàn bộ ca viên và nhạc công sẽ đồng bộ ngay lập tức.
        </p>

        <!-- Trạng thái chưa mở phòng -->
        <div id="fl-host-idle-view">
          <div class="fl-field-group">
            <label for="fl-host-code-input" class="d-block mb-1 font-semibold text-sm">
              Đặt mã phòng (tuỳ chọn):
            </label>
            <div class="d-flex gap-2">
              <input type="text" id="fl-host-code-input" class="form-input flex-1 font-bold" placeholder="Tự sinh nếu để trống (VD: BAND-xxxx)" maxlength="20">
              <button type="button" id="btn-fl-host-submit" class="btn btn-primary fl-btn-submit">
                🎙️ Mở Phòng
              </button>
            </div>
          </div>
        </div>

        <!-- Trạng thái đã mở phòng -->
        <div id="fl-host-active-view" class="hidden d-flex flex-col items-center text-center gap-3">
          <div class="fl-host-room-card">
            <div class="fl-host-room-title">Mã Phòng Phát Sóng</div>
            <div id="fl-host-room-display" class="fl-host-room-value">BAND-2026</div>
            <div class="fl-host-room-status">● Đang phát sóng thời gian thực</div>
          </div>

          <!-- Canvas QR to rõ để ca đoàn quét -->
          <div class="fl-qr-card">
            <canvas id="fl-host-qr-canvas" width="180" height="180" class="fl-qr-canvas"></canvas>
            <span class="d-block text-xs text-muted mt-half">Ca đoàn quét mã này bằng điện thoại/iPad</span>
          </div>

          <!-- Link chia sẻ 1-chạm -->
          <div class="w-full d-flex gap-1">
            <input type="text" id="fl-host-link-display" class="form-input fl-link-display" readonly>
            <button type="button" id="btn-fl-copy-share-link" class="btn btn-ghost btn-sm" title="Sao chép link">📋 Copy</button>
          </div>

          <!-- THÔNG ĐIỆP CA TRƯỞNG TỨC THỜI (ONSONG CUES - TICKET L3-6) -->
          <div class="fl-host-cues-section">
            <div class="d-flex items-center justify-between mb-2">
              <span class="text-sm font-bold">📣 Nhắc Ban Nhạc (OnSong Cues):</span>
              <span class="text-xs text-muted">(Tự tắt sau 5s)</span>
            </div>
            
            <div class="fl-cues-grid">
              <button type="button" class="btn btn-secondary btn-xs btn-fl-cue fl-cue-btn" data-cue="repeat" data-icon="🔁" data-text="Lặp Điệp Khúc">
                🔁 Lặp ĐK
              </button>
              <button type="button" class="btn btn-secondary btn-xs btn-fl-cue fl-cue-btn" data-cue="slow" data-icon="⏳" data-text="Khổ cuối chậm">
                ⏳ Chậm lại
              </button>
              <button type="button" class="btn btn-secondary btn-xs btn-fl-cue fl-cue-btn" data-cue="key" data-icon="🎺" data-text="Lên tông (+1)">
                🎺 Lên tông
              </button>
              <button type="button" class="btn btn-secondary btn-xs btn-fl-cue fl-cue-btn" data-cue="ending" data-icon="🛑" data-text="Chuẩn bị kết">
                🛑 Kết bài
              </button>
              <button type="button" class="btn btn-secondary btn-xs btn-fl-cue fl-cue-btn" data-cue="intro" data-icon="🎹" data-text="Dạo lại intro">
                🎹 Dạo lại
              </button>
              <button type="button" class="btn btn-secondary btn-xs btn-fl-cue fl-cue-btn" data-cue="custom" data-icon="📢" data-text="Chú ý nhịp phách">
                📢 Chú ý nhịp
              </button>
            </div>

            <div class="d-flex gap-1">
              <input type="text" id="fl-cue-custom-input" class="form-input text-xs fl-cue-custom-input" placeholder="Thông điệp tùy ý (VD: Ngắt tự do...)" maxlength="50">
              <button type="button" id="btn-fl-send-custom-cue" class="btn btn-primary btn-xs fl-btn-send">Gửi</button>
            </div>
          </div>

          <button type="button" id="btn-fl-host-leave" class="btn btn-danger btn-sm w-full mt-half">
            👋 Kết Thúc Buổi Phát Sóng
          </button>
        </div>
      </div>
    </div>
  </div>
</div>
