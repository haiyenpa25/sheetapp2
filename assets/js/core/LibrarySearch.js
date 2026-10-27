/* Shared bounded search and pagination for Classic and Modern libraries. */
window.LibrarySearch = (() => {
  'use strict';
  let generation = 0;

  function cancel() {
    generation++;
    document.getElementById('library-load-more')?.remove();
  }

  async function run(query, filters, render, count) {
    cancel();
    const token = generation;
    let rows = [], offset = 0, total = 0, button = null;
    const current = () => token === generation;
    async function load() {
      const response = await window.ApiService.songs.search(query, { ...filters, limit: 200, offset });
      if (!current()) return;
      if (!response?.success || !Array.isArray(response.data)) throw new Error('Search failed');
      const firstPage = offset === 0;
      const ids = new Set(rows.map(song => String(song.id)));
      rows = rows.concat(response.data.filter(song => !ids.has(String(song.id))));
      offset += response.data.length;
      total = Math.max(rows.length, Number(response.total) || 0);
      if (!response.data.length) total = rows.length;
      const scroll = document.getElementById('song-list')?.closest('.song-list-container');
      if (firstPage && scroll) scroll.scrollTop = 0;
      render(rows, { searchPage: true, isSearch: !!query, emptyMsg: query ? `Không tìm thấy "${query}"` : 'Không có bài hát phù hợp' });
      if (firstPage && scroll) scroll.scrollTop = 0;
      count(offset < total ? `${rows.length}/${total}` : rows.length);
      button?.remove();
      if (offset >= total) return;
      button = document.createElement('button');
      button.id = 'library-load-more';
      button.type = 'button';
      button.className = 'btn btn-secondary';
      button.style.cssText = 'width:100%;min-height:44px;margin:8px 0';
      const label = `Xem thêm (còn ${total - offset} bài)`;
      button.textContent = label;
      button.addEventListener('click', async () => {
        button.disabled = true;
        button.textContent = 'Đang tải…';
        try { await load(); }
        catch (_) {
          if (current()) { button.disabled = false; button.textContent = `Thử lại · ${label}`; }
        }
      });
      document.getElementById('song-list')?.after(button);
    }
    try { await load(); return true; }
    catch (_) { return !current(); }
  }
  function highlight(text, query) {
    const escape = value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    const reJesus = /(?:gi[eê][\s-]+xu|gi[eê]xu|j[eê][\s-]+sus|j[eê]sus)/gi;
    const normalized = String(query || '').replace(reJesus, ' JESUSALIAS ').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd');
    const map = { a: '[aáàảãạăắằẳẵặâấầẩẫậ]', e: '[eéèẻẽẹêếềểễệ]', i: '[iíìỉĩị]', o: '[oóòỏõọôốồổỗộơớờởỡợ]', u: '[uúùủũụưứừửữự]', y: '[yýỳỷỹỵ]', d: '[dđ]' };
    const parts = normalized.trim().split(/\s+/).filter(Boolean).map(word => word === 'JESUSALIAS' ? '(?:j[êe][\\s-]?sus|gi[êe][\\s-]?xu)' : [...word.toLowerCase()].map(c => map[c] || c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join(''));
    if (!parts.length) return escape(text);
    const pattern = new RegExp('(^|[^\\p{L}\\p{N}\\p{M}_])(' + [parts.join('[\\s-]+'), ...parts].join('|') + ')(?![\\p{L}\\p{N}\\p{M}_])', 'giu');
    const raw = String(text ?? '');
    let html = '', cursor = 0, match;
    while ((match = pattern.exec(raw)) !== null) {
      const start = match.index + match[1].length;
      const word = match[2];
      html += escape(raw.slice(cursor, start)) + '<mark>' + escape(word) + '</mark>';
      cursor = start + word.length;
    }
    return html + escape(raw.slice(cursor));
  }
  function catalog(songs) {
    const total = songs.length;
    document.querySelectorAll('[data-library-total]').forEach(element => { element.textContent = total; });
    document.querySelectorAll('[data-library-count-title]').forEach(element => {
      element.title = `Thư viện ${total} bài hát, đọc sheet nhạc, dịch tông & danh sách Setlist`;
    });
  }
  return { run, cancel, highlight, catalog };
})();
