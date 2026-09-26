/**
 * manager/js/manager-reviews.js — Review Queue & Diff Inspector Controller
 * Part of SheetApp Manager Portal (Epic 4.2)
 */
(() => {
  'use strict';

  let _ctx = null;
  let _activeReview = null;

  function init(ctx) {
    _ctx = ctx;
    _bindEvents();
  }

  function _getApp() {
    return _ctx || window.ManagerApp;
  }

  function _escape(str) {
    return window.SafeHtml ? window.SafeHtml.escape(str) : (str ?? '');
  }

  function _bindEvents() {
    // Filter controls
    document.getElementById('reviews-filter-status')?.addEventListener('change', () => loadQueue());
    document.getElementById('reviews-filter-type')?.addEventListener('change', () => loadQueue());
    document.getElementById('btn-refresh-reviews')?.addEventListener('click', () => loadQueue());

    // Modal action buttons
    document.getElementById('btn-approve-review')?.addEventListener('click', handleApprove);
    document.getElementById('btn-reject-review')?.addEventListener('click', handleReject);
  }

  /**
   * Tải hàng đợi phê duyệt
   */
  async function loadQueue() {
    const container = document.getElementById('tab-reviews');
    if (!container) return;

    const app = _getApp();
    const role = app?.state?.currentUser?.role;
    if (role !== 'admin' && role !== 'banhat') return;

    const tbody = document.getElementById('tbody-reviews-queue');
    if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="mgr-table-loading"><div class="mgr-spinner"></div>Đang tải hàng đợi phê duyệt...</td></tr>';

    const statusFilter = document.getElementById('reviews-filter-status')?.value || 'pending';
    const typeFilter = document.getElementById('reviews-filter-type')?.value || '';

    try {
      const res = await window.ApiService.reviews.getQueue({
        status: statusFilter,
        review_type: typeFilter
      });

      const data = res?.data || res || {};
      const items = data.items || [];
      const totalPending = items.filter(it => it.status === 'pending').length;

      // Cập nhật badge số lượng pending trên navbar tab
      const badge = document.getElementById('tab-reviews-count');
      if (badge) {
        if (totalPending > 0) {
          badge.textContent = String(totalPending);
          badge.style.display = 'inline-block';
        } else {
          badge.style.display = 'none';
        }
      }

      _renderQueueTable(items);
    } catch (e) {
      if (tbody) tbody.innerHTML = `<tr><td colspan="7" style="color:var(--danger);text-align:center;padding:1.5rem;">Lỗi tải hàng đợi: ${_escape(e.message)}</td></tr>`;
    }
  }

  function _renderQueueTable(items) {
    const tbody = document.getElementById('tbody-reviews-queue');
    if (!tbody) return;

    if (!items.length) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--text-muted);">Không có đề xuất nào trong danh mục này</td></tr>';
      return;
    }

    tbody.innerHTML = items.map((it, idx) => {
      const stt = idx + 1;
      const numBadge = it.httlvnId ? `<span class="res-item-num">#${_escape(it.httlvnId)}</span> ` : '';
      const songTitle = _escape(it.song_title || it.song_id);
      const submitter = _escape(it.submitter_display_name || it.submitter_username || 'Thành viên');
      const submitDate = _escape((it.created_at || '').substring(0, 16));

      // Review type badge
      const isUpdateHd = it.review_type === 'update_hd';
      const typeBadge = isUpdateHd
        ? '<span class="tag tag-red" style="font-size:0.72rem;font-weight:700;">💎 Cập nhật HD</span>'
        : '<span class="tag tag-amber" style="font-size:0.72rem;font-weight:700;">⭐ Khuyên Dùng</span>';

      // Status badge
      let statusBadge = '';
      if (it.status === 'pending') statusBadge = '<span class="tag tag-blue" style="font-size:0.72rem;">Chờ duyệt</span>';
      else if (it.status === 'approved') statusBadge = '<span class="tag tag-green" style="font-size:0.72rem;">Đã duyệt</span>';
      else if (it.status === 'rejected') statusBadge = '<span class="tag tag-red" style="font-size:0.72rem;">Từ chối</span>';
      else statusBadge = `<span class="tag" style="font-size:0.72rem;">${_escape(it.status)}</span>`;

      // Diff summary chips
      const sum = it.diff_summary || {};
      let diffHtml = '';
      if (sum.total_changes !== undefined) {
        diffHtml = `
          <div style="display:flex;gap:4px;font-size:0.72rem;">
            ${sum.added_count ? `<span style="color:#10b981;">+${sum.added_count} thêm</span>` : ''}
            ${sum.modified_count ? `<span style="color:#f59e0b;">~${sum.modified_count} sửa</span>` : ''}
            ${sum.removed_count ? `<span style="color:#ef4444;">-${sum.removed_count} xóa</span>` : ''}
            ${!sum.total_changes ? '<span style="color:var(--text-muted);">Không đổi</span>' : ''}
          </div>
        `;
      } else {
        diffHtml = '<span style="color:var(--text-muted);font-size:0.75rem;">—</span>';
      }

      return `
        <tr>
          <td style="text-align:center;font-weight:700;">${stt}</td>
          <td>
            <div style="font-weight:600;">${numBadge}${songTitle}</div>
            <div style="font-size:0.75rem;color:var(--text-muted);">${_escape(it.song_id)}</div>
          </td>
          <td style="text-align:center;">${typeBadge}</td>
          <td>
            <div>${submitter}</div>
            <div style="font-size:0.72rem;color:var(--text-muted);">${submitDate}</div>
          </td>
          <td>${diffHtml}</td>
          <td style="text-align:center;">${statusBadge}</td>
          <td style="text-align:center;">
            <button class="mgr-btn mgr-btn-sm mgr-btn-primary btn-inspect-diff" data-id="${it.id}">
              🔍 Xem Diff & Duyệt
            </button>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('.btn-inspect-diff').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.dataset.id, 10);
        inspectReview(id);
      });
    });
  }

  /**
   * Mở modal kiểm tra chi tiết Diff của đề xuất
   */
  async function inspectReview(reviewId) {
    const modal = document.getElementById('modal-review-diff');
    if (!modal) return;

    // Reset view
    document.getElementById('diff-song-title').textContent = 'Đang tải chi tiết đề xuất...';
    document.getElementById('diff-submitter-note').textContent = '...';
    document.getElementById('tbody-diff-changes').innerHTML = '<tr><td colspan="5" class="mgr-table-loading"><div class="mgr-spinner"></div>Đang phân tích khác biệt...</td></tr>';
    document.getElementById('diff-review-note').value = '';

    if (window.ModalManager) window.ModalManager.open(modal);
    else modal.classList.remove('hidden');

    try {
      const res = await window.ApiService.reviews.getDetail(reviewId);
      const data = res?.data || res || {};
      _activeReview = data;

      document.getElementById('diff-song-title').textContent = (data.song_title || data.song_id) + ` (#${data.httlvnId || '—'})`;
      
      const typeStr = data.review_type === 'update_hd' ? '💎 Đề xuất Cập nhật vào bộ HD chính thức' : '⭐ Đề xuất ghim bản Khuyên Dùng';
      document.getElementById('diff-type-badge').innerHTML = typeStr;

      const submitterName = data.submitter_display_name || data.submitter_username || 'Thành viên';
      document.getElementById('diff-submitter-info').textContent = `Người gửi: ${submitterName} vào lúc ${data.created_at}`;
      document.getElementById('diff-submitter-note').textContent = data.submit_note || '(Không có ghi chú kèm theo)';

      // Ẩn/Hiện nút quyết định nếu đã xử lý
      const isPending = data.status === 'pending';
      const actionBox = document.getElementById('diff-modal-actions');
      if (actionBox) actionBox.style.display = isPending ? 'flex' : 'none';

      const diff = data.diff || {};
      _renderDiffKpis(diff.summary || {});
      _renderDiffTable(diff.changes || []);
    } catch (e) {
      console.error('[ManagerReviews] Error inspecting review:', e);
      _getApp().showToast('Lỗi nạp chi tiết: ' + e.message, 'error');
    }
  }

  function _renderDiffKpis(sum) {
    const setEl = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = String(val);
    };

    setEl('diff-kpi-added', sum.added_count ?? 0);
    setEl('diff-kpi-modified', sum.modified_count ?? 0);
    setEl('diff-kpi-removed', sum.removed_count ?? 0);
    setEl('diff-kpi-unchanged', sum.unchanged_count ?? 0);
  }

  function _renderDiffTable(changes) {
    const tbody = document.getElementById('tbody-diff-changes');
    if (!tbody) return;

    if (!changes.length) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:1.5rem;color:var(--text-muted);font-style:italic;">Bản đề xuất giống hoàn toàn bản gốc (Không có khác biệt nốt nào)</td></tr>';
      return;
    }

    tbody.innerHTML = changes.map(ch => {
      const measureNum = ch.measure + 1; // 1-indexed cho mắt người
      const noteNum = ch.note + 1;

      let typeTag = '';
      let oldChord = ch.old_chord ? `<span style="font-weight:700;color:#64748b;">${_escape(ch.old_chord)}</span>` : '<span style="color:#94a3b8;">—</span>';
      let newChord = ch.new_chord ? `<span style="font-weight:700;color:#2563eb;">${_escape(ch.new_chord)}</span>` : '<span style="color:#94a3b8;">—</span>';

      if (ch.type === 'added') {
        typeTag = '<span class="tag tag-green" style="font-size:0.7rem;">+ Thêm mới</span>';
        newChord = `<span style="font-weight:700;color:#10b981;background:rgba(16,185,129,0.1);padding:2px 6px;border-radius:4px;">${_escape(ch.new_chord)}</span>`;
      } else if (ch.type === 'modified') {
        typeTag = '<span class="tag tag-amber" style="font-size:0.7rem;">~ Sửa đổi</span>';
        oldChord = `<span style="text-decoration:line-through;color:#ef4444;margin-right:6px;">${_escape(ch.old_chord)}</span>`;
        newChord = `<span style="font-weight:700;color:#f59e0b;background:rgba(245,158,11,0.1);padding:2px 6px;border-radius:4px;">${_escape(ch.new_chord)}</span>`;
      } else if (ch.type === 'removed') {
        typeTag = '<span class="tag tag-red" style="font-size:0.7rem;">- Đã xóa</span>';
        oldChord = `<span style="text-decoration:line-through;color:#ef4444;background:rgba(239,68,68,0.1);padding:2px 6px;border-radius:4px;">${_escape(ch.old_chord)}</span>`;
      }

      return `
        <tr>
          <td style="text-align:center;font-weight:600;">Ô nhịp ${measureNum}</td>
          <td style="text-align:center;color:var(--text-muted);">Nốt ${noteNum}</td>
          <td style="text-align:center;">${oldChord}</td>
          <td style="text-align:center;">${newChord}</td>
          <td style="text-align:center;">${typeTag}</td>
        </tr>
      `;
    }).join('');
  }

  async function handleApprove() {
    if (!_activeReview) return;
    const note = document.getElementById('diff-review-note')?.value.trim() || '';

    const isUpdateHd = _activeReview.review_type === 'update_hd';
    const confirmMsg = isUpdateHd
      ? `Cập nhật trực tiếp bộ hợp âm này vào BẢN HD CHÍNH THỨC của bài "${_activeReview.song_title}"?\n\n(Hệ thống sẽ tự động lưu bản HD cũ vào lịch sử để hoàn tác).`
      : `Phê duyệt và gắn huy hiệu "⭐ Ca Trưởng Khuyên Dùng" cho bản phối này?`;

    if (!confirm(confirmMsg)) return;

    try {
      await window.ApiService.reviews.approve(_activeReview.id, note);
      _getApp().showToast('✅ Đã phê duyệt đề xuất thành công!', 'success');

      const modal = document.getElementById('modal-review-diff');
      if (window.ModalManager) window.ModalManager.close(modal);
      else modal?.classList.add('hidden');

      loadQueue();
    } catch (e) {
      _getApp().showToast('Lỗi phê duyệt: ' + e.message, 'error');
    }
  }

  async function handleReject() {
    if (!_activeReview) return;
    const note = document.getElementById('diff-review-note')?.value.trim();

    if (!note) {
      alert('Vui lòng nhập lý do từ chối vào ô ghi chú để tác giả có thể cải thiện bản phối');
      document.getElementById('diff-review-note')?.focus();
      return;
    }

    if (!confirm(`Từ chối đề xuất này với lý do: "${note}"?`)) return;

    try {
      await window.ApiService.reviews.reject(_activeReview.id, note);
      _getApp().showToast('Đã từ chối đề xuất', 'info');

      const modal = document.getElementById('modal-review-diff');
      if (window.ModalManager) window.ModalManager.close(modal);
      else modal?.classList.add('hidden');

      loadQueue();
    } catch (e) {
      _getApp().showToast('Lỗi từ chối: ' + e.message, 'error');
    }
  }

  /**
   * Prompt tương tác nhanh để gửi đề xuất phê duyệt
   */
  async function promptSubmitReview(targetType, targetId, targetName) {
    const isUpdateHd = confirm(
      `Bạn muốn gửi đề xuất cho "${targetName}"?\n\n` +
      `• Bấm OK: Đề xuất CẬP NHẬT VÀO BẢN HD CHÍNH THỨC của hội thánh\n` +
      `• Bấm Cancel: Đề xuất gắn huy hiệu KHUYÊN DÙNG (Recommend)`
    );
    const reviewType = isUpdateHd ? 'update_hd' : 'recommend';
    const note = prompt(
      `Ghi chú cho Ca Trưởng / Quản Trị Viên khi xem xét đề xuất này:`,
      `Đề xuất ${reviewType === 'update_hd' ? 'cập nhật bản HD' : 'ghim khuyên dùng'} bộ hợp âm ${targetName}`
    );
    if (note === null) return;

    try {
      const res = await window.ApiService.reviews.submit({
        target_type: targetType,
        target_id: targetId,
        review_type: reviewType,
        submit_note: note.trim()
      });
      _getApp().showToast('🚀 ' + (res.message || 'Đã gửi đề xuất phê duyệt thành công!'), 'success');
      loadQueue();
      if (_getApp().state?.selectedSong) _getApp().selectSong?.(_getApp().state.selectedSong.id);
      if (window.ManagerCommunity?.loadCommunityChords) window.ManagerCommunity.loadCommunityChords();
    } catch (e) {
      _getApp().showToast('Lỗi gửi đề xuất: ' + e.message, 'error');
    }
  }

  window.ManagerReviews = {
    init,
    loadQueue,
    inspectReview,
    promptSubmitReview
  };
})();

