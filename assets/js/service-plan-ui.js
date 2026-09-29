/**
 * service-plan-ui.js
 * Quản lý thông tin chương trình thờ phượng (Theme, Date, Time, Notes),
 * phân công nhân sự, in ấn chương trình A4 và copy danh sách cho Slide màn hình.
 */
const ServicePlanUI = (() => {
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

  function _calcTransposedKey(origKey, semitones) {
    if (!origKey) return null;
    const trimmed = String(origKey).trim();
    if (!trimmed) return null;
    if (!semitones || semitones === 0) return trimmed;

    if (window.TransposeEngine?.calcKey) {
      return window.TransposeEngine.calcKey(trimmed, semitones) || trimmed;
    }
    if (window.TransposeEngine?.transposeChord) {
      try {
        const res = window.TransposeEngine.transposeChord(trimmed, semitones);
        if (res) return res;
      } catch (e) {}
    }

    const NOTES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const NOTES_FLAT  = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
    const m = trimmed.match(/^([A-G][#b]?)(.*)$/);
    if (!m) return trimmed;
    const root = m[1];
    const suffix = m[2] || '';
    const useFlats = trimmed.includes('b') || ['F', 'Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm'].includes(trimmed);
    const arr = useFlats ? NOTES_FLAT : NOTES_SHARP;
    let idx = NOTES_SHARP.indexOf(root);
    if (idx === -1) idx = NOTES_FLAT.indexOf(root);
    if (idx === -1) return trimmed;
    const newRoot = arr[((idx + semitones) % 12 + 12) % 12];
    return newRoot + suffix;
  }

  function renderServicePlanMeta(sl, callbacks = {}) {
    if (!sl) return;
    let metaEl = document.getElementById('setlist-plan-meta');
    if (!metaEl) {
      metaEl = document.createElement('div');
      metaEl.id = 'setlist-plan-meta';
      metaEl.style.cssText = 'padding:8px 10px;margin-bottom:8px;background:var(--bg-overlay);border-radius:6px;border:1px solid var(--border);font-size:0.78rem;display:flex;flex-direction:column;gap:6px;';
      const headerEl = document.querySelector('.setlist-detail-header');
      if (headerEl && headerEl.parentNode) {
        headerEl.parentNode.insertBefore(metaEl, headerEl.nextSibling);
      } else {
        const detail = document.getElementById('setlist-detail') || document.body;
        detail.appendChild(metaEl);
      }
    }

    const myId = window.Auth?.userId?.() ?? null;
    const isLeaderOrAdmin = Boolean(window.Auth && (window.Auth.isAdmin?.() || (myId && (sl.created_by === myId || sl.leader_user_id === myId))));
    const isDraft = (sl.status === 'draft' || !sl.status);

    const statusTag = isDraft
      ? '<span class="tag tag-amber" style="font-size:0.68rem;">Bản nháp</span>'
      : (sl.status === 'completed' ? '<span class="tag" style="font-size:0.68rem;">Đã xong</span>' : '<span class="tag tag-green" style="font-size:0.68rem;">Đã phát hành</span>');

    const timeStr = sl.service_time ? ` • ⏰ ${_esc(sl.service_time)}` : '';
    const themeStr = sl.theme ? `<div style="color:var(--text-secondary);font-size:0.75rem;">🏷 <strong>Chủ đề:</strong> ${_esc(sl.theme)}</div>` : '';
    const descStr = sl.description ? `<div style="color:var(--text-muted);font-style:italic;font-size:0.75rem;">${_esc(sl.description)}</div>` : '';

    const assignments = sl.assignments || [];
    const myAssignment = myId ? assignments.find(a => a.user_id === myId) : null;

    let myBanner = '';
    if (myAssignment) {
      const isConfirmed = myAssignment.status === 'confirmed';
      const isDeclined  = myAssignment.status === 'declined';
      myBanner = `
        <div style="background:rgba(124,58,237,0.12);border:1px solid rgba(124,58,237,0.3);padding:6px 8px;border-radius:6px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px;">
          <div>
            <span>👤 Phân công của bạn: <strong>${_esc(myAssignment.role)}</strong></span>
            ${myAssignment.notes ? `<span style="color:var(--text-muted);"> (${_esc(myAssignment.notes)})</span>` : ''}
          </div>
          <div style="display:flex;gap:4px;">
            ${!isConfirmed ? `<button id="btn-sp-confirm" class="btn btn-sm btn-primary" style="padding:3px 8px;font-size:0.7rem;">✓ Nhận Lời</button>` : '<span class="tag tag-green" style="font-size:0.7rem;">✅ Đã nhận lời</span>'}
            ${!isDeclined ? `<button id="btn-sp-decline" class="btn btn-sm btn-ghost text-danger" style="padding:3px 8px;font-size:0.7rem;">✕ Báo Bận</button>` : '<span class="tag tag-red" style="font-size:0.7rem;">❌ Báo bận</span>'}
          </div>
        </div>
      `;
    }

    // Offline Package Status & Control
    const offlineStatus = window.OfflineSetlistManager?.getPackageStatus?.(sl.id) || { isDownloaded: false, isReady: false };
    let offlineBadge = '';
    let offlineActions = '';

    if (offlineStatus.isDownloaded) {
      if (offlineStatus.isReady) {
        offlineBadge = `<span class="tag tag-green tag-offline-ready" style="font-size:0.68rem;font-weight:700;" title="Đã tải đủ 100% file XML và hợp âm">✓ Sẵn sàng offline (${offlineStatus.cachedCount}/${offlineStatus.totalCount})</span>`;
      } else {
        offlineBadge = `<span class="tag tag-amber" style="font-size:0.68rem;" title="Thiếu một số file bài hát">⚠️ Chưa đủ offline (${offlineStatus.cachedCount}/${offlineStatus.totalCount})</span>`;
      }
      offlineActions = `
        <button id="btn-sp-offline-sync" class="btn btn-sm btn-ghost" style="padding:2px 6px;font-size:0.68rem;" title="Cập nhật lại gói tải về máy">🔄 Cập nhật</button>
        <button id="btn-sp-offline-del" class="btn btn-sm btn-ghost text-danger" style="padding:2px 6px;font-size:0.68rem;" title="Xóa gói offline giải phóng bộ nhớ">🗑️ Xóa</button>
      `;
    } else {
      offlineBadge = `<span class="tag" style="font-size:0.68rem;opacity:0.7;">○ Chưa tải offline</span>`;
      offlineActions = `
        <button id="btn-sp-offline-dl" class="btn btn-sm btn-ghost btn-sp-offline-dl" style="padding:2px 8px;font-size:0.68rem;border:1px solid var(--border);" title="Tải trọn bộ bài hát & hợp âm về máy để dùng khi không có mạng">📥 Tải cho Chúa nhật</button>
      `;
    }

    metaEl.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px;">
        <div>
          <span>📅 ${_esc(sl.scheduled_date)}${timeStr}</span>
          ${statusTag}
        </div>
        <div style="display:flex;gap:4px;flex-wrap:wrap;">
          ${isLeaderOrAdmin && isDraft ? `<button id="btn-sp-publish" class="btn btn-sm btn-primary" style="padding:3px 8px;font-size:0.72rem;font-weight:700;">🚀 Phát Hành</button>` : ''}
          ${isLeaderOrAdmin ? `
            <button id="btn-sp-create-practice" class="btn btn-sm btn-ghost" style="padding:3px 8px;font-size:0.72rem;border:1px solid rgba(59,130,246,0.4);color:#60a5fa;" title="Tạo bài tập cho mọi bài hát trong chương trình và gán cho ca viên">📋 Giao Tập</button>
            <button id="btn-sp-practice-board" class="btn btn-sm btn-ghost" style="padding:3px 8px;font-size:0.72rem;border:1px solid rgba(139,92,246,0.4);color:#c084fc;" title="Xem bảng ma trận tiến độ tập luyện của ca đoàn">📊 Tiến Độ Tập</button>
          ` : ''}
          <button id="btn-sp-assign" class="btn btn-sm btn-ghost" style="padding:3px 8px;font-size:0.72rem;border:1px solid var(--border);">👥 Phân Công (${assignments.length})</button>
          <button id="btn-sp-print-booklet" class="btn btn-sm btn-ghost" style="padding:3px 8px;font-size:0.72rem;border:1px solid rgba(16,185,129,0.4);color:#10b981;" title="In trọn bộ Booklet chương trình thờ phượng gồm bìa và các bài hát chuẩn A4">📖 In Booklet</button>
        </div>
      </div>
      ${themeStr}
      ${descStr}
      ${myBanner}
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:4px;margin-top:2px;padding-top:4px;border-top:1px dashed var(--border);">
        <div style="display:flex;align-items:center;gap:6px;">
          ${offlineBadge}
        </div>
        <div style="display:flex;gap:4px;">
          ${offlineActions}
        </div>
      </div>
      <div id="sp-offline-progress-wrap" class="hidden" style="margin-top:4px;background:rgba(0,0,0,0.15);padding:6px 8px;border-radius:4px;">
        <div style="display:flex;justify-content:space-between;font-size:0.68rem;margin-bottom:2px;">
          <span id="sp-offline-status-text" style="color:var(--text-secondary);">Đang chuẩn bị tải...</span>
          <span id="sp-offline-percent" style="font-weight:700;">0%</span>
        </div>
        <div style="background:var(--border);height:4px;border-radius:2px;overflow:hidden;">
          <div id="sp-offline-bar" style="background:var(--accent,#8b5cf6);width:0%;height:100%;transition:width 0.15s ease;"></div>
        </div>
      </div>
    `;

    metaEl.querySelector('#btn-sp-create-practice')?.addEventListener('click', async () => {
      if (confirm(`Tạo bài tập luyện bè cho ca đoàn từ chương trình "${sl.title}"?`)) {
        try {
          const res = await window.ApiService.practiceAssignments.createFromPlan(sl.id);
          const count = res.created_count ?? (res.data?.created_count || 0);
          window.App?.showToast?.(`✅ Đã giao ${count} bài tập cho ca đoàn!`, 'success');
        } catch (e) {
          window.App?.showToast?.('Lỗi giao bài: ' + e.message, 'error');
        }
      }
    });

    metaEl.querySelector('#btn-sp-practice-board')?.addEventListener('click', () => {
      if (window.PracticeTeamBoardModal) {
        window.PracticeTeamBoardModal.show(sl.id, sl.title);
      }
    });

    metaEl.querySelector('#btn-sp-assign')?.addEventListener('click', () => {
      if (window.ServicePlanAssignModal) {
        window.ServicePlanAssignModal.show(sl.id, sl.title);
      }
    });

    metaEl.querySelector('#btn-sp-print-booklet')?.addEventListener('click', () => {
      window.open(`print/service-booklet.php?setlist_id=${sl.id}`, '_blank');
    });

    metaEl.querySelector('#btn-sp-publish')?.addEventListener('click', async () => {
      if (confirm('Phát hành chương trình này cho Ban Nhạc & ghi nhận lịch sử bài hát?')) {
        try {
          await window.ApiService.setlists.publish(sl.id);
          window.App?.showToast?.('🚀 Đã phát hành chương trình cho Ban Nhạc!', 'success');
          callbacks.onRefresh?.(sl.id);
        } catch (e) {
          window.App?.showToast?.('Lỗi phát hành: ' + e.message, 'error');
        }
      }
    });

    metaEl.querySelector('#btn-sp-confirm')?.addEventListener('click', async () => {
      if (!myAssignment) return;
      try {
        await window.ApiService.setlists.respondAssignment(myAssignment.id, 'confirmed');
        window.App?.showToast?.('✅ Đã xác nhận tham gia buổi nhóm!', 'success');
        callbacks.onRefresh?.(sl.id);
      } catch (e) {
        window.App?.showToast?.('Lỗi: ' + e.message, 'error');
      }
    });

    metaEl.querySelector('#btn-sp-decline')?.addEventListener('click', async () => {
      if (!myAssignment) return;
      const reason = prompt('Lý do báo bận (không bắt buộc):');
      try {
        await window.ApiService.setlists.respondAssignment(myAssignment.id, 'declined', reason);
        window.App?.showToast?.('Đã báo bận buổi nhóm', 'info');
        callbacks.onRefresh?.(sl.id);
      } catch (e) {
        window.App?.showToast?.('Lỗi: ' + e.message, 'error');
      }
    });

    const handleOfflineDownload = async () => {
      if (!window.OfflineSetlistManager) {
        window.App?.showToast?.('Tính năng offline không khả dụng', 'warning');
        return;
      }
      const wrap = metaEl.querySelector('#sp-offline-progress-wrap');
      const txt = metaEl.querySelector('#sp-offline-status-text');
      const pct = metaEl.querySelector('#sp-offline-percent');
      const bar = metaEl.querySelector('#sp-offline-bar');
      if (wrap) wrap.classList.remove('hidden');

      try {
        const res = await window.OfflineSetlistManager.downloadPackage(sl.id, (prog) => {
          if (txt) txt.textContent = prog.songTitle || 'Đang tải...';
          if (pct) pct.textContent = prog.percent + '%';
          if (bar) bar.style.width = prog.percent + '%';
        });
        if (res.isReady) {
          window.App?.showToast?.(`⚡ Đã tải xong Setlist (${res.totalSongs} bài) để dùng offline!`, 'success');
        } else {
          window.App?.showToast?.(`⚠️ Đã tải ${res.cachedCount}/${res.totalSongs} bài. Một số bài gặp lỗi.`, 'warning');
        }
      } catch (err) {
        window.App?.showToast?.('Lỗi tải offline: ' + err.message, 'error');
      } finally {
        renderServicePlanMeta(sl, callbacks);
      }
    };

    metaEl.querySelector('#btn-sp-offline-dl')?.addEventListener('click', handleOfflineDownload);
    metaEl.querySelector('#btn-sp-offline-sync')?.addEventListener('click', handleOfflineDownload);

    metaEl.querySelector('#btn-sp-offline-del')?.addEventListener('click', () => {
      if (confirm(`Xóa gói offline của chương trình "${sl.title}"?`)) {
        window.OfflineSetlistManager?.removePackage?.(sl.id);
        window.App?.showToast?.('Đã xóa gói offline khỏi máy', 'info');
        renderServicePlanMeta(sl, callbacks);
      }
    });
  }

  function printSetlist(currentSetlist, allSongsCache = []) {
    if (!currentSetlist || !currentSetlist.items || currentSetlist.items.length === 0) {
      window.App?.showToast?.('Chưa có bài hát trong Setlist!', 'warning');
      return;
    }

    const printWin = window.open('', '_blank');
    if (!printWin) return;

    const itemsHtml = currentSetlist.items.map((item, idx) => {
      const songObj = allSongsCache.find(s => String(s.id) === String(item.song_id)) || window.LibraryUI?.getSongObj?.(item.song_id);
      const title = songObj ? songObj.title : item.song_id;
      const numStr = String(idx + 1).padStart(2, '0');
      const origKey = songObj?.defaultKey || songObj?.keySignature || '';
      const semitones = parseInt(item.transpose_key, 10) || 0;
      let key = '';
      if (origKey) {
        const practiced = _calcTransposedKey(origKey, semitones) || origKey;
        key = `Tone: ${origKey} (Tập: ${practiced})`;
      } else if (semitones !== 0) {
        key = `Tông: ${semitones > 0 ? '+' : ''}${semitones}`;
      } else {
        key = 'Gốc';
      }
      const bpm = item.bpm ? `♩ = ${item.bpm} BPM` : '';
      const profile = (item.chord_profile && item.chord_profile !== 'default') ? `🎸 ${item.chord_profile}` : '';

      return `
        <tr>
          <td style="padding:8px; border-bottom:1px solid #ddd; text-align:center; font-weight:bold;">${numStr}</td>
          <td style="padding:8px; border-bottom:1px solid #ddd; font-weight:600;">${_esc(title)}</td>
          <td style="padding:8px; border-bottom:1px solid #ddd; text-align:center;">${_esc(key)}</td>
          <td style="padding:8px; border-bottom:1px solid #ddd; text-align:center;">${_esc(bpm)}</td>
          <td style="padding:8px; border-bottom:1px solid #ddd; text-align:center;">${_esc(profile)}</td>
        </tr>
      `;
    }).join('');

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Chương trình - ${_esc(currentSetlist.title)}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 20px; color: #111; }
          h2 { margin-bottom: 4px; text-transform: uppercase; }
          .meta { color: #555; margin-bottom: 20px; font-size: 14px; }
          table { width: 100%; border-collapse: collapse; font-size: 15px; }
          th { background: #f4f4f4; padding: 8px; border-bottom: 2px solid #ccc; text-align: left; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <h2>${_esc(currentSetlist.title)}</h2>
        <div class="meta">📅 Ngày: ${_esc(currentSetlist.scheduled_date)} | Tổng số: ${currentSetlist.items.length} bài hát</div>
        <table>
          <thead>
            <tr>
              <th style="width: 40px; text-align:center;">STT</th>
              <th>Tên Bài Hát</th>
              <th style="width: 140px; text-align:center;">Tông</th>
              <th style="width: 110px; text-align:center;">Tốc độ</th>
              <th style="width: 100px; text-align:center;">Hợp Âm</th>
            </tr>
          </thead>
          <tbody>${itemsHtml}</tbody>
        </table>
        <script>window.onload = function() { window.print(); };<\/script>
      </body>
      </html>
    `);
    printWin.document.close();
  }

  async function copySetlistSlide(currentSetlist, allSongsCache = []) {
    if (!currentSetlist || !currentSetlist.items || currentSetlist.items.length === 0) {
      window.App?.showToast?.('Chưa có bài hát trong Setlist!', 'warning');
      return;
    }

    let slideText = `📋 CHƯƠNG TRÌNH: ${currentSetlist.title}\n==============================\n\n`;

    currentSetlist.items.forEach((item, idx) => {
      const songObj = allSongsCache.find(s => String(s.id) === String(item.song_id)) || window.LibraryUI?.getSongObj?.(item.song_id);
      const title = songObj ? songObj.title : item.song_id;
      const numStr = String(idx + 1).padStart(2, '0');
      const origKey = songObj?.defaultKey || songObj?.keySignature || '';
      const semitones = parseInt(item.transpose_key, 10) || 0;
      let key = '';
      if (origKey) {
        const practiced = _calcTransposedKey(origKey, semitones) || origKey;
        key = ` [Tone: ${origKey} | Tập: ${practiced}]`;
      } else if (semitones !== 0) {
        key = ` [Tông: ${semitones > 0 ? '+' : ''}${semitones}]`;
      }
      const bpm = item.bpm ? ` [♩${item.bpm} BPM]` : '';
      slideText += `${numStr}. ${title}${key}${bpm}\n`;
    });

    try {
      await navigator.clipboard.writeText(slideText);
      window.App?.showToast?.('📋 Đã copy danh sách bài hát cho Slide!', 'success');
    } catch (e) {
      window.App?.showToast?.('Lỗi copy bộ đệm', 'error');
    }
  }

  return {
    renderServicePlanMeta,
    printSetlist,
    copySetlistSlide,
    calcTransposedKey: _calcTransposedKey
  };
})();

window.ServicePlanUI = ServicePlanUI;
