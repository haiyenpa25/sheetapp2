<!-- ===== ADMIN CONSOLE MODAL ===== -->
<div id="admin-modal" class="modal-overlay hidden">
  <div class="modal-box" style="max-width: 900px; width: 95%; height: 85vh; display: flex; flex-direction: column; overflow: hidden; padding: 0;">
    <div class="modal-header" style="flex-shrink: 0; border-bottom: 1px solid var(--border); padding: 1rem 1.5rem;">
      <h3 style="margin: 0; display: flex; align-items: center; gap: 0.5rem;">⚙️ Bảng Điều Khiển Quản Trị</h3>
      <button id="btn-close-admin" class="icon-btn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    
    <div class="modal-body" style="padding: 0; display: flex; flex: 1; min-height: 0; flex-direction: row; align-items: stretch;">
      
      <!-- ADMIN SIDEBAR -->
      <div class="admin-sidebar" style="width: 220px; background: var(--bg-surface); border-right: 1px solid var(--border); display: flex; flex-direction: column; overflow-y: auto; padding-top: 0.5rem;">
        <button class="admin-tab-btn active" data-target="admin-tab-import">📥 Nạp Dữ Liệu (Import)</button>
        <button class="admin-tab-btn" data-target="admin-tab-categories">📂 Thể Loại Nhạc</button>
        <button class="admin-tab-btn" data-target="admin-tab-songs">🎼 Cơ Sở Bài Hát</button>
        <button class="admin-tab-btn" data-target="admin-tab-chords">🎸 Cấu Hình Hợp Âm</button>
        <!-- <button class="admin-tab-btn" data-target="admin-tab-users">🔐 Quản Lý Quyền</button> -->
      </div>

      <!-- ADMIN CONTENT AREA -->
      <div class="admin-content" style="flex: 1; padding: 1.5rem; overflow-y: auto; background: var(--bg-overlay);">
        
        <!-- =============================================
             1. IMPORT & OMR (Kế thừa logic cũ của importer.js)
             ============================================= -->
        <div id="admin-tab-import" class="admin-panel">
          <h4 style="margin-top:0; margin-bottom: 1rem;">Nạp Bài Hát Mới</h4>
          
          <div class="tab-switcher" id="import-tabs" style="margin-bottom: 1rem; border-bottom: 1px solid var(--border); display: flex; gap: 1rem; padding-bottom: 0.5rem;">
            <button class="tab-btn active" data-tab="url">🌐 URL Thánh Ca</button>
            <button class="tab-btn" data-tab="upload">📁 Upload File</button>
            <button class="tab-btn" data-tab="direct">🔗 URL XML</button>
            <button class="tab-btn" data-tab="omr">🤖 OMR Station</button>
          </div>

          <div id="tab-url" class="tab-content active">
            <p class="help-text">Dán link bài hát từ <strong>thanhca.httlvn.org</strong></p>
            <div class="input-group">
              <input id="import-url-input" type="url" class="form-input" placeholder="https://thanhca.httlvn.org/thanh-ca-1/ten-bai-hat?op=sheet">
              <button id="btn-fetch-url" class="btn btn-primary">Tải Về</button>
            </div>
            <div class="form-row mt-1">
              <label class="form-label">Tên hiển thị</label>
              <input id="import-url-title" type="text" class="form-input" placeholder="VD: Cúi Xin Vua Thánh Ngự Lại">
            </div>
            <div id="url-examples" class="url-examples mt-1">
              <p class="text-xs text-muted">Ví dụ:</p>
              <code class="url-example-code">https://thanhca.httlvn.org/thanh-ca-1/cui-xin-vua-thanh-ngu-lai?op=sheet</code>
            </div>
          </div>

          <div id="tab-upload" class="tab-content hidden">
            <p class="help-text">Tải file MusicXML (<code>.xml</code> hoặc <code>.mxl</code>) từ máy tính</p>
            <div id="drop-zone" class="drop-zone">
              <div class="drop-icon">📂</div>
              <p>Kéo thả file .xml vào đây</p>
              <small>hoặc</small>
              <label class="btn btn-ghost btn-sm mt-1">Chọn File<input id="file-input" type="file" accept=".xml,.mxl,.musicxml" style="display:none"></label>
            </div>
            <div id="file-selected" class="file-selected hidden">
              <span class="file-icon">🎵</span><span id="file-name-display"></span>
              <button id="btn-clear-file" class="icon-btn-xs">✕</button>
            </div>
            <div class="form-row mt-1">
              <label class="form-label">Tên hiển thị</label>
              <input id="import-upload-title" type="text" class="form-input" placeholder="Nhập tên bài hát">
            </div>
            <button id="btn-do-upload" class="btn btn-primary w-full mt-1" disabled>📤 Upload & Thêm Vào Kho</button>
          </div>

          <div id="tab-direct" class="tab-content hidden">
            <p class="help-text">URL trực tiếp đến file .xml hoặc .mxl</p>
            <div class="input-group">
              <input id="import-direct-input" type="url" class="form-input" placeholder="https://example.com/sheet.xml">
              <button id="btn-fetch-direct" class="btn btn-primary">Tải Về</button>
            </div>
            <div class="form-row mt-1">
              <label class="form-label">Tên hiển thị</label>
              <input id="import-direct-title" type="text" class="form-input" placeholder="Nhập tên bài hát">
            </div>
          </div>

          <div id="tab-omr" class="tab-content hidden">
            <p class="help-text">Tải file <strong>PDF / Hình ảnh</strong> rành rọt để nhận diện (MusicXML).</p>
            <div id="omr-drop-zone" class="drop-zone">
              <div class="drop-icon">📷</div>
              <p>Kéo thả file hình vào đây</p>
              <label class="btn btn-ghost btn-sm mt-1">Chọn File<input id="omr-file-input" type="file" accept=".pdf,image/*" style="display:none"></label>
            </div>
            
            <div class="omr-queue mt-1 hidden" id="omr-queue-container" style="background:var(--bg-surface); border:1px solid var(--border); border-radius:var(--radius-sm); padding:.75rem;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: .5rem;">
                <p class="help-text" style="margin:0; font-weight:bold;">Hàng chờ xử lý OMR</p>
                <button id="btn-omr-refresh" class="icon-btn-xs" title="Làm mới">🔄</button>
              </div>
              <div id="omr-queue-list" style="max-height: 200px; overflow-y: auto; font-size:.85rem;"></div>
            </div>

            <div id="omr-review-container" class="mt-1 hidden" style="border: 1px dashed var(--accent); padding: 1rem; border-radius: var(--radius-sm); background: var(--bg-surface);">
              <p class="help-text" style="color:var(--accent); font-weight:bold;">Duyệt bài hát</p>
              <input type="hidden" id="omr-review-id">
              <div class="form-row">
                <label class="form-label">Tên hiển thị</label>
                <input id="omr-review-title" type="text" class="form-input" placeholder="Tên bài hát">
              </div>
              <div class="form-row mt-1">
                <label class="form-label">Danh mục (Category)</label>
                <select id="omr-review-category" class="form-input"></select>
              </div>
              <div style="display:flex; gap:.5rem; margin-top:1rem;">
                <button id="btn-omr-publish" class="btn btn-primary flex-1">Đưa Vào Kho</button>
                <button id="btn-omr-preview" class="btn btn-ghost flex-1">Xem Thử (Preview)</button>
              </div>
            </div>
          </div>

          <div id="import-progress" class="import-progress hidden mt-1">
            <div class="progress-bar-wrap"><div id="import-progress-bar" class="progress-bar"></div></div>
            <p id="import-progress-text" class="text-sm text-muted mt-half">Đang xử lý...</p>
          </div>
          <div id="import-result" class="import-result hidden mt-1"></div>
        </div>

        <!-- =============================================
             2. QUẢN LÝ DANH MỤC
             ============================================= -->
        <div id="admin-tab-categories" class="admin-panel hidden">
          <div style="display:flex; justify-content:space-between; margin-bottom:1rem; align-items:center;">
             <h4 style="margin:0;">Thể Loại Nhạc</h4>
             <button id="btn-admin-add-category" class="btn btn-sm btn-primary">+ Thêm Danh Mục</button>
          </div>
          <div style="background:var(--bg-surface); border:1px solid var(--border); border-radius:var(--radius-md); overflow:hidden;">
            <table class="admin-table" id="admin-categories-table">
               <thead>
                 <tr>
                   <th style="width: 50px;">ID</th>
                   <th>Tên Danh Mục</th>
                   <th style="width: 150px; text-align:center;">Hành Động</th>
                 </tr>
               </thead>
               <tbody><!-- Rendered via JS --></tbody>
            </table>
          </div>
        </div>

        <!-- =============================================
             3. QUẢN LÝ BÀI HÁT
             ============================================= -->
        <div id="admin-tab-songs" class="admin-panel hidden">
          <div style="display:flex; justify-content:space-between; margin-bottom:1rem; align-items:center; gap: 1rem;">
             <h4 style="margin:0; white-space:nowrap;">Cơ Sở Bài Hát</h4>
             <input type="text" id="admin-song-search" class="form-input" placeholder="Tìm tên bài hát..." style="max-width: 300px;">
          </div>
          <div style="background:var(--bg-surface); border:1px solid var(--border); border-radius:var(--radius-md); overflow:hidden;">
            <table class="admin-table" id="admin-songs-table">
               <thead>
                 <tr>
                   <th>Tựa Đề Của Bài Hát</th>
                   <th style="width: 25%;">Danh Mục</th>
                   <th style="width: 150px; text-align:center;">Hành Động</th>
                 </tr>
               </thead>
               <tbody><!-- Rendered via JS --></tbody>
            </table>
          </div>
        </div>

        <!-- =============================================
             4. QUẢN LÝ NGƯỜI DÙNG (Tắt tạm nếu chưa có luồng users)
             ============================================= -->
        <div id="admin-tab-users" class="admin-panel hidden">
          <!-- TODO -->
        </div>

        <!-- =============================================
             5. CẤU HÌNH HỢP ÂM (PER DEVICE)
             ============================================= -->
        <div id="admin-tab-chords" class="admin-panel hidden" style="height: 100%; display: flex; flex-direction: column;">
          <h4 style="margin-top:0; border-bottom: 1px solid var(--border); padding-bottom: 0.5rem; margin-bottom: 1rem;">Cấu Hình Hợp Âm Hiển Thị (Máy Này)</h4>
          <p class="text-xs text-muted" style="margin-top:-0.5rem; margin-bottom: 1rem;">Cấu hình này sẽ lưu cục bộ trên thiết bị hiện tại, giúp Admin kiểm soát tuỳ ý mức độ To/Nhỏ của Hợp âm riêng cho từng cái iPad mà không ảnh hưởng toàn hệ thống.</p>

          <div style="display: flex; gap: 2rem; flex: 1; min-height: 0;">
            <!-- SIDEBAR SETTINGS -->
            <div style="width: 250px; background: var(--bg-surface); padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--border); display: flex; flex-direction: column; gap: 1rem;">
              
              <div>
                <label class="form-label" style="display:flex; justify-content:space-between;">Size Hợp Âm <span id="lbl-chord-size" style="color:var(--accent); font-weight:bold;">3.0</span></label>
                <input type="range" id="chord-size-slider" min="1.0" max="6.0" step="0.1" value="3.0" style="width:100%;">
              </div>
              
              <div>
                <label class="form-label" style="display:flex; justify-content:space-between;">Chiều Cao Từ Khuông Lên <span id="lbl-chord-y" style="color:var(--accent); font-weight:bold;">1.5</span></label>
                <input type="range" id="chord-y-slider" min="0.0" max="6.0" step="0.1" value="1.5" style="width:100%;">
              </div>

              <div>
                <label class="form-label">Màu Sắc Hợp Âm</label>
                <input type="color" id="chord-color-picker" value="#dc2626" style="width: 100%; height: 40px; border: none; border-radius: vả(--radius-sm); cursor: pointer;">
              </div>

              <div style="margin-top: auto;">
                 <button id="btn-reset-chord-settings" class="btn btn-ghost w-full mb-half text-sm">↩️ Mặc Định</button>
                 <button id="btn-save-chord-settings" class="btn btn-primary w-full shadow-sm">💾 Lưu Cấu Hình</button>
              </div>
            </div>

            <!-- PREVIEW CANVAS -->
            <div style="flex: 1; background: #fff; border: 1px solid var(--border); border-radius: var(--radius-md); overflow: hidden; display: flex; flex-direction: column;">
              <div style="background: var(--bg-overlay); padding: 0.5rem 1rem; border-bottom: 1px solid var(--border); font-size: 0.8rem; font-weight: bold; color: var(--text-secondary);">
                Preview Mẫu (Live)
              </div>
              <div id="osmd-chord-preview-container" style="flex: 1; overflow: auto; padding: 1rem; position: relative;">
                 <!-- OSMD Mini Container -->
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  </div>
</div>

<style>
/* Styling for Admin Console Dashboard */
.admin-tab-btn {
  display: block; width: 100%; text-align: left; padding: 0.85rem 1.5rem; 
  background: transparent; border: none; border-left: 3px solid transparent; 
  color: var(--text-secondary); font-weight: 500; font-size: 0.95rem; cursor: pointer;
  transition: all 0.2s;
  outline: none;
}
.admin-tab-btn:hover { background: var(--bg-overlay); color: var(--text-primary); }
.admin-tab-btn.active { 
  border-left-color: var(--accent); background: rgba(109,40,217, 0.08); 
  color: var(--accent); font-weight: 600; 
}
.admin-table { width:100%; border-collapse: collapse; font-size: 0.85rem; }
.admin-table th { padding: 0.75rem 1rem; background:var(--bg-overlay); border-bottom:1px solid var(--border); text-align:left; font-weight: 600; color: var(--text-muted); text-transform: uppercase; font-size: 0.7rem; letter-spacing: 0.5px; }
.admin-table td { padding: 0.75rem 1rem; border-bottom: 1px solid var(--border); }
.admin-table tr:last-child td { border-bottom: none; }
.admin-table tbody tr:hover { background: rgba(0,0,0,0.02); }
</style>
