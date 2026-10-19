/**
 * assets/js/admin-ui.js
 * Quản lý giao diện Admin Console (Bảng điều khiển quản trị tập trung)
 */
const AdminUI = (() => {
  'use strict';

  const modal = () => document.getElementById('admin-modal');
  let currentCategories = [];

  function init() {
    // Nút mở Admin Console
    const btnOpen = document.getElementById('btn-admin-console');
    if (btnOpen) {
      btnOpen.addEventListener('click', () => {
        openModal();
        loadCategories(); // Tải danh mục khi bắt đầu
        loadSongs();      // Tải luôn danh sách bài hát
        loadUsers();      // Tải users
      });
    }

    // Nút đóng
    const btnClose = document.getElementById('btn-close-admin');
    if (btnClose) {
      btnClose.addEventListener('click', () => {
        if (window.ModalManager) {
          window.ModalManager.close(modal());
        } else {
          modal().classList.add('hidden');
        }
      });
    }

    // Tab chuyển đổi trong mảng dọc
    document.querySelectorAll('.admin-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        // Tắt tất cả tab buttons
        document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Ẩn tất cả panel
        document.querySelectorAll('.admin-panel').forEach(p => p.classList.add('hidden'));

        // Hiện panel tương ứng
        const targetId = btn.dataset.target;
        document.getElementById(targetId)?.classList.remove('hidden');
      });
    });

    // Các tính năng trong tab Categories
    document.getElementById('btn-admin-add-category')?.addEventListener('click', createCategory);
    
    // Tìm kiếm trong tab Songs
    document.getElementById('admin-song-search')?.addEventListener('keyup', (e) => {
        const val = e.target.value.toLowerCase();
        document.querySelectorAll('#admin-songs-table tbody tr').forEach(row => {
            const inputVal = row.querySelector('input')?.value?.toLowerCase() || '';
            const txt = (row.cells[0]?.textContent || '').toLowerCase() + ' ' + inputVal;
            row.style.display = txt.includes(val) ? '' : 'none';
        });
    });

    // Nút chuyển nhanh sang tab Upload XML từ danh sách bài hát
    document.getElementById('btn-admin-quick-upload-xml')?.addEventListener('click', () => {
      const importTabBtn = document.querySelector('.admin-tab-btn[data-target="admin-tab-import"]');
      importTabBtn?.click();
      window.Importer?.switchTab?.('upload');
    });

    // Load users
    document.getElementById('btn-admin-create-user')?.addEventListener('click', createUser);
    document.getElementById('btn-admin-add-user')?.addEventListener('click', createUser);
  }

  function openModal() {
    if (modal()) {
      if (window.ModalManager) {
        window.ModalManager.open(modal());
      } else {
        modal().classList.remove('hidden');
      }
    }
  }


  /* ====================================
     CÁC HÀM CHO TAB CATEGORIES
     ==================================== */
  async function loadCategories() {
    try {
      const res = await window.ApiService.categories.list();
      currentCategories = Array.isArray(res) ? res : (res.data || []);
      
      // Cập nhật dropdown danh mục trong tab Upload XML
      const uploadCatSel = document.getElementById('import-upload-category');
      if (uploadCatSel && currentCategories.length > 0) {
        uploadCatSel.innerHTML = currentCategories.map(c =>
          `<option value="${Number.parseInt(c.id, 10) || 1}">${window.SafeHtml.escape(c.name)}</option>`
        ).join('');
      }

      const tbody = document.querySelector('#admin-categories-table tbody');
      if (!tbody) return;

      tbody.innerHTML = '';
      currentCategories.forEach(cat => {
        const tr = document.createElement('tr');
        const catId = Number.parseInt(cat.id, 10) || 0;
        const catName = window.SafeHtml.escape(cat.name);
        tr.innerHTML = `
          <td>${catId}</td>
          <td>
             <span id="cat-name-${catId}">${catName}</span>
             <input type="text" id="cat-input-${catId}" class="form-input hidden" value="${catName}" style="padding:0.2rem 0.5rem; max-width:80%;">
          </td>
          <td style="text-align:center; display:flex; gap:0.25rem; justify-content:center;">
             <button class="btn btn-sm btn-ghost" onclick="AdminUI.editCategory(${cat.id})" id="btn-edit-cat-${cat.id}" title="Sửa tên">✏️</button>
             <button class="btn btn-sm btn-primary hidden" onclick="AdminUI.saveCategory(${cat.id})" id="btn-save-cat-${cat.id}">Lưu</button>
             <button class="btn btn-sm btn-ghost" style="color:var(--danger);" onclick="AdminUI.deleteCategory(${cat.id})" title="Xóa">🗑</button>
          </td>
        `;
        tbody.appendChild(tr);
      });
      // Bắn event để Library UI bê ngoài cũng cập nhật sidebar
      window.dispatchEvent(new Event('libraryCategoriesUpdated'));
    } catch (e) {
      console.error('Failed to load categories', e);
    }
  }

  async function createCategory() {
    const name = prompt("Nhập tên danh mục mới:");
    if (!name || !name.trim()) return;

    try {
      const res = await window.ApiService.categories.create({ name: name.trim() });
      if (res.success) {
        showToast('Tạo danh mục thành công');
        loadCategories();
      }
    } catch (e) {
      showToast('Lỗi khi tạo danh mục', 'error');
    }
  }

  function editCategory(id) {
    document.getElementById(`cat-name-${id}`).classList.add('hidden');
    document.getElementById(`cat-input-${id}`).classList.remove('hidden');
    document.getElementById(`btn-edit-cat-${id}`).classList.add('hidden');
    document.getElementById(`btn-save-cat-${id}`).classList.remove('hidden');
  }

  async function saveCategory(id) {
    const input = document.getElementById(`cat-input-${id}`);
    const name = input.value.trim();
    if (!name) return;

    try {
      const res = await window.ApiService.categories.update(id, { name });
      if (res.success) {
        showToast('Cập nhật thành công');
        loadCategories();
      }
    } catch (e) {
      showToast('Lỗi cập nhật', 'error');
    }
  }

  async function deleteCategory(id) {
    if(!confirm("Bạn có chắc chắn muốn xóa danh mục này? Các bài hát bên trong sẽ chuyển về Thánh Ca.")) return;
    try {
      const res = await window.ApiService.categories.delete(id);
      if (res.success) {
        showToast('Đã xóa danh mục');
        loadCategories();
        loadSongs(); // Update bài hát
      }
    } catch (e) {
      showToast('Xóa thất bại', 'error');
    }
  }


  /* ====================================
     CÁC HÀM CHO TAB BÀI HÁT
     ==================================== */
  function loadSongs() {
    window.ApiService.songs.list(true)
      .then(data => {
        const tbody = document.querySelector('#admin-songs-table tbody');
        if (!tbody) return;
        tbody.innerHTML = '';
        data.forEach(song => {
          // Tạo combo categories dropdown cho bài hát này
          let catOptions = `<option value="">-- Chưa gán --</option>`;
          currentCategories.forEach(cat => {
             const selected = (song.category_id == cat.id) ? 'selected' : '';
             catOptions += `<option value="${Number.parseInt(cat.id, 10) || 0}" ${selected}>${window.SafeHtml.escape(cat.name)}</option>`;
          });

          const isPrivate = (song.visibility && song.visibility !== 'public') || Number(song.is_public ?? 1) === 0;
          const tr = document.createElement('tr');
          const safeSongIdJs = window.SafeHtml.inlineJsString(song.id);
          tr.innerHTML = `
            <td>
              <input type="text" value="${window.SafeHtml.escape(song.title)}" class="form-input" style="padding:0.2rem 0.5rem; font-size:0.85rem;" onblur="AdminUI.updateSongTitle('${safeSongIdJs}', this)">
            </td>
            <td>
               <select class="form-input" style="padding:0.2rem; font-size:0.8rem; border-color:transparent;" onchange="AdminUI.updateSongCategory('${safeSongIdJs}', this.value)">
                  ${catOptions}
               </select>
            </td>
            <td>
               <select class="form-input" style="padding:0.2rem 0.4rem; font-size:0.78rem;" onchange="AdminUI.updateSongVisibility('${safeSongIdJs}', this.value)">
                  <option value="public" ${!isPrivate ? 'selected' : ''}>🌐 Public</option>
                  <option value="private" ${isPrivate ? 'selected' : ''}>🔒 Private</option>
               </select>
            </td>
            <td style="text-align:center;">
              <button class="btn btn-sm btn-ghost" style="color:var(--danger);" onclick="AdminUI.deleteSong('${safeSongIdJs}')" title="Xóa Bài Hát">🗑 Xóa</button>
            </td>
          `;
          tbody.appendChild(tr);
        });
      })
      .catch(console.error);
  }

  async function updateSongTitle(id, inputEl) {
     const title = inputEl.value.trim();
     if (!title) return;
     try {
       await window.ApiService.songs.update(id, { title });
       showToast('Đã lưu tên bài', 'success');
       window.LibraryUI?.loadSongs?.();
       window.dispatchEvent(new Event('libraryLibraryUpdated'));
     } catch (e) {}
  }

  async function updateSongCategory(id, catId) {
     try {
       await window.ApiService.songs.update(id, { category_id: catId ? Number(catId) : 1 });
       showToast('Đã xếp danh mục', 'success');
       window.LibraryUI?.loadSongs?.();
       window.dispatchEvent(new Event('libraryLibraryUpdated'));
     } catch (e) {}
  }

  async function updateSongVisibility(id, visibility) {
     try {
       const isPublic = visibility === 'public' ? 1 : 0;
       await window.ApiService.songs.update(id, { visibility, is_public: isPublic });
       showToast(isPublic ? '🌐 Đã chuyển sang Public (Công khai)' : '🔒 Đã chuyển sang Private (Riêng tư)', 'success');
       window.LibraryUI?.loadSongs?.();
       window.dispatchEvent(new Event('libraryLibraryUpdated'));
     } catch (e) {
       showToast('Không thể đổi chế độ hiển thị', 'error');
     }
  }

  async function deleteSong(id) {
    if(!confirm('Xóa vĩnh viễn bài hát này?')) return;
    try {
      const res = await window.ApiService.songs.delete(id);
      if (res.success) {
        showToast('Đã xóa bài hát');
        loadSongs();
        window.LibraryUI?.loadSongs?.();
        window.dispatchEvent(new Event('libraryLibraryUpdated'));
      }
    } catch (e) {
      showToast('Xóa thất bại', 'error');
    }
  }

  /* ====================================
     CÁC HÀM CHO TAB NGƯỜI DÙNG
     ==================================== */
  async function loadUsers() {
    try {
      const res = await window.ApiService.users.list();
      if (!res.success) return;
      const users = res.users || [];
      const tbody = document.getElementById('admin-users-list-body') || document.querySelector('#admin-users-table tbody');
      if (!tbody) return;
      tbody.innerHTML = '';
      if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: var(--text-muted);">Chưa có tài khoản nào.</td></tr>';
        return;
      }
      users.forEach(u => {
        const amISelf = (u.id === window.Auth?.getUserId?.());
        const safeUserId = Number.parseInt(u.id, 10) || 0;
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>#${safeUserId}</td>
          <td><strong>${window.SafeHtml.escape(u.username)}</strong></td>
          <td>
            <select class="form-input" ${amISelf ? 'disabled' : ''} style="padding:0.2rem; font-size:0.8rem;" onchange="AdminUI.updateUserRole(${safeUserId}, this.value)">
              <option value="admin"   ${u.role === 'admin'   ? 'selected' : ''}>🛡️ Admin (Quản Trị)</option>
              <option value="leader"  ${u.role === 'leader'  ? 'selected' : ''}>👑 Trưởng Ban / Ca Trưởng</option>
              <option value="bannhac" ${u.role === 'bannhac' ? 'selected' : ''}>🎸 Ban Nhạc (Hợp Âm &amp; Setlist)</option>
              <option value="banhat"  ${u.role === 'banhat'  ? 'selected' : ''}>🎤 Ban Hát (Ca Viên)</option>
              <option value="viewer"  ${u.role === 'viewer'  ? 'selected' : ''}>👁️ Guest / Khách (Chỉ Xem)</option>
            </select>
          </td>
          <td>${u.created_at ? window.SafeHtml.escape(u.created_at.substring(0, 10)) : '—'}</td>
          <td style="text-align:right;">
            <button class="btn btn-sm btn-ghost" onclick="AdminUI.changeUserPass(${safeUserId})">🔑 Đổi Pass</button>
            <button class="btn btn-sm btn-ghost" style="color:var(--danger);" onclick="AdminUI.deleteUser(${safeUserId})" ${amISelf ? 'disabled' : ''}>🗑 Xóa</button>
          </td>
        `;
        tbody.appendChild(tr);
      });
    } catch (e) {
      console.error(e);
    }
  }

  async function createUser() {
    const userInp = document.getElementById('admin-new-user-name');
    const passInp = document.getElementById('admin-new-user-pass');
    const roleInp = document.getElementById('admin-new-user-role');

    let user = userInp?.value.trim();
    let pass = passInp?.value.trim();
    let role = roleInp?.value || 'bannhac';

    if (!user || !pass) {
      user = prompt("Tên đăng nhập (Username) mong muốn:");
      if (!user) return;
      pass = prompt(`Thiết lập mật khẩu cho ${user}:`);
      if (!pass) return;
    }

    try {
      const res = await window.ApiService.users.create({ username: user, password: pass, role });
      if (res.success) {
        showToast(`✅ Đã tạo tài khoản "${user}" (${role})`);
        if (userInp) userInp.value = '';
        if (passInp) passInp.value = '';
        loadUsers();
      } else {
        showToast(res.error || 'Có lỗi xảy ra', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast(e.message || 'Lỗi kết nối khi tạo tài khoản', 'error');
    }
  }


  async function updateUserRole(id, role) {
    try {
      await window.ApiService.users.update(id, { id, role });
      showToast('Đã đổi quyền tài khoản');
      loadUsers();
    } catch (e) {
      showToast(e.message || 'Không thể đổi quyền', 'error');
      loadUsers();
    }
  }

  async function changeUserPass(id) {
    const newpass = prompt('Nhập mật khẩu mới cho user này (tối thiểu 10 ký tự):');
    if(!newpass) return;
    try {
       await window.ApiService.users.update(id, { id, password: newpass });
       showToast('Đã cập nhật mật khẩu mới');
    } catch(e){
       showToast(e.message || 'Lỗi đổi mật khẩu', 'error');
    }
  }

  async function deleteUser(id) {
    if(!confirm('Xóa tài khoản này?')) return;
    try {
       await window.ApiService.users.delete(id);
       showToast('Đã xóa tài khoản');
       loadUsers();
    } catch(e){
       showToast(e.message || 'Không thể xóa tài khoản', 'error');
    }
  }

  function showToast(msg, type='success') {
     if(typeof window.AppUI !== 'undefined' && window.AppUI.showToast) {
        window.AppUI.showToast(msg, type);
     }
  }

  // Export ra window.AdminUI — một điểm duy nhất
  // Các hàm handler (editCategory, deleteSong, ...) được gọi từ inline onclick trong HTML
  return { init, openModal, loadSongs, loadUsers, editCategory, saveCategory, deleteCategory, updateSongTitle, updateSongCategory, updateSongVisibility, deleteSong, updateUserRole, changeUserPass, deleteUser };
})();

window.AdminUI = AdminUI;

document.addEventListener('DOMContentLoaded', () => {
    AdminUI.init();
});
