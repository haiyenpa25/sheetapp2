<!-- ===== SESSION PANEL (SLIDE-IN) ===== -->
<div id="session-panel" class="session-panel hidden">
  <div class="panel-header">
    <h3>📋 Nhật Ký Biểu Diễn</h3>
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


<!-- ===== INSTRUMENT MIXER MODAL ===== -->
<div id="mixer-modal" class="modal-overlay hidden">
  <div class="modal-box" style="max-width: 400px;">
    <div class="modal-header">
      <h3>🎛 Bộ Trộn Nhạc Cụ (Mixer)</h3>
      <button id="btn-close-mixer" class="icon-btn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <div class="modal-body">
      <p class="help-text" style="margin-bottom:0;">Bật/tắt các dải nhạc cụ để hiển thị sheet gọng gàng hơn.</p>
      <div id="mixer-instruments-list" style="display:flex;flex-direction:column;gap:.5rem;margin-top:.5rem;max-height:300px;overflow-y:auto;padding:.5rem;background:var(--bg-overlay);border-radius:var(--radius-sm);border:1px solid var(--border);">
        <p class="text-muted text-sm text-center">Chưa có bài nhạc nào được tải.</p>
      </div>
      <button id="btn-mixer-apply" class="btn btn-primary w-full mt-1">Áp Dụng & Tải Lại</button>
    </div>
  </div>
</div>

<!-- ===== AUTH MODAL ===== -->
<div id="auth-modal" class="modal-overlay hidden">
  <div class="modal-box" style="max-width: 320px;">
    <div class="modal-header">
      <h3>🔒 Đăng Nhập</h3>
      <button id="btn-close-auth" class="icon-btn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <div class="modal-body">
      <div id="auth-login-form">
        <div class="form-row">
          <label class="form-label">Tài khoản</label>
          <input id="auth-username-input" type="text" class="form-input" placeholder="Tên đăng nhập" autocomplete="username">
        </div>
        <div class="form-row mt-1">
          <label class="form-label">Mật khẩu</label>
          <input id="auth-password-input" type="password" class="form-input" placeholder="Mật khẩu" autocomplete="current-password">
        </div>
        <p id="auth-error" class="text-sm text-danger mt-half hidden"></p>
        <button id="btn-do-login" class="btn btn-primary w-full mt-1">Đăng Nhập</button>
      </div>
      <div id="auth-logged-in" class="hidden text-center">
        <p class="text-muted mb-1">Đang đăng nhập với quyền <strong id="auth-role-display"></strong></p>
        <p id="auth-perm-summary" class="text-xs text-muted" style="line-height:1.7; margin-bottom:.75rem; text-align:left; padding:.5rem .75rem; background:var(--bg-overlay); border-radius:var(--radius-sm); border:1px solid var(--border);"></p>
        <button id="btn-do-logout" class="btn btn-danger w-full">Đăng Xuất</button>
      </div>
    </div>
  </div>
</div>

<!-- ===== TOAST NOTIFICATION ===== -->
<div id="toast-container" class="toast-container"></div>

<!-- ===== ADD TO SETLIST MODAL ===== -->
<div id="add-to-setlist-modal" class="modal-overlay hidden">
  <div class="modal-box">
    <div class="modal-header">
      <h3>📋 Thêm vào Setlist</h3>
      <button id="btn-close-add-setlist" class="icon-btn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <div class="modal-body" style="min-height: 150px; max-height: 300px; overflow-y: auto;">
      <p style="margin-bottom: 0.5rem; color: var(--text-secondary);">Chọn một Setlist để lưu bài hát này:</p>
      <div id="add-to-setlist-options" class="song-list" style="padding: 0;"></div>
    </div>
  </div>
</div>

<!-- ===== TRANSPOSE PICK MODAL (INC-3 — thay prompt()) ===== -->
<div id="transpose-pick-modal" class="modal-overlay hidden">
  <div class="modal-box" style="max-width:340px;">
    <div class="modal-header">
      <div style="display:flex;align-items:center;gap:.6rem;">
        <span style="font-size:1.25rem;">🎵</span>
        <h3 style="margin:0;font-size:1rem;">Dịch Giọng Bài Hát</h3>
      </div>
      <button id="btn-close-transpose-pick" class="icon-btn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <div class="modal-body">
      <p style="font-size:.85rem;color:var(--text-secondary);margin-bottom:.75rem;">Chọn số cung dịch giọng khi thêm bài vào Setlist:</p>
      <div id="transpose-pick-song-name" style="font-weight:600;font-size:.9rem;margin-bottom:1rem;padding:.5rem .75rem;background:var(--bg-overlay);border-radius:var(--radius-sm);border:1px solid var(--border);"></div>
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:.4rem;margin-bottom:1rem;">
        <button class="tp-btn" data-v="-4">-4</button>
        <button class="tp-btn" data-v="-3">-3</button>
        <button class="tp-btn" data-v="-2">-2</button>
        <button class="tp-btn" data-v="-1">-1</button>
        <button class="tp-btn tp-zero active" data-v="0">0</button>
        <button class="tp-btn" data-v="1">+1</button>
        <button class="tp-btn" data-v="2">+2</button>
        <button class="tp-btn" data-v="3">+3</button>
        <button class="tp-btn" data-v="4">+4</button>
        <button class="tp-btn" data-v="5">+5</button>
      </div>
      <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:1rem;">
        <label style="font-size:.82rem;color:var(--text-secondary);white-space:nowrap;">Tùy chỉnh:</label>
        <input id="transpose-pick-custom" type="number" min="-12" max="12" value="0"
          class="form-input" style="width:80px;text-align:center;font-size:.95rem;font-weight:600;">
      </div>
      <div style="display:flex;gap:.5rem;">
        <button id="btn-transpose-pick-cancel" class="btn btn-ghost" style="flex:1;">Hủy</button>
        <button id="btn-transpose-pick-ok" class="btn btn-primary" style="flex:2;">✓ Xác Nhận</button>
      </div>
    </div>
  </div>
</div>

<!-- ===== HELP MODAL (F9 upgrade — keyboard shortcuts + tiếng Việt) ===== -->
<div id="help-modal" class="modal-overlay hidden" style="align-items:flex-start;padding:1rem;">
  <div class="modal-box" style="max-width:760px;width:100%;margin:auto;max-height:90vh;display:flex;flex-direction:column;">
    <div class="modal-header" style="flex-shrink:0;">
      <div style="display:flex;align-items:center;gap:.75rem;">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        <h3 style="margin:0;font-size:1rem;">Hướng Dẫn Sử Dụng SheetApp</h3>
      </div>
      <button id="btn-close-help" class="icon-btn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
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
        <p style="margin-bottom:1rem;">Tất cả phím tắt hoạt động khi <strong>không đang nhập text</strong>. Trên iPad/Mobile dùng các nút trên giao diện.</p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
          <div>
            <h4>Điều hướng</h4>
            <table class="shortcut-table">
              <tr><td><kbd>↑</kbd> / <kbd>↓</kbd></td><td>Bài trước / Tiếp theo</td></tr>
              <tr><td><kbd>PageUp</kbd> / <kbd>PageDown</kbd></td><td>Trang trước / Tiếp</td></tr>
              <tr><td><kbd>Space</kbd></td><td>Cuộn xuống 70% màn hình</td></tr>
              <tr><td><kbd>Shift</kbd>+<kbd>Space</kbd></td><td>Cuộn lên</td></tr>
            </table>
            <h4>Dịch giọng</h4>
            <table class="shortcut-table">
              <tr><td><kbd>←</kbd> / <kbd>→</kbd></td><td>Dịch -1 / +1 cung</td></tr>
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


<!-- ===== PWA INSTALL INSTRUCTION MODAL ===== -->
<div id="pwa-install-modal" class="modal-overlay hidden">
  <div class="modal-box" style="max-width: 420px; background: rgba(255, 255, 255, 0.85); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border: 1px solid rgba(109, 40, 217, 0.12); box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);">
    <div class="modal-header">
      <div style="display:flex; align-items:center; gap:.75rem;">
        <span style="font-size: 1.5rem;">📲</span>
        <h3 style="margin:0; font-size:1.1rem; font-weight: 700; color: var(--accent);">Cài đặt Ứng Dụng SheetApp</h3>
      </div>
      <button id="btn-close-pwa-modal" class="icon-btn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <div class="modal-body" style="padding: 1rem 0 0;">
      <p style="font-size: 0.9rem; line-height: 1.6; color: var(--text-secondary); margin-bottom: 1.25rem;">
        Cài đặt **SheetApp** lên màn hình chính để mở nhạc nhanh chóng, chạy ngoại tuyến (Offline) ngay cả khi không có mạng Internet.
      </p>
      
      <!-- Hướng dẫn iOS Safari -->
      <div id="pwa-ios-instructions" class="hidden">
        <h4 style="font-size: 0.85rem; text-transform: uppercase; color: var(--accent); margin-bottom: 0.75rem; font-weight: 700; letter-spacing: 0.5px;">Hướng dẫn trên iPad / iPhone (Safari)</h4>
        <ol style="padding-left: 1.25rem; font-size: 0.88rem; color: var(--text-secondary); line-height: 1.85; display: flex; flex-direction: column; gap: 0.5rem;">
          <li>Nhấn vào biểu tượng <strong>Chia sẻ (Share)</strong> <span style="font-size: 1.1rem;">⎋</span> ở trên thanh công cụ của Safari.</li>
          <li>Cuộn xuống dưới và chọn mục <strong>Thêm vào MH chính (Add to Home Screen)</strong> <span style="font-size: 1.1rem;">⊞</span>.</li>
          <li>Nhấn <strong>Thêm (Add)</strong> ở góc trên bên phải để hoàn tất cài đặt.</li>
        </ol>
      </div>

      <!-- Hướng dẫn Desktop/Android -->
      <div id="pwa-general-instructions" class="hidden">
        <p style="font-size: 0.88rem; color: var(--text-secondary); line-height: 1.7;">
          Nhấn nút <strong>Cài đặt</strong> bên dưới để tự động cài đặt ứng dụng vào màn hình chính của bạn.
        </p>
        <button id="btn-pwa-prompt-trigger" class="btn btn-primary w-full mt-1" style="background: linear-gradient(135deg, #10b981, #059669); border: none; font-weight: 700; height: 40px;">Cài Đặt Ngay</button>
      </div>
    </div>
  </div>
</div>

<script>
/* ===== HELP MODAL INIT ===== */
(function() {
  document.addEventListener('DOMContentLoaded', function() {
    var modal   = document.getElementById('help-modal');
    var btnOpen = document.getElementById('btn-help');
    var btnClose  = document.getElementById('btn-close-help');
    var btnCloseF = document.getElementById('btn-close-help-footer');

    function openHelp(tabId) {
      if (!modal) return;
      modal.classList.remove('hidden');
      if (tabId) {
        document.querySelectorAll('.help-tab').forEach(function(t) { t.classList.remove('active'); });
        document.querySelectorAll('.help-pane').forEach(function(p) { p.classList.remove('active'); p.classList.add('hidden'); });
        var tab = document.querySelector('.help-tab[data-tab="' + tabId + '"]');
        var pane = document.getElementById('help-tab-' + tabId);
        if (tab) tab.classList.add('active');
        if (pane) { pane.classList.remove('hidden'); pane.classList.add('active'); }
      }
    }
    function closeHelp() { modal && modal.classList.add('hidden'); }

    if (btnOpen)   btnOpen.addEventListener('click', function() { openHelp(); });
    if (btnClose)  btnClose.addEventListener('click', closeHelp);
    if (btnCloseF) btnCloseF.addEventListener('click', closeHelp);
    if (modal)     modal.addEventListener('click', function(e) { if (e.target === modal) closeHelp(); });

    document.querySelectorAll('.help-tab').forEach(function(tab) {
      tab.addEventListener('click', function() {
        document.querySelectorAll('.help-tab').forEach(function(t) { t.classList.remove('active'); });
        document.querySelectorAll('.help-pane').forEach(function(p) { p.classList.remove('active'); p.classList.add('hidden'); });
        tab.classList.add('active');
        var pane = document.getElementById('help-tab-' + tab.dataset.tab);
        if (pane) { pane.classList.remove('hidden'); pane.classList.add('active'); }
      });
    });

    document.addEventListener('keydown', function(e) {
      var tag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
      if (['input','textarea','select'].includes(tag)) return;
      if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
        if (modal && modal.classList.contains('hidden')) openHelp('shortcuts');
        else closeHelp();
      }
    });

    window._helpModalOpen = openHelp;
  });
})();

/* ===== TRANSPOSE PICK MODAL INIT ===== */
(function() {
  document.addEventListener('DOMContentLoaded', function() {
    var modal     = document.getElementById('transpose-pick-modal');
    var customIn  = document.getElementById('transpose-pick-custom');
    var btnOk     = document.getElementById('btn-transpose-pick-ok');
    var btnCancel = document.getElementById('btn-transpose-pick-cancel');
    var btnClose  = document.getElementById('btn-close-transpose-pick');
    var _cb = null;

    function closePick(val) {
      if (modal) modal.classList.add('hidden');
      if (_cb) { _cb(val); _cb = null; }
    }

    document.querySelectorAll('.tp-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        document.querySelectorAll('.tp-btn').forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
        if (customIn) customIn.value = btn.dataset.v;
      });
    });

    if (customIn) {
      customIn.addEventListener('input', function() {
        var v = parseInt(customIn.value) || 0;
        document.querySelectorAll('.tp-btn').forEach(function(b) {
          b.classList.toggle('active', parseInt(b.dataset.v) === v);
        });
      });
      customIn.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') { e.preventDefault(); closePick(parseInt(customIn.value) || 0); }
        if (e.key === 'Escape') { e.preventDefault(); closePick(null); }
      });
    }

    if (btnOk)     btnOk.addEventListener('click',    function() { closePick(parseInt(customIn ? customIn.value : 0) || 0); });
    if (btnCancel) btnCancel.addEventListener('click', function() { closePick(null); });
    if (btnClose)  btnClose.addEventListener('click',  function() { closePick(null); });
    if (modal)     modal.addEventListener('click', function(e) { if (e.target === modal) closePick(null); });

    /* Public API: window.TransposePick.show(songName, defaultVal) → Promise<number|null> */
    window.TransposePick = {
      show: function(songName, defaultVal) {
        if (!modal) return Promise.resolve(0);
        var defV = defaultVal !== undefined ? (parseInt(defaultVal) || 0) : 0;
        if (customIn) customIn.value = defV;
        document.querySelectorAll('.tp-btn').forEach(function(b) {
          b.classList.toggle('active', parseInt(b.dataset.v) === defV);
        });
        var nameEl = document.getElementById('transpose-pick-song-name');
        if (nameEl) nameEl.textContent = songName || '';
        modal.classList.remove('hidden');
        setTimeout(function() { if (customIn) customIn.select(); }, 80);
        return new Promise(function(resolve) { _cb = resolve; });
      }
    };
  });
})();
</script>
