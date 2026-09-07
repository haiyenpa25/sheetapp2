<?php
/**
 * editor/index.php — SheetApp MusicXML Visual Note Editor Pro
 * Tinh gọn · Tập trung vào bản nhạc · Kéo thả nốt trực tiếp · 4 Bè SATB độc lập
 */
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
require_once __DIR__ . '/../api/core/Auth.php';
$currentUser = Auth::username() ?: 'banhat';
?>
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>SheetApp · MusicXML Note Editor (4 Bè SATB)</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Fira+Code:wght@500;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/assets/css/base.css">
  <link rel="stylesheet" href="editor.css?v=<?php echo time(); ?>">
  <!-- OpenSheetMusicDisplay Vendor -->
  <script src="/assets/js/vendor/opensheetmusicdisplay.min.js"></script>
</head>
<body class="editor-body">

  <!-- ==================== 1. TOP HEADER (TINH GỌN) ==================== -->
  <header class="editor-header">
    <div class="header-left">
      <a href="/" class="btn-back-home" title="Quay lại SheetApp">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        <span>SheetApp</span>
      </a>
      <span class="editor-title-badge">EDITOR 4 BÈ</span>
    </div>

    <!-- Chọn bài hát & Chọn phiên bản -->
    <div class="header-center">
      <button id="btn-select-song" class="btn-song-picker" title="Chọn bài hát khác">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
        <span id="current-song-label">Đang tải danh sách bài hát...</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;"><path d="M6 9l6 6 6-6"/></svg>
      </button>

      <button id="btn-prev-song" class="btn-nav-song" title="Bài trước (Alt + [)">‹</button>
      <button id="btn-next-song" class="btn-nav-song" title="Bài sau (Alt + ])">›</button>

      <!-- Dropdown Chọn phiên bản -->
      <div class="version-selector-wrap">
        <button id="btn-editor-version" class="btn-version-picker" title="Chọn phiên bản sheet nhạc">
          <span id="editor-version-icon">⭐️</span>
          <span id="editor-version-label">Bản Gốc</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:11px;height:11px;"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        <div id="editor-version-dropdown" class="dropdown-menu hidden">
          <div class="dropdown-ver-header">PHIÊN BẢN CỦA BÀI NÀY</div>
          <div id="editor-version-items-list" class="ver-items-list"></div>
        </div>
      </div>
    </div>

    <div class="header-right">
      <!-- Tag User -->
      <div class="user-badge" title="Tài khoản đang đăng nhập">
        <span class="user-dot"></span>
        <span id="user-badge-name"><?php echo htmlspecialchars($currentUser); ?></span>
      </div>

      <!-- Undo / Redo -->
      <div class="btn-group">
        <button id="btn-undo" class="btn-icon-top" title="Hoàn tác (Ctrl+Z)" disabled>↶</button>
        <button id="btn-redo" class="btn-icon-top" title="Làm lại (Ctrl+Y)" disabled>↷</button>
      </div>

      <!-- Zoom -->
      <div class="btn-group zoom-group">
        <button id="btn-zoom-out" class="btn-icon-top" title="Thu nhỏ">−</button>
        <span id="zoom-label" class="zoom-text">100%</span>
        <button id="btn-zoom-in" class="btn-icon-top" title="Phóng to">+</button>
      </div>

      <!-- Nút Lưu Phiên Bản -->
      <button id="btn-open-save-modal" class="btn-save-xml" title="Lưu phiên bản sheet nhạc">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/></svg>
        <span>LƯU BẢN SỬA</span>
      </button>
    </div>
  </header>

  <!-- ==================== 2. SLEEK MUSIC PALETTE (THANH CÔNG CỤ TINH GỌN) ==================== -->
  <nav class="music-palette-bar" id="music-palette">
    <!-- Trường độ -->
    <div class="palette-cluster">
      <button class="palette-btn" data-dur="whole" title="Nốt Tròn (4 phách) [Phím 6]">𝅝</button>
      <button class="palette-btn" data-dur="half" title="Nốt Trắng (2 phách) [Phím 5]">𝅗𝅥</button>
      <button class="palette-btn active" data-dur="quarter" title="Nốt Đen (1 phách) [Phím 4]">𝅘𝅥</button>
      <button class="palette-btn" data-dur="eighth" title="Nốt Móc Đơn (1/2 phách) [Phím 3]">𝅘𝅥𝅯</button>
      <button class="palette-btn" data-dur="16th" title="Nốt Móc Đôi (1/4 phách) [Phím 2]">𝅘𝅥𝅰</button>
      <button class="palette-btn" id="btn-pal-dot" title="Dấu Chấm Dôi (•) [Phím .]">•</button>
    </div>

    <div class="palette-divider"></div>

    <!-- Dấu hóa -->
    <div class="palette-cluster">
      <button class="palette-btn" data-acc="flat" title="Dấu Giáng (♭)">♭</button>
      <button class="palette-btn active" data-acc="natural" title="Dấu Bình (♮)">♮</button>
      <button class="palette-btn" data-acc="sharp" title="Dấu Thăng (♯)">♯</button>
    </div>

    <div class="palette-divider"></div>

    <!-- Ký hiệu nhạc -->
    <div class="palette-cluster">
      <button class="palette-btn" id="btn-pal-tie" title="Dấu Nối Âm (Tie) [Phím T]">⌢ Nối</button>
      <button class="palette-btn" id="btn-pal-slur" title="Dấu Luyến (Slur)">⌒ Luyến</button>
      <button class="palette-btn" id="btn-pal-tuplet" title="Liên Ba (Triplet - 3 nốt gom 2 phách)">³ Liên 3</button>
      <button class="palette-btn" id="btn-pal-fermata" title="Dấu Mắt Ngỗng (Fermata)">𝄐</button>
    </div>

    <div class="palette-divider"></div>

    <!-- Thao tác nốt an toàn -->
    <div class="palette-cluster">
      <button class="palette-btn btn-danger-soft" id="btn-pal-delete-rest" title="Xóa nốt thành Dấu Lặng (Bảo toàn 100% phách) [Delete]">𝄽 Xóa nốt</button>
      <button class="palette-btn" id="btn-pal-split-note" title="Tách Phách: Chia đôi nốt để chèn nốt mới">✂️ Tách nốt</button>
    </div>

    <div class="palette-divider"></div>

    <!-- Cấu trúc ô nhịp -->
    <div class="palette-cluster">
      <button class="palette-btn" id="btn-add-measure-after" title="Chèn thêm 1 ô nhịp vào sau">+ Ô nhịp</button>
      <button class="palette-btn btn-danger-soft" id="btn-del-measure" title="Xóa ô nhịp hiện tại">- Xóa ô</button>
      <select id="select-time-sig" class="palette-select" title="Đổi số chỉ nhịp">
        <option value="">Nhịp...</option>
        <option value="4/4">4/4</option>
        <option value="3/4">3/4</option>
        <option value="2/4">2/4</option>
        <option value="6/8">6/8</option>
      </select>
    </div>

    <!-- Hướng dẫn kéo thả chuột thẳng đứng -->
    <div class="palette-tip">
      <span>💡 Kéo chuột lên/xuống trực tiếp trên nốt để đổi cao độ</span>
    </div>
  </nav>

  <!-- ==================== 3. KHU VỰC BẢN NHẠC (CHÍNH - RỘNG RÃI) ==================== -->
  <main class="editor-workspace">
    <section class="sheet-canvas-wrapper" id="sheet-wrapper">
      <div id="loading-overlay" class="loading-overlay">
        <div class="spinner"></div>
        <div id="loading-text" class="loading-text">Đang nạp bản nhạc MusicXML...</div>
      </div>

      <!-- Overlay nốt bóng khi kéo thả thẳng đứng -->
      <div id="drag-ghost-overlay" class="drag-ghost-overlay hidden">
        <div id="drag-ghost-badge" class="drag-ghost-badge">G4</div>
        <div id="drag-guide-line" class="drag-guide-line"></div>
      </div>

      <!-- Vùng hiển thị tờ sheet nhạc trắng trang nhã -->
      <div class="sheet-paper-container">
        <div id="osmd-editor-container" class="osmd-editor-container"></div>
      </div>
    </section>
  </main>

  <!-- ==================== 4. BẢNG ĐIỀU KHIỂN CHÂN TRANG (TABBED & COMPACT) ==================== -->
  <aside class="satb-inspector-panel" id="satb-panel">
    
    <!-- Header: Chọn bè & Đổi tab công cụ -->
    <div class="inspector-header">
      <div class="inspector-left-info">
        <span class="pos-badge" id="pos-info-label">Ô: <strong>1</strong> · Phách: <strong>1</strong></span>
        <span id="unsaved-status-badge" class="badge-clean">Đã đồng bộ</span>
        <!-- Cảnh báo ô nhịp -->
        <span id="measure-alert-chip" class="measure-alert-chip hidden">
          <span id="measure-alert-text">⚠️ Thiếu phách</span>
          <button id="btn-quick-autofill" class="btn-quick-fix" title="Bù dấu lặng cho ô nhịp này">⚡ Bù</button>
        </span>
      </div>

      <!-- 4 Tab Bè SATB độc lập -->
      <div class="satb-tabs" role="tablist">
        <button class="satb-tab-btn active" data-voice="soprano" id="tab-soprano" title="Khóa Sol - Nốt trên (Phím 1)">
          <span class="voice-dot dot-soprano"></span>
          <span>1. Soprano</span>
          <strong id="lbl-pitch-soprano">--</strong>
        </button>
        <button class="satb-tab-btn" data-voice="alto" id="tab-alto" title="Khóa Sol - Nốt dưới (Phím 2)">
          <span class="voice-dot dot-alto"></span>
          <span>2. Alto</span>
          <strong id="lbl-pitch-alto">--</strong>
        </button>
        <button class="satb-tab-btn" data-voice="tenor" id="tab-tenor" title="Khóa Fa - Nốt trên (Phím 3)">
          <span class="voice-dot dot-tenor"></span>
          <span>3. Tenor</span>
          <strong id="lbl-pitch-tenor">--</strong>
        </button>
        <button class="satb-tab-btn" data-voice="bass" id="tab-bass" title="Khóa Fa - Nốt dưới (Phím 4)">
          <span class="voice-dot dot-bass"></span>
          <span>4. Bass</span>
          <strong id="lbl-pitch-bass">--</strong>
        </button>
      </div>

      <!-- Bộ chọn Tab công cụ bên dưới & Nút thu gọn -->
      <div class="inspector-tool-tabs">
        <button class="tool-tab-btn active" data-tab="tab-notes" title="Chỉnh nốt, cao độ và lời ca">🎵 Nốt & Lời</button>
        <button class="tool-tab-btn" data-tab="tab-mixer" title="Bộ trộn âm thanh 4 bè SATB">🎛️ Mixer 4 Bè</button>
        <button class="tool-tab-btn" data-tab="tab-piano" title="Bàn phím Piano ảo">🎹 Piano</button>
        <button id="btn-toggle-panel-fold" class="btn-fold" title="Thu gọn / Mở rộng bảng điều khiển">▼</button>
      </div>
    </div>

    <!-- Thân bảng điều khiển (3 Tab riêng biệt) -->
    <div class="inspector-body" id="inspector-body">
      
      <!-- TAB 1: CHỈNH NỐT, CAO ĐỘ & LỜI CA (Mặc định) -->
      <div class="tool-pane active" id="pane-notes">
        <div class="pane-sub-box">
          <span class="box-sub-title">CAO ĐỘ:</span>
          <div class="pitch-step-selector">
            <button class="btn-step" data-step="C">C</button>
            <button class="btn-step" data-step="D">D</button>
            <button class="btn-step" data-step="E">E</button>
            <button class="btn-step" data-step="F">F</button>
            <button class="btn-step" data-step="G">G</button>
            <button class="btn-step" data-step="A">A</button>
            <button class="btn-step" data-step="B">B</button>
          </div>
          <div class="octave-mini-selector">
            <button id="btn-oct-dec" class="btn-oct-sm">▼</button>
            <span class="oct-label">Quãng: <strong id="current-octave-val">4</strong></span>
            <button id="btn-oct-inc" class="btn-oct-sm">▲</button>
          </div>
        </div>

        <div class="pane-sub-box">
          <span class="box-sub-title">ĐIỀU HƯỚNG & NGHE:</span>
          <div class="action-btn-row">
            <button id="btn-nav-prev-note" class="btn-sm-act">◀ Trước</button>
            <button id="btn-play-single" class="btn-sm-act btn-play-act">🔊 Nghe nốt</button>
            <button id="btn-play-chord" class="btn-sm-act btn-play-act">▶ Nghe 4 bè</button>
            <button id="btn-nav-next-note" class="btn-sm-act">Sau ▶</button>
          </div>
        </div>

        <div class="pane-sub-box lyric-sub-box">
          <span class="box-sub-title">LỜI CA (Gõ Space hoặc '-' để nhảy nốt):</span>
          <div class="lyric-input-wrap">
            <input type="text" id="input-note-lyric" class="input-lyric-compact" placeholder="Nhập từ ca..." autocomplete="off">
            <button id="btn-apply-lyric" class="btn-apply-compact">Lưu</button>
          </div>
        </div>
      </div>

      <!-- TAB 2: SATB AUDIO SYNTH MIXER -->
      <div class="tool-pane" id="pane-mixer">
        <div class="mixer-channels-compact">
          <div class="mixer-ch" id="mixer-soprano">
            <span class="ch-lbl ch-s">Soprano</span>
            <input type="range" class="ch-volume" min="0" max="1" step="0.05" value="0.85">
            <div class="ch-btns">
              <button class="btn-solo" data-voice="soprano" title="Solo">S</button>
              <button class="btn-mute" data-voice="soprano" title="Mute">M</button>
            </div>
          </div>
          <div class="mixer-ch" id="mixer-alto">
            <span class="ch-lbl ch-a">Alto</span>
            <input type="range" class="ch-volume" min="0" max="1" step="0.05" value="0.85">
            <div class="ch-btns">
              <button class="btn-solo" data-voice="alto" title="Solo">S</button>
              <button class="btn-mute" data-voice="alto" title="Mute">M</button>
            </div>
          </div>
          <div class="mixer-ch" id="mixer-tenor">
            <span class="ch-lbl ch-t">Tenor</span>
            <input type="range" class="ch-volume" min="0" max="1" step="0.05" value="0.85">
            <div class="ch-btns">
              <button class="btn-solo" data-voice="tenor" title="Solo">S</button>
              <button class="btn-mute" data-voice="tenor" title="Mute">M</button>
            </div>
          </div>
          <div class="mixer-ch" id="mixer-bass">
            <span class="ch-lbl ch-b">Bass</span>
            <input type="range" class="ch-volume" min="0" max="1" step="0.05" value="0.85">
            <div class="ch-btns">
              <button class="btn-solo" data-voice="bass" title="Solo">S</button>
              <button class="btn-mute" data-voice="bass" title="Mute">M</button>
            </div>
          </div>
        </div>

        <div class="mixer-controls-compact">
          <div class="tempo-box">
            <span>Tốc độ: <strong id="val-tempo">90</strong> BPM</span>
            <input type="range" id="slider-tempo" min="40" max="200" step="2" value="90">
          </div>
          <div class="playback-quick-btns">
            <button id="btn-mixer-play-chord" class="btn-m-act">▶ Nghe 4 bè</button>
            <button id="btn-mixer-play-measure" class="btn-m-act">▶ Nghe ô nhịp</button>
            <button id="btn-mixer-metronome" class="btn-m-act">🔔 Metronome</button>
          </div>
        </div>
      </div>

      <!-- TAB 3: BÀN PHÍM PIANO ẢO -->
      <div class="tool-pane" id="pane-piano">
        <div class="mini-piano-keyboard" id="mini-piano"></div>
      </div>

    </div>
  </aside>

  <!-- ==================== MODAL LƯU PHIÊN BẢN (VERSION SAVE MODAL) ==================== -->
  <div id="save-version-modal" class="modal-backdrop hidden">
    <div class="modal-dialog save-version-dialog">
      <div class="modal-header">
        <div class="modal-header-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/></svg>
          <span>Lưu Bản Chỉnh Sửa (Tài khoản: <strong><?php echo htmlspecialchars($currentUser); ?></strong>)</span>
        </div>
        <button id="btn-close-save-modal" class="btn-modal-close" title="Đóng">&times;</button>
      </div>

      <div class="modal-content-save">
        <div class="save-notice-box">
          <span class="notice-icon">🛡️</span>
          <div class="notice-text">
            <strong>Bản gốc luôn an toàn 100%:</strong> Các thay đổi sẽ được lưu thành phiên bản của tài khoản <strong><?php echo htmlspecialchars($currentUser); ?></strong> để sử dụng trong SheetApp.
          </div>
        </div>

        <!-- Cảnh báo nếu ô nhịp thiếu/thừa phách -->
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
              <strong>Ghi đè phiên bản hiện tại</strong>
              <span class="choice-sub" id="choice-overwrite-sub">Cập nhật nội dung mới vào phiên bản đang mở (có backup .bak).</span>
            </div>
          </label>

          <label class="choice-option selected" id="label-choice-new">
            <input type="radio" name="save-mode" value="new" id="radio-save-new" checked>
            <div class="choice-content">
              <strong>Tạo phiên bản MỚI</strong>
              <span class="choice-sub">Lưu thành bản độc lập mới.</span>
            </div>
          </label>
        </div>

        <!-- Tên phiên bản -->
        <div class="form-group-save">
          <label for="input-version-name" class="form-label-save">Tên phiên bản gợi nhớ:</label>
          <input type="text" id="input-version-name" class="form-input-save" placeholder="Ví dụ: Bản tập bè Alto, Bản hạ 1 cung...">
        </div>

        <!-- Ghi chú -->
        <div class="form-group-save">
          <label for="input-version-desc" class="form-label-save">Ghi chú (tuỳ chọn):</label>
          <textarea id="input-version-desc" class="form-textarea-save" rows="2" placeholder="Ví dụ: Sửa nốt bè Alto ô nhịp 3, 5..."></textarea>
        </div>
      </div>

      <div class="modal-footer">
        <button id="btn-cancel-save" class="btn-modal-cancel">Hủy bỏ</button>
        <button id="btn-confirm-save-version" class="btn-modal-confirm">
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
      <div class="modal-song-list" id="modal-song-list"></div>
    </div>
  </div>

  <!-- Toast -->
  <div id="editor-toast" class="editor-toast hidden"></div>

  <!-- Script điều khiển -->
  <script src="editor.js?v=<?php echo time(); ?>"></script>
</body>
</html>
