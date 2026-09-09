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

  <!-- ═══ HEADER ═══════════════════════════════════════════════════ -->
  <header class="learn-header">
    <a href="/" class="learn-back-btn" title="Quay về SheetApp">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <path d="M19 12H5M12 19l-7-7 7-7"/>
      </svg>
      SheetApp
    </a>

    <span class="learn-header-title">
      <svg viewBox="0 0 24 24" fill="currentColor" class="learn-svg-icon" style="width:18px;height:18px;display:inline-block;vertical-align:-3px;margin-right:4px;">
        <path d="M20 5H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-9 10H9v-5h2v5zm4 0h-2v-5h2v5zm4 0h-2v-5h2v5z"/>
      </svg>
      Learn Studio
    </span>

    <div class="learn-song-info">
      <div class="learn-song-info-title" id="learn-song-label">Đang tải bài hát...</div>
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

  <!-- ═══ SONG PICKER PANEL (Modal Dialog) ════════════════════════════ -->
  <div id="learn-song-picker-panel" class="learn-song-picker-panel hidden">
    <div class="learn-picker-header">
      <div class="learn-picker-title">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;vertical-align:-3px;margin-right:6px;">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
        </svg>
        Chọn bài hát học tập
      </div>
      <button type="button" class="btn-picker-close" id="btn-picker-close" title="Đóng">✕</button>
    </div>
    <input
      type="search"
      id="learn-song-search"
      class="learn-song-search"
      placeholder="Tìm theo số bài hoặc tên (vd: 90, 001, Kìa xem ngọn đồi xanh...)"
      autocomplete="off">
    <div id="learn-song-list" class="learn-song-list">
      <!-- Populated by LearnApp.init() -->
    </div>
  </div>

  <!-- ═══ LOADING / ERROR ══════════════════════════════════════════════ -->
  <div id="learn-loading" class="learn-loading-overlay hidden">Đang tải...</div>
  <div id="learn-error"   class="learn-error-banner hidden"></div>

  <!-- ═══ MOBILE 3-TAB SELECTOR (Chỉ hiện trên điện thoại / màn hình nhỏ) ═══ -->
  <nav class="learn-mobile-tabs" id="learn-mobile-tabs">
    <button type="button" class="btn-learn-tab active" data-tab="score">
      <span class="tab-icon">🎼</span>
      <span class="tab-label">Bản nhạc</span>
    </button>
    <button type="button" class="btn-learn-tab" data-tab="keys">
      <span class="tab-icon">🎹</span>
      <span class="tab-label">Phím & Hợp âm</span>
    </button>
    <button type="button" class="btn-learn-tab" data-tab="choir">
      <span class="tab-icon">🎤</span>
      <span class="tab-label">Ca đoàn SATB</span>
    </button>
  </nav>

  <!-- ═══ MAIN LAYOUT ══════════════════════════════════════════════════ -->
  <div class="learn-main" id="learn-main" data-active-tab="score">

    <!-- ── Center Stage (Score + Virtual Keyboard) ──────────────────── -->
    <div class="learn-center-stage">

      <!-- Score Section -->
      <section class="learn-score-section">
        <!-- Score Toolbar (Zoom & Tools) -->
        <div class="learn-score-toolbar">
          <div class="score-toolbar-left">
            <span class="score-toolbar-tag">Sheet Music</span>
          </div>
          <div class="score-toolbar-right">
            <!-- Zoom Controls -->
            <div class="learn-zoom-controls">
              <button type="button" class="btn-learn-score-tool" id="btn-learn-zoom-out" title="Thu nhỏ (Zoom Out)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </button>
              <button type="button" class="btn-learn-score-tool btn-zoom-val" id="btn-learn-zoom-reset" title="Khôi phục 100%">
                <span id="learn-zoom-val">100%</span>
              </button>
              <button type="button" class="btn-learn-score-tool" id="btn-learn-zoom-in" title="Phóng to (Zoom In)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </button>
              <button type="button" class="btn-learn-score-tool btn-zoom-fit" id="btn-learn-zoom-fit" title="Vừa toàn bộ bản nhạc (Fit Sheet)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
                <span>Vừa trang</span>
              </button>
            </div>
          </div>
        </div>

        <div id="learn-score-container">
          <!-- OSMD renders here -->
          <div class="learn-score-placeholder">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:36px;height:36px;margin-bottom:12px;opacity:0.6;">
              <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
            </svg>
            <div>Đang tải bài hát... Hãy chọn bài từ thanh công cụ để bắt đầu</div>
          </div>
        </div>
      </section>

      <!-- Virtual Keyboard across bottom of score -->
      <section class="learn-keyboard-section" id="learn-keyboard-section">
        <div class="learn-keyboard-header">
          <span class="learn-keyboard-title">
            <svg viewBox="0 0 24 24" fill="currentColor" style="width:14px;height:14px;vertical-align:-2px;margin-right:4px;">
              <path d="M20 5H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-9 10H9v-5h2v5zm4 0h-2v-5h2v5zm4 0h-2v-5h2v5z"/>
            </svg>
            BÀN PHÍM PIANO
          </span>
          <div class="learn-hand-selector" id="learn-hand-selector" title="Chọn tay để luyện tập">
            <span class="hand-label">Tập:</span>
            <button type="button" class="btn-hand-mode active" data-hand="both" title="Phát cả hai tay (Bass + Hợp âm)">👐 Cả 2 tay</button>
            <button type="button" class="btn-hand-mode" data-hand="right" title="Chỉ phát tay phải (Bạn tự bấm bass tay trái)">🖐 Tay phải</button>
            <button type="button" class="btn-hand-mode" data-hand="left" title="Chỉ phát tay trái (Bạn tự dậm hợp âm tay phải)">🤚 Tay trái</button>
          </div>
          <div class="vkb-legend">
            <span class="vkb-legend-rh"><span class="legend-dot legend-dot-rh"></span> Tay phải</span>
            <span class="vkb-legend-lh"><span class="legend-dot legend-dot-lh"></span> Tay trái</span>
            <span class="vkb-legend-next"><span class="legend-dot legend-dot-next"></span> Kế tiếp</span>
          </div>
        </div>
        <div id="learn-virtual-keyboard">
          <!-- Mounted by VirtualKeyboard.mount() -->
        </div>
      </section>
    </div>

    <!-- ── Side Panel (Studio Controls) ───────────────────────────────── -->
    <aside class="learn-side-panel">

      <!-- Mode selector -->
      <div class="learn-mode-bar">
        <button class="btn-learn-mode active" data-mode="piano"  title="Học Piano">
          <svg viewBox="0 0 24 24" fill="currentColor" class="mode-icon"><path d="M20 5H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-9 10H9v-5h2v5zm4 0h-2v-5h2v5zm4 0h-2v-5h2v5z"/></svg>
          Piano
        </button>
        <button class="btn-learn-mode"        data-mode="chord"  title="Tập Hợp âm">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="mode-icon"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          Hợp âm
        </button>
        <button class="btn-learn-mode"        data-mode="satb"   title="Luyện giọng SATB">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="mode-icon"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
          SATB
        </button>
        <button class="btn-learn-mode"        data-mode="melody" title="Tập Giai điệu">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="mode-icon"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
          Melody
        </button>
      </div>

      <!-- Accompaniment Pattern Selector -->
      <div class="learn-panel-card" id="learn-pattern-card">
        <div class="learn-panel-card-header">
          <span class="learn-panel-card-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;vertical-align:-3px;margin-right:4px;">
              <path d="M2 10s3-3 5-3 5 6 7 6 5-3 8-3"/><path d="M2 14s3-3 5-3 5 6 7 6 5-3 8-3"/>
            </svg>
            Kiểu đệm tự động
          </span>
          <label class="learn-toggle-switch" title="Bật/Tắt đệm">
            <input type="checkbox" id="learn-pattern-toggle" checked>
            <span class="learn-toggle-slider"></span>
          </label>
        </div>
        <select id="learn-pattern-select" class="learn-select">
          <option value="smart-ballad" selected>🎹 Pop / Worship Ballad (4/4 Mượt Mà)</option>
          <option value="smart-slowrock-6-8">🌊 Thánh Ca 6/8 Slow Rock (Sóng Biển)</option>
          <option value="smart-waltz">💃 Boston / Slow Waltz (3/4 Trữ Tình)</option>
          <option value="smart-hymn">⛪️ Thánh Ca 4 Bè (Hòa Âm Trang Trọng)</option>
          <option value="smart-worship">✨ Arpeggio Suối Reo (Rải 16th Mượt Mà)</option>
          <option value="smart-march">🎺 Hành Khúc / Hân Hoan (Joyful March)</option>
          <option value="smart-rumba">🌴 Rumba Thánh Ca (Trầm Ấm Lãng Mạn)</option>
          <option value="piano-block-4-4-v1">📦 Piano Block (Dậm Đều Từng Phách)</option>
          <option value="organ-church-4-4-v1">🏛 Organ Đại Thánh Đường (Pedal Bass)</option>
        </select>

        <!-- Density control -->
        <div class="learn-density-control">
          <span class="learn-sub-label">Độ dày đệm:</span>
          <div class="btn-group-density" role="group">
            <button type="button" class="btn-density" data-density="soft" title="Đệm êm dịu, thưa nốt">Êm dịu</button>
            <button type="button" class="btn-density active" data-density="medium" title="Đệm tiêu chuẩn, cân bằng">Vừa</button>
            <button type="button" class="btn-density" data-density="rich" title="Đệm dày dặn, nhiều nốt hoa mỹ">Dày dặn</button>
          </div>
        </div>

        <!-- Sound Mixer preview -->
        <div class="learn-mini-mixer">
          <div class="mixer-item">
            <span>Piano</span>
            <input type="range" id="slider-vol-piano" min="-30" max="4" value="-2" title="Âm lượng Piano">
          </div>
          <div class="mixer-item">
            <span>Bass</span>
            <input type="range" id="slider-vol-bass" min="-30" max="4" value="-1" title="Âm lượng Bass">
          </div>
          <div class="mixer-item">
            <span style="display:flex;align-items:center;gap:4px;">
              <input type="checkbox" id="learn-drum-toggle" checked title="Bật/Tắt Trống & Bộ gõ mộc" style="margin:0;cursor:pointer;accent-color:var(--learn-accent);">
              Trống/Gõ
            </span>
            <input type="range" id="slider-vol-drum" min="-35" max="4" value="-4" title="Âm lượng Trống & Bộ gõ mộc">
          </div>
        </div>
      </div>

      <!-- SATB Choir Mixer Card -->
      <div class="learn-panel-card" id="learn-satb-card">
        <div class="learn-panel-card-header">
          <span class="learn-panel-card-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;vertical-align:-3px;margin-right:4px;">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
            Luyện Ca Đoàn (4 Bè SATB)
          </span>
          <span class="satb-badge-mode" id="satb-active-badge">4 Bè</span>
        </div>
        <div class="satb-mixer-body">
          <!-- Soprano -->
          <div class="satb-voice-row" data-voice="soprano">
            <div class="voice-info">
              <span class="voice-dot voice-dot-soprano"></span>
              <span class="voice-name">Soprano (Nữ Cao)</span>
            </div>
            <div class="voice-actions">
              <button type="button" class="btn-voice-btn btn-voice-solo" data-voice="soprano" title="Chỉ nghe bè này">Solo</button>
              <button type="button" class="btn-voice-btn btn-voice-mute" data-voice="soprano" title="Tắt bè này để tự hát">Mute</button>
            </div>
            <div class="voice-slider-wrap">
              <input type="range" class="voice-slider" data-voice="soprano" min="-30" max="4" value="-2">
            </div>
          </div>
          <!-- Alto -->
          <div class="satb-voice-row" data-voice="alto">
            <div class="voice-info">
              <span class="voice-dot voice-dot-alto"></span>
              <span class="voice-name">Alto (Nữ Trầm)</span>
            </div>
            <div class="voice-actions">
              <button type="button" class="btn-voice-btn btn-voice-solo" data-voice="alto" title="Chỉ nghe bè này">Solo</button>
              <button type="button" class="btn-voice-btn btn-voice-mute" data-voice="alto" title="Tắt bè này để tự hát">Mute</button>
            </div>
            <div class="voice-slider-wrap">
              <input type="range" class="voice-slider" data-voice="alto" min="-30" max="4" value="-2">
            </div>
          </div>
          <!-- Tenor -->
          <div class="satb-voice-row" data-voice="tenor">
            <div class="voice-info">
              <span class="voice-dot voice-dot-tenor"></span>
              <span class="voice-name">Tenor (Nam Cao)</span>
            </div>
            <div class="voice-actions">
              <button type="button" class="btn-voice-btn btn-voice-solo" data-voice="tenor" title="Chỉ nghe bè này">Solo</button>
              <button type="button" class="btn-voice-btn btn-voice-mute" data-voice="tenor" title="Tắt bè này để tự hát">Mute</button>
            </div>
            <div class="voice-slider-wrap">
              <input type="range" class="voice-slider" data-voice="tenor" min="-30" max="4" value="-2">
            </div>
          </div>
          <!-- Bass -->
          <div class="satb-voice-row" data-voice="bass">
            <div class="voice-info">
              <span class="voice-dot voice-dot-bass"></span>
              <span class="voice-name">Bass (Nam Trầm)</span>
            </div>
            <div class="voice-actions">
              <button type="button" class="btn-voice-btn btn-voice-solo" data-voice="bass" title="Chỉ nghe bè này">Solo</button>
              <button type="button" class="btn-voice-btn btn-voice-mute" data-voice="bass" title="Tắt bè này để tự hát">Mute</button>
            </div>
            <div class="voice-slider-wrap">
              <input type="range" class="voice-slider" data-voice="bass" min="-30" max="4" value="-1.5">
            </div>
          </div>
        </div>
      </div>

      <!-- Chord Card -->
      <div class="chord-card-container">
        <div id="learn-chord-card">
          <!-- Mounted by ChordCard.mount() -->
        </div>
      </div>

    </aside>
  </div><!-- /.learn-main -->

  <!-- ── Controls Bar ───────────────────────────────────────────────── -->
  <div class="learn-controls-bar">

    <!-- Play / Pause -->
    <button
      id="btn-learn-play"
      class="btn-learn-play"
      title="Play / Dừng (Space)"
      disabled>
      <svg viewBox="0 0 24 24" fill="currentColor" class="control-btn-icon"><polygon points="5 3 19 12 5 21 5 3"/></svg>
      <span>Play</span>
    </button>

    <!-- Stop -->
    <button
      id="btn-learn-stop"
      class="btn-learn-stop"
      title="Dừng & quay đầu"
      disabled>
      <svg viewBox="0 0 24 24" fill="currentColor" class="control-btn-icon"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
      <span>Stop</span>
    </button>

    <!-- Section / Loop Selector -->
    <div class="learn-loop-group">
      <select id="learn-section-select" class="learn-select learn-section-select" title="Chọn phân đoạn để tập">
        <option value="all">Toàn bài (Không lặp)</option>
      </select>
      <button id="btn-learn-loop-toggle" class="btn-learn-loop" title="Bật/Tắt vòng lặp phân đoạn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="control-btn-icon"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
        <span id="learn-loop-label">Lặp: TẮT</span>
      </button>
    </div>

    <!-- BPM Control -->
    <div class="learn-bpm-control">
      <span class="learn-bpm-label">BPM</span>
      <button class="btn-learn-bpm" id="btn-learn-bpm-dec" title="Giảm BPM">−</button>
      <span class="learn-bpm-value" id="learn-bpm-value">76</span>
      <button class="btn-learn-bpm" id="btn-learn-bpm-inc" title="Tăng BPM">+</button>
    </div>

    <!-- Metronome Click & Visual Beat -->
    <div class="learn-metronome-box" title="Máy đếm nhịp">
      <button type="button" id="btn-learn-metro" class="btn-learn-metro" title="Bật/Tắt tiếng gõ phách Metronome">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        <span id="learn-metro-label">Gõ nhịp</span>
      </button>
      <div class="learn-beat-indicator" id="learn-beat-indicator" title="Nhịp đập 1-2-3-4">
        <span class="beat-dot" data-beat="1"></span>
        <span class="beat-dot" data-beat="2"></span>
        <span class="beat-dot" data-beat="3"></span>
        <span class="beat-dot" data-beat="4"></span>
      </div>
    </div>

    <!-- Tempo Ladder -->
    <div class="learn-tempo-ladder">
      <button class="btn-tempo-ladder" data-ratio="0.5" title="Tập chậm (50% BPM)">50%</button>
      <button class="btn-tempo-ladder" data-ratio="0.75" title="Tăng tốc (75% BPM)">75%</button>
      <button class="btn-tempo-ladder active" data-ratio="1.0" title="Nhịp chuẩn (100% BPM)">100%</button>
      <button class="btn-tempo-ladder" data-ratio="1.1" title="Thử thách (110% BPM)">110%</button>
      <button id="btn-learn-auto-tempo" class="btn-tempo-ladder" title="Tự động tăng nhịp độ sau mỗi 2 vòng lặp">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;vertical-align:-2px;margin-right:3px;"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
        <span>Tăng dần</span>
      </button>
    </div>

  </div><!-- /.learn-controls-bar -->

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
