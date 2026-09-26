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
