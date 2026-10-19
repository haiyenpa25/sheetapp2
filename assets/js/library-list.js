/** Shared keyboard grid for virtual song rows with independently usable action buttons. */
const LibraryList = (() => {
  'use strict';
  const bound = new WeakMap();
  const rowId = id => 'library-row-' + encodeURIComponent(String(id));

  function decorateRow(row, state) {
    const index = state.indices.get(row.dataset.id);
    if (index == null) return;
    row.id = rowId(row.dataset.id);
    row.setAttribute('role', 'row');
    row.setAttribute('aria-rowindex', index + 1);
    row.setAttribute('aria-selected', String(row.dataset.id === String(state.options.getActive())));
    const isCursor = row.dataset.id === state.cursor;
    if (row.classList.contains('library-cursor') !== isCursor) row.classList.toggle('library-cursor', isCursor);
    [...row.children].forEach((cell, column) => {
      cell.setAttribute('role', 'gridcell');
      cell.setAttribute('aria-colindex', column + 1);
    });
    row.querySelectorAll('button').forEach(button => {
      button.tabIndex = row.dataset.id === state.cursor ? 0 : -1;
      if (button.title) button.setAttribute('aria-label', button.title);
    });
  }

  function sync(state) {
    const { element, getItems } = state.options;
    const items = getItems();
    if (items !== state.items) {
      state.items = items;
      state.indices = new Map(items.map((song, index) => [String(song.id), index]));
      if (!state.indices.has(state.cursor)) state.cursor = null;
    }
    element.setAttribute('role', 'grid');
    element.setAttribute('aria-label', 'Danh sách bài hát');
    element.setAttribute('aria-rowcount', items.length);
    element.tabIndex = items.length ? 0 : -1;
    element.querySelectorAll('.song-item').forEach(row => decorateRow(row, state));
    element.querySelectorAll('.virtual-spacer, .search-group-header').forEach(row => row.setAttribute('role', 'presentation'));
    const current = state.cursor && document.getElementById(rowId(state.cursor));
    if (current && element.contains(current)) element.setAttribute('aria-activedescendant', current.id);
    else element.removeAttribute('aria-activedescendant');
    // A queued virtual-scroll render can replace the button just reached by Tab.
    const action = state.focusedAction;
    if (action && !action.node.isConnected && document.activeElement === document.body) {
      element.querySelector(`.song-item[data-id="${CSS.escape(action.id)}"]`)
        ?.querySelectorAll('button')[action.index]?.focus({ preventScroll: true });
    }
  }

  function reveal(state, index) {
    const { element, renderWindow } = state.options;
    const id = String(state.items[index].id);
    let row = element.querySelector(`.song-item[data-id="${CSS.escape(id)}"]`);
    const scroll = element.closest('.song-list-container');
    if (!row && scroll) {
      const sample = element.querySelector('.song-item');
      const pitch = (sample?.getBoundingClientRect().height || 44) + (parseFloat(window.getComputedStyle(element).rowGap) || 0);
      const top = element.getBoundingClientRect().top - scroll.getBoundingClientRect().top + scroll.scrollTop;
      scroll.scrollTop = Math.max(0, top + index * pitch - scroll.clientHeight / 2);
      renderWindow();
      row = element.querySelector(`.song-item[data-id="${CSS.escape(id)}"]`);
    }
    state.cursor = id;
    sync(state);
    row?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  }

  function onKey(event, state) {
    if (event.isComposing || event.ctrlKey || event.altKey || event.metaKey) return;
    const keys = ['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', ' '];
    if (!keys.includes(event.key)) return;
    event.stopPropagation(); // A list arrow must never reach the page-turn/pedal shortcuts.
    if (event.target.closest('button')) return;
    sync(state);
    if (!state.items.length) return;
    event.preventDefault();
    const current = state.indices.get(state.cursor) ?? -1;
    if (event.key === 'Enter' || event.key === ' ') {
      const index = Math.max(0, current);
      reveal(state, index);
      state.options.select(state.items[index].id);
      sync(state);
      return;
    }
    const last = state.items.length - 1;
    const index = event.key === 'Home' ? 0 : event.key === 'End' ? last
      : event.key === 'ArrowDown' ? Math.min(last, current + 1) : Math.max(0, current - 1);
    reveal(state, index);
  }

  function bind(options) {
    if (!options.element || bound.has(options.element)) return;
    const state = { options, items: null, indices: new Map(), cursor: null };
    const { element } = options;
    document.addEventListener('focusin', event => {
      const button = event.target.closest('button');
      const row = button?.closest('.song-item');
      state.focusedAction = row && element.contains(row)
        ? { node: button, id: row.dataset.id, index: [...row.querySelectorAll('button')].indexOf(button) } : null;
    });
    document.addEventListener('pointerdown', event => {
      if (!element.contains(event.target)) state.focusedAction = null;
    }, { passive: true });
    element.addEventListener('keydown', event => onKey(event, state));
    element.addEventListener('click', event => {
      const row = event.target.closest('.song-item');
      if (row) { state.cursor = row.dataset.id; sync(state); }
    });
    new MutationObserver(() => sync(state)).observe(element, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'title'] });
    bound.set(element, state);
    sync(state);
  }
  function restoreCursor(element) {
    const state = bound.get(element);
    if (!state) return false;
    sync(state);
    const index = state.indices.get(state.cursor);
    if (index == null) return false;
    reveal(state, index);
    return true;
  }
  return { bind, restoreCursor };
})();
window.LibraryList = LibraryList;
