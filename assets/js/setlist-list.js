/**
 * setlist-list.js
 * Quản lý danh sách Setlist:
 * - Tải danh sách Setlist (Online / Offline fallback)
 * - Render giao diện danh sách Setlist & thẻ trạng thái
 * - Tạo Setlist mới (Modal & Inline Form)
 * - Xoá Setlist
 */
const SetlistList = (() => {
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

  let _context = null;

  function setContext(ctx) {
    _context = ctx;
  }

  function getContext() {
    return _context || window.SetlistUI || {};
  }

  async function fetchSetlists() {
    const ctx = getContext();
    try {
      const data = await window.ApiService.setlists.list();
      if (data && data.success) {
        const list = Array.isArray(data.data) ? data.data : [];
        ctx.setSetlists?.(list);
        renderList();
        return;
      }
    } catch (e) {
      console.warn('[SetlistList] Online fetch failed, checking offline packages:', e);
    }

    if (window.OfflineSetlistManager) {
      const offlineList = window.OfflineSetlistManager.listPackages();
      if (offlineList && offlineList.length > 0) {
        const list = offlineList.map(p => ({
          id: p.id,
          title: p.title,
          scheduled_date: p.scheduled_date,
          item_count: p.item_count,
          status: p.is_ready ? 'published' : 'draft',
          is_offline: true
        }));
        ctx.setSetlists?.(list);
        renderList();
      }
    }
  }

  function renderList() {
    const ctx = getContext();
    const listEl = document.getElementById('setlist-list');
    if (!listEl) return;

    const setlists = ctx.getSetlists?.() || [];

    if (setlists.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">📋</span>
          <p>Chưa có Setlist nào</p>
          <small>Chỉ Quản trị mới có thể tạo</small>
        </div>`;
      return;
    }

    listEl.innerHTML = '';
    setlists.forEach(sl => {
      const item = document.createElement('div');
      item.className = 'song-item';
      let statusBadge = '';
      if (sl.is_offline) {
        statusBadge = '<span class="tag tag-green text-xs" style="margin-left:4px;padding:1px 5px;font-size:0.65rem;">⚡ Ngoại tuyến</span>';
      } else if (sl.status === 'published') {
        statusBadge = '<span class="tag tag-green text-xs" style="margin-left:4px;padding:1px 5px;font-size:0.65rem;">Đã phát hành</span>';
      } else if (sl.status === 'completed') {
        statusBadge = '<span class="tag text-xs" style="margin-left:4px;padding:1px 5px;font-size:0.65rem;">Đã xong</span>';
      } else {
        statusBadge = '<span class="tag tag-amber text-xs" style="margin-left:4px;padding:1px 5px;font-size:0.65rem;">Bản nháp</span>';
      }

      const timeStr = sl.service_time ? ` • ⏰ ${_esc(sl.service_time)}` : '';
      const themeStr = sl.theme ? ` • 🏷 ${_esc(sl.theme)}` : '';
      const teamCount = parseInt(sl.assignment_count, 10) || 0;
      const teamStr = teamCount > 0
        ? ` • 👥 ${_esc(String(sl.confirmed_count || 0))}/${_esc(String(teamCount))}`
        : '';
      const myInvite = (sl.my_assignment_status === 'pending')
        ? '<span class="tag tag-purple text-xs" style="margin-left:4px;font-weight:700;padding:1px 5px;font-size:0.65rem;">⚡ Lời mời mới</span>'
        : '';

      item.innerHTML = `
        <div class="song-item-info" style="min-width:0;flex:1;">
          <div class="song-item-title" style="display:flex;align-items:center;flex-wrap:wrap;gap:4px;">
            <span>${_esc(sl.title)}</span>
            ${statusBadge}
            ${myInvite}
          </div>
          <div class="song-item-meta" style="font-size:0.75rem;margin-top:2px;">
            📅 ${_esc(sl.scheduled_date)}${timeStr} • ${_esc(String(sl.item_count))} bài${teamStr}${themeStr}
          </div>
        </div>
        ${window.Auth && window.Auth.isAdmin() ? `<button class="icon-btn-xs text-danger btn-del" title="Xoá">✕</button>` : ''}
      `;

      item.addEventListener('click', (e) => {
        if (e.target.closest('.btn-del')) return;
        ctx.viewSetlistDetail?.(sl.id);
      });

      const delBtn = item.querySelector('.btn-del');
      if (delBtn) {
        delBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (confirm(`Bạn chắc muốn xoá setlist: ${sl.title}?`)) {
            await window.ApiService.setlists.delete(sl.id);
            if (ctx.getCurrentSetlist?.()?.id === sl.id) {
              ctx.backToSetlists?.();
            }
            fetchSetlists();
          }
        });
      }
      listEl.appendChild(item);
    });
  }

  function openCreateSetlistModal() {
    const addModal = document.getElementById('add-to-setlist-modal');
    const pickView = document.getElementById('add-setlist-pick-view');
    const modalCreate = document.getElementById('create-setlist-modal');
    const modalTitle = document.getElementById('setlist-modal-title');
    const titleInp = document.getElementById('create-setlist-title-input');
    const dateInp = document.getElementById('create-setlist-date-input');

    if (modalTitle) modalTitle.textContent = 'Tạo Setlist Mới';
    if (pickView) pickView.classList.add('hidden');
    if (addModal) {
      if (window.ModalManager) {
        window.ModalManager.open(addModal);
      } else {
        addModal.classList.remove('hidden');
      }
    }

    if (!modalCreate) {
      const title = prompt("Tên Setlist mới (VD: Worship CN 20/4):");
      if (!title) return;
      window.ApiService.setlists.create({ title, scheduled_date: new Date().toISOString().split('T')[0] }).then(data => {
        if (data.success) fetchSetlists();
      });
      return;
    }
    if (titleInp) titleInp.value = '';
    if (dateInp) dateInp.value = new Date().toISOString().split('T')[0];
    modalCreate.classList.remove('hidden');
    setTimeout(() => titleInp?.focus(), 50);
  }

  function closeCreateSetlistModal() {
    const addModal = document.getElementById('add-to-setlist-modal');
    const pickView = document.getElementById('add-setlist-pick-view');
    const modalCreate = document.getElementById('create-setlist-modal');
    const modalTitle = document.getElementById('setlist-modal-title');

    modalCreate?.classList.add('hidden');
    if (addModal) {
      if (window.ModalManager) {
        window.ModalManager.close(addModal);
      } else {
        addModal.classList.add('hidden');
      }
    }
    if (pickView) pickView.classList.remove('hidden');
    if (modalTitle) modalTitle.textContent = 'Thêm vào Setlist';
  }

  async function submitCreateSetlist() {
    const titleInp = document.getElementById('create-setlist-title-input');
    const dateInp = document.getElementById('create-setlist-date-input');
    const title = titleInp?.value.trim();
    if (!title) {
      titleInp?.focus();
      return;
    }
    const scheduled_date = dateInp?.value || new Date().toISOString().split('T')[0];
    const service_time = document.getElementById('create-setlist-time-input')?.value || '08:30';
    const theme = document.getElementById('create-setlist-theme-input')?.value?.trim() || null;
    try {
      const data = await window.ApiService.setlists.create({ title, scheduled_date, service_time, theme, status: 'draft' });
      if (data.success) {
        closeCreateSetlistModal();
        if (window.App?.showToast) {
          window.App.showToast(`✅ Đã tạo setlist "${title}"`, 'success');
        }
        fetchSetlists();
      } else {
        alert(data.error || 'Lỗi khi tạo setlist');
      }
    } catch (err) {
      console.error('Error creating setlist:', err);
    }
  }

  function bindListEvents() {
    const modalCreate = document.getElementById('create-setlist-modal');
    const btnCloseModal = document.getElementById('btn-close-create-setlist-modal');
    const btnCancelModal = document.getElementById('btn-cancel-create-setlist');
    const formCreate = document.getElementById('form-create-setlist');

    document.getElementById('btn-create-setlist')?.addEventListener('click', openCreateSetlistModal);
    document.getElementById('btn-toggle-inline-create-setlist')?.addEventListener('click', openCreateSetlistModal);
    btnCloseModal?.addEventListener('click', closeCreateSetlistModal);
    btnCancelModal?.addEventListener('click', closeCreateSetlistModal);
    formCreate?.addEventListener('submit', (e) => {
      e.preventDefault();
      submitCreateSetlist();
    });
    modalCreate?.addEventListener('click', (e) => {
      if (e.target === modalCreate) closeCreateSetlistModal();
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modalCreate && !modalCreate.classList.contains('hidden')) {
        closeCreateSetlistModal();
      }
    });
  }

  return {
    setContext,
    fetchSetlists,
    renderList,
    openCreateSetlistModal,
    closeCreateSetlistModal,
    submitCreateSetlist,
    bindListEvents
  };
})();

window.SetlistList = SetlistList;
