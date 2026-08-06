<?php
// index.php — Smart Sheet Music WebApp
?>
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <!-- iOS: cho phép Web Audio API hoạt động đúng -->
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="default">
  <meta name="mobile-web-app-capable" content="yes">
  <title>SheetApp — Nhạc Thánh Ca Tương Tác</title>
  <meta name="description" content="Ứng dụng xem, dịch giọng và ghi chép nhạc thánh ca tương tác. Hỗ trợ MusicXML, transpose và nhật ký biểu diễn.">
  <!-- PWA / Add to Homescreen -->
  <link rel="manifest" href="/manifest.json">
  <meta name="theme-color" content="#6d28d9">
  <!-- iOS PWA icons -->
  <meta name="apple-mobile-web-app-title" content="SheetApp">
  <link rel="apple-touch-icon" href="/assets/img/icon-192.png">

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <!-- Chỉ load 2 weights cần thiết, display=swap để không block render -->
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap" rel="stylesheet">
  <!-- DNS prefetch cho CDN fallback (không block) -->
  <link rel="dns-prefetch" href="https://cdn.jsdelivr.net">
  <link rel="dns-prefetch" href="https://cdnjs.cloudflare.com">
  <!-- Preload OSMD (file lớn nhất, cần sớm nhất) -->
  <link rel="preload" href="assets/js/vendor/opensheetmusicdisplay.min.js" as="script">
<?php
function cssTag(string $file): string {
    $path = __DIR__ . '/assets/css/' . $file;
    $v    = file_exists($path) ? filemtime($path) : time();
    return "  <link rel=\"stylesheet\" href=\"assets/css/{$file}?v={$v}\">\n";
}
echo cssTag('base.css');
echo cssTag('layout.css');
echo cssTag('sheet.css');
echo cssTag('components.css');
echo cssTag('fab.css');

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
  <script src="assets/js/vendor/Tone.js" defer onerror="
    var s=document.createElement('script');
    s.src='https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.49/Tone.js';
    document.head.appendChild(s);"></script>
  <!-- OSMD Audio Player — defer -->
  <script src="assets/js/vendor/OsmdAudioPlayer.min.js" defer onerror="
    var s=document.createElement('script');
    s.src='https://cdn.jsdelivr.net/npm/osmd-audio-player/umd/OsmdAudioPlayer.min.js';
    document.head.appendChild(s);"></script>
  <!-- Tonal.js — defer -->
  <script src="assets/js/vendor/tonal.min.js" defer onerror="
    var s=document.createElement('script');
    s.src='https://cdn.jsdelivr.net/npm/tonal/browser/tonal.min.js';
    document.head.appendChild(s);"></script>
</head>
<body>

<?php require_once __DIR__ . '/includes/sidebar.php'; ?>
<div id="sidebar-overlay" class="sidebar-overlay hidden"></div>

<!-- ===== MAIN CONTENT ===== -->
<main id="main" class="main-content">
  <?php require_once __DIR__ . '/includes/toolbar.php'; ?>
  <?php require_once __DIR__ . '/includes/sheet_viewer.php'; ?>
</main>

<?php require_once __DIR__ . '/includes/modals.php'; ?>
<?php require_once __DIR__ . '/includes/admin_console.php'; ?>

<!-- ===== FLOATING METRONOME PANEL (Máy Giữ Nhịp & Tạo Tempo) ===== -->
<div id="metronome-panel" class="metronome-panel hidden">
  <div class="metronome-header">
    <div class="metronome-header-left">
      <span class="metronome-icon-pulse">⚡</span>
      <span class="metronome-title">Giữ Nhịp (Tempo)</span>
    </div>
    <button id="btn-close-metronome" class="metronome-close-btn" title="Ẩn bộ giữ nhịp">&times;</button>
  </div>
  
  <div class="metronome-body">
    <!-- Visual Beat LED Flasher -->
    <div class="metronome-beats" id="metronome-beats-container" title="Đèn nháy báo phách nhịp">
      <!-- Sẽ được tạo động bằng JS, ví dụ nhịp 4/4 sẽ có 4 đèn nháy -->
    </div>
    
    <!-- Large Tempo Control -->
    <div class="metronome-tempo-control">
      <button id="btn-metronome-dec" class="tempo-btn" title="Giảm 1 BPM">−</button>
      <div class="tempo-display-wrapper">
        <span id="metronome-bpm-val" class="tempo-value">80</span>
        <span class="tempo-unit">BPM</span>
      </div>
      <button id="btn-metronome-inc" class="tempo-btn" title="Tăng 1 BPM">+</button>
    </div>
    
    <!-- BPM Slider -->
    <div class="metronome-row">
      <input type="range" id="metronome-bpm-slider" class="metronome-slider" min="30" max="250" value="80" title="Kéo để điều chỉnh BPM">
    </div>
    
    <!-- Metronome Controls: Play & TAP Tempo -->
    <div class="metronome-actions">
      <button id="btn-metronome-toggle-play" class="btn-metronome-play" title="Bật/Tắt âm gõ nhịp">🔊 Bật nhịp</button>
      <button id="btn-metronome-tap" class="btn-metronome-tap" title="Gõ liên tục theo tốc độ để tính BPM">TAP</button>
    </div>
    
    <!-- Metronome Volume & Sound Select -->
    <div class="metronome-settings">
      <div class="metronome-setting-row">
        <span class="metronome-setting-label">Số Phách:</span>
        <select id="metronome-beats-select" class="metronome-select" title="Số phách trong 1 ô nhịp">
          <option value="2">2/4 (Nhịp 2)</option>
          <option value="3">3/4 (Nhịp 3)</option>
          <option value="4" selected>4/4 (Nhịp 4)</option>
          <option value="6">6/8 (Nhịp 6)</option>
        </select>
      </div>
      <div class="metronome-setting-row">
        <span class="metronome-setting-label">Âm lượng:</span>
        <input type="range" id="metronome-volume-slider" class="metronome-slider volume-slider" min="0" max="100" value="60" title="Âm lượng tiếng gõ">
      </div>
      <div class="metronome-setting-row">
        <span class="metronome-setting-label">Tiếng gõ:</span>
        <select id="metronome-sound-select" class="metronome-select" title="Loại nhạc cụ gõ nhịp">
          <option value="woodblock" selected>Woodblock (Mõ gỗ)</option>
          <option value="cowbell">Cowbell (Chuông bò)</option>
          <option value="beep">Digital Beep (Bíp)</option>
        </select>
      </div>
    </div>

    <!-- Quick Tempo Presets -->
    <div class="metronome-presets" style="display: flex; gap: 4px; justify-content: center; margin-top: 8px; flex-wrap: wrap;">
      <button class="btn-tempo-preset" data-bpm="60" style="padding: 2px 6px; font-size: 0.72rem; border-radius: 4px; border: 1px solid var(--border); background: var(--bg-surface); cursor: pointer;">Largo (60)</button>
      <button class="btn-tempo-preset" data-bpm="76" style="padding: 2px 6px; font-size: 0.72rem; border-radius: 4px; border: 1px solid var(--border); background: var(--bg-surface); cursor: pointer;">Andante (76)</button>
      <button class="btn-tempo-preset" data-bpm="108" style="padding: 2px 6px; font-size: 0.72rem; border-radius: 4px; border: 1px solid var(--border); background: var(--bg-surface); cursor: pointer;">Moderato (108)</button>
      <button class="btn-tempo-preset" data-bpm="132" style="padding: 2px 6px; font-size: 0.72rem; border-radius: 4px; border: 1px solid var(--border); background: var(--bg-surface); cursor: pointer;">Allegro (132)</button>
    </div>
  </div>
</div>


<!-- Nút thoát Sheet-Only Mode (fixed, luôn ở góc trên phải) -->
<button id="btn-exit-sheet-only" title="Thoát chế độ toàn màn hình (Esc)" aria-label="Thoát">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
</button>


<!-- ===== SCRIPTS ===== -->
<!-- OSMD from local vendor (fallback CDN) -->
<script src="assets/js/vendor/opensheetmusicdisplay.min.js" onerror="
  var s=document.createElement('script');
  s.src='https://cdn.jsdelivr.net/npm/opensheetmusicdisplay@1.8.6/build/opensheetmusicdisplay.min.js';
  document.head.appendChild(s);"></script>

<?php
// Auto cache-bust: dùng thời gian sửa file
function jsTag(string $file, bool $defer = true): string {
    $path = __DIR__ . '/assets/js/' . $file;
    $v    = file_exists($path) ? filemtime($path) : time();
    $d    = $defer ? ' defer' : '';
    return "<script src=\"assets/js/{$file}?v={$v}\"{$d}></script>\n";
}

// ── 1. CORE Infrastructure (không defer — cần sớm nhất) ──
echo jsTag('core/EventBus.js', false);
echo jsTag('core/Store.js',    false);
echo jsTag('core/ApiService.js', false);
echo jsTag('core/ServiceWorkerManager.js', false);

// ── 2. Renderers & Engines (defer OK) ──
echo jsTag('osmd-renderer.js');
echo jsTag('lyric-extractor.js');
echo jsTag('transpose-engine.js');
echo jsTag('session-tracker.js');
echo jsTag('auth.js');
echo jsTag('history-manager.js');
echo jsTag('url-state.js');

// ── 3. Feature Modules (defer) ──
echo jsTag('library-ui.js');
echo jsTag('setlist-ui.js');
echo jsTag('importer.js');
echo jsTag('admin-ui.js');
echo jsTag('display-settings.js');
echo jsTag('chord-canvas-xml.js');
echo jsTag('chord-canvas-ui.js');
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
echo jsTag('live-sync.js');


// ── 4. App Controllers (defer, phụ thuộc vào modules trên) ──
echo jsTag('song-loader.js');
echo jsTag('keyboard-handler.js');
echo jsTag('toolbar-controller.js');
echo jsTag('app.js');
echo jsTag('fab.js');
?>


</body>
</html>
