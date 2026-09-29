<?php
/**
 * live-band/projector.php — SheetApp Sanctuary Lyrics & Service Plan Projector
 * 
 * High-contrast, distraction-free stage lyrics & liturgy projection for church screens,
 * projectors, and sanctuary LED walls.
 * Integrated with Service Plan (Epic 3.4) & SSE Live Sync Transport.
 * Route: /live-band/projector.php?room=CODE
 */
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
$roomParam = isset($_GET['room']) ? htmlspecialchars(trim($_GET['room']), ENT_QUOTES, 'UTF-8') : '';
$scriptDir = str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? ''));
$appBase = rtrim(dirname($scriptDir), '/');
if ($appBase === '/' || $appBase === '\\') $appBase = '';
?>
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <script>
    window.__APP_BASE__ = <?= json_encode($appBase) ?>;
    window.__PROJECTOR_ROOM__ = <?= json_encode($roomParam) ?>;
  </script>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Màn Hình Máy Chiếu Nhà Thờ — Live Band Studio</title>
  <meta name="theme-color" content="#000000">

  <!-- Google Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap" rel="stylesheet">

  <!-- Projector CSS -->
  <link rel="stylesheet" href="<?= htmlspecialchars($appBase, ENT_QUOTES, 'UTF-8') ?>/live-band/projector.css">
</head>
<body>

  <div class="blank-indicator" id="blank-ind">⬛ MÀN HÌNH ĐEN (BẤM 'B' ĐỂ MỞ)</div>

  <!-- Header -->
  <header class="projector-header" id="projector-header">
    <div class="projector-title-wrap">
      <span class="projector-plan-badge" id="projector-plan-badge">THỜ PHƯỢNG</span>
      <span class="projector-title" id="projector-header-title">LIVE BAND STUDIO</span>
    </div>
    <div class="projector-header-meta">
      <span class="projector-slide-counter" id="projector-slide-counter"></span>
      <div class="projector-conn-badge" id="projector-conn-badge">
        <span class="conn-dot" id="conn-dot"></span>
        <span id="conn-text">PHÒNG: <?= $roomParam ?: 'CHƯA KẾT NỐI' ?></span>
      </div>
    </div>
  </header>

  <!-- Cue Banner -->
  <div class="projector-cue-banner" id="projector-cue-banner"></div>

  <!-- Viewport -->
  <main class="projector-viewport" id="projector-viewport">
    <div id="projector-content">
      <div class="projector-empty">
        <div>📡 Đang kết nối tới Ca Trưởng...</div>
        <div class="projector-empty-hint">Chạm hai lần (Double Click) để bật Toàn Màn Hình • Phím 'B' để tắt/bật màn hình đen</div>
      </div>
    </div>
  </main>

  <!-- Quick Actions Bar -->
  <nav class="projector-toolbar" id="projector-toolbar" aria-label="Projector controls">
    <button class="tb-btn" id="btn-blank" title="Tắt tạm thời màn hình (Phím B)">⬛ Blank (B)</button>
    <button class="tb-btn" id="btn-prev-slide" title="Slide trước (Mũi tên Trái)">◀</button>
    <button class="tb-btn" id="btn-next-slide" title="Slide sau (Mũi tên Phải)">▶</button>
    <button class="tb-btn" id="btn-font-dec" title="Thu nhỏ chữ (-)">A-</button>
    <button class="tb-btn" id="btn-font-inc" title="Phóng to chữ (+)">A+</button>
    <button class="tb-btn" id="btn-fullscreen" title="Toàn màn hình (F11)">⛶ F11</button>
  </nav>

  <!-- Shared & Modular Scripts with __APP_BASE__ resolution -->
  <script src="<?= htmlspecialchars($appBase, ENT_QUOTES, 'UTF-8') ?>/assets/js/core/SafeHtml.js"></script>
  <script src="<?= htmlspecialchars($appBase, ENT_QUOTES, 'UTF-8') ?>/assets/js/core/ApiService.js"></script>
  <script src="<?= htmlspecialchars($appBase, ENT_QUOTES, 'UTF-8') ?>/assets/js/performance/live-transport.js"></script>
  <script src="<?= htmlspecialchars($appBase, ENT_QUOTES, 'UTF-8') ?>/live-band/js/projector-slides.js"></script>
  <script src="<?= htmlspecialchars($appBase, ENT_QUOTES, 'UTF-8') ?>/live-band/js/projector-app.js"></script>
</body>
</html>
