<?php
/**
 * SheetApp 2.0 — Trung Tâm Hướng Dẫn Sử Dụng (Interactive Documentation Hub)
 * Đường dẫn: https://sheet.hyb.io.vn/huong-dan/
 */
declare(strict_types=1);
$scriptDir = str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? ''));
$appBase = rtrim(dirname($scriptDir), '/');
if ($appBase === '/' || $appBase === '\\') $appBase = '';
?>
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Hướng Dẫn Sử Dụng SheetApp 2.0 — Cẩm Nang Toàn Diện</title>
  <meta name="description" content="Trung tâm hướng dẫn sử dụng toàn diện SheetApp 2.0: Đọc sheet, Soạn hợp âm, Dịch giọng, Live Band Studio, Luyện tập bè SATB, Visual MusicXML Editor.">
  <script>if (typeof window !== 'undefined' && typeof window.__APP_BASE__ === 'undefined') { window.__APP_BASE__ = <?= json_encode($appBase, JSON_UNESCAPED_SLASHES) ?>; }</script>
  <link rel="icon" type="image/svg+xml" href="<?= $appBase ?>/favicon.svg">
  <link rel="stylesheet" href="<?= $appBase ?>/assets/css/app-shell.css">
  <link rel="stylesheet" href="<?= $appBase ?>/huong-dan/huong-dan.css?v=<?= time() ?>">
</head>
<body>
<?php $activePillar = 'guide'; require_once __DIR__ . '/../includes/app_nav.php'; ?>

  <!-- ══════════════ 1. TOP HEADER & SEARCH ══════════════ -->
  <header class="docs-header">
    <div class="header-left">
      <button id="btn-sidebar-toggle" class="btn-sidebar-toggle" title="Mở danh mục hướng dẫn">☰</button>
      <a href="<?= $appBase ?>/huong-dan/" class="docs-brand">
        <span class="brand-icon">🎼</span>
        <span class="brand-title">SheetApp</span>
        <span class="brand-badge">Hướng Dẫn v2.0</span>
      </a>
    </div>

    <div class="header-center">
      <div class="search-box">
        <span class="search-icon">🔍</span>
        <input type="text" id="search-docs" class="search-input" placeholder="Tìm kiếm tính năng (VD: capo, break, tap tempo, a-b loop, pedal...)" aria-label="Tìm kiếm hướng dẫn">
        <button id="search-clear" class="search-clear" style="display: none;" title="Xóa tìm kiếm">✕</button>
      </div>
    </div>

    <div class="header-right">
      <a href="<?= $appBase ?>/" class="nav-link-btn btn-outline" title="Về trang đọc sheet chính">
        <span>📖</span>
        <span>Đọc Sheet</span>
      </a>
      <a href="<?= $appBase ?>/live-band/" class="nav-link-btn btn-primary" title="Mở phòng Live Band sân khấu">
        <span>📡</span>
        <span>Live Band</span>
      </a>
    </div>
  </header>

  <!-- ══════════════ 2. ROLE FILTER STRIP ══════════════ -->
  <nav class="role-filter-strip" aria-label="Lọc hướng dẫn theo vai trò">
    <span class="role-strip-label">Xem Theo Vai Trò:</span>
    <div class="role-pills-group">
      <button class="btn-role-filter active" data-role="all">👑 Tất Cả Tính Năng</button>
      <button class="btn-role-filter" data-role="leader">👑 Ca Trưởng / Trưởng Ban</button>
      <button class="btn-role-filter" data-role="musician">🎸 Nhạc Công (Guitar/Bass/Keys/Trống)</button>
      <button class="btn-role-filter" data-role="vocal">🎤 Ca Viên / Ca Đoàn</button>
      <button class="btn-role-filter" data-role="admin">🛠️ Quản Trị Viên (Admin)</button>
    </div>
  </nav>

  <!-- ══════════════ 3. MAIN LAYOUT (SIDEBAR + CONTENT) ══════════════ -->
  <div class="docs-layout">
    <!-- Mobile Backdrop -->
    <div id="sidebar-backdrop" class="docs-sidebar-backdrop"></div>

    <!-- Sticky Sidebar Navigation -->
    <aside id="docs-sidebar" class="docs-sidebar">
      <div class="sidebar-section-title">MỤC LỤC TÀI LIỆU</div>
      <ul class="sidebar-menu">
        <li>
          <a href="#mod-1" class="sidebar-link active">
            <span class="sidebar-icon">🚀</span>
            <span>1. Bắt Đầu Nhanh</span>
          </a>
        </li>
        <li>
          <a href="#mod-2" class="sidebar-link">
            <span class="sidebar-icon">📄</span>
            <span>2. Trình Đọc & Thu Phóng</span>
          </a>
        </li>
        <li>
          <a href="#mod-3" class="sidebar-link">
            <span class="sidebar-icon">🎸</span>
            <span>3. Hợp Âm & Dịch Giọng</span>
          </a>
        </li>
        <li>
          <a href="#mod-4" class="sidebar-link">
            <span class="sidebar-icon">⏱️</span>
            <span>4. Đếm Nhịp & TAP Tempo</span>
          </a>
        </li>
        <li>
          <a href="#mod-5" class="sidebar-link">
            <span class="sidebar-icon">📋</span>
            <span>5. Setlist & Sổ Bài Tập</span>
          </a>
        </li>
        <li>
          <a href="#mod-6" class="sidebar-link">
            <span class="sidebar-icon">📡</span>
            <span>6. Live Band Studio</span>
          </a>
        </li>
        <li>
          <a href="#mod-7" class="sidebar-link">
            <span class="sidebar-icon">🎓</span>
            <span>7. Smart Learning (Bè SATB)</span>
          </a>
        </li>
        <li>
          <a href="#mod-8" class="sidebar-link">
            <span class="sidebar-icon">✏️</span>
            <span>8. Sửa Sheet MusicXML</span>
          </a>
        </li>
        <li>
          <a href="#mod-9" class="sidebar-link">
            <span class="sidebar-icon">⌨️</span>
            <span>9. Phím Tắt & Sự Cố</span>
          </a>
        </li>
        <li>
          <a href="#mod-10" class="sidebar-link">
            <span class="sidebar-icon">👥</span>
            <span>10. Phụng Vụ & Ca Đoàn</span>
          </a>
        </li>
      </ul>
    </aside>

    <!-- Main Content Stream -->
    <main class="docs-content">

      <!-- Hero Introduction Banner -->
      <section class="docs-hero">
        <h1 class="hero-title">Cẩm Nang Hướng Dẫn Sử Dụng SheetApp 2.0</h1>
        <p class="hero-subtitle">
          Nền tảng số hóa bản nhạc Thánh Ca và điều khiển sân khấu trực tiếp chuyên nghiệp dành cho Ca Đoàn, Trưởng Ban và Nhạc Công. Tài liệu này cung cấp đầy đủ chi tiết từng tính năng từ cơ bản đến nâng cao.
        </p>
        <div class="hero-stats">
          <span class="stat-pill">Phiên bản: <strong>v2.0 (High-Performance)</strong></span>
          <span class="stat-pill">Số mô-đun: <strong>9 Chuyên Đề Bài Bản</strong></span>
          <span class="stat-pill">Hỗ trợ thiết bị: <strong>PC, iPad, Android, Pedal Bluetooth</strong></span>
        </div>
      </section>

      <?php require_once __DIR__ . '/partials/chapters_1_to_5.php'; ?>
      <?php require_once __DIR__ . '/partials/chapters_6_to_10.php'; ?>

    </main>
  </div>

  <!-- Floating Back to Top Button -->
  <button id="btn-back-to-top" class="btn-back-to-top" title="Lên đầu trang">↑</button>

  <!-- ══════════════ FOOTER ══════════════ -->
  <footer class="docs-footer">
    <p>© 2026 SheetApp 2.0 — Hệ Thống Quản Lý & Biểu Diễn Bản Nhạc Thông Minh. Phát triển bởi Ban Hát & Hội Thánh.</p>
  </footer>

  <script src="<?= $appBase ?>/assets/js/core/ModalManager.js"></script>
  <script src="<?= $appBase ?>/assets/js/core/AppShell.js"></script>
  <script src="<?= $appBase ?>/huong-dan/huong-dan.js?v=<?= time() ?>"></script>
</body>
</html>
