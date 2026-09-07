<?php
/**
 * learn/index.php — SheetApp Interactive Music Learning Studio
 * Route: /learn/  hoặc /learn/?song=slug
 *
 * Tái sử dụng:
 * - core/ApiService.js, EventBus.js, Store.js
 * - assets/js/vendor/opensheetmusicdisplay.min.js, Tone.js, tonal.min.js
 *
 * KHÔNG load tất cả modules từ trang chính (không cần ChordCanvas UI,
 * Setlist, Admin, AnnotationCanvas, LiveSync, etc.)
 */
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
require_once __DIR__ . '/../api/core/Auth.php';
$currentUser = Auth::username() ?: 'banhat';

// Cache-bust helper
function learnJsTag(string $file, bool $defer = true): string {
    $path = __DIR__ . '/../' . $file;
    $v    = file_exists($path) ? filemtime($path) : time();
    $d    = $defer ? ' defer' : '';
    return "<script src=\"/{$file}?v={$v}\"{$d}></script>\n";
}
function learnCssTag(string $file): string {
    $path = file_exists(__DIR__ . '/../assets/css/' . $file)
        ? __DIR__ . '/../assets/css/' . $file
        : __DIR__ . '/' . $file;
    $v = file_exists($path) ? filemtime($path) : time();
    if (file_exists(__DIR__ . '/../assets/css/' . $file)) {
        return "<link rel=\"stylesheet\" href=\"/assets/css/{$file}?v={$v}\">\n";
    }
    return "<link rel=\"stylesheet\" href=\"/learn/{$file}?v={$v}\">\n";
}
?>
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="mobile-web-app-capable" content="yes">
  <title>SheetApp Learn — Interactive Music Learning Studio</title>
  <meta name="description" content="Học đàn Piano, Organ và hợp âm cùng SheetApp. Đệm tự động, bàn phím ảo, A/B loop và nhiều hơn nữa.">

  <!-- PWA -->
  <link rel="manifest" href="/manifest.json">
  <meta name="theme-color" content="#7c3aed">
  <link rel="apple-touch-icon" href="/assets/img/icon-192.png">
  <link rel="icon" href="/favicon.ico">

  <!-- Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Fira+Code:wght@500;600&display=swap" rel="stylesheet">

  <!-- Base styles (design tokens) -->
  <?php echo learnCssTag('base.css'); ?>
  <!-- Learn-specific styles -->
  <link rel="stylesheet" href="/learn/learn.css?v=<?php echo filemtime(__DIR__.'/learn.css'); ?>">

  <!-- Preload OSMD -->
  <link rel="preload" href="/assets/js/vendor/opensheetmusicdisplay.min.js" as="script">
</head>
<body>
<div class="learn-page" data-status="idle">

  <!-- ═══ HEADER ═══════════════════════════════════════════════════════ -->
  <header class="learn-header">
    <a href="/" class="learn-back-btn" title="Quay về SheetApp">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <path d="M19 12H5M12 19l-7-7 7-7"/>
      </svg>
      SheetApp
    </a>

    <span class="learn-header-title">🎹 Learn</span>

    <div class="learn-song-info">
      <div class="learn-song-info-title" id="learn-song-label">Chọn bài để bắt đầu</div>
      <div class="learn-song-info-meta" id="learn-song-meta"></div>
    </div>

    <!-- Chord profile & Transpose controls -->
    <div class="learn-header-tools">
      <!-- Chord Set -->
      <div class="learn-tool-item">
        <label for="learn-chord-set-select" class="learn-tool-label">Hợp âm:</label>
        <select id="learn-chord-set-select" class="learn-tool-select" title="Chọn bộ hợp âm">
          <option value="HD" selected>HD (Mặc định)</option>
          <option value="TLH">TLH</option>
          <option value="default">Cơ bản</option>
        </select>
      </div>

      <!-- Transpose -->
      <div class="learn-tool-item learn-transpose-box">
        <span class="learn-tool-label">Transpose:</span>
        <button id="btn-learn-trans-dec" class="btn-learn-tool" title="Hạ nửa cung (b)">−</button>
        <span id="learn-trans-val" class="learn-trans-value">0</span>
        <button id="btn-learn-trans-inc" class="btn-learn-tool" title="Tăng nửa cung (#)">+</button>
      </div>
    </div>

    <!-- Song picker toggle -->
    <button class="btn-learn-song-picker" id="btn-learn-song-picker" title="Chọn bài hát">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
      </svg>
      Chọn bài
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:10px;height:10px">
        <path d="M6 9l6 6 6-6"/>
      </svg>
    </button>

    <span class="learn-status-badge" id="learn-status-badge">Sẵn sàng</span>
  </header>

  <!-- ═══ SONG PICKER PANEL ════════════════════════════════════════════ -->
  <div id="learn-song-picker-panel" class="learn-song-picker-panel hidden">
    <input
      type="search"
      id="learn-song-search"
      class="learn-song-search"
      placeholder="🔍 Tìm bài hát..."
      autocomplete="off">
    <div id="learn-song-list" class="learn-song-list">
      <!-- Populated by LearnApp.init() -->
    </div>
  </div>

  <!-- ═══ LOADING / ERROR ══════════════════════════════════════════════ -->
  <div id="learn-loading" class="learn-loading-overlay hidden">Đang tải...</div>
  <div id="learn-error"   class="learn-error-banner hidden"></div>

  <!-- ═══ MAIN LAYOUT ══════════════════════════════════════════════════ -->
  <div class="learn-main">

    <!-- ── Score ─────────────────────────────────────────────────────── -->
    <section class="learn-score-section">
      <div id="learn-score-container">
        <!-- OSMD renders here -->
        <div style="padding:32px;text-align:center;color:#888;font-size:14px;">
          🎵 Chọn một bài hát để hiện sheet nhạc
        </div>
      </div>
    </section>

    <!-- ── Side Panel ─────────────────────────────────────────────────── -->
    <aside class="learn-side-panel">

      <!-- Mode selector -->
      <div class="learn-mode-bar">
        <button class="btn-learn-mode active" data-mode="piano"  title="Học Piano">🎹 Piano</button>
        <button class="btn-learn-mode"        data-mode="chord"  title="Tập Hợp âm">🎸 Hợp âm</button>
        <button class="btn-learn-mode"        data-mode="satb"   title="Luyện giọng SATB">🎤 SATB</button>
        <button class="btn-learn-mode"        data-mode="melody" title="Tập Giai điệu">🎵 Melody</button>
      </div>

      <!-- Accompaniment Pattern Selector -->
      <div class="learn-panel-card" id="learn-pattern-card">
        <div class="learn-panel-card-header">
          <span class="learn-panel-card-title">🎼 Kiểu đệm tự động</span>
          <label class="learn-toggle-switch" title="Bật/Tắt đệm">
            <input type="checkbox" id="learn-pattern-toggle" checked>
            <span class="learn-toggle-slider"></span>
          </label>
        </div>
        <select id="learn-pattern-select" class="learn-select">
          <option value="piano-block-4-4-v1">🎹 Piano Block (4/4 Cơ bản)</option>
          <option value="piano-bass-chord-4-4-v1" selected>🎹 Bass + Chords (4/4 Pop/Ballad)</option>
          <option value="piano-arpeggio-4-4-v1">✨ Arpeggio Rải Nốt (4/4 Nhẹ nhàng)</option>
          <option value="piano-waltz-3-4-v1">💃 Waltz Cổ Điển (3/4 Bùm-Chát)</option>
          <option value="piano-worship-6-8-v1">🕊️ Worship Ballad (6/8 Sâu lắng)</option>
          <option value="organ-church-4-4-v1">⛪ Organ Thánh Ca (4/4 Ngân dài)</option>
        </select>

        <!-- Sound Mixer preview -->
        <div class="learn-mini-mixer">
          <div class="mixer-item">
            <span>Piano</span>
            <input type="range" id="slider-vol-piano" min="-30" max="4" value="-2">
          </div>
          <div class="mixer-item">
            <span>Bass</span>
            <input type="range" id="slider-vol-bass" min="-30" max="4" value="-1">
          </div>
        </div>
      </div>

      <!-- Chord Card -->
      <div class="chord-card-container">
        <div id="learn-chord-card">
          <!-- Mounted by ChordCard.mount() -->
        </div>
      </div>

      <!-- Virtual Keyboard -->
      <section class="learn-keyboard-section" id="learn-keyboard-section">
        <div class="chord-label" style="padding:0 0 6px 0;">Bàn Phím Piano</div>
        <div id="learn-virtual-keyboard">
          <!-- Mounted by VirtualKeyboard.mount() -->
        </div>
      </section>

    </aside>

    <!-- ── Controls Bar ───────────────────────────────────────────────── -->
    <div class="learn-controls-bar">

      <!-- Play / Pause -->
      <button
        id="btn-learn-play"
        class="btn-learn-play"
        title="Play / Dừng (Space)"
        disabled>
        ▶ Play
      </button>

      <!-- Stop -->
      <button
        id="btn-learn-stop"
        class="btn-learn-stop"
        title="Dừng & quay đầu"
        disabled>
        ⏹ Stop
      </button>

      <!-- Section / Loop Selector -->
      <div class="learn-loop-group">
        <select id="learn-section-select" class="learn-select learn-section-select" title="Chọn phân đoạn để tập">
          <option value="all">Toàn bài (Không lặp)</option>
        </select>
        <button id="btn-learn-loop-toggle" class="btn-learn-loop" title="Bật/Tắt vòng lặp phân đoạn">
          🔁 Lặp: TẮT
        </button>
      </div>

      <!-- BPM Control -->
      <div class="learn-bpm-control">
        <span class="learn-bpm-label">BPM</span>
        <button class="btn-learn-bpm" id="btn-learn-bpm-dec" title="Giảm BPM">−</button>
        <span class="learn-bpm-value" id="learn-bpm-value">76</span>
        <button class="btn-learn-bpm" id="btn-learn-bpm-inc" title="Tăng BPM">+</button>
      </div>

      <!-- Tempo Ladder -->
      <div class="learn-tempo-ladder">
        <button class="btn-tempo-ladder" data-ratio="0.5" title="Tập chậm (50% BPM)">50%</button>
        <button class="btn-tempo-ladder" data-ratio="0.75" title="Tăng tốc (75% BPM)">75%</button>
        <button class="btn-tempo-ladder active" data-ratio="1.0" title="Nhịp chuẩn (100% BPM)">100%</button>
        <button class="btn-tempo-ladder" data-ratio="1.1" title="Thử thách (110% BPM)">110%</button>
        <button id="btn-learn-auto-tempo" class="btn-tempo-ladder" title="Tự động tăng nhịp độ sau mỗi 2 vòng lặp">⚡ Tăng dần</button>
      </div>

    </div>

  </div><!-- /.learn-main -->

</div><!-- /.learn-page -->

<!-- ═══ SCRIPTS ══════════════════════════════════════════════════════ -->
<!-- Vendors (cần trước khi /learn JS chạy) -->
<script src="/assets/js/vendor/opensheetmusicdisplay.min.js" onerror="
  var s=document.createElement('script');
  s.src='https://cdn.jsdelivr.net/npm/opensheetmusicdisplay@1.8.6/build/opensheetmusicdisplay.min.js';
  document.head.appendChild(s);"></script>

<script src="/assets/js/vendor/Tone.js" defer onerror="
  var s=document.createElement('script');
  s.src='https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.49/Tone.js';
  document.head.appendChild(s);"></script>

<script src="/assets/js/vendor/tonal.min.js" defer onerror="
  var s=document.createElement('script');
  s.src='https://cdn.jsdelivr.net/npm/tonal/browser/tonal.min.js';
  document.head.appendChild(s);"></script>

<!-- Core infrastructure (shared với app chính) -->
<?php
echo learnJsTag('assets/js/core/EventBus.js', false);
echo learnJsTag('assets/js/core/Store.js',    false);
echo learnJsTag('assets/js/core/ApiService.js', false);
?>

<!-- /learn modules -->
<?php
echo learnJsTag('assets/js/learn/learn-interfaces.js', true);
echo learnJsTag('assets/js/learn/learn-store.js', true);
echo learnJsTag('assets/js/learn/timeline/chord-timeline-normalizer.js', true);
echo learnJsTag('assets/js/learn/transport/music-transport.js', true);
echo learnJsTag('assets/js/learn/accompaniment/pattern-library.js', true);
echo learnJsTag('assets/js/learn/harmony/voicing-engine.js', true);
echo learnJsTag('assets/js/learn/audio/learn-sound-engine.js', true);
echo learnJsTag('assets/js/learn/accompaniment/pattern-engine.js', true);
echo learnJsTag('assets/js/learn/practice/loop-controller.js', true);
echo learnJsTag('assets/js/learn/practice/practice-tracker.js', true);
echo learnJsTag('assets/js/learn/ui/virtual-keyboard.js', true);
echo learnJsTag('assets/js/learn/ui/chord-card.js', true);
echo learnJsTag('assets/js/learn/learn-app.js', true);
?>

<script>
// Keyboard shortcut: Space = play/pause
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && e.target === document.body) {
    e.preventDefault();
    document.getElementById('btn-learn-play')?.click();
  }
});

// Enable buttons after song selected
document.addEventListener('DOMContentLoaded', () => {
  if (window.EventBus && window.LEARN_EVENTS) {
    EventBus.on(LEARN_EVENTS.READY, () => {
      document.getElementById('btn-learn-play').disabled = false;
      document.getElementById('btn-learn-stop').disabled = false;
      document.getElementById('learn-status-badge').textContent = 'Sẵn sàng';
    });
  }
});
</script>

</body>
</html>
