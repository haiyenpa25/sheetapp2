/**
 * manager/js/manager-church-songs.js — Quản lý bài trong danh mục riêng của Hội Thánh (admin HT):
 * xem, sửa tên/tác giả/tempo, xóa, chuyển sang công khai chung. Quay lại riêng tư: nhờ admin hệ thống.
 * Phụ thuộc: ApiService, SafeHtml. Public API: { toggle }
 */
const ManagerChurchSongs = (() => {
  'use strict';

  const PUBLIC_WARNING = 'Chuyển bài này sang CÔNG KHAI? Mọi khách và mọi Hội Thánh đều thấy và dùng được.\n'
    + 'Chỉ công khai bài bạn có quyền chia sẻ (bản quyền). Muốn đưa về riêng tư phải liên hệ admin hệ thống.';

  const _esc = (s) => (window.SafeHtml ? window.SafeHtml.escape(s) : String(s ?? ''));
  let _toast = () => {};
  let _churchId = 0;

  function _row(song, publicCats) {
    const opts = publicCats.map((c) => `<option value="${Number(c.id)}">${_esc(c.name)}</option>`).join('');
    const meta = [song.composer, song.tempo ? `♩=${Number(song.tempo)}` : ''].filter(Boolean).join(' · ');
    return `<li class="mgr-church-song" data-song="${_esc(song.id)}">
      <span class="mgr-church-song-title">${_esc(song.title)}${meta ? ` <small>${_esc(meta)}</small>` : ''}</span>
      <span class="mgr-church-song-actions">
        <button type="button" class="mgr-btn mgr-btn-sm mgr-btn-ghost" data-act="song-edit">✏️ Sửa</button>
        <select class="mgr-input" data-role="pub-cat" aria-label="Danh mục công khai đích">${opts}</select>
        <button type="button" class="mgr-btn mgr-btn-sm mgr-btn-primary" data-act="song-publish">🌐 Công khai</button>
        <button type="button" class="mgr-btn mgr-btn-sm mgr-btn-ghost" data-act="song-delete">Xóa</button>
      </span></li>`;
  }

  function _editForm(li, song) {
    li.innerHTML = `<span class="mgr-church-song-actions" style="flex:1">
      <input class="mgr-input" data-f="title" value="${_esc(song.title)}" aria-label="Tên bài">
      <input class="mgr-input" data-f="composer" value="${_esc(song.composer || '')}" placeholder="Tác giả" aria-label="Tác giả">
      <input class="mgr-input" data-f="tempo" type="number" min="20" max="300" value="${song.tempo ? Number(song.tempo) : ''}" placeholder="Tempo" aria-label="Tempo" style="max-width:90px">
      <button type="button" class="mgr-btn mgr-btn-sm mgr-btn-primary" data-act="song-save">Lưu</button>
      <button type="button" class="mgr-btn mgr-btn-sm mgr-btn-ghost" data-act="song-cancel">Hủy</button></span>`;
  }

  async function _publicCategories() {
    const all = await window.ApiService.categories.list();
    return (Array.isArray(all) ? all : []).filter((c) => !c.church_id && (c.visibility || 'public') === 'public');
  }

  async function _render(box) {
    const catId = Number(box.dataset.cat);
    const [res, pubCats] = await Promise.all([window.ApiService.churches.songs(_churchId), _publicCategories()]);
    const songs = (res.songs || []).filter((s) => Number(s.category_id) === catId);
    box._songs = Object.fromEntries(songs.map((s) => [s.id, s]));
    box.innerHTML = songs.length ? songs.map((s) => _row(s, pubCats)).join('') : '<li class="text-muted">Chưa có bài trong danh mục này</li>';
  }

  /** Mở/đóng danh sách bài của một danh mục riêng; `li` là dòng danh mục. */
  async function toggle(li, churchId, showToast) {
    _churchId = churchId;
    if (showToast) _toast = showToast;
    let box = li.querySelector('.mgr-church-songs');
    if (box) { box.remove(); return; }
    box = document.createElement('ul');
    box.className = 'mgr-church-songs';
    box.dataset.cat = li.dataset.id;
    box.addEventListener('click', (e) => _onClick(e, box));
    li.appendChild(box);
    try { await _render(box); } catch (e) { _toast(e.message, 'error'); }
  }

  async function _onClick(e, box) {
    const btn = e.target.closest('button[data-act]');
    const li = btn?.closest('.mgr-church-song');
    if (!btn || !li) return;
    const id = li.dataset.song;
    const api = window.ApiService.churches;
    try {
      switch (btn.dataset.act) {
        case 'song-edit': _editForm(li, box._songs[id]); return;
        case 'song-cancel': await _render(box); return;
        case 'song-save': {
          const val = (f) => li.querySelector(`[data-f="${f}"]`).value;
          await api.updateSong(_churchId, id, { title: val('title'), composer: val('composer'), tempo: val('tempo') });
          _toast('Đã lưu', 'success');
          break;
        }
        case 'song-delete':
          if (!window.confirm(`Xóa bài "${box._songs[id].title}"? Không khôi phục được.`)) return;
          await api.deleteSong(_churchId, id);
          _toast('Đã xóa bài', 'success');
          break;
        case 'song-publish': {
          const target = Number(li.querySelector('[data-role="pub-cat"]').value);
          if (!target) { _toast('Chưa có danh mục công khai để chuyển vào', 'error'); return; }
          if (!window.confirm(PUBLIC_WARNING)) return;
          await api.publishSong(_churchId, id, target);
          _toast('Đã chuyển sang công khai', 'success');
          break;
        }
        default: return;
      }
      await _render(box);
    } catch (err) {
      _toast(err.message, 'error');
    }
  }

  return { toggle };
})();

window.ManagerChurchSongs = ManagerChurchSongs;
