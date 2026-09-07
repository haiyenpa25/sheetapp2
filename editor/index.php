<?php
/**
 * editor/index.php — SheetApp MusicXML Visual Note Editor
 * Chỉnh sửa toàn diện 4 bè SATB (2 nốt khóa Sol, 2 nốt khóa Fa)
 * Bảo toàn bản gốc · Quản lý phiên bản theo user · Kéo thả thẳng đứng · Cảnh báo đủ ô nhịp
 */
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
require_once __DIR__ . '/../api/core/Auth.php';
$currentUser = Auth::username() ?: 'banhat';
$userRole    = Auth::role();
$isLoggedIn  = Auth::isLoggedIn();
?>
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>SheetApp · MusicXML Note Editor (4 Bè SATB Pro)</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Fira+Code:wght@500;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/assets/css/base.css">
  <link rel="stylesheet" href="editor.css?v=<?php echo time(); ?>">
  <!-- OpenSheetMusicDisplay Vendor -->
  <script src="/assets/js/vendor/opensheetmusicdisplay.min.js"></script>
</head>
<body class="editor-body">

  <!-- ==================== TOP NAVIGATION ==================== -->
  <header class="editor-header">
    <div class="header-left">
      <a href="/" class="btn-back-home" title="Quay lại SheetApp">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        <span>Trang chính</span>
      </a>
      <div class="editor-brand">
        <span class="brand-badge">PRO EDITOR</span>
        <h1 class="brand-title">Biên Tập Sheet Nhạc 4 Bè SATB</h1>
      </div>
    </div>

    <!-- Chọn bài hát & Chọn phiên bản -->
    <div class="header-center">
      <!-- Nút chọn bài hát -->
      <button id="btn-select-song" class="btn-song-picker" title="Chọn bài hát khác">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
        <span id="current-song-label">Đang tải bài hát...</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;"><path d="M6 9l6 6 6-6"/></svg>
      </button>

      <button id="btn-prev-song" class="btn-nav-song" title="Bài trước (Alt + [)">‹</button>
      <button id="btn-next-song" class="btn-nav-song" title="Bài sau (Alt + ])">›</button>

      <!-- Bộ chọn phiên bản của bài hát hiện tại -->
      <div class="version-selector-wrap" style="position:relative;">
        <button id="btn-editor-version" class="btn-version-picker" title="Chọn hoặc đổi phiên bản">
          <span id="editor-version-icon">⭐️</span>
          <span id="editor-version-label">Bản Gốc (Master)</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        <div id="editor-version-dropdown" class="dropdown-menu hidden">
          <div class="dropdown-ver-header">CÁC PHIÊN BẢN CỦA BÀI NÀY</div>
          <div id="editor-version-items-list" class="ver-items-list">
            <!-- Nạp động qua JS -->
          </div>
        </div>
      </div>
    </div>

    <div class="header-right">
      <!-- User info tag -->
      <div class="user-badge" title="Tài khoản đang đăng nhập">
        <span class="user-dot"></span>
        <span id="user-badge-name"><?php echo htmlspecialchars($currentUser); ?></span>
      </div>

      <!-- Undo / Redo -->
      <div class="btn-group">
        <button id="btn-undo" class="btn-icon-top" title="Hoàn tác (Ctrl+Z)" disabled>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>
        </button>
        <button id="btn-redo" class="btn-icon-top" title="Làm lại (Ctrl+Y)" disabled>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"/></svg>
        </button>
      </div>

      <!-- Zoom controls -->
      <div class="btn-group zoom-group">
        <button id="btn-zoom-out" class="btn-icon-top" title="Thu nhỏ">−</button>
        <span id="zoom-label" class="zoom-text">100%</span>
        <button id="btn-zoom-in" class="btn-icon-top" title="Phóng to">+</button>
      </div>

      <!-- Nút Lưu phiên bản -->
      <button id="btn-open-save-modal" class="btn-save-xml" title="Lưu phiên bản sheet nhạc của bạn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
        <span>LƯU PHIÊN BẢN</span>
      </button>
    </div>
  </header>

  <!-- ==================== SECONDARY TOOLBAR (MUSIC PALETTE & STRUCTURE) ==================== -->
  <nav class="music-palette-bar" id="music-palette">
    <!-- Nhóm 1: Trường độ nốt -->
    <div class="palette-group">
      <span class="palette-group-title">TRƯỜNG ĐỘ</span>
      <button class="palette-btn" data-dur="whole" title="Nốt Tròn (4 phách) [Phím 6]">𝅝</button>
      <button class="palette-btn" data-dur="half" title="Nốt Trắng (2 phách) [Phím 5]">𝅗𝅥</button>
      <button class="palette-btn active" data-dur="quarter" title="Nốt Đen (1 phách) [Phím 4]">𝅘𝅥</button>
      <button class="palette-btn" data-dur="eighth" title="Nốt Móc Đơn (1/2 phách) [Phím 3]">𝅘𝅥𝅯</button>
      <button class="palette-btn" data-dur="16th" title="Nốt Móc Đôi (1/4 phách) [Phím 2]">𝅘𝅥𝅰</button>
      <button class="palette-btn" id="btn-pal-dot" title="Dấu Chấm Dôi (Tăng 1.5 lần) [Phím .]">•</button>
      <button class="palette-btn" id="btn-pal-double-dot" title="Dấu Chấm Dôi Kép (••)">••</button>
    </div>

    <!-- Nhóm 2: Dấu hóa -->
    <div class="palette-group">
      <span class="palette-group-title">DẤU HÓA</span>
      <button class="palette-btn" data-acc="flat" title="Dấu Giáng (♭)">♭</button>
      <button class="palette-btn active" data-acc="natural" title="Dấu Bình (♮)">♮</button>
      <button class="palette-btn" data-acc="sharp" title="Dấu Thăng (♯)">♯</button>
    </div>

    <!-- Nhóm 3: Dấu Nối, Luyến, Liên ba & Mắt ngỗng -->
    <div class="palette-group">
      <span class="palette-group-title">KÝ HIỆU NHẠC</span>
      <button class="palette-btn" id="btn-pal-tie" title="Dấu Nối Âm (Tie) [Phím T]">⌢ Nối</button>
      <button class="palette-btn" id="btn-pal-slur" title="Dấu Luyến (Slur)">⌒ Luyến</button>
      <button class="palette-btn" id="btn-pal-tuplet" title="Liên Ba (Triplet - 3 nốt gom 2 phách)">³ Liên 3</button>
      <button class="palette-btn" id="btn-pal-fermata" title="Dấu Mắt Ngỗng (Fermata - Ngân tự do)">𝄐</button>
      <button class="palette-btn" id="btn-pal-staccato" title="Dấu Ngắt (Staccato)">· Ngắt</button>
      <button class="palette-btn" id="btn-pal-accent" title="Dấu Nhấn (Accent)">&gt; Nhấn</button>
    </div>

    <!-- Nhóm 4: Thao tác nốt an toàn -->
    <div class="palette-group">
      <span class="palette-group-title">THAO TÁC NỐT</span>
      <button class="palette-btn btn-danger-soft" id="btn-pal-delete-rest" title="Xóa thành Dấu Lặng (Bảo toàn 100% phách) [Delete]">𝄽 Xóa nốt</button>
      <button class="palette-btn" id="btn-pal-split-note" title="Tách Phách (Chia đôi nốt hiện tại để thêm nốt mới mà không vỡ ô nhịp)">✂️ Tách phách</button>
    </div>

    <!-- Nhóm 5: Cấu trúc ô nhịp -->
    <div class="palette-group">
      <span class="palette-group-title">Ô NHỊP & CẤU TRÚC</span>
      <button class="palette-btn" id="btn-add-measure-before" title="Chèn thêm 1 ô nhịp vào trước ô hiện tại">+ Ô trước</button>
      <button class="palette-btn" id="btn-add-measure-after" title="Chèn thêm 1 ô nhịp vào sau ô hiện tại">+ Ô sau</button>
      <button class="palette-btn btn-danger-soft" id="btn-del-measure" title="Xóa bỏ ô nhịp hiện tại">- Xóa ô</button>
      
      <!-- Đổi nhịp nhanh -->
      <select id="select-time-sig" class="palette-select" title="Đổi số chỉ nhịp (Time Signature)">
        <option value="">Nhịp...</option>
        <option value="4/4">4/4 (Thông dụng)</option>
        <option value="3/4">3/4 (Nhịp valse)</option>
        <option value="2/4">2/4 (Nhịp hành khúc)</option>
        <option value="6/8">6/8 (Nhịp 6/8)</option>
      </select>
    </div>
  </nav>

  <!-- ==================== MAIN WORKSPACE ==================== -->
  <main class="editor-workspace">

    <!-- KHU VỰC HIỂN THỊ SHEET NHẠC -->
    <section class="sheet-canvas-wrapper" id="sheet-wrapper">
      <div id="loading-overlay" class="loading-overlay">
        <div class="spinner"></div>
        <div id="loading-text" class="loading-text">Đang nạp bản nhạc MusicXML...</div>
      </div>

      <!-- Overlay nốt bóng kéo thả thẳng đứng (Vertical Drag Ghost Indicator) -->
      <div id="drag-ghost-overlay" class="drag-ghost-overlay hidden">
        <div id="drag-ghost-badge" class="drag-ghost-badge">G4</div>
        <div id="drag-guide-line" class="drag-guide-line"></div>
      </div>

      <!-- Container OSMD -->
      <div id="osmd-editor-container" class="osmd-editor-container"></div>
    </section>

    <!-- DẢI BĂNG THEO DÕI SỨC KHỎE Ô NHỊP TOÀN BÀI (MEASURE HEALTH STRIP) -->
    <section class="measure-health-bar" id="measure-health-bar">
      <div class="health-bar-info">
        <span class="health-title">KIỂM TRA Ô NHỊP:</span>
        <span id="health-summary-badge" class="badge-health-ok">100% Ô nhịp đủ phách</span>
        <button id="btn-auto-fix-all-rests" class="btn-auto-fix hidden" title="Tự động thêm dấu lặng bù đủ tất cả các ô nhịp đang thiếu phách">
          ⚡ Tự động bù dấu lặng tất cả
        </button>
      </div>
      <div id="measure-strip-pills" class="measure-strip-pills">
        <!-- Danh sách ô nhịp mini-map nạp động -->
      </div>
    </section>

    <!-- BẢNG ĐIỀU KHIỂN CHỈNH SỬA 4 BÈ SATB (BOTTOM INSPECTOR) -->
    <aside class="satb-inspector-panel" id="satb-panel">
      
      <!-- Header thanh thông tin vị trí -->
      <div class="inspector-header">
        <div class="inspector-title">
          <span class="badge-accent">CHỈNH SỬA NỐT</span>
          <span id="pos-info-label" class="pos-info">Ô nhịp: <strong>1</strong> | Phách: <strong>1</strong></span>
          <span id="unsaved-status-badge" class="badge-clean">Đã đồng bộ</span>
          <span id="measure-alert-chip" class="measure-alert-chip hidden">⚠️ Thiếu phách</span>
        </div>

        <!-- 4 Tab Bè SATB độc lập -->
        <div class="satb-tabs" role="tablist">
          <button class="satb-tab-btn active" data-voice="soprano" id="tab-soprano" title="Khóa Sol - Nốt trên (Phím 1)">
            <span class="voice-dot dot-soprano"></span>
            <span class="voice-name">1. Soprano</span>
            <span class="voice-pitch-label" id="lbl-pitch-soprano">--</span>
          </button>
          <button class="satb-tab-btn" data-voice="alto" id="tab-alto" title="Khóa Sol - Nốt dưới (Phím 2)">
            <span class="voice-dot dot-alto"></span>
            <span class="voice-name">2. Alto</span>
            <span class="voice-pitch-label" id="lbl-pitch-alto">--</span>
          </button>
          <button class="satb-tab-btn" data-voice="tenor" id="tab-tenor" title="Khóa Fa - Nốt trên (Phím 3)">
            <span class="voice-dot dot-tenor"></span>
            <span class="voice-name">3. Tenor</span>
            <span class="voice-pitch-label" id="lbl-pitch-tenor">--</span>
          </button>
          <button class="satb-tab-btn" data-voice="bass" id="tab-bass" title="Khóa Fa - Nốt dưới (Phím 4)">
            <span class="voice-dot dot-bass"></span>
            <span class="voice-name">4. Bass</span>
            <span class="voice-pitch-label" id="lbl-pitch-bass">--</span>
          </button>
        </div>
      </div>

      <!-- Thân bảng điều khiển -->
      <div class="inspector-body">

        <!-- Cột 1: Cao Độ & Quãng 8 -->
        <div class="control-box">
          <div class="control-box-title">🎵 CAO ĐỘ (PITCH)</div>
          <div class="pitch-step-selector">
            <button class="btn-step" data-step="C">Đô<small>C</small></button>
            <button class="btn-step" data-step="D">Rê<small>D</small></button>
            <button class="btn-step" data-step="E">Mi<small>E</small></button>
            <button class="btn-step" data-step="F">Fa<small>F</small></button>
            <button class="btn-step" data-step="G">Sol<small>G</small></button>
            <button class="btn-step" data-step="A">La<small>A</small></button>
            <button class="btn-step" data-step="B">Si<small>B</small></button>
          </div>
          
          <div class="octave-selector">
            <span class="octave-title">Quãng 8:</span>
            <button id="btn-oct-dec" class="btn-oct-nav" title="Hạ 1 quãng tám">▼</button>
            <span id="current-octave-val" class="octave-val">4</span>
            <button id="btn-oct-inc" class="btn-oct-nav" title="Tăng 1 quãng tám">▲</button>
            <div class="octave-quick-pills">
              <button class="pill-oct" data-oct="2">2</button>
              <button class="pill-oct" data-oct="3">3</button>
              <button class="pill-oct active" data-oct="4">4</button>
              <button class="pill-oct" data-oct="5">5</button>
              <button class="pill-oct" data-oct="6">6</button>
            </div>
          </div>
        </div>

        <!-- Cột 2: BỘ TRỘN ÂM THANH 4 BÈ SATB (AUDIO SYNTH MIXER) -->
        <div class="control-box mixer-box">
          <div class="control-box-title">🎛️ BỘ TRỘN 4 BÈ SATB (MIXER & KIỂM ÂM)</div>
          <div class="satb-mixer-channels">
            <!-- Soprano -->
            <div class="mixer-channel" id="mixer-soprano">
              <span class="ch-name">Soprano</span>
              <input type="range" class="ch-volume" min="0" max="1" step="0.05" value="0.85" title="Âm lượng Soprano">
              <div class="ch-buttons">
                <button class="btn-solo" data-voice="soprano" title="Solo: Chỉ nghe riêng bè Soprano">S</button>
                <button class="btn-mute" data-voice="soprano" title="Mute: Tắt tiếng bè Soprano">M</button>
              </div>
            </div>
            <!-- Alto -->
            <div class="mixer-channel" id="mixer-alto">
              <span class="ch-name">Alto</span>
              <input type="range" class="ch-volume" min="0" max="1" step="0.05" value="0.85" title="Âm lượng Alto">
              <div class="ch-buttons">
                <button class="btn-solo" data-voice="alto" title="Solo: Chỉ nghe riêng bè Alto">S</button>
                <button class="btn-mute" data-voice="alto" title="Mute: Tắt tiếng bè Alto">M</button>
              </div>
            </div>
            <!-- Tenor -->
            <div class="mixer-channel" id="mixer-tenor">
              <span class="ch-name">Tenor</span>
              <input type="range" class="ch-volume" min="0" max="1" step="0.05" value="0.85" title="Âm lượng Tenor">
              <div class="ch-buttons">
                <button class="btn-solo" data-voice="tenor" title="Solo: Chỉ nghe riêng bè Tenor">S</button>
                <button class="btn-mute" data-voice="tenor" title="Mute: Tắt tiếng bè Tenor">M</button>
              </div>
            </div>
            <!-- Bass -->
            <div class="mixer-channel" id="mixer-bass">
              <span class="ch-name">Bass</span>
              <input type="range" class="ch-volume" min="0" max="1" step="0.05" value="0.85" title="Âm lượng Bass">
              <div class="ch-buttons">
                <button class="btn-solo" data-voice="bass" title="Solo: Chỉ nghe riêng bè Bass">S</button>
                <button class="btn-mute" data-voice="bass" title="Mute: Tắt tiếng bè Bass">M</button>
              </div>
            </div>
          </div>

          <!-- Controls phụ: Tempo BPM & Nút phát -->
          <div class="mixer-footer-controls">
            <div class="tempo-control-wrap">
              <span class="tempo-label">Tốc độ: <strong id="val-tempo">90</strong> BPM</span>
              <input type="range" id="slider-tempo" min="40" max="200" step="2" value="90">
            </div>
            <div class="mixer-action-btns">
              <button id="btn-mixer-play-chord" class="btn-m-action" title="Phát hòa âm 4 bè tại nốt đang chọn">▶ Nghe 4 bè</button>
              <button id="btn-mixer-play-measure" class="btn-m-action" title="Phát toàn bộ ô nhịp">▶ Ô nhịp</button>
              <button id="btn-mixer-metronome" class="btn-m-action" title="Bật/Tắt gõ nhịp">🔔 Metronome</button>
            </div>
          </div>
        </div>

        <!-- Cột 3: Lời Ca & Thao Tác Nốt -->
        <div class="control-box">
          <div class="control-box-title">⚙️ ĐIỀU HƯỚNG & LỜI CA</div>
          <div class="action-btn-row">
            <button id="btn-nav-prev-note" class="btn-inspector-action btn-nav" title="Nốt trước (Phím ←)">
              <span>◀ Trước</span>
            </button>
            <button id="btn-play-single" class="btn-inspector-action btn-single-play" title="Phát nghe thử nốt này">
              <span>🔊 Thử nốt</span>
            </button>
            <button id="btn-nav-next-note" class="btn-inspector-action btn-nav" title="Nốt sau (Phím →)">
              <span>Sau ▶</span>
            </button>
          </div>

          <!-- Lời bài hát gắn dưới nốt -->
          <div class="lyric-edit-box">
            <label for="input-note-lyric" class="lyric-label">Lời ca (Bấm Space hoặc '-' để nhảy nốt):</label>
            <div class="lyric-input-wrap">
              <input type="text" id="input-note-lyric" class="input-lyric" placeholder="Nhập từ ca..." autocomplete="off">
              <button id="btn-apply-lyric" class="btn-apply-lyric">Lưu</button>
            </div>
          </div>
        </div>

        <!-- Cột 4: Bàn Phím Piano Ảo Mini -->
        <div class="control-box piano-box">
          <div class="control-box-title">🎹 BÀN PHÍM PIANO ẢO (BẤM ĐỔI NỐT & NGHE)</div>
          <div class="mini-piano-keyboard" id="mini-piano">
            <!-- Piano keys rendered by JS -->
          </div>
        </div>

      </div>
    </aside>

  </main>

  <!-- ==================== MODAL LƯU PHIÊN BẢN (VERSION SAVE MODAL) ==================== -->
  <div id="save-version-modal" class="modal-backdrop hidden">
    <div class="modal-dialog save-version-dialog">
      <div class="modal-header">
        <div class="modal-header-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          <span>Lưu Phiên Bản Sheet Nhạc (Tài khoản: <strong><?php echo htmlspecialchars($currentUser); ?></strong>)</span>
        </div>
        <button id="btn-close-save-modal" class="btn-modal-close" title="Đóng">&times;</button>
      </div>

      <div class="modal-content-save">
        <div class="save-notice-box">
          <span class="notice-icon">🛡️</span>
          <div class="notice-text">
            <strong>Bản gốc bất biến:</strong> Bản gốc của bài hát luôn được giữ an toàn 100%. Các thay đổi của bạn sẽ được lưu thành phiên bản riêng để ban hát cùng sử dụng.
          </div>
        </div>

        <!-- Cảnh báo nếu ô nhịp đang thiếu/thừa phách -->
        <div id="save-measure-warning-box" class="save-warning-box hidden">
          <span class="warn-icon">⚠️</span>
          <div class="warn-text">
            <strong id="save-warning-text">Có ô nhịp chưa chuẩn phách!</strong>
            <button id="btn-modal-autofill-rests" class="btn-text-autofill">Bấm vào đây để tự động bù dấu lặng</button>
          </div>
        </div>

        <!-- Lựa chọn ghi đè hoặc tạo mới -->
        <div class="save-choice-group">
          <label class="choice-option" id="label-choice-overwrite">
            <input type="radio" name="save-mode" value="overwrite" id="radio-save-overwrite">
            <div class="choice-content">
              <strong>Ghi đè lên phiên bản hiện tại</strong>
              <span class="choice-sub" id="choice-overwrite-sub">Cập nhật nội dung mới vào phiên bản bạn đang chỉnh sửa (tự động tạo bản backup .bak).</span>
            </div>
          </label>

          <label class="choice-option selected" id="label-choice-new">
            <input type="radio" name="save-mode" value="new" id="radio-save-new" checked>
            <div class="choice-content">
              <strong>Tạo một phiên bản MỚI cho bài hát này</strong>
              <span class="choice-sub">Tạo ra 1 bản sao mới độc lập, không làm ảnh hưởng đến các phiên bản trước.</span>
            </div>
          </label>
        </div>

        <!-- Tên phiên bản -->
        <div class="form-group-save">
          <label for="input-version-name" class="form-label-save">Tên phiên bản gợi nhớ:</label>
          <input type="text" id="input-version-name" class="form-input-save" placeholder="Ví dụ: Bản tập dượt Lễ Phục Sinh, Bản chỉnh bè Alto...">
        </div>

        <!-- Ghi chú phiên bản -->
        <div class="form-group-save">
          <label for="input-version-desc" class="form-label-save">Ghi chú thay đổi (tuỳ chọn):</label>
          <textarea id="input-version-desc" class="form-textarea-save" rows="2" placeholder="Ví dụ: Đã sửa nốt bè Soprano ở ô nhịp 4, hạ bè Alto 1 nốt..."></textarea>
        </div>
      </div>

      <div class="modal-footer">
        <button id="btn-cancel-save" class="btn-modal-cancel">Hủy bỏ</button>
        <button id="btn-confirm-save-version" class="btn-modal-confirm">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/></svg>
          <span>XÁC NHẬN LƯU</span>
        </button>
      </div>
    </div>
  </div>

  <!-- ==================== MODAL CHỌN BÀI HÁT ==================== -->
  <div id="song-picker-modal" class="modal-backdrop hidden">
    <div class="modal-dialog">
      <div class="modal-header">
        <div class="modal-header-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
          <span>Chọn Bản Nhạc Cần Biên Tập (903 Bài)</span>
        </div>
        <button id="btn-close-picker-modal" class="btn-modal-close" title="Đóng">&times;</button>
      </div>
      <div class="modal-search-box">
        <input type="text" id="song-search-input" class="search-input" placeholder="Tìm theo tên bài hát hoặc số thứ tự (vd: 225, Tâm hồn tôi)..." autofocus>
      </div>
      <div class="modal-song-list" id="modal-song-list">
        <!-- Danh sách bài hát nạp qua JS -->
      </div>
    </div>
  </div>

  <!-- Toast thông báo -->
  <div id="editor-toast" class="editor-toast hidden"></div>

  <!-- Script điều khiển -->
  <script src="editor.js?v=<?php echo time(); ?>"></script>
</body>
</html>
