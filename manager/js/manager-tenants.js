/**
 * manager/js/manager-tenants.js
 *
 * Module Quản trị Đa Hội Thánh (Multi-Tenant Hub) cho Manager Portal
 * Dành riêng cho Super Admin (Epic 4.5 ADR-005).
 */
"use strict";

window.ManagerTenants = (function () {
  let tenantsList = [];

  async function init() {
    const user = window.currentUser || {};
    const navBtn = document.getElementById("mgr-nav-tab-tenants");
    if (!navBtn) return;

    if (user.role === "admin") {
      navBtn.style.display = "inline-flex";
    } else {
      navBtn.style.display = "none";
      return;
    }

    navBtn.addEventListener("click", () => {
      loadTenants();
    });

    const createBtn = document.getElementById("btn-create-tenant-modal");
    if (createBtn) {
      createBtn.addEventListener("click", handleCreatePrompt);
    }
  }

  async function loadTenants() {
    const tbody = document.getElementById("mgr-tenants-tbody");
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-muted);">Đang tải danh sách hội thánh...</td></tr>`;

    try {
      const res = await window.ApiService.tenants.list();
      tenantsList = (res && res.tenants) || [];
      renderTable(tenantsList);

      const kpiTotal = document.getElementById("kpi-tenants-total");
      if (kpiTotal) {
        kpiTotal.textContent = String(tenantsList.length);
      }
      const badge = document.getElementById("tab-tenants-count");
      if (badge) {
        badge.textContent = String(tenantsList.length);
        badge.style.display = tenantsList.length > 0 ? "inline-block" : "none";
      }
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:24px;color:#ef4444;">Không thể tải danh sách hội thánh: ${window.SafeHtml ? window.SafeHtml.escape(err.message) : err.message}</td></tr>`;
    }
  }

  function renderTable(list) {
    const tbody = document.getElementById("mgr-tenants-tbody");
    if (!tbody) return;

    if (!list || list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--text-muted);">Chưa có hội thánh phụ nào được khởi tạo. Hệ thống đang chạy ở chế độ Single-Tenant mặc định.</td></tr>`;
      return;
    }

    const esc = (t) => (window.SafeHtml ? window.SafeHtml.escape(t || "") : (t || ""));

    tbody.innerHTML = list.map((item) => `
      <tr>
        <td><strong>🏛️ ${esc(item.name || item.slug)}</strong></td>
        <td><code>${esc(item.slug)}</code></td>
        <td style="font-family:monospace;font-size:0.85em;color:var(--text-muted);">${esc(item.db_path || "storage/tenants/" + item.slug + "/db.sqlite")}</td>
        <td>${esc(item.admin_user || "admin")}</td>
        <td>${esc(item.created_at || "—")}</td>
        <td style="text-align:right;">
          <button class="mgr-btn-action" onclick="ManagerTenants.showStats('${esc(item.slug)}')">📊 Thống Kê</button>
          <button class="mgr-btn-action" onclick="ManagerTenants.backupTenant('${esc(item.slug)}')">💾 Sao Lưu</button>
        </td>
      </tr>
    `).join("");
  }

  async function handleCreatePrompt() {
    const slug = prompt("Nhập mã slug hội thánh (viết liền, không dấu, vd: saigon, hanoi):");
    if (!slug) return;
    const name = prompt("Nhập tên đầy đủ của Hội Thánh (vd: Hội Thánh Tin Lành Sài Gòn):");
    if (!name) return;

    try {
      await window.ApiService.tenants.create({ slug: slug.trim(), name: name.trim() });
      if (typeof window.showToast === "function") {
        window.showToast("Khởi tạo hội thánh mới thành công!", "success");
      } else {
        alert("Khởi tạo hội thánh mới thành công!");
      }
      loadTenants();
    } catch (err) {
      alert("Lỗi khi khởi tạo hội thánh: " + err.message);
    }
  }

  async function showStats(slug) {
    try {
      const stats = await window.ApiService.tenants.stats(slug);
      alert(`[Thống Kê Hội Thánh: ${stats.name || slug}]\n- Người dùng: ${stats.users_count || 0}\n- Setlists: ${stats.setlists_count || 0}\n- Kích thước DB: ${Math.round((stats.db_size_bytes || 0) / 1024)} KB\n- Trạng thái DB: ${stats.integrity || 'OK'}`);
    } catch (err) {
      alert("Lỗi tải thống kê: " + err.message);
    }
  }

  async function backupTenant(slug) {
    if (!confirm(`Tạo bản sao lưu mã hóa bảo mật cho hội thánh '${slug}'?`)) return;
    try {
      const res = await window.ApiService.tenants.backup({ slug });
      alert(`Đã sao lưu thành công!\nFile: ${res.backup_file || 'backup.enc'}\nChecksum SHA-256: ${res.checksum || 'OK'}`);
    } catch (err) {
      alert("Lỗi sao lưu: " + err.message);
    }
  }

  return {
    init,
    loadTenants,
    showStats,
    backupTenant
  };
})();

document.addEventListener("DOMContentLoaded", () => {
  if (window.ManagerTenants) {
    window.ManagerTenants.init();
  }
});
