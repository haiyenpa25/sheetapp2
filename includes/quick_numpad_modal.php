<!-- ===== QUICK NUMPAD MODAL (Ticket L2-5) ===== -->
<div id="modal-quick-numpad" class="modal-overlay hidden" role="dialog" aria-modal="true" aria-labelledby="quick-numpad-title">
  <div class="modal-box quick-numpad-box">
    <div class="modal-header numpad-modal-header">
      <div class="d-flex items-center gap-2">
        <span class="fs-lg">🔢</span>
        <h3 id="quick-numpad-title" class="m-0 font-bold fs-base">Bàn Phím Số Nhanh</h3>
      </div>
      <button id="btn-close-quick-numpad" class="icon-btn" aria-label="Đóng bàn phím số">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-20"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>

    <div class="modal-body d-flex flex-col gap-3">
      <!-- Màn hình hiển thị số & bài hát khớp -->
      <div class="numpad-screen">
        <div class="numpad-screen-label">Số Bài Thánh Ca</div>
        <div class="numpad-digits-row">
          <span class="numpad-prefix">#</span><span id="numpad-display-digits">---</span>
        </div>
        <div id="numpad-song-match" class="numpad-song-match" title="Nhấp để mở bài hát này">
          Nhập số bài 1 - 903...
        </div>
      </div>

      <!-- Bàn phím số cảm ứng lớn (Grid 3x4) -->
      <div class="numpad-grid">
        <button type="button" class="btn-numpad-key" data-digit="1">1</button>
        <button type="button" class="btn-numpad-key" data-digit="2">2</button>
        <button type="button" class="btn-numpad-key" data-digit="3">3</button>

        <button type="button" class="btn-numpad-key" data-digit="4">4</button>
        <button type="button" class="btn-numpad-key" data-digit="5">5</button>
        <button type="button" class="btn-numpad-key" data-digit="6">6</button>

        <button type="button" class="btn-numpad-key" data-digit="7">7</button>
        <button type="button" class="btn-numpad-key" data-digit="8">8</button>
        <button type="button" class="btn-numpad-key" data-digit="9">9</button>

        <button type="button" class="btn-numpad-key btn-numpad-action" data-action="clear" title="Xóa toàn bộ (Clear)" aria-label="Xóa toàn bộ">C</button>
        <button type="button" class="btn-numpad-key" data-digit="0">0</button>
        <button type="button" class="btn-numpad-key btn-numpad-action" data-action="backspace" title="Xóa 1 số (Backspace)" aria-label="Xóa 1 số">⌫</button>
      </div>

      <!-- Nút Mở Bài lớn (Action Button) -->
      <button id="btn-numpad-open" class="btn btn-primary btn-lg btn-numpad-open" disabled>
        <span>▶ Mở Bài</span>
        <span id="btn-numpad-open-badge" class="numpad-open-badge">(Enter)</span>
      </button>
    </div>
  </div>
</div>
