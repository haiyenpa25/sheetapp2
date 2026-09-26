/**
 * assets/js/modals/PracticeTeamBoardModal.js
 *
 * Modal hiển thị Bảng Tiến Độ Luyện Tập Ca Đoàn (Team Board - Epic 4.1):
 * - Dạng lưới (Grid): Ca viên × Bài hát × Trạng thái.
 * - Hiển thị trạng thái: Chưa tập (assigned), Đang tập (in_progress), Hoàn thành (completed), Miễn tập (excused).
 * - Tuân thủ Quyết định D10: Chỉ hiển thị accuracy/thời lượng với ca viên đã consent; người chưa consent ẩn chi tiết.
 * - Cho phép Ca Trưởng đánh dấu miễn tập (excused) trực tiếp trên ô.
 * - Quản lý A11y qua ModalManager.
 */
(function(window) {
  'use strict';

  let _modalEl = null;
  let _currentSetlistId = null;

  function _esc(str) {
    return window.SafeHtml ? window.SafeHtml.escape(str) : String(str ?? '');
  }

  function _ensureModal() {
    if (_modalEl) return _modalEl;

    let el = document.getElementById('modal-practice-team-board');
    if (!el) {
      el = document.createElement('div');
      el.id = 'modal-practice-team-board';
      el.className = 'modal-overlay hidden';
      el.setAttribute('role', 'dialog');
      el.setAttribute('aria-modal', 'true');
      el.setAttribute('aria-labelledby', 'modal-ptb-title');
      el.innerHTML = `
        <div class="modal-backdrop"></div>
        <div class="modal-dialog modal-xl" style="max-width:960px;width:95vw;">
          <div class="modal-header">
            <h3 id="modal-ptb-title" class="modal-title">📊 Tiến Độ Luyện Tập Ca Đoàn</h3>
            <button type="button" class="btn-modal-close" id="btn-close-ptb-modal" aria-label="Đóng">&times;</button>
          </div>
          <div class="modal-body" style="padding:16px;">
            <div id="ptb-subhead" style="color:var(--text-secondary);font-size:0.85rem;margin-bottom:12px;"></div>
            <div class="ptb-privacy-note" style="background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.3);border-radius:6px;padding:8px 12px;font-size:0.75rem;color:#93c5fd;margin-bottom:14px;">
              🔒 <strong>Bảo vệ riêng tư (D10):</strong> Chỉ số chi tiết (độ chính xác, thời lượng) chỉ hiển thị với thành viên đã đồng ý chia sẻ tiến độ.
            </div>
            <div id="ptb-content-wrap" style="overflow-x:auto;">
              <div class="ptb-loading" style="text-align:center;padding:30px;color:var(--text-muted);">Đang tải dữ liệu tiến độ...</div>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(el);

      el.querySelector('#btn-close-ptb-modal')?.addEventListener('click', close);
    }

    _modalEl = el;
    return _modalEl;
  }

  async function show(setlistId, setlistTitle = '') {
    if (!setlistId) return;
    _currentSetlistId = setlistId;
    const modal = _ensureModal();

    const subhead = modal.querySelector('#ptb-subhead');
    if (subhead) {
      subhead.innerHTML = `Chương trình: <strong>${_esc(setlistTitle || '#' + setlistId)}</strong>`;
    }

    if (window.ModalManager) {
      window.ModalManager.open(modal);
    } else {
      modal.classList.remove('hidden');
    }

    await loadBoard(setlistId);
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

  async function loadBoard(setlistId) {
    const wrap = _modalEl?.querySelector('#ptb-content-wrap');
    if (!wrap) return;

    wrap.innerHTML = '<div class="ptb-loading" style="text-align:center;padding:30px;color:var(--text-muted);">Đang tải dữ liệu tiến độ...</div>';

    try {
      const res = await window.ApiService.practiceAssignments.board(setlistId);
      const assignments = res.assignments || res.data?.assignments || [];
      const members = res.members || res.data?.members || [];

      if (assignments.length === 0) {
        wrap.innerHTML = `
          <div style="text-align:center;padding:32px 16px;color:var(--text-muted);">
            <p style="font-size:1.5rem;margin-bottom:8px;">📝</p>
            <p>Chưa có bài tập nào được giao cho chương trình này.</p>
            <p style="font-size:0.78rem;">Hãy bấm nút <strong>"Giao Tập Ca Đoàn"</strong> trong chương trình để tạo bài tập.</p>
          </div>
        `;
        return;
      }

      if (members.length === 0) {
        wrap.innerHTML = `
          <div style="text-align:center;padding:32px 16px;color:var(--text-muted);">
            <p>Chưa có ca viên nào được phân công trong chương trình.</p>
          </div>
        `;
        return;
      }

      // Render Matrix Table
      let tableHtml = `
        <table class="table" style="width:100%;border-collapse:collapse;font-size:0.8rem;text-align:left;">
          <thead>
            <tr style="border-bottom:2px solid var(--border);background:var(--bg-secondary);">
              <th style="padding:10px 8px;min-width:140px;">Ca Viên</th>
              <th style="padding:10px 8px;width:60px;text-align:center;">Bè</th>
              ${assignments.map(a => `
                <th style="padding:10px 8px;min-width:130px;text-align:center;" title="${_esc(a.song_title)} (${_esc(a.completion_rule)})">
                  <div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:140px;">${_esc(a.song_title)}</div>
                  <div style="font-size:0.68rem;color:var(--text-muted);font-weight:normal;">${_esc(a.completion_rule)}</div>
                </th>
              `).join('')}
            </tr>
          </thead>
          <tbody>
      `;

      members.forEach(m => {
        tableHtml += `
          <tr style="border-bottom:1px solid var(--border);">
            <td style="padding:8px;">
              <div style="font-weight:600;color:var(--text);">${_esc(m.display_name)}</div>
              <div style="font-size:0.68rem;color:var(--text-muted);">@${_esc(m.username)}</div>
            </td>
            <td style="padding:8px;text-align:center;">
              <span class="tag" style="font-size:0.68rem;padding:2px 6px;">${_esc(m.voice_part || '—')}</span>
            </td>
        `;

        assignments.forEach(a => {
          const target = m.assignments?.[a.id];
          if (!target) {
            tableHtml += '<td style="padding:8px;text-align:center;color:var(--text-muted);opacity:0.5;">—</td>';
            return;
          }

          const status = target.status;
          let badgeColor = '#94a3b8';
          let badgeBg = 'rgba(100,116,139,0.2)';
          let statusText = 'Chưa tập';

          if (status === 'completed') {
            badgeColor = '#34d399';
            badgeBg = 'rgba(16,185,129,0.2)';
            statusText = 'Hoàn thành';
          } else if (status === 'in_progress') {
            badgeColor = '#fbbf24';
            badgeBg = 'rgba(245,158,11,0.2)';
            statusText = 'Đang tập';
          } else if (status === 'excused') {
            badgeColor = '#c084fc';
            badgeBg = 'rgba(168,85,247,0.2)';
            statusText = 'Miễn tập';
          }

          let detailText = '';
          if (target.has_consent) {
            if (target.accuracy !== null) {
              detailText = `<div style="font-size:0.68rem;color:var(--accent,#8b5cf6);margin-top:2px;">🎯 ${target.accuracy}%</div>`;
            }
          } else {
            detailText = `<div style="font-size:0.65rem;color:var(--text-muted);margin-top:2px;font-style:italic;">Riêng tư</div>`;
          }

          tableHtml += `
            <td style="padding:8px;text-align:center;">
              <span class="tag" style="background:${badgeBg};color:${badgeColor};font-size:0.7rem;padding:2px 6px;border-radius:4px;display:inline-block;">
                ${statusText}
              </span>
              ${detailText}
            </td>
          `;
        });

        tableHtml += '</tr>';
      });

      tableHtml += `
          </tbody>
        </table>
      `;

      wrap.innerHTML = tableHtml;
    } catch (e) {
      wrap.innerHTML = `<div style="text-align:center;padding:20px;color:var(--danger,#ef4444);">Lỗi tải bảng tiến độ: ${_esc(e.message)}</div>`;
    }
  }

  window.PracticeTeamBoardModal = {
    show,
    close
  };

})(typeof window !== 'undefined' ? window : this);
