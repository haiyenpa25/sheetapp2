  <!-- ================= MODALS ================= -->

  <!-- 1. MODAL TẠO BẢN PHỐI MỚI (FORK MODAL) -->
  <div class="mgr-modal-overlay hidden" id="modal-fork">
    <div class="mgr-modal-box">
      <div class="mgr-modal-header">
        <h3 class="mgr-modal-title">✨ Tạo Bản Phối Riêng (Clone / Fork)</h3>
        <button class="mgr-modal-close" data-close="modal-fork">✕</button>
      </div>

      <div class="mgr-modal-body">
        <div class="mgr-guard-banner">
          <span class="guard-icon">🛡️</span>
          <div>
            <strong>Bảo vệ tuyệt đối bản gốc:</strong> Hệ thống sẽ tự động nhân bản (Fork) sang một nhánh riêng mang tên tài khoản của bạn. Mọi thay đổi hợp âm hoàn toàn độc lập và không làm sai lệch bản thánh ca chuẩn mực.
          </div>
        </div>

        <form id="form-fork-song" class="mgr-form">
          <div class="mgr-form-group">
            <label class="mgr-label">Bài hát cần tạo bản phối <span class="text-danger">*</span></label>
            <div class="searchable-song-input-wrap">
              <input type="text" id="fork-song-search" class="mgr-input" placeholder="🔍 Gõ tên hoặc số bài để tìm nhanh..." autocomplete="off">
              <input type="hidden" id="fork-song-id" required>
              <div id="fork-song-results" class="mgr-picker-results hidden"></div>
            </div>
            <div id="fork-selected-song-badge" class="selected-song-badge hidden">
              <span class="badge-text" id="fork-selected-song-name">Chưa chọn bài</span>
              <button type="button" class="btn-clear-selection" id="btn-clear-fork-song">✕ Đổi bài</button>
            </div>
          </div>

          <div class="mgr-form-row">
            <div class="mgr-form-group">
              <label class="mgr-label">Cấp độ nhân bản</label>
              <select id="fork-type-select" class="mgr-input">
                <option value="chord_set" selected>🎸 Bộ Hợp Âm Tùy Biến (Khuyên dùng - Nhanh & Nhẹ)</option>
                <option value="score_version">📑 Nhân Bản Toàn Bộ Nốt Nhạc (MusicXML Score Fork)</option>
              </select>
            </div>
            <div class="mgr-form-group">
              <label class="mgr-label">Nhạc cụ biểu diễn</label>
              <select id="fork-instrument-select" class="mgr-input">
                <option value="guitar" selected>🎸 Guitar</option>
                <option value="piano">🎹 Piano / Organ</option>
                <option value="bass">🎻 Bass</option>
                <option value="general">🎼 Ban Hát Chung</option>
              </select>
            </div>
          </div>

          <div class="mgr-form-row">
            <div class="mgr-form-group">
              <label class="mgr-label">Tên bản phối / Phong cách <span class="text-danger">*</span></label>
              <input type="text" id="fork-set-name" class="mgr-input" placeholder="VD: Acoustic Ballad, Điệu Bolero Capo 2, Jazz Voicing..." required>
            </div>
            <div class="mgr-form-group" style="max-width: 140px;">
              <label class="mgr-label">Gợi ý Capo</label>
              <select id="fork-capo-select" class="mgr-input">
                <option value="0">Không kẹp</option>
                <option value="1">Capo 1</option>
                <option value="2">Capo 2</option>
                <option value="3">Capo 3</option>
                <option value="4">Capo 4</option>
                <option value="5">Capo 5</option>
              </select>
            </div>
          </div>

          <div class="mgr-form-group">
            <label class="mgr-label">Hướng dẫn chơi / Ghi chú cho ban nhạc</label>
            <textarea id="fork-notes-guide" class="mgr-textarea" rows="2" placeholder="VD: Câu dạo đầu rải ngón trên Am, điệp khúc quạt chả mạnh dần, kết bài dãn nhịp..."></textarea>
          </div>

          <div class="mgr-form-group">
            <label class="mgr-checkbox-label">
              <input type="checkbox" id="fork-is-public" checked>
              <span><strong>🌐 Công khai cho toàn bộ cộng đồng:</strong> Cho phép bất kỳ ai truy cập web cũng có thể tìm thấy, xem và biểu diễn bản phối này (ghi nhận tác quyền rõ ràng dưới tên bạn).</span>
            </label>
          </div>

          <div class="mgr-modal-actions">
            <button type="button" class="mgr-btn mgr-btn-ghost" data-close="modal-fork">Hủy Bỏ</button>
            <button type="submit" class="mgr-btn mgr-btn-primary" id="btn-submit-fork">
              🚀 Tạo Ngay & Vào Chỉnh Sửa
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>

  <!-- 2. MODAL ĐĂNG KÝ TÀI KHOẢN THÀNH VIÊN (SIGN UP MODAL) -->
  <div class="mgr-modal-overlay hidden" id="modal-register">
    <div class="mgr-modal-box" style="max-width: 480px;">
      <div class="mgr-modal-header">
        <h3 class="mgr-modal-title">✨ Đăng Ký Tài Khoản Nhạc Công</h3>
        <button class="mgr-modal-close" data-close="modal-register">✕</button>
      </div>
      <div class="mgr-modal-body">
        <p class="text-sm text-muted">Tạo tài khoản để bắt đầu lưu trữ, tạo bản phối hợp âm cá nhân và chia sẻ cho ban nhạc.</p>
        <form id="form-register-user" class="mgr-form">
          <div class="mgr-form-group">
            <label class="mgr-label">Tên đăng nhập (username) <span class="text-danger">*</span></label>
            <input type="text" id="reg-username" class="mgr-input" placeholder="VD: namguitar, lanpiano (viết liền không dấu)" required>
          </div>
          <div class="mgr-form-group">
            <label class="mgr-label">Tên hiển thị / Biệt danh <span class="text-danger">*</span></label>
            <input type="text" id="reg-display-name" class="mgr-input" placeholder="VD: Hoàng Nam (Guitarist)" required>
          </div>
          <div class="mgr-form-row">
            <div class="mgr-form-group">
              <label class="mgr-label">Mật khẩu <span class="text-danger">*</span></label>
              <input type="password" id="reg-password" class="mgr-input" placeholder="Tối thiểu 10 ký tự" minlength="10" required>
            </div>
            <div class="mgr-form-group">
              <label class="mgr-label">Nhạc cụ chính</label>
              <select id="reg-instrument" class="mgr-input">
                <option value="Guitar" selected>🎸 Guitar</option>
                <option value="Piano">🎹 Piano / Organ</option>
                <option value="Bass">🎻 Bass</option>
                <option value="Drums">🥁 Trống</option>
                <option value="Ca Trưởng">🎼 Ca Trưởng</option>
                <option value="Ca Viên">🎤 Ca Viên</option>
              </select>
            </div>
          </div>
          <div class="mgr-modal-actions">
            <button type="button" class="mgr-btn mgr-btn-ghost" data-close="modal-register">Hủy</button>
            <button type="submit" class="mgr-btn mgr-btn-primary" id="btn-submit-register">🚀 Đăng Ký Tài Khoản</button>
          </div>
        </form>
      </div>
    </div>
  </div>

  <!-- 3. MODAL HỒ SƠ CÁ NHÂN & CÁC BẢN PHỐI CỦA TÔI (MY PROFILE MODAL) -->
  <div class="mgr-modal-overlay hidden" id="modal-profile">
    <div class="mgr-modal-box" style="max-width: 620px;">
      <div class="mgr-modal-header">
        <h3 class="mgr-modal-title">👤 Hồ Sơ & Bản Phối Của Tôi</h3>
        <button class="mgr-modal-close" data-close="modal-profile">✕</button>
      </div>
      <div class="mgr-modal-body">
        <div class="profile-tabs-header">
          <button class="profile-tab-btn active" data-ptab="ptab-info">Thông Tin Cá Nhân</button>
          <button class="profile-tab-btn" data-ptab="ptab-contributions">Bản Phối Của Tôi (<span id="my-chords-count">0</span>)</button>
          <button class="profile-tab-btn" data-ptab="ptab-notifs" id="btn-ptab-notifs">🔔 Tùy Chọn Thông Báo</button>
        </div>

        <div id="ptab-info" class="profile-tab-content active">
          <form id="form-update-profile" class="mgr-form">
            <div class="mgr-form-row">
              <div class="mgr-form-group">
                <label class="mgr-label">Tên đăng nhập</label>
                <input type="text" id="profile-username" class="mgr-input" disabled style="opacity: 0.7;">
              </div>
              <div class="mgr-form-group">
                <label class="mgr-label">Tên hiển thị</label>
                <input type="text" id="profile-display-name" class="mgr-input" placeholder="Tên hiển thị">
              </div>
            </div>

            <div class="mgr-form-group">
              <label class="mgr-label">Nhạc cụ sở trường</label>
              <input type="text" id="profile-instrument" class="mgr-input" placeholder="Guitar, Piano, Bass...">
            </div>

            <hr style="border:none; border-top:1px solid var(--border); margin:0.5rem 0;">
            <p class="text-xs text-muted">Đổi mật khẩu (bỏ trống nếu không muốn đổi):</p>

            <div class="mgr-form-row">
              <div class="mgr-form-group">
                <label class="mgr-label">Mật khẩu hiện tại</label>
                <input type="password" id="profile-current-pass" class="mgr-input" placeholder="Mật khẩu cũ">
              </div>
              <div class="mgr-form-group">
                <label class="mgr-label">Mật khẩu mới</label>
                <input type="password" id="profile-new-pass" class="mgr-input" placeholder="Mật khẩu mới">
              </div>
            </div>

            <div class="mgr-modal-actions">
              <button type="submit" class="mgr-btn mgr-btn-primary">💾 Lưu Hồ Sơ</button>
            </div>
          </form>
        </div>

        <div id="ptab-contributions" class="profile-tab-content">
          <div id="my-contributions-list" class="my-contributions-list">
            <p class="text-muted text-sm">Đang nạp danh sách bản phối của bạn...</p>
          </div>
        </div>

        <div id="ptab-notifs" class="profile-tab-content">
          <form id="form-update-notif-prefs" class="mgr-form">
            <div class="mgr-form-row">
              <div class="mgr-form-group">
                <label class="mgr-label">Email nhận thông báo</label>
                <input type="email" id="notif-email" class="mgr-input" placeholder="tenban@gmail.com">
                <small class="text-xs text-muted">Nhận thông báo khi có lịch thờ phượng hoặc bài tập mới.</small>
              </div>
              <div class="mgr-form-group" style="max-width: 220px;">
                <label class="mgr-label">Giờ yên lặng (Quiet Hours)</label>
                <div style="display:flex; align-items:center; gap:6px;">
                  <input type="text" id="notif-quiet-start" class="mgr-input" placeholder="22:00" maxlength="5" style="text-align:center;">
                  <span class="text-muted text-xs">đến</span>
                  <input type="text" id="notif-quiet-end" class="mgr-input" placeholder="07:00" maxlength="5" style="text-align:center;">
                </div>
                <small class="text-xs text-muted">Tạm hoãn email trong khung giờ này.</small>
              </div>
            </div>

            <div style="margin-top: 1rem; margin-bottom: 0.5rem;">
              <label class="mgr-label" style="font-weight:700;">Kênh thông báo theo loại sự kiện:</label>
            </div>

            <div style="overflow-x: auto; border: 1px solid var(--border); border-radius: 6px; margin-bottom: 1.25rem;">
              <table class="mgr-table" style="font-size: 0.82rem; margin: 0;">
                <thead style="background: var(--bg-surface-elevated);">
                  <tr>
                    <th>Loại sự kiện</th>
                    <th style="width: 100px; text-align:center;">🔔 Trong App</th>
                    <th style="width: 100px; text-align:center;">📧 Email</th>
                    <th style="width: 110px; text-align:center;">🌐 Web Push</th>
                  </tr>
                </thead>
                <tbody id="tbody-notif-matrix">
                  <!-- Rendered via JS -->
                </tbody>
              </table>
            </div>

            <div class="mgr-modal-actions">
              <button type="submit" class="mgr-btn mgr-btn-primary" id="btn-save-notif-prefs">💾 Lưu Tùy Chọn Thông Báo</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>

  <!-- 4. MODAL THÊM TÀI KHOẢN THÀNH VIÊN (ADMIN) -->
  <div class="mgr-modal-overlay hidden" id="modal-user">
    <div class="mgr-modal-box" style="max-width: 500px;">
      <div class="mgr-modal-header">
        <h3 class="mgr-modal-title">👤 Tạo Tài Khoản Thành Viên Mới (Admin)</h3>
        <button class="mgr-modal-close" data-close="modal-user">✕</button>
      </div>
      <div class="mgr-modal-body">
        <form id="form-create-user" class="mgr-form">
          <div class="mgr-form-group">
            <label class="mgr-label">Tên đăng nhập <span class="text-danger">*</span></label>
            <input type="text" id="new-user-username" class="mgr-input" placeholder="VD: namguitar" required>
          </div>
          <div class="mgr-form-group">
            <label class="mgr-label">Tên hiển thị</label>
            <input type="text" id="new-user-display-name" class="mgr-input" placeholder="VD: Hoàng Nam (Guitarist)">
          </div>
          <div class="mgr-form-row">
            <div class="mgr-form-group">
              <label class="mgr-label">Mật khẩu <span class="text-danger">*</span></label>
              <input type="password" id="new-user-password" class="mgr-input" placeholder="Mật khẩu" required>
            </div>
            <div class="mgr-form-group">
              <label class="mgr-label">Nhạc cụ</label>
              <input type="text" id="new-user-instrument" class="mgr-input" placeholder="Guitar, Piano, Bass...">
            </div>
          </div>
          <div class="mgr-form-row">
            <div class="mgr-form-group">
              <label class="mgr-label">Mã Hợp Âm Cá Nhân (Chord Code)</label>
              <input type="text" id="new-user-chord-code" class="mgr-input" placeholder="VD: HD, NAM, TUAN" maxlength="8">
              <small class="text-muted text-xs">Mã xuất hiện trên dropdown hợp âm. Để trống tự lấy 4 chữ cái đầu.</small>
            </div>
            <div class="mgr-form-group">
              <label class="mgr-label">Phân quyền</label>
              <select id="new-user-role" class="mgr-input">
                <option value="banhat" selected>🎸 Ban Hát / Nhạc Công</option>
                <option value="leader">👑 Ca Trưởng</option>
                <option value="viewer">👁️ Viewer (Chỉ xem)</option>
                <option value="admin">🛡️ Admin (Quản trị)</option>
              </select>
            </div>
          </div>
          <div class="mgr-form-group">
            <label class="mgr-label">Bè ca đoàn (Voice Part)</label>
            <select id="new-user-voice-part" class="mgr-input">
              <option value="">— Không phân bè —</option>
              <option value="S">S — Soprano (Nữ cao)</option>
              <option value="A">A — Alto (Nữ trầm)</option>
              <option value="T">T — Tenor (Nam cao)</option>
              <option value="B">B — Bass (Nam trầm)</option>
              <option value="INSTR">INSTR — Nhạc công / Khác</option>
            </select>
          </div>
          <div class="mgr-modal-actions">
            <button type="button" class="mgr-btn mgr-btn-ghost" data-close="modal-user">Hủy Bỏ</button>
            <button type="submit" class="mgr-btn mgr-btn-primary">✓ Lưu Tài Khoản</button>
          </div>
        </form>
      </div>
    </div>
  </div>

  <!-- 4B. MODAL CHỈNH SỬA THÔNG TIN THÀNH VIÊN (ADMIN) -->
  <div class="mgr-modal-overlay hidden" id="modal-edit-user">
    <div class="mgr-modal-box" style="max-width: 500px;">
      <div class="mgr-modal-header">
        <h3 class="mgr-modal-title">✏️ Chỉnh Sửa Thông Tin Thành Viên</h3>
        <button class="mgr-modal-close" data-close="modal-edit-user">✕</button>
      </div>
      <div class="mgr-modal-body">
        <form id="form-edit-user" class="mgr-form">
          <input type="hidden" id="edit-user-id">
          <div class="mgr-form-group">
            <label class="mgr-label">Tên đăng nhập</label>
            <input type="text" id="edit-user-username" class="mgr-input" disabled style="opacity:0.75; cursor:not-allowed;">
          </div>
          <div class="mgr-form-group">
            <label class="mgr-label">Tên hiển thị <span class="text-danger">*</span></label>
            <input type="text" id="edit-user-display-name" class="mgr-input" required>
          </div>
          <div class="mgr-form-row">
            <div class="mgr-form-group">
              <label class="mgr-label">Nhạc cụ</label>
              <input type="text" id="edit-user-instrument" class="mgr-input" placeholder="Guitar, Piano, Bass...">
            </div>
            <div class="mgr-form-group">
              <label class="mgr-label">Mã Hợp Âm Cá Nhân</label>
              <input type="text" id="edit-user-chord-code" class="mgr-input" maxlength="8">
            </div>
          </div>
          <div class="mgr-form-row">
            <div class="mgr-form-group">
              <label class="mgr-label">Phân quyền</label>
              <select id="edit-user-role" class="mgr-input">
                <option value="banhat">🎸 Ban Hát / Nhạc Công</option>
                <option value="leader">👑 Ca Trưởng</option>
                <option value="viewer">👁️ Viewer (Chỉ xem)</option>
                <option value="admin">🛡️ Admin (Quản trị)</option>
              </select>
            </div>
            <div class="mgr-form-group">
              <label class="mgr-label">Bè ca đoàn (Voice Part)</label>
              <select id="edit-user-voice-part" class="mgr-input">
                <option value="">— Không phân bè —</option>
                <option value="S">S — Soprano (Nữ cao)</option>
                <option value="A">A — Alto (Nữ trầm)</option>
                <option value="T">T — Tenor (Nam cao)</option>
                <option value="B">B — Bass (Nam trầm)</option>
                <option value="INSTR">INSTR — Nhạc công / Khác</option>
              </select>
            </div>
          </div>
          <div class="mgr-form-group">
            <label class="mgr-label">Đổi mật khẩu mới</label>
            <input type="password" id="edit-user-password" class="mgr-input" placeholder="Để trống nếu giữ nguyên">
          </div>
          <div class="mgr-modal-actions">
            <button type="button" class="mgr-btn mgr-btn-ghost" data-close="modal-edit-user">Hủy Bỏ</button>
            <button type="submit" class="mgr-btn mgr-btn-primary">✓ Lưu Thay Đổi</button>
          </div>
        </form>
      </div>
    </div>
  </div>

  <!-- 5. MODAL THÊM / SỬA THỂ LOẠI (ADMIN) -->
  <div class="mgr-modal-overlay hidden" id="modal-category">
    <div class="mgr-modal-box" style="max-width: 480px;">
      <div class="mgr-modal-header">
        <h3 class="mgr-modal-title" id="cat-modal-title">📂 Thêm Danh Mục Mới</h3>
        <button class="mgr-modal-close" data-close="modal-category">✕</button>
      </div>
      <div class="mgr-modal-body">
        <form id="form-manage-category" class="mgr-form">
          <input type="hidden" id="cat-edit-id" value="">
          <div class="mgr-form-row">
            <div class="mgr-form-group" style="max-width: 90px;">
              <label class="mgr-label">Icon</label>
              <input type="text" id="cat-edit-icon" class="mgr-input" value="🎵" style="text-align:center;">
            </div>
            <div class="mgr-form-group">
              <label class="mgr-label">Tên thể loại <span class="text-danger">*</span></label>
              <input type="text" id="cat-edit-name" class="mgr-input" placeholder="VD: Thánh Ca Mùa Phục Sinh" required>
            </div>
          </div>
          <div class="mgr-form-group">
            <label class="mgr-label">Mô tả ngắn</label>
            <input type="text" id="cat-edit-desc" class="mgr-input" placeholder="Mô tả nội dung của danh mục...">
          </div>
          <div class="mgr-modal-actions">
            <button type="button" class="mgr-btn mgr-btn-ghost" data-close="modal-category">Hủy Bỏ</button>
            <button type="submit" class="mgr-btn mgr-btn-primary">Lưu Danh Mục</button>
          </div>
        </form>
      </div>
    </div>
  </div>

  <!-- 6. MODAL ĐĂNG NHẬP -->
  <div class="mgr-modal-overlay hidden" id="modal-login">
    <div class="mgr-modal-box" style="max-width: 420px;">
      <div class="mgr-modal-header">
        <h3 class="mgr-modal-title">🔐 Đăng Nhập SheetApp</h3>
        <button class="mgr-modal-close" data-close="modal-login">✕</button>
      </div>
      <div class="mgr-modal-body">
        <p class="text-sm text-muted" style="margin-bottom: 1rem;">Đăng nhập để tạo và chỉnh sửa các bản phối hợp âm mang định danh cá nhân của bạn.</p>
        <form id="form-mgr-login" class="mgr-form">
          <div class="mgr-form-group">
            <label class="mgr-label">Tên đăng nhập</label>
            <input type="text" id="login-username" class="mgr-input" placeholder="Tên đăng nhập" required>
          </div>
          <div class="mgr-form-group">
            <label class="mgr-label">Mật khẩu</label>
            <input type="password" id="login-password" class="mgr-input" placeholder="Mật khẩu" required>
          </div>
          <div class="mgr-modal-actions">
            <button type="button" class="mgr-btn mgr-btn-ghost" data-close="modal-login">Đóng</button>
            <button type="submit" class="mgr-btn mgr-btn-primary" id="btn-submit-login">Đăng Nhập</button>
          </div>
        </form>
        <div style="text-align: center; margin-top: 1rem; border-top: 1px solid var(--border); padding-top: 0.75rem;">
          <span class="text-xs text-muted">Chưa có tài khoản? </span>
          <button type="button" class="mgr-btn-link" id="link-switch-to-register">✨ Đăng ký tài khoản mới ngay</button>
        </div>
      </div>
    </div>
  </div>

  <!-- 7. MODAL RESET MẬT KHẨU (ADMIN) -->
  <div class="mgr-modal-overlay hidden" id="modal-reset-pass">
    <div class="mgr-modal-box" style="max-width: 420px;">
      <div class="mgr-modal-header">
        <h3 class="mgr-modal-title">🔑 Đổi Mật Khẩu Thành Viên</h3>
        <button class="mgr-modal-close" data-close="modal-reset-pass">✕</button>
      </div>
      <div class="mgr-modal-body">
        <p class="text-sm text-muted">Đặt mật khẩu mới cho tài khoản <strong id="reset-pass-target-username">...</strong></p>
        <form id="form-reset-pass" class="mgr-form">
          <input type="hidden" id="reset-pass-user-id">
          <div class="mgr-form-group">
            <label class="mgr-label">Mật khẩu mới <span class="text-danger">*</span></label>
            <input type="password" id="reset-pass-new-password" class="mgr-input" placeholder="Tối thiểu 10 ký tự" minlength="10" required>
          </div>
          <div class="mgr-modal-actions">
            <button type="button" class="mgr-btn mgr-btn-ghost" data-close="modal-reset-pass">Hủy</button>
            <button type="submit" class="mgr-btn mgr-btn-primary">Lưu Mật Khẩu</button>
          </div>
        </form>
      </div>
    </div>
  </div>

  <!-- 8. MODAL KIỂM TRA & PHÊ DUYỆT KHÁC BIỆT (REVIEW DIFF INSPECTOR) -->
  <div class="mgr-modal-overlay hidden" id="modal-review-diff">
    <div class="mgr-modal-box" style="max-width: 840px; max-height: 90vh; display: flex; flex-direction: column;">
      <div class="mgr-modal-header">
        <div>
          <h3 class="mgr-modal-title" id="diff-song-title">Chi Tiết Đề Xuất</h3>
          <div style="margin-top: 4px; display:flex; gap:8px; align-items:center;">
            <span id="diff-type-badge" class="tag tag-amber" style="font-size:0.75rem; font-weight:700;">Đề xuất</span>
            <span id="diff-submitter-info" class="text-xs text-muted">Người gửi: ...</span>
          </div>
        </div>
        <button class="mgr-modal-close" data-close="modal-review-diff">✕</button>
      </div>

      <div class="mgr-modal-body" style="overflow-y: auto; padding: 1.25rem; flex: 1;">
        <!-- Submitter Note -->
        <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border); border-radius: 6px; padding: 10px 14px; margin-bottom: 1rem;">
          <div style="font-size: 0.75rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 4px;">Ghi chú của người gửi:</div>
          <div id="diff-submitter-note" style="font-size: 0.88rem; line-height: 1.4; color: var(--text-main);">...</div>
        </div>

        <!-- Diff Summary KPIs -->
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 1.25rem;">
          <div style="background: rgba(16,185,129,0.08); border: 1px solid rgba(16,185,129,0.3); border-radius: 6px; padding: 8px 12px; text-align: center;">
            <div style="font-size: 1.25rem; font-weight: 700; color: #10b981;" id="diff-kpi-added">0</div>
            <div style="font-size: 0.72rem; color: var(--text-muted);">+ Thêm Mới</div>
          </div>
          <div style="background: rgba(245,158,11,0.08); border: 1px solid rgba(245,158,11,0.3); border-radius: 6px; padding: 8px 12px; text-align: center;">
            <div style="font-size: 1.25rem; font-weight: 700; color: #f59e0b;" id="diff-kpi-modified">0</div>
            <div style="font-size: 0.72rem; color: var(--text-muted);">~ Thay Đổi</div>
          </div>
          <div style="background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.3); border-radius: 6px; padding: 8px 12px; text-align: center;">
            <div style="font-size: 1.25rem; font-weight: 700; color: #ef4444;" id="diff-kpi-removed">0</div>
            <div style="font-size: 0.72rem; color: var(--text-muted);">- Đã Xóa</div>
          </div>
          <div style="background: rgba(148,163,184,0.08); border: 1px solid rgba(148,163,184,0.2); border-radius: 6px; padding: 8px 12px; text-align: center;">
            <div style="font-size: 1.25rem; font-weight: 700; color: #94a3b8;" id="diff-kpi-unchanged">0</div>
            <div style="font-size: 0.72rem; color: var(--text-muted);">= Giữ Nguyên</div>
          </div>
        </div>

        <!-- Diff Table -->
        <h4 style="font-size: 0.88rem; font-weight: 700; margin-bottom: 8px;">Chi Tiết Khác Biệt Theo Từng Ô Nhịp:</h4>
        <div style="max-height: 260px; overflow-y: auto; border: 1px solid var(--border); border-radius: 6px; margin-bottom: 1.25rem;">
          <table class="mgr-table" style="font-size: 0.82rem; margin: 0;">
            <thead style="position: sticky; top: 0; background: var(--bg-surface); z-index: 2;">
              <tr>
                <th style="width: 100px; text-align:center;">Vị Trí</th>
                <th style="width: 80px; text-align:center;">Nốt</th>
                <th style="text-align:center;">Hợp Âm Cũ</th>
                <th style="text-align:center;">Hợp Âm Đề Xuất</th>
                <th style="width: 110px; text-align:center;">Phân Loại</th>
              </tr>
            </thead>
            <tbody id="tbody-diff-changes">
              <!-- Rendered via JS -->
            </tbody>
          </table>
        </div>

        <!-- Reviewer Feedback Note Area -->
        <div class="mgr-form-group" style="margin-bottom: 0;">
          <label class="mgr-label" for="diff-review-note">Ghi chú phản hồi của Người Duyệt (Bắt buộc nếu Từ Chối):</label>
          <textarea id="diff-review-note" class="mgr-input" rows="2" placeholder="Nhập lý do phê duyệt hoặc lý do cần chỉnh sửa thêm..."></textarea>
        </div>
      </div>

      <div class="mgr-modal-actions" id="diff-modal-actions" style="padding: 1rem 1.25rem; border-top: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
        <button type="button" class="mgr-btn mgr-btn-ghost" data-close="modal-review-diff">Đóng</button>
        <div style="display:flex; gap:10px;">
          <button type="button" class="mgr-btn mgr-btn-danger" id="btn-reject-review">
            <span>❌</span> Từ Chối Đề Xuất
          </button>
          <button type="button" class="mgr-btn mgr-btn-primary" id="btn-approve-review">
            <span>✅</span> Phê Duyệt Ngay
          </button>
        </div>
      </div>
    </div>
  </div>
