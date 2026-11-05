/**
 * assets/js/learn/ui/learn-week-plan.js
 * "Tuần này tôi cần tập gì": đầu bảng chọn bài hiện các bài của chương trình lễ sắp tới (gần ngày nhất, đã phát hành),
 * bấm một bài là mở tập ngay. Chỉ dùng dữ liệu chương trình sẵn có; khách hoặc chưa có chương trình → ẩn.
 *
 * Phụ thuộc: ApiService, SafeHtml. Public API: { refresh }
 */
const WeekPlan = (() => {
  'use strict';

  const CONTAINER_ID = 'learn-week-plan';
  const MAX_SONGS = 12;

  let _loaded = false;

  function _esc(s) {
    return window.SafeHtml?.escape ? window.SafeHtml.escape(s) : String(s ?? '');
  }

  function _todayIso() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  /** Chương trình đã phát hành, ngày >= hôm nay, gần nhất. */
  function _pickUpcoming(list) {
    const today = _todayIso();
    return (list || [])
      .filter((s) => s.status === 'published' && s.scheduled_date && String(s.scheduled_date).slice(0, 10) >= today)
      .sort((a, b) => String(a.scheduled_date).localeCompare(String(b.scheduled_date)))[0] || null;
  }

  function _formatDate(iso) {
    const [y, m, d] = String(iso).slice(0, 10).split('-');
    return `${d}/${m}/${y}`;
  }

  function _render(box, setlist) {
    const items = (setlist.items || []).filter((i) => i.song_id).slice(0, MAX_SONGS);
    if (!items.length) { box.classList.add('hidden'); return; }
    const rows = items.map((i) => {
      const key = Number(i.transpose_key) ? ` · ${Number(i.transpose_key) > 0 ? '+' : ''}${Number(i.transpose_key)}` : '';
      return `<button type="button" class="learn-week-song" data-song="${_esc(i.song_id)}">${_esc(i.song_title || i.song_id)}<small>${_esc(key)}</small></button>`;
    }).join('');
    box.innerHTML = `<div class="learn-week-title">Tuần này cần tập · ${_esc(setlist.title || 'Chương trình')} (${_formatDate(setlist.scheduled_date)})</div>${rows}`;
    box.classList.remove('hidden');
  }

  /** Mở bài: bấm đúng dòng trong danh sách bài sẵn có để dùng chung luồng chọn bài của LearnApp. */
  function _onClick(e) {
    const btn = e.target.closest('.learn-week-song');
    if (!btn) return;
    const target = [...document.querySelectorAll('.learn-song-item')].find((el) => el.dataset.id === btn.dataset.song);
    target?.click();
  }

  async function refresh() {
    const box = document.getElementById(CONTAINER_ID);
    if (!box || _loaded) return;
    _loaded = true;
    box.addEventListener('click', _onClick);
    try {
      const res = await window.ApiService.setlists.list();
      const next = _pickUpcoming(res?.data);
      if (!next) { box.classList.add('hidden'); return; }
      const detail = await window.ApiService.setlists.get(next.id);
      _render(box, detail?.data || next);
    } catch (e) {
      box.classList.add('hidden'); // khách (401) hoặc lỗi mạng: không làm phiền
    }
  }

  return { refresh };
})();

window.WeekPlan = WeekPlan;
