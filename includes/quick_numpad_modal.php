<!-- ===== QUICK NUMPAD MODAL (Ticket L2-5) ===== -->
<div id="modal-quick-numpad" class="modal-overlay hidden" role="dialog" aria-modal="true" aria-labelledby="quick-numpad-title">
  <div class="modal-box quick-numpad-box" style="position:relative;">
    <div class="modal-header" style="display:flex; align-items:center; justify-content:space-between; margin-bottom: 0.75rem; border-bottom: 1px solid var(--border); padding-bottom: 0.5rem;">
      <div style="display:flex; align-items:center; gap: 0.5rem;">
        <span style="font-size: 1.25rem;">🔢</span>
        <h3 id="quick-numpad-title" style="margin: 0; font-size: 1.1rem; font-weight: 700;">Bàn Phím Số Nhanh</h3>
      </div>
      <button id="btn-close-quick-numpad" class="icon-btn" aria-label="Đóng bàn phím số">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px;height:20px;"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>

    <div class="modal-body" style="display:flex; flex-direction:column; gap: 0.85rem;">
      <!-- Màn hình hiển thị số & bài hát khớp -->
      <div class="numpad-screen">
        <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px;">Số Bài Thánh Ca</div>
        <div class="numpad-digits-row">
          <span style="opacity: 0.6; margin-right: 4px;">#</span><span id="numpad-display-digits">---</span>
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
      <button id="btn-numpad-open" class="btn btn-primary btn-lg btn-numpad-open" style="width: 100%; height: 50px; font-size: 1.05rem; font-weight: 700; border-radius: var(--radius-md); display: flex; align-items: center; justify-content: center; gap: 8px;" disabled>
        <span>▶ Mở Bài</span>
        <span id="btn-numpad-open-badge" style="font-size: 0.85rem; font-weight: 600; opacity: 0.9;">(Enter)</span>
      </button>
    </div>
  </div>
</div>
