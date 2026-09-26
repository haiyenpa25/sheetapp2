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
              <div class="shortcut-row"><kbd>Alt + 1</kbd><span>Bè 1 Soprano</span></div>
              <div class="shortcut-row"><kbd>Alt + 2</kbd><span>Bè 2 Alto</span></div>
              <div class="shortcut-row"><kbd>Alt + 3</kbd><span>Bè 3 Tenor</span></div>
              <div class="shortcut-row"><kbd>Alt + 4</kbd><span>Bè 4 Bass</span></div>
              <div class="shortcut-row"><kbd>V</kbd> / <kbd>Shift + V</kbd><span>Chuyển bè kế tiếp / trước</span></div>
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
              <div class="shortcut-row"><kbd>Kéo chuột 60 FPS</kbd><span>Kéo thẳng đứng trên nốt để đổi cao độ</span></div>
              <div class="shortcut-row"><kbd>Piano Ảo</kbd><span>Bấm phím đàn để đổi cao độ tức thì</span></div>
            </div>

            <div class="shortcut-block">
              <h4>4. Thao Tác & Điều Hướng</h4>
              <div class="shortcut-row"><kbd>←</kbd> / <kbd>→</kbd> hoặc <kbd>Tab</kbd><span>Đi tới nốt trước / sau</span></div>
              <div class="shortcut-row"><kbd>Space</kbd><span>Nghe toàn bài / Shift+Space: Hợp âm</span></div>
              <div class="shortcut-row"><kbd>X</kbd> / <kbd>Delete</kbd> / <kbd>R</kbd><span>Đổi nốt thành dấu lặng</span></div>
              <div class="shortcut-row"><kbd>Alt + S</kbd> / <kbd>Shift + X</kbd><span>Tách nốt thành 2 dấu lặng để soạn</span></div>
              <div class="shortcut-row"><kbd>Alt + 4</kbd><span>Tách nốt thành 4 dấu lặng để soạn</span></div>
              <div class="shortcut-row"><kbd>Alt + M</kbd><span>Gộp 2 dấu lặng liền kề</span></div>
              <div class="shortcut-row"><kbd>Insert</kbd><span>Thêm nốt mới phía sau</span></div>
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

  <!-- ==================== MODAL XUẤT BẢN CHUYÊN NGHIỆP (PRO EXPORT HUB) ==================== -->
  <div id="export-score-modal" class="modal-backdrop hidden">
    <div class="modal-dialog export-dialog">
      <div class="modal-header">
        <div class="modal-header-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;margin-right:6px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
          <span>Trung Tâm Xuất Bản Sheet Nhạc Pro</span>
        </div>
        <button id="btn-close-export-modal" class="btn-modal-close" title="Đóng">&times;</button>
      </div>
      <div class="modal-content-export">
        <p class="export-desc">Chọn định dạng chất lượng cao để in ấn biểu diễn hoặc nạp vào các phần mềm chuyên nghiệp:</p>
        <div class="export-cards-grid">
          <!-- Card PDF -->
          <div class="export-card" id="export-card-pdf">
            <div class="export-card-icon pdf-icon">📄</div>
            <div class="export-card-info">
              <h4>Xuất PDF Khổ A4 In Ấn</h4>
              <p>Bản in Vector siêu nét, căn lề chuẩn trang in biểu diễn thánh lễ, lời ca và nốt nhạc rõ ràng.</p>
              <button type="button" id="btn-export-pdf" class="btn-export-action btn-export-pdf">In / Lưu PDF (Ctrl+P)</button>
            </div>
          </div>

          <!-- Card MusicXML -->
          <div class="export-card" id="export-card-xml">
            <div class="export-card-icon xml-icon">🎼</div>
            <div class="export-card-info">
              <h4>Tải MusicXML (.xml / .musicxml)</h4>
              <p>Định dạng phổ quát mở trên MuseScore, Sibelius, Finale giữ nguyên vẹn 4 bè và lời ca.</p>
              <button type="button" id="btn-export-xml" class="btn-export-action btn-export-xml">Tải File MusicXML</button>
            </div>
          </div>

          <!-- Card MIDI -->
          <div class="export-card" id="export-card-midi">
            <div class="export-card-icon midi-icon">🎹</div>
            <div class="export-card-info">
              <h4>Tải File Standard MIDI (.mid)</h4>
              <p>Chứa đầy đủ track nốt của cả 4 bè SATB, cắm trực tiếp vào đàn Organ Yamaha/Roland.</p>
              <button type="button" id="btn-export-midi" class="btn-export-action btn-export-midi">Tải File MIDI</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- ==================== MODAL AI HÒA ÂM 4 BÈ SATB ==================== -->
  <div id="ai-harmonize-modal" class="modal-backdrop hidden">
    <div class="modal-dialog ai-harmonize-dialog">
      <div class="modal-header">
        <div class="modal-header-title">
          <span style="font-size:1.2rem;margin-right:6px;">✨</span>
          <span>Phép Màu AI: Tự Động Hòa Âm 4 Bè SATB</span>
        </div>
        <button id="btn-close-ai-modal" class="btn-modal-close" title="Đóng">&times;</button>
      </div>
      <div class="modal-content-ai">
        <div class="ai-feature-banner">
          <div class="ai-banner-icon">🎼</div>
          <div class="ai-banner-text">
            <strong>Tự động hòa âm ca đoàn 4 bè kinh điển</strong>
            <p>AI sẽ phân tích nốt giai điệu (Soprano) của bài hát, nhận diện giọng điệu chính xác, xây dựng bè Bass nền tảng vững chắc và tự động điền bè Alto & Tenor chuẩn mực cổ điển (không lỗi song song 5/8).</p>
          </div>
        </div>
        <div class="ai-config-grid">
          <div class="ai-config-item">
            <label for="select-ai-style">Phong cách hòa âm:</label>
            <select id="select-ai-style" class="form-input-save">
              <option value="sacred_hymn" selected>Thánh Ca Truyền Thống (Sacred Hymnal - Trầm ấm, trang trọng)</option>
              <option value="bach_chorale">Hợp Xướng Cổ Điển Bach (Chorale Harmony - Chặt chẽ, đa âm)</option>
              <option value="modern_worship">Thánh Ca Hiện Đại (Contemporary Praise - Thoáng đãng)</option>
            </select>
          </div>
          <div class="ai-config-item">
            <label for="select-ai-scope">Phạm vi áp dụng:</label>
            <select id="select-ai-scope" class="form-input-save">
              <option value="all" selected>Toàn bộ bản nhạc (Tất cả các ô nhịp)</option>
              <option value="from_current">Từ ô nhịp hiện tại đến hết bài</option>
            </select>
          </div>
        </div>
        <div class="ai-notice-box">
          <span class="notice-icon">💡</span>
          <span>Bạn luôn có thể nhấn <strong>Hoàn tác (Ctrl+Z)</strong> bất kỳ lúc nào nếu muốn trở về phiên bản trước!</span>
        </div>
      </div>
      <div class="modal-footer">
        <button id="btn-cancel-ai" class="btn-modal-cancel">Hủy bỏ</button>
        <button id="btn-confirm-ai-harmonize" class="btn-modal-confirm btn-ai-confirm">
          <span>⚡ BẮT ĐẦU HÒA ÂM 4 BÈ</span>
        </button>
      </div>
    </div>
  </div>
