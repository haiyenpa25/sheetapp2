/**
 * setlist-detail.js
 * Quản lý chi tiết Setlist:
 * - Xem chi tiết setlist và danh sách bài hát
 * - Đổi Tông tập (TransposePick), Đổi Tempo tập (TempoPick)
 * - Nút [💾 Lưu Tập] lưu toàn vẹn Tông, Tempo, Profile
 * - Thêm / Xoá bài hát trong Setlist
 * - Tìm kiếm bài hát nội tuyến để thêm vào Setlist
 */
const SetlistDetail = (() => {
  'use strict';

  function _esc(str) {
    if (window.SafeHtml?.escape) return window.SafeHtml.escape(str);
    return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function _calcTransposedKey(origKey, semitones) {
    return window.ServicePlanUI?.calcTransposedKey?.(origKey, semitones) || origKey || null;
  }

  function _formatToneBadge(origKey, transposeKey, canEdit = false) {
    const semi = parseInt(transposeKey, 10) || 0;
    const clean = origKey ? String(origKey).trim() : '';
    const diffStr = semi > 0 ? `+${semi}` : `${semi}`;
    const cursor = canEdit ? 'cursor:pointer;' : '';
    const hint = canEdit ? 'Click để đổi tông tập | ' : '';

    if (clean) {
      const practiced = _calcTransposedKey(clean, semi) || clean;
      return `<span class="tag tag-purple btn-edit-tone" style="${cursor}" title="${hint}Tông gốc: ${_esc(clean)}">Tone: ${_esc(clean)} | Tập: ${_esc(practiced)}${semi !== 0 ? ` (${diffStr})` : ''}</span>`;
    }
    return semi !== 0 ? `<span class="tag tag-purple btn-edit-tone" style="${cursor}" title="${hint}Đã dịch ${diffStr} cung">Tập: ${diffStr}</span>` : '';
  }

  let _context = null;
  function setContext(ctx) { _context = ctx; }
  function getContext() { return _context || window.SetlistUI || {}; }

  async function viewSetlistDetail(id) {
    const ctx = getContext();
    window.App?.showLoading?.('Đang tải Setlist...');
    try {
      const data = await window.ApiService.setlists.get(id);
      if (data && data.success) {
        ctx.setCurrentSetlist?.(data.data);
        _applyDetailView(data.data);
        await renderSetlistItems();
        window.App?.hideLoading?.();
        return;
      }
    } catch (e) {
      console.warn('[SetlistDetail] Online fetch failed, checking offline store:', e);
    }

    if (window.OfflineSetlistManager) {
      const offSl = window.OfflineSetlistManager.getOfflineSetlist(id);
      if (offSl) {
        ctx.setCurrentSetlist?.(offSl);
        _applyDetailView(offSl);
        await renderSetlistItems();
        window.App?.showToast?.('⚡ Đang dùng dữ liệu Setlist ngoại tuyến (Offline)', 'info');
        window.App?.hideLoading?.();
        return;
      }
    }
    window.App?.hideLoading?.();
  }

  function _applyDetailView(sl) {
    document.getElementById('setlist-list')?.classList.add('hidden');
    document.getElementById('setlist-detail')?.classList.remove('hidden');
    const titleEl = document.getElementById('setlist-detail-title');
    if (titleEl) titleEl.textContent = sl.title;
    window.ServicePlanUI?.renderServicePlanMeta?.(sl, { onRefresh: (sId) => viewSetlistDetail(sId) });
    document.getElementById('setlist-add-container')?.classList.remove('hidden');
  }

  async function _handleEditTone(item, songObj, title, idx) {
    const ctx = getContext();
    if (!window.TransposePick) return;
    const currentSemi = parseInt(item.transpose_key, 10) || 0;
    const itemOrigKey = songObj?.defaultKey || songObj?.keySignature || '';
    const currentBpm = parseInt(item.bpm, 10) || 100;
    const res = await window.TransposePick.show(title, currentSemi, itemOrigKey, currentBpm);
    if (res === null) return;

    const newTranspose = typeof res === 'object' ? res.transpose : res;
    const newBpm = typeof res === 'object' ? res.bpm : null;
    try {
      const updateData = { transpose_key: newTranspose };
      if (newBpm) updateData.bpm = newBpm;
      await window.ApiService.setlists.updateItem(item.id, updateData);
      item.transpose_key = newTranspose;
      if (newBpm) item.bpm = newBpm;
      window.App?.showToast?.(`✅ Đã cập nhật cho "${title}"`, 'success');
      await renderSetlistItems();
      if (ctx.getCurrentIndex?.() === idx) ctx.playCurrentItem?.();
    } catch (err) {
      window.App?.showToast?.('Lỗi cập nhật', 'error');
    }
  }

  async function _handleEditBpm(item, title, idx) {
    const ctx = getContext();
    if (!window.TempoPick) return;
    const currentBpm = parseInt(item.bpm, 10) || 100;
    const newBpm = await window.TempoPick.show(currentBpm);
    if (newBpm && newBpm !== currentBpm) {
      try {
        await window.ApiService.setlists.updateItem(item.id, { bpm: newBpm });
        item.bpm = newBpm;
        window.App?.showToast?.(`✅ Đã đổi BPM thành ${newBpm} cho "${title}"`, 'success');
        await renderSetlistItems();
        if (ctx.getCurrentIndex?.() === idx && window.Metronome) {
          window.Metronome.setBpm(newBpm);
        }
      } catch (err) {
        window.App?.showToast?.('Lỗi cập nhật BPM', 'error');
      }
    }
  }

  async function _handleSaveItemBpm(item, songObj, btn) {
    const currentBpm = window.Metronome?.getBpm?.() ?? null;
    const currentBeats = window.Metronome?.getBeatsPerMeasure?.() ?? 4;
    const currentTranspose = window.Store?.get?.('currentTranspose') ?? 0;
    btn.textContent = '...';
    btn.disabled = true;

    try {
      const curProfile = window.ChordCanvas?.getCurrentSet?.() || item.chord_profile || 'HD';
      const updatePayload = { bpm: currentBpm, beats_per_measure: currentBeats, transpose_key: currentTranspose, chord_profile: curProfile };
      await window.ApiService.setlists.updateItem(item.id, updatePayload);
      item.bpm = currentBpm;
      item.beats_per_measure = currentBeats;
      item.transpose_key = currentTranspose;
      item.chord_profile = curProfile;

      if (window.PerformanceNotes) {
        const itemOrigKey = songObj?.defaultKey || '';
        const practicedKey = _calcTransposedKey(itemOrigKey, currentTranspose) || itemOrigKey;
        const existingNotes = window.PerformanceNotes.getNotes(item.song_id);
        const newNotes = { ...existingNotes, key: practicedKey, bpm: currentBpm ? String(currentBpm) : (existingNotes.bpm || ''), updatedAt: new Date().toISOString() };
        window.ApiService?.sessions?.savePerfNotes?.(item.song_id, newNotes).catch(() => {});
      }

      const itemOrigKey = songObj?.defaultKey || '';
      const practicedKey = _calcTransposedKey(itemOrigKey, currentTranspose) || itemOrigKey;
      const toneMsg = itemOrigKey ? `Tone: ${itemOrigKey} | Tập: ${practicedKey}` : `Tông: ${currentTranspose > 0 ? '+' : ''}${currentTranspose}`;
      window.App?.showToast?.(`✅ Đã lưu ${toneMsg}${currentBpm ? ` & ♩${currentBpm} BPM` : ''} vào Setlist!`, 'success');
      await renderSetlistItems();
    } catch(err) {
      window.App?.showToast?.('Lỗi lưu thông tin tập', 'error');
      btn.textContent = '💾 Lưu Tập';
      btn.disabled = false;
    }
  }

  async function renderSetlistItems() {
    const ctx = getContext();
    const currentSetlist = ctx.getCurrentSetlist?.();
    const currentIndex = ctx.getCurrentIndex?.() ?? -1;
    const itemsEl = document.getElementById('setlist-items');
    if (!itemsEl || !currentSetlist) return;
    itemsEl.innerHTML = '';

    if (!currentSetlist.items || currentSetlist.items.length === 0) {
      itemsEl.innerHTML = '<p class="text-sm text-muted text-center py-2">Chưa có bài hát nào</p>';
      return;
    }

    if (ctx.ensureSongsLoaded) await ctx.ensureSongsLoaded();
    const allSongs = ctx.getAllSongsCache?.() || [];

    currentSetlist.items.forEach((item, idx) => {
      const songObj = allSongs.find(s => String(s.id) === String(item.song_id)) || window.LibraryUI?.getSongObj?.(item.song_id);
      const title = songObj ? songObj.title : 'Bài hát không tồn tại';
      const el = document.createElement('div');
      el.className = 'song-item' + (currentIndex === idx ? ' active' : '');

      const numStr = String(idx + 1).padStart(2, '0');
      const origKey = songObj?.defaultKey || songObj?.keySignature || '';
      const toneBadge = _formatToneBadge(origKey, item.transpose_key, true);
      const chordBadge = item.chord_profile && item.chord_profile !== 'default' ? `<span class="tag">🎸 ${_esc(item.chord_profile)}</span>` : '';
      const bpmBadge = item.bpm
        ? `<span class="tag tag-blue btn-edit-bpm" style="cursor:pointer;" title="Click để đổi BPM">♩${_esc(String(item.bpm))} BPM ✎</span>`
        : `<span class="tag btn-edit-bpm" style="cursor:pointer;opacity:0.8;" title="Click để đặt BPM">♩ BPM ✎</span>`;

      el.innerHTML = `
        <div class="song-item-info" style="flex:1;min-width:0;">
          <div class="song-item-title">${numStr} - ${_esc(title)}</div>
          <div class="song-item-meta text-xs" style="display:flex;gap:4px;margin-top:4px;flex-wrap:wrap;">
            ${toneBadge} ${chordBadge} ${bpmBadge}
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:4px;flex-shrink:0;">
          <button class="icon-btn-xs btn-save-bpm" title="Lưu Tone & BPM đang tập vào bài này" style="color:var(--accent);font-size:.7rem;padding:.25rem .5rem;font-weight:700;touch-action:manipulation;">💾 Lưu Tập</button>
          <button class="icon-btn-xs text-danger btn-del-item" title="Xóa khỏi list">✕</button>
        </div>
      `;

      el.addEventListener('click', async (e) => {
        if (e.target.closest('.btn-del-item, .btn-save-bpm, .btn-edit-tone, .btn-edit-bpm')) return;
        ctx.setCurrentIndex?.(idx);
        await renderSetlistItems();
        ctx.playCurrentItem?.();
      });

      el.querySelector('.btn-edit-tone')?.addEventListener('click', (e) => {
        e.stopPropagation();
        _handleEditTone(item, songObj, title, idx);
      });

      el.querySelector('.btn-edit-bpm')?.addEventListener('click', (e) => {
        e.stopPropagation();
        _handleEditBpm(item, title, idx);
      });

      const saveBtn = el.querySelector('.btn-save-bpm');
      saveBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        _handleSaveItemBpm(item, songObj, saveBtn);
      });

      el.querySelector('.btn-del-item')?.addEventListener('click', async (e) => {
        e.stopPropagation();
        await window.ApiService.setlists.removeItem(item.id);
        viewSetlistDetail(currentSetlist.id);
      });

      itemsEl.appendChild(el);
    });
  }

  function promptAddSong(songId) {
    const ctx = getContext();
    const setlists = ctx.getSetlists?.() || [];
    if (!setlists.length) {
      window.App?.showToast?.('Chưa có Setlist nào. Hãy tạo Setlist trước!', 'error');
      return;
    }
    const modal = document.getElementById('add-to-setlist-modal');
    const pickView = document.getElementById('add-setlist-pick-view');
    const modalCreate = document.getElementById('create-setlist-modal');
    const modalTitle = document.getElementById('setlist-modal-title');
    const optionsContainer = document.getElementById('add-to-setlist-options');
    if (!modal || !optionsContainer) return;

    if (modalTitle) modalTitle.textContent = 'Thêm vào Setlist';
    pickView?.classList.remove('hidden');
    modalCreate?.classList.add('hidden');
    optionsContainer.innerHTML = '';

    setlists.forEach(sl => {
      const btn = document.createElement('button');
      btn.className = 'btn btn-ghost w-full text-left song-item';
      btn.style.justifyContent = 'flex-start';
      btn.textContent = sl.title;
      btn.addEventListener('click', async () => {
        await addSongToSetlist(sl.id, songId);
        if (window.ModalManager) window.ModalManager.close(modal);
        else modal.classList.add('hidden');
      });
      optionsContainer.appendChild(btn);
    });

    if (window.ModalManager) window.ModalManager.open(modal);
    else modal.classList.remove('hidden');
  }

  async function addSongToSetlist(setId, songId) {
    const ctx = getContext();
    if (ctx.ensureSongsLoaded) await ctx.ensureSongsLoaded();
    const currentSetlist = ctx.getCurrentSetlist?.();
    const songIndex = currentSetlist?.items ? currentSetlist.items.length : 0;
    const allSongs = ctx.getAllSongsCache?.() || [];
    const songObj = allSongs.find(s => String(s.id) === String(songId)) || window.LibraryUI?.getSongObj?.(songId);
    const songName = songObj?.title || 'Bài hát';

    // Cảnh báo lặp bài hát (Quyết định D15: Cảnh báo vàng nhẹ, không chặn)
    try {
      if (window.ApiService?.setlists?.checkRecentUsage) {
        const usageCheck = await window.ApiService.setlists.checkRecentUsage(songId, 4);
        const checkData = usageCheck?.data || usageCheck;
        if (checkData && checkData.is_recent) {
          const warningText = `⚠️ Lưu ý lịch sử sử dụng bài hát:\nBài "${songName}" đã được dùng cách đây ${checkData.weeks_ago} tuần (${checkData.last_used_date} — "${checkData.service_title}").\n\n(Hệ thống không chặn — bạn vẫn có thể thêm bài theo nhu cầu phụng vụ).\nBạn có muốn tiếp tục thêm vào chương trình?`;
          if (!confirm(warningText)) {
            return;
          }
        }
      }
    } catch (e) {
      // Non-blocking warning check
    }

    const origKey = songObj?.defaultKey || songObj?.keySignature || '';
    const currentTranspose = window.Store?.get?.('currentTranspose') ?? 0;
    const defaultBpm = window.Metronome?.getBpm?.() || songObj?.bpm || 80;

    let transpose_key = 0;
    let songBpm = defaultBpm;
    if (window.TransposePick) {
      const pickRes = await window.TransposePick.show(songName, currentTranspose, origKey, defaultBpm);
      if (pickRes === null) return;
      transpose_key = typeof pickRes === 'object' ? (pickRes.transpose_key ?? 0) : (parseInt(pickRes, 10) || 0);
      songBpm = typeof pickRes === 'object' ? (pickRes.bpm || defaultBpm) : defaultBpm;
    } else {
      const toneStr = prompt('Nhập số cung dịch giọng (vd: -2, 0, +1):', String(currentTranspose));
      if (toneStr === null) return;
      transpose_key = parseInt(toneStr, 10) || 0;
    }

    try {
      const curSet = window.ChordCanvas?.getCurrentSet?.() || 'HD';
      const data = await window.ApiService.setlists.addItem({
        setlist_id: setId, song_id: songId, order_index: songIndex,
        transpose_key: transpose_key, chord_profile: curSet, bpm: songBpm
      });
      if (data.success) {
        window.App?.showToast?.('Đã thêm bài hát vào Setlist!', 'success');
        await viewSetlistDetail(setId);
        ctx.fetchSetlists?.();
        const updated = ctx.getCurrentSetlist?.();
        if (updated?.items?.length) {
          ctx.setCurrentIndex?.(updated.items.length - 1);
          await renderSetlistItems();
          await ctx.playCurrentItem?.();
        }
      } else {
        window.App?.showToast?.(data.error || 'Lỗi thêm bài hát', 'error');
      }
    } catch(err) {
      console.error('[SetlistDetail] addSongToSetlist error:', err);
    }
  }

  function bindDetailEvents() {
    const ctx = getContext();
    document.getElementById('btn-back-setlists')?.addEventListener('click', () => ctx.backToSetlists?.());
    document.getElementById('btn-close-add-setlist')?.addEventListener('click', () => {
      const addModal = document.getElementById('add-to-setlist-modal');
      if (window.ModalManager) window.ModalManager.close(addModal);
      else addModal?.classList.add('hidden');
    });

    const addInput = document.getElementById('setlist-search-song-input');
    const addResults = document.getElementById('setlist-search-results');
    if (!addInput || !addResults) return;

    const normalize = (str) => String(str).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();

    const renderSearchResults = (val) => {
      const allSongs = ctx.getAllSongsCache?.() || [];
      const num = parseInt(val, 10);
      const matches = (!val)
        ? allSongs.slice(0, 20)
        : allSongs.filter(s => (!isNaN(num) && s.httlvnId === num) || normalize(s.title || '').includes(val) || normalize(s.id || '').includes(val) || String(s.httlvnId || '') === val).slice(0, 20);

      if (!matches.length) {
        addResults.innerHTML = '<div class="p-2 text-muted text-xs text-center">Không tìm thấy</div>';
      } else {
        addResults.innerHTML = matches.map(m => {
          const mId = _esc(m.id || '');
          const mHtt = m.httlvnId ? _esc(String(m.httlvnId)) + ' - ' : '';
          return `<div class="song-item" style="cursor:pointer;padding:0.65rem 0.75rem;border-bottom:1px solid var(--border);" data-id="${mId}"><div style="font-size:0.85rem;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;width:100%;">${mHtt}${_esc(m.title || 'Bài hát')}</div></div>`;
        }).join('');

        addResults.querySelectorAll('.song-item').forEach(el => {
          el.addEventListener('click', async () => {
            addInput.value = '';
            addResults.classList.add('hidden');
            const curSl = ctx.getCurrentSetlist?.();
            if (curSl) await addSongToSetlist(curSl.id, el.dataset.id);
          });
        });
      }
      addResults.classList.remove('hidden');
    };

    addInput.addEventListener('input', (e) => renderSearchResults(normalize(e.target.value).trim()));
    addInput.addEventListener('focus', (e) => renderSearchResults(normalize(e.target.value).trim()));
    document.addEventListener('click', (e) => {
      if (!addInput.contains(e.target) && !addResults.contains(e.target)) addResults.classList.add('hidden');
    });
  }

  return {
    setContext,
    viewSetlistDetail,
    renderSetlistItems,
    promptAddSong,
    addSongToSetlist,
    formatToneBadge: _formatToneBadge,
    bindDetailEvents
  };
})();

window.SetlistDetail = SetlistDetail;
