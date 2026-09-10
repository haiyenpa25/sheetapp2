<?php
/**
 * sheet.hyb.io.vn/manager/
 * Trung Tâm Quản Lý Kho Nhạc, Phân Quyền & Không Gian Cộng Tác Hợp Âm
 */
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
$isLoggedIn = isset($_SESSION['user_id']);
$username   = $_SESSION['username'] ?? '';
$userRole   = $_SESSION['role'] ?? 'viewer';
?>
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SheetApp Manager — Quản Lý Kho Nhạc & Cộng Tác Hợp Âm</title>
  <meta name="description" content="Trung tâm quản lý kho nhạc, phân loại danh mục, phân quyền thành viên và không gian cộng tác sáng tạo bộ hợp âm cho ban nhạc và ca đoàn.">
  <link rel="icon" type="image/svg+xml" href="../favicon.svg">

  <!-- Typography & Google Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">

  <link rel="stylesheet" href="manager.css?v=2.0.0">
</head>
<body class="manager-body">

  <!-- ================= TOP NAVIGATION BAR ================= -->
  <header class="mgr-header">
    <div class="mgr-header-brand">
      <a href="../" class="mgr-brand-link">
        <span class="mgr-brand-icon">🎼</span>
        <div class="mgr-brand-text">
          <span class="mgr-brand-title">SheetApp<span class="text-accent">2.0</span></span>
          <span class="mgr-brand-badge">MANAGER PORTAL</span>
        </div>
      </a>
    </div>

    <!-- Global Search -->
    <div class="mgr-search-box">
      <span class="mgr-search-icon">🔍</span>
      <input type="text" id="mgr-global-search" placeholder="Tìm bài hát, số thánh ca, tác giả (@user), hợp âm..." autocomplete="off">
      <kbd class="mgr-kbd">Ctrl+K</kbd>
      <button id="mgr-search-clear" class="mgr-btn-clear hidden" title="Xóa tìm kiếm">✕</button>
    </div>

    <!-- Quick Navigation & User Profile Area -->
    <div class="mgr-header-actions">
      <button id="btn-quick-fork" class="mgr-btn mgr-btn-primary">
        <span>✨</span> Tạo Bản Phối Mới
      </button>

      <div class="mgr-nav-links">
        <a href="../" class="mgr-nav-btn" title="Trang đọc sheet chính">📖 Sheet Reader</a>
        <a href="../live-band/" class="mgr-nav-btn" title="Phòng diễn ban nhạc sân khấu">🎯 Live Band</a>
        <a href="../huong-dan/" class="mgr-nav-btn" title="Xem cẩm nang hướng dẫn">📚 Hướng Dẫn</a>
      </div>

      <!-- User Widget -->
      <div class="mgr-user-widget" id="mgr-user-widget">
        <?php if ($isLoggedIn): ?>
          <div class="mgr-user-pill" id="mgr-user-menu-btn">
            <div class="mgr-avatar"><?= strtoupper(substr($username, 0, 1)) ?></div>
            <div class="mgr-user-info">
              <span class="mgr-user-name">@<?= htmlspecialchars($username) ?></span>
              <span class="mgr-user-role role-<?= htmlspecialchars($userRole) ?>">
                <?= $userRole === 'admin' ? '🛡️ Quản Trị' : ($userRole === 'banhat' ? '🎸 Ban Hát' : '👁️ Thành Viên') ?>
              </span>
            </div>
            <button class="mgr-btn-logout" id="mgr-btn-logout" title="Đăng xuất">⏻</button>
          </div>
        <?php else: ?>
          <button id="mgr-btn-login-modal" class="mgr-btn mgr-btn-ghost">
            <span>🔐</span> Đăng Nhập
          </button>
        <?php endif; ?>
      </div>
    </div>
  </header>

  <!-- ================= HERO KPI OVERVIEW ================= -->
  <section class="mgr-hero-kpi">
    <div class="mgr-kpi-card" data-tab-target="tab-repertoire">
      <div class="mgr-kpi-icon icon-song">🎼</div>
      <div class="mgr-kpi-data">
        <span class="mgr-kpi-value" id="kpi-total-songs">...</span>
        <span class="mgr-kpi-label">Bài Hát Gốc (Master)</span>
      </div>
      <span class="mgr-kpi-badge">Khóa Bảo Vệ 🔒</span>
    </div>

    <div class="mgr-kpi-card" data-tab-target="tab-categories">
      <div class="mgr-kpi-icon icon-cat">📂</div>
      <div class="mgr-kpi-data">
        <span class="mgr-kpi-value" id="kpi-total-cats">...</span>
        <span class="mgr-kpi-label">Thể Loại Phụng Vụ</span>
      </div>
      <span class="mgr-kpi-badge">Phân Loại Đa Tầng</span>
    </div>

    <div class="mgr-kpi-card highlight-card" data-tab-target="tab-community">
      <div class="mgr-kpi-icon icon-chord">🎸</div>
      <div class="mgr-kpi-data">
        <span class="mgr-kpi-value" id="kpi-total-chords">...</span>
        <span class="mgr-kpi-label">Bộ Hợp Âm Thành Viên</span>
      </div>
      <span class="mgr-kpi-badge badge-pulse">Công Khai 🌐</span>
    </div>

    <div class="mgr-kpi-card" data-tab-target="tab-versions">
      <div class="mgr-kpi-icon icon-ver">📑</div>
      <div class="mgr-kpi-data">
        <span class="mgr-kpi-value" id="kpi-total-vers">...</span>
        <span class="mgr-kpi-label">Bản Phối MusicXML</span>
      </div>
      <span class="mgr-kpi-badge">Fork Độc Lập</span>
    </div>

    <div class="mgr-kpi-card" data-tab-target="tab-users">
      <div class="mgr-kpi-icon icon-user">👥</div>
      <div class="mgr-kpi-data">
        <span class="mgr-kpi-value" id="kpi-total-users">...</span>
        <span class="mgr-kpi-label">Thành Viên Hoạt Động</span>
      </div>
      <span class="mgr-kpi-badge">Phân Quyền</span>
    </div>
  </section>

  <!-- ================= MAIN WORKSPACE CONTAINER ================= -->
  <main class="mgr-main-container">
    
    <!-- Workspace Tabs Navigation -->
    <nav class="mgr-tabs-bar">
      <button class="mgr-tab-btn active" data-tab="tab-repertoire">
        <span class="tab-icon">🎼</span> Kho Bài Hát & Thể Loại
        <span class="mgr-tab-badge" id="tab-repertoire-count">...</span>
      </button>
      <button class="mgr-tab-btn" data-tab="tab-community">
        <span class="tab-icon">🎸</span> Bộ Hợp Âm Cộng Đồng
        <span class="mgr-tab-badge" id="tab-community-count">...</span>
      </button>
      <button class="mgr-tab-btn" data-tab="tab-versions">
        <span class="tab-icon">📑</span> Phiên Bản MusicXML Fork
      </button>
      <button class="mgr-tab-btn" data-tab="tab-categories">
        <span class="tab-icon">📂</span> Quản Lý Thể Loại
      </button>
      <button class="mgr-tab-btn" data-tab="tab-users" id="mgr-nav-tab-users">
        <span class="tab-icon">👥</span> Thành Viên & Phân Quyền
      </button>
    </nav>

    <!-- ================= TAB 1: KHO BÀI HÁT & THỂ LOẠI (REPERTOIRE) ================= -->
    <section id="tab-repertoire" class="mgr-tab-pane active">
      <!-- Filter Bar -->
      <div class="mgr-pane-filter-bar">
        <div class="mgr-category-pills" id="mgr-cat-pills">
          <button class="mgr-pill active" data-cat-id="">Tất Cả Thể Loại</button>
          <!-- Dynamic Pills from API -->
        </div>

        <div class="mgr-pane-filter-right">
          <label class="mgr-switch-label">
            <input type="checkbox" id="chk-only-has-chords">
            <span>Chỉ bài có bản phối thành viên</span>
          </label>
        </div>
      </div>

      <!-- Repertoire Table / Grid -->
      <div class="mgr-repertoire-wrapper">
        <table class="mgr-table" id="mgr-songs-table">
          <thead>
            <tr>
              <th style="width: 70px;">STT</th>
              <th>Tựa Đề Thánh Ca</th>
              <th style="width: 90px; text-align:center;">Giọng</th>
              <th style="width: 170px;">Thể Loại</th>
              <th>Bản Phối & Hợp Âm Thành Viên (Công Khai)</th>
              <th style="width: 220px; text-align:right;">Hành Động</th>
            </tr>
          </thead>
          <tbody id="mgr-songs-tbody">
            <tr>
              <td colspan="6" class="mgr-table-loading">
                <div class="mgr-spinner"></div>
                <p>Đang nạp kho dữ liệu bài hát...</p>
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Pagination -->
        <div class="mgr-pagination" id="mgr-songs-pagination">
          <span class="mgr-page-info" id="mgr-page-info">Hiển thị 1 - 50</span>
          <div class="mgr-page-btns">
            <button id="btn-prev-page" class="mgr-btn mgr-btn-sm" disabled>← Trang Trước</button>
            <button id="btn-next-page" class="mgr-btn mgr-btn-sm">Trang Kế →</button>
          </div>
        </div>
      </div>
    </section>

    <!-- ================= TAB 2: BỘ HỢP ÂM CỘNG ĐỒNG (COMMUNITY CHORDS) ================= -->
    <section id="tab-community" class="mgr-tab-pane">
      <div class="mgr-pane-filter-bar">
        <!-- Instrument Filter Pills -->
        <div class="mgr-filter-group">
          <span class="mgr-filter-title">Nhạc cụ:</span>
          <div class="mgr-pill-row" id="mgr-instrument-pills">
            <button class="mgr-pill active" data-inst="">Tất Cả</button>
            <button class="mgr-pill" data-inst="guitar">🎸 Guitar</button>
            <button class="mgr-pill" data-inst="piano">🎹 Piano / Key</button>
            <button class="mgr-pill" data-inst="bass">🎻 Bass</button>
            <button class="mgr-pill" data-inst="general">🎼 Tổng Hợp</button>
          </div>
        </div>

        <!-- Author Filter Chips -->
        <div class="mgr-filter-group">
          <span class="mgr-filter-title">Người soạn:</span>
          <div class="mgr-pill-row" id="mgr-author-chips">
            <button class="mgr-pill active" data-author="">Tất Cả Tác Giả</button>
            <!-- Render dynamic user chips -->
          </div>
        </div>

        <div class="mgr-pane-filter-right">
          <label class="mgr-switch-label">
            <input type="checkbox" id="chk-recommended-only">
            <span>⭐ Chỉ bản Ca Trưởng khuyên dùng</span>
          </label>
        </div>
      </div>

      <!-- Community Cards Grid -->
      <div class="mgr-community-grid" id="mgr-community-grid">
        <div class="mgr-table-loading" style="grid-column: 1/-1;">
          <div class="mgr-spinner"></div>
          <p>Đang nạp các bộ hợp âm đóng góp...</p>
        </div>
      </div>
    </section>

    <!-- ================= TAB 3: PHIÊN BẢN MUSICXML FORK ================= -->
    <section id="tab-versions" class="mgr-tab-pane">
      <div class="mgr-info-callout">
        <span class="mgr-callout-icon">💡</span>
        <div class="mgr-callout-text">
          <strong>Cơ chế Fork MusicXML Chuyên Sâu:</strong> Đây là các bản nốt nhạc độc lập được nhân bản từ bản gốc Master, cho phép Ca Trưởng hoặc Nhạc Trưởng phân chia 4 bè SATB, đổi ô nhịp hoặc soạn bè dạo riêng mà không ảnh hưởng tới bản gốc của hội thánh.
        </div>
      </div>

      <div class="mgr-versions-grid" id="mgr-versions-grid">
        <!-- Rendered via JS -->
      </div>
    </section>

    <!-- ================= TAB 4: QUẢN LÝ THỂ LOẠI (CATEGORIES) ================= -->
    <section id="tab-categories" class="mgr-tab-pane">
      <div class="mgr-section-header">
        <div>
          <h3>📂 Cây Thể Loại Âm Nhạc Phụng Vụ</h3>
          <p class="text-muted">Phân loại kho bài hát theo chủ đề, niên lịch phụng vụ và đối tượng sinh hoạt.</p>
        </div>
        <button id="btn-add-category-modal" class="mgr-btn mgr-btn-primary">+ Thêm Danh Mục Mới</button>
      </div>

      <div class="mgr-categories-grid" id="mgr-categories-grid">
        <!-- Rendered via JS -->
      </div>
    </section>

    <!-- ================= TAB 5: QUẢN TRỊ THÀNH VIÊN (USERS - ADMIN) ================= -->
    <section id="tab-users" class="mgr-tab-pane">
      <div class="mgr-section-header">
        <div>
          <h3>👥 Quản Trị Thành Viên & Phân Quyền</h3>
          <p class="text-muted">Kiểm soát danh sách nhạc công, phân quyền tạo hợp âm và theo dõi đóng góp.</p>
        </div>
        <button id="btn-add-user-modal" class="mgr-btn mgr-btn-primary">+ Tạo Tài Khoản Thành Viên</button>
      </div>

      <div class="mgr-users-table-wrapper">
        <table class="mgr-table" id="mgr-users-table">
          <thead>
            <tr>
              <th>Thành Viên</th>
              <th>Vai Trò</th>
              <th>Nhạc Cụ Sở Trường</th>
              <th>Số Bộ Hợp Âm Đóng Góp</th>
              <th>Số Bản Phối XML</th>
              <th>Ngày Tham Gia</th>
              <th style="text-align:right;">Hành Động</th>
            </tr>
          </thead>
          <tbody id="mgr-users-tbody">
            <!-- Rendered via JS -->
          </tbody>
        </table>
      </div>
    </section>

  </main>

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
            <select id="fork-song-select" class="mgr-input" required>
              <option value="">-- Chọn bài hát từ kho --</option>
            </select>
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

  <!-- 2. MODAL THÊM TÀI KHOẢN THÀNH VIÊN (ADMIN) -->
  <div class="mgr-modal-overlay hidden" id="modal-user">
    <div class="mgr-modal-box" style="max-width: 500px;">
      <div class="mgr-modal-header">
        <h3 class="mgr-modal-title">👤 Tạo Tài Khoản Thành Viên Mới</h3>
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
          <div class="mgr-form-group">
            <label class="mgr-label">Phân quyền</label>
            <select id="new-user-role" class="mgr-input">
              <option value="banhat" selected>🎸 Ban Hát / Nhạc Công (Được tạo bản clone & hợp âm)</option>
              <option value="viewer">👁️ Viewer (Chỉ xem sheet & tập đàn)</option>
              <option value="admin">🛡️ Admin (Quản trị toàn quyền hệ thống)</option>
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

  <!-- 3. MODAL THÊM / SỬA THỂ LOẠI (ADMIN) -->
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

  <!-- 4. MODAL ĐĂNG NHẬP NHANH -->
  <div class="mgr-modal-overlay hidden" id="modal-login">
    <div class="mgr-modal-box" style="max-width: 420px;">
      <div class="mgr-modal-header">
        <h3 class="mgr-modal-title">🔐 Đăng Nhập SheetApp</h3>
        <button class="mgr-modal-close" data-close="modal-login">✕</button>
      </div>
      <div class="mgr-modal-body">
        <p class="text-sm text-muted" style="margin-bottom: 1rem;">Đăng nhập để tạo các bản phối hợp âm mang định danh cá nhân của bạn.</p>
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
      </div>
    </div>
  </div>

  <!-- TOAST CONTAINER -->
  <div id="mgr-toast-container" class="mgr-toast-container"></div>

  <!-- App Logic -->
  <script src="manager.js?v=2.0.0"></script>
</body>
</html>
