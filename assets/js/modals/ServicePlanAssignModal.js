/**
 * assets/js/modals/ServicePlanAssignModal.js
 *
 * Modal Quản Lý Phân Công Ban Nhạc & Ca Đoàn (Epic 3.1 — Service Plan):
 * - Hiển thị danh sách thành viên được phân công kèm vai trò, ghi chú, trạng thái xác nhận.
 * - Cho phép Ca Trưởng / Quản Trị Viên phân công nhân sự mới từ danh sách thành viên.
 * - Hỗ trợ xóa phân công và cập nhật tức thì.
 */

const ServicePlanAssignModal = (() => {
  'use strict';

  function _esc(str) {
    if (window.SafeHtml && typeof window.SafeHtml.escape === 'function') {
      return window.SafeHtml.escape(str);
    }
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  const ROLES = {
    'leader':       '👑 Ca Trưởng / Hát Chính',
    'piano':        '🎹 Piano / Đệm Chính',
    'organ':        '🎼 Organ',
    'guitar':       '🎸 Guitar Acoustic / Solo',
    'bass':         '🎸 Guitar Bass',
    'drums':        '🥁 Trống / Bộ Gõ',
    'vocal':        '🎤 Ca Viên / Lĩnh Xướng',
    'vocal_soprano':'🎤 Nữ Cao (Soprano)',
    'vocal_alto':   '🎤 Nữ Trầm (Alto)',
    'vocal_tenor':  '🎤 Nam Cao (Tenor)',
    'vocal_bass':   '🎤 Nam Trầm (Bass)',
    'sound':        '🎛 Kỹ Thuật Âm Thanh',
    'slides':       '📽 Trình Chiếu / Máy Chiếu'
  };

  let _modalEl = null;
  let _currentSetlistId = null;
  let _usersCache = null;

  function _ensureModalEl() {
    if (_modalEl) return _modalEl;

    const div = document.createElement('div');
    div.id = 'service-plan-assign-modal';
    div.className = 'modal-overlay hidden';
    div.setAttribute('role', 'dialog');
    div.setAttribute('aria-modal', 'true');
    div.setAttribute('aria-labelledby', 'spa-modal-title');
    div.innerHTML = `
      <div class="modal-box" style="max-width: 540px; border: 1px solid rgba(124, 58, 237, 0.35); box-shadow: 0 10px 30px rgba(0,0,0,0.6);">
        <div class="modal-header" style="padding: 1rem 1.25rem; border-bottom: 1px solid var(--border);">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 1.25rem;">👥</span>
            <div>
              <h3 id="spa-modal-title" style="margin: 0; font-size: 1.05rem; font-weight: 700;">Phân Công Ban Nhạc</h3>
              <p id="spa-modal-subtitle" style="margin: 2px 0 0; font-size: 0.76rem; color: var(--text-muted);"></p>
            </div>
          </div>
          <button id="btn-close-spa-modal" class="icon-btn" title="Đóng">✕</button>
        </div>
        <div class="modal-body" style="padding: 1.15rem; display: flex; flex-direction: column; gap: 1rem; max-height: 480px; overflow-y: auto;">
          <!-- Danh sách phân công hiện tại -->
          <div>
            <div style="font-size: 0.76rem; font-weight: 700; text-transform: uppercase; color: var(--text-muted); margin-bottom: 6px;">
              Danh Sách Nhân Sự Tham Gia (<span id="spa-count">0</span>)
            </div>
            <div id="spa-list" style="display: flex; flex-direction: column; gap: 6px; min-height: 50px;">
              <p class="text-muted text-sm text-center py-2">Đang tải...</p>
            </div>
          </div>

          <!-- Form phân công mới (chỉ admin/ca trưởng) -->
          <div id="spa-add-form-wrap" style="border-top: 1px solid var(--border); padding-top: 10px;">
            <div style="font-size: 0.76rem; font-weight: 700; text-transform: uppercase; color: var(--text-muted); margin-bottom: 8px;">
              ➕ Thêm Phân Công Thành Viên
            </div>
            <form id="spa-add-form" onsubmit="return false;" style="display: flex; flex-direction: column; gap: 8px;">
              <div style="display: flex; gap: 8px;">
                <div style="flex: 1;">
                  <label class="form-label text-xs">Thành viên</label>
                  <select id="spa-user-select" class="form-input text-xs" style="width: 100%;" required>
                    <option value="">-- Chọn thành viên --</option>
                  </select>
                </div>
                <div style="flex: 1;">
                  <label class="form-label text-xs">Vai trò</label>
                  <select id="spa-role-select" class="form-input text-xs" style="width: 100%;">
                    ${Object.entries(ROLES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}
                  </select>
                </div>
              </div>
              <div>
                <label class="form-label text-xs">Ghi chú riêng (không bắt buộc)</label>
                <input id="spa-notes-input" type="text" class="form-input text-xs" placeholder="VD: Dạo intro bài 1, bè Nam phụ, hát lĩnh xướng...">
              </div>
              <button id="btn-spa-submit" type="button" class="btn btn-primary btn-sm" style="font-weight: 700; align-self: flex-end; padding: 6px 14px;">
                ✓ Thêm Phân Công
              </button>
            </form>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(div);
    _modalEl = div;

    // Gán nút đóng
    div.querySelector('#btn-close-spa-modal')?.addEventListener('click', close);
    div.querySelector('#btn-spa-submit')?.addEventListener('click', _handleAddAssignment);

    return div;
  }

  async function show(setlistId, setlistTitle = '') {
    _currentSetlistId = setlistId;
    const modal = _ensureModalEl();

    const subtitleEl = modal.querySelector('#spa-modal-subtitle');
    if (subtitleEl) subtitleEl.textContent = setlistTitle || `Chương trình #${setlistId}`;

    if (window.ModalManager) {
      window.ModalManager.open(modal);
    } else {
      modal.classList.remove('hidden');
    }

    await Promise.all([
      _loadUsersDropdown(),
      _loadAssignments()
    ]);
  }

  function close() {
    if (_modalEl) {
      if (window.ModalManager) {
        window.ModalManager.close(_modalEl);
      } else {
        _modalEl.classList.add('hidden');
      }
    }
  }

  async function _loadUsersDropdown() {
    if (_usersCache) {
      _renderUsersDropdown(_usersCache);
      return;
    }
    try {
      const res = await window.ApiService.users.list();
      if (res.success && Array.isArray(res.data)) {
        _usersCache = res.data;
        _renderUsersDropdown(_usersCache);
      }
    } catch (e) {
      console.error('[ServicePlanAssignModal] Error loading users:', e);
    }
  }

  function _renderUsersDropdown(users) {
    const sel = _modalEl.querySelector('#spa-user-select');
    if (!sel) return;
    sel.innerHTML = '<option value="">-- Chọn thành viên --</option>' +
      users.map(u => {
        const chordBadge = u.chord_code ? ` [${u.chord_code}]` : '';
        const instrument = u.instrument ? ` (${u.instrument})` : '';
        return `<option value="${u.id}">${_esc(u.display_name || u.username)}${chordBadge}${instrument}</option>`;
      }).join('');
  }

  async function _loadAssignments() {
    const listEl = _modalEl.querySelector('#spa-list');
    const countEl = _modalEl.querySelector('#spa-count');
    if (!listEl) return;

    try {
      const res = await window.ApiService.setlists.get(_currentSetlistId);
      if (!res.success || !res.data) {
        listEl.innerHTML = '<p class="text-muted text-sm text-center py-2">Không thể tải danh sách phân công.</p>';
        return;
      }

      const assignments = res.data.assignments || [];
      if (countEl) countEl.textContent = String(assignments.length);

      if (assignments.length === 0) {
        listEl.innerHTML = '<p class="text-muted text-sm text-center py-2" style="background: rgba(255,255,255,0.02); border-radius: 6px;">Chưa có thành viên nào được phân công. Hãy thêm ở form dưới!</p>';
        return;
      }

      listEl.innerHTML = assignments.map(a => {
        const roleLabel = ROLES[a.role] || a.role;
        let statusBadge = '<span class="tag tag-amber" style="font-size:0.68rem;">⏳ Chờ nhận lời</span>';
        if (a.status === 'confirmed') {
          statusBadge = '<span class="tag tag-green" style="font-size:0.68rem;">✅ Đã nhận lời</span>';
        } else if (a.status === 'declined') {
          statusBadge = '<span class="tag tag-red" style="font-size:0.68rem;">❌ Báo bận</span>';
        }

        const notes = a.notes ? `<div style="font-size:0.73rem; color:var(--text-muted); margin-top:2px;">📝 ${_esc(a.notes)}</div>` : '';

        return `
          <div style="display:flex; align-items:center; justify-content:space-between; padding:8px 10px; background:var(--bg-overlay); border-radius:6px; border:1px solid var(--border);">
            <div style="min-width:0; flex:1;">
              <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                <strong style="font-size:0.85rem; color:var(--text-primary);">${_esc(a.display_name || a.username)}</strong>
                <span class="tag" style="font-size:0.68rem; font-weight:600;">${_esc(roleLabel)}</span>
                ${statusBadge}
              </div>
              ${notes}
            </div>
            <button class="icon-btn-xs text-danger btn-spa-del" data-id="${a.id}" title="Gỡ phân công" style="margin-left:8px;">✕</button>
          </div>
        `;
      }).join('');

      // Gán sự kiện gỡ phân công
      listEl.querySelectorAll('.btn-spa-del').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const assignId = btn.dataset.id;
          if (confirm('Bạn chắc muốn gỡ thành viên này khỏi chương trình?')) {
            try {
              await window.ApiService.setlists.removeAssignment(assignId);
              window.App?.showToast?.('Đã gỡ phân công', 'info');
              _loadAssignments();
              window.SetlistUI?.fetchSetlists?.();
            } catch (err) {
              window.App?.showToast?.('Lỗi: ' + err.message, 'error');
            }
          }
        });
      });

    } catch (e) {
      listEl.innerHTML = '<p class="text-danger text-sm text-center py-2">Lỗi tải dữ liệu.</p>';
    }
  }

  async function _handleAddAssignment() {
    const userSelect = _modalEl.querySelector('#spa-user-select');
    const roleSelect = _modalEl.querySelector('#spa-role-select');
    const notesInput = _modalEl.querySelector('#spa-notes-input');

    const userId = parseInt(userSelect?.value, 10);
    const role = roleSelect?.value || 'vocal';
    const notes = notesInput?.value?.trim() || null;

    if (!userId) {
      window.App?.showToast?.('Vui lòng chọn thành viên', 'warning');
      return;
    }

    try {
      window.App?.showLoading?.('Đang lưu phân công...');
      const res = await window.ApiService.setlists.assign({
        setlist_id: _currentSetlistId,
        user_id: userId,
        role: role,
        notes: notes
      });

      window.App?.hideLoading?.();
      if (res.success) {
        window.App?.showToast?.('✨ Đã phân công thành viên thành công!', 'success');
        if (notesInput) notesInput.value = '';
        _loadAssignments();
        window.SetlistUI?.fetchSetlists?.();
      } else {
        window.App?.showToast?.(res.error || 'Phân công thất bại', 'error');
      }
    } catch (e) {
      window.App?.hideLoading?.();
      window.App?.showToast?.('Lỗi phân công: ' + e.message, 'error');
    }
  }

  return {
    show,
    close
  };
})();

if (typeof window !== 'undefined') {
  window.ServicePlanAssignModal = ServicePlanAssignModal;
}
