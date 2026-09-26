  <!-- ══════════════ 5. MODAL ROOM MANAGEMENT & QR CODE ══════════════ -->
  <div id="modal-live-room" class="stage-modal-overlay hidden">
    <div class="stage-modal-card">
      <div class="stage-modal-header">
        <div class="modal-header-title">
          <span class="modal-icon">📡</span>
          <h3>Quản Lý Phòng Biểu Diễn Trực Tiếp</h3>
        </div>
        <button id="btn-close-room-modal" class="stage-modal-close">&times;</button>
      </div>

      <div class="stage-modal-tabs">
        <button class="modal-tab-btn active" data-target="#tab-host-panel">👑 Mở Phòng (Ca Trưởng)</button>
        <button class="modal-tab-btn" data-target="#tab-join-panel">🔗 Tham Gia (Nhạc Công)</button>
      </div>

      <div class="stage-modal-body">
        
        <!-- TAB 1: HOST PANEL -->
        <div id="tab-host-panel" class="modal-tab-pane active">
          <div id="host-setup-view">
            <p class="modal-help-text">Mở phòng phát sóng. Toàn bộ máy thành viên sẽ tự động nhận bài, đổi tông và cuộn theo vị trí của bạn.</p>
            <div class="form-row">
              <label for="host-room-input" class="form-label">Mã phòng mong muốn:</label>
              <div class="input-with-action">
                <input type="text" id="host-room-input" class="form-input text-uppercase font-bold" placeholder="VD: BAND-2026" maxlength="16">
                <button id="btn-submit-create-host" class="btn btn-primary">Mở Phòng Ngay</button>
              </div>
              <small class="text-muted">Để trống để hệ thống tự sinh mã phòng ngẫu nhiên.</small>
            </div>
          </div>

          <div id="host-active-view" class="hidden">
            <div class="active-room-box">
              <div class="active-room-label">MÃ PHÒNG PHÁT SÓNG</div>
              <div id="display-room-code" class="display-room-code">BAND-2026</div>
              <div class="active-room-status">● Đang phát sóng thời gian thực</div>
            </div>

            <!-- QR Code Section -->
            <div class="qr-preview-container">
              <canvas id="stage-qr-canvas" width="220" height="220"></canvas>
              <div class="qr-hint">Quét mã bằng Camera điện thoại/iPad để tham gia tức thì</div>
              <button id="btn-fullscreen-qr" class="btn btn-outline btn-xs mt-half">🔍 Phóng to QR toàn màn hình</button>
            </div>

            <!-- Share Link Box -->
            <div class="share-link-group">
              <label class="form-label">Link tham gia 1-chạm:</label>
              <div class="input-with-action">
                <input type="text" id="share-link-input" class="form-input text-sm" readonly>
                <button id="btn-copy-share-link" class="btn btn-secondary">📋 Sao chép</button>
              </div>
            </div>

            <!-- Member Roster List -->
            <div class="roster-preview-group">
              <div class="roster-header-row">
                <span class="font-bold text-sm">Thành viên kết nối: <span id="modal-roster-total">1</span></span>
                <span id="modal-roster-details" class="text-xs text-muted">👑 Ca Trưởng</span>
              </div>
            </div>

            <div class="modal-actions-row">
              <button id="btn-host-leave-room" class="btn btn-danger w-full">🛑 Đóng Phòng / Rời Khỏi</button>
            </div>
          </div>
        </div>

        <!-- TAB 2: JOIN PANEL -->
        <div id="tab-join-panel" class="modal-tab-pane">
          <p class="modal-help-text">Nhập mã phòng do Ca Trưởng cung cấp hoặc quét mã QR để đồng bộ màn hình biểu diễn.</p>
          <div class="form-row">
            <label for="join-room-input" class="form-label">Nhập Mã Phòng:</label>
            <div class="input-with-action">
              <input type="text" id="join-room-input" class="form-input text-uppercase font-bold" placeholder="Nhập mã (VD: BAND-2026)">
              <button id="btn-submit-join-room" class="btn btn-success">🔗 Tham Gia</button>
            </div>
          </div>

          <div id="join-active-status" class="hidden mt-1">
            <div class="active-room-box" style="border-color: #10b981;">
              <div class="active-room-label" style="color: #10b981;">ĐÃ KẾT NỐI VÀO PHÒNG</div>
              <div id="display-joined-room" class="display-room-code" style="color: #10b981;">BAND-2026</div>
              <div class="active-room-status" style="color: #10b981;">● Đang tự động đồng bộ theo Ca Trưởng</div>
            </div>
            <button id="btn-follower-leave-room" class="btn btn-danger w-full mt-1">👋 Rời Khỏi Phòng</button>
          </div>
        </div>

      </div>
    </div>
  </div>

  <!-- ══════════════ 6. FULLSCREEN QR MODAL ══════════════ -->
  <div id="modal-fullscreen-qr-overlay" class="fullscreen-qr-overlay hidden">
    <div class="fullscreen-qr-card">
      <button id="btn-close-fs-qr" class="fullscreen-qr-close">&times;</button>
      <h2 class="fs-qr-title">Quét Mã Tham Gia Ban Nhạc</h2>
      <div class="fs-qr-room-badge" id="fs-qr-room-code">BAND-2026</div>
      <canvas id="fs-qr-canvas" width="340" height="340"></canvas>
      <p class="fs-qr-caption">Mở Camera trên iPad / Điện thoại quét mã để vào phòng tự động</p>
    </div>
  </div>

  <!-- ══════════════ 7. SETLIST PICKER MODAL (FOR HOST) ══════════════ -->
  <div id="modal-pick-setlist" class="stage-modal-overlay hidden">
    <div class="stage-modal-card" style="max-width: 520px;">
      <div class="stage-modal-header">
        <div class="modal-header-title">
          <span class="modal-icon">📋</span>
          <h3>Chọn Setlist Biểu Diễn</h3>
        </div>
        <button id="btn-close-setlist-modal" class="stage-modal-close">&times;</button>
      </div>
      <div class="stage-modal-body">
        <p class="modal-help-text">Chọn chương trình lễ hoặc buổi diễn để nạp nhanh danh sách bài hát vào bàn điều khiển Ca Trưởng.</p>
        <div id="setlist-picker-list" class="setlist-picker-list">
          <div class="text-muted text-center py-1">Đang tải danh sách setlist...</div>
        </div>
      </div>
    </div>
  </div>

  <!-- ══════════════ 8. STAGE AUDIO & HARDWARE SETTINGS MODAL ══════════════ -->
  <div id="modal-stage-audio-settings" class="stage-modal-overlay hidden">
    <div class="stage-modal-card" style="max-width: 560px;">
      <div class="stage-modal-header">
        <div class="modal-header-title">
          <span class="modal-icon">⚙️</span>
          <h3>Cài Đặt Âm Thanh & Thiết Bị Sân Khấu</h3>
        </div>
        <button id="btn-close-audio-settings" class="stage-modal-close">&times;</button>
      </div>
      <div class="stage-modal-body">
        
        <!-- Section 1: In-Ear Stereo Split Matrix -->
        <div class="settings-group-box">
          <div class="settings-group-title">🎧 Tai Nghe In-Ear Stereo Split (Tách Kênh Sân Khấu)</div>
          <p class="settings-group-desc">Xuất âm thanh riêng biệt: Kênh Trái (L) chỉ nghe Click nhịp và hiệu lệnh Cue; Kênh Phải (R) chỉ nghe nhạc đệm Ambient Pad không lọt tiếng click ra dàn loa lớn.</p>
          <div class="toggle-setting-row">
            <label for="toggle-stereo-split" class="setting-label">Bật Chế Độ Tách Kênh (L: Click / R: Nhạc)</label>
            <input type="checkbox" id="toggle-stereo-split" class="stage-toggle-checkbox">
          </div>
        </div>

        <!-- Section 2: Ambient Pad Synth Settings -->
        <div class="settings-group-box">
          <div class="settings-group-title">🎹 Đệm Nền Ambient Pad Drone</div>
          <p class="settings-group-desc">Tự động phát sóng âm nền ấm áp theo Tông bài hát để kết nối liền mạch các bài hát, loại bỏ khoảng lặng chết.</p>
          <div class="form-row">
            <label class="setting-label">Âm lượng Pad:</label>
            <div class="slider-with-val">
              <input type="range" id="pad-volume-slider" min="0" max="100" value="65" class="stage-range-slider">
              <span id="pad-volume-val" class="slider-val-badge">65%</span>
            </div>
          </div>
          <div class="toggle-setting-row mt-half">
            <label for="toggle-pad-autokey" class="setting-label">Tự động đổi tông Pad theo bài hát</label>
            <input type="checkbox" id="toggle-pad-autokey" class="stage-toggle-checkbox" checked>
          </div>
        </div>

        <!-- Section 3: Bluetooth Foot Pedal Guide -->
        <div class="settings-group-box">
          <div class="settings-group-title">🦶 Bàn Đạp Chân (Bluetooth Foot Pedal & MIDI)</div>
          <p class="settings-group-desc">Tương thích các dòng AirTurn, PageFlip, Donner, Coda STOMP hoặc bàn phím Bluetooth. Không cần chạm tay vào màn hình.</p>
          <div class="pedal-key-guide">
            <div class="pedal-guide-item"><span>Pedal Phải / PageDown / Mũi tên phải:</span> <strong>Tiến ô nhịp / Sang đoạn kế</strong></div>
            <div class="pedal-guide-item"><span>Pedal Trái / PageUp / Mũi tên trái:</span> <strong>Lùi ô nhịp / Đoạn trước</strong></div>
            <div class="pedal-guide-item"><span>Phím Cách (Spacebar):</span> <strong>Kích hoạt Đếm Nhịp Vào (Count-In)</strong></div>
          </div>
          <div class="mt-half text-center">
            <button id="btn-test-pedal-action" class="btn btn-outline btn-xs">Kiểm tra giẫm Pedal thử nghiệm</button>
          </div>
        </div>

      </div>
    </div>
  </div>

  <!-- ══════════════ 9. SERVICE COUNTDOWN TIMER MODAL ══════════════ -->
  <div id="modal-stage-timer-settings" class="stage-modal-overlay hidden">
    <div class="stage-modal-card" style="max-width: 440px;">
      <div class="stage-modal-header">
        <div class="modal-header-title">
          <span class="modal-icon">⏱️</span>
          <h3>Đồng Hồ Đếm Thời Gian Sân Khấu</h3>
        </div>
        <button id="btn-close-timer-modal" class="stage-modal-close">&times;</button>
      </div>
      <div class="stage-modal-body">
        <p class="settings-group-desc">Cài đặt giờ đếm ngược trước giờ khai lễ hoặc theo dõi thời lượng buổi biểu diễn.</p>
        
        <div class="timer-quick-presets">
          <button class="btn btn-sm btn-secondary timer-preset-btn" data-minutes="5">5 Phút</button>
          <button class="btn btn-sm btn-secondary timer-preset-btn" data-minutes="10">10 Phút</button>
          <button class="btn btn-sm btn-secondary timer-preset-btn" data-minutes="15">15 Phút</button>
          <button class="btn btn-sm btn-secondary timer-preset-btn" data-minutes="30">30 Phút</button>
        </div>

        <div class="form-row mt-1">
          <label for="timer-custom-minutes" class="form-label">Hoặc nhập số phút đếm ngược:</label>
          <div class="input-with-action">
            <input type="number" id="timer-custom-minutes" class="form-input text-center font-bold" min="1" max="180" value="10">
            <button id="btn-start-countdown" class="btn btn-primary">Bắt Đầu Đếm</button>
          </div>
        </div>

        <div class="modal-actions-row mt-1">
          <button id="btn-start-stopwatch" class="btn btn-outline w-full">⏱️ Chuyển Sang Đếm Xuôi (Bấm Giờ)</button>
          <button id="btn-reset-timer" class="btn btn-danger w-full mt-half">Dừng / Đặt Lại</button>
        </div>
      </div>
    </div>
  </div>
