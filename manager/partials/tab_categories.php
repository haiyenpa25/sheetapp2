    <!-- ================= TAB 4: QUẢN LÝ THỂ LOẠI & BÀI HÁT (CATEGORIES & SONGS) ================= -->
    <section id="tab-categories" class="mgr-tab-pane active">
      <div class="mgr-section-header" style="display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:0.75rem;">
        <div>
          <h3>📂 Quản Lý Danh Mục &amp; Bài Hát Thư Viện</h3>
          <p class="text-muted">Tạo danh mục, tải lên (Upload MusicXML), sửa tên, xóa bài hát và đồng bộ dữ liệu theo danh mục với GitHub.</p>
        </div>
        <div style="display:flex; flex-wrap:wrap; gap:0.5rem; align-items:center;">
          <button id="btn-sync-github-library" class="mgr-btn mgr-btn-ghost" onclick="window.ManagerCategories?.syncLibraryWithGitHub?.()" title="Lưu bài hát công khai theo thư mục danh mục (storage/Thanh ca/<slug>/) và đồng bộ với GitHub">
            🔄 Đồng Bộ GitHub (Kho Nhạc)
          </button>
          <button id="btn-add-song-top" class="mgr-btn mgr-btn-primary" onclick="window.ManagerCategories?.openUpload?.(0)">
            ➕ Upload Bài Hát (XML)
          </button>
          <button id="btn-add-category-modal" class="mgr-btn mgr-btn-primary">+ Thêm Danh Mục Mới</button>
        </div>
      </div>

      <div class="mgr-categories-grid" id="mgr-categories-grid">
        <!-- Rendered via JS -->
      </div>

      <!-- BẢNG QUẢN LÝ BÀI HÁT TRONG DANH MỤC ĐANG CHỌN -->
      <div id="mgr-cat-songs-section" style="margin-top: 1.75rem; background: var(--bg-surface); border: 1px solid var(--border); border-radius: var(--radius-lg, 10px); padding: 1.25rem;">
        <div style="display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:0.75rem; margin-bottom:1rem; border-bottom:1px solid var(--border); padding-bottom:0.85rem;">
          <div style="display:flex; align-items:center; gap:0.65rem; flex-wrap:wrap;">
            <h4 id="mgr-cat-songs-title" style="margin:0; font-size:1.05rem;">🎼 Danh Sách Bài Hát Theo Danh Mục</h4>
            <select id="mgr-cat-songs-select" class="mgr-input" style="width:auto; min-width:210px; padding:0.35rem 0.65rem; font-size:0.88rem;" onchange="window.ManagerCategories?.selectCategoryForSongs?.(this.value)">
              <option value="">-- Chọn danh mục --</option>
            </select>
          </div>
          <div style="display:flex; flex-wrap:wrap; align-items:center; gap:0.5rem;">
            <input type="text" id="mgr-cat-songs-search" class="mgr-input" placeholder="🔍 Lọc nhanh tên hoặc số bài..." style="width:220px; padding:0.38rem 0.65rem; font-size:0.85rem;" oninput="window.ManagerCategories?.filterCategorySongs?.(this.value)">
            <button id="btn-cat-songs-upload" class="mgr-btn mgr-btn-primary mgr-btn-sm" onclick="window.ManagerCategories?.openUploadForCurrentCategory?.()">
              ➕ Thêm Bài (XML) Vào Danh Mục Này
            </button>
          </div>
        </div>

        <div class="mgr-repertoire-wrapper">
          <table class="mgr-table" id="mgr-cat-songs-table">
            <thead>
              <tr>
                <th style="width: 70px;">Số Bài</th>
                <th>Tên Bài Hát</th>
                <th style="width: 80px; text-align:center;">Tông</th>
                <th style="width: 240px;">Đường Dẫn File XML (Theo Danh Mục)</th>
                <th style="width: 250px; text-align:right;">Quản Lý (Sửa Tên / Xóa / Mở)</th>
              </tr>
            </thead>
            <tbody id="mgr-cat-songs-tbody">
              <tr>
                <td colspan="5" class="mgr-table-loading">
                  <p>Bấm vào một danh mục ở trên để xem, thêm, sửa tên hoặc xóa bài hát.</p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- MODAL SỬA TÊN & THÔNG TIN BÀI HÁT -->
      <div class="mgr-modal-overlay hidden" id="modal-edit-song">
        <div class="mgr-modal-box" style="max-width: 500px;">
          <div class="mgr-modal-header">
            <h3 class="mgr-modal-title">✏️ Sửa Tên &amp; Thông Tin Bài Hát</h3>
            <button type="button" class="mgr-modal-close" data-close="modal-edit-song">✕</button>
          </div>
          <div class="mgr-modal-body">
            <form id="form-edit-song" class="mgr-form">
              <input type="hidden" id="edit-song-id">
              <div class="mgr-form-group">
                <label class="mgr-label">Tên bài hát <span class="text-danger">*</span></label>
                <input type="text" id="edit-song-title" class="mgr-input" placeholder="Nhập tên bài hát..." required>
              </div>
              <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
                <div class="mgr-form-group">
                  <label class="mgr-label">Số thứ tự / Số bài</label>
                  <input type="number" id="edit-song-num" class="mgr-input" placeholder="VD: 1, 25...">
                </div>
                <div class="mgr-form-group">
                  <label class="mgr-label">Tông gốc (Key)</label>
                  <input type="text" id="edit-song-key" class="mgr-input" placeholder="VD: C, G, F, Dm...">
                </div>
              </div>
              <div class="mgr-form-group">
                <label class="mgr-label">Danh mục</label>
                <select id="edit-song-category" class="mgr-input"></select>
              </div>
              <div class="mgr-form-group">
                <label class="mgr-label">Tác giả / Nhạc sĩ (tuỳ chọn)</label>
                <input type="text" id="edit-song-composer" class="mgr-input" placeholder="VD: Truyền thống, NS...">
              </div>
              <div class="mgr-modal-actions">
                <button type="button" class="mgr-btn mgr-btn-ghost" data-close="modal-edit-song">Hủy</button>
                <button type="submit" id="btn-edit-song-submit" class="mgr-btn mgr-btn-primary">💾 Lưu Thay Đổi</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </section>
