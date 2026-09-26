<?php
/**
 * live-band/index.php — SheetApp Live Band Studio
 * 
 * Standalone Live Performance & Rehearsal Command Center
 * Route: https://sheet.hyb.io.vn/live-band/
 */
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
require_once __DIR__ . '/../api/core/Auth.php';
$currentUser = Auth::username() ?: 'Ca Trưởng';

$scriptDir = str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? ''));
$appBase = rtrim(dirname($scriptDir), '/');
if ($appBase === '/' || $appBase === '\\') $appBase = '';

// Cache-bust helpers
function liveBandJsTag(string $file, bool $defer = true): string {
    global $appBase;
    $path = __DIR__ . '/../' . $file;
    $v    = file_exists($path) ? filemtime($path) : time();
    $d    = $defer ? ' defer' : '';
    $prefix = $appBase ? ($appBase . '/') : '/';
    return "<script src=\"{$prefix}{$file}?v={$v}\"{$d}></script>\n";
}
function liveBandCssTag(string $file): string {
    global $appBase;
    $path = file_exists(__DIR__ . '/../assets/css/' . $file)
        ? __DIR__ . '/../assets/css/' . $file
        : __DIR__ . '/' . $file;
    $v = file_exists($path) ? filemtime($path) : time();
    $prefix = $appBase ? ($appBase . '/') : '/';
    if (file_exists(__DIR__ . '/../assets/css/' . $file)) {
        return "<link rel=\"stylesheet\" href=\"{$prefix}assets/css/{$file}?v={$v}\">\n";
    }
    return "<link rel=\"stylesheet\" href=\"{$prefix}live-band/{$file}?v={$v}\">\n";
}
?>
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <script>if (typeof window !== 'undefined' && typeof window.__APP_BASE__ === 'undefined') { window.__APP_BASE__ = <?= json_encode($appBase, JSON_UNESCAPED_SLASHES) ?>; }</script>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="mobile-web-app-capable" content="yes">
  <title>Live Band Studio — SheetApp Biểu Diễn Trực Tiếp</title>
  <meta name="description" content="Hệ thống đồng bộ biểu diễn trực tiếp cho Ca Trưởng, Ban Nhạc và Ca Đoàn. Chuyển bài tức thì, dịch giọng toàn ban, nhảy phân đoạn và đếm nhịp chuẩn bị.">

  <!-- PWA -->
  <link rel="manifest" href="<?= $appBase ?>/manifest.json">
  <meta name="theme-color" content="#0a0a14">
  <link rel="apple-touch-icon" href="<?= $appBase ?>/assets/img/icon-192.png">
  <link rel="icon" href="<?= $appBase ?>/favicon.ico">

  <!-- Google Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Fira+Code:wght@500;600;700&display=swap" rel="stylesheet">

  <!-- Base & Live Band Styles -->
  <?php echo liveBandCssTag('base.css'); ?>
  <link rel="stylesheet" href="<?= $appBase ?>/assets/css/app-shell.css">
  <link rel="stylesheet" href="<?= $appBase ?>/live-band/live-band.css?v=<?php echo file_exists(__DIR__.'/live-band.css') ? filemtime(__DIR__.'/live-band.css') : time(); ?>">

  <!-- Preload OSMD -->
  <link rel="preload" href="<?= $appBase ?>/assets/js/vendor/opensheetmusicdisplay.min.js" as="script">
</head>
<body class="stage-dark">
<?php $activePillar = 'live'; require_once __DIR__ . '/../includes/app_nav.php'; ?>

<div id="live-band-app" class="live-band-layout" data-mode="off" data-role="viewer">

  <!-- ══════════════ 1. STAGE TOP NAVBAR ══════════════ -->
  <header class="stage-navbar">
    <div class="nav-left">
      <a href="/" class="stage-brand" title="Về trang chủ SheetApp">
        <span class="stage-brand-icon">📡</span>
        <span class="stage-brand-text">LIVE BAND</span>
      </a>

      <!-- Room Badge / Trigger Modal -->
      <button id="btn-stage-room-badge" class="stage-pill-badge room-badge disconnected" title="Bấm để xem mã phòng hoặc mở phòng mới">
        <span class="pulse-indicator"></span>
        <span id="nav-room-label">CHƯA VÀO PHÒNG</span>
      </button>

      <!-- Role Selector Pill -->
      <div class="stage-pill-badge role-pill" title="Đổi vai trò nhạc cụ trên sân khấu">
        <span id="role-pill-icon">🎸</span>
        <select id="stage-role-select" class="nav-role-dropdown" aria-label="Vai trò biểu diễn">
          <option value="leader">👑 Trưởng Ban / Band Leader</option>
          <option value="guitar" selected>🎸 Guitar (Hợp âm & Capo)</option>
          <option value="bass">🎸 Bass (Root & Slash Notes)</option>
          <option value="piano">🎹 Keyboard / Piano (Hợp âm & Dẫn)</option>
          <option value="drummer">🥁 Trống / Drums (Visual Metronome)</option>
          <option value="viewer">👀 Nhạc công / Thành viên</option>
          <option value="vocal">🎤 Vocal / Ca Sĩ</option>
        </select>
      </div>
    </div>

    <!-- Active Song Information -->
    <div class="nav-center">
      <div class="stage-song-pill" id="stage-song-pill">
        <span class="song-status-dot"></span>
        <span id="nav-song-title" class="nav-song-title">Đang chờ Ca Trưởng chọn bài...</span>
        <span id="nav-song-set" class="nav-key-badge" style="background:rgba(124,58,237,0.2);color:#c4b5fd;border:1px solid rgba(124,58,237,0.4);" title="Bộ hợp âm biểu diễn">Bộ: HD</span>
        <span id="nav-song-key" class="nav-key-badge" title="Tông đang chơi">Tông: C</span>
        <span id="nav-song-bpm" class="nav-bpm-badge" title="Tốc độ nhịp">80 BPM</span>
      </div>
    </div>

    <div class="nav-right">
      <!-- Ambient Pad Pill -->
      <button id="btn-stage-pad" class="stage-pill-badge pad-pill" title="Đệm nền Ambient Pad vô tận (Worship Drone)">
        <span class="pad-wave-icon">🎹</span>
        <span id="nav-pad-label">Pad: Tắt</span>
      </button>

      <!-- Countdown Timer Pill -->
      <button id="btn-stage-timer" class="stage-pill-badge timer-pill" title="Đồng hồ đếm ngược giờ lễ (Chạm để cài đặt)">
        <span>⏱️</span>
        <span id="nav-timer-label">00:00</span>
      </button>

      <!-- Member Roster Pill -->
      <button id="btn-stage-roster" class="stage-pill-badge roster-pill" title="Thành viên đang online trong phòng">
        <span>👥</span>
        <span id="nav-roster-count">1</span>
      </button>

      <!-- Screen WakeLock Pill -->
      <button id="btn-stage-wakelock" class="stage-pill-badge wakelock-pill active" title="Màn hình luôn sáng chống tắt (WakeLock)">
        <span class="wakelock-icon">💡</span>
        <span class="wakelock-text">Sáng</span>
      </button>

      <!-- Projector External View Button -->
      <button id="btn-stage-projector" class="stage-icon-btn" title="Mở Màn Hình Máy Chiếu Lời Ca (Projector View)">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
      </button>

      <!-- Stage Audio & Hardware Settings Button -->
      <button id="btn-stage-audio-settings" class="stage-icon-btn" title="Cài đặt Âm Thanh Sân Khấu (In-Ear Split, Pad, Bàn Đạp Chân)">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
      </button>

      <!-- Fullscreen Button -->
      <button id="btn-stage-fullscreen" class="stage-icon-btn" title="Toàn màn hình sân khấu">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
      </button>

      <!-- Main Room Control Modal Button -->
      <button id="btn-open-room-modal" class="btn btn-primary btn-sm stage-action-btn" title="Mở phòng hoặc chia sẻ mã QR">
        📡 Phòng Live
      </button>
    </div>
  </header>

  <!-- ══════════════ 1.5. BAND LIVE SYNC & TEMPO PULSER STRIP ══════════════ -->
  <div id="band-sync-strip" class="band-sync-strip">
    <!-- Left: Master Visual Beat Pulser -->
    <div class="band-tempo-sync-box">
      <div class="sync-box-label">GIỮ NHỊP:</div>
      <div class="band-beat-pulser" id="stage-beat-pulser">
        <div class="pulse-led" data-beat="1"><span class="led-num">1</span></div>
        <div class="pulse-led" data-beat="2"><span class="led-num">2</span></div>
        <div class="pulse-led" data-beat="3"><span class="led-num">3</span></div>
        <div class="pulse-led" data-beat="4"><span class="led-num">4</span></div>
      </div>
      <span id="band-tempo-bpm" class="band-bpm-badge">80 BPM</span>
      <button id="btn-tap-tempo" class="btn-tap-tempo" title="Chạm nhịp ngón tay 3-4 lần để bắt Tempo bài hát">👆 TAP TEMPO</button>
      <button id="btn-toggle-metronome-audio" class="btn-click-audio" title="Bật/Tắt tiếng click nhịp cho tai nghe">🔊 Click: Bật</button>
    </div>

    <!-- Center: Active Dynamic Energy State Badge -->
    <div class="band-state-center">
      <div class="band-current-state-pill" id="band-current-state-pill">
        <span class="state-dot"></span>
        <span class="state-title-prefix">TRẠNG THÁI:</span>
        <span id="band-state-text" class="state-text">CHƠI BÌNH THƯỜNG</span>
      </div>
    </div>

    <!-- Right: Fast Dynamic Energy State Buttons (1-Touch) -->
    <div class="band-dynamic-actions" id="band-dynamic-actions">
      <button class="btn-band-state state-break" data-state="break" title="🛑 BREAK: Toàn ban ngắt nốt cùng lúc phách 1">🛑 BREAK</button>
      <button class="btn-band-state state-build" data-state="build" title="🌊 BUILD-UP: Dồn nhịp, tăng dần volume">🌊 BUILD-UP</button>
      <button class="btn-band-state state-drop" data-state="drop" title="🤫 DROP / ĐỆM ÊM: Chỉ 1 nhạc cụ đệm, hạ nhỏ">🤫 ĐỆM ÊM</button>
      <button class="btn-band-state state-drive" data-state="drive" title="🔥 FULL DRIVE: Quạt mạnh, cao trào, full ban">🔥 CAO TRÀO</button>
      <button class="btn-band-state state-solo" data-state="solo" title="🎸 SOLO TIME: Nhường đất diễn cho solo">🎸 SOLO</button>
      <button class="btn-band-state state-end" data-state="end" title="🏁 DỨT / KẾT: Kết thúc dứt khoát">🏁 DỨT KẾT</button>
    </div>

    <!-- Secondary Row: Section Transition & 2-Bar Heads-Up Warning Bar -->
    <div class="band-section-sync-substrip">
      <div class="substrip-left">
        <span class="substrip-label">CHUYỂN KHÚC:</span>
        <div class="section-quick-cues" id="band-section-quick-cues">
          <button class="btn-quick-cue" data-section="Intro" title="Báo vào khúc Mở đầu (Intro)">⚡ Intro</button>
          <button class="btn-quick-cue" data-section="Lời (Verse)" title="Báo vào Lời (Verse)">⚡ Verse</button>
          <button class="btn-quick-cue highlight-chorus" data-section="Điệp Khúc" title="Báo vào Điệp Khúc (Chorus)">⚡ Điệp Khúc</button>
          <button class="btn-quick-cue" data-section="Giang Tấu / Solo" title="Báo vào Giang Tấu / Solo">⚡ Solo</button>
          <button class="btn-quick-cue" data-section="Bridge" title="Báo vào Bridge">⚡ Bridge</button>
          <button class="btn-quick-cue highlight-outro" data-section="Kết (Outro)" title="Báo vào Kết bài">⚡ Outro</button>
        </div>
      </div>
      <div class="substrip-right">
        <button id="btn-cue-2bars-warning" class="btn-cue-2bars" title="Phát lệnh cảnh báo toàn ban: CHUẨN BỊ CHUYỂN KHÚC SAU 2 Ô NHỊP">
          ⚠️ BÁO TRƯỚC 2 Ô NHỊP
        </button>
      </div>
    </div>
  </div>

<?php require_once __DIR__ . '/partials/console.php'; ?>
<?php require_once __DIR__ . '/partials/hud.php'; ?>
<?php require_once __DIR__ . '/partials/canvas.php'; ?>
<?php require_once __DIR__ . '/partials/modals.php'; ?>

</div><!-- /#live-band-app -->

<!-- ══════════════ VENDORS & DEPENDENCIES ══════════════ -->
<script src="<?= $appBase ?>/assets/js/vendor/opensheetmusicdisplay.min.js" onerror="
  var s=document.createElement('script');
  s.src='https://cdn.jsdelivr.net/npm/opensheetmusicdisplay@1.8.6/build/opensheetmusicdisplay.min.js';
  document.head.appendChild(s);"></script>

<script src="<?= $appBase ?>/assets/js/vendor/Tone.js" defer onerror="
  var s=document.createElement('script');
  s.src='https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.49/Tone.js';
  document.head.appendChild(s);"></script>

<script src="<?= $appBase ?>/assets/js/vendor/tonal.min.js" defer onerror="
  var s=document.createElement('script');
  s.src='https://cdn.jsdelivr.net/npm/tonal/browser/tonal.min.js';
  document.head.appendChild(s);"></script>

<!-- Core Application Shared Infrastructure -->
<?php
require_once __DIR__ . '/../api/core/Config.php';
require_once __DIR__ . '/../api/core/FeatureFlags.php';
?>
<script>
  window.SHEETAPP_CACHE_VERSION = <?= json_encode(Config::SHEETAPP_CACHE_VERSION) ?>;
  window.__SW_CACHE__ = <?= json_encode(Config::SHEETAPP_CACHE_NAME) ?>;
  window.__FEATURES__ = <?= json_encode(FeatureFlags::all(), JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_HEX_AMP) ?>;
</script>
<?php
echo liveBandJsTag('assets/js/core/FeatureFlags.js', false);
echo liveBandJsTag('assets/js/core/AppShell.js', false);
echo liveBandJsTag('assets/js/core/ModalManager.js', false);
echo liveBandJsTag('assets/js/core/TapTempo.js', false);
echo liveBandJsTag('assets/js/core/AudioUnlocker.js', false);
echo liveBandJsTag('assets/js/core/MidiEngine.js', false);
echo liveBandJsTag('assets/js/core/SongLoaderCore.js', false);
echo liveBandJsTag('assets/js/core/EventBus.js', false);
echo liveBandJsTag('assets/js/core/Store.js', false);
echo liveBandJsTag('assets/js/core/SafeHtml.js', false);
echo liveBandJsTag('assets/js/core/ApiService.js', false);
echo liveBandJsTag('assets/js/core/ErrorReporter.js', false);
echo liveBandJsTag('assets/js/chord-canvas-xml.js', false);
echo liveBandJsTag('assets/js/performance/qr-helper.js', true);
echo liveBandJsTag('assets/js/performance/transport-clock.js', true);
echo liveBandJsTag('assets/js/performance/live-transport.js', true);
echo liveBandJsTag('assets/js/performance/musical-position.js', true);
echo liveBandJsTag('assets/js/transpose-engine.js', true);
echo liveBandJsTag('assets/js/lyric-extractor.js', true);
echo liveBandJsTag('assets/js/performance/cue-engine.js', true);
echo liveBandJsTag('assets/js/performance/count-in-engine.js', true);
echo liveBandJsTag('assets/js/performance/arrangement-engine.js', true);
echo liveBandJsTag('assets/js/performance/ambient-pad-engine.js', true);
echo liveBandJsTag('assets/js/performance/pedal-midi-engine.js', true);
echo liveBandJsTag('assets/js/performance/stage-ink-engine.js', true);
echo liveBandJsTag('live-band/js/stage-room.js', true);
echo liveBandJsTag('live-band/js/stage-timer.js', true);
echo liveBandJsTag('live-band/js/stage-audio.js', true);
echo liveBandJsTag('live-band/js/stage-rehearsal.js', true);
echo liveBandJsTag('live-band/js/stage-hud.js', true);
echo liveBandJsTag('live-band/js/stage-catalog.js', true);
echo liveBandJsTag('live-band/live-band.js', true);
?>

</body>
</html>
