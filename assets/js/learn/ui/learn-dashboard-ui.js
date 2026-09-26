/**
 * assets/js/learn/ui/learn-dashboard-ui.js
 * Quản lý giao diện Bảng Tiến Độ Luyện Tập Cá Nhân & Góc Nhìn Ca Trưởng có Consent
 *
 * Expose: window.LearnDashboardUI
 */
const LearnDashboardUI = (() => {
  'use strict';

  let _modalEl = null;
  let _activeTab = 'personal'; // 'personal' | 'leader'
  let _dashboardData = null;
  let _leaderData = null;
  let _isLeader = false;

  function init() {
    _modalEl = document.getElementById('learn-dashboard-modal');
    if (!_modalEl) return;

    // Check user role
    const appShellUser = window.AppShell?.getUser?.() || {};
    const role = appShellUser.role || window.__USER_ROLE__ || 'viewer';
    _isLeader = (role === 'admin' || role === 'banhat');

    // Nút mở modal trên header
    const btnOpen = document.getElementById('btn-learn-dashboard');
    if (btnOpen) {
      btnOpen.addEventListener('click', open);
    }

    // Nút đóng modal
    const btnClose = _modalEl.querySelector('.learn-modal-close');
    if (btnClose) {
      btnClose.addEventListener('click', close);
    }

    // Đóng khi click ngoài backdrop
    _modalEl.addEventListener('click', (e) => {
      if (e.target === _modalEl) close();
    });

    // Tab buttons
    const tabBtns = _modalEl.querySelectorAll('.learn-dash-tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        switchTab(tab);
      });
    });

    // Ẩn tab ca trưởng nếu là viewer thường
    const leaderTabBtn = _modalEl.querySelector('[data-tab="leader"]');
    if (leaderTabBtn && !_isLeader) {
      leaderTabBtn.style.display = 'none';
    }
  }

  async function open() {
    if (!_modalEl) return;
    _modalEl.classList.remove('hidden');
    _modalEl.setAttribute('aria-hidden', 'false');
    await loadData();
  }

  function close() {
    if (!_modalEl) return;
    _modalEl.classList.add('hidden');
    _modalEl.setAttribute('aria-hidden', 'true');
  }

  function switchTab(tab) {
    _activeTab = tab;
    if (!_modalEl) return;

    _modalEl.querySelectorAll('.learn-dash-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });

    const personalSection = document.getElementById('learn-dash-personal-section');
    const leaderSection = document.getElementById('learn-dash-leader-section');

    if (personalSection) personalSection.style.display = (tab === 'personal') ? 'block' : 'none';
    if (leaderSection) leaderSection.style.display = (tab === 'leader') ? 'block' : 'none';

    if (tab === 'leader' && !_leaderData) {
      loadLeaderData();
    }
  }

  async function loadData() {
    const loadingEl = document.getElementById('learn-dash-loading');
    if (loadingEl) loadingEl.style.display = 'flex';

    try {
      if (window.ApiService?.practice?.getDashboard) {
        const res = await window.ApiService.practice.getDashboard();
        _dashboardData = res?.dashboard || null;
      }
      renderPersonalDashboard();
    } catch (e) {
      console.warn('[LearnDashboardUI] Lỗi tải dữ liệu:', e);
    } finally {
      if (loadingEl) loadingEl.style.display = 'none';
    }
  }

  async function loadLeaderData() {
    if (!_isLeader) return;
    const leaderLoading = document.getElementById('learn-leader-loading');
    if (leaderLoading) leaderLoading.style.display = 'block';

    try {
      if (window.ApiService?.practice?.getLeaderView) {
        const res = await window.ApiService.practice.getLeaderView();
        _leaderData = res?.leader_view || null;
      }
      renderLeaderView();
    } catch (e) {
      console.warn('[LearnDashboardUI] Lỗi tải dữ liệu ca trưởng:', e);
    } finally {
      if (leaderLoading) leaderLoading.style.display = 'none';
    }
  }

  function renderPersonalDashboard() {
    if (!_dashboardData) return;
    const esc = window.SafeHtml?.escape || ((s) => String(s).replace(/[&<>'"]/g, ''));
    const kpi = _dashboardData.kpi || {};
    const consent = !!_dashboardData.user?.consent_practice_share;

    // 1. KPI Cards
    const elHours = document.getElementById('kpi-practice-hours');
    const elSessions = document.getElementById('kpi-practice-sessions');
    const elAccuracy = document.getElementById('kpi-practice-accuracy');
    const elStreak = document.getElementById('kpi-practice-streak');

    if (elHours) elHours.textContent = `${kpi.total_hours || 0} giờ`;
    if (elSessions) elSessions.textContent = `${kpi.total_sessions || 0} buổi`;
    if (elAccuracy) elAccuracy.textContent = `${kpi.avg_accuracy || 0}%`;
    if (elStreak) elStreak.textContent = `${kpi.streak_days || 0} ngày 🔥`;

    // 2. Consent Switch
    const consentSwitch = document.getElementById('learn-consent-checkbox');
    if (consentSwitch) {
      consentSwitch.checked = consent;
      consentSwitch.onchange = async () => {
        try {
          if (window.ApiService?.practice?.setConsent) {
            await window.ApiService.practice.setConsent(consentSwitch.checked);
            window.App?.showToast?.(
              consentSwitch.checked 
                ? 'Đã bật chia sẻ tiến độ với Ca Trưởng' 
                : 'Đã tắt chia sẻ (Tiến độ của bạn sẽ được ẩn danh)',
              'success'
            );
          }
        } catch (e) {
          consentSwitch.checked = !consentSwitch.checked;
          window.App?.showToast?.('Lỗi cập nhật quyền chia sẻ', 'error');
        }
      };
    }

    // 3. 30-Day Heatmap
    const heatmapContainer = document.getElementById('learn-dash-heatmap');
    if (heatmapContainer && Array.isArray(_dashboardData.heatmap_30d)) {
      heatmapContainer.innerHTML = _dashboardData.heatmap_30d.map(item => {
        const mins = item.minutes || 0;
        let level = 0;
        if (mins > 0 && mins < 10) level = 1;
        else if (mins >= 10 && mins < 30) level = 2;
        else if (mins >= 30 && mins < 60) level = 3;
        else if (mins >= 60) level = 4;

        return `<div class="dash-heat-cell level-${level}" title="${esc(item.date)}: ${mins} phút (${item.sessions} lượt)"></div>`;
      }).join('');
    }

    // 4. Weak measures
    const weakList = document.getElementById('learn-dash-weak-measures');
    if (weakList) {
      const items = _dashboardData.weak_measures || [];
      if (items.length === 0) {
        weakList.innerHTML = '<div class="dash-empty-tip">✨ Chưa ghi nhận đoạn khó nào cần cải thiện! Phong độ rất tuyệt vời.</div>';
      } else {
        weakList.innerHTML = items.map(w => `
          <div class="dash-weak-item">
            <div class="dash-weak-song">${esc(w.song_title || w.song_id)}</div>
            <div class="dash-weak-info">
              <span class="dash-badge-danger">Ô nhịp #${esc(w.measure_no)}</span>
              <span class="dash-weak-stat">Độ chính xác: <strong>${Math.round(w.avg_acc)}%</strong></span>
              <span class="dash-weak-stat">Đã thử: ${esc(w.total_attempts)} lần</span>
            </div>
          </div>
        `).join('');
      }
    }

    // 5. Recent sessions table
    const recentTableBody = document.getElementById('learn-dash-recent-tbody');
    if (recentTableBody) {
      const sessions = _dashboardData.recent_sessions || [];
      if (sessions.length === 0) {
        recentTableBody.innerHTML = '<tr><td colspan="5" class="dash-empty-cell">Chưa có buổi tập nào được ghi nhận</td></tr>';
      } else {
        recentTableBody.innerHTML = sessions.map(s => {
          const dateStr = s.started_at ? new Date(s.started_at * 1000).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) : '—';
          const mins = Math.round((s.duration_seconds || 0) / 60);
          const acc = s.accuracy_total ? `${s.accuracy_total}%` : '—';
          const mode = s.mode === 'melody' ? 'Giai điệu' : 'Đệm hát';

          return `
            <tr>
              <td>${esc(dateStr)}</td>
              <td><strong>${esc(s.song_title || s.song_id)}</strong></td>
              <td><span class="dash-mode-pill">${esc(mode)}</span></td>
              <td>${mins} phút</td>
              <td><span class="dash-acc-chip ${parseFloat(acc) >= 80 ? 'good' : 'warn'}">${esc(acc)}</span></td>
            </tr>
          `;
        }).join('');
      }
    }
  }

  function renderLeaderView() {
    if (!_leaderData) return;
    const esc = window.SafeHtml?.escape || ((s) => String(s).replace(/[&<>'"]/g, ''));
    const membersTbody = document.getElementById('learn-leader-tbody');
    if (!membersTbody) return;

    const members = _leaderData.members || [];
    if (members.length === 0) {
      membersTbody.innerHTML = '<tr><td colspan="6" class="dash-empty-cell">Không có thành viên nào trong danh sách</td></tr>';
      return;
    }

    membersTbody.innerHTML = members.map(m => {
      const lastAt = m.last_practice_at ? new Date(m.last_practice_at * 1000).toLocaleDateString('vi-VN') : 'Chưa tập';
      const consentBadge = m.has_consent 
        ? '<span class="dash-consent-pill ok" title="Thành viên tự nguyện chia sẻ">✓ Đã chia sẻ</span>'
        : '<span class="dash-consent-pill anon" title="Thành viên chọn bảo vệ riêng tư (Ẩn danh)">🔒 Ẩn danh</span>';

      const recentSongsStr = (m.recent_songs && m.recent_songs.length > 0)
        ? m.recent_songs.map(rs => esc(rs.song_title)).join(', ')
        : '—';

      return `
        <tr class="${m.has_consent ? '' : 'dash-anon-row'}">
          <td>
            <div class="dash-member-cell">
              <strong>${esc(m.display_name)}</strong>
              ${consentBadge}
            </div>
            <div class="dash-member-sub">${esc(m.instrument || 'Thành viên')}</div>
          </td>
          <td>${m.sessions_count} lượt</td>
          <td>${m.total_minutes} phút</td>
          <td><span class="dash-acc-chip ${m.avg_accuracy >= 80 ? 'good' : 'warn'}">${m.avg_accuracy}%</span></td>
          <td>${esc(lastAt)}</td>
          <td class="dash-recent-songs-col" title="${esc(recentSongsStr)}">${esc(recentSongsStr)}</td>
        </tr>
      `;
    }).join('');
  }

  return {
    init,
    open,
    close,
    switchTab
  };
})();

if (typeof window !== 'undefined') {
  window.LearnDashboardUI = LearnDashboardUI;
}
