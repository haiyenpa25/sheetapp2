/**
 * manager/js/manager-usage.js — Liturgical Song Usage & History Analytics
 * Part of SheetApp Manager Portal (Epic 4.3)
 */
(() => {
  'use strict';

  let _ctx = null;

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
    const btnFilter = document.getElementById('btn-filter-usage');
    const btnReset = document.getElementById('btn-reset-usage');
    const fromInput = document.getElementById('usage-filter-from');
    const toInput = document.getElementById('usage-filter-to');

    btnFilter?.addEventListener('click', () => {
      loadUsageReport({
        from: fromInput?.value || '',
        to: toInput?.value || ''
      });
    });

    btnReset?.addEventListener('click', () => {
      if (fromInput) fromInput.value = '';
      if (toInput) toInput.value = '';
      loadUsageReport({});
    });
  }

  async function loadUsageReport(filters = {}) {
    const container = document.getElementById('tab-usage');
    if (!container) return;

    const tbodyMost = document.getElementById('tbody-usage-most');
    const tbodyDormant = document.getElementById('tbody-usage-dormant');
    const tbodyHistory = document.getElementById('tbody-usage-history');

    if (tbodyMost) tbodyMost.innerHTML = '<tr><td colspan="7" class="mgr-table-loading"><div class="mgr-spinner"></div>Đang tải báo cáo...</td></tr>';

    try {
      if (!window.ApiService?.setlists?.usageReport) {
        throw new Error('ApiService.setlists.usageReport không khả dụng');
      }
      const res = await window.ApiService.setlists.usageReport(filters);
      const data = res?.data || res || {};
      _renderSummary(data.summary || {});
      _renderMostUsed(data.most_used || []);
      _renderDormant(data.dormant_songs || []);
      _renderRecentHistory(data.recent_history || []);
    } catch (e) {
      console.error('[ManagerUsage] Error loading report:', e);
      if (tbodyMost) tbodyMost.innerHTML = `<tr><td colspan="7" style="color:var(--danger);text-align:center;padding:1.5rem;">Lỗi tải báo cáo: ${_escape(e.message)}</td></tr>`;
    }
  }

  function _renderSummary(s) {
    const setEl = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    setEl('stat-usage-services', s.total_services ?? 0);
    setEl('stat-usage-plays', s.total_song_plays ?? 0);
    setEl('stat-usage-unique', s.unique_songs_used ?? 0);
    setEl('stat-usage-coverage', (s.coverage_percent ?? 0) + '%');
  }

  function _renderMostUsed(list) {
    const tbody = document.getElementById('tbody-usage-most');
    if (!tbody) return;

    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:1.5rem;color:var(--text-muted);">Chưa có dữ liệu sử dụng bài hát trong chương trình thờ phượng</td></tr>';
      return;
    }

    tbody.innerHTML = list.map((item, idx) => {
      const stt = idx + 1;
      const numBadge = item.httlvnId ? `<span class="res-item-num">#${_escape(item.httlvnId)}</span> ` : '';
      const title = _escape(item.song_title || item.song_id);
      const count = Number.parseInt(item.usage_count, 10) || 0;
      const lastDate = _escape(item.last_used_date || '—');
      const defKey = _escape(item.defaultKey || '—');
      const semi = Number.parseInt(item.frequent_transpose, 10) || 0;
      const toneStr = semi !== 0 ? `${semi > 0 ? '+' : ''}${semi}` : 'Gốc';
      const profile = _escape(item.frequent_profile || 'HD');

      const printUrl = `../print/chord-sheet.php?song=${encodeURIComponent(item.song_id)}&set=${encodeURIComponent(profile)}&t=${semi}`;

      return `
        <tr>
          <td style="text-align:center;font-weight:700;">${stt}</td>
          <td>
            <div style="font-weight:600;">${numBadge}${title}</div>
            <div style="font-size:0.75rem;color:var(--text-muted);">${_escape(item.song_id)}</div>
          </td>
          <td style="text-align:center;"><span class="mgr-badge mgr-badge-primary" style="font-weight:700;">${count} lần</span></td>
          <td style="text-align:center;">${lastDate}</td>
          <td style="text-align:center;">${defKey} (${toneStr})</td>
          <td style="text-align:center;"><span class="tag tag-amber" style="font-size:0.7rem;">${profile}</span></td>
          <td style="text-align:center;">
            <a href="${printUrl}" target="_blank" class="mgr-btn mgr-btn-sm mgr-btn-ghost" title="Mở bản in Lời + Hợp âm chuyên dụng">🖨️ In / PDF</a>
          </td>
        </tr>
      `;
    }).join('');
  }

  function _renderDormant(list) {
    const tbody = document.getElementById('tbody-usage-dormant');
    if (!tbody) return;

    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:1.5rem;color:var(--text-muted);">Tất cả bài hát đều đã được sử dụng gần đây</td></tr>';
      return;
    }

    tbody.innerHTML = list.map((item, idx) => {
      const stt = idx + 1;
      const numBadge = item.httlvnId ? `<span class="res-item-num">#${_escape(item.httlvnId)}</span> ` : '';
      const title = _escape(item.song_title || item.song_id);
      const defKey = _escape(item.defaultKey || '—');
      const pastCount = Number.parseInt(item.past_usage_count, 10) || 0;
      const lastDate = item.last_used_date ? _escape(item.last_used_date) : '<span style="color:var(--text-muted);font-style:italic;">Chưa từng hát</span>';

      const printUrl = `../print/chord-sheet.php?song=${encodeURIComponent(item.song_id)}&set=HD&t=0`;

      return `
        <tr>
          <td style="text-align:center;">${stt}</td>
          <td>
            <div style="font-weight:500;">${numBadge}${title}</div>
            <div style="font-size:0.75rem;color:var(--text-muted);">${_escape(item.song_id)}</div>
          </td>
          <td style="text-align:center;">${defKey}</td>
          <td style="text-align:center;">${lastDate}</td>
          <td style="text-align:center;">
            <a href="${printUrl}" target="_blank" class="mgr-btn mgr-btn-sm mgr-btn-ghost" title="Xem trước bản in">🖨️ Bản in</a>
          </td>
        </tr>
      `;
    }).join('');
  }

  function _renderRecentHistory(list) {
    const tbody = document.getElementById('tbody-usage-history');
    if (!tbody) return;

    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:1.5rem;color:var(--text-muted);">Chưa có nhật ký buổi nhóm thờ phượng</td></tr>';
      return;
    }

    tbody.innerHTML = list.map(item => {
      const date = _escape(item.service_date || '—');
      const sTitle = _escape(item.service_title || 'Chương trình');
      const songTitle = _escape(item.song_title || item.song_id);
      const semi = Number.parseInt(item.transpose_key, 10) || 0;
      const toneStr = semi !== 0 ? `${semi > 0 ? '+' : ''}${semi}` : 'Gốc';
      const profile = _escape(item.chord_profile || 'HD');

      const bookletUrl = `../print/service-booklet.php?setlist_id=${encodeURIComponent(item.setlist_id)}`;

      return `
        <tr>
          <td><strong>${date}</strong></td>
          <td>
            <div>${sTitle}</div>
            ${item.service_theme ? `<div style="font-size:0.75rem;color:var(--text-muted);">🏷 ${_escape(item.service_theme)}</div>` : ''}
          </td>
          <td style="font-weight:600;">${songTitle}</td>
          <td style="text-align:center;">${toneStr} (${profile})</td>
          <td style="text-align:center;">
            <a href="${bookletUrl}" target="_blank" class="mgr-btn mgr-btn-sm mgr-btn-ghost" title="Mở Booklet chương trình của buổi nhóm này">📖 Booklet</a>
          </td>
        </tr>
      `;
    }).join('');
  }

  window.ManagerUsage = {
    init,
    loadUsageReport
  };
})();
