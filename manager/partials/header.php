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

    <!-- Live Global Search with Instant Dropdown Autocomplete -->
    <div class="mgr-search-box">
      <span class="mgr-search-icon">🔍</span>
      <input type="text" id="mgr-global-search" placeholder="Gõ tìm bài hát (#001, tựa đề, lời...), bấm chọn bài..." autocomplete="off">
      <kbd class="mgr-kbd">Ctrl+K</kbd>
      <button id="mgr-search-clear" class="mgr-btn-clear hidden" title="Xóa tìm kiếm">✕</button>
      
      <!-- Autocomplete Dropdown List -->
      <div id="mgr-search-dropdown" class="mgr-search-dropdown hidden"></div>
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
            <button class="mgr-btn mgr-btn-ghost mgr-btn-xs" id="btn-open-profile" title="Quản lý hồ sơ & đổi mật khẩu">
              ⚙️ Hồ Sơ
            </button>
            <button class="mgr-btn-logout" id="mgr-btn-logout" title="Đăng xuất">⏻</button>
          </div>
        <?php else: ?>
          <div style="display: flex; gap: 0.5rem;">
            <button id="mgr-btn-register-modal" class="mgr-btn mgr-btn-primary mgr-btn-sm">
              <span>✨</span> Đăng Ký
            </button>
            <button id="mgr-btn-login-modal" class="mgr-btn mgr-btn-ghost mgr-btn-sm">
              <span>🔐</span> Đăng Nhập
            </button>
          </div>
        <?php endif; ?>
      </div>
    </div>
  </header>
