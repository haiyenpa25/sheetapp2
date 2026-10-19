/** One owner for toolbar and keyboard song navigation; providers register through EventBus. */
const SongNavigation = (() => {
  'use strict';
  let initialized = false, library = null, program = null;
  let indexedCatalog = null, indexedLength = -1, numberCounts = new Map();
  const CATALOG_PREFIX = { 1: 'TC', 2: 'TV', 4: 'CKCT', 5: 'KT' };

  function navigate({ direction }) {
    if (direction !== 1 && direction !== -1) return;
    if (program?.isActive()) {
      direction > 0 ? program.next() : program.prev();
      return;
    }
    const items = library?.getItems() || [];
    if (!items.length) return;
    const current = items.findIndex(song => String(song.id) === String(library.getActiveId()));
    const index = current < 0 ? (direction > 0 ? 0 : items.length - 1) : current + direction;
    if (index >= 0 && index < items.length) library.select(items[index].id);
  }

  function request(direction) { window.EventBus?.emit('navigation:request', { direction }); }
  function leaveSetlist() { if (program?.isActive()) program.end(false); }

  function numberContext() {
    const all = library?.getCatalog() || [];
    const selected = library?.getCategory() || '';
    const active = all.find(song => String(song.id) === String(library?.getActiveId()));
    const categoryId = active?.category_id ?? all.find(song => Number(song.httlvnId) > 0)?.category_id;
    const songs = selected ? all.filter(song => song.category === selected) : all.filter(song => song.category_id === categoryId);
    return { songs, category: selected || songs[0]?.category || 'Thư viện', available: songs.some(song => Number(song.httlvnId) > 0) };
  }

  function findNumber(value) {
    const number = Number(value);
    if (!Number.isInteger(number) || number <= 0) return null;
    return numberContext().songs.find(song => Number(song.httlvnId) === number) || null;
  }

  function jumpNumber(value) {
    const context = numberContext(), song = findNumber(value);
    if (song) { library.select(song.id); return true; }
    window.App?.showToast?.(context.available ? `Không tìm thấy bài số ${value} trong ${context.category}` : `${context.category} chưa có số chính thức. Hãy tìm theo tên bài.`, 'info');
    return false;
  }

  function numberLabel(song, forcePrefix = false) {
    const number = Number(song.httlvnId);
    if (!Number.isInteger(number) || number <= 0) return '';
    const all = library?.getCatalog() || [];
    if (all !== indexedCatalog || all.length !== indexedLength) {
      indexedCatalog = all; indexedLength = all.length; numberCounts = new Map();
      all.forEach(item => { const n = Number(item.httlvnId); if (n > 0) numberCounts.set(n, (numberCounts.get(n) || 0) + 1); });
    }
    const prefixed = forcePrefix || (!library?.getCategory() && numberCounts.get(number) > 1);
    const prefix = CATALOG_PREFIX[song.category_id] || (song.category || 'Tập').split(/\s+/).map(word => word[0]).join('').slice(0, 5).toUpperCase();
    return (prefixed ? prefix + ' ' : '') + String(number).padStart(3, '0');
  }

  function syncNumberControls() {
    const context = numberContext();
    for (const id of ['btn-quick-numpad', 'btn-menu-quick-numpad']) {
      const button = document.getElementById(id);
      if (!button) continue;
      button.hidden = !context.available;
      button.classList.toggle('hidden', !context.available);
      button.title = context.available ? `Nhảy theo số trong ${context.category}` : `${context.category} chưa có số chính thức`;
    }
  }

  function init() {
    if (initialized || !window.EventBus) return;
    initialized = true;
    window.EventBus.on('navigation:library', provider => { library = provider; });
    window.EventBus.on('navigation:program', provider => { program = provider; });
    window.EventBus.on('navigation:request', navigate);
    for (const [id, direction] of [['btn-next-song', 1], ['btn-prev-song', -1]]) {
      document.getElementById(id)?.addEventListener('click', event => { event.preventDefault(); request(direction); });
    }
  }
  return { init, request, leaveSetlist, numberContext, findNumber, jumpNumber, numberLabel, syncNumberControls };
})();
window.SongNavigation = SongNavigation;
