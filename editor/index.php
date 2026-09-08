<?php
/**
 * editor/index.php — SheetApp MusicXML Note Editor Pro (Ultra-Simplified)
 * Tối giản · Tập trung nốt nhạc · 3 Bước: Chọn nốt -> Chọn bè -> Chỉnh cao độ/trường độ
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
  <title>SheetApp · Biên Tập Nốt Nhạc (4 Bè SATB)</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Fira+Code:wght@500;600;700&display=swap" rel="stylesheet">
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
      <button id="btn-select-song" class="btn-song-picker" title="Chọn bài hát khác (Tìm trong 903 bài)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
        <span id="current-song-label">Đang nạp bài hát...</span>
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

      <!-- Phím tắt nhanh -->
      <button id="btn-open-shortcut-modal" class="btn-shortcut-guide" title="Bảng tra cứu phím tắt">
        <span>⌨ Phím tắt</span>
      </button>

      <!-- Nút Lưu Phiên Bản -->
      <button id="btn-open-save-modal" class="btn-save-xml" title="Lưu phiên bản sheet nhạc">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/></svg>
        <span>LƯU BẢN SỬA</span>
      </button>
    </div>
  </header>

  <!-- ==================== 2. MAIN WORKSPACE: BẢN NHẠC + CARD SỬA NỐT ==================== -->
  <div class="editor-main-layout">
    
    <!-- CỘT TRÁI: BẢN NHẠC TOÀN DIỆN (80% KHÔNG GIAN) -->
    <main class="sheet-canvas-wrapper" id="sheet-wrapper">
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
    </main>

    <!-- CỘT PHẢI: BẢNG CHỈNH NỐT TRỌNG TÂM (FOCUS ON NOTE) -->
    <aside class="note-inspector-sidebar inspector-body" id="note-inspector">
      
      <!-- Tiêu đề & Vị trí nốt đang chọn -->
      <div class="inspector-card-header">
        <div class="inspector-pos-info">
          <span class="badge-title">CHỈNH SỬA NỐT</span>
          <span id="pos-info-label" class="pos-badge">Ô nhịp: <strong>1</strong> | Phách: <strong>1/4</strong></span>
        </div>
        <span id="unsaved-status-badge" class="badge-clean">Đã đồng bộ</span>
      </div>

      <!-- Cảnh báo ô nhịp (nếu thiếu hoặc thừa phách) -->
      <div id="measure-alert-chip" class="measure-alert-chip hidden">
        <span id="measure-alert-text">⚠️ Thiếu phách</span>
        <button id="btn-quick-autofill" class="btn-quick-fix-auto" title="Tự động bù dấu lặng cho ô nhịp này">⚡ Bù tự động</button>
      </div>

      <!-- BƯỚC 1: CHỌN 1 TRONG 4 BÈ SATB -->
      <div class="inspector-section">
        <div class="section-label">
          <span class="step-num">1</span>
          <span>BÈ CẦN SỬA (BẤM ĐỂ CHỌN):</span>
        </div>
        <div class="satb-voice-grid" role="tablist">
          <button class="voice-card-btn satb-tab-btn active" data-voice="soprano" id="tab-soprano" title="Khóa Sol - Nốt trên (Phím 1)">
            <div class="voice-card-top">
              <span class="voice-badge badge-s">1. Soprano</span>
            </div>
            <div class="voice-card-pitch" id="lbl-pitch-soprano">--</div>
          </button>

          <button class="voice-card-btn satb-tab-btn" data-voice="alto" id="tab-alto" title="Khóa Sol - Nốt dưới (Phím 2)">
            <div class="voice-card-top">
              <span class="voice-badge badge-a">2. Alto</span>
            </div>
            <div class="voice-card-pitch" id="lbl-pitch-alto">--</div>
          </button>

          <button class="voice-card-btn satb-tab-btn" data-voice="tenor" id="tab-tenor" title="Khóa Fa - Nốt trên (Phím 3)">
            <div class="voice-card-top">
              <span class="voice-badge badge-t">3. Tenor</span>
            </div>
            <div class="voice-card-pitch" id="lbl-pitch-tenor">--</div>
          </button>

          <button class="voice-card-btn satb-tab-btn" data-voice="bass" id="tab-bass" title="Khóa Fa - Nốt dưới (Phím 4)">
            <div class="voice-card-top">
              <span class="voice-badge badge-b">4. Bass</span>
            </div>
            <div class="voice-card-pitch" id="lbl-pitch-bass">--</div>
          </button>
        </div>
      </div>

      <!-- BƯỚC 2: CHỈNH CAO ĐỘ (PITCH) -->
      <div class="inspector-section">
        <div class="section-label">
          <span class="step-num">2</span>
          <span>CHỈNH CAO ĐỘ (BẤM HOẶC KÉO CHUỘT):</span>
        </div>

        <!-- 7 Phím nốt Đồ..Si to rõ ràng -->
        <div class="pitch-key-buttons">
          <button class="btn-step btn-pitch-solfa" data-step="C"><strong>Đồ</strong><span>C</span></button>
          <button class="btn-step btn-pitch-solfa" data-step="D"><strong>Rê</strong><span>D</span></button>
          <button class="btn-step btn-pitch-solfa" data-step="E"><strong>Mi</strong><span>E</span></button>
          <button class="btn-step btn-pitch-solfa" data-step="F"><strong>Fa</strong><span>F</span></button>
          <button class="btn-step btn-pitch-solfa" data-step="G"><strong>Sol</strong><span>G</span></button>
          <button class="btn-step btn-pitch-solfa" data-step="A"><strong>La</strong><span>A</span></button>
          <button class="btn-step btn-pitch-solfa" data-step="B"><strong>Si</strong><span>B</span></button>
        </div>

        <!-- Quãng 8 & Dấu Hóa & Nửa Cung -->
        <div class="pitch-modifier-row">
          <div class="octave-control">
            <button id="btn-oct-dec" class="btn-oct-action" title="Hạ 1 quãng tám (Shift+Down)">▼</button>
            <span class="oct-display">Quãng <strong id="current-octave-val">4</strong></span>
            <button id="btn-oct-inc" class="btn-oct-action" title="Tăng 1 quãng tám (Shift+Up)">▲</button>
          </div>

          <div class="accidental-buttons">
            <button class="btn-acc" data-acc="flat" title="Dấu Giáng (♭)">♭</button>
            <button class="btn-acc active" data-acc="natural" title="Dấu Bình (♮)">♮</button>
            <button class="btn-acc" data-acc="sharp" title="Dấu Thăng (♯)">♯</button>
          </div>

          <div class="semitone-control">
            <button id="btn-semi-dec" class="btn-oct-action btn-semitone" title="Hạ nửa cung (Alt+Down)">♭−</button>
            <button id="btn-semi-inc" class="btn-oct-action btn-semitone" title="Tăng nửa cung (Alt+Up)">♯+</button>
          </div>
        </div>

        <!-- Bàn phím Piano ảo mini trực quan -->
        <div class="mini-piano-card" id="mini-piano-card">
          <div class="mini-piano-header">
            <span class="piano-title">
              <svg viewBox="0 0 24 24" fill="currentColor" style="width:13px;height:13px;vertical-align:-2px;margin-right:4px;"><path d="M20 5H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-9 10H9v-5h2v5zm4 0h-2v-5h2v5zm4 0h-2v-5h2v5z"/></svg>
              PIANO ẢO (C3 — B5)
            </span>
            <button type="button" id="btn-toggle-mini-piano" class="btn-toggle-piano" title="Thu gọn/Mở rộng phím đàn">Thu gọn ▲</button>
          </div>
          <div id="mini-piano" class="mini-piano-keys"></div>
        </div>

        <!-- Mẹo kéo thả trực tiếp -->
        <div class="drag-hint-box">
          <span>💡 Hoặc <strong>kéo chuột thẳng đứng</strong> trên nốt để đổi cao độ</span>
        </div>
      </div>

      <!-- BƯỚC 3: TRƯỜNG ĐỘ & THAO TÁC AN TOÀN -->
      <div class="inspector-section">
        <div class="section-label">
          <span class="step-num">3</span>
          <span>TRƯỜNG ĐỘ & THAO TÁC:</span>
        </div>

        <div class="duration-buttons-grid">
          <button class="btn-dur-card" data-dur="whole" title="Nốt Tròn (4 phách) [Phím 6]">
            <span class="dur-glyph">
              <svg width="20" height="15" viewBox="0 0 24 16" fill="none" stroke="currentColor" stroke-width="2.5"><ellipse cx="12" cy="8" rx="8" ry="5" transform="rotate(-15 12 8)"/></svg>
            </span>
            <span class="dur-name">Tròn (4)</span>
          </button>
          <button class="btn-dur-card" data-dur="half" title="Nốt Trắng (2 phách) [Phím 5]">
            <span class="dur-glyph">
              <svg width="15" height="20" viewBox="0 0 16 24" fill="none" stroke="currentColor"><ellipse cx="6" cy="18" rx="5" ry="3.5" stroke-width="2" transform="rotate(-20 6 18)"/><line x1="11" y1="18" x2="11" y2="3" stroke-width="2"/></svg>
            </span>
            <span class="dur-name">Trắng (2)</span>
          </button>
          <button class="btn-dur-card active" data-dur="quarter" title="Nốt Đen (1 phách) [Phím 4]">
            <span class="dur-glyph">
              <svg width="15" height="20" viewBox="0 0 16 24" fill="currentColor" stroke="currentColor"><ellipse cx="6" cy="18" rx="5" ry="3.5" transform="rotate(-20 6 18)"/><line x1="11" y1="18" x2="11" y2="3" stroke-width="2"/></svg>
            </span>
            <span class="dur-name">Đen (1)</span>
          </button>
          <button class="btn-dur-card" data-dur="eighth" title="Nốt Móc Đơn (1/2 phách) [Phím 3]">
            <span class="dur-glyph">
              <svg width="16" height="20" viewBox="0 0 18 24" fill="currentColor" stroke="currentColor"><ellipse cx="6" cy="18" rx="5" ry="3.5" transform="rotate(-20 6 18)"/><line x1="11" y1="18" x2="11" y2="3" stroke-width="2"/><path d="M11 3 C15 5 17 9 16 13" fill="none" stroke-width="2"/></svg>
            </span>
            <span class="dur-name">Móc (1/2)</span>
          </button>
          <button class="btn-dur-card" data-dur="16th" title="Nốt Móc Kép (1/4 phách) [Phím 2]">
            <span class="dur-glyph">
              <svg width="18" height="20" viewBox="0 0 20 24" fill="currentColor" stroke="currentColor"><ellipse cx="6" cy="18" rx="5" ry="3.5" transform="rotate(-20 6 18)"/><line x1="11" y1="18" x2="11" y2="3" stroke-width="2"/><path d="M11 3 C15 5 18 8 17 11" fill="none" stroke-width="2"/><path d="M11 7 C15 9 18 12 17 15" fill="none" stroke-width="2"/></svg>
            </span>
            <span class="dur-name">Kép (1/4)</span>
          </button>
        </div>

        <div class="action-extra-row">
          <button class="btn-action-tool" id="btn-pal-dot" title="Dấu Chấm Dôi (•) [Phím .]">• Chấm</button>
          <button class="btn-action-tool" id="btn-pal-tie" title="Dấu Nối (Tie) [Phím T]">‿ Nối</button>
          <button class="btn-action-tool" id="btn-pal-slur" title="Dấu Luyến (Slur)">⁀ Luyến</button>
          <button class="btn-action-tool" id="btn-pal-staccato" title="Dấu Ngắt (Staccato)">• Ngắt</button>
          <button class="btn-action-tool" id="btn-pal-accent" title="Dấu Nhấn (Accent)">&gt; Nhấn</button>
          <button class="btn-action-tool" id="btn-pal-tenuto" title="Dấu Ngân Đủ (Tenuto)">— Giữ</button>
          <button class="btn-action-tool" id="btn-pal-fermata" title="Dấu Miễn Nhịp (Fermata)">𝄐 Lưu</button>
          <button class="btn-action-tool" id="btn-pal-tuplet" title="Liên 3 (Tuplet)">³ Liên 3</button>
        </div>

        <!-- THAO TÁC THÊM NỐT & SAO CHÉP -->
        <div class="note-insert-action-box">
          <div class="insert-box-title">THÊM NỐT & DẤU LẶNG:</div>
          <div class="insert-buttons-grid">
            <button type="button" class="btn-insert-tool btn-insert-highlight" id="btn-insert-note-after" title="Thêm nốt mới ngay sau nốt đang chọn">+ Thêm sau</button>
            <button type="button" class="btn-insert-tool" id="btn-insert-note-before" title="Thêm nốt mới ngay trước nốt đang chọn">+ Thêm trước</button>
            <button type="button" class="btn-insert-tool" id="btn-insert-rest-after" title="Thêm dấu lặng mới vào bè này">+ Thêm lặng</button>
            <button type="button" class="btn-insert-tool" id="btn-duplicate-note" title="Nhân bản nốt này sang phách tiếp theo">📋 Nhân bản</button>
          </div>
        </div>

        <div class="action-extra-row" style="margin-top: 5px;">
          <button class="btn-action-tool btn-danger-tone" id="btn-pal-delete-rest" title="Xóa nốt thành Dấu Lặng (Bảo toàn 100% phách) [Delete]">𝄽 Thành lặng</button>
          <button class="btn-action-tool btn-danger-tone" id="btn-hard-delete-note" title="Xóa hẳn nốt khỏi ô nhịp (Xóa bỏ nốt thừa) [Shift+Delete]">🗑 Xóa hẳn nốt</button>
          <button class="btn-action-tool" id="btn-pal-split-note" title="Tách nốt: Chia đôi nốt để thêm nốt mới">✂️ Tách nốt</button>
          <button class="btn-action-tool btn-accent-tone" id="btn-auto-fix-all-rests" title="Tự động bù dấu lặng cho toàn bộ bản nhạc">⚡ Bù tất cả</button>
        </div>
      </div>

      <!-- ĐIỀU HƯỚNG & NGHE THỬ -->
      <div class="inspector-section">
        <div class="section-label">
          <span>ĐIỀU HƯỚNG & NGHE THỬ:</span>
        </div>
        <div class="playback-action-grid">
          <button id="btn-nav-prev-note" class="btn-nav-step" title="Nốt trước">◀ Trước</button>
          <button id="btn-play-single" class="btn-play-tone" title="Phát âm thanh nốt này">🔊 Nghe nốt</button>
          <button id="btn-play-chord" class="btn-play-tone btn-chord" title="Phát cả 4 bè tại nốt này (Phím Space)">▶ Nghe 4 bè</button>
          <button id="btn-nav-next-note" class="btn-nav-step" title="Nốt sau">Sau ▶</button>
        </div>
      </div>

      <!-- QUẢN LÝ Ô NHỊP -->
      <div class="inspector-section">
        <div class="section-label">
          <span>CẤU TRÚC Ô NHỊP:</span>
        </div>
        <div class="measure-manage-row">
          <button id="btn-add-measure-after" class="btn-measure-tool" title="Thêm ô nhịp sau ô hiện tại">+ Thêm ô</button>
          <button id="btn-del-measure" class="btn-measure-tool btn-measure-del" title="Xóa ô nhịp hiện tại">- Xóa ô</button>
          <select id="select-time-sig" class="select-time-sig" title="Đổi số chỉ nhịp">
            <option value="">Nhịp...</option>
            <option value="2/4">2/4</option>
            <option value="3/4">3/4</option>
            <option value="4/4">4/4</option>
            <option value="6/8">6/8</option>
          </select>
        </div>
      </div>

      <!-- LỜI CA (LYRICS) -->
      <div class="inspector-section lyric-section">
        <div class="section-label">
          <span>LỜI CA (NHẤN SPACE HOẶC '-' ĐỂ NHẢY NỐT):</span>
        </div>
        <div class="lyric-input-group">
          <input type="text" id="input-note-lyric" class="input-lyric-field" placeholder="Nhập từ ca..." autocomplete="off">
          <button id="btn-apply-lyric" class="btn-apply-lyric-btn">Lưu</button>
        </div>
      </div>

      <!-- CÁC THẺ ẨN ĐỂ ĐẢM BẢO TƯƠNG THÍCH HOÀN TOÀN VỚI JS -->
      <div id="health-summary-badge" style="display:none;"></div>
      <div id="measure-strip-pills" style="display:none;"></div>

    </aside>
  </div>

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

  <!-- ==================== MODAL HƯỚNG DẪN PHÍM TẮT ==================== -->
  <div id="shortcut-guide-modal" class="modal-backdrop hidden">
    <div class="modal-dialog shortcut-guide-dialog">
      <div class="modal-header">
        <div class="modal-header-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;vertical-align:-3px;margin-right:6px;"><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="6" y1="8" x2="6" y2="8"/><line x1="10" y1="8" x2="10" y2="8"/><line x1="14" y1="8" x2="14" y2="8"/><line x1="18" y1="8" x2="18" y2="8"/><line x1="6" y1="12" x2="6" y2="12"/><line x1="10" y1="12" x2="10" y2="12"/><line x1="14" y1="12" x2="14" y2="12"/><line x1="18" y1="12" x2="18" y2="12"/><line x1="8" y1="16" x2="16" y2="16"/></svg>
          <span>Bảng Tra Cứu Phím Tắt Soạn Nhạc Nhanh</span>
        </div>
        <button id="btn-close-shortcut-modal" class="btn-modal-close" title="Đóng">&times;</button>
      </div>
      <div class="modal-content-shortcut">
        <div class="shortcut-grid-sections">
          <div class="shortcut-col">
            <div class="shortcut-block">
              <h4>1. Chọn Bè SATB</h4>
              <div class="shortcut-row"><kbd>1</kbd><span>Bè 1 Soprano</span></div>
              <div class="shortcut-row"><kbd>2</kbd><span>Bè 2 Alto</span></div>
              <div class="shortcut-row"><kbd>3</kbd><span>Bè 3 Tenor</span></div>
              <div class="shortcut-row"><kbd>4</kbd><span>Bè 4 Bass</span></div>
            </div>

            <div class="shortcut-block">
              <h4>2. Chọn Trường Độ</h4>
              <div class="shortcut-row"><kbd>6</kbd><span>Nốt Tròn (4 phách)</span></div>
              <div class="shortcut-row"><kbd>5</kbd><span>Nốt Trắng (2 phách)</span></div>
              <div class="shortcut-row"><kbd>4</kbd><span>Nốt Đen (1 phách)</span></div>
              <div class="shortcut-row"><kbd>3</kbd><span>Nốt Móc đơn (1/2)</span></div>
              <div class="shortcut-row"><kbd>2</kbd><span>Nốt Móc kép (1/4)</span></div>
              <div class="shortcut-row"><kbd>.</kbd><span>Bật/tắt Dấu Chấm Dôi</span></div>
            </div>
          </div>

          <div class="shortcut-col">
            <div class="shortcut-block">
              <h4>3. Chỉnh Cao Độ (Pitch)</h4>
              <div class="shortcut-row"><kbd>C D E F G A B</kbd><span>Đổi cao độ (hoặc đổi lặng thành nốt)</span></div>
              <div class="shortcut-row"><kbd>↑</kbd> / <kbd>↓</kbd><span>Tăng / giảm nửa cung (Semitone)</span></div>
              <div class="shortcut-row"><kbd>Shift + ↑ / ↓</kbd><span>Tăng / giảm 1 quãng 8 (Octave)</span></div>
              <div class="shortcut-row"><kbd>Kéo chuột</kbd><span>Kéo thẳng đứng trên nốt để đổi cao độ</span></div>
              <div class="shortcut-row"><kbd>Piano Ảo</kbd><span>Bấm phím đàn để đổi cao độ tức thì</span></div>
            </div>

            <div class="shortcut-block">
              <h4>4. Thao Tác & Điều Hướng</h4>
              <div class="shortcut-row"><kbd>←</kbd> / <kbd>→</kbd><span>Đi tới nốt trước / sau</span></div>
              <div class="shortcut-row"><kbd>Space</kbd><span>Nghe thử hợp âm 4 bè tại nốt</span></div>
              <div class="shortcut-row"><kbd>Delete</kbd><span>Xóa nốt thành dấu lặng</span></div>
              <div class="shortcut-row"><kbd>Shift + Del</kbd><span>Xóa hẳn nốt khỏi ô nhịp</span></div>
              <div class="shortcut-row"><kbd>T</kbd><span>Bật / tắt dấu nối (Tie)</span></div>
              <div class="shortcut-row"><kbd>Ctrl + Z / Y</kbd><span>Hoàn tác / Làm lại</span></div>
              <div class="shortcut-row"><kbd>Ctrl + S</kbd><span>Lưu bản sửa</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Toast -->
  <div id="editor-toast" class="editor-toast hidden"></div>

  <!-- Script điều khiển -->
  <script src="editor.js?v=<?php echo time(); ?>"></script>
</body>
</html>
