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

// Cache-bust helpers
function liveBandJsTag(string $file, bool $defer = true): string {
    $path = __DIR__ . '/../' . $file;
    $v    = file_exists($path) ? filemtime($path) : time();
    $d    = $defer ? ' defer' : '';
    return "<script src=\"/{$file}?v={$v}\"{$d}></script>\n";
}
function liveBandCssTag(string $file): string {
    $path = file_exists(__DIR__ . '/../assets/css/' . $file)
        ? __DIR__ . '/../assets/css/' . $file
        : __DIR__ . '/' . $file;
    $v = file_exists($path) ? filemtime($path) : time();
    if (file_exists(__DIR__ . '/../assets/css/' . $file)) {
        return "<link rel=\"stylesheet\" href=\"/assets/css/{$file}?v={$v}\">\n";
    }
    return "<link rel=\"stylesheet\" href=\"/live-band/{$file}?v={$v}\">\n";
}
?>
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="mobile-web-app-capable" content="yes">
  <title>Live Band Studio — SheetApp Biểu Diễn Trực Tiếp</title>
  <meta name="description" content="Hệ thống đồng bộ biểu diễn trực tiếp cho Ca Trưởng, Ban Nhạc và Ca Đoàn. Chuyển bài tức thì, dịch giọng toàn ban, nhảy phân đoạn và đếm nhịp chuẩn bị.">

  <!-- PWA -->
  <link rel="manifest" href="/manifest.json">
  <meta name="theme-color" content="#0a0a14">
  <link rel="apple-touch-icon" href="/assets/img/icon-192.png">
  <link rel="icon" href="/favicon.ico">

  <!-- Google Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Fira+Code:wght@500;600;700&display=swap" rel="stylesheet">

  <!-- Base & Live Band Styles -->
  <?php echo liveBandCssTag('base.css'); ?>
  <link rel="stylesheet" href="/live-band/live-band.css?v=<?php echo file_exists(__DIR__.'/live-band.css') ? filemtime(__DIR__.'/live-band.css') : time(); ?>">

  <!-- Preload OSMD -->
  <link rel="preload" href="/assets/js/vendor/opensheetmusicdisplay.min.js" as="script">
</head>
<body class="stage-dark">

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

  <!-- ══════════════ 2. HOST MASTER COMMAND CONSOLE ══════════════ -->
  <!-- Chỉ hiển thị khi vai trò là Leader hoặc người dùng là Host -->
  <aside id="host-command-console" class="host-command-console hidden">
    <div class="host-console-inner">
      <!-- Section 1: Song & Setlist Switcher -->
      <div class="host-console-group host-song-group">
        <button id="btn-host-prev-song" class="btn-host-nav" title="Bài trước trong Setlist">⏮</button>
        <div class="host-song-select-wrap">
          <select id="host-song-dropdown" class="host-song-dropdown" aria-label="Chọn bài hát">
            <option value="">-- Chọn bài hát phát sóng --</option>
          </select>
        </div>
        <button id="btn-host-next-song" class="btn-host-nav" title="Bài tiếp theo trong Setlist">⏭</button>
        <button id="btn-host-pick-setlist" class="btn-host-pill" title="Nạp Setlist chương trình">📋 Setlist</button>
      </div>

      <!-- Section 2: Master Transpose Controls -->
      <div class="host-console-group host-transpose-group">
        <span class="group-label">Dịch Giọng:</span>
        <button id="btn-host-transpose-down" class="btn-host-step" title="Hạ 1 nửa cung (semitone)">−</button>
        <span id="host-key-val" class="host-key-badge">C (0)</span>
        <button id="btn-host-transpose-up" class="btn-host-step" title="Tăng 1 nửa cung (semitone)">+</button>
      </div>

      <!-- Section 3: Metronome & Count-in -->
      <div class="host-console-group host-tempo-group">
        <div class="tempo-stepper">
          <button id="btn-host-bpm-dec" class="btn-host-step">−5</button>
          <span id="host-bpm-val" class="host-bpm-val">80 BPM</span>
          <button id="btn-host-bpm-inc" class="btn-host-step">+5</button>
        </div>
        <button id="btn-host-countin-trigger" class="btn-host-countin-trigger" title="Đếm nhịp chuẩn bị 1-2-3-4 cho toàn ban nhạc">
          <span class="countin-fire-icon">🔥</span>
          <span>ĐẾM NHỊP VÀO</span>
        </button>
      </div>

      <!-- Section 3b: Ambient Pad Quick Toggle -->
      <div class="host-console-group host-pad-group">
        <button id="btn-host-pad-toggle" class="btn-host-pill pad-toggle-btn" title="Bật/Tắt âm nền Ambient Pad theo Tông">
          <span>🎹</span>
          <span id="host-pad-btn-text">Bật Pad Drone</span>
        </button>
      </div>

      <!-- Section 4: Cue Commander -->
      <div class="host-console-group host-cue-group">
        <span class="group-label">Hiệu Lệnh Sân Khấu:</span>
        <div class="cue-buttons-wrap">
          <button class="btn-cue-trigger btn-cue-chorus" data-cue="chorus" title="Nhắc vào Điệp Khúc">⚡ Điệp Khúc</button>
          <button class="btn-cue-trigger btn-cue-repeat" data-cue="repeat" title="Lặp lại đoạn này">🔁 Lặp Lại</button>
          <button class="btn-cue-trigger btn-cue-soft" data-cue="soft" title="Hát êm (Piano)">🤫 Nhỏ Dần</button>
          <button class="btn-cue-trigger btn-cue-loud" data-cue="loud" title="Quạt mạnh / Cao trào (Forte)">🔥 Cao Trào</button>
          <button class="btn-cue-trigger btn-cue-outro" data-cue="outro" title="Chuẩn bị Kết bài">🛑 Chuẩn Bị Kết</button>
        </div>
      </div>
    </div>

    <!-- Section Roadmap Chips Bar -->
    <div id="host-roadmap-bar" class="host-roadmap-bar">
      <div class="roadmap-label">Phân Đoạn:</div>
      <div id="host-roadmap-chips" class="roadmap-chips-list">
        <!-- Sẽ được điền động theo bài hát: [Intro] [Lời 1] [Điệp khúc] [Outro] -->
        <span class="roadmap-empty-hint">Chưa có phân đoạn bài hát</span>
      </div>
    </div>

    <!-- Rehearsal A-B Loop Bar & Collaborative Ink -->
    <div id="host-rehearsal-loop-bar" class="host-rehearsal-loop-bar">
      <div class="loop-bar-left">
        <button id="btn-toggle-ab-loop" class="btn-host-pill loop-pill-btn" title="Bật/Tắt vòng lặp tập dượt A-B">
          <span>🔁</span>
          <span id="loop-btn-label">Vòng Lặp A-B: Tắt</span>
        </button>
        <div class="loop-inputs-wrap">
          <label>Từ Ô:</label>
          <input type="number" id="loop-start-measure" class="loop-measure-input" value="1" min="1" max="200">
          <label>Đến Ô:</label>
          <input type="number" id="loop-end-measure" class="loop-measure-input" value="16" min="1" max="200">
          <button id="btn-set-loop-current" class="btn-host-step" title="Đặt đoạn 8 ô nhịp quanh vị trí hiện tại">📍 8 Ô Hiện Tại</button>
        </div>
      </div>
      <!-- Collaborative Ink Toolbar (Ca Trưởng) -->
      <div class="host-ink-toolbar" id="host-ink-toolbar">
        <button id="btn-toggle-ink" class="btn-host-pill ink-toggle-btn" title="Bật/Tắt chế độ vẽ chú thích Apple Pencil/S-Pen">
          <span>✏️</span>
          <span id="ink-toggle-label">Bút Chú Thích</span>
        </button>
        <div id="ink-tools-group" class="ink-tools-group hidden">
          <button class="btn-ink-tool active" data-tool="pen" data-color="#ef4444" title="Bút đỏ">🔴</button>
          <button class="btn-ink-tool" data-tool="pen" data-color="#f59e0b" title="Bút vàng">🟡</button>
          <button class="btn-ink-tool" data-tool="highlighter" title="Dạ quang">🖍️</button>
          <button class="btn-ink-tool" data-tool="eraser" title="Tẩy nét">🧹</button>
          <button id="btn-ink-clear-all" class="btn-ink-tool" title="Xóa tất cả nét vẽ">🗑️</button>
        </div>
      </div>
    </div>
  </aside>

  <!-- ══════════════ 3. ROLE-SPECIFIC HEADS-UP DISPLAY (HUD) ══════════════ -->
  <div id="stage-role-hud" class="stage-role-hud">
    <!-- Guitar HUD -->
    <div id="hud-guitar" class="hud-panel hud-guitar hidden">
      <div class="hud-guitar-capo" id="guitar-capo-display">
        <span class="capo-badge">🎸 GỢI Ý CAPO</span>
        <span id="guitar-capo-text" class="capo-text">Tone C → Không cần kẹp Capo (Bấm thế C tiêu chuẩn)</span>
      </div>
      <div class="hud-guitar-chords" id="guitar-key-chords">
        <!-- Chords in current key -->
      </div>
    </div>

    <!-- Bass HUD (Root Notes, Slash Chords, Scale Degree Roots) -->
    <div id="hud-bass" class="hud-panel hud-bass hidden">
      <div class="bass-hud-left">
        <span class="bass-hud-badge">🎸 BASS MASTER</span>
        <div class="bass-active-box">
          <span class="bass-label">NỐT GỐC (ROOT):</span>
          <span id="bass-root-note" class="bass-root-note">C</span>
          <span id="bass-slash-hint" class="bass-slash-hint">Nốt gốc cơ bản</span>
        </div>
      </div>
      <div class="bass-hud-center">
        <span class="bass-scale-label">BỘ NỐT BASS THEO TÔNG:</span>
        <div id="bass-scale-chips" class="bass-scale-chips">
          <!-- Điền tự động theo tông: C - D - E - F - G - A - B -->
        </div>
      </div>
      <div class="bass-hud-right">
        <span class="bass-tuning-label">DÂY BASS:</span>
        <div class="bass-strings-guide">
          <span class="bass-str">4: <strong>E</strong></span>
          <span class="bass-str">3: <strong>A</strong></span>
          <span class="bass-str">2: <strong>D</strong></span>
          <span class="bass-str">1: <strong>G</strong></span>
        </div>
      </div>
    </div>

    <!-- Keyboard / Piano HUD (Harmonic Progression, Voicings, Ambient Pad) -->
    <div id="hud-piano" class="hud-panel hud-piano hidden">
      <div class="piano-hud-left">
        <span class="piano-hud-badge">🎹 PIANO / KEYBOARD</span>
        <div class="piano-active-key-box">
          <span class="piano-label">VÒNG HÒA THANH:</span>
          <span id="piano-progression-text" class="piano-progression-text">I - IV - V - vi</span>
        </div>
      </div>
      <div class="piano-hud-center">
        <span class="piano-voicings-label">HỢP ÂM MỞ RỘNG (VOICINGS):</span>
        <div id="piano-voicing-chips" class="piano-voicing-chips">
          <!-- Cmaj7, Dm7, Em7, Fmaj7, G7, Am7, Bm7b5 -->
        </div>
      </div>
      <div class="piano-hud-right">
        <span class="piano-pad-status-label">AMBIENT PAD SYNC:</span>
        <span id="piano-pad-sync-badge" class="piano-pad-sync-badge">🎹 Pad: Tắt</span>
      </div>
    </div>

    <!-- Drummer / Metronome HUD -->
    <div id="hud-drummer" class="hud-panel hud-drummer hidden">
      <div class="drummer-flasher-wrap">
        <span class="drummer-label">PHÁCH NHỊP:</span>
        <div class="beat-led-group" id="drummer-beat-leds">
          <div class="beat-led" data-beat="1">1</div>
          <div class="beat-led" data-beat="2">2</div>
          <div class="beat-led" data-beat="3">3</div>
          <div class="beat-led" data-beat="4">4</div>
        </div>
        <div class="drummer-bpm-display" id="drummer-bpm-display">80 BPM</div>
      </div>
    </div>

    <!-- Vocal HUD Switcher & SATB Part RehearsalMix -->
    <div id="hud-vocal" class="hud-panel hud-vocal hidden">
      <div class="vocal-controls-wrap">
        <span class="vocal-status-text">🎤 Ca Đoàn:</span>
        <button id="btn-vocal-toggle-view" class="btn-vocal-toggle active" data-view="lyrics">
          📄 Chuyển Xem: Lời Lớn (Teleprompter)
        </button>
        <div class="vocal-font-scaler">
          <button id="btn-vocal-font-dec" class="font-scale-btn" title="Giảm cỡ chữ">A−</button>
          <button id="btn-vocal-font-inc" class="font-scale-btn" title="Tăng cỡ chữ">A+</button>
        </div>
      </div>
      <div class="vocal-satb-selector">
        <span class="satb-label">🎧 Tách Bè Solo:</span>
        <div class="satb-btn-group" id="satb-btn-group">
          <button class="btn-satb-part active" data-part="all" title="Nghe đầy đủ 4 bè">👑 Tất Cả (Tutti)</button>
          <button class="btn-satb-part" data-part="soprano" title="Tô sáng và tăng âm lượng bè Soprano">Soprano (Nữ Cao)</button>
          <button class="btn-satb-part" data-part="alto" title="Tô sáng và tăng âm lượng bè Alto">Alto (Nữ Trầm)</button>
          <button class="btn-satb-part" data-part="tenor" title="Tô sáng và tăng âm lượng bè Tenor">Tenor (Nam Cao)</button>
          <button class="btn-satb-part" data-part="bass" title="Tô sáng và tăng âm lượng bè Bass">Bass (Nam Trầm)</button>
        </div>
      </div>
    </div>
  </div>

  <!-- ══════════════ 4. MAIN STAGE CANVAS AREA ══════════════ -->
  <main id="stage-viewport" class="stage-viewport">
    
    <!-- Empty State (Khi chưa chọn bài) -->
    <div id="stage-empty-state" class="stage-empty-state">
      <div class="empty-icon-pulse">📡</div>
      <h2 class="empty-title">Chào Mừng Đến Live Band Studio</h2>
      <p class="empty-subtitle">Sẵn sàng đồng bộ trực tiếp giữa Ca Trưởng, Nhạc Công và Ca Đoàn.</p>
      <div class="empty-actions">
        <button id="btn-empty-start-host" class="btn btn-primary btn-lg">👑 Mở Phòng Ca Trưởng (Host)</button>
        <button id="btn-empty-join-room" class="btn btn-secondary btn-lg">🔗 Tham Gia Phòng (Join)</button>
      </div>
    </div>

    <!-- OSMD Sheet Music Container -->
    <div id="stage-sheet-wrapper" class="stage-sheet-wrapper hidden">
      <div id="stage-osmd-container" class="stage-osmd-container"></div>
      <canvas id="stage-annotation-layer" class="stage-annotation-layer"></canvas>
    </div>

    <!-- Vocal Teleprompter View Container -->
    <div id="stage-lyric-wrapper" class="stage-lyric-wrapper hidden">
      <div id="stage-lyric-content" class="stage-lyric-content">
        <!-- Nội dung lời bài hát chữ lớn được render tại đây -->
      </div>
    </div>

  </main>

  <!-- Snap to Host Floating Button -->
  <button id="btn-snap-to-host" class="btn-snap-to-host hidden" title="Bấm để cuộn ngay về vị trí Ca Trưởng đang đứng">
    <span class="snap-icon">🔄</span>
    <span id="snap-label">Quay về Ca Trưởng (Đang ở Ô 1)</span>
  </button>

  <!-- Floating Live Cue Alert Banner -->
  <div id="stage-cue-banner" class="stage-cue-banner hidden">
    <div class="cue-banner-box">
      <span class="cue-banner-icon" id="cue-banner-icon">⚡</span>
      <div class="cue-banner-text" id="cue-banner-text">Chuẩn bị vào Điệp Khúc</div>
    </div>
  </div>

  <!-- Giant Visual Count-In Overlay -->
  <div id="stage-countin-overlay" class="stage-countin-overlay hidden">
    <div class="countin-center-box">
      <div class="countin-number" id="countin-giant-number">4</div>
      <div class="countin-subtext" id="countin-subtext">CHUẨN BỊ VÀO BÀI...</div>
      <div class="countin-dots" id="countin-dots">
        <span class="countin-dot active"></span>
        <span class="countin-dot"></span>
        <span class="countin-dot"></span>
        <span class="countin-dot"></span>
      </div>
    </div>
  </div>

  <!-- ══════════════ 5. MODAL ROOM MANAGEMENT & QR CODE ══════════════ -->
  <div id="modal-live-room" class="stage-modal-overlay hidden">
    <div class="stage-modal-card">
      <div class="stage-modal-header">
        <div class="modal-header-title">
          <span class="modal-icon">📡</span>
          <h3>Quản Lý Phòng Biểu Diễn Trực Tiếp</h3>
        </div>
        <button id="btn-close-room-modal" class="stage-modal-close">&times;</button>
      </div>

      <div class="stage-modal-tabs">
        <button class="modal-tab-btn active" data-target="#tab-host-panel">👑 Mở Phòng (Ca Trưởng)</button>
        <button class="modal-tab-btn" data-target="#tab-join-panel">🔗 Tham Gia (Nhạc Công)</button>
      </div>

      <div class="stage-modal-body">
        
        <!-- TAB 1: HOST PANEL -->
        <div id="tab-host-panel" class="modal-tab-pane active">
          <div id="host-setup-view">
            <p class="modal-help-text">Mở phòng phát sóng. Toàn bộ máy thành viên sẽ tự động nhận bài, đổi tông và cuộn theo vị trí của bạn.</p>
            <div class="form-row">
              <label for="host-room-input" class="form-label">Mã phòng mong muốn:</label>
              <div class="input-with-action">
                <input type="text" id="host-room-input" class="form-input text-uppercase font-bold" placeholder="VD: BAND-2026" maxlength="16">
                <button id="btn-submit-create-host" class="btn btn-primary">Mở Phòng Ngay</button>
              </div>
              <small class="text-muted">Để trống để hệ thống tự sinh mã phòng ngẫu nhiên.</small>
            </div>
          </div>

          <div id="host-active-view" class="hidden">
            <div class="active-room-box">
              <div class="active-room-label">MÃ PHÒNG PHÁT SÓNG</div>
              <div id="display-room-code" class="display-room-code">BAND-2026</div>
              <div class="active-room-status">● Đang phát sóng thời gian thực</div>
            </div>

            <!-- QR Code Section -->
            <div class="qr-preview-container">
              <canvas id="stage-qr-canvas" width="220" height="220"></canvas>
              <div class="qr-hint">Quét mã bằng Camera điện thoại/iPad để tham gia tức thì</div>
              <button id="btn-fullscreen-qr" class="btn btn-outline btn-xs mt-half">🔍 Phóng to QR toàn màn hình</button>
            </div>

            <!-- Share Link Box -->
            <div class="share-link-group">
              <label class="form-label">Link tham gia 1-chạm:</label>
              <div class="input-with-action">
                <input type="text" id="share-link-input" class="form-input text-sm" readonly>
                <button id="btn-copy-share-link" class="btn btn-secondary">📋 Sao chép</button>
              </div>
            </div>

            <!-- Member Roster List -->
            <div class="roster-preview-group">
              <div class="roster-header-row">
                <span class="font-bold text-sm">Thành viên kết nối: <span id="modal-roster-total">1</span></span>
                <span id="modal-roster-details" class="text-xs text-muted">👑 Ca Trưởng</span>
              </div>
            </div>

            <div class="modal-actions-row">
              <button id="btn-host-leave-room" class="btn btn-danger w-full">🛑 Đóng Phòng / Rời Khỏi</button>
            </div>
          </div>
        </div>

        <!-- TAB 2: JOIN PANEL -->
        <div id="tab-join-panel" class="modal-tab-pane">
          <p class="modal-help-text">Nhập mã phòng do Ca Trưởng cung cấp hoặc quét mã QR để đồng bộ màn hình biểu diễn.</p>
          <div class="form-row">
            <label for="join-room-input" class="form-label">Nhập Mã Phòng:</label>
            <div class="input-with-action">
              <input type="text" id="join-room-input" class="form-input text-uppercase font-bold" placeholder="Nhập mã (VD: BAND-2026)">
              <button id="btn-submit-join-room" class="btn btn-success">🔗 Tham Gia</button>
            </div>
          </div>

          <div id="join-active-status" class="hidden mt-1">
            <div class="active-room-box" style="border-color: #10b981;">
              <div class="active-room-label" style="color: #10b981;">ĐÃ KẾT NỐI VÀO PHÒNG</div>
              <div id="display-joined-room" class="display-room-code" style="color: #10b981;">BAND-2026</div>
              <div class="active-room-status" style="color: #10b981;">● Đang tự động đồng bộ theo Ca Trưởng</div>
            </div>
            <button id="btn-follower-leave-room" class="btn btn-danger w-full mt-1">👋 Rời Khỏi Phòng</button>
          </div>
        </div>

      </div>
    </div>
  </div>

  <!-- ══════════════ 6. FULLSCREEN QR MODAL ══════════════ -->
  <div id="modal-fullscreen-qr-overlay" class="fullscreen-qr-overlay hidden">
    <div class="fullscreen-qr-card">
      <button id="btn-close-fs-qr" class="fullscreen-qr-close">&times;</button>
      <h2 class="fs-qr-title">Quét Mã Tham Gia Ban Nhạc</h2>
      <div class="fs-qr-room-badge" id="fs-qr-room-code">BAND-2026</div>
      <canvas id="fs-qr-canvas" width="340" height="340"></canvas>
      <p class="fs-qr-caption">Mở Camera trên iPad / Điện thoại quét mã để vào phòng tự động</p>
    </div>
  </div>

  <!-- ══════════════ 7. SETLIST PICKER MODAL (FOR HOST) ══════════════ -->
  <div id="modal-pick-setlist" class="stage-modal-overlay hidden">
    <div class="stage-modal-card" style="max-width: 520px;">
      <div class="stage-modal-header">
        <div class="modal-header-title">
          <span class="modal-icon">📋</span>
          <h3>Chọn Setlist Biểu Diễn</h3>
        </div>
        <button id="btn-close-setlist-modal" class="stage-modal-close">&times;</button>
      </div>
      <div class="stage-modal-body">
        <p class="modal-help-text">Chọn chương trình lễ hoặc buổi diễn để nạp nhanh danh sách bài hát vào bàn điều khiển Ca Trưởng.</p>
        <div id="setlist-picker-list" class="setlist-picker-list">
          <div class="text-muted text-center py-1">Đang tải danh sách setlist...</div>
        </div>
      </div>
    </div>
  </div>

  <!-- ══════════════ 8. STAGE AUDIO & HARDWARE SETTINGS MODAL ══════════════ -->
  <div id="modal-stage-audio-settings" class="stage-modal-overlay hidden">
    <div class="stage-modal-card" style="max-width: 560px;">
      <div class="stage-modal-header">
        <div class="modal-header-title">
          <span class="modal-icon">⚙️</span>
          <h3>Cài Đặt Âm Thanh & Thiết Bị Sân Khấu</h3>
        </div>
        <button id="btn-close-audio-settings" class="stage-modal-close">&times;</button>
      </div>
      <div class="stage-modal-body">
        
        <!-- Section 1: In-Ear Stereo Split Matrix -->
        <div class="settings-group-box">
          <div class="settings-group-title">🎧 Tai Nghe In-Ear Stereo Split (Tách Kênh Sân Khấu)</div>
          <p class="settings-group-desc">Xuất âm thanh riêng biệt: Kênh Trái (L) chỉ nghe Click nhịp và hiệu lệnh Cue; Kênh Phải (R) chỉ nghe nhạc đệm Ambient Pad không lọt tiếng click ra dàn loa lớn.</p>
          <div class="toggle-setting-row">
            <label for="toggle-stereo-split" class="setting-label">Bật Chế Độ Tách Kênh (L: Click / R: Nhạc)</label>
            <input type="checkbox" id="toggle-stereo-split" class="stage-toggle-checkbox">
          </div>
        </div>

        <!-- Section 2: Ambient Pad Synth Settings -->
        <div class="settings-group-box">
          <div class="settings-group-title">🎹 Đệm Nền Ambient Pad Drone</div>
          <p class="settings-group-desc">Tự động phát sóng âm nền ấm áp theo Tông bài hát để kết nối liền mạch các bài hát, loại bỏ khoảng lặng chết.</p>
          <div class="form-row">
            <label class="setting-label">Âm lượng Pad:</label>
            <div class="slider-with-val">
              <input type="range" id="pad-volume-slider" min="0" max="100" value="65" class="stage-range-slider">
              <span id="pad-volume-val" class="slider-val-badge">65%</span>
            </div>
          </div>
          <div class="toggle-setting-row mt-half">
            <label for="toggle-pad-autokey" class="setting-label">Tự động đổi tông Pad theo bài hát</label>
            <input type="checkbox" id="toggle-pad-autokey" class="stage-toggle-checkbox" checked>
          </div>
        </div>

        <!-- Section 3: Bluetooth Foot Pedal Guide -->
        <div class="settings-group-box">
          <div class="settings-group-title">🦶 Bàn Đạp Chân (Bluetooth Foot Pedal & MIDI)</div>
          <p class="settings-group-desc">Tương thích các dòng AirTurn, PageFlip, Donner, Coda STOMP hoặc bàn phím Bluetooth. Không cần chạm tay vào màn hình.</p>
          <div class="pedal-key-guide">
            <div class="pedal-guide-item"><span>Pedal Phải / PageDown / Mũi tên phải:</span> <strong>Tiến ô nhịp / Sang đoạn kế</strong></div>
            <div class="pedal-guide-item"><span>Pedal Trái / PageUp / Mũi tên trái:</span> <strong>Lùi ô nhịp / Đoạn trước</strong></div>
            <div class="pedal-guide-item"><span>Phím Cách (Spacebar):</span> <strong>Kích hoạt Đếm Nhịp Vào (Count-In)</strong></div>
          </div>
          <div class="mt-half text-center">
            <button id="btn-test-pedal-action" class="btn btn-outline btn-xs">Kiểm tra giẫm Pedal thử nghiệm</button>
          </div>
        </div>

      </div>
    </div>
  </div>

  <!-- ══════════════ 9. SERVICE COUNTDOWN TIMER MODAL ══════════════ -->
  <div id="modal-stage-timer-settings" class="stage-modal-overlay hidden">
    <div class="stage-modal-card" style="max-width: 440px;">
      <div class="stage-modal-header">
        <div class="modal-header-title">
          <span class="modal-icon">⏱️</span>
          <h3>Đồng Hồ Đếm Thời Gian Sân Khấu</h3>
        </div>
        <button id="btn-close-timer-modal" class="stage-modal-close">&times;</button>
      </div>
      <div class="stage-modal-body">
        <p class="settings-group-desc">Cài đặt giờ đếm ngược trước giờ khai lễ hoặc theo dõi thời lượng buổi biểu diễn.</p>
        
        <div class="timer-quick-presets">
          <button class="btn btn-sm btn-secondary timer-preset-btn" data-minutes="5">5 Phút</button>
          <button class="btn btn-sm btn-secondary timer-preset-btn" data-minutes="10">10 Phút</button>
          <button class="btn btn-sm btn-secondary timer-preset-btn" data-minutes="15">15 Phút</button>
          <button class="btn btn-sm btn-secondary timer-preset-btn" data-minutes="30">30 Phút</button>
        </div>

        <div class="form-row mt-1">
          <label for="timer-custom-minutes" class="form-label">Hoặc nhập số phút đếm ngược:</label>
          <div class="input-with-action">
            <input type="number" id="timer-custom-minutes" class="form-input text-center font-bold" min="1" max="180" value="10">
            <button id="btn-start-countdown" class="btn btn-primary">Bắt Đầu Đếm</button>
          </div>
        </div>

        <div class="modal-actions-row mt-1">
          <button id="btn-start-stopwatch" class="btn btn-outline w-full">⏱️ Chuyển Sang Đếm Xuôi (Bấm Giờ)</button>
          <button id="btn-reset-timer" class="btn btn-danger w-full mt-half">Dừng / Đặt Lại</button>
        </div>
      </div>
    </div>
  </div>

</div><!-- /#live-band-app -->

<!-- ══════════════ VENDORS & DEPENDENCIES ══════════════ -->
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

<!-- Core Application Shared Infrastructure -->
<?php
echo liveBandJsTag('assets/js/core/EventBus.js', false);
echo liveBandJsTag('assets/js/core/Store.js', false);
echo liveBandJsTag('assets/js/core/ApiService.js', false);
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
echo liveBandJsTag('live-band/live-band.js', true);
?>

</body>
</html>
