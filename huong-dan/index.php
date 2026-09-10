<?php
/**
 * SheetApp 2.0 — Trung Tâm Hướng Dẫn Sử Dụng (Interactive Documentation Hub)
 * Đường dẫn: https://sheet.hyb.io.vn/huong-dan/
 */
declare(strict_types=1);
?>
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Hướng Dẫn Sử Dụng SheetApp 2.0 — Cẩm Nang Toàn Diện</title>
  <meta name="description" content="Trung tâm hướng dẫn sử dụng toàn diện SheetApp 2.0: Đọc sheet, Soạn hợp âm, Dịch giọng, Live Band Studio, Luyện tập bè SATB, Visual MusicXML Editor.">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <link rel="stylesheet" href="/huong-dan/huong-dan.css?v=<?= time() ?>">
</head>
<body>

  <!-- ══════════════ 1. TOP HEADER & SEARCH ══════════════ -->
  <header class="docs-header">
    <div class="header-left">
      <button id="btn-sidebar-toggle" class="btn-sidebar-toggle" title="Mở danh mục hướng dẫn">☰</button>
      <a href="/huong-dan/" class="docs-brand">
        <span class="brand-icon">🎼</span>
        <span class="brand-title">SheetApp</span>
        <span class="brand-badge">Hướng Dẫn v2.0</span>
      </a>
    </div>

    <div class="header-center">
      <div class="search-box">
        <span class="search-icon">🔍</span>
        <input type="text" id="search-docs" class="search-input" placeholder="Tìm kiếm tính năng (VD: capo, break, tap tempo, a-b loop, pedal...)" aria-label="Tìm kiếm hướng dẫn">
        <button id="search-clear" class="search-clear" style="display: none;" title="Xóa tìm kiếm">✕</button>
      </div>
    </div>

    <div class="header-right">
      <a href="/" class="nav-link-btn btn-outline" title="Về trang đọc sheet chính">
        <span>📖</span>
        <span>Đọc Sheet</span>
      </a>
      <a href="/live-band/" class="nav-link-btn btn-primary" title="Mở phòng Live Band sân khấu">
        <span>📡</span>
        <span>Live Band</span>
      </a>
    </div>
  </header>

  <!-- ══════════════ 2. ROLE FILTER STRIP ══════════════ -->
  <nav class="role-filter-strip" aria-label="Lọc hướng dẫn theo vai trò">
    <span class="role-strip-label">Xem Theo Vai Trò:</span>
    <div class="role-pills-group">
      <button class="btn-role-filter active" data-role="all">👑 Tất Cả Tính Năng</button>
      <button class="btn-role-filter" data-role="leader">👑 Ca Trưởng / Trưởng Ban</button>
      <button class="btn-role-filter" data-role="musician">🎸 Nhạc Công (Guitar/Bass/Keys/Trống)</button>
      <button class="btn-role-filter" data-role="vocal">🎤 Ca Viên / Ca Đoàn</button>
      <button class="btn-role-filter" data-role="admin">🛠️ Quản Trị Viên (Admin)</button>
    </div>
  </nav>

  <!-- ══════════════ 3. MAIN LAYOUT (SIDEBAR + CONTENT) ══════════════ -->
  <div class="docs-layout">
    <!-- Mobile Backdrop -->
    <div id="sidebar-backdrop" class="docs-sidebar-backdrop"></div>

    <!-- Sticky Sidebar Navigation -->
    <aside id="docs-sidebar" class="docs-sidebar">
      <div class="sidebar-section-title">MỤC LỤC TÀI LIỆU</div>
      <ul class="sidebar-menu">
        <li>
          <a href="#mod-1" class="sidebar-link active">
            <span class="sidebar-icon">🚀</span>
            <span>1. Bắt Đầu Nhanh</span>
          </a>
        </li>
        <li>
          <a href="#mod-2" class="sidebar-link">
            <span class="sidebar-icon">📄</span>
            <span>2. Trình Đọc & Thu Phóng</span>
          </a>
        </li>
        <li>
          <a href="#mod-3" class="sidebar-link">
            <span class="sidebar-icon">🎸</span>
            <span>3. Hợp Âm & Dịch Giọng</span>
          </a>
        </li>
        <li>
          <a href="#mod-4" class="sidebar-link">
            <span class="sidebar-icon">⏱️</span>
            <span>4. Đếm Nhịp & TAP Tempo</span>
          </a>
        </li>
        <li>
          <a href="#mod-5" class="sidebar-link">
            <span class="sidebar-icon">📋</span>
            <span>5. Setlist & Sổ Bài Tập</span>
          </a>
        </li>
        <li>
          <a href="#mod-6" class="sidebar-link">
            <span class="sidebar-icon">📡</span>
            <span>6. Live Band Studio</span>
          </a>
        </li>
        <li>
          <a href="#mod-7" class="sidebar-link">
            <span class="sidebar-icon">🎓</span>
            <span>7. Smart Learning (Bè SATB)</span>
          </a>
        </li>
        <li>
          <a href="#mod-8" class="sidebar-link">
            <span class="sidebar-icon">✏️</span>
            <span>8. Sửa Sheet MusicXML</span>
          </a>
        </li>
        <li>
          <a href="#mod-9" class="sidebar-link">
            <span class="sidebar-icon">⌨️</span>
            <span>9. Phím Tắt & Sự Cố</span>
          </a>
        </li>
      </ul>
    </aside>

    <!-- Main Content Stream -->
    <main class="docs-content">

      <!-- Hero Introduction Banner -->
      <section class="docs-hero">
        <h1 class="hero-title">Cẩm Nang Hướng Dẫn Sử Dụng SheetApp 2.0</h1>
        <p class="hero-subtitle">
          Nền tảng số hóa bản nhạc Thánh Ca và điều khiển sân khấu trực tiếp chuyên nghiệp dành cho Ca Đoàn, Trưởng Ban và Nhạc Công. Tài liệu này cung cấp đầy đủ chi tiết từng tính năng từ cơ bản đến nâng cao.
        </p>
        <div class="hero-stats">
          <span class="stat-pill">Phiên bản: <strong>v2.0 (High-Performance)</strong></span>
          <span class="stat-pill">Số mô-đun: <strong>9 Chuyên Đề Bài Bản</strong></span>
          <span class="stat-pill">Hỗ trợ thiết bị: <strong>PC, iPad, Android, Pedal Bluetooth</strong></span>
        </div>
      </section>

      <!-- ══════════════════════════════════════════════════════════
           MÔ-ĐUN 1: TỔNG QUAN & BẮT ĐẦU NHANH
           ══════════════════════════════════════════════════════════ -->
      <section id="mod-1" class="docs-chapter">
        <div class="chapter-header">
          <span class="chapter-badge">CHƯƠNG 01</span>
          <h2 class="chapter-title">Tổng Quan & Bắt Đầu Nhanh</h2>
        </div>

        <div class="doc-card" data-roles="all">
          <h3 class="card-title"><span class="topic-icon">🌟</span> 1.1. Giới thiệu nền tảng SheetApp</h3>
          <p class="card-desc">
            SheetApp 2.0 là hệ thống ứng dụng Web tương tác hiệu năng cao được thiết kế nhằm mục đích thay thế hoàn toàn tập sách nhạc giấy truyền thống trong các buổi thờ phượng, thánh lễ và tập dượt ban nhạc. Ứng dụng chạy trực tiếp trên trình duyệt hiện đại (Chrome, Safari, Edge) mà không cần cài đặt phần mềm nặng, hỗ trợ mượt mà từ màn hình máy tính để bàn đến máy tính bảng iPad và điện thoại thông minh.
          </p>
          <div class="steps-grid">
            <div class="step-box">
              <span class="step-num">MỤC TIÊU 01</span>
              <div class="step-title">Hiển thị sắc nét mọi kích thước</div>
              <div class="step-text">Sử dụng định dạng chuẩn công nghiệp MusicXML render qua SVG vector, phóng to thu nhỏ không bao giờ bị vỡ nét.</div>
            </div>
            <div class="step-box">
              <span class="step-num">MỤC TIÊU 02</span>
              <div class="step-title">Hợp âm thông minh cho Nhạc công</div>
              <div class="step-text">Chèn hợp âm trực tiếp trên nốt nhạc, tự động nhận diện tông và gợi ý vị trí kẹp Capo chuẩn xác cho Guitar.</div>
            </div>
            <div class="step-box">
              <span class="step-num">MỤC TIÊU 03</span>
              <div class="step-title">Đồng bộ Live thời gian thực</div>
              <div class="step-text">Ca Trưởng chuyển bài hoặc cuộn trang, toàn bộ iPad của các nhạc công và ca viên tự động bắt nhịp theo dưới 0.3 giây.</div>
            </div>
          </div>
        </div>

        <div class="doc-card" data-roles="all leader admin">
          <h3 class="card-title"><span class="topic-icon">🔐</span> 1.2. Đăng nhập & Ba Cấp Bậc Phân Quyền</h3>
          <p class="card-desc">
            Hệ thống phân chia 3 cấp bậc tài khoản rõ ràng nhằm bảo vệ tính toàn vẹn của dữ liệu bản nhạc gốc:
          </p>
          <div class="doc-table-wrap">
            <table class="doc-table">
              <thead>
                <tr>
                  <th>Vai Trò (Role)</th>
                  <th>Đối Tượng</th>
                  <th>Quyền Hạn Cho Phép</th>
                  <th>Giới Hạn</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>👑 Admin</strong></td>
                  <td>Quản trị viên, Nhạc trưởng</td>
                  <td>Toàn quyền: Nạp bài hát mới, sửa nốt MusicXML, tạo Setlist chung, quản lý tài khoản thành viên.</td>
                  <td>Không giới hạn</td>
                </tr>
                <tr>
                  <td><strong>🎸 Ban Hát (<code>banhat</code>)</strong></td>
                  <td>Nhạc công, Ca viên chính thức</td>
                  <td>Tạo bộ hợp âm cá nhân riêng, ghi chú bài tập, tạo Setlist cá nhân, mở phòng Live Band.</td>
                  <td>Không được xóa bài hát gốc và bộ hợp âm mặc định TLH/HD.</td>
                </tr>
                <tr>
                  <td><strong>👀 Viewer (Khách)</strong></td>
                  <td>Thành viên tham dự, Khách</td>
                  <td>Xem sheet nhạc, đổi tông nghe thử, bật máy đếm nhịp, kết nối phòng Live theo dõi.</td>
                  <td>Chỉ đọc (Read-only), không lưu trữ thay đổi lên máy chủ.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="doc-card" data-roles="all">
          <h3 class="card-title"><span class="topic-icon">🔍</span> 1.3. Tìm kiếm & Lọc Bài Hát Thông Minh</h3>
          <p class="card-desc">
            Thanh tìm kiếm tại trang chủ hỗ trợ công nghệ tìm kiếm mở rộng (Fuzzy Search), không phân biệt chữ hoa, chữ thường hay dấu tiếng Việt:
          </p>
          <div class="steps-grid">
            <div class="step-box">
              <span class="step-num">CÁCH 1</span>
              <div class="step-title">Tìm theo số bài Thánh Ca</div>
              <div class="step-text">Gõ trực tiếp số bài (VD: <code>1</code>, <code>001</code>, <code>23</code>) để mở ngay bài hát theo số thứ tự sách Thánh Ca.</div>
            </div>
            <div class="step-box">
              <span class="step-num">CÁCH 2</span>
              <div class="step-title">Tìm theo tựa đề không dấu</div>
              <div class="step-text">Gõ <code>nguoi ta xua nay</code> hoặc <code>ton vinh ba ngoi</code> hệ thống vẫn nhận diện chuẩn xác.</div>
            </div>
            <div class="step-box">
              <span class="step-num">CÁCH 3</span>
              <div class="step-title">Lọc theo chuyên mục lễ</div>
              <div class="step-text">Bấm vào các thẻ phân loại: <em>Giáng Sinh</em>, <em>Phục Sinh</em>, <em>Thờ Phượng</em>, <em>Khai Lễ</em> để xem danh sách thu gọn.</div>
            </div>
          </div>
        </div>

        <div class="doc-card" data-roles="all">
          <h3 class="card-title"><span class="topic-icon">📱</span> 1.4. Cài đặt App lên iPad / Điện thoại (PWA Ngoại Tuyến)</h3>
          <p class="card-desc">
            SheetApp tích hợp công nghệ Progressive Web App (PWA) kèm Service Worker, cho phép cài đặt biểu tượng ứng dụng ra màn hình chính và lưu bộ nhớ đệm ngoại tuyến (Offline) khi nhà thờ mất mạng Internet:
          </p>
          <div class="callout callout-tip">
            <div class="callout-title">💡 Hướng dẫn cài đặt 1 chạm:</div>
            • <strong>Trên iPhone / iPad (Safari):</strong> Bấm nút <strong>Chia sẻ (Share)</strong> ở góc dưới trình duyệt → Chọn <strong>"Thêm vào Màn hình chính" (Add to Home Screen)</strong>.<br>
            • <strong>Trên Android (Chrome):</strong> Bấm biểu tượng <strong>3 chấm góc phải</strong> → Chọn <strong>"Cài đặt ứng dụng" (Install App)</strong> hoặc "Thêm vào màn hình chính".
          </div>
        </div>
      </section>

      <!-- ══════════════════════════════════════════════════════════
           MÔ-ĐUN 2: TRÌNH ĐỌC SHEET & TÙY BIẾN HIỂN THỊ
           ══════════════════════════════════════════════════════════ -->
      <section id="mod-2" class="docs-chapter">
        <div class="chapter-header">
          <span class="chapter-badge">CHƯƠNG 02</span>
          <h2 class="chapter-title">Trình Đọc Sheet & Tùy Biến Hiển Thị</h2>
        </div>

        <div class="doc-card" data-roles="all musician vocal">
          <h3 class="card-title"><span class="topic-icon">🔍</span> 2.1. Thu Phóng Bản Nhạc & Nút Khóa Zoom (Lock Zoom 🔒)</h3>
          <p class="card-desc">
            Bản nhạc có thể được tùy chỉnh kích thước hiển thị từ 80% đến 200% bằng nút <code>−</code> và <code>+</code> trên thanh công cụ.
          </p>
          <div class="callout callout-important">
            <div class="callout-title">🔒 Tính Năng Độc Quyền: KHÓA TỶ LỆ ZOOM (Lock Zoom)</div>
            Trên các thiết bị iPad hoặc máy tính bảng di động, khi đã căn chỉnh độ lớn nốt nhạc vừa mắt (ví dụ: 140%), hãy bấm vào nút <strong>"Khóa Zoom 🔒"</strong>. Khi chuyển đổi qua các bài hát khác trong suốt buổi biểu diễn, hệ thống sẽ <strong>giữ nguyên tỷ lệ 140%</strong> mà không tự động co giãn lại, giúp mắt không phải điều tiết nhiều lần.
          </div>
        </div>

        <div class="doc-card" data-roles="all musician vocal">
          <h3 class="card-title"><span class="topic-icon">🎛️</span> 2.2. Chế Độ Gọn Nhẹ 7 Tùy Chọn (Compact Mode)</h3>
          <p class="card-desc">
            Không phải ai cũng cần xem toàn bộ 4 bè và khóa Fa. Menu Chế Độ Gọn Nhẹ cho phép từng nhạc công và ca sĩ tùy biến những gì hiển thị trên màn hình của mình:
          </p>
          <div class="steps-grid">
            <div class="step-box">
              <div class="step-title">1. Ẩn Khóa Fa (Bass Clef)</div>
              <div class="step-text">Ẩn hoàn toàn khuông nhạc khóa Fa bên dưới, giúp nốt bè Sol và hợp âm to gấp đôi trên màn hình điện thoại.</div>
            </div>
            <div class="step-box">
              <div class="step-title">2. Ẩn Bè Phụ (SATB)</div>
              <div class="step-text">Tắt các nốt bè Alto, Tenor, Bass khi chỉ cần giai điệu chính Soprano.</div>
            </div>
            <div class="step-box">
              <div class="step-title">3. Ẩn Nốt Chùm (Chords Notes)</div>
              <div class="step-text">Lọc sạch các nốt đệm kép, chỉ giữ lại giai điệu mộc duy nhất.</div>
            </div>
            <div class="step-box">
              <div class="step-title">4. Ẩn Lời Ca (Lyrics)</div>
              <div class="step-text">Dành riêng cho ban hòa tấu nhạc cụ (không cần đọc lời, chỉ tập trung nốt và hợp âm).</div>
            </div>
            <div class="step-box">
              <div class="step-title">5. Ẩn Số Ô Nhịp</div>
              <div class="step-text">Tối giản khuông nhạc, loại bỏ các con số đầu ô nhịp gây rối mắt.</div>
            </div>
            <div class="step-box">
              <div class="step-title">6. Ẩn Dấu Nhịp Lặp Lại</div>
              <div class="step-text">Dành cho việc trình diễn liên tục không quay đầu.</div>
            </div>
          </div>
        </div>

        <div class="doc-card" data-roles="all leader">
          <h3 class="card-title"><span class="topic-icon">🖨️</span> 2.3. In Ấn Bản Nhạc Chuẩn A4 (Print Layout Engine)</h3>
          <p class="card-desc">
            SheetApp trang bị thuật toán dàn trang in chuyên nghiệp độc lập với giao diện màn hình. Khi bấm tổ hợp phím <kbd>Ctrl</kbd> + <kbd>P</kbd> (hoặc nút "In Sheet"):
          </p>
          <ul style="padding-left: 20px; color: var(--text-secondary); line-height: 1.8;">
            <li>Hệ thống tự động xóa bỏ toàn bộ thanh công cụ, nút bấm và viền đen trang web.</li>
            <li>Tự động chuyển nền sang màu trắng tinh và nốt nhạc màu đen mực in chuẩn công nghiệp.</li>
            <li>Tự động căn lề ngắt trang A4 chuẩn xác, không làm cắt đôi ô nhịp giữa trang 1 và trang 2.</li>
          </ul>
        </div>
      </section>

      <!-- ══════════════════════════════════════════════════════════
           MÔ-ĐUN 3: SOẠN HỢP ÂM & DỊCH GIỌNG THÔNG MINH
           ══════════════════════════════════════════════════════════ -->
      <section id="mod-3" class="docs-chapter">
        <div class="chapter-header">
          <span class="chapter-badge">CHƯƠNG 03</span>
          <h2 class="chapter-title">Soạn Hợp Âm & Dịch Giọng Thông Minh</h2>
        </div>

        <div class="doc-card" data-roles="all musician leader">
          <h3 class="card-title"><span class="topic-icon">🎸</span> 3.1. Soạn Hợp Âm Trực Quan (Chord Canvas Engine)</h3>
          <p class="card-desc">
            Nhạc công có thể trực tiếp cá nhân hóa hòa thanh cho từng bài hát một cách cực kỳ trực quan:
          </p>
          <div class="steps-grid">
            <div class="step-box">
              <span class="step-num">BƯỚC 1</span>
              <div class="step-title">Nhấp chọn nốt nhạc</div>
              <div class="step-text">Nhấp chuột hoặc chạm tay trực tiếp vào nốt nhạc trên khuông cần đặt hợp âm. Nốt đang chọn sẽ sáng viền xanh.</div>
            </div>
            <div class="step-box">
              <span class="step-num">BƯỚC 2</span>
              <div class="step-title">Gợi ý Tông thông minh</div>
              <div class="step-text">Bảng hợp âm hiện ra với các hợp âm phù hợp nhất với Tông bài hát (Key-aware) nằm ở hàng ưu tiên đầu tiên.</div>
            </div>
            <div class="step-box">
              <span class="step-num">BƯỚC 3</span>
              <div class="step-title">Lưu vào bộ hợp âm</div>
              <div class="step-text">Chọn hợp âm mong muốn (Trưởng, Thứ, 7, Sus4, Slash chord...). Hợp âm lập tức xuất hiện ngay phía trên nốt nhạc.</div>
            </div>
          </div>
        </div>

        <div class="doc-card" data-roles="all musician leader">
          <h3 class="card-title"><span class="topic-icon">🗂️</span> 3.2. Quản Lý Đa Bộ Hợp Âm Cá Nhân (Multi-Sets & Core Rules)</h3>
          <p class="card-desc">
            Mỗi người chơi nhạc cụ có gu hòa thanh khác nhau (Guitar đệm khác Piano, hòa tấu khác ca đoàn). SheetApp cho phép tạo không giới hạn các Bộ Hợp Âm mang tên riêng:
          </p>
          <div class="callout callout-important">
            <div class="callout-title">🛡️ Quy Tắc Cốt Lõi (Core Rules): Bảo Vệ Bộ Gốc</div>
            • <strong>Bộ <code>TLH (Gốc)</code>:</strong> Là bộ hợp âm truyền thống nguyên bản trong sách Thánh Ca, được bảo vệ nghiêm ngặt chống sửa/xóa.<br>
            • <strong>Bộ <code>HD</code>:</strong> Là bộ hợp âm mặc định chuẩn của SheetApp.<br>
            • <strong>Tạo bộ mới:</strong> Bấm vào nút <strong>"+ Tạo bộ mới"</strong>, đặt tên (VD: <em>"Guitar Anh Tuấn"</em>, <em>"Piano Ca Đoàn Têrêsa"</em>). Bạn có toàn quyền sửa/xóa và lưu bộ riêng của mình mà không ảnh hưởng đến người khác.
          </div>
        </div>

        <div class="doc-card" data-roles="all musician">
          <h3 class="card-title"><span class="topic-icon">🔄</span> 3.3. Dịch Giọng (Transpose) & Gợi Ý Đặt Capo Chuẩn</h3>
          <p class="card-desc">
            Khi ca sĩ hát giọng khác với bản nhạc gốc, bạn không cần phải nhẩm dịch giọng bằng tay:
          </p>
          <ul style="padding-left: 20px; color: var(--text-secondary); line-height: 1.8;">
            <li>Bấm nút <strong><code>−</code></strong> hoặc <strong><code>+</code></strong> cạnh nhãn Tông để dịch giọng theo từng nửa cung (semitone).</li>
            <li>Hệ thống dịch chuyển toàn bộ nốt nhạc MusicXML và hợp âm tương ứng trong tích tắc.</li>
            <li><strong>Gợi ý Capo Guitar tự động:</strong> Ví dụ khi dịch sang tông <code>Ab</code>, hệ thống sẽ gợi ý: <em>"Kẹp Capo ngăn 1 → Bấm theo thế tay G tiêu chuẩn"</em>, giúp người chơi guitar acoustic không phải bấm các thế hợp âm chặn đau tay.</li>
          </ul>
        </div>
      </section>

      <!-- ══════════════════════════════════════════════════════════
           MÔ-ĐUN 4: MÁY ĐẾM NHỊP PRO & NHỊP ĐỘ TƯƠNG TÁC
           ══════════════════════════════════════════════════════════ -->
      <section id="mod-4" class="docs-chapter">
        <div class="chapter-header">
          <span class="chapter-badge">CHƯƠNG 04</span>
          <h2 class="chapter-title">Máy Đếm Nhịp Pro & Nhịp Độ Tương Tác</h2>
        </div>

        <div class="doc-card" data-roles="all musician leader">
          <h3 class="card-title"><span class="topic-icon">⏱️</span> 4.1. Hộp Thoại Chỉnh Tempo Tương Tác (TempoPick Modal)</h3>
          <p class="card-desc">
            Không cần phải vào menu cài đặt phức tạp, người dùng chỉ cần chạm trực tiếp vào nhãn tốc độ <code>[♩ = 80 bpm ✎]</code> trên thanh thông tin đầu trang để mở bảng điều khiển:
          </p>
          <div class="steps-grid">
            <div class="step-box">
              <div class="step-title">Thanh trượt Slider (40 - 240)</div>
              <div class="step-text">Kéo nhẹ để tăng giảm tốc độ mượt mà, hoặc bấm <code>−</code> / <code>+</code> để tinh chỉnh từng BPM.</div>
            </div>
            <div class="step-box">
              <div class="step-title">Phím Tốc Độ Chuẩn</div>
              <div class="step-text">Bấm nhanh các mốc: <em>60 Chậm (Largo)</em>, <em>80 Vừa (Andante)</em>, <em>100 Nhanh (Moderato)</em>, <em>120 Rộn rã (Allegro)</em>.</div>
            </div>
            <div class="step-box">
              <div class="step-title">👆 TAP TEMPO Thông Minh</div>
              <div class="step-text">Dùng ngón tay chạm nút "TAP TEMPO" 3 đến 4 nhịp theo tốc độ bạn đang hát, máy sẽ tự động tính ra con số BPM chuẩn xác!</div>
            </div>
            <div class="step-box">
              <div class="step-title">🔊 Nghe Thử Trực Tiếp</div>
              <div class="step-text">Bấm nút "Bật Nhịp" ngay trong popup để nghe thử tiếng gõ trước khi bắt đầu biểu diễn.</div>
            </div>
          </div>
        </div>

        <div class="doc-card" data-roles="all musician">
          <h3 class="card-title"><span class="topic-icon">💡</span> 4.2. Đèn LED Giữ Nhịp Trực Quan (Visual Beat Pulser)</h3>
          <p class="card-desc">
            Khi biểu diễn trên sân khấu có tiếng ồn lớn, tai nghe có thể bị lấn át. SheetApp trang bị hệ thống 4 đèn LED thị giác:
          </p>
          <ul style="padding-left: 20px; color: var(--text-secondary); line-height: 1.8;">
            <li><strong>Phách 1 (Phách mạnh đầu ô nhịp):</strong> Đèn LED số 1 chớp sáng rực rỡ màu Cam/Đỏ kèm kích thước phóng to, kết hợp âm chuông cao (960Hz).</li>
            <li><strong>Phách 2, 3, 4 (Phách nhẹ):</strong> Các đèn LED phụ chớp xanh Cyan sắc nét, kết hợp tiếng gõ gỗ trầm (540Hz).</li>
          </ul>
        </div>
      </section>

      <!-- ══════════════════════════════════════════════════════════
           MÔ-ĐUN 5: QUẢN LÝ SETLIST BIỂU DIỄN & SỔ TAY TẬP
           ══════════════════════════════════════════════════════════ -->
      <section id="mod-5" class="docs-chapter">
        <div class="chapter-header">
          <span class="chapter-badge">CHƯƠNG 05</span>
          <h2 class="chapter-title">Quản Lý Setlist Biểu Diễn & Sổ Tay Bài Tập</h2>
        </div>

        <div class="doc-card" data-roles="all leader">
          <h3 class="card-title"><span class="topic-icon">📋</span> 5.1. Tạo & Quản Lý Setlist Chương Trình</h3>
          <p class="card-desc">
            Setlist là danh sách tập hợp các bài hát sẽ biểu diễn trong một buổi lễ (Khai Lễ, Đáp Ca, Dâng Lễ, Hiệp Lễ, Kết Lễ):
          </p>
          <div class="callout callout-tip">
            <div class="callout-title">💡 Thiết Lập Riêng Tông Tập & Tempo Tập:</div>
            Khi thêm bài hát vào Setlist, Ca Trưởng có thể chọn trước <strong>Tông tập riêng</strong> (ví dụ bài gốc Tông G nhưng ca sĩ hát Tông A) và <strong>Tempo tập riêng</strong>. Khi mở bài từ Setlist, ứng dụng sẽ tự động dịch đúng giọng và set đúng tempo đã lưu mà không cần chỉnh lại bằng tay!
          </div>
        </div>

        <div class="doc-card" data-roles="all leader admin">
          <h3 class="card-title"><span class="topic-icon">📤</span> 5.2. Xuất Chương Trình In A4 & Sao Chép Cho Phần Mềm Chiếu Slide</h3>
          <p class="card-desc">
            Sau khi sắp xếp Setlist xong, người điều phối có thể chia sẻ nhanh chóng:
          </p>
          <div class="steps-grid">
            <div class="step-box">
              <div class="step-title">🖨️ In Chương Trình A4</div>
              <div class="step-text">In ra bảng danh sách bài hát, thứ tự biểu diễn, Tông và Tempo để phát cho các thành viên trong ban nhạc cầm tay.</div>
            </div>
            <div class="step-box">
              <div class="step-title">📋 Sao chép Slide Trình Chiếu</div>
              <div class="step-text">Bấm nút "Sao chép Slide", danh sách bài kèm thông số được copy vào clipboard, sẵn sàng dán vào ProPresenter, EasyWorship hoặc PowerPoint.</div>
            </div>
          </div>
        </div>

        <div class="doc-card" data-roles="all leader musician">
          <h3 class="card-title"><span class="topic-icon">📝</span> 5.3. Sổ Tay Ghi Chú Biểu Diễn (Practice Notes)</h3>
          <p class="card-desc">
            Mỗi bài hát có một ô ghi chú riêng biệt được đồng bộ lên máy chủ:
          </p>
          <ul style="padding-left: 20px; color: var(--text-secondary); line-height: 1.8;">
            <li>Bấm nút <strong>"⚡ Tự lấy Tông & BPM"</strong> để tự động chèn thông số hiện tại vào ghi chú.</li>
            <li>Bấm các nút gợi ý nhanh: <code>🔄 Điệp khúc x2</code>, <code>🎸 Dạo guitar</code>, <code>👩 Nữ hát -> 👨 Nam bè</code>, <code>🛑 Kết nhỏ dần</code>.</li>
          </ul>
        </div>
      </section>

      <!-- ══════════════════════════════════════════════════════════
           MÔ-ĐUN 6: LIVE BAND STUDIO — SÂN KHẤU & PHỐI HỢP
           ══════════════════════════════════════════════════════════ -->
      <section id="mod-6" class="docs-chapter">
        <div class="chapter-header">
          <span class="chapter-badge">CHƯƠNG 06</span>
          <h2 class="chapter-title">Live Band Studio — Sân Khấu & Nhạc Cụ Phối Hợp</h2>
        </div>

        <div class="doc-card" data-roles="all leader musician">
          <h3 class="card-title"><span class="topic-icon">📡</span> 6.1. Mở Phòng Phát Sóng & Kết Nối Đồng Bộ Realtime</h3>
          <p class="card-desc">
            Truy cập trực tiếp tại đường dẫn: <a href="/live-band/" target="_blank" style="color: var(--accent-cyan); font-weight: 700;">https://sheet.hyb.io.vn/live-band/</a>
          </p>
          <div class="steps-grid">
            <div class="step-box">
              <span class="step-num">CA TRƯỞNG (HOST)</span>
              <div class="step-title">1. Mở phòng biểu diễn</div>
              <div class="step-text">Bấm "📡 Phòng Live" → Bấm "Tạo Phòng Mới". Hệ thống cấp mã phòng 6 chữ số (VD: <code>ROOM-777</code>) kèm Mã QR phóng to toàn màn hình.</div>
            </div>
            <div class="step-box">
              <span class="step-num">NHẠC CÔNG / CA ĐOÀN</span>
              <div class="step-title">2. Quét QR hoặc Nhập mã</div>
              <div class="step-text">Dùng camera iPad quét mã QR hoặc nhập 6 chữ số để tham gia phòng. Tất cả thiết bị lập tức kết nối đồng bộ.</div>
            </div>
            <div class="step-box">
              <span class="step-num">ĐỒNG BỘ SIÊU TỐC</span>
              <div class="step-title">3. Tự động chuyển bài & cuộn trang</div>
              <div class="step-text">Khi Ca Trưởng đổi bài hát, dịch tông, hoặc cuộn trang, màn hình của toàn bộ ban nhạc sẽ tự động nhảy theo trong vòng 0.3 giây!</div>
            </div>
          </div>
        </div>

        <div class="doc-card" data-roles="all musician leader">
          <h3 class="card-title"><span class="topic-icon">⚡</span> 6.2. Sáu Lệnh Trạng Thái Năng Lượng Ban Nhạc (1-Touch Dynamic States)</h3>
          <p class="card-desc">
            Trong một bài thánh ca, cảm xúc lúc êm dịu, lúc cao trào, lúc ngắt nốt dứt khoát. Thanh lệnh 1 chạm cho phép Ca Trưởng hoặc Trưởng ban phát hiệu lệnh cho toàn ban nhạc ngay tức thì:
          </p>
          <div class="steps-grid">
            <div class="step-box" style="border-left: 3px solid #ef4444;">
              <div class="step-title">🛑 BREAK</div>
              <div class="step-text">Toàn bộ ban nhạc ngắt nốt đồng loạt ngay ở phách 1 của ô nhịp, tạo khoảng lặng ấn tượng.</div>
            </div>
            <div class="step-box" style="border-left: 3px solid #3b82f6;">
              <div class="step-title">🌊 BUILD-UP</div>
              <div class="step-text">Trống dồn nhịp dồn dập (roll), toàn ban tăng dần âm lượng chuẩn bị bùng nổ sang điệp khúc.</div>
            </div>
            <div class="step-box" style="border-left: 3px solid #8b5cf6;">
              <div class="step-title">🤫 ĐỆM ÊM (DROP)</div>
              <div class="step-text">Toàn ban hạ nhỏ volume, chỉ piano hoặc acoustic guitar rải nhẹ nhàng cho ca sĩ hát lắng đọng.</div>
            </div>
            <div class="step-box" style="border-left: 3px solid #f97316;">
              <div class="step-title">🔥 CAO TRÀO (FULL DRIVE)</div>
              <div class="step-text">Quạt mạnh hết lực, bass và trống đánh đanh dày, toàn ban bung hết năng lượng cao nhất.</div>
            </div>
            <div class="step-box" style="border-left: 3px solid #eab308;">
              <div class="step-title">🎸 SOLO TIME</div>
              <div class="step-text">Ban nhạc hạ nền cho nhạc cụ solo (Guitar lead, Saxophone, Piano solo) tỏa sáng.</div>
            </div>
            <div class="step-box" style="border-left: 3px solid #64748b;">
              <div class="step-title">🏁 DỨT KẾT</div>
              <div class="step-text">Hiệu lệnh kết bài dứt khoát trên phách 1 hoặc hợp âm cuối cùng, không ai đánh thừa nốt.</div>
            </div>
          </div>
        </div>

        <div class="doc-card" data-roles="all musician leader">
          <h3 class="card-title"><span class="topic-icon">⏭️</span> 6.3. Chuyển Khúc Tức Thời & Cảnh Báo Trước 2 Ô Nhịp</h3>
          <p class="card-desc">
            Không cần phải hô to trên sân khấu gây ồn, thanh điều khiển chuyển khúc đồng bộ thị giác cho mọi người:
          </p>
          <ul style="padding-left: 20px; color: var(--text-secondary); line-height: 1.8;">
            <li><strong>Các phím nhảy khúc nhanh:</strong> <code>⚡ Intro</code>, <code>⚡ Verse</code>, <code>⚡ Điệp Khúc</code>, <code>⚡ Solo</code>, <code>⚡ Bridge</code>, <code>⚡ Outro</code>. Nhấp vào là bản nhạc tự động cuộn đến phân đoạn đó.</li>
            <li><strong>Nút ⚠️ BÁO TRƯỚC 2 Ô NHỊP:</strong> Lập tức phát banner cảnh báo nhấp nháy đỏ trên màn hình của tất cả các bạn chơi nhạc: <em>"⚠️ CHUẨN BỊ CHUYỂN KHÚC SAU 2 Ô NHỊP!"</em> để tay trống dồn báo và guitar/bass chuẩn bị sẵn thế tay.</li>
          </ul>
        </div>

        <div class="doc-card" data-roles="all musician">
          <h3 class="card-title"><span class="topic-icon">🎯</span> 6.4. Bảng HUD Chuyên Biệt Cho Từng Nhạc Cụ</h3>
          <p class="card-desc">
            Khi chọn vai trò của mình trong danh sách thả xuống, màn hình sẽ hiển thị bảng điều khiển chuyên sâu dành riêng cho nhạc cụ đó:
          </p>
          <div class="steps-grid">
            <div class="step-box" style="border-color: rgba(56, 189, 248, 0.4);">
              <div class="step-title">🎸 BASS MASTER HUD</div>
              <div class="step-text">
                • <strong>Nốt gốc (Root Note) cỡ lớn:</strong> Hiển thị nốt chủ đạo sáng rõ.<br>
                • <strong>Tự động nhận diện hợp âm đảo (Slash Chords):</strong> Gặp <code>C/E</code> → Bass đánh nốt <strong>E</strong>, gặp <code>G/B</code> → Bass đánh nốt <strong>B</strong>.<br>
                • <strong>Âm giai theo tông:</strong> Liệt kê các nốt bậc I-vii°.<br>
                • <strong>Sơ đồ 4 dây:</strong> Hỗ trợ nhớ thế dây E-A-D-G.
              </div>
            </div>
            <div class="step-box" style="border-color: rgba(168, 85, 247, 0.4);">
              <div class="step-title">🎹 PIANO / KEYBOARD HUD</div>
              <div class="step-text">
                • <strong>Vòng hòa thanh La Mã:</strong> Gợi ý tiến trình hợp âm <code>I - IV - V7 - vi</code>.<br>
                • <strong>Hợp âm mở rộng (Voicings):</strong> Toàn bộ hợp âm 7 trong tông (Cmaj7, Dm7, Em7, Fmaj7, G7, Am7, Bm7b5).<br>
                • <strong>Ambient Pad Sync:</strong> Đèn báo trạng thái kết nối đệm nền Pad drone.
              </div>
            </div>
            <div class="step-box">
              <div class="step-title">🎸 GUITAR HUD</div>
              <div class="step-text">
                • Gợi ý kẹp Capo chuẩn theo Tông.<br>
                • Gợi ý thế tay bấm hợp âm mở (Open Chord shapes: C, G, D, A, E).
              </div>
            </div>
            <div class="step-box">
              <div class="step-title">🥁 DRUMS HUD</div>
              <div class="step-text">
                • Đồng hồ nhịp phách cỡ lớn.<br>
                • Đèn LED chớp trực quan phách 1 và phách nhẹ giúp tay trống giữ nhịp vững vàng.
              </div>
            </div>
          </div>
        </div>

        <div class="doc-card" data-roles="all leader musician">
          <h3 class="card-title"><span class="topic-icon">🎹</span> 6.5. Tiện Ích Sân Khấu Nâng Cao (Ambient Pad, Foot Pedal, Máy Chiếu)</h3>
          <p class="card-desc">
            Các công cụ hỗ trợ biểu diễn chuyên nghiệp chuẩn quốc tế:
          </p>
          <ul style="padding-left: 20px; color: var(--text-secondary); line-height: 1.8;">
            <li><strong>🎹 Ambient Pad Synth vô tận:</strong> Bộ phát âm đệm nền Worship Drone liên tục với 4 tầng sóng ấm áp, tự động hòa thanh theo Tông đang chơi và chuyển tông mượt mà không ngắt tiếng (Crossfade 4 giây).</li>
            <li><strong>🦶 Bàn đạp chân Bluetooth & Web MIDI:</strong> Kết nối bàn đạp đạp chân (AirTurn, Donner, PageFlip) để lật trang hoặc kích hoạt Tap Tempo hoàn toàn rảnh tay.</li>
            <li><strong>📺 Màn hình máy chiếu nhà thờ Clean Lyrics Projector:</strong> Mở trang <code>/live-band/projector.php</code> trên máy tính nối máy chiếu nhà thờ, chữ hiển thị to rõ không có nốt nhạc, tự động bắt nhịp theo Ca Trưởng.</li>
            <li><strong>✏️ Bút vẽ chú thích Apple Pencil / S-Pen:</strong> Ca Trưởng dùng bút vẽ khoanh tròn hoặc gạch chân nốt nhạc cần lưu ý, nét vẽ lập tức truyền hình ảnh đến iPad của toàn ban.</li>
          </ul>
        </div>
      </section>

      <!-- ══════════════════════════════════════════════════════════
           MÔ-ĐUN 7: SMART LEARNING & TẬP HÁT BÈ SATB
           ══════════════════════════════════════════════════════════ -->
      <section id="mod-7" class="docs-chapter">
        <div class="chapter-header">
          <span class="chapter-badge">CHƯƠNG 07</span>
          <h2 class="chapter-title">Smart Learning & Tập Hát Bè SATB</h2>
        </div>

        <div class="doc-card" data-roles="all vocal leader">
          <h3 class="card-title"><span class="topic-icon">🎓</span> 7.1. Giao Diện Phòng Tập Thông Minh (/learn/)</h3>
          <p class="card-desc">
            Truy cập tại: <a href="/learn/" target="_blank" style="color: var(--accent-cyan); font-weight: 700;">https://sheet.hyb.io.vn/learn/</a>. Đây là môi trường luyện tập chuyên sâu dành cho ca đoàn Công Giáo và các ban hát hợp xướng trước khi lên sân khấu.
          </p>
          <div class="steps-grid">
            <div class="step-box">
              <div class="step-title">🔁 Vòng Lặp A-B Loop</div>
              <div class="step-text">Nhập ô nhịp bắt đầu (A) và kết thúc (B) để hệ thống tự động phát lặp đi lặp lại một câu hát khó cho đến khi ca viên thuộc nhuần nhuyễn.</div>
            </div>
            <div class="step-box">
              <div class="step-title">🎧 SATB RehearsalMix (Tách Bè)</div>
              <div class="step-text">Bấm nút tách bè để cô lập hoặc tăng âm lượng (+3dB Solo) cho từng bè riêng biệt: <strong>Soprano (Nữ cao)</strong>, <strong>Alto (Nữ trầm)</strong>, <strong>Tenor (Nam cao)</strong>, <strong>Bass (Nam trầm)</strong>.</div>
            </div>
            <div class="step-box">
              <div class="step-title">🎹 Phím Đàn Piano Ảo</div>
              <div class="step-text">Bàn phím Piano ảo chạy phía dưới bản nhạc, sáng phím tương ứng với cao độ nốt đang hát giúp ca viên bắt cao độ chuẩn xác.</div>
            </div>
            <div class="step-box">
              <div class="step-title">🐌 Chỉnh Tốc Độ Tập (50% - 100%)</div>
              <div class="step-text">Ca đoàn có thể tập câu khó ở tốc độ chậm 50% hoặc 75% mà không hề bị méo tiếng hay lệch cao độ.</div>
            </div>
          </div>
        </div>
      </section>

      <!-- ══════════════════════════════════════════════════════════
           MÔ-ĐUN 8: CHỈNH SỬA SHEET NHẠC VISUAL MUSICXML
           ══════════════════════════════════════════════════════════ -->
      <section id="mod-8" class="docs-chapter">
        <div class="chapter-header">
          <span class="chapter-badge">CHƯƠNG 08</span>
          <h2 class="chapter-title">Chỉnh Sửa Sheet Nhạc Visual MusicXML</h2>
        </div>

        <div class="doc-card" data-roles="all leader admin">
          <h3 class="card-title"><span class="topic-icon">✏️</span> 8.1. Trình Sửa Sheet Visual Trực Tiếp (/editor/)</h3>
          <p class="card-desc">
            Truy cập tại: <a href="/editor/" target="_blank" style="color: var(--accent-cyan); font-weight: 700;">https://sheet.hyb.io.vn/editor/</a>. Bạn không cần phải mua hay cài đặt các phần mềm soạn nhạc phức tạp như Sibelius, Finale hay MuseScore.
          </p>
          <div class="steps-grid">
            <div class="step-box">
              <div class="step-title">Sửa Nốt Nhạc & Nhịp Điệu</div>
              <div class="step-text">Kéo thả nốt lên xuống để đổi cao độ, đổi trường độ (tròn, trắng, đen, móc đơn, móc kép), thêm dấu hóa thăng/giáng.</div>
            </div>
            <div class="step-box">
              <div class="step-title">Sửa Lời Bài Hát (Lyrics)</div>
              <div class="step-text">Nhấp trực tiếp vào từng từ ngữ dưới nốt nhạc để sửa chính tả hoặc cập nhật bản dịch mới.</div>
            </div>
            <div class="step-box">
              <div class="step-title">Quản Lý Phân Bè SATB</div>
              <div class="step-text">Hỗ trợ chỉnh sửa độc lập từng bè: Khóa Sol (Part P1: Soprano & Alto) và Khóa Fa (Part P2: Tenor & Bass).</div>
            </div>
            <div class="step-box">
              <div class="step-title">An Toàn Tuyệt Đối 100%</div>
              <div class="step-text">Hỗ trợ Hoàn tác đa tầng (<kbd>Ctrl + Z</kbd> / <kbd>Ctrl + Y</kbd>). Hệ thống tự động tạo bản sao lưu <code>.xml.bak</code> trước mỗi lần lưu và có nút khôi phục khẩn cấp 1 chạm!</div>
            </div>
          </div>
        </div>
      </section>

      <!-- ══════════════════════════════════════════════════════════
           MÔ-ĐUN 9: PHÍM TẮT & BẢNG XỬ LÝ SỰ CỐ
           ══════════════════════════════════════════════════════════ -->
      <section id="mod-9" class="docs-chapter">
        <div class="chapter-header">
          <span class="chapter-badge">CHƯƠNG 09</span>
          <h2 class="chapter-title">Cẩm Nang Phím Tắt & Bảng Xử Lý Sự Cố</h2>
        </div>

        <div class="doc-card" data-roles="all">
          <h3 class="card-title"><span class="topic-icon">⌨️</span> 9.1. Bảng Phím Tắt Nhanh (Keyboard Shortcuts)</h3>
          <div class="doc-table-wrap">
            <table class="doc-table">
              <thead>
                <tr>
                  <th>Tác Vụ</th>
                  <th>Phím Tắt Trên Máy Tính</th>
                  <th>Bàn Đạp Chân (Foot Pedal)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Cuộn xuống trang tiếp theo</td>
                  <td><kbd>Phím Mũi Tên Xuống</kbd> hoặc <kbd>Space</kbd></td>
                  <td>Đạp Bàn Phải (Right Pedal)</td>
                </tr>
                <tr>
                  <td>Cuộn lên trang trước</td>
                  <td><kbd>Phím Mũi Tên Lên</kbd></td>
                  <td>Đạp Bàn Trái (Left Pedal)</td>
                </tr>
                <tr>
                  <td>Tìm kiếm nhanh bài hát</td>
                  <td><kbd>Ctrl</kbd> + <kbd>K</kbd> hoặc <kbd>/</kbd></td>
                  <td>—</td>
                </tr>
                <tr>
                  <td>Bật / Tắt Máy Đếm Nhịp</td>
                  <td><kbd>M</kbd></td>
                  <td>Đạp giữ 1.5s</td>
                </tr>
                <tr>
                  <td>👆 TAP TEMPO Bắt Nhịp</td>
                  <td><kbd>T</kbd></td>
                  <td>Nhấp đúp nhanh</td>
                </tr>
                <tr>
                  <td>Bật / Tắt Đệm Nền Ambient Pad</td>
                  <td><kbd>P</kbd></td>
                  <td>—</td>
                </tr>
                <tr>
                  <td>Dịch Tông (Nửa cung)</td>
                  <td><kbd>[</kbd> (Hạ Tông) / <kbd>]</kbd> (Tăng Tông)</td>
                  <td>—</td>
                </tr>
                <tr>
                  <td>Toàn màn hình Sân khấu</td>
                  <td><kbd>F</kbd> hoặc <kbd>F11</kbd></td>
                  <td>—</td>
                </tr>
                <tr>
                  <td>In bản nhạc A4</td>
                  <td><kbd>Ctrl</kbd> + <kbd>P</kbd></td>
                  <td>—</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="doc-card" data-roles="all musician">
          <h3 class="card-title"><span class="topic-icon">🦶</span> 9.2. Hướng Dẫn Kết Nối Bàn Đạp Chân (Bluetooth Pedal)</h3>
          <p class="card-desc">
            SheetApp hỗ trợ 100% các dòng bàn đạp lật trang Bluetooth phổ biến trên thị trường:
          </p>
          <ul style="padding-left: 20px; color: var(--text-secondary); line-height: 1.8;">
            <li><strong>Các dòng tương thích:</strong> AirTurn (BT200, BT500, DUO), Donner Wireless Page Turner, PageFlip (Butterfly, Firefly), iRig BlueTurn.</li>
            <li><strong>Cấu hình gạt chế độ (Mode Switch):</strong> Hãy gạt công tắc trên bàn đạp về <strong>Mode 3 (PageDown / PageUp)</strong> hoặc <strong>Mode 1 (Arrow Down / Arrow Up)</strong>.</li>
            <li>Mở Bluetooth trên máy tính hoặc iPad, kết nối với bàn đạp, mở SheetApp là có thể đạp chân lật trang ngay lập tức mà không cần cài đặt thêm phần mềm trung gian.</li>
          </ul>
        </div>

        <div class="doc-card" data-roles="all">
          <h3 class="card-title"><span class="topic-icon">❓</span> 9.3. Bảng Tra Cứu Sự Cố Thường Gặp (FAQ)</h3>
          <div class="faq-list">
            <div class="faq-item">
              <div class="faq-question">1. Tại sao tôi bật máy đếm nhịp hoặc Ambient Pad nhưng không nghe thấy tiếng?</div>
              <div class="faq-answer">
                Các trình duyệt hiện đại (Chrome, Safari) có chính sách bảo mật chặn âm thanh tự phát (Autoplay Policy). Bạn chỉ cần dùng chuột nhấp vào màn hình hoặc chạm tay 1 lần vào trang web để cấp quyền âm thanh Web Audio, tiếng đếm nhịp và pad sẽ phát bình thường.
              </div>
            </div>
            <div class="faq-item">
              <div class="faq-question">2. Làm sao để màn hình iPad không bị tắt khi đang làm lễ?</div>
              <div class="faq-answer">
                Trên thanh điều hướng đầu trang, hãy kiểm tra nút <strong>"💡 Sáng" (WakeLock)</strong>. Khi nút có màu vàng hoặc xanh lá, hệ thống đã kích hoạt cơ chế Screen WakeLock giữ màn hình luôn sáng liên tục.
              </div>
            </div>
            <div class="faq-item">
              <div class="faq-question">3. Nhập mã phòng Live Band nhưng không thấy chuyển bài theo Ca Trưởng?</div>
              <div class="faq-answer">
                Kiểm tra lại xem mã phòng đã nhập đúng 6 chữ số chưa. Đồng thời đảm bảo thiết bị của bạn đang kết nối WiFi hoặc 4G ổn định. Nếu mạng bị chập chờn, hãy bấm nút "Quay về Ca Trưởng" ở góc dưới màn hình để đồng bộ lại ngay.
              </div>
            </div>
            <div class="faq-item">
              <div class="faq-question">4. Tôi muốn xóa một hợp âm vừa đặt nhầm trên nốt nhạc thì làm thế nào?</div>
              <div class="faq-answer">
                Nhấp chuột vào nốt nhạc có hợp âm muốn xóa để mở bảng hợp âm, sau đó bấm nút <strong>"Xóa hợp âm"</strong> màu đỏ hoặc nhấn phím <kbd>Backspace</kbd> / <kbd>Delete</kbd> trên bàn phím.
              </div>
            </div>
            <div class="faq-item">
              <div class="faq-question">5. Người dùng thông thường có thể vô tình xóa mất bản nhạc gốc không?</div>
              <div class="faq-answer">
                Hoàn toàn không thể. Hệ thống đã áp dụng các quy tắc bảo vệ Core Rules nghiêm ngặt: chỉ tài khoản có quyền Admin mới được phép chỉnh sửa file MusicXML gốc. Toàn bộ thao tác tạo hợp âm của người dùng đều được lưu vào bộ nhớ riêng biệt an toàn.
              </div>
            </div>
          </div>
        </div>

      </section>

    </main>
  </div>

  <!-- Floating Back to Top Button -->
  <button id="btn-back-to-top" class="btn-back-to-top" title="Lên đầu trang">↑</button>

  <!-- ══════════════ FOOTER ══════════════ -->
  <footer class="docs-footer">
    <p>© 2026 SheetApp 2.0 — Hệ Thống Quản Lý & Biểu Diễn Bản Nhạc Thông Minh. Phát triển bởi Ban Hát & Hội Thánh.</p>
  </footer>

  <script src="/huong-dan/huong-dan.js?v=<?= time() ?>"></script>
</body>
</html>
