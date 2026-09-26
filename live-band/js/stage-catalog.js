/**
 * live-band/js/stage-catalog.js — Live Band Song Catalog, Sections & URL Router
 * Quản lý danh mục 903 bài hát, cây phân đoạn bài hát (Roadmap sections), và nạp thông số tự động từ URL.
 */
(() => {
  'use strict';

  let _sections = [];

  async function loadSongCatalog(onCatalogLoaded) {
    try {
      const res = await window.ApiService?.songs?.list?.();
      const songsList = Array.isArray(res?.data) ? res.data : [];
      const dropdown = document.getElementById('host-song-dropdown');
      if (dropdown && songsList.length > 0) {
        dropdown.innerHTML = '<option value="">-- Chọn bản nhạc biểu diễn --</option>' +
          songsList.map(s => `<option value="${s.id}">${s.title} (${s.id})</option>`).join('');
      }
      if (typeof onCatalogLoaded === 'function') {
        onCatalogLoaded(songsList);
      }
      return songsList;
    } catch (e) {
      console.warn('[StageCatalog] Load catalog error:', e);
      return [];
    }
  }

  async function loadSections(songId, onSelectMeasure) {
    const chipsContainer = document.getElementById('host-roadmap-chips');
    if (!chipsContainer) return [];
    try {
      const res = await window.ApiService?.arrangements?.getSections?.(songId);
      _sections = Array.isArray(res?.data) ? res.data : [];
      if (_sections.length === 0) {
        chipsContainer.innerHTML = '<span class="roadmap-empty-hint">Chưa có phân đoạn bài hát</span>';
        return [];
      }
      chipsContainer.innerHTML = _sections.map(sec => `
        <button class="roadmap-chip" data-start="${Number.parseInt(sec.start_measure, 10) || 1}" data-id="${Number.parseInt(sec.id, 10) || 0}">
          ${window.SafeHtml.escape(sec.name)} (${Number.parseInt(sec.start_measure, 10) || 1}-${Number.parseInt(sec.end_measure, 10) || 1})
        </button>
      `).join('');

      chipsContainer.querySelectorAll('.roadmap-chip').forEach(chip => {
        chip.addEventListener('click', (e) => {
          const startM = parseInt(e.currentTarget.getAttribute('data-start'), 10);
          if (startM > 0 && typeof onSelectMeasure === 'function') {
            onSelectMeasure(startM);
          }
        });
      });
      return _sections;
    } catch (e) {
      chipsContainer.innerHTML = '<span class="roadmap-empty-hint">Chưa có phân đoạn bài hát</span>';
      return [];
    }
  }

  function highlightActiveSectionByMeasure(measure) {
    document.querySelectorAll('.roadmap-chip').forEach(chip => {
      const start = parseInt(chip.getAttribute('data-start'), 10) || 1;
      chip.classList.toggle('active', measure >= start && measure < start + 16);
    });
  }

  async function checkUrlAutoParams(callbacks) {
    const { onSetRole, onLoadSong, onJoinRoom } = callbacks;
    const params = new URLSearchParams(window.location.search);
    const role = params.get('role');
    if (role && ['leader', 'guitar', 'piano', 'vocal', 'drummer', 'viewer'].includes(role)) {
      if (typeof onSetRole === 'function') onSetRole(role);
    }

    const songId = params.get('song');
    const chordSet = params.get('set') || 'HD';
    const trans = parseInt(params.get('trans') || '0', 10);
    if (songId && typeof onLoadSong === 'function') {
      await onLoadSong(songId, isNaN(trans) ? 0 : trans, chordSet);
    }

    const code = params.get('room') || params.get('live');
    if (code && typeof onJoinRoom === 'function') {
      setTimeout(() => onJoinRoom(code.toUpperCase()), 200);
    }
  }

  window.StageCatalog = {
    loadSongCatalog,
    loadSections,
    highlightActiveSectionByMeasure,
    checkUrlAutoParams,
    getSections: () => _sections
  };
})();
