/**
 * assets/js/core/ChurchContext.js
 * Hội Thánh (HT) đang làm việc ở app chính (Modern + Classic). Chỉ hoạt động khi cờ MULTI_CHURCH bật.
 * - Nhớ HT đang chọn (localStorage) để lọc gói offline khi mất mạng.
 * - Vẽ bộ chọn HT vào #church-switcher (chỉ hiện khi người dùng thuộc từ 2 HT trở lên).
 * - Đổi HT: gọi API rồi tải lại trang (danh sách chương trình, cache, quyền đều theo HT mới).
 *
 * Phụ thuộc: ApiService, EventBus, FeatureFlags, SafeHtml. Public API: { init, refresh, getActiveId, switchTo }
 */
const ChurchContext = (() => {
  'use strict';

  const STORAGE_KEY = 'sheetapp_active_church';
  const SWITCHER_ID = 'church-switcher';
  const DEEP_LINK_PARAMS = ['setlist', 'program'];

  let _activeId = _readStored();
  let _list = [];

  function _readStored() {
    try { return Number(localStorage.getItem(STORAGE_KEY)) || 0; } catch (_) { return 0; }
  }

  function _store(id) {
    try {
      if (id) localStorage.setItem(STORAGE_KEY, String(id)); else localStorage.removeItem(STORAGE_KEY);
    } catch (_) { /* chế độ riêng tư: bỏ qua */ }
  }

  function _enabled() {
    return Boolean(window.FeatureFlags?.get?.('MULTI_CHURCH'));
  }

  function getActiveId() { return _activeId; }

  function _esc(s) {
    return window.SafeHtml?.escape ? window.SafeHtml.escape(s) : String(s ?? '');
  }

  function _render() {
    const box = document.getElementById(SWITCHER_ID);
    if (!box) return;
    if (_list.length < 2) { box.classList.add('hidden'); box.innerHTML = ''; return; }
    box.innerHTML = '<label class="church-switcher-label" for="church-switcher-select">Hội Thánh</label>'
      + '<select id="church-switcher-select" class="form-input w-full">'
      + _list.map((c) => `<option value="${Number(c.id)}"${Number(c.id) === _activeId ? ' selected' : ''}>${_esc(c.name)}</option>`).join('')
      + '</select>';
    box.classList.remove('hidden');
    document.getElementById('church-switcher-select')?.addEventListener('change', (e) => switchTo(Number(e.target.value)));
  }

  async function refresh() {
    if (!_enabled()) return;
    if (!window.Auth?.isLoggedIn?.()) { _list = []; _activeId = 0; _store(0); _render(); return; }
    try {
      const res = await window.ApiService.churches.mine();
      _list = Array.isArray(res.all_churches) ? res.all_churches : (res.churches || []);
      _activeId = Number(res.active_church_id) || 0;
      _store(_activeId);
      _render();
    } catch (e) {
      console.warn('[ChurchContext] refresh failed:', e);
    }
  }

  async function switchTo(churchId) {
    if (!churchId || churchId === _activeId) return;
    try {
      await window.ApiService.churches.switchTo(churchId);
      _activeId = churchId;
      _store(churchId);
      window.EventBus?.emit?.('church:changed', { churchId });
      _reloadWithoutDeepLinks();
    } catch (e) {
      window.App?.showToast?.('Không đổi được Hội Thánh: ' + e.message, 'error');
      _render();
    }
  }

  /** Chương trình/bài cũ thuộc HT trước có thể không còn truy cập được → bỏ tham số liên kết sâu. */
  function _reloadWithoutDeepLinks() {
    const url = new URL(window.location.href);
    DEEP_LINK_PARAMS.forEach((p) => url.searchParams.delete(p));
    window.location.assign(url.toString());
  }

  function init() {
    if (!_enabled()) return;
    window.EventBus?.on?.('auth:changed', refresh);
    window.EventBus?.on?.('church:changed', ({ churchId } = {}) => { if (churchId) { _activeId = churchId; _store(churchId); } });
    setTimeout(refresh, 0);
  }

  return { init, refresh, getActiveId, switchTo };
})();

window.ChurchContext = ChurchContext;
ChurchContext.init();
