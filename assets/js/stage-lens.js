/**
 * assets/js/stage-lens.js
 *
 * Stage Lens — Góc Nhìn Theo Vai Trò Nhạc Cụ (Chương L4):
 * - Ticket L4-1: Lần đầu mở, chọn vai trò: Guitar · Keyboard · Bass · Trống · Hát (lưu theo thiết bị; đổi bằng 1 icon).
 * - Quản lý 5 vai trò nhạc công chính với các preset tối ưu giao diện.
 * - Lưu trạng thái vào localStorage ('sheetapp_instrument_role') và đồng bộ vào Store ('instrumentRole').
 * - Phát sự kiện EventBus 'role:changed' cho toàn bộ hệ thống.
 */
const StageLens = (() => {
  'use strict';

  const STORAGE_KEY = 'sheetapp_instrument_role';

  const ROLES = [
    { id: 'guitar',   label: 'Guitar',   icon: '🎸', desc: 'Lời & Hợp âm chữ / Thế bấm Capo' },
    { id: 'keyboard', label: 'Keyboard', icon: '🎹', desc: 'Bản nhạc 2 khuông + Hợp âm' },
    { id: 'bass',     label: 'Bass',     icon: '🎻', desc: 'Nốt gốc Bass to & Hợp âm đảo' },
    { id: 'drums',    label: 'Trống',    icon: '🥁', desc: 'Bản đồ bài hát, BPM & Đèn nhịp' },
    { id: 'vocals',   label: 'Hát',      icon: '🎤', desc: 'Một khổ, giai điệu, ẩn khuông Fa' },
  ];

  let _currentRole = 'guitar';

  function getRoles() {
    return ROLES.map(r => ({ ...r }));
  }

  function getRoleInfo(roleId) {
    const id = String(roleId || _currentRole).toLowerCase();
    return ROLES.find(r => r.id === id) || ROLES[0];
  }

  function getCurrentRole() {
    return _currentRole;
  }

  function _updateToolbarUI(info) {
    const iconEl = document.getElementById('instrument-role-icon');
    if (iconEl) iconEl.textContent = info.icon;
    const labelEl = document.getElementById('instrument-role-label');
    if (labelEl) labelEl.textContent = info.label;

    const btn = document.getElementById('btn-instrument-role');
    if (btn) {
      btn.title = `Vai trò: ${info.icon} ${info.label} (Bấm để đổi vai trò)`;
      btn.setAttribute('aria-label', `Vai trò hiện tại: ${info.label}`);
    }
  }

  function setRole(roleId, persist = true, notify = true) {
    const info = getRoleInfo(roleId);
    _currentRole = info.id;

    if (persist && typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, _currentRole);
      } catch (e) {
        console.warn('[StageLens] Failed to save role to localStorage:', e);
      }
    }

    if (window.Store) {
      window.Store.set('instrumentRole', _currentRole);
    }

    if (typeof document !== 'undefined' && document.body) {
      document.body.dataset.stageLens = _currentRole;
    }

    _updateToolbarUI(info);
    _applyRoleAdaptations(_currentRole);

    if (notify && window.App?.showToast) {
      window.App.showToast(`🎯 Vai trò: ${info.icon} ${info.label}`, 'info', 1800);
    }

    if (typeof EventBus !== 'undefined') {
      EventBus.emit('role:changed', { role: _currentRole, info });
    }

    return info;
  }

  function _applyRoleAdaptations(roleId) {
    if (typeof document === 'undefined') return;

    if (roleId === 'keyboard') {
      // Ticket L4-3: Keyboard: Bản nhạc đầy đủ + Hợp âm
      const lyricContainer = document.getElementById('lyric-view-container');
      const osmdContainer = document.getElementById('osmd-container');
      const btnBand = document.getElementById('btn-band-toggle') || document.getElementById('btn-lyric-view');

      // Nếu đang mở chế độ Lời/Band: chuyển sang Bản nhạc
      if (lyricContainer && !lyricContainer.classList.contains('hidden')) {
        lyricContainer.classList.add('hidden');
        if (osmdContainer) osmdContainer.style.display = 'block';
        if (btnBand) {
          btnBand.classList.remove('active');
          const txt = btnBand.querySelector('.view-text') || btnBand.querySelector('.btn-text');
          if (txt) txt.textContent = 'Lời Nhạc';
        }
        window.URLState?.update?.({ v: 'sheet' });
        try { localStorage.setItem('sheetapp_view_mode', 'sheet'); } catch (_) {}
        if (window.ChordCanvas?.reposition) {
          setTimeout(() => window.ChordCanvas.reposition(), 100);
        }
      }

      // Đảm bảo hiển thị hợp âm trên bản nhạc
      if (window.ChordCanvas?.showChords) {
        window.ChordCanvas.showChords();
      }

      // Ẩn thanh guitar bar nếu có
      const guitarBar = document.getElementById('guitar-lens-bar');
      if (guitarBar) guitarBar.classList.add('hidden');
    } else if (roleId === 'guitar') {
      const guitarBar = document.getElementById('guitar-lens-bar');
      if (guitarBar) guitarBar.classList.remove('hidden');
      if (window.GuitarLens?.refreshPalette) {
        setTimeout(() => window.GuitarLens.refreshPalette(), 200);
      }
    }
  }

  function _createPickerModal() {
    let modal = document.getElementById('modal-stage-lens');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'modal-stage-lens';
    modal.className = 'modal modal-stage-lens hidden';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'stage-lens-modal-title');

    modal.innerHTML = `
      <div class="modal-backdrop" id="stage-lens-modal-backdrop"></div>
      <div class="modal-box modal-stage-lens-box" style="max-width:440px;width:90%;">
        <div class="modal-header" style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border);padding-bottom:10px;">
          <div>
            <h3 id="stage-lens-modal-title" style="margin:0;font-size:1.1rem;display:flex;align-items:center;gap:6px;">
              <span>🎯</span> Chọn Vai Trò Của Bạn
            </h3>
            <small id="stage-lens-modal-desc" style="color:var(--text-muted);font-size:0.75rem;">Giao diện sẽ tối ưu hóa theo nhạc cụ bạn chơi trên sân khấu:</small>
          </div>
          <button id="btn-close-stage-lens" class="icon-btn-xs" title="Đóng (Esc)" aria-label="Đóng" style="font-size:1.1rem;">✕</button>
        </div>
        <div class="modal-body" style="padding:14px 0 6px 0;display:flex;flex-direction:column;gap:8px;">
          <div id="stage-lens-roles-list" style="display:flex;flex-direction:column;gap:8px;">
            ${ROLES.map(r => `
              <button type="button" class="stage-lens-role-card ${r.id === _currentRole ? 'active' : ''}" data-role="${r.id}" style="display:flex;align-items:center;gap:12px;padding:10px 14px;border:1px solid var(--border);border-radius:8px;background:var(--bg-overlay, rgba(255,255,255,0.05));cursor:pointer;text-align:left;transition:all 0.15s ease;touch-action:manipulation;min-height:48px;">
                <span class="role-card-icon" style="font-size:1.6rem;min-width:32px;text-align:center;">${r.icon}</span>
                <div style="flex:1;">
                  <div style="font-weight:700;font-size:0.92rem;color:var(--text-primary);">${r.label}</div>
                  <div style="font-size:0.74rem;color:var(--text-muted);margin-top:2px;">${r.desc}</div>
                </div>
                <span class="role-card-check" style="font-size:1rem;color:var(--accent,#8b5cf6);opacity:${r.id === _currentRole ? '1' : '0'};">✓</span>
              </button>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const closeBtn = modal.querySelector('#btn-close-stage-lens');
    const backdrop = modal.querySelector('#stage-lens-modal-backdrop');
    const closeHandler = () => closePicker();
    if (closeBtn) closeBtn.addEventListener('click', closeHandler);
    if (backdrop) backdrop.addEventListener('click', closeHandler);

    const cards = modal.querySelectorAll('.stage-lens-role-card');
    cards.forEach(card => {
      card.addEventListener('click', () => {
        const role = card.dataset.role;
        if (role) {
          setRole(role, true, true);
          closePicker();
        }
      });
    });

    return modal;
  }

  function showPicker(isFirstTime = false) {
    const modal = _createPickerModal();
    const descEl = modal.querySelector('#stage-lens-modal-desc');
    if (descEl && isFirstTime) {
      descEl.textContent = 'Chào mừng! Hãy chọn nhạc cụ bạn chơi để SheetApp tối ưu hóa góc nhìn tốt nhất:';
    }

    // Cập nhật trạng thái active của các thẻ
    const cards = modal.querySelectorAll('.stage-lens-role-card');
    cards.forEach(card => {
      const isAct = card.dataset.role === _currentRole;
      card.classList.toggle('active', isAct);
      const chk = card.querySelector('.role-card-check');
      if (chk) chk.style.opacity = isAct ? '1' : '0';
    });

    if (window.ModalManager) {
      window.ModalManager.open(modal);
    } else {
      modal.classList.remove('hidden');
    }
  }

  function closePicker() {
    const modal = document.getElementById('modal-stage-lens');
    if (!modal) return;
    if (window.ModalManager) {
      window.ModalManager.close(modal);
    } else {
      modal.classList.add('hidden');
    }
  }

  function init() {
    let savedRole = null;
    if (typeof localStorage !== 'undefined') {
      try {
        savedRole = localStorage.getItem(STORAGE_KEY);
      } catch (e) {}
    }

    if (savedRole && ROLES.some(r => r.id === savedRole)) {
      setRole(savedRole, false, false);
    } else {
      // Lần đầu mở trên thiết bị: mặc định là Guitar và hiển thị picker
      setRole('guitar', false, false);
      // Hiển thị picker nhẹ sau khi trang nạp xong
      setTimeout(() => {
        if (!localStorage.getItem(STORAGE_KEY)) {
          showPicker(true);
        }
      }, 600);
    }

    // Gắn sự kiện cho nút 1-icon trên Toolbar
    const toolbarBtn = document.getElementById('btn-instrument-role');
    if (toolbarBtn) {
      toolbarBtn.addEventListener('click', (e) => {
        e.preventDefault();
        showPicker(false);
      });
    }
  }

  return {
    init,
    getRoles,
    getCurrentRole,
    getRoleInfo,
    setRole,
    showPicker,
    closePicker
  };
})();

window.StageLens = StageLens;
