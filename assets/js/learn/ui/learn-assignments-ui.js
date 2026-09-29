/**
 * assets/js/learn/ui/learn-assignments-ui.js
 *
 * Điều khiển giao diện "Bài tập của tôi" (My Assignments Modal & Workflow) trong /learn:
 * - Hiển thị danh sách bài tập được phân công cho ca viên theo hạn chót và độ ưu tiên.
 * - Hiển thị badge Bè (S/A/T/B), mục tiêu BPM, luật hoàn thành (manual/accuracy/minutes).
 * - Hành động "Tập ngay": Nạp bài vào Learn Studio, solo đúng bè, đặt đúng BPM & Transpose.
 * - Hành động "Đã thuộc": Đánh dấu hoàn thành bài tập (luật manual).
 * - Tương thích chuẩn A11y & ModalManager.
 */
(function(window) {
  'use strict';

  let _assignments = [];
  let _currentFilter = 'all'; // 'all' | 'in_progress' | 'completed'
  let _loadSeq = 0;

  function _escape(str) {
    if (!str) return '';
    return window.SafeHtml ? window.SafeHtml.escape(str) : String(str);
  }

  function _formatDue(dueStr) {
    if (!dueStr) return 'Không có hạn';
    try {
      const d = new Date(dueStr);
      return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch (e) {
      return dueStr;
    }
  }

  function _getRuleLabel(rule, threshold) {
    switch (rule) {
      case 'accuracy':
        const acc = threshold ? (threshold <= 1.0 ? threshold * 100 : threshold) : 85;
        return `🎯 Đạt độ chính xác ≥ ${acc}%`;
      case 'minutes':
        return `⏱️ Luyện tập đủ ≥ ${threshold || 10} phút`;
      default:
        return '🖐️ Tự đánh dấu "Đã thuộc"';
    }
  }

  function _renderCard(item) {
    const isCompleted = item.status === 'completed';
    const statusLabel = isCompleted ? '✅ Đã thuộc' : (item.status === 'in_progress' ? '🔄 Đang tập' : '⏳ Chưa bắt đầu');
    const statusClass = isCompleted ? 'status-completed' : (item.status === 'in_progress' ? 'status-in-progress' : 'status-assigned');
    const voicePart = item.voice_part || 'S';

    return `
      <div class="learn-assignment-card ${isCompleted ? 'is-completed' : ''}" data-id="${item.assignment_id}">
        <div class="lac-header">
          <div class="lac-title-group">
            <span class="lac-voice-badge voice-${voicePart}">Bè ${voicePart}</span>
            <h4 class="lac-song-title">${_escape(item.song_title || item.song_id)}</h4>
          </div>
          <span class="lac-status-badge ${statusClass}">${statusLabel}</span>
        </div>

        <div class="lac-meta-grid">
          <div class="lac-meta-item">
            <span class="lac-meta-label">Chương trình:</span>
            <span class="lac-meta-val">${_escape(item.title || 'Buổi nhóm')}</span>
          </div>
          <div class="lac-meta-item">
            <span class="lac-meta-label">Hạn chót:</span>
            <span class="lac-meta-val">${_formatDue(item.due_at)}</span>
          </div>
          <div class="lac-meta-item">
            <span class="lac-meta-label">Yêu cầu:</span>
            <span class="lac-meta-val">${_getRuleLabel(item.completion_rule, item.completion_threshold)}</span>
          </div>
          ${item.target_bpm ? `
            <div class="lac-meta-item">
              <span class="lac-meta-label">Tempo mục tiêu:</span>
              <span class="lac-meta-val">${item.target_bpm} BPM</span>
            </div>
          ` : ''}
        </div>

        ${item.notes ? `<div class="lac-notes">📝 <em>${_escape(item.notes)}</em></div>` : ''}

        <div class="lac-actions">
          <button class="btn-lac-practice" data-action="practice" data-song="${_escape(item.song_id)}" data-assignment="${item.assignment_id}" data-voice="${voicePart}" data-bpm="${item.target_bpm || ''}" data-transpose="${item.target_transpose || 0}" type="button">
            🎹 Tập ngay
          </button>
          ${!isCompleted ? `
            <button class="btn-lac-mark-done" data-action="mark_done" data-assignment="${item.assignment_id}" type="button">
              ✓ Đã thuộc
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }

  function _renderList() {
    const listEl = document.getElementById('lac-list-container');
    if (!listEl) return;

    let filtered = _assignments;
    if (_currentFilter === 'in_progress') {
      filtered = _assignments.filter(a => a.status !== 'completed');
    } else if (_currentFilter === 'completed') {
      filtered = _assignments.filter(a => a.status === 'completed');
    }

    if (filtered.length === 0) {
      listEl.innerHTML = `
        <div class="lac-empty-state">
          <span style="font-size:2rem;display:block;margin-bottom:0.5rem;">🎉</span>
          <p>Không có bài tập nào trong mục này.</p>
        </div>
      `;
      return;
    }

    listEl.innerHTML = filtered.map(_renderCard).join('');
  }

  function _updateBadge() {
    const uncompletedCount = _assignments.filter(a => a.status !== 'completed').length;
    const countBadge = document.getElementById('learn-assignments-count-badge');
    if (countBadge) {
      if (uncompletedCount > 0) {
        countBadge.textContent = uncompletedCount;
        countBadge.classList.remove('hidden');
      } else {
        countBadge.classList.add('hidden');
      }
    }
  }

  async function loadAssignments(silent = false) {
    if (!window.ApiService?.practiceAssignments?.mine) return;
    const listEl = document.getElementById('lac-list-container');
    const seq = ++_loadSeq;

    if (!silent && _assignments.length === 0 && listEl) {
      listEl.innerHTML = '<div class="lac-loading">Đang tải danh sách bài tập...</div>';
    }

    try {
      const res = await window.ApiService.practiceAssignments.mine();
      if (seq !== _loadSeq) return; // Bỏ qua dữ liệu cũ nếu có request mới hơn
      _assignments = res.assignments || res.data?.assignments || [];
      _renderList();
      _updateBadge();
    } catch (e) {
      if (seq !== _loadSeq) return;
      console.warn('[LearnAssignmentsUI] Load failed:', e);
      if (listEl && _assignments.length === 0) {
        listEl.innerHTML = '<div class="lac-empty-state"><p>Không thể tải bài tập. Hãy thử lại sau.</p></div>';
      }
    }
  }

  function open() {
    const modal = document.getElementById('modal-learn-assignments');
    if (!modal) return;
    if (window.ModalManager) {
      window.ModalManager.open(modal);
    } else {
      modal.classList.remove('hidden');
    }
    // Render danh sách bài tập đã nạp
    if (_assignments.length === 0) {
      loadAssignments(false);
    } else {
      _renderList();
    }
  }

  function close() {
    const modal = document.getElementById('modal-learn-assignments');
    if (!modal) return;
    if (window.ModalManager) {
      window.ModalManager.close(modal);
    } else {
      modal.classList.add('hidden');
    }
  }

  let _initialized = false;
  function init() {
    if (_initialized) return;
    _initialized = true;

    const openBtn = document.getElementById('btn-learn-assignments');
    if (openBtn) {
      openBtn.addEventListener('click', (e) => {
        e.preventDefault();
        open();
      });
    }

    const closeBtn = document.getElementById('btn-close-assignments-modal');
    if (closeBtn) {
      closeBtn.addEventListener('click', close);
    }

    // Filter tabs
    document.querySelectorAll('.lac-filter-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.lac-filter-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        _currentFilter = tab.dataset.filter || 'all';
        _renderList();
      });
    });

    // Card Action delegates
    const container = document.getElementById('lac-list-container');
    if (container) {
      container.addEventListener('click', async (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;
        const action = btn.dataset.action;

        if (action === 'practice') {
          const songId = btn.dataset.song;
          const assignmentId = btn.dataset.assignment;
          const voicePart = btn.dataset.voice;
          const bpm = btn.dataset.bpm;
          const transpose = btn.dataset.transpose;

          close();

          // Chuyển hướng sang bài tập với các tham số
          const base = (window.__APP_BASE__ || '').replace(/\/+$/, '');
          const query = new URLSearchParams();
          if (songId) query.set('song', songId);
          if (assignmentId) query.set('assignment', assignmentId);
          if (voicePart) query.set('part', voicePart);
          if (bpm) query.set('bpm', bpm);
          if (transpose) query.set('trans', transpose);

          window.location.href = `${base}/learn/?${query.toString()}`;
        } else if (action === 'mark_done') {
          const assignmentId = parseInt(btn.dataset.assignment, 10);
          if (!assignmentId) return;

          btn.disabled = true;
          btn.textContent = 'Đang lưu...';
          _loadSeq++; // Hủy mọi yêu cầu fetch nạp dữ liệu cũ đang dở dang

          try {
            await window.ApiService.practiceAssignments.markDone(assignmentId);
            const found = _assignments.find(a => a.assignment_id === assignmentId);
            if (found) {
              found.status = 'completed';
            }
            _renderList();
            _updateBadge();
          } catch (err) {
            alert('Không thể cập nhật trạng thái bài tập: ' + err.message);
            btn.disabled = false;
            btn.textContent = '✓ Đã thuộc';
          }
        }
      });
    }

    // Kiểm tra cờ tính năng
    if (window.FeatureFlags && !window.FeatureFlags.get('PRACTICE_ASSIGNMENTS')) {
      const openBtn = document.getElementById('btn-learn-assignments');
      if (openBtn) openBtn.style.display = 'none';
      return;
    }

    // Tự động tải số lượng khi mở trang
    if (window.__IS_LOGGED_IN__) {
      loadAssignments();
    }
  }

  window.LearnAssignmentsUI = {
    init,
    open,
    close,
    loadAssignments
  };

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }

})(typeof window !== 'undefined' ? window : this);
