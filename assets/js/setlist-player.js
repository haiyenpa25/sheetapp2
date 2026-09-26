/**
 * setlist-player.js
 * Quản lý phát nhạc theo Setlist:
 * - Chơi nhạc theo thứ tự (Next, Prev, JumpTo)
 * - Tôn trọng tuyệt đối Core Rule 4: Áp dụng Tông tập, Tempo tập và Profile hợp âm của item
 * - Đồng bộ Metronome BPM & URLState
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

  async function playCurrentItem() {
    const ctx = getContext();
    const currentSetlist = ctx.getCurrentSetlist?.();
    let currentIndex = ctx.getCurrentIndex?.();

    if (!currentSetlist || !currentSetlist.items || currentSetlist.items.length === 0) {
      window.App?.showToast?.('Setlist trống', 'error');
      return;
    }
    if (currentIndex >= currentSetlist.items.length) {
      window.App?.showToast?.('Đã kết thúc Setlist!', 'success');
      ctx.setCurrentIndex?.(-1);
      ctx.renderSetlistItems?.();
      document.querySelector('.toolbar-left')?.classList.remove('in-setlist');
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
      return;
    }

    // Cập nhật URL trước khi load bài hát để đồng bộ state và tránh bị _restoreFromURL ghi đè
    if (window.URLState) {
      window.URLState.resetForNewSong(songId);
      window.URLState.update({ set: item.chord_profile || 'HD', t: item.transpose_key || 0 });
    }

    // Đưa cả profile lẫn transpose_key qua bên App và chờ load hoàn tất (Core Rule 4, Fix F1)
    await window.App?.loadSongWithProfile?.(songObj, item.chord_profile, item.transpose_key);
    document.querySelector('.toolbar-left')?.classList.add('in-setlist');

    // Apply BPM đã lưu cho bài này (nếu có)
    if (item.bpm && window.Metronome) {
      window.Metronome.setBpmAndBeats(parseInt(item.bpm), parseInt(item.beats_per_measure) || 4);
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
  }

  return {
    setContext,
    playCurrentItem,
    next,
    prev,
    jumpTo,
    bindPlayerEvents
  };
})();

window.SetlistPlayer = SetlistPlayer;
