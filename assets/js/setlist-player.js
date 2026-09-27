/**
 * setlist-player.js
 * Quản lý phát nhạc theo Setlist:
 * - Chơi nhạc theo thứ tự (Next, Prev, JumpTo)
 * - Tôn trọng tuyệt đối Core Rule 4: Áp dụng Tông tập, Tempo tập và Profile hợp âm của item
 * - Đồng bộ Metronome BPM & URLState
 * - Ticket L3-1: Thanh chương trình 40px cạnh dưới ("2/5 · Tiếp: Ca Cảm Tạ (F→G)" + ◀ ▶ lớn),
 *   ở chế độ Sân khấu thu thành dòng nhỏ trong HUD.
 */
const SetlistPlayer = (() => {
  'use strict';

  let _context = null;

  function setContext(ctx) {
    _context = ctx;
  }

  function getContext() {
    return _context || window.SetlistUI || {};
  }

  function updateProgramBar() {
    const ctx = getContext();
    const currentSetlist = ctx.getCurrentSetlist?.();
    const currentIndex = ctx.getCurrentIndex?.() ?? -1;
    const bar = document.getElementById('setlist-program-bar');
    const gigRow = document.getElementById('gig-hud-setlist-row');

    if (!currentSetlist || !currentSetlist.items || currentSetlist.items.length === 0 || currentIndex < 0) {
      if (bar) bar.classList.add('hidden');
      if (gigRow) gigRow.classList.add('hidden');
      return;
    }

    const total = currentSetlist.items.length;
    const posText = `${currentIndex + 1}/${total}`;

    // Xác định bài tiếp theo
    let nextText = '';
    let nextKeyText = '';
    const hasNext = currentIndex < total - 1;

    if (hasNext) {
      const nextItem = currentSetlist.items[currentIndex + 1];
      const allSongs = ctx.getAllSongsCache?.() || window.LibraryUI?.getSongs?.() || [];
      const nextSongObj = allSongs.find(s => String(s.id) === String(nextItem.song_id))
                       || window.LibraryUI?.getSongObj?.(nextItem.song_id);
      const nextTitle = nextSongObj?.title || nextItem.title || `Bài #${nextItem.song_id}`;
      const origKey = nextSongObj?.defaultKey || nextSongObj?.keySignature || nextItem.key || '';
      const semi = parseInt(nextItem.transpose_key || 0, 10);

      let keyDisplay = '';
      if (origKey) {
        if (semi !== 0 && window.KeyService?.displayKey) {
          const targetKey = window.KeyService.displayKey(origKey, semi) || origKey;
          keyDisplay = `(${origKey}→${targetKey})`;
        } else {
          keyDisplay = `(${origKey})`;
        }
      }
      nextText = nextTitle;
      nextKeyText = keyDisplay;
    } else {
      nextText = 'Kết thúc chương trình';
      nextKeyText = '';
    }

    // Cập nhật DOM thanh đáy (Bottom Program Bar 40px)
    if (bar) {
      bar.classList.remove('hidden');
      const posEl = document.getElementById('sp-bar-pos');
      if (posEl) posEl.textContent = posText;
      const setNameEl = document.getElementById('sp-bar-set-name');
      if (setNameEl) setNameEl.textContent = currentSetlist.name || '';
      const nextTitleEl = document.getElementById('sp-bar-next-title');
      if (nextTitleEl) nextTitleEl.textContent = nextText;
      const nextKeyEl = document.getElementById('sp-bar-next-key');
      if (nextKeyEl) nextKeyEl.textContent = nextKeyText;

      const prevBtn = document.getElementById('btn-sp-prev');
      if (prevBtn) prevBtn.disabled = (currentIndex === 0);
      const nextBtn = document.getElementById('btn-sp-next');
      if (nextBtn) nextBtn.disabled = !hasNext;
    }

    // Cập nhật DOM HUD Sân khấu (Gig Mode HUD Setlist Row)
    if (gigRow) {
      gigRow.classList.remove('hidden');
      const gigPos = document.getElementById('gig-sp-pos');
      if (gigPos) gigPos.textContent = posText;
      const gigNext = document.getElementById('gig-sp-next');
      if (gigNext) gigNext.textContent = hasNext ? `Tiếp: ${nextText} ${nextKeyText}` : 'Kết thúc';

      const gigPrevBtn = document.getElementById('btn-gig-sp-prev');
      if (gigPrevBtn) gigPrevBtn.disabled = (currentIndex === 0);
      const gigNextBtn = document.getElementById('btn-gig-sp-next');
      if (gigNextBtn) gigNextBtn.disabled = !hasNext;
    }

    // Tự động tải trước bài kế tiếp khi thanh chương trình được cập nhật (Ticket L3-2)
    if (hasNext && window.SongPreloader?.preloadNextInSetlist) {
      window.SongPreloader.preloadNextInSetlist(currentSetlist, currentIndex);
    }
  }

  async function playCurrentItem() {
    const ctx = getContext();
    const currentSetlist = ctx.getCurrentSetlist?.();
    let currentIndex = ctx.getCurrentIndex?.();

    if (!currentSetlist || !currentSetlist.items || currentSetlist.items.length === 0) {
      window.App?.showToast?.('Setlist trống', 'error');
      updateProgramBar();
      return;
    }
    if (currentIndex >= currentSetlist.items.length) {
      window.App?.showToast?.('Đã kết thúc Setlist!', 'success');
      ctx.setCurrentIndex?.(-1);
      ctx.renderSetlistItems?.();
      document.querySelector('.toolbar-left')?.classList.remove('in-setlist');
      window.VerseManager?.clearSelectedVerses?.();
      window.LeaderNotesBanner?.hide?.();
      updateProgramBar();
      return;
    }

    const item = currentSetlist.items[currentIndex];
    const songId = item.song_id;

    if (ctx.ensureSongsLoaded) {
      await ctx.ensureSongsLoaded();
    }

    const allSongs = ctx.getAllSongsCache?.() || [];
    const songObj = allSongs.find(s => String(s.id) === String(songId)) 
                 || window.LibraryUI?.getSongObj?.(songId)
                 || window.OfflineSetlistManager?.getOfflineSong?.(songId);

    if (!songObj) {
      window.App?.showToast?.(`Lỗi: Không tìm thấy bài hát ID ${songId}`, 'error');
      updateProgramBar();
      return;
    }

    // Cập nhật URL trước khi load bài hát để đồng bộ state và tránh bị _restoreFromURL ghi đè
    if (window.URLState) {
      window.URLState.resetForNewSong(songId);
      window.URLState.update({ set: item.chord_profile || 'HD', t: item.transpose_key || 0 });
    }

    // Ticket L3-3: Áp dụng khổ sẽ hát (selected_verses) và ghi chú ca trưởng (leader_notes)
    const selectedVerses = item.selected_verses || item.stanzas || null;
    if (selectedVerses && window.VerseManager?.setSelectedVerses) {
      window.VerseManager.setSelectedVerses(selectedVerses);
    } else if (window.VerseManager?.clearSelectedVerses) {
      window.VerseManager.clearSelectedVerses();
    }

    if (item.leader_notes && window.LeaderNotesBanner?.show) {
      window.LeaderNotesBanner.show(item.leader_notes);
    } else if (window.LeaderNotesBanner?.hide) {
      window.LeaderNotesBanner.hide();
    }

    // Ticket L3-2: Chuyển bài tức thì không trắng màn hình nếu đã có trong Preloader
    const hasPreloaded = window.SongPreloader?.has?.(songId, item.chord_profile || 'HD');

    // Đưa cả profile lẫn transpose_key qua bên App và chờ load hoàn tất (Core Rule 4, Fix F1)
    await window.App?.loadSongWithProfile?.(songObj, item.chord_profile, item.transpose_key, { instant: hasPreloaded });
    document.querySelector('.toolbar-left')?.classList.add('in-setlist');

    // Cập nhật Thanh chương trình (Ticket L3-1)
    updateProgramBar();

    // Tự động tải trước bài kế tiếp trong setlist (Ticket L3-2)
    window.SongPreloader?.preloadNextInSetlist?.(currentSetlist, currentIndex);

    // Apply BPM đã lưu cho bài này (nếu có)
    if (item.bpm && window.Metronome) {
      window.Metronome.setBpmAndBeats(parseInt(item.bpm, 10), parseInt(item.beats_per_measure, 10) || 4);
      window.App?.showToast?.(`♩ ${item.bpm} BPM`, 'info', 1800);
    }
  }

  function next() {
    const ctx = getContext();
    const currentSetlist = ctx.getCurrentSetlist?.();
    const currentIndex = ctx.getCurrentIndex?.() ?? -1;

    if (currentSetlist && currentIndex >= 0 && currentIndex < currentSetlist.items.length - 1) {
      const nextIdx = currentIndex + 1;
      ctx.setCurrentIndex?.(nextIdx);
      if (ctx.renderSetlistItems) {
        ctx.renderSetlistItems().then(() => playCurrentItem());
      } else {
        playCurrentItem();
      }
    }
  }

  function prev() {
    const ctx = getContext();
    const currentSetlist = ctx.getCurrentSetlist?.();
    const currentIndex = ctx.getCurrentIndex?.() ?? -1;

    if (currentSetlist && currentIndex > 0) {
      const prevIdx = currentIndex - 1;
      ctx.setCurrentIndex?.(prevIdx);
      if (ctx.renderSetlistItems) {
        ctx.renderSetlistItems().then(() => playCurrentItem());
      } else {
        playCurrentItem();
      }
    }
  }

  function jumpTo(idx) {
    const ctx = getContext();
    const currentSetlist = ctx.getCurrentSetlist?.();
    if (!currentSetlist || !currentSetlist.items || idx < 0 || idx >= currentSetlist.items.length) {
      return;
    }
    ctx.setCurrentIndex?.(idx);
    if (ctx.renderSetlistItems) {
      ctx.renderSetlistItems().then(() => playCurrentItem());
    } else {
      playCurrentItem();
    }
  }

  function bindPlayerEvents() {
    document.getElementById('btn-play-setlist')?.addEventListener('click', async () => {
      const ctx = getContext();
      const currentSetlist = ctx.getCurrentSetlist?.();
      if (currentSetlist && currentSetlist.items && currentSetlist.items.length > 0) {
        ctx.setCurrentIndex?.(0);
        if (ctx.renderSetlistItems) {
          await ctx.renderSetlistItems();
        }
        playCurrentItem();
      }
    });

    // Cặp nút chuyển bài trên Toolbar
    document.getElementById('btn-next-song')?.addEventListener('click', (e) => {
      const ctx = getContext();
      if (ctx.getCurrentSetlist?.()) {
        e.preventDefault();
        e.stopPropagation();
        next();
      }
    }, true);

    document.getElementById('btn-prev-song')?.addEventListener('click', (e) => {
      const ctx = getContext();
      if (ctx.getCurrentSetlist?.()) {
        e.preventDefault();
        e.stopPropagation();
        prev();
      }
    }, true);

    // Cặp nút chuyển bài trên Thanh chương trình cạnh dưới (Ticket L3-1)
    document.getElementById('btn-sp-next')?.addEventListener('click', (e) => {
      e.preventDefault();
      next();
    });

    document.getElementById('btn-sp-prev')?.addEventListener('click', (e) => {
      e.preventDefault();
      prev();
    });

    // Cặp nút chuyển bài trong HUD Sân khấu (Ticket L3-1)
    document.getElementById('btn-gig-sp-next')?.addEventListener('click', (e) => {
      e.preventDefault();
      next();
    });

    document.getElementById('btn-gig-sp-prev')?.addEventListener('click', (e) => {
      e.preventDefault();
      prev();
    });
  }

  return {
    setContext,
    playCurrentItem,
    next,
    prev,
    jumpTo,
    updateProgramBar,
    bindPlayerEvents
  };
})();

window.SetlistPlayer = SetlistPlayer;
