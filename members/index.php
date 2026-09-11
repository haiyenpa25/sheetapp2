<?php
/**
 * members/index.php — Trang Quản Lý Thành Viên Ban Nhạc & Gán Bộ Hợp Âm Cá Nhân
 * SheetApp Platform
 */
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
require_once __DIR__ . '/../api/core/Auth.php';
$isLoggedIn = Auth::isLoggedIn();
$isAdmin    = Auth::isAdmin();
$isBanhat   = Auth::isBanhat();
$currentUsername = Auth::username();
$currentChordCode = Auth::chordCode();
?>
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Quản Lý Ban Nhạc & Hợp Âm Nhạc Công — SheetApp</title>
  <link rel="icon" href="/assets/icons/favicon.ico">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/assets/css/base.css">
  <link rel="stylesheet" href="/members/members.css?v=<?= time() ?>">
</head>
<body class="members-app dark-mode">

  <!-- TOP NAVIGATION BAR -->
  <header class="mbr-header">
    <div class="mbr-brand">
      <a href="/" class="mbr-back-link" title="Về trang chủ SheetApp">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
        <span>Trang Chủ</span>
      </a>
      <div class="mbr-brand-title">
        <span class="brand-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        </span>
        <h1>Ban Nhạc & Hợp Âm Cá Nhân</h1>
      </div>
    </div>

    <div class="mbr-header-actions">
      <a href="/manager/" class="mbr-btn mbr-btn-ghost" title="Cổng Quản Lý Kho Nhạc Tổng">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
        <span>Kho Nhạc Manager</span>
      </a>
      <button id="btn-theme-toggle" class="mbr-btn mbr-btn-icon" title="Đổi giao diện Sáng / Tối">
        <svg class="theme-icon theme-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
      </button>
      <div class="mbr-user-badge">
        <span class="user-role-dot"></span>
        <span id="current-user-display"><?= htmlspecialchars($currentUsername ?: 'Khách') ?></span>
        <?php if ($currentChordCode): ?>
          <span class="chord-code-badge" title="Mã hợp âm cá nhân của bạn"><?= htmlspecialchars($currentChordCode) ?></span>
        <?php endif; ?>
      </div>
    </div>
  </header>

  <main class="mbr-main-container">
    <!-- HERO / BANNER -->
    <section class="mbr-hero-section">
      <div class="mbr-hero-content">
        <h2>Không Gian Hợp Âm Riêng Cho Từng Nhạc Công</h2>
        <p>Mỗi nhạc công sở hữu một mã hợp âm riêng (ví dụ <strong>HD</strong> cho Hoài Dinh, <strong>NAM</strong> cho Hoàng Nam). Bản gốc <strong>TLH</strong> luôn bất biến, nhạc công tự do sáng tạo bản phối riêng và được bảo vệ bản quyền độc quyền.</p>
      </div>
      <div class="mbr-hero-action">
        <button id="btn-open-create-modal" class="mbr-btn mbr-btn-primary">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          <span>Thêm Nhạc Công Mới</span>
        </button>
      </div>
    </section>

    <!-- STATS OVERVIEW -->
    <section class="mbr-stats-grid">
      <div class="mbr-stat-card">
        <div class="stat-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
        </div>
        <div class="stat-info">
          <div class="stat-value" id="stat-total-musicians">0</div>
          <div class="stat-label">Nhạc Công & Thành Viên</div>
        </div>
      </div>
      <div class="mbr-stat-card">
        <div class="stat-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
        </div>
        <div class="stat-info">
          <div class="stat-value" id="stat-total-chord-codes">0</div>
          <div class="stat-label">Bộ Hợp Âm Cá Nhân</div>
        </div>
      </div>
      <div class="mbr-stat-card">
        <div class="stat-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        </div>
        <div class="stat-info">
          <div class="stat-value" id="stat-protected-base">TLH (Gốc)</div>
          <div class="stat-label">Bản Phối Chuẩn Bất Biến</div>
        </div>
      </div>
      <div class="mbr-stat-card">
        <div class="stat-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>
        </div>
        <div class="stat-info">
          <div class="stat-value text-emerald">Độc Quyền</div>
          <div class="stat-label">Bảo Vệ Quyền Biên Soạn</div>
        </div>
      </div>
    </section>

    <!-- FILTER & SEARCH BAR -->
    <section class="mbr-toolbar-section">
      <div class="mbr-search-wrap">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input type="text" id="filter-search" placeholder="Tìm theo tên nhạc công, tài khoản, mã hợp âm (HD, NAM...)...">
      </div>

      <div class="mbr-filter-group">
        <select id="filter-instrument" class="mbr-select">
          <option value="">Tất cả nhạc cụ</option>
          <option value="Guitar">🎸 Guitar</option>
          <option value="Piano">🎹 Piano</option>
          <option value="Organ">🎹 Organ / Keyboard</option>
          <option value="Bass">🎸 Bass</option>
          <option value="Drums">🥁 Trống</option>
          <option value="Vocal">🎤 Đệm Hát / Solo</option>
        </select>

        <select id="filter-role" class="mbr-select">
          <option value="">Tất cả vai trò</option>
          <option value="banhat">Ban Hát (Biên tập hợp âm)</option>
          <option value="admin">Quản Trị Viên</option>
          <option value="viewer">Thành viên xem</option>
        </select>
      </div>
    </section>

    <!-- MUSICIANS GRID -->
    <section class="mbr-musicians-section">
      <div id="musicians-loading" class="mbr-loading">
        <div class="mbr-spinner"></div>
        <span>Đang tải danh sách ban nhạc...</span>
      </div>
      <div id="musicians-grid" class="musicians-grid hidden"></div>
      <div id="musicians-empty" class="mbr-empty hidden">
        <span class="empty-icon">🎵</span>
        <p>Không tìm thấy nhạc công nào phù hợp với bộ lọc.</p>
      </div>
    </section>
  </main>

  <!-- MODAL: THÊM NHẠC CÔNG MỚI -->
  <div id="modal-create-musician" class="mbr-modal-backdrop hidden">
    <div class="mbr-modal-dialog">
      <div class="mbr-modal-header">
        <h3>🎸 Thêm Nhạc Công & Gán Bộ Hợp Âm</h3>
        <button class="mbr-modal-close" data-close-modal>✕</button>
      </div>
      <form id="form-create-musician" class="mbr-modal-body">
        <div class="form-row">
          <div class="form-field">
            <label for="create-username">Tên đăng nhập <span class="req">*</span></label>
            <input type="text" id="create-username" name="username" placeholder="vd: hoaidinh, nam_guitar" required autocomplete="off">
            <span class="field-hint">Chỉ dùng chữ cái, số, gạch dưới. Dùng để đăng nhập.</span>
          </div>
          <div class="form-field">
            <label for="create-password">Mật khẩu <span class="req">*</span></label>
            <input type="text" id="create-password" name="password" value="123456" required>
            <span class="field-hint">Mặc định là 123456 (nhạc công có thể tự đổi sau).</span>
          </div>
        </div>

        <div class="form-row">
          <div class="form-field">
            <label for="create-display-name">Tên hiển thị <span class="req">*</span></label>
            <input type="text" id="create-display-name" name="display_name" placeholder="vd: Hoài Dinh, Hoàng Nam" required>
          </div>
          <div class="form-field">
            <label for="create-instrument">Nhạc cụ phụ trách</label>
            <input type="text" id="create-instrument" name="instrument" placeholder="vd: Guitar / Đệm Hát, Piano, Bass..." value="Guitar">
          </div>
        </div>

        <div class="form-row">
          <div class="form-field">
            <label for="create-chord-code">
              Mã Hợp Âm Cá Nhân (Chord Code) <span class="req">*</span>
            </label>
            <div class="input-with-badge">
              <input type="text" id="create-chord-code" name="chord_code" placeholder="vd: HD, NAM, TUAN" maxlength="8" required>
              <span class="chord-preview-tag" id="preview-chord-tag">HD</span>
            </div>
            <span class="field-hint">Mã xuất hiện trên dropdown hợp âm trang chủ (chỉ người này mới được sửa).</span>
          </div>
          <div class="form-field">
            <label for="create-role">Vai trò hệ thống</label>
            <select id="create-role" name="role" class="mbr-select">
              <option value="banhat" selected>🎸 Ban Hát (Điền & sửa hợp âm)</option>
              <option value="admin">⭐ Quản Trị Viên (Toàn quyền)</option>
              <option value="viewer">👁️ Khách / Xem</option>
            </select>
          </div>
        </div>

        <div class="form-box-notice">
          <span class="notice-icon">💡</span>
          <div>
            <strong>Quy tắc bất biến:</strong> Bộ <code>TLH (Gốc)</code> được bảo vệ vĩnh viễn. Khi tạo nhạc công với mã <code>HD</code>, chỉ tài khoản này mới được phép bấm <em>[Điền HÂ]</em> để lưu vào bộ <code>HD</code> trên trang chủ.
          </div>
        </div>

        <div class="mbr-modal-footer">
          <button type="button" class="mbr-btn mbr-btn-ghost" data-close-modal>Hủy</button>
          <button type="submit" class="mbr-btn mbr-btn-primary" id="btn-submit-create">
            <span>Tạo Nhạc Công & Gán Hợp Âm</span>
          </button>
        </div>
      </form>
    </div>
  </div>

  <!-- MODAL: CHỈNH SỬA NHẠC CÔNG -->
  <div id="modal-edit-musician" class="mbr-modal-backdrop hidden">
    <div class="mbr-modal-dialog">
      <div class="mbr-modal-header">
        <h3>✏️ Chỉnh Sửa Thông Tin Nhạc Công</h3>
        <button class="mbr-modal-close" data-close-modal>✕</button>
      </div>
      <form id="form-edit-musician" class="mbr-modal-body">
        <input type="hidden" id="edit-user-id" name="id">

        <div class="form-row">
          <div class="form-field">
            <label>Tài khoản</label>
            <input type="text" id="edit-username" disabled class="input-disabled">
          </div>
          <div class="form-field">
            <label for="edit-display-name">Tên hiển thị <span class="req">*</span></label>
            <input type="text" id="edit-display-name" name="display_name" required>
          </div>
        </div>

        <div class="form-row">
          <div class="form-field">
            <label for="edit-instrument">Nhạc cụ</label>
            <input type="text" id="edit-instrument" name="instrument" required>
          </div>
          <div class="form-field">
            <label for="edit-chord-code">Mã Hợp Âm Cá Nhân</label>
            <input type="text" id="edit-chord-code" name="chord_code" maxlength="8" required>
          </div>
        </div>

        <div class="form-row">
          <div class="form-field">
            <label for="edit-role">Vai trò</label>
            <select id="edit-role" name="role" class="mbr-select">
              <option value="banhat">🎸 Ban Hát (Điền & sửa hợp âm)</option>
              <option value="admin">⭐ Quản Trị Viên (Toàn quyền)</option>
              <option value="viewer">👁️ Khách / Xem</option>
            </select>
          </div>
          <div class="form-field">
            <label for="edit-password">Đổi mật khẩu mới (bỏ trống nếu giữ nguyên)</label>
            <input type="text" id="edit-password" name="password" placeholder="Nhập mật khẩu mới...">
          </div>
        </div>

        <div class="mbr-modal-footer">
          <button type="button" class="mbr-btn mbr-btn-ghost" data-close-modal>Hủy</button>
          <button type="submit" class="mbr-btn mbr-btn-primary" id="btn-submit-edit">Lưu Thay Đổi</button>
        </div>
      </form>
    </div>
  </div>

  <!-- TOAST NOTIFICATION -->
  <div id="mbr-toast" class="mbr-toast hidden"></div>

  <script src="/members/members.js?v=<?= time() ?>"></script>
</body>
</html>
