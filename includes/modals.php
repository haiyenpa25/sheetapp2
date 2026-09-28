<!-- ===== SESSION PANEL (SLIDE-IN) ===== -->
<div id="session-panel" class="session-panel hidden" role="dialog" aria-modal="true" aria-labelledby="session-panel-title">
  <div class="panel-header">
    <h3 id="session-panel-title">📋 Nhật Ký Biểu Diễn</h3>
    <button id="btn-close-session" class="icon-btn">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
  </div>
  <div class="panel-body">
    <div class="session-current">
      <h4>Phiên Hiện Tại</h4>
      <div class="session-meta">
        <span id="session-date" class="tag"></span>
        <span id="session-tone" class="tag tag-purple"></span>
      </div>
      <textarea id="session-note" placeholder="Ghi chú cho buổi hôm nay..." rows="3"></textarea>
      <button id="btn-save-session" class="btn btn-primary btn-sm">💾 Lưu Phiên</button>
    </div>
    <div class="session-history">
      <h4>Lịch Sử</h4>
      <div id="session-history-list" class="history-list">
        <p class="text-muted">Chưa có lịch sử</p>
      </div>
    </div>
  </div>
</div>


<!-- ===== LIVE BAND SYNC MODAL V2 ===== -->
<div id="livesync-modal" class="modal-overlay hidden" role="dialog" aria-modal="true" aria-labelledby="livesync-modal-title">
  <div class="modal-box modal-box modal-box-md">
    <div class="modal-header">
      <div class="d-flex items-center gap-2">
        <span class="fs-lg">📡</span>
        <h3 id="livesync-modal-title" class="m-0 fs-base">Đồng Bộ Biểu Diễn Live (Live Band Sync)</h3>
      </div>
      <button id="btn-close-livesync-modal" class="icon-btn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <div class="modal-body">
      
      <!-- 1. CHƯA VÀO PHÒNG (SETUP) -->
      <div id="live-setup-section" class="d-flex flex-col gap-3">
        <p class="help-text mt-0">Đồng bộ bài hát, dịch giọng và vị trí ô nhịp theo thời gian thực cho ban nhạc.</p>

        <!-- HOST (CA TRƯỞNG) -->
        <div class="card-surface p-3 mb-3">
          <h4 class="m-0 text-accent font-semibold">🎙️ Ca Trưởng / Trưởng Nhóm (Host)</h4>
          <p class="text-xs text-muted mb-3">Mở phòng phát sóng. Khi bạn chọn bài, dịch giọng hay cuộn nhạc, cả ban nhạc sẽ chạy theo.</p>
          <div class="d-flex gap-2">
            <input type="text" id="host-room-code-input" class="form-input flex-1 font-bold text-uppercase" placeholder="Mã phòng (VD: BAND-2026)">
            <button id="btn-start-host-room" class="btn btn-primary btn-sm">📡 Mở Phòng</button>
          </div>
        </div>

        <!-- JOIN (MEMBER) -->
        <div class="card-surface p-3 mb-3">
          <h4 class="m-0 text-success font-semibold">🎸 Thành Viên Ban Nhạc (Join)</h4>
          <p class="text-xs text-muted mb-3">Nhập mã phòng từ Ca Trưởng hoặc quét mã QR để đồng bộ màn hình.</p>
          <div class="d-flex gap-2">
            <input type="text" id="join-room-code-input" class="form-input flex-1 font-bold text-uppercase" placeholder="Nhập Mã Phòng">
            <button id="btn-join-live-room" class="btn btn-sm btn-success-solid">🔗 Tham Gia</button>
          </div>
        </div>
      </div>

      <!-- 2. ĐANG TRONG PHÒNG (ACTIVE SESSION) -->
      <div id="live-active-section" class="hidden d-flex flex-col gap-3 items-center text-center">
        <div class="fl-host-room-card">
          <div class="text-xs text-muted text-uppercase font-semibold">Mã Phòng Đang Phát</div>
          <div id="live-room-code-display" class="fl-host-room-value">BAND-2026</div>
          <div class="text-xs text-success font-semibold">● Đang kết nối thời gian thực</div>
        </div>

        <!-- QR CODE CANVAS -->
        <div class="fl-qr-card d-flex flex-col items-center gap-1">
          <canvas id="live-qr-canvas" width="180" height="180" class="fl-qr-canvas"></canvas>
          <span class="text-xs text-muted">Quét mã để vào phòng tức thì trên iPad/Điện thoại</span>
        </div>

        <!-- SHARE LINK -->
        <div class="w-full">
          <label class="text-xs text-muted d-block text-left mb-1 font-semibold">Link tham gia 1-chạm:</label>
          <div class="d-flex gap-2">
            <input type="text" id="live-room-link-display" class="form-input" readonly class="form-input flex-1 text-sm bg-overlay">
            <button id="btn-copy-live-link" class="btn btn-ghost btn-sm" title="Sao chép link">📋 Copy</button>
          </div>
        </div>

        <!-- ROLE PREFERENCE -->
        <div class="card-surface p-2 mb-2 text-left">
          <label class="text-sm font-semibold d-block mb-1">Vai Trò Hiển Thị Của Bạn:</label>
          <select id="live-role-select" class="form-select w-full">
            <option value="leader">👑 Trưởng Ban / Ca Trưởng</option>
            <option value="guitar">🎸 Guitar (Hiện Hợp Âm & Capo)</option>
            <option value="piano">🎹 Piano / Organ (Bản Nhạc 2 Tay)</option>
            <option value="vocal">🎤 Ca Đoàn (Chế Độ Lời Nhạc)</option>
            <option value="viewer">👀 Khán Giả / Thành Viên</option>
          </select>
        </div>

        <!-- HOST COUNT-IN TRIGGER -->
        <div id="live-host-controls" class="w-full">
          <button id="btn-live-count-in" class="btn btn-primary btn-sm w-full" style="background:linear-gradient(135deg,#7c3aed,#6d28d9);font-weight:700;height:38px;">⏱️ Đếm Nhịp Vào Bài (1, 2, 3, 4)</button>
        </div>

        <button id="btn-leave-live-room" class="btn btn-danger btn-sm w-full mt-half">👋 Rời Khỏi Phòng</button>
      </div>

    </div>
  </div>
</div>

<!-- ===== INSTRUMENT MIXER MODAL ===== -->

<div id="mixer-modal" class="modal-overlay hidden" role="dialog" aria-modal="true" aria-labelledby="mixer-modal-title">
  <div class="modal-box" style="max-width: 400px;">
    <div class="modal-header">
      <h3 id="mixer-modal-title">🎛 Bộ Trộn Nhạc Cụ (Mixer)</h3>
      <button id="btn-close-mixer" class="icon-btn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <div class="modal-body">
      <p class="help-text mb-0">Bật/tắt các dải nhạc cụ để hiển thị sheet gọng gàng hơn.</p>
      <div id="mixer-instruments-list" style="display:flex;flex-direction:column;gap:.5rem;margin-top:.5rem;max-height:300px;overflow-y:auto;padding:.5rem;background:var(--bg-overlay);border-radius:var(--radius-sm);border:1px solid var(--border);">
        <p class="text-muted text-sm text-center">Chưa có bài nhạc nào được tải.</p>
      </div>
      <button id="btn-mixer-apply" class="btn btn-primary w-full mt-1">Áp Dụng & Tải Lại</button>
    </div>
  </div>
</div>

<!-- ===== AUTH & WELCOME MODAL ===== -->
<div id="auth-modal" class="modal-overlay hidden" role="dialog" aria-modal="true" aria-labelledby="auth-modal-title">
  <div class="modal-box" style="max-width: 420px; border: 1px solid rgba(124, 58, 237, 0.35); box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5), 0 0 20px rgba(124, 58, 237, 0.15);">
    <div class="modal-header" style="padding: 1.1rem 1.25rem 0.9rem; border-bottom: 1px solid var(--border); background: linear-gradient(180deg, rgba(124, 58, 237, 0.12) 0%, transparent 100%);">
      <div style="display: flex; align-items: center; gap: 10px;">
        <div style="width: 36px; height: 36px; border-radius: 9px; background: linear-gradient(135deg, #7c3aed, #4f46e5); display: flex; align-items: center; justify-content: center; font-size: 1.15rem; box-shadow: 0 3px 10px rgba(124, 58, 237, 0.4); flex-shrink: 0;">
          🎵
        </div>
        <div>
          <h3 id="auth-modal-title" style="margin: 0; font-size: 1rem; font-weight: 700; color: var(--text-primary); letter-spacing: -0.2px;">Chào Mừng Đến SheetApp 2.0</h3>
          <p style="margin: 2px 0 0; font-size: 0.74rem; color: var(--text-muted);">Sheet nhạc Thánh Ca & Hợp âm Ban Nhạc</p>
        </div>
      </div>
      <button id="btn-close-auth" class="icon-btn" title="Đóng & sử dụng quyền Khách" style="border-radius: 8px;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>

    <div class="modal-body" style="padding: 1.15rem; gap: 0.9rem;">
      <!-- KHUNG CHƯA ĐĂNG NHẬP: LỰA CHỌN KHÁCH HOẶC ĐĂNG NHẬP -->
      <div id="auth-login-form" style="display: flex; flex-direction: column; gap: 0.85rem;">
        
        <!-- LỰA CHỌN 1: DÀNH CHO KHÁCH / CA VIÊN (KHÔNG CẦN TÀI KHOẢN) -->
        <div class="auth-guest-card" style="padding: 12px 14px; border-radius: 10px; background: rgba(59, 130, 246, 0.08); border: 1px solid rgba(59, 130, 246, 0.25); display: flex; flex-direction: column; gap: 7px;">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <span style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #60a5fa;">Dành Cho Ca Viên &amp; Khách</span>
            <span style="font-size: 0.67rem; padding: 2px 6px; border-radius: 4px; background: rgba(59, 130, 246, 0.2); color: #93c5fd; font-weight: 600;">Miễn phí • Không cần pass</span>
          </div>
          <button type="button" id="btn-enter-as-guest" class="btn w-full" style="padding: 9px 12px; background: linear-gradient(135deg, #2563eb, #1d4ed8); color: #fff; font-size: 0.86rem; font-weight: 700; border-radius: 8px; border: 1px solid rgba(147, 197, 253, 0.3); display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; box-shadow: 0 3px 10px rgba(37, 99, 235, 0.35); transition: all 0.2s;">
            <span>👁️</span>
            <span>Vào Ngay Dưới Quyền Khách (Chỉ Xem)</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width: 15px; height: 15px; margin-left: 2px;"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </button>
          <p style="margin: 0; font-size: 0.72rem; color: var(--text-muted); line-height: 1.4;">
            ✓ Xem 903 bài &amp; hợp âm đầy đủ &nbsp;•&nbsp; ✓ Nghe audio 4 bè &nbsp;•&nbsp; ✓ Tự tập đàn
          </p>
        </div>

        <!-- PHÂN CÁCH -->
        <div style="display: flex; align-items: center; gap: 8px; margin: 2px 0;">
          <div class="divider-line"></div>
          <span style="font-size: 0.66rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted);">Hoặc Đăng Nhập Nhạc Công</span>
          <div class="divider-line"></div>
        </div>

        <!-- FORM ĐĂNG NHẬP -->
        <div style="display: flex; flex-direction: column; gap: 7px;">
          <div>
            <label class="form-label" class="text-xs text-muted font-semibold d-block mb-1">Tài khoản</label>
            <input id="auth-username-input" type="text" class="form-input" placeholder="Tên đăng nhập (VD: hoaidinh, admin...)" autocomplete="username" class="p-btn-sm">
          </div>
          <div>
            <label class="form-label" class="text-xs text-muted font-semibold d-block mb-1">Mật khẩu</label>
            <input id="auth-password-input" type="password" class="form-input" placeholder="Mật khẩu" autocomplete="current-password" class="p-btn-sm">
          </div>
          <p id="auth-error" class="text-sm text-danger hidden" style="margin: 0; font-size: 0.75rem;"></p>
          <button id="btn-do-login" class="btn btn-primary w-full" style="padding: 8px 12px; font-size: 0.85rem; font-weight: 700; margin-top: 3px;">
            🔒 Đăng Nhập (Để Sửa Hợp Âm Riêng)
          </button>
        </div>

      </div>

      <!-- KHUNG ĐÃ ĐĂNG NHẬP: THÔNG TIN TÀI KHOẢN & QUYỀN HẠN -->
      <div id="auth-logged-in" class="hidden" style="display: flex; flex-direction: column; gap: 10px;">
        <div style="padding: 12px; border-radius: 8px; background: rgba(124, 58, 237, 0.1); border: 1px solid rgba(124, 58, 237, 0.3); display: flex; align-items: center; gap: 12px;">
          <div style="width: 42px; height: 42px; border-radius: 50%; background: linear-gradient(135deg, #7c3aed, #4f46e5); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 1.25rem; font-weight: 800; flex-shrink: 0;" id="auth-avatar-letter">
            U
          </div>
          <div style="flex: 1; min-width: 0;">
            <div style="font-size: 0.95rem; font-weight: 700; color: var(--text-primary); display: flex; align-items: center; gap: 6px;">
              <span id="auth-logged-user-title">@user</span>
              <span id="auth-role-display-pill" style="font-size: 0.66rem; padding: 2px 6px; border-radius: 4px; font-weight: 700; text-transform: uppercase;"></span>
            </div>
            <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">
              Mã bộ hợp âm cá nhân: <strong id="auth-chord-code-display" style="color: #a78bfa;">--</strong>
            </div>
          </div>
        </div>

        <div style="padding: 10px 12px; border-radius: 8px; background: var(--bg-overlay); border: 1px solid var(--border);">
          <div style="font-size: 0.7rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 4px;">Quyền Hạn Hiện Tại:</div>
          <p id="auth-perm-summary" style="margin: 0; font-size: 0.76rem; color: var(--text-secondary); line-height: 1.5;"></p>
        </div>

        <div style="display: flex; gap: 8px; margin-top: 4px;">
          <button type="button" id="btn-continue-logged-in" class="btn btn-primary" style="flex: 2; padding: 8px 12px; font-size: 0.85rem; font-weight: 700;">
            ✓ Tiếp Tục Dùng
          </button>
          <button type="button" id="btn-do-logout" class="btn btn-danger" style="flex: 1; padding: 8px 12px; font-size: 0.85rem; font-weight: 600;">
            Đăng Xuất
          </button>
        </div>
      </div>

      <!-- KHUNG BẮT BUỘC ĐỔI MẬT KHẨU YẾU / MẶC ĐỊNH -->
      <div id="auth-force-change" class="hidden" style="display:flex; flex-direction:column; gap:8px;">
        <div style="padding:8px 10px; border-radius:6px; background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.3); font-size:0.75rem; color:var(--text-secondary);">
          <strong style="color:var(--danger,#ef4444);">⚠️ Cần đổi mật khẩu:</strong> Vui lòng đặt mật khẩu mới (tối thiểu 10 ký tự).
        </div>
        <form id="form-force-change-password" style="display:flex; flex-direction:column; gap:6px;">
          <input id="force-current-password" type="password" class="form-input" placeholder="Mật khẩu vừa đăng nhập" required class="p-btn-sm">
          <input id="force-new-password" type="password" class="form-input" placeholder="Mật khẩu mới (tối thiểu 10 ký tự)" minlength="10" required class="p-btn-sm">
          <input id="force-confirm-password" type="password" class="form-input" placeholder="Xác nhận lại mật khẩu mới" minlength="10" required class="p-btn-sm">
          <p id="force-password-error" class="text-sm text-danger hidden" style="margin:0; font-size:0.74rem;"></p>
          <button type="submit" id="btn-force-submit" class="btn btn-primary w-full" style="padding:7px; font-size:0.84rem; font-weight:700;">✓ Cập Nhật Mật Khẩu</button>
          <button type="button" id="btn-force-logout" class="btn btn-ghost w-full" style="padding:4px; font-size:0.76rem; color:var(--text-muted);">Đăng xuất</button>
        </form>
      </div>
    </div>
  </div>
</div>
<!-- ===== TOAST NOTIFICATION ===== -->
<div id="toast-container" class="toast-container"></div>
<!-- ===== ADD TO SETLIST & CREATE SETLIST MODAL (UNIFIED) ===== -->
<div id="add-to-setlist-modal" class="modal-overlay hidden" role="dialog" aria-modal="true" aria-labelledby="setlist-modal-title">
  <div class="modal-box" style="max-width: 440px;">
    <div class="modal-header">
      <div class="d-flex items-center gap-2">
        <span class="fs-lg">📋</span>
        <h3 id="setlist-modal-title" class="m-0 fs-base">Thêm vào Setlist</h3>
      </div>
      <button id="btn-close-add-setlist" class="icon-btn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <div class="modal-body" style="min-height: 150px; max-height: 380px; overflow-y: auto;">
      <!-- Pick Existing Setlist View -->
      <div id="add-setlist-pick-view">
        <p style="margin-bottom: 0.5rem; color: var(--text-secondary); font-size: 0.85rem;">Chọn một Setlist để lưu bài hát này:</p>
        <div id="add-to-setlist-options" class="song-list" style="padding: 0;"></div>
        <div style="margin-top: 1rem; padding-top: 0.75rem; border-top: 1px solid var(--border);">
          <button type="button" id="btn-toggle-inline-create-setlist" class="btn btn-ghost w-full" style="color:var(--accent);font-weight:600;font-size:0.85rem;border:1px dashed var(--border);">
            ➕ Tạo Setlist Mới
          </button>
        </div>
      </div>

      <!-- Inlined Create Setlist Section (Service Plan) -->
      <div id="create-setlist-modal" class="hidden">
        <form id="form-create-setlist" onsubmit="return false;">
          <div style="margin-bottom: 0.75rem;">
            <label class="form-label-bold">Tên Chương Trình / Setlist <span style="color:#ef4444;">*</span></label>
            <input type="text" id="create-setlist-title-input" class="form-input text-xs w-full box-border" placeholder="VD: Lễ Chúa Nhật 1, Worship 20/4, Ban Hát..." required autocomplete="off">
          </div>
          <div style="display:flex; gap:0.5rem; margin-bottom: 0.75rem;">
            <div class="flex-1">
              <label class="form-label-bold">Ngày diễn ra</label>
              <input type="date" id="create-setlist-date-input" class="form-input text-xs w-full box-border">
            </div>
            <div style="width: 105px;">
              <label class="form-label-bold">Giờ bắt đầu</label>
              <input type="time" id="create-setlist-time-input" class="form-input text-xs w-full box-border" value="08:30">
            </div>
          </div>
          <div style="margin-bottom: 0.85rem;">
            <label class="form-label-bold">Chủ đề thờ phượng (Tùy chọn)</label>
            <input type="text" id="create-setlist-theme-input" class="form-input text-xs w-full box-border" placeholder="VD: Tình Yêu Cứu Rỗi, Phục Sinh, Tạ Ơn...">
          </div>
          <div style="display:flex;gap:0.5rem;">
            <button type="button" id="btn-cancel-create-setlist" class="btn btn-ghost flex-1">Hủy</button>
            <button type="submit" id="btn-confirm-create-setlist" class="btn btn-primary flex-2">✓ Tạo Chương Trình</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</div>

<!-- ===== TRANSPOSE PICK MODAL (Chọn Tông Tập Trực Quan) ===== -->
<div id="transpose-pick-modal" class="modal-overlay hidden" role="dialog" aria-modal="true" aria-labelledby="transpose-pick-modal-title">
  <div class="modal-box" style="max-width:380px;">
    <div class="modal-header">
      <div class="d-flex items-center gap-2">
        <span class="fs-lg">🎵</span>
        <h3 id="transpose-pick-modal-title" class="m-0 fs-base">Chọn Tông Tập Cho Bài Hát</h3>
      </div>
      <button id="btn-close-transpose-pick" class="icon-btn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <div class="modal-body">
      <div id="transpose-pick-song-name" style="font-weight:700;font-size:.9rem;margin-bottom:.85rem;padding:.5rem .75rem;background:var(--bg-overlay);border-radius:var(--radius-sm);border:1px solid var(--border);color:var(--text-primary);"></div>
      
      <!-- Live Preview: Tông Gốc ➔ Tông Tập -->
      <div id="tp-preview-box" style="display:flex;align-items:center;justify-content:center;gap:.85rem;padding:.75rem 1rem;background:linear-gradient(135deg, rgba(109,40,217,0.08), rgba(59,130,246,0.08));border:1px solid rgba(109,40,217,0.25);border-radius:var(--radius-md);margin-bottom:1rem;text-align:center;">
        <div class="d-flex flex-col items-center">
          <span style="font-size:.72rem;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Tông gốc</span>
          <span id="tp-orig-key-display" style="font-size:1.2rem;font-weight:800;color:var(--text-primary);margin-top:2px;">—</span>
        </div>
        <div style="font-size:1.3rem;color:var(--accent);line-height:1;margin:0 2px;">➔</div>
        <div class="d-flex flex-col items-center">
          <span style="font-size:.72rem;color:var(--accent);text-transform:uppercase;letter-spacing:0.5px;font-weight:700;">Tông tập</span>
          <span id="tp-target-key-display" style="font-size:1.35rem;font-weight:800;color:var(--accent);margin-top:2px;">—</span>
        </div>
        <div id="tp-diff-display" style="font-size:.75rem;padding:3px 8px;border-radius:12px;background:rgba(109,40,217,0.15);color:var(--accent);font-weight:700;margin-left:4px;">Gốc (0)</div>
      </div>

      <p style="font-size:.82rem;color:var(--text-secondary);margin-bottom:.55rem;font-weight:500;">Chọn nhanh số nửa cung (semitones):</p>
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:.4rem;margin-bottom:.85rem;">
        <button class="tp-btn" data-v="-5">-5</button>
        <button class="tp-btn" data-v="-4">-4</button>
        <button class="tp-btn" data-v="-3">-3</button>
        <button class="tp-btn" data-v="-2">-2</button>
        <button class="tp-btn" data-v="-1">-1</button>
        <button class="tp-btn tp-zero active" data-v="0" style="font-weight:700;">0 (Gốc)</button>
        <button class="tp-btn" data-v="1">+1</button>
        <button class="tp-btn" data-v="2">+2</button>
        <button class="tp-btn" data-v="3">+3</button>
        <button class="tp-btn" data-v="4">+4</button>
        <button class="tp-btn" data-v="5">+5</button>
      </div>
      
      <div style="display:flex;align-items:center;justify-content:space-between;gap:.5rem;margin-bottom:.85rem;background:var(--bg-overlay);padding:6px 12px;border-radius:var(--radius-sm);border:1px solid var(--border);">
        <label style="font-size:.82rem;color:var(--text-secondary);font-weight:500;">Tùy chỉnh số nửa cung:</label>
        <input id="transpose-pick-custom" type="number" min="-12" max="12" value="0"
          class="form-input" style="width:75px;text-align:center;font-size:.95rem;font-weight:700;height:32px;">
      </div>

      <!-- Chọn Tempo / BPM khi thêm bài vào Setlist -->
      <div style="margin-bottom:1.15rem;background:var(--bg-overlay);padding:8px 12px;border-radius:var(--radius-sm);border:1px solid var(--border);">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
          <label style="font-size:.82rem;color:var(--text-secondary);font-weight:600;">⏱️ Tốc độ (Tempo / BPM):</label>
          <div style="display:flex;align-items:center;gap:4px;">
            <button type="button" id="tp-bpm-dec" class="btn-tool-sm" title="Giảm 1 BPM">−</button>
            <input id="transpose-pick-bpm" type="number" min="30" max="250" value="100" class="form-input" style="width:65px;text-align:center;font-size:.95rem;font-weight:700;height:30px;">
            <button type="button" id="tp-bpm-inc" class="btn-tool-sm" title="Tăng 1 BPM">+</button>
          </div>
        </div>
        <div style="display:flex;gap:4px;">
          <button type="button" class="tp-bpm-preset" data-bpm="68" class="btn-choice-sm">68 Chậm</button>
          <button type="button" class="tp-bpm-preset" data-bpm="80" class="btn-choice-sm">80 Vừa</button>
          <button type="button" class="tp-bpm-preset" data-bpm="100" class="btn-choice-sm">100 Nhanh</button>
          <button type="button" class="tp-bpm-preset" data-bpm="120" class="btn-choice-sm">120 Rộn</button>
        </div>
      </div>
      
      <div class="d-flex gap-2">
        <button id="btn-transpose-pick-cancel" class="btn btn-ghost flex-1">Hủy</button>
        <button id="btn-transpose-pick-ok" class="btn btn-primary flex-2">✓ Xác Nhận & Mở Bài</button>
      </div>
    </div>
  </div>
</div>

<!-- ===== TEMPO PICK BOTTOM SHEET (Chỉnh Tốc Độ BPM Trực Quan) ===== -->
<div id="tempo-pick-modal" class="bottom-sheet hidden" role="dialog" aria-modal="true" aria-labelledby="tempo-pick-modal-title">
  <div class="modal-header">
    <div class="d-flex items-center gap-2">
      <span class="fs-lg">⏱️</span>
      <h3 id="tempo-pick-modal-title" class="m-0 fs-base">Chỉnh Tốc Độ (Tempo / BPM)</h3>
    </div>
    <button id="btn-close-tempo-pick" class="icon-btn">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
  </div>
  <div class="modal-body">
    <!-- BPM Value Display -->
    <div style="display:flex;align-items:center;justify-content:center;gap:.75rem;padding:1rem;background:linear-gradient(135deg, rgba(16,185,129,0.08), rgba(59,130,246,0.08));border:1px solid rgba(16,185,129,0.25);border-radius:var(--radius-md);margin-bottom:1rem;text-align:center;">
      <button id="tempo-modal-dec" class="tempo-btn" class="btn-tool-lg">−</button>
      <div style="display:flex;flex-direction:column;align-items:center;min-width:100px;">
        <span id="tempo-modal-val" style="font-size:2.2rem;font-weight:900;color:var(--text-primary);line-height:1;">80</span>
        <span style="font-size:.75rem;color:var(--text-muted);font-weight:700;margin-top:4px;">BPM</span>
      </div>
      <button id="tempo-modal-inc" class="tempo-btn" class="btn-tool-lg">+</button>
    </div>

    <!-- Slider -->
    <div class="mb-4">
      <input type="range" id="tempo-modal-slider" min="40" max="220" value="80" style="width:100%;cursor:pointer;touch-action:manipulation;">
    </div>

    <!-- Presets -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:1rem;">
      <button class="tempo-preset-btn" data-bpm="68" class="btn-choice-md">68 Chậm</button>
      <button class="tempo-preset-btn" data-bpm="80" class="btn-choice-md">80 Vừa</button>
      <button class="tempo-preset-btn" data-bpm="100" class="btn-choice-md">100 Nhanh</button>
      <button class="tempo-preset-btn" data-bpm="120" class="btn-choice-md">120 Rộn rã</button>
    </div>

    <!-- TAP Tempo & Metronome panel toggle -->
    <div style="display:flex;gap:6px;margin-bottom:1.2rem;">
      <button id="tempo-modal-tap" class="btn btn-ghost" style="flex:1;font-weight:700;letter-spacing:.5px;border:1px solid #10b981;color:#10b981;touch-action:manipulation;">👆 TAP TEMPO</button>
      <button id="tempo-modal-metronome" class="btn btn-ghost" style="flex:1;font-weight:600;" title="Mở bảng gõ nhịp chi tiết">🔊 Bật Nhịp</button>
    </div>

    <div class="d-flex gap-2">
      <button id="btn-tempo-pick-cancel" class="btn btn-ghost flex-1">Hủy</button>
      <button id="btn-tempo-pick-ok" class="btn btn-primary flex-2">✓ Áp Dụng Tempo</button>
    </div>
  </div>
</div>

<!-- ===== HELP MODAL (F9 upgrade — keyboard shortcuts + tiếng Việt) ===== -->
<div id="help-modal" class="modal-overlay hidden" role="dialog" aria-modal="true" aria-labelledby="help-modal-title" style="align-items:flex-start;padding:1rem;">
  <div class="modal-box" style="max-width:760px;width:100%;margin:auto;max-height:90vh;display:flex;flex-direction:column;">
    <div class="modal-header" style="flex-shrink:0;">
      <div style="display:flex;align-items:center;gap:.75rem;">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        <h3 id="help-modal-title" style="margin:0;font-size:1rem;">Hướng Dẫn Sử Dụng SheetApp</h3>
      </div>
      <div style="display:flex;align-items:center;gap:8px;">
        <a href="<?= ($baseHref ?? '/') ?>manager/" target="_blank" style="text-decoration:none;display:inline-flex;align-items:center;gap:5px;font-size:0.78rem;font-weight:700;padding:4px 10px;border-radius:6px;background:rgba(139,92,246,0.15);color:#a78bfa;border:1px solid rgba(139,92,246,0.3);" title="Mở trang Quản Lý Kho Nhạc & Bản Phối Thành Viên">
          <span>📂</span>
          <span>Cổng Quản Lý</span>
        </a>
        <a href="<?= ($baseHref ?? '/') ?>huong-dan/" target="_blank" style="text-decoration:none;display:inline-flex;align-items:center;gap:5px;font-size:0.78rem;font-weight:700;padding:4px 10px;border-radius:6px;background:linear-gradient(135deg,#0284c7,#7c3aed);color:#fff;" title="Mở trang cẩm nang hướng dẫn toàn diện v2.0">
          <span>📚</span>
          <span>Cẩm Nang Toàn Diện</span>
        </a>
        <button id="btn-close-help" class="icon-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    </div>
    <div style="display:flex;gap:.3rem;padding:.65rem 1rem .25rem;border-bottom:1px solid var(--border);flex-shrink:0;overflow-x:auto;scrollbar-width:none;">
      <button class="help-tab active" data-tab="basics">📖 Cơ Bản</button>
      <button class="help-tab" data-tab="shortcuts">⌨️ Phím Tắt</button>
      <button class="help-tab" data-tab="transpose">🎵 Dịch Giọng</button>
      <button class="help-tab" data-tab="chords">🎸 Hợp Âm</button>
      <button class="help-tab" data-tab="compact">📐 Gọn Nhẹ</button>
      <button class="help-tab" data-tab="setlist">📋 Setlist</button>
    </div>
    <div class="help-body" style="flex:1;overflow-y:auto;padding:1.25rem;">

      <!-- Cơ Bản -->
      <div class="help-pane active" id="help-tab-basics">
        <p>Chọn bài hát từ sidebar trái. Dùng thanh zoom để phóng to/thu nhỏ. Phát nhạc MIDI bằng nút <strong>▶ Phát</strong>. Cuộn tự động theo nhịp bằng menu <strong>Cuộn</strong>.</p>
        <h4>Tìm kiếm</h4>
        <ul>
          <li>Tìm theo <strong>tên bài</strong> — gõ tên đầy đủ hoặc một phần</li>
          <li>Tìm theo <strong>số thứ tự</strong> — gõ số nguyên: <code>28</code> → bài 028</li>
          <li>Tìm theo <strong>lời bài hát</strong> — nhấn nút 🔍 để chuyển chế độ</li>
          <li>Lọc theo <strong>danh mục</strong> qua dropdown bên dưới search</li>
        </ul>
        <h4>Điều hướng nhanh</h4>
        <p>Dùng các nút <strong>1–100, 101–200...</strong> để nhảy đến nhóm bài nhanh. Nhấn <strong>◀ ▶</strong> để chuyển bài liên tiếp trong danh sách đang hiển thị.</p>
      </div>

      <!-- Phím Tắt (F9) -->
      <div class="help-pane hidden" id="help-tab-shortcuts">
        <p class="mb-4">Tất cả phím tắt hoạt động khi <strong>không đang nhập text</strong>. Trên iPad/Mobile dùng các nút trên giao diện.</p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
          <div>
            <h4>Điều hướng</h4>
            <table class="shortcut-table">
              <tr><td><kbd>↑</kbd> / <kbd>↓</kbd></td><td>Bài trước / Tiếp theo</td></tr>
              <tr><td><kbd>PageUp</kbd> / <kbd>PageDown</kbd></td><td>Trang trước / Tiếp</td></tr>
              <tr><td><kbd>Space</kbd></td><td>Cuộn xuống 70% màn hình</td></tr>
              <tr><td><kbd>Shift</kbd>+<kbd>Space</kbd></td><td>Cuộn lên</td></tr>
              <tr><td><kbd>S</kbd></td><td>Mở / đóng danh sách bài hát</td></tr>
            </table>
            <h4>Dịch giọng</h4>
            <table class="shortcut-table">
              <tr><td><kbd>←</kbd> / <kbd>→</kbd> hoặc <kbd>[</kbd> / <kbd>]</kbd></td><td>Dịch -1 / +1 nửa cung</td></tr>
              <tr><td><kbd>0</kbd></td><td>Reset về tông gốc</td></tr>
            </table>
          </div>
          <div>
            <h4>Xem & Hiển thị</h4>
            <table class="shortcut-table">
              <tr><td><kbd>Ctrl</kbd>+<kbd>+</kbd></td><td>Phóng to</td></tr>
              <tr><td><kbd>Ctrl</kbd>+<kbd>-</kbd></td><td>Thu nhỏ</td></tr>
              <tr><td><kbd>F</kbd></td><td>Toàn màn hình</td></tr>
              <tr><td><kbd>P</kbd></td><td>In bài nhạc</td></tr>
              <tr><td><kbd>D</kbd></td><td>Chuyển Dark/Light mode</td></tr>
            </table>
            <h4>Hợp âm & Tiện ích</h4>
            <table class="shortcut-table">
              <tr><td><kbd>C</kbd></td><td>Bật/tắt chế độ thêm hợp âm</td></tr>
              <tr><td><kbd>H</kbd></td><td>Highlight hợp âm</td></tr>
              <tr><td><kbd>Ctrl</kbd>+<kbd>Z</kbd></td><td>Hoàn tác hợp âm</td></tr>
              <tr><td><kbd>Ctrl</kbd>+<kbd>Y</kbd></td><td>Làm lại hợp âm</td></tr>
              <tr><td><kbd>?</kbd></td><td>Mở hướng dẫn này</td></tr>
              <tr><td><kbd>Esc</kbd></td><td>Đóng popup / Thoát fullscreen</td></tr>
            </table>
          </div>
        </div>
      </div>

      <!-- Dịch Giọng -->
      <div class="help-pane hidden" id="help-tab-transpose">
        <p>Nhấn nút <strong>+1 / -1</strong> trên thanh trạng thái phía trên bản nhạc để dịch từng cung. Nhấn <strong>Reset</strong> để về tông gốc.</p>
        <h4>Capo</h4>
        <p>Dùng nút <strong>Capo</strong> để đặt capo tại vị trí cụ thể. Hệ thống sẽ tính toán lại hợp âm tương ứng.</p>
        <h4>Dịch giọng trong Setlist</h4>
        <p>Khi thêm bài vào Setlist, bạn có thể đặt dịch giọng mặc định cho từng bài — ví dụ bài này +2 cung, bài kia -1 cung. Setlist sẽ tự động áp dụng khi play.</p>
      </div>

      <!-- Hợp âm -->
      <div class="help-pane hidden" id="help-tab-chords">
        <p>Nhấn <strong>+ Thêm Hợp Âm</strong> để vào chế độ chỉnh sửa. Bấm vào dấu <strong>+</strong> màu xanh trên khuông nhạc để thêm hợp âm tại vị trí đó.</p>
        <h4>Bộ hợp âm (Sets)</h4>
        <ul>
          <li><strong>HD</strong> — Bộ mặc định của ban hát</li>
          <li><strong>default</strong> — Hợp âm gốc trong file MusicXML</li>
          <li>Tạo bộ mới bằng nút <strong>+ Bộ mới</strong> để lưu nhiều phiên bản</li>
        </ul>
        <h4>Lưu hợp âm</h4>
        <p>Nhấn <strong>💾 Lưu</strong> để lưu vào server. Nhấn <strong>Ghi vào File</strong> để lưu vĩnh viễn vào file XML gốc (chỉ Admin/Ban Hát).</p>
      </div>

      <!-- Gọn nhẹ -->
      <div class="help-pane hidden" id="help-tab-compact">
        <p>Nhấn <strong>📐 Gọn Nhẹ</strong> trên toolbar để bật chế độ đơn giản hóa bản nhạc. Nhấn <strong>⚙</strong> bên cạnh để tùy chỉnh:</p>
        <ul>
          <li>✅ <strong>Ẩn Khóa Fa</strong> — Chỉ hiển thị khuông cao âm (treble)</li>
          <li>✅ <strong>Ẩn Bè Phụ</strong> — Chỉ giữ giai điệu chính</li>
          <li>✅ <strong>Ẩn Nốt Chùm</strong> — Mỗi nhịp chỉ một nốt cao nhất</li>
          <li>✅ <strong>Ẩn Tên Bài</strong> — Gọn cho màn hình nhỏ</li>
        </ul>
        <p>Chế độ Gọn Nhẹ lý tưởng cho iPad, điện thoại, hoặc khi muốn đọc lời nhanh.</p>
      </div>

      <!-- Setlist -->
      <div class="help-pane hidden" id="help-tab-setlist">
        <p>Setlist cho phép tạo danh sách bài hát cho một buổi thờ phượng. Click vào Setlist để xem danh sách bài, dùng <strong>◀ ▶</strong> hoặc phím <kbd>↑↓</kbd> để chuyển bài.</p>
        <h4>Tạo và quản lý</h4>
        <ul>
          <li>Tạo Setlist mới từ tab <strong>Setlist</strong> trong sidebar</li>
          <li>Thêm bài hát bằng cách tìm kiếm trong popup Add</li>
          <li>Mỗi bài có thể có <strong>dịch giọng riêng</strong> và <strong>bộ hợp âm riêng</strong></li>
          <li>Kéo thả để sắp xếp thứ tự bài</li>
        </ul>
      </div>

    </div>
    <div style="padding:.75rem 1.25rem;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;flex-shrink:0;">
      <span style="font-size:.78rem;color:var(--text-secondary);">SheetApp — Nhạc Thánh Ca Tương Tác | Nhấn <kbd style="padding:.1rem .35rem;border:1px solid var(--border);border-radius:4px;font-size:.75rem;">?</kbd> để mở bất cứ lúc nào</span>
      <button id="btn-close-help-footer" class="btn btn-ghost btn-sm">Đóng</button>
    </div>
  </div>
</div>
<!-- ===== PWA INSTALL BANNER ===== -->
<div id="pwa-install-modal" class="pwa-install-banner hidden" role="dialog" aria-modal="true" aria-labelledby="pwa-install-modal-title">
  <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom: 0.65rem;">
    <div style="display:flex; align-items:center; gap:.65rem;">
      <span style="font-size: 1.35rem;">📲</span>
      <h3 id="pwa-install-modal-title" style="margin:0; font-size:1.05rem; font-weight: 700; color: var(--accent);">Cài đặt Ứng Dụng SheetApp</h3>
    </div>
    <button id="btn-close-pwa-modal" class="icon-btn">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
  </div>
  <p style="font-size: 0.85rem; line-height: 1.5; color: var(--text-secondary); margin: 0 0 0.85rem 0;">
    Cài đặt SheetApp lên màn hình chính để mở nhạc nhanh chóng, chạy ngoại tuyến (Offline) ngay cả khi không có mạng Internet.
  </p>
  
  <!-- Hướng dẫn iOS Safari -->
  <div id="pwa-ios-instructions" class="hidden">
    <h4 style="font-size: 0.8rem; text-transform: uppercase; color: var(--accent); margin-bottom: 0.5rem; font-weight: 700; letter-spacing: 0.5px;">Hướng dẫn trên iPad / iPhone (Safari)</h4>
    <ol style="padding-left: 1.15rem; font-size: 0.82rem; color: var(--text-secondary); line-height: 1.7; margin: 0; display: flex; flex-direction: column; gap: 0.35rem;">
      <li>Nhấn vào biểu tượng <strong>Chia sẻ (Share)</strong> <span class="fs-base">⎋</span> ở trên thanh công cụ của Safari.</li>
      <li>Cuộn xuống dưới và chọn mục <strong>Thêm vào MH chính (Add to Home Screen)</strong> <span class="fs-base">⊞</span>.</li>
      <li>Nhấn <strong>Thêm (Add)</strong> ở góc trên bên phải để hoàn tất cài đặt.</li>
    </ol>
  </div>

  <!-- Hướng dẫn Desktop/Android -->
  <div id="pwa-general-instructions" class="hidden">
    <button id="btn-pwa-prompt-trigger" class="btn btn-primary w-full" style="background: linear-gradient(135deg, #10b981, #059669); border: none; font-weight: 700; height: 38px;">Cài Đặt Ngay</button>
  </div>
</div>

