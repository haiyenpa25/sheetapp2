<?php
/**
 * includes/follow_leader_modal.php — Modal Theo Ca Trưởng & Kết Nối Ban Nhạc (Ticket L3-5)
 */
?>
<div id="follow-leader-modal" class="modal-overlay hidden" role="dialog" aria-modal="true" aria-labelledby="fl-modal-title">
  <div class="modal-box fl-modal-box" style="max-width: 480px;">
    <div class="modal-header">
      <div style="display:flex;align-items:center;gap:.6rem;">
        <span style="font-size:1.3rem;">📡</span>
        <h3 id="fl-modal-title" style="margin:0;font-size:1.08rem;font-weight:700;">Theo Ca Trưởng (Live Band Sync)</h3>
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

    <div class="modal-body" style="padding-top:1rem;">
      <!-- PANEL 1: THÀNH VIÊN THEO DÕI (FOLLOWER) -->
      <div id="fl-panel-follower" class="fl-tab-panel" role="tabpanel">
        <p class="text-xs text-muted" style="margin-top:0;margin-bottom:1rem;line-height:1.5;">
          Tự động đồng bộ bài hát, tông nhạc, khổ hát và vị trí bản nhạc theo thời gian thực cùng ca trưởng.
        </p>

        <!-- Nhập Mã Phòng -->
        <div class="fl-field-group">
          <label for="fl-room-input" style="font-size:.82rem;font-weight:600;display:block;margin-bottom:.4rem;">
            Mã phòng của ca trưởng:
          </label>
          <div style="display:flex;gap:.5rem;">
            <input type="text" id="fl-room-input" class="form-input" style="flex:1;text-transform:uppercase;font-weight:700;font-size:1.05rem;letter-spacing:1px;" placeholder="VD: BAND-2026" maxlength="20" autocomplete="off">
            <button type="button" id="btn-fl-join-submit" class="btn btn-primary" style="padding:0 1.25rem;font-weight:700;">
              📡 Vào Theo
            </button>
          </div>
        </div>

        <!-- Quét Mã QR -->
        <div class="fl-qr-scan-section" style="margin-top:1.25rem;border-top:1px dashed var(--border);padding-top:1rem;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.6rem;">
            <span style="font-size:.82rem;font-weight:600;">Hoặc quét mã QR trên màn hình ca trưởng:</span>
            <button type="button" id="btn-fl-toggle-qr-cam" class="btn btn-ghost btn-xs" style="color:var(--accent);">
              📷 <span id="fl-cam-btn-text">Bật Camera</span>
            </button>
          </div>

          <div id="fl-qr-scanner-box" class="fl-qr-scanner-box hidden">
            <video id="fl-qr-video" class="fl-qr-video" playsinline></video>
            <canvas id="fl-qr-canvas-hidden" style="display:none;"></canvas>
            <div id="fl-qr-scan-guide" class="fl-qr-scan-guide">
              <span class="fl-qr-scan-line"></span>
            </div>
            <p class="text-xs text-muted" style="text-align:center;margin-top:.4rem;">
              Hướng camera về phía mã QR trên iPad/máy tính của Ca Trưởng
            </p>
          </div>
        </div>
      </div>

      <!-- PANEL 2: CA TRƯỞNG MỞ PHÒNG (HOST) -->
      <div id="fl-panel-host" class="fl-tab-panel hidden" role="tabpanel">
        <p class="text-xs text-muted" style="margin-top:0;margin-bottom:1rem;line-height:1.5;">
          Mở phòng phát sóng thời gian thực. Khi bạn chuyển bài, đổi tông, chọn khổ hay cuộn nhạc, toàn bộ ca viên và nhạc công sẽ đồng bộ ngay lập tức.
        </p>

        <!-- Trạng thái chưa mở phòng -->
        <div id="fl-host-idle-view">
          <div class="fl-field-group">
            <label for="fl-host-code-input" style="font-size:.82rem;font-weight:600;display:block;margin-bottom:.4rem;">
              Đặt mã phòng (tuỳ chọn):
            </label>
            <div style="display:flex;gap:.5rem;">
              <input type="text" id="fl-host-code-input" class="form-input" style="flex:1;text-transform:uppercase;font-weight:700;" placeholder="Tự sinh nếu để trống (VD: BAND-xxxx)" maxlength="20">
              <button type="button" id="btn-fl-host-submit" class="btn btn-primary" style="padding:0 1.25rem;font-weight:700;">
                🎙️ Mở Phòng
              </button>
            </div>
          </div>
        </div>

        <!-- Trạng thái đã mở phòng -->
        <div id="fl-host-active-view" class="hidden" style="display:flex;flex-direction:column;align-items:center;text-align:center;gap:.85rem;">
          <div style="background:rgba(109,40,217,0.08);border:1px solid rgba(109,40,217,0.25);border-radius:var(--radius-md);padding:.6rem 1.2rem;width:100%;box-sizing:border-box;">
            <div style="font-size:.75rem;color:var(--text-secondary);text-transform:uppercase;font-weight:600;">Mã Phòng Phát Sóng</div>
            <div id="fl-host-room-display" style="font-size:1.5rem;font-weight:800;color:var(--accent);letter-spacing:1px;margin:.15rem 0;">BAND-2026</div>
            <div style="font-size:.75rem;color:#10b981;font-weight:600;">● Đang phát sóng thời gian thực</div>
          </div>

          <!-- Canvas QR to rõ để ca đoàn quét -->
          <div style="background:#fff;padding:.6rem;border-radius:var(--radius-md);border:1px solid var(--border);box-shadow:0 3px 10px rgba(0,0,0,0.06);">
            <canvas id="fl-host-qr-canvas" width="180" height="180" style="display:block;border-radius:4px;"></canvas>
            <span style="font-size:.72rem;color:var(--text-muted);display:block;margin-top:.3rem;">Ca đoàn quét mã này bằng điện thoại/iPad</span>
          </div>

          <!-- Link chia sẻ 1-chạm -->
          <div style="width:100%;display:flex;gap:.4rem;">
            <input type="text" id="fl-host-link-display" class="form-input" readonly style="flex:1;font-size:.8rem;background:var(--bg-overlay);">
            <button type="button" id="btn-fl-copy-share-link" class="btn btn-ghost btn-sm" title="Sao chép link">📋 Copy</button>
          </div>

          <button type="button" id="btn-fl-host-leave" class="btn btn-danger btn-sm w-full" style="margin-top:.3rem;">
            👋 Kết Thúc Buổi Phát Sóng
          </button>
        </div>
      </div>
    </div>
  </div>
</div>
