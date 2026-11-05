    <!-- ================= TAB: HỘI THÁNH & THÀNH VIÊN (cờ MULTI_CHURCH) ================= -->
    <section id="tab-churches" class="mgr-tab-pane">
      <div class="mgr-section-header">
        <div>
          <h3>⛪ Hội Thánh &amp; Thành Viên</h3>
          <p class="text-muted">Mỗi Hội Thánh có chương trình lễ riêng. Quản trị Hội Thánh duyệt ai được xem.</p>
        </div>
      </div>

      <div class="mgr-church-bar">
        <label for="church-select" class="mgr-church-label">Hội Thánh đang làm việc</label>
        <select id="church-select" class="mgr-input"></select>
      </div>

      <div class="mgr-church-join">
        <label for="church-join-code" class="mgr-church-label">Vào Hội Thánh khác bằng mã mời</label>
        <div class="mgr-church-row">
          <input id="church-join-code" class="mgr-input" maxlength="8" autocomplete="off" placeholder="VD: A1B2C3D4">
          <button id="btn-church-join" type="button" class="mgr-btn mgr-btn-primary">Gửi yêu cầu</button>
        </div>
        <p id="church-pending" class="text-muted" hidden></p>
      </div>

      <div id="church-admin-box" hidden>
        <div class="mgr-church-row">
          <input id="church-name" class="mgr-input" maxlength="80" aria-label="Tên Hội Thánh">
          <button id="btn-church-rename" type="button" class="mgr-btn mgr-btn-ghost">Đổi tên</button>
        </div>
        <div class="mgr-church-row">
          <span class="mgr-church-label">Mã mời:</span>
          <code id="church-invite-code" class="mgr-church-code"></code>
          <button id="btn-church-regen" type="button" class="mgr-btn mgr-btn-ghost">Đổi mã mới</button>
        </div>
        <div class="mgr-users-table-wrapper">
          <table class="mgr-table" id="mgr-church-members">
            <thead>
              <tr>
                <th>Thành viên</th>
                <th>Vai trò</th>
                <th>Trạng thái</th>
                <th style="text-align:right;">Hành động</th>
              </tr>
            </thead>
            <tbody id="church-members-tbody"></tbody>
          </table>
        </div>
      </div>

      <div id="church-create-box" class="mgr-church-join" hidden>
        <label for="church-new-name" class="mgr-church-label">Tạo Hội Thánh mới (Admin hệ thống)</label>
        <div class="mgr-church-row">
          <input id="church-new-name" class="mgr-input" maxlength="80" placeholder="Tên Hội Thánh">
          <button id="btn-church-create" type="button" class="mgr-btn mgr-btn-primary">Tạo</button>
        </div>
      </div>
    </section>
