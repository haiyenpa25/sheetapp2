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
$displayName= $_SESSION['display_name'] ?? $username;
$instrument = $_SESSION['instrument'] ?? 'Guitar';
?>
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SheetApp Manager — Quản Lý Kho Nhạc, Thành Viên & Hợp Âm</title>
  <meta name="description" content="Trung tâm quản lý kho nhạc, phân loại danh mục, tìm & chọn bài hát, đăng ký tài khoản thành viên và không gian cộng tác sáng tạo bộ hợp âm cho ban nhạc và ca đoàn.">
  <link rel="icon" type="image/svg+xml" href="../favicon.svg">

  <!-- Typography & Google Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">

  <link rel="stylesheet" href="../assets/css/app-shell.css">
  <link rel="stylesheet" href="manager.css?v=2.1.0">
</head>
<body class="manager-body">
  <?php $activePillar = 'manager'; require_once __DIR__ . '/../includes/app_nav.php'; ?>

  <?php require_once __DIR__ . '/partials/header.php'; ?>

  <?php require_once __DIR__ . '/partials/hero_kpi.php'; ?>

  <!-- ================= MAIN WORKSPACE CONTAINER ================= -->
  <main class="mgr-main-container">
    <?php require_once __DIR__ . '/partials/song_picker.php'; ?>

    <?php require_once __DIR__ . '/partials/tabs_bar.php'; ?>

    <?php require_once __DIR__ . '/partials/tab_repertoire.php'; ?>

    <?php require_once __DIR__ . '/partials/tab_community.php'; ?>

    <?php require_once __DIR__ . '/partials/tab_versions.php'; ?>

    <?php require_once __DIR__ . '/partials/tab_categories.php'; ?>

    <?php require_once __DIR__ . '/partials/tab_users.php'; ?>

    <?php require_once __DIR__ . '/partials/tab_usage.php'; ?>

    <?php require_once __DIR__ . '/partials/tab_reviews.php'; ?>

    <?php require_once __DIR__ . '/partials/tab_tenants.php'; ?>
  </main>

  <?php require_once __DIR__ . '/partials/modals.php'; ?>

  <!-- TOAST CONTAINER -->
  <div id="mgr-toast-container" class="mgr-toast-container"></div>

  <!-- App Logic -->
  <script src="../assets/js/core/FeatureFlags.js"></script>
  <script src="../assets/js/core/AppShell.js"></script>
  <script src="../assets/js/core/ModalManager.js"></script>
  <script src="../assets/js/core/ApiService.js"></script>
  <script src="../assets/js/core/SafeHtml.js"></script>
  <script src="js/manager-repertoire.js?v=2.2.0"></script>
  <script src="js/manager-community.js?v=2.2.0"></script>
  <script src="js/manager-versions.js?v=2.2.0"></script>
  <script src="js/manager-users.js?v=2.2.0"></script>
  <script src="js/manager-usage.js?v=2.2.0"></script>
  <script src="js/manager-reviews.js?v=2.2.0"></script>
  <script src="js/manager-notifications.js?v=2.2.0"></script>
  <script src="js/manager-tenants.js?v=2.2.0"></script>
  <script src="manager.js?v=2.2.0"></script>
</body>
</html>
