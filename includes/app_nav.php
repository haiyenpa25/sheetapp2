<?php
/**
 * includes/app_nav.php
 *
 * Shared App Shell Navigation Bar cho toàn bộ hệ thống SheetApp2:
 * Kết nối liền mạch 4 Trụ Cột:
 * 1. 📚 Thư Viện & Đọc Sheet (/)
 * 2. 🎤 Biểu Diễn (/live-band/)
 * 3. 🎹 Tập Luyện (/learn/)
 * 4. 🛠️ Quản Lý (/manager/)
 *
 * Tự động đồng bộ ngữ cảnh bài hát (?song=), trạng thái đăng nhập, và trợ giúp theo ngữ cảnh.
 */

if (session_status() === PHP_SESSION_NONE) {
    @session_start();
}

// Lấy thông tin user hiện tại từ Auth hoặc Session
$currentUser = null;
if (class_exists('Auth') && method_exists('Auth', 'user')) {
    $currentUser = Auth::user();
} elseif (isset($_SESSION['user_id'])) {
    $currentUser = [
        'id'           => (int)$_SESSION['user_id'],
        'username'     => $_SESSION['username'] ?? '',
        'role'         => $_SESSION['role'] ?? 'viewer',
        'display_name' => $_SESSION['display_name'] ?? ($_SESSION['username'] ?? ''),
        'instrument'   => $_SESSION['instrument'] ?? 'guitar',
    ];
} elseif (isset($_SESSION['user']) && is_array($_SESSION['user'])) {
    $currentUser = $_SESSION['user'];
}

$activePillar = $activePillar ?? 'library'; // 'library' | 'live' | 'learn' | 'manager'
$currentSongId = $_GET['song'] ?? '';
$songQuery = !empty($currentSongId) ? ('?song=' . urlencode($currentSongId)) : '';

// Tự động nhận diện Base URL của ứng dụng (hỗ trợ cả root domain và subfolder XAMPP)
if (!isset($appBase)) {
    $scriptDir = str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? ''));
    $subDirs = ['live-band', 'learn', 'manager', 'huong-dan', 'editor', 'members', 'tools', 'api'];
    $currentSub = basename($scriptDir);
    if (in_array($currentSub, $subDirs, true)) {
        $appBase = rtrim(dirname($scriptDir), '/');
    } else {
        $appBase = rtrim($scriptDir, '/');
    }
    if ($appBase === '/' || $appBase === '\\') {
        $appBase = '';
    }
}

// Map link trợ giúp theo ngữ cảnh từng trụ cột
$helpAnchor = match($activePillar) {
    'live'    => '#mod-6', // Chương 06: Live Band Studio & Sân Khấu
    'learn'   => '#mod-7', // Chương 07: Smart Learning & Tập Hát Bè
    'manager' => '#mod-4', // Chương 04: Quản lý thư viện bài hát
    'editor'  => '#mod-8', // Chương 08: Sửa Sheet MusicXML
    default   => '#mod-2'  // Chương 02: Đọc sheet & hợp âm
};
?>
<script>
  if (typeof window !== 'undefined' && typeof window.__APP_BASE__ === 'undefined') {
    window.__APP_BASE__ = <?= json_encode($appBase, JSON_UNESCAPED_SLASHES) ?>;
  }
</script>
<nav id="app-shell-navbar" class="app-shell-navbar" data-active-pillar="<?= htmlspecialchars($activePillar) ?>" aria-label="Thanh điều hướng chính của SheetApp">
  <div class="shell-nav-inner">
    <!-- 1. Logo & Nhãn Thương Hiệu -->
    <a href="<?= $appBase ?>/<?= $songQuery ?>" class="shell-brand" title="SheetApp2 — Nền tảng Ban Hát & Ca Đoàn">
      <span class="shell-brand-icon">🎵</span>
      <span class="shell-brand-name">SheetApp</span>
    </a>

    <!-- 2. Bốn Trụ Cột Cốt Lõi (4-Pillars Navigation) -->
    <div class="shell-pillars" role="tablist">
      <a href="<?= $appBase ?>/<?= $songQuery ?>" 
         class="shell-tab <?= $activePillar === 'library' ? 'active' : '' ?>" 
         data-pillar="library" 
         id="pillar-library" 
         role="tab"
         aria-selected="<?= $activePillar === 'library' ? 'true' : 'false' ?>"
         title="Thư viện 903 bài hát, đọc sheet nhạc, dịch tông & danh sách Setlist">
        <span class="pillar-icon">📚</span>
        <span class="pillar-label">Thư Viện</span>
      </a>

      <a href="<?= $appBase ?>/live-band/<?= $songQuery ?>" 
         class="shell-tab <?= $activePillar === 'live' ? 'active' : '' ?>" 
         data-pillar="live" 
         id="pillar-live" 
         role="tab"
         aria-selected="<?= $activePillar === 'live' ? 'true' : 'false' ?>"
         title="Phòng biểu diễn ban nhạc, đồng bộ trực tiếp Ca Trưởng - Nhạc Công, máy chiếu nhà thờ">
        <span class="pillar-icon">🎤</span>
        <span class="pillar-label">Biểu Diễn</span>
      </a>

      <a href="<?= $appBase ?>/learn/<?= $songQuery ?>" 
         class="shell-tab <?= $activePillar === 'learn' ? 'active' : '' ?>" 
         data-pillar="learn" 
         id="pillar-learn" 
         role="tab"
         aria-selected="<?= $activePillar === 'learn' ? 'true' : 'false' ?>"
         title="Phòng tập thông minh, luyện tập nốt giai điệu, tách bè SATB & đệm hát bàn phím ảo">
        <span class="pillar-icon">🎹</span>
        <span class="pillar-label">Tập Luyện</span>
      </a>

      <a href="<?= $appBase ?>/manager/<?= $songQuery ?>" 
         class="shell-tab <?= $activePillar === 'manager' ? 'active' : '' ?>" 
         data-pillar="manager" 
         id="pillar-manager" 
         role="tab"
         aria-selected="<?= $activePillar === 'manager' ? 'true' : 'false' ?>"
         title="Quản trị kho nhạc, phân quyền thành viên, quản lý bộ hợp âm & chỉnh sửa Visual MusicXML">
        <span class="pillar-icon">🛠️</span>
        <span class="pillar-label">Quản Lý</span>
      </a>
    </div>

    <!-- 3. Khu Vực Tiện Ích: Trợ Giúp & Tài Khoản -->
    <div class="shell-actions">
      <!-- Nút Trợ Giúp Theo Ngữ Cảnh (Context Help) -->
      <a href="<?= $appBase ?>/huong-dan/<?= $helpAnchor ?>" 
         id="shell-context-help-btn" 
         class="shell-help-btn" 
         title="Xem hướng dẫn sử dụng tính năng cho mục này" 
         target="_blank" 
         rel="noopener">
        <span class="help-icon">❓</span>
        <span class="help-text">Trợ Giúp</span>
      </a>

      <!-- Widget Thông Báo Trong Ứng Dụng (In-App Notification Center) -->
      <?php if ($currentUser): ?>
      <div id="shell-notif-widget" class="shell-notif-widget">
        <button id="shell-notif-btn" class="shell-notif-btn" title="Thông báo" aria-label="Thông báo" aria-haspopup="true" aria-expanded="false">
          <span class="notif-icon">🔔</span>
          <span id="shell-notif-badge" class="shell-notif-badge hidden">0</span>
        </button>
        <div id="shell-notif-dropdown" class="shell-notif-dropdown hidden" role="menu">
          <div class="shell-notif-header">
            <span class="shell-notif-title">Thông báo</span>
            <button id="shell-notif-mark-all" class="shell-notif-action-btn" type="button">Đọc tất cả</button>
          </div>
          <div id="shell-notif-list" class="shell-notif-list">
            <div class="shell-notif-empty">Không có thông báo mới</div>
          </div>
        </div>
      </div>
      <?php endif; ?>

      <!-- Widget Tài Khoản & Đăng Nhập -->
      <div id="shell-user-widget" class="shell-user-widget">
        <?php if ($currentUser): 
          $uName = $currentUser['display_name'] ?? $currentUser['username'] ?? 'User';
          $uRole = $currentUser['role'] ?? 'viewer';
          $initial = mb_strtoupper(mb_substr($uName, 0, 1, 'UTF-8'), 'UTF-8');
          $roleLabel = match($uRole) {
            'admin'  => '🛡️ Quản trị',
            'leader' => '👑 Ca trưởng',
            'banhat' => '🎸 Ban hát',
            default  => '👁️ Thành viên'
          };
        ?>
          <div class="shell-user-pill" id="shell-user-menu-btn" title="Tài khoản @<?= htmlspecialchars($currentUser['username'] ?? '') ?>">
            <span class="shell-avatar"><?= htmlspecialchars($initial) ?></span>
            <span class="shell-user-name"><?= htmlspecialchars($uName) ?></span>
            <span class="shell-role-badge role-<?= htmlspecialchars($uRole) ?>"><?= htmlspecialchars($roleLabel) ?></span>
            <button id="shell-btn-logout" class="shell-logout-btn" title="Đăng xuất khỏi hệ thống">⏻</button>
          </div>
        <?php else: ?>
          <button id="shell-btn-login" class="shell-login-btn" title="Đăng nhập vào tài khoản">
            <span class="login-icon">👤</span>
            <span class="login-text">Đăng Nhập</span>
          </button>
        <?php endif; ?>
      </div>
    </div>
  </div>
</nav>
