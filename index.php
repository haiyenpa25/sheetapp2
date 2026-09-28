<?php
// index.php — Smart Sheet Music WebApp
if (session_status() === PHP_SESSION_NONE) {
    @session_start();
}
$appAssetVersion = filemtime(__FILE__);
$appBase = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '')), '/');
if ($appBase === '/' || $appBase === '\\') $appBase = '';
$baseHref = ($appBase ? $appBase : '') . '/';
?>
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <base href="<?= htmlspecialchars($baseHref, ENT_QUOTES) ?>">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <!-- iOS: cho phép Web Audio API hoạt động đúng -->
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="default">
  <meta name="mobile-web-app-capable" content="yes">
  <title>SheetApp — Nhạc Thánh Ca Tương Tác</title>
  <meta name="description" content="Ứng dụng xem, dịch giọng và ghi chép nhạc thánh ca tương tác. Hỗ trợ MusicXML, transpose và nhật ký biểu diễn.">
  <!-- PWA / Add to Homescreen -->
  <link rel="manifest" href="<?= $baseHref ?>manifest.json">
  <meta name="theme-color" content="#6d28d9">
  <!-- iOS PWA icons -->
  <meta name="apple-mobile-web-app-title" content="SheetApp">
  <link rel="apple-touch-icon" href="<?= $baseHref ?>assets/img/icon-192.png">
  <script>if (typeof window !== 'undefined' && typeof window.__APP_BASE__ === 'undefined') { window.__APP_BASE__ = <?= json_encode($appBase, JSON_UNESCAPED_SLASHES) ?>; } window.__ASSET_V__ = '<?= $appAssetVersion ?>';</script>

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <!-- Chỉ load 2 weights cần thiết, display=swap để không block render -->
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap" rel="stylesheet">
  <!-- DNS prefetch cho CDN fallback (không block) -->
  <link rel="dns-prefetch" href="https://cdn.jsdelivr.net">
  <link rel="dns-prefetch" href="https://cdnjs.cloudflare.com">

<?php
function cssTag(string $file): string {
    global $baseHref;
    $path = __DIR__ . '/assets/css/' . $file;
    $v    = file_exists($path) ? filemtime($path) : time();
    return "  <link rel=\"stylesheet\" href=\"{$baseHref}assets/css/{$file}?v={$v}\">\n";
}
echo cssTag('base.css');
echo cssTag('layout.css');
echo cssTag('sheet.css');
echo cssTag('components.css');
echo cssTag('fab.css');
echo cssTag('app-shell.css');

?>
  <!-- ── Thư viện âm thanh và OSMD (local vendor, fallback CDN) ── -->
  <script>
    // Load script với fallback: thử local trước, nếu fail mới dùng CDN
    function _loadScript(localSrc, cdnSrc, globalCheck) {
      return new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = localSrc;
        s.onload = resolve;
        s.onerror = () => {
          // Fallback to CDN
          const s2 = document.createElement('script');
          s2.src = cdnSrc;
          s2.onload = resolve;
          s2.onerror = reject;
          document.head.appendChild(s2);
        };
        document.head.appendChild(s);
      });
    }
  </script>
  <!-- Tone.js — defer: không cần thiết cho render ban đầu -->
  <script src="<?= $baseHref ?>assets/js/vendor/Tone.js" defer onerror="
    var s=document.createElement('script');
    s.src='https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.49/Tone.js';
    document.head.appendChild(s);"></script>
  <!-- OSMD Audio Player — defer -->
  <script src="<?= $baseHref ?>assets/js/vendor/OsmdAudioPlayer.min.js" defer onerror="
    var s=document.createElement('script');
    s.src='https://cdn.jsdelivr.net/npm/osmd-audio-player/umd/OsmdAudioPlayer.min.js';
    document.head.appendChild(s);"></script>
  <!-- Tonal.js — defer -->
  <script src="<?= $baseHref ?>assets/js/vendor/tonal.min.js" defer onerror="
    var s=document.createElement('script');
    s.src='https://cdn.jsdelivr.net/npm/tonal/browser/tonal.min.js';
    document.head.appendChild(s);"></script>
</head>
<body>

<!-- Skip Navigation Links cho điều hướng bàn phím A11y (Ticket L1-11) -->
<nav class="skip-links" aria-label="Điều hướng nhanh">
  <a href="#unified-toolbar" class="skip-link">Nhảy tới thanh công cụ</a>
  <a href="#sheet-viewer-wrapper" class="skip-link">Nhảy tới bản nhạc</a>
  <a href="#sidebar" class="skip-link">Nhảy tới danh sách bài hát</a>
</nav>

<!-- ===== MAIN CONTENT (Thanh công cụ & Bản nhạc focus trước Sidebar) ===== -->
<main id="main" class="main-content">
  <?php $activePillar = 'library'; require_once __DIR__ . '/includes/app_nav.php'; ?>
  <?php require_once __DIR__ . '/includes/toolbar.php'; ?>
  <?php require_once __DIR__ . '/includes/sheet_viewer.php'; ?>
</main>

<?php require_once __DIR__ . '/includes/sidebar.php'; ?>
<div id="sidebar-overlay" class="sidebar-overlay hidden"></div>

<?php require_once __DIR__ . '/includes/modals.php'; ?>
<?php require_once __DIR__ . '/includes/quick_numpad_modal.php'; ?>
<?php require_once __DIR__ . '/includes/follow_leader_modal.php'; ?>
<?php require_once __DIR__ . '/includes/admin_console.php'; ?>
<?php require_once __DIR__ . '/includes/setlist_program_bar.php'; ?>

<!-- ===== METRONOME MINI-BAR GẮN ĐÁY (Ticket L1-10) ===== -->
<div id="metronome-panel" class="metronome-mini-bar hidden" role="region" aria-label="Bộ giữ nhịp Metronome">
  <div class="mm-inner">
    <!-- Cụm 1: Nút Play/Stop + Icon ♩ -->
    <div class="mm-section mm-playback">
      <button id="btn-metronome-toggle-play" class="btn-mm-play" title="Bật/Dừng máy gõ nhịp (Space)">
        <span class="mm-play-icon">▶</span>
        <span class="mm-play-text">Nhịp</span>
      </button>
      <span class="mm-note-icon" title="Metronome">♩</span>
    </div>

    <!-- Cụm 2: Visual Beat Flasher (Đèn nháy báo phách) -->
    <div class="mm-section mm-beats-section">
      <div class="metronome-beats" id="metronome-beats-container" title="Đèn nháy báo phách nhịp">
        <!-- Tạo động bằng JS -->
      </div>
    </div>

    <!-- Cụm 3: Điều khiển BPM ([-], Số BPM, [+], TAP) -->
    <div class="mm-section mm-tempo-section">
      <button id="btn-metronome-dec" class="btn-mm-ctrl" title="Giảm 1 BPM">−</button>
      <div class="mm-tempo-display" title="Nhấp hoặc đổi BPM">
        <span id="metronome-bpm-val" class="mm-bpm-value">80</span>
        <span class="mm-bpm-unit">BPM</span>
      </div>
      <button id="btn-metronome-inc" class="btn-mm-ctrl" title="Tăng 1 BPM">+</button>
      <button id="btn-metronome-tap" class="btn-mm-tap" title="Gõ liên tục để tính BPM (TAP)">TAP</button>
    </div>

    <!-- Cụm 4: Bộ chọn nhịp (4/4, 3/4, 2/4, 6/8) & Count-in -->
    <div class="mm-section mm-meter-section">
      <select id="metronome-beats-select" class="mm-select" title="Số phách và kiểu nhịp" aria-label="Số phách và kiểu nhịp">
        <option value="4" selected>4/4 (Nhịp 4)</option>
        <option value="3">3/4 (Nhịp 3)</option>
        <option value="2">2/4 (Nhịp 2)</option>
        <option value="6-dotted">6/8 (2 phách chấm)</option>
        <option value="6">6/8 (6 phách, nhấn 1 & 4)</option>
      </select>
      <button id="btn-metronome-count-in" class="btn-mm-countin" title="Đếm nhịp chuẩn bị vào bài (1-2-3-4)">
        ⏱️ Count-in
      </button>
    </div>

    <!-- Cụm 5: Tuỳ chọn âm thanh & Nút Đóng -->
    <div class="mm-section mm-opts-section">
      <select id="metronome-sound-select" class="mm-select mm-select-sound" title="Loại âm thanh">
        <option value="woodblock" selected>Mõ gỗ</option>
        <option value="cowbell">Chuông bò</option>
        <option value="beep">Bíp</option>
      </select>
      <button id="btn-close-metronome" class="btn-mm-close" title="Ẩn thanh Metronome" aria-label="Đóng">&times;</button>
    </div>
  </div>
</div>


<!-- Nút thoát Sheet-Only Mode (fixed, luôn ở góc trên phải) -->
<button id="btn-exit-sheet-only" title="Thoát chế độ toàn màn hình (Esc)" aria-label="Thoát">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
</button>


<!-- ===== SCRIPTS ===== -->
<!-- OSMD from local vendor (fallback CDN) -->
<script src="<?= $baseHref ?>assets/js/vendor/opensheetmusicdisplay.min.js" onerror="
  var s=document.createElement('script');
  s.src='https://cdn.jsdelivr.net/npm/opensheetmusicdisplay@1.8.6/build/opensheetmusicdisplay.min.js';
  document.head.appendChild(s);"></script>

<?php
if (!function_exists('jsTag')) {
    function jsTag(string $file, bool $defer = true): string {
        global $baseHref;
        $path = __DIR__ . '/assets/js/' . $file;
        $v    = file_exists($path) ? filemtime($path) : time();
        $d    = $defer ? ' defer' : '';
        return "<script src=\"{$baseHref}assets/js/{$file}?v={$v}\"{$d}></script>\n";
    }
}

// ── 1. CORE Infrastructure (không defer — cần sớm nhất) ──
require_once __DIR__ . '/api/core/Config.php';
require_once __DIR__ . '/api/core/FeatureFlags.php';
echo "<script>
  window.SHEETAPP_CACHE_VERSION = " . json_encode(Config::SHEETAPP_CACHE_VERSION) . ";
  window.__SW_CACHE__ = " . json_encode(Config::SHEETAPP_CACHE_NAME) . ";
  window.__FEATURES__ = " . json_encode(FeatureFlags::all(), JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_HEX_AMP) . ";
</script>\n";
echo jsTag('core/FeatureFlags.js', false);
echo jsTag('core/SafeHtml.js',     false);
echo jsTag('core/KeyService.js',   false);
echo jsTag('core/ApiService.js',   false);
echo jsTag('core/EventBus.js',     false);
echo jsTag('core/Store.js',        false);
echo jsTag('core/AppShell.js',     false);
echo jsTag('core/ModalManager.js', false);
echo jsTag('core/ModeManager.js',  false);
echo jsTag('core/VerseManager.js', false);
echo jsTag('core/TapTempo.js',     false);
echo jsTag('core/AudioUnlocker.js',false);
echo jsTag('core/MidiEngine.js',   false);
echo jsTag('core/SongLoaderCore.js', false);
echo jsTag('core/ErrorReporter.js', false);
echo jsTag('core/ServiceWorkerManager.js', false);
echo jsTag('core/OfflineSetlistManager.js', false);

// ── 2. Renderers & Engines (defer OK) ──
echo jsTag('osmd-renderer.js');
echo jsTag('lyric-extractor.js');
echo jsTag('transpose-engine.js');
echo jsTag('key-service.js');
echo jsTag('session-tracker.js');
echo jsTag('auth.js');
echo jsTag('history-manager.js');
echo jsTag('url-state.js');

// ── 3. Feature Modules (defer) ──
echo jsTag('modals/HelpModal.js');
echo jsTag('modals/TransposePickerModal.js');
echo jsTag('modals/TempoPickerSheet.js');
echo jsTag('modals/ServicePlanAssignModal.js');
echo jsTag('modals/PracticeTeamBoardModal.js');
echo jsTag('library-ui.js');
echo jsTag('modals/QuickNumpadModal.js');
echo jsTag('service-plan-ui.js');
echo jsTag('leader-notes-banner.js');
echo jsTag('liturgy-card.js');
echo jsTag('setlist-player.js');
echo jsTag('setlist-list.js');
echo jsTag('setlist-detail.js');
echo jsTag('setlist-ui.js');
echo jsTag('importer.js');
echo jsTag('admin-ui.js');
echo jsTag('display-settings.js');
echo jsTag('stage-lens.js');
echo jsTag('guitar-lens.js');
echo jsTag('bass-lens.js');
echo jsTag('drums-lens.js');
echo jsTag('vocals-lens.js');
echo jsTag('chord-canvas-xml.js');
echo jsTag('chord-canvas-ui.js');
echo jsTag('chord-canvas-transpose.js');
echo jsTag('chord-canvas-dots.js');
echo jsTag('chord-canvas-edit.js');
echo jsTag('chord-canvas.js');
echo jsTag('annotation-canvas.js');
echo jsTag('performance-notes.js');
echo jsTag('instruments.js');
echo jsTag('audio-player.js');
echo jsTag('metronome.js');
echo jsTag('auto-scroller.js');
echo jsTag('page-nav.js');
echo jsTag('app-ui.js');
echo jsTag('song-info-bar.js');

// ── 4. Performance Engine & Live Sync V2 (Lazy loaded on-demand khi bật Live Sync / Performance Mode) ──
echo jsTag('live-sync.js');
echo jsTag('follow-leader.js');

// ── 5. App Controllers (defer, phụ thuộc vào modules trên) ──
echo jsTag('song-preloader.js');
echo jsTag('song-loader.js');
echo jsTag('keyboard-handler.js');
echo jsTag('toolbar-controller.js');
echo jsTag('mobile-controller.js');
echo jsTag('app.js');
echo jsTag('fab.js');
?>


</body>
</html>
