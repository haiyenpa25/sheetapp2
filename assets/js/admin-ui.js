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
      btnClose.addEventListener('click', () => modal().classList.add('hidden'));
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
            const txt = row.cells[0].textContent.toLowerCase();
            row.style.display = txt.includes(val) ? '' : 'none';
        });
    });

    // Load users
    document.getElementById('btn-admin-create-user')?.addEventListener('click', createUser);
    document.getElementById('btn-admin-add-user')?.addEventListener('click', createUser);
  }

  function openModal() {
    if (modal()) {
      modal().classList.remove('hidden');
    }
  }


  /* ====================================
     CÁC HÀM CHO TAB CATEGORIES
     ==================================== */
  async function loadCategories() {
    try {
      const res = await window.ApiService.categories.list();
      currentCategories = res.data || [];
      
      const tbody = document.querySelector('#admin-categories-table tbody');
      if (!tbody) return;

      tbody.innerHTML = '';
      currentCategories.forEach(cat => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${cat.id}</td>
          <td>
             <span id="cat-name-${cat.id}">${cat.name}</span>
             <input type="text" id="cat-input-${cat.id}" class="form-input hidden" value="${cat.name}" style="padding:0.2rem 0.5rem; max-width:80%;">
          </td>
          <td style="text-align:center; display:flex; gap:0.25rem; justify-content:center;">
             <button class="btn btn-sm btn-ghost" onclick="AdminUI.editCategory(${cat.id})" id="btn-edit-cat-${cat.id}" title="Sửa tên">✏️</button>
             <button class="btn btn-sm btn-primary hidden" onclick="AdminUI.saveCategory(${cat.id})" id="btn-save-cat-${cat.id}">Lưu</button>
             <button class="btn btn-sm btn-ghost" style="color:var(--danger);" onclick="AdminUI.deleteCategory(${cat.id})" title="Xoá">🗑</button>
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
    if(!confirm("Bạn có chắc chắn muốn xoá danh mục này? (Các bài hát bên trong sẽ trở thành Không Xác Định)")) return;
    try {
      const res = await window.ApiService.categories.delete(id);
      if (res.success) {
        showToast('Đã xoá danh mục');
        loadCategories();
        loadSongs(); // Update bài hát
      }
    } catch (e) {
      showToast('Xoá thất bại', 'error');
    }
  }


  /* ====================================
     CÁC HÀM CHO TAB BÀI HÁT
     ==================================== */
  function loadSongs() {
    window.ApiService.songs.list()
      .then(data => {
        const tbody = document.querySelector('#admin-songs-table tbody');
        if (!tbody) return;
        tbody.innerHTML = '';
        data.forEach(song => {
          // Tạo combo categories dropdown cho bài hát này
          let catOptions = `<option value="">-- Chưa gán --</option>`;
          currentCategories.forEach(cat => {
             const selected = (song.category_id == cat.id) ? 'selected' : '';
             catOptions += `<option value="${cat.id}" ${selected}>${cat.name}</option>`;
          });

          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>
              <input type="text" value="${song.title}" class="form-input" style="padding:0.2rem 0.5rem; font-size:0.85rem;" onblur="AdminUI.updateSongTitle(${song.id}, this)">
            </td>
            <td>
               <select class="form-input" style="padding:0.2rem; font-size:0.8rem; border-color:transparent;" onchange="AdminUI.updateSongCategory(${song.id}, this.value)">
                  ${catOptions}
               </select>
            </td>
            <td style="text-align:center;">
              <button class="btn btn-sm btn-ghost" style="color:var(--danger);" onclick="AdminUI.deleteSong(${song.id})" title="Xoá Bài Hát">🗑 Xoá</button>
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
       await window.ApiService.songs.updateMetadata(id, { title });
       showToast('Đã lưu tên bài', 'success');
       window.dispatchEvent(new Event('libraryLibraryUpdated'));
     } catch (e) {}
  }

  async function updateSongCategory(id, catId) {
     try {
       await window.ApiService.songs.updateMetadata(id, { categoryId: catId || null });
       showToast('Đã xếp danh mục', 'success');
       window.dispatchEvent(new Event('libraryLibraryUpdated'));
     } catch (e) {}
  }

  async function deleteSong(id) {
    if(!confirm('Xoá vĩnh viễn bài hát này?')) return;
    try {
      const res = await window.ApiService.songs.delete(id);
      if (res.success) {
        showToast('Đã xoá bài hát');
        loadSongs();
        window.dispatchEvent(new Event('libraryLibraryUpdated'));
      }
    } catch (e) {
      showToast('Xoá thất bại', 'error');
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
        const amIOwner = (u.username === 'banhat');
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>#${u.id}</td>
          <td><strong>${u.username}</strong></td>
          <td>
            <select class="form-input" ${amIOwner ? 'disabled' : ''} style="padding:0.2rem; font-size:0.8rem;" onchange="AdminUI.updateUserRole(${u.id}, this.value)">
              <option value="admin"  ${u.role === 'admin'  ? 'selected' : ''}>Admin (Quản Trị)</option>
              <option value="banhat" ${u.role === 'banhat' ? 'selected' : ''}>Ban Hát (Thêm Hợp Âm)</option>
              <option value="viewer" ${u.role === 'viewer' ? 'selected' : ''}>Viewer (Khách)</option>
            </select>
          </td>
          <td>${u.created_at ? u.created_at.substring(0, 10) : '—'}</td>
          <td style="text-align:right;">
            <button class="btn btn-sm btn-ghost" onclick="AdminUI.changeUserPass(${u.id})">🔑 Đổi Pass</button>
            <button class="btn btn-sm btn-ghost" style="color:var(--danger);" onclick="AdminUI.deleteUser(${u.id})" ${amIOwner ? 'disabled' : ''}>🗑 Xóa</button>
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
    let role = roleInp?.value || 'banhat';

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
      } else {
        showToast(res.error || 'Có lỗi xảy ra', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('Lỗi kết nối khi tạo tài khoản', 'error');
    }
  }


  async function updateUserRole(id, role) {
    await window.ApiService.users.update(id, { role });
    showToast('Đã đổi quyền');
  }

  async function changeUserPass(id) {
    const newpass = prompt('Nhập mật khẩu mới cho user này:');
    if(!newpass) return;
    try {
       await window.ApiService.users.update(id, { password: newpass });
       showToast('Đã ép đổi mật khẩu');
    } catch(e){}
  }

  async function deleteUser(id) {
    if(!confirm('Xoá tài khoản này?')) return;
    try {
       await window.ApiService.users.delete(id);
       showToast('Đã xoá tài khoản');
       loadUsers();
    } catch(e){}
  }

  function showToast(msg, type='success') {
     if(typeof window.AppUI !== 'undefined' && window.AppUI.showToast) {
        window.AppUI.showToast(msg, type);
     }
  }

  // Export ra window.AdminUI — một điểm duy nhất
  // Các hàm handler (editCategory, deleteSong, ...) được gọi từ inline onclick trong HTML
  return { init, openModal, editCategory, saveCategory, deleteCategory, updateSongTitle, updateSongCategory, deleteSong, updateUserRole, changeUserPass, deleteUser };
})();

document.addEventListener('DOMContentLoaded', () => {
    AdminUI.init();
});
